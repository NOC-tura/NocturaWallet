# Shielded C2 — Deposit (Shield) Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the wallet's shielded **deposit** (shield) flow work end-to-end against the live devnet shielded-pool program — real ZK proof, self-relay transaction, all-JS witness, real note stored.

**Architecture:** The wallet derives `sk_view` in JS, builds a fresh note (random `noteSecret`, own `pkRecipientHash` → `commitment`), gets a proof from the coordinator (`/zk/prove`, which now returns on-chain-ready `proofBytes`), builds the `deposit` instruction manually (8-byte Anchor discriminator + Borsh args + exact account metas), prepends a ComputeBudget ix, signs with the transparent keypair (fee_payer), submits via the existing `signAndSend`, and stores the real note with its `leaf_index` from the Deposit event log. Replaces the relayer stub + fake-note placeholder.

**Tech Stack:** TypeScript (strict), `@solana/web3.js` 1.95.8 (manual ix building, no Anchor runtime), `@noble/curves` (bls12-381 view pubkey), `@noble/hashes` (sha256 discriminator), `poseidon-lite` (via `noteCrypto`), Hermes-safe byte encoding, jest.

**Spec:** `docs/superpowers/specs/2026-06-29-shielded-c2-project1-deposit-withdraw-design.md`

**Reused (do NOT re-implement):**
- `signAndSend(connection, spec, signers)` — `src/modules/solana/signAndSend.ts` (blockhash retry + confirm).
- `deriveTransparentKeypair(seed, scheme)` + `Keypair.fromSecretKey` — `src/modules/keyDerivation/transparent.ts` (fee_payer signer).
- `deriveShieldedViewKey(seed)` — `src/modules/keyDerivation/shielded.ts` (sk_view, EIP-2333 path 2/0).
- `noteCrypto.ts` — `mintHash`, `noteCommitment`, `pkRecipientHash`, `bytesToBigIntBE`, `BN254_FIELD_PRIME`.
- `getConnection()` — `src/modules/solana/connection.ts` (devnet in the devnet build via env).
- `noteStore.ts` — `addNote`, `getBalance`, `getNotes`.
- Hermes-safe u64 LE encoding pattern — `src/modules/solana/transactionBuilder.ts:122-126` (byte-shift loop, NOT `writeBigUInt64LE`).

**On-chain facts (verified from the deployed program `programs/shielded-pool/src/lib.rs`):**
- Program ID: `NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES`.
- `deposit(amount: u64, commitment: [u8;32], proof_bytes: Vec<u8>)`. Discriminator = `sha256("global:deposit")[0:8]`.
- `DepositCtx` account order + flags: `pool`(ro), `merkle_tree`(mut), `vault`(mut), `depositor`(signer, = fee_payer), `depositor_token_account`(mut), `token_program`(ro). The program performs the SPL transfer depositor_token_account → vault internally.
- PDAs: `pool=["pool",mint]`, `merkle_tree=["merkle",pool]`, `vault=ATA(pool,mint,offCurve)`.
- Deposit emits `Deposit { commitment:[u8;32], leaf_index:u64, root:[u8;32] }` (Anchor event in `Program data:` log).

**⚠️ Security note baked into Task 5:** these circuits require `noteSecret` as a private prover input, so hosted proving sends `noteSecret` to the coordinator. POC-accepted (own coordinator, test tokens). Mainnet privacy requires local on-device proving — see `project_shielded_mainnet_blockers` memory.

---

### Task 1: Shielded devnet constants + `proofBytes` response field

**Files:**
- Modify: `src/constants/programs.ts` (append shielded-pool constants)
- Modify: `src/modules/zkProver/types.ts` (add `proofBytes`)
- Test: `src/constants/__tests__/shieldedPool.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/constants/__tests__/shieldedPool.test.ts
import {PublicKey} from '@solana/web3.js';
import {SHIELDED_POOL_PROGRAM_ID, SHIELDED_CU} from '../programs';

describe('shielded pool constants', () => {
  it('program id is a valid PublicKey', () => {
    expect(() => new PublicKey(SHIELDED_POOL_PROGRAM_ID)).not.toThrow();
    expect(SHIELDED_POOL_PROGRAM_ID).toBe(
      'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES',
    );
  });
  it('CU limits cover the measured deposit/withdraw cost with headroom', () => {
    expect(SHIELDED_CU.deposit).toBeGreaterThanOrEqual(132_256);
    expect(SHIELDED_CU.withdraw).toBeGreaterThanOrEqual(152_508);
    expect(SHIELDED_CU.deposit).toBeLessThan(400_000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest shieldedPool`
Expected: FAIL — `SHIELDED_POOL_PROGRAM_ID` is not exported.

- [ ] **Step 3: Implement**

Append to `src/constants/programs.ts`:

```ts
// ---- Shielded pool (devnet POC) ----------------------------------------------
// Deployed devnet program. The mainnet pool is a separate, audited deployment.
export const SHIELDED_POOL_PROGRAM_ID =
  'NPkcpUdnm1JZhndur3ggQZwo86yWgcU6Ry28T3zHfES' as const;

// Devnet test mint the pool was initialized for. Sourced from the env so the
// devnet build can override it; falls back to the known devnet fixture mint.
import Config from 'react-native-config';
export const SHIELDED_DEVNET_MINT =
  Config.SHIELDED_DEVNET_MINT ?? '';

// Compute-unit limits: measured deposit ~132,256 / withdraw ~152,508 CU on
// devnet; add headroom (the wallet prepends setComputeUnitLimit).
export const SHIELDED_CU = {deposit: 200_000, withdraw: 250_000} as const;
```

