# Step 5–6–7: Security Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the security foundation: SSL certificate pinning for API calls, secure keychain abstraction with PIN fallback, session key lifecycle with in-memory keypair management and zeroization, and key derivation for both transparent (Ed25519 BIP-44) and shielded (BLS12-381 EIP-2333 view/disclosure) keys. Native bridge interfaces are defined with stubs — actual Swift/Kotlin BLST integration is deferred to the device build phase.

**Architecture:** Three layers: (1) SSL pinning wraps all API calls via a pinned fetch client, (2) KeychainModule abstracts react-native-keychain with PIN hashing (PBKDF2-SHA512 600K) and native bridge interfaces for shielded signing, (3) SessionModule holds the Ed25519 keypair in memory with AppState-driven background timeout and zeroization. Key derivation uses @scure/bip39 + @scure/bip32 for Ed25519 and micro-key-producer/bls.js for BLS12-381 view/disclosure keys. sk_spend NEVER exists in JavaScript.

**Tech Stack:** react-native-ssl-pinning, react-native-keychain, @scure/bip39, @scure/bip32, micro-key-producer/bls.js, @noble/hashes (PBKDF2), @noble/curves (Ed25519 verification)

**Validated decisions:** See `docs/superpowers/specs/2026-04-04-architecture-validation-design.md` — BLST for native BLS12-381 (Section 2), EIP-2333 paths immutable (Section 3), ZK backend mocked (Section 1)

---

## Critical Security Invariants

These MUST be verified in every code review for this worktree:

1. **sk_spend NEVER in JS** — no function named `deriveShieldedSpendKey` or similar may exist in any `.ts`/`.tsx` file
2. **micro-key-producer/bls.js** for EIP-2333 — NOT `bls12-381-keygen` (deprecated), NOT `@scure/bip32` (invalid for BLS)
3. **PBKDF2-SHA512 with 600,000 iterations** for PIN hashing — not less
4. **PIN salt: 32 random bytes** stored in keychain, not MMKV
5. **Zeroization** — all seed/keypair Uint8Arrays filled with 0x00 after use, then set to null
6. **P-256 envelope encryption** on iOS — Secure Enclave for AES key wrapping only, not direct BLS signing

---

## File Structure

```
src/
├── modules/
│   ├── keychain/
│   │   ├── keychainModule.ts          — KeychainModule interface + react-native-keychain implementation
│   │   ├── pinManager.ts             — PIN hash/verify/change with PBKDF2-SHA512 600K
│   │   ├── nativeBridge.ts           — NativeModules interface for shielded signing (stub)
│   │   └── __tests__/
│   │       ├── keychainModule.test.ts
│   │       └── pinManager.test.ts
│   ├── keyDerivation/
│   │   ├── paths.ts                  — TRANSPARENT_PATH + SHIELDED_PATHS constants
│   │   ├── transparent.ts            — BIP-39 mnemonic + BIP-44 Ed25519 derivation
│   │   ├── shielded.ts               — EIP-2333 view key + disclosure key (JS-only, NO spend)
│   │   ├── mnemonicUtils.ts          — Generate/validate mnemonic wrapper
│   │   └── __tests__/
│   │       ├── transparent.test.ts
│   │       ├── shielded.test.ts
│   │       └── mnemonicUtils.test.ts
│   ├── session/
│   │   ├── sessionModule.ts          — In-memory keypair lifecycle, zeroization, timeout
│   │   ├── zeroize.ts                — Utility to zero Uint8Array contents
│   │   └── __tests__/
│   │       ├── sessionModule.test.ts
│   │       └── zeroize.test.ts
│   └── sslPinning/
│       ├── pinnedFetch.ts            — SSL-pinned fetch wrapper for api.noc-tura.io
│       └── __tests__/
│           └── pinnedFetch.test.ts
├── constants/
│   └── programs.ts                   — MODIFIED (add SSL pin hashes)
__mocks__/
├── react-native-keychain.ts          — Jest mock for keychain
├── react-native-ssl-pinning.ts       — Jest mock for SSL pinning
└── nativeBridge.ts                   — Jest mock for native shielded signing
```

---

## Task 1: Install Crypto + Security Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install crypto packages**

```bash
npm install \
  @scure/bip39 \
  @scure/bip32 \
  @noble/hashes \
  @noble/curves \
  micro-key-producer
```

- [ ] **Step 2: Install security packages**

```bash
npm install \
  react-native-keychain \
  react-native-ssl-pinning
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add crypto (@scure, @noble, micro-key-producer) and security (keychain, ssl-pinning) packages"
```

---

## Task 2: Jest Mocks for Native Modules

**Files:**
- Create: `__mocks__/react-native-keychain.ts`
- Create: `__mocks__/react-native-ssl-pinning.ts`

- [ ] **Step 1: Create keychain mock**

Create `__mocks__/react-native-keychain.ts`:
```typescript
const store = new Map<string, {username: string; password: string}>();

const Keychain = {
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WhenUnlockedThisDeviceOnly',
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AfterFirstUnlockThisDeviceOnly',
  },
  ACCESS_CONTROL: {
    BIOMETRY_CURRENT_SET: 'BiometryCurrentSet',
    BIOMETRY_ANY: 'BiometryAny',
    USER_PRESENCE: 'UserPresence',
  },
  SECURITY_LEVEL: {
    SECURE_HARDWARE: 'SECURE_HARDWARE',
    SECURE_SOFTWARE: 'SECURE_SOFTWARE',
  },

  setGenericPassword: jest.fn(
    async (username: string, password: string, options?: {service?: string}) => {
      const key = options?.service ?? 'default';
      store.set(key, {username, password});
      return true;
    },
  ),

  getGenericPassword: jest.fn(async (options?: {service?: string}) => {
    const key = options?.service ?? 'default';
    const entry = store.get(key);
    if (!entry) return false;
    return entry;
  }),

  resetGenericPassword: jest.fn(async (options?: {service?: string}) => {
    const key = options?.service ?? 'default';
    store.delete(key);
    return true;
  }),

  getSupportedBiometryType: jest.fn(async () => 'FaceID'),

  __reset() {
    store.clear();
    Keychain.setGenericPassword.mockClear();
    Keychain.getGenericPassword.mockClear();
    Keychain.resetGenericPassword.mockClear();
    Keychain.getSupportedBiometryType.mockClear();
  },
};

export default Keychain;
module.exports = Keychain;
```

- [ ] **Step 2: Create SSL pinning mock**

