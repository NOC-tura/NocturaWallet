# Shielded Withdraw / Unshield (Feature B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unshield (withdraw) a whole shielded note back to the user's own transparent ATA on devnet, via self-relay.

**Architecture:** Reuse the merged deposit machinery (`noteCrypto`, `shieldedIdentity`, `poolPdas`, `poolTx`, `noteStore`, `proveShielded`). Add: RPC log-scan Merkle sync (replay `Deposit` events → ordered leaves + on-chain roots), Merkle path extraction, a withdraw witness builder, a `buildWithdrawIx`, and a `withdrawFlow.unshield` orchestrator. Wire the existing `ShieldUnshieldScreen` "Make public" → `ZkProofScreen` (direction `'public'`) to it. The withdraw circuit unshields exactly one whole note (`withdrawAmount == amount`, no change).

**Tech Stack:** React Native 0.84 / TypeScript strict, @solana/web3.js, poseidon-lite, MMKV, Jest. No new dependencies.

**Contract reference:** `docs/superpowers/specs/2026-07-01-shielded-withdraw-design.md`. Program `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES`. `withdraw(merkle_root[32], nullifier[32], amount:u64, proof_bytes)`; `WithdrawCtx` accounts in order: pool(ro), merkle_tree(mut), vault(mut), destination_token_account(mut), nullifier_record(init, seeds `["nullifier",n]`), fee_payer(signer,mut), token_program, system_program. Public inputs `[merkle_root, nullifier, u64_to_be32(amount), recipientField, mintHash]`. `Deposit` event = `commitment[32] + leaf_index(u64 LE) + root[32]`.

**Note on existing helpers (read before starting):**
- `src/modules/shielded/noteCrypto.ts` exports `nullifier({noteSecret, leafIndex})`, `recipientField(bytes)`, `mintHash(bytes)`, `bytesToBigIntBE`, `assertField`, `randomFieldElement`. Domain tags already handled inside.
- `src/modules/shielded/shieldedIdentity.ts` exports `getPkRecipientHash(seed): bigint`.
- `src/modules/merkle/merkleModule.ts` exports `computeMerkleRoot(leaves: string[])` (hex, depth-20, poseidon2 untagged, `ZERO_HASHES` padding), `toFieldElement`, `BN254_FIELD_PRIME`. `MERKLE_TREE_DEPTH = 20`.
- `src/modules/shielded/poolPdas.ts` exports `poolPda(mint)`, `merkleTreePda(pool)`, `nullifierPda(nullifier32)`, `vaultAta(pool, mint)`.
- `src/modules/shielded/poolInstructions.ts` exports `buildDepositIx`, `depositDiscriminator`, and has private `u64le`, `u32le` (copy the pattern; they are not exported).
- `src/modules/shielded/poolTx.ts` exports `submitPoolTx(poolIx, computeUnitLimit, feePayer)` (single ix).
- `src/modules/solana/transactionBuilder.ts` exports `findAssociatedTokenAddress(owner, mint)` and has a private `buildCreateAtaInstruction(payer, ata, owner, mint)` with `data: Buffer.alloc(0)` (NON-idempotent). Idempotent create uses `data: Buffer.from([1])`.
- `src/modules/shielded/depositFlow.ts` has private `decToBe32`, `hexToBytes`, `ensureSecureMmkv(seed)` (not exported). Do NOT refactor depositFlow — leave the merged code untouched; new modules get their own small codecs (Task 1a).
- `src/modules/shielded/noteStore.ts` exports `getNotes(mint)`, `getBalance(mint)`, `addNote`, `markSpent(mint, nullifiers)`, `clearMint`. Notes: `{commitment, nullifier:'', mint, amount:bigint, index:number, spent:boolean, createdAt, noteSecret}`.
- `src/modules/shielded/types.ts` defines `ShieldedNote`.
- `src/constants/programs.ts` exports `SHIELDED_CU` (`{deposit, withdraw:250_000}`), `SHIELDED_POOL_PROGRAM_ID`.

Run all tests with `npx jest --testPathPattern=<name>`; type-check with `npx tsc --noEmit`; lint with `npx eslint <files>`.

---

### Task 1: Field codec helpers (shared by new modules)

**Files:**
- Create: `src/modules/shielded/fieldCodec.ts`
- Test: `src/modules/shielded/__tests__/fieldCodec.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/fieldCodec.test.ts
import {decToBe32, be32ToDec, hexToDec, decToHex64, hexToBytes, bytesToHex} from '../fieldCodec';

describe('fieldCodec', () => {
  it('decToBe32 is big-endian, 32 bytes', () => {
    const b = decToBe32('1');
    expect(b.length).toBe(32);
    expect(b[31]).toBe(1);
    expect(b[0]).toBe(0);
  });
  it('be32ToDec round-trips decToBe32', () => {
    const dec = '123456789012345678901234567890';
    expect(be32ToDec(decToBe32(dec))).toBe(dec);
  });
  it('hexToDec and decToHex64 round-trip', () => {
    const dec = '255';
    expect(decToHex64(dec)).toBe('00'.repeat(31) + 'ff');
    expect(hexToDec('ff')).toBe('255');
  });
  it('hexToBytes and bytesToHex round-trip', () => {
    const hex = 'deadbeef';
    expect(bytesToHex(hexToBytes(hex))).toBe(hex);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=fieldCodec`
Expected: FAIL — cannot find module `../fieldCodec`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/shielded/fieldCodec.ts
// Small, dependency-free conversions between the field-element representations
// the shielded pipeline uses: decimal strings (prover params), 64-char hex
// (Merkle leaves/roots), and 32-byte big-endian arrays (on-chain ix args).

/** Decimal field-element string -> 32-byte big-endian Uint8Array. */
export function decToBe32(dec: string): Uint8Array {
  let v = BigInt(dec);
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) { out[i] = Number(v & 0xffn); v >>= 8n; }
  return out;
}

/** 32-byte big-endian Uint8Array -> decimal string. */
export function be32ToDec(bytes: Uint8Array): string {
  let acc = 0n;
  for (let i = 0; i < bytes.length; i++) acc = acc * 256n + BigInt(bytes[i]!);
  return acc.toString();
}

/** Hex string (any even length) -> decimal string. */
export function hexToDec(hex: string): string {
  return BigInt('0x' + hex).toString();
}

