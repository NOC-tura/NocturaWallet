# PR 2 — Transaction history parsing, retroactive "linked" scan, presale stale label

**Date:** 2026-11-26. **Branch:** `feat/history-parsing`, from `main` at 7f3f235 (PR #127 merged).

**Owner decisions:** made in chat on 2026-11-26. The owner reads Slovenian; this spec is English.

**Follows:** `docs/superpowers/specs/2026-11-22-post-m1d-fixes-design.md`. PR 1 left these items for PR 2:
- history parsing;
- a retroactive "linked" scan;
- the presale stale label.

**Design target:** the owner's `/home/user/Downloads/index.html` and `screen.md`:
- #26 "activity": states 26a–26d, chips All / Sent / Received / Swaps / Shielded, date sections, TxRow with icon, type, counter-party and amount;
- #27 tx-detail.

The design files are approximate. Improve them as we build, with dated backups, and report what changed per screen.

## 1. Goals and rules

1. **#26 shows real rows.** Each row has:
   - a type word;
   - a counter-party;
   - a signed amount with its symbol;
   - the time.

   Rows sit under date sections. Chips filter them.
2. **The rule above all: a wrong row is worse than none.** A field the wallet cannot read from chain reads "—" or the neutral word "Transaction". It is never guessed.
3. **Every exit account linked on chain carries the "linked" tag.** This covers links made before the tag existed, a send whose confirmation the app never saw, and a landed-but-failed send.
4. **Presale treats a stale or unknown main balance as Send, Swap and #16 do.** It refuses to spend the balance and offers a tap to retry.

**Non-goals:**
- private peer-to-peer transfers (they do not exist);
- notifications;
- a backend indexer;
- NFT rows;
- any change to how a transaction is built or signed.

## 2. Owner decisions (2026-11-26)

| # | Question | Decision |
|---|---|---|
| H1 | Where history comes from | **A.** Read the chain through the app's existing RPC and parse it on the device. No Helius Enhanced API and no backend. |
| H2 | What a row's amount is | **The account's net change per asset**, read from the balances before and after the transaction. It is not the "first transfer" that #27 used in PR 1. This is the convention of mainstream Solana wallets. |
| H3 | How pool moves are named | **A.** "Made private" (a deposit from this account) and "Made public" (a withdrawal into this account). They carry the private-mode badge, sit under the **Shielded** chip, and are never counted as Sent or Received. |
| H4 | The linked rule | An exit account is linked when it appears in **one transaction** with another wallet of this seed, or with a token account owned by one. Direction does not matter. A **failed** transaction counts, because it is on chain and shows both. A relayed Make public into a new account does not link, because no other seed key is in it. The main account is never tagged. |
| H5 | When the scan runs | When the Accounts sheet opens, in the background, for every exit account not yet tagged. The first scan reads up to 100 signatures; later scans read only newer ones. A failure is silent and retries on the next open. A tag is never removed. |
| H6 | Presale | Stale main → "—" plus "Not updated · tap to retry". Never read → "Balance unavailable · tap to retry". MAX and Buy stay disabled until the balance is known. |

## 3. Reading the history (H1)

### 3.1 Requests per page
One page is 20 signatures:
- `getSignaturesForAddress(account, {limit: 20, before})`, as today;
- then **one** `getParsedTransactions(signatures, {maxSupportedTransactionVersion: 0})` for those 20.

Both go through `rpcLimiter`. A page therefore costs 2 requests, not 21.

**Risk the plan must check first:** whether the configured RPC (Helius, and the devnet endpoint) accepts the batched call.
- If it refuses the batch, the fallback is sequential `getParsedTransaction` calls through `rpcLimiter`, at most 4 in flight.
- Choosing between the two is a plan task with a test on each path. It is not a guess.

### 3.2 A page that reads only partly
The signatures read, but some parsed transactions come back `null` (not indexed yet) or the parsed request fails:
- Those rows still show, with date and status and the neutral type "Transaction".
- Their amount is "—".
- They are re-read on the next refresh.
- A row is never dropped, and a failed parse never becomes a "Sent".

### 3.3 Paging and refresh
- Infinite scroll loads the next page when the list end is reached, using `before` set to the last signature.
- Pull-to-refresh re-reads the first page.
- The query key holds the account address, so switching accounts never shows another account's rows.
- "No transactions yet" shows only after a good empty first page. That rule is unchanged from M1d.

## 4. Classifying a transaction (H2, H3)

### 4.1 The model
`src/modules/solana/activity.ts` holds the pure function `classifyActivity(raw, account, ctx) → ActivityRow`. It sits beside `txDetail.ts`.

```
ActivityRow {
  signature; status: 'confirmed' | 'finalized' | 'failed'; blockTime: number | null; slot;
  kind: 'sent' | 'received' | 'swap' | 'made-private' | 'made-public' | 'wrap' | 'unwrap' | 'no-funds-moved' | 'failed' | 'unknown';
  /** this account's net change per asset, fee excluded; amounts exact (BigInt), decimals known or the entry is omitted */
  deltas: Array<{mint: string | 'native'; symbol: string; raw: bigint; decimals: number}>;
  /** the other side when exactly one is known: a wallet (owner of a token account when the balances name it) */
  counterparty: string | null;
  /** 'Jupiter' when the Jupiter program is a top-level instruction; null otherwise */
  via: string | null;
  feeLamports: bigint;
}
```

`ctx` carries `symbolOf(mint)`, the trusted symbol source used in PR 1, and the constants.

### 4.2 Net change
- **SOL:** `postBalances[i] − preBalances[i]` for the account's own index. The fee is added back when the account is the fee payer (index 0).
- **Tokens:** for every token balance entry whose **owner** is the account, `post − pre` per mint. An entry with no pre (or no post) side counts that side as 0. Token and Token-2022 are both read.
- A delta of 0 is dropped.
- An entry whose decimals are not known is omitted, never shown in base units.
- When an entry was omitted, the row is never classified as 'no-funds-moved'.

### 4.3 Kind
Rules apply in this order, first match wins:
1. `meta.err` is set → `failed`. The row shows the fee paid and "—" for the amount.
2. A top-level instruction of the A0 pool program (`FeGSS…`, `src/modules/shielded/a0/constants.ts`):
   - the account's net change is negative → `made-private`;
   - positive → `made-public`.

   Program id and pool account are matched exactly as `syncedTx.ts` matches them.
3. A wrap: a negative native delta and a positive wSOL delta of the same amount in one transaction → `wrap`. The reverse → `unwrap`.
4. At least one negative and at least one positive delta → `swap`. `via` is `'Jupiter'` when a top-level instruction is Jupiter's program, else null.
5. Only negative deltas → `sent`.
6. Only positive deltas → `received`.
7. No deltas, and nothing was omitted → `no-funds-moved`.
8. Anything else → `unknown`.

### 4.4 Counter-party
- **Sent or received with exactly one other wallet whose balance moved the opposite way** (SOL: by index; tokens: by owner) → that wallet.
- **Anything else** (several, none, or only a token account with no owner) → null. The row then shows no "to"/"from" part.
- **The relayer or fee payer** is never the counter-party.
- **A wallet of this seed** shows as its label ("Account 2", "Account 1 (main)"). Any other wallet shows the short form `first4…last4`, as the design draws it.

### 4.5 #27 agrees with the row
- #27's hero (eyebrow and amount) comes from `classifyActivity` for the account the detail was opened from. A row and its detail therefore never disagree.
- The detail rows (From, To, Authorized by, Hash, Block, Fee) keep `parseTxDetail` from PR 1.
- When the account is null (a deep link), the hero is "Transaction" with no amount, as in PR 1.
- This replaces PR 1's "first top-level transfer" limit for the hero.

## 5. The #26 screen

### 5.1 Rows
Row text follows the design. Copy lives in `src/copy/transactions.ts`, which is inside both copy guards. No guard regex changes.

| kind | Title | Secondary | Amount (right) |
|---|---|---|---|
| sent | Sent | "to {cp} · {time}", or "{time}" when cp is null | −{amount} {sym} |
| received | Received | "from {cp} · {time}" | +{amount} {sym} (success colour) |
| swap | Swap | "via Jupiter · {time}", or "{time}" | −{out} {sym}, with +{in} {sym} on the line under it |
| made-private | Made private | "{time}" + private-mode badge | −{amount} {sym} |
| made-public | Made public | "{time}" + private-mode badge | +{amount} {sym} |
| wrap / unwrap | Wrapped SOL / Unwrapped SOL | "{time}" | the SOL side |
| failed | Failed | "{time}" | "— {sym}" when one asset was involved, else "—"; fee under it |
| no-funds-moved | Transaction | "{time}" | "No funds moved" (tertiary) |
| unknown | Transaction | "{time}" | "—" |

**Several assets moved one way** (for example, sent SOL and a token together): the row shows the first asset with "+N more", and #27 lists all of them.

**Amounts:** formatted with the shared formatter, so "<0.0001" applies.

**USD under the amount:** only when a price is known for that mint, through `useResolvedPrices` and `priceKeyFor`. Otherwise there is no USD line, never "$0.00".

### 5.2 Chips
| Chip | Shows |
|---|---|
| All | every row |
| Sent | `sent` |
| Received | `received` |
| Swaps | `swap` |
| Shielded | `made-private`, `made-public` |

- Chips filter the rows loaded so far.
- A chip with nothing loaded reads "No {chip} transactions in the last {n}" while older pages exist, and loads on scroll. "No {chip} transactions yet" appears only once the end of history is reached.
- The Shielded chip uses the shielded accent, as the design draws it.
- Each chip has a 44 dp touch target.

### 5.3 Sections, loading and states
- **Date sections:** "Today", "Yesterday", "This week", "This month", then "{Month YYYY}". They use device-local time (UTC elsewhere). A row with no `blockTime` goes into a final "Date unknown" section.
- **Cold load:** 5 skeleton rows across 2 sections (state 26a). This replaces "Loading transactions…".
- **Unchanged:**
  - the error line "Couldn't load transactions · tap to retry";
  - the empty state;
  - the account label under the title;
  - an empty list area while no account is resolved.
- **Row tap:** opens #27 with `{signature, account}`, as today.

## 6. Retroactive "linked" scan (H4, H5)

### 6.1 Module
`src/modules/accounts/linkScan.ts` has two parts:
- `transactionLinks(raw, exit, seedWallets) → boolean`: pure.
- `scanExitForLinks(exit, seedWallets, deps) → Promise<'linked' | 'clean' | 'failed'>`.

`seedWallets` is every address in `AccountList.seed` (main included, `fresh-pending` included) other than `exit`.

### 6.2 The rule (H4)
`transactionLinks` is true when the transaction's account keys contain **both**:
- `exit`, or a token account whose owner in `pre`/`postTokenBalances` is `exit`; and
- any `seedWallets` member, or a token account whose owner there is one.

`meta.err` is **not** consulted, because a failed transaction links too.

### 6.3 Cursor and cap (H5)
- **First scan:** reads `getSignaturesForAddress(exit, {limit: 100})`.
- **Later scans:** read only signatures newer than the stored cursor, via `until`, up to 100.
- **The cursor** is the newest signature scanned. It is stored per address in **encrypted** MMKV under a new `v1_` key, and cleared on a secure-storage reset, as the link queue is.
- **Order:** transactions are parsed in pages of 20, as in §3.1. The scan stops at the first link.
- **When the history holds more than 100 signatures** on the first scan, the cursor is still set to the newest. The older ones are a known limit (§9), and the tag stays a lower bound.

### 6.4 When it runs
- Every time the Accounts sheet opens: once per exit account that is not tagged, one exit at a time.
- **Single-flight:** a second open while a scan runs joins it.
- **Order:** it runs after `drainLinkQueue()`.
- **A hit** goes through the existing `markA0AccountsLinked([exit])`, which tags fresh-exit only and never main. The sheet re-reads the list.
- **A failed read** leaves the cursor where it was and does nothing visible.
- **The sheet** renders at once. The tag appears when the scan finds it.

## 7. Presale (H6)

- `PresaleScreen` reads `lastSyncedAt` / `lastSyncFailedAt` and derives `balanceKnown` with `mainBalanceIsStale` / `mainBalanceIsUnknown`, as Swap and #16 do.
- **While not known:**
  - the balance reads "—" with the tappable note `SEND_BALANCE_STALE`, `SEND_BALANCE_RETRY` or `SEND_BALANCE_CHECKING` (the tap calls `forceSync`);
  - MAX is dimmed (`opacity-40`) and disabled;
  - `canBuy` is false;
  - no "insufficient" line shows.
- The number conversions there (`Number(...)/1e9`) are not changed in this PR. They are noted as pre-existing in §9.

## 8. Testing

**Fixtures**
- Use verbatim devnet responses. Already in the repo: `tx-sol-transfer.json`, `tx-test-to-main.json`, `tx-test-to-outside.json`.
- Add new ones from chain: a pool deposit from main, the relayed unshield `54J9kjQ8…` into Account 3, Account 2's link `QAgzVzY6…`, and Account 4 → main `2XgjNKS8…`.
- Devnet has no Jupiter, so a swap fixture may be built by hand. Its file name and header say it is synthetic.

**Classifier**
- One test per kind, each with a fixture.
- The fee is excluded from the SOL delta.
- A Token-2022 delta is read.
- An unknown-decimals entry is omitted, and the row is not "no funds moved".
- The relayer is never the counter-party.
- A wrap is not "Sent".

**Link scan**
- Positive: `QAgzVzY6…` and `2XgjNKS8…`.
- Negative: the relayed unshield `54J9kjQ8…`.
- A failed transaction with both keys links.
- The cursor is used with `until` and is not moved on a failure.
- Single-flight.
- Main is never passed to `markA0AccountsLinked`.

**Screen**
- Chip filtering, including the empty-chip line with more pages.
- Date sections.
- Skeleton.
- A partial page (§3.2).
- An account switch never shows the old rows.

**#27:** the hero equals the row for the same fixture and account.

**Presale:** stale, unknown and never-synced states, each with a fresh control.

**Gates**
- `npx jest` must pass on **both Node 24 (local) and Node 22 (`/usr/bin/node`, as CI uses)**. PR 1 lost a CI run to a fake-timer hang that only Node 22 showed. New tests avoid `jest.useFakeTimers` with `await act(async…)`.
- `tsc`.
- `lint:ci` stays at 143 warnings.
- The TGE-date check.

## 9. Known limits

- **Old history:** links older than the 100 newest signatures of an exit account are not seen on the first scan. Exit accounts are fresh and short-lived, so this is unlikely.
- **Pool rows do not show the destination.** A Make public row on the receiving account says "Made public" with no source. The pool hides it, and that is the point.
- **Several assets moving one way** show the first asset with "+N more" in the row. All of them are listed in #27.
- **"via" is named only for Jupiter.** Other programs read just "Swap".
- **Presale's float conversions** are pre-existing and unchanged.
- **The RPC provider sees every request,** as #17 already says.

## 10. Design files

Make dated backups (`*.bak-2026-11-26c` or the next free letter) and change:
- **#26:**
  - the build-status note is replaced by what is built;
  - "Made private" / "Made public" rows with the private badge under the Shielded chip (the design's "shielded send/receive" rows become these, because private transfers do not exist);
  - a "Wrapped SOL" row;
  - the partial row ("Transaction · —");
  - the empty-chip line;
  - the "Date unknown" section.
- **#27:** the note that the hero follows the row (§4.5).
- **#23 presale:** a stale state.
- **Accounts sheet:** a note that the tag can appear after a moment.

Report each change per screen to the owner.
