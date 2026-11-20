package com.nocturawallet.prover

import com.nocturawallet.prover.A0ConfirmMachine.Begin
import com.nocturawallet.prover.A0ConfirmMachine.Phase
import com.nocturawallet.prover.A0ConfirmMachine.Step
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The native confirmation's decision logic (spec §4 steps 3–5, I10; §14 "Kotlin (M1c)": a touch
 * delivered with FLAG_WINDOW_IS_OBSCURED does not approve; a null currentActivity refuses; a
 * second request while one is in flight refuses; activity recreation during the prompt fails
 * closed) — plus the 60 s timeout, cancel, the prompt's errors, keysClose / keysOpen, and the
 * exactly-once rule. The window itself (FLAG_SECURE, the overlay hiding, the framework's touch
 * filter) is what only the phone shows: androidTest A0ConfirmWindowTest.
 */
class A0ConfirmMachineTest {
    private var clock = 1_000_000L
    private val m = A0ConfirmMachine({ clock })

    private fun started(): Long {
        val b = m.begin(activityPresent = true)
        assertTrue("$b", b is Begin.Started)
        return (b as Begin.Started).ticket
    }

    /** A request with its dialog on screen. */
    private fun inDialog(): Long {
        val t = started()
        assertSame(Step.Continue, m.shown(t))
        assertEquals(Phase.DIALOG, m.phase())
        return t
    }

    /** A request whose prompt is up. */
    private fun inPrompt(): Long {
        val t = inDialog()
        assertSame(Step.Continue, m.approve(t, 0))
        assertEquals(Phase.PROMPT, m.phase())
        return t
    }

    private fun refused(r: A0ConfirmRefusal) = Step.Refuse(r)

    // ---- §14 row 1: an obscured touch does not approve

    @Test
    fun aTouchDeliveredWhileObscuredDoesNotApprove() {
        val t = inDialog()
        assertSame(Step.Ignore, m.approve(t, A0Touch.FLAG_WINDOW_IS_OBSCURED))
        assertSame(Step.Ignore, m.approve(t, A0Touch.FLAG_WINDOW_IS_PARTIALLY_OBSCURED))
        assertSame(Step.Ignore, m.approve(t, A0Touch.OBSCURED or 0x100))
        // ignored, not refused: the dialog stays up and an unobscured tap still works (positive control)
        assertEquals(Phase.DIALOG, m.phase())
        assertSame(Step.Continue, m.approve(t, 0))
        assertEquals(Phase.PROMPT, m.phase())
    }

    @Test
    fun aGestureObscuredAnywhereTaintsTheClickItEndsIn() {
        val down = A0Touch.accumulate(0, A0Touch.ACTION_DOWN, 0)
        val move = A0Touch.accumulate(down, 2, A0Touch.FLAG_WINDOW_IS_PARTIALLY_OBSCURED) // ACTION_MOVE
        val up = A0Touch.accumulate(move, 1, 0) // ACTION_UP, clean
        val t = inDialog()
        assertSame(Step.Ignore, m.approve(t, up))
        // a new DOWN starts afresh: the next clean gesture approves
        val clean = A0Touch.accumulate(A0Touch.accumulate(up, A0Touch.ACTION_DOWN, 0), 1, 0)
        assertEquals(0, clean)
        assertSame(Step.Continue, m.approve(t, clean))
    }

    @Test
    fun otherMotionEventFlagsDoNotCountAsObscured() {
        // FLAG_TAINTED (0x80000000) and FLAG_IS_GENERATED_GESTURE (0x8) are not the window's cover
        assertFalse(A0Touch.obscured(0x8 or Int.MIN_VALUE))
        assertEquals(0, A0Touch.accumulate(0, A0Touch.ACTION_DOWN, 0x8 or Int.MIN_VALUE))
    }

    // ---- §14 row 2: a null currentActivity refuses

    @Test
    fun noForegroundActivityRefusesWithNoDialog() {
        assertEquals(Begin.Refused(A0ConfirmRefusal.NO_ACTIVITY), m.begin(activityPresent = false))
        assertEquals(Phase.IDLE, m.phase())
        assertNull(m.live())
        // nothing was claimed: the next request with an activity starts (control)
        assertTrue(m.begin(activityPresent = true) is Begin.Started)
    }

