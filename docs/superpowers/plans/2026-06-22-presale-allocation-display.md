# Presale Allocation Display (Cycle C1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the user their purchased NOC presale allocation on the `#23` screen ("You own X NOC · Claimable after TGE"), read-only, no date — the actual claim flow is deferred to a near-TGE cycle.

**Architecture:** A tiny pure helper computes the display value/visibility from `presaleStore`'s `tokensPurchased` + `referralBonusTokens` (populated by Cycle A). `PresaleActive` renders a read-only allocation card when the total > 0. No TGE constant, no `tgeStatus` change.

**Tech Stack:** React Native (Hermes), TypeScript strict, NativeWind, Jest.

**Working dir:** `/home/user/Solana/Project/NocturaWallet`. Branch `feat/presale-allocation-display` (spec committed).

---

## File Structure

- `src/modules/presale/presaleAllocation.ts` — **Create.** Pure `presaleAllocationDisplay` helper.
- `src/modules/presale/__tests__/presaleAllocation.test.ts` — **Create.**
- `src/screens/PresaleScreen.tsx` — **Modify.** Render the allocation card in `PresaleActive`.

---

## Task 1: Allocation display helper

**Files:**
- Create: `src/modules/presale/presaleAllocation.ts`
- Test: `src/modules/presale/__tests__/presaleAllocation.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/presale/__tests__/presaleAllocation.test.ts`:
```ts
import {presaleAllocationDisplay} from '../presaleAllocation';
import {formatBalanceForDisplay} from '../../../utils/parseTokenAmount';

describe('presaleAllocationDisplay', () => {
  it('hides when there is no allocation', () => {
    expect(presaleAllocationDisplay({tokensPurchased: '0', referralBonusTokens: '0'}).show).toBe(false);
    expect(presaleAllocationDisplay({tokensPurchased: '', referralBonusTokens: ''}).show).toBe(false);
  });

  it('shows the purchased amount when there is no bonus', () => {
    const r = presaleAllocationDisplay({tokensPurchased: '176282478348', referralBonusTokens: '0'});
    expect(r.show).toBe(true);
    expect(r.nocText).toBe(formatBalanceForDisplay('176282478348', 9, 2));
  });

  it('sums purchased + referral bonus (base units)', () => {
    const r = presaleAllocationDisplay({tokensPurchased: '100000000000', referralBonusTokens: '10000000000'});
    expect(r.show).toBe(true);
    // 100 NOC + 10 NOC = 110 NOC
    expect(r.nocText).toBe(formatBalanceForDisplay('110000000000', 9, 2));
  });

  it('is resilient to a malformed stored value', () => {
    expect(presaleAllocationDisplay({tokensPurchased: 'oops', referralBonusTokens: '0'}).show).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest presaleAllocation`
Expected: FAIL — cannot find module `../presaleAllocation`.

- [ ] **Step 3: Implement**

Create `src/modules/presale/presaleAllocation.ts`:
```ts
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';

const NOC_DECIMALS = 9;

/**
 * Pure helper for the pre-TGE presale allocation card: total = purchased +
 * referral bonus (both 9-dec base-unit strings from presaleStore). Hidden when
 * the total is zero or a value is malformed.
 */
export function presaleAllocationDisplay(a: {
  tokensPurchased: string;
  referralBonusTokens: string;
}): {show: boolean; nocText: string} {
  let total: bigint;
  try {
    total = BigInt(a.tokensPurchased || '0') + BigInt(a.referralBonusTokens || '0');
  } catch {
    return {show: false, nocText: ''};
  }
  if (total <= 0n) {
    return {show: false, nocText: ''};
  }
  return {show: true, nocText: formatBalanceForDisplay(total.toString(), NOC_DECIMALS, 2)};
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest presaleAllocation` → PASS. `npx tsc --noEmit` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/modules/presale/presaleAllocation.ts src/modules/presale/__tests__/presaleAllocation.test.ts
git commit -m "feat(presale): presaleAllocationDisplay helper (purchased + bonus, hidden when zero)"
```

---

## Task 2: Render the allocation card in `#23`

**Files:**
- Modify: `src/screens/PresaleScreen.tsx` (`PresaleActive`)

- [ ] **Step 1: Import the helper + the store fields**

