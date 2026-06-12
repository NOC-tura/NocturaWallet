# Transparent Wallet Import (auto-detect) + Real Send Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user import any standard Solana wallet (Phantom/Solflare SLIP-0010 OR solana-keygen raw-seed) by auto-detecting which derivation holds funds, and wire the transparent SEND to actually sign and broadcast (it is currently mocked).

**Architecture:** Generalize transparent key derivation to a `TransparentScheme` ({slip10, account} | {cli}). Persist the chosen scheme in MMKV so re-derivation on unlock/sign is consistent. During import, a new `SelectAccountScreen` derives candidate addresses, queries on-chain balances, and lets the user pick the funded account. At send time, retrieve the seed from keychain, derive the keypair with the persisted scheme, and broadcast via the existing (unused) `signAndSend`.

**Tech Stack:** React Native 0.84, TypeScript strict, @scure/bip39, micro-key-producer/slip10, @noble/curves/ed25519, @solana/web3.js, react-native-keychain, MMKV, Jest.

**Background context (already done this session):**
- `transparent.ts` derivation already fixed from buggy `@scure/bip32` → SLIP-0010 (`micro-key-producer/slip10`). Pinned vector updated. See [[project_transparent_derivation_bug]].
- `NOCTURA_FEE_TREASURY` set to `KnZ5bRuaCb3JEAYgt9CJ69eWQ7i5dp5cASbTmLj39qr`.
- Target wallet `KnZ5…` confirmed to use the **solana-keygen raw-seed** scheme.

**Test vectors** (mnemonic `abandon abandon … about`, all 24× "abandon" + "about"):
- SLIP-0010 `m/44'/501'/0'/0'` → pubkey hex `f036276246a75b9de3349ed42b15e232f6518fc20f5fcd4f1d64e81f9bd258f7` (base58 `HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk`)
- SLIP-0010 `m/44'/501'/1'/0'` → hex `f8029acf5cbcbdd5ac46ec147f3b78a3df6e5022ef0411db2bab650d329a4cd4`
- solana-keygen raw seed[0..32] → hex `c5785e1865b708938aff8161d573006496663b1aa10834e396dc566869a2c66a` (base58 `EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o`)

---

## File Structure

- `src/modules/keyDerivation/transparent.ts` — MODIFY: add `TransparentScheme`, scheme param, serialization helpers.
- `src/modules/keyDerivation/derivationScheme.ts` — CREATE: MMKV persistence of the chosen scheme.
- `src/modules/keyDerivation/accountDetection.ts` — CREATE: derive candidates + fetch balances.
- `src/constants/mmkvKeys.ts` — MODIFY: add `WALLET_TRANSPARENT_DERIVATION`.
- `src/contexts/OnboardingContext.tsx` — MODIFY: carry the chosen scheme.
- `src/screens/onboarding/SelectAccountScreen.tsx` — CREATE: account-detection UI (import only).
- `src/app/Navigator.tsx` — MODIFY: register `SelectAccount`, route ImportSeed → SelectAccount → SyncWallet.
- `src/screens/onboarding/SuccessScreen.tsx` + `SyncWalletScreen.tsx` — MODIFY: derive with scheme, persist scheme.
- `src/modules/solana/transactionBuilder.ts` — MODIFY: expose instruction builders for signAndSend.
- `src/modules/solana/sendTransaction.ts` — CREATE: derive keypair (scheme-aware) + build spec + signAndSend.
- `src/screens/transparent/SendScreen.tsx` — MODIFY: replace mock (line ~427) with real send.

---

## Task 1: Scheme-aware transparent derivation

**Files:**
- Modify: `src/modules/keyDerivation/transparent.ts`
- Test: `src/modules/keyDerivation/__tests__/transparent.test.ts`

- [ ] **Step 1: Write failing tests** (append inside the existing `describe`)

