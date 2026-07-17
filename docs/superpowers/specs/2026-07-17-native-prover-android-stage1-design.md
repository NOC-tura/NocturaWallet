# Native prover Android (M1 Stage 1) — design

**Date:** 2026-07-17
**Status:** Design approved, spec under review
**Context:** Desktop de-risk complete ([[project_m1_prover_spike]]): the `noctura-prover` crate reads the deployed zkeys, computes witnesses via pure-Rust wasmi, proves via arkworks, verifies against the VK, and serializes proofBytes in the validated on-chain layout. Stage 1 packages that Rust core into the Android app as the `NocturaProver` native module and produces a devnet APK with a debug trigger, so on-device proving (and the release-build **libc++ gate**) can be tested.

## Goal / what gets tested on-device

A devnet APK with a **debug screen** ("Test native deposit prove") that, on the phone:
1. builds a valid fixed deposit input (`buildDepositNote`),
2. calls `localProver.prove('deposit', params)` — the whole on-device chain: `ensureCircuitAssets` (download + SHA-256-verify zkey+wasm) → native witness (wasmi) + prove (arkworks) → `{proofBytes(256B hex), publicInputs}`,
3. POSTs the same params to hosted `/zk/prove` and **compares `publicInputs`** (must match),
4. shows: pass/fail, proofBytes hex, publicInputs-match, elapsed ms.

**App launch itself is the libc++ gate.** Success = app launches (no startup crash) AND the button yields a native proof whose publicInputs equal the hosted prover's.

## Rust → Kotlin: Rust `jni` crate (NOT UniFFI)

Mirrors the existing `NocturaKey` loading pattern (`System.loadLibrary` + `external fun`), but the JNI implementation is **pure Rust** (the `jni` crate), so there is **no C++ glue and no `libc++_shared`** — the root cause of the blst startup crash [[project_native_libcpp_crash]] does not apply.

- `native/noctura-prover/src/android.rs` (behind a `cfg(target_os = "android")` / a `jni` feature): exports
  - `Java_com_nocturawallet_prover_NocturaProverModule_nativeIsSupported(env, class) -> jboolean` → `true`.
  - `Java_com_nocturawallet_prover_NocturaProverModule_nativeProve(env, class, circuitId, witnessJson, zkeyPath, wasmPath) -> jstring` → JSON `{"proofBytes":"<hex>","publicInputs":[...]}`. Internally: read circuitId → `ensureable? no` (JS already downloaded to the given paths) → wasmi witness from `wasmPath` + the JSON params → arkworks prove with `read_zkey(zkeyPath)` → `serialize_proof` → hex; publicInputs = `full_assignment[1..num_inputs]` as decimal. On error, return a JSON `{"error":"..."}` (Kotlin rejects the promise).
- The crate builds a `cdylib` (`libnoctura_prover.so`) for Android; the existing desktop examples/lib stay intact (the jni module is Android-only).
- `cargo-ndk` cross-compiles for `arm64-v8a` (device) + `x86_64` (emulator) → `android/app/src/main/jniLibs/<abi>/libnoctura_prover.so`.

> Witness input note: `nativeProve` receives `witnessJson` = the `ShieldedProveParams` JSON the wallet already builds (`JSON.stringify(params)` in `localProver`). The Rust side parses it to the `HashMap<String, Vec<BigInt>>` `calculate_witness_fr` expects (single-element vecs, decimal strings → BigInt). The `.wasm`/`.zkey` come as file paths (JS downloaded+verified them via `ensureCircuitAssets`).

## Kotlin side (mirrors `NocturaKey`)

- `android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt` — `ReactContextBaseJavaModule`, `NAME = "NocturaProver"` (matches `nativeProverBridge.ts`'s `NativeModules.NocturaProver`). `@ReactMethod isSupported(promise)` and `prove(circuitId, witnessJson, zkeyPath, wasmPath, promise)`; **lazy** `System.loadLibrary("noctura_prover")` (NOT in a companion `init` — the blst lesson); `external fun nativeProve(...)`/`nativeIsSupported()`; parse the returned JSON → `WritableMap { proofBytes, publicInputs: WritableArray }` (or reject on `error`).
- `NocturaProverPackage.kt` — `ReactPackage` exposing the module; **registered** in `MainApplication.kt` (`add(NocturaProverPackage())`).

> Contract shape: `nativeProverBridge.ts` calls `native.prove(circuitId, witnessJson, zkeyPath, wasmPath)` and expects `{proofBytes: string, publicInputs: string[]}`. The Kotlin `@ReactMethod` signature must match arg order and resolve that shape.

## JS / debug UI (dev tool — NOT `index.html` design)

The debug screen is a **developer test tool**, not shipped UX, so per the design rule it is deliberately **not built to `index.html`** — flagged loudly. Minimal + functional.

- `src/screens/debug/NativeProveDebugScreen.tsx` — a button + result area. Runs the flow (build input → `localProver.prove` → hosted `/zk/prove` → compare). TypeScript strict; no `any`.
- Reachable only in the devnet/dev build (e.g. a dev entry in Settings gated by `__DEV__` or a `FEATURES` flag), so it never appears in a production build and never breaks the wallet's `npm run verify`.
- Reuses `localProver`, `nativeProverBridge`, `buildDepositNote`, `proveShielded`/a raw hosted call — no new proving logic.

## libc++ strategy

The Rust `cdylib` links libc (Rust std), not `libc++_shared`. **Pre-checked here** before building the APK: run the NDK `readelf -d libnoctura_prover.so | grep NEEDED` — assert `libc++_shared.so` is ABSENT. If present (unexpected), apply `packagingOptions { jniLibs { pickFirst '**/libc++_shared.so' } }` / static-link and re-check. **Final gate = the app launches on the device** (only the user can confirm).

## Build

- Install `cargo-ndk` + `rustup target add aarch64-linux-android x86_64-linux-android`.
- `cargo ndk -t arm64-v8a -t x86_64 -o android/app/src/main/jniLibs build --release` (from the crate; `ANDROID_NDK_HOME=~/Android/Sdk/ndk/27.1.12297006`).
- Devnet env (`.env.devnet`, gitignored), native prover INCLUDED, `./gradlew assembleRelease` (debug-signed) → copy the APK to `~/Downloads/NocturaWallet-native-prover.apk`. Mirrors the prior shielded-devnet APKs, with the native module re-enabled.

## Division of work

- **Here:** all Rust/Kotlin/JS code, cargo-ndk cross-compile, `readelf` pre-check, `assembleRelease` → APK. Build iteration (RN autolink, gradle, jni marshaling) resolved here.
- **Device (user):** sideload → **launch (libc++ gate)** → tap the debug button → confirm pass + publicInputs match.

## Non-goals

- Real deposit submit (Stage 2), the other circuits, iOS, `localProving` flag flip for production, `index.html` design for the debug screen.

## Risks

1. **libc++ on-device** — pre-checked via `readelf`; final proof is on-device launch. Expected fine (pure Rust).
2. **APK build iteration** — RN autolinking a native module + cargo-ndk + gradle can need fixes; resolved here.
3. **jni string/param marshaling** — small surface (4 strings in, 1 JSON string out); validated by the desktop path being identical logic.
4. **Proving time on-device** (arkworks, unoptimized) — measured by the debug screen's elapsed-ms; acceptable behind a spinner for a test.
