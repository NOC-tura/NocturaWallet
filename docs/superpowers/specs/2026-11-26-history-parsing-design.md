# PR 2 — Transaction history parsing, retroactive "linked" scan, presale stale label

**Date:** 2026-11-26. **Revision:** r2. It folds in Fable spec review r1, which was NOT APPROVED (5 Critical, 13 Important, 10 Minor), and the owner's answers H7–H8.

**Branch:** `feat/history-parsing`, from `main` at 7f3f235 (PR #127 merged).

**Owner decisions:** made in chat on 2026-11-26. The owner reads Slovenian; this spec is English.

**Follows:** `docs/superpowers/specs/2026-11-22-post-m1d-fixes-design.md`. PR 1 left these items for PR 2:
- history parsing;
- a retroactive "linked" scan;
- the presale stale label.

**Design target:** the owner's `/home/user/Downloads/index.html` and `screen.md`:
- #26 "activity": states 26a–26d;
- #27 tx-detail;
- #23 presale.

The design files are approximate. Improve them as we build, with dated backups, and report what changed per screen. §11 lists every design element this PR changes or defers.

## 1. Goals and rules

1. **#26 shows real rows.** Each row has a type icon, a title naming the asset, a counter-party when one is known, the time, and a signed amount. Rows sit under date sections. Chips filter them.
2. **The rule above all: a wrong row is worse than none.** The wallet never guesses a field it cannot read from chain. It writes "—" or the neutral title "Transaction" instead, and it never says "no transactions" when it has not read them all.
3. **Every exit account linked on chain carries the "linked" tag,** as far as the scan can read the chain. This covers links made before the tag existed, a send whose confirmation the app never saw, and a landed-but-failed send. The tag is a lower bound (§9). It is never removed.
4. **Presale treats a stale or unknown main balance as Send, Swap and #16 do.**

**Non-goals:**
- private peer-to-peer transfers (they do not exist);
- notifications;
- a backend indexer;
- NFT rows;
- the dApp OriginBadge (§11);
- any change to how a transaction is built or signed.

## 2. Owner decisions (2026-11-26)

| # | Question | Decision |
|---|---|---|
| H1 | Where history comes from | **A.** Read the chain through the app's existing RPC and parse it on the device. No Helius Enhanced API and no backend. |
| H2 | What a row's amount is | **The account's net change** per asset, from the balances before and after the transaction. Rent, fee and gas-grant movements are told apart by the rules in §4, so the row shows the asset the user moved. |
| H3 | How pool moves are named | **A.** "Made private" (a deposit from this account) and "Made public" (a withdrawal into this account). They carry the private-mode badge, sit under the **Shielded** chip, and are never counted as Sent or Received. |
| H4 | The linked rule | An exit account is linked when it appears in one transaction with another wallet of this seed, or with a token account owned by one. Direction does not matter, and a **failed** transaction counts. A relayed Make public into a new account does not link. The main account is never tagged. |
| H5 | When the scan runs | When the Accounts sheet opens, in the background, for every untagged exit. A failure is silent and retries. A tag is never removed. |
| H6 | Presale | Stale main → "—" plus "Not updated · tap to retry". Never read and a sync failed → "Balance unavailable · tap to retry". A read in flight → "Checking balance…". MAX and Buy are disabled until the balance is known. |
| H7 | USD on rows | **No USD line on #26 rows.** The app knows only today's price, so a figure under an old transaction would read as its value then. #27 shows "≈ ${x} at today's price" when a price is known. |
| H8 | Row wording | **As the design draws it.** The title names the asset ("Sent TEST", "Received SOL", "Swapped SOL → NOC", "Made private TEST"). The amount on the right has a sign and no symbol ("−0.0001"); a swap has its incoming leg under it with the symbol ("+9 524.10 NOC"). Each kind has a type icon. |

## 3. Reading the history (H1)

### 3.1 Which addresses are read (review C1)
An SPL transfer into a token account that already exists does not list the recipient wallet. The repo's own fixture shows this: `tx-test-to-main.json` (`QAgzVzY6…`) never names `Da83cA…`. The wallet's history is therefore read from a set of **sources**:

- the wallet address itself;
- every token account the wallet owns:
  - the classic Token program, through `getTokenAccounts`;
  - **Token-2022**, through `getParsedTokenAccountsByOwner(wallet, {programId: TOKEN_2022})`. This is a new read; until now only the classic program was read for balances (§9).

The source list is read once per history session and on every pull-to-refresh. A token account closed earlier is no longer owned, so its transactions are not found (§9).

### 3.2 The merged stream
- Each source is paged by `getSignaturesForAddress(source, {limit: 20, before: cursor[source]})`.
- The streams are merged newest first by `(slot desc, signature)`, and signatures are deduped.
- **A merged page:** take sources whose next item is the newest until 20 unique signatures are collected, or until every source is exhausted.
- **A source is exhausted** when it returns fewer than its `limit`.
- **The end of history** is reached when every source is exhausted.
- **Page cost:** one signature call per source that still has items, plus the transaction reads in §3.3. For a typical wallet with 1–4 token accounts that is 2–5 signature calls per page.

### 3.3 Reading transactions, and the cache (review I4, I5)
- Raw parsed transactions are cached per signature under the TanStack key `['parsedTx', cluster, signature]`. A non-null answer never goes stale (`staleTime: Infinity`), because a landed transaction does not change. A null answer is not cached.
- A page reads only the signatures not yet cached:
  - first with one `getParsedTransactions(signatures, {maxSupportedTransactionVersion: 0})`;
  - **if the batch call throws,** with single `getParsedTransaction` calls for the same signatures, one at a time through `rpcLimiter`.
- **Cost, stated honestly:** a batch is one HTTP call carrying N JSON-RPC requests. Providers count and rate-limit each one, so a page of 20 new transactions costs 20 provider requests either way. The batch saves round trips, not quota.
- **The limiter key** for any history read contains the method, the cluster, and the source with its cursor, or the first and last signature of the batch. `rpcLimiter` dedupes in flight by key, and a key without these would hand one page's answer to another.
- **Plan Task 1 measures this first** against both the devnet and the mainnet endpoint: a 20-item batch, and 20 sequential calls. It records the latency and any refusal before the screen work starts. If the batch is refused, the sequential path is the product path.

### 3.4 Partial pages, refresh and identity
- A signature whose transaction comes back null (not indexed yet) or failed to read **still shows a row**. It has the date and status from the signature list, the title "Transaction", and "—" for the amount. It is never dropped, and never becomes a Sent.
- **Pull-to-refresh:**
  - re-reads the source list;
  - re-reads every source from its head;
  - merges what is new at the top;
  - re-tries every loaded row that is still unparsed.

  Loaded older pages stay.
- Rows are keyed and deduped by signature across pages.
- **Every query key holds the cluster and the account address,** so switching accounts or networks never shows another account's rows.
- "No transactions yet" shows only when the first merged page read successfully, every source is exhausted, and there are zero signatures.

## 4. Classifying a transaction (H2, H3)

### 4.1 Types
`src/modules/solana/activity.ts` holds the pure function `classifyActivity(raw, account, ctx) → ActivityRow`, beside `txDetail.ts`.

`RawParsedTx` is extended with:
- `meta.preBalances` / `meta.postBalances` (number[]);
- `RawTokenBalance.uiTokenAmount.amount` (string, base units);
- the top-level instructions' unparsed form `{programId, accounts, data}`.

Amounts are read **only** from `uiTokenAmount.amount`, never from `uiAmount`. `accountKeys` in a parsed response already includes lookup-table addresses, and every index is over that full list.

```
ActivityRow {
  signature; slot; blockTime: number | null;
  status: 'confirmed' | 'finalized' | 'failed';          // from the transaction; a partial row (§3.4) takes it from the signature list
  kind: 'sent' | 'received' | 'swap' | 'made-private' | 'made-public' | 'wrap' | 'unwrap'
      | 'account-setup' | 'no-funds-moved' | 'failed' | 'unknown';
  primary: Delta | null;            // the asset the row shows (§4.4)
  secondary: Delta | null;          // a swap's incoming leg; null otherwise
  extraAssets: number;              // assets moved besides primary/secondary, not counting rent/fee (the "+N more")
  deltas: Delta[];                  // every net change of this account, ordered (§4.4) — #27 lists them
  counterparty: string | null;      // §4.5
  via: 'Jupiter' | null;
  feePaidByAccount: bigint | null;  // the fee when the account is index 0; null when someone else paid (a relayer)
  incomplete: boolean;              // a balance entry could not be attributed (§4.2) — never 'no-funds-moved'
}
Delta { mint: 'native' | string; symbol: string; raw: bigint; decimals: number; isRent: boolean }
```

`ctx` carries:
- `symbolOf(mint)`, the trusted symbol source from PR 1;
- the cluster;
- the A0 constants;
- `NOCTURA_FEE_TREASURY`;
- `A0_RELAYER.feePayer`;
- the Jupiter v6 program id `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`.

A row's kind is `'failed'` exactly when `status` is `'failed'`.

### 4.2 Net change (review C3, C4, I11)
**SOL.** For the account's own index `i`: `native = post[i] − pre[i]`, plus `fee` when `i == 0`. The fee is never part of the delta. `feePaidByAccount = fee` when `i == 0`, else null.

**Rent.** A lamport movement is rent when it is the creation or closing of an account in this transaction: an index with `pre == 0 && post > 0` (created) or `pre > 0 && post == 0` (closed) that is not a wallet of the user. The account's native delta is split into:
- **rent paid:** the sum of `post` of the accounts it created. The payer is read from the system `createAccount` or the ATA `create` instruction's `source`/`payer`, matched to the account. Without such an instruction, nothing is treated as rent.
- **rent refunded:** a close whose destination is the account.
- the rest.

Rent is a `Delta` with `isRent: true`. It is never the row's primary asset.

**Tokens.** The account's tokens are every entry in `pre`/`postTokenBalances` whose `owner` is the account; a missing side counts as 0. Their net change per mint is `post.amount − pre.amount` as BigInt. Token and Token-2022 are read alike.

**Unattributable.** Some entries cannot be attributed:
- an entry with **no owner** whose token account is one of the history sources (§3.1);
- an entry with unknown decimals.

Either sets `incomplete: true`. An incomplete row is never `no-funds-moved` and never `account-setup`.

Zero deltas are dropped.

### 4.3 Kind
Rules apply in this order, first match wins. Rule 2 applies only when the build's cluster equals `A0.cluster`.

1. `status == 'failed'` → **failed**.
2. **Pool, decided by role and not by sign** (review C5). A top-level instruction of `A0.programId` whose pool account is `A0.pool`, read at the IDL positions `syncedTx.ts` already uses (`A0_DEPOSIT_ACCOUNTS`, the withdraw table):
   - a `deposit` whose `depositor` is the account → **made-private**;
   - a `withdraw_with_change` whose `destination_token_account` is owned by the account in the token balances → **made-public**;
   - a pool instruction with neither → **unknown**.

   The primary asset is the account's `A0.mint` delta. The rho-marker rent the depositor pays, and the relayer's SOL gas grant on a withdrawal, are listed in #27 only.
3. **Wrap or unwrap** (review C4). The only non-rent deltas are native and wSOL (`So11111111111111111111111111111111111111112`), with opposite signs, and `|native| == |wSOL|` once rent is split out (§4.2):
   - native − and wSOL + → **wrap**;
   - native + and wSOL − → **unwrap**.

   An unwrap by closing the wSOL account has the account's rent refund as a rent delta.
4. **Swap.** Ignoring rent, at least one negative and at least one positive delta. `via` is `'Jupiter'` when a top-level instruction is Jupiter v6's program.
5. **Sent.** Ignoring rent, only negative deltas.
6. **Received.** Ignoring rent, only positive deltas.
7. **Account setup** (review C4). The only deltas are rent: creating one's own token account, or closing an empty one. Title "Transaction", secondary "Account setup", with the true amount.
8. **No funds moved.** No deltas at all, and `incomplete` is false.
9. Anything else → **unknown**.

### 4.4 Which asset a row shows (review C5)
`deltas` is ordered:
1. non-rent before rent;
2. non-native before native;
3. among those, by mint string.

Then:
- `primary`:
  - **sent / received:** `deltas[0]`;
  - **swap:** the first negative non-rent delta. `secondary` is the first positive non-rent delta.
  - **made-private / made-public:** the `A0.mint` delta.
  - **wrap / unwrap:** the native delta.
  - **account-setup:** the rent delta.
  - **failed / no-funds-moved / unknown:** null.
- `extraAssets`: the number of non-rent deltas besides `primary` and `secondary`.
- **The markup fee.** A native movement to `NOCTURA_FEE_TREASURY` is a separate SOL delta when the account paid it. On a token send it is therefore not `deltas[0]`, because non-native comes first. On a SOL send the treasury part is subtracted, as in PR 1: a treasury transfer is markup when another transfer exists. #27 shows it as "Noctura fee".

### 4.5 Counter-party (review C3)
The counter-party is computed for `primary` only, and only for **sent** and **received**:
- **SOL primary:** the candidates are every index other than the account's whose lamports moved the opposite way, after:
  - adding the fee back to index 0;
  - excluding every index named in `pre`/`postTokenBalances` (token accounts);
  - excluding accounts created or closed in this transaction (rent, §4.2);
  - excluding `NOCTURA_FEE_TREASURY` when another candidate exists;
  - excluding `A0_RELAYER.feePayer`.

  Exactly one candidate → it. Otherwise → null.
- **Token primary:** the candidates are the owners of every token entry in the same mint that moved the opposite way, minus the account. Exactly one owner → it. Otherwise, including an entry with no owner → null.
- **The fee payer.** Being the fee payer neither qualifies nor disqualifies an address. In an ordinary receive the sender is index 0 and is the counter-party.

**Shown as:**
- a wallet of this seed → its label from the registry ("Account 2", "Account 1 (main)"); with an unreadable registry, the short form;
- any other wallet → `shortAccountAddress`, first 6 … last 6 (review I9, `screen.md` §0; a 4…4 form collides with the recorded poisoning address).

### 4.6 #27 (review I8)
- **Hero.** It comes from `classifyActivity` for the account the detail was opened from. It needs the raw transaction, so #27 reads `['parsedTx', cluster, signature]` (§3.3) and runs both `classifyActivity` and `parseTxDetail` on it. The route already carries `{signature, account}`.
- **Eyebrow:** SENT, RECEIVED, SWAPPED, MADE PRIVATE, MADE PUBLIC, WRAPPED SOL, UNWRAPPED SOL, FAILED, or TRANSACTION.
- **Hero amount:** `primary` **without a sign**, with its symbol, as in PR 1 and `screen.md` §27. A swap shows "{out} {sym} → {in} {sym}". With no `primary` there is no amount line.
- **From / To / Authorized by (PR 1 rows)** show only when `parseTxDetail`'s transfer agrees with the hero:
  - same mint as `primary`;
  - the account is the transfer's `from` for sent, or its `to` for received.

  Otherwise those rows are replaced by "Fee payer" and a **"Balance changes"** list of every delta ("−0.0001 TEST", "−0.00204 SOL · account rent", "+0.002 SOL · gas grant"). The relayer's grant is labelled when the fee payer is `A0_RELAYER.feePayer`.
- **"≈ ${x} at today's price"** sits under the hero when a price for `primary` is known (H7). It is absent otherwise.
- **Deep link.** With a null account, the hero is "TRANSACTION" with no amount, as in PR 1.

## 5. The #26 screen

### 5.1 Rows (H7, H8)
Copy lives in `src/copy/transactions.ts`, which is inside both copy guards. No guard regex changes. `{sym}` is `primary.symbol`.

| kind | Icon | Title | Secondary line | Amount (right) |
|---|---|---|---|---|
| sent | arrow up-right | Sent {sym} | "to {cp} · {time}", or "{time}" | −{amount} |
| received | arrow down-left | Received {sym} | "from {cp} · {time}" | +{amount} (success colour) |
| swap | swap arrows | Swapped {out} → {in} | "via Jupiter · {time}", or "{time}" | −{out amount}; under it "+{in amount} {in sym}" |
| made-private | shield + private badge | Made private {sym} | "{time}" | −{amount} |
| made-public | shield + private badge | Made public {sym} | "{time}" | +{amount} |
| wrap / unwrap | swap arrows | Wrapped SOL / Unwrapped SOL | "{time}" | −/+{SOL amount} |
| account-setup | gear | Transaction | "Account setup · {time}" | −/+{amount} SOL |
| failed | warning (danger) | Failed | "{time}" | "—"; under it "fee {fee} SOL" only when `feePaidByAccount` is set |
| no-funds-moved | dot | Transaction | "{time}" | "No funds moved" (tertiary) |
| unknown | dot | Transaction | "{time}" | "—" |
| partial (§3.4) | dot | Transaction | "{time}" | "—" |

- When `extraAssets > 0`, the amount line ends in " +{n} more".
- `incomplete` rows of kind sent/received/swap show their amount followed by " · incomplete" in tertiary.
- **Formatting.** Amounts use the shared formatter, which takes an unsigned value; the sign is added outside it. "<0.0001" applies.
- **{time}:** "HH:mm" for Today and Yesterday, else "d MMM" ("6 May"). It is formatted by a pure function that takes the time zone (§5.3).

### 5.2 Chips (review I6)
| Chip | Shows |
|---|---|
| All | every row |
| Sent | `sent` |
| Received | `received` |
| Swaps | `swap` |
| Shielded | `made-private`, `made-public` (shielded accent) |

- Chips filter the rows loaded so far. They are 44 dp touch targets.
- **While older pages exist**, a chip with no loaded match shows "No {chip} transactions in the last {n}", where `{n}` is the number of loaded transactions, and an explicit **"Load older"** button.
- **Automatic loading** on scroll is capped at 3 pages per chip selection. After that only "Load older" loads.
- "No {chip} transactions yet" shows only at the end of history.

### 5.3 Sections, loading and states (review I12)
- `sectionOf(blockTime, now, tz)` is pure, and `now` and `tz` are passed in. Calendar days are in the device's zone, and a week starts on Monday:
  - **Today:** the same calendar day as `now`.
  - **Yesterday:** the previous calendar day.
  - **This week:** an earlier day in the same Monday-start week as `now`.
  - **This month:** an earlier day in the same calendar month, not already above.
  - **{Month YYYY}:** anything older.
  - **Date unknown** (last): no `blockTime`.
- **Determinism.** Jest config pins `TZ=UTC`. No test asserts raw `toLocaleString` output.
- **Cold load:** 5 skeleton rows across 2 sections (26a).
- **Unchanged:**
  - "Couldn't load transactions · tap to retry";
  - the account label under the title;
  - an empty list area while no account is resolved;
  - the row tap opening #27 with `{signature, account}`.
- **A loaded empty account:** the copy stays "No transactions yet" (§11 on #41).

## 6. Retroactive "linked" scan (H4, H5)

### 6.1 Module
`src/modules/accounts/linkScan.ts` has two parts:
- `transactionLinks(raw, exit, seedWallets) → boolean`: pure.
- `scanExitForLinks(exit, seedWallets, deps) → Promise<'linked' | 'clean' | 'failed'>`.

Scanned accounts are role `fresh-exit` with `linked !== true` only; `fresh-pending` is not scanned. `seedWallets` is every address in `AccountList.seed` (main and `fresh-pending` included) other than `exit`.

### 6.2 The rule (H4)
`transactionLinks` is true when the transaction's account keys (the full list) contain **both**:
- `exit`, or a token account whose owner in `pre`/`postTokenBalances` is `exit`; and
- a `seedWallets` member, or a token account whose owner there is one.

`meta.err` is not consulted. A third party can put an exit and main into one transaction (dust); the tag then errs on the warning side (§9).

### 6.3 Sources, cursor and paging (review C2, I1, I2)
- **Sources.** As in §3.1: the exit wallet and every token account it owns (classic and Token-2022). Each has its own cursor.
- **The cursor** is the newest **finalized** signature fully scanned for that source. It is stored in **encrypted** MMKV under the new key `v1_linkScanCursors` as `{[exit]: {[source]: signature}}`, and cleared through `onSecureMmkvReset`.
- **Reading a source.** Page backwards with `before`, 20 at a time, until the cursor is reached or the source is exhausted. The first scan has no cursor and a hard cap of 300 signatures per source. Transactions are read as in §3.3, and the cache is shared with history.
- **Stopping at a link.** A link found → `markA0AccountsLinked([exit])`, and the scan of that exit ends. No cursor is needed after a link.
- **Any null or failed transaction read** → the result is `failed`, and no cursor for that source moves.
- **A clean source** moves its cursor to the newest finalized signature read. A confirmed-but-not-finalized signature is scanned but never becomes the cursor, so it is scanned again next time.
- **When the cap stopped a first scan,** the cursor is still set (§9: older history is not scanned).

### 6.4 When it runs (review I3)
- The sheet opens → `drainLinkQueue()` → the scan for each scannable exit, one at a time.
- **Single-flight:** an open while a scan runs joins it.
- **Minimum interval:** 60 s per exit, held in memory.
- **Generation guard.** The scan captures a generation number that `onSecureMmkvReset` increments. A result or cursor write from an older generation is dropped. This is the same class as the wallet-change guard in the sync (237752a).
- **A hit** → `markA0AccountsLinked([exit])`, which tags fresh-exit only and never main. The sheet re-reads the list.
- **A failure** is silent. The sheet renders at once, and the tag appears when found.

## 7. Presale (H6)

- `PresaleScreen` reads `lastSyncedAt` / `lastSyncFailedAt` and derives `balanceKnown` with `mainBalanceIsStale` / `mainBalanceIsUnknown`, exactly as `SwapScreen` does.
- **While not known:**
  - the balance reads "—";
  - a tappable note reads `SEND_BALANCE_STALE`, `SEND_BALANCE_RETRY` or `SEND_BALANCE_CHECKING`; the tap calls `forceSync`, single-flight, with `noteBusy` as on Swap;
  - MAX is dimmed (`opacity-40`) and disabled;
  - `canBuy` is false;
  - no "insufficient" line shows.
- The float conversions there (`Number(...)/1e9`) are pre-existing and unchanged (§9).

## 8. Testing

### Fixtures
- **Verbatim chain responses only.** Already in the repo: `tx-sol-transfer.json`, `tx-test-to-main.json` (`QAgzVzY6…`, Account 2 → main's existing ATA; do not add it twice), `tx-test-to-outside.json`.
- **New from devnet:**
  - a pool deposit from main;
  - the relayed unshield `54J9kjQ8…` into Account 3;
  - Account 4 → main `2XgjNKS8…`;
  - a wrap into a new wSOL account;
  - an unwrap by close;
  - the close of an empty token account;
  - creating one's own ATA;
  - a token send that creates the recipient's ATA;
  - a failed transaction;
  - a relayed failed transaction, if one exists;
  - a Token-2022 transfer.
- **New from mainnet:** a real Jupiter v6 swap. It is public data, captured verbatim, with its signature in the file name.
- The controller captures the fixtures. The plan names each signature.

### Classifier
- One test per kind.
- The fee is excluded from the SOL delta.
- A received SOL transfer names its sender (the fee payer).
- A token send that creates an ATA names the recipient wallet and shows the token, not the rent.
- A send with the markup shows the recipient and the token.
- `54J9kjQ8…` shows the token, not the gas grant.
- A deposit shows the token, not the rho rent.
- A wrap is "wrap" (not swap, not sent), and an unwrap is "unwrap".
- A close is account-setup.
- An owner-less entry sets `incomplete`.
- `A0_RELAYER.feePayer` is never the counter-party.
- A Token-2022 delta is read.

### History reading
- `QAgzVzY6…` appears in main's history through main's token-account source.
- Merge order and dedupe across sources and pages.
- The limiter key differs per page.
- The batch path, and the fallback when the batch throws.
- A partial row.
- End of history.
- The cache is used, with no second read of a cached signature.
- An account switch never shows the old rows.

### Screen
- Each row form.
- Chips, the empty-chip line, "Load older", and the 3-page cap.
- `sectionOf` with an injected `now` and `tz`, including the week and month boundaries.
- Skeleton.
- "No transactions yet" only at the end of history.

### #27
- The hero equals the row for the same fixture and account.
- From/To are hidden when they disagree, and the balance-changes list shows instead.
- "at today's price" appears only with a price.

### Link scan
- Positive: `QAgzVzY6…` via the exit's own source (Account 2 is the sender), and `2XgjNKS8…`.
- Positive: main → exit's existing ATA, found through the exit's token-account source while the exit is absent from the keys. Synthetic if devnet has none; the controller makes one if possible.
- Negative: `54J9kjQ8…`.
- A failed transaction with both keys links.
- 150 new signatures with the link at the 120th are found by `before` paging.
- A null transaction read → `failed`, and the cursor is unmoved.
- A confirmed-only signature never becomes the cursor.
- Generation guard.
- Single-flight and the minimum interval.
- Main is never passed to `markA0AccountsLinked`.

### Presale
Stale, unknown and never-synced states, each with a fresh control, and the MAX dim.

### Gates
- `npx jest` passes on Node 24 (local) **and** on Node 22 (`/usr/bin/node`, the CI version). **No test combines jest fake timers with async `act`.**
- `tsc`.
- `lint:ci` stays at 143 warnings.
- The TGE-date check.

## 9. Known limits

- **Older history.** An exit's first scan reads at most 300 signatures per source. History reads page on demand.
- **Closed token accounts.** History and the scan read the token accounts a wallet owns now. Transactions that touched only a token account the wallet has since closed are not found.
- **Token-2022 holdings** appear in history but not in the dashboard balances, which still read only the classic program (pre-existing).
- **The "linked" tag is a lower bound,** and it may err on the warning side: a third party's transaction naming two seed wallets (dust) tags the exit.
- **A Make public row** on the receiving account shows no source, because the pool hides it.
- **"via"** is named only for Jupiter v6. Other programs read just "Swapped".
- **Presale's float conversions** are pre-existing.
- **The RPC provider** sees every request, as #17 already says. History and the scan send one request per signature read.

## 10. Design files

Make dated backups (`*.bak-2026-11-26c`, or the next free letter), then change the design per screen.

**#26**
- Replace the build-status note with what is built.
- Remove the USD figures from the rows (H7).
- Change counter-parties to the 6…6 form.
- Turn the "shielded send/receive" rows into "Made private TEST" / "Made public TEST" with the badge.
- Add "Wrapped SOL", "Transaction · Account setup", the partial row, the empty-chip line with "Load older", and the "Date unknown" section.
- Change the failed row: no reason line, and a fee only when paid.
- Remove the dApp signature row.

**#27**
- Hero rules (§4.6), "≈ … at today's price", and the "Balance changes" list.

**#23 presale:** a stale state.

**Accounts sheet:** a note that the tag can appear after a moment.

## 11. Changed or deferred from the design (review I10)

| Design element | This PR | Why |
|---|---|---|
| OriginBadge "Wallet" / "Dapp · simulated" on rows and #27 | Not shown | Chain data does not say which app built a transaction. A badge would be a guess. |
| "dApp signature" row | Shown as "Transaction · No funds moved" | The same reason: the origin is not known. |
| Failed row reason ("slippage exceeded") | Not shown | Error codes map to text per program, and a wrong reason is worse than none. Deferred. |
| USD under row amounts | Removed (H7) | Only today's price is known. |
| Counter-party 4…4 in the mockup | 6…6 | `screen.md` §0, and the recorded poisoning collision. |
| Screen title "Activity" and the tab bar | Kept as "Transaction History" with Back | The screen is reached from the dashboard's History button (M1d). The Explore tab is not built. |
| #41 empty-activity screen | The existing "No transactions yet" line | #41 is not built. Deferred. |
| Asset in the title, symbol-less amount, icons | As designed (H8) | |
