# Post-M1d fixes (PR 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the limits M1d shipped with and the display bugs it exposed: label stale balances, write the "linked"
tag after a confirmed own-account Send, make #27 name the token, the recipient wallet and the direction correctly, show
one row per token, and count wSOL once. No new features.

**Architecture:** Staleness is data, not a screen decision. `forceSync` stops writing on a partial read and records
`lastSyncFailedAt` (memory only); `useAccountPublicData` and `useAccountRowBalances` gain a `stale` state that carries
the last figure with its age, and every screen renders that one shape. The "linked" tag is written by a small queue
(`src/modules/accounts/linkQueue.ts`) that #21 calls on proof of confirmation and that drains whenever the encrypted
registry is writable. #27's parsing moves into a pure function (`src/modules/solana/txDetail.ts`) tested against real
devnet responses.

**Tech Stack:** React Native 0.84 (Fabric, Hermes), TypeScript strict, Zustand + MMKV, TanStack Query v5, NativeWind,
Jest + @testing-library/react-native, @solana/web3.js 1.99.

**Spec:** `docs/superpowers/specs/2026-11-22-post-m1d-fixes-design.md`. Its §10 (R1–R16) and §11 (r2-1…r2-6, the r3
notes) are BINDING and override §3–§7 wherever they differ. Read the whole spec before any task.

**Branch:** `feat/post-m1d-fixes` (base `main` 3eec5f5).

## Global Constraints

- TypeScript strict; no `any`, no `@ts-ignore`; money stays BigInt up to the display edge.
- Every user-visible string lives in `src/copy/`. The guard tests `src/screens/shielded/__tests__/privacyClaims.test.ts`
  and `src/copy/__tests__/bannedWords.test.ts` keep their regexes unchanged.
- Gates, each with a real exit code:
  - full `npx jest` (single-file runs need `--forceExit` for some hook suites);
  - `npx tsc --noEmit`;
  - `npm run lint:ci`, which must print exactly `✖ 143 problems (0 errors, 143 warnings)` or fewer;
  - `node scripts/check-no-tge-date.mjs`.
- Never run `npx prettier --write`.
- Honesty rule: never show a value as current that was not read; never show a wrong figure; never claim a link without
  proof.

**Rules of this plan (they bind every task):**

- **Run Tasks 1 → 8 strictly in sequence, one at a time.** They share files:
  - `walletStore.ts`: Task 1, then Task 5 (which extends Task 1's `merge`). `backgroundSyncModule.ts`: Task 1.
    Tasks 2–4 read what Task 1 produced.
  - `useAccountPublicData.ts`, `useAccountRowBalances.ts`: Task 2.
  - `DashboardScreen.tsx` and its test: Tasks 2, 3, 5, 7 (in that order).
  - `SendScreen.tsx` and its test: Tasks 4, 7.
  - `TokenDetailScreen.tsx`: Tasks 3, 5.
  - `src/copy/accounts.ts`: Task 2 only (all stale copy lands there at once).
- **Line numbers are those of `main` 3eec5f5.** After each task they drift: re-find every reference by `grep` before
  editing. The symbol or string named next to each line number is the anchor, not the number.
- **Test first in every task.** Every existing test that changes carries a short comment saying why (name the spec
  item: "post-M1d §3.1", "R1", …).
- **Each task ends green on all four gates** and with one commit. A task never leaves a screen showing a stale figure
  as current, even between tasks (Task 2 says how it keeps that true before Task 3 lands).
- Single-file test runs: `npx jest <path> --forceExit`.

## Review Focus

Five conditions the spec implies but does not spell out, most likely first. Each has a test in its owning task.

1. **Hidden balances while stale.** With the eye toggle off and a stale account, the stale line and the row suffix still
   show, and no digit of the figure appears anywhere: hero, sub-balances, token rows, the split column and its
   accessibility label, the sheet row and its accessibility label (Task 3, tests D6 and S4).
2. **A token transfer the response does not fully describe.** A plain `transfer` (no mint in the instruction), a response
   with no `owner`, or a mint that calls itself "USDC" without being verified: #27 never names a token account as the
   wallet, never shows a symbol it cannot trust, and never shows a raw base-unit amount as a human figure
   (Task 8, tests P4, P5, P7 and Y3).
3. **Wipe and import with a link queued.** Addresses queued for the old wallet never tag an account of the new wallet,
   and a malformed queue record never breaks a confirmed Send (Task 6, tests Q7 and Q9).
4. **The clock and the age.** A device clock that moved backwards gives "just now", never a negative age; the age turns
   over at exactly 1 min, 60 min and 24 h; a later good read removes every stale mark and brings the 24h line back
   (Task 2, test C1; Task 3, test D7).
5. **One mint in two accounts where one is empty, and wSOL next to native SOL.** One row with the summed amount; the SOL
   row shows native SOL only; the hero counts wSOL once; a wallet with wSOL and 0 SOL still shows a "SOL 0" row
   (Task 5, tests T1, T2 and W3).

## File map

| File | Task | Responsibility after this plan |
|---|---|---|
| `src/store/zustand/walletStore.ts` | 1, 5 | + `lastSyncFailedAt` (memory only), `markSyncFailed`; core-token labels corrected on rehydration |
| `src/modules/backgroundSync/backgroundSyncModule.ts` | 1 | a partial sync writes nothing; `SyncResult.partial`; no NOC account after a good read is `'0'` |
| `src/modules/accounts/staleness.ts` (new) | 2 | `mainBalanceIsStale`, `mainBalanceIsUnknown` — the main account's two rules |
| `src/hooks/useAccountPublicData.ts` | 2 | + `status: 'stale'` |
| `src/hooks/useAccountRowBalances.ts` | 2 | + `state: 'stale'` |
| `src/copy/accounts.ts` | 2 | stale copy, `relativeAge`, `splitA11y` with a stale flag |
| `src/modules/accounts/valueLine.ts` | 3 | `publicSide` accepts a stale figure (with the column that dims it) |
| `src/screens/dashboard/DashboardScreen.tsx` | 2, 3, 5, 7 | stale display; native keyed by mint; drains the link queue on sheet open |
| `src/components/accounts/AccountsSheet.tsx` | 3 | stale rows, the main row included |
| `src/screens/transparent/TokenDetailScreen.tsx` | 3, 5 | stale holding; wSOL priced as SOL |
| `src/screens/transparent/SendScreen.tsx` | 4, 7 | refuses a stale balance; main retry = `forceSync`; `linksAccounts` |
| `src/modules/tokens/tokenModule.ts`, `coreTokens.ts` | 5 | one row per mint; "Wrapped SOL" / "wSOL" |
| `src/modules/prices/portfolio.ts` | 5 | `priceKeyFor` — wSOL priced from `prices['native']` |
| `src/components/TokenLogo.tsx` | 5 | the Solana logo for "wSOL" too |
| `src/modules/shielded/a0/accountRegistry.ts` | 6 | `markA0AccountsLinked`, `onA0AccountPromoted` |
| `src/modules/accounts/linkQueue.ts` (new) | 6 | the queue: memory + encrypted MMKV, drain rules |
| `src/constants/mmkvKeys.ts` | 6 | `ACCOUNTS_LINK_PENDING` |
| `src/modules/accounts/linking.ts`, `src/types/transfer.ts` | 7 | `linkedParticipants`; `TransferIntent.linksAccounts` |
| `src/screens/transparent/TransactionStatusScreen.tsx` | 7 | writes the tag on confirmed |
| `src/modules/session/secureStorageSession.ts` | 7 | drains after unlock |
| `src/modules/solana/txDetail.ts` (new) | 8 | pure parser + direction |
| `src/modules/tokens/trustedSymbol.ts` (new) | 8 | the only source of a symbol on #27 |
| `src/copy/transactions.ts` (new) | 8 | #27's words |
| `src/modules/solana/queries.ts` | 8 | `getTransactionDetail` delegates to the parser |
| `src/screens/transparent/TransactionDetailScreen.tsx`, `TransactionHistoryScreen.tsx`, `src/app/Navigator.tsx`, `src/types/navigation.d.ts` | 8 | route `{signature, account}`; History with no account |

---

### Task 1: A partial sync writes nothing, and the store remembers a failed sync

Spec: §3.1, R1, R13, r2-1, r2-5, both r3 notes; the honesty rule (the NOC figure after a good read).

**Files:**
- Modify: `src/store/zustand/walletStore.ts:15-34` (state type), `:36-46` (DEFAULTS), `:54-55` (`updateBalances`),
  `:71` (`partialize`)
- Modify: `src/modules/backgroundSync/backgroundSyncModule.ts:13-19` (`SyncResult`), `:21-120` (`forceSync`)
- Create: `src/store/zustand/__tests__/walletStore.test.ts`
- Test: `src/modules/backgroundSync/__tests__/backgroundSyncModule.test.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `WalletState.lastSyncFailedAt: number | null` — set when a sync of this session failed (partly or wholly),
    cleared by `updateBalances`, null after `reset` and after every rehydration. Never persisted.
  - `WalletState.markSyncFailed: () => void`.
  - `SyncResult.partial: boolean` — true when exactly one of the two reads failed. `success` is false then.
  - `updateBalances` still stamps `lastSyncedAt = Date.now()`; it is now called only when every read succeeded.
  - After a fully successful sync whose token read holds no NOC account, `nocBalance` is `'0'` (review r1-3) — never
    the previous figure.

**Why (read the code):** today `forceSync` calls `updateBalances` (`backgroundSyncModule.ts:73`) when only one read
succeeded, reusing the store's old value for the other (`:61`, `:65-71`), so a half-old figure gets a fresh
`lastSyncedAt`. It also calls `setTokens` (`:101-104`) with the fresh half.

**A second wrong figure in the same lines (review r1-3):** `:69-71` keep the store's old `nocBalance` when the token
read *succeeded* but holds no NOC account (`tokens[NOC_MINT] ?? useWalletStore.getState().nocBalance`). A wallet
whose NOC went to zero keeps showing the old amount, as current, under a fresh `lastSyncedAt`. A successful token
read that lists no NOC account is a read of zero.

- [ ] **Step 1: Write the failing store test.** Create `src/store/zustand/__tests__/walletStore.test.ts`:

```ts
/** post-M1d §3.1, R13, r2-1, r3 note 1: lastSyncFailedAt lives in memory only. */
import {mmkvPublic} from '../../mmkv/instances';
import {useWalletStore} from '../walletStore';

const NAME = 'noctura-wallet';

beforeEach(() => {
  useWalletStore.getState().reset();
});

it('markSyncFailed sets lastSyncFailedAt and leaves lastSyncedAt alone', () => {
  useWalletStore.setState({lastSyncedAt: 111});
  useWalletStore.getState().markSyncFailed();
  expect(useWalletStore.getState().lastSyncFailedAt).toEqual(expect.any(Number));
  expect(useWalletStore.getState().lastSyncedAt).toBe(111);
});

it('updateBalances stamps lastSyncedAt and clears lastSyncFailedAt', () => {
  useWalletStore.getState().markSyncFailed();
  useWalletStore.getState().updateBalances('5', '6', {});
  expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
  expect(useWalletStore.getState().lastSyncedAt).toEqual(expect.any(Number));
});

it('reset → null', () => {
  useWalletStore.getState().markSyncFailed();
  useWalletStore.getState().reset();
  expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
});

it('r3 note 1: the persisted record never carries lastSyncFailedAt', () => {
  useWalletStore.getState().updateBalances('5', '6', {});
  useWalletStore.getState().markSyncFailed();
  const persisted = JSON.parse(mmkvPublic.getString(NAME)!) as {state: Record<string, unknown>};
  expect('lastSyncFailedAt' in persisted.state).toBe(false);
  expect(persisted.state.lastSyncedAt).toEqual(expect.any(Number)); // positive control: the record is the real one
});

it('r3 note 1 / r2-1: a rehydrated store has it null — even from a record that carries one', async () => {
  mmkvPublic.set(
    NAME,
    JSON.stringify({state: {publicKey: 'P', solBalance: '9', lastSyncedAt: 5, lastSyncFailedAt: 9}, version: 0}),
  );
  await useWalletStore.persist.rehydrate();
  expect(useWalletStore.getState().lastSyncedAt).toBe(5); // positive control: the record was read
  expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
});
```

- [ ] **Step 2: Run it.** `npx jest src/store/zustand/__tests__/walletStore.test.ts --forceExit`
      Expected: FAIL — `markSyncFailed is not a function`.

- [ ] **Step 3: Implement the store change.** In `walletStore.ts`:
  - add `lastSyncFailedAt: number | null;` under `lastSyncedAt` in `WalletState`, with the comment
    `// post-M1d §3.1 / R13: this session's last failed sync. Memory only — excluded via partialize and forced null on rehydration.`;
  - add `markSyncFailed: () => void;` to the actions;
  - add `lastSyncFailedAt: null,` to `DEFAULTS`;
  - replace the two actions and the persist options:

```ts
      updateBalances: (sol, noc, tokens) =>
        set({solBalance: sol, nocBalance: noc, tokenBalances: tokens, lastSyncedAt: Date.now(), lastSyncFailedAt: null}),
      markSyncFailed: () => set({lastSyncFailedAt: Date.now()}),
```

```ts
      partialize: ({pkShielded: _pkShielded, lastSyncFailedAt: _lastSyncFailedAt, ...rest}) => rest,
      // r2-1: a new session never starts stale, whatever the record holds
      merge: (persisted, current) => ({...current, ...(persisted as Partial<WalletState>), lastSyncFailedAt: null}),
```

- [ ] **Step 4: Run it.** Same command. Expected: PASS (5 tests).

- [ ] **Step 5: Write the failing sync tests.** In `backgroundSyncModule.test.ts`:
  - **Change** the existing test `'handles errors gracefully and returns partial result'` (it asserts
    `success: true` for a SOL-read failure). Replace its body and title with the first test below; comment:
    `// post-M1d R1 / r2-5: a partial sync is a failed sync that writes nothing (was: success with a half-old figure)`.
  - Add `partial: false` to nothing else: the other existing tests use `toMatchObject` or read single fields.
  - Add, inside `describe('forceSync')`:

```ts
    const seedStore = () => {
      useWalletStore.getState().setPublicKey(TEST_PUBLIC_KEY);
      useWalletStore.setState({
        solBalance: '111',
        nocBalance: '222',
        tokenBalances: {OldMint: '333'},
        tokens: [{mint: 'OldMint', symbol: 'OLD', name: 'Old', decimals: 6, trust: 'verified'}],
        lastSyncedAt: 1000,
        lastSyncFailedAt: null,
      });
    };
    const unchanged = () => {
      const s = useWalletStore.getState();
      expect(s.solBalance).toBe('111');
      expect(s.nocBalance).toBe('222');
      expect(s.tokenBalances).toEqual({OldMint: '333'});
      expect(s.tokens.map(t => t.mint)).toEqual(['OldMint']); // r3 note 2: the early return comes before setTokens
      expect(s.lastSyncedAt).toBe(1000);
      expect(s.lastSyncFailedAt).toEqual(expect.any(Number));
    };

    it('R1 / r2-5: the SOL read failing alone writes nothing, keeps lastSyncedAt, sets lastSyncFailedAt', async () => {
      seedStore();
      mockGetBalance.mockRejectedValue(new Error('RPC error'));
      mockGetTokenAccounts.mockResolvedValue([
        {mint: 'TokenMint1111', owner: TEST_PUBLIC_KEY, amount: '1000', decimals: 6, address: 'TokenAddr1'},
      ]);
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: true, error: 'sol: RPC error'});
      unchanged();
    });

    it('R1 / r2-5: the token read failing alone writes nothing — the fresh SOL figure is NOT shown under the old age', async () => {
      seedStore();
      mockGetBalance.mockResolvedValue(BigInt(2_000_000_000));
      mockGetTokenAccounts.mockRejectedValue(new Error('timeout'));
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: true, error: 'tokens: timeout'});
      unchanged();
    });

    it('R1: both reads failing writes nothing; partial is false', async () => {
      seedStore();
      mockGetBalance.mockRejectedValue(new Error('429 Too Many Requests'));
      mockGetTokenAccounts.mockRejectedValue(new Error('429 Too Many Requests'));
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: false, error: '429 Too Many Requests'});
      unchanged();
    });

    it('R1: a thrown sync (no connection) sets lastSyncFailedAt too', async () => {
      seedStore();
      const {getConnection} = require('../../solana/connection');
      (getConnection as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Connection failed');
      });
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: false});
      unchanged();
    });

    it('R1: a later full success writes everything and clears lastSyncFailedAt', async () => {
      seedStore();
      useWalletStore.getState().markSyncFailed();
      mockGetBalance.mockResolvedValue(BigInt(2_000_000_000));
      mockGetTokenAccounts.mockResolvedValue([]);
      const result = await forceSync();
      expect(result).toMatchObject({success: true, partial: false, solBalance: '2000000000'});
      const s = useWalletStore.getState();
      expect(s.solBalance).toBe('2000000000');
      expect(s.lastSyncedAt).toBeGreaterThan(1000);
      expect(s.lastSyncFailedAt).toBeNull();
    });

    // review r1-3: this test MUST fail before Step 7 (today the old '222' is kept) — check that it does in Step 6
    it('a full success whose token read holds no NOC account → nocBalance "0", never the previous figure', async () => {
      seedStore(); // nocBalance '222'
      mockGetBalance.mockResolvedValue(BigInt(1));
      mockGetTokenAccounts.mockResolvedValue([
        {mint: 'TokenMint1111', owner: TEST_PUBLIC_KEY, amount: '1000', decimals: 6, address: 'TokenAddr1'},
      ]);
      const result = await forceSync();
      expect(result.success).toBe(true);
      expect(useWalletStore.getState().tokenBalances).toEqual({TokenMint1111: '1000'}); // positive control: this sync was written
      expect(useWalletStore.getState().nocBalance).toBe('0');
    });

    it('control: NOC held in two accounts → nocBalance is their sum', async () => {
      seedStore();
      mockGetBalance.mockResolvedValue(BigInt(1));
      mockGetTokenAccounts.mockResolvedValue([
        {mint: NOC_MINT, owner: TEST_PUBLIC_KEY, amount: '40', decimals: 9, address: 'Noc1'},
        {mint: NOC_MINT, owner: TEST_PUBLIC_KEY, amount: '2', decimals: 9, address: 'Noc2'},
      ]);
      await forceSync();
      expect(useWalletStore.getState().nocBalance).toBe('42');
    });

    it('a partial failure redacts the RPC key as a total one does', async () => {
      seedStore();
      const KEY = 'a852c8f4-e262-4a03-9a29-4e414edc87e5';
      mockGetBalance.mockRejectedValue(new Error(`request to https://mainnet.helius-rpc.com/?api-key=${KEY} failed`));
      mockGetTokenAccounts.mockResolvedValue([]);
      const result = await forceSync();
      expect(result.error).not.toContain(KEY);
      expect(result.error).toContain('<redacted>');
    });

    it('no wallet: nothing is marked failed (there is no figure to be stale)', async () => {
      const result = await forceSync();
      expect(result).toMatchObject({success: false, partial: false, error: 'No wallet loaded'});
      expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
    });
