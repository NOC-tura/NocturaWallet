package com.nocturawallet.prover

import org.json.JSONObject

/**
 * The native confirmation of an unshield (spec 2026-11-08 shielded A0 M1 §4, I10, S4, S7): the
 * parts with no Android type in them, so the JVM tests hold them (A0ConfirmMachineTest,
 * A0AuthenticatorsTest, A0ConfirmTextTest). The window, the dialog and the BiometricPrompt that
 * drive them are [A0ConfirmController] and [A0ConfirmDialog].
 */

/** A refusal of `confirmUnshield`: a stable code and a fixed message (nothing from JS, nothing secret). */
internal enum class A0ConfirmRefusal(val code: String, val message: String) {
    BUSY("E_A0_CONFIRM_BUSY", "another confirmation is in flight"),
    NO_ACTIVITY("E_A0_CONFIRM_NO_ACTIVITY", "the app is not in the foreground"),
    NO_AUTHENTICATOR("E_A0_CONFIRM_NO_AUTHENTICATOR", "no strong biometric or device credential is usable on this device"),
    CANCELLED("E_A0_CONFIRM_CANCELLED", "the confirmation was cancelled"),
    TIMEOUT("E_A0_CONFIRM_TIMEOUT", "no approval within 60 s"),
    BIOMETRIC("E_A0_CONFIRM_BIOMETRIC", "the biometric prompt ended without an approval"),
    INTERRUPTED("E_A0_CONFIRM_INTERRUPTED", "the app was paused, stopped or recreated during the confirmation"),
    SESSION("E_A0_CONFIRM_SESSION", "the key session was closed or replaced during the confirmation"),
    UI("E_A0_CONFIRM_UI", "the confirmation could not be shown"),
}

/**
 * The confirmation's decision logic (§4 steps 3–5 and the window and lifecycle rules), one request
 * at a time, every method synchronized: JS calls arrive on React Native's native-modules thread,
 * the dialog and the prompt call back on the UI thread, and `keysOpen` / `keysClose` may land
 * from either side of a confirmation.
 *
 * Each request gets a ticket. Every event names its ticket and is [Step.Ignore]d unless that
 * ticket is the live one in the phase the event belongs to, so a late callback of a settled
 * request (the prompt's ERROR_CANCELED after we cancelled it, a timer that fires after an
 * approval) can never settle anything twice or touch the next request. A [Step.Refuse] returns
 * the machine to IDLE in the same step; [Step.Authorize] moves it to AUTHORIZING, from which only
 * [authorized] leaves.
 *
 * The 60 s run from [begin] on [now] (the controller passes `SystemClock.elapsedRealtime`, which
 * counts deep sleep — CLOCK_BOOTTIME, like Rust's 120 s); an approval at or past the deadline is a
 * timeout even if the timer has not fired yet.
 */
internal class A0ConfirmMachine(private val now: () -> Long, private val timeoutMs: Long = TIMEOUT_MS) {
    enum class Phase { IDLE, STARTING, DIALOG, PROMPT, AUTHORIZING }

    sealed class Begin {
        data class Started(val ticket: Long) : Begin()

        data class Refused(val refusal: A0ConfirmRefusal) : Begin()
    }

    sealed class Step {
        /** Nothing happens: a stale ticket, an event of another phase, an obscured touch. */
        object Ignore : Step()

        /** The transition happened; the caller carries on (shows the dialog's next part, the prompt). */
        object Continue : Step()

        /** The biometric approved within the deadline: call `authorizeUnshield` now, exactly once. */
        object Authorize : Step()

        /** Settle the request with this refusal; the machine is IDLE again. */
        data class Refuse(val refusal: A0ConfirmRefusal) : Step()
    }

    companion object {
        const val TIMEOUT_MS = 60_000L
    }

    private var phase = Phase.IDLE
    private var ticket = 0L
    private var deadline = 0L

    @Synchronized fun phase(): Phase = phase

    /** The live ticket, or null when IDLE. */
    @Synchronized fun live(): Long? = if (phase == Phase.IDLE) null else ticket

