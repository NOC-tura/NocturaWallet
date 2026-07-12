# Design — Private transfer (send + receive) — Project 2 sub-projects B + C

**Date:** 2026-07-08
**Status:** Approved (brainstorm complete) — pending spec review → writing-plans.
**Scope:** Wallet-side. The two halves of the private p2p transfer feature, built together so the e2e (Ana → Blaž) works in one pass: **C — send** (spend note(s) → recipient output + self-change, all shielded, no transparent leg) and **B — receive** (scan `NoteCiphertext` events, trial-decrypt with `sk_view`, store discovered notes). Builds on the deployed `transfer` instruction (Project 2 program side, live on devnet) + the merged note-encryption primitive (sub-project A).

**Lineage:** ratified contract `docs/contracts/2026-07-07-private-transfer-project2-contract.md` + ICO program-side spec + the live-deploy hand-off. Reuses the whole P1/A stack: `noteEncryption` (encrypt/decrypt), `noteCrypto` (poseidon commitment/nullifier/mintHash/recipientField), `shieldedIdentity` (`getPkRecipientHash`), `computeMerklePath`, `merkleSync` (tx fetch + leaves), `noteStore`, `noteSelect`, `poolPdas`, `poolInstructions` (u64le/u32le/disc), `poolTx` (`submitPoolTxMany`), `signAndSend` (HTTP-polling confirm), `leafResolver`, `zkProverModule` (`proveShielded`, `warmProver`), and the P1 reliability patterns (see `[[project_shielded_onchain_robustness]]`).

## On-chain contract (deployed devnet — ground truth)

- Program `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES` (unchanged). Pool `sgLH…`, merkle_tree `5wUc…`, vault `HFhQ…`, `transfer_vk` `GSzK…` = PDA `["transfer_vk", pool]` (both derivations verified).
- `transfer(merkle_root[32], nullifier_0[32], nullifier_1[32], out_commitment_0[32], out_commitment_1[32], proof_bytes(256), ciphertext_0(128), ciphertext_1(128))`.
- **TransferCtx accounts, IN ORDER:** `pool`(ro), `merkle_tree`(mut), `nullifier_record_0`(init `["nullifier", n0]`), `nullifier_record_1`(init `["nullifier", n1]`), `fee_payer`(signer, mut), `transfer_vk`(ro), `system_program`. **No vault, no token_program** (a transfer moves no SPL — value stays in the vault, only redistributed via commitments).
- Public inputs (6, fixed order): `[merkleRoot, nullifier_0, nullifier_1, outCommitment_0, outCommitment_1, mintHash]`. The program rechecks only `mintHash = be_mod_f(pool.mint)`.
- `/zk/prove` proofType `transfer`. Circuit signals: public as above; private `in_noteSecret[2], in_pkRecipientHash[2], in_amount[2], in_leafIndex[2], in_merklePath[2][20], in_merklePathIndices[2][20], in_isDummy[2], out_pkRecipientHash[2], out_amount[2], out_noteSecret[2]`.
- **Events:** per output `LeafInserted{commitment, leaf_index, root}` (80 B — the merkle scanner already handles it) + `NoteCiphertext{leaf_index: u64, ciphertext: Vec<u8>=128}` (new; borsh: disc(8) + leaf_index(8 LE) + len(4 LE) + 128 = 148 B). `Transfer{nullifier_0, nullifier_1}` (72 B).
- **Dummy input** (1-real transfer): `isDummy=1`, `amount=0`, fresh random `noteSecret` (unique nullifier), `leafIndex=0`, `merklePathIndices=[0×20]`, `merklePath=[0×20]`, `pkRecipientHash` = own. `isDummy` is private ⇒ 1-real and 2-real transfers are indistinguishable.
- CU ~181k. proofType `transfer`, warm via `POST /zk/warm {proofType:"transfer"}`.

**SYNC POINTS (confirm at build/e2e, adjust literals only):** `transfer_vk` position in TransferCtx (contract says index 5, after `fee_payer`, before `system_program`); measured CU (default 250k); the `NoteCiphertext` borsh layout (leaf_index u64 LE + Vec len4+128); proofType `transfer`.

---

## Part C — SEND

