# wasmi witness calculator — Implementation Plan

> Executed inline in `native/noctura-prover/`. Rust/TDD where pure logic allows; the `deposit_prove` example is the end-to-end gate. Steps use `- [ ]`.

**Goal:** Complete M1 Stage 0 — a pure-Rust wasmi circom2 witness calculator so `cargo run --example deposit_prove` runs to completion (witness → prove → verify=true) from the real deposit artifacts.

**Design spec:** `docs/superpowers/specs/2026-07-17-wasmi-witness-calculator-design.md`

## Global Constraints

- Pure Rust — no wasmer, no libc++. wasmi (pin the resolved latest stable; record it).
- circom2 path only (our circuits). No SafeMemory / circom1.
- Validation is self-contained: proof verifies vs `pk.vk` + extracted public inputs equal the known `deposit_input.json` values.
- Builds/runs on stable rust (no toolchain pin).

---

### Task 1: pure helpers — `fnv`, `to_array32`, `from_array32` (TDD)

**Files:** Create `src/witness_wasmi.rs` (helpers first); wire `mod witness_wasmi;` into `src/lib.rs`. Unit tests inline.

- [ ] **Step 1: failing tests** — port ark-circom's helpers and assert known vectors:

```rust
// fnv("main.a") etc. — FNV-1a 64-bit split into (msb, lsb) u32.
// to_array32/from_array32 round-trip a BigInt through n32 little-endian-word form.
#[test]
fn array32_roundtrip() {
    let v = num_bigint::BigInt::from(0x1234_5678_9abc_def0u64);
    assert_eq!(from_array32(to_array32(&v, 8)), v);
}
#[test]
fn fnv_is_stable() {
    // FNV-1a of "a": offset 0xcbf29ce484222325, prime 0x100000001b3
    let (msb, lsb) = fnv("a");
    assert_eq!((msb as u64) << 32 | lsb as u64, fnv1a("a"));
}
```

- [ ] **Step 2:** `cargo test --lib witness_wasmi` → FAIL (undefined).
- [ ] **Step 3:** implement `fnv`, `to_array32`, `from_array32` verbatim from ark-circom's `witness/mod.rs` + `witness_calculator.rs` (`from_array32`/`to_array32` shown in the spec; `fnv` is FNV-1a 64-bit → `((hash>>32) as u32, hash as u32)`).
- [ ] **Step 4:** `cargo test --lib witness_wasmi` → PASS.
- [ ] **Step 5:** commit `feat(prover): wasmi witness helpers (fnv, array32)`.

---

### Task 2: `WitnessCalculator` over wasmi

**Files:** `src/witness_wasmi.rs`.

**Produces:** `WitnessCalculator::from_file(path) -> Result<Self>` and `calculate_witness_fr(&mut self, inputs: HashMap<String, Vec<BigInt>>) -> Result<Vec<Fr>>` (`Fr = ark_bn254::Fr`).