    // ---- §14 row 3: a second request while one is in flight refuses

    @Test
    fun aSecondRequestWhileOneIsInFlightIsRefusedAndTheFirstIsUntouched() {
        for (setup in listOf<() -> Long>({ started() }, { inDialog() }, { inPrompt() })) {
            val t = setup()
            val before = m.phase()
            assertEquals(Begin.Refused(A0ConfirmRefusal.BUSY), m.begin(true))
            assertEquals(Begin.Refused(A0ConfirmRefusal.BUSY), m.begin(false))
            assertEquals(t, m.live())
            assertEquals(before, m.phase())
            assertEquals(refused(A0ConfirmRefusal.CANCELLED), m.cancel(t))
        }
        val t = inPrompt()
        assertEquals(Begin.Refused(A0ConfirmRefusal.BUSY), m.begin(true))
        // the first still completes
        assertSame(Step.Authorize, m.promptSucceeded(t))
        assertEquals(Begin.Refused(A0ConfirmRefusal.BUSY), m.begin(true)) // AUTHORIZING is in flight too
        assertTrue(m.authorized(t))
        assertTrue(m.begin(true) is Begin.Started)
    }

    // ---- §14 row 4: recreation (pause / stop / destroy) during the dialog or the prompt fails closed

    @Test
    fun recreationDuringThePromptFailsClosedAndALateApprovalAuthorizesNothing() {
        val t = inPrompt()
        assertEquals(refused(A0ConfirmRefusal.INTERRUPTED), m.interrupted(t))
        assertEquals(Phase.IDLE, m.phase())
        // the prompt's success arriving after the pause (the old fragment's callback) is ignored
        assertSame(Step.Ignore, m.promptSucceeded(t))
        assertFalse(m.authorized(t))
    }

    @Test
    fun recreationDuringTheDialogOrBeforeItIsShownFailsClosed() {
        val a = inDialog()
        assertEquals(refused(A0ConfirmRefusal.INTERRUPTED), m.interrupted(a))
        assertSame(Step.Ignore, m.approve(a, 0))
        val b = started()
        assertEquals(refused(A0ConfirmRefusal.INTERRUPTED), m.interrupted(b))
        assertSame(Step.Ignore, m.shown(b))
    }

    @Test
    fun aPauseAfterTheRequestEndedChangesNothing() {
        val t = inPrompt()
        assertSame(Step.Authorize, m.promptSucceeded(t))
        assertSame(Step.Ignore, m.interrupted(t)) // AUTHORIZING: the Rust call is under way
        assertTrue(m.authorized(t))
        assertSame(Step.Ignore, m.interrupted(t))
    }

    // ---- the 60 s timeout

    @Test
    fun noApprovalWithin60sIsATimeout() {
        val t = inDialog()
        clock += 59_999
        assertSame(Step.Ignore, m.timeout(t)) // early timer: not yet
        clock += 1
        assertEquals(refused(A0ConfirmRefusal.TIMEOUT), m.timeout(t))
        assertSame(Step.Ignore, m.approve(t, 0))
    }

    @Test
    fun anApprovalAtTheDeadlineIsATimeoutEvenBeforeTheTimerFires() {
        val t = inPrompt()
        clock += A0ConfirmMachine.TIMEOUT_MS
        assertEquals(refused(A0ConfirmRefusal.TIMEOUT), m.promptSucceeded(t))
        assertFalse(m.authorized(t))
        val u = inDialog()
        clock += A0ConfirmMachine.TIMEOUT_MS
        assertEquals(refused(A0ConfirmRefusal.TIMEOUT), m.approve(u, 0))
        val v = started()
        clock += A0ConfirmMachine.TIMEOUT_MS
        assertEquals(refused(A0ConfirmRefusal.TIMEOUT), m.shown(v))
    }

    @Test
    fun theClockStartsAtBeginAndAnApprovalJustInsideIsAccepted() {
        val t = inPrompt()
        clock += A0ConfirmMachine.TIMEOUT_MS - 1
        assertSame(Step.Authorize, m.promptSucceeded(t))
        assertSame(Step.Ignore, m.timeout(t)) // the timer that fires after the approval is stale
        assertTrue(m.authorized(t))
    }

