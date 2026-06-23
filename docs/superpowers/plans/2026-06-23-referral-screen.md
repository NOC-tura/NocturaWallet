# Referral Screen (#24) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Rewrite the non-functional referral stub into the real read-only #24 "Refer a friend" screen — 3 stats from `/referral-stats`, an address-based invite link (copy/share), info banner — reachable from Settings; remove the dead code-based stub.

**Architecture:** A shared coordinator client (`getCoordinatorJson`) extracted from presaleModule; a `referralModule` (`fetchReferralStats` + `buildReferralLink`); a rewritten `ReferralScreen` (NativeWind + design system, TanStack Query). Referral screen moves into SettingsStack with a Settings entry row. Dead `generateReferralCode` + MMKV keys removed.

**Tech Stack:** React Native (Hermes), TypeScript strict, NativeWind, TanStack Query v5, Jest.

**Working dir:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/referral-screen` (spec committed).

---

## File Structure

- `src/modules/backend/coordinatorClient.ts` — **Create.** Shared pinned→fallback `getCoordinatorJson`.
- `src/modules/presale/presaleModule.ts` — **Modify.** Import `getCoordinatorJson` from the new client; delete the local copy.
- `src/modules/referral/referralModule.ts` — **Create.** `ReferralStats`, `fetchReferralStats`, `buildReferralLink`.
- `src/modules/referral/__tests__/referralModule.test.ts` — **Create.**
- `src/modules/referral/referralDisplay.ts` — **Create.** Pure `referralStatsDisplay`.
- `src/modules/referral/__tests__/referralDisplay.test.ts` — **Create.**
- `src/screens/referral/ReferralScreen.tsx` — **Rewrite.**
- `src/screens/referral/__tests__/ReferralScreen.test.tsx` — **Rewrite.**
- `src/app/Navigator.tsx` — **Modify.** Move `Referral` registration DashboardStack→SettingsStack.
- `src/navigation/types` (wherever `DashboardStackParamList`/`SettingsStackParamList` live) — **Modify.** Move `Referral` key.
- `src/screens/settings/SettingsScreen.tsx` — **Modify.** Add "Refer a friend" NavRow.
- `src/utils/generateReferralCode.ts` (+ its test) — **Delete.**
- `src/constants/mmkvKeys.ts` — **Modify.** Remove `REFERRAL_CODE_MINE`, `REFERRAL_CODE_APPLIED`.

---

## Task 1: Shared coordinator client

**Files:** Create `src/modules/backend/coordinatorClient.ts`; Modify `src/modules/presale/presaleModule.ts`.

- [ ] **Step 1:** Create `src/modules/backend/coordinatorClient.ts` by moving the exact `getCoordinatorJson` body out of `presaleModule.ts`:
```ts
import {API_BASE} from '../../constants/programs';
import {pinnedFetch} from '../sslPinning/pinnedFetch';

/**
 * GET a coordinator JSON endpoint. SSL-pinned first; on ANY pinned-fetch failure
 * fall back to a plain HTTPS fetch to the SAME URL (public read-only data).
 * Throws only when both fail or the response is non-2xx.
 */
export async function getCoordinatorJson(path: string): Promise<unknown> {
  try {
    const res = await pinnedFetch(`${API_BASE}${path}`);
    if (res.status !== 200) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } catch {
    const res = await fetch(`${API_BASE}${path}`);
    if (!res.ok) {
      throw new Error(`coordinator ${path} HTTP ${res.status}`);
    }
    return res.json();
  }
}
```

- [ ] **Step 2:** In `presaleModule.ts`, delete the local `getCoordinatorJson` function and add `import {getCoordinatorJson} from '../backend/coordinatorClient';`. Leave all call sites unchanged.

- [ ] **Step 3:** Run `npx jest presaleModule` → still green (behavior unchanged). `npx tsc --noEmit` clean.

- [ ] **Step 4:** Commit `feat(backend): extract shared coordinatorClient.getCoordinatorJson`.

---

## Task 2: referralModule (fetch + link)

**Files:** Create `src/modules/referral/referralModule.ts` + test.

- [ ] **Step 1: Write the failing test** `src/modules/referral/__tests__/referralModule.test.ts`:
```ts
import {fetchReferralStats, buildReferralLink} from '../referralModule';
import * as client from '../../backend/coordinatorClient';

