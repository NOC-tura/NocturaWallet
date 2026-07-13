# ICO contract spec: seed-recovery memo on `deposit` + `withdraw_with_change`

**Date:** 2026-07-13
**Status:** FROZEN — handoff to ICO Claude
**From:** Wallet Claude
**Pool:** devnet `6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt` (in-place upgrade, id unchanged). Mainnet untouched.
**Precedent:** mirrors the `transfer` ciphertext contract already shipped (see
`docs/contracts/2026-07-07-private-transfer-project2-contract.md` and
`~/Downloads/transfer-golden.json`).

## Problem this closes

A wallet restored from its mnemonic on a fresh device must recover **all** shielded
balances. Today only `transfer` outputs emit an on-chain `NoteCiphertext` memo, so
only transfer notes are seed-recoverable. `deposit` and `withdraw_with_change` notes
have no on-chain memo — their `noteSecret` lives only in local encrypted MMKV, so an
app wipe / reinstall / new device makes those notes **unrecoverable and unspendable**.
This is a fund-loss hazard the wallet must close before mainnet.

Full design rationale: `docs/superpowers/specs/2026-07-13-shielded-seed-recovery-memo-design.md`.

## What changes (light lift)

Both `deposit` and `withdraw_with_change` gain a trailing **required**
`ciphertext: [u8; 128]` argument, Borsh-encoded as `u32le(len) + bytes` (Vec<u8>
encoding, matching how `proof_bytes` and transfer's `ciphertext_0`/`ciphertext_1` are
already encoded). **`len` must equal 128 — reject any other length (fail-closed, no
optional field).** The argument is appended **AFTER** `proof_bytes`, matching
transfer's `..., proof_bytes, ciphertext_0, ciphertext_1` append pattern.

Both instructions must emit the **existing** `NoteCiphertext { leaf_index: u64,
ciphertext: [u8; 128] }` event (already defined and emitted by `transfer` — reuse it
verbatim, do not define a new event type) carrying the new note's leaf index.

**The memo is NOT a circuit input.** Exactly like transfer's ciphertexts, it is
emitted alongside the instruction, never bound into a public input. Consequence:
**the deposit and withdraw_with_change circuits and their verifying keys are
unchanged. No circom rebuild. No trusted-setup impact.** ICO's only work is:

1. Add the `ciphertext: [u8; 128]` argument to both instructions (length-checked,
   reject ≠ 128 bytes).
2. Emit `NoteCiphertext { leaf_index, ciphertext }` in both (reuse the transfer
   event type/discriminator).
3. Redeploy the pool program to devnet first, per the existing parity gate.

## Exact byte layouts (frozen)

Copied verbatim from the design spec's `Ix byte layout` section — this is the
contract; changing field order or sizes breaks the wallet's byte-exact builders.

### `deposit` — 440 bytes total

```
disc(8) + amount(u64 LE, 8) + commitment([u8;32], 32)
  + u32le(256) + proof_bytes(256)
  + u32le(128) + ciphertext(128)     ← NEW
```

`8 + 8 + 32 + 4 + 256 + 4 + 128 = 440`. The new `u32le(128)` length prefix sits at
byte offset **308** (immediately after `proof_bytes` ends at 8+8+32+4+256=308); the
ciphertext bytes occupy **312..440**.

Accounts (`DepositCtx`, unchanged order): `pool`(ro), `merkle_tree`(mut),
`vault`(mut), `depositor`(signer), `depositor_token_account`(mut),
`token_program`(ro).

### `withdraw_with_change` — 504 bytes total

```
disc(8) + merkle_root([u8;32], 32) + nullifier([u8;32], 32)
  + amount(u64 LE, 8) + change_commitment([u8;32], 32)
  + u32le(256) + proof_bytes(256)
  + u32le(128) + ciphertext(128)     ← NEW
```

`8 + 32 + 32 + 8 + 32 + 4 + 256 + 4 + 128 = 504`. The new `u32le(128)` length prefix
sits at byte offset **372** (8+32+32+8+32+4+256=372); the ciphertext bytes occupy
**376..504**.

**Account order — wallet's current understanding, NOT frozen; ICO must verify against
the deployed IDL.** Appending the memo argument to instruction *data* does not change
account order or count — that part is not in question. What is **not** independently
confirmed by this contract is the exact `WithdrawWithChangeCtx` account list itself:
the wallet's `buildWithdrawWithChangeIx` (`poolInstructions.ts`) currently constructs
it as the 8 `WithdrawCtx` accounts — `pool`(ro), `merkle_tree`(mut), `vault`(mut),
`destination_token_account`(mut), `nullifier_record`(mut, init), `fee_payer`(signer,
mut), `token_program`(ro), `system_program`(ro) — with `wchange_vk`(ro) inserted
**between `fee_payer` and `token_program`** (not appended last). This reflects the
wallet's best current understanding of the deployed program, but **ICO must verify
the full account order — especially the `wchange_vk` position — and every
signer/writable flag against their deployed `WithdrawWithChangeCtx` / IDL before
relying on it.** If the deployed order differs, the wallet's instruction builder must
be updated to match; do not assume the list above is authoritative.

