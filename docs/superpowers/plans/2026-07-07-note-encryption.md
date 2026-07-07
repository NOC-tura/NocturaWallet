# Note Encryption (ECIES / BLS12-381 G1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A wallet-canonical note-encryption primitive: encrypt a shielded note's `{amount, noteSecret}` to a recipient's BLS12-381 G1 view key and let the recipient trial-decrypt it, with committed golden vectors.

**Architecture:** One self-contained module `noteEncryption.ts` = ECIES over BLS12-381 G1 (@noble/curves) + HKDF-SHA256 (@noble/hashes) + XChaCha20-Poly1305 (@noble/ciphers), fixed 128-byte layout `R(48)‖nonce(24)‖sealed(56)`. Deterministic via a test-only `{r, nonce}` injection seam; production samples randomly. No on-chain / no ICO-deploy dependency.

**Tech Stack:** TypeScript strict, `@noble/curves` ^2.0.1, `@noble/hashes` ^2.0.1, `@noble/ciphers` ^2.1.1, Jest. Spec: `docs/superpowers/specs/2026-07-07-note-encryption-design.md`.

**Verified API facts (already checked against installed libs):**
- `bls12_381.G1.Point` (`import {bls12_381} from '@noble/curves/bls12-381.js'`) exposes `.BASE`, `.fromBytes(Uint8Array)`, `.multiply(bigint)`, `.toBytes(true)` (48-B compressed), and `.Fn.ORDER` (scalar-field order, bigint).
- `bls12_381.longSignatures.getPublicKey(sk).toBytes(true)` == `G1.BASE.multiply(bytesToBigIntBE(sk) % G1.Fn.ORDER).toBytes(true)` — so ECDH composes with the real `noc1…` view keys (verified).
- `hkdf(sha256, ikm, salt, info, 32)` → 32-B key (`import {hkdf} from '@noble/hashes/hkdf.js'`, `import {sha256} from '@noble/hashes/sha2.js'`).
- `xchacha20poly1305(key32, nonce24).encrypt(pt40)` → 56 B (40 ct + 16 tag); `.decrypt(sealed56)` → 40 B, and THROWS on a tag failure (`import {xchacha20poly1305} from '@noble/ciphers/chacha.js'`).
- `noteCrypto.bytesToBigIntBE(Uint8Array): bigint` already exists + is exported (reuse it).
- `crypto.getRandomValues` is polyfilled (index.js) + available in Node/jest.

---

### Task 1: `noteEncryption.ts` module + core unit tests