In `src/modules/zkProver/types.ts`, add `proofBytes` to both `HostedProverResponse` and `ZKProof`:

```ts
// HostedProverResponse — add:
  /** On-chain-ready proof (hex, 256 bytes). Forwarded opaquely into the ix. */
  proofBytes?: string;

// ZKProof — add:
  /** On-chain-ready proof bytes (hex, 256 B), from the coordinator converter. */
  proofBytes: string;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest shieldedPool && npx tsc --noEmit`
Expected: PASS; tsc has new errors where `ZKProof` is constructed without `proofBytes` (fixed in Task 5).

- [ ] **Step 5: Commit**

```bash
git add src/constants/programs.ts src/constants/__tests__/shieldedPool.test.ts src/modules/zkProver/types.ts
git commit -m "feat(shielded): devnet pool constants + proofBytes response field"
```

---

### Task 2: Random field element for `noteSecret`

**Files:**
- Modify: `src/modules/shielded/noteCrypto.ts` (add `randomFieldElement`)
- Test: `src/modules/shielded/__tests__/noteCrypto.random.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/noteCrypto.random.test.ts
import {randomFieldElement} from '../noteCrypto';
import {BN254_FIELD_PRIME} from '../../merkle/field';

describe('randomFieldElement', () => {
  it('returns a bigint in [0, F)', () => {
    for (let i = 0; i < 50; i++) {
      const x = randomFieldElement();
      expect(typeof x).toBe('bigint');
      expect(x >= 0n).toBe(true);
      expect(x < BN254_FIELD_PRIME).toBe(true);
    }
  });
  it('is not constant across calls', () => {
    expect(randomFieldElement()).not.toBe(randomFieldElement());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest noteCrypto.random`
Expected: FAIL — `randomFieldElement` is not exported.

- [ ] **Step 3: Implement**

Append to `src/modules/shielded/noteCrypto.ts`:

```ts
/**
 * Sample a uniform-ish field element in [0, F) for use as a note secret.
 * 32 random bytes (big-endian) reduced mod F. The reduction bias is < 2^-252
 * (F is ~254 bits), negligible for a blinding secret.
 *
 * Uses the global crypto.getRandomValues polyfilled by react-native-get-random-values
 * (loaded first in index.js).
 */
export function randomFieldElement(): bigint {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBigIntBE(bytes) % BN254_FIELD_PRIME;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest noteCrypto.random`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/noteCrypto.ts src/modules/shielded/__tests__/noteCrypto.random.test.ts
git commit -m "feat(shielded): randomFieldElement for note secrets"
```

---

### Task 3: Pool PDA derivations

**Files:**
- Create: `src/modules/shielded/poolPdas.ts`
- Test: `src/modules/shielded/__tests__/poolPdas.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/poolPdas.test.ts
import {PublicKey} from '@solana/web3.js';
import {poolPda, merkleTreePda, nullifierPda, vaultAta} from '../poolPdas';
import {SHIELDED_POOL_PROGRAM_ID} from '../../../constants/programs';

const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
const PROG = new PublicKey(SHIELDED_POOL_PROGRAM_ID);

