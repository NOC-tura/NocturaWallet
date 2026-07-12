# Private Transfer (send + receive) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Private p2p transfer — send (spend note(s) → recipient output + self-change, no transparent leg) and receive (scan `NoteCiphertext` events, trial-decrypt, store).

**Architecture:** Reuse the whole P1 + note-encryption stack. New: transfer witness (2-in/2-out), `buildTransferIx`, `transferFlow`, `ShieldedTransferScreen` wiring (send); `NoteCiphertext` event parse, a session view-key cache, `noteScan`, dashboard-focus scan (receive).

**Tech Stack:** RN 0.84 / TS strict, @noble/curves/hashes/ciphers, poseidon-lite, @solana/web3.js, MMKV, Jest. Spec: `docs/superpowers/specs/2026-07-08-private-transfer-design.md`.

**Deployed contract (ground truth):** program `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES`, pool `sgLH…`, merkle_tree `5wUc…`, `transfer_vk` `GSzK…` = `["transfer_vk", pool]` (verified). `transfer(merkle_root[32], nullifier_0[32], nullifier_1[32], out_commitment_0[32], out_commitment_1[32], proof_bytes(256), ciphertext_0(128), ciphertext_1(128))`; TransferCtx accounts IN ORDER: `pool`(ro), `merkle_tree`(mut), `nullifier_record_0`(init `["nullifier",n0]`), `nullifier_record_1`(init `["nullifier",n1]`), `fee_payer`(signer,mut), `transfer_vk`(ro), `system_program`. Public inputs 6: `[merkleRoot, nullifier_0, nullifier_1, outCommitment_0, outCommitment_1, mintHash]`. proofType `transfer`. `NoteCiphertext{leaf_index:u64, ciphertext:Vec<u8>=128}` event (borsh: disc8 + leaf_index8 LE + len4 LE + 128 = 148 B).

**Exact circom signal names (params keys must match verbatim):** public `merkleRoot, nullifier_0, nullifier_1, outCommitment_0, outCommitment_1, mintHash`; private `in_noteSecret[2], in_pkRecipientHash[2], in_amount[2], in_leafIndex[2], in_merklePath[2][20], in_merklePathIndices[2][20], in_isDummy[2], out_pkRecipientHash[2], out_amount[2], out_noteSecret[2]`.

**Reused helpers (read before starting):** `noteCrypto` (`nullifier`, `mintHash`, `pkRecipientHash`, `noteCommitment`, `randomFieldElement`, `bytesToBigIntBE`), `shieldedIdentity` (`getPkRecipientHash`, `getViewPublicKey`), `keyDerivation/shielded` (`deriveShieldedViewKey`), `fieldCodec` (`decToBe32`, `hexToDec`, `decToHex64`, `bytesToHex`, `hexToBytes`), `merkleModule.computeMerklePath`, `merkleSync.syncLeaves`, `noteEncryption` (`encryptNote`, `tryDecryptNote`), `shieldedAddressCodec.decodeShieldedAddress`, `noteStore` (`getNotes`, `addNote`, `markSpentByCommitment`, `setNoteIndex`), `poolPdas` (`poolPda`, `merkleTreePda`, `nullifierPda`), `poolInstructions` (private `discriminator`/`u64le`/`u32le`/`PROGRAM`/`SystemProgram`), `poolTx.submitPoolTxMany`, `withdrawFlow` patterns (`ensureSecureMmkv`, `MerkleRootStaleError`), `leafResolver.resolveLeafIndex`, `zkProverModule` (`proveShielded`, `warmProver`), `store/mmkv/instances.mmkvPublic`, `solana/connection.getConnection`.

**SYNC POINTS (adjust at build/e2e, don't block):** `transfer_vk` position (contract = index 5); `SHIELDED_CU.transfer` (default 250k, ICO measured ~181k); the `NoteCiphertext` borsh layout; proofType `transfer`.

Commands: `npx jest --testPathPattern=<n>`, `npx tsc --noEmit`, `npx eslint <f>`.

---

### Task 1: `transferVkPda` + `SHIELDED_CU.transfer` + widen `ShieldedProveParams`

**Files:**
- Modify: `src/modules/shielded/poolPdas.ts`, `src/constants/programs.ts`, `src/modules/zkProver/types.ts`
- Test: `src/modules/shielded/__tests__/poolPdas.test.ts`

- [ ] **Step 1: Failing test** — append to `poolPdas.test.ts`:

```ts
import {transferVkPda} from '../poolPdas';
describe('transferVkPda', () => {
  it('derives ["transfer_vk", pool] and matches the deployed address', () => {
    const {PublicKey} = require('@solana/web3.js');
    const pool = poolPda(new PublicKey('AtjVK2z561wDYo5EvougJKAo9AJ4KdduxSbiF173aiAe'));
    expect(transferVkPda(pool).toBase58()).toBe('GSzK9VzLqUdAQgJPW9LVLx9vuXpuuSRnHPE4q3zar3Ss');
  });
});
```

- [ ] **Step 2:** `npx jest --testPathPattern=poolPdas` → FAIL.

- [ ] **Step 3:** In `poolPdas.ts` add (after `wchangeVkPda`):
```ts
/** transfer VK account PDA: ["transfer_vk", pool]. */
export function transferVkPda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('transfer_vk'), pool.toBuffer()], PROGRAM)[0];
}
```
In `constants/programs.ts`, add `transfer` to `SHIELDED_CU`:
```ts
export const SHIELDED_CU = {deposit: 200_000, withdraw: 250_000, withdrawChange: 250_000, transfer: 250_000} as const;
```
In `zkProver/types.ts`, widen `ShieldedProveParams` to allow the transfer circuit's nested `in_merklePath[2][20]`:
```ts
export type ShieldedProveParams = Record<string, string | string[] | string[][] | number[]>;
```

- [ ] **Step 4:** `npx jest --testPathPattern=poolPdas` PASS; `npx tsc --noEmit` clean (the widened type is a superset — existing callers unaffected).

- [ ] **Step 5:** Commit:
```bash
git add src/modules/shielded/poolPdas.ts src/constants/programs.ts src/modules/zkProver/types.ts src/modules/shielded/__tests__/poolPdas.test.ts
git commit -m "feat(shielded): transfer_vk PDA + transfer CU + widen prove params for nested arrays"
```

---

### Task 2: best-fit transfer input selection

**Files:**
- Modify: `src/modules/shielded/noteSelect.ts`
- Test: `src/modules/shielded/__tests__/noteSelect.test.ts`

Select 1 or 2 real input notes to fund `target` (the transfer circuit is 2-in).

- [ ] **Step 1: Failing test** — append:
```ts
import {selectTransferInputs} from '../noteSelect';
describe('selectTransferInputs', () => {
  const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
  const note = (amount: bigint, index: number): ShieldedNote => ({
    commitment: `c${index}`, nullifier: '', mint: MINT, amount, index, spent: false, createdAt: index, noteSecret: `s${index}`,
  });
  it('picks the smallest single note >= target when one exists', () => {
    const notes = [note(100n, 0), note(300n, 1), note(200n, 2)];
    const sel = selectTransferInputs(notes, 150n);
    expect(sel!.map(n => n.amount)).toEqual([200n]);
  });
  it('picks the two largest notes when no single note covers the target', () => {
    const notes = [note(100n, 0), note(300n, 1), note(200n, 2)];
    const sel = selectTransferInputs(notes, 450n); // 300+200 = 500 >= 450
    expect(sel!.map(n => n.amount).sort()).toEqual([200n, 300n]);
  });
  it('returns null when even the two largest cannot cover the target', () => {
    const notes = [note(100n, 0), note(300n, 1), note(200n, 2)];
    expect(selectTransferInputs(notes, 600n)).toBeNull(); // max 2 = 500
  });
});
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Add to `noteSelect.ts`:
```ts
/**
 * Select 1 or 2 real input notes to fund `target` for a 2-in transfer.
 * Best-fit: the smallest single note >= target; else the two largest notes if
 * they sum to >= target; else null (target exceeds the two-largest capacity).
 */
export function selectTransferInputs(notes: ShieldedNote[], target: bigint): ShieldedNote[] | null {
  const single = selectBestFit(notes, target);
  if (single) return [single];
  const sorted = [...notes].sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0));
  if (sorted.length >= 2 && sorted[0]!.amount + sorted[1]!.amount >= target) {
    return [sorted[0]!, sorted[1]!];
  }
  return null;
}