```

- [ ] **Step 6: Run them.** `npx jest src/modules/backgroundSync --forceExit`
      Expected: FAIL — the partial cases report `success: true`; `partial` is undefined; and the no-NOC test reads
      `'222'`, not `'0'` (if that one passes before Step 7, it is not testing the fix: stop and report).
      (`NOC_MINT` is imported in the test from `'../../../constants/programs'`.)

- [ ] **Step 7: Implement.** In `backgroundSyncModule.ts` add `partial: boolean;` to `SyncResult` (after `success`),
      and replace everything from `const [solBalance, tokenAccounts] = await Promise.allSettled(` down to the
      `useWalletStore.getState().updateBalances(sol, nocBalance, tokens);` line with:

```ts
    const [solBalance, tokenAccounts] = await Promise.allSettled([
      getBalance(connection, pk),
      getTokenAccounts(connection, pk),
    ]);

    // post-M1d R1 / r2-5: a sync counts only when EVERY read succeeded. A partial or total failure writes
    // nothing — not the balances, not the token list — so every figure keeps the age of the last fully
    // successful sync, and a fresh half never sits under an old age. Both reasons are surfaced (rate limit /
    // wrong cluster / network down show differently on the two endpoints); identical ones are deduplicated.
    if (solBalance.status === 'rejected' || tokenAccounts.status === 'rejected') {
      const reasonOf = (r: PromiseSettledResult<unknown>): string | null =>
        r.status === 'rejected' ? (r.reason instanceof Error ? r.reason.message : String(r.reason)) : null;
      const solReason = reasonOf(solBalance);
      const tokenReason = reasonOf(tokenAccounts);
      const partial = solReason === null || tokenReason === null;
      // Redacted here rather than at the display site: this string is returned into app state as well as
      // shown in an Alert, and the RPC endpoint carries the Helius API key in its query string.
      const reason = redactUrlSecrets(
        solReason !== null && tokenReason !== null
          ? solReason === tokenReason
            ? solReason
            : `sol: ${solReason}; tokens: ${tokenReason}`
          : solReason !== null
            ? `sol: ${solReason}`
            : `tokens: ${tokenReason}`,
      );
      if (__DEV__) {
        console.warn('[forceSync] a read failed:', reason);
      }
      useWalletStore.getState().markSyncFailed();
      return {success: false, partial, timestamp: Date.now(), error: reason};
    }

    const sol = solBalance.value.toString();
    // Sum per mint — an owner can hold one mint across several token accounts, which this wallet routinely does.
    const tokens = sumTokenBalancesByMint(tokenAccounts.value);
    // review r1-3: the token read succeeded, so "no NOC account" is a read of zero — never the store's old
    // figure (which would be shown as current under this sync's fresh lastSyncedAt)
    const nocBalance = tokens[NOC_MINT] ?? '0';

    useWalletStore.getState().updateBalances(sol, nocBalance, tokens);
```

  Then, below it:
  - remove the `if (tokenAccounts.status === 'fulfilled') {` wrapper around the metadata block (keep its body; both
    reads are fulfilled here) and update the comment above it: drop "Only refresh when the fetch succeeded…";
  - the final `return` becomes
    `{success: true, partial: false, solBalance: sol, tokenCount: tokenAccounts.value.length, timestamp: Date.now()}`;
  - the `'No wallet loaded'` return gains `partial: false`;
  - the `catch (e)` block calls `useWalletStore.getState().markSyncFailed();` before its `return`, and that return
    gains `partial: false`.

- [ ] **Step 8: Run them.** `npx jest src/modules/backgroundSync src/store/zustand/__tests__/walletStore.test.ts --forceExit`
      Expected: PASS.

- [ ] **Step 9: Gates.** `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`.
      `tsc` will flag every literal `SyncResult` without `partial`: fix them (the dashboard test's
      `forceSync` mock returns `{success: true}` through `jest.fn()`, which is untyped and needs no change).
      Note for the reviewer: the dashboard's pull-to-refresh alert (`DashboardScreen.tsx:211`,
      `mainShown && !result.success && opts.showErrors`) now also fires on a partial failure. That is intended;
      Task 3 pins it with a test.

- [ ] **Step 10: Commit.**

```bash
git add src/store/zustand/walletStore.ts src/store/zustand/__tests__/walletStore.test.ts \
  src/modules/backgroundSync/backgroundSyncModule.ts src/modules/backgroundSync/__tests__/backgroundSyncModule.test.ts
git commit -m "fix(sync): a partial sync writes nothing; no NOC account after a good read is 0; the store remembers a failed sync (memory only)"
```

---

### Task 2: "Stale" as data — the hooks, the rule, the copy

Spec: §3.1, §3.3, R5, R16 (the age), Review Focus 4.

**Files:**
- Create: `src/modules/accounts/staleness.ts`, `src/modules/accounts/__tests__/staleness.test.ts`
- Modify: `src/hooks/useAccountPublicData.ts:1-8` (header), `:23-26` (type), `:38-79` (body)
- Modify: `src/hooks/useAccountRowBalances.ts:1-9` (header), `:18` (type), `:38-49` (mapping)
- Modify: `src/copy/accounts.ts` (after `SEND_BALANCE_CHECKING` at `:31`; `splitA11y` at `:108-112`)
- Modify: `src/components/accounts/AccountsSheet.tsx:55-63` (`rowBalanceText`, a holding line only)
- Modify: `src/screens/dashboard/DashboardScreen.tsx:481-485` (the empty-list text, a holding line only)
- Create: `src/copy/__tests__/accountsStale.test.ts`
- Test: `src/hooks/__tests__/useAccountPublicData.test.tsx`, `src/hooks/__tests__/useAccountRowBalances.test.tsx`,
  `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`
- Not here: `src/modules/accounts/valueLine.ts`. `publicSide` keeps refusing a `stale` status in this task, so the
  split's Public column reads "—" for a stale account until Task 3 teaches the column to dim it (review r1-4).

**Interfaces:**
- Consumes (Task 1): `useWalletStore(s => s.lastSyncFailedAt): number | null`.
- Produces:

```ts
// src/modules/accounts/staleness.ts
export function mainBalanceIsStale(lastSyncedAt: number | null, lastSyncFailedAt: number | null): boolean;
/** never read, and this session's sync failed: NO figure exists (the store's '0' is a default, not a read) */
export function mainBalanceIsUnknown(lastSyncedAt: number | null, lastSyncFailedAt: number | null): boolean;

// src/hooks/useAccountPublicData.ts
export type AccountPublicData =
  | {status: 'loading'}
  | {status: 'error'}
  | ({status: 'ready'; syncedAt: number | null} & PublicBalances)
  | ({status: 'stale'; syncedAt: number; failedAt: number} & PublicBalances);

// src/hooks/useAccountRowBalances.ts
export type RowBalance =
  | {state: 'not-checked'}
  | {state: 'failed'}
  | {state: 'ready'; data: AccountSnapshot; at: number}
  | {state: 'stale'; data: AccountSnapshot; at: number};

// src/copy/accounts.ts
export function relativeAge(fromMs: number, nowMs: number): string; // "just now" | "5 min ago" | "2 h ago" | "3 d ago"
export function staleLine(age: string): string;   // `Not updated · ${age} · pull to refresh`
export function staleNote(age: string): string;   // `Not updated · ${age}` (a screen with no pull-to-refresh)
export const STALE_ROW_SUFFIX = 'not updated';
export function staleRow(figure: string): string; // `${figure} · not updated`
export const SEND_BALANCE_STALE = 'Not updated · tap to retry';
export function splitA11y(sideName: string, value: string, isActive: boolean, stale?: boolean): string;
```

**The main account, never read (review r1-1) — the rule every consumer relies on:**

| `lastSyncedAt` | `lastSyncFailedAt` | the hook returns for main | why |
|---|---|---|---|
| a time | null | `ready` | the last sync of this session succeeded (or none ran yet and the figure is the persisted one — R13) |
| a time | a time | `stale` | an older good read exists; the last attempt failed |
| null | a time | **`error`** | nothing was ever read and the sync failed: the store's `'0'` is a default, not a balance |
| null | null | **`loading`** | nothing was ever read and no sync of this session has failed yet: the read is still to come (controller ruling, 2026-11-22) |

**A main account that has never been read (`lastSyncedAt === null`) is never `ready`** — exactly what a non-main
account does today (`loading` until its first read settles, `error` if it failed). The honesty rule forbids the
store's defaults ("0") as a current figure, for a second as much as for a session.

**The screens need no change for this, and it is the same branch for main as for non-main** (checked in the code:
none of them looks at `isMain` when deciding what to draw, only at `status`):
- Dashboard: `publicReady = publicData.status === 'ready'` (`DashboardScreen.tsx:167`) → hero "—" (`:714-725`),
  sub-balances "—" (`:770`, `:777`), no rows (`:407`), and the empty text `PUBLIC_LOADING` for `loading` /
  `PUBLIC_UNAVAILABLE` for `error` (`:481-485`). The split's Public column is "—" (`valueLine.ts:38`).
- #12: `publicReady` (`SendScreen.tsx:138`) → "Available — SOL" (`:634`), MAX off (`:229`, `:599`), no "short by"
  (`:318`), CTA off (`:346`); the retry row only for `error` (`:615`).
- TokenDetail: `publicReady` (`TokenDetailScreen.tsx:57`) → "— SOL" (`:237`), fiat "—" (`:240`).
- The Accounts sheet's main row reads `walletStore` itself and already shows "not checked yet" while
  `lastSyncedAt` is null (`AccountsSheet.tsx:84-86`).
The tests below pin each of these for the MAIN account.

Before this ruling the third and fourth rows returned `ready`. Dashboard, TokenDetail and #12 gate only on
`status === 'ready'`, so a fresh import whose first sync failed showed `$0.00` and "Available 0 SOL" as current,
and #12 judged "insufficient" against that 0. With `error` they show "—" / "Balance unavailable", and #12 shows its
retry row (which Task 4 wires to `forceSync` for main).

**Honest between tasks:** this task adds the `stale` state but the screens are taught to draw it in Tasks 3 and 4.
Until then a stale status must read as "not known", never as current:
- Dashboard, #12 and TokenDetail already gate on `status === 'ready'`, so `stale` shows "—" there. One spot would
  lie: the dashboard's empty-list text falls through to "No tokens yet" (`DashboardScreen.tsx:481-485`). This task
  fixes that arm.
- `rowBalanceText` (`AccountsSheet.tsx:55-63`) would format a `stale` row as a current figure. This task makes it
  return `ROW_UNAVAILABLE` for `stale` (today's behaviour for a failed re-read). Task 3 replaces that line.

- [ ] **Step 1: Write the failing rule and copy tests.**

`src/modules/accounts/__tests__/staleness.test.ts`:

```ts
/** post-M1d §3.1: the main account's figure is stale when this session's last sync failed AND an older good read
 *  exists; it is unknown when the sync failed and nothing was ever read (review r1-1). Never both. */
import {mainBalanceIsStale, mainBalanceIsUnknown} from '../staleness';

it.each<[string, number | null, number | null, boolean, boolean]>([
  ['never read, never failed', null, null, false, false],
  ['never read, failed → unknown, not stale', null, 900, false, true],
  ['read, not failed → current', 500, null, false, false],
  ['read, then failed → stale, not unknown', 500, 900, true, false],
])('%s', (_n, syncedAt, failedAt, stale, unknown) => {
  expect(mainBalanceIsStale(syncedAt, failedAt)).toBe(stale);
  expect(mainBalanceIsUnknown(syncedAt, failedAt)).toBe(unknown);
});
```

`src/copy/__tests__/accountsStale.test.ts`:

```ts
/** post-M1d §3.2 / §3.3 / R16: the stale copy and the age. */
import {SEND_BALANCE_STALE, STALE_ROW_SUFFIX, relativeAge, splitA11y, staleLine, staleNote, staleRow} from '../accounts';

const MIN = 60_000;
const H = 60 * MIN;
const D = 24 * H;

// C1 (Review Focus 4)
it.each<[string, number, string]>([
  ['0 ms', 0, 'just now'],
  ['59.999 s', MIN - 1, 'just now'],
  ['exactly 1 min', MIN, '1 min ago'],
  ['5 min', 5 * MIN, '5 min ago'],
  ['59 min 59 s', H - 1, '59 min ago'],
  ['exactly 60 min', H, '1 h ago'],
  ['2 h', 2 * H, '2 h ago'],
  ['23 h 59 min', D - MIN, '23 h ago'],
  ['exactly 24 h', D, '1 d ago'],
  ['3 d', 3 * D, '3 d ago'],
  ['the clock moved backwards (a negative age)', -5 * MIN, 'just now'],
])('relativeAge: %s → %s', (_n, elapsed, expected) => {
  expect(relativeAge(1_000_000_000, 1_000_000_000 + elapsed)).toBe(expected);
});

it('the three lines, exactly', () => {
  expect(staleLine('5 min ago')).toBe('Not updated · 5 min ago · pull to refresh');
  expect(staleNote('2 h ago')).toBe('Not updated · 2 h ago');
  expect(STALE_ROW_SUFFIX).toBe('not updated');
  expect(staleRow('0.5 SOL')).toBe('0.5 SOL · not updated');
  expect(SEND_BALANCE_STALE).toBe('Not updated · tap to retry');
});

it('splitA11y says "not updated" for a stale side, and is unchanged otherwise', () => {
  expect(splitA11y('Public', '$12.40', true)).toBe('Public, $12.40');
  expect(splitA11y('Public', '$12.40', true, true)).toBe('Public, $12.40, not updated');
  expect(splitA11y('Public', '$12.40', false, true)).toBe('Public, $12.40, not updated, switch to Public');
  expect(splitA11y('Public', '•••', true, true)).toBe('Public, •••, not updated'); // hidden: no figure, still said
});
```

- [ ] **Step 2: Run them.** `npx jest src/modules/accounts/__tests__/staleness.test.ts src/copy/__tests__/accountsStale.test.ts --forceExit`
      Expected: FAIL — the modules/exports do not exist.

- [ ] **Step 3: Implement the rule and the copy.**

`src/modules/accounts/staleness.ts`:

```ts
/**
 * post-M1d spec §3.1 (R1, R13): the MAIN account's figure (walletStore, written by forceSync) is stale
 * when the last sync attempt of this session failed and an older fully successful read exists. With no
 * successful read ever the figure is unknown, not stale. One rule, read by useAccountPublicData and by
 * the Accounts sheet's main row (R10). Pure.
 */
export function mainBalanceIsStale(lastSyncedAt: number | null, lastSyncFailedAt: number | null): boolean {
  return lastSyncFailedAt !== null && lastSyncedAt !== null;
}

/**
 * Review r1-1: nothing was ever read and this session's sync failed. walletStore then holds its
 * defaults ('0'), which are not a balance: every consumer must show "unknown", never 0.
 */
export function mainBalanceIsUnknown(lastSyncedAt: number | null, lastSyncFailedAt: number | null): boolean {
  return lastSyncFailedAt !== null && lastSyncedAt === null;
}
```

In `src/copy/accounts.ts`, after `SEND_BALANCE_CHECKING`:

```ts
/**
 * post-M1d §3.3: a balance that failed to refresh is shown as the last known figure, marked with its age.
 * The age (R16) is recomputed on render and every 60 s while the screen is focused.
 */
export function relativeAge(fromMs: number, nowMs: number): string {
  const mins = Math.floor(Math.max(0, nowMs - fromMs) / 60_000); // a clock that moved backwards is "just now"
  if (mins < 1) {
    return 'just now';
  }
  if (mins < 60) {
    return `${mins} min ago`;
  }
  const hours = Math.floor(mins / 60);
  if (hours < 24) {
    return `${hours} h ago`;
  }
  return `${Math.floor(hours / 24)} d ago`;
}
/** #11, under the hero */
export function staleLine(age: string): string {
  return `Not updated · ${age} · pull to refresh`;
}
/** A screen that has no pull-to-refresh (the token detail's holding) */
export function staleNote(age: string): string {
  return `Not updated · ${age}`;
}
/** The Accounts sheet: a row whose last figure could not be refreshed */
export const STALE_ROW_SUFFIX = 'not updated';
export function staleRow(figure: string): string {
  return `${figure} · ${STALE_ROW_SUFFIX}`;
}
/** #12: a stale balance is not usable for sending — the tap re-reads */
export const SEND_BALANCE_STALE = 'Not updated · tap to retry';
```

and replace `splitA11y`:

```ts
export function splitA11y(sideName: string, value: string, isActive: boolean, stale = false): string {
  // review Task 5 m8: a screen reader says nothing for "—"; it hears "not known yet"
  const spoken = value === VALUE_UNKNOWN ? SPLIT_UNKNOWN_A11Y : value;
  const said = stale ? `${spoken}, ${STALE_ROW_SUFFIX}` : spoken; // post-M1d §3.2
  return isActive ? `${sideName}, ${said}` : `${sideName}, ${said}, switch to ${sideName}`;
}
```

- [ ] **Step 4: Run them.** Same command. Expected: PASS. Also run
      `npx jest src/copy src/screens/shielded/__tests__/privacyClaims.test.ts --forceExit` — the guards stay green.

- [ ] **Step 5: Write the failing hook tests.**

In `src/hooks/__tests__/useAccountPublicData.test.tsx`:
- the `beforeEach` `useWalletStore.setState({...})` gains `lastSyncFailedAt: null`;
- **change** `'review r1 N1: a failed re-read of a non-main account is error, not the old figure…'`: the first
  `waitFor` becomes the stale assertion below; comment
  `// post-M1d §3.1 / R5: a failed re-read with a figure from this session is STALE (was: error)`;
- add:

```ts
it('post-M1d §3.1: another account — read then failed → stale with the old figure and its age; read again → ready', async () => {
  const OLD = {...SNAP, solBalance: '111'};
  const NEW = {...SNAP, solBalance: '222'};
  const readAt = Date.now() - 60_000;
  qc.setQueryData([ACCOUNT_SNAPSHOT_KEY, A3], OLD, {updatedAt: readAt});
  mockFetch.mockRejectedValueOnce(new Error('429'));
  const {result} = renderHook(() => useAccountPublicData({address: A3, isMain: false}), {wrapper});
  await waitFor(() => expect(result.current.data.status).toBe('stale'));
  expect(result.current.data).toMatchObject({status: 'stale', solBalance: '111', syncedAt: readAt, failedAt: expect.any(Number)});
  mockFetch.mockResolvedValueOnce(NEW);
  await act(async () => {
    await result.current.refetch();
  });
  await waitFor(() => expect(result.current.data).toMatchObject({status: 'ready', solBalance: '222'}));
});

it('R5: another account never read in this session + a failed read → error (no figure exists)', async () => {
  mockFetch.mockRejectedValue(new Error('429'));
  const {result} = renderHook(() => useAccountPublicData({address: A3, isMain: false}), {wrapper});
  await waitFor(() => expect(result.current.data).toEqual({status: 'error'}));
});

it('post-M1d §3.1: main — read then failed → stale, the age from lastSyncedAt; a good sync → ready', () => {
  useWalletStore.setState({lastSyncedAt: 123, lastSyncFailedAt: 456});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'stale', solBalance: '1000000000', nocBalance: '7', tokenBalances: {}, tokens: [], syncedAt: 123, failedAt: 456});
  act(() => {
    useWalletStore.getState().updateBalances('5', '7', {});
  });
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '5'});
  expect(mockFetch).not.toHaveBeenCalled();
});

// review r1-1: 'ready' here made every screen show the store's default 0 as a current balance
it('post-M1d §3.1: main — never read + the sync failed → error: no figure, never the store\'s default 0', () => {
  useWalletStore.setState({solBalance: '0', nocBalance: '0', lastSyncedAt: null, lastSyncFailedAt: 456});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'error'});
  expect(mockFetch).not.toHaveBeenCalled();
});

it('post-M1d §3.1: main — that state, then a good sync → ready with the read figure', () => {
  useWalletStore.setState({lastSyncedAt: null, lastSyncFailedAt: 456});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  act(() => {
    useWalletStore.getState().updateBalances('5', '7', {});
  });
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '5', syncedAt: expect.any(Number)});
});

// controller ruling 2026-11-22: a never-read main is never 'ready' — the store's defaults are not a balance
it('main — never read and no sync of this session has failed → loading (as a non-main account before its first read)', () => {
  useWalletStore.setState({solBalance: '0', nocBalance: '0', lastSyncedAt: null, lastSyncFailedAt: null});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data).toEqual({status: 'loading'});
  expect(mockFetch).not.toHaveBeenCalled();
});

it('main — the three states in order: loading → (the sync fails) error → (a sync succeeds) ready', () => {
  useWalletStore.setState({lastSyncedAt: null, lastSyncFailedAt: null});
  const {result} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
  expect(result.current.data.status).toBe('loading');
  act(() => {
    useWalletStore.getState().markSyncFailed();
  });
  expect(result.current.data).toEqual({status: 'error'});
  act(() => {
    useWalletStore.getState().updateBalances('5', '7', {});
  });
  expect(result.current.data).toMatchObject({status: 'ready', solBalance: '5', syncedAt: expect.any(Number)});
});

it('main is never ready with syncedAt null (property over the four store states)', () => {
  for (const [syncedAt, failedAt] of [[null, null], [null, 9], [5, null], [5, 9]] as const) {
    useWalletStore.setState({lastSyncedAt: syncedAt, lastSyncFailedAt: failedAt});
    const {result, unmount} = renderHook(() => useAccountPublicData({address: MAIN, isMain: true}), {wrapper});
    const d = result.current.data;
    expect(d.status === 'ready' && d.syncedAt === null).toBe(false);
    expect(d.status).toBe(syncedAt === null ? (failedAt === null ? 'loading' : 'error') : failedAt === null ? 'ready' : 'stale');
    unmount();
  }
});
```

- **Change** the existing `'plan A12: main never synced → syncedAt null'` test (it expects `ready` with
  `syncedAt: null`): its expectation becomes `expect(result.current.data).toEqual({status: 'loading'});`, title
  `'main never synced → loading (was: ready with syncedAt null)'`, comment
  `// post-M1d controller ruling 2026-11-22: a never-read main is never ready`.
- After the implementation, run the full `npx jest`: any other suite that renders the REAL hook for a main account
  whose store has `lastSyncedAt: null` and expects figures now sees `loading`. Give that suite's store a
  `lastSyncedAt` (it meant "a synced wallet"), with the same comment. Do not weaken the hook.

In `src/hooks/__tests__/useAccountRowBalances.test.tsx`, **change** `'review r1 m7: a failed re-read is "failed"…'`:
its last line becomes
`await waitFor(() => expect(result.current.acc0).toMatchObject({state: 'stale', data: SNAP, at: expect.any(Number)}));`
with the title `'post-M1d §3.1 / R5: a failed re-read of a row read earlier in this session is "stale" with that figure (was "failed")'`,
and add:

```ts
it('R5: a row never read whose first read fails is "failed" (Balance unavailable)', async () => {
  const {result} = renderHook(() => useAccountRowBalances(['acc0'], true), {wrapper});
  await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
  await act(async () => {
    pending.acc0!.reject(new Error('429'));
  });
  await waitFor(() => expect(result.current.acc0).toEqual({state: 'failed'}));
});
```

In `DashboardScreen.test.tsx` add (inside the transparent-mode describe):

```ts
  it('post-M1d (between Tasks 2 and 3): a stale status never reads "No tokens yet"', async () => {
    mockPublic.current = {status: 'stale', syncedAt: 1, failedAt: 2, solBalance: '1000000000', nocBalance: '0', tokens: [], tokenBalances: {}};
    const r = await renderDashboard();
    expect(r.queryByText('No tokens yet · pull to refresh')).toBeNull();
    // review r1-4: publicSide does not accept 'stale' until Task 3 — the split never shows it undimmed
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['—']);
  });

  // controller ruling 2026-11-22 — pin (passes before the change: this suite mocks the hook). The MAIN account in
  // 'loading' takes the same branch a non-main account does: nothing is drawn as a figure.
  it('main never read, no failed sync yet (the hook\'s "loading") → "—" and "Loading balances…", never $0.00 or "No tokens yet"', async () => {
    mockSelected.current = MAIN_ACCOUNT;
    mockPublic.current = {status: 'loading'};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-public-empty')).toHaveTextContent('Loading balances…');
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('—');
    expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['—']);
    expect(r.queryByText(/\$0\.00/)).toBeNull();
    expect(r.queryByText('No tokens yet · pull to refresh')).toBeNull();
  });

  // review r1-1 — pin (passes before the change: this suite mocks the hook; the real state is pinned in
  // useAccountPublicData.test.tsx above). It fixes what the dashboard draws for the status the hook now returns.
  it('post-M1d §3.1: main never read + a failed sync (the hook\'s "error") → "—" and "Balance unavailable", never $0.00', async () => {
    mockPublic.current = {status: 'error'};
    const r = await renderDashboard();
    expect(r.getByTestId('dashboard-public-balance')).toHaveTextContent('—');
    expect(r.getByTestId('dashboard-public-empty')).toHaveTextContent('Balance unavailable · pull to refresh');
    expect(r.getByTestId('dashboard-sub-sol')).toHaveTextContent('—');
    expect(r.queryByText(/\$0\.00/)).toBeNull();
    expect(r.queryByText(/^0 SOL$/)).toBeNull();
  });
```

(Task 3 rewrites the first test into the stale-rows test; it exists now so this commit is honest.)

- [ ] **Step 6: Run them.** `npx jest src/hooks/__tests__/useAccountPublicData.test.tsx src/hooks/__tests__/useAccountRowBalances.test.tsx src/screens/dashboard --forceExit`
      Expected: FAIL — `status` is `'error'` / `'failed'`, the type has no `stale`; the never-read main is `'ready'`.
      (The dashboard "error" pin passes already; that is what a pin does.)

- [ ] **Step 7: Implement.**

`useAccountPublicData.ts` — the type as in **Interfaces**; in the hook:

```ts
  const lastSyncFailedAt = useWalletStore(s => s.lastSyncFailedAt);
```

```ts
  const mainData = useMemo<AccountPublicData | null>(() => {
    if (!isMain) return null;
    // controller ruling 2026-11-22 + review r1-1: a main account never read is never 'ready' — the store
    // holds defaults ('0'), not a balance. No failed sync yet → loading; a failed one → error. (The same two
    // states a non-main account has before its first read.)
    if (lastSyncedAt === null) {
      return mainBalanceIsUnknown(lastSyncedAt, lastSyncFailedAt) ? {status: 'error'} : {status: 'loading'};
    }
    const main = withPoolToken({solBalance, nocBalance, tokenBalances, tokens});
    // post-M1d §3.1: this session's last sync failed and an older good read exists → the figure is stale
    if (lastSyncedAt !== null && lastSyncFailedAt !== null && mainBalanceIsStale(lastSyncedAt, lastSyncFailedAt)) {
      return {status: 'stale', ...main, syncedAt: lastSyncedAt, failedAt: lastSyncFailedAt};
    }
    return {status: 'ready', ...main, syncedAt: lastSyncedAt ?? null};
  }, [isMain, solBalance, nocBalance, tokenBalances, tokens, lastSyncedAt, lastSyncFailedAt]);
```

and replace the `if (q.isError) {…}` block:

```ts
  if (q.isError) {
    // post-M1d §3.1 / R5: a failed re-read keeps the figure read earlier in THIS session (the query cache,
    // gcTime 5 min) and marks it stale — never as current. With nothing cached there is no figure: error.
    if (q.data) {
      return {data: {status: 'stale', ...q.data, syncedAt: q.dataUpdatedAt, failedAt: q.errorUpdatedAt}, refetch};
    }
    return {data: {status: 'error'}, refetch};
  }
```

Import `mainBalanceIsStale` and `mainBalanceIsUnknown` from `'../modules/accounts/staleness'`. Update the file header: replace
"`loading` / `error` are states" with "`loading` / `error` are states, and `stale` is the last figure with its age
(post-M1d §3.1) — never to be drawn as current".

`useAccountRowBalances.ts` — the type as in **Interfaces**, and:

```ts
    if (r?.isError) {
      // post-M1d §3.1 / R5: a failed re-read keeps this session's figure, marked stale; with none, "failed"
      rows[address] = r.data ? {state: 'stale', data: r.data, at: r.dataUpdatedAt} : {state: 'failed'};
    } else if (r?.data) {
```

Update the header sentence "…and then turns to the fresh figure, or to "Balance unavailable" if the re-read failed"
to "…and then turns to the fresh figure, or — if the re-read failed — to that same figure marked stale (post-M1d)".

`AccountsSheet.tsx` `rowBalanceText` — the holding line:

```ts
  if (row.state === 'failed' || row.state === 'stale') {
    return ROW_UNAVAILABLE; // 'stale' is drawn (dimmed, " · not updated") from post-M1d Task 3 on
  }
```

`DashboardScreen.tsx:481-485` — the last arm of the ternary:

```tsx
                  : publicData.status === 'ready'
                    ? 'No tokens yet · pull to refresh'
                    : PUBLIC_UNAVAILABLE}
```

(so the full chain is loading → `PUBLIC_LOADING`, error → `PUBLIC_UNAVAILABLE`, ready → the empty text, anything
else → `PUBLIC_UNAVAILABLE`).

- [ ] **Step 8: Run them.** The Step 6 command. Expected: PASS.

- [ ] **Step 9: Gates.** `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`.

- [ ] **Step 10: Commit.**

```bash
git add src/modules/accounts/staleness.ts src/modules/accounts/__tests__/staleness.test.ts \
  src/copy/accounts.ts src/copy/__tests__/accountsStale.test.ts \
  src/hooks/useAccountPublicData.ts src/hooks/useAccountRowBalances.ts src/hooks/__tests__ \
  src/components/accounts/AccountsSheet.tsx src/screens/dashboard
git commit -m "feat(stale): a failed refresh keeps the last figure as a 'stale' state; a never-read main is unknown, not 0"
```

---

### Task 3: Stale balances on the dashboard, the Accounts sheet and the token detail

Spec: §3.2, R10, R16, Review Focus 1 and 4; §7 coverage (the dashboard and TokenDetail "<0.0001" rows, the split tap).

**Files:**
- Modify: `src/screens/dashboard/DashboardScreen.tsx` — `:166-168` (the data), `:389-395` (split, change),
  `:407` (list data), `:420-447` (header props), `:449-473` (`renderItem`), `:515-548` (`DashboardHeaderProps`),
  `:713-727` (hero), `:745-761` (change line), `:767-783` (sub-balances), `:790-797` (public split column),
  `:939-983` (`SplitColumn`), `:987-1015` (`SubBalanceCell`), `:1047-1118` (`TokenListRow`)
- Modify: `src/modules/accounts/valueLine.ts:38` (`publicSide` — moved here from Task 2, review r1-4: it lands in
  the same commit as the column that dims it)
- Modify: `src/components/accounts/AccountsSheet.tsx:55-63`, `:70-90`, `:113`, `:145-147`
- Modify: `src/screens/transparent/TokenDetailScreen.tsx:56-58`, `:229-251`
- Test: `src/modules/accounts/__tests__/valueLine.test.ts`, `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`,
  `src/components/accounts/__tests__/AccountsSheet.test.tsx`,
  `src/screens/transparent/__tests__/TokenDetailScreen.test.tsx`

**Interfaces:**
- Consumes (Task 2): `AccountPublicData` (`status: 'stale'` with `syncedAt`, `failedAt`), `RowBalance`
  (`state: 'stale'`), `mainBalanceIsStale`, `mainBalanceIsUnknown`, `relativeAge`, `staleLine`, `staleNote`, `staleRow`, `splitA11y(…, stale)`.
  (Task 1): `useWalletStore(s => s.lastSyncFailedAt)`, `SyncResult.partial`.
- Produces: no new exports. New testIDs: `dashboard-stale-line`, `token-detail-stale`.
  `rowBalanceText(row, prices)` keeps its signature and now returns the figure for `stale` (the caller adds the suffix).

**What "dimmed" is here:** `text-fg-tertiary` on the figure's `Text` (replacing `text-fg-primary` /
`text-fg-secondary`). No opacity. Tests assert it the way this repo already does
(`AmountLimitHint.test.tsx:20`): `expect(node.props.className).toMatch(/(^|\s)text-fg-tertiary(\s|$)/)`; a control
asserts `.not.toMatch` of the same pattern. Do not assert the absence of another colour class.

- [ ] **Step 0: `publicSide` accepts a stale figure (review r1-4: here, not in Task 2).** Test first, in
      `src/modules/accounts/__tests__/valueLine.test.ts` (`publicSide` and `sideLines` are already imported there):

```ts
it('post-M1d §3.2: a stale figure is a known side (the screen dims it); the same lines as the ready one', () => {
  const figure = {solBalance: '1000000000', nocBalance: '0', tokenBalances: {}, tokens: []};
  const ready = publicSide({status: 'ready', syncedAt: 5, ...figure});
  const stale = publicSide({status: 'stale', syncedAt: 5, failedAt: 9, ...figure});
  expect(stale).toEqual(ready);
  expect(sideLines(stale, null)).toEqual(['1 SOL']);
});

it('an error (a never-read main whose sync failed) is an unknown side: "—"', () => {
  expect(sideLines(publicSide({status: 'error'}), null)).toEqual(['—']);
});
```

      Run `npx jest src/modules/accounts/__tests__/valueLine.test.ts --forceExit` → the first FAILS (`unknown`).
      Implement at `valueLine.ts:38`:

```ts
  // post-M1d §3.2: a stale figure is a known side (the screen dims it and says "not updated")
  if ((data.status !== 'ready' && data.status !== 'stale') || data.syncedAt === null) {
```

      Run again → PASS. Do not commit yet: between this step and Step 3 the split would show a stale figure
      undimmed; they ship in this task's one commit. In Task 2's holding test the split assertion
      (`['—']` for a stale account) now fails — that test is replaced by D5 and D8 in Step 1.

- [ ] **Step 1: Write the failing dashboard tests.** In `DashboardScreen.test.tsx`, add a describe
      `'post-M1d §3.2 — a stale public balance'` with these fixtures at its top:

```ts
  const NOW = 1_800_000_000_000;
  const STALE_MAIN: AccountPublicData = {
    status: 'stale', syncedAt: NOW - 5 * 60_000, failedAt: NOW - 1000,
    solBalance: '1000000000', nocBalance: '2000000000',
    tokens: [{mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}],
    tokenBalances: {USDCMINT: '5000000'},
  };
  beforeEach(() => {
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockPublic.current = STALE_MAIN;
    (computePortfolio as jest.Mock).mockReturnValue({totalUsd: 150, change24hPct: 1.5, perToken: {USDCMINT: {usd: 5, change24h: 0.1}}});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    (computePortfolio as jest.Mock).mockReturnValue({totalUsd: 150, change24hPct: 1.5, perToken: {}});
  });
```

(import `computePortfolio` from `'../../../modules/prices/portfolio'` next to the subject import; it is the
`jest.fn` of the existing mock.) Tests:

  - **D1** hero: `dashboard-public-balance` has text content `$150.00`, and the `Text` holding `$150` has a
    `className` matching `/(^|\s)text-fg-tertiary(\s|$)/`.
  - **D2** the line: `getByTestId('dashboard-stale-line')` has text `Not updated · 5 min ago · pull to refresh`.
  - **D3** the 24h line is hidden: `queryByText(/· 24h/)` is null. Positive control in the same test: set
    `mockPublic.current = READY_MAIN`, render again, and `getByText(/· 24h/)` exists.
  - **D4** sub-balances: `dashboard-sub-sol` reads `1` and `dashboard-sub-noc` reads `2`, each with `className`
    containing `text-fg-tertiary`.
  - **D5** token rows: the USDC row shows `5 USDC` and `$5.00`, both `text-fg-tertiary`; `queryByText('+0.1%')` is
    null (R16). Positive control: with `{...STALE_MAIN, status: 'ready'}` (drop `failedAt`), `getByText('+0.1%')`
    exists.
  - **D6 (Review Focus 1)** hidden wins: `mockHide.current = true`; then
    - `getByTestId('dashboard-stale-line')` still reads `Not updated · 5 min ago · pull to refresh`;
    - `dashboard-public-balance` is absent or holds no digit (`queryByText(/\$150/)` is null);
    - `dashboard-sub-sol` reads `••••`;
    - no element's text matches `/5 USDC|\$5\.00|\$150/`;
    - `getByTestId('dashboard-split-public').props.accessibilityLabel` is `Public, •••, not updated` and matches no
      `/\d/`.
  - **D7 (Review Focus 4)** recovery: render stale, then set `mockPublic.current = READY_MAIN`, `rerender` the same
    tree, and assert `queryByTestId('dashboard-stale-line')` is null, `getByText(/· 24h/)` exists, and the hero `Text`
    no longer carries `text-fg-tertiary`.
  - **D8** the split's public column: `getAllByTestId('dashboard-split-public-line')` texts are
    `['5 USDC', '2 NOC', '+1 more']` (NOC and USDC have no price in this suite, so the token form; the same lines a
    `ready` figure gives), each line carrying `text-fg-tertiary`; the column's `accessibilityLabel` is
    `Public, 5 USDC, 2 NOC, +1 more, not updated`. The private column's lines do not carry `text-fg-tertiary`.
  - **D9** Private mode: `mockMode.current = 'shielded'` → no `dashboard-stale-line` (the hero is the private
    balance), and the public split column is still dimmed with `, not updated` in its label.
  - **D10** a non-main account: `mockSelected.current = EXIT_ACCOUNT` with the same stale data → D1 and D2 hold.
  - **D11** the age ticks (R16): `jest.useFakeTimers({now: NOW})` (the fake clock replaces `Date`, so it — not the
    describe's `Date.now` spy — is the time here), render stale, then
    `await act(async () => { jest.advanceTimersByTime(60_000); })` → the line reads
    `Not updated · 6 min ago · pull to refresh`. `jest.useRealTimers()` in a `finally`. (The dashboard's own 60 s
    poll fires in that minute too; `forceSync` is mocked.)
  - **D12 — pin (passes before the change)** the alert on a partial sync (Task 1's intended change; the alert
    code itself is not edited in this task): with `READY_MAIN`, mock
    `forceSync` once to resolve `{success: false, partial: true, error: 'tokens: timeout', timestamp: 1}`, spy on
    `Alert.alert`, trigger the `RefreshControl`'s `onRefresh` as the existing pull-to-refresh tests in this file do,
    and assert one alert whose message contains `tokens: timeout`.
  - **Replace** Task 2's holding test (`'…a stale status never reads "No tokens yet"'`) with D5; delete it.

  Coverage rows (spec §7), in the transparent-mode describe:
  - **K1** `'<0.0001' on the token row and the sub-balance`: `mockPublic.current = {...READY_MAIN, solBalance: '10',
    tokens: [{mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}], tokenBalances:
    {USDCMINT: '10'}}` → `dashboard-sub-sol` reads `<0.0001`; `getByText('<0.0001 USDC')` exists; no text matches
    `/e-\d/`.
  - **K2** `a split-column tap fires first-private onboarding`: with `mmkvPublic.remove(MMKV_KEYS.SHIELDED_EXPLAINED)`
    (import `mmkvPublic` from `'../../../store/mmkv/instances'` — the mock keeps the real one — and `MMKV_KEYS`),
    render with `onFirstShieldedToggle = jest.fn()`, press `dashboard-split-private` → the callback ran once and
    `mockSetMode` was not called. Then `mmkvPublic.set(MMKV_KEYS.SHIELDED_EXPLAINED, true)`, render again, press →
    `mockSetMode` called with `'shielded'`, the callback not called again. Remove the key in a `finally`.

- [ ] **Step 2: Run them.** `npx jest src/screens/dashboard/__tests__/DashboardScreen.test.tsx --forceExit`
      Expected: FAIL — no `dashboard-stale-line`; a stale status renders "—". (K1, K2 and D12 are pins: they pass
      before the change, because they cover behaviour that already exists. Say so in the task report; do not weaken
      them, and do not count them as evidence for this task's change.)

- [ ] **Step 3: Implement the dashboard.**

At `:166-168`:

```ts
  const {data: publicData, refetch: refetchPublic} = useAccountPublicData(selected);
  // post-M1d §3.2: "known" = a figure exists to draw (current or stale); a stale one is drawn dimmed
  const publicKnown = publicData.status === 'ready' || publicData.status === 'stale';
  const {solBalance, nocBalance, tokens, tokenBalances} =
    publicData.status === 'ready' || publicData.status === 'stale' ? publicData : NO_PUBLIC_DATA;
  // R16: the age is recomputed on every render, and a tick re-renders every 60 s while the screen is focused
  const staleText = publicData.status === 'stale' ? staleLine(relativeAge(publicData.syncedAt, Date.now())) : null;
  const isStale = staleText !== null;
  const [, setAgeTick] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (!isStale) {
        return undefined;
      }
      const id = setInterval(() => setAgeTick(t => t + 1), 60_000);
      return () => clearInterval(id);
    }, [isStale]),
  );
```

Then rename every remaining `publicReady` in the component and in `DashboardHeader` to `publicKnown` (grep; the
prop's doc comment becomes "a public figure exists to draw — current or stale"), and:
- `:395` → `const change24h = publicData.status === 'ready' ? portfolio.change24hPct : null; // hidden while stale: it describes a live price movement`
- pass `staleText={staleText}` to `DashboardHeader`; add `staleText: string | null;` to `DashboardHeaderProps` with
  the comment `/** post-M1d §3.2: "Not updated · {age} · pull to refresh", or null when the public figure is current */`;
- `renderItem`: pass `stale={isStale}` to `TokenListRow`.

In `DashboardHeader`:
- hero (`:716-721`): `className={staleText !== null ? 'text-fg-tertiary' : 'text-fg-primary'}` on the whole part and
  `className={cn('ml-0.5', staleText !== null ? 'text-fg-tertiary' : 'text-fg-secondary')}` on the cents;
- directly after the whole "Change / anonymity line" block (`:729-761`), before the sub-balance block:

```tsx
          {/* post-M1d §3.2: the stale line — Public mode only; it stays when balances are hidden (no figure in it) */}
          {!isShielded && staleText !== null ? (
            <Text variant="body-sm" className="text-fg-secondary mb-3" testID="dashboard-stale-line">
              {staleText}
            </Text>
          ) : null}
```

- sub-balances: pass `dim={staleText !== null}` to both `SubBalanceCell`s;
- the public `SplitColumn`: pass `stale={staleText !== null}`.

`SplitColumn`: add `stale?: boolean` to its props; the label becomes
`accessibilityLabel={splitA11y(label, lines.join(', '), isActive, stale === true)}` and each line's class
`className={stale ? 'text-fg-tertiary' : 'text-fg-secondary'}`.

`SubBalanceCell`: add `dim?: boolean`; the amount's class becomes

```tsx
        className={cn('font-geist-semibold', hidden ? 'text-fg-secondary' : dim ? 'text-fg-tertiary' : 'text-fg-primary')}>
```

`TokenListRow`: add `stale: boolean` to its props;
- the balance `Text`: `className={hidden || stale ? 'text-fg-tertiary' : 'text-fg-secondary'}`;
- the USD `Text`: `className={stale ? 'text-fg-tertiary' : 'text-fg-primary'}`;
- wrap the whole `change24h == null ? … : …` expression in `{stale ? null : ( … )}` (R16).

Imports: add `relativeAge`, `staleLine` to the `../../copy/accounts` import. Update the header doc comment
(`:84-98`): under "Balance hero" add "a stale figure (post-M1d §3.2) is dimmed, with one line under it".

- [ ] **Step 4: Run them.** The Step 2 command. Expected: PASS, and every pre-existing test in the file still passes.

- [ ] **Step 5: Write the failing sheet tests.** In `AccountsSheet.test.tsx` (the `beforeEach`
      `useWalletStore.setState` gains `lastSyncFailedAt: null`):

  - **S1** a stale other row: `mockRows.current = {[A3]: {state: 'stale', data: {solBalance: '500000000',
    nocBalance: '0', tokenBalances: {}, tokens: []}, at: 1}}` → `accounts-row-slip10:3-balance` reads
    `0.5 SOL · not updated`, with `className` containing `text-fg-tertiary`.
  - **S2** "Balance unavailable" only when nothing was read: `{[A3]: {state: 'failed'}}` → `Balance unavailable`,
    not dimmed (no `text-fg-tertiary`).
  - **S3 (R10)** the main row uses the same rule: `useWalletStore.setState({solBalance: '2000000000',
    lastSyncedAt: 5, lastSyncFailedAt: 9})` → `accounts-row-slip10:0-balance` reads `2 SOL · not updated`, dimmed.
    Control: `lastSyncFailedAt: null` → `2 SOL`, not dimmed.
  - **S3b (review r1-1)** the main row, never read: `useWalletStore.setState({solBalance: '0', lastSyncedAt: null,
    lastSyncFailedAt: 9})` → `Balance unavailable` (never `0 SOL`, never `not checked yet`: a sync was tried and
    failed). Control: `lastSyncedAt: null, lastSyncFailedAt: null` → `not checked yet` (today's
    `'review M11 … no sync yet → not checked yet'` test stays as it is).
  - **S4 (Review Focus 1)** hidden wins: S1's data with `hidden: true` → the row reads `••• · not updated`; the row's
    `accessibilityLabel` contains `not updated` and matches no `/\d\.\d|SOL/` after the address part (assert
    `label.endsWith('••• · not updated')`).
  - **S5** a11y: S1 (not hidden) → the row's `accessibilityLabel` ends with `0.5 SOL · not updated`.

- [ ] **Step 6: Run them.** `npx jest src/components/accounts --forceExit`. Expected: FAIL — `Balance unavailable`.

- [ ] **Step 7: Implement the sheet.**

`rowBalanceText` — replace Task 2's holding line:

```ts
  if (row.state === 'failed') {
    return ROW_UNAVAILABLE;
  }
  // 'ready' and 'stale' carry a figure; the caller dims a stale one and adds " · not updated" (post-M1d §3.2)
  return formatSide(publicSide({status: 'ready', ...row.data, syncedAt: row.at}), prices, ' · ');
```

In the component: read `const lastSyncFailedAt = useWalletStore(s => s.lastSyncFailedAt);`, and the main row becomes

```ts
        if (mainBalanceIsUnknown(lastSyncedAt, lastSyncFailedAt)) {
          out[a.address] = {state: 'failed'}; // review r1-1: a sync was tried, nothing was ever read → "Balance unavailable"
        } else if (!lastSyncedAt) {
          out[a.address] = {state: 'not-checked'};
        } else {
          const data = withPoolToken({solBalance, nocBalance, tokenBalances, tokens});
          // R10: the main row reads walletStore, so it applies the main account's stale rule itself
          out[a.address] = mainBalanceIsStale(lastSyncedAt, lastSyncFailedAt)
            ? {state: 'stale', data, at: lastSyncedAt}
            : {state: 'ready', data, at: lastSyncedAt};
        }
```

(add `lastSyncFailedAt` to the `useMemo` deps). In the row:

```tsx
                const row = rows[a.address];
                const stale = row?.state === 'stale';
                const figure = hidden ? VALUE_HIDDEN : rowBalanceText(row, havePrices ? prices : null);
                // hidden wins over stale: "•••", and the suffix still says the figure is not current
                const balanceText = stale ? staleRow(figure) : figure;
```

and the balance `Text`'s class: `className={cn('mt-0.5', stale ? 'text-fg-tertiary' : 'text-fg-secondary')}`.
Imports: `staleRow` from the copy, `mainBalanceIsStale` and `mainBalanceIsUnknown` from
`'../../modules/accounts/staleness'`.

- [ ] **Step 8: Run them.** The Step 6 command. Expected: PASS.

- [ ] **Step 9: Write the failing TokenDetail tests.** In `TokenDetailScreen.test.tsx`, in the
      `'M1d — the holding is the selected account's'` describe (use that describe's existing way of setting the
      hook's data):

  - **TD1 (R10)** stale: data `{status: 'stale', syncedAt: NOW - 2 * 3_600_000, failedAt: NOW, solBalance:
    '1500000000', nocBalance: '0', tokenBalances: {}, tokens: []}` with `Date.now` spied to `NOW`, `mint="native"` →
    `getByText('1.5 SOL')` has `className` containing `text-fg-tertiary`; `getByTestId('token-detail-stale')` reads
    `Not updated · 2 h ago`.
  - **TD2** control: `status: 'ready'` → no `token-detail-stale`; `1.5 SOL` does not carry `text-fg-tertiary`.
  - **TD3 (§7 coverage) — pin (passes before the change)** `'<0.0001'`: ready, `solBalance: '10'` →
    `getByText('<0.0001 SOL')`; no text matches `/e-\d/`.
  - **TD4 (review r1-7, R16)** the age ticks here too, as code:

```ts
  it('review r1-7 / R16: the stale age is recomputed every 60 s while the screen is mounted', async () => {
    const NOW = 1_800_000_000_000;
    jest.useFakeTimers({now: NOW}); // the fake clock is Date here
    try {
      mockTdPublic.current = {status: 'stale', syncedAt: NOW - 59 * 60_000, failedAt: NOW, solBalance: '1500000000', nocBalance: '0', tokenBalances: {}, tokens: []};
      const r = screen();
      expect(r.getByTestId('token-detail-stale')).toHaveTextContent('Not updated · 59 min ago');
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(r.getByTestId('token-detail-stale')).toHaveTextContent('Not updated · 1 h ago');
      r.unmount();
      expect(jest.getTimerCount()).toBe(0); // the interval is cleared with the screen
    } finally {
      jest.useRealTimers();
    }
  });

  it('review r1-7: no timer runs for a figure that is current', () => {
    jest.useFakeTimers();
    try {
      screen(); // the describe's default data is 'ready'
      expect(jest.getTimerCount()).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
```

    (import `act` from `@testing-library/react-native` in that file.) If the screen turns out to own another
    timer, so that the ready control is not 0, assert the difference instead — the stale render has exactly one
    timer more than the ready one — and say so in the report.
  - **TD5 (review r1-1)** a never-read main whose sync failed: `mockTdPublic.current = {status: 'error'}` →
    `getByText('— SOL')`, `queryByText('0 SOL')` null, no `token-detail-stale`. Pin (passes before the change).
    The `loading` state of a never-read main is already pinned by this describe's existing
    `'Review Focus 4: not loaded → "— SOL", never 0'` (its selected account is the main one): leave it, and add
    to it `expect(r.queryByText(/\$0\.00/)).toBeNull();`.

- [ ] **Step 10: Run, implement, run.** `npx jest src/screens/transparent/__tests__/TokenDetailScreen.test.tsx --forceExit`
      → FAIL. Then in `TokenDetailScreen.tsx`:

```ts
  const {data: publicData} = useAccountPublicData(useSelectedAccount());
  // post-M1d R10: a stale holding is drawn (dimmed, with its age) — "known" = a figure exists
  const publicKnown = publicData.status === 'ready' || publicData.status === 'stale';
  const {solBalance, nocBalance, tokenBalances, tokens} =
    publicData.status === 'ready' || publicData.status === 'stale' ? publicData : NO_PUBLIC_DATA;
  const staleText = publicData.status === 'stale' ? staleNote(relativeAge(publicData.syncedAt, Date.now())) : null;
  // review r1-7 / R16: the age is recomputed on every render, and a tick re-renders every 60 s while the figure is
  // stale. A plain effect, not useFocusEffect: this screen is a modal (mounted = shown) and its tests render it
  // without a navigator.
  const isStale = staleText !== null;
  const [, setAgeTick] = React.useState(0);
  React.useEffect(() => {
    if (!isStale) {
      return undefined;
    }
    const id = setInterval(() => setAgeTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isStale]);
```

  Rename the remaining `publicReady` uses (`:237`, `:240`) to `publicKnown`. In the holdings card, the three figure
  `Text`s (`:236`, `:239`, `:245`) take `text-fg-tertiary` when `staleText !== null` (else their current class), and
  after the `flex-row` block (before the card's closing `</View>` at `:251`):

```tsx
          {staleText !== null ? (
            <Text variant="caption" className="text-fg-secondary mt-2" testID="token-detail-stale">
              {staleText}
            </Text>
          ) : null}
```

  Import `relativeAge`, `staleNote` from `'../../copy/accounts'`. Run again → PASS.

- [ ] **Step 11: Gates.** `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`.

- [ ] **Step 12: Commit.**

```bash
git add src/modules/accounts/valueLine.ts src/modules/accounts/__tests__/valueLine.test.ts \
  src/screens/dashboard src/components/accounts src/screens/transparent/TokenDetailScreen.tsx \
  src/screens/transparent/__tests__/TokenDetailScreen.test.tsx
git commit -m "feat(stale): the dashboard, the Accounts sheet and the token detail show a stale balance dimmed, with its age"
```

---

### Task 4: #12 refuses a stale balance; the main account's retry really re-reads

Spec: §3.2 (#12), R4, §7 first bullet.

**Files:**
- Modify: `src/screens/transparent/SendScreen.tsx:26-42` (imports), `:137-151` (retry), `:615-637` (the row)
- Test: `src/screens/transparent/__tests__/SendScreen.test.tsx`
- Create: `src/screens/transparent/__tests__/SendScreen.mainNeverRead.test.tsx` (the real hook and store, review r1-1)

**Interfaces:**
- Consumes (Task 1): `forceSync(): Promise<SyncResult>` with `success: boolean`. (Task 2): `AccountPublicData`
  `'stale'`, `SEND_BALANCE_STALE`, and the hook returning `error` for a never-read main whose sync failed.
- Produces: no new exports. `send-balance-retry` is now also rendered for `status === 'stale'`.

**What must stay true (do not "fix"):** `publicReady` in this file stays `publicData.status === 'ready'`. A stale
balance is destructured as `NO_PUBLIC_DATA`, so the CTA, MAX and the insufficiency check stay disabled exactly as for
`error` today (`:229`, `:318`, `:346`). A send is never judged against a figure that may be wrong.

- [ ] **Step 1: Write the failing tests.** In `SendScreen.test.tsx`, add the module mock next to the other mocks:

```ts
// post-M1d R4: the main account's "tap to retry" runs the main sync (refetch is a no-op for main)
const mockForceSync = jest.fn(() => Promise.resolve({success: true, partial: false, timestamp: 1}));
jest.mock('../../../modules/backgroundSync/backgroundSyncModule', () => ({forceSync: () => mockForceSync()}));
```

and, in the `'M1d — #12 sends from the account selected when it opened'` describe:

```ts
  const STALE_1_SOL = {status: 'stale', syncedAt: 1, failedAt: 2, solBalance: '1000000000', nocBalance: '0', tokens: [], tokenBalances: {}};

  it('post-M1d §3.2: a stale balance is not usable — "Not updated · tap to retry", no figure, CTA / MAX / "short by" off', () => {
    mockSendPublic.current = STALE_1_SOL;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.queryByTestId('send-available')).toBeNull(); // the stale 1 SOL is never offered as Available
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Not updated · tap to retry');
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
    expect(r.getByTestId('max-button').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(r.getByTestId('max-button'));
    expect(r.getByTestId('amount-input').props.value).toBe('0.001'); // MAX filled nothing
    fireEvent.changeText(r.getByTestId('amount-input'), '5'); // more than the stale 1 SOL
    expect(r.queryByText(/Insufficient balance/)).toBeNull(); // never judged against a stale figure
  });

  it('positive control: the same figure as READY is usable', () => {
    mockSendPublic.current = READY_1_SOL;
    const r = render(<SendScreen onReview={jest.fn()} />);
    fill(r);
    expect(r.getByTestId('send-available')).toHaveTextContent('1 SOL');
    expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
  });

  it('R4: main + stale → the tap runs forceSync once (never the no-op refetch); a double tap reads once', async () => {
    mockSendSelected.current = MAIN_SRC;
    mockSendPublic.current = STALE_1_SOL;
    mockSendRefetch.mockClear();
    mockForceSync.mockClear();
    let release: (v: {success: boolean; partial: boolean; timestamp: number}) => void = () => undefined;
    mockForceSync.mockImplementationOnce(() => new Promise(res => (release = res)));
    const r = render(<SendScreen onReview={jest.fn()} />);
    await act(async () => {
      fireEvent.press(r.getByTestId('send-balance-retry'));
      fireEvent.press(r.getByTestId('send-balance-retry'));
    });
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    expect(mockSendRefetch).not.toHaveBeenCalled();
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Checking balance…');
    await act(async () => {
      release({success: false, partial: true, timestamp: 2});
    });
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Not updated · tap to retry');
  });

  it('another account + stale → the tap re-reads that account (refetch), not the main sync', async () => {
    mockSendSelected.current = A3_SRC;
    mockSendPublic.current = STALE_1_SOL;
    mockSendRefetch.mockClear();
    mockForceSync.mockClear();
    const r = render(<SendScreen onReview={jest.fn()} />);
    await act(async () => {
      fireEvent.press(r.getByTestId('send-balance-retry'));
    });
    expect(mockSendRefetch).toHaveBeenCalledTimes(1);
    expect(mockForceSync).not.toHaveBeenCalled();
  });

  it('a rejected forceSync frees the retry (never stuck on "Checking balance…")', async () => {
    mockSendSelected.current = MAIN_SRC;
    mockSendPublic.current = STALE_1_SOL;
    mockForceSync.mockImplementationOnce(() => Promise.reject(new Error('boom')));
    const r = render(<SendScreen onReview={jest.fn()} />);
    await act(async () => {
      fireEvent.press(r.getByTestId('send-balance-retry'));
    });
    expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Not updated · tap to retry');
  });

  // UNTESTED INVARIANT (race unconstructible): the generation guard itself has no test that can make it bite — the
  // source moves only null → account. This row pins the condition that makes it safe, not the guard.
  it('final review m2: no retry can start while the source is unknown (the guard is keyed on the source)', () => {
    mockSendSelected.current = null;
    mockSendPublic.current = {status: 'loading'};
    const r = render(<SendScreen onReview={jest.fn()} />);
    expect(r.queryByTestId('send-balance-retry')).toBeNull();
  });
```

  **The never-read main account, through the REAL hook (review r1-1).** The suite above mocks
  `useAccountPublicData`, so it cannot show that a never-read main reaches #12 as `error`. Create
  `src/screens/transparent/__tests__/SendScreen.mainNeverRead.test.tsx` — the hook and `walletStore` are real here:

```tsx
/**
 * post-M1d §3.1 (review r1-1): a main account that was NEVER read and whose sync failed has no figure.
 * This suite does NOT mock useAccountPublicData or walletStore: the state is the store's real one, read
 * through the real hook. (SendScreen.test.tsx mocks the hook and so cannot prove this path.)
 */
import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useWalletStore} from '../../../store/zustand/walletStore';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({navigate: jest.fn(), goBack: jest.fn()}),
  useRoute: () => ({params: {}}),
}));
jest.mock('../../../modules/solana/simulation', () => ({simulateTransaction: jest.fn().mockResolvedValue({success: true})}));
jest.mock('../../../modules/solana/connection', () => ({getConnection: jest.fn(() => ({}))}));
jest.mock('../../../modules/solana/transactionBuilder', () => ({
  buildTransferTx: jest.fn().mockResolvedValue({}),
  getTransferMarkupLamports: jest.requireActual('../../../modules/solana/transactionBuilder').getTransferMarkupLamports,
}));

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const mockMainSrc = {scheme: 'slip10:0', address: MAIN, label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false};
const mockRefresh = jest.fn();
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockMainSrc,
  useAccountList: () => null,
  useRefreshAccounts: () => mockRefresh,
}));
const mockForceSync = jest.fn(() => Promise.resolve({success: false, partial: false, timestamp: 1}));
jest.mock('../../../modules/backgroundSync/backgroundSyncModule', () => ({forceSync: () => mockForceSync()}));

import {SendScreen} from '../SendScreen';

const screen = () => {
  const qc = new QueryClient({defaultOptions: {queries: {retry: false}}});
  const r = render(
    <QueryClientProvider client={qc}>
      <SendScreen onReview={jest.fn()} />
    </QueryClientProvider>,
  );
  fireEvent.changeText(r.getByTestId('recipient-input'), FOREIGN);
  fireEvent.changeText(r.getByTestId('amount-input'), '0.001');
  return r;
};

beforeEach(() => {
  mockForceSync.mockClear();
  // a fresh import: the store's defaults, and the first sync of this session failed
  useWalletStore.setState({publicKey: MAIN, solBalance: '0', nocBalance: '0', tokenBalances: {}, tokens: [], lastSyncedAt: null, lastSyncFailedAt: 5});
});

it('never read + the sync failed → no "Available 0 SOL": the retry row, CTA / MAX off, nothing judged against 0', () => {
  const r = screen();
  expect(r.queryByTestId('send-available')).toBeNull();
  expect(r.queryByText(/Available/)).toBeNull();
  expect(r.getByTestId('send-balance-retry')).toHaveTextContent('Balance unavailable · tap to retry');
  expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  expect(r.getByTestId('max-button').props.accessibilityState?.disabled).toBe(true);
  expect(r.queryByText(/Insufficient balance/)).toBeNull(); // 0.001 SOL is NOT "more than the balance": there is none
});

it('R4: the tap on that row runs the main sync once (never the no-op refetch)', async () => {
  const r = screen();
  await act(async () => {
    fireEvent.press(r.getByTestId('send-balance-retry'));
  });
  expect(mockForceSync).toHaveBeenCalledTimes(1);
});

// controller ruling 2026-11-22: never read and no failed sync yet → 'loading', the non-main branch exactly
it('never read, no sync failed yet → "Available — SOL": no figure, no retry row, CTA / MAX off', () => {
  useWalletStore.setState({lastSyncFailedAt: null});
  const r = screen();
  expect(r.getByTestId('send-available')).toHaveTextContent('— SOL');
  expect(r.queryByText(/Available\s*0/)).toBeNull();
  expect(r.queryByTestId('send-balance-retry')).toBeNull();
  expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(true);
  expect(r.getByTestId('max-button').props.accessibilityState?.disabled).toBe(true);
  expect(r.queryByText(/Insufficient balance/)).toBeNull();
});

it('positive control: the same store after one good sync → "Available 1 SOL" and a usable CTA', () => {
  expect(useWalletStore.getState().lastSyncedAt).toBeNull(); // the arranged state really is "never read"
  const r = screen();
  act(() => {
    useWalletStore.getState().updateBalances('1000000000', '0', {});
  });
  expect(r.queryByTestId('send-balance-retry')).toBeNull();
  expect(r.getByTestId('send-available')).toHaveTextContent('1 SOL');
  expect(r.getByTestId('review-button').props.accessibilityState?.disabled).toBe(false);
});

```

  Run it once now: the first two tests pass only because Task 2 made the hook return `error` for this state and
  this task wires the row to `forceSync`. Prove the first is a check: temporarily make
  `mainBalanceIsUnknown` return `false`, see `'never read + the sync failed…'` fail on `Available`, and revert.
  Report the result. (Add this file to Step 2's run and to the commit.)

  The existing `'owner 2A (2026-11-22): a failed read of the source…'` test uses `MAIN_SRC` (the describe's
  `beforeEach`) and asserts `mockSendRefetch` calls. **Change** it to select `A3_SRC` at its top
  (`mockSendSelected.current = A3_SRC;`), comment
  `// post-M1d R4: the refetch path is the non-main one — main retries through forceSync (its own row below)`.

- [ ] **Step 2: Run them.** `npx jest src/screens/transparent/__tests__/SendScreen --forceExit` (both files)
      Expected: FAIL — a stale status renders "Available — SOL"; `forceSync` is never called (in the real-hook file
      the retry row is there since Task 2, but its tap calls the no-op refetch).

- [ ] **Step 3: Implement.** Replace `SendScreen.tsx:139-151`:

```ts
  // owner 2A (2026-11-22): a failed read shows "tap to retry", never a figure; one read in flight at a time
  // (review 2A m2: the row says "Checking balance…" while it runs, so a tap is never silent).
  // post-M1d R4: the MAIN account's figures are walletStore's — its retry is the main sync (refetch is a
  // no-op for main). post-M1d §7 (final review m2): the in-flight flag belongs to ONE source account — a
  // read started for one source can neither block nor later reset another's (as History's m5). The source
  // moves only null → account and no retry row exists while it is null, so today the guard cannot bite;
  // it is kept so a future source change cannot inherit a stale flag.
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const generationRef = useRef(0);
  const sourceAddress = source?.address ?? null;
  useEffect(() => {
    generationRef.current += 1;
    retryingRef.current = false;
    setRetrying(false);
  }, [sourceAddress]);
  const refetchPublicRef = useRef(refetchPublic);
  refetchPublicRef.current = refetchPublic;
  const sourceIsMain = source?.isMain ?? null;
  const retryPublic = useCallback(() => {
    if (retryingRef.current || sourceIsMain === null) return;
    retryingRef.current = true;
    setRetrying(true);
    const generation = generationRef.current;
    const read: Promise<boolean> = sourceIsMain
      ? forceSync().then(
          r => r.success,
          () => false,
        )
      : refetchPublicRef.current();
    read
      .catch(() => false)
      .finally(() => {
        if (generation !== generationRef.current) return;
        retryingRef.current = false;
        setRetrying(false);
      });
  }, [sourceIsMain]);
```

  Import `forceSync` from `'../../modules/backgroundSync/backgroundSyncModule'` and `SEND_BALANCE_STALE` from the
  copy. The row at `:615-627`:

```tsx
              {publicData.status === 'error' || publicData.status === 'stale' ? (
                <Pressable
                  onPress={retryPublic}
                  disabled={retrying}
                  accessibilityRole="button"
                  accessibilityState={{disabled: retrying, busy: retrying}}
                  testID="send-balance-retry"
                  className="flex-row items-center mt-2"
                  hitSlop={8}>
                  <Text variant="body-sm" className="text-fg-secondary">
                    {retrying
                      ? SEND_BALANCE_CHECKING
                      : publicData.status === 'stale'
                        ? SEND_BALANCE_STALE // post-M1d §3.2: a stale figure is not usable for sending
                        : SEND_BALANCE_RETRY}
                  </Text>
                </Pressable>
              ) : (
```

- [ ] **Step 4: Run them.** The Step 2 command. Expected: PASS. Then the `mainBalanceIsUnknown` mutation described
      in Step 1 (fails, reverted).

- [ ] **Step 5: Gates.** `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`.
      If `lint:ci` reports a new `react-hooks/exhaustive-deps` warning, fix the dependency list; do not add a
      disable comment (the count must not rise above 143).

- [ ] **Step 6: Commit.**

```bash
git add src/screens/transparent/SendScreen.tsx src/screens/transparent/__tests__/SendScreen.test.tsx \
  src/screens/transparent/__tests__/SendScreen.mainNeverRead.test.tsx
git commit -m "fix(send): #12 refuses a stale balance, and the main account's retry runs the main sync"
```

---

### Task 5: One row per token; wrapped SOL is its own row, priced as SOL, counted once

Spec: §6, R6, R7, r2-4, Review Focus 5; §7 coverage (TokenPicker, presale allocation).

**Files:**
- Modify: `src/modules/tokens/tokenModule.ts:153-188` (`buildDisplayTokens`)
- Modify: `src/modules/tokens/coreTokens.ts:13`
- Modify: `src/modules/prices/portfolio.ts:1-48`
- Modify: `src/components/TokenLogo.tsx:19`
- Modify: `src/store/zustand/walletStore.ts` (the `merge` Task 1 added — persisted core-token labels, review r1-6)
- Modify: `src/screens/dashboard/DashboardScreen.tsx:327-352` (`displayTokens`), `:451` (`isNativeSol`)
- Modify: `src/screens/transparent/TokenDetailScreen.tsx:74` (price), `:104` (chart id)
- Test: `src/store/zustand/__tests__/walletStore.test.ts`, `src/modules/tokens/__tests__/tokenModule.test.ts`,
  `src/modules/prices/__tests__/portfolio.test.ts`,
  `src/modules/prices/__tests__/holdings.test.ts`, `src/modules/accounts/__tests__/accountSnapshot.test.ts`,
  `src/components/__tests__/TokenLogo.test.tsx`, `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`,
  `src/screens/transparent/__tests__/TokenDetailScreen.test.tsx`,
  `src/components/__tests__/TokenPickerSheet.test.tsx`, `src/modules/presale/__tests__/presaleAllocation.test.ts`

**Interfaces:**
- Consumes (Task 1): walletStore's `merge` persist option (this task extends it). Otherwise nothing; it follows
  Task 3 because it edits the same two screens.
- Produces:

```ts
// src/modules/prices/portfolio.ts
/** The key a mint's price is stored under: wrapped SOL is priced as SOL ('native'); every other mint under itself. */
export function priceKeyFor(mint: string): string;
```

```ts
// src/store/zustand/walletStore.ts
/** A persisted token list relabelled from CORE_TOKENS: a core mint always carries its registry symbol and name. */
export function relabelCoreTokens(tokens: readonly TokenMetadata[]): TokenMetadata[];
```

  `buildDisplayTokens` returns at most one entry per mint. `CORE_TOKENS`' wSOL entry is
  `{symbol: 'wSOL', name: 'Wrapped SOL'}`. `buildHoldings` is **unchanged** (R6: `tokenBalances` is already summed
  per mint; summing again there would double the figure).

**Read the code first:** today `DashboardScreen.tsx:329` treats a wSOL display row as "SOL is present" (so the
native row is not added) and `:451` gives that row the native balance. A wallet that holds wSOL therefore shows one
"SOL" row with the native amount and no wSOL at all. After this task: the native row is always there (mint
`'native'`), and the wSOL row shows its own amount.

**Persisted rows (review r1-6).** `walletStore.tokens` is persisted (`partialize` keeps it), so a device that held
wSOL before this change has `{mint: So111…112, symbol: 'SOL', name: 'Solana'}` on disk. Until the next fully
successful sync rewrites the list (`setTokens`), that row would render as a second "SOL" — and after Task 1 a failed
sync no longer rewrites it. The store has **no persist `version` and no `migrate`** (checked:
`walletStore.ts:60-72` passes only `name`, `storage`, `partialize`, plus Task 1's `merge`), so there is no migration
to bump; adding a version now would run `migrate` against every existing record for one label. The rewrite goes in
`merge`, which is the rehydration path and already exists since Task 1: the labels are corrected before any screen
reads the store, with no second write. (`onRehydrateStorage` would correct them one render later, through a `set`.)

- [ ] **Step 1: Write the failing module tests.**

`src/store/zustand/__tests__/walletStore.test.ts` (the file Task 1 created):

```ts
describe('post-M1d R7 / review r1-6: a persisted core token is relabelled on rehydration', () => {
  const WSOL = 'So11111111111111111111111111111111111111112';
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

  it('a wSOL row stored as "SOL" / "Solana" comes back as "wSOL" / "Wrapped SOL"; nothing else changes', async () => {
    const stored = [
      {mint: WSOL, symbol: 'SOL', name: 'Solana', decimals: 9, trust: 'core'},
      {mint: USDC, symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'},
      {mint: 'VerifiedMint', symbol: 'SOL', name: 'Not ours to rename', decimals: 9, trust: 'verified', logoUri: 'https://cdn/x'},
    ];
    mmkvPublic.set(NAME, JSON.stringify({state: {publicKey: 'P', tokens: stored, tokenBalances: {[WSOL]: '5'}}, version: 0}));
    await useWalletStore.persist.rehydrate();
    const tokens = useWalletStore.getState().tokens;
    expect(tokens[0]).toEqual({mint: WSOL, symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, trust: 'core'});
    expect(tokens[1]).toEqual(stored[1]);
    expect(tokens[2]).toEqual(stored[2]); // a non-core mint keeps whatever it carries: only the registry is authoritative
    expect(useWalletStore.getState().tokenBalances).toEqual({[WSOL]: '5'}); // the amounts are not touched
  });

  it('a record with no tokens, or a malformed tokens value, rehydrates without throwing', async () => {
    mmkvPublic.set(NAME, JSON.stringify({state: {publicKey: 'P'}, version: 0}));
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().tokens).toEqual([]);
    mmkvPublic.set(NAME, JSON.stringify({state: {publicKey: 'P', tokens: 'nope'}, version: 0}));
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().tokens).toEqual([]);
  });

  it('Task 1 still holds through the extended merge: lastSyncFailedAt is null after rehydration', async () => {
    mmkvPublic.set(NAME, JSON.stringify({state: {publicKey: 'P', lastSyncedAt: 5, lastSyncFailedAt: 9}, version: 0}));
    await useWalletStore.persist.rehydrate();
    expect(useWalletStore.getState().lastSyncFailedAt).toBeNull();
  });
});
```

`tokenModule.test.ts`, in `describe('buildDisplayTokens')`:

```ts
  // T1 (Review Focus 5)
  it('R6: one entry per mint — a mint held in two token accounts lists once', () => {
    const result = tm.buildDisplayTokens([acct(USDC_MINT, '1000000', 6), acct(USDC_MINT, '2500000', 6)]);
    expect(result.map(t => t.mint)).toEqual([USDC_MINT]);
  });

  // T2 (Review Focus 5)
  it('R6: an empty account before a funded one of the same mint → one entry; two empty ones → none', () => {
    expect(tm.buildDisplayTokens([acct(USDC_MINT, '0', 6), acct(USDC_MINT, '5', 6)]).map(t => t.mint)).toEqual([USDC_MINT]);
    expect(tm.buildDisplayTokens([acct(USDC_MINT, '0', 6), acct(USDC_MINT, '0', 6)])).toEqual([]);
  });

  it('R7: wrapped SOL is "Wrapped SOL" / "wSOL", never "SOL"', () => {
    const WSOL = 'So11111111111111111111111111111111111111112';
    expect(tm.buildDisplayTokens([acct(WSOL, '5', 9)])).toEqual([
      {mint: WSOL, symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, logoUri: undefined, trust: 'core'},
    ]);
  });
```

`portfolio.test.ts`:

```ts
import {priceKeyFor} from '../portfolio';
const WSOL = 'So11111111111111111111111111111111111111112';

describe('r2-4: wrapped SOL is priced as SOL', () => {
  it('priceKeyFor: wSOL → native; everything else → itself', () => {
    expect(priceKeyFor(WSOL)).toBe('native');
    expect(priceKeyFor('native')).toBe('native');
    expect(priceKeyFor('USDC')).toBe('USDC');
  });

  it('a wSOL holding gets USD and 24h % from the SOL price, under its own mint', () => {
    const r = computePortfolio([{mint: WSOL, amountRaw: '500000000', decimals: 9}], prices);
    expect(r.perToken[WSOL]).toEqual({usd: 50, change24h: 2});
    expect(r.totalUsd).toBeCloseTo(50, 6);
  });

  // W3 (Review Focus 5)
  it('R7: native SOL + wSOL — each its own row, the total counts each once', () => {
    const r = computePortfolio(
      [
        {mint: 'native', amountRaw: '1000000000', decimals: 9},
        {mint: WSOL, amountRaw: '500000000', decimals: 9},
      ],
      prices,
    );
    expect(r.perToken.native!.usd).toBeCloseTo(100, 6);
    expect(r.perToken[WSOL]!.usd).toBeCloseTo(50, 6);
    expect(r.totalUsd).toBeCloseTo(150, 6); // not 200 (wSOL twice), not 100 (wSOL dropped)
  });
});
```

`holdings.test.ts` (pins R6's "unchanged"):

```ts
  it('R6: a mint already summed in tokenBalances is one holding with that sum (no second summing here)', () => {
    const h = buildHoldings({
      solBalance: '1',
      nocBalance: '0',
      tokenBalances: {USDCMINT: '3500000'},
      tokens: [{mint: 'USDCMINT', symbol: 'USDC', name: 'USD Coin', decimals: 6, trust: 'core'}],
    });
    expect(h.filter(x => x.mint === 'USDCMINT')).toEqual([{mint: 'USDCMINT', amountRaw: '3500000', decimals: 6}]);
  });

  it('R7: wSOL is its own holding next to native SOL', () => {
    const WSOL = 'So11111111111111111111111111111111111111112';
    const h = buildHoldings({
      solBalance: '1000000000',
      nocBalance: '0',
      tokenBalances: {[WSOL]: '500000000'},
      tokens: [{mint: WSOL, symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, trust: 'core'}],
    });
    expect(h.find(x => x.mint === 'native')!.amountRaw).toBe('1000000000');
    expect(h.find(x => x.mint === WSOL)!.amountRaw).toBe('500000000');
  });
```

`accountSnapshot.test.ts`: in `'reads the named address; sums a mint across token accounts…'` the last assertion
only checks the *set* of mints because the duplicate was "parked". That suite mocks `buildDisplayTokens`
(`:13`), so it cannot prove the dedupe; **update the comment only** to
`// post-M1d R6: buildDisplayTokens now lists a mint once (pinned in tokenModule.test.ts); this suite mocks it`.

`TokenLogo.test.tsx`:

```ts
  it('R7: "wSOL" gets the Solana logo (not the letter "w")', () => {
    const {UNSAFE_getAllByType, queryByText} = render(<TokenLogo symbol="wSOL" isNoc={false} />);
    expect(UNSAFE_getAllByType(Image)).toHaveLength(1);
    expect(queryByText('w')).toBeNull();
  });
```

Coverage rows (spec §7; these may pass at once — they pin existing behaviour, say so in the report):

`TokenPickerSheet.test.tsx`:

```ts
  it('post-M1d §7: a sub-precision balance reads "<0.0001", never scientific notation', () => {
    const {getByText, queryByText} = render(
      <TokenPickerSheet visible title="Select token" tokens={tokens} selectedMint="native" balances={{native: '10'}} onSelect={() => {}} onClose={() => {}} />,
    );
    expect(getByText('<0.0001')).toBeTruthy();
    expect(queryByText(/e-\d/)).toBeNull();
  });
```

`presaleAllocation.test.ts` (the allocation shows 2 decimals):

```ts
  it('post-M1d §7: an allocation below the shown precision reads "<0.01"', () => {
    expect(presaleAllocationDisplay({tokensPurchased: '100', referralBonusTokens: '0'})).toEqual({show: true, nocText: '<0.01'});
  });
```

- [ ] **Step 2: Run them.** `npx jest src/store/zustand/__tests__/walletStore.test.ts src/modules/tokens src/modules/prices src/components/__tests__/TokenLogo.test.tsx src/components/__tests__/TokenPickerSheet.test.tsx src/modules/presale --forceExit`
      Expected: FAIL on the rehydration relabel, T1, T2, the wSOL name, `priceKeyFor`, the wSOL portfolio rows and
      the logo. The TokenPicker and presale-allocation rows are **pins (pass before the change)**.

- [ ] **Step 3: Implement the modules.**

`coreTokens.ts:13`:

```ts
  // post-M1d R7: wrapped SOL is its own token — never labelled "SOL" (the native row is mint 'native')
  {mint: 'So11111111111111111111111111111111111111112', symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9},
```

`tokenModule.ts` `buildDisplayTokens` — add the dedupe (and one sentence to its doc comment: "One entry per mint
(post-M1d R6): the amounts are summed per mint elsewhere (`sumTokenBalancesByMint`); this is the list of rows."):

```ts
    const result: TokenMetadata[] = [];
    const listed = new Set<string>();
    for (const acc of accounts) {
      if (acc.amount === '0') continue; // not held
      if (listed.has(acc.mint)) continue; // one row per mint
      const trust = this.classifyToken(acc.mint);
      if (trust === 'unknown') continue; // core + verified only
      listed.add(acc.mint);
```

`portfolio.ts`:

```ts
import type {TokenPrice} from './priceModule';
import {WSOL_MINT} from '../swap/jupiter';
```

```ts
/**
 * post-M1d R7 / r2-4: prices are keyed by mint ('native' for SOL). Wrapped SOL has no entry of its own —
 * it is worth exactly SOL, so it is priced from 'native'. Every other mint is priced under itself.
 */
export function priceKeyFor(mint: string): string {
  return mint === WSOL_MINT ? 'native' : mint;
}
```

and in `computePortfolio`: `const price = prices[priceKeyFor(h.mint)];` (the `perToken` key stays `h.mint`).

`TokenLogo.tsx:19`: `if (symbol === 'SOL' || symbol === 'wSOL') {`.

`walletStore.ts` — import `CORE_TOKENS` from `'../../modules/tokens/coreTokens'` (that file imports only
`constants/programs`: no cycle; `tokenModule.ts` imports this store's *type* only), add above the store:

```ts
/**
 * post-M1d R7 (review r1-6): the token list is persisted, so a row written by an older build can carry a
 * label the registry no longer uses (wrapped SOL was "SOL" / "Solana"). A core mint always shows its
 * CORE_TOKENS symbol and name; every other row is returned as stored. Runs on rehydration (`merge`).
 */
export function relabelCoreTokens(tokens: readonly TokenMetadata[]): TokenMetadata[] {
  return tokens.map(t => {
    const core = CORE_TOKENS.find(c => c.mint === t.mint);
    return core && (t.symbol !== core.symbol || t.name !== core.name) ? {...t, symbol: core.symbol, name: core.name} : t;
  });
}
```

and replace Task 1's `merge`:

```ts
      // r2-1: a new session never starts stale, whatever the record holds.
      // review r1-6: a persisted core-token row takes the registry's label (no version/migrate exists to bump).
      merge: (persisted, current) => {
        const stored = (persisted ?? {}) as Partial<WalletState>;
        return {
          ...current,
          ...stored,
          tokens: Array.isArray(stored.tokens) ? relabelCoreTokens(stored.tokens) : current.tokens,
          lastSyncFailedAt: null,
        };
      },
```

- [ ] **Step 4: Run them.** The Step 2 command. Expected: PASS. Then `npx jest` once: any other test that expected
      the wSOL core entry to be `'SOL'` / `'Solana'` fails here — update it with the comment `// post-M1d R7`.

- [ ] **Step 5: Write the failing screen tests.**

`DashboardScreen.test.tsx` (the suite mocks `TokenManager.sortTokens` as identity and `computePortfolio`):

```ts
  describe('post-M1d R7 / r2-4 — the native row is keyed by the mint, not by the symbol', () => {
    const WSOL = 'So11111111111111111111111111111111111111112';
    const withWsol = (solBalance: string): AccountPublicData => ({
      status: 'ready', syncedAt: 1, solBalance, nocBalance: '0',
      tokens: [{mint: WSOL, symbol: 'wSOL', name: 'Wrapped SOL', decimals: 9, trust: 'core'}],
      tokenBalances: {[WSOL]: '500000000'},
    });

    it('SOL and wSOL are two rows: "1 SOL" (native only) and "0.5 wSOL" (its own amount)', async () => {
      mockPublic.current = withWsol('1000000000');
      const r = await renderDashboard();
      expect(r.getByText('1 SOL')).toBeTruthy();
      expect(r.getByText('0.5 wSOL')).toBeTruthy();
      expect(r.getByText('Wrapped SOL')).toBeTruthy();
      expect(r.queryByText('1.5 SOL')).toBeNull(); // the list rows are never folded (the split column is)
    });

    it('Review Focus 5: wSOL held and 0 native SOL → the SOL row is still there, reading "0 SOL"', async () => {
      mockPublic.current = withWsol('0');
      const r = await renderDashboard();
      expect(r.getByText('0 SOL')).toBeTruthy();
      expect(r.getByText('0.5 wSOL')).toBeTruthy();
    });

    it('a row that merely CALLS itself "SOL" is not the native row: it shows its own mint\'s amount', async () => {
      mockPublic.current = {
        status: 'ready', syncedAt: 1, solBalance: '1000000000', nocBalance: '0',
        tokens: [{mint: 'FAKEMINT', symbol: 'SOL', name: 'Not Solana', decimals: 9, trust: 'verified'}],
        tokenBalances: {FAKEMINT: '7000000000'},
      };
      const r = await renderDashboard();
      expect(r.getByText('7 SOL')).toBeTruthy(); // its own balance, not the native 1
      expect(r.getAllByText('1 SOL').length).toBeGreaterThan(0); // and the native row exists beside it
    });

    // pin (passes before the change): publicSide already folds wSOL (valueLine.ts:42-46); this row keeps R7's
    // "the split keeps folding" true while the list rows stop folding
    it('the split\'s Public column keeps folding wSOL into SOL (a summary, R7)', async () => {
      mockPublic.current = withWsol('1000000000');
      mockResolved.current = {prices: {}, havePrices: false};
      const r = await renderDashboard();
      expect(r.getAllByTestId('dashboard-split-public-line').map(l => l.props.children)).toEqual(['1.5 SOL']);
    });
  });
```

`TokenDetailScreen.test.tsx`, in `describe('the chart on a build without pricing (devnet)')` (mainnet is that
suite's default; its prices are `{native: {usd: 150, change24h: 2}}`):

```ts
  it('r2-4: the wSOL detail is "wSOL" / "Wrapped SOL", priced from the SOL price, with the SOL chart', () => {
    const {getByText, getAllByText} = render(
      withSafeArea(
        <TokenDetailScreen mint="So11111111111111111111111111111111111111112" onBack={() => {}} onSend={jest.fn()} onReceive={() => {}} onSwap={jest.fn()} />,
      ),
    );
    expect(getAllByText('wSOL').length).toBeGreaterThan(0);
    expect(getByText('Wrapped SOL')).toBeTruthy();
    expect(getByText('$150.00')).toBeTruthy(); // the price hero — not "—"
    expect(mockPriceHistory).toHaveBeenCalledWith('solana', expect.any(String));
  });
```

- [ ] **Step 6: Run them.** `npx jest src/screens/dashboard src/screens/transparent/__tests__/TokenDetailScreen.test.tsx --forceExit`
      Expected: FAIL — the wSOL row is missing or shows the native amount; the wSOL price is "—". (The split-folding
      row is a pin and passes already.)

- [ ] **Step 7: Implement the screens.**

`DashboardScreen.tsx:329`: `const hasSol = tokens.some(t => t.mint === NATIVE_SOL); // r2-4: by mint, never by symbol`

`DashboardScreen.tsx:451`: `const isNativeSol = token.mint === 'native'; // r2-4: by mint, never by symbol`

`TokenDetailScreen.tsx:74`: `const price = prices[priceKeyFor(mint)]?.usd ?? null; // r2-4: wSOL is priced as SOL`
and `:104`: `const cgId = coingeckoIdForMint(priceKeyFor(mint));` — import `priceKeyFor` next to `computePortfolio`.

- [ ] **Step 8: Run them.** The Step 6 command. Expected: PASS.

- [ ] **Step 9: Gates.** `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`.

- [ ] **Step 10: Commit.**

```bash
git add src/modules/tokens src/modules/prices src/components/TokenLogo.tsx src/components/__tests__ \
  src/store/zustand/walletStore.ts src/store/zustand/__tests__/walletStore.test.ts \
  src/modules/accounts/__tests__/accountSnapshot.test.ts src/modules/presale/__tests__ \
  src/screens/dashboard src/screens/transparent/TokenDetailScreen.tsx src/screens/transparent/__tests__/TokenDetailScreen.test.tsx
git commit -m "fix(tokens): one row per mint; wrapped SOL is its own row, priced as SOL and counted once"
```

---

### Task 6: The "linked" mark and its queue (storage only, no screen)

Spec: §4 ("What is written", "Failure"), R2, R3, Review Focus 3.

**Files:**
- Modify: `src/constants/mmkvKeys.ts` (after `ACCOUNTS_SELECTED`, `:50`)
- Modify: `src/modules/shielded/a0/accountRegistry.ts` — new functions after `releaseA0FreshAccount` (`:483-495`);
  one call in `promoteA0FreshAccount` (`:474`) and one in `addA0RecoveredExitAccounts` (`:536-538`)
- Create: `src/modules/accounts/linkQueue.ts`, `src/modules/accounts/__tests__/linkQueue.test.ts`
- Test: `src/modules/shielded/a0/__tests__/accountRegistry.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:

```ts
// src/constants/mmkvKeys.ts — ENCRYPTED instance only
ACCOUNTS_LINK_PENDING: 'v1_accounts.linkPending',

// src/modules/shielded/a0/accountRegistry.ts
/** Sets `linked: true` on the `fresh-exit` entries whose address is in `addresses`; returns how many changed.
 *  Never touches `main` or `fresh-pending`. Needs no seed. Throws LOCKED / CHANGED / CORRUPT like every read. */
export function markA0AccountsLinked(addresses: readonly string[], options?: A0RegistryOptions): number;
/** A listener fired after a write that turned a `fresh-pending` entry into `fresh-exit`. Returns the unregister. */
export function onA0AccountPromoted(listener: () => void): () => void;

// src/modules/accounts/linkQueue.ts
export function queueLinkedAccounts(addresses: readonly string[]): void;        // never throws
export function drainLinkQueue(): number;                                        // entries newly marked; never throws
export function recordConfirmedSendLinks(addresses: readonly string[]): number;  // queue, then drain; never throws
export function pendingLinkedAccounts(): string[];                               // memory ∪ persisted (when open)
```

**The queue's rules (R2, R3), in one place:**
- Held in memory, and also written to the encrypted MMKV whenever that store is open.
- A drain needs the encrypted store open and the registry readable. If either fails, the queue stays as it is.
- For each queued address, by its role in the registry *now*: `fresh-exit` → marked and removed from the queue;
  `fresh-pending` → stays queued; `main`, or not in the registry (a released reservation) → dropped.
- Cleared with the wallet: `onSecureMmkvReset` empties the memory queue; the wipe (`clearAllStores`) removes the
  stored one with everything else.
- A `fresh-pending` address is applied when its entry is promoted (`onA0AccountPromoted` → drain).

- [ ] **Step 1: Write the failing registry tests.** In `accountRegistry.test.ts` add
      `markA0AccountsLinked, onA0AccountPromoted` to the import, and:

```ts
describe('post-M1d §4: markA0AccountsLinked (the tag after a confirmed own-account Send)', () => {
  const base = () =>
    setRaw([entry(ABANDON, 'slip10:0', 'main'), entry(ABANDON, 'slip10:1', 'fresh-exit'), entry(ABANDON, 'slip10:2', 'fresh-pending'), entry(ABANDON, 'slip10:3', 'fresh-exit')]);

  it('marks the matching fresh-exit entries only, returns how many changed, and the record still decodes', () => {
    base();
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:1')])).toBe(1);
    const stored = loadA0AccountRegistry()!;
    expect(stored[1]).toEqual({...entry(ABANDON, 'slip10:1', 'fresh-exit'), linked: true});
    expect(stored[3]!.linked).toBeUndefined(); // the other exit is untouched
  });

  it('never the main account, never a fresh-pending one (the validator forbids linked there)', () => {
    base();
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:0'), addr(ABANDON, 'slip10:2')])).toBe(0);
    const stored = loadA0AccountRegistry()!;
    expect(stored[0]!.linked).toBeUndefined();
    expect(stored[2]!.linked).toBeUndefined();
    expect(stored[2]!.role).toBe('fresh-pending');
  });

  it('idempotent: a second call changes nothing and writes nothing', () => {
    base();
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:1')])).toBe(1);
    const before = mmkvSecure()!.getString(KEY);
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:1')])).toBe(0);
    expect(mmkvSecure()!.getString(KEY)).toBe(before);
  });

  it('an address the registry does not know, an empty list, no record → 0', () => {
    base();
    expect(markA0AccountsLinked([addr(ZOO, 'slip10:1')])).toBe(0);
    expect(markA0AccountsLinked([])).toBe(0);
    mmkvSecure()!.remove(KEY);
    expect(markA0AccountsLinked([addr(ABANDON, 'slip10:1')])).toBe(0);
  });

  it('needs no seed, and fails closed: locked → E_A0_STORE_LOCKED, a corrupt record → E_A0_ACCOUNTS_CORRUPT, another instance → E_A0_STORE_CHANGED', () => {
    base();
    const bound = mmkvSecure();
    mmkvSecure()!.set(KEY, '{not json');
    expect(code(() => markA0AccountsLinked([addr(ABANDON, 'slip10:1')]))).toBe('E_A0_ACCOUNTS_CORRUPT');
    clearAllStores();
    expect(code(() => markA0AccountsLinked([addr(ABANDON, 'slip10:1')]))).toBe('E_A0_STORE_LOCKED');
    initSecureMmkv('other-key');
    expect(code(() => markA0AccountsLinked([addr(ABANDON, 'slip10:1')], {bound}))).toBe('E_A0_STORE_CHANGED');
  });
});

describe('post-M1d R3: onA0AccountPromoted', () => {
  it('fires after a fresh-pending → fresh-exit write (promote and a restore), not for "already", and a throwing listener never fails the promotion', () => {
    setRaw([entry(ABANDON, 'slip10:0', 'main'), entry(ABANDON, 'slip10:1', 'fresh-pending'), entry(ABANDON, 'slip10:2', 'fresh-pending')]);
    const seen: string[] = [];
    const off = onA0AccountPromoted(() => {
      seen.push(loadA0AccountRegistry()!.filter(e => e.role === 'fresh-exit').map(e => e.scheme).join(','));
      throw new Error('a listener that throws');
    });
    expect(promoteA0FreshAccount('slip10:1')).toBe('promoted');
    expect(seen).toEqual(['slip10:1']); // fired AFTER the write: the listener reads the promoted entry
    expect(promoteA0FreshAccount('slip10:1')).toBe('already');
    expect(seen).toHaveLength(1);
    expect(addA0RecoveredExitAccounts([2], seedOf(ABANDON))).toEqual(['slip10:2']);
    expect(seen).toHaveLength(2);
    off();
    setRaw([entry(ABANDON, 'slip10:0', 'main'), entry(ABANDON, 'slip10:1', 'fresh-pending')]);
    promoteA0FreshAccount('slip10:1');
    expect(seen).toHaveLength(2); // unregistered
  });
});
```

- [ ] **Step 2: Run them.** `npx jest src/modules/shielded/a0/__tests__/accountRegistry.test.ts --forceExit`
      Expected: FAIL — the two exports do not exist.

- [ ] **Step 3: Implement in `accountRegistry.ts`.** After `releaseA0FreshAccount`:

```ts
/**
 * post-M1d spec §4 (P3): the tag after a confirmed Send between two accounts of this seed. Sets
 * `linked` on every `fresh-exit` entry whose address is in `addresses` and returns how many changed
 * (0 → nothing written). Never touches `main` or `fresh-pending` (the record's rules forbid the mark
 * there). Needs no seed: the stored addresses are compared. The mark is never removed.
 */
export function markA0AccountsLinked(addresses: readonly string[], options: A0RegistryOptions = {}): number {
  if (addresses.length === 0) {
    return 0;
  }
  const entries = readRecord(options.bound);
  if (entries === null) {
    return 0;
  }
  const wanted = new Set(addresses);
  let changed = 0;
  const next = entries.map(e => {
    if (e.role === 'fresh-exit' && e.linked !== true && wanted.has(e.address)) {
      changed += 1;
      return {...e, linked: true as const};
    }
    return e;
  });
  if (changed > 0) {
    write(next, options.bound);
  }
  return changed;
}

const promotedListeners = new Set<() => void>();

/**
 * post-M1d R3: told after a write that turned a `fresh-pending` entry into `fresh-exit` (a landed
 * unshield, or a restore). The link queue (`modules/accounts/linkQueue.ts`) registers here, so this
 * module imports nothing of it. A listener that throws never fails the promotion.
 */
export function onA0AccountPromoted(listener: () => void): () => void {
  promotedListeners.add(listener);
  return () => {
    promotedListeners.delete(listener);
  };
}

function firePromoted(): void {
  for (const listener of [...promotedListeners]) {
    try {
      listener();
    } catch {
      // the promotion is written; a listener's failure is its own
    }
  }
}
```

  In `promoteA0FreshAccount`, replace its last two lines:

```ts
  write(next, options.bound);
  if (e.role === 'fresh-pending') {
    firePromoted(); // post-M1d R3: a queued "linked" for this account can be applied now
    return 'promoted';
  }
  return 'already';
```

  In `addA0RecoveredExitAccounts`, the write block becomes:

```ts
  if (changed.length > 0) {
    write(next, options.bound);
    firePromoted(); // post-M1d R3
  }
```

  Add the role sentence to the file header's ROLES paragraph: "`linked` on a `fresh-exit` is also set by
  `markA0AccountsLinked` after a confirmed own-account Send (post-M1d §4)."

- [ ] **Step 4: Run them.** The Step 2 command. Expected: PASS (and every existing registry test).

- [ ] **Step 5: Write the failing queue tests.** Create `src/modules/accounts/__tests__/linkQueue.test.ts`:

```ts
/**
 * post-M1d spec §4, R2, R3: the "linked" queue. The registry is written as raw records and read by the
 * real registry module (the harness of selectedAccount.test.ts).
 */
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {storeTransparentScheme} from '../../keyDerivation/derivationScheme';
import {loadA0AccountRegistry, promoteA0FreshAccount, releaseA0FreshAccount} from '../../shielded/a0/accountRegistry';
import {drainLinkQueue, pendingLinkedAccounts, queueLinkedAccounts, recordConfirmedSendLinks} from '../linkQueue';

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const FOREIGN = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const REG = 'v1_accounts';
const QUEUE = 'v1_accounts.linkPending';
const main = {scheme: 'slip10:0', role: 'main', address: MAIN};
const exit3 = {scheme: 'slip10:3', role: 'fresh-exit', address: A3};
const pending1 = {scheme: 'slip10:1', role: 'fresh-pending', address: A1};
const setRegistry = (accounts: object[]): void => mmkvSecure()!.set(REG, JSON.stringify({schema: 1, accounts}));
const linked = (address: string): boolean => loadA0AccountRegistry()!.find(e => e.address === address)!.linked === true;
const stored = (): unknown => {
  const raw = mmkvSecure()!.getString(QUEUE);
  return raw === undefined ? undefined : JSON.parse(raw);
};

beforeEach(() => {
  clearAllStores(); // also empties the memory queue through the reset hook (once the module registered it)
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
});

it('the key is v1_accounts.linkPending', () => {
  expect(MMKV_KEYS.ACCOUNTS_LINK_PENDING).toBe(QUEUE);
});

// Q1
it('a fresh-exit participant is marked; the queue is cleared once written', () => {
  setRegistry([main, exit3]);
  expect(recordConfirmedSendLinks([A3])).toBe(1);
  expect(linked(A3)).toBe(true);
  expect(pendingLinkedAccounts()).toEqual([]);
  expect(stored()).toBeUndefined();
});

// Q2
it('never the main account; an address outside the registry is dropped', () => {
  setRegistry([main, exit3]);
  expect(recordConfirmedSendLinks([MAIN, FOREIGN])).toBe(0);
  expect(loadA0AccountRegistry()![0]!.linked).toBeUndefined();
  expect(pendingLinkedAccounts()).toEqual([]);
});

// Q3
it('idempotent; an empty list does nothing', () => {
  setRegistry([main, exit3]);
  expect(recordConfirmedSendLinks([A3])).toBe(1);
  expect(recordConfirmedSendLinks([A3])).toBe(0);
  expect(recordConfirmedSendLinks([])).toBe(0);
});

// Q4 (R3)
it('R3: a fresh-pending participant is queued, not written; it is applied when its entry is promoted', () => {
  setRegistry([main, exit3, pending1]);
  expect(recordConfirmedSendLinks([A1])).toBe(0);
  expect(loadA0AccountRegistry()!.find(e => e.address === A1)).toEqual(pending1); // no linked on a pending entry
  expect(pendingLinkedAccounts()).toEqual([A1]);
  expect(stored()).toEqual([A1]);
  expect(promoteA0FreshAccount('slip10:1')).toBe('promoted');
  expect(linked(A1)).toBe(true);
  expect(pendingLinkedAccounts()).toEqual([]);
  expect(stored()).toBeUndefined();
});

// Q5 (R3)
it('R3: a released reservation → the queued address is dropped at the next drain', () => {
  setRegistry([main, exit3, pending1]);
  recordConfirmedSendLinks([A1]);
  expect(releaseA0FreshAccount('slip10:1')).toBe(true);
  expect(drainLinkQueue()).toBe(0);
  expect(pendingLinkedAccounts()).toEqual([]);
  expect(stored()).toBeUndefined();
});

// Q6 (R2)
it('R2: an unreadable registry → nothing thrown, the queue is kept (memory AND store); it drains once the registry reads again', () => {
  mmkvSecure()!.set(REG, '{not json');
  expect(() => recordConfirmedSendLinks([A3])).not.toThrow();
  expect(pendingLinkedAccounts()).toEqual([A3]);
  expect(stored()).toEqual([A3]);
  setRegistry([main, exit3]);
  expect(drainLinkQueue()).toBe(1);
  expect(linked(A3)).toBe(true);
  expect(stored()).toBeUndefined();
});

// Q7 (R2, Review Focus 3)
it('R2: a locked store → held in memory, nothing thrown; a wipe + import clears it — the new wallet\'s account is never tagged', () => {
  setRegistry([main, exit3]);
  queueLinkedAccounts([]); // registers the module's hooks while a store is open
  clearAllStores(); // the wipe: the encrypted store is gone
  expect(() => recordConfirmedSendLinks([A3])).not.toThrow();
  expect(pendingLinkedAccounts()).toEqual([A3]); // memory only
  expect(drainLinkQueue()).toBe(0); // still locked
  initSecureMmkv('another-wallet-key'); // the import: a new instance → the reset hook
  storeTransparentScheme({kind: 'slip10', account: 0});
  setRegistry([main, exit3]);
  expect(pendingLinkedAccounts()).toEqual([]);
  expect(drainLinkQueue()).toBe(0);
  expect(linked(A3)).toBe(false);
});

// Q8 (R2)
it('R2: app start — a queue stored by an earlier process is drained after unlock', () => {
  setRegistry([main, exit3]);
  mmkvSecure()!.set(QUEUE, JSON.stringify([A3])); // written by the previous process; this one's memory is empty
  expect(drainLinkQueue()).toBe(1);
  expect(linked(A3)).toBe(true);
  expect(stored()).toBeUndefined();
});

// Q9 (Review Focus 3)
it.each([['not JSON', '{nope'], ['not a list', '{"a":1}'], ['a list of non-strings', '[1,2]']])(
  'a malformed stored queue (%s) never throws and never blocks a later confirmed Send',
  (_n, raw) => {
    setRegistry([main, exit3]);
    mmkvSecure()!.set(QUEUE, raw);
    expect(() => drainLinkQueue()).not.toThrow();
    expect(recordConfirmedSendLinks([A3])).toBe(1);
    expect(linked(A3)).toBe(true);
  },
);

// Q10
it('the queue is in the ENCRYPTED instance only (a list of one\'s own accounts is itself a link)', () => {
  setRegistry([main, exit3, pending1]);
  const publicBefore = mmkvPublic.getAllKeys().sort();
  recordConfirmedSendLinks([A1]);
  expect(mmkvPublic.getAllKeys().sort()).toEqual(publicBefore);
  expect(mmkvSecure()!.getString(QUEUE)).toBeDefined();
});

// Q11
it('queueLinkedAccounts alone writes no tag (the tag needs a drain)', () => {
  setRegistry([main, exit3]);
  queueLinkedAccounts([A3]);
  expect(linked(A3)).toBe(false);
  expect(pendingLinkedAccounts()).toEqual([A3]);
});
```

- [ ] **Step 6: Run them.** `npx jest src/modules/accounts/__tests__/linkQueue.test.ts --forceExit`
      Expected: FAIL — the module does not exist.

- [ ] **Step 7: Implement.** In `mmkvKeys.ts`, after `ACCOUNTS_SELECTED`:

```ts
  /** post-M1d §4 / R2: addresses waiting for their "linked" tag (a JSON list). Own accounts → ENCRYPTED instance only. */
  ACCOUNTS_LINK_PENDING: 'v1_accounts.linkPending',
```

  Create `src/modules/accounts/linkQueue.ts`:

```ts
/**
 * post-M1d spec §4 (P3), R2, R3: the "linked" tag after a CONFIRMED Send between two accounts of this
 * seed. #21 hands the fresh-exit participants here on proof of confirmation; they are written to the
 * registry (`markA0AccountsLinked`) as soon as it is writable.
 *
 * THE QUEUE is held in memory and also stored in the ENCRYPTED MMKV whenever that store is open (a
 * list of one's own accounts is itself a link — never the public instance). A locked store throws
 * (`accountRegistry.ts` `storage`), so the queue never relies on it.
 *
 * A DRAIN needs the encrypted store open and the registry readable; otherwise the queue stays. Per
 * address, by its role in the registry now: `fresh-exit` → marked, removed; `fresh-pending` → stays
 * (the record forbids the mark on a reservation; it is applied when the entry is promoted, R3);
 * `main`, or not in the registry (a released reservation) → dropped. Drains run after unlock, when
 * the Accounts sheet opens, after every confirmed Send, and when a reservation is promoted.
 *
 * CLEARED with the wallet: the reset hook empties the memory queue (a new encrypted instance, or a
 * wipe); the wipe removes the stored one. If the process dies while the store is locked the tag is
 * lost — accepted (R2): the copy never claims "not linked", and PR 2's scan recovers it.
 *
 * Nothing here throws: the Send it follows already succeeded.
 */
import type {MMKV} from 'react-native-mmkv';
import {mmkvSecure, onSecureMmkvReset} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {loadA0AccountRegistry, markA0AccountsLinked, onA0AccountPromoted} from '../shielded/a0/accountRegistry';

const KEY = MMKV_KEYS.ACCOUNTS_LINK_PENDING;

let memory = new Set<string>();
let hooked = false;

/** Registered on first use, not at import: a screen test that stubs `instances` loads this module too. */
function hook(): void {
  if (hooked) {
    return;
  }
  hooked = true;
  onSecureMmkvReset(() => {
    memory = new Set();
  });
  onA0AccountPromoted(() => {
    drainLinkQueue();
  });
}

function readStored(store: MMKV): string[] {
  const raw = store.getString(KEY);
  if (raw === undefined) {
    return [];
  }
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) && v.every(x => typeof x === 'string') ? (v as string[]) : [];
  } catch {
    return []; // a malformed record is no queue: it is rewritten by the next write
  }
}

function writeStored(store: MMKV, addresses: readonly string[]): void {
  if (addresses.length === 0) {
    store.remove(KEY);
  } else {
    store.set(KEY, JSON.stringify(addresses));
  }
}

function drain(): number {
  hook();
  const store = mmkvSecure();
  if (store === null) {
    return 0; // locked: the memory queue waits
  }
  const queued = [...new Set([...memory, ...readStored(store)])];
  if (queued.length === 0) {
    if (store.getString(KEY) !== undefined) {
      store.remove(KEY); // a malformed or empty record
    }
    return 0;
  }
  // whatever follows, both copies hold the whole queue: a failure below loses nothing
  memory = new Set(queued);
  writeStored(store, queued);
  const entries = loadA0AccountRegistry({bound: store}); // throws when the record is corrupt: the queue stays
  const roleOf = new Map((entries ?? []).map(e => [e.address, e.role]));
  const exits = queued.filter(a => roleOf.get(a) === 'fresh-exit');
  const waiting = queued.filter(a => roleOf.get(a) === 'fresh-pending'); // R3
  const changed = exits.length > 0 ? markA0AccountsLinked(exits, {bound: store}) : 0; // throws: the queue stays
  memory = new Set(waiting);
  writeStored(store, waiting);
  return changed;
}

/** Apply every queued address the registry can take now; the number of entries newly marked. Never throws. */
export function drainLinkQueue(): number {
  try {
    return drain();
  } catch {
    return 0;
  }
}

/** Add addresses to the queue (memory, and the encrypted store when it is open). Writes no tag. Never throws. */
export function queueLinkedAccounts(addresses: readonly string[]): void {
  try {
    hook();
    for (const a of addresses) {
      memory.add(a);
    }
    const store = mmkvSecure();
    if (store !== null && addresses.length > 0) {
      writeStored(store, [...new Set([...memory, ...readStored(store)])]);
    }
  } catch {
    // the memory queue holds them
  }
}

/** #21, on proof of confirmation: queue the Send's fresh-exit participants, then drain. Never throws. */
export function recordConfirmedSendLinks(addresses: readonly string[]): number {
  if (addresses.length === 0) {
    return 0;
  }
  queueLinkedAccounts(addresses);
  return drainLinkQueue();
}

/** What is waiting: the memory queue, plus the stored one when the encrypted store is open. */
export function pendingLinkedAccounts(): string[] {
  try {
    const store = mmkvSecure();
    return [...new Set([...memory, ...(store !== null ? readStored(store) : [])])];
  } catch {
    return [...memory];
  }
}
```

- [ ] **Step 8: Run them.** `npx jest src/modules/accounts/__tests__/linkQueue.test.ts src/modules/shielded/a0/__tests__/accountRegistry.test.ts --forceExit`
      Expected: PASS. If Q7's first `queueLinkedAccounts([])` does not register the hooks (it returns early only for
      the store write, not for `hook()`), check the order in `queueLinkedAccounts`: `hook()` is its first statement.

- [ ] **Step 9: Mutation check (the lesson of the Aug 2026 review: a check is a check only if removing it fails a
      test).** One at a time, make each change, run the two suites, see the named test fail, and revert:
  - in `markA0AccountsLinked` change `e.role === 'fresh-exit'` to `e.role !== 'main'` → "never … a fresh-pending one"
    fails (the write is refused as `E_A0_ACCOUNTS_INVALID`);
  - in `drain` delete the `waiting` filter (`const waiting: string[] = []`) → Q4 fails;
  - in `hook` delete the `onSecureMmkvReset` registration → Q7 fails.
  Report the three results in the task report.

- [ ] **Step 10: Gates.** `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`.

- [ ] **Step 11: Commit.**

```bash
git add src/constants/mmkvKeys.ts src/modules/shielded/a0/accountRegistry.ts \
  src/modules/shielded/a0/__tests__/accountRegistry.test.ts \
  src/modules/accounts/linkQueue.ts src/modules/accounts/__tests__/linkQueue.test.ts
git commit -m "feat(accounts): markA0AccountsLinked and the link queue (memory + encrypted store, drained when writable)"
```

---

### Task 7: A confirmed own-account Send writes the "linked" tag

Spec: §4, P3, R14, R15.

**Files:**
- Modify: `src/modules/accounts/linking.ts` (add `linkedParticipants`)
- Modify: `src/types/transfer.ts:21-33` (`TransferIntent`)
- Modify: `src/screens/transparent/SendScreen.tsx:34` (import), `:380-391` (`onReview`)
- Modify: `src/screens/transparent/TransactionStatusScreen.tsx:19-23` (imports), `:125-133` (the success effect)
- Modify: `src/screens/dashboard/DashboardScreen.tsx:238-247` (`openAccounts`)
- Modify: `src/modules/session/secureStorageSession.ts:67-80` (`unlockSecureStorage`)
- Test: `src/modules/accounts/__tests__/linking.test.ts`, `src/screens/transparent/__tests__/SendScreen.test.tsx`,
  `src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx`,
  `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`,
  `src/modules/session/__tests__/secureStorageSession.test.ts`, and every test that builds a `TransferIntent`
  (`TxSimulateScreen.test.tsx:101`, `TxConfirmScreen.test.tsx:90`, `TransactionStatusScreen.test.tsx:96`,
  `src/modules/solana/__tests__/transferRisk.test.ts:14`)

**Interfaces:**
- Consumes (Task 6): `recordConfirmedSendLinks(addresses: readonly string[]): number`, `drainLinkQueue(): number`.
- Produces:

```ts
// src/modules/accounts/linking.ts
/** The fresh-exit (or fresh-pending) accounts of this seed taking part in a Send the linking warning applies to —
 *  the source and/or the recipient, never the main account; [] when the warning does not apply. */
export function linkedParticipants(seed: readonly SeedAccount[], source: string, recipient: string | null): string[];

// src/types/transfer.ts — TransferIntent gains
  /** post-M1d §4: the fresh-exit accounts this Send links (computed once on #12 from the registry read that
   *  showed the warning); [] when the warning did not apply. #21 tags them only on a confirmed outcome. */
  linksAccounts: string[];
```

**When the tag is written — and when it is not:**
- Written: #21 reaches `stage === 'success'` — a polled `confirmed` / `finalized` status with no `err`, or an
  earlier attempt adopted by `findLandedSignature` (which returns only landed, successful signatures:
  `landedSignature.ts:36-55`). Also after a late success (stuck → confirmed) while #21 is mounted (R15).
- Not written: cancel on #12 / #19 / #20 (nothing reaches #21); a failed submit; a landed-but-failed transaction
  (R14 — noted for PR 2); `stuck` or any unconfirmed outcome; #21 unmounted before confirmation.

- [ ] **Step 1: Write the failing `linkedParticipants` tests.** In `linking.test.ts` (import it next to
      `linkingWarningApplies`):

```ts
describe('post-M1d §4 / P3: linkedParticipants — every fresh-exit account taking part, never main', () => {
  it.each<[string, string, string | null, string[]]>([
    ['main → exit: the recipient', MAIN, A3, [A3]],
    ['exit → main: the source', A3, MAIN, [A3]],
    ['exit → another exit: both', A3, A2, [A3, A2]],
    ['R3: main → a fresh-pending reservation (queued until it is promoted)', MAIN, A1, [A1]],
    ['exit → a fresh-pending reservation: both', A3, A1, [A3, A1]],
    ['main → a foreign address: none (no warning)', MAIN, FOREIGN, []],
    ['exit → a foreign address: none (no warning, nothing is linked to another own account)', A3, FOREIGN, []],
    ['exit → itself: none', A3, A3, []],
    ['no recipient: none', A3, null, []],
  ])('%s', (_n, source, recipient, expected) => {
    expect(linkedParticipants(SEED, source, recipient)).toEqual(expected);
  });

  it('agrees with the warning on every pair: non-empty exactly when linkingWarningApplies', () => {
    const all = [MAIN, A1, A2, A3, FOREIGN];
    for (const s of all) {
      for (const r of [...all, null]) {
        expect(linkedParticipants(SEED, s, r).length > 0).toBe(linkingWarningApplies(SEED, s, r));
      }
    }
  });
});
```

- [ ] **Step 2: Run, implement, run.** `npx jest src/modules/accounts/__tests__/linking.test.ts --forceExit` → FAIL.
      Add to `linking.ts`:

```ts
/**
 * post-M1d spec §4 (P3, R3): the accounts a Send links — the fresh-exit (or fresh-pending) accounts of
 * this seed among its two ends, source first. Empty exactly when the warning does not apply; never the
 * main account. Computed on #12 from the same registry read as the warning, carried in the intent, and
 * tagged by #21 only on a confirmed outcome.
 */
export function linkedParticipants(seed: readonly SeedAccount[], source: string, recipient: string | null): string[] {
  if (recipient === null || !linkingWarningApplies(seed, source, recipient)) {
    return [];
  }
  return [source, recipient].filter(a => {
    const entry = seed.find(x => x.address === a);
    return entry !== undefined && EXIT_LIKE.has(entry.role);
  });
}
```

      Run again → PASS.

- [ ] **Step 3: Add the intent field.** In `src/types/transfer.ts` add `linksAccounts: string[];` with the doc
      comment from **Interfaces**. Run `npx tsc --noEmit`: it lists every place that builds a `TransferIntent`.
      Add `linksAccounts: []` to each test fixture named under **Files** (comment
      `// post-M1d §4: no own-account link in this Send`). `SendScreen.tsx` is fixed in Step 5.

- [ ] **Step 4: Write the failing #12 tests.** In `SendScreen.test.tsx`, `'M1d — the linking warning…'` describe:
  - **Replace** the test `'M1d: known limit, owner question — an acknowledged exit → main Send leaves the account's
    tags unchanged…'` (it pinned the limit this PR closes) with:

```ts
  // post-M1d P3 (owner): the limit this row used to pin is closed — the intent now names the accounts to tag
  it('post-M1d §4: exit → main, second tap → the intent carries linksAccounts = [the exit]; never the main account', () => {
    const {r, onReview} = setup(MAIN);
    tap(r);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([A3]);
  });

  it('post-M1d §4 / R3: exit → a fresh-pending reservation → both travel (the pending one is queued by #21)', () => {
    const {r, onReview} = setup(A1);
    tap(r);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([A3, A1]);
  });

  it('post-M1d §4: a foreign recipient → linksAccounts is empty', () => {
    const {r, onReview} = setup(FOREIGN);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([]);
  });

  it('post-M1d §4: no registry known (list null) → empty, never a guess', () => {
    mockSendList.current = null;
    const {r, onReview} = setup(MAIN);
    tap(r);
    expect(onReview.mock.calls[0]![0].linksAccounts).toEqual([]);
  });

  // pin (passes before the change): #12 never imported the queue. It keeps a later edit from moving the write here.
  it('post-M1d §4: #12 itself writes nothing — the tag belongs to #21', () => {
    const {r} = setup(MAIN);
    tap(r);
    tap(r);
    expect(mockRecordLinks).not.toHaveBeenCalled();
  });
```

  with, next to the other mocks at the top of the file:

```ts
const mockRecordLinks = jest.fn(() => 0);
jest.mock('../../../modules/accounts/linkQueue', () => ({
  recordConfirmedSendLinks: (a: readonly string[]) => mockRecordLinks(a),
  drainLinkQueue: jest.fn(() => 0),
}));
```

  - In `'the intent carries the source (scheme, address, label, main) and the source's balances'` (`:148-162`), the
    expected object gains `linksAccounts: []`.

- [ ] **Step 5: Run, implement, run.** `npx jest src/screens/transparent/__tests__/SendScreen.test.tsx --forceExit`
      → FAIL. In `SendScreen.tsx` change the import to
      `import {linkedParticipants, linkingWarningApplies} from '../../modules/accounts/linking';` and add to the
      `onReview({...})` object, after `sourceBalances`:

```ts
      // post-M1d §4: the accounts this Send links, from the same registry read that showed the warning
      linksAccounts: accountList !== null ? linkedParticipants(accountList.seed, source.address, recipientAddress) : [],
```

      and add `accountList` and `recipientAddress` to `handleReview`'s dependency list. Run again → PASS.

- [ ] **Step 6: Write the failing #21 tests.** In `TransactionStatusScreen.test.tsx`, next to the other mocks:

```ts
// post-M1d §4: the tag write, observed here
const mockRecordLinks = jest.fn(() => 1);
jest.mock('../../../modules/accounts/linkQueue', () => ({
  recordConfirmedSendLinks: (a: readonly string[]) => mockRecordLinks(a),
}));
```

  and a describe (the `intent` fixture gained `linksAccounts: []` in Step 3):

```ts
describe('post-M1d §4 / P3 — the "linked" tag is written only on a confirmed Send', () => {
  const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
  const linking = {...intent, linksAccounts: [A3]};
  const screen = (i = linking) =>
    render(withSafeArea(<TransactionStatusScreen intent={i} onDashboard={jest.fn()} onViewDetails={jest.fn()} />));

  it('confirmed → written once, with the intent\'s accounts', async () => {
    const r = screen();
    await waitFor(() => expect(r.getByText('Sent successfully')).toBeTruthy());
    expect(mockRecordLinks).toHaveBeenCalledTimes(1);
    expect(mockRecordLinks).toHaveBeenCalledWith([A3]);
  });

  it('R14: a landed-but-failed Send (confirmed WITH err) → nothing written', async () => {
    mockSubmit.mockResolvedValueOnce({signature: 'S', lastValidBlockHeight: 1000});
    mockGetSignatureStatus.mockResolvedValueOnce({value: {confirmationStatus: 'confirmed', slot: 42, err: {x: 1}}});
    const r = screen();
    await waitFor(() => expect(r.getByText('Transaction failed')).toBeTruthy());
    expect(mockRecordLinks).not.toHaveBeenCalled(); // on chain, but it moved nothing we can call a confirmed Send
  });

  it('a failed submit → nothing written', async () => {
    mockSubmit.mockRejectedValueOnce(new Error('boom'));
    const r = screen();
    await waitFor(() => expect(r.getByTestId('tx-status-retry')).toBeTruthy());
    expect(mockRecordLinks).not.toHaveBeenCalled();
  });

  it('an unknown outcome (no status yet) → nothing written; R15: a late confirmation while mounted → written once', async () => {
    mockGetSignatureStatus.mockResolvedValue({value: null});
    const r = screen();
    await waitFor(() => expect(mockGetSignatureStatus.mock.calls.length).toBeGreaterThanOrEqual(2), {timeout: 4000});
    expect(mockRecordLinks).not.toHaveBeenCalled();
    mockGetSignatureStatus.mockResolvedValue({value: {confirmationStatus: 'confirmed', slot: 42}});
    await waitFor(() => expect(r.getByText('Sent successfully')).toBeTruthy(), {timeout: 4000});
    expect(mockRecordLinks).toHaveBeenCalledTimes(1);
  });

  it('cancel: unmounted before any confirmation → nothing written, also not afterwards', async () => {
    mockGetSignatureStatus.mockResolvedValue({value: null});
    const r = screen();
    await waitFor(() => expect(mockGetSignatureStatus).toHaveBeenCalled(), {timeout: 4000});
    r.unmount();
    mockGetSignatureStatus.mockResolvedValue({value: {confirmationStatus: 'confirmed', slot: 42}});
    await new Promise(res => setTimeout(res, 1200));
    expect(mockRecordLinks).not.toHaveBeenCalled();
  });

  it('a Send that links nothing → the queue is not touched', async () => {
    const r = screen({...intent, linksAccounts: []});
    await waitFor(() => expect(r.getByText('Sent successfully')).toBeTruthy());
    expect(mockRecordLinks).not.toHaveBeenCalled();
  });

  it('a tag write that throws never turns a successful Send into a failure', async () => {
    mockRecordLinks.mockImplementationOnce(() => {
      throw new Error('registry');
    });
    const r = screen();
    await waitFor(() => expect(r.getByText('Sent successfully')).toBeTruthy());
    expect(r.queryByText('Transaction failed')).toBeNull();
  });
});
```

  (The adopted-landed path — `findLandedSignature` — sets the same `stage === 'success'` and needs no row of its
  own: the effect keys on the stage, not on how it was reached.)

- [ ] **Step 7: Run, implement, run.** `npx jest src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx --forceExit`
      → FAIL. In `TransactionStatusScreen.tsx` import
      `import {recordConfirmedSendLinks} from '../../modules/accounts/linkQueue';` and add an effect after the
      existing success effect (`:128-133`):

```ts
  // post-M1d spec §4 (P3): a CONFIRMED Send between two accounts of this seed links them on chain — tag
  // every fresh-exit account taking part. Only here: 'success' is a confirmed/finalized status with no err
  // (or an adopted landed signature). Never on cancel, failure, a landed-but-failed tx (R14) or 'stuck';
  // a late confirmation tags only while this screen is mounted (R15). The write never fails the Send.
  const linksAccounts = intent.linksAccounts;
  useEffect(() => {
    if (stage !== 'success' || linksAccounts.length === 0) {
      return;
    }
    try {
      recordConfirmedSendLinks(linksAccounts);
    } catch {
      // the queue never throws; a mocked or broken one must not turn a successful Send into an error
    }
  }, [stage, linksAccounts]);
```

      Run again → PASS.

- [ ] **Step 8: Drain when the registry becomes writable (R2).** Tests first.

  `DashboardScreen.test.tsx` — add the mock next to the others and a test in the describe that presses
  `dashboard-avatar`:

```ts
const mockDrain = jest.fn(() => 0);
jest.mock('../../../modules/accounts/linkQueue', () => ({drainLinkQueue: () => mockDrain()}));
```

```ts
    it('post-M1d §4 / R2: opening the sheet drains the link queue BEFORE the list is re-read (the tag shows at once)', async () => {
      const r = await renderDashboard();
      mockRefreshAccounts.mockClear();
      await act(async () => {
        fireEvent.press(r.getByTestId('dashboard-avatar'));
      });
      expect(mockDrain).toHaveBeenCalledTimes(1);
      expect(mockDrain.mock.invocationCallOrder[0]!).toBeLessThan(mockRefreshAccounts.mock.invocationCallOrder[0]!);
    });
```

  `secureStorageSession.test.ts` — add the mock and a test (follow the file's existing unlock test for the setup):

```ts
const mockDrain = jest.fn(() => 0);
jest.mock('../../accounts/linkQueue', () => ({drainLinkQueue: () => mockDrain()}));
```

```ts
  it('post-M1d R2: unlock drains the link queue once, after the encrypted store is opened', async () => {
    // arrange as 'retrieves the seed and initializes the secure MMKV with the derived key'
    await unlockSecureStorage();
    expect(mockDrain).toHaveBeenCalledTimes(1);
    expect(initSecureMmkv).toHaveBeenCalledTimes(1);
    expect((initSecureMmkv as jest.Mock).mock.invocationCallOrder[0]!).toBeLessThan(mockDrain.mock.invocationCallOrder[0]!);
  });
```

  (`initSecureMmkv` is the mocked export of `instances` in that file; import it the way the file's other tests do.)

  Run both → FAIL. Implement:

  `DashboardScreen.tsx` `openAccounts`:

```ts
  const openAccounts = useCallback(() => {
    drainLinkQueue(); // post-M1d §4 / R2: a "linked" tag still queued is written before the list is read
    refreshAccountList();
```

  with `import {drainLinkQueue} from '../../modules/accounts/linkQueue';`.

  `secureStorageSession.ts` `unlockSecureStorage`, after `dropV1ShieldedLeftovers();`:

```ts
    drainLinkQueue(); // post-M1d R2: "linked" tags queued by an earlier process (never throws)
```

  with `import {drainLinkQueue} from '../accounts/linkQueue';`. Run both → PASS.

- [ ] **Step 9: Gates.** `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`.

- [ ] **Step 10: Commit.**

```bash
git add src/modules/accounts/linking.ts src/modules/accounts/__tests__/linking.test.ts src/types/transfer.ts \
  src/screens/transparent/SendScreen.tsx src/screens/transparent/TransactionStatusScreen.tsx \
  src/screens/transparent/__tests__ src/modules/solana/__tests__/transferRisk.test.ts \
  src/screens/dashboard src/modules/session
git commit -m "feat(accounts): a confirmed Send between own accounts tags every fresh-exit account taking part as linked"
```

---

### Task 8: #27 names the token, the recipient wallet and the direction; History with no account

Spec: §5, R8, R9, R11, R12, r2-6, Review Focus 2; §7 (History m1, the cached-rows row, the Navigator wiring).

**Files:**
- Create: `src/modules/solana/__tests__/fixtures/tx-test-to-outside.json`, `tx-test-to-main.json`,
  `tx-sol-transfer.json` (fetched, see Step 1)
- Create: `src/modules/solana/txDetail.ts`, `src/modules/solana/__tests__/txDetail.test.ts`
- Create: `src/modules/tokens/trustedSymbol.ts`, `src/modules/tokens/__tests__/trustedSymbol.test.ts`
- Create: `src/copy/transactions.ts`
- Modify: `src/modules/solana/queries.ts:1-5` (imports), `:132-228` (`TxDetail`, `getTransactionDetail`)
- Modify: `src/screens/transparent/TransactionDetailScreen.tsx:23-26`, `:84-114`, `:165-243`
- Modify: `src/screens/transparent/TransactionHistoryScreen.tsx:18-21`, `:174`, `:191-202`
- Modify: `src/app/Navigator.tsx:601-604`, `:613-621`, `:628-638`; `src/types/navigation.d.ts:67`
- Test: `src/modules/solana/__tests__/queries.test.ts:184-229`,
  `src/screens/transparent/__tests__/TransactionDetailScreen.test.tsx`,
  `src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx`,
  `src/app/__tests__/shieldedRoutes.test.tsx`

**Interfaces:**
- Consumes (Task 5): `CORE_TOKENS`' wSOL entry is `'wSOL'`. Nothing else.
- Produces:

```ts
// src/modules/solana/txDetail.ts
export interface TxTransfer {
  /** 'native' for SOL, else the mint; null when neither the instruction nor the token balances name one */
  mint: string | null;
  /** 'SOL', a symbol from a trusted source, or the short mint; '' only when `mint` is null */
  symbol: string;
  /** human, exact (BigInt-formatted); null when the decimals are not known — never a raw base-unit figure */
  amount: string | null;
  /** the WALLET the funds left (R12, review r1-10): `info.source` for SOL; for SPL the OWNER of the source token
   *  account, read from the token balances (post, then pre). Never the fee payer, and never `info.authority` — a
   *  delegate can move tokens it does not own. null when the response names no owner. */
  from: string | null;
  /** SPL only: who authorised the transfer (`info.authority`, else `info.multisigAuthority`); null for SOL or
   *  when absent. Equal to `from` for an ordinary send; different for a delegated one. */
  authority: string | null;
  /** SPL only: the source token account */
  fromTokenAccount: string | null;
  /** the recipient WALLET when the response names it; otherwise the destination token account */
  to: string;
  /** true when `to` is a token account (the response named no owner): the screen labels it "token account" */
  toIsTokenAccount: boolean;
  /** SPL only: the destination token account */
  toTokenAccount: string | null;
}
export interface TxDetail {
  signature: string;
  status: 'confirmed' | 'finalized' | 'failed';
  /** the first SOL or SPL transfer that is not the Noctura fee markup; null when the transaction has none */
  transfer: TxTransfer | null;
  /** accountKeys[0] — shown as "Fee payer" only when there is no transfer; never as "From" */
  feePayer: string;
  /** every account key that signed */
  signers: string[];
  feeLamports: bigint;
  slot: number;
  blockTime: number | null;
  memo: string | null;
}
export type TxDirection = 'sent' | 'received' | 'none';
export interface RawParsedTx { /* the fields read from getParsedTransaction — see the implementation */ }
export function parseTxDetail(tx: RawParsedTx, signature: string, symbolOf: (mint: string) => string): TxDetail;
export function txDirection(detail: TxDetail, account: string | null): TxDirection;

// src/modules/tokens/trustedSymbol.ts
export function shortMint(mint: string): string;      // "Ab12cd…ef34"
export function trustedSymbol(mint: string): string;  // R8 / r2-6

// src/modules/solana/queries.ts
export type {TxDetail} from './txDetail';              // the hook keeps importing it from queries
export async function getTransactionDetail(connection: Connection, signature: string): Promise<TxDetail | null>;

// src/copy/transactions.ts
export const TX_SENT = 'Sent';
export const TX_RECEIVED = 'Received';
export const TX_NEUTRAL = 'Transaction';
export const TX_TOKEN_ACCOUNT = 'token account';
export const TX_FEE_PAYER = 'Fee payer';
export const TX_AUTHORIZED_BY = 'Authorized by';

// navigation
SendStackParamList['TransactionDetail'] = {signature: string; account?: string};
// TransactionDetailScreen props: {signature: string; account: string | null; onBack: () => void}
// TransactionHistoryScreen props: onSelectTx: (signature: string, account: string) => void
```

**The direction rule (§5, R9, R12; review r1-2 and r1-10):**
- **A failed transaction has no direction.** `detail.status === 'failed'` → `none`, whatever the instructions say:
  it moved nothing, so "Sent" or "Received" would be a false claim. This is checked first.
- `sent` — there is a transfer, `account === transfer.from` (the wallet that owned the funds), and `account` is
  among `signers`.
- `received` — there is a transfer and `account === transfer.to` with `toIsTokenAccount === false`, or
  `account === transfer.toTokenAccount`.
- `none` — everything else, including `account === null`. The screen then reads "TRANSACTION" and claims no
  direction. `sent` wins when both hold (a transfer to oneself).

**A delegated SPL transfer (review r1-10).** The instruction's `authority` is whoever signed for the tokens — the
owner in an ordinary send, a delegate otherwise. "From" is therefore the source token account's **owner**, taken
from the token balances, and never `info.authority`. The owner did not sign a delegated transfer, so it is not
"sent" for the owner; the delegate does not own the funds, so it is not "sent" for the delegate either. When the
authority is not the owner (or the owner is unknown), the screen adds a row "Authorized by" with the authority.
- It is judged against the route's `account` only (R9) — the account whose history or #21 opened the detail — never
  against the live selection.

- [ ] **Step 1: Fetch the three real devnet responses (R11).** From the repo root. The files are the verbatim
      JSON-RPC responses; the tests read `.result`.

```bash
mkdir -p src/modules/solana/__tests__/fixtures
fetch_tx() {
  curl -sS --fail -m 30 https://api.devnet.solana.com -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTransaction\",\"params\":[\"$1\",{\"encoding\":\"jsonParsed\",\"maxSupportedTransactionVersion\":0}]}" \
    > "src/modules/solana/__tests__/fixtures/$2"
}
fetch_tx 5i53q9tRrCQUyoXjc41cBtW3gb9wcMeD7hspooqz3cPBmndWAXfWn5FXMMv2sCR2kjLMYakvFvWpobNzcSy6LGNZ tx-test-to-outside.json
fetch_tx QAgzVzY6RhvmFWTiCueAyPfQY3qkyjXVZXXBnbYd9KXfkua1JEHJvxxSEjJbiwvQ2bCupghhRnY6WuwdQMGqgNY tx-test-to-main.json
fetch_tx 2HWCCJQdfzmmgaw77i9JtXmVpjPTGxUqiZt9hkmFiMuCSMWtdtyToSobGbEhvsUbaSNEJtARq96GQFisvThYJWni tx-sol-transfer.json
node -e '
for (const f of ["tx-test-to-outside","tx-test-to-main","tx-sol-transfer"]) {
  const r = require("./src/modules/solana/__tests__/fixtures/" + f + ".json").result;
  if (!r) { console.error(f, "has no result"); process.exit(1); }
  console.log(f, r.slot, r.meta.err, r.transaction.message.instructions.map(i => i.parsed ? i.parsed.type : "-").join(","));
}'
node scripts/check-no-tge-date.mjs
```

  Expected output of the `node -e` check (verified against devnet on 2026-11-22 while writing this plan):

```
tx-test-to-outside 525079736 null -,-,transferChecked
tx-test-to-main 525080588 null -,-,transferChecked
tx-sol-transfer 525082222 null -,-,transfer
```

  What they are (do not retype these into the fixtures; they are for the tests' expectations):

| Fixture | What happened | Facts the tests assert |
|---|---|---|
| `tx-test-to-outside.json` | 0.0005 TEST from `9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4` to the outside wallet `EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk` | `transferChecked`; authority `9Y7Ftt…`; source token account `3WzwveDj8C6AGyiq5T13SeffM6HaP2zuc4rH1oW6QNu2` (index 1); destination token account `75wGzeQ18yn9Jyf9EhoXjPG4ry9xFni38RcJxScGVoqT` (index 2), whose `postTokenBalances` owner is `EfHSPx…`; mint `ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs`, 9 decimals; fee 7000 |
| `tx-test-to-main.json` | 0.0002 TEST from `9Y7Ftt…` to the main account `Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B` | destination token account `A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7`, owner `Da83cA…`; fee 7000 |
| `tx-sol-transfer.json` | 5000 lamports (0.000005 SOL) from `5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7` to `EfHSPx…` | `system` `transfer`; no token balances; fee 5050 |

  If a response has no `result` (the public RPC pruned it or rate-limited), stop and report — do not hand-write a
  fixture. The mint `ERkpCFGa…` must equal `A0_TOKEN.mint` (`src/modules/shielded/a0/screenSupport.ts:19`); test P1
  asserts it.

- [ ] **Step 2: Write the failing symbol tests.** `src/modules/tokens/__tests__/trustedSymbol.test.ts`:

```ts
/** post-M1d R8 / r2-6: a symbol on #27 comes only from CORE_TOKENS, A0_TOKEN, or the DAS cache for a mint that
 *  passes classifyToken ('verified'). Anything else is the short mint — a scam mint may call itself "USDC". */
const mockFeatures = {shielded: true};
jest.mock('../../../constants/features', () => ({isShieldedEnabled: () => mockFeatures.shielded}));
const mockCache: {current: Record<string, {name: string; symbol: string}>} = {current: {}};
jest.mock('../tokenMetadata', () => ({loadCachedMetadata: () => mockCache.current}));
const mockClassify = jest.fn((_mint: string): 'core' | 'verified' | 'unknown' => 'unknown');
jest.mock('../tokenModule', () => ({
  TokenManager: jest.fn().mockImplementation(() => ({classifyToken: (m: string) => mockClassify(m)})),
}));

import {shortMint, trustedSymbol} from '../trustedSymbol';
import {A0_TOKEN} from '../../shielded/a0/screenSupport';
import {NOC_MINT} from '../../../constants/programs';

const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const WSOL = 'So11111111111111111111111111111111111111112';
const BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263';
const SCAM = 'ScamMint1111111111111111111111111111111111';

beforeEach(() => {
  mockFeatures.shielded = true;
  mockCache.current = {};
  mockClassify.mockReset().mockReturnValue('unknown');
});

it('native and the core tokens', () => {
  expect(trustedSymbol('native')).toBe('SOL');
  expect(trustedSymbol(NOC_MINT)).toBe('NOC');
  expect(trustedSymbol(USDC)).toBe('USDC');
  expect(trustedSymbol(WSOL)).toBe('wSOL');
});

it('the pool token is "TEST" where private balances exist; elsewhere the short mint', () => {
  expect(trustedSymbol(A0_TOKEN.mint)).toBe('TEST');
  mockFeatures.shielded = false;
  expect(trustedSymbol(A0_TOKEN.mint)).toBe(shortMint(A0_TOKEN.mint));
});

it('r2-6: a verified mint takes its symbol from the DAS cache', () => {
  mockClassify.mockReturnValue('verified');
  mockCache.current = {[BONK]: {name: 'Bonk', symbol: 'BONK'}};
  expect(trustedSymbol(BONK)).toBe('BONK');
});

// Y3 (Review Focus 2)
it('R8: an UNVERIFIED mint that calls itself "USDC" in the DAS cache shows its short mint, never "USDC"', () => {
  mockCache.current = {[SCAM]: {name: 'USD Coin', symbol: 'USDC'}};
  expect(trustedSymbol(SCAM)).toBe('ScamMi…1111');
  expect(trustedSymbol(SCAM)).not.toContain('USDC');
});

it('a verified mint with no cached symbol, or a blank one → the short mint (never "")', () => {
  mockClassify.mockReturnValue('verified');
  expect(trustedSymbol(BONK)).toBe('DezXAZ…B263');
  mockCache.current = {[BONK]: {name: 'Bonk', symbol: '  '}};
  expect(trustedSymbol(BONK)).toBe('DezXAZ…B263');
});

it('shortMint: first 6 … last 4; a short string is left whole', () => {
  expect(shortMint(BONK)).toBe('DezXAZ…B263');
  expect(shortMint('abc')).toBe('abc');
});
```

- [ ] **Step 3: Run, implement, run.** `npx jest src/modules/tokens/__tests__/trustedSymbol.test.ts --forceExit` →
      FAIL. Create `src/modules/tokens/trustedSymbol.ts`:

```ts
/**
 * post-M1d spec §5, R8, r2-6: the ONLY source of a token symbol on the transaction detail (#27). A
 * symbol is shown only when it comes from CORE_TOKENS, from the pool token (A0_TOKEN, where private
 * balances exist), or from the DAS metadata cache for a mint that passes `classifyToken` as
 * 'verified' (the Jupiter list; the DAS cache has no verified flag of its own). Anything else is the
 * short mint: an unverified mint may call itself "USDC". If the verified list is not loaded yet, a
 * verified mint reads as its short mint — fail closed. No request is made here.
 */
import {CORE_TOKENS} from './coreTokens';
import {TokenManager} from './tokenModule';
import {loadCachedMetadata} from './tokenMetadata';
import {A0_TOKEN} from '../shielded/a0/screenSupport';
import {isShieldedEnabled} from '../../constants/features';

const tokenManager = new TokenManager();

/** "Ab12cd…ef34" */
export function shortMint(mint: string): string {
  return mint.length <= 11 ? mint : `${mint.slice(0, 6)}…${mint.slice(-4)}`;
}

export function trustedSymbol(mint: string): string {
  if (mint === 'native') {
    return 'SOL';
  }
  const core = CORE_TOKENS.find(t => t.mint === mint);
  if (core) {
    return core.symbol;
  }
  if (isShieldedEnabled() && mint === A0_TOKEN.mint) {
    return A0_TOKEN.symbol;
  }
  if (tokenManager.classifyToken(mint) === 'verified') {
    const symbol = loadCachedMetadata()[mint]?.symbol;
    if (typeof symbol === 'string' && symbol.trim() !== '') {
      return symbol.trim();
    }
  }
  return shortMint(mint);
}
```

      Run again → PASS.

- [ ] **Step 4: Write the failing parser tests.** `src/modules/solana/__tests__/txDetail.test.ts`:

```ts
/**
 * post-M1d spec §5, R9, R11, R12: #27's parser against REAL devnet getTransaction (jsonParsed) responses —
 * fixtures/*.json are the verbatim RPC responses (see the plan's Task 8 Step 1 for how they were fetched).
 * Derived cases (no owner, a plain `transfer`) are made from a real response by removing exactly the
 * fields a node may omit; each says what it removed.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {parseTxDetail, txDirection} from '../txDetail';
import type {RawParsedTx} from '../txDetail';
import {A0_TOKEN} from '../../shielded/a0/screenSupport';
import {NOCTURA_FEE_TREASURY} from '../../../constants/programs';

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as {result: RawParsedTx}).result;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const ACC_9Y = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const OUTSIDE = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const SOL_SENDER = '5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7';
const SRC_TA = '3WzwveDj8C6AGyiq5T13SeffM6HaP2zuc4rH1oW6QNu2';
const OUTSIDE_TA = '75wGzeQ18yn9Jyf9EhoXjPG4ry9xFni38RcJxScGVoqT';
const MAIN_TA = 'A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7';
const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const DELEGATE = 'DELEGATExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // any other key: it is only compared

/** the symbol source is injected: these tests pin the parser, trustedSymbol.test.ts pins the symbols */
const symbolOf = (mint: string): string => (mint === TEST_MINT ? 'TEST' : mint === 'native' ? 'SOL' : `short(${mint.slice(0, 4)})`);

// P1
it('the fixtures\' mint is the pool token', () => {
  expect(A0_TOKEN.mint).toBe(TEST_MINT);
});

// P2
it('a SOL transfer (2HWCCJQd…): amount, sender = the transfer\'s source, recipient wallet', () => {
  const d = parseTxDetail(load('tx-sol-transfer.json'), 'SIG', symbolOf);
  expect(d.transfer).toEqual({
    mint: 'native', symbol: 'SOL', amount: '0.000005',
    from: SOL_SENDER, authority: null, fromTokenAccount: null,
    to: OUTSIDE, toIsTokenAccount: false, toTokenAccount: null,
  });
  expect(d).toMatchObject({signature: 'SIG', status: 'confirmed', feeLamports: 5050n, slot: 525082222, feePayer: SOL_SENDER, signers: [SOL_SENDER], memo: null});
  expect(d.blockTime).toEqual(expect.any(Number));
});

// P3
it('an SPL send with the owner present (5i53q9tR…): the symbol, and the recipient WALLET — not the token account', () => {
  const d = parseTxDetail(load('tx-test-to-outside.json'), 'SIG', symbolOf);
  expect(d.transfer).toEqual({
    mint: TEST_MINT, symbol: 'TEST', amount: '0.0005',
    from: ACC_9Y, authority: ACC_9Y, fromTokenAccount: SRC_TA, // the owner of 3Wzwve… and the signer are one key here
    to: OUTSIDE, toIsTokenAccount: false, toTokenAccount: OUTSIDE_TA,
  });
  expect(d.feeLamports).toBe(7000n);
});

it('the phone-pass transaction (QAgzVzY6…): 0.0002 TEST, TO = the main wallet', () => {
  const d = parseTxDetail(load('tx-test-to-main.json'), 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({symbol: 'TEST', amount: '0.0002', from: ACC_9Y, to: MAIN, toIsTokenAccount: false, toTokenAccount: MAIN_TA});
});

// P4 (Review Focus 2)
it('R11: no owner in the response → the token account, flagged — never passed off as the wallet', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
    delete b.owner; // removed: `owner` (older nodes omit it)
  }
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({to: OUTSIDE_TA, toIsTokenAccount: true, toTokenAccount: OUTSIDE_TA, symbol: 'TEST', amount: '0.0005'});
  // review r1-10: with no owner the sender WALLET is not known either — the authority is shown as what it is
  expect(d.transfer).toMatchObject({from: null, authority: ACC_9Y});
  expect(txDirection(d, ACC_9Y)).toBe('none');
});

// P5 (Review Focus 2)
it('R11: a plain `transfer` carries no mint and a RAW amount → mint and decimals from postTokenBalances by account index', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {type: string; info: Record<string, unknown>}}>).find(i => i.parsed?.type === 'transferChecked')!;
  ix.parsed!.type = 'transfer'; // the shape of spl-token `transfer`: {amount, authority, destination, source}
  ix.parsed!.info = {amount: '500000', authority: ACC_9Y, destination: OUTSIDE_TA, source: SRC_TA};
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({mint: TEST_MINT, symbol: 'TEST', amount: '0.0005', to: OUTSIDE, toIsTokenAccount: false});
});

// P7 (Review Focus 2)
it('a plain `transfer` with no token balances at all → no mint, no symbol, NO amount (never "500000" as a human figure)', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {type: string; info: Record<string, unknown>}}>).find(i => i.parsed?.type === 'transferChecked')!;
  ix.parsed!.type = 'transfer';
  ix.parsed!.info = {amount: '500000', authority: ACC_9Y, destination: OUTSIDE_TA, source: SRC_TA};
  tx.meta!.postTokenBalances = []; // removed: every token balance
  tx.meta!.preTokenBalances = [];
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({mint: null, symbol: '', amount: null, to: OUTSIDE_TA, toIsTokenAccount: true, from: null, authority: ACC_9Y});
});

it('R12: the sender is the owner of the source token account, never the fee payer (a relayed transaction)', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  const RELAYER = 'RELAYERxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // any other key: it is only compared
  const keys = tx.transaction!.message!.accountKeys!;
  keys.unshift({pubkey: RELAYER, signer: true, writable: true}); // a relayer pays the fee: it becomes key 0
  for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
    b.accountIndex = (b.accountIndex ?? 0) + 1; // every index moves by one
  }
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.feePayer).toBe(RELAYER);
  expect(d.transfer!.from).toBe(ACC_9Y);
  expect(d.transfer!.to).toBe(OUTSIDE); // still matched by the (moved) account index
  expect(d.signers).toEqual([RELAYER, ACC_9Y]);
});

it('R12: no authority in the instruction → the owner is still the sender; a multisigAuthority is read as the authority', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {info: Record<string, unknown>}}>).find(i => i.parsed?.info?.authority)!;
  delete ix.parsed!.info.authority; // removed: `authority`
  expect(parseTxDetail(tx, 'SIG', symbolOf).transfer).toMatchObject({from: ACC_9Y, authority: null});
  ix.parsed!.info.multisigAuthority = 'MULTISIGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // the multisig shape names this instead
  expect(parseTxDetail(tx, 'SIG', symbolOf).transfer).toMatchObject({from: ACC_9Y, authority: 'MULTISIGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'});
});

/**
 * review r1-10 — the DELEGATED variant, derived from the real 5i53q9tR… response by changing exactly what a
 * delegated transfer changes: the instruction's `authority` is the delegate, the delegate signs (and pays), and
 * the owner 9Y7Ftt… does not sign. The token balances — and so the owner of the source account — are untouched.
 */
function delegated(): RawParsedTx {
  const tx = clone(load('tx-test-to-outside.json'));
  const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {info: Record<string, unknown>}}>).find(i => i.parsed?.info?.authority)!;
  ix.parsed!.info.authority = DELEGATE;
  const keys = tx.transaction!.message!.accountKeys!;
  keys.find(k => k.pubkey === ACC_9Y)!.signer = false; // the owner did not sign
  keys.unshift({pubkey: DELEGATE, signer: true, writable: true}); // the delegate signs and pays: key 0
  for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
    b.accountIndex = (b.accountIndex ?? 0) + 1;
  }
  return tx;
}

it('review r1-10: a delegated transfer — From is the OWNER of the source account, not the authority', () => {
  const d = parseTxDetail(delegated(), 'SIG', symbolOf);
  expect(d.transfer).toMatchObject({from: ACC_9Y, authority: DELEGATE, fromTokenAccount: SRC_TA, to: OUTSIDE, amount: '0.0005'});
  expect(d.signers).toEqual([DELEGATE]);
});

it('review r1-10: a delegated transfer is "sent" for nobody — not the owner (it did not sign), not the delegate (not its funds)', () => {
  const d = parseTxDetail(delegated(), 'SIG', symbolOf);
  expect(txDirection(d, ACC_9Y)).toBe('none');
  expect(txDirection(d, DELEGATE)).toBe('none');
  expect(txDirection(d, OUTSIDE)).toBe('received'); // the recipient's view is unchanged
});

it('review r1-10: the owner is read from preTokenBalances when the post entry is missing (a source account closed in the same transaction)', () => {
  const tx = clone(load('tx-test-to-outside.json'));
  tx.meta!.postTokenBalances = (tx.meta!.postTokenBalances ?? []).filter(b => b.accountIndex !== 1); // removed: the source's post entry
  expect(parseTxDetail(tx, 'SIG', symbolOf).transfer!.from).toBe(ACC_9Y);
});

it('account keys given as PublicKey-like objects (what web3.js returns) are read by toString', () => {
  const tx = clone(load('tx-sol-transfer.json'));
  const keys = tx.transaction!.message!.accountKeys! as Array<{pubkey: unknown}>;
  for (const k of keys) {
    const s = k.pubkey as string;
    k.pubkey = {toString: () => s};
  }
  const d = parseTxDetail(tx, 'SIG', symbolOf);
  expect(d.feePayer).toBe(SOL_SENDER);
  expect(d.signers).toEqual([SOL_SENDER]);
});

it('the Noctura fee-markup transfer is skipped; a failed transaction is "failed"; no transfer → transfer null', () => {
  const tx = clone(load('tx-sol-transfer.json'));
  const ixs = tx.transaction!.message!.instructions as unknown[];
  ixs.unshift({program: 'system', parsed: {type: 'transfer', info: {source: SOL_SENDER, destination: NOCTURA_FEE_TREASURY, lamports: 20000}}});
  expect(parseTxDetail(tx, 'SIG', symbolOf).transfer!.to).toBe(OUTSIDE);
  tx.meta!.err = {InstructionError: [0, 'X']};
  expect(parseTxDetail(tx, 'SIG', symbolOf).status).toBe('failed');
  tx.transaction!.message!.instructions = [];
  const none = parseTxDetail(tx, 'SIG', symbolOf);
  expect(none.transfer).toBeNull();
  expect(none.feePayer).toBe(SOL_SENDER);
});

describe('txDirection — judged against the route\'s account only (R9)', () => {
  const toOutside = () => parseTxDetail(load('tx-test-to-outside.json'), 'SIG', symbolOf);
  const toMain = () => parseTxDetail(load('tx-test-to-main.json'), 'SIG', symbolOf);
  const sol = () => parseTxDetail(load('tx-sol-transfer.json'), 'SIG', symbolOf);

  it('sent: the account is the transfer\'s source and signed', () => {
    expect(txDirection(toOutside(), ACC_9Y)).toBe('sent');
    expect(txDirection(sol(), SOL_SENDER)).toBe('sent');
  });
  it('received: the account is the recipient wallet, or the destination token account', () => {
    expect(txDirection(toMain(), MAIN)).toBe('received');
    expect(txDirection(sol(), OUTSIDE)).toBe('received');
    expect(txDirection(toMain(), MAIN_TA)).toBe('received');
  });
  it('third party: an account that is neither end → none (no direction claimed)', () => {
    expect(txDirection(sol(), ACC_9Y)).toBe('none');
    expect(txDirection(toOutside(), MAIN)).toBe('none');
  });
  it('no account (a deep link), or no transfer → none', () => {
    expect(txDirection(toOutside(), null)).toBe('none');
    const tx = clone(load('tx-sol-transfer.json'));
    tx.transaction!.message!.instructions = [];
    expect(txDirection(parseTxDetail(tx, 'SIG', symbolOf), SOL_SENDER)).toBe('none');
  });
  // review r1-2
  it('a FAILED transaction has no direction — for the sender, the recipient, anyone (it moved nothing)', () => {
    const failed = (name: string) => {
      const tx = clone(load(name));
      tx.meta!.err = {InstructionError: [2, {Custom: 1}]}; // changed: `meta.err` only
      return parseTxDetail(tx, 'SIG', symbolOf);
    };
    expect(failed('tx-test-to-outside.json').status).toBe('failed');
    expect(failed('tx-test-to-outside.json').transfer).not.toBeNull(); // the transfer is still parsed: only the claim goes
    expect(txDirection(failed('tx-test-to-outside.json'), ACC_9Y)).toBe('none');
    expect(txDirection(failed('tx-test-to-main.json'), MAIN)).toBe('none');
    expect(txDirection(failed('tx-sol-transfer.json'), SOL_SENDER)).toBe('none');
    expect(txDirection(failed('tx-sol-transfer.json'), OUTSIDE)).toBe('none');
  });
  it('the source that did NOT sign is not "sent" (a delegate moved the tokens)', () => {
    const d = toOutside();
    expect(txDirection({...d, signers: []}, ACC_9Y)).toBe('none');
  });
  it('the owner unknown: the wallet cannot be recognised as the recipient → none, never a guess', () => {
    const tx = clone(load('tx-test-to-main.json'));
    for (const b of [...(tx.meta!.postTokenBalances ?? []), ...(tx.meta!.preTokenBalances ?? [])]) {
      delete b.owner;
    }
    expect(txDirection(parseTxDetail(tx, 'SIG', symbolOf), MAIN)).toBe('none');
  });
  it('a transfer to oneself reads "sent"', () => {
    const d = sol();
    expect(txDirection({...d, transfer: {...d.transfer!, to: SOL_SENDER}}, SOL_SENDER)).toBe('sent');
  });
});
```

- [ ] **Step 5: Run it.** `npx jest src/modules/solana/__tests__/txDetail.test.ts --forceExit`
      Expected: FAIL — the module does not exist.

- [ ] **Step 6: Implement the parser.** Create `src/modules/solana/txDetail.ts` with the two interfaces and the type
      from **Interfaces**, then:

```ts
/**
 * post-M1d spec §5 (R9, R11, R12): one parsed transaction → what #27 shows. Pure: the RPC response and
 * the symbol source are handed in. Best effort — a field the response does not carry stays null; it is
 * never filled with a guess (a token account is never called the wallet; a base-unit amount is never
 * shown as a human one).
 *
 * R11: the mint, decimals and owner of an SPL transfer are read from `meta.postTokenBalances` (the pre
 * entry only when an account has no post one), matched by the token account's index in `accountKeys`. A plain `transfer` carries no mint; `transferChecked`
 * carries it, and the instruction's own values win when present.
 * R12 (as corrected by plan review r1-10): "from" is the wallet the funds left — `info.source` (SOL); the
 * OWNER of the source token account, from the token balances (SPL). `info.authority` is kept apart as
 * `authority`: it is the owner in an ordinary send and a delegate in a delegated one. Never the fee payer,
 * which is a relayer for a relayed transaction. A failed transaction has no direction (r1-2).
 */
import {NOCTURA_FEE_TREASURY} from '../../constants/programs';
import {formatTokenAmount} from '../../utils/parseTokenAmount';

export interface RawTokenBalance {
  accountIndex?: number;
  mint?: string;
  owner?: string;
  uiTokenAmount?: {decimals?: number};
}

export interface RawParsedTx {
  slot?: number;
  blockTime?: number | null;
  meta?: {
    fee?: number;
    err?: unknown;
    preTokenBalances?: RawTokenBalance[] | null;
    postTokenBalances?: RawTokenBalance[] | null;
  } | null;
  transaction?: {
    message?: {
      accountKeys?: Array<{pubkey?: unknown; signer?: boolean; writable?: boolean}>;
      instructions?: unknown[];
    };
  };
}

interface RawInstruction {
  program?: string;
  parsed?: {type?: string; info?: Record<string, unknown>} | string;
}

const SOL_DECIMALS = 9;

function keyString(k: unknown): string {
  if (typeof k === 'string') {
    return k;
  }
  if (k !== null && typeof k === 'object' && typeof (k as {toString?: unknown}).toString === 'function') {
    return (k as {toString: () => string}).toString();
  }
  return '';
}

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** A base-unit amount as BigInt: a decimal string or a safe non-negative integer; anything else is not an amount. */
function toBaseUnits(v: unknown): bigint | null {
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    return BigInt(v);
  }
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) {
    return BigInt(v);
  }
  return null;
}

export function parseTxDetail(tx: RawParsedTx, signature: string, symbolOf: (mint: string) => string): TxDetail {
  const meta = tx.meta ?? {};
  const keys = (tx.transaction?.message?.accountKeys ?? []).map(k => ({address: keyString(k.pubkey), signer: k.signer === true}));
  const postBalances = meta.postTokenBalances ?? [];
  const preBalances = meta.preTokenBalances ?? [];
  /**
   * R11: a token account's balance entry, matched by its index among the account keys. The POST entry
   * first; the PRE entry only when there is no post one (an account closed in this transaction) — its
   * mint, decimals and owner are the same account's (review r1-10).
   */
  const balanceOf = (tokenAccount: string | null): RawTokenBalance | undefined => {
    if (tokenAccount === null) {
      return undefined;
    }
    const index = keys.findIndex(k => k.address === tokenAccount);
    if (index < 0) {
      return undefined;
    }
    return postBalances.find(b => b.accountIndex === index) ?? preBalances.find(b => b.accountIndex === index);
  };

  let transfer: TxTransfer | null = null;
  let memo: string | null = null;

  for (const ix of (tx.transaction?.message?.instructions ?? []) as RawInstruction[]) {
    if (ix.program === 'spl-memo') {
      memo = typeof ix.parsed === 'string' ? ix.parsed : memo;
      continue;
    }
    if (transfer !== null) {
      continue;
    }
    const parsed = typeof ix.parsed === 'object' && ix.parsed !== null ? ix.parsed : undefined;
    const info = parsed?.info ?? {};
    const destination = str(info.destination);
    if (destination === null || destination === NOCTURA_FEE_TREASURY) {
      continue;
    }
    if (ix.program === 'system' && parsed?.type === 'transfer') {
      const lamports = toBaseUnits(info.lamports);
      transfer = {
        mint: 'native',
        symbol: symbolOf('native'),
        amount: lamports !== null ? formatTokenAmount(lamports, SOL_DECIMALS) : null,
        from: str(info.source),
        authority: null,
        fromTokenAccount: null,
        to: destination,
        toIsTokenAccount: false,
        toTokenAccount: null,
      };
    } else if (ix.program === 'spl-token' && (parsed?.type === 'transferChecked' || parsed?.type === 'transfer')) {
      const source = str(info.source);
      const dest = balanceOf(destination);
      const src = balanceOf(source);
      const tokenAmount =
        info.tokenAmount !== null && typeof info.tokenAmount === 'object'
          ? (info.tokenAmount as {amount?: unknown; decimals?: unknown})
          : undefined;
      const mint = str(info.mint) ?? str(dest?.mint) ?? str(src?.mint);
      const decimalsRaw = tokenAmount?.decimals ?? dest?.uiTokenAmount?.decimals ?? src?.uiTokenAmount?.decimals;
      const decimals = typeof decimalsRaw === 'number' && Number.isInteger(decimalsRaw) && decimalsRaw >= 0 ? decimalsRaw : null;
      const baseUnits = toBaseUnits(tokenAmount?.amount ?? info.amount);
      const owner = str(dest?.owner);
      transfer = {
        mint,
        symbol: mint !== null ? symbolOf(mint) : '',
        // never a raw figure: without the decimals there is no human amount
        amount: baseUnits !== null && decimals !== null ? formatTokenAmount(baseUnits, decimals) : null,
        // review r1-10: the funds' OWNER — never `info.authority`, which is a delegate in a delegated transfer.
        // With no owner in the response the sender wallet is not known: null, and the authority is shown apart.
        from: str(src?.owner),
        authority: str(info.authority) ?? str(info.multisigAuthority),
        fromTokenAccount: source,
        to: owner ?? destination,
        toIsTokenAccount: owner === null,
        toTokenAccount: destination,
      };
    }
  }

  return {
    signature,
    status: meta.err ? 'failed' : 'confirmed',
    transfer,
    feePayer: keys[0]?.address ?? '',
    signers: keys.filter(k => k.signer && k.address !== '').map(k => k.address),
    feeLamports: BigInt(meta.fee ?? 0),
    slot: tx.slot ?? 0,
    blockTime: tx.blockTime ?? null,
    memo,
  };
}

/** §5 / R9: judged against ONE address — the account whose history or #21 the detail was opened from. */
export function txDirection(detail: TxDetail, account: string | null): TxDirection {
  const t = detail.transfer;
  // review r1-2: a failed transaction moved nothing — no direction is claimed, whoever looks at it
  if (detail.status === 'failed' || account === null || t === null) {
    return 'none';
  }
  // review r1-10: `from` is the owner of the funds; it must also have signed (a delegate's move is not "sent")
  if (t.from === account && detail.signers.includes(account)) {
    return 'sent';
  }
  if ((t.to === account && !t.toIsTokenAccount) || t.toTokenAccount === account) {
    return 'received';
  }
  return 'none';
}
```

  Note the memo change: today's code reads `ix.parsed?.info` as a string for a non-string memo (`queries.ts:186-189`),
  a cast that can put an object on screen. The parser keeps a string memo only.

- [ ] **Step 7: Run it.** The Step 5 command. Expected: PASS.

- [ ] **Step 8: Make `getTransactionDetail` delegate.** In `queries.ts`:
  - delete the `TxDetail` interface (`:132-144`) and replace the whole body of `getTransactionDetail` (`:151-228`):

```ts
export type {TxDetail} from './txDetail';

/**
 * Fetch and parse a single transaction for the detail screen (#27). The parsing is `parseTxDetail`
 * (post-M1d §5) with the trusted symbol source. Returns null when the RPC has not indexed the
 * signature yet (the caller retries).
 */
export async function getTransactionDetail(connection: Connection, signature: string): Promise<TxDetail | null> {
  // R11: the cast names exactly the fields parseTxDetail reads (RawParsedTx), token balances included
  const tx = (await connection.getParsedTransaction(signature, {
    maxSupportedTransactionVersion: 0,
  })) as unknown as RawParsedTx | null;
  if (!tx) {
    return null;
  }
  return parseTxDetail(tx, signature, trustedSymbol);
}
```

  - imports: add `import {parseTxDetail} from './txDetail'; import type {RawParsedTx, TxDetail} from './txDetail';`
    and `import {trustedSymbol} from '../tokens/trustedSymbol';`; remove `NOC_MINT`, `NOCTURA_FEE_TREASURY` and
    `formatTokenAmount` from this file's imports if nothing else in it uses them (`tsc` and lint will say).
  - `queries.test.ts:206-229` — **change** the first test's assertions to the new shape (comment
    `// post-M1d §5: TxDetail.transfer replaces the flat from/to/amount/tokenSymbol/type`):

```ts
    expect(d!.transfer).toMatchObject({from: 'SENDER_ADDR', authority: null, to: 'RECIPIENT_ADDR', amount: '0.01', symbol: 'SOL', mint: 'native'});
    expect(d!.feePayer).toBe('SENDER_ADDR');
    expect(d!.feeLamports).toBe(5005n);
    expect(d!.slot).toBe(271_408_924);
    expect(d!.status).toBe('confirmed');
```

  Run `npx jest src/modules/solana/__tests__/queries.test.ts --forceExit` → PASS.

- [ ] **Step 9: Write the failing #27 screen tests.** In `TransactionDetailScreen.test.tsx`:
  - replace the `detail` fixture with the new shape, and make it switchable:

```ts
const SENT_SPL = {
  signature: 'SIG12345678ABCDEFGHIJ', status: 'confirmed' as const,
  transfer: {
    mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs', symbol: 'TEST', amount: '0.0002',
    from: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4', authority: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4',
    fromTokenAccount: '3WzwveDj8C6AGyiq5T13SeffM6HaP2zuc4rH1oW6QNu2',
    to: 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B', toIsTokenAccount: false, toTokenAccount: 'A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7',
  },
  feePayer: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4', signers: ['9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4'],
  feeLamports: 7000n, slot: 525080588, blockTime: 1760000000, memo: null,
};
const mockDetail: {current: unknown} = {current: SENT_SPL};
jest.mock('../../../hooks/useSolanaQueries', () => ({
  useTransactionDetail: jest.fn(() => ({data: mockDetail.current, isLoading: false})),
}));
```

    (the loading and not-found tests in the file set their own return through `useTransactionDetail`'s mock as they
    do today; add `beforeEach(() => { mockDetail.current = SENT_SPL; })`.)
  - every existing `render(<TransactionDetailScreen signature=… onBack=… />)` gains `account={ACC}` where
    `const ACC = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';`. Existing assertions on `'0.01 SOL'` and the Type
    row `'Send'` change to the new fixture's values, each with `// post-M1d §5`: `getByText('0.0002 TEST')`, and
    `expect(getAllByText('Sent')).toHaveLength(2)` (the hero word and the Type row now read the same word — a bare
    `getByText('Sent')` would throw on two matches).
  - add:

```ts
describe('post-M1d §5 — #27 names the token, the wallet and the direction', () => {
  const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
  const screen = (account: string | null) =>
    render(withSafeArea(<TransactionDetailScreen signature="SIG12345678ABCDEFGHIJ" account={account} onBack={jest.fn()} />));

  it('the phone-pass case: "Sent", "0.0002 TEST", TO = the main wallet (not the token account)', () => {
    const r = screen(ACC);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.0002 TEST');
    expect(r.getByTestId('tx-detail-to')).toHaveTextContent(/^Da83/); // the wallet's head
    expect(r.queryByText('token account')).toBeNull();
    expect(r.getByTestId('tx-detail-to')).not.toHaveTextContent(/A3hW/); // never the token account's head
  });

  it('R9: the same transaction opened from the MAIN account reads "Received"', () => {
    expect(screen(MAIN).getByTestId('tx-detail-direction')).toHaveTextContent('Received');
  });

  it('a third party, or no account (a deep link) → "Transaction": no direction claimed', () => {
    expect(screen('EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk').getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
    expect(screen(null).getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
  });

  it('R11: the owner unknown → the token account, labelled "token account"; it is not offered as a contact', () => {
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, to: SENT_SPL.transfer.toTokenAccount, toIsTokenAccount: true}};
    const r = screen(ACC);
    expect(r.getByText('token account')).toBeTruthy();
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  it('R8: an untrusted mint shows whatever symbol the parser resolved (the short mint) after the amount', () => {
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, symbol: 'ScamMi…1111'}};
    expect(screen(ACC).getByTestId('tx-detail-amount')).toHaveTextContent('0.0002 ScamMi…1111');
  });

  it('no human amount known → "—", never a raw figure', () => {
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, amount: null, symbol: '', mint: null}};
    expect(screen(ACC).getByTestId('tx-detail-amount')).toHaveTextContent('—');
  });

  it('R12: no transfer → the row reads "Fee payer", never "From"; no To, no contact button', () => {
    mockDetail.current = {...SENT_SPL, transfer: null};
    const r = screen(ACC);
    expect(r.getByText('Fee payer')).toBeTruthy();
    expect(r.queryByText('From')).toBeNull();
    expect(r.queryByText('Save to address book')).toBeNull();
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
  });

  it('review r1-2: a FAILED transaction reads "Transaction" for its own sender — never "Sent"; the Failed pill shows', () => {
    mockDetail.current = {...SENT_SPL, status: 'failed' as const};
    const r = screen(ACC);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
    expect(r.queryByText('Sent')).toBeNull();
    expect(r.getAllByText('Failed').length).toBeGreaterThan(0);
  });

  it('review r1-10: an ordinary send (authority = owner) has no "Authorized by" row', () => {
    expect(screen(ACC).queryByText('Authorized by')).toBeNull();
  });

  it('review r1-10: a delegated transfer shows the owner as From and adds "Authorized by <the delegate>"; not "Sent" for the owner', () => {
    const DELEGATE = 'DLGTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, authority: DELEGATE}, signers: [DELEGATE], feePayer: DELEGATE};
    const r = screen(ACC);
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent(/^9Y7Ftt/); // the owner
    expect(r.getByText('Authorized by')).toBeTruthy();
    expect(r.getByTestId('tx-detail-authority')).toHaveTextContent(/^DLGTxx/);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
  });

  it('review r1-10: the owner unknown → From "—", and the authority is shown as "Authorized by", not as From', () => {
    mockDetail.current = {...SENT_SPL, transfer: {...SENT_SPL.transfer, from: null}};
    const r = screen(ACC);
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent('—');
    expect(r.getByTestId('tx-detail-authority')).toHaveTextContent(/^9Y7Ftt/);
  });

  it('a received transaction does not offer to save one\'s own account as a contact', () => {
    expect(screen(MAIN).queryByText('Save to address book')).toBeNull();
  });
});
```

- [ ] **Step 10: Run, implement, run.** `npx jest src/screens/transparent/__tests__/TransactionDetailScreen.test.tsx --forceExit`
      → FAIL. Create `src/copy/transactions.ts`:

```ts
/**
 * post-M1d spec §5: the words of the transaction detail (#27). The direction is claimed only when it is
 * known for the account the detail was opened from; otherwise the neutral word.
 */
export const TX_SENT = 'Sent';
export const TX_RECEIVED = 'Received';
export const TX_NEUTRAL = 'Transaction';
/** Under an address that is a token account because the response named no owner wallet (R11) */
export const TX_TOKEN_ACCOUNT = 'token account';
/** The row shown instead of "From" when the transaction has no transfer (R12: the fee payer is not the sender) */
export const TX_FEE_PAYER = 'Fee payer';
/** An SPL transfer signed for by a key that is not the funds' owner (a delegate), or whose owner is not known */
export const TX_AUTHORIZED_BY = 'Authorized by';
```

  In `TransactionDetailScreen.tsx`:
  - props: `interface Props { signature: string; /** R9: the account whose history or #21 opened this detail; null from a deep link */ account: string | null; onBack: () => void; }`
    and `export function TransactionDetailScreen({signature, account, onBack}: Props)`;
  - after the `useTransactionDetail` line:

```ts
  const transfer = tx?.transfer ?? null;
  const direction = tx ? txDirection(tx, account) : 'none';
  const directionWord = direction === 'sent' ? TX_SENT : direction === 'received' ? TX_RECEIVED : TX_NEUTRAL;
  // a contact is a WALLET that is not this account: never a token account, never oneself
  const contactAddress = transfer !== null && !transfer.toIsTokenAccount && transfer.to !== account ? transfer.to : null;
```

  - `alreadyContact` / `handleSaveContact` use `contactAddress` in place of `tx.to` (`:99-114`);
  - the amount card (`:167-174`):

```tsx
            <Text variant="overline" className="text-fg-secondary" testID="tx-detail-direction">
              {directionWord}
            </Text>
            <Text className="text-fg-primary font-geist-semibold mt-2" style={{fontSize: 28}} testID="tx-detail-amount">
              {transfer?.amount ? `${transfer.amount} ${transfer.symbol}`.trim() : '—'}
            </Text>
```

  - the detail rows (`:196-211`):

```tsx
            <DetailRow label="Type" value={directionWord} />
            <DetailRow label="Status" value={tx.status[0].toUpperCase() + tx.status.slice(1)} />
            {transfer !== null ? (
              <>
                <DetailRow
                  label="From"
                  value={
                    <View className="items-end" testID="tx-detail-from">
                      {transfer.from !== null ? <ChecksumAddr address={transfer.from} /> : <Text className="text-fg-primary">—</Text>}
                    </View>
                  }
                />
                {/* review r1-10: a delegate (or an authority whose relation to the funds is not known) is named apart */}
                {transfer.authority !== null && transfer.authority !== transfer.from ? (
                  <DetailRow
                    label={TX_AUTHORIZED_BY}
                    value={
                      <View className="items-end" testID="tx-detail-authority">
                        <ChecksumAddr address={transfer.authority} />
                      </View>
                    }
                  />
                ) : null}
                <DetailRow
                  label="To"
                  value={
                    <View className="items-end" testID="tx-detail-to">
                      <ChecksumAddr address={transfer.to} />
                      {transfer.toIsTokenAccount ? (
                        <Text variant="caption" className="text-fg-tertiary mt-0.5">
                          {TX_TOKEN_ACCOUNT}
                        </Text>
                      ) : null}
                    </View>
                  }
                />
              </>
            ) : (
              <DetailRow label={TX_FEE_PAYER} value={<ChecksumAddr address={tx.feePayer} />} />
            )}
```

  - the contact button (`:235-242`): `{contactAddress !== null ? ( … ) : null}`;
  - imports: `txDirection` from `'../../modules/solana/txDetail'`, the six words from `'../../copy/transactions'`.

  Run again → PASS.

- [ ] **Step 11: The route carries the account (R9), and History with no account (§7 m1).** Tests first.

  `TransactionHistoryScreen.test.tsx`:
  - **change** `'Calls onSelectTx when row tapped'`: the expectation becomes
    `expect(onSelectTx).toHaveBeenCalledWith('sig1aaaaaaaaaaaaaaaaaaaaa', 'myPublicKey111111111111111111111111111111'); // post-M1d R9: the account the row was shown for`
  - **change** `'I2: no selected account shows the loading text, never "No transactions yet"'` to:

```ts
  // post-M1d §7 (final review m1): with no account nothing is being read — "Loading" would be a claim too
  it('m1: no selected account → the list area is empty: no "Loading", no "No transactions yet", no retry', () => {
    mockHistSelected.current = null;
    mockQuery.isSuccess = false;
    try {
      const {queryByText, queryByTestId} = render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} />);
      expect(queryByText('Loading transactions…')).toBeNull();
      expect(queryByText('No transactions yet')).toBeNull();
      expect(queryByTestId('history-retry')).toBeNull();
    } finally {
      mockHistSelected.current = {address: 'myPublicKey111111111111111111111111111111', label: 'Account 1'};
    }
  });
```

  - **strengthen** `'r1-1: a failed refetch keeps the read transactions and shows the retry line above them'`
    (the §7 "cached rows plus a failed refetch" row) with:

```ts
    expect(getByTestId('tx-row-sig2bbbbbbbbbbbbbbbbbbbbb')).toBeTruthy(); // every cached row, not only the first
    expect(queryByText('No transactions yet')).toBeNull();
    expect(queryByText('Loading transactions…')).toBeNull();
```

    (destructure `queryByText` from that test's `render`.)

  `shieldedRoutes.test.tsx` — the §7 "Navigator `onHistory` wiring" row, in the describe that holds
  `'shielded build: onMakePublic navigates…'` (extend `mockDashboardProps`' element type with
  `onHistory?: () => void` if it is typed):

```ts
  it('post-M1d §7: the dashboard\'s onHistory opens TransactionHistory (the header button\'s only wiring)', async () => {
    mockDashboardProps.length = 0;
    const {ref} = routeNames({shielded: true});
    await act(async () => {
      (ref.navigate as (n: string, p?: object) => void)('MainTabs');
    });
    const props = mockDashboardProps[mockDashboardProps.length - 1];
    expect(props?.onHistory).toBeInstanceOf(Function);
    await act(async () => {
      props!.onHistory!();
    });
    expect(ref.getCurrentRoute()?.name).toBe('TransactionHistory');
  });
```

  Run the two suites → the changed History tests FAIL. Implement:

  `TransactionHistoryScreen.tsx`:
  - `onSelectTx: (signature: string, account: string) => void;` in `Props`;
  - the row: `onPress={() => { if (publicKey !== null) onSelectTx(item.signature, publicKey); }}`;
  - `ListEmptyComponent`:

```tsx
          // I2: "No transactions yet" only after a completed, successful read. post-M1d §7 (m1): with no
          // account resolved nothing is being read, so nothing is claimed — not even "Loading".
          publicKey === null ? null : isSuccess ? (
```

    (the rest of the expression is unchanged.)

  `src/types/navigation.d.ts:67`:
  `TransactionDetail: {signature: string; account?: string}; // post-M1d R9: the account the detail was opened from`

  `Navigator.tsx`:
  - `:601-604`:

```tsx
      onViewDetails={sig => {
        // post-M1d R9: the detail judges the direction against the account this Send was made from
        sendNav.navigate('TransactionDetail', {signature: sig, account: route.params.intent.from.address});
      }}
```

  - `:613-621`: `onSelectTx={(signature: string, account: string) => {` and `params: {signature, account},`;
  - `:628-638`:

```tsx
  const signature = typeof raw.signature === 'string' ? raw.signature : '';
  const account = typeof raw.account === 'string' ? raw.account : null; // R9: absent → no direction is claimed
  return (
    <TransactionDetailScreenImpl
      signature={signature}
      account={account}
      onBack={() => navigation.goBack()}
    />
  );
```

  Run `npx jest src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx src/app/__tests__/shieldedRoutes.test.tsx --forceExit`
  → PASS.

- [ ] **Step 12: Gates.** `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`.
      `tsc` lists any remaining reader of the old flat `TxDetail` fields (`type`, `from`, `to`, `amount`,
      `tokenSymbol`): there must be none outside the files this task changed.

- [ ] **Step 13: Commit.**

```bash
git add src/modules/solana src/modules/tokens/trustedSymbol.ts src/modules/tokens/__tests__/trustedSymbol.test.ts \
  src/copy/transactions.ts src/screens/transparent/TransactionDetailScreen.tsx \
  src/screens/transparent/TransactionHistoryScreen.tsx src/screens/transparent/__tests__ \
  src/app/Navigator.tsx src/app/__tests__/shieldedRoutes.test.tsx src/types/navigation.d.ts
git commit -m "fix(tx-detail): #27 names the token, the recipient wallet and the direction (real devnet fixtures); History claims nothing with no account"
```

---

### Task 9 (controller, not a subagent): design files, and the M1d spec's wording

Spec: §9, §7 third bullet. The controller does this itself after Task 8's review, because it edits the owner's own
files outside the repository.

- [ ] **Step 1: Dated backups first — before any change, and never over an existing backup.** Backups up to
      `.bak-2026-11-22c` already exist in `/home/user/Downloads`. Use the day's date and the next free letter:

```bash
cd /home/user/Downloads
d=$(date +%F); for s in "" b c d e f g h; do
  if [ ! -e "index.html.bak-$d$s" ] && [ ! -e "screen.md.bak-$d$s" ]; then suffix="$d$s"; break; fi
done
test -n "$suffix" && cp -n index.html "index.html.bak-$suffix" && cp -n screen.md "screen.md.bak-$suffix" && ls -l *.bak-"$suffix"
```

      Expected: two new files listed. If `suffix` is empty, stop and ask the owner.

- [ ] **Step 2: `index.html` and `screen.md`.** Read each screen's `screen.md` section and its `index.html` mockup
      first; enumerate every state already drawn; change only what follows.
  - **#11 Dashboard:**
    - add ONE stale-state phone: the hero figure, the SOL · NOC sub-balances and the token rows in the tertiary
      text colour; under the hero the line "Not updated · 5 min ago · pull to refresh"; no 24h change line and no
      per-row 24h %; the split's Public column dimmed;
    - in the Accounts sheet phone, one row whose balance reads "0.5 SOL · not updated" (dimmed);
    - where the token list is drawn, add a "Wrapped SOL" row with the ticker "wSOL" next to the SOL row
      (Task 5 — the row exists whenever wSOL is held), with a note that the SOL row is native SOL only.
    - `screen.md` #11: the stale rule in words (last known figure, dimmed, with its age; "Balance unavailable" only
      where nothing was read in this session; hidden balances win), and the wSOL row.
  - **#12 Send:** the amount card's balance row in the stale state: "Not updated · tap to retry", with MAX and the
    CTA disabled. `screen.md` #12: a stale balance is not usable for sending.
  - **#27 Transaction detail:** the hero reads "SENT 0.0002 TEST" (the token symbol after the amount); TO is the
    recipient wallet; add the notes: "RECEIVED" / "TRANSACTION" as the other two hero words, "token account" under
    an address whose wallet is not known, and "Fee payer" in place of From when there is no transfer.
    `screen.md` #27: the same, plus "the direction is judged for the account the detail was opened from".
  - **#26 History:** `screen.md` only — with no account resolved the list area is empty (no "Loading").
  - **The "linked" tag:** `screen.md` Accounts sheet section — "linked" now also appears on a fresh-exit account
    after a confirmed Send between own accounts (never on main). No drawing change (the tag is already drawn).

- [ ] **Step 3: The M1d spec's "combined line" wording (§7 third bullet).** In
      `docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md`, add a dated note at each of the four
      places — the wording itself stays, struck through nowhere, so the history reads:
  - line 15 (the purpose paragraph, "adds the one combined line"),
  - the `### 4.5 The combined line` heading at line 130,
  - line 157 ("the combined line on #11"),
  - line 166 ("the combined-line formatter"):

      after each, the same sentence:
      `(2026-11-22: superseded — the combined line was replaced by the Public | Private split row inside the balance card; see the §4.5 addendum and plan 2026-11-22-shielded-m1d-phone-pass-fixes.)`
      Re-find the four places by `grep -n "combined" docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md`
      (row D3 at line 37 already carries its note; leave it).

- [ ] **Step 4: Gate and commit the spec note** (the design files are outside the repository and are not committed):

```bash
node scripts/check-no-tge-date.mjs
git add docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md
git commit -m "docs(m1d): the remaining 'combined line' wording carries its superseded note"
```

- [ ] **Step 5: Tell the owner, per screen, what changed** — #11 (the stale phone, the stale sheet row, the wSOL
      row), #12 (the stale balance row), #27 (the symbol, the wallet as TO, the three hero words, "token account",
      "Fee payer"), #26 (the empty list with no account) — and name the backup files made in Step 1. Say explicitly
      what was **not** drawn: no stale phone for the Accounts sheet's main row (it follows the same rule as the row
      drawn), and no drawing for Private mode's dimmed Public column.
      Also tell the owner, in these words, the limits this PR leaves (the "Known limits" section below):
  - **The presale screen shows the main account's SOL and stablecoin figures with no stale label.**
    `PresaleScreen.tsx:121,159` reads `walletStore` directly, not the hook; this PR does not change it. After a
    failed sync it shows the last figure as if current (and a never-read wallet's `0`). PR 2 or later.
  - #27 adds a row the design does not draw: "Authorized by", shown only for a delegated token transfer or when
    the sender wallet is not named by the chain response. Ask whether it should be drawn.
  - A failed transaction's detail reads "TRANSACTION", not "SENT".

---

## Spec coverage

| Spec item | Task |
|---|---|
| §1 stale balances labelled (main + other accounts read in this session) | 1, 2, 3 |
| §1 / §4 the "linked" tag follows own-account sends; never main | 6, 7 |
| §1 / §5 #27 names things correctly | 8 |
| §1 / §6 one row per token | 5 |
| §1 / §6 wSOL counted once | 5 |
| §1 / §7 parked minors | 4 (retry guard), 8 (History, Navigator wiring), 3 and 5 (coverage), 9 (spec wording) |
| §3.1 main: `lastSyncFailedAt`, the stale rule | 1, 2 |
| §3.1 main: unknown with no read — a never-read main is never `ready`: `loading`, then `error` once a sync failed; never `0` (review r1-1, controller ruling 2026-11-22) | 2 (hook, real state), 3 (S3b, TD5, the dashboard pin), 4 (`SendScreen.mainNeverRead.test.tsx`, real hook + store) |
| §3.1 another account: `stale` vs `error`; main through the same hook | 2 |
| §3.2 dashboard hero, sub-balances, token rows; the line and `{age}` | 3 |
| §3.2 Public column of the split, a11y "not updated" | 2 (`splitA11y`), 3 (`publicSide` accepts stale in the same commit as the dimmed column) |
| §3.2 Accounts sheet rows | 3 |
| §3.2 #12 not usable; CTA, MAX, insufficiency disabled | 4 |
| §3.2 24h change line hidden while stale | 3 |
| §3.2 hidden balances win | 3 (D6, S4) |
| §3.3 copy | 2 |
| §4 `linksAccounts`, `markA0AccountsLinked`, failure → queue, never on cancel / failure / unknown, sheet re-reads | 6, 7 |
| §5 symbol, recipient wallet, direction, real fixtures | 8 |
| §6 one row per mint; wSOL | 5 |
| §7 #12 retry generation guard | 4 — implemented; **untested invariant (race unconstructible)**: no test can make the guard bite, only the condition that makes it safe is pinned |
| §7 History with no selected account | 8 |
| §7 spec wording | 9 |
| §7 coverage: "<0.0001" dashboard row + sub-balance, TokenDetail | 3 (K1, TD3) — pins |
| §7 coverage: "<0.0001" TokenPicker, presale allocation | 5 — pins |
| §7 coverage: split-column tap → first-private onboarding | 3 (K2) — pin |
| §7 coverage: History cached rows + failed refetch | 8 |
| §7 coverage: Navigator `onHistory` wiring | 8 |
| §8 unit and screen tests; gates | every task |
| §8 phone pass (owner) | after Task 9; not a task |
| §9 design files | 9 |
| R1 partial sync; `SyncResult.partial`; each read failing alone | 1 |
| R2 queue in memory + encrypted MMKV; cleared on wipe/import; accepted loss | 6 |
| R2 drains: on sheet open, after a confirmed Send, on promote | 6, 7 — both the memory and the stored queue |
| R2 drains: after unlock | 7 — **the STORED queue only**. The memory queue is emptied by the reset hook on every open of the store (ruling 14), so nothing in memory survives to an unlock |
| R3 fresh-pending queued, applied on promote, dropped on release | 6 (Q4, Q5), 7 (`linkedParticipants`) |
| R4 #12 retry for main = `forceSync` | 4 |
| R5 non-main figures are this session's only | 2 |
| R6 dedupe rows by mint; `buildHoldings` unchanged | 5 |
| R7 "Wrapped SOL" / "wSOL"; own amount; SOL row native-only; hero = sum; split keeps folding | 5 |
| R8 symbol source | 8 (`trustedSymbol`) |
| R9 route `{signature, account}`; direction against it only | 8 |
| R10 TokenDetail stale; the sheet's main row uses the same rule | 3 |
| R11 mint, decimals, owner from `postTokenBalances` by index; "token account"; the cast | 8 |
| R12 sender = the transfer's source, not the fee payer | 8 — as corrected by review r1-10: for SPL the source token account's OWNER, not `info.authority`; "Authorized by" row when they differ |
| review r1-2: a failed transaction has no direction | 8 |
| review r1-3: no NOC account after a good token read is `'0'` | 1 |
| review r1-6: a persisted wSOL row labelled "SOL" is relabelled on rehydration | 5 |
| review r1-7: TokenDetail's stale age ticks every 60 s | 3 (TD4) |
| R13 `lastSyncFailedAt` not persisted, null on `reset`; cold start | 1 |
| R14 a Send that lands but errors: no tag (noted for PR 2) | 7 (test) |
| R15 late confirmation only while #21 is mounted | 7 (test) |
| R16 token rows' 24h % hidden while stale; `{age}` on render + every 60 s focused | 3 (D5, D11; TD4 for TokenDetail) |
| r2-1 memory only; a new session never starts stale | 1 |
| r2-2, r2-3 (spec edits) | already in the spec; nothing to build |
| r2-4 native checks key on the mint; wSOL priced from `prices['native']` | 5 |
| r2-5 a partial sync writes nothing | 1 |
| r2-6 "verified" = passes `classifyToken` | 8 |
| r3 note: `partialize` excludes `lastSyncFailedAt`, rehydration test | 1 |
| r3 note: the partial early return comes before `setTokens`, pinned by a test | 1 |

## Pins — tests that pass before the change

These cover behaviour that already exists, or keep a later edit from breaking it. They are not evidence that a
task's change works, and a task report must not count them as such.

| Test | Task | What it pins |
|---|---|---|
| D12 (the alert on a partial sync) | 3 | the alert code is not edited; Task 1 changed what `forceSync` returns |
| K1, K2, TD3, TD5; the dashboard "error" row in Task 2 | 2, 3 | existing formatting, the split tap, and what the screens draw for `error` |
| "the split's Public column keeps folding wSOL into SOL" | 5 | `publicSide` already folds |
| TokenPicker and presale-allocation "<0.0001" / "<0.01" | 5 | the shared formatter |
| "#12 itself writes nothing — the tag belongs to #21" | 7 | #12 never imported the queue |
| the generation guard's row in Task 4 | 4 | not the guard: an untested invariant (race unconstructible) |

## Known limits this PR leaves (tell the owner — Task 9 Step 5)

- **Presale shows the main figure without a stale label.** `PresaleScreen.tsx:121` (`solBalance`) and `:159`
  (`tokenBalances`) read `walletStore` directly. Not changed here: after a failed sync the presale screen shows the
  last figure as current, and for a never-read wallet the store's `0`. PR 2 or later.
- **A "linked" tag lost if the process dies while the encrypted store is locked** (R2, accepted), and no tag for a
  Send that landed but errored (R14) or was confirmed after #21 closed (R15). PR 2's retroactive scan.
- **Non-main figures do not survive a restart** (R5): a failed read after a cold start is "Balance unavailable".
- **#27 with no owner in the RPC response:** the recipient is shown as a token account and the sender as "—" with
  "Authorized by"; no direction is claimed. No extra RPC call is made to resolve the owner.

## Rulings made while writing this plan (the spec was silent or two readings existed)

Each is the most conservative reading; a reviewer who disagrees should say so before the task it sits in starts.

1. **A partial sync returns `success: false, partial: true`** (Task 1). The spec adds `partial` but does not say what
   `success` is. Nothing was written, so it is a failure; the pull-to-refresh alert then names the read that failed.
2. **The age format is the spec's quoted one** ("5 min ago", "2 h ago", "3 d ago"), in a new `relativeAge`
   (Task 2). The only existing helper (`OfflineBanner.tsx:13-26`) writes "5m ago" and falls back to a date; it is
   left alone.
3. **TokenDetail's stale line is "Not updated · {age}"** without "pull to refresh" (`staleNote`, Tasks 2–3): that
   screen has no pull-to-refresh, and the line must not name an action that does not exist.
4. **A hidden stale sheet row reads "••• · not updated"** (Task 3): §3.2 says hidden wins and the stale mark still
   shows.
5. **#12's generation guard cannot bite today** (Task 4): the source moves only null → account and no retry row
   exists while it is null. It is implemented as History's. It is an **untested invariant (race unconstructible)**:
   the one row beside it pins the condition that makes it safe, not the guard.
6. **wSOL is priced in `computePortfolio` through `priceKeyFor`** (Task 5), not in `buildHoldings`, which R6 says
   stays unchanged. `TokenLogo` gets the Solana logo for "wSOL" (otherwise the rename would show a letter "w").
7. **`linksAccounts` includes fresh-pending participants** (Task 7): §4 says "fresh-exit accounts", R3 says a
   pending participant is queued — so it must travel in the intent to be queued.
8. **The promote hook is a listener in the registry** (`onA0AccountPromoted`, Task 6), so `accountRegistry.ts` does
   not import the queue, and all five `promoteA0FreshAccount` call sites in `unshieldFlow.ts` stay untouched.
9. **"Sent" needs all three: the account is the wallet the funds left, it signed, and the transaction did not
   fail** (Task 8). §5 says "signed the transaction"; R12 says the sender is the transfer's source, not the fee
   payer; requiring both satisfies each. A failed transaction moved nothing, so it has no direction for anyone —
   not "Sent", not "Received" (review r1-2).
10. **"Received" is recognised only when the response names the owner** (or the route's account is itself the
    destination token account) (Task 8). With no owner the wallet cannot be matched without another RPC call, so the
    detail reads "Transaction".
11. **With no transfer the row reads "Fee payer", not "From"** (Task 8): R12 forbids presenting the fee payer as the
    sender, and the row would otherwise be empty.
12. **"Save to address book" is offered only for a recipient wallet that is not the viewing account** (Task 8).
    Today it would save a token account as a contact.
13. **The pool token's symbol ("TEST") is trusted only where private balances exist** (`isShieldedEnabled()`,
    Task 8), as `withPoolToken` does.
14. **The memory queue is emptied by every `onSecureMmkvReset`, which also fires when the store is opened**
    (`instances.ts:54-56`), as R2 says ("cleared on wipe and import, through the existing `onSecureMmkvReset`"). So
    a memory-only entry never outlives an unlock; it exists only while the store is open and the registry is
    unreadable (Task 6, Q6), where it is stored too. An entry queued while the store is locked cannot arise in
    practice: `linksAccounts` is non-empty only if #12 read the registry, which needs the store open.
15. **The fixtures are the verbatim JSON-RPC responses**; "SPL without owner", "plain `transfer`", "failed" and
    "delegated" are derived from a real response by changing exactly the fields that case changes, and each test
    says what it changed. No devnet transaction among the three has those shapes.
16. **A main account never read is never `ready`** (Task 2; review r1-1 and the controller ruling of 2026-11-22):
    `loading` while no sync of this session has failed, `error` once one has — what a non-main account does. §3.1
    says the figure is then "unknown (today's '—')"; today's code did not deliver that — the screens gate on
    `status === 'ready'` and drew the store's default 0. The sheet's main row reads "not checked yet" while
    loading and "Balance unavailable" once a sync failed.
17. **For an SPL transfer "From" is the source token account's owner, never `info.authority`** (Task 8, review
    r1-10). This corrects R12's order ("`info.authority`, or the source token account's owner"): the authority is a
    delegate in a delegated transfer. When the response names no owner, From is "—" and the authority appears as
    "Authorized by" — it is not promoted to sender. The owner is read from the post balances, then the pre ones.
18. **A successful token read with no NOC account sets `nocBalance` to `'0'`** (Task 1, review r1-3) — outside the
    spec's list, inside its honesty rule: the old figure was shown as current under a fresh sync time.
19. **Persisted core-token labels are corrected in `merge`** (Task 5, review r1-6). The store has no persist
    `version` / `migrate` to bump; `merge` is the rehydration path, already present since Task 1, and corrects the
    row before any screen reads it. Only core mints are relabelled.
20. **TokenDetail's age tick is a mounted-while-stale interval, not `useFocusEffect`** (Task 3, review r1-7): the
    screen is a modal and is rendered in its tests without a navigator.