describe('buildReferralLink', () => {
  it('builds an address-based ?ref link', () => {
    expect(buildReferralLink('ABC123')).toBe('https://noc-tura.io?ref=ABC123');
  });
});

describe('fetchReferralStats', () => {
  it('parses a success payload', async () => {
    jest.spyOn(client, 'getCoordinatorJson').mockResolvedValue({
      success: true,
      data: {totalReferrals: 3, totalBaseBonusNoc: 10, totalExtraBonusNoc: 5,
        totalBonusNoc: 15, totalReferredNoc: 100, totalReferredUsd: 25.5, tierBonusCount: 1},
    });
    const r = await fetchReferralStats('ABC');
    expect(r.totalReferrals).toBe(3);
    expect(r.totalBonusNoc).toBe(15);
    expect(r.totalReferredUsd).toBe(25.5);
  });

  it('coerces missing fields to 0', async () => {
    jest.spyOn(client, 'getCoordinatorJson').mockResolvedValue({success: true, data: {}});
    const r = await fetchReferralStats('ABC');
    expect(r.totalReferrals).toBe(0);
    expect(r.totalBonusNoc).toBe(0);
  });

  it('throws on success:false', async () => {
    jest.spyOn(client, 'getCoordinatorJson').mockResolvedValue({success: false});
    await expect(fetchReferralStats('ABC')).rejects.toThrow();
  });
});
```

- [ ] **Step 2:** Run `npx jest referralModule` → FAIL (module missing).

- [ ] **Step 3: Implement** `src/modules/referral/referralModule.ts`:
```ts
import {getCoordinatorJson} from '../backend/coordinatorClient';

export interface ReferralStats {
  totalReferrals: number;
  totalBaseBonusNoc: number;
  totalExtraBonusNoc: number;
  totalBonusNoc: number;
  totalReferredNoc: number;
  totalReferredUsd: number;
  tierBonusCount: number;
}

/** Address-based invite link, matching the website (`?ref=<address>`). */
export function buildReferralLink(address: string): string {
  return `https://noc-tura.io?ref=${address}`;
}

/** Live referral aggregates for `address`. Throws on failure. */
export async function fetchReferralStats(address: string): Promise<ReferralStats> {
  const body = (await getCoordinatorJson(`/referral-stats/${address}`)) as {
    success?: boolean;
    data?: Partial<ReferralStats>;
  };
  if (!body.success || !body.data) {
    throw new Error('referral stats unsuccessful');
  }
  const d = body.data;
  return {
    totalReferrals: Number(d.totalReferrals ?? 0),
    totalBaseBonusNoc: Number(d.totalBaseBonusNoc ?? 0),
    totalExtraBonusNoc: Number(d.totalExtraBonusNoc ?? 0),
    totalBonusNoc: Number(d.totalBonusNoc ?? 0),
    totalReferredNoc: Number(d.totalReferredNoc ?? 0),
    totalReferredUsd: Number(d.totalReferredUsd ?? 0),
    tierBonusCount: Number(d.tierBonusCount ?? 0),
  };
}
```

- [ ] **Step 4:** Run `npx jest referralModule` → PASS. `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat(referral): referralModule (fetchReferralStats + buildReferralLink)`.

---

## Task 3: referralDisplay helper

**Files:** Create `src/modules/referral/referralDisplay.ts` + test.

- [ ] **Step 1: Failing test** `src/modules/referral/__tests__/referralDisplay.test.ts`:
```ts
import {referralStatsDisplay} from '../referralDisplay';

