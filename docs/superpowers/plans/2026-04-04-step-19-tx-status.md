# Step 19: TransactionStatusScreen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the TransactionStatusScreen with 4 distinct states (pending/success/failed/timeout), tx signature polling every 500ms, Solscan explorer links, "Add to contacts" prompt, and proper timeout handling (E022 shows "unknown" not "failed").

**Architecture:** A state machine driven by a `pollTxStatus` function that polls `getSignatureStatus` every 500ms for up to 120 attempts (60s). The screen renders one of 4 sub-views based on `txState`. Cleanup on unmount cancels the polling loop.

**Tech Stack:** React Native, @solana/web3.js (getSignatureStatus), Linking (Solscan), formatAddress utility

---

## File Structure

```
src/
├── screens/
│   └── transparent/
│       ├── TransactionStatusScreen.tsx
│       └── __tests__/
│           └── TransactionStatusScreen.test.tsx
├── utils/
│   └── explorerUrl.ts                — Build Solscan/SolanaFM URLs
```

---

## Task 1: Explorer URL Utility

**Files:**
- Create: `src/utils/explorerUrl.ts`

- [ ] **Step 1: Create explorerUrl.ts**

```typescript
const EXPLORERS = {
  solscan: 'https://solscan.io/tx/',
  solanaexplorer: 'https://explorer.solana.com/tx/',
  solanafm: 'https://solana.fm/tx/',
} as const;

export function getExplorerUrl(
  signature: string,
  explorer: 'solscan' | 'solanaexplorer' | 'solanafm' = 'solscan',
): string {
  return `${EXPLORERS[explorer]}${signature}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/explorerUrl.ts
git commit -m "feat: explorer URL builder for Solscan/SolanaFM/Solana Explorer"
```

---

## Task 2: TransactionStatusScreen (TDD)

**Files:**
- Create: `src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx`
- Create: `src/screens/transparent/TransactionStatusScreen.tsx`

- [ ] **Step 1: Write tests**

6 tests:
1. Shows "Transaction submitted" in pending state
2. Shows "Sent!" in success state
3. Shows "Transaction failed" in failed state with error message
4. Shows "Transaction status unknown" in timeout state (NOT "failed")
5. Shows "View on Solscan" link in all states
6. Shows "Back to dashboard" button in success/failed/timeout states

- [ ] **Step 2: Implement TransactionStatusScreen**

Props: `{signature: string, amount: string, recipient: string, token: string, onDashboard: () => void, onRetry?: () => void}`

4-state rendering:
- **PENDING:** Pulse indicator + "Transaction submitted" + "Waiting for Solana confirmation..." + tx hash + Solscan link + "This usually takes 1-2 seconds"
- **SUCCESS:** Green ✓ + "Sent!" + amount + recipient + Solscan link + "+ Add to contacts" + "Back to dashboard"
- **FAILED:** Red ✗ + "Transaction failed" + error from ERROR_CODES + "Try again" + "Back to dashboard"
- **TIMEOUT:** Amber ⚠ + "Transaction status unknown" + "Your transaction may have been submitted. Check Activity tab for status." + Solscan link + "Back to dashboard"

Polling: useEffect on mount → poll getSignatureStatus every 500ms, max 120 attempts. On unmount, cancel via ref flag. On confirmed → SUCCESS, on err → FAILED, on 120 attempts → TIMEOUT.

- [ ] **Step 3: Run tests**

- [ ] **Step 4: Commit**

```bash
git add src/screens/transparent/TransactionStatusScreen.tsx src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx
git commit -m "feat: TransactionStatusScreen (4 states: pending/success/failed/timeout with polling)"
```

---

## Task 3: Wire into Navigator + Verify

- [ ] **Step 1: Replace TransactionStatus placeholder**
- [ ] **Step 2: tsc + jest**
- [ ] **Step 3: Commit + checklist**

```
✅ / ❌  Check
─────────────────────────────────────────────────────────
[ ]  PENDING: pulse, "Transaction submitted", tx hash, Solscan, back allowed
[ ]  SUCCESS: green ✓, "Sent!", amount+recipient, Solscan, "+ Add to contacts", dashboard CTA
[ ]  FAILED: red ✗, "Transaction failed", error from ERROR_CODES, "Try again", dashboard
[ ]  TIMEOUT: amber ⚠, "status unknown" (NOT "failed"), "may have been submitted", Solscan
[ ]  Polling: 500ms interval, max 120 attempts (60s), cleanup on unmount
[ ]  Explorer URL: Solscan default
[ ]  Navigator wired
[ ]  TypeScript strict: zero errors
[ ]  All tests pass
```
