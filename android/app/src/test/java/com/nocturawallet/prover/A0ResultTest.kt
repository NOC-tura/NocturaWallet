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

    // ---- M1c Task 6, ruling m-7: sessionChanged(): keysOpen fires whenever Rust was reached, keysClose only on ok

    private fun fakePromise(log: MutableList<String>): com.facebook.react.bridge.Promise =
        java.lang.reflect.Proxy.newProxyInstance(
            com.facebook.react.bridge.Promise::class.java.classLoader,
            arrayOf(com.facebook.react.bridge.Promise::class.java),
        ) { _, method, args ->
            log += if (method.name == "reject") "reject:${args?.get(0)}" else method.name
            null
        } as com.facebook.react.bridge.Promise

    @Test
    fun onOkRunsAfterAnOkAnswerAndBeforeTheResolve() {
        val log = mutableListOf<String>()
        A0Promise.settle(fakePromise(log), onOk = { log += "onOk" }, ensureLoaded = {}) { """{"ok":"h1"}""" }
        assertEquals(listOf("onOk", "resolve"), log)
    }

    @Test
    fun onOkNeverRunsWhenRustRefusedOrTheCallFailed() {
        val answers = listOf<() -> String?>(
            { """{"error":"E_A0_ARG","message":"seed"}""" },
            { null },
            { "not json" },
            { throw A0ArgException("seed") },
            { throw IllegalStateException("boom") },
        )
        for (answer in answers) {
            val log = mutableListOf<String>()
            A0Promise.settle(fakePromise(log), onOk = { log += "onOk" }, ensureLoaded = {}) { answer() }
            assertEquals(1, log.size)
            assertTrue(log.toString(), log[0].startsWith("reject:"))
        }
        // the library failing to load is a refusal too
        val log = mutableListOf<String>()
        A0Promise.settle(fakePromise(log), onOk = { log += "onOk" }, ensureLoaded = { throw UnsatisfiedLinkError() }) { """{"ok":"x"}""" }
        assertEquals(listOf("reject:${A0Result.UNAVAILABLE}"), log)
    }

    @Test
    fun keysOpenFiresWheneverRustWasReachedOkOrRefusedAndBeforeTheSettle() {
        val answers = listOf<() -> String?>(
            { """{"ok":"h1"}""" },
            { """{"error":"E_A0_SEED","message":"seed"}""" }, // refused AFTER end_session() in Rust
            { null },
            { "not json" },
            { throw IllegalStateException("boom") },
        )
        for (answer in answers) {
            val log = mutableListOf<String>()
            A0Promise.settle(fakePromise(log), onReached = { log += "reached" }, ensureLoaded = {}) { answer() }
            assertEquals(log.toString(), 2, log.size)
            assertEquals("reached", log[0])
        }
    }

    @Test
    fun keysOpenDoesNotFireWhenRustWasNotReached() {
        val log = mutableListOf<String>()
        A0Promise.settle(fakePromise(log), onReached = { log += "reached" }, ensureLoaded = {}) { throw A0ArgException("seed") }
        assertEquals(listOf("reject:${A0Result.ARG}"), log)
        val log2 = mutableListOf<String>()
        A0Promise.settle(fakePromise(log2), onReached = { log2 += "reached" }, ensureLoaded = { throw UnsatisfiedLinkError() }) { """{"ok":"x"}""" }
        assertEquals(listOf("reject:${A0Result.UNAVAILABLE}"), log2)
    }

    @Test
    fun keysCloseFiresOnlyOnOkAndBeforeTheResolve() {
        val log = mutableListOf<String>()
        A0Promise.settle(fakePromise(log), onOk = { log += "onOk" }, ensureLoaded = {}) { """{"ok":null}""" }
        assertEquals(listOf("onOk", "resolve"), log)
        val log2 = mutableListOf<String>()
        A0Promise.settle(fakePromise(log2), onOk = { log2 += "onOk" }, ensureLoaded = {}) { """{"error":"E_A0_UNKNOWN_HANDLE","message":"x"}""" }
        assertEquals(listOf("reject:E_A0_UNKNOWN_HANDLE"), log2)
    }

    @Test
    fun aCallbackThatThrowsNeverStopsThePromiseSettling() {
        val log = mutableListOf<String>()
        A0Promise.settle(fakePromise(log), onReached = { throw IllegalStateException("x") }, onOk = { throw IllegalStateException("y") }, ensureLoaded = {}) { """{"ok":"h"}""" }
        assertEquals(listOf("resolve"), log)
        val log2 = mutableListOf<String>()
        A0Promise.settle(fakePromise(log2), onReached = { throw IllegalStateException("x") }, ensureLoaded = {}) { """{"error":"E_A0_SEED","message":"m"}""" }
        assertEquals(listOf("reject:E_A0_SEED"), log2)
    }

    @Test
    fun theModuleWiresKeysOpenToOnReachedAndKeysCloseToOnOk() {
        val src = java.io.File("src/main/java/com/nocturawallet/prover/NocturaProverModule.kt").readText()
        val calls = Regex("""(onReached|onOk) = \{ A0Confirmations\.controller\.sessionChanged\(\) \}""").findAll(src).map { it.groupValues[1] }.toList()
        assertEquals(listOf("onReached", "onOk"), calls) // keysOpen first, keysClose second
        assertEquals(2, Regex("""A0Confirmations\.controller\.sessionChanged\(\)""").findAll(src).count()) // never a pre-call
        val open = src.indexOf("fun keysOpen"); val close = src.indexOf("fun keysClose")
        assertTrue(src.indexOf("onReached =") in open until close)
        assertTrue(src.indexOf("onOk =") > close)
    }
}