### C1. `transferVkPda` (`poolPdas.ts`)
`transferVkPda(pool): PublicKey` = `findProgramAddressSync(["transfer_vk", pool], PROGRAM)`.

### C2. `transferWitness.ts` (new)
`buildTransferWitness({seed, inputs, recipientViewKeyG1, transferAmount, mint, leaves, outNoteSecrets, dummyNoteSecret})` where `inputs` is 1 or 2 real `ShieldedNote`s (their indices already resolved from `leaves`). Returns `{params, nullifier32: [Uint8Array,Uint8Array], outCommitment32: [Uint8Array,Uint8Array], outCommitmentDec: [string,string], recipientOut, changeOut}`.
- **Input side:** for each real input `i`: `pkRecipientHash = getPkRecipientHash(seed)` (sender owns all inputs), `mintHash(mint)`, `nullifier_i = nullifier({noteSecret, leafIndex})`, merkle path via `computeMerklePath(leaves, index)`, `isDummy=0`. If only 1 real input, input 1 is the **dummy**: `isDummy=1, amount=0, noteSecret=dummyNoteSecret (fresh random), leafIndex=0, path/indices zeros, pkRecipientHash=own`.
- **Value split:** `total = Σ input amounts`; `out_0.amount = transferAmount` (recipient), `out_1.amount = total − transferAmount` (change). Assert `transferAmount ≤ total`.
- **Output side:** `out_0`: `pkRecipientHash = poseidon3(0x05, be(recipientViewKeyG1[0:24]), be([24:48]))` (the recipient, from their address key — reuse `noteCrypto.pkRecipientHash`), `amount = transferAmount`, `noteSecret = outNoteSecrets[0]` (fresh random). `out_1` (change): `pkRecipientHash = getPkRecipientHash(seed)` (self), `amount = change`, `noteSecret = outNoteSecrets[1]`. Each `outCommitment_j = noteCommitment({pkRecipientHash, amount, mintHash, noteSecret})`.
- **params** (decimal strings / arrays, circuit signal names): the 6 public + all private (2-arrays for the per-input/per-output signals, in the circuit's order). Merkle roots: all real inputs prove against the same `merkleRoot` (from `leaves`); the dummy's path is unchecked.
- Returns the two 32-byte BE nullifiers + out commitments (for the ix) + `changeOut = {commitment: outCommitmentDec[1], amount: change, noteSecret: outNoteSecrets[1]}` (for local storage) + `recipientOut = {commitment: outCommitmentDec[0], amount: transferAmount, noteSecret: outNoteSecrets[0]}` (for encrypting to the recipient — the sender does NOT store this).

### C3. `buildTransferIx` (`poolInstructions.ts`)
`buildTransferIx(p)` — args data = `disc("global:transfer") + merkle_root(32) + n0(32) + n1(32) + oc0(32) + oc1(32) + u32le(256)+proof(256) + u32le(128)+ct0(128) + u32le(128)+ct1(128)`. Accounts in TransferCtx order (§contract) + `transferVk`. (Reuse the private `discriminator`, `u64le`, `u32le`, `PROGRAM`, `SystemProgram`.)

### C4. `transferFlow.ts` (new) — `sendPrivateTransfer(seed, feePayer, mint, recipientAddress, transferAmount, onStep?)`
1. `ensureSecureMmkv(seed)`; `recipientViewKeyG1 = decodeShieldedAddress(recipientAddress)` (48 B; throws on invalid → surfaced).
2. `{leaves, onChainRoots} = syncLeaves(mint)`; select inputs (best-fit): the smallest single unspent note `≥ transferAmount`; else the 2 largest notes summing `≥ transferAmount`; else throw ("amount exceeds your two largest shielded notes"). Resolve each input's `leafIndex` from `leaves` (backfill sentinel via `leaves.indexOf`, like `unshieldWithChange`).
3. Sample `outNoteSecrets = [random, random]` + `dummyNoteSecret = random` (`randomFieldElement`).
4. `w = buildTransferWitness(...)`; assert both merkle roots ∈ `onChainRoots` (`MerkleRootStaleError`).
5. `proof = proveShielded('transfer', w.params)`; cross-check `proof.publicInputs[3] === w.outCommitmentDec[0]` and `[4] === w.outCommitmentDec[1]` (defense in depth); `proofBytes` len 256.
6. `ciphertext_0 = encryptNote(recipientViewKeyG1, transferAmount, BigInt(w.recipientOut.noteSecret))`; `ciphertext_1 = encryptNote(getViewPublicKey(seed), change, BigInt(w.changeOut.noteSecret))` (encrypt change to SELF too — uniformity + scan-recoverable).
7. `ix = buildTransferIx({...w..., proofBytes, ciphertext_0, ciphertext_1, pool, merkleTree, nullifierRecord_0 = nullifierPda(w.nullifier32[0]), nullifierRecord_1 = nullifierPda(w.nullifier32[1]), feePayer, transferVk = transferVkPda(pool)})`; `submitPoolTxMany([ix], SHIELDED_CU.transfer, feePayer)` (confirmed via polling).
8. Mark the input note(s) spent (`markSpentByCommitment` per real input). Store the **change** note locally IF `change > 0`: resolve its leaf index (`resolveLeafIndex(txSignature, w.changeOut.commitment, mint)`) → `addNote({commitment, amount: change, noteSecret, mint, index, spent:false})`. Do NOT store the recipient note.
9. Return `{txSignature, sent: transferAmount, change}`.

`SHIELDED_CU.transfer` (new constant; default 250k until the ICO's measured ~181k is confirmed).

### C5. `zkProverModule.proveShielded` — extend proofType union to include `'transfer'`.

### C6. `ShieldedTransferScreen.tsx` — wire to `transferFlow`
Replace the mock `transfer(...)` call with `sendPrivateTransfer(seed, feePayer, mint, recipient, amount)` (retrieve seed via `keychainManager` + `deriveTransparentKeypair`, zeroize; mirror `ZkProofScreen.runShieldOp`'s seed handling). Drop the `memo` field (no memo in the contract; the 40-byte payload is amount+noteSecret only). Amount bound = the sum of the two largest notes (validate + message). `warmProver('transfer')` on screen focus. Keep the existing address input + steps + success screen (the screen's own step machine `input→proving→success` just awaits the flow — no ZkProofScreen 90%-hang concern here). Mint = `SHIELDED_POOL_MINTS[0]`.

---

## Part B — RECEIVE (scanning)

### B1. `noteCiphertextEvents.ts` (new)
`parseNoteCiphertextEvents(logs: string[]): {leafIndex: number; ciphertext: Uint8Array}[]` — parse the 148-byte `Program data:` lines: disc(8) + leaf_index(u64 LE, 8) + len(u32 LE, 4, ==128) + ciphertext(128). Length/len guarded; other events ignored (the merkle scanner's 80-byte lines and the 72-byte `Transfer` are skipped by length).

### B2. View-key session (`shieldedViewSession.ts`, new) — avoid per-scan biometric
The scan needs `sk_view` (read-only) + `pkRecipientHash` every shielded focus, but retrieving the seed each time would prompt biometric repeatedly. Cache them once per session: `setShieldedViewSession(seed)` derives `{skView: deriveShieldedViewKey(seed), pkH: getPkRecipientHash(seed)}` and holds them in a module var; `getShieldedViewSession(): {skView, pkH} | null`; `clearShieldedViewSession()` (on lock). Populate it exactly where the secure store is unlocked (both `secureStorageSession.unlockSecureStorage` — which already retrieves the seed — and the onboarding `unlockSecureStorageWithSeed`), so no extra seed retrieval. `sk_view` is view-only (cannot spend) and is already JS-resident by the model-B view-key choice, so a session-lived cache is acceptable; cleared on lock/logout.

### B3. `noteScan.ts` (new) — `scanIncomingNotes(mint): Promise<number>` (count of newly stored notes)
1. Read `{skView, pkH} = getShieldedViewSession()`; if null (not unlocked yet) return 0. `mintHash(mint)`.
2. Reuse the merkle-sync tx fetch: incrementally `getSignaturesForAddress(merkleTreePda)` from a `["noteScanCursor", mint]` cursor in `mmkvPublic` (mirrors `merkleSync`'s `until` pattern) → for each new tx, parse `NoteCiphertext` events (B1) AND build the `LeafInserted` commitment↔leaf_index map from the same logs (both come from the same transfer/deposit txs).
3. For each `NoteCiphertext{leafIndex, ct}`: `dec = tryDecryptNote(skView, ct)`; skip if null (foreign/garbage — never throws). On success, recompute `commitment = noteCommitment({pkRecipientHash: pkH, amount: dec.amount, mintHash, noteSecret: dec.noteSecret})` and verify its `decToHex64` equals the on-chain `LeafInserted` commitment (hex) at `leafIndex` (integrity — reject a mismatched/forged ciphertext, e.g. a note whose plaintext doesn't match the on-chain leaf). If it matches AND the note isn't already stored (dedup by commitment via `getNotes`), `addNote({commitment: commitmentDec, nullifier:'', mint, amount: dec.amount, index: leafIndex, spent:false, createdAt: Date.now(), noteSecret: dec.noteSecret.toString()})`.
4. Advance the cursor; return the count of newly added notes.

### B4. Wire scanning into the shielded dashboard
On shielded-mode focus (next to the existing merkle-sync prefetch + warm ping in `DashboardScreen`), call `scanIncomingNotes(mint)` fire-and-forget; on a non-zero result, bump `shieldedTick` so the vault re-reads and the discovered note appears (spendable). No seed needed at the call site — the scan reads the session view key (populated at unlock). Catch errors (best-effort).

---

## Data flow

**Send:** recipient `noc1…` → view key G1 → witness (2-in/2-out, value split) → prove(`transfer`) → encrypt out_0 to recipient + out_1 to self → transfer ix → mark inputs spent + store change note. Recipient note lives only on-chain (commitment) + in its ciphertext.
**Receive:** shielded focus → `scanIncomingNotes` → NoteCiphertext events → `tryDecryptNote` → recompute+match commitment → store note → shielded balance updates → spendable (via unshield or another transfer).

## Error handling

- Invalid recipient address / self-address → clear message (a self-transfer is allowed but pointless; not blocked).
- `transferAmount` > sum of 2 largest notes → reject before proving with a max-per-transfer message.
- Stale merkle root → `MerkleRootStaleError`, resync/retry, no spend.
- Prover commitment cross-check mismatch → abort, no tx.
- Confirm/leaf-resolve reuse the P1 bounded/fail-closed patterns — the transfer never hangs; the change note is stored only after a confirmed tx (resolve leaf index best-effort, sentinel backfilled on spend).
- Scanning is best-effort: a bad/foreign ciphertext → `tryDecryptNote` returns null (never throws); a commitment mismatch → skip (don't store); RPC failure → caught, retried next focus.

## Testing

- **Unit:** `transferWitness` (nullifier/commitment poseidon parity; value split `Σin = out_0+out_1`; dummy fields when 1 real input; recipient vs self `pkRecipientHash`; 6-order params); `buildTransferIx` (disc `global:transfer`, data layout incl. 2 ciphertexts, TransferCtx account order incl. `transfer_vk`); `transferVkPda`; input selection (best-fit 1-note-else-2); `parseNoteCiphertextEvents` (148-B parse, ignores 80/72-B); `scanIncomingNotes` (fixture: a ciphertext encrypted to my key + matching LeafInserted → stored; foreign ciphertext → skipped; commitment mismatch → skipped; dedup); `sendPrivateTransfer` (mocked: prove→submit→mark inputs spent→store change, stale-root guard).
- **On-device e2e (devnet):** Ana shields → transfers X to Blaž's `noc1…` (screen) → tx confirms first-try → Ana's vault reflects the change; Blaž (second wallet/seed) opens shielded → scan discovers the note → his shielded balance shows X → he unshields it. Amounts never public; both nullifier PDAs exist; ICO verifies on-chain.

## Out of scope / deferred

- Coordinator note-index endpoint (production reliable scanning; POC scans NoteCiphertext events via Helius).
- Zcash-style view tag (scan speed; changes CT_LEN).
- Relayer / unlinkable fee (self-relay SOL; fee_payer links the sender on-chain — documented POC privacy caveat).
- >2 inputs/outputs (fixed 2-in/2-out); mainnet hardening (ceremony/audit/immutable VK/local proving/seed-recoverable secrets).
