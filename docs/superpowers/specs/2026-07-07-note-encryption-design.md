# Design — Note encryption (ECIES over BLS12-381 G1) — Project 2 sub-project A

**Date:** 2026-07-07
**Status:** Approved (brainstorm complete) — pending spec review → writing-plans.
**Scope:** Wallet-side, **self-contained crypto primitive**. One module (`noteEncryption.ts`) that lets a sender encrypt a shielded note's secret payload to a recipient (from the recipient's `noc1…` address) and lets the recipient decrypt it with their `sk_view`, plus committed golden vectors. **This is wallet-canonical** — the on-chain program carries only the opaque 128-byte ciphertext and never encrypts/decrypts.

**Lineage:** the first buildable piece of **Project 2 (private p2p transfer)**, ratified in the cross-Claude contract `docs/contracts/2026-07-07-private-transfer-project2-contract.md` + the ICO program-side spec (transfer 2→2 circuit, `transfer` ix, `NoteCiphertext{leaf_index, ciphertext[128]}` event, `CT_LEN=128`). Sub-project A is **independent of the ICO's devnet deploy** — it can be built + ratified now. Sub-projects B (note scanning) and C (transfer flow + UI) follow once the transfer ix is live.

**Decomposition (recorded):** Project 2 wallet = A (note encryption + golden vectors, THIS spec) + B (scanning subsystem: pull `NoteCiphertext` events, trial-decrypt, store) + C (transfer flow + `ShieldedTransferScreen` to `index.html`). B + C each get their own spec → plan → build after the ICO deploy.

## Why

Project 1 hides holdings; a private transfer must also let the recipient **discover** the note sent to them without any transparent leg. The sender encrypts the note's `{amount, noteSecret}` to the recipient's public view key (already carried by the `noc1…` bech32m address as a 48-byte compressed BLS12-381 G1 point), attaches the ciphertext on-chain (in the `NoteCiphertext` event), and the recipient trial-decrypts every transfer ciphertext while scanning. This module is that encrypt/decrypt primitive.

## Libraries (verified present)

- `@noble/curves` ^2.0.1 — `bls12_381.G1.Point.fromBytes/.multiply/.toBytes`, `.BASE` (G1 ECDH).
- `@noble/hashes` ^2.0.1 — `hkdf` (HKDF-SHA256), `sha256`.
- `@noble/ciphers` ^2.1.1 — `xchacha20poly1305` (24-byte nonce AEAD).
- Randomness: `crypto.getRandomValues` (polyfilled in `index.js`), as `noteCrypto.randomFieldElement` already uses.

## Scheme — ECIES over BLS12-381 G1

The recipient's identity = their compressed 48-byte G1 view key `P = sk_view · BASE` (the `noc1…` address decodes to exactly these 48 bytes via the existing `decodeShieldedAddress`).

### `encryptNote(recipientViewKeyG1: Uint8Array(48), amount: bigint, noteSecret: bigint): Uint8Array(128)`
1. `r` = a uniform ephemeral scalar in the BLS12-381 scalar field (32 random bytes → reduce into `G1.Point.Fn`). `R = BASE.multiply(r)`; `Rbytes = R.toBytes(true)` (48 B compressed).
2. `P = G1.Point.fromBytes(recipientViewKeyG1)`; `S = P.multiply(r)`; `Sbytes = S.toBytes(true)` (48 B compressed).
3. `key = hkdf(sha256, ikm=Sbytes, salt=Rbytes, info=utf8("noctura-note-enc-v1"), 32)` (32 B).
4. `nonce` = 24 random bytes. `payload = u64le(amount)(8) ‖ be32(noteSecret)(32)` (40 B). `sealed = xchacha20poly1305(key, nonce).encrypt(payload)` (= ct 40 B + tag 16 B = 56 B).
5. Return `Rbytes(48) ‖ nonce(24) ‖ sealed(56)` = **128 B**.

### `tryDecryptNote(skView: Uint8Array, ct: Uint8Array(128)): {amount: bigint; noteSecret: bigint} | null`
1. Require `ct.length === 128`. Split `Rbytes = ct[0:48]`, `nonce = ct[48:72]`, `sealed = ct[72:128]`.
2. `R = G1.Point.fromBytes(Rbytes)` (return `null` on an invalid point — a malformed/foreign ciphertext); `sk` = `skView` reduced into `Fn`; `S = R.multiply(sk)`; `Sbytes = S.toBytes(true)`.
3. `key = hkdf(sha256, Sbytes, Rbytes, "noctura-note-enc-v1", 32)`.
4. `payload = xchacha20poly1305(key, nonce).decrypt(sealed)` — on a tag/auth failure (not ours, or tampered) return `null`.
5. Parse `amount` = u64 LE → bigint from `payload[0:8]` (inverse of `u64le`), `noteSecret` = big-endian 32 bytes → bigint from `payload[8:40]` (inverse of `be32`). Return `{amount, noteSecret}`.

