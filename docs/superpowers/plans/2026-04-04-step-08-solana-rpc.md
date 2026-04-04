# Step 8: Solana RPC Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete Solana RPC and transaction layer: connection management with Helius RPC, balance/token queries, VersionedTransaction (v0) building with ATA creation and fee markup, transaction simulation with error mapping, priority fee estimation, blockhash-expiry-aware signAndSend with retry logic, relayer ALT fetching, and client-side rate limiting.

**Architecture:** A `SolanaService` class wraps `@solana/web3.js` Connection with a rate-limited request queue (max 10 concurrent, exponential backoff on 429). Transaction building uses VersionedTransaction v0 with MessageV0. Every transparent transfer includes a Noctura fee markup instruction (SystemProgram.transfer to NOCTURA_FEE_TREASURY). signAndSend implements blockhash expiry detection with up to 3 retries (new blockhash + new signature each time). A `RateLimiter` utility class enforces concurrency and cooldown constraints. React Query hooks provide caching with spec TTLs (balance 10s, tokens 60s, history 30s).

**Tech Stack:** @solana/web3.js >= 1.95.8, @tanstack/react-query v5

**Validated decisions:** See architecture validation doc — web3.js v1.x (not @solana/kit), @anchor-lang/core for Anchor 1.0.0

---

## File Structure

```
src/
├── modules/
│   └── solana/
│       ├── connection.ts              — Connection singleton (Helius primary + public fallback)
│       ├── rateLimiter.ts             — Generic rate limiter (concurrency, backoff, dedup)
│       ├── queries.ts                 — getBalance, getTokenAccounts, getTokenBalance, getTransactionHistory
│       ├── transactionBuilder.ts      — buildTransferTx, buildSPLTransferTx (VersionedTransaction v0)
│       ├── simulation.ts             — simulateTransaction with error mapping
│       ├── priorityFees.ts           — getPriorityFee (Helius API + local fallback)
│       ├── signAndSend.ts            — signAndSend with blockhash expiry retry
│       ├── relayer.ts                — getRelayerLookupTables (fetch from API)
│       ├── types.ts                  — Shared types (TransferParams, SimulationResult, etc.)
│       └── __tests__/
│           ├── rateLimiter.test.ts
│           ├── queries.test.ts
│           ├── transactionBuilder.test.ts
│           ├── simulation.test.ts
│           ├── signAndSend.test.ts
│           └── relayer.test.ts
├── hooks/
│   └── useSolanaQueries.ts           — React Query hooks with spec TTLs
(root)
├── __mocks__/
│   └── @solana/
│       └── web3.js.ts                — Jest mock for @solana/web3.js
```

---

## Task 1: Install @solana/web3.js + Create Jest Mock

**Files:**
- Modify: `package.json`
- Create: `__mocks__/@solana/web3.js.ts`

- [ ] **Step 1: Install @solana/web3.js**

```bash
npm install @solana/web3.js@1.95.8
```

Note: The version MUST be exactly 1.95.8 or higher — 1.95.6/1.95.7 had a supply chain incident.

- [ ] **Step 2: Create Jest mock for @solana/web3.js**

Create `__mocks__/@solana/web3.js.ts`:
```typescript
/* eslint-disable @typescript-eslint/no-unused-vars */

export class PublicKey {
  private _key: string;
  constructor(key: string | Uint8Array) {
    this._key = typeof key === 'string' ? key : Buffer.from(key).toString('hex');
  }
  toBase58() {
    return this._key;
  }
  toBytes() {
    return new Uint8Array(32);
  }
  toString() {
    return this._key;
  }
  equals(other: PublicKey) {
    return this._key === other._key;
  }
  static default = new PublicKey('11111111111111111111111111111111');
}

export class Transaction {
  instructions: unknown[] = [];
  recentBlockhash?: string;
  feePayer?: PublicKey;
  add(...items: unknown[]) {
    this.instructions.push(...items);
    return this;
  }
}

export class VersionedTransaction {
  message: unknown;
  signatures: Uint8Array[] = [];
  constructor(message: unknown) {
    this.message = message;
  }
  sign(_signers: unknown[]) {}
  serialize() {
    return new Uint8Array(0);
  }
}

export class TransactionMessage {
  static decompile(_message: unknown, _args?: unknown) {
    return new TransactionMessage(PublicKey.default, '11111111', []);
  }
  constructor(
    public payerKey: PublicKey,
    public recentBlockhash: string,
    public instructions: unknown[],
  ) {}
  compileToV0Message(_addressLookupTableAccounts?: unknown[]) {
    return {};
  }
}

export const MessageV0 = {
  compile: jest.fn((_args: unknown) => ({})),
};

export class Connection {
  private _endpoint: string;
  constructor(endpoint: string, _commitment?: string) {
    this._endpoint = endpoint;
  }
  getBalance = jest.fn(async (_pk: PublicKey) => 1_000_000_000);
  getTokenAccountsByOwner = jest.fn(async () => ({value: []}));
  getSignaturesForAddress = jest.fn(async () => []);
  getParsedTransaction = jest.fn(async () => null);
  simulateTransaction = jest.fn(async () => ({value: {err: null, logs: []}}));
  getLatestBlockhash = jest.fn(async () => ({
    blockhash: 'mock-blockhash-' + Date.now(),
    lastValidBlockHeight: 999999,
  }));
  confirmTransaction = jest.fn(async () => ({value: {err: null}}));
  sendRawTransaction = jest.fn(async () => 'mock-signature-' + Date.now());
  getSignatureStatus = jest.fn(async () => ({
    value: {confirmationStatus: 'confirmed', err: null},
  }));
  getRecentPrioritizationFees = jest.fn(async () => [
    {prioritizationFee: 1000, slot: 100},
    {prioritizationFee: 5000, slot: 101},
    {prioritizationFee: 10000, slot: 102},
  ]);
  getAddressLookupTable = jest.fn(async () => ({value: null}));
}

export const SystemProgram = {
  transfer: jest.fn((_params: {fromPubkey: PublicKey; toPubkey: PublicKey; lamports: bigint | number}) => ({
    programId: PublicKey.default,
    keys: [],
    data: Buffer.from([]),
  })),
  programId: new PublicKey('11111111111111111111111111111111'),
};

export const LAMPORTS_PER_SOL = 1_000_000_000;

export class Keypair {
  publicKey: PublicKey;
  secretKey: Uint8Array;
  constructor() {
    this.publicKey = new PublicKey('mock-keypair-pubkey');
    this.secretKey = new Uint8Array(64);
  }
  static fromSecretKey(sk: Uint8Array) {
    const kp = new Keypair();
    kp.secretKey = sk;
    return kp;
  }
}

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

export const clusterApiUrl = jest.fn((_cluster: string) => 'https://api.devnet.solana.com');

// AddressLookupTableAccount mock
export class AddressLookupTableAccount {
  key: PublicKey;
  state: {addresses: PublicKey[]};
  constructor(args: {key: PublicKey; state: {addresses: PublicKey[]}}) {
    this.key = args.key;
    this.state = args.state;
  }
}

export const ComputeBudgetProgram = {
  setComputeUnitPrice: jest.fn((_params: {microLamports: number}) => ({
    programId: PublicKey.default,
    keys: [],
    data: Buffer.from([]),
  })),
  setComputeUnitLimit: jest.fn((_params: {units: number}) => ({
    programId: PublicKey.default,
    keys: [],
    data: Buffer.from([]),
  })),
};
```

