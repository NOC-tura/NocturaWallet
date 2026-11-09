package com.nocturawallet.prover

import com.facebook.react.bridge.ReactMethod
import java.io.File
import java.lang.reflect.Modifier
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The boundary between JS and native, read off the compiled classes (spec §3 "JNI surface",
 * §14 "the React Native module exposes all of them except parseUnshield and authorizeUnshield"):
 * React Native reaches a legacy module only through its @ReactMethod methods, so that set IS
 * what JS can call. The natives must be exactly native/noctura-prover/jni-exports.txt, which
 * check-jni-exports.sh holds to the built library's symbols.
 */
class ReactSurfaceTest {
    private fun reactMethods(c: Class<*>): Set<String> =
        c.declaredMethods.filter { it.isAnnotationPresent(ReactMethod::class.java) }.map { it.name }.toSet()

    private val expected = setOf(
        "isSupported",
        "proveV1", // v1 (the NPkc pool) — removed with the v1 path in M1b
        "keysOpen",
        "keysClose",
        "depositRho",
        "matchSpent",
        "commitment",
        "prove",
    )

    @Test
    fun theReactModuleExposesExactlyTheBoundSurface() {
        assertEquals(expected, reactMethods(NocturaProverModule::class.java))
    }

    @Test
    fun parseUnshieldAndAuthorizeUnshieldAreBoundInKotlinButNotReactMethods() {
        for (name in listOf("parseUnshield", "authorizeUnshield")) {
            // `internal` members compile to `name$<module>`.
            val ms = NocturaProverModule::class.java.declaredMethods
                .filter { it.name == name || it.name.startsWith("$name$") }
            assertTrue("$name is not bound in Kotlin", ms.isNotEmpty())
            for (m in ms) assertFalse("$name is a React method", m.isAnnotationPresent(ReactMethod::class.java))
        }
    }

    /** A class that annotated parseUnshield: the same reading sees it (the check can fail). */
    @Suppress("unused")
    private class Leaky {
        @ReactMethod fun parseUnshield() {}
        fun helper() {}
    }

    @Test
    fun theReadingSeesAnAnnotatedMethodNegativeControl() {
        assertEquals(setOf("parseUnshield"), reactMethods(Leaky::class.java))
        assertNotEquals(expected, reactMethods(Leaky::class.java) + expected - "prove")
    }

    @Test
    fun theKotlinNativesAreExactlyTheJniExportList() {
        val natives = listOf(NocturaA0Native::class.java, NocturaProverModule::class.java)
            .flatMap { c -> c.declaredMethods.filter { Modifier.isNative(it.modifiers) } }
            .map { "Java_" + it.declaringClass.name.replace('.', '_') + "_" + it.name }
            .toSet()
        val list = File("../../native/noctura-prover/jni-exports.txt").readLines()
            .map { it.trim() }
            .filter { it.isNotEmpty() && !it.startsWith("#") }
            .toSet()
        assertEquals(10, list.size)
        assertEquals(list, natives)
        // every A0 native is static (an `object` with @JvmStatic): the symbol takes a jclass
        for (m in NocturaA0Native::class.java.declaredMethods.filter { Modifier.isNative(it.modifiers) }) {
            assertTrue(m.name, Modifier.isStatic(m.modifiers))
        }
    }
}
