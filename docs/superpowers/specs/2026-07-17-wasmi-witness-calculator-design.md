# wasmi witness calculator — design (completes M1 Stage 0)

**Date:** 2026-07-17
**Status:** Design approved, spec under review
**Context:** M1 spike ([[project_m1_prover_spike]], `native/noctura-prover/`) proved arkworks reads our snarkjs-0.7.4 zkeys and the prove→verify pipeline compiles, but the full desktop proof is link-blocked by ark-circom's `wasmer 2.3.0` witness calculator (`__rust_probestack`). This replaces the witness step with a pure-Rust **wasmi** calculator — unblocking desktop execution AND providing the on-device (Android) path (wasmer is C-containing → a libc++ risk).

## Key finding — the circom2 path is small

`ark-circom`'s `calculate_witness_circom2` (our circuits are circom2) does NOT use the fiddly `SafeMemory`/`memory.rs` (that is circom1-only). Circom2 drives the wasm entirely through exported functions over the wasm's own shared-RW-memory. So this is a **~150-LOC circom2-only port**, not a 500-LOC one.

## The circom2 ABI (verified from ark-circom `circom.rs`/`witness_calculator.rs`)

**Wasm exports the calculator calls:** `init(i32 sanity)`, `getFieldNumLen32() -> i32` (n32), `getRawPrime()`, `readSharedRWMemory(i32) -> i32`, `writeSharedRWMemory(i32 i, i32 v)`, `setInputSignal(i32 hmsb, i32 hlsb, i32 pos)`, `getWitness(i32 i)`, `getWitnessSize() -> i32`, `getVersion() -> i32` (optional `getNVars`).

**Wasm imports the host must provide:** `env.memory` (a `Memory`, ≥2000 pages) + `runtime.*` host functions, all no-ops except `error` which traps: `error, logSetSignal, logGetSignal, logFinishComponent, logStartComponent, log, exceptionHandler, showSharedRWMemory, printErrorMessage, writeBufferMessage`.

**Algorithm (circom2):**
1. `init(false)`; `n32 = getFieldNumLen32()`.
2. For each `(name, values)`: `(msb,lsb) = fnv(name)`; for each `value` at index `i`: `arr = to_array32(value, n32)`; write words `writeSharedRWMemory(j, arr[n32-1-j])` for `j in 0..n32`; `setInputSignal(msb, lsb, i)`.
3. `ws = getWitnessSize()`; for `i in 0..ws`: `getWitness(i)`; read words `readSharedRWMemory(j)` → reassemble `arr[n32-1-j]`; `from_array32(arr)` → witness element.

`fnv` (FNV-1a → `(msb,lsb): (u32,u32)` from the signal name), `to_array32`/`from_array32` (little-endian-word ↔ BigInt) are ported verbatim from ark-circom (trivial, no wasm).

## Components (in `native/noctura-prover/`)

- **`src/witness_wasmi.rs`** (new): circom2-only `WitnessCalculator` over the latest **wasmi** (pure Rust). API: `WitnessCalculator::from_file(path) -> Result<Self>` and `calculate_witness_fr(inputs: HashMap<String, Vec<BigInt>>) -> Result<Vec<Fr>>` (Fr = `ark_bn254::Fr`), mirroring the fields the prove step needs. Provides `env.memory` + no-op host funcs via a wasmi `Linker`, instantiates, binds exports as `TypedFunc`, runs the algorithm. Reuses ark-circom's BigInt→Fr conversion (negative-aware, mod p) for the final `Vec<Fr>`.
- **`examples/deposit_prove.rs`**: swap the wasmer `WitnessCalculator` for `witness_wasmi::WitnessCalculator`; keep the existing `read_zkey` + `create_proof_with_reduction_and_matrices` + verify. Drop the `wasmer`-implicated deps where possible (ark-circom is still used for `read_zkey` + `CircomReduction`, which pulls wasmer transitively — so ark-circom's default features may need trimming; if wasmer still links only for read_zkey/reduction and the probestack error persists, isolate `read_zkey`/matrices loading to a path that doesn't pull `wasmer-vm`'s libcalls — investigate in Task 1).

> **Link risk — likely already resolved by dead-code elimination.** ark-circom (kept for `read_zkey` + `CircomReduction`) transitively depends on wasmer, but the `zkey_check` example — which calls ONLY `read_zkey` — **linked and ran successfully**. The `__rust_probestack` error appeared only once `WitnessCalculator` was *called*, making `wasmer-vm`'s runtime libcalls live. Since `read_zkey` (binary parsing) and `CircomReduction` (field math) execute no wasm, `--gc-sections` should keep `wasmer-vm`'s libcalls dead → the link should succeed with a wasmi witness. **Verify empirically in Task 1** (build the example); if the error persists, fall back to (a) trim ark-circom's wasmer feature or (b) vendor the small, self-contained `read_zkey` + `CircomReduction` and drop the ark-circom dep.

## Validation — self-contained (no external reference needed)

Groth16 verification is the check:
1. **Proof verifies against `pk.vk`** — a non-satisfying witness (a port bug) yields a proof that does NOT verify; `verified == true` proves the wasmi witness satisfies the R1CS.
2. **Extracted public inputs equal the known inputs** — assert the proof's public signals (`full_assignment[1..num_inputs]`, decoded) match the `commitment`/`amount`/`mintHash` from `deposit_input.json`, cross-checking the witness against known values.

Optionally (bonus, not required): compare the full witness vector against a reference from the hosted prover if ICO provides one.

## Exit criterion

`cargo run --example deposit_prove` runs to completion on stable rust: witness computed via wasmi, proof generated, `verify_with_processed_vk == true`, public-input assertion passes. **M1 Stage 0 complete.**

## Non-goals

- circom1 path (unused). UniFFI/Android bindings (Stage 1). Other circuits. The 256-byte on-chain proof serialization (Task 0.4 / gated by Stage 2 on-chain acceptance). Proving-time optimization.

## Testing

- Unit: `fnv`, `to_array32`/`from_array32` round-trips (vs known vectors from ark-circom's tests, e.g. the multiplier witness).
- Integration: the `deposit_prove` example is the end-to-end gate (witness→prove→verify + public-input assert).
