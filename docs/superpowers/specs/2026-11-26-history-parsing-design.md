# PR 2 — Transaction history parsing, retroactive "linked" scan, presale stale label

**Date:** 2026-11-26. **Revision:** r5 (2026-11-27) — an amendment of §3.3 after the plan review r2 (`.superpowers/sdd/2026-11-26-history-parsing-plan-review-r2.md`): transactions are read at **version 1** by the **owner's decision of 2026-11-27**, and an answer is matched to a signature by its own signature (review C1). §8 and §9 follow; nothing else changed. r4 was **Fable APPROVED** (review r4; minors q1–q3 folded). r4 folds in Fable spec review r3 (P1, m-a to m-g). r3 folded in review r2 (N1–N7, m1–m8). r2 folded in Fable spec review r1, which was NOT APPROVED (5 Critical, 13 Important, 10 Minor), and the owner's answers H7–H8.

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

### 3.2 The merged stream (review r2 N5)
**State.** A **history session** object lives outside the query cache, in `src/modules/solana/historySession.ts`. It is keyed by cluster and account, and it is dropped on an account switch, on a network switch, and on `onSecureMmkvReset`. Per source it holds `{buffer, cursor, exhausted}`:
- `buffer`: signatures fetched but not yet emitted, in the order the source returned them;
- `cursor`: the last signature **fetched** from that source, used as `before` for the next fetch;
- `exhausted`: the last fetch returned fewer than its `limit` (20).

**A source is fetched** (`getSignaturesForAddress(source, {limit: 20, before: cursor})`) exactly when its buffer is empty and it is not exhausted. Before each take, every such source is fetched, so no row surfaces a page late (review r3 m-b). Un-emitted items stay in the buffer and are never fetched again.

**Building a page.**
- Repeatedly take the newest head across all buffers, compared by `slot`, and append it unless its signature was already emitted (dedupe across sources and pages).
- Stop at 20 rows or when every source is exhausted and empty.
- A page's rows are then sorted by `(slot desc, signature asc)`. The order within one slot is fixed, but it is not chain order.
- **The end of history** is reached when every source is exhausted and every buffer is empty.

**Bound on sources.**
- Sources are ordered: the wallet first, then token accounts with a non-zero balance, then zero-balance token accounts.
- At most **25 sources** are read.
- When a wallet owns more, the list footer reads "History from 24 of {m} token accounts" (§9). The wallet itself is the 25th source.
- **Page 1 cost:** one signature call per source, up to 25, plus the transaction reads (§3.3). Later pages fetch only sources whose buffer ran out.
- Plan Task 1 measures a page 1 with 25 sources on mainnet.

### 3.3 Reading transactions, and the cache (review I4, I5)
- Raw parsed transactions are cached per signature under the TanStack key `['parsedTx', cluster, signature]`, with `staleTime: Infinity` and `gcTime: 24 h` (the client default of 5 min would collect them). A landed transaction does not change. A null answer is not cached. `onSecureMmkvReset` clears every `parsedTx` entry.
- **The history query key** keeps today's prefix: `['txHistory', address, cluster, pageSize]`. #21 invalidates `['txHistory', address]` (`TransactionStatusScreen.tsx:132`), and that prefix must keep matching. An invalidation also drops the history session for that account. The `txHistory` query's own refetch (on mount after `staleTime`, or on focus) runs the §3.4 refresh, and loading the next page calls the session (review r3 m-c). That query has its own `staleTime` of 60 s, because a refresh can cost up to 25 signature calls (review r4 q1).
- A page reads only the signatures not yet cached:
  - first with one `getParsedTransactions(signatures, {maxSupportedTransactionVersion: 1})`;
  - **if the batch call throws,** with single `getParsedTransaction` calls for the same signatures, one at a time through `rpcLimiter`.