```typescript
  it('cli scheme matches solana-keygen raw-seed vector', () => {
    const kp = deriveTransparentKeypair(seed, {kind: 'cli'});
    expect(Buffer.from(kp.publicKey).toString('hex')).toBe(
      'c5785e1865b708938aff8161d573006496663b1aa10834e396dc566869a2c66a',
    );
  });

  it('slip10 account 1 matches pinned vector', () => {
    const kp = deriveTransparentKeypair(seed, {kind: 'slip10', account: 1});
    expect(Buffer.from(kp.publicKey).toString('hex')).toBe(
      'f8029acf5cbcbdd5ac46ec147f3b78a3df6e5022ef0411db2bab650d329a4cd4',
    );
  });

  it('default scheme equals slip10 account 0', () => {
    const a = deriveTransparentKeypair(seed);
    const b = deriveTransparentKeypair(seed, {kind: 'slip10', account: 0});
    expect(Buffer.from(a.publicKey).equals(Buffer.from(b.publicKey))).toBe(true);
  });

  it('scheme serialization round-trips', () => {
    expect(schemeToString({kind: 'cli'})).toBe('cli');
    expect(schemeToString({kind: 'slip10', account: 3})).toBe('slip10:3');
    expect(schemeFromString('cli')).toEqual({kind: 'cli'});
    expect(schemeFromString('slip10:3')).toEqual({kind: 'slip10', account: 3});
    expect(schemeFromString(null)).toEqual({kind: 'slip10', account: 0});
    expect(schemeFromString('garbage')).toEqual({kind: 'slip10', account: 0});
  });
```

Add to the import line at top of the test file: `import {deriveTransparentKeypair, schemeToString, schemeFromString} from '../transparent';`

- [ ] **Step 2: Run — expect FAIL** (`schemeToString` undefined, cli arg ignored)

Run: `npx jest transparent.test`
Expected: FAIL

- [ ] **Step 3: Rewrite `transparent.ts`**

```typescript
import {HDKey} from 'micro-key-producer/slip10.js';
import {ed25519} from '@noble/curves/ed25519.js';
import {zeroize} from '../session/zeroize';

interface TransparentKeypair {
  publicKey: Uint8Array; // 32 bytes
  secretKey: Uint8Array; // 64 bytes (privateKey + publicKey, Solana convention)
}

/**
 * Derivation scheme for the transparent (Solana Ed25519) key.
 *  - slip10: BIP-44 SLIP-0010 ed25519 at m/44'/501'/{account}'/0' — Phantom,
 *    Solflare, `solana-keygen --derivation-path`.
 *  - cli: ed25519 from the first 32 bytes of the BIP-39 seed, NO derivation —
 *    the `solana-keygen new` default (no path).
 */
export type TransparentScheme =
  | {kind: 'slip10'; account: number}
  | {kind: 'cli'};

export const DEFAULT_TRANSPARENT_SCHEME: TransparentScheme = {
  kind: 'slip10',
  account: 0,
};

export function schemeToString(s: TransparentScheme): string {
  return s.kind === 'cli' ? 'cli' : `slip10:${s.account}`;
}

export function schemeFromString(v: string | null | undefined): TransparentScheme {
  if (v === 'cli') return {kind: 'cli'};
  if (v && v.startsWith('slip10:')) {
    const n = Number.parseInt(v.slice('slip10:'.length), 10);
    if (Number.isInteger(n) && n >= 0) return {kind: 'slip10', account: n};
  }
  return DEFAULT_TRANSPARENT_SCHEME;
}

export function schemeLabel(s: TransparentScheme): string {
  if (s.kind === 'cli') return 'Solana CLI (solana-keygen)';
  return s.account === 0 ? 'Standard (Phantom/Solflare)' : `Standard · account ${s.account}`;
}

/** Extract the 32-byte ed25519 private key for a scheme (always a fresh copy). */
function privateKeyForScheme(seed: Uint8Array, scheme: TransparentScheme): Uint8Array {
  if (scheme.kind === 'cli') {
    return Uint8Array.from(seed.subarray(0, 32));
  }
  const path = `m/44'/501'/${scheme.account}'/0'`;
  const hd = HDKey.fromMasterSeed(seed).derive(path);
  if (!hd.privateKey || hd.privateKey.length !== 32) {
    throw new Error('Failed to derive private key from seed');
  }
  return Uint8Array.from(hd.privateKey);
}

/**
 * Derive the Solana Ed25519 keypair from a BIP-39 seed for the given scheme
 * (defaults to standard SLIP-0010 account 0).
 *
 * Do NOT use @scure/bip32 here — it implements BIP-32 over secp256k1 and yields
 * a non-standard key matching no mainstream Solana wallet.
 */
export function deriveTransparentKeypair(
  seed: Uint8Array,
  scheme: TransparentScheme = DEFAULT_TRANSPARENT_SCHEME,
): TransparentKeypair {
  const privateKey = privateKeyForScheme(seed, scheme);
  const publicKey = ed25519.getPublicKey(privateKey);
  const secretKey = new Uint8Array(64);
  secretKey.set(privateKey, 0);
  secretKey.set(publicKey, 32);
  zeroize(privateKey);
  return {publicKey, secretKey};
}
```

