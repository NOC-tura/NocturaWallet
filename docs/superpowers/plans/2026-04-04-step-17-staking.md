# Step 17: Staking Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Staking screen connecting to the live mainnet unified PROGRAM_ID. Display current staking position (locked amount, tier, unlock date, accrued rewards), allow new stakes with tier selection (90d/182d/365d), show projected rewards, presale buyer zero-fee badge, and staking-tier fee discount display. Prepare modular interface for the 3-layer post-presale architecture.

**Architecture:** StakingScreen is a data-driven component that reads from `usePresaleStore` (for zero-fee eligibility) and fetches staking position data via the Solana RPC module. A `StakingService` module provides the business logic: tier definitions, APY calculations, projected rewards, fee discount lookup. The actual on-chain transaction building (stake/claim/extend) uses the Solana transaction builder. Position data is mocked during scaffold — real Anchor IDL integration comes when the IDL is available.

**Tech Stack:** React Native, @solana/web3.js, Zustand (presaleStore, walletStore), MMKV, BigInt string parsing

---

## File Structure

```
src/
├── modules/
│   └── staking/
│       ├── stakingService.ts         — Tier definitions, APY calc, projected rewards, fee discount
│       ├── types.ts                  — StakingPosition, StakingTier, StakeParams
│       └── __tests__/
│           └── stakingService.test.ts
├── screens/
│   └── staking/
│       └── StakingScreen.tsx         — Full staking UI (position + new stake + badges)
├── components/
│   ├── StakingPositionCard.tsx       — Current position display (locked, tier, unlock, rewards)
│   ├── TierSelector.tsx             — [90d | 182d | 365d] tier picker with APY
│   ├── RewardCalculator.tsx         — Projected reward based on amount + tier
│   └── StakingUnlockRow.tsx         — Conditional row for unlock < 7 days
```

---

## Task 1: Staking Types + Service (TDD)

**Files:**
- Create: `src/modules/staking/types.ts`
- Create: `src/modules/staking/__tests__/stakingService.test.ts`
- Create: `src/modules/staking/stakingService.ts`

- [ ] **Step 1: Create types**

Create `src/modules/staking/types.ts`:
```typescript
export interface StakingTier {
  id: '90d' | '182d' | '365d';
  label: string;
  durationDays: number;
  apyPercent: number;
  feeDiscount: number; // 0, 0.1, 0.2, or 0.3
}

export interface StakingPosition {
  stakedAmount: string; // BigInt as string (NOC lamports)
  tier: StakingTier['id'];
  lockedAt: number; // UTC timestamp
  unlockAt: number; // UTC timestamp
  accruedRewards: string; // BigInt as string
  claimed: boolean;
}

export interface StakeParams {
  amount: string; // BigInt as string
  tierId: StakingTier['id'];
}

export const STAKING_TIERS: StakingTier[] = [
  {id: '90d', label: '90 Days', durationDays: 90, apyPercent: 34, feeDiscount: 0.1},
  {id: '182d', label: '182 Days', durationDays: 182, apyPercent: 68, feeDiscount: 0.2},
  {id: '365d', label: '365 Days', durationDays: 365, apyPercent: 128, feeDiscount: 0.3},
];
```

- [ ] **Step 2: Write tests**

