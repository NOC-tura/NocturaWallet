# proofBytes on-chain serialization — Implementation Plan

> Executed inline in `native/noctura-prover/`. Rust/TDD for the pure serializer; the examples are the desktop validation gates.

**Goal:** `serialize_proof(arkworks Proof<Bn254>) -> [u8;256]` in the frozen on-chain layout (pi_a negated, G2 c1-first, big-endian), validated on desktop against an on-chain-accepted reference from `/zk/prove`.

**Design spec:** `docs/superpowers/specs/2026-07-17-proofbytes-onchain-serialization-design.md`

## Global Constraints

- 256 B = `A(64) + B(128) + C(64)`, each element 32-byte **big-endian**. A = `-proof.a`; B = G2 `x.c1‖x.c0‖y.c1‖y.c0`; C = `proof.c` (not negated).
- Pure Rust; no HTTP dep (reference fetched by curl → fixture).
- Builds/runs on stable rust.

---

### Task 1: `src/proof_bytes.rs` — serialize + parse (TDD)

**Files:** Create `src/proof_bytes.rs`; `mod proof_bytes;` in `lib.rs`.

**Produces:** `serialize_proof(&Proof<Bn254>) -> [u8;256]`; `parse_proof(&[u8;256]) -> Result<Proof<Bn254>, Box<dyn Error>>` (un-negates A so the result feeds arkworks verify).

- [ ] **Step 1: failing tests**

```rust
// helpers: 32-byte BE field encoding, G1 (opt-negate) 64B, G2 c1-first 128B.
#[test]
fn g1_be_negate_flips_y_to_p_minus_y() {
    let g = G1Affine::generator();
    let plain = g1_be(&g, false);
    let neg = g1_be(&g, true);
    assert_eq!(&plain[..32], &neg[..32]);            // x unchanged
    assert_ne!(&plain[32..], &neg[32..]);            // y negated
    // parse both back: neg's y == p - plain's y
    let y = Fq::from_be_bytes_mod_order(&plain[32..]);
    let ny = Fq::from_be_bytes_mod_order(&neg[32..]);
    assert_eq!(y + ny, Fq::from(0u8));               // y + (p-y) == 0 mod p
}

#[test]
fn serialize_len_and_roundtrip_verifies() {
    // uses a proof produced in-test (reuse the deposit_prove path) OR a fixed proof;
    // simplest: build a proof here from the artifacts, serialize, parse, verify.
    let (proof, vk, public_inputs) = crate::testsupport::deposit_proof(); // small helper
    let bytes = serialize_proof(&proof);
    assert_eq!(bytes.len(), 256);
    let parsed = parse_proof(&bytes).unwrap();
    assert!(ark_groth16::Groth16::<Bn254>::verify(&vk, &public_inputs, &parsed).unwrap());
}
```

