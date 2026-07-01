# Shielded Real Multi-Token Balance + Per-Token Shield — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the shielded dashboard show the user's REAL shielded balances (read per-SPL-mint from the encrypted note store), wire the secure note store to initialize app-wide, show the real on-chain anonymity set, and let the user pick which pool-backed token to shield.

**Architecture:** Notes live in the encrypted MMKV (local; the wallet created them on deposit). A shared seed-derived key initializes that store at unlock + onboarding. The dashboard shielded view aggregates `noteStore.getBalance(mint)` over a config list of pool mints (× existing prices for USD), and reads the pool `merkle_tree`'s `next_leaf_index` (RPC) for the anonymity set. The shield flow threads a selected mint from #16 → #18 → `depositShield`. Multi-token by construction; devnet demonstrates it with the AtjVK test mint.

**Tech Stack:** TypeScript strict, react-native-mmkv (encrypted), Zustand, @solana/web3.js (getAccountInfo), @noble/hashes (sha256), NativeWind, jest.

**Spec:** `docs/superpowers/specs/2026-07-01-shielded-multitoken-balance-design.md`

**Reused / key existing code:**
- `store/mmkv/instances.ts` — `initSecureMmkv(key)`, `mmkvSecure()`.
- `src/modules/shielded/noteStore.ts` — `getBalance(mint)`, `getNotes(mint)`.
- `src/modules/shielded/depositFlow.ts` — inline `ensureSecureMmkv(seed)` (to be refactored to the shared derivation).
- `src/modules/shielded/poolPdas.ts` — `poolPda(mint)`, `merkleTreePda(pool)`.
- `src/screens/UnlockScreen.tsx` — `onUnlock` success callback; `src/screens/onboarding/SuccessScreen.tsx` — `handleOpenWallet` (has the seed).
- `src/modules/keychain/keychainModule.ts` — `keychainManager.retrieveSeed()`; `mnemonicToSeed`; `zeroize`.
- `src/constants/programs.ts` — `SHIELDED_DEVNET_MINT`, `NOC_MINT`, `IS_DEVNET`.
- `src/components/TokenSelector.tsx` (used in `DepositScreen`) — token picker.
- `src/screens/dashboard/DashboardScreen.tsx` — shielded view; hardcoded `Anonymity set · 1,284` (~line 531).
- `src/screens/shielded/ShieldUnshieldScreen.tsx` — `handleSubmit` navigates to `ZkProofModal` with `{direction, amount, recipient}`.
- `src/screens/shielded/ZkProofScreen.tsx` — `runDepositShield` (currently hardcodes `SHIELDED_DEVNET_MINT`).

---

### Task 1: Shared secure-storage key derivation

**Files:**
- Create: `src/modules/keychain/secureStorageKey.ts`
- Test: `src/modules/keychain/__tests__/secureStorageKey.test.ts`
- Modify: `src/modules/shielded/depositFlow.ts` (use the shared fn)

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/keychain/__tests__/secureStorageKey.test.ts
import {sha256} from '@noble/hashes/sha2.js';
import {deriveSecureStorageKey} from '../secureStorageKey';

describe('deriveSecureStorageKey', () => {
  const seed = new Uint8Array(64).map((_v, i) => (i * 7 + 1) & 0xff);
  it('is the first 16 bytes of sha256(seed || domain) as hex (32 chars)', () => {
    const domain = new TextEncoder().encode('noctura-secure-mmkv-v1');
    const material = new Uint8Array(seed.length + domain.length);
    material.set(seed); material.set(domain, seed.length);
    const h = sha256(material);
    let expected = '';
    for (let i = 0; i < 16; i++) expected += h[i]!.toString(16).padStart(2, '0');
    expect(deriveSecureStorageKey(seed)).toBe(expected);
    expect(deriveSecureStorageKey(seed)).toHaveLength(32);
  });
  it('is deterministic + differs for a different seed', () => {
    expect(deriveSecureStorageKey(seed)).toBe(deriveSecureStorageKey(seed));
    const other = new Uint8Array(64).fill(9);
    expect(deriveSecureStorageKey(other)).not.toBe(deriveSecureStorageKey(seed));
  });
});
```

- [ ] **Step 2: Run** `npx jest secureStorageKey` → FAIL (module not found).

- [ ] **Step 3: Implement** `src/modules/keychain/secureStorageKey.ts`:

```ts
import {sha256} from '@noble/hashes/sha2.js';

