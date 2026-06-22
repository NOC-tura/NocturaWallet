# Presale Live Data (Cycle A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire live presale data (current stage, USD price, % progress, the user's purchased allocation) from the coordinator into the wallet's store and render a live presale banner on the dashboard, removing the stubs.

**Architecture:** A new `presaleModule` fetches `/stats` + `/user/:address` via `pinnedFetch` (backend-first, like the Cycle-2 modules); a `usePresaleSync` hook (TanStack Query) writes the results into the existing `presaleStore`; `PresaleBanner` is rewritten to the compact `index.html` `.presale` design and mounted on the dashboard. Read-only — no signing.

**Tech Stack:** React Native (Hermes), TypeScript strict, TanStack Query, zustand, NativeWind, Jest.

**Working directory:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/presale-live-data` (spec already committed).

> Coordinator is LIVE: `GET https://api.noc-tura.io/api/v1/stats` and `/api/v1/user/:address` both return 200. `API_BASE` = `https://api.noc-tura.io/api/v1`, so the paths are `${API_BASE}/stats` and `${API_BASE}/user/{addr}`.

---

## File Structure

- `src/modules/presale/presaleModule.ts` — **Create.** `fetchPresaleStats()`, `fetchUserAllocation(addr)` + a safe NOC-string→base-unit helper.
- `src/modules/presale/__tests__/presaleModule.test.ts` — **Create.**
- `src/hooks/usePresaleSync.ts` — **Create.** TanStack Query → writes `presaleStore`.
- `src/components/PresaleBanner.tsx` — **Modify (rewrite buy state).**
- `src/components/__tests__/PresaleBanner.test.tsx` — **Create.**
- `src/screens/dashboard/DashboardScreen.tsx` — **Modify.** Call `usePresaleSync`, render the banner.

---

## Task 1: presaleModule — fetch + parse stats & allocation

**Files:**
- Create: `src/modules/presale/presaleModule.ts`
- Test: `src/modules/presale/__tests__/presaleModule.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/presale/__tests__/presaleModule.test.ts`:
```ts
import {fetchPresaleStats, fetchUserAllocation} from '../presaleModule';
import {pinnedFetch} from '../../sslPinning/pinnedFetch';
import {parseTokenAmount} from '../../../utils/parseTokenAmount';

jest.mock('../../sslPinning/pinnedFetch');
const mockPinned = pinnedFetch as jest.Mock;

afterEach(() => mockPinned.mockReset());

describe('fetchPresaleStats', () => {
  it('maps coordinator stage (0-indexed) to display stage + USD price + into-stage', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({success: true, data: {currentStage: 0, totalNocSold: 839030.874670029, isPaused: false}}),
    });
    const s = await fetchPresaleStats();
    expect(s.displayStage).toBe(1);
    expect(s.pricePerNocUsd).toBe(0.1501);
    expect(s.isPaused).toBe(false);
    expect(s.stageCapacityBase).toBe((10_240_000n * 1_000_000_000n).toString());
    expect(s.soldInStageBase).toBe(parseTokenAmount('839030.874670029', 9).toString());
    expect(mockPinned).toHaveBeenCalledWith(expect.stringContaining('/stats'));
  });

  it('computes into-stage for a mid presale stage', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({success: true, data: {currentStage: 2, totalNocSold: 21_000_000, isPaused: false}}),
    });
    const s = await fetchPresaleStats();
    expect(s.displayStage).toBe(3);
    expect(s.pricePerNocUsd).toBe(0.1945);
    // 21,000,000 − 2×10,240,000 = 520,000 NOC into stage 3
    expect(s.soldInStageBase).toBe(parseTokenAmount('520000', 9).toString());
  });

  it('throws on a non-200 / unsuccessful response', async () => {
    mockPinned.mockResolvedValue({status: 500, json: async () => ({})});
    await expect(fetchPresaleStats()).rejects.toThrow();
  });
});

describe('fetchUserAllocation', () => {
  it('sums noc_amount and referral_bonus over recorded purchases', async () => {
    mockPinned.mockResolvedValue({
      status: 200,
      json: async () => ({
        success: true,
        data: {purchases: [
          {noc_amount: '176.282478348', referral_bonus: '0'},
          {noc_amount: '100', referral_bonus: '10'},
        ]},
      }),
    });
    const a = await fetchUserAllocation('Addr11111111111111111111111111111111111111');
    expect(a.tokensPurchasedBase).toBe((parseTokenAmount('176.282478348', 9) + parseTokenAmount('100', 9)).toString());
    expect(a.referralBonusBase).toBe(parseTokenAmount('10', 9).toString());
    expect(mockPinned).toHaveBeenCalledWith(expect.stringContaining('/user/Addr11111111111111111111111111111111111111'));
  });

  it('returns 0/0 for no purchases', async () => {
    mockPinned.mockResolvedValue({status: 200, json: async () => ({success: true, data: {purchases: []}})});
    const a = await fetchUserAllocation('Addr');
    expect(a).toEqual({tokensPurchasedBase: '0', referralBonusBase: '0'});
  });

  it('throws on a non-200 response', async () => {
    mockPinned.mockResolvedValue({status: 500, json: async () => ({})});
    await expect(fetchUserAllocation('Addr')).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest presaleModule`
