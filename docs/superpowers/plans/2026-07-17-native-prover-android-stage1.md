# Native prover Android (M1 Stage 1) — Implementation Plan

> Executed inline. Rust/TDD for the reusable core; cargo-ndk / gradle / device steps have concrete commands + checks. On-device launch is the user's step.

**Goal:** Package `noctura-prover` into the Android app as the `NocturaProver` native module (pure-Rust JNI) + a devnet debug APK that proves a deposit on-device and compares to hosted.

**Design spec:** `docs/superpowers/specs/2026-07-17-native-prover-android-stage1-design.md`

## Global Constraints

- Pure-Rust JNI (`jni` crate) — no C++, no `libc++_shared`. Verify via `readelf`.
- Kotlin module `NAME = "NocturaProver"` (matches `nativeProverBridge.ts`). Lazy `System.loadLibrary` (never in a companion `init`).
- Debug screen is a dev tool — dev-gated, NOT `index.html` design, must not break `npm run verify`.
- NDK: `~/Android/Sdk/ndk/27.1.12297006`.

---

### Task 1: extract a reusable `prove_to_bytes` core (Rust, TDD)

**Files:** Create `native/noctura-prover/src/prover.rs`; `mod prover;` in `lib.rs`. Refactor `examples/deposit_prove.rs` to call it.

