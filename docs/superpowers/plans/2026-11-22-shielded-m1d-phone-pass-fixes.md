# M1d phone-pass fixes (owner, 2026-11-22) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Act on the owner's first on-phone look at M1d (5 screenshots, 2026-11-22). Four fixes the owner approved
("da" to each) plus the design-file update.

**Spec:** `docs/superpowers/specs/2026-11-21-shielded-m1d-accounts-design.md`. This plan **changes D3**: the owner
replaced "one thin line under the toggle" with a split Public | Private row inside the balance card. The spec gets a
dated addendum line in Task 5. Everything else in the spec stands: D2 (X is the selected account), D4 (USD only where
every asset of that side is priced, never summed), "—" for unknown, "•••" when hidden, only in builds with private
balances (plan A9).

**Branch:** `feat/shielded-m1d-accounts` (HEAD a097d4d).

## Global Constraints

- TypeScript strict; no `any`, no `@ts-ignore`; money is BigInt to the display edge.
- Every user-visible string goes in `src/copy/` (`accounts.ts` or `modes.ts`). The guard tests
  `src/screens/shielded/__tests__/privacyClaims.test.ts` and `src/copy/__tests__/bannedWords.test.ts` stay green with
  their regexes unchanged.
- Gates, each with a real exit code:
  - `npx jest` (full run; single files need `--forceExit` for some hook suites);
  - `npx tsc --noEmit`;
  - `npm run lint:ci`, which must print exactly `✖ 143 problems (0 errors, 143 warnings)`;
  - `node scripts/check-no-tge-date.mjs`.
- Never run `npx prettier --write`.
- Honesty rule: never show a value that was not read, and never sum the two sides.

## Review Focus

1. **Hidden balances.** With the eye toggle off, no amount may leak through the new split row, in either column or in
   its accessibility label.
2. **Unknown sides.** A side that is still loading or failed shows "—", never "0" or a stale figure.
3. **Tiny amounts.** An amount below 0.0001 reads "<0.0001", never "0" and never scientific notation, on every screen
   that uses the shared formatter (Dashboard sub-balances, token rows, TokenDetail, Swap, TokenPicker, the sheet,
   presale allocation).
4. **Long account lists.** With 6 or more accounts, the sheet still shows the footer, and the list visibly scrolls.
5. **History with no data.** Opening History for a non-main account with no transactions shows the empty state, not a
   crash.

---

### Task 1: Tiny amounts read "<0.0001", not scientific notation

**Files:**
- `core/util/parseTokenAmount.ts:47-57`
- `src/utils/__tests__/parseTokenAmount.test.ts:97-99`
- any test asserting an `e-` string (find them with `grep -rn "e-[0-9]" src core --include=*.test.ts*`)

**Why:** the sheet showed "1.00e-5 TEST" for 10 raw units of a 6-decimal token. Phantom and Solflare show "<0.0001".
Only the mobile app imports this function (`web/` and `extension/` do not; verified by grep).

- [ ] Change the sub-threshold branch. When `0 < big < 10^(decimals-maxDisplayDecimals)`, return
      `'<0.' + '0'.repeat(maxDisplayDecimals - 1) + '1'`. With the default 4 that is `"<0.0001"`.
- [ ] Update the test at :97: `formatBalanceForDisplay('100', 9)` → `'<0.0001'`.
- [ ] Add tests:
  - `('10', 6)` → `'<0.0001'`;
  - `('100', 6)`, i.e. 0.0001 exactly → `'0.0001'` (the boundary is not below);
  - `('1', 9, 2)` → `'<0.01'`;
  - `('0', 9)` → `'0'` (unchanged).
- [ ] Commit: `fix(format): an amount below the shown precision reads "<0.0001", not scientific notation`.

### Task 2: The Accounts sheet shows its whole list

**Files:**
- `src/components/accounts/AccountsSheet.tsx:106`
- `src/components/accounts/__tests__/AccountsSheet.test.tsx`

**Why:** `max-h-96` (384 dp) cut the list after about 3½ rows. Account 4's balance and Account 5 were invisible, and
nothing told the user the list scrolls.

- [ ] Replace `className="max-h-96"` with a style of `maxHeight: Math.round(useWindowDimensions().height * 0.6)`.
- [ ] Add `showsVerticalScrollIndicator` and `persistentScrollbar` (Android) so a longer list shows its scrollbar.
- [ ] Test:
  - mock a window height of 2000 and assert the ScrollView's `maxHeight` is 1200;
  - render 6 accounts and assert all 6 rows and the footer are in the tree.
