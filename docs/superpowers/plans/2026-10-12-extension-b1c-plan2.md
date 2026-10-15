# Noctura Extension B1c · Plan 2 — transactions (the decoder, lookup tables, the simulation and its balance changes, #48 without the red-flag blocks, `signTransaction` and `signAndSendTransaction`, B1b's re-authentication through #10, the history badge) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 1 (2026-10-12):** first issue, dry-run in full (every task replayed red → green on its predecessor, the whole suite, the build and every gate at every task; 59 named mutations; the E2E and visual end state in a normal launch and under `unshare -rn`). Next: the owner reads Scope §3 (every controller ruling, listed again at the end — the copy rulings marked), then a Fable 5.1 review (owner rule: every plan goes to a Fable review before execution).

**Revision 2 (2026-10-15):** applies every finding of Fable 5.1 review 1 (`.superpowers/sdd/b1c-plan2-review-1.md`, verdict "approve after fixes": M1–M4, L1–L11) with the owner's decisions of 2026-10-15 — M3 a new page code `send-failed` (spec rev 3.3 §1.6), M4 dependent batches accepted as unapprovable in B1c-2 (spec §9 row; B1c-3 must solve them), the copy rulings accepted as proposed except L3, L4 and L7 (owner-delegated wording, Scope §3). Where each finding landed: "Review 1 (Fable 5.1) — how each finding was applied", after Scope. The dry run was re-run in full on the revised tasks: every task red on its predecessor and green on its own tree with `tsc`, the whole suite, the build and the gates; every named mutation, new and changed ones included (78 in all); the end state's `verify` and the E2E in a normal launch and under `unshare -rn` (Dry-run record). Spec: rev 3.3 (the items above only). Next: the controller's check of this revision (owner rule: the Fable review is applied before execution).

**Goal:** Build B1c spec plan 2 ("B1c-2 — transactions", the spec's header table): the decoder (System, SPL Token and Token-2022 with the extensions B1 §3 names, the Associated Token Account program, Compute Budget, the presale program by Anchor discriminator), address-lookup-table resolution through the proxy, the simulation through the proxy with balance changes per mint in `bigint` base units, #48 in every state B1c-2 owns (simulating-blocking, simulated, a batch, re-authentication, approving, couldn't simulate, unreachable, Q21's expired blockhash, a lookalike origin, the request that can no longer be signed, origin-mismatch · auto-reject), `page.signTransaction` (1–5 transactions) and `page.signAndSendTransaction` through the existing coordinator broadcast route and B1b's `v1_pending` pattern (signed bytes and signature recorded before the broadcast; answered once), B1b's re-authentication rules through #10 (reached from the toolbar icon — D11), the provider advertising `solana:signTransaction` and `solana:signAndSendTransaction`, the "Dapp · simulated" badge on #26 and #27, E2E through `StandardWalletAdapter` (batch of five signed, six refused) and the visual pass of #48. **No red-flag block, no typed-confirm override, no unlimited-spend state** — those are B1c-3's (Scope §3, "Deferred to B1c-3"). D10: B1c-2 is a merge-to-`main` milestone; no store build until B1c-3 is on `main` too.

**Architecture:** Spec §1's layers are unchanged; B1c-2 adds the transaction path inside them. **[1] The provider** gains the two transaction features (`supportedTransactionVersions: ['legacy', 0]`): a batch is one `page.signTransaction`, each sign-and-send its own request; it refuses only what it can see is not this wallet's (another account, another chain). **[3] The background** (`src/background/dapp/`) parses each transaction with the web3.js parser it already carries and accepts it only if re-serialising gives back exactly the bytes received (`decode/wire.ts`), resolves its lookup tables through `getMultipleAccounts` (`decode/keys.ts`), decodes it with its own decoders (`decode/decode.ts`, `decode/presaleIdl.ts` generated from the presale program's IDL), and — when the window asks (`dapp.pending`), outside every queue section — simulates it through the proxy (`simulate.ts`: post − pre per mint, the fee computed locally, B1b's re-authentication reasons). `dapp.decide` approves only the simulation the window showed, still fresh and without error (C13), after B1b's re-authentication when the simulation gave reasons — a challenge the vault page (#10) proves, reached from the toolbar icon's popup, never from the window (D11). The effects (`signTx.ts`) run after `deciding` (C17): `signTransaction` signs each transaction at the account's slot; `signAndSendTransaction` signs, writes a `v1_pending` record (`origin` set, no intent), writes `sent {wire, signature}` into the entry in a section that re-checks state, instance, lock, account and grant, then broadcasts through the coordinator's route and answers the signature (or `send-failed` when the route refused it before forwarding) — a restart or a lock answers a recorded send its signature and never signs it again; the record's `firstBroadcast` (`held` → `due` → `done`, claimed atomically) makes the bytes reach the route exactly once even when the worker stopped between the entry's record and the route (review 1 M1). **[4] The approval window** gains #48 (`Tx.tsx`) and the mismatch notice (`Mismatch.tsx`) on the design's `.s9-*` classes (re-extracted). The popup gains the re-authentication strip on #11 and the OriginBadge on #26/#27 (`v1_dapp_txs`). No new permission; CSP unchanged.

**Tech Stack:** TypeScript 5 strict, React 18, Vite 8, Vitest 5 + happy-dom + Testing Library, Playwright 1.63 (contained), `@solana/web3.js` 1.99 (already — the parser, the only third-party code in the path), `@noble/curves` (ed25519, already), `@scure/base` (already). New devDependencies, E2E only (the test dApp page): `@solana/wallet-adapter-base` 0.9.28, `@solana/wallet-standard-wallet-adapter-base` 1.1.6, `bs58` 6.0.0 (Apache-2.0 / MIT).

**Spec:** `docs/superpowers/specs/2026-10-10-extension-b1c-dapp-provider-design.md` (approved rev 3.2; rev 3.3 adds `send-failed` to §1.6, two §9 rows and a §7 line — owner, 2026-10-15) — the header table's second row; §1.3 (B1c-2's modules), §1.4 (the two transaction messages), §1.5 step 2 (the send's restart rule, C17), §1.6, §2.3 (`dapp.decide`'s table, extended), §3.3 (all), §4.3, §5 ("the worker dies mid-signature"), §6.1, §6.3 (B1c-2), §6.4 (#48), §7, §9 (#48 rows), §10 (Q21, Q26). Parent: B1 spec §3 (`docs/superpowers/specs/2026-09-27-extension-b1-design.md`) and §4's broadcast route, binding where B1c does not refine them. Design (binding): `/home/user/Downloads/index.html` — #48 ix:18261-18705 (its DS class map, states and navigation at ix:18522-18565), its CSS ix:3824-3859; #26b ix:11813 and #27b ix:12163 (the OriginBadge, CSS ix:4080-4089); `screen.md` §48. Template: `docs/superpowers/plans/2026-10-10-extension-b1c-plan1.md` (its conventions are this plan's).

## Global Constraints

Every task's requirements include these.

- Mutations only in a scratch copy outside the repo.
- Every task touching repo-root src/ runs the FULL root jest; core/ tests run under extension's and web's vitest. (Task 2 touches `core/solana/rpc.ts`: the dry run ran web's `npm run verify` and the root `tsc` + `jest` on the end state.)
- Before pushing, reproduce CI with ONLY web/ and extension/ installed on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`), npm 11.6.2.
- e2e makes no value/type imports from core/.
- E2E containment: ctx.route + --host-resolver-rules for every noc-tura.io name AND solscan.io, counters asserted empty; containment positive-control spec and zero-CSP-violation spec stay.
- Tests never contact *.noc-tura.io or solscan.io.
- Commit trailers name the executing model truthfully.
- The TGE date is never written anywhere (repo gate).
- extension/ has no eslint gate; never add eslint-disable.

And, from B1c-1's plan (verbatim where it applies) and the lessons of executing it:

- **Mutations:** `git archive HEAD | tar -x -C "$(mktemp -d <scratch>/mut.XXXXXX)"`, `node_modules` linked FROM the copy (`ln -s <repo>/extension/node_modules <copy>/extension/node_modules`, the same for `web/` and the root), every run under `timeout 300`. Linked is right for unit mutations and for the E2E ones (they need only the build); anything that runs `npm run gates` or reads the build's module maps needs `extension/node_modules` COPIED (`cp -a`). **A mutation is judged by `tsc`'s own exit code first** (`npx tsc --noEmit; echo $?` — never piped through `tail`, which reports `tail`'s): a mutant that does not compile is INVALID, not red. Never `git worktree`, never the repository's own files or its `node_modules`, never `pkill` with a pattern — kill by task id or exact PID only.
- **Rule 6:** every confirming, rejecting, revoking, blocking and opening control is a `LockedButton` (popup and approval window) — #48's Approve and its demoted form, Reject, Reject and report, the mismatch notice's [OK, return to dApp], the popup's re-authentication strip. Tests lift `disabled` before a second click where happy-dom drops it.
- **C15 on top of rule 6 in the approval window:** no CTA focused at open; Approve (and "Approve anyway (not recommended)", "I understand the risk") held 500 ms after the window gains focus and after each state change — the request, **a new simulation (its id)**, the re-authentication's state, busy, the confirm — via `useArmed`, which compares its key in the same render (never a boolean an effect resets: a confirming CTA is never enabled for even one render before the hold); Reject never held; Enter never confirms.
- **Effects happen once (C17), and only from `deciding`.** `deciding` is written in the section that passed every check; each effect section re-checks `state === 'deciding' && decidedBy === instance`, the session unlocked, the account still in it and the grant still held (`signTx.ts` `stillDeciding`). For `signAndSendTransaction` the signed bytes and the signature are recorded in the entry BEFORE the broadcast; a restart, a dead effect or a lock answers a recorded send `{signature}` (queue.ts `restartAnswer`) and never signs or broadcasts again; an unrecorded one is answered `rejected`. **Exactly-once first broadcast (review 1 M1):** a dApp record is written `held`; whatever answers a page `{signature}` from the entry's recorded bytes marks the record `due` inside the same section, before the answer is stored (`queueAccess`, the lock hook); the effect (`broadcastFirst`) and the poller's first round each claim the record `→ done` in one `updatePending` before handing the bytes to the route — whoever claims, sends; nobody else. A `held` record whose request ended otherwise is never sent.
- **Every write to a dApp key runs inside `dappSection`** (dappMutex → sessionMutex): the queue (with the simulation and the challenge id written onto an entry), the grants, the blocks, the limits and the new `v1_dapp_txs`; `wipeDappStores` removes all four storage.local keys under the same lock order. No section awaits the network: the simulation's reads run between two sections, and a result is stored only if its entry is still `queued`. The challenge store takes sessionMutex itself, so the re-authentication gate runs outside every section (its reads inside a section are read-only loads).
- **Readers return fresh objects** (B1c-1's shared-default lesson): `simStateOf`, `dappTxsOf`, `entryOf`, `txsOf` rebuild every value; nothing hands out a module-level default to mutate.
- **Fail closed, never open:** a read that throws during a simulation is stored as `unreachable` (only Reject); a missing price is above the dollar threshold; a token whose decimals cannot be read is shown in base units; an account a lookup table does not resolve makes its instruction an unknown program; a request whose bytes or account no longer read back is Q26 (only Reject); a blocked host's lingering grant never reaches a window, a notice or an answer but `rejected`.
- **Answers never reach a page before its `accepted`** (the relay drops them): the mismatch notice's entry has the relay id `''` — no page's — and its page is answered `unauthorized` inline.
- **Every async path checks its generation / `alive` after each await**: the window's poll (B1c-1's), the popup's `dapp.reauth` read (Home), and in the background every effect section re-checks its own state.
- **UI:** danger buttons `btn btn-destructive`; the busy primary `app-cta-busy`; nothing that vouches for a site on a warning screen (#48's origin pill only for a verified or unknown origin, never a lookalike); every control visible at 412 × 720 (the visual pass asserts the sticky bar's buttons wholly in the viewport); the design's own classes (`design-ext.css` regenerated, never edited).
- **Generated files and their generators** (review 1 M2, B1c-1's `gen-icon.mjs` ruling): `extension/src/styles/design-ext.css` is generated only, by `extension/scripts/extract-design-css.mjs` (committed in Task 7; `--check` compares against the design file; a test checks, without the design, that the file is the script's header and only rules the script keeps; the hash is re-pinned); `src/background/dapp/decode/presaleIdl.ts` is generated only, by `extension/scripts/gen-presale-idl.mjs` (committed in Task 1, the IDL path as its argument; a test checks, without the ICO repository, that the file hashes to the generator's pinned `OUTPUT_SHA256` and is byte for byte the generator's output for its own content; another recomputes every discriminator). A generator is never kept outside the repository; CI never runs one. `src/app/app.css` is hand-written.
- **Tests:** positive AND negative controls; a "flake" in a security UI is a finding, never fixed with `waitFor`/timeouts — a window test waits on the background's own state, then gives the window the read it would make on its next poll (a focus or `visibilitychange`), never on the wall clock; visual shots assert their own copy and are taken after holds (the coordinator's answers or a `dapp.decide` held by the test), clear of sticky bars (`pop`).
- **The page is untrusted, the window is untrusted, the port's sender is the browser's** (B1c-1). Every transaction is parsed from the page's own bytes, re-parsed from storage whenever it is shown or signed, and signed exactly as received (one slot written).
- **Copy:** only the strings the spec quotes (§3, §10 — Q21, Q26), the design's own (#48, #26b, #27b), B1 §3's ("unknown program") and B1b's (#19's "Couldn't simulate" and its server line, #20's labels, #10's reasons); anything else is a controller ruling flagged to the owner (Scope §3 R22).
- CLAUDE.md: the design is binding — every scope-down is stated (Scope §3, "Deferred to B1c-3"); TypeScript strict, no `any`, no `@ts-ignore`; no placeholders; amounts as `bigint` base units (rule 2); UTC in data; Prettier style of the surrounding code.
- **No escaped-character drift:** test strings with invisible or confusable characters are written as `\u` escapes (none are needed in this plan's tests; `git diff main -- extension core | grep -P '^\+.*[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{0430}]'` — the lines this plan adds — is empty; `challenge.test.ts` already holds two such characters from B1b, untouched).

## Review Focus

Six inputs the spec implies that a person will meet and no first draft of a task exercised — each now has its test in the owning task (named there).

1. **A refresh that lands between the window's read and the click** (the 30 s re-simulation, §3.3): the user approves what they saw — the background must refuse the click as `stale` and the window must show the new effects and hold Approve again, never approve effects the user did not see. The window also says why the click did nothing (review 1 L4), and the user's proof of re-authentication is not spent by that refusal (review 1 L1). Tests: Task 4 (`signTx.test.ts`, "a refresh that lands between the window's read and its click", "a refresh that lands while the gate reads the proof"), Task 7 (`tx.test.tsx`, "C15: a new simulation re-holds Approve", "a refresh that lands between the read and the click (stale)").
2. **A transaction someone else pays for** (the dApp is the fee payer and has signed; the account is a required signer): no fee row (the account pays none), its id is the dApp's signature (not listed for the badge on a sign-only request), the dApp's own signature kept byte for byte. Tests: Task 4 ("approve: every transaction of a batch signed at the account's slot, the co-signer's signature kept"), Task 5 ("a co-signed transaction: broadcast with both signatures"), Task 2 ("the fee: … none of the account's when another account pays").
3. **A writable token account that is not the user's** (the recipient's): its amount moves in the simulation, but it is not the user's balance change — only accounts whose owner field is the user's count; a token account the transaction creates for the user, and one it closes, do. Tests: Task 2 (`simulate.test.ts`, "a writable token account of SOMEONE ELSE …", "tokens: … a new account … gains … a closed account loses all").
4. **A legacy (not v0) transaction**: half the dApps still send them — parsed, decoded, simulated and signed at its slot with every other byte the dApp's. Tests: Task 3 (`txPage.test.ts` positive controls), Task 4 (`signTx.test.ts`, "a legacy transaction").
5. **A durable-nonce transaction through sign-and-send**: it never expires, so B1b's pending record would one day say "not confirmed — no funds moved" about a transaction that can still land — refused for sign-and-send (R12), signed for sign-only. Test: Task 3 (`txPage.test.ts`, "signAndSend: … no durable nonce").
6. **A worker stopped between the entry's record and the route** (review 1 M1 — Chrome idles the worker, the browser crashes, a lock closes the window): the restart answers the page `{signature}` from the entry, so the bytes must still reach the route — once, never twice, and never when the page was answered `rejected`. Tests: Task 5 (`signSend.test.ts`, "a restart after the entry recorded the bytes and before the route", "a lock after the entry recorded the bytes, the effect stopped", "a stop between the record and the entry's `sent`", "the effect and the poller never both send").

---

## Scope — what plan 2 builds, the seams it uses, every departure, and where the trust boundary sits

### 1. Plan 2 builds

- **The decoder (Task 1):** `decode/wire.ts` (one canonical legacy or v0 transaction of at most 1 232 bytes, or nothing), `decode/keys.ts` (lookup tables), `decode/decode.ts` (System, SPL Token, Token-2022 with its transfer hook and permanent delegate, ATA, Compute Budget, the presale program), `decode/presaleIdl.ts` (generated from the presale program's IDL by the committed `scripts/gen-presale-idl.mjs` — see R1).
- **The simulation (Task 2):** `simulate.ts` (lookup tables read once, the account's state before, each transaction simulated with the wallet account and every writable account it names, balance changes per mint, the fee computed locally, B1b's re-authentication reasons), `reauthPolicy.ts`'s `dappReauthReasons`, and `core/solana/rpc.ts`'s `getAccountsData` (getMultipleAccounts with data — allowed on the proxy).
- **The page side (Task 3):** `txRequest.ts`, `page.signTransaction` and `page.signAndSendTransaction` in `pageApi.ts` (every refusal by its reason and in its order), the origin-mismatch notice entry, and the provider's two transaction features.
- **Pending and decide for transactions, and the `signTransaction` effect (Task 4):** `signTx.ts` (the simulation run when the window asks and refreshed every 30 s, #48's view, the decision's checks — the simulation shown, fresh, without error — the re-authentication gate, the signature), the `dapp` challenge kind in `reauthChallenges.ts` (at most 16 mints listed, the rest counted — R28).
- **The `signAndSendTransaction` effect (Task 5):** the signed bytes recorded (v1_pending, then the entry) before the broadcast through the existing route; the restart / dead-effect / lock answer for a recorded send and the record's exactly-once first broadcast (`firstBroadcast`, R13); `send-failed` for a refused broadcast (R14); `v1_dapp_txs` (the history badge's list, a dApp key, wiped by a delete) and `wallet.history`'s `origin`.
- **Re-authentication through the toolbar (Task 6):** `dapp.reauth` (popup and UI tab only), the strip on #11, #10 describing a site's transaction (`unlock/challenge.ts`, `unlock/screens/reauth.ts`).
- **#48 in the approval window (Task 7)** with the mismatch notice and the committed `scripts/extract-design-css.mjs`; **the badge on #26 and #27 (Task 8)**; **E2E B1c-25 … B1c-28 (Task 9)**; **the visual pass (Task 10)**.

### 2. The seams it uses, as B1b and B1c-1 laid them

- **The queue entry** (`store.ts` `Entry`) gains `transactions`, `granted` (Task 3), `sim`, `challengeId` (Task 4) and `sent` (Task 5) — each read back field by field (`entryOf`), absent on an entry an older background wrote (read as null). `dappSection`'s `Tx` gains `txs` (`v1_dapp_txs`).
- **`dapp.decide`'s table** (§2.3) runs as in B1c-1 for every row; a transaction request adds the simulation rows (R7) and, outside the section, the re-authentication gate (R9); the `deciding` section then re-checks everything. A connect or a `signMessage` decision takes exactly the one section it took in B1c-1 (the routing peek reads without a section and decides nothing).
- **B1b's pending store and poller** (`pendingStore.ts`, `pending.ts`): a record gains `origin` (null for the wallet's own send) and `firstBroadcast` (`done` for the wallet's own, never in a view), and its `intent` becomes nullable (a dApp's record has none); `recordDappSend`, `broadcastFirst` and `dropDappSend` reuse `deliver` and `startPoller` unchanged; `pollOnce` first hands any `due` dApp record to the route (review 1 M1), then polls as before. `inFlightFor` and `wallet.pending` see the wallet's own sends only.
- **B1b's re-authentication** (`reauthChallenges.ts`, #10): a third challenge kind, `dapp`, issued / proven / consumed through the existing functions; `vault.reauthOk` satisfies it as a send's (only `settings` is applied there).
- **The lock hook and the sweep** answer a `deciding` entry through one function, `restartAnswer` (queue.ts); both mark the record of a send answered its signature `due` (`markDue`, `promised`) before the answer is stored. A send's dead-effect TTL is 45 s (`SEND_DECIDING_TTL_MS`, above the route's 30 s — R29).
- **The page error codes** (`store.ts` `ERROR_CODES`, the provider's `protocol.ts` and `bridge.ts`) gain `send-failed` (spec rev 3.3 §1.6, R14).
- **The popup's engine** gains `dappReauth()`; `HistoryItem` gains `origin`; `Switcher.test.tsx`'s full stub engine gains the call.
- **The design-ext pin** (`designExt2b.test.ts`) is re-pinned in the task that regenerates the file (Task 7); the file's header now names the committed script.

### 3. Departures and controller rulings (each loud; R-numbers are listed again for the owner at the end)

The spec leaves these open or the dry run found them; each is the most secure default, stated. **(copy)** marks a ruling whose wording the owner should confirm.

**#48's design states, every one (index.html ix:18261-18705, its "C · States"):**

| design state | B1c-2 |
|---|---|
| 1 · simulating-blocking (banner, skeleton at .55, instructions visible, "mandatory — no skip", Approve disabled "· simulating", ✕ disabled) | **built** (Task 7) — the meta line is #19's own server line (R2a), no 900 ms progress (spec §9) |
| 2 · red-flag-unlimited-spend · typed-confirm | **DEFERRED TO B1c-3** — the danger banner, "Recommended alternative", the typed-confirm field, "Approve unlimited". Until then an Approve/ApproveChecked by the account asks for re-authentication (R10), and **B1c-2 has no blocks at all** (D10: no store build) |
| 3 · approving · shielded · debounced | the **transparent** approving state is built ("Approving", the body at .65, "Approving…" with the ring, every CTA and ✕ disabled); the shielded variant is **B2** (spec §9) |
| 4 · origin-mismatch · auto-reject | **built** (Tasks 3, 7) — R16, R17 |

The states the design does not draw and B1c-2 needs are built and listed in R19–R21: simulated (state 2's body without its flag), a batch, re-authentication, couldn't simulate, unreachable, Q21's expired blockhash, a lookalike origin, Q26.

**Owner-delegated decisions (2026-10-15).** The owner delegated the copy to the controller and accepted R2, R9, R10, R18 and R22 as proposed, except three lines, now worded as the owner decided: **L3** — the empty balance-changes line reads "No SOL or token balance changes — review the instructions below."; **L4** — a `stale` refusal shows "The transaction changed while you were reviewing. Review it again before approving."; **L7** — #48 says who sends: sign-only "The site sends this transaction itself after you approve.", sign-and-send "Noctura sends this transaction as soon as you approve.". The owner also decided **M3** (`send-failed`, R14) and **M4** (dependent batches unapprovable in B1c-2 — R6, spec §9). One new string is the controller's and still the owner's to confirm: R28's "and <n> more tokens" (#10).

**Dependent batches — unapprovable in B1c-2 (owner, 2026-10-15; review 1 M4; spec §9's new row):** a `signTransaction` batch whose later transactions need an earlier one's effect (create a token account, then transfer to it; a swap's setup / swap / cleanup) simulates those later transactions as failed (R6) and so offers only [Reject] (R8). This is the commonest real batch shape: B1c-2 cannot approve it. **B1c-3 must solve dependent batches** — e.g. a per-transaction override for a failure attributable to an earlier transaction of the same batch (the decoder knows ATA `create` / `createIdempotent` and System `createAccount`) — not leave them to the typed override of every failed simulation. The PR says so.

**Deferred to B1c-3, loudly (the spec's header table, §3.3 last bullet):** B1 §3's whole red-flag table — the "unknown program" and "not a transfer" warning banners (B1c-2 shows the decoded rows, `unknown program` in mono, with no banner), the blocks (System Assign/Allocate on the account, SetAuthority on an account the user owns, an Approve of the whole balance or u64::MAX), the override (typed symbol or word + re-authentication), the Token-2022 extension warnings (transfer hook, permanent delegate, freeze authority on a held token), the durable-nonce warning, "whole or nearly whole balance to a first-time address" as a warning, "simulation failed and the user continues", and the 1.5 s Confirm hold on any red-flag screen. Also for B1c-3's plan (review 1 L3): the "No SOL or token balance changes — review the instructions below." line must be replaced on any screen with a decoded `assign`, `setAuthority`, `approve` / `approveChecked` or `closeAccount` by the account — an instruction that moves no balance can still hand the account away; B1c-2 has no blocks (D10), and its PR names this.

- **R1 — the presale IDL is not in this repository.** It lives in the ICO repository (`Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp`, `lib/idl.json` at 75450df, sha256 `f31122758227e59673ad165aea75856d2ebb37be03a70d4c7e72c36c5e53c86a`, program `6nTTJwtD…LXJvt`, 36 instructions; its `target/idl/ico.json` has the same instructions with another hash). Task 1's generator, **committed** as `extension/scripts/gen-presale-idl.mjs` (review 1 M2), writes `decode/presaleIdl.ts` from it — names, discriminators, argument types, account names — refusing any file but the pinned IDL (`IDL_SHA256`) and any output but the pinned one (`OUTPUT_SHA256`). The tests need no copy of the IDL: `presaleIdl.test.ts` recomputes every discriminator as `sha256("global:" + name)[0..8]` (Anchor's rule); `scripts/__tests__/gen-presale-idl.test.mjs` checks the file hashes to `OUTPUT_SHA256` and is byte for byte `presaleSource()` of its own content (with negative controls). A later IDL change is a re-run with the new hashes pinned. Run from `extension/`: `node scripts/gen-presale-idl.mjs ../../../Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/lib/idl.json` (the ICO repository is `/home/user/Solana/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/…`, beside `/home/user/Solana/Project/` — rev 1's `../Solana-Multi-…` was wrong).
- **R2 — what a decoded instruction shows.** Every tag of a decoded program is named (`mintTo`, `withdrawNonceAccount`, …); fields only for the spec's list (§3.3) — a known program's tag the wallet does not know is `unknown instruction` **(copy)**; a program outside the set is B1 §3's `unknown program`, its whole address in groups of four (B1 §3 "addresses in full" — a phisher's program is not shortened); a decoded program's address short with the design's mono name (`1111…1111 · system_program`, as #48 draws `TokenkegQ…iU · spl_token`). Field names are the programs' own identifiers, in mono (no prose to confirm). (R2a: the simulating banner's meta line is #19's `Noctura server · simulateTransaction` — the design's "helius-mainnet · slot … · 487 / 900 ms" names an RPC the wallet does not see and a budget §9 dropped.)
- **R3 — every address in an instruction is shown whole, in groups of four, with a label where known** (B1 §3): "Your account: <name>" for one of the wallet's accounts, the address-book name (`fromBook`) for a contact — #20's own labels.
- **R4 — the simulated accounts** are the wallet account and **every writable account the transaction names** (resolved through its lookup tables), not only the token accounts the user held before (§3.3's wording): a token account the transaction creates for the user (a swap's output) or closes is then seen. Only accounts whose owner field is the user's count as the user's (Review Focus 3).
- **R5 — the SOL change is what the node reports** (post − pre of the wallet account, the fee included, as the coordinator measured a real node answer — B1b §11.5); the Network fee row is computed locally (B1 §4: 5 000 per signature plus the priority fee the transaction itself sets; without a limit instruction, 200 000 units per other instruction, at most 1 400 000) and shown only when the account is the fee payer (Review Focus 2).
- **R6 — a batch's transactions are simulated one by one against the current state** (a node cannot chain them); each section shows its own effects (B1 §3). Consequence (review 1 M4, **owner: accepted**, spec §9): a dependent batch is unapprovable in B1c-2 — see "Dependent batches" above.
- **R7 — the simulation shown is the one approved.** `dapp.decide` for a transaction names the simulation's id; another (a refresh landed), one 40 s old (`SIM_VALID_MS`: the 30 s refresh plus ten seconds to land) or none is `stale` / `not-simulated`, and the window re-reads (C13; Review Focus 1). The refresh runs when the window asks after 30 s (§3.3); an unreachable proxy is retried after 5 s.
- **R8 — couldn't simulate, unreachable, expired (Q21): only Reject in B1c-2** (B1 §3 makes "approve anyway" a red flag — B1c-3 adds that path with its override).
- **R9 — re-authentication is reached from the toolbar icon, never from the window** (D11: "the password is typed only after clicking the Noctura icon"; §4.3: the window holds "no link into the vault page"). The spec's §3.3 says "B1b's rules through #10" without saying how #10 is reached: B1b's #20 opens #10 in a new tab, which from a window a site caused would teach the one thing D11 forbids. So: Approve asks the background, which issues the challenge and answers `reauth-required`; the window says "Confirm it's you · Click the Noctura icon in your browser's toolbar and confirm with your password (or passkey). This request will wait here." **(copy — accepted, owner-delegated 2026-10-15)**; the popup (#11) shows a strip "A transaction from <site> waits for your confirmation" **(copy — accepted, owner-delegated 2026-10-15)** that opens #10; #10 describes the site's transaction ("You are about to approve", "Site", each token leaving the account, the reasons) and only proves — "Confirmed. Go back to the approval window and approve the transaction." **(copy — accepted, owner-delegated 2026-10-15)**; the user approves again in the window. Before the first Approve the window says "Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon." **(copy — accepted, owner-delegated 2026-10-15)**. #10's own expired and locked lines for a site's request: "This confirmation has expired. Approve the transaction again in the approval window." / "The wallet locked while you were confirming. The site's request was declined — ask the site to try again." **(copy — accepted, owner-delegated 2026-10-15)**; its Cancel only closes the tab (the request stays in the window, which can still reject it).
- **R10 — B1b's rules for a transaction** (`dappReauthReasons`): from the simulation, each mint the account loses (SOL with its fee) against the account's balance of it before (over 5 %) and its dollar value (over the threshold; no price — any token but SOL, NOC, USDC, USDT — is above it, fail closed); from the decoded instructions, a System transfer or a Token transfer / transferChecked by the account to an address it never sent to and that is not one of its own token accounts (first send; a token account recipient is otherwise always "new" — fail closed), the whole balance to such an address, and any Approve / ApproveChecked by the account (`approval` — B1 §3 "bounded approvals"; the whole-balance and u64::MAX ones are B1c-3's blocks and re-authenticate until then). #10's line for it: "Re-auth required to approve a token allowance." **(copy — accepted, owner-delegated 2026-10-15)**. Raised by review 1 (its R10 view) and flagged here, not written into the spec (the owner allowed spec edits only for M3, M4, L6 and L10): the token-account consequence — every SPL transfer to a token account that is not the account's own re-authenticates — is a candidate §9 row for the owner. The prices are read when the simulation runs, so `dapp.decide` reads nothing.
- **R11 — the challenge's binding:** the request id, its exact bytes and its account (`dappDigest`), so a re-simulation does not void a proof but another transaction cannot use it; issued on the first Approve that needs it (never at simulation — a user who rejects is never asked), stored on the entry, single use, an expired one replaced at the next Approve and never revived. **Consumed after `deciding` (review 1 L1):** the gate only checks the proof (`proven`); `dapp.decide` consumes it right after the `deciding` section, before any key is read — so a refusal in that section (a refresh landed: `stale`; `not-head`) leaves the proof standing and the user is not asked for the password again; a consume that fails (expired, spent) ends the request `rejected` with nothing signed. Still single use: a `deciding` entry is never decided twice.
- **R12 — `signAndSendTransaction` takes only what it can send and watch:** every other required signature present and valid over the message (the route takes only a fully signed transaction — B1 §4 — and the wallet never sends one incomplete), and **no durable-nonce transaction** (its first instruction System AdvanceNonceAccount): B1b's pending record calls a send "Not confirmed — no funds moved" once its blockhash's life is over, which would be false for one that can still land (Review Focus 5). `signTransaction` (the dApp sends) signs both. `options` is accepted and ignored (the route has none).
- **R13 — the pending record of a dApp's send:** `v1_pending` with `origin` and no intent (B1b's pattern: written before anything else happens to the signed bytes); never in the popup's pending list (the transaction is the site's — #26 shows it once it lands, badged), never blocking a send of the wallet's own (`inFlightFor`); its `lastValidBlockHeight` is the latest blockhash's at simulation — an upper bound of the dApp's, so expiry is waited for at least that long, never declared early. **Its first broadcast happens exactly once (review 1 M1):** `firstBroadcast` is `held` when written; the section that answers the page `{signature}` from the entry's record (a restart's or dead effect's sweep, a lock) marks it `due` before storing the answer; the effect and the poller's first round each claim it `→ done` in one `updatePending` before handing the bytes to the route. A worker stopped between the entry's `sent` and the route: the page gets the signature and the poller sends the bytes once. A worker stopped between the record and the entry's `sent` (the review's sibling gap): the page is answered `rejected` and the `held` record is never sent — it polls to `expired` ("Not confirmed — no funds moved", true). Why not the review's literal form (a `broadcastAttemptedAt` the poller sends whenever it is null): that sends the sibling gap's bytes too — a page told `rejected` whose transaction then lands, the one direction worse than the gap (the dApp may ask again, the user approve twice). Stated limits: a browser restart wipes storage.session (the queue), so a record still `held` then is never sent (its tab is gone with the browser); a failed storage write in the lock hook's `markDue` is logged and the signature answer kept (the effect still running sends it, R15).
- **R14 — what the page gets after the broadcast (owner, 2026-10-15; review 1 M3; spec rev 3.3 §1.6):** acknowledged, or not acknowledged (it may land) → `{signature}` (B1 §3: the dApp confirms); refused before forwarding (the route's 400 with a contract reason, or the 403 cool-down refusing to try — nothing reached the network) → **`send-failed`**, the provider's fixed message "The transaction could not be sent." (rev 1's `invalid-request` said "The request is not valid.", false for the cool-down). The code is in `ERROR_CODES` on both sides and the provider's map (Task 3).
- **R15 — a lock after the bytes are recorded** answers the page `{signature}` and the broadcast still runs (the user approved it; B1b: a send in flight is not cancelled by a lock); a lock before it answers `rejected`, and bytes already written to v1_pending are marked never sent (`dropDappSend`).
- **R16 — origin mismatch** (B1 §3: "request origin differs from the granted origin → blocked, no override"; #48 state 4): a transaction request naming an account of this unlocked wallet that ANOTHER origin holds a grant for. The page is answered `unauthorized` at once — the same answer, at the same time, as any ungranted request (§2.2: it learns nothing more) — and a notice entry shows the user what was refused, only when this host is not blocked or cooling down and C3's caps admit it; its dismissal counts toward C14 like any rejection; transaction requests only (a `signMessage` is plain `unauthorized`). The provider itself refuses an account it was not given, so the notice is what a script posting straight to the relay meets (§1.1's stated limit; E2E B1c-28 does exactly that).
- **R17 — the mismatch screen** keeps the design's hero, banner, detail rows and caption, with two departures: no "Review session in Settings" (the approval window never opens a wallet page — D11/§4.3, as the locked screen), and the caption's "Settings → dApps" reads "Settings → Connected dApps" (Q03; #34 is out, D1). [OK, return to dApp] dismisses; the background refuses any other decision for a notice.
- **R18 — #48 for a lookalike origin** (granted through "Connect anyway"): the lookalike banner, no origin pill, and #46's flipped bar — [Reject and report] (`btn-destructive`), "Approve anyway (not recommended)" **(copy — accepted, owner-delegated 2026-10-15)** → the design's 2-second confirm, where only "I understand the risk" approves.
- **R19 — the origin pill** ("Request from <host> · matches active session", the design's state 2) is shown once simulated, for a verified or unknown origin — never a lookalike's (a warning screen vouches for nothing).
- **R20 — ✕ is disabled while simulating** (the design: "Close button → equivalent to Reject · disabled during simulation and approving"); [Reject] stays open (C4).
- **R21 — Q26 is #48's line too** when the request can no longer be signed (its account left the session, its bytes no longer read back): the origin card, Q26, only Reject.
- **R22 — new strings (copy — accepted, owner-delegated 2026-10-15, with L3/L4/L7 worded as the owner decided):** "No SOL or token balance changes — review the instructions below." (L3); "The transaction changed while you were reviewing. Review it again before approving." (L4); "The site sends this transaction itself after you approve." / "Noctura sends this transaction as soon as you approve." (L7); `unknown instruction`; "Transaction <i> of <n>" (a batch's section); R9's window, strip and #10 lines; R10's reason line; "Approve anyway (not recommended)"; "Token" and "<n> (base units)" (#10, a token the wallet does not name, decimals unknown); the badge's aria-label "dApp-originated transaction · simulated" (the design's provenance without its milliseconds — the wallet keeps no past simulation's timing).
- **R23 — the history badge:** `v1_dapp_txs` (background-owned, at most 500, newest first; wiped by a delete, kept by a restore — C11, as the grants) lists each transaction a site had this wallet sign by its id: every sign-and-send, and a sign-only transaction when the account pays its fee (its id is then the account's own signature — the dApp may broadcast it). Only "Dapp · simulated" is drawn: the first-party "Wallet" pill is not (the wallet knows only the transactions sites had it sign — calling every other row "Wallet" would be false for a received payment); #27b's Simulation row is not built (it reports checks B1c-3 makes and a timing the wallet does not keep).
- **R24 — the provider:** a batch is one `page.signTransaction`; `signAndSendTransaction` with several inputs sends them one request each, in turn (each its own approval); inputs naming two accounts → `invalid-request`; `chain` checked in the provider and again in the background.
- **R25 — the E2E stack:** `StandardWalletAdapter` is exported by `@solana/wallet-standard-wallet-adapter-base` (1.1.6, as `web/`'s lockfile), not by `@solana/wallet-adapter-base` (0.9.28, which has the type and `isWalletAdapterCompatibleStandardWallet`) as §3.3's wording has it — both are devDependencies, bundled only into the test dApp page (never an extension bundle: the page-bundle gate is unchanged), with `bs58` 6.0.0 their peer. `npm audit` on the result: 6 moderate (main: 4 — R32 of plan 1); the two new ones are the adapters "depending on" the same `@solana/web3.js` → `jayson` chain. Recorded, not fixed here: the extension CI's audit gate is `npm audit --audit-level=high` (`.github/workflows/extension.yml`), so the two moderates do not trip it; the PR records them beside plan 1's R32 (review 1, R25 view).
- **R26 — the window polls once a second** (B1c-1's R33): a simulation's answer reaches it on the next poll — no faster poll while simulating.
- **R27 — Firefox:** as B1c-1's R39 — the E2E run Chromium only; B1e's manual run adds "B1c-25 … B1c-28 by hand".
- **R28 — at most 16 mints in #10's description, the rest counted (review 1 L9):** a batch that loses more mints than `MAX_DAPP_OUTGOING` (16) is no longer unapprovable (rev 1's `issueChallenge` threw): `dappAbout` keeps SOL first, then the largest in USD, then the unpriced ones in the order the batch names them, and the challenge's `omitted` counts the rest; #10 adds the row "and <n> more tokens" **(copy — the controller's, owner to confirm)**.
- **R29 — a send's dead-effect TTL is 45 s (review 1 L2):** `SEND_DECIDING_TTL_MS` is above the route's `BROADCAST_TIMEOUT_MS` (30 s), so the sweep never answers a `signAndSendTransaction` while its route call may still be running (a test pins the inequality); every other type keeps `DECIDING_TTL_MS` (30 s).
- **R30 — the window says why a `stale` approval did nothing (review 1 L4):** `Approve.tsx` hands `dapp.decide`'s reply back to the screen; on `stale`, #48 shows the owner's line (L4) in a warn banner under the origin card until the next Approve click, with the refreshed effects shown and Approve held again (C15). Not shot in the visual pass (it needs a refresh landing between the window's poll and the click — a real-browser race); the window test covers it.
- **R31 — who sends, on every #48 state (review 1 L7):** the owner's line for the request's kind (L7), a caption under the origin card (`app-tx-sends`), from simulating on — in every #48 shot.
- **R32 — the provider's input check (review 1 L8):** an input with no `account` is `invalid-request` (a `NocturaError`), never a `TypeError`.

Spec items built as written and declared in its §9 are not repeated here (the ~900 ms skeleton dropped, approving · shielded is B2).

### 4. The trust boundary

| layer | what it may do | what it never does |
|---|---|---|
| the page (any script on it) | call the transaction features; post a request straight to the relay (§1.1, stated) | name an origin, a tab, a simulation or a decision; reach the window |
| the relay | forward the five method types (unchanged) | decide or add anything |
| the background | parse, resolve, decode and simulate the page's bytes; sign exactly them at the account's slot; broadcast through the route | sign a transaction it did not show and simulate; sign or broadcast twice; approve a simulation the window did not show; answer a page before its `accepted` |
| the approval window | show what `dapp.pending` says; send `dapp.decide` with the simulation's id | link into the vault page (D11); approve inside 500 ms or on Enter (C15) |
| the popup | offer #10 for the head's waiting challenge (`dapp.reauth`) | decide a request |
| #10 (the vault page) | prove the factor for a `dapp` challenge (`vault.reauthOk`) | sign or send anything |

## Review 1 (Fable 5.1) — how each finding was applied

`.superpowers/sdd/b1c-plan2-review-1.md` (2026-10-12, verdict "approve after fixes"). Owner decisions of 2026-10-15 are marked **owner**; the copy decisions the owner delegated, **owner-delegated**. Every changed task was replayed (red on its predecessor, green on its own tree, `tsc`'s own exit code, the whole suite, the build, the gates), every new or changed mutation run, and the end state verified and run end to end again (Dry-run record).

| finding | status | where |
|---|---|---|
| **M1** — a worker stop between the entry's `sent` and the broadcast loses an approved send while the page holds its signature | **fixed**, as the owner ruled ("the poller's first round broadcasts an unattempted dApp record exactly once — same bytes, same signature"), in the form that also closes the review's sibling gap safely: the record's `firstBroadcast` `held` → `due` → `done`; `due` written by whatever promises the page the signature, before the promise is stored; `done` claimed atomically by the effect or the poller's first round, the claimant alone sending. The literal `broadcastAttemptedAt` form would send a sibling-gap record whose page was told `rejected` (R13 says why that direction is worse). Tests: "a restart after the entry recorded the bytes and before the route" (positive control inside: never sent twice), "a lock after the entry recorded the bytes, the effect stopped", "a stop between the record and the entry's `sent`", "the effect and the poller never both send"; mutations M5k–M5o, M5q | Task 5; Scope R13; Global Constraints (effects once); Review Focus 6 |
| **M2** — the two generators kept outside the repository; the IDL path wrong | **fixed**: `extension/scripts/gen-presale-idl.mjs` (IDL path as argv, `IDL_SHA256` and `OUTPUT_SHA256` pinned in it) with `scripts/__tests__/gen-presale-idl.test.mjs` — needs no ICO repository: the file hashes to `OUTPUT_SHA256` and equals `presaleSource()` of its own content (negative controls; M1g); `extension/scripts/extract-design-css.mjs` (the design path from argv, `$NOCTURA_DESIGN_HTML` or the default; `--check`) with `scripts/__tests__/extract-design-css.test.mjs` (the header, and only kept rules; M7i); each header says when to re-run and that CI never runs it; the path is `../../../Solana-Multi-…` from `extension/` (absolute path given) | Tasks 1, 7; Scope R1; Global Constraints |
| **M3** — R14's `invalid-request` for a refused broadcast | **owner**: a page code `send-failed`, "The transaction could not be sent."; spec rev 3.3 §1.6's row; `ERROR_CODES` on both sides and the provider's map (Task 3, M3k); `finishSend` answers it (Task 5, M5j) | Tasks 3, 5; Scope R14; spec §1.6 |
| **M4** — dependent batches cannot be approved in B1c-2 | **owner: accepted**; spec §9 row (unapprovable in B1c-2; B1c-3 must solve dependent batches, e.g. a per-transaction override for a failure attributable to an earlier transaction of the same batch); Scope "Dependent batches"; the PR says so | Scope §3, R6; spec §9 |
| **L1** — the proof consumed before `deciding` | **fixed**: the gate checks (`proven`), `dapp.decide` consumes right after the `deciding` section; a failed consume answers `rejected` before any key is read. Tests: "a refresh that lands while the gate reads the proof: stale — the proof is not spent…", "the proof gone between the gate and the consume"; M4e (rewritten), M4k | Task 4; Scope R11 |
| **L2** — `DECIDING_TTL_MS` equals the route's timeout | **fixed**: `SEND_DECIDING_TTL_MS = 45_000` for `signAndSendTransaction`; a test pins it above `BROADCAST_TIMEOUT_MS` and checks the entry is still `deciding` at 30 s; M5p | Task 5; Scope R29 |
| **L3** — "No balance changes" reads as benign | **owner-delegated**: "No SOL or token balance changes — review the instructions below."; B1c-3's plan told to replace it on a screen with `assign` / `setAuthority` / `approve*` / `closeAccount` (Scope, Deferred); the PR names it. Test: tx.test.tsx "no balance change of the account's" | Task 7; Scope §3 |
| **L4** — a `stale` refusal re-renders silently | **owner-delegated**: "The transaction changed while you were reviewing. Review it again before approving." in a warn banner until the next click. Test: tx.test.tsx "a refresh that lands between the read and the click (stale)"; M7g | Task 7; Scope R30 |
| **L5** — two test titles claim what their scene does not do | **fixed**: signSend.test.ts "a lock between the deciding section and the effect (the auto-lock arm): rejected, nothing signed into v1_pending, nothing broadcast"; signTx.test.ts "the grant moved to another account, or revoked, while queued: no-grant both times — never a signature" (it now exercises both, and asserts no answer) | Tasks 4, 5 |
| **L6** — §9 needs the transactions' malformed-before-`unauthorized` row | **fixed**: spec rev 3.3 §9 row; `txRequest.ts`'s comment cites it | spec §9; Task 3 |
| **L7** — sign-only and sign-and-send indistinguishable on #48 | **owner-delegated**: "The site sends this transaction itself after you approve." / "Noctura sends this transaction as soon as you approve." under the origin card, every state. Tests: tx.test.tsx (both kinds); M7h | Task 7; Scope R31 |
| **L8** — the provider's `#checked` throws a `TypeError` for an input without `account` | **fixed**: `inputs[0]?.account?.address`, `invalid-request`. Test: provider.test.ts (single, in a batch, sign-and-send); M3j | Task 3; Scope R32 |
| **L9** — more than 16 lost mints made the request unapprovable | **fixed**: `dappAbout` keeps SOL, then the largest in USD, then the unpriced in order, 16 in all, and `omitted` counts the rest; #10 shows "and <n> more tokens" (controller copy, owner to confirm — R28). Tests: signTx.test.ts "dappAbout: at most MAX_DAPP_OUTGOING mints…" (with a positive control), challenge.test.ts (fail-closed `omitted`), reauthScreen.test.ts (the row); M4l, M4m, M6f, M6g | Tasks 4, 6; Scope R28 |
| **L10** — the mismatch notice can be opened by any site that knows the address | **fixed**: spec rev 3.3 §7 accepted-limits line | spec §7 |
| **L11** — test counts in the Task 4 mutation table | **fixed**: every mutation table now says its counts are from the end state's tree and that red, not the count, is the check | every task's mutation step |

The review's R-table: R1 (M2, done), R10 (the token-account consequence flagged for the owner as a candidate §9 row — not written into the spec, which the owner opened only for M3, M4, L6, L10), R14 (M3, done), R22 (L3/L4/L7, done), R25 (the CI audit gate is `--audit-level=high`; recorded in R25 and the PR) — every other ruling accepted as written.

## How to read the steps

- A **new file** is given in full. A **changed file** is a unified diff against the file as the previous task left it; save the block and apply it with `git apply --recount` from the repository root (or by hand — every hunk is exact). Several files grow task by task (`signTx.ts`, `decide.ts`, `store.ts`, `pageApi.ts`, `app.css`, some test files), so their diffs apply in task order.
- Two files are **generated**, never typed: `src/background/dapp/decode/presaleIdl.ts` (by `scripts/gen-presale-idl.mjs`, committed in Task 1; the file follows in full as well, and its tests pin it) and `src/styles/design-ext.css` (by `scripts/extract-design-css.mjs`, committed in Task 7; the diff is given for review). Neither generator runs in CI. `package-lock.json` is written by npm 11.6.2 (Task 9's command), never by hand.
- Commands run from `extension/` unless they start with `cd`. "Whole suite" is `npx tsc --noEmit && npx vitest run`. The expected totals are the dry run's task-by-task replay: each task's own test files on its predecessor's tree (red), then on its own tree (green), with `tsc`, the whole suite, `node scripts/build.mjs` and `npm run gates` at every task. A reviewer-added test raises the totals; that is not a defect.
- Background tests drive the real handlers over `fakeExt` and fake ports (`pageHarness.ts`) and a steered chain (`txHarness.ts`, Task 4); window tests render `approve.html`'s `Approve` against the real background (`windowHarness.tsx`); popup tests use B1b's `renderInWallet`. Each screen test asserts `unstyledClasses(…)` is empty.
- Task 2 touches `core/solana/rpc.ts` (a new reader method); nothing touches the repository root's `src/` or `web/`. The dry run ran web's `npm run verify` and the root `tsc` + `jest` on the end state anyway (Dry-run record).
- **Each task ends with its named mutations** — each one alone, in a fresh `git archive` copy, `tsc`'s own exit code first; every one must turn the named test red.

## Tasks

### Task 1: The decoder: the wire (one canonical transaction of at most 1 232 bytes), lookup tables, and System, SPL Token, Token-2022, ATA, Compute Budget and the presale program

**Spec:** §3.3 (Lookup tables; Decoder), §1.4 (each ≤ 1 232 bytes), D6, B1 §3 (decoded programs; "unknown program"); Scope R1, R2

**Files:**
- Test (new): `extension/scripts/__tests__/gen-presale-idl.test.mjs`
- Create: `extension/scripts/gen-presale-idl.mjs`
- Test (new): `extension/src/background/dapp/decode/__tests__/decode.test.ts`
- Test (new): `extension/src/background/dapp/decode/__tests__/presaleIdl.test.ts`
- Create: `extension/src/background/dapp/decode/decode.ts`
- Create: `extension/src/background/dapp/decode/keys.ts`
- Create: `extension/src/background/dapp/decode/presaleIdl.ts` (generated — the script in Step 3)
- Create: `extension/src/background/dapp/decode/wire.ts`

**Interfaces:**
- Consumes: `core/presale/addresses.ts` (`MAINNET_PROGRAM_ID`); `@solana/web3.js` (`VersionedTransaction`, already a background dependency); `@scure/base`.
- Produces (as exported):
  - `decode/wire.ts`: `MAX_TX_BYTES = 1232`; `interface ParsedInstruction {program: number; accounts: number[]; data: Uint8Array}`; `interface Lookup {table: string; writable: number[]; readonly: number[]}`; `interface ParsedTx {version: 'legacy' | 0; message: Uint8Array; signatures: Uint8Array[]; staticKeys: string[]; signers: string[]; header: {numRequiredSignatures: number; numReadonlySignedAccounts: number; numReadonlyUnsignedAccounts: number}; lookups: Lookup[]; instructions: ParsedInstruction[]; blockhash: string}`; `parseWire(bytes: Uint8Array): ParsedTx | null`; `isWritableIndex(p: ParsedTx, i: number): boolean`.
  - `decode/keys.ts`: `ADDRESS_LOOKUP_TABLE_PROGRAM`; `tableAddresses(data: Uint8Array): string[] | null`; `interface ResolvedKeys {keys: (string | null)[]}`; `resolveKeys(p: ParsedTx, tables: ReadonlyMap<string, readonly string[] | null>): ResolvedKeys`; `tablesOf(p: ParsedTx): string[]`.
  - `decode/decode.ts`: `SYSTEM_PROGRAM`, `TOKEN_PROGRAM`, `TOKEN_2022_PROGRAM`, `ATA_PROGRAM`, `COMPUTE_BUDGET_PROGRAM`, `PRESALE_PROGRAM`; `type ProgramKey = 'system' | 'token' | 'token-2022' | 'associated-token' | 'compute-budget' | 'presale'`; `PROGRAMS: ReadonlyMap<string, ProgramKey>`; `type FieldValue = {kind: 'address'; value: string | null} | {kind: 'lamports'; value: string} | {kind: 'amount'; value: string; decimals: number | null} | {kind: 'number'; value: string} | {kind: 'bool'; value: boolean} | {kind: 'text'; value: string} | {kind: 'hex'; value: string}`; `interface Field {name: string; value: FieldValue}`; `interface DecodedInstruction {programId: string | null; program: ProgramKey | null; name: string | null; fields: Field[]}`; `AUTHORITY_TYPES`; `decodeInstructions(p: ParsedTx, r: ResolvedKeys): DecodedInstruction[]`; `addressField(ix: DecodedInstruction, name: string): string | null`.
  - `decode/presaleIdl.ts` (generated): `type PresaleArgType`; `interface PresaleInstruction {name; discriminator; args; accounts}`; `STAKE_TIERS`; `PRESALE_INSTRUCTIONS` (36).
  - `scripts/gen-presale-idl.mjs` (committed): `OUT_PATH`, `PROGRAM_ID`, `IDL_SHA256`, `OUTPUT_SHA256`, `presaleSource(idl, idlSha): string`.

A pure module, no reads. `parseWire` accepts the page's bytes only when they are exactly one canonical legacy or v0 transaction of at most 1 232 bytes — the web3.js parser the background already carries, then re-serialised and compared byte for byte, so trailing bytes, a non-canonical length or a signature count that disagrees with the header are refused, and what is shown, simulated and signed is one thing. `resolveKeys` builds the full key list in the runtime's order (static keys, then each lookup's writable, then each lookup's readonly) from the tables as read (Task 2 reads them); an index a table does not hold is null. `decodeInstructions` names every instruction of the six programs and decodes the spec's list with exact field names and values (amounts as base-unit strings — u64::MAX survives); an instruction that touches an unresolved account is an unknown program, whatever its program (§3.3). The presale program is decoded by its Anchor discriminators from `presaleIdl.ts`, generated from the program's IDL (R1).

`presaleIdl.ts` is generated, never typed, by `scripts/gen-presale-idl.mjs` — **committed** with this task (review 1 M2; B1c-1's `gen-icon.mjs` ruling), given in full below. Run it from `extension/` with the IDL's path (the ICO repository's `lib/idl.json` at 75450df; it refuses any other file and any output but the pinned one): `node scripts/gen-presale-idl.mjs ../../../Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/lib/idl.json` (absolute: `/home/user/Solana/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/lib/idl.json`) — it prints the output's sha256, `48651d64226625871caa39d79b42028e0e129c0d8e1cac3b9dafcb4541512886`, and 36. CI never runs it: `scripts/__tests__/gen-presale-idl.test.mjs` checks without the IDL that the file hashes to the generator's `OUTPUT_SHA256` and is byte for byte `presaleSource()` of its own content. The file follows in full as well, for review.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/gen-presale-idl.test.mjs`:

````js
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {IDL_SHA256, OUTPUT_SHA256, OUT_PATH, PROGRAM_ID, presaleSource} from '../gen-presale-idl.mjs';
import {PRESALE_INSTRUCTIONS, STAKE_TIERS} from '../../src/background/dapp/decode/presaleIdl';

// Global constraints (plan 2 review 1 M2): presaleIdl.ts is generated only — it must be exactly what the committed
// generator writes. The IDL itself is in the ICO repository, which CI does not have: the table's own content, turned
// back into the IDL's shape, must give the committed file byte for byte, and the file must hash to the pinned output.
const idlOf = (instructions, tiers) => ({
  address: PROGRAM_ID,
  instructions: instructions.map(ix => ({
    name: ix.name,
    discriminator: [...ix.discriminator],
    args: ix.args.map(a => ({name: a.name, type: a.type === 'tier' ? {defined: {name: 'StakeTier'}} : typeof a.type === 'object' ? {array: ['u8', a.type.bytes]} : a.type})),
    accounts: ix.accounts.map(name => ({name})),
  })),
  types: [{name: 'StakeTier', type: {kind: 'enum', variants: tiers.map(name => ({name}))}}],
});

describe('the presale IDL generator', () => {
  it('presaleIdl.ts hashes to the generator’s pinned OUTPUT_SHA256', () => {
    expect(createHash('sha256').update(readFileSync(OUT_PATH)).digest('hex')).toBe(OUTPUT_SHA256);
  });

  it('presaleIdl.ts is byte for byte presaleSource() of its own content (no IDL file needed)', () => {
    expect(presaleSource(idlOf(PRESALE_INSTRUCTIONS, STAKE_TIERS), IDL_SHA256)).toBe(readFileSync(OUT_PATH, 'utf8'));
  });

  // Negative controls: a changed table gives a different file; another program and a wrong discriminator are refused.
  it('a changed instruction gives a different presaleIdl.ts; another program or a wrong discriminator is refused (negative controls)', () => {
    const renamed = PRESALE_INSTRUCTIONS.map((ix, i) => (i === 0 ? {...ix, accounts: [...ix.accounts, 'extra']} : ix));
    expect(presaleSource(idlOf(renamed, STAKE_TIERS), IDL_SHA256)).not.toBe(readFileSync(OUT_PATH, 'utf8'));
    expect(() => presaleSource({...idlOf(PRESALE_INSTRUCTIONS, STAKE_TIERS), address: '11111111111111111111111111111111'}, IDL_SHA256)).toThrow('another program');
    const wrong = PRESALE_INSTRUCTIONS.map((ix, i) => (i === 0 ? {...ix, discriminator: ix.discriminator.map((b, j) => (j === 0 ? b ^ 1 : b))} : ix));
    expect(() => presaleSource(idlOf(wrong, STAKE_TIERS), IDL_SHA256)).toThrow('discriminator of');
  });
});
````

Create `extension/src/background/dapp/decode/__tests__/decode.test.ts`:

````ts
import {base58} from '@scure/base';
import {
  ComputeBudgetProgram,
  Keypair,
  NONCE_ACCOUNT_LENGTH,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type AddressLookupTableAccount,
} from '@solana/web3.js';
import {buildSolPurchaseInstruction, findAssociatedTokenAddress} from '../../../../../../core/presale/buyInstructions';
import {buildCreateAtaIdempotentInstruction, buildTransferCheckedInstruction} from '../../../../../../core/solana/transfer';
import {PUB, RECIPIENT, BLOCKHASH} from '../../../__tests__/fixtures';
import {ADDRESS_LOOKUP_TABLE_PROGRAM, resolveKeys, tableAddresses, tablesOf} from '../keys';
import {ATA_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, decodeInstructions, type DecodedInstruction} from '../decode';
import {MAX_TX_BYTES, isWritableIndex, parseWire, type ParsedTx} from '../wire';

const ME = new PublicKey(PUB);
const TO = new PublicKey(RECIPIENT);
const MINT = new PublicKey('B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW');
const SRC = new PublicKey('4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF');
const DST = new PublicKey('FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU');
const UNKNOWN = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');

const v0 = (instructions: TransactionInstruction[], tables: AddressLookupTableAccount[] = []): Uint8Array =>
  new VersionedTransaction(new TransactionMessage({payerKey: ME, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message(tables)).serialize();
const legacy = (instructions: TransactionInstruction[]): Uint8Array => new Transaction({feePayer: ME, recentBlockhash: BLOCKHASH}).add(...instructions).serialize({requireAllSignatures: false, verifySignatures: false});
const parsed = (bytes: Uint8Array): ParsedTx => {
  const p = parseWire(bytes);
  if (p === null) throw new Error('did not parse');
  return p;
};
const decodeAll = (bytes: Uint8Array): DecodedInstruction[] => {
  const p = parsed(bytes);
  return decodeInstructions(p, resolveKeys(p, new Map()));
};
const one = (ix: TransactionInstruction): DecodedInstruction => {
  const [d] = decodeAll(v0([ix]));
  if (d === undefined) throw new Error('no instruction');
  return d;
};
const u64 = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const tokenIx = (program: string, data: number[], keys: PublicKey[]) =>
  new TransactionInstruction({programId: new PublicKey(program), data: Buffer.from(data), keys: keys.map((pubkey, i) => ({pubkey, isSigner: i === keys.length - 1, isWritable: i === 0}))});

// Spec B1c §3.3, §1.4: the bytes a page sends are one canonical transaction of at most 1 232 bytes, or nothing.
describe('parseWire', () => {
  it('reads legacy and v0 transactions: version, signers (fee payer first), the message bytes, the blockhash', () => {
    const ix = SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1});
    const l = parsed(legacy([ix]));
    expect(l.version).toBe('legacy');
    expect(l.signers).toEqual([ME.toBase58()]);
    expect(l.blockhash).toBe(BLOCKHASH);
    const p = parsed(v0([ix]));
    expect(p.version).toBe(0);
    expect(p.signers).toEqual([ME.toBase58()]);
    expect(p.signatures).toEqual([new Uint8Array(64)]);
    expect(p.message).toEqual(VersionedTransaction.deserialize(v0([ix])).message.serialize());
    expect(p.lookups).toEqual([]);
  });

  it('refuses anything but exactly one canonical transaction: trailing bytes, too long, empty, garbage', () => {
    const bytes = v0([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]);
    expect(parseWire(Uint8Array.of(...bytes, 0))).toBeNull();
    expect(parseWire(new Uint8Array(0))).toBeNull();
    expect(parseWire(Uint8Array.of(1, 2, 3))).toBeNull();
    // A message padded with a memo-like data blob to 1 233 bytes: one past the packet limit.
    const filler = (n: number) => new TransactionInstruction({programId: UNKNOWN, keys: [], data: Buffer.alloc(n)});
    const at = (n: number) => v0([filler(n)]);
    let n = 900;
    while (at(n).length < MAX_TX_BYTES) n++;
    expect(at(n).length).toBe(MAX_TX_BYTES);
    expect(parseWire(at(n))).not.toBeNull();
    expect(parseWire(at(n + 1))).toBeNull();
  });

  it('isWritableIndex follows the header (signers, then unsigned static keys)', () => {
    const p = parsed(v0([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]));
    // [payer (writable signer), to (writable), system program (readonly)]
    expect([0, 1, 2].map(i => isWritableIndex(p, i))).toEqual([true, true, false]);
  });
});

describe('decodeInstructions — System', () => {
  it('transfer, createAccount, assign, allocate, advanceNonceAccount', () => {
    expect(one(SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 500_000_000}))).toEqual({
      programId: '11111111111111111111111111111111',
      program: 'system',
      name: 'transfer',
      fields: [
        {name: 'from', value: {kind: 'address', value: ME.toBase58()}},
        {name: 'to', value: {kind: 'address', value: TO.toBase58()}},
        {name: 'lamports', value: {kind: 'lamports', value: '500000000'}},
      ],
    });
    const created = one(SystemProgram.createAccount({fromPubkey: ME, newAccountPubkey: TO, lamports: 2_039_280, space: 165, programId: new PublicKey(TOKEN_PROGRAM)}));
    expect(created.name).toBe('createAccount');
    expect(created.fields.map(f => f.name)).toEqual(['from', 'newAccount', 'lamports', 'space', 'owner']);
    expect(created.fields[4]?.value).toEqual({kind: 'address', value: TOKEN_PROGRAM});
    expect(one(SystemProgram.assign({accountPubkey: ME, programId: UNKNOWN})).fields).toEqual([
      {name: 'account', value: {kind: 'address', value: ME.toBase58()}},
      {name: 'owner', value: {kind: 'address', value: UNKNOWN.toBase58()}},
    ]);
    expect(one(SystemProgram.allocate({accountPubkey: ME, space: 1000})).fields[1]).toEqual({name: 'space', value: {kind: 'number', value: '1000'}});
    const nonce = one(SystemProgram.nonceAdvance({noncePubkey: TO, authorizedPubkey: ME}));
    expect(nonce.name).toBe('advanceNonceAccount');
    expect(nonce.fields).toEqual([
      {name: 'nonceAccount', value: {kind: 'address', value: TO.toBase58()}},
      {name: 'authority', value: {kind: 'address', value: ME.toBase58()}},
    ]);
    expect(NONCE_ACCOUNT_LENGTH).toBe(80);
  });

  it('a System instruction outside the decoded list is named, with no fields; a truncated one keeps only its name', () => {
    const withdraw = one(SystemProgram.nonceWithdraw({noncePubkey: TO, authorizedPubkey: ME, toPubkey: ME, lamports: 1}));
    expect(withdraw).toMatchObject({program: 'system', name: 'withdrawNonceAccount', fields: []});
    const truncated = one(new TransactionInstruction({programId: SystemProgram.programId, keys: [], data: Buffer.from([2, 0, 0, 0, 1])}));
    expect(truncated).toMatchObject({program: 'system', name: 'transfer', fields: []});
  });
});

describe('decodeInstructions — SPL Token and Token-2022', () => {
  for (const program of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    const key = program === TOKEN_PROGRAM ? 'token' : 'token-2022';
    it(`${key}: transfer, transferChecked, approve, approveChecked, revoke, burn, burnChecked, closeAccount, syncNative, initializeAccount 1/2/3, freeze, thaw`, () => {
      const owner = ME;
      const cases: [number[], PublicKey[], string, string[]][] = [
        [[3, ...u64(7n)], [SRC, DST, owner], 'transfer', ['source', 'destination', 'owner', 'amount']],
        [[12, ...u64(7n), 9], [SRC, MINT, DST, owner], 'transferChecked', ['source', 'mint', 'destination', 'owner', 'amount']],
        [[4, ...u64(7n)], [SRC, DST, owner], 'approve', ['source', 'delegate', 'owner', 'amount']],
        [[13, ...u64(7n), 9], [SRC, MINT, DST, owner], 'approveChecked', ['source', 'mint', 'delegate', 'owner', 'amount']],
        [[5], [SRC, owner], 'revoke', ['source', 'owner']],
        [[8, ...u64(7n)], [SRC, MINT, owner], 'burn', ['account', 'mint', 'owner', 'amount']],
        [[15, ...u64(7n), 9], [SRC, MINT, owner], 'burnChecked', ['account', 'mint', 'owner', 'amount']],
        [[9], [SRC, DST, owner], 'closeAccount', ['account', 'destination', 'owner']],
        [[17], [SRC], 'syncNative', ['account']],
        [[1], [SRC, MINT, owner, new PublicKey('SysvarRent111111111111111111111111111111111')], 'initializeAccount', ['account', 'mint', 'owner']],
        [[16, ...owner.toBytes()], [SRC, MINT, new PublicKey('SysvarRent111111111111111111111111111111111')], 'initializeAccount2', ['account', 'mint', 'owner']],
        [[18, ...owner.toBytes()], [SRC, MINT], 'initializeAccount3', ['account', 'mint', 'owner']],
        [[10], [SRC, MINT, owner], 'freezeAccount', ['account', 'mint', 'authority']],
        [[11], [SRC, MINT, owner], 'thawAccount', ['account', 'mint', 'authority']],
      ];
      for (const [data, keys, name, fields] of cases) {
        const d = one(tokenIx(program, data, keys));
        expect([name, d.program, d.name, d.fields.map(f => f.name)]).toEqual([name, key, name, fields]);
      }
      // The checked forms carry their decimals with the amount; the plain forms do not know them.
      expect(one(tokenIx(program, [12, ...u64(1_500_000_000n), 9], [SRC, MINT, DST, owner])).fields[4]).toEqual({name: 'amount', value: {kind: 'amount', value: '1500000000', decimals: 9}});
      expect(one(tokenIx(program, [3, ...u64(5n)], [SRC, DST, owner])).fields[3]).toEqual({name: 'amount', value: {kind: 'amount', value: '5', decimals: null}});
      // u64::MAX survives as text (no float on the way).
      expect(one(tokenIx(program, [4, ...u64(2n ** 64n - 1n)], [SRC, DST, owner])).fields[3]?.value).toEqual({kind: 'amount', value: '18446744073709551615', decimals: null});
    });

    it(`${key}: setAuthority names the authority type and the new authority (none = null)`, () => {
      const d = one(tokenIx(program, [6, 2, 1, ...DST.toBytes()], [SRC, ME]));
      expect(d).toEqual({
        programId: program,
        program: key,
        name: 'setAuthority',
        fields: [
          {name: 'account', value: {kind: 'address', value: SRC.toBase58()}},
          {name: 'currentAuthority', value: {kind: 'address', value: ME.toBase58()}},
          {name: 'authorityType', value: {kind: 'text', value: 'accountOwner'}},
          {name: 'newAuthority', value: {kind: 'address', value: DST.toBase58()}},
        ],
      });
      expect(one(tokenIx(program, [6, 3, 0], [SRC, ME])).fields[3]).toEqual({name: 'newAuthority', value: {kind: 'address', value: null}});
    });
  }

  it('Token-2022 only: the transfer hook (initialize, update), the permanent delegate, its own authority types', () => {
    const hook = new PublicKey(new Uint8Array(32).fill(7));
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [36, 0, ...ME.toBytes(), ...hook.toBytes()], [MINT]))).toMatchObject({
      name: 'transferHookInitialize',
      fields: [
        {name: 'mint', value: {kind: 'address', value: MINT.toBase58()}},
        {name: 'authority', value: {kind: 'address', value: ME.toBase58()}},
        {name: 'programId', value: {kind: 'address', value: hook.toBase58()}},
      ],
    });
    // An OptionalNonZeroPubkey of zeros is "none".
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [36, 1, ...new Uint8Array(32)], [MINT, ME])).fields[2]).toEqual({name: 'programId', value: {kind: 'address', value: null}});
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [35, ...DST.toBytes()], [MINT]))).toMatchObject({name: 'initializePermanentDelegate', fields: [{name: 'mint'}, {name: 'delegate', value: {kind: 'address', value: DST.toBase58()}}]});
    expect(one(tokenIx(TOKEN_2022_PROGRAM, [6, 8, 1, ...DST.toBytes()], [MINT, ME])).fields[2]).toEqual({name: 'authorityType', value: {kind: 'text', value: 'permanentDelegate'}});
    // The same tags on the classic program are not those instructions.
    expect(one(tokenIx(TOKEN_PROGRAM, [36, 0, ...ME.toBytes(), ...hook.toBytes()], [MINT]))).toMatchObject({program: 'token', name: null, fields: []});
    expect(one(tokenIx(TOKEN_PROGRAM, [6, 8, 1, ...DST.toBytes()], [MINT, ME]))).toMatchObject({program: 'token', name: 'setAuthority', fields: []});
  });

  it('a known tag outside the decoded list is named with no fields (mintTo); trailing data is not decoded', () => {
    expect(one(tokenIx(TOKEN_PROGRAM, [7, ...u64(1n)], [MINT, DST, ME]))).toMatchObject({program: 'token', name: 'mintTo', fields: []});
    expect(one(tokenIx(TOKEN_PROGRAM, [3, ...u64(1n), 0], [SRC, DST, ME]))).toMatchObject({name: 'transfer', fields: []});
  });

  it('core’s own TransferChecked decodes as it is built', () => {
    const d = one(buildTransferCheckedInstruction(SRC, MINT, DST, ME, 42n, 9));
    expect(d.name).toBe('transferChecked');
    expect(d.fields.find(f => f.name === 'amount')?.value).toEqual({kind: 'amount', value: '42', decimals: 9});
  });
});

describe('decodeInstructions — ATA, Compute Budget, the presale program', () => {
  it('associated token account: create (no data) and createIdempotent', () => {
    const ata = findAssociatedTokenAddress(TO, MINT);
    const idem = one(buildCreateAtaIdempotentInstruction(ME, ata, TO, MINT));
    expect(idem).toMatchObject({programId: ATA_PROGRAM, program: 'associated-token', name: 'createIdempotent'});
    expect(idem.fields.map(f => [f.name, f.value.kind === 'address' ? f.value.value : null])).toEqual([
      ['payer', ME.toBase58()],
      ['account', ata.toBase58()],
      ['wallet', TO.toBase58()],
      ['mint', MINT.toBase58()],
    ]);
    const create = one(new TransactionInstruction({programId: new PublicKey(ATA_PROGRAM), keys: idem.fields.map(f => ({pubkey: new PublicKey(f.value.kind === 'address' ? (f.value.value ?? '') : ''), isSigner: false, isWritable: true})), data: Buffer.alloc(0)}));
    expect(create.name).toBe('create');
  });

  it('compute budget: the unit limit and price', () => {
    expect(one(ComputeBudgetProgram.setComputeUnitLimit({units: 200_000}))).toMatchObject({program: 'compute-budget', name: 'setComputeUnitLimit', fields: [{name: 'units', value: {kind: 'number', value: '200000'}}]});
    expect(one(ComputeBudgetProgram.setComputeUnitPrice({microLamports: 10_000}))).toMatchObject({name: 'setComputeUnitPrice', fields: [{name: 'microLamports', value: {kind: 'number', value: '10000'}}]});
  });

  it('the presale program by its Anchor discriminator: presale_purchase_with_sol, with its argument and the IDL’s account names', () => {
    const d = one(buildSolPurchaseInstruction(ME, 1_000_000_000n, ME, new PublicKey('6Zia7b1b3NTFMQ8Kd588m8GJioMhY3YLbtcLwbB5o6Vd')));
    expect(d.program).toBe('presale');
    expect(d.name).toBe('presale_purchase_with_sol');
    expect(d.fields[0]).toEqual({name: 'sol_amount', value: {kind: 'number', value: '1000000000'}});
    expect(d.fields.slice(1).map(f => f.name)).toEqual(['config', 'user_account', 'user_allocation', 'referrer_allocation', 'pyth_sol_usd_price', 'user', 'sol_treasury', 'system_program']);
    expect(d.fields.find(f => f.name === 'user')?.value).toEqual({kind: 'address', value: ME.toBase58()});
    // An unknown discriminator of the presale program is not guessed.
    expect(one(new TransactionInstruction({programId: new PublicKey('6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt'), keys: [], data: Buffer.alloc(8, 9)}))).toMatchObject({program: 'presale', name: null, fields: []});
  });

  it('a program outside the decoded set is an unknown program (B1 §3), its address kept', () => {
    expect(one(new TransactionInstruction({programId: UNKNOWN, keys: [{pubkey: ME, isSigner: true, isWritable: true}], data: Buffer.from([1, 2, 3])}))).toEqual({programId: UNKNOWN.toBase58(), program: null, name: null, fields: []});
  });
});

describe('address lookup tables (spec §3.3)', () => {
  const tableKey = Keypair.generate().publicKey;
  const table = (addresses: PublicKey[]): AddressLookupTableAccount =>
    ({key: tableKey, state: {deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses}, isActive: () => true}) as unknown as AddressLookupTableAccount;
  /** A lookup table account's bytes: the 56-byte meta (variant 1), then the addresses. */
  const tableData = (addresses: PublicKey[]): Uint8Array => {
    const d = new Uint8Array(56 + 32 * addresses.length);
    new DataView(d.buffer).setUint32(0, 1, true);
    addresses.forEach((a, i) => d.set(a.toBytes(), 56 + 32 * i));
    return d;
  };

  it('a table account parses to its addresses; anything else is not a table', () => {
    expect(tableAddresses(tableData([DST, SRC]))).toEqual([DST.toBase58(), SRC.toBase58()]);
    expect(tableAddresses(new Uint8Array(55))).toBeNull();
    expect(tableAddresses(new Uint8Array(57))).toBeNull();
    const uninitialized = tableData([DST]);
    uninitialized[0] = 0;
    expect(tableAddresses(uninitialized)).toBeNull();
    expect(ADDRESS_LOOKUP_TABLE_PROGRAM).toBe('AddressLookupTab1e1111111111111111111111111');
  });

  it('resolves a v0 transfer whose recipient comes from a table; an unread table makes the instruction an unknown program', () => {
    const ix = SystemProgram.transfer({fromPubkey: ME, toPubkey: DST, lamports: 9});
    const p = parsed(v0([ix], [table([SRC, DST])]));
    expect(tablesOf(p)).toEqual([tableKey.toBase58()]);
    expect(p.lookups).toEqual([{table: tableKey.toBase58(), writable: [1], readonly: []}]);
    const ok = decodeInstructions(p, resolveKeys(p, new Map([[tableKey.toBase58(), [SRC.toBase58(), DST.toBase58()]]])));
    expect(ok[0]?.fields[1]).toEqual({name: 'to', value: {kind: 'address', value: DST.toBase58()}});
    // The lookup's account is writable (it came through the writable list).
    expect(isWritableIndex(p, p.staticKeys.length)).toBe(true);
    for (const tables of [new Map(), new Map([[tableKey.toBase58(), null]]), new Map([[tableKey.toBase58(), [SRC.toBase58()]]])]) {
      expect(decodeInstructions(p, resolveKeys(p, tables))).toEqual([{programId: '11111111111111111111111111111111', program: null, name: null, fields: []}]);
    }
  });

  it('base58 round trip of a key in a table (sanity of the fixture)', () => {
    expect(base58.encode(tableData([DST]).subarray(56))).toBe(DST.toBase58());
  });
});
````

Create `extension/src/background/dapp/decode/__tests__/presaleIdl.test.ts`:

````ts
import {createHash} from 'node:crypto';
import {PRESALE_INSTRUCTIONS, STAKE_TIERS} from '../presaleIdl';

// Spec B1c §3.3: the presale program is decoded by its Anchor discriminators, from the program's IDL (generated,
// never typed — scripts/gen-presale-idl.mjs, from the ICO repository's lib/idl.json; scripts/__tests__/gen-presale-idl.test.mjs
// checks the file is that script's output).
describe('presaleIdl.ts', () => {
  it('every discriminator is sha256("global:" + name)[0..8] (Anchor’s rule), each name once', () => {
    for (const ix of PRESALE_INSTRUCTIONS) {
      const expected = [...createHash('sha256').update(`global:${ix.name}`).digest().subarray(0, 8)];
      expect([ix.name, ix.discriminator]).toEqual([ix.name, expected]);
    }
    expect(new Set(PRESALE_INSTRUCTIONS.map(i => i.name)).size).toBe(PRESALE_INSTRUCTIONS.length);
    expect(PRESALE_INSTRUCTIONS.length).toBe(36);
    expect(STAKE_TIERS).toEqual(['TierA', 'TierB', 'TierC']);
  });

  it('carries the instructions the wallet and the web build (core/presale/buyInstructions.ts)', () => {
    const sol = PRESALE_INSTRUCTIONS.find(i => i.name === 'presale_purchase_with_sol');
    expect(sol?.discriminator).toEqual([161, 153, 65, 238, 160, 236, 43, 165]);
    expect(PRESALE_INSTRUCTIONS.find(i => i.name === 'register_referrer')?.discriminator).toEqual([122, 229, 215, 169, 100, 145, 198, 120]);
  });
});
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run scripts/__tests__/gen-presale-idl.test.mjs src/background/dapp/decode/__tests__/decode.test.ts src/background/dapp/decode/__tests__/presaleIdl.test.ts`

Expected (the dry run): Test Files  3 failed (3) · Tests  no tests

- [ ] **Step 3: Implement.**

After saving the files below (the generator among them), regenerate the table — from `extension/`:

```bash
node scripts/gen-presale-idl.mjs ../../../Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp/lib/idl.json
# prints 48651d64226625871caa39d79b42028e0e129c0d8e1cac3b9dafcb4541512886 36 — and the file equals the one below
```

Create `extension/scripts/gen-presale-idl.mjs`:

````js
// B1c plan 2, Task 1 (committed: plan 2 review 1 M2): writes src/background/dapp/decode/presaleIdl.ts — the presale
// program's instruction table — from the program's Anchor IDL. The IDL lives in the ICO repository
// (Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp, lib/idl.json at 75450df); the wallet repository has no copy.
//
//   node extension/scripts/gen-presale-idl.mjs <path to the ICO repository's lib/idl.json>
//
// Re-run it only when the presale program's IDL changes (a program upgrade that adds or changes an instruction): pin the
// new IDL's sha256 in IDL_SHA256 and the new output's in OUTPUT_SHA256, in the same commit as the regenerated table.
// It refuses any other IDL file. CI never runs it (CI has no ICO repository): scripts/__tests__/gen-presale-idl.test.mjs
// checks, without the IDL, that presaleIdl.ts is this script's output — its hash is OUTPUT_SHA256, and presaleSource()
// rebuilt from the table's own content gives the file byte for byte.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_PATH = join(here, '..', 'src', 'background', 'dapp', 'decode', 'presaleIdl.ts');
export const PROGRAM_ID = '6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt';
/** lib/idl.json at the ICO repository's 75450df (after the 2026-09-21 program upgrade). */
export const IDL_SHA256 = 'f31122758227e59673ad165aea75856d2ebb37be03a70d4c7e72c36c5e53c86a';
/** presaleIdl.ts as this script writes it from that IDL. */
export const OUTPUT_SHA256 = '48651d64226625871caa39d79b42028e0e129c0d8e1cac3b9dafcb4541512886';

const sha256 = b => createHash('sha256').update(b).digest('hex');

const typeOf = t => {
  if (typeof t === 'string') {
    if (!['u8', 'u64', 'i64', 'bool', 'pubkey'].includes(t)) throw new Error(`type ${t}`);
    return `'${t}'`;
  }
  if (t.array && t.array[0] === 'u8') return `{bytes: ${t.array[1]}}`;
  if (t.defined && t.defined.name === 'StakeTier') return `'tier'`;
  throw new Error(`type ${JSON.stringify(t)}`);
};

/** presaleIdl.ts's full text for a parsed IDL whose file hashes to `idlSha` (every discriminator checked against Anchor's rule). */
export function presaleSource(idl, idlSha) {
  if (idl.address !== PROGRAM_ID) throw new Error('another program');
  const rows = idl.instructions.map(ix => {
    const disc = ix.discriminator;
    const check = [...createHash('sha256').update(`global:${ix.name}`).digest().subarray(0, 8)];
    if (JSON.stringify(check) !== JSON.stringify(disc)) throw new Error(`discriminator of ${ix.name}`);
    const args = ix.args.map(a => `{name: '${a.name}', type: ${typeOf(a.type)}}`).join(', ');
    const accounts = ix.accounts.map(a => `'${a.name}'`).join(', ');
    return `  {name: '${ix.name}', discriminator: [${disc.join(', ')}], args: [${args}], accounts: [${accounts}]},`;
  });
  const tiers = idl.types.find(t => t.name === 'StakeTier').type.variants.map(v => `'${v.name}'`).join(', ');
  return `/**
 * The presale program's instructions (program ${idl.address}), generated from its Anchor IDL — never edited by hand
 * (spec B1c §3.3: "the presale program, by Anchor discriminator from the IDL"). The IDL lives in the ICO repository
 * (Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp, lib/idl.json at 75450df, sha256 ${idlSha}); the wallet repository has no
 * copy, so this table is the wallet's own. Each discriminator is sha256("global:" + name)[0..8], which
 * __tests__/presaleIdl.test.ts recomputes; the argument and account lists are the IDL's, in order.
 */
export type PresaleArgType = 'u8' | 'u64' | 'i64' | 'bool' | 'pubkey' | 'tier' | {bytes: number};
export interface PresaleInstruction {
  name: string;
  discriminator: readonly number[];
  args: readonly {name: string; type: PresaleArgType}[];
  accounts: readonly string[];
}

/** StakeTier's variants, by their Borsh index. */
export const STAKE_TIERS: readonly string[] = [${tiers}];

export const PRESALE_INSTRUCTIONS: readonly PresaleInstruction[] = [
${rows.join('\n')}
];
`;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const source = process.argv[2];
  if (source === undefined) throw new Error('usage: node extension/scripts/gen-presale-idl.mjs <lib/idl.json>');
  const text = readFileSync(source);
  const sha = sha256(text);
  if (sha !== IDL_SHA256) throw new Error(`not the pinned IDL: ${sha}`);
  const out = presaleSource(JSON.parse(text.toString('utf8')), sha);
  if (sha256(out) !== OUTPUT_SHA256) throw new Error(`the output is not the pinned one: ${sha256(out)}`);
  writeFileSync(OUT_PATH, out);
  console.log(sha256(out), out.split('\n').filter(l => l.startsWith('  {name:')).length);
}
````

Create `extension/src/background/dapp/decode/decode.ts`:

````ts
import {base58} from '@scure/base';
import {MAINNET_PROGRAM_ID} from '../../../../../core/presale/addresses';
import type {ResolvedKeys} from './keys';
import {PRESALE_INSTRUCTIONS, STAKE_TIERS, type PresaleArgType} from './presaleIdl';
import type {ParsedTx} from './wire';

/**
 * The decoder (spec B1c §3.3, B1 §3; D6 — our own, no new third-party code in the signing path): every instruction of a
 * dApp's transaction, named and with its fields, for the programs the wallet knows — System (transfer, createAccount,
 * assign, allocate, advanceNonceAccount), SPL Token and Token-2022 (transfer, transferChecked, approve, approveChecked,
 * revoke, setAuthority, closeAccount, burn, burnChecked, initializeAccount 1/2/3, syncNative, freezeAccount,
 * thawAccount, and the Token-2022 extensions B1 §3 names: the transfer hook and the permanent delegate), the Associated
 * Token Account program (create, createIdempotent), Compute Budget (the unit limit and price) and the presale program
 * (by Anchor discriminator, presaleIdl.ts). Any other instruction of a known program is named when its tag is known and
 * carries no fields; an instruction of any other program — or one that touches an account no lookup table resolved —
 * is an unknown program (`program: null`). Pure: the decoded instructions never depend on the coordinator once the
 * lookups are resolved (B1 §3).
 */
export const SYSTEM_PROGRAM = '11111111111111111111111111111111';
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';
export const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
export const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
export const PRESALE_PROGRAM = MAINNET_PROGRAM_ID;

export type ProgramKey = 'system' | 'token' | 'token-2022' | 'associated-token' | 'compute-budget' | 'presale';
export const PROGRAMS: ReadonlyMap<string, ProgramKey> = new Map([
  [SYSTEM_PROGRAM, 'system'],
  [TOKEN_PROGRAM, 'token'],
  [TOKEN_2022_PROGRAM, 'token-2022'],
  [ATA_PROGRAM, 'associated-token'],
  [COMPUTE_BUDGET_PROGRAM, 'compute-budget'],
  [PRESALE_PROGRAM, 'presale'],
]);

/** A field's value: addresses whole (null when the instruction carries too few accounts), amounts as base-unit strings. */
export type FieldValue =
  | {kind: 'address'; value: string | null}
  | {kind: 'lamports'; value: string}
  | {kind: 'amount'; value: string; decimals: number | null}
  | {kind: 'number'; value: string}
  | {kind: 'bool'; value: boolean}
  | {kind: 'text'; value: string}
  | {kind: 'hex'; value: string};
export interface Field {
  name: string;
  value: FieldValue;
}
export interface DecodedInstruction {
  /** The program's address, or null when even that is not a static key (a malformed message — never a known program). */
  programId: string | null;
  /** Null: an unknown program (not in the decoded set, or an account a lookup table did not resolve). */
  program: ProgramKey | null;
  /** The instruction's name (the program's own, e.g. `transferChecked`), or null when its tag is not one the wallet knows. */
  name: string | null;
  fields: Field[];
}

const SYSTEM_NAMES = ['createAccount', 'assign', 'transfer', 'createAccountWithSeed', 'advanceNonceAccount', 'withdrawNonceAccount', 'initializeNonceAccount', 'authorizeNonceAccount', 'allocate', 'allocateWithSeed', 'assignWithSeed', 'transferWithSeed', 'upgradeNonceAccount'];
const TOKEN_NAMES = [
  'initializeMint', 'initializeAccount', 'initializeMultisig', 'transfer', 'approve', 'revoke', 'setAuthority', 'mintTo', 'burn', 'closeAccount', 'freezeAccount', 'thawAccount',
  'transferChecked', 'approveChecked', 'mintToChecked', 'burnChecked', 'initializeAccount2', 'syncNative', 'initializeAccount3', 'initializeMultisig2', 'initializeMint2',
  'getAccountDataSize', 'initializeImmutableOwner', 'amountToUiAmount', 'uiAmountToAmount',
];
/** Token-2022's tags past the classic program's (25 …). */
const TOKEN_2022_NAMES = [
  ...TOKEN_NAMES, 'initializeMintCloseAuthority', 'transferFeeExtension', 'confidentialTransferExtension', 'defaultAccountStateExtension', 'reallocate', 'memoTransferExtension',
  'createNativeMint', 'initializeNonTransferableMint', 'interestBearingMintExtension', 'cpiGuardExtension', 'initializePermanentDelegate', 'transferHookExtension',
  'confidentialTransferFeeExtension', 'withdrawExcessLamports', 'metadataPointerExtension', 'groupPointerExtension', 'groupMemberPointerExtension', 'confidentialMintBurnExtension',
  'scaledUiAmountExtension', 'pausableExtension',
];
/** SetAuthority's AuthorityType, by tag (0–3 classic; the rest Token-2022). */
export const AUTHORITY_TYPES = [
  'mintTokens', 'freezeAccount', 'accountOwner', 'closeAccount', 'transferFeeConfig', 'withheldWithdraw', 'closeMint', 'interestRate', 'permanentDelegate',
  'confidentialTransferMint', 'transferHookProgramId', 'confidentialTransferFeeConfig', 'metadataPointer', 'groupPointer', 'groupMemberPointer', 'scaledUiAmount', 'pause',
];
const COMPUTE_NAMES = ['requestUnits', 'requestHeapFrame', 'setComputeUnitLimit', 'setComputeUnitPrice', 'setLoadedAccountsDataSizeLimit'];

/** Little-endian reads that never throw: null past the end. */
class Reader {
  constructor(
    readonly data: Uint8Array,
    private at = 0,
  ) {}
  private view(n: number): DataView | null {
    if (this.at + n > this.data.length) return null;
    const v = new DataView(this.data.buffer, this.data.byteOffset + this.at, n);
    this.at += n;
    return v;
  }
  u8(): number | null {
    return this.view(1)?.getUint8(0) ?? null;
  }
  u32(): number | null {
    return this.view(4)?.getUint32(0, true) ?? null;
  }
  u64(): bigint | null {
    return this.view(8)?.getBigUint64(0, true) ?? null;
  }
  i64(): bigint | null {
    return this.view(8)?.getBigInt64(0, true) ?? null;
  }
  bytes(n: number): Uint8Array | null {
    if (this.at + n > this.data.length) return null;
    const out = this.data.subarray(this.at, this.at + n);
    this.at += n;
    return out;
  }
  pubkey(): string | null {
    const b = this.bytes(32);
    return b === null ? null : base58.encode(b);
  }
  /** The bytes all read, none left over (a strict decode). */
  done(): boolean {
    return this.at === this.data.length;
  }
}

const addr = (name: string, value: string | null): Field => ({name, value: {kind: 'address', value}});
const lamports = (name: string, v: bigint): Field => ({name, value: {kind: 'lamports', value: v.toString()}});
const amount = (name: string, v: bigint, decimals: number | null): Field => ({name, value: {kind: 'amount', value: v.toString(), decimals}});
const num = (name: string, v: number | bigint): Field => ({name, value: {kind: 'number', value: v.toString()}});
const text = (name: string, v: string): Field => ({name, value: {kind: 'text', value: v}});
const hex = (b: Uint8Array): string => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');

type Known = {name: string | null; fields: Field[]};
const unnamed: Known = {name: null, fields: []};
/** Named by its tag, no fields (a known program's instruction outside the decoded list, or one whose data does not parse). */
const nameOnly = (names: readonly string[], tag: number | null): Known => ({name: tag === null ? null : (names[tag] ?? null), fields: []});

function system(r: Reader, acc: (i: number) => string | null): Known {
  const tag = r.u32();
  switch (tag) {
    case 0: {
      const l = r.u64();
      const space = r.u64();
      const owner = r.pubkey();
      if (l === null || space === null || owner === null || !r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'createAccount', fields: [addr('from', acc(0)), addr('newAccount', acc(1)), lamports('lamports', l), num('space', space), addr('owner', owner)]};
    }
    case 1: {
      const owner = r.pubkey();
      if (owner === null || !r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'assign', fields: [addr('account', acc(0)), addr('owner', owner)]};
    }
    case 2: {
      const l = r.u64();
      if (l === null || !r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'transfer', fields: [addr('from', acc(0)), addr('to', acc(1)), lamports('lamports', l)]};
    }
    case 4:
      if (!r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'advanceNonceAccount', fields: [addr('nonceAccount', acc(0)), addr('authority', acc(2))]};
    case 8: {
      const space = r.u64();
      if (space === null || !r.done()) return nameOnly(SYSTEM_NAMES, tag);
      return {name: 'allocate', fields: [addr('account', acc(0)), num('space', space)]};
    }
    default:
      return nameOnly(SYSTEM_NAMES, tag);
  }
}

/** SPL Token and Token-2022 (the same layout for every shared tag). */
function token(r: Reader, acc: (i: number) => string | null, names: readonly string[]): Known {
  const tag = r.u8();
  const withAmount = (build: (a: bigint) => Field[], name: string): Known => {
    const a = r.u64();
    return a === null || !r.done() ? nameOnly(names, tag) : {name, fields: build(a)};
  };
  const withChecked = (build: (a: bigint, d: number) => Field[], name: string): Known => {
    const a = r.u64();
    const d = r.u8();
    return a === null || d === null || !r.done() ? nameOnly(names, tag) : {name, fields: build(a, d)};
  };
  switch (tag) {
    case 1:
      return r.done() ? {name: 'initializeAccount', fields: [addr('account', acc(0)), addr('mint', acc(1)), addr('owner', acc(2))]} : nameOnly(names, tag);
    case 3:
      return withAmount(a => [addr('source', acc(0)), addr('destination', acc(1)), addr('owner', acc(2)), amount('amount', a, null)], 'transfer');
    case 4:
      return withAmount(a => [addr('source', acc(0)), addr('delegate', acc(1)), addr('owner', acc(2)), amount('amount', a, null)], 'approve');
    case 5:
      return r.done() ? {name: 'revoke', fields: [addr('source', acc(0)), addr('owner', acc(1))]} : nameOnly(names, tag);
    case 6: {
      const type = r.u8();
      const option = r.u8();
      const next = option === 1 ? r.pubkey() : null;
      const authorityType = type === null ? undefined : AUTHORITY_TYPES[type];
      if (authorityType === undefined || (option !== 0 && option !== 1) || (option === 1 && next === null) || !r.done()) return nameOnly(names, tag);
      // Token-2022 only past the classic four.
      if (type !== null && type > 3 && names !== TOKEN_2022_NAMES) return nameOnly(names, tag);
      return {name: 'setAuthority', fields: [addr('account', acc(0)), addr('currentAuthority', acc(1)), text('authorityType', authorityType), addr('newAuthority', next)]};
    }
    case 8:
      return withAmount(a => [addr('account', acc(0)), addr('mint', acc(1)), addr('owner', acc(2)), amount('amount', a, null)], 'burn');
    case 9:
      return r.done() ? {name: 'closeAccount', fields: [addr('account', acc(0)), addr('destination', acc(1)), addr('owner', acc(2))]} : nameOnly(names, tag);
    case 10:
    case 11:
      return r.done() ? {name: tag === 10 ? 'freezeAccount' : 'thawAccount', fields: [addr('account', acc(0)), addr('mint', acc(1)), addr('authority', acc(2))]} : nameOnly(names, tag);
    case 12:
      return withChecked((a, d) => [addr('source', acc(0)), addr('mint', acc(1)), addr('destination', acc(2)), addr('owner', acc(3)), amount('amount', a, d)], 'transferChecked');
    case 13:
      return withChecked((a, d) => [addr('source', acc(0)), addr('mint', acc(1)), addr('delegate', acc(2)), addr('owner', acc(3)), amount('amount', a, d)], 'approveChecked');
    case 15:
      return withChecked((a, d) => [addr('account', acc(0)), addr('mint', acc(1)), addr('owner', acc(2)), amount('amount', a, d)], 'burnChecked');
    case 16:
    case 18: {
      const owner = r.pubkey();
      if (owner === null || !r.done()) return nameOnly(names, tag);
      return {name: tag === 16 ? 'initializeAccount2' : 'initializeAccount3', fields: [addr('account', acc(0)), addr('mint', acc(1)), addr('owner', owner)]};
    }
    case 17:
      return r.done() ? {name: 'syncNative', fields: [addr('account', acc(0))]} : nameOnly(names, tag);
    case 35: {
      if (names !== TOKEN_2022_NAMES) return nameOnly(names, tag);
      const delegate = r.pubkey();
      if (delegate === null || !r.done()) return nameOnly(names, tag);
      return {name: 'initializePermanentDelegate', fields: [addr('mint', acc(0)), addr('delegate', delegate)]};
    }
    case 36: {
      if (names !== TOKEN_2022_NAMES) return nameOnly(names, tag);
      // TransferHookInstruction: 0 Initialize {authority, program_id} — both OptionalNonZeroPubkey (zeros = none); 1 Update {program_id}.
      const sub = r.u8();
      const opt = (): string | null | undefined => {
        const b = r.bytes(32);
        if (b === null) return undefined;
        return b.every(x => x === 0) ? null : base58.encode(b);
      };
      if (sub === 0) {
        const authority = opt();
        const program = opt();
        if (authority === undefined || program === undefined || !r.done()) return nameOnly(names, tag);
        return {name: 'transferHookInitialize', fields: [addr('mint', acc(0)), addr('authority', authority), addr('programId', program)]};
      }
      if (sub === 1) {
        const program = opt();
        if (program === undefined || !r.done()) return nameOnly(names, tag);
        return {name: 'transferHookUpdate', fields: [addr('mint', acc(0)), addr('authority', acc(1)), addr('programId', program)]};
      }
      return nameOnly(names, tag);
    }
    default:
      return nameOnly(names, tag);
  }
}

function ata(r: Reader, acc: (i: number) => string | null): Known {
  const tag = r.data.length === 0 ? 0 : r.u8();
  if (!r.done()) return unnamed;
  const fields = [addr('payer', acc(0)), addr('account', acc(1)), addr('wallet', acc(2)), addr('mint', acc(3))];
  if (tag === 0) return {name: 'create', fields};
  if (tag === 1) return {name: 'createIdempotent', fields};
  if (tag === 2) return {name: 'recoverNested', fields: []};
  return unnamed;
}

function computeBudget(r: Reader): Known {
  const tag = r.u8();
  if (tag === 2 || tag === 1 || tag === 4) {
    const v = r.u32();
    if (v === null || !r.done()) return nameOnly(COMPUTE_NAMES, tag);
    return {name: COMPUTE_NAMES[tag] ?? null, fields: [num(tag === 2 ? 'units' : 'bytes', v)]};
  }
  if (tag === 3) {
    const v = r.u64();
    if (v === null || !r.done()) return nameOnly(COMPUTE_NAMES, tag);
    return {name: 'setComputeUnitPrice', fields: [num('microLamports', v)]};
  }
  return nameOnly(COMPUTE_NAMES, tag);
}

function presaleArg(r: Reader, name: string, type: PresaleArgType): Field | null {
  if (type === 'u8') {
    const v = r.u8();
    return v === null ? null : num(name, v);
  }
  if (type === 'u64') {
    const v = r.u64();
    return v === null ? null : num(name, v);
  }
  if (type === 'i64') {
    const v = r.i64();
    return v === null ? null : num(name, v);
  }
  if (type === 'bool') {
    const v = r.u8();
    return v === 0 || v === 1 ? {name, value: {kind: 'bool', value: v === 1}} : null;
  }
  if (type === 'pubkey') {
    const v = r.pubkey();
    return v === null ? null : addr(name, v);
  }
  if (type === 'tier') {
    const v = r.u8();
    const tier = v === null ? undefined : STAKE_TIERS[v];
    return tier === undefined ? null : text(name, tier);
  }
  const b = r.bytes(type.bytes);
  return b === null ? null : {name, value: {kind: 'hex', value: hex(b)}};
}

function presale(r: Reader, acc: (i: number) => string | null): Known {
  const head = r.bytes(8);
  if (head === null) return unnamed;
  const ix = PRESALE_INSTRUCTIONS.find(x => x.discriminator.every((b, i) => head[i] === b));
  if (ix === undefined) return unnamed;
  const fields: Field[] = [];
  for (const a of ix.args) {
    const f = presaleArg(r, a.name, a.type);
    if (f === null) return {name: ix.name, fields: []};
    fields.push(f);
  }
  if (!r.done()) return {name: ix.name, fields: []};
  return {name: ix.name, fields: [...fields, ...ix.accounts.map((name, i) => addr(name, acc(i)))]};
}

/**
 * Every instruction of `p`, decoded against its resolved keys. An instruction that touches an account the lookups left
 * unresolved is an unknown program, whatever its program (spec §3.3).
 */
export function decodeInstructions(p: ParsedTx, r: ResolvedKeys): DecodedInstruction[] {
  return p.instructions.map(ix => {
    const programId = ix.program < p.staticKeys.length ? (p.staticKeys[ix.program] ?? null) : null;
    const program = programId === null ? null : (PROGRAMS.get(programId) ?? null);
    const accounts = ix.accounts.map(i => r.keys[i] ?? null);
    if (program === null || accounts.some(a => a === null)) return {programId, program: null, name: null, fields: []};
    const acc = (i: number): string | null => accounts[i] ?? null;
    const reader = new Reader(ix.data);
    const known =
      program === 'system'
        ? system(reader, acc)
        : program === 'token'
          ? token(reader, acc, TOKEN_NAMES)
          : program === 'token-2022'
            ? token(reader, acc, TOKEN_2022_NAMES)
            : program === 'associated-token'
              ? ata(reader, acc)
              : program === 'compute-budget'
                ? computeBudget(reader)
                : presale(reader, acc);
    return {programId, program, name: known.name, fields: known.fields};
  });
}

/** A field's value by name, when it is an address (null otherwise, or when absent). */
export function addressField(ix: DecodedInstruction, name: string): string | null {
  const f = ix.fields.find(x => x.name === name);
  return f?.value.kind === 'address' ? f.value.value : null;
}
````

Create `extension/src/background/dapp/decode/keys.ts`:

````ts
import {base58} from '@scure/base';
import type {ParsedTx} from './wire';

/**
 * Address lookup tables (spec B1c §3.3, B1 §3): a v0 message names some of its accounts by (table, index); they are
 * resolved from the tables' own accounts, read through the proxy (`getMultipleAccounts`). A table that cannot be read,
 * is not owned by the lookup-table program, is malformed, or does not hold the index leaves that account unresolved
 * (null) — and every instruction that touches an unresolved account is shown as an unknown program (decode.ts).
 */
export const ADDRESS_LOOKUP_TABLE_PROGRAM = 'AddressLookupTab1e1111111111111111111111111';
/** The table account's fixed header (LookupTableMeta, 56 bytes); the addresses follow, 32 bytes each. */
const META_BYTES = 56;

/** A table's addresses from its account (owner checked by the caller), or null when the bytes are not a lookup table. */
export function tableAddresses(data: Uint8Array): string[] | null {
  if (data.length < META_BYTES || (data.length - META_BYTES) % 32 !== 0) return null;
  // ProgramState::LookupTable is variant 1 (u32 LE); 0 is an uninitialized account.
  if (new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(0, true) !== 1) return null;
  const out: string[] = [];
  for (let at = META_BYTES; at < data.length; at += 32) out.push(base58.encode(data.subarray(at, at + 32)));
  return out;
}

/** Every account index of the message, resolved: the static keys, then each lookup's writable, then each lookup's readonly (the runtime's order). */
export interface ResolvedKeys {
  keys: (string | null)[];
}

/** `tables`: each table's addresses as read now, or null when it could not be read or is not a lookup table. */
export function resolveKeys(p: ParsedTx, tables: ReadonlyMap<string, readonly string[] | null>): ResolvedKeys {
  const at = (table: string, i: number): string | null => tables.get(table)?.[i] ?? null;
  const writable = p.lookups.flatMap(l => l.writable.map(i => at(l.table, i)));
  const readonly = p.lookups.flatMap(l => l.readonly.map(i => at(l.table, i)));
  return {keys: [...p.staticKeys, ...writable, ...readonly]};
}

/** The tables a message needs (none for a legacy message). */
export const tablesOf = (p: ParsedTx): string[] => [...new Set(p.lookups.map(l => l.table))];
````

Create `extension/src/background/dapp/decode/presaleIdl.ts`:

````ts
/**
 * The presale program's instructions (program 6nTTJwtDuxjv8C1JMsajYQapmPAGrC3QF1w5nu9LXJvt), generated from its Anchor IDL — never edited by hand
 * (spec B1c §3.3: "the presale program, by Anchor discriminator from the IDL"). The IDL lives in the ICO repository
 * (Solana-Multi-Currency-USDC_USDC_SOL-ICO-DApp, lib/idl.json at 75450df, sha256 f31122758227e59673ad165aea75856d2ebb37be03a70d4c7e72c36c5e53c86a); the wallet repository has no
 * copy, so this table is the wallet's own. Each discriminator is sha256("global:" + name)[0..8], which
 * __tests__/presaleIdl.test.ts recomputes; the argument and account lists are the IDL's, in order.
 */
export type PresaleArgType = 'u8' | 'u64' | 'i64' | 'bool' | 'pubkey' | 'tier' | {bytes: number};
export interface PresaleInstruction {
  name: string;
  discriminator: readonly number[];
  args: readonly {name: string; type: PresaleArgType}[];
  accounts: readonly string[];
}

/** StakeTier's variants, by their Borsh index. */
export const STAKE_TIERS: readonly string[] = ['TierA', 'TierB', 'TierC'];

export const PRESALE_INSTRUCTIONS: readonly PresaleInstruction[] = [
  {name: 'admin_add_allocation', discriminator: [27, 155, 127, 15, 165, 194, 167, 158], args: [{name: 'token_amount', type: 'u64'}], accounts: ['config', 'admin', 'recipient', 'user_allocation', 'system_program']},
  {name: 'admin_claim_for_user', discriminator: [157, 200, 115, 242, 113, 65, 176, 240], args: [], accounts: ['config', 'user_allocation', 'ico_ata_for_ico_program', 'ico_ata_for_user', 'ico_mint', 'user', 'admin', 'token_program']},
  {name: 'claim_and_stake', discriminator: [233, 67, 32, 226, 229, 36, 163, 133], args: [{name: 'tier', type: 'tier'}], accounts: ['config', 'user_account', 'user_allocation', 'stake_account', 'ico_ata_for_ico_program', 'ico_mint', 'user', 'token_program', 'system_program']},
  {name: 'claim_cross_chain_allocation', discriminator: [216, 254, 17, 131, 123, 155, 252, 26], args: [], accounts: ['config', 'cross_chain_allocation', 'ico_ata_for_ico_program', 'ico_ata_for_user', 'ico_mint', 'user', 'token_program']},
  {name: 'claim_presale_allocation', discriminator: [100, 176, 47, 202, 135, 93, 149, 105], args: [], accounts: ['config', 'user_allocation', 'ico_ata_for_ico_program', 'ico_ata_for_user', 'ico_mint', 'user', 'token_program']},
  {name: 'claim_team_tokens', discriminator: [137, 104, 44, 247, 225, 216, 99, 11], args: [], accounts: ['config', 'team_vesting', 'ico_ata_for_ico_program', 'team_member_ata', 'ico_mint', 'team_member', 'token_program']},
  {name: 'coordinator_mint_and_vest_stake', discriminator: [87, 177, 240, 52, 64, 111, 34, 9], args: [{name: 'buyer_eth_address', type: {bytes: 20}}, {name: 'chain_id', type: 'u8'}, {name: 'noc_amount', type: 'u64'}, {name: 'usd_cents', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'cross_chain_allocation', 'stake_account', 'beneficiary', 'ico_mint', 'ico_ata_for_ico_program', 'stake_pool_ata', 'stake_pool_authority', 'coordinator', 'token_program', 'associated_token_program', 'system_program']},
  {name: 'create_team_vesting', discriminator: [198, 20, 215, 193, 36, 155, 16, 105], args: [{name: 'allocation_amount', type: 'u64'}], accounts: ['config', 'team_vesting', 'team_member', 'admin', 'system_program']},
  {name: 'finalize_unstake', discriminator: [11, 165, 26, 80, 219, 175, 236, 227], args: [], accounts: ['config', 'user_account', 'stake_account', 'ico_ata_for_user', 'ico_ata_for_ico_program', 'ico_mint', 'user', 'token_program', 'system_program']},
  {name: 'get_team_vesting_status', discriminator: [184, 10, 21, 96, 58, 39, 64, 75], args: [], accounts: ['config', 'team_vesting']},
  {name: 'harvest_rewards', discriminator: [213, 164, 27, 71, 21, 69, 10, 104], args: [], accounts: ['config', 'user_account', 'stake_account', 'ico_ata_for_user', 'ico_ata_for_ico_program', 'ico_mint', 'user', 'token_program', 'system_program']},
  {name: 'initialize', discriminator: [175, 175, 109, 31, 13, 152, 155, 237], args: [{name: 'ico_amount', type: 'u64'}, {name: 'tge_timestamp', type: 'i64'}], accounts: ['config', 'ico_ata_for_ico_program', 'ico_mint', 'ico_ata_for_admin', 'admin', 'system_program', 'token_program', 'rent']},
  {name: 'initiate_unstake', discriminator: [229, 79, 19, 159, 232, 206, 96, 210], args: [], accounts: ['config', 'user_account', 'stake_account', 'user', 'system_program']},
  {name: 'link_solana_wallet', discriminator: [64, 35, 6, 191, 6, 58, 17, 135], args: [{name: 'eth_address', type: {bytes: 20}}, {name: 'chain_id', type: 'u8'}], accounts: ['cross_chain_allocation', 'user']},
  {name: 'presale_purchase_and_vest_stake', discriminator: [208, 213, 110, 52, 157, 222, 196, 234], args: [{name: 'sol_amount', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'user_account', 'user_allocation', 'stake_account', 'pyth_sol_usd_price', 'user', 'sol_treasury', 'system_program']},
  {name: 'presale_purchase_usdc_and_vest_stake', discriminator: [151, 51, 169, 158, 39, 240, 7, 214], args: [{name: 'usdc_amount', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'user_account', 'user_allocation', 'stake_account', 'stablecoin_ata_for_user', 'stablecoin_ata_for_admin', 'user', 'token_program', 'system_program']},
  {name: 'presale_purchase_usdt_and_vest_stake', discriminator: [22, 252, 18, 234, 123, 234, 114, 91], args: [{name: 'usdt_amount', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'user_account', 'user_allocation', 'stake_account', 'stablecoin_ata_for_user', 'stablecoin_ata_for_admin', 'user', 'token_program', 'system_program']},
  {name: 'presale_purchase_with_sol', discriminator: [161, 153, 65, 238, 160, 236, 43, 165], args: [{name: 'sol_amount', type: 'u64'}], accounts: ['config', 'user_account', 'user_allocation', 'referrer_allocation', 'pyth_sol_usd_price', 'user', 'sol_treasury', 'system_program']},
  {name: 'presale_purchase_with_usdc', discriminator: [150, 34, 181, 239, 229, 123, 187, 128], args: [{name: 'usdc_amount', type: 'u64'}], accounts: ['config', 'user_account', 'user_allocation', 'referrer_allocation', 'stablecoin_ata_for_user', 'stablecoin_ata_for_admin', 'stablecoin_mint', 'user', 'token_program', 'system_program']},
  {name: 'presale_purchase_with_usdt', discriminator: [209, 3, 170, 172, 219, 182, 149, 89], args: [{name: 'usdt_amount', type: 'u64'}], accounts: ['config', 'user_account', 'user_allocation', 'referrer_allocation', 'stablecoin_ata_for_user', 'stablecoin_ata_for_admin', 'stablecoin_mint', 'user', 'token_program', 'system_program']},
  {name: 'record_cross_chain_purchase', discriminator: [63, 205, 228, 88, 240, 205, 177, 176], args: [{name: 'buyer_eth_address', type: {bytes: 20}}, {name: 'chain_id', type: 'u8'}, {name: 'noc_amount', type: 'u64'}, {name: 'usd_cents', type: 'u64'}, {name: '_tx_hash', type: {bytes: 32}}, {name: '_stage', type: 'u8'}, {name: 'referrer_eth', type: {bytes: 20}}], accounts: ['config', 'cross_chain_allocation', 'referrer_cross_chain_allocation', 'coordinator', 'system_program']},
  {name: 'register_referrer', discriminator: [122, 229, 215, 169, 100, 145, 198, 120], args: [{name: 'referrer', type: 'pubkey'}], accounts: ['user_account', 'user_allocation', 'user', 'system_program']},
  {name: 'resize_config', discriminator: [198, 164, 124, 15, 186, 11, 212, 150], args: [], accounts: ['config', 'admin', 'system_program']},
  {name: 'set_block_status', discriminator: [85, 228, 227, 164, 211, 200, 107, 143], args: [{name: 'blocked', type: 'bool'}], accounts: ['config', 'user_account', 'target_user', 'admin', 'system_program']},
  {name: 'set_coordinator', discriminator: [3, 248, 224, 239, 81, 218, 95, 214], args: [{name: 'coordinator', type: 'pubkey'}], accounts: ['config', 'admin']},
  {name: 'set_presale_active', discriminator: [145, 96, 184, 126, 86, 145, 75, 58], args: [{name: 'active', type: 'bool'}], accounts: ['config', 'admin']},
  {name: 'set_stablecoin_addresses', discriminator: [202, 82, 158, 52, 194, 193, 175, 17], args: [{name: 'usdt_address', type: 'pubkey'}, {name: 'usdc_address', type: 'pubkey'}], accounts: ['config', 'admin', 'usdt_mint', 'usdc_mint']},
  {name: 'stake_tokens', discriminator: [136, 126, 91, 162, 40, 131, 13, 127], args: [{name: 'amount', type: 'u64'}, {name: 'tier', type: 'tier'}, {name: 'auto_compound', type: 'bool'}], accounts: ['config', 'user_account', 'stake_account', 'ico_ata_for_user', 'ico_ata_for_ico_program', 'ico_mint', 'user', 'token_program', 'system_program']},
  {name: 'toggle_auto_compound', discriminator: [136, 162, 130, 163, 228, 36, 56, 20], args: [], accounts: ['stake_account', 'user']},
  {name: 'update_max_per_user', discriminator: [35, 69, 86, 104, 43, 106, 16, 175], args: [{name: 'max_usd_cents', type: 'u64'}], accounts: ['config', 'admin']},
  {name: 'update_min_purchase', discriminator: [213, 12, 226, 45, 229, 135, 30, 114], args: [{name: 'min_usd_cents', type: 'u64'}], accounts: ['config', 'admin']},
  {name: 'update_presale_start_time', discriminator: [202, 241, 147, 42, 120, 74, 133, 56], args: [{name: 'new_start_time', type: 'i64'}], accounts: ['config', 'admin']},
  {name: 'update_sol_treasury', discriminator: [129, 47, 255, 66, 61, 34, 183, 131], args: [{name: 'new_treasury', type: 'pubkey'}], accounts: ['config', 'admin']},
  {name: 'update_tge_timestamp', discriminator: [162, 180, 93, 107, 6, 27, 240, 231], args: [{name: 'new_tge_timestamp', type: 'i64'}], accounts: ['config', 'admin']},
  {name: 'update_token_price', discriminator: [155, 148, 125, 15, 147, 1, 126, 60], args: [{name: 'new_price', type: 'u64'}], accounts: ['config', 'admin']},
  {name: 'withdraw_tokens', discriminator: [2, 4, 225, 61, 19, 182, 106, 170], args: [{name: 'amount', type: 'u64'}], accounts: ['config', 'ico_ata_for_ico_program', 'ico_ata_for_admin', 'ico_mint', 'admin', 'token_program']},
];
````

Create `extension/src/background/dapp/decode/wire.ts`:

````ts
import {VersionedTransaction} from '@solana/web3.js';

/**
 * A dApp's transaction as bytes (spec B1c §1.4, §3.3): legacy or v0, at most 1 232 bytes (the packet limit), read with
 * the web3.js parser the background already carries (D6: no new third-party code in the signing path) and accepted
 * only if re-serialising gives back exactly the bytes received — trailing bytes, a non-canonical length prefix or a
 * signature count that disagrees with the header are refused, so what is shown, simulated and signed is one thing.
 */
export const MAX_TX_BYTES = 1232;

export interface ParsedInstruction {
  /** Index of the program in the full key list (static keys, then the lookups' writable, then readonly). */
  program: number;
  accounts: number[];
  data: Uint8Array;
}

export interface Lookup {
  table: string;
  writable: number[];
  readonly: number[];
}

export interface ParsedTx {
  version: 'legacy' | 0;
  /** The message bytes — exactly what a signature covers. */
  message: Uint8Array;
  /** One per required signer, in order; an all-zero slot is unsigned. */
  signatures: Uint8Array[];
  staticKeys: string[];
  /** The required signers (the first numRequiredSignatures static keys); signers[0] is the fee payer. */
  signers: string[];
  header: {numRequiredSignatures: number; numReadonlySignedAccounts: number; numReadonlyUnsignedAccounts: number};
  lookups: Lookup[];
  instructions: ParsedInstruction[];
  blockhash: string;
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** The bytes, parsed — or null when they are not exactly one canonical legacy or v0 transaction of at most MAX_TX_BYTES. */
export function parseWire(bytes: Uint8Array): ParsedTx | null {
  if (bytes.length === 0 || bytes.length > MAX_TX_BYTES) return null;
  let tx: VersionedTransaction;
  try {
    tx = VersionedTransaction.deserialize(bytes);
    if (!sameBytes(tx.serialize(), bytes)) return null;
  } catch {
    return null;
  }
  const m = tx.message;
  const version = tx.version;
  if (version !== 'legacy' && version !== 0) return null;
  const staticKeys = m.staticAccountKeys.map(k => k.toBase58());
  const header = {...m.header};
  if (header.numRequiredSignatures < 1 || header.numRequiredSignatures > staticKeys.length || tx.signatures.length !== header.numRequiredSignatures) return null;
  return {
    version,
    message: m.serialize(),
    signatures: tx.signatures.map(s => Uint8Array.from(s)),
    staticKeys,
    signers: staticKeys.slice(0, header.numRequiredSignatures),
    header,
    lookups: m.addressTableLookups.map(l => ({table: l.accountKey.toBase58(), writable: [...l.writableIndexes], readonly: [...l.readonlyIndexes]})),
    instructions: m.compiledInstructions.map(ix => ({program: ix.programIdIndex, accounts: [...ix.accountKeyIndexes], data: Uint8Array.from(ix.data)})),
    blockhash: m.recentBlockhash,
  };
}

/** Writable by the message's header (static keys) or by the lookup it came through (the rest). */
export function isWritableIndex(p: ParsedTx, i: number): boolean {
  const n = p.staticKeys.length;
  const {numRequiredSignatures: s, numReadonlySignedAccounts: rs, numReadonlyUnsignedAccounts: ru} = p.header;
  if (i < s) return i < s - rs;
  if (i < n) return i < n - ru;
  const writableLookups = p.lookups.reduce((sum, l) => sum + l.writable.length, 0);
  return i < n + writableLookups;
}
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run scripts/__tests__/gen-presale-idl.test.mjs src/background/dapp/decode/__tests__/decode.test.ts src/background/dapp/decode/__tests__/presaleIdl.test.ts` — expected: Test Files  3 passed (3) · Tests  24 passed (24)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  159 passed (159) · Tests  3134 passed (3134). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M1a | `wire.ts`: the re-serialisation check off (`… && false`) | decode.test.ts "refuses anything but exactly one canonical transaction" — RED Tests  1 failed \| 18 passed (19) |
| M1b | `wire.ts`: the 1 232-byte limit one byte higher | decode.test.ts (the 1 233-byte transaction parses) — RED Tests  1 failed \| 18 passed (19) |
| M1c | `decode.ts`: an unresolved account no longer makes an unknown program | decode.test.ts "an unread table makes the instruction an unknown program" — RED Tests  1 failed \| 18 passed (19) |
| M1d | `decode.ts`: the transfer hook decoded on the classic program too | decode.test.ts "Token-2022 only" — RED Tests  1 failed \| 18 passed (19) |
| M1e | `decode.ts`: Token-2022's authority types accepted on the classic program | decode.test.ts "Token-2022 only" — RED Tests  1 failed \| 18 passed (19) |
| M1f | `keys.ts`: an uninitialized table account read as a table | decode.test.ts "a table account parses to its addresses" — RED Tests  1 failed \| 18 passed (19) |
| M1g | `scripts/gen-presale-idl.mjs`: each instruction's accounts written in reverse | gen-presale-idl.test.mjs "presaleIdl.ts is byte for byte presaleSource() of its own content" — RED Tests  1 failed \| 2 passed (3) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-2 the decoder — one canonical transaction, lookup tables, System / Token / Token-2022 / ATA / Compute Budget / the presale program by its IDL" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 2: Lookup tables read, the simulation through the proxy, balance changes per mint, the fee, B1b's re-authentication reasons for a transaction; `getAccountsData` in core

**Spec:** §3.3 (Lookup tables resolved with getMultipleAccounts; Simulation; Re-authentication), B1 §3 (balance changes, the fee, "simulation has one source", re-authentication rules), B1 §4 (the fee computed locally); Scope R4–R6, R10; Review Focus 2, 3

**Files:**
- Test: `core/solana/__tests__/rpc.test.ts`
- Modify: `core/solana/rpc.ts`
- Test: `extension/src/background/__tests__/fakeDeps.ts`
- Test: `extension/src/background/__tests__/reauthPolicy.test.ts`
- Test (new): `extension/src/background/dapp/__tests__/simulate.test.ts`
- Create: `extension/src/background/dapp/simulate.ts`
- Modify: `extension/src/background/reauthPolicy.ts`

**Interfaces:**
- Consumes: Task 1's `parseWire`, `resolveKeys`, `tablesOf`, `tableAddresses`, `ADDRESS_LOOKUP_TABLE_PROGRAM`, `decodeInstructions`, `addressField`, the program ids; `WalletDeps` (`reader`, `prices`, `stagePrice`, `now`, `randomBytes`); `reauthPolicy.ts`'s `usdMicros`.
- Produces:
  - `core/solana/rpc.ts`: `type AccountData = SimulatedAccount`; `MAX_MULTIPLE_ACCOUNTS = 100`; `SolanaReader.getAccountsData(addresses: readonly string[]): Promise<(AccountData | null)[]>` (getMultipleAccounts, base64 data; no call for none; more than 100 refused).
  - `reauthPolicy.ts`: `type DappReauthReason = SendReauthReason | 'approval'`; `dappReauthReasons(i: {outgoing: readonly {amount: bigint; balance: bigint; usdMicros: bigint | null}[]; firstSend: boolean; approval: boolean; thresholdCents: number}): DappReauthReason[]`.
  - `dapp/simulate.ts`: `DEFAULT_UNITS_PER_INSTRUCTION`, `MAX_COMPUTE_UNITS`, `WRAPPED_SOL_MINT`; `interface BalanceChange {mint: string | null; amount: string; decimals: number | null; usdMicros: string | null}`; `type TxOutcome = {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null} | {ok: false; error: 'expired' | 'failed'; detail: string}`; `interface TxSimulation {id; at; slot; elapsedMs; keys: (string | null)[][]; outcomes: TxOutcome[]; reasons: DappReauthReason[]; lastValidBlockHeight: number}`; `feeOf(p, decoded): {feeLamports: bigint; unitLimit: number}`; `interface SimulateInput {account; wires; txs; known(address): boolean; thresholdCents}`; `simulateTransactions(deps, input): Promise<TxSimulation>` (throws when a read fails).
  - `__tests__/fakeDeps.ts`'s `fakeReader` gains `getAccountsData` (fails loudly unless a test overrides it).

`simulateTransactions` reads the lookup tables of the whole batch once (`getMultipleAccounts` — on the proxy's allowlist; only accounts owned by the lookup-table program count), the account's SOL and its token accounts of both token programs before, and the latest blockhash's last valid height (Task 5's pending record waits at least that long); then it simulates each transaction with `accounts` = the wallet account and every writable account the transaction names (R4). A change is post − pre per mint in `bigint` base units: SOL from the wallet account (the fee included, R5), each token from the accounts whose owner field is the account (an existing one, one the transaction creates, one it closes). Decimals the holdings do not tell are read from the mint, once; a token without a price has no dollars. `BlockhashNotFound` is `expired` (Q21), any other error `failed`. The reasons are B1b's rules (R10), computed here so `dapp.decide` reads nothing. A read that throws throws — the caller (Task 4) stores `unreachable`.

- [ ] **Step 1: Write the failing tests.**

Change `core/solana/__tests__/rpc.test.ts`:

````diff
diff --git a/core/solana/__tests__/rpc.test.ts b/core/solana/__tests__/rpc.test.ts
index 1e1100e..8dc0da3 100644
--- a/core/solana/__tests__/rpc.test.ts
+++ b/core/solana/__tests__/rpc.test.ts
@@ -199,6 +199,25 @@ describe('solanaReader', () => {
     expect(calls[0]?.body.params).toEqual([['a', 'b'], {encoding: 'base64', dataSlice: {offset: 0, length: 0}, commitment: 'confirmed'}]);
   });
 
+  // B1c-2 (spec B1c §3.3): lookup tables and mints are read with their data, through getMultipleAccounts (allowed).
+  it('getAccountsData reads each account with its base64 data; a missing one is null; no call for none; more than 100 refused', async () => {
+    const {r, calls} = reader(() => ok({context: {slot: 1}, value: [null, {lamports: 17, owner: 'AddressLookupTab1e1111111111111111111111111', data: ['AQID', 'base64'], executable: false, rentEpoch: 18446744073709552000}]}));
+    expect(await r.getAccountsData(['a', 'b'])).toEqual([null, {lamports: 17n, owner: 'AddressLookupTab1e1111111111111111111111111', data: Uint8Array.of(1, 2, 3)}]);
+    expect(calls[0]?.body.params).toEqual([['a', 'b'], {encoding: 'base64', commitment: 'confirmed'}]);
+    expect(await r.getAccountsData([])).toEqual([]);
+    expect(calls).toHaveLength(1);
+    await expect(r.getAccountsData(Array.from({length: 101}, (_, i) => `k${i}`))).rejects.toThrow(RangeError);
+    expect(calls).toHaveLength(1);
+  });
+
+  it('getAccountsData refuses a reply of the wrong length or with data in another encoding', async () => {
+    let value: unknown = [null];
+    const {r} = reader(() => ok({context: {slot: 1}, value}));
+    await expect(r.getAccountsData(['a', 'b'])).rejects.toThrow('wrong length');
+    value = [{lamports: 1, owner: 'x', data: ['AQID', 'base58']}];
+    await expect(r.getAccountsData(['a'])).rejects.toThrow('encoding');
+  });
+
   it('getAccountExists distinguishes null from an account', async () => {
     let value: unknown = null;
     const {r} = reader(() => ok({context: {slot: 1}, value}));
````

Change `extension/src/background/__tests__/fakeDeps.ts`:

````diff
diff --git a/extension/src/background/__tests__/fakeDeps.ts b/extension/src/background/__tests__/fakeDeps.ts
index fd422cb..efa68f2 100644
--- a/extension/src/background/__tests__/fakeDeps.ts
+++ b/extension/src/background/__tests__/fakeDeps.ts
@@ -12,6 +12,7 @@ export function fakeReader(overrides: Partial<SolanaReader> = {}): SolanaReader
     getAccountExists: unexpected('getAccountExists'),
     getAccountKind: unexpected('getAccountKind'),
     getMultipleLamports: unexpected('getMultipleLamports'),
+    getAccountsData: unexpected('getAccountsData'),
     getLatestBlockhash: unexpected('getLatestBlockhash'),
     getBlockHeight: unexpected('getBlockHeight'),
     getSignatureStatuses: unexpected('getSignatureStatuses'),
````

Change `extension/src/background/__tests__/reauthPolicy.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/reauthPolicy.test.ts b/extension/src/background/__tests__/reauthPolicy.test.ts
index c5a2794..f7df9c6 100644
--- a/extension/src/background/__tests__/reauthPolicy.test.ts
+++ b/extension/src/background/__tests__/reauthPolicy.test.ts
@@ -1,4 +1,4 @@
-import {sendReauthReasons, usdMicros} from '../reauthPolicy';
+import {dappReauthReasons, sendReauthReasons, usdMicros} from '../reauthPolicy';
 
 const base = {knownRecipient: true, amount: 10n, balance: 1_000n, usdMicros: 1_000_000n, thresholdCents: 10_000};
 
@@ -64,3 +64,30 @@ describe('sendReauthReasons (spec §2, §3)', () => {
     expect(sendReauthReasons({...base, knownRecipient: true, amount: 1_000n})).toEqual(['over-5-percent']);
   });
 });
+
+// B1c-2 (spec B1c §3.3, B1 §3): B1b's rules for a dApp's transaction, from its balance changes and its instructions.
+describe('dappReauthReasons', () => {
+  const quiet = {outgoing: [{amount: 10n, balance: 1_000n, usdMicros: 1_000_000n}], firstSend: false, approval: false, thresholdCents: 10_000};
+  it('positive control: a small outgoing amount, known recipients, no approval, a known price under the threshold — nothing', () => {
+    expect(dappReauthReasons(quiet)).toEqual([]);
+    expect(dappReauthReasons({...quiet, outgoing: []})).toEqual([]);
+  });
+  it('each rule by itself', () => {
+    expect(dappReauthReasons({...quiet, firstSend: true})).toEqual(['first-send']);
+    expect(dappReauthReasons({...quiet, outgoing: [{amount: 51n, balance: 1_000n, usdMicros: 1n}]})).toEqual(['over-5-percent']);
+    expect(dappReauthReasons({...quiet, outgoing: [{amount: 50n, balance: 1_000n, usdMicros: 1n}]})).toEqual([]);
+    expect(dappReauthReasons({...quiet, outgoing: [{amount: 1n, balance: 1_000n, usdMicros: 100_000_001n}]})).toEqual(['over-usd-threshold']);
+    expect(dappReauthReasons({...quiet, approval: true})).toEqual(['approval']);
+  });
+  it('fails closed: no price is above the threshold, a zero balance is above 5 %', () => {
+    expect(dappReauthReasons({...quiet, outgoing: [{amount: 1n, balance: 1_000n, usdMicros: null}]})).toEqual(['over-usd-threshold']);
+    expect(dappReauthReasons({...quiet, outgoing: [{amount: 1n, balance: 0n, usdMicros: 1n}]})).toEqual(['over-5-percent']);
+  });
+  it('the whole balance to a first-time address adds its own reason', () => {
+    expect(dappReauthReasons({...quiet, firstSend: true, outgoing: [{amount: 990n, balance: 1_000n, usdMicros: 1n}]})).toEqual(['first-send', 'over-5-percent', 'whole-balance-to-new']);
+    expect(dappReauthReasons({...quiet, firstSend: false, outgoing: [{amount: 990n, balance: 1_000n, usdMicros: 1n}]})).toEqual(['over-5-percent']);
+  });
+  it('a zero or incoming amount is not outgoing', () => {
+    expect(dappReauthReasons({...quiet, outgoing: [{amount: 0n, balance: 0n, usdMicros: null}]})).toEqual([]);
+  });
+});
````

Create `extension/src/background/dapp/__tests__/simulate.test.ts`:

````ts
import {base58} from '@scure/base';
import {ComputeBudgetProgram, PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction, type AddressLookupTableAccount} from '@solana/web3.js';
import type {AccountData, SimulatedAccount, SimulationOutcome, TokenAccountEntry} from '../../../../../core/solana/rpc';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {BLOCKHASH, PUB, RECIPIENT, tokenAccountData} from '../../__tests__/fixtures';
import {ADDRESS_LOOKUP_TABLE_PROGRAM} from '../decode/keys';
import {TOKEN_PROGRAM} from '../decode/decode';
import {parseWire} from '../decode/wire';
import {simulateTransactions, type TxSimulation} from '../simulate';

const ME = new PublicKey(PUB);
const TO = new PublicKey(RECIPIENT);
const SRC = '4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF';
const NEW_ATA = 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU';
const ODD_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYC';
const DEX = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
const SOL = 10_000_000_000n;

const wire = (instructions: TransactionInstruction[], o: {payer?: PublicKey; tables?: AddressLookupTableAccount[]} = {}): Uint8Array =>
  new VersionedTransaction(new TransactionMessage({payerKey: o.payer ?? ME, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message(o.tables ?? [])).serialize();
const u64 = (n: bigint): number[] => Array.from({length: 8}, (_, i) => Number((n >> BigInt(8 * i)) & 0xffn));
const tokenIx = (data: number[], keys: string[], signer = ME.toBase58()) =>
  new TransactionInstruction({programId: new PublicKey(TOKEN_PROGRAM), data: Buffer.from(data), keys: keys.map(k => ({pubkey: new PublicKey(k), isSigner: k === signer, isWritable: k !== signer}))});
const holding = (pubkey: string, mint: string, amount: bigint, decimals = 9): TokenAccountEntry => ({pubkey, mint, owner: ME.toBase58(), amount, decimals});
const tokenAfter = (mint: string, amount: bigint, owner = ME.toBase58()): SimulatedAccount => ({lamports: 2_039_280n, owner: TOKEN_PROGRAM, data: tokenAccountData(mint, owner, amount)});

/**
 * A reader for one request: the wallet's SOL and token accounts before, and per simulateTransaction call the post-state
 * of each requested address (a function of the address) — or an error.
 */
function scene(o: {holdings?: TokenAccountEntry[]; post?: (address: string, call: number) => SimulatedAccount | null; err?: unknown; accounts?: Map<string, AccountData | null>; lamports?: bigint}) {
  const simulations: {tx: string; accounts: readonly string[] | undefined}[] = [];
  const reads: string[][] = [];
  const reader = fakeReader({
    getBalance: async () => o.lamports ?? SOL,
    getTokenAccountsByOwner: async (_owner, filter) => ('programId' in filter && filter.programId === TOKEN_PROGRAM ? (o.holdings ?? []) : []),
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 4_242}),
    getAccountsData: async addresses => {
      reads.push([...addresses]);
      return addresses.map(a => o.accounts?.get(a) ?? null);
    },
    simulateTransaction: async (tx, opts): Promise<SimulationOutcome> => {
      simulations.push({tx, accounts: opts?.accounts});
      const call = simulations.length;
      if (o.err !== undefined) return {err: o.err, logs: [], unitsConsumed: 0, slot: 300 + call, accounts: null};
      return {err: null, logs: [], unitsConsumed: 1_234, slot: 300 + call, accounts: (opts?.accounts ?? []).map(a => o.post?.(a, call) ?? null)};
    },
  });
  return {deps: fakeDeps({reader}), simulations, reads};
}

async function run(s: ReturnType<typeof scene>, wires: Uint8Array[], known: (a: string) => boolean = () => false): Promise<TxSimulation> {
  const txs = wires.map(w => {
    const p = parseWire(w);
    if (p === null) throw new Error('fixture did not parse');
    return p;
  });
  return simulateTransactions(s.deps, {account: ME.toBase58(), wires, txs, known, thresholdCents: 10_000});
}

// Spec B1c §3.3: simulation through the proxy, balance changes = post − pre per mint, in base units.
describe('simulateTransactions', () => {
  it('a SOL transfer: SOL changes by what the node reports (the fee included); the fee computed locally; first send and over 5 % (B1b rules)', async () => {
    const s = scene({post: a => (a === ME.toBase58() ? {lamports: SOL - 500_005_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 500_000_000})])]);
    expect(sim.outcomes).toEqual([{ok: true, changes: [{mint: null, amount: '-500005000', decimals: 9, usdMicros: '-75000750'}], unitsConsumed: 1_234, unitLimit: 200_000, feeLamports: '5000'}]);
    // The simulated accounts: the wallet account first, then every writable account the transaction names.
    expect(s.simulations[0]?.accounts).toEqual([ME.toBase58(), TO.toBase58()]);
    expect(sim.reasons).toEqual(['first-send', 'over-5-percent']);
    expect(sim.lastValidBlockHeight).toBe(4_242);
    expect(sim.slot).toBe(301);
    expect(sim.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });

  it('positive control: a small transfer to a known recipient needs no re-authentication', async () => {
    const s = scene({post: a => (a === ME.toBase58() ? {lamports: SOL - 1_005_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1_000_000})])], a => a === TO.toBase58());
    expect(sim.reasons).toEqual([]);
  });

  it('tokens: an existing account loses, a new account (created by the transaction) gains — its mint’s decimals read once; a closed account loses all', async () => {
    const closing = 'CLoSE7RZXBqUBQuYuPxMjBwRGt6aMYn7nUykAmgdUCLu';
    const s = scene({
      holdings: [holding(SRC, MAINNET_NOC_MINT, 100_000_000_000n), holding(closing, MAINNET_USDC_MINT, 2_000_000n, 6)],
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 90_000_000_000n) : a === NEW_ATA ? tokenAfter(ODD_MINT, 777n) : null),
      accounts: new Map([[ODD_MINT, {lamports: 1n, owner: TOKEN_PROGRAM, data: Uint8Array.from({length: 82}, (_, i) => (i === 44 ? 4 : 0))}]]),
    });
    const dexIx = new TransactionInstruction({programId: DEX, data: Buffer.from([1]), keys: [SRC, NEW_ATA, closing].map(k => ({pubkey: new PublicKey(k), isSigner: false, isWritable: true})).concat([{pubkey: ME, isSigner: true, isWritable: true}])});
    const sim = await run(s, [wire([dexIx])]);
    const out = sim.outcomes[0];
    expect(out?.ok).toBe(true);
    expect(out?.ok === true ? out.changes : null).toEqual([
      {mint: null, amount: '-5000', decimals: 9, usdMicros: '-750'},
      {mint: MAINNET_NOC_MINT, amount: '-10000000000', decimals: 9, usdMicros: '-1501000'},
      {mint: ODD_MINT, amount: '777', decimals: 4, usdMicros: null},
      {mint: MAINNET_USDC_MINT, amount: '-2000000', decimals: 6, usdMicros: '-2000000'},
    ]);
    expect(s.reads).toEqual([[], [ODD_MINT]]);
  });

  it('a writable token account of SOMEONE ELSE (a recipient’s) is not the account’s change, however its amount moves', async () => {
    const s = scene({
      holdings: [holding(SRC, MAINNET_NOC_MINT, 100n)],
      post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 90n) : a === NEW_ATA ? tokenAfter(MAINNET_NOC_MINT, 10n, TO.toBase58()) : null),
    });
    const sim = await run(s, [wire([tokenIx([3, ...u64(10n)], [SRC, NEW_ATA, ME.toBase58()])])]);
    const out = sim.outcomes[0];
    expect(out?.ok === true ? out.changes.map(c => [c.mint, c.amount]) : null).toEqual([
      [null, '-5000'],
      [MAINNET_NOC_MINT, '-10'],
    ]);
  });

  it('a transfer between the account’s own token accounts is not a first send; a token transfer to anyone else is', async () => {
    const other = 'CLoSE7RZXBqUBQuYuPxMjBwRGt6aMYn7nUykAmgdUCLu';
    const s = scene({holdings: [holding(SRC, MAINNET_NOC_MINT, 100n), holding(other, MAINNET_NOC_MINT, 0n)], post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const own = await run(s, [wire([tokenIx([3, ...u64(1n)], [SRC, other, ME.toBase58()])])]);
    expect(own.reasons).not.toContain('first-send');
    const away = await run(s, [wire([tokenIx([3, ...u64(1n)], [SRC, NEW_ATA, ME.toBase58()])])]);
    expect(away.reasons).toContain('first-send');
  });

  it('an approval by the account re-authenticates (B1 §3 "bounded approvals")', async () => {
    // The approval moves nothing: the source keeps its 100.
    const s = scene({holdings: [holding(SRC, MAINNET_NOC_MINT, 100n)], post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : a === SRC ? tokenAfter(MAINNET_NOC_MINT, 100n) : null)});
    const sim = await run(s, [wire([tokenIx([4, ...u64(50n)], [SRC, NEW_ATA, ME.toBase58()])])], () => true);
    expect(sim.reasons).toEqual(['approval']);
  });

  it('an outgoing token with no price is above the dollar threshold (fail closed)', async () => {
    const s = scene({holdings: [holding(SRC, ODD_MINT, 1_000_000n, 6)], post: a => (a === SRC ? tokenAfter(ODD_MINT, 999_999n) : a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(s, [wire([new TransactionInstruction({programId: DEX, data: Buffer.from([1]), keys: [{pubkey: new PublicKey(SRC), isSigner: false, isWritable: true}, {pubkey: ME, isSigner: true, isWritable: true}]})])], () => true);
    expect(sim.reasons).toEqual(['over-usd-threshold']);
  });

  it('the fee: the transaction’s own unit limit and price; none of the account’s when another account pays', async () => {
    const s = scene({post: a => (a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const ixs = [ComputeBudgetProgram.setComputeUnitLimit({units: 50_000}), ComputeBudgetProgram.setComputeUnitPrice({microLamports: 1_000_001}), SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})];
    const sim = await run(s, [wire(ixs)]);
    // 5 000 + ceil(1 000 001 × 50 000 / 10⁶) = 5 000 + 50 001.
    expect(sim.outcomes[0]).toMatchObject({ok: true, unitLimit: 50_000, feeLamports: '55001'});
    const paid = await run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})], {payer: TO})]);
    expect(paid.outcomes[0]).toMatchObject({ok: true, feeLamports: null});
  });

  it('an expired blockhash (the node’s BlockhashNotFound) is `expired` (Q21); any other error is `failed`, with its detail', async () => {
    const tx = wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})]);
    expect((await run(scene({err: 'BlockhashNotFound'}), [tx])).outcomes).toEqual([{ok: false, error: 'expired', detail: '"BlockhashNotFound"'}]);
    expect((await run(scene({err: {InstructionError: [0, {Custom: 1}]}}), [tx])).outcomes).toEqual([{ok: false, error: 'failed', detail: '{"InstructionError":[0,{"Custom":1}]}'}]);
  });

  it('a batch: each transaction simulated on its own, in order', async () => {
    const s = scene({post: a => (a === ME.toBase58() ? {lamports: SOL - 5_000n, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(s, [1, 2, 3].map(n => wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: n})])), () => true);
    expect(s.simulations).toHaveLength(3);
    expect(sim.outcomes).toHaveLength(3);
    expect(sim.slot).toBe(303);
  });

  it('lookup tables: read once, through getMultipleAccounts; only the lookup-table program’s accounts count', async () => {
    const table = new PublicKey(new Uint8Array(32).fill(9));
    const alt = {key: table, state: {deactivationSlot: 2n ** 64n - 1n, lastExtendedSlot: 0, lastExtendedSlotStartIndex: 0, authority: undefined, addresses: [TO]}, isActive: () => true} as unknown as AddressLookupTableAccount;
    const data = new Uint8Array(56 + 32);
    new DataView(data.buffer).setUint32(0, 1, true);
    data.set(TO.toBytes(), 56);
    const tx = wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})], {tables: [alt]});
    const good = scene({accounts: new Map([[table.toBase58(), {lamports: 1n, owner: ADDRESS_LOOKUP_TABLE_PROGRAM, data}]]), post: a => (a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    const sim = await run(good, [tx]);
    expect(good.reads[0]).toEqual([table.toBase58()]);
    expect(sim.keys[0]).toEqual([ME.toBase58(), SystemProgram.programId.toBase58(), TO.toBase58()]);
    expect(good.simulations[0]?.accounts).toEqual([ME.toBase58(), TO.toBase58()]);
    // The same bytes owned by another program are not a table: the key stays unresolved.
    const forged = scene({accounts: new Map([[table.toBase58(), {lamports: 1n, owner: TOKEN_PROGRAM, data}]]), post: a => (a === ME.toBase58() ? {lamports: SOL, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null)});
    expect((await run(forged, [tx])).keys[0]).toEqual([ME.toBase58(), SystemProgram.programId.toBase58(), null]);
  });

  it('a read that fails throws (the caller records the simulation as unreachable)', async () => {
    const s = scene({});
    s.deps.reader.getBalance = async () => {
      throw new Error('unreachable');
    };
    await expect(run(s, [wire([SystemProgram.transfer({fromPubkey: ME, toPubkey: TO, lamports: 1})])])).rejects.toThrow('unreachable');
    expect(base58.decode(ME.toBase58())).toHaveLength(32);
  });
});
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run ../core/solana/__tests__/rpc.test.ts src/background/__tests__/reauthPolicy.test.ts src/background/dapp/__tests__/simulate.test.ts`

Expected (the dry run): Test Files  3 failed (3) · Tests  7 failed | 41 passed (48)

- [ ] **Step 3: Implement.**

Change `core/solana/rpc.ts`:

````diff
diff --git a/core/solana/rpc.ts b/core/solana/rpc.ts
index 2b3f0f6..17a164c 100644
--- a/core/solana/rpc.ts
+++ b/core/solana/rpc.ts
@@ -225,6 +225,13 @@ export interface SimulationOutcome {
    */
   accounts: (SimulatedAccount | null)[] | null;
 }
+/**
+ * An account as getMultipleAccounts reports it (B1c-2: an address lookup table, a mint): lamports exact, its owner and
+ * its base64 data — read as a simulated account is (never rentEpoch).
+ */
+export type AccountData = SimulatedAccount;
+/** getMultipleAccounts answers at most this many addresses per call. */
+export const MAX_MULTIPLE_ACCOUNTS = 100;
 /** What an address holds: nothing, a plain wallet (System-owned), a program (executable), or anything else. */
 export type AccountKind = 'missing' | 'wallet' | 'program' | 'other';
 
@@ -236,6 +243,8 @@ export interface SolanaReader {
   getAccountExists(address: string): Promise<boolean>;
   getAccountKind(address: string): Promise<AccountKind>;
   getMultipleLamports(addresses: readonly string[]): Promise<bigint[]>;
+  /** B1c-2: each address's account with its data (null when it holds none), at most MAX_MULTIPLE_ACCOUNTS per call. */
+  getAccountsData(addresses: readonly string[]): Promise<(AccountData | null)[]>;
   getLatestBlockhash(): Promise<{blockhash: string; lastValidBlockHeight: number}>;
   getBlockHeight(): Promise<number>;
   getSignatureStatuses(signatures: readonly string[], searchTransactionHistory?: boolean): Promise<(SignatureStatus | null)[]>;
@@ -338,6 +347,13 @@ export function solanaReader(rpc: Rpc): SolanaReader {
       if (v.length !== addresses.length) throw new RpcMalformed('getMultipleAccounts: wrong length');
       return v.map(a => (a === null ? 0n : BigInt(count(obj(a, 'account').lamports, 'lamports'))));
     },
+    async getAccountsData(addresses) {
+      if (addresses.length === 0) return [];
+      if (addresses.length > MAX_MULTIPLE_ACCOUNTS) throw new RangeError(`getAccountsData: at most ${MAX_MULTIPLE_ACCOUNTS} addresses`);
+      const v = list(valueOf(await rpc.call('getMultipleAccounts', [addresses, {encoding: 'base64', ...COMMITMENT}]), 'getMultipleAccounts'), 'getMultipleAccounts.value');
+      if (v.length !== addresses.length) throw new RpcMalformed('getMultipleAccounts: wrong length');
+      return v.map(simulatedAccount);
+    },
     async getLatestBlockhash() {
       const v = obj(valueOf(await rpc.call('getLatestBlockhash', [COMMITMENT]), 'getLatestBlockhash'), 'getLatestBlockhash.value');
       return {blockhash: text(v.blockhash, 'blockhash'), lastValidBlockHeight: count(v.lastValidBlockHeight, 'lastValidBlockHeight')};
````

Create `extension/src/background/dapp/simulate.ts`:

````ts
import {base58, base64, base64urlnopad} from '@scure/base';
import type {WalletDeps} from '../deps';
import {dappReauthReasons, usdMicros, type DappReauthReason} from '../reauthPolicy';
import {MAINNET_NOC_MINT, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../core/presale/addresses';
import type {AccountData} from '../../../../core/solana/rpc';
import {COMPUTE_BUDGET_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM, addressField, decodeInstructions, type DecodedInstruction} from './decode/decode';
import {ADDRESS_LOOKUP_TABLE_PROGRAM, resolveKeys, tableAddresses, tablesOf} from './decode/keys';
import {isWritableIndex, type ParsedTx} from './decode/wire';

/**
 * The simulation (spec B1c §3.3, B1 §3): a dApp's transactions are run through the proxy (`simulateTransaction`, one
 * source — the coordinator, stated), with `accounts` = the signer's wallet account and every writable account the
 * transaction names (resolved through its lookup tables), so the account's token accounts it touches — an existing one,
 * one it creates, one it closes — come back in their post-state. A balance change is post − pre per mint, in base units
 * (bigint, rule 2): SOL from the wallet account (the fee included, as the node reports it), each token from the
 * account's token accounts (pre: getTokenAccountsByOwner for both token programs; post: the simulated 165-byte layout
 * whose owner field is this account). The transactions of a batch are simulated one by one against the current state
 * (a node cannot chain them). The re-authentication reasons (B1b's rules) are computed here, from the changes and the
 * decoded instructions, so `dapp.decide` needs no read of its own.
 */
export const DEFAULT_UNITS_PER_INSTRUCTION = 200_000;
export const MAX_COMPUTE_UNITS = 1_400_000;
export const WRAPPED_SOL_MINT = 'So11111111111111111111111111111111111111112';
/** Decimals the wallet knows without a read (SOL's own and its wrapped mint, NOC, USDC, USDT). */
const KNOWN_DECIMALS: ReadonlyMap<string, number> = new Map([
  [WRAPPED_SOL_MINT, 9],
  [MAINNET_NOC_MINT, 9],
  [MAINNET_USDC_MINT, 6],
  [MAINNET_USDT_MINT, 6],
]);

/** One mint's change for the account. `mint` null is SOL; `amount` signed base units; `usdMicros` signed, null without a price. */
export interface BalanceChange {
  mint: string | null;
  amount: string;
  decimals: number | null;
  usdMicros: string | null;
}

export type TxOutcome =
  | {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null}
  /** `expired`: the node does not know the transaction's blockhash any more (Q21); `failed`: it ran and failed. */
  | {ok: false; error: 'expired' | 'failed'; detail: string};

export interface TxSimulation {
  /** 128 random bits: `dapp.decide` names the simulation the window showed (stale → refused). */
  id: string;
  at: number;
  slot: number;
  elapsedMs: number;
  /** Per transaction, every account index resolved (null: a lookup table did not resolve it). */
  keys: (string | null)[][];
  outcomes: TxOutcome[];
  reasons: DappReauthReason[];
  /** An upper bound of the dApp blockhash's last valid height (the latest blockhash's, read now): a pending send's expiry check waits at least this long. */
  lastValidBlockHeight: number;
}

const TOKEN_PROGRAMS: ReadonlySet<string> = new Set([TOKEN_PROGRAM, TOKEN_2022_PROGRAM]);

/** A token account of `owner` in its post-state: mint and amount, or null when it is not one (or no longer exists). */
function tokenAccountOf(a: AccountData | null, owner: string): {mint: string; amount: bigint} | null {
  if (a === null || !TOKEN_PROGRAMS.has(a.owner) || a.data.length < 165) return null;
  if (base58.encode(a.data.subarray(32, 64)) !== owner) return null;
  return {mint: base58.encode(a.data.subarray(0, 32)), amount: new DataView(a.data.buffer, a.data.byteOffset, a.data.byteLength).getBigUint64(64, true)};
}

/** A mint account's decimals (byte 44 of the base layout), or null. */
function mintDecimals(a: AccountData | null): number | null {
  if (a === null || !TOKEN_PROGRAMS.has(a.owner) || a.data.length < 82) return null;
  return a.data[44] ?? null;
}

/**
 * The network fee, computed locally (B1 §4): 5 000 lamports per required signature plus the priority fee the
 * transaction sets (unit price × unit limit / 10⁶, rounded up; without a limit instruction, 200 000 units per other
 * instruction, at most 1 400 000 — the runtime's defaults).
 */
export function feeOf(p: ParsedTx, decoded: readonly DecodedInstruction[]): {feeLamports: bigint; unitLimit: number} {
  let limit: number | null = null;
  let price = 0n;
  for (const ix of decoded) {
    if (ix.programId !== COMPUTE_BUDGET_PROGRAM) continue;
    const v = ix.fields[0]?.value;
    if (ix.name === 'setComputeUnitLimit' && v?.kind === 'number') limit = Math.min(Number(v.value), MAX_COMPUTE_UNITS);
    if (ix.name === 'setComputeUnitPrice' && v?.kind === 'number') price = BigInt(v.value);
  }
  const others = decoded.filter(ix => ix.programId !== COMPUTE_BUDGET_PROGRAM).length;
  const unitLimit = limit ?? Math.min(others * DEFAULT_UNITS_PER_INSTRUCTION, MAX_COMPUTE_UNITS);
  const priority = (price * BigInt(unitLimit) + 999_999n) / 1_000_000n;
  return {feeLamports: 5_000n * BigInt(p.header.numRequiredSignatures) + priority, unitLimit};
}

/** The node's own word for an unknown blockhash (Q21). */
const isExpired = (err: unknown): boolean => err === 'BlockhashNotFound';

/** USD per whole token for a change's fiat line and the dollar rule: SOL (and wrapped SOL), USDC, USDT, NOC at the stage price; else none. */
async function pricesFor(deps: Pick<WalletDeps, 'prices' | 'stagePrice'>): Promise<(mint: string | null) => number | undefined> {
  const [p, stage] = await Promise.all([deps.prices().catch(() => null), deps.stagePrice().catch(() => null)]);
  return mint => {
    if (mint === null || mint === WRAPPED_SOL_MINT) return p?.solana;
    if (mint === MAINNET_USDC_MINT) return p?.usdc;
    if (mint === MAINNET_USDT_MINT) return p?.usdt;
    if (mint === MAINNET_NOC_MINT) return stage ?? undefined;
    return undefined;
  };
}

export interface SimulateInput {
  account: string;
  wires: readonly Uint8Array[];
  txs: readonly ParsedTx[];
  /** B1b's first-send facts (knownRecipients.ts recipientFacts): an own account or an address sent to before. */
  known: (address: string) => boolean;
  thresholdCents: number;
}

/** Runs the request's transactions through the proxy. Throws when a read fails (the caller records "unreachable"). */
export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'prices' | 'stagePrice' | 'now' | 'randomBytes'>, input: SimulateInput): Promise<TxSimulation> {
  const started = deps.now();
  const {account} = input;
  // 1. Lookup tables, read once for the whole batch.
  const tables = [...new Set(input.txs.flatMap(tablesOf))];
  const tableData = await deps.reader.getAccountsData(tables);
  const tableMap = new Map(tables.map((t, i) => {
    const a = tableData[i] ?? null;
    return [t, a !== null && a.owner === ADDRESS_LOOKUP_TABLE_PROGRAM ? tableAddresses(a.data) : null] as const;
  }));
  const resolved = input.txs.map(p => resolveKeys(p, tableMap));
  // 2. The account's state before.
  const [lamportsBefore, classic, t22, latest] = await Promise.all([
    deps.reader.getBalance(account),
    deps.reader.getTokenAccountsByOwner(account, {programId: TOKEN_PROGRAM}),
    deps.reader.getTokenAccountsByOwner(account, {programId: TOKEN_2022_PROGRAM}),
    deps.reader.getLatestBlockhash(),
  ]);
  const holdings = [...classic, ...t22];
  const before = new Map(holdings.map(h => [h.pubkey, h]));
  const decimals = new Map<string, number>(KNOWN_DECIMALS);
  for (const h of holdings) decimals.set(h.mint, h.decimals);
  const balanceOf = (mint: string | null): bigint => (mint === null ? lamportsBefore : holdings.filter(h => h.mint === mint).reduce((s, h) => s + h.amount, 0n));
  const priceOf = await pricesFor(deps);

  // 3. Each transaction.
  let slot = 0;
  const outcomes: TxOutcome[] = [];
  const decodedAll: DecodedInstruction[][] = [];
  for (const [i, p] of input.txs.entries()) {
    const keys = resolved[i]?.keys ?? [];
    const decoded = decodeInstructions(p, {keys});
    decodedAll.push(decoded);
    const writable = [...new Set(keys.filter((k, j): k is string => k !== null && k !== account && isWritableIndex(p, j)))];
    const addresses = [account, ...writable];
    const sim = await deps.reader.simulateTransaction(base64.encode(input.wires[i] ?? new Uint8Array()), {accounts: addresses});
    slot = Math.max(slot, sim.slot);
    if (sim.err !== null) {
      outcomes.push({ok: false, error: isExpired(sim.err) ? 'expired' : 'failed', detail: JSON.stringify(sim.err)});
      continue;
    }
    const post = sim.accounts ?? [];
    const delta = new Map<string | null, bigint>();
    const add = (mint: string | null, d: bigint) => delta.set(mint, (delta.get(mint) ?? 0n) + d);
    const self = post[0] ?? null;
    add(null, (self?.lamports ?? 0n) - lamportsBefore);
    for (const [j, address] of writable.entries()) {
      const after = tokenAccountOf(post[j + 1] ?? null, account);
      const pre = before.get(address);
      if (after !== null) add(after.mint, after.amount - (pre?.mint === after.mint ? pre.amount : 0n));
      else if (pre !== undefined) add(pre.mint, -pre.amount);
    }
    const {feeLamports, unitLimit} = feeOf(p, decoded);
    const changes: {mint: string | null; amount: bigint}[] = [...delta].filter(([, d]) => d !== 0n).map(([mint, amount]) => ({mint, amount}));
    outcomes.push({ok: true, changes: changes.map(c => ({mint: c.mint, amount: c.amount.toString(), decimals: null, usdMicros: null})), unitsConsumed: sim.unitsConsumed, unitLimit, feeLamports: p.signers[0] === account ? feeLamports.toString() : null});
  }
  // 4. Decimals the holdings did not tell (a mint the account did not hold before), read once.
  const unknownMints = [...new Set(outcomes.flatMap(o => (o.ok ? o.changes.map(c => c.mint) : [])).filter((m): m is string => m !== null && !decimals.has(m)))];
  if (unknownMints.length > 0) {
    const mints = await deps.reader.getAccountsData(unknownMints);
    unknownMints.forEach((m, i) => {
      const d = mintDecimals(mints[i] ?? null);
      if (d !== null) decimals.set(m, d);
    });
  }
  // 5. Decimals and dollars on every change; the outgoing totals per mint for the rules.
  const outgoing = new Map<string | null, bigint>();
  for (const o of outcomes) {
    if (!o.ok) continue;
    for (const c of o.changes) {
      const d = c.mint === null ? 9 : (decimals.get(c.mint) ?? null);
      const amount = BigInt(c.amount);
      const abs = amount < 0n ? -amount : amount;
      const usd = d === null ? null : usdMicros(abs, d, priceOf(c.mint));
      c.decimals = d;
      c.usdMicros = usd === null ? null : (amount < 0n ? -usd : usd).toString();
      if (amount < 0n) outgoing.set(c.mint, (outgoing.get(c.mint) ?? 0n) - amount);
    }
  }
  const firstSend = decodedAll.some(list =>
    list.some(ix => {
      const from = ix.program === 'system' && ix.name === 'transfer' ? addressField(ix, 'from') : (ix.program === 'token' || ix.program === 'token-2022') && (ix.name === 'transfer' || ix.name === 'transferChecked') ? addressField(ix, 'owner') : null;
      const to = ix.program === 'system' ? addressField(ix, 'to') : addressField(ix, 'destination');
      // An own token account (held before) is not a recipient.
      return from === account && to !== null && !input.known(to) && !before.has(to);
    }),
  );
  const approval = decodedAll.some(list => list.some(ix => (ix.program === 'token' || ix.program === 'token-2022') && (ix.name === 'approve' || ix.name === 'approveChecked') && addressField(ix, 'owner') === account));
  const reasons = dappReauthReasons({
    outgoing: [...outgoing].map(([mint, amount]) => {
      const d = mint === null ? 9 : (decimals.get(mint) ?? null);
      return {amount, balance: balanceOf(mint), usdMicros: d === null ? null : usdMicros(amount, d, priceOf(mint))};
    }),
    firstSend,
    approval,
    thresholdCents: input.thresholdCents,
  });
  return {
    id: base64urlnopad.encode(deps.randomBytes(16)),
    at: deps.now(),
    slot,
    elapsedMs: Math.max(0, deps.now() - started),
    keys: resolved.map(r => r.keys),
    outcomes,
    reasons,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  };
}
````

Change `extension/src/background/reauthPolicy.ts`:

````diff
diff --git a/extension/src/background/reauthPolicy.ts b/extension/src/background/reauthPolicy.ts
index 164bc25..d7f2d74 100644
--- a/extension/src/background/reauthPolicy.ts
+++ b/extension/src/background/reauthPolicy.ts
@@ -38,3 +38,25 @@ export function sendReauthReasons(i: {knownRecipient: boolean; amount: bigint; b
   if (!i.knownRecipient && i.balance > 0n && i.amount * 100n >= i.balance * WHOLE_BALANCE_PERCENT) out.push('whole-balance-to-new');
   return out;
 }
+
+/**
+ * B1c-2 (spec B1c §3.3, B1 §3 "Re-authentication"): B1b's rules for a dApp's transaction, read from what it does —
+ * the simulation's balance changes and the decoded instructions — instead of a send's intent. `outgoing`: each mint
+ * this account loses (SOL with the fee), with the account's balance of it before and its dollar value (null: no price,
+ * which counts as above the threshold — fail closed, as B1b). `firstSend`: a transfer from this account to an address
+ * it never sent to (the same facts as B1b's first-send rule). `approval`: an Approve / ApproveChecked by this account
+ * (B1 §3 "bounded approvals"; the whole-balance and u64-max ones are B1c-3's blocks — until then they re-authenticate
+ * too). Every rule fails closed, as sendReauthReasons.
+ */
+export type DappReauthReason = SendReauthReason | 'approval';
+
+export function dappReauthReasons(i: {outgoing: readonly {amount: bigint; balance: bigint; usdMicros: bigint | null}[]; firstSend: boolean; approval: boolean; thresholdCents: number}): DappReauthReason[] {
+  const out: DappReauthReason[] = [];
+  const moving = i.outgoing.filter(o => o.amount > 0n);
+  if (i.firstSend) out.push('first-send');
+  if (moving.some(o => o.balance <= 0n || o.amount * 100n > o.balance * REAUTH_PERCENT)) out.push('over-5-percent');
+  if (moving.some(o => o.usdMicros === null || o.usdMicros > BigInt(i.thresholdCents) * 10_000n)) out.push('over-usd-threshold');
+  if (i.firstSend && moving.some(o => o.balance > 0n && o.amount * 100n >= o.balance * WHOLE_BALANCE_PERCENT)) out.push('whole-balance-to-new');
+  if (i.approval) out.push('approval');
+  return out;
+}
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run ../core/solana/__tests__/rpc.test.ts src/background/__tests__/reauthPolicy.test.ts src/background/dapp/__tests__/simulate.test.ts` — expected: Test Files  3 passed (3) · Tests  60 passed (60)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  160 passed (160) · Tests  3153 passed (3153). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M2a | `simulate.ts`: a token account's owner field not checked | simulate.test.ts "a writable token account of SOMEONE ELSE" — RED Tests  1 failed \| 11 passed (12) |
| M2b | `simulate.ts`: a lookup table owned by any program accepted | simulate.test.ts "lookup tables … only the lookup-table program's accounts count" — RED Tests  1 failed \| 11 passed (12) |
| M2c | `simulate.ts`: `BlockhashNotFound` not `expired` | simulate.test.ts "an expired blockhash … is `expired`" — RED Tests  1 failed \| 11 passed (12) |
| M2d | `simulate.ts`: an own token account counted as a first-send recipient | simulate.test.ts "a transfer between the account's own token accounts is not a first send" — RED Tests  1 failed \| 11 passed (12) |
| M2e | `simulate.ts`: the fee shown when another account pays it | simulate.test.ts "the fee" — RED Tests  1 failed \| 11 passed (12) |
| M2f | `reauthPolicy.ts`: no `approval` reason | reauthPolicy.test.ts "each rule by itself" — RED Tests  1 failed \| 16 passed (17) |
| M2g | `core/solana/rpc.ts`: getAccountsData's length check dropped | rpc.test.ts "getAccountsData refuses a reply of the wrong length" — RED Tests  1 failed \| 30 passed (31) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension,core): B1c-2 the simulation — lookup tables, balance changes per mint, the fee, B1b's re-authentication reasons; getAccountsData" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 3: The page side: `page.signTransaction` and `page.signAndSendTransaction` (every refusal by its reason, in order), the origin-mismatch notice, the provider's two transaction features

**Spec:** §1.4 (the two messages), §1.6, §2.2 (sign requests), §3.3 (1–5; fee payer or signer; a second identical request), D8, C3, C14, B1 §3 (origin mismatch: blocked, no override); Scope R12, R16, R24; Review Focus 4, 5

**Files:**
- Test: `extension/src/background/dapp/__tests__/store.test.ts`
- Test (new): `extension/src/background/dapp/__tests__/txPage.test.ts`
- Modify: `extension/src/background/dapp/decide.ts`
- Modify: `extension/src/background/dapp/pageApi.ts`
- Modify: `extension/src/background/dapp/queue.ts`
- Modify: `extension/src/background/dapp/store.ts`
- Create: `extension/src/background/dapp/txRequest.ts`
- Test: `extension/src/provider/__tests__/provider.test.ts`
- Modify: `extension/src/provider/bridge.ts`
- Modify: `extension/src/provider/codec.ts`
- Modify: `extension/src/provider/protocol.ts`
- Modify: `extension/src/provider/wallet.ts`
- Test: `extension/src/relay/__tests__/relay.test.ts`

**Interfaces:**
- Consumes: Task 1's `parseWire`, `MAX_TX_BYTES`, `SYSTEM_PROGRAM`; B1c-1's `queueAccess`, `admit`, `enqueue`, `resent`, `grantedAccount`, `documentChanged`, `ensureWindow`, `isBlocked`, `inCooldown`.
- Produces:
  - `dapp/txRequest.ts`: `MAX_BATCH = 5`, `CHAIN = 'solana:mainnet'`; `interface TxRequest {account: string; wires: string[]; txs: ParsedTx[]}`; `txRequestOf(m, kind: 'signTransaction' | 'signAndSendTransaction'): TxRequest | null`; `slotOf(tx, account): number`; `othersSigned(tx, account): boolean`; `usesDurableNonce(tx): boolean`; `sameMessage(a: readonly string[], b: readonly string[]): boolean`.
  - `store.ts`: `type EntryType = 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction' | 'mismatch'`, `ENTRY_TYPES`; `Entry` gains `transactions: string[] | null` and `granted: string | null`.
  - `pageApi.ts`: `PAGE_TYPES` gains the two transaction types; the handlers answer as the table below.
  - `decide.ts`: a `mismatch` entry takes only `reject` (`malformed` otherwise); a transaction request's approval is `malformed` until Task 4.
  - The provider (`wallet.ts`): `solana:signTransaction` and `solana:signAndSendTransaction`, version `1.0.0`, `supportedTransactionVersions: ['legacy', 0]`; the account features list both. `codec.ts`: `signatureBytes(signature: string): Uint8Array | null`.
  - The page codes (spec rev 3.3 §1.6, review 1 M3): `store.ts` `ErrorCode` / `ERROR_CODES` and the provider's `protocol.ts` `ERROR_CODES` gain `send-failed`; `bridge.ts` `ERROR_TEXT['send-failed'] = {code: 'send-failed', message: 'The transaction could not be sent.'}` (Task 5 answers it).

The order of the refusals (each asserted by its reason, before any window): the payload's shape — 1–5 transactions (a sixth is D8's refusal), each ≤ 1 232 bytes and canonical, `chain` absent or `solana:mainnet`, a base58 account — `invalid-request` (as §9's last row for signMessage: a page without a grant learns only that its payload was malformed); the grant — `unauthorized` unless this origin holds one for exactly this account while unlocked, **and** the mismatch notice (R16) when another origin holds it; the account must be the fee payer or a required signer of every transaction — `invalid-request`; sign-and-send only: every other signature present and valid, no durable nonce (R12) — `invalid-request`, and the same message already open — `rejected` (§3.3); a blocked or cooling-down host — `rejected`, no entry; C3's caps; then queued with the bytes exactly as sent. The provider sends a batch as one request and each sign-and-send input as its own, in turn (R24); an input with no `account` is `invalid-request`, never a `TypeError` (R32, review 1 L8). The page codes gain `send-failed` on both sides with its fixed message (R14, review 1 M3) — Task 5 is its one user.

- [ ] **Step 1: Write the failing tests.**

Change `extension/src/background/dapp/__tests__/store.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/store.test.ts b/extension/src/background/dapp/__tests__/store.test.ts
index 91fe0ae..c127e27 100644
--- a/extension/src/background/dapp/__tests__/store.test.ts
+++ b/extension/src/background/dapp/__tests__/store.test.ts
@@ -10,7 +10,7 @@ const T = 1_000_000_000;
 const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: T, lastUsedAt: T, recent: [], ...over});
 const entry = (over: Partial<Entry> = {}): Entry => ({
   requestId: 'r1', pageId: 'p1', origin: 'https://dapp.test', host: 'dapp.test', tabId: 7, documentId: null, type: 'connect', account: null,
-  message: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null, decision: null, answer: null, answeredAt: null, ...over,
+  message: null, transactions: null, granted: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null, decision: null, answer: null, answeredAt: null, ...over,
 });
 
 // Spec §2.1, §2.6, C14 — the stores the request lifecycle writes, and the one section that writes them.
````

Create `extension/src/background/dapp/__tests__/txPage.test.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {PublicKey, SystemProgram, Transaction, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import {setSession} from '../../session';
import {lock} from '../../autolock';
import {VAULT_KEY} from '../../accountsStore';
import {BLOCKED_KEY} from '../blocked';
import {GRANTS_KEY, type Grant} from '../grants';
import {LIMITS_KEY} from '../limits';
import {runUnlockHook} from '../queue';
import {readDappSession} from '../store';
import {MAX_TX_BYTES} from '../decode/wire';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {ACCOUNT, BLOCKHASH, RECIPIENT} from '../../__tests__/fixtures';
import {TAB, openPage} from './pageHarness';

const DAPP = 'https://dapp.test';
const OTHER = 'https://jup.ag';
const ME = new PublicKey(ACCOUNT.publicKey);
const TO = new PublicKey(RECIPIENT);
/** A co-signer (a dApp's own key): a real keypair, 32 × 0x03. */
const CO_SEED = new Uint8Array(32).fill(3);
const CO = new PublicKey(ed25519.getPublicKey(CO_SEED));
const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...over});

const message = (instructions: TransactionInstruction[], payer = ME) => new TransactionMessage({payerKey: payer, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message();
const transfer = (lamports = 1, from = ME) => SystemProgram.transfer({fromPubkey: from, toPubkey: TO, lamports});
const v0 = (instructions: TransactionInstruction[] = [transfer()], payer = ME): string => base64.encode(new VersionedTransaction(message(instructions, payer)).serialize());
/** A v0 transaction the co-signer pays for and signs; the account signs too (a required signer). */
function coSigned(o: {sign?: boolean; corrupt?: boolean} = {}): string {
  const tx = new VersionedTransaction(message([transfer(1, ME)], CO));
  if (o.sign !== false) {
    const sig = ed25519.sign(tx.message.serialize(), CO_SEED);
    if (o.corrupt === true) sig[0] = (sig[0] ?? 0) ^ 1;
    tx.addSignature(CO, sig);
  }
  return base64.encode(tx.serialize());
}

async function setup(o: {grant?: Grant | null; others?: Grant[]} = {}) {
  const ext = fakeExt();
  const deps = fakeDeps();
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
  await setSession(ext, [ACCOUNT]);
  await runUnlockHook(ext, deps);
  await ext.local.set(GRANTS_KEY, [...(o.grant === null ? [] : [o.grant ?? grant(DAPP)]), ...(o.others ?? [])]);
  const page = openPage(ext, deps, DAPP);
  const signTx = (id: string, transactions: unknown, over: Record<string, unknown> = {}) => page.ask({type: 'page.signTransaction', id, account: ACCOUNT.publicKey, transactions, ...over});
  const send = (id: string, transaction: unknown, over: Record<string, unknown> = {}) => page.ask({type: 'page.signAndSendTransaction', id, account: ACCOUNT.publicKey, transaction, ...over});
  const queue = async () => (await readDappSession(ext)).queue;
  return {ext, deps, page, signTx, send, queue};
}

// Spec B1c §1.4, §3.3: the two transaction requests, each refusal by its reason and in its order, before any window.
describe('page.signTransaction and page.signAndSendTransaction — the page side', () => {
  it('positive controls: a single transaction, a batch of five, a legacy one, a sign-and-send — queued with the bytes as sent, one window', async () => {
    const c = await setup();
    const one = await c.signTx('t1', [v0()]);
    expect(one).toEqual({id: 't1', accepted: true, requestId: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/)});
    expect((await c.queue())[0]).toMatchObject({type: 'signTransaction', account: ACCOUNT.publicKey, transactions: [v0()], state: 'queued', tabId: TAB, origin: DAPP});
    expect(c.ext.approval.created).toHaveLength(1);
    // The same request re-sent (its accepted lost with the port): the same entry (C9).
    expect(await c.signTx('t1', [v0()])).toEqual(one);
    const batch = await setup();
    expect(await batch.signTx('b', [1, 2, 3, 4, 5].map(n => v0([transfer(n)])))).toMatchObject({accepted: true});
    expect((await batch.queue())[0]?.transactions).toHaveLength(5);
    const legacy = await setup();
    const bytes = new Transaction({feePayer: ME, recentBlockhash: BLOCKHASH}).add(transfer()).serialize({requireAllSignatures: false, verifySignatures: false});
    expect(await legacy.signTx('l', [base64.encode(bytes)])).toMatchObject({accepted: true});
    const send = await setup();
    expect(await send.send('s', v0(), {options: {skipPreflight: true}})).toMatchObject({accepted: true});
    expect((await send.queue())[0]).toMatchObject({type: 'signAndSendTransaction', transactions: [v0()]});
  });

  it('invalid-request before the grant is read (§9): six transactions, none, not a list, one over 1 232 bytes, trailing bytes, another chain, a bad account', async () => {
    for (const grant of [undefined, null]) {
      const c = await setup(grant === null ? {grant: null} : {});
      const filler = (n: number) => v0([new TransactionInstruction({programId: TO, keys: [{pubkey: ME, isSigner: true, isWritable: true}], data: Buffer.alloc(n)})]);
      let n = 900;
      while (base64.decode(filler(n)).length <= MAX_TX_BYTES) n++;
      const cases: [string, unknown, Record<string, unknown>][] = [
        ['six', [1, 2, 3, 4, 5, 6].map(i => v0([transfer(i)])), {}],
        ['none', [], {}],
        ['not-a-list', v0(), {}],
        ['too-long', [filler(n)], {}],
        ['trailing', [base64.encode(Uint8Array.of(...base64.decode(v0()), 0))], {}],
        ['chain', [v0()], {chain: 'solana:devnet'}],
        ['account', [v0()], {account: 'not-a-key'}],
        ['garbage', ['%%%'], {}],
      ];
      for (const [id, txs, over] of cases) expect([id, await c.signTx(id, txs, over)]).toEqual([id, {id, error: 'invalid-request'}]);
      expect(await c.send('opts', v0(), {options: 'skip'})).toEqual({id: 'opts', error: 'invalid-request'});
      expect(c.ext.approval.created).toEqual([]);
      expect(await c.queue()).toEqual([]);
    }
  });

  it('unauthorized: no grant, a grant for another account, while locked — and the chain may be named', async () => {
    const none = await setup({grant: null});
    expect(await none.signTx('a', [v0()])).toEqual({id: 'a', error: 'unauthorized'});
    const other = await setup({grant: grant(DAPP, {account: RECIPIENT})});
    expect(await other.signTx('b', [v0()])).toEqual({id: 'b', error: 'unauthorized'});
    const locked = await setup();
    await lock(locked.ext);
    expect(await locked.send('c', v0())).toEqual({id: 'c', error: 'unauthorized'});
    const ok = await setup();
    expect(await ok.signTx('d', [v0()], {chain: 'solana:mainnet'})).toMatchObject({accepted: true});
  });

  it('the account must sign every transaction (fee payer or a required signer): one it does not sign is invalid-request', async () => {
    const c = await setup();
    expect(await c.signTx('x', [v0(), v0([transfer(1, TO)], TO)])).toEqual({id: 'x', error: 'invalid-request'});
    // A required signer that is not the fee payer is enough.
    expect(await c.signTx('y', [coSigned({sign: false})])).toMatchObject({accepted: true});
  });

  it('signAndSend: every other signature present and valid, no durable nonce; positive control: a co-signed one is queued', async () => {
    const c = await setup();
    expect(await c.send('unsigned', coSigned({sign: false}))).toEqual({id: 'unsigned', error: 'invalid-request'});
    expect(await c.send('corrupt', coSigned({corrupt: true}))).toEqual({id: 'corrupt', error: 'invalid-request'});
    const nonce = v0([SystemProgram.nonceAdvance({noncePubkey: TO, authorizedPubkey: ME}), transfer()]);
    expect(await c.send('nonce', nonce)).toEqual({id: 'nonce', error: 'invalid-request'});
    // signTransaction signs a durable-nonce transaction (the dApp sends it).
    expect(await c.signTx('nonce-sign', [nonce])).toMatchObject({accepted: true});
    const d = await setup();
    expect(await d.send('ok', coSigned())).toMatchObject({accepted: true});
  });

  it('signAndSend: the same message while the first is unanswered is rejected (§3.3) — from another tab of another granted origin too', async () => {
    const c = await setup({others: [grant(OTHER)]});
    expect(await c.send('s1', v0())).toMatchObject({accepted: true});
    const second = openPage(c.ext, c.deps, OTHER, {tab: {id: TAB + 1}, documentId: 'doc-9'});
    expect(await second.ask({type: 'page.signAndSendTransaction', id: 's2', account: ACCOUNT.publicKey, transaction: v0()})).toEqual({id: 's2', error: 'rejected'});
    // Another message from that tab is admitted (positive control: the rule is the message, not the tab).
    expect(await second.ask({type: 'page.signAndSendTransaction', id: 's3', account: ACCOUNT.publicKey, transaction: v0([transfer(2)])})).toMatchObject({accepted: true});
  });

  it('a blocked or cooling-down host is rejected with no entry; C3: a second open request from the host is request-pending', async () => {
    const blocked = await setup();
    await blocked.ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    // A restore keeps a block and a lingering grant (D3): rejected, as signMessage — no entry, no window.
    expect(await blocked.signTx('a', [v0()])).toEqual({id: 'a', error: 'rejected'});
    expect(await blocked.queue()).toEqual([]);
    const cooling = await setup();
    await cooling.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: 'host:dapp.test', until: cooling.deps.clock.t + 60_000}], windows: [], notice: false});
    expect(await cooling.signTx('b', [v0()])).toEqual({id: 'b', error: 'rejected'});
    expect(await cooling.queue()).toEqual([]);
    const c = await setup();
    expect(await c.signTx('c', [v0()])).toMatchObject({accepted: true});
    expect(await c.send('d', v0([transfer(3)]))).toEqual({id: 'd', error: 'request-pending'});
  });
});

// #48 "origin-mismatch · auto-reject" (B1 §3: no override): the account another origin was granted.
describe('the origin-mismatch notice', () => {
  it('a request naming an account granted to ANOTHER origin: unauthorized at once, and a notice entry the window shows', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    const [notice] = await c.queue();
    expect(notice).toMatchObject({type: 'mismatch', pageId: '', origin: DAPP, account: ACCOUNT.publicKey, granted: OTHER, transactions: null, state: 'queued'});
    expect(c.ext.approval.created).toHaveLength(1);
    // The page is never answered from it: a re-send of the same id is a new request (unauthorized again), not the notice.
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    expect(c.page.answersFor(String(notice?.requestId))).toEqual([]);
  });

  it('negative controls — no notice: an account granted to nobody, an account not in the session, while locked, a blocked host, a cooling host, C3', async () => {
    const nobody = await setup({grant: null});
    expect(await nobody.signTx('a', [v0()])).toEqual({id: 'a', error: 'unauthorized'});
    expect(await nobody.queue()).toEqual([]);
    const stranger = await setup({grant: null, others: [grant(OTHER, {account: RECIPIENT})]});
    const tx = base64.encode(new VersionedTransaction(message([transfer(1, TO)], TO)).serialize());
    expect(await stranger.signTx('b', [tx], {account: RECIPIENT})).toEqual({id: 'b', error: 'unauthorized'});
    expect(await stranger.queue()).toEqual([]);
    const locked = await setup({grant: null, others: [grant(OTHER)]});
    await lock(locked.ext);
    expect(await locked.signTx('c', [v0()])).toEqual({id: 'c', error: 'unauthorized'});
    expect((await locked.queue()).filter(e => e.state === 'queued')).toEqual([]);
    const blocked = await setup({grant: null, others: [grant(OTHER)]});
    await blocked.ext.local.set(BLOCKED_KEY, [{host: 'dapp.test', blockedAt: 1, imitates: null}]);
    expect(await blocked.signTx('d', [v0()])).toEqual({id: 'd', error: 'unauthorized'});
    expect(await blocked.queue()).toEqual([]);
    const blockedGrant = await setup({grant: null, others: [grant(OTHER)]});
    await blockedGrant.ext.local.set(BLOCKED_KEY, [{host: 'jup.ag', blockedAt: 1, imitates: null}]);
    expect(await blockedGrant.signTx('e', [v0()])).toEqual({id: 'e', error: 'unauthorized'});
    expect(await blockedGrant.queue()).toEqual([]);
    const cooling = await setup({grant: null, others: [grant(OTHER)]});
    await cooling.ext.local.set(LIMITS_KEY, {rejections: [], cooldowns: [{key: `tab:${TAB}`, until: cooling.deps.clock.t + 60_000}], windows: [], notice: false});
    expect(await cooling.signTx('h', [v0()])).toEqual({id: 'h', error: 'unauthorized'});
    expect(await cooling.queue()).toEqual([]);
    const capped = await setup({grant: null, others: [grant(OTHER)]});
    expect(await capped.signTx('f', [v0()])).toEqual({id: 'f', error: 'unauthorized'});
    expect(await capped.signTx('g', [v0()])).toEqual({id: 'g', error: 'unauthorized'});
    expect((await capped.queue()).filter(e => e.type === 'mismatch')).toHaveLength(1);
  });

  it('a notice is only ever dismissed: approve, report and block are refused; reject answers it (and counts toward C14)', async () => {
    const c = await setup({grant: null, others: [grant(OTHER)]});
    await c.signTx('m', [v0()]);
    const requestId = String((await c.queue())[0]?.requestId);
    const approve = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/approve.html`};
    const {handleMessage} = await import('../../messages');
    for (const decision of ['approve', 'report', 'block']) {
      expect(await handleMessage(c.ext, {type: 'dapp.decide', requestId, decision, account: ACCOUNT.publicKey}, approve, c.deps)).toEqual({ok: false, error: 'malformed'});
    }
    expect(await handleMessage(c.ext, {type: 'dapp.decide', requestId, decision: 'reject'}, approve, c.deps)).toEqual({ok: true});
    expect((await c.queue())[0]).toMatchObject({state: 'answered', answer: {error: 'rejected'}});
    expect(((await c.ext.local.get(LIMITS_KEY)) as {rejections: unknown[]}).rejections).toHaveLength(2);
    expect(base58.decode(ACCOUNT.publicKey)).toHaveLength(32);
  });
});
````

Change `extension/src/provider/__tests__/provider.test.ts`:

````diff
diff --git a/extension/src/provider/__tests__/provider.test.ts b/extension/src/provider/__tests__/provider.test.ts
index 2e28d84..36990a5 100644
--- a/extension/src/provider/__tests__/provider.test.ts
+++ b/extension/src/provider/__tests__/provider.test.ts
@@ -3,7 +3,7 @@ import {join} from 'node:path';
 import {ed25519} from '@noble/curves/ed25519.js';
 import {base58, base64} from '@scure/base';
 import {createBridge, NocturaError} from '../bridge';
-import {addressBytes} from '../codec';
+import {addressBytes, signatureBytes} from '../codec';
 import {ICON} from '../icon';
 import {NocturaWallet} from '../wallet';
 
@@ -40,7 +40,7 @@ const flush = () => new Promise(r => setTimeout(r, 0));
 
 // Spec §1.1, D6, D10 — the MAIN-world provider: one wallet "Noctura", only plan 1's features, no state but the accounts.
 describe('the Noctura wallet (Wallet Standard)', () => {
-  it('name, version, chains solana:mainnet only, and exactly plan 1’s four features (D10)', () => {
+  it('name, version, chains solana:mainnet only, and exactly the six features it implements — B1c-2 adds the two transaction features (D10)', () => {
     const wallet = new NocturaWallet(createBridge(fakeWindow().win));
     expect([wallet.name, wallet.version, wallet.chains]).toEqual(['Noctura', '1.0.0', ['solana:mainnet']]);
     expect(Object.fromEntries(Object.entries(wallet.features).map(([k, v]) => [k, v.version]))).toEqual({
@@ -48,7 +48,11 @@ describe('the Noctura wallet (Wallet Standard)', () => {
       'standard:disconnect': '1.0.0',
       'standard:events': '1.0.0',
       'solana:signMessage': '1.1.0',
+      'solana:signTransaction': '1.0.0',
+      'solana:signAndSendTransaction': '1.0.0',
     });
+    expect(wallet.features['solana:signTransaction'].supportedTransactionVersions).toEqual(['legacy', 0]);
+    expect(wallet.features['solana:signAndSendTransaction'].supportedTransactionVersions).toEqual(['legacy', 0]);
     expect(wallet.accounts).toEqual([]);
   });
 
@@ -69,7 +73,7 @@ describe('the Noctura wallet (Wallet Standard)', () => {
     const r = await pending;
     expect(r.accounts.map(a => a.address)).toEqual([A]);
     expect(Array.from(r.accounts[0]?.publicKey ?? [])).toEqual(Array.from(base58.decode(A)));
-    expect(r.accounts[0]?.features).toEqual(['solana:signMessage']);
+    expect(r.accounts[0]?.features).toEqual(['solana:signMessage', 'solana:signTransaction', 'solana:signAndSendTransaction']);
     expect(changes).toEqual([[A]]);
     // A silent connect says so.
     void wallet.features['standard:connect'].connect({silent: true});
@@ -111,6 +115,18 @@ describe('the Noctura wallet (Wallet Standard)', () => {
     expect(new NocturaError('unauthorized').code).toBe(4100);
   });
 
+  // B1c-2 (spec §1.6, rev 3.3): a broadcast the user approved that never reached the network has its own code.
+  it('send-failed: its own code and fixed message, "The transaction could not be sent." — not invalid-request', async () => {
+    const w = fakeWindow();
+    const wallet = new NocturaWallet(createBridge(w.win));
+    const c = wallet.features['standard:connect'].connect();
+    answerLast(w, {result: {accounts: [A]}});
+    const [account] = (await c).accounts;
+    const s = wallet.features['solana:signAndSendTransaction'].signAndSendTransaction({account: account!, transaction: Uint8Array.of(1)});
+    answerLast(w, {error: 'send-failed'});
+    await expect(s).rejects.toMatchObject({name: 'NocturaError', code: 'send-failed', message: 'The transaction could not be sent.'});
+  });
+
   it('signMessage: refused for an account it was not given (no message posted); for the connected one, the bytes come back', async () => {
     const w = fakeWindow();
     const wallet = new NocturaWallet(createBridge(w.win));
@@ -128,6 +144,64 @@ describe('the Noctura wallet (Wallet Standard)', () => {
     expect(await s).toEqual([{signedMessage: message, signature: sig, signatureType: 'ed25519'}]);
   });
 
+  // B1c-2 (spec §1.4, §3.3): a batch is one request; each sign-and-send is its own.
+  it('signTransaction: one page.signTransaction for every input (base64, the chain named), the signed bytes back in order', async () => {
+    const w = fakeWindow();
+    const wallet = new NocturaWallet(createBridge(w.win));
+    const c = wallet.features['standard:connect'].connect();
+    answerLast(w, {result: {accounts: [A]}});
+    const [account] = (await c).accounts;
+    const txs = [Uint8Array.of(1, 2), Uint8Array.of(3), Uint8Array.of(4, 5, 6)];
+    const s = wallet.features['solana:signTransaction'].signTransaction(...txs.map(transaction => ({account: account!, transaction, chain: 'solana:mainnet' as const})));
+    expect(w.posted[1]?.m).toMatchObject({type: 'page.signTransaction', payload: {account: A, transactions: txs.map(t => base64.encode(t)), chain: 'solana:mainnet'}});
+    answerLast(w, {result: {signed: [base64.encode(Uint8Array.of(9)), base64.encode(Uint8Array.of(8)), base64.encode(Uint8Array.of(7))]}});
+    expect(await s).toEqual([{signedTransaction: Uint8Array.of(9)}, {signedTransaction: Uint8Array.of(8)}, {signedTransaction: Uint8Array.of(7)}]);
+    expect(await wallet.features['solana:signTransaction'].signTransaction()).toEqual([]);
+    expect(w.posted).toHaveLength(2);
+  });
+
+  it('signTransaction: refused before posting — an account it was not given, two accounts in one batch, another chain, an input with no account; a reply of the wrong length', async () => {
+    const w = fakeWindow();
+    const wallet = new NocturaWallet(createBridge(w.win));
+    const c = wallet.features['standard:connect'].connect();
+    answerLast(w, {result: {accounts: [A]}});
+    const [account] = (await c).accounts;
+    const stranger = {...account!, address: B, publicKey: base58.decode(B)};
+    const sign = wallet.features['solana:signTransaction'].signTransaction;
+    await expect(sign({account: stranger, transaction: Uint8Array.of(1)})).rejects.toMatchObject({code: 4100});
+    await expect(sign({account: account!, transaction: Uint8Array.of(1)}, {account: stranger, transaction: Uint8Array.of(1)})).rejects.toMatchObject({code: 'invalid-request'});
+    await expect(sign({account: account!, transaction: Uint8Array.of(1), chain: 'solana:devnet'})).rejects.toMatchObject({code: 'invalid-request'});
+    // Review 1 L8: an input with no account is a NocturaError (invalid-request), never a TypeError.
+    const noAccount = {transaction: Uint8Array.of(1)} as unknown as Parameters<typeof sign>[0];
+    await expect(sign(noAccount)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
+    await expect(sign({account: account!, transaction: Uint8Array.of(1)}, noAccount)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
+    await expect(wallet.features['solana:signAndSendTransaction'].signAndSendTransaction(noAccount)).rejects.toMatchObject({name: 'NocturaError', code: 'invalid-request'});
+    expect(w.posted).toHaveLength(1);
+    const s = sign({account: account!, transaction: Uint8Array.of(1)});
+    answerLast(w, {result: {signed: []}});
+    await expect(s).rejects.toMatchObject({code: 'invalid-request'});
+  });
+
+  it('signAndSendTransaction: one request per input, in turn; the base58 signature comes back as its 64 bytes; anything else is invalid-request', async () => {
+    const w = fakeWindow();
+    const wallet = new NocturaWallet(createBridge(w.win));
+    const c = wallet.features['standard:connect'].connect();
+    answerLast(w, {result: {accounts: [A]}});
+    const [account] = (await c).accounts;
+    const sig = new Uint8Array(64).fill(5);
+    const s = wallet.features['solana:signAndSendTransaction'].signAndSendTransaction({account: account!, transaction: Uint8Array.of(1)}, {account: account!, transaction: Uint8Array.of(2)});
+    expect(w.posted[1]?.m).toMatchObject({type: 'page.signAndSendTransaction', payload: {account: A, transaction: base64.encode(Uint8Array.of(1)), chain: 'solana:mainnet'}});
+    expect(w.posted).toHaveLength(2);
+    answerLast(w, {result: {signature: base58.encode(sig)}});
+    await flush();
+    expect(w.posted[2]?.m).toMatchObject({type: 'page.signAndSendTransaction', payload: {transaction: base64.encode(Uint8Array.of(2))}});
+    answerLast(w, {result: {signature: base58.encode(sig)}});
+    expect(await s).toEqual([{signature: sig}, {signature: sig}]);
+    const bad = wallet.features['solana:signAndSendTransaction'].signAndSendTransaction({account: account!, transaction: Uint8Array.of(3)});
+    answerLast(w, {result: {signature: A}});
+    await expect(bad).rejects.toMatchObject({code: 'invalid-request'});
+  });
+
   it('a change event from the background updates the accounts; the same accounts again announce nothing; off() stops the listener', async () => {
     const w = fakeWindow();
     const wallet = new NocturaWallet(createBridge(w.win));
@@ -154,6 +228,12 @@ describe('the Noctura wallet (Wallet Standard)', () => {
     expect(wallet.accounts).toEqual([]);
   });
 
+  it('signatureBytes: 64 bytes for a signature, null for an address or anything else', () => {
+    const sig = new Uint8Array(64).fill(200);
+    expect(signatureBytes(base58.encode(sig))).toEqual(sig);
+    for (const bad of ['', A, `${base58.encode(sig)}1`, 'not a signature']) expect(signatureBytes(bad)).toBeNull();
+  });
+
   it('addressBytes: 32 bytes for an address, null for anything else', () => {
     expect(Array.from(addressBytes(A) ?? [])).toEqual(Array.from(base58.decode(A)));
     expect(addressBytes('11111111111111111111111111111111')).toEqual(new Uint8Array(32));
````

Change `extension/src/relay/__tests__/relay.test.ts`:

````diff
diff --git a/extension/src/relay/__tests__/relay.test.ts b/extension/src/relay/__tests__/relay.test.ts
index 58a5c16..13f2e49 100644
--- a/extension/src/relay/__tests__/relay.test.ts
+++ b/extension/src/relay/__tests__/relay.test.ts
@@ -194,7 +194,7 @@ describe('the relay', () => {
     expect(relayProtocol.METHOD_TYPES).toEqual(providerProtocol.METHOD_TYPES);
     expect([relayProtocol.FROM_PROVIDER, relayProtocol.FROM_RELAY]).toEqual([providerProtocol.FROM_PROVIDER, providerProtocol.FROM_RELAY]);
     expect(relayProtocol.PAGE_PORT).toBe(PAGE_PORT);
-    // Plan 1's background serves the three method types it implements plus the relay's own three; B1c-2 adds the rest.
-    expect([...PAGE_TYPES].sort()).toEqual(['page.ack', 'page.connect', 'page.disconnect', 'page.ping', 'page.resume', 'page.signMessage']);
+    // B1c-2: the background serves all five method types the relay forwards, plus the relay's own three.
+    expect([...PAGE_TYPES].sort()).toEqual([...relayProtocol.METHOD_TYPES, 'page.ack', 'page.ping', 'page.resume'].sort());
   });
 });
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/background/dapp/__tests__/store.test.ts src/background/dapp/__tests__/txPage.test.ts src/provider/__tests__/provider.test.ts src/relay/__tests__/relay.test.ts`

Expected (the dry run): Test Files  4 failed (4) · Tests  20 failed | 31 passed (51)

- [ ] **Step 3: Implement.**

Change `extension/src/background/dapp/decide.ts`:

````diff
diff --git a/extension/src/background/dapp/decide.ts b/extension/src/background/dapp/decide.ts
index a24b2ec..db536b0 100644
--- a/extension/src/background/dapp/decide.ts
+++ b/extension/src/background/dapp/decide.ts
@@ -250,6 +250,8 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
     if (e?.state === 'answered' && e.answer !== null && 'error' in e.answer && e.answer.error === 'timeout') return 'expired';
     // head: only the queue head, and only while `queued` (a `deciding` one is never decided twice).
     if (e === undefined || headOf(tx) !== e || e.state !== 'queued') return 'not-head';
+    // B1c-2: a mismatch notice is only ever dismissed (#48 "origin-mismatch · auto-reject" has no approval path).
+    if (e.type === 'mismatch' && d.decision !== 'reject') return 'malformed';
     if (d.decision === 'reject') {
       userRejected(tx, fx, e);
       return 'done';
@@ -262,6 +264,8 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
       blockHost(tx, fx, e.host);
       return 'done';
     }
+    // Task 4 gives a transaction request its approval path.
+    if (e.type !== 'connect' && e.type !== 'signMessage') return 'malformed';
     const refused = approvalRefused(tx, e, d);
     if (refused !== null) return refused;
     e.state = 'deciding';
````

Change `extension/src/background/dapp/pageApi.ts`:

````diff
diff --git a/extension/src/background/dapp/pageApi.ts b/extension/src/background/dapp/pageApi.ts
index f33a2c3..c1c8e08 100644
--- a/extension/src/background/dapp/pageApi.ts
+++ b/extension/src/background/dapp/pageApi.ts
@@ -6,6 +6,7 @@ import {PAGE_PORT, owns, pageOrigin, runtimeFor, type LivePort, type PortLike} f
 import {MAX_OPEN, documentChanged, isOpenEntry, newRequestId, queueAccess, rejectQueued} from './queue';
 import {dropGrant, grantIn, putGrant, type Entry, type ErrorCode, type Tx} from './store';
 import {checkMessage, checkSiws, signRequestOf} from './signMessage';
+import {othersSigned, sameMessage, slotOf, txRequestOf, usesDurableNonce} from './txRequest';
 import {ensureWindow} from './window';
 
 /**
@@ -14,7 +15,7 @@ import {ensureWindow} from './window';
  * from that report — never from anything the page sends. The relay forwards exactly the method types and originates
  * resume / ack / ping itself (§1.2); a privileged type on a port is refused like any unknown one.
  */
-export const PAGE_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.resume', 'page.ack', 'page.ping'] as const;
+export const PAGE_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction', 'page.resume', 'page.ack', 'page.ping'] as const;
 export type PageType = (typeof PAGE_TYPES)[number];
 
 /** The relay's own request id (it adds nothing else, §1.2). */
@@ -61,7 +62,8 @@ function admit(tx: Tx, live: LivePort): ErrorCode | null {
   return null;
 }
 
-function enqueue(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort, id: string, fields: Pick<Entry, 'type' | 'account' | 'message'>): Entry {
+type EntryFields = Pick<Entry, 'type' | 'account' | 'message'> & Partial<Pick<Entry, 'transactions' | 'granted'>>;
+function enqueue(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort, id: string, fields: EntryFields): Entry {
   const e: Entry = {
     requestId: newRequestId(deps),
     pageId: id,
@@ -69,6 +71,8 @@ function enqueue(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort,
     host: live.host,
     tabId: live.tabId,
     documentId: live.documentId,
+    transactions: null,
+    granted: null,
     ...fields,
     arrivedAt: tx.now,
     state: 'queued',
@@ -160,6 +164,66 @@ async function signMessage(ext: Ext, deps: WalletDeps, live: LivePort, id: strin
   });
 }
 
+const hostOf = (origin: string): string => {
+  try {
+    return new URL(origin).hostname;
+  } catch {
+    return '';
+  }
+};
+
+/**
+ * B1c-2, #48 "origin-mismatch · auto-reject" (B1 §3: "request origin differs from the granted origin → blocked, no
+ * override"): a sign request naming an account of this unlocked wallet that ANOTHER origin holds a grant for. The page
+ * is answered `unauthorized` at once, exactly as any ungranted request (§2.2 — it learns nothing more), and the window
+ * shows the user what was refused: a notice entry, with no approval path. Only when this host is not blocked or cooling
+ * down and C3's caps admit it (one per host and tab, five open), so a site cannot stack notices; its dismissal counts
+ * toward C14 like any rejection. The notice's relay id is '' — never a page's (PAGE_ID needs a character), so a re-sent
+ * request can never be answered from it. Returns true when a notice was queued.
+ */
+function mismatchNotice(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort, account: string): boolean {
+  if (tx.session === null || !tx.session.some(a => a.publicKey === account)) return false;
+  if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now) || admit(tx, live) !== null) return false;
+  const other = [...tx.s.grants, ...tx.grants].find(g => g.account === account && g.origin !== live.origin && !isBlocked(tx.blocked, hostOf(g.origin)));
+  if (other === undefined) return false;
+  enqueue(tx, deps, live, '', {type: 'mismatch', account, message: null, granted: other.origin});
+  return true;
+}
+
+type TxReply = {reply: Reply; notice: boolean};
+
+/**
+ * page.signTransaction / page.signAndSendTransaction (spec §1.4, §3.3; D8, C3, C14, C17), in this order, each refusal
+ * before any window: the payload's shape (txRequest.ts: 1–5 transactions, each ≤ 1 232 bytes, canonical, the chain) →
+ * `invalid-request`; the grant (`unauthorized` unless this origin holds one for exactly this account, while unlocked —
+ * and the mismatch notice above); the account must sign every transaction (fee payer or a required signer) →
+ * `invalid-request`; signAndSend only: every other signature present and valid, no durable nonce → `invalid-request`,
+ * and the same message already open → `rejected` (§3.3: a second identical request while the first is unanswered);
+ * a blocked or cooling-down host → `rejected`; C3's caps; then queued.
+ */
+async function signTx(ext: Ext, deps: WalletDeps, live: LivePort, id: string, m: Record<string, unknown>, kind: 'signTransaction' | 'signAndSendTransaction'): Promise<TxReply> {
+  const req = txRequestOf(m, kind);
+  return queueAccess(ext, deps, (tx, fx): TxReply => {
+    documentChanged(tx, fx, live);
+    const again = resent(tx, live, id);
+    if (again !== null) return {reply: resentReply(again, id), notice: false};
+    if (req === null) return {reply: {id, error: 'invalid-request'}, notice: false};
+    if (grantedAccount(tx, live.origin) !== req.account) return {reply: {id, error: 'unauthorized'}, notice: mismatchNotice(tx, deps, live, req.account)};
+    if (req.txs.some(t => slotOf(t, req.account) < 0)) return {reply: {id, error: 'invalid-request'}, notice: false};
+    if (kind === 'signAndSendTransaction') {
+      const t = req.txs[0];
+      if (t === undefined || !othersSigned(t, req.account) || usesDurableNonce(t)) return {reply: {id, error: 'invalid-request'}, notice: false};
+      if (tx.s.queue.some(e => isOpenEntry(e) && e.type === 'signAndSendTransaction' && e.transactions !== null && sameMessage(e.transactions, req.wires))) return {reply: {id, error: 'rejected'}, notice: false};
+    }
+    if (isBlocked(tx.blocked, live.host) || inCooldown(tx.limits, live.host, live.tabId, tx.now)) return {reply: {id, error: 'rejected'}, notice: false};
+    const refused = admit(tx, live);
+    if (refused !== null) return {reply: {id, error: refused}, notice: false};
+    touch(tx, live.origin);
+    const e = enqueue(tx, deps, live, id, {type: kind, account: req.account, message: null, transactions: req.wires});
+    return {reply: {id, accepted: true, requestId: e.requestId}, notice: false};
+  });
+}
+
 /** C2: a dApp's disconnect removes its grant, whichever the scope; its queued requests are answered `rejected`. */
 async function disconnect(ext: Ext, deps: WalletDeps, live: LivePort, id: string): Promise<Reply> {
   return queueAccess(ext, deps, (tx, fx): Reply => {
@@ -223,6 +287,14 @@ export async function onPageMessage(ext: Ext, deps: WalletDeps, live: LivePort,
       if ('accepted' in r) await ensureWindow(ext, deps);
       return;
     }
+    case 'page.signTransaction':
+    case 'page.signAndSendTransaction': {
+      if (id === null) return invalid();
+      const {reply: r, notice} = await signTx(ext, deps, live, id, m, m.type === 'page.signTransaction' ? 'signTransaction' : 'signAndSendTransaction');
+      reply(live, r);
+      if ('accepted' in r || notice) await ensureWindow(ext, deps);
+      return;
+    }
     case 'page.disconnect':
       if (id === null) return invalid();
       reply(live, await disconnect(ext, deps, live, id));
````

Change `extension/src/background/dapp/queue.ts`:

````diff
diff --git a/extension/src/background/dapp/queue.ts b/extension/src/background/dapp/queue.ts
index db81d22..1515537 100644
--- a/extension/src/background/dapp/queue.ts
+++ b/extension/src/background/dapp/queue.ts
@@ -60,7 +60,8 @@ export function userRejected(tx: Tx, fx: Effects, e: Entry): void {
   answer(fx, e, {error: 'rejected'}, tx.now);
   tx.limits = withRejection(tx.limits, e.host, e.tabId, tx.now);
   const g = grantIn(tx, e.origin);
-  if (g !== null) putGrant(tx, withRecent(g, e.type, tx.now, 'rejected'));
+  // A mismatch notice was never this origin's request with its grant (B1c-2): nothing to record on it.
+  if (g !== null && e.type !== 'mismatch') putGrant(tx, withRecent(g, e.type, tx.now, 'rejected'));
 }
 
 /** Answers an origin's `queued` entries (never a `deciding` one: its effect is running) with this error. */
````

Change `extension/src/background/dapp/store.ts`:

````diff
diff --git a/extension/src/background/dapp/store.ts b/extension/src/background/dapp/store.ts
index 4977000..1184c57 100644
--- a/extension/src/background/dapp/store.ts
+++ b/extension/src/background/dapp/store.ts
@@ -19,10 +19,17 @@ import {LIMITS_KEY, limitsOf, type Limits} from './limits';
  */
 export const DAPP_SESSION_KEY = 'v1_dapp_session';
 
-export type ErrorCode = 'rejected' | 'unauthorized' | 'request-pending' | 'busy' | 'timeout' | 'invalid-request';
-export const ERROR_CODES: readonly ErrorCode[] = ['rejected', 'unauthorized', 'request-pending', 'busy', 'timeout', 'invalid-request'];
+/** Spec §1.6. `send-failed` (B1c-2, rev 3.3): an approved `signAndSendTransaction` whose bytes never reached the network. */
+export type ErrorCode = 'rejected' | 'unauthorized' | 'request-pending' | 'busy' | 'timeout' | 'invalid-request' | 'send-failed';
+export const ERROR_CODES: readonly ErrorCode[] = ['rejected', 'unauthorized', 'request-pending', 'busy', 'timeout', 'invalid-request', 'send-failed'];
 export type Answer = {result: Record<string, unknown>} | {error: ErrorCode};
-export type EntryType = 'connect' | 'signMessage';
+/**
+ * B1c-2: the two transaction requests, and `mismatch` — the window's notice that a site asked to sign with an account
+ * granted to another origin (#48 "origin-mismatch · auto-reject"): the page was answered `unauthorized` at once; the
+ * entry only shows the user what was refused, and never has a decidable approval.
+ */
+export type EntryType = 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction' | 'mismatch';
+export const ENTRY_TYPES: readonly EntryType[] = ['connect', 'signMessage', 'signTransaction', 'signAndSendTransaction', 'mismatch'];
 export type Decision = 'approve' | 'reject' | 'report' | 'block';
 
 /** One request that needs the user (§1.5 step 1). */
@@ -40,6 +47,10 @@ export interface Entry {
   /** signMessage: the account it names and the message, base64. */
   account: string | null;
   message: string | null;
+  /** signTransaction / signAndSendTransaction (B1c-2): the transactions exactly as the page sent them, base64; else null. */
+  transactions: string[] | null;
+  /** mismatch (B1c-2): the origin the named account is granted to; else null. */
+  granted: string | null;
   arrivedAt: number;
   state: 'queued' | 'deciding' | 'answered';
   /** The worker instance that wrote `deciding` (C17): another instance's `deciding` entry is a restart. */
@@ -108,7 +119,11 @@ export function entryOf(x: unknown): Entry | null {
   if (typeof x !== 'object' || x === null) return null;
   const o = x as Record<string, unknown>;
   if (!isStr(o.requestId) || !isStr(o.pageId) || !isStr(o.origin) || !isStr(o.host) || !isTime(o.tabId) || !isNullStr(o.documentId)) return null;
-  if ((o.type !== 'connect' && o.type !== 'signMessage') || !isNullStr(o.account) || !isNullStr(o.message) || !isTime(o.arrivedAt)) return null;
+  if (typeof o.type !== 'string' || !(ENTRY_TYPES as readonly string[]).includes(o.type) || !isNullStr(o.account) || !isNullStr(o.message) || !isTime(o.arrivedAt)) return null;
+  // B1c-2's fields: absent on an entry an older background wrote (read as null), else exactly their shape.
+  const transactions = o.transactions === undefined || o.transactions === null ? null : Array.isArray(o.transactions) && o.transactions.every(isStr) ? (o.transactions as string[]).slice() : undefined;
+  const granted = o.granted === undefined ? null : isNullStr(o.granted) ? o.granted : undefined;
+  if (transactions === undefined || granted === undefined) return null;
   if (!isStr(o.state) || !STATES.includes(o.state) || !isNullStr(o.decidedBy) || (o.answeredAt !== null && !isTime(o.answeredAt))) return null;
   if (o.decidingAt !== null && !isTime(o.decidingAt)) return null;
   const decision = decisionOf(o.decision);
@@ -121,9 +136,11 @@ export function entryOf(x: unknown): Entry | null {
     host: o.host,
     tabId: o.tabId,
     documentId: o.documentId,
-    type: o.type,
+    type: o.type as EntryType,
     account: o.account,
     message: o.message,
+    transactions,
+    granted,
     arrivedAt: o.arrivedAt,
     state: o.state as Entry['state'],
     decidedBy: o.decidedBy,
````

Create `extension/src/background/dapp/txRequest.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {SYSTEM_PROGRAM} from './decode/decode';
import {MAX_TX_BYTES, parseWire, type ParsedTx} from './decode/wire';

/**
 * The two transaction requests' payloads (spec B1c §1.4, §3.3; D8): `page.signTransaction {account, transactions:
 * base64[]}` — 1 to MAX_BATCH transactions — and `page.signAndSendTransaction {account, transaction: base64, options?}`;
 * `chain`, when sent, must be `solana:mainnet`. Each transaction at most 1 232 bytes, one canonical legacy or v0
 * transaction (decode/wire.ts). The account must be the fee payer or a required signer of every one (checked after
 * the grant, in pageApi.ts: a page without a grant learns nothing about its payload but its shape).
 */
export const MAX_BATCH = 5;
export const CHAIN = 'solana:mainnet';
/** The largest base64 a 1 232-byte transaction can be. */
const MAX_TX_BASE64 = Math.ceil(MAX_TX_BYTES / 3) * 4;
const ACCOUNT = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export interface TxRequest {
  account: string;
  /** The bytes as the page sent them, base64 (what is stored, simulated and signed). */
  wires: string[];
  txs: ParsedTx[];
}

const isAccount = (x: unknown): x is string => {
  if (typeof x !== 'string' || !ACCOUNT.test(x)) return false;
  try {
    return base58.decode(x).length === 32;
  } catch {
    return false;
  }
};

function one(x: unknown): {wire: string; tx: ParsedTx} | null {
  if (typeof x !== 'string' || x.length === 0 || x.length > MAX_TX_BASE64) return null;
  let bytes: Uint8Array;
  try {
    bytes = base64.decode(x);
  } catch {
    return null;
  }
  const tx = parseWire(bytes);
  return tx === null ? null : {wire: base64.encode(bytes), tx};
}

/** The payload's shape — or null: `invalid-request` before anything else is read (spec §9's row for transactions, rev 3.3). */
export function txRequestOf(m: Record<string, unknown>, kind: 'signTransaction' | 'signAndSendTransaction'): TxRequest | null {
  if (!isAccount(m.account) || (m.chain !== undefined && m.chain !== CHAIN)) return null;
  let list: unknown[];
  if (kind === 'signTransaction') {
    if (!Array.isArray(m.transactions) || m.transactions.length < 1 || m.transactions.length > MAX_BATCH) return null;
    list = m.transactions as unknown[];
  } else {
    if (m.options !== undefined && (typeof m.options !== 'object' || m.options === null || Array.isArray(m.options))) return null;
    list = [m.transaction];
  }
  const parsed = list.map(one);
  if (parsed.some(p => p === null)) return null;
  const ok = parsed as {wire: string; tx: ParsedTx}[];
  return {account: m.account, wires: ok.map(p => p.wire), txs: ok.map(p => p.tx)};
}

/** The account's signature slot in a transaction (its index among the required signers), or -1. */
export const slotOf = (tx: ParsedTx, account: string): number => tx.signers.indexOf(account);

/**
 * signAndSend only: every OTHER required signature is present and valid over the message — the broadcast route takes
 * only a fully signed transaction (B1 §4), and the wallet sends nothing it would have to send incomplete.
 */
export function othersSigned(tx: ParsedTx, account: string): boolean {
  return tx.signers.every((signer, i) => {
    if (signer === account) return true;
    const sig = tx.signatures[i];
    if (sig === undefined || sig.every(b => b === 0)) return false;
    try {
      return ed25519.verify(sig, tx.message, base58.decode(signer));
    } catch {
      return false;
    }
  });
}

/**
 * A durable-nonce transaction (its first instruction is System AdvanceNonceAccount): it never expires (B1 §3's red-flag
 * row). The send path cannot watch it — B1b's pending record calls a send "not confirmed — no funds moved" once its
 * blockhash's life is over, which would be false for one that can still land — so signAndSend refuses it (a controller
 * ruling); signTransaction (the dApp sends) signs it.
 */
export function usesDurableNonce(tx: ParsedTx): boolean {
  const first = tx.instructions[0];
  if (first === undefined || tx.staticKeys[first.program] !== SYSTEM_PROGRAM || first.data.length < 4) return false;
  return new DataView(first.data.buffer, first.data.byteOffset, 4).getUint32(0, true) === 4;
}

const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((x, i) => x === b[i]);

/** §3.3: "a second identical request while the first is unanswered" — the same message bytes. */
export function sameMessage(a: readonly string[], b: readonly string[]): boolean {
  const messages = (wires: readonly string[]) => wires.map(w => parseWire(base64.decode(w))?.message).filter((m): m is Uint8Array => m !== undefined);
  const ma = messages(a);
  return messages(b).some(x => ma.some(y => sameBytes(x, y)));
}
````

Change `extension/src/provider/bridge.ts`:

````diff
diff --git a/extension/src/provider/bridge.ts b/extension/src/provider/bridge.ts
index def3cf2..1efda0b 100644
--- a/extension/src/provider/bridge.ts
+++ b/extension/src/provider/bridge.ts
@@ -13,6 +13,8 @@ export const ERROR_TEXT: Record<ErrorCode, {code: number | ErrorCode; message: s
   busy: {code: 'busy', message: 'The wallet is busy with other requests. Try again later.'},
   timeout: {code: 'timeout', message: 'The request timed out.'},
   'invalid-request': {code: 'invalid-request', message: 'The request is not valid.'},
+  /** B1c-2 (spec §1.6, rev 3.3; owner, 2026-10-15): the wallet's route refused the broadcast, or would not try — nothing was sent. */
+  'send-failed': {code: 'send-failed', message: 'The transaction could not be sent.'},
 };
 
 /** What a page sees for a refusal: a fixed English message and a stable code, never internal text (C10). */
````

Change `extension/src/provider/codec.ts`:

````diff
diff --git a/extension/src/provider/codec.ts b/extension/src/provider/codec.ts
index da73b21..618ad21 100644
--- a/extension/src/provider/codec.ts
+++ b/extension/src/provider/codec.ts
@@ -17,6 +17,17 @@ const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
 /** A Solana address's 32 bytes, or null for anything that is not one. */
 export function addressBytes(address: string): Uint8Array | null {
   if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return null;
+  return base58Bytes(address, 32);
+}
+
+/** B1c-2: a transaction signature's 64 bytes (base58, 64–88 characters), or null for anything that is not one. */
+export function signatureBytes(signature: string): Uint8Array | null {
+  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) return null;
+  return base58Bytes(signature, 64);
+}
+
+/** base58 → exactly `length` bytes (leading '1's are zero bytes), or null. The caller checked the alphabet. */
+function base58Bytes(address: string, length: number): Uint8Array | null {
   let n = 0n;
   for (const c of address) n = n * 58n + BigInt(ALPHABET.indexOf(c));
   const bytes: number[] = [];
@@ -28,5 +39,5 @@ export function addressBytes(address: string): Uint8Array | null {
     if (c !== '1') break;
     bytes.unshift(0);
   }
-  return bytes.length === 32 ? Uint8Array.from(bytes) : null;
+  return bytes.length === length ? Uint8Array.from(bytes) : null;
 }
````

Change `extension/src/provider/protocol.ts`:

````diff
diff --git a/extension/src/provider/protocol.ts b/extension/src/provider/protocol.ts
index 9c72651..39fd154 100644
--- a/extension/src/provider/protocol.ts
+++ b/extension/src/provider/protocol.ts
@@ -9,5 +9,6 @@ export const FROM_RELAY = 'noctura-relay';
 export const METHOD_TYPES = ['page.connect', 'page.disconnect', 'page.signMessage', 'page.signTransaction', 'page.signAndSendTransaction'] as const;
 export type MethodType = (typeof METHOD_TYPES)[number];
 /** The stable codes a page can get (§1.6, C10). */
-export const ERROR_CODES = ['rejected', 'unauthorized', 'request-pending', 'busy', 'timeout', 'invalid-request'] as const;
+/** Spec §1.6; `send-failed` is B1c-2's (rev 3.3: a broadcast the user approved that never reached the network). */
+export const ERROR_CODES = ['rejected', 'unauthorized', 'request-pending', 'busy', 'timeout', 'invalid-request', 'send-failed'] as const;
 export type ErrorCode = (typeof ERROR_CODES)[number];
````

Change `extension/src/provider/wallet.ts`:

````diff
diff --git a/extension/src/provider/wallet.ts b/extension/src/provider/wallet.ts
index 0b11592..5eb3f15 100644
--- a/extension/src/provider/wallet.ts
+++ b/extension/src/provider/wallet.ts
@@ -1,17 +1,21 @@
 import {ReadonlyWalletAccount} from '@wallet-standard/wallet';
 import type {IdentifierString, Wallet, WalletAccount} from '@wallet-standard/base';
 import {NocturaError, type Bridge} from './bridge';
-import {addressBytes, fromBase64, toBase64} from './codec';
+import {addressBytes, fromBase64, signatureBytes, toBase64} from './codec';
 import {ICON} from './icon';
 
 /**
- * The one Wallet Standard wallet "Noctura" (spec §1.1, §3; D6). Plan 1 advertises only what it implements —
- * `standard:connect`, `standard:disconnect`, `standard:events` and `solana:signMessage` (header, D10); B1c-2 adds the
- * two transaction features. `solana:mainnet` only. The accounts are the ones the background last sent (Wallet Standard
- * needs them synchronously); the background decides everything.
+ * The one Wallet Standard wallet "Noctura" (spec §1.1, §3; D6). It advertises only what it implements —
+ * `standard:connect`, `standard:disconnect`, `standard:events`, `solana:signMessage` (plan 1) and, from B1c-2,
+ * `solana:signTransaction` and `solana:signAndSendTransaction` (legacy and v0) — so wallet-adapter dApps find it
+ * (`isWalletAdapterCompatibleStandardWallet` needs a transaction feature; header, D10). `solana:mainnet` only. The
+ * accounts are the ones the background last sent (Wallet Standard needs them synchronously); the background decides
+ * everything — the provider only refuses what it can see is not this wallet's to answer (another account, another
+ * chain) before asking.
  */
 export const CHAINS = ['solana:mainnet'] as const;
-const ACCOUNT_FEATURES = ['solana:signMessage'] as const;
+const ACCOUNT_FEATURES = ['solana:signMessage', 'solana:signTransaction', 'solana:signAndSendTransaction'] as const;
+const TX_VERSIONS = ['legacy', 0] as const;
 
 type ChangeListener = (properties: {accounts?: readonly WalletAccount[]}) => void;
 interface SignMessageInput {
@@ -23,6 +27,12 @@ interface SignMessageOutput {
   signature: Uint8Array;
   signatureType: 'ed25519';
 }
+/** @solana/wallet-standard-features' SolanaSignTransactionInput / SolanaSignAndSendTransactionInput, as far as this wallet reads them. */
+interface TransactionInput {
+  account: WalletAccount;
+  transaction: Uint8Array;
+  chain?: IdentifierString;
+}
 
 export class NocturaWallet implements Wallet {
   readonly version = '1.0.0' as const;
@@ -48,6 +58,8 @@ export class NocturaWallet implements Wallet {
       'standard:disconnect': {version: '1.0.0' as const, disconnect: this.#disconnect},
       'standard:events': {version: '1.0.0' as const, on: this.#on},
       'solana:signMessage': {version: '1.1.0' as const, signMessage: this.#signMessage},
+      'solana:signTransaction': {version: '1.0.0' as const, supportedTransactionVersions: TX_VERSIONS, signTransaction: this.#signTransaction},
+      'solana:signAndSendTransaction': {version: '1.0.0' as const, supportedTransactionVersions: TX_VERSIONS, signAndSendTransaction: this.#signAndSendTransaction},
     };
   }
 
@@ -83,6 +95,39 @@ export class NocturaWallet implements Wallet {
     };
   };
 
+  /** Only this wallet's account (the one connected), only solana:mainnet — refused here before anything is posted. */
+  #checked(inputs: readonly TransactionInput[]): string {
+    // Plan 2 review 1 L8: an input without an account (a hostile or broken caller) is invalid-request, never a TypeError.
+    const first = inputs[0]?.account?.address;
+    if (typeof first !== 'string' || !inputs.every(i => i?.account?.address === first)) throw new NocturaError('invalid-request');
+    if (!this.#accounts.some(a => a.address === first)) throw new NocturaError('unauthorized');
+    if (inputs.some(i => i.chain !== undefined && i.chain !== CHAINS[0])) throw new NocturaError('invalid-request');
+    return first;
+  }
+
+  /** One request for every input (a batch, §3.3: shown and approved as a whole; more than five refused by the background, D8). */
+  #signTransaction = async (...inputs: TransactionInput[]): Promise<{signedTransaction: Uint8Array}[]> => {
+    if (inputs.length === 0) return [];
+    const account = this.#checked(inputs);
+    const r = await this.#bridge.request('page.signTransaction', {account, transactions: inputs.map(i => toBase64(i.transaction)), chain: CHAINS[0]});
+    const signed = r.signed;
+    if (!Array.isArray(signed) || signed.length !== inputs.length || !signed.every(s => typeof s === 'string')) throw new NocturaError('invalid-request');
+    return (signed as string[]).map(s => ({signedTransaction: fromBase64(s)}));
+  };
+
+  /** One request per input, one after another (each is its own approval). */
+  #signAndSendTransaction = async (...inputs: TransactionInput[]): Promise<{signature: Uint8Array}[]> => {
+    const out: {signature: Uint8Array}[] = [];
+    for (const input of inputs) {
+      const account = this.#checked([input]);
+      const r = await this.#bridge.request('page.signAndSendTransaction', {account, transaction: toBase64(input.transaction), chain: CHAINS[0]});
+      const signature = typeof r.signature === 'string' ? signatureBytes(r.signature) : null;
+      if (signature === null) throw new NocturaError('invalid-request');
+      out.push({signature});
+    }
+    return out;
+  };
+
   #signMessage = async (...inputs: SignMessageInput[]): Promise<SignMessageOutput[]> => {
     const out: SignMessageOutput[] = [];
     for (const input of inputs) {
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run src/background/dapp/__tests__/store.test.ts src/background/dapp/__tests__/txPage.test.ts src/provider/__tests__/provider.test.ts src/relay/__tests__/relay.test.ts` — expected: Test Files  4 passed (4) · Tests  51 passed (51)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  161 passed (161) · Tests  3168 passed (3168). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M3a | `txRequest.ts`: `MAX_BATCH = 6` | txPage.test.ts "invalid-request before the grant is read" (six) — RED Tests  1 failed \| 9 passed (10) |
| M3b | `pageApi.ts`: the account-signs-every-transaction check off | txPage.test.ts "the account must sign every transaction" — RED Tests  1 failed \| 9 passed (10) |
| M3c | `txRequest.ts`: a co-signature never verified | txPage.test.ts "signAndSend: every other signature present and valid" (corrupt) — RED Tests  1 failed \| 9 passed (10) |
| M3d | `txRequest.ts`: no durable nonce detected | txPage.test.ts "… no durable nonce" — RED Tests  1 failed \| 9 passed (10) |
| M3e | `pageApi.ts`: the identical-message rule off | txPage.test.ts "the same message while the first is unanswered is rejected" — RED Tests  1 failed \| 9 passed (10) |
| M3f | `pageApi.ts`: a blocked host still gets a mismatch notice | txPage.test.ts "negative controls — no notice" (blocked) — RED Tests  1 failed \| 9 passed (10) |
| M3g | `decide.ts`: a notice approvable | txPage.test.ts "a notice is only ever dismissed" — RED Tests  1 failed \| 9 passed (10) |
| M3h | `wallet.ts`: another chain not refused by the provider | provider.test.ts "signTransaction: refused before posting" — RED Tests  1 failed \| 14 passed (15) |
| M3i | `wallet.ts`: two accounts in one batch not refused | provider.test.ts "signTransaction: refused before posting" — RED Tests  1 failed \| 14 passed (15) |
| M3j | `wallet.ts`: an input's missing `account` dereferenced | provider.test.ts "signTransaction: refused before posting — … an input with no account" — RED Tests  1 failed \| 14 passed (15) |
| M3k | `bridge.ts`: `send-failed` read as an unknown code | provider.test.ts "send-failed: its own code and fixed message" — RED Tests  1 failed \| 14 passed (15) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-2 the page side — signTransaction and signAndSendTransaction refused by reason, the origin-mismatch notice, the provider's transaction features" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 4: Pending and decide for a transaction request: the simulation run when the window asks and refreshed, #48's view, the simulation shown is the one approved, B1b's re-authentication gate, the `signTransaction` effect

**Spec:** §1.5 step 2 (C17), §2.3 (`dapp.decide`'s table, extended), §3.3 (simulating holds Approve; the 30 s refresh; Q21; re-authentication), §4.3, C13, C15; Scope R7–R11; Review Focus 1, 2, 4

**Files:**
- Test: `extension/src/background/dapp/__tests__/decide.test.ts`
- Test (new): `extension/src/background/dapp/__tests__/signTx.test.ts`
- Test: `extension/src/background/dapp/__tests__/store.test.ts`
- Test (new): `extension/src/background/dapp/__tests__/txHarness.ts`
- Modify: `extension/src/background/dapp/decide.ts`
- Modify: `extension/src/background/dapp/pageApi.ts`
- Modify: `extension/src/background/dapp/ports.ts`
- Create: `extension/src/background/dapp/signTx.ts`
- Modify: `extension/src/background/dapp/simulate.ts`
- Modify: `extension/src/background/dapp/store.ts`
- Modify: `extension/src/background/reauthChallenges.ts`

**Interfaces:**
- Consumes: Task 2's `simulateTransactions`, `TxSimulation`, `TxOutcome`; Task 3's entry fields and `slotOf`; B1b's `issueChallenge`, `challengeInfo`, `challengeSatisfied`, `consumeChallenge`, `recipientFacts`, `readSettings`, `readContacts`, `digestOf`.
- Produces:
  - `simulate.ts`: `type SimState = {status: 'ok'; sim: TxSimulation} | {status: 'unreachable'; at: number}`; `simStateOf(x: unknown): SimState | null` (fresh objects).
  - `store.ts`: `Entry` gains `sim: SimState | null`, `challengeId: string | null`. `ports.ts`: `Runtime.simulating: Set<string>`.
  - `reauthChallenges.ts`: `ChallengeAbout` gains `{kind: 'dapp'; account; site; transactions; outgoing: DappOutgoing[]; omitted: number; reasons: DappReauthReason[]; thresholdCents}`, `interface DappOutgoing {mint: string | null; amount: string; decimals: number | null}` (Task 6 adds `symbol`), `MAX_DAPP_OUTGOING = 16` (the rest counted in `omitted` — R28).
  - `dapp/signTx.ts`: `SIM_REFRESH_MS = 30_000`, `SIM_VALID_MS = 40_000`, `SIM_RETRY_MS = 5_000`; `isTxType`; `txsOf(e)`; `needsSimulation(e, now)`; `runSimulation(ext, deps, requestId)`; `interface AddressLabel {address; kind: 'account' | 'contact'; name}`; `interface TxItemView {version; feePayer; instructions: DecodedInstruction[] | null; outcome: TxOutcome | null}`; `type SimulationView`; `interface TxDetail {transactions; simulation; reauth: {reasons; state: 'needed' | 'waiting' | 'proven'} | null; labels}`; `txDetail(...)`; `dappDigest(e)`; `type TxRefusal = 'not-simulated' | 'stale' | 'simulation-failed' | 'blockhash-expired'`; `txRefused(e, simulation, now)`; `dappAbout(e, site, thresholdCents)` (SOL first, then the largest in USD, at most 16, `omitted` the rest); `reauthGate(ext, deps, e, site): Promise<'ready' | 'proven' | 'reauth-required' | 'stale'>` (checks the proof, never consumes it); `withSignature(wire, slot, signature)`; `signAll(wires, txs, account)`; `stillDeciding(tx, e, instance, account)`; `finishSignTx(ext, deps, requestId, instance)`.
  - `decide.ts`: `RequestView` gains `tx: (TxDetail & {account: AccountChoice; kind}) | null` and `mismatch: {granted: string} | null`; `pending(ext, deps: WalletDeps)`; `DecideRequest.simulation: string | null`; `DecideError` gains `TxRefusal | 'reauth-required'`; a `proven` challenge consumed right after the `deciding` section (`consumeChallenge`), the request answered `rejected` if that fails; the effects by type (`effects[out.approved]`).
  - `__tests__/txHarness.ts`: `txScene()`, `until()`, `chainReader`, `v0`, `transfer`, `coSigned`, `ME`, `TO`, `CO`, `SOL`, `DAPP`.

`dapp.pending` starts the head's simulation after its section — the first one, the refresh 30 s after the last, a retry 5 s after an unreachable proxy — at most one at a time per request (`Runtime.simulating`); the result is stored only if the entry is still `queued`. #48's view carries each transaction's decoded instructions (with the simulation's resolved keys, or the static keys when it uses no lookup table), its outcome, the simulation's id and slot, the re-authentication's state and the labels of every address shown. `dapp.decide` for a transaction runs §2.3's table, then the simulation rows (R7), then — outside every section — the re-authentication gate (R9, R11), then the `deciding` section with every check again, then — still before any key is read — the proof's consumption (R11, review 1 L1: a `stale` or `not-head` in the `deciding` section no longer spends the user's proof; a consume that fails ends the request `rejected`, nothing signed). #10's description lists at most 16 mints, SOL first then the largest in USD, and counts the rest (R28, review 1 L9 — rev 1 refused such a batch with an unexpected error). The `signTransaction` effect signs each transaction at the account's slot (every other signature kept) and answers `{signed}` only from a section where the entry is still this instance's `deciding` one, unlocked, its account in the session and its grant held; otherwise `rejected`. A connect or a `signMessage` decision takes exactly the section it took in B1c-1 (a routing peek reads without a section). Each effect is chosen by name: a type without one (a mismatch notice) never falls into another's.

- [ ] **Step 1: Write the failing tests.**

Change `extension/src/background/dapp/__tests__/decide.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/decide.test.ts b/extension/src/background/dapp/__tests__/decide.test.ts
index 7ea22df..31880fb 100644
--- a/extension/src/background/dapp/__tests__/decide.test.ts
+++ b/extension/src/background/dapp/__tests__/decide.test.ts
@@ -107,6 +107,9 @@ describe('dapp.pending (§2.3, §4.3)', () => {
           cap: false,
         },
         sign: null,
+        // B1c-2: a connect carries neither a transaction nor a mismatch.
+        tx: null,
+        mismatch: null,
       },
     });
     // The window now shows it: closing the window rejects this one.
````

Create `extension/src/background/dapp/__tests__/signTx.test.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {AUTOLOCK_ALARM, lock} from '../../autolock';
import {GRANTS_KEY, type Grant} from '../grants';
import {runtimeFor} from '../ports';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {SIM_REFRESH_MS, SIM_RETRY_MS, SIM_VALID_MS, dappAbout, withSignature} from '../signTx';
import {MAX_DAPP_OUTGOING} from '../../reauthChallenges';
import {REAUTH_KEY} from '../../session';
import {ACCOUNT, RECIPIENT} from '../../__tests__/fixtures';
import {CO, ME, SOL, coSigned, transfer, txScene, until, v0} from './txHarness';

const sigs = (b64: string) => VersionedTransaction.deserialize(base64.decode(b64)).signatures;
const verifies = (b64: string, slot: number, key: Uint8Array) => {
  const tx = VersionedTransaction.deserialize(base64.decode(b64));
  return ed25519.verify(tx.signatures[slot] ?? new Uint8Array(64), tx.message.serialize(), key);
};

// Spec B1c §3.3: #48's simulation — run when the window asks, refreshed after 30 s, held until it answers.
describe('a transaction request’s simulation (dapp.pending)', () => {
  it('the first read shows the decoded instructions while simulating; the next shows the balance changes, the fee — one simulation, however many reads', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const first = await c.pend();
    expect(first.state).toBe('request');
    expect(first.request?.tx?.simulation).toEqual({status: 'simulating'});
    expect((first.request?.tx?.transactions as {instructions: {name: string}[]}[])[0]?.instructions.map(i => i.name)).toEqual(['transfer']);
    await c.pend();
    await c.pend();
    const view = await c.simulated();
    expect(c.chain.calls.get('simulateTransaction')).toBe(1);
    expect(view.request?.tx).toMatchObject({
      account: {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
      kind: 'signTransaction',
      simulation: {status: 'ok', slot: 777},
      reauth: null,
      transactions: [{version: 0, feePayer: ACCOUNT.publicKey, outcome: {ok: true, changes: [{mint: null, amount: '-1005000', decimals: 9, usdMicros: '-150750'}], feeLamports: '5000'}}],
      labels: [{address: ACCOUNT.publicKey, kind: 'account', name: 'Main'}],
    });
    expect((await c.entry(String(r?.requestId)))?.sim).toMatchObject({status: 'ok'});
  });

  it('refreshed SIM_REFRESH_MS after the last one (a new id); an unreachable proxy is shown as such and tried again after SIM_RETRY_MS', async () => {
    const c = await txScene({known: [RECIPIENT]});
    await c.signTx('t', [v0()]);
    const one = (await c.simulated()).request?.tx?.simulation.id;
    c.deps.clock.t += SIM_REFRESH_MS - 1;
    await c.pend();
    await c.pend();
    expect(c.chain.calls.get('simulateTransaction')).toBe(1);
    c.deps.clock.t += 1;
    const two = (await c.simulated(one)).request?.tx?.simulation.id;
    expect(two).not.toBe(one);
    expect(c.chain.calls.get('simulateTransaction')).toBe(2);
    c.chain.down = true;
    c.deps.clock.t += SIM_REFRESH_MS;
    await c.pend();
    await until(async () => (await c.queue())[0]?.sim?.status === 'unreachable');
    expect((await c.pend()).request?.tx?.simulation).toEqual({status: 'unreachable'});
    c.chain.down = false;
    c.deps.clock.t += SIM_RETRY_MS;
    expect((await c.simulated()).request?.tx?.simulation).toMatchObject({status: 'ok'});
  });

  it('a simulation that answers after the request was decided is not stored (the decision wins)', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0()]);
    await c.pend();
    await c.decide({requestId: r?.requestId, decision: 'reject'});
    await until(async () => runtimeFor(c.ext).simulating.size === 0);
    expect((await c.entry(String(r?.requestId)))?.sim).toBeNull();
  });
});

// §2.3's table, extended by §3.3 (C13): the window names the simulation it showed.
describe('dapp.decide for a transaction request', () => {
  it('refused before a simulation answered, for another simulation than the newest, for one SIM_VALID_MS old; positive control: approved', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const requestId = String(r?.requestId);
    expect(await c.approve(requestId)).toEqual({ok: false, error: 'not-simulated'});
    const id = String((await c.simulated()).request?.tx?.simulation.id);
    expect(await c.approve(requestId)).toEqual({ok: false, error: 'stale'});
    expect(await c.approve(requestId, 'AAAAAAAAAAAAAAAAAAAAAA')).toEqual({ok: false, error: 'stale'});
    c.deps.clock.t += SIM_VALID_MS;
    expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'stale'});
    c.deps.clock.t -= SIM_VALID_MS;
    expect(await c.approve(requestId, id)).toEqual({ok: true});
    expect(c.page.answersFor(requestId)).toHaveLength(1);
  });

  it('a failed simulation has no approval; an expired blockhash (Q21) neither', async () => {
    const failed = await txScene({known: [RECIPIENT]});
    failed.chain.err = {InstructionError: [0, {Custom: 1}]};
    const r1 = await failed.signTx('t', [v0()]);
    const v1 = await failed.simulated();
    expect((v1.request?.tx?.transactions as {outcome: unknown}[])[0]?.outcome).toEqual({ok: false, error: 'failed', detail: '{"InstructionError":[0,{"Custom":1}]}'});
    expect(await failed.approve(String(r1?.requestId), v1.request?.tx?.simulation.id)).toEqual({ok: false, error: 'simulation-failed'});
    const expired = await txScene({known: [RECIPIENT]});
    expired.chain.err = 'BlockhashNotFound';
    const r2 = await expired.signTx('t', [v0()]);
    const v2 = await expired.simulated();
    expect(await expired.approve(String(r2?.requestId), v2.request?.tx?.simulation.id)).toEqual({ok: false, error: 'blockhash-expired'});
    // Reject is always open.
    expect(await expired.decide({requestId: r2?.requestId, decision: 'reject'})).toEqual({ok: true});
  });

  it('approve: every transaction of a batch signed at the account’s slot, the co-signer’s signature kept, exactly one answer; recorded on the grant', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const wires = [v0([transfer(1)]), coSigned(), v0([transfer(3)])];
    const r = await c.signTx('t', wires);
    const requestId = String(r?.requestId);
    const view = await c.simulated();
    expect(await c.approve(requestId, view.request?.tx?.simulation.id)).toEqual({ok: true});
    const answers = c.page.answersFor(requestId);
    expect(answers).toHaveLength(1);
    const signed = (answers[0]?.result as {signed: string[]}).signed;
    expect(signed).toHaveLength(3);
    expect(verifies(signed[0] ?? '', 0, ME.toBytes())).toBe(true);
    // The co-signed one: the account is signer 1; the dApp's signature at 0 is exactly as sent.
    expect(verifies(signed[1] ?? '', 1, ME.toBytes())).toBe(true);
    expect(sigs(signed[1] ?? '')[0]).toEqual(sigs(wires[1] ?? '')[0]);
    expect(verifies(signed[1] ?? '', 0, CO.toBytes())).toBe(true);
    // Nothing but the signature changed: the message bytes are the dApp's.
    expect(VersionedTransaction.deserialize(base64.decode(signed[2] ?? '')).message.serialize()).toEqual(VersionedTransaction.deserialize(base64.decode(wires[2] ?? '')).message.serialize());
    expect(((await c.ext.local.get(GRANTS_KEY)) as Grant[])[0]?.recent[0]).toEqual({type: 'signTransaction', at: c.deps.clock.t, outcome: 'approved'});
  });

  // Review Focus 5: a legacy (not v0) transaction — the format half of all dApps still send.
  it('a legacy transaction: decoded, simulated, signed at its slot, the bytes otherwise the dApp’s', async () => {
    const {Transaction} = await import('@solana/web3.js');
    const c = await txScene({known: [RECIPIENT]});
    const legacy = base64.encode(new Transaction({feePayer: ME, recentBlockhash: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}).add(transfer(1)).serialize({requireAllSignatures: false, verifySignatures: false}));
    const r = await c.signTx('l', [legacy]);
    const view = await c.simulated();
    expect((view.request?.tx?.transactions as {version: unknown; outcome: {ok: boolean}}[])[0]).toMatchObject({version: 'legacy', outcome: {ok: true}});
    expect(await c.approve(String(r?.requestId), view.request?.tx?.simulation.id)).toEqual({ok: true});
    const [signed] = (c.page.answersFor(String(r?.requestId))[0]?.result as {signed: string[]}).signed;
    expect(verifies(signed ?? '', 0, ME.toBytes())).toBe(true);
    expect(base64.decode(signed ?? '').slice(65)).toEqual(base64.decode(legacy).slice(65));
  });

  it('withSignature writes only the slot it is given', () => {
    const wire = base64.decode(coSigned());
    const out = withSignature(wire, 1, new Uint8Array(64).fill(9));
    expect(out.slice(1 + 64, 1 + 128)).toEqual(new Uint8Array(64).fill(9));
    expect(out.slice(0, 1 + 64)).toEqual(wire.slice(0, 1 + 64));
    expect(out.slice(1 + 128)).toEqual(wire.slice(1 + 128));
  });

  it('a refresh that lands between the window’s read and its click: refused stale; the window re-reads, and the new one is approvable', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const requestId = String(r?.requestId);
    const shown = String((await c.simulated()).request?.tx?.simulation.id);
    c.deps.clock.t += SIM_REFRESH_MS;
    const fresh = String((await c.simulated(shown)).request?.tx?.simulation.id);
    expect(await c.approve(requestId, shown)).toEqual({ok: false, error: 'stale'});
    expect(await c.approve(requestId, fresh)).toEqual({ok: true});
  });

  it('the grant moved to another account, or revoked, while queued: no-grant both times — never a signature', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    await c.ext.local.set(GRANTS_KEY, [{origin: 'https://dapp.test', account: RECIPIENT, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    expect(await c.approve(String(r?.requestId), id)).toEqual({ok: false, error: 'no-grant'});
    await c.ext.local.set(GRANTS_KEY, []);
    expect(await c.approve(String(r?.requestId), id)).toEqual({ok: false, error: 'no-grant'});
    expect(c.page.answersFor(String(r?.requestId))).toEqual([]);
  });

  it('a lock between deciding and the signature answers rejected; a restart with a deciding entry answers rejected — never re-signed (C17)', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    // The decision arms the auto-lock between the deciding section and the signing: a lock lands right there (the
    // queue's own expiry alarm, armed by every queue access, is left alone).
    const create = c.ext.alarms.create;
    c.ext.alarms.create = (name, o) => (name === AUTOLOCK_ALARM ? lock(c.ext) : create(name, o));
    expect(await c.approve(requestId, id)).toEqual({ok: true});
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);

    const d = await txScene({known: [RECIPIENT]});
    const r2 = await d.signTx('t', [v0()]);
    const rid = String(r2?.requestId);
    await d.simulated();
    const s = await readDappSession(d.ext);
    await d.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: d.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}}))});
    expect(await d.page.ask({type: 'page.resume', requestIds: [rid]})).toEqual({resume: [{requestId: rid, error: 'rejected'}]});
  });

  it('the account removed from the session while its key is read: rejected, the signatures dropped', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0()]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    const other = {index: 1, publicKey: base58.encode(ed25519.getPublicKey(new Uint8Array(32).fill(2))), secretKey: base64.encode(new Uint8Array([...new Uint8Array(32).fill(2), ...ed25519.getPublicKey(new Uint8Array(32).fill(2))]))};
    const get = c.ext.session.get;
    let deciding = 0;
    let swapped = false;
    c.ext.session.get = async k => {
      const v = await get(k);
      // While deciding, the session is read three times before the answering section: by the decision's idle-timer
      // check, by the effect's first section, then for the key (outside any section). The key read gets the account —
      // the signatures ARE made — and the session loses it right after, so only the answering section's own re-check
      // can drop them (mutation M4h turns this red; an earlier swap would drop them for another reason).
      if (k === 'v1_session' && (await readDappSession(c.ext)).queue[0]?.state === 'deciding' && ++deciding === 3) {
        swapped = true;
        // Written directly (setSession takes sessionMutex, which a section may be holding while it reads).
        await c.ext.session.set('v1_session', {accounts: [other]});
      }
      return v;
    };
    expect(await c.approve(requestId, id)).toEqual({ok: true});
    expect(swapped).toBe(true);
    expect(c.page.answersFor(requestId)).toEqual([{requestId, error: 'rejected'}]);
  });
});

// B1b's re-authentication (spec §3.3, B1 §3) through #10 — reached from the toolbar icon (D11), never from the window.
describe('re-authentication for a transaction request', () => {
  it('a first send: Approve asks for a challenge (reauth-required), #10 describes it, the proof makes it proven, Approve then signs — once', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const view = await c.simulated();
    const id = view.request?.tx?.simulation.id;
    expect(view.request?.tx?.reauth).toEqual({reasons: ['first-send'], state: 'needed'});
    expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'reauth-required'});
    const challengeId = String((await c.entry(requestId))?.challengeId);
    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
    expect((await c.pend()).request?.tx?.reauth).toEqual({reasons: ['first-send'], state: 'waiting'});
    expect(await c.challengeInfo(challengeId)).toEqual({
      ok: true,
      data: {kind: 'dapp', account: ACCOUNT.publicKey, site: 'dapp.test', transactions: 1, outgoing: [{mint: null, amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000},
    });
    // Still refused while unproven; the challenge is not reissued.
    expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'reauth-required'});
    expect((await c.entry(requestId))?.challengeId).toBe(challengeId);
    expect(await c.reauthOk(challengeId)).toEqual({ok: true});
    expect((await c.pend()).request?.tx?.reauth).toEqual({reasons: ['first-send'], state: 'proven'});
    expect(await c.approve(requestId, id)).toEqual({ok: true});
    expect(c.page.answersFor(requestId)).toHaveLength(1);
    // Single use: the challenge is gone.
    expect(await c.challengeInfo(challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('an expired challenge is replaced by a new one at the next Approve (never revived)', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    await c.approve(requestId, id);
    const first = String((await c.entry(requestId))?.challengeId);
    c.deps.clock.t += 120_000;
    const id2 = (await c.simulated(id)).request?.tx?.simulation.id;
    expect(await c.approve(requestId, id2)).toEqual({ok: false, error: 'reauth-required'});
    expect((await c.entry(requestId))?.challengeId).not.toBe(first);
    expect(SOL).toBe(10_000_000_000n);
  });

  /** A proven request, and a hook on the challenge store's reads during the next Approve (the gate reads it twice, the consume once more). */
  async function proven() {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    const requestId = String(r?.requestId);
    const id = String((await c.simulated()).request?.tx?.simulation.id);
    await c.approve(requestId, id);
    const challengeId = String((await c.entry(requestId))?.challengeId);
    await c.reauthOk(challengeId);
    const get = c.ext.session.get;
    const hook: {onRead: ((n: number) => Promise<unknown | undefined>) | null; reads: number} = {onRead: null, reads: 0};
    c.ext.session.get = async k => {
      if (k !== REAUTH_KEY || hook.onRead === null) return get(k);
      hook.reads++;
      const replaced = await hook.onRead(hook.reads);
      return replaced === undefined ? get(k) : replaced;
    };
    return {...c, requestId, id, challengeId, hook};
  }

  // Review 1 L1: the proof is consumed after `deciding` is written, so a refusal there does not spend it.
  it('a refresh that lands while the gate reads the proof: stale — the proof is not spent; the new simulation’s approval signs with it, once', async () => {
    const c = await proven();
    const fresh = 'R'.repeat(22);
    c.hook.onRead = async n => {
      // The gate's first read: a refresh lands now (a new simulation id on the entry), before the deciding section.
      if (n === 1) {
        const s = await readDappSession(c.ext);
        await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => (e.sim?.status === 'ok' ? {...e, sim: {status: 'ok', sim: {...e.sim.sim, id: fresh}}} : e))});
      }
      return undefined;
    };
    expect(await c.approve(c.requestId, c.id)).toEqual({ok: false, error: 'stale'});
    c.hook.onRead = null;
    expect(c.page.answersFor(c.requestId)).toEqual([]);
    expect((await c.pend()).request?.tx?.reauth?.state).toBe('proven');
    expect(await c.approve(c.requestId, fresh)).toEqual({ok: true});
    expect(c.page.answersFor(c.requestId)).toHaveLength(1);
    expect(c.page.answersFor(c.requestId)[0]?.result).toBeDefined();
    expect(await c.challengeInfo(c.challengeId)).toEqual({ok: false, error: 'unknown-challenge'});
  });

  it('the proof gone between the gate and the consume (spent elsewhere): rejected, nothing signed — never signed on a proof not consumed', async () => {
    const c = await proven();
    // Reads 1–2 are the gate's (live, satisfied); read 3 is the consume's: the challenge is no longer in the store.
    c.hook.onRead = async n => (n === 3 ? {} : undefined);
    expect(await c.approve(c.requestId, c.id)).toEqual({ok: false, error: 'reauth-required'});
    expect(c.hook.reads).toBe(3);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
  });

  // Review 1 L9: a batch that loses more mints than #10 lists is cut and counted, never refused.
  it('dappAbout: at most MAX_DAPP_OUTGOING mints — SOL first, then the largest in USD, then the unpriced in order — and the rest counted', async () => {
    const c = await txScene();
    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
    await c.simulated();
    const e = structuredClone(await c.entry(String(r?.requestId)));
    if (e === undefined || e.sim?.status !== 'ok') throw new Error('not simulated');
    const mint = (i: number) => base58.encode(new Uint8Array(32).fill(i + 1));
    const changes = [
      ...Array.from({length: 10}, (_, i) => ({mint: mint(i), amount: '-5', decimals: 0, usdMicros: null})),
      ...Array.from({length: 8}, (_, i) => ({mint: mint(20 + i), amount: '-5', decimals: 0, usdMicros: String(-(i + 1) * 1_000_000)})),
      {mint: null, amount: '-7', decimals: 9, usdMicros: null},
      {mint: mint(40), amount: '3', decimals: 0, usdMicros: '9000000000'},
    ];
    const [first] = e.sim.sim.outcomes;
    if (first === undefined || !first.ok) throw new Error('no outcome');
    e.sim = {status: 'ok', sim: {...e.sim.sim, outcomes: [{...first, changes}]}};
    const about = dappAbout(e, 'dapp.test', 10_000);
    expect(MAX_DAPP_OUTGOING).toBe(16);
    expect(about?.outgoing.map(o => o.mint)).toEqual([null, ...[7, 6, 5, 4, 3, 2, 1, 0].map(i => mint(20 + i)), ...[0, 1, 2, 3, 4, 5, 6].map(mint)]);
    expect(about?.omitted).toBe(3);
    // Positive control: a short list is whole, nothing omitted.
    e.sim = {status: 'ok', sim: {...e.sim.sim, outcomes: [{...first, changes: changes.slice(17)}]}};
    expect(dappAbout(e, 'dapp.test', 10_000)).toMatchObject({outgoing: [{mint: null}, {mint: mint(27)}], omitted: 0});
  });
});

describe('#48’s other views', () => {
  it('the mismatch notice names the origin the account is granted to; locked, a transaction request shows only its origin (D11)', async () => {
    const c = await txScene({grant: {origin: 'https://jup.ag'}});
    expect(await c.signTx('m', [v0()])).toEqual({id: 'm', error: 'unauthorized'});
    const view = (await c.pend()) as unknown as {state: string; request: {type: string; mismatch: unknown; tx: unknown}};
    expect(view).toMatchObject({state: 'request', request: {type: 'mismatch', mismatch: {granted: 'https://jup.ag'}, tx: null}});
    const d = await txScene();
    await d.signTx('t', [v0()]);
    await lock(d.ext);
    // A lock answers the queue: nothing left to show.
    expect((await d.pend()).state).toBe('none');
    const e = await txScene();
    await e.signTx('t', [v0()]);
    await e.simulated();
    expect(runtimeFor(e.ext).simulating.size).toBe(0);
  });
});
````

Change `extension/src/background/dapp/__tests__/store.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/store.test.ts b/extension/src/background/dapp/__tests__/store.test.ts
index c127e27..d21a0de 100644
--- a/extension/src/background/dapp/__tests__/store.test.ts
+++ b/extension/src/background/dapp/__tests__/store.test.ts
@@ -10,7 +10,7 @@ const T = 1_000_000_000;
 const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: T, lastUsedAt: T, recent: [], ...over});
 const entry = (over: Partial<Entry> = {}): Entry => ({
   requestId: 'r1', pageId: 'p1', origin: 'https://dapp.test', host: 'dapp.test', tabId: 7, documentId: null, type: 'connect', account: null,
-  message: null, transactions: null, granted: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null, decision: null, answer: null, answeredAt: null, ...over,
+  message: null, transactions: null, granted: null, sim: null, challengeId: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null, decision: null, answer: null, answeredAt: null, ...over,
 });
 
 // Spec §2.1, §2.6, C14 — the stores the request lifecycle writes, and the one section that writes them.
````

Create `extension/src/background/dapp/__tests__/txHarness.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {PublicKey, SystemProgram, TransactionInstruction, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
import type {SimulationOutcome, SolanaReader} from '../../../../../core/solana/rpc';
import {handleMessage} from '../../messages';
import {setSession} from '../../session';
import {VAULT_KEY} from '../../accountsStore';
import {GRANTS_KEY, type Grant} from '../grants';
import {runUnlockHook} from '../queue';
import {readDappSession, type Entry} from '../store';
import {fakeExt} from '../../__tests__/fakeExt';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {ACCOUNT, BLOCKHASH, RECIPIENT} from '../../__tests__/fixtures';
import {openPage, type Page} from './pageHarness';

/**
 * B1c-2's transaction requests against the real background: an unlocked wallet (ACCOUNT, "Main"), a persistent grant
 * for https://dapp.test, its page, and a chain the tests steer — every simulation answers the payer's lamports less
 * what its System transfers move and its fee (as a node does, spec §11.5), unless `chain.err` is set.
 */
export const DAPP = 'https://dapp.test';
export const ME = new PublicKey(ACCOUNT.publicKey);
export const TO = new PublicKey(RECIPIENT);
export const SOL = 10_000_000_000n;
/** A co-signer (a dApp's own key): a real keypair, 32 × 0x03. */
export const CO_SEED = new Uint8Array(32).fill(3);
export const CO = new PublicKey(ed25519.getPublicKey(CO_SEED));

export const transfer = (lamports: number | bigint = 1, from = ME, to = TO) => SystemProgram.transfer({fromPubkey: from, toPubkey: to, lamports: BigInt(lamports)});
export const v0 = (instructions: TransactionInstruction[] = [transfer()], payer = ME): string =>
  base64.encode(new VersionedTransaction(new TransactionMessage({payerKey: payer, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message()).serialize());
/** Paid and signed by the co-signer; the account is a required signer whose slot is still empty. */
export function coSigned(instructions: TransactionInstruction[] = [transfer(1, ME)]): string {
  const tx = new VersionedTransaction(new TransactionMessage({payerKey: CO, recentBlockhash: BLOCKHASH, instructions}).compileToV0Message());
  tx.addSignature(CO, ed25519.sign(tx.message.serialize(), CO_SEED));
  return base64.encode(tx.serialize());
}

export interface Chain {
  /** simulateTransaction's error (null: it runs). */
  err: unknown;
  /** Calls per method. */
  calls: Map<string, number>;
  /** getBalance throws while set. */
  down: boolean;
}

function chainReader(chain: Chain): SolanaReader {
  const count = (m: string) => chain.calls.set(m, (chain.calls.get(m) ?? 0) + 1);
  const up = (m: string) => {
    count(m);
    if (chain.down) throw new Error('the proxy is unreachable');
  };
  return fakeReader({
    getBalance: async () => {
      up('getBalance');
      return SOL;
    },
    getTokenAccountsByOwner: async () => {
      count('getTokenAccountsByOwner');
      return [];
    },
    getLatestBlockhash: async () => {
      count('getLatestBlockhash');
      return {blockhash: BLOCKHASH, lastValidBlockHeight: 5_000};
    },
    getAccountsData: async addresses => {
      count('getAccountsData');
      return addresses.map(() => null);
    },
    simulateTransaction: async (txBase64, opts): Promise<SimulationOutcome> => {
      count('simulateTransaction');
      if (chain.err !== null) return {err: chain.err, logs: [], unitsConsumed: 0, slot: 777, accounts: null};
      const m = VersionedTransaction.deserialize(base64.decode(txBase64)).message;
      const keys = m.staticAccountKeys.map(k => k.toBase58());
      let out = 0n;
      for (const ix of m.compiledInstructions) {
        if (keys[ix.programIdIndex] === SystemProgram.programId.toBase58() && ix.data[0] === 2 && keys[ix.accountKeyIndexes[0] ?? -1] === ME.toBase58()) out += new DataView(ix.data.buffer, ix.data.byteOffset + 4, 8).getBigUint64(0, true);
      }
      const fee = keys[0] === ME.toBase58() ? 5_000n * BigInt(m.header.numRequiredSignatures) : 0n;
      return {err: null, logs: [], unitsConsumed: 450, slot: 777, accounts: (opts?.accounts ?? []).map(a => (a === ME.toBase58() ? {lamports: SOL - out - fee, owner: SystemProgram.programId.toBase58(), data: new Uint8Array()} : null))};
    },
  });
}

/** Lets fire-and-forget work (a simulation started by dapp.pending) finish: up to `turns` macrotask turns, until `done`. */
export async function until(done: () => Promise<boolean>, turns = 400): Promise<void> {
  for (let i = 0; i < turns; i++) {
    if (await done()) return;
    await new Promise<void>(r => setTimeout(r, 0));
  }
  throw new Error('never settled');
}

export async function txScene(o: {grant?: Partial<Grant> | null; known?: string[]} = {}) {
  const ext = fakeExt();
  const chain: Chain = {err: null, calls: new Map(), down: false};
  const deps = fakeDeps({reader: chainReader(chain)});
  await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
  await setSession(ext, [ACCOUNT]);
  await runUnlockHook(ext, deps);
  if (o.grant !== null) await ext.local.set(GRANTS_KEY, [{origin: DAPP, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: [], ...o.grant}]);
  if (o.known !== undefined) await ext.local.set('v1_known_recipients', o.known.map(address => ({address, at: 1})));
  const approveSender = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
  const vaultSender = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/unlock.html`};
  const page: Page = openPage(ext, deps, DAPP);
  const queue = async (): Promise<Entry[]> => (await readDappSession(ext)).queue;
  const entry = async (requestId: string): Promise<Entry | undefined> => (await queue()).find(e => e.requestId === requestId);
  type View = {state: string; request: {tx: Record<string, unknown> & {simulation: {status: string; id?: string}; reauth: {state: string} | null}} | null};
  const pend = async (): Promise<View> => ((await handleMessage(ext, {type: 'dapp.pending'}, approveSender, deps)) as {data: View}).data;
  /** dapp.pending until its simulation answered (the first, or one newer than `after`), then the view. */
  const simulated = async (after?: string): Promise<View> => {
    let view = await pend();
    await until(async () => {
      view = await pend();
      const s = view.request?.tx?.simulation;
      return s !== undefined && s.status !== 'simulating' && s.id !== after;
    });
    return view;
  };
  const decide = (m: Record<string, unknown>) => handleMessage(ext, {type: 'dapp.decide', ...m}, approveSender, deps);
  const approve = async (requestId: string, simulation?: string) => decide({requestId, decision: 'approve', account: ACCOUNT.publicKey, ...(simulation === undefined ? {} : {simulation})});
  const reauthOk = (challengeId: string) => handleMessage(ext, {type: 'vault.reauthOk', challengeId}, vaultSender, deps);
  const challengeInfo = (challengeId: string) => handleMessage(ext, {type: 'vault.challengeInfo', challengeId}, vaultSender, deps);
  const signTx = (id: string, transactions: string[]) => page.ask({type: 'page.signTransaction', id, account: ACCOUNT.publicKey, transactions});
  const send = (id: string, transaction: string) => page.ask({type: 'page.signAndSendTransaction', id, account: ACCOUNT.publicKey, transaction});
  return {ext, deps, chain, page, queue, entry, pend, simulated, decide, approve, reauthOk, challengeInfo, signTx, send};
}
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/background/dapp/__tests__/decide.test.ts src/background/dapp/__tests__/signTx.test.ts src/background/dapp/__tests__/store.test.ts`

Expected (the dry run): Test Files  3 failed (3) · Tests  4 failed | 48 passed (52)

- [ ] **Step 3: Implement.**

Change `extension/src/background/dapp/decide.ts`:

````diff
diff --git a/extension/src/background/dapp/decide.ts b/extension/src/background/dapp/decide.ts
index db536b0..c372f8b 100644
--- a/extension/src/background/dapp/decide.ts
+++ b/extension/src/background/dapp/decide.ts
@@ -11,9 +11,11 @@ import {MAX_GRANTS, type Grant} from './grants';
 import {inCooldown, rejectionsOf, REJECTIONS_FOR_COOLDOWN} from './limits';
 import {runtimeFor} from './ports';
 import {answer, headOf, isOpenEntry, queueAccess, rejectQueued, userRejected, type Effects} from './queue';
-import {dropGrant, grantIn, putGrant, type Decision, type Entry, type Tx} from './store';
+import {dropGrant, grantIn, putGrant, readDappSession, type Decision, type Entry, type Tx} from './store';
 import {base64} from '@scure/base';
 import {checkMessage, checkSiws, finishSign, homoglyphRanges, keywordIn} from './signMessage';
+import {dappDigest, finishSignTx, isTxType, needsSimulation, reauthGate, runSimulation, txDetail, txRefused, type TxDetail, type TxRefusal} from './signTx';
+import {consumeChallenge} from '../reauthChallenges';
 
 /**
  * The approval window's two messages (spec §1.4, §2.3, C13, C17): `dapp.pending` — what the window shows — and
@@ -86,6 +88,10 @@ export interface RequestView {
   /** Null while locked: the locked screen shows the origin card only (D11). */
   connect: ConnectDetail | null;
   sign: SignDetail | null;
+  /** B1c-2, #48: a transaction request's account and detail (null while locked, or when it can no longer be signed — Q26). */
+  tx: (TxDetail & {account: AccountChoice; kind: 'signTransaction' | 'signAndSendTransaction'}) | null;
+  /** B1c-2, #48 "origin-mismatch · auto-reject": the origin the named account is granted to. */
+  mismatch: {granted: string} | null;
 }
 
 export type PendingView =
@@ -117,11 +123,17 @@ async function viewOf(ext: Ext, tx: Tx, e: Entry): Promise<RequestView> {
   const site = siteView(e.host);
   let connect: ConnectDetail | null = null;
   let sign: SignDetail | null = null;
+  let txView: RequestView['tx'] = null;
   if (unlocked) {
     const c = await choices(ext, tx);
     if (e.type === 'connect') connect = {...c, cap: grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS};
     const named = c.accounts.find(a => a.publicKey === e.account);
     if (e.type === 'signMessage' && named !== undefined) sign = signDetail(e, site, named);
+    if (isTxType(e.type) && named !== undefined && tx.session !== null) {
+      const names = new Map(c.accounts.map(a => [a.publicKey, a.name]));
+      const detail = await txDetail(ext, e, tx.session, names, tx.now, runtimeFor(ext).simulating.has(e.requestId));
+      if (detail !== null) txView = {...detail, account: named, kind: e.type};
+    }
   }
   return {
     requestId: e.requestId,
@@ -132,6 +144,8 @@ async function viewOf(ext: Ext, tx: Tx, e: Entry): Promise<RequestView> {
     offerBlock: rejectionsOf(tx.limits, e.host, e.tabId) >= REJECTIONS_FOR_COOLDOWN - 1,
     connect,
     sign,
+    tx: txView,
+    mismatch: e.type === 'mismatch' && e.granted !== null ? {granted: e.granted} : null,
   };
 }
 
@@ -140,8 +154,9 @@ async function viewOf(ext: Ext, tx: Tx, e: Entry): Promise<RequestView> {
  * `locked` while locked (D11), `none` when the queue is empty (the window closes itself) — with how many more wait (Q12)
  * and the budget notice (Q24, once). Records which request the window shows: closing the window rejects that one.
  */
-export async function pending(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<PendingView> {
-  return queueAccess(ext, deps, async (tx): Promise<PendingView> => {
+export async function pending(ext: Ext, deps: WalletDeps): Promise<PendingView> {
+  let simulate: string | null = null;
+  const view = await queueAccess(ext, deps, async (tx): Promise<PendingView> => {
     const h = headOf(tx);
     if (h === null) return {state: 'none'};
     if (tx.s.window !== null) tx.s.window = {...tx.s.window, showing: h.requestId};
@@ -149,27 +164,34 @@ export async function pending(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<
     if (windowNotice) tx.limits = {...tx.limits, notice: false};
     const waiting = tx.s.queue.filter(isOpenEntry).length - 1;
     const state = tx.session === null ? 'locked' : h.state === 'deciding' ? 'deciding' : 'request';
+    // B1c-2 (§3.3): the head's simulation — the first, the 30 s refresh, a retry — starts after this section.
+    if (tx.session !== null && needsSimulation(h, tx.now)) simulate = h.requestId;
     return {state, request: await viewOf(ext, tx, h), waiting, windowNotice};
   });
+  if (simulate !== null) void runSimulation(ext, deps, simulate).catch(e => console.warn('dApp: a simulation failed to run', e));
+  return view;
 }
 
-export type DecideError = 'malformed' | 'not-head' | 'expired' | 'locked' | 'unknown-account' | 'scope' | 'blocked' | 'cap' | 'no-grant' | 'account' | 'siws-mismatch';
+export type DecideError = 'malformed' | 'not-head' | 'expired' | 'locked' | 'unknown-account' | 'scope' | 'blocked' | 'cap' | 'no-grant' | 'account' | 'siws-mismatch' | TxRefusal | 'reauth-required';
 export interface DecideRequest {
   requestId: string;
   decision: Decision;
   account: string | null;
   scope: Grant['scope'] | null;
+  /** B1c-2: a transaction request's approval names the simulation the window showed (C13). */
+  simulation: string | null;
 }
 
 const DECISIONS: readonly string[] = ['approve', 'reject', 'report', 'block'];
 
 /** dapp.decide's shape: a request id, a decision, and — for an approval — the account (and a connect's scope). */
 export function decideRequestOf(msg: Record<string, unknown>): DecideRequest | null {
-  const {requestId, decision, account, scope} = msg;
+  const {requestId, decision, account, scope, simulation} = msg;
   if (typeof requestId !== 'string' || typeof decision !== 'string' || !DECISIONS.includes(decision)) return null;
   if (account !== undefined && typeof account !== 'string') return null;
   if (scope !== undefined && scope !== 'session' && scope !== 'persistent') return null;
-  return {requestId, decision: decision as Decision, account: account ?? null, scope: scope ?? null};
+  if (simulation !== undefined && typeof simulation !== 'string') return null;
+  return {requestId, decision: decision as Decision, account: account ?? null, scope: scope ?? null, simulation: simulation ?? null};
 }
 
 /** Blocking a host (§2.6): every grant of that host (both scopes, every port and scheme) revoked, its queued requests rejected. */
@@ -205,10 +227,12 @@ function approvalRefused(tx: Tx, e: Entry, d: DecideRequest): DecideError | null
   if (isBlocked(tx.blocked, e.host) || inCooldown(tx.limits, e.host, e.tabId, tx.now)) return 'blocked';
   // §2.1: beyond 200 persistent grants a connect has only [Reject] (Q16).
   if (e.type === 'connect' && grantIn(tx, e.origin) === null && tx.grants.length >= MAX_GRANTS) return 'cap';
-  if (e.type === 'signMessage') {
+  if (e.type === 'signMessage' || isTxType(e.type)) {
     // review 2 M9: the grant must still be held for the request's account.
     if (grantIn(tx, e.origin)?.account !== e.account) return 'no-grant';
     if (d.account !== e.account) return 'account';
+  }
+  if (e.type === 'signMessage') {
     // §3.2 rule 3: a sign-in message for another domain has no Sign (C13: the window's missing button is not the check).
     if (e.message !== null) {
       const checked = checkMessage(base64.decode(e.message));
@@ -241,15 +265,53 @@ async function finishConnect(ext: Ext, deps: Pick<WalletDeps, 'now'>, requestId:
   });
 }
 
+/** The site as the window shows it (host, or host:port — review 1 L5, R35), for #10's description. */
+function siteOf(origin: string, host: string): string {
+  try {
+    return new URL(origin).host;
+  } catch {
+    return host;
+  }
+}
+
+/** expiry, head: the first two rows of §2.3's table, for any decision. */
+function headRefused(tx: Tx, e: Entry | undefined): DecideError | null {
+  // expiry: the sweep at the top of this section has answered an expired request `timeout`.
+  if (e?.state === 'answered' && e.answer !== null && 'error' in e.answer && e.answer.error === 'timeout') return 'expired';
+  // head: only the queue head, and only while `queued` (a `deciding` one is never decided twice).
+  if (e === undefined || headOf(tx) !== e || e.state !== 'queued') return 'not-head';
+  return null;
+}
+
 /** dapp.decide (§2.3): one refusal per row of the table, else the decision — a reject at once, an approval through `deciding`. */
 export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Promise<{ok: true} | {ok: false; error: DecideError}> {
   const instance = runtimeFor(ext).instance;
+  // B1c-2: a transaction request's approval first passes every check, then the re-authentication gate (outside any
+  // section: the challenge store takes sessionMutex), then writes `deciding` in a second section that checks it all again.
+  // A peek without a section only routes: every check below runs again inside the sections. A connect or a
+  // signMessage decision takes the one section it always took.
+  const peek = (await readDappSession(ext)).queue.find(x => x.requestId === d.requestId);
+  // A proven challenge to consume after `deciding` is written (review 1 L1): its id and what it is bound to.
+  let proof: {id: string; digest: string} | null = null;
+  if (d.decision === 'approve' && peek !== undefined && isTxType(peek.type)) {
+    const pre = await queueAccess(ext, deps, (tx): DecideError | Entry | 'other' => {
+      const e = tx.s.queue.find(x => x.requestId === d.requestId);
+      const head = headRefused(tx, e);
+      if (head !== null) return head;
+      if (e === undefined || !isTxType(e.type)) return 'other';
+      return approvalRefused(tx, e, d) ?? txRefused(e, d.simulation, tx.now) ?? structuredClone(e);
+    });
+    if (typeof pre === 'string' && pre !== 'other') return {ok: false, error: pre};
+    if (typeof pre === 'object') {
+      const gate = await reauthGate(ext, deps, pre, siteOf(pre.origin, pre.host));
+      if (gate === 'proven' && pre.challengeId !== null) proof = {id: pre.challengeId, digest: dappDigest(pre)};
+      else if (gate !== 'ready') return {ok: false, error: gate === 'proven' ? 'reauth-required' : gate};
+    }
+  }
   const out = await queueAccess(ext, deps, (tx, fx): DecideError | {approved: Entry['type']} | 'done' => {
     const e = tx.s.queue.find(x => x.requestId === d.requestId);
-    // expiry: the sweep at the top of this section has answered an expired request `timeout`.
-    if (e?.state === 'answered' && e.answer !== null && 'error' in e.answer && e.answer.error === 'timeout') return 'expired';
-    // head: only the queue head, and only while `queued` (a `deciding` one is never decided twice).
-    if (e === undefined || headOf(tx) !== e || e.state !== 'queued') return 'not-head';
+    const head = headRefused(tx, e);
+    if (head !== null || e === undefined) return head ?? 'not-head';
     // B1c-2: a mismatch notice is only ever dismissed (#48 "origin-mismatch · auto-reject" has no approval path).
     if (e.type === 'mismatch' && d.decision !== 'reject') return 'malformed';
     if (d.decision === 'reject') {
@@ -264,9 +326,9 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
       blockHost(tx, fx, e.host);
       return 'done';
     }
-    // Task 4 gives a transaction request its approval path.
-    if (e.type !== 'connect' && e.type !== 'signMessage') return 'malformed';
-    const refused = approvalRefused(tx, e, d);
+    // Task 5 gives signAndSendTransaction its effect.
+    if (e.type === 'signAndSendTransaction') return 'malformed';
+    const refused = approvalRefused(tx, e, d) ?? (isTxType(e.type) ? txRefused(e, d.simulation, tx.now) : null);
     if (refused !== null) return refused;
     e.state = 'deciding';
     e.decidedBy = instance;
@@ -275,8 +337,21 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
     return {approved: e.type};
   });
   if (typeof out === 'string' && out !== 'done') return {ok: false, error: out};
+  // Review 1 L1: the proof is spent here — after `deciding` (never decided twice), before any key is read. If it is gone
+  // (expired, or spent by another approval), the request ends `rejected`: nothing was signed.
+  if (proof !== null && typeof out === 'object' && !(await consumeChallenge(ext, deps.now(), proof.id, proof.digest))) {
+    await queueAccess(ext, deps, (tx, fx) => {
+      const e = tx.s.queue.find(x => x.requestId === d.requestId);
+      if (e !== undefined && e.state === 'deciding' && e.decidedBy === instance) answer(fx, e, {error: 'rejected'}, tx.now);
+    });
+    return {ok: false, error: 'reauth-required'};
+  }
   // §2.2: a decision in the window is a user action — it arms the auto-lock timer (page requests never do).
   if ((await getSession(ext)) !== null) await armAutolock(ext).catch(e => console.warn('dApp decide: the idle timer was not re-armed', e));
-  if (typeof out === 'object') await (out.approved === 'connect' ? finishConnect : finishSign)(ext, deps, d.requestId, instance);
+  if (typeof out === 'object') {
+    // Each approvable type's effect, by name: a type with none (a mismatch notice — refused above) can never fall into another's.
+    const effects: Partial<Record<Entry['type'], (ext: Ext, deps: WalletDeps, requestId: string, instance: string) => Promise<void>>> = {connect: finishConnect, signMessage: finishSign, signTransaction: finishSignTx};
+    await effects[out.approved]?.(ext, deps, d.requestId, instance);
+  }
   return {ok: true};
 }
````

Change `extension/src/background/dapp/pageApi.ts`:

````diff
diff --git a/extension/src/background/dapp/pageApi.ts b/extension/src/background/dapp/pageApi.ts
index c1c8e08..3edd97f 100644
--- a/extension/src/background/dapp/pageApi.ts
+++ b/extension/src/background/dapp/pageApi.ts
@@ -73,6 +73,8 @@ function enqueue(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort,
     documentId: live.documentId,
     transactions: null,
     granted: null,
+    sim: null,
+    challengeId: null,
     ...fields,
     arrivedAt: tx.now,
     state: 'queued',
````

Change `extension/src/background/dapp/ports.ts`:

````diff
diff --git a/extension/src/background/dapp/ports.ts b/extension/src/background/dapp/ports.ts
index dcfa2d8..d1cc226 100644
--- a/extension/src/background/dapp/ports.ts
+++ b/extension/src/background/dapp/ports.ts
@@ -81,6 +81,8 @@ export interface Runtime {
    * already have.
    */
   hooked: boolean;
+  /** B1c-2: the requests whose simulation is running in this instance (signTx.ts) — one at a time per request. */
+  simulating: Set<string>;
 }
 
 const runtimes = new WeakMap<Pick<Ext, 'runtimeId'>, Runtime>();
@@ -93,7 +95,7 @@ function randomHex(n: number): string {
 export function runtimeFor(ext: Pick<Ext, 'runtimeId'>): Runtime {
   let r = runtimes.get(ext);
   if (r === undefined) {
-    r = {instance: randomHex(16), ports: new Set(), hooked: false};
+    r = {instance: randomHex(16), ports: new Set(), hooked: false, simulating: new Set()};
     runtimes.set(ext, r);
   }
   return r;
````

Create `extension/src/background/dapp/signTx.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import type {Ext} from '../../ext';
import type {WalletDeps} from '../deps';
import {digestOf} from '../digest';
import {getSession} from '../session';
import {readSettings} from '../settings';
import {recipientFacts} from '../knownRecipients';
import {MAX_DAPP_OUTGOING, challengeInfo, challengeSatisfied, issueChallenge, type ChallengeAbout, type DappOutgoing} from '../reauthChallenges';
import {readContacts} from '../contacts';
import {decodeInstructions, type DecodedInstruction} from './decode/decode';
import {resolveKeys} from './decode/keys';
import {parseWire, type ParsedTx} from './decode/wire';
import {withRecent} from './grants';
import {runtimeFor} from './ports';
import {answer, queueAccess} from './queue';
import {simulateTransactions, type SimState, type TxOutcome} from './simulate';
import {grantIn, putGrant, type Entry, type Tx} from './store';
import {slotOf} from './txRequest';
import type {DappReauthReason} from '../reauthPolicy';

/**
 * A transaction request after it is queued (spec B1c §3.3, §1.5; C13, C15, C17): its simulation — run when the window
 * asks (`dapp.pending`) and again SIM_REFRESH_MS after the last one (§3.3: "after 30 s on screen the transaction is
 * re-simulated to refresh the shown effects"), never inside a queue section (it reads the proxy) and at most once at a
 * time per request; what #48 shows of it; the checks `dapp.decide` adds for it — the simulation the window showed, still
 * fresh, every transaction simulated without error; B1b's re-authentication through #10 — and the `signTransaction`
 * effect: each transaction signed at the account's own slot, every other signature kept as the dApp sent it.
 */
export const SIM_REFRESH_MS = 30_000;
/** An approval needs a simulation at most this old: the refresh at 30 s has ten seconds to land before Approve stops working. */
export const SIM_VALID_MS = 40_000;
/** After an unreachable proxy, the next attempt. */
export const SIM_RETRY_MS = 5_000;

export const isTxType = (t: Entry['type']): t is 'signTransaction' | 'signAndSendTransaction' => t === 'signTransaction' || t === 'signAndSendTransaction';

/** The request's transactions, parsed again from what is stored (the page's bytes: parsed when queued, never trusted half-read). */
export function txsOf(e: Pick<Entry, 'transactions'>): {wires: Uint8Array[]; txs: ParsedTx[]} | null {
  if (e.transactions === null || e.transactions.length === 0) return null;
  const wires: Uint8Array[] = [];
  const txs: ParsedTx[] = [];
  for (const w of e.transactions) {
    let bytes: Uint8Array;
    try {
      bytes = base64.decode(w);
    } catch {
      return null;
    }
    const p = parseWire(bytes);
    if (p === null) return null;
    wires.push(bytes);
    txs.push(p);
  }
  return {wires, txs};
}

/** Whether `dapp.pending` should start a simulation of this head now. */
export function needsSimulation(e: Entry, now: number): boolean {
  if (!isTxType(e.type) || e.state !== 'queued') return false;
  if (e.sim === null) return true;
  return e.sim.status === 'ok' ? now - e.sim.sim.at >= SIM_REFRESH_MS : now - e.sim.at >= SIM_RETRY_MS;
}

/**
 * One simulation of a queued transaction request. Section 1 reads what to simulate (still queued, the session unlocked,
 * its account still in it); the reads and the simulation run outside any section; section 2 stores the result only if
 * the entry is still `queued` — a decision, a lock or an expiry meanwhile wins. A thrown read is stored as `unreachable`
 * (the window says so and offers only Reject until the next attempt answers).
 */
export async function runSimulation(ext: Ext, deps: WalletDeps, requestId: string): Promise<void> {
  const rt = runtimeFor(ext);
  if (rt.simulating.has(requestId)) return;
  rt.simulating.add(requestId);
  try {
    const work = await queueAccess(ext, deps, tx => {
      const e = tx.s.queue.find(x => x.requestId === requestId);
      if (e === undefined || e.state !== 'queued' || !isTxType(e.type) || e.account === null || tx.session === null) return null;
      const account = e.account;
      if (!tx.session.some(a => a.publicKey === account)) return null;
      const parsed = txsOf(e);
      return parsed === null ? null : {account, ...parsed, session: tx.session.map(a => ({publicKey: a.publicKey}))};
    });
    if (work === null) return;
    let state: SimState;
    try {
      const [facts, settings] = await Promise.all([recipientFacts(ext, work.session), readSettings(ext)]);
      const sim = await simulateTransactions(deps, {account: work.account, wires: work.wires, txs: work.txs, known: facts.known, thresholdCents: settings.reauthUsdCents});
      state = {status: 'ok', sim};
    } catch {
      state = {status: 'unreachable', at: deps.now()};
    }
    await queueAccess(ext, deps, tx => {
      const e = tx.s.queue.find(x => x.requestId === requestId);
      if (e !== undefined && e.state === 'queued') e.sim = state;
    });
  } finally {
    rt.simulating.delete(requestId);
  }
}

/** A label for an address #48 shows (B1 §3 "Addresses … with a label where known"): one of the wallet's accounts, or an address-book contact. */
export interface AddressLabel {
  address: string;
  kind: 'account' | 'contact';
  name: string;
}

export interface TxItemView {
  version: 'legacy' | 0;
  feePayer: string;
  /** Null while a lookup table is not yet resolved (before the first simulation of a v0 transaction that uses one). */
  instructions: DecodedInstruction[] | null;
  /** This transaction's simulated outcome, or null while simulating. */
  outcome: TxOutcome | null;
}

export type SimulationView = {status: 'simulating'} | {status: 'unreachable'} | {status: 'ok'; id: string; slot: number; elapsedMs: number; at: number};

/** #48's view of a transaction request (spec §3.3). */
export interface TxDetail {
  transactions: TxItemView[];
  simulation: SimulationView;
  /** B1b's rules (the simulation's reasons); `state`: none asked yet, a challenge waiting for #10, or proven (Approve signs). */
  reauth: {reasons: DappReauthReason[]; state: 'needed' | 'waiting' | 'proven'} | null;
  labels: AddressLabel[];
}

/** The request's #48 view; null when its bytes no longer read back (then the window offers only Reject). */
export async function txDetail(ext: Ext, e: Entry, session: readonly {publicKey: string}[], names: ReadonlyMap<string, string>, now: number, running: boolean): Promise<TxDetail | null> {
  const parsed = txsOf(e);
  if (parsed === null) return null;
  const sim = e.sim?.status === 'ok' ? e.sim.sim : null;
  const transactions = parsed.txs.map((p, i): TxItemView => {
    const keys = sim?.keys[i];
    const instructions = keys !== undefined ? decodeInstructions(p, {keys}) : p.lookups.length === 0 ? decodeInstructions(p, resolveKeys(p, new Map())) : null;
    return {version: p.version, feePayer: p.signers[0] ?? '', instructions, outcome: sim?.outcomes[i] ?? null};
  });
  const simulation: SimulationView =
    sim !== null ? {status: 'ok', id: sim.id, slot: sim.slot, elapsedMs: sim.elapsedMs, at: sim.at} : e.sim?.status === 'unreachable' && !running ? {status: 'unreachable'} : {status: 'simulating'};
  let reauth: TxDetail['reauth'] = null;
  if (sim !== null && sim.reasons.length > 0) {
    let state: 'needed' | 'waiting' | 'proven' = 'needed';
    if (e.challengeId !== null && (await challengeInfo(ext, now, e.challengeId)) !== null) state = (await challengeSatisfied(ext, now, e.challengeId, dappDigest(e))) ? 'proven' : 'waiting';
    reauth = {reasons: sim.reasons, state};
  }
  // Labels for every address the instructions name: the wallet's own accounts and the address book.
  const addresses = new Set(transactions.flatMap(t => (t.instructions ?? []).flatMap(ix => ix.fields.map(f => (f.value.kind === 'address' ? f.value.value : null)).filter((a): a is string => a !== null))));
  const contacts = await readContacts(ext).catch(() => []);
  const labels: AddressLabel[] = [];
  for (const address of addresses) {
    const own = session.some(a => a.publicKey === address) ? names.get(address) : undefined;
    const contact = contacts.find(c => c.address === address);
    if (own !== undefined) labels.push({address, kind: 'account', name: own});
    else if (contact !== undefined) labels.push({address, kind: 'contact', name: contact.name});
  }
  return {transactions, simulation, reauth, labels};
}

/** What a dApp challenge is bound to: this request and its exact bytes, for this account. */
export const dappDigest = (e: Pick<Entry, 'requestId' | 'account' | 'transactions'>): string => digestOf('dapp', {requestId: e.requestId, account: e.account, transactions: e.transactions});

/** The decision's checks for a transaction request (§2.3's table, extended by §3.3): null when approvable. */
export type TxRefusal = 'not-simulated' | 'stale' | 'simulation-failed' | 'blockhash-expired';
export function txRefused(e: Entry, simulation: string | null, now: number): TxRefusal | null {
  if (e.sim?.status !== 'ok') return 'not-simulated';
  const sim = e.sim.sim;
  // C13: the window names the simulation it showed; another one (a refresh landed) or an old one is not approvable.
  if (simulation !== sim.id || now - sim.at >= SIM_VALID_MS) return 'stale';
  if (sim.outcomes.some(o => !o.ok && o.error === 'expired')) return 'blockhash-expired';
  if (sim.outcomes.some(o => !o.ok)) return 'simulation-failed';
  return null;
}

/** What #10 says about a dApp challenge: the site, the batch's size, what leaves the account per mint, the reasons. */
export function dappAbout(e: Entry, site: string, thresholdCents: number): Extract<ChallengeAbout, {kind: 'dapp'}> | null {
  if (e.sim?.status !== 'ok' || e.account === null || e.transactions === null) return null;
  // Per mint: what leaves, and its USD value when every part of it has a price (null otherwise).
  const out = new Map<string | null, {amount: bigint; decimals: number | null; usd: bigint | null}>();
  for (const o of e.sim.sim.outcomes) {
    if (!o.ok) continue;
    for (const c of o.changes) {
      const a = BigInt(c.amount);
      if (a >= 0n) continue;
      const prev = out.get(c.mint);
      const usd = c.usdMicros === null ? null : -BigInt(c.usdMicros);
      out.set(c.mint, {amount: (prev?.amount ?? 0n) - a, decimals: c.decimals, usd: prev !== undefined && prev.usd === null ? null : usd === null ? null : (prev?.usd ?? 0n) + usd});
    }
  }
  // Review 1 L9: more mints than #10 lists is cut, not refused — SOL first, then the largest in USD, then the unpriced
  // ones in the order the batch names them; the rest are counted.
  const rank = (m: string | null, usd: bigint | null): [number, bigint] => (m === null ? [0, 0n] : usd === null ? [2, 0n] : [1, -usd]);
  const all = [...out].map(([mint, v], i) => ({mint, v, i})).sort((x, y) => {
    const [a, b] = [rank(x.mint, x.v.usd), rank(y.mint, y.v.usd)];
    return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || x.i - y.i;
  });
  const outgoing: DappOutgoing[] = all.slice(0, MAX_DAPP_OUTGOING).map(({mint, v}) => ({mint, amount: v.amount.toString(), decimals: v.decimals}));
  return {kind: 'dapp', account: e.account, site, transactions: e.transactions.length, outgoing, omitted: all.length - outgoing.length, reasons: e.sim.sim.reasons.slice(), thresholdCents};
}

/**
 * B1b's re-authentication for a transaction request (spec §3.3): when the simulation gave reasons, Approve first asks
 * for a challenge — issued once, kept on the entry, described by #10 (reached from the Noctura icon, never from the
 * window: D11) — and signs only once it is proven. Runs outside every queue section (the challenge store takes
 * sessionMutex). `ready`: no challenge needed; `proven`: approvable once the challenge is consumed — dapp.decide
 * consumes it right after the `deciding` section (plan 2 review 1 L1: a refusal in that section — a refresh landed,
 * the request is no longer the head — leaves the proof standing, so the user is not asked again for it). Still single
 * use: a `deciding` entry is never decided twice, and a failed consume ends the request `rejected` before any key is read.
 */
export async function reauthGate(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, e: Entry, site: string): Promise<'ready' | 'proven' | 'reauth-required' | 'stale'> {
  if (e.sim?.status !== 'ok' || e.sim.sim.reasons.length === 0) return 'ready';
  const digest = dappDigest(e);
  const now = deps.now();
  const live = e.challengeId !== null && (await challengeInfo(ext, now, e.challengeId)) !== null;
  if (!live) {
    const about = dappAbout(e, site, (await readSettings(ext)).reauthUsdCents);
    if (about === null) return 'stale';
    const id = await issueChallenge(ext, deps, digest, about);
    await queueAccess(ext, deps, tx => {
      const x = tx.s.queue.find(q => q.requestId === e.requestId);
      if (x !== undefined && x.state === 'queued') x.challengeId = id;
    });
    return 'reauth-required';
  }
  const id = e.challengeId as string;
  return (await challengeSatisfied(ext, now, id, digest)) ? 'proven' : 'reauth-required';
}

/** The wire with this signature written into slot `slot` (every other byte as the dApp sent it). */
export function withSignature(wire: Uint8Array, slot: number, signature: Uint8Array): Uint8Array {
  // The wire was accepted only as canonical (decode/wire.ts), so its signature count is a shortvec of 1 to 3 bytes.
  let at = 0;
  while ((wire[at] ?? 0) & 0x80) at++;
  const offset = at + 1 + 64 * slot;
  const out = Uint8Array.from(wire);
  out.set(signature, offset);
  return out;
}

/** Each transaction signed by the account at its own slot. The key bytes are zeroed after. */
export function signAll(wires: readonly Uint8Array[], txs: readonly ParsedTx[], account: {publicKey: string; secretKey: string}): Uint8Array[] {
  const sk = base64.decode(account.secretKey);
  try {
    return wires.map((w, i) => {
      const p = txs[i];
      const slot = p === undefined ? -1 : slotOf(p, account.publicKey);
      if (p === undefined || slot < 0) throw new Error('the account does not sign this transaction');
      return withSignature(w, slot, ed25519.sign(p.message, sk.subarray(0, 32)));
    });
  } finally {
    sk.fill(0);
  }
}

/** The effect's own checks again, at the write (C17): still this instance's `deciding` entry, unlocked, the account in the session, the grant held. */
export function stillDeciding(tx: Tx, e: Entry | undefined, instance: string, account: string): e is Entry {
  if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return false;
  return tx.session !== null && tx.session.some(a => a.publicKey === account) && grantIn(tx, e.origin)?.account === account;
}

/**
 * page.signTransaction's effect (§1.5 step 2, C17): after the `deciding` section, read the key, sign every transaction,
 * and answer `{signed}` in a section that first confirms the entry is still this instance's `deciding` one (a lock, a
 * restart, a revoke or an account removal in between answered or ends it `rejected` — the signatures are dropped,
 * never delivered).
 */
export async function finishSignTx(ext: Ext, deps: Pick<WalletDeps, 'now'>, requestId: string, instance: string): Promise<void> {
  const work = await queueAccess(ext, deps, tx => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.type !== 'signTransaction' || e.account === null) return null;
    const parsed = txsOf(e);
    return parsed === null ? null : {account: e.account, ...parsed};
  });
  if (work === null) return;
  const key = (await getSession(ext))?.find(a => a.publicKey === work.account);
  let signed: string[] | null = null;
  if (key !== undefined) {
    try {
      signed = signAll(work.wires, work.txs, key).map(w => base64.encode(w));
    } catch {
      signed = null;
    }
  }
  await queueAccess(ext, deps, (tx, fx) => {
    const e = tx.s.queue.find(x => x.requestId === requestId);
    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return;
    if (signed === null || !stillDeciding(tx, e, instance, work.account)) {
      answer(fx, e, {error: 'rejected'}, tx.now);
      return;
    }
    const g = grantIn(tx, e.origin);
    if (g !== null) putGrant(tx, withRecent(g, 'signTransaction', tx.now, 'approved'));
    answer(fx, e, {result: {signed}}, tx.now);
  });
}
````

Change `extension/src/background/dapp/simulate.ts`:

````diff
diff --git a/extension/src/background/dapp/simulate.ts b/extension/src/background/dapp/simulate.ts
index cd605df..da11f6f 100644
--- a/extension/src/background/dapp/simulate.ts
+++ b/extension/src/background/dapp/simulate.ts
@@ -224,3 +224,57 @@ export async function simulateTransactions(deps: Pick<WalletDeps, 'reader' | 'pr
     lastValidBlockHeight: latest.lastValidBlockHeight,
   };
 }
+
+/** What an entry holds (store.ts): the newest simulation, or that the last attempt could not reach the proxy. */
+export type SimState = {status: 'ok'; sim: TxSimulation} | {status: 'unreachable'; at: number};
+
+const REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new', 'approval'];
+const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
+const isIntOrNull = (x: unknown): x is number | null => x === null || isInt(x);
+const SIGNED = /^-?\d{1,40}$/;
+const DIGITS = /^\d{1,40}$/;
+const SIM_ID = /^[A-Za-z0-9_-]{22}$/;
+const obj = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
+
+function changeOf(x: unknown): BalanceChange | null {
+  const o = obj(x);
+  if (o === null || !(o.mint === null || typeof o.mint === 'string') || typeof o.amount !== 'string' || !SIGNED.test(o.amount) || !isIntOrNull(o.decimals)) return null;
+  if (!(o.usdMicros === null || (typeof o.usdMicros === 'string' && SIGNED.test(o.usdMicros)))) return null;
+  return {mint: o.mint, amount: o.amount, decimals: o.decimals, usdMicros: o.usdMicros};
+}
+
+function outcomeOf(x: unknown): TxOutcome | null {
+  const o = obj(x);
+  if (o === null) return null;
+  if (o.ok === false) return (o.error === 'expired' || o.error === 'failed') && typeof o.detail === 'string' ? {ok: false, error: o.error, detail: o.detail} : null;
+  if (o.ok !== true || !Array.isArray(o.changes) || !isIntOrNull(o.unitsConsumed) || !isInt(o.unitLimit) || !(o.feeLamports === null || (typeof o.feeLamports === 'string' && DIGITS.test(o.feeLamports)))) return null;
+  const changes = (o.changes as unknown[]).map(changeOf);
+  if (changes.some(c => c === null)) return null;
+  return {ok: true, changes: changes as BalanceChange[], unitsConsumed: o.unitsConsumed, unitLimit: o.unitLimit, feeLamports: o.feeLamports};
+}
+
+/** A stored SimState, rebuilt field by field (fresh objects, never the stored ones); null when anything is off — it is then simulated again. */
+export function simStateOf(x: unknown): SimState | null {
+  const o = obj(x);
+  if (o === null) return null;
+  if (o.status === 'unreachable') return isInt(o.at) ? {status: 'unreachable', at: o.at} : null;
+  const s = o.status === 'ok' ? obj(o.sim) : null;
+  if (s === null || typeof s.id !== 'string' || !SIM_ID.test(s.id) || !isInt(s.at) || !isInt(s.slot) || !isInt(s.elapsedMs) || !isInt(s.lastValidBlockHeight)) return null;
+  if (!Array.isArray(s.keys) || !(s.keys as unknown[]).every(k => Array.isArray(k) && (k as unknown[]).every(a => a === null || typeof a === 'string'))) return null;
+  if (!Array.isArray(s.outcomes) || !Array.isArray(s.reasons) || !(s.reasons as unknown[]).every(r => typeof r === 'string' && REASONS.includes(r))) return null;
+  const outcomes = (s.outcomes as unknown[]).map(outcomeOf);
+  if (outcomes.some(x => x === null) || outcomes.length !== s.keys.length) return null;
+  return {
+    status: 'ok',
+    sim: {
+      id: s.id,
+      at: s.at,
+      slot: s.slot,
+      elapsedMs: s.elapsedMs,
+      keys: (s.keys as (string | null)[][]).map(k => k.slice()),
+      outcomes: outcomes as TxOutcome[],
+      reasons: (s.reasons as DappReauthReason[]).slice(),
+      lastValidBlockHeight: s.lastValidBlockHeight,
+    },
+  };
+}
````

Change `extension/src/background/dapp/store.ts`:

````diff
diff --git a/extension/src/background/dapp/store.ts b/extension/src/background/dapp/store.ts
index 1184c57..663a30d 100644
--- a/extension/src/background/dapp/store.ts
+++ b/extension/src/background/dapp/store.ts
@@ -5,6 +5,7 @@ import {getSession, sessionMutex} from '../session';
 import {BLOCKED_KEY, blockedOf, type Blocked} from './blocked';
 import {GRANTS_KEY, MAX_GRANTS, grantOf, grantsOf, type Grant} from './grants';
 import {LIMITS_KEY, limitsOf, type Limits} from './limits';
+import {simStateOf, type SimState} from './simulate';
 
 /**
  * The dApp provider's state (spec §1.5, §2). storage.session holds what dies with the session — the request queue,
@@ -51,6 +52,10 @@ export interface Entry {
   transactions: string[] | null;
   /** mismatch (B1c-2): the origin the named account is granted to; else null. */
   granted: string | null;
+  /** A transaction request's newest simulation (simulate.ts) — null before the first one answers. */
+  sim: SimState | null;
+  /** A transaction request's re-authentication challenge (signTx.ts), once Approve asked for one; else null. */
+  challengeId: string | null;
   arrivedAt: number;
   state: 'queued' | 'deciding' | 'answered';
   /** The worker instance that wrote `deciding` (C17): another instance's `deciding` entry is a restart. */
@@ -123,7 +128,10 @@ export function entryOf(x: unknown): Entry | null {
   // B1c-2's fields: absent on an entry an older background wrote (read as null), else exactly their shape.
   const transactions = o.transactions === undefined || o.transactions === null ? null : Array.isArray(o.transactions) && o.transactions.every(isStr) ? (o.transactions as string[]).slice() : undefined;
   const granted = o.granted === undefined ? null : isNullStr(o.granted) ? o.granted : undefined;
-  if (transactions === undefined || granted === undefined) return null;
+  const challengeId = o.challengeId === undefined ? null : isNullStr(o.challengeId) ? o.challengeId : undefined;
+  if (transactions === undefined || granted === undefined || challengeId === undefined) return null;
+  // A simulation that does not read back is simply simulated again (never trusted half-read).
+  const sim = o.sim === undefined || o.sim === null ? null : simStateOf(o.sim);
   if (!isStr(o.state) || !STATES.includes(o.state) || !isNullStr(o.decidedBy) || (o.answeredAt !== null && !isTime(o.answeredAt))) return null;
   if (o.decidingAt !== null && !isTime(o.decidingAt)) return null;
   const decision = decisionOf(o.decision);
@@ -141,6 +149,8 @@ export function entryOf(x: unknown): Entry | null {
     message: o.message,
     transactions,
     granted,
+    sim,
+    challengeId,
     arrivedAt: o.arrivedAt,
     state: o.state as Entry['state'],
     decidedBy: o.decidedBy,
````

Change `extension/src/background/reauthChallenges.ts`:

````diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
index af81732..e410f30 100644
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -2,7 +2,7 @@ import type {Ext} from '../ext';
 import type {WalletDeps} from './deps';
 import {REAUTH_KEY, getSession, sessionMutex} from './session';
 import {randomId} from './digest';
-import type {SendReauthReason} from './reauthPolicy';
+import type {DappReauthReason, SendReauthReason} from './reauthPolicy';
 import type {FeeReason} from '../../../core/fees/transferMarkup';
 
 /** How long the vault page has to prove the factor (brief decision 6), counted from the last prepare of the same intent. */
@@ -38,7 +38,21 @@ export type ChallengeAbout =
       reasons: SendReauthReason[];
       thresholdCents: number;
     }
-  | {kind: 'settings'; autoLockMinutes: number | null; reauthUsdCents: number | null};
+  | {kind: 'settings'; autoLockMinutes: number | null; reauthUsdCents: number | null}
+  /**
+   * B1c-2 (spec B1c §3.3): a dApp's transaction request — the site as the window shows it (host, or host:port), how
+   * many transactions it signs, what leaves the account per mint (null = SOL; positive base units; decimals when known)
+   * and why. Bound to the request and its exact bytes (signTx.ts dappDigest). #10 describes it; the approval window
+   * signs only once the challenge is proven and consumed. `outgoing` holds at most MAX_DAPP_OUTGOING mints (SOL first,
+   * then the largest in USD); `omitted` counts the mints left out (plan 2 review 1 L9: a long list is cut, never refused).
+   */
+  | {kind: 'dapp'; account: string; site: string; transactions: number; outgoing: DappOutgoing[]; omitted: number; reasons: DappReauthReason[]; thresholdCents: number};
+
+export interface DappOutgoing {
+  mint: string | null;
+  amount: string;
+  decimals: number | null;
+}
 
 /** The fields a re-prepare of the same intent may refresh; the identity fields (account, token, recipient, amount) never change. */
 export type SendAboutRefresh = Pick<
@@ -59,6 +73,11 @@ type Store = Map<string, Challenge>;
 const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
 const REASONS: readonly string[] = ['first-send', 'over-5-percent', 'over-usd-threshold', 'whole-balance-to-new'];
 const FEE_REASONS: readonly string[] = ['pre-tge', 'zero-fee-eligible', 'status-unknown', 'charged'];
+const DAPP_REASONS: readonly string[] = [...REASONS, 'approval'];
+/** At most this many mints in a dApp challenge's description (more than a five-transaction batch can name sensibly; the rest are counted in `omitted`). */
+export const MAX_DAPP_OUTGOING = 16;
+/** A site as the window shows it: a host (ASCII / punycode, or an IP literal), with a port when the origin has one. */
+const SITE = /^[A-Za-z0-9.\-[\]:]{1,262}$/;
 const DIGITS = /^\d{1,20}$/;
 /** A base58 Solana address's shape (32–44 characters). */
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
@@ -70,6 +89,30 @@ function isAbout(x: unknown): x is ChallengeAbout {
   if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
   const a = x as Record<string, unknown>;
   if (a.kind === 'settings') return isIntOrNull(a.autoLockMinutes) && isIntOrNull(a.reauthUsdCents) && Object.keys(a).length === 3;
+  if (a.kind === 'dapp') {
+    const outgoing = a.outgoing;
+    const reasons = a.reasons;
+    return (
+      typeof a.account === 'string' &&
+      ADDRESS.test(a.account) &&
+      typeof a.site === 'string' &&
+      SITE.test(a.site) &&
+      isInt(a.transactions) &&
+      a.transactions >= 1 &&
+      a.transactions <= 5 &&
+      Array.isArray(outgoing) &&
+      outgoing.length <= MAX_DAPP_OUTGOING &&
+      (outgoing as unknown[]).every(isOutgoing) &&
+      isInt(a.omitted) &&
+      a.omitted >= 0 &&
+      Array.isArray(reasons) &&
+      reasons.length > 0 &&
+      new Set(reasons).size === reasons.length &&
+      (reasons as unknown[]).every(r => typeof r === 'string' && DAPP_REASONS.includes(r)) &&
+      isInt(a.thresholdCents) &&
+      Object.keys(a).length === 8
+    );
+  }
   if (a.kind !== 'send') return false;
   return (
     typeof a.account === 'string' &&
@@ -90,6 +133,19 @@ function isAbout(x: unknown): x is ChallengeAbout {
   );
 }
 
+function isOutgoing(x: unknown): x is DappOutgoing {
+  if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
+  const o = x as Record<string, unknown>;
+  const decimals = o.decimals;
+  return (
+    (o.mint === null || (typeof o.mint === 'string' && ADDRESS.test(o.mint))) &&
+    typeof o.amount === 'string' &&
+    DIGITS.test(o.amount) &&
+    (decimals === null || (isInt(decimals) && decimals >= 0 && decimals <= 18)) &&
+    Object.keys(o).length === 3
+  );
+}
+
 function isChallenge(x: unknown): x is Challenge {
   if (typeof x !== 'object' || x === null) return false;
   const c = x as Record<string, unknown>;
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run src/background/dapp/__tests__/decide.test.ts src/background/dapp/__tests__/signTx.test.ts src/background/dapp/__tests__/store.test.ts` — expected: Test Files  3 passed (3) · Tests  70 passed (70)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  162 passed (162) · Tests  3186 passed (3186). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M4a | `signTx.ts`: the simulation's id not compared | signTx.test.ts "refused … for another simulation than the newest" and "a refresh that lands between the window's read and its click" — RED Tests  3 failed \| 16 passed (19) |
| M4b | `signTx.ts`: a simulation's age not checked | signTx.test.ts "… for one SIM_VALID_MS old" — RED Tests  1 failed \| 18 passed (19) |
| M4c | `signTx.ts`: a failed simulation approvable | signTx.test.ts "a failed simulation has no approval" — RED Tests  1 failed \| 18 passed (19) |
| M4d | `signTx.ts`: the re-authentication gate always ready | signTx.test.ts "a first send: Approve asks for a challenge" — RED Tests  5 failed \| 14 passed (19) |
| M4e | `decide.ts`: the proof not consumed after `deciding` (the consume replaced by a constant) | signTx.test.ts "a first send" (single use) and "the proof gone between the gate and the consume" — RED Tests  3 failed \| 16 passed (19) |
| M4f | `signTx.ts`: a simulation stored on a decided entry | signTx.test.ts "a simulation that answers after the request was decided is not stored" — RED Tests  1 failed \| 18 passed (19) |
| M4g | `signTx.ts`: no one-at-a-time per request | signTx.test.ts "… one simulation, however many reads" — RED Tests  2 failed \| 17 passed (19) |
| M4h | `signTx.ts`: the effect section checks only the lock (not the account, not the grant) | signTx.test.ts "the account removed from the session while its key is read" — RED Tests  1 failed \| 18 passed (19) |
| M4i | `signTx.ts`: every signature written at slot 0 | signTx.test.ts "… the co-signer's signature kept" and "withSignature writes only the slot it is given" — RED Tests  2 failed \| 17 passed (19) |
| M4j | `decide.ts`: a transaction approval routed past the pre-section (no simulation rows, no gate) | signTx.test.ts "re-authentication …" — RED Tests  5 failed \| 14 passed (19) |
| M4k | `signTx.ts`: the gate consumes the proof itself (rev 1's consume point) | signTx.test.ts "a refresh that lands while the gate reads the proof: stale — the proof is not spent" — RED Tests  3 failed \| 16 passed (19) |
| M4l | `signTx.ts`: `omitted` always 0 | signTx.test.ts "dappAbout: at most MAX_DAPP_OUTGOING mints" — RED Tests  1 failed \| 18 passed (19) |
| M4m | `signTx.ts`: the list not cut at 16 | signTx.test.ts "dappAbout: at most MAX_DAPP_OUTGOING mints" — RED Tests  1 failed \| 18 passed (19) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-2 pending and decide for transactions — the simulation shown is the one approved, B1b's re-authentication gate, signTransaction's effect" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 5: The `signAndSendTransaction` effect: the signed bytes recorded (v1_pending, then the entry) before the broadcast; the restart, dead-effect and lock answers of a recorded send; `v1_dapp_txs` and `wallet.history`'s origin

**Spec:** §1.5 step 2 ("a signAndSendTransaction entry follows B1b's v1_pending pattern"), §3.3 (signAndSend; answered once; the history badge), §5 (the worker dies mid-signature), C11, C17, B1 §3 / §4 (the broadcast route; the dApp confirms); Scope R13–R15, R23

**Files:**
- Test: `extension/e2e/settings.spec.ts`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Test: `extension/src/background/__tests__/fixtures.ts`
- Test: `extension/src/background/__tests__/forgetWallet.test.ts`
- Modify: `extension/src/background/accountsStore.ts`
- Test (new): `extension/src/background/dapp/__tests__/signSend.test.ts`
- Test: `extension/src/background/dapp/__tests__/store.test.ts`
- Create: `extension/src/background/dapp/dappTxs.ts`
- Modify: `extension/src/background/dapp/decide.ts`
- Modify: `extension/src/background/dapp/lockHook.ts`
- Modify: `extension/src/background/dapp/pageApi.ts`
- Modify: `extension/src/background/dapp/queue.ts`
- Modify: `extension/src/background/dapp/signTx.ts`
- Modify: `extension/src/background/dapp/store.ts`
- Modify: `extension/src/background/pending.ts`
- Modify: `extension/src/background/pendingStore.ts`
- Modify: `extension/src/background/walletApi.ts`

**Interfaces:**
- Consumes: Task 4's `signAll`, `stillDeciding`, `txsOf`; B1b's `updatePending`, `deliver`, `startPoller`, `armPendingAlarm`, `firstSignature`, `randomId`.
- Produces:
  - `pendingStore.ts`: `PendingRecord.intent: SendIntent | null`, `PendingRecord.origin: string | null`, `type FirstBroadcast = 'held' | 'due' | 'done'`, `PendingRecord.firstBroadcast: FirstBroadcast` (read as `done` unless a dApp record says `held` / `due`; `PendingView` omits it); `markDue(ext, signatures)`; `inFlightFor` sees the wallet's own sends only.
  - `pending.ts`: `recordDappSend(ext, deps, {account, wire, lastValidBlockHeight, origin}): Promise<PendingRecord>` (`held`); `broadcastFirst(ext, deps, record): Promise<'sent' | 'not-sent'>` (claims `held`/`due` → `done`, then delivers); `dropDappSend(ext, id)`; `pollOnce` first sends every `due` record once (claimed `due` → `done`).
  - `dapp/dappTxs.ts`: `DAPP_TXS_KEY = 'v1_dapp_txs'`, `MAX_DAPP_TXS = 500`, `interface DappTx {signature; origin; at}`, `dappTxsOf`, `withDappTxs`, `dappTxSignatures(ext)`.
  - `store.ts`: `Entry.sent: {wire: string; signature: string} | null`; `Tx.txs: DappTx[]`; `wipeDappStores` removes `v1_dapp_txs` too.
  - `queue.ts`: `restartAnswer(e: Entry): Answer` (the sweep's and the lock hook's answer for a `deciding` entry); `promised(answered): string[]`; `SEND_DECIDING_TTL_MS = 45_000`; `queueAccess` marks the records of the signatures it answers `due` before its commit; the lock hook (`lockHook.ts`) does too before its write-back.
  - `signTx.ts`: `finishSend(ext, deps: WalletDeps, requestId, instance)`; `finishSignTx` lists a transaction the account pays for.
  - `walletApi.ts`: `wallet.history`'s items carry `origin: 'dapp' | null`; `wallet.pending` lists the wallet's own sends only.
  - `accountsStore.ts`: `WALLET_DATA_KEYS` gains `v1_dapp_txs`; the vault-isolation gate's `BACKGROUND_OWNED_KEYS` gains it; E2E spec 15's `WIPED` gains it.

The order is the safety (C17): sign; write the v1_pending record (B1b's pattern — from here the poller watches the bytes); in one section — still this instance's `deciding` entry, unlocked, the account in the session, the grant held — write `sent {wire, signature}` into the entry, list it for the badge and record it on the grant; only then broadcast through the coordinator's route (B1b's `deliver`, its outcome rules unchanged), and answer from a last section that finds the entry still `deciding`. A restart, a dead effect (45 s for a send — above the route's 30 s, R29, review 1 L2) or a lock answers a recorded send `{signature}` — never `rejected`, never signed again — and an unrecorded one `rejected`; bytes written to v1_pending whose request then ended are marked never sent. The page gets `{signature}` once the route accepted it or did not answer (it may land; the dApp confirms), `send-failed` when the route refused it before forwarding (R14, spec rev 3.3 §1.6, review 1 M3).

**Exactly once to the route (review 1 M1, R13).** Rev 1 lost an approved send for good when the worker stopped between the entry's `sent` and the broadcast: the restart answered the page `{signature}`, but nothing ever handed the bytes to the route, and a dApp's record has no "Send again". The record now carries `firstBroadcast`: `held` when written; `due` once a page is promised the signature from the entry's record — `queueAccess` (the sweep's restart and dead-effect answers) and the lock hook mark it inside their section, BEFORE the answer is stored; `done` when claimed — `broadcastFirst` claims `held`/`due`, the poller's first round claims `due`, each in one `updatePending`, and only the claimant delivers. So the bytes reach the route exactly once whoever gets there first, and a record whose request ended any other way (the review's sibling gap: a stop between the record and the entry's `sent`, answered `rejected`) stays `held` and is never sent — it polls to `expired`, "no funds moved", true. The review proposed a `broadcastAttemptedAt` the poller would send whenever it is null; that form would also send the sibling gap's bytes after its page was told `rejected` — the direction worse than the gap (a dApp told "rejected" may ask again, and the user approve twice) — hence the explicit `due`.

- [ ] **Step 1: Write the failing tests.**

Change `extension/e2e/settings.spec.ts`:

````diff
diff --git a/extension/e2e/settings.spec.ts b/extension/e2e/settings.spec.ts
index e7e54d5..f2a411a 100644
--- a/extension/e2e/settings.spec.ts
+++ b/extension/e2e/settings.spec.ts
@@ -21,7 +21,7 @@ const OTHER = 'legal winner thank year wave sausage worth useful legal winner th
 const OTHER_ACCOUNT = 'BLeUXTx9thHGT7VJUtF9vHEmfMDgW1nnKZ9UVer2CoLX';
 const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
 /** What spec 15's delete wipes (spec §8.3), with plan 2's address book (E17, D20) and B1c's dApp grants, blocks and limits (C11, C14). */
-const WIPED = ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_contacts', 'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits', 'v1_balance_cache', 'v1_price_cache'] as const;
+const WIPED = ['v1_vault', 'v1_settings', 'v1_known_recipients', 'v1_contacts', 'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits', 'v1_dapp_txs', 'v1_balance_cache', 'v1_price_cache'] as const;
 
 const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
 const envOf = async (sw: Worker) => (await local(sw, 'v1_vault')) as Env | undefined;
@@ -419,12 +419,14 @@ test('15 · delete a funded wallet: #37 says so and names the lowest index (not
     await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
     expect(await msg(ui, {type: 'contacts.set', address: RECIPIENT, name: 'Marko'})).toEqual({ok: true, data: {created: true}});
     await ui.close();
-    // B1c: a grant, a block and a cooldown, as the background stores them (the dApp flow itself is dapp.spec.ts's).
+    // B1c: a grant, a block and a cooldown, as the background stores them (the dApp flow itself is dapp.spec.ts's);
+    // B1c-2: a transaction a site had signed (the history badge's list).
     await h.sw.evaluate(a =>
       chrome.storage.local.set({
         v1_dapp_grants: [{origin: 'https://jup.ag', account: a, scope: 'persistent', connectedAt: Date.now(), lastUsedAt: Date.now(), recent: []}],
         v1_dapp_blocked: [{host: 'tensr.trade', blockedAt: Date.now(), imitates: 'tensor.trade'}],
         v1_dapp_limits: {rejections: [], cooldowns: [{key: 'host:tensr.trade', until: Date.now() + 600_000}], windows: [], notice: false},
+        v1_dapp_txs: [{signature: '5'.repeat(88), origin: 'https://jup.ag', at: Date.now()}],
       }),
     E2E_ACCOUNTS[0]);
     for (const key of WIPED) await expect.poll(() => local(h.sw, key), {message: key, timeout: 30_000}).toBeDefined();
````

Change `extension/src/background/__tests__/fixtures.ts`:

````diff
diff --git a/extension/src/background/__tests__/fixtures.ts b/extension/src/background/__tests__/fixtures.ts
index 3ef5b00..a35452e 100644
--- a/extension/src/background/__tests__/fixtures.ts
+++ b/extension/src/background/__tests__/fixtures.ts
@@ -107,6 +107,8 @@ export const pendingRecord = (over: Partial<PendingRecord> = {}): PendingRecord
   detail: null,
   detailCode: null,
   intent: {token: 'SOL', recipient: 'R', amount: '1'},
+  origin: null,
+  firstBroadcast: 'done',
   expiryNullSeenAt: null,
   failure: null,
   fee: null,
````

Change `extension/src/background/__tests__/forgetWallet.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/forgetWallet.test.ts b/extension/src/background/__tests__/forgetWallet.test.ts
index 70247f7..e4d129a 100644
--- a/extension/src/background/__tests__/forgetWallet.test.ts
+++ b/extension/src/background/__tests__/forgetWallet.test.ts
@@ -11,6 +11,7 @@ import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../balanceCache';
 import {GRANTS_KEY} from '../dapp/grants';
 import {BLOCKED_KEY} from '../dapp/blocked';
 import {LIMITS_KEY} from '../dapp/limits';
+import {DAPP_TXS_KEY} from '../dapp/dappTxs';
 import {FORBIDDEN_UNTIL_KEY} from '../deps';
 import {AUTOLOCK_ALARM} from '../autolock';
 import {envelopeRevision} from '../../shared/envelopeRevision';
@@ -46,6 +47,7 @@ const REPLACEMENT = {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv:
 const GRANT = {origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []};
 const BLOCK = {host: 'tensr.trade', blockedAt: 1, imitates: 'tensor.trade'};
 const LIMITS = {rejections: [], cooldowns: [{key: 'host:tensr.trade', until: 9e12}], windows: [], notice: false};
+const DAPP_TXS = [{signature: '5'.repeat(88), origin: 'https://jup.ag', at: 1}];
 const zero = () => fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});
 
 async function setup(reader: SolanaReader = zero()) {
@@ -58,6 +60,7 @@ async function setup(reader: SolanaReader = zero()) {
   await ext.local.set(GRANTS_KEY, [GRANT]);
   await ext.local.set(BLOCKED_KEY, [BLOCK]);
   await ext.local.set(LIMITS_KEY, LIMITS);
+  await ext.local.set(DAPP_TXS_KEY, DAPP_TXS);
   await ext.local.set(BALANCE_CACHE_KEY, {});
   await ext.local.set(PRICE_CACHE_KEY, {});
   await ext.local.set(FORBIDDEN_UNTIL_KEY, 123);
@@ -143,8 +146,9 @@ describe('vault.forgetWallet — a delete (no replacement)', () => {
     expect(await vault(ext)).toBeUndefined();
     expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
     expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
-    // B1b-2b E17 (D20): the address book goes with the wallet; B1c (C11, C14): so do the dApp grants, blocks and limits.
-    for (const key of [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) expect(await ext.local.get(key)).toBeUndefined();
+    // B1b-2b E17 (D20): the address book goes with the wallet; B1c (C11, C14): so do the dApp grants, blocks and limits;
+    // B1c-2: and the transactions sites had signed here.
+    for (const key of [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) expect(await ext.local.get(key)).toBeUndefined();
     expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
   });
 
@@ -166,7 +170,7 @@ describe('vault.forgetWallet — a restore (replacement, C4, D40)', () => {
     expect(await ext.local.get(SETTINGS_KEY)).toEqual({autoLockMinutes: 2, reauthUsdCents: 5000, selectedAccount: 1});
     // B1b-2b E17 (D20): a restore keeps the address book; B1c (C11): and the dApp grants, blocks and limits.
     expect(await ext.local.get(CONTACTS_KEY)).toEqual([{address: RECIPIENT, name: 'Marko'}]);
-    expect([await ext.local.get(GRANTS_KEY), await ext.local.get(BLOCKED_KEY), await ext.local.get(LIMITS_KEY)]).toEqual([[GRANT], [BLOCK], LIMITS]);
+    expect([await ext.local.get(GRANTS_KEY), await ext.local.get(BLOCKED_KEY), await ext.local.get(LIMITS_KEY), await ext.local.get(DAPP_TXS_KEY)]).toEqual([[GRANT], [BLOCK], LIMITS, DAPP_TXS]);
     expect(await ext.local.get(BALANCE_CACHE_KEY)).toBeUndefined();
     expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
     expect(await getSession(ext)).toBeNull();
@@ -355,9 +359,10 @@ describe('a first write clears what a crashed delete left behind', () => {
     await ext.local.set(GRANTS_KEY, [GRANT]);
     await ext.local.set(BLOCKED_KEY, [BLOCK]);
     await ext.local.set(LIMITS_KEY, LIMITS);
+    await ext.local.set(DAPP_TXS_KEY, DAPP_TXS);
     expect(await storeEnvelope(ext, null, STORED)).toBe('stored');
-    // B1c: a grant a crashed delete left behind never connects a site to the next wallet.
-    for (const key of [GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY]) expect(await ext.local.get(key)).toBeUndefined();
+    // B1c: a grant a crashed delete left behind never connects a site to the next wallet (B1c-2: nor badges its history).
+    for (const key of [GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY]) expect(await ext.local.get(key)).toBeUndefined();
     expect(await ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
     expect(await ext.local.get(SETTINGS_KEY)).toBeUndefined();
     // B1b-2b E17: a book a crashed delete left behind never reaches the next wallet.
````

Create `extension/src/background/dapp/__tests__/signSend.test.ts`:

````ts
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {AUTOLOCK_ALARM, lock} from '../../autolock';
import {handleMessage} from '../../messages';
import {inFlightFor, readPending} from '../../pendingStore';
import {pollOnce, recordDappSend} from '../../pending';
import {parseWire} from '../decode/wire';
import {signAll} from '../signTx';
import {BROADCAST_TIMEOUT_MS} from '../../deps';
import {GRANTS_KEY, type Grant} from '../grants';
import {DAPP_TXS_KEY} from '../dappTxs';
import {runtimeFor} from '../ports';
import {DAPP_SESSION_KEY, readDappSession} from '../store';
import {DECIDING_TTL_MS, SEND_DECIDING_TTL_MS} from '../queue';
import {BroadcastRejected, BroadcastUnavailable, firstSignature} from '../../../../../core/solana/broadcast';
import {ACCOUNT, RECIPIENT} from '../../__tests__/fixtures';
import {DAPP, ME, coSigned, transfer, txScene, v0} from './txHarness';

/** A scene with a signAndSend request simulated and ready to approve; `broadcast` is what the route does. */
async function ready(broadcast?: (wire: Uint8Array) => Promise<string>, tx = v0([transfer(1_000_000)])) {
  const c = await txScene({known: [RECIPIENT]});
  if (broadcast !== undefined) c.deps.broadcast = broadcast;
  const r = await c.send('s', tx);
  const requestId = String(r?.requestId);
  const simulation = String((await c.simulated()).request?.tx?.simulation.id);
  return {...c, requestId, simulation, go: () => c.approve(requestId, simulation)};
}

// Spec B1c §1.5 step 2, §3.3, C17 — real funds: no double signature, no double broadcast.
describe('page.signAndSendTransaction — the effect', () => {
  it('the signed bytes and the signature are recorded (v1_pending, then the entry) BEFORE the broadcast; the page gets the signature once', async () => {
    const seen: {pending: number; sent: unknown}[] = [];
    let c!: Awaited<ReturnType<typeof ready>>;
    c = await ready(async wire => {
      // What a worker that stopped right now would find: the pending record and the entry's record.
      seen.push({pending: (await readPending(c.ext)).length, sent: (await readDappSession(c.ext)).queue[0]?.sent});
      return firstSignature(wire);
    });
    expect(await c.go()).toEqual({ok: true});
    const [record] = await readPending(c.ext);
    expect(record).toMatchObject({account: ACCOUNT.publicKey, origin: DAPP, intent: null, state: 'pending', lastValidBlockHeight: 5_000});
    const signature = String(record?.signature);
    expect(seen).toEqual([{pending: 1, sent: {wire: record?.wire, signature}}]);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {signature}}]);
    // The signature is the account's, over the dApp's message.
    const tx = VersionedTransaction.deserialize(base64.decode(String(record?.wire)));
    expect(ed25519.verify(base58.decode(signature), tx.message.serialize(), ME.toBytes())).toBe(true);
    // The history badge's list, and the grant's last interactions.
    expect(await c.ext.local.get(DAPP_TXS_KEY)).toEqual([{signature, origin: DAPP, at: c.deps.clock.t}]);
    expect(((await c.ext.local.get(GRANTS_KEY)) as Grant[])[0]?.recent[0]).toEqual({type: 'signAndSendTransaction', at: c.deps.clock.t, outcome: 'approved'});
  });

  it('a dApp’s record is not the wallet’s send: the popup’s pending list omits it, and it blocks no send of the wallet’s own', async () => {
    const c = await ready(async wire => firstSignature(wire));
    await c.go();
    const records = await readPending(c.ext);
    expect(records).toHaveLength(1);
    expect(inFlightFor(records, ACCOUNT.publicKey)).toBeUndefined();
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    expect(await handleMessage(c.ext, {type: 'wallet.pending'}, popup, c.deps)).toEqual({ok: true, data: []});
  });

  it('the route refuses before forwarding (nothing reached the network): send-failed (§1.6, rev 3.3), the record failed not-sent', async () => {
    const c = await ready(async () => {
      throw new BroadcastRejected('rejected', 'Blockhash not found');
    });
    await c.go();
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'send-failed'}]);
    expect((await readPending(c.ext))[0]).toMatchObject({state: 'failed', failure: 'not-sent'});
  });

  it('not acknowledged (it may land): the signature, the record still pending — the dApp confirms (B1 §3)', async () => {
    const c = await ready(async () => {
      throw new BroadcastUnavailable(502);
    });
    await c.go();
    const [record] = await readPending(c.ext);
    expect(record).toMatchObject({state: 'pending', detailCode: 'unacked'});
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {signature: record?.signature}}]);
  });

  it('a co-signed transaction: broadcast with both signatures, the dApp’s untouched', async () => {
    const wires: Uint8Array[] = [];
    const c = await ready(async wire => {
      wires.push(wire);
      return firstSignature(wire);
    }, coSigned());
    await c.go();
    expect(wires).toHaveLength(1);
    const sent = VersionedTransaction.deserialize(wires[0] ?? new Uint8Array());
    expect(sent.signatures[0]).toEqual(VersionedTransaction.deserialize(base64.decode(coSigned())).signatures[0]);
    expect(ed25519.verify(sent.signatures[1] ?? new Uint8Array(), sent.message.serialize(), ME.toBytes())).toBe(true);
    // The id is the fee payer's (the dApp's) signature; the badge list holds it.
    expect(((await c.ext.local.get(DAPP_TXS_KEY)) as {signature: string}[])[0]?.signature).toBe(firstSignature(wires[0] ?? new Uint8Array()));
  });

  it('a restart with the signed bytes recorded: answered the signature from the record — never signed or broadcast again', async () => {
    let broadcasts = 0;
    const c = await ready(async wire => {
      broadcasts++;
      return firstSignature(wire);
    });
    const s = await readDappSession(c.ext);
    const sent = {wire: 'AQ==', signature: '3'.repeat(88)};
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}, sent}))});
    expect(runtimeFor(c.ext).instance).not.toBe('the-dead-instance');
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: sent.signature}}]});
    expect(await c.go()).toEqual({ok: false, error: 'not-head'});
    expect(broadcasts).toBe(0);
  });

  it('a restart before the record: rejected (nothing left the extension) — the mutation "no sent record" would answer a signature never made', async () => {
    const c = await ready(async wire => firstSignature(wire));
    const s = await readDappSession(c.ext);
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}}))});
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, error: 'rejected'}]});
  });

  it('a lock after the record, during the broadcast: the lock answers the signature, the broadcast still runs once, no second answer', async () => {
    let broadcasts = 0;
    let c!: Awaited<ReturnType<typeof ready>>;
    c = await ready(async wire => {
      broadcasts++;
      await lock(c.ext);
      return firstSignature(wire);
    });
    expect(await c.go()).toEqual({ok: true});
    const [record] = await readPending(c.ext);
    expect(broadcasts).toBe(1);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, result: {signature: record?.signature}}]);
  });

  it('a lock between the deciding section and the effect (the auto-lock arm): rejected, nothing signed into v1_pending, nothing broadcast', async () => {
    let broadcasts = 0;
    const c = await ready(async wire => {
      broadcasts++;
      return firstSignature(wire);
    });
    const create = c.ext.alarms.create;
    c.ext.alarms.create = (name, o) => (name === AUTOLOCK_ALARM ? lock(c.ext) : create(name, o));
    expect(await c.go()).toEqual({ok: true});
    expect(broadcasts).toBe(0);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
    expect(await readPending(c.ext)).toEqual([]);
  });

  it('the grant revoked while the key is read: rejected, and the recorded bytes are marked never sent (no broadcast)', async () => {
    let broadcasts = 0;
    const c = await ready(async wire => {
      broadcasts++;
      return firstSignature(wire);
    });
    const get = c.ext.session.get;
    let revoked = false;
    c.ext.session.get = async k => {
      const v = await get(k);
      if (k === 'v1_session' && !revoked && (await readDappSession(c.ext)).queue[0]?.state === 'deciding') {
        revoked = true;
        await c.ext.local.set(GRANTS_KEY, []);
      }
      return v;
    };
    expect(await c.go()).toEqual({ok: true});
    expect(revoked).toBe(true);
    expect(broadcasts).toBe(0);
    expect(c.page.answersFor(c.requestId)).toEqual([{requestId: c.requestId, error: 'rejected'}]);
    expect((await readPending(c.ext))[0]).toMatchObject({state: 'failed', failure: 'not-sent'});
  });

  it('a dead send effect (this instance) with its bytes recorded: still deciding at DECIDING_TTL_MS, answered the signature at SEND_DECIDING_TTL_MS — above the route’s 30 s (review 1 L2)', async () => {
    expect(SEND_DECIDING_TTL_MS).toBeGreaterThan(BROADCAST_TIMEOUT_MS);
    const c = await ready(async wire => firstSignature(wire));
    const s = await readDappSession(c.ext);
    const sent = {wire: 'AQ==', signature: '4'.repeat(88)};
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: runtimeFor(c.ext).instance, decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}, sent}))});
    c.deps.clock.t += DECIDING_TTL_MS;
    // A route call may still be running (BROADCAST_TIMEOUT_MS): not yet a dead effect.
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, pending: true}]});
    c.deps.clock.t += SEND_DECIDING_TTL_MS - DECIDING_TTL_MS;
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: sent.signature}}]});
  });

  /**
   * Review 1 M1: the state a worker stopped at, built from the real pieces — the bytes recorded in v1_pending
   * (recordDappSend), the entry `deciding` by an instance that no longer runs, with or without its `sent` record.
   */
  async function stoppedAt(withSent: boolean) {
    const wires: Uint8Array[] = [];
    const c = await ready(async wire => {
      wires.push(wire);
      return firstSignature(wire);
    });
    const unsigned = base64.decode(String((await readDappSession(c.ext)).queue[0]?.transactions?.[0]));
    const parsed = parseWire(unsigned);
    if (parsed === null) throw new Error('the scene’s transaction does not parse');
    // Signed as the effect signs it (the account's slot), then recorded as the effect records it.
    const [wire = new Uint8Array()] = signAll([unsigned], [parsed], ACCOUNT);
    const record = await recordDappSend(c.ext, c.deps, {account: ACCOUNT.publicKey, wire, lastValidBlockHeight: 5_000, origin: DAPP});
    const s = await readDappSession(c.ext);
    const sent = withSent ? {wire: record.wire, signature: record.signature} : null;
    await c.ext.session.set(DAPP_SESSION_KEY, {...s, queue: s.queue.map(e => ({...e, state: 'deciding', decidedBy: 'the-dead-instance', decidingAt: c.deps.clock.t, decision: {kind: 'approve', account: ACCOUNT.publicKey, scope: null}, sent}))});
    return {...c, wires, record};
  }

  it('a restart after the entry recorded the bytes and before the route: the page is answered the signature, and the bytes reach the route exactly once (the poller’s next round)', async () => {
    const c = await stoppedAt(true);
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('held');
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: c.record.signature}}]});
    // Marked owed before the answer was stored; nothing sent yet.
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('due');
    expect(c.wires).toEqual([]);
    await pollOnce(c.ext, c.deps);
    expect(c.wires.map(w => base64.encode(w))).toEqual([c.record.wire]);
    expect((await readPending(c.ext))[0]).toMatchObject({firstBroadcast: 'done', state: 'pending'});
    // Positive control: a record already handed over is never sent again.
    await pollOnce(c.ext, c.deps);
    await pollOnce(c.ext, c.deps);
    expect(c.wires).toHaveLength(1);
  });

  it('a lock after the entry recorded the bytes, the effect stopped: the lock answers the signature, marks the record due, and the poller sends the bytes once', async () => {
    const c = await stoppedAt(true);
    await lock(c.ext);
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, result: {signature: c.record.signature}}]});
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('due');
    await pollOnce(c.ext, c.deps);
    await pollOnce(c.ext, c.deps);
    expect(c.wires.map(w => base64.encode(w))).toEqual([c.record.wire]);
  });

  it('a stop between the record and the entry’s `sent`: the page is answered rejected, and the recorded bytes never reach the route', async () => {
    const c = await stoppedAt(false);
    expect(await c.page.ask({type: 'page.resume', requestIds: [c.requestId]})).toEqual({resume: [{requestId: c.requestId, error: 'rejected'}]});
    await pollOnce(c.ext, c.deps);
    await pollOnce(c.ext, c.deps);
    expect(c.wires).toEqual([]);
    // Held, never owed: it polls until it expires ("Not confirmed — no funds moved", true).
    expect((await readPending(c.ext))[0]).toMatchObject({firstBroadcast: 'held', state: 'pending'});
  });

  it('the effect and the poller never both send: a normal approval hands the bytes over once, and a lock’s `due` during the broadcast adds no second one', async () => {
    let c!: Awaited<ReturnType<typeof ready>>;
    let broadcasts = 0;
    c = await ready(async wire => {
      broadcasts++;
      // The lock marks the record due while the effect's broadcast runs; the poller runs too.
      await lock(c.ext);
      await pollOnce(c.ext, c.deps);
      return firstSignature(wire);
    });
    expect(await c.go()).toEqual({ok: true});
    await pollOnce(c.ext, c.deps);
    expect(broadcasts).toBe(1);
    expect((await readPending(c.ext))[0]?.firstBroadcast).toBe('done');
  });
});

describe('the history badge (#26b, #27b)', () => {
  it('signTransaction: a transaction the account pays for is listed by its id; one another signer pays for is not', async () => {
    const c = await txScene({known: [RECIPIENT]});
    const r = await c.signTx('t', [v0(), coSigned()]);
    const id = (await c.simulated()).request?.tx?.simulation.id;
    await c.approve(String(r?.requestId), id);
    const signed = (c.page.answersFor(String(r?.requestId))[0]?.result as {signed: string[]}).signed;
    expect(await c.ext.local.get(DAPP_TXS_KEY)).toEqual([{signature: firstSignature(base64.decode(signed[0] ?? '')), origin: DAPP, at: c.deps.clock.t}]);
  });

  it('wallet.history marks a listed signature origin "dapp", every other row null', async () => {
    const c = await txScene();
    const listed = '2'.repeat(88);
    const other = '3'.repeat(88);
    await c.ext.local.set(DAPP_TXS_KEY, [{signature: listed, origin: DAPP, at: 1}]);
    c.deps.reader.getSignaturesForAddress = async () => [
      {signature: listed, blockTime: 1, err: null},
      {signature: other, blockTime: 1, err: null},
    ];
    c.deps.reader.getTransaction = async () => ({blockTime: 1, meta: {err: null, fee: 5000, preBalances: [], postBalances: [], preTokenBalances: [], postTokenBalances: []}, transaction: {message: {accountKeys: [], instructions: []}}});
    // History paces its getTransaction calls (two a second) with deps.sleep; nothing else runs here.
    c.deps.sleep = async () => undefined;
    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
    const r = (await handleMessage(c.ext, {type: 'wallet.history', account: ACCOUNT.publicKey}, popup, c.deps)) as {ok: true; data: {items: {signature: string; origin: unknown}[]}};
    expect(r.data.items.map(i => [i.signature, i.origin])).toEqual([
      [listed, 'dapp'],
      [other, null],
    ]);
  });
});
````

Change `extension/src/background/dapp/__tests__/store.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/store.test.ts b/extension/src/background/dapp/__tests__/store.test.ts
index d21a0de..8f1787e 100644
--- a/extension/src/background/dapp/__tests__/store.test.ts
+++ b/extension/src/background/dapp/__tests__/store.test.ts
@@ -10,7 +10,7 @@ const T = 1_000_000_000;
 const grant = (origin: string, over: Partial<Grant> = {}): Grant => ({origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: T, lastUsedAt: T, recent: [], ...over});
 const entry = (over: Partial<Entry> = {}): Entry => ({
   requestId: 'r1', pageId: 'p1', origin: 'https://dapp.test', host: 'dapp.test', tabId: 7, documentId: null, type: 'connect', account: null,
-  message: null, transactions: null, granted: null, sim: null, challengeId: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null, decision: null, answer: null, answeredAt: null, ...over,
+  message: null, transactions: null, granted: null, sim: null, challengeId: null, sent: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null, decision: null, answer: null, answeredAt: null, ...over,
 });
 
 // Spec §2.1, §2.6, C14 — the stores the request lifecycle writes, and the one section that writes them.
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/background/__tests__/forgetWallet.test.ts src/background/dapp/__tests__/signSend.test.ts src/background/dapp/__tests__/store.test.ts`

Expected (the dry run): Test Files  3 failed (3) · Tests  3 failed | 11 passed (14)

- [ ] **Step 3: Implement.**

Change `extension/scripts/check-vault-isolation.mjs`:

````diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
index 42e1eed..28aa342 100644
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -96,9 +96,10 @@ const withoutPortListeners = text => PORT_LISTENER_SPELLINGS.reduce((t, re) => t
 // B1b-2a E4 adds the two caches: a popup writing one could show a balance the chain never had.
 // B1b-2b E17: the address book (v1_contacts) is the background's too — the popup reaches it only through contacts.*.
 // B1c (spec §2.1, review 1 L4): the dApp grants, blocked sites and limits — a page writing a grant would connect a site.
+// B1c-2: the transactions sites had signed here (v1_dapp_txs) — a page writing one would badge a row as a dApp's.
 export const BACKGROUND_OWNED_KEYS = [
   'v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache', 'v1_contacts',
-  'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits',
+  'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits', 'v1_dapp_txs',
 ];
 const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
 // The vault page renders only fixed strings and the user's own words, as text (B1b-2a §1.2 item 3):
````

Change `extension/src/background/accountsStore.ts`:

````diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index 41a631c..c5690ac 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -11,6 +11,7 @@ import {clearCaches} from './balanceCache';
 import {GRANTS_KEY} from './dapp/grants';
 import {BLOCKED_KEY} from './dapp/blocked';
 import {LIMITS_KEY} from './dapp/limits';
+import {DAPP_TXS_KEY} from './dapp/dappTxs';
 import {wipeDappStores} from './dapp/store';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, accountsPolicyOk, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
@@ -47,10 +48,10 @@ const serial = createMutex();
  * dApp grants, blocked sites and rejection limits (spec C11, C14: wiped by a delete, kept by a restore).
  * `v1_forbidden_until` is not the wallet's (the coordinator's verdict) and is kept.
  */
-export const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY];
-/** The three dApp keys among WALLET_DATA_KEYS: removed only through wipeDappStores (fix round 1, IMPORTANT 1) —
- * never by a plain ext.local.remove, which an in-flight dappSection's write-back could undo. */
-const DAPP_DATA_KEYS: ReadonlySet<string> = new Set([GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY]);
+export const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY];
+/** The dApp keys among WALLET_DATA_KEYS (B1c-2: v1_dapp_txs too): removed only through wipeDappStores (fix round 1,
+ * IMPORTANT 1) — never by a plain ext.local.remove, which an in-flight dappSection's write-back could undo. */
+const DAPP_DATA_KEYS: ReadonlySet<string> = new Set([GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY]);
 async function removeWalletData(ext: Ext): Promise<void> {
   for (const key of WALLET_DATA_KEYS) if (!DAPP_DATA_KEYS.has(key)) await ext.local.remove(key);
   await wipeDappStores(ext);
````

Create `extension/src/background/dapp/dappTxs.ts`:

````ts
import type {Ext} from '../../ext';

/**
 * The transactions a site had this wallet sign (spec B1c §3.3: "The sent transaction appears in #26 with the design's
 * 'Dapp · simulated' origin badge"; index.html #26b, #27b): each one's id — its first signature, the fee payer's —
 * the origin, and when. Written by the signAndSendTransaction effect when it records the signed bytes, and by the
 * signTransaction effect for each transaction the account pays for (its id is then the account's own signature — the
 * dApp may broadcast it); never for a signature another signer made. History reads it to badge a row (history.ts).
 * storage.local, background-owned (v1_dapp_txs), newest first, at most MAX_DAPP_TXS; every write inside store.ts's
 * dappSection (dappMutex → sessionMutex); wiped by a delete, kept by a restore (C11, as the grants).
 */
export const DAPP_TXS_KEY = 'v1_dapp_txs';
export const MAX_DAPP_TXS = 500;

export interface DappTx {
  signature: string;
  origin: string;
  at: number;
}

const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const ORIGIN = /^https:\/\/[^\s/?#@]+$/;

/** The stored list, re-validated, fresh objects, newest first; anything else reads as none. */
export function dappTxsOf(x: unknown): DappTx[] {
  if (!Array.isArray(x)) return [];
  const out: DappTx[] = [];
  const seen = new Set<string>();
  for (const item of x as unknown[]) {
    if (out.length >= MAX_DAPP_TXS) break;
    if (typeof item !== 'object' || item === null) continue;
    const {signature, origin, at} = item as Record<string, unknown>;
    if (typeof signature !== 'string' || !SIGNATURE.test(signature) || seen.has(signature)) continue;
    if (typeof origin !== 'string' || !ORIGIN.test(origin) || typeof at !== 'number' || !Number.isSafeInteger(at) || at < 0) continue;
    seen.add(signature);
    out.push({signature, origin, at});
  }
  return out;
}

/** The list with these transactions first (a signature already listed moves to the front); at most MAX_DAPP_TXS. */
export function withDappTxs(list: readonly DappTx[], added: readonly DappTx[]): DappTx[] {
  const ids = new Set(added.map(t => t.signature));
  return [...added, ...list.filter(t => !ids.has(t.signature))].slice(0, MAX_DAPP_TXS);
}

/** History's read (read-only, no section needed): which signatures a site had signed here. */
export async function dappTxSignatures(ext: Ext): Promise<Set<string>> {
  return new Set(dappTxsOf(await ext.local.get(DAPP_TXS_KEY)).map(t => t.signature));
}
````

Change `extension/src/background/dapp/decide.ts`:

````diff
diff --git a/extension/src/background/dapp/decide.ts b/extension/src/background/dapp/decide.ts
index c372f8b..970f514 100644
--- a/extension/src/background/dapp/decide.ts
+++ b/extension/src/background/dapp/decide.ts
@@ -14,7 +14,7 @@ import {answer, headOf, isOpenEntry, queueAccess, rejectQueued, userRejected, ty
 import {dropGrant, grantIn, putGrant, readDappSession, type Decision, type Entry, type Tx} from './store';
 import {base64} from '@scure/base';
 import {checkMessage, checkSiws, finishSign, homoglyphRanges, keywordIn} from './signMessage';
-import {dappDigest, finishSignTx, isTxType, needsSimulation, reauthGate, runSimulation, txDetail, txRefused, type TxDetail, type TxRefusal} from './signTx';
+import {dappDigest, finishSend, finishSignTx, isTxType, needsSimulation, reauthGate, runSimulation, txDetail, txRefused, type TxDetail, type TxRefusal} from './signTx';
 import {consumeChallenge} from '../reauthChallenges';
 
 /**
@@ -326,8 +326,6 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
       blockHost(tx, fx, e.host);
       return 'done';
     }
-    // Task 5 gives signAndSendTransaction its effect.
-    if (e.type === 'signAndSendTransaction') return 'malformed';
     const refused = approvalRefused(tx, e, d) ?? (isTxType(e.type) ? txRefused(e, d.simulation, tx.now) : null);
     if (refused !== null) return refused;
     e.state = 'deciding';
@@ -350,7 +348,12 @@ export async function decide(ext: Ext, deps: WalletDeps, d: DecideRequest): Prom
   if ((await getSession(ext)) !== null) await armAutolock(ext).catch(e => console.warn('dApp decide: the idle timer was not re-armed', e));
   if (typeof out === 'object') {
     // Each approvable type's effect, by name: a type with none (a mismatch notice — refused above) can never fall into another's.
-    const effects: Partial<Record<Entry['type'], (ext: Ext, deps: WalletDeps, requestId: string, instance: string) => Promise<void>>> = {connect: finishConnect, signMessage: finishSign, signTransaction: finishSignTx};
+    const effects: Partial<Record<Entry['type'], (ext: Ext, deps: WalletDeps, requestId: string, instance: string) => Promise<void>>> = {
+      connect: finishConnect,
+      signMessage: finishSign,
+      signTransaction: finishSignTx,
+      signAndSendTransaction: finishSend,
+    };
     await effects[out.approved]?.(ext, deps, d.requestId, instance);
   }
   return {ok: true};
````

Change `extension/src/background/dapp/lockHook.ts`:

````diff
diff --git a/extension/src/background/dapp/lockHook.ts b/extension/src/background/dapp/lockHook.ts
index 2da195c..f90d6b6 100644
--- a/extension/src/background/dapp/lockHook.ts
+++ b/extension/src/background/dapp/lockHook.ts
@@ -3,6 +3,8 @@ import {BLOCKED_KEY, blockedOf, isBlocked} from './blocked';
 import {GRANTS_KEY, MAX_GRANTS, grantsOf} from './grants';
 import {deliver, liveOrigins, runtimeFor, sendChange} from './ports';
 import {DAPP_SESSION_KEY, EMPTY_SESSION, readDappSession, type Entry} from './store';
+import {promised, restartAnswer} from './queue';
+import {markDue} from '../pendingStore';
 
 /**
  * The lock hook (spec §2.4, review H3, review 2 M6). autolock.ts's lock() IS the hook: every lock — the auto-lock
@@ -11,7 +13,8 @@ import {DAPP_SESSION_KEY, EMPTY_SESSION, readDappSession, type Entry} from './st
  *  1. read the queue, the recorded window and which open ports' origins hold a grant;
  *  2. clear the session (keys, session grants, queue, undo buffer);
  *  3. write back the answered entries plus every formerly open entry answered `rejected` (a `deciding` one as a
- *     restart, §1.5 — nothing has left the extension), so a relay's resume still finds them;
+ *     restart, §1.5 — nothing has left the extension; B1c-2: a send with its signed bytes recorded is answered its
+ *     signature instead), so a relay's resume still finds them;
  * then, outside it: 4. close the approval window (errors ignored); 5. deliver the answers and send `change []` to the
  * ports of origins that held a grant — and only to those (review M3: an ungranted page learns nothing of lock timing),
  * never a blocked host's (final review m1).
@@ -59,10 +62,14 @@ export async function lockInSection(ext: Ext, now: number): Promise<LockOutcome>
   const answered: Entry[] = [];
   const kept = s.queue.map(e => {
     if (e.state === 'answered') return e;
-    const done: Entry = {...e, state: 'answered', answer: {error: 'rejected'}, answeredAt: now};
+    // A send whose signed bytes are recorded is answered its signature (B1c-2, C17): the broadcast still runs.
+    const done: Entry = {...e, state: 'answered', answer: e.state === 'deciding' ? restartAnswer(e) : {error: 'rejected'}, answeredAt: now};
     answered.push(done);
     return done;
   });
+  // Review 1 M1: a send answered its signature here is owed to the route before the answer is written back. A failed
+  // write is logged and the answer kept: the effect still running broadcasts it (R15); only a stopped one leaves it unsent.
+  await markDue(ext, promised(answered)).catch(e => console.warn('dApp lock hook: a promised send was not marked due', e));
   if (kept.length > 0) await ext.session.set(DAPP_SESSION_KEY, {...EMPTY_SESSION, queue: kept});
   return {windowId: s.window?.id ?? null, answered, notify};
 }
````

Change `extension/src/background/dapp/pageApi.ts`:

````diff
diff --git a/extension/src/background/dapp/pageApi.ts b/extension/src/background/dapp/pageApi.ts
index 3edd97f..ac857d4 100644
--- a/extension/src/background/dapp/pageApi.ts
+++ b/extension/src/background/dapp/pageApi.ts
@@ -75,6 +75,7 @@ function enqueue(tx: Tx, deps: Pick<WalletDeps, 'randomBytes'>, live: LivePort,
     granted: null,
     sim: null,
     challengeId: null,
+    sent: null,
     ...fields,
     arrivedAt: tx.now,
     state: 'queued',
````

Change `extension/src/background/dapp/queue.ts`:

````diff
diff --git a/extension/src/background/dapp/queue.ts b/extension/src/background/dapp/queue.ts
index 1515537..85bf18a 100644
--- a/extension/src/background/dapp/queue.ts
+++ b/extension/src/background/dapp/queue.ts
@@ -5,6 +5,7 @@ import {deliver, runtimeFor, sendChange, type PageOrigin, type Runtime} from './
 import {withRecent} from './grants';
 import {withRejection} from './limits';
 import {dappSection, grantIn, putGrant, type Answer, type Entry, type Tx} from './store';
+import {markDue} from '../pendingStore';
 import {unlockWork} from './unlockHook';
 
 /**
@@ -21,6 +22,12 @@ export const REQUEST_TTL_MS = 5 * 60_000;
  * answered `rejected` (nothing left the extension), so the queue, the window and the page move on.
  */
 export const DECIDING_TTL_MS = 30_000;
+/**
+ * B1c-2 (plan 2 review 1 L2): a `signAndSendTransaction` effect waits on the broadcast route, which may take up to
+ * BROADCAST_TIMEOUT_MS (30 s): its dead-effect TTL is above that, so the sweep never answers a send while its route call
+ * may still be running.
+ */
+export const SEND_DECIDING_TTL_MS = 45_000;
 export const ANSWER_TTL_MS = 10 * 60_000;
 /** "Open" = queued or deciding (C3); at most this many in total — the next gets `busy`. */
 export const MAX_OPEN = 5;
@@ -64,6 +71,13 @@ export function userRejected(tx: Tx, fx: Effects, e: Entry): void {
   if (g !== null && e.type !== 'mismatch') putGrant(tx, withRecent(g, e.type, tx.now, 'rejected'));
 }
 
+/** What a `deciding` entry that will never finish is answered (a restart, a dead effect, a lock — C17). */
+export const restartAnswer = (e: Entry): Answer => (e.sent !== null ? {result: {signature: e.sent.signature}} : {error: 'rejected'});
+
+/** The signatures these answers promise a page: a send answered from the bytes its entry recorded (review 1 M1). */
+export const promised = (answered: readonly Entry[]): string[] =>
+  answered.flatMap(e => (e.sent !== null && e.answer !== null && 'result' in e.answer && e.answer.result.signature === e.sent.signature ? [e.sent.signature] : []));
+
 /** Answers an origin's `queued` entries (never a `deciding` one: its effect is running) with this error. */
 export function rejectQueued(tx: Tx, fx: Effects, match: (e: Entry) => boolean, code: 'rejected' = 'rejected'): void {
   for (const e of tx.s.queue) if (e.state === 'queued' && match(e)) answer(fx, e, {error: code}, tx.now);
@@ -86,8 +100,11 @@ export function sweep(tx: Tx, fx: Effects, rt: Pick<Runtime, 'instance' | 'hooke
   for (const e of tx.s.queue) {
     // C4 "queued or shown": five minutes from arrivedAt, whatever the open state (review 1 M1).
     if (isOpenEntry(e) && tx.now - e.arrivedAt >= REQUEST_TTL_MS) answer(fx, e, {error: 'timeout'}, tx.now);
-    // C17: another instance's `deciding` is a restart; this instance's, DECIDING_TTL_MS after it was written, a dead effect.
-    else if (e.state === 'deciding' && (e.decidedBy !== instance || e.decidingAt === null || tx.now - e.decidingAt >= DECIDING_TTL_MS)) answer(fx, e, {error: 'rejected'}, tx.now);
+    // C17: another instance's `deciding` is a restart; this instance's, DECIDING_TTL_MS after it was written, a dead
+    // effect — answered `rejected` (nothing left the extension), except a send whose signed bytes are recorded (B1c-2,
+    // §1.5 step 2): it is answered its signature, and the poller watches its pending record — never signed or
+    // broadcast again.
+    else if (e.state === 'deciding' && (e.decidedBy !== instance || e.decidingAt === null || tx.now - e.decidingAt >= (e.type === 'signAndSendTransaction' ? SEND_DECIDING_TTL_MS : DECIDING_TTL_MS))) answer(fx, e, restartAnswer(e), tx.now);
   }
   // §2.4: the unlock hook, on the first access of an unlocked session (again if it threw last time) — after expiry
   // above, so it never grants a connect the sweep just timed out.
@@ -124,6 +141,9 @@ export async function queueAccess<T>(ext: Ext, deps: Pick<WalletDeps, 'now'>, fn
     out = await dappSection(ext, deps.now(), async tx => {
       hooked = sweep(tx, fx, rt);
       const r = await fn(tx, fx);
+      // Review 1 M1: a send answered its signature here (the sweep's restart or dead effect, or the effect itself) —
+      // its pending record becomes owed to the route BEFORE the answer is stored (the poller sends a `due` one, once).
+      await markDue(ext, promised(fx.answered));
       queued = tx.s.queue.length > 0;
       // Review 1 L6: inside the section (under sessionMutex), so a lock — which clears the flag in its own section —
       // can never run between the hook's commit and this write.
````

Change `extension/src/background/dapp/signTx.ts`:

````diff
diff --git a/extension/src/background/dapp/signTx.ts b/extension/src/background/dapp/signTx.ts
index 5eeea39..2225213 100644
--- a/extension/src/background/dapp/signTx.ts
+++ b/extension/src/background/dapp/signTx.ts
@@ -12,6 +12,9 @@ import {decodeInstructions, type DecodedInstruction} from './decode/decode';
 import {resolveKeys} from './decode/keys';
 import {parseWire, type ParsedTx} from './decode/wire';
 import {withRecent} from './grants';
+import {withDappTxs} from './dappTxs';
+import {broadcastFirst, dropDappSend, recordDappSend} from '../pending';
+import {firstSignature} from '../../../../core/solana/broadcast';
 import {runtimeFor} from './ports';
 import {answer, queueAccess} from './queue';
 import {simulateTransactions, type SimState, type TxOutcome} from './simulate';
@@ -290,6 +293,73 @@ export async function finishSignTx(ext: Ext, deps: Pick<WalletDeps, 'now'>, requ
     }
     const g = grantIn(tx, e.origin);
     if (g !== null) putGrant(tx, withRecent(g, 'signTransaction', tx.now, 'approved'));
+    // The history badge (#26): a transaction the account pays for is identified by the account's own signature.
+    const paid = work.txs.flatMap((p, i) => {
+      const w = signed?.[i];
+      return p.signers[0] === work.account && w !== undefined ? [{signature: firstSignature(base64.decode(w)), origin: e.origin, at: tx.now}] : [];
+    });
+    if (paid.length > 0) tx.txs = withDappTxs(tx.txs, paid);
     answer(fx, e, {result: {signed}}, tx.now);
   });
 }
+
+/**
+ * page.signAndSendTransaction's effect (spec §1.5 step 2, §3.3; C17 — real funds: no double signature, no double
+ * broadcast), after the `deciding` section:
+ *  1. read the key and sign (the dApp's bytes, the account's slot);
+ *  2. record the signed bytes in v1_pending (B1b's pattern: the confirmation poller watches them from here on);
+ *  3. in one section, still this instance's `deciding` entry, unlocked, the account in the session, the grant held:
+ *     write `sent {wire, signature}` into the entry — from here a lock or a restart answers `{signature}` and never
+ *     signs or broadcasts again (lockHook.ts, queue.ts sweep) — and badge the transaction for #26. If that section
+ *     refuses, the entry is answered `rejected` and the recorded bytes are marked never sent;
+ *  4. broadcast through the coordinator's route (pending.ts broadcastFirst) — even if a lock landed after step 3: the
+ *     user approved it, the dApp may already hold the signature (B1b: a send in flight is not cancelled by a lock);
+ *  5. answer `{signature}` — or, when the route refused it before forwarding (nothing reached the network),
+ *     `send-failed` (spec §1.6, rev 3.3) — only if the entry is still this instance's `deciding` one (a lock or the
+ *     dead-effect sweep may have answered `{signature}` already: answered once).
+ * A worker stopped between steps 3 and 4 (review 1 M1): the restart answers `{signature}` from the entry, marking the
+ * record `due` first, and the poller's next round hands the bytes to the route — once (pending.ts claimFirst).
+ */
+export async function finishSend(ext: Ext, deps: WalletDeps, requestId: string, instance: string): Promise<void> {
+  const work = await queueAccess(ext, deps, tx => {
+    const e = tx.s.queue.find(x => x.requestId === requestId);
+    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.type !== 'signAndSendTransaction' || e.account === null || e.sim?.status !== 'ok') return null;
+    const parsed = txsOf(e);
+    return parsed === null || parsed.wires.length !== 1 ? null : {account: e.account, origin: e.origin, lastValidBlockHeight: e.sim.sim.lastValidBlockHeight, ...parsed};
+  });
+  if (work === null) return;
+  const key = (await getSession(ext))?.find(a => a.publicKey === work.account);
+  let wire: Uint8Array | null = null;
+  if (key !== undefined) {
+    try {
+      wire = signAll(work.wires, work.txs, key)[0] ?? null;
+    } catch {
+      wire = null;
+    }
+  }
+  const signed = wire;
+  const record = signed === null ? null : await recordDappSend(ext, deps, {account: work.account, wire: signed, lastValidBlockHeight: work.lastValidBlockHeight, origin: work.origin});
+  const recorded = await queueAccess(ext, deps, (tx, fx) => {
+    const e = tx.s.queue.find(x => x.requestId === requestId);
+    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance) return false;
+    if (signed === null || record === null || !stillDeciding(tx, e, instance, work.account)) {
+      answer(fx, e, {error: 'rejected'}, tx.now);
+      return false;
+    }
+    e.sent = {wire: base64.encode(signed), signature: record.signature};
+    const g = grantIn(tx, e.origin);
+    if (g !== null) putGrant(tx, withRecent(g, 'signAndSendTransaction', tx.now, 'approved'));
+    tx.txs = withDappTxs(tx.txs, [{signature: record.signature, origin: e.origin, at: tx.now}]);
+    return true;
+  });
+  if (!recorded) {
+    if (record !== null) await dropDappSend(ext, record.id);
+    return;
+  }
+  const outcome = record === null ? 'not-sent' : await broadcastFirst(ext, deps, record);
+  await queueAccess(ext, deps, (tx, fx) => {
+    const e = tx.s.queue.find(x => x.requestId === requestId);
+    if (e === undefined || e.state !== 'deciding' || e.decidedBy !== instance || e.sent === null) return;
+    answer(fx, e, outcome === 'sent' ? {result: {signature: e.sent.signature}} : {error: 'send-failed'}, tx.now);
+  });
+}
````

Change `extension/src/background/dapp/store.ts`:

````diff
diff --git a/extension/src/background/dapp/store.ts b/extension/src/background/dapp/store.ts
index 663a30d..88e8f5b 100644
--- a/extension/src/background/dapp/store.ts
+++ b/extension/src/background/dapp/store.ts
@@ -6,6 +6,7 @@ import {BLOCKED_KEY, blockedOf, type Blocked} from './blocked';
 import {GRANTS_KEY, MAX_GRANTS, grantOf, grantsOf, type Grant} from './grants';
 import {LIMITS_KEY, limitsOf, type Limits} from './limits';
 import {simStateOf, type SimState} from './simulate';
+import {DAPP_TXS_KEY, dappTxsOf, type DappTx} from './dappTxs';
 
 /**
  * The dApp provider's state (spec §1.5, §2). storage.session holds what dies with the session — the request queue,
@@ -56,6 +57,8 @@ export interface Entry {
   sim: SimState | null;
   /** A transaction request's re-authentication challenge (signTx.ts), once Approve asked for one; else null. */
   challengeId: string | null;
+  /** signAndSendTransaction: the signed bytes and their signature, recorded BEFORE the broadcast (C17, §1.5 step 2); else null. */
+  sent: {wire: string; signature: string} | null;
   arrivedAt: number;
   state: 'queued' | 'deciding' | 'answered';
   /** The worker instance that wrote `deciding` (C17): another instance's `deciding` entry is a restart. */
@@ -119,6 +122,13 @@ function decisionOf(x: unknown): Entry['decision'] | undefined {
   return {kind: o.kind as Decision, account: o.account, scope: o.scope};
 }
 
+/** A recorded send: exactly two strings (undefined: anything else — the entry is then dropped, never half-read). */
+function sentOf(x: unknown): Entry['sent'] | undefined {
+  if (typeof x !== 'object' || x === null) return undefined;
+  const {wire, signature} = x as Record<string, unknown>;
+  return isStr(wire) && isStr(signature) ? {wire, signature} : undefined;
+}
+
 /** A stored entry, rebuilt field by field; null when anything is off (it is dropped, never "repaired"). */
 export function entryOf(x: unknown): Entry | null {
   if (typeof x !== 'object' || x === null) return null;
@@ -132,6 +142,8 @@ export function entryOf(x: unknown): Entry | null {
   if (transactions === undefined || granted === undefined || challengeId === undefined) return null;
   // A simulation that does not read back is simply simulated again (never trusted half-read).
   const sim = o.sim === undefined || o.sim === null ? null : simStateOf(o.sim);
+  const sent = o.sent === undefined || o.sent === null ? null : sentOf(o.sent);
+  if (sent === undefined) return null;
   if (!isStr(o.state) || !STATES.includes(o.state) || !isNullStr(o.decidedBy) || (o.answeredAt !== null && !isTime(o.answeredAt))) return null;
   if (o.decidingAt !== null && !isTime(o.decidingAt)) return null;
   const decision = decisionOf(o.decision);
@@ -151,6 +163,7 @@ export function entryOf(x: unknown): Entry | null {
     granted,
     sim,
     challengeId,
+    sent,
     arrivedAt: o.arrivedAt,
     state: o.state as Entry['state'],
     decidedBy: o.decidedBy,
@@ -191,6 +204,8 @@ export interface Tx {
   grants: Grant[];
   blocked: Blocked[];
   limits: Limits;
+  /** B1c-2: the transactions sites had signed here (dappTxs.ts), newest first. */
+  txs: DappTx[];
   /** The unlocked session's accounts, or null while locked — as of this section. */
   session: SessionAccount[] | null;
   now: number;
@@ -201,27 +216,29 @@ const dappMutex = createMutex();
 export async function dappSection<T>(ext: Ext, now: number, fn: (tx: Tx) => Promise<T> | T): Promise<T> {
   return dappMutex(() =>
     sessionMutex(async () => {
-      const [s, grants, blocked, limits, session] = await Promise.all([
+      const [s, grants, blocked, limits, txs, session] = await Promise.all([
         readDappSession(ext),
         ext.local.get(GRANTS_KEY),
         ext.local.get(BLOCKED_KEY),
         ext.local.get(LIMITS_KEY),
+        ext.local.get(DAPP_TXS_KEY),
         getSession(ext),
       ]);
-      const tx: Tx = {s, grants: grantsOf(grants, 'persistent', MAX_GRANTS), blocked: blockedOf(blocked), limits: limitsOf(limits, now), session, now};
-      const before = {s: JSON.stringify(tx.s), grants: JSON.stringify(tx.grants), blocked: JSON.stringify(tx.blocked), limits: JSON.stringify(tx.limits)};
+      const tx: Tx = {s, grants: grantsOf(grants, 'persistent', MAX_GRANTS), blocked: blockedOf(blocked), limits: limitsOf(limits, now), txs: dappTxsOf(txs), session, now};
+      const before = {s: JSON.stringify(tx.s), grants: JSON.stringify(tx.grants), blocked: JSON.stringify(tx.blocked), limits: JSON.stringify(tx.limits), txs: JSON.stringify(tx.txs)};
       const out = await fn(tx);
       if (JSON.stringify(tx.s) !== before.s) await ext.session.set(DAPP_SESSION_KEY, tx.s);
       if (JSON.stringify(tx.grants) !== before.grants) await ext.local.set(GRANTS_KEY, tx.grants);
       if (JSON.stringify(tx.blocked) !== before.blocked) await ext.local.set(BLOCKED_KEY, tx.blocked);
       if (JSON.stringify(tx.limits) !== before.limits) await ext.local.set(LIMITS_KEY, tx.limits);
+      if (JSON.stringify(tx.txs) !== before.txs) await ext.local.set(DAPP_TXS_KEY, tx.txs);
       return out;
     }),
   );
 }
 
 /**
- * Removes the three dApp-owned storage.local keys, under the same lock order a dappSection uses (fix round 1,
+ * Removes the dApp-owned storage.local keys (B1c-2: four — v1_dapp_txs too), under the same lock order a dappSection uses (fix round 1,
  * IMPORTANT 1): accountsStore's removeWalletData (forgetWallet step 7, and storeEnvelope's first-write backstop)
  * used to remove them with a plain `ext.local.remove`, outside dappMutex and sessionMutex — a dappSection already
  * in flight reads the old lists before the remove and writes them back (unchanged, or changed by the caller's own
@@ -237,6 +254,7 @@ export async function wipeDappStores(ext: Ext): Promise<void> {
       await ext.local.remove(GRANTS_KEY);
       await ext.local.remove(BLOCKED_KEY);
       await ext.local.remove(LIMITS_KEY);
+      await ext.local.remove(DAPP_TXS_KEY);
     }),
   );
 }
````

Change `extension/src/background/pending.ts`:

````diff
diff --git a/extension/src/background/pending.ts b/extension/src/background/pending.ts
index 9b74f0e..80c181e 100644
--- a/extension/src/background/pending.ts
+++ b/extension/src/background/pending.ts
@@ -4,7 +4,7 @@ import type {WalletDeps} from './deps';
 import {addKnownRecipient} from './knownRecipients';
 import {readWalletView} from './accountsStore';
 import {randomId} from './digest';
-import {inFlightFor, isOpen, readPending, updatePending, viewOf, type PendingFee, type PendingRecord, type PendingView} from './pendingStore';
+import {inFlightFor, isOpen, readPending, updatePending, viewOf, type FirstBroadcast, type PendingFee, type PendingRecord, type PendingView} from './pendingStore';
 import {COOLING_AGAIN_DETAIL, FORBIDDEN_DETAIL, ResendRefused, SendRefused, SentUnconfirmed, type ResendRefusal, type SendIntent} from './sendTypes';
 import {BroadcastRejected, BroadcastSubstituted, firstSignature} from '../../../core/solana/broadcast';
 import {RpcCoolingDown, RpcForbidden, type SignatureStatus} from '../../../core/solana/rpc';
@@ -81,6 +81,8 @@ export async function submitSigned(
     detail: null,
     detailCode: null,
     intent: input.intent,
+    origin: null,
+    firstBroadcast: 'done',
     expiryNullSeenAt: null,
     failure: null,
     fee: input.fee,
@@ -114,6 +116,87 @@ export async function submitSigned(
   }
 }
 
+/**
+ * B1c-2 (spec B1c §1.5 step 2, C17): a dApp's `signAndSendTransaction`, recorded BEFORE anything else happens to its
+ * signed bytes — the queue entry records them next (signTx.ts), then `broadcastFirst` hands them to the route. No
+ * in-flight guard: the dApp built this transaction and the user approved it; the wallet's own one-send-per-account rule
+ * guards the wallet's own sends (inFlightFor). The alarm is armed so a stopped worker still polls it.
+ */
+export async function recordDappSend(ext: Ext, deps: WalletDeps, input: {account: string; wire: Uint8Array; lastValidBlockHeight: number; origin: string}): Promise<PendingRecord> {
+  const now = deps.now();
+  const record: PendingRecord = {
+    id: randomId(deps.randomBytes),
+    account: input.account,
+    signature: firstSignature(input.wire),
+    wire: base64.encode(input.wire),
+    lastValidBlockHeight: input.lastValidBlockHeight,
+    createdAt: now,
+    lastSentAt: now,
+    state: 'pending',
+    detail: null,
+    detailCode: null,
+    intent: null,
+    origin: input.origin,
+    // Review 1 M1: held until the queue entry records these bytes and the page is promised the signature.
+    firstBroadcast: 'held',
+    expiryNullSeenAt: null,
+    failure: null,
+    fee: null,
+  };
+  await updatePending(ext, records => [...records, record]);
+  await armPendingAlarm(ext).catch((e: unknown) => console.warn('pending alarm not armed; the poller still runs', e));
+  return record;
+}
+
+/**
+ * Review 1 M1: the one hand-over of a dApp record's bytes to the route, claimed in one updatePending — `held` or `due`
+ * (or only `due`) becomes `done` — so the effect (broadcastFirst) and the poller's first round can never both send it.
+ * The claimed record, or null when it is not open or already `done`.
+ */
+async function claimFirst(ext: Ext, id: string, from: readonly FirstBroadcast[]): Promise<PendingRecord | null> {
+  const out: {claimed: PendingRecord | null} = {claimed: null};
+  await updatePending(ext, records =>
+    records.map(r => {
+      if (r.id !== id || !isOpen(r) || r.origin === null || !from.includes(r.firstBroadcast)) return r;
+      out.claimed = {...r, firstBroadcast: 'done'};
+      return out.claimed;
+    }),
+  );
+  return out.claimed;
+}
+
+/**
+ * B1c-2: the first broadcast of a recorded dApp send, through the same route and the same outcome rules as the wallet's
+ * own (deliver): `not-sent` only when the route refused it before forwarding, or the 403 cool-down refused to try —
+ * nothing reached the network. Anything else (acknowledged, or not acknowledged: it may land) is `sent`, and the
+ * poller watches it. Claimed first (review 1 M1): if the poller already handed these bytes over, nothing is sent again
+ * and the record's state says what happened.
+ */
+export async function broadcastFirst(ext: Ext, deps: WalletDeps, record: PendingRecord): Promise<'sent' | 'not-sent'> {
+  try {
+    const claimed = await claimFirst(ext, record.id, ['held', 'due']);
+    if (claimed !== null) await deliver(ext, deps, claimed, 'first');
+  } finally {
+    void startPoller(ext, deps);
+  }
+  const now = (await readPending(ext)).find(r => r.id === record.id);
+  return now?.state === 'failed' && now.failure === 'not-sent' ? 'not-sent' : 'sent';
+}
+
+/** Review 1 M1: the poller's first step — every `due` dApp record handed to the route exactly once (claimed `due` → `done`). */
+async function sendDue(ext: Ext, deps: WalletDeps, open: readonly PendingRecord[]): Promise<void> {
+  for (const r of open) {
+    if (r.origin === null || r.firstBroadcast !== 'due') continue;
+    const claimed = await claimFirst(ext, r.id, ['due']);
+    if (claimed !== null) await deliver(ext, deps, claimed, 'first');
+  }
+}
+
+/** B1c-2: a recorded dApp send that will never be broadcast (its request was answered meanwhile): failed, nothing sent. */
+export async function dropDappSend(ext: Ext, id: string): Promise<void> {
+  await patch(ext, id, r => ({...r, state: 'failed', failure: 'not-sent', detail: 'Not sent: the request ended before it was broadcast. No funds moved.', detailCode: null}));
+}
+
 /** "Send again": the same signed bytes, so the same signature — it can land at most once. */
 export async function resend(ext: Ext, deps: WalletDeps, id: string): Promise<PendingView> {
   const out: {record?: PendingRecord; refusal?: ResendRefusal} = {};
@@ -154,8 +237,14 @@ const failedDetail = (err: unknown): string => `Landed but failed (${JSON.string
 
 /** One polling round over every open record. True while anything is still open. */
 export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
-  const open = (await readPending(ext)).filter(isOpen);
+  let open = (await readPending(ext)).filter(isOpen);
   if (open.length === 0) return false;
+  // Review 1 M1: a dApp send the page was promised but no one handed to the route (the worker stopped in between).
+  if (open.some(r => r.origin !== null && r.firstBroadcast === 'due')) {
+    await sendDue(ext, deps, open);
+    open = (await readPending(ext)).filter(isOpen);
+    if (open.length === 0) return false;
+  }
   let statuses: (SignatureStatus | null)[];
   try {
     statuses = await deps.reader.getSignatureStatuses(open.map(r => r.signature));
@@ -212,7 +301,8 @@ export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
     // before a forget's vault write can still add one after the forget's cleanup; the next wallet's
     // first write (storeEnvelope with expectedRevision null) removes v1_known_recipients (L1).
     const own = new Set((await readWalletView(ext))?.accounts.map(a => a.publicKey) ?? []);
-    for (const r of confirmed) if (own.has(r.account)) await addKnownRecipient(ext, r.intent.recipient, now);
+    // A dApp's transaction (B1c-2: no intent) names no recipient of the wallet's own.
+    for (const r of confirmed) if (own.has(r.account) && r.intent !== null) await addKnownRecipient(ext, r.intent.recipient, now);
   }
   return after.some(isOpen);
 }
````

Change `extension/src/background/pendingStore.ts`:

````diff
diff --git a/extension/src/background/pendingStore.ts b/extension/src/background/pendingStore.ts
index 0a20cdf..5fa7ee6 100644
--- a/extension/src/background/pendingStore.ts
+++ b/extension/src/background/pendingStore.ts
@@ -25,6 +25,8 @@ export type PendingFailure = 'landed' | 'not-sent';
  * first broadcast by the route). Written beside `detail` every time; screens choose on this, never on the text.
  */
 export type DetailCode = 'forbidden' | 'cooling' | 'unacked' | 'substituted';
+/** See PendingRecord.firstBroadcast. */
+export type FirstBroadcast = 'held' | 'due' | 'done';
 export const DETAIL_CODES: readonly DetailCode[] = ['forbidden', 'cooling', 'unacked', 'substituted'];
 
 /** A signed send, from before its broadcast until confirmed, failed or expired (spec §4 "No double spend"). */
@@ -41,7 +43,23 @@ export interface PendingRecord {
   detail: string | null;
   /** See DetailCode. A stored value that is missing (a record from before it) or unknown reads as null; the record is kept. */
   detailCode: DetailCode | null;
-  intent: SendIntent;
+  /** What the user sent (#12's intent); null only for a dApp's transaction (B1c-2: `origin` set — the dApp built it). */
+  intent: SendIntent | null;
+  /**
+   * B1c-2 (spec B1c §1.5, §3.3): the site whose `signAndSendTransaction` this is — its signed bytes recorded here before
+   * the broadcast, watched by the same poller, re-sent as the same bytes — or null for the wallet's own send. A dApp's
+   * record never reaches the popup (wallet.pending lists the wallet's own sends) and never blocks one (inFlightFor).
+   */
+  origin: string | null;
+  /**
+   * B1c-2 (plan 2 review 1 M1): a dApp record's first broadcast. `held` — recorded, the page not yet promised the
+   * signature (if the request ends otherwise the bytes are never sent); `due` — the page is promised it (a restart, a
+   * lock or a dead effect answered it from the entry's recorded bytes) and nobody has handed the bytes to the route yet:
+   * the poller's next round does, once; `done` — handed to the route (claimed atomically, so exactly once). The
+   * wallet's own send is `done` from the start (submitSigned broadcasts at once). A stored value that is missing or
+   * unknown reads as `done`: nothing is ever broadcast on a record that does not say it is owed.
+   */
+  firstBroadcast: FirstBroadcast;
   /** When a full-history status check past expiry first came back null; `expired` needs a second one ≥ 2 s later. */
   expiryNullSeenAt: number | null;
   failure: PendingFailure | null;
@@ -63,8 +81,8 @@ export interface PendingFee {
   markupLamports: string;
 }
 
-/** What leaves the background: everything but the signed bytes. */
-export type PendingView = Omit<PendingRecord, 'wire'>;
+/** What leaves the background: everything but the signed bytes (and the first-broadcast bookkeeping, which is the background's). */
+export type PendingView = Omit<PendingRecord, 'wire' | 'firstBroadcast'>;
 
 export const MAX_RECORDS = 20;
 
@@ -75,11 +93,16 @@ const serial = createMutex();
 const STATES: readonly string[] = ['pending', 'stuck', 'confirmed', 'failed', 'expired'];
 const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
 
+const ORIGIN = /^https:\/\/[^\s/?#@]+$/;
+/** A dApp record's origin (B1c-2): an https origin, with its intent null; the wallet's own send has no origin and an intent. */
+const isDappOrigin = (x: unknown): x is string => typeof x === 'string' && ORIGIN.test(x);
+
 /** A stored element is a claim: only an exact record shape is read; anything else is dropped. `failure` and `fee` are checked by recordOf. */
-function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'fee' | 'detailCode'> & {failure?: unknown; fee?: unknown; detailCode?: unknown} {
+function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'fee' | 'detailCode' | 'origin' | 'firstBroadcast'> & {failure?: unknown; fee?: unknown; detailCode?: unknown; origin?: unknown; firstBroadcast?: unknown} {
   if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
   const r = x as Record<string, unknown>;
   const i = r.intent as Record<string, unknown> | null;
+  const dapp = isDappOrigin(r.origin) && i === null;
   return (
     typeof r.id === 'string' &&
     typeof r.account === 'string' &&
@@ -92,11 +115,7 @@ function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'fee' | 'det
     isNum(r.lastSentAt) &&
     (r.detail === null || typeof r.detail === 'string') &&
     (r.expiryNullSeenAt === null || isNum(r.expiryNullSeenAt)) &&
-    typeof i === 'object' &&
-    i !== null &&
-    typeof i.token === 'string' &&
-    typeof i.recipient === 'string' &&
-    typeof i.amount === 'string'
+    (dapp || ((r.origin === undefined || r.origin === null) && typeof i === 'object' && i !== null && typeof i.token === 'string' && typeof i.recipient === 'string' && typeof i.amount === 'string'))
   );
 }
 
@@ -108,9 +127,12 @@ function recordOf(x: unknown): PendingRecord | null {
   if (!isRecord(x)) return null;
   const fee = feeOf(x.fee);
   const detailCode = DETAIL_CODES.find(c => c === x.detailCode) ?? null;
+  const origin = isDappOrigin(x.origin) ? x.origin : null;
+  // Only a dApp record can be owed a first broadcast; anything else (the wallet's own, missing, unknown) is `done`.
+  const firstBroadcast: FirstBroadcast = origin !== null && (x.firstBroadcast === 'held' || x.firstBroadcast === 'due') ? x.firstBroadcast : 'done';
   const f = x.failure;
-  if (f === undefined || f === null) return {...x, failure: null, fee, detailCode};
-  return f === 'landed' || f === 'not-sent' ? {...x, failure: f, fee, detailCode} : null;
+  if (f === undefined || f === null) return {...x, failure: null, fee, detailCode, origin, firstBroadcast};
+  return f === 'landed' || f === 'not-sent' ? {...x, failure: f, fee, detailCode, origin, firstBroadcast} : null;
 }
 
 const DIGITS = /^\d{1,20}$/;
@@ -134,8 +156,9 @@ export async function readPending(ext: Ext): Promise<PendingRecord[]> {
   return out;
 }
 
+/** The wallet's own open send of this account (B1c-2: a dApp's transaction, origin set, is not the wallet's send to guard). */
 export function inFlightFor(records: readonly PendingRecord[], account: string): PendingRecord | undefined {
-  return records.find(r => r.account === account && isOpen(r));
+  return records.find(r => r.account === account && isOpen(r) && r.origin === null);
 }
 
 export function viewOf(r: PendingRecord): PendingView {
@@ -150,6 +173,7 @@ export function viewOf(r: PendingRecord): PendingView {
     detail: r.detail,
     detailCode: r.detailCode,
     intent: r.intent,
+    origin: r.origin,
     expiryNullSeenAt: r.expiryNullSeenAt,
     failure: r.failure,
     fee: r.fee === null ? null : {networkLamports: r.fee.networkLamports, markupLamports: r.fee.markupLamports},
@@ -176,3 +200,14 @@ export async function updatePending(ext: Ext, change: (records: PendingRecord[])
     return next;
   });
 }
+
+/**
+ * Review 1 M1: the page is being promised these signatures (a restart, a lock or a dead effect answers a send from the
+ * entry's recorded bytes): each one's record, while still `held`, becomes `due` — written BEFORE the answer is stored
+ * (the callers run it inside their section), so a page never holds a signature whose bytes no one will send. The
+ * poller's next round hands a `due` record to the route, once.
+ */
+export async function markDue(ext: Ext, signatures: readonly string[]): Promise<void> {
+  if (signatures.length === 0) return;
+  await updatePending(ext, records => records.map(r => (r.origin !== null && r.firstBroadcast === 'held' && isOpen(r) && signatures.includes(r.signature) ? {...r, firstBroadcast: 'due'} : r)));
+}
````

Change `extension/src/background/walletApi.ts`:

````diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
index 4fc68cd..0fbd94d 100644
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -19,6 +19,7 @@ import {ResendRefused, SendRefused, SentUnconfirmed} from './sendTypes';
 import {readCachedBalances, readCachedPrices, writeCachedBalances, writeCachedPrices, type PriceView} from './balanceCache';
 import {readWalletBalances, WALLET_TOKENS} from '../../../core/solana/balances';
 import {RequestUnreachable, RpcForbidden} from '../../../core/solana/rpc';
+import {dappTxSignatures} from './dapp/dappTxs';
 
 export type Result = {ok: true; data?: unknown} | {ok: false; error: string; data?: unknown};
 
@@ -392,12 +393,15 @@ export async function handleWallet(ext: Ext, deps: WalletDeps, type: WalletType,
       }
       case 'wallet.pending':
         // Polling was resumed above if anything is open.
-        return {ok: true, data: (await readPending(ext)).map(viewOf)};
+        // The wallet's own sends only (B1c-2: a dApp's transaction is the site's — the popup shows it once it lands).
+        return {ok: true, data: (await readPending(ext)).filter(r => r.origin === null).map(viewOf)};
       case 'wallet.history': {
         const {account, before} = msg;
         if (!isAddress(account) || (before !== undefined && !isSignature(before))) return MALFORMED;
         const {items, next} = await historyFor(deps).page(account, before);
-        return {ok: true, data: {items, next}};
+        // B1c-2 (#26b, #27b): a transaction a site had this wallet sign carries the "Dapp · simulated" badge.
+        const fromDapps = await dappTxSignatures(ext);
+        return {ok: true, data: {items: items.map(i => ({...i, origin: fromDapps.has(i.signature) ? ('dapp' as const) : null})), next}};
       }
       case 'accounts.rename': {
         const {index} = msg;
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run src/background/__tests__/forgetWallet.test.ts src/background/dapp/__tests__/signSend.test.ts src/background/dapp/__tests__/store.test.ts` — expected: Test Files  3 passed (3) · Tests  61 passed (61)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  163 passed (163) · Tests  3203 passed (3203). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

Then B1b's spec 15, whose wipe list gains `v1_dapp_txs`: `node scripts/build.mjs && npx playwright test e2e/settings.spec.ts -g '15 · '` — expected: every `15 · ` test passes (the dry run ran it in the whole E2E suite — Dry-run record).

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M5a | `signTx.ts`: the signed bytes not recorded in the entry before the broadcast | signSend.test.ts "… recorded (v1_pending, then the entry) BEFORE the broadcast" — RED Tests  4 failed \| 13 passed (17) |
| M5b | `queue.ts`: a recorded send answered `rejected` on a restart | signSend.test.ts "a restart with the signed bytes recorded" — RED Tests  5 failed \| 12 passed (17) |
| M5c | `lockHook.ts`: a recorded send answered `rejected` by a lock | signSend.test.ts "a lock after the record, during the broadcast" — RED Tests  2 failed \| 15 passed (17) |
| M5d | `pendingStore.ts`: a dApp's record blocks the wallet's own sends | signSend.test.ts "a dApp's record is not the wallet's send" — RED Tests  1 failed \| 16 passed (17) |
| M5e | `walletApi.ts`: wallet.pending lists dApp records | signSend.test.ts "a dApp's record is not the wallet's send" — RED Tests  1 failed \| 16 passed (17) |
| M5f | `signTx.ts`: bytes of an ended request not marked never sent | signSend.test.ts "the grant revoked while the key is read" — RED Tests  1 failed \| 16 passed (17) |
| M5g | `signTx.ts`: a sign-only transaction listed whoever pays | signSend.test.ts "signTransaction: a transaction the account pays for is listed" — RED Tests  1 failed \| 16 passed (17) |
| M5h | `walletApi.ts`: no row marked | signSend.test.ts "wallet.history marks a listed signature" — RED Tests  1 failed \| 16 passed (17) |
| M5i | `store.ts`: `wipeDappStores` keeps v1_dapp_txs | forgetWallet.test.ts (the delete and the first write) — RED Tests  2 failed \| 28 passed (30) |
| M5j | `signTx.ts`: a send the route refused answered its signature | signSend.test.ts "the route refuses before forwarding … send-failed" — RED Tests  1 failed \| 16 passed (17) |
| M5k | `pending.ts`: the poller's first round skips `due` records | signSend.test.ts "a restart after the entry recorded the bytes and before the route" — RED Tests  2 failed \| 15 passed (17) |
| M5l | `queue.ts`: a signature answered without marking its record `due` | signSend.test.ts "a restart after the entry recorded the bytes and before the route" — RED Tests  1 failed \| 16 passed (17) |
| M5m | `pending.ts`: a dApp record written `due` instead of `held` | signSend.test.ts "a stop between the record and the entry's `sent`" — RED Tests  2 failed \| 15 passed (17) |
| M5n | `pending.ts`: `broadcastFirst` delivers without claiming | signSend.test.ts "the effect and the poller never both send" — RED Tests  1 failed \| 16 passed (17) |
| M5o | `pending.ts`: a claim that does not mark the record `done` | signSend.test.ts "a restart after the entry recorded the bytes…" (never sent twice) — RED Tests  8 passed (17) |
| M5p | `queue.ts`: `SEND_DECIDING_TTL_MS = 30_000` | signSend.test.ts "a dead send effect … SEND_DECIDING_TTL_MS" — RED Tests  1 failed \| 16 passed (17) |
| M5q | `lockHook.ts`: the lock's signature answers not marked `due` | signSend.test.ts "a lock after the entry recorded the bytes, the effect stopped" — RED Tests  1 failed \| 16 passed (17) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-2 signAndSendTransaction — recorded before the broadcast, answered once, never re-sent; v1_dapp_txs and the history's origin" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 6: Re-authentication through the toolbar (D11): `dapp.reauth`, the popup's strip on #11, #10 for a site's transaction

**Spec:** §3.3 (Re-authentication, B1b's rules through #10), D11, §4.3 ("no link into the vault page"), B1b-2a E3 (#10's closed-alphabet renderer), C13; Scope R9, R10, R22

**Files:**
- Test: `extension/src/app/__tests__/Home.test.tsx`
- Test: `extension/src/app/__tests__/Switcher.test.tsx`
- Modify: `extension/src/app/engine.ts`
- Modify: `extension/src/app/screens/Home.tsx`
- Test: `extension/src/background/__tests__/messages.test.ts`
- Test: `extension/src/background/dapp/__tests__/signTx.test.ts`
- Modify: `extension/src/background/dapp/signTx.ts`
- Modify: `extension/src/background/messages.ts`
- Modify: `extension/src/background/reauthChallenges.ts`
- Test: `extension/src/unlock/__tests__/challenge.test.ts`
- Test: `extension/src/unlock/__tests__/reauthScreen.test.ts`
- Modify: `extension/src/unlock/challenge.ts`
- Modify: `extension/src/unlock/screens/reauth.ts`
- Modify: `extension/src/unlock/strings.ts`

**Interfaces:**
- Consumes: Task 4's `dappDigest`, `isTxType`, the `dapp` challenge; B1b's `reauthPage`, `describeChallenge`, `runReauth`, the #10 screen.
- Produces:
  - `messages.ts`: `dapp.reauth` (privileged; popup and UI tab only — `WALLET_UI_ONLY`).
  - `signTx.ts`: `reauthWaiting(ext, deps): Promise<{ok: true; data: {challengeId: string; site: string} | null} | {ok: false; error: 'locked'}>`.
  - `reauthChallenges.ts`: `DappOutgoing.symbol: 'SOL' | 'NOC' | 'USDC' | 'USDT' | null` (the vault page names a token by its own table, never by a mint it would have to import).
  - `app/engine.ts`: `interface DappReauth {challengeId: string; site: string}`; `Engine.dappReauth(): Promise<Reply<DappReauth | null, 'locked'>>`.
  - `app/screens/Home.tsx`: `DAPP_REAUTH_TEXT(site)`; the strip.
  - `unlock/challenge.ts`: `interface DappDescription {kind: 'dapp'; site; transactions; outgoing: {label; amount; mint}[]; omitted: number; reasons}`; `Description` gains it.
  - `unlock/strings.ts`: `REAUTH.aboutDapp`, `site`, `transactions`, `token`, `baseUnits`, `omitted(n)`, `approval`, `dappConfirmed`, `dappExpired`, `dappNotUnlocked`.

The approval window never opens the vault page; the popup does, when the user's own click on the toolbar opened it (R9). `dapp.reauth` answers the head's challenge while it is live and unproven, with the site as the window shows it; Home reads it on mount and on focus (only the newest answer counts, nothing after unmount) and shows the strip — a `LockedButton` in the pending strip's pattern — which opens #10 for that challenge. #10 renders a `dapp` challenge only after re-validating every field against its closed alphabet (as a send's): the site's characters, one to five transactions, each token's amount exact, a named token's decimals its own, the reasons from its table, the count of tokens past the sixteen listed a whole number (shown as "and <n> more tokens" — R28); anything else is "could not be shown". The proof is all #10 does: "Confirmed. Go back to the approval window and approve the transaction."; its expired and locked lines say what is true for a site's request; Cancel closes the tab.

- [ ] **Step 1: Write the failing tests.**

Change `extension/src/app/__tests__/Home.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Home.test.tsx b/extension/src/app/__tests__/Home.test.tsx
index 926a564..3a4e040 100644
--- a/extension/src/app/__tests__/Home.test.tsx
+++ b/extension/src/app/__tests__/Home.test.tsx
@@ -648,3 +648,35 @@ describe('#42 offline and the D26 refused state', () => {
     expect(screen.queryByText('Sending 2.48 SOL · pending')).toBeNull();
   });
 });
+
+// B1c-2 (spec B1c §3.3 "Re-authentication through #10"; D11): the approval window points to the toolbar icon; the popup
+// it opens offers #10 for the site's waiting challenge.
+describe('#11: a site’s transaction waiting for its confirmation (B1c-2)', () => {
+  const T = 1_000_000;
+  async function waitingDapp(ext: Parameters<NonNullable<WalletOptions['before']>>[0]): Promise<string> {
+    const {issueChallenge} = await import('../../background/reauthChallenges');
+    const {dappDigest} = await import('../../background/dapp/signTx');
+    const {DAPP_SESSION_KEY} = await import('../../background/dapp/store');
+    const entry = {
+      requestId: 'AAAAAAAAAAAAAAAAAAAAAA', pageId: 'p1', origin: 'https://jup.ag', host: 'jup.ag', tabId: 7, documentId: null, type: 'signTransaction', account: ACCOUNT.publicKey,
+      message: null, transactions: ['AQ=='], granted: null, sim: null, challengeId: null as string | null, sent: null, arrivedAt: T, state: 'queued', decidedBy: null, decidingAt: null,
+      decision: null, answer: null, answeredAt: null,
+    };
+    const about = {kind: 'dapp' as const, account: ACCOUNT.publicKey, site: 'jup.ag', transactions: 1, outgoing: [{mint: null, symbol: 'SOL' as const, amount: '1', decimals: 9}], omitted: 0, reasons: ['first-send' as const], thresholdCents: 10_000};
+    entry.challengeId = await issueChallenge(ext, {now: () => T, randomBytes: n => new Uint8Array(n).fill(4)}, dappDigest(entry), about);
+    await ext.session.set(DAPP_SESSION_KEY, {queue: [entry], grants: [], window: null, opening: null, undo: []});
+    return entry.challengeId;
+  }
+
+  it('the strip names the site and opens #10 for that challenge (a LockedButton); with nothing waiting there is no strip', async () => {
+    let challengeId = '';
+    const w = await renderHome({before: async ext => void (challengeId = await waitingDapp(ext))});
+    const strip = await screen.findByRole('button', {name: 'A transaction from jup.ag waits for your confirmation'});
+    fireEvent.click(strip);
+    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${challengeId}`]));
+    cleanup();
+    await renderHome();
+    await screen.findByText('62.4821 SOL');
+    expect(screen.queryByText(/waits for your confirmation/)).toBeNull();
+  });
+});
````

Change `extension/src/app/__tests__/Switcher.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Switcher.test.tsx b/extension/src/app/__tests__/Switcher.test.tsx
index 17b8d7d..c8f7987 100644
--- a/extension/src/app/__tests__/Switcher.test.tsx
+++ b/extension/src/app/__tests__/Switcher.test.tsx
@@ -42,6 +42,7 @@ function stubEngine(accounts: Account[], selected: number): Engine {
     dappRevokeAll: async () => ({ok: false, error: 'failed'}),
     dappBlocked: async () => ({ok: true, data: []}),
     dappUnblock: async () => ({ok: false, error: 'failed'}),
+    dappReauth: async () => ({ok: false, error: 'failed'}),
     lock: async () => ({ok: true, data: null}),
     ping: async () => ({ok: true, data: null}),
   };
````

Change `extension/src/background/__tests__/messages.test.ts`:

````diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index 1d9f637..de63fe5 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -200,8 +200,8 @@ describe('message partitions (B1b-1 types)', () => {
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
     'contacts.list', 'contacts.set', 'contacts.remove',
-    // B1c §1.4: the approval window's and #49's.
-    'dapp.pending', 'dapp.decide', 'dapp.grants.list', 'dapp.grants.revoke', 'dapp.grants.undo', 'dapp.grants.revokeAll', 'dapp.blocked.list', 'dapp.blocked.remove',
+    // B1c §1.4: the approval window's and #49's; B1c-2: the popup's offer of #10 for a site's transaction (D11).
+    'dapp.pending', 'dapp.decide', 'dapp.grants.list', 'dapp.grants.revoke', 'dapp.grants.undo', 'dapp.grants.revokeAll', 'dapp.blocked.list', 'dapp.blocked.remove', 'dapp.reauth',
   ];
 
   it('every privileged type is refused from a web page and from another extension', async () => {
````

Change `extension/src/background/dapp/__tests__/signTx.test.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/signTx.test.ts b/extension/src/background/dapp/__tests__/signTx.test.ts
index 47ca8c6..8548d82 100644
--- a/extension/src/background/dapp/__tests__/signTx.test.ts
+++ b/extension/src/background/dapp/__tests__/signTx.test.ts
@@ -235,7 +235,7 @@ describe('re-authentication for a transaction request', () => {
     expect((await c.pend()).request?.tx?.reauth).toEqual({reasons: ['first-send'], state: 'waiting'});
     expect(await c.challengeInfo(challengeId)).toEqual({
       ok: true,
-      data: {kind: 'dapp', account: ACCOUNT.publicKey, site: 'dapp.test', transactions: 1, outgoing: [{mint: null, amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000},
+      data: {kind: 'dapp', account: ACCOUNT.publicKey, site: 'dapp.test', transactions: 1, outgoing: [{mint: null, symbol: 'SOL', amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000},
     });
     // Still refused while unproven; the challenge is not reissued.
     expect(await c.approve(requestId, id)).toEqual({ok: false, error: 'reauth-required'});
@@ -357,3 +357,25 @@ describe('#48’s other views', () => {
     expect(runtimeFor(e.ext).simulating.size).toBe(0);
   });
 });
+
+// D11: the approval window never links into the vault page; the popup (opened from the toolbar) offers #10.
+describe('dapp.reauth (the popup’s offer of #10)', () => {
+  it('the head’s live, unproven challenge with its site; null before Approve asked and once proven; locked refused; never from the window', async () => {
+    const {handleMessage} = await import('../../messages');
+    const c = await txScene();
+    const popup = {id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/popup.html`};
+    const ask = (sender = popup) => handleMessage(c.ext, {type: 'dapp.reauth'}, sender, c.deps);
+    const r = await c.signTx('t', [v0([transfer(1_000_000)])]);
+    const requestId = String(r?.requestId);
+    const id = (await c.simulated()).request?.tx?.simulation.id;
+    expect(await ask()).toEqual({ok: true, data: null});
+    await c.approve(requestId, id);
+    const challengeId = String((await c.entry(requestId))?.challengeId);
+    expect(await ask()).toEqual({ok: true, data: {challengeId, site: 'dapp.test'}});
+    expect(await ask({id: c.ext.runtimeId, origin: c.ext.extensionOrigin, url: `${c.ext.extensionOrigin}/approve.html`})).toEqual({ok: false, error: 'forbidden'});
+    await c.reauthOk(challengeId);
+    expect(await ask()).toEqual({ok: true, data: null});
+    await lock(c.ext);
+    expect(await ask()).toEqual({ok: false, error: 'locked'});
+  });
+});
````

Change `extension/src/unlock/__tests__/challenge.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/challenge.test.ts b/extension/src/unlock/__tests__/challenge.test.ts
index f8e753f..01c3d0a 100644
--- a/extension/src/unlock/__tests__/challenge.test.ts
+++ b/extension/src/unlock/__tests__/challenge.test.ts
@@ -24,6 +24,65 @@ const SEND: ChallengeAbout = {
   thresholdCents: 10_000,
 };
 
+// B1c-2: a dApp's transaction request.
+const DAPP: ChallengeAbout = {
+  kind: 'dapp',
+  account: ACCOUNT.publicKey,
+  site: 'jup.ag',
+  transactions: 2,
+  outgoing: [
+    {mint: null, symbol: 'SOL', amount: '1005000', decimals: 9},
+    {mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', amount: '250000000', decimals: 6},
+    {mint: RECIPIENT, symbol: null, amount: '777', decimals: null},
+  ],
+  omitted: 0,
+  reasons: ['first-send', 'approval'],
+  thresholdCents: 10_000,
+};
+
+describe('describeChallenge: a dApp’s transaction (B1c-2)', () => {
+  it('the site, the batch’s size, each token leaving the account (exact, never rounded), the reasons (positive control)', () => {
+    expect(describeChallenge(DAPP)).toEqual({
+      kind: 'dapp',
+      site: 'jup.ag',
+      transactions: 2,
+      outgoing: [
+        {label: 'SOL', amount: '−0.001005', mint: null},
+        {label: 'USDC', amount: '−250', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'},
+        {label: 'Token', amount: '−777 (base units)', mint: RECIPIENT},
+      ],
+      omitted: 0,
+      reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required to approve a token allowance.'],
+    });
+  });
+
+  it('fails closed: a key more or less, a site with a path, a named token with other decimals, SOL with a mint, an unknown reason, no reason, a count of omitted tokens that is not a whole number ≥ 0', () => {
+    const outgoing = DAPP.kind === 'dapp' ? DAPP.outgoing : [];
+    for (const bad of [
+      {...DAPP, extra: 1},
+      {...DAPP, site: 'jup.ag/x'},
+      {...DAPP, transactions: 6},
+      {...DAPP, outgoing: [{...outgoing[1], decimals: 9}]},
+      {...DAPP, outgoing: [{...outgoing[0], mint: RECIPIENT}]},
+      {...DAPP, outgoing: [{...outgoing[2], symbol: 'BONK'}]},
+      {...DAPP, outgoing: [{...outgoing[0], amount: '-5'}]},
+      {...DAPP, reasons: ['drain']},
+      {...DAPP, reasons: []},
+      {...DAPP, omitted: -1},
+      {...DAPP, omitted: 1.5},
+      {...DAPP, omitted: '2'},
+    ]) {
+      expect([bad, describeChallenge(bad)]).toEqual([bad, null]);
+    }
+  });
+});
+
+describe('describeChallenge: a dApp’s omitted tokens (review 1 L9)', () => {
+  it('the count of the tokens past the listed ones is carried to #10', () => {
+    expect(describeChallenge({...DAPP, omitted: 3})).toMatchObject({kind: 'dapp', omitted: 3});
+  });
+});
+
 describe('describeChallenge: the closed-alphabet renderer', () => {
   it('describes a send from fixed strings and validated values only (positive control)', () => {
     expect(describeChallenge(SEND)).toEqual({
````

Change `extension/src/unlock/__tests__/reauthScreen.test.ts`:

````diff
diff --git a/extension/src/unlock/__tests__/reauthScreen.test.ts b/extension/src/unlock/__tests__/reauthScreen.test.ts
index 95d3eec..22fa0dd 100644
--- a/extension/src/unlock/__tests__/reauthScreen.test.ts
+++ b/extension/src/unlock/__tests__/reauthScreen.test.ts
@@ -614,6 +614,51 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     expect(text(el('ra-notice-line'))).toBe('Something went wrong. Nothing was changed.');
   });
 
+  // B1c-2 (spec B1c §3.3, D11): a site's transaction, reached from the popup's strip — #10 proves; the window signs.
+  const DAPP: ChallengeAbout = {kind: 'dapp', account: K0, site: 'jup.ag', transactions: 1, outgoing: [{mint: null, symbol: 'SOL', amount: '1005000', decimals: 9}], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000};
+  it('a dApp’s transaction: "You are about to approve", the site and what leaves the account; confirmed → back to the approval window, nothing sent here', async () => {
+    const {h, broadcast} = await shown(DAPP);
+    expect(text(el('ra-about'))).toBe('You are about to approve');
+    expect(visible(el('ra-amount-row'))).toBe(false);
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'SOL−0.001005']);
+    expect([...el('ra-reasons').children].map(text)).toEqual(['Re-auth required for the first send to a new address.']);
+    expect(text(el('ra-cancel'))).toBe('Cancel');
+    expect(el('ra-x').getAttribute('aria-label')).toBe('Close');
+    expect(unstyled('v-reauth')).toEqual([]);
+    confirmWith(PW);
+    await h.until(() => visible(el('ra-notice')));
+    expect(text(el('ra-notice-line'))).toBe('Confirmed. Go back to the approval window and approve the transaction.');
+    expect(h.sent.filter(m => m.type === 'vault.reauthOk')).toHaveLength(1);
+    expect(h.went).toEqual([]);
+    nothingSent(h, broadcast);
+  });
+
+  it('a dApp’s transaction losing more tokens than #10 lists: the rows, then "and 2 more tokens" (review 1 L9)', async () => {
+    await shown({...DAPP, omitted: 2});
+    expect([...el('ra-rows').querySelectorAll('.intent-row')].map(text)).toEqual(['Sitejup.ag', 'SOL−0.001005', 'and 2 more tokens']);
+  });
+
+  it('a dApp’s transaction: expired and locked say what is true for a site’s request; Cancel only closes the tab', async () => {
+    const one = await shown(DAPP);
+    one.h.wallet.clock.t += CHALLENGE_TTL_MS;
+    confirmWith(PW);
+    await one.h.until(() => visible(el('ra-notice')));
+    expect(text(el('ra-notice-line'))).toBe('This confirmation has expired. Approve the transaction again in the approval window.');
+    loadPage();
+    const two = await shown(DAPP);
+    const inner = two.h.deps.send;
+    two.h.deps.send = async m => ((m as {type: string}).type === 'vault.reauthOk' ? {ok: false, error: 'locked'} : inner(m));
+    confirmWith(PW);
+    await two.h.until(() => visible(el('ra-notice')));
+    expect(text(el('ra-notice-line'))).toBe("The wallet locked while you were confirming. The site's request was declined — ask the site to try again.");
+    expect(visible(el('ra-unlock'))).toBe(true);
+    loadPage();
+    const three = await shown(DAPP);
+    click(el('ra-cancel'));
+    await three.h.until(() => three.h.closed > 0);
+    expect(three.h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
+  });
+
   it('a settings challenge’s Cancel only closes the tab: no discard, no "cancelled"', async () => {
     const {h} = await shown({kind: 'settings', autoLockMinutes: 5, reauthUsdCents: null});
     click(el('ra-cancel'));
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/app/__tests__/Home.test.tsx src/app/__tests__/Switcher.test.tsx src/background/__tests__/messages.test.ts src/background/dapp/__tests__/signTx.test.ts src/unlock/__tests__/challenge.test.ts src/unlock/__tests__/reauthScreen.test.ts`

Expected (the dry run): Test Files  5 failed | 1 passed (6) · Tests  9 failed | 168 passed (177)

- [ ] **Step 3: Implement.**

Change `extension/src/app/engine.ts`:

````diff
diff --git a/extension/src/app/engine.ts b/extension/src/app/engine.ts
index 3e192c5..ae0c729 100644
--- a/extension/src/app/engine.ts
+++ b/extension/src/app/engine.ts
@@ -227,6 +227,8 @@ export interface Engine {
   dappRevokeAll(): Promise<Reply<null, 'locked'>>;
   dappBlocked(): Promise<Reply<DappBlocked[], 'locked'>>;
   dappUnblock(host: string): Promise<Reply<null, 'malformed' | 'locked'>>;
+  /** B1c-2 (D11): a site's transaction waiting for #10 — its challenge and the site — or null; refused while locked. */
+  dappReauth(): Promise<Reply<DappReauth | null, 'locked'>>;
   lock(): Promise<Reply<null, never>>;
   ping(): Promise<Reply<null, never>>;
 }
@@ -518,6 +520,18 @@ function dappGrantOf(x: unknown): DappGrant | undefined {
   if (typeof o.verified !== 'boolean' || !isAddress(o.account) || !isTime(o.connectedAt) || !isTime(o.lastUsedAt)) return undefined;
   return {origin: o.origin, host: o.host, name: o.name, verified: o.verified, account: o.account, scope, connectedAt: o.connectedAt, lastUsedAt: o.lastUsedAt, recent};
 }
+/** B1c-2: what dapp.reauth answers — a 32-hex challenge (the only kind reauthPage() opens) and the site, as the window shows it. */
+export interface DappReauth {
+  challengeId: string;
+  site: string;
+}
+function dappReauthOf(x: unknown): DappReauth | null | undefined {
+  if (x === null) return null;
+  const o = obj(x);
+  if (o === undefined || typeof o.challengeId !== 'string' || !/^[0-9a-f]{32}$/.test(o.challengeId) || typeof o.site !== 'string' || !/^[A-Za-z0-9.\-[\]:]{1,262}$/.test(o.site)) return undefined;
+  return {challengeId: o.challengeId, site: o.site};
+}
+
 function dappBlockedOf(x: unknown): DappBlocked | undefined {
   const o = obj(x);
   if (o === undefined || typeof o.host !== 'string' || o.host === '' || !isTime(o.blockedAt) || !(o.imitates === null || typeof o.imitates === 'string')) return undefined;
@@ -600,6 +614,7 @@ export function createEngine(transport: Transport = runtimeSend, sleep: (ms: num
     dappRevokeAll: () => call({type: 'dapp.grants.revokeAll'}, ['locked'], nothing),
     dappBlocked: () => call({type: 'dapp.blocked.list'}, ['locked'], d => all(obj(d)?.blocked, dappBlockedOf)),
     dappUnblock: host => call({type: 'dapp.blocked.remove', host}, ['malformed', 'locked'], nothing),
+    dappReauth: () => call({type: 'dapp.reauth'}, ['locked'], dappReauthOf),
     lock: () => call({type: 'vault.lock'}, [], nothing),
     ping: () => call({type: 'activity.ping'}, [], nothing),
   };
````

Change `extension/src/app/screens/Home.tsx`:

````diff
diff --git a/extension/src/app/screens/Home.tsx b/extension/src/app/screens/Home.tsx
index 54ce2eb..4c80dec 100644
--- a/extension/src/app/screens/Home.tsx
+++ b/extension/src/app/screens/Home.tsx
@@ -1,4 +1,4 @@
-import {useState} from 'react';
+import {useEffect, useRef, useState} from 'react';
 import {useWallet, sustained, type NetMode} from '../WalletContext';
 import {valuation} from '../valuation';
 import {TOKEN_INFO, approxSol, ago, agoLong, showAmount, showUsd, stamp, usdParts} from '../format';
@@ -10,7 +10,8 @@ import {LockedButton} from '../ui/LockedButton';
 import {RefusedBanner} from '../ui/Banner';
 import {SkelCircle, SkelLine} from '../ui/Skeleton';
 import {TokenTile} from '../ui/TokenTile';
-import type {Pending, Token} from '../engine';
+import type {DappReauth, Pending, Token} from '../engine';
+import {reauthPage} from '../platform';
 
 /** #42's banner: offline is navigator's word; unreachable says the server did not answer (review L3). */
 function NetBanner({mode, sustainedNow, lastSync, failures, now}: {mode: NetMode; sustainedNow: boolean; lastSync: number | null; failures: number; now: number}) {
@@ -59,6 +60,48 @@ function PendingStrip({p, now, onOpen}: {p: Pending; now: number; onOpen: () =>
   );
 }
 
+/**
+ * B1c-2 (spec B1c §3.3 "Re-authentication (B1b's rules through #10)"; D11): a site's transaction waits for #10. The
+ * approval window never links into the vault page — it tells the user to click the Noctura icon — so the offer is
+ * here, where the user's own click on the toolbar brought them. It opens #10 for that challenge (a new tab; the popup
+ * closes itself after). Controller ruling (owner copy, Scope).
+ */
+export const DAPP_REAUTH_TEXT = (site: string): string => `A transaction from ${site} waits for your confirmation`;
+function DappReauthStrip({waiting, onOpen}: {waiting: DappReauth; onOpen: () => void}) {
+  return (
+    <LockedButton className="banner info app-banner app-strip" onPress={onOpen}>
+      <ExtIcon name="link" size={18} />
+      <span className="noc-body-sm">{DAPP_REAUTH_TEXT(waiting.site)}</span>
+    </LockedButton>
+  );
+}
+
+/**
+ * dapp.reauth, read when Home mounts and whenever the window regains focus; only the newest answer counts, and nothing
+ * is set after unmount (the generation and `alive` checks of every async path).
+ */
+function useDappReauth(engine: {dappReauth(): Promise<{ok: true; data: DappReauth | null} | {ok: false}>}): DappReauth | null {
+  const [waiting, setWaiting] = useState<DappReauth | null>(null);
+  const reads = useRef(0);
+  useEffect(() => {
+    let alive = true;
+    const read = async () => {
+      const n = ++reads.current;
+      const r = await engine.dappReauth();
+      if (!alive || n !== reads.current) return;
+      setWaiting(r.ok ? r.data : null);
+    };
+    void read();
+    const again = () => void read();
+    window.addEventListener('focus', again);
+    return () => {
+      alive = false;
+      window.removeEventListener('focus', again);
+    };
+  }, [engine]);
+  return waiting;
+}
+
 /** A balance read that failed with 'failed' (final review I1; over shown balances, owner decision 2026-10-01) — copy confirmed by the owner 2026-10-01. */
 export const BALANCES_FAILED_TEXT = 'Could not read your balances. Try again.';
 const HIDDEN_ROW = '••••••';
@@ -81,6 +124,11 @@ export function Home({onSend, onReceive, onPending, onAccounts}: {onSend: () =>
     });
   };
   const account = m.account;
+  const dappWaiting = useDappReauth(m.engine);
+  const openDappReauth = () => {
+    const page = dappWaiting === null ? null : reauthPage(dappWaiting.challengeId);
+    if (page !== null) m.platform.openPage(page);
+  };
   const mode = m.net.mode;
   const refused = mode === 'refused';
   const away = mode === 'offline' || mode === 'unreachable';
@@ -125,6 +173,7 @@ export function Home({onSend, onReceive, onPending, onAccounts}: {onSend: () =>
       <div className="screen s-dash" aria-busy="true">
         {top}
         {banner}
+        {dappWaiting === null ? null : <DappReauthStrip waiting={dappWaiting} onOpen={openDappReauth} />}
         <div className="hero">
           <SkelLine width={90} height={14} />
           <SkelLine width={200} height={44} />
@@ -188,6 +237,7 @@ export function Home({onSend, onReceive, onPending, onAccounts}: {onSend: () =>
     <div className="screen s-dash">
       {top}
       {banner}
+      {dappWaiting === null ? null : <DappReauthStrip waiting={dappWaiting} onOpen={openDappReauth} />}
       {open === undefined ? null : <PendingStrip p={open} now={now} onOpen={() => onPending(open)} />}
       <section className={`hero${heroStale ? ' s8-stale' : ''}`}>
         {heroStale ? <div className="s8-stale-mark" /> : null}
````

Change `extension/src/background/dapp/signTx.ts`:

````diff
diff --git a/extension/src/background/dapp/signTx.ts b/extension/src/background/dapp/signTx.ts
index 2225213..fff544a 100644
--- a/extension/src/background/dapp/signTx.ts
+++ b/extension/src/background/dapp/signTx.ts
@@ -15,6 +15,7 @@ import {withRecent} from './grants';
 import {withDappTxs} from './dappTxs';
 import {broadcastFirst, dropDappSend, recordDappSend} from '../pending';
 import {firstSignature} from '../../../../core/solana/broadcast';
+import {tokenForMint} from '../../../../core/solana/balances';
 import {runtimeFor} from './ports';
 import {answer, queueAccess} from './queue';
 import {simulateTransactions, type SimState, type TxOutcome} from './simulate';
@@ -197,7 +198,7 @@ export function dappAbout(e: Entry, site: string, thresholdCents: number): Extra
     const [a, b] = [rank(x.mint, x.v.usd), rank(y.mint, y.v.usd)];
     return a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) || x.i - y.i;
   });
-  const outgoing: DappOutgoing[] = all.slice(0, MAX_DAPP_OUTGOING).map(({mint, v}) => ({mint, amount: v.amount.toString(), decimals: v.decimals}));
+  const outgoing: DappOutgoing[] = all.slice(0, MAX_DAPP_OUTGOING).map(({mint, v}) => ({mint, symbol: mint === null ? 'SOL' : tokenForMint(mint), amount: v.amount.toString(), decimals: v.decimals}));
   return {kind: 'dapp', account: e.account, site, transactions: e.transactions.length, outgoing, omitted: all.length - outgoing.length, reasons: e.sim.sim.reasons.slice(), thresholdCents};
 }
 
@@ -363,3 +364,27 @@ export async function finishSend(ext: Ext, deps: WalletDeps, requestId: string,
     answer(fx, e, outcome === 'sent' ? {result: {signature: e.sent.signature}} : {error: 'send-failed'}, tx.now);
   });
 }
+
+/**
+ * dapp.reauth (B1c-2; D11 — "the password is typed only after clicking the Noctura icon"): the popup and the UI tab ask
+ * it when they open; the approval window never links into the vault page. The head request's challenge, while it is
+ * live and not yet proven, with the site as the window shows it — the popup then offers #10 for it. Refused while
+ * locked, as #49's messages.
+ */
+export async function reauthWaiting(ext: Ext, deps: Pick<WalletDeps, 'now'>): Promise<{ok: true; data: {challengeId: string; site: string} | null} | {ok: false; error: 'locked'}> {
+  return queueAccess(ext, deps, async tx => {
+    if (tx.session === null) return {ok: false as const, error: 'locked' as const};
+    const h = tx.s.queue.find(e => e.state === 'queued' || e.state === 'deciding');
+    if (h === undefined || h.state !== 'queued' || !isTxType(h.type) || h.challengeId === null) return {ok: true as const, data: null};
+    // Read-only loads of the challenge store (no mutex of their own): safe inside the section.
+    const live = (await challengeInfo(ext, tx.now, h.challengeId)) !== null && !(await challengeSatisfied(ext, tx.now, h.challengeId, dappDigest(h)));
+    if (!live) return {ok: true as const, data: null};
+    let site = h.host;
+    try {
+      site = new URL(h.origin).host;
+    } catch {
+      // The stored origin always parses (ports.ts accepted it); the host alone otherwise.
+    }
+    return {ok: true as const, data: {challengeId: h.challengeId, site}};
+  });
+}
````

Change `extension/src/background/messages.ts`:

````diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index 7d491ac..5800760 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -15,6 +15,7 @@ import {PAGE_TYPES} from './dapp/pageApi';
 import {decide, decideRequestOf, pending} from './dapp/decide';
 import {runUnlockHook} from './dapp/queue';
 import {dropAccountGrants, listBlocked, listGrants, revokeAll, revokeGrant, undoRevoke, unblock} from './dapp/grantsApi';
+import {reauthWaiting} from './dapp/signTx';
 
 /** What the browser reports about a message's origin (runtime.MessageSender). */
 export interface Sender {
@@ -57,6 +58,8 @@ export const PRIVILEGED = [
   'dapp.grants.revokeAll',
   'dapp.blocked.list',
   'dapp.blocked.remove',
+  // B1c-2 (D11): the popup's offer of #10 for a site's transaction.
+  'dapp.reauth',
 ] as const;
 /**
  * Only the vault page itself may hand over keys, report a re-authentication it proved, hand over
@@ -86,7 +89,7 @@ const APPROVE_PAGE_ONLY: readonly string[] = ['dapp.pending', 'dapp.decide'];
  */
 const APPROVE_PAGE_ALLOWED: readonly string[] = APPROVE_PAGE_ONLY;
 /** …and #49's from the popup or the UI tab only — never the approval window a site caused, nor the vault page. */
-const WALLET_UI_ONLY: readonly string[] = ['dapp.grants.list', 'dapp.grants.revoke', 'dapp.grants.undo', 'dapp.grants.revokeAll', 'dapp.blocked.list', 'dapp.blocked.remove'];
+const WALLET_UI_ONLY: readonly string[] = ['dapp.grants.list', 'dapp.grants.revoke', 'dapp.grants.undo', 'dapp.grants.revokeAll', 'dapp.blocked.list', 'dapp.blocked.remove', 'dapp.reauth'];
 export const PAGE: readonly string[] = PAGE_TYPES;
 
 function isOwnPage(ext: Ext, s: Sender): boolean {
@@ -306,6 +309,8 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       return deps === undefined ? {ok: false, error: 'unavailable'} : listBlocked(ext, deps);
     case 'dapp.blocked.remove':
       return deps === undefined ? {ok: false, error: 'unavailable'} : unblock(ext, deps, (msg as {host?: unknown}).host);
+    case 'dapp.reauth':
+      return deps === undefined ? {ok: false, error: 'unavailable'} : reauthWaiting(ext, deps);
     case 'vault.storeEnvelope': {
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
       const dropped: string[] = [];
````

Change `extension/src/background/reauthChallenges.ts`:

````diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
index e410f30..2ed18eb 100644
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -50,6 +50,8 @@ export type ChallengeAbout =
 
 export interface DappOutgoing {
   mint: string | null;
+  /** The wallet's own name for the token (SOL for `mint` null; NOC, USDC, USDT by their mints), else null. */
+  symbol: 'SOL' | 'NOC' | 'USDC' | 'USDT' | null;
   amount: string;
   decimals: number | null;
 }
@@ -139,10 +141,11 @@ function isOutgoing(x: unknown): x is DappOutgoing {
   const decimals = o.decimals;
   return (
     (o.mint === null || (typeof o.mint === 'string' && ADDRESS.test(o.mint))) &&
+    (o.mint === null ? o.symbol === 'SOL' : o.symbol === null || (typeof o.symbol === 'string' && TOKENS.includes(o.symbol) && o.symbol !== 'SOL')) &&
     typeof o.amount === 'string' &&
     DIGITS.test(o.amount) &&
     (decimals === null || (isInt(decimals) && decimals >= 0 && decimals <= 18)) &&
-    Object.keys(o).length === 3
+    Object.keys(o).length === 4
   );
 }
````

Change `extension/src/unlock/challenge.ts`:

````diff
diff --git a/extension/src/unlock/challenge.ts b/extension/src/unlock/challenge.ts
index 0ddf1df..f62003f 100644
--- a/extension/src/unlock/challenge.ts
+++ b/extension/src/unlock/challenge.ts
@@ -18,6 +18,10 @@ export type TokenSymbol = keyof typeof TOKENS;
 const DIGITS = /^\d{1,20}$/;
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const SEND_KEYS = ['account', 'amount', 'kind', 'markupLamports', 'markupReason', 'networkLamports', 'priorityLamports', 'reasons', 'recipient', 'rentLamports', 'thresholdCents', 'token'];
+const DAPP_KEYS = ['account', 'kind', 'omitted', 'outgoing', 'reasons', 'site', 'thresholdCents', 'transactions'];
+const OUTGOING_KEYS = ['amount', 'decimals', 'mint', 'symbol'];
+/** A site as the approval window shows it: a host (ASCII / punycode, or an IP literal), with a port when it has one. */
+const SITE = /^[A-Za-z0-9.\-[\]:]{1,262}$/;
 const SETTINGS_KEYS = ['autoLockMinutes', 'kind', 'reauthUsdCents'];
 const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
 
@@ -40,7 +44,18 @@ export interface SettingsDescription {
   kind: 'settings';
   lines: string[];
 }
-export type Description = SendDescription | SettingsDescription;
+/** B1c-2: a dApp's transaction request (spec B1c §3.3): the site, how many transactions, what leaves the account, why. */
+export interface DappDescription {
+  kind: 'dapp';
+  site: string;
+  transactions: number;
+  /** One row per token leaving the account: the label (a symbol, or "Token") and the exact amount (never rounded). */
+  outgoing: {label: string; amount: string; mint: string | null}[];
+  /** How many more tokens leave the account than the rows show (plan 2 review 1 L9: the background lists at most 16). */
+  omitted: number;
+  reasons: string[];
+}
+export type Description = SendDescription | SettingsDescription | DappDescription;
 
 const sol = (lamports: string): string => `${formatAmount(BigInt(lamports), 9, {min: 0, max: 9})} SOL`;
 const dollars = (cents: number): string => formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2});
@@ -112,12 +127,56 @@ function describeSettings(a: Record<string, unknown>): SettingsDescription | nul
   return lines.length === 0 ? null : {kind: 'settings', lines};
 }
 
+/** One reason's line (#10's own table; `approval` is B1c-2's). */
+function reasonLine(r: unknown, thresholdCents: number): string | null {
+  if (r === 'over-usd-threshold') return REAUTH.overUsd(dollars(thresholdCents));
+  if (r === 'approval') return REAUTH.approval;
+  return typeof r === 'string' && own(REAUTH.reason, r) ? REAUTH.reason[r as keyof typeof REAUTH.reason] : null;
+}
+
+function describeDapp(a: Record<string, unknown>): DappDescription | null {
+  if (!hasExactly(a, DAPP_KEYS)) return null;
+  const {account, site, transactions, outgoing, omitted, reasons, thresholdCents} = a;
+  if (typeof account !== 'string' || !ADDRESS.test(account) || typeof site !== 'string' || !SITE.test(site) || !isInt(transactions, 1, 5) || !isInt(thresholdCents, 100, 100_000) || !isInt(omitted, 0, 10_000)) return null;
+  if (!Array.isArray(outgoing) || outgoing.length > 16 || !Array.isArray(reasons) || reasons.length === 0 || new Set(reasons).size !== reasons.length) return null;
+  const rows: DappDescription['outgoing'] = [];
+  for (const x of outgoing as unknown[]) {
+    if (typeof x !== 'object' || x === null || Array.isArray(x) || !hasExactly(x as Record<string, unknown>, OUTGOING_KEYS)) return null;
+    const {mint, symbol, amount, decimals} = x as Record<string, unknown>;
+    if (typeof amount !== 'string' || !DIGITS.test(amount)) return null;
+    if (mint === null) {
+      // SOL: its own name and nine decimals, nothing else.
+      if (symbol !== 'SOL' || decimals !== 9) return null;
+      rows.push({label: 'SOL', amount: `−${formatAmount(BigInt(amount), 9, {min: 0, max: 9})}`, mint: null});
+      continue;
+    }
+    if (typeof mint !== 'string' || !ADDRESS.test(mint)) return null;
+    if (symbol !== null) {
+      // A named token must carry its own decimals (this page's table): anything else describes no real token.
+      if (typeof symbol !== 'string' || !own(TOKENS, symbol) || symbol === 'SOL' || decimals !== TOKENS[symbol as TokenSymbol]) return null;
+      const d = TOKENS[symbol as TokenSymbol];
+      rows.push({label: symbol, amount: `−${formatAmount(BigInt(amount), d, {min: 0, max: d})}`, mint});
+      continue;
+    }
+    if (decimals !== null && !isInt(decimals, 0, 18)) return null;
+    rows.push({label: REAUTH.token, amount: decimals === null ? `−${REAUTH.baseUnits(amount)}` : `−${formatAmount(BigInt(amount), decimals, {min: 0, max: decimals})}`, mint});
+  }
+  const lines: string[] = [];
+  for (const r of reasons as unknown[]) {
+    const line = reasonLine(r, thresholdCents);
+    if (line === null) return null;
+    lines.push(line);
+  }
+  return {kind: 'dapp', site, transactions, outgoing: rows, omitted, reasons: lines};
+}
+
 /** The closed-alphabet renderer: a description built only from fixed strings and validated values, or null. */
 export function describeChallenge(about: unknown): Description | null {
   if (typeof about !== 'object' || about === null || Array.isArray(about)) return null;
   const a = about as Record<string, unknown>;
   if (a.kind === 'send') return describeSend(a);
   if (a.kind === 'settings') return describeSettings(a);
+  if (a.kind === 'dapp') return describeDapp(a);
   return null;
 }
````

Change `extension/src/unlock/screens/reauth.ts`:

````diff
diff --git a/extension/src/unlock/screens/reauth.ts b/extension/src/unlock/screens/reauth.ts
index 3339225..509c356 100644
--- a/extension/src/unlock/screens/reauth.ts
+++ b/extension/src/unlock/screens/reauth.ts
@@ -106,7 +106,7 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
     cancel.disabled = (busy && !cooling) || !canCancel;
     unlock.disabled = busy || !offerUnlock;
     x.disabled = (busy && !(cooling && canCancel)) || !(canCancel || view === 'notice');
-    x.setAttribute('aria-label', canCancel && !closeOnly && described?.kind !== 'settings' ? REAUTH.cancel : REAUTH.close);
+    x.setAttribute('aria-label', canCancel && !closeOnly && described?.kind !== 'settings' && described?.kind !== 'dapp' ? REAUTH.cancel : REAUTH.close);
   };
   const helper = (text: string, error: boolean) => {
     setText(byId('ra-helper'), text);
@@ -149,6 +149,27 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
       byId('ra-rows').replaceChildren(row(REAUTH.to, addressGroups(d.recipient)), ...d.fees.map(f => row(f.label, f.value)));
       byId('ra-reasons').replaceChildren(...d.reasons.map(r => h('p', 'noc-body-sm vlt-lede', r)));
       setText(cancel, REAUTH.cancelSend);
+    } else if (d.kind === 'dapp') {
+      // B1c-2: a site's transaction — the site, the batch's size when more than one, each token leaving the account
+      // (an unnamed token by its whole mint address, in groups), and why. Nothing here is sent: the approval window
+      // signs once this proof is in (and the user approves there again).
+      setText(byId('ra-about'), REAUTH.aboutDapp);
+      shown(byId('ra-amount-row'), false);
+      const rows = [row(REAUTH.site, d.site)];
+      if (d.transactions > 1) rows.push(row(REAUTH.transactions, String(d.transactions)));
+      for (const o of d.outgoing) {
+        if (o.mint === null || o.label !== REAUTH.token) rows.push(row(o.label, o.amount));
+        else {
+          const value = h('span');
+          value.append(o.amount, ' · ', addressGroups(o.mint));
+          rows.push(row(o.label, value));
+        }
+      }
+      // Review 1 L9: past the sixteen rows the background lists, the count of the rest.
+      if (d.omitted > 0) rows.push(row(REAUTH.omitted(d.omitted), null));
+      byId('ra-rows').replaceChildren(...rows);
+      byId('ra-reasons').replaceChildren(...d.reasons.map(r => h('p', 'noc-body-sm vlt-lede', r)));
+      setText(cancel, REAUTH.cancel);
     } else {
       setText(byId('ra-about'), REAUTH.aboutChange);
       shown(byId('ra-amount-row'), false);
@@ -173,6 +194,13 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
     endCooldown();
     field.value = '';
     // B1b-2b E9 (§3.7): a settings description has its own end states — applied by the background, or nothing changed.
+    // B1c-2: a dApp's transaction — the proof is all #10 does; the approval window signs on the user's next Approve.
+    if (described?.kind === 'dapp') {
+      if (out === 'confirmed') return notice(REAUTH.dappConfirmed);
+      if (out === 'expired') return notice(REAUTH.dappExpired);
+      if (out === 'not-unlocked') return notice(REAUTH.dappNotUnlocked, {unlock: true});
+      if (out === 'refused' || out === 'applied') return helper(COMMON.failedTryAgain, false);
+    }
     if (described?.kind === 'settings') {
       if (out === 'applied') return notice(REAUTH.settingsApplied);
       if (out === 'expired') return notice(REAUTH.settingsExpired, {help: REAUTH.settingsExpiredHelp});
@@ -251,7 +279,8 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
     if (stopCooldown !== null) return cancelInCooldown();
     void exclusive(deps, render, async () => {
       if (!canCancel) return;
-      if (described?.kind === 'settings' || closeOnly) return deps.closeTab();
+      // A setting, or a site's transaction (B1c-2: its request stays in the approval window, which can still reject it).
+      if (described?.kind === 'settings' || described?.kind === 'dapp' || closeOnly) return deps.closeTab();
       // E7: nothing of this send may outlive the cancel — its prepared send and its challenge go. The account is
       // the one challenge.ts validated (the description's, or the undescribable record's own).
       const account = described?.kind === 'send' ? described.account : orphan;
````

Change `extension/src/unlock/strings.ts`:

````diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index a9e67a3..80ae1f6 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -412,6 +412,18 @@ export const REAUTH = {
     'whole-balance-to-new': 'Re-auth required to send your whole balance to a new address.',
   },
   overUsd: (dollars: string): string => `Re-auth required for transactions over $${dollars}.`,
+  /** B1c-2 — controller copy, owner to confirm (Scope): a dApp's transaction, described in #10. */
+  aboutDapp: 'You are about to approve',
+  site: 'Site',
+  transactions: 'Transactions',
+  token: 'Token',
+  baseUnits: (amount: string): string => `${amount} (base units)`,
+  /** Plan 2 review 1 L9 — controller copy, owner to confirm (Scope R28): the tokens past the sixteen #10 lists. */
+  omitted: (n: number): string => `and ${n} more ${n === 1 ? 'token' : 'tokens'}`,
+  approval: 'Re-auth required to approve a token allowance.',
+  dappConfirmed: 'Confirmed. Go back to the approval window and approve the transaction.',
+  dappExpired: 'This confirmation has expired. Approve the transaction again in the approval window.',
+  dappNotUnlocked: "The wallet locked while you were confirming. The site's request was declined — ask the site to try again.",
   autoLock: (minutes: number): string => `Auto-lock → ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
   threshold: (dollars: string): string => `Re-authentication threshold → $${dollars}`,
 } as const;
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run src/app/__tests__/Home.test.tsx src/app/__tests__/Switcher.test.tsx src/background/__tests__/messages.test.ts src/background/dapp/__tests__/signTx.test.ts src/unlock/__tests__/challenge.test.ts src/unlock/__tests__/reauthScreen.test.ts` — expected: Test Files  6 passed (6) · Tests  177 passed (177)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  163 passed (163) · Tests  3211 passed (3211). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M6a | `signTx.ts`: dapp.reauth offers a proven challenge | signTx.test.ts "dapp.reauth …" (null once proven) — RED Tests  1 failed \| 18 passed (19) |
| M6b | `unlock/challenge.ts`: a named token's decimals not checked | challenge.test.ts "fails closed" — RED Tests  1 failed \| 35 passed (36) |
| M6c | `unlock/screens/reauth.ts`: a proven dApp challenge reported as failed | reauthScreen.test.ts "a dApp's transaction: …confirmed" — RED Tests  1 failed \| 49 passed (50) |
| M6d | `Home.tsx`: the strip opens another challenge | Home.test.tsx "the strip names the site and opens #10 for that challenge" — RED Tests  1 failed \| 31 passed (32) |
| M6e | `reauthChallenges.ts`: a `dapp` outgoing of four keys refused | signTx.test.ts "a first send" (the challenge is not issued) — RED Tests  5 failed \| 14 passed (19) |
| M6f | `unlock/screens/reauth.ts`: the omitted count never shown | reauthScreen.test.ts "…and 2 more tokens" — RED Tests  1 failed \| 49 passed (50) |
| M6g | `unlock/challenge.ts`: `omitted` accepted as any number | challenge.test.ts "fails closed: … a count of omitted tokens that is not a whole number ≥ 0" — RED Tests  1 failed \| 35 passed (36) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-2 re-authentication through the toolbar — dapp.reauth, the popup's strip, #10 for a site's transaction (D11)" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 7: #48 in the approval window: every state B1c-2 owns, and the origin-mismatch notice; the design's #48 and OriginBadge classes extracted

**Spec:** §3.3 (#48), §4.3 (the window), C13, C15, §9 (#48 rows), Q21, Q26; design ix:18261-18705; Scope R2, R3, R17–R22, R26; Review Focus 1

**Files:**
- Test (new): `extension/scripts/__tests__/extract-design-css.test.mjs`
- Create: `extension/scripts/extract-design-css.mjs`
- Test: `extension/src/__tests__/designExt2b.test.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/approve/Approve.tsx`
- Create: `extension/src/approve/Mismatch.tsx`
- Create: `extension/src/approve/Tx.tsx`
- Test (new): `extension/src/approve/__tests__/tx.test.tsx`
- Test: `extension/src/approve/__tests__/windowHarness.tsx`
- Modify: `extension/src/approve/client.ts`
- Modify: `extension/src/approve/strings.ts`
- Test: `extension/src/background/dapp/__tests__/txHarness.ts`
- Modify: `extension/src/styles/design-ext.css` (generated — the script in Step 3)

**Interfaces:**
- Consumes: Task 4's `dapp.pending` view (`request.tx`, `request.mismatch`) and `dapp.decide`'s `simulation`; B1c-1's `WindowTop`, `OriginCard`, `LookalikeBanner`, `ConfirmButton`, `RiskConfirm`, `BudgetNotice`, `Waiting`, `BlockSite`, `Spinner`, `siteLabel`, `useArmed`; `AddressGroups`, `fromBook`, `showFee`, `feeUsd`, `formatAmount`.
- Produces:
  - `approve/client.ts`: `ProgramKey`, `FieldValue`, `Field`, `DecodedInstruction`, `BalanceChange`, `TxOutcome`, `TxItem`, `SimulationView`, `AddressLabel`, `TxDetail`; `RequestView.type` gains the three types, `RequestView.tx`, `RequestView.mismatch`; `Decision`'s approve gains `simulation?: string` — every reply re-validated (`txDetailOf`).
  - `approve/strings.ts`: `TX_TEXT` (with the owner-delegated `noChanges`, `sendsSite`, `sendsNoctura`, `stale` — L3, L7, L4), `MISMATCH_TEXT`. `Approve.tsx`'s `decide` returns `dapp.decide`'s reply to the screen (R30).
  - `scripts/extract-design-css.mjs` (committed): `OUT_PATH`, `DEFAULT_DESIGN`, `PREFIXES`, `KEYFRAMES`, `rulesOf(css)`, `kept(rule)`, `HEADER`, `extractDesignCss(html)`; `--check`.
  - `approve/Tx.tsx`: `Tx`; `approve/Mismatch.tsx`: `Mismatch`; `Approve.tsx` routes the three types.
  - `styles/design-ext.css` (regenerated): `.s9-sim-banner`, `.s9-bal-card`, `.s9-bal-row`, `.s9-origin-pill`, `.origin-badge`; `app.css`: `.app-tx-*`.
  - `approve/__tests__/windowHarness.tsx`: `openWindow({chain})`, `signTx(origin, transactions, {send})`; `txHarness.ts` exports `chainReader`, `newChain`.

#48 on the design's own classes. Simulating: the origin card, the banner with #19's server line, the balance card in skeleton at .55 ("Balance changes (waiting…)"), the decoded instructions already shown, "This is mandatory — no skip", Approve disabled ("Approve · simulating") and ✕ disabled (R20). Simulated: "Balance changes (post-simulation)" with a row per mint (the token tile, the signed amount exact in `--danger` / `--success`, the dollars when priced), the instructions ("Program n" → the program and its name, the instruction, every field — addresses whole in groups with their labels, R3), "Compute units" consumed / limit, "Network fee" when the account pays it, and the origin pill (R19). A batch: a section per transaction. Re-authentication (R9): the line before Approve; after Approve, the banner pointing to the toolbar, Approve held until the background says the challenge is proven. Couldn't simulate (the node's error in mono), unreachable, Q21: only Reject (R8). Lookalike: the banner, the flipped bar, the 2-second confirm (R18). Approving: "Approving", the body at .65, "Approving…" with the ring, everything disabled. Q26 when the request can no longer be signed (R21). Under the origin card on every state, who sends (R31, L7); after an approval refused `stale`, the owner's line in a warn banner until the next click, the refreshed effects shown and Approve held again (R30, L4); a simulation that moves none of the account's balances says "No SOL or token balance changes — review the instructions below." (L3). The mismatch notice keeps the design's hero, banner, detail rows (the session in `--success`, the request and the verdict in `--danger`) and caption (R17). Approve is a `ConfirmButton`: held 500 ms after focus and after every state change — the request, the simulation's id, the re-authentication's state, busy, the confirm (C15).

Regenerate `extension/src/styles/design-ext.css` — never edit it by hand — with `scripts/extract-design-css.mjs`, **committed** with this task (review 1 M2; B1c plan 1's extraction script, until now kept outside the repository, with one line of prefixes added — the line marked "B1c plan 2" — and the header naming the script), given in full below. Run it from `extension/`: `node scripts/extract-design-css.mjs` (the design file: an argument, else `$NOCTURA_DESIGN_HTML`, else `/home/user/Downloads/index.html`), then `node scripts/extract-design-css.mjs --check` — expected `design-ext.css is the extraction output`. A sanity check first: plan 1's script (the "B1c plan 2" line removed, plan 1's header) reproduces the current file, `b01d1aa0273497f2510a43e614f700baad277384cb6d3b65f554fdfed3070b11`; a different hash means `/home/user/Downloads/index.html` changed — stop and ask the controller. The output is 1 920 lines (25 more; the header's lines are reworded, not added), sha256 `c91f92205f2d033d27dfe578e7d7515db37a0e240ddb0aca4752834c9551da44` (pinned by `designExt2b.test.ts`, re-pinned in this task; `scripts/__tests__/extract-design-css.test.mjs` checks, without the design, that the file is the script's header and only rules the script keeps). The resulting diff is in the blocks below, for review.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/extract-design-css.test.mjs`:

````js
import {readFileSync} from 'node:fs';
import {HEADER, OUT_PATH, kept, rulesOf} from '../extract-design-css.mjs';

// Global constraints (plan 2 review 1 M2): design-ext.css is generated only. CI has no design file, so this checks
// what it can without one: the file is the script's header and then only rules the script keeps — a rule typed in by
// hand under any other selector fails here. The byte-for-byte check against the design is `--check` (Task 7 Step 3).
describe('the design CSS extraction', () => {
  const css = readFileSync(OUT_PATH, 'utf8');

  it('design-ext.css starts with the script’s HEADER, and every rule after it is one the extraction keeps', () => {
    expect(css.startsWith(HEADER)).toBe(true);
    const rules = rulesOf(css.slice(HEADER.length));
    expect(rules.length).toBeGreaterThan(800);
    expect(rules.filter(r => !kept(r))).toEqual([]);
  });

  // Negative controls: a rule under a prefix the script does not list, and an at-rule, are not kept.
  it('a hand-added rule outside the listed prefixes, or an @media block, is not kept (negative controls)', () => {
    expect(kept('.app-mine { color: red; }')).toBe(false);
    expect(kept('@media (max-width: 400px) { .screen { padding: 0; } }')).toBe(false);
    expect(kept('.s9-bal-card .label { color: red; }')).toBe(true);
  });
});
````

Change `extension/src/__tests__/designExt2b.test.ts`:

````diff
diff --git a/extension/src/__tests__/designExt2b.test.ts b/extension/src/__tests__/designExt2b.test.ts
index 7a58c0f..0b76ad0 100644
--- a/extension/src/__tests__/designExt2b.test.ts
+++ b/extension/src/__tests__/designExt2b.test.ts
@@ -28,7 +28,14 @@ describe('design-ext.css (B1b-2b plan 1)', () => {
     }
   });
 
-  it('is the extraction output, byte for byte (the hash the plan pins)', () => {
-    expect(createHash('sha256').update(CSS).digest('hex')).toBe('b01d1aa0273497f2510a43e614f700baad277384cb6d3b65f554fdfed3070b11');
+  // B1c plan 2 re-ran the extraction with #48's classes and #26/#27's OriginBadge added (ix:3824-3859, 4080-4084).
+  it('carries #48’s classes and the OriginBadge (B1c plan 2)', () => {
+    for (const sel of ['.s9-sim-banner .m3', '.s9-bal-card .label', '.s9-bal-row .delta.neg', '.s9-bal-row .fiat', '.s9-origin-pill .dot.ok', '.origin-badge[data-origin="dapp"]']) {
+      expect(CSS).toContain(`${sel} `);
+    }
+  });
+
+  it('is the extraction output, byte for byte (the hash the plan pins; scripts/extract-design-css.mjs --check against the design)', () => {
+    expect(createHash('sha256').update(CSS).digest('hex')).toBe('c91f92205f2d033d27dfe578e7d7515db37a0e240ddb0aca4752834c9551da44');
   });
 });
````

Create `extension/src/approve/__tests__/tx.test.tsx`:

````tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {ed25519} from '@noble/curves/ed25519.js';
import {base64} from '@scure/base';
import {VersionedTransaction} from '@solana/web3.js';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {handleMessage} from '../../background/messages';
import {setSession} from '../../background/session';
import {readDappSession} from '../../background/dapp/store';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {openPage} from '../../background/dapp/__tests__/pageHarness';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {ME, coSigned, transfer, v0} from '../../background/dapp/__tests__/txHarness';
import {ARM_MS} from '../useArmed';
import {CONFIRM_DELAY_MS} from '../ui';
import {SECOND, openWindow} from './windowHarness';

const SELECTORS = selectorsOf(UI_SHEETS);
const text = (sel: string) => document.querySelector(sel)?.textContent ?? null;
const texts = (sel: string) => [...document.querySelectorAll(sel)].map(e => e.textContent);
const cta = (name: string | RegExp) => screen.getByRole('button', {name}) as HTMLButtonElement;
const armedAfter = () => new Promise(r => setTimeout(r, ARM_MS + 50));
const unstyled = () => unstyledClasses(document.querySelector('.app-approve')!, SELECTORS);
/** The recipient is known (no first-send re-authentication) unless a test says otherwise. */
const known = (w: Awaited<ReturnType<typeof openWindow>>) => w.ext.local.set('v1_known_recipients', [{address: RECIPIENT, at: 1}]);
afterEach(() => cleanup());
/**
 * The window learns by polling (§2.3): its first read starts the simulation (the background runs it outside the read);
 * this waits — deterministically, on the background's own state — until the simulation is stored, then gives the window
 * the read it would make on its next poll (a focus, as a user returning to the window), and waits for it to render.
 */
async function simulated(w: Awaited<ReturnType<typeof openWindow>>, shows: string): Promise<void> {
  await waitFor(async () => expect((await readDappSession(w.ext)).queue[0]?.sim ?? null).not.toBeNull());
  await act(async () => void window.dispatchEvent(new Event('focus')));
  await screen.findAllByText(shows);
}

// Spec B1c §3.3, #48 (index.html ix:18261-18705), against the real background.
describe('#48 dapp-tx-approval', () => {
  it('simulating-blocking, then simulated: the banner and skeleton, Approve disabled; then the changes beside the decoded instructions, the fee, the origin pill — Approve held 500 ms, then signed', async () => {
    const w = await openWindow();
    await known(w);
    // The simulation answers only when released: the blocking state is held, never slept through.
    const reader = w.deps.reader;
    let release!: () => void;
    const gate = new Promise<void>(r => (release = r));
    const simulate = reader.simulateTransaction;
    reader.simulateTransaction = async (...a) => {
      await gate;
      return simulate(...a);
    };
    // 0.001 SOL to a known recipient: no re-authentication rule fires (under 5 %, under $100).
    const {page, requestId} = await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
    w.show();
    await screen.findByText('Simulating transaction…');
    expect([text('.top-bar .title'), text('.s9-sim-banner .meta')]).toEqual(['Approve transaction', 'Noctura server · simulateTransaction']);
    expect(text('.s9-bal-card .label')).toBe('Balance changes (waiting…)');
    expect(document.querySelector('.s9-bal-card')?.className).toBe('s9-bal-card app-busy-dim');
    // The instructions are shown while simulating (decoded locally).
    expect(texts('.s9-payload-card > .app-tx-ix .row .k')).toEqual(['Program 1', 'instruction', 'from', 'to', 'lamports']);
    expect(text('.app-tx-caption')).toBe('Simulation runs against the current slot before you see Approve. This is mandatory — no skip.');
    // Review 1 L7: who broadcasts — for signTransaction, the site.
    expect(text('.app-tx-sends')).toBe('The site sends this transaction itself after you approve.');
    const pending = cta(/Approve/);
    expect([pending.textContent, pending.disabled]).toEqual(['Approve· simulating', true]);
    // ✕ disabled during the simulation, as drawn; Reject open.
    expect([cta('Close').disabled, cta('Reject').disabled]).toEqual([true, false]);
    expect(unstyled()).toEqual([]);
    release();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.s9-bal-row .pri')).toEqual(['SOL']);
    expect(texts('.s9-bal-row .delta')).toEqual(['−0.001005']);
    expect(texts('.s9-bal-row .fiat')).toEqual(['$0.15']);
    expect(texts('.s9-payload-card .row .k')).toEqual(['Program 1', 'instruction', 'from', 'to', 'lamports', 'Compute units', 'Network fee']);
    expect(text('.s9-payload-card .app-tx-addr-label')).toBe('Your account: Main');
    expect(texts('.s9-payload-card > .row .v')).toEqual(['450 / 200 000', '0.000 005 SOL']);
    expect(text('.s9-origin-pill .body')).toBe('Request from jup.ag · matches active session');
    expect(document.querySelector('.s9-sim-banner')).toBeNull();
    expect(unstyled()).toEqual([]);
    expect(cta('Approve').disabled).toBe(true);
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    const signed = (page.answersFor(requestId)[0]?.result as {signed: string[]}).signed;
    const tx = VersionedTransaction.deserialize(base64.decode(signed[0] ?? ''));
    expect(ed25519.verify(tx.signatures[0] ?? new Uint8Array(), tx.message.serialize(), ME.toBytes())).toBe(true);
    // The harness's closed window reads nothing more (rev 2 dry run): a later focus never counts a second close.
    await act(async () => void window.dispatchEvent(new Event('focus')));
    expect(w.closed.n).toBe(1);
  });

  it('a batch: each transaction’s section on one screen, approved as a whole; a co-signer’s fee is not this account’s', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0([transfer(1)]), coSigned()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(texts('.app-tx-batch')).toEqual(['Transaction 1 of 2', 'Transaction 2 of 2']);
    // The co-signed one: the dApp pays the fee — no Network fee row in its section.
    const sections = [...document.querySelectorAll('.app-tx-item')];
    expect(sections.map(sec => [...sec.querySelectorAll('.s9-payload-card > .row .k')].map(k => k.textContent))).toEqual([
      ['Compute units', 'Network fee'],
      ['Compute units'],
    ]);
    expect(unstyled()).toEqual([]);
  });

  it('couldn’t simulate, an unreachable proxy, an expired blockhash (Q21): the reason, and only Reject', async () => {
    for (const [err, down, head, line] of [
      [{InstructionError: [0, {Custom: 1}]}, false, "Couldn't simulate", '{"InstructionError":[0,{"Custom":1}]}'],
      [null, true, "Couldn't simulate", 'Could not reach the Noctura server.'],
      ['BlockhashNotFound', false, 'This request has expired. Ask the site to try again.', null],
    ] as const) {
      cleanup();
      const w = await openWindow();
      w.chain.err = err;
      w.chain.down = down;
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, head);
      if (line !== null) expect(texts('.s9-flag-banner.danger .body, .s9-flag-banner.danger .meta')).toEqual([line]);
      expect(screen.queryByRole('button', {name: /Approve/})).toBeNull();
      expect(cta('Reject').disabled).toBe(false);
      expect(document.querySelector('.s9-bal-card')).toBeNull();
      expect(unstyled()).toEqual([]);
    }
  });

  it('re-authentication (B1b’s rules, D11): the line before Approve; Approve asks, the window points to the toolbar, Approve waits; proven → it signs', async () => {
    const w = await openWindow();
    const {page, requestId} = await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
    w.show();
    await simulated(w, "Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.");
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await screen.findByText("Confirm it's you");
    expect(text('.s9-flag-banner.warn .body')).toBe("Click the Noctura icon in your browser's toolbar and confirm with your password (or passkey). This request will wait here.");
    // The window never links into the vault page: no link, no input of any kind.
    expect(document.querySelectorAll('a, input, select, textarea')).toHaveLength(0);
    await armedAfter();
    expect(cta('Approve').disabled).toBe(true);
    const challengeId = String((await readDappSession(w.ext)).queue[0]?.challengeId);
    await handleMessage(w.ext, {type: 'vault.reauthOk', challengeId}, {id: w.ext.runtimeId, origin: w.ext.extensionOrigin, url: `${w.ext.extensionOrigin}/unlock.html`}, w.deps);
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(screen.queryByText("Confirm it's you")).toBeNull());
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toHaveLength(1);
  });

  it('a lookalike origin: no origin pill, the banner, [Reject and report] primary, "Approve anyway (not recommended)" → the 2-second confirm → signed', async () => {
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://tensr.trade', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.top-bar .title')).toBe('Suspicious origin');
    expect(document.querySelector('.s9-origin-pill')).toBeNull();
    expect(text('.s9-domain-warn .body b')).toBe('This domain is not tensor.trade');
    expect(cta('Reject and report').className).toBe('btn btn-destructive');
    await armedAfter();
    fireEvent.click(cta('Approve anyway (not recommended)'));
    const sheet = await screen.findByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'});
    await new Promise(r => setTimeout(r, CONFIRM_DELAY_MS + 50));
    fireEvent.click(within(sheet).getByRole('button', {name: 'I understand the risk'}));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect((page.answersFor(requestId)[0]?.result as {signed: string[]}).signed).toHaveLength(1);
    expect(unstyled()).toEqual([]);
  });

  it('signAndSendTransaction: "Noctura sends this transaction as soon as you approve." under the origin (review 1 L7)', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0()], {send: true});
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.app-tx-sends')).toBe('Noctura sends this transaction as soon as you approve.');
    expect(unstyled()).toEqual([]);
  });

  it('no balance change of the account’s: "No SOL or token balance changes — review the instructions below." (review 1 L3)', async () => {
    const w = await openWindow();
    await known(w);
    // The dApp pays the fee; the account signs a transfer of nothing.
    await w.signTx('https://jup.ag', [coSigned([transfer(0, ME)])]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    expect(text('.app-tx-none')).toBe('No SOL or token balance changes — review the instructions below.');
    expect(texts('.s9-bal-row')).toEqual([]);
  });

  it('a refresh that lands between the read and the click (stale): the line says why, the new effects are shown, Approve is held again (review 1 L4)', async () => {
    const STALE = 'The transaction changed while you were reviewing. Review it again before approving.';
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://jup.ag', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await armedAfter();
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    // The window's read starts the refresh in the background; the window still shows the first simulation.
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    expect(screen.queryByText(STALE)).toBeNull();
    fireEvent.click(cta('Approve'));
    await screen.findByText(STALE);
    expect(page.answersFor(requestId)).toEqual([]);
    expect(cta('Approve').disabled).toBe(true);
    expect(unstyled()).toEqual([]);
    // The next click (after the hold) approves the simulation now shown, and the line goes.
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await waitFor(() => expect(w.closed.n).toBe(1));
    expect(page.answersFor(requestId)).toHaveLength(1);
  });

  it('C15: a new simulation re-holds Approve; Enter never approves', async () => {
    const w = await openWindow();
    await known(w);
    const {page, requestId} = await w.signTx('https://jup.ag', [v0()]);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await armedAfter();
    expect(cta('Approve').disabled).toBe(false);
    fireEvent.keyDown(cta('Approve'), {key: 'Enter'});
    expect(page.answersFor(requestId)).toEqual([]);
    // A refresh lands (its id changes): the window's next read shows it, and Approve is held again in that render.
    const first = (await readDappSession(w.ext)).queue[0]?.sim;
    w.deps.clock.t += 30_000;
    // The window's read (a visibilitychange: no re-hold of its own) starts the refresh in the background.
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(async () => expect((await readDappSession(w.ext)).queue[0]?.sim).not.toEqual(first));
    // A read that is not a focus (focus alone re-holds, C15): the window's own poll, run now.
    expect(cta('Approve').disabled).toBe(false);
    await act(async () => void document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(cta('Approve').disabled).toBe(true));
  });

  it('approving: "Approving", the body at .65, "Approving…" with the ring, every CTA and ✕ disabled', async () => {
    const w = await openWindow();
    await known(w);
    await w.signTx('https://jup.ag', [v0()]);
    const send = w.client.decide;
    w.client.decide = () => new Promise(() => undefined);
    w.show();
    await simulated(w, 'Balance changes (post-simulation)');
    await armedAfter();
    fireEvent.click(cta('Approve'));
    await screen.findByRole('button', {name: 'Approving…'});
    expect(text('.top-bar .title')).toBe('Approving');
    expect(document.querySelector('.app-approve-scroll')?.className).toContain('app-tx-busy');
    expect([cta('Approving…').disabled, cta('Reject').disabled, cta('Close').disabled]).toEqual([true, true, true]);
    expect(unstyled()).toEqual([]);
    w.client.decide = send;
  });

  it('can no longer be signed (the account left the session): Q26 and only Reject', async () => {
    const w = await openWindow();
    await w.signTx('https://jup.ag', [v0()]);
    // The granted account leaves the unlocked session (the other account stays): its detail cannot be built.
    await setSession(w.ext, [SECOND]);
    w.show();
    await screen.findByText('This request can no longer be signed. Reject it and ask the site to try again.');
    expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
  });
});

// #48 "origin-mismatch · auto-reject" (ix:18484-18521).
describe('#48 origin-mismatch · auto-reject', () => {
  it('the design’s hero, banner and detail rows; [OK, return to dApp] only dismisses; no Approve; the page was answered unauthorized', async () => {
    const w = await openWindow();
    // jup.ag holds the grant; dapp.test asks to sign with that account.
    await w.ext.local.set(GRANTS_KEY, [{origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
    const page = openPage(w.ext, w.deps, 'https://dapp.test', {tab: {id: 99}});
    expect(await page.ask({type: 'page.signTransaction', id: 'm', account: ACCOUNT.publicKey, transactions: [v0()]})).toEqual({id: 'm', error: 'unauthorized'});
    w.show();
    await screen.findByText('Request blocked automatically');
    expect([text('.top-bar .title'), document.querySelector('.top-bar .title')?.className]).toEqual(['Auto-rejected · Origin mismatch', 'title noc-overline noc-danger']);
    expect(text('.s9-fail-hero .sub')).toBe('A transaction came from a different origin than the one you connected. We rejected it without showing Approve.');
    expect(text('.s9-flag-banner .head')).toBe('Origin mismatch · auto-reject');
    expect(text('.s9-flag-banner .body')).toBe('A connected session for jup.ag received a transaction request from dapp.test. This is almost always a man-in-the-middle attempt. The request was dropped without prompting.');
    expect(texts('.s9-payload-card .row .k')).toEqual(['Active session', 'Request origin', 'Match', 'Action']);
    expect(texts('.s9-payload-card .row .v')).toEqual(['jup.ag', 'dapp.test', 'false', 'REJECT_NO_PROMPT']);
    expect(text('.app-tx-caption')).toBe('If you believe this is legitimate, disconnect the existing jup.ag session in Settings → Connected dApps and reconnect through the new domain explicitly. Never approve cross-origin transactions.');
    expect(screen.queryByRole('button', {name: /Approve|Review session/})).toBeNull();
    expect(unstyled()).toEqual([]);
    fireEvent.click(cta('OK, return to dApp'));
    await waitFor(() => expect(w.closed.n).toBe(1));
  });
});
````

Change `extension/src/approve/__tests__/windowHarness.tsx`:

````diff
diff --git a/extension/src/approve/__tests__/windowHarness.tsx b/extension/src/approve/__tests__/windowHarness.tsx
index 459e991..cc2bca1 100644
--- a/extension/src/approve/__tests__/windowHarness.tsx
+++ b/extension/src/approve/__tests__/windowHarness.tsx
@@ -12,6 +12,7 @@ import {fakeExt} from '../../background/__tests__/fakeExt';
 import {fakeDeps} from '../../background/__tests__/fakeDeps';
 import {ACCOUNT} from '../../background/__tests__/fixtures';
 import {openPage, type Page} from '../../background/dapp/__tests__/pageHarness';
+import {chainReader, newChain, type Chain} from '../../background/dapp/__tests__/txHarness';
 
 /** A second real keypair (32 × 0x02): vault.setKeys checks every key. */
 const SEED2 = new Uint8Array(32).fill(2);
@@ -30,9 +31,11 @@ export const ENV = {
  * The approval window against the REAL background (handleMessage with approve.html as the sender, the fake chrome.*),
  * and pages that ask it through the real page partition (pageHarness). `closed` counts window.close().
  */
-export async function openWindow(o: {unlocked?: boolean} = {}) {
+export async function openWindow(o: {unlocked?: boolean; chain?: Chain} = {}) {
   const ext = fakeExt();
-  const deps = fakeDeps();
+  // B1c-2: the chain a transaction request is simulated against (txHarness's steered one).
+  const chain = o.chain ?? newChain();
+  const deps = fakeDeps({reader: chainReader(chain)});
   await ext.local.set(VAULT_KEY, ENV);
   if (o.unlocked !== false) {
     await setSession(ext, [ACCOUNT, SECOND]);
@@ -40,11 +43,14 @@ export async function openWindow(o: {unlocked?: boolean} = {}) {
   }
   const approve = {id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/approve.html`};
   const sent: unknown[] = [];
+  const closed = {n: 0};
+  // B1c-2 (plan 2 rev 2, dry-run item): a closed window is gone — it reads nothing more. Without this, a still-mounted
+  // window's next 1 s poll read `none` again and counted a second close, so `closed.n === 1` was a race under load.
   const client: ApproveClient = createClient(m => {
+    if (closed.n > 0) return Promise.reject(new Error('the window is closed'));
     sent.push(m);
     return handleMessage(ext, m, approve, deps);
   });
-  const closed = {n: 0};
   let tab = 10;
   /** A page on its own tab that asks to connect; the request's id and the page. */
   const connect = async (origin: string): Promise<{page: Page; requestId: string}> => {
@@ -61,11 +67,24 @@ export async function openWindow(o: {unlocked?: boolean} = {}) {
     if (r?.accepted !== true) throw new Error(`sign request not queued: ${JSON.stringify(r)}`);
     return {page, requestId: String(r.requestId)};
   };
+  /**
+   * B1c-2: a page holding a persistent grant for ACCOUNT that asks to sign these transactions (base64) — or to sign and
+   * send the first; `known` makes the recipients known (no re-authentication for a first send).
+   */
+  const signTx = async (origin: string, transactions: string[], o2: {send?: boolean} = {}): Promise<{page: Page; requestId: string}> => {
+    const grants = ((await ext.local.get(GRANTS_KEY)) as unknown[] | undefined) ?? [];
+    await ext.local.set(GRANTS_KEY, [...grants, {origin, account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
+    const page = openPage(ext, deps, origin, {tab: {id: tab++}});
+    const m = o2.send === true ? {type: 'page.signAndSendTransaction', transaction: transactions[0]} : {type: 'page.signTransaction', transactions};
+    const r = await page.ask({...m, id: `t${tab}`, account: ACCOUNT.publicKey});
+    if (r?.accepted !== true) throw new Error(`transaction request not queued: ${JSON.stringify(r)}`);
+    return {page, requestId: String(r.requestId)};
+  };
   const show = () =>
     render(
       <div className="app app-window">
         <Approve client={client} close={() => void (closed.n += 1)} />
       </div>,
     );
-  return {ext, deps, client, closed, sent, connect, sign, show, unlock: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, {...approve, url: `${ext.extensionOrigin}/unlock.html`}, deps)};
+  return {ext, deps, chain, client, closed, sent, connect, sign, signTx, show, unlock: () => handleMessage(ext, {type: 'vault.setKeys', accounts: [ACCOUNT, SECOND]}, {...approve, url: `${ext.extensionOrigin}/unlock.html`}, deps)};
 }
````

Change `extension/src/background/dapp/__tests__/txHarness.ts`:

````diff
diff --git a/extension/src/background/dapp/__tests__/txHarness.ts b/extension/src/background/dapp/__tests__/txHarness.ts
index 9bfd3ad..4e3db66 100644
--- a/extension/src/background/dapp/__tests__/txHarness.ts
+++ b/extension/src/background/dapp/__tests__/txHarness.ts
@@ -45,7 +45,8 @@ export interface Chain {
   down: boolean;
 }
 
-function chainReader(chain: Chain): SolanaReader {
+/** The steered chain (exported for the approval window's tests). */
+export function chainReader(chain: Chain): SolanaReader {
   const count = (m: string) => chain.calls.set(m, (chain.calls.get(m) ?? 0) + 1);
   const up = (m: string) => {
     count(m);
@@ -92,9 +93,11 @@ export async function until(done: () => Promise<boolean>, turns = 400): Promise<
   throw new Error('never settled');
 }
 
+export const newChain = (): Chain => ({err: null, calls: new Map(), down: false});
+
 export async function txScene(o: {grant?: Partial<Grant> | null; known?: string[]} = {}) {
   const ext = fakeExt();
-  const chain: Chain = {err: null, calls: new Map(), down: false};
+  const chain = newChain();
   const deps = fakeDeps({reader: chainReader(chain)});
   await ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]});
   await setSession(ext, [ACCOUNT]);
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run scripts/__tests__/extract-design-css.test.mjs src/__tests__/designExt2b.test.ts src/approve/__tests__/tx.test.tsx`

Expected (the dry run): Test Files  3 failed (3) · Tests  14 failed | 3 passed (17)

- [ ] **Step 3: Implement.**

After saving the files below (the extraction script among them), regenerate the stylesheet — from `extension/`:

```bash
node scripts/extract-design-css.mjs
node scripts/extract-design-css.mjs --check   # design-ext.css is the extraction output
sha256sum src/styles/design-ext.css            # c91f9220…9551da44
```

Create `extension/scripts/extract-design-css.mjs`:

````js
// The design classes web/src/styles/design-system.css lacks, copied out of the owner's design file under the same class
// names (spec B1b-2a §1.2, §1.7): writes extension/src/styles/design-ext.css from the design file's first <style> block.
// Committed by B1c plan 2 (review 1 M2; until then each plan ran a copy from outside the repository).
//
//   node extension/scripts/extract-design-css.mjs [<index.html>]          # writes design-ext.css
//   node extension/scripts/extract-design-css.mjs --check [<index.html>]  # exits 1 if design-ext.css is not its output
//
// The design file: the argument, else $NOCTURA_DESIGN_HTML, else /home/user/Downloads/index.html (the owner's file —
// CLAUDE.md, "Design — Source of Truth"). Re-run it when a plan adds a prefix below (and say so in its commit), or when
// the owner's design changes a class this extension uses; then re-pin the hash in src/__tests__/designExt2b.test.ts.
// CI never runs it (CI has no design file): src/__tests__/designExt2b.test.ts checks, without it, that every rule in
// design-ext.css is one this script keeps and that the file starts with HEADER.
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const OUT_PATH = join(here, '..', 'src', 'styles', 'design-ext.css');
export const DEFAULT_DESIGN = '/home/user/Downloads/index.html';

export const PREFIXES = ['.screen', '.top-bar', '.sticky-bar', '.scroll-area', '.banner', '.s-dash', '.s-recv', '.s-act', '.s-txd', '.s-vi-top', '.tx-row',
  '.s7-list', '.s7-group-label', '.s7-row', '.s7-wordmark', '.s8-sheet', '.s8-sheet-overlay', '.s8-token-row', '.s8-tok', '.s8-offline-banner',
  '.s8-stale', '.s8-stale-mark', '.s8-empty-illust', '.s8-empty-copy', '.tab-bar', '.chip-row', '.copy-toast', '.skel-line', '.skel-circle', '.skel-tile', '.skel-block',
  // Plan 2 (B1b-2a-2): the vault-page screens #1–#6, #8–#10, #39 and the UI tab's #7 and #40.
  '.card', '.trust-chip', '.s-welcome', '.s-secintro', '.s-seed', '.s-seed-modal', '.s-confirm', '.s-pin', '.cooldown-card', '.s-bio', '.s-success', '.s-import',
  '.s8-step-card', '.s8-success-hero', '.s8-recovered-card', '.s8-addr-chip',
  // Plan 3 (B1b-2a-3): the send flow — #12, #19, #20, #21, #44 (and its cancelled toast), #54.
  '.s-send', '.s-sim', '.s-conf', '.s-stat', '.s-stuck', '.s9-fail-hero', '.s9-reason-banner', '.s9-payload-card', '.s9-toast-cancelled',
  // B1b-2b plan 1: #31's tip, #35's picker, score card (no ring, C15) and tasks, #36's stepper, #37's typed field and long-press, 36e's toast.
  '.s7-picker', '.s7-tip', '.s7-score-card', '.s7-task', '.s7-stepper', '.s7-pw', '.s7-longpress', '.s7-toast',
  // B1b-2b plan 2: #15 address book (ix:1412-1490). The contact sheet is #43's .s8-sheet, already extracted.
  '.s-abook',
  // B1c plan 1: #46 and #47 (ix:3786-3830, 3847-3855, 4067-4084) and #49 (ix:3882-3950).
  '.s9-origin-card', '.s9-msg-card', '.s9-msg-preview', '.s9-disclaimer', '.s9-domain-warn', '.s9-struct-alert', '.s9-perm-card', '.s9-perm-row',
  '.s9-scope-card', '.s9-scope-row', '.s9-flag-banner', '.s9-ack-row', '.s9-gate-status', '.s10-',
  // B1c plan 2: #48 (ix:3824-3837, 3854-3859) and the OriginBadge of #26/#27 (ix:4080-4084).
  '.s9-sim-banner', '.s9-bal-card', '.s9-bal-row', '.s9-origin-pill', '.origin-badge',
];
export const KEYFRAMES = ['shimmer', 'spin', 'shake',
  // Plan 3: what the send-flow rules animate with (#19's progress strip and skeleton, #21's ring and status dot, #54's ring; #20's caret — its rule comes with .s-conf, the typed field does not, D22).
  'm3-slide', 'shimmer-bg', 'zk-spin', 'zk-pulse', 'stk-spin', 'caret'];
const selectorOf = r => r.slice(0, r.indexOf('{')).trim();
const matches = s => PREFIXES.some(p => s === p || [' ', '.', ':', '[', '>'].some(c => s.startsWith(p + c)) || (p.endsWith('-') && s.startsWith(p)));

/** Top-level rules of a stylesheet without comments, split on brace depth. */
export function rulesOf(css) {
  const rules = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) {
      rules.push(css.slice(start, i + 1).trim());
      start = i + 1;
    }
  }
  return rules;
}

/** Whether the extraction keeps this rule: a listed @keyframes, or a rule whose every selector has a listed prefix. */
export function kept(rule) {
  const sel = selectorOf(rule);
  if (sel.startsWith('@keyframes')) return KEYFRAMES.includes(sel.split(/\s+/)[1]);
  if (sel.startsWith('@')) return false;
  return sel.split(',').map(x => x.trim()).every(matches);
}

export const HEADER = `/*
 * GENERATED by extension/scripts/extract-design-css.mjs — never edit by hand: the design classes
 * web/src/styles/design-system.css lacks, copied from the owner's design file (/home/user/Downloads/index.html,
 * its first <style> block) under the SAME class names, rule for rule, comments and blank lines removed
 * (spec B1b-2a §1.2, §1.7). Re-run the script against the design, so the two cannot drift.
 * Tokens come from design-system.css, which every page imports first.
 */
:root { --inset-top: 0px; --inset-bottom: 0px; }
`;

/** design-ext.css's full text for the design file's text. */
export function extractDesignCss(html) {
  const lines = html.split('\n');
  // The first <style> block: line 10 opens it, line 4306 closes it; its body is lines 11–4305.
  if (!lines[9].startsWith('<style>') || !lines[4305].includes('</style>')) throw new Error('index.html changed: re-check the <style> block bounds');
  const css = lines.slice(10, 4305).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  let out = rulesOf(css).filter(kept);
  // One @keyframes per name: the last wins in CSS, so keep only that one.
  const lastKeyframe = new Map(out.map((r, i) => [selectorOf(r), i]).filter(([s]) => s.startsWith('@keyframes')));
  out = out.filter((r, i) => !selectorOf(r).startsWith('@keyframes') || lastKeyframe.get(selectorOf(r)) === i).map(r => r.replace(/\n\s*\n/g, '\n'));
  return `${HEADER}${out.join('\n')}\n`;
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const check = args[0] === '--check';
  const design = (check ? args[1] : args[0]) ?? process.env.NOCTURA_DESIGN_HTML ?? DEFAULT_DESIGN;
  const out = extractDesignCss(readFileSync(design, 'utf8'));
  if (check) {
    const same = readFileSync(OUT_PATH, 'utf8') === out;
    console.log(same ? 'design-ext.css is the extraction output' : 'design-ext.css differs from the extraction output');
    process.exit(same ? 0 : 1);
  }
  mkdirSync(dirname(OUT_PATH), {recursive: true});
  writeFileSync(OUT_PATH, out);
}
````

Change `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 6a30246..96d3e17 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1887,3 +1887,76 @@ body:has(.app-window) {
   width: max-content;
   max-width: calc(100% - 2 * var(--space-4));
 }
+/*
+ * B1c-2: #48 dapp-tx-approval (ix:18261-18705). The cards stack with the design's --space-4 (ix:18293-18320); the
+ * approving state reads the body at .65 (ix:18412, the shielded mockup's "in-flight" opacity, transparent here).
+ */
+.app-tx-busy {
+  opacity: 0.65;
+}
+.app-tx-block {
+  margin-bottom: var(--space-4);
+}
+.app-tx-item {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-4);
+  margin-bottom: var(--space-4);
+}
+/* A batch's section header (B1 §3: each transaction's effects on one screen). */
+.app-tx-batch {
+  margin: 0;
+  color: var(--fg-tertiary);
+}
+.app-tx-caption {
+  margin: 0 0 var(--space-4);
+}
+/* Review 1 L7: who broadcasts, under the origin card. */
+.app-tx-sends {
+  margin: 0 0 var(--space-4);
+}
+.app-tx-none {
+  margin: 0;
+}
+/* A token the wallet does not name: a neutral tile ("?"), the mint beside it in mono. */
+.s9-bal-row .ico.app-tok-other {
+  background: var(--bg-surface-3);
+  color: var(--fg-secondary);
+}
+/* One instruction: its program row, its name and its fields, the card's own rows inside a group of their own. */
+.app-tx-ix {
+  display: flex;
+  flex-direction: column;
+}
+.s9-payload-card .app-tx-ix + .app-tx-ix > .row:first-of-type {
+  border-top: 1px solid color-mix(in oklab, var(--fg-disabled) 60%, transparent);
+}
+.s9-payload-card .row.app-tx-field .k {
+  font-size: 11px;
+  line-height: 14px;
+}
+/* An address in full, in groups of four (B1 §3), its label under it; an unknown program's whole address likewise. */
+.s9-payload-card .row .v.app-tx-addr,
+.s9-payload-card .row .v.app-tx-unknown {
+  display: flex;
+  flex-direction: column;
+  align-items: flex-end;
+  max-width: 75%;
+}
+.app-tx-addr-label {
+  color: var(--fg-tertiary);
+}
+/* "Approve · simulating" (ix:18333), on one line. */
+.app-tx-sim-tag {
+  opacity: 0.7;
+  margin-inline-start: 4px;
+  white-space: nowrap;
+}
+/* #48 mismatch detail (ix:18504-18507): the session in --success, the request and the verdict in --danger — the card's
+   own `.row .v` colour (three classes) outranks the one-class tone. */
+.s9-payload-card .row .v.noc-success {
+  color: var(--success);
+}
+.s9-payload-card .row .v.noc-danger {
+  color: var(--danger);
+}
````

Change `extension/src/approve/Approve.tsx`:

````diff
diff --git a/extension/src/approve/Approve.tsx b/extension/src/approve/Approve.tsx
index 5a94ba0..4f3c3cf 100644
--- a/extension/src/approve/Approve.tsx
+++ b/extension/src/approve/Approve.tsx
@@ -3,6 +3,8 @@ import type {ApproveClient, Decision, PendingView} from './client';
 import {Connect} from './Connect';
 import {Locked} from './Locked';
 import {Sign} from './Sign';
+import {Tx} from './Tx';
+import {Mismatch} from './Mismatch';
 
 /** §2.3 (review 2 M3, review 1 L1): the window polls this often while it shows anything — so an unlock, an expiry or a new head reaches it. */
 export const POLL_MS = 1_000;
@@ -79,10 +81,11 @@ export function Approve({client, close}: {client: ApproveClient; close: () => vo
 
   const decide = useCallback(
     async (d: Decision) => {
-      if (request === null) return;
+      if (request === null) return null;
       setBusy(d.decision === 'approve');
       try {
-        await client.decide(request.requestId, d);
+        // B1c-2 (plan 2 review 1 L4): the reply goes back to the screen — #48 says why a `stale` approval did nothing.
+        return await client.decide(request.requestId, d);
       } finally {
         // M2 (fix round 1, C15): the refresh that can promote the next head (or close the window) must land before
         // busy clears — clearing it first re-enables Connect for one tick on the request that was just decided
@@ -99,5 +102,8 @@ export function Approve({client, close}: {client: ApproveClient; close: () => vo
   const inProgress = busy || view.state === 'deciding';
   // A new head is a new screen: its gates, scope, account and confirm start over (keyed by request).
   if (request.type === 'signMessage') return <Sign key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
+  // B1c-2: #48 for a transaction request; its origin-mismatch notice.
+  if (request.type === 'signTransaction' || request.type === 'signAndSendTransaction') return <Tx key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
+  if (request.type === 'mismatch') return <Mismatch key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
   return <Connect key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
 }
````

Create `extension/src/approve/Mismatch.tsx`:

````tsx
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import type {Decision, RequestView} from './client';
import {BudgetNotice, Waiting, WindowTop, siteLabel} from './ui';
import {MISMATCH_TEXT} from './strings';

/** The host the granted origin shows (with its port when it has one, review 1 L5). */
function grantedSite(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/**
 * #48 "origin-mismatch · auto-reject" (index.html ix:18484-18521; B1 §3: "request origin differs from the granted origin
 * → blocked, no override"): a site asked to sign with an account another origin was granted. The page was answered
 * `unauthorized` before this window opened — there is no Approve path; [OK, return to dApp] only dismisses the notice
 * (the background refuses any other decision). Declared departures: "Review session in Settings" is not offered (the
 * approval window never opens the wallet's pages — D11's rule, as the locked screen), and the caption names Settings →
 * Connected dApps (Q03; #34 is out, D1).
 */
export function Mismatch({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
  const granted = request.mismatch === null ? '—' : grantedSite(request.mismatch.granted);
  const here = siteLabel(request.origin, request.host);
  const dismiss = () => onDecide({decision: 'reject'});
  const body = MISMATCH_TEXT.flagBody(granted, here);
  const caption = MISMATCH_TEXT.caption(granted);
  return (
    <div className="screen app-approve">
      <WindowTop overline={MISMATCH_TEXT.overline} tone="danger" onClose={dismiss} disabled={busy} />
      <div className="scroll-area app-approve-scroll">
        {notice ? <BudgetNotice /> : null}
        <div className="s9-fail-hero">
          <div className="ring">
            <div className="ring-inner">
              <ExtIcon name="close" size={32} />
            </div>
          </div>
          <h1 className="head">{MISMATCH_TEXT.head}</h1>
          <p className="sub">{MISMATCH_TEXT.sub}</p>
        </div>
        <div className="s9-flag-banner danger app-tx-block" role="alert">
          <ExtIcon name="alert-triangle" size={18} />
          <div>
            <p className="head">{MISMATCH_TEXT.flagHead}</p>
            <p className="body">
              {body[0]}
              <code className="noc-mono">{body[1]}</code>
              {body[2]}
              <code className="noc-mono noc-danger">{body[3]}</code>
              {body[4]}
            </p>
          </div>
        </div>
        <div className="s9-payload-card app-tx-block">
          <span className="label">{MISMATCH_TEXT.detail}</span>
          <div className="row">
            <span className="k">{MISMATCH_TEXT.activeSession}</span>
            <span className="v mono noc-success">{granted}</span>
          </div>
          <div className="row">
            <span className="k">{MISMATCH_TEXT.requestOrigin}</span>
            <span className="v mono noc-danger">{here}</span>
          </div>
          <div className="row">
            <span className="k">{MISMATCH_TEXT.match}</span>
            <span className="v noc-danger">{MISMATCH_TEXT.matchValue}</span>
          </div>
          <div className="row">
            <span className="k">{MISMATCH_TEXT.action}</span>
            <span className="v noc-danger">{MISMATCH_TEXT.actionValue}</span>
          </div>
        </div>
        <p className="noc-caption app-dim app-tx-caption">
          {caption[0]}
          <code className="noc-mono">{caption[1]}</code>
          {caption[2]}
        </p>
      </div>
      <Waiting n={waiting} />
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" onPress={dismiss} disabled={busy}>
          <ExtIcon name="shield-check" size={18} />
          {MISMATCH_TEXT.ok}
        </LockedButton>
      </div>
    </div>
  );
}
````

Create `extension/src/approve/Tx.tsx`:

````tsx
import {useState, type ReactNode} from 'react';
import {AddressGroups} from '../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../app/ui/ExtIcon';
import {LockedButton} from '../app/ui/LockedButton';
import {SkelCircle, SkelLine} from '../app/ui/Skeleton';
import {feeUsd, shortAddress, showFee, showSol} from '../app/format';
import {fromBook} from '../app/addressBook';
import {formatAmount} from '../shared/amount';
import type {AddressLabel, BalanceChange, Decision, DecodedInstruction, FieldValue, ProgramKey, RequestView, TxDetail, TxItem} from './client';
import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop, siteLabel} from './ui';
import {useArmed} from './useArmed';
import {SIGN_TEXT, TX_TEXT, WINDOW_TEXT} from './strings';

/** The design's mono program names (#48: "jupiter_v6", "spl_token"), for the programs the wallet decodes. */
const PROGRAM_NAMES: Record<ProgramKey, string> = {
  system: 'system_program',
  token: 'spl_token',
  'token-2022': 'spl_token_2022',
  'associated-token': 'spl_associated_token_account',
  'compute-budget': 'compute_budget',
  presale: 'noctura_presale',
};
/** The wallet's own tokens by mint (core/presale/addresses.ts; the approval window imports no core): symbol, tile and decimals. */
const KNOWN_MINTS: Record<string, {symbol: string; tile: string}> = {
  B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW: {symbol: 'NOC', tile: 'noc'},
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: {symbol: 'USDC', tile: 'usdc'},
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: {symbol: 'USDT', tile: 'usdt'},
};
const MINUS = '−';

/** "194 000 / 200 000" (the design's thin groups). */
const grouped = (n: number): string => n.toLocaleString('en-US').replace(/,/g, ' ');

/** A change's line: the token, its signed amount (exact — every base unit), its dollars when there is a price. */
function changeRow(c: BalanceChange): {key: string; tile: string; tileText: string; name: string; delta: string; neg: boolean; fiat: string | null} {
  const known = c.mint === null ? {symbol: 'SOL', tile: 'sol'} : KNOWN_MINTS[c.mint];
  const amount = BigInt(c.amount);
  const neg = amount < 0n;
  const abs = neg ? -amount : amount;
  const value = c.decimals === null ? abs.toString() : formatAmount(abs, c.decimals, {min: 0, max: c.decimals});
  const micros = c.usdMicros === null ? null : BigInt(c.usdMicros);
  const usd = micros === null ? null : Number(micros < 0n ? -micros : micros) / 1_000_000;
  return {
    key: c.mint ?? 'SOL',
    tile: known === undefined ? 'ico app-tok-other' : `ico s8-tok ${known.tile}`,
    tileText: known === undefined ? '?' : known.symbol,
    name: known === undefined ? shortAddress(c.mint ?? '') : known.symbol,
    delta: `${neg ? MINUS : '+'}${value}`,
    neg,
    fiat: usd === null ? null : feeUsd(usd),
  };
}

function BalanceCard({item, simulating}: {item: TxItem; simulating: boolean}) {
  if (simulating || item.outcome === null) {
    return (
      <div className="s9-bal-card app-busy-dim">
        <span className="label">{TX_TEXT.balanceWaiting}</span>
        {[140, 120].map(w => (
          <div className="s9-bal-row" key={w}>
            <SkelCircle size={24} />
            <SkelLine width={w} height={14} />
            <SkelLine width={80} height={14} />
          </div>
        ))}
      </div>
    );
  }
  if (!item.outcome.ok) return null;
  const rows = item.outcome.changes.map(changeRow);
  return (
    <div className="s9-bal-card">
      <span className="label">{TX_TEXT.balancePost}</span>
      {rows.length === 0 ? <p className="noc-body-sm app-dim app-tx-none">{TX_TEXT.noChanges}</p> : null}
      {rows.map(r => (
        <div className="s9-bal-row" key={r.key}>
          <div className={r.tile}>{r.tileText}</div>
          <div>
            <div className={r.name === r.tileText ? 'pri' : 'pri noc-mono'}>{r.name}</div>
          </div>
          <div>
            <div className={`delta noc-numeral ${r.neg ? 'neg' : 'pos'}`}>{r.delta}</div>
            {r.fiat === null ? null : <div className="fiat">{r.fiat}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** A field's value: an address whole, in groups of four, with its label where known (B1 §3); amounts exact. */
function FieldValueView({value, labels}: {value: FieldValue; labels: readonly AddressLabel[]}): ReactNode {
  switch (value.kind) {
    case 'address': {
      if (value.value === null) return '—';
      const label = labels.find(l => l.address === value.value);
      return (
        <>
          <AddressGroups address={value.value} />
          {label === undefined ? null : <span className="app-tx-addr-label noc-caption">{label.kind === 'account' ? TX_TEXT.ownAccount(label.name) : fromBook(label.name)}</span>}
        </>
      );
    }
    case 'lamports':
      return `${showSol(BigInt(value.value))} SOL`;
    case 'amount':
      return value.decimals === null ? value.value : formatAmount(BigInt(value.value), value.decimals, {min: 0, max: value.decimals});
    case 'bool':
      return value.value ? 'true' : 'false';
    default:
      return value.value;
  }
}

function Payload({item, labels}: {item: TxItem; labels: readonly AddressLabel[]}) {
  const outcome = item.outcome !== null && item.outcome.ok ? item.outcome : null;
  return (
    <div className="s9-payload-card">
      <span className="label">{TX_TEXT.instructions}</span>
      {(item.instructions ?? []).map((ix: DecodedInstruction, i) => (
        <div className="app-tx-ix" key={i}>
          <div className="row">
            <span className="k">{TX_TEXT.program(i + 1)}</span>
            {ix.program === null ? (
              <span className="v mono app-tx-unknown">
                {ix.programId === null ? '—' : <AddressGroups address={ix.programId} />}
                <span className="noc-caption"> · {TX_TEXT.unknownProgram}</span>
              </span>
            ) : (
              <span className="v mono">
                {shortAddress(ix.programId ?? '')} · {PROGRAM_NAMES[ix.program]}
              </span>
            )}
          </div>
          {ix.program === null ? null : (
            <div className="row app-tx-field">
              <span className="k noc-mono">instruction</span>
              <span className="v mono">{ix.name ?? TX_TEXT.unknownInstruction}</span>
            </div>
          )}
          {ix.fields.map(f => (
            <div className="row app-tx-field" key={f.name}>
              <span className="k noc-mono">{f.name}</span>
              <span className={f.value.kind === 'address' ? 'v app-tx-addr' : 'v mono'}>
                <FieldValueView value={f.value} labels={labels} />
              </span>
            </div>
          ))}
        </div>
      ))}
      {outcome === null ? null : (
        <div className="row">
          <span className="k">{TX_TEXT.computeUnits}</span>
          <span className="v noc-numeral">{`${outcome.unitsConsumed === null ? '—' : grouped(outcome.unitsConsumed)} / ${grouped(outcome.unitLimit)}`}</span>
        </div>
      )}
      {outcome === null || outcome.feeLamports === null ? null : (
        <div className="row">
          <span className="k">{TX_TEXT.networkFee}</span>
          <span className="v noc-numeral">{showFee(BigInt(outcome.feeLamports))} SOL</span>
        </div>
      )}
    </div>
  );
}

type TxState = 'simulating' | 'ready' | 'failed' | 'expired' | 'unreachable';
function stateOf(d: TxDetail): TxState {
  if (d.simulation.status === 'simulating') return 'simulating';
  if (d.simulation.status === 'unreachable') return 'unreachable';
  const outcomes = d.transactions.map(t => t.outcome);
  if (outcomes.some(o => o !== null && !o.ok && o.error === 'expired')) return 'expired';
  if (outcomes.some(o => o === null || !o.ok)) return 'failed';
  return 'ready';
}

/**
 * #48 dapp-tx-approval (spec B1c §3.3; index.html ix:18261-18705), the states B1c-2 builds:
 *  - simulating-blocking: the origin card, the design's simulation banner, the balance card in skeleton at .55, the
 *    decoded instructions already shown, "This is mandatory — no skip", and Approve disabled ("Approve · simulating")
 *    until the simulation answers (no artificial minimum, §9); ✕ disabled as drawn, Reject open;
 *  - simulated: the balance changes (post − pre per mint, exact) beside the decoded instructions, the compute units and
 *    the fee, and the origin pill "Request from <host> · matches active session" (verified and unknown origins only —
 *    a lookalike's screen vouches for nothing); a batch shows each transaction's section, approved as a whole;
 *  - re-authentication (B1b's rules, through #10 — reached from the Noctura icon, D11): a line before Approve asks
 *    for it; after Approve asked, the banner says where, and Approve waits until the background says it is proven;
 *  - couldn't simulate / unreachable / blockhash expired (Q21): only Reject (B1c-3 adds the red-flag override);
 *  - lookalike: the banner and the flipped bar — [Reject and report], "Approve anyway (not recommended)" → the
 *    2-second confirm;
 *  - approving: "Approving", the body at .65, "Approving…" with the ring, every CTA and ✕ disabled;
 *  - the request can no longer be signed (`tx` null): Q26 and only Reject.
 * B1c-3 builds the red-flag blocks, the typed-confirm override and the unlimited-spend state.
 * C15 holds Approve (and its demoted forms) 500 ms after focus and after each state change — the request, a new
 * simulation, the re-authentication's state, busy; Reject is never held.
 */
export function Tx({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
  const detail = request.tx;
  const lookalike = request.site.kind === 'lookalike';
  const [confirming, setConfirming] = useState(false);
  // Review 1 L4: the last approval was refused `stale` (a refresh landed): say why the click did nothing, until the next one.
  const [stale, setStale] = useState(false);
  const simId = detail !== null && detail.simulation.status === 'ok' ? detail.simulation.id : 'none';
  const armed = useArmed([request.requestId, simId, detail?.reauth?.state ?? 'none', confirming, busy].join('|'));
  const reject = () => onDecide({decision: 'reject'});
  if (detail === null) {
    return (
      <div className="screen app-approve">
        <WindowTop overline={TX_TEXT.overline} tone="neutral" onClose={reject} disabled={busy} />
        <div className="scroll-area app-approve-scroll">
          {notice ? <BudgetNotice /> : null}
          <div className="app-origin-slot">
            <OriginCard site={request.site} origin={request.origin} host={request.host} />
          </div>
          <p className="noc-body-sm app-muted app-approve-lede">{SIGN_TEXT.cannotSign}</p>
        </div>
        <Waiting n={waiting} />
        <div className="sticky-bar">
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={busy}>
            {WINDOW_TEXT.reject}
          </LockedButton>
        </div>
      </div>
    );
  }
  const state = stateOf(detail);
  const simulating = state === 'simulating';
  const ready = state === 'ready';
  const reauthWaiting = detail.reauth?.state === 'waiting';
  const canApprove = ready && !reauthWaiting && !busy;
  const approve = async () => {
    setStale(false);
    const reply = await onDecide({decision: 'approve', account: detail.account.publicKey, ...(detail.simulation.status === 'ok' ? {simulation: detail.simulation.id} : {})});
    if (typeof reply === 'object' && reply !== null && 'error' in reply && reply.error === 'stale') setStale(true);
  };
  const n = detail.transactions.length;
  const overline = busy ? TX_TEXT.overlineApproving : lookalike ? TX_TEXT.overlineLookalike : TX_TEXT.overline;
  return (
    <div className="screen app-approve">
      <WindowTop overline={overline} tone={!busy && lookalike ? 'danger' : 'neutral'} onClose={reject} disabled={busy || simulating} />
      <div className={busy ? 'scroll-area app-approve-scroll app-tx-busy' : 'scroll-area app-approve-scroll'}>
        {notice ? <BudgetNotice /> : null}
        <div className="app-origin-slot">
          <OriginCard site={request.site} origin={request.origin} host={request.host} />
        </div>
        {lookalike ? <LookalikeBanner site={request.site} host={request.host} /> : null}
        {/* Review 1 L7: who broadcasts — the design draws one screen for both requests. */}
        <p className="noc-caption app-muted app-tx-sends">{detail.kind === 'signAndSendTransaction' ? TX_TEXT.sendsNoctura : TX_TEXT.sendsSite}</p>
        {stale && ready ? (
          <div className="s9-flag-banner warn app-tx-block" role="status">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{TX_TEXT.stale}</p>
            </div>
          </div>
        ) : null}
        {/* Re-authentication first, under the origin: the one thing the user must do before Approve (seen without scrolling). */}
        {ready && detail.reauth !== null && detail.reauth.state === 'needed' ? <p className="noc-caption app-muted app-tx-caption">{TX_TEXT.reauthNeeded}</p> : null}
        {ready && reauthWaiting ? (
          <div className="s9-flag-banner warn app-tx-block" role="status">
            <ExtIcon name="lock" size={18} />
            <div>
              <p className="head">{TX_TEXT.reauthHead}</p>
              <p className="body">{TX_TEXT.reauthWaiting}</p>
            </div>
          </div>
        ) : null}
        {simulating ? (
          <div className="s9-sim-banner app-tx-block" role="status">
            <div className="m3" />
            <div>
              <div className="body">{TX_TEXT.simulating}</div>
              <div className="meta">{TX_TEXT.simulatingMeta}</div>
            </div>
          </div>
        ) : null}
        {state === 'failed' || state === 'unreachable' || state === 'expired' ? (
          <div className="s9-flag-banner danger app-tx-block" role="alert">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <p className="head">{state === 'expired' ? TX_TEXT.expired : TX_TEXT.couldNot}</p>
              {state === 'unreachable' ? <p className="body">{TX_TEXT.unreachable}</p> : null}
              {state === 'failed'
                ? detail.transactions.map((t, i) =>
                    t.outcome !== null && !t.outcome.ok ? (
                      <p className="meta" key={i}>
                        {n > 1 ? `${TX_TEXT.batchItem(i + 1, n)}: ` : ''}
                        {t.outcome.detail}
                      </p>
                    ) : null,
                  )
                : null}
            </div>
          </div>
        ) : null}
        {detail.transactions.map((t, i) => (
          <section className="app-tx-item" key={i}>
            {n > 1 ? <h2 className="noc-overline app-tx-batch">{TX_TEXT.batchItem(i + 1, n)}</h2> : null}
            {state === 'failed' || state === 'expired' || state === 'unreachable' ? null : <BalanceCard item={t} simulating={simulating} />}
            {t.instructions === null ? null : <Payload item={t} labels={detail.labels} />}
          </section>
        ))}
        {simulating ? <p className="noc-caption app-dim app-tx-caption">{TX_TEXT.mandatory}</p> : null}
        {ready && !lookalike ? (
          <div className="s9-origin-pill app-tx-block">
            <span className="dot ok" />
            <span className="body">
              {TX_TEXT.originPill(siteLabel(request.origin, request.host))[0]}
              <code>{siteLabel(request.origin, request.host)}</code>
              {TX_TEXT.originPill(siteLabel(request.origin, request.host))[2]}
            </span>
          </div>
        ) : null}
      </div>
      {request.offerBlock && !busy ? <BlockSite onBlock={() => onDecide({decision: 'block'})} /> : null}
      <Waiting n={waiting} />
      {!ready && !simulating ? (
        <div className="sticky-bar">
          {lookalike ? (
            <LockedButton className="btn btn-destructive" onPress={() => onDecide({decision: 'report'})} disabled={busy}>
              <ExtIcon name="close" size={18} />
              {WINDOW_TEXT.rejectAndReport}
            </LockedButton>
          ) : null}
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={busy}>
            {WINDOW_TEXT.reject}
          </LockedButton>
        </div>
      ) : lookalike && !busy ? (
        <div className="sticky-bar">
          <LockedButton className="btn btn-destructive" onPress={() => onDecide({decision: 'report'})}>
            <ExtIcon name="close" size={18} />
            {WINDOW_TEXT.rejectAndReport}
          </LockedButton>
          <ConfirmButton armed={armed && canApprove} className="btn btn-tertiary noc-body-sm app-dim" onPress={() => setConfirming(true)}>
            {TX_TEXT.approveAnyway}
          </ConfirmButton>
        </div>
      ) : (
        <div className="sticky-bar row">
          <LockedButton className="btn btn-secondary" onPress={reject} disabled={busy}>
            {WINDOW_TEXT.reject}
          </LockedButton>
          {busy ? (
            <button type="button" className="btn btn-primary app-cta-wide app-cta-busy" disabled>
              <Spinner />
              {TX_TEXT.approving}
            </button>
          ) : (
            <ConfirmButton armed={armed && canApprove} className="btn btn-primary app-cta-wide" onPress={approve}>
              {TX_TEXT.approve}
              {simulating ? <span className="app-tx-sim-tag">{TX_TEXT.approveSimulating}</span> : null}
            </ConfirmButton>
          )}
        </div>
      )}
      {confirming ? (
        <RiskConfirm
          onCancel={() => setConfirming(false)}
          onProceed={async () => {
            setConfirming(false);
            await approve();
          }}
        />
      ) : null}
    </div>
  );
}
````

Change `extension/src/approve/client.ts`:

````diff
diff --git a/extension/src/approve/client.ts b/extension/src/approve/client.ts
index d0d4338..42c7f12 100644
--- a/extension/src/approve/client.ts
+++ b/extension/src/approve/client.ts
@@ -40,18 +40,67 @@ export interface SignDetail {
   marks: {start: number; end: number}[];
   siwsMismatch: string | null;
 }
+/** B1c-2 (#48): what the background decoded, as decode.ts builds it — re-checked here like everything else it sends. */
+export type ProgramKey = 'system' | 'token' | 'token-2022' | 'associated-token' | 'compute-budget' | 'presale';
+export type FieldValue =
+  | {kind: 'address'; value: string | null}
+  | {kind: 'lamports'; value: string}
+  | {kind: 'amount'; value: string; decimals: number | null}
+  | {kind: 'number'; value: string}
+  | {kind: 'bool'; value: boolean}
+  | {kind: 'text'; value: string}
+  | {kind: 'hex'; value: string};
+export interface Field {
+  name: string;
+  value: FieldValue;
+}
+export interface DecodedInstruction {
+  programId: string | null;
+  program: ProgramKey | null;
+  name: string | null;
+  fields: Field[];
+}
+export interface BalanceChange {
+  mint: string | null;
+  amount: string;
+  decimals: number | null;
+  usdMicros: string | null;
+}
+export type TxOutcome = {ok: true; changes: BalanceChange[]; unitsConsumed: number | null; unitLimit: number; feeLamports: string | null} | {ok: false; error: 'expired' | 'failed'; detail: string};
+export interface TxItem {
+  version: 'legacy' | 0;
+  feePayer: string;
+  instructions: DecodedInstruction[] | null;
+  outcome: TxOutcome | null;
+}
+export type SimulationView = {status: 'simulating'} | {status: 'unreachable'} | {status: 'ok'; id: string; slot: number; elapsedMs: number; at: number};
+export interface AddressLabel {
+  address: string;
+  kind: 'account' | 'contact';
+  name: string;
+}
+export interface TxDetail {
+  kind: 'signTransaction' | 'signAndSendTransaction';
+  account: AccountChoice;
+  transactions: TxItem[];
+  simulation: SimulationView;
+  reauth: {reasons: string[]; state: 'needed' | 'waiting' | 'proven'} | null;
+  labels: AddressLabel[];
+}
 export interface RequestView {
   requestId: string;
-  type: 'connect' | 'signMessage';
+  type: 'connect' | 'signMessage' | 'signTransaction' | 'signAndSendTransaction' | 'mismatch';
   origin: string;
   host: string;
   site: Site;
   offerBlock: boolean;
   connect: ConnectDetail | null;
   sign: SignDetail | null;
+  tx: TxDetail | null;
+  mismatch: {granted: string} | null;
 }
 export type PendingView = {state: 'none'} | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};
-export type Decision = {decision: 'reject' | 'report' | 'block'} | {decision: 'approve'; account: string; scope?: 'session' | 'persistent'};
+export type Decision = {decision: 'reject' | 'report' | 'block'} | {decision: 'approve'; account: string; scope?: 'session' | 'persistent'; simulation?: string};
 export type DecideReply = {ok: true} | {ok: false; error: string};
 
 type J = Record<string, unknown>;
@@ -104,14 +153,111 @@ function signOf(x: unknown): SignDetail | undefined {
   return {account, text: o.text, chars: o.chars, keyword: o.keyword, marks, siwsMismatch: o.siwsMismatch};
 }
 
+const PROGRAM_KEYS: readonly string[] = ['system', 'token', 'token-2022', 'associated-token', 'compute-budget', 'presale'];
+const DIGITS = /^\d{1,40}$/;
+const SIGNED = /^-?\d{1,40}$/;
+
+function fieldValueOf(x: unknown): FieldValue | undefined {
+  const o = obj(x);
+  if (o === undefined) return undefined;
+  if (o.kind === 'address') return o.value === null || isStr(o.value) ? {kind: 'address', value: o.value} : undefined;
+  if (o.kind === 'lamports') return isStr(o.value) && DIGITS.test(o.value) ? {kind: 'lamports', value: o.value} : undefined;
+  // An i64 argument (the presale program's) may be negative.
+  if (o.kind === 'number') return isStr(o.value) && SIGNED.test(o.value) ? {kind: 'number', value: o.value} : undefined;
+  if (o.kind === 'amount') return isStr(o.value) && DIGITS.test(o.value) && (o.decimals === null || (isInt(o.decimals) && o.decimals <= 18)) ? {kind: 'amount', value: o.value, decimals: o.decimals} : undefined;
+  if (o.kind === 'bool') return isBool(o.value) ? {kind: 'bool', value: o.value} : undefined;
+  if (o.kind === 'text' || o.kind === 'hex') return isStr(o.value) ? {kind: o.kind, value: o.value} : undefined;
+  return undefined;
+}
+
+function instructionOf(x: unknown): DecodedInstruction | undefined {
+  const o = obj(x);
+  if (o === undefined || !(o.programId === null || isStr(o.programId)) || !(o.name === null || isStr(o.name)) || !Array.isArray(o.fields)) return undefined;
+  if (!(o.program === null || (isStr(o.program) && PROGRAM_KEYS.includes(o.program)))) return undefined;
+  const fields: Field[] = [];
+  for (const f of o.fields as unknown[]) {
+    const fo = obj(f);
+    const value = fieldValueOf(fo?.value);
+    if (fo === undefined || !isStr(fo.name) || value === undefined) return undefined;
+    fields.push({name: fo.name, value});
+  }
+  return {programId: o.programId, program: o.program as ProgramKey | null, name: o.name, fields};
+}
+
+function changeOf(x: unknown): BalanceChange | undefined {
+  const o = obj(x);
+  if (o === undefined || !(o.mint === null || isStr(o.mint)) || !isStr(o.amount) || !SIGNED.test(o.amount) || !(o.decimals === null || (isInt(o.decimals) && o.decimals <= 18))) return undefined;
+  if (!(o.usdMicros === null || (isStr(o.usdMicros) && SIGNED.test(o.usdMicros)))) return undefined;
+  return {mint: o.mint, amount: o.amount, decimals: o.decimals, usdMicros: o.usdMicros};
+}
+
+function outcomeOf(x: unknown): TxOutcome | undefined {
+  const o = obj(x);
+  if (o === undefined) return undefined;
+  if (o.ok === false) return (o.error === 'expired' || o.error === 'failed') && isStr(o.detail) ? {ok: false, error: o.error, detail: o.detail} : undefined;
+  if (o.ok !== true || !Array.isArray(o.changes) || !(o.unitsConsumed === null || isInt(o.unitsConsumed)) || !isInt(o.unitLimit) || !(o.feeLamports === null || (isStr(o.feeLamports) && DIGITS.test(o.feeLamports)))) return undefined;
+  const changes = (o.changes as unknown[]).map(changeOf);
+  if (changes.some(c => c === undefined)) return undefined;
+  return {ok: true, changes: changes as BalanceChange[], unitsConsumed: o.unitsConsumed, unitLimit: o.unitLimit, feeLamports: o.feeLamports};
+}
+
+function txItemOf(x: unknown): TxItem | undefined {
+  const o = obj(x);
+  if (o === undefined || (o.version !== 'legacy' && o.version !== 0) || !isStr(o.feePayer)) return undefined;
+  let instructions: DecodedInstruction[] | null = null;
+  if (o.instructions !== null) {
+    if (!Array.isArray(o.instructions)) return undefined;
+    const list = (o.instructions as unknown[]).map(instructionOf);
+    if (list.some(i => i === undefined)) return undefined;
+    instructions = list as DecodedInstruction[];
+  }
+  const outcome = nullOr(o.outcome, outcomeOf);
+  if (outcome === undefined) return undefined;
+  return {version: o.version, feePayer: o.feePayer, instructions, outcome};
+}
+
+function simulationOf(x: unknown): SimulationView | undefined {
+  const o = obj(x);
+  if (o?.status === 'simulating' || o?.status === 'unreachable') return {status: o.status};
+  if (o?.status !== 'ok' || !isStr(o.id) || !isInt(o.slot) || !isInt(o.elapsedMs) || !isInt(o.at)) return undefined;
+  return {status: 'ok', id: o.id, slot: o.slot, elapsedMs: o.elapsedMs, at: o.at};
+}
+
+function txDetailOf(x: unknown): TxDetail | undefined {
+  const o = obj(x);
+  const account = accountOf(o?.account);
+  const simulation = simulationOf(o?.simulation);
+  if (o === undefined || account === undefined || simulation === undefined || (o.kind !== 'signTransaction' && o.kind !== 'signAndSendTransaction') || !Array.isArray(o.transactions) || !Array.isArray(o.labels)) return undefined;
+  const transactions = (o.transactions as unknown[]).map(txItemOf);
+  if (transactions.length === 0 || transactions.some(t => t === undefined)) return undefined;
+  const labels: AddressLabel[] = [];
+  for (const l of o.labels as unknown[]) {
+    const lo = obj(l);
+    if (lo === undefined || !isStr(lo.address) || (lo.kind !== 'account' && lo.kind !== 'contact') || !isStr(lo.name)) return undefined;
+    labels.push({address: lo.address, kind: lo.kind, name: lo.name});
+  }
+  const reauth = nullOr(o.reauth, v => {
+    const r = obj(v);
+    if (r === undefined || !Array.isArray(r.reasons) || !(r.reasons as unknown[]).every(isStr) || (r.state !== 'needed' && r.state !== 'waiting' && r.state !== 'proven')) return undefined;
+    return {reasons: (r.reasons as string[]).slice(), state: r.state as 'needed' | 'waiting' | 'proven'};
+  });
+  if (reauth === undefined) return undefined;
+  return {kind: o.kind, account, transactions: transactions as TxItem[], simulation, reauth, labels};
+}
+
+const TYPES: readonly string[] = ['connect', 'signMessage', 'signTransaction', 'signAndSendTransaction', 'mismatch'];
+
 function requestOf(x: unknown): RequestView | undefined {
   const o = obj(x);
   const site = siteOf(o?.site);
-  if (o === undefined || site === undefined || !isStr(o.requestId) || (o.type !== 'connect' && o.type !== 'signMessage') || !isStr(o.origin) || !isStr(o.host) || !isBool(o.offerBlock)) return undefined;
+  if (o === undefined || site === undefined || !isStr(o.requestId) || !isStr(o.type) || !TYPES.includes(o.type) || !isStr(o.origin) || !isStr(o.host) || !isBool(o.offerBlock)) return undefined;
   const connect = nullOr(o.connect, connectOf);
   const sign = nullOr(o.sign, signOf);
-  if (connect === undefined || sign === undefined) return undefined;
-  return {requestId: o.requestId, type: o.type, origin: o.origin, host: o.host, site, offerBlock: o.offerBlock, connect, sign};
+  // An older background sends neither (B1c-1): read as none.
+  const tx = o.tx === undefined ? null : nullOr(o.tx, txDetailOf);
+  const mismatch = o.mismatch === undefined ? null : nullOr(o.mismatch, v => (isStr(obj(v)?.granted) ? {granted: obj(v)?.granted as string} : undefined));
+  if (connect === undefined || sign === undefined || tx === undefined || mismatch === undefined) return undefined;
+  return {requestId: o.requestId, type: o.type as RequestView['type'], origin: o.origin, host: o.host, site, offerBlock: o.offerBlock, connect, sign, tx, mismatch};
 }
 
 export function pendingOf(x: unknown): PendingView | null {
````

Change `extension/src/approve/strings.ts`:

````diff
diff --git a/extension/src/approve/strings.ts b/extension/src/approve/strings.ts
index 039edff..e2f2559 100644
--- a/extension/src/approve/strings.ts
+++ b/extension/src/approve/strings.ts
@@ -111,3 +111,82 @@ export const SIGN_TEXT = {
   /** Q26 (rev 3.2): `request.sign === null` — the Reject-only exit says why. */
   cannotSign: 'This request can no longer be signed. Reject it and ask the site to try again.',
 } as const;
+
+/**
+ * #48 dapp-tx-approval (index.html ix:18261-18705): the design's own strings as drawn, B1 §3's ("unknown program"),
+ * B1b's (#19's "Couldn't simulate" and its server line, #20's address labels), Q21 and Q26 — and the controller's
+ * lines the design does not draw, each flagged for the owner in the plan's Scope (R-numbers there).
+ */
+export const TX_TEXT = {
+  overline: 'Approve transaction',
+  overlineApproving: 'Approving',
+  overlineLookalike: 'Suspicious origin',
+  simulating: 'Simulating transaction…',
+  /** #19's own server line (B1b-2a §4.4): what answers, as the design's meta names its RPC. */
+  simulatingMeta: 'Noctura server · simulateTransaction',
+  balanceWaiting: 'Balance changes (waiting…)',
+  balancePost: 'Balance changes (post-simulation)',
+  /**
+   * Owner-delegated (controller, 2026-10-15; plan 2 review 1 L3): a simulation that moves nothing of this account's — it
+   * points at the instructions, since an instruction that moves no balance (an authority change, an allowance) can still
+   * matter; B1c-3 replaces the line on a screen with such an instruction.
+   */
+  noChanges: 'No SOL or token balance changes — review the instructions below.',
+  /** Owner-delegated (controller, 2026-10-15; review 1 L7): who broadcasts — page.signTransaction / page.signAndSendTransaction. */
+  sendsSite: 'The site sends this transaction itself after you approve.',
+  sendsNoctura: 'Noctura sends this transaction as soon as you approve.',
+  /** Owner-delegated (controller, 2026-10-15; review 1 L4): an approval refused `stale` — a refresh landed between the read and the click. */
+  stale: 'The transaction changed while you were reviewing. Review it again before approving.',
+  instructions: 'Instructions',
+  program: (n: number): string => `Program ${n}`,
+  /** B1 §3: "a program not in the decoded set → unknown program". */
+  unknownProgram: 'unknown program',
+  /** Controller (owner copy): an instruction of a decoded program whose tag the wallet does not know. */
+  unknownInstruction: 'unknown instruction',
+  computeUnits: 'Compute units',
+  networkFee: 'Network fee',
+  mandatory: 'Simulation runs against the current slot before you see Approve. This is mandatory — no skip.',
+  approve: 'Approve',
+  approveSimulating: '· simulating',
+  approving: 'Approving…',
+  /** Controller (owner copy, as #46's and #47's): a lookalike origin's demoted path. */
+  approveAnyway: 'Approve anyway (not recommended)',
+  /** #19's (B1b): the simulation's own refusal, and a proxy that did not answer. */
+  couldNot: "Couldn't simulate",
+  unreachable: 'Could not reach the Noctura server.',
+  /** Q21. */
+  expired: 'This request has expired. Ask the site to try again.',
+  originPill: (host: string): [string, string, string] => ['Request from ', host, ' · matches active session'],
+  /** Controller (owner copy): a batch's section, B1 §3 "shown on one screen with each transaction's effects". */
+  batchItem: (i: number, n: number): string => `Transaction ${i} of ${n}`,
+  /** Controller (owner copy), D11: re-authentication is reached from the Noctura icon, never from this window. */
+  reauthNeeded: "Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.",
+  reauthHead: "Confirm it's you",
+  reauthWaiting: "Click the Noctura icon in your browser's toolbar and confirm with your password (or passkey). This request will wait here.",
+  /** #20's labels (B1b; spec §3 "with a label where known"). */
+  ownAccount: (name: string): string => `Your account: ${name}`,
+} as const;
+
+/** #48's origin-mismatch · auto-reject (ix:18484-18521), as drawn — "Settings → dApps" reads Settings → Connected dApps (Q03, D1). */
+export const MISMATCH_TEXT = {
+  overline: 'Auto-rejected · Origin mismatch',
+  head: 'Request blocked automatically',
+  sub: 'A transaction came from a different origin than the one you connected. We rejected it without showing Approve.',
+  flagHead: 'Origin mismatch · auto-reject',
+  flagBody: (session: string, request: string): [string, string, string, string, string] => [
+    'A connected session for ',
+    session,
+    ' received a transaction request from ',
+    request,
+    '. This is almost always a man-in-the-middle attempt. The request was dropped without prompting.',
+  ],
+  detail: 'Mismatch detail',
+  activeSession: 'Active session',
+  requestOrigin: 'Request origin',
+  match: 'Match',
+  matchValue: 'false',
+  action: 'Action',
+  actionValue: 'REJECT_NO_PROMPT',
+  caption: (session: string): [string, string, string] => ['If you believe this is legitimate, disconnect the existing ', session, ' session in Settings → Connected dApps and reconnect through the new domain explicitly. Never approve cross-origin transactions.'],
+  ok: 'OK, return to dApp',
+} as const;
````

Change `extension/src/styles/design-ext.css`:

````diff
diff --git a/extension/src/styles/design-ext.css b/extension/src/styles/design-ext.css
index 14c5128..434e742 100644
--- a/extension/src/styles/design-ext.css
+++ b/extension/src/styles/design-ext.css
@@ -1,8 +1,8 @@
 /*
- * The design classes web/src/styles/design-system.css lacks, copied from the owner's design file
- * (/home/user/Downloads/index.html, its first <style> block) under the SAME class names, rule for
- * rule, comments and blank lines removed (spec B1b-2a §1.2, §1.7). Generated once by the plan's
- * extraction step; edit by re-running it against the design, never by hand, so the two cannot drift.
+ * GENERATED by extension/scripts/extract-design-css.mjs — never edit by hand: the design classes
+ * web/src/styles/design-system.css lacks, copied from the owner's design file (/home/user/Downloads/index.html,
+ * its first <style> block) under the SAME class names, rule for rule, comments and blank lines removed
+ * (spec B1b-2a §1.2, §1.7). Re-run the script against the design, so the two cannot drift.
  * Tokens come from design-system.css, which every page imports first.
  */
 :root { --inset-top: 0px; --inset-bottom: 0px; }
@@ -1714,6 +1714,20 @@
 .s9-scope-row.sel .radio::after { content: ''; position: absolute; inset: 3px; border-radius: 50%; background: var(--accent); }
 .s9-scope-row .pri { font-size: 14px; line-height: 18px; font-weight: 500; color: var(--fg-primary); }
 .s9-scope-row .sec { font-size: 12px; line-height: 16px; color: var(--fg-tertiary); margin-top: 2px; }
+.s9-sim-banner { display: flex; align-items: center; gap: var(--space-3); padding: var(--space-4); background: color-mix(in oklab, var(--info) 10%, var(--bg-surface-1)); border-radius: var(--radius-md); border: 1px solid color-mix(in oklab, var(--info) 28%, transparent); }
+.s9-sim-banner .m3 { width: 22px; height: 22px; border-radius: 50%; border: 3px solid color-mix(in oklab, var(--info) 22%, transparent); border-top-color: var(--info); animation: spin var(--dur-spin) linear infinite; flex-shrink: 0; }
+.s9-sim-banner .body { font-size: 13px; line-height: 18px; color: var(--fg-primary); }
+.s9-sim-banner .meta { font-size: 11px; line-height: 14px; color: var(--fg-secondary); font-family: var(--font-mono); margin-top: 2px; font-variant-numeric: tabular-nums; }
+.s9-bal-card { background: var(--bg-surface-1); border-radius: var(--radius-lg); padding: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2); }
+.s9-bal-card .label { font-size: 11px; line-height: 14px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--fg-tertiary); }
+.s9-bal-row { display: grid; grid-template-columns: 28px 1fr auto; gap: var(--space-3); align-items: center; padding: 8px 0; border-top: 1px solid color-mix(in oklab, var(--fg-disabled) 60%, transparent); }
+.s9-bal-row:first-of-type { border-top: 0; }
+.s9-bal-row .ico { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 700; color: var(--bg-base); font-variant-numeric: tabular-nums; }
+.s9-bal-row .pri { font-size: 14px; line-height: 18px; color: var(--fg-primary); }
+.s9-bal-row .delta { font-size: 14px; line-height: 18px; font-weight: 600; font-variant-numeric: tabular-nums; text-align: end; }
+.s9-bal-row .delta.neg { color: var(--danger); }
+.s9-bal-row .delta.pos { color: var(--success); }
+.s9-bal-row .fiat { font-size: 11px; line-height: 14px; color: var(--fg-tertiary); font-variant-numeric: tabular-nums; text-align: end; }
 .s9-flag-banner { padding: var(--space-3) var(--space-4); border-radius: var(--radius-md); display: flex; gap: var(--space-3); align-items: flex-start; }
 .s9-flag-banner.warn { background: color-mix(in oklab, var(--warning) 12%, var(--bg-surface-1)); border-left: 3px solid var(--warning); }
 .s9-flag-banner.warn svg { color: var(--warning); flex-shrink: 0; margin-top: 1px; }
@@ -1723,6 +1737,12 @@
 .s9-flag-banner.danger .head { color: var(--danger); }
 .s9-flag-banner .body { font-size: 12px; line-height: 16px; color: var(--fg-secondary); margin: 4px 0 0; }
 .s9-flag-banner .meta { font-family: var(--font-mono); font-size: 11px; color: var(--fg-tertiary); margin-top: 4px; word-break: break-all; }
+.s9-origin-pill { display: flex; align-items: center; gap: var(--space-2); padding: 8px 12px; background: var(--bg-surface-2); border-radius: var(--radius-md); }
+.s9-origin-pill .dot { width: 6px; height: 6px; border-radius: 50%; }
+.s9-origin-pill .dot.ok   { background: var(--success); }
+.s9-origin-pill .dot.warn { background: var(--warning); }
+.s9-origin-pill .body { font-size: 12px; line-height: 16px; color: var(--fg-secondary); }
+.s9-origin-pill .body code { font-family: var(--font-mono); color: var(--fg-primary); }
 .s10-app-row { display: grid; grid-template-columns: 40px 1fr auto; gap: var(--space-3); align-items: center; padding: var(--space-3) var(--space-4); min-height: 64px; background: var(--bg-surface-1); border-radius: var(--radius-lg); }
 .s10-app-row + .s10-app-row { margin-top: var(--space-2); }
 .s10-app-row .ico { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; color: var(--bg-base); font-variant-numeric: tabular-nums; }
@@ -1852,6 +1872,11 @@
 .s9-gate-status .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--fg-disabled); }
 .s9-gate-status.is-ready { color: var(--accent); }
 .s9-gate-status.is-ready .dot { background: var(--accent); box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 24%, transparent); }
+.origin-badge { display: inline-flex; align-items: center; gap: 4px; padding: 1px 6px; border-radius: var(--radius-pill); font: 600 10px/14px var(--font-body); letter-spacing: 0.08em; text-transform: uppercase; vertical-align: middle; flex-shrink: 0; }
+.origin-badge svg { width: 9px; height: 9px; flex-shrink: 0; }
+.origin-badge[data-origin="first-party"] { background: color-mix(in oklab, var(--fg-tertiary) 14%, transparent); color: var(--fg-secondary); }
+.origin-badge[data-origin="dapp"] { background: color-mix(in oklab, var(--info) 16%, transparent); color: var(--info); }
+.origin-badge[data-origin="dapp"] svg { color: var(--info); }
 .tx-row .meta .origin-badge { margin-inline-start: 4px; }
 .s-conf .headline {
   display: block;
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run scripts/__tests__/extract-design-css.test.mjs src/__tests__/designExt2b.test.ts src/approve/__tests__/tx.test.tsx` — expected: Test Files  3 passed (3) · Tests  19 passed (19)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  165 passed (165) · Tests  3226 passed (3226). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M7a | `Tx.tsx`: Approve enabled while the re-authentication waits | tx.test.tsx "re-authentication" — RED Tests  1 failed \| 11 passed (12) |
| M7b | `Tx.tsx`: the simulation's id not in the C15 key | tx.test.tsx "C15: a new simulation re-holds Approve" — RED Tests  1 failed \| 11 passed (12) |
| M7c | `Tx.tsx`: the origin pill on a lookalike | tx.test.tsx "a lookalike origin" — RED Tests  1 failed \| 11 passed (12) |
| M7d | `Tx.tsx`: ✕ open while simulating | tx.test.tsx "simulating-blocking, then simulated" — RED Tests  1 failed \| 11 passed (12) |
| M7e | `Mismatch.tsx`: [OK] sends an approval | tx.test.tsx "#48 origin-mismatch" — RED Tests  1 failed \| 11 passed (12) |
| M7f | `Tx.tsx`: a failed outcome shown as approvable | tx.test.tsx "couldn't simulate …" — RED Tests  1 failed \| 11 passed (12) |
| M7g | `Tx.tsx`: a `stale` reply never shown | tx.test.tsx "a refresh that lands between the read and the click (stale)" — RED Tests  1 failed \| 11 passed (12) |
| M7h | `Tx.tsx`: who sends chosen by the wrong kind | tx.test.tsx "signAndSendTransaction: "Noctura sends this transaction…"" — RED Tests  2 failed \| 10 passed (12) |
| M7i | `design-ext.css`: a rule added by hand | extract-design-css.test.mjs "…every rule after it is one the extraction keeps" — RED Tests  1 failed \| 1 passed (2) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-2 #48 in the approval window — simulating, simulated, a batch, re-authentication, approving, the failures, lookalike, Q26; the origin-mismatch notice" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 8: The OriginBadge: "Dapp · simulated" on #26's rows and in #27's title

**Spec:** §3.3 ("The sent transaction appears in #26 with the design's 'Dapp · simulated' origin badge"); design #26b ix:11813, #27b ix:12163, the OriginBadge ix:4080-4089; Scope R22, R23

**Files:**
- Test: `extension/src/app/__tests__/Activity.test.tsx`
- Test: `extension/src/app/__tests__/TxDetail.test.tsx`
- Test: `extension/src/app/__tests__/engine.test.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/engine.ts`
- Modify: `extension/src/app/screens/Activity.tsx`
- Modify: `extension/src/app/screens/TxDetail.tsx`
- Create: `extension/src/app/ui/OriginBadge.tsx`
- Modify: `extension/src/app/ui/TopBar.tsx`

**Interfaces:**
- Consumes: Task 5's `wallet.history` `origin`; Task 7's extracted `.origin-badge` rules.
- Produces: `app/engine.ts` `HistoryItem.origin: 'dapp' | null` (absent reads as null; anything else refuses the page); `app/ui/OriginBadge.tsx` (`OriginBadge`, `DAPP_BADGE_TEXT`, `DAPP_BADGE_LABEL`); `TopBar`'s `badge` prop; the badge in `Activity.tsx`'s row title and `TxDetail.tsx`'s top bar.

The design's OriginBadge, `.origin-badge[data-origin="dapp"]`: "Dapp · simulated" with the chain-link glyph, inline in a #26 row's title (`.tx-row .meta .pri`) and in #27's title, 8 px after "Transaction". The aria-label is the design's provenance without its timing (R22). The first-party "Wallet" pill and #27b's Simulation row are not built (R23).

- [ ] **Step 1: Write the failing tests.**

Change `extension/src/app/__tests__/Activity.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/Activity.test.tsx b/extension/src/app/__tests__/Activity.test.tsx
index ad164da..fc5c3cd 100644
--- a/extension/src/app/__tests__/Activity.test.tsx
+++ b/extension/src/app/__tests__/Activity.test.tsx
@@ -47,6 +47,17 @@ afterEach(() => {
   vi.clearAllMocks();
 });
 
+// B1c-2 (spec B1c §3.3; #26b ix:11813): a transaction a site had this wallet sign carries "Dapp · simulated".
+describe('#26 activity: the OriginBadge (B1c-2)', () => {
+  it('a row whose transaction a site had signed carries the design’s badge (chain-link glyph, its provenance label); the others none', async () => {
+    await openActivity(historyReader(), async ext => ext.local.set('v1_dapp_txs', [{signature: sig(2), origin: 'https://jup.ag', at: 1}]), AT_NOW);
+    await screen.findByText('Sent SOL');
+    const badges = [...document.querySelectorAll('.tx-row .meta .pri .origin-badge')];
+    expect(badges.map(b => [b.textContent, b.getAttribute('data-origin'), b.getAttribute('aria-label'), b.querySelector('svg') !== null])).toEqual([['Dapp · simulated', 'dapp', 'dApp-originated transaction · simulated', true]]);
+    expect(badges[0]?.closest('.tx-row')?.querySelector('.pri')?.firstChild?.textContent).toBe('Received USDC');
+  });
+});
+
 describe('#26 activity', () => {
   it('rows per kind: sent (own account label), received, purchase, other, failed — no fiat, no origin badge', async () => {
     await openActivity(historyReader(), undefined, AT_NOW);
@@ -77,7 +88,7 @@ describe('#26 activity', () => {
     // "from H4qZ…m2N1" is an address; "to Your account: Savings" is a label (it would clip in mono).
     expect(sec('Received USDC').classList.contains('noc-mono')).toBe(true);
     expect(sec('Sent SOL').classList.contains('noc-mono')).toBe(false);
-    const base = {signature: sig(9), blockTime: null, mint: null, feeLamports: 5_000n, failed: false} as const;
+    const base = {signature: sig(9), blockTime: null, mint: null, feeLamports: 5_000n, failed: false, origin: null} as const;
     expect(rowText({...base, kind: 'sent', token: 'SOL', amount: 1n, counterparty: COUNTERPARTY}, []).mono).toBe(true);
     expect(rowText({...base, kind: 'sent', token: 'SOL', amount: 1n, counterparty: null}, []).mono).toBe(false);
     expect(sec('Presale purchase').classList.contains('noc-mono')).toBe(false);
@@ -88,7 +99,7 @@ describe('#26 activity', () => {
   // Plan 3, owner question 1 (option A): only a failed SEND names what it tried; any other failed transaction
   // keeps the generic row, and shows under "All" only.
   it('a failed transaction that is not a send stays "Failed · transaction" with a dash, and is not a send', () => {
-    const failedOther = {signature: sig(9), blockTime: null, kind: 'other', token: null, mint: null, amount: null, counterparty: null, feeLamports: 5_000n, failed: true} as const;
+    const failedOther = {signature: sig(9), blockTime: null, kind: 'other', token: null, mint: null, amount: null, counterparty: null, feeLamports: 5_000n, failed: true, origin: null} as const;
     expect(rowText(failedOther, [])).toMatchObject({title: 'Failed · transaction', amount: '—', tone: 'fail'});
     expect([matches(failedOther, 'all'), matches(failedOther, 'sent'), matches(failedOther, 'received'), matches(failedOther, 'purchases')]).toEqual([true, false, false, false]);
     const failedSend = {...failedOther, kind: 'sent', token: 'USDC', amount: 12_000_000n, counterparty: COUNTERPARTY} as const;
````

Change `extension/src/app/__tests__/TxDetail.test.tsx`:

````diff
diff --git a/extension/src/app/__tests__/TxDetail.test.tsx b/extension/src/app/__tests__/TxDetail.test.tsx
index aa84d36..7407bfa 100644
--- a/extension/src/app/__tests__/TxDetail.test.tsx
+++ b/extension/src/app/__tests__/TxDetail.test.tsx
@@ -31,6 +31,7 @@ const item = (over: Partial<HistoryItem>): HistoryItem => ({
   counterparty: RECIPIENT,
   feeLamports: 5_000n,
   failed: false,
+  origin: null,
   ...over,
 });
 const show = async (i: HistoryItem) => {
@@ -176,7 +177,7 @@ describe('#27 tx-detail', () => {
       transaction: {message: {accountKeys: [ACCOUNT.publicKey, COUNTERPARTY, RECIPIENT, MAINNET_FEE_TREASURY].map(k => ({pubkey: k, signer: false, writable: true})), instructions: [transfer(COUNTERPARTY, 1_000_000_000), transfer(RECIPIENT, 1_000_000_000)]}},
     });
     expect(decoded).toMatchObject({kind: 'other', failed: true});
-    await renderInWallet(<TxDetail signature={sig(6)} account={ACCOUNT.publicKey} item={decoded} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
+    await renderInWallet(<TxDetail signature={sig(6)} account={ACCOUNT.publicKey} item={{...decoded, origin: null}} onBack={() => undefined} canRetry onTryAgain={tryAgain} />);
     expect(await screen.findByText('FAILED')).toBeTruthy();
     expect(screen.queryByText('FAILED · SENT')).toBeNull();
     expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
@@ -954,3 +955,16 @@ describe('#27 and the address book', () => {
     expect(screen.getByText('Noctura treasury')).toBeTruthy();
   });
 });
+
+// B1c-2 (#27b ix:12163): the badge in the title, 8 px after "Transaction".
+describe('#27 tx-detail: the OriginBadge (B1c-2)', () => {
+  it('a site’s transaction: "Transaction" then "Dapp · simulated" in the title; the wallet’s own: no badge', async () => {
+    await show(item({origin: 'dapp'}));
+    const title = document.querySelector('.top-bar .title') as HTMLElement;
+    expect([title.className, title.firstChild?.textContent, title.querySelector('.origin-badge')?.textContent]).toEqual(['title noc-h3 app-title-badge', 'Transaction', 'Dapp · simulated']);
+    cleanup();
+    await show(item({origin: null}));
+    expect(document.querySelector('.top-bar .title')?.className).toBe('title noc-h3');
+    expect(document.querySelector('.origin-badge')).toBeNull();
+  });
+});
````

Change `extension/src/app/__tests__/engine.test.ts`:

````diff
diff --git a/extension/src/app/__tests__/engine.test.ts b/extension/src/app/__tests__/engine.test.ts
index a9084db..a7b862d 100644
--- a/extension/src/app/__tests__/engine.test.ts
+++ b/extension/src/app/__tests__/engine.test.ts
@@ -232,6 +232,17 @@ describe('shape checks: a reply of the wrong shape is failed', () => {
     expect(await engineAnswering({ok: true, data: {...good, next: undefined}}).history(acc)).toEqual({ok: false, error: 'failed'});
   });
 
+  // B1c-2: an item's origin — 'dapp', null, or absent (an older background) — and nothing else.
+  it('history: an item’s origin is "dapp" or null (absent reads as null); any other value refuses the page', async () => {
+    const one = {signature: '5'.repeat(88), blockTime: null, kind: 'other', token: null, mint: null, amount: null, counterparty: null, feeLamports: '5000', failed: false};
+    const items = async (origin: unknown) => {
+      const r = await engineAnswering({ok: true, data: {items: [origin === 'absent' ? one : {...one, origin}], next: null}}).history(acc);
+      return r.ok ? r.data.items.map(i => i.origin) : r;
+    };
+    expect([await items('dapp'), await items(null), await items('absent')]).toEqual([['dapp'], [null], [null]]);
+    for (const bad of ['wallet', 1, {}]) expect(await items(bad)).toEqual({ok: false, error: 'failed'});
+  });
+
   it('pending: an unknown state or failure value', async () => {
     const p = {
       id: 'r1', account: acc, signature: '5'.repeat(88), lastValidBlockHeight: 1, createdAt: 1, lastSentAt: 1, state: 'pending', detail: null, detailCode: null,
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

Run: `npx vitest run src/app/__tests__/Activity.test.tsx src/app/__tests__/TxDetail.test.tsx src/app/__tests__/engine.test.ts`

Expected (the dry run): Test Files  3 failed (3) · Tests  3 failed | 108 passed (111)

- [ ] **Step 3: Implement.**

Change `extension/src/app/app.css`:

````diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 96d3e17..2f98d47 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1960,3 +1960,9 @@ body:has(.app-window) {
 .s9-payload-card .row .v.noc-danger {
   color: var(--danger);
 }
+/* B1c-2: #27b's title with its OriginBadge, inline at the design's 8 px gap (ix:12163). */
+.top-bar .title.app-title-badge {
+  display: inline-flex;
+  align-items: center;
+  gap: var(--space-2);
+}
````

Change `extension/src/app/engine.ts`:

````diff
diff --git a/extension/src/app/engine.ts b/extension/src/app/engine.ts
index ae0c729..1ff1698 100644
--- a/extension/src/app/engine.ts
+++ b/extension/src/app/engine.ts
@@ -105,6 +105,8 @@ export interface HistoryItem {
   counterparty: string | null;
   feeLamports: bigint;
   failed: boolean;
+  /** B1c-2: a transaction a site had this wallet sign ("Dapp · simulated", #26b/#27b), else null. */
+  origin: 'dapp' | null;
 }
 /**
  * `next` is the cursor for the next `history()` call (the getSignaturesForAddress page's own last
@@ -435,8 +437,10 @@ function historyOf(x: unknown): HistoryItem | undefined {
   const blockTime = o.blockTime === null ? null : isInt(o.blockTime) ? o.blockTime : undefined;
   const mint = o.mint === null ? null : isAddress(o.mint) ? o.mint : undefined;
   const counterparty = o.counterparty === null ? null : isAddress(o.counterparty) ? o.counterparty : undefined;
-  if (kind === undefined || token === undefined || amount === undefined || feeLamports === undefined || blockTime === undefined || mint === undefined || counterparty === undefined || typeof o.failed !== 'boolean') return undefined;
-  return {signature: o.signature, blockTime, kind, token, mint, amount, counterparty, feeLamports, failed: o.failed};
+  // B1c-2: absent from an older background — read as none.
+  const origin = o.origin === 'dapp' ? 'dapp' : o.origin === undefined || o.origin === null ? null : undefined;
+  if (kind === undefined || token === undefined || amount === undefined || feeLamports === undefined || blockTime === undefined || mint === undefined || counterparty === undefined || typeof o.failed !== 'boolean' || origin === undefined) return undefined;
+  return {signature: o.signature, blockTime, kind, token, mint, amount, counterparty, feeLamports, failed: o.failed, origin};
 }
 
 /** `next`: null, or a string that passes the same signature check as an item's own `signature` (review fix round 1 #1). */
````

Change `extension/src/app/screens/Activity.tsx`:

````diff
diff --git a/extension/src/app/screens/Activity.tsx b/extension/src/app/screens/Activity.tsx
index f400ddb..bbdda8e 100644
--- a/extension/src/app/screens/Activity.tsx
+++ b/extension/src/app/screens/Activity.tsx
@@ -8,6 +8,7 @@ import {useNow} from '../useNow';
 import {ChipRow} from '../ui/Chip';
 import {ExtIcon} from '../ui/ExtIcon';
 import {Banner, RefusedBanner} from '../ui/Banner';
+import {OriginBadge} from '../ui/OriginBadge';
 import type {HistoryItem, Pending} from '../engine';
 
 /** wallet.history answers 10 per page (background HISTORY_PAGE_SIZE); "Load more" follows the reply's own `next` cursor (review fix round 1 #1), not this count. */
@@ -68,8 +69,9 @@ function Empty({refreshing, onReceive}: {refreshing: boolean; onReceive: () => v
 
 /**
  * #26 activity (spec §6.2) and #41 when there is nothing. Rows from wallet.history (10 a page, paced by
- * the background), open sends on top. No fiat per row (it would need historical prices), no origin
- * badge (B1c), counterparties short at equal weight (a list is a scanning aid; #27 shows the whole address).
+ * the background), open sends on top. No fiat per row (it would need historical prices); the origin badge only on a
+ * site's transaction (B1c-2: "Dapp · simulated" — the "Wallet" pill is not drawn, Scope); counterparties short at equal
+ * weight (a list is a scanning aid; #27 shows the whole address).
  */
 export function Activity({onTx, onReceive, onPending}: {onTx: (item: HistoryItem) => void; onReceive: () => void; onPending: (p: Pending) => void}) {
   const m = useWallet();
@@ -250,7 +252,10 @@ export function Activity({onTx, onReceive, onPending}: {onTx: (item: HistoryItem
                     <ExtIcon name={t.tone === 'fail' ? 'close' : t.tone === 'plain' ? 'doc' : t.tone === 'swap' ? 'swap' : 'arrow-up-right'} size={20} />
                   </span>
                   <span className="meta">
-                    <span className="pri noc-body-lg">{t.title}</span>
+                    <span className="pri noc-body-lg">
+                      {t.title}
+                      {item.origin === 'dapp' ? <OriginBadge /> : null}
+                    </span>
                     <span className={`sec noc-body-sm${t.mono ? ' noc-mono' : ''}`}>
                       {t.meta}
                       {time}
````

Change `extension/src/app/screens/TxDetail.tsx`:

````diff
diff --git a/extension/src/app/screens/TxDetail.tsx b/extension/src/app/screens/TxDetail.tsx
index dbf9247..503d37e 100644
--- a/extension/src/app/screens/TxDetail.tsx
+++ b/extension/src/app/screens/TxDetail.tsx
@@ -4,6 +4,7 @@ import {TOKEN_INFO, ago, feeUsd, fullDate, showAmount, showFee, showUsd} from '.
 import {explorerUrl} from '../explorer';
 import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
 import {TopBar} from '../ui/TopBar';
+import {OriginBadge} from '../ui/OriginBadge';
 import {StatusPill} from '../ui/StatusPill';
 import {ExtIcon} from '../ui/ExtIcon';
 import {useCopy} from '../ui/useCopy';
@@ -187,7 +188,7 @@ export function TxDetail({
     };
   }, [given, ready, owner, signature, m.engine]);
 
-  const top = <TopBar title="Transaction" onBack={onBack} titleClass="noc-h3" />;
+  const top = <TopBar title="Transaction" onBack={onBack} titleClass="noc-h3" badge={item !== null && item !== undefined && item.origin === 'dapp' ? <OriginBadge /> : undefined} />;
   if (item === undefined) {
     if (searchError !== null) {
       // #42/D26 banner over the search, exactly as Activity shows it — never the not-in-history line.
````

Create `extension/src/app/ui/OriginBadge.tsx`:

````tsx
import {ExtIcon} from './ExtIcon';

/**
 * The design's OriginBadge for a dApp's transaction (index.html #26b ix:11813, #27b ix:12163; `.origin-badge
 * [data-origin="dapp"]`): "Dapp · simulated" with the chain-link glyph — the visible sign that the transaction went
 * through #48's mandatory simulation (spec B1c §3.3). The first-party "Wallet" pill is not drawn (Scope: the extension
 * knows only the transactions sites had it sign). The aria-label is the design's provenance without its timing (the
 * wallet does not keep a past simulation's milliseconds) — controller copy, Scope.
 */
export const DAPP_BADGE_TEXT = 'Dapp · simulated';
export const DAPP_BADGE_LABEL = 'dApp-originated transaction · simulated';

export function OriginBadge() {
  return (
    <span className="origin-badge" data-origin="dapp" aria-label={DAPP_BADGE_LABEL}>
      <ExtIcon name="link" size={9} />
      {DAPP_BADGE_TEXT}
    </span>
  );
}
````

Change `extension/src/app/ui/TopBar.tsx`:

````diff
diff --git a/extension/src/app/ui/TopBar.tsx b/extension/src/app/ui/TopBar.tsx
index a003e17..f1ccca2 100644
--- a/extension/src/app/ui/TopBar.tsx
+++ b/extension/src/app/ui/TopBar.tsx
@@ -5,7 +5,7 @@ import {ExtIcon} from './ExtIcon';
  * The design's `.top-bar` (56 px): back, title, and an optional trailing control. `titleClass` is the title's type
  * class as the screen's mockup draws it (`.noc-h1` on #12; none on #19 and #20, whose title is the plain `.title`).
  */
-export function TopBar({title, onBack, trailing, titleClass = 'noc-h1'}: {title: string; onBack?: () => void; trailing?: ReactNode; titleClass?: string}) {
+export function TopBar({title, onBack, trailing, titleClass = 'noc-h1', badge}: {title: string; onBack?: () => void; trailing?: ReactNode; titleClass?: string; badge?: ReactNode}) {
   return (
     <div className="top-bar">
       {onBack === undefined ? null : (
@@ -13,7 +13,11 @@ export function TopBar({title, onBack, trailing, titleClass = 'noc-h1'}: {title:
           <ExtIcon name="back" size={22} />
         </button>
       )}
-      <div className={titleClass === '' ? 'title' : `title ${titleClass}`}>{title}</div>
+      {/* B1c-2: #27b's OriginBadge sits in the title, 8 px after the word (ix:12163). */}
+      <div className={`${titleClass === '' ? 'title' : `title ${titleClass}`}${badge === undefined ? '' : ' app-title-badge'}`}>
+        {title}
+        {badge}
+      </div>
       {trailing}
     </div>
   );
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx vitest run src/app/__tests__/Activity.test.tsx src/app/__tests__/TxDetail.test.tsx src/app/__tests__/engine.test.ts` — expected: Test Files  3 passed (3) · Tests  111 passed (111)

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  165 passed (165) · Tests  3229 passed (3229). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M8a | `Activity.tsx`: no badge | Activity.test.tsx "the OriginBadge" — RED Tests  1 failed \| 28 passed (29) |
| M8b | `engine.ts`: any origin value read as none | engine.test.ts "history: an item's origin" — RED Tests  1 failed \| 26 passed (27) |
| M8c | `TxDetail.tsx`: no badge in the title | TxDetail.test.tsx "the OriginBadge" — RED Tests  1 failed \| 54 passed (55) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "feat(extension): B1c-2 the OriginBadge — \"Dapp · simulated\" on #26's rows and #27's title" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 9: E2E B1c-25 … B1c-28: signTransaction (one, five, six refused), signAndSendTransaction through the route with #26's badge, StandardWalletAdapter, re-authentication through the toolbar and the mismatch notice

**Spec:** §6.3 (B1c-2: sign-and-send against the fake coordinator, a batch of 5, a batch of 6 refused, the same through StandardWalletAdapter), §3.3, D8, D10, D11; review-1 M1; Scope R9, R16, R25

**Files:**
- Test: `extension/e2e/dapp.spec.ts`
- Test: `extension/e2e/dappPage.ts`
- Test (new): `extension/e2e/dappTx.spec.ts`
- Test: `extension/e2e/fakeCoordinator.ts`
- Test: `extension/e2e/fixtures/dapp/page.ts`
- Modify: `extension/package-lock.json` (written by npm 11.6.2 — the command in Step 3; never by hand)
- Modify: `extension/package.json`

**Interfaces:**
- Consumes: everything above, built; B1c-1's harness (`launchPopup`, `serveDapp`, `approvalWindow`, `windowClosed`, `noWindow`, `contained`), the fake coordinator.
- Produces: `e2e/dappTx.spec.ts`; the test dApp page's `signTx`, `send`, `raw`, `rawTx` and the adapter calls (`adapterCompatible`, `adapterConnect`, `adapterSign`, `adapterSignAll`, `adapterSend`); `dappPage.ts`'s `signTx`, `sendTx`, `rawSignTx`, `adapter`; the fake coordinator's `simulateErr`; three devDependencies (the command below).

The test dApp page now bundles a real dApp's stack — `@solana/web3.js` and `StandardWalletAdapter` over the same Wallet Standard wallet — and builds its own v0 transfers at a blockhash the test hands it (any 32 bytes: the fake's simulation reads none). B1c-25: the six features (D10), one transaction approved and its signature verified, a batch of five on one screen, six refused with no window. B1c-26: a sign-and-send whose bytes reach the fake route once, whose signature is the page's answer, whose pending record is the dApp's (`origin`, no intent), and whose row in #26 carries the badge once it lands. B1c-27: `isWalletAdapterCompatibleStandardWallet` (plan 1 alone was not compatible), the adapter's connect, signTransaction, signAllTransactions of five, of six refused (the adapter reports its own error), and sendTransaction through the route. B1c-28: a first send — Approve, the window pointing to the toolbar, the popup's strip, #10 with the real password, the window then signing; and a script posting straight to the relay with the account another site holds — `unauthorized`, and the mismatch notice. B1c-19's features line changes (D10).

Install the three devDependencies with npm 11.6.2 (exact versions; the lockfile is npm's):

```bash
npm install --save-dev --save-exact @solana/wallet-adapter-base@0.9.28 @solana/wallet-standard-wallet-adapter-base@1.1.6 bs58@6.0.0
```

- [ ] **Step 1: Write the failing tests.**

Change `extension/e2e/dapp.spec.ts`:

````diff
diff --git a/extension/e2e/dapp.spec.ts b/extension/e2e/dapp.spec.ts
index 9748c01..62a6c69 100644
--- a/extension/e2e/dapp.spec.ts
+++ b/extension/e2e/dapp.spec.ts
@@ -58,8 +58,8 @@ test('B1c-19 · connect: Noctura found → #47b → both gates → the account;
     const p = await popup(h);
     const page = await openDapp(h.ctx, DAPP);
     expect(await names(page)).toContain('Noctura');
-    // D10: plan 1 advertises exactly what it implements.
-    expect(await features(page)).toEqual(['solana:signMessage', 'standard:connect', 'standard:disconnect', 'standard:events']);
+    // D10: the provider advertises exactly what it implements — B1c-2 adds the two transaction features.
+    expect(await features(page)).toEqual(['solana:signAndSendTransaction', 'solana:signMessage', 'solana:signTransaction', 'standard:connect', 'standard:disconnect', 'standard:events']);
     // A silent connect never opens a window.
     expect(await connect(page, true)).toEqual({ok: true, value: []});
     let pending!: Promise<unknown>;
````

Change `extension/e2e/dappPage.ts`:

````diff
diff --git a/extension/e2e/dappPage.ts b/extension/e2e/dappPage.ts
index 1cecaa1..28e2d52 100644
--- a/extension/e2e/dappPage.ts
+++ b/extension/e2e/dappPage.ts
@@ -9,7 +9,13 @@ import {fileURLToPath} from 'node:url';
  * so a request the route misses fails locally. `hits` counts what the route served; `unexpected` any path it does not
  * serve (asserted empty).
  */
-export const DAPP_HOSTS = ['dapp.test', 'jup.ag', 'tensr.trade', 'xn--phntom-4nf.app', 'xn--bcher-kva.example'] as const;
+export const DAPP_HOSTS = ['dapp.test', 'jup.ag', 'tensr.trade', 'xn--phntom-4nf.app', 'xn--bcher-kva.example', 'api.mainnet-beta.solana.com'] as const;
+/**
+ * B1c-2: the test dApp's own RPC endpoint (its @solana/web3.js Connection — a wallet-adapter dApp's). The adapter never
+ * calls it while the wallet sends through signAndSendTransaction; a call would mean it fell back to sending itself.
+ * Contained like every other host: unresolvable in the browser, and the route records any request as unexpected.
+ */
+const DAPP_RPC_HOST = 'api.mainnet-beta.solana.com';
 const ROOT = fileURLToPath(new URL('..', import.meta.url));
 
 let script: string | null = null;
@@ -20,6 +26,9 @@ async function dappScript(): Promise<string> {
     logLevel: 'silent',
     root: ROOT,
     publicDir: false,
+    // B1c-2: the page bundles @solana/web3.js and the wallet adapter (a real dApp's stack); @solana/errors reads
+    // process.env.NODE_ENV, which a page does not have.
+    define: {'process.env.NODE_ENV': '"production"'},
     build: {write: false, minify: false, lib: {entry: 'e2e/fixtures/dapp/page.ts', formats: ['iife'], name: 'testDapp', fileName: () => 'dapp.js'}},
   })) as Rollup.RollupOutput | Rollup.RollupOutput[];
   const first = Array.isArray(out) ? out[0] : out;
@@ -42,6 +51,13 @@ export async function serveDapp(ctx: BrowserContext): Promise<DappServer> {
   const js = await dappScript();
   const server: DappServer = {hits: [], unexpected: []};
   for (const host of DAPP_HOSTS) {
+    if (host === DAPP_RPC_HOST) {
+      await ctx.route(`https://${DAPP_RPC_HOST}/**`, (route: Route) => {
+        server.unexpected.push(route.request().url());
+        return route.abort();
+      });
+      continue;
+    }
     await ctx.route(new RegExp(`^https://${host.replace(/\./g, '\\.')}(:\\d+)?/`), (route: Route) => {
       const url = new URL(route.request().url());
       server.hits.push(url.href);
@@ -65,6 +81,15 @@ declare const dapp: {
   connect(silent: boolean): Promise<Result>;
   disconnect(): Promise<Result>;
   sign(text: string, o?: {base64?: boolean}): Promise<Result>;
+  signTx(count: number, blockhash: string): Promise<Result>;
+  send(blockhash: string, lamports: number): Promise<Result>;
+  adapterCompatible(): boolean;
+  adapterConnect(): Promise<Result>;
+  adapterSign(blockhash: string): Promise<Result>;
+  adapterSignAll(count: number, blockhash: string): Promise<Result>;
+  adapterSend(blockhash: string): Promise<Result>;
+  raw(type: string, payload: Record<string, unknown>): Promise<unknown>;
+  rawTx(account: string, blockhash: string): string;
 };
 
 /** A dApp tab at `origin`, its Wallet Standard registry ready (Noctura found, or not). */
@@ -83,6 +108,19 @@ export const connect = (p: Page, silent = false) => p.evaluate(s => dapp.connect
 export const disconnect = (p: Page) => p.evaluate(() => dapp.disconnect());
 export const sign = (p: Page, text: string, o: {base64?: boolean} = {}) => p.evaluate(({t, b}) => dapp.sign(t, {base64: b}), {t: text, b: o.base64 === true});
 
+/** B1c-2: the test dApp's transaction calls (e2e/fixtures/dapp/page.ts), each a v0 transfer at `blockhash`. */
+export const signTx = (p: Page, count: number, blockhash: string) => p.evaluate(({n, b}) => dapp.signTx(n, b), {n: count, b: blockhash});
+export const sendTx = (p: Page, blockhash: string, lamports: number) => p.evaluate(({b, l}) => dapp.send(b, l), {b: blockhash, l: lamports});
+/** A transaction request posted straight to the relay (any script on a page can), naming `account`. */
+export const rawSignTx = (p: Page, account: string, blockhash: string) => p.evaluate(({a, b}) => dapp.raw('page.signTransaction', {account: a, transactions: [dapp.rawTx(a, b)]}), {a: account, b: blockhash});
+export const adapter = {
+  compatible: (p: Page) => p.evaluate(() => dapp.adapterCompatible()),
+  connect: (p: Page) => p.evaluate(() => dapp.adapterConnect()),
+  sign: (p: Page, blockhash: string) => p.evaluate(b => dapp.adapterSign(b), blockhash),
+  signAll: (p: Page, count: number, blockhash: string) => p.evaluate(({n, b}) => dapp.adapterSignAll(n, b), {n: count, b: blockhash}),
+  send: (p: Page, blockhash: string) => p.evaluate(b => dapp.adapterSend(b), blockhash),
+};
+
 /**
  * The approval window `act` causes (windows.create → a new page of approve.html). What `act` returns is NOT awaited: a
  * request's promise settles only once the window decides it (the dry run's first form awaited it and deadlocked).
````

Create `extension/e2e/dappTx.spec.ts`:

````ts
import {test, expect, type Page} from '@playwright/test';
import {ed25519} from '@noble/curves/ed25519.js';
import {base58, base64} from '@scure/base';
import {contained, launchPopup, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {DAPP_HOSTS, adapter, approvalWindow, connect, features, noWindow, openDapp, rawSignTx, sendTx, serveDapp, signTx, windowClosed, type DappServer} from './dappPage';
import {parseV0} from './fakeCoordinator';

// Spec B1c §6.3 (B1c-2), §3.3, §1.4: the transaction features against the real extension — the provider, the relay,
// the background's decoder and simulation (through the fake coordinator's proxy), #48 in the approval window, the
// broadcast route — with the test dApp's own @solana/web3.js transactions, driven raw and through
// @solana/wallet-adapter's StandardWalletAdapter (review-1 M1). Titles "B1c-NN · " as B1c-1's. Chromium only (B1c-1's
// note: Firefox's port.sender.origin is a line of B1e's manual run).
declare const chrome: {storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}}};

const ACCOUNT = E2E_ACCOUNTS[0];
const DAPP = 'https://dapp.test';
/** The test dApp's recipient (e2e/fixtures/dapp/page.ts). */
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
/** Any 32 bytes serve as the dApp's blockhash: the fake's simulation reads none of it. */
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));

async function scene(prefix: string, o: {knownRecipient?: boolean} = {}): Promise<{h: Harness; server: DappServer}> {
  const h = await launchPopup(prefix, {hosts: DAPP_HOSTS});
  const server = await serveDapp(h.ctx);
  await h.sw.evaluate(env => chrome.storage.local.set({v1_vault: env}), await makeEnvelope());
  // B1b's first-send rule asks for a re-authentication unless the recipient was sent to before (B1c-28 is about that).
  if (o.knownRecipient !== false) await h.sw.evaluate(r => chrome.storage.local.set({v1_known_recipients: [{address: r, at: Date.now()}]}), RECIPIENT);
  const vault = await h.ctx.newPage();
  await unlockWith(vault, h.id, E2E_PASSWORD);
  await vault.close();
  return {h, server};
}
function done(h: Harness, server: DappServer): void {
  contained(h);
  expect(server.unexpected).toEqual([]);
}
async function popup(h: Harness): Promise<Page> {
  const p = await h.openPopup();
  await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  return p;
}
/** A connected page (47b's two gates). */
async function connected(h: Harness, origin = DAPP): Promise<Page> {
  const page = await openDapp(h.ctx, origin);
  const win = await approvalWindow(h.ctx, () => connect(page));
  await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
  await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
  await win.getByRole('button', {name: 'Connect for this session'}).click();
  await windowClosed(win);
  return page;
}
/** A signed wire's message bytes (past the shortvec and the signatures) and its signatures. */
function wireParts(wire: Uint8Array): {message: Uint8Array; signatures: Uint8Array[]} {
  const n = wire[0] ?? 0;
  return {message: wire.subarray(1 + 64 * n), signatures: Array.from({length: n}, (_, i) => wire.subarray(1 + 64 * i, 1 + 64 * (i + 1)))};
}
const signedBy = (wireB64: string, slot = 0): boolean => {
  const {message, signatures} = wireParts(base64.decode(wireB64));
  return ed25519.verify(signatures[slot] ?? new Uint8Array(64), message, base58.decode(ACCOUNT));
};
/** #48 simulated (the balance changes shown), then Approve — held 500 ms by C15, which Playwright waits out. */
async function approve(win: Page): Promise<void> {
  await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 10_000});
  await win.getByRole('button', {name: 'Approve', exact: true}).click();
}

test('B1c-25 · signTransaction: the six features; one transaction → #48 → Approve → signed; a batch of five on one screen → five signed; six refused with no window', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene('noctura-e2e-dapptx-sign-');
  try {
    await popup(h);
    const page = await connected(h);
    // D10: B1c-2 advertises the two transaction features beside plan 1's four.
    expect(await features(page)).toEqual(['solana:signAndSendTransaction', 'solana:signMessage', 'solana:signTransaction', 'standard:connect', 'standard:disconnect', 'standard:events']);
    let one!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (one = signTx(page, 1, BLOCKHASH)));
    await expect(win.locator('.top-bar .title')).toHaveText('Approve transaction');
    await expect(win.locator('.s9-payload-card .row .v.mono').first()).toHaveText('1111…1111 · system_program');
    await approve(win);
    const r1 = (await one) as {ok: true; value: string[]};
    expect(r1.ok).toBe(true);
    expect(r1.value).toHaveLength(1);
    expect(signedBy(r1.value[0] ?? '')).toBe(true);
    // The simulation the window showed asked the proxy for the account and the transaction's writable accounts.
    expect(h.fake.simulations.at(-1)).toEqual([ACCOUNT, RECIPIENT]);
    await windowClosed(win);

    let five!: Promise<unknown>;
    const w5 = await approvalWindow(h.ctx, () => (five = signTx(page, 5, BLOCKHASH)));
    await expect(w5.locator('.app-tx-batch')).toHaveText(['Transaction 1 of 5', 'Transaction 2 of 5', 'Transaction 3 of 5', 'Transaction 4 of 5', 'Transaction 5 of 5']);
    await approve(w5);
    const r5 = (await five) as {ok: true; value: string[]};
    expect(r5.value).toHaveLength(5);
    expect(r5.value.every(w => signedBy(w))).toBe(true);
    await windowClosed(w5);
    // D8: more than five is refused in the background, before any window.
    expect(await noWindow(h.ctx, () => signTx(page, 6, BLOCKHASH))).toEqual({ok: false, code: 'invalid-request', message: 'The request is not valid.'});
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-26 · signAndSendTransaction: #48 → Approve → the route gets the signed bytes once; the page gets their signature; #26 badges the row "Dapp · simulated"', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene('noctura-e2e-dapptx-send-');
  try {
    const p = await popup(h);
    const page = await connected(h);
    let sent!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (sent = sendTx(page, BLOCKHASH, 2_000_000)));
    await approve(win);
    const r = (await sent) as {ok: true; value: string};
    expect(r.ok).toBe(true);
    const signature = base58.encode(base64.decode(r.value));
    expect(h.fake.broadcasts).toStrictEqual([signature]);
    const wire = h.fake.broadcastWires[0] ?? '';
    expect(signedBy(wire)).toBe(true);
    expect(parseV0(base64.decode(wire)).keys).toEqual([ACCOUNT, RECIPIENT, '11111111111111111111111111111111']);
    // The pending record, the dApp's (B1b's v1_pending pattern) — the popup's own pending list omits it.
    const pending = (await h.sw.evaluate(() => chrome.storage.local.get('v1_pending'))).v1_pending as {signature: string; origin: string | null; intent: unknown}[];
    expect(pending.map(x => [x.signature, x.origin, x.intent])).toEqual([[signature, DAPP, null]]);
    // The transaction lands in the account's history: #26 badges it.
    h.fake.history.set(ACCOUNT, [{signature, tx: {blockTime: Math.floor(Date.now() / 1000), meta: {err: null, fee: 5000, preBalances: [10_000_000_000, 0, 1], postBalances: [9_997_995_000, 2_000_000, 1], preTokenBalances: [], postTokenBalances: []}, transaction: {message: {accountKeys: [{pubkey: ACCOUNT, signer: true, writable: true}, {pubkey: RECIPIENT, signer: false, writable: true}, {pubkey: '11111111111111111111111111111111', signer: false, writable: false}], instructions: [{programId: '11111111111111111111111111111111', parsed: {type: 'transfer', info: {source: ACCOUNT, destination: RECIPIENT, lamports: 2_000_000}}, program: 'system'}]}}}}]);
    await p.getByRole('button', {name: 'Activity'}).click();
    const row = p.locator('.tx-row', {hasText: 'Sent SOL'});
    await expect(row.locator('.origin-badge')).toHaveText('Dapp · simulated');
    await expect(row.locator('.origin-badge')).toHaveAttribute('aria-label', 'dApp-originated transaction · simulated');
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-27 · through StandardWalletAdapter: compatible; connect; signTransaction; signAllTransactions of five, of six refused; sendTransaction', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene('noctura-e2e-dapptx-adapter-');
  try {
    await popup(h);
    const page = await openDapp(h.ctx, DAPP);
    // The adapter's own predicate (review-1 M1): plan 1 alone was not compatible; B1c-2 is.
    expect(await adapter.compatible(page)).toBe(true);
    let c!: Promise<unknown>;
    const w47 = await approvalWindow(h.ctx, () => (c = adapter.connect(page)));
    await w47.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
    await w47.getByRole('checkbox', {name: /I've read these permissions/}).click();
    await w47.getByRole('button', {name: 'Connect for this session'}).click();
    expect(await c).toEqual({ok: true, value: ACCOUNT});
    await windowClosed(w47);

    let one!: Promise<unknown>;
    const w1 = await approvalWindow(h.ctx, () => (one = adapter.sign(page, BLOCKHASH)));
    await approve(w1);
    const r1 = (await one) as {ok: true; value: string};
    expect(signedBy(r1.value)).toBe(true);
    await windowClosed(w1);

    let all!: Promise<unknown>;
    const w5 = await approvalWindow(h.ctx, () => (all = adapter.signAll(page, 5, BLOCKHASH)));
    await expect(w5.locator('.app-tx-batch')).toHaveCount(5);
    await approve(w5);
    const r5 = (await all) as {ok: true; value: string[]};
    expect(r5.value).toHaveLength(5);
    expect(r5.value.every(w => signedBy(w))).toBe(true);
    await windowClosed(w5);
    // Six: the background refuses (D8) — the adapter reports its own WalletSignTransactionError, nothing opens.
    const six = (await noWindow(h.ctx, () => adapter.signAll(page, 6, BLOCKHASH))) as {ok: false; message: string};
    expect(six.ok).toBe(false);
    expect(six.message).toBe('The request is not valid.');

    let send!: Promise<unknown>;
    const ws = await approvalWindow(h.ctx, () => (send = adapter.send(page, BLOCKHASH)));
    await approve(ws);
    const rs = (await send) as {ok: true; value: string};
    expect(rs.ok).toBe(true);
    expect(h.fake.broadcasts).toStrictEqual([rs.value]);
    // Through signAndSendTransaction — the dApp's record (the adapter's fallback, signTransaction then its own
    // Connection, would leave none and reach the dApp's RPC, which done() refuses).
    const pending = (await h.sw.evaluate(() => chrome.storage.local.get('v1_pending'))).v1_pending as {signature: string; origin: string | null}[];
    expect(pending.map(x => [x.signature, x.origin])).toStrictEqual([[rs.value, DAPP]]);
    done(h, server);
  } finally {
    await h.close();
  }
});

test('B1c-28 · re-authentication through the toolbar (D11): a first send → Approve → the window points to the icon → the popup’s strip → #10 → the window signs; a mismatch notice', async () => {
  test.setTimeout(300_000);
  const {h, server} = await scene('noctura-e2e-dapptx-reauth-', {knownRecipient: false});
  try {
    await popup(h);
    const page = await connected(h);
    let pending!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (pending = signTx(page, 1, BLOCKHASH)));
    await expect(win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.")).toBeVisible({timeout: 10_000});
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    await expect(win.getByText("Confirm it's you")).toBeVisible();
    await expect(win.locator('a, input, select, textarea')).toHaveCount(0);
    await expect(win.getByRole('button', {name: 'Approve', exact: true})).toBeDisabled();
    // The toolbar: the popup offers #10 for the site's transaction.
    const toolbar = await h.openPopup();
    const strip = toolbar.getByRole('button', {name: 'A transaction from dapp.test waits for your confirmation'});
    const [tab] = await Promise.all([h.ctx.waitForEvent('page'), strip.click()]);
    await expect(tab).toHaveURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
    await tab.locator('#ra-password').fill(E2E_PASSWORD);
    await tab.locator('#ra-confirm').click();
    await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. Go back to the approval window and approve the transaction.', {timeout: 60_000});
    // The window learns it on its next poll (one a second).
    await expect(win.getByText("Confirm it's you")).toHaveCount(0, {timeout: 3_000});
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const r = (await pending) as {ok: true; value: string[]};
    expect(signedBy(r.value[0] ?? '')).toBe(true);
    await windowClosed(win);

    // A site asking with the account dapp.test holds: refused at once, and the window says what was refused.
    // The provider itself refuses an account it was not given; a script posting straight to the relay is what reaches
    // the background (§1.1: every script on the page has the page's authority over the provider).
    const other = await openDapp(h.ctx, 'https://jup.ag');
    let refused!: Promise<unknown>;
    const notice = await approvalWindow(h.ctx, () => (refused = rawSignTx(other, ACCOUNT, BLOCKHASH)));
    await expect(notice.getByText('Request blocked automatically')).toBeVisible();
    await expect(notice.locator('.s9-payload-card .row .v')).toHaveText(['dapp.test', 'jup.ag', 'false', 'REJECT_NO_PROMPT']);
    expect(await refused).toEqual({error: 'unauthorized'});
    await notice.getByRole('button', {name: 'OK, return to dApp'}).click();
    await windowClosed(notice);
    done(h, server);
  } finally {
    await h.close();
  }
});
````

Change `extension/e2e/fakeCoordinator.ts`:

````diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
index 9f6c142..ef07f6f 100644
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -50,6 +50,8 @@ export interface FakeCoordinator {
   accountKinds: Map<string, 'wallet' | 'program' | 'other'>;
   /** The simulation's error switch (E2): err set and accounts null, as the real RPC answers. */
   simulateError: boolean;
+  /** B1c-2: the err a switched-on simulation answers — an InstructionError unless set (the node's 'BlockhashNotFound', Q21). */
+  simulateErr: unknown;
   /** Every simulateTransaction's requested addresses (null = the field was missing). */
   simulations: (string[] | null)[];
   /** Plan 3: the payer's lamports after each simulated transaction, fee included — what the node answered. */
@@ -152,6 +154,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     defaultLamports: 10_000_000_000,
     accountKinds: new Map(),
     simulateError: false,
+    simulateErr: {InstructionError: [2, {Custom: 1}]},
     simulations: [],
     simulatedPayerAfter: [],
     tokenAccounts: new Map(),
@@ -201,7 +204,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     const addresses = Array.isArray(config?.accounts?.addresses) ? (config.accounts.addresses as string[]) : null;
     fake.simulations.push(addresses);
     if (addresses === null || config?.accounts?.encoding !== 'base64') fake.unexpected.push('simulateTransaction without accounts {encoding: base64, addresses}');
-    if (fake.simulateError) return {context: context(), value: {err: {InstructionError: [2, {Custom: 1}]}, logs: [], accounts: null, unitsConsumed: 0, returnData: null}};
+    if (fake.simulateError) return {context: context(), value: {err: fake.simulateErr, logs: [], accounts: null, unitsConsumed: 0, returnData: null}};
     const {signers, keys, instructions} = parseV0(base64.decode(params[0] as string));
     const payer = keys[0] ?? '';
     let out = 0;
````

Change `extension/e2e/fixtures/dapp/page.ts`:

````diff
diff --git a/extension/e2e/fixtures/dapp/page.ts b/extension/e2e/fixtures/dapp/page.ts
index 68d38d8..cdad985 100644
--- a/extension/e2e/fixtures/dapp/page.ts
+++ b/extension/e2e/fixtures/dapp/page.ts
@@ -1,5 +1,8 @@
 import {getWallets} from '@wallet-standard/app';
 import type {Wallet, WalletAccount} from '@wallet-standard/base';
+import {isWalletAdapterCompatibleStandardWallet, type WalletAdapterCompatibleStandardWallet} from '@solana/wallet-adapter-base';
+import {StandardWalletAdapter} from '@solana/wallet-standard-wallet-adapter-base';
+import {Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from '@solana/web3.js';
 
 /**
  * The test dApp (B1c §6.3): the script of the page E2E serves at https://dapp.test (and the other fixture hosts) through
@@ -49,6 +52,37 @@ async function run(f: () => Promise<unknown>): Promise<Result> {
   }
 }
 
+interface SignTransaction {
+  signTransaction(...inputs: {account: WalletAccount; transaction: Uint8Array; chain?: string}[]): Promise<{signedTransaction: Uint8Array}[]>;
+}
+interface SignAndSend {
+  signAndSendTransaction(...inputs: {account: WalletAccount; transaction: Uint8Array; chain?: string}[]): Promise<{signature: Uint8Array}[]>;
+}
+
+/**
+ * B1c-2: a v0 transfer from the connected account — `lamports` to `to` (default: a fixed test recipient), at the
+ * blockhash the test hands over (the fake coordinator's), the account its fee payer.
+ */
+const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
+function transferTx(from: string, blockhash: string, lamports: number, to = RECIPIENT): VersionedTransaction {
+  const payer = new PublicKey(from);
+  const message = new TransactionMessage({payerKey: payer, recentBlockhash: blockhash, instructions: [SystemProgram.transfer({fromPubkey: payer, toPubkey: new PublicKey(to), lamports})]}).compileToV0Message();
+  return new VersionedTransaction(message);
+}
+
+/** The wallet-adapter dApp's view (spec review-1 M1): the adapter over the same Wallet Standard wallet. */
+let adapter: StandardWalletAdapter | null = null;
+function theAdapter(): StandardWalletAdapter {
+  if (adapter === null) {
+    const w = noctura();
+    if (!isWalletAdapterCompatibleStandardWallet(w)) throw new Error('not adapter-compatible');
+    adapter = new StandardWalletAdapter({wallet: w as WalletAdapterCompatibleStandardWallet});
+  }
+  return adapter;
+}
+/** A mainnet Connection object: the adapter reads its endpoint (the chain); nothing is fetched for a v0 transaction. */
+const CONNECTION = new Connection('https://api.mainnet-beta.solana.com');
+
 const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
 const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), c => c.charCodeAt(0));
 
@@ -70,5 +104,76 @@ const dapp = {
       const [out] = await (w.features['solana:signMessage'] as SignMessage).signMessage({account, message});
       return {signature: b64(out?.signature ?? new Uint8Array()), signedMessage: b64(out?.signedMessage ?? new Uint8Array())};
     }),
+  /** B1c-2: `count` transfers (1 + i lamports each) in ONE signTransaction call; the signed bytes, base64. */
+  signTx: (count: number, blockhash: string): Promise<Result> =>
+    run(async () => {
+      const w = noctura();
+      const account = w.accounts[0];
+      if (account === undefined) throw new Error('not connected');
+      const inputs = Array.from({length: count}, (_, i) => ({account, chain: 'solana:mainnet', transaction: transferTx(account.address, blockhash, 1 + i).serialize()}));
+      const out = await (w.features['solana:signTransaction'] as SignTransaction).signTransaction(...inputs);
+      return out.map(o => b64(o.signedTransaction));
+    }),
+  /** B1c-2: one transfer through signAndSendTransaction; the signature's 64 bytes, base64. */
+  send: (blockhash: string, lamports: number): Promise<Result> =>
+    run(async () => {
+      const w = noctura();
+      const account = w.accounts[0];
+      if (account === undefined) throw new Error('not connected');
+      const [out] = await (w.features['solana:signAndSendTransaction'] as SignAndSend).signAndSendTransaction({account, chain: 'solana:mainnet', transaction: transferTx(account.address, blockhash, lamports).serialize()});
+      return b64(out?.signature ?? new Uint8Array());
+    }),
+  /**
+   * B1c-2: a request posted straight to the relay, as any script on a page can (spec §1.1's stated limit) — past the
+   * provider's own checks; the relay's reply for it (`{result}` or `{error}`).
+   */
+  raw: (type: string, payload: Record<string, unknown>): Promise<unknown> =>
+    new Promise(resolve => {
+      const id = `raw${Math.random().toString(36).slice(2)}`;
+      const on = (e: MessageEvent) => {
+        const d = e.data as {source?: unknown; id?: unknown; error?: unknown; result?: unknown} | null;
+        if (e.source !== window || d === null || typeof d !== 'object' || d.source !== 'noctura-relay' || d.id !== id) return;
+        window.removeEventListener('message', on);
+        resolve('error' in d ? {error: d.error} : {result: d.result});
+      };
+      window.addEventListener('message', on);
+      window.postMessage({source: 'noctura-provider', id, type, payload}, location.origin);
+    }),
+  /** A v0 transfer of 3 lamports from `account`, base64 — for `raw`. */
+  rawTx: (account: string, blockhash: string): string => b64(transferTx(account, blockhash, 3).serialize()),
+  /** B1c-2 through @solana/wallet-adapter: the compatibility predicate, and the adapter's own calls. */
+  adapterCompatible: (): boolean => isWalletAdapterCompatibleStandardWallet(noctura()),
+  adapterConnect: (): Promise<Result> =>
+    run(async () => {
+      const a = theAdapter();
+      await a.connect();
+      return a.publicKey?.toBase58() ?? null;
+    }),
+  adapterSign: (blockhash: string): Promise<Result> =>
+    run(async () => {
+      const a = theAdapter();
+      const from = a.publicKey?.toBase58();
+      if (from === undefined) throw new Error('not connected');
+      // The adapter offers signTransaction only for a wallet that has the feature (it does: B1c-2).
+      if (a.signTransaction === undefined) throw new Error('no signTransaction');
+      const signed = await a.signTransaction(transferTx(from, blockhash, 7));
+      return b64(signed.serialize());
+    }),
+  adapterSignAll: (count: number, blockhash: string): Promise<Result> =>
+    run(async () => {
+      const a = theAdapter();
+      const from = a.publicKey?.toBase58();
+      if (from === undefined) throw new Error('not connected');
+      if (a.signAllTransactions === undefined) throw new Error('no signAllTransactions');
+      const signed = await a.signAllTransactions(Array.from({length: count}, (_, i) => transferTx(from, blockhash, 10 + i)));
+      return signed.map(t => b64(t.serialize()));
+    }),
+  adapterSend: (blockhash: string): Promise<Result> =>
+    run(async () => {
+      const a = theAdapter();
+      const from = a.publicKey?.toBase58();
+      if (from === undefined) throw new Error('not connected');
+      return a.sendTransaction(transferTx(from, blockhash, 9), CONNECTION);
+    }),
 };
 (window as unknown as {dapp: typeof dapp}).dapp = dapp;
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

The spec cannot run before Step 3: its test dApp page bundles the adapter packages Step 3 installs, and calls the background's transaction path built by Tasks 3–8. Its red runs are this task's mutations (Step 5): each one turns the spec red against a build that differs in one check.

- [ ] **Step 3: Implement.**

Run the install command above (npm 11.6.2): it writes `package.json` (the diff below, for review) and `package-lock.json`.

Change `extension/package.json`:

````diff
diff --git a/extension/package.json b/extension/package.json
index 0a6109c..18b7346 100644
--- a/extension/package.json
+++ b/extension/package.json
@@ -31,6 +31,8 @@
   },
   "devDependencies": {
     "@playwright/test": "^1.55.0",
+    "@solana/wallet-adapter-base": "0.9.28",
+    "@solana/wallet-standard-wallet-adapter-base": "1.1.6",
     "@testing-library/dom": "^10.4.2",
     "@testing-library/react": "^16.3.3",
     "@types/node": "^22.7.0",
@@ -38,6 +40,7 @@
     "@types/react-dom": "^18.3.7",
     "@vitejs/plugin-react": "^6.1.1",
     "@wallet-standard/app": "1.1.1",
+    "bs58": "6.0.0",
     "happy-dom": "^20.14.5",
     "typescript": "^5.5.0",
     "vite": "^8.3.0",
````

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  165 passed (165) · Tests  3229 passed (3229). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

Then the new spec and B1c-1's (B1c-19's features line changed), contained: `node scripts/build.mjs && npx playwright test e2e/dappTx.spec.ts e2e/dapp.spec.ts` — expected: 10 passed (B1c-19 … B1c-28).

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M9a | `txRequest.ts`: `MAX_BATCH = 6` (built) | E2E B1c-25 (six open a window) and B1c-27 — RED (E2E: 2 failed) |
| M9b | `wallet.ts`: the account's features without `solana:signAndSendTransaction` (built) — the adapter falls back to signing and sending itself | E2E B1c-27 (no dApp pending record; the dApp's own RPC reached — refused by the containment) — RED (E2E: 1 failed) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "test(extension): B1c-2 E2E B1c-25 … B1c-28 — signTransaction, signAndSendTransaction, StandardWalletAdapter, re-authentication through the toolbar, the mismatch notice" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

### Task 10: The visual pass (§6.4): every #48 state B1c-2 owns, the mismatch notice, the popup's strip, #10 for a site's transaction, #26's and #27's badge

**Spec:** §6.4 (#48), §3.3; design ix:18261-18705, ix:11813, ix:12163

**Files:**
- Test (new): `extension/e2e/visual-dapp-tx.spec.ts`

**Interfaces:**
- Consumes: everything above, built; B1c-1's visual helpers (`shot`; the `pop` pattern), the fake coordinator's `hold()` and `simulateErr`.
- Produces: `e2e/visual-dapp-tx.spec.ts` — 19 shots in `test-results/visual/`.

Each state asserts its own copy before its shot; transient states are held by the test, never slept through (the coordinator's answers held for simulating and unreachable; a `dapp.decide` held for approving); every window state with a sticky bar asserts each of its buttons wholly inside the 412 × 720 viewport (no clipped Cancel or CTA); popup shots go through `pop` (clear of the pinned bars). The mismatch shot also asserts its detail's tones in a real browser — the card's own `.row .v` colour must not win over the session's `--success` and the request's `--danger` (a happy-dom test cannot). B1c-3's states are not shot.

- [ ] **Step 1: Write the failing tests.**

Create `extension/e2e/visual-dapp-tx.spec.ts`:

````ts
import {test, expect, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {contained, launchPopup, seedUnlockedWallet, MAIN, SAVINGS, type Harness} from './popupHarness';
import {DAPP_HOSTS, approvalWindow, connect, openDapp, rawSignTx, sendTx, serveDapp, signTx, type DappServer} from './dappPage';
import {shot} from './visualTab';

// Spec B1c §6.4 (B1c-2): every #48 state B1c-2 builds, the origin-mismatch notice, the popup's re-authentication strip
// (D11), #10 for a site's transaction, and #26/#27's "Dapp · simulated" badge — saved for the opus-tier review against
// index.html (#48 ix:18261-18705, #26b ix:11813, #27b ix:12163). The approval window at 412 × 720, the popup at
// 412 × 600, the vault page at 412 × 916. Every state asserts its own copy before its shot; transient states are held
// by the test (the coordinator's answers held, a dapp.decide held), never slept through. B1c-3's states (red flags,
// the typed-confirm override, unlimited spend) are not B1c-2's and are not shot.
declare const chrome: {storage: {local: {set(o: object): Promise<void>}; session: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}}};

const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);
const fresh = (sw: Worker) => set(sw, {v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: false}});
const grant = (origin: string) => ({origin, account: MAIN.publicKey, scope: 'persistent', connectedAt: Date.now() - 86_400_000, lastUsedAt: Date.now(), recent: []});

/** A window state: its own copy first, then the shot (the pointer off the column; `ready`, a held CTA, awaited enabled). */
async function still(win: Page, name: string, visible: Locator, ready?: Locator): Promise<void> {
  await expect(visible).toBeVisible();
  await win.mouse.move(0, 0);
  await shot(win, name, {fullPage: false, ...(ready === undefined ? {} : {ready})});
}
async function windowFor(h: Harness, ask: () => unknown): Promise<Page> {
  const win = await approvalWindow(h.ctx, ask);
  await win.setViewportSize({width: 412, height: 720});
  return win;
}
/** Answers the window's request with its ✕ (= Reject, C4; the mismatch notice's dismissal) and waits for it to close. */
async function dismiss(win: Page): Promise<void> {
  const closed = win.waitForEvent('close');
  await win.getByRole('button', {name: 'Close'}).click();
  await closed;
}
/**
 * A popup shot clear of the pinned bars (B1c-1's `pop`, visual-dapp.spec.ts): the state's element in the viewport and
 * not under the top bar, the action bar or the tab bar.
 */
async function pop(page: Page, name: string, visible: Locator): Promise<void> {
  const bars = page.locator('main.app-content > .screen > .top-bar, main.app-content > .screen > .sticky-bar, nav.app-tab-bar');
  const under = async (): Promise<string | null> => {
    const box = await visible.boundingBox();
    if (box === null) return 'no box';
    const el = await visible.elementHandle();
    for (const bar of await bars.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  if ((await under()) !== null) await visible.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(visible).toBeInViewport();
  expect(await under(), `${name}: the state's element clear of the pinned bars`).toBeNull();
  await shot(page, name, {fullPage: false});
}
/** No control of the window is clipped at 412 × 720: every button of the sticky bar inside the viewport. */
async function barInView(win: Page): Promise<void> {
  for (const b of await win.locator('.sticky-bar button').all()) await expect(b).toBeInViewport({ratio: 1});
}

async function scene(): Promise<{h: Harness; server: DappServer}> {
  const h = await launchPopup('noctura-e2e-visual-dapptx-', {hosts: DAPP_HOSTS});
  const server = await serveDapp(h.ctx);
  await seedUnlockedWallet(h.sw);
  await set(h.sw, {v1_dapp_grants: [grant('https://jup.ag'), grant('https://dapp.test'), grant('https://tensr.trade')], v1_known_recipients: [{address: RECIPIENT, at: Date.now()}]});
  // A decision held open (the approving state): approve.html's dapp.decide waits while window.__holdDecide is set.
  await h.ctx.addInitScript(() => {
    if (location.pathname !== '/approve.html') return;
    const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
    const send = rt.sendMessage.bind(rt);
    const w = window as unknown as {__holdDecide?: boolean};
    rt.sendMessage = (m: unknown) => ((m as {type?: string}).type === 'dapp.decide' && w.__holdDecide === true ? new Promise(() => undefined) : send(m));
  });
  return {h, server};
}
/** A granted page, its provider holding the account (a silent connect). */
async function granted(h: Harness, origin: string): Promise<Page> {
  const page = await openDapp(h.ctx, origin);
  await expect.poll(() => connect(page, true)).toEqual({ok: true, value: [MAIN.publicKey]});
  return page;
}

test('visual · #48: simulating, simulated, a batch, re-authentication, approving, couldn’t simulate, unreachable, expired (Q21), lookalike, the request that can no longer be signed; the mismatch notice', async () => {
  test.setTimeout(420_000);
  const {h, server} = await scene();
  try {
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    const jup = await granted(h, 'https://jup.ag');

    // simulating-blocking: the coordinator's answers held — the banner, the skeleton, "Approve · simulating".
    await fresh(h.sw);
    let release = h.fake.hold();
    let win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await expect(win.getByRole('button', {name: /Approve/})).toHaveText('Approve· simulating');
    await expect(win.getByRole('button', {name: /Approve/})).toBeDisabled();
    await still(win, '48-simulating', win.getByText('Simulating transaction…'));
    release();
    // simulated: the changes, the decoded instructions, the fee, the origin pill.
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await barInView(win);
    await still(win, '48-simulated', win.getByText('Request from jup.ag · matches active session'), win.getByRole('button', {name: 'Approve', exact: true}));
    await win.locator('.s9-origin-pill').evaluate(e => e.scrollIntoView({block: 'end'}));
    await still(win, '48-simulated-instructions', win.getByText('Network fee'));
    // approving: the decision held.
    await win.evaluate(() => void ((window as unknown as {__holdDecide: boolean}).__holdDecide = true));
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    await expect(win.getByRole('button', {name: 'Approving…'})).toBeDisabled();
    await still(win, '48-approving', win.locator('.top-bar .title', {hasText: 'Approving'}));
    await win.close();

    // A batch of three.
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 3, BLOCKHASH));
    await expect(win.getByText('Transaction 3 of 3')).toBeAttached({timeout: 10_000});
    await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 10_000});
    await barInView(win);
    await still(win, '48-batch', win.getByText('Transaction 1 of 3'), win.getByRole('button', {name: 'Approve', exact: true}));
    await dismiss(win);

    // Re-authentication: an unknown recipient (a first send) — the line, then the toolbar instruction.
    await set(h.sw, {v1_known_recipients: []});
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    const line = win.getByText("Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon.");
    await expect(line).toBeVisible({timeout: 10_000});
    await expect(line).toBeInViewport();
    await still(win, '48-reauth-needed', line, win.getByRole('button', {name: 'Approve', exact: true}));
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const waiting = win.getByText("Confirm it's you");
    await expect(waiting).toBeVisible();
    await expect(win.locator('.s9-flag-banner.warn')).toBeInViewport({ratio: 1});
    await still(win, '48-reauth-waiting', waiting);
    // The popup's strip (D11: the password is typed only after clicking the Noctura icon), and #10 for it.
    const toolbar = await h.openPopup();
    const strip = toolbar.getByRole('button', {name: 'A transaction from jup.ag waits for your confirmation'});
    await expect(toolbar.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await pop(toolbar, '11-dapp-reauth-strip', strip);
    const [tab] = await Promise.all([h.ctx.waitForEvent('page'), strip.click()]);
    await tab.setViewportSize({width: 412, height: 916});
    await expect(tab.locator('#ra-about')).toHaveText('You are about to approve');
    await expect(tab.locator('#ra-rows')).toContainText('jup.ag');
    await shot(tab, '10-dapp', {fullPage: false});
    await tab.close();
    await dismiss(win);
    await set(h.sw, {v1_known_recipients: [{address: RECIPIENT, at: Date.now()}]});

    // couldn't simulate; an expired blockhash (Q21).
    h.fake.simulateError = true;
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await expect(win.getByText("Couldn't simulate")).toBeVisible({timeout: 10_000});
    await barInView(win);
    await still(win, '48-couldnt-simulate', win.getByText('{"InstructionError":[2,{"Custom":1}]}'));
    await dismiss(win);
    h.fake.simulateErr = 'BlockhashNotFound';
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await still(win, '48-expired', win.getByText('This request has expired. Ask the site to try again.'));
    await dismiss(win);
    h.fake.simulateError = false;

    // The proxy unreachable while the window simulates.
    await fresh(h.sw);
    release = h.fake.hold();
    win = await windowFor(h, () => signTx(jup, 1, BLOCKHASH));
    await expect(win.getByText('Simulating transaction…')).toBeVisible();
    h.fake.network = 'unreachable';
    release();
    await still(win, '48-unreachable', win.getByText('Could not reach the Noctura server.'));
    h.fake.network = 'ok';
    await dismiss(win);

    // A lookalike origin (granted through "Connect anyway"): the banner, the flipped bar, the confirm.
    const tensr = await granted(h, 'https://tensr.trade');
    await fresh(h.sw);
    win = await windowFor(h, () => signTx(tensr, 1, BLOCKHASH));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await barInView(win);
    await still(win, '48-lookalike', win.getByText('It looks like tensor.trade but is a different site.'), win.getByRole('button', {name: 'Approve anyway (not recommended)'}));
    await win.getByRole('button', {name: 'Approve anyway (not recommended)'}).click();
    await still(win, '48-lookalike-confirm', win.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    await win.getByRole('button', {name: 'Cancel'}).click();
    await dismiss(win);

    // The request that can no longer be signed (Q26): the granted account leaves the unlocked session.
    await fresh(h.sw);
    win = await windowFor(h, () => sendTx(jup, BLOCKHASH, 5));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await h.sw.evaluate(s => chrome.storage.session.set({v1_session: {accounts: [s]}}), {index: SAVINGS.index, publicKey: SAVINGS.publicKey, secretKey: SAVINGS.secretKey});
    await still(win, '48-cannot-sign', win.getByText('This request can no longer be signed. Reject it and ask the site to try again.'));
    await dismiss(win);
    await seedUnlockedWallet(h.sw);

    // The origin-mismatch notice: a page with no grant names MAIN (granted to jup.ag and others).
    await set(h.sw, {v1_dapp_grants: [grant('https://jup.ag')]});
    const stranger = await openDapp(h.ctx, 'https://dapp.test');
    await fresh(h.sw);
    win = await windowFor(h, () => rawSignTx(stranger, MAIN.publicKey, BLOCKHASH));
    await barInView(win);
    // The detail's tones in a real browser (the card's own `.v` colour must not win): the session green, the request red.
    const tone = (i: number) => win.locator('.s9-payload-card .row .v').nth(i).evaluate(e => getComputedStyle(e).color);
    // The design-system's own tones, read from a probe element of each class (positive references).
    const reference = (cls: string) =>
      win.evaluate(c => {
        const probe = document.createElement('span');
        probe.className = c;
        document.body.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, cls);
    const [success, danger] = [await reference('noc-success'), await reference('noc-danger')];
    expect(success).not.toBe(danger);
    expect([await tone(0), await tone(1), await tone(2), await tone(3)]).toEqual([success, danger, danger, danger]);
    await still(win, '48-origin-mismatch', win.getByText('Request blocked automatically'), win.getByRole('button', {name: 'OK, return to dApp'}));
    await win.locator('.app-tx-caption').evaluate(e => e.scrollIntoView({block: 'end'}));
    await still(win, '48-origin-mismatch-detail', win.getByText('REJECT_NO_PROMPT'));
    await dismiss(win);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});

test('visual · #26 and #27: a site’s transaction badged "Dapp · simulated"', async () => {
  test.setTimeout(240_000);
  const {h, server} = await scene();
  try {
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    const jup = await granted(h, 'https://jup.ag');
    await fresh(h.sw);
    let sent!: Promise<unknown>;
    const win = await windowFor(h, () => (sent = sendTx(jup, BLOCKHASH, 2_000_000)));
    await expect(win.getByText('Balance changes (post-simulation)')).toBeVisible({timeout: 10_000});
    await win.getByRole('button', {name: 'Approve', exact: true}).click();
    const r = (await sent) as {ok: true; value: string};
    const signature = h.fake.broadcasts[0] ?? '';
    expect(r.ok).toBe(true);
    const now = Math.floor(Date.now() / 1000);
    h.fake.history.set(MAIN.publicKey, [
      {signature, tx: {blockTime: now, meta: {err: null, fee: 5000, preBalances: [10_000_000_000, 0, 1], postBalances: [9_997_995_000, 2_000_000, 1], preTokenBalances: [], postTokenBalances: []}, transaction: {message: {accountKeys: [{pubkey: MAIN.publicKey, signer: true, writable: true}, {pubkey: RECIPIENT, signer: false, writable: true}, {pubkey: '11111111111111111111111111111111', signer: false, writable: false}], instructions: [{programId: '11111111111111111111111111111111', parsed: {type: 'transfer', info: {source: MAIN.publicKey, destination: RECIPIENT, lamports: 2_000_000}}, program: 'system'}]}}}},
    ]);
    await p.getByRole('button', {name: 'Activity'}).click();
    const row = p.locator('.tx-row', {has: p.locator('.origin-badge')});
    await expect(row.locator('.origin-badge')).toHaveText('Dapp · simulated');
    await pop(p, '26-dapp-badge', row);
    await row.click();
    await expect(p.locator('.top-bar .title .origin-badge')).toHaveText('Dapp · simulated');
    await shot(p, '27-dapp-badge', {fullPage: false});
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});
````

- [ ] **Step 2: Run them on the previous task's tree — red.**

The pass shoots states Tasks 7–8 built; its red run is this task's mutation (Step 5) — the tone assertion against a build without the rule it checks.

- [ ] **Step 3: Implement.**

Nothing to implement: the spec shoots what Tasks 7 and 8 built (Step 1 is the whole task).

- [ ] **Step 4: Run — green, and the whole suite, the build and the gates.**

Run: `npx tsc --noEmit; echo $?` — expected `0`. `npx vitest run` — expected: Test Files  165 passed (165) · Tests  3229 passed (3229). `node scripts/build.mjs && npm run gates` — expected: every gate ok.

Then: `npx playwright test e2e/visual-dapp-tx.spec.ts` — expected: 2 passed; the shots in `test-results/visual/` (48-*, 11-dapp-reauth-strip, 10-dapp, 26-dapp-badge, 27-dapp-badge).

- [ ] **Step 5: The named mutations — each alone, in a fresh `git archive` copy; `tsc`'s own exit code first (0), then the named test: red.**

| id | the change | red |
|---|---|---|
| M10a | `app.css`: the mismatch detail's tone rules removed (built) | visual-dapp-tx.spec.ts (the tones in Chromium) — RED (E2E: 1 failed) |

The counts in the last column are the dry run's, each mutant built from the END state (Task 10's tree): on this task's own tree a test file can hold fewer tests (a later task adds some), so the counts differ — red is the check, not the count (review 1 L11).

- [ ] **Step 6: Commit.**

```bash
git add -A
git commit -m "test(extension): B1c-2 the visual pass — #48's states, the mismatch notice, the toolbar strip, #10 for a site's transaction, the badge" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

## Dry-run record (each finding fixed in the code above; revision 2 re-ran all of it)

The end state was built task by task in a scratch git repository outside the checkout (a `git archive` of `main` at 269f0aa), one commit per task; the plan's code blocks are generated from those commits (new files in full, changes as the commit's own diff), so applying them in order to `main` reproduces the end state byte for byte. Every fix the dry run found was folded back into the task that owns its file (and every later task carries it). Then:

- **Per-task replay** (each task's tree from `git archive`, `extension/node_modules` copied): each task's own test files on its predecessor's tree, then on its own tree, with `tsc`, the whole suite, `node scripts/build.mjs` and `npm run gates` at every task. Red for every task 1–8 (Tasks 9–10 add E2E specs over built behaviour, made failable by their mutations); `tsc` 0, own tests green, whole suite green, the build and every gate green at every task. The starting tree: Test Files  156 passed (156) · Tests  3110 passed (3110). The end state: Test Files  165 passed (165) · Tests  3229 passed (3229).

| task | own tests on the previous tree | own tests | whole suite |
|---|---|---|---|
| 1 | red: Test Files  3 failed (3) · Tests  no tests | Test Files  3 passed (3) · Tests  24 passed (24) | Test Files  159 passed (159) · Tests  3134 passed (3134) |
| 2 | red: Test Files  3 failed (3) · Tests  7 failed \| 41 passed (48) | Test Files  3 passed (3) · Tests  60 passed (60) | Test Files  160 passed (160) · Tests  3153 passed (3153) |
| 3 | red: Test Files  4 failed (4) · Tests  20 failed \| 31 passed (51) | Test Files  4 passed (4) · Tests  51 passed (51) | Test Files  161 passed (161) · Tests  3168 passed (3168) |
| 4 | red: Test Files  3 failed (3) · Tests  4 failed \| 48 passed (52) | Test Files  3 passed (3) · Tests  70 passed (70) | Test Files  162 passed (162) · Tests  3186 passed (3186) |
| 5 | red: Test Files  3 failed (3) · Tests  3 failed \| 11 passed (14) | Test Files  3 passed (3) · Tests  61 passed (61) | Test Files  163 passed (163) · Tests  3203 passed (3203) |
| 6 | red: Test Files  5 failed \| 1 passed (6) · Tests  9 failed \| 168 passed (177) | Test Files  6 passed (6) · Tests  177 passed (177) | Test Files  163 passed (163) · Tests  3211 passed (3211) |
| 7 | red: Test Files  3 failed (3) · Tests  14 failed \| 3 passed (17) | Test Files  3 passed (3) · Tests  19 passed (19) | Test Files  165 passed (165) · Tests  3226 passed (3226) |
| 8 | red: Test Files  3 failed (3) · Tests  3 failed \| 108 passed (111) | Test Files  3 passed (3) · Tests  111 passed (111) | Test Files  165 passed (165) · Tests  3229 passed (3229) |
| 9 | — (E2E: red under its mutations) | — | Test Files  165 passed (165) · Tests  3229 passed (3229) |
| 10 | — (E2E: red under its mutations) | — | Test Files  165 passed (165) · Tests  3229 passed (3229) |

- **Extension `npm run verify`** on the end state (build, vitest, CSP, secrets, every gate, reproducible): green — 165 files, 3229 tests; chrome 25 files `sha256:880fc6ae…eb6d2bdc`, firefox 25 files `sha256:fc95d106…2b570509`.
- **E2E, contained, normal launch (the whole suite):** 64 passed (17.4m). **Under `unshare -rn`:** 64 passed (17.2m) — the same specs with no network namespace route out.
- **Root and web:** web's `npm run verify` (its vitest runs core/'s tests — Task 2 changed `core/solana/rpc.ts`): Tests  550 passed (550) and Tests  3 passed (3) — green; the root `npx tsc --noEmit` clean; the root `npx jest`: Tests:       1 skipped, 1234 passed, 1235 total; the repository's TGE-date gate (`node scripts/check-no-tge-date.mjs`): no TGE date in 1215 tracked text files. Not done in the dry run: the CI reproduction on Node 22.12 with only `web/` and `extension/` installed — it stays in "Before the PR".
- **Mutations:** every named mutation above was run alone in a fresh `git archive` copy of the end state (`node_modules` linked), `tsc`'s own exit code first, unit mutations under `timeout 300`, the E2E ones (M9a, M9b, M10a) with the build: **78 of 78 red**.

What the dry run caught:

1. **B1c-1's lock tests broke when every approval took a pre-section (Task 4).** A transaction approval reads and checks in a section, runs the re-authentication gate outside, then writes `deciding` in a second section; the first form ran that pre-section for every approval, and B1c-1's tests that lock "right after the deciding section" (by making the auto-lock arm a lock) now locked one section early — each queue access arms the queue's own expiry alarm too. A routing peek (a read, no section) now sends only a transaction request through the pre-section: a connect and a `signMessage` take exactly B1c-1's one section. B1c-2's own lock tests lock on the auto-lock alarm only.
2. **The window learns a simulation on its next poll (Task 7).** The first window tests waited on the screen with a one-second budget — exactly the poll interval. They now wait on the background's own state (the simulation stored), then give the window the read it would make on its next poll (a focus or a `visibilitychange`) — never the wall clock (the Global Constraints' rule).
3. **The re-authentication rules fired where the fixtures did not expect them (Tasks 2, 7) — the rules were right.** 0.5 SOL of a 10 SOL balance with its fee is over 5 %; an approval's source account missing from a fixture's post-state read as closed. The fixtures changed, not the rules.
4. **The mismatch detail's tones (Task 7):** the card's own `.s9-payload-card .row .v` colour (three classes) outranked `.noc-success` / `.noc-danger` (one class) — the session and the request both drew in the primary text colour. `app.css` restores the design's tones; the visual pass asserts them in Chromium against probe elements of each class (M10a red; the first form of that assertion — "three distinct colours" — stayed green under M10a and was replaced).
5. **The re-authentication banner was clipped under the sticky bar at 720 px (Task 7):** it sat after the cards. It now sits under the origin card (the one thing the user must do before Approve, seen without scrolling); the visual pass asserts it wholly in view.
6. **"Approve · simulating" wrapped inside the button (Task 7):** `white-space: nowrap` on the tag.
7. **A Playwright `has:` locator rooted at `.tx-row` matched nothing inside a row (Task 10)** — the visual spec waited forever; the inner locator is relative now.
8. **The provider refuses an account it was not given (Task 9)**, so the mismatch notice is reached the way a hostile script reaches it — a message posted straight to the relay (the test dApp's `raw`).
9. **The test dApp page needs `process.env.NODE_ENV` (Task 9):** `@solana/errors` (through the adapter) reads it; the page build defines it.
10. **`StandardWalletAdapter` is in `@solana/wallet-standard-wallet-adapter-base`** (R25), not in `@solana/wallet-adapter-base` as §3.3's wording has it.
11. **History paces `getTransaction` with `deps.sleep`, which never resolves in `fakeDeps` (Task 5):** the history-marking test resolves it.
12. **The effect was chosen by elimination (Task 4):** `connect ? … : signTransaction ? … : finishSign` let any other type fall into `signMessage`'s effect; a notice could not reach it (refused earlier), but nothing said so. Each effect is now chosen by name (`effects[out.approved]`).
13. **Not caused by this plan:** B1c-1's `connect.test.tsx` "the 2-second confirm opens with no control focused, and 'I understand the risk' is held again after the window regains focus" failed ONCE under full-suite load on the Task 4 tree (a real 2 s timer and an assertion right after it), and passed in every other run — four whole-suite runs and every replay. A timing flake in a security UI is a finding: recorded for the controller (Before the PR), not touched here.
14. **Four mutations stayed green on their first form, one hid a containment hole:** M4e ("not consumed") still called the consume — rewritten to skip it; M4h ("the effect section checks only the lock") — the test removed the account at the effect's first read, so the key was already missing and the signature was never made: the test now removes it right after the key read (the third read of the session while deciding, stated in the test), and the answering section's own re-check is what drops the signatures; M10a, item 4; **M9b**: with the account's `signAndSendTransaction` feature removed, B1c-27 still passed — `expect(broadcasts).toEqual([rs.value])` holds for an empty list and an undefined value, and the adapter's fallback (sign, then send through the dApp's own `Connection`) reached the real `api.mainnet-beta.solana.com`. B1c-27 now asserts the answer is `ok`, compares strictly, and checks the dApp's pending record; the dApp's RPC host is contained like every other host (unresolvable, its route records any request as unexpected).
15. **Thirteen mutations did not compile on their first form** (`noUnusedLocals`, a narrowing lost to `&& false`, an incomparable literal) — `tsc`'s own exit code refused them before any test ran; each now neutralises its check in place so the mutant compiles and the test is what turns red.
16. **`npm audit`:** 6 moderate (main: 4) — R25.

**Revision 2's dry run** (every changed task replayed; all 78 mutations again — the unit ones on the end state, the E2E ones built; the end state's `verify` and the E2E twice) caught:

17. **Review 1's M1, taken literally, would trade a silent loss for a double approval.** A `broadcastAttemptedAt` that the poller sends whenever it is null also sends the record of a worker stopped between `recordDappSend` and the entry's `sent` — whose page the restart answers `rejected`. The record now says whether a page was promised its signature (`held` → `due`), written before the promise is stored, and only a `due` one is ever sent by the poller (R13; mutations M5k–M5o, M5q).
18. **A window-test flake, found by running the whole suite again and again under load, and its cause.** Four of 27 whole-suite runs had one failing test (the replay's Task 7 and Task 10 trees among them); the two whose names were captured failed `expected 2 to be 1` on `w.closed.n` — this plan's `tx.test.tsx` "re-authentication …" and B1c-1's `sign.test.tsx` "idle · verified …". The harness's `close()` only counted; the window stayed mounted, so its next 1 s poll read `none` again and counted a second close before `waitFor` saw the first. A real window is gone after `close()`: the harness's client now refuses every read once the window has closed, and the first #48 test checks deterministically that a later focus counts no second close (M7j: with the old harness that check is red). After the fix, 10 more whole-suite runs on the end state, one after another with nothing else running: every one green — weaker evidence than the load the failures needed, which is why the deterministic check (M7j) carries the fix, not these runs. B1c-1's `connect.test.tsx` flake (item 13) asserts the same `closed.n` with its own timeout and is plausibly the same race; it was not seen again.
19. **The replay's "own tests" pattern looked only under `src/`** — the generators' tests (`scripts/__tests__/*.test.mjs`, new in Tasks 1 and 7) were run in the whole suite but not red-checked on the predecessor's tree. Tasks 1 and 7–10 were replayed again after item 18's fix, with them (the rows above for those tasks are that run): red where the script does not yet exist.
20. **The stopped-worker scenes need a signed wire:** `recordDappSend` takes its id from the wire's first signature and an unsigned wire is refused there — the tests sign it with `signAll` at the account's slot, as the effect does.
21. **`markDue` lives in `pendingStore.ts`**, not `pending.ts`: the queue (`queue.ts`) and the lock hook take only the store's write, never the poller's network path.
22. **Two mutations were re-formed before they ran:** M3i (L8 rewrote its line) and M7g (a first form comparing a narrowed object with `null` would not compile). M4e was rewritten because the consume moved (L1). Every mutant compiled; 78 of 78 red (M7a–M7j re-run on the tree with item 18's fix).
23. **The first normal-launch E2E run of revision 2 had two failures under the load of concurrent vitest loops** (item 18's hunt): B1c-19 while Playwright wrote its trace zip ("file data stream has unexpected number of bytes") and B1c-25 at its 4-minute timeout. The `unshare -rn` run right after was 64 / 64; the normal launch was then run again on a quiet machine — the figure above is that run.

## Before the PR (the standing rules)

- [ ] Reproduce CI with **only** `web/` and `extension/` installed, on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`), npm 11.6.2: `npm ci --ignore-scripts` in both, `npm run verify` in both, `npm run e2e` in `extension/` — in a normal launch and under `unshare -rn`.
- [ ] Task 2 touches `core/solana/rpc.ts`: run web's `npm run verify` (its vitest runs core/'s tests) and the root `npx tsc --noEmit` and `npx jest`.
- [ ] `node scripts/check-no-tge-date.mjs` from the repository root — this plan and every file it adds are clean.
- [ ] The opus-tier visual review of Task 10's shots against index.html (#48 ix:18261-18705 with its DS class map, #26b ix:11813, #27b ix:12163), then an independent opus review of that review; each finding fixed or declared in the spec's §9; the result in the PR description.
- [ ] The owner's decisions of 2026-10-15 are in (M3 `send-failed`, M4 dependent batches, the copy — R2, R9, R10, R18, R22 accepted, L3/L4/L7 owner-delegated) and the Fable 5.1 review 1 is applied (this revision); still open for the owner: R28's "and <n> more tokens" (copy) and the candidate §9 row of R10 (every SPL transfer to a token account that is not the account's own re-authenticates).
- [ ] The controller has looked at the dry run's one unexplained failure (item 13 below: B1c-1's `connect.test.tsx` C15 test, once, under full-suite load) — a timing flake in a security UI is a finding.
- [ ] The PR says loudly: B1c-2 is a merge-to-`main` milestone, not a release (D10); it signs with **no red-flag block** — no store build carries B1c until B1c-3 is merged; **a dependent batch (create an account, then use it; a swap's setup / swap / cleanup) cannot be approved in B1c-2, and B1c-3 must solve it** (owner, M4); "No SOL or token balance changes — review the instructions below." is shown even beside an `assign` / `setAuthority` / `approve*` / `closeAccount` until B1c-3 replaces it (L3); the `<all_urls>` update consequences are B1e gates (§6.5); `npm audit` 6 moderate, none high (R25).

## Self-review

- **Spec coverage.** §1.3 (B1c-2's modules: `decode/`, `simulate.ts`, `signTx.ts`); §1.4 (both transaction messages, their payloads and answers — Tasks 3–5); §1.5 step 2 (`deciding` before every effect; the send's restart rule, the bytes reaching the route exactly once — Tasks 4, 5); §1.6 (`invalid-request` for a batch over five and a wrong chain; `send-failed`, rev 3.3 — R14); §2.3 (the table extended — Task 4); §3.3 bullet by bullet: 1–5 and fee payer or signer (Task 3), lookup tables through `getMultipleAccounts` and "unknown program" (Tasks 1, 2), the decoder's whole list (Task 1), the simulation with post − pre per mint in `bigint` and "simulating" holding Approve with no minimum (Tasks 2, 4, 7), the 30 s refresh and Q21 (Tasks 2, 4, 7), #48's states (Task 7; the deferred ones listed in Scope §3), B1b's re-authentication rules through #10 (Tasks 2, 4, 6 — R9), sign-and-send through the existing route, answered once, a second identical request rejected, the history badge (Tasks 3, 5, 8), StandardWalletAdapter (Task 9); §4.3 (the window's `{deciding}` state as "Approving…"); §5 ("the worker dies mid-signature": Task 5); §6.1 (every behaviour with its named mutation); §6.3 B1c-2 (Task 9); §6.4 #48 (Task 10); §7 (simulation has one source, stated in `simulate.ts`; the mismatch notice's limit, rev 3.3); §9 (#48 rows: no artificial minimum, approving · shielded is B2; rev 3.3's dependent batches and the transactions' malformed-first order); §10 (Q21, Q26).
- **Rule 6 and C15.** Approve and its demoted form are `ConfirmButton`s (held 500 ms, Enter prevented) keyed on the request, the simulation's id, the re-authentication's state, busy and the confirm; Reject, Reject and report, [OK, return to dApp] and the popup's strip are `LockedButton`s.
- **Generation checks.** The window's poll is B1c-1's; Home's `dapp.reauth` read checks `alive` and its generation; every effect section re-checks its entry (`stillDeciding`); a simulation result is stored only on a still-queued entry.
- **Placeholders.** None: every step has its code (new files in full, changes as exact diffs, the two generated files with their scripts and pinned hashes), its command and the dry run's expected output.
- **Type consistency.** The Interfaces blocks are the exports as they compile; the replay compiled and tested every task on its own predecessor.
- **Copy.** Every visible string is the spec's (Q21, Q26), the design's (#48, #26b, #27b), B1 §3's or B1b's, or a ruling the owner decided or delegated on 2026-10-15 (R2, R9, R10, R18, R22 accepted; L3, L4, L7 worded as decided), except R28's "and <n> more tokens", flagged for the owner.
- **Review 1.** Every finding (M1–M4, L1–L11) has its row in "Review 1 (Fable 5.1) — how each finding was applied", with the test or the text that carries it.

## Execution handoff

Plan complete. Execute with superpowers:subagent-driven-development (a fresh implementer per task, the two-stage review between tasks; Tasks 3–5 — the page side, the decision with its simulation rows and its re-authentication gate, and the send's recorded effect — reviewed as the security core; Task 10's shots reviewed by an opus-tier reviewer), or superpowers:executing-plans in one session with checkpoints. Every plan goes to a Fable 5.1 review before execution (owner rule).

## The controller's rulings, for the owner (Scope §3)

R1 the presale IDL lives in the ICO repository (generated table, pinned; the generator committed — M2) · R2 decoded rows; `unknown instruction` **(copy — accepted, owner-delegated)** · R3 addresses whole with labels · R4 the simulated accounts · R5 the SOL change as the node reports it, the fee row only for the payer · R6 a batch simulated one by one; **dependent batches unapprovable in B1c-2 (owner, M4)** · R7 the simulation shown is the one approved (40 s) · R8 failures: only Reject until B1c-3 · R9 re-authentication through the toolbar, never from the window **(copy — accepted, owner-delegated)** · R10 B1b's rules for a transaction, `approval` **(copy — accepted, owner-delegated; a candidate §9 row for the owner)** · R11 the challenge's binding; consumed after `deciding` (L1) · R12 sign-and-send: fully co-signed, no durable nonce · R13 the dApp's pending record; the first broadcast exactly once (M1) · R14 a refused broadcast is `send-failed` **(owner, M3; spec rev 3.3)** · R15 a lock after the record still broadcasts · R16 origin mismatch: what and when · R17 the mismatch screen's two departures · R18 a lookalike's #48 **(copy — accepted, owner-delegated)** · R19 the origin pill · R20 ✕ while simulating · R21 Q26 on #48 · R22 the new strings **(copy — accepted, owner-delegated; L3, L4, L7 as decided)** · R23 the badge's list; no "Wallet" pill; no #27b Simulation row · R24 the provider's batching · R25 the E2E packages (StandardWalletAdapter's real package), `npm audit` 6 moderate, none high · R26 the window's 1 s poll · R27 Firefox · R28 #10 lists 16 mints and counts the rest **(copy — the controller's, owner to confirm)** · R29 a send's dead-effect TTL 45 s · R30 the `stale` line · R31 who sends · R32 the provider's input check.

