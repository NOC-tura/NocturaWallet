package com.nocturawallet.prover

import android.app.Activity
import android.app.AlertDialog
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.util.TypedValue
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.nocturawallet.BuildConfig
import com.nocturawallet.R

/** How a confirmation ends: Rust's answer to `authorizeUnshield`, or a refusal. */
internal sealed class A0ConfirmOutcome {
    /** `authId` (32 hex, from Rust) and the owner / token account Rust parsed and the human approved. */
    data class Approved(val authId: String, val owner: String, val ata: String) : A0ConfirmOutcome()

    data class Refused(val code: String, val message: String) : A0ConfirmOutcome()
}

/** The two Kotlin-only Rust calls (§3), injectable so the instrumented test can run without the library. */
internal interface A0UnshieldNative {
    fun parse(owner: String, amount: String, fee: String): A0Result

    fun authorize(handle: String, owner: String, amount: String, fee: String): A0Result
}

/**
 * The dialog (§4 step 3, I10): Rust's values only, the owner whole, `FLAG_SECURE` on its window,
 * non-system overlays hidden on API 31+, an approve control that filters obscured touches and
 * reports the gesture's obscured flags to the machine (FLAG_WINDOW_IS_PARTIALLY_OBSCURED is not
 * filtered by `filterTouchesWhenObscured`; the machine ignores it).
 */
internal class A0ConfirmDialog private constructor(val dialog: AlertDialog, val approve: Button) {
    companion object {
        fun build(
            activity: Activity,
            p: A0ParsedUnshield,
            onApprove: (touchFlags: Int) -> Unit,
            onCancel: () -> Unit,
        ): A0ConfirmDialog {
            val res = activity.resources
            val text = A0ConfirmText.render(
                p,
                destinationLabel = res.getString(R.string.a0_confirm_destination_label),
                tokenAccountLabel = res.getString(R.string.a0_confirm_token_account_label),
                amountFormat = res.getString(R.string.a0_confirm_amount_line),
                feeFormat = res.getString(R.string.a0_confirm_fee_line),
                poolLabel = res.getString(R.string.a0_confirm_pool_label),
                // Kotlin's own: this build's network from BuildConfig, never a value from JS
                symbol = A0ConfirmText.tokenSymbol(BuildConfig.A0_NETWORK),
            )
            val dp = { v: Int -> TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), res.displayMetrics).toInt() }
            val column = LinearLayout(activity).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(24), dp(8), dp(24), dp(8))
            }
            fun line(s: String, sp: Float, bold: Boolean = false, mono: Boolean = false, top: Int = 0) =
                TextView(activity).apply {
                    this.text = s
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
                    typeface = when {
                        mono -> Typeface.MONOSPACE
                        bold -> Typeface.DEFAULT_BOLD
                        else -> Typeface.DEFAULT
                    }
                    // whole, wrapped: no maxLines, no ellipsis (the owner is never truncated)
                    ellipsize = null
                    maxLines = Int.MAX_VALUE
                    setPadding(0, dp(top), 0, 0)
                    column.addView(this)
                }
            line(text.destinationLabel, 14f, bold = true)
            line(text.owner, 16f, mono = true, top = 4)
            line(text.tokenAccountLabel, 12f, bold = true, top = 12)
            line(text.ata, 12f, mono = true, top = 2)
            line(text.amountLine, 15f, top = 16)
            line(text.feeLine, 14f, top = 8)
            line(text.poolLabel, 12f, bold = true, top = 12)
            line(text.pool, 12f, mono = true, top = 2)

            val buttons = LinearLayout(activity).apply {
                orientation = LinearLayout.HORIZONTAL
                setPadding(0, dp(16), 0, 0)
            }
            val cancel = Button(activity).apply { setText(R.string.a0_confirm_cancel) }
            val approve = Button(activity).apply {
                setText(R.string.a0_confirm_approve)
                // I10: a touch delivered while another window covers this one is dropped by the framework...
                filterTouchesWhenObscured = true
            }
            // ...and a partly covered one reaches the listener with its flag, which the machine ignores.
            var gesture = 0
            approve.setOnTouchListener { _, ev ->
                gesture = A0Touch.accumulate(gesture, ev.actionMasked, ev.flags)
                false
            }
            approve.setOnClickListener {
                val flags = gesture
                gesture = 0
                onApprove(flags)
            }
            cancel.setOnClickListener { onCancel() }
            buttons.addView(cancel, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            buttons.addView(approve, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            column.addView(buttons)

            val dialog = AlertDialog.Builder(activity)
                .setTitle(R.string.a0_confirm_title)
                .setView(ScrollView(activity).apply { addView(column) })
                .setCancelable(true)
                .create()
            dialog.setCanceledOnTouchOutside(false)
            dialog.setOnCancelListener { onCancel() }
            val window = dialog.window ?: throw IllegalStateException("the dialog has no window")
            window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                window.setHideOverlayWindows(true)
            }
            return A0ConfirmDialog(dialog, approve)
        }
    }
}