describe('referralStatsDisplay', () => {
  it('formats zero state', () => {
    const r = referralStatsDisplay({totalReferrals: 0, totalBaseBonusNoc: 0, totalExtraBonusNoc: 0,
      totalBonusNoc: 0, totalReferredNoc: 0, totalReferredUsd: 0, tierBonusCount: 0});
    expect(r).toEqual({referrals: '0', earnedNoc: '0.00', referredUsd: '$0.00'});
  });
  it('formats populated state (2dp NOC, USD)', () => {
    const r = referralStatsDisplay({totalReferrals: 12, totalBaseBonusNoc: 20, totalExtraBonusNoc: 12.4,
      totalBonusNoc: 32.4, totalReferredNoc: 1000, totalReferredUsd: 1234.5, tierBonusCount: 2});
    expect(r.referrals).toBe('12');
    expect(r.earnedNoc).toBe('32.40');
    expect(r.referredUsd).toBe('$1,234.50');
  });
});
```

- [ ] **Step 2:** Run `npx jest referralDisplay` → FAIL.

- [ ] **Step 3: Implement** `src/modules/referral/referralDisplay.ts`. Reuse `formatUsdString` from `src/utils/formatUsd` for `referredUsd`; format NOC to exactly 2dp without `toLocaleString` (Hermes-safe — `value.toFixed(2)`):
```ts
import {formatUsdString} from '../../utils/formatUsd';
import type {ReferralStats} from './referralModule';

export function referralStatsDisplay(s: ReferralStats): {
  referrals: string;
  earnedNoc: string;
  referredUsd: string;
} {
  return {
    referrals: String(s.totalReferrals),
    earnedNoc: s.totalBonusNoc.toFixed(2),
    referredUsd: formatUsdString(s.totalReferredUsd),
  };
}
```
> Verify `formatUsdString(1234.5) === '$1,234.50'` against the existing util (its test asserts `$9,872.40`). If grouping differs, match the util's actual output in the test.

- [ ] **Step 4:** Run `npx jest referralDisplay` → PASS. `tsc` clean.
- [ ] **Step 5:** Commit `feat(referral): referralStatsDisplay helper`.

---

## Task 4: Rewrite ReferralScreen to the #24 design

**Files:** Rewrite `src/screens/referral/ReferralScreen.tsx` + `__tests__/ReferralScreen.test.tsx`.

- [ ] **Step 1: Rewrite the screen.** Replace the entire file. Keep `export function ReferralScreen({onBack}: {onBack?: () => void})`. Use the design system (`Text` from `../components/ui` or the project's `Text`, NativeWind classes, `accent-transparent` for accent). Structure per spec §A:
  - Read `publicKey` from `useWalletStore`.
  - `const statsQ = useQuery({queryKey: ['referralStats', publicKey], queryFn: () => fetchReferralStats(publicKey!), enabled: publicKey != null, staleTime: 60_000, retry: 1});`
  - `const display = statsQ.data ? referralStatsDisplay(statsQ.data) : null;` — when null and loading → show `—`; values render from `display`.
  - `const link = publicKey ? buildReferralLink(publicKey) : '';`
  - Top bar (back + "Refer a friend"); 3 stat cards (REFERRALS/EARNED/REFERRED) using `display` (or `—`); invite-link card with truncated link + "Used {referrals} times" + Copy (`Clipboard.setString(link)` + 2s "Copied" state) + Share (`Share.share({message: link})`); info banner (10%/30% copy); legalese caption.
  - Match the visual style used by `PresaleActive`'s cards (`rounded-lg bg-bg-surface-1 border border-bg-surface-3 p-5`, overline/`balance-md`/caption). Read `index.html` #24 (line ~10920) for layout fidelity.
  - NO "apply code" UI, NO `generateReferralCode`, NO presaleStore reads.

- [ ] **Step 2: Rewrite the test** `__tests__/ReferralScreen.test.tsx`:
  - Mock `../../../modules/referral/referralModule` (`fetchReferralStats` resolves a populated object; `buildReferralLink` real or passthrough) and `react-native` `Share`, `@react-native-clipboard/clipboard`.
  - Wrap render in a `QueryClientProvider`.
  - Assert: title "Refer a friend" renders; the three stat values appear after the query resolves (`findByText`); pressing Copy calls `Clipboard.setString` with the `?ref=` link; pressing Share calls `Share.share` with the link; with `totalReferrals: 0` the link card still renders.

- [ ] **Step 3:** Run `npx jest ReferralScreen` → PASS. `npx tsc --noEmit` clean. `npx eslint src/screens/referral src/modules/referral` clean.
- [ ] **Step 4:** Commit `feat(referral): rewrite #24 Refer-a-friend screen (real stats + address link)`.

