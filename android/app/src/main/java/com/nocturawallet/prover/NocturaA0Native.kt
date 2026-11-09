package com.nocturawallet.prover

/**
 * The A0 JNI surface of `libnoctura_prover.so` (spec 2026-11-08 shielded A0 M1 §3), one static
 * native per Rust export (`native/noctura-prover/src/android.rs`; the list is
 * `native/noctura-prover/jni-exports.txt`, held to the library by `check-jni-exports.sh` and to
 * this object by `ReactSurfaceTest`).
 *
 * Every call returns the envelope JSON of `a0::bridge` (`{"ok": …}` or `{"error": "E_A0_…",
 * "message": …}`; [A0Result.parse]) or null if Rust could not build a string. Handles, amounts
 * and indices are decimal strings; `rho`, nullifiers and commitments 64 lowercase hex; an
 * `authId` 32 lowercase hex. Nothing returned is `sk`, `nk`, `ivk`, `d_self` or `addrField`,
 * and an own note's nullifier comes back only as public input [1] of a withdraw_change proof.
 *
 * `internal`: reached only through [NocturaProverModule] — its @ReactMethods for JS, and its
 * Kotlin-only `parseUnshield` / `authorizeUnshield` (the M1c dialog). Call
 * [NocturaNativeLib.ensureLoaded] first.
 */
internal object NocturaA0Native {
    /** The seed bytes are copied once into a buffer Rust wipes; the caller wipes this array. */
    @JvmStatic external fun keysOpen(seed: ByteArray): String?

    @JvmStatic external fun keysClose(handle: String): String?

    @JvmStatic external fun depositRho(handle: String, depositIndex: String): String?

    @JvmStatic external fun matchSpent(handle: String, chainNullifiers: Array<String>, ownRhos: Array<String>): String?

    @JvmStatic external fun commitment(handle: String, amount: String, rho: String): String?

    /** Seconds: call on [A0Prover]'s thread only. `witnessJson` carries private note data — never log it. */
    @JvmStatic external fun prove(
        handle: String,
        circuit: String,
        witnessJson: String,
        authId: String?,
        zkeyPath: String,
        wasmPath: String,
    ): String?

    /** Kotlin only (the native confirmation dialog, M1c). */
    @JvmStatic external fun parseUnshield(owner: String, amount: String, fee: String): String?

    /** Kotlin only: on the biometric approval, never on a JS request. */
    @JvmStatic external fun authorizeUnshield(handle: String, owner: String, amount: String, fee: String): String?
}
