# Post-M1d fixes (PR 1 of 2) — design

- **Date:** 2026-11-22
- **Status:** design approved by the owner in chat (2026-11-22: split into two PRs, "A"; stale balance "A"; linked
  tag "A"; design sections "da").
- **Base:** `main` 3eec5f5 (M1d merged, PR #126). Branch `feat/post-m1d-fixes`.
- **Related:**
  - spec `2026-11-21-shielded-m1d-accounts-design.md` (M1d);
  - plan `2026-11-22-shielded-m1d-phone-pass-fixes.md`;
  - PR #126 "Known limits";
  - ledgers `.superpowers/sdd/2026-11-21-shielded-m1d-accounts/progress.md` and
    `…/2026-11-22-shielded-m1d-phone-pass-fixes/progress.md` (parked items).
- **PR 2 (out of scope here):** transaction history parsing to the owner's design #26: direction, amount,
  counter-party, filter chips, date groups, and a retroactive "linked" tag found from the counter-parties.

## 1. Purpose

Close the limits M1d shipped with, and the display bugs it exposed, without new features. Each item is a known,
user-visible defect. The honesty rule governs every one: never show a value as current when it was not read, never
show a wrong figure, and never claim what the chain does not show.

**Success criteria:**
- **Stale balances are labelled.** A balance that failed to refresh is shown as the last known figure, visibly marked
  stale with its age. This applies to the main account, and to any other account whose figure was read earlier in
  this session (§10 R5). A stale figure is never shown as current, and is never hidden while a last figure is known.
- **The "linked" tag follows own-account sends.** After a confirmed Send that showed the linking warning, every
  fresh-exit account taking part carries "linked" in the Accounts sheet. The main account never does.
- **#27 names things correctly.** Transaction detail shows the token symbol for known tokens. For SPL transfers it
  names the recipient wallet, not the token account.
- **One row per token.** A mint held in two token accounts is one row with the summed amount, so USD is never counted
  twice.
- **wSOL is counted once.** Wrapped SOL is its own "Wrapped SOL" row, priced as SOL. The public hero total is the
  sum of the rows, so wSOL is counted exactly once (§10 R7).
- **The parked review minors are closed** (§7).
- All gates are green and the privacy-claims and banned-word guards are unchanged.

**Out of scope:** history parsing and the #26 redesign (PR 2); a retroactive "linked" tag for sends made before this
PR (PR 2); new accounts features.

## 2. Owner decisions (2026-11-22)

| # | Question | Decision |
|---|---|---|
| P1 | One PR or two | **A:** two. This one holds the fixes; PR 2 holds history. |
| P2 | A balance that failed to refresh | **A:** show the last known figure, dimmed, with "Not updated · {age} · pull to refresh". This holds for the main account and for other accounts with a cached figure. "Balance unavailable" stays only where no figure was ever read. |
| P3 | Which accounts get "linked" after an own-account Send | **A:** every fresh-exit account taking part (the source and/or the recipient). Never the main account. Only after the Send is confirmed on chain; never on cancel or failure. |

## 3. Stale balances (P2)

### 3.1 Data

- **Main account.**
  - Its figure is `walletStore` (written by `forceSync`). `forceSync` already returns `{success, error}`, and
    `lastSyncedAt` is the time of the last successful sync.
  - Add `lastSyncFailedAt: number | null` next to it, **in memory only, never persisted** (§10 R13). It is set when
    a sync of this session fails and cleared on success.
  - The figure is **stale** when `lastSyncFailedAt !== null && lastSyncedAt !== null`, meaning the last attempt
    of this session failed and an older successful read exists. The age is measured from `lastSyncedAt`.
  - With no successful read ever, the figure is **unknown** (today's "—").
- **Another account.**
  - `useAccountPublicData` today returns `error` on a failed re-read even when the query cache holds a previous
    figure (M1d review r1 N1). It becomes:
    - `{status: 'stale', …figure, syncedAt, failedAt}` when the cache holds a figure from an earlier successful
      read;
    - `{status: 'error'}` only when no figure was read in this session (§10 R5).
- **Main through the same hook.** `useAccountPublicData` for main returns `stale` under the same rule, so every
  consumer sees one shape.

### 3.2 Display

- **Dashboard hero, sub-balances and token rows (Public mode).**
  - The figures are dimmed: `text-fg-tertiary`, or opacity 0.6 on numerals.
  - Under the hero, one line: "Not updated · {age} · pull to refresh".
  - `{age}` uses the existing relative-time style ("just now", "5 min ago", "2 h ago", "3 d ago").
- **Public column of the split.** It shows the stale figure, dimmed. The column's a11y label adds "not updated".
- **Accounts sheet rows.**
  - A stale row shows the figure dimmed, followed by " · not updated".
  - "Balance unavailable" stays only when nothing was ever read.
- **#12 Send.** A stale balance stays **not usable** for sending, exactly like `error` today.
  - Available reads "Not updated · tap to retry".
  - The CTA, MAX and the insufficiency check stay disabled. A send must never be judged against a figure that may be
    wrong.
- **The 24h change line.** It is hidden while stale; it describes a live price movement.
- **Hidden balances ("•••").** They win over stale: nothing leaks, and the stale line still shows, without the
  figure.

### 3.3 Copy (`src/copy/accounts.ts`)

- `staleLine(age)` → `Not updated · ${age} · pull to refresh`
- `STALE_ROW_SUFFIX` = `not updated`
- `SEND_BALANCE_STALE` = `Not updated · tap to retry`

## 4. The "linked" tag after an own-account Send (P3)

- **When the tag is written.** The linking predicate (`src/modules/accounts/linking.ts`) already decides when the
  warning shows. The Send intent (#12 → #19 → #20 → #21) carries a new field, `linksAccounts: string[]`. It holds the
  addresses of the fresh-exit accounts taking part, and is computed once on #12 from the same registry read that
  showed the warning. It is empty when the warning did not apply.
- **What is written.** When #21 reaches a confirmed status, the app marks each address in `linksAccounts` as linked
  in the encrypted registry, through a new
  `markA0AccountsLinked(addresses: readonly string[], options?): number`. The function:
  - sets `linked: true` on matching `fresh-exit` entries and returns how many changed;
  - never touches `main` or `fresh-pending`;
  - needs no seed.
- **Failure.** If the registry write fails (locked or corrupt), the Send still reads as successful. The addresses are
  queued in encrypted MMKV (`v1_accounts.linkPending`) and retried at the next app start and the next sheet open.
  The queue is cleared once written.
- **Never on cancel, failure or an unconfirmed (unknown) outcome.** On unknown, the queue is not written. Ruling: a
  tag claims a link, so it is written only on proof of the link. Cost if wrong: one untagged account until PR 2's
  retroactive scan.
- **After the write.** The sheet re-reads the list, so the tag shows next time it opens.

## 5. Transaction detail (#27)

`getTransactionDetail` (`src/modules/solana/queries.ts`) parses one transaction. It changes as follows:

- **Token symbol.**
  - Resolve the SPL mint through the existing token metadata the dashboard uses: the global Jupiter list and
    `A0_TOKEN` for TEST.
  - An unknown mint shows its short mint address ("Ab12cd…ef34") instead of "".
  - The screen renders `amount + ' ' + symbol` in the hero ("SENT 0.0005 TEST").
- **Recipient wallet.**
  - For an SPL transfer, the destination is a token account. The owner wallet is read from the same response,
    `meta.postTokenBalances[i].owner` for the destination's account index, with no extra RPC call.
  - If the owner is not present, show the token account labelled "token account" rather than passing it off as the
    wallet.
- **Direction.**
  - Today the label is always "SENT". It becomes "SENT" only when the selected account signed the transaction, and
    "RECEIVED" when the selected account (or its token account) is the destination.
  - Anything else reads "TRANSACTION", with no direction claimed.
- Tests use real `getParsedTransaction` shapes from devnet (fixtures).

## 6. One row per token, and wSOL in the hero

- **One row per mint.** `buildDisplayTokens` (DashboardScreen / TokenDetail) and `buildHoldings`
  (`src/modules/prices/holdings.ts`) group by mint and sum the BigInt amounts across token accounts. One row per mint;
  USD is computed once from the sum.
- **wSOL.** `buildHoldings` folds wrapped SOL (`WSOL_MINT`) into SOL, so the hero total, the Public column and the
  SOL row agree. A standalone wSOL row stays listed as its own token, since the user can unwrap it, but its value is
  counted once (in SOL), never twice.

## 7. Parked review minors closed here

- **The #12 retry gets a generation guard per source account,** as History has (final review m2).
- **History with no selected account** shows nothing claim-like. The list area stays empty, with no "Loading", until
  an account resolves (final review m1).
- **Spec wording.** The M1d spec's remaining "combined line" wording (§4.5 heading and lines 15, 157, 166) gets a
  dated note: superseded by the split.
- **Coverage:**
  - "<0.0001" on the dashboard token row and sub-balance, TokenDetail, TokenPicker and presale allocation;
  - a split-column tap firing first-private onboarding;
  - History with cached rows plus a failed refetch;
  - the Navigator `onHistory` wiring.

## 8. Testing and gates

- Test-first in every task. Every changed existing test says why.
- **Unit tests:**
  - the stale rule for main and for another account (never read → unknown; read then failed → stale; read again →
    ready);
  - `markA0AccountsLinked` (exit only, never main or pending, idempotent, locked registry → queue);
  - `getTransactionDetail` against real fixtures (SOL send, SPL send with owner, SPL without owner, received,
    third-party);
  - grouping by mint;
  - wSOL folded.
- **Screen tests:**
  - stale hero, row, column and sheet, including the hidden case;
  - #12 refuses a stale balance;
  - #21 confirmed writes the tag, while cancel, failure and unknown do not;
  - #27 symbol and recipient wallet.
- **Gates, each with a real exit code:**
  - `npx jest`;
  - `npx tsc --noEmit`;
  - `npm run lint:ci`, which must print exactly `✖ 143 problems (0 errors, 143 warnings)` or fewer;
  - `node scripts/check-no-tge-date.mjs`;
  - the privacy-claims and banned-word guards, regexes unchanged.
- **Phone pass (owner):**
  - airplane mode → stale line on main and on a non-main account;
  - a Send from Account 4 to main with the second tap (Account 4 becomes the new negative example) → "linked" on
    Account 4;
  - #27 shows "SENT 0.0002 TEST" and the main wallet as TO.

## 9. Design files

Before any change, make dated backups of `/home/user/Downloads/index.html` and `screen.md` with the suffix
`.bak-2026-11-2X`. Then:
- **#11:** add one stale-state phone (dimmed hero plus the stale line) and the " · not updated" row in the sheet;
- **#12:** the stale "Not updated · tap to retry";
- **#27:** the token symbol in the hero and the wallet as TO.

Tell the owner per screen what changed.

## 10. Review r1 dispositions (Fable, NOT APPROVED → folded in; binding over §3–§7 where they differ)

- **R1 — partial sync (§3.1).** `forceSync` today calls `updateBalances` (stamping `lastSyncedAt = now`) even when one
  of its reads failed and old values were reused (`backgroundSyncModule.ts:39,61-73`). The fix:
  - `lastSyncedAt` is stamped **only when every read of that sync succeeded**;
  - a partial or total failure sets `lastSyncFailedAt` and leaves `lastSyncedAt` alone;
  - stale is the whole account; the age is that of the last fully successful sync;
  - `SyncResult` gains `partial: boolean`;
  - tests cover each read failing alone.
- **R2 — where the link queue lives (§4).**
  - The queue is held **in memory** and is also written to encrypted MMKV whenever that store is open. A locked
    store throws (`accountRegistry.ts:283-287`), so the queue cannot rely on it.
  - The queue drains when the registry becomes writable: at app start after unlock, on sheet open, and after the
    next write attempt.
  - It is cleared on wipe and import, through the existing `onSecureMmkvReset`.
  - If the app dies while the store is locked, the tag is lost. This is accepted: PR 2's retroactive scan recovers
    it, and the copy never claims "not linked".
- **R3 — fresh-pending participants.**
  - A `fresh-pending` address taking part is queued, not written; the validator forbids `linked` on pending.
  - The queue applies it when `promoteA0FreshAccount` turns that entry into `fresh-exit`.
  - If the reservation is released, the queued address is dropped.
- **R4 — retry for main.** On #12, "tap to retry" for the main account calls `forceSync`; `refetch` for main is a
  no-op today. The dashboard's pull-to-refresh already does this.
- **R5 — non-main figures are not persisted.**
  - A non-main figure lives in the in-memory query cache for this session (gcTime 5 min).
  - §1 and §3.1 now read "a figure read earlier **in this session**".
  - After a restart, or once the cache has expired, a failed read is still "Balance unavailable".
  - Ruling: persisting per-account holdings was refused in M1d (plan I1). The cost is a blank row after a cold start
    with no network.
- **R6 — one row per token (§6).** The duplicate comes from `buildDisplayTokens` (`tokenModule.ts:166`), which pushes
  one row per token account. `tokenBalances` is already summed per mint, so the fix is to **dedupe rows by mint**.
  `buildHoldings` stays unchanged, because summing there would double the figure.
- **R7 — wSOL (§6).**
  - The wSOL row is labelled "Wrapped SOL" and its symbol is "wSOL"; today `coreTokens.ts:13` calls it "SOL".
  - It shows its own amount, with USD and 24h % from the SOL price.
  - The SOL row stays native-only.
  - The hero is the sum of the rows, so wSOL counts once. The Public split column keeps folding wSOL into SOL,
    since it is a summary.
- **R8 — symbol source (§5).**
  - A symbol comes only from `CORE_TOKENS`, `A0_TOKEN` (TEST), or the DAS metadata cache's **verified** entries.
  - Otherwise the short mint is shown.
  - An unverified DAS symbol is never shown, because a scam mint could call itself "USDC".
- **R9 — #27's account.** The route carries `{signature, account}`: the address of the account whose history or
  #21 the detail was opened from. Direction is judged against that address only, never against the live selection.
- **R10 — more consumers (§3.2).** TokenDetail (`TokenDetailScreen.tsx:56`) shows the stale state too. The sheet's
  main row, which reads `walletStore` directly, uses the same stale rule.
- **R11 — reading an SPL transfer (§5).** The mint, decimals and owner of an SPL transfer come from
  `meta.postTokenBalances`, matched by account index. A plain `transfer` carries no mint. The fixtures are today's
  real devnet transactions: `5i53q9tR…` (TEST to an outside wallet), `QAgzVzY6…` (TEST to main) and `2HWCCJQd…`
  (SOL). If no owner is present, the screen shows "token account". The cast in `queries.ts` gains those fields.
- **R12 — sender (§5).** "From" is the transfer's own source: `info.source` for SOL, and `info.authority`, or the
  source token account's owner, for SPL. It is not the fee payer (`keys[0]`), which is wrong for relayed
  transactions.
- **R13 — cold start.**
  - `lastSyncFailedAt` is **not persisted** (re-review r2-1). It lives in the store's in-memory state and is reset to
    null on `reset`.
  - At cold start the persisted figure shows as it does today until the session's first sync settles, and turns
    stale if that sync fails. Ruling: a stale label flashing on every launch would be noise. Cost: a few seconds of
    an unlabelled figure at launch, which is today's behaviour.
- **R14 — a Send that lands but errors on chain.** Its transaction is on chain and names both accounts, so the
  accounts are linked, yet P3 tags only confirmed sends. Noted for PR 2's retroactive scan.
- **R15 — a late confirmation.** The tag write follows a late success (stuck → confirmed) only while #21 is mounted.
  After that, PR 2's scan covers it.
- **R16 — details.** While stale, the token rows' 24h % is hidden too. `{age}` is recomputed on render and every
  60 s while the screen is focused.

## 11. Re-review r2 corrections (binding)

- **r2-1 — cold start.** `lastSyncFailedAt` is in memory only (§3.1, R13), so a new session never starts stale.
- **r2-2 and r2-3.** §1 and §3.1 are edited in place to match R5 and R7.
- **r2-4 — R7 code facts.**
  - `DashboardScreen.tsx` (~:329, :451) treats any row with `symbol === 'SOL'` as the native row. Those checks must
    key on the mint (`'native'`), not on the symbol, so renaming the wSOL row changes no other row.
  - The wSOL holding is priced from `prices['native']` (prices are keyed by mint, `portfolio.ts:30`), so the hero
    counts it.
- **r2-5 — partial sync.** A partial sync writes **nothing** to the store. Every figure keeps the age of the last fully
  successful sync, so a fresh half never sits under an old age.
- **r2-6 — symbol source.** R8's "verified" means the mint passes `classifyToken` (`tokenModule.ts:116`); the DAS
  cache has no verified flag. Otherwise the short mint is shown.
- **r3 notes for the plan:**
  - `walletStore`'s `partialize` (`walletStore.ts:71`) must exclude `lastSyncFailedAt`, with a test that a rehydrated
    store has it null.
  - Under r2-5, the partial-sync early return comes before `setTokens` (`backgroundSyncModule.ts:79-104`). This is a
    deliberate change from today, where a partial sync shows the fresh half; a test pins the new behaviour.

Spec review: Fable r1 NOT APPROVED (16) → §10; r2 NOT APPROVED (6) → §11; r3 APPROVED (2026-11-22).
- **2026-11-22, plan review (supersedes R12's order for SPL).**
  - The SPL sender ("From") is the **source token account's owner**, read from post or pre token balances, not
    `info.authority`.
  - When the authority differs from that owner, #27 adds a row "Authorized by <short authority>".
  - When the owner is unknown, "From" reads "—" and no direction is claimed. This is plan ruling 17.
- **2026-11-22, plan review.** A main account that was never read (`lastSyncedAt` null) is never `ready`. It reads
  `loading` until a sync of this session fails, and `error` after that.