/** Max transferable in one tx = the sum of the two largest notes (2-in circuit). */
export function maxTransferable(notes: ShieldedNote[]): bigint {
  const sorted = [...notes].sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0));
  return (sorted[0]?.amount ?? 0n) + (sorted[1]?.amount ?? 0n);
}
```

- [ ] **Step 4:** `npx jest --testPathPattern=noteSelect` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5:** Commit:
```bash
git add src/modules/shielded/noteSelect.ts src/modules/shielded/__tests__/noteSelect.test.ts
git commit -m "feat(shielded): best-fit 1-or-2 input selection for transfer"
```

---

### Task 3: `transferWitness.ts` (2-in / 2-out)

**Files:**
- Create: `src/modules/shielded/transferWitness.ts`
- Test: `src/modules/shielded/__tests__/transferWitness.test.ts`

- [ ] **Step 1: Failing test**

```ts
import {PublicKey} from '@solana/web3.js';
import {buildTransferWitness} from '../transferWitness';
import {nullifier, mintHash, noteCommitment, pkRecipientHash} from '../noteCrypto';
import {getPkRecipientHash} from '../shieldedIdentity';
import {decToHex64} from '../fieldCodec';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const seed = new Uint8Array(32).fill(7);
import {getViewPublicKey} from '../shieldedIdentity';
// recipient view key (48-B G1) — a real point so pkRecipientHash composes
const recipientViewKeyG1 = getViewPublicKey(new Uint8Array(32).fill(9));

function note(amount: bigint, index: number, secret: string): ShieldedNote {
  return {commitment: 'x', nullifier: '', mint: MINT, amount, index, spent: false, createdAt: 1, noteSecret: secret};
}

describe('buildTransferWitness', () => {
  it('1 real input + dummy: value split, dummy fields, recipient vs self outputs, 6-order params', () => {
    const input = note(500n, 0, '111');
    const leaves = [decToHex64('x0')]; // computeMerklePath needs the leaf present; use the note's on-chain hex
    // Build leaves so index 0 holds this note's commitment. The witness recomputes
    // the INPUT commitment internally; for the merkle path we just need SOME leaves.
    const w = buildTransferWitness({
      seed, realInputs: [{...input, commitment: decToHex64('999')}], recipientViewKeyG1, mint: MINT,
      transferAmount: 200n, leaves: [decToHex64('999')], outNoteSecrets: [77n, 88n], dummyNoteSecret: 5n,
    });
    const mH = mintHash(new PublicKey(MINT).toBytes());
    const pkHself = getPkRecipientHash(seed);
    const recipPkH = pkRecipientHash(recipientViewKeyG1);
    // value split
    expect(w.change).toBe(300n);
    expect((w.params.out_amount as string[])).toEqual(['200', '300']);
    // input 0 real, input 1 dummy
    expect((w.params.in_isDummy as string[])).toEqual(['0', '1']);
    expect((w.params.in_amount as string[])[1]).toBe('0');
    // nullifiers
    expect(w.params.nullifier_0).toBe(nullifier({noteSecret: 111n, leafIndex: 0}).toString());
    expect(w.params.nullifier_1).toBe(nullifier({noteSecret: 5n, leafIndex: 0}).toString());
    // outputs: 0 = recipient, 1 = self change
    expect((w.params.out_pkRecipientHash as string[])[0]).toBe(recipPkH.toString());
    expect((w.params.out_pkRecipientHash as string[])[1]).toBe(pkHself.toString());
    expect(w.params.outCommitment_0).toBe(noteCommitment({pkRecipientHash: recipPkH, amount: 200n, mintHash: mH, noteSecret: 77n}).toString());
    expect(w.params.outCommitment_1).toBe(noteCommitment({pkRecipientHash: pkHself, amount: 300n, mintHash: mH, noteSecret: 88n}).toString());
    // arrays are 2 / [2][20]
    expect((w.params.in_merklePath as string[][]).length).toBe(2);
    expect((w.params.in_merklePath as string[][])[0]!.length).toBe(20);
    expect(w.nullifier32[0]!.length).toBe(32);
    expect(w.outCommitment32[1]!.length).toBe(32);
    expect(w.merkleRoot32.length).toBe(32);
    expect(w.recipientOut).toEqual({commitment: w.outCommitmentDec[0], amount: 200n, noteSecret: 77n});
    expect(w.changeOut).toEqual({commitment: w.outCommitmentDec[1], amount: 300n, noteSecret: 88n});
  });

  it('rejects a transfer amount greater than the inputs', () => {
    expect(() => buildTransferWitness({
      seed, realInputs: [note(100n, 0, '1')], recipientViewKeyG1, mint: MINT,
      transferAmount: 200n, leaves: [decToHex64('1')], outNoteSecrets: [1n, 2n], dummyNoteSecret: 3n,
    })).toThrow();
  });
});
```

Note for implementer: `computeMerklePath(leaves, index)` requires `index < leaves.length`; give the note `index: 0` and a 1-element `leaves`. The witness does NOT verify the input commitment matches the leaf (that's the circuit's job on the real chain) — for the unit test the merkle path just needs to compute.

- [ ] **Step 2:** FAIL (module not found).

- [ ] **Step 3:** Create `src/modules/shielded/transferWitness.ts`:

```ts
import {PublicKey} from '@solana/web3.js';
import {nullifier, mintHash, pkRecipientHash, noteCommitment} from './noteCrypto';
import {getPkRecipientHash} from './shieldedIdentity';
import {computeMerklePath} from '../merkle/merkleModule';
import {decToBe32, hexToDec} from './fieldCodec';
import type {ShieldedProveParams} from '../zkProver/types';
import type {ShieldedNote} from './types';