**Produces:** `pub fn prove_to_bytes(circuit_id: &str, params_json: &str, zkey_path: &str, wasm_path: &str) -> Result<ProveOutput, Box<dyn Error>>` where `ProveOutput { proof_bytes_hex: String, public_inputs: Vec<String> }`. Reuses `read_zkey` + `witness_wasmi` + arkworks prove + `serialize_proof`. `params_json` = a flat JSON object of decimal strings (the wallet's `ShieldedProveParams`) → `HashMap<String, Vec<BigInt>>` (single-element vecs).

- [ ] **Step 1: failing integration test** (`tests/prove_to_bytes.rs` or `#[cfg(test)]` reading `artifacts/`):

```rust
#[test]
fn deposit_prove_to_bytes_matches_public_inputs() {
    let params = std::fs::read_to_string("artifacts/deposit_input.json").unwrap();
    let out = noctura_prover::prover::prove_to_bytes(
        "deposit", &params,
        "artifacts/deposit_final.zkey", "artifacts/deposit.wasm",
    ).unwrap();
    assert_eq!(out.proof_bytes_hex.len(), 512);          // 256 bytes
    assert_eq!(out.public_inputs.len(), 3);              // deposit nPublic
    assert_eq!(out.public_inputs[0],
        "8081702745406920529902264228351723735379273324999453834569345340835518474946"); // commitment
}
```

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: implement `prover.rs`** — move the body of `deposit_prove.rs` here: parse `params_json` (serde_json → `HashMap<String,String>` → `HashMap<String,Vec<BigInt>>`), `WitnessCalculator::from_file(wasm_path).calculate_witness_fr(inputs)`, `read_zkey(zkey_path)`, `create_proof_with_reduction_and_matrices`, `serialize_proof` → hex, public inputs = `full_assignment[1..num_inputs]` via `fr_dec`. Return `ProveOutput`.
- [ ] **Step 4:** run → PASS. Refactor `examples/deposit_prove.rs` to call `prove_to_bytes` (keep its verify/round-trip asserts). `cargo run --example deposit_prove` still PASS.
- [ ] **Step 5:** commit `feat(prover): extract reusable prove_to_bytes core`.

---

### Task 2: JNI wrapper (Android-only) + cdylib

**Files:** Create `native/noctura-prover/src/android.rs`; `Cargo.toml` (`[lib] crate-type = ["lib","cdylib"]`, `jni` dep, android cfg).

- [ ] **Step 1:** `Cargo.toml`: add `[lib] name = "noctura_prover"`, `crate-type = ["rlib", "cdylib"]`; `[target.'cfg(target_os = "android")'.dependencies] jni = "0.21"`. In `lib.rs`: `#[cfg(target_os = "android")] mod android;`.
- [ ] **Step 2: implement `android.rs`** — pure-Rust JNI:

```rust
use jni::objects::{JClass, JString};
use jni::sys::{jboolean, jstring, JNI_TRUE};
use jni::JNIEnv;

#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeIsSupported(
    _env: JNIEnv, _class: JClass,
) -> jboolean { JNI_TRUE }

#[no_mangle]
pub extern "system" fn Java_com_nocturawallet_prover_NocturaProverModule_nativeProve<'a>(
    mut env: JNIEnv<'a>, _class: JClass<'a>,
    circuit_id: JString<'a>, witness_json: JString<'a>, zkey_path: JString<'a>, wasm_path: JString<'a>,
) -> jstring {
    let res = (|| -> Result<String, Box<dyn std::error::Error>> {
        let cid: String = env.get_string(&circuit_id)?.into();
        let wj: String = env.get_string(&witness_json)?.into();
        let zk: String = env.get_string(&zkey_path)?.into();
        let wp: String = env.get_string(&wasm_path)?.into();
        let out = crate::prover::prove_to_bytes(&cid, &wj, &zk, &wp)?;
        Ok(serde_json::json!({"proofBytes": out.proof_bytes_hex, "publicInputs": out.public_inputs}).to_string())
    })();
    let s = res.unwrap_or_else(|e| serde_json::json!({"error": e.to_string()}).to_string());
    env.new_string(s).expect("jstring").into_raw()
}
```

- [ ] **Step 3:** `cargo build` (host, rlib) stays green (android module is cfg'd out on host — compile-check the jni code by a one-off `cargo build --target aarch64-linux-android` in Task 3).
- [ ] **Step 4:** commit `feat(prover): Android JNI wrapper for NocturaProver`.

---

### Task 3: cargo-ndk cross-compile + libc++ pre-check

- [ ] **Step 1:** `rustup target add aarch64-linux-android x86_64-linux-android`; `cargo install cargo-ndk` (if absent).
- [ ] **Step 2:** `export ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006`; from the crate: `cargo ndk -t arm64-v8a -t x86_64 -o ../../android/app/src/main/jniLibs build --release`.
- [ ] **Step 3 (libc++ PRE-CHECK):** `$ANDROID_NDK_HOME/toolchains/llvm/prebuilt/linux-x86_64/bin/llvm-readelf -d android/app/src/main/jniLibs/arm64-v8a/libnoctura_prover.so | grep NEEDED`. **Assert `libc++_shared.so` is ABSENT.** If present, add `packagingOptions { jniLibs { pickFirst '**/libc++_shared.so' } }` to `android/app/build.gradle` and re-check.
- [ ] **Step 4:** confirm the `.so` exists for both ABIs. (No commit — `.so` is gitignored build output; note the sizes.)

---

### Task 4: Kotlin module + package + registration

**Files:** Create `android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt` + `NocturaProverPackage.kt`; modify `MainApplication.kt`.

- [ ] **Step 1:** `NocturaProverModule.kt` — mirror `NocturaKeyModule` (lazy `System.loadLibrary("noctura_prover")`, `external fun nativeProve(circuitId,witnessJson,zkeyPath,wasmPath):String`, `external fun nativeIsSupported():Boolean`). `@ReactMethod isSupported(promise)` → resolve `nativeIsSupported()`. `@ReactMethod prove(circuitId,witnessJson,zkeyPath,wasmPath,promise)` → run on a background thread, `nativeProve(...)`, `JSONObject(result)`: if it has `error` → `promise.reject`; else build `WritableNativeMap { putString("proofBytes"); putArray("publicInputs", WritableNativeArray) }` → `promise.resolve`.
- [ ] **Step 2:** `NocturaProverPackage.kt` — `ReactPackage` returning the module.
- [ ] **Step 3:** `MainApplication.kt` — `add(NocturaProverPackage())` (import + register; leave the disabled NocturaKey as-is).
- [ ] **Step 4:** commit `feat(android): NocturaProver native module + package registration`.

---

### Task 5: JS debug screen (dev-gated) + wiring

**Files:** Create `src/screens/debug/NativeProveDebugScreen.tsx`; add a dev-only navigation entry; keep `npm run verify` green.

- [ ] **Step 1:** `NativeProveDebugScreen.tsx` — a button "Test native deposit prove" that: builds a fixed deposit input (`buildDepositNote(seed, 1_000_000_000n, SHIELDED_DEVNET_MINT)` with the wallet seed), calls `localProver.prove('deposit', params)` (native chain), then POSTs `{proofType:'deposit', params}` to hosted `/zk/prove` (reuse `proveShielded` or a raw pinnedFetch), and compares `publicInputs`. Renders: status, elapsed ms, proofBytes head, and `publicInputs match: ✓/✗`. TypeScript strict; no `any`; all values from real modules.
- [ ] **Step 2:** dev entry — add a row in Settings (or a dev section) gated by `__DEV__ || FEATURES.<devFlag>` that navigates to the screen; register the screen in the relevant navigator. Ensure it is invisible/absent in production.
- [ ] **Step 3:** `npm run verify` → lint + tsc + jest green (add a minimal smoke test if a navigator/screen test pattern requires it; otherwise ensure existing suites pass).
- [ ] **Step 4:** commit `feat(debug): on-device native-prove test screen (dev-gated)`.

---

### Task 6: build the devnet APK

- [ ] **Step 1:** ensure `.env.devnet` present (gitignored; mirror prior shielded-devnet builds). Confirm `newArchEnabled=true`, native prover jniLibs present.
- [ ] **Step 2:** `cd android && ANDROID_HOME=~/Android/Sdk ./gradlew assembleRelease` (debug-signed release; resolve autolink/gradle issues as they arise).
- [ ] **Step 3:** copy the APK → `~/Downloads/NocturaWallet-native-prover.apk`; print its size + the jniLibs it contains (`unzip -l ... | grep libnoctura_prover`).
- [ ] **Step 4:** update `native/noctura-prover/STATUS.md` (Stage 1 APK built, libc++ readelf result, awaiting on-device). Commit `chore(prover): Stage 1 devnet APK notes`.

---

## Self-Review

- **Spec coverage:** reusable core → Task 1; JNI → Task 2; cargo-ndk + libc++ pre-check → Task 3; Kotlin module/registration → Task 4; debug UI (dev-gated, not index.html) → Task 5; APK → Task 6. All mapped.
- **Placeholder scan:** device launch (libc++ gate) is explicitly the user's step, not a code TODO. Gradle/autolink "resolve as they arise" is a known build-iteration reality, not a spec gap. No TODO/TBD in code.
- **Type consistency:** `prove_to_bytes(&str,&str,&str,&str) -> Result<ProveOutput>`; JNI symbol `Java_com_nocturawallet_prover_NocturaProverModule_nativeProve`; Kotlin `NAME="NocturaProver"`, `prove(circuitId,witnessJson,zkeyPath,wasmPath,promise)` matches `nativeProverBridge.ts`'s `native.prove(circuitId, witnessJson, zkeyPath, wasmPath)`.

## Not in this plan

- Real deposit submit (Stage 2), other circuits, iOS, flag flip for production.
