# History parsing, retroactive "linked" scan, presale stale label (PR 2 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** #26 shows real rows — a type icon, a title naming the asset, a counter-party when one is known, the time and
a signed amount, under date sections and behind chips — read from chain and parsed on the device; every exit account
linked on chain gets its "linked" tag from a background scan; presale refuses a stale or unknown main balance.

**Architecture:** One pure classifier (`src/modules/solana/activity.ts`) turns a parsed transaction into a row for ONE
account from that account's net balance changes; it is the single source of #26's rows and of #27's hero. The history
is read through a set of *sources* (the wallet and every token account it owns), merged newest-first by a session
object that lives outside the query cache (`historySession.ts`). Raw parsed transactions are cached per signature in
TanStack Query (never stale, kept 24 h) and shared by #26, #27 and the link scan. The link scan
(`modules/accounts/linkScan.ts`, run by `linkScanRunner.ts` when the Accounts sheet opens) pages each untagged exit's
sources down to a stored finalized cursor.

**Tech Stack:** React Native 0.84 (Fabric, Hermes), TypeScript strict, Zustand + MMKV, TanStack Query v5, NativeWind,
Jest + @testing-library/react-native, @solana/web3.js 1.99, `@scure/base` (base58) and `@noble/hashes` (sha256) — both
already dependencies.

**Spec:** `docs/superpowers/specs/2026-11-26-history-parsing-design.md` (r4, Fable APPROVED). It is BINDING; read the
whole spec before any task. Its review trail (why each rule is as it is):
`.superpowers/sdd/2026-11-26-history-parsing-spec-review-r{1,2,3,4}.md`.

**Branch:** `feat/history-parsing` (from `main` 7f3f235; this plan was written at 5588ce7).

**How the code in this plan was checked (2026-11-26).** Every code block of Tasks 2–11 was applied, in task order, to
a throwaway clone of 5588ce7 holding the Task 1 fixtures (fetched the same day from the public endpoints), and the
gates were run there: `npx jest` on Node 24 and on Node 22 (3530 tests in 230 suites passing on each; 1 skipped — the
live ZK-manifest suite, as before this plan), `npx tsc --noEmit` = 0, `npm run lint:ci`
= `✖ 143 problems (0 errors, 143 warnings)`, `node scripts/check-no-tge-date.mjs` = 0; after each task `tsc` and
that task's own tests were green too. The classifier's and the scan's tests were also mutation-checked by hand
(about forty single-line changes to the rules of §4.2–§4.5 and §6.2–§6.3: each makes a test fail, except three
that change nothing observable — which of two proofs of one account is kept, twice, and the cap's `slice`). So a
block that does not compile, or a test that does not pass as written, means the repository has drifted from
5588ce7 or a block was mistyped — **stop and report; do not improvise a different implementation.** What was NOT
checked: anything on a device, and anything against the app's own RPC provider (Tasks 1 and 12 do that).

## Global Constraints

- TypeScript strict; no `any`, no `@ts-ignore`; token amounts stay BigInt up to the display edge.
- **The rule above all (spec §1.2): a wrong row is worse than none.** The wallet never guesses a field it cannot read
  from chain: it writes "—" or the neutral title "Transaction", and it never says "no transactions" when it has not
  read them all.
- Every user-visible string lives in `src/copy/` (new ones in `src/copy/transactions.ts`). The guard tests
  `src/copy/__tests__/bannedWords.test.ts` and `src/screens/shielded/__tests__/privacyClaims.test.ts` keep their
  regexes unchanged. **The words Shield / Unshield / Shielded / Transparent / Vault never appear in a user-visible
  string** — the pool rows and their chip read "Private" / "Made private" / "Made public" (ruling 1).
- The source guard `src/modules/shielded/__tests__/noSelfRelay.test.ts` stays unchanged: the withdraw discriminator
  (`withdrawWithChange`) is named only in `a0/constants.ts`, `a0/relayerClient.ts` and `a0/syncedTx.ts` (ruling 2).
- Gates, each with a real exit code, **after every task and at the end**:
  - full `npx jest` (single-file runs need `--forceExit`);
  - the same tests on Node 22, CI's version: `/usr/bin/node node_modules/.bin/jest <paths> --forceExit`;
  - `npx tsc --noEmit` = 0;
  - `npm run lint:ci`, which must print exactly `✖ 143 problems (0 errors, 143 warnings)` — not one more and not one
    fewer. So: no new inline `style={{…}}`, no `eslint-disable` comment, and the three warnings the touched files
    already carry stay exactly where they are (`TransactionDetailScreen.tsx` `{fontSize: 28}`, `PresaleScreen.tsx`
    the pay-chip inline style, `DashboardScreen.tsx` `{paddingBottom: 24}`);
  - `node scripts/check-no-tge-date.mjs` = 0.
- **No test combines jest fake timers with async `act`** (that hung CI in PR 1). This plan uses no fake timers at all.
- A test that creates a `QueryClient` calls `client.clear()` in `afterEach` (a `parsedTx` entry holds a 24 h timer).
- Never run `npx prettier --write`. Never edit a `.env` file. No new npm dependency.
- Exact values (spec §3, §6), used as named constants and never retyped:
  - transactions are read with `{maxSupportedTransactionVersion: 0}`;
  - a page is 20 signatures (`HISTORY_PAGE_SIZE`); at most 25 sources (`HISTORY_MAX_SOURCES`: the wallet + 24 token
    accounts); a refresh restarts past 5 pages per source (`HISTORY_REFRESH_MAX_PAGES`);
  - query keys `['txHistory', address, cluster, 20]` (`staleTime` 60 s) and `['parsedTx', cluster, signature]`
    (`staleTime: Infinity`, `gcTime` 24 h);
  - the link scan reads at most 300 signatures per source per scan (`LINK_SCAN_CAP`), 20 at a time, at most once per
    60 s per exit (`LINK_SCAN_MIN_INTERVAL_MS`); its cursors are the encrypted-MMKV key `v1_linkScanCursors`;
  - Jupiter v6 `JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4`; wSOL `So11111111111111111111111111111111111111112`;
    Token-2022 `TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`.
- A wallet address is shown as first 6 … last 6 (`shortAccountAddress`), never 4…4 (the recorded poisoning address
  collides at 4…4).
- No TGE date anywhere (owner's rule); the TGE check gate enforces it.

**Rules of this plan (they bind every task):**

- **Run Tasks 1 → 12 strictly in sequence, one at a time.** Tasks 1 and 12 are the controller's. A task's
  implementer sees only its own task text and these constraints; the **Interfaces** block of each task is how it
  learns what its neighbours named.
- **Shared files** (re-read the file before editing; an earlier task has changed it):
  - `src/modules/solana/txDetail.ts`: Task 2 only (types). Tasks 4, 5, 8, 9 import from it.
  - `src/modules/shielded/a0/syncedTx.ts`: Task 2 only.
  - `src/modules/solana/historySession.ts`: Task 3 only. Tasks 4, 6, 8, 9 import from it.
  - `src/modules/solana/queries.ts`: Task 4 only.
  - `src/copy/transactions.ts`, `src/modules/solana/activityView.ts`, `jest.config.js`: Task 5 only.
  - `src/hooks/useSolanaQueries.ts`: Task 7 (removes `useTransactionHistory`), then Task 8 (removes
    `useTransactionDetail`).
  - `src/app/queryClient.ts` and its test: Task 6 only.
  - `src/constants/mmkvKeys.ts`, `DashboardScreen.tsx` and its test: Task 10 only.
  - `src/modules/solana/__tests__/fixtures/`: written by Task 1 only; every later task only reads it.
- **Line numbers are those of 5588ce7.** They drift: the text in a "Find" block is the anchor, never a number. A
  "Find" block occurs exactly once in its file; if it does not, stop and report.
- **Test first in every task.** A step that says "Expected: FAIL" names the reason; if the failure is a different
  one, stop and find out why before writing the implementation.
- **Each task ends green on every gate and with one commit.** No task leaves a screen claiming something it did
  not read, even between tasks.
- Code blocks are complete: a "Create" block is the whole file, a "Replace the whole file" block likewise. Do not
  add to them "for robustness" and do not reformat them.

## Review Focus

Five conditions the spec implies but does not spell out, most likely first. Each has a test in its owning task.

1. **A transaction the node will not serve.** One signature of a page that is refused — a transaction of a version
   above 0 (they exist on both clusters today, see "Findings"), or one rate-limited inside the batch — makes
   web3.js throw for the whole batch. The page must still show every other row parsed and that one as a partial row
   ("Transaction", "—"), never an empty or failed list (Task 4, tests R14 and H7).
2. **Amounts at the edges.** A figure below the shown precision reads "<0.0001" with its sign, never "0" or
   scientific notation; a token amount above 2^53 stays exact; lamports the JSON can no longer hold exactly, or a
   response without balances, make the row `incomplete` — never a wrong figure, never "No funds moved"
   (Task 2, tests A40–A42; Task 5, test V19).
3. **Something changes while a read is in flight.** A page loaded for the account that was selected a moment ago is
   not written into the new account's list (Task 6, test K8); a retry in flight does not block the new account's
   (Task 7, test T17); a wipe or import during a link scan drops that scan's tag and cursor (Task 10, tests N6
   and N12).
4. **The clock.** A list left open past midnight, a summer date read in winter (DST), a block time ahead of the
   device clock, and no block time at all: each row falls under the right section, and the time never reads from
   another day (Task 5, tests V1–V7; Task 7, test T21).
5. **A wallet at the bounds.** More than 24 token accounts (funded ones are read first and the footer says how
   many were read), no transactions at all, and a chip with no match on a list too short to scroll — which must not
   read the whole history in a burst (Task 4, test R2; Task 3, test S4; Task 7, tests T7, T9, T13, T18).

## File map

| File | Task | Responsibility after this plan |
|---|---|---|
| `src/modules/solana/__tests__/fixtures/*.json` (15 new) | 1 | verbatim `getTransaction` (jsonParsed) responses |
| `src/modules/solana/txDetail.ts` | 2 | + the response fields the classifier reads (`RawParsedTx`, `RawInstruction`, `keyString` exported) |
| `src/modules/shielded/a0/syncedTx.ts` | 2 | `isOurA0Ix` exported; + `a0PoolInstructionKind` |
| `src/modules/solana/activity.ts` (new) | 2 | `classifyActivity` — net changes, kind, primary, counter-party |
| `src/modules/solana/historySession.ts` (new) | 3 | the merged signature stream of one account: pages, refresh, restart; the session registry |
| `src/modules/solana/queries.ts` | 4 | + `getToken2022Accounts` |
| `src/modules/solana/historyReads.ts` (new) | 4 | source list, a signature page, parsed transactions + the `parsedTx` cache, limiter keys |
| `src/modules/solana/history.ts` (new) | 4 | `loadHistory` — session + reads + classifier → the snapshot #26 shows |
| `src/modules/solana/activityContext.ts` (new) | 4 | the app's constants for the classifier |
| `src/copy/transactions.ts` | 5 | + every word of the #26 rows, chips, sections, and of #27's new parts |
| `src/modules/solana/activityView.ts` (new) | 5 | what a row says (pure): `rowView`, `sectionOf`, `rowTime`, chips, counter-party label; #27's hero / parties / change lines |
| `jest.globalSetup.js` (new), `jest.config.js` | 5 | `TZ=UTC` for every test |
| `src/hooks/useActivityHistory.ts` (new) | 6 | the history query: key, 60 s, load older, account switch |
| `src/app/queryClient.ts` | 6 | `parsedTx` defaults; an invalidation of `txHistory` drops the session; a wipe clears both |
| `src/screens/transparent/TransactionHistoryScreen.tsx` | 7 | #26: rows, sections, chips, skeleton, load older, footer |
| `src/hooks/useSolanaQueries.ts` | 7, 8 | the two replaced hooks removed |
| `src/hooks/useParsedTx.ts` (new) | 8 | #27's read of the raw transaction from the shared cache |
| `src/screens/transparent/TransactionDetailScreen.tsx` | 8 | #27: hero from the classifier, "at today's price", From / To only on agreement, "Balance changes" |
| `src/modules/accounts/linkScan.ts` (new) | 9 | the linked rule and the paged scan of one exit (pure) |
| `src/constants/mmkvKeys.ts` | 10 | + `LINK_SCAN_CURSORS` |
| `src/modules/accounts/linkScanRunner.ts` (new) | 10 | when the scan runs: single-flight, interval, generation; cursors; wiring |
| `src/screens/dashboard/DashboardScreen.tsx` | 10 | starts the scan when the Accounts sheet opens |
| `src/screens/PresaleScreen.tsx` | 11 | a stale / unknown main balance: "—", the note, MAX and Buy off |

---

### Task 1 (controller, not a subagent): capture the fixtures, measure the reads

Spec: §8 "Fixtures" ("The controller captures the fixtures. The plan names each signature"), §3.2 last bullet, §3.3
last bullet.

The controller does this itself: it needs the network, and every later task only reads what it leaves behind.
Everything here is **read-only** against the **public** endpoints `https://api.devnet.solana.com` and
`https://api.mainnet-beta.solana.com`. No `.env` file is read.

**Files:**
- Create: 15 files in `src/modules/solana/__tests__/fixtures/` (table below)
- Create (local, git-ignored): `.superpowers/sdd/2026-11-26-history-parsing/task1.md` — the ledger of this task

**Interfaces:**
- Consumes: nothing.
- Produces: the fixture files, under exactly these names. Each is the verbatim JSON-RPC answer
  `{"jsonrpc":"2.0","result":{…},"id":1}` of `getTransaction(signature, {encoding: "jsonParsed",
  maxSupportedTransactionVersion: 0})`, as the three files already in that directory are. Later tasks load them as
  `JSON.parse(file).result`.
- Produces: the measurement and its judgement, recorded in the ledger (Steps 4–5). Task 4 proceeds as written
  unless Step 5 says to stop.

**The fixtures.** Devnet ones are the wallet's own accounts (main `Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B`,
Account 2 `9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4`, Account 3 `5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7`,
Account 4 `AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR`). Mainnet ones are strangers' public transactions of
2026-11-26, found by scanning blocks for the shapes the wallet's own accounts never produced; they carry nothing of
the owner's.

| File | Cluster | Signature | Slot | What it is |
|---|---|---|---|---|
| `tx-deposit-3d31ATap.json` | devnet | `3d31ATapk2RmLvyesVTCLA2NsDkq9d3aCaeHCczmYYmPCJM4rTekZJbrzskAdkj42o1pZSLYntkRgAmeeY2k2Txn` | 524784597 | a pool deposit from main: 0.0001 TEST, rho-marker rent 695960 |
| `tx-unshield-relayed-54J9kjQ8.json` | devnet | `54J9kjQ8N5FuoezPEdGM18qZn1H3KFB8JNf1crjm9A51v1BayoUQNwPPUT4C7LFyUvzmtY3Sx7nkmUK8HpcedNLr` | 524767985 | the relayed unshield into Account 3: new ATA paid by the relayer, gas grant 3000000 |
| `tx-unshield-relayed-main-3tPxm8Ph.json` | devnet | `3tPxm8PhidfRFLYD2YmS8WDTGjWwWvG92ykWm8HCGc7qtVg2c5mMADq4DftHR6U6Xq2MZ5fu1Wj9nh5p7JGZ2Yz1` | 524423438 | a relayed unshield into main's existing token account: no grant |
| `tx-test-acc4-to-main-2XgjNKS8.json` | devnet | `2XgjNKS8cJ9LrFofPLJqgm4mFbHxgoDem4BpQCv1Hy3WMwHyyXKrpmKkHhqvcjPPAfZqEE7Ac3m4G71o5BXrEfds` | 526564971 | Account 4 → main's existing token account |
| `tx-sol-to-empty-2bGSoVSG.json` | devnet | `2bGSoVSGjYHJC2VFvjG8eU16vwVEhsd9VzeCfHfdRowhXQ4bSVwmvgzQn18u29YY3T64RbBxL14XGo5qVxLFRtMH` | 522610594 | main sends 0.001 SOL to a wallet that held 0 lamports |
| `tx-ata-for-main-63fU5RvD.json` | devnet | `63fU5RvDi1JXeRnhieYpbLZY5JNJD8Y3zrVNCajqdQxQCVirWeWDTBNcUwgqcS94JNT4kpnzKGYP1HqUuoYKipTg` | 523324894 | someone else creates main's ATA (`create`) |
| `tx-wrap-existing-33qVTEpP.json` | mainnet | `33qVTEpPAhEfhQRTBpkjF6pBSAsFQm1NyUR5rwpFT7tUVqXEGFn2g6fE5ewYHJ2oMFsZbv4YyfmmK6fm86rTLWm1` | 474266326 | a wrap into an EXISTING wSOL account (`createIdempotent` + transfer + `syncNative`) |
| `tx-unwrap-close-3MGayyac.json` | mainnet | `3MGayyac1tQFL4oeZNxtAjyGQJjY3AJNCgZhy9QpU3HmSBUzcxSkvF5NvksmnqfFw5uwMJFNY9BgdDf6CT3116K2` | 474266297 | an unwrap by `closeAccount`; someone else pays the fee |
| `tx-close-empty-5A6bCt6V.json` | mainnet | `5A6bCt6V3wVe8tLdm1mo61iS3gTQJTLzNjxnvS868tcmSusGmZbnGvhp4cYzbrjp8CWdfTUdnFsTuyWeXiqpjwMh` | 474266216 | the close of an empty (Token-2022) token account |
| `tx-ata-own-pXiTRFpg.json` | mainnet | `pXiTRFpgiaRB5guDu1QwAjtW4cd9Xpx5eaWXQc1Pk8ugerKiPUsrudJn4ftgrxA9bg275vi15VUbZoCzdwuf69H` | 474266211 | creating one's own ATA (`createIdempotent` of a new Token-2022 account) |
| `tx-send-new-ata-4M9L6DFb.json` | mainnet | `4M9L6DFbg3XnU8qUcaRxjy4ZDbbSpSMZjXDi8gRoz63pHHVcS51jBCFMBgzsTut6CAb3LS4QqfTSihcPggB6CFRM` | 474267611 | a token send (USDT) that creates the recipient's ATA |
| `tx-failed-sol-2hdMogDK.json` | mainnet | `2hdMogDKpmakrVjFSKTaedpiXYvAX6dTCwPN8Q8h9nRfsBgYKMdogw4NXam7PMWM5xKMyMQqLoAsUosx2dh4eoAE` | 474266325 | a failed SOL transfer |
| `tx-token2022-transfer-2j54z2QC.json` | mainnet | `2j54z2QCrsM31f2YpteSSCL1MkSp9oCg6DnTZkpTeb8bbcKwM7mpT9tZ1agkUxxgvpj83A3gtRq2zEjRfjTWkZAp` | 474266213 | a Token-2022 `transferChecked` into an existing account |
| `tx-jupiter-token-to-sol-2FSgk4Ge.json` | mainnet | `2FSgk4GesoeQuCTGPCFzHvtE8modfoz1zXkZtk9owyUGHeyJnyNtYcPZwjtxVswGeNSrxw1XBdJ6oHXkA9TXQxYJ` | 474266332 | a Jupiter v6 swap, token → SOL (a temporary wSOL account created and closed) |
| `tx-jupiter-sol-to-token-4C4tZgit.json` | mainnet | `4C4tZgitRbkbp9zasqSNDbdbJwDtXarHKt5dywzhbrHbVSgPqZTDHfiRduLfotxAuQALNfyBacav5nNeyRPVGiLa` | 474266332 | a Jupiter v6 swap, SOL → token (pays the rent of a new token account) |

Already in the repository from PR 1 — **do not fetch them again**: `tx-sol-transfer.json` (`2HWCCJQd…`),
`tx-test-to-main.json` (`QAgzVzY6…`), `tx-test-to-outside.json` (`5i53q9tR…`).

Not in the list, and why (rulings 4 and 5): no relayed **failed** transaction exists (the relayer
`3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe` has 19 signatures on devnet, none failed); and no wrap into a
brand-new wSOL account was found as a whole transaction in about 700 mainnet blocks (wallets wrap inside a swap).
Step 3 looks once more.

- [ ] **Step 1: Fetch the 15 files.** From the repository root:

```bash
cd /home/user/Solana/Project/NocturaWallet
dir=src/modules/solana/__tests__/fixtures
fetch() { # cluster signature file
  case "$1" in devnet) url=https://api.devnet.solana.com ;; mainnet) url=https://api.mainnet-beta.solana.com ;; esac
  curl -sS --fail -X POST "$url" -H 'content-type: application/json' \
    --data "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"getTransaction\",\"params\":[\"$2\",{\"encoding\":\"jsonParsed\",\"maxSupportedTransactionVersion\":0}]}" \
    -o "$dir/$3" && echo "saved $3" && sleep 2
}
fetch devnet  3d31ATapk2RmLvyesVTCLA2NsDkq9d3aCaeHCczmYYmPCJM4rTekZJbrzskAdkj42o1pZSLYntkRgAmeeY2k2Txn tx-deposit-3d31ATap.json
fetch devnet  54J9kjQ8N5FuoezPEdGM18qZn1H3KFB8JNf1crjm9A51v1BayoUQNwPPUT4C7LFyUvzmtY3Sx7nkmUK8HpcedNLr tx-unshield-relayed-54J9kjQ8.json
fetch devnet  3tPxm8PhidfRFLYD2YmS8WDTGjWwWvG92ykWm8HCGc7qtVg2c5mMADq4DftHR6U6Xq2MZ5fu1Wj9nh5p7JGZ2Yz1 tx-unshield-relayed-main-3tPxm8Ph.json
fetch devnet  2XgjNKS8cJ9LrFofPLJqgm4mFbHxgoDem4BpQCv1Hy3WMwHyyXKrpmKkHhqvcjPPAfZqEE7Ac3m4G71o5BXrEfds tx-test-acc4-to-main-2XgjNKS8.json
fetch devnet  2bGSoVSGjYHJC2VFvjG8eU16vwVEhsd9VzeCfHfdRowhXQ4bSVwmvgzQn18u29YY3T64RbBxL14XGo5qVxLFRtMH tx-sol-to-empty-2bGSoVSG.json
fetch devnet  63fU5RvDi1JXeRnhieYpbLZY5JNJD8Y3zrVNCajqdQxQCVirWeWDTBNcUwgqcS94JNT4kpnzKGYP1HqUuoYKipTg tx-ata-for-main-63fU5RvD.json
fetch mainnet 33qVTEpPAhEfhQRTBpkjF6pBSAsFQm1NyUR5rwpFT7tUVqXEGFn2g6fE5ewYHJ2oMFsZbv4YyfmmK6fm86rTLWm1 tx-wrap-existing-33qVTEpP.json
fetch mainnet 3MGayyac1tQFL4oeZNxtAjyGQJjY3AJNCgZhy9QpU3HmSBUzcxSkvF5NvksmnqfFw5uwMJFNY9BgdDf6CT3116K2 tx-unwrap-close-3MGayyac.json
fetch mainnet 5A6bCt6V3wVe8tLdm1mo61iS3gTQJTLzNjxnvS868tcmSusGmZbnGvhp4cYzbrjp8CWdfTUdnFsTuyWeXiqpjwMh tx-close-empty-5A6bCt6V.json
fetch mainnet pXiTRFpgiaRB5guDu1QwAjtW4cd9Xpx5eaWXQc1Pk8ugerKiPUsrudJn4ftgrxA9bg275vi15VUbZoCzdwuf69H tx-ata-own-pXiTRFpg.json
fetch mainnet 4M9L6DFbg3XnU8qUcaRxjy4ZDbbSpSMZjXDi8gRoz63pHHVcS51jBCFMBgzsTut6CAb3LS4QqfTSihcPggB6CFRM tx-send-new-ata-4M9L6DFb.json
fetch mainnet 2hdMogDKpmakrVjFSKTaedpiXYvAX6dTCwPN8Q8h9nRfsBgYKMdogw4NXam7PMWM5xKMyMQqLoAsUosx2dh4eoAE tx-failed-sol-2hdMogDK.json
fetch mainnet 2j54z2QCrsM31f2YpteSSCL1MkSp9oCg6DnTZkpTeb8bbcKwM7mpT9tZ1agkUxxgvpj83A3gtRq2zEjRfjTWkZAp tx-token2022-transfer-2j54z2QC.json
fetch mainnet 2FSgk4GesoeQuCTGPCFzHvtE8modfoz1zXkZtk9owyUGHeyJnyNtYcPZwjtxVswGeNSrxw1XBdJ6oHXkA9TXQxYJ tx-jupiter-token-to-sol-2FSgk4Ge.json
fetch mainnet 4C4tZgitRbkbp9zasqSNDbdbJwDtXarHKt5dywzhbrHbVSgPqZTDHfiRduLfotxAuQALNfyBacav5nNeyRPVGiLa tx-jupiter-sol-to-token-4C4tZgit.json
```

      Expected: 15 "saved …" lines. A `curl: (22)` line is an HTTP error (usually 429): wait a minute and fetch that
      one file again.

- [ ] **Step 2: Verify every file is the transaction this plan names.** Save the script below as
      `verify-fixtures.mjs` in the session's scratchpad directory (it is not committed) and run it:

```js
// Plan Task 1 Step 2: every fixture is the transaction the plan names. Read-only. Exit 1 on any mismatch.
//   node verify-fixtures.mjs src/modules/solana/__tests__/fixtures
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dir = process.argv[2];
// file, full signature, slot, failed?
const EXPECTED = [
  ['tx-deposit-3d31ATap.json', '3d31ATapk2RmLvyesVTCLA2NsDkq9d3aCaeHCczmYYmPCJM4rTekZJbrzskAdkj42o1pZSLYntkRgAmeeY2k2Txn', 524784597, false],
  ['tx-unshield-relayed-54J9kjQ8.json', '54J9kjQ8N5FuoezPEdGM18qZn1H3KFB8JNf1crjm9A51v1BayoUQNwPPUT4C7LFyUvzmtY3Sx7nkmUK8HpcedNLr', 524767985, false],
  ['tx-unshield-relayed-main-3tPxm8Ph.json', '3tPxm8PhidfRFLYD2YmS8WDTGjWwWvG92ykWm8HCGc7qtVg2c5mMADq4DftHR6U6Xq2MZ5fu1Wj9nh5p7JGZ2Yz1', 524423438, false],
  ['tx-test-acc4-to-main-2XgjNKS8.json', '2XgjNKS8cJ9LrFofPLJqgm4mFbHxgoDem4BpQCv1Hy3WMwHyyXKrpmKkHhqvcjPPAfZqEE7Ac3m4G71o5BXrEfds', 526564971, false],
  ['tx-sol-to-empty-2bGSoVSG.json', '2bGSoVSGjYHJC2VFvjG8eU16vwVEhsd9VzeCfHfdRowhXQ4bSVwmvgzQn18u29YY3T64RbBxL14XGo5qVxLFRtMH', 522610594, false],
  ['tx-ata-for-main-63fU5RvD.json', '63fU5RvDi1JXeRnhieYpbLZY5JNJD8Y3zrVNCajqdQxQCVirWeWDTBNcUwgqcS94JNT4kpnzKGYP1HqUuoYKipTg', 523324894, false],
  ['tx-wrap-existing-33qVTEpP.json', '33qVTEpPAhEfhQRTBpkjF6pBSAsFQm1NyUR5rwpFT7tUVqXEGFn2g6fE5ewYHJ2oMFsZbv4YyfmmK6fm86rTLWm1', 474266326, false],
  ['tx-unwrap-close-3MGayyac.json', '3MGayyac1tQFL4oeZNxtAjyGQJjY3AJNCgZhy9QpU3HmSBUzcxSkvF5NvksmnqfFw5uwMJFNY9BgdDf6CT3116K2', 474266297, false],
  ['tx-close-empty-5A6bCt6V.json', '5A6bCt6V3wVe8tLdm1mo61iS3gTQJTLzNjxnvS868tcmSusGmZbnGvhp4cYzbrjp8CWdfTUdnFsTuyWeXiqpjwMh', 474266216, false],
  ['tx-ata-own-pXiTRFpg.json', 'pXiTRFpgiaRB5guDu1QwAjtW4cd9Xpx5eaWXQc1Pk8ugerKiPUsrudJn4ftgrxA9bg275vi15VUbZoCzdwuf69H', 474266211, false],
  ['tx-send-new-ata-4M9L6DFb.json', '4M9L6DFbg3XnU8qUcaRxjy4ZDbbSpSMZjXDi8gRoz63pHHVcS51jBCFMBgzsTut6CAb3LS4QqfTSihcPggB6CFRM', 474267611, false],
  ['tx-failed-sol-2hdMogDK.json', '2hdMogDKpmakrVjFSKTaedpiXYvAX6dTCwPN8Q8h9nRfsBgYKMdogw4NXam7PMWM5xKMyMQqLoAsUosx2dh4eoAE', 474266325, true],
  ['tx-token2022-transfer-2j54z2QC.json', '2j54z2QCrsM31f2YpteSSCL1MkSp9oCg6DnTZkpTeb8bbcKwM7mpT9tZ1agkUxxgvpj83A3gtRq2zEjRfjTWkZAp', 474266213, false],
  ['tx-jupiter-token-to-sol-2FSgk4Ge.json', '2FSgk4GesoeQuCTGPCFzHvtE8modfoz1zXkZtk9owyUGHeyJnyNtYcPZwjtxVswGeNSrxw1XBdJ6oHXkA9TXQxYJ', 474266332, false],
  ['tx-jupiter-sol-to-token-4C4tZgit.json', '4C4tZgitRbkbp9zasqSNDbdbJwDtXarHKt5dywzhbrHbVSgPqZTDHfiRduLfotxAuQALNfyBacav5nNeyRPVGiLa', 474266332, false],
  // already in the repository (PR 1) — checked, never fetched again
  ['tx-sol-transfer.json', '2HWCCJQdfzmmgaw77i9JtXmVpjPTGxUqiZt9hkmFiMuCSMWtdtyToSobGbEhvsUbaSNEJtARq96GQFisvThYJWni', 525082222, false],
  ['tx-test-to-main.json', 'QAgzVzY6RhvmFWTiCueAyPfQY3qkyjXVZXXBnbYd9KXfkua1JEHJvxxSEjJbiwvQ2bCupghhRnY6WuwdQMGqgNY', 525080588, false],
  ['tx-test-to-outside.json', '5i53q9tRrCQUyoXjc41cBtW3gb9wcMeD7hspooqz3cPBmndWAXfWn5FXMMv2sCR2kjLMYakvFvWpobNzcSy6LGNZ', 525079736, false],
];

let bad = 0;
for (const [file, signature, slot, failed] of EXPECTED) {
  const problems = [];
  let r = null;
  try {
    r = JSON.parse(readFileSync(join(dir, file), 'utf8')).result;
  } catch (e) {
    problems.push(`unreadable: ${e.message}`);
  }
  if (r === null || r === undefined) {
    problems.push('result is null — the node no longer serves it: STOP, do not substitute another transaction');
  } else {
    if (r.transaction?.signatures?.[0] !== signature) problems.push('signature differs');
    if (r.slot !== slot) problems.push(`slot ${r.slot}, expected ${slot}`);
    if ((r.meta?.err != null) !== failed) problems.push(`err is ${JSON.stringify(r.meta?.err)}`);
    if (r.version !== 'legacy' && r.version !== 0) problems.push(`version ${r.version}`);
    if (!Array.isArray(r.meta?.preBalances) || !Array.isArray(r.meta?.innerInstructions)) problems.push('not a full jsonParsed response');
    if (typeof r.transaction?.message?.accountKeys?.[0]?.pubkey !== 'string') problems.push('accountKeys are not jsonParsed');
  }
  bad += problems.length > 0 ? 1 : 0;
  console.log(`${problems.length === 0 ? 'ok  ' : 'BAD '} ${file}${problems.length ? ' — ' + problems.join('; ') : ''}`);
}
console.log(bad === 0 ? `all ${EXPECTED.length} fixtures are the transactions the plan names` : `${bad} fixture(s) wrong`);
process.exit(bad === 0 ? 0 : 1);
```

      Run: `node <scratchpad>/verify-fixtures.mjs src/modules/solana/__tests__/fixtures`
      Expected: 18 `ok` lines and `all 18 fixtures are the transactions the plan names`, exit 0.
      **If a file's `result` is null** the node no longer serves that transaction: STOP. Do not substitute another
      transaction — every expected value in Tasks 2, 4, 8 and 9 is computed from these exact ones. Report to the
      owner; the plan's author must re-find a transaction of that shape and recompute the values.

- [ ] **Step 3 (optional, at most 15 minutes): look once more for a wrap into a NEW wSOL account.** Task 2 tests
      that shape with a case DERIVED from `33qVTEpP…` (test A23, three stated field changes), because no real one
      was found. A real one is better evidence. Save and run:

```python
# Plan Task 1 Step 3 (optional): look for a wrap of SOL into a NEW wSOL account that is the whole transaction.
# Read-only, public mainnet endpoint, stdlib only.   python3 find-wrap-new.py <blocks>
import json, sys, time, urllib.request

URL = 'https://api.mainnet-beta.solana.com'
WSOL = 'So11111111111111111111111111111111111111112'
ATA = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
SYSTEM = '11111111111111111111111111111111'
TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
BUDGET = 'ComputeBudget111111111111111111111111111111'


def rpc(method, params):
    body = json.dumps({'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}).encode()
    request = urllib.request.Request(URL, body, {'Content-Type': 'application/json', 'User-Agent': 'curl/8'})
    answer = json.load(urllib.request.urlopen(request, timeout=60))
    if 'error' in answer:
        raise RuntimeError(answer['error'])
    return answer['result']


def is_wrap_new(tx):
    meta = tx['meta']
    if meta['err'] is not None or tx.get('version') not in ('legacy', 0):
        return False
    shape = []
    for ix in tx['transaction']['message']['instructions']:
        if ix['programId'] == BUDGET:
            continue
        parsed = ix.get('parsed')
        shape.append((ix['programId'], parsed.get('type') if isinstance(parsed, dict) else None))
    if len(shape) != 3:
        return False
    if shape[0] not in ((ATA, 'create'), (ATA, 'createIdempotent')) or shape[1] != (SYSTEM, 'transfer') or shape[2] != (TOKEN, 'syncNative'):
        return False
    before = {b['accountIndex'] for b in meta.get('preTokenBalances') or []}
    # a NEW account: a wSOL entry after, none before, and 0 lamports before
    return any(
        b['mint'] == WSOL and b['accountIndex'] not in before and meta['preBalances'][b['accountIndex']] == 0
        for b in meta.get('postTokenBalances') or []
    )


blocks = int(sys.argv[1])
slot = rpc('getSlot', [{'commitment': 'finalized'}]) - 5
done = 0
while done < blocks:
    try:
        block = rpc('getBlock', [slot, {'encoding': 'jsonParsed', 'maxSupportedTransactionVersion': 1, 'transactionDetails': 'full', 'rewards': False}])
    except Exception:
        slot -= 1  # a skipped slot, or a refusal: the next one
        time.sleep(1)
        continue
    slot -= 1
    done += 1
    for tx in block['transactions']:
        if is_wrap_new(tx):
            print('FOUND', tx['transaction']['signatures'][0], 'payer', tx['transaction']['message']['accountKeys'][0]['pubkey'], flush=True)
            sys.exit(0)
    time.sleep(0.6)
print('none in', blocks, 'blocks')
```

      Run: `python3 <scratchpad>/find-wrap-new.py 400`
      Expected: `none in 400 blocks` (then nothing changes — go to Step 4), or `FOUND <signature> payer <wallet>`.
      If FOUND: fetch it as Step 1 does into `tx-wrap-new-<first 8 characters of the signature>.json`, write the
      signature and the payer into the ledger, and **after Task 2's review** append this test to
      `src/modules/solana/__tests__/activity.test.ts` inside `describe('wrap / unwrap …')`, with the two constants
      filled in from the ledger. Its expected values are computed from the file itself, by the spec's formula
      (§4.2: `rent = post[j] − pre[j] − w`):

```ts
  // A23r (r2 N1): a REAL wrap into a new wSOL account (found by the controller, plan Task 1 Step 3)
  it('a real wrap into a NEW wSOL account: the rent is post − pre − the wrapped amount', () => {
    const FILE = 'tx-wrap-new-XXXXXXXX.json'; // the file Task 1 Step 3 saved
    const PAYER = 'the payer Task 1 Step 3 printed';
    const tx = load(FILE);
    const entry = tx.meta!.postTokenBalances!.find(b => b.mint === WSOL_MINT && b.owner === PAYER)!;
    const j = entry.accountIndex!;
    const wrapped = BigInt(entry.uiTokenAmount!.amount!);
    const rent = BigInt(tx.meta!.postBalances![j]!) - BigInt(tx.meta!.preBalances![j]!) - wrapped;
    expect(tx.meta!.preBalances![j]).toBe(0);
    expect(rent > 0n).toBe(true);
    const r = classify(tx, PAYER, MAINNET);
    expect(r.kind).toBe('wrap');
    expect(deltas(r)).toEqual([`moved:wSOL:${wrapped}`, `moved:SOL:${-wrapped}`, `rent:SOL:${-rent}`]);
  });
```

- [ ] **Step 4: Measure page 1 and the two ways of reading 20 transactions** (spec §3.2, §3.3), on both clusters.
      Save the script below as `measure-history-rpc.mjs` in the scratchpad (not committed):

```js
// History spec §3.2 / §3.3 — Plan Task 1 measurement. Read-only. Prints timings and refusals, never the endpoint URL.
//   node measure-history-rpc.mjs <devnet|mainnet> <wallet>
// The endpoint is the PUBLIC one of the cluster unless RPC_URL is set in the environment (never echoed).
const [cluster, wallet] = process.argv.slice(2);
const PUBLIC = {devnet: 'https://api.devnet.solana.com', mainnet: 'https://api.mainnet-beta.solana.com'};
if (!PUBLIC[cluster] || !wallet) {
  console.error('usage: node measure-history-rpc.mjs <devnet|mainnet> <wallet>');
  process.exit(2);
}
const url = process.env.RPC_URL || PUBLIC[cluster];
const label = process.env.RPC_URL ? `${cluster} (RPC_URL from the environment)` : `${cluster} (public endpoint)`;
const TOKEN = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const TX_CONFIG = {encoding: 'jsonParsed', maxSupportedTransactionVersion: 0};
const redact = s => String(s).split(url).join('<endpoint>');
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function post(body) {
  const started = Date.now();
  const res = await fetch(url, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body)});
  const text = await res.text();
  return {ms: Date.now() - started, status: res.status, text};
}
async function call(method, params) {
  const r = await post({jsonrpc: '2.0', id: 1, method, params});
  if (r.status !== 200) {
    return {ms: r.ms, error: `HTTP ${r.status}`};
  }
  const j = JSON.parse(r.text);
  return j.error ? {ms: r.ms, error: `${j.error.code} ${j.error.message}`} : {ms: r.ms, result: j.result};
}
/** at most `width` calls in flight, as rpcLimiter does (10) */
async function pooled(items, width, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({length: Math.min(width, items.length)}, async () => {
      while (next < items.length) {
        const at = next++;
        out[at] = await fn(items[at]);
      }
    }),
  );
  return out;
}

console.log(`# ${label} — wallet ${wallet}`);

// 1. the source list: the wallet + its token accounts (classic and Token-2022), at most 25
const owned = [];
for (const programId of [TOKEN, TOKEN_2022]) {
  const r = await call('getTokenAccountsByOwner', [wallet, {programId}, {encoding: 'jsonParsed'}]);
  if (r.error) {
    console.log(`source list (${programId.slice(0, 6)}…): REFUSED ${redact(r.error)} after ${r.ms} ms`);
    process.exit(1);
  }
  console.log(`source list (${programId.slice(0, 6)}…): ${r.result.value.length} token accounts in ${r.ms} ms`);
  owned.push(...r.result.value.map(v => v.pubkey));
}
const sources = [wallet, ...owned].slice(0, 25);
console.log(`sources read: ${sources.length} (the wallet + ${sources.length - 1} of ${owned.length} token accounts)`);
await sleep(1500);

// 2. page 1: one getSignaturesForAddress (limit 20) per source, 10 in flight
const pageStarted = Date.now();
const lists = await pooled(sources, 10, s => call('getSignaturesForAddress', [s, {limit: 20}]));
const pageMs = Date.now() - pageStarted;
const refused = lists.filter(l => l.error);
console.log(`page 1 signatures: ${sources.length} calls in ${pageMs} ms wall clock; refused: ${refused.length}${refused.length ? ' — ' + redact(refused[0].error) : ''}`);
const seen = new Set();
const merged = lists
  .flatMap(l => l.result ?? [])
  .sort((a, b) => b.slot - a.slot)
  .filter(s => !seen.has(s.signature) && seen.add(s.signature))
  .slice(0, 20)
  .map(s => s.signature);
console.log(`merged page: ${merged.length} signatures`);
if (merged.length === 0) {
  process.exit(0);
}
await sleep(11_000); // let the rate window pass: the two transaction reads below must not shadow each other

// 3. ONE batch of N getTransaction requests
const batch = await post(merged.map((s, id) => ({jsonrpc: '2.0', id, method: 'getTransaction', params: [s, TX_CONFIG]})));
if (batch.status !== 200) {
  console.log(`batch of ${merged.length}: REFUSED HTTP ${batch.status} after ${batch.ms} ms`);
} else {
  const answers = JSON.parse(batch.text);
  if (!Array.isArray(answers)) {
    console.log(`batch of ${merged.length}: REFUSED ${redact(JSON.stringify(answers).slice(0, 200))} after ${batch.ms} ms`);
  } else {
    const errors = answers.filter(a => a.error);
    const nulls = answers.filter(a => !a.error && a.result === null).length;
    console.log(`batch of ${merged.length}: ${batch.ms} ms; ${answers.length - errors.length - nulls} transactions, ${nulls} null, ${errors.length} errors${errors.length ? ' — ' + redact(`${errors[0].error.code} ${errors[0].error.message}`) : ''}`);
    console.log(`batch size: ${(batch.text.length / 1024).toFixed(0)} kB`);
  }
}
await sleep(11_000);

// 4. the same N, one at a time
const seqStarted = Date.now();
let ok = 0;
let nulls = 0;
const seqErrors = [];
for (const s of merged) {
  const r = await call('getTransaction', [s, TX_CONFIG]);
  if (r.error) {
    seqErrors.push(r.error);
  } else if (r.result === null) {
    nulls += 1;
  } else {
    ok += 1;
  }
}
console.log(`sequential ${merged.length}: ${Date.now() - seqStarted} ms; ${ok} transactions, ${nulls} null, ${seqErrors.length} errors${seqErrors.length ? ' — ' + redact(seqErrors[0]) : ''}`);
```

      Run, **with at least a minute of no other RPC traffic from this machine before each** (the public endpoints
      rate-limit per IP, and a throttled window makes every figure meaningless):

```bash
node <scratchpad>/measure-history-rpc.mjs devnet Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B
node <scratchpad>/measure-history-rpc.mjs mainnet F1hVXLM73vvUUi55wFdUuBr8grSrrf9BDFVy35UwcFQK
```

      The mainnet wallet is a stranger's with 29 token accounts on 2026-11-26 (3 classic + 26 Token-2022), so page 1
      reads the full 25 sources. Paste both outputs into the ledger, with the time of day.

      **What this does and does not measure.** These are the PUBLIC endpoints — what the app falls back to when
      `HELIUS_RPC_URL` is missing from a build (`connection.ts`), not what a correctly built app uses. The app's
      own provider is NOT measured here, because its URL holds the key and the controller does not read `.env`
      files. A first try while writing this plan (2026-11-26, from a machine that had sent about two thousand
      requests in the hour, so NOT a clean measurement) gave, on both public endpoints: page-1 signature calls not
      refused; a batch of 20 answered in about 1–1.5 s but with 11 of its 20 items refused
      (`429 Too many requests for a specific RPC call`); the 20 sequential reads then refused by HTTP 429.
      **With the owner's explicit OK in chat**, and only then, the same script can be pointed at the app's provider
      without the URL ever being printed (the script redacts it, and prints timings and error codes only):
      `RPC_URL="$(grep -m1 '^HELIUS_RPC_URL=' .env.devnet | cut -d= -f2-)" node <scratchpad>/measure-history-rpc.mjs devnet Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B`.
      Without that OK, the app's provider is judged on the phone in Task 12 (rows parsed, not all "Transaction —").

- [ ] **Step 5: Judge the result against the spec's rule and write the judgement into the ledger.** The rule: "If
      the batch is refused, the sequential path is the product path."
  - Task 4 builds what §3.3 describes: the batch first, and the same signatures one at a time when the batch
    throws. That is right whenever the batch works, and also when single items of it are refused (the fallback
    handles them, at the cost of one wasted call per page). **Per-item 429s on the public endpoints therefore
    change nothing.**
  - Only if the batch is refused **as a whole** on a quiet endpoint — an HTTP error, or a JSON-RPC error in place
    of an array — on the endpoint the app really uses (the keyed run above, or the phone in Task 12 showing every
    page slow and every first read failing) does the rule bite: the batch call must then be skipped. **Stop before
    Task 4 and tell the owner.** Skipping it is a small amendment to Task 4 (the reader's first attempt, and the
    test expectations that count batch calls: R7, R8, R11, R13, H2); it is not pre-written because nothing
    measured so far points there.
  - Either way, add the measured figures to the PR description in Task 12.

- [ ] **Step 6: Gates and commit.** The fixtures are data: nothing else may change.

```bash
git status --short            # exactly the 15 new files (16 if Step 3 found one)
node scripts/check-no-tge-date.mjs
npx jest src/modules/solana --forceExit      # the existing suites still pass: nothing reads the new files yet
git add src/modules/solana/__tests__/fixtures
git commit -m "test(history): 15 verbatim chain responses for the history classifier (devnet own accounts, mainnet public)"
```

---

### Task 2: The classifier — one parsed transaction → the row for one account

Spec: §4.1–§4.5 (all of it), §8 "Classifier", H2, H3; Review Focus 2.

**Files:**
- Modify: `src/modules/solana/txDetail.ts:62-100` (the `RawTokenBalance` / `RawParsedTx` / `RawInstruction` types, and
  `keyString`)
- Modify: `src/modules/shielded/a0/syncedTx.ts:152-158` (`isOurA0Ix`)
- Create: `src/modules/solana/activity.ts`
- Test: `src/modules/solana/__tests__/activity.test.ts` (new)
- Reads: the 18 fixtures of Task 1 in `src/modules/solana/__tests__/fixtures/`

**Interfaces:**
- Consumes (Task 1): the fixture files, loaded as `JSON.parse(readFileSync(path, 'utf8')).result as RawParsedTx`.
- Consumes (existing): `A0`, `A0_RELAYER`, `A0_DEPOSIT_ACCOUNTS`, `A0_WITHDRAW_CHANGE_ACCOUNTS`,
  `A0_IX_DISCRIMINATOR` from `src/modules/shielded/a0/constants.ts`; `base58` from `@scure/base`.
- Produces, from `src/modules/solana/txDetail.ts`:
  - `export interface RawInstruction {program?: string; programId?: unknown; parsed?: {type?: string; info?: Record<string, unknown>} | string; accounts?: unknown[]; data?: string}`
  - `RawTokenBalance.uiTokenAmount?: {decimals?: number; amount?: string}`
  - `RawParsedTx.meta.preBalances?: number[]`, `.postBalances?: number[]`,
    `.innerInstructions?: Array<{index?: number; instructions?: RawInstruction[]}> | null`;
    `RawParsedTx.transaction.signatures?: string[]`
  - `export function keyString(k: unknown): string` (was private)
- Produces, from `src/modules/shielded/a0/syncedTx.ts`:
  - `export function isOurA0Ix(ix: {programId: string; accounts: string[]}): boolean` (was private, unchanged)
  - `export function a0PoolInstructionKind(ix: {programId: string; accounts: string[]}, data: Uint8Array): 'deposit' | 'withdraw' | 'other' | null`
- Produces, from `src/modules/solana/activity.ts`:
  - `export const WSOL_MINT`, `JUPITER_V6_PROGRAM_ID`, `TOKEN_PROGRAM_ID`, `TOKEN_2022_PROGRAM_ID` (strings)
  - `export type ActivityStatus = 'confirmed' | 'finalized' | 'failed'`
  - `export type ActivityKind = 'sent' | 'received' | 'swap' | 'made-private' | 'made-public' | 'wrap' | 'unwrap' | 'account-setup' | 'no-funds-moved' | 'failed' | 'unknown'`
  - `export interface Delta {mint: 'native' | string; symbol: string; raw: bigint; decimals: number; role: 'moved' | 'rent' | 'markup' | 'grant'}`
  - `export interface ActivityRow {signature: string; slot: number; blockTime: number | null; status: ActivityStatus; kind: ActivityKind; primary: Delta | null; secondary: Delta | null; extraAssets: number; deltas: Delta[]; counterparty: string | null; via: 'Jupiter' | null; feePaidByAccount: bigint | null; incomplete: boolean}`
  - `export interface ActivityContext {symbolOf: (mint: string) => string; cluster: string; a0: {cluster: string; mint: string}; feeTreasury: string; relayerFeePayer: string; jupiterProgramId: string; ownTokenAccounts: ReadonlySet<string>}`
  - `export function classifyActivity(raw: RawParsedTx, account: string, status: ActivityStatus, ctx: ActivityContext): ActivityRow`

**Why (read the code and the data first):**
- `txDetail.ts` (PR 1) reads only the FIRST top-level transfer instruction. A swap, a pool move, a send that also
  creates an account, or a transfer into an existing token account (where the recipient wallet is not even an
  account key) cannot be described that way. The row is therefore computed from what the account's balances did
  (H2), and the instructions are used only to PROVE what a lamport movement was (an account created or closed, the
  fee markup, a pool deposit or withdrawal).
- **Program identity is the `programId`, not the `program` label.** A real response labels a Token-2022 instruction
  `"program": "spl-token"` (see `tx-close-empty-5A6bCt6V.json`: the only token program among its keys is
  `TokenzQd…`). The classifier compares program ids.
- **An idempotent ATA create of an account that already exists creates nothing** (`tx-wrap-existing-33qVTEpP.json`:
  the wSOL account holds 1488440 lamports before). The rule is the account's `pre` lamports, not the instruction's
  name.
- **The pool rule lives beside the sync's decoder.** `noSelfRelay.test.ts` (R6 source guard) fails if the withdraw
  discriminator is named anywhere but `a0/constants.ts`, `a0/relayerClient.ts` and `a0/syncedTx.ts`. So
  `activity.ts` never names it: `syncedTx.ts` gains `a0PoolInstructionKind`, which uses the existing `isOurA0Ix`
  (spec review r4 q3: exported, not copied) and tells `activity.ts` only 'deposit' / 'withdraw' / 'other' (ruling 2).
- **Lamports are JSON numbers.** Above 2^53 they have already lost digits when the response is parsed. The
  classifier then claims no native change at all and marks the row `incomplete` (Review Focus 2).

- [ ] **Step 1: Write the failing test.** Create `src/modules/solana/__tests__/activity.test.ts`:

```ts
/**
 * History spec (2026-11-26) §4, §8 "Classifier": `classifyActivity` against REAL getTransaction
 * (jsonParsed) responses — fixtures/*.json are verbatim RPC answers (plan Task 1 names each signature
 * and its cluster). A DERIVED case is made from a real response by changing exactly the fields it
 * names; no transaction of that shape was found on chain (or none can exist yet: the fee markup).
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {classifyActivity, JUPITER_V6_PROGRAM_ID, WSOL_MINT} from '../activity';
import type {ActivityContext, ActivityRow} from '../activity';
import type {RawInstruction, RawParsedTx} from '../txDetail';
import {A0, A0_RELAYER} from '../../shielded/a0/constants';

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as {result: RawParsedTx}).result;
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

// devnet (the wallet's own accounts)
const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const MAIN_TA = 'A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const ACC_3 = '5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7';
const ACC_4 = 'AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR';
const OUTSIDE = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
const EMPTY_WALLET = '2ixJm1hh6Ff8KuUCoaAe1myqKAT2PimVJ3B6ubuYQMr9';
const ATA_PAYER = 'GoBAmZzHvD6F4KHLNmBFh2wZAGE1dwwufeTbifSHEYfd';
const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const RELAYER = '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe';
const POOL = '8VMe4iZWiq3xQySywih9cciAmzTxMtkawMRYK6JuDdoT';
// mainnet (strangers' public transactions)
const WRAPPER = 'G1k6vgWH6REJUYHQBDri9r6KPryX61keqTgHfp8Exb8n';
const WRAPPER_ATA = 'Dmug1GgWHMenk7vQhax6QDdBUz99KNaa5vHFxqaDBEEw';
const UNWRAPPER = '5kbvumhoPqt1gVeUEBBZXzeAwCMQCYowYeZK9NxNyfYZ';
const UNWRAP_FEE_PAYER = 'ASL88oP9PX1MVN9LMFQ4toBpX9atqtyuKnwB2rLUn8dN';
const CLOSER = '75WVLpo9gkf2NqS5Nkie5756gQvroheM3UWERruoxKH8';
const ATA_OWNER = 'BUpWiWy8Tqed4jy86dr7ZpoaE747DpQsrGnwmtpMwfBr';
const USDT_SENDER = 'BxrXKJrpxyshyFdZwojGzRD2PL3ujf51tCJw7aYHSuwi';
const USDT_RECIPIENT = 'GATBj87hLwH2jYePNvD7qsCDT9roKiJsHhdJVvPK1ggP';
const USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const FAILED_PAYER = '4Qun7nwV14Tp46QP1f9tURB1vGi6Wr4x8PNmhQA7M9r7';
const FAILED_RECIPIENT = 'G9X7F4JzLzbSGMCndiBdWNi5YzZZakmtkdwq7xS3Q3FE';
const T22_SENDER = 'DDegarugVZTEWWfniZrgz3oemqjaMTPXeBGoyXXrwbjm';
const T22_RECIPIENT = 'AExZRpYWDQvpHKjp2fkUEDrS8LFCgiXgvkr1jPyzWhJy';
const T22_MINT = '3jAB5ksB13Kgm2Q39NU6d2USUxBy2f9LaTvyay6Gpump';
const SELLER = '4wK1vV3d1ZoZvYED9RafrDAS1XvsvkYJuLN3XxSHTpd5';
const SOLD_MINT = '3gmFG4sFDJErDV8pacFrL2uUPXeGJTYLjfRy4hFypump';
const BUYER = 'F1hVXLM73vvUUi55wFdUuBr8grSrrf9BDFVy35UwcFQK';
const BOUGHT_MINT = '5yC9BM8KUsJTPbWPLfA2N8qH1s9V8DQ3Vcw1G6Jdpump';
const TREASURY = 'TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'; // any key that is in no fixture: it is only compared

const symbolOf = (mint: string): string => (mint === 'native' ? 'SOL' : mint === TEST_MINT ? 'TEST' : mint === WSOL_MINT ? 'wSOL' : `short(${mint.slice(0, 4)})`);
const ctx = (over: Partial<ActivityContext> = {}): ActivityContext => ({
  symbolOf,
  cluster: 'devnet',
  a0: A0,
  feeTreasury: TREASURY,
  relayerFeePayer: A0_RELAYER.feePayer,
  jupiterProgramId: JUPITER_V6_PROGRAM_ID,
  ownTokenAccounts: new Set(),
  ...over,
});
/** mainnet fixtures are classified as the mainnet build does: rule 2 is off */
const MAINNET = {cluster: 'mainnet-beta'};
const classify = (fixture: string | RawParsedTx, account: string, over: Partial<ActivityContext> = {}): ActivityRow =>
  classifyActivity(typeof fixture === 'string' ? load(fixture) : fixture, account, 'finalized', ctx(over));
/** role:symbol:raw, in the row's order */
const deltas = (r: ActivityRow): string[] => r.deltas.map(d => `${d.role}:${d.symbol}:${d.raw}`);

it('the fixtures match the constants they are classified with', () => {
  expect(A0.mint).toBe(TEST_MINT);
  expect(A0.pool).toBe(POOL);
  expect(A0_RELAYER.feePayer).toBe(RELAYER);
});

describe('sent / received (§4.3 rules 5–6, §4.5)', () => {
  // A1
  it('a SOL send (2HWCCJQd…): the fee is not part of the delta; the recipient is named', () => {
    const r = classify('tx-sol-transfer.json', ACC_3);
    expect(r).toMatchObject({kind: 'sent', counterparty: OUTSIDE, feePaidByAccount: 5050n, extraAssets: 0, incomplete: false, via: null, secondary: null});
    expect(r.primary).toEqual({mint: 'native', symbol: 'SOL', raw: -5000n, decimals: 9, role: 'moved'}); // not −10050
    expect(deltas(r)).toEqual(['moved:SOL:-5000']);
    expect(r).toMatchObject({signature: '2HWCCJQdfzmmgaw77i9JtXmVpjPTGxUqiZt9hkmFiMuCSMWtdtyToSobGbEhvsUbaSNEJtARq96GQFisvThYJWni', slot: 525082222, blockTime: 1795353101, status: 'finalized'});
  });

  // A2
  it('a received SOL transfer names its sender — the fee payer — and this account paid no fee', () => {
    const r = classify('tx-sol-transfer.json', OUTSIDE);
    expect(r).toMatchObject({kind: 'received', counterparty: ACC_3, feePaidByAccount: null});
    expect(deltas(r)).toEqual(['moved:SOL:5000']);
  });

  // A3 (r2 N4)
  it('a SOL send to a wallet with 0 lamports before it (2bGSoVSG…) names that wallet', () => {
    const r = classify('tx-sol-to-empty-2bGSoVSG.json', MAIN);
    expect(r).toMatchObject({kind: 'sent', counterparty: EMPTY_WALLET});
    expect(deltas(r)).toEqual(['moved:SOL:-1000000']);
    expect(classify('tx-sol-to-empty-2bGSoVSG.json', EMPTY_WALLET)).toMatchObject({kind: 'received', counterparty: MAIN});
  });

  // A4 (r2 N4) — DERIVED from 2HWCCJQd…: the sender's post balance set to 0 (a wallet emptied by the send)
  it('a receive from a wallet left at 0 names it', () => {
    const tx = load('tx-sol-transfer.json');
    tx.meta!.postBalances![0] = 0;
    expect(classify(tx, OUTSIDE)).toMatchObject({kind: 'received', counterparty: ACC_3});
  });

  // A5
  it('a token send (QAgzVzY6…): the sender sees Sent to main; main — absent from the account keys — sees Received from Account 2', () => {
    const sent = classify('tx-test-to-main.json', ACC_2);
    expect(sent).toMatchObject({kind: 'sent', counterparty: MAIN, feePaidByAccount: 7000n, extraAssets: 0});
    expect(sent.primary).toEqual({mint: TEST_MINT, symbol: 'TEST', raw: -200000n, decimals: 9, role: 'moved'});
    expect(deltas(sent)).toEqual(['moved:TEST:-200000']); // the fee is no SOL delta
    const received = classify('tx-test-to-main.json', MAIN);
    expect(received).toMatchObject({kind: 'received', counterparty: ACC_2, feePaidByAccount: null});
    expect(deltas(received)).toEqual(['moved:TEST:200000']);
  });

  // A6
  it('Account 4 → main (2XgjNKS8…)', () => {
    expect(classify('tx-test-acc4-to-main-2XgjNKS8.json', ACC_4)).toMatchObject({kind: 'sent', counterparty: MAIN});
    const r = classify('tx-test-acc4-to-main-2XgjNKS8.json', MAIN);
    expect(r).toMatchObject({kind: 'received', counterparty: ACC_4});
    expect(deltas(r)).toEqual(['moved:TEST:10000']);
  });

  // A7 (review C3)
  it("a token send that creates the recipient's ATA (4M9L6DFb…) names the recipient WALLET and shows the token, not the rent", () => {
    const r = classify('tx-send-new-ata-4M9L6DFb.json', USDT_SENDER, MAINNET);
    expect(r).toMatchObject({kind: 'sent', counterparty: USDT_RECIPIENT, extraAssets: 0, feePaidByAccount: 5000n});
    expect(r.primary).toMatchObject({mint: USDT, raw: -48288911n, decimals: 6, role: 'moved'});
    expect(deltas(r)).toEqual(['moved:short(Es9v):-48288911', 'rent:SOL:-1488440']);
    expect(classify('tx-send-new-ata-4M9L6DFb.json', USDT_RECIPIENT, MAINNET)).toMatchObject({kind: 'received', counterparty: USDT_SENDER});
  });

  // A8
  it('a Token-2022 transfer (2j54z2QC…) is read like a classic one', () => {
    const r = classify('tx-token2022-transfer-2j54z2QC.json', T22_SENDER, MAINNET);
    expect(r).toMatchObject({kind: 'sent', counterparty: T22_RECIPIENT, feePaidByAccount: 232500n});
    expect(r.primary).toMatchObject({mint: T22_MINT, raw: -1181313382n, decimals: 6});
    expect(deltas(r)).toEqual(['moved:short(3jAB):-1181313382']); // the idempotent create of an EXISTING account is no rent
    expect(classify('tx-token2022-transfer-2j54z2QC.json', T22_RECIPIENT, MAINNET)).toMatchObject({kind: 'received', counterparty: T22_SENDER});
  });

  // A9 (r2 N3) — DERIVED from 5i53q9tR… (a token send): a top-level system transfer of 20000 lamports from the
  // sender to the fee treasury is added, with the treasury as a new account key and the sender's post balance 20000 lower
  it('a token send with the markup shows the recipient and the token; the markup is its own role and no "+1 more"', () => {
    const tx = load('tx-test-to-outside.json');
    tx.transaction!.message!.accountKeys!.push({pubkey: TREASURY, signer: false, writable: true});
    tx.meta!.preBalances!.push(900_000);
    tx.meta!.postBalances!.push(920_000);
    tx.meta!.postBalances![0]! -= 20_000;
    tx.transaction!.message!.instructions!.push({
      program: 'system', programId: '11111111111111111111111111111111',
      parsed: {type: 'transfer', info: {source: ACC_2, destination: TREASURY, lamports: 20_000}},
    });
    const r = classify(tx, ACC_2);
    expect(r).toMatchObject({kind: 'sent', counterparty: OUTSIDE, extraAssets: 0});
    expect(r.primary).toMatchObject({symbol: 'TEST', raw: -500000n});
    expect(deltas(r)).toEqual(['moved:TEST:-500000', 'markup:SOL:-20000']);
  });

  // A10 (r2 N3) — DERIVED from 2HWCCJQd… (a SOL send) in the same way
  it('a SOL send with the markup: the recipient, not the treasury; the amount without the markup', () => {
    const tx = load('tx-sol-transfer.json');
    tx.transaction!.message!.accountKeys!.push({pubkey: TREASURY, signer: false, writable: true});
    tx.meta!.preBalances!.push(900_000);
    tx.meta!.postBalances!.push(920_000);
    tx.meta!.postBalances![0]! -= 20_000;
    tx.transaction!.message!.instructions!.push({
      program: 'system', programId: '11111111111111111111111111111111',
      parsed: {type: 'transfer', info: {source: ACC_3, destination: TREASURY, lamports: 20_000}},
    });
    const r = classify(tx, ACC_3);
    expect(r).toMatchObject({kind: 'sent', counterparty: OUTSIDE, extraAssets: 0});
    expect(deltas(r)).toEqual(['moved:SOL:-5000', 'markup:SOL:-20000']);
  });

  // A11 (PR 1) — 2HWCCJQd… read with its recipient AS the treasury: a transfer to the treasury alone is deliberate
  it('a transfer to the treasury with nothing else moved stays "moved", and the treasury is the counter-party', () => {
    const r = classify('tx-sol-transfer.json', ACC_3, {feeTreasury: OUTSIDE});
    expect(r).toMatchObject({kind: 'sent', counterparty: OUTSIDE});
    expect(deltas(r)).toEqual(['moved:SOL:-5000']);
  });

  // A12 — 2HWCCJQd… read with its sender AS the relayer's fee payer
  it("the relayer's fee payer is never the counter-party", () => {
    expect(classify('tx-sol-transfer.json', OUTSIDE, {relayerFeePayer: ACC_3})).toMatchObject({kind: 'received', counterparty: null});
  });

  // A13 (r2 N7) — DERIVED from 5i53q9tR…: a second recipient entry (another owner, +100) is added
  it('a send to two recipients names neither', () => {
    const tx = load('tx-test-to-outside.json');
    const second = {accountIndex: 3, mint: TEST_MINT, owner: MAIN, uiTokenAmount: {amount: '0', decimals: 9}};
    tx.meta!.preTokenBalances!.push(second);
    tx.meta!.postTokenBalances!.push({...second, uiTokenAmount: {amount: '100', decimals: 9}});
    expect(classify(tx, ACC_2)).toMatchObject({kind: 'sent', counterparty: null});
  });

  // A13b — DERIVED from 5i53q9tR…: a second recipient entry WITHOUT an owner (+100) is added
  it('one named recipient and one entry with no owner: still nobody is named', () => {
    const tx = load('tx-test-to-outside.json');
    tx.meta!.preTokenBalances!.push({accountIndex: 3, mint: TEST_MINT, uiTokenAmount: {amount: '0', decimals: 9}});
    tx.meta!.postTokenBalances!.push({accountIndex: 3, mint: TEST_MINT, uiTokenAmount: {amount: '100', decimals: 9}});
    expect(classify(tx, ACC_2)).toMatchObject({kind: 'sent', counterparty: null});
  });

  // A14 — DERIVED from 5i53q9tR…: the recipient's entries lose their `owner` (a node may omit it)
  it('a recipient entry with no owner: no counter-party, never the token account', () => {
    const tx = load('tx-test-to-outside.json');
    delete tx.meta!.preTokenBalances![1]!.owner;
    delete tx.meta!.postTokenBalances![1]!.owner;
    const r = classify(tx, ACC_2);
    expect(r).toMatchObject({kind: 'sent', counterparty: null, incomplete: false});
  });
});

describe('the SOL counter-party is a wallet the response proves (§4.5)', () => {
  // A14b — DERIVED from 2HWCCJQd…: a separate fee payer is put at index 0 (balance 1000000, paying the 5050 fee);
  // the sender, now index 1, no longer pays it
  it('a fee payer who only paid the fee is not the sender: the fee is added back to index 0', () => {
    const tx = load('tx-sol-transfer.json');
    const FEE_PAYER = 'FeePayerXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    tx.transaction!.message!.accountKeys!.unshift({pubkey: FEE_PAYER, signer: true, writable: true});
    tx.meta!.preBalances!.unshift(1_000_000);
    tx.meta!.postBalances!.unshift(1_000_000 - 5050);
    tx.meta!.postBalances![1]! += 5050;
    expect(classify(tx, OUTSIDE)).toMatchObject({kind: 'received', counterparty: ACC_3});
    const sender = classify(tx, ACC_3);
    expect(sender).toMatchObject({kind: 'sent', counterparty: OUTSIDE, feePaidByAccount: null});
    expect(deltas(sender)).toEqual(['moved:SOL:-5000']);
  });

  // A14c — DERIVED from 63fU5RvD… (a payer creates main's ATA): the payer also sends main 1000 lamports
  // (a top-level system transfer; the payer's post balance 1000 lower, main's 1000 higher)
  it('an account created in the transaction is never the counter-party, whichever way it is proven', () => {
    const derive = (): RawParsedTx => {
      const tx = load('tx-ata-for-main-63fU5RvD.json');
      const mainAt = tx.transaction!.message!.accountKeys!.findIndex(k => k.pubkey === MAIN);
      tx.meta!.postBalances![0]! -= 1000;
      tx.meta!.postBalances![mainAt]! += 1000;
      tx.transaction!.message!.instructions!.push({
        program: 'system', programId: '11111111111111111111111111111111',
        parsed: {type: 'transfer', info: {source: ATA_PAYER, destination: MAIN, lamports: 1000}},
      });
      return tx;
    };
    // the new ATA gained lamports too: it is a token account AND proven created
    const r = classify(derive(), ATA_PAYER);
    expect(r).toMatchObject({kind: 'sent', counterparty: MAIN});
    expect(deltas(r)).toEqual(['moved:SOL:-1000', 'rent:SOL:-1488440']);
    // …proven created only (the response lists no token balance for it)
    const noEntry = derive();
    noEntry.meta!.postTokenBalances = [];
    expect(classify(noEntry, ATA_PAYER)).toMatchObject({kind: 'sent', counterparty: MAIN});
    // …a token account only (no instruction proves the creation)
    const noProof = derive();
    noProof.transaction!.message!.instructions = (noProof.transaction!.message!.instructions as RawInstruction[]).filter(x => x.program !== 'spl-associated-token-account');
    noProof.meta!.innerInstructions = [];
    expect(classify(noProof, ATA_PAYER)).toMatchObject({kind: 'sent', counterparty: MAIN});
  });

  // A14d — DERIVED from 33qVTEpP…: the wSOL account belongs to ANOTHER wallet (its owner is changed in both entries)
  it("SOL sent into someone else's token account names nobody — never the token account", () => {
    const tx = load('tx-wrap-existing-33qVTEpP.json');
    tx.meta!.preTokenBalances![0]!.owner = OUTSIDE;
    tx.meta!.postTokenBalances![0]!.owner = OUTSIDE;
    const r = classify(tx, WRAPPER, MAINNET);
    expect(r).toMatchObject({kind: 'sent', counterparty: null});
    expect(deltas(r)).toEqual(['moved:SOL:-59167663567']);
  });
});

describe('the pool (§4.3 rule 2)', () => {
  // A15 (review C5, r2 N3)
  it('a deposit from main (3d31ATap…) is Made private: the token, not the rho rent; no "+1 more"', () => {
    const r = classify('tx-deposit-3d31ATap.json', MAIN);
    expect(r).toMatchObject({kind: 'made-private', counterparty: null, extraAssets: 0, feePaidByAccount: 5000n});
    expect(r.primary).toEqual({mint: TEST_MINT, symbol: 'TEST', raw: -100000n, decimals: 9, role: 'moved'});
    expect(deltas(r)).toEqual(['moved:TEST:-100000', 'rent:SOL:-695960']);
  });

  // A16 (r2 N3) — DERIVED from 3d31ATap…: the inner instructions are removed, so no system instruction names the rho marker
  it('the rho marker is the depositor\'s rent even when no system instruction is parsed for it', () => {
    const tx = load('tx-deposit-3d31ATap.json');
    tx.meta!.innerInstructions = [];
    expect(deltas(classify(tx, MAIN))).toEqual(['moved:TEST:-100000', 'rent:SOL:-695960']);
  });

  // A17 (review C5, r2 N3)
  it('the relayed unshield into Account 3 (54J9kjQ8…) is Made public: the token, not the gas grant; no "+1 more"', () => {
    const r = classify('tx-unshield-relayed-54J9kjQ8.json', ACC_3);
    expect(r).toMatchObject({kind: 'made-public', counterparty: null, extraAssets: 0, feePaidByAccount: null});
    expect(r.primary).toEqual({mint: TEST_MINT, symbol: 'TEST', raw: 10000n, decimals: 9, role: 'moved'});
    // the relayer paid for the new token account (an idempotent create of a NEW account): no rent of this account
    expect(deltas(r)).toEqual(['moved:TEST:10000', 'grant:SOL:3000000']);
  });

  // A18
  it("a relayed unshield into main's existing token account (3tPxm8Ph…): Made public, no grant", () => {
    const r = classify('tx-unshield-relayed-main-3tPxm8Ph.json', MAIN);
    expect(r).toMatchObject({kind: 'made-public', extraAssets: 0});
    expect(deltas(r)).toEqual(['moved:TEST:20000']);
  });

  // A19
  it('a pool instruction that is neither this account\'s deposit nor a withdrawal into it → unknown, no amount', () => {
    expect(classify('tx-unshield-relayed-54J9kjQ8.json', MAIN)).toMatchObject({kind: 'unknown', primary: null});
    expect(classify('tx-deposit-3d31ATap.json', ACC_2)).toMatchObject({kind: 'unknown', primary: null});
  });

  // A20
  it('rule 2 applies only on the pool\'s own cluster: a mainnet build never calls anything Made private', () => {
    const r = classify('tx-deposit-3d31ATap.json', MAIN, MAINNET);
    expect(r.kind).toBe('sent');
    expect(deltas(r)).toEqual(['moved:TEST:-100000', 'rent:SOL:-695960']); // the inner createAccount still proves the rent
  });

  // A21 — DERIVED from 3d31ATap…: the pool instruction's account 1 (the merkle tree) is replaced by another key
  it('an instruction of the program on another tree is not ours (isOurA0Ix)', () => {
    const tx = load('tx-deposit-3d31ATap.json');
    const ix = (tx.transaction!.message!.instructions as RawInstruction[]).find(x => x.programId === A0.programId)!;
    ix.accounts![1] = OUTSIDE;
    expect(classify(tx, MAIN).kind).toBe('sent');
  });
});

describe('wrap / unwrap (§4.3 rule 3, §4.2 rent)', () => {
  // A22 (r2 N2)
  it('a wrap into an EXISTING wSOL account (33qVTEpP…): wrap — not swap, not sent; the idempotent create is no rent', () => {
    const r = classify('tx-wrap-existing-33qVTEpP.json', WRAPPER, MAINNET);
    expect(r).toMatchObject({kind: 'wrap', counterparty: null, extraAssets: 0, secondary: null});
    expect(r.primary).toEqual({mint: 'native', symbol: 'SOL', raw: -59167663567n, decimals: 9, role: 'moved'});
    expect(deltas(r)).toEqual(['moved:wSOL:59167663567', 'moved:SOL:-59167663567']);
  });

  // A23 (r2 N1) — DERIVED from 33qVTEpP…: the wSOL account did not exist before — its pre lamports are 0, its pre
  // token entry is removed, and the payer's post balance is 1488440 lower (the rent it now pays)
  it('a wrap into a NEW wSOL account: the exact rent is split out and the row is still a wrap of the wrapped amount', () => {
    const tx = load('tx-wrap-existing-33qVTEpP.json');
    const at = tx.transaction!.message!.accountKeys!.findIndex(k => k.pubkey === WRAPPER_ATA);
    tx.meta!.preBalances![at] = 0;
    tx.meta!.preTokenBalances = [];
    tx.meta!.postBalances![0]! -= 1_488_440;
    const r = classify(tx, WRAPPER, MAINNET);
    expect(r.kind).toBe('wrap');
    expect(r.primary).toMatchObject({mint: 'native', raw: -59167663567n});
    expect(deltas(r)).toEqual(['moved:wSOL:59167663567', 'moved:SOL:-59167663567', 'rent:SOL:-1488440']);
  });

  // A24 (r2 N1)
  it('an unwrap by close (3MGayyac…): unwrap; the exact rent refund is split out; someone else paid the fee', () => {
    const r = classify('tx-unwrap-close-3MGayyac.json', UNWRAPPER, MAINNET);
    expect(r).toMatchObject({kind: 'unwrap', counterparty: null, extraAssets: 0, feePaidByAccount: null});
    expect(r.primary).toEqual({mint: 'native', symbol: 'SOL', raw: 13229146n, decimals: 9, role: 'moved'});
    expect(deltas(r)).toEqual(['moved:wSOL:-13229146', 'moved:SOL:13229146', 'rent:SOL:1488440']);
    // the fee payer moved nothing of its own
    expect(classify('tx-unwrap-close-3MGayyac.json', UNWRAP_FEE_PAYER, MAINNET)).toMatchObject({kind: 'no-funds-moved', feePaidByAccount: 15000n, deltas: []});
  });
});

describe('swap (§4.3 rule 4)', () => {
  // A25
  it('a Jupiter v6 swap, token → SOL (2FSgk4Ge…): the outgoing leg first, the SOL received, via Jupiter', () => {
    const r = classify('tx-jupiter-token-to-sol-2FSgk4Ge.json', SELLER, MAINNET);
    expect(r).toMatchObject({kind: 'swap', via: 'Jupiter', counterparty: null, extraAssets: 0, feePaidByAccount: 8128n});
    expect(r.primary).toMatchObject({mint: SOLD_MINT, raw: -135435988491n, decimals: 6});
    expect(r.secondary).toMatchObject({mint: 'native', symbol: 'SOL', raw: 4668480n});
    // the temporary wSOL account, created and closed in the transaction, contributes nothing
    expect(deltas(r)).toEqual(['moved:short(3gmF):-135435988491', 'moved:SOL:4668480']);
  });

  // A26
  it('a Jupiter v6 swap, SOL → token (4C4tZgit…): the SOL leg is the swapped amount, the new token account\'s rent apart', () => {
    const r = classify('tx-jupiter-sol-to-token-4C4tZgit.json', BUYER, MAINNET);
    expect(r).toMatchObject({kind: 'swap', via: 'Jupiter', extraAssets: 0});
    expect(r.primary).toMatchObject({mint: 'native', raw: -1851208n});
    expect(r.secondary).toMatchObject({mint: BOUGHT_MINT, raw: 179355920n, decimals: 6});
    expect(deltas(r)).toEqual(['moved:short(5yC9):179355920', 'moved:SOL:-1851208', 'rent:SOL:-1513840']);
  });

  // A26b (r2 N2) — DERIVED from 2FSgk4Ge…: the wSOL account the swap closes EXISTED before (empty, 1488440 lamports of
  // rent): its pre balance is 1488440, the idempotent create's inner instructions (top-level index 2) are removed —
  // it creates nothing — and the close refunds that rent to the seller (post +1488440)
  it('a swap that closes a wSOL account which already existed: the refund is rent, not part of the SOL received', () => {
    const tx = load('tx-jupiter-token-to-sol-2FSgk4Ge.json');
    tx.meta!.preBalances![1] = 1_488_440;
    tx.meta!.postBalances![0]! += 1_488_440;
    tx.meta!.innerInstructions = tx.meta!.innerInstructions!.filter(g => g.index !== 2);
    const r = classify(tx, SELLER, MAINNET);
    expect(r.kind).toBe('swap');
    expect(deltas(r)).toEqual(['moved:short(3gmF):-135435988491', 'moved:SOL:4668480', 'rent:SOL:1488440']);
  });

  // A27
  it('"via" is named only for Jupiter v6', () => {
    expect(classify('tx-jupiter-token-to-sol-2FSgk4Ge.json', SELLER, {...MAINNET, jupiterProgramId: 'SomeOtherProgram'})).toMatchObject({kind: 'swap', via: null});
  });
});

describe('account setup, no funds moved, failed, unknown (§4.3 rules 1, 7–9)', () => {
  // A28 (r2 N2)
  it("creating one's own ATA (pXiTRFpg…, an idempotent create of a new Token-2022 account): account setup, the rent once", () => {
    const r = classify('tx-ata-own-pXiTRFpg.json', ATA_OWNER, MAINNET);
    expect(r).toMatchObject({kind: 'account-setup', counterparty: null, extraAssets: 0});
    expect(r.primary).toEqual({mint: 'native', symbol: 'SOL', raw: -1513840n, decimals: 9, role: 'rent'});
    expect(deltas(r)).toEqual(['rent:SOL:-1513840']); // the create and its inner createAccount prove it: counted once
  });

  // A29 (r2 N2) — DERIVED from pXiTRFpg…: the top-level create is replaced by an unparsed instruction of an unknown
  // program, so only the INNER createAccount proves the account
  it('a token account created by CPI (an inner instruction alone) is rent', () => {
    const tx = load('tx-ata-own-pXiTRFpg.json');
    const instructions = tx.transaction!.message!.instructions as RawInstruction[];
    const at = instructions.findIndex(x => x.program === 'spl-associated-token-account');
    instructions[at] = {programId: 'SomeProgram1111111111111111111111111111111', accounts: [], data: '1'};
    expect(deltas(classify(tx, ATA_OWNER, MAINNET))).toEqual(['rent:SOL:-1513840']);
  });

  // A30
  it('closing an empty token account (5A6bCt6V…) is account setup: the refund, with its sign', () => {
    const r = classify('tx-close-empty-5A6bCt6V.json', CLOSER, MAINNET);
    expect(r).toMatchObject({kind: 'account-setup', feePaidByAccount: 5000n});
    expect(r.primary).toMatchObject({raw: 1574800n, role: 'rent'});
  });

  // A31
  it("someone else creating this account's ATA (63fU5RvD…): no funds moved for the owner, account setup for the payer", () => {
    expect(classify('tx-ata-for-main-63fU5RvD.json', MAIN)).toMatchObject({kind: 'no-funds-moved', primary: null, deltas: [], feePaidByAccount: null});
    const payer = classify('tx-ata-for-main-63fU5RvD.json', ATA_PAYER);
    expect(payer.kind).toBe('account-setup');
    expect(deltas(payer)).toEqual(['rent:SOL:-1488440']);
  });

  // A32
  it('a failed transaction (2hdMogDK…): failed for everyone, no amount, the fee only for who paid it', () => {
    const payer = classify('tx-failed-sol-2hdMogDK.json', FAILED_PAYER, MAINNET);
    expect(payer).toMatchObject({kind: 'failed', status: 'failed', primary: null, counterparty: null, feePaidByAccount: 5000n, deltas: []});
    expect(classify('tx-failed-sol-2hdMogDK.json', FAILED_RECIPIENT, MAINNET)).toMatchObject({kind: 'failed', status: 'failed', feePaidByAccount: null});
  });

  // A33
  it('the status handed in is kept; `meta.err` overrides it; a failed status makes the kind failed', () => {
    const tx = load('tx-sol-transfer.json');
    expect(classifyActivity(tx, ACC_3, 'confirmed', ctx()).status).toBe('confirmed');
    expect(classifyActivity(tx, ACC_3, 'finalized', ctx()).status).toBe('finalized');
    expect(classifyActivity(tx, ACC_3, 'failed', ctx())).toMatchObject({status: 'failed', kind: 'failed', primary: null});
  });

  // A34
  it('an account that is not in the transaction at all: no funds moved', () => {
    expect(classify('tx-sol-transfer.json', MAIN)).toMatchObject({kind: 'no-funds-moved', deltas: [], feePaidByAccount: null});
  });
});

describe('unattributable entries (§4.2)', () => {
  // A35 — DERIVED from QAgzVzY6…: main's token entries lose their `owner`
  it('an owner-less entry of one of the account\'s token accounts sets incomplete: never "no funds moved"', () => {
    const tx = load('tx-test-to-main.json');
    delete tx.meta!.preTokenBalances![1]!.owner;
    delete tx.meta!.postTokenBalances![1]!.owner;
    const r = classify(tx, MAIN, {ownTokenAccounts: new Set([MAIN_TA])});
    expect(r).toMatchObject({kind: 'unknown', incomplete: true, primary: null, deltas: []});
    // without the source list (opened from #21 or a deep link) the entry is simply not this account's
    expect(classify(tx, MAIN)).toMatchObject({kind: 'no-funds-moved', incomplete: false});
  });

  // A36 — DERIVED from QAgzVzY6…: the sender's entries lose their `decimals`
  it('an entry of the account with unknown decimals sets incomplete and shows no figure', () => {
    const tx = load('tx-test-to-main.json');
    delete tx.meta!.preTokenBalances![0]!.uiTokenAmount!.decimals;
    delete tx.meta!.postTokenBalances![0]!.uiTokenAmount!.decimals;
    expect(classify(tx, ACC_2)).toMatchObject({kind: 'unknown', incomplete: true, primary: null});
  });

  // A37 — DERIVED from pXiTRFpg… (own ATA): a second, owner-less entry of one of the account's token accounts is added
  it('an incomplete row is never "account setup"', () => {
    const tx = load('tx-ata-own-pXiTRFpg.json');
    tx.meta!.postTokenBalances!.push({accountIndex: 4, mint: 'M', uiTokenAmount: {amount: '1', decimals: 6}});
    const mintKey = '6rRptDJnoTGfZzCpFqERAkNt6kCjXzTJcdwtCPYppump'; // account key 4 of this transaction
    const r = classify(tx, ATA_OWNER, {...MAINNET, ownTokenAccounts: new Set([mintKey])});
    expect(r).toMatchObject({kind: 'unknown', incomplete: true});
  });

  // A38 — DERIVED from QAgzVzY6…: `uiAmount` is made wrong on purpose
  it('amounts come from `uiTokenAmount.amount`, never from `uiAmount`', () => {
    const tx = load('tx-test-to-main.json');
    for (const b of [...tx.meta!.preTokenBalances!, ...tx.meta!.postTokenBalances!]) {
      (b.uiTokenAmount as {uiAmount?: number}).uiAmount = 123456;
    }
    expect(deltas(classify(tx, MAIN))).toEqual(['moved:TEST:200000']);
  });
});

describe('amounts at the edges (Review Focus 2)', () => {
  // A40 — DERIVED from QAgzVzY6…: main's token entry goes from 0 to the largest u64
  it('a token amount above 2^53 is exact: it is read as a string into BigInt, never through a float', () => {
    const tx = load('tx-test-to-main.json');
    tx.meta!.preTokenBalances![1]!.uiTokenAmount!.amount = '0';
    tx.meta!.postTokenBalances![1]!.uiTokenAmount!.amount = '18446744073709551615';
    const r = classify(tx, MAIN);
    expect(r.primary).toMatchObject({raw: 18446744073709551615n, decimals: 9});
    expect(r.kind).toBe('received');
  });

  // A41 — DERIVED from 2HWCCJQd…: the recipient's post balance is 2^60 lamports (not a safe integer in JSON)
  it("lamports the JSON can no longer hold exactly are not a balance: incomplete, never a figure and never \"no funds moved\"", () => {
    const tx = load('tx-sol-transfer.json');
    tx.meta!.postBalances![1] = 2 ** 60;
    const r = classify(tx, OUTSIDE);
    expect(r).toMatchObject({incomplete: true, kind: 'unknown', primary: null});
  });

  // A42 — DERIVED from 2HWCCJQd…: the balance arrays are missing
  it('a response without lamport balances: incomplete for an account that is in it', () => {
    const tx = load('tx-sol-transfer.json');
    delete tx.meta!.preBalances;
    delete tx.meta!.postBalances;
    expect(classify(tx, ACC_3)).toMatchObject({incomplete: true, kind: 'unknown', primary: null});
    // an account that is not in the transaction has nothing unread
    expect(classify(tx, MAIN)).toMatchObject({incomplete: false, kind: 'no-funds-moved'});
  });
});

describe('the response as web3.js hands it over', () => {
  // A39 — DERIVED from 3d31ATap…: every account key, program id and instruction account is a PublicKey-like object
  it('keys, program ids and instruction accounts that are objects with toString() are read like strings', () => {
    const key = (s: unknown): unknown => (typeof s === 'string' ? {toString: () => s} : s);
    const wrapIx = (ix: RawInstruction): RawInstruction => ({...ix, programId: key(ix.programId), ...(ix.accounts ? {accounts: ix.accounts.map(key)} : {})});
    const tx = clone(load('tx-deposit-3d31ATap.json'));
    const message = tx.transaction!.message!;
    message.accountKeys = message.accountKeys!.map(k => ({...k, pubkey: key(k.pubkey)}));
    message.instructions = (message.instructions as RawInstruction[]).map(wrapIx);
    tx.meta!.innerInstructions = tx.meta!.innerInstructions!.map(g => ({...g, instructions: g.instructions!.map(wrapIx)}));
    const r = classify(tx, MAIN);
    expect(r.kind).toBe('made-private');
    expect(deltas(r)).toEqual(['moved:TEST:-100000', 'rent:SOL:-695960']);
  });
});
```

- [ ] **Step 2: Run it.** `npx jest src/modules/solana/__tests__/activity.test.ts --forceExit`
      Expected: FAIL — `Cannot find module '../activity'`.

- [ ] **Step 3: Extend the response types in `src/modules/solana/txDetail.ts`.** Two edits; nothing else in the
      file changes (`parseTxDetail` keeps reading what it read).

**Edit 1 of 2 — `src/modules/solana/txDetail.ts`. Find:**

```ts
  mint?: string;
  owner?: string;
  uiTokenAmount?: {decimals?: number};
}

export interface RawParsedTx {
```

**Replace with:**

```ts
  mint?: string;
  owner?: string;
  /** history spec §4.1: `amount` is the base-unit figure (a decimal string); `uiAmount` is never read */
  uiTokenAmount?: {decimals?: number; amount?: string};
}

/**
 * history spec §4.1: an instruction in either of its two forms — parsed `{program, programId, parsed}` or
 * unparsed `{programId, accounts, data}` (`data` is base58). `programId` and `accounts` are strings in a
 * raw RPC response and PublicKey objects from web3.js: read them with `keyString`.
 */
export interface RawInstruction {
  program?: string;
  programId?: unknown;
  parsed?: {type?: string; info?: Record<string, unknown>} | string;
  accounts?: unknown[];
  data?: string;
}

export interface RawParsedTx {
```

**Edit 2 of 2 — `src/modules/solana/txDetail.ts`. Find:**

```ts
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
```

**Replace with:**

```ts
    fee?: number;
    err?: unknown;
    /** lamports per account key, same order as `accountKeys` (history spec §4.1) */
    preBalances?: number[];
    postBalances?: number[];
    preTokenBalances?: RawTokenBalance[] | null;
    postTokenBalances?: RawTokenBalance[] | null;
    /** the instructions each top-level instruction called (CPI); `index` is the top-level position */
    innerInstructions?: Array<{index?: number; instructions?: RawInstruction[]}> | null;
  } | null;
  transaction?: {
    signatures?: string[];
    message?: {
      /** the FULL list: a parsed response already includes the lookup-table addresses */
      accountKeys?: Array<{pubkey?: unknown; signer?: boolean; writable?: boolean}>;
      instructions?: unknown[];
    };
  };
}

const SOL_DECIMALS = 9;

/** An account key as base58: a string in a raw RPC response, a PublicKey object from web3.js. */
export function keyString(k: unknown): string {
  if (typeof k === 'string') {
    return k;
```

- [ ] **Step 4: Export the pool predicate and add the instruction-kind reader in
      `src/modules/shielded/a0/syncedTx.ts`.** `hex` and `A0_IX_DISCRIMINATOR` are already in scope in that file.

**The edit — `src/modules/shielded/a0/syncedTx.ts`. Find:**

```ts
 * 5URd…]. The one predicate for both the instruction decode and the event admission (R1-I1).
 */
function isOurA0Ix(ix: {programId: string; accounts: string[]}): boolean {
  return ix.programId === A0.programId && ix.accounts[0] === A0.pool && ix.accounts[1] === A0.merkleTree;
}

function decodeDeposit(sig: string, ix: TopIx): A0DepositRecord {
```

**Replace with:**

```ts
 * 5URd…]. The one predicate for both the instruction decode and the event admission (R1-I1).
 */
export function isOurA0Ix(ix: {programId: string; accounts: string[]}): boolean {
  return ix.programId === A0.programId && ix.accounts[0] === A0.pool && ix.accounts[1] === A0.merkleTree;
}

/**
 * History spec (2026-11-26) §4.3 rule 2: which of OUR pool's instructions this is, read from the
 * first 8 bytes of its data (the Anchor discriminator) — `null` when the instruction is not ours
 * (`isOurA0Ix`), 'other' for any discriminator the history does not name. It lives here, beside the
 * sync's decoder, because the R6 source guard (`noSelfRelay.test.ts`) allows the withdraw
 * discriminator in this file, `constants.ts` and `relayerClient.ts` only.
 */
export function a0PoolInstructionKind(
  ix: {programId: string; accounts: string[]},
  data: Uint8Array,
): 'deposit' | 'withdraw' | 'other' | null {
  if (!isOurA0Ix(ix)) {
    return null;
  }
  if (data.length < 8) {
    return 'other';
  }
  const disc = hex(data.subarray(0, 8));
  if (disc === A0_IX_DISCRIMINATOR.deposit) {
    return 'deposit';
  }
  return disc === A0_IX_DISCRIMINATOR.withdrawWithChange ? 'withdraw' : 'other';
}

function decodeDeposit(sig: string, ix: TopIx): A0DepositRecord {
```

- [ ] **Step 5: Create `src/modules/solana/activity.ts`:**

```ts
/**
 * History spec (2026-11-26) §4: one parsed transaction → the row #26 shows for ONE account, and the
 * balance changes #27 lists. Pure: the response, the account, the status and every constant are handed
 * in (`ActivityContext`).
 *
 * THE RULE ABOVE ALL (§1.2): a wrong row is worse than none. Nothing is guessed — a field the response
 * does not prove stays null, an entry that cannot be attributed sets `incomplete`, and the kind falls
 * to 'unknown'.
 *
 * AMOUNTS (§4.2, H2) are the account's NET CHANGE per asset, from the balances before and after:
 *   - SOL: postBalances[i] − preBalances[i] for the account's own index i, plus the fee when i == 0
 *     (the fee is never part of a delta). Lamports are integers; tokens are read ONLY from
 *     `uiTokenAmount.amount` (a base-unit decimal string), never from `uiAmount` (a float).
 *   - the native change is then split by role: `rent` (an account PROVEN created or closed by an
 *     instruction, top-level or inner — never inferred from a 0 balance), `markup` (the Noctura fee
 *     transfer, when something else moved too), `grant` (the relayer's gas grant on a relayed Make
 *     public), and the remainder `moved`.
 * All indexes are over `accountKeys`, which in a parsed response already holds the lookup-table
 * addresses.
 */
import {base58} from '@scure/base';
import {A0_DEPOSIT_ACCOUNTS, A0_WITHDRAW_CHANGE_ACCOUNTS} from '../shielded/a0/constants';
import {a0PoolInstructionKind} from '../shielded/a0/syncedTx';
import {keyString} from './txDetail';
import type {RawInstruction, RawParsedTx, RawTokenBalance} from './txDetail';

export const WSOL_MINT = 'So11111111111111111111111111111111111111112';
export const JUPITER_V6_PROGRAM_ID = 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4';
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
const SYSTEM_PROGRAM_ID = '11111111111111111111111111111111';
const ASSOCIATED_TOKEN_PROGRAM_ID = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const SOL_DECIMALS = 9;

export type ActivityStatus = 'confirmed' | 'finalized' | 'failed';

export type ActivityKind =
  | 'sent'
  | 'received'
  | 'swap'
  | 'made-private'
  | 'made-public'
  | 'wrap'
  | 'unwrap'
  | 'account-setup'
  | 'no-funds-moved'
  | 'failed'
  | 'unknown';

export interface Delta {
  /** 'native' for SOL, else the mint */
  mint: 'native' | string;
  symbol: string;
  /** signed, base units */
  raw: bigint;
  decimals: number;
  role: 'moved' | 'rent' | 'markup' | 'grant';
}

export interface ActivityRow {
  signature: string;
  slot: number;
  blockTime: number | null;
  status: ActivityStatus;
  kind: ActivityKind;
  /** the asset the row shows (§4.4) */
  primary: Delta | null;
  /** a swap's incoming leg; null otherwise */
  secondary: Delta | null;
  /** other deltas with role 'moved' (the "+N more") */
  extraAssets: number;
  /** every net change of this account, ordered (§4.4) — #27 lists them */
  deltas: Delta[];
  /** §4.5 — sent / received only */
  counterparty: string | null;
  via: 'Jupiter' | null;
  /** the fee when the account is index 0; null when someone else paid (a relayer) */
  feePaidByAccount: bigint | null;
  /** a balance entry could not be attributed (§4.2) — never 'no-funds-moved', never 'account-setup' */
  incomplete: boolean;
}

export interface ActivityContext {
  /** the trusted symbol source (`trustedSymbol`); 'native' → 'SOL' */
  symbolOf: (mint: string) => string;
  /** the build's cluster (`NETWORK`) */
  cluster: string;
  /** the A0 constants rule 2 needs beyond `isOurA0Ix`: it applies only when `cluster === a0.cluster` */
  a0: {cluster: string; mint: string};
  feeTreasury: string;
  relayerFeePayer: string;
  jupiterProgramId: string;
  /** the account's token-account sources (§3.1); an owner-less entry of one of them sets `incomplete` */
  ownTokenAccounts: ReadonlySet<string>;
}

interface Ix {
  programId: string;
  type: string | null;
  info: Record<string, unknown>;
  accounts: string[];
  data: string | null;
}

interface Proven {
  /** who paid for the creation; undefined when the account was not proven created */
  payer?: string;
  /** where the lamports went on close; undefined when the account was not proven closed */
  closedTo?: string;
}

const ROLE_ORDER: Record<Delta['role'], number> = {moved: 0, markup: 1, grant: 2, rent: 3};

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

/** Lamports (a safe integer) or a base-unit string as BigInt; anything else is not an amount. */
function big(v: unknown): bigint | null {
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) {
    return BigInt(v);
  }
  if (typeof v === 'string' && /^\d+$/.test(v)) {
    return BigInt(v);
  }
  return null;
}

function readIx(raw: unknown): Ix {
  const ix = (raw !== null && typeof raw === 'object' ? raw : {}) as RawInstruction;
  const parsed = typeof ix.parsed === 'object' && ix.parsed !== null ? ix.parsed : undefined;
  return {
    programId: keyString(ix.programId),
    type: str(parsed?.type),
    info: parsed?.info ?? {},
    accounts: Array.isArray(ix.accounts) ? ix.accounts.map(keyString) : [],
    data: str(ix.data),
  };
}

/** Unparsed instruction data is base58; anything that does not decode is no data. */
function dataBytes(data: string | null): Uint8Array {
  if (data === null) {
    return new Uint8Array(0);
  }
  try {
    return base58.decode(data);
  } catch {
    return new Uint8Array(0);
  }
}

const sign = (v: bigint): number => (v > 0n ? 1 : v < 0n ? -1 : 0);

/**
 * §4.4: by role (moved, markup, grant, rent), then non-native before native, then by mint string. Two
 * deltas equal on all three (two rent deltas) keep the order they were made in — the index is the last
 * key, so the result does not depend on the engine's sort being stable.
 */
function ordered(deltas: Delta[]): Delta[] {
  return deltas
    .map((d, at) => ({d, at}))
    .sort((a, b) => {
      const byRole = ROLE_ORDER[a.d.role] - ROLE_ORDER[b.d.role];
      if (byRole !== 0) {
        return byRole;
      }
      const aNative = a.d.mint === 'native' ? 1 : 0;
      const bNative = b.d.mint === 'native' ? 1 : 0;
      if (aNative !== bNative) {
        return aNative - bNative;
      }
      if (a.d.mint !== b.d.mint) {
        return a.d.mint < b.d.mint ? -1 : 1;
      }
      return a.at - b.at;
    })
    .map(x => x.d);
}

export function classifyActivity(raw: RawParsedTx, account: string, status: ActivityStatus, ctx: ActivityContext): ActivityRow {
  const meta = raw.meta ?? {};
  const keys = (raw.transaction?.message?.accountKeys ?? []).map(k => keyString(k.pubkey));
  const pre = meta.preBalances ?? [];
  const post = meta.postBalances ?? [];
  const preTokens = meta.preTokenBalances ?? [];
  const postTokens = meta.postTokenBalances ?? [];
  const fee = big(meta.fee) ?? 0n;
  const i = keys.indexOf(account);
  // §4.1: a parsed transaction carries no confirmation level; `meta.err` overrides the status handed in
  const finalStatus: ActivityStatus = meta.err ? 'failed' : status;

  const top = (raw.transaction?.message?.instructions ?? []).map(readIx);
  const inner = (meta.innerInstructions ?? []).flatMap(group => (group.instructions ?? []).map(readIx));

  // lamports of index k, before and after; a missing entry is not a balance
  const lamports = (side: number[], k: number): bigint | null => big(side[k]);
  const lamportChange = (k: number): bigint => {
    const a = lamports(pre, k);
    const b = lamports(post, k);
    return a === null || b === null ? 0n : b - a;
  };

  // ── token entries, joined by account index ──────────────────────────────────────────────────────────
  const tokenEntries = new Map<number, {pre?: RawTokenBalance; post?: RawTokenBalance}>();
  for (const b of preTokens) {
    if (typeof b.accountIndex === 'number') {
      tokenEntries.set(b.accountIndex, {...tokenEntries.get(b.accountIndex), pre: b});
    }
  }
  for (const b of postTokens) {
    if (typeof b.accountIndex === 'number') {
      tokenEntries.set(b.accountIndex, {...tokenEntries.get(b.accountIndex), post: b});
    }
  }
  const ownerOfIndex = (k: number): string | null => {
    const e = tokenEntries.get(k);
    return str(e?.post?.owner) ?? str(e?.pre?.owner);
  };
  /** the wSOL amount a token account holds on one side (§4.2 "w"); 0 for any other mint or no entry */
  const wrappedAt = (k: number, side: 'pre' | 'post'): bigint => {
    const b = tokenEntries.get(k)?.[side];
    return b !== undefined && b.mint === WSOL_MINT ? big(b.uiTokenAmount?.amount) ?? 0n : 0n;
  };

  // ── §4.3 rule 2: the pool, decided by role and not by sign ──────────────────────────────────────────
  let pool: 'made-private' | 'made-public' | 'other' | null = null;
  let rhoIndex = -1;
  if (ctx.cluster === ctx.a0.cluster) {
    for (const ix of top) {
      // ours = the program with the pool at account 0 and the merkle tree at account 1 (`isOurA0Ix`, not copied)
      const poolIx = a0PoolInstructionKind(ix, dataBytes(ix.data));
      if (poolIx === null) {
        continue;
      }
      pool = pool ?? 'other';
      if (poolIx === 'deposit' && ix.accounts[A0_DEPOSIT_ACCOUNTS.indexOf('depositor')] === account) {
        pool = 'made-private';
        rhoIndex = keys.indexOf(ix.accounts[A0_DEPOSIT_ACCOUNTS.indexOf('rho_marker')] ?? '');
        break;
      }
      if (poolIx === 'withdraw') {
        const destination = keys.indexOf(ix.accounts[A0_WITHDRAW_CHANGE_ACCOUNTS.indexOf('destination_token_account')] ?? '');
        if (destination >= 0 && ownerOfIndex(destination) === account) {
          pool = 'made-public';
          break;
        }
      }
    }
  }

  // ── §4.2: accounts PROVEN created or closed (top-level and inner instructions) ──────────────────────
  const proven = new Map<number, Proven>();
  const prove = (address: string | null, patch: Proven): void => {
    const k = address === null ? -1 : keys.indexOf(address);
    if (k < 0) {
      return;
    }
    const have = proven.get(k) ?? {};
    // each account is counted once: the first proof of a creation (or of a close) stands (review r3 m-a)
    proven.set(k, {payer: have.payer ?? patch.payer, closedTo: have.closedTo ?? patch.closedTo});
  };
  for (const ix of [...top, ...inner]) {
    if (ix.type === null) {
      continue;
    }
    if (ix.programId === SYSTEM_PROGRAM_ID && (ix.type === 'createAccount' || ix.type === 'createAccountWithSeed')) {
      prove(str(ix.info.newAccount), {payer: str(ix.info.source) ?? undefined});
    } else if (ix.programId === ASSOCIATED_TOKEN_PROGRAM_ID && ix.type === 'create') {
      prove(str(ix.info.account), {payer: str(ix.info.source) ?? undefined});
    } else if (ix.programId === ASSOCIATED_TOKEN_PROGRAM_ID && ix.type === 'createIdempotent') {
      const created = str(ix.info.account);
      const k = created === null ? -1 : keys.indexOf(created);
      // an idempotent create of an account that already exists creates nothing
      if (k >= 0 && lamports(pre, k) === 0n) {
        prove(created, {payer: str(ix.info.source) ?? undefined});
      }
    } else if ((ix.programId === TOKEN_PROGRAM_ID || ix.programId === TOKEN_2022_PROGRAM_ID) && ix.type === 'closeAccount') {
      prove(str(ix.info.account), {closedTo: str(ix.info.destination) ?? undefined});
    }
  }
  // the rho marker of our own deposit is the depositor's rent even when no system instruction is parsed (r2 N3)
  if (pool === 'made-private' && rhoIndex >= 0 && lamports(pre, rhoIndex) === 0n && proven.get(rhoIndex)?.payer === undefined) {
    proven.set(rhoIndex, {...proven.get(rhoIndex), payer: account});
  }

  // ── §4.2: the account's tokens ──────────────────────────────────────────────────────────────────────
  // The account's own lamports that are missing, or not a safe integer (above 2^53 the JSON number has already
  // lost digits), are not a balance: no native change is claimed at all, and the row is incomplete rather than wrong.
  const nativeKnown = i >= 0 && lamports(pre, i) !== null && lamports(post, i) !== null;
  let incomplete = i >= 0 && !nativeKnown;
  const tokenChange = new Map<string, {raw: bigint; decimals: number}>();
  for (const [k, e] of tokenEntries) {
    const owner = ownerOfIndex(k);
    if (owner === null) {
      // an entry with no owner cannot be attributed; if it is one of this account's token accounts the row is incomplete
      if (ctx.ownTokenAccounts.has(keys[k] ?? '')) {
        incomplete = true;
      }
      continue;
    }
    if (owner !== account) {
      continue;
    }
    const mint = str(e.post?.mint) ?? str(e.pre?.mint);
    const decimalsRaw = e.post?.uiTokenAmount?.decimals ?? e.pre?.uiTokenAmount?.decimals;
    const before = e.pre === undefined ? 0n : big(e.pre.uiTokenAmount?.amount);
    const after = e.post === undefined ? 0n : big(e.post.uiTokenAmount?.amount);
    if (mint === null || typeof decimalsRaw !== 'number' || !Number.isInteger(decimalsRaw) || decimalsRaw < 0 || before === null || after === null) {
      incomplete = true; // unknown decimals (or no readable amount): never a guessed figure
      continue;
    }
    const have = tokenChange.get(mint);
    tokenChange.set(mint, {raw: (have?.raw ?? 0n) + (after - before), decimals: decimalsRaw});
  }

  const deltas: Delta[] = [];
  for (const [mint, c] of tokenChange) {
    if (c.raw !== 0n) {
      deltas.push({mint, symbol: ctx.symbolOf(mint), raw: c.raw, decimals: c.decimals, role: 'moved'});
    }
  }
  const tokenMoved = deltas.length;

  // ── §4.2: the native change, split by role ──────────────────────────────────────────────────────────
  const native = (role: Delta['role'], amount: bigint): void => {
    if (amount !== 0n) {
      deltas.push({mint: 'native', symbol: ctx.symbolOf('native'), raw: amount, decimals: SOL_DECIMALS, role});
    }
  };
  if (nativeKnown) {
    let rest = lamportChange(i) + (i === 0 ? fee : 0n);
    const paid: bigint[] = [];
    const refunded: bigint[] = [];
    for (const [k, p] of [...proven].sort((a, b) => a[0] - b[0])) {
      // An account created AND closed in one transaction (a swap's temporary wSOL account) has 0 lamports
      // before and after and no token entry on either side: both figures below are 0, so it adds nothing.
      if (p.payer === account) {
        paid.push(lamportChange(k) - wrappedAt(k, 'post'));
      }
      if (p.closedTo === account) {
        refunded.push((lamports(pre, k) ?? 0n) - wrappedAt(k, 'pre'));
      }
    }
    for (const rent of paid) {
      native('rent', -rent);
      rest += rent;
    }
    for (const refund of refunded) {
      native('rent', refund);
      rest -= refund;
    }
    // markup (r2 N3): a top-level system transfer from the account to the fee treasury, when something else moved too
    let markup = 0n;
    for (const ix of top) {
      if (ix.programId === SYSTEM_PROGRAM_ID && ix.type === 'transfer' && ix.info.source === account && ix.info.destination === ctx.feeTreasury) {
        markup += big(ix.info.lamports) ?? 0n;
      }
    }
    if (markup > 0n && (tokenMoved > 0 || rest + markup !== 0n)) {
      native('markup', -markup);
      rest += markup;
    }
    // grant (r2 N3): on a relayed Make public, what the relayer sent the account so it can exist and sign
    if (pool === 'made-public' && keys[0] === ctx.relayerFeePayer && rest > 0n) {
      native('grant', rest);
      rest = 0n;
    }
    native('moved', rest);
  }

  const all = ordered(deltas);
  const moved = all.filter(d => d.role === 'moved');
  const rents = all.filter(d => d.role === 'rent');

  // ── §4.3: the kind, first match wins ────────────────────────────────────────────────────────────────
  let kind: ActivityKind;
  const nativeMoved = moved.find(d => d.mint === 'native');
  const wsolMoved = moved.find(d => d.mint === WSOL_MINT);
  if (finalStatus === 'failed') {
    kind = 'failed';
  } else if (pool !== null) {
    kind = pool === 'other' ? 'unknown' : pool;
  } else if (
    moved.length === 2 &&
    nativeMoved !== undefined &&
    wsolMoved !== undefined &&
    nativeMoved.raw === -wsolMoved.raw
  ) {
    kind = nativeMoved.raw < 0n ? 'wrap' : 'unwrap';
  } else if (moved.some(d => d.raw < 0n) && moved.some(d => d.raw > 0n)) {
    kind = 'swap';
  } else if (moved.length > 0 && moved.every(d => d.raw < 0n)) {
    kind = 'sent';
  } else if (moved.length > 0) {
    kind = 'received';
  } else if (rents.length > 0 && !incomplete) {
    kind = 'account-setup';
  } else if (all.length === 0 && !incomplete) {
    kind = 'no-funds-moved';
  } else {
    kind = 'unknown';
  }

  // ── §4.4: which asset the row shows ─────────────────────────────────────────────────────────────────
  let primary: Delta | null = null;
  let secondary: Delta | null = null;
  switch (kind) {
    case 'sent':
    case 'received':
      primary = moved[0] ?? null;
      break;
    case 'swap':
      primary = moved.find(d => d.raw < 0n) ?? null;
      secondary = moved.find(d => d.raw > 0n) ?? null;
      break;
    case 'made-private':
    case 'made-public':
      primary = moved.find(d => d.mint === ctx.a0.mint) ?? null;
      break;
    case 'wrap':
    case 'unwrap':
      primary = nativeMoved ?? null;
      break;
    case 'account-setup':
      primary = rents[0] ?? null;
      break;
    default:
      break;
  }
  // a wrap's wSOL delta is the other half of the same move, not another asset (plan ruling 3)
  const extraAssets =
    kind === 'wrap' || kind === 'unwrap' ? 0 : moved.filter(d => d !== primary && d !== secondary).length;

  // ── §4.5: the counter-party — for `primary` only, sent and received only ────────────────────────────
  let counterparty: string | null = null;
  if ((kind === 'sent' || kind === 'received') && primary !== null) {
    const want = -sign(primary.raw);
    if (primary.mint === 'native') {
      let candidates: string[] = [];
      for (let k = 0; k < keys.length; k++) {
        if (k === i || tokenEntries.has(k) || proven.has(k)) {
          continue;
        }
        const address = keys[k] ?? '';
        if (address === '' || address === ctx.relayerFeePayer) {
          continue;
        }
        // the fee is added back to index 0: paying it is not a transfer
        if (sign(lamportChange(k) + (k === 0 ? fee : 0n)) === want) {
          candidates.push(address);
        }
      }
      if (candidates.length > 1) {
        candidates = candidates.filter(a => a !== ctx.feeTreasury);
      }
      counterparty = candidates.length === 1 ? candidates[0]! : null;
    } else {
      const owners = new Set<string>();
      let unknownOwner = false;
      for (const [k, e] of tokenEntries) {
        const mint = str(e.post?.mint) ?? str(e.pre?.mint);
        if (mint !== primary.mint) {
          continue;
        }
        const before = e.pre === undefined ? 0n : big(e.pre.uiTokenAmount?.amount) ?? 0n;
        const after = e.post === undefined ? 0n : big(e.post.uiTokenAmount?.amount) ?? 0n;
        if (sign(after - before) !== want) {
          continue;
        }
        const owner = ownerOfIndex(k);
        if (owner === null) {
          unknownOwner = true;
        } else if (owner !== account) {
          owners.add(owner);
        }
      }
      counterparty = !unknownOwner && owners.size === 1 ? [...owners][0]! : null;
    }
  }

  return {
    signature: raw.transaction?.signatures?.[0] ?? '',
    slot: raw.slot ?? 0,
    blockTime: raw.blockTime ?? null,
    status: finalStatus,
    kind,
    primary,
    secondary,
    extraAssets,
    deltas: all,
    counterparty,
    via: kind === 'swap' && top.some(ix => ix.programId === ctx.jupiterProgramId) ? 'Jupiter' : null,
    feePaidByAccount: i === 0 ? fee : null,
    incomplete,
  };
}
```

- [ ] **Step 6: Run the tests.** The Step 2 command. Expected: PASS (48 tests). Then the neighbours this task
      touched: `npx jest src/modules/solana src/modules/shielded/__tests__/noSelfRelay.test.ts src/modules/shielded/a0 --forceExit`
      Expected: PASS — in particular `noSelfRelay.test.ts` ("the withdraw_with_change discriminator lives in
      constants, the sync's decoder and the relayer client only") and every `txDetail.test.ts` case.

- [ ] **Step 7: Prove the tests are tests (mutation, by hand, three of them).** For each line below: make the
      change in `activity.ts`, run the Step 2 command, see at least one test FAIL, and undo the change.
  - `lamportChange(i) + (i === 0 ? fee : 0n)` → `lamportChange(i)` (the fee becomes part of the delta);
  - `if (k >= 0 && lamports(pre, k) === 0n) {` → `if (k >= 0) {` (an existing account counts as created);
  - `if (ctx.cluster === ctx.a0.cluster) {` → `if (true) {` (rule 2 on every cluster).
      Report the three failing test names in the task report. `git diff src/modules/solana/activity.ts` must be
      empty against Step 5's content afterwards.

- [ ] **Step 8: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/modules/solana src/modules/shielded/__tests__/noSelfRelay.test.ts --forceExit`.
      `lint:ci` must print exactly `✖ 143 problems (0 errors, 143 warnings)`.

- [ ] **Step 9: Commit.**

```bash
git add src/modules/solana/txDetail.ts src/modules/shielded/a0/syncedTx.ts \
  src/modules/solana/activity.ts src/modules/solana/__tests__/activity.test.ts
git commit -m "feat(history): classifyActivity — a transaction's row for one account, from its net balance changes"
```

---

### Task 3: The history session — the merged signature stream of one account

Spec: §3.2 (state, building a page, end of history), §3.4 (refresh, restart, identity), §8 "History reading" (merge
order, dedupe, refresh, end of history); Review Focus 5.

**Files:**
- Create: `src/modules/solana/historySession.ts`
- Test: `src/modules/solana/__tests__/historySession.test.ts` (new)

**Interfaces:**
- Consumes (Task 2): `import type {ActivityStatus} from './activity'` (`'confirmed' | 'finalized' | 'failed'`).
- Produces, from `src/modules/solana/historySession.ts`:
  - `export const HISTORY_PAGE_SIZE = 20`, `HISTORY_MAX_SOURCES = 25`, `HISTORY_REFRESH_MAX_PAGES = 5`
  - `export interface SignatureItem {signature: string; slot: number; blockTime: number | null; status: ActivityStatus; finalized: boolean}`
    — `finalized` is kept apart from `status` because a failed transaction's `status` is `'failed'`; the link scan
    (Task 9) needs it for its cursor.
  - `export interface SourceList {sources: string[]; tokenAccountsTotal: number}` — `sources[0]` is the wallet.
  - `export interface HistorySessionDeps {listSources: () => Promise<SourceList>; fetchSignatures: (source: string, before: string | undefined, limit: number) => Promise<SignatureItem[]>}`
  - `export class HistorySession` with: `id: number` (changes on a restart); getters `items: readonly SignatureItem[]`,
    `pagesLoaded: number`, `endReached: boolean`, `tokenAccountSources: ReadonlySet<string>`,
    `coverage: {read: number; total: number}`; methods `loadNextPage(): Promise<void>`, `refresh(): Promise<void>`.
  - `export function historySession(cluster: string, account: string, deps: HistorySessionDeps): HistorySession`
    (get or create), `peekHistorySession(cluster, account): HistorySession | undefined`,
    `dropHistorySessions(account?: string): void`, `dropHistorySessionsExcept(account: string | null): void`.

**Why:** today's history asks one address for 20 signatures (`queries.ts` `getTransactionHistory`). A token transfer
into a token account that already exists does not list the recipient wallet, so that list misses every received
token (spec §3.1; the repo's own `tx-test-to-main.json` never names main). The wallet's history is the merge of
several lists, each paged on its own. This object holds only signatures and cursors — no React, no RPC client, no
transactions: its two reads are handed in, which is what makes the paging testable with scripted sources.

Three properties a reviewer should check against the code, each pinned by a test:
- a source is fetched **exactly** when its buffer is empty and it is not exhausted, and before every take (S3);
- a page that fails loses nothing: what was taken stays in `carry`, what was fetched stays buffered (S5);
- a refresh commits only when **every** source was read, and restarts instead of showing a hole (S6–S11).

- [ ] **Step 1: Write the failing test.** Create `src/modules/solana/__tests__/historySession.test.ts`:

```ts
/**
 * History spec §3.2, §3.4, §8 "History reading": the merged stream against scripted sources. A source
 * is a list of signatures, newest first; `fetchSignatures` pages it exactly as getSignaturesForAddress
 * does (`before` = exclusive cursor). No timers, no React.
 */
import {
  HistorySession,
  HISTORY_PAGE_SIZE,
  dropHistorySessions,
  dropHistorySessionsExcept,
  historySession,
  peekHistorySession,
} from '../historySession';
import type {HistorySessionDeps, SignatureItem, SourceList} from '../historySession';

const item = (signature: string, slot: number): SignatureItem => ({signature, slot, blockTime: slot * 10, status: 'finalized', finalized: true});
/** n items named `${name}${slot}`, slots from `top` down by `step` */
const run = (name: string, top: number, n: number, step = 1): SignatureItem[] =>
  Array.from({length: n}, (_, k) => item(`${name}${top - k * step}`, top - k * step));

function chain(sources: Record<string, SignatureItem[]>, total?: number) {
  const calls: Array<{source: string; before: string | undefined}> = [];
  const world = {sources, list: Object.keys(sources), total, failOn: null as string | null};
  const deps: HistorySessionDeps = {
    listSources: async (): Promise<SourceList> => ({sources: [...world.list], tokenAccountsTotal: world.total ?? world.list.length - 1}),
    fetchSignatures: async (source, before, limit) => {
      calls.push({source, before});
      if (world.failOn === source) {
        throw new Error('rpc down');
      }
      const all = world.sources[source] ?? [];
      const from = before === undefined ? 0 : all.findIndex(x => x.signature === before) + 1;
      return all.slice(from, from + limit);
    },
  };
  return {deps, calls, world};
}
const sigs = (s: HistorySession): string[] => s.items.map(x => x.signature);

// S1 (r2 N5)
it('three sources with interleaved slots across two pages lose no row and repeat none', async () => {
  // W: 30 rows on even slots, T1: 15 on odd slots, T2: 5 rows that are ALSO in W (the same transactions)
  const W = run('w', 200, 30, 2);
  const T1 = run('t', 199, 15, 2);
  const T2 = [W[0]!, W[3]!, W[10]!, W[20]!, W[29]!];
  const {deps} = chain({W, T1, T2});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(s.items).toHaveLength(HISTORY_PAGE_SIZE);
  expect(s.endReached).toBe(false);
  await s.loadNextPage();
  await s.loadNextPage();
  const all = sigs(s);
  expect(all).toHaveLength(45); // 30 + 15; T2 adds nothing
  expect(new Set(all).size).toBe(45);
  const slots = s.items.map(x => x.slot);
  expect(slots).toEqual([...slots].sort((a, b) => b - a)); // newest first across pages
  expect(s.endReached).toBe(true);
});

// S2
it('within one slot the order is by signature; a page is at most 20 rows', async () => {
  const W = [item('b', 9), item('a', 9), item('c', 8)];
  const {deps} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(sigs(s)).toEqual(['a', 'b', 'c']);
});

// S3 (r3 m-b)
it('a source is fetched exactly when its buffer is empty and it is not exhausted; nothing is fetched twice', async () => {
  const W = run('w', 100, 45);
  const T = run('t', 1000, 3); // all newer than W
  const {deps, calls} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  // page 1: both heads; T (3 < 20) is exhausted at once and is never fetched again
  expect(calls).toEqual([
    {source: 'W', before: undefined},
    {source: 'T', before: undefined},
  ]);
  expect(sigs(s).slice(0, 3)).toEqual(['t1000', 't999', 't998']);
  await s.loadNextPage(); // W's buffer (3 left of 20) runs out mid-page → fetched with its cursor
  expect(calls.slice(2)).toEqual([{source: 'W', before: 'w81'}]);
  await s.loadNextPage();
  expect(calls.slice(3)).toEqual([{source: 'W', before: 'w61'}]);
  expect(s.items).toHaveLength(48);
  expect(s.endReached).toBe(true);
});

// S4
it('end of history: an empty account ends on the first page with zero rows', async () => {
  const {deps} = chain({W: []});
  const s = new HistorySession(deps);
  expect(s.endReached).toBe(false); // nothing was read yet: never "no transactions"
  await s.loadNextPage();
  expect(s.items).toEqual([]);
  expect(s.endReached).toBe(true);
  expect(s.pagesLoaded).toBe(1);
});

// S5
it('a failed source fails the page and loses nothing: the retry returns every row once', async () => {
  const W = run('w', 100, 5);
  const T = run('t', 200, 5);
  const {deps, world} = chain({W, T});
  const s = new HistorySession(deps);
  world.failOn = 'T';
  await expect(s.loadNextPage()).rejects.toThrow('rpc down');
  expect(s.items).toEqual([]);
  expect(s.endReached).toBe(false);
  expect(s.pagesLoaded).toBe(0);
  world.failOn = null;
  await s.loadNextPage();
  expect(sigs(s)).toEqual([...T, ...W].map(x => x.signature));
});

// S6 (r2 N6)
it('refresh: 45 new signatures on one source all appear, in order, above the old rows', async () => {
  const W = run('w', 100, 30);
  const {deps, world} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const id = s.id;
  const old = sigs(s);
  const fresh = run('n', 500, 45);
  world.sources.W = [...fresh, ...W];
  await s.refresh();
  expect(s.id).toBe(id); // not restarted
  expect(sigs(s)).toEqual([...fresh.map(x => x.signature), ...old]);
  // the older paging is untouched: the next page continues after w81
  await s.loadNextPage();
  expect(sigs(s).slice(-10)).toEqual(run('w', 80, 10).map(x => x.signature));
});

// S7 (r2 N6)
it('refresh past the 5-page cap restarts the session from the head', async () => {
  const W = run('w', 100, 30);
  const {deps, world} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  await s.loadNextPage();
  const id = s.id;
  world.sources.W = [...run('n', 900, 101), ...W]; // 101 new: the 6th page would be needed
  await s.refresh();
  expect(s.id).not.toBe(id);
  expect(s.pagesLoaded).toBe(1);
  expect(sigs(s)).toEqual(run('n', 900, 20).map(x => x.signature));
});

// S8 (r3 P1)
it('refresh with a second source that has emitted nothing yet takes only what is newer than its newest', async () => {
  const W = run('w', 500, 25);
  const T = run('t', 100, 4); // all older than page 1: fetched, buffered, not emitted
  const {deps, world} = chain({W, T});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(sigs(s).some(x => x.startsWith('t'))).toBe(false);
  const id = s.id;
  world.sources.T = [item('tNew', 900), ...T];
  await s.refresh();
  expect(s.id).toBe(id);
  expect(sigs(s)[0]).toBe('tNew');
  expect(sigs(s).filter(x => x.startsWith('t'))).toEqual(['tNew']); // T's old rows are still to come, once
  await s.loadNextPage();
  expect(sigs(s).filter(x => x.startsWith('t'))).toEqual(['tNew', 't100', 't99', 't98', 't97']);
  expect(new Set(sigs(s)).size).toBe(s.items.length);
});

// S9 (r3 P1, r4 q2)
it('a new token account, or a missing one, restarts the session', async () => {
  const W = run('w', 100, 30);
  const {deps, world} = chain({W, T: run('t', 50, 2)});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  await s.loadNextPage();
  let id = s.id;
  world.sources.T2 = run('x', 999, 1);
  world.list = ['W', 'T', 'T2'];
  await s.refresh();
  expect(s.id).not.toBe(id);
  expect(sigs(s)[0]).toBe('x999');
  expect(s.pagesLoaded).toBe(1);
  id = s.id;
  world.list = ['W', 'T2'];
  await s.refresh();
  expect(s.id).not.toBe(id);
  expect(s.tokenAccountSources).toEqual(new Set(['T2']));
});

// S10 (r4 q2)
it('a source that ends without meeting its newest restarts; one that was empty is simply read', async () => {
  const W = run('w', 100, 5);
  const {deps, world} = chain({W, E: []});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const id = s.id;
  world.sources.E = run('e', 300, 2); // E was empty: these are all new, no hole is possible
  await s.refresh();
  expect(s.id).toBe(id);
  expect(sigs(s)).toEqual(['e300', 'e299', ...W.map(x => x.signature)]);
  world.sources.W = run('z', 400, 3); // W's history was replaced: its newest is gone
  await s.refresh();
  expect(s.id).not.toBe(id);
});

// S11
it('a refresh that fails changes nothing', async () => {
  const W = run('w', 100, 5);
  const {deps, world} = chain({W, T: run('t', 50, 2)});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  const before = sigs(s);
  world.sources.W = [item('new', 999), ...W];
  world.failOn = 'T';
  await expect(s.refresh()).rejects.toThrow('rpc down');
  expect(sigs(s)).toEqual(before);
  world.failOn = null;
  await s.refresh();
  expect(sigs(s)).toEqual(['new', ...before]);
});

// S12
it('a refresh and a load-older never interleave', async () => {
  const W = run('w', 100, 45);
  const {deps, world} = chain({W});
  const s = new HistorySession(deps);
  await s.loadNextPage();
  world.sources.W = [item('new', 999), ...W];
  await Promise.all([s.refresh(), s.loadNextPage()]);
  expect(new Set(sigs(s)).size).toBe(41);
  expect(sigs(s)[0]).toBe('new');
});

// S13 (§3.2 bound)
it('coverage reports the token accounts read and owned', async () => {
  const sources: Record<string, SignatureItem[]> = {W: []};
  for (let k = 0; k < 24; k++) {
    sources[`T${k}`] = [];
  }
  const {deps} = chain(sources, 31);
  const s = new HistorySession(deps);
  await s.loadNextPage();
  expect(s.coverage).toEqual({read: 24, total: 31});
  expect(s.tokenAccountSources.size).toBe(24);
});

// S14
it('the registry: one session per cluster and account; drops by account, by exception and all', async () => {
  const {deps} = chain({W: []});
  dropHistorySessions();
  const a = historySession('devnet', 'A', deps);
  expect(historySession('devnet', 'A', deps)).toBe(a);
  expect(historySession('mainnet-beta', 'A', deps)).not.toBe(a);
  const b = historySession('devnet', 'B', deps);
  dropHistorySessionsExcept('B');
  expect(peekHistorySession('devnet', 'A')).toBeUndefined();
  expect(peekHistorySession('mainnet-beta', 'A')).toBeUndefined();
  expect(peekHistorySession('devnet', 'B')).toBe(b);
  dropHistorySessions('B');
  expect(peekHistorySession('devnet', 'B')).toBeUndefined();
  historySession('devnet', 'A', deps);
  dropHistorySessions();
  expect(peekHistorySession('devnet', 'A')).toBeUndefined();
});
```

- [ ] **Step 2: Run it.** `npx jest src/modules/solana/__tests__/historySession.test.ts --forceExit`
      Expected: FAIL — `Cannot find module '../historySession'`.

- [ ] **Step 3: Create `src/modules/solana/historySession.ts`:**

```ts
/**
 * History spec (2026-11-26) §3.2, §3.4: the merged signature stream of ONE account on ONE cluster.
 *
 * WHY SOURCES: an SPL transfer into a token account that already exists does not list the recipient
 * wallet, so a wallet's history is read from the wallet address AND every token account it owns
 * (§3.1). Each source is paged on its own; this object merges them, newest first.
 *
 * STATE, per source: `buffer` (signatures fetched and not yet emitted, in the order the source
 * returned them), `cursor` (the last signature FETCHED — the `before` of the next fetch), `exhausted`
 * (the last fetch returned fewer than its limit), `newest` (the first signature ever fetched from the
 * source in this session — what a refresh pages down to).
 *
 * It lives OUTSIDE the query cache and holds signatures only: transactions are read and cached per
 * signature elsewhere (`parsedTx.ts`). Every method that reads the chain is serialised (`run`): a
 * refresh and a "load older" never interleave.
 *
 * NOTHING IS LOST ON A FAILURE: a page that throws keeps what it had taken (`carry`) and what every
 * source had fetched; a refresh commits only when every source was read.
 */
import type {ActivityStatus} from './activity';

export const HISTORY_PAGE_SIZE = 20;
/** §3.2: the wallet plus at most 24 token accounts */
export const HISTORY_MAX_SOURCES = 25;
/** §3.4: a refresh that needs more pages than this for one source restarts the session */
export const HISTORY_REFRESH_MAX_PAGES = 5;

export interface SignatureItem {
  signature: string;
  slot: number;
  blockTime: number | null;
  /** from the signature list: `err` set → 'failed', else its confirmation status */
  status: ActivityStatus;
  /** the cluster finalized it — kept apart because a failed transaction's `status` is 'failed' (the link scan's cursor, spec §6.3) */
  finalized: boolean;
}

export interface SourceList {
  /** the wallet first, then its token accounts — at most HISTORY_MAX_SOURCES entries */
  sources: string[];
  /** every token account the wallet owns, read or not (the footer's {m}) */
  tokenAccountsTotal: number;
}

export interface HistorySessionDeps {
  listSources: () => Promise<SourceList>;
  /** newest first; `before` undefined reads from the head */
  fetchSignatures: (source: string, before: string | undefined, limit: number) => Promise<SignatureItem[]>;
}

interface SourceState {
  buffer: SignatureItem[];
  cursor: string | undefined;
  exhausted: boolean;
  newest: string | undefined;
}

/** newest first; within one slot by signature, so the order is fixed (it is not chain order, §3.2) */
function newerFirst(a: SignatureItem, b: SignatureItem): number {
  if (a.slot !== b.slot) {
    return b.slot - a.slot;
  }
  return a.signature < b.signature ? -1 : a.signature > b.signature ? 1 : 0;
}

let nextId = 1;

export class HistorySession {
  /** changes when the session restarts from the head (a restart drops every loaded page) */
  id = nextId++;
  private sources: string[] | null = null;
  private total = 0;
  private state = new Map<string, SourceState>();
  private emitted = new Set<string>();
  private loaded: SignatureItem[] = [];
  private carry: SignatureItem[] = [];
  private pages = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: HistorySessionDeps) {}

  /** every emitted signature, newest page first */
  get items(): readonly SignatureItem[] {
    return this.loaded;
  }

  get pagesLoaded(): number {
    return this.pages;
  }

  /** §3.2: every source is exhausted and every buffer is empty */
  get endReached(): boolean {
    if (this.sources === null || this.carry.length > 0) {
      return false;
    }
    return this.sources.every(s => {
      const st = this.state.get(s)!;
      return st.exhausted && st.buffer.length === 0;
    });
  }

  /** the token accounts this session reads (its sources without the wallet) */
  get tokenAccountSources(): ReadonlySet<string> {
    return new Set((this.sources ?? []).slice(1));
  }

  /** §3.2 footer: how many token accounts are read, of how many the wallet owns */
  get coverage(): {read: number; total: number} {
    return {read: Math.max(0, (this.sources?.length ?? 1) - 1), total: this.total};
  }

  /** The next page of up to HISTORY_PAGE_SIZE rows (the first call also reads the source list). */
  loadNextPage(): Promise<void> {
    return this.run(() => this.buildPage());
  }

  /** §3.4 pull-to-refresh: what is new goes on top; a possible hole restarts the session instead. */
  refresh(): Promise<void> {
    return this.run(() => this.doRefresh());
  }

  private run<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private adopt(list: SourceList): void {
    this.sources = [...list.sources];
    this.total = list.tokenAccountsTotal;
    this.state = new Map(this.sources.map(s => [s, {buffer: [], cursor: undefined, exhausted: false, newest: undefined}]));
  }

  private async fetchInto(source: string): Promise<void> {
    const st = this.state.get(source)!;
    const first = st.cursor === undefined && !st.exhausted;
    const got = await this.deps.fetchSignatures(source, st.cursor, HISTORY_PAGE_SIZE);
    if (first && got.length > 0) {
      st.newest = got[0]!.signature;
    }
    st.buffer.push(...got);
    if (got.length > 0) {
      st.cursor = got[got.length - 1]!.signature;
    }
    st.exhausted = got.length < HISTORY_PAGE_SIZE;
  }

  private async buildPage(): Promise<void> {
    if (this.sources === null) {
      this.adopt(await this.deps.listSources());
    }
    const sources = this.sources!;
    while (this.carry.length < HISTORY_PAGE_SIZE) {
      // before each take, every source whose buffer ran out is fetched: no row surfaces a page late (r3 m-b)
      const dry = sources.filter(s => {
        const st = this.state.get(s)!;
        return st.buffer.length === 0 && !st.exhausted;
      });
      await Promise.all(dry.map(s => this.fetchInto(s)));
      let best: SourceState | null = null;
      for (const s of sources) {
        const st = this.state.get(s)!;
        const head = st.buffer[0];
        if (head !== undefined && (best === null || newerFirst(head, best.buffer[0]!) < 0)) {
          best = st;
        }
      }
      if (best === null) {
        break; // every source is exhausted and empty: the end of history
      }
      const item = best.buffer.shift()!;
      if (!this.emitted.has(item.signature)) {
        this.emitted.add(item.signature);
        this.carry.push(item);
      }
    }
    const page = this.carry.sort(newerFirst);
    this.carry = [];
    this.loaded = [...this.loaded, ...page];
    this.pages += 1;
  }

  private async restart(list: SourceList): Promise<void> {
    this.id = nextId++;
    this.emitted = new Set();
    this.loaded = [];
    this.carry = [];
    this.pages = 0;
    this.adopt(list);
    await this.buildPage();
  }

  private async doRefresh(): Promise<void> {
    if (this.sources === null || this.pages === 0) {
      await this.buildPage();
      return;
    }
    const list = await this.deps.listSources();
    const known = new Set(this.sources);
    const sameSources = list.sources.length === known.size && list.sources.every(s => known.has(s));
    if (!sameSources) {
      await this.restart(list); // a new token account, or one that is gone: its rows could be anywhere
      return;
    }
    let hole = false;
    const perSource = await Promise.all(
      this.sources.map(async source => {
        const st = this.state.get(source)!;
        const fresh: SignatureItem[] = [];
        let before: string | undefined;
        for (let page = 1; ; page++) {
          if (page > HISTORY_REFRESH_MAX_PAGES) {
            hole = true;
            return fresh;
          }
          const got = await this.deps.fetchSignatures(source, before, HISTORY_PAGE_SIZE);
          for (const item of got) {
            if (item.signature === st.newest) {
              return fresh; // met what the session already knows
            }
            fresh.push(item);
          }
          if (got.length < HISTORY_PAGE_SIZE) {
            // the source ended. One that was empty has now been read whole; one that had a `newest`
            // and did not meet it has lost it (r4 q2): its rows can no longer be placed.
            if (st.newest !== undefined) {
              hole = true;
            }
            return fresh;
          }
          before = got[got.length - 1]!.signature;
        }
      }),
    );
    if (hole) {
      await this.restart(list);
      return;
    }
    // every source was read: commit
    this.total = list.tokenAccountsTotal;
    const added: SignatureItem[] = [];
    this.sources.forEach((source, at) => {
      const fresh = perSource[at]!;
      if (fresh.length > 0) {
        this.state.get(source)!.newest = fresh[0]!.signature;
      }
      for (const item of fresh) {
        if (!this.emitted.has(item.signature)) {
          this.emitted.add(item.signature);
          added.push(item);
        }
      }
    });
    if (added.length > 0) {
      this.loaded = [...added.sort(newerFirst), ...this.loaded];
    }
  }
}

const sessions = new Map<string, HistorySession>();
const keyOf = (cluster: string, account: string): string => `${cluster}:${account}`;

/** The account's session on this cluster, created on first use. */
export function historySession(cluster: string, account: string, deps: HistorySessionDeps): HistorySession {
  const key = keyOf(cluster, account);
  let session = sessions.get(key);
  if (session === undefined) {
    session = new HistorySession(deps);
    sessions.set(key, session);
  }
  return session;
}

export function peekHistorySession(cluster: string, account: string): HistorySession | undefined {
  return sessions.get(keyOf(cluster, account));
}

/** Drop one account's sessions (every cluster), or all of them. */
export function dropHistorySessions(account?: string): void {
  if (account === undefined) {
    sessions.clear();
    return;
  }
  for (const key of [...sessions.keys()]) {
    if (key.endsWith(`:${account}`)) {
      sessions.delete(key);
    }
  }
}

/** An account switch: every other account's session goes (§3.2). */
export function dropHistorySessionsExcept(account: string | null): void {
  for (const key of [...sessions.keys()]) {
    if (account === null || !key.endsWith(`:${account}`)) {
      sessions.delete(key);
    }
  }
}
```

- [ ] **Step 4: Run it.** The Step 2 command. Expected: PASS (14 tests).

- [ ] **Step 5: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/modules/solana/__tests__/historySession.test.ts --forceExit`.

- [ ] **Step 6: Commit.**

```bash
git add src/modules/solana/historySession.ts src/modules/solana/__tests__/historySession.test.ts
git commit -m "feat(history): the history session — one account's sources merged newest first, with refresh and restart"
```

---

### Task 4: The chain reads, the per-signature cache, and `loadHistory`

Spec: §3.1 (sources, Token-2022), §3.2 (the bound and the order of sources), §3.3 (the cache, the batch and its
fallback, the limiter keys), §3.4 (partial rows), §8 "History reading"; Review Focus 1 and 5.

**Files:**
- Modify: `src/modules/solana/queries.ts:42-72` (`getTokenAccounts`)
- Create: `src/modules/solana/historyReads.ts`
- Create: `src/modules/solana/activityContext.ts`
- Create: `src/modules/solana/history.ts`
- Test: `src/modules/solana/__tests__/historyReads.test.ts` (new), `src/modules/solana/__tests__/history.test.ts` (new)

**Interfaces:**
- Consumes (Task 2): `classifyActivity`, `ActivityContext`, `ActivityRow`, `JUPITER_V6_PROGRAM_ID` from
  `./activity`; `RawParsedTx` from `./txDetail`.
- Consumes (Task 3): `HISTORY_MAX_SOURCES`, `HISTORY_PAGE_SIZE`, `historySession`, `SignatureItem`, `SourceList`
  from `./historySession`.
- Consumes (existing): `rpcLimiter` (`./rpcLimiter`; `execute(key, fn)` dedupes in flight by key and does not retry
  unless told to), `TokenAccount` (`./types`: `{mint, owner, amount: string, decimals, address}`), `trustedSymbol`
  (`../tokens/trustedSymbol`), `NETWORK` and `NOCTURA_FEE_TREASURY` (`../../constants/programs`), `A0` and
  `A0_RELAYER` (`../shielded/a0/constants`), `sha256` from `@noble/hashes/sha2.js`.
- Produces, from `src/modules/solana/queries.ts`:
  - `export async function getToken2022Accounts(connection: Connection, owner: PublicKey): Promise<TokenAccount[]>`
    (`getTokenAccounts` keeps its signature and behaviour).
- Produces, from `src/modules/solana/historyReads.ts`:
  - `export const PARSED_TX_KEY = 'parsedTx'`, `PARSED_TX_GC_MS = 24 * 60 * 60 * 1000`
  - `export const parsedTxKey: (cluster: string, signature: string) => readonly [string, string, string]`
  - `export function applyParsedTxDefaults(client: QueryClient): void`
  - `export function orderSources(wallet: string, tokenAccounts: readonly TokenAccount[]): SourceList`
  - `export async function listHistorySources(connection: Connection, wallet: string): Promise<SourceList>`
  - `export async function getSignaturePage(connection: Pick<Connection, 'getSignaturesForAddress'>, cluster: string, source: string, before: string | undefined, limit: number): Promise<SignatureItem[]>`
  - `export async function readParsedTransaction(connection: Pick<Connection, 'getParsedTransaction'>, cluster: string, signature: string): Promise<RawParsedTx | null>`
  - `export async function readParsedTransactions(connection: Pick<Connection, 'getParsedTransactions' | 'getParsedTransaction'>, client: QueryClient, cluster: string, signatures: readonly string[]): Promise<Map<string, RawParsedTx>>`
    — a signature that could not be read is ABSENT from the map and is not cached.
- Produces, from `src/modules/solana/activityContext.ts`:
  - `export function activityContext(ownTokenAccounts?: ReadonlySet<string>): ActivityContext`
- Produces, from `src/modules/solana/history.ts`:
  - `export interface HistoryRow {item: SignatureItem; activity: ActivityRow | null}` — `activity: null` is the
    partial row of §3.4.
  - `export interface HistorySnapshot {sessionId: number; rows: HistoryRow[]; endReached: boolean; coverage: {read: number; total: number}}`
  - `export interface HistoryEnv {connection: Connection; client: QueryClient; cluster: string; context: (ownTokenAccounts: ReadonlySet<string>) => ActivityContext}`
  - `export async function loadHistory(account: string, step: 'head' | 'older', env: HistoryEnv): Promise<HistorySnapshot>`

**Why:**
- `getTokenAccounts` (`queries.ts:46`) asks only the classic Token program. Token-2022 accounts are a second call
  (§3.1); the dashboard balances keep reading the classic program alone (spec §9 — do not change them here).
- web3.js `getParsedTransactions` throws if ANY item of the batch came back as an error, so one refused signature
  loses the whole answer. The fallback reads the same signatures one at a time; the one that fails is simply absent
  (Review Focus 1). A null answer is never cached: an unindexed transaction must be asked for again.
- The limiter key decides which calls share one answer. A key without the cursor would hand page 1's signatures to
  page 2; a batch key made of the first signature only would hand one page's transactions to another (review r2 m2).
- **In jest `@solana/web3.js` is a mock** (`__mocks__/@solana/web3.js.ts`): `new PublicKey('x').toBase58()` returns
  `'x'`, and `new Connection(url)` has `jest.fn()` methods. The tests below script those, or hand in a plain object.

- [ ] **Step 1: Write the failing tests.** Create `src/modules/solana/__tests__/historyReads.test.ts`:

```ts
/**
 * History spec §3.1, §3.3, §8 "History reading": the source list, a signature page, and the parsed
 * transaction read with its cache — against a scripted connection. The real rpcLimiter runs (its
 * keys are what is tested); it is reset between tests.
 */
import {QueryClient} from '@tanstack/react-query';
import {Connection} from '@solana/web3.js';
import {rpcLimiter, _resetRateLimitersForTest} from '../rpcLimiter';
import {
  PARSED_TX_GC_MS,
  applyParsedTxDefaults,
  getSignaturePage,
  listHistorySources,
  orderSources,
  parsedTxKey,
  readParsedTransactions,
} from '../historyReads';
import type {RawParsedTx} from '../txDetail';
import type {TokenAccount} from '../types';

const WALLET = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const ta = (address: string, amount: string): TokenAccount => ({address, amount, mint: 'M', owner: WALLET, decimals: 9});
const tx = (slot: number): RawParsedTx => ({slot, meta: {fee: 5000}});

let client: QueryClient;
beforeEach(() => {
  _resetRateLimitersForTest();
  client = new QueryClient();
  applyParsedTxDefaults(client);
});
afterEach(() => {
  client.clear(); // no 24 h gc timer outlives a test
});

describe('orderSources', () => {
  // R1
  it('the wallet first, then funded token accounts, then empty ones, each by address', () => {
    expect(orderSources(WALLET, [ta('Zempty', '0'), ta('Bfunded', '5'), ta('Aempty', '0'), ta('Afunded', '1')])).toEqual({
      sources: [WALLET, 'Afunded', 'Bfunded', 'Aempty', 'Zempty'],
      tokenAccountsTotal: 4,
    });
  });

  // R2 (§3.2 bound)
  it('at most 25 sources: the wallet and 24 token accounts, funded ones kept first; the total counts them all', () => {
    const empty = Array.from({length: 20}, (_, k) => ta(`E${String(k).padStart(2, '0')}`, '0'));
    const funded = Array.from({length: 11}, (_, k) => ta(`F${String(k).padStart(2, '0')}`, '7'));
    const list = orderSources(WALLET, [...empty, ...funded]);
    expect(list.sources).toHaveLength(25);
    expect(list.sources[0]).toBe(WALLET);
    expect(list.sources.slice(1, 12)).toEqual(funded.map(a => a.address));
    expect(list.sources.slice(12)).toEqual(empty.slice(0, 13).map(a => a.address));
    expect(list.tokenAccountsTotal).toBe(31);
  });
});

describe('listHistorySources', () => {
  const account = (address: string, amount: string) => ({
    pubkey: {toBase58: () => address},
    account: {data: {parsed: {info: {mint: 'M', owner: WALLET, tokenAmount: {amount, decimals: 9}}}}},
  });

  // R3 (§3.1)
  it('reads the classic program AND Token-2022', async () => {
    const connection = new Connection('https://x');
    (connection.getParsedTokenAccountsByOwner as jest.Mock).mockImplementation(async (_owner: unknown, filter: {programId: {toBase58: () => string}}) => ({
      value: filter.programId.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' ? [account('T22', '3')] : [account('Classic', '0')],
    }));
    expect(await listHistorySources(connection, WALLET)).toEqual({sources: [WALLET, 'T22', 'Classic'], tokenAccountsTotal: 2});
    expect(connection.getParsedTokenAccountsByOwner).toHaveBeenCalledTimes(2);
  });

  // R4
  it('one failed read fails the list (a partial list would hide rows)', async () => {
    const connection = new Connection('https://x');
    (connection.getParsedTokenAccountsByOwner as jest.Mock).mockImplementation(async (_owner: unknown, filter: {programId: {toBase58: () => string}}) => {
      if (filter.programId.toBase58() === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') {
        throw new Error('rpc down');
      }
      return {value: []};
    });
    await expect(listHistorySources(connection, WALLET)).rejects.toThrow('rpc down');
  });
});

describe('getSignaturePage', () => {
  // R5
  it('maps status: err → failed, finalized, anything else → confirmed; keeps `finalized` apart; passes limit and before', async () => {
    const connection = {
      getSignaturesForAddress: jest.fn(async (_address: unknown, _options: unknown) => [
        {signature: 'a', slot: 3, blockTime: 30, confirmationStatus: 'finalized', err: null},
        {signature: 'b', slot: 2, blockTime: null, confirmationStatus: 'confirmed', err: null},
        {signature: 'c', slot: 1, blockTime: 10, confirmationStatus: 'finalized', err: {InstructionError: [0, 'Custom']}},
      ]),
    };
    expect(await getSignaturePage(connection as never, 'devnet', WALLET, 'cursor', 20)).toEqual([
      {signature: 'a', slot: 3, blockTime: 30, status: 'finalized', finalized: true},
      {signature: 'b', slot: 2, blockTime: null, status: 'confirmed', finalized: false},
      {signature: 'c', slot: 1, blockTime: 10, status: 'failed', finalized: true},
    ]);
    expect(connection.getSignaturesForAddress.mock.calls[0]![1]).toEqual({limit: 20, before: 'cursor'});
  });

  // R6 (r2 m2)
  it('the limiter key holds the method, the cluster, the source and the cursor: it differs per page', async () => {
    const spy = jest.spyOn(rpcLimiter, 'execute');
    const connection = {getSignaturesForAddress: jest.fn(async () => [])};
    await getSignaturePage(connection as never, 'devnet', WALLET, undefined, 20);
    await getSignaturePage(connection as never, 'devnet', WALLET, 'sigX', 20);
    await getSignaturePage(connection as never, 'mainnet-beta', WALLET, 'sigX', 20);
    await getSignaturePage(connection as never, 'devnet', 'OtherSource', 'sigX', 20);
    const keys = spy.mock.calls.map(c => c[0]);
    expect(keys[0]).toBe(`getSignaturesForAddress:devnet:${WALLET}:head:20`);
    expect(new Set(keys).size).toBe(4);
    spy.mockRestore();
  });
});

describe('readParsedTransactions', () => {
  // R7
  it('the batch path: one call for every uncached signature; the answers are cached for 24 h', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => s.map((_x, k) => tx(k + 1))),
      getParsedTransaction: jest.fn(),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    expect(connection.getParsedTransactions).toHaveBeenCalledWith(['a', 'b'], {maxSupportedTransactionVersion: 0});
    expect(got.get('a')).toEqual(tx(1));
    expect(got.get('b')).toEqual(tx(2));
    expect(connection.getParsedTransaction).not.toHaveBeenCalled();
    expect(client.getQueryData(parsedTxKey('devnet', 'a'))).toEqual(tx(1));
    const query = client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'a')})!;
    expect(query.gcTime).toBe(PARSED_TX_GC_MS);
    expect(query.isStale()).toBe(false);
  });

  // R8
  it('the cache is used: no second read of a cached signature; only the new ones are asked for', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => s.map(() => tx(7))),
      getParsedTransaction: jest.fn(),
    };
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    expect(connection.getParsedTransactions).toHaveBeenCalledTimes(1);
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'c']);
    expect(connection.getParsedTransactions).toHaveBeenLastCalledWith(['c'], {maxSupportedTransactionVersion: 0});
    // another cluster shares nothing
    await readParsedTransactions(connection as never, client, 'mainnet-beta', ['a']);
    expect(connection.getParsedTransactions).toHaveBeenLastCalledWith(['a'], {maxSupportedTransactionVersion: 0});
  });

  // R9
  it('the fallback: when the batch throws, the same signatures are read one at a time', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('batch requests are not allowed');
      }),
      getParsedTransaction: jest.fn(async (s: string) => (s === 'b' ? null : tx(s === 'a' ? 1 : 3))),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b', 'c']);
    expect(connection.getParsedTransaction.mock.calls.map(c => c[0])).toEqual(['a', 'b', 'c']);
    expect([...got.keys()]).toEqual(['a', 'c']);
  });

  // R10 (§3.4)
  it('a null answer and a failed single read are absent and NOT cached; the next read asks again', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async () => [tx(1), null]),
      getParsedTransaction: jest.fn(),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    expect(got.has('b')).toBe(false);
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'b')})).toBeUndefined();
    connection.getParsedTransactions.mockResolvedValueOnce([tx(2)]);
    const again = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    expect(connection.getParsedTransactions).toHaveBeenLastCalledWith(['b'], {maxSupportedTransactionVersion: 0});
    expect(again.get('b')).toEqual(tx(2));

    const failing = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('no batch');
      }),
      getParsedTransaction: jest.fn(async () => {
        throw new Error('rpc down');
      }),
    };
    expect((await readParsedTransactions(failing as never, client, 'devnet', ['z'])).size).toBe(0);
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'z')})).toBeUndefined();
  });

  // R14 (Review Focus 1): a transaction the node will not serve at version 0, or one it rate-limits inside the batch
  it('one refused signature fails the batch, then only itself: every other transaction of the page is still read', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async () => {
        throw new Error('failed to get transactions: Transaction version (1) is not supported by the requesting client');
      }),
      getParsedTransaction: jest.fn(async (s: string) => {
        if (s === 'v1') {
          throw new Error('Transaction version (1) is not supported by the requesting client');
        }
        return tx(1);
      }),
    };
    const got = await readParsedTransactions(connection as never, client, 'devnet', ['a', 'v1', 'b']);
    expect([...got.keys()]).toEqual(['a', 'b']);
    expect(client.getQueryCache().find({queryKey: parsedTxKey('devnet', 'v1')})).toBeUndefined();
  });

  // R11 (r2 m2)
  it('the batch key is a hash of EVERY signature: two pages sharing a first signature never share an answer', async () => {
    const spy = jest.spyOn(rpcLimiter, 'execute');
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => s.map(() => tx(1))),
      getParsedTransaction: jest.fn(),
    };
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'b']);
    await readParsedTransactions(connection as never, client, 'devnet', ['c', 'd']);
    client.clear();
    await readParsedTransactions(connection as never, client, 'devnet', ['a', 'd']);
    const keys = spy.mock.calls.map(c => c[0]);
    expect(keys).toHaveLength(3);
    expect(new Set(keys).size).toBe(3);
    expect(keys.every(k => /^getParsedTransactions:devnet:[0-9a-f]{32}$/.test(k))).toBe(true);
    spy.mockRestore();
  });

  // R13
  it('more than 20 uncached signatures are read in batches of 20', async () => {
    const connection = {
      getParsedTransactions: jest.fn(async (s: string[]) => s.map(() => tx(1))),
      getParsedTransaction: jest.fn(),
    };
    const many = Array.from({length: 45}, (_, k) => `s${k}`);
    const got = await readParsedTransactions(connection as never, client, 'devnet', many);
    expect(got.size).toBe(45);
    expect(connection.getParsedTransactions.mock.calls.map(c => c[0].length)).toEqual([20, 20, 5]);
  });

  // R12
  it('nothing to read: no call at all', async () => {
    const connection = {getParsedTransactions: jest.fn(), getParsedTransaction: jest.fn()};
    expect((await readParsedTransactions(connection as never, client, 'devnet', [])).size).toBe(0);
    expect(connection.getParsedTransactions).not.toHaveBeenCalled();
  });
});
```

      and `src/modules/solana/__tests__/history.test.ts`:

```ts
/**
 * History spec §3, §8 "History reading": `loadHistory` against a scripted chain built from the REAL
 * fixtures. The connection is a plain object; the query client is real (the per-signature cache).
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {QueryClient} from '@tanstack/react-query';
import {_resetRateLimitersForTest} from '../rpcLimiter';
import {applyParsedTxDefaults} from '../historyReads';
import {dropHistorySessions} from '../historySession';
import {loadHistory} from '../history';
import type {HistoryEnv} from '../history';
import type {ActivityContext} from '../activity';
import type {RawParsedTx} from '../txDetail';

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, 'fixtures', name), 'utf8')) as {result: RawParsedTx}).result;

const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const MAIN_TA = 'A3hWoQY9JME12b1kVyxCZdpgbpLm5NYJJTYKLBdFGaR7';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const ACC_4 = 'AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR';
const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const TOKEN_2022 = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

const FIXTURES: Record<string, RawParsedTx> = {
  // QAgzVzY6…: Account 2 → main's EXISTING token account; main's wallet address is not in it (review C1)
  QAgz: load('tx-test-to-main.json'),
  '2Xgj': load('tx-test-acc4-to-main-2XgjNKS8.json'),
  '2bGS': load('tx-sol-to-empty-2bGSoVSG.json'),
};

const ctxFor = (own: ReadonlySet<string>): ActivityContext => ({
  symbolOf: m => (m === 'native' ? 'SOL' : m === TEST_MINT ? 'TEST' : 'short'),
  cluster: 'devnet',
  a0: {cluster: 'devnet', mint: TEST_MINT},
  feeTreasury: 'TREASURY',
  relayerFeePayer: 'RELAYER',
  jupiterProgramId: 'JUP',
  ownTokenAccounts: own,
});

interface Sig {
  signature: string;
  slot: number;
  blockTime: number | null;
  confirmationStatus: string;
  err: unknown;
}
const sig = (signature: string, slot: number): Sig => ({signature, slot, blockTime: slot, confirmationStatus: 'finalized', err: null});

function world(bySource: Record<string, Sig[]>, tokenAccounts: Record<string, string[]>) {
  const state = {bySource, unreadable: new Set<string>(), signatureCalls: 0, txCalls: [] as string[][]};
  const connection = {
    getParsedTokenAccountsByOwner: jest.fn(async (owner: {toBase58: () => string}, filter: {programId: {toBase58: () => string}}) => ({
      value:
        filter.programId.toBase58() === TOKEN_2022
          ? []
          : (tokenAccounts[owner.toBase58()] ?? []).map(address => ({
              pubkey: {toBase58: () => address},
              account: {data: {parsed: {info: {mint: TEST_MINT, owner: owner.toBase58(), tokenAmount: {amount: '5', decimals: 9}}}}},
            })),
    })),
    getSignaturesForAddress: jest.fn(async (address: {toBase58: () => string}, options: {limit: number; before?: string}) => {
      state.signatureCalls += 1;
      const all = state.bySource[address.toBase58()] ?? [];
      const from = options.before === undefined ? 0 : all.findIndex(x => x.signature === options.before) + 1;
      return all.slice(from, from + options.limit);
    }),
    getParsedTransactions: jest.fn(async (signatures: string[]) => {
      state.txCalls.push(signatures);
      return signatures.map(s => (state.unreadable.has(s) ? null : FIXTURES[s] ?? null));
    }),
    getParsedTransaction: jest.fn(async () => null),
  };
  return {connection, state};
}

let client: QueryClient;
const env = (connection: unknown): HistoryEnv => ({connection: connection as HistoryEnv['connection'], client, cluster: 'devnet', context: ctxFor});

beforeEach(() => {
  _resetRateLimitersForTest();
  dropHistorySessions();
  client = new QueryClient();
  applyParsedTxDefaults(client);
});
afterEach(() => {
  client.clear();
});

// H1 (review C1)
it("QAgzVzY6… appears in main's history through main's token-account source, as Received from Account 2", async () => {
  // the wallet's own signature list does not hold it: only the token account's does
  const {connection} = world({[MAIN]: [sig('2bGS', 100)], [MAIN_TA]: [sig('QAgz', 300), sig('2Xgj', 400)]}, {[MAIN]: [MAIN_TA]});
  const snap = await loadHistory(MAIN, 'head', env(connection));
  expect(snap.rows.map(r => r.item.signature)).toEqual(['2Xgj', 'QAgz', '2bGS']);
  const q = snap.rows[1]!.activity!;
  expect(q).toMatchObject({signature: 'QAgz', slot: 300, blockTime: 300, kind: 'received', counterparty: ACC_2, status: 'finalized'});
  expect(q.primary).toMatchObject({mint: TEST_MINT, symbol: 'TEST', raw: 200000n, decimals: 9});
  expect(snap.rows[0]!.activity).toMatchObject({kind: 'received', counterparty: ACC_4});
  expect(snap.rows[2]!.activity).toMatchObject({kind: 'sent', counterparty: '2ixJm1hh6Ff8KuUCoaAe1myqKAT2PimVJ3B6ubuYQMr9'});
  expect(snap.endReached).toBe(true);
  expect(snap.coverage).toEqual({read: 1, total: 1});
});

// H2 (§3.4)
it('a partial row: a transaction that is not readable yet still has a row, and the next load re-tries it', async () => {
  const {connection, state} = world({[MAIN]: [sig('2bGS', 100)], [MAIN_TA]: [sig('QAgz', 300)]}, {[MAIN]: [MAIN_TA]});
  state.unreadable.add('QAgz');
  const first = await loadHistory(MAIN, 'head', env(connection));
  expect(first.rows.map(r => [r.item.signature, r.activity === null])).toEqual([
    ['QAgz', true],
    ['2bGS', false],
  ]);
  expect(first.rows[0]!.item).toEqual({signature: 'QAgz', slot: 300, blockTime: 300, status: 'finalized', finalized: true});
  state.unreadable.clear();
  const second = await loadHistory(MAIN, 'head', env(connection)); // a refresh
  expect(second.rows[0]!.activity).toMatchObject({kind: 'received'});
  // the second transaction read asked ONLY for the unparsed one (the other is cached)
  expect(state.txCalls).toEqual([['QAgz', '2bGS'], ['QAgz']]);
});

// H7 (Review Focus 1)
it('a transaction the node refuses is one partial row; the rest of the page is parsed', async () => {
  const {connection} = world({[MAIN]: [sig('2bGS', 100), sig('refused', 90)], [MAIN_TA]: [sig('QAgz', 300)]}, {[MAIN]: [MAIN_TA]});
  connection.getParsedTransactions.mockRejectedValue(new Error('failed to get transactions: Transaction version (1) is not supported'));
  connection.getParsedTransaction.mockImplementation((async (s: string) => {
    if (s === 'refused') {
      throw new Error('Transaction version (1) is not supported');
    }
    return FIXTURES[s] ?? null;
  }) as never);
  const snap = await loadHistory(MAIN, 'head', env(connection));
  expect(snap.rows.map(r => [r.item.signature, r.activity?.kind ?? 'partial'])).toEqual([
    ['QAgz', 'received'],
    ['2bGS', 'sent'],
    ['refused', 'partial'],
  ]);
});

// H3 (§3.3)
it('the status of a row comes from the signature list; a failed one is failed', async () => {
  const failed: Sig = {...sig('2bGS', 100), err: {InstructionError: [0, 'Custom']}};
  const {connection} = world({[MAIN]: [failed]}, {});
  const snap = await loadHistory(MAIN, 'head', env(connection));
  expect(snap.rows[0]!.activity).toMatchObject({kind: 'failed', status: 'failed'});
});

// H4
it('older pages: "older" appends, "head" after that refreshes and keeps them', async () => {
  const many = Array.from({length: 45}, (_, k) => sig(`s${45 - k}`, 45 - k));
  const {connection, state} = world({[MAIN]: many}, {});
  const p1 = await loadHistory(MAIN, 'head', env(connection));
  expect(p1.rows).toHaveLength(20);
  expect(p1.endReached).toBe(false);
  const p2 = await loadHistory(MAIN, 'older', env(connection));
  expect(p2.rows).toHaveLength(40);
  state.bySource[MAIN] = [sig('new', 999), ...many];
  const p3 = await loadHistory(MAIN, 'head', env(connection));
  expect(p3.sessionId).toBe(p1.sessionId);
  expect(p3.rows).toHaveLength(41);
  expect(p3.rows[0]!.item.signature).toBe('new');
});

// H5 (§3.4)
it("an account switch never shows the old account's rows: sessions and rows are per account", async () => {
  const {connection} = world({[MAIN]: [sig('2bGS', 100)], [ACC_4]: [sig('2Xgj', 400)]}, {});
  const a = await loadHistory(MAIN, 'head', env(connection));
  const b = await loadHistory(ACC_4, 'head', env(connection));
  expect(a.rows.map(r => r.item.signature)).toEqual(['2bGS']);
  expect(b.rows.map(r => r.item.signature)).toEqual(['2Xgj']);
  expect(b.rows[0]!.activity).toMatchObject({kind: 'sent', counterparty: MAIN});
  expect(b.sessionId).not.toBe(a.sessionId);
});

// H6 (§3.4)
it('a failed signature read throws: nothing is claimed about an account that was not read', async () => {
  const {connection} = world({[MAIN]: []}, {});
  connection.getSignaturesForAddress.mockRejectedValueOnce(new Error('rpc down'));
  await expect(loadHistory(MAIN, 'head', env(connection))).rejects.toThrow('rpc down');
  const ok = await loadHistory(MAIN, 'head', env(connection));
  expect(ok).toMatchObject({rows: [], endReached: true});
});
```

- [ ] **Step 2: Run them.**
      `npx jest src/modules/solana/__tests__/historyReads.test.ts src/modules/solana/__tests__/history.test.ts --forceExit`
      Expected: FAIL — `Cannot find module '../historyReads'` and `'../history'`.

- [ ] **Step 3: Add the Token-2022 read to `src/modules/solana/queries.ts`.** One edit: `getTokenAccounts` keeps its
      name, key and result; its body moves into a helper both programs use.

**The edit — `src/modules/solana/queries.ts`. Find:**

```ts
}

/**
 * Get all SPL token accounts for an owner.
 * Uses getParsedTokenAccountsByOwner for jsonParsed encoding (returns typed data).
 */
export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenAccount[]> {
  return rpcLimiter.execute(`getTokenAccounts:${owner.toBase58()}`, async () => {
    // getParsedTokenAccountsByOwner returns jsonParsed data with typed info,
    // avoiding manual binary decoding of SPL Token account layout.
    const response = await connection.getParsedTokenAccountsByOwner(owner, {
      programId: TOKEN_PROGRAM_ID,
    });

    return response.value.map(item => {
      const info = item.account.data.parsed.info as {
        mint: string;
        owner: string;
        tokenAmount: {amount: string; decimals: number};
      };
      return {
        mint: info.mint,
        owner: info.owner,
        amount: info.tokenAmount.amount,
        decimals: info.tokenAmount.decimals,
        address: item.pubkey.toBase58(),
      };
    });
  });
}

export interface GetTransactionHistoryOptions {
```

**Replace with:**

```ts
}

/** The Token-2022 program: its token accounts are a separate read (history spec §3.1). */
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');

async function tokenAccountsOf(connection: Connection, owner: PublicKey, programId: PublicKey): Promise<TokenAccount[]> {
  // getParsedTokenAccountsByOwner returns jsonParsed data with typed info,
  // avoiding manual binary decoding of SPL Token account layout.
  const response = await connection.getParsedTokenAccountsByOwner(owner, {programId});
  return response.value.map(item => {
    const info = item.account.data.parsed.info as {
      mint: string;
      owner: string;
      tokenAmount: {amount: string; decimals: number};
    };
    return {
      mint: info.mint,
      owner: info.owner,
      amount: info.tokenAmount.amount,
      decimals: info.tokenAmount.decimals,
      address: item.pubkey.toBase58(),
    };
  });
}

/**
 * Get all SPL token accounts for an owner (the classic Token program).
 * Uses getParsedTokenAccountsByOwner for jsonParsed encoding (returns typed data).
 */
export async function getTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<TokenAccount[]> {
  return rpcLimiter.execute(`getTokenAccounts:${owner.toBase58()}`, () => tokenAccountsOf(connection, owner, TOKEN_PROGRAM_ID));
}

/**
 * History spec §3.1: the owner's Token-2022 token accounts. Read for the history's sources and the
 * link scan only — the dashboard balances still read the classic program alone (spec §9).
 */
export async function getToken2022Accounts(connection: Connection, owner: PublicKey): Promise<TokenAccount[]> {
  return rpcLimiter.execute(`getToken2022Accounts:${owner.toBase58()}`, () => tokenAccountsOf(connection, owner, TOKEN_2022_PROGRAM_ID));
}

export interface GetTransactionHistoryOptions {
```

- [ ] **Step 4: Create `src/modules/solana/historyReads.ts`:**

```ts
/**
 * History spec (2026-11-26) §3.1, §3.3: the chain reads behind the history (#26), the detail (#27) and
 * the link scan — the source list, one page of signatures, and parsed transactions with their cache.
 *
 * THE CACHE: a landed transaction does not change, so a raw parsed transaction is kept per signature
 * under ['parsedTx', cluster, signature] with `staleTime: Infinity` and `gcTime: 24 h`
 * (`applyParsedTxDefaults`). A null answer (not indexed yet) and a failed read are NOT cached: the
 * signature is simply absent from the result, and the caller shows a partial row or retries.
 *
 * THE LIMITER KEY (`rpcLimiter` dedupes in flight by key) holds the method and the cluster, plus the
 * source and its cursor for a signature read, and a hash of EVERY signature for a batch — a shorter
 * key would hand one page's answer to another (review r2 m2).
 *
 * COST, stated honestly: a batch is one HTTP call carrying N JSON-RPC requests; providers count each.
 * The batch saves round trips, not quota.
 */
import {PublicKey} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import type {QueryClient} from '@tanstack/react-query';
import {sha256} from '@noble/hashes/sha2.js';
import {rpcLimiter} from './rpcLimiter';
import {getToken2022Accounts, getTokenAccounts} from './queries';
import {HISTORY_MAX_SOURCES, HISTORY_PAGE_SIZE} from './historySession';
import type {SignatureItem, SourceList} from './historySession';
import type {RawParsedTx} from './txDetail';
import type {TokenAccount} from './types';

export const PARSED_TX_KEY = 'parsedTx';
export const PARSED_TX_GC_MS = 24 * 60 * 60 * 1000;
export const parsedTxKey = (cluster: string, signature: string): readonly [string, string, string] => [PARSED_TX_KEY, cluster, signature];

/** The client default `gcTime` (5 min) would collect them: every `parsedTx` entry lives 24 h and never goes stale. */
export function applyParsedTxDefaults(client: QueryClient): void {
  client.setQueryDefaults([PARSED_TX_KEY], {staleTime: Infinity, gcTime: PARSED_TX_GC_MS});
}

/**
 * §3.2: the wallet first, then its token accounts with a balance, then the empty ones (each group by
 * address, so the list is stable); at most HISTORY_MAX_SOURCES in all.
 */
export function orderSources(wallet: string, tokenAccounts: readonly TokenAccount[]): SourceList {
  const byAddress = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  const funded = tokenAccounts.filter(a => a.amount !== '0').map(a => a.address).sort(byAddress);
  const empty = tokenAccounts.filter(a => a.amount === '0').map(a => a.address).sort(byAddress);
  const all = [...new Set([...funded, ...empty])].filter(a => a !== wallet);
  return {sources: [wallet, ...all.slice(0, HISTORY_MAX_SOURCES - 1)], tokenAccountsTotal: all.length};
}

/** §3.1: the wallet and every token account it owns — classic AND Token-2022. Either read failing fails the list. */
export async function listHistorySources(connection: Connection, wallet: string): Promise<SourceList> {
  const owner = new PublicKey(wallet);
  const [classic, token2022] = await Promise.all([getTokenAccounts(connection, owner), getToken2022Accounts(connection, owner)]);
  return orderSources(wallet, [...classic, ...token2022]);
}

/** One page of a source's signatures, newest first. */
export async function getSignaturePage(
  connection: Pick<Connection, 'getSignaturesForAddress'>,
  cluster: string,
  source: string,
  before: string | undefined,
  limit: number,
): Promise<SignatureItem[]> {
  return rpcLimiter.execute(`getSignaturesForAddress:${cluster}:${source}:${before ?? 'head'}:${limit}`, async () => {
    const options: {limit: number; before?: string} = {limit};
    if (before !== undefined) {
      options.before = before;
    }
    const signatures = await connection.getSignaturesForAddress(new PublicKey(source), options);
    return signatures.map(s => ({
      signature: s.signature,
      slot: s.slot,
      blockTime: s.blockTime ?? null,
      status: s.err != null ? ('failed' as const) : s.confirmationStatus === 'finalized' ? ('finalized' as const) : ('confirmed' as const),
      finalized: s.confirmationStatus === 'finalized',
    }));
  });
}

function hashOf(signatures: readonly string[]): string {
  const digest = sha256(new TextEncoder().encode(signatures.join(',')));
  return Array.from(digest.subarray(0, 16), b => b.toString(16).padStart(2, '0')).join('');
}

const READ_CONFIG = {maxSupportedTransactionVersion: 0} as const;

/** One batch of at most HISTORY_PAGE_SIZE signatures: the batch call, else one at a time. Index-aligned; null = no answer. */
async function readChunk(
  connection: Pick<Connection, 'getParsedTransactions' | 'getParsedTransaction'>,
  cluster: string,
  chunk: string[],
): Promise<Array<RawParsedTx | null>> {
  try {
    const answers = (await rpcLimiter.execute(`getParsedTransactions:${cluster}:${hashOf(chunk)}`, () =>
      connection.getParsedTransactions(chunk, READ_CONFIG),
    )) as unknown as Array<RawParsedTx | null>;
    if (Array.isArray(answers) && answers.length === chunk.length) {
      return answers;
    }
  } catch {
    // refused or failed (one refused item fails the whole batch in web3.js): the same signatures, one at a time
  }
  const answers: Array<RawParsedTx | null> = [];
  for (const signature of chunk) {
    answers.push(await readParsedTransaction(connection, cluster, signature).catch(() => null));
  }
  return answers;
}

/** One transaction, uncached: null when the node has not indexed it. Throws when the read fails. */
export async function readParsedTransaction(
  connection: Pick<Connection, 'getParsedTransaction'>,
  cluster: string,
  signature: string,
): Promise<RawParsedTx | null> {
  return (await rpcLimiter.execute(`getParsedTransaction:${cluster}:${signature}`, () =>
    connection.getParsedTransaction(signature, READ_CONFIG),
  )) as unknown as RawParsedTx | null;
}

/**
 * §3.3: the parsed transactions of `signatures`, from the cache where it has them. The rest is read
 * in batches of HISTORY_PAGE_SIZE: ONE batch call each; if a batch throws, one at a time. A signature the node answers null for, or
 * whose single read fails, is absent from the result and is not cached.
 */
export async function readParsedTransactions(
  connection: Pick<Connection, 'getParsedTransactions' | 'getParsedTransaction'>,
  client: QueryClient,
  cluster: string,
  signatures: readonly string[],
): Promise<Map<string, RawParsedTx>> {
  const out = new Map<string, RawParsedTx>();
  const missing: string[] = [];
  for (const signature of new Set(signatures)) {
    const cached = client.getQueryData<RawParsedTx>(parsedTxKey(cluster, signature));
    if (cached !== undefined) {
      out.set(signature, cached);
    } else {
      missing.push(signature);
    }
  }
  if (missing.length === 0) {
    return out;
  }
  for (let from = 0; from < missing.length; from += HISTORY_PAGE_SIZE) {
    const chunk = missing.slice(from, from + HISTORY_PAGE_SIZE);
    const answers = await readChunk(connection, cluster, chunk);
    chunk.forEach((signature, at) => {
      const tx = answers[at] ?? null;
      if (tx !== null) {
        client.setQueryData(parsedTxKey(cluster, signature), tx);
        out.set(signature, tx);
      }
    });
  }
  return out;
}
```

- [ ] **Step 5: Create `src/modules/solana/activityContext.ts`:**

```ts
/**
 * History spec §4.1: the app's values for `classifyActivity` — kept apart from `activity.ts` so the
 * classifier stays pure (its tests hand every constant in).
 */
import {NETWORK, NOCTURA_FEE_TREASURY} from '../../constants/programs';
import {A0, A0_RELAYER} from '../shielded/a0/constants';
import {trustedSymbol} from '../tokens/trustedSymbol';
import {JUPITER_V6_PROGRAM_ID} from './activity';
import type {ActivityContext} from './activity';

const NO_ACCOUNTS: ReadonlySet<string> = new Set();

export function activityContext(ownTokenAccounts: ReadonlySet<string> = NO_ACCOUNTS): ActivityContext {
  return {
    symbolOf: trustedSymbol,
    cluster: NETWORK,
    a0: A0,
    feeTreasury: NOCTURA_FEE_TREASURY,
    relayerFeePayer: A0_RELAYER.feePayer,
    jupiterProgramId: JUPITER_V6_PROGRAM_ID,
    ownTokenAccounts,
  };
}
```

- [ ] **Step 6: Create `src/modules/solana/history.ts`:**

```ts
/**
 * History spec (2026-11-26) §3: one account's history as #26 shows it — the session's signatures
 * (`historySession.ts`), their parsed transactions (`historyReads.ts`, cached per signature) and the
 * classifier (`activity.ts`), put together. No React here: the hook (`useActivityHistory`) calls
 * `loadHistory` and keeps the answer in the query cache.
 *
 * §3.4: a signature whose transaction is not readable yet STILL has a row (`activity: null` — the
 * "partial" row: date and status from the signature list, "Transaction", "—"). It is never dropped,
 * and every load re-tries every row that is still unparsed.
 */
import type {Connection} from '@solana/web3.js';
import type {QueryClient} from '@tanstack/react-query';
import {classifyActivity} from './activity';
import type {ActivityContext, ActivityRow} from './activity';
import {getSignaturePage, listHistorySources, readParsedTransactions} from './historyReads';
import {historySession} from './historySession';
import type {SignatureItem} from './historySession';

export interface HistoryRow {
  /** from the signature list: always present */
  item: SignatureItem;
  /** null while the transaction could not be read (§3.4) */
  activity: ActivityRow | null;
}

export interface HistorySnapshot {
  /** changes when the session restarted from the head */
  sessionId: number;
  rows: HistoryRow[];
  /** §3.2: every source is exhausted and every buffer is empty */
  endReached: boolean;
  /** token accounts read, of those the wallet owns (the footer when read < total) */
  coverage: {read: number; total: number};
}

export interface HistoryEnv {
  connection: Connection;
  client: QueryClient;
  cluster: string;
  /** the classifier's constants for this account's token accounts (`activityContext`) */
  context: (ownTokenAccounts: ReadonlySet<string>) => ActivityContext;
}

/**
 * 'head': the first page, or — once a page is loaded — the §3.4 refresh. 'older': the next page.
 * Throws when a signature list (or the source list) cannot be read; a transaction that cannot be
 * read is a partial row, never an error.
 */
export async function loadHistory(account: string, step: 'head' | 'older', env: HistoryEnv): Promise<HistorySnapshot> {
  const session = historySession(env.cluster, account, {
    listSources: () => listHistorySources(env.connection, account),
    fetchSignatures: (source, before, limit) => getSignaturePage(env.connection, env.cluster, source, before, limit),
  });
  if (step === 'older' || session.pagesLoaded === 0) {
    await session.loadNextPage();
  } else {
    await session.refresh();
  }
  const items = [...session.items];
  // only the uncached ones are read: a new page's, and every loaded row still unparsed
  const raws = await readParsedTransactions(
    env.connection,
    env.client,
    env.cluster,
    items.map(x => x.signature),
  );
  const ctx = env.context(session.tokenAccountSources);
  return {
    sessionId: session.id,
    rows: items.map(item => {
      const raw = raws.get(item.signature);
      return {
        item,
        // the signature list is the authority for the signature, the slot and the time
        activity:
          raw === undefined
            ? null
            : {...classifyActivity(raw, account, item.status, ctx), signature: item.signature, slot: item.slot, blockTime: item.blockTime ?? raw.blockTime ?? null},
      };
    }),
    endReached: session.endReached,
    coverage: session.coverage,
  };
}
```

- [ ] **Step 7: Run them.** The Step 2 command. Expected: PASS
      (14 + 7 tests). Also
      `npx jest src/modules/solana/__tests__/queries.test.ts src/modules/accounts src/modules/backgroundSync --forceExit`
      — every existing user of `getTokenAccounts` still passes.

- [ ] **Step 8: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/modules/solana --forceExit`.

- [ ] **Step 9: Commit.**

```bash
git add src/modules/solana/queries.ts src/modules/solana/historyReads.ts src/modules/solana/activityContext.ts \
  src/modules/solana/history.ts src/modules/solana/__tests__/historyReads.test.ts src/modules/solana/__tests__/history.test.ts
git commit -m "feat(history): sources incl. Token-2022, the per-signature transaction cache, and loadHistory"
```

---

### Task 5: What a row says — the words, the pure view, and UTC for every test

Spec: §5.1 (rows, H7, H8), §5.2 (which kinds a chip shows), §5.3 (`sectionOf`, determinism), §4.5 "Shown as", §4.6
(the hero, the agreement rule, the balance-change lines, "at today's price"), §8 "Screen" (`sectionOf`), §11;
Review Focus 2 and 4.

**Files:**
- Modify: `src/copy/transactions.ts` (append; the six existing constants stay)
- Create: `src/modules/solana/activityView.ts`
- Create: `jest.globalSetup.js`
- Modify: `jest.config.js:1-2`
- Test: `src/modules/solana/__tests__/activityView.test.ts` (new), `src/modules/solana/__tests__/timezone.test.ts` (new)

**Interfaces:**
- Consumes (Task 2): `ActivityRow`, `Delta` from `./activity`; `TxTransfer` from `./txDetail`.
- Consumes (Task 4): `HistoryRow` from `./history` (`{item: SignatureItem; activity: ActivityRow | null}`).
- Consumes (existing): `formatBalanceForDisplay(raw: string, decimals: number): string` (the shared 4-place
  formatter: groups thousands, `"<0.0001"` below the shown precision) and
  `formatTokenAmount(amount: bigint, decimals: number): string` (exact) from `src/utils/parseTokenAmount`;
  `shortAccountAddress(address)` (first 6 … last 6) and `AccountList` from `src/modules/accounts/accountList`;
  `TX_SENT`, `TX_RECEIVED`, `TX_NEUTRAL` already in `src/copy/transactions.ts`.
- Produces, from `src/copy/transactions.ts`: the constants and functions in Step 3, among them
  `export type HistoryChipId = 'all' | 'sent' | 'received' | 'swaps' | 'private'`,
  `HISTORY_CHIPS: ReadonlyArray<{id: HistoryChipId; label: string}>`, `historyChipNoneLoaded(chipLabel, loaded)`,
  `historyChipNone(chipLabel)`, `HISTORY_LOAD_OLDER`, `historyCoverage(read, total)`, `SECTION_TODAY`,
  `SECTION_YESTERDAY`, `TX_PRIVATE_BADGE`, `TX_BALANCE_CHANGES`, `txAtTodaysPrice(usd: string)`.
- Produces, from `src/modules/solana/activityView.ts`:
  - `export type RowIcon = 'sent' | 'received' | 'swap' | 'private' | 'setup' | 'failed' | 'dot'`
  - `export interface RowView {icon: RowIcon; title: string; badge: boolean; secondary: string; amount: string; amountTone: 'default' | 'success' | 'tertiary'; note: string | null; sub: string | null}`
  - `export function rowView(row: HistoryRow, labelOf: (address: string) => string, now: number, tz: string): RowView`
  - `export function sectionOf(blockTime: number | null, now: number, tz: string): {key: string; title: string}` —
    keys `'today' | 'yesterday' | 'week' | 'month' | 'YYYY-MM' | 'unknown'`; `blockTime` in seconds, `now` in ms.
  - `export function rowTime(blockTime: number | null, now: number, tz: string): string`
  - `export function groupSections(rows: readonly HistoryRow[], now: number, tz: string): Array<{key: string; title: string; data: HistoryRow[]}>`
  - `export function chipMatches(chip: HistoryChipId, row: HistoryRow): boolean`
  - `export function counterpartyLabel(list: AccountList | null, address: string): string`
  - `export function deviceTimeZone(): string`, `zonedDate(ms: number, tz: string)`
  - for #27: `activityWord(row: ActivityRow | null): string`, `heroAmount(row: ActivityRow | null): string | null`,
    `partiesAgree(transfer: TxTransfer | null, row: ActivityRow | null, account: string | null): boolean`,
    `changeLine(d: Delta): string`, `primaryUsdToday(row: ActivityRow | null, usdOf: (mint: string) => number | null): number | null`,
    `exactAmount(d: Delta): string`, `unsignedAmount(d: Delta): string`.

**Why:**
- A screen test cannot cover eleven row forms, six sections and a DST change without becoming unreadable. Everything
  a row SAYS is a pure function here, and the screens of Tasks 7 and 8 only place it.
- **The fifth chip and the badge read "Private".** The design (`index.html` #26, `screen.md` §26) and spec §5.2 call
  them "Shielded", but that word is banned from every user-visible string since UX part B
  (`bannedWords.test.ts`, whose regexes this PR must not change), and the app's one vocabulary is
  "Private" / "Made private" / "Made public" (`src/copy/modes.ts`). The chip id in code is `'private'` (ruling 1).
- **Rows use the shared 4-place formatter** (spec §5.1 "Formatting"), so 0.00001 TEST reads "<0.0001" there; **#27
  shows the exact figure** as PR 1 did ("0.00001 TEST"), and so do the balance-change lines (the spec's own example
  "−0.00204 SOL · account rent" has five places) (ruling 6).
- **No `toLocaleString`.** `core/util/parseTokenAmount.ts` records that Hermes' `toLocaleString('en-US')` does not
  group digits on the device (it does in Node, which hides it) — locale output is not to be trusted there. The calendar parts come from `Intl.DateTimeFormat(...).formatToParts` with an
  IANA `timeZone`, the month names from the copy file, and if the engine does not know the zone the device's own
  clock is used.
- **TZ=UTC.** Spec §5.3: "Jest config pins `TZ=UTC`". It does not today: add a `globalSetup` (it runs once, before
  the workers start, and they inherit the environment). CI already runs in UTC, so nothing that passes there
  changes.

- [ ] **Step 1: Write the failing tests.** Create `src/modules/solana/__tests__/timezone.test.ts`:

```ts
/** History spec §5.3: the jest run is pinned to UTC (jest.globalSetup.js), whatever the machine's zone is. */
it('the test run is in UTC', () => {
  expect(process.env.TZ).toBe('UTC');
  expect(new Date(2026, 0, 15, 12).getTimezoneOffset()).toBe(0);
  expect(new Date(2026, 6, 15, 12).getTimezoneOffset()).toBe(0);
});
```

      and `src/modules/solana/__tests__/activityView.test.ts`:

```ts
/**
 * History spec §5.1–§5.3, §4.5 "Shown as", §4.6: the pure row view, the sections, the time, and #27's
 * hero / parties / balance-change helpers. `now` and
 * the IANA zone are always passed in; nothing here reads the clock or asserts `toLocaleString` output.
 */
import {
  activityWord,
  changeLine,
  chipMatches,
  counterpartyLabel,
  groupSections,
  heroAmount,
  partiesAgree,
  primaryUsdToday,
  rowTime,
  rowView,
  sectionOf,
  zonedDate,
} from '../activityView';
import type {ActivityRow, Delta} from '../activity';
import type {TxTransfer} from '../txDetail';
import type {HistoryRow} from '../history';
import type {AccountList} from '../../accounts/accountList';

const LJ = 'Europe/Ljubljana';
/** seconds, as a block time */
const at = (iso: string): number => Date.parse(iso) / 1000;
const ms = (iso: string): number => Date.parse(iso);
// Thursday 26 Nov 2026, 12:00 in Ljubljana (CET, UTC+1)
const NOW = ms('2026-11-26T11:00:00Z');

const delta = (mint: string, symbol: string, raw: bigint, decimals = 9, role: Delta['role'] = 'moved'): Delta => ({mint, symbol, raw, decimals, role});
const activity = (over: Partial<ActivityRow>): ActivityRow => ({
  signature: 'SIG',
  slot: 1,
  blockTime: at('2026-11-26T08:14:00Z'),
  status: 'finalized',
  kind: 'unknown',
  primary: null,
  secondary: null,
  extraAssets: 0,
  deltas: [],
  counterparty: null,
  via: null,
  feePaidByAccount: null,
  incomplete: false,
  ...over,
});
const row = (over: Partial<ActivityRow> | null, blockTime: number | null = at('2026-11-26T08:14:00Z')): HistoryRow => ({
  item: {signature: 'SIG', slot: 1, blockTime, status: 'finalized', finalized: true},
  activity: over === null ? null : activity({...over, blockTime}),
});
const label = (a: string): string => `<${a}>`;
const view = (r: HistoryRow) => rowView(r, label, NOW, LJ);

describe('sectionOf (§5.3)', () => {
  // V1
  it('Today / Yesterday are calendar days in the zone passed in', () => {
    // 00:30 on the 26th in Ljubljana is 23:30 on the 25th in UTC
    const t = at('2026-11-25T23:30:00Z');
    expect(sectionOf(t, NOW, LJ)).toEqual({key: 'today', title: 'Today'});
    expect(sectionOf(t, NOW, 'UTC')).toEqual({key: 'yesterday', title: 'Yesterday'});
    expect(sectionOf(at('2026-11-25T10:00:00Z'), NOW, LJ).title).toBe('Yesterday');
  });

  // V2
  it('This week: an earlier day of the same Monday-start week; Sunday before it is This month', () => {
    expect(sectionOf(at('2026-11-24T10:00:00Z'), NOW, LJ).title).toBe('This week'); // Tuesday
    expect(sectionOf(at('2026-11-22T23:00:00Z'), NOW, LJ).title).toBe('This week'); // Monday 00:00 local
    expect(sectionOf(at('2026-11-22T22:59:00Z'), NOW, LJ).title).toBe('This month'); // Sunday 23:59 local
    expect(sectionOf(at('2026-11-01T12:00:00Z'), NOW, LJ).title).toBe('This month');
  });

  // V3
  it('on a Monday the week holds nothing earlier: Sunday is Yesterday, Saturday is This month', () => {
    const monday = ms('2026-11-23T11:00:00Z');
    expect(sectionOf(at('2026-11-22T12:00:00Z'), monday, LJ).title).toBe('Yesterday');
    expect(sectionOf(at('2026-11-21T12:00:00Z'), monday, LJ).title).toBe('This month');
  });

  // V4
  it('a week that crosses a month or a year stays This week; older is "{Month YYYY}"', () => {
    const wed2Dec = ms('2026-12-02T11:00:00Z');
    expect(sectionOf(at('2026-11-30T12:00:00Z'), wed2Dec, LJ).title).toBe('This week'); // Monday, in November
    expect(sectionOf(at('2026-11-29T12:00:00Z'), wed2Dec, LJ)).toEqual({key: '2026-11', title: 'November 2026'});
    const sat2Jan = ms('2027-01-02T11:00:00Z');
    expect(sectionOf(at('2026-12-31T12:00:00Z'), sat2Jan, LJ).title).toBe('This week');
    expect(sectionOf(at('2026-12-27T12:00:00Z'), sat2Jan, LJ)).toEqual({key: '2026-12', title: 'December 2026'});
    expect(sectionOf(at('2026-10-31T12:00:00Z'), NOW, LJ)).toEqual({key: '2026-10', title: 'October 2026'});
  });

  // V5 (r2 m7)
  it('an IANA zone, not a fixed offset: a summer date falls on its own day across the DST change', () => {
    // 22:30 UTC on 15 July is 00:30 on 16 July in Ljubljana (CEST, UTC+2); a fixed +1 would say 23:30 on the 15th
    const t = at('2026-07-15T22:30:00Z');
    expect(zonedDate(t * 1000, LJ)).toEqual({year: 2026, month: 7, day: 16, hour: 0, minute: 30});
    expect(rowTime(t, NOW, LJ)).toBe('16 Jul');
    expect(sectionOf(t, NOW, LJ).title).toBe('July 2026');
    // the night the clocks go back (25 Oct 2026): 00:30 local is still CEST
    const night = at('2026-10-24T22:30:00Z');
    expect(rowTime(night, ms('2026-10-25T11:00:00Z'), LJ)).toBe('00:30');
  });

  // V6
  it('no block time → Date unknown; a time ahead of the clock → Today', () => {
    expect(sectionOf(null, NOW, LJ)).toEqual({key: 'unknown', title: 'Date unknown'});
    expect(sectionOf(at('2026-11-27T12:00:00Z'), NOW, LJ).title).toBe('Today');
    expect(rowTime(null, NOW, LJ)).toBe('');
  });

  // V7
  it('a zone the engine does not know falls back to the device clock instead of throwing', () => {
    expect(() => sectionOf(at('2026-11-26T08:00:00Z'), NOW, 'Not/AZone')).not.toThrow();
  });
});

describe('rowTime (§5.1)', () => {
  // V8
  it('"HH:mm" for Today and Yesterday, else "d MMM"', () => {
    expect(rowTime(at('2026-11-26T08:14:00Z'), NOW, LJ)).toBe('09:14');
    expect(rowTime(at('2026-11-25T15:36:00Z'), NOW, LJ)).toBe('16:36');
    expect(rowTime(at('2026-11-24T15:36:00Z'), NOW, LJ)).toBe('24 Nov');
    expect(rowTime(at('2026-05-06T10:00:00Z'), NOW, LJ)).toBe('6 May');
  });
});

describe('groupSections', () => {
  // V9
  it('keeps the row order, one group per section, Date unknown last', () => {
    const rows = [row(null, null), row(null, at('2026-11-26T08:00:00Z')), row(null, at('2026-11-25T08:00:00Z')), row(null, at('2026-11-26T07:00:00Z'))];
    const groups = groupSections(rows, NOW, LJ);
    expect(groups.map(g => [g.title, g.data.length])).toEqual([
      ['Today', 2],
      ['Yesterday', 1],
      ['Date unknown', 1],
    ]);
  });
});

describe('rowView (§5.1)', () => {
  const TEST = delta('MINT', 'TEST', -100000n);
  const SOL_IN = delta('native', 'SOL', 5_000_000n);

  // V10
  it('sent: arrow, "Sent {sym}", "to {cp} · {time}", −amount without a symbol', () => {
    expect(view(row({kind: 'sent', primary: TEST, counterparty: 'CP'}))).toEqual({
      icon: 'sent', title: 'Sent TEST', badge: false, secondary: 'to <CP> · 09:14', amount: '−0.0001', amountTone: 'default', note: null, sub: null,
    });
    // no counter-party known: the time alone, never a guessed address
    expect(view(row({kind: 'sent', primary: TEST})).secondary).toBe('09:14');
  });

  // V11
  it('received: "+amount" in the success tone, "from {cp} · {time}"', () => {
    expect(view(row({kind: 'received', primary: SOL_IN, counterparty: 'CP'}))).toMatchObject({
      icon: 'received', title: 'Received SOL', secondary: 'from <CP> · 09:14', amount: '+0.005', amountTone: 'success',
    });
  });

  // V12
  it('swap: "Swapped {out} → {in}", −out, the incoming leg under it with its symbol, via Jupiter', () => {
    const out = delta('native', 'SOL', -1_200_000_000n);
    const into = delta('NOC', 'NOC', 9_524_100_000_000n);
    expect(view(row({kind: 'swap', primary: out, secondary: into, via: 'Jupiter'}))).toMatchObject({
      icon: 'swap', title: 'Swapped SOL → NOC', secondary: 'via Jupiter · 09:14', amount: '−1.2', sub: '+9,524.1 NOC', amountTone: 'default',
    });
    expect(view(row({kind: 'swap', primary: out, secondary: into})).secondary).toBe('09:14');
  });

  // V13
  it('the two pool rows carry the badge; the amount is "—" when the row has no pool-token change', () => {
    expect(view(row({kind: 'made-private', primary: TEST}))).toMatchObject({icon: 'private', badge: true, title: 'Made private TEST', secondary: '09:14', amount: '−0.0001'});
    expect(view(row({kind: 'made-public', primary: delta('MINT', 'TEST', 10000n)}))).toMatchObject({badge: true, title: 'Made public TEST', amount: '+<0.0001', amountTone: 'success'});
    expect(view(row({kind: 'made-private', primary: null}))).toMatchObject({title: 'Made private', amount: '—'});
  });

  // V14
  it('wrap / unwrap: their own titles, the SOL amount', () => {
    expect(view(row({kind: 'wrap', primary: delta('native', 'SOL', -59_167_663_567n)}))).toMatchObject({icon: 'swap', title: 'Wrapped SOL', amount: '−59.1677'});
    expect(view(row({kind: 'unwrap', primary: delta('native', 'SOL', 13_229_146n)}))).toMatchObject({title: 'Unwrapped SOL', amount: '+0.0132', amountTone: 'success'});
  });

  // V15
  it('account setup: "Transaction", "Account setup · {time}", the true amount with SOL', () => {
    expect(view(row({kind: 'account-setup', primary: delta('native', 'SOL', -1_488_440n, 9, 'rent')}))).toMatchObject({
      icon: 'setup', title: 'Transaction', secondary: 'Account setup · 09:14', amount: '−0.0015 SOL',
    });
    expect(view(row({kind: 'account-setup', primary: delta('native', 'SOL', 1_574_800n, 9, 'rent')})).amount).toBe('+0.0016 SOL');
  });

  // V16
  it('failed: "—", and the fee line only when this account paid it', () => {
    expect(view(row({kind: 'failed', status: 'failed', feePaidByAccount: 5000n}))).toMatchObject({icon: 'failed', title: 'Failed', amount: '—', sub: 'fee 0.000005 SOL'});
    expect(view(row({kind: 'failed', status: 'failed', feePaidByAccount: null})).sub).toBeNull();
  });

  // V17
  it('no funds moved, unknown and partial rows: a dot, "Transaction", never a direction', () => {
    expect(view(row({kind: 'no-funds-moved'}))).toMatchObject({icon: 'dot', title: 'Transaction', amount: 'No funds moved', amountTone: 'tertiary'});
    expect(view(row({kind: 'unknown'}))).toMatchObject({icon: 'dot', title: 'Transaction', amount: '—'});
    expect(view(row(null))).toEqual({icon: 'dot', title: 'Transaction', badge: false, secondary: '09:14', amount: '—', amountTone: 'default', note: null, sub: null});
  });

  // V18
  it('"+N more" after the amount; " · incomplete" as a note on sent / received / swap only', () => {
    expect(view(row({kind: 'sent', primary: TEST, extraAssets: 2})).amount).toBe('−0.0001 +2 more');
    expect(view(row({kind: 'sent', primary: TEST, incomplete: true})).note).toBe(' · incomplete');
    expect(view(row({kind: 'received', primary: SOL_IN, incomplete: true})).note).toBe(' · incomplete');
    expect(view(row({kind: 'unknown', incomplete: true})).note).toBeNull();
    expect(view(row({kind: 'made-private', primary: TEST, incomplete: true})).note).toBeNull();
  });

  // V19 (Review Focus 3)
  it('an amount below the shown precision reads "<0.0001" with its sign, never 0 and never scientific notation', () => {
    expect(view(row({kind: 'received', primary: delta('native', 'SOL', 1n)})).amount).toBe('+<0.0001');
    expect(view(row({kind: 'sent', primary: delta('native', 'SOL', -1n)})).amount).toBe('−<0.0001');
  });

  // V20
  it('a row with no block time has no time: the counter-party alone, or nothing', () => {
    expect(rowView(row({kind: 'sent', primary: TEST, counterparty: 'CP'}, null), label, NOW, LJ).secondary).toBe('to <CP>');
    expect(rowView(row(null, null), label, NOW, LJ).secondary).toBe('');
  });
});

describe('chipMatches (§5.2)', () => {
  // V21
  it('each chip shows its kinds; the pool moves are never Sent or Received; a partial row is under All only', () => {
    const kinds = ['sent', 'received', 'swap', 'made-private', 'made-public', 'wrap', 'failed', 'unknown'] as const;
    const under = (chip: Parameters<typeof chipMatches>[0]) => kinds.filter(kind => chipMatches(chip, row({kind})));
    expect(under('all')).toEqual([...kinds]);
    expect(under('sent')).toEqual(['sent']);
    expect(under('received')).toEqual(['received']);
    expect(under('swaps')).toEqual(['swap']);
    expect(under('private')).toEqual(['made-private', 'made-public']);
    expect(chipMatches('all', row(null))).toBe(true);
    expect(chipMatches('sent', row(null))).toBe(false);
  });
});

describe('counterpartyLabel (§4.5)', () => {
  const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
  const EXIT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
  const OTHER = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
  const list: AccountList = {
    accounts: [
      {scheme: 'slip10:0', address: MAIN, label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false},
      {scheme: 'slip10:1', address: EXIT, label: 'Account 2', number: 2, role: 'fresh-exit', isMain: false, linked: false},
    ],
    seed: [],
    walletKind: 'slip10',
    unreadable: false,
  };

  // V22
  it('own wallets by label, any other wallet as first 6 … last 6 (never 4…4)', () => {
    expect(counterpartyLabel(list, EXIT)).toBe('Account 2');
    expect(counterpartyLabel(list, MAIN)).toBe('Account 1 (main)');
    expect(counterpartyLabel(list, OTHER)).toBe('EfHSPx…mwXGgk');
  });

  // V23
  it('an unreadable registry (or none) names nobody: the short form for every address', () => {
    expect(counterpartyLabel({...list, unreadable: true}, EXIT)).toBe('9Y7Ftt…epTki4');
    expect(counterpartyLabel(null, MAIN)).toBe('Da83cA…Zxe31B');
  });
});

// ── #27 (§4.6) ───────────────────────────────────────────────────────────────────────────────────────

describe('the detail (#27, §4.6)', () => {
  const ME = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
  const THEM = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
  const TEST = delta('MINT', 'TEST', -200000n);
  const transfer = (over: Partial<TxTransfer> = {}): TxTransfer => ({
    mint: 'MINT', symbol: 'TEST', amount: '0.0002', from: ME, authority: ME, fromTokenAccount: 'SRC_TA',
    to: THEM, toIsTokenAccount: false, toTokenAccount: 'DST_TA', ...over,
  });

  // V24
  it('activityWord: one word per kind; everything without a direction — and no account — is "Transaction"', () => {
    const word = (kind: ActivityRow['kind']) => activityWord(activity({kind}));
    expect(word('sent')).toBe('Sent');
    expect(word('received')).toBe('Received');
    expect(word('swap')).toBe('Swapped');
    expect(word('made-private')).toBe('Made private');
    expect(word('made-public')).toBe('Made public');
    expect(word('wrap')).toBe('Wrapped SOL');
    expect(word('unwrap')).toBe('Unwrapped SOL');
    expect(word('failed')).toBe('Failed');
    expect(word('account-setup')).toBe('Transaction');
    expect(word('no-funds-moved')).toBe('Transaction');
    expect(word('unknown')).toBe('Transaction');
    expect(activityWord(null)).toBe('Transaction');
  });

  // V25
  it('heroAmount: the exact figure without a sign, with its symbol; a swap as "{out} → {in}"; null with no primary', () => {
    expect(heroAmount(activity({kind: 'sent', primary: TEST}))).toBe('0.0002 TEST');
    expect(heroAmount(activity({kind: 'received', primary: delta('native', 'SOL', 1n)}))).toBe('0.000000001 SOL'); // exact, not "<0.0001"
    expect(
      heroAmount(activity({kind: 'swap', primary: delta('native', 'SOL', -1_200_000_000n), secondary: delta('N', 'NOC', 9_524_100_000_000n)})),
    ).toBe('1.2 SOL → 9524.1 NOC');
    expect(heroAmount(activity({kind: 'failed'}))).toBeNull();
    expect(heroAmount(null)).toBeNull();
  });

  // V26 (r2 N7)
  it('partiesAgree: only when the transfer IS the row — asset, side, counter-party, a recipient wallet', () => {
    const sent = activity({kind: 'sent', primary: TEST, counterparty: THEM});
    expect(partiesAgree(transfer(), sent, ME)).toBe(true);
    const received = activity({kind: 'received', primary: delta('MINT', 'TEST', 200000n), counterparty: THEM});
    expect(partiesAgree(transfer({from: THEM, to: ME}), received, ME)).toBe(true);
    // each condition alone breaks it
    expect(partiesAgree(transfer({mint: 'OTHER'}), sent, ME)).toBe(false); // another asset
    expect(partiesAgree(transfer({from: THEM}), sent, ME)).toBe(false); // the account is not the transfer's From
    expect(partiesAgree(transfer({to: 'SOMEONE'}), sent, ME)).toBe(false); // not the row's counter-party
    expect(partiesAgree(transfer(), {...sent, counterparty: null}, ME)).toBe(false); // two recipients: nobody named
    expect(partiesAgree(transfer({toIsTokenAccount: true}), sent, ME)).toBe(false); // a token account is not a wallet
    expect(partiesAgree(transfer({from: null, to: ME}), {...received, counterparty: THEM}, ME)).toBe(false); // a null From
    expect(partiesAgree(transfer(), {...sent, primary: null}, ME)).toBe(false);
    expect(partiesAgree(null, sent, ME)).toBe(false);
    expect(partiesAgree(transfer(), null, ME)).toBe(false);
    expect(partiesAgree(transfer(), sent, null)).toBe(false);
    // a swap, a pool move, a wrap never show From / To
    for (const kind of ['swap', 'made-private', 'made-public', 'wrap', 'unwrap', 'failed', 'unknown'] as const) {
      expect(partiesAgree(transfer(), {...sent, kind}, ME)).toBe(false);
    }
  });

  // V27
  it('changeLine: the sign, the exact figure, the symbol, and the role in words', () => {
    expect(changeLine(delta('MINT', 'TEST', -100000n))).toBe('−0.0001 TEST');
    expect(changeLine(delta('native', 'SOL', -2_040_000n, 9, 'rent'))).toBe('−0.00204 SOL · account rent');
    expect(changeLine(delta('native', 'SOL', 1_488_440n, 9, 'rent'))).toBe('+0.00148844 SOL · account rent');
    expect(changeLine(delta('native', 'SOL', 2_000_000n, 9, 'grant'))).toBe('+0.002 SOL · gas grant');
    expect(changeLine(delta('native', 'SOL', -20_000n, 9, 'markup'))).toBe('−0.00002 SOL · Noctura fee');
  });

  // V28 (H7)
  it("primaryUsdToday: the hero asset's value at the price handed in; null with no price, no primary, or a price that is not one", () => {
    const sent = activity({kind: 'sent', primary: delta('native', 'SOL', -1_000_000n)});
    expect(primaryUsdToday(sent, () => 150)).toBeCloseTo(0.15, 10);
    expect(primaryUsdToday(sent, () => null)).toBeNull();
    expect(primaryUsdToday(sent, () => 0)).toBeNull();
    expect(primaryUsdToday(sent, () => Number.NaN)).toBeNull();
    expect(primaryUsdToday(activity({kind: 'failed'}), () => 150)).toBeNull();
    expect(primaryUsdToday(null, () => 150)).toBeNull();
    const asked: string[] = [];
    primaryUsdToday(activity({kind: 'received', primary: delta('MINT', 'TEST', 5n)}), mint => {
      asked.push(mint);
      return null;
    });
    expect(asked).toEqual(['MINT']);
  });
});
```

- [ ] **Step 2: Run them.**
      `TZ=America/New_York npx jest src/modules/solana/__tests__/timezone.test.ts src/modules/solana/__tests__/activityView.test.ts --forceExit`
      Expected: FAIL — `timezone.test.ts`: `process.env.TZ` is `"America/New_York"`; `activityView.test.ts`:
      `Cannot find module '../activityView'`.

- [ ] **Step 3: Append the words to `src/copy/transactions.ts`** (after the last existing line; nothing above
      changes):

**The edit — `src/copy/transactions.ts`: append at the end of the file, after one blank line:**

```ts
/**
 * History spec (2026-11-26) §5, §4.6: the words of the history rows (#26) and of the new #27 parts.
 * One vocabulary (`modes.ts`): the pool moves are "Made private" / "Made public" and their chip and
 * badge read "Private" — the design's older word for them is banned from every user-visible string.
 */
export const TX_SWAPPED = 'Swapped';
export const TX_MADE_PRIVATE = 'Made private';
export const TX_MADE_PUBLIC = 'Made public';
export const TX_WRAPPED_SOL = 'Wrapped SOL';
export const TX_UNWRAPPED_SOL = 'Unwrapped SOL';
export const TX_FAILED = 'Failed';
/** The secondary line of a row whose only change is an account's rent (an ATA made or closed) */
export const TX_ACCOUNT_SETUP = 'Account setup';
export const TX_NO_FUNDS_MOVED = 'No funds moved';
/** An amount the wallet could not read from chain: never a guess */
export const TX_AMOUNT_UNKNOWN = '—';
export const TX_VIA_JUPITER = 'via Jupiter';
/** After the amount of a row with a balance entry that could not be attributed */
export const TX_INCOMPLETE = 'incomplete';
/** The badge on the two pool rows */
export const TX_PRIVATE_BADGE = 'Private';

export function txSentTitle(symbol: string): string {
  return `${TX_SENT} ${symbol}`;
}
export function txReceivedTitle(symbol: string): string {
  return `${TX_RECEIVED} ${symbol}`;
}
/** "Swapped SOL → NOC" */
export function txSwapTitle(out: string, into: string): string {
  return `${TX_SWAPPED} ${out} → ${into}`;
}
export function txMadePrivateTitle(symbol: string | null): string {
  return symbol === null ? TX_MADE_PRIVATE : `${TX_MADE_PRIVATE} ${symbol}`;
}
export function txMadePublicTitle(symbol: string | null): string {
  return symbol === null ? TX_MADE_PUBLIC : `${TX_MADE_PUBLIC} ${symbol}`;
}
export function txTo(counterparty: string): string {
  return `to ${counterparty}`;
}
export function txFrom(counterparty: string): string {
  return `from ${counterparty}`;
}
/** Under a failed row's "—", only when this account paid the fee */
export function txFeeLine(fee: string): string {
  return `fee ${fee} SOL`;
}
/** " +2 more" after an amount: other assets moved in the same transaction */
export function txMoreAssets(n: number): string {
  return ` +${n} more`;
}

export type HistoryChipId = 'all' | 'sent' | 'received' | 'swaps' | 'private';
export const HISTORY_CHIPS: ReadonlyArray<{id: HistoryChipId; label: string}> = [
  {id: 'all', label: 'All'},
  {id: 'sent', label: 'Sent'},
  {id: 'received', label: 'Received'},
  {id: 'swaps', label: 'Swaps'},
  {id: 'private', label: 'Private'},
];
/** A chip with no match among the {n} transactions loaded so far, while older ones exist */
export function historyChipNoneLoaded(chipLabel: string, loaded: number): string {
  return `No ${chipLabel} transactions in the last ${loaded}`;
}
/** A chip with no match at the end of history */
export function historyChipNone(chipLabel: string): string {
  return `No ${chipLabel} transactions yet`;
}
export const HISTORY_LOAD_OLDER = 'Load older';
/** The list footer of a wallet with more token accounts than the history reads (spec §3.2, §9) */
export function historyCoverage(read: number, total: number): string {
  return `History from ${read} of ${total} token accounts`;
}

export const SECTION_TODAY = 'Today';
export const SECTION_YESTERDAY = 'Yesterday';
export const SECTION_THIS_WEEK = 'This week';
export const SECTION_THIS_MONTH = 'This month';
export const SECTION_DATE_UNKNOWN = 'Date unknown';
export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** #27: the list shown in place of From / To when the transfer and the row do not agree (§4.6) */
export const TX_BALANCE_CHANGES = 'Balance changes';
export const TX_ROLE_MARKUP = 'Noctura fee';
export const TX_ROLE_GRANT = 'gas grant';
export const TX_ROLE_RENT = 'account rent';
/** #27 under the hero (H7): the price is today's, never the transaction day's. `usd` carries its "$" ("$0.15", "<$0.01"). */
export function txAtTodaysPrice(usd: string): string {
  return `≈ ${usd} at today's price`;
}
```

- [ ] **Step 4: Create `src/modules/solana/activityView.ts`:**

```ts
/**
 * History spec (2026-11-26) §5: what a history row SAYS — pure, so every form is tested without a
 * screen. The words are `src/copy/transactions.ts`; this file only puts them together.
 *
 * TIME (§5.3): calendar days are in the device's zone, passed in as an IANA name (never a fixed
 * offset: old dates across a DST change must fall on the right day). `now` is passed in too. No
 * `toLocaleString`: the parts come from `Intl.DateTimeFormat.formatToParts` and the month names
 * from the copy file, so the output does not depend on the engine's locale data.
 */
import {formatBalanceForDisplay, formatTokenAmount} from '../../utils/parseTokenAmount';
import {shortAccountAddress} from '../accounts/accountList';
import type {AccountList} from '../accounts/accountList';
import type {ActivityRow, Delta} from './activity';
import type {TxTransfer} from './txDetail';
import type {HistoryRow} from './history';
import {
  MONTH_NAMES,
  MONTH_SHORT,
  SECTION_DATE_UNKNOWN,
  SECTION_THIS_MONTH,
  SECTION_THIS_WEEK,
  SECTION_TODAY,
  SECTION_YESTERDAY,
  TX_ACCOUNT_SETUP,
  TX_AMOUNT_UNKNOWN,
  TX_FAILED,
  TX_INCOMPLETE,
  TX_MADE_PRIVATE,
  TX_MADE_PUBLIC,
  TX_NEUTRAL,
  TX_NO_FUNDS_MOVED,
  TX_RECEIVED,
  TX_ROLE_GRANT,
  TX_ROLE_MARKUP,
  TX_ROLE_RENT,
  TX_SENT,
  TX_SWAPPED,
  TX_UNWRAPPED_SOL,
  TX_VIA_JUPITER,
  TX_WRAPPED_SOL,
  txFeeLine,
  txFrom,
  txMadePrivateTitle,
  txMadePublicTitle,
  txMoreAssets,
  txReceivedTitle,
  txSentTitle,
  txSwapTitle,
  txTo,
} from '../../copy/transactions';
import type {HistoryChipId} from '../../copy/transactions';

export type RowIcon = 'sent' | 'received' | 'swap' | 'private' | 'setup' | 'failed' | 'dot';

export interface RowView {
  icon: RowIcon;
  title: string;
  /** the private-mode badge beside the title (the two pool rows) */
  badge: boolean;
  /** "to {cp} · {time}" — may be '' when neither is known */
  secondary: string;
  /** the figure with its sign, "—", or "No funds moved" */
  amount: string;
  amountTone: 'default' | 'success' | 'tertiary';
  /** tertiary text after the amount (" · incomplete"); null when there is none */
  note: string | null;
  /** the line under the amount: a swap's incoming leg, a failed row's fee; null when there is none */
  sub: string | null;
}

const MINUS = '−'; // U+2212, as the design draws it
const DAY_MS = 86_400_000;

interface ZonedDate {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hour: number;
  minute: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

/** The calendar date and wall-clock time of `ms` in the IANA zone `tz`; the device's own zone if `tz` is not usable. */
export function zonedDate(ms: number, tz: string): ZonedDate {
  try {
    let f = formatters.get(tz);
    if (f === undefined) {
      f = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hourCycle: 'h23',
      });
      formatters.set(tz, f);
    }
    const parts = f.formatToParts(new Date(ms));
    const part = (type: string): number => Number(parts.find(p => p.type === type)?.value);
    const z = {year: part('year'), month: part('month'), day: part('day'), hour: part('hour') % 24, minute: part('minute')};
    if (Object.values(z).every(Number.isFinite)) {
      return z;
    }
  } catch {
    // an engine without this zone: fall through to the device's own clock
  }
  const d = new Date(ms);
  return {year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), minute: d.getMinutes()};
}

/** The device's IANA zone; 'UTC' when the engine does not say. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** A calendar date as a day count (days since 1970-01-01 of that calendar date) */
const dayNumber = (z: ZonedDate): number => Math.round(Date.UTC(z.year, z.month - 1, z.day) / DAY_MS);
/** Monday = 0 … Sunday = 6 (1970-01-01 was a Thursday) */
const weekday = (dayNo: number): number => (((dayNo + 3) % 7) + 7) % 7;

export interface Section {
  key: string;
  title: string;
}

/**
 * §5.3. `blockTime` is in seconds (chain), `now` in milliseconds. A week starts on Monday. A time in
 * the future (a device clock behind the chain) is Today.
 */
export function sectionOf(blockTime: number | null, now: number, tz: string): Section {
  if (blockTime === null) {
    return {key: 'unknown', title: SECTION_DATE_UNKNOWN};
  }
  const then = zonedDate(blockTime * 1000, tz);
  const today = zonedDate(now, tz);
  const thenDay = dayNumber(then);
  const todayDay = dayNumber(today);
  if (thenDay >= todayDay) {
    return {key: 'today', title: SECTION_TODAY};
  }
  if (thenDay === todayDay - 1) {
    return {key: 'yesterday', title: SECTION_YESTERDAY};
  }
  if (thenDay >= todayDay - weekday(todayDay)) {
    return {key: 'week', title: SECTION_THIS_WEEK};
  }
  if (then.year === today.year && then.month === today.month) {
    return {key: 'month', title: SECTION_THIS_MONTH};
  }
  return {key: `${then.year}-${String(then.month).padStart(2, '0')}`, title: `${MONTH_NAMES[then.month - 1]} ${then.year}`};
}

/** §5.1 {time}: "HH:mm" for Today and Yesterday, else "d MMM" ("6 May"); '' with no block time. */
export function rowTime(blockTime: number | null, now: number, tz: string): string {
  if (blockTime === null) {
    return '';
  }
  const section = sectionOf(blockTime, now, tz).key;
  const z = zonedDate(blockTime * 1000, tz);
  if (section === 'today' || section === 'yesterday') {
    return `${String(z.hour).padStart(2, '0')}:${String(z.minute).padStart(2, '0')}`;
  }
  return `${z.day} ${MONTH_SHORT[z.month - 1]}`;
}

/** Rows under their date sections, in the order given; "Date unknown" always last. */
export function groupSections(rows: readonly HistoryRow[], now: number, tz: string): Array<Section & {data: HistoryRow[]}> {
  const groups = new Map<string, Section & {data: HistoryRow[]}>();
  for (const row of rows) {
    const section = sectionOf(row.item.blockTime, now, tz);
    const have = groups.get(section.key);
    if (have) {
      have.data.push(row);
    } else {
      groups.set(section.key, {...section, data: [row]});
    }
  }
  const all = [...groups.values()];
  return [...all.filter(g => g.key !== 'unknown'), ...all.filter(g => g.key === 'unknown')];
}

/** §5.2 */
export function chipMatches(chip: HistoryChipId, row: HistoryRow): boolean {
  const kind = row.activity?.kind;
  switch (chip) {
    case 'all':
      return true;
    case 'sent':
      return kind === 'sent';
    case 'received':
      return kind === 'received';
    case 'swaps':
      return kind === 'swap';
    case 'private':
      return kind === 'made-private' || kind === 'made-public';
  }
}

/**
 * §4.5 "Shown as": a wallet of this seed by its label ("Account 2", "Account 1 (main)"); any other
 * wallet — and every wallet when the registry is unreadable — as first 6 … last 6.
 */
export function counterpartyLabel(list: AccountList | null, address: string): string {
  if (list !== null && !list.unreadable) {
    const own = list.accounts.find(a => a.address === address);
    if (own) {
      return own.isMain ? `${own.label} (main)` : own.label;
    }
  }
  return shortAccountAddress(address);
}

/** An unsigned figure with the shared formatter ("<0.0001" applies); the sign is added outside it. */
export function unsignedAmount(d: Delta): string {
  const abs = d.raw < 0n ? -d.raw : d.raw;
  return formatBalanceForDisplay(abs.toString(), d.decimals);
}

function signedAmount(d: Delta): string {
  return `${d.raw < 0n ? MINUS : '+'}${unsignedAmount(d)}`;
}

const joined = (...parts: Array<string | null>): string => parts.filter(p => p !== null && p !== '').join(' · ');

/** §5.1: one row. `labelOf` names a counter-party (`counterpartyLabel`). */
export function rowView(row: HistoryRow, labelOf: (address: string) => string, now: number, tz: string): RowView {
  const time = rowTime(row.item.blockTime, now, tz);
  const a = row.activity;
  const plain: RowView = {icon: 'dot', title: TX_NEUTRAL, badge: false, secondary: time, amount: TX_AMOUNT_UNKNOWN, amountTone: 'default', note: null, sub: null};
  if (a === null) {
    return plain; // partial (§3.4): never a Sent
  }
  const p = a.primary;
  const more = a.extraAssets > 0 ? txMoreAssets(a.extraAssets) : '';
  const figure = p === null ? TX_AMOUNT_UNKNOWN : `${signedAmount(p)}${more}`;
  const tone: RowView['amountTone'] = p !== null && p.raw > 0n ? 'success' : 'default';
  const note = a.incomplete && p !== null ? ` · ${TX_INCOMPLETE}` : null;
  const cp = a.counterparty === null ? null : labelOf(a.counterparty);
  switch (a.kind) {
    case 'sent':
      return {...plain, icon: 'sent', title: txSentTitle(p?.symbol ?? ''), secondary: joined(cp === null ? null : txTo(cp), time), amount: figure, amountTone: tone, note};
    case 'received':
      return {...plain, icon: 'received', title: txReceivedTitle(p?.symbol ?? ''), secondary: joined(cp === null ? null : txFrom(cp), time), amount: figure, amountTone: tone, note};
    case 'swap': {
      const s = a.secondary;
      return {
        ...plain,
        icon: 'swap',
        title: txSwapTitle(p?.symbol ?? '', s?.symbol ?? ''),
        secondary: joined(a.via === 'Jupiter' ? TX_VIA_JUPITER : null, time),
        amount: figure,
        note,
        sub: s === null ? null : `${signedAmount(s)} ${s.symbol}`,
      };
    }
    case 'made-private':
      return {...plain, icon: 'private', badge: true, title: txMadePrivateTitle(p?.symbol ?? null), amount: figure, amountTone: tone};
    case 'made-public':
      return {...plain, icon: 'private', badge: true, title: txMadePublicTitle(p?.symbol ?? null), amount: figure, amountTone: tone};
    case 'wrap':
      return {...plain, icon: 'swap', title: TX_WRAPPED_SOL, amount: figure, amountTone: tone};
    case 'unwrap':
      return {...plain, icon: 'swap', title: TX_UNWRAPPED_SOL, amount: figure, amountTone: tone};
    case 'account-setup':
      return {...plain, icon: 'setup', secondary: joined(TX_ACCOUNT_SETUP, time), amount: p === null ? TX_AMOUNT_UNKNOWN : `${signedAmount(p)} ${p.symbol}`, amountTone: tone};
    case 'failed':
      return {
        ...plain,
        icon: 'failed',
        title: TX_FAILED,
        sub: a.feePaidByAccount === null ? null : txFeeLine(formatTokenAmount(a.feePaidByAccount, 9)),
      };
    case 'no-funds-moved':
      return {...plain, amount: TX_NO_FUNDS_MOVED, amountTone: 'tertiary'};
    case 'unknown':
      return plain;
  }
}

// ── #27 (§4.6) ───────────────────────────────────────────────────────────────────────────────────────

/** The eyebrow and the Type row: what the transaction was for the account it was opened from. */
export function activityWord(row: ActivityRow | null): string {
  switch (row?.kind) {
    case 'sent':
      return TX_SENT;
    case 'received':
      return TX_RECEIVED;
    case 'swap':
      return TX_SWAPPED;
    case 'made-private':
      return TX_MADE_PRIVATE;
    case 'made-public':
      return TX_MADE_PUBLIC;
    case 'wrap':
      return TX_WRAPPED_SOL;
    case 'unwrap':
      return TX_UNWRAPPED_SOL;
    case 'failed':
      return TX_FAILED;
    default:
      return TX_NEUTRAL; // account setup, no funds moved, unknown, and no account (a deep link)
  }
}

/** An unsigned, EXACT figure (the detail shows every digit; the rows use the shared 4-place formatter). */
export function exactAmount(d: Delta): string {
  return formatTokenAmount(d.raw < 0n ? -d.raw : d.raw, d.decimals);
}

/** The hero: `primary` without a sign, with its symbol; a swap as "{out} {sym} → {in} {sym}"; null = no amount line. */
export function heroAmount(row: ActivityRow | null): string | null {
  const p = row?.primary ?? null;
  if (row === null || p === null) {
    return null;
  }
  const out = `${exactAmount(p)} ${p.symbol}`;
  return row.secondary === null ? out : `${out} → ${exactAmount(row.secondary)} ${row.secondary.symbol}`;
}

/**
 * §4.6: From / To / Authorized by are shown only when the transfer the parser read IS the row — the
 * same asset, this account on the right side of it, the row's counter-party on the other, and a
 * recipient WALLET. Anything else (a swap, a pool move, two recipients, a null sender) shows the fee
 * payer and the balance changes instead: two readings that disagree are never both shown.
 */
export function partiesAgree(transfer: TxTransfer | null, row: ActivityRow | null, account: string | null): boolean {
  if (transfer === null || row === null || account === null || row.primary === null || row.counterparty === null) {
    return false;
  }
  if (transfer.mint !== row.primary.mint || transfer.toIsTokenAccount) {
    return false;
  }
  if (row.kind === 'sent') {
    return transfer.from === account && transfer.to === row.counterparty;
  }
  if (row.kind === 'received') {
    return transfer.to === account && transfer.from === row.counterparty;
  }
  return false;
}

const ROLE_LABEL: Record<Delta['role'], string | null> = {moved: null, markup: TX_ROLE_MARKUP, grant: TX_ROLE_GRANT, rent: TX_ROLE_RENT};

/** One line of "Balance changes": "−0.0001 TEST", "−0.00204 SOL · account rent". */
export function changeLine(d: Delta): string {
  return joined(`${d.raw < 0n ? MINUS : '+'}${exactAmount(d)} ${d.symbol}`, ROLE_LABEL[d.role]);
}

/** H7: today's value of `primary`, for the "≈ $x at today's price" line; null with no price. Display float. */
export function primaryUsdToday(row: ActivityRow | null, usdOf: (mint: string) => number | null): number | null {
  const p = row?.primary ?? null;
  if (p === null) {
    return null;
  }
  const usd = usdOf(p.mint);
  if (usd === null || !Number.isFinite(usd) || usd <= 0) {
    return null;
  }
  const abs = p.raw < 0n ? -p.raw : p.raw;
  return (Number(abs) / Math.pow(10, p.decimals)) * usd;
}
```

- [ ] **Step 5: Pin the time zone.** Create `jest.globalSetup.js` in the repository root:

```js
/**
 * History spec §5.3: the test run's time zone is pinned, so no test depends on the machine it runs on
 * (CI is UTC; a developer's laptop is not). Set before the workers start: they inherit it.
 */
module.exports = async () => {
  process.env.TZ = 'UTC';
};
```

      and register it in `jest.config.js`:

**The edit — `jest.config.js`. Find:**

```js
module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
```

**Replace with:**

```js
module.exports = {
  preset: 'react-native',
  // history spec §5.3: TZ=UTC for every test (see jest.globalSetup.js)
  globalSetup: '<rootDir>/jest.globalSetup.js',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
```

- [ ] **Step 6: Run them, under three zones.**

```bash
TZ=America/New_York npx jest src/modules/solana/__tests__/timezone.test.ts src/modules/solana/__tests__/activityView.test.ts --forceExit
TZ=Asia/Tokyo npx jest src/modules/solana/__tests__/timezone.test.ts src/modules/solana/__tests__/activityView.test.ts --runInBand --forceExit
/usr/bin/node node_modules/.bin/jest src/modules/solana/__tests__/timezone.test.ts src/modules/solana/__tests__/activityView.test.ts --forceExit
```

      Expected: PASS each time (1 + 28 tests).

- [ ] **Step 7: The copy guards.** `npx jest src/copy src/screens/shielded/__tests__/privacyClaims.test.ts --forceExit`
      Expected: PASS, with both test files unchanged (`git diff --stat src/copy/__tests__ src/screens/shielded/__tests__`
      prints nothing).

- [ ] **Step 8: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then the full suite once on
      Node 22, because the zone pin touches every test: `/usr/bin/node node_modules/.bin/jest --forceExit`.

- [ ] **Step 9: Commit.**

```bash
git add src/copy/transactions.ts src/modules/solana/activityView.ts jest.globalSetup.js jest.config.js \
  src/modules/solana/__tests__/activityView.test.ts src/modules/solana/__tests__/timezone.test.ts
git commit -m "feat(history): the words and the pure view of a history row; sections by IANA zone; tests run in UTC"
```

---

### Task 6: The history query — the hook, and the cache rules in `queryClient.ts`

Spec: §3.2 (when a session is dropped), §3.3 (the cache, the query key, `staleTime` 60 s, invalidation), §3.4
(identity: every key holds the cluster and the address), §8 "History reading" (account switch; the cache);
Review Focus 3.

**Files:**
- Create: `src/hooks/useActivityHistory.ts`
- Modify: `src/app/queryClient.ts` (whole file)
- Test: `src/hooks/__tests__/useActivityHistory.test.tsx` (new), `src/app/__tests__/queryClient.test.ts` (whole file)

**Interfaces:**
- Consumes (Task 3): `HISTORY_PAGE_SIZE`, `historySession`, `peekHistorySession`, `dropHistorySessions`,
  `dropHistorySessionsExcept` from `src/modules/solana/historySession`.
- Consumes (Task 4): `loadHistory(account, step: 'head' | 'older', env)`, `HistorySnapshot`, `HistoryEnv` from
  `src/modules/solana/history`; `activityContext` from `src/modules/solana/activityContext`;
  `PARSED_TX_KEY`, `PARSED_TX_GC_MS`, `applyParsedTxDefaults`, `parsedTxKey` from `src/modules/solana/historyReads`.
- Consumes (existing): `NETWORK` (`src/constants/programs`), `getConnection` (`src/modules/solana/connection`),
  `onSecureMmkvReset` (`src/store/mmkv/instances`; fired by a wipe AND by every `initSecureMmkv`).
- Produces, from `src/hooks/useActivityHistory.ts`:
  - `export const HISTORY_STALE_MS = 60_000`
  - `export const historyQueryKey: (account: string | null) => readonly [string, string | null, string, number]`
    — `['txHistory', account, NETWORK, 20]`
  - `export interface ActivityHistory {data: HistorySnapshot | undefined; isSuccess: boolean; isError: boolean; refetch: () => Promise<unknown>; loadOlder: () => Promise<HistorySnapshot | null>; loadingOlder: boolean}`
  - `export function useActivityHistory(account: string | null): ActivityHistory`
- Produces, from `src/app/queryClient.ts`:
  - `ACCOUNT_QUERY_KEYS` now `['accountSnapshot', 'txHistory', 'parsedTx']`
  - `export function dropHistorySessionOnInvalidate(client?: QueryClient): () => void`
  - the app's `queryClient` has the `parsedTx` defaults applied.

**Why:**
- #21 already invalidates `['txHistory', address]` after a confirmed Send
  (`TransactionStatusScreen.tsx:132`). The new key keeps that prefix, so that call keeps matching — and the session
  behind the entry must go with it, or the next read would continue a session that does not know the new
  transaction's source list. The query cache is watched for `invalidate` actions for that.
- A session and its cache entry are only ever dropped **together**. If a session were dropped while its cached rows
  stayed, "Load older" would append a fresh session's first page under them. So the account-switch effect removes
  both, and a page that arrives for the account that was selected a moment ago is discarded (Review Focus 3).
- `onSecureMmkvReset` already clears `accountSnapshot` and `txHistory`. Raw transactions (kept 24 h) and sessions
  belong to the wallet that is gone too.
- The existing `queryClient.test.ts` is kept: its two tests are the first two of the new file, unchanged.

- [ ] **Step 1: Write the failing tests.** Replace the whole of `src/app/__tests__/queryClient.test.ts` with:

```ts
/** M1d review M4: a wipe or an import drops the old wallet's per-account query entries from memory. */
import {clearAllStores, initSecureMmkv} from '../../store/mmkv/instances';
import {queryClient} from '../queryClient';
import {PARSED_TX_GC_MS, parsedTxKey} from '../../modules/solana/historyReads';
import {dropHistorySessions, historySession, peekHistorySession} from '../../modules/solana/historySession';

const A = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const B = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const deps = {listSources: async () => ({sources: [], tokenAccountsTotal: 0}), fetchSignatures: async () => []};

beforeEach(() => {
  queryClient.clear();
  dropHistorySessions();
  queryClient.setQueryData(['accountSnapshot', A], {solBalance: '1'});
  queryClient.setQueryData(['txHistory', A, undefined], []);
  queryClient.setQueryData(['prices'], {keep: true});
  // history spec §3.3: a raw transaction of the old wallet, and its history session
  queryClient.setQueryData(parsedTxKey('devnet', 'SIG'), {slot: 1});
  historySession('devnet', A, deps);
});
afterAll(() => {
  queryClient.clear();
  dropHistorySessions();
});

it('wipe (clearAllStores) removes accountSnapshot and txHistory entries, not unrelated ones', () => {
  clearAllStores();
  expect(queryClient.getQueryData(['accountSnapshot', A])).toBeUndefined();
  expect(queryClient.getQueryData(['txHistory', A, undefined])).toBeUndefined();
  expect(queryClient.getQueryData(['prices'])).toEqual({keep: true});
});

it('import (initSecureMmkv) removes them too', () => {
  initSecureMmkv('the-next-wallet');
  expect(queryClient.getQueryData(['accountSnapshot', A])).toBeUndefined();
  expect(queryClient.getQueryData(['txHistory', A, undefined])).toBeUndefined();
});

// history spec §3.3
it('a wipe and an import also clear every parsedTx entry and every history session', () => {
  clearAllStores();
  expect(queryClient.getQueryData(parsedTxKey('devnet', 'SIG'))).toBeUndefined();
  expect(peekHistorySession('devnet', A)).toBeUndefined();
  queryClient.setQueryData(parsedTxKey('devnet', 'SIG'), {slot: 1});
  historySession('devnet', A, deps);
  initSecureMmkv('the-next-wallet');
  expect(queryClient.getQueryData(parsedTxKey('devnet', 'SIG'))).toBeUndefined();
  expect(peekHistorySession('devnet', A)).toBeUndefined();
});

// history spec §3.3: the client default of 5 min would collect them
it('parsedTx entries of the app client never go stale and are kept for 24 h', () => {
  const query = queryClient.getQueryCache().find({queryKey: parsedTxKey('devnet', 'SIG')})!;
  expect(query.gcTime).toBe(PARSED_TX_GC_MS);
  expect(PARSED_TX_GC_MS).toBe(24 * 60 * 60 * 1000);
  expect(query.isStale()).toBe(false);
  // every other entry keeps the client default
  expect(queryClient.getQueryCache().find({queryKey: ['prices']})!.gcTime).toBe(5 * 60_000);
});

// history spec §3.3: #21 invalidates ['txHistory', address] (TransactionStatusScreen) — the prefix must keep matching
it("invalidating ['txHistory', address] drops that account's history session, and no other", async () => {
  queryClient.setQueryData(['txHistory', A, 'devnet', 20], {rows: []});
  historySession('devnet', B, deps);
  await queryClient.invalidateQueries({queryKey: ['txHistory', A]});
  expect(peekHistorySession('devnet', A)).toBeUndefined();
  expect(peekHistorySession('devnet', B)).toBeDefined();
  expect(queryClient.getQueryState(['txHistory', A, 'devnet', 20])!.isInvalidated).toBe(true);
});
```

      Create `src/hooks/__tests__/useActivityHistory.test.tsx`:

```tsx
/**
 * History spec §3.3, §3.4: the hook — the query key, the account switch, "load older", and the
 * session dropped by #21's invalidation. `loadHistory` is scripted; real timers only (no fake timers
 * with async act — that hung CI in PR 1).
 */
import React from 'react';
import {renderHook, waitFor, act} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useActivityHistory, historyQueryKey} from '../useActivityHistory';
import {dropHistorySessionOnInvalidate} from '../../app/queryClient';
import {dropHistorySessions, historySession, peekHistorySession} from '../../modules/solana/historySession';
import type {HistorySnapshot} from '../../modules/solana/history';

const mockLoad = jest.fn();
jest.mock('../../modules/solana/history', () => ({loadHistory: (...args: unknown[]) => mockLoad(...args)}));
jest.mock('../../modules/solana/connection', () => ({getConnection: () => ({})}));

const A = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const B = 'AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR';
const snap = (signatures: string[], endReached = false): HistorySnapshot => ({
  sessionId: 1,
  rows: signatures.map((signature, k) => ({item: {signature, slot: 100 - k, blockTime: 1, status: 'finalized' as const, finalized: true}, activity: null})),
  endReached,
  coverage: {read: 0, total: 0},
});
const deps = {listSources: async () => ({sources: [], tokenAccountsTotal: 0}), fetchSignatures: async () => []};

let client: QueryClient;
const wrapper = ({children}: {children: React.ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;

beforeEach(() => {
  mockLoad.mockReset();
  dropHistorySessions();
  client = new QueryClient({defaultOptions: {queries: {retry: false}}});
});
afterEach(() => {
  client.clear();
});

// K1
it('the key keeps the txHistory prefix and holds the address, the cluster and the page size', () => {
  expect(historyQueryKey(A)).toEqual(['txHistory', A, 'mainnet-beta', 20]); // the jest Config mock's NETWORK
});

// K2
it('reads the head for the account and exposes the snapshot', async () => {
  mockLoad.mockResolvedValue(snap(['s1', 's2']));
  const {result} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(mockLoad).toHaveBeenCalledWith(A, 'head', expect.objectContaining({cluster: 'mainnet-beta', client}));
  expect(result.current.data!.rows.map(r => r.item.signature)).toEqual(['s1', 's2']);
});

// K3
it('no account: nothing is read', () => {
  const {result} = renderHook(() => useActivityHistory(null), {wrapper});
  expect(mockLoad).not.toHaveBeenCalled();
  expect(result.current.data).toBeUndefined();
  expect(result.current.isSuccess).toBe(false);
});

// K4 (§3.4)
it("an account switch never shows the old account's rows, and drops its session and its cache entry", async () => {
  mockLoad.mockImplementation(async (account: string) => snap(account === A ? ['a1'] : ['b1']));
  historySession('mainnet-beta', A, deps);
  const {result, rerender} = renderHook(({account}: {account: string}) => useActivityHistory(account), {wrapper, initialProps: {account: A}});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(result.current.data!.rows[0]!.item.signature).toBe('a1');
  rerender({account: B});
  expect(result.current.data).toBeUndefined(); // at once: never A's rows under B
  await waitFor(() => expect(result.current.data?.rows[0]?.item.signature).toBe('b1'));
  expect(peekHistorySession('mainnet-beta', A)).toBeUndefined();
  expect(client.getQueryData(historyQueryKey(A))).toBeUndefined();
});

// K5
it('loadOlder asks for the next page, replaces the snapshot, and is single-flight', async () => {
  mockLoad.mockResolvedValueOnce(snap(['s1']));
  const {result} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  let release: (s: HistorySnapshot) => void = () => undefined;
  mockLoad.mockImplementationOnce(() => new Promise<HistorySnapshot>(r => { release = r; }));
  let first: Promise<HistorySnapshot | null> = Promise.resolve(null);
  let second: Promise<HistorySnapshot | null> = Promise.resolve(null);
  act(() => {
    first = result.current.loadOlder();
    second = result.current.loadOlder();
  });
  await waitFor(() => expect(result.current.loadingOlder).toBe(true));
  expect(await second).toBeNull();
  await act(async () => {
    release(snap(['s1', 's2'], true));
    await first;
  });
  expect(mockLoad).toHaveBeenLastCalledWith(A, 'older', expect.anything());
  expect(mockLoad).toHaveBeenCalledTimes(2);
  expect(result.current.data!.rows).toHaveLength(2);
  expect(result.current.data!.endReached).toBe(true);
  expect(result.current.loadingOlder).toBe(false);
});

// K6
it('a failed loadOlder keeps the rows and resolves null', async () => {
  mockLoad.mockResolvedValueOnce(snap(['s1']));
  const {result} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  mockLoad.mockRejectedValueOnce(new Error('rpc down'));
  let got: HistorySnapshot | null = snap([]);
  await act(async () => {
    got = await result.current.loadOlder();
  });
  expect(got).toBeNull();
  expect(result.current.data!.rows).toHaveLength(1);
  expect(result.current.isError).toBe(false);
});

// K8 (Review Focus 3)
it('an older page that arrives after the account changed is dropped: never written into either list', async () => {
  mockLoad.mockImplementation(async (account: string) => snap(account === A ? ['a1'] : ['b1']));
  const {result, rerender} = renderHook(({account}: {account: string}) => useActivityHistory(account), {wrapper, initialProps: {account: A}});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  let release: (s: HistorySnapshot) => void = () => undefined;
  mockLoad.mockImplementationOnce(() => new Promise<HistorySnapshot>(r => { release = r; }));
  let older: Promise<HistorySnapshot | null> = Promise.resolve(null);
  act(() => {
    older = result.current.loadOlder(); // for A
  });
  rerender({account: B});
  await waitFor(() => expect(result.current.data?.rows[0]?.item.signature).toBe('b1'));
  await act(async () => {
    release(snap(['a1', 'a2']));
    expect(await older).toBeNull();
  });
  expect(result.current.data!.rows.map(r => r.item.signature)).toEqual(['b1']);
  expect(client.getQueryData(historyQueryKey(A))).toBeUndefined(); // A's entry is not brought back
});

// K7 (§3.3)
it("#21's invalidation of ['txHistory', address] drops that account's session, and only that one", async () => {
  const off = dropHistorySessionOnInvalidate(client);
  mockLoad.mockResolvedValue(snap(['s1']));
  const {result, unmount} = renderHook(() => useActivityHistory(A), {wrapper});
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  unmount();
  historySession('mainnet-beta', A, deps);
  historySession('mainnet-beta', B, deps);
  await act(async () => {
    await client.invalidateQueries({queryKey: ['txHistory', A]});
  });
  expect(peekHistorySession('mainnet-beta', A)).toBeUndefined();
  expect(peekHistorySession('mainnet-beta', B)).toBeDefined();
  off();
});
```

- [ ] **Step 2: Run them.**
      `npx jest src/app/__tests__/queryClient.test.ts src/hooks/__tests__/useActivityHistory.test.tsx --forceExit`
      Expected: FAIL — `Cannot find module '../useActivityHistory'`; in `queryClient.test.ts` the three new tests
      fail (a `parsedTx` entry survives the wipe; its `gcTime` is 300000; the session survives the invalidation) and
      the first two pass (they are PR 1's — pins).

- [ ] **Step 3: Replace the whole of `src/app/queryClient.ts` with:**

```ts
/**
 * The app's one TanStack QueryClient (was local to AppProviders). Exported so that code outside React
 * (the wipe/import reset hook below, #21's post-send refresh) can reach the cache.
 *
 * M1d review M4: the per-account entries (`accountSnapshot`, `txHistory`, keyed by address; since the history
 * work also `parsedTx` and the history sessions) are dropped
 * whenever the encrypted store is replaced — a wipe (`clearAllStores`) or an import (`initSecureMmkv`) —
 * so the old wallet's balances and history do not outlive it in memory. They were never shown to the new
 * wallet (the keys are addresses); this just stops them lingering for up to `gcTime`.
 */
import {QueryClient} from '@tanstack/react-query';
import {onSecureMmkvReset} from '../store/mmkv/instances';
import {PARSED_TX_KEY, applyParsedTxDefaults} from '../modules/solana/historyReads';
import {dropHistorySessions} from '../modules/solana/historySession';

/** `parsedTx` (history spec §3.3): raw transactions, kept 24 h — the old wallet's must not outlive it either */
export const ACCOUNT_QUERY_KEYS = ['accountSnapshot', 'txHistory', PARSED_TX_KEY] as const;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 10_000,
      gcTime: 5 * 60_000,
    },
  },
});
applyParsedTxDefaults(queryClient);

export function clearAccountQueries(client: QueryClient = queryClient): void {
  for (const key of ACCOUNT_QUERY_KEYS) {
    client.removeQueries({queryKey: [key]});
  }
}

/**
 * History spec §3.3: an invalidation of `['txHistory', address]` (#21 after a confirmed Send) also
 * drops that account's history session, so the next read starts from the head instead of continuing
 * a session that does not know the new transaction. Returns the unsubscribe.
 */
export function dropHistorySessionOnInvalidate(client: QueryClient = queryClient): () => void {
  return client.getQueryCache().subscribe(event => {
    if (event.type !== 'updated' || event.action.type !== 'invalidate') {
      return;
    }
    const [name, address] = event.query.queryKey as readonly unknown[];
    if (name === 'txHistory' && typeof address === 'string') {
      dropHistorySessions(address);
    }
  });
}
dropHistorySessionOnInvalidate();

onSecureMmkvReset(() => {
  clearAccountQueries();
  dropHistorySessions(); // every session belongs to the wallet that is gone
});
```

- [ ] **Step 4: Create `src/hooks/useActivityHistory.ts`:**

```ts
/**
 * History spec (2026-11-26) §3.3, §3.4: the selected account's history for #26.
 *
 * THE KEY keeps the prefix #21 invalidates (`['txHistory', address]`,
 * TransactionStatusScreen.tsx) and holds the cluster and the address, so another account's or
 * another network's rows are never shown. The query's own fetch — on mount once it is stale, on
 * pull-to-refresh, after an invalidation — is `loadHistory(…, 'head')`: the first page, or the
 * refresh that puts new rows on top. Its `staleTime` is 60 s because a refresh can cost up to 25
 * signature calls. "Load older" asks the session for the next page and writes the answer into the
 * same cache entry.
 *
 * AN ACCOUNT SWITCH drops every other account's session together with its cache entry: the two
 * are only ever dropped together, so cached rows are never continued by a session that started over.
 */
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {NETWORK} from '../constants/programs';
import {getConnection} from '../modules/solana/connection';
import {activityContext} from '../modules/solana/activityContext';
import {loadHistory} from '../modules/solana/history';
import type {HistorySnapshot} from '../modules/solana/history';
import {HISTORY_PAGE_SIZE, dropHistorySessionsExcept} from '../modules/solana/historySession';

export const HISTORY_STALE_MS = 60_000;

export const historyQueryKey = (account: string | null): readonly [string, string | null, string, number] => ['txHistory', account, NETWORK, HISTORY_PAGE_SIZE];

export interface ActivityHistory {
  data: HistorySnapshot | undefined;
  /** a first read completed (the list may be empty) */
  isSuccess: boolean;
  /** the last read failed; `data` keeps what was read before */
  isError: boolean;
  /** the first page, or the refresh once a page is loaded */
  refetch: () => Promise<unknown>;
  /** the next page; resolves to the new snapshot, or null when it could not be read or nothing was started */
  loadOlder: () => Promise<HistorySnapshot | null>;
  loadingOlder: boolean;
}

export function useActivityHistory(account: string | null): ActivityHistory {
  const client = useQueryClient();
  const queryKey = useMemo(() => historyQueryKey(account), [account]);
  const env = useCallback(() => ({connection: getConnection(), client, cluster: NETWORK, context: activityContext}), [client]);

  useEffect(() => {
    dropHistorySessionsExcept(account);
    client.removeQueries({predicate: q => q.queryKey[0] === 'txHistory' && q.queryKey[1] !== account});
  }, [account, client]);

  const query = useQuery<HistorySnapshot>({
    queryKey,
    queryFn: () => {
      if (account === null) {
        throw new Error('No account');
      }
      return loadHistory(account, 'head', env());
    },
    enabled: account !== null,
    staleTime: HISTORY_STALE_MS,
  });

  const olderRef = useRef(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const accountRef = useRef(account);
  accountRef.current = account;
  const loadOlder = useCallback(async (): Promise<HistorySnapshot | null> => {
    if (account === null || olderRef.current) {
      return null;
    }
    olderRef.current = true;
    setLoadingOlder(true);
    try {
      const snapshot = await loadHistory(account, 'older', env());
      if (accountRef.current !== account) {
        return null; // the account changed while the page was read: it is not this list's page
      }
      client.setQueryData(queryKey, snapshot);
      return snapshot;
    } catch {
      return null; // the rows already loaded stay; "Load older" can be tapped again
    } finally {
      olderRef.current = false;
      setLoadingOlder(false);
    }
  }, [account, client, env, queryKey]);

  return {
    data: query.data,
    isSuccess: query.isSuccess,
    isError: query.isError,
    refetch: query.refetch,
    loadOlder,
    loadingOlder,
  };
}
```

- [ ] **Step 5: Run them.** The Step 2 command. Expected: PASS
      (5 + 8 tests). Jest may print "A worker process has failed to exit
      gracefully" for the hook suite with `--forceExit`; that line is not a failure. Then the one screen that
      invalidates the key: `npx jest src/screens/transparent/__tests__/TransactionStatusScreen.test.tsx --forceExit`
      Expected: PASS, unchanged.

- [ ] **Step 6: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/app src/hooks/__tests__/useActivityHistory.test.tsx --forceExit`
      (the hook test uses `waitFor` and async `act` with REAL timers only — do not add fake timers to it).

- [ ] **Step 7: Commit.**

```bash
git add src/app/queryClient.ts src/app/__tests__/queryClient.test.ts \
  src/hooks/useActivityHistory.ts src/hooks/__tests__/useActivityHistory.test.tsx
git commit -m "feat(history): useActivityHistory; parsedTx kept 24 h; a txHistory invalidation and a wipe drop the session"
```

---

### Task 7: #26 — the history screen

Spec: §5 (all of it), §3.2 (the footer of a wallet with more than 24 token accounts), §3.4 ("No transactions yet"),
§8 "Screen", §11 (what is changed or deferred from the design); Review Focus 3, 4 and 5.

**Design (BINDING, read both before writing):** `/home/user/Downloads/index.html` — search `26a · cold-mount-skeleton`
(four states 26a–26d; the row CSS is `.tx-row` near line 3135) — and `/home/user/Downloads/screen.md` section
`26 · activity`. Do NOT edit those files (Task 12 does, with backups).

Every element of the design, and what this task does with it — nothing is dropped silently:

| Design element (#26) | This task |
|---|---|
| Chips All / Sent / Received / Swaps / "Shielded", 44 dp | built; the fifth reads **"Private"** (Task 5, ruling 1), mint-tinted when active |
| Date sections Today / Yesterday / This week | built, plus "This month", "{Month YYYY}", "Date unknown" (spec §5.3) |
| `TxRow`: 40 dp round icon, title, secondary line, amount with a line under it | built: `rowView` (Task 5) says what, this screen places it |
| the mode badge on pool rows | built ("Private", with a lock) |
| 5-row skeleton across 2 sections (26a) | built |
| Pull-to-refresh | built (the §3.4 refresh) |
| The account label under the title | kept (M1d) |
| USD under each amount | **NOT shown** (H7: only today's price is known) |
| OriginBadge "Wallet" / "Dapp · simulated" | **NOT shown** (spec §11: chain data does not say which app built a transaction) |
| "dApp signature" row | shown as "Transaction" · "No funds moved" (spec §11) |
| a failed row's reason ("slippage exceeded") | **NOT shown** (spec §11); "Failed", "—", and the fee only when this account paid it |
| Title "Activity", Search / More icons, the tab bar | **NOT built**: the screen keeps "Transaction History" with Back (spec §11: reached from the dashboard's History button; the Explore tab does not exist) |
| Counter-party as 4…4 | 6…6, or the account's label for a wallet of this seed |
| Empty list → #41 empty-activity | the existing "No transactions yet" line (spec §11: #41 is not built) |

**Files:**
- Modify: `src/screens/transparent/TransactionHistoryScreen.tsx` (whole file)
- Modify: `src/hooks/useSolanaQueries.ts:42-63` (remove `useTransactionHistory`)
- Test: `src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx` (whole file)

**Interfaces:**
- Consumes (Task 6): `useActivityHistory(account: string | null): {data: HistorySnapshot | undefined; isSuccess: boolean; isError: boolean; refetch: () => Promise<unknown>; loadOlder: () => Promise<HistorySnapshot | null>; loadingOlder: boolean}`
  from `src/hooks/useActivityHistory`.
- Consumes (Task 5): `rowView`, `groupSections`, `chipMatches`, `counterpartyLabel`, `deviceTimeZone`, `RowIcon`,
  `RowView` from `src/modules/solana/activityView`; `HISTORY_CHIPS`, `HistoryChipId`, `HISTORY_LOAD_OLDER`,
  `SECTION_TODAY`, `SECTION_YESTERDAY`, `TX_PRIVATE_BADGE`, `historyChipNone`, `historyChipNoneLoaded`,
  `historyCoverage` from `src/copy/transactions`.
- Consumes (Tasks 3, 4): `HISTORY_PAGE_SIZE` (20); `HistoryRow`, `HistorySnapshot`.
- Consumes (existing): `useSelectedAccount()` and `useAccountList()` from `src/hooks/useSelectedAccount`;
  `HISTORY_EMPTY` ('No transactions yet'), `HISTORY_ERROR` ("Couldn't load transactions · tap to retry"),
  `HISTORY_LOADING` ('Loading transactions…') from `src/copy/accounts`; `Text` from `src/components/ui`
  (props `variant`, `numeral`, `className`); `cn` from `src/utils/cn`.
- Produces: `TransactionHistoryScreen({onSelectTx, onBack, now?, timeZone?})` — `onSelectTx(signature, account)` and
  `onBack` exactly as today (`src/app/Navigator.tsx` passes them and is not changed); `now` (ms) and `timeZone` (IANA)
  are for tests. Test ids: `history-list`, `history-chip-{id}`, `history-section-{key}`, `tx-row-{signature}` and
  its `-icon-{icon}`, `-title`, `-secondary`, `-amount`, `-sub`, `-badge`; `history-skeleton`,
  `history-skeleton-row`, `history-chip-empty`, `history-load-older`, `history-loading-older`, `history-coverage`,
  and the existing `history-retry`, `history-account-label`.

**Why (three things the code must keep true):**
- **PR 1's states stay:** with no account resolved the list area is empty; an error shows the retry line and never
  the empty state; one read in flight at a time (a ref guard, because two taps can land before a re-render); a retry
  started for one account neither blocks nor resets another account's (the generation counter).
- **"No transactions yet" needs three things at once:** a successful read, the end of history, zero rows.
- **An empty chip cannot be scrolled**, and a list shorter than the screen makes `onEndReached` fire again and
  again. So scrolling loads the next page only while fewer than 3 consecutive pages added nothing under the active
  chip; after that only the explicit "Load older" loads. The All chip never stops (every page adds rows).
- A `SectionList` renders 10 rows at first by default; a page is 20, so `initialNumToRender` is the page size.
- Styling is NativeWind classes only. **No inline `style={{…}}`** (each would add a lint warning and break the
  exact-143 gate) and no `StyleSheet` — the old screen's `StyleSheet` goes with it.

- [ ] **Step 1: Write the failing test.** Replace the whole of
      `src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx` with:

```tsx
/**
 * #26 (history spec 2026-11-26 §5, §8 "Screen"): the list against a scripted `useActivityHistory`.
 * What a row SAYS is pinned in activityView.test.ts; here: that the screen shows it, the chips, the
 * empty-chip line, "Load older" and the 3-page cap, the skeleton, and the states PR 1 fixed
 * (retry single-flight, no claim without a read). Real timers only.
 */
import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {TransactionHistoryScreen} from '../TransactionHistoryScreen';
import type {ActivityKind, ActivityRow, Delta} from '../../../modules/solana/activity';
import type {HistoryRow, HistorySnapshot} from '../../../modules/solana/history';

const ME = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const OUTSIDE = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
const LJ = 'Europe/Ljubljana';
const NOW = Date.parse('2026-11-26T11:00:00Z');
const at = (iso: string): number => Date.parse(iso) / 1000;

// M1d (spec §4.2): the history is the SELECTED account's
const mockHistSelected: {current: {address: string; label: string} | null} = {current: {address: ME, label: 'Account 1'}};
jest.mock('../../../hooks/useSelectedAccount', () => ({
  useSelectedAccount: () => mockHistSelected.current,
  useAccountList: () => ({
    accounts: [
      {scheme: 'slip10:0', address: 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B', label: 'Account 1', number: 1, role: 'main', isMain: true, linked: false},
      {scheme: 'slip10:1', address: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4', label: 'Account 2', number: 2, role: 'fresh-exit', isMain: false, linked: false},
    ],
    seed: [],
    walletKind: 'slip10',
    unreadable: false,
  }),
}));

const mockHistory: {
  data: HistorySnapshot | undefined;
  isSuccess: boolean;
  isError: boolean;
  refetch: jest.Mock;
  loadOlder: jest.Mock;
  loadingOlder: boolean;
} = {data: undefined, isSuccess: false, isError: false, refetch: jest.fn(), loadOlder: jest.fn(), loadingOlder: false};
const mockUseActivityHistory = jest.fn((_account: string | null) => mockHistory);
jest.mock('../../../hooks/useActivityHistory', () => ({useActivityHistory: (account: string | null) => mockUseActivityHistory(account)}));

const delta = (mint: string, symbol: string, raw: bigint, role: Delta['role'] = 'moved'): Delta => ({mint, symbol, raw, decimals: 9, role});
let n = 0;
function row(kind: ActivityKind | null, over: Partial<ActivityRow> = {}, blockTime: number | null = at('2026-11-26T08:14:00Z')): HistoryRow {
  n += 1;
  const signature = over.signature ?? `sig${n}`;
  const item = {signature, slot: 1000 - n, blockTime, status: kind === 'failed' ? ('failed' as const) : ('finalized' as const), finalized: true};
  if (kind === null) {
    return {item, activity: null};
  }
  return {
    item,
    activity: {
      signature, slot: item.slot, blockTime, status: item.status, kind, primary: null, secondary: null, extraAssets: 0, deltas: [],
      counterparty: null, via: null, feePaidByAccount: null, incomplete: false, ...over,
    },
  };
}
const snapshot = (rows: HistoryRow[], endReached = true, coverage = {read: 0, total: 0}): HistorySnapshot => ({sessionId: 1, rows, endReached, coverage});
function show(rows: HistoryRow[], endReached = true, coverage?: {read: number; total: number}): void {
  mockHistory.data = snapshot(rows, endReached, coverage);
  mockHistory.isSuccess = true;
}

const onSelectTx = jest.fn();
const onBack = jest.fn();
const screen = () => render(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} now={NOW} timeZone={LJ} />);

beforeEach(() => {
  jest.clearAllMocks();
  n = 0;
  mockHistSelected.current = {address: ME, label: 'Account 1'};
  mockHistory.data = undefined;
  mockHistory.isSuccess = false;
  mockHistory.isError = false;
  mockHistory.loadingOlder = false;
  mockHistory.refetch = jest.fn(() => Promise.resolve());
  mockHistory.loadOlder = jest.fn(() => Promise.resolve(null));
});

describe('rows (§5.1)', () => {
  // T1
  it('each row form: icon, title, secondary line, amount, the line under it', () => {
    show([
      row('sent', {signature: 'sent', primary: delta('M', 'TEST', -100000n), counterparty: OUTSIDE}),
      row('received', {signature: 'recv', primary: delta('native', 'SOL', 250_000_000n), counterparty: ACC_2}),
      row('swap', {signature: 'swap', primary: delta('native', 'SOL', -1_200_000_000n), secondary: delta('N', 'NOC', 9_524_100_000_000n), via: 'Jupiter'}),
      row('made-private', {signature: 'priv', primary: delta('M', 'TEST', -100000n)}),
      row('made-public', {signature: 'pub', primary: delta('M', 'TEST', 100000n)}),
      row('wrap', {signature: 'wrap', primary: delta('native', 'SOL', -2_000_000_000n)}),
      row('account-setup', {signature: 'setup', primary: delta('native', 'SOL', -1_488_440n, 'rent')}),
      row('failed', {signature: 'fail', feePaidByAccount: 5000n}),
      row('no-funds-moved', {signature: 'none'}),
      row('unknown', {signature: 'unk'}),
      row(null, {signature: 'partial'}),
    ]);
    const {getByTestId, queryByTestId} = screen();
    const text = (id: string) => getByTestId(id);

    expect(getByTestId('tx-row-sent-icon-sent')).toBeTruthy();
    expect(text('tx-row-sent-title')).toHaveTextContent('Sent TEST');
    expect(text('tx-row-sent-secondary')).toHaveTextContent('to EfHSPx…mwXGgk · 09:14'); // 6…6, never 4…4
    expect(text('tx-row-sent-amount')).toHaveTextContent('−0.0001');
    expect(queryByTestId('tx-row-sent-sub')).toBeNull(); // H7: no USD line on a row

    expect(getByTestId('tx-row-recv-icon-received')).toBeTruthy();
    expect(text('tx-row-recv-title')).toHaveTextContent('Received SOL');
    expect(text('tx-row-recv-secondary')).toHaveTextContent('from Account 2 · 09:14'); // a wallet of this seed by its label
    expect(text('tx-row-recv-amount')).toHaveTextContent('+0.25');

    expect(getByTestId('tx-row-swap-icon-swap')).toBeTruthy();
    expect(text('tx-row-swap-title')).toHaveTextContent('Swapped SOL → NOC');
    expect(text('tx-row-swap-secondary')).toHaveTextContent('via Jupiter · 09:14');
    expect(text('tx-row-swap-amount')).toHaveTextContent('−1.2');
    expect(text('tx-row-swap-sub')).toHaveTextContent('+9,524.1 NOC');

    expect(getByTestId('tx-row-priv-icon-private')).toBeTruthy();
    expect(text('tx-row-priv-title')).toHaveTextContent('Made private TEST');
    expect(getByTestId('tx-row-priv-badge')).toHaveTextContent('Private');
    expect(text('tx-row-pub-title')).toHaveTextContent('Made public TEST');
    expect(getByTestId('tx-row-pub-badge')).toBeTruthy();
    expect(queryByTestId('tx-row-sent-badge')).toBeNull();

    expect(text('tx-row-wrap-title')).toHaveTextContent('Wrapped SOL');
    expect(text('tx-row-wrap-amount')).toHaveTextContent('−2');

    expect(getByTestId('tx-row-setup-icon-setup')).toBeTruthy();
    expect(text('tx-row-setup-title')).toHaveTextContent('Transaction');
    expect(text('tx-row-setup-secondary')).toHaveTextContent('Account setup · 09:14');
    expect(text('tx-row-setup-amount')).toHaveTextContent('−0.0015 SOL');

    expect(getByTestId('tx-row-fail-icon-failed')).toBeTruthy();
    expect(text('tx-row-fail-title')).toHaveTextContent('Failed');
    expect(text('tx-row-fail-amount')).toHaveTextContent('—');
    expect(text('tx-row-fail-sub')).toHaveTextContent('fee 0.000005 SOL');

    expect(text('tx-row-none-amount')).toHaveTextContent('No funds moved');
    expect(getByTestId('tx-row-unk-icon-dot')).toBeTruthy();
    expect(text('tx-row-unk-amount')).toHaveTextContent('—');

    // §3.4: a partial row is shown, as "Transaction" with "—": never dropped, never a Sent
    expect(getByTestId('tx-row-partial-icon-dot')).toBeTruthy();
    expect(text('tx-row-partial-title')).toHaveTextContent('Transaction');
    expect(text('tx-row-partial-amount')).toHaveTextContent('—');
  });

  // T2
  it('"+N more" and " · incomplete" follow the amount', () => {
    show([row('sent', {signature: 'a', primary: delta('M', 'TEST', -100000n), extraAssets: 1, incomplete: true})]);
    const {getByTestId} = screen();
    expect(getByTestId('tx-row-a-amount')).toHaveTextContent('−0.0001 +1 more · incomplete');
  });

  // T3
  it('a row tap opens #27 with the signature and the account the row was shown for', () => {
    show([row('sent', {signature: 'a', primary: delta('M', 'TEST', -1n)})]);
    const {getByTestId} = screen();
    fireEvent.press(getByTestId('tx-row-a'));
    expect(onSelectTx).toHaveBeenCalledWith('a', ME);
  });

  // T4
  it('rows sit under date sections; "Date unknown" is last', () => {
    show([
      row('unknown', {signature: 'nodate'}, null),
      row('unknown', {signature: 'today'}, at('2026-11-26T08:00:00Z')),
      row('unknown', {signature: 'yday'}, at('2026-11-25T08:00:00Z')),
      row('unknown', {signature: 'old'}, at('2026-05-06T08:00:00Z')),
    ]);
    const {getByTestId, getAllByTestId} = screen();
    expect(getAllByTestId(/^history-section-/).map(x => x.props.children)).toEqual(['Today', 'Yesterday', 'May 2026', 'Date unknown']);
    expect(getByTestId('tx-row-old-secondary')).toHaveTextContent('6 May');
  });

  // T5 (M1d)
  it('asks the history of the selected account and names it', () => {
    mockHistSelected.current = {address: ACC_2, label: 'Account 2'};
    show([]);
    const {getByTestId} = screen();
    expect(mockUseActivityHistory).toHaveBeenLastCalledWith(ACC_2);
    expect(getByTestId('history-account-label')).toHaveTextContent('Account 2');
  });
});

describe('chips (§5.2)', () => {
  const mixed = (): HistoryRow[] => [
    row('sent', {signature: 's', primary: delta('M', 'TEST', -1n)}),
    row('received', {signature: 'r', primary: delta('M', 'TEST', 1n)}),
    row('swap', {signature: 'w', primary: delta('native', 'SOL', -1n), secondary: delta('M', 'TEST', 1n)}),
    row('made-private', {signature: 'p', primary: delta('M', 'TEST', -1n)}),
    row('made-public', {signature: 'q', primary: delta('M', 'TEST', 1n)}),
    row('failed', {signature: 'f'}),
  ];
  const shown = (q: (id: string) => unknown, ids: string[]) => ids.filter(id => q(`tx-row-${id}`) !== null);
  const ALL = ['s', 'r', 'w', 'p', 'q', 'f'];

  // T6
  it('All / Sent / Received / Swaps / Private filter the loaded rows; the pool moves are never Sent or Received', () => {
    show(mixed());
    const {getByTestId, queryByTestId} = screen();
    // the fifth chip reads "Private" — the app's one word for that side (copy guard: bannedWords.test.ts)
    const labels = {all: 'All', sent: 'Sent', received: 'Received', swaps: 'Swaps', private: 'Private'};
    for (const [id, text] of Object.entries(labels)) {
      expect(getByTestId(`history-chip-${id}`)).toHaveTextContent(text);
    }
    expect(shown(queryByTestId, ALL)).toEqual(ALL);
    fireEvent.press(getByTestId('history-chip-sent'));
    expect(shown(queryByTestId, ALL)).toEqual(['s']);
    fireEvent.press(getByTestId('history-chip-received'));
    expect(shown(queryByTestId, ALL)).toEqual(['r']);
    fireEvent.press(getByTestId('history-chip-swaps'));
    expect(shown(queryByTestId, ALL)).toEqual(['w']);
    fireEvent.press(getByTestId('history-chip-private'));
    expect(shown(queryByTestId, ALL)).toEqual(['p', 'q']);
    expect(getByTestId('history-chip-private').props.accessibilityState).toEqual({selected: true});
    expect(getByTestId('history-chip-all').props.accessibilityState).toEqual({selected: false});
  });

  // T7 (review I6)
  it('a chip with no loaded match, while older pages exist: "No {chip} transactions in the last {n}" and "Load older"', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)}), row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    const {getByTestId, getByText, queryByText} = screen();
    fireEvent.press(getByTestId('history-chip-swaps'));
    expect(getByText('No Swaps transactions in the last 2')).toBeTruthy();
    expect(queryByText('No Swaps transactions yet')).toBeNull();
    expect(queryByText('No transactions yet')).toBeNull();
    fireEvent.press(getByTestId('history-load-older'));
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(1);
  });

  // T8
  it('"No {chip} transactions yet" only at the end of history, with no "Load older"', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true);
    const {getByTestId, getByText, queryByTestId} = screen();
    fireEvent.press(getByTestId('history-chip-private'));
    expect(getByText('No Private transactions yet')).toBeTruthy();
    expect(queryByTestId('history-load-older')).toBeNull();
  });

  // T9 (r2 m4)
  it('automatic loading stops after 3 consecutive pages with no row under the chip; "Load older" still loads; a match resets it', async () => {
    const base = [row('sent', {signature: 's', primary: delta('M', 'TEST', -1n)}), row('received', {signature: 'r', primary: delta('M', 'TEST', 1n)})];
    show(base, false);
    // every page adds a Sent row: nothing new under Received
    const sentOnly = async () => snapshot([...base, row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    mockHistory.loadOlder = jest.fn(sentOnly);
    const view = screen();
    fireEvent.press(view.getByTestId('history-chip-received'));
    const reachEnd = async () => {
      await act(async () => {
        fireEvent(view.getByTestId('history-list'), 'endReached');
      });
    };
    for (let k = 0; k < 5; k++) {
      await reachEnd();
    }
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(3);
    // the explicit control still loads
    await act(async () => {
      fireEvent.press(view.getByTestId('history-load-older'));
    });
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(4);
    // a page that adds a Received row resets the count: scrolling loads again
    mockHistory.loadOlder.mockImplementationOnce(async () => snapshot([...base, row('received', {primary: delta('M', 'TEST', 1n)})], false));
    await act(async () => {
      fireEvent.press(view.getByTestId('history-load-older'));
    });
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(5);
    await reachEnd();
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(6);
  });

  // T10 (r2 m4)
  it('the All chip never stops loading on scroll', async () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    mockHistory.loadOlder = jest.fn(async () => null); // even pages that could not be read do not stop All
    const view = screen();
    const reachEnd = async () => {
      await act(async () => {
        fireEvent(view.getByTestId('history-list'), 'endReached');
      });
    };
    for (let k = 0; k < 6; k++) {
      await reachEnd();
    }
    expect(mockHistory.loadOlder).toHaveBeenCalledTimes(6);
  });

  // T11
  it('at the end of history nothing more is loaded', async () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true);
    const view = screen();
    await act(async () => {
      fireEvent(view.getByTestId('history-list'), 'endReached');
    });
    expect(mockHistory.loadOlder).not.toHaveBeenCalled();
    expect(view.queryByTestId('history-load-older')).toBeNull();
  });
});

describe('states (§5.3)', () => {
  // T12 (26a)
  it('cold load: 5 skeleton rows across 2 sections, never the empty state', () => {
    const {getAllByTestId, queryByText, getByText} = screen();
    expect(getAllByTestId('history-skeleton-row')).toHaveLength(5);
    expect(getByText('Today')).toBeTruthy();
    expect(getByText('Yesterday')).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
  });

  // T13 (§3.4)
  it('"No transactions yet" only when a successful read reached the end of history with zero rows', () => {
    show([], true);
    expect(screen().getByText('No transactions yet')).toBeTruthy();
    // a first page that read zero rows but did NOT reach the end claims nothing
    show([], false);
    const notEnd = screen();
    expect(notEnd.queryByText('No transactions yet')).toBeNull();
    expect(notEnd.queryByTestId('history-skeleton')).toBeNull();
  });

  // T14 (post-M1d §7, m1)
  it('no selected account → the list area is empty: no skeleton, no "No transactions yet", no retry', () => {
    mockHistSelected.current = null;
    mockHistory.isError = true;
    const {queryByText, queryByTestId} = screen();
    expect(queryByTestId('history-skeleton')).toBeNull();
    expect(queryByText('No transactions yet')).toBeNull();
    expect(queryByTestId('history-retry')).toBeNull();
    expect(mockUseActivityHistory).toHaveBeenLastCalledWith(null);
  });

  // T15 (r1-1)
  it('an error shows the retry line, never the empty state or the skeleton; tapping refetches once', async () => {
    mockHistory.isError = true;
    let resolve: () => void = () => undefined;
    mockHistory.refetch = jest.fn(() => new Promise<void>(r => { resolve = r; }));
    const {getByTestId, getByText, queryByText, queryByTestId, UNSAFE_getAllByProps} = screen();
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
    expect(queryByTestId('history-skeleton')).toBeNull();
    // two taps in one tick (before a re-render can disable the button) still read once: the ref guard
    const onPress = UNSAFE_getAllByProps({testID: 'history-retry'})[0]!.props.onPress as () => void;
    act(() => { onPress(); onPress(); });
    fireEvent.press(getByTestId('history-retry')); // disabled while busy
    expect(mockHistory.refetch).toHaveBeenCalledTimes(1);
    expect(getByText('Loading transactions…')).toBeTruthy();
    expect(getByTestId('history-retry').props.accessibilityState).toEqual(expect.objectContaining({busy: true}));
    await act(async () => { resolve(); });
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
  });

  // T16 (r1-1)
  it('a failed refresh keeps the rows already read and shows the retry line above them', () => {
    show([row('sent', {signature: 'a', primary: delta('M', 'TEST', -1n)}), row('received', {signature: 'b', primary: delta('M', 'TEST', 1n)})]);
    mockHistory.isSuccess = false;
    mockHistory.isError = true;
    const {getByTestId, getByText, queryByText} = screen();
    expect(getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    expect(getByTestId('tx-row-a')).toBeTruthy();
    expect(getByTestId('tx-row-b')).toBeTruthy();
    expect(queryByText('No transactions yet')).toBeNull();
  });

  // T17 (m5)
  it('switching account resets a retry that was in flight; a stale retry finishing frees nothing', async () => {
    mockHistory.isError = true;
    const resolvers: Array<() => void> = [];
    mockHistory.refetch = jest.fn(() => new Promise<void>(r => { resolvers.push(r); }));
    const view = screen();
    fireEvent.press(view.getByTestId('history-retry')); // account 1
    expect(view.getByText('Loading transactions…')).toBeTruthy();
    mockHistSelected.current = {address: ACC_2, label: 'Account 2'};
    view.rerender(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} now={NOW} timeZone={LJ} />);
    expect(view.getByText("Couldn't load transactions · tap to retry")).toBeTruthy();
    fireEvent.press(view.getByTestId('history-retry')); // account 2
    expect(mockHistory.refetch).toHaveBeenCalledTimes(2);
    await act(async () => { resolvers[0]!(); }); // account 1's read finishes late
    expect(view.getByText('Loading transactions…')).toBeTruthy(); // account 2's is still running
  });

  // T18 (§3.2 bound)
  it('the footer names the bound only when the wallet owns more token accounts than are read', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true, {read: 24, total: 31});
    expect(screen().getByTestId('history-coverage')).toHaveTextContent('History from 24 of 31 token accounts');
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], true, {read: 3, total: 3});
    expect(screen().queryByTestId('history-coverage')).toBeNull();
  });

  // T19
  it('pull-to-refresh runs the refetch (the §3.4 refresh), one at a time', async () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})]);
    let resolve: () => void = () => undefined;
    mockHistory.refetch = jest.fn(() => new Promise<void>(r => { resolve = r; }));
    const {getByTestId} = screen();
    const control = getByTestId('history-list').props.refreshControl as {props: {onRefresh: () => void; refreshing: boolean}};
    expect(control.props.refreshing).toBe(false);
    act(() => { control.props.onRefresh(); control.props.onRefresh(); });
    expect(mockHistory.refetch).toHaveBeenCalledTimes(1);
    expect((getByTestId('history-list').props.refreshControl as {props: {refreshing: boolean}}).props.refreshing).toBe(true);
    await act(async () => { resolve(); });
    expect((getByTestId('history-list').props.refreshControl as {props: {refreshing: boolean}}).props.refreshing).toBe(false);
  });

  // T21 (Review Focus 4)
  it('a list left open past midnight: the sections follow the clock handed in, not the first render', () => {
    show([row('unknown', {signature: 'a'}, at('2026-11-26T08:00:00Z'))]);
    const view = screen();
    expect(view.getByTestId('history-section-today')).toBeTruthy();
    expect(view.getByTestId('tx-row-a-secondary')).toHaveTextContent('09:00');
    view.rerender(<TransactionHistoryScreen onSelectTx={onSelectTx} onBack={onBack} now={NOW + 2 * 86_400_000} timeZone={LJ} />);
    expect(view.queryByTestId('history-section-today')).toBeNull();
    expect(view.getByTestId('history-section-week')).toBeTruthy(); // Saturday: Thursday is "This week"
    expect(view.getByTestId('tx-row-a-secondary')).toHaveTextContent('26 Nov');
  });

  // T22
  it('while an older page loads: a spinner under All; under a filter the control is busy and reads "Loading transactions…"', () => {
    show([row('sent', {primary: delta('M', 'TEST', -1n)})], false);
    mockHistory.loadingOlder = true;
    const view = screen();
    expect(view.getByTestId('history-loading-older')).toBeTruthy();
    expect(view.queryByTestId('history-load-older')).toBeNull();
    fireEvent.press(view.getByTestId('history-chip-sent'));
    const control = view.getByTestId('history-load-older');
    expect(control).toHaveTextContent('Loading transactions…');
    expect(control.props.accessibilityState).toEqual({disabled: true, busy: true});
    fireEvent.press(control);
    expect(mockHistory.loadOlder).not.toHaveBeenCalled();
  });

  // T20
  it('Back calls onBack', () => {
    show([]);
    fireEvent.press(screen().getByText('← Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it.** `npx jest src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx --forceExit`
      Expected: FAIL in every test — the old screen still calls the real `useTransactionHistory` (the test no
      longer mocks `useSolanaQueries`), which throws `No QueryClient set, use QueryClientProvider to set one`.

- [ ] **Step 3: Replace the whole of `src/screens/transparent/TransactionHistoryScreen.tsx` with:**

```tsx
/**
 * #26 (history spec 2026-11-26 §5): the selected account's history — real rows under date sections,
 * filtered by chips. What a row says is `rowView` (pure, `modules/solana/activityView.ts`); the rows
 * come from `useActivityHistory`.
 *
 * NEVER A CLAIM THAT WAS NOT READ (§1.2): "No transactions yet" only after a successful read that
 * reached the end of history with zero rows; a chip with no match among the loaded rows says so
 * ("in the last {n}") and offers "Load older"; with no account resolved the list area is empty.
 *
 * LOADING OLDER (§5.2): reaching the end of the list loads the next page, but stops after 3
 * consecutive pages that added no row under the active chip (an empty chip cannot be scrolled, and a
 * list shorter than the screen would otherwise read the whole history in a burst). After that only
 * "Load older" loads. The All chip never stops: every page adds rows.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {ActivityIndicator, Pressable, RefreshControl, ScrollView, SectionList, View} from 'react-native';
import {ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Circle, Lock, Settings, TriangleAlert} from 'lucide-react-native';
import {Text} from '../../components/ui';
import {cn} from '../../utils/cn';
import {useAccountList, useSelectedAccount} from '../../hooks/useSelectedAccount';
import {useActivityHistory} from '../../hooks/useActivityHistory';
import {chipMatches, counterpartyLabel, deviceTimeZone, groupSections, rowView} from '../../modules/solana/activityView';
import type {RowIcon, RowView} from '../../modules/solana/activityView';
import type {HistoryRow, HistorySnapshot} from '../../modules/solana/history';
import {HISTORY_PAGE_SIZE} from '../../modules/solana/historySession';
import {HISTORY_EMPTY, HISTORY_ERROR, HISTORY_LOADING} from '../../copy/accounts';
import {
  HISTORY_CHIPS,
  HISTORY_LOAD_OLDER,
  SECTION_TODAY,
  SECTION_YESTERDAY,
  TX_PRIVATE_BADGE,
  historyChipNone,
  historyChipNoneLoaded,
  historyCoverage,
} from '../../copy/transactions';
import type {HistoryChipId} from '../../copy/transactions';

interface Props {
  onSelectTx: (signature: string, account: string) => void;
  onBack: () => void;
  /** for tests: the clock (ms) and the IANA zone the sections are cut in; the device's by default */
  now?: number;
  timeZone?: string;
}

/** §5.2: automatic loading stops after this many consecutive pages with no row under the active chip */
const DRY_PAGE_LIMIT = 3;

const ICON_SHELL: Record<RowIcon, string> = {
  sent: 'bg-bg-surface-2',
  received: 'bg-[rgba(63,214,139,0.14)]',
  swap: 'bg-[rgba(125,168,255,0.14)]',
  private: 'bg-accent-shielded-tint',
  setup: 'bg-bg-surface-2',
  failed: 'bg-[rgba(255,92,106,0.14)]',
  dot: 'bg-bg-surface-2',
};

function RowGlyph({icon}: {icon: RowIcon}) {
  switch (icon) {
    case 'sent':
      return <ArrowUpRight size={20} color="#F2F3F5" />;
    case 'received':
      return <ArrowDownLeft size={20} color="#3FD68B" />;
    case 'swap':
      return <ArrowLeftRight size={20} color="#7DA8FF" />;
    case 'private':
      return <Lock size={20} color="#5BE3C2" />;
    case 'setup':
      return <Settings size={20} color="#A8ACB5" />;
    case 'failed':
      return <TriangleAlert size={20} color="#FF5C6A" />;
    case 'dot':
      return <Circle size={8} color="#A8ACB5" fill="#A8ACB5" />;
  }
}

const TONE: Record<RowView['amountTone'], string> = {
  default: 'text-fg-primary',
  success: 'text-success',
  tertiary: 'text-fg-tertiary',
};

function HistoryRowItem({signature, view, onPress}: {signature: string; view: RowView; onPress: () => void}) {
  const id = `tx-row-${signature}`;
  return (
    <Pressable
      testID={id}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[view.title, view.badge ? TX_PRIVATE_BADGE : '', view.secondary, `${view.amount}${view.note ?? ''}`, view.sub ?? ''].filter(s => s !== '').join(', ')}
      className="flex-row items-center gap-3 px-5 py-3 min-h-touch-lg active:bg-bg-surface-1">
      <View testID={`${id}-icon-${view.icon}`} className={cn('w-10 h-10 rounded-pill items-center justify-center', ICON_SHELL[view.icon])}>
        <RowGlyph icon={view.icon} />
      </View>
      <View className="flex-1 min-w-0">
        <View className="flex-row items-center gap-2">
          <Text variant="body-lg" numberOfLines={1} className="shrink" testID={`${id}-title`}>
            {view.title}
          </Text>
          {view.badge ? (
            <View testID={`${id}-badge`} className="flex-row items-center gap-1 px-1.5 py-0.5 rounded-pill bg-accent-shielded-tint">
              <Lock size={10} color="#5BE3C2" />
              <Text variant="overline" className="text-accent-shielded">
                {TX_PRIVATE_BADGE}
              </Text>
            </View>
          ) : null}
        </View>
        {view.secondary !== '' ? (
          <Text variant="body-sm" numberOfLines={1} className="text-fg-tertiary" testID={`${id}-secondary`}>
            {view.secondary}
          </Text>
        ) : null}
      </View>
      <View className="items-end">
        <Text variant={view.amountTone === 'tertiary' ? 'body-sm' : 'body-lg'} numeral className={TONE[view.amountTone]} testID={`${id}-amount`}>
          {view.amount}
          {view.note !== null ? <Text variant="body-sm" className="text-fg-tertiary">{view.note}</Text> : null}
        </Text>
        {view.sub !== null ? (
          <Text variant="body-sm" numeral className="text-fg-tertiary" testID={`${id}-sub`}>
            {view.sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function SkeletonRow() {
  return (
    <View testID="history-skeleton-row" className="flex-row items-center gap-3 px-5 py-3 min-h-touch-lg">
      <View className="w-10 h-10 rounded-pill bg-bg-surface-2" />
      <View className="flex-1 gap-2">
        <View className="h-3 w-3/5 rounded bg-bg-surface-2" />
        <View className="h-2.5 w-1/3 rounded bg-bg-surface-2" />
      </View>
      <View className="h-3 w-16 rounded bg-bg-surface-2" />
    </View>
  );
}

/** 26a: 5 skeleton rows across 2 sections while the first page is read */
function Skeleton() {
  return (
    <View testID="history-skeleton" accessible accessibilityLabel={HISTORY_LOADING}>
      <Text variant="overline" className="px-5 pt-4 pb-2 text-fg-secondary">
        {SECTION_TODAY}
      </Text>
      <SkeletonRow />
      <SkeletonRow />
      <Text variant="overline" className="px-5 pt-4 pb-2 text-fg-secondary">
        {SECTION_YESTERDAY}
      </Text>
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </View>
  );
}

const countUnder = (rows: readonly HistoryRow[], chip: HistoryChipId): number => rows.filter(r => chipMatches(chip, r)).length;

export function TransactionHistoryScreen({onSelectTx, onBack, now, timeZone}: Props) {
  // M1d (spec §4.2, D1): the SELECTED account's history
  const selected = useSelectedAccount();
  const accountList = useAccountList();
  const publicKey = selected?.address ?? null;
  const {data, isSuccess, isError, refetch, loadOlder, loadingOlder} = useActivityHistory(publicKey);
  const [chip, setChip] = useState<HistoryChipId>('all');
  const chipLabel = HISTORY_CHIPS.find(c => c.id === chip)!.label;

  // r1-1: one read in flight at a time (the pattern of #12); the line says "Loading…" while it runs
  const retryingRef = useRef(false);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  // m5: a retry started for one account must not block, or later reset, another account's
  const generationRef = useRef(0);
  // §5.2: consecutive pages that added no row under the active chip
  const dryPagesRef = useRef(0);
  useEffect(() => {
    generationRef.current += 1;
    retryingRef.current = false;
    setRetrying(false);
    setRefreshing(false);
    dryPagesRef.current = 0;
  }, [publicKey]);
  useEffect(() => {
    dryPagesRef.current = 0;
  }, [chip]);

  const read = useCallback(
    (onDone: () => void) => {
      if (retryingRef.current) {
        return;
      }
      retryingRef.current = true;
      const generation = generationRef.current;
      refetch()
        .catch(() => undefined)
        .finally(() => {
          if (generation !== generationRef.current) {
            return;
          }
          retryingRef.current = false;
          onDone();
        });
    },
    [refetch],
  );
  const retry = useCallback(() => {
    if (retryingRef.current) {
      return;
    }
    setRetrying(true);
    read(() => setRetrying(false));
  }, [read]);
  const onRefresh = useCallback(() => {
    if (retryingRef.current) {
      return;
    }
    setRefreshing(true);
    read(() => setRefreshing(false));
  }, [read]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const visible = useMemo(() => rows.filter(r => chipMatches(chip, r)), [rows, chip]);
  const endReached = data?.endReached ?? false;
  // the clock the sections are cut by: read again whenever the data changes (a list left open past midnight)
  const [clock, setClock] = useState(() => now ?? Date.now());
  useEffect(() => {
    setClock(now ?? Date.now());
  }, [now, data]);
  const zone = useMemo(() => timeZone ?? deviceTimeZone(), [timeZone]);
  const sections = useMemo(() => groupSections(visible, clock, zone), [visible, clock, zone]);
  const labelOf = useCallback((address: string) => counterpartyLabel(accountList, address), [accountList]);

  const loadMore = useCallback(async () => {
    if (data === undefined || endReached || loadingOlder) {
      return;
    }
    const before = countUnder(rows, chip);
    const next: HistorySnapshot | null = await loadOlder();
    if (next !== null) {
      dryPagesRef.current = countUnder(next.rows, chip) > before ? 0 : dryPagesRef.current + 1;
    }
  }, [data, endReached, loadingOlder, rows, chip, loadOlder]);
  const onEndReached = useCallback(() => {
    if (chip === 'all' || dryPagesRef.current < DRY_PAGE_LIMIT) {
      loadMore().catch(() => undefined);
    }
  }, [chip, loadMore]);

  const loadOlderButton =
    data !== undefined && !endReached ? (
      <Pressable
        testID="history-load-older"
        onPress={() => {
          loadMore().catch(() => undefined);
        }}
        disabled={loadingOlder}
        accessibilityRole="button"
        accessibilityState={{disabled: loadingOlder, busy: loadingOlder}}
        className="self-center mt-3 px-5 min-h-touch-min items-center justify-center rounded-pill bg-bg-surface-2 active:opacity-80">
        <Text variant="body-sm" className="text-accent-transparent">
          {loadingOlder ? HISTORY_LOADING : HISTORY_LOAD_OLDER}
        </Text>
      </Pressable>
    ) : null;

  const empty =
    // post-M1d §7 (m1): with no account resolved nothing is being read, so nothing is claimed
    publicKey === null ? null : data === undefined ? (
      isError ? null : (
        <Skeleton />
      )
    ) : rows.length === 0 && endReached && isSuccess ? (
      // I2: "No transactions yet" only after a successful read that reached the end of history
      <View className="items-center mt-20 px-6">
        <Text variant="body" className="text-fg-tertiary">
          {HISTORY_EMPTY}
        </Text>
      </View>
    ) : rows.length === 0 ? null : (
      <View className="items-center mt-12 px-6" testID="history-chip-empty">
        <Text variant="body" className="text-fg-tertiary text-center">
          {endReached ? historyChipNone(chipLabel) : historyChipNoneLoaded(chipLabel, rows.length)}
        </Text>
        {loadOlderButton}
      </View>
    );

  const footer =
    data === undefined || visible.length === 0 ? null : (
      <View className="pb-8">
        {/* the All chip loads by itself; under a filter the explicit control is always there (§5.2) */}
        {chip === 'all' ? (
          loadingOlder ? (
            <View className="py-4" testID="history-loading-older">
              <ActivityIndicator color="#B084FC" />
            </View>
          ) : null
        ) : (
          loadOlderButton
        )}
        {data.coverage.read < data.coverage.total ? (
          <Text variant="caption" className="text-fg-tertiary text-center px-5 pt-4" testID="history-coverage">
            {historyCoverage(data.coverage.read, data.coverage.total)}
          </Text>
        ) : null}
      </View>
    );

  return (
    <View className="flex-1 bg-bg-base">
      <View className="flex-row items-center gap-3 p-4">
        <Pressable onPress={onBack} accessibilityRole="button" hitSlop={8}>
          <Text variant="body-lg" className="text-accent-transparent">
            ← Back
          </Text>
        </Pressable>
        <View>
          <Text variant="h2">Transaction History</Text>
          {selected ? (
            <Text variant="body-sm" className="text-fg-secondary mt-0.5" testID="history-account-label">
              {selected.label}
            </Text>
          ) : null}
        </View>
      </View>

      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="px-5 gap-2 pb-2">
          {HISTORY_CHIPS.map(c => {
            const active = c.id === chip;
            const mint = c.id === 'private';
            return (
              <Pressable
                key={c.id}
                testID={`history-chip-${c.id}`}
                onPress={() => setChip(c.id)}
                accessibilityRole="button"
                accessibilityState={{selected: active}}
                className={cn(
                  'min-h-[44px] min-w-[44px] px-4 rounded-pill items-center justify-center',
                  active ? (mint ? 'bg-accent-shielded-tint' : 'bg-accent-transparent-tint') : 'bg-bg-surface-2',
                )}>
                <Text variant="body-sm" className={active ? (mint ? 'text-accent-shielded' : 'text-accent-transparent') : 'text-fg-secondary'}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <SectionList
        testID="history-list"
        sections={sections}
        keyExtractor={item => item.item.signature}
        stickySectionHeadersEnabled={false}
        initialNumToRender={HISTORY_PAGE_SIZE}
        renderSectionHeader={({section}) => (
          <Text variant="overline" className="px-5 pt-4 pb-2 text-fg-secondary" testID={`history-section-${section.key}`}>
            {section.title}
          </Text>
        )}
        renderItem={({item}) => (
          <HistoryRowItem
            signature={item.item.signature}
            view={rowView(item, labelOf, clock, zone)}
            onPress={() => {
              if (publicKey !== null) {
                onSelectTx(item.item.signature, publicKey);
              }
            }}
          />
        )}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshControl={
          publicKey === null ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B084FC" colors={['#B084FC']} />
        }
        ListHeaderComponent={
          isError && publicKey !== null ? (
            <Pressable
              testID="history-retry"
              onPress={retry}
              disabled={retrying}
              accessibilityRole="button"
              accessibilityState={{disabled: retrying, busy: retrying}}
              className="px-4 py-3"
              hitSlop={8}>
              <Text variant="body-sm" className="text-warning">
                {retrying ? HISTORY_LOADING : HISTORY_ERROR}
              </Text>
            </Pressable>
          ) : null
        }
        ListEmptyComponent={empty}
        ListFooterComponent={footer}
      />
    </View>
  );
}
```

- [ ] **Step 4: Remove the hook the screen no longer uses** from `src/hooks/useSolanaQueries.ts`
      (`useTransactionDetail` stays until Task 8; `queries.ts` `getTransactionHistory` and its tests stay — nothing
      else in this task touches them).

**Edit 1 of 2 — `src/hooks/useSolanaQueries.ts`. Find:**

```ts
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../modules/solana/connection';
import {getBalance, getTokenAccounts, getTransactionHistory, getTransactionDetail} from '../modules/solana/queries';
import type {TokenAccount, ParsedTransaction} from '../modules/solana/types';
import type {TxDetail} from '../modules/solana/queries';

/**
```

**Replace with:**

```ts
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../modules/solana/connection';
import {getBalance, getTokenAccounts, getTransactionDetail} from '../modules/solana/queries';
import type {TokenAccount} from '../modules/solana/types';
import type {TxDetail} from '../modules/solana/queries';

/**
```

**Edit 2 of 2 — `src/hooks/useSolanaQueries.ts`. Find:**

```ts
}

/**
 * React Query hook for transaction history.
 * TTL: 30 seconds (spec: tx history refresh)
 */
export function useTransactionHistory(
  publicKey: string | null,
  options?: {limit?: number; before?: string},
) {
  return useQuery<ParsedTransaction[]>({
    queryKey: ['txHistory', publicKey, options?.before],
    queryFn: async () => {
      if (!publicKey) throw new Error('No public key');
      return getTransactionHistory(getConnection(), new PublicKey(publicKey), {
        limit: options?.limit ?? 20,
        before: options?.before,
      });
    },
    enabled: !!publicKey,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

/**
 * React Query hook for a single transaction detail.
 * Retries with 4s interval until the tx is indexed by RPC.
```

**Replace with:**

```ts
}

/**
 * React Query hook for a single transaction detail.
 * Retries with 4s interval until the tx is indexed by RPC.
```

- [ ] **Step 5: Run it.** The Step 2 command. Expected: PASS (22 tests). Then
      `grep -rn "useTransactionHistory" src` — expected: no output.

- [ ] **Step 6: The copy guards and the route.**
      `npx jest src/copy src/screens/shielded/__tests__/privacyClaims.test.ts src/app --forceExit`
      Expected: PASS with the guard files unchanged. (`privacyClaims.test.ts` reads this screen's source by path;
      `bannedWords.test.ts` reads every file under `src/screens`.)

- [ ] **Step 7: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx --forceExit`.
      `lint:ci` must still print exactly `✖ 143 problems (0 errors, 143 warnings)`: the old screen had none, the
      new one must have none.

- [ ] **Step 8: Commit.**

```bash
git add src/screens/transparent/TransactionHistoryScreen.tsx src/hooks/useSolanaQueries.ts \
  src/screens/transparent/__tests__/TransactionHistoryScreen.test.tsx
git commit -m "feat(history): #26 shows real rows under date sections, with chips, a skeleton and Load older"
```

---

### Task 8: #27 — the hero is the row; From / To only when they agree with it

Spec: §4.6 (all of it), H7, §8 "#27", §11 (27f's second case; no OriginBadge).

**Design (BINDING, read both before writing):** `/home/user/Downloads/screen.md` section `27 · tx-detail`, and its
mockups in `index.html` (search `27a · transparent-send`; states 27a–27f). Do NOT edit those files (Task 12 does).

| Design element (#27) | This task |
|---|---|
| Amount hero + the eyebrow word | built: from `classifyActivity` for the account the detail was opened from; nine words (§4.6) |
| fiat under the hero | built as "≈ $x at today's price", only when a price is known (H7) |
| Detail rows Type, Status, Hash + Copy, Block, Network fee, Memo | kept as they are |
| From / To (mono, 6+6 highlighted) | shown only when the parsed transfer agrees with the row; otherwise "Fee payer" + **"Balance changes"** (new) |
| "Authorized by" (27f) | kept for a delegated transfer; its second case (From "—") is **not reachable** any more (spec §11) |
| [View on explorer], [Save to address book] | kept; the contact button only when From / To are shown and the recipient is not this account |
| OriginBadge | **NOT shown** (spec §11) |
| "token account" caption under an address | **no longer reachable** — a recipient that is only a token account now shows the balance-changes form (ruling 8) |

**Files:**
- Create: `src/hooks/useParsedTx.ts`
- Modify: `src/screens/transparent/TransactionDetailScreen.tsx` (whole file)
- Modify: `src/hooks/useSolanaQueries.ts` (remove `useTransactionDetail`)
- Test: `src/hooks/__tests__/useParsedTx.test.tsx` (new),
  `src/screens/transparent/__tests__/TransactionDetailScreen.test.tsx` (whole file)

**Interfaces:**
- Consumes (Task 2): `classifyActivity`, `parseTxDetail` (existing), `RawParsedTx`.
- Consumes (Task 3): `peekHistorySession(cluster, account)?.tokenAccountSources`.
- Consumes (Task 4): `parsedTxKey(cluster, signature)`, `readParsedTransaction(connection, cluster, signature): Promise<RawParsedTx | null>`,
  `applyParsedTxDefaults(client)` from `src/modules/solana/historyReads`; `activityContext(own?)` from
  `src/modules/solana/activityContext`.
- Consumes (Task 5): `activityWord`, `heroAmount`, `partiesAgree`, `changeLine`, `primaryUsdToday` from
  `src/modules/solana/activityView`; `TX_BALANCE_CHANGES`, `txAtTodaysPrice(usd)` (and the existing `TX_FEE_PAYER`,
  `TX_AUTHORIZED_BY`) from `src/copy/transactions`.
- Consumes (existing): `useResolvedPrices(): {prices: Record<string, {usd: number; change24h: number | null}>; havePrices: boolean}`;
  `priceKeyFor(mint)` (`src/modules/prices/portfolio`: wSOL → `'native'`); `formatUsdString(n)` → `"$1,234.56"`
  (`src/utils/formatUsd`); `BELOW_ONE_CENT` (`'<$0.01'`, `src/copy/accounts`); `trustedSymbol`; `NETWORK`.
- Produces, from `src/hooks/useParsedTx.ts`:
  - `export const PARSED_TX_RETRY_MS = 4_000`
  - `export function useParsedTx(signature: string | null): {raw: RawParsedTx | undefined; isLoading: boolean; notFound: boolean}`
- Produces: `TransactionDetailScreen({signature, account, onBack})` — props unchanged (`Navigator.tsx` is not
  touched). New test ids: `tx-detail-usd`, `tx-detail-changes`, `tx-detail-change-{k}`; kept:
  `tx-detail-direction`, `tx-detail-amount`, `tx-detail-from`, `tx-detail-to`, `tx-detail-authority`.

**Why:**
- The hero of PR 1 reads the first top-level transfer, so a swap shows one leg, a pool deposit shows nothing or
  the wrong thing, and a relayed Make public shows the gas grant. The row of #26 and the hero of #27 must be the
  same reading: both are `classifyActivity`.
- Two readings of one transaction may disagree (the first transfer vs the net change). When they do, showing
  From / To from one and an amount from the other would be a wrong screen. So the PR 1 rows show only on agreement
  (`partiesAgree`, Task 5), and otherwise the screen says who paid the fee and lists every balance change with its
  role — which is always true.
- #27 reads the raw transaction from the same cache #26 fills (no request when opened from a row). A transaction
  the node has not indexed yet is an error state that retries every 4 s — never cached data.
- **The one inline style in this file (`style={{fontSize: 28}}` on the amount) must stay exactly once**: it is one
  of the 143 lint warnings, and the gate is exact.
- With no account (a deep link) nothing is claimed: "Transaction", no amount, the fee payer.

- [ ] **Step 1: Write the failing tests.** Create `src/hooks/__tests__/useParsedTx.test.tsx`:

```tsx
/**
 * History spec §4.6, §3.3: #27's read of the raw transaction — the shared per-signature cache, and a
 * transaction that is not indexed yet (an error, never cached data). Real timers only; every test
 * unmounts and clears its client, so the 4 s retry never outlives it.
 */
import React from 'react';
import {renderHook, waitFor} from '@testing-library/react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {useParsedTx} from '../useParsedTx';
import {applyParsedTxDefaults, parsedTxKey} from '../../modules/solana/historyReads';
import {_resetRateLimitersForTest} from '../../modules/solana/rpcLimiter';

const mockGetParsedTransaction = jest.fn();
jest.mock('../../modules/solana/connection', () => ({getConnection: () => ({getParsedTransaction: mockGetParsedTransaction})}));

let client: QueryClient;
const wrapper = ({children}: {children: React.ReactNode}) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
const KEY = parsedTxKey('mainnet-beta', 'SIG'); // the jest Config mock's NETWORK

beforeEach(() => {
  _resetRateLimitersForTest();
  mockGetParsedTransaction.mockReset();
  client = new QueryClient();
  applyParsedTxDefaults(client);
});
afterEach(() => {
  client.clear();
});

// U1
it('reads the transaction once, at version 0, and keeps it under the shared key', async () => {
  mockGetParsedTransaction.mockResolvedValue({slot: 7});
  const {result, unmount} = renderHook(() => useParsedTx('SIG'), {wrapper});
  expect(result.current).toEqual({raw: undefined, isLoading: true, notFound: false});
  await waitFor(() => expect(result.current.raw).toEqual({slot: 7}));
  expect(result.current).toMatchObject({isLoading: false, notFound: false});
  expect(mockGetParsedTransaction).toHaveBeenCalledWith('SIG', {maxSupportedTransactionVersion: 0});
  expect(client.getQueryData(KEY)).toEqual({slot: 7});
  unmount();
});

// U2
it('a row opened from the history costs no request: the cache #26 filled is used', () => {
  client.setQueryData(KEY, {slot: 9});
  const {result, unmount} = renderHook(() => useParsedTx('SIG'), {wrapper});
  expect(result.current).toEqual({raw: {slot: 9}, isLoading: false, notFound: false});
  expect(mockGetParsedTransaction).not.toHaveBeenCalled();
  unmount();
});

// U3
it('not indexed yet (null): notFound, and nothing is cached', async () => {
  mockGetParsedTransaction.mockResolvedValue(null);
  const {result, unmount} = renderHook(() => useParsedTx('SIG'), {wrapper});
  await waitFor(() => expect(result.current.notFound).toBe(true));
  expect(result.current).toEqual({raw: undefined, isLoading: false, notFound: true});
  expect(client.getQueryData(KEY)).toBeUndefined();
  unmount();
});

// U4
it('a read that fails is notFound too; no signature reads nothing', async () => {
  mockGetParsedTransaction.mockRejectedValue(new Error('rpc down'));
  const failing = renderHook(() => useParsedTx('SIG'), {wrapper});
  await waitFor(() => expect(failing.result.current.notFound).toBe(true));
  failing.unmount();
  mockGetParsedTransaction.mockClear();
  const none = renderHook(() => useParsedTx(null), {wrapper});
  expect(none.result.current.raw).toBeUndefined();
  expect(mockGetParsedTransaction).not.toHaveBeenCalled();
  none.unmount();
});
```

      Replace the whole of `src/screens/transparent/__tests__/TransactionDetailScreen.test.tsx` with:

```tsx
/**
 * #27 (history spec 2026-11-26 §4.6, §8 "#27"): the detail against REAL responses (the fixtures of
 * modules/solana/__tests__), read through a scripted `useParsedTx`. The hero is what `classifyActivity`
 * says for the account the detail was opened from; From / To show only when the parsed transfer agrees
 * with it. A DERIVED case names exactly what it changed.
 */
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {readFileSync} from 'fs';
import {join} from 'path';
import {TransactionDetailScreen} from '../TransactionDetailScreen';
import {classifyActivity} from '../../../modules/solana/activity';
import {heroAmount} from '../../../modules/solana/activityView';
import type {ActivityContext} from '../../../modules/solana/activity';
import type {RawParsedTx} from '../../../modules/solana/txDetail';

// ── Module mocks (jest.mock is hoisted above all imports) ─────────────────────

const mockParsed: {raw: RawParsedTx | undefined; isLoading: boolean; notFound: boolean} = {raw: undefined, isLoading: false, notFound: false};
jest.mock('../../../hooks/useParsedTx', () => ({useParsedTx: jest.fn(() => mockParsed)}));

const mockPrices: {current: Record<string, {usd: number; change24h: null}>} = {current: {}};
jest.mock('../../../hooks/useResolvedPrices', () => ({useResolvedPrices: () => ({prices: mockPrices.current, havePrices: true})}));

// the symbol source and the classifier's constants are the devnet build's (the jest Config mock is mainnet)
jest.mock('../../../modules/tokens/trustedSymbol', () => ({
  trustedSymbol: (mint: string) => (mint === 'native' ? 'SOL' : mint === 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs' ? 'TEST' : `${mint.slice(0, 6)}…${mint.slice(-4)}`),
}));
jest.mock('../../../modules/solana/activityContext', () => ({
  activityContext: (own?: ReadonlySet<string>) => ({
    symbolOf: (mint: string) => (mint === 'native' ? 'SOL' : mint === 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs' ? 'TEST' : `${mint.slice(0, 6)}…${mint.slice(-4)}`),
    cluster: 'devnet',
    a0: {cluster: 'devnet', mint: 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs'},
    feeTreasury: 'TreasuryXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
    relayerFeePayer: '3jvhiz9qcJAe2zGHvRAiRYXiaFCdjEQrB9KuE5NuFaGe',
    jupiterProgramId: 'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4',
    ownTokenAccounts: own ?? new Set<string>(),
  }),
}));

jest.mock('../../../store/mmkv/instances', () => ({
  mmkvPublic: {
    set: jest.fn(),
    getString: jest.fn(),
    getBoolean: jest.fn().mockReturnValue(false),
    getAllKeys: jest.fn().mockReturnValue([]),
    remove: jest.fn(),
  },
  mmkvSecure: jest.fn().mockReturnValue(null),
  initSecureMmkv: jest.fn(),
  onSecureMmkvReady: jest.fn(),
  onSecureMmkvReset: jest.fn(),
}));

jest.mock('../../../store/zustand/shieldedStore', () => ({
  useShieldedStore: jest.fn((selector: (s: {mode: string}) => unknown) => selector({mode: 'transparent'})),
}));

jest.mock('../../../utils/explorerUrl', () => ({
  getExplorerUrl: jest.fn((sig: string) => `https://solscan.io/tx/${sig}`),
}));

jest.mock('../../../modules/addressBook/addressBookModule', () => ({
  addressBook: {
    addContact: jest.fn(),
    findByAddress: jest.fn().mockReturnValue(null),
  },
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, '../../../modules/solana/__tests__/fixtures', name), 'utf8')) as {result: RawParsedTx}).result;

const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const ACC_3 = '5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7';
const OUTSIDE = 'EfHSPxjapWuecfjRp6eRL2PR3YjpKbk86jm5kqmwXGgk';
const TEST_MINT = 'ERkpCFGaoWmeZPhKTUHumrqHTP1QmyHVhMJUnxbRPKCs';
const SELLER = '4wK1vV3d1ZoZvYED9RafrDAS1XvsvkYJuLN3XxSHTpd5';
const WRAPPER = 'G1k6vgWH6REJUYHQBDri9r6KPryX61keqTgHfp8Exb8n';
const SIG = 'SIG12345678ABCDEFGHIJ';

function screen(fixture: string | RawParsedTx, account: string | null) {
  mockParsed.raw = typeof fixture === 'string' ? load(fixture) : fixture;
  return render(
    <SafeAreaProvider initialMetrics={{insets: {top: 0, bottom: 0, left: 0, right: 0}, frame: {x: 0, y: 0, width: 0, height: 0}}}>
      <TransactionDetailScreen signature={SIG} account={account} onBack={jest.fn()} />
    </SafeAreaProvider>,
  );
}
const changes = (r: ReturnType<typeof screen>): string[] =>
  r.queryAllByTestId(/^tx-detail-change-\d+$/).map(x => (Array.isArray(x.props.children) ? x.props.children.join('') : String(x.props.children)));

beforeEach(() => {
  mockParsed.raw = undefined;
  mockParsed.isLoading = false;
  mockParsed.notFound = false;
  mockPrices.current = {};
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('states', () => {
  // D1
  it('loading', () => {
    mockParsed.isLoading = true;
    const r = render(
      <SafeAreaProvider initialMetrics={{insets: {top: 0, bottom: 0, left: 0, right: 0}, frame: {x: 0, y: 0, width: 0, height: 0}}}>
        <TransactionDetailScreen signature={SIG} account={ACC_2} onBack={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(r.getByText('Loading transaction…')).toBeTruthy();
  });

  // D2
  it('not indexed yet: "Couldn\'t load this transaction", with the explorer and Back', () => {
    mockParsed.notFound = true;
    const onBack = jest.fn();
    const r = render(
      <SafeAreaProvider initialMetrics={{insets: {top: 0, bottom: 0, left: 0, right: 0}, frame: {x: 0, y: 0, width: 0, height: 0}}}>
        <TransactionDetailScreen signature={SIG} account={ACC_2} onBack={onBack} />
      </SafeAreaProvider>,
    );
    expect(r.getByText("Couldn't load this transaction")).toBeTruthy();
    expect(r.getByText('View on explorer')).toBeTruthy();
    fireEvent.press(r.getByText('Back'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  // D3
  it('ready: the top bar, status, hash, block and the exact network fee', () => {
    const r = screen('tx-test-to-main.json', ACC_2);
    expect(r.getAllByText('Transaction').length).toBeGreaterThanOrEqual(1); // the top bar
    expect(r.getAllByText('Confirmed').length).toBeGreaterThanOrEqual(1);
    expect(r.getByText('Hash')).toBeTruthy();
    expect(r.getByText('525080588')).toBeTruthy();
    expect(r.getByText('0.000007 SOL')).toBeTruthy();
    fireEvent.press(r.getByLabelText('Go back'));
  });
});

describe('the hero is the row (§4.6)', () => {
  // D4
  it('a token send opened from the sender (QAgzVzY6…): "Sent", "0.0002 TEST" without a sign, From / To = the two wallets', () => {
    const r = screen('tx-test-to-main.json', ACC_2);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    expect(r.getAllByText('Sent')).toHaveLength(2); // the eyebrow and the Type row say the same word
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.0002 TEST');
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent(/^9Y7Ftt/);
    expect(r.getByTestId('tx-detail-to')).toHaveTextContent(/^Da83cA/); // the wallet, never the token account
    expect(r.getByTestId('tx-detail-to')).not.toHaveTextContent(/A3hWoQ/);
    expect(r.queryByText('Authorized by')).toBeNull();
    expect(r.queryByText('Fee payer')).toBeNull();
    expect(r.queryByTestId('tx-detail-changes')).toBeNull();
    expect(r.getByText('Save to address book')).toBeTruthy();
  });

  // D5 (R9)
  it('the same transaction opened from main reads "Received"; one\'s own account is not offered as a contact', () => {
    const r = screen('tx-test-to-main.json', MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Received');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.0002 TEST');
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent(/^9Y7Ftt/);
    expect(r.getByTestId('tx-detail-to')).toHaveTextContent(/^Da83cA/);
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  // D6
  it('the hero equals the #26 row for the same fixture and account', () => {
    const cases: Array<[string, string]> = [
      ['tx-test-to-main.json', MAIN],
      ['tx-sol-transfer.json', ACC_3],
      ['tx-deposit-3d31ATap.json', MAIN],
      ['tx-unshield-relayed-54J9kjQ8.json', ACC_3],
      ['tx-jupiter-token-to-sol-2FSgk4Ge.json', SELLER],
      ['tx-wrap-existing-33qVTEpP.json', WRAPPER],
    ];
    const {activityContext} = jest.requireMock('../../../modules/solana/activityContext') as {activityContext: () => ActivityContext};
    for (const [fixture, account] of cases) {
      const row = classifyActivity(load(fixture), account, 'confirmed', activityContext());
      const r = screen(fixture, account);
      expect(r.getByTestId('tx-detail-amount')).toHaveTextContent(heroAmount(row)!);
      r.unmount();
    }
  });

  // D7
  it('a third party, and no account (a deep link): "Transaction", no amount line, the fee payer, no contact', () => {
    for (const account of [OUTSIDE, null]) {
      const r = screen('tx-test-to-main.json', account);
      expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
      expect(r.queryByTestId('tx-detail-amount')).toBeNull();
      expect(r.queryByText('From')).toBeNull();
      expect(r.queryByText('To')).toBeNull();
      expect(r.getByText('Fee payer')).toBeTruthy();
      expect(r.queryByTestId('tx-detail-changes')).toBeNull();
      expect(r.queryByText('Save to address book')).toBeNull();
      r.unmount();
    }
  });

  // D8 — DERIVED from QAgzVzY6…: `meta.err` is set
  it('a failed transaction: "Failed", the Failed pill, no amount, no From / To', () => {
    const tx = load('tx-test-to-main.json');
    tx.meta!.err = {InstructionError: [2, 'Custom']};
    const r = screen(tx, ACC_2);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Failed');
    expect(r.queryByText('Sent')).toBeNull();
    expect(r.queryByTestId('tx-detail-amount')).toBeNull();
    expect(r.queryByText('From')).toBeNull();
    expect(r.getByText('Fee payer')).toBeTruthy();
  });

  // D9
  it('a swap (2FSgk4Ge…): "Swapped", "{out} {sym} → {in} {sym}", and the balance changes in place of From / To', () => {
    const r = screen('tx-jupiter-token-to-sol-2FSgk4Ge.json', SELLER);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Swapped');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('135435.988491 3gmFG4…pump → 0.00466848 SOL');
    expect(r.queryByText('From')).toBeNull();
    expect(r.getByText('Fee payer')).toBeTruthy();
    expect(r.getByText('Balance changes')).toBeTruthy();
    expect(changes(r)).toEqual(['−135435.988491 3gmFG4…pump', '+0.00466848 SOL']);
  });

  // D10
  it('a deposit (3d31ATap…): "Made private", the token; the rho rent is labelled', () => {
    const r = screen('tx-deposit-3d31ATap.json', MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Made private');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.0001 TEST');
    expect(changes(r)).toEqual(['−0.0001 TEST', '−0.00069596 SOL · account rent']);
    expect(r.queryByText('To')).toBeNull();
  });

  // D11
  it('the relayed unshield (54J9kjQ8…): "Made public", the token; the gas grant is labelled; the relayer is the fee payer', () => {
    const r = screen('tx-unshield-relayed-54J9kjQ8.json', ACC_3);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Made public');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.00001 TEST');
    expect(changes(r)).toEqual(['+0.00001 TEST', '+0.003 SOL · gas grant']);
    expect(r.queryByText('From')).toBeNull();
  });

  // D12
  it('a wrap (33qVTEpP…): "Wrapped SOL" and the SOL amount — never "Sent" to one\'s own token account', () => {
    const r = screen('tx-wrap-existing-33qVTEpP.json', WRAPPER);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Wrapped SOL');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('59.167663567 SOL');
    expect(r.queryByText('Save to address book')).toBeNull();
    expect(r.queryByText('To')).toBeNull();
  });

  // D13
  it("creating one's own token account (pXiTRFpg…): \"Transaction\", the rent as the amount and as a labelled change", () => {
    const r = screen('tx-ata-own-pXiTRFpg.json', 'BUpWiWy8Tqed4jy86dr7ZpoaE747DpQsrGnwmtpMwfBr');
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Transaction');
    expect(r.getByTestId('tx-detail-amount')).toHaveTextContent('0.00151384 SOL');
    expect(changes(r)).toEqual(['−0.00151384 SOL · account rent']);
  });
});

describe('From / To only when the transfer agrees with the row (§4.6, r2 N7)', () => {
  // D14 — DERIVED from 5i53q9tR…: a second recipient entry (another owner, +100) is added
  it('a send to two recipients shows no To: the fee payer and the balance changes instead', () => {
    const tx = load('tx-test-to-outside.json');
    const second = {accountIndex: 3, mint: TEST_MINT, owner: MAIN, uiTokenAmount: {amount: '0', decimals: 9}};
    tx.meta!.preTokenBalances!.push(second);
    tx.meta!.postTokenBalances!.push({...second, uiTokenAmount: {amount: '100', decimals: 9}});
    const r = screen(tx, ACC_2);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Sent');
    expect(r.queryByText('To')).toBeNull();
    expect(r.queryByText('From')).toBeNull();
    expect(r.getByText('Fee payer')).toBeTruthy();
    expect(changes(r)).toEqual(['−0.0005 TEST']);
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  // D15 — DERIVED from 5i53q9tR…: the recipient's entries lose their `owner` (R11)
  it('the recipient wallet unknown: a token account is never shown as To, and is not offered as a contact', () => {
    const tx = load('tx-test-to-outside.json');
    delete tx.meta!.preTokenBalances![1]!.owner;
    delete tx.meta!.postTokenBalances![1]!.owner;
    const r = screen(tx, ACC_2);
    expect(r.queryByText('To')).toBeNull();
    expect(r.queryByText('token account')).toBeNull();
    expect(changes(r)).toEqual(['−0.0005 TEST']);
    expect(r.queryByText('Save to address book')).toBeNull();
  });

  // D16 — DERIVED from QAgzVzY6…: the transfer's `authority` is another key (a delegate)
  it('a delegated transfer keeps From = the owner and adds "Authorized by" (27f)', () => {
    const DELEGATE = 'DLGTxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const tx = load('tx-test-to-main.json');
    const ix = (tx.transaction!.message!.instructions as Array<{parsed?: {type?: string; info?: Record<string, unknown>}}>).find(x => x.parsed?.type === 'transferChecked')!;
    ix.parsed!.info!.authority = DELEGATE;
    const r = screen(tx, MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Received');
    expect(r.getByTestId('tx-detail-from')).toHaveTextContent(/^9Y7Ftt/);
    expect(r.getByText('Authorized by')).toBeTruthy();
    expect(r.getByTestId('tx-detail-authority')).toHaveTextContent(/^DLGTxx/);
  });

  // D17 — DERIVED from QAgzVzY6…: the sender's entries lose their `owner` (the sender wallet is not named)
  it('a null From never shows "From —": the balance-changes form shows instead (r3 m-e)', () => {
    const tx = load('tx-test-to-main.json');
    delete tx.meta!.preTokenBalances![0]!.owner;
    delete tx.meta!.postTokenBalances![0]!.owner;
    const r = screen(tx, MAIN);
    expect(r.getByTestId('tx-detail-direction')).toHaveTextContent('Received');
    expect(r.queryByText('From')).toBeNull();
    expect(r.queryByText('Authorized by')).toBeNull();
    expect(changes(r)).toEqual(['+0.0002 TEST']);
  });
});

describe('"at today\'s price" (H7)', () => {
  // D18
  it('appears only with a price for the hero asset, and says whose price it is', () => {
    const none = screen('tx-sol-to-empty-2bGSoVSG.json', MAIN);
    expect(none.queryByTestId('tx-detail-usd')).toBeNull();
    none.unmount();
    mockPrices.current = {native: {usd: 150, change24h: null}};
    const priced = screen('tx-sol-to-empty-2bGSoVSG.json', MAIN); // 0.001 SOL
    expect(priced.getByTestId('tx-detail-usd')).toHaveTextContent("≈ $0.15 at today's price");
    priced.unmount();
    // a price for another asset is not this asset's
    const other = screen('tx-test-to-main.json', MAIN);
    expect(other.queryByTestId('tx-detail-usd')).toBeNull();
  });

  // D19
  it('a large value is grouped; a value under half a cent reads "<$0.01", never "$0.00"', () => {
    mockPrices.current = {native: {usd: 150, change24h: null}};
    const wrap = screen('tx-wrap-existing-33qVTEpP.json', WRAPPER);
    expect(wrap.getByTestId('tx-detail-usd')).toHaveTextContent("≈ $8,875.15 at today's price");
    wrap.unmount();
    const tiny = screen('tx-sol-transfer.json', ACC_3); // 0.000005 SOL
    expect(tiny.getByTestId('tx-detail-usd')).toHaveTextContent("≈ <$0.01 at today's price");
  });

  // D20
  it('no account: no price line (there is no hero amount)', () => {
    mockPrices.current = {native: {usd: 150, change24h: null}};
    expect(screen('tx-sol-to-empty-2bGSoVSG.json', null).queryByTestId('tx-detail-usd')).toBeNull();
  });
});
```

- [ ] **Step 2: Run them.**
      `npx jest src/hooks/__tests__/useParsedTx.test.tsx src/screens/transparent/__tests__/TransactionDetailScreen.test.tsx --forceExit`
      Expected: FAIL — `Cannot find module '../useParsedTx'` (the hook test), and
      `Cannot find module '../../../hooks/useParsedTx'` for the screen test's `jest.mock` of it.

- [ ] **Step 3: Create `src/hooks/useParsedTx.ts`:**

```ts
/**
 * History spec §4.6, §3.3: #27 reads the RAW parsed transaction from the same per-signature cache the
 * history fills (['parsedTx', cluster, signature]; never stale, kept 24 h), so a row opened from #26
 * costs no request. A transaction the node has not indexed yet is an error, not data — a null answer
 * is never cached — and is asked for again every 4 s until it is there.
 */
import {useQuery} from '@tanstack/react-query';
import {NETWORK} from '../constants/programs';
import {getConnection} from '../modules/solana/connection';
import {parsedTxKey, readParsedTransaction} from '../modules/solana/historyReads';
import type {RawParsedTx} from '../modules/solana/txDetail';

export const PARSED_TX_RETRY_MS = 4_000;

export function useParsedTx(signature: string | null): {raw: RawParsedTx | undefined; isLoading: boolean; notFound: boolean} {
  const query = useQuery<RawParsedTx>({
    queryKey: parsedTxKey(NETWORK, signature ?? ''),
    queryFn: async () => {
      const tx = signature ? await readParsedTransaction(getConnection(), NETWORK, signature) : null;
      if (tx === null) {
        throw new Error('transaction not indexed yet');
      }
      return tx;
    },
    enabled: !!signature,
    retry: false,
    // the app client's defaults for this key apply too; stated here so the hook is right under any client
    staleTime: Infinity,
    refetchInterval: q => (q.state.data ? false : PARSED_TX_RETRY_MS),
  });
  return {
    raw: query.data,
    isLoading: query.data === undefined && !query.isError,
    notFound: query.data === undefined && query.isError,
  };
}
```

- [ ] **Step 4: Replace the whole of `src/screens/transparent/TransactionDetailScreen.tsx` with:**

```tsx
import React from 'react';
import {
  View,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Linking,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Clipboard from '@react-native-clipboard/clipboard';
import {Check, X, Copy, ArrowLeft} from 'lucide-react-native';
import {Text, Button} from '../../components/ui';
import {useParsedTx} from '../../hooks/useParsedTx';
import {useResolvedPrices} from '../../hooks/useResolvedPrices';
import {formatChecksumParts} from '../../modules/solana/transferRisk';
import {formatAddress} from '../../utils/formatAddress';
import {formatTokenAmount} from '../../utils/parseTokenAmount';
import {formatUsdString} from '../../utils/formatUsd';
import {getExplorerUrl} from '../../utils/explorerUrl';
import {addressBook} from '../../modules/addressBook/addressBookModule';
import {cn} from '../../utils/cn';
import {NETWORK} from '../../constants/programs';
import {parseTxDetail} from '../../modules/solana/txDetail';
import {classifyActivity} from '../../modules/solana/activity';
import {activityContext} from '../../modules/solana/activityContext';
import {peekHistorySession} from '../../modules/solana/historySession';
import {activityWord, changeLine, heroAmount, partiesAgree, primaryUsdToday} from '../../modules/solana/activityView';
import {priceKeyFor} from '../../modules/prices/portfolio';
import {trustedSymbol} from '../../modules/tokens/trustedSymbol';
import {TX_FEE_PAYER, TX_AUTHORIZED_BY, TX_BALANCE_CHANGES, txAtTodaysPrice} from '../../copy/transactions';
import {BELOW_ONE_CENT} from '../../copy/accounts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Props {
  signature: string;
  /** R9: the account whose history or #21 opened this detail; null from a deep link */
  account: string | null;
  onBack: () => void;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ChecksumAddr({address}: {address: string}) {
  const {head, tail} = formatChecksumParts(address);
  return (
    <Text className="font-geist-mono text-[13px] text-fg-secondary text-right">
      <Text className="text-accent-transparent font-geist-semibold">{head}</Text>
      {tail ? (
        <>
          {'…'}
          <Text className="text-accent-transparent font-geist-semibold">{tail}</Text>
        </>
      ) : null}
    </Text>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  onCopy?: () => void;
}

function DetailRow({label, value, mono, onCopy}: DetailRowProps) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-3 border-b border-bg-surface-2 min-h-[48px]">
      <Text variant="overline" className="text-fg-secondary pt-0.5 shrink-0 pr-1">
        {label}
      </Text>
      <View className="flex-1 items-end">
        {typeof value === 'string' ? (
          <Text
            variant="body-sm"
            className={cn('text-right', mono ? 'font-geist-mono text-fg-secondary text-[13px]' : 'text-fg-primary')}
            numberOfLines={2}>
            {value}
          </Text>
        ) : (
          value
        )}
        {onCopy ? (
          <Pressable onPress={onCopy} className="flex-row items-center gap-1 mt-1">
            <Copy size={14} color="#B084FC" />
            <Text variant="caption" className="text-accent-transparent">
              Copy
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TransactionDetailScreen({signature, account, onBack}: Props) {
  // history spec §4.6: the raw transaction (the cache #26 fills), read twice — `parseTxDetail` for the rows PR 1
  // built, `classifyActivity` for the hero: what the transaction was for the account it was opened from
  const {raw, isLoading, notFound} = useParsedTx(signature);
  const tx = React.useMemo(() => (raw === undefined ? null : parseTxDetail(raw, signature, trustedSymbol)), [raw, signature]);
  const row = React.useMemo(() => {
    if (raw === undefined || account === null) {
      return null; // a deep link: no account, so nothing is claimed about a direction or an amount
    }
    // the history session's token accounts when one exists; otherwise (from #21, a deep link) none (r3 m-f)
    const own = peekHistorySession(NETWORK, account)?.tokenAccountSources;
    return classifyActivity(raw, account, raw.meta?.err ? 'failed' : 'confirmed', activityContext(own));
  }, [raw, account]);
  const transfer = tx?.transfer ?? null;
  const directionWord = activityWord(row);
  const hero = heroAmount(row);
  // From / To only when the transfer the parser read IS the row (§4.6); then both wallets are known
  const parties = transfer !== null && transfer.from !== null && partiesAgree(transfer, row, account) ? {...transfer, from: transfer.from} : null;
  const {prices} = useResolvedPrices();
  const usdToday = primaryUsdToday(row, mint => prices[priceKeyFor(mint)]?.usd ?? null);
  // a contact is a WALLET that is not this account: never a token account, never oneself
  const contactAddress = parties !== null && parties.to !== account ? parties.to : null;

  // ── Handlers ───────────────────────────────────────────────────────────────

  function handleCopySig() {
    try {
      Clipboard.setString(signature);
      setTimeout(() => Clipboard.setString(''), 30_000);
    } catch {
      // clipboard unavailable — no-op
    }
  }

  const [saved, setSaved] = React.useState(false);
  const alreadyContact = contactAddress !== null ? addressBook.findByAddress(contactAddress) != null : false;

  function handleSaveContact() {
    if (contactAddress === null) return;
    try {
      addressBook.addContact({
        name: formatAddress(contactAddress),
        address: contactAddress,
        addressType: 'transparent',
        lastUsedAt: Date.now(),
      });
      setSaved(true);
    } catch {
      // address book write failed — keep the button tappable
    }
  }

  // ── Derived display values ─────────────────────────────────────────────────

  const truncatedSig =
    signature.length > 16
      ? `${signature.slice(0, 8)}…${signature.slice(-8)}`
      : signature;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      {/* Top bar */}
      <View className="flex-row items-center px-4 py-3">
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Go back">
          <ArrowLeft size={22} color="#A8ACB5" />
        </Pressable>
        <Text variant="h2" className="ml-1">
          Transaction
        </Text>
      </View>

      {/* Loading state */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center gap-3">
          <ActivityIndicator size="large" color="#B084FC" />
          <Text variant="body-sm" className="text-fg-tertiary">
            Loading transaction…
          </Text>
        </View>
      ) : notFound || tx === null ? (
        /* Not-found state */
        <>
          <View className="flex-1 items-center justify-center px-6">
            <Text variant="body" className="text-fg-secondary text-center">
              Couldn't load this transaction
            </Text>
          </View>
          <View className="px-5 pb-4 gap-2">
            <Button
              label="View on explorer"
              variant="secondary"
              onPress={() => Linking.openURL(getExplorerUrl(signature)).catch(() => {})}
            />
            <Button label="Back" variant="primary" onPress={onBack} />
          </View>
        </>
      ) : (
        /* Ready state */
        <ScrollView contentContainerClassName="px-5 pb-4">
          {/* Amount card */}
          <View className="bg-bg-surface-1 rounded-2xl p-6 items-center mt-2">
            <Text variant="overline" className="text-fg-secondary" testID="tx-detail-direction">
              {directionWord}
            </Text>
            {/* §4.6: with no `primary` there is no amount line */}
            {hero !== null ? (
              <Text className="text-fg-primary font-geist-semibold mt-2 text-center" style={{fontSize: 28}} testID="tx-detail-amount">
                {hero}
              </Text>
            ) : null}
            {/* H7: only today's price is known — the line says so, and is absent with no price */}
            {usdToday !== null ? (
              <Text variant="body-sm" numeral className="text-fg-secondary mt-1" testID="tx-detail-usd">
                {txAtTodaysPrice(usdToday < 0.005 ? BELOW_ONE_CENT : formatUsdString(usdToday))}
              </Text>
            ) : null}

            {/* Status pill */}
            {tx.status === 'failed' ? (
              <View className="flex-row items-center gap-1 mt-3 px-3 py-1.5 rounded-pill bg-[rgba(248,113,113,0.14)]">
                <X size={12} color="#F87171" />
                <Text variant="caption" className="text-danger font-geist-semibold">
                  Failed
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center gap-1 mt-3 px-3 py-1.5 rounded-pill bg-[rgba(63,214,139,0.14)]">
                <Check size={12} color="#3FD68B" />
                <Text variant="caption" className="text-success font-geist-semibold">
                  Confirmed
                </Text>
              </View>
            )}
          </View>

          {/* Detail card */}
          <View className="bg-bg-surface-1 rounded-lg px-5 mt-4">
            <DetailRow label="Type" value={directionWord} />
            <DetailRow label="Status" value={tx.status[0].toUpperCase() + tx.status.slice(1)} />
            {parties !== null ? (
              <>
                <DetailRow
                  label="From"
                  value={
                    <View className="items-end" testID="tx-detail-from">
                      <ChecksumAddr address={parties.from} />
                    </View>
                  }
                />
                {/* review r1-10: a delegate is named apart (state 27f) */}
                {parties.authority !== null && parties.authority !== parties.from ? (
                  <DetailRow
                    label={TX_AUTHORIZED_BY}
                    value={
                      <View className="items-end" testID="tx-detail-authority">
                        <ChecksumAddr address={parties.authority} />
                      </View>
                    }
                  />
                ) : null}
                <DetailRow
                  label="To"
                  value={
                    <View className="items-end" testID="tx-detail-to">
                      <ChecksumAddr address={parties.to} />
                    </View>
                  }
                />
              </>
            ) : (
              <>
                <DetailRow label={TX_FEE_PAYER} value={<ChecksumAddr address={tx.feePayer} />} />
                {/* §4.6: every net change of this account, each with its role */}
                {row !== null && row.deltas.length > 0 ? (
                  <DetailRow
                    label={TX_BALANCE_CHANGES}
                    value={
                      <View className="items-end" testID="tx-detail-changes">
                        {row.deltas.map((d, k) => (
                          <Text key={`${d.role}-${d.mint}-${k}`} variant="body-sm" numeral className="text-fg-primary text-right" testID={`tx-detail-change-${k}`}>
                            {changeLine(d)}
                          </Text>
                        ))}
                      </View>
                    }
                  />
                ) : null}
              </>
            )}
            <DetailRow
              label="Hash"
              value={truncatedSig}
              mono
              onCopy={handleCopySig}
            />
            <DetailRow label="Block" value={String(tx.slot)} />
            <DetailRow
              label="Network fee"
              value={`${formatTokenAmount(tx.feeLamports, 9)} SOL`}
            />
            {tx.memo ? (
              <DetailRow label="Memo" value={tx.memo} />
            ) : null}
          </View>

          {/* Actions */}
          <View className="px-1 pt-4 gap-2">
            <Button
              label="View on explorer"
              variant="secondary"
              onPress={() => Linking.openURL(getExplorerUrl(signature)).catch(() => {})}
            />
            {contactAddress !== null ? (
              <Button
                label={saved || alreadyContact ? 'Saved to address book ✓' : 'Save to address book'}
                variant="primary"
                disabled={saved || alreadyContact}
                onPress={handleSaveContact}
              />
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Remove the hook the screen no longer uses** from `src/hooks/useSolanaQueries.ts`
      (`queries.ts` `getTransactionDetail` and its tests stay):

**Edit 1 of 2 — `src/hooks/useSolanaQueries.ts`. Find:**

```ts
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../modules/solana/connection';
import {getBalance, getTokenAccounts, getTransactionDetail} from '../modules/solana/queries';
import type {TokenAccount} from '../modules/solana/types';
import type {TxDetail} from '../modules/solana/queries';

/**
```

**Replace with:**

```ts
import {PublicKey} from '@solana/web3.js';
import {getConnection} from '../modules/solana/connection';
import {getBalance, getTokenAccounts} from '../modules/solana/queries';
import type {TokenAccount} from '../modules/solana/types';

/**
```

**Edit 2 of 2 — `src/hooks/useSolanaQueries.ts`. Find:**

```ts
}

/**
 * React Query hook for a single transaction detail.
 * Retries with 4s interval until the tx is indexed by RPC.
 */
export function useTransactionDetail(signature: string | null) {
  return useQuery<TxDetail | null>({
    queryKey: ['txDetail', signature],
    queryFn: async () => {
      if (!signature) return null;
      return getTransactionDetail(getConnection(), signature);
    },
    enabled: !!signature,
    // Retry every 4 s until the tx is indexed, then stop (a confirmed tx detail
    // does not change).
    refetchInterval: query => (query.state.data ? false : 4_000),
  });
}
```

**Replace with:**

```ts
}
```

- [ ] **Step 6: Run them.** The Step 2 command. Expected: PASS
      (4 + 20 tests). Then
      `grep -rn "useTransactionDetail\|useSolanaQueries'" src --include=*.tsx --include=*.ts | grep -v "useBalance\|useTokenAccounts"`
      — expected: no line names `useTransactionDetail`.

- [ ] **Step 7: The routes and the copy guards.**
      `npx jest src/app src/copy src/screens/shielded/__tests__/privacyClaims.test.ts src/screens/transparent --forceExit`
      Expected: PASS (#21's "View details" and the history row both still open the detail with
      `{signature, account}`).

- [ ] **Step 8: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/hooks/__tests__/useParsedTx.test.tsx src/screens/transparent/__tests__/TransactionDetailScreen.test.tsx --forceExit`.
      `lint:ci`: exactly `✖ 143 problems (0 errors, 143 warnings)`.

- [ ] **Step 9: Commit.**

```bash
git add src/hooks/useParsedTx.ts src/hooks/useSolanaQueries.ts src/screens/transparent/TransactionDetailScreen.tsx \
  src/hooks/__tests__/useParsedTx.test.tsx src/screens/transparent/__tests__/TransactionDetailScreen.test.tsx
git commit -m "feat(history): #27's hero is the history row; From / To only on agreement, else the balance changes"
```

---

### Task 9: The "linked" rule and the paged scan of one exit (pure, no storage)

Spec: §6.1 (the module), §6.2 (the rule, H4), §6.3 (sources, cursor, paging, cap), §8 "Link scan", §9.

**Files:**
- Create: `src/modules/accounts/linkScan.ts`
- Test: `src/modules/accounts/__tests__/linkScan.test.ts` (new)
- Reads: fixtures `tx-test-to-main.json`, `tx-test-to-outside.json`, `tx-test-acc4-to-main-2XgjNKS8.json`,
  `tx-unshield-relayed-54J9kjQ8.json` in `src/modules/solana/__tests__/fixtures/`

**Interfaces:**
- Consumes (Task 2): `keyString`, `RawParsedTx` from `src/modules/solana/txDetail`.
- Consumes (Task 3): `SignatureItem` (`{signature, slot, blockTime, status, finalized}`) from
  `src/modules/solana/historySession`.
- Produces, from `src/modules/accounts/linkScan.ts`:
  - `export const LINK_SCAN_PAGE = 20`, `LINK_SCAN_CAP = 300`
  - `export type LinkScanResult = 'linked' | 'clean' | 'failed'`
  - `export interface LinkScanDeps {listSources: (exit: string) => Promise<string[]>; fetchSignatures: (source: string, before: string | undefined, limit: number) => Promise<SignatureItem[]>; readTransactions: (signatures: string[]) => Promise<Map<string, RawParsedTx>>; getCursor: (exit: string, source: string) => string | undefined; setCursor: (exit: string, source: string, signature: string) => void; markLinked: (exit: string) => void}`
  - `export function transactionLinks(raw: RawParsedTx, exit: string, seedWallets: ReadonlySet<string>): boolean`
  - `export async function scanExitForLinks(exit: string, seedWallets: ReadonlySet<string>, deps: LinkScanDeps): Promise<LinkScanResult>`
    — never throws; calls `deps.markLinked(exit)` on a link.

**Why:**
- PR 1 writes the "linked" tag when #21 sees a confirmed Send between two of the seed's accounts. It misses links
  made before the tag existed, a Send whose confirmation the app never saw, and a Send that landed but failed
  (the chain shows both wallets either way). The scan reads the chain for them.
- An exit that RECEIVED tokens from another wallet of the seed into a token account that already existed is not an
  account key of that transaction — only the token balances name it as the owner. So both sides are matched through
  the keys AND the owners, and the exit's token accounts are scanned as sources.
- The cursor is the newest **finalized** signature scanned: a signature that is only confirmed can still be dropped
  by the cluster, and a cursor at a dropped signature would never be met again. `SignatureItem.finalized` carries
  that (its `status` is `'failed'` for a failed transaction, whatever its confirmation level).
- This task is the rule and the paging only. When it runs, where the cursors are stored and who is scanned is
  Task 10.

- [ ] **Step 1: Write the failing test.** Create `src/modules/accounts/__tests__/linkScan.test.ts`:

```ts
/**
 * History spec §6.2, §6.3, §8 "Link scan": the rule against REAL devnet responses (the fixtures of
 * modules/solana/__tests__), and the paging against scripted sources. A DERIVED case names what it
 * changed. No timers, no storage: every read and write is handed in.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {LINK_SCAN_CAP, scanExitForLinks, transactionLinks} from '../linkScan';
import type {LinkScanDeps} from '../linkScan';
import type {RawParsedTx} from '../../solana/txDetail';
import type {SignatureItem} from '../../solana/historySession';

const load = (name: string): RawParsedTx =>
  (JSON.parse(readFileSync(join(__dirname, '../../solana/__tests__/fixtures', name), 'utf8')) as {result: RawParsedTx}).result;

const MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
const ACC_2 = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const ACC_2_TA = '3WzwveDj8C6AGyiq5T13SeffM6HaP2zuc4rH1oW6QNu2';
const ACC_3 = '5H8T9XjLHXL3hUtHo5hKNvgHkWKny484GdVEVxg2rZF7';
const ACC_4 = 'AmeAwTLmadVu6ZvVQ3Y44svysj8sjXxL98mq6RcLnLuR';
const seedWithout = (exit: string): Set<string> => new Set([MAIN, ACC_2, ACC_3, ACC_4].filter(a => a !== exit));

describe('transactionLinks (§6.2)', () => {
  // L1
  it('positive: QAgzVzY6… (Account 2 → main) links Account 2 — main is not a key, only an owner in the token balances', () => {
    expect(transactionLinks(load('tx-test-to-main.json'), ACC_2, seedWithout(ACC_2))).toBe(true);
  });

  // L2
  it('positive: 2XgjNKS8… (Account 4 → main) links Account 4', () => {
    expect(transactionLinks(load('tx-test-acc4-to-main-2XgjNKS8.json'), ACC_4, seedWithout(ACC_4))).toBe(true);
  });

  // L3
  it('negative: 54J9kjQ8… (the relayed Make public into Account 3) does not link Account 3', () => {
    expect(transactionLinks(load('tx-unshield-relayed-54J9kjQ8.json'), ACC_3, seedWithout(ACC_3))).toBe(false);
  });

  // L4
  it('negative: a send to an outside wallet (5i53q9tR…), and a transaction the exit is not in', () => {
    expect(transactionLinks(load('tx-test-to-outside.json'), ACC_2, seedWithout(ACC_2))).toBe(false);
    expect(transactionLinks(load('tx-test-acc4-to-main-2XgjNKS8.json'), ACC_2, seedWithout(ACC_2))).toBe(false);
  });

  // L5 — the real 2XgjNKS8… (a seed wallet sends into ANOTHER seed wallet's existing token account) read with the
  // RECIPIENT as the exit: the scanned wallet (Da83cA…) is absent from the account keys and present only as the owner
  // of the destination token account. No devnet transaction has an exit on that side yet; the shape is the same.
  it("positive: a seed wallet sends into the exit's EXISTING token account — the exit is absent from the keys", () => {
    const tx = load('tx-test-acc4-to-main-2XgjNKS8.json');
    const keys = tx.transaction!.message!.accountKeys!.map(k => k.pubkey);
    expect(keys).not.toContain(MAIN);
    expect(transactionLinks(tx, MAIN, new Set([ACC_4]))).toBe(true);
  });

  // L6 — DERIVED from QAgzVzY6…: `meta.err` is set
  it('a FAILED transaction with both sides links: it is public too', () => {
    const tx = load('tx-test-to-main.json');
    tx.meta!.err = {InstructionError: [2, 'Custom']};
    expect(transactionLinks(tx, ACC_2, seedWithout(ACC_2))).toBe(true);
  });

  // L7
  it('the exit itself is never its own other side, even if the caller left it in the set', () => {
    expect(transactionLinks(load('tx-test-to-outside.json'), ACC_2, new Set([ACC_2]))).toBe(false);
  });

  // L8 — DERIVED from QAgzVzY6…: the account keys are PublicKey-like objects, as web3.js hands them over
  it('reads account keys that are objects with toString()', () => {
    const tx = load('tx-test-to-main.json');
    tx.transaction!.message!.accountKeys = tx.transaction!.message!.accountKeys!.map(k => ({...k, pubkey: {toString: () => String(k.pubkey)}}));
    expect(transactionLinks(tx, ACC_2, seedWithout(ACC_2))).toBe(true);
  });
});

// ── the paging, against scripted sources ────────────────────────────────────────────────────────────

const LINKING = load('tx-test-to-main.json'); // links ACC_2 with main
const CLEAN = load('tx-test-to-outside.json'); // ACC_2 → an outside wallet
const sig = (signature: string, finalized = true): SignatureItem => ({signature, slot: 1, blockTime: 1, status: finalized ? 'finalized' : 'confirmed', finalized});
const run = (name: string, n: number): SignatureItem[] => Array.from({length: n}, (_, k) => sig(`${name}${k + 1}`));

function chain(sources: Record<string, SignatureItem[]>) {
  const world = {
    sources,
    cursors: {} as Record<string, string>,
    linking: new Set<string>(),
    unreadable: new Set<string>(),
    failSource: null as string | null,
    marked: [] as string[],
    fetched: [] as Array<{source: string; before: string | undefined}>,
    readCount: 0,
  };
  const deps: LinkScanDeps = {
    listSources: async () => Object.keys(world.sources),
    fetchSignatures: async (source, before, limit) => {
      world.fetched.push({source, before});
      if (world.failSource === source) {
        throw new Error('rpc down');
      }
      const all = world.sources[source]!;
      const from = before === undefined ? 0 : all.findIndex(x => x.signature === before) + 1;
      return all.slice(from, from + limit);
    },
    readTransactions: async signatures => {
      world.readCount += signatures.length;
      const out = new Map<string, RawParsedTx>();
      for (const s of signatures) {
        if (!world.unreadable.has(s)) {
          out.set(s, world.linking.has(s) ? LINKING : CLEAN);
        }
      }
      return out;
    },
    getCursor: (exit, source) => world.cursors[`${exit}/${source}`],
    setCursor: (exit, source, signature) => {
      world.cursors[`${exit}/${source}`] = signature;
    },
    markLinked: exit => {
      world.marked.push(exit);
    },
  };
  return {world, deps};
}
const scan = (deps: LinkScanDeps) => scanExitForLinks(ACC_2, seedWithout(ACC_2), deps);

describe('scanExitForLinks (§6.3)', () => {
  // L9
  it('150 new signatures with the link at the 120th are found by `before` paging; the exit is marked, no cursor is written', async () => {
    const all = run('s', 150);
    const {world, deps} = chain({[ACC_2]: all});
    world.linking.add('s120');
    expect(await scan(deps)).toBe('linked');
    expect(world.marked).toEqual([ACC_2]);
    expect(world.fetched.map(f => f.before)).toEqual([undefined, 's20', 's40', 's60', 's80', 's100']);
    expect(world.cursors).toEqual({});
    expect(world.marked).not.toContain(MAIN); // main is never passed to markLinked
  });

  // L10
  it('a clean source moves its cursor to the newest FINALIZED signature read; the next scan reads only what is above it', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 45)});
    expect(await scan(deps)).toBe('clean');
    expect(world.marked).toEqual([]);
    expect(world.cursors).toEqual({[`${ACC_2}/${ACC_2}`]: 's1'});
    expect(world.readCount).toBe(45);
    // two new signatures arrive
    world.sources[ACC_2] = [sig('n2'), sig('n1'), ...world.sources[ACC_2]!];
    world.readCount = 0;
    world.fetched.length = 0;
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(2); // matched by value at the cursor: nothing below it is read again
    expect(world.fetched).toHaveLength(1);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('n2');
  });

  // L11
  it('a confirmed-only signature is scanned but never becomes the cursor', async () => {
    const {world, deps} = chain({[ACC_2]: [sig('c2', false), sig('c1', false), sig('f1'), sig('f0')]});
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(4);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('f1');
    // nothing finalized at all: no cursor is written
    const young = chain({[ACC_2]: [sig('c2', false), sig('c1', false)]});
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), young.deps)).toBe('clean');
    expect(young.world.cursors).toEqual({});
  });

  // L12
  it('a transaction that cannot be read → failed, and that source\'s cursor is unmoved', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 5)});
    world.cursors[`${ACC_2}/${ACC_2}`] = 's5';
    world.unreadable.add('s3');
    expect(await scan(deps)).toBe('failed');
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s5');
    expect(world.marked).toEqual([]);
  });

  // L13
  it('an unreadable transaction does not hide a link further down the same source', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 30)});
    world.unreadable.add('s2');
    world.linking.add('s25');
    expect(await scan(deps)).toBe('linked');
    expect(world.marked).toEqual([ACC_2]);
  });

  // L14
  it('a failed source does not stop the others: a link in the token-account source is still found', async () => {
    const {world, deps} = chain({[ACC_2]: run('w', 3), [ACC_2_TA]: run('t', 3)});
    world.failSource = ACC_2;
    world.linking.add('t2');
    expect(await scan(deps)).toBe('linked');
    // with no link anywhere the result is failed, and only the readable source's cursor moves
    const second = chain({[ACC_2]: run('w', 3), [ACC_2_TA]: run('t', 3)});
    second.world.failSource = ACC_2;
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), second.deps)).toBe('failed');
    expect(second.world.cursors).toEqual({[`${ACC_2}/${ACC_2_TA}`]: 't1'});
  });

  // L15 (r2 m6, r3 m-d)
  it('the cap: at most 300 signatures per source per scan, first or later; the cursor is still set', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 400)});
    world.linking.add('s350'); // beyond the cap: not found (spec §9)
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(LINK_SCAN_CAP);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s1');
    // a LATER scan with more than 300 new signatures above the cursor is capped the same way
    world.sources[ACC_2] = [...run('n', 320), ...world.sources[ACC_2]!];
    world.readCount = 0;
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(LINK_SCAN_CAP);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('n1');
  });

  // L16
  it('an empty source, and a source list that cannot be read', async () => {
    const empty = chain({[ACC_2]: []});
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), empty.deps)).toBe('clean');
    expect(empty.world.cursors).toEqual({});
    const {deps} = chain({[ACC_2]: run('s', 2)});
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), {...deps, listSources: async () => { throw new Error('rpc down'); }})).toBe('failed');
  });

  // L17
  it('a cursor that is no longer in the list (pruned history) reads to the end or the cap, never forever', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 30)});
    world.cursors[`${ACC_2}/${ACC_2}`] = 'gone';
    expect(await scan(deps)).toBe('clean');
    expect(world.readCount).toBe(30);
    expect(world.cursors[`${ACC_2}/${ACC_2}`]).toBe('s1');
  });

  // L18
  it('a registry that cannot be written reports failed: the next scan finds the link again', async () => {
    const {world, deps} = chain({[ACC_2]: run('s', 2)});
    world.linking.add('s1');
    expect(await scanExitForLinks(ACC_2, seedWithout(ACC_2), {...deps, markLinked: () => { throw new Error('locked'); }})).toBe('failed');
    expect(world.cursors).toEqual({});
  });
});
```

- [ ] **Step 2: Run it.** `npx jest src/modules/accounts/__tests__/linkScan.test.ts --forceExit`
      Expected: FAIL — `Cannot find module '../linkScan'`.

- [ ] **Step 3: Create `src/modules/accounts/linkScan.ts`:**

```ts
/**
 * History spec (2026-11-26) §6: the retroactive "linked" scan. An exit account is LINKED when one
 * transaction holds both it and another wallet of this seed (H4) — whichever way the funds went, and
 * whether or not the transaction succeeded. The tag is written by `markLinked` and is never removed.
 *
 * WHY TOKEN ACCOUNTS: a transfer into an existing token account does not list the owner wallet, so
 * both sides are also matched through the owners named in the token balances, and an exit is scanned
 * through its own address AND every token account it owns (§6.3).
 *
 * THE TAG IS A LOWER BOUND (§9): it reads at most LINK_SCAN_CAP signatures per source per scan, and
 * only the token accounts the exit owns now. A third party can put two wallets of one seed into one
 * transaction (dust); the tag then errs on the warning side.
 *
 * THE CURSOR, per exit and source: the newest FINALIZED signature fully scanned. A signature that is
 * only confirmed is scanned but never becomes the cursor (it could still be dropped), so it is
 * scanned again. Nothing moves when a transaction could not be read.
 *
 * Pure: every read and every write is handed in (`LinkScanDeps`).
 */
import {keyString} from '../solana/txDetail';
import type {RawParsedTx} from '../solana/txDetail';
import type {SignatureItem} from '../solana/historySession';

export const LINK_SCAN_PAGE = 20;
/** §6.3: every scan of a source, first or later, reads at most this many signatures */
export const LINK_SCAN_CAP = 300;

export type LinkScanResult = 'linked' | 'clean' | 'failed';

export interface LinkScanDeps {
  /** the exit wallet and every token account it owns (classic and Token-2022) */
  listSources: (exit: string) => Promise<string[]>;
  /** newest first; `before` undefined reads from the head */
  fetchSignatures: (source: string, before: string | undefined, limit: number) => Promise<SignatureItem[]>;
  /** a signature absent from the answer could not be read (null from the node, or a failed read) */
  readTransactions: (signatures: string[]) => Promise<Map<string, RawParsedTx>>;
  getCursor: (exit: string, source: string) => string | undefined;
  setCursor: (exit: string, source: string, signature: string) => void;
  /** tags fresh-exit entries only — never the main account */
  markLinked: (exit: string) => void;
}

/**
 * §6.2. True when the transaction's account keys (the full list) hold BOTH the exit — or a token
 * account whose owner in the token balances is the exit — AND a wallet of `seedWallets` — or a token
 * account owned by one. `meta.err` is not consulted: a failed transaction is public too.
 */
export function transactionLinks(raw: RawParsedTx, exit: string, seedWallets: ReadonlySet<string>): boolean {
  const present = new Set((raw.transaction?.message?.accountKeys ?? []).map(k => keyString(k.pubkey)));
  for (const b of [...(raw.meta?.preTokenBalances ?? []), ...(raw.meta?.postTokenBalances ?? [])]) {
    if (typeof b.owner === 'string' && b.owner !== '') {
      present.add(b.owner);
    }
  }
  if (!present.has(exit)) {
    return false;
  }
  for (const wallet of seedWallets) {
    if (wallet !== exit && present.has(wallet)) {
      return true;
    }
  }
  return false;
}

async function scanSource(exit: string, source: string, seedWallets: ReadonlySet<string>, deps: LinkScanDeps): Promise<LinkScanResult> {
  const cursor = deps.getCursor(exit, source);
  let before: string | undefined;
  let read = 0;
  let newestFinalized: string | undefined;
  let unread = false;
  for (;;) {
    const page = await deps.fetchSignatures(source, before, LINK_SCAN_PAGE);
    // the cursor is matched by value (not `until`): everything above it is new
    const at = cursor === undefined ? -1 : page.findIndex(x => x.signature === cursor);
    const fresh = (at >= 0 ? page.slice(0, at) : page).slice(0, LINK_SCAN_CAP - read);
    if (fresh.length > 0) {
      const txs = await deps.readTransactions(fresh.map(x => x.signature));
      for (const item of fresh) {
        const raw = txs.get(item.signature);
        if (raw === undefined) {
          unread = true; // keep looking for a link, but this source's cursor will not move
        } else if (transactionLinks(raw, exit, seedWallets)) {
          return 'linked';
        }
      }
      newestFinalized = newestFinalized ?? fresh.find(x => x.finalized)?.signature;
      read += fresh.length;
    }
    if (at >= 0 || page.length < LINK_SCAN_PAGE || read >= LINK_SCAN_CAP) {
      break;
    }
    before = page[page.length - 1]!.signature;
  }
  if (unread) {
    return 'failed';
  }
  // also when the cap stopped the scan: older history is not scanned (§9)
  if (newestFinalized !== undefined) {
    deps.setCursor(exit, source, newestFinalized);
  }
  return 'clean';
}

/**
 * §6.3: scan one exit. A link → `markLinked(exit)` and 'linked' (no cursor is needed after a link).
 * A source that fails does not stop the others — a link may still be found there — but the result is
 * then 'failed' and that source's cursor stays where it was. Never throws.
 */
export async function scanExitForLinks(exit: string, seedWallets: ReadonlySet<string>, deps: LinkScanDeps): Promise<LinkScanResult> {
  let sources: string[];
  try {
    sources = await deps.listSources(exit);
  } catch {
    return 'failed';
  }
  let failed = false;
  for (const source of sources) {
    let outcome: LinkScanResult;
    try {
      outcome = await scanSource(exit, source, seedWallets, deps);
    } catch {
      outcome = 'failed';
    }
    if (outcome === 'linked') {
      try {
        deps.markLinked(exit);
      } catch {
        return 'failed'; // the registry could not be written: the next scan finds the link again
      }
      return 'linked';
    }
    if (outcome === 'failed') {
      failed = true;
    }
  }
  return failed ? 'failed' : 'clean';
}
```

- [ ] **Step 4: Run it.** The Step 2 command. Expected: PASS (18 tests).

- [ ] **Step 5: Prove two tests are tests (mutation, by hand).** Make each change in `linkScan.ts`, run the Step 2
      command, see a test FAIL, undo:
  - in `transactionLinks`, delete the loop that adds the token-balance owners to `present` (L1 and L5 must fail:
    main is not an account key);
  - `fresh.find(x => x.finalized)` → `fresh[0]` (L11 must fail: a confirmed-only signature becomes the cursor).

- [ ] **Step 6: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/modules/accounts/__tests__/linkScan.test.ts --forceExit`.

- [ ] **Step 7: Commit.**

```bash
git add src/modules/accounts/linkScan.ts src/modules/accounts/__tests__/linkScan.test.ts
git commit -m "feat(accounts): the linked rule and the paged scan of one exit, down to a finalized cursor"
```

---

### Task 10: The scan runs when the Accounts sheet opens — single-flight, interval, generation, cursors

Spec: §6.1 (who is scanned, `seedWallets`), §6.3 (the cursor's storage), §6.4 (all of it), H5, §8 "Link scan"
(generation guard, single-flight, minimum interval, main never tagged); Review Focus 3.

**Files:**
- Modify: `src/constants/mmkvKeys.ts:52` (after `ACCOUNTS_LINK_PENDING`)
- Create: `src/modules/accounts/linkScanRunner.ts`
- Modify: `src/screens/dashboard/DashboardScreen.tsx:46` (imports), `:261-271` (`openAccounts`)
- Test: `src/modules/accounts/__tests__/linkScanRunner.test.ts` (new),
  `src/screens/dashboard/__tests__/DashboardScreen.test.tsx` (two insertions)

**Interfaces:**
- Consumes (Task 9): `scanExitForLinks(exit, seedWallets, deps)`, `LinkScanResult`, `LinkScanDeps` from `./linkScan`.
- Consumes (Task 4): `getSignaturePage(connection, cluster, source, before, limit)`,
  `readParsedTransactions(connection, client, cluster, signatures)` from `src/modules/solana/historyReads`;
  `getTokenAccounts`, `getToken2022Accounts` from `src/modules/solana/queries`.
- Consumes (Task 6): the app's `queryClient` from `src/app/queryClient` (the shared `parsedTx` cache).
- Consumes (existing): `mmkvSecure()`, `onSecureMmkvReset(hook)` (`src/store/mmkv/instances`);
  `markA0AccountsLinked(addresses: readonly string[], options?: {bound?: MMKV | null}): number` — tags `fresh-exit`
  entries only, never `main` (`src/modules/shielded/a0/accountRegistry.ts`); `readAccountList(mainAddress): AccountList`
  and `refreshAccounts(mainAddress)` (`src/modules/accounts/selectedAccount.ts`); `AccountList`
  (`{accounts: WalletAccount[]; seed: {address, role}[]; walletKind; unreadable}`), `WalletAccount.role: 'main' | 'fresh-exit'`,
  `.linked: boolean`; `drainLinkQueue()` (`src/modules/accounts/linkQueue.ts`).
- Produces, from `src/constants/mmkvKeys.ts`: `MMKV_KEYS.LINK_SCAN_CURSORS = 'v1_linkScanCursors'`.
- Produces, from `src/modules/accounts/linkScanRunner.ts`:
  - `export const LINK_SCAN_MIN_INTERVAL_MS = 60_000`
  - `export interface LinkScanRunnerEnv {accounts: () => AccountList | null; scanExit: (exit: string, seedWallets: ReadonlySet<string>, live: () => boolean) => Promise<LinkScanResult>; now: () => number; onLinked: () => void}`
  - `export function runLinkScans(env: LinkScanRunnerEnv): Promise<number>` (never rejects)
  - `export function readLinkScanCursor(store: MMKV, exit: string, source: string): string | undefined`,
    `writeLinkScanCursor(store: MMKV, exit: string, source: string, signature: string): void`
  - `export async function linkScanSources(connection: Connection, exit: string): Promise<string[]>`
  - `export function scanLinksForWallet(mainAddress: string | null, client: QueryClient): Promise<number>` (never rejects)

**Why:**
- The scan must not slow the sheet: it is started and not awaited; a tag that is found re-reads the account list
  (`refreshAccounts`), which the sheet shows by itself.
- The cursors name one's own accounts and their token accounts — a list like that is itself a link, so it lives in
  the ENCRYPTED instance only, like `ACCOUNTS_LINK_PENDING`. A wipe removes it with the store. (`onSecureMmkvReset`
  fires on every open of the store too, so the hook must NOT delete the stored cursors — it resets only the
  in-memory state: the generation, the in-flight scan, the interval. Ruling 9.)
- A scan can outlive its wallet (wipe + import in one process). Its tag and cursor writes are dropped twice over:
  the generation the scan captured no longer matches, and the encrypted instance it captured is no longer the
  open one (`markA0AccountsLinked` would also refuse a `bound` that is not the open store).
- Hook registration happens on first use, not at import — a screen test that stubs `instances` loads this module
  too (the pattern of `linkQueue.ts`).
- `DashboardScreen` already reads `publicKey` from `useWalletStore()` — that is the MAIN account whichever account
  is selected (M1d), which is what `scanLinksForWallet` needs.

- [ ] **Step 1: Write the failing tests.** Create `src/modules/accounts/__tests__/linkScanRunner.test.ts`:

```ts
/**
 * History spec §6.4, §8 "Link scan": when the scan runs — single-flight, the 60 s interval, the
 * generation guard — and its storage (the cursors, encrypted instance only). The scan itself is
 * scripted here (linkScan.test.ts pins it); the registry and the store are real. Real timers only.
 */
import {readFileSync} from 'fs';
import {join} from 'path';
import {QueryClient} from '@tanstack/react-query';
import {clearAllStores, initSecureMmkv, mmkvPublic, mmkvSecure} from '../../../store/mmkv/instances';
import {MMKV_KEYS} from '../../../constants/mmkvKeys';
import {storeTransparentScheme} from '../../keyDerivation/derivationScheme';
import {loadA0AccountRegistry} from '../../shielded/a0/accountRegistry';
import {
  LINK_SCAN_MIN_INTERVAL_MS,
  readLinkScanCursor,
  runLinkScans,
  scanLinksForWallet,
  writeLinkScanCursor,
} from '../linkScanRunner';
import type {LinkScanRunnerEnv} from '../linkScanRunner';
import type {AccountList, WalletAccount} from '../accountList';
import type {LinkScanResult} from '../linkScan';

// the chain behind scanLinksForWallet, scripted per test
const mockChain: {signatures: Record<string, unknown[]>; transactions: Record<string, unknown>} = {signatures: {}, transactions: {}};
const mockConnection = {
  getParsedTokenAccountsByOwner: jest.fn(async () => ({value: []})),
  getSignaturesForAddress: jest.fn(async (address: {toBase58: () => string}) => mockChain.signatures[address.toBase58()] ?? []),
  getParsedTransactions: jest.fn(async (signatures: string[]) => signatures.map(s => mockChain.transactions[s] ?? null)),
  getParsedTransaction: jest.fn(async () => null),
};
jest.mock('../../solana/connection', () => ({getConnection: () => mockConnection}));

const MAIN = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const A1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const A3 = '3YqEpfo3c818GhvbQ1UmVY1nJxw16vtu4JB9peJXT94k';
const A4 = 'E48cosDiQZK1iDSsyUzhvW4WxJeoKuDk5qgcdkmANV4N';
const REG = 'v1_accounts';

const account = (n: number, address: string, role: 'main' | 'fresh-exit', linked = false): WalletAccount => ({
  scheme: `slip10:${n}`, address, label: `Account ${n + 1}`, number: n + 1, role, isMain: role === 'main', linked,
});
const listOf = (accounts: WalletAccount[], extraSeed: string[] = [], unreadable = false): AccountList => ({
  accounts,
  seed: [...accounts.map(a => ({address: a.address, role: a.role})), ...extraSeed.map(address => ({address, role: 'fresh-pending' as const}))],
  walletKind: 'slip10',
  unreadable,
});

function env(list: AccountList | null, results: Record<string, LinkScanResult> = {}) {
  const calls: Array<{exit: string; seedWallets: string[]}> = [];
  const state = {now: 1_000_000, linked: 0};
  const e: LinkScanRunnerEnv = {
    accounts: () => list,
    now: () => state.now,
    onLinked: () => {
      state.linked += 1;
    },
    scanExit: async (exit, seedWallets) => {
      calls.push({exit, seedWallets: [...seedWallets].sort()});
      return results[exit] ?? 'clean';
    },
  };
  return {e, calls, state};
}

beforeEach(() => {
  clearAllStores(); // fires the reset hook: the runner's in-memory state (interval, in-flight) starts over
  initSecureMmkv('test-key');
  storeTransparentScheme({kind: 'slip10', account: 0});
});

it('the key is v1_linkScanCursors', () => {
  expect(MMKV_KEYS.LINK_SCAN_CURSORS).toBe('v1_linkScanCursors');
});

describe('runLinkScans (§6.4)', () => {
  // N1 (§6.1)
  it('scans every fresh-exit that is not tagged yet — never main, never a tagged one; seedWallets is every other address of the seed', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit'), account(4, A4, 'fresh-exit', true)], [A1]);
    const {e, calls} = env(list);
    expect(await runLinkScans(e)).toBe(0);
    expect(calls).toEqual([{exit: A3, seedWallets: [A4, MAIN, A1].sort()}]); // the fresh-pending A1 is a seed wallet too
  });

  // N2
  it('a hit counts, calls onLinked, and the others are still scanned', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit'), account(4, A4, 'fresh-exit')]);
    const {e, calls, state} = env(list, {[A3]: 'linked', [A4]: 'failed'});
    expect(await runLinkScans(e)).toBe(1);
    expect(calls.map(c => c.exit)).toEqual([A3, A4]);
    expect(state.linked).toBe(1);
  });

  // N3
  it('an unreadable list, no list, and a scan that throws: nothing is tagged and nothing is thrown', async () => {
    expect(await runLinkScans(env(listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit')], [], true)).e)).toBe(0);
    expect(await runLinkScans(env(null).e)).toBe(0);
    const {e} = env(listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit')]));
    e.scanExit = async () => {
      throw new Error('boom');
    };
    await expect(runLinkScans(e)).resolves.toBe(0);
  });

  // N4
  it('single-flight: an open while a scan runs joins it', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit')]);
    const {e, calls} = env(list);
    let release: (r: LinkScanResult) => void = () => undefined;
    e.scanExit = (exit, seedWallets) => {
      calls.push({exit, seedWallets: [...seedWallets]});
      return new Promise<LinkScanResult>(r => {
        release = r;
      });
    };
    const first = runLinkScans(e);
    const second = runLinkScans(e);
    expect(second).toBe(first);
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    release('linked');
    expect(await first).toBe(1);
  });

  // N5
  it('the minimum interval: an exit is not scanned again within 60 s; it is after', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit')]);
    const {e, calls, state} = env(list);
    await runLinkScans(e);
    state.now += LINK_SCAN_MIN_INTERVAL_MS - 1;
    await runLinkScans(e);
    expect(calls).toHaveLength(1);
    state.now += 1;
    await runLinkScans(e);
    expect(calls).toHaveLength(2);
    // a clock that went backwards never blocks a scan forever
    state.now -= 10 * LINK_SCAN_MIN_INTERVAL_MS;
    await runLinkScans(e);
    expect(calls).toHaveLength(3);
  });

  // N6
  it('the generation guard: a wipe while a scan runs makes `live()` false, drops its result, and frees the next scan', async () => {
    const list = listOf([account(0, MAIN, 'main'), account(3, A3, 'fresh-exit'), account(4, A4, 'fresh-exit')]);
    const {e, calls, state} = env(list);
    let release: (r: LinkScanResult) => void = () => undefined;
    let liveSeen: (() => boolean) | null = null;
    e.scanExit = (exit, _seed, live) => {
      calls.push({exit, seedWallets: []});
      liveSeen = live;
      return new Promise<LinkScanResult>(r => {
        release = r;
      });
    };
    const old = runLinkScans(e);
    await Promise.resolve();
    expect(liveSeen!()).toBe(true);
    clearAllStores(); // the wallet is gone
    expect(liveSeen!()).toBe(false);
    // the new wallet's open is not joined to the old scan, and its interval starts over
    const fresh = env(list);
    const next = runLinkScans(fresh.e);
    expect(next).not.toBe(old);
    release('linked');
    expect(await old).toBe(0); // the old result is dropped: no tag counted, no onLinked, the second exit not scanned
    expect(state.linked).toBe(0);
    expect(calls.map(c => c.exit)).toEqual([A3]);
    await next;
    expect(fresh.calls.map(c => c.exit)).toEqual([A3, A4]);
  });
});

describe('the cursors (§6.3)', () => {
  // N7
  it('are stored per exit and source in the ENCRYPTED instance, and survive a malformed record', () => {
    const store = mmkvSecure()!;
    expect(readLinkScanCursor(store, A3, 'src1')).toBeUndefined();
    writeLinkScanCursor(store, A3, 'src1', 'sigA');
    writeLinkScanCursor(store, A3, 'src2', 'sigB');
    writeLinkScanCursor(store, A4, 'src1', 'sigC');
    expect(JSON.parse(store.getString('v1_linkScanCursors')!)).toEqual({[A3]: {src1: 'sigA', src2: 'sigB'}, [A4]: {src1: 'sigC'}});
    expect(readLinkScanCursor(store, A3, 'src2')).toBe('sigB');
    expect(mmkvPublic.getString('v1_linkScanCursors')).toBeUndefined();
    store.set('v1_linkScanCursors', '{not json');
    expect(readLinkScanCursor(store, A3, 'src1')).toBeUndefined();
    writeLinkScanCursor(store, A3, 'src1', 'sigD');
    expect(readLinkScanCursor(store, A3, 'src1')).toBe('sigD');
  });

  // N8
  it('a wipe removes them with the store', () => {
    writeLinkScanCursor(mmkvSecure()!, A3, 'src1', 'sigA');
    clearAllStores();
    initSecureMmkv('another-wallet');
    expect(readLinkScanCursor(mmkvSecure()!, A3, 'src1')).toBeUndefined();
  });
});

describe('scanLinksForWallet', () => {
  // N9
  it('with the encrypted store closed, or no wallet, nothing is read', async () => {
    clearAllStores();
    expect(await scanLinksForWallet(MAIN, {} as never)).toBe(0);
    initSecureMmkv('test-key');
    expect(await scanLinksForWallet(null, {} as never)).toBe(0);
  });

  // N10
  it('with no exit to scan it resolves 0 without touching the registry', async () => {
    mmkvSecure()!.set(REG, JSON.stringify({schema: 1, accounts: [{scheme: 'slip10:0', role: 'main', address: MAIN}]}));
    expect(await scanLinksForWallet(MAIN, {} as never)).toBe(0);
    expect(loadA0AccountRegistry()![0]!.linked).toBeUndefined();
  });

  // the real devnet pair of fixture QAgzVzY6…: main Da83cA…, Account 2 (an exit) 9Y7Ftt…
  const DEV_MAIN = 'Da83cAfGUrsm896FUghCkNKutgFc96WNGWN73bZxe31B';
  const DEV_EXIT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
  const fixture = (name: string): unknown =>
    (JSON.parse(readFileSync(join(__dirname, '../../solana/__tests__/fixtures', name), 'utf8')) as {result: unknown}).result;
  const finalized = (signature: string) => ({signature, slot: 9, blockTime: 9, confirmationStatus: 'finalized', err: null});
  const devRegistry = (): void =>
    mmkvSecure()!.set(
      REG,
      JSON.stringify({
        schema: 1,
        accounts: [
          {scheme: 'slip10:0', role: 'main', address: DEV_MAIN},
          {scheme: 'slip10:1', role: 'fresh-exit', address: DEV_EXIT},
        ],
      }),
    );
  const exitEntry = () => loadA0AccountRegistry()!.find(x => x.address === DEV_EXIT)!;

  // N11
  it('end to end: a link on chain tags the exit in the registry — and never main', async () => {
    devRegistry();
    mockChain.signatures = {[DEV_EXIT]: [finalized('QAgz')]};
    mockChain.transactions = {QAgz: fixture('tx-test-to-main.json')};
    const client = new QueryClient();
    expect(await scanLinksForWallet(DEV_MAIN, client)).toBe(1);
    expect(exitEntry().linked).toBe(true);
    expect(loadA0AccountRegistry()!.find(x => x.address === DEV_MAIN)!.linked).toBeUndefined();
    expect(mmkvSecure()!.getString('v1_linkScanCursors')).toBeUndefined(); // no cursor is needed after a link
    client.clear();
  });

  // N12
  it('end to end: a clean history writes the cursor and no tag; a wipe during the scan writes nothing', async () => {
    devRegistry();
    mockChain.signatures = {[DEV_EXIT]: [finalized('5i53')]};
    mockChain.transactions = {'5i53': fixture('tx-test-to-outside.json')};
    const client = new QueryClient();
    expect(await scanLinksForWallet(DEV_MAIN, client)).toBe(0);
    expect(exitEntry().linked).toBeUndefined();
    expect(readLinkScanCursor(mmkvSecure()!, DEV_EXIT, DEV_EXIT)).toBe('5i53');

    // a new wallet in the same process: the old scan's tag and cursor must not land in it
    clearAllStores();
    initSecureMmkv('test-key');
    storeTransparentScheme({kind: 'slip10', account: 0});
    devRegistry();
    mockChain.signatures = {[DEV_EXIT]: [finalized('QAgz')]};
    mockChain.transactions = {QAgz: fixture('tx-test-to-main.json')};
    let release: () => void = () => undefined;
    mockConnection.getParsedTransactions.mockImplementationOnce(async (signatures: string[]) => {
      await new Promise<void>(r => {
        release = r;
      });
      return signatures.map(s => mockChain.transactions[s] ?? null);
    });
    client.clear();
    const scan = scanLinksForWallet(DEV_MAIN, client);
    await new Promise<void>(r => setImmediate(r)); // let the scan reach the transaction read
    clearAllStores();
    initSecureMmkv('the-next-wallet');
    devRegistry();
    release();
    expect(await scan).toBe(0);
    expect(exitEntry().linked).toBeUndefined();
    client.clear();
  });
});
```

      In `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`, two insertions (a mock beside the link
      queue's, and two tests beside the link queue's):

**Edit 1 of 2 — `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`. Find:**

```tsx
const mockDrain = jest.fn(() => 0);
jest.mock('../../../modules/accounts/linkQueue', () => ({drainLinkQueue: () => mockDrain()}));

// M1d (spec §4.1): the Accounts sheet, stubbed — records its props, renders a marker
```

**Replace with:**

```tsx
const mockDrain = jest.fn(() => 0);
jest.mock('../../../modules/accounts/linkQueue', () => ({drainLinkQueue: () => mockDrain()}));

// history spec §6.4: the retroactive link scan, observed here
const mockScanLinks = jest.fn((_main: string | null, _client: unknown) => Promise.resolve(0));
jest.mock('../../../modules/accounts/linkScanRunner', () => ({scanLinksForWallet: (main: string | null, client: unknown) => mockScanLinks(main, client)}));

// M1d (spec §4.1): the Accounts sheet, stubbed — records its props, renders a marker
```

**Edit 2 of 2 — `src/screens/dashboard/__tests__/DashboardScreen.test.tsx`. Find:**

```tsx
  });

  it('the avatar shows the selected account\'s number and says what it does', async () => {
    mockSelected.current = EXIT_ACCOUNT;
```

**Replace with:**

```tsx
  });

  it('history spec §6.4: opening the sheet starts the link scan for the main wallet AFTER the queue is drained; the sheet does not wait for it', async () => {
    const r = await renderDashboard();
    mockDrain.mockClear();
    mockScanLinks.mockClear();
    mockScanLinks.mockImplementationOnce(() => new Promise<number>(() => undefined)); // a scan that never ends
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(mockScanLinks).toHaveBeenCalledTimes(1);
    expect(mockScanLinks.mock.calls[0]![0]).toBe('AbCdEfAbCdEf'); // walletStore.publicKey: the MAIN account, whichever is selected
    expect(mockDrain.mock.invocationCallOrder[0]!).toBeLessThan(mockScanLinks.mock.invocationCallOrder[0]!);
    expect(r.getByTestId('mock-accounts-sheet')).toBeTruthy();
  });

  it('history spec §6.4: a scan that rejects is silent', async () => {
    const r = await renderDashboard();
    mockScanLinks.mockImplementationOnce(() => Promise.reject(new Error('rpc down')));
    await act(async () => {
      fireEvent.press(r.getByTestId('dashboard-avatar'));
    });
    expect(r.getByTestId('mock-accounts-sheet')).toBeTruthy();
  });

  it('the avatar shows the selected account\'s number and says what it does', async () => {
    mockSelected.current = EXIT_ACCOUNT;
```

- [ ] **Step 2: Run them.**
      `npx jest src/modules/accounts/__tests__/linkScanRunner.test.ts src/screens/dashboard/__tests__/DashboardScreen.test.tsx --forceExit`
      Expected: FAIL — `Cannot find module '../linkScanRunner'` in both (the dashboard test's `jest.mock` of a
      module that does not exist yet fails the whole file).

- [ ] **Step 3: Add the key** to `src/constants/mmkvKeys.ts`:

**The edit — `src/constants/mmkvKeys.ts`. Find:**

```ts
  /** post-M1d §4 / R2: addresses waiting for their "linked" tag (a JSON list). Own accounts → ENCRYPTED instance only. */
  ACCOUNTS_LINK_PENDING: 'v1_accounts.linkPending',

  // ─── Address Book [S] ───────────────────────────────────────────────
```

**Replace with:**

```ts
  /** post-M1d §4 / R2: addresses waiting for their "linked" tag (a JSON list). Own accounts → ENCRYPTED instance only. */
  ACCOUNTS_LINK_PENDING: 'v1_accounts.linkPending',
  /** history spec §6.3: the link scan's cursors, `{[exit]: {[source]: signature}}`. Own accounts and their token accounts → ENCRYPTED instance only. */
  LINK_SCAN_CURSORS: 'v1_linkScanCursors',

  // ─── Address Book [S] ───────────────────────────────────────────────
```

- [ ] **Step 4: Create `src/modules/accounts/linkScanRunner.ts`:**

```ts
/**
 * History spec (2026-11-26) §6.4: WHEN the "linked" scan runs, and its wiring to the chain, the
 * encrypted store and the registry. `linkScan.ts` holds the rule and the paging.
 *
 * The Accounts sheet opens → (after `drainLinkQueue`) every fresh-exit account not yet tagged is
 * scanned, one at a time, in the background. The sheet renders at once; a tag appears when found.
 *   - SINGLE-FLIGHT: an open while a scan runs joins it.
 *   - MINIMUM INTERVAL: 60 s per exit, held in memory.
 *   - GENERATION GUARD: `onSecureMmkvReset` (a wipe, an import, a new encrypted instance) bumps a
 *     generation; a tag or a cursor from an older generation is dropped — the wallet it belongs to
 *     is gone (the class of the sync's wallet-change guard, 237752a).
 *   - A failure is silent: nothing is shown, and the next open after the interval tries again.
 *
 * THE CURSORS live in the ENCRYPTED store only (`v1_linkScanCursors`, `{[exit]: {[source]: signature}}`):
 * a list of one's own accounts and their token accounts is itself a link. A wipe removes them with
 * the store.
 */
import {PublicKey} from '@solana/web3.js';
import type {Connection} from '@solana/web3.js';
import type {QueryClient} from '@tanstack/react-query';
import type {MMKV} from 'react-native-mmkv';
import {mmkvSecure, onSecureMmkvReset} from '../../store/mmkv/instances';
import {MMKV_KEYS} from '../../constants/mmkvKeys';
import {NETWORK} from '../../constants/programs';
import {getConnection} from '../solana/connection';
import {getToken2022Accounts, getTokenAccounts} from '../solana/queries';
import {getSignaturePage, readParsedTransactions} from '../solana/historyReads';
import {markA0AccountsLinked} from '../shielded/a0/accountRegistry';
import type {AccountList} from './accountList';
import {readAccountList, refreshAccounts} from './selectedAccount';
import {scanExitForLinks} from './linkScan';
import type {LinkScanResult} from './linkScan';

export const LINK_SCAN_MIN_INTERVAL_MS = 60_000;
const KEY = MMKV_KEYS.LINK_SCAN_CURSORS;

let generation = 0;
let inFlight: Promise<number> | null = null;
const lastRun = new Map<string, number>();
let hooked = false;

/** Registered on first use, not at import: a screen test that stubs `instances` loads this module too. */
function hook(): void {
  if (hooked) {
    return;
  }
  hooked = true;
  onSecureMmkvReset(() => {
    generation += 1;
    inFlight = null;
    lastRun.clear();
  });
}

export interface LinkScanRunnerEnv {
  /** the account list as stored now; null when it cannot be read */
  accounts: () => AccountList | null;
  /** scan one exit; `live()` is false once the wallet was replaced — writes must check it */
  scanExit: (exit: string, seedWallets: ReadonlySet<string>, live: () => boolean) => Promise<LinkScanResult>;
  now: () => number;
  /** a tag was written: the sheet re-reads the list */
  onLinked: () => void;
}

/** Scan every scannable exit, one at a time; resolves to the number of accounts newly tagged. Never rejects. */
export function runLinkScans(env: LinkScanRunnerEnv): Promise<number> {
  hook();
  if (inFlight !== null) {
    return inFlight; // an open while a scan runs joins it
  }
  const mine = generation;
  const live = (): boolean => mine === generation;
  const work = async (): Promise<number> => {
    let linked = 0;
    let list: AccountList | null;
    try {
      list = env.accounts();
    } catch {
      return 0;
    }
    if (list === null || list.unreadable) {
      return 0;
    }
    // fresh-exit and not yet tagged only; `accounts` never lists a fresh-pending reservation, and never tags main
    const exits = list.accounts.filter(a => a.role === 'fresh-exit' && !a.linked);
    for (const exit of exits) {
      if (!live()) {
        break;
      }
      const now = env.now();
      const last = lastRun.get(exit.address);
      if (last !== undefined && now >= last && now - last < LINK_SCAN_MIN_INTERVAL_MS) {
        continue;
      }
      lastRun.set(exit.address, now);
      // every address of this seed the registry knows (main and fresh-pending included), except the exit
      const seedWallets = new Set(list.seed.map(s => s.address).filter(a => a !== exit.address));
      let result: LinkScanResult;
      try {
        result = await env.scanExit(exit.address, seedWallets, live);
      } catch {
        result = 'failed';
      }
      if (result === 'linked' && live()) {
        linked += 1;
        try {
          env.onLinked();
        } catch {
          // a list that cannot be re-read now is re-read on the next open
        }
      }
    }
    return linked;
  };
  const run: Promise<number> = work()
    .catch(() => 0)
    .finally(() => {
      if (inFlight === run) {
        inFlight = null;
      }
    });
  inFlight = run;
  return run;
}

function readCursors(store: MMKV): Record<string, Record<string, string>> {
  const raw = store.getString(KEY);
  if (raw === undefined) {
    return {};
  }
  try {
    const v: unknown = JSON.parse(raw);
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, Record<string, string>>) : {};
  } catch {
    return {}; // a malformed record is no cursor: the scan starts over and rewrites it
  }
}

export function readLinkScanCursor(store: MMKV, exit: string, source: string): string | undefined {
  const v = readCursors(store)[exit]?.[source];
  return typeof v === 'string' && v !== '' ? v : undefined;
}

export function writeLinkScanCursor(store: MMKV, exit: string, source: string, signature: string): void {
  const all = readCursors(store);
  store.set(KEY, JSON.stringify({...all, [exit]: {...(all[exit] ?? {}), [source]: signature}}));
}

/** §6.3: the exit wallet and EVERY token account it owns, classic and Token-2022 (no bound: the cap is per source). */
export async function linkScanSources(connection: Connection, exit: string): Promise<string[]> {
  const owner = new PublicKey(exit);
  const [classic, token2022] = await Promise.all([getTokenAccounts(connection, owner), getToken2022Accounts(connection, owner)]);
  return [...new Set([exit, ...classic.map(a => a.address), ...token2022.map(a => a.address)])];
}

/**
 * The Accounts sheet's call (§6.4). `mainAddress` is walletStore.publicKey; `client` holds the shared
 * `parsedTx` cache. Resolves to the number of accounts newly tagged; never rejects. With the encrypted
 * store closed nothing is read: the registry and the cursors live there.
 */
export function scanLinksForWallet(mainAddress: string | null, client: QueryClient): Promise<number> {
  const store = mmkvSecure();
  if (!mainAddress || store === null) {
    return Promise.resolve(0);
  }
  const connection = getConnection();
  // a write belongs to the wallet the scan started for: same generation AND the same encrypted instance
  const mayWrite = (live: () => boolean): boolean => live() && mmkvSecure() === store;
  return runLinkScans({
    accounts: () => readAccountList(mainAddress),
    now: () => Date.now(),
    onLinked: () => {
      refreshAccounts(mainAddress);
    },
    scanExit: (exit, seedWallets, live) =>
      scanExitForLinks(exit, seedWallets, {
        listSources: e => linkScanSources(connection, e),
        fetchSignatures: (source, before, limit) => getSignaturePage(connection, NETWORK, source, before, limit),
        readTransactions: signatures => readParsedTransactions(connection, client, NETWORK, signatures),
        getCursor: (e, source) => readLinkScanCursor(store, e, source),
        setCursor: (e, source, signature) => {
          if (mayWrite(live)) {
            writeLinkScanCursor(store, e, source, signature);
          }
        },
        markLinked: e => {
          if (mayWrite(live)) {
            markA0AccountsLinked([e], {bound: store});
          }
        },
      }),
  });
}
```

- [ ] **Step 5: Start the scan when the sheet opens**, in `src/screens/dashboard/DashboardScreen.tsx`:

**Edit 1 of 2 — `src/screens/dashboard/DashboardScreen.tsx`. Find:**

```tsx
import {privateSide, publicSide, splitValue, type SplitValue} from '../../modules/accounts/valueLine';
import {drainLinkQueue} from '../../modules/accounts/linkQueue';
import {CHAIN} from '../../constants/chain';
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';
```

**Replace with:**

```tsx
import {privateSide, publicSide, splitValue, type SplitValue} from '../../modules/accounts/valueLine';
import {drainLinkQueue} from '../../modules/accounts/linkQueue';
import {scanLinksForWallet} from '../../modules/accounts/linkScanRunner';
import {queryClient} from '../../app/queryClient';
import {CHAIN} from '../../constants/chain';
import {formatBalanceForDisplay} from '../../utils/parseTokenAmount';
```

**Edit 2 of 2 — `src/screens/dashboard/DashboardScreen.tsx`. Find:**

```tsx
    refreshAccountList();
    setSheetOpen(true);
    // review r1 m7: unreadable because the encrypted store is closed -> open it (biometric), then re-read
    if (accountList?.unreadable && mmkvSecure() === null) {
      unlockSecureStorage()
        .then(() => refreshAccountList())
        .catch(() => undefined);
    }
  }, [refreshAccountList, accountList]);
  const handleSelectAccount = useCallback(
    (scheme: string) => {
```

**Replace with:**

```tsx
    refreshAccountList();
    setSheetOpen(true);
    // history spec §6.4: every exit not tagged yet is scanned in the background; the sheet does not wait, a tag
    // found re-reads the list by itself, and a failure is silent (the promise never rejects)
    scanLinksForWallet(publicKey, queryClient).catch(() => undefined);
    // review r1 m7: unreadable because the encrypted store is closed -> open it (biometric), then re-read
    if (accountList?.unreadable && mmkvSecure() === null) {
      unlockSecureStorage()
        .then(() => refreshAccountList())
        .catch(() => undefined);
    }
  }, [refreshAccountList, accountList, publicKey]);
  const handleSelectAccount = useCallback(
    (scheme: string) => {
```

- [ ] **Step 6: Run them.** The Step 2 command. Expected: PASS
      (13 runner tests; the dashboard file's 93 existing tests and the 2 new ones). Then the queue this sits
      beside, and the registry: `npx jest src/modules/accounts src/modules/shielded/a0/__tests__/accountRegistry.test.ts --forceExit`
      Expected: PASS, unchanged.

- [ ] **Step 7: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/modules/accounts src/screens/dashboard --forceExit`.
      `lint:ci`: exactly `✖ 143 problems (0 errors, 143 warnings)` (the dashboard's one inline style stays).

- [ ] **Step 8: Commit.**

```bash
git add src/constants/mmkvKeys.ts src/modules/accounts/linkScanRunner.ts src/screens/dashboard/DashboardScreen.tsx \
  src/modules/accounts/__tests__/linkScanRunner.test.ts src/screens/dashboard/__tests__/DashboardScreen.test.tsx
git commit -m "feat(accounts): opening the Accounts sheet scans every untagged exit for on-chain links, in the background"
```

---

### Task 11: Presale refuses a stale or unknown main balance

Spec: §7 (all of it), H6, §8 "Presale", §9 (the float conversions stay).

**Design (BINDING):** `/home/user/Downloads/screen.md` section `23 · presale` and its `index.html` mockup (state
`active`). This task adds one state to it — the balance not known — and changes nothing else on the screen. Do NOT
edit the design files (Task 12 draws the state).

**Files:**
- Modify: `src/screens/PresaleScreen.tsx:1` (imports), `:120-123` (the balance), `:182-185` (`gate`), `:197-206`
  (`onMax`), `:351-390` (the "Available" line and MAX)
- Test: `src/screens/__tests__/PresaleActive.test.tsx` (the wallet-store mock, one import, and a new `describe`)

**Interfaces:**
- Consumes (existing, PR 1): `mainBalanceIsStale(lastSyncedAt: number | null, lastSyncFailedAt: number | null): boolean`
  and `mainBalanceIsUnknown(...)` from `src/modules/accounts/staleness`; `useWalletStore` fields
  `lastSyncedAt: number | null`, `lastSyncFailedAt: number | null` (memory only: set by a failed sync of this
  session, cleared by a good one); `forceSync(): Promise<SyncResult>` from
  `src/modules/backgroundSync/backgroundSyncModule`; `SEND_BALANCE_STALE` ('Not updated · tap to retry'),
  `SEND_BALANCE_RETRY` ('Balance unavailable · tap to retry'), `SEND_BALANCE_CHECKING` ('Checking balance…'),
  `VALUE_UNKNOWN` ('—') from `src/copy/accounts`; `cn` from `src/utils/cn`; `canBuy(...)` (re-exported by this file
  from `core/presale/purchaseGate`): `{enabled: boolean; reason: string | null}`.
- Produces: no new export. New test ids on the screen: `presale-available`, `presale-balance-note`, `presale-max`.

**Why:** `PresaleScreen.tsx:121` and `:159` read `walletStore` directly. After a failed sync the screen shows the
last figure as if it were current, and for a wallet never read the store's default `0` — with "Insufficient SOL
balance" under it, a claim about a balance nobody read. PR 1 listed this as a known limit. The rule and the words
are exactly `SwapScreen.tsx:96-117` and `:412-448` — read them; this task repeats that pattern, it does not invent
one.

Four states of the main balance, and what the screen shows:

| `lastSyncedAt` | `lastSyncFailedAt` | Available | Note under it | MAX | Buy |
|---|---|---|---|---|---|
| set | null | the figure | none | on | by `canBuy` |
| set | set (stale) | — | "Not updated · tap to retry" | dimmed, off | off, no reason line |
| null | set (unknown) | — | "Balance unavailable · tap to retry" | dimmed, off | off, no reason line |
| null | null (first read in flight) | — | "Checking balance…" (no tap) | dimmed, off | off, no reason line |

- [ ] **Step 1: Write the failing tests.** In `src/screens/__tests__/PresaleActive.test.tsx`: the wallet-store mock
      becomes switchable (its default is a balance that WAS read, so the 13 existing tests keep meaning what they
      meant), `forceSync` is mocked, `act` is imported, and one `describe` is appended at the end of the file:

**Edit 1 of 3 — `src/screens/__tests__/PresaleActive.test.tsx`. Find:**

```tsx
import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
```

**Replace with:**

```tsx
import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
```

**Edit 2 of 3 — `src/screens/__tests__/PresaleActive.test.tsx`. Find:**

```tsx
const LINE_MAIN = {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true};

jest.mock('../../store/zustand/walletStore', () => ({
  useWalletStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      solBalance: '10000000000',
      tokenBalances: {},
      publicKey: '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd',
    }),
}));

// Controllable referral-capture store: a mutable backing object the selector
```

**Replace with:**

```tsx
const LINE_MAIN = {scheme: 'slip10:0', address: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', label: 'Account 1', isMain: true};

// history spec §7 (H6): the sync fields are switchable per test; the default is a balance that was read
const mockWallet: {lastSyncedAt: number | null; lastSyncFailedAt: number | null} = {lastSyncedAt: 1_700_000_000_000, lastSyncFailedAt: null};
jest.mock('../../store/zustand/walletStore', () => ({
  useWalletStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      solBalance: '10000000000',
      tokenBalances: {},
      publicKey: '6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd',
      lastSyncedAt: mockWallet.lastSyncedAt,
      lastSyncFailedAt: mockWallet.lastSyncFailedAt,
    }),
}));

const mockForceSync = jest.fn(() => Promise.resolve({success: true}));
jest.mock('../../modules/backgroundSync/backgroundSyncModule', () => ({forceSync: () => mockForceSync()}));

// Controllable referral-capture store: a mutable backing object the selector
```

**Edit 3 of 3 — `src/screens/__tests__/PresaleActive.test.tsx`: append at the end of the file, after one blank line:**

```tsx
// ── history spec §7 (H6): presale treats a stale or unknown main balance as Send, Swap and #16 do ─────────────

describe('PresaleActive — the main balance must be known (history spec §7, H6)', () => {
  const allow = () => mockCheckJurisdiction.mockResolvedValue({action: 'allow', countryCode: 'SI', transparentAllowed: true});
  const FRESH = {lastSyncedAt: 1_700_000_000_000, lastSyncFailedAt: null};
  const STALE = {lastSyncedAt: 1_700_000_000_000, lastSyncFailedAt: 1_700_000_060_000};
  const UNKNOWN = {lastSyncedAt: null, lastSyncFailedAt: 1_700_000_060_000};
  const NEVER = {lastSyncedAt: null, lastSyncFailedAt: null};
  const buyDisabled = (r: ReturnType<typeof renderActive>): boolean =>
    r.getByTestId('presale-buy-button').props.accessibilityState?.disabled === true;
  /** the amount field's value after typing: the screen keeps it in state */
  const amountOf = (r: ReturnType<typeof renderActive>): string => r.getByTestId('presale-sol-input').props.value as string;

  beforeEach(() => {
    jest.clearAllMocks();
    allow();
    Object.assign(mockWallet, FRESH);
  });
  afterAll(() => {
    Object.assign(mockWallet, FRESH);
  });

  // B1 — the control every other case is compared with
  it('a balance that was read: the figure, no note, MAX fills the amount, Buy turns on, "Insufficient" shows when it is', async () => {
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    expect(r.getByTestId('presale-available')).toHaveTextContent('10');
    expect(r.queryByTestId('presale-balance-note')).toBeNull();
    expect(r.getByTestId('presale-max').props.accessibilityState).toEqual({disabled: false});
    fireEvent.press(r.getByTestId('presale-max'));
    expect(amountOf(r)).toBe('9.999'); // 10 SOL − the 0.001 fee headroom
    expect(buyDisabled(r)).toBe(false);
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '100');
    expect(r.getByText('Insufficient SOL balance')).toBeTruthy();
  });

  // B2
  it('stale: "—", "Not updated · tap to retry", MAX dimmed and off, Buy off, and no "Insufficient" line', async () => {
    Object.assign(mockWallet, STALE);
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    expect(r.getByTestId('presale-available')).toHaveTextContent('—');
    expect(r.getByTestId('presale-available')).not.toHaveTextContent('10');
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Not updated · tap to retry');
    const max = r.getByTestId('presale-max');
    expect(max.props.accessibilityState).toEqual({disabled: true});
    expect(max.props.className).toContain('opacity-40');
    fireEvent.press(max);
    expect(amountOf(r)).toBe('');
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '0.2'); // $40: a valid purchase when the balance is known
    expect(buyDisabled(r)).toBe(true);
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '100');
    expect(r.queryByText('Insufficient SOL balance')).toBeNull();
    fireEvent.press(r.getByTestId('presale-buy-button'));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // B3
  it('never read and a sync failed: "Balance unavailable · tap to retry"; Buy and MAX off', async () => {
    Object.assign(mockWallet, UNKNOWN);
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    expect(r.getByTestId('presale-available')).toHaveTextContent('—');
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Balance unavailable · tap to retry');
    expect(r.getByTestId('presale-max').props.accessibilityState).toEqual({disabled: true});
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '0.2');
    expect(buyDisabled(r)).toBe(true);
  });

  // B4
  it('a first read in flight: "Checking balance…", which offers no tap', async () => {
    Object.assign(mockWallet, NEVER);
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    const note = r.getByTestId('presale-balance-note');
    expect(note).toHaveTextContent('Checking balance…');
    expect(note.props.accessibilityState).toEqual({disabled: true, busy: true});
    fireEvent.press(note);
    expect(mockForceSync).not.toHaveBeenCalled();
    expect(r.getByTestId('presale-available')).toHaveTextContent('—');
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '0.2');
    expect(buyDisabled(r)).toBe(true);
  });

  // B5
  it('the note runs the main sync, one in flight, and reads "Checking balance…" while it runs', async () => {
    Object.assign(mockWallet, STALE);
    let finish: () => void = () => undefined;
    mockForceSync.mockImplementationOnce(() => new Promise(resolve => {
      finish = () => resolve({success: true});
    }));
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    const onPress = r.UNSAFE_getAllByProps({testID: 'presale-balance-note'})[0]!.props.onPress as () => void;
    act(() => {
      onPress();
      onPress(); // two taps in one tick: the ref guard
    });
    expect(mockForceSync).toHaveBeenCalledTimes(1);
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Checking balance…');
    await act(async () => {
      finish();
    });
    expect(r.getByTestId('presale-balance-note')).toHaveTextContent('Not updated · tap to retry'); // the store still says stale
  });

  // B6
  it('the same rule for a stablecoin: the token balance is not shown as 0 while the main balance is stale', async () => {
    Object.assign(mockWallet, STALE);
    const r = renderActive();
    await r.findByTestId('presale-buy-button');
    fireEvent.press(r.getByTestId('pay-chip-USDC'));
    expect(r.getByTestId('presale-available')).toHaveTextContent('—');
    fireEvent.changeText(r.getByTestId('presale-sol-input'), '50');
    expect(r.queryByText('Insufficient USDC balance')).toBeNull();
    expect(buyDisabled(r)).toBe(true);
  });
});
```

- [ ] **Step 2: Run it.** `npx jest src/screens/__tests__/PresaleActive.test.tsx --forceExit`
      Expected: FAIL — the six new tests (`Unable to find an element with testID: presale-available`); the 13
      existing tests PASS (pins: the screen does not read the two new store fields yet).

- [ ] **Step 3: Implement in `src/screens/PresaleScreen.tsx`.** Eight edits, in file order. The float conversions
      (`Number(...) / 1e9`, `/ 1e6`) are pre-existing and stay exactly as they are (spec §9). The inline style at
      the pay chips (one of the 143 lint warnings) is not touched.

**Edit 1 of 8 — `src/screens/PresaleScreen.tsx`. Find:**

```tsx
import React, {useCallback, useMemo, useState} from 'react';
import {
  View,
```

**Replace with:**

```tsx
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
```

**Edit 2 of 8 — `src/screens/PresaleScreen.tsx`. Find:**

```tsx
import {usePresaleStore} from '../store/zustand/presaleStore';
import {useWalletStore} from '../store/zustand/walletStore';
import {useReferralCaptureStore} from '../store/zustand/referralCaptureStore';
import {parseReferralInput} from '../modules/presale/referralInput';
```

**Replace with:**

```tsx
import {usePresaleStore} from '../store/zustand/presaleStore';
import {useWalletStore} from '../store/zustand/walletStore';
import {mainBalanceIsStale, mainBalanceIsUnknown} from '../modules/accounts/staleness';
import {forceSync} from '../modules/backgroundSync/backgroundSyncModule';
import {SEND_BALANCE_CHECKING, SEND_BALANCE_RETRY, SEND_BALANCE_STALE, VALUE_UNKNOWN} from '../copy/accounts';
import {cn} from '../utils/cn';
import {useReferralCaptureStore} from '../store/zustand/referralCaptureStore';
import {parseReferralInput} from '../modules/presale/referralInput';
```

**Edit 3 of 8 — `src/screens/PresaleScreen.tsx`. Find:**

```tsx
  const publicKey = useWalletStore(s => s.publicKey);

  // Captured-referrer store (B1 interim manual field; B2's deep link will write
  // here too). Cleared after a successful referred purchase.
```

**Replace with:**

```tsx
  const publicKey = useWalletStore(s => s.publicKey);

  // history spec §7 (H6): a stale, unknown or never-read main balance is not a figure to buy from — the rule and
  // the words of Send (#12), Swap and #16. The float conversions above and below are pre-existing (spec §9).
  const lastSyncedAt = useWalletStore(s => s.lastSyncedAt);
  const lastSyncFailedAt = useWalletStore(s => s.lastSyncFailedAt);
  const staleBalance = mainBalanceIsStale(lastSyncedAt, lastSyncFailedAt);
  const balanceKnown = lastSyncedAt !== null && !staleBalance && !mainBalanceIsUnknown(lastSyncedAt, lastSyncFailedAt);
  // the note under the balance says why buying is off; tapping it runs the main sync, one in flight
  const retryingRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );
  const [retrying, setRetrying] = useState(false);
  const retryBalance = useCallback(() => {
    if (retryingRef.current) {
      return;
    }
    retryingRef.current = true;
    setRetrying(true);
    forceSync()
      .catch(() => undefined)
      .finally(() => {
        retryingRef.current = false;
        if (mountedRef.current) {
          setRetrying(false);
        }
      });
  }, []);
  // a first sync not settled yet: the note reads "Checking balance…" and offers no tap
  const noteBusy = retrying || (lastSyncedAt === null && lastSyncFailedAt === null);

  // Captured-referrer store (B1 interim manual field; B2's deep link will write
  // here too). Cleared after a successful referred purchase.
```

**Edit 4 of 8 — `src/screens/PresaleScreen.tsx`. Find:**

```tsx
      : estimateNocForUsd(amountNum, stagePriceUsd);

  const gate = useMemo(
    () => canBuy({paymentToken, amount, solUsd, solBalance, tokenBalance}),
    [paymentToken, amount, solUsd, solBalance, tokenBalance],
  );

  const onChangeAmount = useCallback((raw: string) => {
```

**Replace with:**

```tsx
      : estimateNocForUsd(amountNum, stagePriceUsd);

  const gate = useMemo(
    // H6: with the balance not known the purchase is off and NO reason is shown — "Insufficient…" would be a
    // claim about a balance that was not read; the note under the balance says what is wrong
    () => (balanceKnown ? canBuy({paymentToken, amount, solUsd, solBalance, tokenBalance}) : {enabled: false, reason: null}),
    [balanceKnown, paymentToken, amount, solUsd, solBalance, tokenBalance],
  );

  const onChangeAmount = useCallback((raw: string) => {
```

**Edit 5 of 8 — `src/screens/PresaleScreen.tsx`. Find:**

```tsx
  }, []);

  const onMax = useCallback(() => {
    if (paymentToken === 'SOL') {
      const max = Math.max(0, solBalance - FEE_HEADROOM_SOL);
```

**Replace with:**

```tsx
  }, []);

  const onMax = useCallback(() => {
    if (!balanceKnown) {
      return;
    }
    if (paymentToken === 'SOL') {
      const max = Math.max(0, solBalance - FEE_HEADROOM_SOL);
```

**Edit 6 of 8 — `src/screens/PresaleScreen.tsx`. Find:**

```tsx
      setAmount(tokenBalance > 0 ? String(tokenBalance) : '0');
    }
  }, [paymentToken, solBalance, tokenBalance]);

  const onBuy = useCallback(() => {
```

**Replace with:**

```tsx
      setAmount(tokenBalance > 0 ? String(tokenBalance) : '0');
    }
  }, [balanceKnown, paymentToken, solBalance, tokenBalance]);

  const onBuy = useCallback(() => {
```

**Edit 7 of 8 — `src/screens/PresaleScreen.tsx`. Find:**

```tsx
              <Text variant="caption">
                Available{' '}
                <Text variant="caption" numeral className="text-fg-secondary">
                  {(paymentToken === 'SOL'
                    ? solBalance
                    : tokenBalance
                  ).toLocaleString('en-US', {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 4,
                  })}
                </Text>{' '}
                {paymentToken}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <TextInput
```

**Replace with:**

```tsx
              <Text variant="caption">
                Available{' '}
                <Text variant="caption" numeral className="text-fg-secondary" testID="presale-available">
                  {balanceKnown
                    ? (paymentToken === 'SOL' ? solBalance : tokenBalance).toLocaleString('en-US', {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 4,
                      })
                    : VALUE_UNKNOWN}
                </Text>{' '}
                {paymentToken}
              </Text>
            </View>
            {!balanceKnown ? (
              <Pressable
                onPress={retryBalance}
                disabled={noteBusy}
                accessibilityRole="button"
                accessibilityState={{disabled: noteBusy, busy: noteBusy}}
                testID="presale-balance-note"
                hitSlop={8}
                className="self-end mb-2">
                <Text variant="body-sm" className="text-fg-secondary">
                  {noteBusy ? SEND_BALANCE_CHECKING : staleBalance ? SEND_BALANCE_STALE : SEND_BALANCE_RETRY}
                </Text>
              </Pressable>
            ) : null}
            <View className="flex-row items-center gap-3">
              <TextInput
```

**Edit 8 of 8 — `src/screens/PresaleScreen.tsx`. Find:**

```tsx
              <Pressable
                onPress={onMax}
                accessibilityRole="button"
                accessibilityLabel="Use max balance"
                className="px-3 h-8 rounded-pill bg-bg-surface-3 items-center justify-center">
                <Text variant="caption" className="text-fg-primary font-semibold">
                  MAX
```

**Replace with:**

```tsx
              <Pressable
                onPress={onMax}
                disabled={!balanceKnown}
                accessibilityState={{disabled: !balanceKnown}}
                accessibilityRole="button"
                accessibilityLabel="Use max balance"
                testID="presale-max"
                className={cn('px-3 h-8 rounded-pill bg-bg-surface-3 items-center justify-center', !balanceKnown && 'opacity-40')}>
                <Text variant="caption" className="text-fg-primary font-semibold">
                  MAX
```

- [ ] **Step 4: Run it.** The Step 2 command. Expected: PASS (19 tests).

- [ ] **Step 5: The routes that render this screen.** `npx jest src/app/__tests__/presaleRoutes.test.tsx src/copy --forceExit`
      Expected: PASS. If `presaleRoutes.test.tsx` mocks `walletStore` with a selector state that has no
      `lastSyncedAt`, the screen would now read it as `undefined` and treat the balance as stale: give that mock
      `lastSyncedAt: 1_700_000_000_000, lastSyncFailedAt: null` and say so in the task report. (On 5588ce7 it
      passes unchanged.)

- [ ] **Step 6: Gates.**
      `npx tsc --noEmit && npm run lint:ci && npx jest && node scripts/check-no-tge-date.mjs`, then
      `/usr/bin/node node_modules/.bin/jest src/screens/__tests__/PresaleActive.test.tsx src/app --forceExit`.
      `lint:ci`: exactly `✖ 143 problems (0 errors, 143 warnings)`.

- [ ] **Step 7: Commit.**

```bash
git add src/screens/PresaleScreen.tsx src/screens/__tests__/PresaleActive.test.tsx
git commit -m "fix(presale): a stale or unknown main balance reads —, says why, and turns MAX and Buy off"
```

---

### Task 12 (controller, not a subagent): final gates, the phone checkpoint, the design files, the report

Spec: §8 "Gates", §10, §11, §9. The controller does this itself after Task 11's review: it edits the owner's own
files outside the repository, and it needs a device.

- [ ] **Step 1: The gates, whole, on both Node versions.** From a clean tree at the last task's commit:

```bash
npx tsc --noEmit && npm run lint:ci && node scripts/check-no-tge-date.mjs
npx jest --forceExit
/usr/bin/node node_modules/.bin/jest --forceExit
git diff --stat main -- src/copy/__tests__ src/screens/shielded/__tests__/privacyClaims.test.ts src/modules/shielded/__tests__/noSelfRelay.test.ts
```

      Expected: `✖ 143 problems (0 errors, 143 warnings)`; both jest runs green (the plan's dry run:
      3530 tests in 230 suites passing on each, 1 skipped — the live ZK-manifest suite); the last command prints
      nothing — no guard was edited. Read the output, not the exit code
      alone: a jest run that reports fewer suites than the previous task's did has skipped something.

- [ ] **Step 2: Review.** The whole-branch review goes to Fable (the owner's rule for every review), with the spec,
      this plan, and the "Rulings" and "Findings" sections below named explicitly. Fix what it finds before the
      phone.

- [ ] **Step 3: The phone checkpoint (devnet build, the owner's phone, the seed whose accounts the fixtures are).**
      Build and sideload as the project memory note "Android Transparent v1" describes. Then, line by line — each is seen
      on the screen, not assumed:
  1. Dashboard → History (main selected). The skeleton shows, then rows. Not every row reads "Transaction —": if
     all of them do, the provider refuses the reads — stop, this is Task 1 Step 5's case.
  2. The rows of main, newest first, include: "Received TEST · from Account 4" (`2XgjNKS8…`), "Received TEST ·
     from Account 2" (`QAgzVzY6…`), "Made private TEST" with the Private badge (`3d31ATap…`, "−0.0001"),
     "Made public TEST" with the badge (`3tPxm8Ph…`), "Transaction · No funds moved" (`63fU5RvD…`), and
     "Sent SOL · to 2ixJm1…uYQMr9" (`2bGSoVSG…`, "−0.001"). No row shows a USD figure.
  3. Chips: Private shows only the Made private / Made public rows; Sent shows only "Sent SOL"; Swaps reads
     "No Swaps transactions in the last {n}" with "Load older", and at the end of history "No Swaps transactions
     yet". The chip is mint-tinted when active.
  4. Scroll to the end on All: older pages load by themselves until the end; no row appears twice.
  5. Send 0.0001 TEST from main to an outside address, come back to History: the new "Sent TEST" row is on top
     without leaving the screen's data stale (pull to refresh if the screen was open).
  6. Tap "Made private TEST": #27 reads "MADE PRIVATE", "0.0001 TEST", "Fee payer", and "Balance changes" with
     "−0.0001 TEST" and "−0.00069596 SOL · account rent". Tap "Received TEST · from Account 2": "RECEIVED",
     From = Account 2's address, To = main's.
  7. Select Account 3 → History: "Made public TEST" (`54J9kjQ8…`) and "Sent SOL" (`2HWCCJQd…`). #27 of the
     first: "MADE PUBLIC", "0.00001 TEST", "+0.003 SOL · gas grant".
  8. Open the Accounts sheet, wait a few seconds, close and reopen: Account 2 and Account 4 carry "linked" (each
     sent tokens to main); Account 3 does not (a relayed Make public and a send to an outside wallet link
     nothing); the main row never carries it. The sheet opened at once both times.
  9. Presale needs a mainnet build (presale is mainnet-only): with the network off, open presale after a failed
     pull-to-refresh on the dashboard — Available "—", "Not updated · tap to retry", MAX dimmed, Buy off, no
     "Insufficient" line. If no mainnet build is at hand, say so in the report: the six tests of Task 11 are then
     the only evidence.

      A line that fails is a bug to fix (with its test first) before the PR, not a note.

- [ ] **Step 4: Dated backups of the design files — before any change, and never over an existing backup.** Backups
      up to `.bak-2026-11-26b` already exist in `/home/user/Downloads`:

```bash
cd /home/user/Downloads
d=$(date +%F); for s in "" b c d e f g h; do
  if [ ! -e "index.html.bak-$d$s" ] && [ ! -e "screen.md.bak-$d$s" ]; then suffix="$d$s"; break; fi
done
test -n "$suffix" && cp -n index.html "index.html.bak-$suffix" && cp -n screen.md "screen.md.bak-$suffix" && ls -l *.bak-"$suffix"
```

      Expected: two new files listed. If `suffix` is empty, stop and ask the owner.

- [ ] **Step 5: `index.html` and `screen.md` (spec §10).** Read each screen's `screen.md` section and its mockup
      first; enumerate every state already drawn; change only what follows. The owner made this design: improve it
      to what was built and say per screen what changed.
  - **#26 activity** (states 26a–26d; `screen.md` section `26 · activity`):
    - replace the "Build status" note with what is built (real rows from chain, parsed on the device; sources =
      the wallet and its token accounts, at most 24 of them, with the footer "History from 24 of {m} token
      accounts"; raw transactions cached for the session);
    - remove the USD figures under the row amounts (H7);
    - counter-parties as first 6 … last 6, or the account's label ("from Account 2");
    - the fifth chip and the row badge read **"Private"** — the "Shielded" chip, the "Shielded" badge on
      "Sent SOL" / "Received SOL", and the "deposit" secondary line become "Made private TEST" / "Made public
      TEST" rows with the Private badge;
    - add: "Wrapped SOL", "Transaction · Account setup", the partial row ("Transaction", "—"), the empty-chip
      line "No Swaps transactions in the last 40" with the "Load older" button, the sections "This month",
      "{Month YYYY}" and "Date unknown";
    - the failed row: "Failed", "—", "fee 0.000005 SOL" only when this account paid — no reason line;
    - remove the "dApp signature" row (it is drawn as "Transaction · No funds moved") and the OriginBadge pills;
    - the time format: "09:14" for Today and Yesterday, "6 May" otherwise (was "9:14 AM", "May 6");
    - `screen.md`: the same in words, plus what §11 defers (the "Activity" title and tab bar, #41, the failed
      reason, USD, OriginBadge).
  - **#27 tx-detail** (states 27a–27f; `screen.md` section `27 · tx-detail`):
    - the nine eyebrow words; the hero rules (no sign, the symbol; a swap as "{out} {sym} → {in} {sym}"; no amount
      line with no primary);
    - "≈ $x at today's price" under the hero, only with a price;
    - one new state: the **"Balance changes"** form (Fee payer + the list with role labels "account rent",
      "gas grant", "Noctura fee") — draw it for the Made private case;
    - 27b ("shielded-send") becomes a Made private detail; 27d (failed-tx-with-reason) loses its reason line and
      reads "FAILED" with no amount;
    - a note at 27f: its second case (From "—") is not reachable — a null From shows the balance-changes form;
    - `screen.md`: replace the 2026-11-22 "Build status" paragraph (only the first transfer is read) with the
      agreement rule.
  - **#23 presale** (`screen.md` section `23 · presale`): one new state of `active` — Available "—", the note
    "Not updated · tap to retry" (and its two other wordings), MAX dimmed, Buy disabled.
  - **Accounts sheet** (`screen.md` line beginning "Accounts sheet (M1d)"): a note that "linked" can appear a
    moment after the sheet opens (a background scan of each exit's history), that it is a lower bound, and that it
    is never removed.

- [ ] **Step 6: Tell the owner (in Slovenian — the owner's rule for chat), per screen, what changed**, name the
      backup files of Step 4, and say explicitly what was **not** built or drawn (the table of Task 7, the table of
      Task 8). Then, in these words, the limits and the findings below ("Known limits", "Findings for the owner").
      The three findings are questions for the owner, not decisions the plan made.

- [ ] **Step 7: The PR.** `GODEBUG=netdns=cgo gh pr create` against `main` (the prefix if `gh` cannot resolve
      `api.github.com`). The description holds: what each screen now does; the Task 1 measurement, with the
      sentence that it is the public endpoints'; the phone checkpoint's nine lines with their results; the
      rulings; the known limits; the three findings. No TGE date anywhere in it.

---

## Spec coverage

| Spec item | Task |
|---|---|
| §1.1 #26 shows real rows under date sections, filtered by chips | 2 (the row), 5 (what it says), 7 (the screen) |
| §1.2 a wrong row is worse than none; never "no transactions" without a full read | 2 (`incomplete`, `unknown`, null fields), 3 (S4, S5), 4 (H2, H6), 7 (T13–T16) |
| §1.3 every exit linked on chain carries the tag; never removed | 9, 10 |
| §1.4 presale treats a stale or unknown main balance as Send / Swap do | 11 |
| H1 chain through the app's RPC, parsed on the device | 3, 4 |
| H2 the amount is the account's net change | 2 |
| H3 "Made private" / "Made public", the badge, their chip, never Sent / Received | 2 (rule 2), 5 (V13, V21), 7 (T1, T6) |
| H4 the linked rule (either direction, a failed tx counts, a relayed Make public does not, main never) | 9 (L1–L8), 10 (N1, N11) |
| H5 the scan runs when the sheet opens, in the background; silent; never removed | 10 |
| H6 presale's three wordings; MAX and Buy off | 11 |
| H7 no USD on #26 rows; "≈ $x at today's price" on #27 only with a price | 5 (V28), 7 (T1), 8 (D18–D20) |
| H8 row wording as drawn: asset in the title, signed amount without a symbol, the incoming leg with one, icons | 5 (V10–V18), 7 (T1) |
| §3.1 sources: the wallet + every token account, classic and Token-2022 | 4 (R1, R3, R4, H1) |
| §3.2 state per source; fetch rule; page building; dedupe; order; end of history | 3 (S1–S5) |
| §3.2 the 25-source bound, the order of sources, the footer | 4 (R2), 3 (S13), 7 (T18) |
| §3.2 a session is dropped on an account switch, a network switch, `onSecureMmkvReset` | 6 (K4, the reset test); the cluster is part of every key (K1) — a build has one network |
| §3.2 / §3.3 "Plan Task 1 measures" | 1 (Steps 4–5) |
| §3.3 `['parsedTx', cluster, signature]`, never stale, 24 h; a null is not cached; cleared on reset | 4 (R7, R8, R10), 6 (the reset and `gcTime` tests) |
| §3.3 the history key keeps the `['txHistory', address]` prefix; an invalidation drops the session; 60 s | 6 (K1, K7, the invalidation test) |
| §3.3 the batch, and the fallback when it throws | 4 (R7, R9, R13, R14) |
| §3.3 limiter keys: method + cluster + source + cursor; a hash of every signature | 4 (R6, R11) |
| §3.4 a partial row; never dropped; re-tried | 4 (H2, H7), 5 (V17), 7 (T1) |
| §3.4 pull-to-refresh: source list re-read, pages down to `newest`, merged on top, older pages stay | 3 (S6, S8, S10, S11, S12), 4 (H4), 7 (T19) |
| §3.4 the three restart conditions | 3 (S7, S9, S10) |
| §3.4 rows keyed and deduped by signature; keys hold cluster and address | 3 (S1), 6 (K1, K4, K8), 4 (H5) |
| §4.1 types; `status` handed in, `meta.err` overrides; amounts only from `uiTokenAmount.amount` | 2 (A33, A38, A40) |
| §4.2 SOL: the fee is never part of a delta; `feePaidByAccount` | 2 (A1, A2, A24, A14b) |
| §4.2 proven creations and closes, top-level and inner; `createIdempotent` only with 0 pre lamports | 2 (A7, A8, A22, A26b, A28, A29, A30) |
| §4.2 rent amounts incl. wSOL; counted once; created-and-closed adds nothing | 2 (A23, A24, A25, A26, A28) |
| §4.2 markup; grant; the rho marker | 2 (A9, A10, A11, A15, A16, A17) |
| §4.2 tokens (Token and Token-2022 alike); unattributable entries → `incomplete` | 2 (A5, A8, A35–A37) |
| §4.3 kinds, rule order, rule 2 only on the pool's cluster, `isOurA0Ix` not copied | 2 (A15–A34) |
| §4.4 the order of deltas; `primary` / `secondary` per kind; `extraAssets` | 2 (A7, A9, A15, A17, A22, A25, A26) |
| §4.5 counter-party: SOL and token rules, the exclusions; "Shown as" | 2 (A1–A14d), 5 (V22, V23) |
| §4.6 #27: hero, eyebrow, agreement rule, balance changes, today's price, deep link, `ownTokenAccounts`, 27f | 5 (V24–V28), 8 (D4–D20) |
| §5.1 rows; "+N more"; " · incomplete"; formatting; {time} | 5 (V8, V10–V20), 7 (T1, T2) |
| §5.2 chips; the empty-chip line; "Load older"; the 3-page stop; "No {chip} transactions yet" at the end | 5 (V21), 7 (T6–T11) |
| §5.3 `sectionOf` with `now` and an IANA zone; week and month boundaries; "Date unknown" | 5 (V1–V9), 7 (T4, T21) |
| §5.3 jest pins `TZ=UTC`; no test asserts raw `toLocaleString` | 5 (`timezone.test.ts`) |
| §5.3 skeleton; the unchanged states; the loaded empty account | 7 (T12–T17, T5, T3) |
| §6.1 `transactionLinks` (pure), `scanExitForLinks`; who is scanned; `seedWallets` | 9, 10 (N1) |
| §6.2 the rule | 9 (L1–L8) |
| §6.3 sources; the cursor (finalized, encrypted, by value); 20 at a time; the cap; a failed source; stop at a link; a null read | 9 (L9–L18), 10 (N7, N8) |
| §6.4 sheet open → drain → scan; single-flight; 60 s; generation guard; a hit re-reads the list; silent | 10 (N2–N6, N11, N12, the two dashboard tests) |
| §7 presale | 11 (B1–B6) |
| §8 fixtures: verbatim, each signature named | 1 |
| §8 gates: Node 24 and Node 22; no fake timers with async act; tsc; lint 143; TGE | every task; 12 (whole) |
| §9 known limits | "Known limits" below; told to the owner in Task 12 Step 6 |
| §10 design files | 12 (Steps 4–5) |
| §11 changed or deferred from the design | 7 and 8 (the tables at the top of each), 12 (Step 6) |

## Pins — tests that pass before the change

These cover behaviour that already exists, or keep a later edit from breaking it. They are not evidence that a
task's change works, and a task report must not count them as such.

| Test | Task | What it pins |
|---|---|---|
| "the fixtures match the constants they are classified with" | 2 | the fixtures and `A0` / `A0_RELAYER` agree |
| the first two tests of `queryClient.test.ts` | 6 | PR 1's wipe / import behaviour, unchanged |
| the 13 existing tests of `PresaleActive.test.tsx` | 11 | the screen with a balance that was read (the mock's new default) |
| the 93 existing tests of `DashboardScreen.test.tsx` | 10 | the sheet, the queue drain and its order |
| `noSelfRelay.test.ts`, `bannedWords.test.ts`, `privacyClaims.test.ts` | 2, 5, 7, 8 | the guards — unchanged files that must keep passing |
| `txDetail.test.ts` (30 tests) | 2 | `parseTxDetail` reads what it read before the type extension |

## Known limits this PR leaves (tell the owner — Task 12 Step 6)

From spec §9, unchanged:
- **Older history.** An exit's scan reads at most 300 signatures per source per scan; a link older than that is not
  found. History pages on demand.
- **Closed token accounts.** History and the scan read the token accounts a wallet owns NOW.
- **Token-2022 holdings** appear in history but not in the dashboard balances.
- **The "linked" tag is a lower bound**, and a third party's dust transaction naming two seed wallets tags the exit.
- **A Make public row** on the receiving account shows no source — the pool hides it.
- **"via"** names only Jupiter v6.
- **Presale's float conversions** are pre-existing.
- **Cache size:** raw transactions for 24 h, with no count bound.
- **Large wallets:** at most 24 token accounts are read; the footer says so.
- **A stake or other non-token account** the account paid for reads "Transaction · Account setup".
- **The RPC provider sees every request.**

Added by this plan:
- **A refresh that restarts** (more than 100 new signatures on one source, or a token account gained or lost)
  drops the older pages that were loaded: the list returns to its first 20 rows.
- **A row older than 24 h in a session left open** can turn back into "Transaction —" until the next refresh
  re-reads it (the cached transaction was collected).
- **#27 opened by a deep link** (no account) shows the fee payer and no From / To — PR 1 showed the first
  transfer's parties there (ruling 7).
- **No real "wrap into a new wSOL account" fixture** unless Task 1 Step 3 finds one: test A23 is derived (ruling 5).

## Rulings made while writing this plan (the spec was silent, or two rules met)

Each is the most conservative reading; a reviewer who disagrees should say so before the task it sits in starts.

1. **The fifth chip and the row badge read "Private", not "Shielded"** (Tasks 5, 7). Spec §5.2 and the design say
   "Shielded"; spec §5.1 says "No guard regex changes", and `bannedWords.test.ts` bans that word from every
   user-visible string under `src/screens` and in `src/copy/transactions.ts`. The two cannot both hold. The guard
   wins: it is the owner's later decision (UX part B, one vocabulary). The chip id in code is `'private'`.
2. **The pool discriminators are matched in `syncedTx.ts`, not in `activity.ts`** (Task 2). Spec §4.3 has
   `activity.ts` match "the first 8 decoded bytes … against the `deposit` / `withdraw_with_change`
   discriminators"; the R6 source guard `noSelfRelay.test.ts` fails if the withdraw discriminator is named outside
   three files. `syncedTx.ts` (one of the three) gains `a0PoolInstructionKind`, built on `isOurA0Ix`; the guard
   file is untouched.
3. **A wrap's wSOL delta is not "+1 more"** (Task 2). §4.4 counts every `moved` delta besides `primary` and
   `secondary`, and gives a wrap no `secondary` — taken literally, every "Wrapped SOL" row would end in
   " +1 more". For `wrap` / `unwrap`, `extraAssets` is 0: the wSOL delta is the other half of the same move.
4. **No relayed failed transaction is a fixture** (Task 1). §8 says "if one exists"; the relayer has none.
5. **"A wrap into a new wSOL account" is a derived case** (Tasks 1, 2). §8 lists it as a devnet fixture; the
   wallet's own accounts never did it, nothing can be signed, and about 700 mainnet blocks held no such transaction
   on its own. Real fixtures cover its parts: a wrap into an existing wSOL account (`33qVTEpP…`), the exact rent on
   an unwrap (`3MGayyac…`), and a temporary wSOL account created and closed (`4C4tZgit…`). A23 derives the whole
   from the first by three stated field changes. For the same reason the mainnet fixtures replace §8's "New from
   devnet" for the shapes devnet's own accounts never produced (close, own ATA, send creating an ATA, failed,
   Token-2022): public data, verbatim, signature in the file name — as §8 already allows for the Jupiter swap.
6. **Rows use the shared 4-place formatter; #27 and the balance-change lines are exact** (Tasks 5, 8). §5.1 names
   the shared formatter for rows ("<0.0001" applies); §4.6 says the hero is "as in PR 1", which was exact, and its
   own example line has five places.
7. **With no account, #27 shows the fee payer and no From / To** (Task 8). §4.6's agreement rule needs the row,
   and there is no row without an account. PR 1 showed the first transfer's parties to a deep link; a deep link is
   not wired to this screen today.
8. **The "token account" caption and "From —" are gone from #27** (Task 8). Under the agreement rule a transfer
   whose recipient is only a token account, or whose sender is unknown, never shows From / To (§4.6, r3 m-e). The
   constant `TX_TOKEN_ACCOUNT` stays in the copy file, unused by this screen.
9. **`onSecureMmkvReset` clears the scan's memory, not its stored cursors** (Task 10). §6.3 says the cursors are
   "cleared through `onSecureMmkvReset`", but that hook also fires on every open of the store
   (`instances.ts` `initSecureMmkv`) — deleting the record there would restart every scan on every unlock. A wipe
   removes the cursors with the store (`clearAll`); the hook bumps the generation and empties the in-memory state.
   Cursors are keyed by exit address, so another wallet's never apply. The same reading as PR 1's link queue.
10. **`ActivityRow.signature` comes from `raw.transaction.signatures[0]`; `loadHistory` overwrites it, the slot and
    the block time from the signature list** (Tasks 2, 4). §4.1 gives `classifyActivity(raw, account, status, ctx)`
    no signature argument.
11. **Two rent deltas keep the order they were made in** (Task 2): paid rents by account index, then refunds by
    account index. §4.4's three sort keys do not separate them.
12. **A source that was empty and now has signatures is read whole on refresh, without a restart** (Task 3). §3.4
    restarts when a source "is exhausted without meeting its `newest`"; an empty source has no `newest` to meet,
    and reading it to its end leaves no hole.
13. **Sources of one kind are ordered by address** (Task 4): the wallet, funded token accounts, empty ones — each
    group sorted, so the list (and which 24 are read) is stable between reads.
14. **More than 20 uncached signatures are read in batches of 20** (Task 4). After the 24 h collection, or on a
    scan, one batch could otherwise carry hundreds of requests.
15. **An unreadable transaction does not end the scan of its source** (Task 9). §6.3: "the result is `failed`, and
    no cursor for that source moves" — it does not say to stop, and a link further down is still a link.
16. **The scan's sources are not bounded to 25** (Task 10). §6.3 says "as in §3.1" (every token account), and its
    own cap is per source.
17. **Lamports that are not a safe integer make the row `incomplete` and claim no native change** (Task 2). §4.2
    names only token entries as unattributable; a JSON number above 2^53 has already lost digits.
18. **The history's two old hooks are removed; the two `queries.ts` functions stay** (Tasks 7, 8).
    `useTransactionHistory` and `useTransactionDetail` have no caller left; `getTransactionHistory` and
    `getTransactionDetail` keep their tests and are left alone (not in the spec's scope).

## Findings for the owner (questions, not decisions — Task 12 Step 6)

1. **Transactions of a version above 0 exist on chain today.** While looking for fixtures, `getBlock` on both
   public endpoints answered `-32015 Transaction version (1) is not supported by the requesting client` when asked
   with `maxSupportedTransactionVersion: 0`. The spec fixes that parameter at 0; whether web3.js 1.99 can parse an
   answer of another version was not checked. Such a transaction in a wallet's history shows as "Transaction —" (a partial row,
   never dropped — tests R14, H7), and it makes that page fall back to one-at-a-time reads. How common they are in
   a normal wallet was not measured. Reading them needs a web3.js that knows the version: a later PR.
2. **On the public endpoints a 20-request batch is partly refused.** The first try of Task 1's measurement gave 11
   of 20 items `429` on both clusters (not a clean measurement — see Task 1 Step 4). A build that falls back to
   the public endpoint (`HELIUS_RPC_URL` missing) would show mostly partial rows. The app's own provider is not
   measured without the owner's OK.
3. **The dashboard's hide-balances eye does not hide history amounts.** #26 now shows amounts; the spec does not
   say whether "hide balances" should cover them, and PR 1's rule ("hidden balances win") was written for
   balances. Left as drawn: amounts show. Say if they should read "•••".