/** Decimal field-element string -> 64-char (32-byte) hex, zero-padded. */
export function decToHex64(dec: string): string {
  return BigInt(dec).toString(16).padStart(64, '0');
}

/** Hex string -> Uint8Array. */
export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/** Uint8Array -> hex string. */
export function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += bytes[i]!.toString(16).padStart(2, '0');
  return s;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=fieldCodec`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/fieldCodec.ts src/modules/shielded/__tests__/fieldCodec.test.ts
git commit -m "feat(shielded): field codec helpers for withdraw pipeline"
```

---

### Task 2: `markSpentByIndex` in note store

**Files:**
- Modify: `src/modules/shielded/noteStore.ts`
- Test: `src/modules/shielded/__tests__/noteStore.test.ts` (add to existing suite; if absent, create it)

- [ ] **Step 1: Write the failing test**

Add this block. If a `noteStore.test.ts` already exists, append the `describe`; reuse its `mmkvSecure` mock. If not, create the file with the mock below.

```ts
// src/modules/shielded/__tests__/noteStore.test.ts  (create if missing)
const store = new Map<string, string>();
jest.mock('../../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({
    getString: (k: string) => store.get(k),
    set: (k: string, v: string) => { store.set(k, v); },
    remove: (k: string) => { store.delete(k); },
  }),
}));

import {addNote, getBalance, getNotes, markSpentByIndex} from '../noteStore';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';

describe('noteStore.markSpentByIndex', () => {
  beforeEach(() => store.clear());
  it('marks the note at the given leaf index spent (nullifier is empty)', () => {
    addNote({commitment: 'c0', nullifier: '', mint: MINT, amount: 100n, index: 0, spent: false, createdAt: 1, noteSecret: 's0'});
    addNote({commitment: 'c1', nullifier: '', mint: MINT, amount: 200n, index: 1, spent: false, createdAt: 2, noteSecret: 's1'});
    expect(getBalance(MINT)).toBe(300n);
    markSpentByIndex(MINT, 1);
    expect(getBalance(MINT)).toBe(100n);
    expect(getNotes(MINT).map(n => n.index)).toEqual([0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=noteStore`
Expected: FAIL — `markSpentByIndex` is not exported.

- [ ] **Step 3: Write minimal implementation**

Add to `src/modules/shielded/noteStore.ts` (after `markSpent`):

```ts
/**
 * Mark the note at `leafIndex` as spent. Deposit-created notes store an empty
 * `nullifier` (it is computed only at withdraw time), so `markSpent(nullifiers)`
 * cannot match them; the on-chain leaf index is the stable key.
 */
export function markSpentByIndex(mint: string, leafIndex: number): void {
  const notes = loadNotes(mint);
  let changed = false;
  for (const note of notes) {
    if (note.index === leafIndex && !note.spent) {
      note.spent = true;
      changed = true;
    }
  }
  if (changed) saveNotes(mint, notes);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=noteStore`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/noteStore.ts src/modules/shielded/__tests__/noteStore.test.ts
git commit -m "feat(shielded): markSpentByIndex — spend a note by leaf index"
```

---

### Task 3: Merkle path extraction

**Files:**
- Modify: `src/modules/merkle/merkleModule.ts`
- Test: `src/modules/merkle/__tests__/merklePath.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/merkle/__tests__/merklePath.test.ts
import {computeMerkleRoot, computeMerklePath, MERKLE_TREE_DEPTH} from '../merkleModule';

const leaf = (n: number) => n.toString(16).padStart(64, '0');

