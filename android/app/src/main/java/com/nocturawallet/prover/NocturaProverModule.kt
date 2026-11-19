package com.nocturawallet.prover

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.module.annotations.ReactModule

/**
 * On-device ZK prover bridge. Backed by the pure-Rust `libnoctura_prover.so`
 * (arkworks Groth16 + wasmi witness) via a Rust JNI layer — no C++ runtime NEEDED
 * (native/noctura-prover/check-needed.sh, in CI), so it cannot bring a second libc++_shared.
 *
 * Mounted from JS as `NativeModules.NocturaProver` (`src/modules/zkProver/nativeProverBridge.ts`).
 *
 * The React methods are exactly (ReactSurfaceTest): `isSupported`; the A0 surface (spec
 * 2026-11-08 shielded A0 M1 §3) — `keysOpen`, `keysClose`, `depositRho`, `matchSpent`,
 * `commitment`, `prove`; and the native confirmation (§4, M1c) — `confirmUnshield`. (The v1
 * prove method and its JNI binding are gone since M1b.) `parseUnshield` / `authorizeUnshield`
 * are Kotlin-only (`internal`, no @ReactMethod): JS can never reach them; the confirmation's
 * controller ([A0ConfirmController]) calls them, the second only on a biometric approval.
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
    // Triggers the lazy .so load; false (not a crash) on any ABI but arm64-v8a ([A0Abi]) or if
    // the library cannot load ([A0Support]).
    @ReactMethod(isBlockingSynchronousMethod = true)
    fun isSupported(): Boolean = A0Support.check({ NocturaNativeLib.ensureLoaded() }) { nativeIsSupported() }

    // ------------------------------------------------------------------ the A0 surface

    /**
     * `keysOpen(seed: number[64]) -> handle`. The seed is a ByteArray only for the call and is
     * zero-filled when it returns ([A0Seed]); a second keysOpen replaces the first session.
     */
    @ReactMethod
    fun keysOpen(seed: ReadableArray, promise: Promise) {
        // §4: a second keysOpen invalidates a live authId — and fails a confirmation still in flight,
        // but only once Rust answered ok (m-7): a refused keysOpen replaced nothing.
        A0Promise.settle(promise, onOk = { A0Confirmations.controller.sessionChanged() }) {
            A0Seed.use(seed) { NocturaA0Native.keysOpen(it) }
        }
    }

    @ReactMethod
    fun keysClose(handle: String, promise: Promise) {
        A0Promise.settle(promise, onOk = { A0Confirmations.controller.sessionChanged() }) {
            NocturaA0Native.keysClose(handle)
        }
    }

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

    /**
     * `confirmUnshield(handle, owner, amount, fee) -> {authId, owner, ata}` (§4): Rust parses the
     * three strings, Kotlin shows ITS OWN dialog with Rust's values, then BiometricPrompt, and only
     * on that approval Rust records the authorization. `owner` / `ata` are Rust's; JS compares `ata`
     * with its own derivation and aborts on a mismatch. Rejects with Rust's code (a malformed
     * owner, amount or fee) or an `E_A0_CONFIRM_…` code ([A0ConfirmRefusal]).
     */
    @ReactMethod
    fun confirmUnshield(handle: String, owner: String, amount: String, fee: String, promise: Promise) {
        A0Confirmations.controller.start(reactApplicationContext.currentActivity, handle, owner, amount, fee) { o ->
            when (o) {
                is A0ConfirmOutcome.Approved -> promise.resolve(
                    Arguments.createMap().apply {
                        putString("authId", o.authId)
                        putString("owner", o.owner)
                        putString("ata", o.ata)
                    },
                )
                is A0ConfirmOutcome.Refused -> promise.reject(o.code, o.message)
            }
        }
    }

    /** Kotlin only — the native dialog's values (M1c). Never a React method. */
    internal fun parseUnshield(owner: String, amount: String, fee: String): A0Result =
        A0Confirmations.rust.parse(owner, amount, fee)

    /** Kotlin only — called on the biometric approval (M1c). Never a React method. */
    internal fun authorizeUnshield(handle: String, owner: String, amount: String, fee: String): A0Result =
        A0Confirmations.rust.authorize(handle, owner, amount, fee)

    private external fun nativeIsSupported(): Boolean
}