/**
 * Deterministic encryption key for the secure (encrypted) MMKV note store,
 * derived from the BIP-39 seed: first 16 bytes of sha256(seed || domain), hex.
 * Same value across sessions → notes persist + decrypt; recoverable from the
 * mnemonic. Shared by the app-wide init (unlock/onboarding) and the deposit-flow
 * safety net so both open the SAME store.
 */
export function deriveSecureStorageKey(seed: Uint8Array): string {
  const domain = new TextEncoder().encode('noctura-secure-mmkv-v1');
  const material = new Uint8Array(seed.length + domain.length);
  material.set(seed);
  material.set(domain, seed.length);
  const hash = sha256(material);
  let keyHex = '';
  for (let i = 0; i < 16; i++) {
    keyHex += hash[i]!.toString(16).padStart(2, '0');
  }
  return keyHex;
}
```

Then in `depositFlow.ts` replace the inline body of `ensureSecureMmkv` so it uses the shared fn (keep the `if (mmkvSecure()) return;` guard):

```ts
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
// ...
function ensureSecureMmkv(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
}
```
Remove the now-unused `sha256` import from `depositFlow.ts` if nothing else uses it (grep the file first). The domain string MUST stay `noctura-secure-mmkv-v1` (byte-identical to the previously-shipped derivation, so existing devnet notes still decrypt).

- [ ] **Step 4: Run** `npx jest secureStorageKey depositFlow` → PASS. `npx tsc --noEmit` clean.

- [ ] **Step 5: Commit**
```bash
git add src/modules/keychain/secureStorageKey.ts src/modules/keychain/__tests__/secureStorageKey.test.ts src/modules/shielded/depositFlow.ts
git commit -m "refactor(shielded): extract shared deriveSecureStorageKey"
```

---

### Task 2: Initialize the secure MMKV app-wide (unlock + onboarding)

**Files:**
- Create: `src/modules/session/secureStorageSession.ts`
- Modify: `src/screens/UnlockScreen.tsx` (call on unlock success)
- Modify: `src/screens/onboarding/SuccessScreen.tsx` (call in `handleOpenWallet`)
- Test: `src/modules/session/__tests__/secureStorageSession.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/session/__tests__/secureStorageSession.test.ts
jest.mock('../../keychain/keychainModule', () => ({
  keychainManager: {retrieveSeed: jest.fn().mockResolvedValue('mnemonic words here')},
}));
jest.mock('../../keyDerivation/mnemonicUtils', () => ({
  mnemonicToSeed: jest.fn().mockResolvedValue(new Uint8Array(64).fill(3)),
}));
jest.mock('../../../store/mmkv/instances', () => ({
  initSecureMmkv: jest.fn(),
  mmkvSecure: jest.fn(() => null),
}));
import {unlockSecureStorage} from '../secureStorageSession';
import {initSecureMmkv} from '../../../store/mmkv/instances';

describe('unlockSecureStorage', () => {
  it('retrieves the seed and initializes the secure MMKV with the derived key', async () => {
    await unlockSecureStorage();
    expect(initSecureMmkv).toHaveBeenCalledWith(expect.any(String));
    const key = (initSecureMmkv as jest.Mock).mock.calls[0][0];
    expect(key).toHaveLength(32); // 16-byte hex
  });
});
```

- [ ] **Step 2: Run** `npx jest secureStorageSession` → FAIL.

- [ ] **Step 3: Implement** `src/modules/session/secureStorageSession.ts`:

```ts
import {keychainManager} from '../keychain/keychainModule';
import {mnemonicToSeed} from '../keyDerivation/mnemonicUtils';
import {deriveSecureStorageKey} from '../keychain/secureStorageKey';
import {zeroize} from './zeroize';
import {initSecureMmkv, mmkvSecure} from '../../store/mmkv/instances';

/**
 * Initialize the encrypted note-store MMKV for this session. Retrieves the seed
 * (biometric/keychain), derives the storage key, inits the store, zeroizes the
 * seed. Idempotent — no-op if the store is already open. Call once per session
 * (unlock success + onboarding completion) so the dashboard can read notes.
 */
