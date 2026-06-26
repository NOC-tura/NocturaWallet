# TGE Countdown (Cycle C — TGE part) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** Read the real on-chain `config.tge_timestamp` and show a soft countdown ("Claimable in ~7 months") on the #23 allocation card. Claim tx + tgeStatus flip are deferred to a near-TGE cycle.

**Architecture:** `fetchTgeTimestamp` reads the config account (i64 @201); a pure `tgeCountdownDisplay` formats the relative string; presaleStore holds `tgeTimestamp`; usePresaleSync fetches it; the #23 card renders the countdown.

**Tech Stack:** RN (Hermes), TS strict, @solana/web3.js, zustand, TanStack Query, Jest.

**Working dir:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/tge-countdown` (spec committed).

---

## Task 1: tgeCountdownDisplay helper
**Files:** Create `src/modules/presale/tgeCountdown.ts` + `__tests__/tgeCountdown.test.ts`.
- [ ] **Step 1: Test:**
```ts
import {tgeCountdownDisplay} from '../tgeCountdown';
const NOW = 1_700_000_000;
const d = (days: number) => NOW + days * 86400;
it('empty for null', () => expect(tgeCountdownDisplay(null, NOW)).toBe(''));
it('months ~7 for 204 days', () => expect(tgeCountdownDisplay(d(204), NOW)).toBe('in ~7 months'));
it('weeks ~3 for 21 days', () => expect(tgeCountdownDisplay(d(21), NOW)).toBe('in ~3 weeks'));
it('days for 5 days', () => expect(tgeCountdownDisplay(d(5), NOW)).toBe('in 5 days'));
it('tomorrow for 1.5 days', () => expect(tgeCountdownDisplay(d(1.5), NOW)).toBe('tomorrow'));
it('today for 0.5 day', () => expect(tgeCountdownDisplay(d(0.5), NOW)).toBe('today'));
it('now for past', () => expect(tgeCountdownDisplay(d(-1), NOW)).toBe('now'));
```
- [ ] **Step 2:** `npx jest tgeCountdown` → FAIL.
- [ ] **Step 3: Implement** per spec §B (null/!finite→''; diff<=0→'now'; days>=60→`in ~${round(days/30)} months`; >=14→`in ~${round(days/7)} weeks`; >=2→`in ${round(days)} days`; >=1→'tomorrow'; else 'today').
- [ ] **Step 4:** PASS; `tsc` clean.
- [ ] **Step 5:** Commit `feat(presale): tgeCountdownDisplay helper`.

---

## Task 2: fetchTgeTimestamp
**Files:** Modify `src/modules/presale/presaleBuyModule.ts` + its test.
- [ ] **Step 1: Test** (mirror `fetchOnChainAllocation`'s `connectionMod` spy): craft a ≥209-byte buffer with `1800230400` as i64 LE at offset 201 → `fetchTgeTimestamp()` returns `1800230400`; null account → null; short buffer → null.
- [ ] **Step 2:** `npx jest presaleBuyModule` → FAIL.
- [ ] **Step 3: Implement** `export async function fetchTgeTimestamp(): Promise<number | null>`:
```ts
const CONFIG_TGE_TIMESTAMP_OFFSET = 201;
export async function fetchTgeTimestamp(): Promise<number | null> {
  const {config} = derivePresalePdas(PublicKey.default);
  const info = await getConnection().getAccountInfo(config);
  if (!info || !info.data || info.data.length < CONFIG_TGE_TIMESTAMP_OFFSET + 8) return null;
  const d = info.data;
  let v = 0n;
  for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(d[CONFIG_TGE_TIMESTAMP_OFFSET + i]);
  return Number(v);
}
```
- [ ] **Step 4:** PASS (incl. all pre-existing presaleBuyModule tests); `tsc` clean.
- [ ] **Step 5:** Commit `feat(presale): fetchTgeTimestamp (config.tge_timestamp @201)`.

---

## Task 3: store + sync
**Files:** `src/store/zustand/presaleStore.ts`, `src/hooks/usePresaleSync.ts` (+ store test if one exists).
- [ ] **Step 1:** presaleStore: add `tgeTimestamp: number | null` (default null) to the interface, DEFAULTS, and a `setTgeTimestamp(t: number | null)` action (`set({tgeTimestamp: t})`).
- [ ] **Step 2:** usePresaleSync: import `fetchTgeTimestamp`; add `const tgeQ = useQuery({queryKey:['tgeTimestamp'], queryFn: fetchTgeTimestamp, staleTime: 60*60_000, retry: 1});` and an effect `useEffect(() => { if (tgeQ.data != null) setTgeTimestamp(tgeQ.data); }, [tgeQ.data, setTgeTimestamp])` (read `setTgeTimestamp` from the store like the other setters).
- [ ] **Step 3:** `npx tsc --noEmit` clean; `npx jest presaleStore usePresaleSync` (if tests exist) green; full `npx jest` no regressions.
- [ ] **Step 4:** Commit `feat(presale): store + sync tgeTimestamp`.

---

## Task 4: #23 card countdown
**Files:** `src/screens/PresaleScreen.tsx` (`PresaleActive`).
- [ ] **Step 1:** Import `tgeCountdownDisplay`. In `PresaleActive`: `const tgeTimestamp = usePresaleStore(s => s.tgeTimestamp); const tgeCountdown = tgeCountdownDisplay(tgeTimestamp, Date.now() / 1000);`. Replace the `Claimable after TGE` caption (line ~471) text with `{tgeCountdown ? \`Claimable ${tgeCountdown}\` : 'Claimable after TGE'}`. Keep the same `Text`/styling.
- [ ] **Step 2:** Extend the PresaleActive/allocation test (or add one) asserting the caption shows "Claimable in ~7 months" when `tgeTimestamp` is set to ~204 days out (and falls back to "Claimable after TGE" when null). Mock `Date.now` if needed, or set tgeTimestamp relative to a fixed now.
- [ ] **Step 3:** `npx jest PresaleActive tgeCountdown`; `tsc`; `eslint src/screens/PresaleScreen.tsx` clean. Full `npx jest` green.
- [ ] **Step 4:** Commit `feat(presale): #23 allocation card shows TGE countdown`.

---

## Task 5: Verify + on-device
- [ ] `npx jest && npx tsc --noEmit` → green/clean.
- [ ] Build `app-release.apk` → `/home/user/Downloads/NocturaWallet-tge.apk`.
- [ ] On-device: #23 allocation card shows **"Claimable in ~7 months"** (instead of "Claimable after TGE").

---

## Self-Review
- **Spec coverage:** A fetch→T2; B helper→T1; C store→T3; D sync→T3; E card→T4. ✓
- **Scope guard:** countdown only; claim tx + tgeStatus flip + claim CTA all DEFERRED (no broken claim button). tgeStatus stays pre_tge. ✓
- **Type consistency:** `fetchTgeTimestamp(): Promise<number|null>` (T2) → store `tgeTimestamp:number|null` (T3) → `tgeCountdownDisplay(number|null, number)` (T1) used in T4. ✓
- **Offset:** config.tge_timestamp @201 verified against the Rust struct + a live scan (2027-01-18).