Create `src/modules/staking/__tests__/stakingService.test.ts`:
```typescript
import {
  calculateProjectedReward,
  getTierById,
  getStakingDiscount,
  formatStakingAmount,
  STAKING_TIERS,
} from '../stakingService';

describe('stakingService', () => {
  describe('STAKING_TIERS', () => {
    it('has 3 tiers (90d, 182d, 365d)', () => {
      expect(STAKING_TIERS.length).toBe(3);
      expect(STAKING_TIERS.map(t => t.id)).toEqual(['90d', '182d', '365d']);
    });

    it('tiers have correct APY', () => {
      expect(STAKING_TIERS[0].apyPercent).toBe(34);
      expect(STAKING_TIERS[1].apyPercent).toBe(68);
      expect(STAKING_TIERS[2].apyPercent).toBe(128);
    });

    it('tiers have correct fee discounts', () => {
      expect(STAKING_TIERS[0].feeDiscount).toBe(0.1);
      expect(STAKING_TIERS[1].feeDiscount).toBe(0.2);
      expect(STAKING_TIERS[2].feeDiscount).toBe(0.3);
    });
  });

  describe('getTierById', () => {
    it('returns correct tier', () => {
      expect(getTierById('90d')?.apyPercent).toBe(34);
      expect(getTierById('365d')?.apyPercent).toBe(128);
    });

    it('returns undefined for invalid id', () => {
      expect(getTierById('999d' as '90d')).toBeUndefined();
    });
  });

  describe('calculateProjectedReward', () => {
    it('calculates reward for 1000 NOC at 34% APY for 90 days', () => {
      // 1000 * 0.34 * (90/365) ≈ 83.83 NOC
      const reward = calculateProjectedReward('1000000000000', '90d'); // 1000 NOC in lamports
      const rewardNoc = Number(reward) / 1e9;
      expect(rewardNoc).toBeCloseTo(83.84, 0);
    });

    it('returns 0 for zero amount', () => {
      expect(calculateProjectedReward('0', '90d')).toBe('0');
    });
  });

  describe('getStakingDiscount', () => {
    it('returns 0.1 for 90d tier', () => {
      expect(getStakingDiscount('90d')).toBe(0.1);
    });

    it('returns 0.3 for 365d tier', () => {
      expect(getStakingDiscount('365d')).toBe(0.3);
    });

    it('returns 0 for no tier', () => {
      expect(getStakingDiscount(null)).toBe(0);
    });
  });

  describe('formatStakingAmount', () => {
    it('formats lamports to display NOC', () => {
      expect(formatStakingAmount('1000000000')).toBe('1'); // 1 NOC
      expect(formatStakingAmount('1500000000')).toBe('1.5');
      expect(formatStakingAmount('0')).toBe('0');
    });
  });
});
```

- [ ] **Step 3: Implement stakingService**

Create `src/modules/staking/stakingService.ts`:
```typescript
import {STAKING_TIERS, type StakingTier} from './types';

// Re-export for convenience
export {STAKING_TIERS};
export type {StakingTier};

/**
 * Get a staking tier by ID.
 */
export function getTierById(id: StakingTier['id']): StakingTier | undefined {
  return STAKING_TIERS.find(t => t.id === id);
}

/**
 * Calculate projected reward for a given amount and tier.
 * Returns reward in lamports (string, BigInt-safe).
 *
 * Formula: amount * (apyPercent/100) * (durationDays/365)
 * Uses integer math via BigInt to avoid float precision issues.
 */
export function calculateProjectedReward(
  amountLamports: string,
  tierId: StakingTier['id'],
): string {
  const tier = getTierById(tierId);
  if (!tier) return '0';

  const amount = BigInt(amountLamports);
  if (amount === 0n) return '0';

  // Use 1e6 precision multiplier to avoid BigInt truncation
  const PRECISION = 1_000_000n;
  const apyScaled = BigInt(tier.apyPercent) * PRECISION / 100n;
  const durationScaled = BigInt(tier.durationDays) * PRECISION / 365n;
  const reward = amount * apyScaled * durationScaled / (PRECISION * PRECISION);

  return reward.toString();
}

/**
 * Get the NOC fee discount for a given staking tier.
 * Returns 0, 0.1, 0.2, or 0.3.
 */
export function getStakingDiscount(tierId: StakingTier['id'] | null): number {
  if (!tierId) return 0;
  const tier = getTierById(tierId);
  return tier?.feeDiscount ?? 0;
}

/**
 * Format lamports string to human-readable NOC amount.
 * NOC has 9 decimals.
 */
export function formatStakingAmount(lamports: string): string {
  const value = BigInt(lamports);
  const whole = value / 1_000_000_000n;
  const remainder = value % 1_000_000_000n;

  if (remainder === 0n) return whole.toString();

  // Trim trailing zeros from remainder
  let remStr = remainder.toString().padStart(9, '0');
  remStr = remStr.replace(/0+$/, '');

  return `${whole}.${remStr}`;
}
```

- [ ] **Step 4: Run tests — 10+ pass**

- [ ] **Step 5: Commit**

