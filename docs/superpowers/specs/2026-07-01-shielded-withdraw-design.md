# Design — Shielded withdraw / unshield (Feature B)

**Date:** 2026-07-01
**Status:** Approved (brainstorm complete) — pending spec review → writing-plans.
**Scope:** Wallet-side. Unshield (withdraw) a shielded note back to the user's own transparent token account, on devnet. Self-relay (fee_payer = the transparent keypair). Completes C2 Project 1 (deposit was PRs #43/#46; balance display was #47).

**Lineage:** builds on the merged shield deposit path (`depositFlow.ts`, `poolInstructions.buildDepositIx`, `noteCrypto`, `shieldedIdentity`, `poolPdas`, `poolTx`, `noteStore`, `proveShielded`) and the multi-token balance work (#47). The `ShieldUnshieldScreen` "Make public" direction UI already exists and already navigates to `ZkProofModal` with `{direction:'public', amount, mint}`; only the withdraw *logic* is missing. Design source of truth: the existing #16 ShieldUnshield "Make public" + #18 ZkProof layouts in `/home/user/Downloads/index.html` — this feature feeds real withdraw behavior into that layout, it does not redesign it.

**Contract (from the deployed program `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES`, read directly from `programs/shielded-pool/src/lib.rs`):**
- `withdraw(merkle_root: [u8;32], nullifier: [u8;32], amount: u64, proof_bytes: Vec<u8>)`.
- `WithdrawCtx` accounts, IN ORDER: `pool` (ro, AccountLoader<Pool>), `merkle_tree` (mut), `vault` (mut), `destination_token_account` (mut), `nullifier_record` (init, payer=fee_payer, space 8+1, seeds `["nullifier", nullifier]`), `fee_payer` (mut, Signer), `token_program`, `system_program`.
- Public inputs (5), rechecked by the program from the REAL accounts: `[merkle_root, nullifier, u64_to_be32(amount), recipientField=be(destination_token_account)modF, mintHash=be(pool.mint)modF]`.
- Root membership: the program scans the full 64-entry `root_history` ring (`ROOT_HISTORY_LEN=64`), so proving against any recent root is safe against races.
- The program does NOT create the destination ATA; it requires it to already exist (`Account<TokenAccount>`, not `init`) and only checks `destination_token_account.mint == pool.mint`.
- `Deposit` event layout: `{ commitment:[u8;32], leaf_index:u64, root:[u8;32] }`. `Withdraw` event: `{ nullifier:[u8;32] }`.

---

## Scope

**IN:** (1) RPC log-scan Merkle sync (replay `Deposit` events → ordered leaves → local depth-20 tree, verified against on-chain `root_history`); (2) Merkle path extraction for a leaf; (3) withdraw witness builder (11 circuit signals) + `/zk/prove` params; (4) `buildWithdrawIx`; (5) `withdrawFlow.unshield` (sync → path → prove → pre-create dest ATA → withdraw tx → mark note spent); (6) `noteStore.markSpentByIndex`; (7) wire `ZkProofScreen` `direction==='public'` to `unshield` + a real success screen; (8) POLISH: fix the large empty gap at the top of the Shield/Unshield screen (#16, screenshot 34).

**Whole-note constraint (circuit-imposed):** the withdraw circuit constrains `withdrawAmount == amount` (the note's full value) with NO change output. Therefore **one withdraw unshields exactly one whole note.** UX: the "Make public" amount defaults to / MAX-fills a single selected note (default: the largest unspent note for the mint); a typed amount that does not equal an available note's value disables the CTA with a loud POC message ("POC: unshield supports a full note only"). Multiple notes ⇒ one withdraw each (not aggregated in v1).

**Destination:** the user's OWN transparent ATA for the mint (self-unshield). Created idempotently in the same transaction if missing. Arbitrary-recipient unshield is out of scope (a public transfer would deanonymize; private p2p is Project 2).

**OUT (follow-ups):** partial withdraw / change notes (needs a change-output circuit); multi-note aggregation; arbitrary recipient; private transfer (Project 2); a coordinator Merkle indexer endpoint (RPC log-scan is sufficient for the devnet POC — add only if speed becomes an issue at mainnet scale); local on-device proving (mainnet blocker — noteSecret still sent to the hosted prover here, POC-grade).

---

## Components

### 1. Merkle sync — RPC log-scan (`src/modules/shielded/merkleSync.ts`, new)
- `syncLeaves(mint): Promise<{leaves: string[]; onChainRoots: string[]}>`.
- `getSignaturesForAddress(merkleTreePda(poolPda(mint)))` (paginate via `before`), then `getTransaction(sig, {maxSupportedTransactionVersion:0})` for each, parse `Program data:` base64 log lines into `Deposit` events (disc(8) + commitment[32] + leaf_index(u64 LE) + root[32]).
- Order commitments by `leaf_index` (ascending, dense from 0), producing `leaves: string[]` of 64-char hex field elements (`commitment` bytes BE → hex).
- Read the `merkle_tree` account (`getAccountInfo`) and parse `root_history: [[u8;32];64]` → `onChainRoots` (hex). Byte offset per `state.rs` (zero-copy, `#[repr(C)]`): 8 (anchor disc) + 8 (`next_leaf_index:u64`) + 640 (`zeros:[[u8;32];20]`) + 640 (`filled_subtrees:[[u8;32];20]`) = **1296**; then 64×32 bytes of `root_history`, followed by `root_history_head:u16` (the head points at the NEXT write slot, so the current root is `root_history[(head-1) mod 64]`). Used to verify the locally computed root is a member (defense in depth) and to choose the root to prove against.
- No persistence required for v1 (scan fresh each unshield — the pool is small on devnet); may cache later. Ordering + density are asserted (a gap ⇒ throw, do not silently mis-place leaves).

### 2. Merkle path (`src/modules/merkle/merkleModule.ts`, extend)
- `computeMerklePath(leaves: string[], leafIndex: number): {root: string; siblings: string[]; pathIndices: number[]}` — depth-20, using the SAME `hashPair` (poseidon2, untagged) and `ZERO_HASHES` padding as the existing `computeMerkleRoot`. At each level: `pathIndices[i] = (index >> i) & 1` (0=left,1=right, LSB-first); `siblings[i]` = the sibling node (or `ZERO_HASHES[i]` if absent); fold up 20 levels. The returned `root` MUST equal `computeMerkleRoot(leaves)` (asserted in tests).

### 3. Withdraw witness (`src/modules/shielded/withdrawWitness.ts`, new)
- `buildWithdrawWitness({seed, note, destTokenAccount, leaves}): {params: ShieldedProveParams; nullifier32: Uint8Array; merkleRoot32: Uint8Array}`.
- Compute: `pkRecipientHash = getPkRecipientHash(seed)`; `mintHash(note.mint)`; `nullifier = nullifier({noteSecret, leafIndex: note.index})`; `recipientField = recipientField(destTokenAccount.toBytes())`; `{root, siblings, pathIndices} = computeMerklePath(leaves, note.index)`.
- `params` (decimal strings / string arrays, circuit signal names): `merkleRoot, nullifier, withdrawAmount(=amount), recipientField, mintHash, noteSecret, pkRecipientHash, amount, leafIndex, merklePath (siblings as decimal[20]), merklePathIndices (bits[20])`.
- Return `nullifier32` (BE 32B, for the ix + nullifier PDA) and `merkleRoot32` (BE 32B, for the ix). `withdrawAmount == amount` (whole-note).

### 4. Withdraw instruction (`src/modules/shielded/poolInstructions.ts`, extend)
- `buildWithdrawIx(p)` — `p: {merkleRoot, nullifier, amount, proofBytes(256), pool, merkleTree, vault, destinationTokenAccount, feePayer}`.
- Data = `disc("global:withdraw")[0:8] + merkle_root(32) + nullifier(32) + amount(u64 LE) + u32le(proofBytes.length) + proofBytes`.
- Accounts in the exact `WithdrawCtx` order (§Contract): pool(ro), merkleTree(mut), vault(mut), destinationTokenAccount(mut), nullifierRecord(mut — via `nullifierPda(nullifier)`), feePayer(signer,mut), TOKEN_PROGRAM(ro), SYSTEM_PROGRAM(ro).

### 5. Withdraw flow (`src/modules/shielded/withdrawFlow.ts`, new)
- `unshield(seed, feePayer: Keypair, mint: string, note: ShieldedNote): Promise<{txSignature: string; amount: bigint}>`.
- Steps: `ensureSecureMmkv(seed)` (reuse the deposit-flow pattern / shared util) → resolve `destinationTokenAccount = getAssociatedTokenAddressSync(mint, feePayer.publicKey)` (canonical ATA of self) → `{leaves, onChainRoots} = syncLeaves(mint)` → `buildWithdrawWitness(...)` → assert local root ∈ onChainRoots (else throw `MerkleRootStale`) → `proveShielded('withdraw', params)` → `hexToBytes(proofBytes)` (256) → build instruction list `[createAssociatedTokenAccountIdempotentInstruction(feePayer, destATA, feePayer, mint), buildWithdrawIx(...)]` → submit via a `submitPoolTx`-style call that accepts multiple instructions + `SHIELDED_CU.withdraw` → confirm, check `tx.meta.err` → on success `markSpentByIndex(mint, note.index)`.
- (Note: `submitPoolTx` currently takes a single ix; extend it to accept an ix array, or add `submitPoolTxMany`. Keep deposit's single-ix call working.)

### 6. Note store (`src/modules/shielded/noteStore.ts`, extend)
- `markSpentByIndex(mint: string, leafIndex: number): void` — set `spent=true` for the note whose `index === leafIndex` (the stored `nullifier` is `''` for deposit-created notes, so `markSpent(nullifiers)` cannot match; index is the stable key). Optionally also persist the computed nullifier for auditability.

### 7. ZkProofScreen wiring (`src/screens/shielded/ZkProofScreen.tsx`, extend)
- For `route.params.direction === 'public'`: select the note to spend (the mint's largest unspent note whose amount equals the requested amount; if none matches, surface the whole-note error before proving) and run `unshield(seed, feePayer, mint, note)` through the SAME state machine used for deposit (build → prove → submit → confirm). Zeroize the seed.
- Success screen (`'ready'` state): "Unshielded &lt;amount&gt; &lt;symbol&gt; → transparent", devnet explorer tx link, Done → popToTop. Reuse the deposit success layout; only the copy differs by direction.

### 8. Polish — Shield/Unshield top gap
- Fix the large empty vertical gap between the token chip (header) and the "Make private / Make public" toggle on `ShieldUnshieldScreen` (screenshot 34). Tighten the header/scroll spacing so the amount card sits where the design (#16) intends. Verify visually on-device.

---

## Data flow (withdraw)

note (local encrypted store) → `syncLeaves(mint)` (RPC `Deposit` events → ordered leaves + on-chain roots) → `computeMerklePath(leaves, note.index)` → `buildWithdrawWitness` → `proveShielded('withdraw')` → proofBytes → `[create-ATA-idempotent, buildWithdrawIx]` tx (self-relay, ComputeBudget `SHIELDED_CU.withdraw`) → on-chain: `nullifier_record` `init` blocks double-spend, vault→destination SPL transfer, `Withdraw` event → `markSpentByIndex` → dashboard re-reads (Feature A) → shielded balance drops, transparent balance rises.

## Error handling

- **Double-spend:** the `nullifier_record` `init` fails with "already in use" if the note was already withdrawn → catch, show "This note was already unshielded". `markSpentByIndex` on our side prevents re-attempt from the UI.
- **Stale Merkle sync** (a deposit landed after our scan): the local root should still be in the 64-ring, so proving is safe; if the local root is NOT in `onChainRoots`, throw `MerkleRootStale`, resync once, retry; second failure → surface an error (no funds moved).
- **Destination ATA missing:** `createAssociatedTokenAccountIdempotent` in the same tx (no-op if it exists).
- **Prover / RPC failure:** show the error; the note stays unspent (no loss). No partial state — the note is only marked spent AFTER a confirmed, non-reverted tx.
- **Whole-note mismatch:** typed amount ≠ any available note → CTA disabled with the POC message (validation in the screen, before proving).

## Testing

- **Unit:** `computeMerklePath` round-trips against `computeMerkleRoot` (random leaf sets + edge indices 0, last, single-leaf); `pathIndices` LSB-first bit correctness; `buildWithdrawWitness` Poseidon/domain-tag parity (nullifier = poseidon3(0x02,noteSecret,leafIndex); recipientField/mintHash = be mod F) and `withdrawAmount == amount`; `buildWithdrawIx` discriminator + data layout + account order/flags; `Deposit` event parsing (base64 → commitment/leaf_index/root) + leaf ordering by index (gap ⇒ throw); `markSpentByIndex` marks the right note and getBalance drops.
- **On-device (devnet):** unshield the 0.2 TEST note → pool vault falls 0.2, self ATA rises 0.2, the note disappears from the shielded dashboard (balance → 0 / empty state), a second unshield of the same note is rejected (nullifier). Verify the shield-screen top gap is fixed.

## Out of scope / deferred

- Partial withdraw / change notes (change-output circuit); multi-note aggregation; arbitrary-recipient unshield; private p2p transfer (Project 2).
- Coordinator Merkle indexer endpoint (RPC log-scan suffices for devnet POC).
- Local on-device proving (mainnet blocker; hosted prover still receives noteSecret here — POC-grade).
- Merkle-leaf persistence/caching (fresh scan per unshield is fine at devnet scale).
