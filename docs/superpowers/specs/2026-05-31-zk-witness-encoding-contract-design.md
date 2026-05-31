# ZK Witness Encoding & Prover Contract — Design Spec

**Date:** 2026-05-31
**Status:** Approved for planning
**Author:** Noctura Wallet team
**Topic:** Lock the client-side ZK encoding conventions as the canonical contract so the (forthcoming) backend prover, hosted relayer, and circuit can conform with zero wallet rework.

---

## 1. Context & Motivation

Section III (Phase B, mock-functional shielded UX) is content-complete. Real proof
generation is blocked on three external deliverables:

1. **Backend prover service** — `POST {API_BASE}/v1/zk/prove` (does not exist yet)
2. **Polygen WASM local prover** — `localProver` is the only pure stub (`supported: false`)
3. **Circuit spec** — the root dependency; the backend, the local prover, and the
   client witness construction must all agree on identical field-encoding and Poseidon
   parameters, or every proof is invalid.

None of those are schedulable by the wallet team. This spec covers the high-leverage
work that **is** in the wallet's control and is **platform-independent (pure
TypeScript)** — so it carries to iOS with zero rework and actively *unblocks* the
external teams by handing them a binding contract.

### Source of truth: the wallet defines (client = spec)

There is a documented contradiction:

- `feedback_canonical_field_conventions` memory: *"client code IS the spec for circuits."*
- `docs/NATIVE_INTEGRATION_TODO.md` #1: *"Parametri MORAJO matchat deployed circuit."*

**Resolution: the wallet is canonical.** Rationale (factual, not preference):

1. The shielded circuit is not yet deployed — you cannot match what does not exist.
2. No shielded note format is deployed anywhere; Phase 1 mainnet programs
   (presale/staking/airdrop/referral) are not shielded-pool programs, and the shielded
   program is a separate Phase 2 project (`project_zk_backend_status`). The wallet
   genuinely defines the note format.
3. The client already carries the hardest-to-change, user-facing constraints: 48-byte
   BLS12-381 G1 shielded addresses, bech32m encoding, BN254 field for Poseidon,
   `MERKLE_TREE_DEPTH = 20`, `ZERO_LEAF = 0`. The circuit must conform to these
   regardless.

The one governance hook borrowed from a "hybrid" model: every convention is documented
with its rationale and the standard it follows, and the contract doc ends with a
**ratification checklist** the ZK/backend team signs off on. This protects against
discovering that their proving stack cannot support a chosen Poseidon variant.

**Action:** this spec supersedes `NATIVE_INTEGRATION_TODO.md` #1 — change its framing
from "match the circuit" to "the circuit matches our spec; round-trip verify on deploy."

---

## 2. Scope

### In scope (three deliverable artifacts)

1. **`src/modules/shielded/noteCrypto.ts`** — pure, deterministic source-of-truth
   functions. Imports `BN254_FIELD_PRIME` and `toFieldElement` from `merkleModule`
   (no duplication).
2. **`docs/zk-contract/golden-vectors.json`** — pinned contract fixtures for the
   ZK/backend team.
3. **`docs/zk-contract/zk-witness-encoding-contract.md`** — human-readable contract +
   ratification checklist.

Plus a generator/verifier test (`src/modules/shielded/__tests__/noteCrypto.golden.test.ts`)
and the path-normalization fix in `zkProverModule.ts` (see §5).

### Out of scope (native-blocked)

- `WitnessProvider` orchestration (the production implementation wiring Merkle paths +
  native-derived secrets) stays unimplemented. The `noteCrypto` functions accept secret
  inputs (`noteSecret`) **as parameters**; golden vectors use deterministic **test**
  keys, never real `sk_view`/`sk_spend` material.
- Native BLS `sk_spend` signing, Polygen WASM integration, backend deployment.

---

## 3. Crypto Scheme (canonical encoding)

Built on the existing BN254 layer in `merkleModule.ts` and `poseidon-lite ^0.3.0`
(`poseidon1`…`poseidon16` available).

### 3.1 Shared conversions (explicit)

- All byte → field conversions are **big-endian** → `BigInt`, then range-checked
  `< BN254_FIELD_PRIME` (identical to `toFieldElement`).
- `amount`: lamports as `BigInt` → field element directly (< 2⁶⁴ ≪ F, no reduction).
- `leafIndex`: integer → field element.
- Field elements serialize to **decimal strings** in golden vectors and `publicInputs`;
  raw byte arrays serialize to **lowercase hex** (no `0x` prefix, fixed width).

### 3.2 Domain separators (first input to each Poseidon)

