# proofBytes on-chain serialization — design (M1 Task 0.4)

**Date:** 2026-07-17
**Status:** Design approved, spec under review
**Context:** M1 Stage 0 is complete ([[project_m1_prover_spike]]) — the wasmi prover produces an arkworks `Proof<Bn254>` that verifies against the deployed VK. This task serializes that proof to the exact 256-byte layout the devnet program `NPkc…HfES` consumes, and validates it on the desktop.

## The frozen on-chain format (from [[project_shielded_c2_contract]])

> proof bytes = zk-convert: **pi_a negated, G2 c1-first, big-endian**.

256 bytes = `A(64) + B(128) + C(64)`, each field element a 32-byte **big-endian** integer:
- **A** = `-proof.a` (G1 negated: `(x, p-y)`), written `x ‖ y` → 64 B.
- **B** = `proof.b` (G2), written `x.c1 ‖ x.c0 ‖ y.c1 ‖ y.c0` (**c1/imaginary first**, EIP-197 order) → 128 B.
- **C** = `proof.c` (G1, NOT negated), written `x ‖ y` → 64 B.

Only `pi_a` is negated (so the on-chain check is a single pairing product `e(-A,B)·e(α,β)·e(vk_x,γ)·e(C,δ) = 1`).

## Serializer (in `native/noctura-prover/`)

`src/proof_bytes.rs`:
- `serialize_proof(proof: &ark_groth16::Proof<Bn254>) -> [u8; 256]` — implements the layout above. Helpers: `g1_be(p: &G1Affine, negate: bool) -> [u8;64]`, `g2_be_c1first(p: &G2Affine) -> [u8;128]`. Field → 32-byte BE via `f.into_bigint().to_bytes_be()` (left-padded to 32).
- `parse_proof(bytes: &[u8;256]) -> Result<Proof<Bn254>>` — the inverse, **un-negating A** so the result feeds arkworks' standard verify. G1 from BE: `Fq::from_be_bytes_mod_order`; G2 reads c1 then c0 into `Fq2{c0,c1}`. Used only for validation.

## Validation (desktop, self-contained)

**(A) Against an on-chain-accepted reference — the key check.** `POST https://api.noc-tura.io/api/v1/zk/prove {proofType:"deposit", params}` with the test `deposit_input.json` → returns `{proofBytes (hex 256B), publicInputs}`. Those bytes are accepted on-chain, so they ARE the correct format. `parse_proof` them (with our layout, un-negating A) and run `Groth16::<Bn254>::verify(vk, publicInputs→Fr, proof)`. **If it verifies, our layout matches the on-chain format** (BE + G2 c1-first + A-negated all confirmed) — regardless of the proof being a different random one than ours. This is the strongest desktop de-risk.

**(B) Own-proof round-trip.** Serialize our arkworks proof, `parse_proof` it back (un-negate A), verify against the VK == true. Confirms serialize/parse are mutual inverses and our proof survives the format.

**(C) Stage 2** (on-device, later) — submit the native `proofBytes` in a real deposit ix; devnet accept is the ultimate confirmation.

> Note on (A): the test input (incl. `noteSecret`) is a throwaway devnet value we generate, sent to the hosted prover exactly as today's hosted path does — no real funds. Acceptable for a de-risk.

## Components

- `src/proof_bytes.rs` (new): `serialize_proof`, `parse_proof`, helpers. Unit tests: `g1_be`/`g2_be_c1first` lengths + BE-ness; serialize→parse→verify round-trip on the Stage-0 proof.
- `examples/deposit_prove.rs`: after the existing prove+verify, `serialize_proof` → print the 256B hex → round-trip verify (validation B).
- `examples/onchain_format_check.rs` (new): validation (A). To keep the crate HTTP-dep-free, the reference is fetched by a **bash/curl** step (`POST /zk/prove` with `deposit_input.json` → save `{proofBytes, publicInputs}` to `artifacts/deposit_reference.json`, gitignored), and this example READS that fixture, `parse_proof`es the reference bytes, and `Groth16::verify`s them against the VK. Reproducible offline once the fixture exists.

## Non-goals

- Other circuits (same serializer applies; nPublic differs). Stage 1/2 (UniFFI/Android, on-device submit). Optimizing. This task delivers a validated `serialize_proof` + desktop confirmation that the layout matches the deployed program.

## Testing

- Unit: field→32B BE padding; `g1_be` negate flips y to `p-y`; `g2_be_c1first` orders c1 before c0; round-trip `parse(serialize(proof)) == proof` (after A un-negation) and verifies.
- Integration: `deposit_prove` round-trip (B); `onchain_format_check` against a hosted/fixture reference (A).