describe('computeMerklePath', () => {
  it('depth-20 path whose folded root equals computeMerkleRoot (multi-leaf)', () => {
    const leaves = [leaf(11), leaf(22), leaf(33), leaf(44), leaf(55)];
    for (let idx = 0; idx < leaves.length; idx++) {
      const {root, siblings, pathIndices} = computeMerklePath(leaves, idx);
      expect(siblings.length).toBe(MERKLE_TREE_DEPTH);
      expect(pathIndices.length).toBe(MERKLE_TREE_DEPTH);
      expect(root).toBe(computeMerkleRoot(leaves));
      // pathIndices are the LSB-first bits of idx.
      for (let i = 0; i < MERKLE_TREE_DEPTH; i++) {
        expect(pathIndices[i]).toBe((idx >> i) & 1);
      }
    }
  });
  it('single-leaf tree, index 0', () => {
    const leaves = [leaf(7)];
    const {root, pathIndices} = computeMerklePath(leaves, 0);
    expect(root).toBe(computeMerkleRoot(leaves));
    expect(pathIndices.every(b => b === 0)).toBe(true);
  });
  it('throws on out-of-range index', () => {
    expect(() => computeMerklePath([leaf(1)], 5)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=merklePath`
Expected: FAIL — `computeMerklePath` is not exported.

- [ ] **Step 3: Write minimal implementation**

In `src/modules/merkle/merkleModule.ts`, the module already defines private `hashPair(left, right)` and `ZERO_HASHES` (a `string[]` where `ZERO_HASHES[d]` is the all-zero subtree root at level `d`) and `MERKLE_TREE_DEPTH` is imported. Add this exported function AFTER `computeMerkleRoot`:

```ts
/**
 * Merkle authentication path for the leaf at `leafIndex` in a depth-20 tree.
 * Mirrors computeMerkleRoot exactly (same poseidon2 hashPair + ZERO_HASHES
 * padding) so the folded root is identical. Returns:
 *   - siblings[i]:     the sibling node at level i (hex; ZERO_HASHES[i] if absent)
 *   - pathIndices[i]:  (leafIndex >> i) & 1  (0 = node is left child, 1 = right)
 *   - root:            the depth-20 root reached by folding leaf up the path
 */
export function computeMerklePath(
  leaves: string[],
  leafIndex: number,
): {root: string; siblings: string[]; pathIndices: number[]} {
  if (leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error(`computeMerklePath: leafIndex ${leafIndex} out of range (${leaves.length} leaves)`);
  }
  const siblings: string[] = [];
  const pathIndices: number[] = [];
  let layer = leaves.slice();
  let index = leafIndex;

  for (let depth = 0; depth < MERKLE_TREE_DEPTH; depth++) {
    const isRight = index & 1;
    const siblingIdx = isRight ? index - 1 : index + 1;
    const sibling = siblingIdx < layer.length ? layer[siblingIdx]! : ZERO_HASHES[depth]!;
    siblings.push(sibling);
    pathIndices.push(isRight);

    // Build the next layer (same padding rule as computeMerkleRoot).
    const next: string[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const left = layer[i]!;
      const right = i + 1 < layer.length ? layer[i + 1]! : ZERO_HASHES[depth]!;
      next.push(hashPair(left, right));
    }
    layer = next;
    index = index >> 1;
  }

  return {root: computeMerkleRoot(leaves), siblings, pathIndices};
}
```

Also ensure `MERKLE_TREE_DEPTH` is exported from this module (it is imported from `./types`). If it is not already re-exported, add near the other re-exports:

```ts
export {MERKLE_TREE_DEPTH} from './types';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=merklePath`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/merkle/merkleModule.ts src/modules/merkle/__tests__/merklePath.test.ts
git commit -m "feat(merkle): computeMerklePath — depth-20 authentication path"
```

---

### Task 4: Deposit-event parsing (pure)

**Files:**
- Create: `src/modules/shielded/depositEvents.ts`
- Test: `src/modules/shielded/__tests__/depositEvents.test.ts`

This isolates the pure parsing/ordering logic (unit-testable without RPC). Task 5 wraps it with RPC calls.

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/depositEvents.test.ts
import {parseDepositEvents, orderedLeaves, DepositEvent} from '../depositEvents';

// Build a synthetic "Program data:" line: 8-byte disc + commitment[32] + leaf_index(u64 LE) + root[32].
function programDataLine(commitmentHex: string, leafIndex: number, rootHex: string): string {
  const buf = Buffer.alloc(8 + 32 + 8 + 32);
  Buffer.from(commitmentHex, 'hex').copy(buf, 8);
  buf.writeUInt32LE(leafIndex, 8 + 32); // low 32 bits suffice for tests
  Buffer.from(rootHex, 'hex').copy(buf, 8 + 32 + 8);
  return `Program data: ${buf.toString('base64')}`;
}

const c = (n: number) => n.toString(16).padStart(64, '0');
const r = (n: number) => (1000 + n).toString(16).padStart(64, '0');

describe('depositEvents', () => {
  it('parses commitment, leaf_index, root from Program data lines', () => {
    const logs = ['Program log: Instruction: Deposit', programDataLine(c(7), 3, r(3))];
    const events = parseDepositEvents(logs);
    expect(events).toEqual<DepositEvent[]>([{commitment: c(7), leafIndex: 3, root: r(3)}]);
  });
  it('ignores non-event log lines', () => {
    expect(parseDepositEvents(['Program log: hello', 'random'])).toEqual([]);
  });
  it('orderedLeaves places commitments densely by leaf_index', () => {
    const events: DepositEvent[] = [
      {commitment: c(20), leafIndex: 2, root: r(2)},
      {commitment: c(10), leafIndex: 0, root: r(0)},
      {commitment: c(15), leafIndex: 1, root: r(1)},
    ];
    expect(orderedLeaves(events)).toEqual([c(10), c(15), c(20)]);
  });
  it('orderedLeaves throws on a gap (missing leaf index)', () => {
    const events: DepositEvent[] = [
      {commitment: c(10), leafIndex: 0, root: r(0)},
      {commitment: c(20), leafIndex: 2, root: r(2)},
    ];
    expect(() => orderedLeaves(events)).toThrow(/gap/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=depositEvents`
Expected: FAIL — cannot find module `../depositEvents`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/shielded/depositEvents.ts
import {bytesToHex} from './fieldCodec';

export interface DepositEvent {
  commitment: string; // 64-char hex
  leafIndex: number;
  root: string;       // 64-char hex
}

const DISC = 8;
const COMMITMENT = 32;
const LEAF_INDEX = 8;
const ROOT = 32;
const EVENT_LEN = DISC + COMMITMENT + LEAF_INDEX + ROOT;

/**
 * Parse Anchor `Deposit` events from a transaction's log messages.
 * Each event is emitted as a base64 `Program data:` line:
 *   disc(8) + commitment[32] + leaf_index(u64 LE) + root[32].
 * Lines that do not decode to an event of the exact length are ignored (other
 * programs / events may also emit `Program data:`).
 */
export function parseDepositEvents(logs: string[]): DepositEvent[] {
  const out: DepositEvent[] = [];
  for (const line of logs) {
    const m = line.match(/^Program data: (.+)$/);
    if (!m) continue;
    const buf = Buffer.from(m[1]!, 'base64');
    if (buf.length !== EVENT_LEN) continue;
    const commitment = bytesToHex(buf.subarray(DISC, DISC + COMMITMENT));
    let leafIndex = 0n;
    for (let i = 0; i < LEAF_INDEX; i++) {
      leafIndex |= BigInt(buf[DISC + COMMITMENT + i]!) << BigInt(8 * i);
    }
    const root = bytesToHex(buf.subarray(DISC + COMMITMENT + LEAF_INDEX, EVENT_LEN));
    out.push({commitment, leafIndex: Number(leafIndex), root});
  }
  return out;
}

/**
 * Order commitments densely by leaf_index (0,1,2,...). Throws on a gap — a
 * missing index would mis-place every later leaf and silently corrupt the tree.
 */
export function orderedLeaves(events: DepositEvent[]): string[] {
  const byIndex = new Map<number, string>();
  for (const e of events) byIndex.set(e.leafIndex, e.commitment);
  const leaves: string[] = [];
  for (let i = 0; i < byIndex.size; i++) {
    const c = byIndex.get(i);
    if (c === undefined) throw new Error(`orderedLeaves: gap at leaf index ${i}`);
    leaves.push(c);
  }
  return leaves;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=depositEvents`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/depositEvents.ts src/modules/shielded/__tests__/depositEvents.test.ts
git commit -m "feat(shielded): parse + order Deposit events for merkle sync"
```

---

### Task 5: RPC Merkle sync + on-chain root parsing

**Files:**
- Create: `src/modules/shielded/merkleSync.ts`
- Test: `src/modules/shielded/__tests__/merkleSync.test.ts`

- [ ] **Step 1: Write the failing test**

The RPC calls are mocked; the pure `parseRootHistory` offset logic is exercised directly.

```ts
// src/modules/shielded/__tests__/merkleSync.test.ts
import {parseRootHistory} from '../merkleSync';

const hex = (n: number) => (n).toString(16).padStart(64, '0');

describe('parseRootHistory', () => {
  it('reads the 64 roots at offset 1296 (disc+next_leaf_index+zeros+filled_subtrees)', () => {
    // Layout: 8 disc + 8 next_leaf_index + 640 zeros + 640 filled_subtrees + 64*32 root_history + head(u16) + pad(6)
    const OFFSET = 8 + 8 + 640 + 640; // = 1296
    const data = Buffer.alloc(OFFSET + 64 * 32 + 8);
    // Put a recognizable root at slot 2.
    Buffer.from(hex(42), 'hex').copy(data, OFFSET + 2 * 32);
    const roots = parseRootHistory(data);
    expect(roots.length).toBe(64);
    expect(roots[2]).toBe(hex(42));
    expect(roots[0]).toBe('0'.repeat(64));
  });
  it('throws when the account is too small', () => {
    expect(() => parseRootHistory(Buffer.alloc(100))).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=merkleSync`
Expected: FAIL — cannot find module `../merkleSync`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/shielded/merkleSync.ts
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {poolPda, merkleTreePda} from './poolPdas';
import {parseDepositEvents, orderedLeaves} from './depositEvents';
import {bytesToHex} from './fieldCodec';

// MerkleTree account layout (zero-copy, #[repr(C)]), see programs/shielded-pool
// state.rs: 8 disc + 8 next_leaf_index + 640 zeros([[u8;32];20]) +
// 640 filled_subtrees([[u8;32];20]) + 64*32 root_history + u16 head + 6 pad.
const ROOT_HISTORY_OFFSET = 8 + 8 + 640 + 640; // 1296
const ROOT_HISTORY_LEN = 64;

/** Extract the 64-entry root_history ring (hex strings) from raw account data. */
export function parseRootHistory(data: Uint8Array): string[] {
  const end = ROOT_HISTORY_OFFSET + ROOT_HISTORY_LEN * 32;
  if (data.length < end) {
    throw new Error(`parseRootHistory: account too small (${data.length} < ${end})`);
  }
  const roots: string[] = [];
  for (let i = 0; i < ROOT_HISTORY_LEN; i++) {
    const start = ROOT_HISTORY_OFFSET + i * 32;
    roots.push(bytesToHex(data.subarray(start, start + 32)));
  }
  return roots;
}

export interface MerkleSyncResult {
  leaves: string[];       // hex commitments, dense by leaf index
  onChainRoots: string[]; // 64 hex roots from the tree's root_history
}

/**
 * Rebuild the pool's Merkle leaves by replaying Deposit events from RPC, and
 * read the on-chain root_history ring for membership verification. Self-contained
 * (no backend). Scans newest-first via getSignaturesForAddress on the merkle_tree
 * PDA (every deposit writes it), paginating with `before` until exhausted.
 */
export async function syncLeaves(mintBase58: string): Promise<MerkleSyncResult> {
  const connection = getConnection();
  const mint = new PublicKey(mintBase58);
  const tree = merkleTreePda(poolPda(mint));

  // Collect all signatures (paginate).
  const signatures: string[] = [];
  let before: string | undefined;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const page = await connection.getSignaturesForAddress(tree, {before, limit: 1000});
    if (page.length === 0) break;
    for (const s of page) if (!s.err) signatures.push(s.signature);
    before = page[page.length - 1]!.signature;
    if (page.length < 1000) break;
  }

  // Parse Deposit events from each transaction's logs (oldest first for stable order).
  const events = [];
  for (const sig of signatures.reverse()) {
    const tx = await connection.getTransaction(sig, {
      maxSupportedTransactionVersion: 0, commitment: 'confirmed',
    });
    const logs = tx?.meta?.logMessages ?? [];
    events.push(...parseDepositEvents(logs));
  }

  const leaves = orderedLeaves(events);

  const info = await connection.getAccountInfo(tree);
  if (!info) throw new Error('merkleSync: merkle_tree account not found');
  const onChainRoots = parseRootHistory(info.data);

  return {leaves, onChainRoots};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=merkleSync`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/merkleSync.ts src/modules/shielded/__tests__/merkleSync.test.ts
git commit -m "feat(shielded): RPC log-scan merkle sync + root_history parsing"
```

---

### Task 6: Withdraw witness builder

**Files:**
- Create: `src/modules/shielded/withdrawWitness.ts`
- Test: `src/modules/shielded/__tests__/withdrawWitness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/withdrawWitness.test.ts
import {PublicKey} from '@solana/web3.js';
import {buildWithdrawWitness} from '../withdrawWitness';
import {nullifier, mintHash, recipientField} from '../noteCrypto';
import {getPkRecipientHash} from '../shieldedIdentity';
import {decToHex64} from '../fieldCodec';
import {computeMerklePath} from '../../merkle/merkleModule';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const DEST = new PublicKey('11111111111111111111111111111112');
const seed = new Uint8Array(32).fill(7);

function makeNote(commitmentDec: string): ShieldedNote {
  return {commitment: commitmentDec, nullifier: '', mint: MINT, amount: 200n, index: 0, spent: false, createdAt: 1, noteSecret: '12345'};
}

describe('buildWithdrawWitness', () => {
  it('produces circuit-order public params with correct crypto', () => {
    // Build a leaf set where the note's own commitment sits at its index.
    const note = makeNote('999');
    const leaves = [decToHex64(note.commitment)];
    const {params, nullifier32, merkleRoot32} = buildWithdrawWitness({
      seed, note, destTokenAccount: DEST, leaves,
    });

    const expectedNull = nullifier({noteSecret: BigInt(note.noteSecret), leafIndex: note.index});
    const expectedMint = mintHash(new PublicKey(MINT).toBytes());
    const expectedRecip = recipientField(DEST.toBytes());
    const expectedPk = getPkRecipientHash(seed);
    const {root} = computeMerklePath(leaves, note.index);

    expect(params.nullifier).toBe(expectedNull.toString());
    expect(params.mintHash).toBe(expectedMint.toString());
    expect(params.recipientField).toBe(expectedRecip.toString());
    expect(params.pkRecipientHash).toBe(expectedPk.toString());
    expect(params.merkleRoot).toBe(BigInt('0x' + root).toString());
    expect(params.withdrawAmount).toBe('200');
    expect(params.amount).toBe('200');
    expect(params.leafIndex).toBe('0');
    expect((params.merklePath as string[]).length).toBe(20);
    expect((params.merklePathIndices as string[]).length).toBe(20);
    expect(nullifier32.length).toBe(32);
    expect(merkleRoot32.length).toBe(32);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=withdrawWitness`
Expected: FAIL — cannot find module `../withdrawWitness`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/modules/shielded/withdrawWitness.ts
import {PublicKey} from '@solana/web3.js'; // value import — also serves as the type
import {nullifier, mintHash, recipientField} from './noteCrypto';
import {getPkRecipientHash} from './shieldedIdentity';
import {computeMerklePath} from '../merkle/merkleModule';
import {decToBe32, hexToDec} from './fieldCodec';
import type {ShieldedProveParams} from '../zkProver/types';
import type {ShieldedNote} from './types';

export interface WithdrawWitnessInput {
  seed: Uint8Array;
  note: ShieldedNote;
  destTokenAccount: PublicKey;
  leaves: string[]; // hex commitments, dense by leaf index (from merkleSync)
}

export interface WithdrawWitness {
  params: ShieldedProveParams;
  nullifier32: Uint8Array;  // BE 32B — ix arg + nullifier PDA seed
  merkleRoot32: Uint8Array; // BE 32B — ix arg
}

/**
 * Build the withdraw circuit witness + /zk/prove params for a whole-note spend.
 * Public inputs (circuit order): [merkleRoot, nullifier, withdrawAmount,
 * recipientField, mintHash]. withdrawAmount == amount (no change output).
 * merklePath/merklePathIndices are decimal-string arrays (indices as '0'/'1',
 * LSB-first). See project_shielded_c2_contract for the signal contract.
 */
export function buildWithdrawWitness(input: WithdrawWitnessInput): WithdrawWitness {
  const {seed, note, destTokenAccount, leaves} = input;
  const pkH = getPkRecipientHash(seed);
  const mH = mintHash(new PublicKey(note.mint).toBytes());
  const nul = nullifier({noteSecret: BigInt(note.noteSecret), leafIndex: note.index});
  const recip = recipientField(destTokenAccount.toBytes());
  const {root, siblings, pathIndices} = computeMerklePath(leaves, note.index);
  const merkleRootDec = hexToDec(root);

  const params: ShieldedProveParams = {
    merkleRoot: merkleRootDec,
    nullifier: nul.toString(),
    withdrawAmount: note.amount.toString(),
    recipientField: recip.toString(),
    mintHash: mH.toString(),
    noteSecret: BigInt(note.noteSecret).toString(),
    pkRecipientHash: pkH.toString(),
    amount: note.amount.toString(),
    leafIndex: note.index.toString(),
    merklePath: siblings.map(hexToDec),
    merklePathIndices: pathIndices.map(b => b.toString()),
  };

  return {
    params,
    nullifier32: decToBe32(nul.toString()),
    merkleRoot32: decToBe32(merkleRootDec),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=withdrawWitness`
Expected: PASS.

- [ ] **Step 5: Verify types + lint, then commit**

Run: `npx tsc --noEmit` (expect clean) and `npx eslint src/modules/shielded/withdrawWitness.ts` (expect 0 errors).

```bash
git add src/modules/shielded/withdrawWitness.ts src/modules/shielded/__tests__/withdrawWitness.test.ts
git commit -m "feat(shielded): withdraw witness builder (11-signal, circuit order)"
```

---

### Task 7: `buildWithdrawIx` + idempotent ATA helper + multi-ix submit

**Files:**
- Modify: `src/modules/shielded/poolInstructions.ts`
- Modify: `src/modules/shielded/poolTx.ts`
- Modify: `src/modules/solana/transactionBuilder.ts` (export an idempotent ATA-create helper)
- Test: `src/modules/shielded/__tests__/withdrawIx.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/withdrawIx.test.ts
import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildWithdrawIx} from '../poolInstructions';

const pk = (s: string) => new PublicKey(s);
const SYS = '11111111111111111111111111111111';
const TOK = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';

describe('buildWithdrawIx', () => {
  const base = {
    merkleRoot: new Uint8Array(32).fill(1),
    nullifier: new Uint8Array(32).fill(2),
    amount: 200n,
    proofBytes: new Uint8Array(256).fill(3),
    pool: pk('11111111111111111111111111111112'),
    merkleTree: pk('11111111111111111111111111111113'),
    vault: pk('11111111111111111111111111111114'),
    destinationTokenAccount: pk('11111111111111111111111111111115'),
    nullifierRecord: pk('11111111111111111111111111111116'),
    feePayer: pk('11111111111111111111111111111117'),
  };

  it('uses the global:withdraw discriminator', () => {
    const ix = buildWithdrawIx(base);
    const disc = sha256(Buffer.from('global:withdraw')).slice(0, 8);
    expect(Buffer.from(ix.data.subarray(0, 8))).toEqual(Buffer.from(disc));
  });

  it('lays out data: disc + root(32) + nullifier(32) + amount(u64 LE) + len(u32) + proof', () => {
    const ix = buildWithdrawIx(base);
    expect(ix.data.length).toBe(8 + 32 + 32 + 8 + 4 + 256);
    // amount LE at offset 8+32+32
    expect(ix.data[8 + 64]).toBe(200);
    // proof length prefix
    const lenOff = 8 + 32 + 32 + 8;
    expect(ix.data[lenOff]).toBe(256 & 0xff);
    expect(ix.data[lenOff + 1]).toBe((256 >> 8) & 0xff);
  });

  it('orders accounts per WithdrawCtx with correct signer/writable flags', () => {
    const ix = buildWithdrawIx(base);
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
    ]);
  });

  it('rejects wrong proof length', () => {
    expect(() => buildWithdrawIx({...base, proofBytes: new Uint8Array(10)})).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=withdrawIx`
Expected: FAIL — `buildWithdrawIx` is not exported.

- [ ] **Step 3: Write the implementation**

In `src/modules/shielded/poolInstructions.ts` add (reuse the existing private `u64le`, `u32le`, `discriminator`, `SPL_TOKEN_PROGRAM_ID`, `PROGRAM`):

```ts
import {SystemProgram} from '@solana/web3.js'; // add to existing web3 import line

export const withdrawDiscriminator = (): Uint8Array => discriminator('withdraw');

export interface WithdrawIxParams {
  merkleRoot: Uint8Array;   // 32
  nullifier: Uint8Array;    // 32
  amount: bigint;
  proofBytes: Uint8Array;   // 256
  pool: PublicKey;
  merkleTree: PublicKey;
  vault: PublicKey;
  destinationTokenAccount: PublicKey;
  nullifierRecord: PublicKey;
  feePayer: PublicKey;
}

/**
 * withdraw(merkle_root: [u8;32], nullifier: [u8;32], amount: u64, proof_bytes).
 * Data = disc(8) + merkle_root(32) + nullifier(32) + amount(u64 LE) + len(u32 LE) + proof.
 * Accounts (WithdrawCtx order): pool(ro), merkle_tree(mut), vault(mut),
 * destination_token_account(mut), nullifier_record(mut/init), fee_payer(signer,mut),
 * token_program(ro), system_program(ro).
 */
export function buildWithdrawIx(p: WithdrawIxParams): TransactionInstruction {
  if (p.merkleRoot.length !== 32) throw new Error('merkleRoot must be 32 bytes');
  if (p.nullifier.length !== 32) throw new Error('nullifier must be 32 bytes');
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');

  const data = Buffer.concat([
    Buffer.from(withdrawDiscriminator()),
    Buffer.from(p.merkleRoot),
    Buffer.from(p.nullifier),
    Buffer.from(u64le(p.amount)),
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
    ],
    data,
  });
}
```

In `src/modules/solana/transactionBuilder.ts`, add an exported idempotent ATA-create helper (mirror the private `buildCreateAtaInstruction` but `data: Buffer.from([1])`):

```ts
/**
 * Associated-Token-Account "CreateIdempotent" instruction (data byte 1) — a
 * no-op if the ATA already exists. Use when we can't cheaply know whether the
 * destination ATA is present.
 */
export function buildCreateAtaIdempotentInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      {pubkey: payer, isSigner: true, isWritable: true},
      {pubkey: ata, isSigner: false, isWritable: true},
      {pubkey: owner, isSigner: false, isWritable: false},
      {pubkey: mint, isSigner: false, isWritable: false},
      {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
    ],
    programId: SPL_ATA_PROGRAM_ID,
    data: Buffer.from([1]),
  });
}
```

In `src/modules/shielded/poolTx.ts`, add a multi-instruction submit (keep `submitPoolTx` as-is):

```ts
/**
 * Like submitPoolTx but for a list of instructions (e.g. create-ATA + withdraw).
 * Prepends the ComputeBudget limit, signs as fee_payer, submits + confirms.
 */
export async function submitPoolTxMany(
  poolIxs: TransactionInstruction[],
  computeUnitLimit: number,
  feePayer: Keypair,
): Promise<string> {
  const connection = getConnection();
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({units: computeUnitLimit}),
    ...poolIxs,
  ];
  const {signature} = await signAndSend(
    connection, {payer: feePayer.publicKey, instructions}, [feePayer],
  );
  return signature;
}
```

- [ ] **Step 4: Run test + types**

Run: `npx jest --testPathPattern=withdrawIx` (expect PASS, 4 tests) and `npx tsc --noEmit` (expect clean).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/poolInstructions.ts src/modules/shielded/poolTx.ts src/modules/solana/transactionBuilder.ts src/modules/shielded/__tests__/withdrawIx.test.ts
git commit -m "feat(shielded): buildWithdrawIx + idempotent ATA create + multi-ix submit"
```

---

### Task 8: `withdrawFlow.unshield` orchestrator

**Files:**
- Create: `src/modules/shielded/withdrawFlow.ts`
- Test: `src/modules/shielded/__tests__/withdrawFlow.test.ts`

- [ ] **Step 1: Write the failing test**

Mock the collaborators so the orchestration logic (root-membership check, spend marking, error on stale root) is tested without RPC/prover.

```ts
// src/modules/shielded/__tests__/withdrawFlow.test.ts
import {PublicKey, Keypair} from '@solana/web3.js';

jest.mock('../merkleSync', () => ({
  syncLeaves: jest.fn(),
}));
jest.mock('../withdrawWitness', () => ({
  buildWithdrawWitness: jest.fn(() => ({
    params: {merkleRoot: '5'},
    nullifier32: new Uint8Array(32).fill(2),
    merkleRoot32: new Uint8Array(32).fill(1),
  })),
}));
jest.mock('../../zkProver/zkProverModule', () => ({
  proveShielded: jest.fn(async () => ({proofBytes: '00'.repeat(256), publicInputs: [], proofData: ''})),
}));
jest.mock('../poolTx', () => ({submitPoolTxMany: jest.fn(async () => 'SIG123')}));
jest.mock('../noteStore', () => ({markSpentByIndex: jest.fn()}));
jest.mock('../../solana/connection', () => ({
  getConnection: () => ({
    getTransaction: jest.fn(async () => ({meta: {err: null}})),
  }),
}));
jest.mock('../../store/mmkv/instances', () => ({
  mmkvSecure: () => ({}), initSecureMmkv: jest.fn(),
}));

import {unshield, MerkleRootStaleError} from '../withdrawFlow';
import {syncLeaves} from '../merkleSync';
import {markSpentByIndex} from '../noteStore';
import type {ShieldedNote} from '../types';

const MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
const note: ShieldedNote = {commitment: 'c', nullifier: '', mint: MINT, amount: 200n, index: 0, spent: false, createdAt: 1, noteSecret: '9'};
const feePayer = Keypair.generate();
const seed = new Uint8Array(32).fill(3);

// merkleRoot32 is 0x01*32 → its hex; onChainRoots must contain it to pass.
const rootHex = '01'.repeat(32);

describe('unshield', () => {
  beforeEach(() => jest.clearAllMocks());
  it('proves, submits, and marks the note spent when the root is on-chain', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: [rootHex]});
    const res = await unshield(seed, feePayer, MINT, note);
    expect(res.txSignature).toBe('SIG123');
    expect(res.amount).toBe(200n);
    expect(markSpentByIndex).toHaveBeenCalledWith(MINT, 0);
  });
  it('throws MerkleRootStaleError when the local root is absent from root_history', async () => {
    (syncLeaves as jest.Mock).mockResolvedValue({leaves: ['c'], onChainRoots: ['ab'.repeat(32)]});
    await expect(unshield(seed, feePayer, MINT, note)).rejects.toBeInstanceOf(MerkleRootStaleError);
    expect(markSpentByIndex).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=withdrawFlow`
Expected: FAIL — cannot find module `../withdrawFlow`.

- [ ] **Step 3: Write the implementation**

```ts
// src/modules/shielded/withdrawFlow.ts
import {PublicKey, type Keypair} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {proveShielded} from '../zkProver/zkProverModule';
import {syncLeaves} from './merkleSync';
import {buildWithdrawWitness} from './withdrawWitness';
import {buildWithdrawIx} from './poolInstructions';
import {submitPoolTxMany} from './poolTx';
import {poolPda, merkleTreePda, vaultAta, nullifierPda} from './poolPdas';
import {
  findAssociatedTokenAddress,
  buildCreateAtaIdempotentInstruction,
} from '../solana/transactionBuilder';
import {markSpentByIndex} from './noteStore';
import {mmkvSecure, initSecureMmkv} from '../../store/mmkv/instances';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {hexToBytes, bytesToHex} from './fieldCodec';
import {SHIELDED_CU} from '../../constants/programs';
import type {ShieldedNote} from './types';

const PROOF_BYTES_LEN = 256;

export class MerkleRootStaleError extends Error {
  constructor() {
    super('Local Merkle root is not in the on-chain history — resync needed');
    this.name = 'MerkleRootStaleError';
  }
}

function ensureSecureMmkv(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
}

export interface UnshieldResult {txSignature: string; amount: bigint;}

/**
 * Unshield one whole note back to the user's own transparent ATA (self-relay).
 * Sync leaves (RPC) → verify our root is in root_history → prove → withdraw tx
 * (create-ATA-idempotent + withdraw) → mark the note spent. The note is marked
 * spent ONLY after a confirmed, non-reverted transaction.
 */
export async function unshield(
  seed: Uint8Array,
  feePayer: Keypair,
  mintBase58: string,
  note: ShieldedNote,
): Promise<UnshieldResult> {
  ensureSecureMmkv(seed);
  const mint = new PublicKey(mintBase58);
  const destTokenAccount = findAssociatedTokenAddress(feePayer.publicKey, mint);

  const {leaves, onChainRoots} = await syncLeaves(mintBase58);

  const {params, nullifier32, merkleRoot32} = buildWithdrawWitness({
    seed, note, destTokenAccount, leaves,
  });

  // Defense in depth: the program scans the 64-entry ring, so a valid local root
  // must be present. If not, our scan is stale/inconsistent — do not spend.
  if (!onChainRoots.includes(bytesToHex(merkleRoot32))) {
    throw new MerkleRootStaleError();
  }

  const proof = await proveShielded('withdraw', params);
  const proofBytes = hexToBytes(proof.proofBytes);
  if (proofBytes.length !== PROOF_BYTES_LEN) {
    throw new Error(`proofBytes must be ${PROOF_BYTES_LEN} bytes`);
  }

  const pool = poolPda(mint);
  const withdrawIx = buildWithdrawIx({
    merkleRoot: merkleRoot32,
    nullifier: nullifier32,
    amount: note.amount,
    proofBytes,
    pool,
    merkleTree: merkleTreePda(pool),
    vault: vaultAta(pool, mint),
    destinationTokenAccount: destTokenAccount,
    nullifierRecord: nullifierPda(nullifier32),
    feePayer: feePayer.publicKey,
  });

  const createAtaIx = buildCreateAtaIdempotentInstruction(
    feePayer.publicKey, destTokenAccount, feePayer.publicKey, mint,
  );

  const txSignature = await submitPoolTxMany(
    [createAtaIx, withdrawIx], SHIELDED_CU.withdraw, feePayer,
  );

  const connection = getConnection();
  const tx = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0, commitment: 'confirmed',
  });
  if (tx?.meta?.err) {
    throw new Error(`Withdraw transaction reverted on-chain: ${JSON.stringify(tx.meta.err)}`);
  }

  markSpentByIndex(mintBase58, note.index);
  return {txSignature, amount: note.amount};
}
```

- [ ] **Step 4: Run test + types**

Run: `npx jest --testPathPattern=withdrawFlow` (expect PASS, 2 tests) and `npx tsc --noEmit` (expect clean).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/withdrawFlow.ts src/modules/shielded/__tests__/withdrawFlow.test.ts
git commit -m "feat(shielded): withdrawFlow.unshield — whole-note withdraw to self ATA"
```

---

### Task 9: Wire ZkProofScreen for `direction === 'public'`

**Files:**
- Modify: `src/screens/shielded/ZkProofScreen.tsx`
- Test: `src/screens/shielded/__tests__/ZkProofScreen.test.tsx` (extend)

The screen already runs `runDepositShield(route.params)` for `direction === 'private'` through a build→prove→verify→ready state machine and renders a success screen at `state.kind === 'ready'`. Generalize the operation dispatch and note-selection, and branch the success copy by direction.

- [ ] **Step 1: Write the failing test**

Add a test that a public-direction render selects a matching note and calls `unshield`. Mock `withdrawFlow.unshield` and `noteStore.getNotes`.

```ts
// Add to src/screens/shielded/__tests__/ZkProofScreen.test.tsx
jest.mock('../../../modules/shielded/withdrawFlow', () => ({
  unshield: jest.fn(async () => ({txSignature: 'WSIG', amount: 200_000_000n})),
  MerkleRootStaleError: class extends Error {},
}));
jest.mock('../../../modules/shielded/noteStore', () => ({
  getNotes: jest.fn(() => [
    {commitment: 'c', nullifier: '', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', amount: 200_000_000n, index: 0, spent: false, createdAt: 1, noteSecret: '9'},
  ]),
}));

// In a new describe, render ZkProofScreen with route.params
// {direction:'public', amount:'200000000', mint:'B61Sy...'} and assert unshield
// is invoked with the selected note (index 0). Follow the existing test file's
// render harness + navigation/route mocks; reuse its keychain + keypair mocks.
```

Implementer: match the existing test file's mocking style (it already mocks navigation, `keychainManager.retrieveSeed`, `deriveTransparentKeypair`, and `depositShield`). Assert `unshield` was called and the success screen shows the unshield copy.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=ZkProofScreen`
Expected: FAIL — screen still early-returns for non-private direction; `unshield` never called.

- [ ] **Step 3: Implement**

Add imports:

```ts
import {unshield} from '../../modules/shielded/withdrawFlow';
import {getNotes} from '../../modules/shielded/noteStore';
```

Generalize `DepositOutcome` to a shared outcome (keep `leafIndex` — for withdraw, use the spent note's index for the "Note position" line):

```ts
type ShieldOutcome = {txSignature: string; leafIndex: number};
```

Replace `runDepositShield` with a dispatcher that handles both directions. Keep the existing deposit branch verbatim; add the public branch:

```ts
// params type = Props['route']['params'] (RootStackParamList['ZkProofModal']),
// the same object the existing runDepositShield already receives.
async function runShieldOp(
  params: Props['route']['params'],
): Promise<ShieldOutcome> {
  const mnemonic = await keychainManager.retrieveSeed();
  // ... existing seed derivation → seed + transparent keypair (unchanged) ...
  const mint = params.mint ?? SHIELDED_POOL_MINTS[0] ?? '';

  if (params.direction === 'private') {
    const result = await depositShield(seed, feePayer, mint, BigInt(params.amount));
    // zeroize seed (unchanged)
    return {txSignature: result.txSignature, leafIndex: result.leafIndex};
  }

  // direction === 'public' → whole-note unshield.
  const target = BigInt(params.amount);
  const note = getNotes(mint).find(n => n.amount === target);
  if (!note) {
    // zeroize seed
    throw new Error('POC: unshield supports a full note only — amount must match a shielded note');
  }
  const result = await unshield(seed, feePayer, mint, note);
  // zeroize seed
  return {txSignature: result.txSignature, leafIndex: note.index};
}
```

Update the two call sites (the effect that ran `runDepositShield(route.params)` on entry, and any retry path) to call `runShieldOp(route.params)`. Remove the early `if (params.direction !== 'private') return ...` guard.

Branch the success-screen copy by direction (around `if (state.kind === 'ready')`):

```ts
const isPublic = route.params.direction === 'public';
const heroTitle = isPublic ? 'Unshielded' : 'Shielded';
const heroSub = isPublic
  ? 'Your funds are public again in your transparent balance.'
  : 'Your deposit is now private. Only you can spend it.';
const heroAmount = isPublic
  ? `${amountTokens} ${symbol} unshielded`
  : `${amountTokens} ${symbol} shielded`;
// use heroTitle / heroSub / heroAmount in the three <Text> nodes that currently
// hardcode "Shielded" / "Your deposit is now private…" / "{amount} {symbol} shielded".
```

Keep the stage labels, note-position row, tx copy, explorer link, and Done→popToTop unchanged.

- [ ] **Step 4: Run test + types + lint**

Run: `npx jest --testPathPattern=ZkProofScreen` (expect PASS), `npx tsc --noEmit` (clean), `npx eslint src/screens/shielded/ZkProofScreen.tsx` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add src/screens/shielded/ZkProofScreen.tsx src/screens/shielded/__tests__/ZkProofScreen.test.tsx
git commit -m "feat(shielded): wire ZkProofScreen public direction to unshield + success copy"
```

---

### Task 10: Polish — Shield/Unshield top gap

**Files:**
- Modify: `src/screens/shielded/ShieldUnshieldScreen.tsx`

The screen renders a token chip in the header, then a large empty vertical gap before the "Make private / Make public" toggle (screenshot 34). Tighten the spacing so the amount card sits near the top per the #16 design.

- [ ] **Step 1: Locate the gap**

Read `src/screens/shielded/ShieldUnshieldScreen.tsx` around the header (`TokenSelector` at ~line 175) and the toggle (~line 185). Find the container/spacer between them (likely a `flex-1` spacer, a large `marginTop`/`paddingTop`, or a header `View` sized for content that isn't there). Compare against `/home/user/Downloads/index.html` §#16 to confirm the intended layout (header → toggle → amount card → fees → CTA, top-aligned).

- [ ] **Step 2: Fix the spacing**

Remove/reduce the offending spacer so the toggle follows the header with normal spacing (match the transparent Send screen's header rhythm). Do not change the toggle, amount card, fees, or CTA. Keep it a minimal, targeted change.

- [ ] **Step 3: Verify tests still pass**

Run: `npx jest --testPathPattern=ShieldUnshield` (expect PASS — existing tests unaffected) and `npx tsc --noEmit` (clean).

- [ ] **Step 4: Commit**

```bash
git add src/screens/shielded/ShieldUnshieldScreen.tsx
git commit -m "fix(shielded): tighten Shield/Unshield header spacing (top gap)"
```

---

### Task 11: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Full type-check, tests, lint**

Run:
```bash
npx tsc --noEmit
npx jest
npx eslint src/modules/shielded src/modules/merkle src/screens/shielded
```
Expected: tsc clean; all Jest suites pass (existing + new); eslint 0 errors (pre-existing warnings acceptable).

- [ ] **Step 2: Confirm no regressions in the deposit path**

Run: `npx jest --testPathPattern='depositFlow|poolInstructions|ZkProofScreen|ShieldUnshield'`
Expected: PASS — deposit is untouched behaviorally.

- [ ] **Step 3: (Handled by controller)**

On-device devnet verification is a manual user step after the branch is built into the devnet APK (`cd android && ENVFILE=.env.devnet ./gradlew assembleRelease` → `/home/user/Downloads/noctura-devnet-shielded.apk`). Not a code step.

---

## On-device acceptance (user, after merge-candidate build)

- Unshield the 0.2 TEST note: pool vault falls 0.2, the self ATA rises 0.2, the shielded dashboard balance drops to 0 (empty state), and a second unshield of the same note is rejected (nullifier "already in use").
- The Shield/Unshield screen no longer shows the large top gap.