    // ---- cancel and the prompt's errors

    @Test
    fun cancelInEveryWaitingPhaseIsARefusal() {
        val a = started()
        assertEquals(refused(A0ConfirmRefusal.CANCELLED), m.cancel(a))
        val b = inDialog()
        assertEquals(refused(A0ConfirmRefusal.CANCELLED), m.cancel(b))
        val c = inPrompt()
        assertEquals(refused(A0ConfirmRefusal.CANCELLED), m.cancel(c))
        assertSame(Step.Ignore, m.cancel(c))
    }

    @Test
    fun thePromptsErrorsAreRefusalsAndOnlyItsSuccessAuthorizes() {
        val a = inPrompt()
        assertEquals(refused(A0ConfirmRefusal.CANCELLED), m.promptError(a, byUser = true))
        val b = inPrompt()
        assertEquals(refused(A0ConfirmRefusal.BIOMETRIC), m.promptError(b, byUser = false))
        // a success outside the PROMPT phase never authorizes
        val c = inDialog()
        assertSame(Step.Ignore, m.promptSucceeded(c))
        assertSame(Step.Ignore, m.promptError(c, byUser = false))
        assertEquals(Phase.DIALOG, m.phase())
    }

    // ---- keysClose / a second keysOpen

    @Test
    fun aSessionChangeFailsAWaitingConfirmationClosed() {
        for (setup in listOf<() -> Long>({ started() }, { inDialog() }, { inPrompt() })) {
            val t = setup()
            assertEquals(t to refused(A0ConfirmRefusal.SESSION), m.sessionChanged())
            assertEquals(Phase.IDLE, m.phase())
            assertSame(Step.Ignore, m.promptSucceeded(t))
        }
        assertSame(Step.Ignore, m.sessionChanged().second) // IDLE: nothing to fail
    }

    @Test
    fun aSessionChangeDuringTheRustCallIsLeftToRust() {
        val t = inPrompt()
        assertSame(Step.Authorize, m.promptSucceeded(t))
        assertSame(Step.Ignore, m.sessionChanged().second)
        assertTrue(m.authorized(t))
    }

    // ---- exactly once

    @Test
    fun aSettledTicketNeverSettlesAgainAndNeverTouchesTheNextRequest() {
        val old = inPrompt()
        assertEquals(refused(A0ConfirmRefusal.CANCELLED), m.cancel(old))
        val next = inDialog()
        for (s in listOf(
            m.shown(old), m.approve(old, 0), m.cancel(old), m.promptError(old, true), m.promptSucceeded(old),
            m.interrupted(old), m.timeout(old), m.fail(old, A0ConfirmRefusal.UI),
        )) {
            assertSame(Step.Ignore, s)
        }
        assertFalse(m.authorized(old))
        assertEquals(next, m.live())
        assertEquals(Phase.DIALOG, m.phase())
    }

    @Test
    fun authorizeIsGrantedOnceAndAuthorizedEndsItOnce() {
        val t = inPrompt()
        assertSame(Step.Authorize, m.promptSucceeded(t))
        assertSame(Step.Ignore, m.promptSucceeded(t)) // a second success callback: no second Rust call
        assertTrue(m.authorized(t))
        assertFalse(m.authorized(t))
        assertEquals(Phase.IDLE, m.phase())
    }

    @Test
    fun aSetupFailureFreesTheSlot() {
        val t = started()
        assertEquals(refused(A0ConfirmRefusal.NO_AUTHENTICATOR), m.fail(t, A0ConfirmRefusal.NO_AUTHENTICATOR))
        assertTrue(m.begin(true) is Begin.Started)
    }

    @Test
    fun everyRefusalHasAStableDistinctCode() {
        val codes = A0ConfirmRefusal.values().map { it.code }
        assertEquals(codes.size, codes.toSet().size)
        for (c in codes) assertTrue(c, c.matches(Regex("E_A0_CONFIRM_[A-Z_]+")))
    }
}