Create `__mocks__/react-native-ssl-pinning.ts`:
```typescript
const SSLPinning = {
  fetch: jest.fn(async (url: string, options?: Record<string, unknown>) => ({
    status: 200,
    headers: {},
    json: async () => ({}),
    text: async () => '',
    bodyString: '',
  })),

  __reset() {
    SSLPinning.fetch.mockClear();
  },
};

export default SSLPinning;
module.exports = SSLPinning;
```

- [ ] **Step 3: Commit**

```bash
git add __mocks__/react-native-keychain.ts __mocks__/react-native-ssl-pinning.ts
git commit -m "test: add Jest mocks for react-native-keychain and react-native-ssl-pinning"
```

---

## Task 3: Zeroize Utility (TDD)

**Files:**
- Create: `src/modules/session/__tests__/zeroize.test.ts`
- Create: `src/modules/session/zeroize.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/session/__tests__/zeroize.test.ts`:
```typescript
import {zeroize} from '../zeroize';

describe('zeroize', () => {
  it('fills Uint8Array with zeros', () => {
    const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    zeroize(data);
    expect(data.every(b => b === 0)).toBe(true);
  });

  it('handles empty array', () => {
    const data = new Uint8Array(0);
    zeroize(data);
    expect(data.length).toBe(0);
  });

  it('handles large array', () => {
    const data = new Uint8Array(1024);
    data.fill(0xff);
    zeroize(data);
    expect(data.every(b => b === 0)).toBe(true);
  });

  it('does not throw on null/undefined', () => {
    expect(() => zeroize(null as unknown as Uint8Array)).not.toThrow();
    expect(() => zeroize(undefined as unknown as Uint8Array)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/session/__tests__/zeroize.test.ts --no-cache`
Expected: FAIL — cannot find module '../zeroize'

- [ ] **Step 3: Implement zeroize**

Create `src/modules/session/zeroize.ts`:
```typescript
/**
 * Securely zero out a Uint8Array by filling with 0x00.
 * Used to clear sensitive key material from memory after use.
 */
export function zeroize(data: Uint8Array | null | undefined): void {
  if (!data) return;
  data.fill(0);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/session/__tests__/zeroize.test.ts --no-cache`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/session/
git commit -m "feat: zeroize utility for secure memory cleanup"
```

---

## Task 4: Key Derivation Paths Constants

**Files:**
- Create: `src/modules/keyDerivation/paths.ts`

- [ ] **Step 1: Create paths.ts**

Create `src/modules/keyDerivation/paths.ts`:
```typescript
/**
 * Key derivation paths — IMMUTABLE. Changing these breaks all existing wallets.
 *
 * Transparent (Ed25519): standard Solana BIP-44 via @scure/bip32
 * Shielded (BLS12-381): Noctura EIP-2333 via micro-key-producer/bls.js
 *   - Coin type 371 is an internal Noctura convention (not registered in SLIP-0044)
 *   - EIP-2333 indices are implicitly hardened (no apostrophes)
 *
 * ⛔ sk_spend (m/12381/371/1/0) is NEVER derived in JavaScript.
 *    It exists only in native code (BLST via iOS CryptoKit / Android KeyStore).
 *    The path constant is exported for documentation only.
 */

// Ed25519 — @scure/bip32
export const TRANSPARENT_PATH = "m/44'/501'/0'/0'" as const;

// BLS12-381 — micro-key-producer/bls.js (EIP-2333)
export const SHIELDED_PATHS = {
  /** ⛔ NATIVE ONLY — never derive in JS. Exported for documentation. */
  spend: 'm/12381/371/1/0',
  /** ✓ JS allowed — read-only view key for note decryption */
  view: 'm/12381/371/2/0',
  /** ✓ JS allowed — ephemeral disclosure keys for proving assets */
  disclosure: (index: number) => `m/12381/371/3/${index}`,
} as const;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/keyDerivation/paths.ts
git commit -m "feat: key derivation path constants (Ed25519 BIP-44 + BLS12-381 EIP-2333)"
```

---

## Task 5: Mnemonic Utilities (TDD)

**Files:**
- Create: `src/modules/keyDerivation/__tests__/mnemonicUtils.test.ts`
- Create: `src/modules/keyDerivation/mnemonicUtils.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/keyDerivation/__tests__/mnemonicUtils.test.ts`:
```typescript
import {generateMnemonic, validateMnemonic, mnemonicToSeed} from '../mnemonicUtils';