Note: `TRANSPARENT_PATH` import is dropped from transparent.ts (path is now built from the scheme). Leave `paths.ts` as-is (still used for docs + shielded).

- [ ] **Step 4: Run — expect PASS**

Run: `npx jest transparent.test`
Expected: PASS (all, including the original SLIP-0010 vector)

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add src/modules/keyDerivation/transparent.ts src/modules/keyDerivation/__tests__/transparent.test.ts
git commit -m "feat(keyDerivation): scheme-aware transparent derivation (slip10 + cli)"
```

---

## Task 2: Persist the chosen derivation scheme

**Files:**
- Modify: `src/constants/mmkvKeys.ts` (add key after `WALLET_PUBLIC_KEY`)
- Create: `src/modules/keyDerivation/derivationScheme.ts`
- Test: `src/modules/keyDerivation/__tests__/derivationScheme.test.ts`

- [ ] **Step 1: Add MMKV key**

In `src/constants/mmkvKeys.ts`, after the `WALLET_PUBLIC_KEY` line add:
```typescript
  WALLET_TRANSPARENT_DERIVATION: 'v1_wallet.transparentDerivation',
```

- [ ] **Step 2: Write failing test** `derivationScheme.test.ts`

```typescript
import {storeTransparentScheme, loadTransparentScheme} from '../derivationScheme';
import {mmkvPublic} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';

describe('transparent derivation scheme persistence', () => {
  afterEach(() => mmkvPublic.remove(MMKV_KEYS.WALLET_TRANSPARENT_DERIVATION));

  it('defaults to slip10 account 0 when unset', () => {
    expect(loadTransparentScheme()).toEqual({kind: 'slip10', account: 0});
  });

  it('round-trips a cli scheme', () => {
    storeTransparentScheme({kind: 'cli'});
    expect(loadTransparentScheme()).toEqual({kind: 'cli'});
  });

  it('round-trips a slip10 account-2 scheme', () => {
    storeTransparentScheme({kind: 'slip10', account: 2});
    expect(loadTransparentScheme()).toEqual({kind: 'slip10', account: 2});
  });
});
```

- [ ] **Step 3: Run — expect FAIL** (module missing)

Run: `npx jest derivationScheme.test`
Expected: FAIL

- [ ] **Step 4: Implement `derivationScheme.ts`**

```typescript
import {mmkvPublic} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {
  schemeToString,
  schemeFromString,
  type TransparentScheme,
} from './transparent';

/** Persist the user's chosen transparent derivation scheme (non-secret metadata). */
export function storeTransparentScheme(scheme: TransparentScheme): void {
  mmkvPublic.set(MMKV_KEYS.WALLET_TRANSPARENT_DERIVATION, schemeToString(scheme));
}

/** Load the persisted scheme; defaults to standard SLIP-0010 account 0. */
export function loadTransparentScheme(): TransparentScheme {
  return schemeFromString(
    mmkvPublic.getString(MMKV_KEYS.WALLET_TRANSPARENT_DERIVATION),
  );
}
```

- [ ] **Step 5: Run — expect PASS**; then `npx tsc --noEmit` (exit 0)

- [ ] **Step 6: Commit**

```bash
git add src/constants/mmkvKeys.ts src/modules/keyDerivation/derivationScheme.ts src/modules/keyDerivation/__tests__/derivationScheme.test.ts
git commit -m "feat(keyDerivation): persist chosen transparent derivation scheme in MMKV"
```

---

## Task 3: Account-detection module

**Files:**
- Create: `src/modules/keyDerivation/accountDetection.ts`
- Test: `src/modules/keyDerivation/__tests__/accountDetection.test.ts`

Candidate set: SLIP-0010 accounts 0..4, plus cli. For each, derive the base58 address and fetch SOL balance (lamports) + NOC balance (smallest unit). Returns candidates sorted so funded ones come first.

- [ ] **Step 1: Write failing test** (mock the queries module)

```typescript
import {detectFundedAccounts} from '../accountDetection';
import {mnemonicToSeed} from '../mnemonicUtils';
import * as queries from '../../solana/queries';

jest.mock('../../solana/connection', () => ({getConnection: () => ({}) as never}));

