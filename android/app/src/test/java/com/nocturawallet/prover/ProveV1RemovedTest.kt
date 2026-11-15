package com.nocturawallet.prover

import com.facebook.react.bridge.Promise
import java.io.File
import java.lang.reflect.Proxy
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The v1 prover is unreachable from JS (Fable review 1, R1-I3): the React method `proveV1`
 * rejects with `E_V1_REMOVED` before any native call — synchronously, so no load, no thread and
 * no `nativeProve` can have run — and no Kotlin code calls the v1 binding at all. The v1 prover
 * (unpinned keys, no input allow-list, `seed_from_u64(0)`) is deleted with the v1 flows in M1b.
 */
class ProveV1RemovedTest {
    /** A Promise that records every call made on it (whatever overload React Native has). */
    private class Recorder {
        val calls = mutableListOf<Pair<String, List<Any?>>>()
        val promise = Proxy.newProxyInstance(Promise::class.java.classLoader, arrayOf(Promise::class.java)) { _, m, args ->
            calls.add(m.name to (args?.toList() ?: emptyList()))
            null
        } as Promise
    }

    /** The module without a ReactApplicationContext: proveV1 touches no field of it. */
    private fun module(): NocturaProverModule {
        val f = Class.forName("sun.misc.Unsafe").getDeclaredField("theUnsafe")
        f.isAccessible = true
        val unsafe = f.get(null)
        val alloc = unsafe.javaClass.getMethod("allocateInstance", Class::class.java)
        return alloc.invoke(unsafe, NocturaProverModule::class.java) as NocturaProverModule
    }

    @Test
    fun proveV1RejectsWithETheV1RemovedCodeBeforeAnyNativeCall() {
        val r = Recorder()
        module().proveV1("deposit", "{}", "/z", "/w", r.promise)
        // Settled before proveV1 returned: nothing ran on another thread or after a load.
        assertEquals(1, r.calls.size)
        val (name, args) = r.calls.single()
        assertEquals("reject", name)
        assertEquals("E_V1_REMOVED", args[0])
        assertEquals(NocturaProverModule.V1_REMOVED, args[0])
        assertTrue(args[1].toString(), args[1].toString().startsWith("E_V1_REMOVED: the v1 prover is removed"))
    }

    private fun callSites(text: String): Int =
        text.lines().count { "nativeProve(" in it && "external fun nativeProve(" !in it }

    @Test
    fun noKotlinCodeCallsTheV1Binding() {
        val sources = File("src/main/java").walkTopDown().filter { it.isFile && it.extension in setOf("kt", "java") }.toList()
        assertTrue("read ${sources.size} source files", sources.size >= 5)
        val module = File("src/main/java/com/nocturawallet/prover/NocturaProverModule.kt").readText()
        assertTrue("the v1 binding is still declared (jni-exports.txt)", "private external fun nativeProve(" in module)
        assertEquals(0, sources.sumOf { callSites(it.readText()) })
    }

    @Test
    fun theReadingSeesACallNegativeControl() {
        assertEquals(1, callSites("    private external fun nativeProve(\n                val json = nativeProve(circuitId, witnessJson, zkeyPath, wasmPath)"))
    }
}