At the top of `src/screens/PresaleScreen.tsx`, add:
```ts
import {presaleAllocationDisplay} from '../modules/presale/presaleAllocation';
```
In `PresaleActive`, read the allocation fields from the store (add to the existing `usePresaleStore` reads):
```ts
  const tokensPurchased = usePresaleStore(s => s.tokensPurchased);
  const referralBonusTokens = usePresaleStore(s => s.referralBonusTokens);
  const allocation = presaleAllocationDisplay({tokensPurchased, referralBonusTokens});
```

- [ ] **Step 2: Render the card (read-only, info-tinted) below the input/estimate, above the sticky CTA**

Insert this block inside the `ScrollView` AFTER the input card (the "YOU PAY"/estimate card) and before the ScrollView closes (so it sits above the sticky [Buy NOC] bar). Build it to match the staking pre-TGE card style (`index.html` #22 — an info-tinted card); the implementer reads that for the exact classes:
```tsx
          {allocation.show ? (
            <View className="rounded-lg bg-bg-surface-2 border-l-2 border-l-info p-4 mb-4">
              <Text variant="overline" className="text-fg-secondary mb-1">
                YOUR PRESALE ALLOCATION
              </Text>
              <View className="flex-row items-baseline gap-2">
                <Text variant="body-lg" numeral className="text-fg-primary">
                  {allocation.nocText}
                </Text>
                <Text variant="body-sm" className="text-fg-secondary">
                  NOC
                </Text>
              </View>
              <Text variant="caption" className="text-fg-tertiary mt-1">
                Claimable after TGE
              </Text>
            </View>
          ) : null}
```
> If `border-l-info` isn't a valid token in this project's Tailwind config, use the same accent border the other cards use (`border border-bg-surface-3`) or `border-l-2 border-l-[#5BE3C2]`. Verify `Text` `variant="overline"`/`"body-lg"`/`numeral` are valid (they're used elsewhere in this file).

- [ ] **Step 3: Type-check + run the presale tests**

Run: `npx tsc --noEmit` (clean) and `npx jest presaleAllocation PresaleActive` (pass — the existing `canBuy`/PresaleActive tests still green; the new card doesn't change gating).

- [ ] **Step 4: Commit**

```bash
git add src/screens/PresaleScreen.tsx
git commit -m "feat(presale): show pre-TGE allocation card on #23 (You own X NOC · Claimable after TGE)"
```

---

## Task 3: Full verification + on-device

- [ ] **Step 1:** `npx jest && npx tsc --noEmit` → all pass, clean.
- [ ] **Step 2:** Build the APK: `cd android && ENVFILE=.env.production ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`; copy to `/home/user/Downloads/`.
- [ ] **Step 3: On-device (mainnet, the wallet that already bought):**
  - Open Dashboard → Buy (`#23`) → below the buy form, a card shows **"YOUR PRESALE ALLOCATION · {X} NOC · Claimable after TGE"** where X reflects the user's recorded purchases (e.g. the 0.35-SOL + USDC/USDT buys).
  - A wallet with no presale purchases → no card (nothing rendered).
  - No date is shown.

---

## Self-Review

**1. Spec coverage:**
- A. Allocation display on `#23` (total = purchased + bonus, shown when > 0, "Claimable after TGE", no date) → Tasks 1, 2. ✓
- B. No `tgeStatus` change / no TGE constant → respected (Task 2 only adds a card; nothing touches `tgeStatus` or adds a constant). ✓
- C. Error handling (no allocation → not rendered; malformed → hidden) → Task 1 (helper) + Task 2 (`allocation.show` gate). ✓
- D. Testing (pure helper: zero / purchased / purchased+bonus / malformed) → Task 1. ✓

**2. Placeholder scan:** Complete code in every step. The `border-l-info` note gives a concrete fallback. On-device step uses real values. No `TODO`/`TBD`.

**3. Type consistency:** `presaleAllocationDisplay({tokensPurchased, referralBonusTokens}) → {show, nocText}` defined in Task 1, consumed in Task 2. Reads `presaleStore.tokensPurchased`/`referralBonusTokens` (existing 9-dec base-unit string fields). `formatBalanceForDisplay(raw, decimals, maxDisplayDecimals)` is the existing util signature. No gaps; `tgeStatus` untouched (claim deferred).