Expected: FAIL — cannot find module `../presaleModule`.

- [ ] **Step 3: Implement the module**

Create `src/modules/presale/presaleModule.ts`:
```ts
import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';
import {parseTokenAmount} from '../../utils/parseTokenAmount';
import {PRESALE_STAGE_PRICES} from '../../constants/presale';

const TOKENS_PER_STAGE = 10_240_000;
const NOC_DECIMALS = 9;
const STAGE_CAPACITY_BASE = (BigInt(TOKENS_PER_STAGE) * 10n ** BigInt(NOC_DECIMALS)).toString();

export interface PresaleStats {
  displayStage: number; // 1-indexed (coordinator currentStage is 0-indexed)
  pricePerNocUsd: number;
  soldInStageBase: string; // NOC into the current stage, 9-dec base units
  stageCapacityBase: string; // 10,240,000 NOC in base units
  isPaused: boolean;
}

export interface UserAllocation {
  tokensPurchasedBase: string;
  referralBonusBase: string;
}

/**
 * Convert a NOC display-amount string (≤9 dp, possibly a float like
 * "839030.874670029") to base units. Goes through Number().toFixed(9) so a
 * value with >9 fractional digits (or float noise) can't make parseTokenAmount
 * throw. Non-finite / non-positive → 0n.
 */
function nocStringToBase(s: string): bigint {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) {
    return 0n;
  }
  return parseTokenAmount(n.toFixed(NOC_DECIMALS), NOC_DECIMALS);
}

/** Live global presale stage/price/progress from the coordinator. Throws on failure. */
export async function fetchPresaleStats(): Promise<PresaleStats> {
  const res = await pinnedFetch(`${API_BASE}/stats`);
  if (res.status !== 200) {
    throw new Error(`presale stats HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    success?: boolean;
    data?: {currentStage?: number; totalNocSold?: number; isPaused?: boolean};
  };
  if (!body.success || !body.data) {
    throw new Error('presale stats unsuccessful');
  }
  const idx = Math.min(Math.max(body.data.currentStage ?? 0, 0), PRESALE_STAGE_PRICES.length - 1);
  const totalNocSold = body.data.totalNocSold ?? 0;
  const intoStage = Math.max(0, totalNocSold - idx * TOKENS_PER_STAGE);
  return {
    displayStage: idx + 1,
    pricePerNocUsd: PRESALE_STAGE_PRICES[idx],
    soldInStageBase: nocStringToBase(String(intoStage)).toString(),
    stageCapacityBase: STAGE_CAPACITY_BASE,
    isPaused: body.data.isPaused === true,
  };
}