```bash
git add src/modules/staking/
git commit -m "feat: staking types + service (tiers, APY calc, projected rewards, fee discounts)"
```

---

## Task 2: Staking UI Components

**Files:**
- Create: `src/components/StakingPositionCard.tsx`
- Create: `src/components/TierSelector.tsx`
- Create: `src/components/RewardCalculator.tsx`
- Create: `src/components/StakingUnlockRow.tsx`

- [ ] **Step 1: StakingPositionCard**

```typescript
// Props: {position: StakingPosition, onClaimRewards: () => void, onExtendLock: () => void}
// Locked: X,XXX NOC | Tier: 365d | Unlock: Jan 15, 2027
// Accrued: X.XX NOC
// [CLAIM REWARDS] [EXTEND LOCK] buttons
```

- [ ] **Step 2: TierSelector**

```typescript
// Props: {selectedTier: StakingTier['id'], onSelect: (id) => void}
// 3 horizontal tier cards: [90d 34%] [182d 68%] [365d 128%]
// Selected card: accent border, active color
// Each shows: duration + APY + fee discount badge
```

- [ ] **Step 3: RewardCalculator**

```typescript
// Props: {amount: string, tierId: StakingTier['id']}
// "Projected reward: X.XX NOC"
// Computed via calculateProjectedReward
```

- [ ] **Step 4: StakingUnlockRow**

```typescript
// Props: {position: StakingPosition}
// Conditional: only render when unlock < 7 days away
// "Your stake unlocks in X days" warning row
// Auto-relock incentive: "Relock for 10-15% bonus yield"
```

- [ ] **Step 5: Commit**

```bash
git add src/components/StakingPositionCard.tsx src/components/TierSelector.tsx src/components/RewardCalculator.tsx src/components/StakingUnlockRow.tsx
git commit -m "feat: staking UI components (PositionCard, TierSelector, RewardCalculator, UnlockRow)"
```

---

## Task 3: StakingScreen — Full Layout (TDD)

**Files:**
- Create: `src/screens/staking/StakingScreen.tsx`
- Create: `src/screens/staking/__tests__/StakingScreen.test.tsx`

- [ ] **Step 1: Write tests**

Tests:
1. Shows tier selector with 3 options
2. Shows "Stake NOC" CTA
3. Shows presale buyer badge when isZeroFeeEligible
4. Shows fee discount badge for selected tier

- [ ] **Step 2: Implement StakingScreen**

Full layout:
1. Current position card (if position exists) with claim/extend buttons
2. StakingUnlockRow (conditional — unlock < 7 days)
3. New stake section: amount input + tier selector + reward calculator
4. Presale buyer badge: "Zero-fee eligible — 18 months remaining"
5. Fee discount badge: "Your X stake gives you Y% off private transaction fees"
6. [STAKE] CTA

Reads from: `usePresaleStore().isZeroFeeEligible`, `useWalletStore().nocBalance`

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add src/screens/staking/
git commit -m "feat: StakingScreen with position display, tier selector, reward calc, fee discount"
```

---

## Task 4: Wire into Navigator + Verification

**Files:**
- Modify: `src/app/Navigator.tsx`

- [ ] **Step 1: Replace Staking placeholder with real screen**

- [ ] **Step 2: Verify tsc + jest**

- [ ] **Step 3: Commit**

```bash
git add src/app/Navigator.tsx
git commit -m "feat: wire StakingScreen into Navigator"
```

- [ ] **Step 4: Verification checklist**

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  3 staking tiers: 90d/34%, 182d/68%, 365d/128%
[ ]  Fee discounts: 10%, 20%, 30% per tier
[ ]  Projected reward calculation uses BigInt (no float)
[ ]  formatStakingAmount handles 9 decimals correctly
[ ]  StakingPositionCard: locked amount + tier + unlock date + rewards
[ ]  TierSelector: 3 cards with APY + discount badge
[ ]  RewardCalculator: projected reward from amount + tier
[ ]  StakingUnlockRow: conditional (unlock < 7 days)
[ ]  Presale buyer badge: "Zero-fee eligible"
[ ]  Fee discount display per selected tier
[ ]  StakingScreen wired into Navigator
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
