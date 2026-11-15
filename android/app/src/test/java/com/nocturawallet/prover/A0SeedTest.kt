package com.nocturawallet.prover

import com.facebook.react.bridge.JavaOnlyArray
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/** The seed crosses as bytes (spec §3, C3): Kotlin's ByteArray is zero-filled when the call returns. */
class A0SeedTest {
    private val values = (0 until 64).map { (it * 37 + 11) % 256 }

    @Test
    fun theByteArrayHoldsTheSeedDuringTheCallAndZerosAfterIt() {
        var seen: ByteArray? = null
        var atCall: ByteArray? = null
        val r = A0Seed.use(JavaOnlyArray.from(values)) { b ->
            seen = b
            atCall = b.copyOf()
            "done"
        }
        assertEquals("done", r)
        assertArrayEquals(values.map { it.toByte() }.toByteArray(), atCall)
        assertTrue("not zero-filled", seen!!.all { it == 0.toByte() })
    }

    @Test
    fun andAfterACallThatThrows() {
        var seen: ByteArray? = null
        assertThrows(IllegalStateException::class.java) {
            A0Seed.use(JavaOnlyArray.from(values)) { b ->
                seen = b
                throw IllegalStateException("native failed")
            }
        }
        assertEquals(64, seen!!.size)
        assertTrue("not zero-filled", seen!!.all { it == 0.toByte() })
    }

    @Test
    fun anythingButAByteValueIsRefusedBeforeTheCall() {
        val bad = listOf(
            JavaOnlyArray.of(1.5),
            JavaOnlyArray.of(-1),
            JavaOnlyArray.of(256),
            JavaOnlyArray.of("1"),
            JavaOnlyArray.of(null),
            JavaOnlyArray.of(true),
            JavaOnlyArray.of(Double.NaN),
        )
        for (arr in bad) {
            var called = false
            val e = assertThrows(A0ArgException::class.java) { A0Seed.use(arr) { called = true } }
            assertEquals("argument seed is malformed", e.message)
            assertTrue(!called)
        }
        // positive control: the edges 0 and 255 pass
        A0Seed.use(JavaOnlyArray.of(0, 255)) { b -> assertArrayEquals(byteArrayOf(0, -1), b) }
    }

    @Test
    fun stringArraysTakeStringsOnly() {
        assertArrayEquals(arrayOf("a", "b"), A0Args.strings(JavaOnlyArray.of("a", "b"), "ownRhos"))
        val e = assertThrows(A0ArgException::class.java) { A0Args.strings(JavaOnlyArray.of("a", 1), "ownRhos") }
        assertEquals("argument ownRhos[1] is malformed", e.message)
    }
}