export async function unlockSecureStorage(): Promise<void> {
  if (mmkvSecure()) return;
  let seed: Uint8Array | null = null;
  try {
    const mnemonic = await keychainManager.retrieveSeed();
    seed = await mnemonicToSeed(mnemonic);
    initSecureMmkv(deriveSecureStorageKey(seed));
  } finally {
    if (seed) zeroize(seed);
  }
}

/** Like unlockSecureStorage but the seed is already in hand (onboarding). */
export function unlockSecureStorageWithSeed(seed: Uint8Array): void {
  if (mmkvSecure()) return;
  initSecureMmkv(deriveSecureStorageKey(seed));
}
```

- **UnlockScreen.tsx:** find where a successful unlock calls `onUnlock()` (PIN verified OR biometric success). Immediately BEFORE `onUnlock()`, `await unlockSecureStorage()` inside the existing async success handler (import it). Wrap in try/catch that logs nothing sensitive and still proceeds to `onUnlock()` on failure (a failed secure-store init must not block entering the app — the dashboard treats a null store as "empty", Task 5). Read the file to place it in BOTH the PIN-success and biometric-success paths (or a single shared success fn if one exists).
- **SuccessScreen.tsx `handleOpenWallet`:** after `await keychainManager.storeSeed(mnemonic)` succeeds and BEFORE `onComplete()`, call `unlockSecureStorageWithSeed(seedForThisFlow)`. The screen derived a `seed` in the mount effect but zeroized it; re-derive it here: `const seed = await mnemonicToSeed(mnemonic); unlockSecureStorageWithSeed(seed); zeroize(seed);` (import `mnemonicToSeed`, `zeroize`, `unlockSecureStorageWithSeed`). Place it inside the existing try block.

- [ ] **Step 4: Run** `npx jest secureStorageSession && npx tsc --noEmit` → PASS/clean. Also run `npx jest UnlockScreen SuccessScreen` and fix any mock gaps minimally (mock `../../modules/session/secureStorageSession` in those screen tests if they don't already tolerate the new call).

- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(shielded): initialize secure note store at unlock + onboarding"
```

---

### Task 3: Shielded-pool mints config + metadata

**Files:**
- Modify: `src/constants/programs.ts`
- Create: `src/modules/shielded/poolTokens.ts`
- Test: `src/modules/shielded/__tests__/poolTokens.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/poolTokens.test.ts
import {SHIELDED_POOL_MINTS} from '../../../constants/programs';
import {poolTokenMeta} from '../poolTokens';

describe('shielded pool tokens', () => {
  it('exposes at least one pool mint', () => {
    expect(SHIELDED_POOL_MINTS.length).toBeGreaterThanOrEqual(1);
  });
  it('returns display metadata (symbol + decimals) for a pool mint', () => {
    const m = poolTokenMeta(SHIELDED_POOL_MINTS[0]!);
    expect(typeof m.symbol).toBe('string');
    expect(m.symbol.length).toBeGreaterThan(0);
    expect(m.decimals).toBe(9);
  });
});
```

- [ ] **Step 2: Run** `npx jest poolTokens` → FAIL.

- [ ] **Step 3: Implement.** In `programs.ts` add (near the shielded constants):

```ts
/**
 * SPL mints that have a shielded pool (i.e. what can be shielded/displayed).
 * Devnet: the test mint. Mainnet: NOC (extend when more pools ship — keep the
 * set small; anonymity favors fewer, busier pools).
 */
export const SHIELDED_POOL_MINTS: readonly string[] = IS_DEVNET
  ? [SHIELDED_DEVNET_MINT].filter(m => m.length > 0)
  : [NOC_MINT];
```
Create `src/modules/shielded/poolTokens.ts`:

```ts
import {SHIELDED_DEVNET_MINT, NOC_MINT, NOC_DECIMALS} from '../../constants/programs';

export interface PoolTokenMeta {
  mint: string;
  symbol: string;
  name: string;
  decimals: number;
}

// Minimal metadata for pool mints. NOC uses project constants; the devnet test
// mint is a stand-in for NOC (same 9 decimals) shown as "TEST".
export function poolTokenMeta(mint: string): PoolTokenMeta {
  if (mint === NOC_MINT) {
    return {mint, symbol: 'NOC', name: 'Noctura', decimals: NOC_DECIMALS};
  }
  if (mint === SHIELDED_DEVNET_MINT) {
    return {mint, symbol: 'TEST', name: 'Devnet Test Token', decimals: 9};
  }
  return {mint, symbol: mint.slice(0, 4), name: 'SPL token', decimals: 9};
}
```