/** The user's purchased NOC, summed from the coordinator's recorded purchases. Throws on failure. */
export async function fetchUserAllocation(address: string): Promise<UserAllocation> {
  const res = await pinnedFetch(`${API_BASE}/user/${address}`);
  if (res.status !== 200) {
    throw new Error(`presale user HTTP ${res.status}`);
  }
  const body = (await res.json()) as {
    success?: boolean;
    data?: {purchases?: Array<{noc_amount?: string; referral_bonus?: string}>};
  };
  if (!body.success || !body.data) {
    throw new Error('presale user unsuccessful');
  }
  let purchased = 0n;
  let referral = 0n;
  for (const p of body.data.purchases ?? []) {
    purchased += nocStringToBase(p.noc_amount ?? '0');
    referral += nocStringToBase(p.referral_bonus ?? '0');
  }
  return {tokensPurchasedBase: purchased.toString(), referralBonusBase: referral.toString()};
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest presaleModule`
Expected: PASS — 6 tests.

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit` → no new errors.
```bash
git add src/modules/presale/presaleModule.ts src/modules/presale/__tests__/presaleModule.test.ts
git commit -m "feat(presale): presaleModule — fetch live stats + user allocation via backend"
```

---

## Task 2: usePresaleSync hook

**Files:**
- Create: `src/hooks/usePresaleSync.ts`

(No unit test — thin TanStack-Query→store glue, same as `usePrices`/`usePriceHistory` which have no hook tests; verified by `tsc` + the module tests + on-device.)

- [ ] **Step 1: Implement the hook**

Create `src/hooks/usePresaleSync.ts`:
```ts
import {useEffect} from 'react';
import {useQuery} from '@tanstack/react-query';
import {fetchPresaleStats, fetchUserAllocation} from '../modules/presale/presaleModule';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {useWalletStore} from '../store/zustand/walletStore';

/**
 * Fetches live presale stage/price/progress (+ the user's allocation) from the
 * coordinator and writes it into presaleStore. Mounted by the dashboard. A
 * fetch failure leaves the last (persisted) store values intact. Returns
 * `isPaused` so the dashboard can hide the banner when the presale is paused.
 */
export function usePresaleSync(): {isPaused: boolean} {
  const address = useWalletStore(s => s.publicKey);
  const setStageInfo = usePresaleStore(s => s.setStageInfo);
  const setAllocation = usePresaleStore(s => s.setAllocation);

  const statsQ = useQuery({
    queryKey: ['presaleStats'],
    queryFn: fetchPresaleStats,
    staleTime: 30_000,
    refetchInterval: 60_000,
    retry: 1,
  });

  const allocQ = useQuery({
    queryKey: ['presaleAllocation', address],
    queryFn: () => fetchUserAllocation(address as string),
    enabled: address != null,
    staleTime: 60_000,
    retry: 1,
  });

  useEffect(() => {
    if (!statsQ.data) {
      return;
    }
    setStageInfo({
      currentStage: statsQ.data.displayStage,
      pricePerNoc: String(statsQ.data.pricePerNocUsd),
      soldInStage: statsQ.data.soldInStageBase,
      stageCapacity: statsQ.data.stageCapacityBase,
    });
  }, [statsQ.data, setStageInfo]);

  useEffect(() => {
    if (!allocQ.data) {
      return;
    }
    setAllocation({
      tokensPurchased: allocQ.data.tokensPurchasedBase,
      claimedTokens: '0',
      referralBonusTokens: allocQ.data.referralBonusBase,
      isZeroFeeEligible: false,
    });
  }, [allocQ.data, setAllocation]);

  return {isPaused: statsQ.data?.isPaused ?? false};
}
```

- [ ] **Step 2: Type-check + commit**

Run: `npx tsc --noEmit` → no new errors.
```bash
git add src/hooks/usePresaleSync.ts
git commit -m "feat(presale): usePresaleSync — write live presale data into the store"
```

---

## Task 3: PresaleBanner — rewrite the buy state to the compact design

**Files:**
- Modify: `src/components/PresaleBanner.tsx` (replace the entire file)
- Test: `src/components/__tests__/PresaleBanner.test.tsx`

> Read the `.presale` block in `/home/user/Downloads/index.html` (≈ line 6371): rocket icon + `NOC Presale · Stage 3` (`noc-body-lg`) + `$0.025 · 47% to next stage` (`noc-body-sm noc-numeral`) + chevron-right. The numbers in the design are mock content; real values come from the store.

- [ ] **Step 1: Write the failing test**

Create `src/components/__tests__/PresaleBanner.test.tsx`:
```tsx
import React from 'react';
import {render} from '@testing-library/react-native';
import {PresaleBanner} from '../PresaleBanner';
import {usePresaleStore} from '../../store/zustand/presaleStore';

function seedStore(partial: Record<string, unknown>) {
  usePresaleStore.setState({
    currentStage: 1,
    pricePerNoc: '0.1501',
    soldInStage: (839030n * 1_000_000_000n).toString(),
    stageCapacity: (10_240_000n * 1_000_000_000n).toString(),
    tgeStatus: 'pre_tge',
    tokensPurchased: '0',
    claimedTokens: '0',
    referralBonusTokens: '0',
    ...partial,
  });
}

describe('PresaleBanner (buy state)', () => {
  it('renders the live stage + USD price + % to next stage', () => {
    seedStore({});
    const {getByText} = render(<PresaleBanner onPress={() => {}} />);
    getByText('NOC Presale · Stage 1');
    // 839030 / 10,240,000 ≈ 8%
    getByText('$0.1501 · 8% to next stage');
  });

  it('falls back to Stage 1 + stage-1 price when the store is empty (no 0.0012)', () => {
    seedStore({currentStage: null, pricePerNoc: null, soldInStage: null, stageCapacity: null});
    const {getByText, queryByText} = render(<PresaleBanner onPress={() => {}} />);
    getByText('NOC Presale · Stage 1');
    expect(queryByText(/0\.0012/)).toBeNull();
    expect(queryByText(/SOL/)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest PresaleBanner`
Expected: FAIL — current banner renders "Stage 1 of 10" / "1 NOC = 0.0012 SOL", not the new copy.

- [ ] **Step 3: Replace `src/components/PresaleBanner.tsx`**

```tsx
import React from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {Rocket, ChevronRight} from 'lucide-react-native';
import {Text} from './ui';
import {usePresaleStore} from '../store/zustand/presaleStore';
import {PRESALE_STAGE_PRICES} from '../constants/presale';

interface PresaleBannerProps {
  onPress: () => void;
}

export function PresaleBanner({onPress}: PresaleBannerProps) {
  const {
    currentStage,
    pricePerNoc,
    soldInStage,
    stageCapacity,
    tgeStatus,
    tokensPurchased,
    claimedTokens,
    referralBonusTokens,
  } = usePresaleStore();

  // Hide once all tokens are claimed.
  if (tgeStatus === 'claimed') {
    return null;
  }

  // Post-TGE claim banner (unchanged — Cycle C will style/flesh this out).
  if (tgeStatus === 'claimable') {
    const total = BigInt(tokensPurchased) + BigInt(referralBonusTokens);
    const unclaimed = total - BigInt(claimedTokens);
    return (
      <Pressable testID="presale-claim-banner" style={styles.claimContainer} onPress={onPress}>
        <View style={styles.claimRow}>
          <View style={styles.claimDot} />
          <Text variant="body-lg" className="text-fg-primary">
            Claim Your NOC Tokens
          </Text>
        </View>
        <Text variant="body-sm" numeral className="text-success mt-1">
          {formatNoc(unclaimed)} NOC available
        </Text>
      </Pressable>
    );
  }

  // Pre-TGE buy banner — compact .presale design (index.html ≈ 6371).
  const stage = currentStage ?? 1;
  const price = pricePerNoc ?? String(PRESALE_STAGE_PRICES[0]);
  const sold = soldInStage ? BigInt(soldInStage) : 0n;
  const cap = stageCapacity ? BigInt(stageCapacity) : 0n;
  const pct = cap > 0n ? Number((sold * 100n) / cap) : 0;

  return (
    <Pressable
      testID="presale-buy-banner"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`NOC Presale, stage ${stage}`}
      className="mx-5 mt-2 mb-3 flex-row items-center gap-3 p-4 rounded-lg bg-bg-surface-1 border border-accent/20">
      <View className="w-10 h-10 rounded-pill items-center justify-center bg-bg-surface-2">
        <Rocket size={20} color="#B084FC" strokeWidth={1.75} />
      </View>
      <View className="flex-1">
        <Text variant="body-lg" className="text-fg-primary">
          {`NOC Presale · Stage ${stage}`}
        </Text>
        <Text variant="body-sm" numeral className="text-fg-secondary mt-0.5">
          {`$${price} · ${pct}% to next stage`}
        </Text>
      </View>
      <ChevronRight size={18} color="#A8ACB5" strokeWidth={1.75} />
    </Pressable>
  );
}

function formatNoc(base: bigint): string {
  // base is 9-dec; show whole NOC with thousands separators.
  const whole = base / 1_000_000_000n;
  return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

const styles = StyleSheet.create({
  claimContainer: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 12,
    padding: 16,
    backgroundColor: '#1A1A2E',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF5033',
  },
  claimRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  claimDot: {width: 8, height: 8, borderRadius: 4, backgroundColor: '#4CAF50'},
});
```
> If `border-accent/20` isn't a valid NativeWind token in this project, use `border-[#6C47FF33]` (the prior banner's accent border). Verify `Text` supports the `numeral` prop (it's used elsewhere, e.g. dashboard rows).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest PresaleBanner`
Expected: PASS — 2 tests.

- [ ] **Step 5: Type-check + commit**

Run: `npx tsc --noEmit` → no new errors.
```bash
git add src/components/PresaleBanner.tsx src/components/__tests__/PresaleBanner.test.tsx
git commit -m "feat(presale): rewrite PresaleBanner to the compact .presale design (live USD price + % to next stage)"
```

---

## Task 4: Mount the banner on the dashboard + sync

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx`

- [ ] **Step 1: Import the hook + banner**

At the top of `src/screens/dashboard/DashboardScreen.tsx`, add:
```ts
import {usePresaleSync} from '../../hooks/usePresaleSync';
import {PresaleBanner} from '../../components/PresaleBanner';
```

- [ ] **Step 2: Call the sync hook**

In the main `DashboardScreen` component body, near the existing `const {prices, havePrices} = useResolvedPrices();` (≈ line 123), add:
```ts
  const {isPaused: presalePaused} = usePresaleSync();
```

- [ ] **Step 3: Render the banner in the list footer (after tokens, before the footer)**

Replace the `ListFooterComponent={ <DashboardFooter … /> }` block (≈ lines 340-346) with:
```tsx
        ListFooterComponent={
          <>
            {!presalePaused ? <PresaleBanner onPress={onPresale ?? (() => {})} /> : null}
            <DashboardFooter
              mode={mode}
              onPresale={onPresale}
              onSeeAllTokens={onSeeAllTokens}
            />
          </>
        }
```
(`onPresale` is the existing dashboard prop that navigates to the presale screen; the banner reuses it.)

- [ ] **Step 4: Type-check + run the dashboard/related tests**

Run: `npx tsc --noEmit` → no new errors.
Run: `npx jest dashboard PresaleBanner presaleModule` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/screens/dashboard/DashboardScreen.tsx
git commit -m "feat(presale): mount live PresaleBanner on the dashboard (gated on isPaused)"
```

---

## Task 5: Full verification + on-device

- [ ] **Step 1: Full suite + type-check**

Run: `npx jest && npx tsc --noEmit`
Expected: all suites pass; no type errors.

- [ ] **Step 2: Build the release APK (mainnet)**

Run: `cd android && ENVFILE=.env.production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`
Expected: BUILD SUCCESSFUL. Copy `app/build/outputs/apk/release/app-release.apk` → `/home/user/Downloads/`.

- [ ] **Step 3: On-device verification (mainnet)**

- Dashboard shows the presale banner after the token list: `NOC Presale · Stage 1` + `$0.1501 · N% to next stage` (live values; current on-chain stage is 1).
- The NOC token's USD value matches the live stage price.
- Tapping the banner opens the presale screen (existing `onPresale`).
- (If the importing wallet has recorded purchases, the store's `tokensPurchased` reflects them — visible later in Cycle B's screen; not surfaced on the dashboard banner pre-TGE.)

---

## Self-Review

**1. Spec coverage:**
- A. presaleModule (fetchPresaleStats + fetchUserAllocation, 0-idx→1-idx, USD price, parseTokenAmount, % progress) → Task 1. ✓
- B. usePresaleSync (TanStack Query → store setters, address from walletStore, isPaused) → Task 2. ✓
- C. PresaleBanner rewrite to compact design (USD + % to next stage, no SOL/0.0012/sold-cap) → Task 3. ✓
- D. Dashboard render (banner mounted after tokens, gated on isPaused) + sync call → Task 4. ✓
- E. Error handling (failure keeps persisted store; cold-start fallback Stage 1 + stage-1 price) → Tasks 2, 3 (fallback in banner). ✓
- F. Testing (presaleModule, PresaleBanner) → Tasks 1, 3. ✓

**2. Placeholder scan:** No code-logic placeholders. The `border-accent/20` note offers a concrete fallback (`border-[#6C47FF33]`). On-device step uses real live values.

**3. Type consistency:** `PresaleStats {displayStage, pricePerNocUsd, soldInStageBase, stageCapacityBase, isPaused}` and `UserAllocation {tokensPurchasedBase, referralBonusBase}` defined in Task 1, consumed in Task 2. `presaleStore.setStageInfo({currentStage, pricePerNoc, soldInStage, stageCapacity})` + `setAllocation({tokensPurchased, claimedTokens, referralBonusTokens, isZeroFeeEligible})` match the existing store signatures. `PresaleBanner` props `{onPress}` unchanged; dashboard passes `onPresale`. `currentStage` stored 1-indexed (consistent with `nocUsdPriceForStage` + the banner `currentStage ?? 1`). No gaps.