- [ ] Commit: `fix(m1d): the Accounts sheet uses 60% of the screen and shows its scrollbar`.

### Task 3: "Public balance" instead of "Total balance"

**Files:**
- `src/copy/modes.ts` (add `PUBLIC_BALANCE = 'Public balance'` next to `PRIVATE_BALANCE`)
- `src/screens/dashboard/DashboardScreen.tsx:657`
- the dashboard tests that assert "Total balance"

**Why:** in Public mode the figure is the selected account's public value only, so "Total" overclaims (honesty rule).

- [ ] Use `PUBLIC_BALANCE` where the code says `'Total balance'`. Do this in every build, including the one without
      private balances: the figure is the public balance there too.
- [ ] Update the doc comment at :92.
- [ ] Update the tests.
- [ ] Commit: `fix(m1d): the public hero reads "Public balance"`.

### Task 4: A History button on the dashboard

**Files:**
- `src/screens/dashboard/DashboardScreen.tsx` (the header, next to the Bell at :600)
- `src/app/Navigator.tsx` (the dashboard's nav wrapper passes `onHistory={() => rootNav.navigate('TransactionHistory')}`)
- `src/copy/accounts.ts` (`HISTORY_A11Y = 'Transaction history'`)
- dashboard tests

**Why:** the TransactionHistory screen (design #26 "activity") exists and already follows the selected account
(`TransactionHistoryScreen.tsx:123-126`), but the only way to reach it is a notification deep link.

- [ ] Add a header Pressable before the Bell:
  - lucide `History` icon, size 22, color `#A8ACB5`, strokeWidth 1.75;
  - `w-10 h-10 rounded-pill`, `accessibilityRole="button"`, `accessibilityLabel={HISTORY_A11Y}`,
    `testID="dashboard-history"`;
  - it calls a new optional prop `onHistory`.
- [ ] Show it in both modes. In Private mode the history is still the selected account's public history; that is
      acceptable for now, and the screen title says whose it is.
- [ ] Test: pressing `dashboard-history` calls `onHistory`.
- [ ] Wire it in Navigator, using the pattern of `onNotifications` / `onScan`.
- [ ] Commit: `feat(m1d): a History button on the dashboard header`.

### Task 5: The Public | Private split inside the balance card (replaces the line under the toggle)

**Files:**
- `src/screens/dashboard/DashboardScreen.tsx`:
  - remove the block at :638-645;
  - add the split at the bottom of the hero card, after the sub-balance row / the Details disclosure;
- `src/modules/accounts/valueLine.ts`: add `sideLines(side, prices): string[]` and `splitValue(...)`; keep
  `formatSide` and `combinedValueLine` (they can stay for the accessibility label; delete them if nothing uses them);
- `src/copy/accounts.ts`: add `SPLIT_PUBLIC = MODE_PUBLIC` and `SPLIT_PRIVATE = MODE_PRIVATE`, which reuse the mode
  words, and `splitA11y(sideName, value, isActive)`;
- tests: `src/modules/accounts/__tests__/valueLine.test.ts` and the dashboard tests;
- the spec addendum (one dated line under §4.5: "2026-11-22 owner: D3 replaced — the split row inside the balance
  card, see plan 2026-11-22-shielded-m1d-phone-pass-fixes").

**Layout, inside the card, both modes, only when `isShieldedEnabled()`:**
- a 1 px divider, `bg-bg-surface-3`, `my-4`;
- one row of two equal columns, `flex-1`, `gap-4`;
- each column is a Pressable:
  - **label row:** a 6 px dot (Public `#B084FC`, Private `#5BE3C2`) and the word in `overline` variant. The active
    mode's label is `text-fg-primary`, the other `text-fg-tertiary`.
  - **value lines:** `body-sm`, `numeral`, `text-fg-secondary`, `numberOfLines={1}`:
    - if the side is USD (every held asset priced): one line `$x.xx` (or `<$0.01`);
    - otherwise one line per asset, largest first, at most 2 lines, then a third line `+N more`;
    - nothing held: `0 SOL` / `0 TEST` (as today);
    - unknown: `—`;
    - hidden: `•••`.
- tapping a column calls `onModeToggle('transparent' | 'shielded')`; tapping the active column does nothing;
- a11y: `accessibilityRole="button"`, `accessibilityState={{selected: isActive}}`,
  `accessibilityLabel={splitA11y('Public', valueJoined, isActive)}`. When hidden the label carries `•••` too, never
  the figure.
- testIDs: `dashboard-split-public`, `dashboard-split-private`.

**`sideLines` contract:** it returns the same content as `formatSide` today, but as an array: `['$12.40']`, or
`['0.003 SOL', '0.001 TEST']`, or `['8.995 TEST', '0.4693 SOL', '+1 more']`, or `['—']`. `+N more` replaces the `+N`
suffix. Reuse the sort and USD logic: extract it; do not duplicate it.

- [ ] Tests (valueLine):
  - USD side;
  - token side, 2 assets;
  - token side, 3 assets → `+1 more`;
  - nothing held;
  - unknown;
  - a malformed amount → unknown (existing behaviour kept);
  - tiny amount → `<0.0001 TEST` (via Task 1).
- [ ] Tests (dashboard):
  - the split renders in both modes and the old `dashboard-combined-line` is gone;
  - hidden → both columns `•••` and the a11y labels carry no digit;
  - a tap on the inactive column calls `onModeToggle` with its mode; a tap on the active one does not;
  - the shielded flag off → no split.
- [ ] Commit: `feat(m1d): Public | Private split inside the balance card (owner, replaces D3's line)`.

### Task 6 (controller, not a subagent): design files

- Make dated backups first: `/home/user/Downloads/index.html.bak-2026-11-22c` and `screen.md.bak-2026-11-22c`.
- In index.html, replace the combined line under the toggle with the split row inside the card on every #11 phone
  that has it. Rename "Total balance" to "Public balance". Add the History icon to the header. Make the sheet taller.
- In screen.md, update #11 to match and add #26: "reached from the dashboard's History icon".
- Tell the owner per screen what changed.

---

## Review r1 dispositions (Fable, NOT APPROVED → folded in; binding over the task text above)

Run Tasks 1→5 strictly in sequence (r1-12): Tasks 3, 4 and 5 share `DashboardScreen.tsx` and its test. Re-find line
refs by grep after each task.

- **r1-1, Task 4:** `TransactionHistoryScreen.tsx:126` must use the query state, not `data = []`:
  - loading → "Loading transactions…";
  - error → "Couldn't load transactions · tap to retry" as a button that calls `refetch` (one in flight, as on #12);
  - "No transactions yet" only after a successful read that returned no transactions;
  - the strings go in `src/copy/accounts.ts`;
  - tests for all three states, plus a test that the empty state does not show while loading or on error.
- **r1-2, Task 4:** remove the `Shielded` and `Staking` filter tabs from `FILTER_TABS`. They can only ever say "No
  transactions yet", which is false. Ruling: removal beats a "not shown here" note; it costs a tab to re-add when
  parsing exists. Update the tests that press them.
- **r1-3, Task 5:** port every `dashboard-combined-line` assertion in `DashboardScreen.test.tsx` (~:573-611) to the
  split testIDs. Each case stays: public unknown "—", private unknown "—", priced side USD, unpriced side token
  amounts, hidden, flag off. Delete none.
- **r1-4, Task 5:** each value line uses `numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}`.
- **r1-5, Task 2:** keep only the `maxHeight` assertion; the 6-rows test proves nothing. Call `useWindowDimensions()`
  at the top of the component. The visible scroll is checked on the phone (owner's visual pass).
- **r1-6:** the sheet rows keep `formatSide` and its `+N` (unchanged, tests at valueLine.test.ts:41,64 stay). Only
  `sideLines` uses `+N more`. Share the sort/USD core between the two; never duplicate it.
- **r1-7:** delete `combinedValueLine`, `combinedLine` (copy) and their tests. Replace the dashboard's
  `combined: string | null` prop with `split: {publicLines: string[]; privateLines: string[]} | null` (null = flag off).
- **r1-8:** hidden and unknown are exactly one line per column (`•••` / `—`), never `+N more`. Test both.
- **r1-9:** the tiny-amount valueLine test passes `prices = null`.
- **r1-10, Task 1:** `SwapScreen.tsx:437` must not prefix "≈" when the formatted string starts with "<". Test it.
- **r1-11:** update these stale comments:
  - `core/util/parseTokenAmount.ts:47-50`;
  - `DashboardScreen.tsx:84-92` (the header and hero comments);
  - `valueLine.ts:1-7`;
  - spec row D3 (:37), with a dated note, as well as the §4.5 addendum.