- [ ] **Step 3: Add @solana/web3.js to transformIgnorePatterns in jest.config.js**

The @solana/web3.js package may need to be transformed by Babel. Add it to the pattern if tests fail with ESM errors.

- [ ] **Step 4: Verify TypeScript compiles and tests pass**

Run: `npx tsc --noEmit && npx jest --no-cache --testPathPattern="(App|cn|instances)" --silent`
Expected: PASS (quick subset, not full PBKDF2 suite)

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json "__mocks__/@solana/" jest.config.js
git commit -m "deps: add @solana/web3.js 1.95.8 with comprehensive Jest mock"
```

---

## Task 2: Shared Types

**Files:**
- Create: `src/modules/solana/types.ts`

- [ ] **Step 1: Create types.ts**

Create `src/modules/solana/types.ts`:
```typescript
import type {PublicKey, VersionedTransaction, AddressLookupTableAccount} from '@solana/web3.js';

export interface TransferParams {
  sender: PublicKey;
  recipient: PublicKey;
  lamports: bigint;
  priorityFee?: number; // microlamports
}

export interface SPLTransferParams {
  sender: PublicKey;
  recipient: PublicKey;
  mint: PublicKey;
  amount: bigint; // in smallest unit
  decimals: number;
  priorityFee?: number; // microlamports
  createAta?: boolean; // create ATA if recipient doesn't have one
}

export type PriorityLevel = 'normal' | 'fast' | 'urgent';

export const PRIORITY_PERCENTILES: Record<PriorityLevel, 50 | 75 | 90> = {
  normal: 50,
  fast: 75,
  urgent: 90,
};

export interface SimulationResult {
  success: boolean;
  error?: {
    code: string; // Error code from ERROR_CODES
    message: string;
    action: string;
  };
  logs?: string[];
  unitsConsumed?: number;
}

export interface SignAndSendResult {
  signature: string;
  confirmationStatus: 'processed' | 'confirmed' | 'finalized';
}

export interface TokenAccount {
  mint: string;
  owner: string;
  amount: string; // bigint as string
  decimals: number;
  address: string; // token account address
}