- **Version 1 — owner decision 2026-11-27** (r5; r1–r4 said `maxSupportedTransactionVersion: 0`). The plan review r2 counted about 46 % of sampled mainnet transactions as version 1; asked for at version 0 the node refuses each with `-32015`, so they could never be read. Version 1 is the highest version web3.js 1.99 parses. The owner decided on 2026-11-27 that PR 2 reads them. Every transaction read of this PR uses 1 — the history, #27, the link scan. A transaction of a higher version, or one a node refuses for any other reason, is still refused: its row is a partial row (§3.4), never a guess.
- **An answer is matched to its signature by the signature it carries** (r5; plan review r2 C1). JSON-RPC 2.0 allows a node to answer a batch in any order, both public endpoints do, and web3.js does not restore the order. So each answer belongs to its own `transaction.signatures[0]`, never to its position in the batch. An answer with no signature, an answer for a signature that was not asked for, and a signature that two answers of one batch claim are all treated as unread: not shown, not cached, asked for again. A single read checks its answer the same way. This is rule §1.2 applied to the read: a row never shows another transaction's data.
- **Cost, stated honestly:** a batch is one HTTP call carrying N JSON-RPC requests. Providers count and rate-limit each one, so a page of 20 new transactions costs 20 provider requests either way. The batch saves round trips, not quota.
- **The limiter key** for any history read contains the method and the cluster, plus:
  - for a signature read, the source and its cursor;
  - for a transaction read, a hash of **every** signature in the batch.

  `rpcLimiter` dedupes in flight by key. A key with less would hand one page's answer to another, or one retry's answer to another (review r2 m2).
- **Plan Task 1 measures this first** against both the devnet and the mainnet endpoint: a 20-item batch, and 20 sequential calls. It records the latency and any refusal before the screen work starts. If the batch is refused, the sequential path is the product path. It also confirms that the app's own provider serves a version-1 transaction (r5); if it does not, the work stops and the owner is told.

### 3.4 Partial pages, refresh and identity
- A signature whose transaction comes back null (not indexed yet) or failed to read **still shows a row**. It has the date and status from the signature list, the title "Transaction", and "—" for the amount. It is never dropped, and never becomes a Sent.
- **Pull-to-refresh** (review r2 N6):
  - re-reads the source list;
  - pages each source from its head with `before` until it meets that source's `newest`, or the source is exhausted. `newest` is the first signature ever fetched for the source in this session, kept in the session (review r3 P1);
  - takes only the signatures newer than `newest`, sets `newest` to the new head, and merges them at the top;
  - re-tries every loaded row that is still unparsed.

  Loaded older pages stay. The session is discarded and history restarts from the head, so no hole can be shown, when:
  - a refresh needs more than 5 pages for one source; or
  - the source list gains a source the session does not know, such as a new token account; or
  - a known source is missing from the re-read list, or is exhausted without meeting its `newest` (review r4 q2).
- Rows are keyed and deduped by signature across pages.
- **Every query key holds the cluster and the account address,** so switching accounts or networks never shows another account's rows.
- "No transactions yet" shows only when the first merged page read successfully, every source is exhausted, and there are zero signatures.

## 4. Classifying a transaction (H2, H3)

### 4.1 Types
`src/modules/solana/activity.ts` holds the pure function `classifyActivity(raw, account, status, ctx) → ActivityRow`, beside `txDetail.ts`.

`status` is passed in from the signature-list item (review r2 m1). A parsed transaction carries no confirmation level; `meta.err` set overrides it to `'failed'`.

`RawParsedTx` is extended with:
- `meta.preBalances` / `meta.postBalances` (number[]);
- `RawTokenBalance.uiTokenAmount.amount` (string, base units);
- `meta.innerInstructions` (`Array<{index, instructions}>`);
- every instruction's two forms: parsed `{program, programId, parsed: {type, info}}` and unparsed `{programId, accounts, data}`.

Amounts are read **only** from `uiTokenAmount.amount`, never from `uiAmount`. `accountKeys` in a parsed response already includes lookup-table addresses, and every index is over that full list.

```
ActivityRow {
  signature; slot; blockTime: number | null;
  status: 'confirmed' | 'finalized' | 'failed';
  kind: 'sent' | 'received' | 'swap' | 'made-private' | 'made-public' | 'wrap' | 'unwrap'
      | 'account-setup' | 'no-funds-moved' | 'failed' | 'unknown';
  primary: Delta | null;            // the asset the row shows (§4.4)
  secondary: Delta | null;          // a swap's incoming leg; null otherwise
  extraAssets: number;              // other deltas with role 'moved' (the "+N more")
  deltas: Delta[];                  // every net change of this account, ordered (§4.4) — #27 lists them
  counterparty: string | null;      // §4.5
  via: 'Jupiter' | null;
  feePaidByAccount: bigint | null;  // the fee when the account is index 0; null when someone else paid (a relayer)
  incomplete: boolean;              // a balance entry could not be attributed (§4.2) — never 'no-funds-moved'
}
Delta { mint: 'native' | string; symbol: string; raw: bigint; decimals: number;
        role: 'moved' | 'rent' | 'markup' | 'grant' }
```

