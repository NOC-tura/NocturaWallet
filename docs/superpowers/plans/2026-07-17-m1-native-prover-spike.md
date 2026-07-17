# M1 native prover spike — Implementation Plan (staged runbook)

> **Not a jest-TDD plan.** This is a native/on-device spike: tasks carry concrete `cargo`/`cargo-ndk`/`gradle`/`solana` commands and a hard **exit criterion** each. Stage 0 is runnable wherever a Rust toolchain + the downloaded artifacts exist (cargo 1.90 present in this repo's dev shell). Stages 1–2 require the Android NDK + a physical device and are executed on-device.

**Goal:** An on-device Android **deposit** proof, generated from the downloaded `.zkey`+`.wasm`, accepted by the devnet program `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES`.

**Backend:** ark-circom (arkworks, pure Rust) → UniFFI → Kotlin `NocturaProver` RN module. Witness from the circom `.wasm` via a pure-Rust wasm executor.

## Global Constraints

- Pure Rust prover — **no libc++ dependency** (the whole point; verify empirically on a RELEASE build).
- The proof is a 256-byte on-chain layout `A(64)+B(128)+C(64)`, big-endian, uncompressed, Solana `alt_bn128` G1-A negation convention.
- Downloaded `.zkey`+`.wasm` are sufficient (no `.r1cs`, no separate `vk.json` — the VK is `pk.vk` from `read_zkey`).
- deposit circuit only; nPublic = 3.
- Each task's exit criterion is a concrete, observable check — do not proceed on assumption.

**Design spec:** `docs/superpowers/specs/2026-07-17-m1-native-prover-spike-design.md`

---

## Stage 0 — Desktop Rust prover (runnable in the dev shell)

Proves the prover + serialization from the real artifacts, before any mobile complexity.

### Task 0.1: scaffold `noctura-prover` crate + load the zkey

**Files:** Create `native/noctura-prover/Cargo.toml`, `native/noctura-prover/src/lib.rs`, `native/noctura-prover/examples/deposit_desktop.rs`.

- [ ] **Step 1:** create the crate. `Cargo.toml` deps (pin to versions compatible with snarkjs 0.7.4 zkeys):

```toml
[package]
name = "noctura-prover"
version = "0.1.0"
edition = "2021"

[dependencies]
ark-bn254 = "0.4"
ark-groth16 = "0.4"
ark-circom = "0.1"        # snarkjs .zkey reader + circom witness bridge
ark-crypto-primitives = "0.4"
ark-ec = "0.4"
ark-ff = "0.4"
ark-serialize = "0.4"
ark-std = "0.4"
color-eyre = "0.6"
num-bigint = "0.4"
serde_json = "1"
```

- [ ] **Step 2:** download the deposit artifacts locally:

```bash
mkdir -p native/noctura-prover/artifacts
curl -s -o native/noctura-prover/artifacts/deposit_final.zkey https://api.noc-tura.io/api/v1/zk-assets/v1/deposit_final.zkey
curl -s -o native/noctura-prover/artifacts/deposit.wasm      https://api.noc-tura.io/api/v1/zk-assets/v1/deposit.wasm
# verify pins (from src/constants/provingAssets.ts)
sha256sum native/noctura-prover/artifacts/deposit_final.zkey  # expect f11fec5007f7039ce6897689e4d6061b7276f82014c04600a006bfb9e7ffa821
sha256sum native/noctura-prover/artifacts/deposit.wasm        # expect b05ef3f39b7a839f7d063e3c3db8ca355053733b2817eaa5773a562f3b572984
```

- [ ] **Step 3:** in `examples/deposit_desktop.rs`, `read_zkey` the file and print the constraint/nPublic counts.

**Exit:** `cargo run --example deposit_desktop` reads the zkey without error and prints `nPublic = 3` (matches EXPECTED_NPUBLIC.deposit). If `ark-circom 0.1`'s `read_zkey` rejects a snarkjs-0.7.4 zkey, pin to the ark-circom revision/fork known to support it (document which) — this is the first compatibility gate.

### Task 0.2: witness generation from `deposit.wasm` (pure Rust)

**#1 unknown — validate here.** The deposit circuit's input signals must be assembled (from the wallet's `buildDepositNote` params: `commitment, amount, mintHash, pkRecipientHash, noteSecret` — mirror `src/modules/shielded/depositWitness.ts`).

- [ ] **Step 1:** derive a fixed, valid deposit input signal set in `deposit_desktop.rs` (reuse constants; the input names must match the circom `.wasm`'s expected signal names — dump them from the wasm if unsure).
- [ ] **Step 2:** compute the witness by executing `deposit.wasm`. Preferred pure-Rust path: a `wasmi`-based circom witness calculator (add `wasmi`), OR `ark-circom`'s `WitnessCalculator` if it runs the wasm without a C++ dep. Confirm no C++ is linked (`cargo tree | grep -iE 'cc|cxx|clang'`).

**Exit:** a witness `Vec<Fr>` of the expected length is produced from the real `deposit.wasm`, via a confirmed **libc++-free** path. If the only working witness calc pulls C/C++, note it + its STL linkage (C ≠ C++ STL; may still be acceptable) before continuing.

### Task 0.3: prove + verify against the zkey's VK

- [ ] **Step 1:** `Groth16::<Bn254>::prove(&pk, &witness, &mut rng)` → `proof`.
- [ ] **Step 2:** verify: `Groth16::verify(&pk.vk, &public_inputs, &proof)` → assert `true`.

**Exit:** the arkworks-generated deposit proof **verifies against `pk.vk`** (the deployed VK). Prover correctness de-risked.

### Task 0.4: serialize to the 256-byte on-chain layout + assert

**Files:** `src/lib.rs` — a `serialize_proof(proof) -> [u8; 256]`.

- [ ] **Step 1:** serialize `A` (G1, 64 B), `B` (G2, 128 B), `C` (G1, 64 B), big-endian uncompressed, applying Solana's `alt_bn128` G1-A negation (`-A`) convention. Cross-reference the hosted `/zk/prove` output for the SAME circuit's byte layout (request one reference proofBytes from the coordinator or capture from a hosted call).
- [ ] **Step 2:** unit test: `serialize_proof` output is exactly 256 B; the three segment lengths are 64/128/64; re-parsing the bytes reconstructs points that verify against `pk.vk`.

**Exit:** a 256-byte serialization whose round-trip verifies, matching the on-chain layout. **Stage 0 complete** — the full prove→serialize→verify chain works in Rust from the real artifacts.

---

## Stage 1 — Android module + release build (on-device / NDK required)

### Task 1.1: UniFFI-export the crate

- [ ] Add `uniffi` deps + a `noctura_prover.udl` exposing `is_supported() -> bool` and `prove(circuit_id, witness_json, zkey_path, wasm_path) -> ProveResult`. Generate Kotlin bindings.
**Exit:** `cargo build` produces the UniFFI Kotlin bindings + the scaffolding compiles.

### Task 1.2: cross-compile the `.so`

- [ ] `cargo ndk -t arm64-v8a -t x86_64 -o android/app/src/main/jniLibs build --release` (requires `ANDROID_NDK_HOME` + `cargo-ndk`).
**Exit:** `libnoctura_prover.so` present for `arm64-v8a` + `x86_64` under `jniLibs`; `cargo tree` shows no libc++/C++ STL dependency (or, if unavoidable, `c++_static`/`pickFirst` applied per the libc++ memo).

### Task 1.3: Kotlin `NocturaProver` RN module

**Files:** `android/app/src/main/java/com/nocturawallet/prover/NocturaProverModule.kt`, `NocturaProverPackage.kt`; register in `MainApplication.kt`.

- [ ] Mirror the existing `NocturaKeyModule`/`NocturaKeyPackage` pattern. `isSupported()` returns true; `prove(circuitId, witnessJson, zkeyPath, wasmPath)` delegates to the UniFFI core and returns `{proofBytes, publicInputs}` (the shape `nativeProverBridge.ts` expects). Lazy `System.loadLibrary` (not in a companion `init`) per the libc++ crash lesson.
**Exit:** `./gradlew assembleRelease` succeeds; the module is registered.

### Task 1.4: release build launches (the libc++ gate)

- [ ] Install the release APK on the device; launch.
**Exit:** the app **launches without a startup crash** and `NocturaProver.isSupported()` returns true from JS. (This is the exact failure mode the blst module hit — the pure-Rust `.so` must not reintroduce it.)

---

## Stage 2 — On-device end-to-end (success bar)

### Task 2.1: on-device native deposit proof

- [ ] Behind a debug trigger (NOT the shipped `localProving` flag), on-device: `ensureCircuitAssets('deposit')` downloads+verifies zkey+wasm → `localProver.prove('deposit', params)` → returns `{proofBytes, publicInputs}` with `publicInputs.length === 3`.
**Exit:** a native `proofBytes` (256 B hex) produced on-device from the downloaded artifacts; measure + log proving time.

### Task 2.2: submit + on-chain accept

- [ ] Submit a real `deposit` ix (shield a small amount from a funded devnet SPL account) using the native `proofBytes` via `depositShield` → confirm the tx.
**Exit (SUCCESS BAR):** the devnet program **accepts** the tx (`err: null`, commitment leaf inserted). On-device on-chain proving proven for deposit.

### Task 2.3: serialization iteration (only if 2.2 rejects)

- [ ] If the on-chain verify fails (`ProofVerificationFailed`), the fault is the 256-byte serialization. Capture the hosted `/zk/prove` proofBytes for the same witness, diff the byte layout (A/B/C segments, negation, endianness, G2 coordinate order), fix `serialize_proof`, re-run 2.1–2.2.
**Exit:** convergence on 2.2's success.

---

## Self-Review

- **Spec coverage:** desktop prover → Stage 0; Android module/build/libc++ → Stage 1; on-device on-chain accept → Stage 2; witness-gen unknown → Task 0.2 (validated first); serialization parity → Tasks 0.4 + 2.3; deposit-only / Android-only / ark-circom → constraints + tasks. All spec sections mapped.
- **Placeholder scan:** version pins (`ark-* 0.4`, `ark-circom 0.1`) are starting points with an explicit compatibility gate in Task 0.1 (snarkjs-0.7.4 zkey support), not silent guesses. No TODO/TBD.
- **Executability:** Stage 0 is runnable in the dev shell (cargo present); Stages 1–2 flagged as NDK+device. The plan states which is which so no step is attempted in the wrong environment.

## Not in this plan

- Other circuits, iOS, rapidsnark, flipping `localProving` ON for all flows, proving-time optimization. These follow once the deposit pipeline is proven on-device.
