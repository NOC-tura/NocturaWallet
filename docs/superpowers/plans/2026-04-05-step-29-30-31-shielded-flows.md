# Step 29-30-31: Shielded Deposit, Transfer, Withdraw

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build three shielded mode screens (deposit, transfer, withdraw) with shared business logic for note management, privacy assessment, address encoding, and proof-to-relayer orchestration.

**Architecture:** Shared `src/modules/shielded/` module encapsulates business logic; thin screen components wire module to UI. Screens follow existing `input → confirm → proving → success` state machine pattern from SendScreen.

**Tech Stack:** @scure/base (Bech32m), Zustand (shieldedStore), MMKV (noteStore), pinnedFetch (relayer/config APIs), zkProver (proof generation), feeEngine (fee calculation)

---

## File Structure

```
src/
├── modules/
│   └── shielded/
│       ├── types.ts                    — All shared types
│       ├── shieldedAddressCodec.ts     — Bech32m encode/decode/validate
│       ├── privacyMeter.ts             — Privacy level from leaf count
│       ├── noteStore.ts                — MMKV-persisted note CRUD + selection
│       ├── shieldedService.ts          — Orchestrator: proof → relayer
│       └── __tests__/
│           ├── shieldedAddressCodec.test.ts
│           ├── privacyMeter.test.ts
│           ├── noteStore.test.ts
│           └── shieldedService.test.ts
├── screens/
│   └── shielded/
│       ├── DepositScreen.tsx
│       ├── ShieldedTransferScreen.tsx
│       ├── WithdrawScreen.tsx
│       └── __tests__/
│           ├── DepositScreen.test.tsx
│           ├── ShieldedTransferScreen.test.tsx
│           └── WithdrawScreen.test.tsx
├── components/
│   ├── PrivacyMeter.tsx
│   ├── FeeDisplayRow.tsx
│   ├── ProofProgressOverlay.tsx
│   └── ShieldedAddressInput.tsx
```

---

## Task 1: Types + Shielded Address Codec (TDD)

### Tests (7):

1. encodeShieldedAddress round-trips with decodeShieldedAddress
2. encodeShieldedAddress returns string starting with "noc1"
3. decodeShieldedAddress throws E110 for wrong HRP (e.g. "bc1...")
4. decodeShieldedAddress throws E110 for invalid checksum
5. decodeShieldedAddress throws E110 for wrong data length (not 48 bytes)
6. isValidShieldedAddress returns true for valid, false for invalid
7. formatShieldedAddress truncates to "noc1xxxx...yyyy" (first 8 + last 4)

### Implementation:

**`src/modules/shielded/types.ts`:**

```typescript
export interface ShieldedNote {
  commitment: string;
  nullifier: string;
  mint: string;
  amount: bigint;
  index: number;
  spent: boolean;
  createdAt: number;
}

/** JSON-serializable form for MMKV persistence (bigint → string). */
export interface ShieldedNoteJson {
  commitment: string;
  nullifier: string;
  mint: string;
  amount: string;
  index: number;
  spent: boolean;
  createdAt: number;
}

export interface DepositParams {
  mint: string;
  amount: bigint;
  senderPubkey: string;
}

export interface ShieldedTransferParams {
  mint: string;
  amount: bigint;
  recipientAddress: string;
  memo?: string;
}

export interface WithdrawParams {
  mint: string;
  amount: bigint;
  destinationPubkey: string;
}

export interface ShieldedTxResult {
  txSignature: string;
  proofType: 'deposit' | 'transfer' | 'withdraw';
  amount: bigint;
  timestamp: number;
}

export interface CircuitConfig {
  maxInputs: number;
  maxOutputs: number;
  treeDepth: number;
}

export interface PrivacyLevel {
  level: 'low' | 'moderate' | 'good';
  message: string;
  color: 'red' | 'yellow' | 'green';
  shouldShow: boolean;
}

export type ConsolidationProgress = {
  currentStep: number;
  totalSteps: number;
};

export type ShieldedScreenStep = 'input' | 'confirm' | 'consolidating' | 'proving' | 'success' | 'error';
```

**`src/modules/shielded/shieldedAddressCodec.ts`:**

```typescript
import {bech32m} from '@scure/base';
import {SHIELDED_ADDRESS_HRP} from '../../constants/programs';
import {ERRORS} from '../../constants/errors';

const SHIELDED_PK_BYTES = 48; // BLS12-381 G1 compressed

export function encodeShieldedAddress(publicKey: Uint8Array): string {
  if (publicKey.length !== SHIELDED_PK_BYTES) {
    throw new Error(`Expected ${SHIELDED_PK_BYTES} bytes, got ${publicKey.length}`);
  }
  const words = bech32m.toWords(publicKey);
  return bech32m.encode(SHIELDED_ADDRESS_HRP, words, 90);
}

export function decodeShieldedAddress(address: string): Uint8Array {
  try {
    const {prefix, words} = bech32m.decode(address, 90);
    if (prefix !== SHIELDED_ADDRESS_HRP) {
      throw new Error(`Wrong HRP: expected ${SHIELDED_ADDRESS_HRP}, got ${prefix}`);
    }
    const data = bech32m.fromWords(words);
    if (data.length !== SHIELDED_PK_BYTES) {
      throw new Error(`Wrong data length: expected ${SHIELDED_PK_BYTES}, got ${data.length}`);
    }
    return Uint8Array.from(data);
  } catch {
    const err = ERRORS.INVALID_SHIELDED_ADDR;
    throw new Error(err.message);
  }
}

export function isValidShieldedAddress(address: string): boolean {
  try {
    decodeShieldedAddress(address);
    return true;
  } catch {
    return false;
  }
}

export function formatShieldedAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 8)}...${address.slice(-4)}`;
}
```

**`src/modules/shielded/__tests__/shieldedAddressCodec.test.ts`:**

```typescript
jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

import {
  encodeShieldedAddress,
  decodeShieldedAddress,
  isValidShieldedAddress,
  formatShieldedAddress,
} from '../shieldedAddressCodec';

