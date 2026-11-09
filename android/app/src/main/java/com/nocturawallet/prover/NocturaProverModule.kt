package com.nocturawallet.prover

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
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
 *
 * The React methods are exactly (ReactSurfaceTest): `isSupported`; the A0 surface (spec
 * 2026-11-08 shielded A0 M1 §3) — `keysOpen`, `keysClose`, `depositRho`, `matchSpent`,
 * `commitment`, `prove`; and the v1 `proveV1` (the NPkc pool; removed with the v1 path in M1b).
 * `parseUnshield` / `authorizeUnshield` are Kotlin-only (`internal`, no @ReactMethod): JS can
 * never reach them; the native confirmation dialog (M1c) calls them.
 *
 * Every A0 method resolves Rust's `ok` value or rejects with its stable code (`E_A0_…`); the
 * message never carries a witness value or a secret. `prove` runs on [A0Prover]'s own thread;
 * the others run on React Native's native-modules thread (neither the JS nor the UI thread).
 */
@ReactModule(name = NocturaProverModule.NAME)
class NocturaProverModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "NocturaProver"
    }

    override fun getName() = NAME

    // Synchronous to match `nativeProverBridge.ts`'s `isSupported(): boolean`.
    // Triggers the lazy .so load; returns false (not a crash) if it can't load.
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isSupported(): Boolean {
        return try {
            NocturaNativeLib.ensureLoaded()
            nativeIsSupported()
        } catch (e: Throwable) {
            false
        }
    }

    // ------------------------------------------------------------------ the A0 surface

    /**
     * `keysOpen(seed: number[64]) -> handle`. The seed is a ByteArray only for the call and is
     * zero-filled when it returns ([A0Seed]); a second keysOpen replaces the first session.
     */
    @ReactMethod
    fun keysOpen(seed: ReadableArray, promise: Promise) =
        A0Promise.settle(promise) { A0Seed.use(seed) { NocturaA0Native.keysOpen(it) } }

    @ReactMethod
    fun keysClose(handle: String, promise: Promise) =
        A0Promise.settle(promise) { NocturaA0Native.keysClose(handle) }

    @ReactMethod
    fun depositRho(handle: String, depositIndex: String, promise: Promise) =
        A0Promise.settle(promise) { NocturaA0Native.depositRho(handle, depositIndex) }

    @ReactMethod
    fun matchSpent(handle: String, chainNullifiers: ReadableArray, ownRhos: ReadableArray, promise: Promise) =
        A0Promise.settle(promise) {
            NocturaA0Native.matchSpent(
                handle,
                A0Args.strings(chainNullifiers, "chainNullifiers"),
                A0Args.strings(ownRhos, "ownRhos"),
            )
        }

    @ReactMethod
    fun commitment(handle: String, amount: String, rho: String, promise: Promise) =
        A0Promise.settle(promise) { NocturaA0Native.commitment(handle, amount, rho) }

    /** `prove(...) -> {proofBytes, publicInputs}`, on the proving thread. `authId` null = none. */
    @ReactMethod
    fun prove(
        handle: String,
        circuit: String,
        witnessJson: String,
        authId: String?,
        zkeyPath: String,
        wasmPath: String,
        promise: Promise,
    ) {
        A0Prover.submit {
            A0Promise.settle(promise) {
                NocturaA0Native.prove(handle, circuit, witnessJson, authId, zkeyPath, wasmPath)
            }
        }
    }

    /** Kotlin only — the native dialog's values (M1c). Never a React method. */
    internal fun parseUnshield(owner: String, amount: String, fee: String): A0Result =
        call { NocturaA0Native.parseUnshield(owner, amount, fee) }

    /** Kotlin only — called on the biometric approval (M1c). Never a React method. */
    internal fun authorizeUnshield(handle: String, owner: String, amount: String, fee: String): A0Result =
        call { NocturaA0Native.authorizeUnshield(handle, owner, amount, fee) }

    private fun call(native: () -> String?): A0Result =
        try {
            NocturaNativeLib.ensureLoaded()
            A0Result.parse(native())
        } catch (e: UnsatisfiedLinkError) {
            A0Result.Err(A0Result.UNAVAILABLE, "the native library is unavailable")
        }

    // --------------------------------------------------------------- v1 (removed in M1b)

    /** v1 prove off the JS thread (proving takes seconds). Resolves { proofBytes, publicInputs }. */
    @ReactMethod
    fun proveV1(
        circuitId: String,
        witnessJson: String,
        zkeyPath: String,
        wasmPath: String,
        promise: Promise,
    ) {
        Thread {
            try {
                NocturaNativeLib.ensureLoaded()
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
