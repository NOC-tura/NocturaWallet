# Geo-gate on Presale Buy (#3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Gate the presale buy flow by jurisdiction (block OFAC-sanctioned, warn restricted/VPN), build the #50 geo-blocked screen, and wire the "Not available in your region?" link to it.

**Architecture:** Reuse the existing `GeoFenceManager.checkJurisdiction()` (its `action:'block'` already == OFAC-sanctioned). Add `isPresaleBlocked` + a `regionDisplay` helper + a `useJurisdiction` hook; build `GeoBlockedScreen` (#50); wire `PresaleActive`. Fix the geo endpoint path (`/v1/geo` → `/geo`). Fail-open until backend `geo/check` is live.

**Tech Stack:** React Native (Hermes), TypeScript strict, NativeWind, TanStack Query v5, Jest.

**Working dir:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/geo-gate` (spec committed).

---

## File Structure

- `src/modules/geoFence/geoFenceModule.ts` — **Modify.** Path fix (×2) + `isPresaleBlocked`.
- `src/modules/geoFence/regionDisplay.ts` (+ test) — **Create.** `regionDisplay(code)`.
- `src/hooks/useJurisdiction.ts` — **Create.** Query wrapper.
- `src/screens/compliance/GeoBlockedScreen.tsx` (+ test) — **Create.** #50.
- `src/app/Navigator.tsx` + the `DashboardStackParamList` type — **Modify.** Register `GeoBlocked`.
- `src/screens/PresaleScreen.tsx` — **Modify.** Gate buy + rewire region link.
- `src/screens/__tests__/PresaleActive.test.tsx` — **Modify.** Gate assertions.

---

## Task 1: geoFence path fix + `isPresaleBlocked`

**Files:** Modify `src/modules/geoFence/geoFenceModule.ts`; Modify `src/modules/geoFence/__tests__/geoFenceModule.test.ts`.

- [ ] **Step 1: Add a failing test** to `geoFenceModule.test.ts`:
```ts
import {isPresaleBlocked} from '../geoFenceModule';
describe('isPresaleBlocked', () => {
  it('blocks only on action:block (OFAC sanctioned)', () => {
    expect(isPresaleBlocked({action: 'block', countryCode: 'KP', transparentAllowed: true})).toBe(true);
    expect(isPresaleBlocked({action: 'warn', countryCode: 'CN', transparentAllowed: true})).toBe(false);
    expect(isPresaleBlocked({action: 'allow', countryCode: 'SI', transparentAllowed: true})).toBe(false);
  });
});
```
Also update any existing test that asserts the geo URL to expect `/geo/check` (no `/v1`). If a test sets up a KYC-cleared manager and calls `checkJurisdiction`, add an assertion that `pinnedFetch` was called with a URL ending `/geo/check` and NOT containing `/v1/geo`.

- [ ] **Step 2:** Run `npx jest geoFenceModule` → FAIL (`isPresaleBlocked` missing / URL assertion).

- [ ] **Step 3: Implement.** In `geoFenceModule.ts`:
  - Change `` `${API_BASE}/v1/geo/check` `` → `` `${API_BASE}/geo/check` `` and `` `${API_BASE}/v1/geo/restricted-list` `` → `` `${API_BASE}/geo/restricted-list` ``.
  - Add near the top (after `JurisdictionResult`):
```ts
/** Presale buy policy (OFAC-only): block only sanctioned jurisdictions. */
export function isPresaleBlocked(result: JurisdictionResult): boolean {
  return result.action === 'block';
}
```

- [ ] **Step 4:** Run `npx jest geoFenceModule` → PASS. `npx tsc --noEmit` clean.
- [ ] **Step 5:** Commit `fix(geo): correct /geo path + add isPresaleBlocked (OFAC-only presale policy)`.

---

## Task 2: regionDisplay helper

**Files:** Create `src/modules/geoFence/regionDisplay.ts` + `__tests__/regionDisplay.test.ts`.

- [ ] **Step 1: Failing test:**
```ts
import {regionDisplay} from '../regionDisplay';
describe('regionDisplay', () => {
  it('names EU members with the EU tag', () => {
    expect(regionDisplay('SI')).toEqual({label: 'Slovenia', isEu: true});
  });
  it('names sanctioned/restricted countries', () => {
    expect(regionDisplay('KP')).toEqual({label: 'North Korea', isEu: false});
  });
  it('falls back to the raw code when unknown', () => {
    expect(regionDisplay('ZZ')).toEqual({label: 'ZZ', isEu: false});
    expect(regionDisplay('UNKNOWN')).toEqual({label: 'UNKNOWN', isEu: false});
  });
});
```

- [ ] **Step 2:** Run `npx jest regionDisplay` → FAIL.

- [ ] **Step 3: Implement** `src/modules/geoFence/regionDisplay.ts`. Include `EU_MEMBERS` (27 ISO-3166 alpha-2 codes: AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE) and a `COUNTRY_NAMES` map covering: the EU members (so SI→Slovenia), the bundled restricted list (CU Cuba, IR Iran, KP North Korea, SY Syria, RU Russia, CN China, MM Myanmar, BY Belarus, VE Venezuela, ZW Zimbabwe), plus US/GB/CH. 
```ts
const EU_MEMBERS = new Set(['AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE']);
const COUNTRY_NAMES: Record<string, string> = {
  AT:'Austria',BE:'Belgium',BG:'Bulgaria',HR:'Croatia',CY:'Cyprus',CZ:'Czechia',DK:'Denmark',EE:'Estonia',FI:'Finland',FR:'France',DE:'Germany',GR:'Greece',HU:'Hungary',IE:'Ireland',IT:'Italy',LV:'Latvia',LT:'Lithuania',LU:'Luxembourg',MT:'Malta',NL:'Netherlands',PL:'Poland',PT:'Portugal',RO:'Romania',SK:'Slovakia',SI:'Slovenia',ES:'Spain',SE:'Sweden',
  CU:'Cuba',IR:'Iran',KP:'North Korea',SY:'Syria',RU:'Russia',CN:'China',MM:'Myanmar',BY:'Belarus',VE:'Venezuela',ZW:'Zimbabwe',US:'United States',GB:'United Kingdom',CH:'Switzerland',
};
export function regionDisplay(countryCode: string): {label: string; isEu: boolean} {
  return {label: COUNTRY_NAMES[countryCode] ?? countryCode, isEu: EU_MEMBERS.has(countryCode)};
}
```

- [ ] **Step 4:** Run `npx jest regionDisplay` → PASS. `tsc` clean.
- [ ] **Step 5:** Commit `feat(geo): regionDisplay helper (bundled name + EU tag)`.

---

## Task 3: useJurisdiction hook

**Files:** Create `src/hooks/useJurisdiction.ts`.

- [ ] **Step 1: Implement** (thin query wrapper — no separate test; exercised via PresaleActive + GeoBlocked tests):
```ts
import {useQuery} from '@tanstack/react-query';
import {geoFenceManager, type JurisdictionResult} from '../modules/geoFence/geoFenceModule';

/** Cached jurisdiction check (fail-open warn on error inside the manager). */
export function useJurisdiction(): {result: JurisdictionResult | undefined; isLoading: boolean} {
  const q = useQuery({
    queryKey: ['jurisdiction'],
    queryFn: () => geoFenceManager.checkJurisdiction(),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  return {result: q.data, isLoading: q.isLoading};
}
```
> Ensure `JurisdictionResult` is exported from `geoFenceModule` (it is). `geoFenceManager` is the exported singleton.

- [ ] **Step 2:** `npx tsc --noEmit` clean.
- [ ] **Step 3:** Commit `feat(geo): useJurisdiction hook`.

---

## Task 4: GeoBlockedScreen (#50)

**Files:** Create `src/screens/compliance/GeoBlockedScreen.tsx` + `__tests__/GeoBlockedScreen.test.tsx`.

- [ ] **Step 1: Failing test** asserting the screen renders the 3 reason labels, "what still works", the detected-region label via `regionDisplay`, and that [Got it] calls `onDismiss`. Mock nothing network — it's pure props. Example:
```tsx
import {render, fireEvent} from '@testing-library/react-native';
import {GeoBlockedScreen} from '../GeoBlockedScreen';
it('renders reasons + region and dismisses', () => {
  const onDismiss = jest.fn();
  const {getByText} = render(<GeoBlockedScreen countryCode="SI" onDismiss={onDismiss} onClose={jest.fn()} />);
  getByText('Slovenia · EU');           // regionDisplay → "Slovenia" + EU tag
  getByText(/Token swaps/i);
  getByText(/NOC presale/i);
  getByText(/on-ramp/i);
  fireEvent.press(getByText('Got it'));
  expect(onDismiss).toHaveBeenCalled();
});
```

- [ ] **Step 2:** Run `npx jest GeoBlockedScreen` → FAIL.

- [ ] **Step 3: Implement** `src/screens/compliance/GeoBlockedScreen.tsx`. Read `index.html` #50 (CSS ~19321, markup in section XI ~19590) + `screen.md` #50 for fidelity. Use design-system (`Text` from `../../components/ui`, NativeWind, `accent-transparent` for any accent). Structure:
  - `SafeAreaView`; top bar with an X (`onClose`).
  - Hero: title + honest copy; detected region line = `const {label, isEu} = regionDisplay(countryCode ?? 'UNKNOWN'); ` → render `${label}${isEu ? ' · EU' : ''}`; coarse-geo disclosure caption "Based on your network — no GPS, no device location."
  - 3 reason rows (icon + title + sub): "Token swaps — Not available under EU MiCA", "NOC presale — Geofenced in your region", "Fiat on-ramp — Licensing pending".
  - "What still works" group: Send · Receive · Stake.
  - Sticky bottom **[Got it]** button → `onDismiss`.
  - Props `{countryCode?: string; onDismiss: () => void; onClose: () => void}`.

- [ ] **Step 4:** Run `npx jest GeoBlockedScreen` → PASS. `tsc` + `eslint src/screens/compliance` clean.
- [ ] **Step 5:** Commit `feat(geo): #50 geo-blocked screen`.

---

## Task 5: Register GeoBlocked route

**Files:** `src/app/Navigator.tsx` + `DashboardStackParamList`.

- [ ] **Step 1:** Add `GeoBlocked: {countryCode?: string} | undefined` to `DashboardStackParamList` (find via `grep -rn DashboardStackParamList src`).

- [ ] **Step 2:** Add a `GeoBlockedNav` wrapper (mirroring the existing nav wrappers) that reads `route.params?.countryCode`, and passes `onDismiss={() => navigation.goBack()}` and `onClose={() => navigation.navigate('Dashboard')}` (use the same dashboard-root navigation the other wrappers use; if there's no 'Dashboard' route key in the stack, use `navigation.popToTop()` for X). Register `<DashboardNav.Screen name="GeoBlocked" component={GeoBlockedNav} />`.

- [ ] **Step 3:** `npx tsc --noEmit` clean; `npx jest` (no regressions).
- [ ] **Step 4:** Commit `feat(geo): register GeoBlocked route (#50)`.

---

## Task 6: Wire PresaleActive (gate + region link)

**Files:** `src/screens/PresaleScreen.tsx`; `src/screens/__tests__/PresaleActive.test.tsx`.

- [ ] **Step 1: Failing test** (extend PresaleActive test): when `geoFenceManager.checkJurisdiction` resolves `{action:'block', countryCode:'KP', transparentAllowed:true}`, the primary "Buy NOC" CTA is not actionable for buying (it's replaced by / navigates to GeoBlocked) and the region link navigates to `GeoBlocked`. Mock `../modules/geoFence/geoFenceModule` (`geoFenceManager.checkJurisdiction` + `isPresaleBlocked` real) and the navigation. Wrap in `QueryClientProvider`. (Mirror the existing PresaleActive test setup.)

- [ ] **Step 2:** Run → FAIL.

- [ ] **Step 3: Implement** in `PresaleActive`:
  - `import {useJurisdiction} from '../hooks/useJurisdiction';` and `import {isPresaleBlocked} from '../modules/geoFence/geoFenceModule';`
  - `const {result: jur} = useJurisdiction(); const geoBlocked = jur ? isPresaleBlocked(jur) : false;`
  - Sticky CTA: when `geoBlocked`, render a CTA labeled "Not available in your region" that `onPress={() => navigation.navigate('GeoBlocked', {countryCode: jur?.countryCode})}` (instead of the buy action); otherwise the normal Buy button (`disabled` per existing `gate`).
  - When `jur?.action === 'warn'`, render a discreet caption above the CTA: "Limited availability in your region — purchases still settle on-chain." (no block).
  - Replace the existing "Not available in your region?" `Alert` Pressable with `onPress={() => navigation.navigate('GeoBlocked', {countryCode: jur?.countryCode})}`.

- [ ] **Step 4:** Run `npx jest PresaleActive geoFence regionDisplay GeoBlocked` → PASS. Full `npx jest && npx tsc --noEmit && npx eslint src` clean.
- [ ] **Step 5:** Commit `feat(geo): gate presale buy + route region link to #50`.

---

## Task 7: Full verification + on-device

- [ ] **Step 1:** `npx jest && npx tsc --noEmit` → all pass, clean.
- [ ] **Step 2:** Build: `cd android && ENVFILE=.env.production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy `app-release.apk` → `/home/user/Downloads/NocturaWallet-geo.apk`.
- [ ] **Step 3: On-device (mainnet):** Presale #23 → "Not available in your region?" opens **#50** (region likely shows the fail-open code/UNKNOWN since `geo/check` is 404), 3 reason rows + what-works + "no GPS" disclosure; [Got it] returns; X → dashboard. Buy still works for the user (fail-open). ⚠️ Real IP block verified once `geo/check` is live; block logic proven by the KYC-override unit test.

---

## Self-Review

- **Spec coverage:** A (path fix + isPresaleBlocked)→T1; B (regionDisplay)→T2; hook→T3; C (#50 screen)→T4+T5; D (wiring + link)→T6; E (tests) across T1/T2/T4/T6; F (on-device)→T7. ✓
- **Placeholder scan:** complete code in every step; on-device uses real flows. ✓
- **Type consistency:** `isPresaleBlocked(JurisdictionResult)`→T1 used T3/T6; `regionDisplay(code)→{label,isEu}`→T2 used T4; `useJurisdiction()→{result,isLoading}`→T3 used T6; `GeoBlocked` route param `{countryCode?}`→T5 used T6. ✓
- **Flagged:** fail-open until `geo/check` is live (auto-IP block inactive); bundled country-name subset; KYC override is test-only (no UI). All in spec.
