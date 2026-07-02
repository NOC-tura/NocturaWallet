# Design — Wallet partial unshield (change-output withdraw)

**Date:** 2026-07-02
**Status:** Approved (brainstorm complete) — pending spec review → writing-plans. Build EXECUTION waits on the ICO devnet deploy (final params).
**Scope:** Wallet-side. Replace whole-note unshield with **partial unshield**: the user enters an arbitrary amount `W`, the wallet spends one input note of value `V ≥ W`, withdraws `W` to the transparent ATA, and reinserts the remainder `V − W` as a **self-change note** (same owner, stored locally). Enables `shield 5 → unshield 2 → 3 stays shielded`.

**Lineage:** builds directly on the merged whole-note withdraw (PR #48) and reuses ~90% of it. Locked by the cross-Claude contract in `docs/contracts/2026-07-02-change-output-withdraw-contract.md` and the ICO spec `2026-07-02-withdraw-with-change-design.md`. The deployed devnet program (id `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES`, unchanged) gains an in-place upgrade adding `withdraw_with_change` + a `["wchange_vk", pool]` VK account; `Deposit` event is renamed `LeafInserted` (byte-identical 80-B layout).

**Design source of truth (UI):** the existing #16 ShieldUnshield "Make public" + #18 ZkProof layouts in `/home/user/Downloads/index.html` — this feeds real partial-withdraw behavior into that layout; it does not redesign it.

## Contract (from the ratified cross-Claude spec)

- `withdraw_with_change(merkle_root:[u8;32], nullifier:[u8;32], amount:u64, change_commitment:[u8;32], proof_bytes:Vec<u8>)`.
- Accounts = existing `WithdrawCtx` (pool ro, merkle_tree mut, vault mut, destination_token_account mut, nullifier_record init `["nullifier", nullifier]`, fee_payer signer+mut, token_program, system_program) **+ `wchange_vk` (read, PDA `["wchange_vk", pool]`)**. Exact position of `wchange_vk` in the account list is confirmed against the ICO's final `WithdrawWithChangeCtx` at deploy sync (assumed appended last until confirmed).
- Public inputs (6, fixed order): `[merkleRoot, nullifier, u64_to_be32(withdrawAmount), recipientField, mintHash, changeCommitment]`.
- Circuit constraints: input commitment membership at `leafIndex`; `nullifier = poseidon3(0x02, noteSecret, leafIndex)`; **`inputAmount === withdrawAmount + changeAmount`** (all u64, range-checked); `changeCommitment = poseidon5(0x01, pkRecipientHash, changeAmount, mintHash, changeNoteSecret)` (same owner + mint).
- The change note's `leaf_index` is NOT in the commitment; the wallet reads it from the `LeafInserted` event of its own tx.
- `/zk/prove` proofType `withdraw_change`; params add `changeCommitment, changeAmount, changeNoteSecret` (+ `inputAmount`); returns `publicInputs` in the 6-order.
- Every leaf insertion (deposit OR change) emits `LeafInserted { commitment, leaf_index, root }` (80 B, same layout as the old `Deposit`). The wallet's length-based leaf scanner handles this transparently across the upgrade boundary — no scanner change.

## Decided (brainstorm)

- **Input-note selection = best-fit:** pick the SMALLEST unspent note with `amount ≥ W` (minimizes change, preserves large notes). If no single note `≥ W`, reject with a clear message.
- **Amount bound (1-input circuit):** MAX = the user's LARGEST single note; valid `W ≤ largest note`. Validation compares `W` against the largest note (NOT the vault sum). If `W` exceeds it: "Max per unshield: `<largest>` — your largest shielded note. Larger amounts need multiple unshields." (Multi-input aggregation is a future circuit, out of scope.)
- **Success screen shows dig + change:** "Unshielded `W` `SYM` → transparent" + a smaller "Kept private: `V−W` `SYM`" line (omit the kept-private line when `changeAmount == 0`).
- **Zero-value change note:** when `W == V` (full withdrawal), the on-chain change leaf is still inserted (uniformity), but the wallet does NOT store the junk 0-note locally.
- **All unshields route through `withdraw_with_change`** (whole-note = `changeAmount == 0`); the plain `withdraw` ix is never called.

## Components

### Reused unchanged (PR #48)
`fieldCodec`, `depositEvents` (+ `parseDepositLeafIndex`-style event parse), `merkleSync` (`syncLeaves`, `parseRootHistory`), `computeMerklePath`, `noteCrypto` (`nullifier`, `mintHash`, `recipientField`, `noteCommitment`, `randomFieldElement`), `shieldedIdentity` (`getPkRecipientHash`), `noteStore` (`getNotes`, `addNote`, `markSpentByIndex`, `getBalance`), `poolTx` (`submitPoolTxMany`), transactionBuilder ATA helpers. The deposit path is untouched (rename is transparent).

### 1. `poolPdas.ts` (extend)
Add `wchangeVkPda(pool: PublicKey): PublicKey` = `findProgramAddressSync(["wchange_vk", pool], PROGRAM)`.

### 2. `withdrawChangeWitness.ts` (new)
`buildWithdrawChangeWitness({seed, note, withdrawAmount, changeNoteSecret, destTokenAccount, leaves})` →
`{ params: ShieldedProveParams; nullifier32; merkleRoot32; changeCommitment32; changeCommitmentDec; changeAmount }`.
- `changeAmount = note.amount − withdrawAmount` (asserts `0 ≤ withdrawAmount ≤ note.amount`).
- `changeCommitment = noteCommitment({pkRecipientHash, amount: changeAmount, mintHash, noteSecret: changeNoteSecret})` (reuses the existing commitment primitive; SAME owner `pkRecipientHash`).
- `params` (decimal strings, circuit signal names): `merkleRoot, nullifier, withdrawAmount, recipientField, mintHash, noteSecret, pkRecipientHash, inputAmount(=note.amount), leafIndex(=note.index), merklePath[20], merklePathIndices[20], changeNoteSecret, changeAmount`.
- Returns `changeCommitment32` (BE 32B, ix arg) + `changeCommitmentDec` (to cross-check against the prover's `publicInputs[5]`).

### 3. `poolInstructions.ts` (extend)
`buildWithdrawWithChangeIx(p)` — `p` = `buildWithdrawIx` params + `changeCommitment: Uint8Array(32)` + `wchangeVk: PublicKey`.
Data = `disc("global:withdraw_with_change") + merkle_root(32) + nullifier(32) + amount(u64 LE) + change_commitment(32) + u32le(proof.len) + proof`.
Accounts = the 8 `WithdrawCtx` accounts (same order as `buildWithdrawIx`) **+ `wchangeVk` (ro)** appended (position confirmed at deploy sync).

### 4. `withdrawFlow.ts` (extend) — `unshieldWithChange`
`unshieldWithChange(seed, feePayer, mint, note, withdrawAmount): Promise<{txSignature; withdrawn: bigint; change: bigint}>`:
1. `ensureSecureMmkv(seed)`; `destTokenAccount = findAssociatedTokenAddress(feePayer.publicKey, mint)`.
2. `{leaves, onChainRoots} = syncLeaves(mint)`.
3. `changeNoteSecret = randomFieldElement()`.
4. `witness = buildWithdrawChangeWitness({...})`.
5. Assert local `merkleRoot32` ∈ `onChainRoots` (else `MerkleRootStaleError`).
6. `proof = proveShielded('withdraw_change', witness.params)`; assert `proof.publicInputs[5] === witness.changeCommitmentDec` (else abort — prover used wrong inputs); `proofBytes` len 256.
7. `ix = buildWithdrawWithChangeIx({..., changeCommitment: witness.changeCommitment32, wchangeVk: wchangeVkPda(pool)})`; `createAtaIdempotent`; `submitPoolTxMany([createAtaIx, ix], SHIELDED_CU.withdrawChange, feePayer)`.
8. Poll `getTransaction` (fail-closed on null, as #48); revert check.
9. `markSpentByIndex(mint, note.index)`. If `changeAmount > 0`: parse the change leaf's `leaf_index` from the tx's `LeafInserted` event (reuse the length-based event parse) and `addNote({commitment: changeCommitmentDec, nullifier:'', mint, amount: changeAmount, index: changeLeafIndex, spent:false, createdAt: now, noteSecret: changeNoteSecret})`.
10. Return `{txSignature, withdrawn: withdrawAmount, change: changeAmount}`.

`SHIELDED_CU.withdrawChange` (new constant, `constants/programs.ts`) — set from the ICO's measured CU (est. ~200–220k; default 250k until measured).

### 5. `zkProver/zkProverModule.ts` (extend)
`proveShielded(proofType: 'deposit' | 'withdraw' | 'withdraw_change', params)`.

### 6. `noteStore.ts`
Add `largestNote(mint): bigint` (0n if none) + reuse `getNotes` for best-fit selection. Best-fit helper `selectInputNote(mint, W): ShieldedNote | null` (smallest note with `amount ≥ W`) lives in `withdrawFlow` or a small `noteSelect.ts`.

### 7. `ShieldUnshieldScreen.tsx` (change)
"Make public": arbitrary amount; MAX fills the LARGEST note's exact value (`formatTokenAmount`); validation `W ≤ largest note` (message on exceed); pass `{direction:'public', amount: rawW, mint}` (unchanged nav shape — W is arbitrary now, not a whole note).

### 8. `ZkProofScreen.tsx` (change)
`direction==='public'` → select the best-fit input note for `W` (error if none `≥ W`), run `unshieldWithChange(seed, feePayer, mint, note, W)`. Success screen: "Unshielded `W` `SYM`" + "Kept private: `change` `SYM`" (hidden when change 0). Zeroize seed on all paths.

## Data flow

user enters W → best-fit input note (V ≥ W) → merkleSync (RPC, incl. change leaves) → path for input note → witness (change = V−W, changeCommitment) → prove(withdraw_change) → withdraw_with_change tx (create-ATA + ix) → confirm → mark input spent + store change note (leaf_index from LeafInserted) → dashboard: transparent += W, shielded balance = old − W (change note preserves V−W).

## Error handling

- No single note ≥ W → reject before proving ("Max per unshield: `<largest>`").
- Stale root (local root ∉ 64-ring) → `MerkleRootStaleError`, resync/retry, no spend.
- Prover changeCommitment mismatch (`publicInputs[5]` ≠ local) → abort, no tx.
- Null/failed getTransaction → fail closed (note stays unspent, no change note stored).
- Double-spend of the input note → on-chain nullifier `init` "already in use" → surfaced.
- Change note stored ONLY after a confirmed, non-reverted tx (atomic with markSpent — both after confirmation).

## Testing

- **Unit:** `buildWithdrawChangeWitness` (value split `inputAmount == withdrawAmount + changeAmount`; changeCommitment = poseidon5 parity; 6-order params; change-0 case); `buildWithdrawWithChangeIx` (disc `global:withdraw_with_change`, data layout incl. `change_commitment`, account order incl. `wchange_vk`); `wchangeVkPda` derivation; best-fit `selectInputNote` (smallest ≥ W, null when none); `unshieldWithChange` (mocked: stores change note by event leaf_index, skips 0-note, marks input spent only after confirm, aborts on changeCommitment mismatch); ShieldUnshield MAX = largest note + W ≤ largest validation.
- **On-device (devnet, after ICO deploy):** shield 0.5 (one note) → unshield 0.2 → transparent += 0.2, dashboard shows a 0.3 shielded change note, then unshield the 0.3 change note (proves it's spendable) → transparent += 0.3, shielded → 0; double-spend of a spent note rejected.

## Out of scope / deferred

- Multi-input aggregation (unshield more than one note's value in a single tx) — needs a multi-input circuit.
- On-chain change-note encryption/scanning (Project 2 / transfers).
- Local on-device proving (mainnet blocker; hosted prover still receives secrets — POC).
- Mainnet VK immutability/ceremony/audit.
- Removing the deprecated plain `withdraw` ix from the wallet (already unused).

## Sync points with the ICO (before EXECUTION)

Confirm at their devnet deploy: final `WithdrawWithChangeCtx` account order (position of `wchange_vk`), the exact `proofType` string (`withdraw_change`), the measured CU for `SHIELDED_CU.withdrawChange`, and that `/zk/prove` returns `publicInputs[5] = changeCommitment`. The plan is written to these assumptions; only these literals are adjusted on sync.