    /**
     * A new request. Refused, with the live one untouched, while another is in flight; refused
     * when there is no foreground activity to show a dialog in (§4: "currentActivity null →
     * refusal, no dialog").
     */
    @Synchronized fun begin(activityPresent: Boolean): Begin {
        if (phase != Phase.IDLE) return Begin.Refused(A0ConfirmRefusal.BUSY)
        if (!activityPresent) return Begin.Refused(A0ConfirmRefusal.NO_ACTIVITY)
        ticket += 1
        phase = Phase.STARTING
        deadline = now() + timeoutMs
        return Begin.Started(ticket)
    }

    private fun live(t: Long, vararg phases: Phase): Boolean = t == ticket && phase in phases

    private fun expired(): Boolean = now() >= deadline

    private fun refuse(r: A0ConfirmRefusal): Step {
        phase = Phase.IDLE
        return Step.Refuse(r)
    }

    /** The dialog is on screen. */
    @Synchronized fun shown(t: Long): Step = when {
        !live(t, Phase.STARTING) -> Step.Ignore
        expired() -> refuse(A0ConfirmRefusal.TIMEOUT)
        else -> {
            phase = Phase.DIALOG
            Step.Continue
        }
    }

    /**
     * The approve control was clicked; [touchFlags] are the `MotionEvent` flags of the gesture that
     * clicked it ([A0Touch.accumulate]). A gesture with FLAG_WINDOW_IS_OBSCURED or
     * FLAG_WINDOW_IS_PARTIALLY_OBSCURED is ignored — not a refusal: the dialog stays up and an
     * unobscured tap still works (I10: "a touch delivered while obscured is ignored").
     */
    @Synchronized fun approve(t: Long, touchFlags: Int): Step = when {
        !live(t, Phase.DIALOG) -> Step.Ignore
        A0Touch.obscured(touchFlags) -> Step.Ignore
        expired() -> refuse(A0ConfirmRefusal.TIMEOUT)
        else -> {
            phase = Phase.PROMPT
            Step.Continue
        }
    }

    /** The user cancelled (the dialog's Cancel, back). */
    @Synchronized fun cancel(t: Long): Step =
        if (live(t, Phase.STARTING, Phase.DIALOG, Phase.PROMPT)) refuse(A0ConfirmRefusal.CANCELLED) else Step.Ignore

    /** The prompt ended with an error; [byUser] = the user cancelled it (ERROR_USER_CANCELED / NEGATIVE_BUTTON). */
    @Synchronized fun promptError(t: Long, byUser: Boolean): Step =
        if (!live(t, Phase.PROMPT)) {
            Step.Ignore
        } else {
            refuse(if (byUser) A0ConfirmRefusal.CANCELLED else A0ConfirmRefusal.BIOMETRIC)
        }

    /** The prompt approved. Only now — and only before the deadline — may Rust record an authorization. */
    @Synchronized fun promptSucceeded(t: Long): Step = when {
        !live(t, Phase.PROMPT) -> Step.Ignore
        expired() -> refuse(A0ConfirmRefusal.TIMEOUT)
        else -> {
            phase = Phase.AUTHORIZING
            Step.Authorize
        }
    }

    /** `authorizeUnshield` returned (ok or refused): the request is over. True only for the live ticket. */
    @Synchronized fun authorized(t: Long): Boolean {
        if (!live(t, Phase.AUTHORIZING)) return false
        phase = Phase.IDLE
        return true
    }

    /**
     * The activity was paused, stopped or destroyed (a recreation is a pause then a destroy) while
     * the dialog or the prompt was up: fail closed, the user starts again (I10).
     */
    @Synchronized fun interrupted(t: Long): Step =
        if (live(t, Phase.STARTING, Phase.DIALOG, Phase.PROMPT)) refuse(A0ConfirmRefusal.INTERRUPTED) else Step.Ignore

