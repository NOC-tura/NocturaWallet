# Wallet Partial Unshield (change-output) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user unshield an arbitrary amount `W` from one shielded note, receiving `W` transparently and keeping the remainder `V−W` as a self-change note.

**Architecture:** Additive on top of the merged whole-note withdraw (PR #48). New `withdraw_with_change` witness/instruction/flow + `wchange_vk` PDA + `withdraw_change` proofType; the UI drops the whole-note constraint (arbitrary amount, MAX = largest note, best-fit note selection). Reuses `merkleSync`, `computeMerklePath`, `noteCrypto`, `fieldCodec`, `noteStore`, `poolTx`, `depositEvents` unchanged.

**Tech Stack:** React Native 0.84 / TypeScript strict, @solana/web3.js, poseidon-lite, MMKV, Jest.

**Contract reference:** `docs/superpowers/specs/2026-07-02-wallet-partial-unshield-design.md` + `docs/contracts/2026-07-02-change-output-withdraw-contract.md`. Program `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES` (in-place upgrade). `withdraw_with_change(merkle_root[32], nullifier[32], amount:u64, change_commitment[32], proof_bytes)`; accounts = `WithdrawCtx` (pool ro, merkle_tree mut, vault mut, destination_token_account mut, nullifier_record init, fee_payer signer+mut, token_program, system_program) **+ `wchange_vk` (ro, PDA `["wchange_vk", pool]`)**. Public inputs (6): `[merkleRoot, nullifier, u64_to_be32(withdrawAmount), recipientField, mintHash, changeCommitment]`. `/zk/prove` proofType `withdraw_change`.

**⚠️ SYNC POINTS (adjust these literals only, at the ICO devnet-deploy sync — do NOT block the build on them):**
- Exact position of `wchange_vk` in the account list (assumed appended LAST after `system_program`).
- `SHIELDED_CU.withdrawChange` measured CU (default 250_000 until measured).
- proofType string `withdraw_change` and that `/zk/prove` returns `publicInputs[5] = changeCommitment`.

**Existing helpers to reuse (read before starting — all committed in #48):**
- `noteCrypto.ts`: `noteCommitment({pkRecipientHash, amount, mintHash, noteSecret}): bigint`, `nullifier({noteSecret, leafIndex})`, `mintHash(bytes)`, `recipientField(bytes)`, `randomFieldElement(): bigint`.
- `shieldedIdentity.ts`: `getPkRecipientHash(seed): bigint`.
- `fieldCodec.ts`: `decToBe32`, `hexToDec`, `hexToBytes`, `bytesToHex`.
- `merkleModule.ts`: `computeMerklePath(leaves, leafIndex) → {root, siblings, pathIndices}`.
- `merkleSync.ts`: `syncLeaves(mint) → {leaves, onChainRoots}`.
- `depositEvents.ts`: `parseDepositEvents(logs): DepositEvent[]` (each `{commitment, leafIndex, root}`; length-based, so it parses the renamed `LeafInserted` too).
- `noteStore.ts`: `getNotes(mint)`, `addNote(note)`, `markSpentByIndex(mint, index)`, `getBalance(mint)`.
- `poolPdas.ts`: `poolPda(mint)`, `merkleTreePda(pool)`, `vaultAta(pool, mint)`, `nullifierPda(n32)`.
- `poolInstructions.ts`: `buildWithdrawIx`, private `discriminator`, `u64le`, `u32le`, `PROGRAM`, `SPL_TOKEN_PROGRAM_ID`, `SystemProgram`.
- `poolTx.ts`: `submitPoolTxMany(ixs, cu, feePayer)`.
- `transactionBuilder.ts`: `findAssociatedTokenAddress(owner, mint)`, `buildCreateAtaIdempotentInstruction(payer, ata, owner, mint)`.
- `withdrawWitness.ts`: `buildWithdrawWitness` (mirror it for the change variant).
- `withdrawFlow.ts`: `unshield`, `MerkleRootStaleError`, private `ensureSecureMmkv`, `sleep` (the getTransaction poll pattern).
- `zkProverModule.ts`: `proveShielded(proofType, params)`.
- `constants/programs.ts`: `SHIELDED_CU` (`{deposit, withdraw}`), `SHIELDED_POOL_MINTS`.

Commands: `npx jest --testPathPattern=<name>`, `npx tsc --noEmit`, `npx eslint <files>`.

---

### Task 1: Constants + `wchange_vk` PDA

**Files:**
- Modify: `src/constants/programs.ts`
- Modify: `src/modules/shielded/poolPdas.ts`
- Test: `src/modules/shielded/__tests__/poolPdas.test.ts` (create if missing)

- [ ] **Step 1: Write the failing test**

Create/append `src/modules/shielded/__tests__/poolPdas.test.ts`:

```ts
import {PublicKey} from '@solana/web3.js';
import {poolPda, wchangeVkPda} from '../poolPdas';

const MINT = new PublicKey('So11111111111111111111111111111111111111112');

describe('wchangeVkPda', () => {
  it('derives ["wchange_vk", pool] under the shielded program', () => {
    const pool = poolPda(MINT);
    const vk = wchangeVkPda(pool);
    const expected = PublicKey.findProgramAddressSync(
      [Buffer.from('wchange_vk'), pool.toBuffer()],
      new PublicKey('NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES'),
    )[0];
    expect(vk.toBase58()).toBe(expected.toBase58());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=poolPdas`
Expected: FAIL — `wchangeVkPda` is not exported.

- [ ] **Step 3: Implement**

In `src/modules/shielded/poolPdas.ts`, add after `nullifierPda`:

```ts
/** withdraw-change VK account PDA: ["wchange_vk", pool]. */
export function wchangeVkPda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('wchange_vk'), pool.toBuffer()], PROGRAM)[0];
}
```

In `src/constants/programs.ts`, extend `SHIELDED_CU` (find the existing `export const SHIELDED_CU = {deposit: 200_000, withdraw: 250_000} as const;`) to add `withdrawChange`:

```ts
// withdrawChange: est. ~200–220k (plain withdraw ~152k + one merkle insert);
// 250k headroom until the ICO reports the measured devnet CU (SYNC POINT).
export const SHIELDED_CU = {deposit: 200_000, withdraw: 250_000, withdrawChange: 250_000} as const;
```

- [ ] **Step 4: Run test + tsc**

Run: `npx jest --testPathPattern=poolPdas` (PASS) and `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/constants/programs.ts src/modules/shielded/poolPdas.ts src/modules/shielded/__tests__/poolPdas.test.ts
git commit -m "feat(shielded): wchange_vk PDA + withdrawChange CU constant"
```

---

### Task 2: Best-fit input-note selection

**Files:**
- Create: `src/modules/shielded/noteSelect.ts`
- Test: `src/modules/shielded/__tests__/noteSelect.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/noteSelect.test.ts
import {selectBestFit} from '../noteSelect';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const note = (amount: bigint, index: number): ShieldedNote => ({
  commitment: `c${index}`, nullifier: '', mint: MINT, amount, index, spent: false, createdAt: index, noteSecret: `s${index}`,
});

describe('noteSelect', () => {
  const notes = [note(100n, 0), note(300n, 1), note(200n, 2)];

  it('selectBestFit picks the SMALLEST note >= target', () => {
    expect(selectBestFit(notes, 150n)?.amount).toBe(200n); // smallest >= 150
    expect(selectBestFit(notes, 200n)?.amount).toBe(200n); // exact fit
    expect(selectBestFit(notes, 100n)?.amount).toBe(100n);
  });

  it('selectBestFit returns null when no note covers the target', () => {
    expect(selectBestFit(notes, 301n)).toBeNull();
  });

  it('selectBestFit on a tie returns a covering note of that amount', () => {
    const withTie = [note(200n, 0), note(200n, 1)];
    expect(selectBestFit(withTie, 150n)?.amount).toBe(200n);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=noteSelect`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/shielded/noteSelect.ts
import {getNotes} from './noteStore';
import type {ShieldedNote} from './types';

/**
 * Best-fit: the SMALLEST unspent note whose amount >= target (minimizes change,
 * preserves large notes for future large unshields). null when none covers it.
 * The withdraw circuit takes ONE input note, so the target must fit in a single note.
 */
export function selectBestFit(notes: ShieldedNote[], target: bigint): ShieldedNote | null {
  let best: ShieldedNote | null = null;
  for (const n of notes) {
    if (n.amount < target) continue;
    if (best === null || n.amount < best.amount) best = n;
  }
  return best;
}

/** Best-fit input note for withdrawing `target` from `mint` (null if none covers it). */
export function selectInputNote(mint: string, target: bigint): ShieldedNote | null {
  return selectBestFit(getNotes(mint), target);
}
```

- [ ] **Step 4: Run test + tsc**

Run: `npx jest --testPathPattern=noteSelect` (PASS, 3 tests) and `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/noteSelect.ts src/modules/shielded/__tests__/noteSelect.test.ts
git commit -m "feat(shielded): best-fit input-note selection for partial unshield"
```

---

### Task 3: `buildWithdrawChangeWitness`

**Files:**
- Create: `src/modules/shielded/withdrawChangeWitness.ts`
- Test: `src/modules/shielded/__tests__/withdrawChangeWitness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/withdrawChangeWitness.test.ts
import {PublicKey} from '@solana/web3.js';
import {buildWithdrawChangeWitness} from '../withdrawChangeWitness';
import {nullifier, mintHash, recipientField, noteCommitment} from '../noteCrypto';
import {getPkRecipientHash} from '../shieldedIdentity';
import {decToHex64} from '../fieldCodec';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const DEST = new PublicKey('11111111111111111111111111111112');
const seed = new Uint8Array(32).fill(7);
const note: ShieldedNote = {commitment: '999', nullifier: '', mint: MINT, amount: 500n, index: 0, spent: false, createdAt: 1, noteSecret: '12345'};

describe('buildWithdrawChangeWitness', () => {
  it('splits value and computes the self-change commitment (6-order params, no changeCommitment in params)', () => {
    const leaves = [decToHex64(note.commitment)];
    const w = buildWithdrawChangeWitness({
      seed, note, withdrawAmount: 200n, changeNoteSecret: 77n, destTokenAccount: DEST, leaves,
    });

    const pkH = getPkRecipientHash(seed);
    const mH = mintHash(new PublicKey(MINT).toBytes());
    const expectedChangeCommitment = noteCommitment({pkRecipientHash: pkH, amount: 300n, mintHash: mH, noteSecret: 77n});
    const expectedNull = nullifier({noteSecret: 12345n, leafIndex: 0});
    const expectedRecip = recipientField(DEST.toBytes());

    // Value split
    expect(w.changeAmount).toBe(300n);                     // 500 - 200
    expect(w.params.withdrawAmount).toBe('200');
    expect(w.params.inputAmount).toBe('500');
    expect(w.params.changeAmount).toBe('300');
    expect(w.params.changeNoteSecret).toBe('77');
    // Crypto
    expect(w.params.nullifier).toBe(expectedNull.toString());
    expect(w.params.recipientField).toBe(expectedRecip.toString());
    expect(w.params.mintHash).toBe(mH.toString());
    expect(w.params.pkRecipientHash).toBe(pkH.toString());
    // changeCommitment is a circuit OUTPUT — must NOT be in the prover params
    expect('changeCommitment' in w.params).toBe(false);
    // but IS returned for the ix arg + cross-check
    expect(w.changeCommitmentDec).toBe(expectedChangeCommitment.toString());
    expect(w.changeCommitment32.length).toBe(32);
    expect(w.nullifier32.length).toBe(32);
    expect(w.merkleRoot32.length).toBe(32);
    expect((w.params.merklePath as string[]).length).toBe(20);
    expect((w.params.merklePathIndices as string[]).length).toBe(20);
  });

  it('rejects a withdrawAmount greater than the note', () => {
    expect(() => buildWithdrawChangeWitness({
      seed, note, withdrawAmount: 600n, changeNoteSecret: 1n, destTokenAccount: DEST, leaves: [decToHex64(note.commitment)],
    })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=withdrawChangeWitness`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/shielded/withdrawChangeWitness.ts
import {PublicKey} from '@solana/web3.js';
import {nullifier, mintHash, recipientField, noteCommitment} from './noteCrypto';
import {getPkRecipientHash} from './shieldedIdentity';
import {computeMerklePath} from '../merkle/merkleModule';
import {decToBe32, hexToDec} from './fieldCodec';
import type {ShieldedProveParams} from '../zkProver/types';
import type {ShieldedNote} from './types';

export interface WithdrawChangeWitnessInput {
  seed: Uint8Array;
  note: ShieldedNote;         // the input note (value V)
  withdrawAmount: bigint;     // W, 0 <= W <= V
  changeNoteSecret: bigint;   // fresh random < F
  destTokenAccount: PublicKey;
  leaves: string[];           // hex commitments, dense by leaf index (from merkleSync)
}

export interface WithdrawChangeWitness {
  params: ShieldedProveParams; // NOTE: does NOT include changeCommitment (circuit output)
  nullifier32: Uint8Array;     // BE 32B — ix arg + nullifier PDA seed
  merkleRoot32: Uint8Array;    // BE 32B — ix arg
  changeCommitment32: Uint8Array; // BE 32B — ix arg
  changeCommitmentDec: string;    // decimal — cross-check vs prover publicInputs[5]
  changeAmount: bigint;        // V - W
}

/**
 * Witness + /zk/prove params for a partial (change-output) unshield.
 * Public inputs (circuit order): [merkleRoot, nullifier, withdrawAmount,
 * recipientField, mintHash, changeCommitment]. The circuit RECOMPUTES the change
 * commitment from (pkRecipientHash, changeAmount, mintHash, changeNoteSecret), so
 * it is NOT sent as a param — the wallet computes it locally for the ix arg + a
 * cross-check against the prover's returned publicInputs[5]. Change is same-owner
 * (pkRecipientHash + mintHash reused from the input note).
 */
export function buildWithdrawChangeWitness(input: WithdrawChangeWitnessInput): WithdrawChangeWitness {
  const {seed, note, withdrawAmount, changeNoteSecret, destTokenAccount, leaves} = input;
  if (withdrawAmount < 0n || withdrawAmount > note.amount) {
    throw new Error(`withdrawAmount ${withdrawAmount} out of range (0..${note.amount})`);
  }
  const changeAmount = note.amount - withdrawAmount;

  const pkH = getPkRecipientHash(seed);
  const mH = mintHash(new PublicKey(note.mint).toBytes());
  const nul = nullifier({noteSecret: BigInt(note.noteSecret), leafIndex: note.index});
  const recip = recipientField(destTokenAccount.toBytes());
  const {root, siblings, pathIndices} = computeMerklePath(leaves, note.index);
  const merkleRootDec = hexToDec(root);
  const changeCommitment = noteCommitment({
    pkRecipientHash: pkH, amount: changeAmount, mintHash: mH, noteSecret: changeNoteSecret,
  });

  const params: ShieldedProveParams = {
    merkleRoot: merkleRootDec,
    nullifier: nul.toString(),
    withdrawAmount: withdrawAmount.toString(),
    recipientField: recip.toString(),
    mintHash: mH.toString(),
    noteSecret: BigInt(note.noteSecret).toString(),
    pkRecipientHash: pkH.toString(),
    inputAmount: note.amount.toString(),
    leafIndex: note.index.toString(),
    merklePath: siblings.map(hexToDec),
    merklePathIndices: pathIndices.map(b => b.toString()),
    changeNoteSecret: changeNoteSecret.toString(),
    changeAmount: changeAmount.toString(),
  };

  return {
    params,
    nullifier32: decToBe32(nul.toString()),
    merkleRoot32: decToBe32(merkleRootDec),
    changeCommitment32: decToBe32(changeCommitment.toString()),
    changeCommitmentDec: changeCommitment.toString(),
    changeAmount,
  };
}
```

- [ ] **Step 4: Run test + tsc + eslint**

Run: `npx jest --testPathPattern=withdrawChangeWitness` (PASS), `npx tsc --noEmit` (clean), `npx eslint src/modules/shielded/withdrawChangeWitness.ts` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/withdrawChangeWitness.ts src/modules/shielded/__tests__/withdrawChangeWitness.test.ts
git commit -m "feat(shielded): withdraw-change witness (value split + self-change commitment)"
```

---

### Task 4: `buildWithdrawWithChangeIx`

**Files:**
- Modify: `src/modules/shielded/poolInstructions.ts`
- Test: `src/modules/shielded/__tests__/withdrawChangeIx.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/withdrawChangeIx.test.ts
import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildWithdrawWithChangeIx} from '../poolInstructions';

const pk = (s: string) => new PublicKey(s);
const SYS = '11111111111111111111111111111111';
const TOK = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('buildWithdrawWithChangeIx', () => {
  const base = {
    merkleRoot: new Uint8Array(32).fill(1),
    nullifier: new Uint8Array(32).fill(2),
    amount: 200n,
    changeCommitment: new Uint8Array(32).fill(9),
    proofBytes: new Uint8Array(256).fill(3),
    pool: pk('11111111111111111111111111111112'),
    merkleTree: pk('11111111111111111111111111111113'),
    vault: pk('11111111111111111111111111111114'),
    destinationTokenAccount: pk('11111111111111111111111111111115'),
    nullifierRecord: pk('11111111111111111111111111111116'),
    feePayer: pk('11111111111111111111111111111117'),
    wchangeVk: pk('11111111111111111111111111111118'),
  };

  it('uses the global:withdraw_with_change discriminator', () => {
    const ix = buildWithdrawWithChangeIx(base);
    const disc = sha256(Buffer.from('global:withdraw_with_change')).slice(0, 8);
    expect(Buffer.from(ix.data.subarray(0, 8))).toEqual(Buffer.from(disc));
  });

  it('lays out data: disc + root(32) + nullifier(32) + amount(u64 LE) + change_commitment(32) + len(u32) + proof', () => {
    const ix = buildWithdrawWithChangeIx(base);
    expect(ix.data.length).toBe(8 + 32 + 32 + 8 + 32 + 4 + 256);
    expect(ix.data[8 + 64]).toBe(200);              // amount LE
    expect(ix.data[8 + 64 + 8]).toBe(9);            // first change_commitment byte
    const lenOff = 8 + 32 + 32 + 8 + 32;
    expect(ix.data[lenOff]).toBe(256 & 0xff);
    expect(ix.data[lenOff + 1]).toBe((256 >> 8) & 0xff);
  });

  it('orders accounts: WithdrawCtx then wchange_vk (ro), correct flags', () => {
    const ix = buildWithdrawWithChangeIx(base);
    const keys = ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);
    expect(keys).toEqual([
      [base.pool.toBase58(), false, false],
      [base.merkleTree.toBase58(), false, true],
      [base.vault.toBase58(), false, true],
      [base.destinationTokenAccount.toBase58(), false, true],
      [base.nullifierRecord.toBase58(), false, true],
      [base.feePayer.toBase58(), true, true],
      [TOK, false, false],
      [SYS, false, false],
      [base.wchangeVk.toBase58(), false, false],  // appended last (SYNC POINT: confirm position)
    ]);
  });

  it('rejects wrong lengths', () => {
    expect(() => buildWithdrawWithChangeIx({...base, changeCommitment: new Uint8Array(10)})).toThrow();
    expect(() => buildWithdrawWithChangeIx({...base, proofBytes: new Uint8Array(10)})).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=withdrawChangeIx`
Expected: FAIL — `buildWithdrawWithChangeIx` is not exported.

- [ ] **Step 3: Implement**

In `src/modules/shielded/poolInstructions.ts`, add (reuse private `discriminator`, `u64le`, `u32le`, `PROGRAM`, `SPL_TOKEN_PROGRAM_ID`, `SystemProgram`):

```ts
export const withdrawChangeDiscriminator = (): Uint8Array => discriminator('withdraw_with_change');

export interface WithdrawWithChangeIxParams {
  merkleRoot: Uint8Array;      // 32
  nullifier: Uint8Array;       // 32
  amount: bigint;
  changeCommitment: Uint8Array; // 32
  proofBytes: Uint8Array;      // 256
  pool: PublicKey;
  merkleTree: PublicKey;
  vault: PublicKey;
  destinationTokenAccount: PublicKey;
  nullifierRecord: PublicKey;
  feePayer: PublicKey;
  wchangeVk: PublicKey;
}

/**
 * withdraw_with_change(merkle_root[32], nullifier[32], amount:u64, change_commitment[32], proof_bytes).
 * Data = disc(8) + merkle_root(32) + nullifier(32) + amount(u64 LE) + change_commitment(32) + len(u32 LE) + proof.
 * Accounts (WithdrawWithChangeCtx order): the 8 WithdrawCtx accounts + wchange_vk (ro).
 * SYNC POINT: the wchange_vk position is assumed appended LAST; confirm vs the ICO's final ctx at deploy.
 */
export function buildWithdrawWithChangeIx(p: WithdrawWithChangeIxParams): TransactionInstruction {
  if (p.merkleRoot.length !== 32) throw new Error('merkleRoot must be 32 bytes');
  if (p.nullifier.length !== 32) throw new Error('nullifier must be 32 bytes');
  if (p.changeCommitment.length !== 32) throw new Error('changeCommitment must be 32 bytes');
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');

  const data = Buffer.concat([
    Buffer.from(withdrawChangeDiscriminator()),
    Buffer.from(p.merkleRoot),
    Buffer.from(p.nullifier),
    Buffer.from(u64le(p.amount)),
    Buffer.from(p.changeCommitment),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: p.pool, isSigner: false, isWritable: false},
      {pubkey: p.merkleTree, isSigner: false, isWritable: true},
      {pubkey: p.vault, isSigner: false, isWritable: true},
      {pubkey: p.destinationTokenAccount, isSigner: false, isWritable: true},
      {pubkey: p.nullifierRecord, isSigner: false, isWritable: true},
      {pubkey: p.feePayer, isSigner: true, isWritable: true},
      {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      {pubkey: p.wchangeVk, isSigner: false, isWritable: false},
    ],
    data,
  });
}
```

- [ ] **Step 4: Run test + tsc**

Run: `npx jest --testPathPattern=withdrawChangeIx` (PASS, 4 tests), `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/poolInstructions.ts src/modules/shielded/__tests__/withdrawChangeIx.test.ts
git commit -m "feat(shielded): buildWithdrawWithChangeIx (change_commitment arg + wchange_vk account)"
```

---

### Task 5: `proveShielded` proofType `withdraw_change`

**Files:**
- Modify: `src/modules/zkProver/zkProverModule.ts`
- Test: `src/modules/zkProver/__tests__/zkProverModule.test.ts` (extend if a withdraw case exists; else add a minimal one)

- [ ] **Step 1: Write the failing test**

Add to the zkProver test suite (reuse its `pinnedFetch` mock; mirror the existing withdraw/deposit proveShielded test):

```ts
it('proveShielded forwards proofType "withdraw_change" and returns proofBytes/publicInputs', async () => {
  // (Reuse the file's existing fetch mock; it should resolve
  //  {success:true, proofBytes:'00'.repeat(256), publicInputs:['1','2','3','4','5','6']}.)
  const res = await proveShielded('withdraw_change', {withdrawAmount: '200'});
  expect(res.proofBytes.length).toBe(512); // 256 bytes hex
  expect(res.publicInputs).toHaveLength(6);
});
```

If the test file has no reusable mock shape, model it on the existing `proveShielded('withdraw', ...)` test in the same file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=zkProverModule`
Expected: FAIL — TS error: `'withdraw_change'` not assignable to the proofType union.

- [ ] **Step 3: Implement**

In `src/modules/zkProver/zkProverModule.ts`, widen the `proveShielded` signature:

```ts
export async function proveShielded(
  proofType: 'deposit' | 'withdraw' | 'withdraw_change',
  params: ShieldedProveParams,
): Promise<ShieldedProveResult> {
```

(No other change — the body already forwards `proofType` in the POST body and returns `{proofBytes, publicInputs, proofData}`.)

- [ ] **Step 4: Run test + tsc**

Run: `npx jest --testPathPattern=zkProverModule` (PASS), `npx tsc --noEmit` (clean).

- [ ] **Step 5: Commit**

```bash
git add src/modules/zkProver/zkProverModule.ts src/modules/zkProver/__tests__/zkProverModule.test.ts
git commit -m "feat(shielded): proveShielded accepts withdraw_change proofType"
```

---

### Task 6: `unshieldWithChange` flow

**Files:**
- Modify: `src/modules/shielded/withdrawFlow.ts`
- Test: `src/modules/shielded/__tests__/withdrawChangeFlow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/withdrawChangeFlow.test.ts
import {Keypair} from '@solana/web3.js';

jest.mock('../merkleSync', () => ({syncLeaves: jest.fn()}));
jest.mock('../withdrawChangeWitness', () => ({
  buildWithdrawChangeWitness: jest.fn(() => ({
    params: {withdrawAmount: '200'},
    nullifier32: new Uint8Array(32).fill(2),
    merkleRoot32: new Uint8Array(32).fill(1),
    changeCommitment32: new Uint8Array(32).fill(9),
    changeCommitmentDec: '12345',
    changeAmount: 300n,
  })),
}));
jest.mock('../../zkProver/zkProverModule', () => ({
  proveShielded: jest.fn(async () => ({proofBytes: '00'.repeat(256), publicInputs: ['a','b','c','d','e','12345'], proofData: ''})),
}));
jest.mock('../poolTx', () => ({submitPoolTxMany: jest.fn(async () => 'SIG')}));
jest.mock('../noteStore', () => ({markSpentByIndex: jest.fn(), addNote: jest.fn()}));
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({
    getTransaction: jest.fn(async () => ({meta: {err: null, logMessages: [`Program data: ${Buffer.concat([Buffer.alloc(8), Buffer.alloc(32,9), (() => {const b=Buffer.alloc(8); b.writeUInt32LE(7,0); return b;})(), Buffer.alloc(32)]).toString('base64')}`]}})),
  }),
}));
jest.mock('../../store/mmkv/instances', () => ({mmkvSecure: () => ({}), initSecureMmkv: jest.fn()}));

import {unshieldWithChange, MerkleRootStaleError} from '../withdrawFlow';
import {syncLeaves} from '../merkleSync';
import {markSpentByIndex, addNote} from '../noteStore';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const note: ShieldedNote = {commitment: 'c', nullifier: '', mint: MINT, amount: 500n, index: 0, spent: false, createdAt: 1, noteSecret: '9'};
const feePayer = Keypair.generate();
const seed = new Uint8Array(32).fill(3);
const rootHex = '01'.repeat(32);

describe('unshieldWithChange', () => {
  beforeEach(() => jest.clearAllMocks());

  it('proves, submits, marks input spent, and stores the change note by its LeafInserted leaf_index', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: [rootHex]});
    const res = await unshieldWithChange(seed, feePayer, MINT, note, 200n);
    expect(res.withdrawn).toBe(200n);
    expect(res.change).toBe(300n);
    expect(markSpentByIndex).toHaveBeenCalledWith(MINT, 0);
    expect(addNote).toHaveBeenCalledWith(expect.objectContaining({
      commitment: '12345', mint: MINT, amount: 300n, index: 7, spent: false, noteSecret: expect.any(String),
    }));
  });

  it('throws MerkleRootStaleError before proving when the root is absent', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: ['ab'.repeat(32)]});
    await expect(unshieldWithChange(seed, feePayer, MINT, note, 200n)).rejects.toBeInstanceOf(MerkleRootStaleError);
    expect(markSpentByIndex).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=withdrawChangeFlow`
Expected: FAIL — `unshieldWithChange` is not exported.

- [ ] **Step 3: Implement**

In `src/modules/shielded/withdrawFlow.ts`, add imports and the new function (keep `unshield` and `MerkleRootStaleError` unchanged):

```ts
import {buildWithdrawChangeWitness} from './withdrawChangeWitness';
import {buildWithdrawWithChangeIx} from './poolInstructions';
import {wchangeVkPda} from './poolPdas';
import {addNote} from './noteStore';
import {randomFieldElement} from './noteCrypto';
import {parseDepositEvents} from './depositEvents';
```

(Several of these — `poolPda/merkleTreePda/vaultAta/nullifierPda`, `findAssociatedTokenAddress`, `buildCreateAtaIdempotentInstruction`, `submitPoolTxMany`, `markSpentByIndex`, `getConnection`, `proveShielded`, `hexToBytes`, `bytesToHex`, `SHIELDED_CU`, `ensureSecureMmkv`, `sleep`, `PublicKey` — are already imported by the existing `unshield`; add only the missing ones above.)

```ts
export interface UnshieldWithChangeResult {txSignature: string; withdrawn: bigint; change: bigint;}

/**
 * Partial unshield (change-output): withdraw `withdrawAmount` from `note`, and
 * reinsert the remainder as a self-change note stored locally. Routes ALL
 * unshields (whole-note = changeAmount 0). Marks the input note spent and stores
 * the change note ONLY after a confirmed, non-reverted tx.
 */
export async function unshieldWithChange(
  seed: Uint8Array,
  feePayer: Keypair,
  mintBase58: string,
  note: ShieldedNote,
  withdrawAmount: bigint,
): Promise<UnshieldWithChangeResult> {
  ensureSecureMmkv(seed);
  const mint = new PublicKey(mintBase58);
  const destTokenAccount = findAssociatedTokenAddress(feePayer.publicKey, mint);

  const {leaves, onChainRoots} = await syncLeaves(mintBase58);
  const changeNoteSecret = randomFieldElement();

  const w = buildWithdrawChangeWitness({
    seed, note, withdrawAmount, changeNoteSecret, destTokenAccount, leaves,
  });

  if (!onChainRoots.includes(bytesToHex(w.merkleRoot32))) {
    throw new MerkleRootStaleError();
  }

  const proof = await proveShielded('withdraw_change', w.params);
  // The circuit outputs changeCommitment as publicInputs[5]; it MUST match our
  // locally computed one, else the prover used different inputs — abort (no tx).
  if (proof.publicInputs[5] !== w.changeCommitmentDec) {
    throw new Error('Prover changeCommitment mismatch — aborting unshield');
  }
  const proofBytes = hexToBytes(proof.proofBytes);
  if (proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');

  const pool = poolPda(mint);
  const withdrawIx = buildWithdrawWithChangeIx({
    merkleRoot: w.merkleRoot32,
    nullifier: w.nullifier32,
    amount: withdrawAmount,
    changeCommitment: w.changeCommitment32,
    proofBytes,
    pool,
    merkleTree: merkleTreePda(pool),
    vault: vaultAta(pool, mint),
    destinationTokenAccount: destTokenAccount,
    nullifierRecord: nullifierPda(w.nullifier32),
    feePayer: feePayer.publicKey,
    wchangeVk: wchangeVkPda(pool),
  });
  const createAtaIx = buildCreateAtaIdempotentInstruction(
    feePayer.publicKey, destTokenAccount, feePayer.publicKey, mint,
  );

  const txSignature = await submitPoolTxMany(
    [createAtaIx, withdrawIx], SHIELDED_CU.withdrawChange, feePayer,
  );

  const connection = getConnection();
  let tx = null;
  for (let attempt = 0; attempt < 5 && tx === null; attempt++) {
    tx = await connection.getTransaction(txSignature, {
      maxSupportedTransactionVersion: 0, commitment: 'confirmed',
    });
    if (tx === null && attempt < 4) await sleep(1000);
  }
  if (tx === null) {
    throw new Error(`Withdraw ${txSignature} confirmed but could not be fetched to verify — leaving the note unspent; retry to resync`);
  }
  if (tx.meta?.err) {
    throw new Error(`withdraw_with_change reverted on-chain: ${JSON.stringify(tx.meta.err)}`);
  }

  markSpentByIndex(mintBase58, note.index);

  // Store the change note (unless it's the junk zero-value note). Its on-chain
  // leaf_index comes from the LeafInserted event in THIS tx (the only >=80-B
  // Program-data line; the Withdraw event is 40 B and parses to nothing here).
  if (w.changeAmount > 0n) {
    const events = parseDepositEvents(tx.meta?.logMessages ?? []);
    if (events.length === 0) throw new Error('LeafInserted event not found for the change note');
    addNote({
      commitment: w.changeCommitmentDec,
      nullifier: '',
      mint: mintBase58,
      amount: w.changeAmount,
      index: events[0]!.leafIndex,
      spent: false,
      createdAt: Date.now(),
      noteSecret: changeNoteSecret.toString(),
    });
  }

  return {txSignature, withdrawn: withdrawAmount, change: w.changeAmount};
}
```

- [ ] **Step 4: Run test + tsc + eslint**

Run: `npx jest --testPathPattern=withdrawChangeFlow` (PASS, 2 tests), `npx tsc --noEmit` (clean), `npx eslint src/modules/shielded/withdrawFlow.ts` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/withdrawFlow.ts src/modules/shielded/__tests__/withdrawChangeFlow.test.ts
git commit -m "feat(shielded): unshieldWithChange — partial unshield + self-change note storage"
```

---

### Task 7: ShieldUnshieldScreen — arbitrary amount, max = largest note

**Files:**
- Modify: `src/screens/shielded/ShieldUnshieldScreen.tsx`
- Test: `src/screens/shielded/__tests__/ShieldUnshieldScreen.test.tsx`

Context: after PR #48, the screen already computes `largestNoteRaw` (largest unspent note) for the public direction and `handleMax` already fills it. The remaining change is the VALIDATION: whole-note required an exact-note amount; partial requires only `W ≤ largest note`. Replace the whole-note gating with `W ≤ largestNote`.

- [ ] **Step 1: Write the failing test**

Add to `src/screens/shielded/__tests__/ShieldUnshieldScreen.test.tsx` (the suite already mocks `noteStore` with two notes 0.2 + 0.3 = raw 200000000 + 300000000; reuse it):

```ts
it('unshield accepts an arbitrary amount <= the largest note (partial)', () => {
  const {getByRole, getByTestId} = render(<ShieldUnshieldScreen onBack={jest.fn()} />);
  fireEvent.press(getByRole('tab', {name: 'Make public'}));
  fireEvent.changeText(getByTestId('shield-amount-input'), '0.25'); // < 0.3 (largest note)
  fireEvent.press(getByTestId('shield-cta'));
  expect(mockNavigate).toHaveBeenCalledWith(
    'ZkProofModal',
    expect.objectContaining({direction: 'public', mint: TEST_MINT, amount: '250000000'}),
  );
});

it('unshield CTA is disabled when W exceeds the largest note', () => {
  const {getByRole, getByTestId} = render(<ShieldUnshieldScreen onBack={jest.fn()} />);
  fireEvent.press(getByRole('tab', {name: 'Make public'}));
  fireEvent.changeText(getByTestId('shield-amount-input'), '0.35'); // > 0.3 largest note
  expect(getByTestId('shield-cta').props.accessibilityState?.disabled).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=ShieldUnshield`
Expected: FAIL — the 0.25 partial submit is currently blocked / the 0.35 case isn't gated by largest-note.

- [ ] **Step 3: Implement**

In `src/screens/shielded/ShieldUnshieldScreen.tsx`, in the public direction validation, gate on the largest note (raw) rather than the vault sum. Where `insufficient` / `canSubmit` is computed, add a public-direction bound using the existing `largestNoteRaw` (already memoized) converted to display units, OR compare raw. The cleanest: compute a public-direction max and use it in the `insufficient` check.

Add near the existing `vaultBalance`/`largestNoteRaw` memos:

```ts
// Max withdrawable in one unshield = the largest single note (1-input circuit).
const maxUnshield = useMemo(() => {
  if (direction !== 'public') return sourceBalance;
  return largestNoteRaw === null ? 0 : Number(largestNoteRaw) / 10 ** tokenMeta.decimals;
}, [direction, largestNoteRaw, tokenMeta.decimals, sourceBalance]);
```

Then change the insufficiency check for the public direction to compare against `maxUnshield`:

```ts
const insufficient = hasAmount && parsed > maxUnshield;
```

(For the private direction `maxUnshield === sourceBalance`, so behavior is unchanged.) If the screen shows an "insufficient" helper, make the public-direction copy read: `Max per unshield: <maxUnshield> <symbol> (your largest shielded note)`. Locate the existing insufficient-helper Text and branch its message on `direction === 'public'`.

Leave `handleMax` (already fills `largestNoteRaw` for public) and the nav param (`amount: parseTokenAmount(amount, decimals)`) unchanged — `amount` is now an arbitrary `W`, no longer required to equal a note.

- [ ] **Step 4: Run test + tsc + eslint**

Run: `npx jest --testPathPattern=ShieldUnshield` (PASS), `npx tsc --noEmit` (clean), `npx eslint src/screens/shielded/ShieldUnshieldScreen.tsx` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add src/screens/shielded/ShieldUnshieldScreen.tsx src/screens/shielded/__tests__/ShieldUnshieldScreen.test.tsx
git commit -m "feat(shielded): unshield accepts arbitrary amount <= largest note (partial)"
```

---

### Task 8: ZkProofScreen — route public → unshieldWithChange + dig/change success

**Files:**
- Modify: `src/screens/shielded/ZkProofScreen.tsx`
- Test: `src/screens/shielded/__tests__/ZkProofScreen.test.tsx`

Context: after PR #48 the `direction === 'public'` branch of `runShieldOp` does an EXACT note match then calls `unshield` (whole-note). Replace that with best-fit selection + `unshieldWithChange`.

- [ ] **Step 1: Write the failing test**

Update the existing public-direction mocks + add a partial test. The file currently mocks `withdrawFlow.unshield` + `noteStore.getNotes`. Add `unshieldWithChange` + `noteSelect.selectInputNote`:

```ts
jest.mock('../../../modules/shielded/withdrawFlow', () => ({
  unshield: jest.fn(),
  unshieldWithChange: jest.fn(async () => ({txSignature: 'WSIG', withdrawn: 200_000_000n, change: 300_000_000n})),
  MerkleRootStaleError: class extends Error {},
}));
jest.mock('../../../modules/shielded/noteSelect', () => ({
  selectInputNote: jest.fn(() => ({commitment: 'c', nullifier: '', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', amount: 500_000_000n, index: 0, spent: false, createdAt: 1, noteSecret: '9'})),
}));
```

Then a test rendering with `route.params = {direction:'public', amount:'200000000', mint:'B61Sy...'}` that drives to completion (reuse the existing deposit/withdraw test harness) and asserts `unshieldWithChange` was called with `(seed, feePayer, mint, note, 200000000n)` and the success screen shows "Unshielded" + "Kept private". Model the harness on the existing public-direction test.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=ZkProofScreen`
Expected: FAIL — screen still calls the old `unshield` exact-match path.

- [ ] **Step 3: Implement**

In `src/screens/shielded/ZkProofScreen.tsx`:
- Add imports:
```ts
import {unshieldWithChange} from '../../modules/shielded/withdrawFlow';
import {selectInputNote} from '../../modules/shielded/noteSelect';
```
- Replace the `direction === 'public'` branch of `runShieldOp` (currently exact-note match + `unshield`) with best-fit selection + partial unshield:
```ts
// direction === 'public' → partial unshield (change-output).
const W = BigInt(params.amount);
const note = selectInputNote(mint, W);
if (!note) {
  throw new Error('No single shielded note covers this amount — unshield a smaller amount');
}
const result = await unshieldWithChange(seed, feePayer, mint, note, W);
return {txSignature: result.txSignature, leafIndex: note.index};
```
Keep the seed zeroization (try/finally) and the deposit branch unchanged. Remove the now-unused `getNotes`/`unshield` imports if nothing else uses them.
- Success screen (`state.kind === 'ready'`, `direction === 'public'`): the withdrawn amount is `route.params.amount` (already shown via the existing `amountTokens`). Add a "Kept private" sub-line when there is change. Since `runShieldOp` returns only `{txSignature, leafIndex}`, compute change for display from the params + selected note is not available in the ready block; instead show the withdrawn amount as the hero and a generic private-remainder note. Simplest correct approach: keep the hero = "Unshielded `<amountTokens>` `<symbol>`" and add a static sub-line "Any remainder stays shielded." OR thread the change through the outcome. **Chosen:** thread it — extend the outcome type to carry `change`:
  - Change `ShieldOutcome`/`DepositOutcome` to `{txSignature: string; leafIndex: number; change?: bigint}`; in the public branch return `{..., change: result.change}`; in the deposit branch omit `change`.
  - In the ready block: `const change = state.outcome.change ?? 0n;` and render, below the hero amount, when `change > 0n`: `Kept private: ${formatTokenAmount(change, decimals)} ${symbol}` (import `formatTokenAmount` from `../../utils/parseTokenAmount`).
  - Hero copy for public stays "Unshielded" (from PR #48).

- [ ] **Step 4: Run test + tsc + eslint**

Run: `npx jest --testPathPattern=ZkProofScreen` (PASS — deposit + whole/partial public), `npx tsc --noEmit` (clean), `npx eslint src/screens/shielded/ZkProofScreen.tsx` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add src/screens/shielded/ZkProofScreen.tsx src/screens/shielded/__tests__/ZkProofScreen.test.tsx
git commit -m "feat(shielded): ZkProofScreen routes public to partial unshield + shows kept-private change"
```

---

### Task 9: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check, tests, lint**

Run:
```bash
npx tsc --noEmit
npx jest
npx eslint src/modules/shielded src/modules/zkProver src/screens/shielded
```
Expected: tsc clean; all Jest suites pass; eslint 0 errors (pre-existing warnings OK).

- [ ] **Step 2: Deposit + whole-note regression**

Run: `npx jest --testPathPattern='depositFlow|poolInstructions|withdrawFlow|withdrawIx|ZkProofScreen|ShieldUnshield'`
Expected: PASS — deposit and the existing whole-note withdraw code are behaviorally intact (whole-note `unshield` stays exported; the UI/flow now route through `unshieldWithChange`).

- [ ] **Step 3: (Handled by controller)**

On-device devnet verification waits on the ICO deploy + the SYNC POINTS (wchange_vk account position, measured CU, proofType). Build the devnet APK (`cd android && ENVFILE=.env.devnet ./gradlew assembleRelease` → `/home/user/Downloads/noctura-devnet-shielded.apk`) only AFTER the deploy sync.

---

## On-device acceptance (user, after ICO devnet deploy + sync)

- Shield 0.5 (one note) → "Make public", enter 0.2 → Unshield → success shows "Unshielded 0.2 · Kept private 0.3"; transparent += 0.2; shielded dashboard shows a 0.3 change note.
- Unshield the 0.3 change note (proves it's spendable) → transparent += 0.3; shielded → 0.
- Enter an amount above the largest note → CTA disabled with the max-per-unshield message.
- Double-spend of a spent note → rejected on-chain (nullifier).

## Pre-execution SYNC with the ICO (do at their deploy)

Confirm + adjust these literals only: `wchange_vk` account position in `buildWithdrawWithChangeIx` (Task 4), `SHIELDED_CU.withdrawChange` (Task 1), proofType `withdraw_change` (Task 5), and that `/zk/prove` returns `publicInputs[5] = changeCommitment` (Task 6 cross-check).