`ctx` carries:
- `symbolOf(mint)`, the trusted symbol source from PR 1;
- the cluster;
- the A0 constants;
- `NOCTURA_FEE_TREASURY`;
- `A0_RELAYER.feePayer`;
- the Jupiter v6 program id `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`;
- `ownTokenAccounts: ReadonlySet<string>`, the account's token-account sources (§3.1).

A row's kind is `'failed'` exactly when `status` is `'failed'`.

### 4.2 Net change (review C3, C4, I11; r2 N1, N2, N3)

**SOL.** For the account's own index `i`: `native = post[i] − pre[i]`, plus `fee` when `i == 0`. The fee is never part of a delta. `feePaidByAccount = fee` when `i == 0`, else null.

**Proven creations and closes (r2 N2).** An account counts as created or closed **only** when one of these instructions names it. Instructions are read **top-level and inner** (`meta.innerInstructions`).

| Program | Parsed `type` | Payer / destination field | Account field | Meaning |
|---|---|---|---|---|
| System | `createAccount` | `source` | `newAccount` | created, paid by `source` |
| System | `createAccountWithSeed` | `source` | `newAccount` | created, paid by `source` |
| Associated Token | `create` | `source` | `account` | created, paid by `source` |
| Associated Token | `createIdempotent` | `source` | `account` | created, paid by `source`, only when that account's `pre` lamports are 0 |
| Token / Token-2022 | `closeAccount` | `destination` | `account` | closed, lamports to `destination` |

There is no inference from `pre == 0` / `post == 0` alone (r2 N4).