describe('pool PDAs', () => {
  it('pool = ["pool", mint] under the program', () => {
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from('pool'), MINT.toBuffer()], PROG);
    expect(poolPda(MINT).equals(expected)).toBe(true);
  });
  it('merkle_tree = ["merkle", pool]', () => {
    const pool = poolPda(MINT);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from('merkle'), pool.toBuffer()], PROG);
    expect(merkleTreePda(pool).equals(expected)).toBe(true);
  });
  it('nullifier = ["nullifier", nullifier32]', () => {
    const n = new Uint8Array(32).fill(7);
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from('nullifier'), Buffer.from(n)], PROG);
    expect(nullifierPda(n).equals(expected)).toBe(true);
  });
  it('vault is the off-curve ATA of pool for mint', () => {
    expect(vaultAta(poolPda(MINT), MINT)).toBeInstanceOf(PublicKey);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest poolPdas`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/shielded/poolPdas.ts
import {PublicKey} from '@solana/web3.js';
import {SHIELDED_POOL_PROGRAM_ID} from '../../constants/programs';

const PROGRAM = new PublicKey(SHIELDED_POOL_PROGRAM_ID);
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const SPL_ATA_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

/** pool config PDA: ["pool", mint]. */
export function poolPda(mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('pool'), mint.toBuffer()], PROGRAM)[0];
}

/** merkle tree PDA: ["merkle", pool]. */
export function merkleTreePda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('merkle'), pool.toBuffer()], PROGRAM)[0];
}

/** nullifier marker PDA: ["nullifier", nullifier32] (the 32-byte field element BE). */
export function nullifierPda(nullifier32: Uint8Array): PublicKey {
  if (nullifier32.length !== 32) {
    throw new Error(`nullifierPda: expected 32 bytes, got ${nullifier32.length}`);
  }
  return PublicKey.findProgramAddressSync(
    [Buffer.from('nullifier'), Buffer.from(nullifier32)], PROGRAM)[0];
}

/**
 * Pool's vault token account = the off-curve ATA of the pool PDA for `mint`.
 * (allowOwnerOffCurve: the pool is a PDA, so its ATA is derived the same way but
 * the owner is not on the ed25519 curve — the ATA derivation itself is identical.)
 */
export function vaultAta(pool: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [pool.toBuffer(), SPL_TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    SPL_ATA_PROGRAM_ID)[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest poolPdas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/poolPdas.ts src/modules/shielded/__tests__/poolPdas.test.ts
git commit -m "feat(shielded): pool/merkle/nullifier/vault PDA derivations"
```

---

### Task 4: Shielded identity (view key → pkRecipientHash)

**Files:**
- Create: `src/modules/shielded/shieldedIdentity.ts`
- Test: `src/modules/shielded/__tests__/shieldedIdentity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/shieldedIdentity.test.ts
import {getViewPublicKey, getPkRecipientHash} from '../shieldedIdentity';
import {pkRecipientHash} from '../noteCrypto';
import {BN254_FIELD_PRIME} from '../../merkle/field';

// Deterministic 64-byte seed fixture.
const SEED = new Uint8Array(64).map((_v, i) => (i * 3 + 1) & 0xff);

describe('shieldedIdentity', () => {
  it('view pubkey is a 48-byte compressed G1, deterministic per seed', () => {
    const a = getViewPublicKey(SEED);
    const b = getViewPublicKey(SEED);
    expect(a.length).toBe(48);
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
  });
  it('pkRecipientHash = poseidon3(0x05, viewG1) and is a field element', () => {
    const h = getPkRecipientHash(SEED);
    expect(h).toBe(pkRecipientHash(getViewPublicKey(SEED)));
    expect(h < BN254_FIELD_PRIME).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest shieldedIdentity`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/shielded/shieldedIdentity.ts
import {bls12_381} from '@noble/curves/bls12-381.js';
import {deriveShieldedViewKey} from '../keyDerivation/shielded';
import {pkRecipientHash} from './noteCrypto';

/**
 * Derive the shielded VIEW public key (compressed 48-byte BLS12-381 G1) from the
 * BIP-39 seed. sk_view (EIP-2333 path m/12381/371/2/0) is JS-allowed (read-only;
 * cannot authorize spends). The note recipient identity is this view key — the
 * deployed circuits impose no key model, and spend authorization is knowledge of
 * noteSecret alone, so binding the note to the view key keeps sk_spend off the
 * proof path. See project_shielded_c2_contract memory.
 */
export function getViewPublicKey(seed: Uint8Array): Uint8Array {
  const skView = deriveShieldedViewKey(seed);
  return bls12_381.getPublicKey(skView); // 48-byte compressed G1 (short pubkeys)
}

/** pkRecipientHash = poseidon3(0x05, be(viewG1[0:24]), be(viewG1[24:48])). */
export function getPkRecipientHash(seed: Uint8Array): bigint {
  return pkRecipientHash(getViewPublicKey(seed));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest shieldedIdentity`
Expected: PASS. (If `bls12_381.getPublicKey` returns a non-48-byte form, switch to `bls12_381.G1.ProjectivePoint.fromPrivateKey(skView).toRawBytes(true)` — both yield the compressed G1; the 48-byte assertion guards this.)

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/shieldedIdentity.ts src/modules/shielded/__tests__/shieldedIdentity.test.ts
git commit -m "feat(shielded): view-key identity + pkRecipientHash (JS, native off proof path)"
```

---

### Task 5: `proveShielded` — hosted prove returning proofBytes

**Files:**
- Modify: `src/modules/zkProver/zkProverModule.ts` (add `proveShielded` + a params type)
- Modify: `src/modules/zkProver/types.ts` (add `ShieldedProveParams`)
- Test: `src/modules/zkProver/__tests__/proveShielded.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/zkProver/__tests__/proveShielded.test.ts
import {proveShielded} from '../zkProverModule';

jest.mock('../../sslPinning/pinnedFetch', () => ({
  pinnedFetch: jest.fn(),
}));
import {pinnedFetch} from '../../sslPinning/pinnedFetch';

const mockFetch = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;

describe('proveShielded', () => {
  beforeEach(() => mockFetch.mockReset());

  it('POSTs the full params (incl noteSecret) and returns proofBytes+publicInputs', async () => {
    mockFetch.mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        proofData: 'base64',
        proofBytes: 'ab'.repeat(256),
        publicInputs: ['1', '2', '3'],
      }),
    } as Response);

    const params = {commitment: '1', amount: '1000', mintHash: '2',
      pkRecipientHash: '3', noteSecret: '4'};
    const res = await proveShielded('deposit', params);

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({proofType: 'deposit', params}); // noteSecret NOT stripped
    expect(res.proofBytes).toBe('ab'.repeat(256));
    expect(res.publicInputs).toEqual(['1', '2', '3']);
  });

  it('throws on success:false', async () => {
    mockFetch.mockResolvedValue({
      status: 200, json: async () => ({success: false, error: 'bad'}),
    } as Response);
    await expect(proveShielded('deposit', {} as never)).rejects.toThrow('bad');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest proveShielded`
Expected: FAIL — `proveShielded` is not exported.

- [ ] **Step 3: Implement**

In `src/modules/zkProver/types.ts` add:

```ts
/**
 * Exact circuit input signals for a shielded proof (keys = circom main inputs).
 * All values are base-10 decimal strings of field elements < F. Sent VERBATIM to
 * /zk/prove — including noteSecret, which the circuit REQUIRES as a private input.
 */
export type ShieldedProveParams = Record<string, string | string[] | number[]>;

export interface ShieldedProveResult {
  proofBytes: string;        // hex, 256 B — on-chain-ready
  publicInputs: string[];    // decimal, circuit order
  proofData: string;         // base64 raw snarkjs proof
}
```

In `src/modules/zkProver/zkProverModule.ts` add (top-level export, alongside `zkProver`):

```ts
import type {ShieldedProveParams, ShieldedProveResult} from './types';

let _shieldedProveCallId = 0;

/**
 * Prove a shielded deposit/withdraw via the hosted coordinator and return the
 * on-chain-ready proofBytes.
 *
 * ⚠️ PRIVACY: these circuits require `noteSecret` as a private input, so it IS
 * sent to the coordinator (the user's own backend; never logged per contract).
 * This is POC-grade. MAINNET privacy REQUIRES local on-device proving so noteSecret
 * never leaves the device — see project_shielded_mainnet_blockers memory.
 */
export async function proveShielded(
  proofType: 'deposit' | 'withdraw',
  params: ShieldedProveParams,
): Promise<ShieldedProveResult> {
  const callKey = `shieldedProve:${proofType}:${++_shieldedProveCallId}`;
  const resp = await proveLimiter.execute(callKey, () =>
    pinnedFetch(`${API_BASE}/zk/prove`, {
      method: 'POST',
      body: JSON.stringify({proofType, params}),
    }),
  );
  if (resp.status !== 200) {
    throw new Error(`Shielded prover returned HTTP ${resp.status}`);
  }
  const data = (await resp.json()) as {
    success: boolean; proofData?: string; proofBytes?: string;
    publicInputs?: string[]; error?: string;
  };
  if (!data.success || !data.proofBytes || !data.publicInputs) {
    throw new Error(data.error ?? 'Shielded prover returned no proofBytes');
  }
  return {
    proofBytes: data.proofBytes,
    publicInputs: data.publicInputs,
    proofData: data.proofData ?? '',
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest proveShielded`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/zkProver/zkProverModule.ts src/modules/zkProver/types.ts src/modules/zkProver/__tests__/proveShielded.test.ts
git commit -m "feat(shielded): proveShielded hosted prove returning proofBytes (POC; mainnet=local)"
```

---

### Task 6: Build the deposit instruction

**Files:**
- Create: `src/modules/shielded/poolInstructions.ts`
- Test: `src/modules/shielded/__tests__/poolInstructions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/poolInstructions.test.ts
import {PublicKey} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {buildDepositIx, depositDiscriminator} from '../poolInstructions';
import {SHIELDED_POOL_PROGRAM_ID} from '../../../constants/programs';

const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
const A = (s: number) => new PublicKey(new Uint8Array(32).fill(s));

describe('buildDepositIx', () => {
  it('discriminator = sha256("global:deposit")[0:8]', () => {
    expect(Buffer.from(depositDiscriminator()).equals(
      Buffer.from(sha256(Buffer.from('global:deposit')).slice(0, 8)))).toBe(true);
  });

  it('data = disc(8)+amount(u64 LE)+commitment(32)+vec(len4 LE + 256)', () => {
    const commitment = new Uint8Array(32).fill(9);
    const proofBytes = new Uint8Array(256).fill(0xab);
    const ix = buildDepositIx({
      amount: 1_000_000_000n, commitment, proofBytes,
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    });
    expect(ix.programId.toBase58()).toBe(SHIELDED_POOL_PROGRAM_ID);
    expect(ix.data.length).toBe(8 + 8 + 32 + 4 + 256);
    // amount LE at offset 8
    expect(ix.data.readUInt8(8)).toBe(0x00);
    expect(ix.data.readUInt32LE(8)).toBe(0x3B9ACA00 & 0xffffffff); // 1e9 low word
    // vec length prefix at offset 8+8+32 = 48
    expect(ix.data.readUInt32LE(48)).toBe(256);
  });

  it('account metas in program order with correct flags', () => {
    const ix = buildDepositIx({
      amount: 1n, commitment: new Uint8Array(32), proofBytes: new Uint8Array(256),
      pool: A(1), merkleTree: A(2), vault: A(3),
      depositor: A(4), depositorTokenAccount: A(5),
    });
    expect(ix.keys.map(k => [k.isSigner, k.isWritable])).toEqual([
      [false, false], // pool
      [false, true],  // merkle_tree (mut)
      [false, true],  // vault (mut)
      [true, false],  // depositor (signer; fee payer promotes writable at msg level)
      [false, true],  // depositor_token_account (mut)
      [false, false], // token_program
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest poolInstructions`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/shielded/poolInstructions.ts
import {PublicKey, TransactionInstruction} from '@solana/web3.js';
import {sha256} from '@noble/hashes/sha2.js';
import {SHIELDED_POOL_PROGRAM_ID} from '../../constants/programs';

const PROGRAM = new PublicKey(SHIELDED_POOL_PROGRAM_ID);
const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');

/** Anchor global instruction discriminator: sha256("global:<name>")[0:8]. */
function discriminator(name: string): Uint8Array {
  return sha256(Buffer.from(`global:${name}`)).slice(0, 8);
}
export const depositDiscriminator = (): Uint8Array => discriminator('deposit');

/** Encode a u64 as 8 little-endian bytes. Hermes Buffer lacks writeBigUInt64LE. */
function u64le(value: bigint): Uint8Array {
  if (value < 0n || value > 18_446_744_073_709_551_615n) {
    throw new Error(`u64le: out of range: ${value}`);
  }
  const out = new Uint8Array(8);
  let v = value;
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/** Encode a u32 as 4 little-endian bytes (Borsh Vec<u8> length prefix). */
function u32le(value: number): Uint8Array {
  const out = new Uint8Array(4);
  out[0] = value & 0xff;
  out[1] = (value >> 8) & 0xff;
  out[2] = (value >> 16) & 0xff;
  out[3] = (value >> 24) & 0xff;
  return out;
}

export interface DepositIxParams {
  amount: bigint;
  commitment: Uint8Array;   // 32 bytes
  proofBytes: Uint8Array;   // 256 bytes
  pool: PublicKey;
  merkleTree: PublicKey;
  vault: PublicKey;
  depositor: PublicKey;     // = fee_payer (transparent keypair)
  depositorTokenAccount: PublicKey;
}

/**
 * deposit(amount: u64, commitment: [u8;32], proof_bytes: Vec<u8>).
 * Data = disc(8) + amount(u64 LE) + commitment(32) + len(u32 LE) + proof_bytes.
 * Accounts (DepositCtx order): pool(ro), merkle_tree(mut), vault(mut),
 * depositor(signer), depositor_token_account(mut), token_program(ro).
 */
export function buildDepositIx(p: DepositIxParams): TransactionInstruction {
  if (p.commitment.length !== 32) throw new Error('commitment must be 32 bytes');
  if (p.proofBytes.length !== 256) throw new Error('proofBytes must be 256 bytes');

  const data = Buffer.concat([
    Buffer.from(depositDiscriminator()),
    Buffer.from(u64le(p.amount)),
    Buffer.from(p.commitment),
    Buffer.from(u32le(p.proofBytes.length)),
    Buffer.from(p.proofBytes),
  ]);

  return new TransactionInstruction({
    programId: PROGRAM,
    keys: [
      {pubkey: p.pool, isSigner: false, isWritable: false},
      {pubkey: p.merkleTree, isSigner: false, isWritable: true},
      {pubkey: p.vault, isSigner: false, isWritable: true},
      {pubkey: p.depositor, isSigner: true, isWritable: false},
      {pubkey: p.depositorTokenAccount, isSigner: false, isWritable: true},
      {pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false},
    ],
    data,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest poolInstructions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/poolInstructions.ts src/modules/shielded/__tests__/poolInstructions.test.ts
git commit -m "feat(shielded): manual deposit instruction builder (disc + borsh + metas)"
```

---

### Task 7: Self-relay submit (wraps signAndSend)

**Files:**
- Create: `src/modules/shielded/poolTx.ts`
- Test: `src/modules/shielded/__tests__/poolTx.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/poolTx.test.ts
import {Keypair, ComputeBudgetProgram} from '@solana/web3.js';
import {submitPoolTx} from '../poolTx';

jest.mock('../../solana/signAndSend', () => ({signAndSend: jest.fn()}));
jest.mock('../../solana/connection', () => ({getConnection: jest.fn(() => ({}))}));
import {signAndSend} from '../../solana/signAndSend';
const mockSAS = signAndSend as jest.MockedFunction<typeof signAndSend>;

describe('submitPoolTx', () => {
  it('prepends a ComputeBudget limit ix and passes payer+signer', async () => {
    mockSAS.mockResolvedValue({signature: 'sig123', confirmationStatus: 'confirmed'});
    const kp = Keypair.generate();
    const poolIx = ComputeBudgetProgram.setComputeUnitPrice({microLamports: 1}); // any ix
    const sig = await submitPoolTx(poolIx, 200_000, kp);
    expect(sig).toBe('sig123');
    const spec = mockSAS.mock.calls[0][1];
    expect(spec.payer.equals(kp.publicKey)).toBe(true);
    expect(spec.instructions).toHaveLength(2); // [computeBudget, poolIx]
    expect(mockSAS.mock.calls[0][2][0]).toBe(kp); // signer
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest poolTx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/shielded/poolTx.ts
import {ComputeBudgetProgram, type Keypair, type TransactionInstruction} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {signAndSend} from '../solana/signAndSend';

/**
 * Self-relay: prepend a ComputeBudget limit, sign as fee_payer, submit + confirm.
 * Reuses signAndSend (blockhash retry + confirmation). Returns the signature.
 */
export async function submitPoolTx(
  poolIx: TransactionInstruction,
  computeUnitLimit: number,
  feePayer: Keypair,
): Promise<string> {
  const connection = getConnection();
  const instructions = [
    ComputeBudgetProgram.setComputeUnitLimit({units: computeUnitLimit}),
    poolIx,
  ];
  const {signature} = await signAndSend(
    connection,
    {payer: feePayer.publicKey, instructions},
    [feePayer],
  );
  return signature;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest poolTx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/poolTx.ts src/modules/shielded/__tests__/poolTx.test.ts
git commit -m "feat(shielded): self-relay submit via signAndSend + ComputeBudget"
```

---

### Task 8: Deposit witness builder

**Files:**
- Create: `src/modules/shielded/depositWitness.ts`
- Test: `src/modules/shielded/__tests__/depositWitness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/depositWitness.test.ts
import {PublicKey} from '@solana/web3.js';
import {buildDepositNote} from '../depositWitness';
import {getPkRecipientHash} from '../shieldedIdentity';
import {mintHash, noteCommitment} from '../noteCrypto';

const SEED = new Uint8Array(64).map((_v, i) => (i * 5 + 2) & 0xff);
const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');

describe('buildDepositNote', () => {
  it('produces circuit params matching the canonical encodings', () => {
    const {params, note} = buildDepositNote(SEED, 1_000_000_000n, MINT);
    const pkH = getPkRecipientHash(SEED);
    const mH = mintHash(MINT.toBytes());
    const expectedCommitment = noteCommitment({
      pkRecipientHash: pkH, amount: 1_000_000_000n, mintHash: mH,
      noteSecret: BigInt(note.noteSecret),
    });
    expect(params.commitment).toBe(expectedCommitment.toString());
    expect(params.amount).toBe('1000000000');
    expect(params.mintHash).toBe(mH.toString());
    expect(params.pkRecipientHash).toBe(pkH.toString());
    expect(params.noteSecret).toBe(note.noteSecret);
    expect(note.commitment).toBe(expectedCommitment.toString());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest depositWitness`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/shielded/depositWitness.ts
import type {PublicKey} from '@solana/web3.js';
import {mintHash, noteCommitment, randomFieldElement} from './noteCrypto';
import {getPkRecipientHash} from './shieldedIdentity';
import type {ShieldedProveParams} from '../zkProver/types';

export interface DepositNote {
  commitment: string;   // decimal
  noteSecret: string;   // decimal (stored locally; the spend secret)
  amount: bigint;
  mint: string;
}

/**
 * Build a fresh deposit note + the exact /zk/prove params for it.
 * noteSecret is random (< F) and stored locally — it is the spend secret.
 * See project_shielded_c2_contract for the encoding/key model.
 */
export function buildDepositNote(
  seed: Uint8Array,
  amount: bigint,
  mint: PublicKey,
): {params: ShieldedProveParams; note: DepositNote} {
  const pkH = getPkRecipientHash(seed);
  const mH = mintHash(mint.toBytes());
  const noteSecret = randomFieldElement();
  const commitment = noteCommitment({
    pkRecipientHash: pkH, amount, mintHash: mH, noteSecret,
  });
  const params: ShieldedProveParams = {
    commitment: commitment.toString(),
    amount: amount.toString(),
    mintHash: mH.toString(),
    pkRecipientHash: pkH.toString(),
    noteSecret: noteSecret.toString(),
  };
  return {
    params,
    note: {
      commitment: commitment.toString(),
      noteSecret: noteSecret.toString(),
      amount,
      mint: mint.toBase58(),
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest depositWitness`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/depositWitness.ts src/modules/shielded/__tests__/depositWitness.test.ts
git commit -m "feat(shielded): deposit witness + note builder (canonical encodings)"
```

---

### Task 9: Wire the deposit flow end-to-end

**Files:**
- Create: `src/modules/shielded/depositFlow.ts`
- Test: `src/modules/shielded/__tests__/depositFlow.test.ts`

This module replaces the relayer-based `shieldedService.deposit` for the self-relay path. (The old `deposit` in `shieldedService.ts` and its `submitToRelayer`/`makeResultNote` are removed in Task 10 once the screen is rewired.)

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/depositFlow.test.ts
import {PublicKey, Keypair} from '@solana/web3.js';
import {parseDepositLeafIndex} from '../depositFlow';

describe('parseDepositLeafIndex', () => {
  it('reads leaf_index (u64 LE) from the Deposit event Program data log', () => {
    // Anchor event = 8-byte disc + commitment(32) + leaf_index(u64 LE) + root(32)
    const disc = new Uint8Array(8).fill(1);
    const commitment = new Uint8Array(32).fill(2);
    const leaf = new Uint8Array(8); leaf[0] = 5; // leaf_index = 5
    const root = new Uint8Array(32).fill(3);
    const buf = Buffer.concat([Buffer.from(disc), Buffer.from(commitment),
      Buffer.from(leaf), Buffer.from(root)]);
    const logs = [`Program data: ${buf.toString('base64')}`];
    expect(parseDepositLeafIndex(logs)).toBe(5);
  });
  it('throws when no Deposit event log is present', () => {
    expect(() => parseDepositLeafIndex(['Program log: hi'])).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest depositFlow`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/modules/shielded/depositFlow.ts
import {PublicKey, type Keypair} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {proveShielded} from '../zkProver/zkProverModule';
import {buildDepositNote} from './depositWitness';
import {buildDepositIx} from './poolInstructions';
import {submitPoolTx} from './poolTx';
import {poolPda, merkleTreePda, vaultAta} from './poolPdas';
import {resolveSourceTokenAccount} from '../solana/transactionBuilder';
import {addNote} from './noteStore';
import {SHIELDED_CU} from '../../constants/programs';

const PROOF_BYTES_LEN = 256;

/** Decimal field-element string -> 32-byte big-endian Uint8Array. */
function decToBe32(dec: string): Uint8Array {
  let v = BigInt(dec);
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {out[i] = Number(v & 0xffn); v >>= 8n;}
  return out;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

/**
 * Parse leaf_index from the Deposit event in the tx log messages.
 * Anchor event layout: 8-byte disc + commitment[32] + leaf_index(u64 LE) + root[32].
 * Returns the leaf index as a number (safe: tree has < 2^20 leaves).
 */
export function parseDepositLeafIndex(logs: string[]): number {
  for (const line of logs) {
    const m = line.match(/^Program data: (.+)$/);
    if (!m) continue;
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length < 8 + 32 + 8 + 32) continue;
    let idx = 0n;
    for (let i = 0; i < 8; i++) idx |= BigInt(buf[8 + 32 + i]) << BigInt(8 * i);
    return Number(idx);
  }
  throw new Error('Deposit event not found in transaction logs');
}

export interface DepositResult {txSignature: string; leafIndex: number; amount: bigint;}

/**
 * Shield `amount` of `mint` into the pool. Self-relay: the transparent keypair is
 * the depositor + fee_payer. Stores the real note with its on-chain leaf_index.
 */
export async function depositShield(
  seed: Uint8Array,
  feePayer: Keypair,
  mintBase58: string,
  amount: bigint,
): Promise<DepositResult> {
  const mint = new PublicKey(mintBase58);
  const {params, note} = buildDepositNote(seed, amount, mint);

  const proof = await proveShielded('deposit', params);
  const proofBytes = hexToBytes(proof.proofBytes);
  if (proofBytes.length !== PROOF_BYTES_LEN) {
    throw new Error(`proofBytes must be ${PROOF_BYTES_LEN} bytes`);
  }

  const pool = poolPda(mint);
  const connection = getConnection();
  const depositorTokenAccount = await resolveSourceTokenAccount(
    connection, feePayer.publicKey, mint);
  if (!depositorTokenAccount) {
    throw new Error('No token account holds the mint to shield');
  }

  const ix = buildDepositIx({
    amount,
    commitment: decToBe32(note.commitment),
    proofBytes,
    pool,
    merkleTree: merkleTreePda(pool),
    vault: vaultAta(pool, mint),
    depositor: feePayer.publicKey,
    depositorTokenAccount,
  });

  const txSignature = await submitPoolTx(ix, SHIELDED_CU.deposit, feePayer);

  const tx = await connection.getTransaction(txSignature, {
    maxSupportedTransactionVersion: 0, commitment: 'confirmed',
  });
  const leafIndex = parseDepositLeafIndex(tx?.meta?.logMessages ?? []);

  addNote({
    commitment: note.commitment,
    nullifier: '', // computed at withdraw time from noteSecret + leafIndex
    mint: mintBase58,
    amount,
    index: leafIndex,
    spent: false,
    createdAt: Date.now(),
    // noteSecret persisted via the note store extension (Task 10 wires storage of it)
    noteSecret: note.noteSecret,
  } as never);

  return {txSignature, leafIndex, amount};
}
```

> **Note for the implementer:** `ShieldedNote` currently has no `noteSecret` field. Task 10 adds `noteSecret: string` to `ShieldedNote`/`ShieldedNoteJson` (and the MMKV (de)serialization in `noteStore.ts`) so the spend secret survives — withdraw needs it. Until then the `as never` cast keeps Task 9 compiling; Task 10 removes it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest depositFlow`
Expected: PASS (the unit test covers `parseDepositLeafIndex`; the full `depositShield` is exercised on-device in Task 11).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/depositFlow.ts src/modules/shielded/__tests__/depositFlow.test.ts
git commit -m "feat(shielded): end-to-end deposit (shield) self-relay flow"
```

---

### Task 10: Persist noteSecret + rewire the Deposit screen

**Files:**
- Modify: `src/modules/shielded/types.ts` (add `noteSecret` to `ShieldedNote`/`ShieldedNoteJson`)
- Modify: `src/modules/shielded/noteStore.ts` ((de)serialize `noteSecret`)
- Modify: `src/screens/shielded/DepositScreen.tsx` (call `depositShield` instead of the relayer `deposit`)
- Test: `src/modules/shielded/__tests__/noteStore.test.ts` (extend — round-trip `noteSecret`)

- [ ] **Step 1: Write the failing test**

```ts
// add to src/modules/shielded/__tests__/noteStore.test.ts
import {addNote, getNotes, clearMint} from '../noteStore';

it('round-trips noteSecret through MMKV (de)serialization', () => {
  const mint = 'MintForSecretTest1111111111111111111111111';
  clearMint(mint);
  addNote({commitment: 'c1', nullifier: '', mint, amount: 5n, index: 0,
    spent: false, createdAt: 1, noteSecret: 'secret-123'});
  expect(getNotes(mint)[0].noteSecret).toBe('secret-123');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest noteStore`
Expected: FAIL — `noteSecret` is not preserved (type error / undefined).

- [ ] **Step 3: Implement**

In `src/modules/shielded/types.ts` add `noteSecret: string;` to both `ShieldedNote` and `ShieldedNoteJson`. In `noteStore.ts` include `noteSecret` in the to-JSON and from-JSON mappers (it is already a string, so it maps verbatim alongside `commitment`).

In `src/screens/shielded/DepositScreen.tsx`, replace the `shieldedService.deposit(...)` call with the self-relay flow: retrieve the seed (existing keychain retrieval used by the transparent send), derive the fee-payer keypair (`deriveTransparentKeypair` + `Keypair.fromSecretKey`), and call `depositShield(seed, feePayer, SHIELDED_DEVNET_MINT, amount)`. Surface `result.txSignature` to the existing success state. Remove the `as never` cast in `depositFlow.ts` now that `ShieldedNote` carries `noteSecret`.

- [ ] **Step 4: Run tests + typecheck**

Run: `npx jest noteStore depositFlow && npx tsc --noEmit`
Expected: PASS; tsc clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/types.ts src/modules/shielded/noteStore.ts src/modules/shielded/depositFlow.ts src/screens/shielded/DepositScreen.tsx src/modules/shielded/__tests__/noteStore.test.ts
git commit -m "feat(shielded): persist noteSecret + wire Deposit screen to self-relay shield"
```

---

### Task 11: Devnet build config + on-device verification

**Files:**
- Modify: `.env.devnet` (create/confirm) — `RPC_ENDPOINT` (devnet Helius/Alchemy), `SHIELDED_DEVNET_MINT`
- Modify: `src/constants/features.ts` — note the devnet build flips `shielded: true`
- Reference: `docs/NATIVE_INTEGRATION_TODO.md` (devnet build/sideload steps already documented for the transparent devnet APK)

- [ ] **Step 1: Confirm the devnet test mint with the ICO Claude**

The pool was `initialize_pool`'d for a specific devnet test mint. Get that mint address + fund the test wallet's token account for it (ICO Claude offered help). Put the mint in `.env.devnet` as `SHIELDED_DEVNET_MINT`.

- [ ] **Step 2: Build the devnet APK with shielded enabled**

Set `FEATURES.shielded = true` for the devnet build only (do NOT commit it true on the mainnet build path). Build:

```bash
ENVFILE=.env.devnet npx react-native run-android --mode=release --no-packager
```
(Match the existing devnet APK build/sideload procedure.)

- [ ] **Step 3: On-device deposit (shield) test**

Shield a small amount. Verify:
- the tx confirms on devnet (Solana explorer, devnet cluster);
- the pool `vault` token balance increased by `amount`;
- a real note is stored (`getNotes` shows `commitment` + `noteSecret` + `index === leaf_index` from the event);
- capture the actual deposit CU from the explorer to confirm `SHIELDED_CU.deposit` headroom.

- [ ] **Step 4: Commit any config**

```bash
git add .env.devnet
git commit -m "chore(shielded): devnet build config for shield testing"
```

> The withdraw (unshield) path is a SEPARATE plan/PR (`merkleSync` + `withdrawWitness` + `buildWithdrawIx` + nullifier check + dest-ATA pre-create). Deposit ships first.

---

## Self-Review

**1. Spec coverage:** constants/devnet build (Task 1, 11), view-key identity + pkRecipientHash JS (Task 4), random noteSecret (Task 2), PDAs (Task 3), proofBytes + noteSecret-to-prover (Task 5), manual deposit ix with exact metas (Task 6), self-relay via signAndSend (Task 7), canonical witness (Task 8), end-to-end flow + leaf_index from event (Task 9), note persistence + screen wiring (Task 10), on-device devnet test (Task 11). Withdraw/merkle-sync explicitly deferred to the next plan (matches the split decision). ✓

**2. Placeholder scan:** No TBD/TODO; every code step has complete code. The one forward-reference (`noteSecret` on `ShieldedNote`) is explicitly flagged in Task 9 and resolved in Task 10. ✓

**3. Type consistency:** `ShieldedProveParams`/`ShieldedProveResult` (Task 5) used by `proveShielded` (Task 5), `buildDepositNote` (Task 8), `depositShield` (Task 9). `DepositIxParams` (Task 6) matches the `buildDepositIx` call in Task 9. `SHIELDED_CU.deposit` (Task 1) used in Task 9. PDA fns (Task 3) used in Task 9. `noteSecret` added to `ShieldedNote` (Task 10) consumed by Task 9's `addNote`. ✓

**4. Account flags** verified against `programs/shielded-pool/src/lib.rs` DepositCtx (`merkle_tree`/`vault`/`depositor_token_account` mut; `pool`/`token_program` ro; `depositor` signer). ✓
