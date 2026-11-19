package com.nocturawallet.prover

import android.view.MotionEvent
import androidx.biometric.BiometricManager.Authenticators
import java.lang.reflect.Field
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The per-API-level authenticator matrix (spec §4 step 4; controller ruling 8) held against the
 * androidx.biometric 1.1.0 the app compiles with: its OWN `AuthenticatorUtils.isSupportedCombination`
 * is called for every level 24…36 with `Build.VERSION.SDK_INT` set in the unit-test android.jar —
 * so the matrix is measured on the library, not on our reading of it — plus the documented
 * matrix as a table, and the constants equal the library's and the framework's.
 */
class A0AuthenticatorsTest {
    @Test
    fun theConstantsAreTheLibrarysAndTheFrameworks() {
        assertEquals(Authenticators.BIOMETRIC_STRONG, A0Authenticators.BIOMETRIC_STRONG)
        assertEquals(Authenticators.BIOMETRIC_WEAK, A0Authenticators.BIOMETRIC_WEAK)
        assertEquals(Authenticators.DEVICE_CREDENTIAL, A0Authenticators.DEVICE_CREDENTIAL)
        assertEquals(MotionEvent.FLAG_WINDOW_IS_OBSCURED, A0Touch.FLAG_WINDOW_IS_OBSCURED)
        assertEquals(MotionEvent.FLAG_WINDOW_IS_PARTIALLY_OBSCURED, A0Touch.FLAG_WINDOW_IS_PARTIALLY_OBSCURED)
        assertEquals(MotionEvent.ACTION_DOWN, A0Touch.ACTION_DOWN)
    }

    @Test
    fun theMatrixIsTheStatedOne() {
        val strong = A0Authenticators.BIOMETRIC_STRONG
        val strongOrCredential = A0Authenticators.BIOMETRIC_STRONG or A0Authenticators.DEVICE_CREDENTIAL
        for (sdk in 0..23) assertNull("API $sdk", A0Authenticators.forApi(sdk))
        for (sdk in 24..29) assertEquals("API $sdk", strong, A0Authenticators.forApi(sdk))
        for (sdk in 30..40) assertEquals("API $sdk", strongOrCredential, A0Authenticators.forApi(sdk))
        assertFalse(A0Authenticators.allowsCredential(strong))
        assertTrue(A0Authenticators.allowsCredential(strongOrCredential))
    }

    @Test
    fun noLevelAllowsAWeakBiometric() {
        for (sdk in 0..40) {
            val a = A0Authenticators.forApi(sdk) ?: continue
            // BIOMETRIC_WEAK (0xFF) contains BIOMETRIC_STRONG's bits; the biometric part must be exactly STRONG
            assertEquals("API $sdk", A0Authenticators.BIOMETRIC_STRONG, a and A0Authenticators.BIOMETRIC_WEAK)
        }
    }

    // ---- measured on the library

    private val sdkField: Field = Class.forName("android.os.Build\$VERSION").getDeclaredField("SDK_INT")

    // sun.misc.Unsafe by reflection (the unit-test compile classpath is android.jar, which has no sun.*):
    // SDK_INT is a static final in the android.jar stub, so it is written through Unsafe, not Field.set.
    private val unsafeClass: Class<*> = Class.forName("sun.misc.Unsafe")
    private val unsafe: Any = unsafeClass.getDeclaredField("theUnsafe").apply { isAccessible = true }.get(null)!!

    private fun setSdk(v: Int) {
        val base = unsafeClass.getMethod("staticFieldBase", Field::class.java).invoke(unsafe, sdkField)
        val offset = unsafeClass.getMethod("staticFieldOffset", Field::class.java).invoke(unsafe, sdkField) as Long
        unsafeClass.getMethod("putInt", Any::class.java, Long::class.javaPrimitiveType, Int::class.javaPrimitiveType)
            .invoke(unsafe, base, offset, v)
        check(sdkField.getInt(null) == v) { "SDK_INT could not be set to $v" }
    }

    private fun supported(sdk: Int, authenticators: Int): Boolean {
        setSdk(sdk)
        val m = Class.forName("androidx.biometric.AuthenticatorUtils")
            .getDeclaredMethod("isSupportedCombination", Int::class.javaPrimitiveType)
        m.isAccessible = true
        return m.invoke(null, authenticators) as Boolean
    }

    @Test
    fun androidxAcceptsEveryCombinationWeAskFor() {
        val saved = sdkField.getInt(null)
        try {
            for (sdk in 24..36) {
                val a = A0Authenticators.forApi(sdk)!!
                assertTrue("androidx refuses $a at API $sdk", supported(sdk, a))
            }
        } finally {
            setSdk(saved)
        }
    }

    @Test
    fun theMeasuredLibraryRefusesStrongOrCredentialOn28And29NegativeControl() {
        // the reading can fail: the combination the matrix avoids on 28–29 is refused by the library
        val saved = sdkField.getInt(null)
        val strongOrCredential = A0Authenticators.BIOMETRIC_STRONG or A0Authenticators.DEVICE_CREDENTIAL
        try {
            assertFalse(supported(28, strongOrCredential))
            assertFalse(supported(29, strongOrCredential))
            assertTrue(supported(27, strongOrCredential)) // accepted below 28 — but via a separate activity (A0Confirm.kt)
            assertTrue(supported(30, strongOrCredential))
            assertFalse(supported(29, A0Authenticators.DEVICE_CREDENTIAL)) // credential alone: 30+ only
            assertTrue(supported(30, A0Authenticators.DEVICE_CREDENTIAL))
        } finally {
            setSdk(saved)
        }
    }
}