---

## Task 5: Navigation move + Settings entry + dead-code cleanup

**Files:** `src/app/Navigator.tsx`, the param-list types, `src/screens/settings/SettingsScreen.tsx`, delete `generateReferralCode`, edit `mmkvKeys.ts`.

- [ ] **Step 1:** In `Navigator.tsx`: remove `<DashboardNav.Screen name="Referral" component={ReferralScreenNav} />` (line ~625) and add `<SettingsNav.Screen name="Referral" component={ReferralScreenNav} />` after the Settings screen (~line 654). Keep the `ReferralScreenNav` wrapper as-is.

- [ ] **Step 2:** Move the `Referral: undefined` route key from `DashboardStackParamList` to `SettingsStackParamList` (find them via `grep -rn "DashboardStackParamList\|SettingsStackParamList" src`). `tsc` must stay clean.

- [ ] **Step 3:** In `SettingsScreen.tsx`, add a `NavRow label="Refer a friend" onPress={() => navigation.navigate('Referral')}` under a fitting section (e.g. add a `SectionHeader title="Rewards"` above it, or place under an existing general section). Match the existing `NavRow` usage exactly.

- [ ] **Step 4:** Delete `src/utils/generateReferralCode.ts` and `src/utils/__tests__/generateReferralCode.test.ts` (confirm no remaining importers: `grep -rn generateReferralCode src` → none). Remove `REFERRAL_CODE_MINE` and `REFERRAL_CODE_APPLIED` from `src/constants/mmkvKeys.ts` (confirm no other importers).

- [ ] **Step 5:** Run full `npx jest && npx tsc --noEmit && npx eslint .` → all pass/clean.
- [ ] **Step 6:** Commit `feat(referral): reachable from Settings + remove dead code-based stub`.

---

## Task 6: Full verification + on-device

- [ ] **Step 1:** `npx jest && npx tsc --noEmit` → all pass, clean.
- [ ] **Step 2:** Build: `cd android && ENVFILE=.env.production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy `app-release.apk` → `/home/user/Downloads/NocturaWallet-referral.apk`.
- [ ] **Step 3: On-device (mainnet):** Profile tab → Settings → "Refer a friend" opens #24. Stats show real `/referral-stats` values (currently 0 referrals / 0 NOC / $0). Copy puts `https://noc-tura.io?ref=<my address>` on the clipboard; Share opens the OS sheet with that link. No "apply code" UI, no alphanumeric code.

---

## Self-Review

- **Spec coverage:** screen rewrite (§A)→T4; referralModule+link (§B)→T2; coordinator client (§B)→T1; display helper (§E)→T3; nav move + Settings entry (§C)→T5; dead-code cleanup (§D)→T5; states (loading/empty/error)→T4. ✓
- **Placeholder scan:** complete code in every step; on-device uses real values; no TODO/TBD. ✓
- **Type consistency:** `ReferralStats` defined T2, consumed T3/T4; `referralStatsDisplay`→`{referrals,earnedNoc,referredUsd}` defined T3, used T4; `getCoordinatorJson` signature unchanged across T1. ✓
- **Flagged divergences from `index.html` #24** (reality ≠ mockup): staking→presale bonus copy; 3rd stat REFERRED-$ vs "ACTIVE staking"; rewards list omitted. All intentional, documented in spec.
