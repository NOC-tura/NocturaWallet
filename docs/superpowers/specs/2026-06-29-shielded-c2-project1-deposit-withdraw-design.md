# Design — Shielded C2 Project 1: shield (deposit) + unshield (withdraw) on devnet

**Date:** 2026-06-29
**Status:** Approved (brainstorm complete; all decisions locked) — pending spec review → writing-plans.
**Scope:** Wire the wallet's shielded **deposit** (shield) and **withdraw** (unshield) flows to the LIVE devnet shielded-pool program, with real ZK proofs, self-relay transactions, an all-JS witness, and double-spend safety. Replaces the relayer stub + fake-note placeholders. Ships behind a **dedicated devnet build** (`FEATURES.shielded` ON → the whole app targets devnet).

**Lineage / sources of truth:**
- On-chain contract + params: `project_shielded_c2_contract` memory; ICO runbook `docs/runbooks/2026-06-27-shielded-pool-phase5-devnet.md` §7 (deployed account ordering); the `/zk/prove` params contract (2026-06-29).
- Canonical crypto: `src/modules/shielded/noteCrypto.ts` + `src/modules/merkle/merkleModule.ts` + `docs/zk-contract/golden-vectors.json` (the wallet is canonical; the circuit was built to match).
- Existing flow scaffold (to be rewired): `src/modules/shielded/shieldedService.ts`, `src/modules/zkProver/zkProverModule.ts`.

**Why now:** the ICO/coordinator side is 100% complete and deployed — program `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES` is live on devnet (deposit→withdraw→double-spend acceptance passed), and `POST /api/v1/zk/prove` returns on-chain-ready `proofBytes` (256 B hex). Every program/coordinator dependency for deposit+withdraw is resolved.

---

## Scope