**Rent amounts (r2 N1).** Proven accounts are a set keyed by index. Each is counted once, even when an ATA `create` and its inner `createAccount`, or the rho rule and an inner instruction, both prove it (review r3 m-a). For a proven account at index `j`, where `w` is that account's token amount when its mint is wSOL and 0 otherwise:
- **created:** `rent = post[j] − pre[j] − w`, with `w` from its post token balance (`pre[j]` is 0 except for an ATA created at an address that already held lamports);
- **closed:** `refund = pre[j] − w`, with `w` from its pre token balance;
- created and closed in the same transaction (`pre[j] == post[j] == 0`, a swap's temporary wSOL account): contributes nothing.

**Splitting the account's native delta.** In this order:
- `rent` deltas (role `rent`, negative): the rent of every account the account paid to create;
- refund deltas (role `rent`, positive): the refund of every close whose destination is the account;
- `markup` (negative, r2 N3): a top-level system `transfer` with `source == account` and `destination == NOCTURA_FEE_TREASURY`, when the account has another `moved` delta. The amount comes from `info.lamports`. When the account has no other `moved` delta, the treasury transfer stays `moved`, as in PR 1.
- `grant` (positive, r2 N3): in a rule-2 `made-public` transaction whose index 0 is `A0_RELAYER.feePayer`, the account's remaining positive native change;
- the remainder: role `moved`.

**The rho marker (r2 N3).** In a rule-2 `made-private` transaction, the lamports of the `rho_marker` index (`A0_DEPOSIT_ACCOUNTS`) when its `pre == 0` are the depositor's rent, role `rent`, even when no system instruction is parsed for it.

**Tokens.** The account's tokens are every entry in `pre`/`postTokenBalances` whose `owner` is the account; a missing side counts as 0. Their net change per mint is `post.amount − pre.amount` as BigInt, with role `moved`. Token and Token-2022 are read alike.

**Unattributable.** Some entries cannot be attributed:
- an entry with **no owner** whose token account is in `ctx.ownTokenAccounts`;
- an entry of the account with unknown decimals.

Either sets `incomplete: true`. An incomplete row is never `no-funds-moved` and never `account-setup`.

Zero deltas are dropped.

### 4.3 Kind
Rules apply in this order, first match wins. Rule 2 applies only when the build's cluster equals `A0.cluster`.

1. `status == 'failed'` → **failed**.
2. **Pool, decided by role and not by sign** (review C5, r2 m5). A top-level instruction that passes `isOurA0Ix`, which is exported from `syncedTx.ts` and not copied (review r4 q3), (program `A0.programId`, pool at account 0 **and** merkle tree at account 1). Its `data` is base58, and the first 8 decoded bytes are matched against the `deposit` / `withdraw_with_change` discriminators:
   - a `deposit` whose `depositor` (`A0_DEPOSIT_ACCOUNTS`) is the account → **made-private**;
   - a `withdraw_with_change` whose `destination_token_account` is owned by the account in the token balances → **made-public**;
   - a pool instruction with neither → **unknown**.

   `primary` is the account's `A0.mint` delta. When the account has none, `primary` is null and the amount reads "—".
3. **Wrap or unwrap** (review C4). The only `moved` deltas are native and wSOL (`So11111111111111111111111111111111111111112`), with opposite signs and `|native| == |wSOL|` (rent is already split out by §4.2):
   - native − and wSOL + → **wrap**;
   - native + and wSOL − → **unwrap**.
4. **Swap.** Among `moved` deltas, at least one negative and at least one positive. `via` is `'Jupiter'` when a top-level instruction is Jupiter v6's program.
5. **Sent.** `moved` deltas exist and all are negative.
6. **Received.** `moved` deltas exist and all are positive.
7. **Account setup** (review C4). No `moved` deltas, and at least one `rent` delta. Title "Transaction", secondary "Account setup", with the true amount. This includes a non-token `createAccount` paid by the account, such as a stake account (§9).
8. **No funds moved.** No deltas at all, and `incomplete` is false.
9. Anything else → **unknown**.

### 4.4 Which asset a row shows (review C5, r2 N3)
`deltas` is ordered:
1. by role: `moved`, `markup`, `grant`, `rent`;
2. non-native before native;
3. by mint string.

`primary` per kind:
- **sent / received:** `deltas[0]`;
- **swap:** the first negative `moved` delta; `secondary` is the first positive `moved` delta;
- **made-private / made-public:** the `A0.mint` delta (§4.3 rule 2);
- **wrap / unwrap:** the native `moved` delta;
- **account-setup:** the first `rent` delta;
- **failed / no-funds-moved / unknown:** null.

`extraAssets` is the number of `moved` deltas besides `primary` and `secondary`. Markup, grant and rent never count, so a Make private, a relayed Make public, and a token send with markup each show no "+1 more".

#27 labels the roles: "Noctura fee" (markup), "gas grant" (grant), "account rent" (rent).

### 4.5 Counter-party (review C3, r2 N4)
The counter-party is computed for `primary` only, and only for **sent** and **received**.

**SOL primary.** The candidates are every index other than the account's whose lamports moved the opposite way, after:
- adding the fee back to index 0;
- excluding every index named in `pre`/`postTokenBalances` (token accounts);
- excluding accounts **proven** created or closed by the §4.2 table. A plain system transfer to a wallet with 0 lamports before it, or from a wallet left at 0, keeps that wallet as a candidate.
- excluding `NOCTURA_FEE_TREASURY` when another candidate exists;
- excluding `A0_RELAYER.feePayer`.

Exactly one candidate → it. Otherwise → null.

**Token primary.** The candidates are the owners of every token entry in the same mint that moved the opposite way, minus the account. Exactly one owner → it. Otherwise, including an entry with no owner → null.

**The fee payer.** Being the fee payer neither qualifies nor disqualifies an address. In an ordinary receive the sender is index 0 and is the counter-party.

**Shown as:**
- a wallet of this seed → its label from the registry ("Account 2", "Account 1 (main)"); with an unreadable registry, the short form;
- any other wallet → `shortAccountAddress`, first 6 … last 6 (review I9, `screen.md` §0; a 4…4 form collides with the recorded poisoning address).

### 4.6 #27 (review I8, r2 N7)
- **Hero.** It comes from `classifyActivity` for the account the detail was opened from. It needs the raw transaction, so #27 reads `['parsedTx', cluster, signature]` (§3.3) and runs both `classifyActivity` and `parseTxDetail` on it. The route already carries `{signature, account}`. The status is `'failed'` when `meta.err` is set, else `'confirmed'`, as `parseTxDetail` gives it today. A parsed transaction carries no finalized level.
- **Eyebrow:** SENT, RECEIVED, SWAPPED, MADE PRIVATE, MADE PUBLIC, WRAPPED SOL, UNWRAPPED SOL, FAILED, or TRANSACTION.
- **Hero amount:** `primary` **without a sign**, with its symbol, as in PR 1 and `screen.md` §27. A swap shows "{out} {sym} → {in} {sym}". With no `primary` there is no amount line.
- **From / To / Authorized by (PR 1 rows)** show only when `parseTxDetail`'s transfer agrees with the row on all of these:
  - same mint as `primary`;
  - the account is the transfer's `from` for sent, or its `to` for received;
  - `row.counterparty` is not null and equals the transfer's other side (`to` for sent, `from` for received);
  - `toIsTokenAccount` is false.

  Otherwise those rows are replaced by "Fee payer" and a **"Balance changes"** list of every delta, with role labels ("−0.0001 TEST", "−0.00204 SOL · account rent", "+0.002 SOL · gas grant", "−0.00002 SOL · Noctura fee").
- **"≈ ${x} at today's price"** sits under the hero when a price for `primary` is known (H7). It is absent otherwise.
- **Deep link.** With a null account, the hero is "TRANSACTION" with no amount, as in PR 1.
- **`ownTokenAccounts`.** #27 passes the history session's sources when one exists for the account. Otherwise (opened from #21 or a deep link) it passes an empty set, so an owner-less entry does not set `incomplete` (review r3 m-f).
- **State 27f's second case** ("Authorized by" with From "—") is not reachable under the agreement rule. A null `from` always gives the Balance-changes form (review r3 m-e; §11).

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
- **Automatic loading** on scroll stops after 3 consecutive pages that added no row visible under the active chip. The count resets when a page adds one, and when the chip changes. After that, only "Load older" loads (review r2 m4). The All chip never stops, because every page adds rows.
- "No {chip} transactions yet" shows only at the end of history.

### 5.3 Sections, loading and states (review I12)
- `sectionOf(blockTime, now, tz)` is pure, and `now` and `tz` are passed in. `tz` is an IANA zone name (for example `Europe/Ljubljana`), never a fixed offset, so old dates across a DST change fall on the right day (review r2 m7). Calendar days are in the device's zone, and a week starts on Monday:
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
- **Reading a source.** Page backwards with `before`, 20 at a time, until a signature equal to the stored cursor is met (matched by value, not by `until`) or the source is exhausted. Transactions are read as in §3.3, and the cache is shared with history.
- **Cap.** Every scan of a source, first or later, reads at most 300 signatures (review r2 m6). A first scan stopped by the cap sets the cursor (§9). A later scan stopped by the cap is treated as a first scan: it sets the cursor to the newest finalized signature read, and §9's "older history is not scanned" covers the rest (review r3 m-d).
- **A failed source** does not stop the exit's other sources: a link may still be found there.
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
- Both wrap fixtures assert the exact rent delta (r2 N1).
- A `createIdempotent` ATA, and a token account created by CPI (inner instruction), are rent (r2 N2).
- The deposit row and the `54J9kjQ8…` row have `extraAssets == 0`. A token send with markup has `extraAssets == 0` (r2 N3).
- A SOL send to a wallet with 0 lamports before it names that wallet. A receive from a wallet left at 0 names it (r2 N4).

### History reading
- `QAgzVzY6…` appears in main's history through main's token-account source.
- Merge order and dedupe across sources and pages: three sources with interleaved slots across two pages lose no row and repeat none (r2 N5).
- Refresh: 45 new signatures on one source all appear, in order, above the old rows. Past the 5-page cap, the session restarts (r2 N6).
- Refresh with two sources, where the second has emitted nothing yet, takes only signatures newer than its `newest` and does not restart. A new token account in the source list restarts the session (r3 P1).
- The 25-source bound and its footer line.
- The limiter key differs per page.
- The batch path, and the fallback when the batch throws.
- A batch answered out of order, and one holding an answer nobody asked for: each row shows its own transaction or none (r5).
- Version 1: two real version-1 mainnet transactions (a SOL transfer, a Jupiter swap) are classified like any other; the reads ask for version 1 (r5).
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
- From/To are hidden when they disagree, and the balance-changes list shows instead. A two-recipient send shows no To (r2 N7).
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
- **Cache size:** raw transactions stay cached for 24 h with no count bound. A large swap is tens of kB, so a long history session uses memory in proportion (review r3 m-g).
- **Large wallets:** history reads at most 25 sources, so a wallet with more token accounts says so in the list footer.
- **A stake or other non-token account** created and paid by the account reads "Transaction · Account setup" with its full amount. That is true, but terse.
- **The RPC provider** sees every request, as #17 already says. History and the scan send one request per signature read.
- **A transaction above version 1,** or one a node will not serve, stays "Transaction —" (r5). Version-1 reading was tested on Node, not on a phone.

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
| #27 state 27f, second case ("Authorized by" with From "—") | Not reachable; the Balance-changes form shows instead | The §4.6 agreement rule. |
| Date format "May 6" | "6 May" | Day-first, as the app's other dates (PR 1 History rows). |
| Sections end at "This week" | Adds "This month", "{Month YYYY}" and "Date unknown" | Longer histories need them. |