/**
 * `confirmUnshield` (§4): one process-wide controller, one [A0ConfirmMachine]. JS calls [start]
 * on the native-modules thread; everything that touches a view runs on the UI thread; every
 * outcome is delivered once through `settle`.
 *
 * Order: claim the one slot (refused while another is in flight, or with no foreground
 * FragmentActivity) → Rust `parseUnshield` (a refusal is Rust's code) → the authenticators for
 * this API level ([A0Authenticators]) and `canAuthenticate` → on the UI thread, the activity must
 * still be RESUMED → the dialog, a lifecycle observer (pause / stop / destroy → fail closed) and
 * the 60 s timer → approve (unobscured) → BiometricPrompt → on its success, before the deadline,
 * Rust `authorizeUnshield(handle, owner, amount, fee)` with the PARSED values → `{authId, owner,
 * ata}`. JS never reaches `authorizeUnshield`; it gets back an id it cannot forge.
 */
internal class A0ConfirmController(
    private val native: A0UnshieldNative,
    private val sdkInt: Int = Build.VERSION.SDK_INT,
    private val canAuthenticate: (Activity, Int) -> Boolean = { a, auth ->
        BiometricManager.from(a).canAuthenticate(auth) == BiometricManager.BIOMETRIC_SUCCESS
    },
    timeoutMs: Long = A0ConfirmMachine.TIMEOUT_MS,
) {
    private val machine = A0ConfirmMachine({ SystemClock.elapsedRealtime() }, timeoutMs)
    private val timeoutMs = timeoutMs
    private val main = Handler(Looper.getMainLooper())

    private class Live(
        val ticket: Long,
        val handle: String,
        val parsed: A0ParsedUnshield,
        val activity: FragmentActivity,
        val authenticators: Int,
        val settle: (A0ConfirmOutcome) -> Unit,
    ) {
        var dialog: A0ConfirmDialog? = null
        var prompt: BiometricPrompt? = null
        var observer: LifecycleEventObserver? = null
        var timer: Runnable? = null
    }

    @Volatile private var live: Live? = null

    fun start(activity: Activity?, handle: String, owner: String, amount: String, fee: String, settle: (A0ConfirmOutcome) -> Unit) {
        val fa = activity as? FragmentActivity
        val present = fa != null && !fa.isFinishing && !fa.isDestroyed
        val ticket = when (val b = machine.begin(present)) {
            is A0ConfirmMachine.Begin.Refused -> return settle(refused(b.refusal))
            is A0ConfirmMachine.Begin.Started -> b.ticket
        }
        fa!!
        val parsed = try {
            when (val r = native.parse(owner, amount, fee)) {
                is A0Result.Err -> return end(ticket, settle, A0ConfirmOutcome.Refused(r.code, r.message))
                is A0Result.Ok -> A0ParsedUnshield.from(r.value)
                    ?: return end(ticket, settle, A0ConfirmOutcome.Refused(A0Result.INTERNAL, "the parsed unshield is unreadable"))
            }
        } catch (e: Throwable) {
            return end(ticket, settle, A0ConfirmOutcome.Refused(A0Result.INTERNAL, "internal error"))
        }
        val auth = A0Authenticators.forApi(sdkInt)
        val usable = try {
            auth != null && canAuthenticate(fa, auth)
        } catch (e: Throwable) {
            false
        }
        if (auth == null || !usable) {
            machine.fail(ticket, A0ConfirmRefusal.NO_AUTHENTICATOR)
            return settle(refused(A0ConfirmRefusal.NO_AUTHENTICATOR))
        }
        val l = Live(ticket, handle, parsed, fa, auth, settle)
        live = l
        main.post { showDialog(l) }
    }

    /** `keysClose` / a second `keysOpen`: a confirmation still waiting for the human fails closed. */
    fun sessionChanged() {
        val (t, step) = machine.sessionChanged()
        val l = live
        if (step is A0ConfirmMachine.Step.Refuse && l != null && l.ticket == t) finish(l, step.refusal)
    }

    private fun end(ticket: Long, settle: (A0ConfirmOutcome) -> Unit, o: A0ConfirmOutcome.Refused) {
        machine.fail(ticket, A0ConfirmRefusal.UI)
        settle(o)
    }

    private fun refused(r: A0ConfirmRefusal) = A0ConfirmOutcome.Refused(r.code, r.message)

    private fun showDialog(l: Live) {
        if (machine.live() != l.ticket) return
        try {
            if (!l.activity.lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) {
                return apply(l, machine.interrupted(l.ticket))
            }
            val d = A0ConfirmDialog.build(
                l.activity,
                l.parsed,
                onApprove = { flags -> onApprove(l, flags) },
                onCancel = { apply(l, machine.cancel(l.ticket)) },
            )
            l.dialog = d
            val obs = LifecycleEventObserver { _, e ->
                if (e == Lifecycle.Event.ON_PAUSE || e == Lifecycle.Event.ON_STOP || e == Lifecycle.Event.ON_DESTROY) {
                    apply(l, machine.interrupted(l.ticket))
                }
            }
            l.observer = obs
            l.activity.lifecycle.addObserver(obs)
            val timer = Runnable { apply(l, machine.timeout(l.ticket)) }
            l.timer = timer
            main.postDelayed(timer, timeoutMs)
            d.dialog.show()
            apply(l, machine.shown(l.ticket))
        } catch (e: Throwable) {
            apply(l, machine.fail(l.ticket, A0ConfirmRefusal.UI))
        }
    }

    private fun onApprove(l: Live, touchFlags: Int) {
        val step = machine.approve(l.ticket, touchFlags)
        if (step !is A0ConfirmMachine.Step.Continue) return apply(l, step)
        l.dialog?.approve?.isEnabled = false
        try {
            val res = l.activity.resources
            val info = BiometricPrompt.PromptInfo.Builder()
                .setTitle(res.getString(R.string.a0_prompt_title))
                .setSubtitle(res.getString(R.string.a0_prompt_subtitle))
                .setAllowedAuthenticators(l.authenticators)
                .setConfirmationRequired(true)
                .apply {
                    if (!A0Authenticators.allowsCredential(l.authenticators)) {
                        setNegativeButtonText(res.getString(R.string.a0_confirm_cancel))
                    }
                }
                .build()
            val prompt = BiometricPrompt(
                l.activity,
                ContextCompat.getMainExecutor(l.activity),
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        onPromptSucceeded(l)
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        val byUser = errorCode == BiometricPrompt.ERROR_USER_CANCELED ||
                            errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                        apply(l, machine.promptError(l.ticket, byUser))
                    }
                    // onAuthenticationFailed (a finger that did not match) is not terminal: the prompt stays up.
                },
            )
            l.prompt = prompt
            prompt.authenticate(info)
        } catch (e: Throwable) {
            apply(l, machine.fail(l.ticket, A0ConfirmRefusal.UI))
        }
    }

    private fun onPromptSucceeded(l: Live) {
        val step = machine.promptSucceeded(l.ticket)
        if (step !is A0ConfirmMachine.Step.Authorize) return apply(l, step)
        val p = l.parsed
        val outcome = try {
            when (val r = native.authorize(l.handle, p.owner, p.amount, p.fee)) {
                is A0Result.Ok -> (r.value as? String)
                    ?.let { A0ConfirmOutcome.Approved(it, p.owner, p.ata) }
                    ?: A0ConfirmOutcome.Refused(A0Result.INTERNAL, "the authorization is unreadable")
                is A0Result.Err -> A0ConfirmOutcome.Refused(r.code, r.message)
            }
        } catch (e: Throwable) {
            A0ConfirmOutcome.Refused(A0Result.INTERNAL, "internal error")
        }
        if (machine.authorized(l.ticket)) {
            cleanup(l)
            l.settle(outcome)
        }
    }

    private fun apply(l: Live, step: A0ConfirmMachine.Step) {
        if (step is A0ConfirmMachine.Step.Refuse) finish(l, step.refusal)
    }

    /** Settles a refusal (the machine already went IDLE) and tears the UI down on the UI thread. */
    private fun finish(l: Live, r: A0ConfirmRefusal) {
        l.settle(refused(r))
        if (Looper.myLooper() == Looper.getMainLooper()) cleanup(l) else main.post { cleanup(l) }
    }

    private fun cleanup(l: Live) {
        l.timer?.let { main.removeCallbacks(it) }
        l.observer?.let { l.activity.lifecycle.removeObserver(it) }
        try {
            l.prompt?.cancelAuthentication()
        } catch (e: Throwable) {
            // the prompt may already be gone with its fragment
        }
        try {
            l.dialog?.dialog?.dismiss()
        } catch (e: Throwable) {
            // the window may already be gone with its activity
        }
        if (live === l) live = null
    }
}

/** The process-wide controller over the real library (like Rust's state, one per process). */
internal object A0Confirmations {
    private object RustUnshield : A0UnshieldNative {
        private fun call(native: () -> String?): A0Result =
            try {
                NocturaNativeLib.ensureLoaded()
                A0Result.parse(native())
            } catch (e: UnsatisfiedLinkError) {
                A0Result.Err(A0Result.UNAVAILABLE, "the native library is unavailable")
            }

        override fun parse(owner: String, amount: String, fee: String) = call { NocturaA0Native.parseUnshield(owner, amount, fee) }

        override fun authorize(handle: String, owner: String, amount: String, fee: String) =
            call { NocturaA0Native.authorizeUnshield(handle, owner, amount, fee) }
    }

    /** The one binding of the two Kotlin-only natives; [NocturaProverModule]'s internals delegate here. */
    val rust: A0UnshieldNative = RustUnshield

    val controller: A0ConfirmController by lazy { A0ConfirmController(RustUnshield) }
}