    /** The 60 s timer fired. Ignored if, by [now], the deadline has not passed. */
    @Synchronized fun timeout(t: Long): Step =
        if (live(t, Phase.STARTING, Phase.DIALOG, Phase.PROMPT) && expired()) refuse(A0ConfirmRefusal.TIMEOUT) else Step.Ignore

    /** A setup step failed before the prompt could approve (no authenticator, a dialog that would not show). */
    @Synchronized fun fail(t: Long, r: A0ConfirmRefusal): Step =
        if (live(t, Phase.STARTING, Phase.DIALOG, Phase.PROMPT)) refuse(r) else Step.Ignore

    /**
     * `keysClose` or a second `keysOpen` (§4: "invalidates a live authId"; §3 m5): a confirmation
     * still waiting for the human fails closed, and the caller settles the returned ticket. In
     * AUTHORIZING the call into Rust is already under way on the UI thread: Rust's one mutex
     * orders it against the close, and either order leaves no live authorization (the close kills
     * a recorded one; a stale handle is refused) — so the machine does not interfere.
     */
    @Synchronized fun sessionChanged(): Pair<Long, Step> =
        if (phase == Phase.STARTING || phase == Phase.DIALOG || phase == Phase.PROMPT) {
            ticket to refuse(A0ConfirmRefusal.SESSION)
        } else {
            ticket to Step.Ignore
        }
}

/** The obscured-window flags of a touch gesture (I10). */
internal object A0Touch {
    /** `MotionEvent.FLAG_WINDOW_IS_OBSCURED` (API 9). */
    const val FLAG_WINDOW_IS_OBSCURED = 0x1

    /** `MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED` (API 29; never set below it). */
    const val FLAG_WINDOW_IS_PARTIALLY_OBSCURED = 0x2

    const val OBSCURED = FLAG_WINDOW_IS_OBSCURED or FLAG_WINDOW_IS_PARTIALLY_OBSCURED

    /** `MotionEvent.ACTION_DOWN`. */
    const val ACTION_DOWN = 0

    fun obscured(flags: Int): Boolean = flags and OBSCURED != 0

    /**
     * The obscured bits of every event of one gesture: a DOWN starts afresh, every later event
     * adds its bits, so one obscured event anywhere in the gesture taints the click it ends in.
     */
    fun accumulate(previous: Int, actionMasked: Int, flags: Int): Int =
        if (actionMasked == ACTION_DOWN) flags and OBSCURED else previous or (flags and OBSCURED)
}

/**
 * The authenticators the prompt allows, per API level (§4 step 4; controller ruling 8: "STRONG |
 * DEVICE_CREDENTIAL where supported, a stated fallback per API level, a level with no safe
 * combination refuses"). Measured on androidx.biometric 1.1.0 (the AAR the app resolves, sha256
 * 270c7b7d…; `AuthenticatorUtils.isSupportedCombination` and `BiometricFragment`, read with javap —
 * Task 6 Notes):
 *
 * | API      | allowed                          | why                                                          |
 * |----------|----------------------------------|--------------------------------------------------------------|
 * | 30+      | BIOMETRIC_STRONG or DEVICE_CREDENTIAL | supported; the framework prompt shows the credential itself |
 * | 28–29    | BIOMETRIC_STRONG                 | STRONG or CREDENTIAL is unsupported here; WEAK or CREDENTIAL would admit a Class 2 biometric |
 * | 24–27    | BIOMETRIC_STRONG                 | STRONG or CREDENTIAL is accepted, but androidx then launches the KeyguardManager credential ACTIVITY, which pauses ours — the lifecycle rule fails it closed every time |
 * | < 24     | none (refuse)                    | below minSdk                                                 |
 *
 * BIOMETRIC_WEAK is never allowed. A device whose level allows only BIOMETRIC_STRONG and that has
 * no strong biometric enrolled is refused (`canAuthenticate` ≠ SUCCESS → E_A0_CONFIRM_NO_AUTHENTICATOR).
 */
