# ZK Witness Encoding & Prover Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the wallet's ZK field-encoding conventions (commitment, nullifier, pk/mint hash) as canonical pure-TS source-of-truth, emit golden-vector fixtures as the binding contract, and fix two latent defects (API path inconsistency, error-code collision).

**Architecture:** A new pure module `src/modules/shielded/noteCrypto.ts` implements deterministic Poseidon-over-BN254 encoding, reusing `BN254_FIELD_PRIME`/`toFieldElement` from `merkleModule`. A generator test writes/asserts `docs/zk-contract/golden-vectors.json` so code stays the source and JSON the pinned contract (drift fails CI). All secret inputs are parameters — no native, no network.

**Tech Stack:** TypeScript (strict), `poseidon-lite ^0.3.0` (`poseidon3`/`poseidon5`), `@scure/base` (base58 for mint decode, bech32m via existing codec), Jest.

**Reference spec:** `docs/superpowers/specs/2026-05-31-zk-witness-encoding-contract-design.md`

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/modules/merkle/merkleModule.ts` (modify) | Export `toFieldElement` (currently private) for reuse |
| `src/modules/shielded/noteCrypto.ts` (create) | Canonical encoding: `bytesToBigIntBE`, `assertField`, `pkRecipientHash`, `mintHash`, `noteCommitment`, `nullifier` |
| `src/modules/shielded/__tests__/noteCrypto.test.ts` (create) | Unit tests for each primitive + address round-trip cross-check |
| `src/modules/shielded/__tests__/noteCrypto.golden.test.ts` (create) | Generator/verifier guard over the golden JSON |
| `docs/zk-contract/golden-vectors.json` (create, generated) | Pinned binding contract for ZK/backend team |
| `docs/zk-contract/zk-witness-encoding-contract.md` (create) | Human-readable contract + ratification checklist |
| `src/modules/zkProver/zkProverModule.ts` (modify) | Normalize prove path to `/v1/zk/prove` |
| `src/modules/zkProver/types.ts` (modify) | Fix error-code collision (E060→E032, E061→E030) |
| `docs/NATIVE_INTEGRATION_TODO.md` (modify) | Reframe #1 from "match circuit" to "circuit matches our spec" |

---

## Task 1: Export `toFieldElement` from merkleModule

`noteCrypto` reuses the existing big-endian-hex→field conversion with its `< F` range
check. It is currently a private `function` — export it.

**Files:**
- Modify: `src/modules/merkle/merkleModule.ts:30`
- Test: `src/modules/merkle/__tests__/merkleModule.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/modules/merkle/__tests__/merkleModule.test.ts`:

```ts
import {toFieldElement, BN254_FIELD_PRIME} from '../merkleModule';