const DEPTH = 20;

export interface TransferWitnessInput {
  seed: Uint8Array;
  realInputs: ShieldedNote[];       // 1 or 2, leafIndex already resolved
  recipientViewKeyG1: Uint8Array;   // 48-B recipient view key
  mint: string;
  transferAmount: bigint;
  leaves: string[];                 // hex, from syncLeaves
  outNoteSecrets: [bigint, bigint]; // fresh random (out_0 recipient, out_1 change)
  dummyNoteSecret: bigint;          // fresh random (dummy input, if 1 real)
}

export interface TransferOutRef { commitment: string; amount: bigint; noteSecret: bigint; }

export interface TransferWitness {
  params: ShieldedProveParams;
  merkleRoot32: Uint8Array;       // 32-B root — ix arg + on-chain root-membership guard
  nullifier32: [Uint8Array, Uint8Array];
  outCommitment32: [Uint8Array, Uint8Array];
  outCommitmentDec: [string, string];
  recipientOut: TransferOutRef;   // out_0 — encrypt to recipient (NOT stored by sender)
  changeOut: TransferOutRef;      // out_1 — self change (encrypt to self + store locally)
  change: bigint;
}

/**
 * Build the 2-in/2-out transfer witness. Inputs are all owned by the sender; a
 * 1-real-input transfer pads input 1 with a dummy (isDummy=1, amount 0, fresh
 * random noteSecret → unique nullifier, unchecked path). out_0 = recipient
 * (their address view key), out_1 = self change. Value conserved: Σin = out_0+out_1.
 */
export function buildTransferWitness(input: TransferWitnessInput): TransferWitness {
  const {seed, realInputs, recipientViewKeyG1, mint, transferAmount, leaves, outNoteSecrets, dummyNoteSecret} = input;
  if (realInputs.length < 1 || realInputs.length > 2) {
    throw new Error('transfer takes 1 or 2 real inputs');
  }
  const pkHself = getPkRecipientHash(seed);
  const mH = mintHash(new PublicKey(mint).toBytes());

  const inNoteSecret: string[] = [];
  const inPkH: string[] = [];
  const inAmount: string[] = [];
  const inLeafIndex: string[] = [];
  const inMerklePath: string[][] = [];
  const inMerklePathIndices: string[][] = [];
  const inIsDummy: string[] = [];
  const nulls: bigint[] = [];
  let totalIn = 0n;
  let rootDec = '';

  for (let i = 0; i < 2; i++) {
    const real = realInputs[i];
    if (real) {
      const {root, siblings, pathIndices} = computeMerklePath(leaves, real.index);
      rootDec = hexToDec(root);
      nulls.push(nullifier({noteSecret: BigInt(real.noteSecret), leafIndex: real.index}));
      inNoteSecret.push(BigInt(real.noteSecret).toString());
      inPkH.push(pkHself.toString());
      inAmount.push(real.amount.toString());
      inLeafIndex.push(real.index.toString());
      inMerklePath.push(siblings.map(hexToDec));
      inMerklePathIndices.push(pathIndices.map(b => b.toString()));
      inIsDummy.push('0');
      totalIn += real.amount;
    } else {
      nulls.push(nullifier({noteSecret: dummyNoteSecret, leafIndex: 0}));
      inNoteSecret.push(dummyNoteSecret.toString());
      inPkH.push(pkHself.toString());
      inAmount.push('0');
      inLeafIndex.push('0');
      inMerklePath.push(new Array(DEPTH).fill('0'));
      inMerklePathIndices.push(new Array(DEPTH).fill('0'));
      inIsDummy.push('1');
    }
  }

  if (transferAmount < 0n || transferAmount > totalIn) {
    throw new Error(`transferAmount ${transferAmount} out of range (0..${totalIn})`);
  }
  const change = totalIn - transferAmount;

  const recipPkH = pkRecipientHash(recipientViewKeyG1);
  const outPkH = [recipPkH, pkHself];
  const outAmount = [transferAmount, change];
  const outCommitment = [
    noteCommitment({pkRecipientHash: recipPkH, amount: transferAmount, mintHash: mH, noteSecret: outNoteSecrets[0]}),
    noteCommitment({pkRecipientHash: pkHself, amount: change, mintHash: mH, noteSecret: outNoteSecrets[1]}),
  ];

  const params: ShieldedProveParams = {
    merkleRoot: rootDec,
    nullifier_0: nulls[0]!.toString(),
    nullifier_1: nulls[1]!.toString(),
    outCommitment_0: outCommitment[0]!.toString(),
    outCommitment_1: outCommitment[1]!.toString(),
    mintHash: mH.toString(),
    in_noteSecret: inNoteSecret,
    in_pkRecipientHash: inPkH,
    in_amount: inAmount,
    in_leafIndex: inLeafIndex,
    in_merklePath: inMerklePath,
    in_merklePathIndices: inMerklePathIndices,
    in_isDummy: inIsDummy,
    out_pkRecipientHash: outPkH.map(x => x.toString()),
    out_amount: outAmount.map(x => x.toString()),
    out_noteSecret: outNoteSecrets.map(x => x.toString()),
  };

  return {
    params,
    merkleRoot32: decToBe32(rootDec),
    nullifier32: [decToBe32(nulls[0]!.toString()), decToBe32(nulls[1]!.toString())],
    outCommitment32: [decToBe32(outCommitment[0]!.toString()), decToBe32(outCommitment[1]!.toString())],
    outCommitmentDec: [outCommitment[0]!.toString(), outCommitment[1]!.toString()],
    recipientOut: {commitment: outCommitment[0]!.toString(), amount: transferAmount, noteSecret: outNoteSecrets[0]},
    changeOut: {commitment: outCommitment[1]!.toString(), amount: change, noteSecret: outNoteSecrets[1]},
    change,
  };
}
```

- [ ] **Step 4:** `npx jest --testPathPattern=transferWitness` PASS; `npx tsc --noEmit` clean; `npx eslint src/modules/shielded/transferWitness.ts` 0 errors.

- [ ] **Step 5:** Commit:
```bash
git add src/modules/shielded/transferWitness.ts src/modules/shielded/__tests__/transferWitness.test.ts
git commit -m "feat(shielded): transfer witness (2-in/2-out, value split + dummy + recipient/self outputs)"
```

---

### Task 4: `buildTransferIx`

**Files:**
- Modify: `src/modules/shielded/poolInstructions.ts`
- Test: `src/modules/shielded/__tests__/transferIx.test.ts`

- [ ] **Step 1: Failing test**

```ts
import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildTransferIx} from '../poolInstructions';

