# Shielded seed-recovery: on-chain note memo for deposit + withdraw_change

**Date:** 2026-07-13
**Status:** Design approved, spec under review
**Mainnet blocker addressed:** #1-adjacent — seed-recoverable notes (see `project_shielded_mainnet_blockers`)

## Problem

A wallet restored from its mnemonic on a fresh device must recover **all** shielded
balances and be able to spend them. Today only *transfer* outputs meet that bar;
*deposit* and *withdraw-change* notes do not.

Recovery works via `scanIncomingNotes` (`noteScan.ts`): it walks pool history, trial-
decrypts each on-chain `NoteCiphertext` event with the seed-derived view key
(`skView`), recomputes the note commitment, verifies it against the on-chain leaf,
and stores the note (including its `noteSecret`, read from the decrypted memo).

- **Transfer notes** — `transferFlow` emits `ct0`/`ct1` (`encryptNote(viewKeyG1, amount,
  noteSecret)`), so scan recovers them. ✅
- **Deposit notes** — `buildDepositIx` has **no** ciphertext field; `noteSecret` is
  `randomFieldElement()` stored only in local encrypted MMKV. ❌
- **Withdraw-change notes** — `buildWithdrawWithChangeIx` has **no** ciphertext field;
  `changeNoteSecret` is random + local. ❌

Consequence: after an app wipe / reinstall / new device, un-transferred deposits and
partial-withdraw change are **unrecoverable and unspendable** — the `noteSecret`
needed to compute the nullifier is gone. This is a fund-loss hazard for mainnet.

### Why not a wallet-only deterministic derivation

Deriving `noteSecret = KDF(seed, i)` makes deposits recoverable (deposit amounts are
transparent on-chain), but **withdraw-change amounts are not on-chain** (the change
amount is hidden inside `changeCommitment`). Recovering change would require
reconstructing the whole spend graph — fragile. The memo approach (below) recovers
every note independently of the spend graph, exactly as transfers already do.

## Approach — mirror the transfer memo

Deposit and withdraw_change each emit an on-chain `NoteCiphertext` carrying the new
note's `(amount, noteSecret)`, encrypted to the wallet's **own** view key. This
reuses the existing, tested encryption (`encryptNote`) and recovery (`scanIncomingNotes`)
paths verbatim. `noteSecret` stays random; recoverability comes from the memo.

`encryptNote(viewKeyG1, amount, noteSecret)` → 128 B ciphertext:
`R(48) + nonce(24) + sealed(56)`, where payload = `amount(8 LE) + noteSecret(32 BE) = 40`,
sealed = payload + Poly1305 tag(16). XChaCha20-Poly1305 over an ECIES/BLS12-381 G1
shared secret. (Unchanged; see `noteEncryption.ts`.)

Recipient for both new memos is **self**: `getViewPublicKey(seed)` (same key
`transferFlow` uses for the `ct1` self-change memo).

## Components & interfaces

| Unit | Change | Depends on |
|---|---|---|
| `poolInstructions.ts` `buildDepositIx` | Append `u32le(len) + ciphertext(128)` to ix data; add `ciphertext: Uint8Array` param; 128-byte length guard | existing `u32le`, transfer pattern |
| `poolInstructions.ts` `buildWithdrawWithChangeIx` | Same append + param + guard | — |
| `depositFlow.ts` `depositShield` | `const ct = encryptNote(getViewPublicKey(seed), amount, note.noteSecret)`; pass to `buildDepositIx` | `encryptNote`, `getViewPublicKey` |
| `withdrawFlow.ts` `unshieldWithChange` | `const ct = encryptNote(getViewPublicKey(seed), w.changeAmount, changeNoteSecret)`; pass to `buildWithdrawWithChangeIx` | `encryptNote`, `getViewPublicKey` |
| `noteScan.ts` | **No change.** Deposit/withdraw-change txs now emit both a `Deposit`/`LeafInserted` event (leaf→commitment, via `parseDepositEvents`) and a `NoteCiphertext` event; scan pairs them by `leafIndex` exactly as today. | — |