| Tag    | Purpose                                                          |
|--------|-----------------------------------------------------------------|
| `0x01` | note commitment                                                 |
| `0x02` | nullifier                                                       |
| `0x05` | `pk_recipient` hash (inherited from `NATIVE_INTEGRATION_TODO` #1)|
| —      | Merkle node = `poseidon2(left, right)`, **no tag** — already shipped & tested; documented as-is |

### 3.3 Primitives

1. **`pkRecipientHash`** — 48-byte BLS12-381 G1 compressed → 2 fields:
   - `pk_hi = be(bytes[0..24])`, `pk_lo = be(bytes[24..48])` (each 24 bytes < 2¹⁹² < F,
     no reduction needed)
   - `pkRecipientHash = poseidon3(0x05, pk_hi, pk_lo)`

2. **`mintHash`** — 32-byte Solana mint pubkey:
   - `mintHash = be(mint) mod BN254_FIELD_PRIME` (32 bytes may exceed F → reduction
     mandatory). Plain reduction, no Poseidon, per TODO #1.

3. **`noteCommitment`** = `poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)`
   - `noteSecret` is already a field element (derived from `sk_view` in native later;
     test secret in golden vectors).

4. **`nullifier`** = `poseidon3(0x02, noteSecret, leafIndex)`
   - JS-computable from view material → enables scanning / spent-note detection.
   - Spend **authorization** is separate (ZK proof + native BLS `sk_spend` signature);
     the nullifier is only the uniqueness tag bound to the note's tree position.

5. **Merkle** — unchanged. `poseidon2`, `ZERO_LEAF = 0`, depth 20. Documented, not
   re-implemented.

### 3.4 Decisions made (overridable)

- pk split is **24/24** (not 16/32) — symmetric, both halves stay under F without
  reduction.
- `mintHash` is plain reduction, not `poseidon2(0x06, …)` — follows TODO #1.
- nullifier preimage uses `leafIndex` (not `commitment`) — smaller preimage, binds to
  tree position.

---

## 4. Golden Vectors & Generator Test

**Principle: code is the source, JSON is the pinned contract.**

The test (`noteCrypto.golden.test.ts`) has two modes:

- `GENERATE=1` → writes `docs/zk-contract/golden-vectors.json` from `noteCrypto`.
- default → reads the JSON and asserts the code reproduces every entry exactly.

Therefore the JSON cannot silently drift from the code — any change to `noteCrypto`
without regenerating fails CI, which forces a conscious contract bump.

**Format:** array of named cases, each with explicit inputs (hex, stated endianness) and
expected outputs (field elements as decimal strings).

**Coverage:**

- `pkRecipientHash`: BLS12-381 G1 generator point + one pseudo-random pk
- `mintHash`: NOC_MINT (`B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW`) + an edge value > F
- `noteCommitment`, `nullifier`: representative note
- Merkle: two node hashes + one full path → root
- Boundary: `ZERO_LEAF`, field element `F - 1`

---

## 5. API Contract

Documents the actual code paths, with one normalization.

| Endpoint              | Method | Body / response |
|-----------------------|--------|-----------------|
| `/v1/zk/prove`        | POST   | `{proofType, params}` (params = sanitized witness, `noteSecret` stripped) → `HostedProverResponse {success, proofData (base64), publicInputs, error}` |
| `/v1/relayer/submit`  | POST   | `ZKProof` → `{txSignature}` |
| `/v1/config/circuit`  | GET    | → `CircuitConfig {maxInputs, maxOutputs, treeDepth}` |

The contract specifies exact encoding of every field in `params` (merklePath = hex
strings, amount = decimal string, merklePathIndices = ints) and `publicInputs` (field
elements = decimal strings).

**Path normalization:** `zkProverModule.ts` currently posts to `/zk/prove` while the
other two endpoints use `/v1/`. Normalize to **`/v1/zk/prove`**. The backend does not
exist yet, so this is a free, one-line fix that removes the inconsistency permanently.

---

## 6. Findings / Cleanup folded into this work

- **Error-code collision:** `zkProver/types.ts` assigns `ProverUnavailableError.code =
  'E060'` and `ProofGenerationError.code = 'E061'`, but `constants/errors.ts` already
  uses `E060` = BACKUP_FAILED and `E061` = RESTORE_FAILED. The ZK prover errors must get
  dedicated, unique codes (and ideally be registered in `constants/errors.ts`). Fix as
  part of this work.

---

## 7. Testing & Validation

- **Unit:** `noteCrypto` functions — each primitive against hand-computed/known values;
  range-check rejection for inputs ≥ F; endianness assertions.
- **Golden round-trip:** the generator test (default mode) is the contract guard in CI.
- **Cross-check:** `pkRecipientHash` consumes the exact 48 bytes that
  `decodeShieldedAddress` produces — add a test that round-trips a real `noc1…` address
  through decode → `pkRecipientHash`.
- **No native, no network:** every test in this spec is pure and offline.

---

## 8. Ratification Checklist (for ZK / backend team)

The external teams confirm they can implement, identically:

- [ ] Poseidon over BN254 scalar field, parameters matching `poseidon-lite ^0.3.0`
      (circomlib-compatible, x⁵ S-box).
- [ ] Big-endian byte→field conversion with `< F` range checks.
- [ ] Domain separators `0x01` (commitment), `0x02` (nullifier), `0x05` (pk hash);
      Merkle nodes untagged.
- [ ] pk_recipient 24/24 split → `poseidon3(0x05, pk_hi, pk_lo)`.
- [ ] `mintHash = be(mint) mod F` (plain reduction).
- [ ] `noteCommitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)`.
- [ ] `nullifier = poseidon3(0x02, noteSecret, leafIndex)`.
- [ ] Merkle: `poseidon2`, depth 20, `ZERO_LEAF = 0`.
- [ ] All `docs/zk-contract/golden-vectors.json` entries reproduce exactly.

On sign-off, `NATIVE_INTEGRATION_TODO.md` #1 closes its "match circuit" framing.