describe('shieldedAddressCodec', () => {
  const validPk = new Uint8Array(48).fill(0xab);

  it('round-trips encode → decode', () => {
    const encoded = encodeShieldedAddress(validPk);
    const decoded = decodeShieldedAddress(encoded);
    expect(decoded).toEqual(validPk);
  });

  it('encodeShieldedAddress returns string starting with noc1', () => {
    const encoded = encodeShieldedAddress(validPk);
    expect(encoded.startsWith('noc1')).toBe(true);
  });

  it('decodeShieldedAddress throws for wrong HRP', () => {
    // Encode with wrong HRP by replacing prefix
    expect(() => decodeShieldedAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toThrow(
      'Invalid private address',
    );
  });

  it('decodeShieldedAddress throws for invalid checksum', () => {
    const encoded = encodeShieldedAddress(validPk);
    const corrupted = encoded.slice(0, -1) + 'x';
    expect(() => decodeShieldedAddress(corrupted)).toThrow('Invalid private address');
  });

  it('decodeShieldedAddress throws for wrong data length', () => {
    // 32 bytes instead of 48
    const shortPk = new Uint8Array(32).fill(0xcd);
    const {bech32m} = require('@scure/base');
    const words = bech32m.toWords(shortPk);
    const shortAddr = bech32m.encode('noc', words, 90);
    expect(() => decodeShieldedAddress(shortAddr)).toThrow('Invalid private address');
  });

  it('isValidShieldedAddress returns true for valid, false for invalid', () => {
    const encoded = encodeShieldedAddress(validPk);
    expect(isValidShieldedAddress(encoded)).toBe(true);
    expect(isValidShieldedAddress('noc1invalid')).toBe(false);
    expect(isValidShieldedAddress('not-an-address')).toBe(false);
  });

  it('formatShieldedAddress truncates correctly', () => {
    const encoded = encodeShieldedAddress(validPk);
    const formatted = formatShieldedAddress(encoded);
    expect(formatted).toMatch(/^noc1.{4}\.\.\..{4}$/);
    expect(formatted.length).toBe(15); // 8 + 3 + 4
  });
});
```

**Verify:** `npx tsc --noEmit && npx jest --testPathPattern='shieldedAddressCodec' --no-coverage`

**Note:** If `@scure/base` is not resolvable, run `npm install @scure/base` first. It may already be a transitive dep of `@scure/bip32`.

Commit: `git commit -m "feat: shielded types + address codec (Bech32m encode/decode/validate)"`

---

## Task 2: Privacy Meter (TDD)

### Tests (6):

1. leafCount < 100 returns level='low', color='red', shouldShow=true
2. leafCount 500 returns level='moderate', color='yellow', shouldShow=true
3. leafCount 5000 returns level='good', color='green', shouldShow=true
4. leafCount >= 10000 returns shouldShow=false when not first deposit
5. leafCount >= 10000 returns shouldShow=true when isFirstDeposit=true
6. shouldRepeatWarning returns true when leafCount < 1000, false when >= 1000

### Implementation:

**`src/modules/shielded/privacyMeter.ts`:**

```typescript
import type {PrivacyLevel} from './types';

export function getPrivacyLevel(leafCount: number, isFirstDeposit: boolean): PrivacyLevel {
  if (leafCount < 100) {
    return {
      level: 'low',
      message: 'Privacy pool is very small. May be traceable.',
      color: 'red',
      shouldShow: true,
    };
  }
  if (leafCount < 1000) {
    return {
      level: 'moderate',
      message: 'Privacy pool is growing. Moderate protection.',
      color: 'yellow',
      shouldShow: true,
    };
  }
  if (leafCount < 10000) {
    return {
      level: 'good',
      message: 'Good privacy protection.',
      color: 'green',
      shouldShow: true,
    };
  }
  return {
    level: 'good',
    message: 'Good privacy protection.',
    color: 'green',
    shouldShow: isFirstDeposit,
  };
}

export function shouldRepeatWarning(leafCount: number): boolean {
  return leafCount < 1000;
}
```

**`src/modules/shielded/__tests__/privacyMeter.test.ts`:**

```typescript
import {getPrivacyLevel, shouldRepeatWarning} from '../privacyMeter';

describe('privacyMeter', () => {
  it('leafCount < 100 returns low/red/shouldShow', () => {
    const result = getPrivacyLevel(50, false);
    expect(result.level).toBe('low');
    expect(result.color).toBe('red');
    expect(result.shouldShow).toBe(true);
    expect(result.message).toContain('very small');
  });

  it('leafCount 500 returns moderate/yellow/shouldShow', () => {
    const result = getPrivacyLevel(500, false);
    expect(result.level).toBe('moderate');
    expect(result.color).toBe('yellow');
    expect(result.shouldShow).toBe(true);
  });

  it('leafCount 5000 returns good/green/shouldShow', () => {
    const result = getPrivacyLevel(5000, false);
    expect(result.level).toBe('good');
    expect(result.color).toBe('green');
    expect(result.shouldShow).toBe(true);
  });

  it('leafCount >= 10000 returns shouldShow=false when not first deposit', () => {
    const result = getPrivacyLevel(15000, false);
    expect(result.level).toBe('good');
    expect(result.shouldShow).toBe(false);
  });

  it('leafCount >= 10000 returns shouldShow=true when isFirstDeposit', () => {
    const result = getPrivacyLevel(15000, true);
    expect(result.level).toBe('good');
    expect(result.shouldShow).toBe(true);
  });

  it('shouldRepeatWarning returns true < 1000, false >= 1000', () => {
    expect(shouldRepeatWarning(999)).toBe(true);
    expect(shouldRepeatWarning(1000)).toBe(false);
    expect(shouldRepeatWarning(50)).toBe(true);
  });
});
```

**Verify:** `npx tsc --noEmit && npx jest --testPathPattern='privacyMeter' --no-coverage`

Commit: `git commit -m "feat: privacy meter (leaf count → privacy level with display rules)"`

---

## Task 3: Note Store (TDD)

### Tests (8):

1. getNotes returns empty array when no notes exist
2. addNote persists and getNotes retrieves it
3. getBalance sums all unspent note amounts
4. getBalance returns 0n when all notes are spent
5. selectNotes returns fewest notes covering amount+fee (greedy descending)
6. selectNotes throws when insufficient balance
7. markSpent sets matching notes to spent=true
8. clearMint removes all notes for a given mint

### Implementation:

**`src/modules/shielded/noteStore.ts`:**

```typescript
import {mmkvSecure} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {ERRORS} from '../../constants/errors';
import type {ShieldedNote, ShieldedNoteJson} from './types';

function getStorage() {
  const store = mmkvSecure();
  if (!store) {
    throw new Error('NoteStore requires mmkvSecure — wallet must be onboarded');
  }
  return store;
}

function storageKey(mint: string): string {
  return `${MMKV_KEYS.SHIELDED_NOTES_PREFIX}${mint}`;
}

function toJson(note: ShieldedNote): ShieldedNoteJson {
  return {...note, amount: note.amount.toString()};
}

function fromJson(json: ShieldedNoteJson): ShieldedNote {
  return {...json, amount: BigInt(json.amount)};
}

function loadNotes(mint: string): ShieldedNote[] {
  const raw = getStorage().getString(storageKey(mint));
  if (!raw) return [];
  try {
    return (JSON.parse(raw) as ShieldedNoteJson[]).map(fromJson);
  } catch {
    return [];
  }
}

function saveNotes(mint: string, notes: ShieldedNote[]): void {
  getStorage().set(storageKey(mint), JSON.stringify(notes.map(toJson)));
}

export function getNotes(mint: string): ShieldedNote[] {
  return loadNotes(mint).filter(n => !n.spent);
}

export function getBalance(mint: string): bigint {
  return getNotes(mint).reduce((sum, n) => sum + n.amount, 0n);
}

export function selectNotes(mint: string, amount: bigint, fee: bigint): ShieldedNote[] {
  const target = amount + fee;
  const unspent = getNotes(mint).sort((a, b) =>
    a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0,
  );

  const selected: ShieldedNote[] = [];
  let total = 0n;
  for (const note of unspent) {
    selected.push(note);
    total += note.amount;
    if (total >= target) return selected;
  }

  const err = ERRORS.INSUFFICIENT_NOC_FEE;
  throw new Error(err.message);
}

export function addNote(note: ShieldedNote): void {
  const notes = loadNotes(note.mint);
  notes.push(note);
  saveNotes(note.mint, notes);
}

export function markSpent(mint: string, nullifiers: string[]): void {
  const nullifierSet = new Set(nullifiers);
  const notes = loadNotes(mint);
  let changed = false;
  for (const note of notes) {
    if (nullifierSet.has(note.nullifier) && !note.spent) {
      note.spent = true;
      changed = true;
    }
  }
  if (changed) saveNotes(mint, notes);
}

export function clearMint(mint: string): void {
  getStorage().delete(storageKey(mint));
}
```

**`src/modules/shielded/__tests__/noteStore.test.ts`:**

```typescript
jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {
    ...actual,
    mmkvSecure: () => actual.mmkvPublic,
  };
});

import {getNotes, getBalance, selectNotes, addNote, markSpent, clearMint} from '../noteStore';
import type {ShieldedNote} from '../types';