const pk = (s: string) => new PublicKey(s);
const SYS = '11111111111111111111111111111111';

describe('buildTransferIx', () => {
  const base = {
    merkleRoot: new Uint8Array(32).fill(1),
    nullifier0: new Uint8Array(32).fill(2),
    nullifier1: new Uint8Array(32).fill(3),
    outCommitment0: new Uint8Array(32).fill(4),
    outCommitment1: new Uint8Array(32).fill(5),
    proofBytes: new Uint8Array(256).fill(6),
    ciphertext0: new Uint8Array(128).fill(7),
    ciphertext1: new Uint8Array(128).fill(8),
    pool: pk('11111111111111111111111111111112'),
    merkleTree: pk('11111111111111111111111111111113'),
    nullifierRecord0: pk('11111111111111111111111111111114'),
    nullifierRecord1: pk('11111111111111111111111111111115'),
    feePayer: pk('11111111111111111111111111111116'),
    transferVk: pk('11111111111111111111111111111117'),
  };

  it('uses the global:transfer discriminator', () => {
    const ix = buildTransferIx(base);
    expect(Buffer.from(ix.data.subarray(0, 8))).toEqual(Buffer.from(sha256(Buffer.from('global:transfer')).slice(0, 8)));
  });

  it('lays out data: disc + 5×32 + len+proof(256) + len+ct0(128) + len+ct1(128)', () => {
    const ix = buildTransferIx(base);
    expect(ix.data.length).toBe(8 + 32 * 5 + 4 + 256 + 4 + 128 + 4 + 128);
  });

  it('orders accounts per TransferCtx (transfer_vk at index 5)', () => {
    const ix = buildTransferIx(base);
    const keys = ix.keys.map(k => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);
    expect(keys).toEqual([
      [base.pool.toBase58(), false, false],
      [base.merkleTree.toBase58(), false, true],
      [base.nullifierRecord0.toBase58(), false, true],
      [base.nullifierRecord1.toBase58(), false, true],
      [base.feePayer.toBase58(), true, true],
      [base.transferVk.toBase58(), false, false],
      [SYS, false, false],
    ]);
  });

  it('rejects wrong lengths', () => {
    expect(() => buildTransferIx({...base, ciphertext0: new Uint8Array(64)})).toThrow();
    expect(() => buildTransferIx({...base, proofBytes: new Uint8Array(10)})).toThrow();
  });
});
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** In `poolInstructions.ts` add (reuse `discriminator`, `u32le`, `PROGRAM`, `SystemProgram`):
```ts
export const transferDiscriminator = (): Uint8Array => discriminator('transfer');

export interface TransferIxParams {
  merkleRoot: Uint8Array; nullifier0: Uint8Array; nullifier1: Uint8Array;
  outCommitment0: Uint8Array; outCommitment1: Uint8Array;
  proofBytes: Uint8Array; ciphertext0: Uint8Array; ciphertext1: Uint8Array;
  pool: PublicKey; merkleTree: PublicKey;
  nullifierRecord0: PublicKey; nullifierRecord1: PublicKey;
  feePayer: PublicKey; transferVk: PublicKey;
}

/**
 * transfer(merkle_root, nullifier_0, nullifier_1, out_commitment_0, out_commitment_1,
 *          proof_bytes, ciphertext_0, ciphertext_1). No SPL leg.
 * Accounts (TransferCtx): pool(ro), merkle_tree(mut), nullifier_record_0(init),
 * nullifier_record_1(init), fee_payer(signer,mut), transfer_vk(ro), system_program(ro).
 */
export function buildTransferIx(p: TransferIxParams): TransactionInstruction {
  const chk = (b: Uint8Array, n: number, name: string) => { if (b.length !== n) throw new Error(`${name} must be ${n} bytes`); };
  chk(p.merkleRoot, 32, 'merkleRoot'); chk(p.nullifier0, 32, 'nullifier0'); chk(p.nullifier1, 32, 'nullifier1');
  chk(p.outCommitment0, 32, 'outCommitment0'); chk(p.outCommitment1, 32, 'outCommitment1');
  chk(p.proofBytes, 256, 'proofBytes'); chk(p.ciphertext0, 128, 'ciphertext0'); chk(p.ciphertext1, 128, 'ciphertext1');
  const data = Buffer.concat([
    Buffer.from(transferDiscriminator()),
    Buffer.from(p.merkleRoot), Buffer.from(p.nullifier0), Buffer.from(p.nullifier1),
    Buffer.from(p.outCommitment0), Buffer.from(p.outCommitment1),
    Buffer.from(u32le(p.proofBytes.length)), Buffer.from(p.proofBytes),
    Buffer.from(u32le(p.ciphertext0.length)), Buffer.from(p.ciphertext0),
    Buffer.from(u32le(p.ciphertext1.length)), Buffer.from(p.ciphertext1),
  ]);
  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: p.pool, isSigner: false, isWritable: false},
      {pubkey: p.merkleTree, isSigner: false, isWritable: true},
      {pubkey: p.nullifierRecord0, isSigner: false, isWritable: true},
      {pubkey: p.nullifierRecord1, isSigner: false, isWritable: true},
      {pubkey: p.feePayer, isSigner: true, isWritable: true},
      {pubkey: p.transferVk, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
    ],
    data,
  });
}
```
(Use a plain `TransactionInstruction` return type — the file already imports it; do not use the weird conditional type. Written above defensively; the implementer should type it as `: TransactionInstruction`.)