Note on the change amount: `withdrawFlow` derives `changeNoteSecret` locally, and
`buildWithdrawChangeWitness` returns `w.changeAmount` (`= note.amount - withdrawAmount`).
The memo encrypts `(w.changeAmount, changeNoteSecret)` — the same `(amount, noteSecret)`
pair the change commitment binds. Verified at scan time by the commitment recompute+match.

## Ix byte layout — the ICO contract (frozen)

Both instructions keep their current layout and **append** the memo, mirroring
transfer's `... proof, u32le+ct0, u32le+ct1`:

- **`deposit`**:
  `disc(8) + amount(u64 LE) + commitment(32) + u32le(256) + proof(256)`
  **`+ u32le(128) + ciphertext(128)`**  ← new
- **`withdraw_with_change`**:
  `disc(8) + merkle_root(32) + nullifier(32) + amount(u64 LE) + change_commitment(32) + u32le(256) + proof(256)`
  **`+ u32le(128) + ciphertext(128)`**  ← new

Both emit the existing `NoteCiphertext { leaf_index: u64, ciphertext: [u8; 128] }`
event (transfer already defines/emits it). The wallet delivers a golden vector
(`{ixParams, expectedIxDataHex, accountMetas}`) for byte-parity, as done for transfer.

### What ICO must do (light lift)

The memo is **not** a circuit input (like transfer's ciphertexts, it is emitted
alongside, not bound in public inputs), so **the circuits and verifying keys are
unchanged — no circom rebuild, no trusted-setup impact.** ICO only:

1. Add `ciphertext: [u8; 128]` argument to the `deposit` and `withdraw_with_change`
   instructions (length-checked).
2. Emit `NoteCiphertext { leaf_index, ciphertext }` in both (reuse the transfer event).
3. Redeploy the pool program (devnet first, per parity gate).

Ciphertext is **required** (fail-closed) once deployed — no optional field, clean
mainnet design.

## Error handling & security

- **Length guards:** ix builders reject any ciphertext ≠ 128 B (matches transfer).
- **Spoof resistance:** unchanged — scan recomputes the commitment from the decrypted
  `(amount, noteSecret)` and requires it to equal the on-chain leaf commitment before
  storing; a garbage/hostile ciphertext that decrypts to nonsense is dropped.
- **No new privacy leak:** the deposit memo is encrypted to the depositor's own view
  key; the depositor is already transparent on-chain (deposits are public), so the
  memo reveals nothing new. The withdraw-change memo hides the change amount that the
  transparent withdraw already keeps hidden.
- **Zeroization:** `noteSecret` handling in the flows is unchanged; the memo is built
  from the same in-scope values already present, adding no new long-lived secret.

## Scope / non-goals

- **No migration.** Existing devnet deposit/withdraw-change notes (pre-memo) remain
  recoverable only from local MMKV on the current device. Devnet is disposable; this is
  documented, not silently dropped. All notes created after the deployed change are
  fully seed-recoverable.
- **Full withdraw** (no change) creates no note → nothing to recover; untouched.
- **noteSecret stays random.** No deterministic-derivation scheme is introduced.
- **No scan changes.** If a future audit wants deposit/change memos distinguished from
  transfer memos, that is out of scope — recovery is uniform by design.

## Testing (TDD, program mocked)

1. `buildDepositIx` / `buildWithdrawWithChangeIx`: byte-exact data encoding incl. the
   appended `u32le(128)+ct`; reject non-128 ciphertext. Golden-vector asserted.
2. `depositShield` / `unshieldWithChange`: emit a memo encrypted to `getViewPublicKey(seed)`
   carrying the correct `(amount, noteSecret)`.
3. Round-trip recovery: `encryptNote` → synthesize a `Deposit` + `NoteCiphertext` log
   pair → `scanIncomingNotes` recovers the note with the right amount, noteSecret,
   leaf index, and commitment match. (Reuses existing `noteScan.test.ts` harness.)
4. Full suite + `tsc --noEmit` green.

## Deliverables

- Wallet PR: ix builders + deposit/withdraw flows + tests (this repo).
- ICO contract spec (separate doc): the frozen layout above + golden vector, handed to
  ICO Claude to implement in `noc-presale` / the pool program.