const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('detectFundedAccounts', () => {
  it('flags the cli account as funded and returns all candidates', async () => {
    const seed = await mnemonicToSeed(ABANDON);
    jest.spyOn(queries, 'getBalance').mockImplementation(async (_c, pk) =>
      pk.toBase58() === 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o' ? 17_000_000_000n : 0n,
    );
    jest.spyOn(queries, 'getTokenAccounts').mockResolvedValue([]);

    const result = await detectFundedAccounts(seed);

    const cli = result.find(c => c.scheme.kind === 'cli');
    expect(cli?.address).toBe('EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o');
    expect(cli?.lamports).toBe(17_000_000_000n);
    expect(cli?.funded).toBe(true);
    // funded candidate sorts first
    expect(result[0].scheme.kind).toBe('cli');
    // slip10 account 0 present
    expect(result.some(c => c.scheme.kind === 'slip10' && c.scheme.account === 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (module missing)

Run: `npx jest accountDetection.test`
Expected: FAIL

- [ ] **Step 3: Implement `accountDetection.ts`**

```typescript
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {getBalance, getTokenAccounts} from '../solana/queries';
import {NOC_MINT} from '../../constants/programs';
import {deriveTransparentKeypair, type TransparentScheme} from './transparent';

export interface AccountCandidate {
  scheme: TransparentScheme;
  address: string;
  lamports: bigint;
  nocAmount: bigint; // NOC in smallest unit (decimals=9)
  funded: boolean;
}

const SLIP10_ACCOUNTS_TO_SCAN = 5; // accounts 0..4

function candidateSchemes(): TransparentScheme[] {
  const schemes: TransparentScheme[] = [];
  for (let i = 0; i < SLIP10_ACCOUNTS_TO_SCAN; i++) {
    schemes.push({kind: 'slip10', account: i});
  }
  schemes.push({kind: 'cli'});
  return schemes;
}

/**
 * Derive every candidate address from the seed and query its on-chain SOL + NOC
 * balance. Funded candidates are sorted first. Never throws on per-account RPC
 * failure — a failed lookup is treated as zero balance.
 */
export async function detectFundedAccounts(seed: Uint8Array): Promise<AccountCandidate[]> {
  const connection = getConnection();
  const candidates = await Promise.all(
    candidateSchemes().map(async scheme => {
      const {publicKey} = deriveTransparentKeypair(seed, scheme);
      const pk = new PublicKey(publicKey);
      let lamports = 0n;
      let nocAmount = 0n;
      try {
        lamports = await getBalance(connection, pk);
      } catch {
        lamports = 0n;
      }
      try {
        const accounts = await getTokenAccounts(connection, pk);
        for (const acc of accounts) {
          if (acc.mint === NOC_MINT) nocAmount += BigInt(acc.amount);
        }
      } catch {
        nocAmount = 0n;
      }
      return {
        scheme,
        address: pk.toBase58(),
        lamports,
        nocAmount,
        funded: lamports > 0n || nocAmount > 0n,
      };
    }),
  );
  return candidates.sort((a, b) => (a.funded === b.funded ? 0 : a.funded ? -1 : 1));
}
```

- [ ] **Step 4: Run — expect PASS**; then `npx tsc --noEmit` (exit 0)

- [ ] **Step 5: Commit**

```bash
git add src/modules/keyDerivation/accountDetection.ts src/modules/keyDerivation/__tests__/accountDetection.test.ts
git commit -m "feat(keyDerivation): on-chain account detection for import"
```

---

## Task 4: Carry scheme through OnboardingContext

**Files:**
- Modify: `src/contexts/OnboardingContext.tsx`

- [ ] **Step 1: Add scheme to the context**

Replace the interface + provider state. Add to `OnboardingState`:
```typescript
  scheme: TransparentScheme;
  setScheme: (s: TransparentScheme) => void;
```
Add import: `import {DEFAULT_TRANSPARENT_SCHEME, type TransparentScheme} from '../modules/keyDerivation/transparent';`
In the provider add: `const [scheme, setSchemeState] = useState<TransparentScheme>(DEFAULT_TRANSPARENT_SCHEME);` and `const setScheme = useCallback((s: TransparentScheme) => setSchemeState(s), []);` and include `scheme, setScheme` in the provider `value`. In `clearMnemonic`, also reset: `setSchemeState(DEFAULT_TRANSPARENT_SCHEME);`

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/contexts/OnboardingContext.tsx
git commit -m "feat(onboarding): carry chosen derivation scheme in context"
```

---

## Task 5: SelectAccountScreen (import-only account picker)

**Files:**
- Create: `src/screens/onboarding/SelectAccountScreen.tsx`

UI contract:
```typescript
interface SelectAccountScreenProps {
  mnemonic: string;
  onSelect: (scheme: TransparentScheme) => void;
  onBack?: () => void;
}
```
Behaviour on mount: `mnemonicToSeed(mnemonic)` → `detectFundedAccounts(seed)` → `zeroize(seed)` → setState(candidates). While loading show an ActivityIndicator ("Looking for your accounts…"). Render each candidate as a selectable row: `schemeLabel(scheme)`, truncated address (`formatAddress`), and balance (`formatTokenAmount(lamports, 9)` SOL + NOC if >0). Funded rows show a "Funded" badge and are pre-selected (first funded, else slip10:0). Sticky "Continue" calls `onSelect(selectedScheme)`. If detection fails entirely, show all candidates with "Balance unavailable" and still allow manual choice; never block the user. FLAG_SECURE via `ScreenSecurityManager` (mirror ImportSeedScreen) since addresses derive from the seed in memory.

- [ ] **Step 1: Implement the screen** following the contract above, reusing components from `../../components/ui` (`Text`, `Button`, `Card`), `formatAddress` from `../../utils/formatAddress`, `formatTokenAmount` from `../../utils/parseTokenAmount` (verify exact util paths with `grep -rn "export function formatTokenAmount" src/utils`), `detectFundedAccounts` + `AccountCandidate` from `../../modules/keyDerivation/accountDetection`, `schemeLabel` + `TransparentScheme` from `../../modules/keyDerivation/transparent`, `mnemonicToSeed` from `../../modules/keyDerivation/mnemonicUtils`, `zeroize` from `../../modules/session/zeroize`.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add src/screens/onboarding/SelectAccountScreen.tsx
git commit -m "feat(onboarding): SelectAccountScreen with on-chain account detection"
```

---

## Task 6: Wire SelectAccount into the import navigation

**Files:**
- Modify: `src/app/Navigator.tsx`

- [ ] **Step 1: Register the route** — add `SelectAccount: undefined;` to `OnboardingStackParamList`, import `SelectAccountScreen`, and add `<Stack.Screen name="SelectAccount" component={SelectAccountScreenNav} />` alongside the other onboarding screens.

- [ ] **Step 2: Add the nav wrapper**

```typescript
function SelectAccountScreenNav() {
  const {mnemonic, setScheme} = useOnboarding();
  const navigation = useNavigation<NativeStackNavigationProp<OnboardingStackParamList>>();
  return (
    <SelectAccountScreen
      mnemonic={mnemonic ?? ''}
      onSelect={scheme => {
        setScheme(scheme);
        navigation.navigate('SyncWallet');
      }}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
    />
  );
}
```

- [ ] **Step 3: Redirect import flow** — in `ImportSeedScreenNav`, change the `onMnemonicValidated` body from `navigation.navigate('SyncWallet')` to `navigation.navigate('SelectAccount')` (keep `setMnemonic(mnemonic)`).

(Create flow is unchanged: it never visits SelectAccount, so its scheme stays `DEFAULT_TRANSPARENT_SCHEME`.)

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add src/app/Navigator.tsx
git commit -m "feat(onboarding): route import through SelectAccount before sync"
```

---

## Task 7: Derive + persist with the chosen scheme

**Files:**
- Modify: `src/screens/onboarding/SuccessScreen.tsx`
- Modify: `src/screens/onboarding/SyncWalletScreen.tsx`
- Modify: `src/app/Navigator.tsx` (pass `scheme` prop to both)

- [ ] **Step 1: SuccessScreen** — add `scheme: TransparentScheme` to `SuccessScreenProps`. Import `{type TransparentScheme}` from transparent and `storeTransparentScheme` from `../../modules/keyDerivation/derivationScheme`. In the derive effect, change `deriveTransparentKeypair(seed)` → `deriveTransparentKeypair(seed, scheme)` and add `scheme` to the effect deps. In `handleOpenWallet`, after `setPublicKey`, add `storeTransparentScheme(scheme);`.

- [ ] **Step 2: SyncWalletScreen** — same: add `scheme` prop, pass it to `deriveTransparentKeypair(seed, scheme)` at line ~88.

- [ ] **Step 3: Navigator** — `SuccessScreenNav` and `SyncWalletScreenNav` read `const {scheme} = useOnboarding();` and pass `scheme={scheme}` to the screens.

- [ ] **Step 4: Type-check + run onboarding tests**

Run: `npx tsc --noEmit && npx jest SuccessScreen SyncWallet`
Expected: exit 0; tests pass (SuccessScreen test mocks derivation, so the extra arg is harmless — if a test asserts call args, update it to expect the scheme).

- [ ] **Step 5: Commit**

```bash
git add src/screens/onboarding/SuccessScreen.tsx src/screens/onboarding/SyncWalletScreen.tsx src/app/Navigator.tsx
git commit -m "feat(onboarding): derive + persist wallet using chosen scheme"
```

---

## Task 8: Expose transfer instruction builders for signAndSend

**Files:**
- Modify: `src/modules/solana/transactionBuilder.ts`
- Test: `src/modules/solana/__tests__/transactionBuilder.test.ts`

`signAndSend` needs a `TransactionSpec {payer, instructions}` so it can rebuild with a fresh blockhash per retry. Today only `buildTransferTx`/`buildSPLTransferTx` exist (they fetch their own blockhash and return a built tx). Extract the instruction lists.

- [ ] **Step 1: Write failing test**

```typescript
import {buildTransferInstructions, buildSPLTransferInstructions} from '../transactionBuilder';
import {PublicKey} from '@solana/web3.js';

const A = new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
const B = new PublicKey('EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o');

describe('instruction builders', () => {
  it('SOL transfer yields transfer + fee-markup instructions', () => {
    const ix = buildTransferInstructions({sender: A, recipient: B, lamports: 1_000n});
    // recipient transfer + Noctura fee markup transfer = 2 (no priority fee)
    expect(ix.length).toBe(2);
  });

  it('priority fee prepends a compute-budget instruction', () => {
    const ix = buildTransferInstructions({sender: A, recipient: B, lamports: 1_000n, priorityFee: 15_000});
    expect(ix.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest transactionBuilder.test`
Expected: FAIL (functions undefined)

- [ ] **Step 3: Refactor** — add exported `buildTransferInstructions(params: TransferParams): TransactionInstruction[]` and `buildSPLTransferInstructions(params: SPLTransferParams): TransactionInstruction[]` that return the `instructions` arrays currently built inside `buildTransferTx`/`buildSPLTransferTx` (everything except the `getLatestBlockhash`/`compileToV0Message`/`new VersionedTransaction` lines). Then reimplement `buildTransferTx`/`buildSPLTransferTx` to call the new instruction builders, so behaviour is identical:

```typescript
export async function buildTransferTx(params: TransferParams): Promise<VersionedTransaction> {
  const connection = getConnection();
  const {blockhash} = await connection.getLatestBlockhash();
  const message = new TransactionMessage({
    payerKey: params.sender,
    recentBlockhash: blockhash,
    instructions: buildTransferInstructions(params),
  }).compileToV0Message();
  return new VersionedTransaction(message);
}
```
(Apply the analogous change to `buildSPLTransferTx` using `buildSPLTransferInstructions`.)

- [ ] **Step 4: Run — expect PASS** (new + existing builder tests)

Run: `npx jest transactionBuilder.test`
Expected: PASS

- [ ] **Step 5: Type-check + commit**

```bash
npx tsc --noEmit
git add src/modules/solana/transactionBuilder.ts src/modules/solana/__tests__/transactionBuilder.test.ts
git commit -m "refactor(solana): expose transfer instruction builders for signAndSend"
```

---

## Task 9: Real send module (derive keypair + signAndSend)

**Files:**
- Create: `src/modules/solana/sendTransaction.ts`
- Test: `src/modules/solana/__tests__/sendTransaction.test.ts`

- [ ] **Step 1: Write failing test** (mock keychain, connection, signAndSend)

```typescript
import {sendTransparentTransfer} from '../sendTransaction';
import * as signAndSendMod from '../signAndSend';
import {KeychainManager} from '../../keychain/keychainModule';
import {PublicKey} from '@solana/web3.js';

jest.mock('../connection', () => ({getConnection: () => ({}) as never}));

const ABANDON =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

describe('sendTransparentTransfer', () => {
  it('derives the cli signer and broadcasts, returning the signature', async () => {
    jest.spyOn(KeychainManager.prototype, 'retrieveSeed').mockResolvedValue(ABANDON);
    const spy = jest
      .spyOn(signAndSendMod, 'signAndSend')
      .mockResolvedValue({signature: 'SIG123', confirmationStatus: 'confirmed'});

    const result = await sendTransparentTransfer({
      kind: 'sol',
      recipient: new PublicKey('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'),
      lamports: 1_000n,
      priorityFee: 0,
      scheme: {kind: 'cli'},
    });

    expect(result.signature).toBe('SIG123');
    // payer === cli address for the abandon seed
    const spec = spy.mock.calls[0][1];
    expect(spec.payer.toBase58()).toBe('EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o');
    const signers = spy.mock.calls[0][2];
    expect(signers[0].publicKey.toBase58()).toBe('EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o');
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx jest sendTransaction.test`
Expected: FAIL (module missing)

- [ ] **Step 3: Implement `sendTransaction.ts`**

```typescript
import {Keypair, PublicKey} from '@solana/web3.js';
import {getConnection} from './connection';
import {signAndSend} from './signAndSend';
import {buildTransferInstructions, buildSPLTransferInstructions} from './transactionBuilder';
import type {SignAndSendResult} from './types';
import {KeychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveTransparentKeypair, type TransparentScheme} from '../keyDerivation/transparent';
import {zeroize} from '../session/zeroize';

export type SendTransparentParams =
  | {
      kind: 'sol';
      recipient: PublicKey;
      lamports: bigint;
      priorityFee: number;
      scheme: TransparentScheme;
    }
  | {
      kind: 'spl';
      recipient: PublicKey;
      mint: PublicKey;
      amount: bigint;
      decimals: number;
      createAta: boolean;
      priorityFee: number;
      scheme: TransparentScheme;
    };

const keychainManager = new KeychainManager();

/**
 * Retrieve the seed (biometric/passcode gated), derive the signer with the
 * persisted scheme, build instructions, and broadcast via signAndSend.
 * The 64-byte secret key is zeroized in a finally block.
 */
export async function sendTransparentTransfer(
  params: SendTransparentParams,
): Promise<SignAndSendResult> {
  const mnemonic = await keychainManager.retrieveSeed();
  const seed = await mnemonicToSeed(mnemonic);
  const {secretKey} = deriveTransparentKeypair(seed, params.scheme);
  zeroize(seed);
  try {
    const signer = Keypair.fromSecretKey(secretKey);
    const sender = signer.publicKey;
    const priorityFee = params.priorityFee > 0 ? params.priorityFee : undefined;

    const instructions =
      params.kind === 'sol'
        ? buildTransferInstructions({
            sender,
            recipient: params.recipient,
            lamports: params.lamports,
            priorityFee,
          })
        : buildSPLTransferInstructions({
            sender,
            recipient: params.recipient,
            mint: params.mint,
            amount: params.amount,
            decimals: params.decimals,
            createAta: params.createAta,
            priorityFee,
          });

    return await signAndSend(getConnection(), {payer: sender, instructions}, [signer]);
  } finally {
    zeroize(secretKey);
  }
}
```

(Verify `TransferParams`/`SPLTransferParams` field names match: `sender, recipient, lamports|amount, mint, decimals, createAta, priorityFee`.)

- [ ] **Step 4: Run — expect PASS**; then `npx tsc --noEmit` (exit 0)

- [ ] **Step 5: Commit**

```bash
git add src/modules/solana/sendTransaction.ts src/modules/solana/__tests__/sendTransaction.test.ts
git commit -m "feat(solana): real transparent send — derive scheme signer + signAndSend"
```

---

## Task 10: Replace the SendScreen mock with the real send

**Files:**
- Modify: `src/screens/transparent/SendScreen.tsx` (lazy-require block ~52-65 and broadcast block ~425-435)

- [ ] **Step 1: Lazy-require the send module** — in the `try` block at line ~56, add:
```typescript
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  sendTransparentTransfer = require('../../modules/solana/sendTransaction').sendTransparentTransfer;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  loadTransparentScheme = require('../../modules/keyDerivation/derivationScheme').loadTransparentScheme;
```
and declare the matching `let sendTransparentTransfer: ... | null = null;` / `let loadTransparentScheme: (() => import('../../modules/keyDerivation/transparent').TransparentScheme) | null = null;` near the other lazy lets (types can be `any`-free via `typeof import(...)`).

- [ ] **Step 2: Replace the mock broadcast** — replace the block starting `let signature = 'mock_signature';` (line ~427) through the fake `tx_${Date.now()}` assignment with a real call. The recipient is `recipient` (string → `new PublicKey(recipient)`), amount is parsed from `amount` + `selectedToken.decimals`, and the scheme comes from `loadTransparentScheme()`. For SOL (`selectedToken.mint === SOL_MINT`) send `kind:'sol'` with `lamports`; otherwise `kind:'spl'` with `mint`, `amount`, `decimals`, and `createAta` (use the existing ATA-existence check already computed in this screen, else `true`). Example:
```typescript
      let signature: string;
      if (sendTransparentTransfer && loadTransparentScheme) {
        const scheme = loadTransparentScheme();
        const recipientPk = new PublicKey(recipient);
        const priorityFee = Number(PRIORITY_FEE_LAMPORTS[priorityLevel]); // microLamports tier
        if (selectedToken.mint === SOL_MINT) {
          const lamports = parseTokenAmount(amount, SOL_DECIMALS);
          const res = await sendTransparentTransfer({
            kind: 'sol', recipient: recipientPk, lamports, priorityFee, scheme,
          });
          signature = res.signature;
        } else {
          const splAmount = parseTokenAmount(amount, selectedToken.decimals);
          const res = await sendTransparentTransfer({
            kind: 'spl', recipient: recipientPk, mint: new PublicKey(selectedToken.mint),
            amount: splAmount, decimals: selectedToken.decimals, createAta: true, priorityFee, scheme,
          });
          signature = res.signature;
        }
      } else {
        throw new Error('Send unavailable');
      }
```
(Use the screen's existing `parseTokenAmount` import; if absent, import from `../../utils/parseTokenAmount`. Confirm `PRIORITY_FEE_LAMPORTS` values are the microLam-per-CU price you want passed as `priorityFee`; the builder treats `priorityFee` as `setComputeUnitPrice` microLamports — keep the existing tier semantics.)

- [ ] **Step 3: Wrap broadcast errors** — keep the existing `try/catch` around the send; on throw, surface the error to the user (route to TransactionStatus with a failed state or show an inline error) instead of faking success. Do NOT swallow the error into a fake signature.

- [ ] **Step 4: Type-check + run SendScreen tests**

Run: `npx tsc --noEmit && npx jest SendScreen`
Expected: exit 0; update the SendScreen test if it asserted the old mock signature.

- [ ] **Step 5: Commit**

```bash
git add src/screens/transparent/SendScreen.tsx
git commit -m "feat(send): broadcast real transparent transactions (replace mock)"
```

---

## Task 11: Full suite + lint gate

- [ ] **Step 1:** `npx tsc --noEmit` → exit 0
- [ ] **Step 2:** `npx eslint src/modules/keyDerivation src/modules/solana src/screens/onboarding src/screens/transparent src/app/Navigator.tsx` → no errors
- [ ] **Step 3:** `npx jest` → all pass (fix any snapshot/arg-assertion fallout)
- [ ] **Step 4: Commit** any test updates: `git commit -am "test: align suite with scheme-aware derivation + real send"`

---

## Task 12: Build, sideload, staged on-chain test (manual)

Follow [[project_android_transparent_v1]] runbook. **Test on a SMALL throwaway amount first — this signs real mainnet transactions.**

- [ ] **Step 1:** `.env` → mainnet (Helius key `5ce4e1fe-…`, `NETWORK=mainnet-beta`, `API_BASE=https://api.noc-tura.io/v1`); backup current `.env` first.
- [ ] **Step 2:** `cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy APK → `/home/user/Downloads/`; restore `.env`.
- [ ] **Step 3 (Stage A):** Install; import the `KnZ5…` seed → SelectAccount should flag the **Solana CLI** candidate as funded (`KnZ5…39qr`, ~17 SOL + 69M NOC). Select it; finish onboarding.
- [ ] **Step 4 (Stage B):** Dashboard shows the real `KnZ5…` SOL + NOC balance.
- [ ] **Step 5 (Stage C):** Send a tiny amount (e.g. 0.001 SOL) to another address you control. Confirm: real signature on an explorer, recipient credited, 20k-lamport markup landed in `NOCTURA_FEE_TREASURY` (= `KnZ5…`, so net-self for this wallet).

---

## Self-Review Notes

- **Security:** importing `KnZ5…` puts the project admin/treasury key on the phone (signs real admin-capable txs). Flagged with the user; their decision. Consider a dedicated low-value hot wallet for routine mobile use.
- **Scheme persistence is mandatory:** the app stores the mnemonic (not the secretKey) and re-derives on each send (Task 9), so the scheme MUST be persisted (Task 2) and read at send time (Task 10). Verified against the storage flow.
- **Create vs import:** create flow never sets a non-default scheme, so new wallets stay SLIP-0010 account 0 (Phantom-portable). Good.
- **signAndSend already simulates-skipped** (`skipPreflight: true`); SendScreen simulates separately before broadcast — keep that pre-broadcast simulation.
