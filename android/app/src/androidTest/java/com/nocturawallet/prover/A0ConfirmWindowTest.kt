package com.nocturawallet.prover

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.SystemClock
import android.view.MotionEvent
import android.view.WindowManager
import androidx.test.platform.app.InstrumentationRegistry
import com.nocturawallet.MainActivity
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * The native confirmation's window ON THE PHONE (spec §4 "Window and lifecycle rules", I10; §14
 * "Kotlin (M1c)") — what only a real window shows; the decision logic is the JVM's
 * (A0ConfirmMachineTest). Instruments the installed devnet RELEASE app like M1aCheckpointTest
 * (`testBuildType "release"`); this class lives in the test APK only. Run one class at a time:
 *
 *   adb shell am instrument -w -r -e class com.nocturawallet.prover.A0ConfirmWindowTest \
 *     com.nocturawallet.devnet.test/androidx.test.runner.AndroidJUnitRunner
 *
 * No Rust call is made: the controller rows use a fake [A0UnshieldNative] (parse answers a fixed
 * record, authorize is never reached — no row here approves a biometric), and an authenticator
 * check that says "usable", so the rows run on a phone with or without an enrolled biometric.
 * What these rows cannot show: the BiometricPrompt itself (a human finger), whether the system
 * prompt pauses the activity on this phone's OEM build (if it does, every confirmation fails
 * closed with E_A0_CONFIRM_INTERRUPTED — the M1c checkpoint's unshield shows it), and an overlay
 * drawn by another app (hidden-overlay is read off the window's attributes, not watched).
 */
class A0ConfirmWindowTest {
    private val inst = InstrumentationRegistry.getInstrumentation()
    private lateinit var activity: Activity

    private val parsed = A0ParsedUnshield(
        owner = "GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd",
        ata = "9hZSf8jMxBdqcvnYzj6EkQ2gPoZCoX2GcF8f1dgkyLsn",
        amount = "1500000000",
        fee = "10000",
        humanAmount = "1.5",
        humanFee = "0.00001",
        pool = "8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT",
    )

    private val fake = object : A0UnshieldNative {
        override fun parse(owner: String, amount: String, fee: String): A0Result = A0Result.Ok(
            JSONObject()
                .put("owner", parsed.owner).put("ata", parsed.ata).put("amount", parsed.amount).put("fee", parsed.fee)
                .put("humanAmount", parsed.humanAmount).put("humanFee", parsed.humanFee).put("pool", parsed.pool),
        )

        override fun authorize(handle: String, owner: String, amount: String, fee: String): A0Result =
            throw AssertionError("no row here may reach authorizeUnshield")
    }

    @Before
    fun launch() {
        val intent = Intent(inst.targetContext, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        activity = inst.startActivitySync(intent)
        inst.waitForIdleSync()
    }

    @After
    fun finish() {
        inst.runOnMainSync { activity.finish() }
    }

    private fun <T> onMain(block: () -> T): T {
        val out = AtomicReference<T>()
        inst.runOnMainSync { out.set(block()) }
        return out.get()
    }

    private fun tap(target: android.view.View, flags: Int) {
        val loc = IntArray(2)
        inst.runOnMainSync { target.getLocationInWindow(loc) }
        val x = loc[0] + target.width / 2f
        val y = loc[1] + target.height / 2f
        val t = SystemClock.uptimeMillis()
        for ((action, at) in listOf(MotionEvent.ACTION_DOWN to t, MotionEvent.ACTION_UP to t + 50)) {
            val props = arrayOf(MotionEvent.PointerProperties().apply { id = 0; toolType = MotionEvent.TOOL_TYPE_FINGER })
            val coords = arrayOf(MotionEvent.PointerCoords().apply { this.x = x; this.y = y; pressure = 1f; size = 1f })
            // the public obtain(...) overload that carries `flags` — how the framework marks an obscured window
            val ev = MotionEvent.obtain(t, at, action, 1, props, coords, 0, 0, 1f, 1f, 0, 0, android.view.InputDevice.SOURCE_TOUCHSCREEN, flags)
            inst.runOnMainSync { target.rootView.dispatchTouchEvent(ev) }
            ev.recycle()
        }
        inst.waitForIdleSync()
    }

    @Test
    fun theDialogsWindowIsSecureAndHidesOverlaysOnApi31() {
        val d = onMain { A0ConfirmDialog.build(activity, parsed, onApprove = {}, onCancel = {}).also { it.dialog.show() } }
        try {
            val attrs = onMain { d.dialog.window!!.attributes }
            assertTrue("FLAG_SECURE", attrs.flags and WindowManager.LayoutParams.FLAG_SECURE != 0)
            assertTrue("filterTouchesWhenObscured", d.approve.filterTouchesWhenObscured)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // setHideOverlayWindows sets a private flag; LayoutParams.toString names it
                val s = attrs.toString()
                assertTrue("HIDE_NON_SYSTEM_OVERLAY_WINDOWS not in $s", s.contains("HIDE_NON_SYSTEM_OVERLAY_WINDOWS"))
            }
        } finally {
            inst.runOnMainSync { d.dialog.dismiss() }
        }
    }

    @Test
    fun anObscuredTouchDoesNotApproveAndACleanOneDoes() {
        val m = A0ConfirmMachine({ SystemClock.elapsedRealtime() })
        val t = (m.begin(true) as A0ConfirmMachine.Begin.Started).ticket
        val steps = mutableListOf<A0ConfirmMachine.Step>()
        val d = onMain {
            A0ConfirmDialog.build(activity, parsed, onApprove = { f -> steps.add(m.approve(t, f)) }, onCancel = {})
                .also { it.dialog.show() }
        }
        try {
            m.shown(t)
            tap(d.approve, MotionEvent.FLAG_WINDOW_IS_OBSCURED) // dropped by the framework: no click at all
            assertEquals(emptyList<A0ConfirmMachine.Step>(), steps)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                tap(d.approve, MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED) // reaches the click; the machine ignores it
                assertEquals(listOf<A0ConfirmMachine.Step>(A0ConfirmMachine.Step.Ignore), steps)
                steps.clear()
            }
            tap(d.approve, 0) // positive control: a clean tap approves
            assertEquals(listOf<A0ConfirmMachine.Step>(A0ConfirmMachine.Step.Continue), steps)
        } finally {
            inst.runOnMainSync { d.dialog.dismiss() }
        }
    }

    private class Outcomes {
        val latch = CountDownLatch(1)
        val got = AtomicReference<A0ConfirmOutcome>()
        val settle: (A0ConfirmOutcome) -> Unit = { o ->
            check(got.compareAndSet(null, o)) { "settled twice: ${got.get()} then $o" }
            latch.countDown()
        }

        fun await(seconds: Long): A0ConfirmOutcome {
            assertTrue("no outcome within $seconds s", latch.await(seconds, TimeUnit.SECONDS))
            return got.get()
        }
    }

    private fun controller(timeoutMs: Long = A0ConfirmMachine.TIMEOUT_MS) =
        A0ConfirmController(fake, canAuthenticate = { _, _ -> true }, timeoutMs = timeoutMs)

    private fun refusal(r: A0ConfirmRefusal) = A0ConfirmOutcome.Refused(r.code, r.message)

    @Test
    fun aNullActivityRefusesWithNoDialog() {
        val o = Outcomes()
        controller().start(null, "1", parsed.owner, parsed.amount, parsed.fee, o.settle)
        assertEquals(refusal(A0ConfirmRefusal.NO_ACTIVITY), o.await(1))
    }

    @Test
    fun aSecondRequestWhileOneIsInFlightIsRefused() {
        val c = controller()
        val first = Outcomes()
        c.start(activity, "1", parsed.owner, parsed.amount, parsed.fee, first.settle)
        inst.waitForIdleSync()
        val second = Outcomes()
        c.start(activity, "1", parsed.owner, parsed.amount, parsed.fee, second.settle)
        assertEquals(refusal(A0ConfirmRefusal.BUSY), second.await(1))
        c.sessionChanged() // end the first (keysClose)
        assertEquals(refusal(A0ConfirmRefusal.SESSION), first.await(5))
    }

    @Test
    fun recreatingTheActivityDuringTheDialogFailsClosed() {
        val c = controller()
        val o = Outcomes()
        c.start(activity, "1", parsed.owner, parsed.amount, parsed.fee, o.settle)
        inst.waitForIdleSync()
        inst.runOnMainSync { activity.recreate() }
        assertEquals(refusal(A0ConfirmRefusal.INTERRUPTED), o.await(10))
    }

    @Test
    fun noApprovalWithinTheTimeoutRefuses() {
        val c = controller(timeoutMs = 1_500)
        val o = Outcomes()
        c.start(activity, "1", parsed.owner, parsed.amount, parsed.fee, o.settle)
        val r = o.await(10)
        assertNotNull(r)
        assertEquals(refusal(A0ConfirmRefusal.TIMEOUT), r)
    }
}