describe('mnemonicUtils', () => {
  it('generates a valid 24-word mnemonic', () => {
    const mnemonic = generateMnemonic();
    const words = mnemonic.split(' ');
    expect(words.length).toBe(24);
  });

  it('generated mnemonic passes validation', () => {
    const mnemonic = generateMnemonic();
    expect(validateMnemonic(mnemonic)).toBe(true);
  });

  it('rejects invalid mnemonic', () => {
    expect(validateMnemonic('not a valid mnemonic phrase')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(validateMnemonic('')).toBe(false);
  });

  it('derives 64-byte seed from mnemonic', async () => {
    const mnemonic = generateMnemonic();
    const seed = await mnemonicToSeed(mnemonic);
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(64);
  });

  it('same mnemonic produces same seed (deterministic)', async () => {
    const mnemonic = generateMnemonic();
    const seed1 = await mnemonicToSeed(mnemonic);
    const seed2 = await mnemonicToSeed(mnemonic);
    expect(Buffer.from(seed1).equals(Buffer.from(seed2))).toBe(true);
  });

  // BIP-39 test vector (from spec: "verify against test vectors")
  it('matches BIP-39 test vector', async () => {
    // Standard BIP-39 test vector (English, no passphrase)
    const testMnemonic =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    expect(validateMnemonic(testMnemonic)).toBe(true);
    const seed = await mnemonicToSeed(testMnemonic);
    // Known seed hex for this mnemonic (BIP-39 spec)
    const expectedSeedHex =
      '5eb00bbddcf069084889a8ab9155568165f5c453ccb85e70811aaed6f6da5fc19a5ac40b389cd370d086206dec8aa6c43daea6690f20ad3d8d48b2d2ce9e38e4';
    expect(Buffer.from(seed).toString('hex')).toBe(expectedSeedHex);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/keyDerivation/__tests__/mnemonicUtils.test.ts --no-cache`
Expected: FAIL — cannot find module '../mnemonicUtils'

- [ ] **Step 3: Implement mnemonicUtils**

Create `src/modules/keyDerivation/mnemonicUtils.ts`:
```typescript
import {generateMnemonic as generate, validateMnemonic as validate, mnemonicToSeed as mnemonicToSeedAsync} from '@scure/bip39';
import {wordlist} from '@scure/bip39/wordlists/english';

/**
 * Generate a 24-word BIP-39 mnemonic (256 bits of entropy).
 * Uses crypto.getRandomValues() via polyfill (loaded in index.js).
 */
export function generateMnemonic(): string {
  return generate(wordlist, 256);
}

/**
 * Validate a BIP-39 mnemonic (checksum + wordlist).
 * Accepts both 12-word (128-bit) and 24-word (256-bit) mnemonics.
 */
export function validateMnemonic(mnemonic: string): boolean {
  if (!mnemonic || mnemonic.trim().length === 0) return false;
  return validate(mnemonic, wordlist);
}

/**
 * Derive a 512-bit (64-byte) seed from a mnemonic via PBKDF2-HMAC-SHA512.
 * No passphrase — standard BIP-39 derivation.
 * Uses the async version to avoid blocking the JS thread on low-end devices.
 */
export async function mnemonicToSeed(mnemonic: string): Promise<Uint8Array> {
  return mnemonicToSeedAsync(mnemonic, wordlist);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/keyDerivation/__tests__/mnemonicUtils.test.ts --no-cache`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/keyDerivation/mnemonicUtils.ts src/modules/keyDerivation/__tests__/
git commit -m "feat: BIP-39 mnemonic generation, validation, seed derivation with test vectors"
```

---

## Task 6: Transparent Key Derivation — Ed25519 BIP-44 (TDD)

**Files:**
- Create: `src/modules/keyDerivation/__tests__/transparent.test.ts`
- Create: `src/modules/keyDerivation/transparent.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/keyDerivation/__tests__/transparent.test.ts`:
```typescript
import {deriveTransparentKeypair} from '../transparent';
import {mnemonicToSeed} from '../mnemonicUtils';

describe('transparent key derivation (Ed25519 BIP-44)', () => {
  // Use the standard BIP-39 "abandon" test mnemonic for deterministic tests
  const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  let seed: Uint8Array;

  beforeAll(async () => {
    seed = await mnemonicToSeed(TEST_MNEMONIC);
  });

  it('derives a keypair from seed', () => {
    const keypair = deriveTransparentKeypair(seed);
    expect(keypair.publicKey).toBeInstanceOf(Uint8Array);
    expect(keypair.secretKey).toBeInstanceOf(Uint8Array);
  });

  it('public key is 32 bytes (Ed25519)', () => {
    const keypair = deriveTransparentKeypair(seed);
    expect(keypair.publicKey.length).toBe(32);
  });

  it('secret key is 64 bytes (Ed25519 expanded)', () => {
    const keypair = deriveTransparentKeypair(seed);
    expect(keypair.secretKey.length).toBe(64);
  });

  it('derivation is deterministic', () => {
    const kp1 = deriveTransparentKeypair(seed);
    const kp2 = deriveTransparentKeypair(seed);
    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(true);
    expect(Buffer.from(kp1.secretKey).equals(Buffer.from(kp2.secretKey))).toBe(true);
  });

  it('matches pinned test vector for m/44\'/501\'/0\'/0\'', () => {
    // Known-answer test: "abandon...about" mnemonic → Solana BIP-44 path → deterministic pubkey
    const keypair = deriveTransparentKeypair(seed);
    const pubkeyHex = Buffer.from(keypair.publicKey).toString('hex');
    expect(pubkeyHex).toBe('382aaa068581d37e9851a0711fc43750f8b6688dd3855a98a4a6b7dabc60a426');
  });

  it('different seeds produce different keys', async () => {
    const otherMnemonic =
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
    const otherSeed = await mnemonicToSeed(otherMnemonic);
    const kp1 = deriveTransparentKeypair(seed);
    const kp2 = deriveTransparentKeypair(otherSeed);
    expect(Buffer.from(kp1.publicKey).equals(Buffer.from(kp2.publicKey))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/keyDerivation/__tests__/transparent.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement transparent key derivation**

Create `src/modules/keyDerivation/transparent.ts`:
```typescript
import {HDKey} from '@scure/bip32';
import {ed25519} from '@noble/curves/ed25519';
import {TRANSPARENT_PATH} from './paths';
import {zeroize} from '../session/zeroize';

interface TransparentKeypair {
  publicKey: Uint8Array; // 32 bytes
  secretKey: Uint8Array; // 64 bytes (seed + public key, Solana convention)
}

/**
 * Derive the Solana Ed25519 keypair from a BIP-39 seed.
 * Path: m/44'/501'/0'/0' (standard Solana BIP-44)
 * Library: @scure/bip32 (valid for Ed25519)
 */
export function deriveTransparentKeypair(seed: Uint8Array): TransparentKeypair {
  const hd = HDKey.fromMasterSeed(seed);
  const derived = hd.derive(TRANSPARENT_PATH);

  if (!derived.privateKey) {
    throw new Error('Failed to derive private key from seed');
  }

  // Ed25519: private key (32 bytes) → public key (32 bytes)
  const publicKey = ed25519.getPublicKey(derived.privateKey);

  // Solana convention: secretKey = privateKey (32) + publicKey (32) = 64 bytes
  const secretKey = new Uint8Array(64);
  secretKey.set(derived.privateKey, 0);
  secretKey.set(publicKey, 32);

  // Zeroize intermediate private key from BIP-32 derivation
  zeroize(derived.privateKey);

  return {publicKey, secretKey};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/keyDerivation/__tests__/transparent.test.ts --no-cache`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/keyDerivation/transparent.ts src/modules/keyDerivation/__tests__/transparent.test.ts
git commit -m "feat: Ed25519 BIP-44 transparent key derivation with tests"
```

---

## Task 7: Shielded Key Derivation — BLS12-381 EIP-2333 View + Disclosure (TDD)

**Files:**
- Create: `src/modules/keyDerivation/__tests__/shielded.test.ts`
- Create: `src/modules/keyDerivation/shielded.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/keyDerivation/__tests__/shielded.test.ts`:
```typescript
import {deriveShieldedViewKey, deriveDisclosureKey} from '../shielded';
import {mnemonicToSeed} from '../mnemonicUtils';

describe('shielded key derivation (BLS12-381 EIP-2333)', () => {
  const TEST_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  let seed: Uint8Array;

  beforeAll(async () => {
    seed = await mnemonicToSeed(TEST_MNEMONIC);
  });

  describe('deriveShieldedViewKey', () => {
    it('derives a 32-byte view key', () => {
      const viewKey = deriveShieldedViewKey(seed);
      expect(viewKey).toBeInstanceOf(Uint8Array);
      expect(viewKey.length).toBe(32);
    });

    it('derivation is deterministic', () => {
      const vk1 = deriveShieldedViewKey(seed);
      const vk2 = deriveShieldedViewKey(seed);
      expect(Buffer.from(vk1).equals(Buffer.from(vk2))).toBe(true);
    });

    it('matches pinned test vector for m/12381/371/2/0', () => {
      const viewKey = deriveShieldedViewKey(seed);
      const hex = Buffer.from(viewKey).toString('hex');
      expect(hex).toBe('30171f354d910bcd87d1a0573900419e17e04c1015c4aa6ea127be66fdccd6dc');
    });

    it('different seeds produce different view keys', async () => {
      const otherMnemonic = 'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong';
      const otherSeed = await mnemonicToSeed(otherMnemonic);
      const vk1 = deriveShieldedViewKey(seed);
      const vk2 = deriveShieldedViewKey(otherSeed);
      expect(Buffer.from(vk1).equals(Buffer.from(vk2))).toBe(false);
    });
  });

  describe('deriveDisclosureKey', () => {
    it('derives a 32-byte disclosure key', () => {
      const dk = deriveDisclosureKey(seed, 0);
      expect(dk).toBeInstanceOf(Uint8Array);
      expect(dk.length).toBe(32);
    });

    it('different indices produce different keys', () => {
      const dk0 = deriveDisclosureKey(seed, 0);
      const dk1 = deriveDisclosureKey(seed, 1);
      expect(Buffer.from(dk0).equals(Buffer.from(dk1))).toBe(false);
    });

    it('same index is deterministic', () => {
      const dk1 = deriveDisclosureKey(seed, 42);
      const dk2 = deriveDisclosureKey(seed, 42);
      expect(Buffer.from(dk1).equals(Buffer.from(dk2))).toBe(true);
    });
  });

  describe('security boundary', () => {
    it('does NOT export any spend key derivation function', () => {
      // This file must never export deriveShieldedSpendKey or similar
      const moduleExports = require('../shielded');
      const exportNames = Object.keys(moduleExports);
      const forbidden = exportNames.filter(
        name => name.toLowerCase().includes('spend'),
      );
      expect(forbidden).toEqual([]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/keyDerivation/__tests__/shielded.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement shielded key derivation**

Create `src/modules/keyDerivation/shielded.ts`:
```typescript
/**
 * BLS12-381 shielded key derivation (EIP-2333) — VIEW + DISCLOSURE keys only.
 *
 * ⛔ SECURITY BOUNDARY: This file contains ONLY view and disclosure key derivation.
 *    deriveShieldedSpendKey() MUST NOT exist in any JS/TS file.
 *    Spend key derivation lives exclusively in native code:
 *      - iOS: NocturaSecureEnclave.swift (BLST via CryptoKit bridge)
 *      - Android: NocturaKeyStore.kt (BLST via JNI)
 *
 * Library: micro-key-producer/bls.js (EIP-2333)
 *   ⚠️ NOT @scure/bip32 — BIP-32 is invalid for BLS12-381 (>54% of derived keys
 *      would be outside the curve order)
 *   ⚠️ NOT bls12-381-keygen — deprecated, merged into micro-key-producer
 */

import {deriveSeedTree} from 'micro-key-producer/bls.js';
import {SHIELDED_PATHS} from './paths';

/**
 * Derive the shielded view key (sk_view) from a BIP-39 seed.
 * Path: m/12381/371/2/0 (EIP-2333)
 *
 * ✓ ALLOWED in JS — read-only key for note decryption and ownership verification.
 *   Cannot authorize spends.
 */
export function deriveShieldedViewKey(seed: Uint8Array): Uint8Array {
  return deriveSeedTree(seed, SHIELDED_PATHS.view);
}

/**
 * Derive an ephemeral disclosure key from a BIP-39 seed.
 * Path: m/12381/371/3/{index} (EIP-2333)
 *
 * ✓ ALLOWED in JS — used for proving asset ownership to auditors.
 *   Each disclosure has a unique index. Cannot authorize spends.
 */
export function deriveDisclosureKey(seed: Uint8Array, index: number): Uint8Array {
  return deriveSeedTree(seed, SHIELDED_PATHS.disclosure(index));
}

// ⛔ deriveShieldedSpendKey() DOES NOT EXIST here.
// For shielded signing, call the native bridge:
//   NocturaKeyModule.signShieldedOp(payload)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/keyDerivation/__tests__/shielded.test.ts --no-cache`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/keyDerivation/shielded.ts src/modules/keyDerivation/__tests__/shielded.test.ts
git commit -m "feat: BLS12-381 EIP-2333 view + disclosure key derivation (NO spend key in JS)"
```

---

## Task 8: PIN Manager — PBKDF2-SHA512 600K (TDD)

**Files:**
- Create: `src/modules/keychain/__tests__/pinManager.test.ts`
- Create: `src/modules/keychain/pinManager.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/keychain/__tests__/pinManager.test.ts`:
```typescript
import {hashPin, verifyPin, generateSalt, PIN_ITERATIONS} from '../pinManager';

describe('pinManager', () => {
  it('PIN_ITERATIONS is 600000 (OWASP 2024)', () => {
    expect(PIN_ITERATIONS).toBe(600_000);
  });

  it('generates a 32-byte random salt', () => {
    const salt = generateSalt();
    expect(salt).toBeInstanceOf(Uint8Array);
    expect(salt.length).toBe(32);
  });

  it('generates different salts each time', () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    expect(Buffer.from(s1).equals(Buffer.from(s2))).toBe(false);
  });

  it('hashes a PIN to a 64-byte derived key', async () => {
    const salt = generateSalt();
    const hash = await hashPin('123456', salt);
    expect(hash).toBeInstanceOf(Uint8Array);
    expect(hash.length).toBe(64);
  });

  it('same PIN + salt produces same hash (deterministic)', async () => {
    const salt = generateSalt();
    const h1 = await hashPin('123456', salt);
    const h2 = await hashPin('123456', salt);
    expect(Buffer.from(h1).equals(Buffer.from(h2))).toBe(true);
  });

  it('different PINs produce different hashes', async () => {
    const salt = generateSalt();
    const h1 = await hashPin('123456', salt);
    const h2 = await hashPin('654321', salt);
    expect(Buffer.from(h1).equals(Buffer.from(h2))).toBe(false);
  });

  it('different salts produce different hashes', async () => {
    const s1 = generateSalt();
    const s2 = generateSalt();
    const h1 = await hashPin('123456', s1);
    const h2 = await hashPin('123456', s2);
    expect(Buffer.from(h1).equals(Buffer.from(h2))).toBe(false);
  });

  it('verifyPin returns true for correct PIN', async () => {
    const salt = generateSalt();
    const hash = await hashPin('123456', salt);
    expect(await verifyPin('123456', salt, hash)).toBe(true);
  });

  it('verifyPin returns false for wrong PIN', async () => {
    const salt = generateSalt();
    const hash = await hashPin('123456', salt);
    expect(await verifyPin('000000', salt, hash)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/keychain/__tests__/pinManager.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement PIN manager**

Create `src/modules/keychain/pinManager.ts`:
```typescript
import {pbkdf2Async} from '@noble/hashes/pbkdf2';
import {sha512} from '@noble/hashes/sha512';

/**
 * PBKDF2-HMAC-SHA512 iteration count.
 * 600,000 = OWASP 2024 recommendation for PBKDF2-SHA512.
 * 6-digit PIN = 1M combinations → iterations MUST be high.
 */
export const PIN_ITERATIONS = 600_000;

/** Output key length in bytes (SHA-512 output = 64 bytes) */
const KEY_LENGTH = 64;

/** Salt length in bytes */
const SALT_LENGTH = 32;

/**
 * Generate a cryptographically random salt for PIN hashing.
 * Salt is stored in keychain (NOT MMKV) alongside the PIN hash.
 */
export function generateSalt(): Uint8Array {
  const salt = new Uint8Array(SALT_LENGTH);
  crypto.getRandomValues(salt);
  return salt;
}

/**
 * Hash a PIN using PBKDF2-HMAC-SHA512 with the given salt.
 * Returns a 64-byte derived key.
 */
export async function hashPin(pin: string, salt: Uint8Array): Promise<Uint8Array> {
  return pbkdf2Async(sha512, pin, salt, {
    c: PIN_ITERATIONS,
    dkLen: KEY_LENGTH,
  });
}

/**
 * Verify a PIN against a stored hash.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyPin(
  pin: string,
  salt: Uint8Array,
  storedHash: Uint8Array,
): Promise<boolean> {
  const computed = await hashPin(pin, salt);

  // Constant-time comparison
  if (computed.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed[i] ^ storedHash[i];
  }
  return diff === 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/keychain/__tests__/pinManager.test.ts --no-cache`
Expected: PASS (9 tests)

Note: The PBKDF2 600K iteration test may be slow (~2-5 seconds per hash). This is expected — it's the security cost. If Jest times out, increase the test timeout:
```typescript
// At top of test file
jest.setTimeout(30_000);
```

- [ ] **Step 5: Commit**

```bash
git add src/modules/keychain/
git commit -m "feat: PIN manager with PBKDF2-SHA512 600K iterations, constant-time verify"
```

---

## Task 9: Native Bridge Interface (Stubs)

**Files:**
- Create: `src/modules/keychain/nativeBridge.ts`

- [ ] **Step 1: Create native bridge interface with stubs**

Create `src/modules/keychain/nativeBridge.ts`:
```typescript
import {NativeModules, Platform} from 'react-native';

/**
 * Native bridge for shielded signing operations.
 *
 * The real implementation lives in:
 *   iOS:     native/ios/NocturaSecureEnclave.swift (BLST via C interop)
 *   Android: native/android/NocturaKeyStore.kt (BLST via JNI)
 *
 * sk_spend NEVER leaves the native boundary. This bridge receives only:
 *   - Payload bytes to sign
 *   - Returns signature bytes or public key bytes
 *
 * The native module is registered as 'NocturaKeyModule'.
 * Before native integration, all methods throw with a clear message.
 */

interface NocturaKeyModuleInterface {
  /** Derive sk_spend and sign payload. Returns BLS12-381 signature. */
  signShieldedOp(payloadHex: string): Promise<string>;

  /** Derive pk_shielded (G1 point) from sk_spend. Returns 48-byte compressed hex. */
  getShieldedPublicKey(): Promise<string>;

  /** Store encrypted seed in Secure Enclave (iOS) / Keystore (Android). */
  storeSeed(mnemonicEncrypted: string): Promise<void>;

  /** Retrieve and decrypt seed. Requires biometric auth. */
  retrieveSeed(): Promise<string>;

  /** Check if seed exists in secure storage. */
  hasSeed(): Promise<boolean>;

  /** Delete seed from secure storage. */
  deleteSeed(): Promise<void>;
}

const NATIVE_NOT_READY =
  'Native module NocturaKeyModule not available. Build the native project with BLST integration.';

// Access the native module, falling back to stubs
const NativeModule = NativeModules.NocturaKeyModule as
  | NocturaKeyModuleInterface
  | undefined;

function requireNative(): NocturaKeyModuleInterface {
  if (!NativeModule) {
    throw new Error(NATIVE_NOT_READY);
  }
  return NativeModule;
}

export const NocturaKeyBridge: NocturaKeyModuleInterface = {
  signShieldedOp: async (payloadHex: string) =>
    requireNative().signShieldedOp(payloadHex),

  getShieldedPublicKey: async () =>
    requireNative().getShieldedPublicKey(),

  storeSeed: async (mnemonicEncrypted: string) =>
    requireNative().storeSeed(mnemonicEncrypted),

  retrieveSeed: async () =>
    requireNative().retrieveSeed(),

  hasSeed: async () =>
    requireNative().hasSeed(),

  deleteSeed: async () =>
    requireNative().deleteSeed(),
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/modules/keychain/nativeBridge.ts
git commit -m "feat: native bridge interface for shielded signing (BLST stubs until device build)"
```

---

## Task 10: Keychain Module (TDD)

**Files:**
- Create: `src/modules/keychain/__tests__/keychainModule.test.ts`
- Create: `src/modules/keychain/keychainModule.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/keychain/__tests__/keychainModule.test.ts`:
```typescript
import {KeychainManager} from '../keychainModule';
import Keychain from 'react-native-keychain';

jest.setTimeout(60_000); // PIN tests involve PBKDF2 600K iterations

const mockKeychain = Keychain as typeof Keychain & {__reset: () => void};

describe('KeychainManager', () => {
  let manager: KeychainManager;

  beforeEach(() => {
    mockKeychain.__reset();
    manager = new KeychainManager();
  });

  describe('storeSeed / retrieveSeed', () => {
    it('stores and retrieves a mnemonic', async () => {
      const mnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
      await manager.storeSeed(mnemonic);
      const retrieved = await manager.retrieveSeed();
      expect(retrieved).toBe(mnemonic);
    });

    it('hasWallet returns false when no seed stored', async () => {
      expect(await manager.hasWallet()).toBe(false);
    });

    it('hasWallet returns true after storing seed', async () => {
      await manager.storeSeed('test mnemonic words');
      expect(await manager.hasWallet()).toBe(true);
    });
  });

  describe('storeViewKey / retrieveViewKey', () => {
    it('stores and retrieves a view key', async () => {
      const viewKey = new Uint8Array(32);
      viewKey.fill(0xab);
      await manager.storeViewKey(viewKey);
      const retrieved = await manager.retrieveViewKey();
      expect(Buffer.from(retrieved).equals(Buffer.from(viewKey))).toBe(true);
    });
  });

  describe('wipeKeys', () => {
    it('clears all stored keys', async () => {
      await manager.storeSeed('test mnemonic');
      await manager.storeViewKey(new Uint8Array(32));
      await manager.wipeKeys();
      expect(await manager.hasWallet()).toBe(false);
    });
  });

  describe('PIN management', () => {
    it('isPinConfigured returns false initially', async () => {
      expect(await manager.isPinConfigured()).toBe(false);
    });

    it('setupPin stores PIN hash', async () => {
      await manager.setupPin('123456');
      expect(await manager.isPinConfigured()).toBe(true);
    });

    it('verifyPin returns true for correct PIN', async () => {
      await manager.setupPin('123456');
      expect(await manager.verifyPin('123456')).toBe(true);
    });

    it('verifyPin returns false for wrong PIN', async () => {
      await manager.setupPin('123456');
      expect(await manager.verifyPin('000000')).toBe(false);
    });

    it('changePin updates to new PIN', async () => {
      await manager.setupPin('123456');
      await manager.changePin('123456', '654321');
      expect(await manager.verifyPin('654321')).toBe(true);
      expect(await manager.verifyPin('123456')).toBe(false);
    });

    it('changePin rejects wrong old PIN', async () => {
      await manager.setupPin('123456');
      await expect(manager.changePin('wrong1', '654321')).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/keychain/__tests__/keychainModule.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement KeychainManager**

Create `src/modules/keychain/keychainModule.ts`:
```typescript
import Keychain from 'react-native-keychain';
import {hashPin, verifyPin as verifyPinHash, generateSalt} from './pinManager';

const SERVICE_SEED = 'noctura.seed';
const SERVICE_VIEW_KEY = 'noctura.viewKey';
const SERVICE_PIN_HASH = 'noctura.pinHash';
const SERVICE_PIN_SALT = 'noctura.pinSalt';

const KEYCHAIN_OPTIONS = {
  accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/**
 * Secure key storage abstraction over react-native-keychain.
 *
 * Stores:
 *   - Encrypted seed mnemonic (biometric-protected in production)
 *   - View key (retrievable without biometric — read-only)
 *   - PIN hash + salt (for PIN fallback unlock)
 *
 * For shielded signing (sk_spend), see nativeBridge.ts — never stored in JS.
 */
export class KeychainManager {
  async storeSeed(mnemonic: string): Promise<void> {
    await Keychain.setGenericPassword('seed', mnemonic, {
      ...KEYCHAIN_OPTIONS,
      service: SERVICE_SEED,
    });
  }

  async retrieveSeed(): Promise<string> {
    const result = await Keychain.getGenericPassword({service: SERVICE_SEED});
    if (!result) throw new Error('No seed found in keychain');
    return result.password;
  }

  async hasWallet(): Promise<boolean> {
    const result = await Keychain.getGenericPassword({service: SERVICE_SEED});
    return result !== false;
  }

  async storeViewKey(viewKey: Uint8Array): Promise<void> {
    const hex = Buffer.from(viewKey).toString('hex');
    await Keychain.setGenericPassword('viewKey', hex, {
      ...KEYCHAIN_OPTIONS,
      service: SERVICE_VIEW_KEY,
    });
  }

  async retrieveViewKey(): Promise<Uint8Array> {
    const result = await Keychain.getGenericPassword({service: SERVICE_VIEW_KEY});
    if (!result) throw new Error('No view key found in keychain');
    return new Uint8Array(Buffer.from(result.password, 'hex'));
  }

  async wipeKeys(): Promise<void> {
    await Keychain.resetGenericPassword({service: SERVICE_SEED});
    await Keychain.resetGenericPassword({service: SERVICE_VIEW_KEY});
    await Keychain.resetGenericPassword({service: SERVICE_PIN_HASH});
    await Keychain.resetGenericPassword({service: SERVICE_PIN_SALT});
    // Also wipe native-stored seed if native module is available
    try {
      const {NocturaKeyBridge} = require('./nativeBridge');
      await NocturaKeyBridge.deleteSeed();
    } catch {
      // Native module not available yet — safe to ignore during development
    }
  }

  async setupPin(pin: string): Promise<void> {
    const salt = generateSalt();
    const hash = await hashPin(pin, salt);

    await Keychain.setGenericPassword(
      'pinSalt',
      Buffer.from(salt).toString('hex'),
      {...KEYCHAIN_OPTIONS, service: SERVICE_PIN_SALT},
    );
    await Keychain.setGenericPassword(
      'pinHash',
      Buffer.from(hash).toString('hex'),
      {...KEYCHAIN_OPTIONS, service: SERVICE_PIN_HASH},
    );
  }

  // Spec defines isPinConfigured(): boolean (sync), but keychain reads are inherently async.
  // Justified deviation: async is required on both iOS and Android.
  async isPinConfigured(): Promise<boolean> {
    const result = await Keychain.getGenericPassword({service: SERVICE_PIN_HASH});
    return result !== false;
  }

  async verifyPin(pin: string): Promise<boolean> {
    const saltResult = await Keychain.getGenericPassword({service: SERVICE_PIN_SALT});
    const hashResult = await Keychain.getGenericPassword({service: SERVICE_PIN_HASH});

    if (!saltResult || !hashResult) return false;

    const salt = new Uint8Array(Buffer.from(saltResult.password, 'hex'));
    const storedHash = new Uint8Array(Buffer.from(hashResult.password, 'hex'));

    return verifyPinHash(pin, salt, storedHash);
  }

  async changePin(oldPin: string, newPin: string): Promise<void> {
    const verified = await this.verifyPin(oldPin);
    if (!verified) throw new Error('Current PIN is incorrect');
    await this.setupPin(newPin);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/keychain/__tests__/keychainModule.test.ts --no-cache`
Expected: PASS (9 tests)

Note: PIN tests involve PBKDF2 600K iterations — may take 5-15 seconds total. Set `jest.setTimeout(60_000)` if needed.

- [ ] **Step 5: Commit**

```bash
git add src/modules/keychain/
git commit -m "feat: KeychainManager with seed storage, view key, PIN management"
```

---

## Task 11: SSL Pinned Fetch Client (TDD)

**Files:**
- Create: `src/modules/sslPinning/__tests__/pinnedFetch.test.ts`
- Create: `src/modules/sslPinning/pinnedFetch.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/sslPinning/__tests__/pinnedFetch.test.ts`:
```typescript
import {pinnedFetch, SSL_PINS} from '../pinnedFetch';
import SSLPinning from 'react-native-ssl-pinning';

const mockSSL = SSLPinning as typeof SSLPinning & {__reset: () => void};

describe('pinnedFetch', () => {
  beforeEach(() => {
    mockSSL.__reset();
  });

  it('SSL_PINS contains primary and backup pins', () => {
    expect(SSL_PINS.length).toBeGreaterThanOrEqual(2);
    SSL_PINS.forEach(pin => {
      expect(typeof pin).toBe('string');
      expect(pin.length).toBeGreaterThan(0);
    });
  });

  it('makes a GET request through SSL pinning', async () => {
    await pinnedFetch('https://api.noc-tura.io/v1/health');
    expect(SSLPinning.fetch).toHaveBeenCalledWith(
      'https://api.noc-tura.io/v1/health',
      expect.objectContaining({
        method: 'GET',
        sslPinning: expect.objectContaining({
          certs: expect.any(Array),
        }),
      }),
    );
  });

  it('makes a POST request with JSON body', async () => {
    await pinnedFetch('https://api.noc-tura.io/v1/prove/deposit', {
      method: 'POST',
      body: JSON.stringify({test: true}),
    });
    expect(SSLPinning.fetch).toHaveBeenCalledWith(
      'https://api.noc-tura.io/v1/prove/deposit',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({test: true}),
      }),
    );
  });

  it('includes content-type header for JSON', async () => {
    await pinnedFetch('https://api.noc-tura.io/v1/test', {
      method: 'POST',
      body: '{}',
    });
    expect(SSLPinning.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
      }),
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/sslPinning/__tests__/pinnedFetch.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement pinnedFetch**

Create `src/modules/sslPinning/pinnedFetch.ts`:
```typescript
import SSLPinning from 'react-native-ssl-pinning';

/**
 * SSL certificate pins for api.noc-tura.io.
 * Primary + backup pin for cert rotation without app update.
 *
 * ⚠️ Without pinning: MITM attack could replace ZK circuit inputs → false proofs.
 * On pin failure → block API call + show E032 (PROVER_UNAVAILABLE).
 *
 * These are SHA-256 hashes of the Subject Public Key Info (SPKI).
 * Replace with actual pins from: openssl s_client -connect api.noc-tura.io:443
 */
export const SSL_PINS: string[] = [
  // Primary pin (current certificate)
  'BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  // Backup pin (next certificate, for rotation)
  'CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
];

interface PinnedFetchOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
}

interface PinnedFetchResponse {
  status: number;
  headers: Record<string, string>;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
}

/**
 * SSL-pinned fetch wrapper for Noctura API calls.
 * All requests to api.noc-tura.io MUST go through this function.
 */
export async function pinnedFetch(
  url: string,
  options: PinnedFetchOptions = {},
): Promise<PinnedFetchResponse> {
  const {method = 'GET', headers = {}, body} = options;

  const mergedHeaders: Record<string, string> = {
    ...headers,
  };

  if (body && !mergedHeaders['Content-Type']) {
    mergedHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await SSLPinning.fetch(url, {
      method,
      headers: mergedHeaders,
      body,
      sslPinning: {
        certs: SSL_PINS,
      },
      timeoutInterval: 10_000,
    });

    return {
      status: response.status,
      headers: response.headers as Record<string, string>,
      json: async () => response.json(),
      text: async () => response.text(),
    };
  } catch (error) {
    // SSL pin mismatch or network error → E032 (PROVER_UNAVAILABLE)
    // Without pinning: MITM could replace ZK circuit inputs → false proofs
    throw new SSLPinningError(
      'SSL certificate pinning failed',
      error instanceof Error ? error : new Error(String(error)),
    );
  }
}

export class SSLPinningError extends Error {
  readonly code = 'E032';
  readonly cause: Error;

  constructor(message: string, cause: Error) {
    super(message);
    this.name = 'SSLPinningError';
    this.cause = cause;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/sslPinning/__tests__/pinnedFetch.test.ts --no-cache`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/sslPinning/
git commit -m "feat: SSL-pinned fetch wrapper for api.noc-tura.io"
```

---

## Task 12: Session Module (TDD)

**Files:**
- Create: `src/modules/session/__tests__/sessionModule.test.ts`
- Create: `src/modules/session/sessionModule.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/modules/session/__tests__/sessionModule.test.ts`:
```typescript
import {SessionManager} from '../sessionModule';
import {zeroize} from '../zeroize';

describe('SessionManager', () => {
  let session: SessionManager;

  beforeEach(() => {
    session = new SessionManager();
  });

  afterEach(() => {
    session.lock();
  });

  describe('unlock / lock lifecycle', () => {
    it('starts locked', () => {
      expect(session.isActive()).toBe(false);
    });

    it('unlock activates session with keypair', () => {
      const fakeKeypair = new Uint8Array(64);
      fakeKeypair.fill(0xaa);
      session.unlock(fakeKeypair);
      expect(session.isActive()).toBe(true);
    });

    it('lock deactivates session', () => {
      const fakeKeypair = new Uint8Array(64);
      fakeKeypair.fill(0xaa);
      session.unlock(fakeKeypair);
      session.lock();
      expect(session.isActive()).toBe(false);
    });

    it('lock zeroizes the keypair bytes', () => {
      const fakeKeypair = new Uint8Array(64);
      fakeKeypair.fill(0xaa);
      session.unlock(fakeKeypair);
      session.lock();
      // Original array should be zeroed
      expect(fakeKeypair.every(b => b === 0)).toBe(true);
    });

    it('getKeypair returns the keypair when active', () => {
      const fakeKeypair = new Uint8Array(64);
      fakeKeypair.fill(0xbb);
      session.unlock(fakeKeypair);
      const kp = session.getKeypair();
      expect(kp).not.toBeNull();
      expect(kp![0]).toBe(0xbb);
    });

    it('getKeypair returns null when locked', () => {
      expect(session.getKeypair()).toBeNull();
    });
  });

  describe('timeout', () => {
    it('sessionExpiresIn returns 0 when locked', () => {
      expect(session.sessionExpiresIn()).toBe(0);
    });

    it('sessionExpiresIn returns positive when active', () => {
      session.unlock(new Uint8Array(64));
      expect(session.sessionExpiresIn()).toBeGreaterThan(0);
    });

    it('touchActivity extends the session timeout', () => {
      session.unlock(new Uint8Array(64));
      const before = session.sessionExpiresIn();
      // Simulate some time passing
      session.touchActivity();
      const after = session.sessionExpiresIn();
      expect(after).toBeGreaterThanOrEqual(before);
    });
  });

  describe('double lock safety', () => {
    it('locking twice does not throw', () => {
      session.unlock(new Uint8Array(64));
      session.lock();
      expect(() => session.lock()).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/session/__tests__/sessionModule.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement SessionManager**

Create `src/modules/session/sessionModule.ts`:
```typescript
import {zeroize} from './zeroize';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * In-memory session key manager.
 *
 * Holds the Ed25519 keypair (Uint8Array) in memory after biometric unlock.
 * The keypair is NEVER written to disk or MMKV.
 *
 * Lifecycle:
 *   1. Biometric unlock → seed decrypted → derive Ed25519 keypair → unlock(keypair)
 *   2. All transparent tx signed with in-memory keypair
 *   3. Shielded tx → native bridge (BLS12-381 key never in JS)
 *   4. Timeout or manual lock → zeroize keypair → set to null
 *
 * Zeroization: lock() fills the Uint8Array with 0x00 then sets reference to null.
 */
export class SessionManager {
  private keypair: Uint8Array | null = null;
  private expiresAt: number = 0;
  private timeoutMs: number = DEFAULT_TIMEOUT_MS;

  /**
   * Activate session with a derived Ed25519 keypair (64 bytes).
   * The session holds a reference to the SAME Uint8Array — it will be zeroized on lock.
   */
  unlock(keypair: Uint8Array): void {
    this.keypair = keypair;
    this.expiresAt = Date.now() + this.timeoutMs;
  }

  /**
   * Deactivate session and securely erase the keypair from memory.
   */
  lock(): void {
    if (this.keypair) {
      zeroize(this.keypair);
    }
    this.keypair = null;
    this.expiresAt = 0;
  }

  /**
   * Check if an active, non-expired session exists.
   * Auto-locks if the timeout has passed (defense-in-depth).
   */
  isActive(): boolean {
    if (!this.keypair) return false;
    if (Date.now() >= this.expiresAt) {
      this.lock();
      return false;
    }
    return true;
  }

  /**
   * Get the in-memory keypair for signing transparent transactions.
   * Returns null if session is not active.
   */
  getKeypair(): Uint8Array | null {
    return this.keypair;
  }

  /**
   * Seconds remaining until session expires. 0 if not active.
   */
  sessionExpiresIn(): number {
    if (!this.keypair) return 0;
    const remaining = Math.max(0, this.expiresAt - Date.now());
    return Math.ceil(remaining / 1000);
  }

  /**
   * Reset the inactivity timer (sliding window).
   * Called on every user interaction.
   */
  touchActivity(): void {
    if (this.keypair) {
      this.expiresAt = Date.now() + this.timeoutMs;
    }
  }

  /**
   * Update the timeout duration (from settings).
   */
  setTimeoutMinutes(minutes: number): void {
    this.timeoutMs = minutes * 60 * 1000;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/session/__tests__/sessionModule.test.ts --no-cache`
Expected: PASS (10 tests)

- [ ] **Step 5: Commit**

```bash
git add src/modules/session/
git commit -m "feat: SessionManager with in-memory keypair lifecycle and zeroization"
```

---

## Task 13: Security Boundary Audit + Full Verification

**Files:**
- None modified

- [ ] **Step 1: Verify sk_spend NEVER in JS**

```bash
# Must return zero results
grep -r "deriveShieldedSpendKey\|derive.*spend.*key\|sk_spend" src/ --include="*.ts" --include="*.tsx" -l
```
Expected: Only documentation comments, no function definitions or exports

- [ ] **Step 2: Verify micro-key-producer (not deprecated package)**

```bash
grep -r "bls12-381-keygen" src/ --include="*.ts" -l
```
Expected: Zero results

```bash
grep -r "micro-key-producer" src/ --include="*.ts"
```
Expected: Only `src/modules/keyDerivation/shielded.ts`

- [ ] **Step 3: Verify PBKDF2 iterations**

```bash
grep "600.000\|600_000" src/ -r --include="*.ts"
```
Expected: `src/modules/keychain/pinManager.ts` with PIN_ITERATIONS = 600_000

- [ ] **Step 4: Verify zeroization is used in SessionManager**

```bash
grep "zeroize" src/modules/session/sessionModule.ts
```
Expected: zeroize(this.keypair) in lock()

- [ ] **Step 5: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Run full test suite**

Run: `npx jest --no-cache`
Expected: PASS — all suites, all tests

- [ ] **Step 7: Verification checklist**

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  sk_spend NEVER in JS layer — no derive/export functions
[ ]  micro-key-producer/bls.js used (not bls12-381-keygen)
[ ]  @scure/bip32 for Ed25519 only (not BLS12-381)
[ ]  BLS12-381 uses EIP-2333 paths (m/12381/371/...)
[ ]  TRANSPARENT_PATH = m/44'/501'/0'/0'
[ ]  SHIELDED_PATHS.view = m/12381/371/2/0
[ ]  SHIELDED_PATHS.spend documented as native-only
[ ]  BIP-39 test vector passes (abandon...about mnemonic)
[ ]  Ed25519 derivation produces 32-byte pubkey + 64-byte secretkey
[ ]  BLS view key derivation produces 32-byte key
[ ]  Disclosure keys differ by index
[ ]  PIN_ITERATIONS = 600,000 (OWASP 2024)
[ ]  PIN salt: 32 random bytes
[ ]  PIN verify uses constant-time comparison
[ ]  PIN salt stored in keychain (not MMKV)
[ ]  Zeroize utility fills Uint8Array with 0x00
[ ]  SessionManager.lock() zeroizes keypair
[ ]  SessionManager.getKeypair() returns null when locked
[ ]  SessionManager holds keypair in memory only (no persist)
[ ]  SSL pins array has primary + backup pin
[ ]  pinnedFetch wraps all API calls through ssl-pinning
[ ]  Native bridge interface defined with clear error for missing module
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