- [ ] **Step 4: Run** `npx jest poolTokens && npx tsc --noEmit` → PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add src/constants/programs.ts src/modules/shielded/poolTokens.ts src/modules/shielded/__tests__/poolTokens.test.ts
git commit -m "feat(shielded): pool-mints config + token metadata"
```

---

### Task 4: Shielded balances aggregation

**Files:**
- Create: `src/modules/shielded/shieldedBalances.ts`
- Test: `src/modules/shielded/__tests__/shieldedBalances.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/modules/shielded/__tests__/shieldedBalances.test.ts
import {addNote, clearMint} from '../noteStore';
import {getShieldedBalances} from '../shieldedBalances';
import {SHIELDED_POOL_MINTS} from '../../../constants/programs';
import {initSecureMmkv} from '../../../store/mmkv/instances';

beforeAll(() => initSecureMmkv('00112233445566778899aabbccddeeff'));

describe('getShieldedBalances', () => {
  it('sums unspent notes per pool mint', () => {
    const mint = SHIELDED_POOL_MINTS[0]!;
    clearMint(mint);
    addNote({commitment: 'a', nullifier: '', mint, amount: 300000000n, index: 0,
      spent: false, createdAt: 1, noteSecret: 's'});
    addNote({commitment: 'b', nullifier: '', mint, amount: 200000000n, index: 1,
      spent: false, createdAt: 2, noteSecret: 's'});
    const rows = getShieldedBalances();
    const row = rows.find(r => r.mint === mint)!;
    expect(row.amount).toBe(500000000n);
    expect(row.symbol.length).toBeGreaterThan(0);
    expect(row.decimals).toBe(9);
  });
});
```

- [ ] **Step 2: Run** `npx jest shieldedBalances` → FAIL.

- [ ] **Step 3: Implement** `src/modules/shielded/shieldedBalances.ts`:

```ts
import {getBalance} from './noteStore';
import {poolTokenMeta, type PoolTokenMeta} from './poolTokens';
import {SHIELDED_POOL_MINTS} from '../../constants/programs';
import {mmkvSecure} from '../../store/mmkv/instances';

export interface ShieldedBalanceRow extends PoolTokenMeta {
  amount: bigint; // raw units
}

/**
 * The user's shielded balance per pool mint (sum of unspent notes). Returns a
 * row per configured pool mint (amount 0n when nothing shielded). Reads the local
 * encrypted note store; if it isn't initialized yet, returns all-zero rows
 * (empty state) rather than throwing.
 */
export function getShieldedBalances(): ShieldedBalanceRow[] {
  const ready = mmkvSecure() !== null;
  return SHIELDED_POOL_MINTS.map(mint => {
    const meta = poolTokenMeta(mint);
    const amount = ready ? getBalance(mint) : 0n;
    return {...meta, amount};
  });
}
```

- [ ] **Step 4: Run** `npx jest shieldedBalances && npx tsc --noEmit` → PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add src/modules/shielded/shieldedBalances.ts src/modules/shielded/__tests__/shieldedBalances.test.ts
git commit -m "feat(shielded): per-mint shielded balance aggregation"
```

---

### Task 5: Anonymity set from the pool merkle tree

**Files:**
- Create: `src/modules/shielded/poolState.ts`
- Test: `src/modules/shielded/__tests__/poolState.test.ts`

- [ ] **Step 1: Write the failing test** (pure byte-parse; RPC is exercised on-device)

```ts
// src/modules/shielded/__tests__/poolState.test.ts
import {parseNextLeafIndex} from '../poolState';

describe('parseNextLeafIndex', () => {
  it('reads next_leaf_index (u64 LE) after the 8-byte anchor discriminator', () => {
    const data = new Uint8Array(48);
    // 8-byte disc, then next_leaf_index = 5 at [8..16)
    data[8] = 5;
    expect(parseNextLeafIndex(data)).toBe(5);
  });
  it('throws on too-short account data', () => {
    expect(() => parseNextLeafIndex(new Uint8Array(8))).toThrow();
  });
});
```

