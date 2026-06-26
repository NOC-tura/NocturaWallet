package com.nocturawallet.shieldedkey

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule

/**
 * Native BLS12-381 (blst) bridge for the shielded SPEND key.
 *
 * `sk_spend` (EIP-2333 path m/12381/371/1/0) is derived and used ONLY in the
 * native layer (`noctura_key_jni.cpp` → blst), zeroized after each op, and
 * NEVER returned to JS. JS receives only:
 *   - getShieldedPublicKey → the 48-byte G1 compressed public key (pk_recipient)
 *   - signShieldedOp        → a 96-byte G2 compressed BLS signature
 *
 * Mounted from JS as `NativeModules.NocturaKeyModule`
 * (`src/modules/keychain/nativeBridge.ts`).
 *
 * C1 scope: getShieldedPublicKey (+ a foundational signShieldedOp). The seed is
 * passed in (it already lives in the wallet's secure storage); seed-in-native
 * hardening + the circuit-specific spend-auth payload are later (C2).
 */
@ReactModule(name = NocturaKeyModule.NAME)
class NocturaKeyModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "NocturaKeyModule"

        init {
            System.loadLibrary("noctura_key")
        }
    }

    override fun getName() = NAME

    /** Derive sk_spend from the seed and return the 48-byte G1 compressed pk (hex). */
    @ReactMethod
    fun getShieldedPublicKey(seedHex: String, promise: Promise) {
        try {
            val pk = nativeGetShieldedPublicKey(seedHex)
            if (pk.isEmpty()) {
                promise.reject("E_BLST", "Invalid seed or key derivation failed")
            } else {
                promise.resolve(pk)
            }
        } catch (e: Throwable) {
            promise.reject("E_BLST", e)
        }
    }

    /** Sign a payload with sk_spend; returns a 96-byte G2 compressed signature (hex). */
    @ReactMethod
    fun signShieldedOp(seedHex: String, payloadHex: String, promise: Promise) {
        try {
            val sig = nativeSignShieldedOp(seedHex, payloadHex)
            if (sig.isEmpty()) {
                promise.reject("E_BLST", "Invalid input or signing failed")
            } else {
                promise.resolve(sig)
            }
        } catch (e: Throwable) {
            promise.reject("E_BLST", e)
        }
    }

    private external fun nativeGetShieldedPublicKey(seedHex: String): String

    private external fun nativeSignShieldedOp(seedHex: String, payloadHex: String): String
}