> To avoid duplicating the prove flow in the test, extract a `pub fn deposit_proof() -> (Proof<Bn254>, VerifyingKey<Bn254>, Vec<Fr>)` helper (from `deposit_prove.rs`'s body) into `src/testsupport.rs` (or a `#[cfg(test)]` fn in `proof_bytes.rs` that reads `artifacts/`), so both the example and the test share one prove path. If reading `artifacts/` in a unit test is awkward (cwd), keep the round-trip assertion in the `deposit_prove` example instead and unit-test only the pure helpers here.

- [ ] **Step 2:** `cargo test --lib proof_bytes` → FAIL.

- [ ] **Step 3: implement**

```rust
use ark_bn254::{Bn254, Fq, Fq2, G1Affine, G2Affine};
use ark_ff::{BigInteger, PrimeField};
use ark_groth16::Proof;
use std::error::Error;

fn fq_be(f: &Fq) -> [u8; 32] {
    let mut out = [0u8; 32];
    let b = f.into_bigint().to_bytes_be(); // big-endian, may be < 32
    out[32 - b.len()..].copy_from_slice(&b);
    out
}

pub fn g1_be(p: &G1Affine, negate: bool) -> [u8; 64] {
    let p = if negate { -*p } else { *p };
    let mut out = [0u8; 64];
    out[..32].copy_from_slice(&fq_be(&p.x));
    out[32..].copy_from_slice(&fq_be(&p.y));
    out
}

pub fn g2_be_c1first(p: &G2Affine) -> [u8; 128] {
    let mut out = [0u8; 128];
    out[..32].copy_from_slice(&fq_be(&p.x.c1));
    out[32..64].copy_from_slice(&fq_be(&p.x.c0));
    out[64..96].copy_from_slice(&fq_be(&p.y.c1));
    out[96..].copy_from_slice(&fq_be(&p.y.c0));
    out
}

pub fn serialize_proof(proof: &Proof<Bn254>) -> [u8; 256] {
    let mut out = [0u8; 256];
    out[..64].copy_from_slice(&g1_be(&proof.a, true));      // pi_a NEGATED
    out[64..192].copy_from_slice(&g2_be_c1first(&proof.b)); // G2 c1-first
    out[192..].copy_from_slice(&g1_be(&proof.c, false));    // pi_c as-is
    out
}

fn g1_from_be(b: &[u8]) -> G1Affine {
    G1Affine::new(Fq::from_be_bytes_mod_order(&b[..32]), Fq::from_be_bytes_mod_order(&b[32..64]))
}
fn g2_from_be_c1first(b: &[u8]) -> G2Affine {
    let x = Fq2::new(Fq::from_be_bytes_mod_order(&b[32..64]), Fq::from_be_bytes_mod_order(&b[..32]));   // (c0,c1)
    let y = Fq2::new(Fq::from_be_bytes_mod_order(&b[96..128]), Fq::from_be_bytes_mod_order(&b[64..96]));
    G2Affine::new(x, y)
}

/// Parse the on-chain layout back into a proof, UN-negating A so it feeds arkworks
/// `Groth16::verify` (which does not expect a negated A).
pub fn parse_proof(bytes: &[u8; 256]) -> Result<Proof<Bn254>, Box<dyn Error>> {
    let a = -g1_from_be(&bytes[..64]);              // un-negate
    let b = g2_from_be_c1first(&bytes[64..192]);
    let c = g1_from_be(&bytes[192..]);
    Ok(Proof { a, b, c })
}
```

- [ ] **Step 4:** `cargo test --lib proof_bytes` → PASS.
- [ ] **Step 5:** commit `feat(prover): proofBytes serializer (pi_a negated, G2 c1-first, BE)`.

---

### Task 2: wire into `deposit_prove` — serialize + round-trip (validation B)

**Files:** `examples/deposit_prove.rs`.

- [ ] **Step 1:** after the existing verify, add:

```rust
let proof_bytes = noctura_prover::proof_bytes::serialize_proof(&proof);
println!("proofBytes (256B): {}", hex::encode(proof_bytes));
let parsed = noctura_prover::proof_bytes::parse_proof(&proof_bytes)?;
let rt = Groth16::<Bn254>::verify_with_processed_vk(&pvk, public_inputs, &parsed)?;
assert!(rt, "round-trip: serialized→parsed proof must still verify");
println!("PASS: proofBytes round-trips + verifies (on-chain layout)");
```
(Add `hex = "0.4"` to Cargo.toml.)

- [ ] **Step 2:** `cargo run --example deposit_prove` → runs, prints the 256B hex, round-trip PASS.
- [ ] **Step 3:** commit `feat(prover): deposit_prove emits + round-trips on-chain proofBytes`.

---

### Task 3: `onchain_format_check` — validation (A) against a hosted reference

**Files:** `examples/onchain_format_check.rs` (new); `.gitignore` already covers `artifacts/`.

- [ ] **Step 1: fetch a reference** (bash; the hosted prover accepts our test input):

```bash
curl -s -X POST https://api.noc-tura.io/api/v1/zk/prove \
  -H 'content-type: application/json' \
  -d "{\"proofType\":\"deposit\",\"params\":$(cat artifacts/deposit_input.json)}" \
  > artifacts/deposit_reference.json
# sanity: jq '.proofBytes | length, .publicInputs' artifacts/deposit_reference.json  (expect 512 hex chars)
```

If the endpoint rejects the raw input shape, adjust `params` to match `proveShielded`'s body (proofType + params object). Record the exact request that worked.

- [ ] **Step 2: implement** `onchain_format_check.rs`: read `artifacts/deposit_reference.json` → decode `proofBytes` hex (256 B) → `parse_proof` → read `publicInputs` (decimal) → `Fr` → read the VK from `artifacts/deposit_final.zkey` (`read_zkey`) → `Groth16::<Bn254>::verify(vk, &public_inputs, &parsed)`. Assert `true`.

- [ ] **Step 3:** `cargo run --example onchain_format_check`.
  - **PASS** → our layout matches the on-chain-accepted format (BE + G2 c1-first + A-negated all confirmed). **Task 0.4 desktop-validated.**
  - **FAIL** → layout mismatch. Diagnose systematically: try G2 c0-first; try A not-negated (or C negated); try little-endian. Exactly one combination verifies — that is the true format; reconcile against the c2-contract note and fix `parse_proof`/`serialize_proof` together.

- [ ] **Step 4:** update `STATUS.md` (Task 0.4 = desktop-validated), commit `feat(prover): validate on-chain proofBytes layout vs hosted reference`.

---

## Self-Review

- **Spec coverage:** serializer (pi_a negated / G2 c1-first / BE) → Task 1; round-trip (B) → Task 2; hosted-reference (A) → Task 3; Stage 2 (C) → out of scope (on-device). All mapped.
- **Placeholder scan:** the curl request may need shape-tweaking (flagged, with "record what worked"); the FAIL branch enumerates the concrete fallback combinations — not a hand-wave. No TODO/TBD.
- **Type consistency:** `serialize_proof(&Proof<Bn254>)->[u8;256]`, `parse_proof(&[u8;256])->Result<Proof<Bn254>>`, `g1_be(&G1Affine,bool)->[u8;64]`, `g2_be_c1first(&G2Affine)->[u8;128]` — consistent across tasks; `Fq`/`Fq2` from `ark_bn254`.

## Not in this plan

- Other circuits (same serializer), Stage 1/2 (UniFFI/Android, on-device submit).