**Files:**
- Create: `src/modules/shielded/noteEncryption.ts`
- Test: `src/modules/shielded/__tests__/noteEncryption.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/noteEncryption.test.ts
import {bls12_381} from '@noble/curves/bls12-381.js';
import {encryptNote, tryDecryptNote} from '../noteEncryption';

const G1 = bls12_381.G1.Point;
function bytesToBigIntBE(b: Uint8Array): bigint {
  let a = 0n;
  for (const x of b) a = (a << 8n) | BigInt(x);
  return a;
}
// Recipient view PUBLIC key (48-B compressed G1) from a raw sk_view byte array.
function pubOf(sk: Uint8Array): Uint8Array {
  return G1.BASE.multiply(bytesToBigIntBE(sk) % G1.Fn.ORDER).toBytes(true);
}

const skA = new Uint8Array(32).fill(7);
const pubA = pubOf(skA);
const skB = new Uint8Array(32).fill(11);

describe('noteEncryption', () => {
  it('round-trips {amount, noteSecret} for the intended recipient; ct is 128 B', () => {
    const ct = encryptNote(pubA, 12345n, 999n);
    expect(ct.length).toBe(128);
    expect(tryDecryptNote(skA, ct)).toEqual({amount: 12345n, noteSecret: 999n});
  });

  it('returns null for a different recipient (trial-decrypt miss)', () => {
    expect(tryDecryptNote(skB, encryptNote(pubA, 5n, 5n))).toBeNull();
  });

  it('returns null on a one-bit tamper of the sealed region', () => {
    const ct = encryptNote(pubA, 5n, 5n);
    ct[100] ^= 1;
    expect(tryDecryptNote(skA, ct)).toBeNull();
  });

  it('returns null on wrong length and on an invalid ephemeral point', () => {
    expect(tryDecryptNote(skA, new Uint8Array(100))).toBeNull();
    const badR = encryptNote(pubA, 5n, 5n);
    badR.fill(0, 0, 48); // zero out R → invalid/degenerate point
    expect(tryDecryptNote(skA, badR)).toBeNull();
  });

  it('throws on a wrong-length recipient view key', () => {
    expect(() => encryptNote(new Uint8Array(47), 1n, 1n)).toThrow();
  });

  it('handles edge amounts 0 and 2^64-1', () => {
    for (const amt of [0n, 18446744073709551615n]) {
      const ct = encryptNote(pubA, amt, 42n);
      expect(tryDecryptNote(skA, ct)?.amount).toBe(amt);
    }
  });

  it('is deterministic when r + nonce are injected (golden-vector seam)', () => {
    const r = new Uint8Array(32).fill(3);
    const nonce = new Uint8Array(24).fill(9);
    const a = encryptNote(pubA, 7n, 8n, {r, nonce});
    const b = encryptNote(pubA, 7n, 8n, {r, nonce});
    expect(Buffer.from(a).equals(Buffer.from(b))).toBe(true);
    // layout offsets: R(48) ‖ nonce(24) ‖ sealed(56)
    expect(Buffer.from(a.subarray(0, 48))).not.toEqual(Buffer.alloc(48));
    expect(Buffer.from(a.subarray(48, 72))).toEqual(Buffer.from(nonce));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --testPathPattern=noteEncryption`
Expected: FAIL — cannot find module `../noteEncryption`.

- [ ] **Step 3: Implement the module**