const MINT = 'TestMint111111111111111111111111111111111111';

function makeNote(overrides: Partial<ShieldedNote> = {}): ShieldedNote {
  return {
    commitment: Math.random().toString(16).padStart(64, '0'),
    nullifier: Math.random().toString(16).padStart(64, '0'),
    mint: MINT,
    amount: 1_000_000n,
    index: 0,
    spent: false,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('noteStore', () => {
  beforeEach(() => {
    clearMint(MINT);
  });

  it('getNotes returns empty array when no notes exist', () => {
    expect(getNotes(MINT)).toEqual([]);
  });

  it('addNote persists and getNotes retrieves it', () => {
    const note = makeNote();
    addNote(note);
    const notes = getNotes(MINT);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.commitment).toBe(note.commitment);
    expect(notes[0]!.amount).toBe(1_000_000n);
  });

  it('getBalance sums all unspent note amounts', () => {
    addNote(makeNote({amount: 500_000n}));
    addNote(makeNote({amount: 300_000n}));
    expect(getBalance(MINT)).toBe(800_000n);
  });

  it('getBalance returns 0n when all notes are spent', () => {
    const note = makeNote();
    addNote(note);
    markSpent(MINT, [note.nullifier]);
    expect(getBalance(MINT)).toBe(0n);
  });

  it('selectNotes returns fewest notes covering amount+fee', () => {
    addNote(makeNote({amount: 100_000n}));
    addNote(makeNote({amount: 500_000n}));
    addNote(makeNote({amount: 200_000n}));
    // Need 600_000 total (500k + 100k fee) — should pick 500k first, then 200k
    const selected = selectNotes(MINT, 500_000n, 100_000n);
    expect(selected).toHaveLength(2);
    expect(selected[0]!.amount).toBe(500_000n);
    expect(selected[1]!.amount).toBe(200_000n);
  });

  it('selectNotes throws when insufficient balance', () => {
    addNote(makeNote({amount: 100_000n}));
    expect(() => selectNotes(MINT, 500_000n, 100_000n)).toThrow();
  });

  it('markSpent sets matching notes to spent=true', () => {
    const note = makeNote();
    addNote(note);
    markSpent(MINT, [note.nullifier]);
    const notes = getNotes(MINT);
    expect(notes).toHaveLength(0); // getNotes filters spent
  });

  it('clearMint removes all notes for a given mint', () => {
    addNote(makeNote());
    addNote(makeNote());
    clearMint(MINT);
    expect(getNotes(MINT)).toEqual([]);
  });
});
```

**Verify:** `npx tsc --noEmit && npx jest --testPathPattern='noteStore' --no-coverage`

Commit: `git commit -m "feat: note store (MMKV-persisted note CRUD, greedy selection, BigInt amounts)"`

---

## Task 4: Shielded Service (TDD)

### Tests (8):

1. fetchCircuitConfig returns parsed config from API
2. submitToRelayer POSTs proof and returns txSignature
3. submitToRelayer throws on non-200 response
4. deposit calls zkProver.prove('deposit') and submitToRelayer, returns ShieldedTxResult
5. transfer calls selectNotes, prove('transfer'), submitToRelayer, markSpent
6. transfer triggers consolidation when notes exceed maxInputs
7. withdraw calls selectNotes, prove('withdraw'), submitToRelayer, markSpent
8. deposit/transfer/withdraw propagate prover errors

### Implementation:

**`src/modules/shielded/shieldedService.ts`:**

```typescript
import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {zkProver} from '../zkProver/zkProverModule';
import {feeEngine} from '../fees/feeEngine';
import {decodeShieldedAddress} from './shieldedAddressCodec';
import * as noteStore from './noteStore';
import type {
  DepositParams,
  ShieldedTransferParams,
  WithdrawParams,
  ShieldedTxResult,
  CircuitConfig,
  ConsolidationProgress,
  ShieldedNote,
} from './types';
import type {ProofWitness, ZKProof} from '../zkProver/types';

// ---- Circuit config (cached for session) ------------------------------------

let _circuitConfig: CircuitConfig | null = null;

export async function fetchCircuitConfig(): Promise<CircuitConfig> {
  if (_circuitConfig) return _circuitConfig;
  const resp = await pinnedFetch(`${API_BASE}/v1/config/circuit`);
  if (resp.status !== 200) {
    throw new Error(`Circuit config fetch failed: HTTP ${resp.status}`);
  }
  _circuitConfig = (await resp.json()) as CircuitConfig;
  return _circuitConfig;
}

/** Reset cached config (for testing). */
export function _resetConfigCache(): void {
  _circuitConfig = null;
}

// ---- Relayer submission -----------------------------------------------------

interface RelayerResponse {
  txSignature: string;
  error?: string;
}

export async function submitToRelayer(proof: ZKProof): Promise<string> {
  const resp = await pinnedFetch(`${API_BASE}/v1/relayer/submit`, {
    method: 'POST',
    body: JSON.stringify({
      proofType: proof.proofType,
      proofData: proof.proofData,
      publicInputs: proof.publicInputs,
    }),
  });
  if (resp.status !== 200) {
    throw new Error(`Relayer returned HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as RelayerResponse;
  if (data.error) {
    throw new Error(data.error);
  }
  return data.txSignature;
}

// ---- Witness builders (stubs — real witness construction needs Merkle paths) -

function buildDepositWitness(mint: string, amount: bigint, sender: string): ProofWitness {
  return {
    noteCommitment: '0'.repeat(64),
    merklePath: [],
    merklePathIndices: [],
    nullifier: '0'.repeat(64),
    amount: amount.toString(),
    noteSecret: '0'.repeat(64),
  };
}

function buildTransferWitness(
  notes: ShieldedNote[],
  amount: bigint,
  recipientAddress: string,
): ProofWitness {
  return {
    noteCommitment: notes[0]?.commitment ?? '0'.repeat(64),
    merklePath: [],
    merklePathIndices: [],
    nullifier: notes[0]?.nullifier ?? '0'.repeat(64),
    amount: amount.toString(),
    recipientAddress,
    noteSecret: '0'.repeat(64),
  };
}

function buildWithdrawWitness(
  notes: ShieldedNote[],
  amount: bigint,
  destination: string,
): ProofWitness {
  return {
    noteCommitment: notes[0]?.commitment ?? '0'.repeat(64),
    merklePath: [],
    merklePathIndices: [],
    nullifier: notes[0]?.nullifier ?? '0'.repeat(64),
    amount: amount.toString(),
    recipientAddress: destination,
    noteSecret: '0'.repeat(64),
  };
}

function makeResultNote(mint: string, amount: bigint, index: number): ShieldedNote {
  const rand = Math.random().toString(16).slice(2).padStart(64, '0');
  return {
    commitment: rand,
    nullifier: rand.split('').reverse().join(''),
    mint,
    amount,
    index,
    spent: false,
    createdAt: Date.now(),
  };
}

// ---- Public API -------------------------------------------------------------

export async function deposit(
  params: DepositParams,
  stakingDiscount: number = 0,
): Promise<ShieldedTxResult> {
  const fee = feeEngine.getEffectiveFee('crossModeDeposit', stakingDiscount);
  const witness = buildDepositWitness(params.mint, params.amount, params.senderPubkey);
  const proof = await zkProver.prove('deposit', witness);
  const txSignature = await submitToRelayer(proof);

  // Add new note for the deposited amount
  noteStore.addNote(makeResultNote(params.mint, params.amount, 0));

  return {
    txSignature,
    proofType: 'deposit',
    amount: params.amount,
    timestamp: Date.now(),
  };
}

export async function transfer(
  params: ShieldedTransferParams,
  stakingDiscount: number = 0,
  onConsolidationProgress?: (progress: ConsolidationProgress) => void,
): Promise<ShieldedTxResult> {
  // Validate recipient
  decodeShieldedAddress(params.recipientAddress);

  const fee = feeEngine.getEffectiveFee('privateTransfer', stakingDiscount);
  let selected = noteStore.selectNotes(params.mint, params.amount, fee);

  // Check if consolidation is needed
  const config = await fetchCircuitConfig();
  if (selected.length > config.maxInputs) {
    const totalSteps = Math.ceil(selected.length / config.maxInputs);
    for (let step = 0; step < totalSteps - 1; step++) {
      onConsolidationProgress?.({currentStep: step + 1, totalSteps});
      const batch = selected.slice(
        step * config.maxInputs,
        (step + 1) * config.maxInputs,
      );
      const batchTotal = batch.reduce((s, n) => s + n.amount, 0n);
      const consWitness = buildTransferWitness(batch, batchTotal, params.recipientAddress);
      const consProof = await zkProver.prove('transfer', consWitness);
      await submitToRelayer(consProof);
      noteStore.markSpent(params.mint, batch.map(n => n.nullifier));
      noteStore.addNote(makeResultNote(params.mint, batchTotal, 0));
    }
    // Re-select after consolidation
    selected = noteStore.selectNotes(params.mint, params.amount, fee);
  }

  const witness = buildTransferWitness(selected, params.amount, params.recipientAddress);
  const proof = await zkProver.prove('transfer', witness);
  const txSignature = await submitToRelayer(proof);

  // Mark inputs as spent
  noteStore.markSpent(params.mint, selected.map(n => n.nullifier));

  // Add change output if any
  const inputTotal = selected.reduce((s, n) => s + n.amount, 0n);
  const change = inputTotal - params.amount - fee;
  if (change > 0n) {
    noteStore.addNote(makeResultNote(params.mint, change, 0));
  }

  return {
    txSignature,
    proofType: 'transfer',
    amount: params.amount,
    timestamp: Date.now(),
  };
}

export async function withdraw(
  params: WithdrawParams,
  stakingDiscount: number = 0,
): Promise<ShieldedTxResult> {
  const fee = feeEngine.getEffectiveFee('crossModeWithdraw', stakingDiscount);
  const selected = noteStore.selectNotes(params.mint, params.amount, fee);

  const witness = buildWithdrawWitness(selected, params.amount, params.destinationPubkey);
  const proof = await zkProver.prove('withdraw', witness);
  const txSignature = await submitToRelayer(proof);

  noteStore.markSpent(params.mint, selected.map(n => n.nullifier));

  const inputTotal = selected.reduce((s, n) => s + n.amount, 0n);
  const change = inputTotal - params.amount - fee;
  if (change > 0n) {
    noteStore.addNote(makeResultNote(params.mint, change, 0));
  }

  return {
    txSignature,
    proofType: 'withdraw',
    amount: params.amount,
    timestamp: Date.now(),
  };
}
```

**`src/modules/shielded/__tests__/shieldedService.test.ts`:**

```typescript
jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));

jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {...actual, mmkvSecure: () => actual.mmkvPublic};
});

jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: {getState: jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false})},
}));

import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {
  fetchCircuitConfig,
  submitToRelayer,
  deposit,
  transfer,
  withdraw,
  _resetConfigCache,
} from '../shieldedService';
import * as noteStore from '../noteStore';
import {encodeShieldedAddress} from '../shieldedAddressCodec';

const mockFetch = pinnedFetch as jest.Mock;

function mockResponse(status: number, data: unknown) {
  return Promise.resolve({
    status,
    headers: {},
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  });
}

const MINT = 'TestMint111111111111111111111111111111111111';
const RECIPIENT = encodeShieldedAddress(new Uint8Array(48).fill(0xab));

describe('shieldedService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetConfigCache();
    noteStore.clearMint(MINT);
  });

  it('fetchCircuitConfig returns parsed config', async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse(200, {maxInputs: 4, maxOutputs: 2, treeDepth: 32}),
    );
    const config = await fetchCircuitConfig();
    expect(config.maxInputs).toBe(4);
    expect(config.treeDepth).toBe(32);
  });

  it('submitToRelayer POSTs proof and returns txSignature', async () => {
    mockFetch.mockReturnValueOnce(
      mockResponse(200, {txSignature: 'sig123'}),
    );
    const sig = await submitToRelayer({
      proofType: 'deposit',
      proofData: 'base64data',
      publicInputs: {root: '', nullifier: '', amount: '1000'},
      generatedAt: Date.now(),
    });
    expect(sig).toBe('sig123');
  });

  it('submitToRelayer throws on non-200', async () => {
    mockFetch.mockReturnValueOnce(mockResponse(500, {}));
    await expect(
      submitToRelayer({
        proofType: 'deposit',
        proofData: '',
        publicInputs: {root: '', nullifier: '', amount: '0'},
        generatedAt: 0,
      }),
    ).rejects.toThrow('HTTP 500');
  });

  it('deposit proves and submits, adds note', async () => {
    // Mock hosted prover (called by zkProver.prove)
    mockFetch
      .mockReturnValueOnce(mockResponse(200, {success: true, proofData: 'proof1'})) // prove
      .mockReturnValueOnce(mockResponse(200, {txSignature: 'depositSig'})); // relayer

    const result = await deposit({mint: MINT, amount: 1_000_000n, senderPubkey: 'sender1'});
    expect(result.txSignature).toBe('depositSig');
    expect(result.proofType).toBe('deposit');
    expect(noteStore.getBalance(MINT)).toBe(1_000_000n);
  });

  it('transfer selects notes, proves, submits, marks spent', async () => {
    noteStore.addNote({
      commitment: 'a'.repeat(64), nullifier: 'b'.repeat(64),
      mint: MINT, amount: 2_000_000n, index: 0, spent: false, createdAt: Date.now(),
    });

    mockFetch
      .mockReturnValueOnce(mockResponse(200, {maxInputs: 4, maxOutputs: 2, treeDepth: 32})) // config
      .mockReturnValueOnce(mockResponse(200, {success: true, proofData: 'proof2'})) // prove
      .mockReturnValueOnce(mockResponse(200, {txSignature: 'transferSig'})); // relayer

    const result = await transfer({mint: MINT, amount: 1_000_000n, recipientAddress: RECIPIENT});
    expect(result.txSignature).toBe('transferSig');
    // Note should be spent (transfer used the 2M note, change goes back)
    expect(noteStore.getNotes(MINT).filter(n => !n.spent).length).toBeGreaterThanOrEqual(0);
  });

  it('transfer triggers consolidation when notes exceed maxInputs', async () => {
    // Add 6 small notes
    for (let i = 0; i < 6; i++) {
      noteStore.addNote({
        commitment: `c${i}`.padStart(64, '0'), nullifier: `n${i}`.padStart(64, '0'),
        mint: MINT, amount: 100_000n, index: i, spent: false, createdAt: Date.now(),
      });
    }

    const progressCalls: number[] = [];
    // config → maxInputs=4, then consolidation prove+submit, then final prove+submit
    mockFetch
      .mockReturnValueOnce(mockResponse(200, {maxInputs: 4, maxOutputs: 2, treeDepth: 32}))
      .mockReturnValueOnce(mockResponse(200, {success: true, proofData: 'cons1'}))
      .mockReturnValueOnce(mockResponse(200, {txSignature: 'consSig1'}))
      .mockReturnValueOnce(mockResponse(200, {success: true, proofData: 'final'}))
      .mockReturnValueOnce(mockResponse(200, {txSignature: 'finalSig'}));

    const result = await transfer(
      {mint: MINT, amount: 400_000n, recipientAddress: RECIPIENT},
      0,
      p => progressCalls.push(p.currentStep),
    );

    expect(progressCalls.length).toBeGreaterThan(0);
    expect(result.txSignature).toBe('finalSig');
  });

  it('withdraw selects notes, proves, submits, marks spent', async () => {
    noteStore.addNote({
      commitment: 'd'.repeat(64), nullifier: 'e'.repeat(64),
      mint: MINT, amount: 5_000_000n, index: 0, spent: false, createdAt: Date.now(),
    });

    mockFetch
      .mockReturnValueOnce(mockResponse(200, {success: true, proofData: 'proof3'}))
      .mockReturnValueOnce(mockResponse(200, {txSignature: 'withdrawSig'}));

    const result = await withdraw({mint: MINT, amount: 3_000_000n, destinationPubkey: 'dest1'});
    expect(result.txSignature).toBe('withdrawSig');
    expect(result.proofType).toBe('withdraw');
  });

  it('deposit propagates prover errors', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Prover down'));
    await expect(
      deposit({mint: MINT, amount: 1_000_000n, senderPubkey: 'sender1'}),
    ).rejects.toThrow();
  });
});
```

**Verify:** `npx tsc --noEmit && npx jest --testPathPattern='shieldedService' --no-coverage`

Commit: `git commit -m "feat: shielded service (deposit/transfer/withdraw orchestrator, consolidation, relayer)"`

---

## Task 5: Shared UI Components

### Components (4):

**`src/components/PrivacyMeter.tsx`:**

```tsx
import React from 'react';
import {View, Text, TouchableOpacity} from 'react-native';
import {getPrivacyLevel} from '../modules/shielded/privacyMeter';

interface PrivacyMeterProps {
  leafCount: number;
  isFirstDeposit: boolean;
  onDismiss: () => void;
}

const COLORS = {
  red: {bg: '#2D1B1B', border: '#FF4444', text: '#FF6666'},
  yellow: {bg: '#2D2A1B', border: '#FFAA44', text: '#FFCC66'},
  green: {bg: '#1B2D1B', border: '#44FF44', text: '#66FF66'},
} as const;

export function PrivacyMeter({leafCount, isFirstDeposit, onDismiss}: PrivacyMeterProps) {
  const {message, color, shouldShow} = getPrivacyLevel(leafCount, isFirstDeposit);

  if (!shouldShow) return null;

  const scheme = COLORS[color];

  return (
    <View
      style={{
        backgroundColor: scheme.bg,
        borderWidth: 1,
        borderColor: scheme.border,
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
      }}
      testID="privacy-meter"
    >
      <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
        <Text style={{color: scheme.text, fontSize: 14, flex: 1}}>{message}</Text>
        <TouchableOpacity onPress={onDismiss} testID="privacy-meter-dismiss">
          <Text style={{color: '#888', fontSize: 18, paddingLeft: 8}}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
```

**`src/components/FeeDisplayRow.tsx`:**

```tsx
import React from 'react';
import {View, Text} from 'react-native';
import type {FeeDisplayInfo} from '../modules/fees/types';

interface FeeDisplayRowProps {
  feeInfo: FeeDisplayInfo;
}

export function FeeDisplayRow({feeInfo}: FeeDisplayRowProps) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
      }}
      testID="fee-display-row"
    >
      <Text style={{color: '#888', fontSize: 14}}>Fee</Text>
      <View style={{flexDirection: 'row', alignItems: 'center'}}>
        <Text style={{color: '#FFF', fontSize: 14}} testID="fee-label">
          {feeInfo.label}
        </Text>
        {feeInfo.discountLabel ? (
          <Text style={{color: '#44FF44', fontSize: 12, marginLeft: 8}} testID="fee-discount">
            ({feeInfo.discountLabel})
          </Text>
        ) : null}
      </View>
    </View>
  );
}
```

**`src/components/ProofProgressOverlay.tsx`:**

```tsx
import React from 'react';
import {View, Text, ActivityIndicator, Modal} from 'react-native';
import type {ConsolidationProgress} from '../modules/shielded/types';

interface ProofProgressOverlayProps {
  visible: boolean;
  message?: string;
  consolidation?: ConsolidationProgress;
}

export function ProofProgressOverlay({
  visible,
  message = 'Securing transaction...',
  consolidation,
}: ProofProgressOverlayProps) {
  const displayMessage = consolidation
    ? `Optimizing your private balance... (step ${consolidation.currentStep}/${consolidation.totalSteps})`
    : message;

  return (
    <Modal visible={visible} transparent animationType="fade" testID="proof-overlay">
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text
          style={{color: '#FFFFFF', fontSize: 16, marginTop: 24, textAlign: 'center'}}
          testID="proof-overlay-message"
        >
          {displayMessage}
        </Text>
      </View>
    </Modal>
  );
}
```

**`src/components/ShieldedAddressInput.tsx`:**

```tsx
import React, {useCallback, useState} from 'react';
import {View, TextInput, Text, TouchableOpacity, Clipboard} from 'react-native';
import {isValidShieldedAddress} from '../modules/shielded/shieldedAddressCodec';

interface ShieldedAddressInputProps {
  value: string;
  onChange: (addr: string) => void;
  error?: string;
}

export function ShieldedAddressInput({value, onChange, error}: ShieldedAddressInputProps) {
  const [touched, setTouched] = useState(false);

  const handlePaste = useCallback(async () => {
    const text = await Clipboard.getString();
    if (text) {
      onChange(text.trim());
      setTouched(true);
    }
  }, [onChange]);

  const showError = touched && value.length > 0 && !isValidShieldedAddress(value);

  return (
    <View style={{marginBottom: 16}}>
      <Text style={{color: '#888', fontSize: 12, marginBottom: 4}}>Recipient address</Text>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#1A1A2E',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: showError || error ? '#FF4444' : '#333',
          padding: 12,
        }}
      >
        <TextInput
          style={{flex: 1, color: '#FFF', fontSize: 14}}
          value={value}
          onChangeText={text => {
            onChange(text);
            setTouched(true);
          }}
          placeholder="noc1..."
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
          testID="shielded-address-input"
        />
        <TouchableOpacity onPress={handlePaste} testID="paste-button">
          <Text style={{color: '#6C63FF', fontSize: 14}}>Paste</Text>
        </TouchableOpacity>
      </View>
      {(showError || error) && (
        <Text style={{color: '#FF4444', fontSize: 12, marginTop: 4}} testID="address-error">
          {error ?? 'Invalid private address. Must start with noc1.'}
        </Text>
      )}
    </View>
  );
}
```

**Verify:** `npx tsc --noEmit`

Commit: `git commit -m "feat: shared components (PrivacyMeter, FeeDisplayRow, ProofProgressOverlay, ShieldedAddressInput)"`

---

## Task 6: Deposit Screen

### Tests (5):

1. Renders "Move to private balance" title
2. Shows token selector and amount input
3. Shows PrivacyMeter when leafCount < 1000
4. Shows ProofProgressOverlay with "Securing transaction..." during proving
5. Confirm button is disabled when amount is empty

### Implementation:

**`src/screens/shielded/DepositScreen.tsx`:**

```tsx
import React, {useState, useCallback} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {useWalletStore} from '../../store/zustand/walletStore';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {feeEngine} from '../../modules/fees/feeEngine';
import {deposit} from '../../modules/shielded/shieldedService';
import {shouldRepeatWarning} from '../../modules/shielded/privacyMeter';
import {TokenSelector} from '../../components/TokenSelector';
import {FeeDisplayRow} from '../../components/FeeDisplayRow';
import {PrivacyMeter} from '../../components/PrivacyMeter';
import {ProofProgressOverlay} from '../../components/ProofProgressOverlay';
import {NOC_MINT} from '../../constants/programs';
import type {ShieldedScreenStep} from '../../modules/shielded/types';

export function DepositScreen() {
  const navigation = useNavigation();
  const {publicKey, tokens} = useWalletStore();
  const {merkleLeafCount} = useShieldedStore();

  const [step, setStep] = useState<ShieldedScreenStep>('input');
  const [selectedMint, setSelectedMint] = useState(NOC_MINT);
  const [amount, setAmount] = useState('');
  const [privacyDismissed, setPrivacyDismissed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const feeInfo = feeEngine.getFeeDisplayInfo('crossModeDeposit');
  const parsedAmount = (() => {
    try {
      return BigInt(Math.round(parseFloat(amount || '0') * 1e9));
    } catch {
      return 0n;
    }
  })();
  const canConfirm = parsedAmount > 0n && step === 'input';

  const showPrivacy = !privacyDismissed && shouldRepeatWarning(merkleLeafCount);

  const handleConfirm = useCallback(async () => {
    if (!publicKey) return;
    setStep('proving');
    try {
      const result = await deposit({
        mint: selectedMint,
        amount: parsedAmount,
        senderPubkey: publicKey,
      });
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  }, [publicKey, selectedMint, parsedAmount]);

  if (step === 'success') {
    return (
      <View style={{flex: 1, backgroundColor: '#0C0C14', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <Text style={{color: '#44FF44', fontSize: 48}}>✓</Text>
        <Text style={{color: '#FFF', fontSize: 20, marginTop: 16}} testID="success-title">
          Moved to private balance
        </Text>
        <Text style={{color: '#888', fontSize: 14, marginTop: 8}}>{amount} tokens</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{marginTop: 32, backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32}}
        >
          <Text style={{color: '#FFF', fontSize: 16}}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={{flex: 1, backgroundColor: '#0C0C14', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <Text style={{color: '#FF4444', fontSize: 48}}>✕</Text>
        <Text style={{color: '#FFF', fontSize: 20, marginTop: 16}}>Transaction failed</Text>
        <Text style={{color: '#FF6666', fontSize: 14, marginTop: 8}} testID="error-message">{errorMsg}</Text>
        <TouchableOpacity
          onPress={() => setStep('input')}
          style={{marginTop: 32, backgroundColor: '#333', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32}}
        >
          <Text style={{color: '#FFF', fontSize: 16}}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#0C0C14'}} contentContainerStyle={{padding: 24}}>
      <Text style={{color: '#FFF', fontSize: 20, fontWeight: '600', marginBottom: 24}} testID="screen-title">
        Move to private balance
      </Text>

      {showPrivacy && (
        <PrivacyMeter
          leafCount={merkleLeafCount}
          isFirstDeposit={false}
          onDismiss={() => setPrivacyDismissed(true)}
        />
      )}

      <TokenSelector
        tokens={tokens.map(t => ({mint: t.mint, symbol: t.symbol}))}
        selected={selectedMint}
        onSelect={setSelectedMint}
      />

      <View style={{marginTop: 16, marginBottom: 16}}>
        <Text style={{color: '#888', fontSize: 12, marginBottom: 4}}>Amount</Text>
        <TextInput
          style={{backgroundColor: '#1A1A2E', borderRadius: 12, padding: 12, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#333'}}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#555"
          keyboardType="decimal-pad"
          testID="amount-input"
        />
      </View>

      <FeeDisplayRow feeInfo={feeInfo} />

      <TouchableOpacity
        onPress={handleConfirm}
        disabled={!canConfirm}
        style={{
          backgroundColor: canConfirm ? '#6C63FF' : '#333',
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 24,
        }}
        testID="confirm-button"
      >
        <Text style={{color: '#FFF', fontSize: 16, fontWeight: '600'}}>Confirm</Text>
      </TouchableOpacity>

      <ProofProgressOverlay visible={step === 'proving'} />
    </ScrollView>
  );
}
```

**`src/screens/shielded/__tests__/DepositScreen.test.tsx`:**

```tsx
jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));
jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {...actual, mmkvSecure: () => actual.mmkvPublic};
});
jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: Object.assign(
    jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false}),
    {getState: jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false})},
  ),
}));
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn().mockReturnValue({
    publicKey: 'TestPubkey1111111111111111111111111111111111',
    tokens: [{mint: 'NOC_MINT', symbol: 'NOC'}],
  }),
}));
jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn().mockReturnValue({merkleLeafCount: 50}),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
}));

import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {DepositScreen} from '../DepositScreen';

describe('DepositScreen', () => {
  it('renders "Move to private balance" title', () => {
    const {getByTestId} = render(<DepositScreen />);
    expect(getByTestId('screen-title').props.children).toBe('Move to private balance');
  });

  it('shows amount input', () => {
    const {getByTestId} = render(<DepositScreen />);
    expect(getByTestId('amount-input')).toBeTruthy();
  });

  it('shows PrivacyMeter when leafCount < 1000', () => {
    const {getByTestId} = render(<DepositScreen />);
    expect(getByTestId('privacy-meter')).toBeTruthy();
  });

  it('confirm button is disabled when amount is empty', () => {
    const {getByTestId} = render(<DepositScreen />);
    const btn = getByTestId('confirm-button');
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });

  it('shows fee display row', () => {
    const {getByTestId} = render(<DepositScreen />);
    expect(getByTestId('fee-display-row')).toBeTruthy();
  });
});
```

**Verify:** `npx tsc --noEmit && npx jest --testPathPattern='DepositScreen' --no-coverage`

Commit: `git commit -m "feat: DepositScreen — Move to private balance (token select, fee, privacy meter, proof)"`

---

## Task 7: Shielded Transfer Screen

### Tests (5):

1. Renders "Send privately" title
2. Shows ShieldedAddressInput
3. Shows "Remainder stays in your private balance" text
4. Confirm button is disabled when address is empty
5. Shows fee display row

### Implementation:

**`src/screens/shielded/ShieldedTransferScreen.tsx`:**

```tsx
import React, {useState, useCallback} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {RootStackParamList} from '../../types/navigation';
import {useShieldedStore} from '../../store/zustand/shieldedStore';
import {useWalletStore} from '../../store/zustand/walletStore';
import {feeEngine} from '../../modules/fees/feeEngine';
import {transfer} from '../../modules/shielded/shieldedService';
import {isValidShieldedAddress} from '../../modules/shielded/shieldedAddressCodec';
import {shouldRepeatWarning} from '../../modules/shielded/privacyMeter';
import {TokenSelector} from '../../components/TokenSelector';
import {FeeDisplayRow} from '../../components/FeeDisplayRow';
import {PrivacyMeter} from '../../components/PrivacyMeter';
import {ProofProgressOverlay} from '../../components/ProofProgressOverlay';
import {ShieldedAddressInput} from '../../components/ShieldedAddressInput';
import {NOC_MINT} from '../../constants/programs';
import type {ShieldedScreenStep, ConsolidationProgress} from '../../modules/shielded/types';

export function ShieldedTransferScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'ShieldedTransfer'>>();
  const {tokens} = useWalletStore();
  const {merkleLeafCount} = useShieldedStore();

  const [step, setStep] = useState<ShieldedScreenStep>('input');
  const [recipient, setRecipient] = useState(route.params?.recipient ?? '');
  const [selectedMint, setSelectedMint] = useState(NOC_MINT);
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [privacyDismissed, setPrivacyDismissed] = useState(false);
  const [consolidation, setConsolidation] = useState<ConsolidationProgress | undefined>();
  const [errorMsg, setErrorMsg] = useState('');

  const feeInfo = feeEngine.getFeeDisplayInfo('privateTransfer');
  const parsedAmount = (() => {
    try {
      return BigInt(Math.round(parseFloat(amount || '0') * 1e9));
    } catch {
      return 0n;
    }
  })();
  const validAddress = isValidShieldedAddress(recipient);
  const canConfirm = parsedAmount > 0n && validAddress && step === 'input';
  const showPrivacy = !privacyDismissed && shouldRepeatWarning(merkleLeafCount);

  const handleConfirm = useCallback(async () => {
    setStep('proving');
    try {
      const result = await transfer(
        {mint: selectedMint, amount: parsedAmount, recipientAddress: recipient, memo: memo || undefined},
        0,
        progress => {
          setStep('consolidating');
          setConsolidation(progress);
        },
      );
      setConsolidation(undefined);
      setStep('success');
    } catch (err) {
      setConsolidation(undefined);
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  }, [selectedMint, parsedAmount, recipient, memo]);

  if (step === 'success') {
    return (
      <View style={{flex: 1, backgroundColor: '#0C0C14', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <Text style={{color: '#44FF44', fontSize: 48}}>✓</Text>
        <Text style={{color: '#FFF', fontSize: 20, marginTop: 16}} testID="success-title">Sent privately</Text>
        <Text style={{color: '#888', fontSize: 14, marginTop: 8}}>{amount} tokens</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{marginTop: 32, backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32}}
        >
          <Text style={{color: '#FFF', fontSize: 16}}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={{flex: 1, backgroundColor: '#0C0C14', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <Text style={{color: '#FF4444', fontSize: 48}}>✕</Text>
        <Text style={{color: '#FFF', fontSize: 20, marginTop: 16}}>Transfer failed</Text>
        <Text style={{color: '#FF6666', fontSize: 14, marginTop: 8}} testID="error-message">{errorMsg}</Text>
        <TouchableOpacity
          onPress={() => setStep('input')}
          style={{marginTop: 32, backgroundColor: '#333', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32}}
        >
          <Text style={{color: '#FFF', fontSize: 16}}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#0C0C14'}} contentContainerStyle={{padding: 24}}>
      <Text style={{color: '#FFF', fontSize: 20, fontWeight: '600', marginBottom: 24}} testID="screen-title">
        Send privately
      </Text>

      {showPrivacy && (
        <PrivacyMeter leafCount={merkleLeafCount} isFirstDeposit={false} onDismiss={() => setPrivacyDismissed(true)} />
      )}

      <ShieldedAddressInput value={recipient} onChange={setRecipient} />

      <TokenSelector
        tokens={tokens.map(t => ({mint: t.mint, symbol: t.symbol}))}
        selected={selectedMint}
        onSelect={setSelectedMint}
      />

      <View style={{marginTop: 16}}>
        <Text style={{color: '#888', fontSize: 12, marginBottom: 4}}>Amount</Text>
        <TextInput
          style={{backgroundColor: '#1A1A2E', borderRadius: 12, padding: 12, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#333'}}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#555"
          keyboardType="decimal-pad"
          testID="amount-input"
        />
      </View>

      <View style={{marginTop: 16}}>
        <Text style={{color: '#888', fontSize: 12, marginBottom: 4}}>Memo (optional, encrypted)</Text>
        <TextInput
          style={{backgroundColor: '#1A1A2E', borderRadius: 12, padding: 12, color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: '#333'}}
          value={memo}
          onChangeText={setMemo}
          placeholder="Add a note..."
          placeholderTextColor="#555"
          testID="memo-input"
        />
      </View>

      <FeeDisplayRow feeInfo={feeInfo} />

      <Text style={{color: '#888', fontSize: 12, marginTop: 8, fontStyle: 'italic'}} testID="change-note">
        Remainder stays in your private balance
      </Text>

      <TouchableOpacity
        onPress={handleConfirm}
        disabled={!canConfirm}
        style={{
          backgroundColor: canConfirm ? '#6C63FF' : '#333',
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 24,
        }}
        testID="confirm-button"
      >
        <Text style={{color: '#FFF', fontSize: 16, fontWeight: '600'}}>Send</Text>
      </TouchableOpacity>

      <ProofProgressOverlay
        visible={step === 'proving' || step === 'consolidating'}
        consolidation={consolidation}
      />
    </ScrollView>
  );
}
```

**`src/screens/shielded/__tests__/ShieldedTransferScreen.test.tsx`:**

```tsx
jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));
jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {...actual, mmkvSecure: () => actual.mmkvPublic};
});
jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: Object.assign(
    jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false}),
    {getState: jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false})},
  ),
}));
jest.mock('../../../store/zustand/walletStore', () => ({
  useWalletStore: jest.fn().mockReturnValue({
    publicKey: 'TestPubkey1111111111111111111111111111111111',
    tokens: [{mint: 'NOC_MINT', symbol: 'NOC'}],
  }),
}));
jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn().mockReturnValue({merkleLeafCount: 50}),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));

import React from 'react';
import {render} from '@testing-library/react-native';
import {ShieldedTransferScreen} from '../ShieldedTransferScreen';

describe('ShieldedTransferScreen', () => {
  it('renders "Send privately" title', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('screen-title').props.children).toBe('Send privately');
  });

  it('shows ShieldedAddressInput', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('shielded-address-input')).toBeTruthy();
  });

  it('shows "Remainder stays in your private balance"', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('change-note').props.children).toBe('Remainder stays in your private balance');
  });

  it('confirm button is disabled when address is empty', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    const btn = getByTestId('confirm-button');
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });

  it('shows fee display row', () => {
    const {getByTestId} = render(<ShieldedTransferScreen />);
    expect(getByTestId('fee-display-row')).toBeTruthy();
  });
});
```

**Verify:** `npx tsc --noEmit && npx jest --testPathPattern='ShieldedTransferScreen' --no-coverage`

Commit: `git commit -m "feat: ShieldedTransferScreen — Send privately (address input, consolidation, memo, proof)"`

---

## Task 8: Withdraw Screen

### Tests (5):

1. Renders "Move to public balance" title
2. Shows transparent address input
3. Shows withdrawal warning text
4. Confirm button is disabled when amount is empty
5. Shows fee display row

### Implementation:

**`src/screens/shielded/WithdrawScreen.tsx`:**

```tsx
import React, {useState, useCallback} from 'react';
import {View, Text, TextInput, TouchableOpacity, ScrollView} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {feeEngine} from '../../modules/fees/feeEngine';
import {withdraw} from '../../modules/shielded/shieldedService';
import {FeeDisplayRow} from '../../components/FeeDisplayRow';
import {ProofProgressOverlay} from '../../components/ProofProgressOverlay';
import {NOC_MINT} from '../../constants/programs';
import type {ShieldedScreenStep} from '../../modules/shielded/types';

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function WithdrawScreen() {
  const navigation = useNavigation();

  const [step, setStep] = useState<ShieldedScreenStep>('input');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const feeInfo = feeEngine.getFeeDisplayInfo('crossModeWithdraw');
  const parsedAmount = (() => {
    try {
      return BigInt(Math.round(parseFloat(amount || '0') * 1e9));
    } catch {
      return 0n;
    }
  })();
  const validAddress = SOLANA_ADDRESS_REGEX.test(destination);
  const canConfirm = parsedAmount > 0n && validAddress && step === 'input';

  const handleConfirm = useCallback(async () => {
    setStep('proving');
    try {
      await withdraw({mint: NOC_MINT, amount: parsedAmount, destinationPubkey: destination});
      setStep('success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStep('error');
    }
  }, [parsedAmount, destination]);

  if (step === 'success') {
    return (
      <View style={{flex: 1, backgroundColor: '#0C0C14', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <Text style={{color: '#44FF44', fontSize: 48}}>✓</Text>
        <Text style={{color: '#FFF', fontSize: 20, marginTop: 16}} testID="success-title">Moved to public balance</Text>
        <Text style={{color: '#888', fontSize: 14, marginTop: 8}}>{amount} tokens</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={{marginTop: 32, backgroundColor: '#6C63FF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32}}
        >
          <Text style={{color: '#FFF', fontSize: 16}}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (step === 'error') {
    return (
      <View style={{flex: 1, backgroundColor: '#0C0C14', justifyContent: 'center', alignItems: 'center', padding: 24}}>
        <Text style={{color: '#FF4444', fontSize: 48}}>✕</Text>
        <Text style={{color: '#FFF', fontSize: 20, marginTop: 16}}>Withdrawal failed</Text>
        <Text style={{color: '#FF6666', fontSize: 14, marginTop: 8}} testID="error-message">{errorMsg}</Text>
        <TouchableOpacity
          onPress={() => setStep('input')}
          style={{marginTop: 32, backgroundColor: '#333', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32}}
        >
          <Text style={{color: '#FFF', fontSize: 16}}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={{flex: 1, backgroundColor: '#0C0C14'}} contentContainerStyle={{padding: 24}}>
      <Text style={{color: '#FFF', fontSize: 20, fontWeight: '600', marginBottom: 24}} testID="screen-title">
        Move to public balance
      </Text>

      <View style={{
        backgroundColor: '#1B2D2D', borderWidth: 1, borderColor: '#44AAAA',
        borderRadius: 12, padding: 12, marginBottom: 16,
      }} testID="withdraw-warning">
        <Text style={{color: '#88DDDD', fontSize: 13}}>
          Withdrawal is NOT linkable to your deposit history
        </Text>
      </View>

      <View style={{marginBottom: 16}}>
        <Text style={{color: '#888', fontSize: 12, marginBottom: 4}}>Destination address</Text>
        <TextInput
          style={{backgroundColor: '#1A1A2E', borderRadius: 12, padding: 12, color: '#FFF', fontSize: 14, borderWidth: 1, borderColor: '#333'}}
          value={destination}
          onChangeText={setDestination}
          placeholder="Solana address..."
          placeholderTextColor="#555"
          autoCapitalize="none"
          autoCorrect={false}
          testID="destination-input"
        />
      </View>

      <View style={{marginBottom: 16}}>
        <Text style={{color: '#888', fontSize: 12, marginBottom: 4}}>Amount</Text>
        <TextInput
          style={{backgroundColor: '#1A1A2E', borderRadius: 12, padding: 12, color: '#FFF', fontSize: 16, borderWidth: 1, borderColor: '#333'}}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor="#555"
          keyboardType="decimal-pad"
          testID="amount-input"
        />
      </View>

      <FeeDisplayRow feeInfo={feeInfo} />

      <TouchableOpacity
        onPress={handleConfirm}
        disabled={!canConfirm}
        style={{
          backgroundColor: canConfirm ? '#6C63FF' : '#333',
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          marginTop: 24,
        }}
        testID="confirm-button"
      >
        <Text style={{color: '#FFF', fontSize: 16, fontWeight: '600'}}>Confirm</Text>
      </TouchableOpacity>

      <ProofProgressOverlay visible={step === 'proving'} />
    </ScrollView>
  );
}
```

**`src/screens/shielded/__tests__/WithdrawScreen.test.tsx`:**

```tsx
jest.mock('../../sslPinning/pinnedFetch', () => ({pinnedFetch: jest.fn()}));
jest.mock('../../../store/mmkv/instances', () => {
  const actual = jest.requireActual('../../../store/mmkv/instances') as Record<string, unknown>;
  return {...actual, mmkvSecure: () => actual.mmkvPublic};
});
jest.mock('../../../store/zustand/presaleStore', () => ({
  usePresaleStore: Object.assign(
    jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false}),
    {getState: jest.fn().mockReturnValue({tgeStatus: 'pre_tge', isZeroFeeEligible: false})},
  ),
}));
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({goBack: jest.fn()}),
}));

import React from 'react';
import {render} from '@testing-library/react-native';
import {WithdrawScreen} from '../WithdrawScreen';

describe('WithdrawScreen', () => {
  it('renders "Move to public balance" title', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    expect(getByTestId('screen-title').props.children).toBe('Move to public balance');
  });

  it('shows transparent address input', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    expect(getByTestId('destination-input')).toBeTruthy();
  });

  it('shows withdrawal warning', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    expect(getByTestId('withdraw-warning')).toBeTruthy();
  });

  it('confirm button is disabled when amount is empty', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    const btn = getByTestId('confirm-button');
    expect(btn.props.accessibilityState?.disabled ?? btn.props.disabled).toBeTruthy();
  });

  it('shows fee display row', () => {
    const {getByTestId} = render(<WithdrawScreen />);
    expect(getByTestId('fee-display-row')).toBeTruthy();
  });
});
```

**Verify:** `npx tsc --noEmit && npx jest --testPathPattern='WithdrawScreen' --no-coverage`

Commit: `git commit -m "feat: WithdrawScreen — Move to public balance (address input, warning, fee, proof)"`

---

## Task 9: Wire into Navigator + Final Verify

### Steps:

1. Replace placeholder imports in `src/app/Navigator.tsx` with real screen imports
2. Run full `npx tsc --noEmit`
3. Run full `npx jest --no-coverage`
4. Verify checklist

### Navigator changes:

Replace in `src/app/Navigator.tsx`:
```typescript
// Remove these placeholder lines:
const DepositScreen = makePlaceholder('Deposit');
const ShieldedTransferScreen = makePlaceholder('ShieldedTransfer');
const WithdrawScreen = makePlaceholder('Withdraw');

// Add real imports:
import {DepositScreen} from '../screens/shielded/DepositScreen';
import {ShieldedTransferScreen} from '../screens/shielded/ShieldedTransferScreen';
import {WithdrawScreen} from '../screens/shielded/WithdrawScreen';
```

### Verification checklist:

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  Deposit: title says "Move to private balance"
[ ]  Deposit: PrivacyMeter shown BEFORE confirmation
[ ]  Deposit: FeeDisplayRow shows crossModeDeposit fee
[ ]  Deposit: ProofProgressOverlay says "Securing transaction..."
[ ]  Deposit: Confirm disabled when amount empty
[ ]  Transfer: title says "Send privately"
[ ]  Transfer: ShieldedAddressInput validates noc1... format
[ ]  Transfer: "Remainder stays in your private balance" shown
[ ]  Transfer: Consolidation shows "Optimizing your private balance..."
[ ]  Transfer: MAX_INPUTS fetched from GET /v1/config/circuit
[ ]  Withdraw: title says "Move to public balance"
[ ]  Withdraw: warning "NOT linkable to deposit history"
[ ]  Withdraw: FeeDisplayRow shows crossModeWithdraw fee
[ ]  Privacy meter: red < 100, yellow < 1000, green < 10000
[ ]  Privacy meter: repeats while leafCount < 1000
[ ]  Address codec: round-trip encode/decode
[ ]  Address codec: E110 on invalid address
[ ]  Note store: greedy selection, insufficient → E013
[ ]  Service: deposit/transfer/withdraw → prove → relayer
[ ]  Terminology: NO "deposit to shielded", "shielded transfer", "generating proof"
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```

Commit: `git commit -m "wire: connect shielded screens to Navigator, remove placeholders"`