describe('toFieldElement (exported)', () => {
  it('parses a big-endian hex string to a field element', () => {
    expect(toFieldElement('0a')).toBe(10n);
  });

  it('rejects a value >= BN254_FIELD_PRIME', () => {
    const overF = BN254_FIELD_PRIME.toString(16);
    expect(() => toFieldElement(overF)).toThrow(/not a valid BN254 field element/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=merkleModule -t "toFieldElement"`
Expected: FAIL — `toFieldElement` is not exported (TS2305 / undefined import).

- [ ] **Step 3: Add the export**

In `src/modules/merkle/merkleModule.ts` line 30, change:

```ts
function toFieldElement(hex: string): bigint {
```

to:

```ts
export function toFieldElement(hex: string): bigint {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=merkleModule -t "toFieldElement"`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add src/modules/merkle/merkleModule.ts src/modules/merkle/__tests__/merkleModule.test.ts
git commit -m "refactor(merkle): export toFieldElement for noteCrypto reuse"
```

---

## Task 2: `noteCrypto` field helpers + `pkRecipientHash`

**Files:**
- Create: `src/modules/shielded/noteCrypto.ts`
- Test: `src/modules/shielded/__tests__/noteCrypto.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/shielded/__tests__/noteCrypto.test.ts`:

```ts
import {bytesToBigIntBE, pkRecipientHash} from '../noteCrypto';

// BLS12-381 G1 generator, compressed (48 bytes / 96 hex chars).
const G1_GEN_HEX =
  '97f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

describe('bytesToBigIntBE', () => {
  it('reads bytes big-endian', () => {
    expect(bytesToBigIntBE(new Uint8Array([0x01, 0x00]))).toBe(256n);
    expect(bytesToBigIntBE(new Uint8Array([0xff]))).toBe(255n);
    expect(bytesToBigIntBE(new Uint8Array([]))).toBe(0n);
  });
});

describe('pkRecipientHash', () => {
  it('throws on wrong length', () => {
    expect(() => pkRecipientHash(new Uint8Array(47))).toThrow(/48 bytes/);
  });

  it('is deterministic and a valid field element for the G1 generator', () => {
    const pk = hexToBytes(G1_GEN_HEX);
    const a = pkRecipientHash(pk);
    const b = pkRecipientHash(pk);
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0n);
  });

  it('splits 24/24 big-endian (hi from first 24 bytes, lo from last 24)', () => {
    const pk = hexToBytes(G1_GEN_HEX);
    const hi = bytesToBigIntBE(pk.subarray(0, 24));
    const lo = bytesToBigIntBE(pk.subarray(24, 48));
    // First byte 0x97 dominates the high half.
    expect(hi).toBeGreaterThan(lo === 0n ? 0n : 0n);
    expect(hi.toString(16).startsWith('97')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=noteCrypto.test`
Expected: FAIL — cannot find module `../noteCrypto`.

- [ ] **Step 3: Create the module**

Create `src/modules/shielded/noteCrypto.ts`:

```ts
import {poseidon3} from 'poseidon-lite';
import {BN254_FIELD_PRIME} from '../merkle/merkleModule';

// ---- Domain separators (first input to each Poseidon) --------------------
// 0x01 = note commitment, 0x02 = nullifier, 0x05 = pk_recipient hash.
// Merkle node hashes are intentionally UNTAGGED (poseidon2) — already shipped.
// DOMAIN_COMMITMENT / DOMAIN_NULLIFIER and poseidon5 are added in Tasks 4–5.
const DOMAIN_PK = 0x05n;

const PK_G1_BYTES = 48;

/**
 * Big-endian byte array -> BigInt. No reduction, no range check.
 * Endianness is fixed and canonical: byte[0] is most significant.
 */
export function bytesToBigIntBE(bytes: Uint8Array): bigint {
  let acc = 0n;
  for (let i = 0; i < bytes.length; i++) {
    acc = (acc << 8n) | BigInt(bytes[i]!);
  }
  return acc;
}

/** Throw if x is not a canonical BN254 field element (0 <= x < F). */
export function assertField(x: bigint, name: string): bigint {
  if (x < 0n || x >= BN254_FIELD_PRIME) {
    throw new Error(`noteCrypto: ${name} is not a valid BN254 field element`);
  }
  return x;
}

/**
 * Hash a 48-byte BLS12-381 G1 compressed public key to one field element.
 * Split big-endian into 24/24 halves (each < 2^192 < F, no reduction needed),
 * then poseidon3(0x05, pk_hi, pk_lo).
 */
export function pkRecipientHash(pkG1: Uint8Array): bigint {
  if (pkG1.length !== PK_G1_BYTES) {
    throw new Error(`pkRecipientHash: expected 48 bytes, got ${pkG1.length}`);
  }
  const pkHi = bytesToBigIntBE(pkG1.subarray(0, 24));
  const pkLo = bytesToBigIntBE(pkG1.subarray(24, 48));
  return poseidon3([DOMAIN_PK, pkHi, pkLo]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=noteCrypto.test`
Expected: PASS.

- [ ] **Step 5: Type-check + lint (must be green to commit)**

Run: `npx tsc --noEmit && npx eslint src/modules/shielded/noteCrypto.ts`
Expected: no errors. Only symbols used by this task are declared, so no unused-vars.

- [ ] **Step 6: Commit**

```bash
git add src/modules/shielded/noteCrypto.ts src/modules/shielded/__tests__/noteCrypto.test.ts
git commit -m "feat(zk): noteCrypto field helpers + pkRecipientHash"
```

---

## Task 3: `mintHash`

**Files:**
- Modify: `src/modules/shielded/noteCrypto.ts`
- Test: `src/modules/shielded/__tests__/noteCrypto.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/modules/shielded/__tests__/noteCrypto.test.ts`:

```ts
import {mintHash} from '../noteCrypto';
import {base58} from '@scure/base';
import {BN254_FIELD_PRIME} from '../../merkle/merkleModule';

describe('mintHash', () => {
  it('throws on wrong length', () => {
    expect(() => mintHash(new Uint8Array(31))).toThrow(/32 bytes/);
  });

  it('reduces NOC_MINT into the field', () => {
    const mint = base58.decode('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
    expect(mint.length).toBe(32);
    const h = mintHash(mint);
    expect(h).toBeGreaterThanOrEqual(0n);
    expect(h).toBeLessThan(BN254_FIELD_PRIME);
  });

  it('reduces an all-0xFF mint (value > F) below F', () => {
    const allFf = new Uint8Array(32).fill(0xff);
    const h = mintHash(allFf);
    expect(h).toBeLessThan(BN254_FIELD_PRIME);
    // 2^256 - 1 mod F, computed independently:
    const expected = ((1n << 256n) - 1n) % BN254_FIELD_PRIME;
    expect(h).toBe(expected);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=noteCrypto.test -t "mintHash"`
Expected: FAIL — `mintHash` is not exported.

- [ ] **Step 3: Implement `mintHash`**

Append to `src/modules/shielded/noteCrypto.ts`:

```ts
const MINT_BYTES = 32;

/**
 * Hash a 32-byte Solana mint pubkey to a field element.
 * Big-endian -> BigInt -> mod F. Plain modular reduction (no Poseidon):
 * 32 bytes may exceed F, so reduction is mandatory.
 */
export function mintHash(mint: Uint8Array): bigint {
  if (mint.length !== MINT_BYTES) {
    throw new Error(`mintHash: expected 32 bytes, got ${mint.length}`);
  }
  return bytesToBigIntBE(mint) % BN254_FIELD_PRIME;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=noteCrypto.test -t "mintHash"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/noteCrypto.ts src/modules/shielded/__tests__/noteCrypto.test.ts
git commit -m "feat(zk): mintHash field reduction"
```

---

## Task 4: `noteCommitment`

**Files:**
- Modify: `src/modules/shielded/noteCrypto.ts`
- Test: `src/modules/shielded/__tests__/noteCrypto.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/modules/shielded/__tests__/noteCrypto.test.ts`:

```ts
import {noteCommitment} from '../noteCrypto';

describe('noteCommitment', () => {
  const base = {
    pkRecipientHash: 111n,
    amount: 1_000_000_000n,
    mintHash: 222n,
    noteSecret: 333n,
  };

  it('is deterministic', () => {
    expect(noteCommitment(base)).toBe(noteCommitment({...base}));
  });

  it('changes when any input changes', () => {
    const c0 = noteCommitment(base);
    expect(noteCommitment({...base, amount: base.amount + 1n})).not.toBe(c0);
    expect(noteCommitment({...base, noteSecret: 334n})).not.toBe(c0);
  });

  it('rejects a noteSecret outside the field', () => {
    expect(() =>
      noteCommitment({...base, noteSecret: BN254_FIELD_PRIME}),
    ).toThrow(/not a valid BN254 field element/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=noteCrypto.test -t "noteCommitment"`
Expected: FAIL — `noteCommitment` is not exported.

- [ ] **Step 3: Implement `noteCommitment`**

First update the import line at the top of `src/modules/shielded/noteCrypto.ts` to add
`poseidon5`:

```ts
import {poseidon3, poseidon5} from 'poseidon-lite';
```

Then append to `src/modules/shielded/noteCrypto.ts`:

```ts
const DOMAIN_COMMITMENT = 0x01n;

export interface NoteCommitmentInput {
  /** Output of pkRecipientHash (already a field element). */
  pkRecipientHash: bigint;
  /** Amount in lamports (field element, < 2^64 << F). */
  amount: bigint;
  /** Output of mintHash (already reduced into the field). */
  mintHash: bigint;
  /** Blinding secret derived from sk_view (native); field element. */
  noteSecret: bigint;
}

/**
 * Note commitment: poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret).
 * All inputs are validated as canonical field elements first.
 */
export function noteCommitment(input: NoteCommitmentInput): bigint {
  return poseidon5([
    DOMAIN_COMMITMENT,
    assertField(input.pkRecipientHash, 'pkRecipientHash'),
    assertField(input.amount, 'amount'),
    assertField(input.mintHash, 'mintHash'),
    assertField(input.noteSecret, 'noteSecret'),
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=noteCrypto.test -t "noteCommitment"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/noteCrypto.ts src/modules/shielded/__tests__/noteCrypto.test.ts
git commit -m "feat(zk): noteCommitment poseidon5"
```

---

## Task 5: `nullifier`

**Files:**
- Modify: `src/modules/shielded/noteCrypto.ts`
- Test: `src/modules/shielded/__tests__/noteCrypto.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/modules/shielded/__tests__/noteCrypto.test.ts`:

```ts
import {nullifier} from '../noteCrypto';

describe('nullifier', () => {
  it('is deterministic for the same secret + index', () => {
    const a = nullifier({noteSecret: 333n, leafIndex: 7});
    const b = nullifier({noteSecret: 333n, leafIndex: 7n});
    expect(a).toBe(b);
  });

  it('differs across leaf positions (binds to tree position)', () => {
    expect(nullifier({noteSecret: 333n, leafIndex: 7})).not.toBe(
      nullifier({noteSecret: 333n, leafIndex: 8}),
    );
  });

  it('rejects a noteSecret outside the field', () => {
    expect(() =>
      nullifier({noteSecret: BN254_FIELD_PRIME, leafIndex: 0}),
    ).toThrow(/not a valid BN254 field element/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=noteCrypto.test -t "nullifier"`
Expected: FAIL — `nullifier` is not exported.

- [ ] **Step 3: Implement `nullifier`**

Append to `src/modules/shielded/noteCrypto.ts`:

```ts
const DOMAIN_NULLIFIER = 0x02n;

export interface NullifierInput {
  /** Blinding secret derived from sk_view (native); field element. */
  noteSecret: bigint;
  /** Position of the note's commitment leaf in the Merkle tree. */
  leafIndex: number | bigint;
}

/**
 * Nullifier: poseidon3(0x02, noteSecret, leafIndex).
 * JS-computable from view material, enabling spent-note detection during scan.
 * Spend AUTHORIZATION is separate (ZK proof + native BLS sk_spend signature);
 * the nullifier is only the uniqueness tag bound to the note's tree position.
 */
export function nullifier(input: NullifierInput): bigint {
  return poseidon3([
    DOMAIN_NULLIFIER,
    assertField(input.noteSecret, 'noteSecret'),
    assertField(BigInt(input.leafIndex), 'leafIndex'),
  ]);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=noteCrypto.test -t "nullifier"`
Expected: PASS.

- [ ] **Step 5: Full module type-check + lint**

Run: `npx tsc --noEmit && npx eslint src/modules/shielded/noteCrypto.ts`
Expected: no errors (all declared constants are now consumed).

- [ ] **Step 6: Commit**

```bash
git add src/modules/shielded/noteCrypto.ts src/modules/shielded/__tests__/noteCrypto.test.ts
git commit -m "feat(zk): nullifier poseidon3"
```

---

## Task 6: Address round-trip cross-check

Prove the encoding consumes the exact 48 bytes that `decodeShieldedAddress` produces:
encode the G1 generator → `noc1…` address → decode → `pkRecipientHash`.

**Files:**
- Test: `src/modules/shielded/__tests__/noteCrypto.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/modules/shielded/__tests__/noteCrypto.test.ts`:

```ts
import {
  encodeShieldedAddress,
  decodeShieldedAddress,
} from '../shieldedAddressCodec';

describe('pkRecipientHash <-> shielded address round-trip', () => {
  it('hashes the decoded address bytes identically to the raw G1 bytes', () => {
    const raw = hexToBytes(G1_GEN_HEX);
    const addr = encodeShieldedAddress(raw);
    expect(addr.startsWith('noc1')).toBe(true);
    const decoded = decodeShieldedAddress(addr);
    expect(pkRecipientHash(decoded)).toBe(pkRecipientHash(raw));
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npx jest --testPathPattern=noteCrypto.test -t "round-trip"`
Expected: PASS (all dependencies already implemented). This test guards against a
future codec change silently breaking the encoding contract.

- [ ] **Step 3: Commit**

```bash
git add src/modules/shielded/__tests__/noteCrypto.test.ts
git commit -m "test(zk): address codec <-> pkRecipientHash round-trip"
```

---

## Task 7: Golden-vector generator/verifier

Code is the source; JSON is the pinned contract. The test writes the JSON when
`GENERATE=1`, otherwise reads it and asserts the code reproduces every entry.

**Files:**
- Create: `src/modules/shielded/__tests__/noteCrypto.golden.test.ts`
- Create (generated): `docs/zk-contract/golden-vectors.json`

- [ ] **Step 1: Write the generator/verifier test**

Create `src/modules/shielded/__tests__/noteCrypto.golden.test.ts`:

```ts
import * as fs from 'fs';
import * as path from 'path';
import {base58} from '@scure/base';
import {
  bytesToBigIntBE,
  pkRecipientHash,
  mintHash,
  noteCommitment,
  nullifier,
} from '../noteCrypto';
import {computeMerkleRoot} from '../../merkle/merkleModule';

const GOLDEN_PATH = path.join(
  __dirname,
  '../../../../docs/zk-contract/golden-vectors.json',
);

const G1_GEN_HEX =
  '97f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb';

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function buildVectors() {
  const pk = hexToBytes(G1_GEN_HEX);
  const nocMint = base58.decode('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
  const allFf = new Uint8Array(32).fill(0xff);

  const pkHash = pkRecipientHash(pk);
  const mintH = mintHash(nocMint);
  const amount = 1_000_000_000n;
  const noteSecret = 12_345_678_901_234_567_890n;
  const commitment = noteCommitment({
    pkRecipientHash: pkHash,
    amount,
    mintHash: mintH,
    noteSecret,
  });

  return {
    _meta: {
      scheme: 'noctura-zk-encoding-v1',
      field: 'BN254',
      endianness: 'big',
      domains: {commitment: '0x01', nullifier: '0x02', pkRecipient: '0x05'},
      note: 'Field elements are decimal strings; byte arrays are lowercase hex.',
    },
    pkRecipientHash: [
      {name: 'g1_generator', pk: G1_GEN_HEX, output: pkHash.toString()},
    ],
    mintHash: [
      {name: 'NOC_MINT', mint_hex: Buffer.from(nocMint).toString('hex'), output: mintH.toString()},
      {name: 'all_ff_over_F', mint_hex: 'ff'.repeat(32), output: mintHash(allFf).toString()},
    ],
    noteCommitment: [
      {
        name: 'representative',
        pkRecipientHash: pkHash.toString(),
        amount: amount.toString(),
        mintHash: mintH.toString(),
        noteSecret: noteSecret.toString(),
        output: commitment.toString(),
      },
    ],
    nullifier: [
      {
        name: 'leaf_7',
        noteSecret: noteSecret.toString(),
        leafIndex: 7,
        output: nullifier({noteSecret, leafIndex: 7}).toString(),
      },
    ],
    merkle: [
      {
        name: 'root_of_two_leaves',
        leaves: [commitment.toString(16).padStart(64, '0'), pkHash.toString(16).padStart(64, '0')],
        root: computeMerkleRoot([
          commitment.toString(16).padStart(64, '0'),
          pkHash.toString(16).padStart(64, '0'),
        ]),
      },
    ],
  };
}

describe('golden vectors', () => {
  it('sanity: bytesToBigIntBE of the G1 generator is non-zero', () => {
    expect(bytesToBigIntBE(hexToBytes(G1_GEN_HEX))).toBeGreaterThan(0n);
  });

  if (process.env.GENERATE === '1') {
    it('writes golden-vectors.json', () => {
      const vectors = buildVectors();
      fs.mkdirSync(path.dirname(GOLDEN_PATH), {recursive: true});
      fs.writeFileSync(GOLDEN_PATH, JSON.stringify(vectors, null, 2) + '\n');
      expect(fs.existsSync(GOLDEN_PATH)).toBe(true);
    });
  } else {
    it('code reproduces the pinned golden vectors exactly', () => {
      const pinned = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
      const fresh = buildVectors();
      expect(fresh).toEqual(pinned);
    });
  }
});
```

- [ ] **Step 2: Run in verify mode to confirm it fails (no JSON yet)**

Run: `npx jest --testPathPattern=noteCrypto.golden`
Expected: FAIL — `ENOENT` reading `golden-vectors.json` (file not generated yet).

- [ ] **Step 3: Generate the golden vectors**

Run: `GENERATE=1 npx jest --testPathPattern=noteCrypto.golden`
Expected: PASS — `docs/zk-contract/golden-vectors.json` is created.

- [ ] **Step 4: Run in verify mode to confirm it now passes**

Run: `npx jest --testPathPattern=noteCrypto.golden`
Expected: PASS — code reproduces the pinned vectors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/__tests__/noteCrypto.golden.test.ts docs/zk-contract/golden-vectors.json
git commit -m "feat(zk): golden-vector contract + drift guard"
```

---

## Task 8: Normalize hosted-prover path to `/v1/zk/prove`

**Files:**
- Modify: `src/modules/zkProver/zkProverModule.ts:74`

- [ ] **Step 1: Write the failing test**

Append to `src/modules/zkProver/__tests__/zkProverModule.test.ts` (inside the existing
describe, or a new one — adapt the mock to the file's existing `pinnedFetch` mock style):

```ts
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
jest.mock('../../sslPinning/pinnedFetch');

it('posts proofs to the /v1/zk/prove endpoint', async () => {
  const mock = pinnedFetch as jest.MockedFunction<typeof pinnedFetch>;
  mock.mockResolvedValue({
    status: 200,
    json: async () => ({success: true, proofData: 'AAAA', publicInputs: {root: '', nullifier: '', amount: '0'}}),
  } as Awaited<ReturnType<typeof pinnedFetch>>);

  const {zkProver} = require('../zkProverModule');
  await zkProver.prove('deposit', {
    noteCommitment: '0', merklePath: [], merklePathIndices: [],
    nullifier: '0', amount: '0', noteSecret: 's',
  });

  const url = mock.mock.calls[0][0] as string;
  expect(url.endsWith('/v1/zk/prove')).toBe(true);
});
```

> If the existing test file already mocks `pinnedFetch` differently, reuse that mock and
> only add the `url.endsWith('/v1/zk/prove')` assertion against the recorded call.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=zkProverModule -t "/v1/zk/prove"`
Expected: FAIL — URL ends with `/zk/prove`, not `/v1/zk/prove`.

- [ ] **Step 3: Apply the fix**

In `src/modules/zkProver/zkProverModule.ts:74`, change:

```ts
    pinnedFetch(`${API_BASE}/zk/prove`, {
```

to:

```ts
    pinnedFetch(`${API_BASE}/v1/zk/prove`, {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=zkProverModule`
Expected: PASS (new assertion + existing suite green).

- [ ] **Step 5: Commit**

```bash
git add src/modules/zkProver/zkProverModule.ts src/modules/zkProver/__tests__/zkProverModule.test.ts
git commit -m "fix(zk): normalize hosted prover path to /v1/zk/prove"
```

---

## Task 9: Fix error-code collision

`ProverUnavailableError.code` is `E060` and `ProofGenerationError.code` is `E061`, but
`constants/errors.ts` already assigns `E060`=BACKUP_FAILED, `E061`=RESTORE_FAILED.
Dedicated ZK codes already exist: `E032`=PROVER_UNAVAILABLE, `E030`=PROOF_GENERATION_FAILED.

**Files:**
- Modify: `src/modules/zkProver/types.ts:77,85`
- Test: `src/modules/zkProver/__tests__/zkProverModule.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/modules/zkProver/__tests__/zkProverModule.test.ts`:

```ts
import {ProverUnavailableError, ProofGenerationError} from '../types';

describe('ZK error codes do not collide with backup codes', () => {
  it('ProverUnavailableError uses E032', () => {
    expect(new ProverUnavailableError().code).toBe('E032');
  });
  it('ProofGenerationError uses E030', () => {
    expect(new ProofGenerationError('x', new Error('y')).code).toBe('E030');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=zkProverModule -t "do not collide"`
Expected: FAIL — codes are still `E060`/`E061`.

- [ ] **Step 3: Apply the fix**

In `src/modules/zkProver/types.ts`:
- Line 77: change `readonly code = 'E060';` to `readonly code = 'E032';`
- Line 85: change `readonly code = 'E061';` to `readonly code = 'E030';`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --testPathPattern=zkProverModule -t "do not collide"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/zkProver/types.ts src/modules/zkProver/__tests__/zkProverModule.test.ts
git commit -m "fix(zk): use dedicated error codes E032/E030 (resolve E060/E061 collision)"
```

---

## Task 10: Contract doc + reframe NATIVE_INTEGRATION_TODO #1

**Files:**
- Create: `docs/zk-contract/zk-witness-encoding-contract.md`
- Modify: `docs/NATIVE_INTEGRATION_TODO.md` (section 1)

- [ ] **Step 1: Write the contract doc**

Create `docs/zk-contract/zk-witness-encoding-contract.md`:

```markdown
# Noctura ZK Witness Encoding Contract (v1)

**Status:** Wallet-canonical (client = spec). Circuit, backend prover, relayer, and
local prover MUST conform. Golden vectors in `./golden-vectors.json` are binding.

## Field & encoding
- Curve/field: BN254 scalar field `F` (Poseidon via `poseidon-lite ^0.3.0`,
  circomlib-compatible, x^5 S-box).
- Byte→field: **big-endian**, range-checked `< F` (except `mintHash`, which reduces).
- Serialization: field elements as decimal strings; byte arrays as lowercase hex.

## Domain separators (first Poseidon input)
| Tag | Use |
|-----|-----|
| 0x01 | note commitment |
| 0x02 | nullifier |
| 0x05 | pk_recipient hash |
| (none) | Merkle node: `poseidon2(left, right)` — untagged |

## Primitives
- `pkRecipientHash = poseidon3(0x05, be(pk[0:24]), be(pk[24:48]))` — 48-byte G1 compressed, 24/24 split.
- `mintHash = be(mint[0:32]) mod F` — plain reduction, no Poseidon.
- `noteCommitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret)` — amount in lamports.
- `nullifier = poseidon3(0x02, noteSecret, leafIndex)`.
- Merkle: `poseidon2`, depth 20, `ZERO_LEAF = 0`.

## API contract
| Endpoint | Method | Body → Response |
|----------|--------|-----------------|
| `/v1/zk/prove` | POST | `{proofType, params}` (params = witness with `noteSecret` stripped) → `{success, proofData(base64), publicInputs, error}` |
| `/v1/relayer/submit` | POST | `ZKProof` → `{txSignature}` |
| `/v1/config/circuit` | GET | → `{maxInputs, maxOutputs, treeDepth}` |

`params` encoding: `merklePath` = hex strings, `merklePathIndices` = ints, `amount` =
decimal string. `publicInputs` field elements = decimal strings.

## Ratification checklist (ZK / backend team signs off)
- [ ] Poseidon BN254 params match `poseidon-lite ^0.3.0`.
- [ ] Big-endian byte→field with `< F` range checks.
- [ ] Domain tags 0x01 / 0x02 / 0x05; Merkle nodes untagged.
- [ ] pk 24/24 split → poseidon3(0x05, pk_hi, pk_lo).
- [ ] mintHash = be(mint) mod F.
- [ ] noteCommitment = poseidon5(0x01, pkRecipientHash, amount, mintHash, noteSecret).
- [ ] nullifier = poseidon3(0x02, noteSecret, leafIndex).
- [ ] Merkle poseidon2, depth 20, ZERO_LEAF=0.
- [ ] All `golden-vectors.json` entries reproduce exactly.
```

- [ ] **Step 2: Reframe NATIVE_INTEGRATION_TODO #1**

In `docs/NATIVE_INTEGRATION_TODO.md`, replace the line:

```
**KRITIČNO:** Parametri MORAJO matchat deployed circuit. Napačni parametri = neveljavni proofs.
```

with:

```
**KRITIČNO (posodobljeno 2026-05-31):** Denarnica je kanonična — circuit MORA matchat
NAŠO spec (`docs/zk-contract/zk-witness-encoding-contract.md` + `golden-vectors.json`).
Ob deployu naredi round-trip verify proti golden vektorjem. Glej tudi
`docs/superpowers/specs/2026-05-31-zk-witness-encoding-contract-design.md`.
```

Also update line 33-36 (the XOR placeholder note): the Merkle hash already uses real
Poseidon (`poseidon2`), so change item 4 to note it is DONE and only requires the
circuit to match `poseidon2` with `ZERO_LEAF = 0`.

- [ ] **Step 3: Verify docs render and commit**

Run: `git add docs/zk-contract/zk-witness-encoding-contract.md docs/NATIVE_INTEGRATION_TODO.md`

```bash
git commit -m "docs(zk): witness encoding contract + reframe NATIVE_INTEGRATION_TODO #1"
```

---

## Final verification

- [ ] **Full suite + types + lint**

Run:
```bash
npx jest --testPathPattern="noteCrypto|zkProverModule|merkleModule"
npx tsc --noEmit
npx eslint src/modules/shielded/noteCrypto.ts src/modules/zkProver
```
Expected: all green, no type errors, no lint errors.

- [ ] **Confirm golden drift guard works**

Temporarily change a domain tag in `noteCrypto.ts` (e.g. `0x01n` → `0x09n`), run
`npx jest --testPathPattern=noteCrypto.golden`, confirm it FAILS (proves the guard
catches drift), then revert the change and confirm it passes again.
