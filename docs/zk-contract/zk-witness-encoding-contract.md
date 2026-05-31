# Noctura ZK Witness Encoding Contract (v1)

**Status:** Wallet-canonical (client = spec). Circuit, backend prover, relayer, and
local prover MUST conform. Golden vectors in `./golden-vectors.json` are binding.

Source of truth in code: `src/modules/shielded/noteCrypto.ts`. The golden-vector test
(`src/modules/shielded/__tests__/noteCrypto.golden.test.ts`) regenerates this contract's
fixtures (`GENERATE=1`) and otherwise asserts the code reproduces them — drift fails CI.

## Field & encoding
- Curve/field: BN254 scalar field `F` (Poseidon via `poseidon-lite ^0.3.0`,
  circomlib-compatible, x^5 S-box).
- Byte->field: **big-endian**, range-checked `< F` (except `mintHash`, which reduces).
- Serialization in golden vectors: field elements as decimal strings; byte arrays as
  lowercase hex.

## Domain separators (first Poseidon input)
| Tag | Use |
|-----|-----|
| 0x01 | note commitment |
| 0x02 | nullifier |
| 0x05 | pk_recipient hash |
| (none) | Merkle node: `poseidon2(left, right)` — untagged |

## Primitives
- `pkRecipientHash = poseidon3(0x05, be(pk[0:24]), be(pk[24:48]))` — 48-byte BLS12-381 G1 compressed, 24/24 split.
- `mintHash = be(mint[0:32]) mod F` — plain reduction, no Poseidon.
- `noteCommitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)` — amount in lamports.
- `nullifier = poseidon3(0x02, noteSecret, leafIndex)`.
- Merkle: `poseidon2`, depth 20, `ZERO_LEAF = 0`.

## API contract (server routes)
The wallet's `API_BASE` env value ALREADY includes the `/v1` version prefix
(e.g. `https://api.noc-tura.io/v1`). The client therefore appends bare resource paths.
Full server routes the backend must serve:

| Full route | Method | Body -> Response |
|-----------|--------|------------------|
| `/v1/zk/prove` | POST | `{proofType, params}` (params = witness with `noteSecret` stripped) -> `{success, proofData(base64), publicInputs, error}` |
| `/v1/relayer/submit` | POST | `ZKProof` -> `{txSignature}` |
| `/v1/config/circuit` | GET | -> `{maxInputs, maxOutputs, treeDepth}` |

Client construction: `` `${API_BASE}/zk/prove` `` (since `API_BASE` carries `/v1`).
`params` encoding: `merklePath` = hex strings, `merklePathIndices` = ints, `amount` =
decimal string. `publicInputs` field elements = decimal strings.

> **Known wallet-side inconsistency (separate from this contract):** several modules
> build URLs as `` `${API_BASE}/v1/...` `` which, because `API_BASE` already ends in
> `/v1`, produces a double `/v1/v1/...`. Affected: geoFence, solana/relayer,
> analytics, shielded/shieldedService (config + relayer submit), notifications,
> tokens, appUpdate/versionCheck. This is a latent bug (backend not live yet) and is
> tracked separately — it is NOT part of the encoding contract.

## Ratification checklist (ZK / backend team signs off)
- [ ] Poseidon BN254 params match `poseidon-lite ^0.3.0`.
- [ ] Big-endian byte->field with `< F` range checks.
- [ ] Domain tags 0x01 / 0x02 / 0x05; Merkle nodes untagged.
- [ ] pk 24/24 split -> poseidon3(0x05, pk_hi, pk_lo).
- [ ] mintHash = be(mint) mod F.
- [ ] noteCommitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret).
- [ ] nullifier = poseidon3(0x02, noteSecret, leafIndex).
- [ ] Merkle poseidon2, depth 20, ZERO_LEAF=0.
- [ ] All `golden-vectors.json` entries reproduce exactly.