- [ ] **Step 1:** add `wasmi` to Cargo.toml (resolve latest; record the version in a comment). Confirm pure-Rust: `cargo tree -p wasmi | grep -iE 'cc|cxx|clang'` prints nothing.
- [ ] **Step 2:** implement over wasmi's API (Engine/Module/Store/Linker/Memory/TypedFunc):
  - `Store<()>`, `Engine`, `Module::new(&engine, wasm_bytes)`.
  - `Linker`: define `env.memory` = `Memory::new(&mut store, MemoryType::new(2000, None))`; define the `runtime.*` host funcs (`error` returns a `Trap`; the rest are no-ops with the right arities: `logSetSignal(i32,i32)`, `logGetSignal(i32,i32)`, `logStartComponent(i32)`, `logFinishComponent(i32)`, `log(i32)`, `exceptionHandler(i32)`, `showSharedRWMemory()`, `printErrorMessage()`, `writeBufferMessage()`).
  - Instantiate + `.start()`; fetch exports as `TypedFunc`: `init:(i32)->()`, `getFieldNumLen32:()->i32`, `getRawPrime:()->()`, `readSharedRWMemory:(i32)->i32`, `writeSharedRWMemory:(i32,i32)->()`, `setInputSignal:(i32,i32,i32)->()`, `getWitness:(i32)->()`, `getWitnessSize:()->i32`, `getVersion:()->i32`.
  - `calculate_witness_fr`: run the circom2 algorithm (spec §Algorithm): `init(0)`; `n32=getFieldNumLen32()`; per input `(name,values)`: `(msb,lsb)=fnv(name)`; per value: `arr=to_array32(v,n32)`, write words, `setInputSignal(msb,lsb,i)`; then `ws=getWitnessSize()`; per `i`: `getWitness(i)`, read n32 words → `from_array32` → BigInt; convert each BigInt → Fr (negative-aware mod p, per ark-circom's `calculate_witness_element`).
- [ ] **Step 3:** guard: assert the wasm's version == 2 (`getVersion()`), else bail (we only implement circom2).
- [ ] **Step 4:** `cargo build` (lib) clean.
- [ ] **Step 5:** commit `feat(prover): circom2 witness calculator over wasmi`.

---

### Task 3: wire into `deposit_prove` + end-to-end gate (Stage 0 exit)

**Files:** `examples/deposit_prove.rs`; `Cargo.toml` (drop the direct `wasmer` dep if present — it was already removed; keep ark-circom for `read_zkey`/`CircomReduction`).

- [ ] **Step 1:** replace the `ark_circom::WitnessCalculator` usage with `noctura_prover::witness_wasmi::WitnessCalculator`: `let mut w = WitnessCalculator::from_file("artifacts/deposit.wasm")?; let full_assignment = w.calculate_witness_fr(inputs)?;`. Keep `read_zkey`, `create_proof_with_reduction_and_matrices`, `process_vk`, `verify_with_processed_vk`.
- [ ] **Step 2: link check (the flagged risk):** `cargo run --example deposit_prove`. Expected: it LINKS (wasmer-vm libcalls are dead-code-eliminated since we no longer call ark-circom's WitnessCalculator) and RUNS. If `__rust_probestack` persists, disable ark-circom's wasmer feature or vendor `read_zkey`+`CircomReduction` (spec's fallback) — then re-run.
- [ ] **Step 3: validation asserts** in the example:
  - `assert!(verified)` against `pk.vk`.
  - Decode the public inputs (`full_assignment[1..num_inputs]`) to decimal and assert they contain the known `commitment` (and, per the circuit's public signal order, `amount`/`mintHash`) from `deposit_input.json`. (Discover the exact public-signal order empirically from the printed values; document it.)
- [ ] **Step 4:** run to completion; expected output ends `PASS: deposit proof VERIFIES against the deployed VK (witness via wasmi)`.
- [ ] **Step 5:** update `STATUS.md` (Stage 0 = DONE, wasmi) and commit `feat(prover): complete M1 Stage 0 — deposit proof via wasmi verifies`.

---

## Self-Review

- **Spec coverage:** ABI + algorithm → Task 2; helpers → Task 1; wasmi purity → Task 2 Step 1; validation → Task 3 Step 3; link risk → Task 3 Step 2; exit criterion → Task 3 Step 4. All mapped.
- **Placeholder scan:** the public-signal order is "discover empirically + document" (Task 3) — a genuine unknown resolved at runtime, not a hand-wave; the assert on `commitment` is concrete. No TODO/TBD in code steps.
- **Type consistency:** `WitnessCalculator::from_file(path) -> Result<Self>`, `calculate_witness_fr(HashMap<String,Vec<BigInt>>) -> Result<Vec<Fr>>`, `fnv(&str)->(u32,u32)`, `to_array32(&BigInt,usize)->Vec<u32>`, `from_array32(Vec<u32>)->BigInt` — consistent across tasks and with the existing `deposit_prove` prove/verify calls.

## Not in this plan

- UniFFI/Kotlin (Stage 1), the 256-byte on-chain serialization (Task 0.4), other circuits, circom1.