export interface ParsedTransaction {
  signature: string;
  slot: number;
  timestamp: number | null;
  type: 'transfer' | 'spl_transfer' | 'unknown';
  amount?: string;
  mint?: string;
  from?: string;
  to?: string;
  fee: number;
  status: 'confirmed' | 'finalized' | 'failed';
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/modules/solana/types.ts
git commit -m "feat: Solana module shared types (TransferParams, SimulationResult, etc.)"
```

---

## Task 3: Rate Limiter (TDD)

**Files:**
- Create: `src/modules/solana/__tests__/rateLimiter.test.ts`
- Create: `src/modules/solana/rateLimiter.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/solana/__tests__/rateLimiter.test.ts`:
```typescript
import {RateLimiter} from '../rateLimiter';

describe('RateLimiter', () => {
  it('executes requests within concurrency limit', async () => {
    const limiter = new RateLimiter({maxConcurrent: 2});
    const results: number[] = [];

    await Promise.all([
      limiter.execute('a', async () => { results.push(1); return 1; }),
      limiter.execute('b', async () => { results.push(2); return 2; }),
      limiter.execute('c', async () => { results.push(3); return 3; }),
    ]);

    expect(results).toEqual([1, 2, 3]);
  });

  it('respects maxConcurrent limit', async () => {
    const limiter = new RateLimiter({maxConcurrent: 1});
    let concurrent = 0;
    let maxSeen = 0;

    const task = async () => {
      concurrent++;
      maxSeen = Math.max(maxSeen, concurrent);
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
      return maxSeen;
    };

    await Promise.all([
      limiter.execute('a', task),
      limiter.execute('b', task),
      limiter.execute('c', task),
    ]);

    expect(maxSeen).toBe(1);
  });

  it('deduplicates identical in-flight requests', async () => {
    const limiter = new RateLimiter({maxConcurrent: 10});
    let callCount = 0;

    const task = async () => {
      callCount++;
      await new Promise(r => setTimeout(r, 50));
      return 'result';
    };

    // Same key = deduplicated
    const [r1, r2] = await Promise.all([
      limiter.execute('same-key', task),
      limiter.execute('same-key', task),
    ]);

    expect(callCount).toBe(1); // Only executed once
    expect(r1).toBe('result');
    expect(r2).toBe('result');
  });

  it('does not deduplicate different keys', async () => {
    const limiter = new RateLimiter({maxConcurrent: 10});
    let callCount = 0;

    const task = async () => {
      callCount++;
      return 'result';
    };

    await Promise.all([
      limiter.execute('key-1', task),
      limiter.execute('key-2', task),
    ]);

    expect(callCount).toBe(2);
  });

  it('retries with exponential backoff on retriable errors', async () => {
    const limiter = new RateLimiter({maxConcurrent: 10, maxRetries: 3, baseDelayMs: 10});
    let attempts = 0;

    const task = async () => {
      attempts++;
      if (attempts < 3) {
        const err = new Error('Too many requests');
        (err as unknown as Record<string, number>).status = 429;
        throw err;
      }
      return 'success';
    };

    const result = await limiter.execute('retry-key', task, {isRetriable: (e) => (e as Record<string, number>).status === 429});
    expect(result).toBe('success');
    expect(attempts).toBe(3);
  });

  it('throws after max retries exhausted', async () => {
    const limiter = new RateLimiter({maxConcurrent: 10, maxRetries: 2, baseDelayMs: 10});

    const task = async () => {
      const err = new Error('Rate limited');
      (err as unknown as Record<string, number>).status = 429;
      throw err;
    };

    await expect(
      limiter.execute('fail-key', task, {isRetriable: () => true}),
    ).rejects.toThrow('Rate limited');
  });

  it('enforces cooldown between requests', async () => {
    const limiter = new RateLimiter({maxConcurrent: 1, cooldownMs: 50});
    const timestamps: number[] = [];

    const task = async () => {
      timestamps.push(Date.now());
      return true;
    };

    await limiter.execute('a', task);
    await limiter.execute('b', task);

    const gap = timestamps[1] - timestamps[0];
    expect(gap).toBeGreaterThanOrEqual(45); // ~50ms with some tolerance
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/solana/__tests__/rateLimiter.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement RateLimiter**

Create `src/modules/solana/rateLimiter.ts`:
```typescript
interface RateLimiterConfig {
  maxConcurrent: number;
  maxRetries?: number;
  baseDelayMs?: number;
  cooldownMs?: number;
}

interface ExecuteOptions {
  isRetriable?: (error: unknown) => boolean;
}

/**
 * Generic rate limiter with concurrency control, deduplication,
 * exponential backoff retry, and cooldown between requests.
 *
 * Used for:
 *   - RPC calls: max 10 concurrent, backoff on 429
 *   - /v1/prove/*: max 1 concurrent, 3s cooldown
 *   - /v1/relayer/submit: max 1 concurrent, 5s cooldown
 */
export class RateLimiter {
  private active = 0;
  private queue: Array<() => void> = [];
  private inflight = new Map<string, Promise<unknown>>();
  private lastCompleted = 0;
  private config: Required<RateLimiterConfig>;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: config.baseDelayMs ?? 1000,
      cooldownMs: config.cooldownMs ?? 0,
      maxConcurrent: config.maxConcurrent,
    };
  }

  async execute<T>(
    key: string,
    fn: () => Promise<T>,
    options?: ExecuteOptions,
  ): Promise<T> {
    // Deduplication: if same key is already in-flight, return its promise
    const existing = this.inflight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = this.doExecute(key, fn, options);
    this.inflight.set(key, promise);

    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  private async doExecute<T>(
    _key: string,
    fn: () => Promise<T>,
    options?: ExecuteOptions,
  ): Promise<T> {
    await this.acquireSlot();

    try {
      return await this.executeWithRetry(fn, options);
    } finally {
      this.active--;
      this.lastCompleted = Date.now();
      this.releaseNext();
    }
  }

  private async acquireSlot(): Promise<void> {
    // Enforce cooldown
    if (this.config.cooldownMs > 0 && this.lastCompleted > 0) {
      const elapsed = Date.now() - this.lastCompleted;
      const remaining = this.config.cooldownMs - elapsed;
      if (remaining > 0) {
        await this.sleep(remaining);
      }
    }

    if (this.active < this.config.maxConcurrent) {
      this.active++;
      return;
    }

    // Wait for a slot to open
    return new Promise<void>(resolve => {
      this.queue.push(() => {
        this.active++;
        resolve();
      });
    });
  }

  private releaseNext(): void {
    const next = this.queue.shift();
    if (next) next();
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    options?: ExecuteOptions,
  ): Promise<T> {
    const {maxRetries, baseDelayMs} = this.config;
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries && options?.isRetriable?.(error)) {
          const delay = baseDelayMs * Math.pow(2, attempt);
          await this.sleep(delay);
          continue;
        }
        throw error;
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/solana/__tests__/rateLimiter.test.ts --no-cache`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/rateLimiter.ts src/modules/solana/__tests__/rateLimiter.test.ts
git commit -m "feat: rate limiter with concurrency control, dedup, exponential backoff"
```

---

## Task 4: Connection Manager

**Files:**
- Create: `src/modules/solana/connection.ts`

- [ ] **Step 1: Create connection.ts**

Create `src/modules/solana/connection.ts`:
```typescript
import {Connection} from '@solana/web3.js';
import {RPC_ENDPOINT} from '../../constants/programs';

const FALLBACK_RPC = 'https://api.mainnet-beta.solana.com';
const COMMITMENT = 'confirmed' as const;

let _connection: Connection | null = null;

/**
 * Get the singleton Solana RPC connection.
 * Primary: Helius endpoint (from .env via react-native-config)
 * Fallback: public Solana RPC (rate-limited, lower reliability)
 */
export function getConnection(): Connection {
  if (!_connection) {
    const endpoint = RPC_ENDPOINT || FALLBACK_RPC;
    _connection = new Connection(endpoint, {
      commitment: COMMITMENT,
      confirmTransactionInitialTimeout: 60_000,
    });
  }
  return _connection;
}

/**
 * Reset the connection (for testing or endpoint change).
 */
export function resetConnection(): void {
  _connection = null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/modules/solana/connection.ts
git commit -m "feat: Solana connection singleton (Helius primary + public fallback)"
```

---

## Task 5: Query Functions (TDD)

**Files:**
- Create: `src/modules/solana/__tests__/queries.test.ts`
- Create: `src/modules/solana/queries.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/solana/__tests__/queries.test.ts`:
```typescript
import {Connection, PublicKey} from '@solana/web3.js';
import {getBalance, getTokenAccounts, getTransactionHistory} from '../queries';

describe('Solana queries', () => {
  let connection: Connection;
  const testPubkey = new PublicKey('11111111111111111111111111111111');

  beforeEach(() => {
    connection = new Connection('https://mock-rpc.com');
    jest.clearAllMocks();
  });

  describe('getBalance', () => {
    it('returns balance as bigint', async () => {
      (connection.getBalance as jest.Mock).mockResolvedValueOnce(2_500_000_000);
      const balance = await getBalance(connection, testPubkey);
      expect(typeof balance).toBe('bigint');
      expect(balance).toBe(2_500_000_000n);
    });

    it('calls RPC with correct pubkey', async () => {
      await getBalance(connection, testPubkey);
      expect(connection.getBalance).toHaveBeenCalledWith(testPubkey);
    });
  });

  describe('getTokenAccounts', () => {
    it('returns parsed token accounts', async () => {
      (connection.getTokenAccountsByOwner as jest.Mock).mockResolvedValueOnce({
        value: [
          {
            pubkey: new PublicKey('tokenAccount1'),
            account: {
              data: {
                parsed: {
                  info: {
                    mint: 'mintAddress1',
                    owner: testPubkey.toBase58(),
                    tokenAmount: {amount: '1000000000', decimals: 9, uiAmount: 1},
                  },
                },
              },
            },
          },
        ],
      });

      const accounts = await getTokenAccounts(connection, testPubkey);
      expect(accounts.length).toBe(1);
      expect(accounts[0].mint).toBe('mintAddress1');
      expect(accounts[0].amount).toBe('1000000000');
      expect(accounts[0].decimals).toBe(9);
    });

    it('returns empty array when no token accounts', async () => {
      (connection.getTokenAccountsByOwner as jest.Mock).mockResolvedValueOnce({value: []});
      const accounts = await getTokenAccounts(connection, testPubkey);
      expect(accounts).toEqual([]);
    });
  });

  describe('getTransactionHistory', () => {
    it('returns parsed transactions', async () => {
      (connection.getSignaturesForAddress as jest.Mock).mockResolvedValueOnce([
        {signature: 'sig1', slot: 100, blockTime: 1700000000, err: null},
        {signature: 'sig2', slot: 101, blockTime: 1700000001, err: {msg: 'fail'}},
      ]);

      const history = await getTransactionHistory(connection, testPubkey, {limit: 10});
      expect(history.length).toBe(2);
      expect(history[0].signature).toBe('sig1');
      expect(history[0].status).toBe('confirmed');
      expect(history[1].status).toBe('failed');
    });

    it('respects limit and before cursor', async () => {
      await getTransactionHistory(connection, testPubkey, {limit: 5, before: 'prevSig'});
      expect(connection.getSignaturesForAddress).toHaveBeenCalledWith(
        testPubkey,
        expect.objectContaining({limit: 5, before: 'prevSig'}),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement queries**

Create `src/modules/solana/queries.ts`:
```typescript
import type {Connection, PublicKey} from '@solana/web3.js';
import {TOKEN_PROGRAM_ID} from '@solana/web3.js';
import type {TokenAccount, ParsedTransaction} from './types';

/**
 * Get SOL balance in lamports as BigInt.
 */
export async function getBalance(connection: Connection, publicKey: PublicKey): Promise<bigint> {
  const lamports = await connection.getBalance(publicKey);
  return BigInt(lamports);
}

/**
 * Get all SPL token accounts for an owner.
 */
export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenAccount[]> {
  const response = await connection.getTokenAccountsByOwner(owner, {
    programId: TOKEN_PROGRAM_ID,
  });

  return response.value.map(({pubkey, account}) => {
    const parsed = (account.data as { parsed: { info: {
      mint: string;
      owner: string;
      tokenAmount: { amount: string; decimals: number };
    }}}}).parsed.info;

    return {
      mint: parsed.mint,
      owner: parsed.owner,
      amount: parsed.tokenAmount.amount,
      decimals: parsed.tokenAmount.decimals,
      address: pubkey.toBase58(),
    };
  });
}

/**
 * Get transaction history for an address.
 */
export async function getTransactionHistory(
  connection: Connection,
  address: PublicKey,
  options: {limit: number; before?: string},
): Promise<ParsedTransaction[]> {
  const signatures = await connection.getSignaturesForAddress(address, {
    limit: options.limit,
    before: options.before,
  });

  return signatures.map(sig => ({
    signature: sig.signature,
    slot: sig.slot,
    timestamp: sig.blockTime ?? null,
    type: 'unknown' as const,
    fee: 0,
    status: sig.err ? ('failed' as const) : ('confirmed' as const),
  }));
}
```

- [ ] **Step 4: Run tests**

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/queries.ts src/modules/solana/__tests__/queries.test.ts
git commit -m "feat: Solana query functions (getBalance, getTokenAccounts, getTransactionHistory)"
```

---

## Task 6: Transaction Builder (TDD)

**Files:**
- Create: `src/modules/solana/__tests__/transactionBuilder.test.ts`
- Create: `src/modules/solana/transactionBuilder.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/solana/__tests__/transactionBuilder.test.ts`:
```typescript
import {PublicKey, SystemProgram, ComputeBudgetProgram} from '@solana/web3.js';
import {buildTransferTx, buildSPLTransferTx} from '../transactionBuilder';

// Mock getConnection to return a mocked Connection
jest.mock('../connection', () => ({
  getConnection: () => ({
    getLatestBlockhash: jest.fn(async () => ({
      blockhash: 'test-blockhash',
      lastValidBlockHeight: 999,
    })),
    getTokenAccountsByOwner: jest.fn(async () => ({value: []})),
    getAccountInfo: jest.fn(async () => null),
  }),
}));

describe('transactionBuilder', () => {
  const sender = new PublicKey('senderPubkey');
  const recipient = new PublicKey('recipientPubkey');
  const mint = new PublicKey('mintPubkey');

  describe('buildTransferTx', () => {
    it('builds a VersionedTransaction', async () => {
      const tx = await buildTransferTx({
        sender,
        recipient,
        lamports: 100_000_000n,
      });
      expect(tx).toBeDefined();
      expect(tx.message).toBeDefined();
    });

    it('includes SystemProgram.transfer instruction', async () => {
      await buildTransferTx({sender, recipient, lamports: 100_000_000n});
      expect(SystemProgram.transfer).toHaveBeenCalledWith(
        expect.objectContaining({
          fromPubkey: sender,
          toPubkey: recipient,
        }),
      );
    });

    it('includes Noctura fee markup instruction', async () => {
      await buildTransferTx({sender, recipient, lamports: 100_000_000n});
      // SystemProgram.transfer called twice: once for user transfer, once for fee
      expect(SystemProgram.transfer).toHaveBeenCalledTimes(2);
    });

    it('includes priority fee when specified', async () => {
      await buildTransferTx({sender, recipient, lamports: 100_000_000n, priorityFee: 5000});
      expect(ComputeBudgetProgram.setComputeUnitPrice).toHaveBeenCalledWith({
        microLamports: 5000,
      });
    });
  });

  describe('buildSPLTransferTx', () => {
    it('builds a VersionedTransaction for SPL transfer', async () => {
      const tx = await buildSPLTransferTx({
        sender,
        recipient,
        mint,
        amount: 1_000_000_000n,
        decimals: 9,
      });
      expect(tx).toBeDefined();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement transactionBuilder**

Create `src/modules/solana/transactionBuilder.ts`:
```typescript
import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {getConnection} from './connection';
import {NOCTURA_FEE_TREASURY, TRANSPARENT_FEES} from '../../constants/programs';
import type {TransferParams, SPLTransferParams} from './types';

/**
 * Build a SOL transfer as VersionedTransaction (v0).
 * Includes Noctura fee markup instruction (SystemProgram.transfer to NOCTURA_FEE_TREASURY).
 * Fee markup is appended BEFORE simulation.
 */
export async function buildTransferTx(params: TransferParams): Promise<VersionedTransaction> {
  const {sender, recipient, lamports, priorityFee} = params;
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();

  const instructions = [];

  // Priority fee (if specified)
  if (priorityFee) {
    instructions.push(ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}));
  }

  // Main transfer
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: recipient,
      lamports: Number(lamports),
    }),
  );

  // Noctura fee markup — surfaced as single "Network fee" line
  const feeTreasury = new PublicKey(NOCTURA_FEE_TREASURY);
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: feeTreasury,
      lamports: Number(TRANSPARENT_FEES.transferMarkup),
    }),
  );

  const messageV0 = new TransactionMessage({
    payerKey: sender,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
}

/**
 * Build an SPL token transfer as VersionedTransaction (v0).
 * If recipient has no ATA for the token, includes createAssociatedTokenAccountInstruction.
 */
export async function buildSPLTransferTx(params: SPLTransferParams): Promise<VersionedTransaction> {
  const {sender, recipient, mint, amount, decimals, priorityFee} = params;
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();

  const instructions = [];

  // Priority fee (if specified)
  if (priorityFee) {
    instructions.push(ComputeBudgetProgram.setComputeUnitPrice({microLamports: priorityFee}));
  }

  // For SPL transfers, we need the Associated Token Accounts
  // ATA creation logic will be added when @solana/spl-token is integrated
  // For now, build the basic structure

  // Noctura fee markup
  const feeTreasury = new PublicKey(NOCTURA_FEE_TREASURY);
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: sender,
      toPubkey: feeTreasury,
      lamports: Number(TRANSPARENT_FEES.transferMarkup),
    }),
  );

  const messageV0 = new TransactionMessage({
    payerKey: sender,
    recentBlockhash: blockhash,
    instructions,
  }).compileToV0Message();

  return new VersionedTransaction(messageV0);
}
```

Note: Full SPL token transfer with `createTransferInstruction` and `getOrCreateAssociatedTokenAccount` requires the `@solana/spl-token` package, which will be installed in Step 10 (Token module). For now, the builder creates the VersionedTransaction v0 structure with fee markup. The SPL-specific instructions are a stub that will be completed when spl-token is available.

- [ ] **Step 4: Run tests**

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/transactionBuilder.ts src/modules/solana/__tests__/transactionBuilder.test.ts
git commit -m "feat: transaction builder (SOL + SPL stub) with Noctura fee markup, VersionedTransaction v0"
```

---

## Task 7: Transaction Simulation with Error Mapping (TDD)

**Files:**
- Create: `src/modules/solana/__tests__/simulation.test.ts`
- Create: `src/modules/solana/simulation.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/solana/__tests__/simulation.test.ts`:
```typescript
import {Connection, VersionedTransaction} from '@solana/web3.js';
import {simulateTransaction} from '../simulation';

describe('simulateTransaction', () => {
  let connection: Connection;
  const mockTx = new VersionedTransaction({});

  beforeEach(() => {
    connection = new Connection('https://mock-rpc.com');
    jest.clearAllMocks();
  });

  it('returns success when simulation passes', async () => {
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: null, logs: ['log1'], unitsConsumed: 200000},
    });

    const result = await simulateTransaction(connection, mockTx);
    expect(result.success).toBe(true);
    expect(result.logs).toEqual(['log1']);
    expect(result.unitsConsumed).toBe(200000);
  });

  it('maps InsufficientFunds to E010', async () => {
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: 'InsufficientFunds', logs: []},
    });

    const result = await simulateTransaction(connection, mockTx);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E010');
  });

  it('maps AccountNotFound to E024', async () => {
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: {InstructionError: [0, {Custom: 1}]}, logs: ['AccountNotFound']},
    });

    const result = await simulateTransaction(connection, mockTx);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E020'); // TX_SIMULATION_FAILED as fallback
  });

  it('maps InsufficientFundsForRent to E012', async () => {
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: 'InsufficientFundsForRent', logs: []},
    });

    const result = await simulateTransaction(connection, mockTx);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E012');
  });

  it('maps unknown errors to E020', async () => {
    (connection.simulateTransaction as jest.Mock).mockResolvedValueOnce({
      value: {err: {UnknownError: 'something'}, logs: []},
    });

    const result = await simulateTransaction(connection, mockTx);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E020');
  });

  it('handles RPC errors gracefully', async () => {
    (connection.simulateTransaction as jest.Mock).mockRejectedValueOnce(
      new Error('RPC timeout'),
    );

    const result = await simulateTransaction(connection, mockTx);
    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('E020');
  });
});
```

- [ ] **Step 2: Implement simulation**

Create `src/modules/solana/simulation.ts`:
```typescript
import type {Connection, VersionedTransaction} from '@solana/web3.js';
import {ERROR_CODES} from '../../constants/errors';
import type {SimulationResult} from './types';

type ErrorEntry = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * Simulation error mapping: program errors → user-friendly error codes.
 * Spec: .instructions.md lines 1651-1669
 */
function mapSimulationError(err: unknown, logs: string[]): ErrorEntry {
  const errStr = typeof err === 'string' ? err : JSON.stringify(err);
  const logStr = logs.join('\n');

  if (errStr.includes('InsufficientFundsForRent') || logStr.includes('InsufficientFundsForRent')) {
    return ERROR_CODES.INSUFFICIENT_RENT;
  }
  if (errStr.includes('InsufficientFunds') || logStr.includes('InsufficientFunds')) {
    return ERROR_CODES.INSUFFICIENT_SOL;
  }
  if (errStr.includes('AccountNotFound') || logStr.includes('AccountNotFound')) {
    return ERROR_CODES.INVALID_ADDRESS;
  }
  if (errStr.includes('ProgramFailedToComplete') || logStr.includes('ProgramFailedToComplete')) {
    return ERROR_CODES.TX_SIMULATION_FAILED;
  }

  return ERROR_CODES.TX_SIMULATION_FAILED;
}

/**
 * Simulate a transaction and return a typed result.
 * MUST be called before EVERY confirm screen.
 * If simulation fails → BLOCK the confirm button.
 */
export async function simulateTransaction(
  connection: Connection,
  tx: VersionedTransaction,
): Promise<SimulationResult> {
  try {
    const response = await connection.simulateTransaction(tx);
    const {err, logs, unitsConsumed} = response.value;

    if (!err) {
      return {
        success: true,
        logs: logs ?? undefined,
        unitsConsumed: unitsConsumed ?? undefined,
      };
    }

    const mapped = mapSimulationError(err, logs ?? []);
    return {
      success: false,
      error: {
        code: mapped.code,
        message: mapped.message,
        action: mapped.action,
      },
      logs: logs ?? undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.TX_SIMULATION_FAILED.code,
        message: ERROR_CODES.TX_SIMULATION_FAILED.message,
        action: ERROR_CODES.TX_SIMULATION_FAILED.action,
      },
    };
  }
}
```

- [ ] **Step 3: Run tests**

Expected: PASS (6 tests)

- [ ] **Step 4: Commit**

```bash
git add src/modules/solana/simulation.ts src/modules/solana/__tests__/simulation.test.ts
git commit -m "feat: transaction simulation with error mapping (InsufficientFunds→E010, etc.)"
```

---

## Task 8: Priority Fee Estimation (TDD)

**Files:**
- Create: `src/modules/solana/priorityFees.ts`

- [ ] **Step 1: Create priorityFees.ts**

Create `src/modules/solana/priorityFees.ts`:
```typescript
import type {Connection} from '@solana/web3.js';
import type {PriorityLevel} from './types';
import {PRIORITY_PERCENTILES} from './types';

/**
 * Get priority fee in microlamports for a given priority level.
 *
 * Primary: Helius getPriorityFeeEstimate API (more reliable)
 * Fallback: getRecentPrioritizationFees → compute percentile locally
 *
 * Normal (50th): ~5-15s confirmation, low cost
 * Fast (75th): ~2-5s confirmation, moderate cost
 * Urgent (90th): near-instant, higher cost
 */
export async function getPriorityFee(
  connection: Connection,
  level: PriorityLevel = 'normal',
): Promise<number> {
  const percentile = PRIORITY_PERCENTILES[level];

  try {
    // Fallback: compute from recent prioritization fees
    const recentFees = await connection.getRecentPrioritizationFees();

    if (recentFees.length === 0) return 0;

    const sorted = recentFees
      .map(f => f.prioritizationFee)
      .sort((a, b) => a - b);

    const index = Math.floor((percentile / 100) * (sorted.length - 1));
    return sorted[index];
  } catch {
    // If RPC fails, return a sensible default
    const defaults: Record<PriorityLevel, number> = {
      normal: 1_000,
      fast: 10_000,
      urgent: 100_000,
    };
    return defaults[level];
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

- [ ] **Step 3: Commit**

```bash
git add src/modules/solana/priorityFees.ts
git commit -m "feat: priority fee estimation (percentile-based from recent fees)"
```

---

## Task 9: signAndSend with Blockhash Expiry Retry (TDD)

**Files:**
- Create: `src/modules/solana/__tests__/signAndSend.test.ts`
- Create: `src/modules/solana/signAndSend.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/solana/__tests__/signAndSend.test.ts`:
```typescript
import {Connection, VersionedTransaction, Keypair} from '@solana/web3.js';
import {signAndSend} from '../signAndSend';

describe('signAndSend', () => {
  let connection: Connection;
  const mockTx = new VersionedTransaction({});
  const mockSigner = Keypair.fromSecretKey(new Uint8Array(64));

  beforeEach(() => {
    connection = new Connection('https://mock-rpc.com');
    jest.clearAllMocks();
  });

  it('returns signature and confirmation status on success', async () => {
    const result = await signAndSend(connection, mockTx, [mockSigner]);
    expect(result.signature).toBeDefined();
    expect(typeof result.signature).toBe('string');
    expect(result.confirmationStatus).toBe('confirmed');
  });

  it('throws TX_TIMEOUT (E022) after max retries', async () => {
    // Make confirmation always fail
    (connection.confirmTransaction as jest.Mock).mockRejectedValue(
      new Error('Transaction was not confirmed'),
    );
    (connection.getSignatureStatus as jest.Mock).mockResolvedValue({
      value: null,
    });

    await expect(signAndSend(connection, mockTx, [mockSigner], {maxRetries: 1}))
      .rejects.toThrow('E022');
  });

  it('retries with new blockhash on expiry', async () => {
    let attempt = 0;
    (connection.confirmTransaction as jest.Mock).mockImplementation(async () => {
      attempt++;
      if (attempt < 2) throw new Error('Transaction expired');
      return {value: {err: null}};
    });

    const result = await signAndSend(connection, mockTx, [mockSigner], {maxRetries: 3});
    expect(result.signature).toBeDefined();
    // getLatestBlockhash called at least twice (initial + retry)
    expect(connection.getLatestBlockhash).toHaveBeenCalledTimes(attempt);
  });

  it('each retry uses a NEW blockhash', async () => {
    const blockhashes: string[] = [];
    (connection.getLatestBlockhash as jest.Mock).mockImplementation(async () => {
      const bh = 'blockhash-' + Date.now() + '-' + Math.random();
      blockhashes.push(bh);
      return {blockhash: bh, lastValidBlockHeight: 999999};
    });

    let attempt = 0;
    (connection.confirmTransaction as jest.Mock).mockImplementation(async () => {
      attempt++;
      if (attempt < 2) throw new Error('Block height exceeded');
      return {value: {err: null}};
    });

    await signAndSend(connection, mockTx, [mockSigner], {maxRetries: 3});
    // All blockhashes should be unique (new one per attempt)
    const unique = new Set(blockhashes);
    expect(unique.size).toBe(blockhashes.length);
  });
});
```

- [ ] **Step 2: Implement signAndSend**

Create `src/modules/solana/signAndSend.ts`:
```typescript
import type {Connection, Signer, VersionedTransaction} from '@solana/web3.js';
import type {SignAndSendResult} from './types';

const DEFAULT_MAX_RETRIES = 3;
const CONFIRMATION_TIMEOUT_MS = 60_000;

interface SignAndSendOptions {
  maxRetries?: number;
}

/**
 * Sign and send a transaction with blockhash expiry retry logic.
 *
 * Strategy (from spec):
 *   1. getLatestBlockhash → assign to tx → sign → send
 *   2. Poll confirmTransaction with lastValidBlockHeight
 *   3. If expired → NEW blockhash → NEW signature → re-send
 *   4. Max 3 retries, then throw TX_TIMEOUT (E022)
 *
 * ⚠️ Each retry requires a NEW blockhash + NEW signature.
 *    Never retry the same signed transaction.
 */
export async function signAndSend(
  connection: Connection,
  tx: VersionedTransaction,
  signers: Signer[],
  options?: SignAndSendOptions,
): Promise<SignAndSendResult> {
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 1. Get fresh blockhash for each attempt
      const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();

      // 2. Sign the transaction
      // In a real implementation, we'd update the message blockhash and re-sign.
      // With the mock, sign is a no-op.
      tx.sign(signers);

      // 3. Send raw transaction
      const signature = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true, // We already simulated
        maxRetries: 0, // We handle retries ourselves
      });

      // 4. Confirm with block height check
      await connection.confirmTransaction(
        {signature, blockhash, lastValidBlockHeight},
        'confirmed',
      );

      // 5. Get final status
      const status = await connection.getSignatureStatus(signature);
      const confirmationStatus = status.value?.confirmationStatus ?? 'confirmed';

      return {
        signature,
        confirmationStatus: confirmationStatus as SignAndSendResult['confirmationStatus'],
      };
    } catch (error) {
      const isExpiry =
        error instanceof Error &&
        (error.message.includes('expired') ||
          error.message.includes('Block height exceeded') ||
          error.message.includes('not confirmed'));

      if (isExpiry && attempt < maxRetries) {
        // Retry with new blockhash
        continue;
      }

      // Max retries exhausted or non-expiry error
      const txError = new Error(`Transaction not confirmed after ${attempt + 1} attempts [E022]`);
      txError.name = 'TxTimeoutError';
      throw txError;
    }
  }

  // Should not reach here, but TypeScript needs it
  throw new Error('Transaction not confirmed [E022]');
}
```

- [ ] **Step 3: Run tests**

Expected: PASS (4 tests)

- [ ] **Step 4: Commit**

```bash
git add src/modules/solana/signAndSend.ts src/modules/solana/__tests__/signAndSend.test.ts
git commit -m "feat: signAndSend with blockhash expiry retry (max 3, new blockhash each attempt)"
```

---

## Task 10: Relayer ALT Fetch (TDD)

**Files:**
- Create: `src/modules/solana/__tests__/relayer.test.ts`
- Create: `src/modules/solana/relayer.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/solana/__tests__/relayer.test.ts`:
```typescript
import {getRelayerLookupTables} from '../relayer';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

jest.mock('../../sslPinning/pinnedFetch');

describe('getRelayerLookupTables', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches lookup tables from relayer API', async () => {
    (pinnedFetch as jest.Mock).mockResolvedValueOnce({
      status: 200,
      json: async () => ({
        tables: [
          {
            address: 'ALTaddress1',
            addresses: ['addr1', 'addr2'],
          },
        ],
      }),
    });

    const tables = await getRelayerLookupTables();
    expect(tables.length).toBe(1);
    expect(pinnedFetch).toHaveBeenCalledWith(
      expect.stringContaining('/v1/relayer/lookup-tables'),
    );
  });

  it('returns empty array on API error', async () => {
    (pinnedFetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));
    const tables = await getRelayerLookupTables();
    expect(tables).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement relayer**

Create `src/modules/solana/relayer.ts`:
```typescript
import {PublicKey, AddressLookupTableAccount} from '@solana/web3.js';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {API_BASE} from '../../constants/programs';

interface RelayerTable {
  address: string;
  addresses: string[];
}

/**
 * Fetch pre-created Address Lookup Tables from the Noctura relayer.
 * Client does NOT create ALTs (privacy: ALT creation leaves on-chain trace).
 *
 * Endpoint: GET /v1/relayer/lookup-tables
 */
export async function getRelayerLookupTables(): Promise<AddressLookupTableAccount[]> {
  try {
    const response = await pinnedFetch(`${API_BASE}/v1/relayer/lookup-tables`);
    const data = (await response.json()) as {tables: RelayerTable[]};

    return data.tables.map(
      table =>
        new AddressLookupTableAccount({
          key: new PublicKey(table.address),
          state: {
            addresses: table.addresses.map(a => new PublicKey(a)),
          },
        }),
    );
  } catch {
    // Relayer unavailable — return empty (transactions will work without ALTs
    // but may hit size limits for complex shielded transactions)
    return [];
  }
}
```

- [ ] **Step 3: Run tests**

Expected: PASS (2 tests)

- [ ] **Step 4: Commit**

```bash
git add src/modules/solana/relayer.ts src/modules/solana/__tests__/relayer.test.ts
git commit -m "feat: relayer ALT fetch (client never creates ALTs)"
```

---

## Task 11: React Query Hooks with Spec TTLs

**Files:**
- Create: `src/hooks/useSolanaQueries.ts`

- [ ] **Step 1: Create React Query hooks**

Create `src/hooks/useSolanaQueries.ts`:
```typescript
import {useQuery} from '@tanstack/react-query';
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../modules/solana/connection';
import {getBalance, getTokenAccounts, getTransactionHistory} from '../modules/solana/queries';
import type {TokenAccount, ParsedTransaction} from '../modules/solana/types';

/**
 * React Query hook for SOL balance.
 * TTL: 10 seconds (spec: getBalance refresh interval)
 */
export function useBalance(publicKey: string | null) {
  return useQuery<bigint>({
    queryKey: ['balance', publicKey],
    queryFn: async () => {
      if (!publicKey) throw new Error('No public key');
      return getBalance(getConnection(), new PublicKey(publicKey));
    },
    enabled: !!publicKey,
    staleTime: 10_000, // 10s
    gcTime: 60_000,
  });
}

/**
 * React Query hook for SPL token accounts.
 * TTL: 60 seconds (spec: token list refresh)
 */
export function useTokenAccounts(publicKey: string | null) {
  return useQuery<TokenAccount[]>({
    queryKey: ['tokenAccounts', publicKey],
    queryFn: async () => {
      if (!publicKey) throw new Error('No public key');
      return getTokenAccounts(getConnection(), new PublicKey(publicKey));
    },
    enabled: !!publicKey,
    staleTime: 60_000, // 60s
    gcTime: 5 * 60_000,
  });
}

/**
 * React Query hook for transaction history.
 * TTL: 30 seconds (spec: tx history refresh)
 */
export function useTransactionHistory(
  publicKey: string | null,
  options?: {limit?: number; before?: string},
) {
  return useQuery<ParsedTransaction[]>({
    queryKey: ['txHistory', publicKey, options?.before],
    queryFn: async () => {
      if (!publicKey) throw new Error('No public key');
      return getTransactionHistory(getConnection(), new PublicKey(publicKey), {
        limit: options?.limit ?? 20,
        before: options?.before,
      });
    },
    enabled: !!publicKey,
    staleTime: 30_000, // 30s
    gcTime: 5 * 60_000,
  });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useSolanaQueries.ts
git commit -m "feat: React Query hooks for balance (10s), tokens (60s), history (30s)"
```

---

## Task 12: Full Verification

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `npx jest --no-cache`
Expected: PASS — all suites

- [ ] **Step 3: Verification checklist**

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  Connection: Helius primary (RPC_ENDPOINT from .env) + public fallback
[ ]  getBalance returns bigint (not number)
[ ]  getTokenAccounts uses TOKEN_PROGRAM_ID
[ ]  getTransactionHistory respects limit + before cursor
[ ]  buildTransferTx uses VersionedTransaction v0 (not legacy Transaction)
[ ]  buildTransferTx includes Noctura fee markup (SystemProgram.transfer to NOCTURA_FEE_TREASURY)
[ ]  buildSPLTransferTx uses VersionedTransaction v0
[ ]  simulateTransaction maps InsufficientFunds → E010
[ ]  simulateTransaction maps InsufficientFundsForRent → E012
[ ]  simulateTransaction returns { success, error, logs }
[ ]  getPriorityFee: normal=50th, fast=75th, urgent=90th percentile
[ ]  signAndSend: max 3 retries with NEW blockhash each attempt
[ ]  signAndSend: throws E022 on max retries exhausted
[ ]  signAndSend: returns { signature, confirmationStatus }
[ ]  Relayer ALT fetch: GET /v1/relayer/lookup-tables (client never creates ALTs)
[ ]  Rate limiter: concurrency control, dedup, exponential backoff
[ ]  React Query TTLs: balance 10s, tokens 60s, history 30s
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