```ts
// src/modules/shielded/noteEncryption.ts
import {bls12_381} from '@noble/curves/bls12-381.js';
import {hkdf} from '@noble/hashes/hkdf.js';
import {sha256} from '@noble/hashes/sha2.js';
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {bytesToBigIntBE} from './noteCrypto';

const G1 = bls12_381.G1.Point;
// Domain tag — versions the scheme (a change here invalidates all ciphertexts).
const INFO = new TextEncoder().encode('noctura-note-enc-v1');

const VIEW_KEY_BYTES = 48;
const R_LEN = 48;
const NONCE_LEN = 24;
const SEALED_LEN = 56; // 40 payload + 16 tag
const CT_LEN = R_LEN + NONCE_LEN + SEALED_LEN; // 128
const PAYLOAD_LEN = 40; // amount(8 LE) + noteSecret(32 BE)

function randomBytes(n: number): Uint8Array {
  const b = new Uint8Array(n);
  crypto.getRandomValues(b);
  return b;
}

/** BLS12-381 scalar from arbitrary bytes: big-endian → reduce mod the curve order. */
function scalarFromBytes(bytes: Uint8Array): bigint {
  return bytesToBigIntBE(bytes) % G1.Fn.ORDER;
}

/** u64 little-endian (8 bytes) — matches the pool's amount encoding. */
function u64le(v: bigint): Uint8Array {
  const out = new Uint8Array(8);
  let x = v;
  for (let i = 0; i < 8; i++) { out[i] = Number(x & 0xffn); x >>= 8n; }
  return out;
}
function u64leToBigInt(b: Uint8Array): bigint {
  let acc = 0n;
  for (let i = 7; i >= 0; i--) acc = (acc << 8n) | BigInt(b[i]!);
  return acc;
}
/** 32-byte big-endian from a bigint (the noteSecret field element). */
function be32(v: bigint): Uint8Array {
  const out = new Uint8Array(32);
  let x = v;
  for (let i = 31; i >= 0; i--) { out[i] = Number(x & 0xffn); x >>= 8n; }
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export interface DecryptedNote { amount: bigint; noteSecret: bigint; }

/** Test-only seam: inject the ephemeral scalar bytes + nonce for deterministic
 *  golden vectors. PRODUCTION MUST NOT pass these — both default to CSPRNG. */
export interface EncryptOpts { r?: Uint8Array; nonce?: Uint8Array; }

/**
 * ECIES-encrypt a note's {amount, noteSecret} to a recipient's 48-byte compressed
 * BLS12-381 G1 view key (the noc1… address point). Returns exactly 128 bytes:
 * R(48) ‖ nonce(24) ‖ XChaCha20-Poly1305(payload 40 + tag 16). See the design spec.
 */
export function encryptNote(
  recipientViewKeyG1: Uint8Array,
  amount: bigint,
  noteSecret: bigint,
  opts: EncryptOpts = {},
): Uint8Array {
  if (recipientViewKeyG1.length !== VIEW_KEY_BYTES) {
    throw new Error(`recipient view key must be ${VIEW_KEY_BYTES} bytes`);
  }
  const P = G1.fromBytes(recipientViewKeyG1); // throws on an invalid point (bad address)
  const r = scalarFromBytes(opts.r ?? randomBytes(32));
  const Rbytes = G1.BASE.multiply(r).toBytes(true);
  const Sbytes = P.multiply(r).toBytes(true);
  const key = hkdf(sha256, Sbytes, Rbytes, INFO, 32);
  const nonce = opts.nonce ?? randomBytes(NONCE_LEN);
  if (nonce.length !== NONCE_LEN) throw new Error(`nonce must be ${NONCE_LEN} bytes`);
  const sealed = xchacha20poly1305(key, nonce).encrypt(concatBytes(u64le(amount), be32(noteSecret)));
  return concatBytes(Rbytes, nonce, sealed);
}

/**
 * Trial-decrypt a 128-byte note ciphertext with the recipient's BLS view secret.
 * Returns the note on success, or null for any foreign/garbage input (wrong length,
 * invalid ephemeral point, or AEAD auth failure) — NEVER throws, so a scanner can
 * call it on every ciphertext it sees.
 */
export function tryDecryptNote(skView: Uint8Array, ct: Uint8Array): DecryptedNote | null {
  if (ct.length !== CT_LEN) return null;
  const Rbytes = ct.subarray(0, R_LEN);
  const nonce = ct.subarray(R_LEN, R_LEN + NONCE_LEN);
  const sealed = ct.subarray(R_LEN + NONCE_LEN, CT_LEN);
  let R;
  try {
    R = G1.fromBytes(Rbytes);
  } catch {
    return null;
  }
  const Sbytes = R.multiply(scalarFromBytes(skView)).toBytes(true);
  const key = hkdf(sha256, Sbytes, Rbytes, INFO, 32);
  let payload: Uint8Array;
  try {
    payload = xchacha20poly1305(key, nonce).decrypt(sealed);
  } catch {
    return null;
  }
  if (payload.length !== PAYLOAD_LEN) return null;
  return {
    amount: u64leToBigInt(payload.subarray(0, 8)),
    noteSecret: bytesToBigIntBE(payload.subarray(8, 40)),
  };
}
```

- [ ] **Step 4: Run test + types + lint**

Run: `npx jest --testPathPattern=noteEncryption` (expect PASS, 7 tests), `npx tsc --noEmit` (clean), `npx eslint src/modules/shielded/noteEncryption.ts` (0 errors).

- [ ] **Step 5: Commit**

```bash
git add src/modules/shielded/noteEncryption.ts src/modules/shielded/__tests__/noteEncryption.test.ts
git commit -m "feat(shielded): note encryption (ECIES over BLS12-381 G1)"
```

---

### Task 2: interop with the real identity/address keys

**Files:**
- Modify: `src/modules/shielded/__tests__/noteEncryption.test.ts` (add a describe)

Proves the module composes with the actual `noc1…` address path: encrypt to `getViewPublicKey(seed)`, decrypt with `deriveShieldedViewKey(seed)`.