- [ ] **Step 2: Run** `npx jest poolState` → FAIL.

- [ ] **Step 3: Implement** `src/modules/shielded/poolState.ts`:

```ts
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../solana/connection';
import {poolPda, merkleTreePda} from './poolPdas';

/**
 * MerkleTree zero-copy layout: 8-byte anchor discriminator, then
 * next_leaf_index: u64 (LE). The anonymity set = number of leaves inserted so far.
 */
export function parseNextLeafIndex(data: Uint8Array): number {
  if (data.length < 16) throw new Error('merkle_tree account too short');
  let n = 0n;
  for (let i = 0; i < 8; i++) n |= BigInt(data[8 + i]!) << BigInt(8 * i);
  return Number(n);
}

/** Fetch the pool's anonymity set (merkle leaf count) for `mint`, or null on RPC error. */
export async function fetchAnonymitySet(mint: string): Promise<number | null> {
  try {
    const pool = poolPda(new PublicKey(mint));
    const merkle = merkleTreePda(pool);
    const info = await getConnection().getAccountInfo(merkle);
    if (!info) return null;
    return parseNextLeafIndex(Uint8Array.from(info.data));
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run** `npx jest poolState && npx tsc --noEmit` → PASS/clean.

- [ ] **Step 5: Commit**
```bash
git add src/modules/shielded/poolState.ts src/modules/shielded/__tests__/poolState.test.ts
git commit -m "feat(shielded): read pool anonymity set (merkle leaf count)"
```

---

### Task 6: Dashboard shielded view — real balances + anonymity + empty state

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx`
- Test: `src/screens/dashboard/__tests__/DashboardScreen.test.tsx` (extend if present; else a minimal render test)

This is UI integration — READ `DashboardScreen.tsx` first, especially the balance card (`Shielded · vault balance` eyebrow ~line 468), the assets list, and the hardcoded `Anonymity set · 1,284` (~line 531).

- [ ] **Step 1:** When `mode === 'shielded'`, source the asset rows + total from the real shielded data instead of the transparent `holdings`:
  - `const shieldedRows = useMemo(() => getShieldedBalances(), [shieldedVersion])` where `shieldedVersion` is a re-read trigger — use a `useFocusEffect`/`useIsFocused` bump (re-read when the dashboard gains focus, e.g. returning from a shield), plus an initial read. Import `getShieldedBalances` from `../../modules/shielded/shieldedBalances`.
  - Build display rows: for each `row`, `uiAmount = Number(row.amount) / 10 ** row.decimals`; `usd = uiAmount * (price[row.mint] ?? 0)` using the existing price map the transparent view already uses. The shielded "vault balance" total = Σ usd.
  - Render each row with the token symbol + `${uiAmount} · shielded` + usd (or `—` when no price), reusing the existing shielded row component/markup (the `· shielded` tag styling already exists).
  - **Empty state:** if every `row.amount === 0n`, render a single centered placeholder ("Nothing shielded yet — tap Shield to make a token private") in place of the rows; the balance total shows `$0.00`. Do NOT show fake SOL/NOC rows.