**IN (Project 1):** `deposit` (shield) + `withdraw` (unshield), both strictly **1-note-in / 1-note-out** (the pool's `maxInputs:1, maxOutputs:1`). Self-relay (wallet = `fee_payer`). All-JS witness (view-key model; native BLST off the proof path). A dedicated devnet build target.

**OUT (→ Project 2, separate brainstorm):** private peer-to-peer **transfer**. It needs a NEW subsystem on BOTH sides — a `transfer.circom`, a transfer program instruction, AND a note-encryption scheme (so a recipient can detect + decrypt an incoming note with their view key; today the program emits only `commitment`/`leaf_index`/`root`, so a recipient cannot discover a note sent to them) — plus wallet note-scanning + the transfer UI to the `index.html` design. Project 2 begins with a note-encryption + transfer design contract negotiated with the ICO Claude. Until then the existing `ShieldedTransferScreen` is left untouched (not wired, not removed).

**Also out / removed in Project 1:** `consolidateNotes` (the pool is 1-in/1-out, no multi-note merge) and the relayer path. See "Removals" below.

---

## Locked decisions (from the brainstorm)

1. **Dedicated devnet build.** `FEATURES.shielded` ON ⇒ the whole app points at devnet (devnet RPC + devnet test mint + pool `NPkc…`). The mainnet production APK keeps `FEATURES.shielded` OFF. No dual-cluster.
2. **Split delivery:** deposit path first (its own PR + on-device devnet test), then withdraw path (second PR). Deposit is simpler (no merkle path) and de-risks the shared infra early.
3. **View-key model; native BLST OFF the proof path.** `pkRecipientHash = poseidon3(0x05, be(viewG1[0:24]), be(viewG1[24:48]))` where `viewG1` is the compressed 48-byte pubkey of `sk_view` (EIP-2333 path `m/12381/371/2/0`, JS-derivable). Spend authorization in these circuits is knowledge of `noteSecret` alone (no in-circuit signature). `sk_view`, `pkRecipientHash`, `noteSecret`, `commitment`, `nullifier`, and the merkle path all compute in JS.
4. **`noteSecret` = random sampled `< F`, stored in the encrypted note store.** This keeps `sk_view` non-spend-capable (preserves view/spend separation — a shared view/disclosure key can scan but not spend). ⚠️ **Limitation (loud, devnet-POC-acceptable):** random+stored notes are NOT seed-recoverable — losing the device store = losing shielded funds. Production recoverability would derive `noteSecret` from `sk_spend` in native (keeps the view key non-spending) — deferred.
5. **Merkle sync = RPC log-scan.** The wallet replays the program's `Deposit` events from devnet RPC and rebuilds the depth-20 `IncrementalTree` locally. Self-contained, no new backend. **FUTURE:** add a coordinator indexer endpoint for the tree IF speed becomes an issue (esp. at mainnet scale) — deferred.
6. **`proofBytes` forwarded opaquely.** `/zk/prove` returns the 256-byte on-chain proof; the wallet never inspects or re-derives the byte format in JS.

---

## On-chain contract (reference)

**Program:** `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES` (devnet).

**PDAs:** `pool = ["pool", mint]`, `merkle_tree = ["merkle", pool]`, `nullifier = ["nullifier", nullifier_32B]`, `vault = ATA(pool, mint, allowOwnerOffCurve=true)`.

**Instructions** (8-byte Anchor discriminator + Borsh args):
- `deposit(amount: u64, commitment: [u8;32], proof_bytes: Vec<u8>)`
- `withdraw(merkle_root: [u8;32], nullifier: [u8;32], amount: u64, proof_bytes: Vec<u8>)`
- Wire encoding: `Vec<u8>` = 4-byte LE length prefix + raw bytes; `u64` = LE; `[u8;32]` = bare 32 bytes. Account ordering per runbook §7 / the deployed program.

**ComputeBudget:** deposit ≈ 132k CU, withdraw ≈ 152k CU. Prepend `ComputeBudgetInstruction.setComputeUnitLimit(measured + headroom)`.

**Auth:** permissionless — `fee_payer` (the wallet's transparent Ed25519 keypair) signs + pays tx fee + (withdraw) the nullifier-PDA rent. The destination token account is validated, not a signer, and is NOT created by the program — the wallet pre-creates it.

**`/zk/prove` params** (keys = circom main input signals; all values base-10 decimal strings of field elements in `[0,F)`; mirror `noteCrypto.ts`):
- **deposit:** `commitment` (pub), `amount` (pub, u64 as field), `mintHash` (pub) · `pkRecipientHash` (priv), `noteSecret` (priv). → response `publicInputs = [commitment, amount, mintHash]`.
- **withdraw:** `merkleRoot` (pub), `nullifier` (pub), `withdrawAmount` (pub, == amount), `recipientField` (pub), `mintHash` (pub) · `noteSecret` (priv), `pkRecipientHash` (priv), `amount` (priv, u64), `leafIndex` (priv, MUST equal Σ `merklePathIndices[i]·2^i`), `merklePath` (priv, [20] sibling hashes), `merklePathIndices` (priv, [20] bits, `bit i = (leafIndex>>i)&1`, LSB-first, 0=left/1=right). → response `publicInputs = [merkleRoot, nullifier, withdrawAmount, recipientField, mintHash]`.
- Response shape: `{ success, proofData (base64 raw), proofBytes (hex, 256 B), publicInputs (decimal, circuit order) }`.

**Encodings** (must match the circuit byte-for-byte; the circuit recomputes `commitment` + `nullifier` from private inputs and constrains them to the public values, so any drift fails `fullProve`):
- `commitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)`
- `nullifier = poseidon3(0x02, noteSecret, leafIndex)`
- `mintHash = be(mint[0:32]) mod F`, `recipientField = be(destTokenAccount[0:32]) mod F`
- `pkRecipientHash = poseidon3(0x05, be(viewG1[0:24]), be(viewG1[24:48]))`
- Merkle: untagged `poseidon2`, depth 20, `ZERO_LEAF=0`. First deposit (`leafIndex 0`): `merklePath = zeros(20)[0..19]`, `merklePathIndices = [0]×20`.
- `F = 21888242871839275222246405745257275088548364400416034343698204186575808495617`.

---

## Architecture

**Self-relay + all-JS witness.** The wallet builds the `deposit`/`withdraw` instruction, prepends a `ComputeBudget` ix, signs with the transparent Ed25519 keypair (the `fee_payer`), and submits to the devnet RPC — replacing the relayer stub. The witness (everything `/zk/prove` needs as `params`) is computed entirely in JS from `sk_view` + a random `noteSecret`. `proofBytes` from the response is forwarded opaquely into the instruction's `proof_bytes` arg.

### Modules

Shared infra is built in the deposit PR and reused by withdraw.

1. **`src/constants/` (shielded additions)** — `SHIELDED_POOL_PROGRAM_ID = NPkc…`; devnet RPC URL (via env/`react-native-config`, never a hardcoded key); devnet test mint; PDA seed literals; `SHIELDED_CU = { deposit, withdraw }`. `FEATURES.shielded` gates the devnet build (already exists).
2. **`src/modules/shielded/poolPdas.ts`** — `poolPda(mint)`, `merkleTreePda(pool)`, `nullifierPda(nullifier32)`, `vaultAta(pool, mint)`. Pure `@solana/web3.js` `PublicKey.findProgramAddressSync` + ATA derivation with `allowOwnerOffCurve`.
3. **`src/modules/shielded/poolInstructions.ts`** — `buildDepositIx(...)`, `buildWithdrawIx(...)`: 8-byte discriminator (`sha256("global:<name>")[0:8]`) + Borsh-encoded args (`Vec<u8>` 4-byte LE len + raw; `u64` LE; 32-byte arrays) + ordered `AccountMeta[]` per the deployed program. Same manual-encoding pattern as the existing transparent tx-builder (no Anchor runtime).
4. **`src/modules/shielded/poolTx.ts`** — `submitPoolTx(ix, computeUnitLimit)`: assemble `[ComputeBudget ix, pool ix]`, set fee_payer + recent blockhash, sign with the transparent keypair, send + confirm on the devnet connection. Replaces `submitToRelayer`.
5. **`src/modules/shielded/shieldedIdentity.ts` (new)** — `getViewKey()` derives `sk_view` in JS (`micro-key-producer/bls.js`, EIP-2333 `m/12381/371/2/0`) from the seed; `getViewPubkey()` → compressed 48-byte G1; `getPkRecipientHash()` → `poseidon3(0x05, ...)`. This is the piece that the earlier (native) plan owned; the view-key model moves it to JS.
6. **`src/modules/shielded/witnessProvider.ts`** — the real `WitnessProvider` (replaces the null provider): builds the exact `/zk/prove` params for each proof type from `shieldedIdentity` + `noteCrypto` + (withdraw) `merkleSync`. Wired via the existing `setWitnessProvider`.
7. **`src/modules/shielded/merkleSync.ts` (withdraw PR)** — `syncTree()`: `getSignaturesForAddress` on the program/pool → fetch + parse `Deposit{commitment, leaf_index, root}` logs → insert each commitment into a local depth-20 `IncrementalTree` (reuse `merkleModule`) in `leaf_index` order → expose `pathFor(leafIndex)` (the 20 siblings + indices) and the current root. Cross-check the rebuilt root against the on-chain `merkle_tree.root_history` ring before proving.
8. **proof path (`zkProver/types.ts` + `zkProverModule.ts`)** — add `proofBytes: string` to `HostedProverResponse` + `ZKProof`; `proveHosted` carries it through. `shieldedService` reads `proof.proofBytes` for the instruction.

### Deposit flow (C2-i, first PR)

1. Build a fresh note: `noteSecret` = random field element `< F`; `pkRecipientHash` from `shieldedIdentity`; `commitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)`; `mintHash = be(devnetMint) mod F`.
2. `params = { commitment, amount, mintHash, pkRecipientHash, noteSecret }` (decimal strings) → `zkProver.prove('deposit', …)` → `{ proofBytes, publicInputs }`. Sanity-check `publicInputs == [commitment, amount, mintHash]`.
3. Build the tx: `ComputeBudget(132k + headroom)` + `deposit(amount, commitment, proofBytes)` with accounts `[pool, merkle_tree(mut), vault(mut), depositor(signer=fee_payer), depositor_token_account(mut), token_program]` (the SPL transfer of `amount` depositor→vault is performed by the program). Sign as fee_payer, submit, confirm.
4. From the `Deposit` event log read the assigned `leaf_index`; store the REAL note (`commitment`, `noteSecret`, `amount`, `mint`, `leaf_index`, `spent:false`) in the encrypted note store. Replaces the fake `makeResultNote`.

### Withdraw flow (C2-ii, second PR)

1. `merkleSync.syncTree()`; select the note to spend; `pathFor(note.leaf_index)` → `merklePath[20]` + `merklePathIndices[20]`; pick a `merkleRoot` present in the on-chain `root_history`.
2. Pre-create the destination token account (ATA for the devnet mint owned by the user's transparent address) if absent; `recipientField = be(destTA) mod F`.
3. Derive `nullifier = poseidon3(0x02, noteSecret, leafIndex)`; derive `nullifierPda` and assert it does NOT yet exist (anti-double-spend pre-check; the program enforces it via `init`).
4. `params = { merkleRoot, nullifier, withdrawAmount: amount, recipientField, mintHash, noteSecret, pkRecipientHash, amount, leafIndex, merklePath, merklePathIndices }` → `zkProver.prove('withdraw', …)` → `{ proofBytes, publicInputs }`. Sanity-check the public order.
5. Build the tx: `ComputeBudget(152k + headroom)` + `withdraw(merkleRoot, nullifier, amount, proofBytes)` with accounts `[pool, merkle_tree(mut), vault(mut), destination_token_account(mut), nullifier_record(init, payer=fee_payer), fee_payer(signer), token_program, system_program]`. Sign as fee_payer, submit, confirm.
6. `markSpent(mint, [nullifier])` in the note store.

### Removals / replacements (loud)

- `submitToRelayer` + `${API_BASE}/v1/relayer/submit` → removed; replaced by `poolTx.submitPoolTx` (self-relay). The relayer is not part of this POC.
- `makeResultNote` (fabricated `result_commitment_*`/`result_nullifier_*`) → removed; real notes come from the witness + the `Deposit` event.
- `consolidateNotes` + the `transfer()` method in `shieldedService` → removed from Project 1 (the pool is 1-in/1-out; transfer is Project 2). The `ShieldedTransferScreen` is left in place but not wired until Project 2.

---

## Error handling

- **Proof generation:** keep the existing `zkProver` fallback chain (hosted → local → queue). A queued/unavailable proof surfaces `ProverUnavailableError` to the UI.
- **Double-spend:** before building a withdraw, check the `nullifierPda` does not exist; if it does, fail with a clear "note already spent" error (the program also rejects via `init`).
- **Stale root:** if the locally-rebuilt root is not in the on-chain `root_history`, re-sync before proving; surface a clear error if it still mismatches.
- **Missing/funded accounts:** insufficient depositor balance, or a missing destination ATA that cannot be created, fail with the existing shielded error codes (`E013` etc.).
- **noteSecret residency:** continue the existing zeroize discipline (`noteSecret` stripped before hosted send, witness zeroized after proving). Never log `params`/`noteSecret`.

## Testing

- **Node/jest (no device):**
  - witness builder reproduces the canonical encodings (assert `commitment`/`nullifier`/`pkRecipientHash`/`mintHash`/`recipientField` against golden vectors + the params contract);
  - instruction encoding (discriminator + Borsh `Vec<u8>`/`u64`/array layout) against known-byte fixtures;
  - PDA derivations (`pool`/`merkle_tree`/`nullifier`/`vault`) against expected addresses;
  - `merkleSync` rebuilds the depth-20 tree from a fixture event stream and produces a path that folds to the expected root (reuse `merkleModule`/golden `merkleIncremental`).
- **On-device (dedicated devnet build):**
  - deposit (shield) → assert vault balance == amount + a real note stored with its `leaf_index`;
  - withdraw (unshield) → funds returned to the destination ATA + `nullifierPda` exists + a replayed withdraw is rejected (double-spend);
  - capture the measured deposit/withdraw CU to confirm the `ComputeBudget` headroom.

## Devnet build config

`FEATURES.shielded` ON selects: devnet RPC (env), the devnet test mint, and the pool program `NPkc…`. The mainnet production build keeps it OFF (transparent-only). RPC keys come from `.env`/`react-native-config`, never hardcoded.

## Open coordination items

- **Devnet test mint + funding:** the deposit needs a depositor token account holding the devnet test mint. Confirm the devnet pool's mint address with the ICO Claude and fund the test wallet (the ICO Claude offered help with the end-to-end test). This is a test prerequisite, not a code dependency.
- **Account ordering:** confirm the exact `AccountMeta` order for `deposit`/`withdraw` against runbook §7 / the deployed program before encoding (cross-check during the deposit PR).

## Out of scope / deferred

- Private transfer (Project 2: transfer circuit + ix + note-encryption + scanning + UI).
- `noteSecret` seed-recoverability (production: derive from `sk_spend` in native).
- Coordinator merkle indexer (future, if RPC log-scan is too slow at scale).
- Mainnet shielded (separate project: trusted-setup ceremony + immutable/multisig VK + audit before real funds).
- iOS native (not configured); this POC targets the Android devnet build.