- [ ] **Step 1: Write the failing test**

First read `src/modules/shielded/shieldedIdentity.ts` (`getViewPublicKey(seed): Uint8Array` = 48-B G1) and `src/modules/keyDerivation/shielded.ts` (`deriveShieldedViewKey(seed): Uint8Array` = sk_view bytes). Add to the test file:

```ts
import {getViewPublicKey} from '../shieldedIdentity';
import {deriveShieldedViewKey} from '../../keyDerivation/shielded';
import {encodeShieldedAddress, decodeShieldedAddress} from '../shieldedAddressCodec';

describe('noteEncryption — interop with the real view-key identity', () => {
  const seed = new Uint8Array(32).fill(21);

  it('encrypts to getViewPublicKey(seed) and decrypts with deriveShieldedViewKey(seed)', () => {
    const pub = getViewPublicKey(seed);           // recipient's 48-B view pubkey
    const sk = deriveShieldedViewKey(seed);       // recipient's view secret
    const ct = encryptNote(pub, 777_000_000n, 424242n);
    expect(tryDecryptNote(sk, ct)).toEqual({amount: 777_000_000n, noteSecret: 424242n});
  });

  it('works when the recipient is addressed via the noc1… bech32m address', () => {
    const pub = getViewPublicKey(seed);
    const addr = encodeShieldedAddress(pub);       // what a sender would paste
    const pubFromAddr = decodeShieldedAddress(addr);
    const ct = encryptNote(pubFromAddr, 1n, 2n);
    expect(tryDecryptNote(deriveShieldedViewKey(seed), ct)).toEqual({amount: 1n, noteSecret: 2n});
  });

  it('a different seed cannot decrypt', () => {
    const ct = encryptNote(getViewPublicKey(seed), 9n, 9n);
    const otherSk = deriveShieldedViewKey(new Uint8Array(32).fill(99));
    expect(tryDecryptNote(otherSk, ct)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails then passes**

Run: `npx jest --testPathPattern=noteEncryption`
Expected: the three new tests PASS (the module already supports this; if any import path is wrong, fix it against the actual exports). If `deriveShieldedViewKey` lives at a different path, correct the import.

- [ ] **Step 3: Commit**

```bash
git add src/modules/shielded/__tests__/noteEncryption.test.ts
git commit -m "test(shielded): note-encryption interop with the real view-key address path"
```

---

### Task 3: golden vectors (canonical, committed)

**Files:**
- Create: `docs/zk-contract/note-encryption-vectors.json`
- Create: `src/modules/shielded/__tests__/noteEncryption.golden.test.ts`

Committed vectors make the scheme auditable + stable: a scheme change alters the ciphertext bytes → the golden test fails. Vectors are generated deterministically via the `{r, nonce}` seam.

- [ ] **Step 1: Write the generator+lock test**

```ts
// src/modules/shielded/__tests__/noteEncryption.golden.test.ts
import * as fs from 'fs';
import * as path from 'path';
import {bls12_381} from '@noble/curves/bls12-381.js';
import {encryptNote, tryDecryptNote} from '../noteEncryption';

const G1 = bls12_381.G1.Point;
const VECTORS_PATH = path.join(__dirname, '../../../../docs/zk-contract/note-encryption-vectors.json');

function hex(b: Uint8Array): string {
  return Buffer.from(b).toString('hex');
}
function fromHex(h: string): Uint8Array {
  return Uint8Array.from(Buffer.from(h, 'hex'));
}
function bytesToBigIntBE(b: Uint8Array): bigint {
  let a = 0n;
  for (const x of b) a = (a << 8n) | BigInt(x);
  return a;
}
function pubOf(sk: Uint8Array): Uint8Array {
  return G1.BASE.multiply(bytesToBigIntBE(sk) % G1.Fn.ORDER).toBytes(true);
}

interface Vector {
  skViewHex: string; viewKeyG1Hex: string; rHex: string; nonceHex: string;
  amount: string; noteSecretHex: string; ciphertextHex: string;
}