The **byte layout of the instruction data** above (the `disc + ... + ciphertext`
sequence and offsets) is unaffected by this caveat and remains frozen — only the
account-metas certainty is being hedged.

## Note-ciphertext content (wallet-canonical, unchanged scheme)

The wallet encrypts to **its own** view key (self-recipient), reusing the existing
`encryptNote` / `NoteCiphertext` scheme verbatim — no new crypto:

- `deposit`: `ciphertext = encryptNote(getViewPublicKey(seed), amount, note.noteSecret)`
  — recovers the deposited note.
- `withdraw_with_change`: `ciphertext = encryptNote(getViewPublicKey(seed),
  w.changeAmount, changeNoteSecret)` — recovers the change note. `w.changeAmount =
  note.amount - withdrawAmount`, the same `(amount, noteSecret)` pair the
  `change_commitment` binds; scan-time commitment recompute + match is the spoof
  check (see design spec §"Error handling & security").

Ciphertext bytes: `R(48) ‖ nonce(24) ‖ AEAD_ct(40) ‖ tag(16) = 128 B`
(XChaCha20-Poly1305 over BLS12-381 G1 ECIES; unchanged, see
`docs/superpowers/specs/2026-07-07-note-encryption-design.md`). The program treats
the 128 bytes as opaque — it never decrypts, only carries and emits them.

## Byte-parity golden vector

Golden vector generated from the real wallet builders (`buildDepositIx` /
`buildWithdrawWithChangeIx` in `src/modules/shielded/poolInstructions.ts`), handed to
ICO Claude at:

**`~/Downloads/deposit-withdrawchange-memo-golden.json`**

(same precedent as `~/Downloads/transfer-golden.json` for the transfer ix). It
contains, for each of `deposit` and `withdraw_with_change`: the input params (amount
as a decimal string, all byte fields as hex, account pubkeys base58), the resulting
`expectedIxDataHex` (fixed-filler ciphertext — `0xcd` repeated for deposit, `0xee`
repeated for withdraw_with_change; the memo bytes are opaque to the program, so a
fixed filler is sufficient for byte-parity), and the ordered `accountMetas` list with
signer/writable flags.

Confirmed lengths: `deposit.expectedIxDataHex` = 880 hex chars (440 bytes);
`withdraw_with_change.expectedIxDataHex` = 1008 hex chars (504 bytes). ICO's
Anchor-side instruction encoder must reproduce these hex strings byte-for-byte given
the same params — that is the acceptance test for this contract, exactly as the
transfer golden vector gated the transfer ix.

## Error handling & security (unchanged from design spec)

- **Length guard:** reject any ciphertext argument ≠ 128 bytes (program-side,
  matching the wallet's client-side guard in `buildDepositIx` /
  `buildWithdrawWithChangeIx`).
- **Ciphertext required, fail-closed:** no optional field, no legacy no-memo code
  path once deployed. Every deposit / withdraw_with_change after this change carries
  a memo.
- **No new privacy leak:** the deposit memo is encrypted to the depositor's own view
  key, and the depositor is already transparent on-chain (deposits are public), so it
  reveals nothing new. The withdraw-change memo hides the change amount that the
  transparent `withdraw_with_change` instruction already keeps hidden (only
  `change_commitment` is public).
- **Spoof resistance:** unchanged — wallet-side `scanIncomingNotes` recomputes the
  note commitment from the decrypted `(amount, noteSecret)` and requires it to equal
  the on-chain leaf commitment before storing; a garbage ciphertext that decrypts to
  nonsense is simply dropped by the wallet. The program does not need to validate
  ciphertext content, only length.

## Scope / non-goals

- **No migration.** Pre-existing devnet deposit / withdraw-change notes created
  before this change remain recoverable only from local MMKV on the device that
  created them. Devnet is disposable; this is a documented, deliberate omission, not
  a silently dropped requirement.
- **Full withdraw** (no change output) creates no note — nothing to recover; that
  instruction is untouched by this contract.
- **`noteSecret` stays random.** No deterministic-derivation scheme is introduced;
  recoverability comes entirely from the on-chain memo, exactly as it already does
  for `transfer`.
- **No wallet-side scan changes.** `noteScan.ts` / `scanIncomingNotes` require no
  changes: deposit / withdraw_with_change transactions already emit a
  `Deposit`/`LeafInserted` event (leaf → commitment) that scan pairs by `leaf_index`
  with the new `NoteCiphertext` event, exactly as it already does for transfer
  outputs.

## Deliverables

- **Wallet (this repo, DONE):** `buildDepositIx` / `buildWithdrawWithChangeIx`
  append the ciphertext memo (Tasks 1–2); `depositShield` / `unshieldWithChange` emit
  it, encrypted to the wallet's own view key (Tasks 3–4); golden vector (Task 5, this
  doc).
- **ICO (pending):** add the `ciphertext: [u8; 128]` argument + length guard to both
  instructions, emit the existing `NoteCiphertext` event in both, redeploy to devnet,
  byte-match the golden vector above.