internal object A0Authenticators {
    /** `BiometricManager.Authenticators.BIOMETRIC_STRONG` (0x000F) — held equal by A0AuthenticatorsTest. */
    const val BIOMETRIC_STRONG = 0x000F

    /** `BiometricManager.Authenticators.BIOMETRIC_WEAK` (0x00FF) — never used; named for the tests. */
    const val BIOMETRIC_WEAK = 0x00FF

    /** `BiometricManager.Authenticators.DEVICE_CREDENTIAL` (0x8000). */
    const val DEVICE_CREDENTIAL = 0x8000

    const val MIN_SDK = 24

    fun forApi(sdk: Int): Int? = when {
        sdk < MIN_SDK -> null
        sdk >= 30 -> BIOMETRIC_STRONG or DEVICE_CREDENTIAL
        else -> BIOMETRIC_STRONG
    }

    /** With a device credential allowed the prompt has no negative button (androidx requires it absent). */
    fun allowsCredential(authenticators: Int): Boolean = authenticators and DEVICE_CREDENTIAL != 0
}

/**
 * Rust's `parseUnshield` answer (§3: `{owner, ata, amount, fee, humanAmount, humanFee, pool}`,
 * every value computed in Rust; amounts as decimal strings). The dialog shows these and nothing
 * else; `authorizeUnshield` is called with [owner], [amount], [fee] from here — the values the
 * human saw — never with the strings JS passed.
 */
internal data class A0ParsedUnshield(
    val owner: String,
    val ata: String,
    val amount: String,
    val fee: String,
    val humanAmount: String,
    val humanFee: String,
    val pool: String,
) {
    companion object {
        private val KEYS = listOf("owner", "ata", "amount", "fee", "humanAmount", "humanFee", "pool")

        /** Exactly the seven keys, each a non-empty string; anything else is null (E_A0_INTERNAL). */
        fun from(value: Any?): A0ParsedUnshield? {
            if (value !is JSONObject) return null
            if (value.length() != KEYS.size) return null
            val v = KEYS.map { k -> (value.opt(k) as? String)?.takeIf { it.isNotEmpty() } ?: return null }
            return A0ParsedUnshield(v[0], v[1], v[2], v[3], v[4], v[5], v[6])
        }
    }
}

/**
 * The dialog's text (§4 step 3), from the format strings of `res/values/a0_confirm_strings.xml`
 * (passed in, so the JVM test renders the real resource). The owner and the token account are
 * whole — never truncated, never ellipsized (substitution attacks live in matching prefixes).
 *
 * The token's symbol is Kotlin's own (M1c Task 8, controller ruling): [tokenSymbol] of this
 * build's network, read from BuildConfig by the controller — never a value from JS (the dialog is
 * the trust boundary; S7). It names the mint Rust already pins (`A0.mint`): the devnet pool's test
 * mint is shown as "TEST", as #16 and #21 show it; any other network shows "NOC".
 */
internal data class A0ConfirmText(
    val destinationLabel: String,
    val owner: String,
    val tokenAccountLabel: String,
    val ata: String,
    val amountLine: String,
    val feeLine: String,
    val poolLabel: String,
    val pool: String,
) {
    companion object {
        /** The symbol the dialog names the pool's token by: "TEST" on devnet (exactly), else "NOC". */
        fun tokenSymbol(network: String): String = if (network == "devnet") "TEST" else "NOC"

        fun render(
            p: A0ParsedUnshield,
            destinationLabel: String,
            tokenAccountLabel: String,
            amountFormat: String,
            feeFormat: String,
            poolLabel: String,
            symbol: String,
        ): A0ConfirmText = A0ConfirmText(
            destinationLabel = destinationLabel,
            owner = p.owner,
            tokenAccountLabel = tokenAccountLabel,
            ata = p.ata,
            amountLine = String.format(java.util.Locale.ROOT, amountFormat, p.humanAmount, p.amount, symbol),
            feeLine = String.format(java.util.Locale.ROOT, feeFormat, p.humanFee, symbol),
            poolLabel = poolLabel,
            pool = p.pool,
        )
    }
}