// Deterministic inputs (fixed sk/r/nonce make the ciphertext reproducible).
const INPUTS = [
  {sk: new Uint8Array(32).fill(7), r: new Uint8Array(32).fill(3), nonce: new Uint8Array(24).fill(9), amount: 12345n, noteSecret: 999n},
  {sk: (() => {const s = new Uint8Array(32); s[31] = 1; s[0] = 2; return s;})(), r: (() => {const s = new Uint8Array(32); s[0] = 5; return s;})(), nonce: new Uint8Array(24).fill(1), amount: 0n, noteSecret: 18446744073709551616n},
];

function build(): Vector[] {
  return INPUTS.map(i => {
    const pub = pubOf(i.sk);
    const ct = encryptNote(pub, i.amount, i.noteSecret, {r: i.r, nonce: i.nonce});
    return {
      skViewHex: hex(i.sk), viewKeyG1Hex: hex(pub), rHex: hex(i.r), nonceHex: hex(i.nonce),
      amount: i.amount.toString(),
      noteSecretHex: (() => {const o = new Uint8Array(32); let x = i.noteSecret; for (let k = 31; k >= 0; k--) {o[k] = Number(x & 0xffn); x >>= 8n;} return hex(o);})(),
      ciphertextHex: hex(ct),
    };
  });
}

describe('noteEncryption golden vectors', () => {
  it('reproduces the committed vectors byte-for-byte (regenerate with GENERATE=1)', () => {
    const built = build();
    if (process.env.GENERATE === '1') {
      fs.writeFileSync(VECTORS_PATH, JSON.stringify(built, null, 2) + '\n');
    }
    const committed: Vector[] = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'));
    expect(built).toEqual(committed);
  });

  it('every committed vector decrypts back to its inputs', () => {
    const committed: Vector[] = JSON.parse(fs.readFileSync(VECTORS_PATH, 'utf8'));
    for (const v of committed) {
      const dec = tryDecryptNote(fromHex(v.skViewHex), fromHex(v.ciphertextHex));
      expect(dec).not.toBeNull();
      expect(dec!.amount.toString()).toBe(v.amount);
      expect(dec!.noteSecret).toBe(bytesToBigIntBE(fromHex(v.noteSecretHex)));
    }
  });
});
```

- [ ] **Step 2: Generate the committed vectors**

Run: `GENERATE=1 npx jest --testPathPattern=noteEncryption.golden`
This writes `docs/zk-contract/note-encryption-vectors.json`. Inspect it: 2 entries, each `ciphertextHex` is 256 hex chars (128 B), `viewKeyG1Hex` 96 chars (48 B).

- [ ] **Step 3: Lock — run without GENERATE**

Run: `npx jest --testPathPattern=noteEncryption.golden`
Expected: PASS (2 tests) — the built vectors equal the committed JSON, and each decrypts back.

- [ ] **Step 4: Verify types + full note-encryption suite**

Run: `npx tsc --noEmit` (clean) and `npx jest --testPathPattern=noteEncryption` (all suites pass).

- [ ] **Step 5: Commit**

```bash
git add docs/zk-contract/note-encryption-vectors.json src/modules/shielded/__tests__/noteEncryption.golden.test.ts
git commit -m "test(shielded): committed note-encryption golden vectors"
```

---

### Task 4: full verification

**Files:** none (verification only)

- [ ] **Step 1: Full type-check, tests, lint**

Run:
```bash
npx tsc --noEmit
npx jest --testPathPattern='noteEncryption'
npx eslint src/modules/shielded/noteEncryption.ts src/modules/shielded/__tests__/noteEncryption.test.ts src/modules/shielded/__tests__/noteEncryption.golden.test.ts
```
Expected: tsc clean; all note-encryption tests pass; eslint 0 errors.

- [ ] **Step 2: Confirm no wider breakage**

Run: `npx jest 2>&1 | tail -4`
Expected: the full suite still passes (this task is purely additive — a new module + tests + a doc vector file).
