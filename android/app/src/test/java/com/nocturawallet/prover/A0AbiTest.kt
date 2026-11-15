package com.nocturawallet.prover

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test
import java.io.File

/**
 * arm64-v8a only (spec §12, m14): on any other ABI, emulators included, the prover is never
 * loaded and `isSupported()` is false. The device half — `isSupported()` true on the phone, false
 * on an x86_64 emulator — is the M1a checkpoint's (Task 6).
 */
class A0AbiTest {
    @Test
    fun onAndroidOnlyAnArm64ProcessMayLoadTheProver() {
        assertTrue(A0Abi.allows("Dalvik", "aarch64"))
        for (arch in listOf("x86_64", "i686", "x86", "armv7l", "armv8l", "arm", "riscv64", "AARCH64", "aarch64 ", "", null)) {
            assertFalse("Dalvik / $arch", A0Abi.allows("Dalvik", arch))
        }
    }

    @Test
    fun aHostJvmIsNotAndroidAndIsNotGated() {
        // The JVM unit tests load the jni-host build of the library on x86_64 (A0JniTest).
        assertTrue(A0Abi.allows("OpenJDK 64-Bit Server VM", "amd64"))
        assertTrue(A0Abi.allows(System.getProperty("java.vm.name"), System.getProperty("os.arch")))
        assertTrue(A0Abi.current())
    }

    @Test
    fun aRefusedAbiThrowsBeforeAndAfterALoad() {
        // With the host library present (NOCTURA_A0_HOST_LIB_DIR, as in A0JniTest) a real load
        // happens first, so the gate is shown to run even once `loaded` is true.
        if (System.getenv("NOCTURA_A0_HOST_LIB_DIR") != null) NocturaNativeLib.ensureLoaded(abiAllowed = true)
        repeat(2) {
            try {
                NocturaNativeLib.ensureLoaded(abiAllowed = false)
                fail("ensureLoaded on a refused ABI returned")
            } catch (e: UnsatisfiedLinkError) {
                assertEquals("libnoctura_prover is built for arm64-v8a only", e.message)
            }
        }
    }

    @Test
    fun isSupportedIsFalseUnlessTheLibraryLoadsAndSaysSo() {
        var nativeCalled = false
        val refused = A0Support.check({ NocturaNativeLib.ensureLoaded(abiAllowed = false) }) {
            nativeCalled = true
            true
        }
        assertFalse(refused)
        assertFalse("the native call ran after a refused load", nativeCalled)
        assertFalse(A0Support.check({ throw UnsatisfiedLinkError("dlopen failed") }) { true })
        assertFalse(A0Support.check({}) { false })
        assertFalse(A0Support.check({}) { throw IllegalStateException("boom") })
        assertTrue(A0Support.check({}) { true })
    }

    @Test
    fun theOnlyLibraryLoadInTheAppIsTheGatedOne() {
        // A System.loadLibrary anywhere else (isSupported loading the prover directly, a new
        // module) would bypass A0Abi; the reading is of the compiled-from sources, all of them.
        val sources = File("src/main/java").walkTopDown().filter { it.isFile && it.extension in setOf("kt", "java") }.toList()
        assertTrue("read ${sources.size} source files", sources.size >= 5)
        val loads = sources.flatMap { f ->
            f.readLines().mapIndexedNotNull { i, line -> if ("System.loadLibrary(" in line) "${f.name}:${i + 1}" else null }
        }
        assertEquals(1, loads.size)
        val bridge = File("src/main/java/com/nocturawallet/prover/A0Bridge.kt").readText()
        val lib = bridge.substringAfter("internal object NocturaNativeLib {").substringBefore("\n}\n")
        assertTrue("the one load is NocturaNativeLib's, after the gate", lib.indexOf("if (!abiAllowed) throw") in 0 until lib.indexOf("System.loadLibrary(\"noctura_prover\")"))
        assertTrue(loads.single().startsWith("A0Bridge.kt:"))
    }
}