- [ ] **Step 2:** Anonymity set: replace the hardcoded `Anonymity set · 1,284` with the real value. Add `const [anon, setAnon] = useState<number | null>(null)` and a `useEffect` (on focus) that calls `fetchAnonymitySet(SHIELDED_POOL_MINTS[0])` (the primary pool; on devnet there's one) and `setAnon`. Render `Anonymity set · {anon.toLocaleString()}` only when `anon != null`; hide the line otherwise (no fake number). Import `fetchAnonymitySet` + `SHIELDED_POOL_MINTS`.
- [ ] **Step 3:** Transparent view unchanged — gate all the above on `isShielded`.
- [ ] **Step 4:** Run `npx jest DashboardScreen && npx tsc --noEmit && npx eslint src/screens/dashboard/DashboardScreen.tsx`. Update/extend the dashboard test: mock `../../modules/shielded/shieldedBalances` + `../../modules/shielded/poolState`; assert the shielded tab renders the empty state with no notes, and a real row when `getShieldedBalances` returns a non-zero amount. Keep existing transparent assertions passing.
- [ ] **Step 5: Commit**
```bash
git add src/screens/dashboard/DashboardScreen.tsx src/screens/dashboard/__tests__/DashboardScreen.test.tsx
git commit -m "feat(shielded): dashboard reads real shielded balances + anonymity + empty state"
```

---

### Task 7: Per-token shield (token picker → mint threading)

**Files:**
- Modify: `src/types/*` navigation params (the `RootStackParamList` for `ZkProofModal` — grep for `ZkProofModal` in the types dir)
- Modify: `src/screens/shielded/ShieldUnshieldScreen.tsx`
- Modify: `src/screens/shielded/ZkProofScreen.tsx`
- Test: extend `ShieldUnshieldScreen` + `ZkProofScreen` tests

- [ ] **Step 1:** Nav params — grep `grep -rn "ZkProofModal" src/**/*.ts | grep -i param` to find the `RootStackParamList` definition; add an optional `mint?: string` to the `ZkProofModal` param object (and `ShieldUnshieldModal` if it carries params). Run `npx tsc --noEmit` to confirm the type is found + valid.
- [ ] **Step 2:** `ShieldUnshieldScreen.tsx` — add a token picker restricted to `SHIELDED_POOL_MINTS` (reuse `TokenSelector` as `DepositScreen` does; import `SHIELDED_POOL_MINTS` + `poolTokenMeta`). Hold `const [selectedMint, setSelectedMint] = useState(SHIELDED_POOL_MINTS[0])`. Parse the amount at `poolTokenMeta(selectedMint).decimals` (currently hardcoded `9` in `parseTokenAmount(amount, 9)` — use the token's decimals). In `handleSubmit`, add `mint: selectedMint` to the `navigation.navigate('ZkProofModal', {...})` param object. Show the selected token's symbol where the screen currently shows "SOL".
- [ ] **Step 3:** `ZkProofScreen.tsx` — in `runDepositShield`, replace the hardcoded `SHIELDED_DEVNET_MINT` with `params.mint ?? SHIELDED_POOL_MINTS[0]` (import `SHIELDED_POOL_MINTS`). The success screen already shows the amount; format it with `poolTokenMeta(mint).symbol` and `.decimals`.
- [ ] **Step 4:** Run `npx jest ShieldUnshield ZkProof && npx tsc --noEmit`. Extend the `ShieldUnshieldScreen` test to assert the nav param includes the selected `mint`; extend the `ZkProofScreen` test to assert `depositShield` is called with the mint from `route.params.mint`.
- [ ] **Step 5: Commit**
```bash
git add -A
git commit -m "feat(shielded): per-token shield — token picker + mint threading to depositShield"
```

---

### Task 8: On-device verification (devnet)

- [ ] Build the devnet APK (`ENVFILE=.env.devnet` release, native excluded per PR #45) and sideload.
- [ ] Onboard/unlock → Shielded tab shows the **empty state** (no fake SOL). Shield the AtjVK test token → return to the Shielded tab → it shows the **real** shielded balance (e.g. `0.2 · shielded`), the **anonymity set** reflects the pool's leaf count, and the total USD is non-fake. Shield again → balance increases. Confirm the transparent tab is unchanged.

> Withdraw/unshield (Feature B) + SOL-via-wSOL + more pools are separate follow-ups.

---

## Self-Review

**1. Spec coverage:** §1 secure-MMKV init → Tasks 1–2. §2 pool-mints config → Task 3. §3 real dashboard balances + empty state → Tasks 4, 6. §4 anonymity → Tasks 5, 6. §5 per-token shield → Task 7. On-device → Task 8. ✓

**2. Placeholder scan:** No TBD/TODO; each code step has complete code; UI-integration tasks (6, 7) give precise file+line targets + exact edits (the implementer reads the file to place them). ✓

**3. Type consistency:** `deriveSecureStorageKey` (T1) used in T2 + depositFlow. `SHIELDED_POOL_MINTS` (T3) used in T4/T6/T7. `poolTokenMeta`/`PoolTokenMeta` (T3) used in T4/T7. `getShieldedBalances`/`ShieldedBalanceRow` (T4) used in T6. `fetchAnonymitySet`/`parseNextLeafIndex` (T5) used in T6. `unlockSecureStorage`/`unlockSecureStorageWithSeed` (T2) used in UnlockScreen/SuccessScreen. Nav `mint?` (T7) used across #16/#18. ✓
