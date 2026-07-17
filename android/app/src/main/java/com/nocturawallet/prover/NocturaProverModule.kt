package com.nocturawallet.prover

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import com.facebook.react.module.annotations.ReactModule
import org.json.JSONObject

/**
 * On-device ZK prover bridge. Backed by the pure-Rust `libnoctura_prover.so`
 * (arkworks Groth16 + wasmi witness) via a Rust JNI layer — NO C++ / NO
 * libc++_shared, so the blst-style startup conflict does not apply.
 *
 * Mounted from JS as `NativeModules.NocturaProver` (`src/modules/zkProver/nativeProverBridge.ts`).
 * `prove(circuitId, witnessJson, zkeyPath, wasmPath)` → `{ proofBytes, publicInputs }`.
 */
@ReactModule(name = NocturaProverModule.NAME)
class NocturaProverModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "NocturaProver"

        // Loaded LAZILY on first prove — never in a companion `init{}` (the blst
        // lesson: eager dlopen at startup risks a launch crash). This .so is pure
        // Rust (libc/libm/libdl only), so no libc++_shared conflict is expected.
        @Volatile
        private var libLoaded = false

        @Synchronized
        private fun ensureLibLoaded() {
            if (!libLoaded) {
                System.loadLibrary("noctura_prover")
                libLoaded = true
            }
        }
    }

    override fun getName() = NAME

    // Synchronous to match `nativeProverBridge.ts`'s `isSupported(): boolean`.
    // Triggers the lazy .so load; returns false (not a crash) if it can't load.
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isSupported(): Boolean {
        return try {
            ensureLibLoaded()
            nativeIsSupported()
        } catch (e: Throwable) {
            false
        }
    }

    /** Prove off the JS thread (proving takes seconds). Resolves { proofBytes, publicInputs }. */
    @ReactMethod
    fun prove(
        circuitId: String,
        witnessJson: String,
        zkeyPath: String,
        wasmPath: String,
        promise: Promise,
    ) {
        Thread {
            try {
                ensureLibLoaded()
                val json = nativeProve(circuitId, witnessJson, zkeyPath, wasmPath)
                val obj = JSONObject(json)
                if (obj.has("error")) {
                    promise.reject("E_PROVE", obj.getString("error"))
                    return@Thread
                }
                val map = WritableNativeMap()
                map.putString("proofBytes", obj.getString("proofBytes"))
                val arr = WritableNativeArray()
                val pubs = obj.getJSONArray("publicInputs")
                for (i in 0 until pubs.length()) arr.pushString(pubs.getString(i))
                map.putArray("publicInputs", arr)
                promise.resolve(map)
            } catch (e: Throwable) {
                promise.reject("E_PROVE", e)
            }
        }.start()
    }

    private external fun nativeIsSupported(): Boolean

    private external fun nativeProve(
        circuitId: String,
        witnessJson: String,
        zkeyPath: String,
        wasmPath: String,
    ): String
}
