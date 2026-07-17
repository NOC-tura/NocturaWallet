# M1 spike — native on-device Groth16 prover (NocturaProver)

**Date:** 2026-07-17
**Status:** Design approved, spec under review
**Goal of the spike:** de-risk the last gap between devnet and real on-device proving — prove that an on-device (Android) **deposit** proof, generated from the downloaded `.zkey` + `.wasm`, is **accepted by the devnet program** `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES`.

> **Execution note:** Stages 1–2 are native Rust + Android release-build + on-device work that cannot be run or verified from the current dev shell (no device, no on-device build). This spec + its plan are the map; execution happens on-device (or a native-dev session). Stage 0 (desktop) is prototypable wherever a Rust toolchain + the artifacts exist.

## Success bar (definition of done)

On a physical Android device: `ensureCircuitAssets('deposit')` → native `NocturaProver.prove('deposit', witnessJson, zkeyPath, wasmPath)` → the resulting `proofBytes` is submitted in a real `deposit` instruction and the devnet program **accepts** it (tx confirmed, `err: null`). Everything upstream (mopro-on-mobile, witness gen, proofBytes serialization, on-chain verify) is thereby de-risked with one working flow.

## Decisions (locked in brainstorming)

- **Scope:** full chain (on-chain accepted), one circuit (**deposit**, nPublic 3 — simplest on-chain path: transparent input, no pre-existing pool note), one platform (**Android** — existing native pattern, sideloadable, no App Store gate).
- **Prover backend:** **ark-circom (arkworks), pure Rust** — no libc++, sidesteps the project's #1 native blocker (the blst `libc++_shared` startup crash), and gives full control over proof serialization in Rust. rapidsnark (C++, faster) is a later optimization, explicitly out of scope.

## Architecture

```
downloaded .wasm ──▶ witness gen (pure-Rust wasm exec) ─┐
downloaded .zkey ──▶ ark-circom read_zkey ─────────────┼─▶ arkworks Groth16 prove
                                                        └─▶ proof (A∈G1, B∈G2, C∈G1)
                                                              │ serialize → 256B on-chain layout
                                                              ▼
   Rust crate `noctura-prover` ──UniFFI──▶ Kotlin `NocturaProver` RN module (frozen JS contract)
```

- **Rust core crate `noctura-prover`:** `prove(circuit_id: String, witness_json: String, zkey_path: String, wasm_path: String) -> ProveResult { proof_bytes: String /* hex */, public_inputs: Vec<String> }`, plus `is_supported() -> bool`. Uses ark-circom `read_zkey` on the `.zkey` (the snarkjs proving key already contains the constraint system — **no `.r1cs` needed**, so the downloaded zkey+wasm suffice; no new ICO artifact).
- **UniFFI** generates the Kotlin bindings from the Rust crate.
- **Kotlin `NocturaProver` RN module** implements the frozen JS contract (`nativeProverBridge.ts`): `isSupported(): boolean` and `prove(circuitId, witnessJson, zkeyPath, wasmPath): {proofBytes, publicInputs}`, delegating to the UniFFI core. Registered via a `NocturaProverPackage` mirroring the existing `NocturaKeyPackage`/`NocturaKeyModule` pattern (`android/app/src/main/java/com/nocturawallet/...`).
- **Cross-compile** the Rust `.so` for `arm64-v8a` (device) + `x86_64` (emulator) via `cargo-ndk`; package + JNI/UniFFI load.

## The critical de-risk: proofBytes serialization parity

The on-chain Solana `alt_bn128` Groth16 verifier expects a fixed **256-byte** proof layout — `A(64) + B(128) + C(64)`, big-endian, uncompressed field elements, with the specific **G1-A negation** convention Solana/snarkjs uses. This is the same layout the hosted `/zk/prove` already produces. arkworks returns the proof as raw points, so the Rust `serialize` step must reproduce that exact layout.

Groth16 proofs are randomized (`r,s`), so two independent proofs of the same witness are **not** byte-equal — parity is NOT byte-comparison. Parity = **both verify against the same VK**:

1. **Desktop cross-check (Stage 0):** the arkworks proof of a fixed deposit witness verifies against the deployed `vk.json` (the same VK snarkjs/the on-chain program use). Confirms the prover + the field encoding are correct.
2. **On-chain gate (Stage 2):** the native proof, serialized our way, is **accepted** by the devnet `deposit` ix. This is the ultimate parity + serialization check.

If Stage 0 verifies against the VK but Stage 2 is rejected on-chain, the fault is in the 256-byte serialization (negation/endianness/point-ordering) — iterate the Rust `serialize` against the on-chain verifier's expected layout (cross-reference the hosted prover's output bytes for a known witness).

## Primary technical unknown — witness generation from the downloaded `.wasm`

ark-circom proving needs the **witness**, computed by running the circom `.wasm` witness calculator on the input signals. To stay libc++-free, run the `.wasm` in a **pure-Rust wasm executor** (`wasmi` interpreter) — or mopro's witness mechanism if it is confirmed C++-free. This is the #1 item to validate in Stage 0: that the downloaded `.wasm` (the exact artifact ICO serves) produces a correct witness via a pure-Rust path, at acceptable speed. If the only viable path pulls a C/C++ witness calc, re-evaluate the libc++ impact before proceeding (C — not C++ STL — may not trigger the `libc++_shared` conflict; verify).

## Build / libc++ strategy

A pure-Rust static lib links libc (Rust std), **not** `libc++_shared` → should not conflict with RN's libc++. But the blst lesson (C1 shipped unverified → release-build startup crash) means this **must be verified empirically on a RELEASE build**, not assumed. If any transitive C++ dependency appears, apply `ANDROID_STL=c++_static` or `packagingOptions { jniLibs { pickFirst '**/libc++_shared.so' } }` per [[project_native_libcpp_crash]] and re-verify on-device.

## Staging (de-risk order — each stage has a hard exit criterion)

- **Stage 0 — desktop prover (no mobile):** arkworks `read_zkey(deposit_final.zkey)` + witness from `deposit.wasm` for a fixed deposit input → prove → serialize to 256 B → verify against `vk.json`. **Exit:** a valid, VK-verifying deposit proof produced entirely in Rust from the real artifacts.
- **Stage 1 — Android module + build:** wrap the core in UniFFI + the Kotlin `NocturaProver` module; cross-compile the `.so`; a **release** build launches (libc++ check) and `isSupported()` returns true. **Exit:** release APK launches, native module registered, no startup crash.
- **Stage 2 — on-device end-to-end:** on the device, `ensureCircuitAssets('deposit')` → native prove → submit the `deposit` ix → devnet **accepts** (`err: null`). **Exit:** the success bar.

## Non-goals (out of this spike)

- The other three circuits (withdraw / withdraw_change / transfer), iOS, rapidsnark speed optimization, flipping the `localProving` flag ON for all flows, and witness-gen performance tuning. The spike proves **deposit on Android**; production hardening + the remaining circuits follow once the pipeline is proven.

## Risks

1. **Witness gen from `.wasm` in pure Rust** (correctness + speed) — the primary unknown; validated first, in Stage 0.
2. **proofBytes 256-byte serialization** (alt_bn128 negation/endianness/point ordering) — the classic gotcha; de-risked by the VK cross-check + on-chain acceptance.
3. **libc++ regression** via a transitive C++ dep — mitigated by pure Rust; verified on a release build.
4. **On-device proving time** (arkworks slower than rapidsnark) — measured in Stage 2; acceptable behind a spinner for a spike, optimized later.

## Dependencies / prerequisites

- Rust toolchain + `cargo-ndk` + Android NDK (already present for blst).
- mopro / ark-circom / `wasmi` crates.
- The live devnet artifacts (already consumed by `ensureCircuitAssets`) + the deployed `vk.json` for the desktop cross-check (from ICO / the coordinator).
- A funded devnet SPL token account for the Stage 2 deposit submission.