**Correctness:** `S_sender = r·P = r·(sk_view·BASE) = sk_view·(r·BASE) = sk_view·R = S_recipient` ⇒ both derive the same `key`. **Downstream:** the recipient recomputes `commitment = poseidon5(0x01, pkRecipientHash(own view key), amount, poolMintHash, noteSecret)` and matches it to a `LeafInserted` at the event's `leaf_index` to confirm a real, spendable note — so no extra binding field is needed in the ciphertext.

**Scalar reduction:** `sk_view` is the EIP-2333 BLS secret (an integer < the BLS12-381 curve order `r_curve`). The ephemeral `r` is sampled as 32 bytes (256 bits) reduced mod `r_curve` (~255 bits) — the modular bias is negligible (~2^-128). Use the curve's scalar-field helper (`G1.Point.Fn.fromBytes` / a mod-order reduction) so both sides agree; the module encapsulates this — callers pass raw bytes.

## Golden vectors

Committed JSON `docs/zk-contract/note-encryption-vectors.json`: a few vectors of `{skViewHex, viewKeyG1Hex, rHex, nonceHex, amount, noteSecretHex, ciphertextHex(128)}`. A test **regenerates** them deterministically (fixed `r` + `nonce` injected via a test-only seam — production always samples randomly) and asserts byte-equality, plus a decrypt round-trip. This makes the scheme auditable + stable (a scheme change must update the vectors, caught by the full test run). Mirrors the discipline of `docs/zk-contract/golden-vectors.json`.

## Data flow

sender: recipient `noc1…` → `decodeShieldedAddress` → 48-B G1 → `encryptNote(amount, noteSecret)` → 128-B ct → passed to the `transfer` ix (`ciphertext_0/1`).
recipient (later, sub-project B): each `NoteCiphertext.ciphertext` → `tryDecryptNote(sk_view, ct)` → `{amount, noteSecret}` on match → recompute commitment vs the `LeafInserted` at `leaf_index` → store as a spendable note.

## Error handling

- `encryptNote`: throw on a wrong-length view key (≠48) or a view key that isn't a valid G1 point (bad recipient address).
- `tryDecryptNote`: NEVER throws on foreign/garbage input — returns `null` for wrong length, invalid `R` point, or AEAD auth failure (this is the trial-decrypt contract; scanning calls it on every ciphertext).
- Secrets (`sk_view`, derived key, payload) are not logged. The derived symmetric `key` and any intermediate `S` bytes are local and short-lived (zeroization is best-effort in JS; documented POC limitation — the deeper secret, `sk_view`, is already JS-resident by the view-key model).

## Testing

- **Unit:** encrypt→decrypt round-trip recovers `{amount, noteSecret}` exactly (incl. edge amounts 0 and 2^64−1, and a max-size noteSecret < F); a DIFFERENT `sk_view` → `null` (trial-decrypt miss); a one-bit tamper of any ct region → `null`; wrong-length ct → `null`; invalid `R` bytes → `null`; `encryptNote` throws on a 47/49-byte or non-point view key; ciphertext is exactly 128 B; the 48/24/56 layout offsets are correct.
- **Golden vectors:** deterministic regeneration (fixed r+nonce) byte-matches the committed JSON; each vector decrypts back to its inputs.
- **Interop with existing keys:** a view key produced by `shieldedIdentity.getViewPublicKey(seed)` encrypts→decrypts with the same seed's `sk_view` (`deriveShieldedViewKey(seed)`), proving the module composes with the real address/identity path.

## Out of scope / deferred (later sub-projects or production)

- Note SCANNING (sub-project B) — pulling `NoteCiphertext` events, iterating `tryDecryptNote`, storing discovered notes, reusing the merkle-sync tx fetch.
- Transfer flow + `ShieldedTransferScreen` UI (sub-project C).
- Zcash-style 1-byte **view tag** to skip most AEAD decrypts (changes `CT_LEN`; the contract locked 128 without it) — a scanning optimization for scale.
- Seed-recoverable note secrets — discovered notes carry the sender's random `noteSecret` (not derivable), so a lost device store loses them; same POC limitation as P1 (production recoverability is a separate, hard problem here).
- Any on-chain validation of the ciphertext (the program treats it as opaque — confirmed with the ICO).
