package com.nocturawallet.prover

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** The envelope Rust returns (a0::bridge) and the proving thread. */
class A0ResultTest {
    @Test
    fun okValuesComeThrough() {
        assertEquals(A0Result.Ok("12"), A0Result.parse("""{"ok":"12"}"""))
        val nul = A0Result.parse("""{"ok":null}""") as A0Result.Ok
        assertEquals(JSONObject.NULL, nul.value)
        val arr = (A0Result.parse("""{"ok":[0,2]}""") as A0Result.Ok).value as JSONArray
        assertEquals(listOf(0, 2), (0 until arr.length()).map { arr.getInt(it) })
        val obj = (A0Result.parse("""{"ok":{"proofBytes":"ab","publicInputs":["01"]}}""") as A0Result.Ok).value
        assertTrue(obj is JSONObject)
    }

    @Test
    fun errorsKeepTheirCodeAndMessage() {
        assertEquals(
            A0Result.Err("E_A0_AUTH_ABSENT", "no live unshield authorization"),
            A0Result.parse("""{"error":"E_A0_AUTH_ABSENT","message":"no live unshield authorization"}"""),
        )
    }

    @Test
    fun aMissingOrUnreadableResultIsInternal() {
        for (bad in listOf(null, "", "nope", "{}", """{"error":7}""", "[]")) {
            val r = A0Result.parse(bad)
            assertTrue("$bad → $r", r is A0Result.Err && r.code == A0Result.INTERNAL)
        }
        assertEquals("E_A0_INTERNAL", A0Result.INTERNAL)
    }

    @Test
    fun proveRunsOnItsOwnThreadNotTheCallers() {
        val latch = CountDownLatch(1)
        var name: String? = null
        A0Prover.submit {
            name = Thread.currentThread().name
            latch.countDown()
        }
        assertTrue(latch.await(10, TimeUnit.SECONDS))
        assertEquals(A0Prover.THREAD_NAME, name)
        assertTrue(name != Thread.currentThread().name)
    }

    /** How deep a plain recursion gets on the current thread before its stack overflows. */
    private fun depth(n: Int = 0): Int =
        try {
            depth(n + 1)
        } catch (e: StackOverflowError) {
            n
        }

    private fun depthOn(start: (Runnable) -> Unit): Int {
        val latch = CountDownLatch(1)
        var d = 0
        start(Runnable {
            d = depth()
            latch.countDown()
        })
        assertTrue(latch.await(60, TimeUnit.SECONDS))
        return d
    }

    private fun depthOnStack(bytes: Long): Int = depthOn { r -> Thread(null, r, "a0-stack-probe", bytes).start() }

    /**
     * The proving thread's stack is an explicit 8 MiB (Fable review 1, minor): read off the
     * running thread, not off the constant — the recursion depth it reaches is compared with
     * two probe threads given 1 MiB (the JVM's and roughly ART's default) and 8 MiB.
     */
    @Test
    fun theProvingThreadHasAnExplicit8MiBStack() {
        assertEquals(8L * 1024 * 1024, A0Prover.STACK_SIZE_BYTES)
        // warm the JIT first, so every reading below compares compiled frames with compiled frames
        repeat(3) { depthOnStack(1L shl 20) }
        val one = depthOnStack(1L shl 20)
        val eight = depthOnStack(8L shl 20)
        // negative control: the reading tells a 1 MiB stack from an 8 MiB one
        assertTrue("1 MiB reached $one, 8 MiB reached $eight", eight > 4L * one)
        val prover = depthOn { r -> A0Prover.submit { r.run() } }
        // nearer 8 MiB than 1 MiB: above the two probes' geometric midpoint
        assertTrue(
            "the proving thread reached $prover (1 MiB: $one, 8 MiB: $eight)",
            prover.toDouble() * prover > one.toDouble() * eight,
        )
    }
}