- [ ] **Step 4:** `npx jest --testPathPattern=transferIx` PASS (4 tests); `npx tsc --noEmit` clean; `npx jest --testPathPattern='poolInstructions|withdrawIx|withdrawChangeIx'` (no regressions).

- [ ] **Step 5:** Commit:
```bash
git add src/modules/shielded/poolInstructions.ts src/modules/shielded/__tests__/transferIx.test.ts
git commit -m "feat(shielded): buildTransferIx (2 nullifiers + 2 out commitments + 2 ciphertexts + transfer_vk)"
```

---

### Task 5: `proveShielded` accepts `'transfer'`

**Files:**
- Modify: `src/modules/zkProver/zkProverModule.ts`
- Test: `src/modules/zkProver/__tests__/zkProverModule.test.ts`

- [ ] **Step 1:** Add a test mirroring the `withdraw_change` proveShielded test but with `proofType: 'transfer'` (reuse the file's `mockPinnedFetch`/`mockResponse`; resolve `{success:true, proofBytes:'00'.repeat(256), publicInputs:['1'..'6'], proofData:''}`); assert `proofBytes.length===512` and `publicInputs` length 6. Also add `'transfer'` to `warmProver`'s accepted set if it's a union (check).

- [ ] **Step 2:** FAIL (tsc: `'transfer'` not in the proofType union).

- [ ] **Step 3:** Widen both unions in `zkProverModule.ts`:
```ts
export async function proveShielded(
  proofType: 'deposit' | 'withdraw' | 'withdraw_change' | 'transfer',
  params: ShieldedProveParams,
): Promise<ShieldedProveResult> {
```
and `warmProver(proofType: 'deposit' | 'withdraw' | 'withdraw_change' | 'transfer')`.

- [ ] **Step 4:** `npx jest --testPathPattern=zkProverModule` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5:** Commit:
```bash
git add src/modules/zkProver/zkProverModule.ts src/modules/zkProver/__tests__/zkProverModule.test.ts
git commit -m "feat(shielded): proveShielded + warmProver accept 'transfer' proofType"
```

---

### Task 6: `transferFlow.ts` — `sendPrivateTransfer`

**Files:**
- Create: `src/modules/shielded/transferFlow.ts`
- Test: `src/modules/shielded/__tests__/transferFlow.test.ts`

- [ ] **Step 1: Failing test** (mock the collaborators; verify orchestration: select→witness→prove→cross-check→submit→mark inputs spent→store change; stale-root guard)

```ts
import {Keypair} from '@solana/web3.js';

jest.mock('../merkleSync', () => ({syncLeaves: jest.fn()}));
jest.mock('../noteSelect', () => ({selectTransferInputs: jest.fn()}));
jest.mock('../transferWitness', () => ({
  buildTransferWitness: jest.fn(() => ({
    params: {merkleRoot: '5'},
    merkleRoot32: new Uint8Array(32).fill(1),
    nullifier32: [new Uint8Array(32).fill(2), new Uint8Array(32).fill(3)],
    outCommitment32: [new Uint8Array(32).fill(4), new Uint8Array(32).fill(5)],
    outCommitmentDec: ['40', '50'],
    recipientOut: {commitment: '40', amount: 200n, noteSecret: 77n},
    changeOut: {commitment: '50', amount: 300n, noteSecret: 88n},
    change: 300n,
  })),
}));
jest.mock('../noteEncryption', () => ({encryptNote: jest.fn(() => new Uint8Array(128).fill(1))}));
jest.mock('../../zkProver/zkProverModule', () => ({
  proveShielded: jest.fn(async () => ({proofBytes: '00'.repeat(256), publicInputs: ['r','n0','n1','40','50','mh'], proofData: ''})),
}));
jest.mock('../poolTx', () => ({submitPoolTxMany: jest.fn(async () => 'SIG')}));
jest.mock('../noteStore', () => ({markSpentByCommitment: jest.fn(), addNote: jest.fn()}));
jest.mock('../leafResolver', () => ({resolveLeafIndex: jest.fn(async () => 42)}));
jest.mock('../shieldedIdentity', () => ({getViewPublicKey: jest.fn(() => new Uint8Array(48).fill(9)), getPkRecipientHash: jest.fn()}));
jest.mock('../shieldedAddressCodec', () => ({decodeShieldedAddress: jest.fn(() => new Uint8Array(48).fill(1))}));
jest.mock('../../store/mmkv/instances', () => ({mmkvSecure: () => ({}), initSecureMmkv: jest.fn()}));

import {sendPrivateTransfer} from '../transferFlow';
import {syncLeaves} from '../merkleSync';
import {selectTransferInputs} from '../noteSelect';
import {markSpentByCommitment, addNote} from '../noteStore';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const rootHex = '01'.repeat(32); // = bytesToHex(mocked merkleRoot32 = Uint8Array(32).fill(1))
const input: ShieldedNote = {commitment: 'ci', nullifier: '', mint: MINT, amount: 500n, index: 0, spent: false, createdAt: 1, noteSecret: '9'};
const feePayer = Keypair.generate();
const seed = new Uint8Array(32).fill(3);

describe('sendPrivateTransfer', () => {
  beforeEach(() => jest.clearAllMocks());
  it('proves, submits, marks input spent, stores change, encrypts to recipient + self', async () => {
    (selectTransferInputs as jest.Mock).mockReturnValue([input]);
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['ci'], onChainRoots: [rootHex]});
    const res = await sendPrivateTransfer(seed, feePayer, MINT, 'noc1recipient', 200n);
    expect(res.sent).toBe(200n);
    expect(res.change).toBe(300n);
    expect(markSpentByCommitment).toHaveBeenCalledWith(MINT, 'ci');
    expect(addNote).toHaveBeenCalledWith(expect.objectContaining({commitment: '50', amount: 300n, index: 42}));
  });
  it('throws when no inputs cover the amount', async () => {
    (selectTransferInputs as jest.Mock).mockReturnValue(null);
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: [], onChainRoots: [rootHex]});
    await expect(sendPrivateTransfer(seed, feePayer, MINT, 'noc1r', 999n)).rejects.toThrow();
  });
});
```

- [ ] **Step 2:** FAIL (module not found).

- [ ] **Step 3:** Implement `sendPrivateTransfer(seed, feePayer, mint, recipientAddress, amount)` per the spec §C4 (mirror `unshieldWithChange`):
  1. `ensureSecureMmkv()` (mirror withdrawFlow); `const recipientViewKeyG1 = decodeShieldedAddress(recipientAddress)` (48 B).
  2. `const {leaves, onChainRoots} = await syncLeaves(mint)`.
  3. `const inputs = selectTransferInputs(getNotes(mint).filter(n => !n.spent), amount)`; if `null` throw `new Error('insufficient shielded balance for this transfer')`.
  4. For each input with `index < 0`: resolve via `leaves.indexOf(decToHex64(commitmentDec))` (the note's commitment) and `setNoteIndex(mint, note.commitment, idx)`; throw if still unresolved.
  5. Sample `outNoteSecrets = [randomFieldElement(), randomFieldElement()]` and `dummyNoteSecret = randomFieldElement()`.
  6. `const w = buildTransferWitness({seed, realInputs: inputs, recipientViewKeyG1, mint, transferAmount: amount, leaves, outNoteSecrets, dummyNoteSecret})`.
  7. Root-membership guard: `if (!onChainRoots.includes(bytesToHex(w.merkleRoot32))) throw new MerkleRootStaleError()` (reuse from withdrawFlow; import `bytesToHex` from `./fieldCodec`).
  8. `const proof = await proveShielded('transfer', w.params)`; cross-check `proof.publicInputs[3] === w.outCommitmentDec[0]` && `proof.publicInputs[4] === w.outCommitmentDec[1]` (throw on mismatch); `proofBytes = hexToBytes(proof.proofBytes)`.
  9. `const ct0 = encryptNote(recipientViewKeyG1, amount, w.recipientOut.noteSecret)`; `const ct1 = encryptNote(getViewPublicKey(seed), w.change, w.changeOut.noteSecret)`.
  10. Build accounts (note `poolPda` takes a `PublicKey`): `pool = poolPda(new PublicKey(mint))`, `merkleTree = merkleTreePda(pool)`, `nullifierRecord0 = nullifierPda(pool, w.nullifier32[0])`, `nullifierRecord1 = nullifierPda(pool, w.nullifier32[1])`, `transferVk = transferVkPda(pool)`; `ix = buildTransferIx({merkleRoot: w.merkleRoot32, nullifier0: w.nullifier32[0], nullifier1: w.nullifier32[1], outCommitment0: w.outCommitment32[0], outCommitment1: w.outCommitment32[1], proofBytes, ciphertext0: ct0, ciphertext1: ct1, pool, merkleTree, nullifierRecord0, nullifierRecord1, feePayer: feePayer.publicKey, transferVk})`.
  11. `const txSignature = await submitPoolTxMany([ix], SHIELDED_CU.transfer, feePayer)`.
  12. `for (const n of inputs) markSpentByCommitment(mint, n.commitment)`.
  13. If `w.change > 0n`: `const idx = await resolveLeafIndex(txSignature, w.changeOut.commitment, mint)`; `addNote({commitment: w.changeOut.commitment, nullifier: '', mint, amount: w.change, index: idx, spent: false, createdAt: <mmkv-supplied ts or 0>, noteSecret: w.changeOut.noteSecret.toString()})`.
  14. `return {txSignature, sent: amount, change: w.change}`.

Do NOT store the recipient output (`w.recipientOut`) — only they can discover it (via note scan). The `change` note (out_1) is self-owned → stored locally now AND rediscoverable via scan (dedup handles the overlap).

- [ ] **Step 4:** `npx jest --testPathPattern='transferFlow|transferWitness'` PASS; `npx tsc --noEmit` clean; `npx eslint src/modules/shielded/transferFlow.ts` 0 errors.

- [ ] **Step 5:** Commit:
```bash
git add src/modules/shielded/transferFlow.ts src/modules/shielded/transferWitness.ts src/modules/shielded/__tests__/transferFlow.test.ts src/modules/shielded/__tests__/transferWitness.test.ts
git commit -m "feat(shielded): sendPrivateTransfer flow (witness → prove → transfer ix → store change)"
```

---

### Task 7: wire `ShieldedTransferScreen` to the real flow

**Files:**
- Modify: `src/screens/shielded/ShieldedTransferScreen.tsx`
- Test: `src/screens/shielded/__tests__/ShieldedTransferScreen.test.tsx` (create if absent; else extend)

Replace the mock `transfer(...)` from `shieldedService` with `sendPrivateTransfer`. READ the screen first. Steps:
- Import `sendPrivateTransfer` from `../../modules/shielded/transferFlow`, `warmProver` from `../../modules/zkProver/zkProverModule`, `keychainManager`/`mnemonicToSeed`/`deriveTransparentKeypair`/`loadTransparentScheme`/`zeroize`/`Keypair`/`SHIELDED_POOL_MINTS` (mirror `ZkProofScreen.runShieldOp`'s seed→feePayer derivation + zeroize).
- In `handleConfirm`, replace the `await transfer(...)` block with: retrieve seed → derive feePayer → `await sendPrivateTransfer(seed, feePayer, SHIELDED_POOL_MINTS[0], recipient, parsedAmount)` in a try/finally that zeroizes the seed → `setStep('success')`; on throw → `setErrorMessage(e.message); setStep('error')`.
- `useEffect` on mount: `void warmProver('transfer')`.
- Remove the `memo` state + input (no memo in the contract). Remove the now-unused `shieldedService.transfer`, `feeEngine`/`consolidationProgress` mock plumbing that referenced the old service IF it's dead after the swap (leave PrivacyMeter/fee display if they render fine).
- `selectedMint` = `SHIELDED_POOL_MINTS[0]`. Amount validation: `parsedAmount <= maxTransferable(getNotes(mint))` (import `maxTransferable` + `getNotes`); show a "max per transfer" message on exceed.

Test: mock `transferFlow.sendPrivateTransfer` (resolves `{txSignature:'T', sent:200000000n, change:0n}`) + the seed/keychain mocks (mirror the ZkProofScreen test), render, enter a valid `noc1…` recipient + amount, tap review→confirm, assert `sendPrivateTransfer` was called and the success step renders. Match the screen's actual step/testID structure.

- [ ] Verify: `npx jest --testPathPattern=ShieldedTransfer` PASS; `npx tsc --noEmit` clean; `npx eslint src/screens/shielded/ShieldedTransferScreen.tsx` 0 errors.
- [ ] Commit: `git commit -m "feat(shielded): wire ShieldedTransferScreen to sendPrivateTransfer + warm prover"`

---

### Task 8: `parseNoteCiphertextEvents`

**Files:**
- Create: `src/modules/shielded/noteCiphertextEvents.ts`
- Test: `src/modules/shielded/__tests__/noteCiphertextEvents.test.ts`

- [ ] **Step 1: Failing test**

```ts
import {parseNoteCiphertextEvents} from '../noteCiphertextEvents';

function ncLine(leafIndex: number, ct: Uint8Array): string {
  const buf = Buffer.alloc(8 + 8 + 4 + 128);
  buf.writeUInt32LE(leafIndex, 8);       // leaf_index low 32 bits (u64 LE)
  buf.writeUInt32LE(128, 8 + 8);         // Vec<u8> len
  Buffer.from(ct).copy(buf, 8 + 8 + 4);
  return `Program data: ${buf.toString('base64')}`;
}

describe('parseNoteCiphertextEvents', () => {
  it('parses 148-byte NoteCiphertext events', () => {
    const ct = new Uint8Array(128).fill(9);
    const out = parseNoteCiphertextEvents(['Program log: x', ncLine(6, ct)]);
    expect(out).toEqual([{leafIndex: 6, ciphertext: ct}]);
  });
  it('ignores non-148-byte program-data lines (LeafInserted 80, Transfer 72)', () => {
    const leaf80 = `Program data: ${Buffer.alloc(80).toString('base64')}`;
    const transfer72 = `Program data: ${Buffer.alloc(72).toString('base64')}`;
    expect(parseNoteCiphertextEvents([leaf80, transfer72])).toEqual([]);
  });
  it('ignores a line whose len prefix isn\'t 128', () => {
    const buf = Buffer.alloc(8 + 8 + 4 + 128);
    buf.writeUInt32LE(64, 8 + 8); // wrong len
    expect(parseNoteCiphertextEvents([`Program data: ${buf.toString('base64')}`])).toEqual([]);
  });
});
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement:
```ts
// src/modules/shielded/noteCiphertextEvents.ts
const DISC = 8, LEAF_INDEX = 8, LEN = 4, CT = 128;
const EVENT_LEN = DISC + LEAF_INDEX + LEN + CT; // 148

export interface NoteCiphertextEvent { leafIndex: number; ciphertext: Uint8Array; }

/**
 * Parse Anchor `NoteCiphertext{leaf_index:u64, ciphertext:Vec<u8>=128}` events
 * (borsh: disc8 + leaf_index(u64 LE) + len(u32 LE)=128 + 128 bytes = 148 B).
 * Length-based like the merkle scanner; the 80-B LeafInserted + 72-B Transfer
 * lines are ignored.
 */
export function parseNoteCiphertextEvents(logs: string[]): NoteCiphertextEvent[] {
  const out: NoteCiphertextEvent[] = [];
  for (const line of logs) {
    const m = line.match(/^Program data: (.+)$/);
    if (!m) continue;
    const buf = Buffer.from(m[1]!, 'base64');
    if (buf.length !== EVENT_LEN) continue;
    let leafIndex = 0n;
    for (let i = 0; i < LEAF_INDEX; i++) leafIndex |= BigInt(buf[DISC + i]!) << BigInt(8 * i);
    let len = 0;
    for (let i = 0; i < LEN; i++) len |= buf[DISC + LEAF_INDEX + i]! << (8 * i);
    if (len !== CT) continue;
    out.push({leafIndex: Number(leafIndex), ciphertext: Uint8Array.from(buf.subarray(DISC + LEAF_INDEX + LEN, EVENT_LEN))});
  }
  return out;
}
```

- [ ] **Step 4:** `npx jest --testPathPattern=noteCiphertextEvents` PASS (3 tests); `npx tsc --noEmit` clean.

- [ ] **Step 5:** Commit:
```bash
git add src/modules/shielded/noteCiphertextEvents.ts src/modules/shielded/__tests__/noteCiphertextEvents.test.ts
git commit -m "feat(shielded): parse NoteCiphertext events for note discovery"
```

---

### Task 9: `shieldedViewSession` (cached view key)

**Files:**
- Create: `src/modules/shielded/shieldedViewSession.ts`
- Test: `src/modules/shielded/__tests__/shieldedViewSession.test.ts`
- Modify: `src/modules/session/secureStorageSession.ts` (populate on unlock)

- [ ] **Step 1: Failing test**

```ts
import {setShieldedViewSession, getShieldedViewSession, clearShieldedViewSession} from '../shieldedViewSession';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';
import {getPkRecipientHash} from '../shieldedIdentity';

describe('shieldedViewSession', () => {
  afterEach(() => clearShieldedViewSession());
  it('caches sk_view + pkH from a seed, and clears', () => {
    expect(getShieldedViewSession()).toBeNull();
    const seed = new Uint8Array(32).fill(4);
    setShieldedViewSession(seed);
    const s = getShieldedViewSession();
    expect(s).not.toBeNull();
    expect(Buffer.from(s!.skView)).toEqual(Buffer.from(deriveShieldedViewKey(seed)));
    expect(s!.pkH).toBe(getPkRecipientHash(seed));
    clearShieldedViewSession();
    expect(getShieldedViewSession()).toBeNull();
  });
});
```

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement:
```ts
// src/modules/shielded/shieldedViewSession.ts
import {deriveShieldedViewKey} from '../keyDerivation/shielded';
import {getPkRecipientHash} from './shieldedIdentity';

export interface ShieldedViewSession { skView: Uint8Array; pkH: bigint; }

let _session: ShieldedViewSession | null = null;

/** Cache the (view-only) scan keys for this session. sk_view cannot spend and is
 *  already JS-resident by the view-key model; cleared on lock. */
export function setShieldedViewSession(seed: Uint8Array): void {
  _session = {skView: deriveShieldedViewKey(seed), pkH: getPkRecipientHash(seed)};
}
export function getShieldedViewSession(): ShieldedViewSession | null {
  return _session;
}
export function clearShieldedViewSession(): void {
  _session = null;
}
```
Then in `src/modules/session/secureStorageSession.ts`, call `setShieldedViewSession(seed)` right after the store is initialized (in BOTH `unlockSecureStorage` — before zeroizing the seed — and `unlockSecureStorageWithSeed`). Import it. (Read the file; add the call before the `zeroize(seed)`.)

- [ ] **Step 4:** `npx jest --testPathPattern='shieldedViewSession|secureStorage'` PASS; `npx tsc --noEmit` clean.

- [ ] **Step 5:** Commit:
```bash
git add src/modules/shielded/shieldedViewSession.ts src/modules/shielded/__tests__/shieldedViewSession.test.ts src/modules/session/secureStorageSession.ts
git commit -m "feat(shielded): session view-key cache, populated at secure-store unlock"
```

---

### Task 10: `noteScan.scanIncomingNotes`

**Files:**
- Create: `src/modules/shielded/noteScan.ts`
- Test: `src/modules/shielded/__tests__/noteScan.test.ts`

- [ ] **Step 1: Failing test** (mock connection + mmkvPublic + the view session; a NoteCiphertext encrypted to my key + a matching LeafInserted → stored; a foreign ct → skipped; a commitment mismatch → skipped; dedup)

The implementer builds the test: mock `getShieldedViewSession` to return a real `{skView, pkH}` for a fixed seed; craft a NoteCiphertext via `encryptNote(getViewPublicKey(seed), amount, noteSecret)`; craft the matching `LeafInserted` (commitment = `noteCommitment({pkRecipientHash: getPkRecipientHash(seed), amount, mintHash, noteSecret})` → `decToHex64`) at the same leaf_index; mock the connection's `getSignaturesForAddress`/`getTransaction` to return a tx whose logs contain both events; mock `noteStore.getNotes` (dedup) + `addNote`; assert `addNote` called with the right note; a second run (note now in getNotes) → not added again; a foreign ct (encrypted to another key) → not added; a NoteCiphertext whose recomputed commitment ≠ the LeafInserted at that index → not added. Mirror the `merkleSync.test.ts` mocking style (mock-prefixed vars for jest.mock factories).

- [ ] **Step 2:** FAIL.

- [ ] **Step 3:** Implement `scanIncomingNotes(mint)` per spec §B3: read `getShieldedViewSession()` (return 0 if null) → incremental `getSignaturesForAddress(merkleTreePda(poolPda(mint)))` from a `mmkvPublic` cursor `noctura.noteScanCursor.<mint>` (mirror `merkleSync`'s `until` + newest-sig capture) → for each new tx `getTransaction` → from its logs build a `LeafInserted` commitment-by-leafIndex map (`parseDepositEvents`) + `parseNoteCiphertextEvents` → for each ciphertext `tryDecryptNote(skView, ct)`; on non-null recompute `noteCommitment({pkRecipientHash: pkH, amount, mintHash, noteSecret})`, compare `decToHex64(commitmentDec)` to the LeafInserted hex at that leafIndex; if equal and not in `getNotes(mint)` (dedup by commitment decimal) → `addNote(...)` with `index: leafIndex`; advance the cursor → return the count.

- [ ] **Step 4:** `npx jest --testPathPattern=noteScan` PASS; `npx tsc --noEmit` clean; `npx eslint src/modules/shielded/noteScan.ts` 0 errors.

- [ ] **Step 5:** Commit:
```bash
git add src/modules/shielded/noteScan.ts src/modules/shielded/__tests__/noteScan.test.ts
git commit -m "feat(shielded): scanIncomingNotes — discover received notes from NoteCiphertext events"
```

---

### Task 11: wire scanning into the dashboard

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx`

In the existing shielded-focus `useEffect` (next to the `syncLeaves` prefetch + `warmProver` pings), add:
```ts
import {scanIncomingNotes} from '../../modules/shielded/noteScan';
// inside the shielded-focus effect, after the prefetch/warm:
if (m) void scanIncomingNotes(m).then(n => { if (n > 0) setShieldedTick(t => t + 1); }).catch(() => {});
```
So a background scan on shielded focus discovers incoming notes and refreshes the vault. Fire-and-forget. (The scan reads the session view key — no seed needed here; if not unlocked it returns 0.)

- [ ] Verify: `npx jest --testPathPattern=DashboardScreen` PASS; `npx tsc --noEmit` clean; `npx eslint src/screens/dashboard/DashboardScreen.tsx` 0 errors.
- [ ] Commit: `git commit -m "feat(shielded): scan for incoming notes on shielded dashboard focus"`

---

### Task 12: full verification

- [ ] `npx tsc --noEmit` (clean)
- [ ] `npx jest` (full suite passes; note the new suites)
- [ ] `npx eslint src/modules/shielded src/screens/shielded src/screens/dashboard` (0 errors)
- [ ] Regression: `npx jest --testPathPattern='depositFlow|withdrawChangeFlow|noteEncryption|merkleSync|ZkProofScreen'` (P1 + A intact)
