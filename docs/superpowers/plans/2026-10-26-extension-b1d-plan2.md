# Noctura Extension B1d · Plan 2 — referral and recording (the coordinator record with background retry, the referrer in prepare and sign, #23a's referral address and #20's "Referred by", #24 and #31's "Refer a friend", #26's "Presale" badge and #27's Q34, gates and E2E 10–12, the visual pass and spec rev 3.4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 1 (2026-10-26):** first issue, dry-run in full — every task implemented for real on a scratch clone of `main` a1bda47 (B1d-1b and the D27 copy calls merged), one commit per task (a532235, 14cb89b, 6c3ea11, 3efa30d, ceb648b, 2c6c023, ac27c49), each red on its predecessor and green on its own tree with `tsc` (its own exit code), both vitest runs, both builds and every gate; Task 1 also root `tsc` + `jest` and web `verify` (it changes `core/`). **181 named mutations**, every one compiling and red (Task 1 51, Task 2 30, Task 3 34, Task 4 29, Task 5 15, Task 6 12, Task 7 10). Playwright, each in a normal launch and under `unshare -rn`: the whole suite 96 at Task 1 (its first issue) and its three presale specs (12) on the final Task 1; the presale / vault specs at Tasks 2 (25), 3 (24), 4 (21) and 5 (41); the whole suite **101 at Task 6 and 105 at Task 7**; extension `npm run verify` exit 0 at Task 7. The Review Focus row added to Task 1 (`reconcileWindow.test.ts`, a test file only, with N8–N9) rebuilt the chain on `dry/b1d2-rf` as 65846e2, 1256554, 49cc8f0, f8db19e, 3a04191, 5b42436, 5c3bf42 — each tree identical to its first commit but for that one file; `tsc` 0 and the whole on-build vitest run green at every one of them, with the totals each task states (the off run at Tasks 1 and 7, unchanged; at Task 3 one run under heavy parallel load failed one row of `referral.test.tsx` and the quiet re-run was green — Task 3's notes). Replaying task-1 … task-7's blocks from this file onto `git archive a1bda47` reproduces each rebuilt commit at every prefix. Next: a Fable 5.1 review (owner rule), then the owner.

**Goal:** Build B1d spec plan 2 (the header table's third row): referral and recording. The coordinator record of every confirmed purchase (`record.ts`, `v1_presale_records`: D28's whole payload, C24's slots from `confirmedAt`, one POST in flight, `done` on `200 {success: true}` (D30), `refused` on the route's own 400 (D29), a 403 waiting out the shared latch, the `presale-record` alarm, a reconcile at every wake, `presale.unrecorded`); the optional referral address (D8, §3.5) — `presale.checkReferrer`, `intent.referrer` in prepare, the `register_referrer` instruction and account 3 built, simulated (`referrer@84` after) and re-verified from the signed bytes, a registration always behind a proof; #23a's field and #20 / #10's "Referred by" with Q47; #24 and #31's "Refer a friend" (`presale.referral`: the link, EARNED from chain, REFERRALS and REFERRED from `/referral-stats`); #26's "Presale" badge and #27's Q34; the gates completed by construction; E2E 10–12; the visual pass; spec rev 3.4. With B1d-2 on `main`, a build with presale on may leave the repository (C26) — the store decision stays B1e's (D2).

**Architecture:** Spec §1's layers, on B1d-1a's and B1d-1b's foundations. The background alone decides (C13): the popup asks `presale.checkReferrer` / `presale.prepareBuy` / `presale.referral` / `presale.unrecorded` and renders the answers. The record hangs off the `presale-buy` intent kind's new `onConfirmed` hook, which the shared poller calls once per record it moves to `confirmed`; the retry runs in the background on its own alarm, over a store whose key and lock are shared code so a delete wipes it in either build. The referrer travels inside the integrity-bound intent; prepare, the simulation and `beforeSign` each decide it again from fresh reads and from the bytes, never from `shown`. `createJsonPoster` / `getJson` are generic and on the one shared latch. Every new on-build module and string is held out of the build without presale by `check-no-presale.mjs`, whose lists are now complete by construction.

**Tech Stack:** TypeScript 5 strict, React 18, Vite 8.3.5, Vitest 5 + happy-dom 21, Playwright 1.63 (contained), `@solana/web3.js` 1.99. No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md` **rev 3.4** (rev 3.3 + every departure of this plan in one change list, and owner decisions D28–D30 written into §2.4 — written by Task 7 Step 3b and committed with this plan). Parent: B1 §4. Owner decisions: `.superpowers/sdd/b1d-owner-decisions.md` (D1–D30). Foundations: `docs/superpowers/plans/2026-10-24-extension-b1d-plan1b.md` (merged, PR #114) and the D27 copy calls (PR #115). ICO facts: coordinator main 9e7d468 (`POST /api/v1/solana/purchase`, `GET /api/v1/referral-stats/:address`; P2a deployed, owner 2026-10-23). Design (binding, contains the TGE date — never copy it): `/home/user/Downloads/index.html` (#24 ix 10903-11233, #23 ix 10603-10902, #20, #26, #27, #31).

## Global Constraints

Every task's requirements include these. B1d-1b's, verbatim (its task numbers are B1d-1b's), then B1d-2's own.

- Mutations only in a scratch copy outside the repo.
- Every task touching repo-root src/ runs the FULL root jest; core/ tests run under extension's and web's vitest. (rev 2, review 1 L4: this plan's Task 2 changes `core/` — the stablecoin builder's paying account, `getAccountsDataAt` — the root `src/modules/presale/presaleBuyModule.ts` and `web/src/presale/useBuy.ts`, so Task 2 runs the root `tsc` + `jest` and web's `npm run verify`; no other task touches `core/`, the root `src/` or `web/`, and the dry run ran all three again on the end state.)
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


And, for plan 3:

- **The background decides every flag** (C13): the window renders `TxDetail.flags` and sends the typed words; the background recomputes the expected words from the simulation IT stored and refuses `override-missing` / `override-mismatch` before the re-authentication gate. A block never opens without the proof: a block ⇔ the reason `override`, enforced both ways when a simulation is read back and when a challenge is issued.
- **Fail closed means "warn or block", never "silent":** a mint that cannot be read or parsed is Q36's warning; a source whose balance cannot be read approving anything is F5's block; a destination that cannot be resolved to an owner is a first send; a stored flag that does not validate makes the stored simulation invalid (simulated again); a detail the window cannot read is Q26 (only Reject).
- **The typed word is never a symbol the token claims:** F5's word is the wallet's own table's symbol (`WALLET_TOKENS`) only when the mint's decimals as read match the table's; otherwise `UNLIMITED`. Exact, case-sensitive, no trimming; the input is never auto-capitalised, autocorrected or autofocused; Enter in it never submits.
- **Holds:** a flagged screen holds every confirming CTA (Approve, "Approve unlimited", "Approve anyway", the risk sheet's "I understand the risk") 1.5 s (`FLAG_HOLD_MS`) on every C15 trigger — the window's focus, the request, a new simulation, the re-authentication state, busy, the confirm and every typed field's match state; Reject is never held.
- **Addresses in a banner are whole, in groups of four** — never the design's `JUP6L…vRet9` shortening (the September 2026 poisoning address matches the Squads vault on exactly those ends).
- **The vault page never spells `assign`** (`scripts/check-vault-isolation.mjs`): #10 names flags by their table row (F1–F10).
- Fixtures for mints and token accounts come from `__tests__/tokenBytes.ts`'s builders, never hand-typed bytes; e2e copies the minimal builders it needs (e2e makes no value/type imports from core/).


And, for B1d-1a:

- **Both builds at every task:** the on build and the off build (`node scripts/build.mjs --no-presale`, `dist-nopresale/`) are built, tested (`vitest` and the off-build run `vitest.nopresale.config.ts`) and gate-checked (`npm run gates` runs the gate list once per build via `NOCTURA_DIST`).
- **Every existing send unchanged:** digests, integrity, challenges, pending records (a SOL send with a challenge, a USDC send without one, a dApp record — sent and polled) and validator verdicts equal the fixture captured from 0b79442's own code byte for byte; stored prepared entries equal it **but for their new `kind` key** (Task 3). A prepared entry stored before the update has no `kind` and is not read (`isPreparedShape`, fail closed): it is prepared again, its challenge carrying over (rev 2, review 1 L2).
- **The off build carries no presale module:** `check-no-presale.mjs` reads the module maps (the packages are byte-identical through Task 4; from Task 5 the on build carries the presale background modules, so the maps — not the files — remain the gate's evidence; rev 2, review 1 M4); each task appends its own modules to `ON_BUILD` / `BOTH_BUILDS` / `MUST_STAY` and the pinned rows.
- **Fail closed:** an unreadable, short, malformed or unpinned program read → presale unavailable; a missing, stale or ill-typed list, an unknown country, a 403 or a timeout → the gate closed.
- **Rent:** `PRESALE_*_RENT_LAMPORTS` and B1b's rent constants are upper bounds only; the exact outflow check (1b) uses the simulation's own rent (measured mainnet rate 5 080 lamports per byte). B1b's `sender-below-rent` stays at 890 880 (D19: stricter is safe; re-pinning from the chain is a separate later task — no code in 1a).
- **One kind per signer (D17):** `wallet.send` signs only `kind: 'send'`; a purchase is signed only through `presale.buy` (1b), which names its kind (Task 3).
- **The staleness limit is the extension's too (D18):** the gate judges a list against min(the server's `max_staleness_days`, 30) (Task 6).


And, for B1d-1b:

- **Carried from 1a (each honoured in the task named):** rent from the simulation, each new PDA's rent > 0 and ≤ its upper bound (Task 2); `sendPrepared(…, 'presale-buy')`, `wallet.send` send-only (Task 3); `rebaseChallenge` send-only, the purchase renews through `rebaseKindChallenge` (Task 2); `referrerAllocationOf` only after the state accepted the account (Task 2); the purchase renderer replaces B1b's wording on purchase records (Task 5); in-flight exclusivity both ways (Task 3); MARKERS armed for every presale string and message type (Tasks 1–8); `presaleRoutes` never a TAB_ONLY name (Tasks 4–6); the D7 SOL-floor mutation in `quote.ts` (Task 1).
- **ICO facts:** a CrowdSec ban is always a 403 with an HTML body, never silence; the coordinator never answers 403 on these routes; 429 / 503 / timeout = unavailable; the per-IP budget (900/min) bounds #23's 25 s re-read and the two views per Buy.
- **No invented price:** no live SOL price → no estimate, Q19; a missing price counts as above the re-auth threshold unless the simulation's own cents are known (C36 — confirmed by the owner, D24).
- **Playwright runs at every task that registers a message or changes a screen** — Tasks 1 and 4–9 (lesson of rev 1's Task 8: a spec went red unnoticed across seven tasks; rev 2 moves that spec's change to Task 1, where it happens). **Budget (review 1 L5):** one whole-suite pass is ≈ 25 min per mode on the dry-run machine (rev 1: 896 s + 609 s normally, the same under `unshare -rn`), so each such task adds ≈ 50 min for both modes; the dry run ran the whole suite at Tasks 7, 8 and 9 and `presaleSwitch.spec.ts` at Task 1. The `timeout 300` of the mutation steps is for unit mutants; E2E mutants use `timeout 900`.
- **The sign-time check rests on the signed bytes (rev 2, review 1 M1):** `shown` is not integrity-bound, so it is read as a claim; `beforeSign` checks the entry's integrity and its message against the fresh snapshot before the take (Task 3).

And, for B1d-2 (owner decisions of 2026-10-25 and the containment rule — each holds in **both builds at every task**; Task 1 builds the record to them, and no later task may weaken one):

- **D28 — the record POST sends the whole §2.4 payload:** `txHash`, `buyerAddress`, `stage` (1-indexed, an integer — the route reads `Number.isInteger(body.stage)`), and our `paymentToken`, `paymentAmount` (a decimal string), `nocAmount`, `usdValue` (numbers, converted at this edge only), `referrerAddress` (or absent). The coordinator stores only what it derives from the chain; it logs a > 1 % disagreement with ours.
- **D29 — a 400 is final:** no retry; the entry's state becomes **`refused`** (a fourth state beside `due`, `done`, `given-up`); #27 still shows Q34 for it; the purchase stands. (As built, Task 1: only the route's own refusal body `{success: false, error: <string>}` is final — any other 400 is retried.)
- **D30 — `200 {success: true}` is `done`** whatever `verified` / `duplicate` say (a `verified: false` row is completed by the coordinator's own sweep).
- **Tests never contact `*.noc-tura.io` or `solscan.io`** — the record route and `/referral-stats` are the fake coordinator's in E2E (counters asserted empty, `contained(h)`), `fakeDeps`' `postJson` / `getJson` throw `unexpected …` unless a test gives one, and nothing committed reaches a real host. (The dry run's unsigned mainnet simulation in Task 2's notes was a scratch file through the public Solana RPC, never committed, and made no `*.noc-tura.io` request.)

## Review Focus

The five input classes or failure modes most likely to bite that no task's tests exercised in the dry run, one line each — with the row added to its owning task, or written as a known limitation with the reason:

1. **A purchase whose hook never ran and that 20 newer records push out of `v1_pending` before the worker wakes** is never recorded — and #27 shows no Q34 for it, so the gap is silent (the controller's accepted gap: the hook is primary, the reconcile a backstop). **Tested:** Task 1, `reconcileWindow.test.ts` — 19 newer closed records → reconciled, POSTed once, `done` (positive control); 20 → nothing reconciled, nothing POSTed, no entry; N8 (`MAX_RECORDS = 21`) and N9 (reconcile a no-op) each red.
2. **A DST change inside the last 12 days** can turn B1b's `src/app/__tests__/Send.test.tsx` row "sent before (E6) … last 12 days ago" red on a machine whose zone keeps DST (it assumes 12 × 24 h = 12 calendar days; this machine is Europe/Ljubljana, which changed on 2026-10-25 — the row passed when run at 04:51 CET on 2026-10-26, so it depends on the hour). **Known limitation, no test added:** B1b's code and test, not B1d-2's, and CI runs in UTC; if it is red during execution, run that file again under `TZ=UTC`, record both results, and never count it as this plan's failure — the fix is a separate change for the owner.
3. **429 and 403 on the record route in a real browser** — no E2E scripts them (Task 6's fake route can). **Known limitation, no test added:** both are unit rows down to `createJsonPoster` (Task 1: record.test.ts "429 (the per-address limit) is the next slot" and the four 403 / cool-down rows; deps.test.ts's "POSTs the JSON body … answers each status with its body", 429 among them, and "postJson goes through the same latch: a 403 on the record route silences the RPC …"), and a 403 in E2E trips the browser-wide cool-down of every coordinator route, which would end the scene (Task 6's ruling).
4. **The program's 10 % referral bonus, which the fake program does not pay** — **known limitation, no test added:** the bonus lands in the referrer's allocation (account 3), which is not among the accounts the wallet asks the simulation for (Task 2's `simulationAccounts`: payer, allocation, destination, paying token account, user account), so it can move no verdict; Task 2's unsigned mainnet simulation observed it with every check passing; #24's EARNED is read from chain and E2E 11 seeds it.
5. **The two off-build scans disagreeing:** `npm run gates` reads the production builds, `scripts/__tests__/presaleBuilds.test.mjs` builds both under `NODE_ENV=test`, where @solana/errors keeps its message strings — a marker can pass one and fail the other (Task 7's `' per transaction'`). **Known limitation, no test added:** both run in `npm run verify`, so every marker must pass both; Task 7's V7 is the control that the test-mode scan catches what the production scan passes.

---

## How to read the steps

- A **new file** is given in full; a **changed file** is a unified diff against the previous task's tree. Apply each ```diff block on its own, in order, with `git apply --recount` from the repository root — never concatenate blocks.
- `design-ext.css` is generated (the extractor; Task 4 extends its allowlist and re-pins the hash). Task 2's `captured/purchases.a1bda47.json` is generated too, by the capture step in its Step 1 (pinned by its sha256).
- "Whole suite" is `npx tsc --noEmit; echo $?`, `npx vitest run` and `npx vitest run -c vitest.nopresale.config.ts`; both builds; `npm run gates`.
- **Each task ends with its named mutations** (fresh `git archive` copy, `tsc`'s own exit code first, each red) and **"Notes for the executor"** (its rulings; part of the plan).

## Tasks

### Task 1: The record (background) — `presale/record.ts` (`v1_presale_records`, at most 50 entries, the purchase's §2.4 payload made from its `extra.data` at this edge only, C24's schedule anchored on `confirmedAt`, one POST in flight claimed before it is sent, D28–D30 with `refused` as the fourth state, a 403 waiting out the shared latch's cool-down, the `presale-record` alarm at the earliest due entry, a reconcile at every wake for a purchase whose entry a stopped worker never wrote, `presale.unrecorded`), the intent kind's `onConfirmed` called once by the poller, `createJsonPoster(fetch, latch)` and `WalletDeps.postJson` in `deps.ts` (both builds), the records' key and lock as shared code (`presaleRecordsKey.ts`: a delete wipes them in both builds), `PresaleHost.alarm` and its dispatch in `index.ts`; core's `PresalePurchaseRecord.paymentAmount` widened to `number | string`

**Spec:** B1d §1.2 (`record.ts` row), §1.3 (`onConfirmed`: "the poller calls the kind's hook once when a record first reaches `confirmed`"), §1.4 (`presale.unrecorded`), §1.2's last paragraph (`deps.ts` gains `createJsonPoster(fetch, latch)` — generic, beside `createJsonGetter`), §2.3 (`extra.data`; the recording sends stage + 1), §2.4 (all, as amended by D28–D30), §4.6 (#27's Q34 is Task 5's; this task answers the message it reads), §5 rows "the coordinator is unreachable" (a recorded purchase keeps retrying) and "the record POST keeps failing" (given up after 72 h), §6.1 "Recording (2)", §6.2 ("`v1_presale_records` in `BACKGROUND_OWNED_KEYS`"; the staged lists), §7 P2a; C24; owner D28, D29, D30 (brief); ICO facts (brief: coordinator main 9e7d468, `server.js:433-520`, read-only). Carried from B1d-1b: `ON_BUILD` / `MARKERS` for every new on-build module and `presale.*` type (MARKERS was 74 on main, now 76); both builds at every task; Playwright at a task that registers a message.

**Files:**
- Create: `extension/src/background/presale/record.ts` (presale build only), `extension/src/background/presaleRecordsKey.ts` (both builds: the key, its section, its wipe)
- Modify: `extension/src/background/deps.ts` (`PostAnswer`, `createJsonPoster`, `WalletDeps.postJson`, `browserDeps` on the one latch), `extension/src/background/intents.ts` (`IntentKind.onConfirmed?`), `extension/src/background/pending.ts` (the hook, once per record this round moved to `confirmed`, for the stored wallet's accounts only, a throwing hook swallowed with a warning), `extension/src/background/accountsStore.ts` (`WALLET_DATA_KEYS` + `PRESALE_RECORDS_KEY`, removed behind its lock), `extension/src/background/presaleHost.ts` (`alarm`), `extension/src/background/index.ts` (the presale alarms by name, never a shared alarm's), `extension/src/background/presale/buy.ts` (`onConfirmed: recordConfirmedPurchase`), `extension/src/background/presale/api.ts` (`presale.unrecorded`; `wakePresaleRecords` — reconcile, then run — registered as the alarm's run and started at every start)
- Modify (core — callers unchanged): `core/presale/record.ts` (`paymentAmount: number | string`)
- Modify (the gates' staged lists): `extension/scripts/check-no-presale.mjs` (`ON_BUILD` + `record.ts`; `BOTH_BUILDS` + `presaleRecordsKey.ts`; `MARKERS` + `presale.unrecorded`, `presale-record`; `MUST_STAY` + `v1_presale_records`), `extension/scripts/check-vault-isolation.mjs` (`BACKGROUND_OWNED_KEYS` + `v1_presale_records`)
- Create (tests): `extension/src/background/presale/__tests__/record.test.ts`, `extension/src/background/presale/__tests__/reconcileWindow.test.ts` (Review Focus 1: the reconcile window's edge)
- Modify (tests): `extension/src/background/__tests__/fakeDeps.ts` (`postJson` fails loudly by default), `deps.test.ts`, `intents.test.ts` (both builds), `pendingKinds.test.ts` (both builds), `start.test.ts`, `messages.test.ts` (both builds), `presale/__tests__/api.test.ts`, `presale/__tests__/buy.test.ts`, `src/__tests__/presaleSwitch.test.ts`, the six popup test files that register presale (`alarm: () => undefined`), `scripts/__tests__/check-no-presale.test.mjs`, `scripts/__tests__/check-vault-isolation.test.mjs`
- Modify (E2E): `extension/e2e/fakeCoordinator.ts` (the record route, answered as the deployed route accepts a record; `purchaseRecords`), `extension/e2e/presale.spec.ts` (E2E 1 sees its one record — without the route every confirmed purchase would be `unexpected` and `contained(h)` red)

**Interfaces:**
- Consumes: B1d-1b's `PRESALE_BUY_INTENT` / `registerIntentKind` / `intentKind` / `KindHost` (`intents.ts`), `PendingRecord` / `PendingExtra` (`pendingStore.ts`; `extra.data` = §2.3's eight strings as `purchasePendingData` writes them), `pollOnce` (`pending.ts`) and its `own` rule (accounts of the stored wallet, review M1), `PENDING_ALARM_MINUTES` (`pending.ts`), `registerPresale` / `accountOnly` / `guarded` / `PRESALE_MESSAGE_TYPES` (`presale/api.ts`), `PresaleHost` (`presaleHost.ts`), `createForbiddenLatch` / `RpcForbidden` / `RpcCoolingDown` / `RequestUnreachable` / `FetchLike` / `FORBIDDEN_COOLDOWN_MS` / `API_BASE` (`core/solana/rpc.ts`), `latchStore` / `FORBIDDEN_UNTIL_KEY` / `RequestTimedOut` / `timedFetch` / `REQUEST_TIMEOUT_MS` (`deps.ts`), `PRESALE_CURRENCIES` / `PresaleCurrency` (`presale/quote.ts`), `STAGE_PRICE_TICKS` (`core/presale/limits.ts`), `formatTokenAmount` (`core/util/parseTokenAmount.ts`), `createMutex` (`mutex.ts`), `wipeDappStores`' pattern (`dapp/store.ts`).
- Produces (`extension/src/background/deps.ts`, both builds):
  ```ts
  export interface PostAnswer {status: number; body: unknown}   // body null when it is not JSON
  export function createJsonPoster(fetch: FetchLike, latch: ForbiddenLatch): {post(path: string, body: unknown): Promise<PostAnswer>};
  // WalletDeps gains:
  postJson(path: string, body: unknown): Promise<PostAnswer>;   // browserDeps: createJsonPoster(timedFetch(REQUEST_TIMEOUT_MS), the one latch)
  ```
  POST `${API_BASE}${path}`, `content-type: application/json`, `credentials: 'omit'`, through the latch (a 403 → `RpcForbidden`, the cool-down → `RpcCoolingDown`, nothing sent); every other status answered with its body; no answer / a body that never arrives → `RequestUnreachable` (`RequestTimedOut`). `fakeDeps`' `postJson` throws `unexpected POST <path>` unless a test overrides it.
- Produces (`extension/src/background/intents.ts`): `IntentKind<I>.onConfirmed?(host: KindHost, record: PendingRecord): Promise<void>` — called by `pollOnce` once, for each record its own write moved to `confirmed` (a racing round sees it once), only when `record.extra` names the kind and `record.account` is an account of the stored wallet; a hook that throws is logged (`'a confirmed record’s hook failed'`) and changes nothing the poller does. Not asked of `send`.
- Produces (`extension/src/background/presaleRecordsKey.ts`, both builds): `PRESALE_RECORDS_KEY = 'v1_presale_records'`; `presaleRecordsSection: Mutex` (every write of the key runs in it); `wipePresaleRecords(ext): Promise<void>` (the removal behind any write in flight). `WALLET_DATA_KEYS` (`accountsStore.ts`) contains the key; a delete and a first write remove it through `wipePresaleRecords`, a restore keeps it.
- Produces (`extension/src/background/presaleHost.ts`): `PresaleHost.alarm(name: string, run: () => Promise<void>): void` — index.ts calls `run` when the alarm `name` fires; a shared alarm's name (`autolock`, `pending-poll`, the queue's) or a name taken already throws at start-up. Every `registerPresale` caller passes it (the tests: `alarm: () => undefined`).
- Produces (`extension/src/background/presale/record.ts`, presale build only):
  ```ts
  export const PRESALE_RECORD_ALARM = 'presale-record';
  export const PRESALE_RECORD_PATH = '/solana/purchase';
  export const MAX_PRESALE_RECORDS = 50;
  export const PRESALE_RECORD_SLOTS_MS: readonly number[];   // 0, 1 min, 5 min, 30 min, 2 h, 12 h, 24 h, 48 h, 72 h after confirmedAt
  export type PresaleRecordState = 'due' | 'done' | 'refused' | 'given-up';
  export type PresaleRecordPayload = PresalePurchaseRecord & {paymentAmount: string};
  export interface PresaleRecordEntry {signature: string; account: string; payload: PresaleRecordPayload; confirmedAt: number; attempts: number; nextAt: number; state: PresaleRecordState}
  export function purchasePayload(record: PendingRecord): PresaleRecordPayload | null;   // §2.4 / D28 from extra.data; null when it does not read back
  export function readPresaleRecords(ext: Ext): Promise<PresaleRecordEntry[]>;           // strict, fresh objects, oldest first
  export function slotAfter(confirmedAt: number, now: number): number | null;
  export function recordConfirmedPurchase(host: KindHost, record: PendingRecord): Promise<void>;   // PRESALE_BUY_INTENT.onConfirmed
  export function runPresaleRecords(ext: Ext, deps: WalletDeps): Promise<void>;          // one run per ext; never rejects
  export function reconcilePresaleRecords(ext: Ext, deps: WalletDeps): Promise<void>;    // the controller's ruling: entries a stopped worker never wrote
  export function wakePresaleRecords(ext: Ext, deps: WalletDeps): Promise<void>;         // reconcile, then run — each start and the alarm
  export function unrecordedFor(ext: Ext, account: string): Promise<string[]>;
  ```
  `presale.unrecorded {account}` (appended to `PRESALE_MESSAGE_TYPES`; the popup and the full tab only) → `{ok: true, data: string[]}` — the signatures of the account's entries in `due`, `given-up` or `refused`, in stored order; no network; `malformed` for any key besides `account` or a non-address, then `locked` / `unknown-account`.
  **What later tasks rely on:** the payload's `referrerAddress` is `extra.data.referrer` — Task 2 must make that the *effective* referrer, including one this purchase registers (today `shownOf` in `buy.ts` reads back only `registers: false`, and `purchasePendingData` copies `shown.view.referrer.address`), and the record carries it with no change here. Task 5 renders Q34 from `presale.unrecorded` (D29: `refused` included). Task 6 scripts the fake's record route (`purchaseRecords` exists; the route answers `200 {success: true, verified: true, duplicate: false, data: null}` until then) and adds E2E 10–12.
- Produces (`core/presale/record.ts`): `PresalePurchaseRecord.paymentAmount: number | string` — web and the app keep passing numbers (root `jest` and web `verify` green, unchanged); `recordPresalePurchase` itself is unchanged and the extension does not use it (it swallows every answer, so nothing could be retried — §2.4).

**How the record moves (C24, D28–D30, §2.4).** `onConfirmed` writes an entry `{state: 'due', nextAt: confirmedAt, attempts: 0}` once per signature and starts a run without awaiting it (the poller goes on). A run takes one due entry at a time: **it claims the entry first** — `attempts + 1` and `nextAt` = the first slot after now (or `given-up` when none is left) are written before the POST — so a worker stopped mid-request never POSTs it twice within a slot, and a second background over the same storage finds it not due. The answer then: `200` with `success: true` → `done` whatever `verified`, `duplicate` and `data` say (D30); `400` whose body is the route's own refusal (`success: false` and a string `error` — the four of `server.js`) → `refused`, final (D29); a 403 (`RpcForbidden`) or the cool-down (`RpcCoolingDown`, nothing sent) → `nextAt` = max(the claimed slot, the latch's stored end) — never sooner than the cool-down's end, and at the last slot it stays `given-up`; anything else (a 400 without that body, 429, 5xx, a 200 without `success: true`, a timeout, no answer) → the claimed slot. The slots are anchored on `confirmedAt`, so a worker asleep across several of them POSTs once when it wakes and then waits for the first slot after now; one asleep past 72 h makes one last attempt. After the run, the `presale-record` alarm is set at the earliest due `nextAt` (at least 0.5 min, the browsers' minimum) or cleared when nothing is due — and an empty store touches no alarm. A run asked for while one is going returns it and makes it look again, also while it is arming the alarm. The store keeps at most 50 entries, dropping first the oldest `done` (dropping it changes nothing anyone sees), then the oldest `given-up`, `refused`, `due`.

**When the worker wakes (controller ruling on this task's dry run).** "Once" is per transition, so a worker stopped between the poller's `confirmed` write and the hook's entry would lose the record. At every start and on the `presale-record` alarm the background first reconciles, inside the records' section: every `confirmed` record in `v1_pending` of an account of the wallet stored now whose display data reads back as a purchase (`purchasePayload`) and that has no entry gets the hook's entry — `due`, `nextAt` now, `attempts` 0 — with `confirmedAt` = the record's `createdAt` (a pending record carries no confirmation time; its signed bytes can land only within their blockhash's life after `createdAt`, so this is early by at most that life, and the 72 h window is never stretched). A record confirmed more than 72 h before now (`now > createdAt + 72 h`) is written `given-up` and never POSTed. An entry already there, in any state, is left alone. A confirmed record stays in `v1_pending` until newer records push it out — `MAX_RECORDS` = 20 in all, every open record kept and the newest closed ones filling the rest, of any account and kind (sends and dApp records included); there is no time limit — or until a delete removes the closed records; past that, nothing is left to reconcile.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/presale/__tests__/record.test.ts`:

```ts
import {base58, base64} from '@scure/base';
import {registerPresale} from '../api';
import {
  MAX_PRESALE_RECORDS,
  PRESALE_RECORD_ALARM,
  PRESALE_RECORD_PATH,
  PRESALE_RECORD_SLOTS_MS,
  purchasePayload,
  readPresaleRecords,
  reconcilePresaleRecords,
  recordConfirmedPurchase,
  runPresaleRecords,
  slotAfter,
  type PresaleRecordEntry,
  type PresaleRecordPayload,
} from '../record';
import {handleMessage, registerPresaleHandler} from '../../messages';
import {PENDING_KEY, readPending, type PendingRecord} from '../../pendingStore';
import {pollOnce} from '../../pending';
import {VAULT_KEY, forgetWallet, storeEnvelope} from '../../accountsStore';
import {PRESALE_RECORDS_KEY} from '../../presaleRecordsKey';
import {FORBIDDEN_UNTIL_KEY, RequestTimedOut, createJsonPoster, latchStore, type PostAnswer} from '../../deps';
import {envelopeRevision} from '../../../shared/envelopeRevision';
import {fakeDeps, fakeReader} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {ACCOUNT as SESSION_ACCOUNT, RECIPIENT, pendingRecord, signedWire, unlocked} from '../../__tests__/fixtures';
import {MAINNET_SOL_TREASURY, MAINNET_VAULT_USDC_ATA} from '../../../../../core/presale/addresses';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {FORBIDDEN_COOLDOWN_MS, RequestUnreachable, RpcCoolingDown, RpcForbidden, createForbiddenLatch, createRpc, type FetchLike} from '../../../../../core/solana/rpc';

// B1d §2.4 (C24, D28–D30): the coordinator record of a confirmed purchase — the payload, written on `confirmed` only,
// the answers, the schedule's slots on a fake clock, a 403 through the shared latch, one POST in flight, the alarm, the
// store's bounds, delete and restore, and presale.unrecorded. Nothing here reaches the network: every POST is a fake.

/** The presale entry's alarm runs, as index.ts would hold them — registered against a host this file can reach. */
const HOST = {ext: fakeExt(), deps: fakeDeps()};
const alarms = new Map<string, () => Promise<void>>();
registerPresale({...HOST, handle: registerPresaleHandler, alarm: (name, run) => void alarms.set(name, run)});

const ACCOUNT = SESSION_ACCOUNT.publicKey;
const SIG = firstSignature(signedWire(11n));
const SIG2 = firstSignature(signedWire(12n));
const T0 = 1_000_000;
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const ENVELOPE = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT}]};
/** §2.3: a purchase's `extra.data` as the kind writes it — 2 SOL at stage 0 (the program's index), no referrer. */
const DATA = {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '30000', destination: MAINNET_SOL_TREASURY, referrer: null};
const purchase = (over: Partial<PendingRecord> = {}, data: Record<string, unknown> = {}): PendingRecord =>
  pendingRecord({id: 'buy', account: ACCOUNT, signature: SIG, intent: null, state: 'confirmed', fee: {networkLamports: '5050', markupLamports: '0'}, extra: {kind: 'presale-buy', data: {...DATA, ...data}}, ...over});
const PAYLOAD: PresaleRecordPayload = {txHash: SIG, buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: '2', nocAmount: 1998667.554963357, usdValue: 300, stage: 1};
const OK: PostAnswer = {status: 200, body: {success: true, verified: true, duplicate: false, data: null}};
const SERVER_ERROR: PostAnswer = {status: 500, body: {success: false, error: 'boom'}};

interface Post {
  at: number;
  path: string;
  body: unknown;
}
/** A world: an ext, a clock at T0, and a POST that records each call and answers from `answers` (the last repeated). */
function world(answers: (PostAnswer | Error)[] = [OK]) {
  const ext = fakeExt();
  const posts: Post[] = [];
  const deps = fakeDeps({
    postJson: async (path, body) => {
      posts.push({at: deps.clock.t, path, body});
      const a = answers[Math.min(posts.length - 1, answers.length - 1)] as PostAnswer | Error;
      if (a instanceof Error) throw a;
      return a;
    },
  });
  deps.clock.t = T0;
  return {ext, deps, posts};
}
type World = ReturnType<typeof world>;
/** The kind's hook, as the poller calls it, then the run it starts — awaited. */
async function confirm(w: World, record: PendingRecord = purchase()): Promise<void> {
  await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, record);
  await runPresaleRecords(w.ext, w.deps);
}
async function at(w: World, t: number): Promise<void> {
  w.deps.clock.t = t;
  await runPresaleRecords(w.ext, w.deps);
}
const entries = (w: World) => readPresaleRecords(w.ext);
/** A distinct signature-shaped string (64 bytes, base58) per n — no signing, so a store of 50 is cheap to build. */
const fakeSig = (n: number) => base58.encode(Uint8Array.from({length: 64}, (_, i) => (n * 7 + i + 1) % 256));
const entry = (over: Partial<PresaleRecordEntry> = {}): PresaleRecordEntry => ({signature: SIG, account: ACCOUNT, payload: PAYLOAD, confirmedAt: T0, attempts: 0, nextAt: T0, state: 'due', ...over});

describe('the payload (§2.4, D28): the whole §2.4 body, made from the record’s display data at this edge only', () => {
  it('a SOL purchase without a referrer: the display amount a decimal string, NOC and USD numbers, the stage 1-indexed, no referrerAddress key (positive control)', () => {
    const p = purchasePayload(purchase());
    expect(p).toEqual(PAYLOAD);
    expect(p !== null && Object.hasOwn(p, 'referrerAddress')).toBe(false);
    expect(typeof p?.paymentAmount).toBe('string');
    expect(JSON.stringify(p)).toBe(`{"txHash":"${SIG}","buyerAddress":"${ACCOUNT}","paymentToken":"SOL","paymentAmount":"2","nocAmount":1998667.554963357,"usdValue":300,"stage":1}`);
  });

  it('a stablecoin purchase with its referrer; fractions and the smallest unit as decimal strings; the last stage', () => {
    expect(purchasePayload(purchase({}, {currency: 'USDC', amount: '12345678', stage: '9', nocBase: '1000000001', spentCents: '1234', destination: MAINNET_VAULT_USDC_ATA, referrer: RECIPIENT}))).toEqual({
      txHash: SIG,
      buyerAddress: ACCOUNT,
      paymentToken: 'USDC',
      paymentAmount: '12.345678',
      nocAmount: 1.000000001,
      usdValue: 12.34,
      stage: 10,
      referrerAddress: RECIPIENT,
    });
    expect(purchasePayload(purchase({}, {amount: '1500000000'}))?.paymentAmount).toBe('1.5');
    expect(purchasePayload(purchase({}, {amount: '1'}))?.paymentAmount).toBe('0.000000001');
    expect(purchasePayload(purchase({}, {currency: 'USDT', amount: '25000000'}))).toMatchObject({paymentToken: 'USDT', paymentAmount: '25'});
  });

  it.each([
    ['no extra', {extra: null}, {}],
    ['another kind', {extra: {kind: 'send', data: DATA}}, {}],
    ['a signature that is not one', {signature: 'sig-buy'}, {}],
    ['an account that is not an address', {account: 'A'}, {}],
  ])('the record’s own fields: %s → null', (_name, over, data) => {
    expect(purchasePayload(purchase(over as Partial<PendingRecord>, data))).toBeNull();
  });

  it.each([
    ['a key missing', {destination: undefined}],
    ['an extra key', {extra: '1'}],
    ['currency NOC', {currency: 'NOC'}],
    ['amount 0', {amount: '0'}],
    ['amount with a leading zero', {amount: '01'}],
    ['amount a decimal', {amount: '1.5'}],
    ['amount a number', {amount: 2000000000}],
    ['stage 10', {stage: '10'}],
    ['stage a number', {stage: 0}],
    ['stage negative', {stage: '-1'}],
    ['priceTicks not digits', {priceTicks: 'x'}],
    ['nocBase 0', {nocBase: '0'}],
    ['spentCents empty', {spentCents: ''}],
    ['destination not an address', {destination: 'nope'}],
    ['referrer empty', {referrer: ''}],
    ['referrer a number', {referrer: 5}],
  ])('the display data as stored is a claim: %s → null (nothing recorded)', (_name, data) => {
    const d: Record<string, unknown> = {...DATA, ...data};
    for (const k of Object.keys(d)) if (d[k] === undefined) delete d[k];
    expect(purchasePayload(purchase({extra: {kind: 'presale-buy', data: d}}))).toBeNull();
  });
});

describe('written when the poller sees the purchase confirmed (§1.3, §2.4)', () => {
  const CONFIRMED = {err: null, confirmationStatus: 'confirmed' as const};
  async function polled(status: {err: unknown; confirmationStatus: 'confirmed'} | null, record = purchase({state: 'pending'})) {
    const w = world();
    await w.ext.local.set(VAULT_KEY, ENVELOPE);
    await w.ext.local.set(PENDING_KEY, [record]);
    w.deps.reader = fakeReader({getSignatureStatuses: async sigs => sigs.map(() => status), getBlockHeight: async () => 900});
    await pollOnce(w.ext, w.deps);
    await runPresaleRecords(w.ext, w.deps);
    return w;
  }

  it('confirmed: the entry, POSTed at once with the whole payload to the bare route, done on success (positive control)', async () => {
    const w = await polled(CONFIRMED);
    expect((await readPending(w.ext))[0]?.state).toBe('confirmed');
    expect(w.posts).toEqual([{at: T0, path: PRESALE_RECORD_PATH, body: PAYLOAD}]);
    expect(PRESALE_RECORD_PATH).toBe('/solana/purchase');
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE, state: 'done'})]);
  });

  it('not landed, or landed with an error: nothing written, nothing POSTed', async () => {
    for (const s of [null, {err: {InstructionError: [2, {Custom: 6016}]}, confirmationStatus: 'confirmed' as const}]) {
      const w = await polled(s);
      expect([w.posts, await entries(w), await w.ext.local.get(PRESALE_RECORDS_KEY)]).toEqual([[], [], undefined]);
    }
  });

  it('a purchase whose display data does not read back is confirmed but not recorded', async () => {
    const w = await polled(CONFIRMED, purchase({state: 'pending'}, {currency: 'NOC'}));
    expect((await readPending(w.ext))[0]?.state).toBe('confirmed');
    expect([w.posts, await entries(w)]).toEqual([[], []]);
  });

  it('once per signature: the hook again for the same signature adds nothing and POSTs nothing more', async () => {
    const w = world();
    await confirm(w);
    await confirm(w);
    expect(w.posts).toHaveLength(1);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE, state: 'done'})]);
  });
});

describe('the answers (D29, D30)', () => {
  it('200 {success: true} is done whatever verified, duplicate and data say — no further POST at any later slot, the alarm cleared', async () => {
    for (const body of [{success: true, verified: false, duplicate: false, data: {status: 'pending'}}, {success: true, verified: true, duplicate: true, data: null}, {success: true}]) {
      const w = world([{status: 200, body}]);
      await confirm(w);
      for (const s of PRESALE_RECORD_SLOTS_MS) await at(w, T0 + s);
      expect([w.posts.length, (await entries(w))[0]?.state, w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([1, 'done', false]);
    }
  });

  it.each([['Missing or invalid txHash'], ['Invalid Solana address format'], ['Transaction failed on-chain'], ['not_a_presale_purchase']])('the route’s 400 (%s) is final: refused, never POSTed again, still unrecorded', async error => {
    const w = world([{status: 400, body: {success: false, error, ...(error === 'not_a_presale_purchase' ? {reason: 'no presale instruction'} : {})}}]);
    await confirm(w);
    for (const s of PRESALE_RECORD_SLOTS_MS) await at(w, T0 + s + 1);
    expect([w.posts.length, (await entries(w))[0]?.state, w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([1, 'refused', false]);
  });

  it.each([
    ['a 400 that is not the route’s (no body)', {status: 400, body: null}],
    ['a 400 without success: false', {status: 400, body: {error: 'Bad Request'}}],
    ['a 400 whose error is not a string', {status: 400, body: {success: false, error: 1}}],
    ['429 (the per-address limit)', {status: 429, body: {error: 'Too many purchase attempts, please wait'}}],
    ['500', SERVER_ERROR],
    ['503', {status: 503, body: null}],
    ['200 with success false', {status: 200, body: {success: false}}],
    ['200 with success "true"', {status: 200, body: {success: 'true'}}],
    ['200 not an object', {status: 200, body: 'ok'}],
    ['200 null', {status: 200, body: null}],
    ['201', {status: 201, body: {success: true}}],
    ['a timeout', new RequestTimedOut('/solana/purchase', 20_000)],
    ['no answer at all', new RequestUnreachable('/solana/purchase', 'offline')],
    ['anything else thrown', new Error('storage')],
  ])('%s is the next slot: due, one attempt made, its alarm armed', async (_name, answer) => {
    const w = world([answer]);
    await confirm(w);
    expect(w.posts).toHaveLength(1);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE})]);
    expect(w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)).toBe(1);
  });
});

describe('the schedule (C24) on a fake clock', () => {
  it('at once, 1 min, 5 min, 30 min, 2 h, 12 h, 24 h, 48 h and 72 h after confirmation — never between — then given up', async () => {
    expect(PRESALE_RECORD_SLOTS_MS).toEqual([0, MINUTE, 5 * MINUTE, 30 * MINUTE, 2 * HOUR, 12 * HOUR, 24 * HOUR, 48 * HOUR, 72 * HOUR]);
    const w = world([SERVER_ERROR]);
    await confirm(w);
    for (const [i, s] of PRESALE_RECORD_SLOTS_MS.entries()) {
      if (i === 0) continue;
      await at(w, T0 + s - 1);
      expect([i, w.posts.length]).toEqual([i, i]);
      await at(w, T0 + s);
      expect([i, w.posts.length]).toEqual([i, i + 1]);
      const next = PRESALE_RECORD_SLOTS_MS[i + 1];
      expect(await entries(w)).toEqual([entry({attempts: i + 1, ...(next === undefined ? {nextAt: T0 + s, state: 'given-up'} : {nextAt: T0 + next})})]);
    }
    expect(w.posts.map(p => p.at - T0)).toEqual(PRESALE_RECORD_SLOTS_MS);
    await at(w, T0 + 200 * HOUR);
    expect([w.posts.length, w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([9, false]);
  });

  it('a worker asleep across slots POSTs once when it wakes, then waits for the first slot after now', async () => {
    const w = world([SERVER_ERROR]);
    await confirm(w);
    await at(w, T0 + 3 * HOUR);
    expect(w.posts.map(p => p.at - T0)).toEqual([0, 3 * HOUR]);
    expect(await entries(w)).toEqual([entry({attempts: 2, nextAt: T0 + 12 * HOUR})]);
  });

  it('asleep past 72 h: one last attempt — given up if it fails, done if it succeeds', async () => {
    const failing = world([SERVER_ERROR]);
    await confirm(failing);
    await at(failing, T0 + 100 * HOUR);
    expect([failing.posts.length, (await entries(failing))[0]?.state]).toEqual([2, 'given-up']);
    const late = world([SERVER_ERROR, OK]);
    await confirm(late);
    await at(late, T0 + 100 * HOUR);
    expect([late.posts.length, (await entries(late))[0]?.state]).toEqual([2, 'done']);
  });

  it('slotAfter: the first slot strictly after now, null past the last', () => {
    expect(slotAfter(T0, T0 - 5)).toBe(T0);
    expect(slotAfter(T0, T0)).toBe(T0 + MINUTE);
    expect(slotAfter(T0, T0 + MINUTE - 1)).toBe(T0 + MINUTE);
    expect(slotAfter(T0, T0 + 48 * HOUR)).toBe(T0 + 72 * HOUR);
    expect(slotAfter(T0, T0 + 72 * HOUR - 1)).toBe(T0 + 72 * HOUR);
    expect(slotAfter(T0, T0 + 72 * HOUR)).toBeNull();
  });
});

describe('a 403 (the shared latch): the entry waits for the cool-down, never retried inside it', () => {
  /** The real poster and latch on the world's clock and storage; `status` is what the route answers next. */
  function latched(w: World, statuses: number[]) {
    const sent: {url: string; at: number}[] = [];
    const fetch: FetchLike = async url => {
      const status = statuses[Math.min(sent.length, statuses.length - 1)] as number;
      sent.push({url, at: w.deps.clock.t});
      return {status, json: async () => (status === 200 ? {success: true} : {success: false, error: 'boom'})};
    };
    const latch = createForbiddenLatch({now: () => w.deps.clock.t, store: latchStore(w.ext)});
    const poster = createJsonPoster(fetch, latch);
    w.deps.postJson = (path, body) => poster.post(path, body);
    return {sent, fetch, latch};
  }

  it('a 403 on the record: next attempt at the cool-down’s end (past the 1 min slot) — nothing sent at 1 min — then done', async () => {
    const w = world();
    const l = latched(w, [403, 200]);
    await confirm(w);
    expect(await w.ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(T0 + FORBIDDEN_COOLDOWN_MS);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + FORBIDDEN_COOLDOWN_MS})]);
    expect(w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)).toBe(FORBIDDEN_COOLDOWN_MS / MINUTE);
    await at(w, T0 + MINUTE);
    await at(w, T0 + FORBIDDEN_COOLDOWN_MS - 1);
    expect(l.sent).toHaveLength(1);
    await at(w, T0 + FORBIDDEN_COOLDOWN_MS);
    expect(l.sent.map(s => s.at - T0)).toEqual([0, FORBIDDEN_COOLDOWN_MS]);
    expect((await entries(w))[0]?.state).toBe('done');
  });

  it('another route’s 403 first (the RPC, the same latch): the record’s attempt sends nothing and waits for the same end', async () => {
    const w = world();
    const l = latched(w, [403, 200]);
    await expect(createRpc({fetch: l.fetch, latch: l.latch}).call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcForbidden);
    await confirm(w);
    expect(l.sent.map(s => s.url)).toEqual(['https://api.noc-tura.io/api/v1/rpc']);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + FORBIDDEN_COOLDOWN_MS})]);
  });

  it('a cool-down refusal (RpcCoolingDown) thrown by any poster is waited out the same way; a 403 at the last slot gives up', async () => {
    const w = world([new RpcCoolingDown('/solana/purchase')]);
    await w.ext.local.set(FORBIDDEN_UNTIL_KEY, T0 + 7 * MINUTE);
    await confirm(w);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + 7 * MINUTE})]);
    const last = world([new RpcForbidden('/solana/purchase')]);
    await last.ext.local.set(PRESALE_RECORDS_KEY, [entry({attempts: 8, nextAt: T0 + 72 * HOUR})]);
    await last.ext.local.set(FORBIDDEN_UNTIL_KEY, T0 + 73 * HOUR);
    await at(last, T0 + 72 * HOUR);
    expect(await entries(last)).toEqual([entry({attempts: 9, nextAt: T0 + 72 * HOUR, state: 'given-up'})]);
  });

  it('negative control: an earlier slot than the cool-down’s end is never moved later than the end, and a cool-down already over moves nothing', async () => {
    const w = world([new RpcForbidden('/solana/purchase')]);
    await w.ext.local.set(FORBIDDEN_UNTIL_KEY, T0 - 1);
    await confirm(w);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE})]);
  });
});

describe('one POST in flight; never two for one signature within a slot', () => {
  /** A POST held until `release`. */
  function held(w: World) {
    const gate: {release: (a: PostAnswer) => void; calls: number} = {release: () => undefined, calls: 0};
    w.deps.postJson = async (path, body) => {
      gate.calls += 1;
      w.posts.push({at: w.deps.clock.t, path, body});
      return new Promise<PostAnswer>(resolve => {
        gate.release = resolve;
      });
    };
    return gate;
  }
  const settle = async () => {
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
  };

  it('a second purchase confirmed while the first POST is held waits for it; then it is sent by the same run, and both are done', async () => {
    const w = world();
    const gate = held(w);
    await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase());
    await settle();
    expect(gate.calls).toBe(1);
    // Claimed before the request: its next slot is already written.
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE})]);
    await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase({id: 'buy2', signature: SIG2}));
    const again = runPresaleRecords(w.ext, w.deps);
    await settle();
    expect(gate.calls).toBe(1);
    gate.release(OK);
    await settle();
    expect(gate.calls).toBe(2);
    gate.release(OK);
    await again;
    expect((await entries(w)).map(e => [e.signature, e.state])).toEqual([
      [SIG, 'done'],
      [SIG2, 'done'],
    ]);
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG, SIG2]);
  });

  it('a purchase confirmed while the run is arming its alarm is still sent by that run, not left for the alarm', async () => {
    const w = world([SERVER_ERROR, OK]);
    let release = (): void => undefined;
    const arming = new Promise<void>(r => {
      release = r;
    });
    const create = w.ext.alarms.create;
    w.ext.alarms.create = async (name, o) => {
      await arming;
      create(name, o);
    };
    const first = confirm(w);
    await settle();
    expect(w.posts).toHaveLength(1);
    await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase({id: 'buy2', signature: SIG2}));
    release();
    await first;
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG, SIG2]);
    expect((await entries(w)).map(e => [e.signature, e.state])).toEqual([
      [SIG, 'due'],
      [SIG2, 'done'],
    ]);
  });

  it('a restarted worker (another background over the same storage) during the held POST sends nothing: the entry is not due until its next slot', async () => {
    const w = world();
    const gate = held(w);
    await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase());
    await settle();
    const restarted = {...w.ext};
    await runPresaleRecords(restarted, w.deps);
    expect(gate.calls).toBe(1);
    gate.release(SERVER_ERROR);
    await runPresaleRecords(w.ext, w.deps);
    expect(await entries(w)).toEqual([entry({attempts: 1, nextAt: T0 + MINUTE})]);
  });
});

describe('the alarm (presale-record): at the earliest due entry, through the host index.ts holds', () => {
  it('armed at min(nextAt) over the due entries, never sooner than 30 s; cleared when nothing is due', async () => {
    const w = world([SERVER_ERROR]);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry({nextAt: T0 + 30 * MINUTE}), entry({signature: SIG2, payload: {...PAYLOAD, txHash: SIG2}, nextAt: T0 + 5 * MINUTE}), entry({signature: firstSignature(signedWire(13n)), payload: {...PAYLOAD, txHash: firstSignature(signedWire(13n))}, nextAt: T0 + MINUTE, state: 'done'})]);
    await runPresaleRecords(w.ext, w.deps);
    expect([w.posts.length, w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)]).toEqual([0, 5]);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry({nextAt: T0 + 10_000})]);
    await runPresaleRecords(w.ext, w.deps);
    expect(w.ext.alarmsSet.get(PRESALE_RECORD_ALARM)).toBe(0.5);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry({state: 'given-up'}), entry({signature: SIG2, payload: {...PAYLOAD, txHash: SIG2}, state: 'refused'})]);
    await runPresaleRecords(w.ext, w.deps);
    expect(w.ext.alarmsSet.has(PRESALE_RECORD_ALARM)).toBe(false);
  });

  it('registerPresale registers the alarm’s run: it reconciles, then sends its host’s due entries', async () => {
    expect([...alarms.keys()]).toEqual([PRESALE_RECORD_ALARM]);
    const posts: unknown[] = [];
    HOST.deps.postJson = async (_path, body) => (posts.push(body), OK);
    HOST.deps.clock.t = T0;
    await HOST.ext.local.set(PRESALE_RECORDS_KEY, [entry()]);
    await HOST.ext.local.set(VAULT_KEY, ENVELOPE);
    await HOST.ext.local.set(PENDING_KEY, [purchase({id: 'buy2', signature: SIG2, createdAt: T0})]);
    await alarms.get(PRESALE_RECORD_ALARM)?.();
    expect(posts).toEqual([PAYLOAD, {...PAYLOAD, txHash: SIG2}]);
    expect((await readPresaleRecords(HOST.ext)).map(e => [e.signature, e.state])).toEqual([
      [SIG, 'done'],
      [SIG2, 'done'],
    ]);
  });
});

// Controller ruling (B1d-2 Task 1): a worker stopped between the poller's `confirmed` write and the hook's entry is made
// good when it wakes — the entry the hook would have written, `confirmedAt` the record's `createdAt`.
describe('reconciled when the worker wakes: a confirmed purchase the hook never recorded', () => {
  const CREATED = T0 - 5 * MINUTE;
  async function woken(records: PendingRecord[], stored: PresaleRecordEntry[] | null = null, now = T0, envelope: unknown = ENVELOPE) {
    const w = world();
    if (envelope !== null) await w.ext.local.set(VAULT_KEY, envelope);
    await w.ext.local.set(PENDING_KEY, records);
    if (stored !== null) await w.ext.local.set(PRESALE_RECORDS_KEY, stored);
    w.deps.clock.t = now;
    await reconcilePresaleRecords(w.ext, w.deps);
    await runPresaleRecords(w.ext, w.deps);
    return w;
  }

  it('the hook was skipped: the wake writes its entry (confirmedAt = createdAt, due now) and the run POSTs it once (positive control)', async () => {
    const w = await woken([purchase({createdAt: CREATED})]);
    expect(w.posts).toEqual([{at: T0, path: PRESALE_RECORD_PATH, body: PAYLOAD}]);
    expect(await entries(w)).toEqual([entry({confirmedAt: CREATED, attempts: 1, nextAt: CREATED + 30 * MINUTE, state: 'done'})]);
  });

  it('an entry already there, in any state: no second entry, no POST', async () => {
    for (const state of ['done', 'due', 'refused', 'given-up'] as const) {
      const present = entry({nextAt: T0 + HOUR, state});
      const w = await woken([purchase({createdAt: CREATED})], [present]);
      expect([state, w.posts, await entries(w)]).toEqual([state, [], [present]]);
    }
  });

  it('confirmed more than 72 h ago: written given-up, never POSTed; at exactly 72 h it is still due and POSTed once', async () => {
    const late = await woken([purchase({createdAt: CREATED})], null, CREATED + 72 * HOUR + 1);
    expect([late.posts, await entries(late), late.ext.alarmsSet.has(PRESALE_RECORD_ALARM)]).toEqual([[], [entry({confirmedAt: CREATED, nextAt: CREATED + 72 * HOUR + 1, state: 'given-up'})], false]);
    const edge = await woken([purchase({createdAt: CREATED})], null, CREATED + 72 * HOUR);
    expect([edge.posts.length, (await entries(edge))[0]?.state]).toEqual([1, 'done']);
  });

  it('nothing else is reconciled: an open or failed purchase, a send, a dApp record, another kind, another wallet’s account, data that does not read back', async () => {
    for (const record of [
      purchase({state: 'pending'}),
      purchase({state: 'stuck'}),
      purchase({state: 'failed', failure: 'landed'}),
      purchase({state: 'expired'}),
      pendingRecord({account: ACCOUNT, signature: SIG, state: 'confirmed'}),
      purchase({origin: 'https://jup.ag', extra: null}),
      purchase({extra: {kind: 'test-buy', data: DATA}}),
      purchase({}, {currency: 'NOC'}),
    ]) {
      const w = await woken([record]);
      expect([record.state, w.posts, await w.ext.local.get(PRESALE_RECORDS_KEY)]).toEqual([record.state, [], undefined]);
    }
    for (const envelope of [null, {...ENVELOPE, accounts: [{index: 0, name: 'Other', publicKey: RECIPIENT}]}]) {
      const w = await woken([purchase()], null, T0, envelope);
      expect([w.posts, await w.ext.local.get(PRESALE_RECORDS_KEY)]).toEqual([[], undefined]);
    }
  });

  it('two purchases, one recorded and one not: only the missing one is added, after the present one', async () => {
    const other = purchase({id: 'buy2', signature: SIG2, createdAt: CREATED});
    const present = entry({nextAt: T0 + HOUR, state: 'done'});
    const w = await woken([purchase(), other], [present]);
    expect((await entries(w)).map(e => [e.signature, e.state])).toEqual([
      [SIG, 'done'],
      [SIG2, 'done'],
    ]);
    expect(w.posts.map(p => (p.body as PresaleRecordPayload).txHash)).toEqual([SIG2]);
  });
});

describe('the store (§2.4): at most 50, read strictly', () => {
  const sig = (n: number) => fakeSig(1000 + n);
  const nth = (n: number, state: PresaleRecordEntry['state']) => entry({signature: sig(n), payload: {...PAYLOAD, txHash: sig(n)}, state, nextAt: T0 + HOUR});
  const fill = (states: PresaleRecordEntry['state'][]) => states.map((s, i) => nth(i, s));

  it('the 51st drops the oldest accepted entry first, then the oldest given up, then refused, then due', async () => {
    const order: [PresaleRecordEntry['state'][], number][] = [
      [['due', 'refused', 'given-up', 'done', 'done', ...Array<PresaleRecordEntry['state']>(45).fill('due')], 3],
      [['due', 'refused', 'given-up', 'given-up', ...Array<PresaleRecordEntry['state']>(46).fill('due')], 2],
      [['due', 'refused', 'refused', ...Array<PresaleRecordEntry['state']>(47).fill('due')], 1],
      [Array<PresaleRecordEntry['state']>(50).fill('due'), 0],
    ];
    for (const [states, dropped] of order) {
      const w = world();
      await w.ext.local.set(PRESALE_RECORDS_KEY, fill(states));
      w.deps.clock.t = T0 - 1;
      await recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase());
      const after = await entries(w);
      expect(after).toHaveLength(MAX_PRESALE_RECORDS);
      expect([dropped, after.some(e => e.signature === sig(dropped)), after.at(-1)?.signature]).toEqual([dropped, false, SIG]);
    }
  });

  it('what does not read back is dropped; the rest is kept, as fresh objects', async () => {
    const w = world();
    const good = entry({nextAt: T0 + HOUR});
    const bad: unknown[] = [
      {...good, extra: 1},
      {...good, state: 'pending'},
      {...good, attempts: -1},
      {...good, nextAt: 1.5},
      {...good, signature: SIG2},
      {...good, account: RECIPIENT},
      {...good, payload: {...PAYLOAD, paymentAmount: 2}},
      {...good, payload: {...PAYLOAD, stage: 0}},
      {...good, payload: {...PAYLOAD, nocAmount: Number.NaN}},
      {...good, payload: {...PAYLOAD, referrerAddress: undefined, extra: 1}},
      'x',
      null,
    ];
    await w.ext.local.set(PRESALE_RECORDS_KEY, [...bad, good, {...good, signature: SIG2, payload: {...PAYLOAD, txHash: SIG2, referrerAddress: RECIPIENT}}]);
    const read = await entries(w);
    expect(read).toEqual([good, {...good, signature: SIG2, payload: {...PAYLOAD, txHash: SIG2, referrerAddress: RECIPIENT}}]);
    read[0]!.payload.stage = 7;
    expect((await entries(w))[0]?.payload.stage).toBe(1);
    await w.ext.local.set(PRESALE_RECORDS_KEY, {not: 'a list'});
    expect(await entries(w)).toEqual([]);
  });
});

describe('a delete wipes the records, a restore keeps them (§2.4: WALLET_DATA_KEYS)', () => {
  const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
  const STORED = {
    v: 1,
    scheme: 'slip10',
    kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
    seed: {iv: B(12, 2), ct: B(48, 3)},
    password: {wrapped: B(40, 4)},
    accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT}],
  };
  const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
  const zero = () => fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});
  async function stored(w: World) {
    await w.ext.local.set(VAULT_KEY, STORED);
    await unlocked(w.ext);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry({nextAt: T0 + HOUR})]);
    w.deps.reader = zero();
  }

  it('a delete removes them; a restore (the same wallet, a new password) keeps them', async () => {
    const del = world();
    await stored(del);
    expect(await forgetWallet(del.ext, del.deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await del.ext.local.get(PRESALE_RECORDS_KEY)).toBeUndefined();
    const restore = world();
    await stored(restore);
    expect(await forgetWallet(restore.ext, restore.deps, {expectedRevision: REV, replacement: {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}}})).toBe('forgotten');
    expect(await entries(restore)).toEqual([entry({nextAt: T0 + HOUR})]);
  });

  it('a first write (a crashed delete left them) removes them too', async () => {
    const w = world();
    await w.ext.local.set(PRESALE_RECORDS_KEY, [entry()]);
    expect(await storeEnvelope(w.ext, null, STORED)).toBe('stored');
    expect(await w.ext.local.get(PRESALE_RECORDS_KEY)).toBeUndefined();
  });

  it('a record write parked mid-write when the delete arrives: the delete waits, and nothing of it is left after forgotten', async () => {
    const w = world();
    await stored(w);
    let release = (): void => undefined;
    const gate = new Promise<void>(r => {
      release = r;
    });
    const set = w.ext.local.set;
    w.ext.local.set = async (k, v) => {
      if (k === PRESALE_RECORDS_KEY) await gate;
      await set(k, v);
    };
    const writing = recordConfirmedPurchase({ext: w.ext, deps: w.deps}, purchase({signature: SIG2}));
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
    const forgetting = forgetWallet(w.ext, w.deps, {expectedRevision: REV});
    for (let i = 0; i < 20; i++) await new Promise(r => setTimeout(r, 0));
    release();
    await writing;
    expect(await forgetting).toBe('forgotten');
    await runPresaleRecords(w.ext, w.deps);
    expect([await w.ext.local.get(PRESALE_RECORDS_KEY), w.posts]).toEqual([undefined, []]);
  });
});

describe('presale.unrecorded {account} (§1.4, §4.6, D29): what #27 shows Q34 for — no network', () => {
  const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
  const POPUP = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/popup.html`};
  const sig = (n: number) => fakeSig(2000 + n);
  const of = (n: number, state: PresaleRecordEntry['state'], account = ACCOUNT) => entry({signature: sig(n), account, payload: {...PAYLOAD, txHash: sig(n), buyerAddress: account}, state});
  const ask = (w: World, msg: Record<string, unknown>) => handleMessage(w.ext, msg, POPUP, w.deps);

  it('this account’s due, given-up and refused records, in order; not an accepted one, not another account’s', async () => {
    const w = world([new Error('no POST from a read')]);
    w.deps.reader = fakeReader();
    await unlocked(w.ext);
    await w.ext.local.set(PRESALE_RECORDS_KEY, [of(0, 'due'), of(1, 'done'), of(2, 'given-up'), of(3, 'refused', RECIPIENT), of(4, 'refused')]);
    expect(await ask(w, {type: 'presale.unrecorded', account: ACCOUNT})).toEqual({ok: true, data: [sig(0), sig(2), sig(4)]});
    await w.ext.local.set(PRESALE_RECORDS_KEY, [of(1, 'done')]);
    expect(await ask(w, {type: 'presale.unrecorded', account: ACCOUNT})).toEqual({ok: true, data: []});
    expect(w.posts).toEqual([]);
  });

  it('strict payload, then the session: malformed, locked, unknown-account', async () => {
    const w = world();
    for (const m of [{type: 'presale.unrecorded'}, {type: 'presale.unrecorded', account: 'nope'}, {type: 'presale.unrecorded', account: ACCOUNT, signature: SIG}]) expect(await ask(w, m)).toEqual({ok: false, error: 'malformed'});
    expect(await ask(w, {type: 'presale.unrecorded', account: ACCOUNT})).toEqual({ok: false, error: 'locked'});
    await unlocked(w.ext);
    expect(await ask(w, {type: 'presale.unrecorded', account: RECIPIENT})).toEqual({ok: false, error: 'unknown-account'});
  });
});
```

Create `extension/src/background/presale/__tests__/reconcileWindow.test.ts` (Review Focus 1 — the reconcile can only find what `v1_pending` still holds: both sides of the 20-record edge, the accepted gap pinned as behaviour):

```ts
import {readPresaleRecords, reconcilePresaleRecords, runPresaleRecords, unrecordedFor} from '../record';
import {readPending, updatePending, type PendingRecord} from '../../pendingStore';
import {VAULT_KEY} from '../../accountsStore';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {ACCOUNT as SESSION_ACCOUNT, pendingRecord, signedWire} from '../../__tests__/fixtures';
import {MAINNET_SOL_TREASURY} from '../../../../../core/presale/addresses';
import {firstSignature} from '../../../../../core/solana/broadcast';

// B1d §2.4, the controller's reconcile ruling and its accepted gap (the plan's Review Focus 1): the wake can only find
// what v1_pending still holds. A confirmed purchase whose entry the hook never wrote is recovered while it is among the
// 20 newest closed records (pendingStore's MAX_RECORDS, every kind and account counted); 20 newer ones push it out, and
// then nothing records it and #27 has no Q34 for it. Both sides of that edge are rows here, the numbers written out.

const ACCOUNT = SESSION_ACCOUNT.publicKey;
const SIG = firstSignature(signedWire(11n));
const T0 = 1_000_000;
const ENVELOPE = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT}]};
/** §2.3: a purchase's `extra.data` as the kind writes it — 2 SOL at stage 0, no referrer (record.test.ts's). */
const DATA = {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '1998667554963357', spentCents: '30000', destination: MAINNET_SOL_TREASURY, referrer: null};
const PURCHASE = pendingRecord({id: 'buy', account: ACCOUNT, signature: SIG, intent: null, state: 'confirmed', createdAt: T0 - 60_000, fee: {networkLamports: '5050', markupLamports: '0'}, extra: {kind: 'presale-buy', data: DATA}});
/** A later confirmed send of the same account — any closed record counts toward the 20. */
const send = (n: number): PendingRecord => pendingRecord({id: `send-${n}`, account: ACCOUNT, signature: `send-signature-${n}`, state: 'confirmed', createdAt: T0 + n});

/** The purchase confirmed with no entry (the worker stopped before the hook), then `newer` closed records, then a wake. */
async function wokenAfter(newer: number) {
  const ext = fakeExt();
  const posts: unknown[] = [];
  const deps = fakeDeps({postJson: async (_path, body) => (posts.push(body), {status: 200, body: {success: true}})});
  deps.clock.t = T0;
  await ext.local.set(VAULT_KEY, ENVELOPE);
  await updatePending(ext, records => [...records, PURCHASE]);
  for (let n = 1; n <= newer; n++) await updatePending(ext, records => [...records, send(n)]);
  await reconcilePresaleRecords(ext, deps);
  await runPresaleRecords(ext, deps);
  const held = (await readPending(ext)).some(r => r.signature === SIG);
  return {held, posts: posts.length, entries: (await readPresaleRecords(ext)).map(e => [e.signature, e.state]), unrecorded: await unrecordedFor(ext, ACCOUNT)};
}

describe('the reconcile window (§2.4, the accepted gap): only what v1_pending still holds is reconciled', () => {
  it('19 newer closed records: the purchase is still held — reconciled, POSTed once, done (positive control)', async () => {
    expect(await wokenAfter(19)).toEqual({held: true, posts: 1, entries: [[SIG, 'done']], unrecorded: []});
  });

  it('20 newer closed records push it out: nothing reconciled, nothing POSTed, no entry — so #27 has no Q34 for it either', async () => {
    expect(await wokenAfter(20)).toEqual({held: false, posts: 0, entries: [], unrecorded: []});
  });
});
```

`fakeDeps.ts` — a POST fails loudly unless a test gives one:

```diff
diff --git a/extension/src/background/__tests__/fakeDeps.ts b/extension/src/background/__tests__/fakeDeps.ts
index 27255ca..f13d99e 100644
--- a/extension/src/background/__tests__/fakeDeps.ts
+++ b/extension/src/background/__tests__/fakeDeps.ts
@@ -28,8 +28,8 @@ export function fakeReader(overrides: Partial<SolanaReader> = {}): SolanaReader
 
 /**
  * Deterministic deps: a settable clock, counting random bytes, prices for SOL/USDC/USDT, a sleep
- * that never resolves (no poller runs unless a test asks for one), and a broadcast and a geo check
- * that fail unless a test overrides them.
+ * that never resolves (no poller runs unless a test asks for one), and a broadcast, a geo check and a
+ * POST that fail unless a test overrides them.
  */
 export function fakeDeps(overrides: Partial<WalletDeps> = {}): WalletDeps & {clock: {t: number}; broadcasts: Uint8Array[]} {
   const clock = {t: 1_000_000};
@@ -45,6 +45,9 @@ export function fakeDeps(overrides: Partial<WalletDeps> = {}): WalletDeps & {clo
     geo: async () => {
       throw new Error('unexpected geo check');
     },
+    postJson: async path => {
+      throw new Error(`unexpected POST ${path}`);
+    },
     now: () => clock.t,
     randomBytes: n => {
       counter += 1;
```

`deps.test.ts` — the poster, its latch, its timeout (B1b's `timedFetch`):

```diff
diff --git a/extension/src/background/__tests__/deps.test.ts b/extension/src/background/__tests__/deps.test.ts
index 93d08bc..62f6913 100644
--- a/extension/src/background/__tests__/deps.test.ts
+++ b/extension/src/background/__tests__/deps.test.ts
@@ -1,8 +1,8 @@
-import {BROADCAST_TIMEOUT_MS, FORBIDDEN_UNTIL_KEY, REQUEST_TIMEOUT_MS, RequestTimedOut, browserDeps, createJsonGetter, stagePriceFrom, timedFetch} from '../deps';
+import {BROADCAST_TIMEOUT_MS, FORBIDDEN_UNTIL_KEY, REQUEST_TIMEOUT_MS, RequestTimedOut, browserDeps, createJsonGetter, createJsonPoster, stagePriceFrom, timedFetch} from '../deps';
 import {submitSigned} from '../pending';
 import {PENDING_KEY} from '../pendingStore';
 import {fakeDeps} from './fakeDeps';
-import {FORBIDDEN_COOLDOWN_MS, RpcCoolingDown, RpcForbidden, createForbiddenLatch, createRpc, type FetchInit} from '../../../../core/solana/rpc';
+import {FORBIDDEN_COOLDOWN_MS, RequestUnreachable, RpcCoolingDown, RpcForbidden, createForbiddenLatch, createRpc, type FetchInit} from '../../../../core/solana/rpc';
 import {fakeExt} from './fakeExt';
 import {ACCOUNT, RECIPIENT, signedWire} from './fixtures';
 
@@ -26,6 +26,47 @@ describe('createJsonGetter', () => {
   });
 });
 
+// B1d §2.4: the record's POST — generic, beside the getter, through the same latch; every status answered with its body.
+describe('createJsonPoster', () => {
+  it('POSTs the JSON body to API_BASE + path without credentials, and answers each status with its body (positive control)', async () => {
+    for (const [status, body] of [[200, {success: true, verified: false}], [400, {success: false, error: 'Transaction failed on-chain'}], [429, {error: 'Too many purchase attempts, please wait'}], [500, {success: false, error: 'boom'}]] as const) {
+      const calls: {url: string; init: FetchInit}[] = [];
+      const post = createJsonPoster(async (url, init) => (calls.push({url, init}), {status, json: async () => body}), createForbiddenLatch());
+      expect(await post.post('/solana/purchase', {txHash: 'x', nocAmount: 1.5, paymentAmount: '0.25'})).toEqual({status, body});
+      expect(calls).toEqual([
+        {
+          url: 'https://api.noc-tura.io/api/v1/solana/purchase',
+          init: {method: 'POST', headers: {'content-type': 'application/json'}, body: '{"txHash":"x","nocAmount":1.5,"paymentAmount":"0.25"}', credentials: 'omit'},
+        },
+      ]);
+    }
+  });
+
+  it('a body that is not JSON (a proxy’s page) is answered as null with its status — never thrown away', async () => {
+    const post = createJsonPoster(async () => ({status: 502, json: async () => Promise.reject(new SyntaxError('Unexpected token <'))}), createForbiddenLatch());
+    expect(await post.post('/solana/purchase', {})).toEqual({status: 502, body: null});
+  });
+
+  it('a body that never arrives is no answer (RequestUnreachable), not a null body', async () => {
+    const post = createJsonPoster(async url => ({status: 200, json: async () => Promise.reject(new RequestTimedOut(url, REQUEST_TIMEOUT_MS))}), createForbiddenLatch());
+    await expect(post.post('/solana/purchase', {})).rejects.toBeInstanceOf(RequestTimedOut);
+    const refused = createJsonPoster(async url => Promise.reject(new RequestUnreachable(url, 'offline')), createForbiddenLatch());
+    await expect(refused.post('/solana/purchase', {})).rejects.toBeInstanceOf(RequestUnreachable);
+  });
+
+  it('a 403 trips the one latch the getter and the RPC share: RpcForbidden, then nothing is sent anywhere during the cool-down', async () => {
+    let requests = 0;
+    const fetch = async () => (requests++, {status: 403, json: async () => null});
+    const latch = createForbiddenLatch();
+    const post = createJsonPoster(fetch, latch);
+    await expect(post.post('/solana/purchase', {})).rejects.toBeInstanceOf(RpcForbidden);
+    await expect(post.post('/solana/purchase', {})).rejects.toBeInstanceOf(RpcCoolingDown);
+    await expect(createJsonGetter(fetch, latch).get('/stats')).rejects.toBeInstanceOf(RpcCoolingDown);
+    await expect(createRpc({fetch, latch}).call('getBlockHeight', [])).rejects.toBeInstanceOf(RpcCoolingDown);
+    expect(requests).toBe(1);
+  });
+});
+
 describe('browserDeps (review M3: the cool-down survives a restarted worker)', () => {
   afterEach(() => vi.unstubAllGlobals());
 
@@ -54,6 +95,18 @@ describe('browserDeps (review M3: the cool-down survives a restarted worker)', (
     expect(urls).toEqual(['https://api.noc-tura.io/api/v1/wallet/prices?ids=solana,usd-coin,tether']);
   });
 
+  it('postJson goes through the same latch: a 403 on the record route silences the RPC; the RPC’s 403 silences the record route', async () => {
+    const urls: string[] = [];
+    vi.stubGlobal('fetch', async (url: string) => (urls.push(url), {status: 403, json: async () => null}));
+    const deps = browserDeps(fakeExt());
+    await expect(deps.postJson('/solana/purchase', {})).rejects.toBeInstanceOf(RpcForbidden);
+    await expect(deps.reader.getBlockHeight()).rejects.toBeInstanceOf(RpcCoolingDown);
+    const other = browserDeps(fakeExt());
+    await expect(other.reader.getBlockHeight()).rejects.toBeInstanceOf(RpcForbidden);
+    await expect(other.postJson('/solana/purchase', {})).rejects.toBeInstanceOf(RpcCoolingDown);
+    expect(urls).toEqual(['https://api.noc-tura.io/api/v1/solana/purchase', 'https://api.noc-tura.io/api/v1/rpc']);
+  });
+
   it('reads the NOC stage price from /stats (owner decision B)', async () => {
     const urls: string[] = [];
     vi.stubGlobal('fetch', async (url: string) => (urls.push(url), {status: 200, json: async () => ({success: true, data: {currentStage: 1, totalNocSold: 0, isPaused: false}})}));
@@ -169,6 +222,21 @@ describe('browserDeps request timeouts (CrowdSec answers some users with silence
     expect(await settled).toBeInstanceOf(RequestTimedOut);
   });
 
+  it('the record’s POST times out the same way, and is aborted', async () => {
+    vi.useFakeTimers();
+    const f = silentThenAnswering();
+    const settled = browserDeps(fakeExt())
+      .postJson('/solana/purchase', {txHash: 'x'})
+      .then(
+        () => 'resolved',
+        (e: unknown) => e,
+      );
+    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
+    expect(await settled).toBeInstanceOf(RequestTimedOut);
+    expect(f.signals[0]?.aborted).toBe(true);
+    expect(f.bodies).toEqual(['{"txHash":"x"}']);
+  });
+
   it('a silent broadcast gets BROADCAST_TIMEOUT_MS, and a timed-out first broadcast leaves the record pending, not failed', async () => {
     expect(BROADCAST_TIMEOUT_MS).toBeGreaterThan(REQUEST_TIMEOUT_MS);
     vi.useFakeTimers();
```

`intents.test.ts` (both builds) — the hook's contract, with a kind of this file's own:

```diff
diff --git a/extension/src/background/__tests__/intents.test.ts b/extension/src/background/__tests__/intents.test.ts
index 8e28cc1..f9d95c8 100644
--- a/extension/src/background/__tests__/intents.test.ts
+++ b/extension/src/background/__tests__/intents.test.ts
@@ -6,16 +6,17 @@ import {PREPARED_TTL_MS, SEND_INTENT, parseIntent, peekPrepared, preparedFor, pr
 import {sendPrepared} from '../send';
 import {challengeInfo, challengeSatisfied, issueChallenge, rebaseKindChallenge, satisfyChallenge} from '../reauthChallenges';
 import {PREPARED_KEY, REAUTH_KEY, clearSession} from '../session';
-import {PENDING_KEY, markDue, readPending} from '../pendingStore';
+import {PENDING_KEY, markDue, readPending, type PendingRecord} from '../pendingStore';
 import {pollOnce, recordDappSend} from '../pending';
-import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
+import {KNOWN_RECIPIENTS_KEY, knownRecipients} from '../knownRecipients';
+import {VAULT_KEY} from '../accountsStore';
 import {handleWallet} from '../walletApi';
 import {randomId} from '../digest';
 import {SendRefused, type SendIntent} from '../sendTypes';
 import {WALLET_TOKENS} from '../../../../core/solana/balances';
 import {registerPresale} from '../presale/api';
 import {firstSignature} from '../../../../core/solana/broadcast';
-import {fakeDeps} from './fakeDeps';
+import {fakeDeps, fakeReader} from './fakeDeps';
 import {fakeExt} from './fakeExt';
 import {ACCOUNT, RECIPIENT, SETTINGS_ABOUT, pendingRecord, sendReader, signedWire, unlocked} from './fixtures';
 
@@ -108,7 +109,7 @@ describe('the intent-kind registry (B1d §1.3, C19)', () => {
   it(`send is registered by prepare.ts itself; ${off ? 'no other kind in the build without presale' : 'presale-buy when the presale entry module loads (B1d-1b Task 2)'}; registerPresale adds none`, () => {
     expect(intentKind(SEND_KIND)).toBe(SEND_INTENT);
     const before = registeredKinds();
-    registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: () => undefined});
+    registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: () => undefined, alarm: () => undefined});
     expect(registeredKinds()).toEqual(before);
     // This file's own kinds are named test-…; besides them, send and — with presale — the purchase.
     expect(before.filter(k => !k.startsWith('test-'))).toEqual(off ? ['send'] : ['send', 'presale-buy']);
@@ -478,3 +479,105 @@ describe('one in-flight transaction per account, a purchase included (C10)', ()
     expect(deps.broadcasts).toHaveLength(1);
   });
 });
+
+/** B1d §1.3: a kind with a hook — what it was called with, in order; `hookFails` makes it throw. */
+const hooked: {record: PendingRecord; host: KindHost}[] = [];
+const hookControl = {fails: false};
+registerIntentKind<TestIntent>({
+  ...TEST_BUY,
+  kind: 'test-hook',
+  onConfirmed: async (host, record) => {
+    hooked.push({record, host});
+    if (hookControl.fails) throw new Error('the hook failed');
+  },
+});
+
+describe('onConfirmed (B1d §1.3): the poller calls a kind’s hook once, when the record first reaches confirmed', () => {
+  const ENVELOPE = {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT.publicKey}]};
+  const own = (over: Partial<PendingRecord> = {}): PendingRecord =>
+    pendingRecord({id: 'hook', account: ACCOUNT.publicKey, signature: 'sig-hook', intent: null, fee: {networkLamports: '5050', markupLamports: '0'}, extra: {kind: 'test-hook', data: {amount: '1'}}, ...over});
+  const statuses = (s: {err: unknown; confirmationStatus: 'processed' | 'confirmed' | 'finalized'} | null) => fakeReader({getSignatureStatuses: async sigs => sigs.map(() => s), getBlockHeight: async () => 900});
+  const CONFIRMED = {err: null, confirmationStatus: 'confirmed' as const};
+  async function world(records: PendingRecord[], envelope: unknown = ENVELOPE) {
+    const ext = fakeExt();
+    if (envelope !== null) await ext.local.set(VAULT_KEY, envelope);
+    await ext.local.set(PENDING_KEY, records);
+    return ext;
+  }
+  beforeEach(() => {
+    hooked.length = 0;
+    hookControl.fails = false;
+  });
+
+  it('confirmed: called once, with the confirmed record and the poller’s own ext and deps — a second round calls nothing (positive control)', async () => {
+    const ext = await world([own()]);
+    const deps = fakeDeps({reader: statuses(CONFIRMED)});
+    expect(await pollOnce(ext, deps)).toBe(false);
+    expect(hooked).toEqual([{record: {...own(), state: 'confirmed'}, host: {ext, deps}}]);
+    expect(hooked[0]?.host.ext).toBe(ext);
+    expect(hooked[0]?.host.deps).toBe(deps);
+    await pollOnce(ext, deps);
+    expect(hooked).toHaveLength(1);
+  });
+
+  it('confirmed past its expiry through the full-history check: called too', async () => {
+    const ext = await world([own({lastValidBlockHeight: 100})]);
+    let call = 0;
+    const deps = fakeDeps({reader: fakeReader({getSignatureStatuses: async sigs => sigs.map(() => (call++ === 0 ? null : CONFIRMED)), getBlockHeight: async () => 900})});
+    await pollOnce(ext, deps);
+    expect(hooked.map(h => [h.record.signature, h.record.state])).toEqual([['sig-hook', 'confirmed']]);
+  });
+
+  it('not landed, processed only, landed with an error or expired: never called', async () => {
+    for (const s of [null, {err: null, confirmationStatus: 'processed' as const}, {err: {InstructionError: [2, {Custom: 1}]}, confirmationStatus: 'confirmed' as const}]) {
+      const ext = await world([own()]);
+      await pollOnce(ext, fakeDeps({reader: statuses(s)}));
+    }
+    const expiring = await world([own({lastValidBlockHeight: 100, expiryNullSeenAt: 0})]);
+    const deps = fakeDeps({reader: statuses(null)});
+    deps.clock.t = 10_000;
+    await pollOnce(expiring, deps);
+    expect((await readPending(expiring))[0]?.state).toBe('expired');
+    expect(hooked).toEqual([]);
+  });
+
+  it('only for its own kind: a kind without a hook, a send and a dApp record confirm with no call; beside them the hooked one is called once', async () => {
+    const noHook = own({id: 'plain', signature: 'sig-plain', extra: {kind: 'test-buy', data: {amount: '1'}}});
+    const unregistered = own({id: 'gone', signature: 'sig-gone', extra: {kind: 'no-such-kind', data: null}});
+    const send = pendingRecord({id: 'send', account: ACCOUNT.publicKey, signature: 'sig-send', intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
+    const dapp = pendingRecord({id: 'dapp', account: ACCOUNT.publicKey, signature: 'sig-dapp', intent: null, origin: 'https://jup.ag'});
+    const ext = await world([noHook, unregistered, send, dapp, own()]);
+    expect(await pollOnce(ext, fakeDeps({reader: statuses(CONFIRMED)}))).toBe(false);
+    expect((await readPending(ext)).map(r => r.state)).toEqual(['confirmed', 'confirmed', 'confirmed', 'confirmed', 'confirmed']);
+    expect(hooked.map(h => h.record.id)).toEqual(['hook']);
+  });
+
+  it('only for an account of the wallet stored now (as known recipients, review M1): no wallet, or another wallet — no call', async () => {
+    for (const envelope of [null, {...ENVELOPE, accounts: [{index: 0, name: 'Other', publicKey: RECIPIENT}]}]) {
+      const ext = await world([own()], envelope);
+      await pollOnce(ext, fakeDeps({reader: statuses(CONFIRMED)}));
+      expect((await readPending(ext))[0]?.state).toBe('confirmed');
+    }
+    expect(hooked).toEqual([]);
+  });
+
+  it('a hook that throws changes nothing the poller does: the record confirmed, a send beside it still makes its recipient known, a warning', async () => {
+    hookControl.fails = true;
+    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
+    const send = pendingRecord({id: 'send', account: ACCOUNT.publicKey, signature: 'sig-send', intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
+    const ext = await world([own(), send]);
+    expect(await pollOnce(ext, fakeDeps({reader: statuses(CONFIRMED)}))).toBe(false);
+    expect((await readPending(ext)).map(r => r.state)).toEqual(['confirmed', 'confirmed']);
+    expect([...(await knownRecipients(ext))]).toEqual([RECIPIENT]);
+    expect(hooked).toHaveLength(1);
+    expect(warn).toHaveBeenCalledWith('a confirmed record’s hook failed', expect.any(Error));
+    warn.mockRestore();
+  });
+
+  it('two rounds racing (the 30 s alarm beside the loop) see it confirmed once: one call', async () => {
+    const ext = await world([own()]);
+    const deps = fakeDeps({reader: statuses(CONFIRMED)});
+    await Promise.all([pollOnce(ext, deps), pollOnce(ext, deps)]);
+    expect(hooked).toHaveLength(1);
+  });
+});
```

`pendingKinds.test.ts` (both builds) — the records are the wallet's data in the build without presale too:

```diff
diff --git a/extension/src/background/__tests__/pendingKinds.test.ts b/extension/src/background/__tests__/pendingKinds.test.ts
index a612023..5be858c 100644
--- a/extension/src/background/__tests__/pendingKinds.test.ts
+++ b/extension/src/background/__tests__/pendingKinds.test.ts
@@ -5,7 +5,8 @@ import {EXPIRY_MARGIN_BLOCKS, POLL_INTERVAL_MS, pollOnce, resend, submitSigned}
 import {prepareSend} from '../prepare';
 import {handleWallet} from '../walletApi';
 import {knownRecipients} from '../knownRecipients';
-import {VAULT_KEY} from '../accountsStore';
+import {VAULT_KEY, WALLET_DATA_KEYS, storeEnvelope} from '../accountsStore';
+import {PRESALE_RECORDS_KEY} from '../presaleRecordsKey';
 import {firstSignature} from '../../../../core/solana/broadcast';
 import type {SignatureStatus} from '../../../../core/solana/rpc';
 import {fakeDeps, fakeReader} from './fakeDeps';
@@ -226,3 +227,18 @@ describe('the poller, expiry, resend and wallet.pending are kind-agnostic (B1d 
     expect(r).toEqual({ok: true, data: [viewOf(PURCHASE)]});
   });
 });
+
+// B1d §2.4 (C19): an update that turns presale off must not leave a deleted wallet's presale records behind — the key
+// and its wipe are shared code, so this holds in both builds (this file runs in both vitest runs).
+describe('the presale records are the wallet’s data in both builds', () => {
+  it('v1_presale_records is one of WALLET_DATA_KEYS, and a first write (what a delete leaves) removes it', async () => {
+    expect(PRESALE_RECORDS_KEY).toBe('v1_presale_records');
+    expect(WALLET_DATA_KEYS).toContain(PRESALE_RECORDS_KEY);
+    const ext = fakeExt();
+    await ext.local.set(PRESALE_RECORDS_KEY, [{signature: 's', state: 'due'}]);
+    const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
+    const envelope = {v: 1, scheme: 'slip10', kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)}, seed: {iv: B(12, 2), ct: B(48, 3)}, password: {wrapped: B(40, 4)}, accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}]};
+    expect(await storeEnvelope(ext, null, envelope)).toBe('stored');
+    expect(await ext.local.get(PRESALE_RECORDS_KEY)).toBeUndefined();
+  });
+});
```

`start.test.ts` — the start resumes a due record; the start reconciles a purchase whose entry was never written; the alarm reaches the retry; a presale alarm never takes a shared name:

```diff
diff --git a/extension/src/background/__tests__/start.test.ts b/extension/src/background/__tests__/start.test.ts
index 1f4946a..bff858e 100644
--- a/extension/src/background/__tests__/start.test.ts
+++ b/extension/src/background/__tests__/start.test.ts
@@ -129,6 +129,129 @@ describe('background start', () => {
     }
   });
 
+  // B1d-2 (§2.4): the presale entry's record retry — resumed at every start, and woken by its own alarm through index.ts.
+  it('a start resumes a due presale record (one POST to the record route), and the presale-record alarm runs the retry again', async () => {
+    const SIG = '5'.repeat(88);
+    const payload = {txHash: SIG, buyerAddress: '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4', paymentToken: 'SOL', paymentAmount: '2', nocAmount: 1998.5, usdValue: 300, stage: 1};
+    const due = () => ({signature: SIG, account: payload.buyerAddress, payload, confirmedAt: Date.now(), attempts: 0, nextAt: 0, state: 'due'});
+    const local = new Map<string, unknown>([['v1_presale_records', [due()]]]);
+    const created: string[] = [];
+    let onAlarm: ((a: {name: string}) => void) | undefined;
+    const posts: string[] = [];
+    // A stubbed fetch: nothing here leaves the process.
+    vi.stubGlobal('fetch', async (url: string, init: {body?: string}) => {
+      posts.push(`${url} ${init.body ?? ''}`);
+      return {status: 500, json: async () => ({success: false, error: 'boom'})};
+    });
+    const on = () => ({addListener: () => undefined});
+    vi.stubGlobal('chrome', {
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onConnect: on(), onStartup: on(), onInstalled: on()},
+      tabs: {create: async () => undefined},
+      storage: {
+        session: {get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined, setAccessLevel: async () => undefined},
+        local: {
+          get: async (k: string) => (local.has(k) ? {[k]: local.get(k)} : {}),
+          set: async (items: Record<string, unknown>) => {
+            for (const [k, v] of Object.entries(items)) local.set(k, v);
+          },
+          remove: async (k: string) => void local.delete(k),
+          clear: async () => local.clear(),
+        },
+      },
+      alarms: {create: (name: string) => void created.push(name), clear: async () => true, onAlarm: {addListener: (cb: (a: {name: string}) => void) => void (onAlarm = cb)}},
+      windows: {getAll: async () => [], onRemoved: on()},
+    });
+    const settle = async () => {
+      for (let i = 0; i < 50; i++) await new Promise(r => setTimeout(r, 0));
+    };
+    await import('../index');
+    await settle();
+    expect(posts).toEqual([`https://api.noc-tura.io/api/v1/solana/purchase ${JSON.stringify(payload)}`]);
+    expect(created).toEqual(['presale-record']);
+    expect(local.get('v1_presale_records')).toMatchObject([{attempts: 1, state: 'due'}]);
+    // Another alarm's name runs nothing of it; its own runs the retry of what is due now.
+    local.set('v1_presale_records', [due()]);
+    onAlarm?.({name: 'autolock-not-presale'});
+    await settle();
+    expect(posts).toHaveLength(1);
+    onAlarm?.({name: 'presale-record'});
+    await settle();
+    expect(posts).toHaveLength(2);
+  });
+
+  // Controller ruling (B1d-2 Task 1): a purchase confirmed while the worker stopped before its entry was written.
+  it('a start reconciles a confirmed purchase the hook never recorded: its entry written, then one POST', async () => {
+    const buyer = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
+    const SIG = '5'.repeat(88);
+    const purchase = {
+      id: 'buy',
+      account: buyer,
+      signature: SIG,
+      wire: 'AQ==',
+      lastValidBlockHeight: 1000,
+      createdAt: Date.now() - 60_000,
+      lastSentAt: Date.now() - 60_000,
+      state: 'confirmed',
+      detail: null,
+      intent: null,
+      expiryNullSeenAt: null,
+      extra: {kind: 'presale-buy', data: {currency: 'SOL', amount: '2000000000', stage: '0', priceTicks: '1501', nocBase: '1998500000000', spentCents: '30000', destination: '11111111111111111111111111111111', referrer: null}},
+    };
+    const local = new Map<string, unknown>([
+      ['v1_vault', {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: buyer}]}],
+      ['v1_pending', [purchase]],
+    ]);
+    const posts: string[] = [];
+    // A stubbed fetch: nothing here leaves the process.
+    vi.stubGlobal('fetch', async (url: string, init: {body?: string}) => {
+      posts.push(`${url} ${init.body ?? ''}`);
+      return {status: 200, json: async () => ({success: true, verified: true, duplicate: false, data: null})};
+    });
+    const on = () => ({addListener: () => undefined});
+    vi.stubGlobal('chrome', {
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onConnect: on(), onStartup: on(), onInstalled: on()},
+      tabs: {create: async () => undefined},
+      storage: {
+        session: {get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined, setAccessLevel: async () => undefined},
+        local: {
+          get: async (k: string) => (local.has(k) ? {[k]: local.get(k)} : {}),
+          set: async (items: Record<string, unknown>) => {
+            for (const [k, v] of Object.entries(items)) local.set(k, v);
+          },
+          remove: async (k: string) => void local.delete(k),
+          clear: async () => local.clear(),
+        },
+      },
+      alarms: {create: () => undefined, clear: async () => true, onAlarm: on()},
+      windows: {getAll: async () => [], onRemoved: on()},
+    });
+    await import('../index');
+    for (let i = 0; i < 50; i++) await new Promise(r => setTimeout(r, 0));
+    expect(posts).toEqual([`https://api.noc-tura.io/api/v1/solana/purchase ${JSON.stringify({txHash: SIG, buyerAddress: buyer, paymentToken: 'SOL', paymentAmount: '2', nocAmount: 1998.5, usdValue: 300, stage: 1})}`]);
+    expect(local.get('v1_presale_records')).toMatchObject([{signature: SIG, confirmedAt: purchase.createdAt, attempts: 1, state: 'done'}]);
+  });
+
+  it('a presale alarm never takes a shared alarm’s name: the start refuses it', async () => {
+    vi.doMock('../presale/api', () => ({
+      PRESALE_MESSAGE_TYPES: [],
+      registerPresale: (host: {alarm(name: string, run: () => Promise<void>): void}) => host.alarm('pending-poll', async () => undefined),
+    }));
+    const on = () => ({addListener: () => undefined});
+    const area = () => ({get: async () => ({}), set: async () => undefined, remove: async () => undefined, clear: async () => undefined});
+    vi.stubGlobal('chrome', {
+      runtime: {id: 'x', getURL: (p: string) => `https://ext.example/${p}`, onMessage: on(), onConnect: on(), onStartup: on(), onInstalled: on()},
+      tabs: {create: async () => undefined},
+      storage: {session: {...area(), setAccessLevel: async () => undefined}, local: area()},
+      alarms: {create: () => undefined, clear: async () => true, onAlarm: on()},
+      windows: {getAll: async () => [], onRemoved: on()},
+    });
+    try {
+      await expect(import('../index')).rejects.toThrow('registerPresale: the alarm pending-poll is taken');
+    } finally {
+      vi.doUnmock('../presale/api');
+    }
+  });
+
   it('starts no poller and arms no alarm when nothing is open', async () => {
     const created: string[] = [];
     const on = () => ({addListener: () => undefined});
```

The message lists (`messages.test.ts` both builds, `api.test.ts`, `presaleSwitch.test.ts`) and every `registerPresale` caller's `alarm`:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index 6390793..abd8c70 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -194,7 +194,7 @@ describe('message partitions', () => {
 
 // This file runs in both vitest runs (vitest.nopresale.config.ts marks the off one).
 const off = process.env.NOCTURA_PRESALE === '0';
-const PRESALE = off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared'];
+const PRESALE = off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded'];
 
 describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
@@ -291,7 +291,7 @@ describe('message partitions (B1b-1 types)', () => {
 });
 
 describe(`presale.* in the build ${off ? 'without' : 'with'} presale (B1d §1.1, §1.4)`, () => {
-  const TYPES = ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared'];
+  const TYPES = ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded'];
 
   it(off ? 'every presale type is refused as an unknown type, from the popup too' : 'every presale type is privileged: past the partition from the popup (positive control — no handler is registered in this file, so unavailable)', async () => {
     const ext = vaultExt();
```

```diff
diff --git a/extension/src/background/presale/__tests__/api.test.ts b/extension/src/background/presale/__tests__/api.test.ts
index 9d3b613..1cbe93c 100644
--- a/extension/src/background/presale/__tests__/api.test.ts
+++ b/extension/src/background/presale/__tests__/api.test.ts
@@ -15,7 +15,7 @@ import {ACCOUNT, CONFIG_PDA, NOW_MS, OTHER, allocationData, chainMap, chainReade
 // B1d §1.4, §2.5, §3.2 (C3, C8, C12, C30, C35): the three presale messages of B1d-1b Task 1, through the real
 // background's message handler — the partition, the strict payloads, the view in every variant with the open record
 // in each, the gate-only re-read, the quote from the last view's snapshot, the banner from the last config snapshot.
-registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});
+registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 const EXT = fakeExt();
 const ORIGIN = EXT.extensionOrigin;
@@ -113,8 +113,8 @@ const PURCHASE: PendingRecord = pendingRecord({
 const {wire: _wire, firstBroadcast: _firstBroadcast, ...PURCHASE_VIEW} = PURCHASE;
 
 describe('the partition (§1.4): the popup and the full tab only', () => {
-  it('the three types of B1d-1b Task 1, Task 2’s prepare and Task 3’s four, all privileged', () => {
-    expect(PRESALE_MESSAGE_TYPES).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared']);
+  it('the three types of B1d-1b Task 1, Task 2’s prepare, Task 3’s four and B1d-2’s presale.unrecorded, all privileged', () => {
+    expect(PRESALE_MESSAGE_TYPES).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded']);
   });
 
   it('answered from the popup and from the full tab (positive control)', async () => {
```

```diff
diff --git a/extension/src/__tests__/presaleSwitch.test.ts b/extension/src/__tests__/presaleSwitch.test.ts
index b20ab87..4ca09a4 100644
--- a/extension/src/__tests__/presaleSwitch.test.ts
+++ b/extension/src/__tests__/presaleSwitch.test.ts
@@ -25,8 +25,9 @@ describe(`the build-time switch in this run (${off ? 'off' : 'on'})`, () => {
   });
 
   it(off ? 'the stubs export empty values: no message type, no route, no slot, no description' : 'the entries export what B1d-1b has built so far, the stubs empty values', () => {
-    // B1d-1b: the background entry's message types (§1.4) — Task 1's three, Task 2's prepare, Task 3's four; the stub adds none.
-    expect(bgEntry.PRESALE_MESSAGE_TYPES).toEqual(off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared']);
+    // B1d-1b: the background entry's message types (§1.4) — Task 1's three, Task 2's prepare, Task 3's four; B1d-2's
+    // presale.unrecorded; the stub adds none.
+    expect(bgEntry.PRESALE_MESSAGE_TYPES).toEqual(off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded']);
     expect(bgStub.PRESALE_MESSAGE_TYPES).toEqual([]);
     // B1d-1b Tasks 4–6: the popup entry's routes — #23 (`presale`), #20's purchase variant (`presale-confirm`) and #50b
     // (`geo`) — and its slots (the record words, the resume, #11's banner and Buy); the stub adds none.
```

```diff
diff --git a/extension/src/background/presale/__tests__/buy.test.ts b/extension/src/background/presale/__tests__/buy.test.ts
index e8cbb32..091814e 100644
--- a/extension/src/background/presale/__tests__/buy.test.ts
+++ b/extension/src/background/presale/__tests__/buy.test.ts
@@ -64,7 +64,7 @@ import {
 } from './chain';
 import {ALLOCATION_RENT, USER_RENT, honestSimulation} from './simulation';
 
-registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});
+registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 // B1d §3.3, §3.4 (C2, C10, C11, C21, C23, C27, C28, C36, C39, D3): the purchase's prepare against the byte builders of
 // chain.ts and a simulation computed from the transaction it is given — the program's own effects on the accounts the
```

```diff
diff --git a/extension/src/app/__tests__/homePresale.test.tsx b/extension/src/app/__tests__/homePresale.test.tsx
index 2bcad40..c458069 100644
--- a/extension/src/app/__tests__/homePresale.test.tsx
+++ b/extension/src/app/__tests__/homePresale.test.tsx
@@ -16,7 +16,7 @@ import {purchaseWorld, type PurchaseWorld} from '../presale/__tests__/world';
 import {firstSignature} from '../../../../core/solana/broadcast';
 import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
 
-registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});
+registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 // B1d §4.5 (C30; §9's #11 row): #11's presale banner and Buy quick action in the whole App against the REAL background —
 // the program state from chain.ts, the gate as a dep. The banner is `presale.banner`'s (no geo check; null on any failure
```

```diff
diff --git a/extension/src/app/presale/__tests__/Geo.test.tsx b/extension/src/app/presale/__tests__/Geo.test.tsx
index 9116305..c850ccb 100644
--- a/extension/src/app/presale/__tests__/Geo.test.tsx
+++ b/extension/src/app/presale/__tests__/Geo.test.tsx
@@ -16,7 +16,7 @@ import {ACCOUNT, TREASURY_ADDRESS, configData, program, userData} from '../../..
 import {firstSignature} from '../../../../../core/solana/broadcast';
 import {purchaseWorld} from './world';
 
-registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});
+registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 // B1d §4.3 (C3, C12, C18; §9's #50b rows; Q20–Q30): #50b against the REAL background — presale.view over chain.ts's
 // program state with the gate's answer as a dep. Every reason as §4.3's table words it, the region card only where it
```

```diff
diff --git a/extension/src/app/presale/__tests__/Presale.test.tsx b/extension/src/app/presale/__tests__/Presale.test.tsx
index 4ea6804..1f7e4a5 100644
--- a/extension/src/app/presale/__tests__/Presale.test.tsx
+++ b/extension/src/app/presale/__tests__/Presale.test.tsx
@@ -22,7 +22,7 @@ import {RpcForbidden, type AccountData, type TokenAccountEntry} from '../../../.
 import type {Prices} from '../../../../../core/portfolio/value';
 import type {PurchaseView} from '../client';
 
-registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});
+registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 // B1d §4.1 (C3, C8, C17, C18, C30, C35, D5): #23 against the REAL background — handleMessage with the presale handlers,
 // the program state from chain.ts's byte builders, the gate and the prices as deps — rendered in happy-dom. Every
```

```diff
diff --git a/extension/src/app/presale/__tests__/PresaleConfirm.test.tsx b/extension/src/app/presale/__tests__/PresaleConfirm.test.tsx
index 2db7ecc..e3c51fd 100644
--- a/extension/src/app/presale/__tests__/PresaleConfirm.test.tsx
+++ b/extension/src/app/presale/__tests__/PresaleConfirm.test.tsx
@@ -17,7 +17,7 @@ import {ACCOUNT, TREASURY_ADDRESS, USDC_VAULT, allocationData, configData, progr
 import {firstSignature} from '../../../../../core/solana/broadcast';
 import {BOUGHT_BEFORE, preparePurchase, purchaseWorld, type PurchaseWorld} from './world';
 
-registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});
+registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 // B1d §4.2 (C25, C29, C33, D38, rule 6): #20's purchase variant against the REAL background — the purchase prepared by
 // presale.prepareBuy over chain.ts's program state and the honest simulation, signed by presale.buy through the shared
```

```diff
diff --git a/extension/src/app/presale/__tests__/client.test.ts b/extension/src/app/presale/__tests__/client.test.ts
index 8d50751..cdd374f 100644
--- a/extension/src/app/presale/__tests__/client.test.ts
+++ b/extension/src/app/presale/__tests__/client.test.ts
@@ -13,7 +13,7 @@ import {base64} from '@scure/base';
 import {ACCOUNT, NOW_MS, TREASURY_ADDRESS, chainMap, chainReader, configData, program, type Chain} from '../../../background/presale/__tests__/chain';
 import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
 
-registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});
+registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 // B1d §1.4, §2.5, §3.2, §3.3 (C3): the popup's presale client — its shape checks on the REAL background's answers
 // (positive controls), and every way a reply can be of another shape (failed, never shown).
```

```diff
diff --git a/extension/src/app/presale/__tests__/resume.test.tsx b/extension/src/app/presale/__tests__/resume.test.tsx
index d7d8551..8512d81 100644
--- a/extension/src/app/presale/__tests__/resume.test.tsx
+++ b/extension/src/app/presale/__tests__/resume.test.tsx
@@ -16,7 +16,7 @@ import {ACCOUNT} from '../../../background/presale/__tests__/chain';
 import {COUNTERPARTY} from '../../../../e2e/historyFixtures';
 import {BOUGHT_BEFORE, preparePurchase, purchaseWorld, type PurchaseWorld} from './world';
 
-registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});
+registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 // B1d §4.2 "Resume paths" (review M5; Task 3's ruling moved the popup half here): a purchase whose #10 was proven with
 // the popup closed resumes — the popup's hook (App.tsx) asks presale.preparedFor when wallet.preparedFor holds nothing,
```

The gates' tests:

```diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index 46815e3..45c8d20 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -26,7 +26,7 @@ const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
 const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/app.modules.0b79442.json'), 'utf8'));
 const map = ids => ({chunks: {'background.js': ids}});
 const without = (m, id) => ({...m, chunks: Object.fromEntries(Object.entries(m.chunks).map(([f, ids]) => [f, ids.filter(i => i !== id)]))});
-const SHARED = ['src/background/index.ts', 'src/background/intents.ts', 'src/background/geo/gate.ts', '../core/geo/fetch.ts', 'src/app/ui/regionName.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];
+const SHARED = ['src/background/index.ts', 'src/background/intents.ts', 'src/background/geo/gate.ts', '../core/geo/fetch.ts', 'src/app/ui/regionName.ts', 'src/background/presaleRecordsKey.ts', '../core/presale/addresses.ts', '../core/presale/allocation.ts', '../core/presale/stagePrices.ts', '../core/solana/encoding.ts'];
 
 // B1d §6.2 item 1 (C38, D15): the off build's module rule — an allowlist for core/presale/**, core/geo/** whole.
 describe('the off-build module rule', () => {
@@ -114,11 +114,12 @@ describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
       'src/app/presale/Geo.tsx',
       'core/presale/buyInstructions.ts',
       'core/presale/referrer.ts',
+      'src/background/presale/record.ts',
     ]);
   });
 
-  it('both builds must carry the intent-kind registry (Task 3), the jurisdiction gate with its fetcher (Task 6, D15) and the country name of #48’s F12 (B1d-1b Task 7)', () => {
-    expect(BOTH_BUILDS).toEqual(['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts', 'src/app/ui/regionName.ts']);
+  it('both builds must carry the intent-kind registry (Task 3), the jurisdiction gate with its fetcher (Task 6, D15), the country name of #48’s F12 (B1d-1b Task 7) and the presale records’ key (B1d-2 Task 1)', () => {
+    expect(BOTH_BUILDS).toEqual(['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts', 'src/app/ui/regionName.ts', 'src/background/presaleRecordsKey.ts']);
   });
 
   it('missingModules names each required module a map does not carry', () => {
@@ -163,7 +164,7 @@ describe('app.features.json', () => {
 describe('strings', () => {
   const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});
 
-  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker)', () => {
+  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm', () => {
     expect(MARKERS.slice(0, 9)).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale-buy']);
     // §6.2's named strings #23 shows, then Q01, Q02, Q04–Q06, Q11–Q16, Q19, Q40c, Q41c, Q41d, Q43, Q52 (each literal part ≥ 8 characters).
     expect(MARKERS.slice(9)).toEqual([
@@ -236,6 +237,9 @@ describe('strings', () => {
       'The restricted-region list is out of date.',
       'Your region could not be determined from your IP.',
       'The region check is unavailable — try again later.',
+      // B1d-2 Task 1: the record's message type and its alarm's name.
+      'presale.unrecorded',
+      'presale-record',
     ]);
   });
 
@@ -244,7 +248,7 @@ describe('strings', () => {
   it('every presale.* message type of api.ts is a marker', () => {
     const api = readFileSync(join(ROOT, 'src/background/presale/api.ts'), 'utf8');
     const types = [...(/PRESALE_MESSAGE_TYPES: readonly string\[\] = \[([^\]]*)\]/.exec(api)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
-    expect(types).toHaveLength(8);
+    expect(types).toHaveLength(9);
     for (const t of types) expect([t, MARKERS.includes(t)]).toEqual([t, true]);
   });
 
@@ -273,9 +277,10 @@ describe('strings', () => {
     // B1d-1b Task 7: #48's F12 (D15 — the off build blocks a site's purchase exactly as the on build does).
     const q50a = "This transaction buys NOC in the presale, which this wallet doesn't allow from your region (";
     const q50b = "This transaction buys NOC in the presale. The wallet's region check did not succeed, so it can't be approved — try again later.";
-    expect(MUST_STAY).toEqual(['Presale purchase', 'PRESALE PURCHASE', 'Transaction · pending', 'Transaction · taking longer than usual', 'Presale purchase blocked', q50a, q50b, 'Only Reject is available · no override']);
+    // B1d-2 Task 1: the presale records' key — a delete in the build without presale still wipes them.
+    expect(MUST_STAY).toEqual(['Presale purchase', 'PRESALE PURCHASE', 'Transaction · pending', 'Transaction · taking longer than usual', 'Presale purchase blocked', q50a, q50b, 'Only Reject is available · no override', 'v1_presale_records']);
     const f12 = file('chrome/approve.js', `"Presale purchase blocked",regionSanctioned:e=>\`${q50a}\${e}).\`,regionClosed:${JSON.stringify(q50b)},regionMeta:"Only Reject is available · no override"`);
-    const all = [file('app/a.js', '"Presale purchase"'), file('app/b.js', 'PRESALE PURCHASE'), file('app/c.js', '`Transaction · pending`,`Transaction · taking longer than usual`'), f12];
+    const all = [file('app/a.js', '"Presale purchase"'), file('app/b.js', 'PRESALE PURCHASE'), file('app/c.js', '`Transaction · pending`,`Transaction · taking longer than usual`'), f12, file('app/background.js', 'const Y="v1_presale_records";')];
     expect(missingStrings('off', all, MUST_STAY)).toEqual([]);
     expect(missingStrings('off', [file('app/a.js', '"Presale purchase"')], MUST_STAY)).toEqual([
       'off build: no file contains "PRESALE PURCHASE" — the switch stripped what both builds need',
@@ -285,6 +290,7 @@ describe('strings', () => {
       `off build: no file contains ${JSON.stringify(q50a)} — the switch stripped what both builds need`,
       `off build: no file contains ${JSON.stringify(q50b)} — the switch stripped what both builds need`,
       'off build: no file contains "Only Reject is available · no override" — the switch stripped what both builds need',
+      'off build: no file contains "v1_presale_records" — the switch stripped what both builds need',
     ]);
   });
```

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index 7e2414e..b32f897 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -399,6 +399,13 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
     expect(sourceViolations([f('src/app/screens/Contacts.tsx', "const k = 'v1_contacts';")])).toEqual([OWNED('src/app/screens/Contacts.tsx', 'v1_contacts')]);
     expect(sourceViolations([f('src/unlock/main.ts', '// v1_contacts')])).toEqual([OWNED('src/unlock/main.ts', 'v1_contacts')]);
   });
+  // B1d-2 (spec §2.4, §6.2): the presale records are the background's — in both builds (presaleRecordsKey.ts).
+  it('lets only the background name the presale records key (v1_presale_records)', () => {
+    const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
+    expect(sourceViolations([f('src/background/presaleRecordsKey.ts', "export const PRESALE_RECORDS_KEY = 'v1_presale_records';")])).toEqual([]);
+    expect(sourceViolations([f('src/app/presale/client.ts', "const k = 'v1_presale_records';")])).toEqual([OWNED('src/app/presale/client.ts', 'v1_presale_records')]);
+    expect(sourceViolations([f('src/unlock/presale.ts', '// v1_presale_records')])).toEqual([OWNED('src/unlock/presale.ts', 'v1_presale_records')]);
+  });
   // B1c §1.7 (review L13): src/approve is held like src/app — no storage, no runtime listener, no ext.ts — and its page
   // may load only its own entry.
   it('holds src/approve like src/app: no storage, no runtime listener, no ext.ts; approve.html loads only src/approve/main.tsx', () => {
```

The fake coordinator's record route and E2E 1's record:

```diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
index 3d74e15..8190aa6 100644
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -32,6 +32,7 @@ const PRICES = 'https://api.noc-tura.io/api/v1/wallet/prices';
 const STATS = 'https://api.noc-tura.io/api/v1/stats';
 const GEO_CHECK = 'https://api.noc-tura.io/api/v1/geo/check';
 const GEO_LIST = 'https://api.noc-tura.io/api/v1/geo/restricted-list';
+const PURCHASE_RECORD = 'https://api.noc-tura.io/api/v1/solana/purchase';
 /** rpcResult's answer for a method it does not implement (listed in `unexpected` too). */
 const METHOD_NOT_FOUND: unique symbol = Symbol('method not found');
 const SYSTEM_PROGRAM = '11111111111111111111111111111111';
@@ -110,6 +111,8 @@ export interface FakeCoordinator {
   geo: FakeGeo;
   /** B1d-1b Task 9: SOL's dollar price /wallet/prices answers — null leaves `solana` out of the answer (#23's Q19). */
   marketSolUsd: number | null;
+  /** B1d-2 (spec §2.4): each body POSTed to /solana/purchase, in order — answered as the deployed route (P2a) accepts one. */
+  purchaseRecords: unknown[];
   /**
    * Holds every answer until the returned function is called — how a visual spec keeps a loading
    * state (#40's, #8's "Checking…") on screen deterministically while it is asserted and shot.
@@ -309,6 +312,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     presale: {accounts: new Map(), solUsd: 150, read: 'ok', wrongDestination: false, simulated: [], landed: []},
     geo: {check: {countryCode: 'SI', isVpn: false}, list: restrictedList(), checks: 0, lists: 0},
     marketSolUsd: 150,
+    purchaseRecords: [],
     hold: () => {
       let release: () => void = () => undefined;
       held = new Promise<void>(r => (release = r));
@@ -762,6 +766,11 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
       fake.geo.lists += 1;
       return json(route, 200, fake.geo.list);
     }
+    if (url === PURCHASE_RECORD && req.method() === 'POST') {
+      // B1d §2.4: the purchase's coordinator record, after it confirmed. The route's own answer (coordinator 9e7d468).
+      fake.purchaseRecords.push(JSON.parse(req.postData() ?? 'null'));
+      return json(route, 200, {success: true, verified: true, duplicate: false, data: null});
+    }
     if (url === STATS && req.method() === 'GET') {
       // The presale stage, for NOC's value in the dollar re-auth rule (owner decision B).
       return json(route, 200, {success: true, data: {currentStage: 0, totalNocSold: 0, isPaused: false}});
```

```diff
diff --git a/extension/e2e/presale.spec.ts b/extension/e2e/presale.spec.ts
index 196f132..02c8aa6 100644
--- a/extension/e2e/presale.spec.ts
+++ b/extension/e2e/presale.spec.ts
@@ -157,6 +157,9 @@ test('1 · SOL purchase end to end: #11 Buy → #23a → amount → #20 (rows, t
     await expect(tab.locator('.top-bar .title')).toHaveText('Purchased');
     await expect(tab.locator('.top-bar .status-pill')).toHaveText('Presale');
     expect(h.fake.broadcasts).toHaveLength(1);
+    // B1d-2 (§2.4, D28): the confirmed purchase is recorded with the coordinator, once, with the whole payload.
+    await expect.poll(() => h.fake.purchaseRecords.length).toBe(1);
+    expect(h.fake.purchaseRecords).toEqual([{txHash: h.fake.broadcasts[0], buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: expect.stringMatching(/^\d+(\.\d+)?$/), nocAmount: expect.any(Number), usdValue: 75, stage: 1}]);
     // #26 now lists the landed purchase from the chain; #23 shows the allocation (D5: claimable after TGE).
     // The payer paid the amount, the two PDAs' rent and the network fee #20 showed — exactly, as the program takes them.
     const network = (await msg(tab, {type: 'wallet.pending'})).data as {fee: {networkLamports: string}}[];
```

- [ ] **Step 2: Run them on the previous task's tree — red.**

In a `git archive` copy of a1bda47 (main, B1d-1b merged) with only the Step 1 files added (node_modules linked): `npx tsc --noEmit; echo $?` → `2`, 52 errors: `record.test.ts` 24 (`Cannot find module '../record'`, `'../../presaleRecordsKey'`, `no exported member named 'createJsonPoster'`, `'PostAnswer'`, and their consequences), `reconcileWindow.test.ts` 5 (`Cannot find module '../record'`, `'postJson' does not exist in type 'Partial<WalletDeps>'`, and their consequences), `deps.test.ts` 8 (`createJsonPoster`, `Property 'postJson' does not exist on type 'WalletDeps'`), `intents.test.ts` 4 (`'alarm' does not exist in type 'PresaleHost'`, `'onConfirmed' does not exist in type 'IntentKind<TestIntent>'`), `fakeDeps.ts` 2 (`'postJson' does not exist`), `pendingKinds.test.ts` 1 (`Cannot find module '../presaleRecordsKey'`), and 1 each in the eight popup / presale test files that pass `alarm` (`'alarm' does not exist in type 'PresaleHost'`).

`npx vitest run src/background/presale/__tests__/record.test.ts src/background/presale/__tests__/reconcileWindow.test.ts src/background/__tests__/deps.test.ts src/background/__tests__/intents.test.ts src/background/__tests__/pendingKinds.test.ts src/background/__tests__/start.test.ts src/background/__tests__/messages.test.ts src/background/presale/__tests__/api.test.ts src/__tests__/presaleSwitch.test.ts scripts/__tests__/check-no-presale.test.mjs scripts/__tests__/check-vault-isolation.test.mjs` — `Test Files  11 failed (11)` · `Tests  24 failed | 611 passed (635)`: `record.test.ts`, `reconcileWindow.test.ts` and `pendingKinds.test.ts` fail to load (`Cannot find module '../record'`, `'../presaleRecordsKey'`); `deps.test.ts` the six poster rows; `intents.test.ts` the five `onConfirmed` rows that expect a call (the two that expect none are green — negative controls); `start.test.ts` the three new rows (no POST at start, nothing reconciled; `host.alarm is not a function`); `messages.test.ts` “every privileged type is refused …” and “every presale type is privileged …”; `api.test.ts` the list row; `presaleSwitch.test.ts` “the entries export what B1d-1b has built so far …”; `check-no-presale.test.mjs` the `ON_BUILD`, `BOTH_BUILDS`, `MARKERS` (both), `MUST_STAY` rows; `check-vault-isolation.test.mjs` the new key row. The off run, `npx vitest run -c vitest.nopresale.config.ts src/background/__tests__/intents.test.ts src/background/__tests__/pendingKinds.test.ts src/background/__tests__/messages.test.ts src/__tests__/presaleSwitch.test.ts` — `Test Files  2 failed | 2 passed (4)` · `Tests  5 failed | 63 passed (68)` (`pendingKinds.test.ts` fails to load; the same five `onConfirmed` rows: the hook is shared code, both builds).

- [ ] **Step 3: Implement.**

`core/presale/record.ts` — the one type change (web and the app keep passing numbers):

```diff
diff --git a/core/presale/record.ts b/core/presale/record.ts
index de82bc4..9930cab 100644
--- a/core/presale/record.ts
+++ b/core/presale/record.ts
@@ -4,7 +4,8 @@ export interface PresalePurchaseRecord {
   txHash: string;
   buyerAddress: string;
   paymentToken: 'SOL' | 'USDC' | 'USDT';
-  paymentAmount: number;
+  /** A number (web and the app), or a decimal string in display units (the extension, B1d §2.4); the route stores either. */
+  paymentAmount: number | string;
   nocAmount: number;
   usdValue: number;
   stage: number;
```

`deps.ts` — the poster beside the getter, on the one latch:

```diff
diff --git a/extension/src/background/deps.ts b/extension/src/background/deps.ts
index e512105..9c748b9 100644
--- a/extension/src/background/deps.ts
+++ b/extension/src/background/deps.ts
@@ -22,6 +22,8 @@ export interface WalletDeps {
   stagePrice(): Promise<number | null>;
   /** B1d §2.2: the jurisdiction gate's answer now (both builds, D15) — #23 and F12 (B1d-1b) ask it; never throws. */
   geo(): Promise<GeoAnswer>;
+  /** B1d §2.4: POST JSON to a bare path under API_BASE through the shared latch — every status answered (createJsonPoster). */
+  postJson(path: string, body: unknown): Promise<PostAnswer>;
   now(): number;
   randomBytes(n: number): Uint8Array;
   sleep(ms: number): Promise<void>;
@@ -42,6 +44,34 @@ export function createJsonGetter(fetch: FetchLike, latch: ForbiddenLatch): JsonG
   };
 }
 
+/** What a POST was answered: its HTTP status and its JSON body, or null when the body is not JSON. */
+export interface PostAnswer {
+  status: number;
+  body: unknown;
+}
+
+/**
+ * POST JSON to a bare path under API_BASE (B1d §2.4: the coordinator record). Generic, beside createJsonGetter, through
+ * the same latch: a 403 trips it (RpcForbidden) and a request during the cool-down is never sent (RpcCoolingDown). Every
+ * other status is answered with its body, so the caller can tell the route's refusal from a failure to answer; no
+ * answer in time, or none at all, is RequestUnreachable.
+ */
+export function createJsonPoster(fetch: FetchLike, latch: ForbiddenLatch): {post(path: string, body: unknown): Promise<PostAnswer>} {
+  return {
+    async post(path, body) {
+      const res = await latch.request(path, () => fetch(`${API_BASE}${path}`, {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify(body), credentials: 'omit'}));
+      let answer: unknown = null;
+      try {
+        answer = await res.json();
+      } catch (e) {
+        if (e instanceof RequestUnreachable) throw e;
+        answer = null;
+      }
+      return {status: res.status, body: answer};
+    },
+  };
+}
+
 /**
  * NOC's USD price for the dollar re-auth rule, read strictly from a /stats body. NOT web's
  * fetchPresaleStats: that maps a missing currentStage to stage 1 — the lowest price — which is right
@@ -139,6 +169,7 @@ export function browserDeps(ext: Ext): WalletDeps {
   const broadcastFetch = timedFetch(BROADCAST_TIMEOUT_MS);
   const latch = createForbiddenLatch({store: latchStore(ext)});
   const get = createJsonGetter(fetch, latch);
+  const poster = createJsonPoster(fetch, latch);
   const gate = createJurisdictionGate({get, now: () => Date.now()});
   let cache: {at: number; prices: Prices} | null = null;
   let stage: {at: number; price: number} | null = null;
@@ -161,6 +192,7 @@ export function browserDeps(ext: Ext): WalletDeps {
       return price;
     },
     geo: () => gate.check(),
+    postJson: (path, body) => poster.post(path, body),
     now: () => Date.now(),
     // A CSPRNG: ids for prepared sends, pending records and re-auth challenges.
     randomBytes: n => globalThis.crypto.getRandomValues(new Uint8Array(n)),
```

`intents.ts` and `pending.ts` — the hook, once per record the round's own write moved to `confirmed`:

```diff
diff --git a/extension/src/background/intents.ts b/extension/src/background/intents.ts
index b935a58..8c7f943 100644
--- a/extension/src/background/intents.ts
+++ b/extension/src/background/intents.ts
@@ -2,6 +2,7 @@ import type {Ext} from '../ext';
 import type {WalletDeps} from './deps';
 import {digestOf} from './digest';
 import type {PreparedEntry} from './prepare';
+import type {PendingRecord} from './pendingStore';
 
 /**
  * B1d §1.3 (C19): the shared send pipeline knows kinds, not presale. Each kind is registered once, by the module that
@@ -49,6 +50,12 @@ export interface IntentKind<I> {
    * only — or null when `fresh` describes another intent. Not asked of `send`.
    */
   rebaseAbout?(stored: KindAbout, fresh: KindAbout): KindAbout | null;
+  /**
+   * B1d §1.3: the poller's call, once, when a record of this kind first reaches `confirmed` — only the wallet's own
+   * record (`extra` of this kind) of an account of the wallet stored now. Display and bookkeeping only: it decides
+   * nothing about the transaction, and a hook that throws changes nothing the poller does. Not asked of `send`.
+   */
+  onConfirmed?(host: KindHost, record: PendingRecord): Promise<void>;
 }
 
 const kinds = new Map<string, IntentKind<unknown>>();
```

```diff
diff --git a/extension/src/background/pending.ts b/extension/src/background/pending.ts
index 562680e..9b85147 100644
--- a/extension/src/background/pending.ts
+++ b/extension/src/background/pending.ts
@@ -4,6 +4,7 @@ import type {WalletDeps} from './deps';
 import {addKnownRecipient} from './knownRecipients';
 import {readWalletView} from './accountsStore';
 import {randomId} from './digest';
+import {intentKind} from './intents';
 import {inFlightFor, isOpen, readPending, updatePending, viewOf, type FirstBroadcast, type PendingExtra, type PendingFee, type PendingRecord, type PendingView} from './pendingStore';
 import {COOLING_AGAIN_DETAIL, FORBIDDEN_DETAIL, ResendRefused, SendRefused, SentUnconfirmed, type ResendRefusal, type SendIntent} from './sendTypes';
 import {BroadcastRejected, BroadcastSubstituted, firstSignature} from '../../../core/solana/broadcast';
@@ -297,10 +298,15 @@ export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
       updates.set(r.id, {state: 'stuck'});
     }
   }
+  // B1d §1.3: the records this write itself moved to confirmed — a round racing another sees each one only once.
+  const reached: PendingRecord[] = [];
   const after = await updatePending(ext, records =>
     records.map(r => {
       const u = updates.get(r.id);
-      return u !== undefined && isOpen(r) ? {...r, ...u} : r;
+      if (u === undefined || !isOpen(r)) return r;
+      const next = {...r, ...u};
+      if (next.state === 'confirmed') reached.push(next);
+      return next;
     }),
   );
   const confirmed = open.filter(r => updates.get(r.id)?.state === 'confirmed');
@@ -312,10 +318,22 @@ export async function pollOnce(ext: Ext, deps: WalletDeps): Promise<boolean> {
     const own = new Set((await readWalletView(ext))?.accounts.map(a => a.publicKey) ?? []);
     // A dApp's transaction (B1c-2: no intent) names no recipient of the wallet's own.
     for (const r of confirmed) if (own.has(r.account) && r.intent !== null) await addKnownRecipient(ext, r.intent.recipient, now);
+    for (const r of reached) if (own.has(r.account) && r.extra !== null) await confirmedHook(ext, deps, r);
   }
   return after.some(isOpen);
 }
 
+/** B1d §1.3: the record's kind's `onConfirmed`, when it has one; whatever the hook does, the poller goes on. */
+async function confirmedHook(ext: Ext, deps: WalletDeps, record: PendingRecord): Promise<void> {
+  const hook = record.extra === null ? undefined : intentKind(record.extra.kind)?.onConfirmed;
+  if (hook === undefined) return;
+  try {
+    await hook({ext, deps}, record);
+  } catch (e) {
+    console.warn('a confirmed record’s hook failed', e);
+  }
+}
+
 const loops = new WeakMap<Ext, Promise<void>>();
 
 /**
```

Create `extension/src/background/presaleRecordsKey.ts` (both builds):

```ts
import type {Ext} from '../ext';
import {createMutex} from './mutex';

/**
 * B1d §2.4: storage.local `v1_presale_records` — the coordinator record of each confirmed purchase, written only by the
 * background (scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS), by `presale/record.ts` in the presale build.
 * The key and its lock live here, in both builds, because a delete wipes a wallet's data in both (accountsStore's
 * WALLET_DATA_KEYS): an update that turns presale off must not leave a deleted wallet's purchases behind.
 */
export const PRESALE_RECORDS_KEY = 'v1_presale_records';

/** Every write of PRESALE_RECORDS_KEY runs inside this section, so a wipe is never undone by a write-back in flight. */
export const presaleRecordsSection = createMutex();

/** A delete's (and a first write's) removal of the records, behind any write in flight. */
export async function wipePresaleRecords(ext: Ext): Promise<void> {
  await presaleRecordsSection(() => ext.local.remove(PRESALE_RECORDS_KEY));
}
```

`accountsStore.ts` — the records among the wallet's data, removed behind their lock:

```diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index c5690ac..84326c3 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -13,6 +13,7 @@ import {BLOCKED_KEY} from './dapp/blocked';
 import {LIMITS_KEY} from './dapp/limits';
 import {DAPP_TXS_KEY} from './dapp/dappTxs';
 import {wipeDappStores} from './dapp/store';
+import {PRESALE_RECORDS_KEY, wipePresaleRecords} from './presaleRecordsKey';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, accountsPolicyOk, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
 import {readWalletBalances} from '../../../core/solana/balances';
@@ -45,16 +46,18 @@ const serial = createMutex();
  * Everything a wallet owns in storage.local besides its envelope and the balance caches — removed together by a
  * delete (vault.forgetWallet without a replacement, E5 step 7 / B1b-2b E11) and by a first write. The one list, with
  * the address book (B1b-2b E17, D20: wiped on delete, kept on restore — a replacement does not come here), and B1c's
- * dApp grants, blocked sites and rejection limits (spec C11, C14: wiped by a delete, kept by a restore).
- * `v1_forbidden_until` is not the wallet's (the coordinator's verdict) and is kept.
+ * dApp grants, blocked sites and rejection limits (spec C11, C14: wiped by a delete, kept by a restore), and B1d §2.4's
+ * presale records (both builds). `v1_forbidden_until` is not the wallet's (the coordinator's verdict) and is kept.
  */
-export const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY];
-/** The dApp keys among WALLET_DATA_KEYS (B1c-2: v1_dapp_txs too): removed only through wipeDappStores (fix round 1,
- * IMPORTANT 1) — never by a plain ext.local.remove, which an in-flight dappSection's write-back could undo. */
-const DAPP_DATA_KEYS: ReadonlySet<string> = new Set([GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY]);
+export const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY, PRESALE_RECORDS_KEY];
+/** The keys among WALLET_DATA_KEYS removed only behind their own writers' lock (fix round 1, IMPORTANT 1) — never by a
+ * plain ext.local.remove, which a write-back in flight could undo: the dApp keys (wipeDappStores; B1c-2: v1_dapp_txs
+ * too) and the presale records, whose retry writes on its own schedule (wipePresaleRecords). */
+const LOCKED_DATA_KEYS: ReadonlySet<string> = new Set([GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY, PRESALE_RECORDS_KEY]);
 async function removeWalletData(ext: Ext): Promise<void> {
-  for (const key of WALLET_DATA_KEYS) if (!DAPP_DATA_KEYS.has(key)) await ext.local.remove(key);
+  for (const key of WALLET_DATA_KEYS) if (!LOCKED_DATA_KEYS.has(key)) await ext.local.remove(key);
   await wipeDappStores(ext);
+  await wipePresaleRecords(ext);
 }
 
 type Json = Record<string, unknown>;
```

`presaleHost.ts` and `index.ts` — the presale entry's own alarms:

```diff
diff --git a/extension/src/background/presaleHost.ts b/extension/src/background/presaleHost.ts
index 9a645cd..3e5b77a 100644
--- a/extension/src/background/presaleHost.ts
+++ b/extension/src/background/presaleHost.ts
@@ -12,10 +12,12 @@ export type PresaleHandler = (ext: Ext, deps: WalletDeps, msg: Readonly<Record<s
  * B1d §1.1: what the background hands its presale entry module at start-up (`registerPresale`, called once by
  * index.ts) — the entry `presale/api.ts` in the presale build, its stub `src/presale-off/background.ts` in the build
  * without it. Types only: both import it, and neither imports the other. `handle` registers one handler per type of
- * `PRESALE_MESSAGE_TYPES` (messages.ts's `registerPresaleHandler`).
+ * `PRESALE_MESSAGE_TYPES` (messages.ts's `registerPresaleHandler`); `alarm` (B1d-2) one run per alarm name the entry
+ * arms itself, which index.ts calls when that alarm fires.
  */
 export interface PresaleHost {
   ext: Ext;
   deps: WalletDeps;
   handle(type: string, handler: PresaleHandler): void;
+  alarm(name: string, run: () => Promise<void>): void;
 }
```

```diff
diff --git a/extension/src/background/index.ts b/extension/src/background/index.ts
index 9fce875..c7bec97 100644
--- a/extension/src/background/index.ts
+++ b/extension/src/background/index.ts
@@ -33,8 +33,19 @@ const deps = browserDeps(ext);
 // Firefox). Caught, not left to reject unhandled — a browser that refuses the call must not
 // stop the listeners below from registering.
 void ext.pinSessionAccess().catch(e => console.warn('storage.session access level not pinned', e));
-// B1d §1.1: presale joins here, before any listener can deliver a message (the stub in the build without it).
-registerPresale({ext, deps, handle: registerPresaleHandler});
+// B1d §1.1: presale joins here, before any listener can deliver a message (the stub in the build without it). Its own
+// alarms (B1d-2: the record's retry) by name — none in the build without it; a shared alarm's name is never one.
+const SHARED_ALARMS: readonly string[] = [AUTOLOCK_ALARM, PENDING_ALARM, QUEUE_ALARM];
+const presaleAlarms = new Map<string, () => Promise<void>>();
+registerPresale({
+  ext,
+  deps,
+  handle: registerPresaleHandler,
+  alarm: (name, run) => {
+    if (SHARED_ALARMS.includes(name) || presaleAlarms.has(name)) throw new Error(`registerPresale: the alarm ${name} is taken`);
+    presaleAlarms.set(name, run);
+  },
+});
 
 api.runtime.onMessage.addListener((msg, sender, reply) => {
   handleMessage(ext, msg, sender, deps).then(reply, () => reply({ok: false, error: 'internal'}));
@@ -45,6 +56,8 @@ api.alarms.onAlarm.addListener(a => {
   if (a.name === AUTOLOCK_ALARM) void lock(ext);
   if (a.name === PENDING_ALARM) void onPendingAlarm(ext, deps).catch(e => console.warn('pending alarm tick failed', e));
   if (a.name === QUEUE_ALARM) void onQueueAlarm(ext, deps).catch(e => console.warn('dApp queue tick failed', e));
+  const presale = presaleAlarms.get(a.name);
+  if (presale !== undefined) void presale().catch(e => console.warn('presale alarm tick failed', e));
 });
 // The approval window first: it decides for itself whether to lock (and drain the queue) or reopen, from
 // ext.windowCount() as of right after the reject — before anything here could change that count (fix round 1,
```

Create `extension/src/background/presale/record.ts`:

```ts
import type {Ext} from '../../ext';
import {latchStore, type PostAnswer, type WalletDeps} from '../deps';
import type {KindHost} from '../intents';
import {readPending, type PendingRecord} from '../pendingStore';
import {readWalletView} from '../accountsStore';
import {PENDING_ALARM_MINUTES} from '../pending';
import {PRESALE_RECORDS_KEY, presaleRecordsSection} from '../presaleRecordsKey';
import {PRESALE_CURRENCIES, type PresaleCurrency} from './quote';
import {STAGE_PRICE_TICKS} from '../../../../core/presale/limits';
import type {PresalePurchaseRecord} from '../../../../core/presale/record';
import {formatTokenAmount} from '../../../../core/util/parseTokenAmount';
import {RpcForbidden} from '../../../../core/solana/rpc';

/**
 * B1d §2.4 (C24, D28–D30): the coordinator record of each confirmed purchase — written when the poller sees a
 * `presale-buy` record reach `confirmed` (the kind's `onConfirmed`), POSTed at once and then retried on C24's schedule
 * until the coordinator accepts it, refuses it or 72 h have passed. The purchase stands on chain whatever happens here:
 * this decides nothing about it. The retry is harmless only because the coordinator records once by signature (P2a).
 */
export const PRESALE_RECORD_ALARM = 'presale-record';
/** The route, a bare path under API_BASE (which already ends in /api/v1). */
export const PRESALE_RECORD_PATH = '/solana/purchase';
export const MAX_PRESALE_RECORDS = 50;

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** C24: when each attempt is due, from `confirmedAt` — at once, 1 min, 5 min, 30 min, 2 h, 12 h, then every 24 h to 72 h. */
export const PRESALE_RECORD_SLOTS_MS: readonly number[] = [0, MINUTE, 5 * MINUTE, 30 * MINUTE, 2 * HOUR, 12 * HOUR, 24 * HOUR, 48 * HOUR, 72 * HOUR];

/** `due` — owed an attempt at `nextAt`; `done` — accepted (D30); `refused` — the route's 400, final (D29); `given-up` — no slot left. */
export type PresaleRecordState = 'due' | 'done' | 'refused' | 'given-up';
const STATES: readonly PresaleRecordState[] = ['due', 'done', 'refused', 'given-up'];

/** D28: §2.4's payload — `paymentAmount` a decimal string in display units; `nocAmount` / `usdValue` numbers, made here only. */
export type PresaleRecordPayload = PresalePurchaseRecord & {paymentAmount: string};

export interface PresaleRecordEntry {
  signature: string;
  account: string;
  payload: PresaleRecordPayload;
  confirmedAt: number;
  attempts: number;
  nextAt: number;
  state: PresaleRecordState;
}

const DECIMALS: Record<PresaleCurrency, number> = {SOL: 9, USDC: 6, USDT: 6};
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
const POSITIVE = /^[1-9]\d{0,19}$/;
const DIGITS = /^\d{1,20}$/;
const DATA_KEYS = ['currency', 'amount', 'stage', 'priceTicks', 'nocBase', 'spentCents', 'destination', 'referrer'];
const ENTRY_KEYS = ['signature', 'account', 'payload', 'confirmedAt', 'attempts', 'nextAt', 'state'];
const PAYLOAD_KEYS = ['txHash', 'buyerAddress', 'paymentToken', 'paymentAmount', 'nocAmount', 'usdValue', 'stage'];

const objectOf = (x: unknown): Record<string, unknown> | null => (typeof x === 'object' && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null);
const exactKeys = (o: Record<string, unknown>, keys: readonly string[]): boolean => Object.keys(o).length === keys.length && keys.every(k => Object.hasOwn(o, k));
const isCurrency = (x: unknown): x is PresaleCurrency => typeof x === 'string' && (PRESALE_CURRENCIES as readonly string[]).includes(x);
const isTime = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
const isPositiveNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x) && x > 0;

/**
 * §2.4 / D28: the payload of a confirmed purchase record, from its `extra.data` (§2.3) — read as a claim, exactly the
 * shape the kind writes — or null when it does not read back (nothing is recorded then). The amounts are the
 * simulation's (`nocBase`, `spentCents`); the coordinator stores what it derives from the chain and logs a disagreement.
 */
export function purchasePayload(record: PendingRecord): PresaleRecordPayload | null {
  if (record.extra?.kind !== 'presale-buy' || !SIGNATURE.test(record.signature) || !ADDRESS.test(record.account)) return null;
  const d = objectOf(record.extra.data);
  if (d === null || !exactKeys(d, DATA_KEYS)) return null;
  const {currency, amount, stage, priceTicks, nocBase, spentCents, destination, referrer} = d;
  if (!isCurrency(currency) || typeof amount !== 'string' || !POSITIVE.test(amount)) return null;
  if (typeof stage !== 'string' || !/^\d$/.test(stage) || Number(stage) >= STAGE_PRICE_TICKS.length) return null;
  if (typeof priceTicks !== 'string' || !DIGITS.test(priceTicks) || typeof nocBase !== 'string' || !POSITIVE.test(nocBase) || typeof spentCents !== 'string' || !POSITIVE.test(spentCents)) return null;
  if (typeof destination !== 'string' || !ADDRESS.test(destination) || (referrer !== null && (typeof referrer !== 'string' || !ADDRESS.test(referrer)))) return null;
  return {
    txHash: record.signature,
    buyerAddress: record.account,
    paymentToken: currency,
    paymentAmount: formatTokenAmount(BigInt(amount), DECIMALS[currency]),
    nocAmount: Number(formatTokenAmount(BigInt(nocBase), 9)),
    usdValue: Number(formatTokenAmount(BigInt(spentCents), 2)),
    // §2.3: the record keeps the program's 0-indexed stage; the route's is 1-indexed.
    stage: Number(stage) + 1,
    ...(referrer === null ? {} : {referrerAddress: referrer}),
  };
}

/** A stored payload, rebuilt key by key, or null. */
function storedPayload(x: unknown): PresaleRecordPayload | null {
  const p = objectOf(x);
  if (p === null) return null;
  const referred = Object.hasOwn(p, 'referrerAddress');
  if (!exactKeys(p, referred ? [...PAYLOAD_KEYS, 'referrerAddress'] : PAYLOAD_KEYS)) return null;
  const {txHash, buyerAddress, paymentToken, paymentAmount, nocAmount, usdValue, stage, referrerAddress} = p;
  if (typeof txHash !== 'string' || !SIGNATURE.test(txHash) || typeof buyerAddress !== 'string' || !ADDRESS.test(buyerAddress) || !isCurrency(paymentToken)) return null;
  if (typeof paymentAmount !== 'string' || !/^\d+(\.\d+)?$/.test(paymentAmount) || !isPositiveNumber(nocAmount) || !isPositiveNumber(usdValue)) return null;
  if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 1 || stage > STAGE_PRICE_TICKS.length) return null;
  if (referred && (typeof referrerAddress !== 'string' || !ADDRESS.test(referrerAddress))) return null;
  return {txHash, buyerAddress, paymentToken, paymentAmount, nocAmount, usdValue, stage, ...(referred ? {referrerAddress: referrerAddress as string} : {})};
}

/** A stored entry is a claim: exactly the shape written, its payload naming its own signature and account — or null. */
function entryOf(x: unknown): PresaleRecordEntry | null {
  const e = objectOf(x);
  if (e === null || !exactKeys(e, ENTRY_KEYS)) return null;
  const {signature, account, confirmedAt, attempts, nextAt, state} = e;
  const payload = storedPayload(e.payload);
  if (payload === null || signature !== payload.txHash || account !== payload.buyerAddress || typeof signature !== 'string' || typeof account !== 'string') return null;
  if (!isTime(confirmedAt) || !isTime(nextAt) || !isTime(attempts) || typeof state !== 'string' || !(STATES as readonly string[]).includes(state)) return null;
  return {signature, account, payload, confirmedAt, attempts, nextAt, state: state as PresaleRecordState};
}

/** Every entry that reads back, oldest first; anything else is dropped. Fresh objects. */
export async function readPresaleRecords(ext: Ext): Promise<PresaleRecordEntry[]> {
  const v = await ext.local.get(PRESALE_RECORDS_KEY);
  if (!Array.isArray(v)) return [];
  const out: PresaleRecordEntry[] = [];
  for (const x of v as unknown[]) {
    const e = entryOf(x);
    if (e !== null) out.push(e);
  }
  return out;
}

/** What goes first when there are more than MAX_PRESALE_RECORDS: an accepted record (dropping it changes nothing shown), then the oldest of the others. */
const DROP_ORDER: readonly PresaleRecordState[] = ['done', 'given-up', 'refused', 'due'];

function trim(entries: PresaleRecordEntry[]): PresaleRecordEntry[] {
  const out = [...entries];
  for (const state of DROP_ORDER) {
    while (out.length > MAX_PRESALE_RECORDS) {
      const i = out.findIndex(e => e.state === state);
      if (i < 0) break;
      out.splice(i, 1);
    }
  }
  return out;
}

/**
 * The one way entries change: read, change, trim, write — inside the records' section (presaleRecordsKey.ts). A change
 * that returns the entries it was given writes nothing.
 */
async function updateRecords(ext: Ext, change: (entries: PresaleRecordEntry[]) => PresaleRecordEntry[]): Promise<void> {
  await presaleRecordsSection(async () => {
    const entries = await readPresaleRecords(ext);
    const changed = change(entries);
    if (changed !== entries) await ext.local.set(PRESALE_RECORDS_KEY, trim(changed));
  });
}

/** The first slot after `now`, or null when none is left. */
export function slotAfter(confirmedAt: number, now: number): number | null {
  for (const s of PRESALE_RECORD_SLOTS_MS) if (confirmedAt + s > now) return confirmedAt + s;
  return null;
}

/**
 * The kind's `onConfirmed` (§1.3): the entry, once per signature, due at once — then the first attempt, not awaited (the
 * poller goes on). A record whose display data does not read back is not recorded.
 */
export async function recordConfirmedPurchase({ext, deps}: KindHost, record: PendingRecord): Promise<void> {
  const payload = purchasePayload(record);
  if (payload === null) return;
  const now = deps.now();
  const entry: PresaleRecordEntry = {signature: record.signature, account: record.account, payload, confirmedAt: now, attempts: 0, nextAt: now, state: 'due'};
  await updateRecords(ext, entries => (entries.some(e => e.signature === record.signature) ? entries : [...entries, entry]));
  void runPresaleRecords(ext, deps);
}

/** The last slot: a purchase confirmed longer ago than this has no attempt left. */
const LAST_SLOT_MS = PRESALE_RECORD_SLOTS_MS[PRESALE_RECORD_SLOTS_MS.length - 1] as number;

/**
 * Controller ruling (B1d-2 Task 1): what a worker stopped between the poller's `confirmed` write and the hook's entry left
 * unrecorded, written when the worker wakes (each start, the `presale-record` alarm) — every confirmed `presale-buy`
 * record in v1_pending of an account of the wallet stored now that has no entry gets the hook's entry. A record carries no
 * confirmation time, so `confirmedAt` is its `createdAt`: the signed bytes can land only within their blockhash's life
 * after it. One confirmed more than 72 h before now is written `given-up` and never POSTed.
 */
export async function reconcilePresaleRecords(ext: Ext, deps: WalletDeps): Promise<void> {
  const own = new Set((await readWalletView(ext))?.accounts.map(a => a.publicKey) ?? []);
  // Which of them is a purchase is purchasePayload's to say (only a `presale-buy` record's display data reads back).
  const confirmed = (await readPending(ext)).filter(r => r.state === 'confirmed' && own.has(r.account));
  if (confirmed.length === 0) return;
  const now = deps.now();
  await updateRecords(ext, entries => {
    const missing: PresaleRecordEntry[] = [];
    for (const r of confirmed) {
      const payload = purchasePayload(r);
      if (payload === null || entries.some(e => e.signature === r.signature) || missing.some(e => e.signature === r.signature)) continue;
      const late = now > r.createdAt + LAST_SLOT_MS;
      missing.push({signature: r.signature, account: r.account, payload, confirmedAt: r.createdAt, attempts: 0, nextAt: now, state: late ? 'given-up' : 'due'});
    }
    return missing.length === 0 ? entries : [...entries, ...missing];
  });
}

/** What the worker does when it wakes (§2.4 and the ruling above): reconcile, then send what is due. */
export async function wakePresaleRecords(ext: Ext, deps: WalletDeps): Promise<void> {
  await reconcilePresaleRecords(ext, deps);
  await runPresaleRecords(ext, deps);
}

type Outcome = 'done' | 'refused' | 'forbidden' | 'retry';

/**
 * D29 / D30: `200 {success: true}` is done whatever else it says; a 400 that is the route's own refusal (`{success:
 * false, error}`) is final; anything else — a 400 without that body (a proxy's), 429, 5xx, no answer — is retried.
 */
function outcomeOf(a: PostAnswer): Outcome {
  const body = objectOf(a.body);
  if (a.status === 200 && body?.success === true) return 'done';
  if (a.status === 400 && body?.success === false && typeof body.error === 'string') return 'refused';
  return 'retry';
}

/**
 * One due entry, claimed before its POST: its next slot (or `given-up` when none is left) is written first, so a worker
 * stopped mid-request never POSTs it twice within a slot. Then its answer. False when nothing was due.
 */
async function sendNext(ext: Ext, deps: WalletDeps): Promise<boolean> {
  const now = deps.now();
  const out: {claimed: PresaleRecordEntry | null} = {claimed: null};
  await updateRecords(ext, entries => {
    const i = entries.findIndex(e => e.state === 'due' && e.nextAt <= now);
    const e = entries[i];
    if (e === undefined) return entries;
    const slot = slotAfter(e.confirmedAt, now);
    const claimed: PresaleRecordEntry = {...e, attempts: e.attempts + 1, ...(slot === null ? {state: 'given-up' as const} : {nextAt: slot})};
    out.claimed = claimed;
    return entries.map((x, j) => (j === i ? claimed : x));
  });
  const claimed = out.claimed;
  if (claimed === null) return false;
  let answered: Outcome;
  try {
    answered = outcomeOf(await deps.postJson(PRESALE_RECORD_PATH, claimed.payload));
  } catch (e) {
    // A 403 now, or the cool-down after an earlier one (nothing sent): the entry waits until the cool-down ends.
    answered = e instanceof RpcForbidden ? 'forbidden' : 'retry';
  }
  const outcome = answered;
  if (outcome === 'retry') return true;
  const until = outcome === 'forbidden' ? await latchStore(ext).load() : 0;
  await updateRecords(ext, entries =>
    entries.map(e => {
      if (e.signature !== claimed.signature) return e;
      if (outcome === 'done' || outcome === 'refused') return {...e, state: outcome};
      return e.state === 'due' ? {...e, nextAt: Math.max(e.nextAt, until)} : e;
    }),
  );
  return true;
}

/**
 * The alarm at the earliest due entry's time (never sooner than the browsers' 30 s), or cleared when nothing is due. With
 * no entry at all there is nothing to arm or clear (a start with no purchase recorded touches no alarm).
 */
async function armRecordAlarm(ext: Ext, now: number): Promise<void> {
  const stored = await readPresaleRecords(ext);
  if (stored.length === 0) return;
  const due = stored.filter(e => e.state === 'due');
  if (due.length === 0) {
    await ext.alarms.clear(PRESALE_RECORD_ALARM);
    return;
  }
  const at = Math.min(...due.map(e => e.nextAt));
  await ext.alarms.create(PRESALE_RECORD_ALARM, {delayInMinutes: Math.max(PENDING_ALARM_MINUTES, (at - now) / MINUTE)});
}

const runs = new WeakMap<Ext, {run: Promise<void>; again: boolean}>();

/**
 * Every due entry, one POST at a time (never more than one in flight per background), then the alarm re-armed. A call
 * while a run is going returns that run and makes it look once more before it ends — even one that arrives while the
 * alarm is being armed. Never rejects.
 */
export function runPresaleRecords(ext: Ext, deps: WalletDeps): Promise<void> {
  const running = runs.get(ext);
  if (running !== undefined) {
    running.again = true;
    return running.run;
  }
  const me = {run: Promise.resolve(), again: false};
  me.run = (async () => {
    try {
      for (;;) {
        me.again = false;
        while (await sendNext(ext, deps));
        await armRecordAlarm(ext, deps.now());
        if (!me.again) break;
      }
    } catch (e) {
      console.warn('presale records not sent; the alarm or the next start resumes them', e);
    } finally {
      runs.delete(ext);
    }
  })();
  runs.set(ext, me);
  return me.run;
}

/** `presale.unrecorded` (§1.4): the signatures of this account's confirmed purchases the coordinator has not accepted (#27's Q34, D29). */
export async function unrecordedFor(ext: Ext, account: string): Promise<string[]> {
  return (await readPresaleRecords(ext)).filter(e => e.account === account && e.state !== 'done').map(e => e.signature);
}
```

`buy.ts` and `api.ts` — the kind's hook, the message, and the wake (reconcile, then run) as the alarm's run and at start:

```diff
diff --git a/extension/src/background/presale/buy.ts b/extension/src/background/presale/buy.ts
index 6ccb5e9..8c62f07 100644
--- a/extension/src/background/presale/buy.ts
+++ b/extension/src/background/presale/buy.ts
@@ -17,6 +17,7 @@ import {tokenAccountInfo} from '../dapp/tokenState';
 import {readPresaleStateAt, referrerAllocationOf, type PresaleSnapshot, type PresaleState} from './state';
 import {PRESALE_CURRENCIES, PRESALE_FEE_BOUND_LAMPORTS, quote, type BalanceCode, type PresaleBalances, type PresaleCurrency} from './quote';
 import {PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from './layouts';
+import {recordConfirmedPurchase} from './record';
 import {
   MAINNET_PROGRAM_ID,
   MAINNET_SOL_TREASURY,
@@ -361,7 +362,8 @@ function purchasePendingData(entry: PreparedEntry, intent: PurchaseIntent): Purc
 
 /**
  * B1d §1.3 (C19, D17): the purchase kind, registered when this module loads — only the presale entry module imports it,
- * so the build without presale has no such kind. It is signed only through presale.buy, which names it.
+ * so the build without presale has no such kind. It is signed only through presale.buy, which names it; once confirmed,
+ * it is recorded with the coordinator (B1d-2, §2.4: record.ts).
  */
 export const PRESALE_BUY_INTENT: IntentKind<PurchaseIntent> = {
   kind: PRESALE_BUY_KIND,
@@ -371,6 +373,7 @@ export const PRESALE_BUY_INTENT: IntentKind<PurchaseIntent> = {
   pendingData: purchasePendingData,
   isAbout: isPurchaseAbout,
   rebaseAbout: rebasePurchaseAbout,
+  onConfirmed: recordConfirmedPurchase,
 };
 registerIntentKind(PRESALE_BUY_INTENT);
```

```diff
diff --git a/extension/src/background/presale/api.ts b/extension/src/background/presale/api.ts
index db0fe96..fcb4879 100644
--- a/extension/src/background/presale/api.ts
+++ b/extension/src/background/presale/api.ts
@@ -11,6 +11,7 @@ import {usdMicros} from '../reauthPolicy';
 import {readPresaleConfig, readPresaleState, type PresaleSnapshot, type PresaleState, type StageFacts, type UnavailableCode} from './state';
 import {PRESALE_CURRENCIES, quote, type PresaleBalances, type PresaleCurrency, type QuoteLine} from './quote';
 import {PRESALE_BUY_KIND, PurchaseRefused, gateAnswer, parsePurchaseIntent, preparePurchase, purchasePreparedFor} from './buy';
+import {PRESALE_RECORD_ALARM, unrecordedFor, wakePresaleRecords} from './record';
 import {CHALLENGE_ID} from '../reauthChallenges';
 import {SendRefused} from '../sendTypes';
 import {MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../core/presale/addresses';
@@ -32,6 +33,7 @@ export const PRESALE_MESSAGE_TYPES: readonly string[] = [
   'presale.preparedFor',
   'presale.buy',
   'presale.discardPrepared',
+  'presale.unrecorded',
 ];
 
 /** `presale.quote` answers from the last view's snapshot of the account at most this old (§1.4). */
@@ -354,6 +356,12 @@ async function discardMessage(ext: Ext, _deps: WalletDeps, msg: Readonly<Record<
   return {ok: true};
 }
 
+/** presale.unrecorded {account} (§1.4, §4.6, D29): the signatures #27 shows Q34 for — this account's records not accepted; no network. */
+async function unrecordedMessage(ext: Ext, _deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
+  const a = await accountOnly(ext, msg);
+  return 'answer' in a ? a.answer : {ok: true, data: await unrecordedFor(ext, a.account)};
+}
+
 /** A handler's unexpected failure (a storage error) is `failed`, never a thrown error across the message boundary. */
 const guarded =
   (h: (ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>) => Promise<Result>) =>
@@ -374,4 +382,9 @@ export function registerPresale(host: PresaleHost): void {
   host.handle('presale.preparedFor', guarded(preparedForMessage));
   host.handle('presale.buy', guarded(buyMessage));
   host.handle('presale.discardPrepared', guarded(discardMessage));
+  host.handle('presale.unrecorded', guarded(unrecordedMessage));
+  // §2.4: the record's retry wakes on its alarm, and resumes at every start (a worker stopped between two slots, or
+  // between a purchase's confirmation and its entry — reconciled first).
+  host.alarm(PRESALE_RECORD_ALARM, () => wakePresaleRecords(host.ext, host.deps));
+  void wakePresaleRecords(host.ext, host.deps).catch(e => console.warn('presale records not reconciled at start', e));
 }
```

The gates' staged lists:

```diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index 837ce26..a9e7531 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -31,7 +31,7 @@ export const WEB_ALLOWED = ['../web/src/ui/', '../web/src/styles/'];
 // (§2.1); 1b adds presale/quote.ts (Task 1), presale/buy.ts (Task 2), #23's popup modules (Task 4), #20's purchase
 // variant with the record slot (Task 5), #50b (Task 6) and core/presale/{buyInstructions,referrer}.ts — the purchase's
 // builder and its referrer allocation, in the on build's module map since Tasks 1–2 (Task 8); B1d-2 adds
-// presale/{record,referral}.ts and core/referral/index.ts.
+// presale/record.ts (Task 1), presale/referral.ts and core/referral/index.ts.
 export const ON_BUILD = [
   'src/background/presale/api.ts',
   'src/app/presale/index.ts',
@@ -50,10 +50,12 @@ export const ON_BUILD = [
   'src/app/presale/Geo.tsx',
   'core/presale/buyInstructions.ts',
   'core/presale/referrer.ts',
+  'src/background/presale/record.ts',
 ];
 // The intent-kind registry (C19 — both builds sign and read through it); the jurisdiction gate and its fetcher (D15:
-// the off build did not lose the gate); the country's name #48's F12 banner shows (B1d-1b Task 7, §3.6).
-export const BOTH_BUILDS = ['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts', 'src/app/ui/regionName.ts'];
+// the off build did not lose the gate); the country's name #48's F12 banner shows (B1d-1b Task 7, §3.6); the presale
+// records' key and lock (B1d-2 Task 1: a delete wipes them in both builds).
+export const BOTH_BUILDS = ['src/background/intents.ts', 'src/background/geo/gate.ts', 'core/geo/fetch.ts', 'src/app/ui/regionName.ts', 'src/background/presaleRecordsKey.ts'];
 // Armed by B1d-1b (1a shipped none — Q42 is "both"): Task 1's three presale message types (§6.2: "every presale.*
 // message type"), Task 2's prepare and the purchase's intent kind, Task 3's four sign and resume types, Task 4's #23
 // copy (§6.2's named strings and the §10 rows #23 shows whose source is new / approved and whose build is on — each
@@ -140,10 +142,14 @@ export const MARKERS = [
   'The restricted-region list is out of date.',
   'Your region could not be determined from your IP.',
   'The region check is unavailable — try again later.',
+  // B1d-2 Task 1: the record's message type and its alarm's name.
+  'presale.unrecorded',
+  'presale-record',
 ];
 // Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
 // be a string search. The decoder's instruction names are read from its source (DECODER).
-// B1d-1b Task 7: #48's F12 copy, Q49–Q51 (§6.2 item 3 — "both"; Q50a's literal part before its country).
+// B1d-1b Task 7: #48's F12 copy, Q49–Q51 (§6.2 item 3 — "both"; Q50a's literal part before its country). B1d-2 Task 1:
+// the presale records' key — a delete in the build without presale still wipes them (accountsStore's WALLET_DATA_KEYS).
 export const MUST_STAY = [
   'Presale purchase',
   'PRESALE PURCHASE',
@@ -153,6 +159,7 @@ export const MUST_STAY = [
   "This transaction buys NOC in the presale, which this wallet doesn't allow from your region (",
   "This transaction buys NOC in the presale. The wallet's region check did not succeed, so it can't be approved — try again later.",
   'Only Reject is available · no override',
+  'v1_presale_records',
 ];
 
 const MIN_MARKER = 8;
```

```diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
index 5e61e05..2919494 100644
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -99,9 +99,10 @@ const withoutPortListeners = text => PORT_LISTENER_SPELLINGS.reduce((t, re) => t
 // B1b-2b E17: the address book (v1_contacts) is the background's too — the popup reaches it only through contacts.*.
 // B1c (spec §2.1, review 1 L4): the dApp grants, blocked sites and limits — a page writing a grant would connect a site.
 // B1c-2: the transactions sites had signed here (v1_dapp_txs) — a page writing one would badge a row as a dApp's.
+// B1d-2: the presale records (v1_presale_records) — a page writing one would hide #27's Q34 or POST a forged record.
 export const BACKGROUND_OWNED_KEYS = [
   'v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache', 'v1_contacts',
-  'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits', 'v1_dapp_txs',
+  'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits', 'v1_dapp_txs', 'v1_presale_records',
 ];
 const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
 // The vault page renders only fixed strings and the user's own words, as text (B1b-2a §1.2 item 3):
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, the repository root and the web.**

Run: the Step 2 commands — `Test Files  11 passed (11)` · `Tests  734 passed (734)` (record 70, reconcileWindow 2, deps 18, intents 36, pendingKinds 27, start 9, messages 29, api 67, presaleSwitch 3, check-no-presale 52, check-vault-isolation 421); off `Test Files  4 passed (4)` · `Tests  95 passed (95)`.

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  215 passed (215)` · `Tests  4523 passed (4523)` (previous tree 213 / 4433: +2 files, +90 tests — record 70, reconcileWindow 2, deps +6, intents +7, start +3, pendingKinds +1, check-vault-isolation +1). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  16 passed (16)` · `Tests  430 passed | 15 skipped (445)` (previous 422 | 15 (437): intents +7, pendingKinds +1; no file joins `NOPRESALE_TESTS` — the hook's and the wipe's rows are in files it already runs).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build (vault isolation with the new key; rpc methods unchanged — `createJsonPoster` calls its `fetch` parameter inside `deps.ts`, the one file allowed), the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 23 required modules; 76 markers (none in the off build, each in the on build); 9 strings and the decoder's instruction names stay in the off build`. `npm run csp` — `CSP ok` for `dist/app` and `dist-nopresale/app`; `npm run secrets` — exit 0; `npm run reproducible` — exit 0, both variants (`presale chrome 26 files sha256:49f72244…`, `no-presale chrome 26 files sha256:45093f49…`). Permissions unchanged (`alarms` was already granted; no host; `connect-src` unchanged).

Run (repository root — this task changes `core/`): `npx tsc --noEmit; echo $?` — `0`; `npx jest` — `Test Suites: 1 skipped, 180 passed, 180 of 181 total` · `Tests: 1 skipped, 1234 passed, 1235 total`; `cd web && npm run verify` — exit 0 (`Test Files  47 passed (47)` · `Tests  622 passed (622)`, then its 3-test file and both builds); `node scripts/check-no-tge-date.mjs` — `no TGE date in 1311 tracked text files`.

Playwright (this task registers a message, and every confirmed purchase now POSTs its record): the whole suite on 5070c79 — `96 passed (28.5m)` normally and `96 passed (26.4m)` under `unshare -rn sh -c 'ip link set lo up && npx playwright test'`; on the final commit (after the loop's re-check and the reconcile at wake, both unit-tested) `npx playwright test e2e/presale.spec.ts e2e/presaleSwitch.spec.ts e2e/presaleOff.spec.ts` — `12 passed (2.7m)` normally and `12 passed (2.6m)` under `unshare -rn`.

- [ ] **Step 5: Commit.**

```bash
git add -A extension core
git commit -m "feat(extension): B1d-2 the coordinator record — presale/record.ts (v1_presale_records, ≤ 50; the §2.4 payload from extra.data, D28; C24's slots from confirmedAt, claimed before each POST, one in flight; done on 200 success (D30), refused on the route's 400 (D29), a 403 waits out the latch; the presale-record alarm; a wake reconciles a confirmed purchase left without its entry), the kind's onConfirmed once from the poller, createJsonPoster + WalletDeps.postJson, presale.unrecorded; the records' key wiped by a delete in both builds; core paymentAmount number | string" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked; G1–G2 with `extension/node_modules` copied, they build), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test file.** `RT` = `record.test.ts` (70), `RW` = `reconcileWindow.test.ts` (2), `IT` = `intents.test.ts` (36, also in the off run), `DT` = `deps.test.ts` (18), `ST` = `start.test.ts` (9), `PK` = `pendingKinds.test.ts` (27, also in the off run), `NP` = `check-no-presale.test.mjs` (52), `VI` = `check-vault-isolation.test.mjs` (421).

| id | the change | named test → observed |
|---|---|---|
| **M1 (D30)** | `outcomeOf`: `if (a.status === 200 && body !== null) return 'done';` (any 200 body accepted) | RT “200 with success false …”, “200 with success "true" …” — tsc 0 · RED `Tests  2 failed \| 68 passed (70)` |
| **M2 (D29)** | `if (a.status === 400) return 'refused';` (any 400 final, a proxy's too) | RT the three “a 400 that is not the route’s …” rows — tsc 0 · RED `Tests  3 failed \| 67 passed (70)` |
| **M3 (D29)** | `typeof body.error === 'number'` (the route's own 400 never final) | RT the four “the route’s 400 (…) is final …” rows and “a 400 whose error is not a string …” — tsc 0 · RED `Tests  5 failed \| 65 passed (70)` |
| **M4 (one in flight)** | `const running = runs.get({...ext});` (the run guard never finds the run) | RT “a second purchase confirmed while the first POST is held waits for it …”, “… while the run is arming its alarm …”, “a 403 on the record …” — tsc 0 · RED `Tests  3 failed \| 67 passed (70)` |
| M5 | `running.again = false;` (a call during a run does not make it look again) | RT “a purchase confirmed while the run is arming its alarm is still sent by that run …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M6 | the slots: `6 * MINUTE` for 5 min | RT “at once, 1 min, 5 min, … — never between — then given up”, the reconcile row “the hook was skipped …” (its claimed slot) — tsc 0 · RED `Tests  2 failed \| 68 passed (70)` |
| M7 | the slots without `72 * HOUR` | RT the schedule row, “slotAfter: …”, the reconcile row “confirmed more than 72 h ago …” (its last slot) — tsc 0 · RED `Tests  3 failed \| 67 passed (70)` |
| **M8 (403)** | `nextAt: e.nextAt + 0 * until` (a 403 waits only for the claimed slot) | RT “a 403 on the record …”, “another route’s 403 first …”, “a cool-down refusal …” — tsc 0 · RED `Tests  3 failed \| 67 passed (70)` (the negative-control row, a cool-down already over, stays green) |
| M9 | `e instanceof RpcForbidden && e.name === 'RpcCoolingDown' ? 'forbidden'` (a fresh 403 retried at the next slot) | RT “a 403 on the record …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M10 | `stage: Number(stage),` (the 0-indexed stage sent) | RT 38 rows (the payload rows; a stored payload with stage 0 no longer reads back) — tsc 0 · RED `Tests  38 failed \| 32 passed (70)` |
| M11 | `DECIMALS`: `USDC: 9` | RT “a stablecoin purchase with its referrer …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M12 | `usdValue: Number(spentCents),` (cents sent as dollars) | RT 29 rows — tsc 0 · RED `Tests  29 failed \| 41 passed (70)` |
| M13 | `...(referrer === null ? {referrerAddress: record.account} : …)` (a referrer invented) | RT 28 rows (the payload rows; every stored entry reads back with it) — tsc 0 · RED `Tests  28 failed \| 42 passed (70)` |
| M14 | the once-per-signature check compares `record.account` | RT “once per signature …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M15 | `!DATA_KEYS.every(k => Object.hasOwn(d, k))` (an extra key in the display data accepted) | RT “the display data as stored is a claim: an extra key → null …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M16 | `e.nextAt < now` (an entry not due at its own slot) | RT 30 rows — tsc 0 · RED `Tests  30 failed \| 40 passed (70)` |
| M17 | `DROP_ORDER = ['given-up', 'done', …]` (§2.4's literal order) | RT “the 51st drops the oldest accepted entry first …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M18 | `MAX_PRESALE_RECORDS = 51` | RT the same row — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M19 | `entryOf` without `signature !== payload.txHash` | RT “what does not read back is dropped …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M20 | the alarm floor `PENDING_ALARM_MINUTES / 5` | RT “armed at min(nextAt) over the due entries, never sooner than 30 s …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M21 | the alarm over `e.state !== 'done'` (given-up and refused entries keep it armed) | RT the alarm row, the four “the route’s 400 …” rows, the schedule row, the reconcile row “confirmed more than 72 h ago …” (a given-up entry arms the alarm) — tsc 0 · RED `Tests  7 failed \| 63 passed (70)` |
| **M22 (D29)** | `unrecordedFor`: `e.state === 'due'` (given-up and refused not listed) | RT “this account’s due, given-up and refused records …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M23 | `(e.account === account \|\| e.state === 'refused') && …` (another account's record listed) | RT the same row — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M24 | the claim: `attempts: e.attempts,` | RT 25 rows — tsc 0 · RED `Tests  25 failed \| 45 passed (70)` |
| **M25 (once)** | `pending.ts`: the hooks over `confirmed` (the round's reading) instead of `reached` (its own write) | IT “two rounds racing … one call”, “confirmed: called once, with the confirmed record …”, “confirmed past its expiry …” — tsc 0 · RED `Tests  3 failed \| 33 passed (36)`; the off run the same rows RED `Tests  3 failed \| 33 passed (36)` |
| **M26 (review M1)** | `for (const r of reached) if (r.extra !== null)` (no own-wallet check) | IT “only for an account of the wallet stored now …” — tsc 0 · RED `Tests  1 failed \| 35 passed (36)`, off the same |
| M27 | `confirmedHook` without its `try`/`catch` | IT “a hook that throws changes nothing the poller does …” — tsc 0 · RED `Tests  1 failed \| 35 passed (36)`, off the same |
| M28 | `index.ts`: `SHARED_ALARMS.includes(name.toUpperCase())` | ST “a presale alarm never takes a shared alarm’s name …” — tsc 0 · RED `Tests  1 failed \| 8 passed (9)` |
| M29 | `index.ts`: ``presaleAlarms.get(`${a.name}-off`)`` (the alarm never dispatched) | ST “a start resumes a due presale record …, and the presale-record alarm runs the retry again” — tsc 0 · RED `Tests  1 failed \| 8 passed (9)` |
| M30 | `registerPresale` without its `void wakePresaleRecords(…)` (no wake at start) | ST the resume row and “a start reconciles a confirmed purchase the hook never recorded …” — tsc 0 · RED `Tests  2 failed \| 7 passed (9)` |
| **M31 (delete)** | `removeWalletData`: `wipePresaleRecords({...ext, local: {...ext.local, remove: async () => undefined}})` (the wipe does nothing) | RT the three delete rows, PK “v1_presale_records is one of WALLET_DATA_KEYS, and a first write … removes it” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  4 failed \| 93 passed (97)`; the off run PK RED `Tests  1 failed \| 26 passed (27)` |
| **M32 (the lock)** | the key out of `LOCKED_DATA_KEYS` (a plain `remove`) and M31's no-op wipe | RT “a record write parked mid-write when the delete arrives …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` (a plain delete still passes the other rows: only the race tells the lock) |
| M33 | `createJsonPoster`: every body error answered as `null` (no rethrow of `RequestUnreachable`) | DT “a body that never arrives is no answer …” — tsc 0 · RED `Tests  1 failed \| 17 passed (18)` |
| **M34 (latch)** | `createJsonPoster`: `createForbiddenLatch().request(…)` (a latch of its own) | DT “a 403 trips the one latch …”, “postJson goes through the same latch …” — tsc 0 · RED `Tests  2 failed \| 16 passed (18)` |
| M35 | `browserDeps`: `createJsonPoster(fetch, createForbiddenLatch())` | DT “postJson goes through the same latch …” — tsc 0 · RED `Tests  1 failed \| 17 passed (18)` |
| M36 | `buy.ts`: `onConfirmed` records only a `failed` record | RT “confirmed: the entry, POSTed at once with the whole payload …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| M37 | `ON_BUILD` without `record.ts` | NP “the on build must carry …” — tsc 0 · RED `Tests  1 failed \| 51 passed (52)` |
| M38 | `MUST_STAY` without `v1_presale_records` | NP “must stay: …” — tsc 0 · RED `Tests  1 failed \| 51 passed (52)` |
| M39 | `MARKERS` without `presale.unrecorded` | NP “armed by B1d-1b: … B1d-2 Task 1 …”, “every presale.* message type of api.ts is a marker” — tsc 0 · RED `Tests  2 failed \| 50 passed (52)` |
| M40 | `BACKGROUND_OWNED_KEYS` without `v1_presale_records` | VI “lets only the background name the presale records key …” — tsc 0 · RED `Tests  1 failed \| 420 passed (421)` |
| **N1 (ruling: no duplicate)** | reconcile without `entries.some(e => e.signature === r.signature) \|\|` | RT “an entry already there, in any state: no second entry, no POST”, “two purchases, one recorded and one not …” — tsc 0 · RED `Tests  2 failed \| 68 passed (70)` |
| **N2 (ruling: past 72 h)** | `const late = now > r.createdAt + 2 * LAST_SLOT_MS;` | RT “confirmed more than 72 h ago: written given-up, never POSTed …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| N3 | `now >= r.createdAt + LAST_SLOT_MS` (the 72 h slot itself given up) | RT the same row (its boundary half) — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| **N4 (ruling: confirmedAt)** | `confirmedAt: now` (the wake's time, not the record's `createdAt`) | RT “the hook was skipped: the wake writes its entry …”, “confirmed more than 72 h ago …” — tsc 0 · RED `Tests  2 failed \| 68 passed (70)` |
| **N5 (review M1)** | reconcile's account check `(own.has(r.account) \|\| own.size === 0)` (no wallet stored → reconciled) | RT “nothing else is reconciled: … another wallet’s account …” — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| N6 | `r.state !== 'pending'` (a stuck, failed or expired purchase reconciled) | RT the same row — tsc 0 · RED `Tests  1 failed \| 69 passed (70)` |
| **N7 (ruling: at wake)** | `wakePresaleRecords` without `await reconcilePresaleRecords(ext, deps);` | ST “a start reconciles a confirmed purchase the hook never recorded: its entry written, then one POST”, RT “registerPresale registers the alarm’s run: it reconciles, …” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  2 failed \| 77 passed (79)` |
| **N8 (Review Focus 1: the window)** | `pendingStore.ts`: `export const MAX_RECORDS = 21;` (the window one record wider) | RW “20 newer closed records push it out …” — tsc 0 · RED `Tests  1 failed \| 1 passed (2)` (the 19-record row stays green) |
| N9 | `record.ts` reconcile: `if (confirmed.length >= 0) return;` (it never writes an entry) | RW “19 newer closed records: the purchase is still held …” — tsc 0 · RED `Tests  1 failed \| 1 passed (2)` (the 20-record row stays green: the two rows are each other's controls) |
| G1 | `messages.ts`: `'presale.unrecorded',` in the shared `WALLET_UI_ONLY` (a marker in shared code) | both builds, then `node scripts/check-no-presale.mjs dist-nopresale dist` — tsc 0 · exit 1: `off build: app/background.js contains the presale marker "presale.unrecorded"` (and `chrome/`, `firefox/`) |
| G2 | `accountsStore.ts`: the key and the wipe defined locally (`'v1_records'`, a no-op) instead of imported from `presaleRecordsKey.ts` | both builds, then the gate — tsc 0 · exit 1: `off build does not carry src/background/presaleRecordsKey.ts — renamed or moved? …` and `off build: no file contains "v1_presale_records" — the switch stripped what both builds need` |

51 mutations (the first issue's 42, re-run on the final commit — the counts above — N1–N7 for the controller's reconcile ruling, and N8–N9 for Review Focus 1, run on the rebuilt 65846e2), all red, every one compiling. **Three mutants of the first sweep were rewritten:** M15 (`Object.keys(d).length === 0`) did not compile (`DATA_KEYS` unused — `noUnusedLocals`); M8 (`Math.min(e.nextAt, until)`) and any mutant that leaves a claimed entry due at `now` turn the run into a loop of resolved promises that never yields to vitest's timer (a hang ended only by `timeout 300`, which proves nothing) — M8 is the form above, and the claim-before-send property is held by M4 / M24 and the restarted-worker row instead of by a mutant of the claim itself. An `origin` / kind pre-filter in reconcile was dropped rather than left as an equivalent mutant (`purchasePayload` reads back only a `presale-buy` record's data). An `origin` / kind pre-filter in reconcile was dropped rather than left as an equivalent mutant (`purchasePayload` reads back only a `presale-buy` record's data). **M5 was green on the first sweep** (the inner loop already sends an entry written during a POST): the `again` flag only matters for a call that lands while the run arms its alarm — the loop now re-checks after arming, and the row “… while the run is arming its alarm …” is what M5 turns red.

#### Notes for the executor (Task 1)

- **Ruling: the key `v1_presale_records` and its lock are shared code (`presaleRecordsKey.ts`, `BOTH_BUILDS`), and the key is a `MUST_STAY` string, not a marker** — spec §6.2 lists it among the markers, but §2.4 puts it in `WALLET_DATA_KEYS` (shared, both builds), and a delete must wipe a wallet's records in the build without presale too (an update that turned presale off would otherwise leave the purchases of a deleted wallet behind; C19's own case). The off build names the key and never writes it — cost if wrong: one key name in the off build; the module gate still proves no presale *module* there (G2 is the control). Rev 3.4's change list must carry this line.
- **Ruling: the records are removed behind their own lock** (`wipePresaleRecords` inside `presaleRecordsSection`, like `wipeDappStores`) — the retry writes on its own schedule, so a plain `remove` could be undone by a write-back in flight (B1c's fix-round-1 lesson; M32's row proves the lock, a plain delete passes every other row) — cost if wrong: none.
- **Ruling: a 400 is final (`refused`, D29) only when its body is the route's own refusal** — `{success: false, error: <string>}`, what all four 400s of `server.js:438-461` send; a 400 without that body (a proxy's, a CDN's) is retried — why: B1b's broadcast rule ("only the route's own refusal proves …"), and a retry is harmless under P2a — cost if wrong: such a 400 retried until 72 h.
- **Ruling: C24's slots are offsets from `confirmedAt`** — 0, 1 min, 5 min, 30 min, 2 h, 12 h, 24 h, 48 h, 72 h ("every 24 h until 72 h" read as 24, 48 and 72 h after confirmation); an entry is given up after a failed attempt with no slot left. A worker asleep across slots POSTs once when it wakes (not once per missed slot) and then waits for the first slot after now; one asleep past 72 h makes one last attempt — why: the anchor keeps the schedule C24's whatever the worker does; one late attempt costs nothing under P2a — cost if wrong: one extra POST of a record more than 72 h old.
- **Ruling: the store drops the oldest `done` entry first, then `given-up`, `refused`, `due`** — spec §2.4 says "the oldest given-up entry dropped first"; dropping a `done` one changes nothing anyone sees, while dropping a `given-up` one would silently take #27's Q34 away from a purchase the coordinator never accepted — cost if wrong: none in practice (50 records is one purchase a day for seven weeks). Rev 3.4 line.
- **Ruling: `refused` is the fourth state (D29) and `presale.unrecorded` lists `due`, `given-up` and `refused`** — D29: "#27 still shows Q34 for it" — cost if wrong: none.
- **Ruling: a 403 or the cool-down sets `nextAt` = max(the claimed slot, the latch's persisted end, `v1_forbidden_until`)** — the latch writes the end before it throws, so the record reads the same value every route obeys; a failed save of it leaves the slot, and the latch itself still refuses inside the window (RpcCoolingDown, nothing sent, the entry waits again) — cost if wrong: one refused attempt.
- **Ruling: the hook runs only for an account of the wallet stored now** (the poller's existing `own` set, review M1 — as known recipients): a purchase that confirms after its wallet was deleted is not recorded by this wallet — cost if wrong: one record the coordinator gets only from its own sources.
- **Controller ruling (on concern 1 of the first issue): reconcile when the worker wakes.** "Once" is per transition (the poller calls the hook after its own write moved the record to `confirmed`: M25), so a worker stopped between that write and the hook's entry would lose the record. At each start and on the `presale-record` alarm, `wakePresaleRecords` first reconciles (behind the records' section): every confirmed record of the stored wallet's accounts in `v1_pending` whose data reads back as a purchase and that has no entry gets the hook's entry, `confirmedAt` = its `createdAt`; past 72 h it is written `given-up` and never POSTed (N1–N7).
- **Ruling: `confirmedAt` of a reconciled entry is the pending record's `createdAt`** — the ruling's "the pending record's own confirmation time" does not exist: `PendingRecord` stores none, and adding one would change every stored record's bytes (the 0b79442 capture rows pin them). The signed bytes can land only within their blockhash's life after `createdAt` (≈ 150 blocks), so `createdAt` is early by at most that — the 72 h window shrinks by about a minute, never grows — cost if wrong: a record about a minute short of its last slot.
- **The window (asked by the ruling): a confirmed record stays in `v1_pending` with no time limit, until newer records push it out or a delete clears it** — `MAX_RECORDS` = 20 records in all (`pendingStore.ts` `trim`: every open record kept, the newest closed ones filling the rest), counted over every account and kind, sends and dApp records included; `vault.forgetWallet` removes the closed records. So a missed entry is recoverable until about twenty later transactions of this browser's wallet; past that, there is nothing to reconcile and the purchase stays unrecorded (no Q34 either — #27 lists only entries).
- **Ruling: reconcile filters on `state === 'confirmed'` and the stored wallet only**; which records are purchases is `purchasePayload`'s to say (only a `presale-buy` record's display data reads back) — an `origin` / kind pre-filter would be an equivalent mutant, a check no test can prove — cost if wrong: none.
- **Ruling: display data that does not read back records nothing** (`purchasePayload` null) — unreachable in practice: `pendingData` is null only when `shownOf` fails, and `beforeSign` refuses such an entry first — cost if wrong: none.
- **Ruling: `PresaleHost.alarm(name, run)`, dispatched by name in `index.ts`, a shared alarm's name refused at start** — index.ts names nothing of presale; the alarm's name lives only in `record.ts` (and joins `MARKERS` with `presale.unrecorded` — beyond the brief's rule, which asks only for message types and §10 strings; stricter) — cost if wrong: none.
- **Ruling: the wake runs at every start** (`registerPresale` starts one, reconcile first) — an alarm does not survive every browser restart or update — and **an empty store touches no alarm** (start.test's existing rows count the alarms a start clears) — cost if wrong: none.
- **Ruling: `WalletDeps.postJson` is required** (the fakes throw `unexpected POST` by default, as for the broadcast and the geo check) — cost if wrong: none.
- **Ruling: the fake coordinator's record route and E2E 1's row are added here, not in Task 6** — from this task on every confirmed purchase POSTs its record, and the fake lists any unknown request as `unexpected` (`contained(h)` would fail E2E 1, 5, 6). The route answers `200 {success: true, verified: true, duplicate: false, data: null}`; Task 6 scripts it (500 / timeout / 400 / 429 / 403) — cost if wrong: none.
- **Deviation (stated):** the whole Playwright suite (96, both modes) ran on 5070c79; since then `runPresaleRecords` re-checks after arming its alarm (M5) and the wake reconciles (the ruling) — on the final commit the three presale specs ran (both modes), as the ruling asked.
- **For the next tasks:** Task 2 — the record's `referrerAddress` is `extra.data.referrer`; `shownOf` (buy.ts) reads back only `referrer.registers === false` and `purchasePendingData` copies `shown.view.referrer.address`: once a purchase registers a referrer, both must carry it (the record then needs no change). Task 5 — `presale.unrecorded` answers `string[]` (signatures), `refused` included. Task 6 — `fake.purchaseRecords` is the record log; the background's clock is the browser's (`Date.now` in `browserDeps`), so E2E 10–12 cannot wait out the 1 min slot by a fake clock: they need either the real minute or a test-only way to make an entry due (e.g. rewriting `nextAt` in `v1_presale_records` through the service worker, then firing the alarm) — Task 6's call, stated there. Task 7 — rev 3.4's change list gains: the key as `MUST_STAY` (not a marker), the drop order, the route's-own-400 rule, the slot reading, `refused`.
- **Found while revising:** the 50-entry store row signed about 200 wires (1.1 s) and timed out at vitest's 5 s under the dry run's parallel load (a mutation sweep beside Playwright); its fixtures now use signature-shaped base58 strings (31 ms). The same load also times out B1b's two `start.test.ts` rows that import the whole background (`import('../index')`), unchanged by this task — totals here are from quiet runs.
- **Dry run:** clone `dry/b1d2`, commit `a532235` on a1bda47 (after the controller's ruling; the first issue was 32ad708). Root `tsc` + `jest` and web `verify` ran on 5070c79 (no later change touches `core/` or the root). Replaying this part onto `git archive a1bda47` (3 new files, 30 diff blocks, each with `git apply --recount`) reproduces the commit byte for byte (all 33 files compared).
- **Review Focus 1 (added at the plan's assembly, 2026-10-26):** `reconcileWindow.test.ts` pins the reconcile's window — the accepted gap above — from both sides (19 newer closed records: recorded; 20: nothing, and no Q34). Added on `dry/b1d2-rf`, rebuilt from a1bda47: Task 1 = 65846e2 (a532235 + this one file), Tasks 2–7 cherry-picked onto it (1256554, 49cc8f0, f8db19e, 3a04191, 5b42436, 5c3bf42 — each tree its first commit's + this file). Red on a1bda47 with Step 1's files (`tsc` 2, 52 errors; the file fails to load — the counts above), green on 65846e2 (`tsc` 0, the whole on-build run 215 / 4523, the off run unchanged at 16 / 430 + 15); N8 and N9 red. Every later task's whole-suite totals below are its first run's + 1 file and + 2 tests (each re-run on its rebuilt commit); the replay of this part now adds 4 new files and 30 diff blocks.

---

### Task 2: The referrer in prepare and sign (FUNDS-CRITICAL) — `presale.checkReferrer` (§3.5's order: invalid → self — the buyer or any account of this wallet, the session's and the stored wallet's — → not-applicable → no-allocation; the key's lines with no network, the chain's with one `getAccountsData`), `intent.referrer` in `presale.prepareBuy` (present only when entered: a purchase without one is B1d-1b's byte for byte, captured from a1bda47; with one, the kind's digest binds it), prepare checking it again against its own fresh snapshot and a fresh read of the referrer's allocation, then building with `referrerAllocationOf(snapshot, account, intent.referrer)` → `register_referrer` + account 3; a referrer the purchase would not register refused `referrer-not-applicable`, never dropped; the simulation's `referrer@84` after = the referrer the purchase credits (for every purchase); the busy-destination retry re-resolving it; `beforeSign` re-verifying the `register_referrer` instruction and account 3 from the integrity-bound bytes (and the referrer's allocation and the wallet's accounts read again), `state-changed` when the allocation's referrer or `purchase_count` moved; a registration signed only behind a re-authentication; `shownOf` / the pending data carrying a registered referrer (the record's `referrerAddress`); #10's "Referred by" + Q47

**Spec:** B1d §1.4 (`presale.checkReferrer`; `presale.prepareBuy`'s `intent.referrer: string | null`; the strict-payload paragraph — a referrer neither null nor 32–44 base58 characters is `malformed`), §2.1 (`referrerAllocation` with `captured`; rule 6, now `allocationFacts`), §2.3 (`extra.data.referrer` = the effective referrer), §3.3 (B1d-2 clauses: step 2 "`intent.referrer` checked as §3.5", step 4 "with `registerReferrer` when §3.5 applies", step 5 "when a referrer is registered, `referrer@84` after = it" and the retry's "the referrer (B1d-2)", step 6 "the digest includes `referrer`"; the `register_referrer` account list), §3.4 (a registration is always a first purchase, so always re-authenticated; #10 shows its row, Q47), §3.5 (all), §4.2 (#10: "Referred by" with the whole address in groups of four, Q47's note when this purchase registers it), §5 (the `referrer-*` rows; `state-changed`; the AlreadyHasReferrer row), §6.1 "Referral address (2)"; C7, C22, C27, C32, C37, C39; D3, D8; Q47 (§10). Brief item 2 and "Carried from B1d-1b" (sign-time re-verification from the integrity-bound bytes — now the `register_referrer` instruction and account 3 too; `newPdaRent` unchanged in total and still taken from the simulation when `register_referrer` creates the PDAs; `ON_BUILD` / `MARKERS` — `MARKERS` 76 → 79; both builds; Playwright at a task that registers a message). Ledger MUST for Task 2: `shownOf` / the pending data carry a newly registered referrer, so the record's `referrerAddress` (Task 1) is filled — proven end to end (the POST body). Previous part: Task 1 (its Interfaces).

**Files:**
- Modify: `extension/src/background/presale/buy.ts` (the intent's optional `referrer`; the digest; `ReferrerLine`; `checkReferrer`; the key and chain lines; `walletAccounts`; `readReferrerAllocation`; `assertPurchaseMessage` with `registerReferrer`; `judge`'s `referrer@84`; prepare's step 2, step 4, the retry, the view and the challenge's `referrer`; `signedPurchase` from the bytes; `beforeSign`'s referrer re-check; `shownOf` with `registers: true`; `PurchaseAbout.referrer?`), `extension/src/background/presale/state.ts` (`allocationFacts` — rule 6 moved out of `stateFrom`, unchanged; `referrerAllocationOf(snapshot, account, captured = null)`), `extension/src/background/presale/api.ts` (`presale.checkReferrer`), `extension/src/unlock/presale.ts` (#10's "Referred by" and Q47's note)
- Modify (the gate's staged list): `extension/scripts/check-no-presale.mjs` (`MARKERS` + `presale.checkReferrer`, `Referred by`, Q47's note)
- Create (tests): `extension/src/background/presale/__tests__/referrer.test.ts`, `extension/src/background/presale/__tests__/purchaseFlows.ts` (the three purchases, runnable on a1bda47 and here), `extension/src/background/presale/__tests__/captured.test.ts`, `extension/src/background/presale/__tests__/captured/purchases.a1bda47.json` (generated in Step 1 by the capture step — never hand-edited)
- Modify (tests): `extension/src/background/presale/__tests__/simulation.ts` (the honest simulation applies `register_referrer`; AlreadyHasReferrer when one is on chain), `extension/src/background/presale/__tests__/buy.test.ts` (`assertPurchaseMessage`'s new argument; two rows whose `referrer: null` is now accepted), `extension/src/background/presale/__tests__/api.test.ts`, `extension/src/background/__tests__/messages.test.ts` (both builds), `extension/src/__tests__/presaleSwitch.test.ts` (the tenth type), `extension/src/unlock/__tests__/reauthPurchase.test.ts` (#10's row), `extension/scripts/__tests__/check-no-presale.test.mjs` (`MARKERS`, ten types)

**Interfaces:**
- Consumes: B1d-1b's `preparePurchase` / `PRESALE_BUY_INTENT` / `PurchaseIntent` / `PurchaseRefused` / `PurchaseView` / `PreparedPurchase` / `assertPurchaseMessage` / `expectedPurchaseAccounts` / `shownOf` / `signedPurchase` / `judge` (`buy.ts`), `readPresaleStateAt` / `referrerAllocationOf` / `allocationRefOf` / `PresaleSnapshot` (`state.ts`), `PRESALE_ALLOCATION_LAYOUT` (`layouts.ts`), `registerPresale` / `PRESALE_MESSAGE_TYPES` / `onlyKeys` / `sessionRefusal` / `guarded` / `MALFORMED` (`api.ts`), `getSession`, `readWalletView` (`accountsStore.ts`), `isAddress` (`prepare.ts`), `describePresale` / `OtherDescription` (`unlock/presale.ts`, `unlock/challenge.ts`); core's `resolveReferrerWith` / `AllocationRef` (`core/presale/referrer.ts`), `buildBuyInstructions` / `buildStablecoinBuyInstructions` / `REGISTER_REFERRER_DISCRIMINATOR` (`core/presale/buyInstructions.ts` — unchanged: the builders already put `register_referrer` between the compute budget and the purchase), `derivePresalePdas`. Task 1's `recordConfirmedPurchase` / `purchasePayload` / `readPresaleRecords` / `runPresaleRecords` (`record.ts`, unchanged), `WalletDeps.postJson`. Tests: `chain.ts`'s byte builders, `simulation.ts`'s `honestSimulation`, `fixtures.ts`.
- Produces (`extension/src/background/presale/state.ts`):
  ```ts
  export function allocationFacts(allocation: AccountData | null | undefined, owner: string): AllocationFacts | null;   // §2.1 rule 6 for any owner: absent → exists false; null = malformed
  export function referrerAllocationOf(snapshot: PresaleSnapshot, account: string, captured?: string | null): Promise<ResolvedReferrer>;   // core's resolveReferrerWith on this snapshot
  ```
- Produces (`extension/src/background/presale/buy.ts`):
  ```ts
  export interface PurchaseIntent {currency: PresaleCurrency; amount: string; stage: number; referrer?: string}   // `referrer` present only when entered
  export type ReferrerLine = 'referrer-invalid' | 'referrer-self' | 'referrer-not-applicable' | 'referrer-no-allocation';
  export type PurchaseRefusal = /* B1d-1b's */ | ReferrerLine;
  export function parsePurchaseIntent(x: unknown): PurchaseIntent | null;   // + referrer: absent / null → no key; else ^[1-9A-HJ-NP-Za-km-z]{32,44}$
  export function checkReferrer(ext: Ext, deps: WalletDeps, account: string, referrer: string): Promise<ReferrerLine | null>;   // throws PurchaseRefused on a failed read
  export function assertPurchaseMessage(message: MessageV0, i: {account; currency; referrerAllocation; destination; source: string | null; amount: bigint; registerReferrer: string | null}): number;   // the purchase's index: 2, or 3 after a register_referrer
  export interface PurchaseAbout {/* B1d-1b's */ referrer?: {address: string; registers: boolean}}   // present only when the purchase credits a referrer
  ```
  `presale.checkReferrer {account, referrer}` (appended to `PRESALE_MESSAGE_TYPES`; the popup and the full tab only) → `{ok: true, data: {ok: true}}` or `{ok: true, data: {ok: false, line: ReferrerLine}}`; a failed read → `{ok: false, error: 'presale-unavailable' | 'coordinator-refused', data?: {detail}}`; `malformed` for a key besides `account` and `referrer`, a non-address account or a `referrer` that is not a string of 32–44 base58 characters; then `locked` / `unknown-account`, nothing read.
  `presale.prepareBuy`'s intent may carry `referrer` (a string, or null = none); its refusals gain the four `ReferrerLine` codes; `PurchaseView.referrer` is `{address: <the referral address>, registers: true}` when the purchase registers it (and `simulation.instructionCount` 4), `{address, registers: false}` for an on-chain referrer, null for none. The challenge's `PurchaseAbout` carries `referrer` exactly when the view does.
  **What later tasks rely on:** Task 3's field asks `presale.checkReferrer {account, referrer}` on blur and renders the four lines (Q46 a–c, Q48) from `data.line`; it sends `intent.referrer` (the field's text, or omits it / null when empty) and translates the four prepare refusals (today the popup's `PrepareRefusal` list does not name them, so they read as `failed` until Task 3); #20 renders `PurchaseView.referrer` — "Referred by" and, when `registers`, Q47's note. **`presale.view` does not carry §2.5's `referral` yet** — the popup's `presaleViewOf` parses the open view with exact keys, so adding it here would close #23; Task 3 adds it to both sides together (`{onChain, canRegister}` = the snapshot's referrer and `firstPurchase && onChain === null`). Task 6's fake program needs `register_referrer` (set the allocation's referrer, create the two PDAs) and a referrer's allocation for E2E 12; `purchaseFlows.ts` / `captured.test.ts` stay green through B1d-2 (a purchase without a referral address keeps B1d-1b's bytes).

**How the referral address moves (§3.5, C32, D8).** The popup decides nothing: `presale.checkReferrer` answers the field's line, and prepare and the signature decide again. **The lines, in §3.5's order:** `referrer-invalid` — not 32 bytes of base58, or the default key (core's `captureIsValid` without its self test, which §3.5 answers as `referrer-self`); `referrer-self` — the buyer, or any account of this wallet: the unlocked session's and the stored wallet's (`readWalletView`) together — stricter than "the buyer", as C32 allows; `referrer-not-applicable` — the purchase would not register it, decided by core's `resolveReferrerWith` itself on the buyer's allocation (an on-chain referrer — which always wins — or not a first purchase), the same function the purchase is built with, so what is accepted is exactly what is registered; `referrer-no-allocation` — its `["allocation", referrer]` absent, or not a PresaleAllocation of it by §2.1 rule 6 (`allocationFacts`: the program's, 117 bytes, the discriminator, `user@8` = the referrer, `claimed` 0 or 1). The first two need no network; the last two need the buyer's allocation and the referrer's: `checkReferrer` reads both in one `getAccountsData`; prepare reads the referrer's (the buyer's is in its snapshot). **Prepare (§3.3 step 2):** after the gate and the stage, the lines run against this prepare's fresh snapshot — a refusal is the line's code, before anything is built or simulated: the input is never dropped. **Build (step 4):** `referrerAllocationOf(snapshot, account, referrer)` → `register_referrer(referrer)` between the compute budget and the purchase, and account 3 = `["allocation", referrer]` (core's builders, unchanged); `assertPurchaseMessage` checks the registration exactly — four instructions, its accounts in the IDL's order (`user_account, user_allocation, user, system_program`) and its data (the discriminator, then the 32 bytes) — and its absence for every other purchase. **Simulate (step 5):** the same accounts as B1d-1b (the user account when the snapshot found it absent); `register_referrer` creates the two PDAs (`init_if_needed`), so their rent is now paid inside it and the total is unchanged — each still measured from the post-state, > 0 and ≤ its bound; **`referrer@84` after must be the referrer the purchase credits** — the registered one, else the on-chain one as it was, else 32 zero bytes (checked for every purchase: a lying simulation that rewrites or drops the referrer is a mismatch). The program refusing the registration (AlreadyHasReferrer, 6016, on instruction 2) is `simulation-failed`. **The retry (C39)** re-resolves on the fresh snapshot: the referrer allocation and whether it registers must both be what the bytes were built from, else `state-changed` (a referrer registered meanwhile — another, or this very one from another device, which would make the second registration fail on chain). **Re-authentication (§3.4):** a registration is only ever a first purchase (`resolveReferrerWith` registers only then), so its challenge always carries `first-purchase`; #10's description carries `referrer: {address, registers: true}` and the store refuses a registering description without that reason. **The signature (C22, review 1 M1):** the intent — bound by the integrity — names the referral address, so `signedPurchase` resolves it on the fresh snapshot exactly as prepare did and requires the bytes to be that purchase: the registration of that address and its allocation as account 3; if they are instead what prepare built while the fresh snapshot resolves otherwise (a referrer registered, a purchase made, since) → `state-changed`; anything else → `prepared-invalid`. An entry whose intent names a referral address and whose `challengeId` is null is `prepared-invalid` (a registration is permanent: it never signs without a proof). Then C22's basis (`purchase_count`, referrer, the PDAs' existence → `state-changed`), then the lines again on a fresh read of the referrer's allocation and the wallet's accounts as they are now (`referrer-self`, `referrer-no-allocation`; a failed read is its code), then the limits. Nothing is burned by a refusal (C29). **The record:** `shownOf` reads back a registered referrer (`registers: true`, the intent's address, one instruction more), so `pendingData`'s `referrer` — and with it Task 1's `referrerAddress` — is the registered referrer; the record's code is unchanged.

- [ ] **Step 1: Capture B1d-1b's purchase, then write the failing tests.**

"A purchase without a referral address is byte for byte B1d-1b's" is compared with what B1d-1b's own code computed, not with a hand-written expectation (as 1a's `sends.0b79442.json`). `purchaseFlows.ts` (below, committed) runs three purchases using only what a1bda47 (main, B1d-1b merged) already has — `preparePurchase`, `sendPrepared(…, 'presale-buy')`, `pollOnce`, `chain.ts`, `simulation.ts` — and returns their digests, integrity, view, stored entry, challenge, signed wire and pending record (sent and confirmed). The fixture is its output on a1bda47, written once by the capture program below in a scratch copy (the program is not committed). Create `purchaseFlows.ts` first (its full text is below), then, from the repository root:

```bash
F=$(mktemp -d)
OUT="$PWD/extension/src/background/presale/__tests__/captured/purchases.a1bda47.json"
mkdir -p "$(dirname "$OUT")"
git archive a1bda47 | tar -x -C "$F"
ln -s "$PWD/node_modules" "$F/node_modules"; ln -s "$PWD/web/node_modules" "$F/web/node_modules"; ln -s "$PWD/extension/node_modules" "$F/extension/node_modules"
cp extension/src/background/presale/__tests__/purchaseFlows.ts "$F/extension/src/background/presale/__tests__/"
cat > "$F/extension/src/background/presale/__tests__/capture-purchases.test.ts" <<'CAPTURE'
// B1d-2 Task 2, Step 1: run ONCE in a `git archive a1bda47` copy (never committed) beside purchaseFlows.ts copied from
// this task. It records what B1d-1b's purchase computes and stores. Output: the JSON file named by CAPTURE_OUT.
import {writeFileSync} from 'node:fs';
import {registerPresale} from '../api';
import {registerPresaleHandler} from '../../messages';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {runPurchaseFlows} from './purchaseFlows';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler});

it('captures the purchase of this commit', async () => {
  const out = process.env.CAPTURE_OUT;
  if (out === undefined) throw new Error('CAPTURE_OUT is not set');
  writeFileSync(out, `${JSON.stringify(await runPurchaseFlows('commit a1bda47 (main, B1d-1b merged) — B1d-2 Task 2 capture step'), null, 2)}\n`);
});
CAPTURE
(cd "$F/extension" && npx tsc --noEmit; echo "tsc $?" && CAPTURE_OUT="$OUT" npx vitest run src/background/presale/__tests__/capture-purchases.test.ts)
rm -rf "$F"
sha256sum "$OUT"
```

Expected: `tsc 0`, `Tests  1 passed (1)`, a 22 391-byte file, sha256 `dbc8fa655377ca41ad4c04449af8b4ac7444e3a31563da2ef625dc727e5364be` (run twice in the dry run, from two fresh copies: the same bytes). It holds six digests (three intents × two accounts), two integrities (with and without a challenge) and three flows: `firstSol` (2 SOL, both PDAs created, the challenge with three reasons), `repeatUsdc` (20 USDC from an allocation that bought before — no challenge), `onChainReferrerSol` (0.2 SOL credited to an on-chain referrer — no challenge, so every byte of it is B1d-1b's too).

Create `extension/src/background/presale/__tests__/purchaseFlows.ts`:

```ts
import {base64} from '@scure/base';
import {PRESALE_BUY_INTENT, preparePurchase, type PurchaseIntent} from '../buy';
import {intentDigest} from '../../intents';
import {preparedIntegrity} from '../../prepare';
import {sendPrepared} from '../../send';
import {satisfyChallenge} from '../../reauthChallenges';
import {PREPARED_KEY, REAUTH_KEY} from '../../session';
import {PENDING_KEY} from '../../pendingStore';
import {pollOnce} from '../../pending';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL, unlocked} from '../../__tests__/fixtures';
import {MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {firstSignature} from '../../../../../core/solana/broadcast';
import type {AccountData, TokenAccountEntry} from '../../../../../core/solana/rpc';
import {ACCOUNT, NOW_MS, REFERRER, allocationData, chainMap, chainReader, program, userData, type Chain} from './chain';
import {honestSimulation} from './simulation';

// B1d-2 Task 2: the purchases B1d-1b made, as flows that run unchanged on B1d-1b's tree (main a1bda47) and on this one —
// the capture step ran them there once and wrote `captured/purchases.a1bda47.json`; captured.test.ts runs them here and
// compares byte for byte. Only what both trees have is used: the purchase's prepare and the shared pipeline, chain.ts's
// chain and simulation.ts's honest simulation. Every flow names no referral address (B1d-2's new input).

const SOL_USD = 198.42;
const HOLDINGS: TokenAccountEntry[] = [
  {pubkey: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', mint: MAINNET_USDC_MINT, owner: ACCOUNT, amount: 30_000_000n, decimals: 6},
  {pubkey: HOLDING_LARGE, mint: MAINNET_USDC_MINT, owner: ACCOUNT, amount: 500_000_000n, decimals: 6},
  {pubkey: HOLDING_SMALL, mint: MAINNET_USDT_MINT, owner: ACCOUNT, amount: 70_000_000n, decimals: 6},
];

export interface PurchaseFlow {
  intent: PurchaseIntent;
  view: string;
  prepared: string;
  challenges: string;
  wire: string;
  sent: string;
  polled: string;
}
export interface PurchaseCapture {
  capturedFrom: string;
  digests: {account: string; intent: PurchaseIntent; digest: string}[];
  integrity: {entry: Record<string, unknown>; integrity: string}[];
  flows: Record<'firstSol' | 'repeatUsdc' | 'onChainReferrerSol', PurchaseFlow>;
}

const text = (v: unknown): string => JSON.stringify(v ?? null);

/** One purchase through the engine: prepared, proven when asked, signed and sent once, then confirmed. */
async function flow(chain: Partial<Chain>, intent: PurchaseIntent): Promise<PurchaseFlow> {
  const ext = fakeExt();
  await unlocked(ext);
  const map: Map<string, AccountData | null> = chainMap(chain);
  const sol = 5_000_000_000n;
  const reader = chainReader(map, [], {
    getBalance: async () => sol,
    getTokenAccountsByOwner: async (_owner, filter) => HOLDINGS.filter(h => 'mint' in filter && h.mint === filter.mint),
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    simulateTransaction: async (wire, opts) => honestSimulation(wire, opts?.accounts ?? [], map, sol, HOLDINGS, SOL_USD),
  });
  const deps = fakeDeps({reader, geo: async () => ({open: true, reason: null, countryCode: 'SI'}), prices: async () => ({solana: SOL_USD, usdc: 1, usdt: 1})});
  deps.clock.t = NOW_MS;
  deps.broadcast = async wire => {
    deps.broadcasts.push(wire);
    return firstSignature(wire);
  };
  const view = await preparePurchase(ext, deps, ACCOUNT, intent);
  const prepared = text(await ext.session.get(PREPARED_KEY));
  const challenges = text(await ext.session.get(REAUTH_KEY));
  if (view.reauth !== null && !(await satisfyChallenge(ext, deps.now(), view.reauth.challengeId))) throw new Error('the challenge was not proven');
  await sendPrepared(ext, deps, view.id, 'presale-buy');
  const sent = text(await ext.local.get(PENDING_KEY));
  deps.reader = {...deps.reader, getSignatureStatuses: async sigs => sigs.map(() => ({err: null, confirmationStatus: 'confirmed' as const})), getBlockHeight: async () => 900};
  deps.clock.t += 2_000;
  await pollOnce(ext, deps);
  const polled = text(await ext.local.get(PENDING_KEY));
  const wire = deps.broadcasts.map(w => base64.encode(w));
  if (wire.length !== 1) throw new Error(`${wire.length} broadcasts`);
  return {intent, view: text(view), prepared, challenges, wire: wire[0] as string, sent, polled};
}

export async function runPurchaseFlows(capturedFrom: string): Promise<PurchaseCapture> {
  // 1. The challenge digest of a purchase: three currencies, the u64 bounds, three stages, two accounts.
  const intents: PurchaseIntent[] = [
    {currency: 'SOL', amount: '2000000000', stage: 0},
    {currency: 'USDC', amount: '1', stage: 9},
    {currency: 'USDT', amount: '18446744073709551615', stage: 3},
  ];
  const digests = [ACCOUNT, REFERRER].flatMap(account => intents.map(intent => ({account, intent, digest: intentDigest(PRESALE_BUY_INTENT, account, intent)})));
  // 2. The integrity of a stored purchase entry, with and without a challenge.
  const integrity = [null, 'ab'.repeat(16)].map(challengeId => {
    const entry = {id: 'cd'.repeat(16), account: ACCOUNT, kind: 'presale-buy', intent: intents[0] as PurchaseIntent, message: 'AQID', lastValidBlockHeight: 1000, createdAt: 1_000_000, intentDigest: 'ef'.repeat(32), challengeId};
    return {entry, integrity: preparedIntegrity(entry)};
  });
  // 3. Three purchases: a first SOL purchase (both PDAs created, re-authenticated); a USDC purchase from an account that
  // bought before (no challenge, the largest holding pays); a SOL purchase credited to an on-chain referrer (no challenge).
  const existing: Partial<Chain> = {user: program(userData()), allocation: program(allocationData())};
  return {
    capturedFrom,
    digests,
    integrity,
    flows: {
      firstSol: await flow({}, {currency: 'SOL', amount: '2000000000', stage: 0}),
      repeatUsdc: await flow(existing, {currency: 'USDC', amount: '20000000', stage: 0}),
      onChainReferrerSol: await flow({...existing, allocation: program(allocationData({referrer: REFERRER}))}, {currency: 'SOL', amount: '200000000', stage: 0}),
    },
  };
}
```

Create `extension/src/background/presale/__tests__/captured.test.ts`:

```ts
import {readFileSync} from 'node:fs';
import {registerPresale} from '../api';
import {registerPresaleHandler} from '../../messages';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {runPurchaseFlows, type PurchaseCapture} from './purchaseFlows';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

/** What commit a1bda47 (main, B1d-1b merged) computed and stored — generated by B1d-2 Task 2's capture step, never edited. */
const CAPTURED = JSON.parse(readFileSync(new URL('./captured/purchases.a1bda47.json', import.meta.url), 'utf8')) as PurchaseCapture;

// B1d-2 Task 2: a purchase that names no referral address is byte for byte B1d-1b's — its digest, its integrity, the
// view, the stored entry, the challenge, the signed bytes and the pending record, sent and confirmed — compared with what
// B1d-1b's own code computed, not with a hand-written expectation.
describe('a purchase without a referral address is byte-for-byte B1d-1b’s (captured from commit a1bda47)', () => {
  it('the fixture is the capture step’s output', () => {
    expect(CAPTURED.capturedFrom).toMatch(/^commit a1bda47 /);
    expect(CAPTURED.digests).toHaveLength(6);
    expect(CAPTURED.integrity).toHaveLength(2);
    expect(Object.keys(CAPTURED.flows)).toEqual(['firstSol', 'repeatUsdc', 'onChainReferrerSol']);
  });

  it('every digest, every integrity, and the three purchases replayed — a first SOL purchase with its challenge, a USDC purchase, one credited to an on-chain referrer', async () => {
    const now = await runPurchaseFlows(CAPTURED.capturedFrom);
    expect(now.digests).toEqual(CAPTURED.digests);
    expect(now.integrity).toEqual(CAPTURED.integrity);
    for (const name of ['firstSol', 'repeatUsdc', 'onChainReferrerSol'] as const) {
      const [was, is] = [CAPTURED.flows[name], now.flows[name]];
      for (const key of ['view', 'prepared', 'challenges', 'wire', 'sent', 'polled'] as const) expect([name, key, is[key]]).toEqual([name, key, was[key]]);
    }
  });
});
```

Create `extension/src/background/presale/__tests__/referrer.test.ts`:

```ts
import {MessageV0, PublicKey, TransactionMessage, VersionedMessage, VersionedTransaction, type TransactionInstruction} from '@solana/web3.js';
import {base58, base64} from '@scure/base';
import {ed25519} from '@noble/curves/ed25519.js';
import {PRESALE_BUY_INTENT, assertPurchaseMessage, parsePurchaseIntent, preparePurchase, type PreparedPurchase, type PurchaseIntent, type PurchaseView} from '../buy';
import {registerPresale} from '../api';
import {readPresaleRecords, runPresaleRecords} from '../record';
import {handleMessage, registerPresaleHandler} from '../../messages';
import {PRESALE_ALLOCATION_LAYOUT} from '../layouts';
import {intentDigest, type KindAbout} from '../../intents';
import {challengeInfo, challengeSatisfied, issueChallenge, satisfyChallenge} from '../../reauthChallenges';
import {PREPARED_KEY, REAUTH_KEY, clearSession, getSession, setSession} from '../../session';
import type {SessionAccount} from '../../../vault/accounts';
import {PENDING_KEY} from '../../pendingStore';
import {preparedIntegrity} from '../../prepare';
import {pollOnce} from '../../pending';
import {VAULT_KEY} from '../../accountsStore';
import type {PostAnswer} from '../../deps';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {ACCOUNT as SESSION_ACCOUNT, BLOCKHASH, HOLDING_LARGE, HOLDING_SMALL, unlocked} from '../../__tests__/fixtures';
import type {GeoAnswer} from '../../geo/gate';
import {PRESALE_INSTRUCTIONS} from '../../dapp/decode/presaleIdl';
import {describePresale} from '../../../unlock/presale';
import {MAINNET_PROGRAM_ID, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
import {derivePresalePdas} from '../../../../../core/presale/allocation';
import {buildBuyInstructions} from '../../../../../core/presale/buyInstructions';
import {PRESALE_ALLOCATION_RENT_LAMPORTS} from '../../../../../core/presale/limits';
import {firstSignature} from '../../../../../core/solana/broadcast';
import {RequestUnreachable, RpcForbidden, SYSTEM_PROGRAM_ID, type AccountData, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../../core/solana/rpc';
import {ACCOUNT, NOW_MS, OTHER, REFERRER, SNAPSHOT_SLOT, TREASURY_ADDRESS, allocationData, chainMap, chainReader, program, userData, type Chain} from './chain';
import {ALLOCATION_RENT, USER_RENT, honestSimulation} from './simulation';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 2 (§3.3, §3.4, §3.5, C7, C22, C32, D8): the referral address — presale.checkReferrer, the prepare that
// checks it again and registers it in the purchase's own transaction (register_referrer, account 3), the simulation's
// referrer@84, the sign-time re-check from the bytes the integrity binds, the forced re-authentication, #10's rows and
// the record's referrerAddress. A purchase without one is B1d-1b's byte for byte (captured.test.ts).

const SOL_USD = 198.42;
const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
const PDAS = derivePresalePdas(new PublicKey(ACCOUNT));
const SOL_2 = '2000000000';
/** The referral address: a buyer with an allocation of their own. */
const R = REFERRER;
const allocationOf = (k: string): string => derivePresalePdas(new PublicKey(k)).userAllocation.toBase58();
const R_ALLOCATION = allocationOf(R);
const R_ALLOCATED: AccountData = program(allocationData({user: R, count: 1}));
/** A second account of this wallet (a real Ed25519 keypair, seed 32 × 0x02). */
const SEED2 = new Uint8Array(32).fill(2);
const PUB2 = ed25519.getPublicKey(SEED2);
const SECOND: SessionAccount = {index: 1, publicKey: base58.encode(PUB2), secretKey: base64.encode(new Uint8Array([...SEED2, ...PUB2]))};
const DEFAULT_KEY = '11111111111111111111111111111111';
const SHORT_KEY = base58.encode(new Uint8Array(31).fill(7));
const HOLDINGS: TokenAccountEntry[] = [
  {pubkey: HOLDING_LARGE, mint: MAINNET_USDC_MINT, owner: ACCOUNT, amount: 500_000_000n, decimals: 6},
  {pubkey: HOLDING_SMALL, mint: MAINNET_USDT_MINT, owner: ACCOUNT, amount: 70_000_000n, decimals: 6},
];
const EXISTING: Partial<Chain> = {user: program(userData()), allocation: program(allocationData())};
/** An allocation that exists but has never bought (purchase_count 0, no referrer): still a first purchase (C21). */
const NEVER_BOUGHT: Partial<Chain> = {user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n}))};

type Edit = (o: SimulationOutcome, at: (address: string) => number) => SimulationOutcome;
const nth = <T>(xs: readonly T[], k: number): T => xs[Math.min(k, xs.length - 1)] as T;

interface World {
  deps: ReturnType<typeof fakeDeps>;
  ext: ReturnType<typeof fakeExt>;
  reads: number;
  /** Every getAccountsData call's addresses (the referral address's reads), in order. */
  accountReads: string[][];
  wires: string[];
  asked: (readonly string[])[];
  posts: {path: string; body: unknown}[];
}

/**
 * The world of buy.test.ts, with the referral address's reads: `chains` each successive snapshot, `referrers` each
 * successive getAccountsData (by address; the buyer's own allocation from the current chain), `refErrors` failing one.
 */
async function world(
  o: {chain?: Partial<Chain>; chains?: Partial<Chain>[]; simChains?: Partial<Chain>[]; referrers?: Map<string, AccountData | null>[]; refErrors?: (Error | null)[]; edits?: (Edit | null)[]; geo?: () => Promise<GeoAnswer>; session?: SessionAccount[]} = {},
): Promise<World> {
  const chains = (o.chains ?? [o.chain ?? {}]).map(c => chainMap(c));
  const simChains = o.simChains === undefined ? chains : o.simChains.map(c => chainMap(c));
  const referrers = o.referrers ?? [new Map([[R_ALLOCATION, R_ALLOCATED]])];
  const sol = 5_000_000_000n;
  const w: World = {deps: fakeDeps(), ext: fakeExt(), reads: 0, accountReads: [], wires: [], asked: [], posts: []};
  let sims = 0;
  const reader = chainReader(chains[0] as Map<string, AccountData | null>, [], {
    getAccountsDataAt: async addresses => {
      const chain = nth(chains, w.reads++);
      return {slot: SNAPSHOT_SLOT, accounts: addresses.map(a => chain.get(a) ?? null)};
    },
    getAccountsData: async addresses => {
      const k = w.accountReads.length;
      w.accountReads.push([...addresses]);
      const fails = o.refErrors?.[k];
      if (fails !== undefined && fails !== null) throw fails;
      const refs = nth(referrers, k);
      const chain = nth(chains, Math.max(0, w.reads - 1));
      return addresses.map(a => (refs.has(a) ? (refs.get(a) ?? null) : (chain.get(a) ?? null)));
    },
    getBalance: async () => sol,
    getTokenAccountsByOwner: async (_owner, filter) => HOLDINGS.filter(h => 'mint' in filter && h.mint === filter.mint),
    getRecentPrioritizationFees: async () => [],
    getLatestBlockhash: async () => ({blockhash: BLOCKHASH, lastValidBlockHeight: 1000}),
    simulateTransaction: async (wire, opts) => {
      const k = sims++;
      w.wires.push(wire);
      w.asked.push(opts?.accounts ?? []);
      const addresses = opts?.accounts ?? [];
      const honest = honestSimulation(wire, addresses, nth(simChains, k), sol, HOLDINGS, SOL_USD);
      const edit = (o.edits ?? [])[k] ?? null;
      return edit === null ? honest : edit(honest, a => addresses.indexOf(a));
    },
  });
  const broadcast = async (wire: Uint8Array) => {
    w.deps.broadcasts.push(wire);
    return firstSignature(wire);
  };
  const postJson = async (path: string, body: unknown): Promise<PostAnswer> => {
    w.posts.push({path, body});
    return {status: 200, body: {success: true, verified: true, duplicate: false, data: null}};
  };
  w.deps = fakeDeps({reader, broadcast, postJson, geo: o.geo ?? (async () => OPEN), prices: async () => ({solana: SOL_USD, usdc: 1, usdt: 1})});
  w.deps.clock.t = NOW_MS;
  if (o.session === undefined) await unlocked(w.ext);
  else await setSession(w.ext, o.session);
  // The stored wallet holds the buyer (a confirmed purchase is recorded only for an account of the wallet stored now).
  await w.ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT}]});
  return w;
}

const intent = (currency: PurchaseIntent['currency'], amount: string, referrer?: string): PurchaseIntent => ({currency, amount, stage: 0, ...(referrer === undefined ? {} : {referrer})});
const prepare = (w: World, i: PurchaseIntent) => preparePurchase(w.ext, w.deps, ACCOUNT, i);
async function refusal(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    if (e instanceof Error && 'code' in e) return String((e as {code: unknown}).code);
    throw e;
  }
  throw new Error('not refused');
}
const stored = async (w: World): Promise<PreparedPurchase[]> => ((await w.ext.session.get(PREPARED_KEY)) as PreparedPurchase[] | undefined) ?? [];
const POPUP = (ext: ReturnType<typeof fakeExt>) => ({id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`});
const ask = (w: World, m: Record<string, unknown>) => handleMessage(w.ext, m, POPUP(w.ext), w.deps);
const check = (w: World, referrer: unknown, extra: Record<string, unknown> = {}) => ask(w, {type: 'presale.checkReferrer', account: ACCOUNT, referrer, ...extra});
const buy = (w: World, id: string) => ask(w, {type: 'presale.buy', id});
const records = async (w: World): Promise<Record<string, unknown>[]> => ((await w.ext.local.get(PENDING_KEY)) as Record<string, unknown>[] | undefined) ?? [];
async function provenPurchase(w: World, i: PurchaseIntent): Promise<PurchaseView> {
  const view = await prepare(w, i);
  if (view.reauth !== null) expect(await satisfyChallenge(w.ext, w.deps.now(), view.reauth.challengeId)).toBe(true);
  return view;
}
const messageOf = (wire: string): MessageV0 => VersionedTransaction.deserialize(base64.decode(wire)).message as MessageV0;
const named = (m: MessageV0, ix: number): string[] => (m.compiledInstructions[ix]?.accountKeyIndexes ?? []).map(k => m.staticAccountKeys[k]?.toBase58() ?? '');
const programOf = (m: MessageV0, ix: number): string => m.staticAccountKeys[m.compiledInstructions[ix]?.programIdIndex ?? -1]?.toBase58() ?? '';
const REGISTER = PRESALE_INSTRUCTIONS.find(i => i.name === 'register_referrer');
/** One account of a simulation changed. */
const withAccount = (address: string, f: (a: SimulatedAccount | null) => SimulatedAccount | null): Edit => (o, at) => {
  const accounts = [...(o.accounts ?? [])];
  const i = at(address);
  if (i < 0) throw new Error(`the simulation was not asked for ${address}`);
  accounts[i] = f(accounts[i] ?? null);
  return {...o, accounts};
};
const A = PRESALE_ALLOCATION_LAYOUT.fields;
/** The allocation after with its referrer@84 replaced (null: 32 zero bytes). */
const referrerAfter = (referrer: string | null): Edit =>
  withAccount(PDAS.userAllocation.toBase58(), a => {
    if (a === null) return null;
    const data = Uint8Array.from(a.data);
    data.set(referrer === null ? new Uint8Array(32) : new PublicKey(referrer).toBytes(), A.referrer.offset);
    return {...a, data};
  });
/** A stored entry's message rebuilt from `ixs` (the same blockhash), its integrity recomputed — what a writer of session storage could do. */
async function forgeMessage(w: World, f: (m: MessageV0) => MessageV0): Promise<void> {
  const [entry] = await stored(w);
  if (entry === undefined) throw new Error('no entry');
  const message = base64.encode(f(VersionedMessage.deserialize(base64.decode(entry.message)) as MessageV0).serialize());
  await w.ext.session.set(PREPARED_KEY, [{...entry, message, integrity: preparedIntegrity({...entry, message})}]);
}
const compile = (m: MessageV0, instructions: TransactionInstruction[]): MessageV0 =>
  new TransactionMessage({payerKey: new PublicKey(ACCOUNT), recentBlockhash: m.recentBlockhash, instructions}).compileToV0Message();
/** The compute-budget price the stored message pays (its instruction 1), to rebuild it at the same fee. */
const priceOf = (m: MessageV0): number => Number(new DataView((m.compiledInstructions[1] as {data: Uint8Array}).data.buffer, (m.compiledInstructions[1] as {data: Uint8Array}).data.byteOffset).getBigUint64(1, true));

describe('the referral address in the intent (§1.4)', () => {
  it('absent or null is no referrer — the intent has no such key, as B1d-1b’s; a base58 string of 32–44 characters is kept; anything else is malformed', () => {
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0})).toEqual({currency: 'SOL', amount: '1', stage: 0});
    const none = parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: null});
    expect([none, none !== null && Object.hasOwn(none, 'referrer')]).toEqual([{currency: 'SOL', amount: '1', stage: 0}, false]);
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: R})).toEqual({currency: 'SOL', amount: '1', stage: 0, referrer: R});
    // The key's own validity is §3.5's (referrer-invalid), not the parser's: a 31-byte key and the default key parse.
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: SHORT_KEY})?.referrer).toBe(SHORT_KEY);
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: DEFAULT_KEY})?.referrer).toBe(DEFAULT_KEY);
    for (const referrer of ['', 'x'.repeat(31), '1'.repeat(45), `${R.slice(0, -1)}0`, 7, {}, [R], true]) {
      expect([referrer, parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer})]).toEqual([referrer, null]);
    }
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', stage: 0, referrer: R, extra: 1})).toBeNull();
    expect(parsePurchaseIntent({currency: 'SOL', amount: '1', referrer: R})).toBeNull();
  });

  it('the digest binds the referral address: with one it differs from without and from another; without one it is B1d-1b’s (captured.test.ts)', () => {
    const d = (i: PurchaseIntent) => intentDigest(PRESALE_BUY_INTENT, ACCOUNT, i);
    const digests = [d(intent('SOL', SOL_2)), d(intent('SOL', SOL_2, R)), d(intent('SOL', SOL_2, OTHER))];
    expect(new Set(digests).size).toBe(3);
    expect(d(intent('SOL', SOL_2, R))).toBe(d({currency: 'SOL', amount: SOL_2, stage: 0, referrer: R}));
  });
});

describe('presale.checkReferrer (§1.4, §3.5, C32): its order, each line at its boundary', () => {
  it('a valid address: {ok: true} after one getAccountsData of the buyer’s allocation and the referrer’s (positive control)', async () => {
    const w = await world();
    expect(await check(w, R)).toEqual({ok: true, data: {ok: true}});
    expect(w.accountReads).toEqual([[PDAS.userAllocation.toBase58(), R_ALLOCATION]]);
    // A first purchase from an allocation that exists but never bought (purchase_count 0) takes one too.
    expect(await check(await world({chain: NEVER_BOUGHT}), R)).toEqual({ok: true, data: {ok: true}});
  });

  it('referrer-invalid: a 31-byte key, the default key — nothing read', async () => {
    for (const k of [SHORT_KEY, DEFAULT_KEY]) {
      const w = await world();
      expect([k, await check(w, k)]).toEqual([k, {ok: true, data: {ok: false, line: 'referrer-invalid'}}]);
      expect(w.accountReads).toEqual([]);
    }
  });

  it('referrer-self: the buyer, another account of the session, an account of the stored wallet not in the session — nothing read', async () => {
    const buyer = await world();
    expect(await check(buyer, ACCOUNT)).toEqual({ok: true, data: {ok: false, line: 'referrer-self'}});
    const session = await world({session: [SESSION_ACCOUNT, SECOND]});
    expect(await check(session, SECOND.publicKey)).toEqual({ok: true, data: {ok: false, line: 'referrer-self'}});
    const stored = await world();
    await stored.ext.local.set(VAULT_KEY, {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: ACCOUNT}, {index: 1, name: 'Account 2', publicKey: SECOND.publicKey}]});
    expect((await getSession(stored.ext))?.map(a => a.publicKey)).toEqual([ACCOUNT]);
    expect(await check(stored, SECOND.publicKey)).toEqual({ok: true, data: {ok: false, line: 'referrer-self'}});
    expect([buyer.accountReads, session.accountReads, stored.accountReads]).toEqual([[], [], []]);
    // Negative control: the same address is a referrer for a wallet that does not hold it.
    expect(await check(await world({referrers: [new Map([[allocationOf(SECOND.publicKey), program(allocationData({user: SECOND.publicKey}))]])]}), SECOND.publicKey)).toEqual({ok: true, data: {ok: true}});
  });

  it('referrer-not-applicable: an on-chain referrer, or not a first purchase (purchase_count 1) — an on-chain referrer always wins (D8)', async () => {
    expect(await check(await world({chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}}), R)).toEqual({ok: true, data: {ok: false, line: 'referrer-not-applicable'}});
    expect(await check(await world({chain: {...EXISTING, allocation: program(allocationData({count: 1}))}}), R)).toEqual({ok: true, data: {ok: false, line: 'referrer-not-applicable'}});
    // An on-chain referrer that is the address itself: still nothing to register.
    expect(await check(await world({chain: {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, referrer: R}))}}), R)).toEqual({ok: true, data: {ok: false, line: 'referrer-not-applicable'}});
  });

  it('referrer-no-allocation: its allocation absent, another user’s at user@8, not the program’s, of another length — §2.1 rule 6', async () => {
    for (const [name, a] of [
      ['absent', null],
      ['a foreign user@8', program(allocationData({user: OTHER}))],
      ['not the program’s', {...R_ALLOCATED, owner: SYSTEM_PROGRAM_ID}],
      ['116 bytes', program(allocationData({user: R, length: 116}))],
      ['a claimed byte of 2', program(allocationData({user: R, claimed: 2}))],
    ] as const) {
      expect([name, await check(await world({referrers: [new Map([[R_ALLOCATION, a]])]}), R)]).toEqual([name, {ok: true, data: {ok: false, line: 'referrer-no-allocation'}}]);
    }
  });

  it('the order: invalid, self, not-applicable, no-allocation — each before the next', async () => {
    const both = {chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}, referrers: [new Map([[R_ALLOCATION, null]])], session: [SESSION_ACCOUNT, SECOND]};
    expect(await check(await world(both), SECOND.publicKey)).toEqual({ok: true, data: {ok: false, line: 'referrer-self'}});
    expect(await check(await world(both), R)).toEqual({ok: true, data: {ok: false, line: 'referrer-not-applicable'}});
  });

  it('a failed read: 403 → coordinator-refused, unreachable → presale-unavailable; the buyer’s allocation malformed → presale-unavailable', async () => {
    expect(await check(await world({refErrors: [new RpcForbidden('/rpc')]}), R)).toEqual({ok: false, error: 'coordinator-refused'});
    expect(await check(await world({refErrors: [new RequestUnreachable('/rpc', 'down')]}), R)).toMatchObject({ok: false, error: 'presale-unavailable'});
    expect(await check(await world({chain: {...EXISTING, allocation: program(allocationData({user: OTHER}))}}), R)).toEqual({ok: false, error: 'presale-unavailable', data: {detail: 'malformed'}});
  });

  it.each([
    ['an extra key', {extra: 1}],
    ['a referrer that is not a string', {referrer: 7}],
    ['a referrer of 31 characters', {referrer: 'x'.repeat(31)}],
    ['a referrer outside base58', {referrer: `${R.slice(0, -1)}0`}],
    ['a non-address account', {account: 'not-an-address'}],
  ])('%s → malformed, nothing read', async (_, over) => {
    const w = await world();
    expect(await ask(w, {type: 'presale.checkReferrer', account: ACCOUNT, referrer: R, ...over})).toEqual({ok: false, error: 'malformed'});
    expect(w.accountReads).toEqual([]);
  });

  it('locked, or an account outside the session — nothing read; from the approval window or the vault page: forbidden', async () => {
    const locked = await world();
    await clearSession(locked.ext);
    expect(await check(locked, R)).toEqual({ok: false, error: 'locked'});
    const other = await world();
    expect(await ask(other, {type: 'presale.checkReferrer', account: OTHER, referrer: R})).toEqual({ok: false, error: 'unknown-account'});
    for (const page of ['approve.html', 'unlock.html']) {
      const sender = {...POPUP(other.ext), url: `${other.ext.extensionOrigin}/${page}`, tab: {}, frameId: 0};
      expect([page, await handleMessage(other.ext, {type: 'presale.checkReferrer', account: ACCOUNT, referrer: R}, sender, other.deps)]).toEqual([page, {ok: false, error: 'forbidden'}]);
    }
    expect([locked.accountReads, other.accountReads]).toEqual([[], []]);
  });
});

describe('prepare with a referral address (§3.3 steps 2, 4–7; §3.5)', () => {
  it('a first SOL purchase: register_referrer between the compute budget and the purchase, account 3 its allocation, the view and #10 say it registers', async () => {
    const w = await world();
    const view = await prepare(w, intent('SOL', SOL_2, R));
    expect(view.referrer).toEqual({address: R, registers: true});
    expect(view.simulation.instructionCount).toBe(4);
    expect(view.fees.rentLamports).toBe((ALLOCATION_RENT + USER_RENT).toString());
    expect(view.reauth?.reasons).toContain('first-purchase');
    const m = messageOf(w.wires[0] as string);
    expect([0, 1, 2, 3].map(i => programOf(m, i))).toEqual(['ComputeBudget111111111111111111111111111111', 'ComputeBudget111111111111111111111111111111', MAINNET_PROGRAM_ID, MAINNET_PROGRAM_ID]);
    // register_referrer exactly as the IDL has it: its discriminator, the referrer as its argument, its four accounts.
    expect([...(m.compiledInstructions[2]?.data ?? [])]).toEqual([...(REGISTER?.discriminator ?? []), ...new PublicKey(R).toBytes()]);
    expect(REGISTER?.accounts).toEqual(['user_account', 'user_allocation', 'user', 'system_program']);
    expect(named(m, 2)).toEqual([PDAS.userAccount.toBase58(), PDAS.userAllocation.toBase58(), ACCOUNT, SYSTEM_PROGRAM_ID]);
    expect(named(m, 3)[3]).toBe(R_ALLOCATION);
    // The simulation is asked for what B1d-1b asks (the user account too, absent in the snapshot); the referral address's
    // allocation was read once, by itself.
    expect(w.asked).toEqual([[ACCOUNT, PDAS.userAllocation.toBase58(), TREASURY_ADDRESS, PDAS.userAccount.toBase58()]]);
    expect(w.accountReads).toEqual([[R_ALLOCATION]]);
    const [entry] = await stored(w);
    expect(entry?.intent).toEqual({currency: 'SOL', amount: SOL_2, stage: 0, referrer: R});
    expect(entry?.shown.view.referrer).toEqual({address: R, registers: true});
    expect(entry?.intentDigest).toBe(intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', SOL_2, R)));
    expect(await challengeInfo(w.ext, w.deps.now(), view.reauth?.challengeId ?? '')).toMatchObject({kind: 'presale-buy', referrer: {address: R, registers: true}, reasons: ['first-purchase', 'over-5-percent', 'over-usd-threshold']});
    expect(w.deps.broadcasts).toEqual([]);
  });

  it('a first USDC purchase from an allocation that never bought: the same instruction, no rent (both PDAs exist), still re-authenticated', async () => {
    const w = await world({chain: NEVER_BOUGHT});
    const view = await prepare(w, intent('USDC', '20000000', R));
    expect([view.referrer, view.fees.rentLamports, view.reauth?.reasons]).toEqual([{address: R, registers: true}, '0', ['first-purchase']]);
    const m = messageOf(w.wires[0] as string);
    expect(named(m, 2)).toEqual([PDAS.userAccount.toBase58(), PDAS.userAllocation.toBase58(), ACCOUNT, SYSTEM_PROGRAM_ID]);
    expect(named(m, 3)[3]).toBe(R_ALLOCATION);
    expect(named(m, 3)[4]).toBe(HOLDING_LARGE);
  });

  it('refused, never dropped: an on-chain referrer, not a first purchase → referrer-not-applicable before anything is built or simulated', async () => {
    for (const chain of [{...EXISTING, allocation: program(allocationData({referrer: OTHER}))}, EXISTING, {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, referrer: R}))}]) {
      const w = await world({chain});
      expect(await refusal(prepare(w, intent('SOL', SOL_2, R)))).toBe('referrer-not-applicable');
      expect([w.wires, await stored(w)]).toEqual([[], []]);
    }
    // Positive control: the same accounts without a referral address prepare (the on-chain referrer credited, as B1d-1b).
    const onChain = await world({chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}});
    expect((await prepare(onChain, intent('SOL', SOL_2))).referrer).toEqual({address: OTHER, registers: false});
  });

  it('each other line at prepare: invalid, self (the buyer, another account of the session), no allocation — nothing simulated', async () => {
    const cases: [string, PurchaseIntent, Parameters<typeof world>[0]][] = [
      ['referrer-invalid', intent('SOL', SOL_2, SHORT_KEY), {}],
      ['referrer-invalid', intent('SOL', SOL_2, DEFAULT_KEY), {}],
      ['referrer-self', intent('SOL', SOL_2, ACCOUNT), {}],
      ['referrer-self', intent('SOL', SOL_2, SECOND.publicKey), {session: [SESSION_ACCOUNT, SECOND]}],
      ['referrer-no-allocation', intent('SOL', SOL_2, R), {referrers: [new Map([[R_ALLOCATION, null]])]}],
      ['referrer-no-allocation', intent('SOL', SOL_2, R), {referrers: [new Map([[R_ALLOCATION, program(allocationData({user: OTHER}))]])]}],
    ];
    for (const [code, i, o] of cases) {
      const w = await world(o);
      expect([i.referrer, await refusal(prepare(w, i))]).toEqual([i.referrer, code]);
      expect(w.wires).toEqual([]);
    }
  });

  it('the gate closed and a stage that moved decide first, as without a referrer', async () => {
    const closed = await world({geo: async () => ({open: false, reason: 'no_check', countryCode: null})});
    expect(await refusal(prepare(closed, intent('SOL', SOL_2, ACCOUNT)))).toBe('geo-closed');
    expect(await refusal(prepare(await world(), {...intent('SOL', SOL_2, ACCOUNT), stage: 1}))).toBe('price-changed');
  });

  it('a referrer allocation read failing: 403 → coordinator-refused, unreachable → presale-unavailable; nothing simulated', async () => {
    const forbidden = await world({refErrors: [new RpcForbidden('/rpc')]});
    expect(await refusal(prepare(forbidden, intent('SOL', SOL_2, R)))).toBe('coordinator-refused');
    const down = await world({refErrors: [new RequestUnreachable('/rpc', 'down')]});
    expect(await refusal(prepare(down, intent('SOL', SOL_2, R)))).toBe('presale-unavailable');
    expect([forbidden.wires, down.wires]).toEqual([[], []]);
  });
});

describe('the simulation with a referrer (§3.3 step 5)', () => {
  it('referrer@84 after must be the registered referrer: left zero (the registration ignored), or another key → simulation-mismatch', async () => {
    expect(await refusal(prepare(await world({edits: [referrerAfter(null)]}), intent('SOL', SOL_2, R)))).toBe('simulation-mismatch');
    expect(await refusal(prepare(await world({edits: [referrerAfter(OTHER)]}), intent('SOL', SOL_2, R)))).toBe('simulation-mismatch');
    // Positive control: the registered referrer itself.
    expect((await prepare(await world({edits: [referrerAfter(R)]}), intent('SOL', SOL_2, R))).referrer).toEqual({address: R, registers: true});
  });

  it('a purchase without a referral address: referrer@84 stays as it was — zero, or the on-chain referrer', async () => {
    expect(await refusal(prepare(await world({edits: [referrerAfter(R)]}), intent('SOL', SOL_2)))).toBe('simulation-mismatch');
    const onChain = {chain: {...EXISTING, allocation: program(allocationData({referrer: OTHER}))}};
    expect(await refusal(prepare(await world({...onChain, edits: [referrerAfter(R)]}), intent('SOL', SOL_2)))).toBe('simulation-mismatch');
    expect(await refusal(prepare(await world({...onChain, edits: [referrerAfter(null)]}), intent('SOL', SOL_2)))).toBe('simulation-mismatch');
  });

  it('register_referrer creates the two PDAs: their rent, from the simulation, is checked as without one — above its bound → mismatch, at it → accepted', async () => {
    const lamports = (n: bigint): Edit => (o, at) =>
      withAccount(PDAS.userAllocation.toBase58(), a => (a === null ? null : {...a, lamports: n}))(withAccount(ACCOUNT, a => (a === null ? null : {...a, lamports: a.lamports - (n - ALLOCATION_RENT)}))(o, at), at);
    expect(await refusal(prepare(await world({edits: [lamports(PRESALE_ALLOCATION_RENT_LAMPORTS + 1n)]}), intent('SOL', SOL_2, R)))).toBe('simulation-mismatch');
    expect((await prepare(await world({edits: [lamports(PRESALE_ALLOCATION_RENT_LAMPORTS)]}), intent('SOL', SOL_2, R))).fees.rentLamports).toBe((PRESALE_ALLOCATION_RENT_LAMPORTS + USER_RENT).toString());
    // The payer paying the rent once more than the PDAs hold (rent charged twice) is still an outflow mismatch.
    expect(await refusal(prepare(await world({edits: [withAccount(ACCOUNT, a => (a === null ? null : {...a, lamports: a.lamports - ALLOCATION_RENT}))]}), intent('SOL', SOL_2, R)))).toBe('simulation-mismatch');
  });

  it('the program refusing register_referrer (AlreadyHasReferrer on instruction 2) → simulation-failed', async () => {
    // The snapshot sees no referrer; by the simulation one was registered from another device.
    const w = await world({simChains: [{...NEVER_BOUGHT, allocation: program(allocationData({count: 0, referrer: OTHER}))}], chain: NEVER_BOUGHT});
    expect(await refusal(prepare(w, intent('SOL', SOL_2, R)))).toBe('simulation-failed');
  });

  it('the busy-destination retry re-resolves the referrer (C39): the fresh snapshot finds a referrer registered — another, or this very one — → state-changed, no second simulation', async () => {
    const busy: Edit = withAccount(TREASURY_ADDRESS, a => (a === null ? null : {...a, lamports: a.lamports - 1n}));
    for (const registered of [OTHER, R]) {
      const w = await world({chains: [NEVER_BOUGHT, {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, referrer: registered}))}], edits: [busy]});
      expect([registered, await refusal(prepare(w, intent('SOL', SOL_2, R)))]).toEqual([registered, 'state-changed']);
      expect(w.wires).toHaveLength(1);
    }
    // Positive control: a fresh snapshot that changed nothing the bytes were built from → the second simulation, prepared.
    const w = await world({chains: [NEVER_BOUGHT, NEVER_BOUGHT], edits: [busy]});
    expect((await prepare(w, intent('SOL', SOL_2, R))).referrer).toEqual({address: R, registers: true});
    expect(w.wires).toHaveLength(2);
    expect(w.wires[1]).toBe(w.wires[0]);
  });
});

describe('presale.buy with a referral address: signed once, recorded with it (§3.3, §2.3, §2.4)', () => {
  it('end to end: prepare → #10 proven → presale.buy → v1_pending names the referrer → confirmed → the record POSTs referrerAddress', async () => {
    const w = await world();
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    const answer = await buy(w, view.id);
    expect(answer).toMatchObject({ok: true, data: {state: 'pending', extra: {kind: 'presale-buy', data: {referrer: R}}}});
    expect(w.deps.broadcasts).toHaveLength(1);
    const sent = VersionedTransaction.deserialize(w.deps.broadcasts[0] as Uint8Array);
    expect(ed25519.verify(sent.signatures[0] as Uint8Array, sent.message.serialize(), new PublicKey(ACCOUNT).toBytes())).toBe(true);
    expect(named(sent.message as MessageV0, 3)[3]).toBe(R_ALLOCATION);
    // The referral address's allocation read at prepare and again at the signature.
    expect(w.accountReads).toEqual([[R_ALLOCATION], [R_ALLOCATION]]);
    w.deps.reader = {...w.deps.reader, getSignatureStatuses: async sigs => sigs.map(() => ({err: null, confirmationStatus: 'confirmed' as const})), getBlockHeight: async () => 900};
    w.deps.clock.t += 2_000;
    await pollOnce(w.ext, w.deps);
    await runPresaleRecords(w.ext, w.deps);
    const [entry] = await readPresaleRecords(w.ext);
    expect(entry?.payload.referrerAddress).toBe(R);
    expect(w.posts).toEqual([{path: '/solana/purchase', body: expect.objectContaining({txHash: firstSignature(w.deps.broadcasts[0] as Uint8Array), buyerAddress: ACCOUNT, referrerAddress: R})}]);
  });

  it('pendingData: the registered referrer; a stored view that names another, or says it registers nothing, does not read back', async () => {
    const w = await world();
    await prepare(w, intent('SOL', SOL_2, R));
    const [entry] = await stored(w);
    if (entry === undefined || PRESALE_BUY_INTENT.pendingData === undefined) throw new Error('no entry');
    expect(PRESALE_BUY_INTENT.pendingData(entry, entry.intent)).toMatchObject({referrer: R});
    for (const referrer of [{address: OTHER, registers: true}, {address: R, registers: false}, null]) {
      const forged = {...entry, shown: {...entry.shown, view: {...entry.shown.view, referrer}}};
      expect([referrer, PRESALE_BUY_INTENT.pendingData(forged, entry.intent)]).toEqual([referrer, null]);
    }
    // Nor one simulated as three instructions (a registration counts one more).
    const three = {...entry, shown: {...entry.shown, simulation: {...entry.shown.simulation, instructionCount: 3}}};
    expect(PRESALE_BUY_INTENT.pendingData(three, entry.intent)).toBeNull();
  });
});

describe('presale.buy with a referral address: what the signature checks again (C22, §3.5) — the entry and the proof stay', () => {
  type Row = {sign?: Partial<Chain>; referrers?: Map<string, AccountData | null>; refError?: Error; session?: SessionAccount[]};
  const rows: [string, string, Row][] = [
    ['another referrer registered meanwhile', 'state-changed', {sign: {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, referrer: OTHER}))}}],
    ['this very referrer registered meanwhile, from another device', 'state-changed', {sign: {...NEVER_BOUGHT, allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, referrer: R}))}}],
    ['a purchase meanwhile (purchase_count 1)', 'state-changed', {sign: {...NEVER_BOUGHT, allocation: program(allocationData({count: 1}))}}],
    ['its allocation gone', 'referrer-no-allocation', {referrers: new Map([[R_ALLOCATION, null]])}],
    ['its allocation now another user’s', 'referrer-no-allocation', {referrers: new Map([[R_ALLOCATION, program(allocationData({user: OTHER}))]])}],
    ['the address now an account of this wallet', 'referrer-self', {session: [SESSION_ACCOUNT, {...SECOND, publicKey: R}]}],
    ['its allocation read answered 403', 'coordinator-refused', {refError: new RpcForbidden('/rpc')}],
    ['its allocation read unreachable', 'presale-unavailable', {refError: new RequestUnreachable('/rpc', 'down')}],
  ];

  it.each(rows)('%s → %s; nothing signed', async (_, code, row) => {
    const w = await world({chains: [NEVER_BOUGHT, row.sign ?? NEVER_BOUGHT], referrers: [new Map([[R_ALLOCATION, R_ALLOCATED]]), row.referrers ?? new Map([[R_ALLOCATION, R_ALLOCATED]])], refErrors: [null, row.refError ?? null]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    if (row.session !== undefined) await setSession(w.ext, row.session);
    expect(await buy(w, view.id)).toMatchObject({ok: false, error: code});
    expect((await stored(w)).map(e => e.id)).toEqual([view.id]);
    expect(await challengeSatisfied(w.ext, w.deps.now(), view.reauth?.challengeId ?? '', intentDigest(PRESALE_BUY_INTENT, ACCOUNT, intent('SOL', SOL_2, R)))).toBe(true);
    expect([w.deps.broadcasts, await records(w)]).toEqual([[], []]);
  });

  it('every check passing at the signature (positive control): it signs the registration', async () => {
    const w = await world({chains: [NEVER_BOUGHT, NEVER_BOUGHT]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    expect(await buy(w, view.id)).toMatchObject({ok: true, data: {state: 'pending'}});
    expect(w.deps.broadcasts).toHaveLength(1);
  });
});

describe('the signature rests on the bytes the integrity binds, never on `shown` (C22, review 1 M1) — each forgery has its integrity recomputed', () => {
  async function forged(f: (m: MessageV0) => MessageV0): Promise<{w: World; id: string}> {
    const w = await world({chains: [{}, {}]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    await forgeMessage(w, f);
    return {w, id: view.id};
  }
  const kept = async (w: World, id: string) => {
    expect((await stored(w)).map(e => e.id)).toEqual([id]);
    expect([w.deps.broadcasts, await records(w)]).toEqual([[], []]);
  };

  it('the registration removed (the purchase alone, still crediting the referrer’s allocation) → prepared-invalid', async () => {
    const {w, id} = await forged(m => compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(R_ALLOCATION), registerReferrer: null}, new PublicKey(TREASURY_ADDRESS))));
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('another referrer registered and credited instead → prepared-invalid', async () => {
    const {w, id} = await forged(m => compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(allocationOf(OTHER)), registerReferrer: new PublicKey(OTHER)}, new PublicKey(TREASURY_ADDRESS))));
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('the registration names another referrer while account 3 stays this one’s allocation → prepared-invalid', async () => {
    const {w, id} = await forged(m => compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(R_ALLOCATION), registerReferrer: new PublicKey(OTHER)}, new PublicKey(TREASURY_ADDRESS))));
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('the referrer registered but account 3 the default allocation (the program would refuse it; the bonus nowhere) → prepared-invalid', async () => {
    const {w, id} = await forged(m => compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(allocationOf(DEFAULT_KEY)), registerReferrer: new PublicKey(R)}, new PublicKey(TREASURY_ADDRESS))));
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('the registration’s accounts swapped (user_account and user_allocation) → prepared-invalid', async () => {
    const {w, id} = await forged(m => {
      const ixs = m.compiledInstructions.map((ix, i) => (i === 2 ? {...ix, accountKeyIndexes: [ix.accountKeyIndexes[1] as number, ix.accountKeyIndexes[0] as number, ...ix.accountKeyIndexes.slice(2)]} : ix));
      return new MessageV0({header: m.header, staticAccountKeys: m.staticAccountKeys, recentBlockhash: m.recentBlockhash, compiledInstructions: ixs, addressTableLookups: m.addressTableLookups});
    });
    expect(await buy(w, id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, id);
  });

  it('the honest bytes unchanged but re-serialized (positive control): signs', async () => {
    const {w, id} = await forged(m => new MessageV0({header: m.header, staticAccountKeys: m.staticAccountKeys, recentBlockhash: m.recentBlockhash, compiledInstructions: m.compiledInstructions, addressTableLookups: m.addressTableLookups}));
    expect(await buy(w, id)).toMatchObject({ok: true});
  });

  it('a registration whose re-authentication was taken away (challengeId null, integrity recomputed) → prepared-invalid; nothing signed', async () => {
    const w = await world({chains: [{}, {}]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    const [entry] = await stored(w);
    if (entry === undefined) throw new Error('no entry');
    const bare = {...entry, challengeId: null};
    await w.ext.session.set(PREPARED_KEY, [{...bare, integrity: preparedIntegrity(bare)}]);
    expect(await buy(w, view.id)).toMatchObject({ok: false, error: 'prepared-invalid'});
    await kept(w, view.id);
  });

  it('the entry rewritten whole for another referrer (intent, digest, message, integrity) under the first one’s proof → reauth-required: the proof was for that referrer', async () => {
    const w = await world({chains: [{}, {}], referrers: [new Map([[R_ALLOCATION, R_ALLOCATED], [allocationOf(OTHER), program(allocationData({user: OTHER}))]])]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    const [entry] = await stored(w);
    if (entry === undefined) throw new Error('no entry');
    const m = VersionedMessage.deserialize(base64.decode(entry.message)) as MessageV0;
    const other = compile(m, buildBuyInstructions(new PublicKey(ACCOUNT), BigInt(SOL_2), priceOf(m), {referrerAllocation: new PublicKey(allocationOf(OTHER)), registerReferrer: new PublicKey(OTHER)}, new PublicKey(TREASURY_ADDRESS)));
    const i = intent('SOL', SOL_2, OTHER);
    const bound = {...entry, intent: i, intentDigest: intentDigest(PRESALE_BUY_INTENT, ACCOUNT, i), message: base64.encode(other.serialize())};
    await w.ext.session.set(PREPARED_KEY, [{...bound, integrity: preparedIntegrity(bound), shown: {...entry.shown, view: {...entry.shown.view, referrer: {address: OTHER, registers: true}}}}]);
    expect(await buy(w, view.id)).toMatchObject({ok: false, error: 'reauth-required'});
    await kept(w, view.id);
  });

  it('the stored intent’s referrer changed without the integrity → prepared-invalid', async () => {
    const w = await world({chains: [{}, {}]});
    const view = await provenPurchase(w, intent('SOL', SOL_2, R));
    const [entry] = await stored(w);
    if (entry === undefined) throw new Error('no entry');
    await w.ext.session.set(PREPARED_KEY, [{...entry, intent: intent('SOL', SOL_2, OTHER)}]);
    expect(await buy(w, view.id)).toMatchObject({ok: false});
    expect(w.deps.broadcasts).toEqual([]);
  });

  it('assertPurchaseMessage: a registration where none is expected, none where one is → an engine bug, thrown', () => {
    const user = new PublicKey(ACCOUNT);
    const m0 = new TransactionMessage({payerKey: user, recentBlockhash: BLOCKHASH, instructions: []}).compileToV0Message();
    const plain = compile(m0, buildBuyInstructions(user, 7n, 0, {referrerAllocation: new PublicKey(R_ALLOCATION), registerReferrer: null}, new PublicKey(TREASURY_ADDRESS)));
    const registering = compile(m0, buildBuyInstructions(user, 7n, 0, {referrerAllocation: new PublicKey(R_ALLOCATION), registerReferrer: new PublicKey(R)}, new PublicKey(TREASURY_ADDRESS)));
    const i = {account: ACCOUNT, currency: 'SOL' as const, referrerAllocation: R_ALLOCATION, destination: TREASURY_ADDRESS, source: null, amount: 7n};
    expect(assertPurchaseMessage(registering, {...i, registerReferrer: R})).toBe(3);
    expect(assertPurchaseMessage(plain, {...i, registerReferrer: null})).toBe(2);
    expect(() => assertPurchaseMessage(registering, {...i, registerReferrer: null})).toThrow('unexpected instructions');
    expect(() => assertPurchaseMessage(plain, {...i, registerReferrer: R})).toThrow('unexpected instructions');
    expect(() => assertPurchaseMessage(registering, {...i, registerReferrer: OTHER})).toThrow('not this referrer');
  });
});

describe('#10 describes the referrer (§4.2, Q47)', () => {
  const ABOUT = {
    kind: 'presale-buy',
    account: ACCOUNT,
    currency: 'SOL',
    amount: SOL_2,
    stage: 0,
    priceTicks: '1501',
    nocBase: '2643837441705',
    spentCents: '39684',
    destination: TREASURY_ADDRESS,
    networkLamports: '11000',
    priorityLamports: '6000',
    rentLamports: '2189480',
    reasons: ['first-purchase'],
    thresholdCents: 10_000,
  };
  const rowsOf = (about: Record<string, unknown>) => describePresale(about)?.rows.map(r => [r.label, r.value, r.address]);

  it('a registration: "Referred by" with the whole address after "To", then Q47’s note; an on-chain referrer: the row without the note', () => {
    expect(rowsOf({...ABOUT, referrer: {address: R, registers: true}})?.slice(3, 6)).toEqual([
      ['To', 'Noctura presale', TREASURY_ADDRESS],
      ['Referred by', null, R],
      ["Saved to your presale account with this purchase. It can't be changed later.", null, null],
    ]);
    expect(rowsOf({...ABOUT, referrer: {address: R, registers: false}})?.slice(3, 5)).toEqual([
      ['To', 'Noctura presale', TREASURY_ADDRESS],
      ['Referred by', null, R],
    ]);
    expect(rowsOf({...ABOUT, referrer: {address: R, registers: false}})?.[5]?.[0]).toBe('Network fee');
    // Without one: B1d-1b's rows.
    expect(rowsOf(ABOUT)?.map(r => r[0])).toEqual(['You receive (est.)', 'Stage', 'Price', 'To', 'Network fee', 'Priority', 'Account setup (first purchase)']);
  });

  it('a referrer that does not read back describes nothing: a bad address, an extra key, registers not a boolean, a registration without the first-purchase reason', () => {
    for (const referrer of [{address: 'nope', registers: true}, {address: R, registers: true, extra: 1}, {address: R, registers: 'yes'}, [R], null]) {
      expect([referrer, describePresale({...ABOUT, referrer})]).toEqual([referrer, null]);
    }
    expect(describePresale({...ABOUT, reasons: ['over-5-percent'], referrer: {address: R, registers: true}})).toBeNull();
    expect(describePresale({...ABOUT, reasons: ['over-5-percent'], referrer: {address: R, registers: false}})).not.toBeNull();
  });

  it('the challenge store keeps the background’s own shape only: a registration without first-purchase, or a malformed referrer, is not issued', async () => {
    const w = await world();
    const deps = w.deps;
    const about = (referrer: unknown, reasons: string[] = ['first-purchase']) => ({...ABOUT, reasons, referrer}) as unknown as KindAbout;
    const issued = async (a: KindAbout) => challengeInfo(w.ext, deps.now(), await issueChallenge(w.ext, deps, 'd'.repeat(64), a));
    expect(await issued(about({address: R, registers: true}))).toMatchObject({referrer: {address: R, registers: true}});
    for (const a of [about({address: R, registers: true}, ['over-5-percent']), about({address: 'nope', registers: false}), about({address: R}), about(null)]) {
      await expect(issued(a)).rejects.toThrow();
    }
    expect(Object.keys((await w.ext.session.get(REAUTH_KEY)) as Record<string, unknown>)).toHaveLength(1);
  });
});

describe('an on-chain referrer still always wins (C7, D8)', () => {
  it('no referral address: the on-chain referrer is credited, nothing registered, as B1d-1b; with one: refused, the input never ignored', async () => {
    const chain = {...EXISTING, allocation: program(allocationData({referrer: OTHER}))};
    const plain = await world({chain});
    const view = await prepare(plain, intent('SOL', SOL_2));
    const m = messageOf(plain.wires[0] as string);
    expect([view.referrer, m.compiledInstructions.length, named(m, 2)[3]]).toEqual([{address: OTHER, registers: false}, 3, allocationOf(OTHER)]);
    expect(await refusal(prepare(await world({chain}), intent('SOL', SOL_2, R)))).toBe('referrer-not-applicable');
  });

  it('a prepare without the referral address after one with it replaces the entry: one per account (§1.3), the registration gone with it', async () => {
    const w = await world();
    await prepare(w, intent('SOL', SOL_2, R));
    const again = await prepare(w, intent('SOL', SOL_2));
    expect((await stored(w)).map(e => [e.id, e.intent.referrer ?? null, e.shown.view.referrer])).toEqual([[again.id, null, null]]);
  });
});
```

The changed test files (the honest simulation learns `register_referrer`: it sets the allocation's referrer to its argument and fails with AlreadyHasReferrer — `Custom: 6016` on instruction 2 — when one is already registered; `buy.test.ts`'s two rows that used `referrer: null` as the "extra key" now use another key, since `referrer: null` is accepted; the type lists gain `presale.checkReferrer`; `MARKERS` gains three):

`extension/src/background/presale/__tests__/simulation.ts`:

```diff
diff --git a/extension/src/background/presale/__tests__/simulation.ts b/extension/src/background/presale/__tests__/simulation.ts
index 6b6c5b3..45c5617 100644
--- a/extension/src/background/presale/__tests__/simulation.ts
+++ b/extension/src/background/presale/__tests__/simulation.ts
@@ -8,6 +8,7 @@ import {PRESALE_INSTRUCTIONS} from '../../dapp/decode/presaleIdl';
 import {MAINNET_PROGRAM_ID, MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../../core/presale/addresses';
 import {derivePresalePdas, readU64LE} from '../../../../../core/presale/allocation';
 import {tokensFor, usdCentsForStable} from '../../../../../core/presale/limits';
+import {REGISTER_REFERRER_DISCRIMINATOR} from '../../../../../core/presale/buyInstructions';
 import {SPL_TOKEN_PROGRAM} from '../../../../../core/solana/encoding';
 import {SYSTEM_PROGRAM_ID, type AccountData, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../../core/solana/rpc';
 import {ACCOUNT, CONFIG_PDA, TREASURY_ADDRESS, USDC_VAULT, USDT_VAULT, allocationData, tokenAccountData, userData, vault} from './chain';
@@ -24,6 +25,8 @@ export interface Effects {
   amount: bigint;
   cents: bigint;
   stage: number;
+  /** B1d-2: the referrer a `register_referrer` before the purchase sets (its argument), or null when there is none. */
+  registers: string | null;
 }
 
 export function effectsOf(wire: string, chain: Map<string, AccountData | null>, pythUsd: number): Effects {
@@ -37,7 +40,9 @@ export function effectsOf(wire: string, chain: Map<string, AccountData | null>,
   const config = chain.get(CONFIG_PDA)?.data ?? new Uint8Array(0);
   const stage = config[CONFIG_LAYOUT.fields.current_stage.offset] as number;
   const cents = currency === 'SOL' ? solCents(amount, scaledUsdPrice(pythUsd) as bigint) : usdCentsForStable(amount);
-  return {currency, amount, cents, stage};
+  const keys = message.staticAccountKeys.map(k => k.toBase58());
+  const register = message.compiledInstructions.find(i => keys[i.programIdIndex] === MAINNET_PROGRAM_ID && i.data.length === 40 && REGISTER_REFERRER_DISCRIMINATOR.every((b, n) => i.data[n] === b));
+  return {currency, amount, cents, stage, registers: register === undefined ? null : new PublicKey(register.data.subarray(8, 40)).toBase58()};
 }
 
 /** The simulation the program and an honest proxy give for `wire`, against `chain` as it is at that slot. */
@@ -47,7 +52,10 @@ export function honestSimulation(wire: string, addresses: readonly string[], cha
   const user = chain.get(PDAS.userAccount.toBase58()) ?? null;
   const A = PRESALE_ALLOCATION_LAYOUT.fields;
   const before = allocation === null ? {total: 0n, spent: 0n, count: 0} : {total: readU64LE(allocation.data, A.total_tokens.offset), spent: readU64LE(allocation.data, A.total_spent_cents.offset), count: allocation.data[A.purchase_count.offset] as number};
-  const referrer = allocation === null ? null : allocation.data.subarray(A.referrer.offset, A.referrer.offset + 32).every(b => b === 0) ? null : new PublicKey(allocation.data.subarray(A.referrer.offset, A.referrer.offset + 32)).toBase58();
+  const onChain = allocation === null ? null : allocation.data.subarray(A.referrer.offset, A.referrer.offset + 32).every(b => b === 0) ? null : new PublicKey(allocation.data.subarray(A.referrer.offset, A.referrer.offset + 32)).toBase58();
+  // register_referrer sets the referrer once (the program refuses a second, AlreadyHasReferrer) and creates the two PDAs.
+  if (e.registers !== null && onChain !== null) return {err: {InstructionError: [2, {Custom: 6016}]}, logs: [], unitsConsumed: 9_000, slot: SIMULATED_SLOT, accounts: null};
+  const referrer = e.registers ?? onChain;
   const allocationAfter: SimulatedAccount = {
     lamports: allocation?.lamports ?? ALLOCATION_RENT,
     owner: MAINNET_PROGRAM_ID,
```

`extension/src/background/presale/__tests__/buy.test.ts`:

```diff
diff --git a/extension/src/background/presale/__tests__/buy.test.ts b/extension/src/background/presale/__tests__/buy.test.ts
index 091814e..7b60a9c 100644
--- a/extension/src/background/presale/__tests__/buy.test.ts
+++ b/extension/src/background/presale/__tests__/buy.test.ts
@@ -215,7 +215,7 @@ describe('the purchase intent (§1.4)', () => {
       {currency: 'SOL', amount: '1', stage: 1.5},
       {currency: 'SOL', amount: '1', stage: '0'},
       {currency: 'SOL', amount: '1'},
-      {currency: 'SOL', amount: '1', stage: 0, referrer: null},
+      {currency: 'SOL', amount: '1', stage: 0, extra: null},
     ]) {
       expect([bad, parsePurchaseIntent(bad)]).toEqual([bad, null]);
     }
@@ -430,11 +430,11 @@ describe('prepare: the build (§3.3 step 4, C2, C5)', () => {
     const user = new PublicKey(ACCOUNT);
     const resolved = {referrerAllocation: new PublicKey(DEFAULT_REFERRER_ALLOCATION), registerReferrer: null};
     const compile = (ixs: TransactionInstruction[]) => new TransactionMessage({payerKey: user, recentBlockhash: BLOCKHASH, instructions: ixs}).compileToV0Message();
-    const sol = {account: ACCOUNT, currency: 'SOL' as const, referrerAllocation: DEFAULT_REFERRER_ALLOCATION, destination: TREASURY_ADDRESS, source: null, amount: 7n};
+    const sol = {account: ACCOUNT, currency: 'SOL' as const, referrerAllocation: DEFAULT_REFERRER_ALLOCATION, registerReferrer: null, destination: TREASURY_ADDRESS, source: null, amount: 7n};
     expect(assertPurchaseMessage(compile(buildBuyInstructions(user, 7n, 0, resolved, new PublicKey(TREASURY_ADDRESS))), sol)).toBe(2);
     expect(() => assertPurchaseMessage(compile(buildBuyInstructions(user, 7n, 0, resolved, new PublicKey(LOOKALIKE_TREASURY))), sol)).toThrow('expected');
     expect(() => assertPurchaseMessage(compile(buildBuyInstructions(user, 8n, 0, resolved, new PublicKey(TREASURY_ADDRESS))), sol)).toThrow('data');
-    const usdc = {account: ACCOUNT, currency: 'USDC' as const, referrerAllocation: DEFAULT_REFERRER_ALLOCATION, destination: USDC_VAULT, source: HOLDING_LARGE, amount: 7n};
+    const usdc = {account: ACCOUNT, currency: 'USDC' as const, referrerAllocation: DEFAULT_REFERRER_ALLOCATION, registerReferrer: null, destination: USDC_VAULT, source: HOLDING_LARGE, amount: 7n};
     const source = new PublicKey(HOLDING_LARGE);
     expect(assertPurchaseMessage(compile(buildStablecoinBuyInstructions(user, 'USDC', 7n, 0, resolved, new PublicKey(TREASURY_ADDRESS), source)), usdc)).toBe(2);
     expect(() => assertPurchaseMessage(compile(buildStablecoinBuyInstructions(user, 'USDC', 7n, 0, resolved, new PublicKey(LOOKALIKE_TREASURY), source)), usdc)).toThrow('expected');
@@ -445,7 +445,7 @@ describe('prepare: the build (§3.3 step 4, C2, C5)', () => {
   it('assertPurchaseMessage: a second required signer or an address-lookup table is an engine bug, thrown (the positive control passes)', () => {
     const user = new PublicKey(ACCOUNT);
     const resolved = {referrerAllocation: new PublicKey(DEFAULT_REFERRER_ALLOCATION), registerReferrer: null};
-    const sol = {account: ACCOUNT, currency: 'SOL' as const, referrerAllocation: DEFAULT_REFERRER_ALLOCATION, destination: TREASURY_ADDRESS, source: null, amount: 7n};
+    const sol = {account: ACCOUNT, currency: 'SOL' as const, referrerAllocation: DEFAULT_REFERRER_ALLOCATION, registerReferrer: null, destination: TREASURY_ADDRESS, source: null, amount: 7n};
     const good = new TransactionMessage({payerKey: user, recentBlockhash: BLOCKHASH, instructions: buildBuyInstructions(user, 7n, 0, resolved, new PublicKey(TREASURY_ADDRESS))}).compileToV0Message();
     const variant = (o: Partial<Pick<MessageV0, 'header' | 'addressTableLookups'>>) =>
       new MessageV0({header: o.header ?? good.header, staticAccountKeys: good.staticAccountKeys, recentBlockhash: good.recentBlockhash, compiledInstructions: good.compiledInstructions, addressTableLookups: o.addressTableLookups ?? good.addressTableLookups});
@@ -1474,7 +1474,8 @@ describe('presale.prepareBuy through the real message handler (§1.4)', () => {
   it.each([
     ['an extra key', msg({extra: 1})],
     ['no intent', {type: 'presale.prepareBuy', account: ACCOUNT}],
-    ['an intent with an extra key', msg({intent: {...intent('SOL', SOL_2), referrer: null}})],
+    ['an intent with an extra key', msg({intent: {...intent('SOL', SOL_2), extra: null}})],
+    ['a referral address outside base58', msg({intent: {...intent('SOL', SOL_2), referrer: '0'.repeat(32)}})],
     ['a stage of 10', msg({intent: intent('SOL', SOL_2, 10)})],
     ['an amount of 0', msg({intent: intent('SOL', '0')})],
     ['NOC', msg({intent: {currency: 'NOC', amount: '1', stage: 0}})],
```

`extension/src/background/presale/__tests__/api.test.ts`:

```diff
diff --git a/extension/src/background/presale/__tests__/api.test.ts b/extension/src/background/presale/__tests__/api.test.ts
index 1cbe93c..cf1ff33 100644
--- a/extension/src/background/presale/__tests__/api.test.ts
+++ b/extension/src/background/presale/__tests__/api.test.ts
@@ -113,8 +113,8 @@ const PURCHASE: PendingRecord = pendingRecord({
 const {wire: _wire, firstBroadcast: _firstBroadcast, ...PURCHASE_VIEW} = PURCHASE;
 
 describe('the partition (§1.4): the popup and the full tab only', () => {
-  it('the three types of B1d-1b Task 1, Task 2’s prepare, Task 3’s four and B1d-2’s presale.unrecorded, all privileged', () => {
-    expect(PRESALE_MESSAGE_TYPES).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded']);
+  it('the three types of B1d-1b Task 1, Task 2’s prepare, Task 3’s four and B1d-2’s presale.unrecorded and presale.checkReferrer, all privileged', () => {
+    expect(PRESALE_MESSAGE_TYPES).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer']);
   });
 
   it('answered from the popup and from the full tab (positive control)', async () => {
```

`extension/src/background/__tests__/messages.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index abd8c70..44ac4b1 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -194,7 +194,7 @@ describe('message partitions', () => {
 
 // This file runs in both vitest runs (vitest.nopresale.config.ts marks the off one).
 const off = process.env.NOCTURA_PRESALE === '0';
-const PRESALE = off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded'];
+const PRESALE = off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer'];
 
 describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
@@ -291,7 +291,7 @@ describe('message partitions (B1b-1 types)', () => {
 });
 
 describe(`presale.* in the build ${off ? 'without' : 'with'} presale (B1d §1.1, §1.4)`, () => {
-  const TYPES = ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded'];
+  const TYPES = ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer'];
 
   it(off ? 'every presale type is refused as an unknown type, from the popup too' : 'every presale type is privileged: past the partition from the popup (positive control — no handler is registered in this file, so unavailable)', async () => {
     const ext = vaultExt();
```

`extension/src/__tests__/presaleSwitch.test.ts`:

```diff
diff --git a/extension/src/__tests__/presaleSwitch.test.ts b/extension/src/__tests__/presaleSwitch.test.ts
index 4ca09a4..e737663 100644
--- a/extension/src/__tests__/presaleSwitch.test.ts
+++ b/extension/src/__tests__/presaleSwitch.test.ts
@@ -26,8 +26,8 @@ describe(`the build-time switch in this run (${off ? 'off' : 'on'})`, () => {
 
   it(off ? 'the stubs export empty values: no message type, no route, no slot, no description' : 'the entries export what B1d-1b has built so far, the stubs empty values', () => {
     // B1d-1b: the background entry's message types (§1.4) — Task 1's three, Task 2's prepare, Task 3's four; B1d-2's
-    // presale.unrecorded; the stub adds none.
-    expect(bgEntry.PRESALE_MESSAGE_TYPES).toEqual(off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded']);
+    // presale.unrecorded (Task 1) and presale.checkReferrer (Task 2); the stub adds none.
+    expect(bgEntry.PRESALE_MESSAGE_TYPES).toEqual(off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer']);
     expect(bgStub.PRESALE_MESSAGE_TYPES).toEqual([]);
     // B1d-1b Tasks 4–6: the popup entry's routes — #23 (`presale`), #20's purchase variant (`presale-confirm`) and #50b
     // (`geo`) — and its slots (the record words, the resume, #11's banner and Buy); the stub adds none.
```

`extension/src/unlock/__tests__/reauthPurchase.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/reauthPurchase.test.ts b/extension/src/unlock/__tests__/reauthPurchase.test.ts
index 7b2348a..02d43d8 100644
--- a/extension/src/unlock/__tests__/reauthPurchase.test.ts
+++ b/extension/src/unlock/__tests__/reauthPurchase.test.ts
@@ -79,6 +79,19 @@ describe('#10 for a purchase (§4.2)', () => {
     expect(unstyled('v-reauth')).toEqual([]);
   });
 
+  it('B1d-2 (Q47): a purchase that registers its referrer — "Referred by" with the whole address in groups of four after "To", then Q47’s note', async () => {
+    const referrer = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
+    await shown({...ABOUT, referrer: {address: referrer, registers: true}});
+    expect(rows().slice(3, 6)).toEqual([
+      ['To', `Noctura presale · ${MAINNET_SOL_TREASURY}`],
+      ['Referred by', referrer],
+      ["Saved to your presale account with this purchase. It can't be changed later.", ''],
+    ]);
+    const groups = [...el('ra-rows').querySelectorAll('.intent-row')][4]?.querySelectorAll('.addr-groups > span') ?? [];
+    expect([...groups].map(g => g.textContent)).toEqual(referrer.match(/.{1,4}/g));
+    expect(unstyled('v-reauth')).toEqual([]);
+  });
+
   it('confirmed: the challenge satisfied and the SAME tab to the resume route — nothing signed or sent from here (D38)', async () => {
     const {h, broadcasts} = await shown();
     type(el<HTMLInputElement>('ra-password'), PW);
```

`extension/scripts/__tests__/check-no-presale.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index 45c8d20..1c4527c 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -164,7 +164,7 @@ describe('app.features.json', () => {
 describe('strings', () => {
   const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});
 
-  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm', () => {
+  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row', () => {
     expect(MARKERS.slice(0, 9)).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale-buy']);
     // §6.2's named strings #23 shows, then Q01, Q02, Q04–Q06, Q11–Q16, Q19, Q40c, Q41c, Q41d, Q43, Q52 (each literal part ≥ 8 characters).
     expect(MARKERS.slice(9)).toEqual([
@@ -240,6 +240,10 @@ describe('strings', () => {
       // B1d-2 Task 1: the record's message type and its alarm's name.
       'presale.unrecorded',
       'presale-record',
+      // B1d-2 Task 2: the referral address's message type, then #10's referrer row (Q47: the label and its note).
+      'presale.checkReferrer',
+      'Referred by',
+      "Saved to your presale account with this purchase. It can't be changed later.",
     ]);
   });
 
@@ -248,7 +252,7 @@ describe('strings', () => {
   it('every presale.* message type of api.ts is a marker', () => {
     const api = readFileSync(join(ROOT, 'src/background/presale/api.ts'), 'utf8');
     const types = [...(/PRESALE_MESSAGE_TYPES: readonly string\[\] = \[([^\]]*)\]/.exec(api)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
-    expect(types).toHaveLength(9);
+    expect(types).toHaveLength(10);
     for (const t of types) expect([t, MARKERS.includes(t)]).toEqual([t, true]);
   });
 
```

- [ ] **Step 2: Run them on the previous task's tree — red.**

In a `git archive` copy of Task 1's commit with only the Step 1 files added (node_modules linked): `npx tsc --noEmit; echo $?` → `2`, 11 errors, all in `referrer.test.ts` (5 × `Property 'referrer' does not exist on type 'PurchaseIntent'`, 5 × `'registerReferrer' does not exist in type '{ account: string; …'`, 1 × `'referrer' does not exist in type 'PurchaseIntent'`).

`npx vitest run src/background/presale/__tests__/referrer.test.ts src/background/presale/__tests__/captured.test.ts src/background/presale/__tests__/buy.test.ts src/background/presale/__tests__/api.test.ts src/background/__tests__/messages.test.ts src/__tests__/presaleSwitch.test.ts src/unlock/__tests__/reauthPurchase.test.ts scripts/__tests__/check-no-presale.test.mjs` — `Test Files  6 failed | 2 passed (8)` · `Tests  58 failed | 294 passed (352)`: `referrer.test.ts` `51 failed | 1 passed (52)` (the one green row is "the gate closed and a stage that moved decide first" — the old code refuses those before it looks at a referrer); `captured.test.ts` `2 passed` — **green on the old tree by design**: the capture is B1d-1b's own output, so it is the positive control that the fixture describes the code it was taken from (it stays green through Task 1, which changed neither); `buy.test.ts` `140 passed` (its two edited rows hold on both trees); `api.test.ts` the type-list row; `messages.test.ts` "every privileged type is refused …" and "every presale type is privileged …"; `presaleSwitch.test.ts` "the entries export …"; `reauthPurchase.test.ts` the "Referred by" row; `check-no-presale.test.mjs` the `MARKERS` row and "every presale.* message type of api.ts is a marker" (ten types). The off run is unchanged by this task (no new row runs there; `messages.test.ts` lists no presale type off).

- [ ] **Step 3: Implement.**

`extension/src/background/presale/state.ts`:

```diff
diff --git a/extension/src/background/presale/state.ts b/extension/src/background/presale/state.ts
index 8e1bf02..1cf7fb5 100644
--- a/extension/src/background/presale/state.ts
+++ b/extension/src/background/presale/state.ts
@@ -207,24 +207,9 @@ function stateFrom(accounts: readonly (AccountData | null)[], me: PublicKey, now
     blocked = b;
   }
 
-  // 6. The allocation: absent, or the program's PresaleAllocation of this very account (user@8) with a Borsh bool claimed.
-  const A = PRESALE_ALLOCATION_LAYOUT.fields;
-  let facts: AllocationFacts = {exists: false, totalBase: 0n, bonusBase: 0n, spentCents: 0n, purchaseCount: 0, referrer: null};
-  if (allocation !== null && allocation !== undefined) {
-    const d = allocation.data;
-    if (!isProgramAccount(allocation, PRESALE_ALLOCATION_LAYOUT) || pubkeyAt(d, A.user) !== me.toBase58() || boolAt(d, A.claimed) === null) {
-      return unavailable('malformed');
-    }
-    const referrer = d.subarray(A.referrer.offset, A.referrer.offset + 32);
-    facts = {
-      exists: true,
-      totalBase: u64At(d, A.total_tokens),
-      bonusBase: u64At(d, A.referral_bonus_tokens),
-      spentCents: u64At(d, A.total_spent_cents),
-      purchaseCount: u32At(d, A.purchase_count),
-      referrer: isZero(referrer) ? null : base58.encode(referrer),
-    };
-  }
+  // 6. The allocation: absent, or the program's PresaleAllocation of this very account.
+  const facts = allocationFacts(allocation, me.toBase58());
+  if (facts === null) return unavailable('malformed');
 
   // 7. The treasury: a plain System account with no data.
   if (treasury === null || treasury === undefined || treasury.owner !== SYSTEM_PROGRAM_ID || treasury.data.length !== 0) return unavailable('malformed');
@@ -255,6 +240,27 @@ function stateFrom(accounts: readonly (AccountData | null)[], me: PublicKey, now
   };
 }
 
+/**
+ * Rule 6 on an allocation account read for `owner` (a base58 key): absent (`exists: false`, totals 0, no referrer), or the
+ * program's PresaleAllocation of this very account (user@8 = owner) with a Borsh bool claimed — its facts; anything else
+ * null (malformed). The snapshot reads the buyer's this way, and B1d-2's referral address a referrer's (§3.5).
+ */
+export function allocationFacts(allocation: AccountData | null | undefined, owner: string): AllocationFacts | null {
+  if (allocation === null || allocation === undefined) return {exists: false, totalBase: 0n, bonusBase: 0n, spentCents: 0n, purchaseCount: 0, referrer: null};
+  const A = PRESALE_ALLOCATION_LAYOUT.fields;
+  const d = allocation.data;
+  if (!isProgramAccount(allocation, PRESALE_ALLOCATION_LAYOUT) || pubkeyAt(d, A.user) !== owner || boolAt(d, A.claimed) === null) return null;
+  const referrer = d.subarray(A.referrer.offset, A.referrer.offset + 32);
+  return {
+    exists: true,
+    totalBase: u64At(d, A.total_tokens),
+    bonusBase: u64At(d, A.referral_bonus_tokens),
+    spentCents: u64At(d, A.total_spent_cents),
+    purchaseCount: u32At(d, A.purchase_count),
+    referrer: isZero(referrer) ? null : base58.encode(referrer),
+  };
+}
+
 /** The allocation as `resolveReferrerWith` takes it, from the snapshot (no second read). */
 export function allocationRefOf(snapshot: PresaleSnapshot): AllocationRef {
   const a = snapshot.allocation;
@@ -262,11 +268,13 @@ export function allocationRefOf(snapshot: PresaleSnapshot): AllocationRef {
 }
 
 /**
- * The referrer allocation a purchase by `account` passes (C7): the on-chain referrer's `["allocation", referrer]` PDA,
- * or the default key's when there is none. No captured referrer before B1d-2.
+ * How a purchase by `account` applies a referrer (C7, §3.5): an on-chain referrer always wins — its `["allocation",
+ * referrer]` PDA, nothing registered; else `captured` (B1d-2's referral address) is registered when it can take effect —
+ * a first purchase — and its allocation passed; else the default key's allocation. core's resolveReferrerWith decides,
+ * from this snapshot (no second read).
  */
-export function referrerAllocationOf(snapshot: PresaleSnapshot, account: string): Promise<ResolvedReferrer> {
-  return resolveReferrerWith(async () => allocationRefOf(snapshot), new PublicKey(account), null);
+export function referrerAllocationOf(snapshot: PresaleSnapshot, account: string, captured: string | null = null): Promise<ResolvedReferrer> {
+  return resolveReferrerWith(async () => allocationRefOf(snapshot), new PublicKey(account), captured);
 }
 
 /** The config alone (presale.banner, §1.4): rules 1–4 decide, as in readPresaleState. */
```

`extension/src/background/presale/buy.ts`:

```diff
diff --git a/extension/src/background/presale/buy.ts b/extension/src/background/presale/buy.ts
index 8c62f07..618ac29 100644
--- a/extension/src/background/presale/buy.ts
+++ b/extension/src/background/presale/buy.ts
@@ -1,9 +1,10 @@
 import {MessageV0, PublicKey, TransactionMessage, VersionedMessage, VersionedTransaction} from '@solana/web3.js';
-import {base64} from '@scure/base';
+import {base58, base64} from '@scure/base';
 import type {Ext} from '../../ext';
 import type {WalletDeps} from '../deps';
 import type {GeoAnswer} from '../geo/gate';
 import {getSession} from '../session';
+import {readWalletView} from '../accountsStore';
 import {inFlightFor, readPending} from '../pendingStore';
 import {readSettings} from '../settings';
 import {REAUTH_PERCENT, usdMicros} from '../reauthPolicy';
@@ -14,7 +15,7 @@ import {PREPARED_TTL_MS, newestPrepared, preparedIntegrity, rentRefusal, storePr
 import {SendRefused} from '../sendTypes';
 import {COMPUTE_BUDGET_PROGRAM} from '../dapp/decode/decode';
 import {tokenAccountInfo} from '../dapp/tokenState';
-import {readPresaleStateAt, referrerAllocationOf, type PresaleSnapshot, type PresaleState} from './state';
+import {allocationFacts, allocationRefOf, readPresaleStateAt, referrerAllocationOf, type PresaleSnapshot, type PresaleState} from './state';
 import {PRESALE_CURRENCIES, PRESALE_FEE_BOUND_LAMPORTS, quote, type BalanceCode, type PresaleBalances, type PresaleCurrency} from './quote';
 import {PRESALE_ALLOCATION_LAYOUT, USER_ACCOUNT_LAYOUT} from './layouts';
 import {recordConfirmedPurchase} from './record';
@@ -28,7 +29,7 @@ import {
   PYTH_SOL_USD_ACCOUNT,
 } from '../../../../core/presale/addresses';
 import {derivePresalePdas, readU64LE} from '../../../../core/presale/allocation';
-import {COMPUTE_UNIT_LIMIT, buildBuyInstructions, buildStablecoinBuyInstructions, encodeU64LE} from '../../../../core/presale/buyInstructions';
+import {COMPUTE_UNIT_LIMIT, REGISTER_REFERRER_DISCRIMINATOR, buildBuyInstructions, buildStablecoinBuyInstructions, encodeU64LE} from '../../../../core/presale/buyInstructions';
 import {
   PRESALE_ALLOCATION_RENT_LAMPORTS,
   PRESALE_USER_ACCOUNT_RENT_LAMPORTS,
@@ -41,8 +42,9 @@ import {
 import {SPL_TOKEN_PROGRAM} from '../../../../core/solana/encoding';
 import {estimatePriorityFee} from '../../../../core/solana/priorityFee';
 import {networkFeeLamports, priorityFeeLamports, selectSourceTokenAccount} from '../../../../core/solana/transfer';
+import {resolveReferrerWith, type AllocationRef} from '../../../../core/presale/referrer';
 import {isGeoRefusal} from '../../../../core/geo/fetch';
-import {RequestUnreachable, RpcHttpError, RpcMalformed, RpcResponseError, SYSTEM_PROGRAM_ID, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../core/solana/rpc';
+import {RequestUnreachable, RpcHttpError, RpcMalformed, RpcResponseError, SYSTEM_PROGRAM_ID, type AccountData, type SimulatedAccount, type SimulationOutcome, type TokenAccountEntry} from '../../../../core/solana/rpc';
 import type {Prices} from '../../../../core/portfolio/value';
 
 /**
@@ -53,11 +55,16 @@ import type {Prices} from '../../../../core/portfolio/value';
  */
 export const PRESALE_BUY_KIND = 'presale-buy';
 
-/** §1.4: what the user asked for — the currency, the amount in its base units (decimal string) and the stage they saw (C27). */
+/**
+ * §1.4: what the user asked for — the currency, the amount in its base units (decimal string), the stage they saw (C27)
+ * and (B1d-2, §3.5) the referral address they entered, present only when they entered one: an intent without it is
+ * B1d-1b's, key for key, so its digest, its integrity and the bytes built from it are unchanged.
+ */
 export interface PurchaseIntent {
   currency: PresaleCurrency;
   amount: string;
   stage: number;
+  referrer?: string;
 }
 
 /** §5: the refusals of a purchase (presale/ only — the shared SendRefusal is unchanged). */
@@ -78,7 +85,11 @@ export type PurchaseRefusal =
   | 'no-sol-price'
   | 'simulation-failed'
   | 'simulation-mismatch'
-  | 'presale-busy';
+  | 'presale-busy'
+  | ReferrerLine;
+
+/** §3.5, §5: why a referral address cannot be taken — each the line under #23's field (Q46 a–c, Q48). */
+export type ReferrerLine = 'referrer-invalid' | 'referrer-self' | 'referrer-not-applicable' | 'referrer-no-allocation';
 
 export class PurchaseRefused extends Error {
   readonly code: PurchaseRefusal;
@@ -95,21 +106,33 @@ const AMOUNT = /^[1-9]\d{0,19}$/;
 const MAX_U64 = 2n ** 64n - 1n;
 const INTENT_KEYS = ['currency', 'amount', 'stage'];
 
-/** Untrusted or stored input → the intent rebuilt key by key, or null: exactly three keys, a known currency, a positive u64, a stage 0–9. */
+/**
+ * Untrusted or stored input → the intent rebuilt key by key, or null: the three keys, a known currency, a positive u64,
+ * a stage 0–9 — and `referrer` (B1d-2): absent or null is no referrer (the rebuilt intent then has no such key), else a
+ * string of 32–44 base58 characters (§1.4; whether it is a key that can refer is §3.5's, checkReferrer's).
+ */
 export function parsePurchaseIntent(x: unknown): PurchaseIntent | null {
   if (typeof x !== 'object' || x === null || Array.isArray(x)) return null;
   const o = x as Record<string, unknown>;
-  if (Object.keys(o).length !== INTENT_KEYS.length || !INTENT_KEYS.every(k => Object.hasOwn(o, k))) return null;
-  const {currency, amount, stage} = o;
+  const keys = Object.keys(o);
+  if (!INTENT_KEYS.every(k => Object.hasOwn(o, k)) || !keys.every(k => INTENT_KEYS.includes(k) || k === 'referrer')) return null;
+  const {currency, amount, stage, referrer} = o;
   if (typeof currency !== 'string' || !(PRESALE_CURRENCIES as readonly string[]).includes(currency)) return null;
   if (typeof amount !== 'string' || !AMOUNT.test(amount) || BigInt(amount) > MAX_U64) return null;
   if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 0 || stage >= STAGE_PRICE_TICKS.length) return null;
-  return {currency: currency as PresaleCurrency, amount, stage};
+  const intent: PurchaseIntent = {currency: currency as PresaleCurrency, amount, stage};
+  if (referrer === undefined || referrer === null) return intent;
+  if (typeof referrer !== 'string' || !ADDRESS.test(referrer)) return null;
+  return {...intent, referrer};
 }
 
-/** §3.3 step 6: a purchase's re-authentication is bound to who buys what at which stage (B1d-2 adds the referrer). */
-function purchaseDigestValue(account: string, intent: PurchaseIntent): {account: string; currency: string; amount: string; stage: number} {
-  return {account, currency: intent.currency, amount: intent.amount, stage: intent.stage};
+/**
+ * §3.3 step 6: a purchase's re-authentication is bound to who buys what at which stage and — B1d-2 — through whom: the
+ * referrer joins the digest when the intent names one (a purchase without one keeps B1d-1b's digest).
+ */
+function purchaseDigestValue(account: string, intent: PurchaseIntent): {account: string; currency: string; amount: string; stage: number; referrer?: string} {
+  const value = {account, currency: intent.currency, amount: intent.amount, stage: intent.stage};
+  return intent.referrer === undefined ? value : {...value, referrer: intent.referrer};
 }
 
 /** §3.4 (D3): B1b's 5 % and dollar rules plus the first purchase; B1b's first-send and whole-balance-to-new do not apply (C5). */
@@ -157,6 +180,12 @@ export interface PurchaseAbout {
   rentLamports: string;
   reasons: PresaleReauthReason[];
   thresholdCents: number;
+  /**
+   * B1d-2 (§4.2, Q47): the referrer the purchase credits — the on-chain one, or the one this purchase registers
+   * (`registers`, only ever on a first purchase) — present only when it credits one, so a purchase without a referrer is
+   * described as in B1d-1b.
+   */
+  referrer?: {address: string; registers: boolean};
 }
 const ABOUT_KEYS = ['kind', 'account', 'currency', 'amount', 'stage', 'priceTicks', 'nocBase', 'spentCents', 'destination', 'networkLamports', 'priorityLamports', 'rentLamports', 'reasons', 'thresholdCents'];
 const DIGITS = /^\d{1,20}$/;
@@ -165,7 +194,14 @@ const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 /** The exact shape this module issues: a stored description with any other shape is dropped by the challenge store. */
 export function isPurchaseAbout(x: KindAbout): boolean {
   const a = x as Record<string, unknown>;
-  if (Object.keys(a).length !== ABOUT_KEYS.length || !ABOUT_KEYS.every(k => Object.hasOwn(a, k))) return false;
+  const keys = Object.hasOwn(a, 'referrer') ? [...ABOUT_KEYS, 'referrer'] : ABOUT_KEYS;
+  if (Object.keys(a).length !== keys.length || !keys.every(k => Object.hasOwn(a, k))) return false;
+  if (Object.hasOwn(a, 'referrer')) {
+    const r = record(a.referrer);
+    if (r === null || !exactKeys(r, ['address', 'registers']) || typeof r.address !== 'string' || !ADDRESS.test(r.address) || typeof r.registers !== 'boolean') return false;
+    // A registration happens only on a first purchase, which is always re-authenticated (§3.4).
+    if (r.registers && !(Array.isArray(a.reasons) && a.reasons.includes('first-purchase'))) return false;
+  }
   if (a.kind !== PRESALE_BUY_KIND || parsePurchaseIntent({currency: a.currency, amount: a.amount, stage: a.stage}) === null) return false;
   if (typeof a.account !== 'string' || !ADDRESS.test(a.account) || typeof a.destination !== 'string' || !ADDRESS.test(a.destination)) return false;
   const numbers = [a.priceTicks, a.nocBase, a.spentCents, a.networkLamports, a.priorityLamports, a.rentLamports];
@@ -199,6 +235,7 @@ function rebasePurchaseAbout(stored: KindAbout, fresh: KindAbout): KindAbout | n
     rentLamports: f.rentLamports,
     reasons: f.reasons,
     thresholdCents: f.thresholdCents,
+    ...(f.referrer === undefined ? {} : {referrer: {address: f.referrer.address, registers: f.referrer.registers}}),
   };
   return about as unknown as KindAbout;
 }
@@ -229,7 +266,9 @@ const SHOWN_VIEW_KEYS = ['currency', 'amount', 'stage', 'priceTicks', 'nocBase',
 /**
  * What prepare kept beside the bound fields, read back for this intent — `shown` is not in the integrity, so it is a
  * claim like any stored value: exactly the shape preparePurchase writes, the intent's own currency, amount and stage,
- * the stage's price and the destination the state pins for the currency. Rebuilt key by key (a fresh object), or null.
+ * the stage's price and the destination the state pins for the currency; with the intent's referral address (B1d-2),
+ * that address as the referrer it registers and one instruction more, else an on-chain referrer (registering nothing)
+ * or none. Rebuilt key by key (a fresh object), or null.
  */
 function shownOf(entry: PreparedEntry, intent: PurchaseIntent): PreparedPurchase['shown'] | null {
   const shown = record(entry.shown);
@@ -240,12 +279,15 @@ function shownOf(entry: PreparedEntry, intent: PurchaseIntent): PreparedPurchase
   if (shown === null || fees === null || sim === null || view === null || basis === null || !exactKeys(shown, ['fees', 'simulation', 'view', 'basis'])) return null;
   if (!exactKeys(fees, ['networkLamports', 'markupLamports']) || !digits(fees.networkLamports) || fees.markupLamports !== '0') return null;
   const programs = sim.programs;
-  if (!exactKeys(sim, ['slot', 'elapsedMs', 'programs', 'instructionCount']) || !count(sim.slot) || !count(sim.elapsedMs) || sim.instructionCount !== 3) return null;
+  const registers = intent.referrer !== undefined;
+  if (!exactKeys(sim, ['slot', 'elapsedMs', 'programs', 'instructionCount']) || !count(sim.slot) || !count(sim.elapsedMs) || sim.instructionCount !== (registers ? 4 : 3)) return null;
   if (!Array.isArray(programs) || programs.length !== 2 || programs[0] !== 'compute-budget' || programs[1] !== 'presale') return null;
   if (!exactKeys(view, SHOWN_VIEW_KEYS) || view.currency !== intent.currency || view.amount !== intent.amount || view.stage !== intent.stage) return null;
   if (view.priceTicks !== (STAGE_PRICE_TICKS[intent.stage] as bigint).toString() || !digits(view.nocBase) || !digits(view.spentCents) || view.destination !== PINNED_DESTINATION[intent.currency]) return null;
   const referrer = view.referrer === null ? null : record(view.referrer);
-  if (view.referrer !== null && (referrer === null || !exactKeys(referrer, ['address', 'registers']) || typeof referrer.address !== 'string' || !ADDRESS.test(referrer.address) || referrer.registers !== false)) return null;
+  if (registers ? referrer === null : view.referrer !== null && referrer === null) return null;
+  if (referrer !== null && (!exactKeys(referrer, ['address', 'registers']) || typeof referrer.address !== 'string' || !ADDRESS.test(referrer.address) || referrer.registers !== registers)) return null;
+  if (registers && referrer?.address !== intent.referrer) return null;
   const vf = record(view.fees);
   if (vf === null || !exactKeys(vf, ['networkLamports', 'priorityLamports', 'rentLamports']) || vf.networkLamports !== fees.networkLamports || !digits(vf.priorityLamports) || !digits(vf.rentLamports)) return null;
   const reasons = view.reasons;
@@ -254,7 +296,7 @@ function shownOf(entry: PreparedEntry, intent: PurchaseIntent): PreparedPurchase
   if (basis.referrer !== null && (typeof basis.referrer !== 'string' || !ADDRESS.test(basis.referrer))) return null;
   return {
     fees: {networkLamports: fees.networkLamports, markupLamports: '0'},
-    simulation: {slot: sim.slot, elapsedMs: sim.elapsedMs, programs: ['compute-budget', 'presale'], instructionCount: 3},
+    simulation: {slot: sim.slot, elapsedMs: sim.elapsedMs, programs: ['compute-budget', 'presale'], instructionCount: registers ? 4 : 3},
     view: {
       currency: intent.currency,
       amount: intent.amount,
@@ -263,7 +305,7 @@ function shownOf(entry: PreparedEntry, intent: PurchaseIntent): PreparedPurchase
       nocBase: view.nocBase,
       spentCents: view.spentCents,
       destination: view.destination,
-      referrer: referrer === null ? null : {address: referrer.address as string, registers: false},
+      referrer: referrer === null ? null : {address: referrer.address as string, registers},
       fees: {networkLamports: vf.networkLamports, priorityLamports: vf.priorityLamports, rentLamports: vf.rentLamports},
       reasons: [...(reasons as PresaleReauthReason[])],
     },
@@ -278,14 +320,21 @@ function shownOf(entry: PreparedEntry, intent: PurchaseIntent): PreparedPurchase
  * not open (`geo-closed`) — decided first, as at prepare; the state (one read of the whole §2.1 snapshot) unavailable,
  * refused, closed, blocked or at another stage; the signed bytes not this purchase to the pinned destination crediting
  * the referrer allocation the program would credit now (signedPurchase); the account's presale accounts not as prepared
- * (`state-changed`); the prepared cents outside the limits now (`below-min`, `above-max-tx`, `above-user-limit`).
+ * (`state-changed`); B1d-2 — a referral address that can no longer be taken (§3.5, read again now: an account of the
+ * wallet since, its allocation gone); the prepared cents outside the limits now (`below-min`, `above-max-tx`,
+ * `above-user-limit`).
  */
 async function purchaseBeforeSign({ext, deps}: KindHost, entry: PreparedEntry, intent: PurchaseIntent): Promise<void> {
   const shown = shownOf(entry, intent);
   if (shown === null) throw new SendRefused('prepared-invalid', 'the prepared purchase does not read back');
   // Refused here, before the take, rather than by submitSigned's own in-flight guard after it.
   if (inFlightFor(await readPending(ext), entry.account) !== undefined) throw new PurchaseRefused('in-flight');
-  const [read, geo] = await Promise.all([readPresaleStateAt(deps.reader, entry.account, deps.now()), gateAnswer(deps)]);
+  const referrer = intent.referrer ?? null;
+  const [read, geo, referrerRead] = await Promise.all([
+    readPresaleStateAt(deps.reader, entry.account, deps.now()),
+    gateAnswer(deps),
+    referrer === null ? Promise.resolve(null) : readReferrerAllocation(deps, referrer).then(a => ({a}), (e: unknown) => ({e})),
+  ]);
   if (!geo.open) throw new PurchaseRefused('geo-closed', geo.reason ?? '');
   const snapshot = openSnapshot(read.state, intent);
   await signedPurchase(entry, intent, snapshot, shown.fees.networkLamports);
@@ -293,6 +342,11 @@ async function purchaseBeforeSign({ext, deps}: KindHost, entry: PreparedEntry, i
   if (snapshot.allocation.exists !== b.allocationExists || snapshot.allocation.purchaseCount !== b.purchaseCount || snapshot.allocation.referrer !== b.referrer || snapshot.userAccountExists !== b.userAccountExists) {
     throw new PurchaseRefused('state-changed', 'the account’s presale accounts are not as prepared');
   }
+  if (referrer !== null && referrerRead !== null) {
+    if ('e' in referrerRead) throw readFailure(referrerRead.e) ?? referrerRead.e;
+    const line = await referrerLine({account: entry.account, referrer, own: await walletAccounts(ext), snapshot, referrerAllocation: referrerRead.a});
+    if (line !== null) throw new PurchaseRefused(line);
+  }
   const limit = checkLimits({cents: BigInt(shown.view.spentCents), ...snapshot.limits});
   if (limit !== null) throw new PurchaseRefused(limit);
 }
@@ -301,9 +355,12 @@ async function purchaseBeforeSign({ext, deps}: KindHost, entry: PreparedEntry, i
  * Review 1 M1: the sign-time check rests on the bytes that will be signed, not on `shown`. The entry must read back under
  * its integrity (so the message checked is the one sendPrepared signs after the take), and its message must be exactly
  * the purchase of this intent to the destination the state pins, crediting the referrer allocation the fresh snapshot
- * resolves — `state-changed` when only that allocation differs (a referrer registered since prepare), `prepared-invalid`
- * for anything else. Its compute budget too (review I1): exactly COMPUTE_UNIT_LIMIT units at a price whose network fee is
- * within PRESALE_FEE_BOUND_LAMPORTS and is the prepared fee (`shownFee`, which the record shows).
+ * resolves — `state-changed` when only the referrer differs (a referrer registered since prepare, a purchase since that
+ * makes the intent's no longer register), `prepared-invalid` for anything else. Its compute budget too (review I1):
+ * exactly COMPUTE_UNIT_LIMIT units at a price whose network fee is within PRESALE_FEE_BOUND_LAMPORTS and is the prepared
+ * fee (`shownFee`, which the record shows). B1d-2: the intent's referral address (bound by the integrity) is resolved as
+ * prepare resolved it, so the bytes must carry its `register_referrer` and its allocation as account 3 — and such an
+ * entry signs only behind a re-authentication (§3.4: a registration is permanent and always a first purchase).
  */
 async function signedPurchase(entry: PreparedEntry, intent: PurchaseIntent, snapshot: PresaleSnapshot, shownFee: string): Promise<void> {
   const invalid = new SendRefused('prepared-invalid', 'the prepared purchase is not this purchase');
@@ -318,25 +375,32 @@ async function signedPurchase(entry: PreparedEntry, intent: PurchaseIntent, snap
   }
   const fee = signedNetworkFee(message);
   if (fee === null || fee > PRESALE_FEE_BOUND_LAMPORTS || fee !== BigInt(shownFee)) throw invalid;
+  const referrer = intent.referrer ?? null;
+  if (referrer !== null && entry.challengeId === null) throw invalid;
   const keys = message.staticAccountKeys.map(k => k.toBase58());
-  const named = (message.compiledInstructions[2]?.accountKeyIndexes ?? []).map(k => keys[k]);
+  const named = (message.compiledInstructions.at(-1)?.accountKeyIndexes ?? []).map(k => keys[k]);
   // A stablecoin's paying account is taken from the message's own bytes, by design: nothing bound names it (the intent
   // has none; prepare chose it from the holdings and the simulation proved its loss), and the program refuses a wrong one.
   const expected = {account: entry.account, currency: intent.currency, destination: PINNED_DESTINATION[intent.currency], source: intent.currency === 'SOL' ? null : (named[4] ?? null), amount: BigInt(intent.amount)};
-  const matches = (referrerAllocation: string): boolean => {
+  const matches = (referrerAllocation: string, registerReferrer: string | null): boolean => {
     try {
-      assertPurchaseMessage(message, {...expected, referrerAllocation});
+      assertPurchaseMessage(message, {...expected, referrerAllocation, registerReferrer});
       return true;
     } catch {
       return false;
     }
   };
-  if (matches((await referrerAllocationOf(snapshot, entry.account)).referrerAllocation.toBase58())) return;
-  const built = named[3];
-  if (built !== undefined && matches(built)) throw new PurchaseRefused('state-changed', 'the referrer allocation the purchase credits changed');
+  const now = await referrerAllocationOf(snapshot, entry.account, referrer);
+  if (matches(now.referrerAllocation.toBase58(), now.registerReferrer?.toBase58() ?? null)) return;
+  // What prepare built: the intent's referral address registered and credited, or (without one) the allocation it named.
+  const built = referrer !== null ? matches(allocationOfReferrer(referrer), referrer) : named[3] !== undefined && matches(named[3], null);
+  if (built) throw new PurchaseRefused('state-changed', 'the referrer allocation the purchase credits changed');
   throw invalid;
 }
 
+/** The `["allocation", referrer]` PDA: the account a purchase credits for `referrer` (account 3). */
+const allocationOfReferrer = (referrer: string): string => derivePresalePdas(new PublicKey(referrer)).userAllocation.toBase58();
+
 /**
  * Review I1: the network fee the message's compute budget pays — ix 0 exactly `[2, u32 LE units]` with units ===
  * COMPUTE_UNIT_LIMIT, ix 1 exactly `[3, u64 LE µlamports per CU]`, neither naming an account (their program ids are
@@ -414,6 +478,69 @@ const usable = (p: number | undefined): number | null => (typeof p === 'number'
 const priceOf = (prices: Prices | null, currency: PresaleCurrency): number | null =>
   prices === null ? null : usable(currency === 'SOL' ? prices.solana : currency === 'USDC' ? prices.usdc : prices.usdt);
 
+/** Every account of this wallet: the unlocked session's and the stored wallet's (§3.5, C32 — "never the buyer's own", made stricter). */
+async function walletAccounts(ext: Ext): Promise<ReadonlySet<string>> {
+  const [session, wallet] = await Promise.all([getSession(ext), readWalletView(ext)]);
+  return new Set([...(session ?? []).map(a => a.publicKey), ...(wallet?.accounts ?? []).map(a => a.publicKey)]);
+}
+
+/** A referrer's `["allocation", referrer]` account, one getAccountsData; a failed read is the purchase's read failure. */
+async function readReferrerAllocation(deps: WalletDeps, referrer: string): Promise<AccountData | null> {
+  const [a] = await read(deps.reader.getAccountsData([allocationOfReferrer(referrer)]));
+  return a ?? null;
+}
+
+/** 32 bytes of base58 that are not the default key (core's captureIsValid, without its self test — §3.5 answers that as `referrer-self`). */
+function isReferrerKey(referrer: string): boolean {
+  let bytes: Uint8Array;
+  try {
+    bytes = base58.decode(referrer);
+  } catch {
+    return false;
+  }
+  return bytes.length === 32 && !bytes.every(b => b === 0);
+}
+
+/**
+ * §3.5 (C32, D8), in its order — first what the key itself says: `referrer-invalid` (not 32 bytes of base58, or the
+ * default key); `referrer-self` (the buyer or any account of this wallet).
+ */
+function referrerKeyLine(account: string, referrer: string, own: ReadonlySet<string>): ReferrerLine | null {
+  if (!isReferrerKey(referrer)) return 'referrer-invalid';
+  return referrer === account || own.has(referrer) ? 'referrer-self' : null;
+}
+
+/**
+ * …then what the chain says: `referrer-not-applicable` (the purchase would not register it — an on-chain referrer, or
+ * not a first purchase: decided by resolveReferrerWith itself, the function the purchase is built with, so what is
+ * accepted here is exactly what is registered); `referrer-no-allocation` (its `["allocation", referrer]` absent or not a
+ * valid PresaleAllocation of it, §2.1 rule 6). Null: the purchase registers it.
+ */
+async function referrerChainLine(account: string, referrer: string, ref: AllocationRef, referrerAllocation: AccountData | null): Promise<ReferrerLine | null> {
+  if ((await resolveReferrerWith(async () => ref, new PublicKey(account), referrer)).registerReferrer?.toBase58() !== referrer) return 'referrer-not-applicable';
+  return allocationFacts(referrerAllocation, referrer)?.exists === true ? null : 'referrer-no-allocation';
+}
+
+/** §3.5 whole, against a snapshot — at the signature (prepare asks the key's lines before it reads the referrer's allocation). */
+async function referrerLine(i: {account: string; referrer: string; own: ReadonlySet<string>; snapshot: PresaleSnapshot; referrerAllocation: AccountData | null}): Promise<ReferrerLine | null> {
+  return referrerKeyLine(i.account, i.referrer, i.own) ?? (await referrerChainLine(i.account, i.referrer, allocationRefOf(i.snapshot), i.referrerAllocation));
+}
+
+/**
+ * presale.checkReferrer (§1.4, §3.5): the line #23's field shows on blur, or null when the address can be registered.
+ * The key's lines need no network; the chain's one getAccountsData of the buyer's allocation and the referrer's — read
+ * fresh, and the purchase's prepare and its signature check it all again. A failed read throws the purchase's refusal
+ * (`presale-unavailable`, `coordinator-refused`); the buyer's allocation not as §2.1 rule 6 reads one too.
+ */
+export async function checkReferrer(ext: Ext, deps: WalletDeps, account: string, referrer: string): Promise<ReferrerLine | null> {
+  const key = referrerKeyLine(account, referrer, await walletAccounts(ext));
+  if (key !== null) return key;
+  const [mine, theirs] = await read(deps.reader.getAccountsData([derivePresalePdas(new PublicKey(account)).userAllocation.toBase58(), allocationOfReferrer(referrer)]));
+  const facts = allocationFacts(mine, account);
+  if (facts === null) throw new PurchaseRefused('presale-unavailable', 'malformed');
+  return referrerChainLine(account, referrer, {exists: facts.exists, referrer: facts.referrer, purchaseCount: facts.purchaseCount}, theirs ?? null);
+}
+
 /** A state read as a purchase needs it: open, at the stage the user saw — else the refusal its answer means (§5). */
 function openSnapshot(state: PresaleState, intent: PurchaseIntent): PresaleSnapshot {
   if (state.kind === 'unavailable') throw new PurchaseRefused(state.code === 'refused' ? 'coordinator-refused' : 'presale-unavailable', state.code);
@@ -438,26 +565,44 @@ export function expectedPurchaseAccounts(i: {account: string; currency: PresaleC
   return [...head, i.source, i.destination, MINTS[i.currency], i.account, SPL_TOKEN_PROGRAM, SYSTEM_PROGRAM_ID];
 }
 
+/** `register_referrer`'s accounts in the IDL's order (§3.3, C37): user_account, user_allocation, user, system_program. */
+function expectedRegisterAccounts(account: string): string[] {
+  const pdas = derivePresalePdas(new PublicKey(account));
+  return [pdas.userAccount.toBase58(), pdas.userAllocation.toBase58(), account, SYSTEM_PROGRAM_ID];
+}
+
+const sameBytes = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => a.length === b.length && Array.from(a).every((x, n) => x === b[n]);
+
 /**
  * The compiled message is exactly the purchase this module meant: one signer (the account, the payer), the two
- * compute-budget instructions, then the purchase — its discriminator, its amount and its accounts as
- * expectedPurchaseAccounts names them. Anything else is an engine bug: thrown, never shown or simulated.
+ * compute-budget instructions, B1d-2's `register_referrer(registerReferrer)` when it registers one (§3.5: its accounts
+ * and its argument exactly; none otherwise), then the purchase — its discriminator, its amount and its accounts as
+ * expectedPurchaseAccounts names them. Anything else is an engine bug: thrown, never shown or simulated. Answers the
+ * purchase instruction's index.
  */
-export function assertPurchaseMessage(message: MessageV0, i: Parameters<typeof expectedPurchaseAccounts>[0] & {amount: bigint}): number {
+export function assertPurchaseMessage(message: MessageV0, i: Parameters<typeof expectedPurchaseAccounts>[0] & {amount: bigint; registerReferrer: string | null}): number {
   const keys = message.staticAccountKeys.map(k => k.toBase58());
   if (keys[0] !== i.account || message.header.numRequiredSignatures !== 1 || message.addressTableLookups.length !== 0) throw new Error('the purchase message is not signed by the account alone');
   const ixs = message.compiledInstructions;
   const programs = ixs.map(ix => keys[ix.programIdIndex]);
-  if (ixs.length !== 3 || programs[0] !== COMPUTE_BUDGET_PROGRAM || programs[1] !== COMPUTE_BUDGET_PROGRAM || programs[2] !== MAINNET_PROGRAM_ID) {
+  const presale = i.registerReferrer === null ? 1 : 2;
+  if (ixs.length !== 2 + presale || programs[0] !== COMPUTE_BUDGET_PROGRAM || programs[1] !== COMPUTE_BUDGET_PROGRAM || programs.slice(2).some(p => p !== MAINNET_PROGRAM_ID)) {
     throw new Error(`the purchase message has unexpected instructions: ${programs.join(', ')}`);
   }
-  const purchase = ixs[2] as (typeof ixs)[number];
+  if (i.registerReferrer !== null) {
+    const register = ixs[2] as (typeof ixs)[number];
+    const named = register.accountKeyIndexes.map(k => keys[k]);
+    const expected = expectedRegisterAccounts(i.account);
+    if (named.length !== expected.length || named.some((k, n) => k !== expected[n])) throw new Error(`register_referrer names ${named.join(', ')}; expected ${expected.join(', ')}`);
+    if (!sameBytes(register.data, [...REGISTER_REFERRER_DISCRIMINATOR, ...new PublicKey(i.registerReferrer).toBytes()])) throw new Error('the register_referrer data is not this referrer');
+  }
+  const index = ixs.length - 1;
+  const purchase = ixs[index] as (typeof ixs)[number];
   const named = purchase.accountKeyIndexes.map(k => keys[k]);
   const expected = expectedPurchaseAccounts(i);
   if (named.length !== expected.length || named.some((k, n) => k !== expected[n])) throw new Error(`the purchase names ${named.join(', ')}; expected ${expected.join(', ')}`);
-  const data = [...PURCHASE_DISCRIMINATORS[i.currency], ...encodeU64LE(i.amount)];
-  if (purchase.data.length !== data.length || purchase.data.some((b, n) => b !== data[n])) throw new Error('the purchase instruction data is not this purchase');
-  return 2;
+  if (!sameBytes(purchase.data, [...PURCHASE_DISCRIMINATORS[i.currency], ...encodeU64LE(i.amount)])) throw new Error('the purchase instruction data is not this purchase');
+  return index;
 }
 
 /** §3.3 step 5 (C23): the program's own refusal of the purchase instruction → its code. */
@@ -493,6 +638,8 @@ interface Basis {
   account: string;
   currency: PresaleCurrency;
   amount: bigint;
+  /** The referrer the purchase credits — the on-chain one, the one it registers (B1d-2), or null. */
+  referrer: string | null;
   snapshot: PresaleSnapshot;
   solBefore: bigint;
   source: {address: string; before: bigint} | null;
@@ -567,6 +714,9 @@ function judge(sim: SimulationOutcome, b: Basis): Verdict {
   if (new PublicKey(d.subarray(A.user.offset, A.user.offset + 32)).toBase58() !== b.account || (claimed !== 0 && claimed !== 1)) {
     return refuse('simulation-mismatch', 'the allocation after is not this account’s');
   }
+  // §3.3 step 5 (B1d-2): the referrer after is the one the purchase credits — the one it registers, or as it was.
+  const referrerAfter = d.subarray(A.referrer.offset, A.referrer.offset + 32);
+  if (!sameBytes(referrerAfter, b.referrer === null ? new Uint8Array(32) : new PublicKey(b.referrer).toBytes())) return refuse('simulation-mismatch', 'the allocation after names another referrer');
   const count = u32At(d, A.purchase_count.offset) - s.allocation.purchaseCount;
   const spentCents = readU64LE(d, A.total_spent_cents.offset) - s.allocation.spentCents;
   const nocBase = readU64LE(d, A.total_tokens.offset) - s.allocation.totalBase;
@@ -651,11 +801,21 @@ export async function preparePurchase(ext: Ext, deps: WalletDeps, account: strin
   if (!session.some(a => a.publicKey === account)) throw new PurchaseRefused('unknown-account');
   if (inFlightFor(await readPending(ext), account) !== undefined) throw new PurchaseRefused('in-flight');
 
-  // 2. A fresh snapshot and a fresh gate answer; the gate closed decides first, as the view.
+  // 2. A fresh snapshot and a fresh gate answer; the gate closed decides first, as the view. B1d-2: the referral
+  // address is checked again here (§3.5) against this snapshot and a fresh read of its allocation — never trusted from
+  // the popup — and refused rather than dropped when this purchase would not register it.
+  const referrer = intent.referrer ?? null;
   const [first, geo] = await Promise.all([readPresaleStateAt(deps.reader, account, deps.now()), gateAnswer(deps)]);
   if (!geo.open) throw new PurchaseRefused('geo-closed', geo.reason ?? '');
   let snapshot = openSnapshot(first.state, intent);
   let snapshotSlot = first.slot;
+  if (referrer !== null) {
+    const own = await walletAccounts(ext);
+    const key = referrerKeyLine(account, referrer, own);
+    if (key !== null) throw new PurchaseRefused(key);
+    const line = await referrerChainLine(account, referrer, allocationRefOf(snapshot), await readReferrerAllocation(deps, referrer));
+    if (line !== null) throw new PurchaseRefused(line);
+  }
 
   // 3. Limits and balances: the quote's lines with this prepare's own reads. A stablecoin pays from the account that
   // holds it (C2): the largest holding of that mint owned by the account.
@@ -677,10 +837,12 @@ export async function preparePurchase(ext: Ext, deps: WalletDeps, account: strin
   const source = sourceAddress === null ? null : {address: sourceAddress, before: own.find(h => h.pubkey === sourceAddress)?.amount ?? 0n};
 
   // 4. Build at the normal tier (its fee within PRESALE_FEE_BOUND_LAMPORTS, which the quote assumed). The destination is
-  // the one the state pinned; the referrer allocation is the snapshot's (the state accepted this account).
+  // the one the state pinned; the referrer as the snapshot resolves it (the state accepted this account) — an on-chain
+  // one, or the referral address registered (step 2 refused one that would not be).
   const destination = currency === 'SOL' ? MAINNET_SOL_TREASURY : snapshot.vaults[currency].address;
-  const resolved = await referrerAllocationOf(snapshot, account);
-  if (resolved.registerReferrer !== null) throw new Error('B1d-1b registers no referrer');
+  const resolved = await referrerAllocationOf(snapshot, account, referrer);
+  const registerReferrer = resolved.registerReferrer?.toBase58() ?? null;
+  const effectiveReferrer = resolved.effectiveReferrerAddress;
   const [price, latest] = await Promise.all([read(estimatePriorityFee(deps.reader, 'normal')), read(deps.reader.getLatestBlockhash())]);
   const user = new PublicKey(account);
   const treasury = new PublicKey(MAINNET_SOL_TREASURY);
@@ -690,7 +852,7 @@ export async function preparePurchase(ext: Ext, deps: WalletDeps, account: strin
       : buildStablecoinBuyInstructions(user, currency, amount, price, resolved, treasury, new PublicKey((source as {address: string}).address));
   const message = new TransactionMessage({payerKey: user, recentBlockhash: latest.blockhash, instructions}).compileToV0Message();
   const referrerAllocation = resolved.referrerAllocation.toBase58();
-  const purchaseIndex = assertPurchaseMessage(message, {account, currency, referrerAllocation, destination, source: source?.address ?? null, amount});
+  const purchaseIndex = assertPurchaseMessage(message, {account, currency, referrerAllocation, registerReferrer, destination, source: source?.address ?? null, amount});
   const networkLamports = networkFeeLamports(message.header.numRequiredSignatures, price, COMPUTE_UNIT_LIMIT);
   const priorityLamports = priorityFeeLamports(price, COMPUTE_UNIT_LIMIT);
   if (networkLamports > PRESALE_FEE_BOUND_LAMPORTS) throw new Error(`the purchase's network fee ${networkLamports} exceeds its bound`);
@@ -698,7 +860,7 @@ export async function preparePurchase(ext: Ext, deps: WalletDeps, account: strin
   // 5. Simulate the bytes, check everything; one retry, the same bytes, for a destination-only mismatch (C39).
   const wire = base64.encode(new VersionedTransaction(message).serialize());
   const keys = message.staticAccountKeys.map(k => k.toBase58());
-  const basisOf = (s: PresaleSnapshot): Basis => ({account, currency, amount, snapshot: s, solBefore, source, destination, networkLamports, purchaseIndex, keys});
+  const basisOf = (s: PresaleSnapshot): Basis => ({account, currency, amount, referrer: effectiveReferrer, snapshot: s, solBefore, source, destination, networkLamports, purchaseIndex, keys});
   const simulate = async (s: PresaleSnapshot) => {
     const started = deps.now();
     const sim = await read(deps.reader.simulateTransaction(wire, {accounts: simulationAccounts(basisOf(s))}));
@@ -713,7 +875,8 @@ export async function preparePurchase(ext: Ext, deps: WalletDeps, account: strin
     const fresh = openSnapshot(again.state, intent);
     // The fresh snapshot replaces the first for everything; what the bytes were built from must not have moved.
     if (fresh.userAccountExists !== snapshot.userAccountExists || fresh.allocation.exists !== snapshot.allocation.exists) throw new PurchaseRefused('state-changed', 'the accounts this purchase creates changed');
-    if ((await referrerAllocationOf(fresh, account)).referrerAllocation.toBase58() !== referrerAllocation) throw new PurchaseRefused('state-changed', 'the referrer changed');
+    const freshReferrer = await referrerAllocationOf(fresh, account, referrer);
+    if (freshReferrer.referrerAllocation.toBase58() !== referrerAllocation || (freshReferrer.registerReferrer?.toBase58() ?? null) !== registerReferrer) throw new PurchaseRefused('state-changed', 'the referrer changed');
     const freshLine = line(fresh);
     if (freshLine !== null) throw new PurchaseRefused(freshLine);
     snapshot = fresh;
@@ -725,7 +888,8 @@ export async function preparePurchase(ext: Ext, deps: WalletDeps, account: strin
   if (verdict.kind === 'refuse') throw new PurchaseRefused(verdict.code, verdict.detail);
   const measured = verdict;
 
-  // 6. Re-authentication (§3.4) and its challenge, bound to the intent digest (the kind, account, currency, amount, stage).
+  // 6. Re-authentication (§3.4) and its challenge, bound to the intent digest (the kind, account, currency, amount,
+  // stage and the referral address). A registration is a first purchase (resolveReferrerWith), so always re-authenticated.
   const settings = await readSettings(ext);
   const decimals = currency === 'SOL' ? 9 : 6;
   const reasons = presaleReauthReasons({
@@ -744,7 +908,7 @@ export async function preparePurchase(ext: Ext, deps: WalletDeps, account: strin
     nocBase: measured.nocBase.toString(),
     spentCents: measured.spentCents.toString(),
     destination,
-    referrer: snapshot.allocation.referrer === null ? null : {address: snapshot.allocation.referrer, registers: false},
+    referrer: effectiveReferrer === null ? null : {address: effectiveReferrer, registers: registerReferrer !== null},
     fees: {networkLamports: networkLamports.toString(), priorityLamports: priorityLamports.toString(), rentLamports: measured.rent.toString()},
   };
   let challengeId: string | null = null;
@@ -764,6 +928,7 @@ export async function preparePurchase(ext: Ext, deps: WalletDeps, account: strin
       rentLamports: view.fees.rentLamports,
       reasons,
       thresholdCents: settings.reauthUsdCents,
+      ...(view.referrer === null ? {} : {referrer: view.referrer}),
     };
     const fresh = about as unknown as KindAbout;
     const carried = opts.challengeId;
```

`extension/src/background/presale/api.ts`:

```diff
diff --git a/extension/src/background/presale/api.ts b/extension/src/background/presale/api.ts
index fcb4879..4c00f8e 100644
--- a/extension/src/background/presale/api.ts
+++ b/extension/src/background/presale/api.ts
@@ -10,7 +10,7 @@ import {isOpen, readPending, viewOf, type PendingView} from '../pendingStore';
 import {usdMicros} from '../reauthPolicy';
 import {readPresaleConfig, readPresaleState, type PresaleSnapshot, type PresaleState, type StageFacts, type UnavailableCode} from './state';
 import {PRESALE_CURRENCIES, quote, type PresaleBalances, type PresaleCurrency, type QuoteLine} from './quote';
-import {PRESALE_BUY_KIND, PurchaseRefused, gateAnswer, parsePurchaseIntent, preparePurchase, purchasePreparedFor} from './buy';
+import {PRESALE_BUY_KIND, PurchaseRefused, checkReferrer, gateAnswer, parsePurchaseIntent, preparePurchase, purchasePreparedFor} from './buy';
 import {PRESALE_RECORD_ALARM, unrecordedFor, wakePresaleRecords} from './record';
 import {CHALLENGE_ID} from '../reauthChallenges';
 import {SendRefused} from '../sendTypes';
@@ -34,6 +34,7 @@ export const PRESALE_MESSAGE_TYPES: readonly string[] = [
   'presale.buy',
   'presale.discardPrepared',
   'presale.unrecorded',
+  'presale.checkReferrer',
 ];
 
 /** `presale.quote` answers from the last view's snapshot of the account at most this old (§1.4). */
@@ -91,6 +92,7 @@ export interface BannerView {
 
 const MALFORMED: Result = {ok: false, error: 'malformed'};
 const AMOUNT = /^[1-9]\d{0,19}$/;
+const REFERRER = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 /** A prepared entry's id: 16 random bytes as 32 hex characters (digest.ts randomId). */
 const PREPARED_ID = /^[0-9a-f]{32}$/;
 const MAX_U64 = 2n ** 64n - 1n;
@@ -356,6 +358,27 @@ async function discardMessage(ext: Ext, _deps: WalletDeps, msg: Readonly<Record<
   return {ok: true};
 }
 
+/**
+ * presale.checkReferrer {account, referrer} (§1.4, §3.5, B1d-2): `{ok: true}` when the purchase would register the
+ * address, `{ok: false, line}` with the line #23's field shows; a read failure is the purchase's refusal. The field's
+ * answer only — the prepare and the signature decide again. `referrer` is a string of 32–44 base58 characters (§1.4);
+ * whether it is a key is the line's to say.
+ */
+async function checkReferrerMessage(ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
+  if (!onlyKeys(msg, ['type', 'account', 'referrer'])) return MALFORMED;
+  const {account, referrer} = msg;
+  if (!isAddress(account) || typeof referrer !== 'string' || !REFERRER.test(referrer)) return MALFORMED;
+  const refused = await sessionRefusal(ext, account);
+  if (refused !== null) return refused;
+  try {
+    const line = await checkReferrer(ext, deps, account, referrer);
+    return {ok: true, data: line === null ? {ok: true} : {ok: false, line}};
+  } catch (e) {
+    if (e instanceof PurchaseRefused) return e.detail === '' ? {ok: false, error: e.code} : {ok: false, error: e.code, data: {detail: e.detail}};
+    throw e;
+  }
+}
+
 /** presale.unrecorded {account} (§1.4, §4.6, D29): the signatures #27 shows Q34 for — this account's records not accepted; no network. */
 async function unrecordedMessage(ext: Ext, _deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
   const a = await accountOnly(ext, msg);
@@ -383,6 +406,7 @@ export function registerPresale(host: PresaleHost): void {
   host.handle('presale.buy', guarded(buyMessage));
   host.handle('presale.discardPrepared', guarded(discardMessage));
   host.handle('presale.unrecorded', guarded(unrecordedMessage));
+  host.handle('presale.checkReferrer', guarded(checkReferrerMessage));
   // §2.4: the record's retry wakes on its alarm, and resumes at every start (a worker stopped between two slots, or
   // between a purchase's confirmation and its entry — reconciled first).
   host.alarm(PRESALE_RECORD_ALARM, () => wakePresaleRecords(host.ext, host.deps));
```

`extension/src/unlock/presale.ts`:

```diff
diff --git a/extension/src/unlock/presale.ts b/extension/src/unlock/presale.ts
index 38b24c2..c57772a 100644
--- a/extension/src/unlock/presale.ts
+++ b/extension/src/unlock/presale.ts
@@ -12,13 +12,16 @@ import type {OtherDescription} from './challenge';
  * fee it is part of, the threshold an integer in range, and the reasons a non-empty list of known codes, each once.
  * Anything else is null: #10 then offers only Cancel. Header Q18 (as #10's eyebrow and its headline amount), the rows
  * of #20's purchase variant, reason lines Q17 and B1b's (controller copy, owner-delegated 2026-10-19); Q56 — new in
- * B1d-1b Task 5, flagged to the owner — the line once Cancel discarded the purchase (B1b's names a send).
+ * B1d-1b Task 5, flagged to the owner — the line once Cancel discarded the purchase (B1b's names a send). B1d-2 (§4.2,
+ * Q47): a purchase that credits a referrer carries `referrer` {address, registers} — "Referred by" with the whole
+ * address, and Q47's note when this purchase registers it (only ever on a first purchase, so only with Q17's reason).
  */
 const CURRENCIES = {SOL: 9, USDC: 6, USDT: 6} as const;
 const DIGITS = /^\d{1,20}$/;
 const AMOUNT = /^[1-9]\d{0,19}$/;
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const KEYS = ['account', 'amount', 'currency', 'destination', 'kind', 'networkLamports', 'nocBase', 'priceTicks', 'priorityLamports', 'reasons', 'rentLamports', 'spentCents', 'stage', 'thresholdCents'];
+const KEYS_REFERRED = [...KEYS, 'referrer'].sort();
 const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
 
 const PURCHASE_TEXT = {
@@ -37,14 +40,26 @@ const PURCHASE_TEXT = {
   firstPurchase: 'Re-auth required for your first presale purchase from this account.',
   /** Q56 (new, flagged). */
   cancelled: 'Purchase cancelled. Nothing was sent.',
+  /** Q47. */
+  referredBy: 'Referred by',
+  registers: "Saved to your presale account with this purchase. It can't be changed later.",
 } as const;
 
 const sol = (lamports: bigint): string => `${formatAmount(lamports, 9, {min: 0, max: 9})} SOL`;
 const dollars = (cents: number): string => formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2});
 
 export function describePresale(about: Readonly<Record<string, unknown>>): OtherDescription | null {
-  if (about.kind !== 'presale-buy' || Object.keys(about).sort().join(',') !== KEYS.join(',') || !KEYS.every(k => own(about, k))) return null;
+  const keys = own(about, 'referrer') ? KEYS_REFERRED : KEYS;
+  if (about.kind !== 'presale-buy' || Object.keys(about).sort().join(',') !== keys.join(',') || !keys.every(k => own(about, k))) return null;
   const {account, destination, currency, amount, stage, priceTicks, nocBase, spentCents, networkLamports, priorityLamports, rentLamports, reasons, thresholdCents} = about;
+  const referrer = own(about, 'referrer') ? about.referrer : undefined;
+  if (referrer !== undefined) {
+    if (typeof referrer !== 'object' || referrer === null || Array.isArray(referrer) || Object.keys(referrer).sort().join(',') !== 'address,registers') return null;
+    const r = referrer as Record<string, unknown>;
+    if (typeof r.address !== 'string' || !ADDRESS.test(r.address) || typeof r.registers !== 'boolean') return null;
+    // A registration is only ever a first purchase (the background's rule): described with any other reasons, nothing is.
+    if (r.registers && !(Array.isArray(reasons) && reasons.includes('first-purchase'))) return null;
+  }
   if (typeof account !== 'string' || !ADDRESS.test(account) || typeof destination !== 'string' || !ADDRESS.test(destination)) return null;
   if (typeof currency !== 'string' || !own(CURRENCIES, currency)) return null;
   if (typeof amount !== 'string' || !AMOUNT.test(amount)) return null;
@@ -72,9 +87,16 @@ export function describePresale(about: Readonly<Record<string, unknown>>): Other
     {label: PURCHASE_TEXT.stage, value: PURCHASE_TEXT.stageOf(stage + 1), address: null},
     {label: PURCHASE_TEXT.price, value: PURCHASE_TEXT.perNoc(BigInt(priceTicks as string)), address: null},
     {label: REAUTH.to, value: PURCHASE_TEXT.presale, address: destination},
+  ];
+  if (referrer !== undefined) {
+    const r = referrer as {address: string; registers: boolean};
+    rows.push({label: PURCHASE_TEXT.referredBy, value: null, address: r.address});
+    if (r.registers) rows.push({label: PURCHASE_TEXT.registers, value: null, address: null});
+  }
+  rows.push(
     {label: REAUTH.networkFee, value: sol(network - priority), address: null},
     {label: REAUTH.priority, value: sol(priority), address: null},
-  ];
+  );
   if (rent > 0n) rows.push({label: PURCHASE_TEXT.setup, value: sol(rent), address: null});
   return {
     kind: 'other',
```

`extension/scripts/check-no-presale.mjs`:

```diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index a9e7531..3731a7d 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -145,6 +145,10 @@ export const MARKERS = [
   // B1d-2 Task 1: the record's message type and its alarm's name.
   'presale.unrecorded',
   'presale-record',
+  // B1d-2 Task 2: the referral address's message type, then #10's referrer row (Q47: the label and its note).
+  'presale.checkReferrer',
+  'Referred by',
+  "Saved to your presale account with this purchase. It can't be changed later.",
 ];
 // Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
 // be a string search. The decoder's instruction names are read from its source (DECODER).
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates.**

Run: the Step 2 commands — `Test Files  8 passed (8)` · `Tests  352 passed (352)` (referrer 52, captured 2, buy 140, api 67, messages 29, presaleSwitch 3, reauthPurchase 7, check-no-presale 52).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  217 passed (217)` · `Tests  4579 passed (4579)` (previous tree 215 / 4523: +2 files, +56 tests — referrer 52, captured 2, reauthPurchase +1, buy +1). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  16 passed (16)` · `Tests  430 passed | 15 skipped (445)` (unchanged: no row of this task runs off; `messages.test.ts` lists no presale type there).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build (rpc methods unchanged — `getAccountsData` was already on the list; vault isolation unchanged), the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 23 required modules; 79 markers (none in the off build, each in the on build); 9 strings and the decoder's instruction names stay in the off build`. `npm run csp` — `CSP ok` for `dist/app` and `dist-nopresale/app`; `npm run secrets` — exit 0. No root `src/`, no `core/` and no `web/` change: the root `tsc` / `jest` and web's `verify` are not this task's.

Playwright (this task registers a message and changes #10): `npx playwright test e2e/presale.spec.ts e2e/presaleSwitch.spec.ts e2e/presaleOff.spec.ts e2e/presaleDapp.spec.ts e2e/visual-presale.spec.ts e2e/unlock.spec.ts e2e/csp.spec.ts` — `25 passed (7.1m)` normally and `25 passed (6.6m)` under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'` (dry run: on the builds of `6a7090b`, whose product code the final commit keeps — it adds one unit row; the builds and gates above are those builds too). No E2E row names a referral address yet (E2E 12 is Task 6's).

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1d-2 the referral address in prepare and sign — presale.checkReferrer (§3.5's order: invalid, self = any account of this wallet, not-applicable by resolveReferrerWith itself, no-allocation by §2.1 rule 6); intent.referrer bound by the digest (absent = B1d-1b's bytes, captured from a1bda47); prepare checks it again and registers it (register_referrer + account 3), refusing — never dropping — one that would not register; referrer@84 after checked for every purchase; the retry re-resolves it; the signature re-verifies the registration and account 3 from the integrity-bound bytes, signs a registration only behind its proof, and re-reads the referrer's allocation and the wallet's accounts; the record's referrerAddress; #10 Referred by + Q47" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test file.** `RT` = `referrer.test.ts` (52), `CT` = `captured.test.ts` (2), `RP` = `reauthPurchase.test.ts` (7), `NP` = `check-no-presale.test.mjs` (52). Bold ids are the failure modes this task was asked to hunt.

| id | the change | named test → observed |
|---|---|---|
| R1 | **(sign from the bytes)** `signedPurchase` resolves the fresh snapshot without the intent’s referral address: `const now = await referrerAllocationOf(snapshot, entry.account, referrer);` → `const now = await referrerAllocationOf(snapshot, entry.account, null);` | RT 8 rows, among them “end to end: prepare → #10 proven → presale.buy → v1_pending names the referrer → confirmed → the record POSTs referrerAddress”; “every check passing at the signature (positive control): it signs the registration”; “its allocation gone → referrer-no-allocation; nothing signed” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  8 failed \| 44 passed (52)` |
| R2 | **(the registration’s argument)** `register_referrer`’s data compared with its own bytes after the discriminator (any referrer accepted): `if (!sameBytes(register.data, [...REGISTER_REFERRER_DISCRIMINATOR, ...new PublicKey(i.registerReferrer).toBytes()]))` → `if (!sameBytes(register.data, [...REGISTER_REFERRER_DISCRIMINATOR, ...register.data.subarray(8)]))` | RT “assertPurchaseMessage: a registration where none is expected, none where one is → an engine bug, thrown”; “the registration names another referrer while account 3 stays this one’s allocation → prepared-invalid” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 50 passed (52)` |
| R3 | the registration’s first two accounts unchecked: `if (named.length !== expected.length \|\| named.some((k, n) => k !== expected[n])) throw new Error('register_referrer names` → `if (named.length !== expected.length \|\| named.some((k, n) => k !== expected[n] && n > 1)) throw new Error('register_referrer names` | RT “the registration’s accounts swapped (user_account and user_allocation) → prepared-invalid” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R4 | **(re-authentication)** an entry naming a referral address with `challengeId` null signs: `if (referrer !== null && entry.challengeId === null) throw invalid;` → (removed) | RT “a registration whose re-authentication was taken away (challengeId null, integrity recomputed) → prepared-invalid; nothing signed” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R5 | **(referrer@84)** `judge` without the referrer-after check: `if (!sameBytes(referrerAfter, b.referrer === null` → `if (b.account === '' && !sameBytes(referrerAfter, b.referrer === null` | RT “a purchase without a referral address: referrer@84 stays as it was — zero, or the on-chain referrer”; “referrer@84 after must be the registered referrer: left zero (the registration ignored), or another key → simulation-mismatch” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 50 passed (52)` |
| R6 | the simulation’s expected referrer = the snapshot’s (a registration expected to leave it zero): `({account, currency, amount, referrer: effectiveReferrer, snapshot: s,` → `({account, currency, amount, referrer: s.allocation.referrer, snapshot: s,` | RT 26 rows, among them “a first SOL purchase: register_referrer between the compute budget and the purchase, account 3 its allocation, the view and #10 say it registers”; “a first USDC purchase from an allocation that never bought: the same instruction, no rent (both PDAs exist), still re-authenticated”; “a prepare without the referral address after one with it replaces the entry: one per account (§1.3), the registration gone with it” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  26 failed \| 26 passed (52)` |
| R7 | **(never dropped)** `referrerChainLine` never answers `referrer-not-applicable`: `.registerReferrer?.toBase58() !== referrer) return 'referrer-not-applicable';` → `.registerReferrer?.toBase58() !== referrer && account === '') return 'referrer-not-applicable';` | RT “no referral address: the on-chain referrer is credited, nothing registered, as B1d-1b; with one: refused, the input never ignored”; “referrer-not-applicable: an on-chain referrer, or not a first purchase (purchase_count 1) — an on-chain referrer always wins (D8)”; “refused, never dropped: an on-chain referrer, not a first purchase → referrer-not-applicable before anything is built or simulated”; “the order: invalid, self, not-applicable, no-allocation — each before the next” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  4 failed \| 48 passed (52)` |
| R8 | **(self)** self = the buyer only: `return referrer === account \|\| own.has(referrer) ? 'referrer-self' : null;` → `return referrer === account ? 'referrer-self' : null;` | RT “each other line at prepare: invalid, self (the buyer, another account of the session), no allocation — nothing simulated”; “referrer-self: the buyer, another account of the session, an account of the stored wallet not in the session — nothing read”; “the address now an account of this wallet → referrer-self; nothing signed”; “the order: invalid, self, not-applicable, no-allocation — each before the next” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  4 failed \| 48 passed (52)` |
| R9 | **(self)** the stored wallet’s accounts left out: `...(wallet?.accounts ?? []).map(a => a.publicKey)]);` → `...(wallet?.accounts ?? []).filter(() => false).map(a => a.publicKey)]);` | RT “referrer-self: the buyer, another account of the session, an account of the stored wallet not in the session — nothing read” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R10 | **(self)** the session’s accounts left out: `return new Set([...(session ?? []).map(a => a.publicKey),` → `return new Set([...(session ?? []).filter(() => false).map(a => a.publicKey),` | RT “each other line at prepare: invalid, self (the buyer, another account of the session), no allocation — nothing simulated”; “referrer-self: the buyer, another account of the session, an account of the stored wallet not in the session — nothing read”; “the address now an account of this wallet → referrer-self; nothing signed”; “the order: invalid, self, not-applicable, no-allocation — each before the next” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  4 failed \| 48 passed (52)` |
| R11 | **(sign re-checks)** `beforeSign` without the referrer’s lines: `if (referrer !== null && referrerRead !== null) { ⏎     if ('e' in referrerRead)` → `if (referrer !== null && referrerRead !== null && deps.now() < 0) { ⏎     if ('e' in referrerRead)` | RT 5 rows, among them “its allocation gone → referrer-no-allocation; nothing signed”; “its allocation now another user’s → referrer-no-allocation; nothing signed”; “its allocation read answered 403 → coordinator-refused; nothing signed” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  5 failed \| 47 passed (52)` |
| R12 | **(prepare re-checks)** prepare without the referrer’s lines: `if (referrer !== null) { ⏎     const own = await walletAccounts(ext);` → `if (referrer !== null && deps.now() < 0) { ⏎     const own = await walletAccounts(ext);` | RT 10 rows, among them “a first SOL purchase: register_referrer between the compute budget and the purchase, account 3 its allocation, the view and #10 say it registers”; “a referrer allocation read failing: 403 → coordinator-refused, unreachable → presale-unavailable; nothing simulated”; “each other line at prepare: invalid, self (the buyer, another account of the session), no allocation — nothing simulated” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  10 failed \| 42 passed (52)` |
| R13 | `referrer-no-allocation` only for a malformed allocation (an absent one accepted): `return allocationFacts(referrerAllocation, referrer)?.exists === true ? null : 'referrer-no-allocation';` → `return allocationFacts(referrerAllocation, referrer) !== null ? null : 'referrer-no-allocation';` | RT “each other line at prepare: invalid, self (the buyer, another account of the session), no allocation — nothing simulated”; “its allocation gone → referrer-no-allocation; nothing signed”; “referrer-no-allocation: its allocation absent, another user’s at user@8, not the program’s, of another length — §2.1 rule 6” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  3 failed \| 49 passed (52)` |
| R14 | **(digest)** the digest without the referrer: `return intent.referrer === undefined ? value : {...value, referrer: intent.referrer};` → `return value;` | RT “the digest binds the referral address: with one it differs from without and from another; without one it is B1d-1b’s (captured.test.ts)”; “the entry rewritten whole for another referrer (intent, digest, message, integrity) under the first one’s proof → reauth-required: the proof was for that referrer” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 50 passed (52)` |
| R15 | the retry compares only the referrer allocation, not whether it registers: `\|\| (freshReferrer.registerReferrer?.toBase58() ?? null) !== registerReferrer) throw` → `) throw` | RT “the busy-destination retry re-resolves the referrer (C39): the fresh snapshot finds a referrer registered — another, or this very one — → state-changed, no second simulation” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R16 | `referrer: null` malformed: `if (referrer === undefined \|\| referrer === null) return intent;` → `if (referrer === undefined) return intent;` | RT “absent or null is no referrer — the intent has no such key, as B1d-1b’s; a base58 string of 32–44 characters is kept; anything else is malformed” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R17 | the challenge’s description without `referrer`: `...(view.referrer === null ? {} : {referrer: view.referrer}), ⏎     }; ⏎     const fresh` → `}; ⏎     const fresh` | RT “a first SOL purchase: register_referrer between the compute budget and the purchase, account 3 its allocation, the view and #10 say it registers” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R18 | `isPurchaseAbout` accepts a registration without `first-purchase`: `if (r.registers && !(Array.isArray(a.reasons) && a.reasons.includes('first-purchase'))) return false;` → (removed) | RT “the challenge store keeps the background’s own shape only: a registration without first-purchase, or a malformed referrer, is not issued” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R19 | #10 without Q47’s note: `if (r.registers) rows.push({label: PURCHASE_TEXT.registers, value: null, address: null});` → (removed) | RT + RP “B1d-2 (Q47): a purchase that registers its referrer — "Referred by" with the whole address in groups of four after "To", then Q47’s note”; “a registration: "Referred by" with the whole address after "To", then Q47’s note; an on-chain referrer: the row without the note” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  2 failed \| 57 passed (59)` |
| R20 | #10 describes a registration without `first-purchase`: `if (r.registers && !(Array.isArray(reasons) && reasons.includes('first-purchase'))) return null;` → (removed) | RT “a referrer that does not read back describes nothing: a bad address, an extra key, registers not a boolean, a registration without the first-purchase reason” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R21 | **(ledger MUST)** `shownOf` reads back only `registers: false` (B1d-1b’s): `\|\| referrer.registers !== registers)) return null;` → `\|\| referrer.registers !== false)) return null;` | RT 12 rows, among them “a purchase meanwhile (purchase_count 1) → state-changed; nothing signed”; “another referrer registered meanwhile → state-changed; nothing signed”; “end to end: prepare → #10 proven → presale.buy → v1_pending names the referrer → confirmed → the record POSTs referrerAddress” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  12 failed \| 40 passed (52)` |
| R22 | `shownOf` does not compare the registered address with the intent’s: `if (registers && referrer?.address !== intent.referrer) return null;` → (removed) | RT “pendingData: the registered referrer; a stored view that names another, or says it registers nothing, does not read back” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R23 | `checkReferrer`: a malformed buyer allocation answered `referrer-no-allocation`: `if (facts === null) throw new PurchaseRefused('presale-unavailable', 'malformed');` → `if (facts === null) return 'referrer-no-allocation';` | RT “a failed read: 403 → coordinator-refused, unreachable → presale-unavailable; the buyer’s allocation malformed → presale-unavailable” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R24 | the signature: a failed referrer-allocation read taken as absent: `readReferrerAllocation(deps, referrer).then(a => ({a}), (e: unknown) => ({e})),` → `readReferrerAllocation(deps, referrer).then(a => ({a}), (e: unknown) => (e === e ? {a: null} : {e})),` | RT “its allocation read answered 403 → coordinator-refused; nothing signed”; “its allocation read unreachable → presale-unavailable; nothing signed” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 50 passed (52)` |
| R25 | **(on-chain wins)** `referrerAllocationOf` ignores the on-chain referrer: `return resolveReferrerWith(async () => allocationRefOf(snapshot), new PublicKey(account), captured);` → `return resolveReferrerWith(async () => ({...allocationRefOf(snapshot), referrer: null}), new PublicKey(account), captured);` | RT + CT 5 rows, among them “a purchase without a referral address: referrer@84 stays as it was — zero, or the on-chain referrer”; “every digest, every integrity, and the three purchases replayed — a first SOL purchase with its challenge, a USDC purchase, one credited to an on-chain referrer”; “no referral address: the on-chain referrer is credited, nothing registered, as B1d-1b; with one: refused, the input never ignored” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  5 failed \| 49 passed (54)` |
| R26 | **(rent)** a created PDA’s rent accepted at its bound + 1: `a.lamports > 0n && a.lamports <= bound ?` → `a.lamports > 0n && a.lamports <= bound + 1n ?` | RT “register_referrer creates the two PDAs: their rent, from the simulation, is checked as without one — above its bound → mismatch, at it → accepted” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |
| R27 | **(re-authentication)** a registration not counted as a first purchase: `firstPurchase: snapshot.limits.firstPurchase,` → `firstPurchase: snapshot.limits.firstPurchase && referrer === null,` | RT 26 rows, among them “a first SOL purchase: register_referrer between the compute budget and the purchase, account 3 its allocation, the view and #10 say it registers”; “a first USDC purchase from an allocation that never bought: the same instruction, no rent (both PDAs exist), still re-authenticated”; “a prepare without the referral address after one with it replaces the entry: one per account (§1.3), the registration gone with it” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  26 failed \| 26 passed (52)` |
| C1 | **(byte identity)** the digest always carries `referrer` (`''` when none): `return intent.referrer === undefined ? value : {...value, referrer: intent.referrer};` → `return {...value, referrer: intent.referrer ?? ''};` | CT “every digest, every integrity, and the three purchases replayed — a first SOL purchase with its challenge, a USDC purchase, one credited to an on-chain referrer” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 1 passed (2)` |
| G1 | `MARKERS` without `presale.checkReferrer`: `'presale.checkReferrer',` → (removed) | NP “armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row”; “every presale.* message type of api.ts is a marker” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 50 passed (52)` |
| G2 | `MARKERS` without `Referred by`: `'Referred by',` → (removed) | NP “armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |

30 mutations, all red, every one compiling (on the final commit; the same list ran on `6a7090b` before the signing-path row for R2 was added, every one red then too, R2 only through the unit row). **Two mutants of the first sweep did not compile** (judged INVALID, never counted): removing the registration's data check or its account check whole left `named` / `expected` unused (`noUnusedLocals`) — R2 and R3 now weaken the comparison instead. **Five more were rewritten before they ran, for the same reason:** removing R5's referrer-after check, R7's not-applicable line or R24's error branch whole would leave `referrerAfter`, `resolveReferrerWith` or the `'e' in` branch unused or `never` — each now keeps the binding and defeats the check with a condition that never holds (`b.account === ''`, `account === ''`, `e === e`); R9 / R10 filter the list empty rather than spread another type into the set.

#### Notes for the executor (Task 2)

- **Mainnet, unsigned (as B1d-1b's Task 2 did).** `preparePurchase` of this commit against mainnet through `https://api.mainnet-beta.solana.com` (a scratch vitest file in a scratch copy, never committed; no key exists in it — the session's secret is a placeholder and `fakeDeps.broadcast` throws; nothing signed, nothing sent, no `*.noc-tura.io` request; the gate and the prices were the test's). Referrer: `E8NmMZ1LhuwfUrd3wBw8pJvo5GWmKfaUycVeS2gpeqZj`, found read-only by `getProgramAccounts` (dataSize 117) — its allocation `13EN1TR839vQjqnk9hnJGWkKRUEJK9Ri4ogqwLVepkdz` read back by `allocationFacts` as a valid PresaleAllocation of it (purchase_count 0, a bonus-only allocation). Buyer: `HHHAwqwCrjv7xx4HqYPaKsQjJiQ6cqUPjmcxRJpR5k3P` (no allocation, no user account: a first purchase). **SOL 0.13** (slot 461 386 120) and **USDC 20** (slot 461 386 306): every check passed — four instructions (compute budget ×2, `RegisterReferrer` with the IDL's four accounts, then the purchase with account 3 = `13EN1…`); the program logged "Registered referrer for user" and "One-time referral bonus awarded" (10 %: 8 787 475 016 / 13 324 450 366 base units to the referrer's PDA); `referrer@84` after = the referrer; `purchase_count` 1; Δc 1 319 / 2 000 cents and Δtokens = `tokensFor(Δc, 0)` exactly; the two PDAs created inside `register_referrer` at **1 244 600 + 944 880** lamports (the measured rate, each within its bound — `newPdaRent` unchanged in total); the treasury / vault gained exactly the amount; **42 043 / 39 196 compute units** of the 120 000 limit (the registration costs 14 486). The re-authentication reasons: `first-purchase`, `over-5-percent`. Negative control on the real chain: `5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9` (a presale signer with no allocation) was refused `referrer-no-allocation` before anything was simulated.
- **Ruling: `intent.referrer` is present only when entered** (absent or `null` → the parsed intent has no such key) — why: the digest, the integrity and the bytes of a purchase without one stay B1d-1b's exactly, which `captured.test.ts` proves against a1bda47's own output (C1) — cost if wrong: none (spec §1.4's `string | null` is accepted on input).
- **Ruling: "self" is every account of this wallet — the unlocked session's and the stored wallet's (`readWalletView`)**, not only the session's (§3.5) — C32 says "not any account of this wallet"; the union is stricter (R9, R10) — cost if wrong: none.
- **Ruling: `referrer-not-applicable` is decided by `resolveReferrerWith` itself** (the function the purchase is built with), on the buyer's allocation — so what checkReferrer and prepare accept is exactly what is registered, and an on-chain referrer equal to the address itself is "not applicable" too (nothing to register) — cost if wrong: none.
- **Ruling: `checkReferrer` reads the buyer's allocation itself** (one `getAccountsData` of the buyer's and the referrer's allocations), not the last view's snapshot — fresh, no dependency on the view cache; a buyer's allocation that is not rule 6's → `presale-unavailable` (detail `malformed`); a 403 → `coordinator-refused` (§5: "anywhere"), any other failure `presale-unavailable` — cost if wrong: one request per blur.
- **Ruling: `referrer@84` after is checked for every purchase**, not only a registration (spec §3.3 step 5 names the registration): the referrer the purchase credits — registered, on-chain as it was, or zero. The program never touches it on a purchase, so an honest simulation always passes; a lying one that drops or rewrites it is a mismatch (R5, R6) — cost if wrong: none (B1d-1b's captured bytes and all its rows unchanged).
- **Ruling: a registration signs only behind a proof** — an entry whose intent names a referral address and whose `challengeId` is null is `prepared-invalid` at the signature (R4). The prepare always issues one (a registration is always a first purchase: `first-purchase` is among its reasons — R27), and the challenge store (`isPurchaseAbout`) and #10 (`describePresale`) refuse a registering description without that reason (R18, R20) — cost if wrong: none.
- **Ruling: the signature re-runs §3.5's lines on fresh reads** — the referrer's allocation (one more `getAccountsData`, in parallel with the state read and the gate) and the wallet's accounts now — beyond C22's literal list (the allocation's referrer and `purchase_count`, which stay `state-changed`): an address that became an account of this wallet → `referrer-self`, an allocation gone → `referrer-no-allocation`, a failed read → its code. A `referrer-not-applicable` cannot come from there (`signedPurchase` and the basis already answered `state-changed`) — cost if wrong: one request at a registering purchase's signature.
- **Ruling: the retry (C39) compares both the referrer allocation and whether it registers** — a fresh snapshot with this very address registered from another device keeps account 3 but would make the second registration fail on chain (AlreadyHasReferrer): `state-changed`, no second simulation (R15) — cost if wrong: none.
- **Ruling: #10 shows "Referred by" after "To" for every purchase that credits a referrer, and Q47's note as its own row** (label = the note, no value — the form #10 already uses for a settings line) — §4.2 lists "Referred by" among #20's rows that #10 repeats. Consequence, stated: a purchase credited to an **on-chain** referrer that is re-authenticated now carries `referrer: {address, registers: false}` in its stored challenge description — the only purchase without a referral address whose stored bytes differ from B1d-1b's (a B1d-1b description without the key still validates: `referrer` is optional; B1d-1b is not released, C26). The capture's on-chain flow is unchallenged, so it is byte-identical — cost if wrong: one row on #10.
- **Ruling: AlreadyHasReferrer (6016) on instruction 2 in the simulation is `simulation-failed`** (Q16) — §5's AlreadyHasReferrer row is the on-chain case after signing; at prepare a referrer registered between the snapshot and the simulation is a refusal like any other program error — cost if wrong: Q16 instead of Q43 in a rare race.
- **Deviation (stated): `presale.view`'s §2.5 `referral` is not added here** — the popup's `presaleViewOf` parses the open view with exact keys, so a background-only change would close #23 until Task 3. Task 3 adds `referral: {onChain, canRegister}` to the view and to the client's parser together.
- **Deviation (stated): Playwright ran the seven presale / vault specs, not the whole suite** (25 rows, both modes, on `6a7090b`'s builds and on the first issue `0f4669c`'s): no other spec reaches a purchase, `presale.checkReferrer` or #10's purchase description; Task 1 ran the whole suite (96, both modes) on its first issue.
- **For the next tasks:** Task 3 — the four refusal codes are not in the popup's `PrepareRefusal` list (they read `failed` until then); `presale.checkReferrer`'s answer is `{ok: true, data: {ok: true} | {ok: false, line}}`; send `intent.referrer` only when the field is non-empty (null is accepted too); #20's "Referred by" from `PurchaseView.referrer`, Q47's note when `registers`. Task 6 — the fake program must apply `register_referrer` (set `referrer@84`, create the two PDAs, refuse a second one with 6016) and hold a referrer's allocation; `honestSimulation` in `simulation.ts` is the model. Task 7 — rev 3.4's change list gains: "self" = session ∪ stored wallet; `referrer@84` checked for every purchase; the signature's re-run of §3.5's lines; a registration refused without a proof; #10's on-chain "Referred by"; `checkReferrer`'s 403 → `coordinator-refused`; AlreadyHasReferrer at prepare → Q16; `presale.view`'s `referral` landing in Task 3.
- **Found while writing:** none of B1d-1b's rows needed more than the two whose "extra key" was `referrer: null` (now accepted) — their extra key is now `extra`, and a new row refuses a referral address outside base58.
- **Dry run:** clone `dry/b1d2`, commit `14cb89b` on Task 1's `a532235`. The first issue `0f4669c` had a redundant second key-line check in prepare's step 2 (removed → `6a7090b`: suite, builds, gates and Playwright repeated); the first sweep then showed R2 red only through the unit row, so `14cb89b` adds the signing-path forgery "the registration names another referrer while account 3 stays this one's allocation" (a test only: the suite and the sweep re-run on it; the builds are `6a7090b`'s). The capture reproduced byte for byte from a second fresh copy of a1bda47.

---

### Task 3: #23a's referral address and #20's "Referred by" — `presale.view` gains §2.5's `referral = {onChain, canRegister}` (background and the popup's exact-key parser together — the ledger's MUST from Task 2); the field (Q45, D8, undrawn: B1b's single-line input) shown only while `canRegister`; its line (Q46 a–c, Q48) only from `presale.checkReferrer`'s answer on blur — the newest check, for the text as it still is — Buy disabled while a check is out and while a line shows; an empty field (spaces alone too) is no referrer and Buy sends B1d-1b's intent exactly; what the field holds travels in `intent.referrer` and a prepare refusal of it is its line, never a drop (Q48 → the view read again → the field and its text gone, Q48 said); #20's "Referred by" after To — the whole address in groups of four, Q47's note only when this purchase registers it; an on-chain referrer → no field, #20 shows it without the note; #20's re-prepare and #23 again carry the registering address; the signature's two referrer refusals kept (C29)

**Spec:** B1d §1.4 (`presale.checkReferrer`; `presale.prepareBuy`'s `intent.referrer`), §2.5 (`referral = {onChain: address | null, canRegister: boolean}` — "canRegister = firstPurchase and no onChain"), §3.3 (the refusals #20 keeps and the next Buy re-prepares: `referrer-not-applicable`; C29), §3.5 (all: "Shown on 23a only while `view.referral.canRegister`", "Validated by the background only (C3): on blur the popup asks `presale.checkReferrer` … The line (Q46 a–c, Q48) shows under the field and Buy is disabled while it shows. An empty field is no referrer.", "refuses — never drops", "#20 and #10 show 'Referred by' with the whole address in groups of four and Q47's note when this purchase registers it"), §4.1 (23a's **Referral address** bullet: "between the receive card and the allocation row" (§9), "B1b's single-line input style (`.input`, the value in `.noc-mono`), label and placeholder Q45, the line under it (Q46, Q48) in the error style; `autocapitalize`, `autocorrect` and `spellcheck` off; paste allowed; no QR"), §4.2 (#20: "**Referred by** (B1d-2, Q47) when the purchase passes a referrer"), §5 (the `referrer-*` rows: Q46 a/b/c with Buy disabled; `referrer-not-applicable` → "Q48; the view re-read (the field disappears)"), §6.1 "Screens … in B1d-2 the referral field with each line", §6.4 (the referral field with a line, #20 with "Referred by"), §9 ("23a — no referral field drawn | added (D8, an undrawn element)"), §10 Q45, Q46 a–c, Q47, Q48; C3, C7, C29, C32; D8. Brief item 3 and "Carried from B1d-1b" (`MARKERS` — every new on-build §10 string; both builds; Playwright at a task that changes a screen, normal and under `unshare -rn`; 412 × 600). The design `/home/user/Downloads/index.html` #23 (ix 10603-10902: 23a draws no referral field — the field is §9's added element, placed and styled by §4.1) and #20 (the `.detail-grid` / `.detail-row` rows the new row joins). Ledger MUST for Task 3: `presale.view` carries §2.5's `referral` — added here to the background and to the popup's exact-key parser together. Previous parts: Task 1, Task 2 (its Interfaces: `presale.checkReferrer`, `intent.referrer`, `PurchaseView.referrer`, the four `ReferrerLine` codes, `coordinator-refused`).

**Files:**
- Modify: `extension/src/background/presale/api.ts` (`ReferralView`; the open view's `referral`; `presale.checkReferrer` takes any string as the referrer — one that is not 32–44 base58 characters is `referrer-invalid` with nothing read, after the session check)
- Modify: `extension/src/app/presale/client.ts` (`PresaleView`'s `referral`, parsed with exact keys and `canRegister === (firstPurchase && onChain === null)`; `REFERRER_LINES` / `ReferrerLine`; `PREPARE_REFUSALS` + the four lines; `BUY_REFUSALS` + `referrer-self`, `referrer-no-allocation`; `PurchaseIntent` with `referrer?`; `prepareBuy` sending `referrer` only when given; `checkReferrer` / `CheckRefusal` / `referrerCheckOf`), `extension/src/app/presale/text.ts` (`REFERRAL_TEXT` Q45, `REFERRER_LINE_TEXT` Q46 a–c + Q48, `CONFIRM_PURCHASE_TEXT.referredBy` / `.registers` Q47), `extension/src/app/presale/routes.tsx` (`PresaleAgain.referrer?`), `extension/src/app/presale/Presale.tsx` (the field, its check on blur, its line, Buy's two new holds, the intent's `referrer`, prepare's four refusals, the Q48 clearing), `extension/src/app/presale/PresaleConfirm.tsx` ("Referred by" + Q47's note; `registering(v)` carried by the re-prepare and by #23 again; `referrer-self` / `referrer-no-allocation` kept), `extension/src/app/app.css` (`.app-pre-referral`, its label, input and line; `.app-pre-note`)
- Modify (the gate's staged list): `extension/scripts/check-no-presale.mjs` (`MARKERS` 79 → 84: Q45's label and placeholder, Q46 b, Q46 c, Q48)
- Create (tests): `extension/src/app/presale/__tests__/referral.test.tsx`
- Modify (tests): `extension/src/app/presale/__tests__/client.test.ts`, `extension/src/background/presale/__tests__/api.test.ts`, `extension/src/background/presale/__tests__/referrer.test.ts` (Task 2's two "→ malformed" rows for a non-base58 string become `referrer-invalid` lines), `extension/scripts/__tests__/check-no-presale.test.mjs`

**Interfaces:**
- Consumes: Task 2's `presale.checkReferrer {account, referrer}` → `{ok: true, data: {ok: true} | {ok: false, line: ReferrerLine}}` or `{ok: false, error: 'presale-unavailable' | 'coordinator-refused', data?: {detail}}`; `presale.prepareBuy`'s `intent.referrer` (present only when entered) and its four `ReferrerLine` refusals; `PurchaseView.referrer: {address, registers} | null` (and `simulation.instructionCount` 4 for a registration); `presale.buy`'s sign-time `referrer-self` / `referrer-no-allocation` (C29: the entry and the proof kept). B1d-1b's `presaleClient` / `presaleViewOf` / `purchaseViewOf` / `PREPARE_REFUSALS` / `BUY_REFUSALS` (`client.ts`), `Presale` / `PresaleConfirm` / `PresaleAgain` / `PRESALE_ROUTE` (`Presale.tsx`, `PresaleConfirm.tsx`, `routes.tsx`), `PRESALE_TEXT` / `CONFIRM_PURCHASE_TEXT` (`text.ts`), `AddressGroups` (`web/src/ui/AddressGroups`), `LockedButton`, `ExtIcon`, `Banner`; `PresaleSnapshot.allocation.referrer` and `.limits.firstPurchase` (`state.ts`). Tests: `world.ts`'s `purchaseWorld` / `BOUGHT_BEFORE`, `harness.tsx`'s `renderInWallet` / `setupWallet` / `drainInFlight` / the `gate` option, `chain.ts`'s byte builders, `styled.ts`'s `unstyledClasses`.
- Produces (`extension/src/background/presale/api.ts`):
  ```ts
  export interface ReferralView {onChain: string | null; canRegister: boolean}   // canRegister = snapshot.limits.firstPurchase && snapshot.allocation.referrer === null
  // PresaleView's open variant: {…B1d-1b's, countryCode, referral: ReferralView, pending}
  ```
  `presale.checkReferrer {account, referrer}`: `malformed` only for an extra key, a non-address account or a referrer that is not a string; then `locked` / `unknown-account`; then a string that is not `^[1-9A-HJ-NP-Za-km-z]{32,44}$` → `{ok: true, data: {ok: false, line: 'referrer-invalid'}}`, nothing read (no length limit is needed: the regex is linear and nothing is decoded); else Task 2's `checkReferrer`.
- Produces (`extension/src/app/presale/client.ts`):
  ```ts
  export const REFERRER_LINES = ['referrer-invalid', 'referrer-self', 'referrer-not-applicable', 'referrer-no-allocation'] as const;
  export type ReferrerLine = (typeof REFERRER_LINES)[number];
  export type CheckRefusal = 'malformed' | 'locked' | 'unknown-account' | 'unavailable' | 'presale-unavailable' | 'coordinator-refused';
  export interface PurchaseIntent {currency: PresaleCurrency; amount: bigint; stage: number; referrer?: string}
  export function referrerCheckOf(x: unknown): ReferrerLine | null | undefined;   // {ok: true} → null; {ok: false, line} → line; else undefined
  // PresaleView open: referral: {onChain: string | null; canRegister: boolean}
  // PresaleClient: prepareBuy(account, intent: PurchaseIntent, challengeId?); checkReferrer(account, referrer): Promise<Reply<ReferrerLine | null, CheckRefusal>>
  // PREPARE_REFUSALS: B1d-1b's + the four lines; BUY_REFUSALS: B1d-1b's + 'referrer-self', 'referrer-no-allocation'
  ```
- Produces (`extension/src/app/presale/routes.tsx`): `PresaleAgain` gains `referrer?: string` — present only when the purchase registered it (a base58 address of 32–44 characters; any other value → not a `presale` route).
- Produces (`extension/src/app/presale/text.ts`): `REFERRAL_TEXT = {label, placeholder}` (Q45), `REFERRER_LINE_TEXT: Record<ReferrerLine, string>` (Q46 a–c, Q48), `CONFIRM_PURCHASE_TEXT.referredBy` / `.registers` (Q47).
- DOM (for Task 6's E2E 12 and Task 7's shots): the field is `#presale-referrer` (`input.app-input.noc-mono`, `.is-error` while a line shows), labelled Q45, inside `.app-pre-referral` right after `.input-card`; its line `.app-pre-referral .helper.error[role=alert]`; #20's row is the `.detail-row` labelled "Referred by" after To, the address in `.addr-groups`, Q47's note `.app-pre-note`.
  **What later tasks rely on:** Task 6 — E2E 12 drives `#presale-referrer` (fill, blur) and reads the line and #20's row; the fake program must apply `register_referrer` (set `referrer@84`, keep it through later purchases) — the dry run's scratch visual check patched exactly that into a scratch copy (two hunks in `purchaseIn` / `purchaseAccounts`, never committed). Task 7 — the shots "the referral field with a line" and "#20 with 'Referred by'" (§6.4) and rev 3.4's lines below.

**How the referral address moves through the popup (§3.5, C3).** The popup judges nothing: the field's line is only ever the background's answer. **Shown:** while the open view's `referral.canRegister` (a first purchase — no allocation, or one with `purchase_count` 0 — and no referrer on chain); an on-chain referrer, or a purchase made, hides it. **On blur:** an empty field (after trimming; spaces alone are empty) asks nothing — no referrer; otherwise one `presale.checkReferrer {account, referrer}` with the trimmed text, whatever it is — a non-address is the background's `referrer-invalid` (Task 2's handler called such a string `malformed`; it now answers the line, nothing read). While the check is out Buy waits; its answer is applied only if no edit and no newer check came since (a generation counter bumped by both) — a stale answer never shows. The answer: no line (null), or the line (Q46a/b/c, Q48) under the field in #23's error style, the input bordered `--danger`, Buy disabled while it shows; `referrer-not-applicable` also reads the view again. A failed check (`presale-unavailable`, `coordinator-refused`) shows its notice (Q11 / Q12) and no line: prepare checks again anyway. **An edit** clears the line and drops any answer still out. **Buy** sends `intent.referrer` = the trimmed text when it is not empty — nothing else decides whether it travels — and B1d-1b's intent exactly (no `referrer` key) when it is. A prepare refusal `referrer-*` is the field's line (never a notice, never a drop); `referrer-not-applicable` reads the view again. **Q48 (§5: "the view re-read (the field disappears)")**: whenever the open view says `canRegister: false` while the field holds text — after that re-read, or the 25 s re-read finding a purchase or a referrer landed — the text is cleared and Q48 is said as #23's notice: the input is never ignored in silence. **#20:** "Referred by" after To for every purchase that credits a referrer (`PurchaseView.referrer`): the whole address in groups of four (`AddressGroups`, equal weight) and, only when `registers`, Q47's note under it. A purchase without one has B1d-1b's rows exactly. The quote's re-prepare and #23 again (back, Esc, a refusal that keeps the purchase) carry the address the purchase registers (`registering(v)`), never an on-chain referrer (it is no input: sending it would be refused `referrer-not-applicable`). The signature's `referrer-self` / `referrer-no-allocation` keep the purchase (C29) and open #23 with the address and the code → the line under the field.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/presale/__tests__/referral.test.tsx` (#23a's field and #20's row against the REAL background — `purchaseWorld`'s chain with the referral address's allocation added, the harness's `gate` recording every message and holding `presale.checkReferrer` when a test asks it to):

```tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {PublicKey} from '@solana/web3.js';
import {drainInFlight, renderInWallet, setupWallet, type Wallet} from '../../__tests__/harness';
import {WalletProvider} from '../../WalletContext';
import {Presale} from '../Presale';
import {PresaleConfirm} from '../PresaleConfirm';
import {PRESALE_ROUTE} from '../routes';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../../__tests__/styled';
import {registerPresale} from '../../../background/presale/api';
import {registerPresaleHandler} from '../../../background/messages';
import {satisfyChallenge} from '../../../background/reauthChallenges';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {RECIPIENT} from '../../../background/__tests__/fixtures';
import {ACCOUNT, allocationData, program, userData, type Chain} from '../../../background/presale/__tests__/chain';
import {derivePresalePdas} from '../../../../../core/presale/allocation';
import type {AccountData} from '../../../../../core/solana/rpc';
import {purchaseViewOf, type PurchaseView} from '../client';
import {BOUGHT_BEFORE, purchaseWorld, type PurchaseWorld} from './world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 3 (§3.5, §4.1, §4.2, C3, C32, D8; Q45–Q48): #23a's referral address and #20's "Referred by", against the
// REAL background — presale.view's referral, presale.checkReferrer on blur, presale.prepareBuy's intent.referrer, the
// purchase that registers it. The popup judges nothing: every line is what the background answered.
const SELECTORS = selectorsOf(UI_SHEETS);
/** The referral address (32 × 0x09): a presale buyer when the test gives it an allocation. */
const R = 'cGfHiC6Kgg3FpFZvgwGcswsCRtp4aBP2fzuXRQPizuN';
/** Another referrer (32 × 0x0a), registered on chain. */
const ON_CHAIN = 'gBxS1f6uyyGPuW5MzGBukidSb71jdsCb5fZaoSzULE5';
const allocationOf = (k: string): string => derivePresalePdas(new PublicKey(k)).userAllocation.toBase58();
const ALLOCATED: AccountData = program(allocationData({user: R, count: 1}));
/** An allocation that never bought (purchase_count 0): still a first purchase (C21). */
const neverBought = (o: Parameters<typeof allocationData>[0] = {}): Partial<Chain> => ({user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, ...o}))});
const Q45 = 'Referral address (optional)';
const Q46A = 'Not a valid Solana address';
const Q46B = "You can't refer yourself or another account in this wallet";
const Q46C = "This address has no presale allocation, so it can't receive a referral bonus";
const Q47 = "Saved to your presale account with this purchase. It can't be changed later.";
const Q48 = 'This account can no longer take a referrer — review again';

const nav = {onBack: vi.fn(), onDone: vi.fn(), onPrepared: vi.fn(), onRegion: vi.fn(), onGeo: vi.fn()};
const confirmNav = {onPresale: vi.fn(), onTrack: vi.fn(), onHome: vi.fn()};
const groups = (a: string) => (a.match(/.{1,4}/g) ?? []).join('');
const rows = () => [...document.querySelectorAll('.detail-grid .detail-row')].map(r => [...r.children].map(c => c.textContent));
const sent = (asked: unknown[], type: string) => asked.filter(m => (m as {type: string}).type === type);
const buyButton = () => document.querySelector<HTMLButtonElement>('.sticky-bar .btn-primary');
const field = (): HTMLInputElement | null => document.querySelector<HTMLInputElement>('#presale-referrer');
const theField = (): HTMLInputElement => {
  const f = field();
  if (f === null) throw new Error('no referral address field');
  return f;
};
const line = (): string | null => document.querySelector('.app-pre-referral .helper')?.textContent?.trim() ?? null;
const enter = (value: string) => fireEvent.change(theField(), {target: {value}});
const leave = () => fireEvent.blur(theField());
const amount = (value: string) => fireEvent.change(screen.getByLabelText('YOU PAY'), {target: {value}});
/** Every answer the background owes has landed and been rendered: the gate's release, the background's work, the screen's continuation. */
const landed = () =>
  act(async () => {
    await new Promise<void>(r => setTimeout(r, 0));
    await drainInFlight();
    await new Promise<void>(r => setTimeout(r, 0));
  });
/** The rule-6 lock is 500 ms. */
const settle = () => act(() => new Promise<void>(r => setTimeout(r, 600)));

/** The world, the referral address's allocation in its chain, and a gate that records every message and holds the ones `hold` names. */
function world(o: {chain?: Partial<Chain>; referrer?: AccountData | null} = {}) {
  const asked: unknown[] = [];
  const held: (() => void)[] = [];
  const hold = {type: null as string | null};
  const w = purchaseWorld({
    ...(o.chain === undefined ? {} : {chain: o.chain}),
    gate: m => {
      asked.push(m);
      if ((m as {type: string}).type === hold.type) return new Promise<void>(r => void held.push(r));
    },
  });
  w.chain.set(allocationOf(R), o.referrer === undefined ? ALLOCATED : o.referrer);
  w.chain.set(allocationOf(ON_CHAIN), program(allocationData({user: ON_CHAIN})));
  return {w, asked, held, hold};
}
async function show23(x: ReturnType<typeof world>) {
  await renderInWallet(<Presale {...nav} />, x.w.options);
  await screen.findByText('Stage 1 of 10 · live');
}
/** 2 SOL quoted: Buy is enabled exactly when nothing else holds it. */
async function quoted() {
  amount('2');
  await screen.findByText('Buy 2,643.83 NOC');
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('#23a: the referral address is offered only while it can take effect (§3.5, §4.1, D8)', () => {
  it('a first purchase with no referrer on chain: Q45’s label and placeholder, B1b’s single-line input between the receive card and the region link, no capitalising, correcting or spell-checking; no line; every class styled', async () => {
    await show23(world());
    const f = screen.getByLabelText(Q45) as HTMLInputElement;
    expect(f).toBe(field());
    expect(f.placeholder).toBe('Solana address of the person who invited you');
    expect(f.className).toBe('app-input noc-mono');
    expect([f.getAttribute('autocapitalize'), f.getAttribute('autocorrect'), f.getAttribute('spellcheck'), f.getAttribute('autocomplete')]).toEqual(['off', 'off', 'false', 'off']);
    expect(f.value).toBe('');
    const block = f.closest('.app-pre-referral');
    expect(block?.previousElementSibling?.className).toBe('input-card');
    expect(block?.nextElementSibling?.className).toBe('geo-link noc-body-sm');
    expect(line()).toBeNull();
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('an allocation that never bought and holds a bonus: still offered — above the allocation row (the order of §4.1)', async () => {
    await show23(world({chain: neverBought({totalTokens: 8_787_475_016n, bonus: 8_787_475_016n})}));
    expect(field()?.closest('.app-pre-referral')?.nextElementSibling?.className).toBe('receipt');
    expect(screen.getByText('Your allocation')).toBeTruthy();
  });

  it('not offered: an account that bought before; an allocation with a referrer on chain, bought or not (an on-chain referrer always wins)', async () => {
    for (const chain of [BOUGHT_BEFORE, neverBought({referrer: ON_CHAIN}), {...BOUGHT_BEFORE, allocation: program(allocationData({referrer: ON_CHAIN}))}]) {
      await show23(world({chain}));
      expect(field()).toBeNull();
      expect(screen.queryByText(Q45)).toBeNull();
      cleanup();
    }
  });
});

describe('#23a: the line is the background’s answer on blur (§3.5, C3, Q46 a–c, Q48)', () => {
  it('typing asks nothing; blur asks presale.checkReferrer once with what the field holds; until it answers no line shows and Buy waits; then the background’s line, Buy disabled', async () => {
    const x = world();
    await show23(x);
    await quoted();
    x.hold.type = 'presale.checkReferrer';
    enter('not-an-address');
    expect(sent(x.asked, 'presale.checkReferrer')).toEqual([]);
    expect(buyButton()?.disabled).toBe(false);
    leave();
    expect(sent(x.asked, 'presale.checkReferrer')).toEqual([{type: 'presale.checkReferrer', account: ACCOUNT, referrer: 'not-an-address'}]);
    // Held: the popup has judged nothing — no line, and Buy waits for the answer.
    await landed();
    expect(line()).toBeNull();
    expect(buyButton()?.disabled).toBe(true);
    x.held.forEach(r => r());
    expect(await screen.findByText(Q46A)).toBeTruthy();
    expect(line()).toBe(Q46A);
    expect(theField().className).toBe('app-input noc-mono is-error');
    expect(buyButton()?.disabled).toBe(true);
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('each line from the background: Q46a, Q46b for this account and for another account of this wallet (only the background knows it), Q46c for an address with no allocation — Buy disabled while each shows', async () => {
    for (const [typed, referrer, want] of [
      ['x'.repeat(44), ALLOCATED, Q46A],
      [ACCOUNT, ALLOCATED, Q46B],
      [RECIPIENT, ALLOCATED, Q46B],
      [R, null, Q46C],
    ] as const) {
      const x = world({referrer});
      await show23(x);
      await quoted();
      enter(typed);
      leave();
      await screen.findByText(want);
      expect([typed, line(), buyButton()?.disabled]).toEqual([typed, want, true]);
      cleanup();
    }
  });

  it('an address the purchase would register: no line, Buy enabled (positive control); a blur on an empty field asks nothing', async () => {
    const x = world();
    await show23(x);
    await quoted();
    leave();
    expect(sent(x.asked, 'presale.checkReferrer')).toEqual([]);
    enter(R);
    leave();
    await waitFor(() => expect(sent(x.asked, 'presale.checkReferrer')).toHaveLength(1));
    await landed();
    expect(line()).toBeNull();
    expect(buyButton()?.disabled).toBe(false);
  });

  it('Q48 from the check — a purchase landed on chain since the view: the line, the view read again, then the field gone and Q48 said (never dropped in silence)', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter(R);
    x.w.chain.set(allocationOf(ACCOUNT), program(allocationData({count: 1})));
    x.w.chain.set(derivePresalePdas(new PublicKey(ACCOUNT)).userAccount.toBase58(), program(userData()));
    const views = sent(x.asked, 'presale.view').length;
    leave();
    await waitFor(() => expect(field()).toBeNull());
    expect(sent(x.asked, 'presale.view').length).toBe(views + 1);
    expect(document.querySelector('.banner .banner-title')?.textContent).toBe(Q48);
  });

  it('an edit clears the line; Buy is back with it', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter('abc');
    leave();
    expect(await screen.findByText(Q46A)).toBeTruthy();
    expect(buyButton()?.disabled).toBe(true);
    enter('abcd');
    expect(line()).toBeNull();
    expect(buyButton()?.disabled).toBe(false);
  });

  it('a stale answer never shows: an older check answering after a newer one, and an answer landing after an edit', async () => {
    const x = world();
    await show23(x);
    await quoted();
    x.hold.type = 'presale.checkReferrer';
    enter('abc');
    leave();
    enter(ACCOUNT);
    leave();
    await landed();
    expect(x.held).toHaveLength(2);
    const [older, newer] = x.held;
    newer?.();
    expect(await screen.findByText(Q46B)).toBeTruthy();
    older?.();
    await landed();
    expect(line()).toBe(Q46B);
    expect(screen.queryByText(Q46A)).toBeNull();
    // An answer for text the user has since edited (no blur after the edit): dropped.
    enter('abc');
    leave();
    enter('abcd');
    await landed();
    x.held.at(-1)?.();
    await landed();
    expect(line()).toBeNull();
    expect(buyButton()?.disabled).toBe(false);
  });
});

describe('#23a: what Buy sends (§3.5: refused, never dropped)', () => {
  it('an empty field is no referrer: B1d-1b’s intent exactly (no referrer key), the purchase registers nothing; spaces alone are empty too', async () => {
    for (const typed of ['', '   ']) {
      vi.clearAllMocks();
      const x = world();
      await show23(x);
      await quoted();
      if (typed !== '') {
        enter(typed);
        leave();
      }
      fireEvent.click(buyButton() as HTMLButtonElement);
      await settle();
      expect([typed, sent(x.asked, 'presale.checkReferrer')]).toEqual([typed, []]);
      expect([typed, sent(x.asked, 'presale.prepareBuy')]).toEqual([typed, [{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0}}]]);
      const [, view] = nav.onPrepared.mock.calls[0] as [string, PurchaseView];
      expect([typed, view.referrer, view.simulation.instructionCount]).toEqual([typed, null, 3]);
      cleanup();
    }
  });

  it('the field’s value travels in the intent: presale.prepareBuy carries it, and the purchase the background prepared registers it', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter(R);
    leave();
    await landed();
    fireEvent.click(buyButton() as HTMLButtonElement);
    await settle();
    expect(sent(x.asked, 'presale.prepareBuy')).toEqual([{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, referrer: R}}]);
    expect(nav.onPrepared).toHaveBeenCalledTimes(1);
    const [, view] = nav.onPrepared.mock.calls[0] as [string, PurchaseView];
    expect([view.referrer, view.simulation.instructionCount, view.reauth?.reasons.includes('first-purchase')]).toEqual([{address: R, registers: true}, 4, true]);
  });

  it('refused at prepare, never dropped — the purchase can no longer take it (bought since the check): nothing prepared, Q48, the view read again, the field gone', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter(R);
    leave();
    await landed();
    x.w.chain.set(allocationOf(ACCOUNT), program(allocationData({count: 1})));
    x.w.chain.set(derivePresalePdas(new PublicKey(ACCOUNT)).userAccount.toBase58(), program(userData()));
    const views = sent(x.asked, 'presale.view').length;
    fireEvent.click(buyButton() as HTMLButtonElement);
    await waitFor(() => expect(field()).toBeNull());
    expect(sent(x.asked, 'presale.prepareBuy')).toEqual([{type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, referrer: R}}]);
    expect(nav.onPrepared).not.toHaveBeenCalled();
    expect(sent(x.asked, 'presale.view').length).toBe(views + 1);
    expect(document.querySelector('.banner .banner-title')?.textContent).toBe(Q48);
  });

  it('refused at prepare — its allocation gone since the check: Q46c under the field, nothing prepared, Buy disabled until edited', async () => {
    const x = world();
    await show23(x);
    await quoted();
    enter(R);
    leave();
    await landed();
    x.w.chain.set(allocationOf(R), null);
    fireEvent.click(buyButton() as HTMLButtonElement);
    expect(await screen.findByText(Q46C)).toBeTruthy();
    expect(nav.onPrepared).not.toHaveBeenCalled();
    expect([line(), buyButton()?.disabled, field()?.value]).toEqual([Q46C, true, R]);
  });

  it('a check that fails (the presale unreadable) says so, shows no line and holds nothing: prepare decides again', async () => {
    const x = world();
    await show23(x);
    await quoted();
    x.w.chain.delete(allocationOf(R));
    enter(R);
    leave();
    expect(await screen.findByText('Presale unavailable — try again later.')).toBeTruthy();
    expect([line(), buyButton()?.disabled]).toEqual([null, false]);
  });
});

/** A purchase prepared through the real background, with the referral address when given — as #23's Buy asks it. */
async function prepared(wallet: Wallet, referrer?: string): Promise<PurchaseView> {
  const r = (await wallet.transport({type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, ...(referrer === undefined ? {} : {referrer})}})) as {ok: boolean; data?: unknown; error?: string};
  const view = r.ok ? purchaseViewOf(r.data) : undefined;
  if (view === undefined) throw new Error(`prepare refused: ${r.error ?? 'malformed'}`);
  return view;
}
async function show20(w: PurchaseWorld, referrer?: string, o: {prove?: boolean} = {}) {
  const wallet = await setupWallet(w.options);
  const view = await prepared(wallet, referrer);
  if (o.prove === true && view.reauth !== null) expect(await satisfyChallenge(wallet.ext, w.now(), view.reauth.challengeId)).toBe(true);
  render(
    <WalletProvider engine={wallet.engine} platform={wallet.platform} surface="popup" now={w.now}>
      <PresaleConfirm account={ACCOUNT} preparedId={view.id} {...confirmNav} />
    </WalletProvider>,
  );
  await screen.findByRole('button', {name: 'Buy NOC'});
  return {wallet, view};
}
const B1D1B_ROWS = ['You receive (est.)', 'Stage', 'Price', 'From', 'To', 'Network'];

describe('#20: “Referred by” (§4.2, Q47)', () => {
  it('a purchase that registers its referrer: “Referred by” after To, the whole address in groups of four, then Q47’s note; every class styled', async () => {
    const {w} = world();
    await show20(w, R);
    expect(rows().map(r => r[0])).toEqual(['You receive (est.)', 'Stage', 'Price', 'From', 'To', 'Referred by', 'Network']);
    expect(rows()[5]).toEqual(['Referred by', `${groups(R)}${Q47}`]);
    const spans = [...document.querySelectorAll('.detail-row:nth-child(6) .addr-groups > span')].map(s => s.textContent ?? '');
    expect(spans.join('')).toBe(R);
    expect(spans.slice(0, -1).every(s => s.length === 4)).toBe(true);
    expect(document.querySelector('.detail-row:nth-child(6) .app-pre-note')?.textContent).toBe(Q47);
    expect(unstyledClasses(document.body, SELECTORS)).toEqual([]);
  });

  it('a referrer on chain: no field on #23, and #20 shows that referrer without the note — nothing is registered', async () => {
    const chain = {...BOUGHT_BEFORE, allocation: program(allocationData({referrer: ON_CHAIN}))};
    const x = world({chain});
    await show23(x);
    expect(field()).toBeNull();
    cleanup();
    const {view} = await show20(world({chain}).w);
    expect(view.referrer).toEqual({address: ON_CHAIN, registers: false});
    expect(rows()[5]).toEqual(['Referred by', groups(ON_CHAIN)]);
    expect(document.querySelector('.app-pre-note')).toBeNull();
    expect(screen.queryByText(Q47)).toBeNull();
  });

  it('a purchase without a referrer looks exactly as in B1d-1b: no “Referred by”, no note', async () => {
    await show20(world().w);
    expect(rows().map(r => r[0])).toEqual(B1D1B_ROWS);
    expect(screen.queryByText('Referred by')).toBeNull();
    expect(screen.queryByText(Q47)).toBeNull();
  });
});

describe('#20 ↔ #23 keep the referral address (never dropped)', () => {
  it('the quote’s end: the re-prepare carries the referral address and the challenge — the fresh purchase registers it too', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const x = world();
    const {view} = await show20(x.w, R);
    const before = sent(x.asked, 'presale.prepareBuy').length;
    await act(async () => void vi.advanceTimersByTime(31_000));
    expect(await screen.findByText('Updated with a fresh network quote')).toBeTruthy();
    expect(sent(x.asked, 'presale.prepareBuy').slice(before)).toEqual([
      {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, referrer: R}, challengeId: view.reauth?.challengeId},
    ]);
    expect(rows()[5]).toEqual(['Referred by', `${groups(R)}${Q47}`]);
  });

  it('back → #23 with the address it registers; an on-chain referrer is not carried (it is no input)', async () => {
    const {view} = await show20(world().w, R);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(confirmNav.onPresale).toHaveBeenCalledWith({currency: 'SOL', amount: '2000000000', code: null, challengeId: view.reauth?.challengeId, referrer: R});
    cleanup();
    vi.clearAllMocks();
    const chain = {...BOUGHT_BEFORE, allocation: program(allocationData({referrer: ON_CHAIN}))};
    const onChain = await show20(world({chain}).w);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(confirmNav.onPresale).toHaveBeenCalledWith({currency: 'SOL', amount: '2000000000', code: null, challengeId: onChain.view.reauth?.challengeId ?? null});
  });

  it('refused at the signature — its allocation gone since the review: kept (C29), #23 with the address and the code; nothing signed', async () => {
    const x = world();
    await show20(x.w, R, {prove: true});
    x.w.chain.set(allocationOf(R), null);
    fireEvent.click(screen.getByRole('button', {name: 'Buy NOC'}));
    await waitFor(() => expect(confirmNav.onPresale).toHaveBeenCalledTimes(1));
    expect(confirmNav.onPresale.mock.calls[0]?.[0]).toMatchObject({code: 'referrer-no-allocation', referrer: R});
    expect(x.w.broadcasts).toEqual([]);
  });

  it('#23 again with the address and its refusal: the field holds it, the line under it, Buy disabled; a route naming a non-address is not #23', async () => {
    const x = world();
    const n = {pop: vi.fn(), home: vi.fn(), push: vi.fn(), replace: vi.fn(), reset: vi.fn()};
    const again = {currency: 'SOL', amount: '2000000000', code: 'referrer-no-allocation', challengeId: null, referrer: R} as const;
    expect(PRESALE_ROUTE.isRoute({screen: 'presale', again})).toBe(true);
    expect(PRESALE_ROUTE.isRoute({screen: 'presale', again: {...again, referrer: 'not-an-address'}})).toBe(false);
    expect(PRESALE_ROUTE.isRoute({screen: 'presale', again: {...again, referrer: null}})).toBe(false);
    await renderInWallet(<>{PRESALE_ROUTE.render({screen: 'presale', again}, n)}</>, x.w.options);
    expect(await screen.findByText(Q46C)).toBeTruthy();
    expect([field()?.value, line()]).toEqual([R, Q46C]);
    await screen.findByText('Buy 2,643.83 NOC');
    expect(buyButton()?.disabled).toBe(true);
    // The address edited: the line goes.
    enter(RECIPIENT);
    expect(line()).toBeNull();
  });
});
```

`extension/src/app/presale/__tests__/client.test.ts` (the view's `referral` in the positive row; a new describe for the referral address's client — the view's pairing rule, `checkReferrer` against the real background, `referrerCheckOf`, `prepareBuy`'s `referrer` only when given):

```diff
diff --git a/extension/src/app/presale/__tests__/client.test.ts b/extension/src/app/presale/__tests__/client.test.ts
index cdd374f..3756bca 100644
--- a/extension/src/app/presale/__tests__/client.test.ts
+++ b/extension/src/app/presale/__tests__/client.test.ts
@@ -1,5 +1,5 @@
 import {createEngine, type Transport} from '../../engine';
-import {PREPARE_REFUSALS, bannerOf, presaleClient, presaleViewOf, purchaseDataOf, purchaseViewOf, quoteOf, resumableOf} from '../client';
+import {BUY_REFUSALS, PREPARE_REFUSALS, REFERRER_LINES, bannerOf, presaleClient, presaleViewOf, purchaseDataOf, purchaseViewOf, quoteOf, referrerCheckOf, resumableOf} from '../client';
 import {registerPresale} from '../../../background/presale/api';
 import {handleMessage, registerPresaleHandler} from '../../../background/messages';
 import {PENDING_KEY} from '../../../background/pendingStore';
@@ -10,16 +10,24 @@ import {HOLDING_LARGE, pendingRecord, signedWire, unlocked} from '../../../backg
 import {viewOf} from '../../../background/pendingStore';
 import {firstSignature} from '../../../../../core/solana/broadcast';
 import {base64} from '@scure/base';
-import {ACCOUNT, NOW_MS, TREASURY_ADDRESS, chainMap, chainReader, configData, program, type Chain} from '../../../background/presale/__tests__/chain';
+import {ACCOUNT, NOW_MS, OTHER, TREASURY_ADDRESS, allocationData, chainMap, chainReader, configData, program, userData, type Chain} from '../../../background/presale/__tests__/chain';
 import {MAINNET_USDC_MINT} from '../../../../../core/presale/addresses';
+import {derivePresalePdas} from '../../../../../core/presale/allocation';
+import {PublicKey} from '@solana/web3.js';
+import type {AccountData} from '../../../../../core/solana/rpc';
 
 registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});
 
 // B1d §1.4, §2.5, §3.2, §3.3 (C3): the popup's presale client — its shape checks on the REAL background's answers
 // (positive controls), and every way a reply can be of another shape (failed, never shown).
 const OPEN: GeoAnswer = {open: true, reason: null, countryCode: 'SI'};
-function depsFor(o: {chain?: Partial<Chain>; geo?: GeoAnswer}) {
-  const reader = chainReader(chainMap(o.chain), [], {
+/** B1d-2 Task 3: a referral address (32 × 0x09) — a presale buyer where a test gives it an allocation. */
+const REF = 'cGfHiC6Kgg3FpFZvgwGcswsCRtp4aBP2fzuXRQPizuN';
+const allocationOf = (k: string): string => derivePresalePdas(new PublicKey(k)).userAllocation.toBase58();
+function depsFor(o: {chain?: Partial<Chain>; geo?: GeoAnswer; more?: [string, AccountData | null][]}) {
+  const map = chainMap(o.chain);
+  for (const [k, v] of o.more ?? []) map.set(k, v);
+  const reader = chainReader(map, [], {
     getBalance: async () => 5_000_000_000n,
     getTokenAccountsByOwner: async owner => [{pubkey: HOLDING_LARGE, mint: MAINNET_USDC_MINT, owner, amount: 50_000_000n, decimals: 6}],
   });
@@ -28,7 +36,7 @@ function depsFor(o: {chain?: Partial<Chain>; geo?: GeoAnswer}) {
   return deps;
 }
 const popupOf = (ext: ReturnType<typeof fakeExt>) => ({id: ext.runtimeId, origin: ext.extensionOrigin, url: `${ext.extensionOrigin}/popup.html`});
-async function wired(o: {chain?: Partial<Chain>; geo?: GeoAnswer} = {}) {
+async function wired(o: {chain?: Partial<Chain>; geo?: GeoAnswer; more?: [string, AccountData | null][]} = {}) {
   const ext = fakeExt();
   await unlocked(ext);
   const deps = depsFor(o);
@@ -63,6 +71,7 @@ describe('the client against the real background (positive controls)', () => {
         balances: {SOL: 5_000_000_000n, USDC: {largest: 50_000_000n, total: 50_000_000n}, USDT: {largest: 0n, total: 0n}},
         solUsdMicros: 198_420_000n,
         countryCode: 'SI',
+        referral: {onChain: null, canRegister: true},
         pending: null,
       },
     });
@@ -205,6 +214,85 @@ describe('the shape checks: anything else the background did not promise is fail
   });
 });
 
+// B1d-2 Task 3 (§1.4, §2.5, §3.5, C3): what #23a's referral address asks and reads — the view's referral, presale.checkReferrer
+// with whatever the field holds, prepareBuy's referrer only when there is one.
+describe('the client for #23a’s referral address (B1d-2)', () => {
+  const canned = (answer: unknown) => {
+    const sent: unknown[] = [];
+    const client = presaleClient(createEngine(async m => (sent.push(m), answer), async () => undefined));
+    return {sent, client};
+  };
+
+  it('view: the referral as the background answers it — none on chain and offered, or the one on chain and not offered (positive controls)', async () => {
+    expect(await (await wired()).client.view(ACCOUNT)).toMatchObject({ok: true, data: {referral: {onChain: null, canRegister: true}}});
+    expect(await (await wired({chain: {user: program(userData()), allocation: program(allocationData())}})).client.view(ACCOUNT)).toMatchObject({ok: true, data: {referral: {onChain: null, canRegister: false}}});
+    expect(await (await wired({chain: {user: program(userData()), allocation: program(allocationData({count: 0, referrer: OTHER}))}})).client.view(ACCOUNT)).toMatchObject({
+      ok: true,
+      data: {limits: {firstPurchase: true}, referral: {onChain: OTHER, canRegister: false}},
+    });
+  });
+
+  it('view: a referral of any other shape is failed — missing, an extra key, not an address, canRegister not a boolean, or canRegister other than “a first purchase and none on chain”', async () => {
+    const open = await raw({type: 'presale.view', account: ACCOUNT});
+    expect(presaleViewOf(open)).toBeDefined();
+    const limits = open.limits as Record<string, unknown>;
+    const bad: unknown[] = [
+      Object.fromEntries(Object.entries(open).filter(([k]) => k !== 'referral')),
+      {...open, referral: null},
+      {...open, referral: {onChain: null, canRegister: true, extra: 1}},
+      {...open, referral: {onChain: null}},
+      {...open, referral: {onChain: 'x', canRegister: false}},
+      {...open, referral: {onChain: null, canRegister: 'yes'}},
+      // A referrer on chain always wins (D8): never offered beside one.
+      {...open, referral: {onChain: OTHER, canRegister: true}},
+      // Not a first purchase: never offered; a first purchase without one: always offered.
+      {...open, limits: {...limits, firstPurchase: false}, referral: {onChain: null, canRegister: true}},
+      {...open, referral: {onChain: null, canRegister: false}},
+    ];
+    for (const b of bad) expect([b, presaleViewOf(b)]).toEqual([b, undefined]);
+    expect(presaleViewOf({...open, limits: {...limits, firstPurchase: false}, referral: {onChain: OTHER, canRegister: false}})).toMatchObject({referral: {onChain: OTHER, canRegister: false}});
+  });
+
+  it('checkReferrer against the real background: {type, account, referrer} exactly as the field holds it; null when it would register, else the line; a failed read typed', async () => {
+    const w = await wired({more: [[allocationOf(REF), program(allocationData({user: REF, count: 1}))]]});
+    expect(await w.client.checkReferrer(ACCOUNT, REF)).toEqual({ok: true, data: null});
+    expect(await w.client.checkReferrer(ACCOUNT, 'not an address')).toEqual({ok: true, data: 'referrer-invalid'});
+    expect(await w.client.checkReferrer(ACCOUNT, ACCOUNT)).toEqual({ok: true, data: 'referrer-self'});
+    expect(w.sent).toEqual([
+      {type: 'presale.checkReferrer', account: ACCOUNT, referrer: REF},
+      {type: 'presale.checkReferrer', account: ACCOUNT, referrer: 'not an address'},
+      {type: 'presale.checkReferrer', account: ACCOUNT, referrer: ACCOUNT},
+    ]);
+    const none = await wired({more: [[allocationOf(REF), null]]});
+    expect(await none.client.checkReferrer(ACCOUNT, REF)).toEqual({ok: true, data: 'referrer-no-allocation'});
+    const bought = await wired({chain: {user: program(userData()), allocation: program(allocationData())}, more: [[allocationOf(REF), program(allocationData({user: REF}))]]});
+    expect(await bought.client.checkReferrer(ACCOUNT, REF)).toEqual({ok: true, data: 'referrer-not-applicable'});
+    expect(await canned({ok: false, error: 'coordinator-refused'}).client.checkReferrer(ACCOUNT, REF)).toEqual({ok: false, error: 'coordinator-refused'});
+    expect(await canned({ok: false, error: 'presale-unavailable', data: {detail: 'x'}}).client.checkReferrer(ACCOUNT, REF)).toMatchObject({ok: false, error: 'presale-unavailable'});
+  });
+
+  it('referrerCheckOf: {ok: true} → null, {ok: false, line} → the line; anything else failed', () => {
+    expect(referrerCheckOf({ok: true})).toBeNull();
+    for (const line of REFERRER_LINES) expect(referrerCheckOf({ok: false, line})).toBe(line);
+    for (const b of [{ok: true, line: 'referrer-self'}, {ok: false}, {ok: false, line: 'referrer-elsewhere'}, {ok: 'true'}, {}, null, 'referrer-self', {ok: false, line: 'referrer-self', extra: 1}]) {
+      expect([b, referrerCheckOf(b)]).toEqual([b, undefined]);
+    }
+  });
+
+  it('prepareBuy carries the referral address only when there is one — without one, B1d-1b’s intent exactly; prepare’s four referrer codes and the signature’s two are typed refusals', async () => {
+    const c = canned({ok: false, error: 'referrer-not-applicable'});
+    expect(await c.client.prepareBuy(ACCOUNT, {currency: 'SOL', amount: 2_000_000_000n, stage: 0, referrer: REF})).toEqual({ok: false, error: 'referrer-not-applicable'});
+    await c.client.prepareBuy(ACCOUNT, {currency: 'SOL', amount: 2_000_000_000n, stage: 0});
+    expect(c.sent).toEqual([
+      {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0, referrer: REF}},
+      {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '2000000000', stage: 0}},
+    ]);
+    expect(Object.hasOwn((c.sent[1] as {intent: object}).intent, 'referrer')).toBe(false);
+    for (const code of REFERRER_LINES) expect([code, PREPARE_REFUSALS.includes(code)]).toEqual([code, true]);
+    expect(BUY_REFUSALS.filter(x => x.startsWith('referrer-'))).toEqual(['referrer-self', 'referrer-no-allocation']);
+  });
+});
+
 // B1d-1b Task 5: what #20's purchase variant asks — presale.preparedFor, presale.buy, presale.discardPrepared — and
 // prepareBuy carrying a challenge. The messages as the background parses them; each reply's shape checked.
 describe('the client for #20’s purchase variant', () => {
```

`extension/src/background/presale/__tests__/api.test.ts` (the open view's `referral`; its four cases):

```diff
diff --git a/extension/src/background/presale/__tests__/api.test.ts b/extension/src/background/presale/__tests__/api.test.ts
index cf1ff33..f453653 100644
--- a/extension/src/background/presale/__tests__/api.test.ts
+++ b/extension/src/background/presale/__tests__/api.test.ts
@@ -99,6 +99,7 @@ const OPEN_VIEW = {
   balances: {SOL: '5000000000', USDC: {largest: '50000000', total: '80000000'}, USDT: {largest: '7000000', total: '7000000'}},
   solUsdMicros: '198420000',
   countryCode: 'SI',
+  referral: {onChain: null, canRegister: true},
   pending: null,
 };
 /** B1d §2.3: an open purchase of ACCOUNT in v1_pending. */
@@ -219,6 +220,19 @@ describe('presale.view (§2.5)', () => {
     });
   });
 
+  it('B1d-2 (§2.5): the referral — the referrer on chain, and canRegister exactly for a first purchase without one (D8: an on-chain referrer always wins)', async () => {
+    const referral = async (chain: Partial<Chain>) => ((await send(await unlockedExt(), world({chain}), viewMsg)) as {data: {referral: unknown}}).data.referral;
+    // No allocation: a first purchase, nothing on chain → the field is offered (positive control).
+    expect(await referral({})).toEqual({onChain: null, canRegister: true});
+    // An allocation that never bought (purchase_count 0) and has no referrer: still a first purchase (C21).
+    expect(await referral({user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n}))})).toEqual({onChain: null, canRegister: true});
+    // Bought before: nothing can be registered any more.
+    expect(await referral({user: program(userData()), allocation: program(allocationData())})).toEqual({onChain: null, canRegister: false});
+    // A referrer on chain — with no purchase yet, and after purchases: it is named, and it wins.
+    expect(await referral({user: program(userData()), allocation: program(allocationData({count: 0, spent: 0n, totalTokens: 0n, bonus: 0n, referrer: OTHER}))})).toEqual({onChain: OTHER, canRegister: false});
+    expect(await referral({user: program(userData()), allocation: program(allocationData({referrer: OTHER}))})).toEqual({onChain: OTHER, canRegister: false});
+  });
+
   it('the open view carries the country the gate detected (D22) — as the gate named it, null when it named none, never a default', async () => {
     for (const countryCode of ['SI', 'CN', null]) {
       const ext = await unlockedExt();
```

`extension/src/background/presale/__tests__/referrer.test.ts` (Task 2's two "a referrer of 31 characters / outside base58 → malformed" rows become one row of `referrer-invalid` lines with nothing read; `malformed` keeps a non-string, null and an absent referrer):

```diff
diff --git a/extension/src/background/presale/__tests__/referrer.test.ts b/extension/src/background/presale/__tests__/referrer.test.ts
index e3b7e87..a8c3567 100644
--- a/extension/src/background/presale/__tests__/referrer.test.ts
+++ b/extension/src/background/presale/__tests__/referrer.test.ts
@@ -273,11 +273,23 @@ describe('presale.checkReferrer (§1.4, §3.5, C32): its order, each line at its
     expect(await check(await world({chain: {...EXISTING, allocation: program(allocationData({user: OTHER}))}}), R)).toEqual({ok: false, error: 'presale-unavailable', data: {detail: 'malformed'}});
   });
 
+  it('B1d-2 Task 3: whatever the field holds is the background’s to judge — not 32–44 base58 characters (empty, 31 or 45 characters, outside base58, a long paste) → referrer-invalid, nothing read', async () => {
+    for (const referrer of ['', 'x'.repeat(31), '1'.repeat(45), `${R.slice(0, -1)}0`, ` ${R}`, 'a'.repeat(5000)]) {
+      const w = await world();
+      expect([referrer.length, await check(w, referrer)]).toEqual([referrer.length, {ok: true, data: {ok: false, line: 'referrer-invalid'}}]);
+      expect(w.accountReads).toEqual([]);
+    }
+    // Still behind the session: locked first (nothing judged for a locked wallet).
+    const locked = await world();
+    await clearSession(locked.ext);
+    expect(await check(locked, 'x')).toEqual({ok: false, error: 'locked'});
+  });
+
   it.each([
     ['an extra key', {extra: 1}],
     ['a referrer that is not a string', {referrer: 7}],
-    ['a referrer of 31 characters', {referrer: 'x'.repeat(31)}],
-    ['a referrer outside base58', {referrer: `${R.slice(0, -1)}0`}],
+    ['a referrer that is null', {referrer: null}],
+    ['no referrer', {referrer: undefined}],
     ['a non-address account', {account: 'not-an-address'}],
   ])('%s → malformed, nothing read', async (_, over) => {
     const w = await world();
```

`extension/scripts/__tests__/check-no-presale.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index 1c4527c..c3f9a6d 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -164,7 +164,7 @@ describe('app.features.json', () => {
 describe('strings', () => {
   const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});
 
-  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row', () => {
+  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48)', () => {
     expect(MARKERS.slice(0, 9)).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale-buy']);
     // §6.2's named strings #23 shows, then Q01, Q02, Q04–Q06, Q11–Q16, Q19, Q40c, Q41c, Q41d, Q43, Q52 (each literal part ≥ 8 characters).
     expect(MARKERS.slice(9)).toEqual([
@@ -244,6 +244,11 @@ describe('strings', () => {
       'presale.checkReferrer',
       'Referred by',
       "Saved to your presale account with this purchase. It can't be changed later.",
+      'Referral address (optional)',
+      'Solana address of the person who invited you',
+      "You can't refer yourself or another account in this wallet",
+      "This address has no presale allocation, so it can't receive a referral bonus",
+      'This account can no longer take a referrer — review again',
     ]);
   });
 
```

- [ ] **Step 2: Run them on the previous task's tree — red.**

In a `git archive` copy of Task 2's commit with only the Step 1 files added (node_modules linked): `npx tsc --noEmit; echo $?` → `2`, 10 errors, all in `client.test.ts` (7 × `Property 'checkReferrer' does not exist on type 'PresaleClient'`, 1 × `Module '"../client"' has no exported member 'referrerCheckOf'`, 1 × `… 'REFERRER_LINES'`, 1 × `'referrer' does not exist in type '{ currency: PresaleCurrency; amount: bigint; stage: number; }'`).

`npx vitest run src/app/presale/__tests__/referral.test.tsx src/app/presale/__tests__/client.test.ts src/background/presale/__tests__/api.test.ts src/background/presale/__tests__/referrer.test.ts scripts/__tests__/check-no-presale.test.mjs` — `Test Files  5 failed (5)` · `Tests  34 failed | 181 passed (215)`: `referral.test.tsx` `19 failed | 2 passed (21)` — the two green rows are **green on the old tree by design**: "not offered: an account that bought before; an allocation with a referrer on chain …" (the old #23 has no field at all — the negative half of "shown only while canRegister", whose positive half is red) and "a purchase without a referrer looks exactly as in B1d-1b" (the positive control that a purchase without one keeps B1d-1b's #20 rows); `client.test.ts` `6 failed` (the positive view row — no `referral` — and the five new rows); `api.test.ts` `7 failed` (`OPEN_VIEW` now carries `referral`: six B1d-1b rows, and the new referral row); `referrer.test.ts` `1 failed` (the non-base58 string is still `malformed`); `check-no-presale.test.mjs` `1 failed` (the `MARKERS` row). The off run is unchanged by this task (no row of it runs there).

- [ ] **Step 3: Implement.**

`extension/src/background/presale/api.ts`:

```diff
diff --git a/extension/src/background/presale/api.ts b/extension/src/background/presale/api.ts
index 4c00f8e..af77b88 100644
--- a/extension/src/background/presale/api.ts
+++ b/extension/src/background/presale/api.ts
@@ -68,14 +68,22 @@ export interface BalancesView {
   USDT: {largest: string; total: string};
 }
 /**
- * §2.5 — `referral` joins the open variant in B1d-2. `pending` is in every variant (C30). The open variant carries the
- * country the gate detected, or null when it named none (D22: #50b's open variant shows it).
+ * §2.5 (B1d-2): the referrer registered on chain, or null; `canRegister` — #23 offers the referral address — exactly when
+ * this is a first purchase and there is none (D8: an on-chain referrer always wins).
+ */
+export interface ReferralView {
+  onChain: string | null;
+  canRegister: boolean;
+}
+/**
+ * §2.5. `pending` is in every variant (C30). The open variant carries the country the gate detected, or null when it
+ * named none (D22: #50b's open variant shows it), and the account's referral (B1d-2).
  */
 export type PresaleView =
   | {open: false; why: 'unavailable'; code: UnavailableCode; pending: PendingView | null}
   | {open: false; why: 'inactive' | 'blocked'; state: StageView; pending: PendingView | null}
   | {open: false; why: 'geo'; geo: GeoAnswer; state: StageView | null; pending: PendingView | null}
-  | {open: true; state: StageView; limits: LimitsView; allocation: AllocationView; balances: BalancesView; solUsdMicros: string | null; countryCode: string | null; pending: PendingView | null};
+  | {open: true; state: StageView; limits: LimitsView; allocation: AllocationView; balances: BalancesView; solUsdMicros: string | null; countryCode: string | null; referral: ReferralView; pending: PendingView | null};
 /** §3.2. `cents` and `nocBase` are null only with `line: 'no-sol-price'`. */
 export interface Quote {
   amount: string;
@@ -256,6 +264,7 @@ async function view(ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unk
       balances: balancesView(balances),
       solUsdMicros: micros === null ? null : micros.toString(),
       countryCode: geo.countryCode,
+      referral: {onChain: snapshot.allocation.referrer, canRegister: snapshot.limits.firstPurchase && snapshot.allocation.referrer === null},
       pending,
     } satisfies PresaleView,
   };
@@ -361,15 +370,17 @@ async function discardMessage(ext: Ext, _deps: WalletDeps, msg: Readonly<Record<
 /**
  * presale.checkReferrer {account, referrer} (§1.4, §3.5, B1d-2): `{ok: true}` when the purchase would register the
  * address, `{ok: false, line}` with the line #23's field shows; a read failure is the purchase's refusal. The field's
- * answer only — the prepare and the signature decide again. `referrer` is a string of 32–44 base58 characters (§1.4);
- * whether it is a key is the line's to say.
+ * answer only — the prepare and the signature decide again. `referrer` is whatever the field holds (B1d-2 Task 3: the
+ * popup judges nothing, C3): a string that is not 32–44 base58 characters is `referrer-invalid` with nothing read;
+ * whether one that is names a key is the line's to say too.
  */
 async function checkReferrerMessage(ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
   if (!onlyKeys(msg, ['type', 'account', 'referrer'])) return MALFORMED;
   const {account, referrer} = msg;
-  if (!isAddress(account) || typeof referrer !== 'string' || !REFERRER.test(referrer)) return MALFORMED;
+  if (!isAddress(account) || typeof referrer !== 'string') return MALFORMED;
   const refused = await sessionRefusal(ext, account);
   if (refused !== null) return refused;
+  if (!REFERRER.test(referrer)) return {ok: true, data: {ok: false, line: 'referrer-invalid'}};
   try {
     const line = await checkReferrer(ext, deps, account, referrer);
     return {ok: true, data: line === null ? {ok: true} : {ok: false, line}};
```

`extension/src/app/presale/client.ts`:

```diff
diff --git a/extension/src/app/presale/client.ts b/extension/src/app/presale/client.ts
index bdaaee1..e20bedf 100644
--- a/extension/src/app/presale/client.ts
+++ b/extension/src/app/presale/client.ts
@@ -42,6 +42,8 @@ export type PresaleView =
       solUsdMicros: bigint | null;
       /** The country the gate detected (D22), or null when it named none. */
       countryCode: string | null;
+      /** B1d-2 (§2.5): the referrer on chain, or null; #23 offers the referral address only while `canRegister`. */
+      referral: {onChain: string | null; canRegister: boolean};
       pending: Pending | null;
     };
 export type LimitLine = 'below-min' | 'above-max-tx' | 'above-user-limit';
@@ -90,6 +92,10 @@ export interface BannerData {
   stagePercent: number;
 }
 
+/** §3.5 (B1d-2): the lines under #23's referral address — presale.checkReferrer's answers, and prepare's refusals of the address. */
+export const REFERRER_LINES = ['referrer-invalid', 'referrer-self', 'referrer-not-applicable', 'referrer-no-allocation'] as const;
+export type ReferrerLine = (typeof REFERRER_LINES)[number];
+
 /** The refusals of presale.prepareBuy (§5) the popup translates; anything else is `failed`. */
 export const PREPARE_REFUSALS = [
   'malformed',
@@ -116,10 +122,20 @@ export const PREPARE_REFUSALS = [
   'simulation-failed',
   'simulation-mismatch',
   'presale-busy',
+  ...REFERRER_LINES,
 ] as const;
 export type PrepareRefusal = (typeof PREPARE_REFUSALS)[number];
 const SESSION = ['malformed', 'locked', 'unknown-account', 'unavailable'] as const;
 type SessionRefusal = (typeof SESSION)[number];
+const CHECK_REFUSALS = [...SESSION, 'presale-unavailable', 'coordinator-refused'] as const;
+export type CheckRefusal = (typeof CHECK_REFUSALS)[number];
+/** What #23 asks presale.prepareBuy to buy; `referrer` present only when the field holds one (B1d-2). */
+export interface PurchaseIntent {
+  currency: PresaleCurrency;
+  amount: bigint;
+  stage: number;
+  referrer?: string;
+}
 /**
  * The refusals of presale.buy (§1.4, §3.3, §5) #20 translates: the purchase's sign-time codes and B1b's pipeline's;
  * anything else is `failed`. `reauth-required` carries `{challengeId}`, `check-pending` `{id, signature}`.
@@ -146,6 +162,9 @@ export const BUY_REFUSALS = [
   'below-min',
   'above-max-tx',
   'above-user-limit',
+  // B1d-2: the referral address re-checked at the signature (§3.5) — it became an account of this wallet, or its allocation went.
+  'referrer-self',
+  'referrer-no-allocation',
 ] as const;
 export type BuyRefusal = (typeof BUY_REFUSALS)[number];
 /** §1.4 presale.preparedFor: the account's prepared purchase as #20 shows it; `expired` past its 30 s (re-prepare it). */
@@ -158,8 +177,13 @@ export interface PresaleClient {
   /** `stale`: the account's last view is older than the quote's 30 s (§1.4) — ask a view, then again. */
   quote(account: string, currency: PresaleCurrency, amount: bigint | 'max'): Promise<Reply<Quote | 'stale', SessionRefusal>>;
   pending(account: string): Promise<Reply<Pending | null, SessionRefusal>>;
-  /** `challengeId`: the purchase's live challenge, carried into the new prepare (§3.3 step 6) — the background decides whether it still applies. */
-  prepareBuy(account: string, intent: {currency: PresaleCurrency; amount: bigint; stage: number}, challengeId?: string): Promise<Reply<PurchaseView, PrepareRefusal>>;
+  /**
+   * `challengeId`: the purchase's live challenge, carried into the new prepare (§3.3 step 6) — the background decides
+   * whether it still applies. `referrer` (B1d-2): the referral address as entered, sent only when there is one.
+   */
+  prepareBuy(account: string, intent: PurchaseIntent, challengeId?: string): Promise<Reply<PurchaseView, PrepareRefusal>>;
+  /** §3.5 (B1d-2): the line for this referral address, or null when the purchase would register it — the background's answer. */
+  checkReferrer(account: string, referrer: string): Promise<Reply<ReferrerLine | null, CheckRefusal>>;
   preparedFor(account: string): Promise<Reply<ResumablePurchase | null, SessionRefusal>>;
   buy(id: string): Promise<Reply<Pending, BuyRefusal>>;
   discardPrepared(account: string): Promise<Reply<null, SessionRefusal>>;
@@ -224,12 +248,13 @@ export function presaleViewOf(x: unknown): PresaleView | undefined {
   const pending = pendingIn(o.pending);
   if (pending === undefined) return undefined;
   if (o.open === true) {
-    if (!exactly(o, ['open', 'state', 'limits', 'allocation', 'balances', 'solUsdMicros', 'countryCode', 'pending'])) return undefined;
+    if (!exactly(o, ['open', 'state', 'limits', 'allocation', 'balances', 'solUsdMicros', 'countryCode', 'referral', 'pending'])) return undefined;
     const state = stageOf(o.state);
     const l = obj(o.limits);
     const a = obj(o.allocation);
     const b = obj(o.balances);
-    if (state === undefined || l === undefined || a === undefined || b === undefined || !exactly(l, ['minCents', 'maxTxCents', 'userRemainingCents', 'firstPurchase']) || !exactly(a, ['exists', 'totalBase', 'bonusBase']) || !exactly(b, ['SOL', 'USDC', 'USDT'])) return undefined;
+    const r = obj(o.referral);
+    if (state === undefined || l === undefined || a === undefined || b === undefined || r === undefined || !exactly(l, ['minCents', 'maxTxCents', 'userRemainingCents', 'firstPurchase']) || !exactly(a, ['exists', 'totalBase', 'bonusBase']) || !exactly(b, ['SOL', 'USDC', 'USDT']) || !exactly(r, ['onChain', 'canRegister'])) return undefined;
     const [minCents, maxTxCents, userRemainingCents] = [units(l.minCents), units(l.maxTxCents), units(l.userRemainingCents)];
     const [totalBase, bonusBase, sol] = [units(a.totalBase), units(a.bonusBase), units(b.SOL)];
     const [usdc, usdt] = [pair(b.USDC), pair(b.USDT)];
@@ -237,6 +262,9 @@ export function presaleViewOf(x: unknown): PresaleView | undefined {
     const countryCode = countryOf(o.countryCode);
     if (minCents === undefined || maxTxCents === undefined || userRemainingCents === undefined || typeof l.firstPurchase !== 'boolean') return undefined;
     if (typeof a.exists !== 'boolean' || totalBase === undefined || bonusBase === undefined || sol === undefined || usdc === undefined || usdt === undefined || solUsdMicros === undefined || solUsdMicros === 0n || countryCode === undefined) return undefined;
+    const onChain = r.onChain === null ? null : isAddress(r.onChain) ? r.onChain : undefined;
+    // §2.5: canRegister is exactly "a first purchase and no referrer on chain" — any other pairing is not the background's.
+    if (onChain === undefined || typeof r.canRegister !== 'boolean' || r.canRegister !== (l.firstPurchase && onChain === null)) return undefined;
     return {
       open: true,
       state,
@@ -245,6 +273,7 @@ export function presaleViewOf(x: unknown): PresaleView | undefined {
       balances: {SOL: sol, USDC: usdc, USDT: usdt},
       solUsdMicros,
       countryCode,
+      referral: {onChain, canRegister: r.canRegister},
       pending,
     };
   }
@@ -353,6 +382,14 @@ export function resumableOf(x: unknown): ResumablePurchase | undefined {
   return view === undefined ? undefined : {...view, expired};
 }
 
+/** presale.checkReferrer's answer (§1.4): `{ok: true}` → null, `{ok: false, line}` → the line. */
+export function referrerCheckOf(x: unknown): ReferrerLine | null | undefined {
+  const o = obj(x);
+  if (o === undefined) return undefined;
+  if (exactly(o, ['ok'])) return o.ok === true ? null : undefined;
+  return exactly(o, ['ok', 'line']) && o.ok === false ? oneOf(o.line, REFERRER_LINES) : undefined;
+}
+
 /** The pending record presale.buy answers: the wallet's own purchase (`intent: null`, this kind), nothing else. */
 const purchaseRecordOf = (x: unknown): Pending | undefined => {
   const p = pendingIn(x);
@@ -367,10 +404,16 @@ export function presaleClient(engine: Engine): PresaleClient {
     pending: (account: string) => engine.request({type: 'presale.pending', account}, SESSION, x => (x === null ? null : pendingIn(x))),
     prepareBuy: (account, intent, challengeId) =>
       engine.request(
-        {type: 'presale.prepareBuy', account, intent: {currency: intent.currency, amount: intent.amount.toString(), stage: intent.stage}, ...(challengeId === undefined ? {} : {challengeId})},
+        {
+          type: 'presale.prepareBuy',
+          account,
+          intent: {currency: intent.currency, amount: intent.amount.toString(), stage: intent.stage, ...(intent.referrer === undefined ? {} : {referrer: intent.referrer})},
+          ...(challengeId === undefined ? {} : {challengeId}),
+        },
         PREPARE_REFUSALS,
         purchaseViewOf,
       ),
+    checkReferrer: (account, referrer) => engine.request({type: 'presale.checkReferrer', account, referrer}, CHECK_REFUSALS, referrerCheckOf),
     preparedFor: account => engine.request({type: 'presale.preparedFor', account}, SESSION, x => (x === null ? null : resumableOf(x))),
     buy: id => engine.request({type: 'presale.buy', id}, BUY_REFUSALS, purchaseRecordOf),
     discardPrepared: account => engine.request({type: 'presale.discardPrepared', account}, SESSION, x => (x === undefined ? null : undefined)),
```

`extension/src/app/presale/text.ts`:

```diff
diff --git a/extension/src/app/presale/text.ts b/extension/src/app/presale/text.ts
index 60f95e5..b0477be 100644
--- a/extension/src/app/presale/text.ts
+++ b/extension/src/app/presale/text.ts
@@ -1,5 +1,5 @@
 import {formatAmount} from '../../shared/amount';
-import type {GeoReason, PresaleCurrency} from './client';
+import type {GeoReason, PresaleCurrency, ReferrerLine} from './client';
 
 /**
  * #23's strings (B1d §4.1, §10 — controller copy, owner-delegated 2026-10-19; the design's own where §4.1 keeps it) and
@@ -65,6 +65,21 @@ export const PRESALE_TEXT = {
   regionLine: (reason: string): string => `Not available here — ${reason}`,
 } as const;
 
+/**
+ * #23a's referral address (B1d-2, D8, §4.1 — undrawn, §9): Q45's label and placeholder, and the line under it for each of
+ * the background's answers — Q46 a–c, Q48 (controller copy, owner-delegated 2026-10-19).
+ */
+export const REFERRAL_TEXT = {
+  label: 'Referral address (optional)',
+  placeholder: 'Solana address of the person who invited you',
+} as const;
+export const REFERRER_LINE_TEXT: Record<ReferrerLine, string> = {
+  'referrer-invalid': 'Not a valid Solana address',
+  'referrer-self': "You can't refer yourself or another account in this wallet",
+  'referrer-no-allocation': "This address has no presale allocation, so it can't receive a referral bonus",
+  'referrer-not-applicable': 'This account can no longer take a referrer — review again',
+};
+
 /**
  * #20's purchase variant (§4.2; Q07–Q10, Q44 — controller copy, owner-delegated 2026-10-19; §4.2's own row labels and
  * B1b's #20 labels where it keeps them). Q57 and Q58 are new in B1d-1b Task 5 — controller copy, flagged to the owner:
@@ -83,6 +98,9 @@ export const CONFIRM_PURCHASE_TEXT = {
   to: 'To',
   /** Q10. */
   presale: 'Noctura presale',
+  /** Q47 (B1d-2): the row, and its note when this purchase registers the referrer. */
+  referredBy: 'Referred by',
+  registers: "Saved to your presale account with this purchase. It can't be changed later.",
   fees: 'Fees',
   networkFee: 'Network fee',
   priority: 'Priority',
```

`extension/src/app/presale/routes.tsx`:

```diff
diff --git a/extension/src/app/presale/routes.tsx b/extension/src/app/presale/routes.tsx
index f36d1be..371dba2 100644
--- a/extension/src/app/presale/routes.tsx
+++ b/extension/src/app/presale/routes.tsx
@@ -9,13 +9,15 @@ import {PREPARE_REFUSALS, PRESALE_CURRENCIES, type PrepareRefusal, type PresaleC
  * prepared purchase (§3.3: `price-changed`, `state-changed`, a limit that moved), and #44's / #54's [Try again]. Only
  * what the user chose — the currency and the amount, base units as a decimal string — the refusal #23 shows for it,
  * and the purchase's challenge id, which #23's next Buy carries (§3.3 step 6: the background decides whether it still
- * applies). Never a prepared purchase: #23 prepares again on its own Buy.
+ * applies). Never a prepared purchase: #23 prepares again on its own Buy. B1d-2: `referrer` — the referral address the
+ * purchase registered, back in #23's field (present only then; a refusal of it is `code`, its line under the field).
  */
 export interface PresaleAgain {
   currency: PresaleCurrency;
   amount: string;
   code: PrepareRefusal | null;
   challengeId: string | null;
+  referrer?: string;
 }
 
 const AMOUNT = /^[1-9]\d{0,19}$/;
@@ -27,7 +29,7 @@ const exactly = (o: Readonly<Record<string, unknown>>, keys: readonly string[]):
 function isAgain(x: unknown): x is PresaleAgain {
   if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
   const o = x as Record<string, unknown>;
-  if (!exactly(o, ['currency', 'amount', 'code', 'challengeId'])) return false;
+  if (!exactly(o, ['currency', 'amount', 'code', 'challengeId']) && !(exactly(o, ['currency', 'amount', 'code', 'challengeId', 'referrer']) && typeof o.referrer === 'string' && ADDRESS.test(o.referrer))) return false;
   if (typeof o.currency !== 'string' || !(PRESALE_CURRENCIES as readonly string[]).includes(o.currency)) return false;
   if (typeof o.amount !== 'string' || !AMOUNT.test(o.amount) || BigInt(o.amount) > U64_MAX) return false;
   if (o.code !== null && (typeof o.code !== 'string' || !(PREPARE_REFUSALS as readonly string[]).includes(o.code))) return false;
```

`extension/src/app/presale/Presale.tsx`:

```diff
diff --git a/extension/src/app/presale/Presale.tsx b/extension/src/app/presale/Presale.tsx
index acdbb3d..41c4973 100644
--- a/extension/src/app/presale/Presale.tsx
+++ b/extension/src/app/presale/Presale.tsx
@@ -14,17 +14,20 @@ import {SEND_TEXT} from '../screens/Send';
 import type {Pending, Reply, Token} from '../engine';
 import {
   PRESALE_CURRENCIES,
+  REFERRER_LINES,
   presaleClient,
   purchaseDataOf,
+  type CheckRefusal,
   type PrepareRefusal,
   type PresaleCurrency,
   type PresaleView,
   type PurchaseView,
   type Quote,
   type QuoteLine,
+  type ReferrerLine,
   type StageView,
 } from './client';
-import {GEO_REASON_TEXT, PRESALE_TEXT, dollarsText, fillWidth, millionsNoc, priceText, raisedText, shortSignature, solPriceText} from './text';
+import {GEO_REASON_TEXT, PRESALE_TEXT, REFERRAL_TEXT, REFERRER_LINE_TEXT, dollarsText, fillWidth, millionsNoc, priceText, raisedText, shortSignature, solPriceText} from './text';
 import type {PresaleAgain} from './routes';
 
 /** C35: #23a re-reads the snapshot and the gate this often while it is visible. */
@@ -40,6 +43,7 @@ type OpenView = Extract<PresaleView, {open: true}>;
 type Line = QuoteLine | 'above-limit';
 const LINES: readonly string[] = ['below-min', 'above-max-tx', 'above-user-limit', 'above-limit', 'insufficient-sol', 'insufficient-token', 'split-balance', 'sender-below-rent', 'no-sol-price'];
 const isLine = (code: string): code is Line => LINES.includes(code);
+const isReferrerLine = (code: string): code is ReferrerLine => (REFERRER_LINES as readonly string[]).includes(code);
 
 const visible = (): boolean => typeof document === 'undefined' || document.visibilityState === 'visible';
 
@@ -95,6 +99,9 @@ function refusalOf(code: PrepareRefusal | 'failed'): {notice: string | null; rer
   }
 }
 
+/** A referral-address check that did not answer a line (§5: a read failure): the notice it shows. */
+const checkFailedText = (code: CheckRefusal | 'failed'): string => (code === 'coordinator-refused' ? PRESALE_TEXT.refused : PRESALE_TEXT.unavailable);
+
 function StageCard({state, live}: {state: StageView; live: boolean}) {
   const n = state.stage + 1;
   return (
@@ -216,6 +223,11 @@ function Pending23b({record, line, onRegion}: {record: Pending; line: {text: str
  * when 23b's record closes; while 23a is visible, the snapshot and the gate every 25 s (`refresh: 'gate'`, the balances
  * of the last full view kept); nothing while hidden. 23b reads only its record, every 6 s and on focus (no network).
  * Buy (rule 6, a LockedButton) hands the background's prepared purchase to `onPrepared`.
+ *
+ * B1d-2 (§3.5, D8): the referral address, only while the view says `referral.canRegister`. Its line is
+ * presale.checkReferrer's answer on blur (the newest check, for the text as it still is); Buy waits while a check is out
+ * and while a line shows. What the field holds travels in the intent (trimmed; empty: none); prepare decides again and refuses
+ * rather than drops it — Q48 and the view read again, the field and its text gone with Q48 said.
  */
 export function Presale({
   again = null,
@@ -257,7 +269,15 @@ export function Presale({
   const [refusal, setRefusal] = useState<{key: string; line: Line} | null>(() =>
     again === null || again.code === null || !isLine(again.code) ? null : {key: `${again.currency}|${plainAmount(BigInt(again.amount), TOKEN_INFO[again.currency].decimals)}`, line: again.code},
   );
-  const [notice, setNotice] = useState<string | null>(() => (again === null || again.code === null || isLine(again.code) ? null : refusalOf(again.code).notice));
+  const [notice, setNotice] = useState<string | null>(() => (again === null || again.code === null || isLine(again.code) || isReferrerLine(again.code) ? null : refusalOf(again.code).notice));
+  /** B1d-2: the referral address as the user typed it (§4.1, D8). */
+  const [referrer, setReferrer] = useState(again?.referrer ?? '');
+  /** The background's line for the referral address (checkReferrer's answer on blur, or a prepare's refusal of it). */
+  const [referrerLine, setReferrerLine] = useState<ReferrerLine | null>(() => (again?.referrer !== undefined && again.code !== null && isReferrerLine(again.code) ? again.code : null));
+  /** A check of the referral address is out: Buy waits for its answer. */
+  const [checking, setChecking] = useState(false);
+  /** Bumped by every edit of the referral address and every check: an answer to an older one is dropped. */
+  const checkGeneration = useRef(0);
   /** The purchase's challenge #20 handed back: the next Buy carries it (§3.3 step 6). */
   const carried = useRef(again?.challengeId ?? null);
   const [sheet, setSheet] = useState(false);
@@ -396,7 +416,47 @@ export function Presale({
   const noPrice = open !== null && currency === 'SOL' && open.solUsdMicros === null;
   const line: Line | null = refusal !== null && refusal.key === key ? refusal.line : noPrice ? 'no-sol-price' : (quote?.line ?? null);
   const estimate = quote?.nocBase ?? null;
-  const ready = open !== null && account !== null && amount !== null && quote !== null && quote.amount === amount && line === null && !stale && m.net.mode !== 'refused';
+  const entered = referrer.trim();
+  const ready = open !== null && account !== null && amount !== null && quote !== null && quote.amount === amount && line === null && !stale && referrerLine === null && !checking && m.net.mode !== 'refused';
+
+  // §3.5, Q48: the referral address can no longer apply (a purchase or a referrer registered meanwhile): the field goes,
+  // and what was typed in it with it — said, never dropped in silence.
+  const canRegister = open?.referral.canRegister ?? true;
+  useEffect(() => {
+    if (canRegister || referrer === '') return;
+    checkGeneration.current += 1;
+    setReferrer('');
+    setReferrerLine(null);
+    setChecking(false);
+    setNotice(REFERRER_LINE_TEXT['referrer-not-applicable']);
+  }, [canRegister, referrer]);
+
+  const editReferrer = (next: string) => {
+    checkGeneration.current += 1;
+    setReferrer(next);
+    setReferrerLine(null);
+    setChecking(false);
+  };
+  /** On blur (§3.5): the background's line for what the field holds — nothing for an empty field (no referrer). */
+  const checkReferrer = async () => {
+    const mine = ++checkGeneration.current;
+    if (account === null || entered === '') {
+      setChecking(false);
+      return;
+    }
+    setChecking(true);
+    const r = await client.checkReferrer(account, entered);
+    if (!alive.current || checkGeneration.current !== mine) return;
+    setChecking(false);
+    if (!r.ok) {
+      if (r.error === 'locked') return void reload();
+      if (r.error === 'coordinator-refused') report('coordinator-refused');
+      setNotice(checkFailedText(r.error));
+      return;
+    }
+    setReferrerLine(r.data);
+    if (r.data === 'referrer-not-applicable') void read();
+  };
 
   const edit = (next: string) => {
     setText(next);
@@ -424,7 +484,7 @@ export function Presale({
     if (!ready || open === null || account === null || amount === null) return;
     setNotice(null);
     const asked = key;
-    const r = await client.prepareBuy(account, {currency, amount, stage: open.state.stage}, carried.current ?? undefined);
+    const r = await client.prepareBuy(account, {currency, amount, stage: open.state.stage, ...(entered === '' ? {} : {referrer: entered})}, carried.current ?? undefined);
     if (!alive.current) return;
     if (r.ok) {
       onPrepared(account, r.data);
@@ -438,6 +498,13 @@ export function Presale({
       setRefusal({key: asked, line: r.error});
       return;
     }
+    // §3.5: the referral address refused at prepare — its line under the field, never dropped; Q48 reads the view again
+    // (the field goes).
+    if (isReferrerLine(r.error)) {
+      setReferrerLine(r.error);
+      if (r.error === 'referrer-not-applicable') void read();
+      return;
+    }
     if (r.error === 'coordinator-refused') report('coordinator-refused');
     const what = refusalOf(r.error);
     setNotice(what.notice);
@@ -534,6 +601,30 @@ export function Presale({
             <span className="ticker">NOC</span>
           </div>
         </div>
+        {v.referral.canRegister ? (
+          <div className="app-pre-referral">
+            <label className="noc-overline app-pre-referral-label" htmlFor="presale-referrer">
+              {REFERRAL_TEXT.label}
+            </label>
+            <input
+              id="presale-referrer"
+              className={`app-input noc-mono${referrerLine === null ? '' : ' is-error'}`}
+              placeholder={REFERRAL_TEXT.placeholder}
+              autoComplete="off"
+              autoCapitalize="off"
+              autoCorrect="off"
+              spellCheck={false}
+              value={referrer}
+              onChange={e => editReferrer(e.target.value)}
+              onBlur={() => void checkReferrer()}
+            />
+            {referrerLine === null ? null : (
+              <div className="helper error" role="alert">
+                <ExtIcon name="alert" size={12} /> {REFERRER_LINE_TEXT[referrerLine]}
+              </div>
+            )}
+          </div>
+        ) : null}
         {v.allocation.exists && v.allocation.totalBase > 0n ? (
           <div className="receipt">
             <div className="row">
```

`extension/src/app/presale/PresaleConfirm.tsx`:

```diff
diff --git a/extension/src/app/presale/PresaleConfirm.tsx b/extension/src/app/presale/PresaleConfirm.tsx
index 4c955e2..726113d 100644
--- a/extension/src/app/presale/PresaleConfirm.tsx
+++ b/extension/src/app/presale/PresaleConfirm.tsx
@@ -20,6 +20,8 @@ import type {PresaleAgain} from './routes';
 
 const HEX32 = /^[0-9a-f]{32}$/;
 const isPrepareRefusal = (code: string): code is PrepareRefusal => (PREPARE_REFUSALS as readonly string[]).includes(code);
+/** B1d-2: the referral address this purchase registers — what a re-prepare and #23 again carry; none for an on-chain referrer. */
+const registering = (v: ResumablePurchase): {referrer?: string} => (v.referrer?.registers === true ? {referrer: v.referrer.address} : {});
 /** "271 408 921": a slot in groups of three, as #19 and #20 write it. */
 const groupSlot = (slot: number): string => slot.toLocaleString('en-US').replace(/,/g, ' ');
 
@@ -35,7 +37,9 @@ const groupSlot = (slot: number): string => slot.toLocaleString('en-US').replace
  * simulation credits (`nocBase`, the program's Δtotal_tokens — not #23's estimate), the stage and the price it was
  * simulated at, the account and the recipient — Q10 over the pinned treasury or vault ATA, whole, in groups of four —
  * the fees (network, priority, and Q09 for the accounts this purchase creates; no Noctura fee, C25), and #19's facts
- * (C33, Q44). No first-send warning (§3.4). Re-authentication opens #10 exactly as a send's does.
+ * (C33, Q44), and — B1d-2, Q47 — "Referred by" with the whole referrer and, when this purchase registers it, Q47's note.
+ * No first-send warning (§3.4). Re-authentication opens #10 exactly as a send's does. A re-prepare and #23 again carry
+ * the referral address the purchase registers (never dropped).
  *
  * Where it goes (#23 is this flow's review): back and Esc → #23 with the amount kept and the challenge carried; Cancel
  * → `presale.discardPrepared`, then a fresh #23; a sign-time refusal that no re-prepare can lift (`geo-closed`,
@@ -90,7 +94,7 @@ export function PresaleConfirm({
   const toPresale = useCallback(
     (v: ResumablePurchase, code: PrepareRefusal | null) => {
       left.current = true;
-      onPresale({currency: v.currency, amount: v.amount.toString(), code, challengeId: v.reauth?.challengeId ?? null});
+      onPresale({currency: v.currency, amount: v.amount.toString(), code, challengeId: v.reauth?.challengeId ?? null, ...registering(v)});
     },
     [onPresale],
   );
@@ -105,7 +109,7 @@ export function PresaleConfirm({
     async (v: ResumablePurchase): Promise<boolean> => {
       const g = gen.current;
       setBusy(true);
-      const r = await client.prepareBuy(account, {currency: v.currency, amount: v.amount, stage: v.stage}, v.reauth?.challengeId);
+      const r = await client.prepareBuy(account, {currency: v.currency, amount: v.amount, stage: v.stage, ...registering(v)}, v.reauth?.challengeId);
       setBusy(false);
       if (left.current || gen.current !== g) {
         if (r.ok && cancelled.current) void client.discardPrepared(account);
@@ -346,6 +350,8 @@ export function PresaleConfirm({
       case 'above-max-tx':
       case 'above-user-limit':
       case 'presale-unavailable':
+      case 'referrer-self':
+      case 'referrer-no-allocation':
         // Kept (C29): #23 shows why, for the same amount; its next Buy prepares again carrying the challenge.
         return toPresale(v, r.error);
       case 'coordinator-refused':
@@ -444,6 +450,17 @@ export function PresaleConfirm({
               </span>
             </span>
           </div>
+          {view.referrer === null ? null : (
+            <div className="detail-row">
+              <span className="lbl">{T.referredBy}</span>
+              <span className="val app-stack">
+                <span className="noc-mono">
+                  <AddressGroups address={view.referrer.address} />
+                </span>
+                {view.referrer.registers ? <span className="noc-caption app-pre-note">{T.registers}</span> : null}
+              </span>
+            </div>
+          )}
           <div className="detail-row">
             <span className="lbl">Network</span>
             <span className="val app-prose">{CONFIRM_TEXT.network}</span>
```

`extension/src/app/app.css` (hand-written; `design-ext.css` is not touched — the field is undrawn, so the extractor has nothing to add):

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index f70f36d..379d7d0 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -737,6 +737,12 @@ a.btn {
 .s-conf .detail-grid.app-pre-grid .detail-row {
   grid-template-columns: 112px 1fr;
 }
+/* B1d-2: #20's "Referred by" — Q47's note under the whole address, in words (the design's .val breaks anywhere). */
+.s-conf .detail-row .val .app-pre-note {
+  color: var(--fg-secondary);
+  word-break: normal;
+  overflow-wrap: anywhere;
+}
 /* B1d-1b Task 5: #44's amount line for a purchase (Q32), under the head: no UA paragraph margin, so it sits with the head
    and the sub below keeps the design's spacing (two stacked margins opened a gap; found in the visual check). */
 .s9-fail-hero .sub.app-fail-line {
@@ -2138,20 +2144,46 @@ body:has(.app-window) {
 .s-pre .input-card .input::placeholder {
   color: var(--fg-disabled);
 }
-/* The limit or balance line under the amount, in #12's error style (.s-send .helper.error). */
-.s-pre .input-card .helper {
+/* The limit or balance line under the amount, in #12's error style (.s-send .helper.error) — and, B1d-2, the referral
+   address's line. */
+.s-pre .input-card .helper,
+.s-pre .app-pre-referral .helper {
   display: flex;
   align-items: flex-start;
   gap: 4px;
   font: 400 12px/16px var(--font-body);
 }
-.s-pre .input-card .helper svg {
+.s-pre .input-card .helper svg,
+.s-pre .app-pre-referral .helper svg {
   flex: 0 0 auto;
   margin-top: 2px;
 }
-.s-pre .input-card .helper.error {
+.s-pre .input-card .helper.error,
+.s-pre .app-pre-referral .helper.error {
   color: var(--danger);
 }
+/* B1d-2: #23a's referral address (D8; undrawn, §9) between the receive card and the allocation row — B1b's single-line
+   input (.app-input, the address book's) under an overline label, the value in the mono face at 13 px: a whole 44-
+   character address fits the 412 px popup's field (at #12's 14 px it scrolled; found in the visual check). Q45's
+   placeholder is words, in the body face (in the mono face it was cut off). */
+.s-pre .app-pre-referral {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-2);
+}
+.s-pre .app-pre-referral-label {
+  color: var(--fg-tertiary);
+}
+.s-pre .app-pre-referral .app-input {
+  width: 100%;
+  font-family: var(--font-mono);
+  font-size: 13px;
+  line-height: 20px;
+}
+.s-pre .app-pre-referral .app-input::placeholder {
+  color: var(--fg-tertiary);
+  font-family: var(--font-body);
+}
 /* The allocation row: its value, and D5's TGE line under it (no drawn state; the receipt-row style). */
 .s-pre .receipt .row .r.app-pre-stack {
   display: flex;
```

`extension/scripts/check-no-presale.mjs`:

```diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index 3731a7d..2e5ad2e 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -149,6 +149,13 @@ export const MARKERS = [
   'presale.checkReferrer',
   'Referred by',
   "Saved to your presale account with this purchase. It can't be changed later.",
+  // B1d-2 Task 3: #23a's referral address — Q45's label and placeholder, Q46 b and c, Q48 (Q46a is a prefix of B1b's
+  // "Not a valid Solana address — check length & characters", which both builds carry).
+  'Referral address (optional)',
+  'Solana address of the person who invited you',
+  "You can't refer yourself or another account in this wallet",
+  "This address has no presale allocation, so it can't receive a referral bonus",
+  'This account can no longer take a referrer — review again',
 ];
 // Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
 // be a string search. The decoder's instruction names are read from its source (DECODER).
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates.**

Run: the Step 2 commands — `Test Files  5 passed (5)` · `Tests  215 passed (215)` (referral 21, client 21, api 68, referrer 53, check-no-presale 52).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  218 passed (218)` · `Tests  4607 passed (4607)` (previous tree 217 / 4579: +1 file, +28 tests — referral 21, client +5, api +1, referrer +1). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  16 passed (16)` · `Tests  430 passed | 15 skipped (445)` (unchanged).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build (`classes ok`: every class the new markup uses — `app-pre-referral`, `app-pre-referral-label`, `app-input`, `is-error`, `helper`, `error`, `app-pre-note` — is defined), the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 23 required modules; 84 markers (none in the off build, each in the on build); 9 strings and the decoder's instruction names stay in the off build`. `npm run csp` — `CSP ok` for `dist/app` and `dist-nopresale/app`; `npm run secrets` — exit 0. No root `src/`, no `core/` and no `web/` change: the root `tsc` / `jest` and web's `verify` are not this task's.

Playwright (this task changes #23 and #20): `npx playwright test e2e/presale.spec.ts e2e/presaleSwitch.spec.ts e2e/presaleOff.spec.ts e2e/presaleDapp.spec.ts e2e/visual-presale.spec.ts e2e/csp.spec.ts` — `24 passed (5.6m)` normally and `24 passed (5.6m)` under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'` (dry run, on the final commit's builds; B1d-1b's first-purchase rows — E2E 1 among them — go through #23a and now pass with the field on screen, empty). No E2E row names a referral address yet (E2E 12 is Task 6's).

**Visual check (dry run; shots kept in the scratchpad, never committed — Task 7 owns the committed shots).** A scratch spec in a scratch copy, at the popup's real 412 × 600 frame (each shot: `scrollWidth` 412, the sticky bar and its buttons wholly in view, CSP clean, contained), with the scratch copy's fake coordinator patched to apply `register_referrer` (two hunks, never committed; Task 6 builds it): #23a with the empty field; each line — Q46a (a non-address), Q46b (this account), Q46c (an address with no allocation) — the input bordered red, Buy disabled; an accepted address, Buy enabled; #20 with "Referred by" + Q47's note, and with an on-chain referrer (no note); back → #23 with the address in the field; Q48 after a purchase landed (the field gone, Q48 as the notice); an account with an on-chain referrer (no field). **Found and fixed in this task (the commit above is after the fix):** (1) Q45's placeholder in the mono face was cut off ("…who invited y") — the placeholder is words, now in the body face; (2) a 44-character address at #12's 14 px mono scrolled inside the 412 px field — the value is now 13 px / 20 px: a 43- and a 44-character address both fit whole (measured: the input's `scrollWidth` = `clientWidth` = 370). The CSS change re-ran the builds, the gates and both Playwright passes above.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1d-2 #23a's referral address and #20's Referred by — presale.view carries §2.5's referral {onChain, canRegister} (the popup parses it with exact keys and canRegister = firstPurchase and none on chain); the field (Q45, D8, undrawn: B1b's single-line input) only while canRegister; its line (Q46 a–c, Q48) only from presale.checkReferrer on blur — the newest check for the text as it still is — Buy disabled while a check is out or a line shows; an empty field is no referrer (B1d-1b's intent exactly); the text travels in intent.referrer and a refusal of it is its line, Q48 reading the view again and saying so as the field goes; checkReferrer answers referrer-invalid for any non-address string; #20 Referred by in groups of four with Q47's note only when this purchase registers it; the re-prepare and #23 again carry the registering address" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test file(s).** `RF` = `referral.test.tsx` (21), `CT` = `client.test.ts` (21), `AT` = `api.test.ts` (68), `BT` = `referrer.test.ts` (53), `PT` = `Presale.test.tsx` (43), `NP` = `check-no-presale.test.mjs` (52). Bold ids are the brief's eight pins.

| id | the change | named test → observed |
|---|---|---|
| F1 | **(shown only while canRegister)** `Presale.tsx`: `{v.referral.canRegister ? (` → `{v.referral.canRegister \|\| v.open ? (` | RF “not offered: an account that bought before; an allocation with a referrer on chain, bought or not (an on-chain referrer always wins)”; “a referrer on chain: no field on #23, and #20 shows that referrer without the note — nothing is registered”; the two Q48 rows — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  4 failed \| 17 passed (21)` |
| F2 | **(on-chain wins)** `api.ts`: `canRegister: snapshot.limits.firstPurchase && snapshot.allocation.referrer === null}` → `canRegister: snapshot.limits.firstPurchase}` | AT “B1d-2 (§2.5): the referral — the referrer on chain, and canRegister exactly for a first purchase without one”; RF “not offered: …” (the client refuses the inconsistent view, so #23 never opens) — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  2 failed \| 87 passed (89)` |
| F3 | `client.ts`: the pairing rule dropped: `if (onChain === undefined \|\| typeof r.canRegister !== 'boolean' \|\| r.canRegister !== (l.firstPurchase && onChain === null)) return undefined;` → `if (onChain === undefined \|\| typeof r.canRegister !== 'boolean') return undefined;` | CT “view: a referral of any other shape is failed — missing, an extra key, not an address, canRegister not a boolean, or canRegister other than …” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| L1 | **(the background's answer only)** `Presale.tsx`: the popup judges the text itself before asking — after `if (account === null \|\| entered === '') {…}` insert `if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(entered)) { setReferrerLine('referrer-invalid'); return; }` | RF “typing asks nothing; blur asks presale.checkReferrer once with what the field holds; until it answers no line shows and Buy waits; then the background’s line, Buy disabled”; “a stale answer never shows …” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 19 passed (21)` |
| L2 | **(on blur)** `Presale.tsx`: the check on every keystroke too: `onChange={e => editReferrer(e.target.value)}` → `onChange={e => { editReferrer(e.target.value); void checkReferrer(); }}` | RF “an edit clears the line; Buy is back with it”; “a stale answer never shows …” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 19 passed (21)` |
| L3 | **(Buy disabled while a line shows)** `Presale.tsx`: `&& referrerLine === null && !checking &&` → `&& !checking &&` | RF “typing asks nothing; blur asks …”; “each line from the background: Q46a, Q46b for this account and for another account of this wallet (only the background knows it), Q46c for an address with no allocation — Buy disabled while each shows”; “an edit clears the line; Buy is back with it”; “#23 again with the address and its refusal …” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  4 failed \| 17 passed (21)` |
| L4b | Buy not waiting for an answer still out: `&& referrerLine === null && !checking &&` → `&& referrerLine === null && (!checking \|\| checking) &&` | RF “typing asks nothing; blur asks presale.checkReferrer once …; until it answers no line shows and Buy waits; …” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| L5 | `api.ts`: Task 2's `malformed` for a non-address string: `if (!REFERRER.test(referrer)) return {ok: true, data: {ok: false, line: 'referrer-invalid'}};` → `if (!REFERRER.test(referrer)) return MALFORMED;` | BT “B1d-2 Task 3: whatever the field holds is the background’s to judge — not 32–44 base58 characters … → referrer-invalid, nothing read”; RF “typing asks nothing; blur asks …”; “an edit clears the line; Buy is back with it” (no Q46a) — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  3 failed \| 71 passed (74)` |
| L6 | Q48 from the check without the view read again: `    if (r.data === 'referrer-not-applicable') void read();⏎  };` → `  };` | RF “Q48 from the check — a purchase landed on chain since the view: the line, the view read again, then the field gone and Q48 said (never dropped in silence)” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| L7 | `client.ts` `referrerCheckOf` reads `{ok: true, …}` loosely: `if (exactly(o, ['ok'])) return o.ok === true ? null : undefined;` → `if (o.ok === true) return null;` | CT “referrerCheckOf: {ok: true} → null, {ok: false, line} → the line; anything else failed” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| E1 | **(empty = no referrer)** a blur on an empty field asks: `if (account === null \|\| entered === '') {⏎      setChecking(false);` → `if (account === null) {⏎      setChecking(false);` | RF “an address the purchase would register: no line, Buy enabled (positive control); a blur on an empty field asks nothing”; “an empty field is no referrer: B1d-1b’s intent exactly (no referrer key), the purchase registers nothing; spaces alone are empty too” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 19 passed (21)` |
| E2 | **(empty = no referrer)** Buy always sends the key: `...(entered === '' ? {} : {referrer: entered})}, carried.current` → `referrer: entered}, carried.current` | PT 6 of B1d-1b's Buy rows (“Buy → presale.prepareBuy with the amount and the stage the user saw …” among them: `referrer: ''` is `malformed`), RF “an empty field is no referrer …”, “refused at prepare …” — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  8 failed \| 56 passed (64)` |
| E3 | spaces not empty: `const entered = referrer.trim();` → `const entered = referrer;` | RF “an empty field is no referrer: … spaces alone are empty too” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| E4 | `client.ts` sends the key always: `...(intent.referrer === undefined ? {} : {referrer: intent.referrer})}` → `referrer: intent.referrer ?? null}` | CT “prepareBuy carries the referral address only when there is one — without one, B1d-1b’s intent exactly …”; “refusals come through typed …”; “prepareBuy carries a challenge id only when given one” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  3 failed \| 18 passed (21)` |
| S1 | **(an edit clears the line)** `editReferrer` without `setReferrerLine(null);` | RF “an edit clears the line; Buy is back with it”; “a stale answer never shows …”; “#23 again with the address and its refusal …” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  3 failed \| 18 passed (21)` |
| S2b | **(a stale answer never shows)** the newest-check guard disarmed: `if (!alive.current \|\| checkGeneration.current !== mine) return;` → `if (!alive.current \|\| (checkGeneration.current !== mine && mine < 0)) return;` | RF “a stale answer never shows: an older check answering after a newer one, and an answer landing after an edit” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| S3 | an edit does not retire the answer still out: `editReferrer` without its `checkGeneration.current += 1;` | RF “a stale answer never shows: … and an answer landing after an edit” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| T1 | **(travels in the intent)** the field dropped from the intent: `stage: open.state.stage, ...(entered === '' ? {} : {referrer: entered})}, carried.current` → `stage: open.state.stage, }, carried.current` | RF “the field’s value travels in the intent: presale.prepareBuy carries it, and the purchase the background prepared registers it”; both “refused at prepare …” rows — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  3 failed \| 18 passed (21)` |
| T2 | **(refused, not dropped)** prepare's `referrer-no-allocation` not the field's line: `if (isReferrerLine(r.error)) {` → `if (isReferrerLine(r.error) && r.error !== 'referrer-no-allocation') {` | RF “refused at prepare — its allocation gone since the check: Q46c under the field, nothing prepared, Buy disabled until edited” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| T3 | **(Q48 → the field disappears, said)** the clearing effect silent: `    setChecking(false);⏎    setNotice(REFERRER_LINE_TEXT['referrer-not-applicable']);` → `    setChecking(false);` | RF “Q48 from the check …”; “refused at prepare, never dropped — the purchase can no longer take it (bought since the check): nothing prepared, Q48, the view read again, the field gone” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 19 passed (21)` |
| T4 | prepare's Q48 without the view read again: `      setReferrerLine(r.error);⏎      if (r.error === 'referrer-not-applicable') void read();⏎      return;` → `      setReferrerLine(r.error);⏎      return;` | RF “refused at prepare, never dropped — …: nothing prepared, Q48, the view read again, the field gone” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| T5 | a failed check shows a line (and so holds Buy): before `setNotice(checkFailedText(r.error));` insert `setReferrerLine('referrer-invalid');` | RF “a check that fails (the presale unreadable) says so, shows no line and holds nothing: prepare decides again” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| D1 | **(the note only when it registers)** `PresaleConfirm.tsx`: `{view.referrer.registers ? <span …` → `{view.referrer.address !== '' ? <span …` | RF “a referrer on chain: no field on #23, and #20 shows that referrer without the note — nothing is registered” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| D2 | the note never: `{view.referrer.registers ? <span …` → `{view.referrer.registers && view.referrer.address === '' ? <span …` | RF “a purchase that registers its referrer: “Referred by” after To, the whole address in groups of four, then Q47’s note; every class styled”; “the quote’s end: the re-prepare carries the referral address …” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 19 passed (21)` |
| D3 | the row hidden for a registration: `{view.referrer === null ? null : (` → `{view.referrer === null \|\| view.referrer.registers ? null : (` | RF the same two rows as D2 — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 19 passed (21)` |
| D4 | **(the whole address in groups of four)** `<AddressGroups address={view.referrer.address} />` → `<AddressGroups address={`${view.referrer.address.slice(0, 4)}…${view.referrer.address.slice(-4)}`} />` | RF “a purchase that registers its referrer …”; “a referrer on chain …”; “the quote’s end …” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  3 failed \| 18 passed (21)` |
| D5 | **(on-chain → shown without the note)** no row at all: `{view.referrer === null ? null : (` → `{view.referrer === null \|\| view.referrer.address !== '' ? null : (` | RF the three rows of D4 — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  3 failed \| 18 passed (21)` |
| K1 | **(never dropped)** #20's re-prepare without the address: `stage: v.stage, ...registering(v)}, v.reauth?.challengeId);` → `stage: v.stage}, v.reauth?.challengeId);` | RF “the quote’s end: the re-prepare carries the referral address and the challenge — the fresh purchase registers it too” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| K2 | #23 again without the address: `challengeId: v.reauth?.challengeId ?? null, ...registering(v)});` → `challengeId: v.reauth?.challengeId ?? null});` | RF “back → #23 with the address it registers; an on-chain referrer is not carried (it is no input)”; “refused at the signature — its allocation gone since the review: kept (C29), #23 with the address and the code; nothing signed” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 19 passed (21)` |
| K3 | an on-chain referrer carried as input: `(v.referrer?.registers === true ? {referrer: v.referrer.address} : {})` → `(v.referrer !== null ? {referrer: v.referrer.address} : {})` | RF “back → #23 with the address it registers; an on-chain referrer is not carried (it is no input)” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| K4 | the signature's referrer refusals not kept: `      case 'referrer-self':⏎      case 'referrer-no-allocation':⏎        // Kept (C29)` → `        // Kept (C29)` | RF “refused at the signature — its allocation gone since the review: kept (C29), #23 with the address and the code; nothing signed” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| K5 | #23 again forgets the address: `useState(again?.referrer ?? '')` → `useState(again === null ? '' : '')` | RF “#23 again with the address and its refusal: the field holds it, the line under it, Buy disabled; a route naming a non-address is not #23” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| K6 | `routes.tsx` takes any string: `typeof o.referrer === 'string' && ADDRESS.test(o.referrer)` → `typeof o.referrer === 'string'` | RF the same row as K5 — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 20 passed (21)` |
| G1 | `MARKERS` without Q45's label: `  'Referral address (optional)',` → (removed) | NP “armed by B1d-1b: … B1d-2 Task 1 …, Task 2 …, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48)” — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |

34 mutations, all red, every one compiling. **Two mutants of the first sweep did not compile** (judged INVALID, never counted): removing `&& !checking` whole left `checking` unread, and removing the generation comparison whole left `mine` unread (`noUnusedLocals`) — L4b and S2b keep the binding and defeat the check with a condition that never holds (`!checking || checking`, `mine < 0`).

#### Notes for the executor (Task 3)

- **Ruling: `presale.checkReferrer` answers `referrer-invalid` for any string that is not 32–44 base58 characters** (Task 2's handler called it `malformed`) — why: §3.5 lists "not 32 bytes of base58" as `referrer-invalid`, and C3 forbids the popup to judge the text; with `malformed` the popup would have had to pre-filter (L1 is exactly that mutant) or map `malformed` to Q46a. Still behind the session check, nothing decoded or read; `malformed` stays for a non-string, `null`, an absent referrer, an extra key or a non-address account. `presale.prepareBuy`'s strict payload (§1.4) is unchanged — cost if wrong: none (two of Task 2's rows rewritten, L5).
- **Ruling: Buy also waits while a check is out** (§3.5 says only "while it shows") — why: a click right after typing blurs the field first; without the hold the prepare would race the line, and a non-address would reach prepare as `malformed` (Q11). With it the click lands on a disabled button and the user taps again once the answer is there — cost if wrong: one round trip before Buy (L4b).
- **Ruling: the field's text is trimmed; spaces alone are empty (no referrer)** — base58 has no spaces; a pasted address often carries a newline — cost if wrong: none (E3).
- **Ruling: what the field holds travels whenever it is not empty — never filtered by `canRegister` in the popup** — so no client path can drop it silently; instead, whenever the open view says `canRegister: false` while the field holds text (prepare's or the check's Q48 re-read, or the 25 s re-read finding a purchase or a referrer landed), the text is cleared and Q48 is said as #23's notice (§5: "Q48; the view re-read (the field disappears)") — cost if wrong: none (T3, T4, L6).
- **Ruling: a failed check (`presale-unavailable`, `coordinator-refused`) shows Q11 / Q12 as #23's notice, no line, and does not hold Buy** — prepare re-checks and refuses with the same code if the read still fails; a line would have stuck Buy until another blur — cost if wrong: one prepare that fails the same way (T5).
- **Ruling: the field is `.app-input` (B1b's address-book input) with an `.noc-overline` label, not `.input`** — §4.1 names `.input`, but in the extension `.input` exists only screen-scoped in `design-ext.css` (`.s-send .recipient-row .input`, `.s-pre .input-card .input` — the amount's 28 px), so no generic `.input` is B1b's single-line style; `.app-input` is (the contact sheet's address field, same label pattern). The value in the mono face at **13 px / 20 px** (#12's recipient is 14 px; at 14 px a 44-character address scrolled in the 412 px popup — the visual check), the placeholder (Q45, words) in the body face (in mono it was cut off). Stated for rev 3.4 — cost if wrong: a restyle in Task 7's visual pass.
- **Ruling: Q47's note sits inside "Referred by"'s value on #20** (a caption under the address, `--fg-secondary`, wrapping between words), not as its own row as Task 2 drew it on #10 — #20's `.detail-row` grid has a label column the note does not belong in — cost if wrong: one visual call.
- **Ruling: `PresaleAgain.referrer` carries only an address the purchase registers** (`registering(v)`): back / Esc / a kept refusal put it back in #23's field, and #20's quote re-prepare sends it (K1–K3); an on-chain referrer is never input (sending it would be refused `referrer-not-applicable`). `BUY_REFUSALS` gains the signature's `referrer-self` / `referrer-no-allocation`, kept (C29) → #23 with the address and its line (K4).
- **Deviation (stated loudly): #44's / #54's [Try again] (`records.ts`) do not restore the referral address** — a record's `referrer` is the *effective* referrer and does not say whether the purchase registered it or credited an on-chain one; restoring an on-chain one would only produce Q48. After a failed registering purchase the user sees #23 with the field empty (shown — the registration never happened, `canRegister` is still true) and enters it again. Nothing is dropped silently: the field is visibly empty. Task 7 lists it in rev 3.4.
- **Not a marker: Q46a** ("Not a valid Solana address") is a prefix of B1b's #12 line "Not a valid Solana address — check length & characters", which both builds carry; the other four new strings are (`MARKERS` 79 → 84, G1).
- **The ledger MUST is met:** `presale.view`'s open variant carries `referral: {onChain, canRegister}` (`canRegister = firstPurchase && onChain === null`, F2) and the popup's parser takes exactly that pairing (F3) — a view naming an on-chain referrer while offering the field, or offering it on a repeat purchase, is not the background's and fails closed.
- **For the next tasks:** Task 6 — E2E 12 drives `#presale-referrer` (`fill`, `blur`), reads `.app-pre-referral .helper` and #20's `.detail-row` "Referred by" (`.addr-groups`, `.app-pre-note`); the fake program must apply `register_referrer` — the scratch patch that sufficed for the visual check: in `purchaseIn`, the presale-program instruction of 40 data bytes that is not a purchase is the registration (its bytes 8–40 the referrer, carried in the effect); in `purchaseAccounts`, the new allocation keeps `before`'s bytes 84–116 and takes the registered referrer there; plus the referrer's own allocation seeded in `fake.presale.accounts`. B1d-1b's first-purchase E2E rows already go through #23a with the field present and empty (24 passed, both modes). Task 7 — rev 3.4's lines from this task: `checkReferrer` judges any string; Buy waits while a check is out; the trim; a failed check's notice; `.app-input` at 13 px and the placeholder's face; Q47's note inside #20's value; Try again not restoring the address; Q46a not a marker. Shots for §6.4: the field with each line and #20 with "Referred by" (the scratch shots of this dry run show the layout fits 412 × 600 with no horizontal scroll).
- **Dry run:** clone `dry/b1d2`, commit `6c3ea11` on Task 2's `14cb89b` (one commit; amended once in the dry run for the two visual findings above — the suite, builds, gates and both Playwright passes re-ran on the amended commit). The diffs above were re-applied with `git apply --recount` to a `git archive 14cb89b` copy, plus the new test file: the result is byte-identical to `6c3ea11`'s `extension/`. Every red/green total above is observed; `referral.test.tsx` ran 3 × green in a row before the commit (no flake; the stale-answer rows wait on the background's own in-flight calls, `drainInFlight`, not on the clock).
- **Seen at the plan's assembly (2026-10-26), not fixed — for review:** on the rebuilt 49cc8f0, one whole-suite run made beside three other vitest runs failed one row of `referral.test.tsx`, "refused at prepare, never dropped — the purchase can no longer take it …": `.banner .banner-title` was `undefined`, not Q48, at the assertion after `waitFor(() => expect(field()).toBeNull())`. The same tree's quiet re-run was green (218 / 4607), and the file alone on 6c3ea11 passed 10 of 10. Likely an ordering race in the row itself — it waits for the field to go, then reads the banner synchronously, and the view re-read can remove the field before the Q48 notice renders. Under the standing rule a flake is a finding: if it recurs during execution, the fix is to wait on Q48's banner and then assert that the field is gone. Do not add a timeout.

---

### Task 4: #24 referral and the #31 row "Refer a friend" — `presale.referral` → §3.5's `ReferralView {link, earnedBase, referrals, referredCents}` (the link whole from core's `buildReferralLink`; EARNED the account's allocation's `referral_bonus_tokens` read from chain, never the coordinator's figure, no allocation = 0; REFERRALS and REFERRED from `GET /referral-stats/<address>` through the shared latch, read strictly — a missing figure is no figure, never core's 0 — the dollars made whole cents in the background; each source failing nulls only its own fields, shown "—"); #24 as drawn and as the app corrected it (three stat cards, the code card with the whole link in `.noc-mono`, "Used by N people" / "Used by 1 person" / "Not used yet" — the count is people (D27) — hidden while REFERRALS has no source, Copy and "Share invite link" both copying the link through one `useCopy` — 24a-bis's checkmark and `--accent` border while copied, no toast, "Copy failed" never the checkmark — Q39's banner, the legalese); the route `referral` (never TAB_ONLY) pushed by #31's "Refer a friend" row in its own "Rewards" group, on the build with presale only (`presaleSlots.settings`; gate markers)

**Spec:** B1d §1.1 ("Off build behaviour: … no #31 'Refer a friend' row"; the slots `presaleSlots` carry "#31 row"), §1.2 (`referral.ts`: "#24's data"), §1.4 (`presale.referral` `{account}` → `ReferralView`; strict payload, session), §3.5 "#24's data" ("`link` = `buildReferralLink(account)` …; `earnedBase` = the allocation's `referral_bonus_tokens` from chain (the coordinator reports 0 for a chain-credited bonus …); `referrals` and `referredCents` from `GET /referral-stats/<address>` (`fetchReferralStats`; aggregate only; USD converted to cents at this edge). A source that fails gives `null` for its own fields only, shown '—'. No stat without a source (approved)."), §4 (the route `referral`, through `presaleRoutes`), §4.4 (all), §5 (`coordinator-refused`: "never retried inside the cool-down; one shared latch"), §6.1 "Screens … #24 (populated, nulls, copied with the checkmark, copy failed)", §6.2 (`ON_BUILD` "2 adds … `core/referral/index.ts`"; `MARKERS` "the route names … `referral` … 'Refer a friend'"), §6.4 (#24 populated, empty, a null stat, copied), §9's #24 rows, §10 Q35–Q39; C1, C3, C15, C16; D4, D13. Brief item 4 and "Carried from B1d-1b" (`ON_BUILD`, `MARKERS`, both builds, 412 × 600, Playwright normally and under `unshare -rn`). The design `/home/user/Downloads/index.html` #24 (ix 10903-11233: 24a, 24a-bis, 24b; its CSS ix 2799-2929) and #31 (the Settings rows). The coordinator's `getReferralStats` (READ-ONLY ICO checkout, coordinator main 9e7d468: `src/db/postgres.js:998-1047`, the route `src/api/server.js:2080-2094`) compared with core's `fetchReferralStats` (`core/referral/index.ts`) — findings in the writer notes. The app's `src/screens/referral/ReferralScreen.tsx` (C1) and `src/screens/settings/SettingsScreen.tsx` (its "Rewards" section). Previous parts: Tasks 1–3 (consumed: `deps.ts`'s `createJsonGetter` / the shared latch beside Task 1's `postJson`; `allocationFacts` of `state.ts`; Task 3's `PresaleView.referral` type, renamed here).

**Files:**
- Create: `extension/src/background/presale/referral.ts` (`ReferralView`, `referralStatsFrom`, `referralView`), `extension/src/app/presale/ReferFriend.tsx` (#24)
- Modify: `extension/src/background/deps.ts` (`WalletDeps.getJson`, `browserDeps` through the shared latch), `extension/src/background/presale/api.ts` (`presale.referral`; Task 3's `ReferralView` → `ReferralState`), `extension/src/app/presale/client.ts` (`ReferralData`, `referralDataOf`, `PresaleClient.referral`), `extension/src/app/presale/text.ts` (`REFER_TEXT`, `earnedText`, `referredText`, `countText`), `extension/src/app/presale/routes.tsx` (`REFERRAL_ROUTE`), `extension/src/app/presale/index.ts`, `extension/src/app/presale/records.ts` (`settings` slot), `extension/src/app/router.ts` (`PresaleSlots.settings`), `extension/src/app/screens/Settings.tsx` (the row, `onRoute`), `extension/src/app/App.tsx`, `extension/src/app/ui/ExtIcon.tsx` (`share`, #i-share), `extension/src/app/app.css` (#24's inline styles and two visual fixes)
- Modify (generated): `extension/scripts/extract-design-css.mjs` (`.s-ref`), `extension/src/styles/design-ext.css` (re-extracted, never edited)
- Modify (the gate's staged lists): `extension/scripts/check-no-presale.mjs` (`ON_BUILD` 23 → 26: `presale/referral.ts`, `core/referral/index.ts`, `ReferFriend.tsx`; `MARKERS` 84 → 96)
- Create (tests): `extension/src/background/presale/__tests__/referral.test.ts`, `extension/src/app/presale/__tests__/ReferFriend.test.tsx`, `extension/src/app/__tests__/settingsPresale.test.tsx` (both vitest runs)
- Modify (tests): `extension/src/background/__tests__/deps.test.ts`, `extension/src/background/__tests__/fakeDeps.ts`, `extension/src/app/presale/__tests__/client.test.ts`, `extension/src/app/__tests__/Settings.test.tsx`, `extension/src/app/__tests__/router.test.ts`, `extension/src/background/__tests__/messages.test.ts`, `extension/src/background/presale/__tests__/api.test.ts`, `extension/src/__tests__/presaleSwitch.test.ts`, `extension/src/__tests__/designExt2b.test.ts`, `extension/scripts/__tests__/check-no-presale.test.mjs`, `extension/vitest.nopresale.config.ts`, `extension/e2e/visual.spec.ts` (#31's on-build row list)

**Interfaces:**
- Consumes: Task 1's `WalletDeps` / `browserDeps` (one `createForbiddenLatch` per background instance shared by the RPC, the broadcast route, `createJsonGetter` and `createJsonPoster`); `allocationFacts(account, owner)` (`state.ts`, rule 6: absent → `exists: false`, totals 0; the program's PresaleAllocation of that very owner → its facts, `bonusBase` = `referral_bonus_tokens@76`; anything else null); `derivePresalePdas` (`core/presale/allocation.ts`); `buildReferralLink` (`core/referral/index.ts`, unchanged); `accountOnly` / `guarded` / `PRESALE_MESSAGE_TYPES` (`api.ts`); `presaleRoutes` / `presaleSlots` / `PresaleRoute` / `PresaleNav` / `presaleNav` (`router.ts`, `App.tsx`); `useCopy` (B1b), `TopBar`, `SkelLine`, `ExtIcon`, `ListRow` (rule 6); `PRESALE_TEXT.unavailable` (Q11). Tests: `chain.ts` (`allocationData({bonus})`, `chainMap`, `chainReader`), `world.ts`'s `purchaseWorld`, `harness.tsx`'s `renderInWallet` / `drainInFlight` / the `gate` option, `appHarness.tsx`'s `renderApp` (`spy`), `styled.ts`'s `unstyledClasses`.
- Produces (`extension/src/background/deps.ts`): `WalletDeps.getJson(path: string): Promise<unknown>` — a bare path under `API_BASE`, through the shared latch (`createJsonGetter`): a 200's body as it is; any other status `RpcHttpError`; a 403 `RpcForbidden` (the latch trips: every coordinator route of the instance cools down); during the cool-down `RpcCoolingDown`, nothing sent. Both builds (generic, like `postJson`). `fakeDeps` throws `unexpected GET <path>` unless a test overrides it.
- Produces (`extension/src/background/presale/referral.ts`):
  ```ts
  export interface ReferralView {link: string; earnedBase: string | null; referrals: string | null; referredCents: string | null}
  export function referralStatsFrom(body: unknown): {referrals: bigint; referredCents: bigint} | null;  // {success: true, data: {totalReferrals: safe int ≥ 0, totalReferredUsd: finite ≥ 0}}; cents = Math.round(usd × 100), a safe integer; else null
  export async function referralView(deps: WalletDeps, account: string): Promise<ReferralView>;      // one getAccountsData([allocation PDA]) and one getJson(`/referral-stats/${account}`), side by side, each failing alone
  ```
- Produces (`extension/src/background/presale/api.ts`): `presale.referral {account}` → `{ok: true, data: ReferralView}`; `malformed` (an extra key, a non-address account), `locked`, `unknown-account`; never `failed` for a source that failed (its fields are null). `PRESALE_MESSAGE_TYPES` gains `'presale.referral'` (11 types). Task 3's `export interface ReferralView {onChain, canRegister}` is renamed **`ReferralState`** (§3.5's name is #24's; nothing outside `api.ts` named it).
- Produces (`extension/src/app/presale/client.ts`):
  ```ts
  export interface ReferralData {link: string; earnedBase: bigint | null; referrals: bigint | null; referredCents: bigint | null}
  export function referralDataOf(x: unknown, account: string): ReferralData | undefined;  // exactly four keys; link === buildReferralLink(account); each figure a decimal string or null
  // PresaleClient: referral(account: string): Promise<Reply<ReferralData, SessionRefusal>>
  ```
- Produces (`extension/src/app/presale/text.ts`): `REFER_TEXT` (`group` "Rewards", `title` "Refer a friend", the three labels and subs — Q35 "total joined", "NOC lifetime", Q36 "from your invites" — `eyebrow` Q37, `usedLead` "Used by " / `usedTail(n)` (" person" for 1, else " people"), `notUsed`, `copy` "Copy invite link", `copied` / `copyFailed` Q38, `share`, `banner` Q39, `legalese`, `none` "—"); `earnedText(base)` (NOC to one place, floored: "32.4", "0.0"), `referredText(cents)` ("$1,234.56", bigint only), `countText(n)` (grouped).
- Produces (`extension/src/app/router.ts`): `PresaleSlots.settings: {group: string; title: string; route: PresaleRouteValue}` — #31's row into the entry's own screen; the build without presale has no slots, so no row.
- Produces (`extension/src/app/presale/routes.tsx`): `REFERRAL_ROUTE` — `{screen: 'referral'}` exactly, rendering `<ReferFriend onBack={nav.pop} />`; `presaleRoutes` = `[presale, presale-confirm, geo, referral]`.
- Produces (`extension/src/app/screens/Settings.tsx`): the prop `onRoute: (route: PresaleRouteValue) => void` (App pushes it through `presaleNavigation`).
- DOM (for Task 6's E2E 11 and Task 7's shots): #31's row `.s7-row .s7-title` "Refer a friend" under `.s7-group-label` "Rewards" (after Connections); #24 is `.screen.s-ref`: `.stats .stat` × 3 (`.lbl.noc-overline`, `.val.noc-balance-md.noc-numeral` — `.acc` for EARNED > 0, `.app-ref-muted` for EARNED 0 or "—" — `.lbl.noc-caption`), `.code-card .lbl-row .uses` ("Used by N people" / "Used by 1 person" / "Not used yet", absent while REFERRALS is null), `.code-card .code-row .code.noc-mono` (the link), `.code-row.app-ref-copied` while copied, `.actions button` (aria-label "Copy invite link" / "Copied" / "Copy failed"), `.share-btn` (its label the state), `.banner.shield.app-ref-banner`, `.legalese`. A failed reply: no `.code-card`, Q11 as `p[role=alert]`.

**What #24 shows and why (§3.5, §4.4, C1, C3).** The background reads, the popup renders. **EARNED** is the chain's: the account's `["allocation", account]` PDA read once (`getAccountsData`), parsed by rule 6 for this very owner — `referral_bonus_tokens` is what the program credited to this account as a referrer; no allocation on chain is 0 earned (a chain answer, 24b's "0.0"); a read that fails, a short answer, a foreign or malformed account is null ("—"). The coordinator's `totalBonusNoc` / `totalBaseBonusNoc` are never read (it reports 0 for a chain-credited bonus). **REFERRALS and REFERRED** are `/referral-stats`'s `totalReferrals` and `totalReferredUsd`, through the shared latch: a 403 trips it (every coordinator route of the instance cools down) and the next #24 inside the cool-down sends no GET — "—" until it ends; a 500, a 429, a timeout, a body without `success: true`, or either figure missing or ill-typed → both null (one answer, both figures). The dollars are whole cents here (`Math.round(usd × 100)`: the coordinator sums dollars as a double, 0.29 is 0.28999…); the popup formats bigints only. **"Used by N people" / "Used by 1 person" / "Not used yet"** (N = REFERRALS, which counts the people who bought through the link, not its uses — controller ruling, owner-delegated copy D27, a departure from the design's "Used N times") — hidden while REFERRALS has no source. **The link** is the account's, whole (68 characters, 13 px mono, broken anywhere — never shortened): the popup refuses a reply whose link is not `buildReferralLink(account)` for the account it asked about. **Copy and "Share invite link"** (C15) both write the link through one `useCopy`: while it says `copied` (its 2 s) the code row carries the `--accent` border and the Copy icon is the checkmark (24a-bis), the share button reads Q38's "Copied"; "Copy failed" shows the close glyph, no border. No toast, no countdown (no `clipboardWrite`, B1 §4). **Omitted (§9):** ACTIVE "staking now" (REFERRED in its place), "Recent rewards" with its rows and "View all", 24b's rewards empty state, the toast, "YOUR CODE"'s HMAC code. **#31:** the presale entry's slot adds "Refer a friend" (#i-users) in a "Rewards" group after Connections (the app's section) — a LockedButton row (rule 6) pushing `{screen: 'referral'}`; shared code names neither the words nor the route, so the build without presale has neither (its stub has no slots).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/presale/__tests__/referral.test.ts` (`presale.referral` through the real background's message handler; the GET is the test's own function and the global fetch throws):

```ts
import {PublicKey} from '@solana/web3.js';
import {registerPresale} from '../api';
import {referralStatsFrom} from '../referral';
import {handleMessage, registerPresaleHandler} from '../../messages';
import {createJsonGetter} from '../../deps';
import {fakeDeps} from '../../__tests__/fakeDeps';
import {fakeExt} from '../../__tests__/fakeExt';
import {RECIPIENT, unlocked} from '../../__tests__/fixtures';
import {derivePresalePdas} from '../../../../../core/presale/allocation';
import {FORBIDDEN_COOLDOWN_MS, RequestUnreachable, RpcHttpError, createForbiddenLatch, type AccountData} from '../../../../../core/solana/rpc';
import {ACCOUNT, NOW_MS, allocationData, chainMap, chainReader, program, type Chain} from './chain';

// B1d §3.5 "#24's data", §4.4 (C1, D4; §1.4 presale.referral): #24's ReferralView through the real background's message
// handler — the link whole; EARNED from the chain allocation's referral_bonus_tokens, never the coordinator's figure;
// REFERRALS and REFERRED from GET /referral-stats/<address>, read strictly, the dollars made cents here; each source
// failing alone nulls only its own fields; a 403 trips the shared latch. No test reaches the network: every GET is the
// test's own function, and the global fetch throws.
registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

const EXT = fakeExt();
const POPUP = {id: EXT.runtimeId, origin: EXT.extensionOrigin, url: `${EXT.extensionOrigin}/popup.html`};
const LINK = `https://noc-tura.io?ref=${ACCOUNT}`;
const ALLOCATION = derivePresalePdas(new PublicKey(ACCOUNT)).userAllocation.toBase58();
/** The coordinator's answer as postgres.js getReferralStats builds it (coordinator main 9e7d468): every key it sends. */
const STATS = {totalReferrals: 3, totalReferredPurchases: 5, totalBaseBonusNoc: 999, totalExtraBonusNoc: 0, totalBonusNoc: 999, totalReferredNoc: 8_000, totalReferredUsd: 1234.56, tierBonusCount: 0};
const body = (data: unknown = STATS) => ({success: true, data});

interface World {
  deps: ReturnType<typeof fakeDeps>;
  reads: string[][];
  gets: string[];
}
function world(o: {chain?: Partial<Chain>; get?: (path: string) => Promise<unknown>; read?: () => Promise<(AccountData | null)[]>} = {}): World {
  const reads: string[][] = [];
  const gets: string[] = [];
  const chain = chainMap(o.chain);
  const read = o.read;
  const reader = chainReader(chain, reads, read === undefined ? {} : {getAccountsData: async addresses => (reads.push([...addresses]), read())});
  const deps = fakeDeps({
    reader,
    getJson: async path => {
      gets.push(path);
      return o.get === undefined ? body() : o.get(path);
    },
  });
  deps.clock.t = NOW_MS;
  return {deps, reads, gets};
}
async function ask(w: World, msg: Record<string, unknown> = {type: 'presale.referral', account: ACCOUNT}) {
  const ext = fakeExt();
  await unlocked(ext);
  return handleMessage(ext, msg, POPUP, w.deps);
}
/** An allocation of ACCOUNT that earned `bonus` (its referral_bonus_tokens). */
const earned = (bonus: bigint): Partial<Chain> => ({allocation: program(allocationData({bonus}))});

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('a test reached for the network');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('presale.referral (§1.4, §3.5)', () => {
  it('populated: the link whole, EARNED from the chain, REFERRALS and REFERRED from /referral-stats — one read of the allocation, one GET of the address', async () => {
    const w = world({chain: earned(16_142_571_618n)});
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: '16142571618', referrals: '3', referredCents: '123456'}});
    expect(w.reads).toEqual([[ALLOCATION]]);
    expect(w.gets).toEqual([`/referral-stats/${ACCOUNT}`]);
  });

  it('EARNED is the allocation’s referral_bonus_tokens — never the coordinator’s bonus figures, which move nothing (and the chain’s does)', async () => {
    const a = await ask(world({chain: earned(7n), get: async () => body({...STATS, totalBaseBonusNoc: 5, totalExtraBonusNoc: 6, totalBonusNoc: 11})}));
    const b = await ask(world({chain: earned(7n), get: async () => body({...STATS, totalBaseBonusNoc: 0, totalExtraBonusNoc: 0, totalBonusNoc: 0})}));
    const c = await ask(world({chain: earned(8n)}));
    expect([a, b]).toEqual([
      {ok: true, data: {link: LINK, earnedBase: '7', referrals: '3', referredCents: '123456'}},
      {ok: true, data: {link: LINK, earnedBase: '7', referrals: '3', referredCents: '123456'}},
    ]);
    expect(c).toEqual({ok: true, data: {link: LINK, earnedBase: '8', referrals: '3', referredCents: '123456'}});
    // Not the account's own purchases either: total_tokens is not the referral bonus.
    expect(await ask(world({chain: {allocation: program(allocationData({bonus: 0n, totalTokens: 5_000_000_000n}))}}))).toEqual({ok: true, data: {link: LINK, earnedBase: '0', referrals: '3', referredCents: '123456'}});
  });

  it('24b: no allocation on chain earned nothing ("0", not "—"); a coordinator that counts nothing answers zeros', async () => {
    const zeros = {...STATS, totalReferrals: 0, totalReferredPurchases: 0, totalBaseBonusNoc: 0, totalBonusNoc: 0, totalReferredNoc: 0, totalReferredUsd: 0};
    expect(await ask(world({chain: {allocation: null}, get: async () => body(zeros)}))).toEqual({ok: true, data: {link: LINK, earnedBase: '0', referrals: '0', referredCents: '0'}});
  });

  it('/referral-stats failing alone (500, 429, a timeout, a 403) nulls REFERRALS and REFERRED only; EARNED stays', async () => {
    for (const e of [new RpcHttpError('/referral-stats', 500), new RpcHttpError('/referral-stats', 429), new RequestUnreachable('/referral-stats', 'no answer within 20000 ms; aborted')]) {
      const w = world({chain: earned(16_142_571_618n), get: async () => Promise.reject(e)});
      expect([e.message, await ask(w)]).toEqual([e.message, {ok: true, data: {link: LINK, earnedBase: '16142571618', referrals: null, referredCents: null}}]);
    }
  });

  it('the chain read failing alone (a throw, a short answer, a foreign or malformed allocation) nulls EARNED only; the stats stay', async () => {
    const stats = {link: LINK, earnedBase: null, referrals: '3', referredCents: '123456'};
    expect(await ask(world({read: async () => Promise.reject(new RequestUnreachable('/rpc', 'down'))}))).toEqual({ok: true, data: stats});
    expect(await ask(world({read: async () => []}))).toEqual({ok: true, data: stats});
    expect(await ask(world({chain: {allocation: program(allocationData({user: RECIPIENT}))}}))).toEqual({ok: true, data: stats});
    expect(await ask(world({chain: {allocation: program(allocationData({length: 100}))}}))).toEqual({ok: true, data: stats});
    expect(await ask(world({chain: {allocation: {...program(allocationData()), owner: RECIPIENT}}}))).toEqual({ok: true, data: stats});
  });

  it('both failing: every figure null, the link still whole', async () => {
    const w = world({read: async () => Promise.reject(new Error('down')), get: async () => Promise.reject(new RpcHttpError('/referral-stats', 503))});
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: null, referrals: null, referredCents: null}});
  });

  it('strict payload: {account} only, an address in the unlocked session', async () => {
    for (const m of [{type: 'presale.referral'}, {type: 'presale.referral', account: 'nope'}, {type: 'presale.referral', account: ACCOUNT, extra: 1}]) expect(await ask(world(), m)).toEqual({ok: false, error: 'malformed'});
    const w = world();
    expect(await handleMessage(fakeExt(), {type: 'presale.referral', account: ACCOUNT}, POPUP, w.deps)).toEqual({ok: false, error: 'locked'});
    expect(await ask(w, {type: 'presale.referral', account: RECIPIENT})).toEqual({ok: false, error: 'unknown-account'});
    expect([w.reads, w.gets]).toEqual([[], []]);
  });
});

describe('referralStatsFrom: no stat without a source', () => {
  it('reads totalReferrals and totalReferredUsd; the dollars become whole cents here (0.29 → 29, never 28)', () => {
    expect(referralStatsFrom(body())).toEqual({referrals: 3n, referredCents: 123_456n});
    expect(referralStatsFrom(body({...STATS, totalReferredUsd: 0.29}))).toEqual({referrals: 3n, referredCents: 29n});
    expect(referralStatsFrom(body({...STATS, totalReferredUsd: 19_696.72}))).toEqual({referrals: 3n, referredCents: 1_969_672n});
    expect(referralStatsFrom(body({...STATS, totalReferredUsd: 0}))).toEqual({referrals: 3n, referredCents: 0n});
    // Only the two it reads: the coordinator's other keys, present or not, change nothing (C34's rule for the gate's bodies).
    expect(referralStatsFrom(body({totalReferrals: 1, totalReferredUsd: 25}))).toEqual({referrals: 1n, referredCents: 2_500n});
  });

  it.each([
    ['not an object', 'ok'],
    ['null', null],
    ['no success', {data: STATS}],
    ['success false', {success: false, data: STATS}],
    ['success a string', {success: 'true', data: STATS}],
    ['no data', {success: true}],
    ['data null', {success: true, data: null}],
    ['totalReferrals missing (core would say 0)', body({...STATS, totalReferrals: undefined})],
    ['totalReferredUsd missing (core would say 0)', body({...STATS, totalReferredUsd: undefined})],
    ['totalReferrals a string', body({...STATS, totalReferrals: '3'})],
    ['totalReferrals negative', body({...STATS, totalReferrals: -1})],
    ['totalReferrals a fraction', body({...STATS, totalReferrals: 2.5})],
    ['totalReferredUsd a string', body({...STATS, totalReferredUsd: '1234.56'})],
    ['totalReferredUsd negative', body({...STATS, totalReferredUsd: -0.01})],
    ['totalReferredUsd beyond whole cents a double holds', body({...STATS, totalReferredUsd: 1e17})],
  ])('%s → null (no figure), never 0', (_name, b) => {
    expect(referralStatsFrom(b)).toBeNull();
  });
});

describe('a 403 on /referral-stats trips the shared latch (§5: never retried inside the cool-down)', () => {
  it('the 403 nulls the stats; the next #24 within the cool-down sends no GET; after it, the GET goes again', async () => {
    const urls: string[] = [];
    const clock = {t: NOW_MS};
    const latch = createForbiddenLatch({now: () => clock.t});
    let status = 403;
    const get = createJsonGetter(async url => (urls.push(url), {status, json: async () => body()}), latch);
    const w = world({chain: earned(9n), get: path => get.get<unknown>(path)});
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: '9', referrals: null, referredCents: null}});
    status = 200;
    clock.t += FORBIDDEN_COOLDOWN_MS - 1;
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: '9', referrals: null, referredCents: null}});
    expect(urls).toHaveLength(1);
    clock.t += 1;
    expect(await ask(w)).toEqual({ok: true, data: {link: LINK, earnedBase: '9', referrals: '3', referredCents: '123456'}});
    expect(urls).toEqual([`https://api.noc-tura.io/api/v1/referral-stats/${ACCOUNT}`, `https://api.noc-tura.io/api/v1/referral-stats/${ACCOUNT}`]);
  });
});
```

Create `extension/src/app/presale/__tests__/ReferFriend.test.tsx` (#24 against the REAL background, every state of §6.1 and §6.4):

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, render, screen} from '@testing-library/react';
import {drainInFlight, renderInWallet} from '../../__tests__/harness';
import {ReferFriend} from '../ReferFriend';
import {REFERRAL_ROUTE} from '../routes';
import {earnedText, referredText} from '../text';
import {ExtIcon} from '../../ui/ExtIcon';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../../__tests__/styled';
import {registerPresale} from '../../../background/presale/api';
import {registerPresaleHandler} from '../../../background/messages';
import {fakeDeps} from '../../../background/__tests__/fakeDeps';
import {fakeExt} from '../../../background/__tests__/fakeExt';
import {ACCOUNT, allocationData, program, type Chain} from '../../../background/presale/__tests__/chain';
import {RpcHttpError, type AccountData} from '../../../../../core/solana/rpc';
import {purchaseWorld} from './world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 4 (§3.5, §4.4, C1, C15; index.html #24 ix 10903-11233; Q35–Q39): #24 against the REAL background —
// presale.referral over chain.ts's allocation and a /referral-stats answer that is the test's own function (the global
// fetch throws: nothing reaches the network). Every state as drawn: populated (24a), empty (24b), a figure whose source
// failed ("—"), copied (24a-bis without its toast), copy failed; and nothing §9 omits.
const SELECTORS = selectorsOf(UI_SHEETS);
const LINK = `https://noc-tura.io?ref=${ACCOUNT}`;
const STATS = {totalReferrals: 3, totalReferredPurchases: 5, totalBaseBonusNoc: 999, totalExtraBonusNoc: 0, totalBonusNoc: 999, totalReferredNoc: 8_000, totalReferredUsd: 1234.56, tierBonusCount: 0};
const Q39 = 'Earn NOC when friends you invite buy in the presale.';
const LEGALESE = 'Referral payouts are subject to program terms. Self-referrals are detected and rejected.';
const earned = (bonus: bigint): Partial<Chain> => ({allocation: program(allocationData({bonus}))});

/** The three stat cards: label, value, sub. */
const stats = () => [...document.querySelectorAll('.s-ref .stats .stat')].map(s => [...s.children].map(c => c.textContent));
const value = (label: string) => [...document.querySelectorAll('.s-ref .stats .stat')].find(s => s.firstElementChild?.textContent === label)?.querySelector('.val') ?? null;
const uses = () => document.querySelector('.s-ref .code-card .uses');
const code = () => document.querySelector('.s-ref .code-card .code-row .code');
const codeRow = () => document.querySelector('.s-ref .code-card .code-row');
const copyButton = () => document.querySelector<HTMLButtonElement>('.s-ref .code-card .actions button');
const shareButton = () => document.querySelector<HTMLButtonElement>('.s-ref .code-card .share-btn');
/** The markup ExtIcon draws for `name` at the copy icon's size — how a test tells the checkmark from the copy glyph. */
function iconHtml(name: 'check' | 'copy' | 'close'): string {
  const c = document.createElement('div');
  const r = render(<ExtIcon name={name} size={18} />, {container: c});
  const html = c.innerHTML;
  r.unmount();
  return html;
}
/** Boolean, with neutral messages (public CI logs): no date, no countdown, and nothing §9 omits from #24. */
function expectNothingOmitted() {
  const t = document.body.textContent ?? '';
  expect(/\b(19|20)\d{2}\b/.test(t)).toBe(false);
  expect(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.? \d/.test(t)).toBe(false);
  for (const v of ['ACTIVE', 'staking', 'stake', 'Recent rewards', 'View all', 'epoch', 'No rewards yet', '5 %', 'NOCT-', 'auto-clear', '…']) expect([v, t.includes(v)]).toEqual([v, false]);
  expect(document.querySelector('.copy-toast, .rewards, .empty-rewards')).toBeNull();
}

interface Shown {
  sent: unknown[];
  gets: string[];
}
/** #24 over this chain and this /referral-stats answer (or failure); every message the screen sent. */
async function show(o: {chain?: Partial<Chain>; stats?: () => Promise<unknown>; read?: () => Promise<(AccountData | null)[]>; failReply?: boolean} = {}): Promise<Shown> {
  const sent: unknown[] = [];
  const gets: string[] = [];
  const w = purchaseWorld({
    ...(o.chain === undefined ? {} : {chain: o.chain}),
    gate: m => {
      sent.push(m);
      if (o.failReply === true && (m as {type: string}).type === 'presale.referral') throw new Error('the popup lost its port');
    },
  });
  const base = w.options.reader;
  const reader = o.read === undefined || base === undefined ? base : {...base, getAccountsData: o.read};
  await renderInWallet(<ReferFriend onBack={vi.fn()} />, {
    ...w.options,
    ...(reader === undefined ? {} : {reader}),
    deps: {
      ...w.options.deps,
      getJson: async path => {
        gets.push(path);
        return o.stats === undefined ? {success: true, data: STATS} : o.stats();
      },
    },
  });
  await landed();
  return {sent, gets};
}
/** Every answer the background owes has landed and been rendered: the open sequence, presale.referral, the screen's continuation. */
const landed = () =>
  act(async () => {
    await new Promise<void>(r => setTimeout(r, 0));
    await drainInFlight();
    await new Promise<void>(r => setTimeout(r, 0));
  });
const referralMessages = (sent: unknown[]) => sent.filter(m => (m as {type: string}).type === 'presale.referral');
function setClipboard(writeText: ((v: string) => Promise<void>) | null) {
  Object.defineProperty(navigator, 'clipboard', {configurable: true, value: writeText === null ? undefined : {writeText}});
}

beforeEach(() => {
  vi.stubGlobal('fetch', () => {
    throw new Error('a test reached for the network');
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  setClipboard(null);
});

describe('#24 referral (§4.4)', () => {
  it('24a populated, as drawn and as the app corrected it: three stats, the code card with the whole link, Copy and Share, Q39, the legalese — one presale.referral, every class styled', async () => {
    const {sent, gets} = await show({chain: earned(16_142_571_618n)});
    expect(document.querySelector('.top-bar .title.noc-h3')?.textContent).toBe('Refer a friend');
    expect(stats()).toEqual([
      ['REFERRALS', '3', 'total joined'],
      ['EARNED', '16.1', 'NOC lifetime'],
      ['REFERRED', '$1,234.56', 'from your invites'],
    ]);
    expect(value('EARNED')?.className).toBe('val noc-balance-md noc-numeral acc');
    expect(value('REFERRALS')?.className).toBe('val noc-balance-md noc-numeral');
    expect(document.querySelector('.s-ref .code-card .lbl-row .noc-overline')?.textContent).toBe('YOUR INVITE LINK');
    expect(uses()?.textContent).toBe('Used by 3 people');
    expect(uses()?.querySelector('.noc-numeral')?.textContent).toBe('3');
    // The address is the code (C1): the link whole, in the mono face, never shortened.
    expect(code()?.textContent).toBe(LINK);
    expect(code()?.classList.contains('noc-mono')).toBe(true);
    expect(copyButton()?.getAttribute('aria-label')).toBe('Copy invite link');
    expect(copyButton()?.innerHTML).toBe(iconHtml('copy'));
    expect(shareButton()?.textContent).toBe('Share invite link');
    expect(document.querySelector('.s-ref .banner.shield')?.textContent).toBe(Q39);
    expect(document.querySelector('.s-ref .legalese')?.textContent).toBe(LEGALESE);
    // No sticky bar on this screen (the design: no primary terminal action).
    expect(document.querySelector('.sticky-bar')).toBeNull();
    expectNothingOmitted();
    expect(referralMessages(sent)).toEqual([{type: 'presale.referral', account: ACCOUNT}]);
    expect(gets).toEqual([`/referral-stats/${ACCOUNT}`]);
    expect(unstyledClasses(document.querySelector('.s-ref')!, SELECTORS)).toEqual([]);
  });

  it('24b empty: zeros as returned — "0", "0.0" muted, "$0.00" — and "Not used yet"', async () => {
    await show({chain: {allocation: null}, stats: async () => ({success: true, data: {...STATS, totalReferrals: 0, totalReferredPurchases: 0, totalReferredUsd: 0}})});
    expect(stats()).toEqual([
      ['REFERRALS', '0', 'total joined'],
      ['EARNED', '0.0', 'NOC lifetime'],
      ['REFERRED', '$0.00', 'from your invites'],
    ]);
    expect(value('EARNED')?.className).toBe('val noc-balance-md noc-numeral app-ref-muted');
    expect(uses()?.textContent).toBe('Not used yet');
    expect(code()?.textContent).toBe(LINK);
    expectNothingOmitted();
    expect(unstyledClasses(document.querySelector('.s-ref')!, SELECTORS)).toEqual([]);
  });

  it('/referral-stats failing: REFERRALS and REFERRED "—", the "Used" line hidden — EARNED still shown from the chain', async () => {
    await show({chain: earned(16_142_571_618n), stats: async () => Promise.reject(new RpcHttpError('/referral-stats', 500))});
    expect(stats()).toEqual([
      ['REFERRALS', '—', 'total joined'],
      ['EARNED', '16.1', 'NOC lifetime'],
      ['REFERRED', '—', 'from your invites'],
    ]);
    expect(uses()).toBeNull();
    expect(code()?.textContent).toBe(LINK);
  });

  it('the chain read failing: EARNED "—" (muted); REFERRALS, REFERRED and "Used by 3 people" still shown from /referral-stats', async () => {
    await show({read: async () => Promise.reject(new Error('rpc down'))});
    expect(stats()).toEqual([
      ['REFERRALS', '3', 'total joined'],
      ['EARNED', '—', 'NOC lifetime'],
      ['REFERRED', '$1,234.56', 'from your invites'],
    ]);
    expect(value('EARNED')?.className).toBe('val noc-balance-md noc-numeral app-ref-muted');
    expect(uses()?.textContent).toBe('Used by 3 people');
  });

  it('a body without a figure is no figure: "—" (never the 0 core would make of it)', async () => {
    await show({chain: earned(1_000_000_000n), stats: async () => ({success: true, data: {totalReferredUsd: 25}})});
    expect(stats()).toEqual([
      ['REFERRALS', '—', 'total joined'],
      ['EARNED', '1.0', 'NOC lifetime'],
      ['REFERRED', '—', 'from your invites'],
    ]);
    expect(uses()).toBeNull();
  });

  it.each([
    [1, 'Used by 1 person'],
    [2, 'Used by 2 people'],
    [1234, 'Used by 1,234 people'],
  ])('%i referrals: "%s" — people, not uses (D27; the count in .noc-numeral, grouped)', async (n, line) => {
    await show({stats: async () => ({success: true, data: {...STATS, totalReferrals: n}})});
    expect(uses()?.textContent).toBe(line);
  });

  it('large figures whole, each breakable only after a group separator (the 412 px frame holds three thirds)', async () => {
    await show({chain: earned(123_456_789_000_000_000n), stats: async () => ({success: true, data: {totalReferrals: 12_345, totalReferredUsd: 1_234_567.89}})});
    expect(stats().map(s => s[1])).toEqual(['12,345', '123,456,789.0', '$1,234,567.89']);
    expect(['REFERRALS', 'EARNED', 'REFERRED'].map(l => value(l)?.innerHTML)).toEqual(['12,<wbr>345', '123,<wbr>456,<wbr>789.0', '$1,<wbr>234,<wbr>567.89']);
  });

  it('a reply that failed: every figure "—", no link and no copy, Q11 said', async () => {
    await show({failReply: true});
    expect(stats().map(s => s[1])).toEqual(['—', '—', '—']);
    expect(document.querySelector('.s-ref .code-card')).toBeNull();
    expect(screen.getByRole('alert').textContent).toBe('Presale unavailable — try again later.');
  });

  it('the figures are formatted from bigints, never through a float: EARNED floored to one place, REFERRED exact beyond a double', () => {
    expect(earnedText(16_199_999_999n)).toBe('16.1');
    expect(earnedText(123_456_789_000_000_000n)).toBe('123,456,789.0');
    expect(referredText(900_719_925_474_099_312n)).toBe('$9,007,199,254,740,993.12');
    expect(referredText(29n)).toBe('$0.29');
  });

  it('the route `referral` carries nothing; its screen is #24', () => {
    expect(REFERRAL_ROUTE.isRoute({screen: 'referral'})).toBe(true);
    for (const bad of [{screen: 'referral', account: ACCOUNT}, {screen: 'referral', link: LINK}, {screen: 'referrals'}]) expect(REFERRAL_ROUTE.isRoute(bad)).toBe(false);
  });
});

describe('#24 copy (C15, 24a-bis without its toast)', () => {
  it('Copy: the clipboard holds exactly the link; while copied the icon is the checkmark and the code row carries the accent border, "Copied" said — no toast; after its 2 s, idle again', async () => {
    const writes: string[] = [];
    setClipboard(async v => void writes.push(v));
    await show({chain: earned(9n)});
    expect(codeRow()?.className).toBe('code-row');
    await act(async () => {
      fireEvent.click(copyButton()!);
    });
    expect(writes).toEqual([LINK]);
    expect(codeRow()?.className).toBe('code-row app-ref-copied');
    expect(copyButton()?.innerHTML).toBe(iconHtml('check'));
    expect(copyButton()?.className).toBe('app-ref-check');
    expect(copyButton()?.getAttribute('aria-label')).toBe('Copied');
    expect(shareButton()?.textContent).toBe('Copied');
    expectNothingOmitted();
    expect(unstyledClasses(document.querySelector('.s-ref')!, SELECTORS)).toEqual([]);
    await act(() => new Promise<void>(r => setTimeout(r, 2_100)));
    expect(codeRow()?.className).toBe('code-row');
    expect(copyButton()?.innerHTML).toBe(iconHtml('copy'));
    expect(shareButton()?.textContent).toBe('Share invite link');
  });

  it('"Share invite link" copies the link (C15): the same clipboard write, the same checkmark and border', async () => {
    const writes: string[] = [];
    setClipboard(async v => void writes.push(v));
    await show();
    await act(async () => {
      fireEvent.click(shareButton()!);
    });
    expect(writes).toEqual([LINK]);
    expect(codeRow()?.className).toBe('code-row app-ref-copied');
    expect(copyButton()?.innerHTML).toBe(iconHtml('check'));
    expect(shareButton()?.textContent).toBe('Copied');
  });

  it.each([
    ['the clipboard refused', async () => Promise.reject(new Error('denied'))],
    ['no clipboard API', null],
  ] as const)('"Copy failed" (%s): said, and no checkmark, no accent border', async (_name, writeText) => {
    setClipboard(writeText);
    await show();
    await act(async () => {
      fireEvent.click(copyButton()!);
    });
    expect(copyButton()?.getAttribute('aria-label')).toBe('Copy failed');
    expect(shareButton()?.textContent).toBe('Copy failed');
    expect(copyButton()?.innerHTML).not.toBe(iconHtml('check'));
    expect(copyButton()?.innerHTML).toBe(iconHtml('close'));
    expect(codeRow()?.className).toBe('code-row');
  });
});
```

Create `extension/src/app/__tests__/settingsPresale.test.tsx` (#31's row, in both vitest runs):

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, screen} from '@testing-library/react';
import {renderApp} from './appHarness';
import {drainInFlight} from './harness';
import {registerPresale} from '../../background/presale/api';
import {registerPresaleHandler} from '../../background/messages';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, allocationData, program} from '../../background/presale/__tests__/chain';
import {purchaseWorld} from '../presale/__tests__/world';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 4 (C16, §1.1, §4.4): #31's "Refer a friend" row into #24, in the whole App against the REAL background.
// This file runs in both vitest runs: the build with presale shows the row in its own group and opens #24; the build
// without it has neither the group nor the row, and sends no presale message.
const off = process.env.NOCTURA_PRESALE === '0';
const types = (sent: unknown[]) => sent.map(m => (m as {type: string}).type);
const settled = () =>
  act(async () => {
    await new Promise<void>(r => setTimeout(r, 0));
    await drainInFlight();
    await new Promise<void>(r => setTimeout(r, 0));
  });
const groups = () => [...document.querySelectorAll('.s7-group-label')].map(e => e.textContent);
const rows = () => [...document.querySelectorAll('.s7-row .s7-title')].map(e => e.textContent);
const ROWS = ['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura'];

async function settings() {
  const sent: unknown[] = [];
  const w = purchaseWorld({chain: {allocation: program(allocationData({bonus: 16_142_571_618n}))}});
  await renderApp({
    ...w.options,
    deps: {...w.options.deps, getJson: async () => ({success: true, data: {totalReferrals: 3, totalReferredUsd: 1234.56}})},
    spy: m => void sent.push(m),
  });
  await screen.findByText('TOKENS');
  fireEvent.click(screen.getByRole('button', {name: 'Settings'}));
  await screen.findByRole('heading', {name: 'Settings'});
  await settled();
  return sent;
}

describe(`#31's presale row in this build (${off ? 'off' : 'on'})`, () => {
  it(off ? 'off: no Rewards group and no "Refer a friend" — the rows of B1d-1b exactly — and no presale.referral' : 'on: Rewards › Refer a friend after Connections; the tap opens #24, which asks presale.referral; Back → #31', async () => {
    const sent = await settings();
    if (off) {
      expect(groups()).toEqual(['Account', 'Security', 'Connections', 'Advanced', 'About']);
      expect(rows()).toEqual(ROWS);
      expect(screen.queryByText('Refer a friend')).toBeNull();
      expect(types(sent).filter(t => t === 'presale.referral')).toEqual([]);
      return;
    }
    expect(groups()).toEqual(['Account', 'Security', 'Connections', 'Rewards', 'Advanced', 'About']);
    expect(rows()).toEqual([...ROWS.slice(0, 8), 'Refer a friend', ...ROWS.slice(8)]);
    const row = screen.getByText('Refer a friend', {selector: '.s7-title'}).closest('button') as HTMLButtonElement;
    fireEvent.click(row);
    // Rule 6: a second tap inside 500 ms (disabled lifted — happy-dom drops a click on a disabled button) pushes nothing.
    row.disabled = false;
    fireEvent.click(row);
    await settled();
    expect(document.querySelector('.s-ref .top-bar .title')?.textContent).toBe('Refer a friend');
    expect(document.querySelector('.s-ref .code-card .code')?.textContent).toBe(`https://noc-tura.io?ref=${ACCOUNT}`);
    expect(sent.filter(m => (m as {type: string}).type === 'presale.referral')).toEqual([{type: 'presale.referral', account: ACCOUNT}]);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByRole('heading', {name: 'Settings'})).toBeTruthy();
    expect(document.querySelector('.s-ref')).toBeNull();
  });
});
```

Modify `extension/vitest.nopresale.config.ts` (the new file runs in the off build too):

```diff
diff --git a/extension/vitest.nopresale.config.ts b/extension/vitest.nopresale.config.ts
index 4e7a4ba..013b0cf 100644
--- a/extension/vitest.nopresale.config.ts
+++ b/extension/vitest.nopresale.config.ts
@@ -17,6 +17,7 @@ export const NOPRESALE_TESTS = [
   'src/background/__tests__/pendingKinds.test.ts',
   'src/app/__tests__/genericRecord.test.tsx',
   'src/app/__tests__/homePresale.test.tsx',
+  'src/app/__tests__/settingsPresale.test.tsx',
   'src/app/__tests__/engine.test.ts',
   'src/background/geo/__tests__/gate.test.ts',
   'src/background/dapp/__tests__/presaleRegion.test.ts',
```

Modify `extension/src/background/__tests__/fakeDeps.ts` (the fake GET fails loudly unless a test gives one):

```diff
diff --git a/extension/src/background/__tests__/fakeDeps.ts b/extension/src/background/__tests__/fakeDeps.ts
index f13d99e..2398f95 100644
--- a/extension/src/background/__tests__/fakeDeps.ts
+++ b/extension/src/background/__tests__/fakeDeps.ts
@@ -28,8 +28,8 @@ export function fakeReader(overrides: Partial<SolanaReader> = {}): SolanaReader
 
 /**
  * Deterministic deps: a settable clock, counting random bytes, prices for SOL/USDC/USDT, a sleep
- * that never resolves (no poller runs unless a test asks for one), and a broadcast, a geo check and a
- * POST that fail unless a test overrides them.
+ * that never resolves (no poller runs unless a test asks for one), and a broadcast, a geo check, a
+ * POST and a GET that fail unless a test overrides them.
  */
 export function fakeDeps(overrides: Partial<WalletDeps> = {}): WalletDeps & {clock: {t: number}; broadcasts: Uint8Array[]} {
   const clock = {t: 1_000_000};
@@ -48,6 +48,9 @@ export function fakeDeps(overrides: Partial<WalletDeps> = {}): WalletDeps & {clo
     postJson: async path => {
       throw new Error(`unexpected POST ${path}`);
     },
+    getJson: async path => {
+      throw new Error(`unexpected GET ${path}`);
+    },
     now: () => clock.t,
     randomBytes: n => {
       counter += 1;
```

Modify `extension/src/background/__tests__/deps.test.ts` (`getJson` on the shared latch — both directions — and its statuses):

```diff
diff --git a/extension/src/background/__tests__/deps.test.ts b/extension/src/background/__tests__/deps.test.ts
index 62f6913..49f8553 100644
--- a/extension/src/background/__tests__/deps.test.ts
+++ b/extension/src/background/__tests__/deps.test.ts
@@ -2,7 +2,7 @@ import {BROADCAST_TIMEOUT_MS, FORBIDDEN_UNTIL_KEY, REQUEST_TIMEOUT_MS, RequestTi
 import {submitSigned} from '../pending';
 import {PENDING_KEY} from '../pendingStore';
 import {fakeDeps} from './fakeDeps';
-import {FORBIDDEN_COOLDOWN_MS, RequestUnreachable, RpcCoolingDown, RpcForbidden, createForbiddenLatch, createRpc, type FetchInit} from '../../../../core/solana/rpc';
+import {FORBIDDEN_COOLDOWN_MS, RequestUnreachable, RpcCoolingDown, RpcForbidden, RpcHttpError, createForbiddenLatch, createRpc, type FetchInit} from '../../../../core/solana/rpc';
 import {fakeExt} from './fakeExt';
 import {ACCOUNT, RECIPIENT, signedWire} from './fixtures';
 
@@ -107,6 +107,31 @@ describe('browserDeps (review M3: the cool-down survives a restarted worker)', (
     expect(urls).toEqual(['https://api.noc-tura.io/api/v1/solana/purchase', 'https://api.noc-tura.io/api/v1/rpc']);
   });
 
+  it('getJson (B1d-2, #24) goes through the same latch: a 403 on /referral-stats silences the RPC; the RPC’s 403 silences /referral-stats', async () => {
+    const urls: string[] = [];
+    vi.stubGlobal('fetch', async (url: string) => (urls.push(url), {status: 403, json: async () => null}));
+    const deps = browserDeps(fakeExt());
+    await expect(deps.getJson(`/referral-stats/${ACCOUNT.publicKey}`)).rejects.toBeInstanceOf(RpcForbidden);
+    await expect(deps.reader.getBlockHeight()).rejects.toBeInstanceOf(RpcCoolingDown);
+    const other = browserDeps(fakeExt());
+    await expect(other.reader.getBlockHeight()).rejects.toBeInstanceOf(RpcForbidden);
+    await expect(other.getJson(`/referral-stats/${ACCOUNT.publicKey}`)).rejects.toBeInstanceOf(RpcCoolingDown);
+    expect(urls).toEqual([`https://api.noc-tura.io/api/v1/referral-stats/${ACCOUNT.publicKey}`, 'https://api.noc-tura.io/api/v1/rpc']);
+  });
+
+  it('getJson answers a 200’s body as it is, and throws on any other status (positive and negative control)', async () => {
+    const answers = [{status: 200, body: {success: true, data: {totalReferrals: 1}}}, {status: 500, body: {success: false}}, {status: 429, body: null}];
+    vi.stubGlobal('fetch', async () => {
+      const a = answers.shift();
+      if (a === undefined) throw new Error('no more answers');
+      return {status: a.status, json: async () => a.body};
+    });
+    const deps = browserDeps(fakeExt());
+    expect(await deps.getJson('/referral-stats/x')).toEqual({success: true, data: {totalReferrals: 1}});
+    await expect(deps.getJson('/referral-stats/x')).rejects.toBeInstanceOf(RpcHttpError);
+    await expect(deps.getJson('/referral-stats/x')).rejects.toBeInstanceOf(RpcHttpError);
+  });
+
   it('reads the NOC stage price from /stats (owner decision B)', async () => {
     const urls: string[] = [];
     vi.stubGlobal('fetch', async (url: string) => (urls.push(url), {status: 200, json: async () => ({success: true, data: {currentStage: 1, totalNocSold: 0, isPaused: false}})}));
```

Modify `extension/src/app/presale/__tests__/client.test.ts`:

```diff
diff --git a/extension/src/app/presale/__tests__/client.test.ts b/extension/src/app/presale/__tests__/client.test.ts
index 3756bca..af7e038 100644
--- a/extension/src/app/presale/__tests__/client.test.ts
+++ b/extension/src/app/presale/__tests__/client.test.ts
@@ -1,5 +1,5 @@
 import {createEngine, type Transport} from '../../engine';
-import {BUY_REFUSALS, PREPARE_REFUSALS, REFERRER_LINES, bannerOf, presaleClient, presaleViewOf, purchaseDataOf, purchaseViewOf, quoteOf, referrerCheckOf, resumableOf} from '../client';
+import {BUY_REFUSALS, PREPARE_REFUSALS, REFERRER_LINES, bannerOf, presaleClient, presaleViewOf, purchaseDataOf, purchaseViewOf, quoteOf, referralDataOf, referrerCheckOf, resumableOf} from '../client';
 import {registerPresale} from '../../../background/presale/api';
 import {handleMessage, registerPresaleHandler} from '../../../background/messages';
 import {PENDING_KEY} from '../../../background/pendingStore';
@@ -406,3 +406,38 @@ describe('the client for #11’s banner', () => {
     }
   });
 });
+
+// B1d-2 Task 4 (§3.5, §4.4): #24's data.
+describe('the client for #24 (presale.referral)', () => {
+  const LINK = `https://noc-tura.io?ref=${ACCOUNT}`;
+  it('referral against the real background: {type, account}; the link whole, EARNED as bigint from the chain, the stats null when their source failed (positive control)', async () => {
+    const {client, sent} = await wired({chain: {allocation: program(allocationData({bonus: 16_142_571_618n}))}});
+    expect(await client.referral(ACCOUNT)).toEqual({ok: true, data: {link: LINK, earnedBase: 16_142_571_618n, referrals: null, referredCents: null}});
+    expect(sent).toEqual([{type: 'presale.referral', account: ACCOUNT}]);
+  });
+
+  it('referralDataOf: exactly four keys; the link this account’s, whole; each figure a decimal string or null — anything else failed', () => {
+    const good = {link: LINK, earnedBase: '7', referrals: '3', referredCents: '123456'};
+    expect(referralDataOf(good, ACCOUNT)).toEqual({link: LINK, earnedBase: 7n, referrals: 3n, referredCents: 123_456n});
+    expect(referralDataOf({...good, earnedBase: null, referrals: null, referredCents: null}, ACCOUNT)).toEqual({link: LINK, earnedBase: null, referrals: null, referredCents: null});
+    // Beyond a double: the cents stay exact (bigint, never a float).
+    expect(referralDataOf({...good, referredCents: '900719925474099312'}, ACCOUNT)?.referredCents).toBe(900_719_925_474_099_312n);
+    for (const bad of [
+      {...good, extra: 1},
+      {link: LINK, earnedBase: '7', referrals: '3'},
+      {...good, link: `https://noc-tura.io?ref=${OTHER}`},
+      {...good, link: `https://noc-tura.io?ref=${ACCOUNT.slice(0, 8)}…`},
+      {...good, link: `https://evil.example?ref=${ACCOUNT}`},
+      {...good, link: `${LINK} `},
+      {...good, earnedBase: 7},
+      {...good, referrals: '-1'},
+      {...good, referredCents: '12.5'},
+      {...good, referrals: ''},
+      null,
+      'referral',
+    ]) {
+      expect([bad, referralDataOf(bad, ACCOUNT)]).toEqual([bad, undefined]);
+    }
+    expect(referralDataOf(good, OTHER)).toBeUndefined();
+  });
+});
```

Modify `extension/src/app/__tests__/Settings.test.tsx` (this run has presale: Rewards › Refer a friend; every render gives `onRoute`):

```diff
diff --git a/extension/src/app/__tests__/Settings.test.tsx b/extension/src/app/__tests__/Settings.test.tsx
index 0a6e00e..54e6cb0 100644
--- a/extension/src/app/__tests__/Settings.test.tsx
+++ b/extension/src/app/__tests__/Settings.test.tsx
@@ -33,11 +33,11 @@ async function openSettings(o: Parameters<typeof renderApp>[0] = {}) {
 }
 
 describe('Settings (#31, B1b-2b §4.1)', () => {
-  it('the groups and rows the extension has (D22): Account › Profile; Security › Security center, Passkey, Change password, Recovery phrase, Lock now; Connections › Connected dApps (B1c), Address book (plan 2); Advanced › Delete wallet; About', async () => {
+  it('the groups and rows the extension has (D22): Account › Profile; Security › Security center, Passkey, Change password, Recovery phrase, Lock now; Connections › Connected dApps (B1c), Address book (plan 2); Rewards › Refer a friend (B1d-2, C16 — this build has presale); Advanced › Delete wallet; About', async () => {
     await openSettings();
-    expect(screen.getAllByText(/^(Account|Security|Connections|Advanced|About)$/).map(e => e.textContent)).toEqual(['Account', 'Security', 'Connections', 'Advanced', 'About']);
+    expect([...document.querySelectorAll('.s7-group-label')].map(e => e.textContent)).toEqual(['Account', 'Security', 'Connections', 'Rewards', 'Advanced', 'About']);
     expect([...document.querySelectorAll('.s7-row .s7-title')].map(e => e.textContent)).toEqual([
-      'Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura',
+      'Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Refer a friend', 'Delete wallet', 'About Noctura',
     ]);
     expect(screen.getByText('v0.1.0')).toBeTruthy();
     for (const gone of ['Currency', 'Notifications', 'Material You accent', 'RPC endpoint', 'Air-gap signing', 'Export transaction history', 'Diagnostics', 'Backup & restore', 'Biometric unlock', 'Change PIN', 'Accounts']) {
@@ -104,7 +104,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, settings)});
     const {unmount} = render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} toastMs={400} decorateMs={800} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} onRoute={noop} toastMs={400} decorateMs={800} />
       </WalletProvider>,
     );
     expect(await screen.findByText('Password updated')).toBeTruthy();
@@ -118,7 +118,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     unmount();
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} onRoute={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -131,7 +131,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() - 11 * 60_000})});
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} onRoute={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -227,7 +227,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
   async function rows() {
     localStorage.clear();
     const w = await setupWallet();
-    const calls = {profile: 0, security: 0, passkey: 0, del: 0, about: 0, contacts: 0, connected: 0};
+    const calls = {profile: 0, security: 0, passkey: 0, del: 0, about: 0, contacts: 0, connected: 0, routes: [] as unknown[]};
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
         <Settings
@@ -238,6 +238,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
           onAbout={() => void calls.about++}
           onContacts={() => void calls.contacts++}
           onConnected={() => void calls.connected++}
+          onRoute={r => void calls.routes.push(r)}
         />
       </WalletProvider>,
     );
@@ -251,10 +252,10 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     fireEvent.click(button);
   };
 
-  it('rule 6: Profile, Security center, Passkey, Connected dApps, Address book, Delete wallet and About each fire once for two taps inside 500 ms', async () => {
+  it('rule 6: Profile, Security center, Passkey, Connected dApps, Address book, Refer a friend (B1d-2), Delete wallet and About each fire once for two taps inside 500 ms', async () => {
     const {calls} = await rows();
-    for (const t of ['Profile', 'Security center', 'Passkey', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura']) twice(t);
-    expect(calls).toEqual({profile: 1, security: 1, passkey: 1, del: 1, about: 1, contacts: 1, connected: 1});
+    for (const t of ['Profile', 'Security center', 'Passkey', 'Connected dApps', 'Address book', 'Refer a friend', 'Delete wallet', 'About Noctura']) twice(t);
+    expect(calls).toEqual({profile: 1, security: 1, passkey: 1, del: 1, about: 1, contacts: 1, connected: 1, routes: [{screen: 'referral'}]});
   });
 
   // B1c §4.1 (Q07, review L12): the Connected dApps meta counts the grants dapp.grants.list answers; empty when none.
@@ -321,7 +322,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     };
     const {unmount} = render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} onRoute={noop} />
       </WalletProvider>,
     );
     await screen.findByText('Change password');
@@ -372,7 +373,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const w = await setupWallet({before: async ext => ext.local.set(SETTINGS_KEY, {passwordChangedAt: Date.now() + 60_000})});
     render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} onRoute={noop} />
       </WalletProvider>,
     );
     await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).toBe('3 to do'));
@@ -388,7 +389,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const engine = {...w.engine, state: () => new Promise<never>(() => undefined)};
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} onRoute={noop} />
       </WalletProvider>,
     );
     await waitFor(() => expect(screen.getByText('Security center').parentElement?.querySelector('.s7-meta')?.textContent).not.toBe(''));
@@ -406,7 +407,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     const engine = {...w.engine, settings: () => (reads++, w.engine.settings())};
     const r = render(
       <WalletProvider engine={engine} platform={w.platform} surface={surface}>
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} onRoute={noop} />
       </WalletProvider>,
     );
     const meta = (t: string) => screen.getByText(t, {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
@@ -457,7 +458,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     };
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="tab">
-        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} />
+        <Settings onProfile={noop} onSecurity={noop} onPasskey={noop} onDelete={noop} onAbout={noop} onContacts={noop} onConnected={noop} onRoute={noop} />
       </WalletProvider>,
     );
     const meta = () => screen.getByText('Recovery phrase', {selector: '.s7-title'}).parentElement?.querySelector('.s7-meta');
```

Modify `extension/src/app/__tests__/router.test.ts` (both runs):

```diff
diff --git a/extension/src/app/__tests__/router.test.ts b/extension/src/app/__tests__/router.test.ts
index db6a125..a60bed2 100644
--- a/extension/src/app/__tests__/router.test.ts
+++ b/extension/src/app/__tests__/router.test.ts
@@ -1,5 +1,6 @@
 // @vitest-environment happy-dom
 import {FLOW, SCREENS, TAB_ONLY, firstRoute, pickStack, routeReducer, type Route} from '../router';
+import {presaleRoutes} from '../presale';
 
 const HOME: Route[] = [{screen: 'tab', tab: 'home'}];
 
@@ -212,4 +213,16 @@ describe(`#23's route in this build (${process.env.NOCTURA_PRESALE === '0' ? 'of
     }
     expect(SCREENS.has('geo')).toBe(false);
   });
+
+  // B1d-2 Task 4: #24, carrying nothing — pushed by #31's row (C16); never a hand-over name (TAB_ONLY is decided first).
+  it(off ? 'off: `referral` is refused like any unknown screen' : 'on: exactly {screen: "referral"} is pushed; any other key refuses it', () => {
+    expect(push({screen: 'referral'})).toEqual(off ? HOME : [...HOME, {screen: 'referral'}]);
+    for (const extra of [{account: ADDR}, {link: 'https://noc-tura.io?ref=x'}, {tab: 'settings'}]) expect(push({screen: 'referral', ...extra})).toBe(HOME);
+    expect(SCREENS.has('referral')).toBe(false);
+  });
+
+  it('no presale route is a TAB_ONLY hand-over name, and none shadows a screen of the closed list', () => {
+    expect(presaleRoutes.map(r => r.screen)).toEqual(off ? [] : ['presale', 'presale-confirm', 'geo', 'referral']);
+    for (const r of presaleRoutes) expect([r.screen, TAB_ONLY.has(r.screen), SCREENS.has(r.screen)]).toEqual([r.screen, false, false]);
+  });
 });
```

Modify the four lists of presale message types and the switch's route list:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index 44ac4b1..923e2f6 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -194,7 +194,7 @@ describe('message partitions', () => {
 
 // This file runs in both vitest runs (vitest.nopresale.config.ts marks the off one).
 const off = process.env.NOCTURA_PRESALE === '0';
-const PRESALE = off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer'];
+const PRESALE = off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer', 'presale.referral'];
 
 describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
@@ -291,7 +291,7 @@ describe('message partitions (B1b-1 types)', () => {
 });
 
 describe(`presale.* in the build ${off ? 'without' : 'with'} presale (B1d §1.1, §1.4)`, () => {
-  const TYPES = ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer'];
+  const TYPES = ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer', 'presale.referral'];
 
   it(off ? 'every presale type is refused as an unknown type, from the popup too' : 'every presale type is privileged: past the partition from the popup (positive control — no handler is registered in this file, so unavailable)', async () => {
     const ext = vaultExt();
```

```diff
diff --git a/extension/src/background/presale/__tests__/api.test.ts b/extension/src/background/presale/__tests__/api.test.ts
index f453653..7b6973a 100644
--- a/extension/src/background/presale/__tests__/api.test.ts
+++ b/extension/src/background/presale/__tests__/api.test.ts
@@ -114,8 +114,8 @@ const PURCHASE: PendingRecord = pendingRecord({
 const {wire: _wire, firstBroadcast: _firstBroadcast, ...PURCHASE_VIEW} = PURCHASE;
 
 describe('the partition (§1.4): the popup and the full tab only', () => {
-  it('the three types of B1d-1b Task 1, Task 2’s prepare, Task 3’s four and B1d-2’s presale.unrecorded and presale.checkReferrer, all privileged', () => {
-    expect(PRESALE_MESSAGE_TYPES).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer']);
+  it('the three types of B1d-1b Task 1, Task 2’s prepare, Task 3’s four and B1d-2’s presale.unrecorded, presale.checkReferrer and presale.referral, all privileged', () => {
+    expect(PRESALE_MESSAGE_TYPES).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer', 'presale.referral']);
   });
 
   it('answered from the popup and from the full tab (positive control)', async () => {
```

```diff
diff --git a/extension/src/__tests__/presaleSwitch.test.ts b/extension/src/__tests__/presaleSwitch.test.ts
index e737663..43152ca 100644
--- a/extension/src/__tests__/presaleSwitch.test.ts
+++ b/extension/src/__tests__/presaleSwitch.test.ts
@@ -26,12 +26,13 @@ describe(`the build-time switch in this run (${off ? 'off' : 'on'})`, () => {
 
   it(off ? 'the stubs export empty values: no message type, no route, no slot, no description' : 'the entries export what B1d-1b has built so far, the stubs empty values', () => {
     // B1d-1b: the background entry's message types (§1.4) — Task 1's three, Task 2's prepare, Task 3's four; B1d-2's
-    // presale.unrecorded (Task 1) and presale.checkReferrer (Task 2); the stub adds none.
-    expect(bgEntry.PRESALE_MESSAGE_TYPES).toEqual(off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer']);
+    // presale.unrecorded (Task 1), presale.checkReferrer (Task 2) and presale.referral (Task 4); the stub adds none.
+    expect(bgEntry.PRESALE_MESSAGE_TYPES).toEqual(off ? [] : ['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale.unrecorded', 'presale.checkReferrer', 'presale.referral']);
     expect(bgStub.PRESALE_MESSAGE_TYPES).toEqual([]);
     // B1d-1b Tasks 4–6: the popup entry's routes — #23 (`presale`), #20's purchase variant (`presale-confirm`) and #50b
-    // (`geo`) — and its slots (the record words, the resume, #11's banner and Buy); the stub adds none.
-    expect(appEntry.presaleRoutes.map(r => r.screen)).toEqual(off ? [] : ['presale', 'presale-confirm', 'geo']);
+    // (`geo`) — and its slots (the record words, the resume, #11's banner and Buy); B1d-2 Task 4: #24 (`referral`) and
+    // #31's row into it; the stub adds none.
+    expect(appEntry.presaleRoutes.map(r => r.screen)).toEqual(off ? [] : ['presale', 'presale-confirm', 'geo', 'referral']);
     expect(appStub.presaleRoutes).toEqual([]);
     expect(appEntry.presaleSlots === null).toBe(off);
     expect(appStub.presaleSlots).toBeNull();
```

Modify `extension/src/__tests__/designExt2b.test.ts` (#24's classes extracted; the hash re-pinned — the value is the output of Step 3's extraction):

```diff
diff --git a/extension/src/__tests__/designExt2b.test.ts b/extension/src/__tests__/designExt2b.test.ts
index 968b055..d9048b3 100644
--- a/extension/src/__tests__/designExt2b.test.ts
+++ b/extension/src/__tests__/designExt2b.test.ts
@@ -57,7 +57,14 @@ describe('design-ext.css (B1b-2b plan 1)', () => {
     for (const alias of ['\n.topbar', '\n.sticky-bottom-bar', '\n.phone-row', '\n.s11-airgap', '\n.s11-stepdots', '\n.screen-section']) expect([alias, CSS.includes(alias)]).toEqual([alias, false]);
   });
 
+  // B1d-2 Task 4 re-ran the extraction with #24's classes added (ix:2799-2929).
+  it('carries #24’s referral classes (B1d-2 Task 4)', () => {
+    for (const sel of ['.s-ref .scroll', '.s-ref .stats', '.s-ref .stats .stat', '.s-ref .stats .stat .val.acc', '.s-ref .code-card', '.s-ref .code-card .lbl-row', '.s-ref .code-card .code-row', '.s-ref .code-card .code-row .code', '.s-ref .code-card .actions button', '.s-ref .code-card .share-btn', '.s-ref .legalese']) {
+      expect(CSS).toContain(`\n${sel} {`);
+    }
+  });
+
   it('is the extraction output, byte for byte (the hash the plan pins; scripts/extract-design-css.mjs --check against the design)', () => {
-    expect(createHash('sha256').update(CSS).digest('hex')).toBe('0723ca1a2af9c4d89f46ab8e33e71657d82faa0f9e5bd0f7b1e40300056fd87c');
+    expect(createHash('sha256').update(CSS).digest('hex')).toBe('ab642e2a20c7abcddcd4b657ed480132a4fa17a806a914a9a07455f056adfb3d');
   });
 });
```

Modify `extension/scripts/__tests__/check-no-presale.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index c3f9a6d..0ae97bf 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -97,7 +97,7 @@ describe('the off-build module rule', () => {
 
 // §6.2 item 1's positive control, staged per plan (review 2 M2): the lists only grow, and each plan's modules are named.
 describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
-  it('the on build must carry the three on-path entries — the plugin maps something real — the program state (Task 5), the quote (B1d-1b Task 1), the purchase (Task 2), #23 (Task 4), #20’s purchase variant with the record slot (Task 5), #50b (Task 6) and the purchase’s builder and referrer resolution from core/presale (Task 8)', () => {
+  it('the on build must carry the three on-path entries — the plugin maps something real — the program state (Task 5), the quote (B1d-1b Task 1), the purchase (Task 2), #23 (Task 4), #20’s purchase variant with the record slot (Task 5), #50b (Task 6), the purchase’s builder and referrer resolution from core/presale (Task 8), B1d-2’s record (Task 1) and #24’s background, core/referral and screen (Task 4)', () => {
     expect(ON_BUILD).toEqual([
       ...PRESALE_ENTRIES.map(e => e.entry),
       'src/background/presale/layouts.ts',
@@ -115,6 +115,9 @@ describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
       'core/presale/buyInstructions.ts',
       'core/presale/referrer.ts',
       'src/background/presale/record.ts',
+      'src/background/presale/referral.ts',
+      'core/referral/index.ts',
+      'src/app/presale/ReferFriend.tsx',
     ]);
   });
 
@@ -164,7 +167,7 @@ describe('app.features.json', () => {
 describe('strings', () => {
   const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});
 
-  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48)', () => {
+  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48), Task 4 #24’s type, #31’s row and #24’s copy', () => {
     expect(MARKERS.slice(0, 9)).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale-buy']);
     // §6.2's named strings #23 shows, then Q01, Q02, Q04–Q06, Q11–Q16, Q19, Q40c, Q41c, Q41d, Q43, Q52 (each literal part ≥ 8 characters).
     expect(MARKERS.slice(9)).toEqual([
@@ -249,6 +252,18 @@ describe('strings', () => {
       "You can't refer yourself or another account in this wallet",
       "This address has no presale allocation, so it can't receive a referral bonus",
       'This account can no longer take a referrer — review again',
+      'presale.referral',
+      'Refer a friend',
+      'total joined',
+      'NOC lifetime',
+      'from your invites',
+      'YOUR INVITE LINK',
+      'Not used yet',
+      'Used by ',
+      'Copy invite link',
+      'Share invite link',
+      'Earn NOC when friends you invite buy in the presale.',
+      'Referral payouts are subject to program terms. Self-referrals are detected and rejected.',
     ]);
   });
 
@@ -257,7 +272,7 @@ describe('strings', () => {
   it('every presale.* message type of api.ts is a marker', () => {
     const api = readFileSync(join(ROOT, 'src/background/presale/api.ts'), 'utf8');
     const types = [...(/PRESALE_MESSAGE_TYPES: readonly string\[\] = \[([^\]]*)\]/.exec(api)?.[1] ?? '').matchAll(/'([^']+)'/g)].map(m => m[1]);
-    expect(types).toHaveLength(10);
+    expect(types).toHaveLength(11);
     for (const t of types) expect([t, MARKERS.includes(t)]).toEqual([t, true]);
   });
 
```

Modify `extension/e2e/visual.spec.ts` (#31's rows in the on build):

```diff
diff --git a/extension/e2e/visual.spec.ts b/extension/e2e/visual.spec.ts
index f78d407..9c00f5f 100644
--- a/extension/e2e/visual.spec.ts
+++ b/extension/e2e/visual.spec.ts
@@ -94,8 +94,8 @@ test('visual: the plan-1 screens and states at 412 × 600', async () => {
 
     await p.getByRole('button', {name: 'Settings'}).click();
     // B1b-2b plan 1 (#31 in full) and plan 2 (Connections › Address book): the rows of every group; visual-settings.spec.ts
-    // and visual-contacts.spec.ts shoot their states.
-    await expect(p.locator('.s7-row .s7-title')).toHaveText(['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Delete wallet', 'About Noctura']);
+    // and visual-contacts.spec.ts shoot their states. B1d-2 Task 4 (C16): this build has presale — Rewards › Refer a friend.
+    await expect(p.locator('.s7-row .s7-title')).toHaveText(['Profile', 'Security center', 'Passkey', 'Change password', 'Recovery phrase', 'Lock now', 'Connected dApps', 'Address book', 'Refer a friend', 'Delete wallet', 'About Noctura']);
     await shot(p, '31-settings-minimal');
     await p.getByText('About Noctura').click();
     await expect(p.getByText('Solana wallet for your browser — your keys stay on this device.')).toBeVisible();
```

- [ ] **Step 2: Run them on the previous task's tree — red.**

In a `git archive` copy of Task 3's commit with only the Step 1 files added (node_modules linked): `npx tsc --noEmit; echo $?` → `2`, 29 errors, all in the Step 1 files: `referral.test.ts` (`Cannot find module '../referral'`, `'getJson' does not exist in type 'Partial<WalletDeps>'`, an implicit `any`), `ReferFriend.test.tsx` (`Cannot find module '../ReferFriend'`, no exported `REFERRAL_ROUTE`, `earnedText`, `referredText`, `getJson`, an implicit `any`), `client.test.ts` (no exported `referralDataOf`; `Property 'referral' does not exist on type 'PresaleClient'`), `settingsPresale.test.tsx` (`getJson`), `Settings.test.tsx` (10: `onRoute` is no prop of `Settings`, an implicit `any`), `deps.test.ts` (5 × `Property 'getJson' does not exist on type 'WalletDeps'`), `fakeDeps.ts` (2).

`npx vitest run scripts/__tests__/check-no-presale.test.mjs src/__tests__/designExt2b.test.ts src/__tests__/presaleSwitch.test.ts src/app/__tests__/Settings.test.tsx src/app/__tests__/router.test.ts src/app/presale/__tests__/client.test.ts src/background/__tests__/deps.test.ts src/background/__tests__/messages.test.ts src/background/presale/__tests__/api.test.ts src/app/__tests__/settingsPresale.test.tsx src/app/presale/__tests__/ReferFriend.test.tsx src/background/presale/__tests__/referral.test.ts` — `Test Files  12 failed (12)` · `Tests  18 failed | 258 passed (276)`: `referral.test.ts` and `ReferFriend.test.tsx` fail to load (their modules do not exist); `check-no-presale.test.mjs` 3 (`ON_BUILD`, `MARKERS`, 11 types in `api.ts`), `deps.test.ts` 2, `designExt2b.test.ts` 2 (the `.s-ref` rules, the hash), `messages.test.ts` 2, `client.test.ts` 2, `api.test.ts` 1, `router.test.ts` 2 (the on-build push of `referral`; the route list), `settingsPresale.test.tsx` 1 (the on run: no row), `presaleSwitch.test.ts` 1, `Settings.test.tsx` 2 (the rows; rule 6 finds no "Refer a friend"). The off run (`npx vitest run --config vitest.nopresale.config.ts`) is green on the old tree — `Test Files  17 passed (17)` · `Tests  433 passed | 15 skipped (448)`: its new rows are the negative half (the off build has no row, no route) and hold before as after; their positive half is the on run's red above.

- [ ] **Step 3: Implement.**

Create `extension/src/background/presale/referral.ts`:

```ts
import {PublicKey} from '@solana/web3.js';
import type {WalletDeps} from '../deps';
import {allocationFacts} from './state';
import {derivePresalePdas} from '../../../../core/presale/allocation';
import {buildReferralLink} from '../../../../core/referral/index';

/**
 * B1d §3.5 "#24's data", §4.4 (C1, D4): what #24 shows. `link` is the account's invite link as the website and the app
 * build it (core's buildReferralLink), whole. `earnedBase` is the account's allocation's `referral_bonus_tokens`, read
 * from chain — never the coordinator's bonus figures (it reports 0 for a bonus the program credited; memory "referral
 * and backend contract"); no allocation on chain is 0 earned. `referrals` and `referredCents` are GET
 * /referral-stats/<address>'s aggregates, the dollars made whole cents here. A source that fails gives null for its own
 * fields only (#24 shows "—"); nothing stands in for a source that did not answer. Numbers are decimal strings of bigints.
 */
export interface ReferralView {
  link: string;
  earnedBase: string | null;
  referrals: string | null;
  referredCents: string | null;
}

/**
 * The two aggregates #24 shows, read strictly from a /referral-stats body (`{success: true, data}`, the coordinator's
 * postgres.js getReferralStats): `totalReferrals` — the people who bought through the address — a non-negative integer,
 * and `totalReferredUsd` — the dollars they spent — a non-negative finite number, as whole cents. NOT core's
 * fetchReferralStats: that turns a missing or ill-typed field into 0, a figure with no source. Null when either is not
 * said validly — both come from one answer and stand or fall together. The body's other keys are not read.
 */
export function referralStatsFrom(body: unknown): {referrals: bigint; referredCents: bigint} | null {
  if (typeof body !== 'object' || body === null) return null;
  const {success, data} = body as {success?: unknown; data?: unknown};
  if (success !== true || typeof data !== 'object' || data === null) return null;
  const {totalReferrals, totalReferredUsd} = data as {totalReferrals?: unknown; totalReferredUsd?: unknown};
  if (typeof totalReferrals !== 'number' || !Number.isSafeInteger(totalReferrals) || totalReferrals < 0) return null;
  if (typeof totalReferredUsd !== 'number' || !Number.isFinite(totalReferredUsd) || totalReferredUsd < 0) return null;
  // The coordinator sums dollars as a double (0.29 is 0.28999…): rounded to the cent, the one place a float is read.
  const cents = Math.round(totalReferredUsd * 100);
  if (!Number.isSafeInteger(cents)) return null;
  return {referrals: BigInt(totalReferrals), referredCents: BigInt(cents)};
}

/** The account's allocation's referral_bonus_tokens (rule 6: the program's account of this very address), or null. */
async function earnedBase(deps: WalletDeps, account: string): Promise<bigint | null> {
  const address = derivePresalePdas(new PublicKey(account)).userAllocation.toBase58();
  try {
    const read = await deps.reader.getAccountsData([address]);
    const facts = read.length === 1 ? allocationFacts(read[0], account) : null;
    return facts === null ? null : facts.bonusBase;
  } catch {
    return null;
  }
}

/** /referral-stats for the account through the shared latch — a 403 trips it there and is never retried here. */
async function stats(deps: WalletDeps, account: string): Promise<{referrals: bigint; referredCents: bigint} | null> {
  try {
    return referralStatsFrom(await deps.getJson(`/referral-stats/${account}`));
  } catch {
    return null;
  }
}

/** #24's data for `account` (a key of the unlocked session): the two sources read side by side, each failing alone. */
export async function referralView(deps: WalletDeps, account: string): Promise<ReferralView> {
  const [earned, s] = await Promise.all([earnedBase(deps, account), stats(deps, account)]);
  return {
    link: buildReferralLink(account),
    earnedBase: earned === null ? null : earned.toString(),
    referrals: s === null ? null : s.referrals.toString(),
    referredCents: s === null ? null : s.referredCents.toString(),
  };
}
```

`extension/src/background/deps.ts`:

```diff
diff --git a/extension/src/background/deps.ts b/extension/src/background/deps.ts
index 9c748b9..dd0b786 100644
--- a/extension/src/background/deps.ts
+++ b/extension/src/background/deps.ts
@@ -24,6 +24,8 @@ export interface WalletDeps {
   geo(): Promise<GeoAnswer>;
   /** B1d §2.4: POST JSON to a bare path under API_BASE through the shared latch — every status answered (createJsonPoster). */
   postJson(path: string, body: unknown): Promise<PostAnswer>;
+  /** B1d §3.5: GET JSON from a bare path under API_BASE through the shared latch (createJsonGetter) — a non-200 throws. */
+  getJson(path: string): Promise<unknown>;
   now(): number;
   randomBytes(n: number): Uint8Array;
   sleep(ms: number): Promise<void>;
@@ -193,6 +195,7 @@ export function browserDeps(ext: Ext): WalletDeps {
     },
     geo: () => gate.check(),
     postJson: (path, body) => poster.post(path, body),
+    getJson: path => get.get<unknown>(path),
     now: () => Date.now(),
     // A CSPRNG: ids for prepared sends, pending records and re-auth challenges.
     randomBytes: n => globalThis.crypto.getRandomValues(new Uint8Array(n)),
```

`extension/src/background/presale/api.ts`:

```diff
diff --git a/extension/src/background/presale/api.ts b/extension/src/background/presale/api.ts
index af77b88..8ade0d2 100644
--- a/extension/src/background/presale/api.ts
+++ b/extension/src/background/presale/api.ts
@@ -12,6 +12,7 @@ import {readPresaleConfig, readPresaleState, type PresaleSnapshot, type PresaleS
 import {PRESALE_CURRENCIES, quote, type PresaleBalances, type PresaleCurrency, type QuoteLine} from './quote';
 import {PRESALE_BUY_KIND, PurchaseRefused, checkReferrer, gateAnswer, parsePurchaseIntent, preparePurchase, purchasePreparedFor} from './buy';
 import {PRESALE_RECORD_ALARM, unrecordedFor, wakePresaleRecords} from './record';
+import {referralView} from './referral';
 import {CHALLENGE_ID} from '../reauthChallenges';
 import {SendRefused} from '../sendTypes';
 import {MAINNET_USDC_MINT, MAINNET_USDT_MINT} from '../../../../core/presale/addresses';
@@ -35,6 +36,7 @@ export const PRESALE_MESSAGE_TYPES: readonly string[] = [
   'presale.discardPrepared',
   'presale.unrecorded',
   'presale.checkReferrer',
+  'presale.referral',
 ];
 
 /** `presale.quote` answers from the last view's snapshot of the account at most this old (§1.4). */
@@ -69,9 +71,10 @@ export interface BalancesView {
 }
 /**
  * §2.5 (B1d-2): the referrer registered on chain, or null; `canRegister` — #23 offers the referral address — exactly when
- * this is a first purchase and there is none (D8: an on-chain referrer always wins).
+ * this is a first purchase and there is none (D8: an on-chain referrer always wins). (§3.5's `ReferralView` is #24's,
+ * referral.ts.)
  */
-export interface ReferralView {
+export interface ReferralState {
   onChain: string | null;
   canRegister: boolean;
 }
@@ -83,7 +86,7 @@ export type PresaleView =
   | {open: false; why: 'unavailable'; code: UnavailableCode; pending: PendingView | null}
   | {open: false; why: 'inactive' | 'blocked'; state: StageView; pending: PendingView | null}
   | {open: false; why: 'geo'; geo: GeoAnswer; state: StageView | null; pending: PendingView | null}
-  | {open: true; state: StageView; limits: LimitsView; allocation: AllocationView; balances: BalancesView; solUsdMicros: string | null; countryCode: string | null; referral: ReferralView; pending: PendingView | null};
+  | {open: true; state: StageView; limits: LimitsView; allocation: AllocationView; balances: BalancesView; solUsdMicros: string | null; countryCode: string | null; referral: ReferralState; pending: PendingView | null};
 /** §3.2. `cents` and `nocBase` are null only with `line: 'no-sol-price'`. */
 export interface Quote {
   amount: string;
@@ -396,6 +399,12 @@ async function unrecordedMessage(ext: Ext, _deps: WalletDeps, msg: Readonly<Reco
   return 'answer' in a ? a.answer : {ok: true, data: await unrecordedFor(ext, a.account)};
 }
 
+/** presale.referral {account} (§1.4, §3.5, §4.4, B1d-2): #24's ReferralView — the chain's and the coordinator's, each failing alone. */
+async function referralMessage(ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>): Promise<Result> {
+  const a = await accountOnly(ext, msg);
+  return 'answer' in a ? a.answer : {ok: true, data: await referralView(deps, a.account)};
+}
+
 /** A handler's unexpected failure (a storage error) is `failed`, never a thrown error across the message boundary. */
 const guarded =
   (h: (ext: Ext, deps: WalletDeps, msg: Readonly<Record<string, unknown>>) => Promise<Result>) =>
@@ -418,6 +427,7 @@ export function registerPresale(host: PresaleHost): void {
   host.handle('presale.discardPrepared', guarded(discardMessage));
   host.handle('presale.unrecorded', guarded(unrecordedMessage));
   host.handle('presale.checkReferrer', guarded(checkReferrerMessage));
+  host.handle('presale.referral', guarded(referralMessage));
   // §2.4: the record's retry wakes on its alarm, and resumes at every start (a worker stopped between two slots, or
   // between a purchase's confirmation and its entry — reconciled first).
   host.alarm(PRESALE_RECORD_ALARM, () => wakePresaleRecords(host.ext, host.deps));
```

`extension/src/app/presale/client.ts`:

```diff
diff --git a/extension/src/app/presale/client.ts b/extension/src/app/presale/client.ts
index e20bedf..2f9eedc 100644
--- a/extension/src/app/presale/client.ts
+++ b/extension/src/app/presale/client.ts
@@ -1,4 +1,5 @@
 import {pendingOf, type Engine, type Pending, type Reply} from '../engine';
+import {buildReferralLink} from '../../../../core/referral/index';
 
 /**
  * B1d §1.4, §2.5, §3.2, §3.3: the popup's client for the presale messages #23 asks — through the shared engine's
@@ -92,6 +93,17 @@ export interface BannerData {
   stagePercent: number;
 }
 
+/**
+ * §3.5, §4.4 (B1d-2): #24's data — the account's invite link, and each figure (base units, a count, cents) or null when
+ * its source failed (shown "—").
+ */
+export interface ReferralData {
+  link: string;
+  earnedBase: bigint | null;
+  referrals: bigint | null;
+  referredCents: bigint | null;
+}
+
 /** §3.5 (B1d-2): the lines under #23's referral address — presale.checkReferrer's answers, and prepare's refusals of the address. */
 export const REFERRER_LINES = ['referrer-invalid', 'referrer-self', 'referrer-not-applicable', 'referrer-no-allocation'] as const;
 export type ReferrerLine = (typeof REFERRER_LINES)[number];
@@ -185,6 +197,8 @@ export interface PresaleClient {
   /** §3.5 (B1d-2): the line for this referral address, or null when the purchase would register it — the background's answer. */
   checkReferrer(account: string, referrer: string): Promise<Reply<ReferrerLine | null, CheckRefusal>>;
   preparedFor(account: string): Promise<Reply<ResumablePurchase | null, SessionRefusal>>;
+  /** §3.5, §4.4 (B1d-2): #24's data for the account — its own link, each figure as the background read it or null. */
+  referral(account: string): Promise<Reply<ReferralData, SessionRefusal>>;
   buy(id: string): Promise<Reply<Pending, BuyRefusal>>;
   discardPrepared(account: string): Promise<Reply<null, SessionRefusal>>;
 }
@@ -390,6 +404,19 @@ export function referrerCheckOf(x: unknown): ReferrerLine | null | undefined {
   return exactly(o, ['ok', 'line']) && o.ok === false ? oneOf(o.line, REFERRER_LINES) : undefined;
 }
 
+/**
+ * presale.referral's answer (§3.5) for `account`: exactly its four keys; the link is this account's invite link, whole
+ * (never another address's, never shortened); each figure a decimal string of a bigint, or null.
+ */
+export function referralDataOf(x: unknown, account: string): ReferralData | undefined {
+  const o = obj(x);
+  if (o === undefined || !exactly(o, ['link', 'earnedBase', 'referrals', 'referredCents']) || o.link !== buildReferralLink(account)) return undefined;
+  const figure = (v: unknown): bigint | null | undefined => (v === null ? null : units(v));
+  const [earnedBase, referrals, referredCents] = [figure(o.earnedBase), figure(o.referrals), figure(o.referredCents)];
+  if (earnedBase === undefined || referrals === undefined || referredCents === undefined) return undefined;
+  return {link: o.link, earnedBase, referrals, referredCents};
+}
+
 /** The pending record presale.buy answers: the wallet's own purchase (`intent: null`, this kind), nothing else. */
 const purchaseRecordOf = (x: unknown): Pending | undefined => {
   const p = pendingIn(x);
@@ -415,6 +442,7 @@ export function presaleClient(engine: Engine): PresaleClient {
       ),
     checkReferrer: (account, referrer) => engine.request({type: 'presale.checkReferrer', account, referrer}, CHECK_REFUSALS, referrerCheckOf),
     preparedFor: account => engine.request({type: 'presale.preparedFor', account}, SESSION, x => (x === null ? null : resumableOf(x))),
+    referral: account => engine.request({type: 'presale.referral', account}, SESSION, x => referralDataOf(x, account)),
     buy: id => engine.request({type: 'presale.buy', id}, BUY_REFUSALS, purchaseRecordOf),
     discardPrepared: account => engine.request({type: 'presale.discardPrepared', account}, SESSION, x => (x === undefined ? null : undefined)),
   };
```

`extension/src/app/presale/text.ts`:

```diff
diff --git a/extension/src/app/presale/text.ts b/extension/src/app/presale/text.ts
index b0477be..bf18161 100644
--- a/extension/src/app/presale/text.ts
+++ b/extension/src/app/presale/text.ts
@@ -150,6 +150,44 @@ export const BANNER_TEXT = {
   line: (price: string, percent: number): string => `${price} · ${percent}% to next stage`,
 } as const;
 
+/**
+ * #24 referral and #31's row into it (B1d-2, §4.4, C1, C15, C16; index.html #24 ix 10903-11233, as the app corrected
+ * it): the design's labels, the app's subs and eyebrow (Q35–Q37), useCopy's states (Q38, B1b), Q39 (D13), the legalese
+ * as drawn. Nothing here names a stake, a reward list or a date: §9 omits ACTIVE, "Recent rewards" and the toast.
+ */
+export const REFER_TEXT = {
+  /** C16: #31's row (the app's "Rewards" group) and #24's title. */
+  group: 'Rewards',
+  title: 'Refer a friend',
+  referrals: 'REFERRALS',
+  /** Q35. */
+  referralsSub: 'total joined',
+  earned: 'EARNED',
+  earnedSub: 'NOC lifetime',
+  /** Q36. */
+  referred: 'REFERRED',
+  referredSub: 'from your invites',
+  /** Q37. */
+  eyebrow: 'YOUR INVITE LINK',
+  /**
+   * Around the count (the design's `.noc-numeral`): "Used by N people", one is "Used by 1 person" — `referrals` counts the
+   * people who bought through the link, not its uses (controller copy, owner-delegated D27; the design's "Used N times").
+   */
+  usedLead: 'Used by ',
+  usedTail: (n: bigint): string => (n === 1n ? ' person' : ' people'),
+  notUsed: 'Not used yet',
+  /** The app's accessible name of the copy icon. */
+  copy: 'Copy invite link',
+  /** Q38 (useCopy, B1b): Copy's and "Share invite link"'s states. */
+  copied: 'Copied',
+  copyFailed: 'Copy failed',
+  share: 'Share invite link',
+  /** Q39 (D13: no numbers until the coordinator's tier rule is confirmed). */
+  banner: 'Earn NOC when friends you invite buy in the presale.',
+  legalese: 'Referral payouts are subject to program terms. Self-referrals are detected and rejected.',
+  none: '—',
+} as const;
+
 /**
  * #50b region blocked, presale (§4.3, index.html #50 ix 19612-19906): the design's own lines where §4.3 keeps them, the
  * approved lines and Q20–Q30 (controller copy, owner-delegated 2026-10-19) where it replaces them. Nothing here names a
@@ -211,6 +249,11 @@ export function raisedText(cents: bigint): string {
 /** A NOC amount in millions, floored: "10.24 M NOC" (Q01's cap). */
 export const millionsNoc = (base: bigint): string => `${formatAmount(base / 10n ** 13n, 2, {min: 2, max: 2})} M NOC`;
 
+/** #24's figures (§4.4): EARNED in NOC to one place as drawn ("32.4", "0.0"), floored; REFERRED in dollars and cents; REFERRALS grouped. */
+export const earnedText = (base: bigint): string => formatAmount(base, 9, {min: 1, max: 1});
+export const referredText = (cents: bigint): string => `$${formatAmount(cents, 2, {min: 2, max: 2})}`;
+export const countText = (n: bigint): string => group(n);
+
 /** A limit in dollars, as core's lines write it: "$10", "$50,000", "$199,700.50" — whole dollars without cents. */
 export const dollarsText = (cents: bigint): string => (cents % 100n === 0n ? `$${group(cents / 100n)}` : `$${formatAmount(cents, 2, {min: 2, max: 2})}`);
 
```

Create `extension/src/app/presale/ReferFriend.tsx`:

```tsx
import {Fragment, useEffect, useMemo, useState} from 'react';
import {useWallet} from '../WalletContext';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {SkelLine} from '../ui/Skeleton';
import {useCopy} from '../ui/useCopy';
import {presaleClient, type ReferralData} from './client';
import {PRESALE_TEXT, REFER_TEXT, countText, earnedText, referredText} from './text';

/**
 * One of the three stat cards (the design's `.stat`): label, value ("—" when its source failed), sub. A figure wider
 * than its third of the row breaks only after a group separator ("123,456,<wbr>789.0").
 */
function Stat({label, value, sub, tone}: {label: string; value: string | null; sub: string; tone: 'acc' | 'muted' | null}) {
  return (
    <div className="stat">
      <span className="lbl noc-overline">{label}</span>
      {value === null ? (
        <SkelLine width={48} height={26} />
      ) : (
        <span className={`val noc-balance-md noc-numeral${tone === 'acc' ? ' acc' : tone === 'muted' ? ' app-ref-muted' : ''}`}>
          {value.split(',').map((part, i, all) => (
            <Fragment key={i}>
              {part}
              {i < all.length - 1 ? (
                <>
                  ,<wbr />
                </>
              ) : null}
            </Fragment>
          ))}
        </span>
      )}
      <span className="lbl noc-caption">{sub}</span>
    </div>
  );
}

/**
 * #24 referral (B1d-2, §3.5, §4.4; index.html #24 ix 10903-11233 as the app corrected it, C1): one `presale.referral` on
 * every mount, and what it answered as drawn — three stat cards (REFERRALS, EARNED from chain, REFERRED; "—" for a
 * figure whose source failed), the code card with the invite link whole in `.noc-mono` (the address is the code),
 * "Used by N people" / "Not used yet" (hidden when REFERRALS has no source), Copy and "Share invite link" — both copy the
 * link through one useCopy (C15: the popup has no share sheet): while it says `copied` the Copy icon is the checkmark and
 * the code row carries the `--accent` border (24a-bis without its toast: no clipboardWrite, no auto-clear), and the
 * share button says the state (Q38) — "Copy failed" never shows the checkmark. Then Q39's banner and the legalese. A
 * reply that failed shows "—" for every figure, no link and Q11. The design's ACTIVE card, "Recent rewards" and its
 * rows, "View all" and the toast are omitted (§9); the background decides every figure (C3).
 */
export function ReferFriend({onBack}: {onBack: () => void}) {
  const m = useWallet();
  const account = m.account?.publicKey ?? null;
  const client = useMemo(() => presaleClient(m.engine), [m.engine]);
  const {reload} = m;
  const [shown, setShown] = useState<{account: string; data: ReferralData | null} | null>(null);
  const [copy, doCopy] = useCopy();

  useEffect(() => {
    if (account === null) return;
    let alive = true;
    void client.referral(account).then(r => {
      if (!alive) return;
      if (!r.ok && r.error === 'locked') {
        void reload();
        return;
      }
      setShown({account, data: r.ok ? r.data : null});
    });
    return () => {
      alive = false;
    };
  }, [account, client, reload]);

  const loaded = shown !== null && shown.account === account;
  const data = loaded ? shown.data : null;
  /** A figure: still loading → null (a skeleton); its source failed, or the reply did → "—". */
  const figure = (v: bigint | null | undefined, text: (v: bigint) => string): string | null => (!loaded ? null : v === null || v === undefined ? REFER_TEXT.none : text(v));
  const earned = data?.earnedBase;
  const copied = copy === 'copied';
  const copyState = copy === 'copied' ? REFER_TEXT.copied : copy === 'failed' ? REFER_TEXT.copyFailed : null;

  return (
    <div className="screen s-ref">
      <TopBar title={REFER_TEXT.title} titleClass="noc-h3" onBack={onBack} />
      <div className="scroll">
        <div className="stats">
          <Stat label={REFER_TEXT.referrals} value={figure(data?.referrals, countText)} sub={REFER_TEXT.referralsSub} tone={null} />
          <Stat label={REFER_TEXT.earned} value={figure(earned, earnedText)} sub={REFER_TEXT.earnedSub} tone={typeof earned === 'bigint' && earned > 0n ? 'acc' : loaded ? 'muted' : null} />
          <Stat label={REFER_TEXT.referred} value={figure(data?.referredCents, referredText)} sub={REFER_TEXT.referredSub} tone={null} />
        </div>
        {loaded && data === null ? (
          <p className="noc-body-sm app-ref-failed" role="alert">
            {PRESALE_TEXT.unavailable}
          </p>
        ) : (
          <div className="code-card">
            <div className="lbl-row">
              <span className="noc-overline">{REFER_TEXT.eyebrow}</span>
              {data === null || data.referrals === null ? null : data.referrals === 0n ? (
                <span className="uses noc-caption">{REFER_TEXT.notUsed}</span>
              ) : (
                <span className="uses noc-caption">
                  {REFER_TEXT.usedLead}
                  <span className="noc-numeral">{countText(data.referrals)}</span>
                  {REFER_TEXT.usedTail(data.referrals)}
                </span>
              )}
            </div>
            <div className={copied ? 'code-row app-ref-copied' : 'code-row'}>
              {data === null ? (
                <span className="code">
                  <SkelLine width={220} height={20} />
                </span>
              ) : (
                <span className="code noc-mono app-ref-link">{data.link}</span>
              )}
              <div className="actions">
                <button type="button" className={copied ? 'app-ref-check' : undefined} aria-label={copyState ?? REFER_TEXT.copy} disabled={data === null} onClick={() => data !== null && doCopy(data.link)}>
                  <ExtIcon name={copied ? 'check' : copy === 'failed' ? 'close' : 'copy'} size={18} />
                </button>
              </div>
            </div>
            <button type="button" className="share-btn" disabled={data === null} onClick={() => data !== null && doCopy(data.link)}>
              <ExtIcon name="share" size={16} />
              <span role="status" aria-live="polite">
                {copyState ?? REFER_TEXT.share}
              </span>
            </button>
          </div>
        )}
        <div className="banner shield app-ref-banner">
          <ExtIcon name="info" size={16} />
          <div className="copy">
            <span className="noc-body-sm">{REFER_TEXT.banner}</span>
          </div>
        </div>
        <p className="legalese noc-caption">{REFER_TEXT.legalese}</p>
      </div>
    </div>
  );
}
```

`extension/src/app/presale/routes.tsx`:

```diff
diff --git a/extension/src/app/presale/routes.tsx b/extension/src/app/presale/routes.tsx
index 371dba2..52ca487 100644
--- a/extension/src/app/presale/routes.tsx
+++ b/extension/src/app/presale/routes.tsx
@@ -2,6 +2,7 @@ import type {PresaleRoute, PresaleRouteValue} from '../router';
 import {Presale} from './Presale';
 import {PresaleConfirm} from './PresaleConfirm';
 import {Geo} from './Geo';
+import {ReferFriend} from './ReferFriend';
 import {PREPARE_REFUSALS, PRESALE_CURRENCIES, type PrepareRefusal, type PresaleCurrency} from './client';
 
 /**
@@ -71,6 +72,16 @@ export const GEO_ROUTE: PresaleRoute = {
   render: (_route, nav) => <Geo onBack={nav.pop} onClose={nav.home} onDone={nav.pop} />,
 };
 
+/**
+ * B1d §4.4 (B1d-2): #24 — the route `referral`, carrying nothing (it reads `presale.referral` itself), pushed by #31's
+ * "Refer a friend" row (C16). Back returns to #31.
+ */
+export const REFERRAL_ROUTE: PresaleRoute = {
+  screen: 'referral',
+  isRoute: o => o.screen === 'referral' && Object.keys(o).length === 1,
+  render: (_route, nav) => <ReferFriend onBack={nav.pop} />,
+};
+
 /**
  * B1d §4.2: #20's purchase variant — `presale-confirm` with the account and `entry: 'flow'` and the prepared id #23
  * handed over, or `entry: 'resume'` (a reopened popup, the tab's hand-over after #10), never anything else: what it
```

`extension/src/app/presale/index.ts`:

```diff
diff --git a/extension/src/app/presale/index.ts b/extension/src/app/presale/index.ts
index 1903c15..29017c5 100644
--- a/extension/src/app/presale/index.ts
+++ b/extension/src/app/presale/index.ts
@@ -1,12 +1,13 @@
 import type {PresaleRoute, PresaleSlots} from '../router';
-import {GEO_ROUTE, PRESALE_CONFIRM_ROUTE, PRESALE_ROUTE} from './routes';
+import {GEO_ROUTE, PRESALE_CONFIRM_ROUTE, PRESALE_ROUTE, REFERRAL_ROUTE} from './routes';
 import {PRESALE_SLOTS} from './records';
 
 /**
  * B1d §1.1: the popup's presale entry — the one module of `src/app/presale/` that shared code imports (the router, App
  * and the screens that show a record take `presaleRoutes` / `presaleSlots`). The build without presale resolves it to
  * `src/presale-off/app.ts`. B1d-1b: #23 (Task 4), #20's purchase variant and the slots — the record words of #21, #44
- * and #54 and the resume paths (Task 5); #50b (`geo`) and #11's banner, Buy and pending row (Task 6).
+ * and #54 and the resume paths (Task 5); #50b (`geo`) and #11's banner, Buy and pending row (Task 6). B1d-2 Task 4: #24
+ * (`referral`) and #31's row into it.
  */
-export const presaleRoutes: readonly PresaleRoute[] = [PRESALE_ROUTE, PRESALE_CONFIRM_ROUTE, GEO_ROUTE];
+export const presaleRoutes: readonly PresaleRoute[] = [PRESALE_ROUTE, PRESALE_CONFIRM_ROUTE, GEO_ROUTE, REFERRAL_ROUTE];
 export const presaleSlots: PresaleSlots | null = PRESALE_SLOTS;
```

`extension/src/app/router.ts`:

```diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index 2dca187..981fca4 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -124,6 +124,8 @@ export interface PresaleSlots {
   banner(engine: Engine): Promise<HomeBanner | null>;
   /** §4.5: where #11's Buy (and its banner) goes for this account — #23, #50b, or null: no route, the action hides. */
   buy(engine: Engine, account: string): Promise<PresaleRouteValue | null>;
+  /** B1d-2 (C16, §4.4): #31's row into the entry's own screen — its group label, its title, and the route it pushes. */
+  settings: {group: string; title: string; route: PresaleRouteValue};
 }
 export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};
 
```

`extension/src/app/presale/records.ts`:

```diff
diff --git a/extension/src/app/presale/records.ts b/extension/src/app/presale/records.ts
index c44dbe3..a5842d9 100644
--- a/extension/src/app/presale/records.ts
+++ b/extension/src/app/presale/records.ts
@@ -2,7 +2,7 @@ import {showExact} from '../send/rules';
 import {showUsd} from '../format';
 import type {KindRecord, PresaleSlots} from '../router';
 import {PURCHASE_KIND, presaleClient, purchaseDataOf} from './client';
-import {BANNER_TEXT, CONFIRM_PURCHASE_TEXT, RECORD_TEXT, priceText} from './text';
+import {BANNER_TEXT, CONFIRM_PURCHASE_TEXT, RECORD_TEXT, REFER_TEXT, priceText} from './text';
 import {againRoute} from './routes';
 
 /**
@@ -13,7 +13,7 @@ import {againRoute} from './routes';
  * `resume` is §4.2's resume paths: `presale.preparedFor` for the account, and #20's purchase variant (`resume`) for a
  * prepared purchase. `banner` and `buy` are #11's (§4.5): the banner as `presale.banner` answered it (no geo check;
  * null for any failure or an inactive sale), and Buy's routing from a fresh `presale.view` — an open purchase or an open
- * sale → #23, the gate closed → #50b, anything else → no route.
+ * sale → #23, the gate closed → #50b, anything else → no route. `settings` is #31's row into #24 (B1d-2, C16).
  */
 export const PRESALE_SLOTS: PresaleSlots = {
   record(extra): KindRecord | null {
@@ -56,4 +56,5 @@ export const PRESALE_SLOTS: PresaleSlots = {
     if (v.pending !== null || v.open) return {screen: 'presale'};
     return v.why === 'geo' ? {screen: 'geo'} : null;
   },
+  settings: {group: REFER_TEXT.group, title: REFER_TEXT.title, route: {screen: 'referral'}},
 };
```

`extension/src/app/screens/Settings.tsx`:

```diff
diff --git a/extension/src/app/screens/Settings.tsx b/extension/src/app/screens/Settings.tsx
index c9ffe1b..9872007 100644
--- a/extension/src/app/screens/Settings.tsx
+++ b/extension/src/app/screens/Settings.tsx
@@ -8,6 +8,8 @@ import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
 import {securityTasks} from './Security';
 import {contactsCount} from '../addressBook';
 import type {Settings as StoredSettings} from '../engine';
+import type {PresaleRouteValue} from '../router';
+import {presaleSlots} from '../presale';
 
 /** #31's copy (B1b-2b §4.1): the design's strings adapted where marked, 2a's, and O42–O46. */
 export const SETTINGS_TEXT = {
@@ -57,7 +59,9 @@ export const PASSWORD_TOAST_WINDOW_MS = 10 * 60_000;
  * the timestamp shown; a future stamp shows nothing). The tab reads the facts again when shown again. Every row that opens a page is a LockedButton (rule 6). The rows #31 draws and the extension does
  * not have are omitted (D22; the spec's Differs list). Plan 2: Connections › Address book (ix:13552), meta "N contacts"
  * from contacts.list — a refusal leaves the meta empty; the row still opens #15. B1c §4.1: Connections › Connected dApps
- * above it (#i-plug), meta "<n> connected" (Q07) from dapp.grants.list — empty when none or refused; → #49.
+ * above it (#i-plug), meta "<n> connected" (Q07) from dapp.grants.list — empty when none or refused; → #49. B1d-2
+ * (C16): the presale entry's row (#24, "Refer a friend" in its own group) after Connections — only where the entry has
+ * slots; the build without presale has none, and shared code names neither its words nor its route.
  */
 export function Settings({
   onProfile,
@@ -67,6 +71,7 @@ export function Settings({
   onAbout,
   onContacts,
   onConnected,
+  onRoute,
   toastMs = 1_800,
   decorateMs = 5_000,
 }: {
@@ -79,6 +84,8 @@ export function Settings({
   onContacts: () => void;
   /** B1c §4.1: Connections › Connected dApps → #49. */
   onConnected: () => void;
+  /** B1d-2 (C16): the presale entry's row → its route (#24), pushed as the reducer decides. */
+  onRoute: (route: PresaleRouteValue) => void;
   toastMs?: number;
   decorateMs?: number;
 }) {
@@ -156,6 +163,7 @@ export function Settings({
     m.platform.openPage(page);
     if (m.surface === 'popup') m.platform.closeWindow();
   };
+  const entry = presaleSlots === null ? null : presaleSlots.settings;
   const tasks = stored === null ? null : securityTasks(passkey, stored.phraseVerifiedAt).length;
   const pageRow = (icon: ExtIconName, title: string, page: ExtensionPage, meta: {text: string; tone: 'warning' | 'success' | null} | null, justUpdated = false) => (
     <LockedButton className={justUpdated ? 's7-row app-just-updated' : 's7-row'} onPress={() => open(page)}>
@@ -238,6 +246,14 @@ export function Settings({
           <ListRow icon="plug" title={SETTINGS_TEXT.connectedDapps} meta={grants === null || grants === 0 ? '' : SETTINGS_TEXT.connectedCount(grants)} onPress={onConnected} />
           <ListRow icon="link" title={SETTINGS_TEXT.addressBook} meta={contacts === null ? '' : contactsCount(contacts)} onPress={onContacts} />
         </div>
+        {entry === null ? null : (
+          <>
+            <div className="s7-group-label">{entry.group}</div>
+            <div className="s7-list">
+              <ListRow icon="users" title={entry.title} onPress={() => onRoute(entry.route)} />
+            </div>
+          </>
+        )}
         <div className="s7-group-label">{SETTINGS_TEXT.advanced}</div>
         <div className="s7-list">
           <ListRow icon="trash" title={SETTINGS_TEXT.deleteTitle} onPress={onDelete} danger />
```

`extension/src/app/App.tsx`:

```diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index b1689e7..c51ce54 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -254,6 +254,8 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
           onAbout={() => go({type: 'push', route: {screen: 'about'}})}
           onContacts={() => go({type: 'push', route: {screen: 'contacts', pick: false}})}
           onConnected={() => go({type: 'push', route: {screen: 'connected'}})}
+          // B1d-2 (C16): #31's presale row → #24 (none in the build without presale).
+          onRoute={next => presaleNavigation.push(next)}
         />
       );
     }
```

`extension/src/app/ui/ExtIcon.tsx` (#i-share from the design's sprite, ix 4341):

```diff
diff --git a/extension/src/app/ui/ExtIcon.tsx b/extension/src/app/ui/ExtIcon.tsx
index da984f3..b6adc7d 100644
--- a/extension/src/app/ui/ExtIcon.tsx
+++ b/extension/src/app/ui/ExtIcon.tsx
@@ -63,7 +63,9 @@ export type ExtIconName =
   | 'rocket'
   | 'buy'
   // B1d-1b Task 6: #50b's "Why this matters" row (#i-file-text), from the sprite.
-  | 'file-text';
+  | 'file-text'
+  // B1d-2 Task 4: #24's "Share invite link" (#i-share), from the sprite.
+  | 'share';
 
 const PATHS: Record<ExtIconName, ReactNode> = {
   // B1d-1b, from the design's sprite: #i-rocket and #i-buy.
@@ -82,6 +84,16 @@ const PATHS: Record<ExtIconName, ReactNode> = {
       <path d="M15 9.5C13.5 8 11 8 9.5 9.5S8 13 9.5 14.5L12 15c1.5.5 3 1 3 2.5S13.5 19 12 19s-3-.5-3-2" />
     </>
   ),
+  // B1d-2 Task 4, from the design's sprite: #i-share.
+  share: (
+    <>
+      <circle cx="18" cy="5" r="3" />
+      <circle cx="6" cy="12" r="3" />
+      <circle cx="18" cy="19" r="3" />
+      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
+      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
+    </>
+  ),
   'file-text': (
     <>
       <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
```

`extension/src/app/app.css` (what the mockup sets inline, and the two visual-check fixes — the equal thirds and the wrap points; see the visual check below):

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 379d7d0..3fed143 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -2308,3 +2308,44 @@ body:has(.app-window) {
 .s11-stillworks .app-geo-works {
   color: var(--success);
 }
+
+/* B1d-2 Task 4: #24 referral (index.html #24, ix:10903-11233) — what the mockup sets inline, and the link it shows
+   whole where the design drew a 14-character code. */
+/* Three equal thirds whatever the figures (the design's `1fr` grows a column to its longest figure — found in the visual
+   check: "$1,234,567.89" pushed the third card out of the 412 px frame); a long figure wraps at its group separators. */
+.s-ref .stats {
+  grid-template-columns: repeat(3, minmax(0, 1fr));
+}
+.s-ref .stats .stat {
+  min-width: 0;
+}
+.s-ref .stats .stat .val.app-ref-muted {
+  color: var(--fg-tertiary);
+}
+/* 24a-bis's accent border (inline in the mockup) on a row that keeps its size: the idle row's border is transparent. */
+.s-ref .code-card .code-row {
+  border: 1px solid transparent;
+}
+.s-ref .code-card .code-row.app-ref-copied {
+  border-color: var(--accent);
+}
+.s-ref .code-card .actions button.app-ref-check {
+  color: var(--accent);
+}
+/* The whole invite link (C1: never truncated), broken anywhere, at the size its 68 characters fit in three lines. */
+.s-ref .code-card .code-row .code.app-ref-link {
+  font-size: 13px;
+  line-height: 20px;
+  letter-spacing: 0;
+  word-break: break-all;
+}
+.s-ref .banner.app-ref-banner {
+  background: var(--bg-surface-2);
+}
+.s-ref p.legalese,
+.s-ref p.app-ref-failed {
+  margin: 0;
+}
+.s-ref p.app-ref-failed {
+  color: var(--fg-secondary);
+}
```

`extension/scripts/extract-design-css.mjs`, then run `node scripts/extract-design-css.mjs` (writes `src/styles/design-ext.css`: +124 lines, the 31 `.s-ref` rules of ix 2799-2929, appended; `sha256sum src/styles/design-ext.css` = `ab642e2a20c7abcddcd4b657ed480132a4fa17a806a914a9a07455f056adfb3d`, the value Step 1 pins; `node scripts/extract-design-css.mjs --check` exits 0):

```diff
diff --git a/extension/scripts/extract-design-css.mjs b/extension/scripts/extract-design-css.mjs
index 9395b9a..e2517bc 100644
--- a/extension/scripts/extract-design-css.mjs
+++ b/extension/scripts/extract-design-css.mjs
@@ -46,6 +46,8 @@ export const PREFIXES = ['.screen', '.top-bar', '.sticky-bar', '.scroll-area', '
   '.s-pre',
   // B1d-1b Task 6: #50 geo-blocked, from the Section XI block (SECTION_XI_PREFIXES, above).
   ...SECTION_XI_PREFIXES,
+  // B1d-2 Task 4: #24 referral (its rules at ix:2799-2929; the reward list's rules come with it, unused — §9 omits the list).
+  '.s-ref',
 ];
 export const KEYFRAMES = ['shimmer', 'spin', 'shake',
   // Plan 3: what the send-flow rules animate with (#19's progress strip and skeleton, #21's ring and status dot, #54's ring; #20's caret — its rule comes with .s-conf, the typed field does not, D22).
```

`extension/scripts/check-no-presale.mjs`:

```diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index 2e5ad2e..d1305e9 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -31,7 +31,7 @@ export const WEB_ALLOWED = ['../web/src/ui/', '../web/src/styles/'];
 // (§2.1); 1b adds presale/quote.ts (Task 1), presale/buy.ts (Task 2), #23's popup modules (Task 4), #20's purchase
 // variant with the record slot (Task 5), #50b (Task 6) and core/presale/{buyInstructions,referrer}.ts — the purchase's
 // builder and its referrer allocation, in the on build's module map since Tasks 1–2 (Task 8); B1d-2 adds
-// presale/record.ts (Task 1), presale/referral.ts and core/referral/index.ts.
+// presale/record.ts (Task 1), and #24's background presale/referral.ts with core/referral/index.ts and its screen (Task 4).
 export const ON_BUILD = [
   'src/background/presale/api.ts',
   'src/app/presale/index.ts',
@@ -51,6 +51,9 @@ export const ON_BUILD = [
   'core/presale/buyInstructions.ts',
   'core/presale/referrer.ts',
   'src/background/presale/record.ts',
+  'src/background/presale/referral.ts',
+  'core/referral/index.ts',
+  'src/app/presale/ReferFriend.tsx',
 ];
 // The intent-kind registry (C19 — both builds sign and read through it); the jurisdiction gate and its fetcher (D15:
 // the off build did not lose the gate); the country's name #48's F12 banner shows (B1d-1b Task 7, §3.6); the presale
@@ -156,6 +159,21 @@ export const MARKERS = [
   "You can't refer yourself or another account in this wallet",
   "This address has no presale allocation, so it can't receive a referral bonus",
   'This account can no longer take a referrer — review again',
+  // B1d-2 Task 4: #24's message type, then #31's row and #24's title (§6.2's "Refer a friend"), Q35, the EARNED sub, Q36,
+  // Q37, "Not used yet", "Used by " (D27: the count is people), the copy icon's name, "Share invite link", Q39 and the legalese (the route name `referral` is one
+  // bare word: these arm it; REFERRALS / EARNED / REFERRED, "Rewards" and Q38 — B1b's, both builds — are not markers).
+  'presale.referral',
+  'Refer a friend',
+  'total joined',
+  'NOC lifetime',
+  'from your invites',
+  'YOUR INVITE LINK',
+  'Not used yet',
+  'Used by ',
+  'Copy invite link',
+  'Share invite link',
+  'Earn NOC when friends you invite buy in the presale.',
+  'Referral payouts are subject to program terms. Self-referrals are detected and rejected.',
 ];
 // Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
 // be a string search. The decoder's instruction names are read from its source (DECODER).
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates.**

Run: the Step 2 vitest command — `Test Files  12 passed (12)` · `Tests  316 passed (316)` (check-no-presale 52, router 39, deps 20, designExt2b 9, messages 29, client 23, api 68, presaleSwitch 3, settingsPresale 1, Settings 32, ReferFriend 16, referral 24).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  221 passed (221)` · `Tests  4655 passed (4655)` (previous tree 218 / 4607: +3 files, +48 tests — ReferFriend 16, referral 24, settingsPresale 1, client +2, deps +2, router +2, designExt2b +1). **Dry-run observation, not this task's:** on 2026-10-25 after 23:00 CET (an earlier run of this task; the final run is the green total above) the dry run saw `Send.test.tsx` "sent before (E6): … last 12 days ago" read "last 11 days ago" — red on Task 3's tree too, green under `TZ=UTC`: the test computes `Date.now() - 12 * DAY` while `sentBeforeText` counts local calendar days, which a DST change in those twelve days shifts by one in the last hour of a day (writer notes). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  17 passed (17)` · `Tests  433 passed | 15 skipped (448)` (previous 16 / 430: `settingsPresale` 1, `router` +2).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build (`classes ok`: every class #24 uses — the design's `.s-ref` rules, `app-ref-muted`, `app-ref-copied`, `app-ref-check`, `app-ref-link`, `app-ref-banner`, `app-ref-failed` — is defined; `rpc methods ok`: no new method, and `deps.ts` stays the only caller of the global fetch; `no TGE date`: 656 files), the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 26 required modules; 96 markers (none in the off build, each in the on build); 9 strings and the decoder's instruction names stay in the off build`. No root `src/`, no `core/` and no `web/` change: the root `tsc` / `jest` and web's `verify` are not this task's.

Playwright (this task changes #31 and adds #24): `npx playwright test e2e/visual.spec.ts e2e/presaleOff.spec.ts e2e/settings.spec.ts e2e/visual-settings.spec.ts e2e/presaleSwitch.spec.ts e2e/contacts.spec.ts e2e/containment.spec.ts e2e/csp.spec.ts` — `21 passed (7.3m)` normally and `21 passed (7.6m)` under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'` (the on build's #31 now lists "Refer a friend" — `visual.spec.ts`; E2E 7 still finds the off build's ten rows and no `presale|referral` text — `presaleOff.spec.ts`, unchanged). No committed E2E opens #24 yet (E2E 11 is Task 6's: the fake coordinator has no `/referral-stats` route until then).

**Visual check (dry run; shots kept in the scratchpad, never committed — Task 7 owns the committed shots).** A scratch spec in a scratch copy, with the scratch copy's fake coordinator patched to answer `GET /referral-stats/<address>` with a scripted status and body (three hunks: a `referralStats` field, its default, its route — never committed; Task 6 builds the route), driving the real extension: unlock, #31 → "Refer a friend" → #24 at the popup's 412 × 600 frame, each shot measured (`document.documentElement.scrollWidth` 412; the link's `scrollWidth` = `clientWidth`, its right edge inside the frame; each stat value's `scrollWidth` ≤ its `clientWidth` and its card's right edge ≤ 392; no sticky bar), CSP clean, contained: 24a populated ("3" / "16.1" / "$1,234.56", then "Used 3 times" — the line before the D27 ruling below; its strings changed after the visual check, its layout did not); large figures ("12,345" / "123,456,789.0" / "$1,234,567.89"); 24a-bis copied (the extension's popup took the write — "Copied", the checkmark, the accent border; the clipboard's read is permission-denied to the page, so the unit test's spy is what proves the content); a null stat (`/referral-stats` 500: "—" / "16.1" / "—", no "Used" line); 24b empty (no allocation: "0" / "0.0" muted / "$0.00", "Not used yet"); #31 with the Rewards group. `1 passed` normally and under `unshare -rn`. Compared with index.html #24: the stat cards, the code card (eyebrow left, usage right; the row on `--bg-base`; the 48 px icon button; the pill share button on `--bg-surface-2`), the shield banner on `--bg-surface-2` and the centred legalese match 24a / 24b; the departures are §9's and the writer notes'. **Found and fixed in this task (the commit is after the fix):** large figures pushed the third card out of the frame — the design's `grid-template-columns: repeat(3, 1fr)` grows a column to its longest figure ("$1,234,567.89" put REFERRED's right edge past 412; the page itself did not scroll, `.app-content` hides the overflow, so `scrollWidth` alone did not catch it). Now three equal thirds (`minmax(0, 1fr)`, `min-width: 0`) and a figure breaks only after a group separator (`<wbr>` after each comma: "123,456," / "789.0"). The fix re-ran the builds, the gates, the whole suite and both Playwright passes above.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1d-2 #24 referral and the #31 row Refer a friend — presale.referral answers §3.5's ReferralView: the account's invite link whole, EARNED from the chain allocation's referral_bonus_tokens (never the coordinator's bonus; no allocation = 0), REFERRALS and REFERRED from /referral-stats through the shared latch (WalletDeps.getJson; a 403 trips it), read strictly (a missing figure is no figure) with the dollars made cents in the background; each source failing nulls only its own fields (\"—\"); #24 as drawn and as the app corrected it — three stat cards, the code card with the link in mono, Used by N people / Not used yet (people, D27; hidden without a source), Copy and Share invite link both copying the link (24a-bis checkmark and accent border, no toast; Copy failed never the checkmark), Q39, the legalese; the route referral (never TAB_ONLY) from a Rewards › Refer a friend row on the build with presale only; design-ext.css re-extracted with .s-ref; ON_BUILD 26, MARKERS 96" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked; G1 with `extension/node_modules` copied — it builds and runs the gate), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test file(s).** `RT` = `referral.test.ts` (24), `RF` = `ReferFriend.test.tsx` (16), `CT` = `client.test.ts` (23), `DT` = `deps.test.ts` (20), `AT` = `api.test.ts` (68), `ST` = `Settings.test.tsx` (32), `SP` = `settingsPresale.test.tsx` (1), `RO` = `router.test.ts` (39), `NP` = `check-no-presale.test.mjs` (52). Bold: the brief's pins.

| id | the change | named test → observed |
|---|---|---|
| R1 | **(EARNED from `referral_bonus_tokens`)** `referral.ts`: `return facts === null ? null : facts.bonusBase;` → `return facts === null ? null : facts.totalBase;` | RT "populated …", "EARNED is the allocation's referral_bonus_tokens — never the coordinator's bonus figures …", "/referral-stats failing alone …", the 403 row — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  4 failed \| 20 passed (24)` |
| R2 | **(never from the coordinator)** `referral.ts`: `referralStatsFrom` also returns `earned` from `data.totalBonusNoc` (`BigInt(Math.round(bonus * 1e9))`, its return type and `stats()`'s widened), and `referralView` takes it: `earnedBase: earned === null ? null : earned.toString(),` → `earnedBase: s !== null && s.earned !== null ? s.earned.toString() : earned === null ? null : earned.toString(),` | RT "populated …", "EARNED is the allocation's referral_bonus_tokens …", "the chain read failing alone …", "reads totalReferrals and totalReferredUsd …", the 403 row — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  5 failed \| 19 passed (24)` |
| R3 | **(EARNED stays when /referral-stats fails)** `earnedBase: earned === null ? null : earned.toString(),` → `earnedBase: earned === null \|\| s === null ? null : earned.toString(),` | RT "/referral-stats failing alone …", the 403 row; RF "/referral-stats failing: REFERRALS and REFERRED "—", the "Used" line hidden — EARNED still shown …", "a body without a figure is no figure …" — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  4 failed \| 36 passed (40)` |
| R4 | **(the reverse)** `referrals: s === null ? null : …` / `referredCents: s === null ? null : …` → `s === null \|\| earned === null ? null : …` (both) | RT "the chain read failing alone …"; RF "the chain read failing: EARNED "—" (muted); REFERRALS, REFERRED and "Used 3 times" still shown …" — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  2 failed \| 38 passed (40)` |
| R5 | `stats()` without its own catch: `try {⏎    return referralStatsFrom(await deps.getJson(…));⏎  } catch {⏎    return null;⏎  }` → `return referralStatsFrom(await deps.getJson(…));` (one failure fails #24 whole: `guarded` → `failed`) | RT "/referral-stats failing alone …", "both failing …", the 403 row — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  3 failed \| 21 passed (24)` |
| R6 | **(no stat without a source)** core's coercion: `const {totalReferrals, totalReferredUsd} = data as {…};` → `const {totalReferrals = 0, totalReferredUsd = 0} = data as {…};` | RT "totalReferrals missing (core would say 0) → null …", "totalReferredUsd missing …"; RF "a body without a figure is no figure: "—" (never the 0 core would make of it)" — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  3 failed \| 37 passed (40)` |
| R7 | **(the cents at the background edge)** `Math.round(totalReferredUsd * 100)` → `Math.floor(totalReferredUsd * 100)` | RT "reads totalReferrals and totalReferredUsd; the dollars become whole cents here (0.29 → 29, never 28)" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 23 passed (24)` |
| R8 | no allocation read as no source: `read.length === 1 ? allocationFacts(read[0], account) : null` → `read.length === 1 && read[0] !== null ? allocationFacts(read[0], account) : null` | RT "24b: no allocation on chain earned nothing ("0", not "—") …"; RF "24b empty: zeros as returned …" — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  2 failed \| 38 passed (40)` |
| R9 | **(tests never contact *.noc-tura.io)** the stats past the shared getter: `return referralStatsFrom(await deps.getJson(\`/referral-stats/${account}\`));` → `const r = await globalThis.fetch(\`https://api.noc-tura.io/api/v1/referral-stats/${account}\`);⏎    return referralStatsFrom(await r.json());` (the tests' global fetch throws: nothing reaches the network, and the stats go null) | RT "populated …", "EARNED is …", "24b …", "the chain read failing alone …", the 403 row — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  5 failed \| 19 passed (24)` |
| R10 | `api.ts`: the session dropped: `const a = await accountOnly(ext, msg);⏎  return 'answer' in a ? …` → `if (!onlyKeys(msg, ['type', 'account']) \|\| !isAddress(msg.account)) return MALFORMED;⏎  return {ok: true, data: await referralView(deps, msg.account)};` | RT "strict payload: {account} only, an address in the unlocked session" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 23 passed (24)` |
| R11 | `'presale.referral'` removed from `PRESALE_MESSAGE_TYPES` (the handler still registered) | AT and RT fail to load (`registerPresaleHandler: presale.referral is not a presale message type`); NP "every presale.* message type of api.ts is a marker" (10, not 11) — tsc 0 · RED `Test Files  3 failed (3)` · `Tests  1 failed \| 51 passed (52)` |
| L1 | **(a 403 trips the shared latch)** `deps.ts`: `getJson: path => get.get<unknown>(path),` → `getJson: path => createJsonGetter(fetch, createForbiddenLatch()).get<unknown>(path),` | DT "getJson (B1d-2, #24) goes through the same latch: a 403 on /referral-stats silences the RPC; the RPC's 403 silences /referral-stats" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 19 passed (20)` |
| P1 | **(never a float in the popup)** `text.ts`: `referredText = (cents: bigint): string => \`$${formatAmount(cents, 2, {min: 2, max: 2})}\`` → `` `$${(Number(cents) / 100).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}` `` | RF "the figures are formatted from bigints, never through a float …" ("$9,007,199,254,740,993.12") — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 15 passed (16)` |
| P2 | **(the link whole)** `ReferFriend.tsx`: `{data.link}` → `` {`${data.link.slice(0, 32)}…`} `` | RF "24a populated …", "24b empty …", "/referral-stats failing …", "Copy: …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  4 failed \| 12 passed (16)` |
| P3 | `client.ts`: any link accepted: `\|\| o.link !== buildReferralLink(account)) return undefined;` → `\|\| typeof o.link !== 'string' \|\| buildReferralLink(account).length === 0) return undefined;` | CT "referralDataOf: exactly four keys; the link this account's, whole; …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 22 passed (23)` |
| P4 | **(the clipboard holds exactly the link)** Copy writes the address: `doCopy(data.link)}>` (the icon button) → `doCopy(account ?? '')}>` | RF "Copy: the clipboard holds exactly the link; …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 15 passed (16)` |
| P5 | **(the checkmark while copied)** `<ExtIcon name={copied ? 'check' : copy === 'failed' ? 'close' : 'copy'} …` → `<ExtIcon name={copy === 'failed' ? 'close' : 'copy'} …` | RF "Copy: …", ""Share invite link" copies the link (C15) …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 14 passed (16)` |
| P6 | **(the accent border while copied)** `<div className={copied ? 'code-row app-ref-copied' : 'code-row'}>` → `<div className="code-row">` | RF the same two rows as P5 — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 14 passed (16)` |
| P7 | **("Copy failed" shows no checkmark)** `name={copied ? 'check' : copy === 'failed' ? 'close' : 'copy'}` → `name={copy !== 'idle' ? 'check' : 'copy'}` | RF ""Copy failed" (the clipboard refused) …", "(no clipboard API) …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 14 passed (16)` |
| P8 | **(no toast)** 24a-bis as drawn: before the banner insert `{copied ? <div className="copy-toast" role="status">Code copied</div> : null}` | RF "Copy: … — no toast; …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 15 passed (16)` |
| P9 | **(Share copies the link, C15)** the share button's `onClick={() => data !== null && doCopy(data.link)}` → `onClick={() => undefined}` | RF ""Share invite link" copies the link (C15) …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 15 passed (16)` |
| P10 | **("Used N" hidden when REFERRALS is null)** `{data === null \|\| data.referrals === null ? null : data.referrals === 0n ? (` → `{data === null ? null : data.referrals === null \|\| data.referrals === 0n ? (` | RF "/referral-stats failing: … the "Used" line hidden …", "a body without a figure is no figure …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  2 failed \| 14 passed (16)` |
| P11 | the break points dropped: `{value.split(',').map((part, i, all) => (` → `{[value].map((part, i, all) => (` | RF "large figures whole, each breakable only after a group separator …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 15 passed (16)` |
| S1 | **(the row in the on build)** `Settings.tsx`: `{entry === null ? null : (` → `{entry === null \|\| __NOCTURA_PRESALE__ ? null : (` | SP (on) "on: Rewards › Refer a friend after Connections; the tap opens #24 …"; ST "the groups and rows the extension has …", "rule 6: … Refer a friend (B1d-2) …" — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  3 failed \| 30 passed (33)` |
| S2 | **(`referral` never TAB_ONLY)** `router.ts`: `TAB_ONLY = new Set<Route['screen']>(['created', 'imported', 'resume'])` → `new Set<string>(['created', 'imported', 'resume', 'referral'])` | RO "the pushable screens are a closed list …", "on: exactly {screen: "referral"} is pushed …", "no presale route is a TAB_ONLY hand-over name …"; SP (on) — tsc 0 · RED `Test Files  2 failed (2)` · `Tests  4 failed \| 36 passed (40)` |
| G1 | **(absent from the off build — gate markers)** the row in shared code, both builds: before `{entry === null ? null : (` insert `<div className="s7-list"><ListRow icon="users" title="Refer a friend" onPress={() => onRoute({screen: 'referral'})} /></div>` | the off run's SP (`vitest --config vitest.nopresale.config.ts`): "off: no Rewards group and no "Refer a friend" …" — RED `Tests  1 failed (1)`; both builds, then `node scripts/check-no-presale.mjs dist-nopresale dist` — exit 1: `off build: app/assets/mount-….js contains the presale marker "Refer a friend"` (and `chrome/`, `firefox/`) — tsc 0 |
| U1 | **(people: the singular)** `text.ts`: `usedTail: (n: bigint): string => (n === 1n ? ' person' : ' people'),` → `(n === 1n ? ' people' : ' people')` | RF "1 referrals: "Used by 1 person" — people, not uses (D27; …)" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 15 passed (16)` |
| U2 | **(people: the plural)** `(n === 1n ? ' person' : ' people')` → `(n <= 2n ? ' person' : ' people')` | RF "2 referrals: "Used by 2 people" — …" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 15 passed (16)` |
| G2 | `MARKERS` without `'Refer a friend'` | NP "armed by B1d-1b: … Task 4 #24's type, #31's row and #24's copy" — tsc 0 · RED `Test Files  1 failed (1)` · `Tests  1 failed \| 51 passed (52)` |

29 mutations, all red, every one compiling (none judged INVALID). P10, G2, U1 and U2 ran on the final commit; the other 25 on `2854eb0`, whose code differs from it only by the D27 strings, their tests and one marker (none of those 25 touches them).

#### Notes for the executor (Task 4)

- **The coordinator's `getReferralStats` vs core's `fetchReferralStats` (READ-ONLY ICO checkout, coordinator main 9e7d468; reported, nothing changed on either side):** (1) **core coerces** — `Number(d.totalReferrals ?? 0)` turns a missing or `null` figure into 0 and a non-number into `NaN`, and `if (!body.success …)` accepts any truthy `success`: a figure with no source (§3.5 "No stat without a source") — so the extension does not call it; `referralStatsFrom` reads `success === true` and the two figures strictly (R6). core, web and the app keep theirs (no `core/` change; `core/referral/index.ts` is in the on build through `buildReferralLink`, §6.2's `ON_BUILD`). (2) The route answers a key core's `ReferralStats` lacks, `totalReferredPurchases` (`COUNT(*)`, purchases) — harmless, unread. (3) **`totalReferrals` is `COUNT(DISTINCT buyer_address)` — people, not uses** (the coordinator's comment: "PEOPLE, not purchases"), so §4.4's "Used N times" would have counted people as uses — **resolved by the controller's D27 ruling below** ("Used by N people"). (4) `totalReferredUsd` is `parseFloat` of a Postgres `SUM(usd_value)` — a double; rounded to the cent at the background edge (R7). (5) The route validates nothing about the address (an unknown one answers zeros), counts only `status IN ('completed','confirmed')` rows whose `referrer_address` is the address (D8's on-chain referrer since P2b), and answers 500 `{success: false, error}` on an exception; there is no 404. (6) Its `totalBonusNoc` / `totalBaseBonusNoc` (from `referral_bonus` rows) and tier bonuses are never read — EARNED is the chain's (R1, R2).
- **Ruling: `WalletDeps.getJson(path)`** — a generic GET beside Task 1's `postJson`, through the same latch, in both builds (`createJsonGetter` already existed; only `prices` / `stagePrice` used it, privately) — why: `referral.ts` needs the coordinator through the one latch, and a per-feature dep would add presale names to shared code — cost if wrong: one member of `WalletDeps`.
- **Ruling: Task 3's `api.ts` `ReferralView {onChain, canRegister}` renamed `ReferralState`** — §3.5 names #24's data `ReferralView`; nothing outside `api.ts` named Task 3's (the popup has its own type) — cost if wrong: a rename.
- **Ruling: no allocation on chain = EARNED 0, not "—"** (24b's "0.0"): an absent PDA is the chain's answer that nothing was credited (a referrer is credited only into an existing allocation, C32); a read that failed or an account that is not this owner's PresaleAllocation is null (R8).
- **Ruling: a 403 on `/referral-stats` nulls the stats and shows no notice** (no Q12 on #24 — §4.4 draws none); the shared latch trips (L1), so every coordinator route cools down, including the chain read of the next #24 (EARNED "—" then too) — cost if wrong: one notice line.
- **Ruling: a failed `presale.referral` reply** (the port lost, `failed`) shows "—" for the three figures, no code card (there is no link without the background's answer) and Q11 ("Presale unavailable — try again later.") as `role=alert` — new use of an existing string; `locked` reloads as #50b does.
- **Ruling: one `useCopy` for Copy and "Share invite link"** — both write the same link (C15), so the screen has one copy state: the code row's border and checkmark show whichever was tapped (the row holds what the clipboard now holds), and the share button's label says Q38 ("Copied" / "Copy failed") — the only visible text for "Copy failed", since the design's copy control is an icon. "Copy failed" draws the close glyph (as #21's `CopyIcon`).
- **Ruling (controller, 2026-10-25, on this writer's concern): "Used by N people" / "Used by 1 person" / "Not used yet"** — owner-delegated copy (D27), because the number counts people (`COUNT(DISTINCT buyer_address)`), not uses of the link; a departure from the design's (and §4.4's) "Used N times", recorded for rev 3.4; hidden while `referrals` is null (P10). Pinned: 0 (24b), 1, 2, 1,234 and null rows; U1 / U2. Marker `'Used by '` (96).
- **New copy (flagged):** the #31 group label "Rewards" (the app's `SettingsScreen` section, source "app"; §4.4/C16 name only the row); "Copy invite link" (the app's accessible name of the copy icon). Of these only "Copy invite link" is a marker (12 new markers: `presale.referral`, "Refer a friend", Q35, "NOC lifetime", Q36, Q37, "Not used yet", "Used by ", "Copy invite link", "Share invite link", Q39, the legalese; the route name `referral` and REFERRALS / EARNED / REFERRED / "Rewards" are bare words, Q38 is B1b's in both builds).
- **Departures for rev 3.4 (Task 7's list):** the link in 13 px / 20 px mono, broken anywhere (the design's `.code` is 17 px for a 14-character code; the 68-character link fits three lines at 13 px); the stats grid in equal thirds with `<wbr>` after each group separator (the design's `1fr` overflowed — the visual check); the code row's 1 px border transparent while idle (the accent border appears without moving the row); EARNED to one place, floored, as drawn ("32.4", "0.0"), `--accent` when above 0 and `--fg-tertiary` for 0 or "—" (24b draws 0.0 tertiary); REFERRED as "$1,234.56"; the "Rewards" group; no top-bar spacer (as #23); skeletons while loading, Copy and Share disabled until the link is there; one read per mount (no re-read on focus).
- **For Task 6 (E2E 11):** the fake coordinator needs `GET /referral-stats/<address>` with a scriptable status and body (the dry run's scratch patch: a `referralStats: {status, body}` field, its default `{200, {success: true, data: {totalReferrals: 0, totalReferredUsd: 0}}}`, and the route before `/stats`); the e2e `allocationData` writes no bonus — the scratch spec wrote `referral_bonus_tokens@76` (u64 LE) into the seeded allocation. In the popup the write succeeded ("Copied") but `navigator.clipboard.readText()` is permission-denied, so "the clipboard holds the link" needs `ctx.grantPermissions(['clipboard-read', 'clipboard-write'])` or an init-script spy on `writeText`. Selectors: the DOM block above.
- **For Task 7:** the shots §6.4 asks (#24 populated, empty, a null stat, copied) — the scratch shots fit 412 × 600 with no sticky bar; #24 is taller than the frame only with large figures (the legalese then ends at ~530 px); the departures above.
- **Pre-existing, not this task's (reported):** `src/app/__tests__/Send.test.tsx` "sent before (E6) … last 12 days ago" fails in the last hour of a local day when a DST change lies in the twelve days before (seen 2026-10-25 23:47 CET: "last 11 days ago"; red on Task 3's tree too; green with `TZ=UTC`) — the test subtracts 12 × 24 h from `Date.now()` while `sentBeforeText` counts local calendar days (cardinal rule 3, correct). A date-dependent test, i.e. a flake by the standing rule: the fix belongs to a B1b follow-up (anchor the test's clock at local noon).
- **Dry run:** clone `dry/b1d2`, commit `3efa30d` on Task 3's `6c3ea11` (one commit; amended three times — the visual fix above, one test title that claimed a glyph check no row makes, then the controller's D27 ruling). On `3efa30d`: `tsc` 0, both vitest runs, both builds, `npm run gates` (96 markers) and `settingsPresale` in both modes, all green (totals above), and U1, U2, P10, G2. The Playwright passes and the other 25 mutations ran on `2854eb0` (before the title and D27 changes; no E2E reads the usage line). Every red/green total above is observed. The blocks above are `git diff 6c3ea11 3efa30d` per file and the new files in full; replayed with `git apply --recount` onto a `git archive 6c3ea11` copy plus the new files and the extraction, the result is byte-identical to `3efa30d`'s `extension/`.

---

### Task 5: #26's "Presale" badge on every purchase row and #27's Q34 — the presale entry's two new slots: `historyBadge` (Q31, "Presale", as #21's `StatusPill badge`) beside the title of every `purchase` row of #26 — the row's kind is the chain history's (`core/solana/history.ts` decodes the presale program), so a site's purchase with no record of ours carries it too, beside B1c's "Dapp · simulated" — and `unrecorded(engine, account, signature)` → #27's Q34 ("Recorded on chain; presale service not yet updated") as an info banner under the purchase variant's amount card while `presale.unrecorded` lists the signature for the route's account (`due`, `given-up` and `refused`, D29; never `done`, never a purchase we did not record); a failed or refused read shows nothing (a display only); the build without presale has no slots: B1b's rows, B1b's #27, no badge, no Q34, no presale message (gate marker)

**Spec:** B1d §4.6 (all: "a `purchase` history row … gains the 'Presale' badge (Q31) — on every purchase row, the website's included (the row kind is the chain's, not ours); the badge is on the on build only, the row itself is B1b's and stays in the off build"; "#27: the `purchase` variant (B1b) gains Q34 while `presale.unrecorded` lists its signature"), §1.1 ("What does not change with the switch": B1b's history row "Presale purchase" and #27's "PRESALE PURCHASE"; the slots `presaleSlots`), §1.4 (`presale.unrecorded {account}` → the signatures of this account's confirmed purchases not yet accepted), §2.4 ("nothing in the popup says it failed. #27 says Q34 while the record is `due` or `given-up`" — with D29's `refused`), §5 ("the record POST keeps failing … Q34 on #27"), §6.2 (`MARKERS`: every new on-build §10 string), §10 Q31 (approved, on) and Q34 (approved, on); owner D29, D30 (brief). Brief item 5 and "Carried from B1d-1b" (`MARKERS`, both builds, 412 × 600, Playwright normally and under `unshare -rn`). The design `/home/user/Downloads/index.html` #26 (ix 11715-12084: `.tx-row`, `.meta .pri` with its inline badges — `.mode-badge`, `.origin-badge`) and #27 (ix 12085-12409: `.amount-card`, the banners 27b / 27d between it and `.detail-card`); the "Presale" badge itself is undrawn (§9: "#21 / #26 'Presale' badge — not drawn; approved in the design conversation (Q31)"). Previous parts: Task 1 (consumed: `presale.unrecorded`, `PresaleRecordEntry`'s states, `PRESALE_RECORDS_KEY`), Tasks 2–4 (nothing of theirs is consumed; Task 4's `PresaleSlots.settings` is the slot this task's two sit beside).

**Files:**
- Modify: `extension/src/app/router.ts` (`PresaleSlots.historyBadge`, `PresaleSlots.unrecorded`), `extension/src/app/presale/records.ts` (both slots), `extension/src/app/presale/client.ts` (`unrecordedOf`, `PresaleClient.unrecorded`), `extension/src/app/presale/text.ts` (`RECORD_TEXT.unrecorded`, Q34), `extension/src/app/screens/Activity.tsx` (the badge, `app-tx-badged`), `extension/src/app/screens/TxDetail.tsx` (the read and the banner), `extension/src/app/ui/StatusPill.tsx` (the badge is a `span`), `extension/src/app/app.css` (the row badge shares #21's rule; a badged row wraps)
- Modify (the gate's staged list): `extension/scripts/check-no-presale.mjs` (`MARKERS` 96 → 97: Q34)
- Create (tests): `extension/src/app/__tests__/historyPresale.test.tsx` (both vitest runs)
- Modify (tests): `extension/src/app/presale/__tests__/client.test.ts`, `extension/scripts/__tests__/check-no-presale.test.mjs`, `extension/vitest.nopresale.config.ts`, `extension/e2e/presale.spec.ts` (E2E 1: §6.3's "B1d-2 adds the badge assertion"), `extension/e2e/visual.spec.ts` (its #26 row lookup — the badge shares the title's element)

**Interfaces:**
- Consumes: Task 1's `presale.unrecorded {account}` (privileged, session) → `{ok: true, data: string[]}` — the signatures of the account's entries in `due`, `given-up` or `refused`, in stored order; no network; `malformed`, `locked`, `unknown-account`; Task 1's `v1_presale_records` entry `{signature, account, payload, confirmedAt, attempts, nextAt, state}` (tests seed it through `PRESALE_RECORDS_KEY`, `presaleRecordsKey.ts`, both builds). B1d-1b's `RECORD_TEXT.badge` (Q31), `StatusPill`'s `badge` and its `.status-pill.app-badge` rule (#21), `presaleSlots` / `PresaleSlots` (`router.ts`, `src/app/presale/index.ts`, null from `src/presale-off/app.ts`), `presaleClient` and its `SESSION` refusals. B1b's `HistoryItem.kind` (`'purchase'` only for a landed purchase: a failed transaction is `sent` or `other`, `core/solana/history.ts`), `HistoryItem.origin` (B1c-2), `Banner`, the engine's one retry of a failed transport. Tests: `harness.tsx`'s `renderInWallet` (`before`, `gate`, `reader`), `walletReader`, `drainInFlight`; `e2e/historyFixtures.ts` (`presalePurchase`, `sentSol`, `receivedUsdc`, `sig`); `autolock.ts`'s `lock`.
- Produces (`extension/src/app/router.ts`):
  ```ts
  // PresaleSlots gains:
  historyBadge: string;                                                                   // Q31 — on every `purchase` row of #26
  unrecorded(engine: Engine, account: string, signature: string): Promise<string | null>; // Q34 while presale.unrecorded lists it; null otherwise and on any failure
  ```
- Produces (`extension/src/app/presale/client.ts`):
  ```ts
  export function unrecordedOf(x: unknown): readonly string[] | undefined;  // an array of 64–88-character base58 signatures, possibly empty; anything else undefined (→ failed)
  // PresaleClient: unrecorded(account: string): Promise<Reply<readonly string[], SessionRefusal>>
  ```
- Produces (`extension/src/app/presale/text.ts`): `RECORD_TEXT.unrecorded` = Q34 `'Recorded on chain; presale service not yet updated'`.
- Produces (`extension/src/app/ui/StatusPill.tsx`): `<StatusPill text badge />` renders a `span.status-pill.app-badge` (was a `div`; #21 looks the same — its rule sets `display: inline-flex`).
- DOM (for Task 6's E2E 10 and Task 7's shots): #26's purchase row `.tx-row .meta .pri.app-tx-badged` holds the title's text node, then `span.status-pill.app-badge` "Presale", then (a site's) `.origin-badge`; the row's `.pri` text is therefore "Presale purchasePresale…" — locate it with `.tx-row` + `hasText: 'Presale purchase'`, never `getByText('Presale purchase', {exact: true})`. #27's Q34 is `.s-txd .banner.info[role=status]` (`.banner-title` = Q34) between `.amount-card` and `.detail-card`; it appears after `presale.unrecorded` answers (one request per open #27 of a purchase), and is gone on the next open once the entry is `done`.

**What #26 and #27 show and why (§4.6, §2.4, D29).** **The badge** is a property of the row's kind, and the kind is the chain's: B1b's history decoder makes a landed transaction that pays the presale program a `purchase`, whoever built it — so the wallet's own purchase and a site's (B1c-2: signed through the provider, `origin: 'dapp'`, no presale record of ours) both carry "Presale", read from nothing but the row (no presale message on #26). In the build without presale the slot is null: the row is exactly B1b's ("Presale purchase", "NOC · time", the amount, B1c's badge on a site's), which both builds must keep (§1.1's MUST_STAY). **Q34** is a property of our record: #27's purchase variant asks `presale.unrecorded` for the route's account (the account whose history the row came from — never the selected one, as B1b's #27 frames everything by the route's owner) and shows Q34 exactly when the answer lists this signature: `due` (the POST owed), `given-up` (72 h passed), `refused` (D29: the route's own 400; the purchase still stands) — not `done` (D30: any `200 {success: true}`), and not a purchase we never recorded (a site's, or one past the 50-entry store). **Fail quiet:** the line informs, it decides nothing — a read that fails (the port lost, after the engine's one retry), is refused (`locked`, `unknown-account`) or reads back malformed shows no Q34 and no notice, and #27 is B1b's. A send's or a receive's #27 asks nothing. **Layout:** the badge is #21's (`StatusPill badge` — the accent pill, 12 px, no glyph) beside the title, as the design sets `.mode-badge` / `.origin-badge` inline in `.meta .pri`; a site's purchase carries two badges, wider than the meta column at 412 px — the visual check found the title squeezed to two lines and the badges running under the amount, so a badged row wraps its badges under the title (`.app-tx-badged`, on-build rows only; B1b's rows keep B1b's class). Q34 is an info banner (`Banner tone="info"`, `role=status`) between the amount card and the detail card — where the design puts #27's own notes (27b's shield banner, 27d's danger banner); info, never warning or danger (§2.4: "nothing in the popup says it failed").

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/historyPresale.test.tsx` (both vitest runs; the real background through `renderInWallet`, the history from `e2e/historyFixtures.ts`, the records seeded as Task 1 stores them; nothing reaches the network):

```tsx
// @vitest-environment happy-dom
import type {ReactNode} from 'react';
import {act, cleanup, screen} from '@testing-library/react';
import {drainInFlight, renderInWallet, walletReader} from './harness';
import {Activity} from '../screens/Activity';
import {TxDetail} from '../screens/TxDetail';
import {useWallet} from '../WalletContext';
import type {HistoryItem} from '../engine';
import type {Ext} from '../../ext';
import {registerPresale} from '../../background/presale/api';
import {registerPresaleHandler} from '../../background/messages';
import {PRESALE_RECORDS_KEY} from '../../background/presaleRecordsKey';
import {lock} from '../../background/autolock';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {COUNTERPARTY, presalePurchase, receivedUsdc, sentSol, sig} from '../../../e2e/historyFixtures';

registerPresale({ext: fakeExt(), deps: fakeDeps(), handle: registerPresaleHandler, alarm: () => undefined});

// B1d-2 Task 5 (§4.6, Q31, Q34, D29): #26's "Presale" badge on every purchase row — the kind is the chain's history's,
// a site's purchase included — and #27's Q34 while presale.unrecorded lists the purchase's signature (`due`, `given-up`,
// `refused`), against the REAL background. This file runs in both vitest runs: the build without presale shows B1b's
// rows and B1b's #27, with no badge, no Q34 and no presale message.
const off = process.env.NOCTURA_PRESALE === '0';
const Q34 = 'Recorded on chain; presale service not yet updated';
const NOW = Math.floor(Date.now() / 1000);
/** The wallet's own purchase (sig 3, recorded) and a site's (sig 4, no record of ours — the chain's kind only). */
const OURS = sig(3);
const SITES = sig(4);
const types = (sent: unknown[]) => sent.map(m => (m as {type: string}).type);
const settled = () =>
  act(async () => {
    await drainInFlight();
    await new Promise<void>(r => setTimeout(r, 0));
    await drainInFlight();
  });

type State = 'due' | 'done' | 'refused' | 'given-up';
/** A `v1_presale_records` entry as Task 1's record.ts stores it (§2.4, D28). */
const entry = (signature: string, state: State, account = ACCOUNT.publicKey) => ({
  signature,
  account,
  payload: {txHash: signature, buyerAddress: account, paymentToken: 'SOL', paymentAmount: '1', nocAmount: 998_000.5, usdValue: 150, stage: 1},
  confirmedAt: 1_000,
  attempts: 1,
  nextAt: state === 'due' ? 61_000 : 1_000,
  state,
});

function historyReader() {
  const txs: Record<string, unknown> = {
    [sig(1)]: sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW - 60),
    [sig(2)]: receivedUsdc(ACCOUNT.publicKey, COUNTERPARTY, 250_000_000, NOW - 120),
    [OURS]: presalePurchase(ACCOUNT.publicKey, 1_000_000_000, NOW - 180),
    [SITES]: presalePurchase(ACCOUNT.publicKey, 500_000_000, NOW - 240),
  };
  const list = [sig(1), sig(2), OURS, SITES];
  return walletReader({
    getSignaturesForAddress: async () => list.map(s => ({signature: s, blockTime: null, err: null})),
    getTransaction: async s => txs[s] ?? null,
  });
}

/** Every row of #26: its title's own text, its badges (class and text), its meta and its amount. */
const rows = () =>
  [...document.querySelectorAll('.tx-row:not([data-pending])')].map(r => ({
    title: [...(r.querySelector('.pri')?.childNodes ?? [])].filter(n => n.nodeType === 3).map(n => n.textContent).join(''),
    badges: [...(r.querySelector('.pri')?.children ?? [])].map(b => `${b.className}:${b.textContent}`),
    meta: r.querySelector('.sec')?.textContent?.replace(/ · .*$/, ''),
    amount: r.querySelector('.amt')?.textContent,
  }));
const B1B_ROWS = [
  {title: 'Sent SOL', meta: 'to Your account: Savings', amount: '−2.4800'},
  {title: 'Received USDC', meta: `from ${COUNTERPARTY.slice(0, 4)}…${COUNTERPARTY.slice(-4)}`, amount: '+250.00'},
  {title: 'Presale purchase', meta: 'NOC', amount: '−1.0000'},
  {title: 'Presale purchase', meta: 'NOC', amount: '−0.5000'},
];
const PRESALE_BADGE = 'status-pill app-badge:Presale';
const DAPP_BADGE = 'origin-badge:Dapp · simulated';

async function activity(o: {records?: unknown[]} = {}) {
  const sent: unknown[] = [];
  await renderInWallet(<Activity onTx={() => undefined} onReceive={() => undefined} onPending={() => undefined} />, {
    reader: historyReader(),
    before: async ext => {
      // The site's purchase: B1c-2's record of what a site had this wallet sign — no presale record, no pending record.
      await ext.local.set('v1_dapp_txs', [{signature: SITES, origin: 'https://presale.example', at: 1}]);
      if (o.records !== undefined) await ext.local.set(PRESALE_RECORDS_KEY, o.records);
    },
    gate: m => void sent.push(m),
  });
  await screen.findAllByText('Presale purchase');
  await settled();
  return sent;
}

describe(`#26 in this build (${off ? 'off' : 'on'}): the purchase rows`, () => {
  it(
    off
      ? 'off: B1b’s rows exactly — no "Presale" badge on any row (the site’s keeps B1c’s badge), and no presale message'
      : 'on: "Presale" on both purchase rows — the wallet’s own and the site’s, which has no record of ours (the kind is the chain’s) — none on a send or a receive; the rows otherwise B1b’s; no presale message',
    async () => {
      const sent = await activity({records: [entry(OURS, 'done')]});
      const badges = off ? [[], [], [], [DAPP_BADGE]] : [[], [], [PRESALE_BADGE], [PRESALE_BADGE, DAPP_BADGE]];
      expect(rows()).toEqual(B1B_ROWS.map((r, i) => ({...r, badges: badges[i]})));
      // A badged row lets its badges wrap under the title (app.css): the site's purchase carries two, wider than the
      // meta column at 412 px. B1b's rows keep B1b's class.
      expect([...document.querySelectorAll('.tx-row:not([data-pending]) .pri')].map(e => e.className)).toEqual(B1B_ROWS.map((_, i) => (!off && i >= 2 ? 'pri noc-body-lg app-tx-badged' : 'pri noc-body-lg')));
      // The badge reads nothing: the row's kind is the history's (core/solana/history.ts decodes the presale program).
      expect(types(sent).filter(t => t.startsWith('presale.'))).toEqual([]);
      if (off) expect(document.body.textContent).not.toMatch(/Presale(?! purchase)/);
    },
  );
});

/** As in the App: #27 opens once the provider knows the selected account (Main), so a read keyed on it would see it. */
function WhenSelected({children}: {children: ReactNode}) {
  return useWallet().account === null ? null : children;
}
/** #27 for this history row, opened for `owner` (the route's account), and every message it sent. */
async function detail(item: HistoryItem, o: {owner?: string; records?: unknown[]; gate?: (m: unknown, ext: Ext) => Promise<void> | void} = {}) {
  const sent: unknown[] = [];
  let ext: Ext | null = null;
  await renderInWallet(
    <WhenSelected>
      <TxDetail signature={item.signature} account={o.owner ?? ACCOUNT.publicKey} item={item} canRetry onBack={() => undefined} onTryAgain={() => undefined} />
    </WhenSelected>,
    {
      before: async e => {
        ext = e;
        if (o.records !== undefined) await e.local.set(PRESALE_RECORDS_KEY, o.records);
      },
      gate: async m => {
        sent.push(m);
        if (ext !== null) await o.gate?.(m, ext);
      },
    },
  );
  await screen.findByText(/^Confirmed/);
  await settled();
  return sent;
}
const purchaseItem = (signature: string, over: Partial<HistoryItem> = {}): HistoryItem => ({
  signature,
  blockTime: NOW - 180,
  kind: 'purchase',
  token: 'SOL',
  mint: null,
  amount: 1_000_000_000n,
  counterparty: null,
  feeLamports: 5_000n,
  failed: false,
  origin: null,
  ...over,
});
const sendItem = (over: Partial<HistoryItem> = {}): HistoryItem => ({...purchaseItem(sig(1)), kind: 'sent', counterparty: RECIPIENT, amount: 2_480_000_000n, ...over});
const asked = (sent: unknown[]) => sent.filter(m => (m as {type: string}).type === 'presale.unrecorded');
/** B1b's purchase variant of #27, whatever else is on the screen. */
function expectB1bPurchase() {
  expect(document.querySelector('.amount-card .eyebrow')?.textContent).toBe('PRESALE PURCHASE');
  expect(document.querySelector('.amount-card .amt')?.textContent).toBe('−1.0000 SOL');
  expect([...document.querySelectorAll('.detail-row .lbl')].map(e => e.textContent)).toEqual(['Hash', 'Network fee', 'Date']);
  expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
}

describe(`#27 in this build (${off ? 'off' : 'on'}): Q34`, () => {
  it(off ? 'off: a purchase with a due record — B1b’s purchase variant, no Q34 and no presale message' : 'on: a purchase with a due record shows Q34 as an info line under the amount card (positive control of the off run)', async () => {
    const sent = await detail(purchaseItem(OURS), {records: [entry(OURS, 'due')]});
    expectB1bPurchase();
    if (off) {
      expect(screen.queryByText(Q34)).toBeNull();
      expect(document.querySelector('.banner')).toBeNull();
      expect(types(sent).filter(t => t.startsWith('presale.'))).toEqual([]);
      return;
    }
    const line = screen.getByText(Q34).closest('.banner') as HTMLElement;
    expect([line.className, line.getAttribute('role'), line.previousElementSibling?.className, line.nextElementSibling?.className]).toEqual(['banner info', 'status', 'amount-card', 'detail-card']);
    expect(asked(sent)).toEqual([{type: 'presale.unrecorded', account: ACCOUNT.publicKey}]);
  });
});

describe.skipIf(off)('#27’s Q34 (§4.6, D29): exactly while presale.unrecorded lists the signature', () => {
  it.each<[State, boolean]>([
    ['due', true],
    ['given-up', true],
    ['refused', true],
    ['done', false],
  ])('a record %s → Q34 %s', async (state, shown) => {
    const sent = await detail(purchaseItem(OURS), {records: [entry(OURS, state)]});
    expect(screen.queryByText(Q34) !== null).toBe(shown);
    expectB1bPurchase();
    // The read happened either way: an absent line is the answer's, not a request never made.
    expect(asked(sent)).toHaveLength(1);
  });

  it('a purchase we never recorded (a site’s) shows no Q34 — also while another purchase of the account is unrecorded', async () => {
    const sent = await detail(purchaseItem(SITES, {origin: 'dapp'}), {records: [entry(OURS, 'due'), entry(sig(9), 'refused')]});
    expect(screen.queryByText(Q34)).toBeNull();
    expect(asked(sent)).toEqual([{type: 'presale.unrecorded', account: ACCOUNT.publicKey}]);
    expectB1bPurchase();
  });

  it('asked for the route’s account, never the selected one: #27 of Savings’s purchase while Main is selected', async () => {
    const sent = await detail(purchaseItem(OURS), {owner: RECIPIENT, records: [entry(OURS, 'due', RECIPIENT)]});
    expect(screen.getByText(Q34)).toBeTruthy();
    expect(asked(sent)).toEqual([{type: 'presale.unrecorded', account: RECIPIENT}]);
  });

  it('the answer is only the asked account’s: the same signature unrecorded under another account is no Q34 here', async () => {
    const sent = await detail(purchaseItem(OURS), {owner: RECIPIENT, records: [entry(OURS, 'due', ACCOUNT.publicKey)]});
    expect(screen.queryByText(Q34)).toBeNull();
    expect(asked(sent)).toEqual([{type: 'presale.unrecorded', account: RECIPIENT}]);
  });

  // The engine asks a failed transport once more (B1b: a service worker restarting), so a request that fails is two.
  it.each<[string, (m: unknown, ext: Ext) => Promise<void>, number]>([
    [
      'the request fails',
      async m => {
        if ((m as {type: string}).type === 'presale.unrecorded') throw new Error('port closed');
      },
      2,
    ],
    [
      'the wallet locked under it',
      async (m, ext) => {
        if ((m as {type: string}).type === 'presale.unrecorded') await lock(ext);
      },
      1,
    ],
  ])('fail quiet — %s: no Q34, no notice, B1b’s purchase variant', async (_, gate, asks) => {
    const sent = await detail(purchaseItem(OURS), {records: [entry(OURS, 'due')], gate});
    expect(asked(sent)).toHaveLength(asks);
    expect(screen.queryByText(Q34)).toBeNull();
    expect(document.querySelector('.banner')).toBeNull();
    expect(document.querySelector('[role="alert"]')).toBeNull();
    expectB1bPurchase();
  });

  it('B1b’s sends unchanged: #27 of a send and of a receive asks nothing and shows no Q34, even with that signature listed', async () => {
    for (const item of [sendItem(), sendItem({kind: 'received', counterparty: COUNTERPARTY})]) {
      const sent = await detail(item, {records: [entry(item.signature, 'due')]});
      expect(document.querySelector('.amount-card .eyebrow')?.textContent).toBe(item.kind === 'sent' ? 'SENT' : 'RECEIVED');
      expect(screen.queryByText(Q34)).toBeNull();
      expect(asked(sent)).toEqual([]);
      cleanup();
    }
  });
});
```

Add it to the off run's list, `extension/vitest.nopresale.config.ts`:

```diff
diff --git a/extension/vitest.nopresale.config.ts b/extension/vitest.nopresale.config.ts
index 013b0cf..2573021 100644
--- a/extension/vitest.nopresale.config.ts
+++ b/extension/vitest.nopresale.config.ts
@@ -18,6 +18,7 @@ export const NOPRESALE_TESTS = [
   'src/app/__tests__/genericRecord.test.tsx',
   'src/app/__tests__/homePresale.test.tsx',
   'src/app/__tests__/settingsPresale.test.tsx',
+  'src/app/__tests__/historyPresale.test.tsx',
   'src/app/__tests__/engine.test.ts',
   'src/background/geo/__tests__/gate.test.ts',
   'src/background/dapp/__tests__/presaleRegion.test.ts',
```

`extension/src/app/presale/__tests__/client.test.ts` — the client's read and its shape check:

```diff
diff --git a/extension/src/app/presale/__tests__/client.test.ts b/extension/src/app/presale/__tests__/client.test.ts
index af7e038..27c9a58 100644
--- a/extension/src/app/presale/__tests__/client.test.ts
+++ b/extension/src/app/presale/__tests__/client.test.ts
@@ -1,5 +1,5 @@
 import {createEngine, type Transport} from '../../engine';
-import {BUY_REFUSALS, PREPARE_REFUSALS, REFERRER_LINES, bannerOf, presaleClient, presaleViewOf, purchaseDataOf, purchaseViewOf, quoteOf, referralDataOf, referrerCheckOf, resumableOf} from '../client';
+import {BUY_REFUSALS, PREPARE_REFUSALS, REFERRER_LINES, bannerOf, presaleClient, presaleViewOf, purchaseDataOf, purchaseViewOf, quoteOf, referralDataOf, referrerCheckOf, resumableOf, unrecordedOf} from '../client';
 import {registerPresale} from '../../../background/presale/api';
 import {handleMessage, registerPresaleHandler} from '../../../background/messages';
 import {PENDING_KEY} from '../../../background/pendingStore';
@@ -8,6 +8,7 @@ import {fakeDeps} from '../../../background/__tests__/fakeDeps';
 import {fakeExt} from '../../../background/__tests__/fakeExt';
 import {HOLDING_LARGE, pendingRecord, signedWire, unlocked} from '../../../background/__tests__/fixtures';
 import {viewOf} from '../../../background/pendingStore';
+import {PRESALE_RECORDS_KEY} from '../../../background/presaleRecordsKey';
 import {firstSignature} from '../../../../../core/solana/broadcast';
 import {base64} from '@scure/base';
 import {ACCOUNT, NOW_MS, OTHER, TREASURY_ADDRESS, allocationData, chainMap, chainReader, configData, program, userData, type Chain} from '../../../background/presale/__tests__/chain';
@@ -441,3 +442,31 @@ describe('the client for #24 (presale.referral)', () => {
     expect(referralDataOf(good, OTHER)).toBeUndefined();
   });
 });
+
+// B1d-2 Task 5 (§1.4, §4.6, D29): #27's Q34 — the signatures presale.unrecorded lists for the account.
+describe('the client for #27’s Q34 (presale.unrecorded)', () => {
+  const SIG_B = '4'.repeat(88);
+  const stored = (signature: string, state: string) => ({
+    signature,
+    account: ACCOUNT,
+    payload: {txHash: signature, buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: '1', nocAmount: 1, usdValue: 1, stage: 1},
+    confirmedAt: 0,
+    attempts: 1,
+    nextAt: 0,
+    state,
+  });
+  it('unrecorded against the real background: {type, account}; the due and refused signatures in order, not the accepted one (positive control)', async () => {
+    const {ext, client, sent} = await wired();
+    await ext.local.set(PRESALE_RECORDS_KEY, [stored(SIGNATURE, 'due'), stored('3'.repeat(88), 'done'), stored(SIG_B, 'refused')]);
+    expect(await client.unrecorded(ACCOUNT)).toEqual({ok: true, data: [SIGNATURE, SIG_B]});
+    expect(sent).toEqual([{type: 'presale.unrecorded', account: ACCOUNT}]);
+  });
+
+  it('unrecordedOf: an array of signatures, possibly empty — anything else failed', () => {
+    expect(unrecordedOf([])).toEqual([]);
+    expect(unrecordedOf([SIGNATURE, SIG_B])).toEqual([SIGNATURE, SIG_B]);
+    for (const bad of [null, SIGNATURE, {0: SIGNATURE}, [SIGNATURE, 7], [SIGNATURE, null], ['x'], [`${SIGNATURE} `], ['0'.repeat(88)], ['5'.repeat(63)], ['5'.repeat(89)]]) {
+      expect([bad, unrecordedOf(bad)]).toEqual([bad, undefined]);
+    }
+  });
+});
```

`extension/scripts/__tests__/check-no-presale.test.mjs` — Q34 is a marker:

```diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index 0ae97bf..5e8e94a 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -167,7 +167,7 @@ describe('app.features.json', () => {
 describe('strings', () => {
   const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});
 
-  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48), Task 4 #24’s type, #31’s row and #24’s copy', () => {
+  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48), Task 4 #24’s type, #31’s row and #24’s copy, Task 5 #27’s Q34', () => {
     expect(MARKERS.slice(0, 9)).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale-buy']);
     // §6.2's named strings #23 shows, then Q01, Q02, Q04–Q06, Q11–Q16, Q19, Q40c, Q41c, Q41d, Q43, Q52 (each literal part ≥ 8 characters).
     expect(MARKERS.slice(9)).toEqual([
@@ -264,6 +264,7 @@ describe('strings', () => {
       'Share invite link',
       'Earn NOC when friends you invite buy in the presale.',
       'Referral payouts are subject to program terms. Self-referrals are detected and rejected.',
+      'Recorded on chain; presale service not yet updated',
     ]);
   });
 
```

- [ ] **Step 2: Run them on the previous task's tree — red.**

In a `git archive` copy of Task 4's commit with only the Step 1 files added (node_modules linked): `npx tsc --noEmit; echo $?` → `2`, 2 errors, both in `client.test.ts`: `Module '"../client"' has no exported member 'unrecordedOf'` and `Property 'unrecorded' does not exist on type 'PresaleClient'`.

`npx vitest run src/app/__tests__/historyPresale.test.tsx src/app/presale/__tests__/client.test.ts scripts/__tests__/check-no-presale.test.mjs` — `Test Files  3 failed (3)` · `Tests  14 failed | 75 passed (89)`: `check-no-presale.test.mjs` 1 (the `MARKERS` list), `client.test.ts` 2 (`client.unrecorded is not a function`; `unrecordedOf` undefined), `historyPresale.test.tsx` 11 — #26's on row (no badge on either purchase row: `"badges": []`), #27's on positive control, the four state rows (`due` / `given-up` / `refused` find no Q34; `done` and the site's purchase fail on "the read happened": no `presale.unrecorded` was sent), the two account rows, the two fail-quiet rows (no request to fail). Green before as after: "B1b's sends unchanged" (the negative control: #27 of a send asks nothing — true of the old tree too). The off run (`npx vitest run --config vitest.nopresale.config.ts src/app/__tests__/historyPresale.test.tsx`) is green on the old tree — `Tests  2 passed | 10 skipped (12)`: its rows are the negative half (no badge, no Q34, no presale message) and hold before as after; their positive half is the on run's red above.

- [ ] **Step 3: Implement.**

`extension/src/app/router.ts` — the two slots:

```diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index 981fca4..c1df64b 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -126,6 +126,10 @@ export interface PresaleSlots {
   buy(engine: Engine, account: string): Promise<PresaleRouteValue | null>;
   /** B1d-2 (C16, §4.4): #31's row into the entry's own screen — its group label, its title, and the route it pushes. */
   settings: {group: string; title: string; route: PresaleRouteValue};
+  /** B1d-2 (§4.6, Q31): the badge on every `purchase` row of #26 — the history's kind, a site's purchase included. */
+  historyBadge: string;
+  /** §4.6 (Q34, D29): #27's line for this account's purchase while presale.unrecorded lists its signature; null otherwise and on any failure. */
+  unrecorded(engine: Engine, account: string, signature: string): Promise<string | null>;
 }
 export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};
 
```

`extension/src/app/presale/text.ts` — Q34:

```diff
diff --git a/extension/src/app/presale/text.ts b/extension/src/app/presale/text.ts
index bf18161..63f50f3 100644
--- a/extension/src/app/presale/text.ts
+++ b/extension/src/app/presale/text.ts
@@ -142,6 +142,8 @@ export const RECORD_TEXT = {
   /** Q33 (#11's and #26's pending row, B1d-1b Task 6). */
   pending: 'Buying NOC · pending',
   slow: 'Buying NOC · taking longer than usual',
+  /** Q34 (B1d-2, #27): the coordinator has not accepted the purchase's record — `due`, `given-up` or `refused` (D29). */
+  unrecorded: 'Recorded on chain; presale service not yet updated',
 } as const;
 
 /** #11's presale banner (§4.5, index.html #11 ix:6371-6373): "NOC Presale · Stage N" / "$ 0.1501 · P% to next stage". */
```

`extension/src/app/presale/client.ts` — `presale.unrecorded`, read strictly:

```diff
diff --git a/extension/src/app/presale/client.ts b/extension/src/app/presale/client.ts
index 2f9eedc..f901702 100644
--- a/extension/src/app/presale/client.ts
+++ b/extension/src/app/presale/client.ts
@@ -199,6 +199,8 @@ export interface PresaleClient {
   preparedFor(account: string): Promise<Reply<ResumablePurchase | null, SessionRefusal>>;
   /** §3.5, §4.4 (B1d-2): #24's data for the account — its own link, each figure as the background read it or null. */
   referral(account: string): Promise<Reply<ReferralData, SessionRefusal>>;
+  /** §1.4, §4.6 (B1d-2): the signatures of this account's purchases the coordinator has not accepted — #27's Q34. */
+  unrecorded(account: string): Promise<Reply<readonly string[], SessionRefusal>>;
   buy(id: string): Promise<Reply<Pending, BuyRefusal>>;
   discardPrepared(account: string): Promise<Reply<null, SessionRefusal>>;
 }
@@ -208,6 +210,7 @@ const obj = (x: unknown): J | undefined => (typeof x === 'object' && x !== null
 const UNITS = /^\d{1,20}$/;
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const HEX32 = /^[0-9a-f]{32}$/;
+const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;
 const units = (x: unknown): bigint | undefined => (typeof x === 'string' && UNITS.test(x) ? BigInt(x) : undefined);
 const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
 const isStage = (x: unknown): x is number => isInt(x) && x <= 9;
@@ -417,6 +420,17 @@ export function referralDataOf(x: unknown, account: string): ReferralData | unde
   return {link: o.link, earnedBase, referrals, referredCents};
 }
 
+/** presale.unrecorded's answer (§1.4): an array of transaction signatures, possibly empty. */
+export function unrecordedOf(x: unknown): readonly string[] | undefined {
+  if (!Array.isArray(x)) return undefined;
+  const out: string[] = [];
+  for (const s of x as unknown[]) {
+    if (typeof s !== 'string' || !SIGNATURE.test(s)) return undefined;
+    out.push(s);
+  }
+  return out;
+}
+
 /** The pending record presale.buy answers: the wallet's own purchase (`intent: null`, this kind), nothing else. */
 const purchaseRecordOf = (x: unknown): Pending | undefined => {
   const p = pendingIn(x);
@@ -443,6 +457,7 @@ export function presaleClient(engine: Engine): PresaleClient {
     checkReferrer: (account, referrer) => engine.request({type: 'presale.checkReferrer', account, referrer}, CHECK_REFUSALS, referrerCheckOf),
     preparedFor: account => engine.request({type: 'presale.preparedFor', account}, SESSION, x => (x === null ? null : resumableOf(x))),
     referral: account => engine.request({type: 'presale.referral', account}, SESSION, x => referralDataOf(x, account)),
+    unrecorded: account => engine.request({type: 'presale.unrecorded', account}, SESSION, unrecordedOf),
     buy: id => engine.request({type: 'presale.buy', id}, BUY_REFUSALS, purchaseRecordOf),
     discardPrepared: account => engine.request({type: 'presale.discardPrepared', account}, SESSION, x => (x === undefined ? null : undefined)),
   };
```

`extension/src/app/presale/records.ts` — the slots, in the presale entry only:

```diff
diff --git a/extension/src/app/presale/records.ts b/extension/src/app/presale/records.ts
index a5842d9..2246019 100644
--- a/extension/src/app/presale/records.ts
+++ b/extension/src/app/presale/records.ts
@@ -14,6 +14,8 @@ import {againRoute} from './routes';
  * prepared purchase. `banner` and `buy` are #11's (§4.5): the banner as `presale.banner` answered it (no geo check;
  * null for any failure or an inactive sale), and Buy's routing from a fresh `presale.view` — an open purchase or an open
  * sale → #23, the gate closed → #50b, anything else → no route. `settings` is #31's row into #24 (B1d-2, C16).
+ * `historyBadge` is #26's Q31 on every purchase row, and `unrecorded` #27's Q34 (B1d-2, §4.6): shown only while
+ * `presale.unrecorded` lists the signature for that account — a failed read shows nothing (a display only).
  */
 export const PRESALE_SLOTS: PresaleSlots = {
   record(extra): KindRecord | null {
@@ -57,4 +59,9 @@ export const PRESALE_SLOTS: PresaleSlots = {
     return v.why === 'geo' ? {screen: 'geo'} : null;
   },
   settings: {group: REFER_TEXT.group, title: REFER_TEXT.title, route: {screen: 'referral'}},
+  historyBadge: RECORD_TEXT.badge,
+  async unrecorded(engine, account, signature) {
+    const r = await presaleClient(engine).unrecorded(account);
+    return r.ok && r.data.includes(signature) ? RECORD_TEXT.unrecorded : null;
+  },
 };
```

`extension/src/app/ui/StatusPill.tsx` — the badge is a `span` (it now sits inside #26's row `button`, whose content is phrasing only):

```diff
diff --git a/extension/src/app/ui/StatusPill.tsx b/extension/src/app/ui/StatusPill.tsx
index 3b67e70..c964330 100644
--- a/extension/src/app/ui/StatusPill.tsx
+++ b/extension/src/app/ui/StatusPill.tsx
@@ -2,10 +2,11 @@ import {ExtIcon} from './ExtIcon';
 
 /**
  * The design's `.status-pill` (#27): success, or `.fail` in danger. B1d §4.2: `badge` — a kind beside #21's status
- * (Q31, "Presale"), in the accent and without a glyph: it names what the transaction is, not how it went.
+ * (Q31, "Presale"), in the accent and without a glyph: it names what the transaction is, not how it went. B1d-2: the
+ * same badge on #26's purchase rows — a span, inside the row's button.
  */
 export function StatusPill({text, fail = false, badge = false}: {text: string; fail?: boolean; badge?: boolean}) {
-  if (badge) return <div className="status-pill app-badge">{text}</div>;
+  if (badge) return <span className="status-pill app-badge">{text}</span>;
   return (
     <div className={`status-pill${fail ? ' fail' : ''}`}>
       <ExtIcon name={fail ? 'close' : 'check'} size={12} />
```

`extension/src/app/screens/Activity.tsx` — the badge from the slot, by the row's kind:

```diff
diff --git a/extension/src/app/screens/Activity.tsx b/extension/src/app/screens/Activity.tsx
index 8086f0c..8d747be 100644
--- a/extension/src/app/screens/Activity.tsx
+++ b/extension/src/app/screens/Activity.tsx
@@ -9,6 +9,8 @@ import {ChipRow} from '../ui/Chip';
 import {ExtIcon} from '../ui/ExtIcon';
 import {Banner, RefusedBanner} from '../ui/Banner';
 import {OriginBadge} from '../ui/OriginBadge';
+import {StatusPill} from '../ui/StatusPill';
+import {presaleSlots} from '../presale';
 import type {HistoryItem, Pending} from '../engine';
 import {kindPendingLine} from '../generic';
 
@@ -76,7 +78,8 @@ function Empty({refreshing, onReceive}: {refreshing: boolean; onReceive: () => v
  * #26 activity (spec §6.2) and #41 when there is nothing. Rows from wallet.history (10 a page, paced by
  * the background), open sends on top. No fiat per row (it would need historical prices); the origin badge only on a
  * site's transaction (B1c-2: "Dapp · simulated" — the "Wallet" pill is not drawn, Scope); counterparties short at equal
- * weight (a list is a scanning aid; #27 shows the whole address).
+ * weight (a list is a scanning aid; #27 shows the whole address). B1d-2 (§4.6): every purchase row — the history's
+ * kind, a site's purchase included — carries the presale entry's badge (Q31); the build without presale has none.
  */
 export function Activity({onTx, onReceive, onPending}: {onTx: (item: HistoryItem) => void; onReceive: () => void; onPending: (p: Pending) => void}) {
   const m = useWallet();
@@ -251,14 +254,16 @@ export function Activity({onTx, onReceive, onPending}: {onTx: (item: HistoryItem
               // 26b: today's and yesterday's rows end in the time ("· 9:14 AM"), older ones in the day ("· May 6").
               const recent = s.title.startsWith('TODAY') || s.title.startsWith('YESTERDAY');
               const time = item.blockTime === null ? '' : ` · ${recent ? timeOfDay(item.blockTime * 1000) : shortDay(item.blockTime * 1000)}`;
+              const badge = item.kind === 'purchase' && presaleSlots !== null ? presaleSlots.historyBadge : null;
               return (
                 <button type="button" className="tx-row" key={item.signature} onClick={() => onTx(item)}>
                   <span className={t.tone === 'plain' ? 'ic' : `ic ${t.tone}`}>
                     <ExtIcon name={t.tone === 'fail' ? 'close' : t.tone === 'plain' ? 'doc' : t.tone === 'swap' ? 'swap' : 'arrow-up-right'} size={20} />
                   </span>
                   <span className="meta">
-                    <span className="pri noc-body-lg">
+                    <span className={badge === null ? 'pri noc-body-lg' : 'pri noc-body-lg app-tx-badged'}>
                       {t.title}
+                      {badge === null ? null : <StatusPill text={badge} badge />}
                       {item.origin === 'dapp' ? <OriginBadge /> : null}
                     </span>
                     <span className={`sec noc-body-sm${t.mono ? ' noc-mono' : ''}`}>
```

`extension/src/app/screens/TxDetail.tsx` — the read for the route's account, the info banner in the purchase variant:

```diff
diff --git a/extension/src/app/screens/TxDetail.tsx b/extension/src/app/screens/TxDetail.tsx
index 503d37e..00abd4b 100644
--- a/extension/src/app/screens/TxDetail.tsx
+++ b/extension/src/app/screens/TxDetail.tsx
@@ -15,6 +15,7 @@ import {ContactSheet, type ContactSheetMode} from '../ui/ContactSheet';
 import {fromBook} from '../addressBook';
 import type {Contact, HistoryItem, Intent} from '../engine';
 import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
+import {presaleSlots} from '../presale';
 
 /** At most this many history pages are read to find a signature the list has not loaded. */
 export const FIND_PAGES = 3;
@@ -81,6 +82,9 @@ export function ExplorerLink({signature, label = 'Explorer', icon = true, classN
  * "Save anyway" below C18's floor (review H3). The To / From label is own > treasury > contact. Purchase, other and
  * failed rows get no button; nor does any row while the book is unread (a refused read hides it) or is being re-read
  * after the sheet closed (Task 7 fix round 1, I1): Save opens "add" or "edit" from a fresh read, never a stale one.
+ *
+ * B1d-2 (§4.6): a purchase also reads Q34 while the presale entry says the coordinator has not accepted its record —
+ * asked for the route's account; nothing on a failed read, and nothing asked in the build without presale.
  */
 export function TxDetail({
   signature,
@@ -188,6 +192,21 @@ export function TxDetail({
     };
   }, [given, ready, owner, signature, m.engine]);
 
+  /** B1d-2 (§4.6, Q34): the presale entry's line for this purchase, or null — until it answers, and on any failure. */
+  const [unrecorded, setUnrecorded] = useState<string | null>(null);
+  const purchase = item !== null && item !== undefined && item.kind === 'purchase' && !item.failed ? item.signature : null;
+  useEffect(() => {
+    setUnrecorded(null);
+    if (presaleSlots === null || purchase === null) return;
+    let alive = true;
+    void presaleSlots.unrecorded(engine, owner, purchase).then(line => {
+      if (alive) setUnrecorded(line);
+    });
+    return () => {
+      alive = false;
+    };
+  }, [engine, owner, purchase]);
+
   const top = <TopBar title="Transaction" onBack={onBack} titleClass="noc-h3" badge={item !== null && item !== undefined && item.origin === 'dapp' ? <OriginBadge /> : undefined} />;
   if (item === undefined) {
     if (searchError !== null) {
@@ -315,6 +334,7 @@ export function TxDetail({
             ) : null}
             <StatusPill text="Confirmed" />
           </div>
+          {item.kind === 'purchase' && unrecorded !== null ? <Banner tone="info" title={unrecorded} /> : null}
           <div className="detail-card">
             <Row label="Hash">{hash}</Row>
             <Row label="Network fee">
```

`extension/src/app/app.css` — #21's badge rule for the row, and the wrap (found by the visual check, Step 4):

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 3fed143..5cbe399 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -749,8 +749,10 @@ a.btn {
   margin: 0;
 }
 /* B1d-1b Task 5: #21's kind badge (Q31 "Presale", StatusPill `badge`; approved, undrawn) — #27's status pill shape at
-   the top bar's size, in the accent: it names the kind, not the outcome. */
-.s-stat .top-bar .status-pill.app-badge {
+   the top bar's size, in the accent: it names the kind, not the outcome. B1d-2 Task 5: the same badge on #26's
+   purchase rows, beside the title. */
+.s-stat .top-bar .status-pill.app-badge,
+.tx-row .meta .pri .status-pill.app-badge {
   display: inline-flex;
   align-items: center;
   padding: 2px 10px;
@@ -759,6 +761,12 @@ a.btn {
   background: color-mix(in oklab, var(--accent) 14%, transparent);
   color: var(--accent);
 }
+/* A badged #26 row (B1d-2 Task 5): its badges wrap under the title rather than squeeze it — a site's purchase carries
+   two ("Presale" and B1c's "Dapp · simulated"), wider than the meta column at 412 px. */
+.tx-row .meta .pri.app-tx-badged {
+  flex-wrap: wrap;
+  row-gap: 2px;
+}
 .s-stat .stage-label.app-warning,
 .s-stat .top-bar .step.app-warning,
 .s-stat .meta-row .val.app-warning {
```

`extension/scripts/check-no-presale.mjs` — `MARKERS` 96 → 97:

```diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index d1305e9..77a01bb 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -174,6 +174,8 @@ export const MARKERS = [
   'Share invite link',
   'Earn NOC when friends you invite buy in the presale.',
   'Referral payouts are subject to program terms. Self-referrals are detected and rejected.',
+  // B1d-2 Task 5: #27's Q34 (#26's badge is Q31, "Presale" — one bare word, already the record words').
+  'Recorded on chain; presale service not yet updated',
 ];
 // Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
 // be a string search. The decoder's instruction names are read from its source (DECODER).
```

The badge joins the title's element, so a Playwright lookup by the row's exact title (`getByText('Presale purchase', {exact: true})`) no longer finds the on build's purchase row — two specs did (found by Step 4's Playwright run: `visual.spec.ts` failed, then timed out on its second lookup, the click into #27): E2E 1 now finds the row by `hasText` and asserts the badge (§6.3: "B1d-2 adds the badge assertion"); `visual.spec.ts` finds that row by its title and its badge. (`popup.spec.ts`'s non-exact `getByText('Presale purchase')` still matches.)

```diff
diff --git a/extension/e2e/presale.spec.ts b/extension/e2e/presale.spec.ts
index 02c8aa6..0a9728f 100644
--- a/extension/e2e/presale.spec.ts
+++ b/extension/e2e/presale.spec.ts
@@ -69,7 +69,7 @@ const feeRows = (p: Page) => p.locator('.fee-block .fee-row').evaluateAll(rs =>
 /** The prepared-purchase view the background answers, as far as these specs read it. */
 type Prepared = {reauth: {proven: boolean} | null; stage: number; destination: string} | null;
 
-test('1 · SOL purchase end to end: #11 Buy → #23a → amount → #20 (rows, the simulation) → #10 (first purchase) → the tab’s #20 → #21 with the badge → confirmed; #11 and #26 while pending; #23 then shows the allocation', async () => {
+test('1 · SOL purchase end to end: #11 Buy → #23a → amount → #20 (rows, the simulation) → #10 (first purchase) → the tab’s #20 → #21 with the badge → confirmed; #11 and #26 while pending; #26’s row badged; #23 then shows the allocation', async () => {
   test.setTimeout(240_000);
   const {h, csp} = await scene('noctura-e2e-presale-sol-');
   try {
@@ -167,7 +167,11 @@ test('1 · SOL purchase end to end: #11 Buy → #23a → amount → #20 (rows, t
     expect(BigInt(h.fake.lamports.get(ACCOUNT) ?? 0)).toBe(left);
     const after = await home(h, `${solText(left)} SOL`);
     await after.getByRole('button', {name: 'Activity'}).click();
-    await expect(after.getByText('Presale purchase', {exact: true})).toBeVisible({timeout: 30_000});
+    // B1d-2 Task 5 (§4.6, Q31): the row carries the "Presale" badge beside its title (so the title is no longer the
+    // whole of its element's text: the row is found by it).
+    const landed = after.locator('.tx-row', {hasText: 'Presale purchase'});
+    await expect(landed).toBeVisible({timeout: 30_000});
+    await expect(landed.locator('.pri .status-pill.app-badge')).toHaveText('Presale');
     await after.getByRole('button', {name: 'Home'}).click();
     await buyAction(after).click();
     await expect(after.locator('.receipt .row')).toContainText(`Your allocation${nocText(nocBase)} NOC`, {timeout: 30_000});
diff --git a/extension/e2e/visual.spec.ts b/extension/e2e/visual.spec.ts
index 9c00f5f..821026f 100644
--- a/extension/e2e/visual.spec.ts
+++ b/extension/e2e/visual.spec.ts
@@ -61,8 +61,11 @@ test('visual: the plan-1 screens and states at 412 × 600', async () => {
     await p.getByRole('button', {name: 'Back'}).click();
 
     await p.getByRole('button', {name: 'Activity'}).click();
+    // B1d-2 Task 5: the purchase row's title shares its element with the "Presale" badge (§4.6), so that row is found by
+    // its title and its badge; every other row by its exact title.
+    const titled = (t: string) => (t === 'Presale purchase' ? p.locator('.tx-row .pri', {hasText: t}).filter({has: p.locator('.app-badge', {hasText: 'Presale'})}) : p.getByText(t, {exact: true}));
     // All five rows, the slowest (~5 s a page at 2 getTransaction/s) last.
-    for (const t of ['Sent SOL', 'Received USDC', 'Presale purchase', 'Other transaction', 'Failed · sent SOL']) await expect(p.getByText(t, {exact: true})).toBeVisible({timeout: 30_000});
+    for (const t of ['Sent SOL', 'Received USDC', 'Presale purchase', 'Other transaction', 'Failed · sent SOL']) await expect(titled(t)).toBeVisible({timeout: 30_000});
     await shot(p, '26-loaded-mixed');
     await p.locator('main.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
     await expect(p.getByText('Failed · sent SOL')).toBeInViewport();
@@ -80,7 +83,7 @@ test('visual: the plan-1 screens and states at 412 × 600', async () => {
       ['Presale purchase', 'PRESALE PURCHASE', '27-purchase'],
     ] as const;
     for (const [title, eyebrow, name] of details) {
-      await p.getByText(title, {exact: true}).click();
+      await titled(title).click();
       await expect(p.locator('.amount-card .eyebrow')).toHaveText(eyebrow);
       // Opened at the top (fix round 1, A1): the top bar is in view, not scrolled past.
       await expect(p.getByText('Transaction', {exact: true})).toBeInViewport();
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, Playwright.**

Run: the Step 2 vitest command — `Test Files  3 passed (3)` · `Tests  89 passed (89)` (check-no-presale 52, client 25, historyPresale 12).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  222 passed (222)` · `Tests  4669 passed (4669)` (previous tree 221 / 4655: +1 file, +14 tests — historyPresale 12, client +2). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  18 passed (18)` · `Tests  435 passed | 25 skipped (460)` (previous 17 / 433 + 15: historyPresale's #26 and #27 off rows run, its ten on-only rows skip).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build (`classes ok`: `app-tx-badged` and the row's `status-pill app-badge` are defined in `app.css`; `no TGE date`: 657 files), the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 26 required modules; 97 markers (none in the off build, each in the on build); 9 strings and the decoder's instruction names stay in the off build`. No root `src/`, no `core/` and no `web/` change: the root `tsc` / `jest` and web's `verify` are not this task's.

Playwright (this task changes #26's rows and #27's purchase variant): `npx playwright test e2e/presale.spec.ts e2e/presaleOff.spec.ts e2e/presaleDapp.spec.ts e2e/popup.spec.ts e2e/dappTx.spec.ts e2e/visual-dapp-tx.spec.ts e2e/visual-presale.spec.ts e2e/visual.spec.ts` — `41 passed` normally and under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'`. **Observed in the dry run:** the first pass (before the two spec fixes of Step 3) was `40 passed, 1 failed` both ways — `visual.spec.ts` at `getByText('Presale purchase', {exact: true})` (#26's row lookup); fixed, it then timed out at its second exact lookup (the click into #27, 120 s, both ways); with both lookups fixed, `visual.spec.ts` alone — `1 passed (13.2s)` normally and `1 passed (14.3s)` under `unshare -rn`. The other 40 ran on the same source (the fixes touched only `e2e/visual.spec.ts` and a test file), E2E 1's new badge assertion among them: the on build's landed purchase row reads "Presale" beside its title, and #21 (the badge now a `span`) still reads "Presale" in its top bar (`presale.spec.ts` 1, `visual-presale.spec.ts`).

**Visual check (dry run; shots kept in the scratchpad, never committed — Task 7 owns the committed shots).** A scratch spec (never committed) driving the real extension in both builds at the popup's 412 × 600 frame: an unlocked wallet; the fake's history for Main = a send, the wallet's own purchase and a site's purchase (`v1_dapp_txs` names it); `v1_presale_records` with the own purchase `given-up` (so the start-up run POSTs nothing). On: #26 — "Presale" beside "Presale purchase" on both purchase rows, none on the send, the site's row also "Dapp · simulated"; #27 of the own purchase — Q34's info banner under the amount card, above the hash card. Off: #26 is B1b's (the site's row with B1c's badge only), #27 has no banner. Each row measured (`.pri`'s `scrollWidth` vs `clientWidth`, its right edge vs the amount's left). Compared with index.html #26 (ix 11715-12084: `.tx-row`, inline `.meta .pri` badges) and #27 (ix 12085-12409: a banner between `.amount-card` and `.detail-card`, as 27b / 27d). **Found and fixed in this task (the commit is after the fix):** the site's purchase row — "Presale purchase" + "Presale" + "Dapp · simulated" — measured 285 px in a 233 px `.pri`: the title squeezed to two lines and the badges ran under the amount ("−12.3456"). Now a badged row wraps its badges under the title (`.app-tx-badged`: `flex-wrap: wrap; row-gap: 2px`, on-build badged rows only): "Presale purchase · Presale" on the first line, "Dapp · simulated" on the second, `scrollWidth` = `clientWidth` = 233, the amount clear. B1b's off-build row is unchanged — there the same site's row already sets its title on two lines beside B1c's badge (pre-existing, both builds before this task; not changed). `visual.spec.ts`'s committed `26-loaded-mixed` now shows the badge too.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1d-2 #26's Presale badge and #27's Q34 — the presale entry's historyBadge (Q31, #21's StatusPill badge, now a span) beside the title of every purchase row of #26, the history's kind (a site's purchase included), wrapping under the title when a row carries two badges; and unrecorded(engine, account, signature): #27's purchase variant asks presale.unrecorded for the route's account and shows Q34 as an info banner while it lists the signature (due, given-up, refused — D29; never done, never a purchase we did not record); a failed or refused read shows nothing; the build without presale has neither (no slots); MARKERS 97" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked; G2 with `extension/node_modules` copied — it builds and runs the gate), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test file.** `HP` = `historyPresale.test.tsx` (12 on; the off run 2 + 10 skipped), `CT` = `client.test.ts` (25), `NP` = `check-no-presale.test.mjs` (52). Bold: the brief's pins.

| id | the change | named test → observed |
|---|---|---|
| B1 | **(every purchase row, the site's included — the kind is the chain's)** `Activity.tsx`: `const badge = item.kind === 'purchase' && presaleSlots !== null ?` → `const badge = item.kind === 'purchase' && item.origin === null && presaleSlots !== null ?` | HP (on) "on: "Presale" on both purchase rows — the wallet's own and the site's …" — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| B2 | **(only purchase rows: B1b's sends unchanged)** `const badge = item.kind === 'purchase' && presaleSlots !== null ?` → `const badge = presaleSlots !== null ?` | HP (on) the same row — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| B3 | **(no badge in the off build — gate)** `const badge = item.kind === 'purchase' && presaleSlots !== null ? presaleSlots.historyBadge : null;` → `const badge = item.kind === 'purchase' ? (presaleSlots?.historyBadge ?? 'Presale') : null;` | HP, the off run (`vitest --config vitest.nopresale.config.ts`): "off: B1b's rows exactly — no "Presale" badge on any row …" — tsc 0 · RED `Tests  1 failed \| 1 passed \| 10 skipped (12)` |
| B4 | the wrap dropped: `<span className={badge === null ? 'pri noc-body-lg' : 'pri noc-body-lg app-tx-badged'}>` → `<span className="pri noc-body-lg">` | HP (on) "on: "Presale" on both purchase rows …" (the class row) — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| Q1 | **(exactly while listed — not a purchase we never recorded)** `records.ts`: `return r.ok && r.data.includes(signature) ? RECORD_TEXT.unrecorded : null;` → `return r.ok && r.data.length > 0 ? …` | HP "a purchase we never recorded (a site's) shows no Q34 — also while another purchase of the account is unrecorded" — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| Q2 | **(fail quiet)** `return r.ok && r.data.includes(signature) ? …` → `return !r.ok \|\| r.data.includes(signature) ? …` | HP "fail quiet — the request fails …", "fail quiet — the wallet locked under it …" — tsc 0 · RED `Tests  2 failed \| 10 passed (12)` |
| Q3 | **(asked for the route's account)** `TxDetail.tsx`: `void presaleSlots.unrecorded(engine, owner, purchase)` → `void presaleSlots.unrecorded(engine, selected ?? owner, purchase)` | HP "asked for the route's account, never the selected one …", "the answer is only the asked account's …" — tsc 0 · RED `Tests  2 failed \| 10 passed (12)` |
| Q4 | **(the answer only for the asked account — background)** `record.ts` `unrecordedFor`: `filter(e => e.account === account && e.state !== 'done')` → `filter(e => e.state !== 'done')` | HP "the answer is only the asked account's: the same signature unrecorded under another account is no Q34 here" — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| Q5 | **(not for `done`, D30)** `filter(e => e.account === account && e.state !== 'done')` → `filter(e => e.account === account)` | HP "a record done → Q34 false" — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| Q6 | **(`refused` shows Q34, D29)** → `filter(e => e.account === account && e.state !== 'done' && e.state !== 'refused')` | HP "a record refused → Q34 true" — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| Q7 | (an info line, nothing says it failed — §2.4) `<Banner tone="info" title={unrecorded} />` → `<Banner tone="warning" title={unrecorded} />` | HP "on: a purchase with a due record shows Q34 as an info line under the amount card …" — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| S1 | **(B1b's #27 for sends unchanged)** `item.kind === 'purchase' && !item.failed ? item.signature : null` → `item.kind !== 'other' && !item.failed ? item.signature : null` | HP "B1b's sends unchanged: #27 of a send and of a receive asks nothing and shows no Q34 …" — tsc 0 · RED `Tests  1 failed \| 11 passed (12)` |
| C1 | `client.ts`: the signature unanchored: `const SIGNATURE = /^[1-9A-HJ-NP-Za-km-z]{64,88}$/;` → `/[1-9A-HJ-NP-Za-km-z]{64,88}/` | CT "unrecordedOf: an array of signatures, possibly empty — anything else failed" — tsc 0 · RED `Tests  1 failed \| 24 passed (25)` |
| G1 | `MARKERS` without Q34 | NP "armed by B1d-1b: … Task 5 #27's Q34" — tsc 0 · RED `Tests  1 failed \| 51 passed (52)` |
| G2 | **(no presale string in the off build — gate)** Q34 in shared code: `TxDetail.tsx` `title={unrecorded}` → `title={unrecorded === '' ? 'Recorded on chain; presale service not yet updated' : unrecorded}` | both builds, then `node scripts/check-no-presale.mjs dist-nopresale dist` — exit 1: `off build: app/assets/mount-CTbnGhbV.js contains the presale marker "Recorded on chain; presale service not yet updated"` (and `chrome/`, `firefox/`) — tsc 0 |

15 mutations, all red, every one compiling (none judged INVALID). B1–B4, Q1–Q7, S1, C1 and G1 ran on `33529e3` (the final commit differs only in `e2e/visual.spec.ts`), G2 on the same tree. **Two first forms that did not count (recorded, then re-formed):** C1 as `if (typeof s !== 'string') return undefined;` did not compile (`SIGNATURE` unused, tsc 2 — INVALID); Q3 in its first form, `unrecorded(engine, m.account?.publicKey ?? owner, purchase)` (the same reading as the row's), **survived** (`12 passed`) against the first draft of HP, whose #27 mounted before the provider knew the selected account — `m.account` was still null, so `selected ?? owner` was the owner. HP now mounts #27 only once the account is known (`WhenSelected`, as the App opens #27), and the same Q3 is red.

#### Notes for the executor (Task 5)

- **Ruling: two slots, `historyBadge` and `unrecorded(engine, account, signature)`, on `PresaleSlots`** — the shared screens name neither the word nor the message (the pattern of `record`, `banner`, `settings`); the build without presale has no slots, so no badge, no read and no string (B3, G2) — cost if wrong: none (an interface of two members).
- **Ruling: the badge is decided by `item.kind === 'purchase'` alone** — `HistoryItem.kind` is B1b's decoder's reading of the chain (a landed transaction paying the presale program), never our records; a failed purchase is not a `purchase` row (the decoder makes it `sent` or `other`, B1b's failed row), so it has no badge — §4.6's "every purchase row" read as B1b's "Presale purchase" rows — cost if wrong: one badge on B1b's failed row.
- **Ruling: Q34 is an info banner (`Banner tone="info"`, `role=status`) between #27's amount card and its detail card** — the design has no Q34; it puts #27's notes there (27b's shield banner, 27d's danger banner); info because §2.4 says nothing in the popup says the purchase failed (Q7) — cost if wrong: a restyle in Task 7.
- **Ruling: #27 asks `presale.unrecorded` for the route's account** (`owner`, the account whose history the row came from — B1b's #27 frames From/To and its search by it), never the selected one (Q3); the background answers only for the asked account (Task 1's `unrecordedFor`, Q4 here through the popup).
- **Ruling: fail quiet** — a `failed` (after the engine's one retry), `locked`, `unknown-account` or malformed answer shows no Q34 and no notice, and reports nothing to the net state (a display, §4.6); the read is once per opened #27 (no polling: Q34 goes on the next open after the entry turns `done`; E2E 10 must reopen #27, not wait on it).
- **Ruling: `StatusPill badge` renders a `span`** (was a `div`) — it now sits inside #26's row `button`, whose content model is phrasing; #21's look is unchanged (its rule sets `display: inline-flex`; E2E 1 and `visual-presale.spec.ts` still read "Presale" in #21's top bar) — cost if wrong: none seen.
- **Ruling (found by the visual check): a badged row wraps** (`.app-tx-badged`, on-build purchase rows only) — the site's purchase carries "Presale" and B1c's "Dapp · simulated" (285 px in 233 px); the off build's rows keep B1b's class, so B1b's off-build row is byte-for-byte B1b's DOM. The same off-build row already squeezes its title onto two lines beside B1c's badge (pre-existing since B1c-2, both builds; not this task's — Task 7 may list it).
- **New copy: none.** Q31 ("Presale") and Q34 are §10's approved strings, on build. **Marker:** Q34 (97 markers); "Presale" is one bare word (never a marker; it is also B1b's must-stay "Presale purchase"'s prefix).
- **The E2E side effect (for Task 6 and later specs):** the purchase row's `.pri` text is now "Presale purchasePresale…": an exact `getByText('Presale purchase', {exact: true})` no longer finds it on the on build — E2E 1 and `visual.spec.ts` were changed (Step 3); locate the row with `.tx-row` + `hasText`, the badge with `.pri .status-pill.app-badge`, Q34 with `.s-txd .banner.info` / its text.
- **For Task 6 (E2E 10):** Q34 appears on #27 of the purchase while the entry is `due` (after a 500 / timeout) and is gone once the third slot's 200 makes it `done` — reopen #27 to see it go (one read per open). For a `refused` row: the 400 `{success: false, error: 'not_a_presale_purchase'}` keeps Q34 for good.
- **For Task 7:** the shots `26-loaded-mixed` (committed `visual.spec.ts`) now show the badge; §6.4's "#26 badge, #27 line" need a site's purchase row (two badges, wrapped) and #27 with Q34 — the scratch scene above (history + `v1_dapp_txs` + a `given-up` entry) gives both without a POST. Departures for rev 3.4: the badge's placement and wrap, Q34 as an info banner (both undrawn).
- **Dry-run observation (unexplained, recorded):** one whole-suite on-build vitest run in the dry run (`33529e3`, run alongside nothing else) ended its log after the `RUN` header with no summary and no recorded exit code; the next runs of the same tree were green (`4667 passed`, exit 0). Not reproduced; noted under the standing "a flake is a finding" rule.
- **Dry run:** clone `dry/b1d2`, commit `ceb648b` on Task 4's `3efa30d` (one commit, amended three times: the two `visual.spec.ts` lookups and HP's `WhenSelected`, each found by a run above). On `ceb648b`: `tsc` 0, both vitest runs green (totals above), `visual.spec.ts` ×2; the builds and `npm run gates` (97 markers) ran on `33529e3` (identical `src/`), the 40 other Playwright tests ×2 on `e92586b` (identical `src/`). The blocks above are `git diff 3efa30d ceb648b` per file and the new file in full; replayed with `git apply --recount` onto a `git archive 3efa30d` copy plus the new file, the result is byte-identical to `ceb648b`'s `extension/`.

---

### Task 6: Gates and E2E 10–12 — the off-build gate's lists completed and made complete by construction (a presale module the on build carries and `ON_BUILD` does not name fails; every B1d-2 string of the presale copy armed by a marker or named as shared copy); the fake coordinator's record route scripted (status + body, or a timeout) and held to D28's payload, `/referral-stats`, and the fake program's `register_referrer` with the referrer allocation it credits; E2E 10 (500 → timeout → accepted, #27's Q34 gone; D29 refused / D30 done rows), E2E 11 (#31 → #24, a failed `/referral-stats`, Copy), E2E 12 (the referral address, self, the transaction, an on-chain referrer); E2E 7 refuses B1d-2's message types; contained, CSP-clean, the whole suite normally and under `unshare -rn`

**Spec:** B1d §6.2 items 1–2 (the staged lists — "**2** adds `presale/{record,referral}.ts` and `core/referral/index.ts`"; every `presale.*` message type and every on-build §10 string of source new / approved / app a marker, each literal part ≥ 8 characters), §6.3 (E2E 10–12 — B1d-2's; the fake's `/referral-stats` and `POST /solana/purchase` "with scriptable status"; "every spec runs normally and under `unshare -rn`"), §2.4 as amended by D28–D30 (the payload, the schedule, a 400 final, a 200 done), §3.5 (self = the buyer or any account of this wallet; `referrer@84`; account 3), §4.1 (the referral field), §4.2 (#20 / #10 "Referred by", Q47), §4.4 (#24), §4.6 (#27's Q34). Owner D8, D28, D29, D30. Brief item 6 and "Carried from B1d-1b" (`ON_BUILD` / `MARKERS`; Playwright normally and under `unshare -rn`). Ledger "MUST for Task 6": an entry made due without a browser clock (Task 1); the fake program's `register_referrer` (Tasks 2, 3); `/referral-stats`, the allocation's bonus @76, a clipboard spy (Task 4); E2E 10 reopens #27 to see Q34 go, purchase rows found by `.tx-row` + `hasText` (Task 5) — each met below. ICO facts (coordinator 9e7d468, read-only: `server.js:433-520`, `:2080-2095`): the route's four 400s are `{success: false, error}`, its 200 `{success: true, verified, duplicate, data}`, its 500 `{success: false, error}`; `/referral-stats/:address` → `{success: true, data}` or 500.

**Files:**
- Modify (gate): `extension/scripts/check-no-presale.mjs` (`unlistedModules(ids, onBuild)`, run on the on build; the header comment and the ok line say so — `ON_BUILD` and `MARKERS` unchanged: Tasks 1–5 staged every B1d-2 module (26 required) and string (97 markers) as they went, which the two new rows now prove complete)
- Modify (gate tests): `extension/scripts/__tests__/check-no-presale.test.mjs` (three rows: `unlistedModules`; the whole gate with an unlisted module; every B1d-2 string of `text.ts` armed)
- Modify (E2E harness): `extension/e2e/fakeCoordinator.ts` (`recordAnswers` / `RecordAnswer`, `recordProblems` — D28's shape, `referralStats` / `referralStatsReads`, `PresaleEffect.registers`; the program's `register_referrer`, the referrer-allocation seed check, the allocation keeping its bonus and referrer), `extension/e2e/presaleChain.ts` (`AllocationReferral`, `allocationData`'s bonus and referrer, `allocationReferral`, `REGISTER_REFERRER_DISCRIMINATOR`, `registeredReferrer`), `extension/e2e/presaleHelpers.ts` (`scene` / `done` / `detailRows` moved here from `presale.spec.ts`; `REFERRER`, `installReferrer`; `RecordEntry`, `recordEntries`, `heldRecord`, `slotComes`; `installPresale`'s allocation takes the referral fields)
- Create (E2E): `extension/e2e/presaleRecord.spec.ts` (E2E 10: two tests), `extension/e2e/presaleReferral.spec.ts` (E2E 11, E2E 12: three tests)
- Modify (E2E): `extension/e2e/presale.spec.ts` (imports `scene`, `done`, `detailRows` from the helpers — no row changed), `extension/e2e/presaleOff.spec.ts` (E2E 7: `presale.unrecorded`, `presale.checkReferrer`, `presale.referral` refused in the build without presale)

No `src/`, `core/` or `web/` change: the product is Tasks 1–5's; the root `tsc` / `jest` and web's `verify` are not this task's.

**Interfaces:**
- Consumes (through the real built extension only — `dist/chrome`, `dist-nopresale/chrome`): Task 1's record (`v1_presale_records` entries `{signature, account, payload, confirmedAt, attempts, nextAt, state}`; C24's slots as offsets from `confirmedAt` — 0, 1 min, 5 min, …; the `presale-record` alarm armed at `min(nextAt)` and never sooner than 30 s, cleared when nothing is due; the alarm dispatched by name to `wakePresaleRecords`; D29's `refused` only for the route's own `{success: false, error: <string>}` 400; D30's `done` for any `200 {success: true}`; the 20 s `REQUEST_TIMEOUT_MS`), `presale.unrecorded {account}` → `string[]`; Task 2's `presale.prepareBuy` with `intent.referrer` (refusals `referrer-self`, `referrer-not-applicable`), the built transaction (compute budget ×2, `register_referrer` when it registers, the purchase with account 3 = `["allocation", effective referrer]`), #10's "Referred by" row and Q47's note as its own row (`#ra-rows`); Task 3's field `#presale-referrer` (label Q45, the line `.app-pre-referral .helper` on blur, Buy held while it shows), #20's `.detail-row` "Referred by" (`.addr-groups`, `.app-pre-note`), the view's `referral.canRegister`; Task 4's #31 row (`.s7-group-label` "Rewards", `.s7-row` "Refer a friend") and #24 (`.s-ref .stats .stat .val` ×3, `.val.acc`, `.code-card .lbl-row .uses`, `.code-row .code`, `.actions button` with its aria-label and `app-ref-check`, `.code-row.app-ref-copied`, `.share-btn`; `useCopy`'s 2 s); Task 5's #26 rows (`.tx-row` + `hasText: 'Presale purchase'`) and #27's Q34 (`.s-txd .banner.info`); `core/referral`'s link `https://noc-tura.io?ref=<address>` (written out — e2e imports nothing from core/). B1d-1b's harness: `launchPopup` / `contained` (`popupHarness.ts`), `installFakeCoordinator`, `parseV0`, `presaleWallet`, `home`, `buyAction`, `amount`, `cspControl` / `watchCsp`, `preparedPurchase`, `msg`, `E2E_PASSWORD`.
- Produces (gate, `check-no-presale.mjs`):
  ```js
  export function unlistedModules(ids, onBuild); // every module of `ids` the off build would refuse (offModuleViolations) that `onBuild` does not name, sorted — one line each
  // checkNoPresale: the on build's maps are also read with unlistedModules(on.ids, onBuild)
  ```
- Produces (E2E harness, `fakeCoordinator.ts`):
  ```ts
  export type RecordAnswer = {status: number; body: unknown} | 'timeout';
  export function recordProblems(body: unknown): string[];   // D28: [] for the whole payload as the route reads it; else one line per fault
  // FakeCoordinator gains (defaults: [], {200, {success: true, data: {totalReferrals: 0, totalReferredUsd: 0}}}, []):
  recordAnswers: RecordAnswer[];                              // one per POST, FIFO; empty → 200 {success: true, verified: true, duplicate: false, data: null}
  referralStats: {status: number; body: unknown};
  referralStatsReads: string[];                               // the address of each GET /referral-stats/<address>
  // PresaleEffect gains: registers: string | null            // the referrer a register_referrer before the purchase registered
  ```
- Produces (`presaleChain.ts`): `AllocationReferral {bonusBase: bigint; referrer: string | null}`; `allocationData(a: AllocationFacts & Partial<AllocationReferral>)` (bonus u64 @76, referrer @84); `allocationReferral(d)`; `REGISTER_REFERRER_DISCRIMINATOR`; `registeredReferrer(data): string | null`.
- Produces (`presaleHelpers.ts`): `scene(prefix)`, `done(h, csp)`, `detailRows(p)`; `REFERRER` (32 bytes of 53, no account of the test wallet), `installReferrer(h, referrer?)` (its allocation, one purchase); `RecordEntry`, `recordEntries(h)`, `heldRecord(h, signature, attempts)`, `slotComes(h, signature)`; `installPresale`'s `allocation` takes `bonusBase` and `referrer`.
- **What Task 7 relies on:** the scenes above drive the shots §6.4 asks of B1d-2 (#24 populated / a null stat / copied: E2E 11's; the field with a line and #20 with "Referred by": E2E 12's; #27 with Q34: E2E 10's after its first POST); `heldRecord` keeps an entry `due` with no alarm armed, so a shot of #27's Q34 waits on nothing.

**How a slot comes without a browser clock (the ledger's MUST, Task 1).** The background's clock is the browser's (`Date.now`), and C24's next slot after the first POST is a minute away, then five. The E2E does not wait them out and installs no fake clock in the service worker: it moves the entry's whole schedule back (`confirmedAt` and `nextAt` together, by `nextAt − now + 1 s` — the slots are offsets from `confirmedAt`, so the next ones keep their spacing) and fires the record's own alarm, `presale-record`, at once (`chrome.alarms.create(…, {when: Date.now()})`; an unpacked extension's alarm may be due at once). The background then wakes exactly as at that slot — through `index.ts`'s alarm dispatch and `wakePresaleRecords`, the product's path (R11 below cuts it and E2E 10 turns red). Before it does, `heldRecord` waits for the run that answered the last POST to be over — its last step arms the alarm at the entry's new `nextAt` — and clears that alarm, so no slot can come due on the real clock while the test looks at #27 (record.ts arms it never sooner than 30 s ahead; the test clears it within milliseconds). The worker is never written under: no run is in flight between `heldRecord` and `slotComes`, so the test's read–modify–write of `v1_presale_records` outside the records' lock races nothing.

**What the fake does (and why it is honest).** **The record route** stores each body and holds it to D28 as the deployed route reads it (`recordProblems`: `txHash` a 64-byte signature, `buyerAddress` an address, `paymentToken` one of three, `paymentAmount` a decimal string, `nocAmount` / `usdValue` positive numbers, `stage` an integer 1–10 — the route's `Number.isInteger(body.stage)` — `referrerAddress` an address when present, no other key); a fault goes to `unexpected`, so `contained(h)` fails every spec that POSTs a wrong record. It answers the next scripted answer — a status with the route's own body shapes (500 `{success: false, error}`, 400 `{success: false, error, reason}`, 200 `{success: true, verified, duplicate, data}`), or `'timeout'`: the answer is held past the extension's 20 s timeout and never reaches it — else the route's acceptance. **`/referral-stats/<address>`** answers what the spec scripts (default: nobody referred yet) and logs each address. **`register_referrer`** is run as the program runs it: found by its discriminator and 40-byte data, before the purchase (after it is listed in `unexpected`); its accounts checked (the buyer's user account and allocation PDAs, the buyer, System — ConstraintSeeds 2006), AlreadyHasReferrer (6016) when the allocation already names a referrer; the purchase then credits account 3 only if it is the `["allocation", referrer]` PDA of the **effective** referrer — the one registered, else the allocation's own, else the default key (2006 otherwise: `core/presale/referrer.ts`'s correctness note); the new allocation carries the registered referrer at 84 and keeps its bonus at 76 (so a referrer on chain survives every purchase — Task 2 checks `referrer@84` after every one). The PDAs' rent is the transaction's whichever instruction `init_if_needed` runs in (`newPdaRent` unchanged). **Not modelled (ruling below):** the program's one-time 10 % referral bonus into the referrer's allocation (no spec reads it; E2E 11 seeds the bonus).

- [ ] **Step 1: Write the failing tests.** The gate's three rows, then E2E 10–12 and E2E 7's three message types.

The gate's tests (`extension/scripts/__tests__/check-no-presale.test.mjs`) — `unlistedModules` (red until Step 3: the function does not exist), the whole gate with a presale module the list does not name (red: the gate passes it), and every B1d-2 string of the presale copy armed (a guard: green already — Tasks 1–5 armed each — red the day one is added without its marker, or a marker is dropped: G1 below):

```diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index 5e8e94a..acef1ff 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -18,9 +18,11 @@ import {
   missingStrings,
   moduleIds,
   offModuleViolations,
+  unlistedModules,
 } from '../check-no-presale.mjs';
 import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';
 import {PRESALE_INSTRUCTIONS} from '../../src/background/dapp/decode/presaleIdl';
+import {CONFIRM_PURCHASE_TEXT, RECORD_TEXT, REFERRAL_TEXT, REFERRER_LINE_TEXT, REFER_TEXT} from '../../src/app/presale/text';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
 const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/app.modules.0b79442.json'), 'utf8'));
@@ -133,6 +135,22 @@ describe('the positive-control lists (staged: B1d-1a Task 2)', () => {
     expect(missingModules('off', moduleIds([map(['../core/geo/fetch.ts'])]), ['core/geo/fetch.ts'])).toEqual([]);
   });
 
+  // B1d-2 Task 6: the list is complete — a presale module the on build carries and ON_BUILD does not name fails, so a
+  // module cannot join the build without its positive control (the shared core/presale modules and core/geo excepted).
+  it('unlistedModules names each presale module of the on build that the list does not, sorted; the shared ones are not presale modules', () => {
+    expect(unlistedModules(moduleIds([map([...SHARED, ...ON_BUILD])]), ON_BUILD)).toEqual([]);
+    const more = moduleIds([map([...SHARED, ...ON_BUILD, 'src/app/presale/Claim.tsx', '../core/presale/stats.ts', '../core/referral/tiers.ts', 'src/unlock/presale.ts?v=1'])]);
+    expect(unlistedModules(more, ON_BUILD)).toEqual([
+      'on build carries core/presale/stats.ts — a presale module ON_BUILD does not name: the positive control must list every one',
+      'on build carries core/referral/tiers.ts — a presale module ON_BUILD does not name: the positive control must list every one',
+      'on build carries src/app/presale/Claim.tsx — a presale module ON_BUILD does not name: the positive control must list every one',
+    ]);
+    expect(unlistedModules(moduleIds([map([...SHARED, ...ON_BUILD])]), ON_BUILD.filter(id => id !== 'src/background/presale/record.ts'))).toEqual([
+      'on build carries src/background/presale/record.ts — a presale module ON_BUILD does not name: the positive control must list every one',
+    ]);
+    expect(unlistedModules(moduleIds([map(SHARED)]), [])).toEqual([]);
+  });
+
   it('every ON_BUILD module is one the off build refuses (else its control proves nothing)', () => {
     for (const id of ON_BUILD) expect([id, offModuleViolations(new Set([id])).length]).toEqual([id, 1]);
   });
@@ -277,6 +295,26 @@ describe('strings', () => {
     for (const t of types) expect([t, MARKERS.includes(t)]).toEqual([t, true]);
   });
 
+  // B1d-2 Task 6 (§6.2 item 2: "every §10 string whose build is on"): B1d-2's copy in text.ts, read from the module — each
+  // string of at least 8 characters that is not one bare word contains a marker, or is copy the build without presale
+  // carries too (it would fail the off build as a marker): Q46a is the start of B1b's #12 line "Not a valid Solana
+  // address — check length & characters", "Copy failed" is B1b's useCopy (Q38). A new string without its marker fails here.
+  it('every B1d-2 string of the presale copy is armed by a marker, or is shared copy', () => {
+    const copy = [
+      ...Object.values(REFERRAL_TEXT),
+      ...Object.values(REFERRER_LINE_TEXT),
+      CONFIRM_PURCHASE_TEXT.referredBy,
+      CONFIRM_PURCHASE_TEXT.registers,
+      RECORD_TEXT.unrecorded,
+      ...Object.values(REFER_TEXT).filter(v => typeof v === 'string'),
+      `${REFER_TEXT.usedLead}2${REFER_TEXT.usedTail(2n)}`,
+      `${REFER_TEXT.usedLead}1${REFER_TEXT.usedTail(1n)}`,
+    ];
+    expect(copy).toHaveLength(29);
+    const unarmed = copy.filter(s => s.length >= 8 && !/^[A-Za-z]+$/.test(s) && !MARKERS.some(m => s.includes(m)));
+    expect(unarmed).toEqual(['Not a valid Solana address', 'Copy failed']);
+  });
+
   it('a marker in any off-build file is a violation; each marker must be found in the on build', () => {
     const markers = ['NOC presale', 'v1_presale_records'];
     const off = [file('app/background.js', 'var a=1;'), file('chrome/assets/x.js', '"Buy in the NOC presale"')];
@@ -375,6 +413,12 @@ describe('checkNoPresale(offDir, onDir)', () => {
     expect(run()).toEqual(['on build does not carry src/background/presale/api.ts — renamed or moved? the positive control must name it']);
   });
 
+  it('fails when the on build carries a presale module the list does not name (B1d-2 Task 6)', () => {
+    good();
+    write('on', {presale: true, modules: [...SHARED, ...ON_BUILD, 'src/background/presale/claim.ts'], text: ON_TEXT});
+    expect(run()).toEqual(['on build carries src/background/presale/claim.ts — a presale module ON_BUILD does not name: the positive control must list every one']);
+  });
+
   it('fails when a marker is in the off build, in chrome/ or firefox/ alone too', () => {
     good();
     write('on', {presale: true, modules: [...SHARED, ...ON_BUILD], text: '"YOU RECEIVE (EST.)"'});
```

Create `extension/e2e/presaleRecord.spec.ts` (E2E 10 and the D29 / D30 rows):

```ts
import {test, expect, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import type {Harness} from './popupHarness';
import {ACCOUNT, msg} from './sendHelpers';
import {nocText, solCents, tokensFor} from './presaleChain';
import {amount, buyAction, cspControl, done, heldRecord, home, presaleWallet, recordEntries, scene, slotComes} from './presaleHelpers';

declare const chrome: {storage: {local: {get(k: string): Promise<Record<string, unknown>>; set(o: object): Promise<void>}}};

// B1d §6.3 E2E 10 (B1d-2 Task 6): the coordinator record of a confirmed purchase (§2.4, C24, D28–D30) in the real
// extension against the fake coordinator's scripted record route. A slot of C24's schedule is made to come without a
// browser clock (presaleHelpers.ts `heldRecord` / `slotComes`: the entry's schedule moved back, the record's own alarm
// fired). Every spec ends contained, with no CSP violation.

const SOL = 1_000_000_000n;
const Q34 = 'Recorded on chain; presale service not yet updated';
/** A returning buyer (no re-authentication for a small purchase): two purchases on chain. */
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};
/** 0.1 SOL at the fake's $150: $15 — above the $10 minimum, 1 % of the balance. */
const LAMPORTS = SOL / 10n;
const NOC_BASE = tokensFor(solCents(LAMPORTS, 150), 0);
/** NOC as the coordinator's decimal number (D28: converted at the background's edge only). */
const nocNumber = (base: bigint): number => Number(`${base / SOL}.${(base % SOL).toString().padStart(9, '0')}`);
/** D28: the whole payload of a 0.1 SOL purchase at stage 1 by ACCOUNT. */
const payloadOf = (signature: string) => ({txHash: signature, buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: '0.1', nocAmount: nocNumber(NOC_BASE), usdValue: 15, stage: 1});

/** #23 (open, its stage card read) → 0.1 SOL → #20 → Buy → #21 confirmed. The purchase's signature (the one broadcast since). */
async function buy(h: Harness, popup: Page): Promise<string> {
  const before = h.fake.broadcasts.length;
  await amount(popup, '0.1', nocText(NOC_BASE));
  await popup.locator('.sticky-bar button').click();
  await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
  await popup.getByRole('button', {name: 'Buy NOC'}).click();
  await expect(popup.locator('.stage-label')).toHaveText('Purchase confirmed', {timeout: 45_000});
  expect(h.fake.broadcasts).toHaveLength(before + 1);
  return h.fake.broadcasts[before] as string;
}

/** #26 → the purchase's row (`index`, newest first) → #27, read once (§4.6: one `presale.unrecorded` per open). Q34's banners. */
async function openPurchase(h: Harness, index: number): Promise<{p: Page; q34: ReturnType<Page['locator']>}> {
  const p = await h.openPopup();
  await p.getByRole('button', {name: 'Activity'}).click();
  const rows = p.locator('.tx-row', {hasText: 'Presale purchase'});
  await expect(rows.nth(index)).toBeVisible({timeout: 30_000});
  await rows.nth(index).click();
  await expect(p.locator('.s-txd .amount-card .eyebrow')).toHaveText('PRESALE PURCHASE', {timeout: 30_000});
  return {p, q34: p.locator('.s-txd .banner.info', {hasText: Q34})};
}
/** The background's own answer for #27 (§1.4 `presale.unrecorded`): the signatures it says Q34 for. */
const unrecorded = async (p: Page) => (await msg(p, {type: 'presale.unrecorded', account: ACCOUNT})).data;

test('10 · recording: the record POST answered 500, then never answered (the timeout), then accepted at the third slot — each attempt the whole D28 payload; #27 says Q34 until it is accepted, and reopened it is gone', async () => {
  test.setTimeout(300_000);
  const {h, csp} = await scene('noctura-e2e-presale-record-');
  try {
    await presaleWallet(h, {allocation: RETURNING});
    h.fake.recordAnswers.push({status: 500, body: {success: false, error: 'connection terminated'}}, 'timeout');
    const popup = await home(h);
    await cspControl(popup, csp);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    const signature = await buy(h, popup);

    // Slot 0 (at confirmation): the 500. The entry waits for its next slot, C24's 1 min after confirmation.
    const first = await heldRecord(h, signature, 1);
    expect(h.fake.purchaseRecords).toEqual([payloadOf(signature)]);
    expect(first.nextAt - first.confirmedAt).toBe(60_000);
    const due = await openPurchase(h, 0);
    await expect(due.q34).toBeVisible({timeout: 30_000});
    expect(await unrecorded(due.p)).toEqual([signature]);
    await due.p.close();

    // Slot 1: the POST gets no answer — the extension's request times out (20 s); the next slot is 5 min.
    await slotComes(h, signature);
    const second = await heldRecord(h, signature, 2);
    expect(h.fake.purchaseRecords).toEqual([payloadOf(signature), payloadOf(signature)]);
    expect(second.nextAt - second.confirmedAt).toBe(5 * 60_000);
    const still = await openPurchase(h, 0);
    await expect(still.q34).toBeVisible({timeout: 30_000});
    await still.p.close();

    // Slot 2: accepted (200, success) — done; nothing is due, so the alarm is cleared.
    await slotComes(h, signature);
    await expect.poll(async () => (await recordEntries(h)).find(e => e.signature === signature)?.state, {timeout: 30_000}).toBe('done');
    expect(h.fake.purchaseRecords).toEqual([payloadOf(signature), payloadOf(signature), payloadOf(signature)]);
    const gone = await openPurchase(h, 0);
    expect(await unrecorded(gone.p)).toEqual([]);
    await expect(gone.p.locator('.s-txd .detail-card')).toBeVisible();
    await expect(gone.q34).toHaveCount(0);
    expect(h.fake.recordAnswers).toEqual([]);
    done(h, csp);
  } finally {
    await h.close();
  }
});

/** A well-formed signature for a seeded entry (64 bytes). */
const seededSignature = base58.encode(Uint8Array.from({length: 64}, (_, i) => (i * 7 + 3) % 251 || 1));

test('10 · D29 and D30: a 400 that is the route’s own refusal is final (refused — never POSTed again, #27 keeps Q34); a 200 that says verified: false (duplicate) is done (no Q34); a wake POSTs only what is due', async () => {
  test.setTimeout(300_000);
  const {h, csp} = await scene('noctura-e2e-presale-refused-');
  try {
    await presaleWallet(h, {allocation: RETURNING});
    h.fake.recordAnswers.push(
      {status: 400, body: {success: false, error: 'not_a_presale_purchase', reason: 'no_presale_instruction'}},
      {status: 200, body: {success: true, verified: false, duplicate: true, data: null}},
    );
    const popup = await home(h);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    const refused = await buy(h, popup);
    await expect.poll(async () => (await recordEntries(h)).find(e => e.signature === refused)?.state, {timeout: 30_000}).toBe('refused');
    // Done → #23 (C17), the second purchase.
    await popup.getByRole('button', {name: 'Done'}).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    const accepted = await buy(h, popup);
    await expect.poll(async () => (await recordEntries(h)).find(e => e.signature === accepted)?.state, {timeout: 30_000}).toBe('done');
    expect(h.fake.purchaseRecords).toEqual([payloadOf(refused), payloadOf(accepted)]);

    // The control in the same wake: an entry due now (seeded) is POSTed; the refused and the done ones are not.
    const control = {signature: seededSignature, account: ACCOUNT, payload: payloadOf(seededSignature), confirmedAt: Date.now(), attempts: 0, nextAt: Date.now(), state: 'due'};
    await h.sw.evaluate(async c => {
      const key = 'v1_presale_records';
      await chrome.storage.local.set({[key]: [...((await chrome.storage.local.get(key))[key] as unknown[]), c]});
    }, control);
    await slotComes(h, refused);
    await expect.poll(async () => (await recordEntries(h)).find(e => e.signature === seededSignature)?.state, {timeout: 30_000}).toBe('done');
    expect(h.fake.purchaseRecords).toEqual([payloadOf(refused), payloadOf(accepted), payloadOf(seededSignature)]);
    expect((await recordEntries(h)).map(e => [e.signature, e.state, e.attempts])).toEqual([
      [refused, 'refused', 1],
      [accepted, 'done', 1],
      [seededSignature, 'done', 1],
    ]);

    // #27: Q34 for the refused purchase (D29: the purchase stands, the service was not updated), none for the done one.
    const kept = await openPurchase(h, 1);
    await expect(kept.q34).toBeVisible({timeout: 30_000});
    expect(await unrecorded(kept.p)).toEqual([refused]);
    await kept.p.close();
    const fine = await openPurchase(h, 0);
    await expect(fine.p.locator('.s-txd .detail-card')).toBeVisible();
    await expect(fine.q34).toHaveCount(0);
    done(h, csp);
  } finally {
    await h.close();
  }
});
```

Create `extension/e2e/presaleReferral.spec.ts` (E2E 11 and 12):

```ts
import {test, expect, type Page} from '@playwright/test';
import {base58, base64} from '@scure/base';
import {parseV0} from './fakeCoordinator';
import type {Harness} from './popupHarness';
import {E2E_PASSWORD} from './makeEnvelope';
import {ACCOUNT, msg} from './sendHelpers';
import {
  PRESALE_PROGRAM,
  REGISTER_REFERRER_DISCRIMINATOR,
  SOL_TREASURY,
  SYSTEM_PROGRAM_ID,
  allocationPda,
  allocationReferral,
  nocText,
  purchaseCurrency,
  solCents,
  tokensFor,
  userPda,
} from './presaleChain';
import {REFERRER, amount, buyAction, cspControl, done, home, installReferrer, preparedPurchase, presaleWallet, scene} from './presaleHelpers';

// B1d §6.3 E2E 11 and 12 (B1d-2 Task 6): #31 → #24 (§3.5, §4.4) and the referral address of a first purchase (§3.5,
// §4.1, §4.2, D8, C32) in the real extension, against the fake coordinator's /referral-stats and its presale program,
// which applies `register_referrer` (presaleChain.ts / fakeCoordinator.ts). Every spec ends contained, no CSP violation.

const SOL = 1_000_000_000n;
const LINK = `https://noc-tura.io?ref=${ACCOUNT}`;
const Q46B = "You can't refer yourself or another account in this wallet";
const Q47 = "Saved to your presale account with this purchase. It can't be changed later.";
/** A returning buyer: two purchases on chain. */
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};

/** #11 → #31 → "Refer a friend" (the Rewards group) → #24, its figures read. */
async function referral(p: Page): Promise<void> {
  await p.getByRole('button', {name: 'Settings'}).click();
  await expect(p.locator('.s7-group-label', {hasText: 'Rewards'})).toBeVisible({timeout: 30_000});
  await p.locator('.s7-row', {hasText: 'Refer a friend'}).click();
  await expect(p.locator('.s-ref .top-bar .title')).toHaveText('Refer a friend', {timeout: 30_000});
  await expect(p.locator('.s-ref .stats .stat .val')).toHaveCount(3, {timeout: 30_000});
}
const stats = (p: Page) => p.locator('.s-ref .stats .stat .val').allTextContents();

test('11 · referral: #31 → #24 — REFERRALS and REFERRED from /referral-stats, EARNED from the chain; Copy puts exactly the link in the clipboard and shows the checkmark (2 s); with /referral-stats failing its two stats are "—" and EARNED is still shown', async () => {
  test.setTimeout(180_000);
  const {h, csp} = await scene('noctura-e2e-presale-referral-');
  try {
    // EARNED is the allocation's referral_bonus_tokens (16.12… NOC credited by the program to this account as a referrer).
    await presaleWallet(h, {allocation: {...RETURNING, bonusBase: 16_123_456_789n}});
    h.fake.referralStats = {status: 200, body: {success: true, data: {totalReferrals: 3, totalReferredUsd: 1234.56, totalReferredPurchases: 4}}};
    // The popup's clipboard read is permission-denied: a spy on its write is what says what the clipboard was given.
    await h.ctx.addInitScript(() => {
      const clip = navigator.clipboard;
      if (clip === undefined) return;
      const write = clip.writeText.bind(clip);
      const copied: string[] = [];
      Object.defineProperty(window, 'e2eCopied', {value: copied});
      clip.writeText = (text: string) => {
        copied.push(text);
        return write(text);
      };
    });
    const p = await h.openPopup({clock: true});
    await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    await cspControl(p, csp);
    await referral(p);
    expect(await stats(p)).toEqual(['3', '16.1', '$1,234.56']);
    await expect(p.locator('.s-ref .stats .stat .val.acc')).toHaveText('16.1');
    await expect(p.locator('.s-ref .code-card .lbl-row .uses')).toHaveText('Used by 3 people');
    await expect(p.locator('.s-ref .code-card .code-row .code')).toHaveText(LINK);
    expect(h.fake.referralStatsReads).toEqual([ACCOUNT]);

    // Copy, with the popup's clock held: the checkmark and the accent border stay until the 2 s are run.
    const copy = p.locator('.s-ref .code-card .actions button');
    await expect(copy).toHaveAttribute('aria-label', 'Copy invite link');
    await p.clock.pauseAt(Date.now() + 1_000);
    await copy.click();
    await expect(copy).toHaveAttribute('aria-label', 'Copied');
    await expect(copy).toHaveClass('app-ref-check');
    await expect(p.locator('.s-ref .code-card .code-row.app-ref-copied')).toHaveCount(1);
    await expect(p.locator('.s-ref .share-btn')).toHaveText('Copied');
    expect(await p.evaluate(() => (window as unknown as {e2eCopied: string[]}).e2eCopied)).toEqual([LINK]);
    await p.clock.runFor(2_000);
    await expect(copy).toHaveAttribute('aria-label', 'Copy invite link');
    await expect(p.locator('.s-ref .code-card .code-row.app-ref-copied')).toHaveCount(0);
    await p.clock.resume();

    // /referral-stats fails (500): its two figures "—", no usage line; EARNED still the chain's; the link still whole.
    h.fake.referralStats = {status: 500, body: {success: false, error: 'connection terminated'}};
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-row', {hasText: 'Refer a friend'}).click();
    await expect.poll(() => stats(p), {timeout: 30_000}).toEqual(['—', '16.1', '—']);
    await expect(p.locator('.s-ref .code-card .lbl-row .uses')).toHaveCount(0);
    await expect(p.locator('.s-ref .code-card .code-row .code')).toHaveText(LINK);
    expect(h.fake.referralStatsReads).toEqual([ACCOUNT, ACCOUNT]);
    done(h, csp);
  } finally {
    await h.close();
  }
});

/** Prepare's own refusal of an intent naming `referrer` (C3: the field is the popup's; the background decides). */
const forcedPrepare = (p: Page, referrer: string) => msg(p, {type: 'presale.prepareBuy', account: ACCOUNT, intent: {currency: 'SOL', amount: '500000000', stage: 0, referrer}});

/** #20's "Referred by" row: the whole address in groups of four and Q47's note (null: none). */
async function referredBy(p: Page): Promise<{address: string; note: string | null}> {
  const row = p.locator('.detail-row', {hasText: 'Referred by'});
  await expect(row).toHaveCount(1);
  const note = row.locator('.app-pre-note');
  return {address: (await row.locator('.addr-groups > span').allTextContents()).join(''), note: (await note.count()) === 0 ? null : await note.textContent()};
}

/** #20 → Buy → #10 in a new tab (a first purchase); its rows read; proven → the tab's hand-over → Buy → #21 confirmed. */
async function proveAndBuy(h: Harness, popup: Page): Promise<string> {
  const opened = h.ctx.waitForEvent('page');
  await popup.getByRole('button', {name: 'Buy NOC'}).click();
  const tab = await opened;
  await expect(tab.locator('#ra-about')).toHaveText('Confirm buying NOC with', {timeout: 30_000});
  const rows = (await tab.locator('#ra-rows').textContent()) ?? '';
  await tab.fill('#ra-password', E2E_PASSWORD);
  await tab.click('#ra-confirm');
  await tab.waitForURL(`chrome-extension://${h.id}/wallet.html#/send/resume?account=${ACCOUNT}`, {timeout: 60_000});
  await expect(tab.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
  await tab.getByRole('button', {name: 'Buy NOC'}).click();
  await expect(tab.locator('.stage-label')).toHaveText('Purchase confirmed', {timeout: 45_000});
  await tab.close();
  return rows;
}

test('12 · referral address: the buyer’s own address → Q46b and Buy disabled (and prepare refuses it); a valid referrer → #20 "Referred by" with Q47 → #10 says it → the posted transaction carries register_referrer and account 3 = the referrer’s allocation; the chain records it, the coordinator record carries it, and #23 offers no field again', async () => {
  test.setTimeout(240_000);
  const {h, csp} = await scene('noctura-e2e-presale-referrer-');
  try {
    // A first purchase (no PDAs yet); the referrer bought once (its allocation exists).
    await presaleWallet(h);
    installReferrer(h);
    const popup = await home(h);
    await cspControl(popup, csp);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    const field = popup.getByLabel('Referral address (optional)');
    await expect(field).toHaveAttribute('id', 'presale-referrer');
    const lamports = SOL / 2n;
    const nocBase = tokensFor(solCents(lamports, 150), 0);
    await amount(popup, '0.5', nocText(nocBase));
    const buy = popup.locator('.sticky-bar button');
    const line = popup.locator('.app-pre-referral .helper');

    // Self: the line on blur, Buy held; prepare refuses it however it is asked; nothing simulated.
    await field.fill(ACCOUNT);
    await field.blur();
    await expect(line).toHaveText(Q46B, {timeout: 30_000});
    await expect(buy).toBeDisabled();
    expect(await forcedPrepare(popup, ACCOUNT)).toEqual({ok: false, error: 'referrer-self'});
    expect(h.fake.presale.simulated).toEqual([]);

    // The referrer: no line, Buy again; #20 says who, and that this purchase saves it (Q47).
    await field.fill(REFERRER);
    await field.blur();
    await expect(buy).toHaveText(`Buy ${nocText(nocBase)} NOC`, {timeout: 30_000});
    await expect(buy).toBeEnabled();
    await expect(line).toHaveCount(0);
    await buy.click();
    await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    expect(await referredBy(popup)).toEqual({address: REFERRER, note: Q47});
    // The program simulated the registration with the purchase.
    expect(h.fake.presale.simulated.map(e => [e.currency, e.amount, e.registers])).toEqual([['SOL', lamports, REFERRER]]);
    expect(((await preparedPurchase(popup)) as {reauth: {proven: boolean} | null} | null)?.reauth?.proven).toBe(false);

    // #10 repeats it (Q47's note its own row), from the background's description.
    const rows = await proveAndBuy(h, popup);
    expect(rows).toContain('Referred by');
    expect(rows).toContain(Q47);
    expect(rows).toContain(REFERRER);

    // The one broadcast: compute budget ×2, register_referrer(referrer) on the buyer's PDAs, then the purchase crediting
    // the referrer's allocation (account 3).
    expect(h.fake.broadcasts).toHaveLength(1);
    const wire = parseV0(base64.decode(h.fake.broadcastWires[0] ?? ''));
    expect(wire.instructions).toHaveLength(4);
    const register = wire.instructions[2];
    expect(wire.keys[register?.program ?? -1]).toBe(PRESALE_PROGRAM);
    expect([...(register?.data ?? [])]).toEqual([...REGISTER_REFERRER_DISCRIMINATOR, ...base58.decode(REFERRER)]);
    expect(register?.accounts.map(a => wire.keys[a])).toEqual([userPda(ACCOUNT), allocationPda(ACCOUNT), ACCOUNT, SYSTEM_PROGRAM_ID]);
    const purchase = wire.instructions[3];
    expect(wire.keys[purchase?.program ?? -1]).toBe(PRESALE_PROGRAM);
    expect(purchaseCurrency(purchase?.data ?? new Uint8Array())).toBe('SOL');
    const accounts = purchase?.accounts.map(a => wire.keys[a]) ?? [];
    expect([accounts[3], accounts[6]]).toEqual([allocationPda(REFERRER), SOL_TREASURY]);
    // On chain: the buyer's allocation names the referrer (D8); the coordinator record carries it (§2.4).
    expect(allocationReferral(h.fake.presale.accounts.get(allocationPda(ACCOUNT))?.data ?? new Uint8Array(117)).referrer).toBe(REFERRER);
    await expect.poll(() => h.fake.purchaseRecords.length, {timeout: 30_000}).toBe(1);
    expect(h.fake.purchaseRecords[0]).toMatchObject({txHash: h.fake.broadcasts[0], buyerAddress: ACCOUNT, stage: 1, referrerAddress: REFERRER});

    // #23 again: a repeat purchase with a referrer on chain — no field.
    const again = await h.openPopup();
    await expect(buyAction(again)).toBeVisible({timeout: 30_000});
    await buyAction(again).click();
    await expect(again.locator('.receipt .row')).toContainText(`Your allocation${nocText(nocBase)} NOC`, {timeout: 30_000});
    await expect(again.locator('#presale-referrer')).toHaveCount(0);
    done(h, csp);
  } finally {
    await h.close();
  }
});

test('12 · an account with a referrer on chain (registered, no purchase yet) gets no field; #20 and #10 name that referrer without Q47; the purchase credits its allocation (account 3) and registers nothing; prepare refuses another referrer', async () => {
  test.setTimeout(240_000);
  const {h, csp} = await scene('noctura-e2e-presale-onchain-referrer-');
  try {
    // Still a first purchase (purchase_count 0), but the allocation already names a referrer.
    await presaleWallet(h, {allocation: {totalBase: 0n, spentCents: 0n, count: 0, referrer: REFERRER}});
    installReferrer(h);
    const other = base58.encode(new Uint8Array(32).fill(54));
    installReferrer(h, other);
    const popup = await home(h);
    await buyAction(popup).click();
    await expect(popup.locator('.stage-card .eyebrow')).toHaveText('Stage 1 of 10 · live', {timeout: 30_000});
    const lamports = SOL / 2n;
    const nocBase = tokensFor(solCents(lamports, 150), 0);
    await amount(popup, '0.5', nocText(nocBase));
    await expect(popup.locator('#presale-referrer')).toHaveCount(0);
    expect(await forcedPrepare(popup, other)).toEqual({ok: false, error: 'referrer-not-applicable'});
    expect(h.fake.presale.simulated).toEqual([]);

    await popup.locator('.sticky-bar button').click();
    await expect(popup.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
    expect(await referredBy(popup)).toEqual({address: REFERRER, note: null});
    expect(h.fake.presale.simulated.map(e => e.registers)).toEqual([null]);
    const rows = await proveAndBuy(h, popup);
    expect(rows).toContain('Referred by');
    expect(rows).not.toContain(Q47);

    const wire = parseV0(base64.decode(h.fake.broadcastWires[0] ?? ''));
    expect(wire.instructions).toHaveLength(3);
    const accounts = wire.instructions[2]?.accounts.map(a => wire.keys[a]) ?? [];
    expect(accounts[3]).toBe(allocationPda(REFERRER));
    expect(allocationReferral(h.fake.presale.accounts.get(allocationPda(ACCOUNT))?.data ?? new Uint8Array(117)).referrer).toBe(REFERRER);
    await expect.poll(() => h.fake.purchaseRecords.length, {timeout: 30_000}).toBe(1);
    expect(h.fake.purchaseRecords[0]).toMatchObject({referrerAddress: REFERRER});
    done(h, csp);
  } finally {
    await h.close();
  }
});
```

`extension/e2e/presaleOff.spec.ts` — E2E 7: B1d-2's three message types refused in the build without presale, as `presale.view` is:

```diff
diff --git a/extension/e2e/presaleOff.spec.ts b/extension/e2e/presaleOff.spec.ts
index b27a42e..55166fd 100644
--- a/extension/e2e/presaleOff.spec.ts
+++ b/extension/e2e/presaleOff.spec.ts
@@ -70,6 +70,8 @@ test('7 · off build: no presale UI or handler; a seeded purchase record is show
     // No banner, no Buy (B1d §4.5's slots are absent), and presale.view refused before any handler.
     expect(await popup.locator('.quick .qa .lbl').allTextContents()).toEqual(['Send', 'Receive']);
     expect(await msg(popup, {type: 'presale.view'})).toEqual({ok: false, error: 'unknown type'});
+    // B1d-2's message types too: the record's, the referral address's and #24's.
+    for (const type of ['presale.unrecorded', 'presale.checkReferrer', 'presale.referral']) expect([type, await msg(popup, {type, account: MAIN.publicKey})]).toEqual([type, {ok: false, error: 'unknown type'}]);
     // #11: the generic pending row (Q42a).
     await expect(popup.locator('.app-pending-strip .noc-body-sm')).toHaveText(Q42.pending, {timeout: 30_000});
     await expectGeneric(popup);
```

- [ ] **Step 2: Run them on the previous task's tree — red.**

In a `git archive` copy of Task 5's commit with only the Step 1 files added (node_modules linked): `npx tsc --noEmit; echo $?` → `2`, 21 errors, all in the two new specs (11 in `presaleRecord.spec.ts`, 10 in `presaleReferral.spec.ts`): TS2305 `Module '"./presaleHelpers"' has no exported member` `'done'` (×2), `'scene'` (×2), `'heldRecord'`, `'recordEntries'`, `'slotComes'`, `'REFERRER'`, `'installReferrer'`; `Module '"./presaleChain"' has no exported member` `'REGISTER_REFERRER_DISCRIMINATOR'`, `'allocationReferral'`; TS2353 `'bonusBase'` / `'referrer'` does not exist in `installPresale`'s allocation type; TS7006 ×8 (callbacks over the missing helpers' results).

`npx vitest run scripts/__tests__/check-no-presale.test.mjs` — `Tests  2 failed | 53 passed (55)`: `TypeError: unlistedModules is not a function` and the whole-gate row (`expected [] to deeply equal [ Array(1) ]`); the copy row is green on the old tree (the guard — its red is G1's).

`npx playwright test e2e/presaleRecord.spec.ts e2e/presaleReferral.spec.ts` — no test runs: `SyntaxError: The requested module './presaleHelpers' does not provide an export named 'done'` (and `'REFERRER'`), `Error: No tests found`. E2E 7's new line holds on the old tree too (B1d-2's types were never registered in the off build — the negative half; its positive half is each type answering in the on build, E2E 10–12).

- [ ] **Step 3: Implement.**

`extension/scripts/check-no-presale.mjs` — the list is complete by construction: every presale module the on build carries must be named in `ON_BUILD` (the shared `core/presale` three and `core/geo` are not presale modules: `offModuleViolations` is the one definition of both rules):

```diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index 77a01bb..b676213 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -6,7 +6,8 @@
 //     CORE_PRESALE_ALLOWED; core/geo/ is allowed whole (D15). Of ../web/ (fix round 1, review I1) only WEB_ALLOWED —
 //     web/src/presale/** imports only erased core/presale types, so a denylist would miss it; only an allowlist closes
 //     it, same as core/presale/. Positive control: the on build carries every ON_BUILD module and both carry every
-//     BOTH_BUILDS module, so a renamed or moved module fails instead of passing silently.
+//     BOTH_BUILDS module, so a renamed or moved module fails instead of passing silently; and (B1d-2) every presale
+//     module the on build carries is in ON_BUILD, so a new one cannot join the build without its control.
 //     The maps are the evidence, not the packages: the two packages were byte-identical through B1d-1a's Task 4; from
 //     Task 5 the on build carries the presale background modules, so the maps — not the files — remain the evidence.
 //  2. Strings: no file of the off build's app/, chrome/, firefox/ contains a MARKER; each marker is found in the on build.
@@ -224,6 +225,14 @@ export function offModuleViolations(ids) {
   return out;
 }
 
+/** B1d-2: every module of the on build the off build would refuse (a presale module) that `onBuild` does not name. */
+export function unlistedModules(ids, onBuild) {
+  return [...ids]
+    .sort()
+    .filter(id => offModuleViolations(new Set([id])).length > 0 && !onBuild.includes(id))
+    .map(id => `on build carries ${id} — a presale module ON_BUILD does not name: the positive control must list every one`);
+}
+
 export function missingModules(build, ids, required) {
   return required.filter(id => !ids.has(id)).map(id => `${build} build does not carry ${id} — renamed or moved? the positive control must name it`);
 }
@@ -296,7 +305,7 @@ export function checkNoPresale(offDir, onDir, o = {}) {
   const out = [...off.problems, ...on.problems];
   out.push(...featureViolations(offDir, off.features, false), ...featureViolations(onDir, on.features, true));
   if (off.ids !== undefined) out.push(...offModuleViolations(off.ids), ...missingModules('off', off.ids, bothBuilds));
-  if (on.ids !== undefined) out.push(...missingModules('on', on.ids, [...onBuild, ...bothBuilds]));
+  if (on.ids !== undefined) out.push(...missingModules('on', on.ids, [...onBuild, ...bothBuilds]), ...unlistedModules(on.ids, onBuild));
   const names = decoderInstructionNames(decoderSource);
   if (names.length === 0) out.push(`INCONCLUSIVE: no instruction names read from ${DECODER}`);
   if (off.files !== undefined && on.files !== undefined) out.push(...markerViolations(off.files, on.files, markers));
@@ -316,6 +325,6 @@ if (isMain(import.meta.url)) {
     process.exit(1);
   }
   console.log(
-    `no presale ok (${offArg} off, ${onArg} on): the off build's module maps carry no presale module and of core/presale/ only ${CORE_PRESALE_ALLOWED.length} allowed; the on build carries ${ON_BUILD.length + BOTH_BUILDS.length} required modules; ${MARKERS.length} markers (none in the off build, each in the on build); ${MUST_STAY.length} strings and the decoder's instruction names stay in the off build`,
+    `no presale ok (${offArg} off, ${onArg} on): the off build's module maps carry no presale module and of core/presale/ only ${CORE_PRESALE_ALLOWED.length} allowed; the on build carries ${ON_BUILD.length + BOTH_BUILDS.length} required modules and no presale module outside ON_BUILD; ${MARKERS.length} markers (none in the off build, each in the on build); ${MUST_STAY.length} strings and the decoder's instruction names stay in the off build`,
   );
 }
```

`extension/e2e/presaleChain.ts` — the allocation's referral fields and `register_referrer`'s data:

```diff
diff --git a/extension/e2e/presaleChain.ts b/extension/e2e/presaleChain.ts
index 266f821..72b19e1 100644
--- a/extension/e2e/presaleChain.ts
+++ b/extension/e2e/presaleChain.ts
@@ -114,15 +114,26 @@ export interface AllocationFacts {
   spentCents: bigint;
   count: number;
 }
-export function allocationData(a: AllocationFacts): Uint8Array {
+/** B1d-2: an allocation's referral fields — the bonus credited to it as a referrer (u64 at 76), its own referrer (84–116, zero = none). */
+export interface AllocationReferral {
+  bonusBase: bigint;
+  referrer: string | null;
+}
+export function allocationData(a: AllocationFacts & Partial<AllocationReferral>): Uint8Array {
   const d = new Uint8Array(ALLOCATION.length);
   d.set(ALLOCATION.discriminator, 0);
   d.set(base58.decode(a.user), ALLOCATION.user);
   putU64(d, ALLOCATION.total, a.totalBase);
   putU64(d, ALLOCATION.spent, a.spentCents);
   new DataView(d.buffer).setUint32(ALLOCATION.count, a.count, true);
+  putU64(d, ALLOCATION.bonus, a.bonusBase ?? 0n);
+  if (a.referrer !== undefined && a.referrer !== null) d.set(base58.decode(a.referrer), ALLOCATION.referrer);
   return d;
 }
+export const allocationReferral = (d: Uint8Array): AllocationReferral => {
+  const referrer = d.subarray(ALLOCATION.referrer, ALLOCATION.referrer + 32);
+  return {bonusBase: u64(d, ALLOCATION.bonus), referrer: referrer.every(b => b === 0) ? null : base58.encode(referrer)};
+};
 export const allocationOf = (d: Uint8Array): AllocationFacts => ({
   user: base58.encode(d.subarray(ALLOCATION.user, ALLOCATION.user + 32)),
   totalBase: u64(d, ALLOCATION.total),
@@ -170,6 +181,12 @@ export function purchaseCurrency(data: Uint8Array): Currency | null {
   for (const c of ['SOL', 'USDC', 'USDT'] as const) if (PURCHASE_DISCRIMINATORS[c].every((b, i) => data[i] === b)) return c;
   return null;
 }
+/** B1d-2: `register_referrer(referrer: Pubkey)` — its discriminator (the IDL's, as buyInstructions.ts names it), then the 32 bytes. */
+export const REGISTER_REFERRER_DISCRIMINATOR: readonly number[] = [122, 229, 215, 169, 100, 145, 198, 120];
+/** The referrer a `register_referrer` instruction's data names, or null when the data is not one. */
+export function registeredReferrer(data: Uint8Array): string | null {
+  return data.length === 40 && REGISTER_REFERRER_DISCRIMINATOR.every((b, i) => data[i] === b) ? base58.encode(data.subarray(8, 40)) : null;
+}
 
 /** The program's arithmetic, every division floored: SOL at its price (B1b's 1e-12-dollar scale), a stablecoin at 100 cents a unit, NOC at the stage's price. */
 export const solCents = (lamports: bigint, usd: number): bigint => (lamports * BigInt(Math.round(usd * 1e12))) / 10n ** 19n;
```

`extension/e2e/fakeCoordinator.ts` — the record route scripted and held to D28, `/referral-stats`, the program's `register_referrer`:

```diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
index 8190aa6..85f87dd 100644
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -12,8 +12,10 @@ import {
   allocationData,
   allocationOf,
   allocationPda,
+  allocationReferral,
   configOf,
   purchaseCurrency,
+  registeredReferrer,
   restrictedList,
   solCents,
   stableCents,
@@ -33,6 +35,9 @@ const STATS = 'https://api.noc-tura.io/api/v1/stats';
 const GEO_CHECK = 'https://api.noc-tura.io/api/v1/geo/check';
 const GEO_LIST = 'https://api.noc-tura.io/api/v1/geo/restricted-list';
 const PURCHASE_RECORD = 'https://api.noc-tura.io/api/v1/solana/purchase';
+const REFERRAL_STATS = 'https://api.noc-tura.io/api/v1/referral-stats/';
+/** The extension's own request timeout (src/background/deps.ts REQUEST_TIMEOUT_MS): a 'timeout' answer is held past it. */
+const EXTENSION_REQUEST_TIMEOUT_MS = 20_000;
 /** rpcResult's answer for a method it does not implement (listed in `unexpected` too). */
 const METHOD_NOT_FOUND: unique symbol = Symbol('method not found');
 const SYSTEM_PROGRAM = '11111111111111111111111111111111';
@@ -111,8 +116,17 @@ export interface FakeCoordinator {
   geo: FakeGeo;
   /** B1d-1b Task 9: SOL's dollar price /wallet/prices answers — null leaves `solana` out of the answer (#23's Q19). */
   marketSolUsd: number | null;
-  /** B1d-2 (spec §2.4): each body POSTed to /solana/purchase, in order — answered as the deployed route (P2a) accepts one. */
+  /** B1d-2 (spec §2.4): each body POSTed to /solana/purchase, in order — each checked against D28's shape (`unexpected` lists a wrong one). */
   purchaseRecords: unknown[];
+  /**
+   * B1d-2 (§2.4, D28–D30): the record route's next answers, one per POST, in order — a status with its JSON body, or
+   * 'timeout' (held past the extension's request timeout, never answered). Once empty, the deployed route's acceptance
+   * (coordinator 9e7d468: 200 `{success: true, verified: true, duplicate: false, data: null}`).
+   */
+  recordAnswers: RecordAnswer[];
+  /** B1d-2 (§3.5): what GET /referral-stats/<address> answers (default: nobody referred yet), and each address it was asked for. */
+  referralStats: {status: number; body: unknown};
+  referralStatsReads: string[];
   /**
    * Holds every answer until the returned function is called — how a visual spec keeps a loading
    * state (#40's, #8's "Checking…") on screen deterministically while it is asserted and shot.
@@ -147,6 +161,7 @@ export interface FakePresale {
   /** Each purchase that landed through the broadcast route. */
   landed: PresaleEffect[];
 }
+export type RecordAnswer = {status: number; body: unknown} | 'timeout';
 export interface PresaleEffect {
   currency: Currency;
   amount: bigint;
@@ -159,6 +174,8 @@ export interface PresaleEffect {
   source: string | null;
   /** The rent of the PDAs it creates, lamports. */
   rent: number;
+  /** B1d-2: the referrer a `register_referrer` before it in the same transaction registered, or null. */
+  registers: string | null;
 }
 /** B1d §6.3: /geo/check's answer (a location, no answer, a body of the wrong shape) and the list's body; each read counted. */
 export interface FakeGeo {
@@ -234,6 +251,31 @@ export function mintData(spec: MintSpec): Uint8Array {
   return data;
 }
 
+const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
+const RECORD_KEYS = ['txHash', 'buyerAddress', 'paymentToken', 'paymentAmount', 'nocAmount', 'usdValue', 'stage', 'referrerAddress'];
+/**
+ * B1d-2 (§2.4, D28): what is wrong with a record body — nothing for the whole payload as the route reads it: `txHash` a
+ * signature (64 bytes, base58), `buyerAddress` an address, `paymentToken` one of the three, `paymentAmount` a decimal string,
+ * `nocAmount` and `usdValue` positive numbers, `stage` an integer 1–10 (the route reads `Number.isInteger(body.stage)`, 1-
+ * indexed), `referrerAddress` an address when present, and no other key.
+ */
+export function recordProblems(body: unknown): string[] {
+  if (typeof body !== 'object' || body === null || Array.isArray(body)) return ['not an object'];
+  const b = body as Record<string, unknown>;
+  const out = Object.keys(b)
+    .filter(k => !RECORD_KEYS.includes(k))
+    .map(k => `extra key ${k}`);
+  const key = (x: unknown, bytes: number): boolean => typeof x === 'string' && BASE58.test(x) && base58.decode(x).length === bytes;
+  if (!key(b.txHash, 64)) out.push('txHash is not a signature');
+  if (!key(b.buyerAddress, 32)) out.push('buyerAddress is not an address');
+  if (!['SOL', 'USDC', 'USDT'].includes(b.paymentToken as string)) out.push('paymentToken is not SOL, USDC or USDT');
+  if (typeof b.paymentAmount !== 'string' || !/^\d+(\.\d+)?$/.test(b.paymentAmount)) out.push('paymentAmount is not a decimal string');
+  for (const k of ['nocAmount', 'usdValue']) if (typeof b[k] !== 'number' || !Number.isFinite(b[k]) || (b[k] as number) <= 0) out.push(`${k} is not a positive number`);
+  if (!Number.isInteger(b.stage) || (b.stage as number) < 1 || (b.stage as number) > 10) out.push('stage is not an integer 1–10');
+  if (Object.hasOwn(b, 'referrerAddress') && !key(b.referrerAddress, 32)) out.push('referrerAddress is not an address');
+  return out;
+}
+
 /** Compact-u16: the signature count that opens a serialized transaction. */
 function shortVec(bytes: Uint8Array): {value: number; size: number} {
   let value = 0;
@@ -313,6 +355,9 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     geo: {check: {countryCode: 'SI', isVpn: false}, list: restrictedList(), checks: 0, lists: 0},
     marketSolUsd: 150,
     purchaseRecords: [],
+    recordAnswers: [],
+    referralStats: {status: 200, body: {success: true, data: {totalReferrals: 0, totalReferredUsd: 0}}},
+    referralStatsReads: [],
     hold: () => {
       let release: () => void = () => undefined;
       held = new Promise<void>(r => (release = r));
@@ -492,7 +537,12 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
    * B1d §6.3: the transaction's presale purchase run as the program runs it — null when it has none; its refusal as the
    * node reports a program error; else what it does. The accounts are the IDL's (config, user account, allocation,
    * referrer allocation, then SOL: Pyth, the buyer, the treasury, System; a stablecoin: the paying token account, the
-   * vault ATA, the mint, the buyer, Token, System).
+   * vault ATA, the mint, the buyer, Token, System). B1d-2: a `register_referrer` before it (the buyer's user account and
+   * allocation, the buyer, System — its PDAs checked, refused with AlreadyHasReferrer 6016 when the allocation has a
+   * referrer) sets the allocation's referrer; the referrer allocation (account 3) must be the `["allocation", referrer]` PDA
+   * of the effective referrer — the registered one, else the allocation's own, else the default key — as the program
+   * checks it (ConstraintSeeds 2006). The PDAs' rent is the transaction's either way (`init_if_needed` in whichever comes
+   * first). A registration after the purchase is listed in `unexpected`.
    */
   const purchaseIn = (keys: string[], instructions: {program: number; accounts: number[]; data: Uint8Array}[]): {effect: PresaleEffect} | {error: unknown} | null => {
     const index = instructions.findIndex(ix => keys[ix.program] === PRESALE_PROGRAM && purchaseCurrency(ix.data) !== null);
@@ -514,18 +564,33 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
       const t = tokenAccountAt(source);
       if (t === null || t.owner !== user || t.mint !== (currency === 'USDC' ? USDC_MINT : USDT_MINT) || BigInt(t.amount) < amount) return fail(1);
     }
-    const rent = (fake.presale.accounts.has(acc[1] ?? '') ? 0 : USER_ACCOUNT_RENT) + (fake.presale.accounts.has(acc[2] ?? '') ? 0 : ALLOCATION_RENT);
-    return {effect: {currency, amount, cents, tokens: tokensFor(cents, c.stage), stage: c.stage, user, destination: (currency === 'SOL' ? acc[6] : acc[5]) ?? '', source, rent}};
+    const before = fake.presale.accounts.get(acc[2] ?? '');
+    const onChain = before === undefined ? null : allocationReferral(before.data).referrer;
+    const reg = instructions.findIndex(x => keys[x.program] === PRESALE_PROGRAM && registeredReferrer(x.data) !== null);
+    if (reg > index) fake.unexpected.push('register_referrer after the purchase');
+    const registers = reg >= 0 && reg < index ? registeredReferrer(instructions[reg]?.data ?? new Uint8Array()) : null;
+    if (registers !== null) {
+      const r = instructions[reg]?.accounts.map(a => keys[a] ?? '') ?? [];
+      if (r[0] !== userPda(user) || r[1] !== allocationPda(user) || r[2] !== user || r[3] !== SYSTEM_PROGRAM) return {error: {InstructionError: [reg, {Custom: 2006}]}};
+      if (onChain !== null) return {error: {InstructionError: [reg, {Custom: 6016}]}};
+    }
+    if (acc[3] !== allocationPda(registers ?? onChain ?? SYSTEM_PROGRAM)) return fail(2006);
+    const rent = (fake.presale.accounts.has(acc[1] ?? '') ? 0 : USER_ACCOUNT_RENT) + (before !== undefined ? 0 : ALLOCATION_RENT);
+    return {effect: {currency, amount, cents, tokens: tokensFor(cents, c.stage), stage: c.stage, user, destination: (currency === 'SOL' ? acc[6] : acc[5]) ?? '', source, rent, registers}};
   };
 
-  /** The presale program's accounts after a purchase (each the account the purchase made or changed). */
+  /**
+   * The presale program's accounts after a purchase (each the account the purchase made or changed). B1d-2: the allocation
+   * keeps its bonus and its referrer, or takes the one the transaction registered.
+   */
   const purchaseAccounts = (e: PresaleEffect): Map<string, {lamports: number; data: Uint8Array}> => {
     const allocation = allocationPda(e.user);
     const before = fake.presale.accounts.get(allocation);
     const was = before === undefined ? {user: e.user, totalBase: 0n, spentCents: 0n, count: 0} : allocationOf(before.data);
+    const referral = before === undefined ? {bonusBase: 0n, referrer: null} : allocationReferral(before.data);
     const user = userPda(e.user);
     return new Map([
-      [allocation, {lamports: before?.lamports ?? ALLOCATION_RENT, data: allocationData({user: e.user, totalBase: was.totalBase + e.tokens, spentCents: was.spentCents + e.cents, count: was.count + 1})}],
+      [allocation, {lamports: before?.lamports ?? ALLOCATION_RENT, data: allocationData({user: e.user, totalBase: was.totalBase + e.tokens, spentCents: was.spentCents + e.cents, count: was.count + 1, bonusBase: referral.bonusBase, referrer: e.registers ?? referral.referrer})}],
       [user, fake.presale.accounts.get(user) ?? {lamports: USER_ACCOUNT_RENT, data: userData()}],
     ]);
   };
@@ -767,9 +832,21 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
       return json(route, 200, fake.geo.list);
     }
     if (url === PURCHASE_RECORD && req.method() === 'POST') {
-      // B1d §2.4: the purchase's coordinator record, after it confirmed. The route's own answer (coordinator 9e7d468).
-      fake.purchaseRecords.push(JSON.parse(req.postData() ?? 'null'));
-      return json(route, 200, {success: true, verified: true, duplicate: false, data: null});
+      // B1d §2.4: the purchase's coordinator record, after it confirmed — its body held to D28's shape, then the scripted
+      // answer, else the route's own acceptance (coordinator 9e7d468).
+      const body: unknown = JSON.parse(req.postData() ?? 'null');
+      fake.purchaseRecords.push(body);
+      for (const problem of recordProblems(body)) fake.unexpected.push(`purchase record: ${problem}`);
+      const answer = fake.recordAnswers.shift() ?? {status: 200, body: {success: true, verified: true, duplicate: false, data: null}};
+      if (answer !== 'timeout') return json(route, answer.status, answer.body);
+      // Never answered in time: the extension gives up at its timeout; the late answer goes nowhere.
+      await new Promise(r => setTimeout(r, EXTENSION_REQUEST_TIMEOUT_MS + 2_000));
+      return json(route, 200, {success: true, verified: true, duplicate: false, data: null}).catch(() => undefined);
+    }
+    if (url.startsWith(REFERRAL_STATS) && req.method() === 'GET') {
+      // B1d §3.5: the referral aggregates of an address (coordinator 9e7d468, getReferralStats), as scripted.
+      fake.referralStatsReads.push(url.slice(REFERRAL_STATS.length));
+      return json(route, fake.referralStats.status, fake.referralStats.body);
     }
     if (url === STATS && req.method() === 'GET') {
       // The presale stage, for NOC's value in the dollar re-auth rule (owner decision B).
```

`extension/e2e/presaleHelpers.ts` — the scene helpers shared, the referrer, the record's two test steps:

```diff
diff --git a/extension/e2e/presaleHelpers.ts b/extension/e2e/presaleHelpers.ts
index 62d489c..16e55b0 100644
--- a/extension/e2e/presaleHelpers.ts
+++ b/extension/e2e/presaleHelpers.ts
@@ -1,8 +1,27 @@
 import {expect, type BrowserContext, type ConsoleMessage, type Page} from '@playwright/test';
 import {base58} from '@scure/base';
-import type {Harness} from './popupHarness';
+import {contained, launchPopup, type Harness} from './popupHarness';
 import {ACCOUNT, msg, realWallet} from './sendHelpers';
-import {CONFIG_PDA, SOL_TREASURY, USDC_MINT, USDC_VAULT, USDT_MINT, USDT_VAULT, allocationData, allocationPda, configData, userData, userPda, type ConfigFacts} from './presaleChain';
+import {
+  CONFIG_PDA,
+  SOL_TREASURY,
+  USDC_MINT,
+  USDC_VAULT,
+  USDT_MINT,
+  USDT_VAULT,
+  allocationData,
+  allocationPda,
+  configData,
+  userData,
+  userPda,
+  type AllocationReferral,
+  type ConfigFacts,
+} from './presaleChain';
+
+declare const chrome: {
+  storage: {local: {get(k: string): Promise<Record<string, unknown>>; set(o: object): Promise<void>}};
+  alarms: {get(name: string): Promise<{scheduledTime: number} | undefined>; clear(name: string): Promise<boolean>; create(name: string, o: {when: number}): Promise<void>};
+};
 
 // B1d §6.3's E2E helpers (B1d-1b Task 8): the presale on the fake chain, the CSP watch, #11 → Buy, #50b's reading, the
 // background's own answers. Public constants only; nothing here is imported from core/ (the E2E rule).
@@ -10,8 +29,11 @@ import {CONFIG_PDA, SOL_TREASURY, USDC_MINT, USDC_VAULT, USDT_MINT, USDT_VAULT,
 /** A USDC token account the account holds that is NOT its associated token account (the user's wallet holds this way). */
 export const USDC_HOLDING = base58.encode(new Uint8Array(32).fill(37));
 
-/** The config live (or as `config` says), the treasury's two vault ATAs, the account's PDAs when `allocation` is given. */
-export function installPresale(h: Harness, o: {config?: Partial<ConfigFacts>; allocation?: {totalBase: bigint; spentCents: bigint; count: number}} = {}): void {
+/**
+ * The config live (or as `config` says), the treasury's two vault ATAs, the account's PDAs when `allocation` is given
+ * (B1d-2: with the bonus credited to it as a referrer and its own referrer, when given).
+ */
+export function installPresale(h: Harness, o: {config?: Partial<ConfigFacts>; allocation?: {totalBase: bigint; spentCents: bigint; count: number} & Partial<AllocationReferral>} = {}): void {
   h.fake.presale.accounts.set(CONFIG_PDA, {lamports: 3_466_080, data: configData(o.config)});
   h.fake.tokenAccounts.set(SOL_TREASURY, [
     {pubkey: USDC_VAULT, mint: USDC_MINT, amount: '172099207', decimals: 6},
@@ -89,5 +111,82 @@ export async function geoScreen(p: Page): Promise<{headline: string; sub: string
   };
 }
 
+/** A presale scene: the contained popup harness and its CSP watch. */
+export async function scene(prefix: string): Promise<{h: Harness; csp: string[]}> {
+  const h = await launchPopup(prefix);
+  return {h, csp: await watchCsp(h.ctx)};
+}
+/** What every presale spec ends with: contained (popupHarness.ts) and no CSP violation on any page. */
+export function done(h: Harness, csp: string[]): void {
+  contained(h);
+  expect(csp).toEqual([]);
+}
+/** #20's detail rows as [label, value]. */
+export const detailRows = (p: Page) => p.locator('.detail-row').evaluateAll(rs => rs.map(r => [r.querySelector('.lbl')?.textContent ?? '', r.querySelector('.val')?.textContent ?? '']));
+
+/** B1d-2: a referrer that is no account of the test wallet — an address with a presale allocation of its own (`installReferrer`). */
+export const REFERRER = base58.encode(new Uint8Array(32).fill(53));
+/** The referrer's own allocation on the fake chain (it bought once): what makes it an address that can refer (§3.5). */
+export function installReferrer(h: Harness, referrer = REFERRER): void {
+  h.fake.presale.accounts.set(allocationPda(referrer), {lamports: 1_244_600, data: allocationData({user: referrer, totalBase: 666_222_518_321n, spentCents: 10_000n, count: 1})});
+}
+
+/** B1d-2 (§2.4): the background's record entries (`v1_presale_records`), as stored. */
+export interface RecordEntry {
+  signature: string;
+  account: string;
+  payload: Record<string, unknown>;
+  confirmedAt: number;
+  attempts: number;
+  nextAt: number;
+  state: 'due' | 'done' | 'refused' | 'given-up';
+}
+export const recordEntries = async (h: Harness): Promise<RecordEntry[]> => (await h.sw.evaluate(() => chrome.storage.local.get('v1_presale_records'))).v1_presale_records as RecordEntry[];
+const RECORD_ALARM = 'presale-record';
+
+/**
+ * B1d-2 (§2.4): the record of `signature` after its `attempts`-th POST, once the worker's run is over — its retry alarm
+ * armed at the entry's next slot (the run's last step) — and then the alarm cleared, so no slot comes due on the browser's
+ * clock while the test looks (record.ts arms it never sooner than 30 s ahead). The entry as it stands.
+ */
+export async function heldRecord(h: Harness, signature: string, attempts: number): Promise<RecordEntry> {
+  await expect
+    .poll(
+      async () => {
+        const e = (await recordEntries(h)).find(x => x.signature === signature);
+        const alarm = await h.sw.evaluate(name => chrome.alarms.get(name), RECORD_ALARM);
+        return e?.state === 'due' && e.attempts === attempts && alarm !== undefined && Math.abs(alarm.scheduledTime - e.nextAt) < 2_000;
+      },
+      {timeout: 60_000},
+    )
+    .toBe(true);
+  await h.sw.evaluate(name => chrome.alarms.clear(name), RECORD_ALARM);
+  const e = (await recordEntries(h)).find(x => x.signature === signature);
+  expect(e?.attempts).toBe(attempts);
+  return e as RecordEntry;
+}
+
+/**
+ * The test's way to make an entry's next slot come without a browser clock: the entry's whole schedule moved back so that
+ * its `nextAt` is now (C24's slots are offsets from `confirmedAt` — both move together), then the record's own alarm fired
+ * (an unpacked extension's alarm may be due at once): the background wakes exactly as at that slot.
+ */
+export async function slotComes(h: Harness, signature: string): Promise<void> {
+  await h.sw.evaluate(
+    async ({key, sig, name}) => {
+      const entries = ((await chrome.storage.local.get(key))[key] ?? []) as {signature: string; confirmedAt: number; nextAt: number}[];
+      const now = Date.now();
+      const moved = entries.map(e => {
+        if (e.signature !== sig) return e;
+        const by = Math.max(0, e.nextAt - now + 1_000);
+        return {...e, confirmedAt: e.confirmedAt - by, nextAt: e.nextAt - by};
+      });
+      await chrome.storage.local.set({[key]: moved});
+      await chrome.alarms.create(name, {when: Date.now()});
+    },
+    {key: 'v1_presale_records', sig: signature, name: RECORD_ALARM},
+  );
+}
+
 /** The background's own answer: what is prepared for the account (null: nothing). */
 export const preparedPurchase = async (p: Page) => (await msg(p, {type: 'presale.preparedFor', account: ACCOUNT})).data ?? null;
```

`extension/e2e/presale.spec.ts` — the moved helpers imported (no row changes):

```diff
diff --git a/extension/e2e/presale.spec.ts b/extension/e2e/presale.spec.ts
index 0a9728f..9e2122d 100644
--- a/extension/e2e/presale.spec.ts
+++ b/extension/e2e/presale.spec.ts
@@ -1,7 +1,6 @@
 import {test, expect, type Page} from '@playwright/test';
 import {base58, base64} from '@scure/base';
 import {BLOCKHASH_LIFETIME, FAKE_START_HEIGHT, parseV0} from './fakeCoordinator';
-import {contained, launchPopup, type Harness} from './popupHarness';
 import {E2E_PASSWORD} from './makeEnvelope';
 import {ACCOUNT, groups, msg, startSend} from './sendHelpers';
 import {
@@ -22,7 +21,7 @@ import {
   stableCents,
   tokensFor,
 } from './presaleChain';
-import {USDC_HOLDING, amount, buyAction, cspControl, geoScreen, home, preparedPurchase, presaleWallet, quickLabels, watchCsp} from './presaleHelpers';
+import {USDC_HOLDING, amount, buyAction, cspControl, detailRows, done, geoScreen, home, preparedPurchase, presaleWallet, quickLabels, scene} from './presaleHelpers';
 
 declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};
 
@@ -54,17 +53,8 @@ const ROW = {
   why: 'Why this matters | Token sales are restricted by jurisdiction · this wallet checks before every purchase',
 };
 
-async function scene(prefix: string): Promise<{h: Harness; csp: string[]}> {
-  const h = await launchPopup(prefix);
-  return {h, csp: await watchCsp(h.ctx)};
-}
-function done(h: Harness, csp: string[]): void {
-  contained(h);
-  expect(csp).toEqual([]);
-}
 /** SOL as #11 shows it: four places, floored. */
 const solText = (lamports: bigint): string => `${lamports / SOL}.${((lamports % SOL) / 100_000n).toString().padStart(4, '0')}`;
-const detailRows = (p: Page) => p.locator('.detail-row').evaluateAll(rs => rs.map(r => [r.querySelector('.lbl')?.textContent ?? '', r.querySelector('.val')?.textContent ?? '']));
 const feeRows = (p: Page) => p.locator('.fee-block .fee-row').evaluateAll(rs => rs.map(r => [...r.children].map(c => c.textContent ?? '').filter(t => t !== '')));
 /** The prepared-purchase view the background answers, as far as these specs read it. */
 type Prepared = {reauth: {proven: boolean} | null; stage: number; destination: string} | null;
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, Playwright.**

Run: `npx vitest run scripts/__tests__/check-no-presale.test.mjs` — `Tests  55 passed (55)`.

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  222 passed (222)` · `Tests  4672 passed (4672)` (previous tree 222 / 4669: +3 rows in `check-no-presale.test.mjs`). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  18 passed (18)` · `Tests  435 passed | 25 skipped (460)` (unchanged).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build, the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 26 required modules and no presale module outside ON_BUILD; 97 markers (none in the off build, each in the on build); 9 strings and the decoder's instruction names stay in the off build`. (The on build's presale-path modules are exactly `ON_BUILD`'s 21 plus the three shared `core/presale` modules — read from `dist/*.modules.json` before the rule was written.)

Playwright — the new specs: `npx playwright test e2e/presaleRecord.spec.ts e2e/presaleReferral.spec.ts` — `5 passed (1.7m)` (E2E 10 recording 36.5 s — 20 s of it the timeout; D29 / D30 23.6 s; E2E 11 6.9 s; E2E 12 18.3 s and 17.5 s). **The whole suite (the brief's containment rule), on this commit:** `npx playwright test` — `101 passed (26.1m)`; `unshare -rn sh -c 'ip link set lo up && npx playwright test'` — `101 passed (26.3m)`. No spec reaches `*.noc-tura.io` beyond the fake's route, solscan.io or any network (every presale spec ends with `contained(h)`; under `unshare -rn` there is no network to reach).

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "test(extension): B1d-2 gates and E2E 10–12 — the off-build gate refuses a presale module the on build carries and ON_BUILD does not name, and every B1d-2 string of the presale copy is armed by a marker (or named as shared copy); the fake coordinator's record route scripted (a status and body, or a timeout past the extension's 20 s) and held to D28's payload, /referral-stats, and the fake program's register_referrer with the referrer allocation it credits (account 3 = the effective referrer's PDA) and the allocation keeping its bonus and referrer; E2E 10 (500, timeout, accepted at the third slot — a slot made to come by moving the entry's schedule and firing its alarm; #27's Q34 gone on reopen; D29 refused never POSTed again, D30 verified:false done), E2E 11 (#31 → #24, /referral-stats failing → two '—', EARNED kept, Copy → exactly the link, the checkmark for its 2 s), E2E 12 (self → Q46b and Buy held, prepare refuses; a referrer → #20 / #10 Referred by with Q47 → register_referrer + account 3 → on chain → the record's referrerAddress; an on-chain referrer → no field, no Q47, nothing registered); E2E 7 refuses B1d-2's three message types in the build without presale" -m "Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked; R5 with the commit's own `dist/` and `dist-nopresale/` copied in — it changes only the gate script, so the builds are the commit's), `timeout 900` for a Playwright run, `timeout 300` otherwise; `tsc`'s own exit code first (0 for every one), then, for an E2E mutant, `node scripts/build.mjs` and only the named test (`-g`).** `PR` = `presaleRecord.spec.ts`, `PF` = `presaleReferral.spec.ts`, `NP` = `check-no-presale.test.mjs` (55). Bold: the brief's pins.

| id | the change | named test → observed |
|---|---|---|
| R1 | **(the record's retry dropped)** `record.ts` `sendNext`: `const slot = slotAfter(e.confirmedAt, now);` → `const slot: number \| null = null;` (every claim is the last one: a failed POST gives the entry up) | PR "10 · recording …" (`-g '10 · recording'`) — tsc 0 · RED `1 failed`: `heldRecord(h, signature, 1)` (spec :65) — after the 500 the entry is `given-up`, never `due` (`Timeout 60000ms exceeded while waiting on the predicate`) |
| R2 | **(register_referrer dropped from the built transaction)** `core/presale/buyInstructions.ts` `buildBuyInstructions` (SOL): the spread `...(resolved.registerReferrer ? [buildRegisterReferrerInstruction(user, resolved.registerReferrer)] : []),` removed | PF "12 · referral address …" — tsc 0 · RED `1 failed` at :163 (`Confirm purchase` never shown): #23 says Q11 "Presale unavailable — try again later." — the background's own message check (Task 2: the bytes must carry the registration prepare resolved) refuses the purchase before anything is simulated or signed |
| R3 | **(D29: a 400 is final)** `record.ts` `outcomeOf`: the line `if (a.status === 400 && body?.success === false && typeof body.error === 'string') return 'refused';` removed (the 400 is retried) | PR "10 · D29 and D30 …" — tsc 0 · RED `1 failed` at :113: the refused purchase's entry `Received: "due"`, not `"refused"` |
| R4 | **(a gate marker deleted)** `check-no-presale.mjs` `MARKERS` without Q34 (`'Recorded on chain; presale service not yet updated'`) | NP — tsc 0 · RED `Tests  2 failed \| 53 passed (55)`: the pinned list ("armed by B1d-1b: …") and **"every B1d-2 string of the presale copy is armed by a marker, or is shared copy"** (Q34 unarmed). Observed beside it: `node scripts/check-no-presale.mjs dist-nopresale dist` with this gate file stays exit 0 (`96 markers`) — a deletion only weakens the scan; the copy row is what makes it red beyond the pin |
| R5 | **(an `ON_BUILD` module deleted)** `'src/background/presale/record.ts'` removed from `ON_BUILD` | `node scripts/check-no-presale.mjs dist-nopresale dist` (the commit's builds) — exit 1: `on build carries src/background/presale/record.ts — a presale module ON_BUILD does not name: the positive control must list every one`; NP `Tests  2 failed \| 53 passed (55)` (the pinned list, the `unlistedModules` row) — tsc 0. Observed beside it: Task 5's gate (`ceb648b`) with the same entry removed passes the same builds (exit 0) — before this task the list was a positive control only |
| R6 | (D28: `usdValue` in dollars, converted at the edge) `purchasePayload`: `usdValue: Number(formatTokenAmount(BigInt(spentCents), 2)),` → `usdValue: Number(spentCents),` | PR "10 · recording …" — tsc 0 · RED at :66: `"usdValue": 1500` for `15` (the fake's shape check passes it — a positive number — the payload pin does not) |
| R7 | **(the record's `referrerAddress`)** `purchasePayload`: `...(referrer === null ? {} : {referrerAddress: referrer}),` → `...{},` | PF "12 · referral address …" — tsc 0 · RED at :192 (`toMatchObject`: no `referrerAddress`) |
| R8 | **(Copy puts exactly the link in the clipboard)** `ReferFriend.tsx`, the icon button: `doCopy(data.link)` → `doCopy(account ?? '')` | PF "11 · referral …" — tsc 0 · RED at :81: the spy holds `HAgk…` (the address), not `https://noc-tura.io?ref=HAgk…` |
| R9 | **(D30: `verified: false` is done)** `outcomeOf`: `if (a.status === 200 && body?.success === true) return 'done';` → `… && body?.success === true && body.verified === true) return 'done';` | PR "10 · D29 and D30 …" — tsc 0 · RED at :118: the accepted purchase's entry `Received: "due"` |
| R10 | **(EARNED stands when `/referral-stats` fails)** `referral.ts` `referralView`: `earnedBase: earned === null ? null : earned.toString(),` → `earnedBase: earned === null \|\| s === null ? null : earned.toString(),` | PF "11 · referral …" — tsc 0 · RED at :91: `"—"` for `"16.1"` |
| R11 | (the slot comes through the product's own alarm path — the test step is not a back door) `api.ts`: `host.alarm(PRESALE_RECORD_ALARM, () => wakePresaleRecords(host.ext, host.deps));` → `host.alarm(PRESALE_RECORD_ALARM, () => Promise.resolve());` | PR "10 · recording …" — tsc 0 · RED at :75: `heldRecord(h, signature, 2)` — the fired alarm sends nothing (start-up's wake and the hook still work: the first POST happened) |
| R12 | **(#27 reopened: Q34 gone once accepted)** `record.ts` `unrecordedFor`: `filter(e => e.account === account && e.state !== 'done')` → `filter(e => e.account === account)` | PR "10 · recording …" — tsc 0 · RED at :87: `presale.unrecorded` still lists the signature after the third slot's 200 |

12 mutations, each alone: every one compiled (`tsc` 0) and turned its named test red; the four the brief pins are R1, R2, R3 and R4 (with R5 the module list's twin).

#### Notes for the executor (Task 6)

- **Ruling: a slot is made to come by moving the entry's schedule back and firing the record's own alarm** (`slotComes`), after `heldRecord` has waited out the run and cleared the armed alarm — the ledger's "a test hook or fake coordinator timing" without any product hook or fake clock in the worker (the background's clock is `Date.now`); the background then runs its real alarm path (R11 proves the hook goes nowhere else) — why: no test-only code ships in the extension, and the schedule's spacing is kept (`nextAt − confirmedAt` is asserted: 60 000, then 300 000) — cost if wrong: a test that rewrote storage while a run was writing would race; `heldRecord` rules that out by waiting for the run's last step and clearing its alarm (record.ts never arms it sooner than 30 s ahead).
- **Ruling: the timeout is real** — the fake holds the record's answer past the extension's 20 s `REQUEST_TIMEOUT_MS` (written out in `fakeCoordinator.ts`: e2e cannot import `deps.ts`, which reaches core/ and web3.js) instead of aborting the request, so the attempt is retried by the extension's own timeout, not by a network error — cost: 20 s of E2E 10's 36 s; while it is held the shared latch keeps every other coordinator request waiting (the latch serialises), which this test tolerates.
- **Ruling: D29 and D30 are proved in one test with an in-wake control** — two purchases (the first answered the route's own 400 `not_a_presale_purchase`, the second `200 {success: true, verified: false, duplicate: true}`), then one wake with a third entry seeded due: the wake POSTs exactly the seeded one, so "no further POST" for the refused and the done entries is observed after a run that demonstrably ran (a fired one-shot alarm disappears whether or not anything ran — absence alone proved nothing) — cost if wrong: none.
- **Ruling: the fake models `register_referrer` and the program's account-3 seed rule, not the referral bonus** — the bonus the program pays into the referrer's allocation (10 % once, Task 2's mainnet observation) is not modelled: no spec reads it, the wallet checks the buyer's allocation only, and modelling an observed-but-unspecified rule would be guessing; E2E 11 seeds `referral_bonus_tokens` @76 directly — cost if wrong: a future spec of the referrer's EARNED after a referred purchase must add it.
- **Ruling: AlreadyHasReferrer (6016) is modelled but no E2E reaches it** — the background refuses an intent with a referrer for an account that already has one (`referrer-not-applicable`, asserted in E2E 12's on-chain test) before anything is simulated; Task 2's own rows cover the simulation's 6016 against fakes — stated, not tested here.
- **Ruling: 429 and 403 are scriptable but not scripted** — `recordAnswers` takes any status and body; a 403 is CrowdSec's ban of every route (the existing `network: 'forbidden'`), whose cool-down would end the scene; both are Task 1's unit rows (the latch's persisted end, the retry) — the brief's list of scripted answers is met by the route, the E2E pins the spec's three (500, timeout, 200) plus D29's 400 and D30's 200 — cost if wrong: one E2E row.
- **Ruling: the module list is complete by construction** (`unlistedModules`): before this task deleting an `ON_BUILD` entry passed the gate (observed: Task 5's gate, `record.ts` removed, exit 0 on the same builds) — the list only proved the on build carried what it named. Now a presale module the on build carries and the list omits fails, so a later plan cannot ship a module without its control. "Presale module" is `offModuleViolations`' own definition (one rule for both directions) — cost if wrong: none (21 + 3 shared = exactly the on build's presale-path modules today).
- **Ruling: the strings' completeness is a source row, not a spec parse** — every B1d-2 string of `text.ts` (29, the objects and keys Tasks 2–5 added, `usedTail` called) of ≥ 8 characters that is not a bare word must contain a marker, except the two shared ones named in the row (Q46a, a prefix of B1b's #12 line; "Copy failed", B1b's useCopy — both in the off build) — why: `npm run gates` cannot see a missing marker (R4: the built gate stays green with 96), the pin sees only that the list changed, not that a string has none — cost if wrong: none. **Out of scope, reported:** run over all of `text.ts`, B1d-1b's copy has unarmed strings of ≥ 8 characters — "Not available in your region?", "Next stage ", "Available ", "Estimated NOC", "View on Solana explorer", "Need a little SOL for the network fee", "Network fee", GEO's "This wallet doesn't offer the presale in your region." (some are B1b's, shared, rightly unarmed; some may be on-build only) — B1d-1b's plan ruled its list; a follow-up may extend the row to the whole module with a reasoned exemption list.
- **Ruling: `scene` / `done` / `detailRows` move to `presaleHelpers.ts`** (the brief: extend the harness, don't fork it) — `presale.spec.ts` imports them, no row changed — cost: none.
- **Ruling: E2E 7 also refuses B1d-2's three message types in the build without presale** (`unknown type`, as `presale.view`) — §6.3's E2E 7 names `presale.view`; the new types are the same rule's — cost: one line.
- **Ruling: the referral E2E reads the copy through a spy on `navigator.clipboard.writeText`** (an init script; the popup's `readText` is permission-denied, Task 4) and holds the popup's clock (`page.clock.pauseAt`, then `runFor(2_000)`) so the checkmark's 2 s is asserted without racing the timer — the standing "a flake is a finding" rule — cost: none.
- **Found:** R2's mutant is caught by the wallet itself before the fake program could (Task 2's message re-verification) — E2E 12 is red at #20 with Q11, not at the wire assertion; the wire assertions (instruction 2 = `register_referrer(REFERRER)` on the buyer's PDAs, account 3 = the referrer's allocation, 4 instructions; 3 and no registration for an on-chain referrer) pin the green tree. The fake program would refuse the same mutant too (account 3 ≠ the default key's PDA → 2006).
- **For Task 7:** the shots §6.4 asks of B1d-2 can reuse these scenes — #24 populated (E2E 11 before Copy; `referralStats` 3 / $1,234.56, bonus 16.12…), copied (after Copy, the clock held), a null stat (`referralStats` 500), 24b empty (the default `referralStats`, no allocation); the field with Q46b (E2E 12 after the self blur); #20 with "Referred by" and Q47 (E2E 12) and without the note (the on-chain test); #27 with Q34 (E2E 10 after `heldRecord(…, 1)`: due, no alarm armed). `installReferrer`, `REFERRER`, `heldRecord`, `slotComes` are exported for that.
- **Rev 3.4's list gains (for Task 7):** the gate's completeness rule (`unlistedModules`) and the B1d-2 copy row; the E2E's slot mechanism (no fake clock in the worker); D29 / D30's in-wake control.
- **Dry run:** clone `dry/b1d2`, commit `2c6c023` on Task 5's `ceb648b` (one commit, amended once: a helper comment that claimed "the earliest an armed alarm fires is 30 s after it was armed" — true of record.ts's own arming, not of Chrome for an unpacked extension (this test fires one at once) — reworded to what record.ts does). The whole Playwright suite ran on that tree: `101 passed (26.1m)` normally (started on `beddc41`, the comment-only predecessor) and `101 passed (26.3m)` under `unshare -rn`; the 12 mutations on `2c6c023`. `tsc` 0, both vitest runs, both builds and `npm run gates` on `beddc41` (identical but for that comment). The blocks above are `git diff ceb648b 2c6c023` per file and the new files in full; replayed with `git apply --recount` onto a `git archive ceb648b` copy plus the new files, the result is byte-identical to `2c6c023`'s `extension/`.

---

### Task 7: The visual pass and spec rev 3.4 — `visual-presale.spec.ts` shoots every state B1d-2 built through the real extension (#31's row; #24 populated, copied, a null stat, empty; #23a's referral address with Q46a, Q46b, Q46c, a valid address and Q48; #20 and #10 with "Referred by", with and without Q47; #26's badge on a site's purchase with two badges; #27 with Q34 — copy asserted, the sticky bar wholly in the 412 × 600 frame, after the holds); each shot compared with `index.html`; found and fixed: #24's REFERRED wrapping after its comma, #10's "Referred by" label wrapping; B1d-1b's unarmed copy armed and the whole of `text.ts` held to the marker rule; the spec to rev 3.4

**Spec:** B1d §6.4 (B1d-2's rows: "#24 (populated, empty, a null stat, copied), the referral field with a line, #20 with 'Referred by', #26 badge, #27 line"; the opus-tier review against `index.html`, every departure checked against §9), §4 (the popup 412 × 600, the sticky bar stays), §4.1 (the referral address), §4.2 (#20 / #10 "Referred by", Q47), §4.4 (#24), §4.6 (#26, #27), §6.2 item 2 (every on-build §10 string's literal parts ≥ 8 characters a marker; no marker one bare word), §2.4 as amended by D28–D30. Brief item 7 ("the spec's rev 3.4 change list of every departure this plan makes (one line each) + D28–D30 written into §2.4"); ledger: every "→ rev 3.4" line and ruling, and Task 6's ruling "the ~8 B1d-1b strings in text.ts of ≥ 8 chars without a marker are armed in Task 7 where not shared with B1b". Design `/home/user/Downloads/index.html` — BINDING: #24 ix 10903-11233 (`#screen-24`, phones 0–2: 24a, 24a-bis, 24b), #23 ix 10603-10902 (`#screen-23`), #20 (`#s20`), #10 (`#s10`), #26 (`#s26`), #27 (`#s27`), #31 (`#s31`). It contains the TGE date: nothing was copied from it — the comparison was made on rendered images kept in the scratchpad (`scratchpad/b1d2-t7/design/`, `cmp/`), and no design text enters this task's files (`check-no-tge-date.mjs` green, both the extension's and the repository's).

**Files:**
- Modify (visual): `extension/e2e/visual-presale.spec.ts` — B1d-1b's file, four tests added (B1d-1b's "What later work relies on": "B1d-2 adds its rows … as new tests in the same file"), 17 shots + 5 `-end`; it reuses `frame` / `wholeBar` unchanged
- Modify (product, the findings): `extension/src/app/presale/ReferFriend.tsx` (a figure of ≥ 8 characters gets `app-ref-long`), `extension/src/app/app.css` (`.s-ref .stats .stat .val.app-ref-long`), `extension/src/unlock/screens/reauth.ts` (`row`'s `keep`: an address row's label `vlt-keep`), `extension/src/unlock/unlock.css` (`.vlt-col .s-pin .intent-row .label.vlt-keep`)
- Modify (tests of the findings): `extension/src/app/presale/__tests__/ReferFriend.test.tsx`, `extension/src/unlock/__tests__/reauthPurchase.test.ts`
- Modify (gate): `extension/scripts/check-no-presale.mjs` (`MARKERS` 97 → 105: B1d-1b's eight unarmed strings), `extension/scripts/__tests__/check-no-presale.test.mjs` (the exact list; a new row reading the whole of `text.ts` as source)
- Modify (spec): `docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md` → rev 3.4, text only (Step 3b)

No `core/`, root `src/` or `web/` change: the root `tsc` / `jest` and web's `verify` are not this task's.

**Interfaces:**
- Consumes (through the built extension only — `dist/chrome`, `dist-nopresale/chrome`): Tasks 1–6 as built. The harness: B1d-1b's `frame(p, name, copy, {ready?, end?, bars?})` and `wholeBar` (`visual-presale.spec.ts`, unchanged), `launchPopup` / `contained`, `watchCsp`, `presaleWallet`, `home`, `buyAction`, `amount`, `installReferrer`, `REFERRER` (Task 6, `presaleHelpers.ts`), `presaleChain.ts` (`allocationData`, `allocationPda`, `userData`, `userPda`, `nocText`, `tokensFor`, `solCents`, `SOL_TREASURY`), `historyFixtures.ts` (`sentSol`, `presalePurchase`, `sig`), the fake's `referralStats` / `referralStatsReads`, `presale.accounts`, `history`, `purchaseRecords`, `broadcasts`; the popup's clock (`openPopup({clock: true})`, `pauseAt` / `runFor`, as E2E 11). Selectors: Task 3's `#presale-referrer` (label Q45), `.app-pre-referral .helper`, `.detail-row` "Referred by" (`.addr-groups > span`, `.app-pre-note`); #10's `#ra-rows .intent-row .label`; Task 4's `.s7-group-label` "Rewards", `.s7-row` "Refer a friend", `.s-ref .stats .stat .val` (`.acc`, `.app-ref-muted`), `.code-card .lbl-row .uses`, `.code-row(.app-ref-copied) .code`, `.actions button`, `.share-btn`, `.banner`, `.legalese`; Task 5's `.tx-row` + `hasText`, `.pri .status-pill.app-badge`, `.s-txd .banner.info`; `v1_presale_records` / `v1_dapp_txs` seeded through the service worker.
- Produces (product):
  ```ts
  // ReferFriend.tsx — Stat: a figure of eight characters or more is set at 16 px (app.css)
  `val noc-balance-md noc-numeral${tone…}${value.length >= 8 ? ' app-ref-long' : ''}`
  // reauth.ts — row(label, value, keep = false): keep → the label's class gains 'vlt-keep' (flex: none); the 'other'
  // kind's address rows (To, Referred by) pass keep
  ```
- Produces (gate): `MARKERS` gains `' of 10 · live'`, `'Next stage '`, `'Not available in your region?'`, `'Estimated NOC'`, `' of 10 · @ '`, `'View on Solana explorer'`, `'Need a little SOL for the network fee'`, `"This wallet doesn't offer the presale in your region."` (105).
- **What later work relies on:** the gate's text.ts row — any new string of the presale copy needs its marker, or is one of the five named exemptions; `visual-presale.spec.ts`'s `oneLine(locator)` (the element's height under 1.5 line heights).

#### How the shots are taken

As B1d-1b's Task 9: each scene a fresh contained browser (`launchPopup`) with the CSP watch, ending with `contained(h)` and an empty CSP log; the popup at 412 × 600, the vault page (#10) at 412 × 916 full page. Every `frame` shot asserts its copy first (visible, wholly in the frame, clear of the pinned bars), then the exact number of sticky bars, each wholly in the frame, then `ready` enabled (after a LockedButton's floor); `end` asserts the screen is taller than the frame and shoots it again at its end. A transient state is held, never slept through: 24a-bis by the popup's paused clock (useCopy's 2 s), #27's Q34 by a seeded `given-up` entry (no POST, `purchaseRecords` asserted empty), Q48 by the fake chain changing between typing and the blur. Nothing is broadcast in any scene (asserted).

| scene (test) | shots (`test-results/visual/*.png`) |
|---|---|
| `#31 … #24 …` — a returning buyer credited 32.41… NOC as a referrer, `/referral-stats` 12 people / $1,234.56 | `31-refer-row` (#31, the Rewards group); `24-referral` (24a); `24-referral-copied` (24a-bis, clock held); `24-referral-null-stat` (`/referral-stats` 500: "—", 32.4, "—", no usage line); `24-referral-empty` (24b: no allocation, nobody referred — 0, 0.0 tertiary, $0.00, "Not used yet") |
| `#23a's referral address …` — a first purchase, 0.5 SOL, REFERRER installed | `23a-referrer-empty` (+`-end`, placeholder Q45); `23a-referrer-invalid` (+`-end`, Q46a); `23a-referrer-self` (Q46b); `23a-referrer-no-allocation` (Q46c); `23a-referrer-valid` (Buy enabled); `20-referred-by` (+`-end`, Q47 in the value); `10-referred-by` (vault page, the note its own row) |
| `#23a when the address can no longer apply …` — REFERRER registered for the account between typing and the blur | `23a-referrer-not-applicable` (Q48 as #23's notice, the field gone); `20-referred-onchain` (+`-end`, no note); `10-referred-onchain` (no note, no account-setup row: the PDAs exist) |
| `#26 with the "Presale" badge … #27 with Q34` — history: a send, the wallet's purchase, a site's purchase (`v1_dapp_txs`); the wallet's purchase `given-up` | `26-presale-badges` (the site's row: "Presale" + "Dapp · simulated" wrapped under the title, `.pri` not overflowing); `27-unrecorded` (+`-end`, Q34's info banner) |

- [ ] **Step 1: Write the tests.** The four visual tests (the spec's copy and layout of each state, and — for the findings of Step 5 — the two one-line checks, `oneLine`), the unit rows of the findings, and the gate's rows (the eight new markers in the exact list; the whole of `text.ts` read as source).

`extension/e2e/visual-presale.spec.ts`:

```diff
diff --git a/extension/e2e/visual-presale.spec.ts b/extension/e2e/visual-presale.spec.ts
index df78685..48ede77 100644
--- a/extension/e2e/visual-presale.spec.ts
+++ b/extension/e2e/visual-presale.spec.ts
@@ -8,8 +8,9 @@ import {E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
 import {unlockWith} from './vaultPage';
 import {ACCOUNT, msg} from './sendHelpers';
 import {DAPP_HOSTS, adapter, approvalWindow, openDapp, serveDapp, windowClosed} from './dappPage';
-import {CONFIG_PDA, SOL_TREASURY, USDC_MINT, configData, nocText, restrictedList, solCents, solPurchaseIx, stableCents, tokensFor, userData, userPda} from './presaleChain';
-import {USDC_HOLDING, amount, buyAction, home, installPresale, presaleWallet, quickLabels, watchCsp} from './presaleHelpers';
+import {CONFIG_PDA, SOL_TREASURY, USDC_MINT, allocationData, allocationPda, configData, nocText, restrictedList, solCents, solPurchaseIx, stableCents, tokensFor, userData, userPda} from './presaleChain';
+import {REFERRER, USDC_HOLDING, amount, buyAction, home, installPresale, installReferrer, presaleWallet, quickLabels, watchCsp} from './presaleHelpers';
+import {presalePurchase, sentSol, sig} from './historyFixtures';
 import {DIR} from './visualTab';
 
 declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};
@@ -21,7 +22,10 @@ declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};
 // windows.create size), the vault page at 412 × 916. Every shot asserts its own copy first, then that its sticky bar
 // is wholly in the frame and the copy clear of the pinned bars, and is taken after the screen's holds (a LockedButton's
 // 500 ms floor, #48's 1.5 s arming): an enabled CTA is awaited enabled. A screen taller than its frame is shot again
-// scrolled to its end (`-end`), the bar still wholly in view. Not a pixel diff.
+// scrolled to its end (`-end`), the bar still wholly in view. Not a pixel diff. B1d-2 (Task 7) adds its states in the same
+// way: #31's "Refer a friend" row, #24 (populated, copied, a null stat, empty), #23a's referral address with each of its
+// lines (Q46 a–c, Q48), #20 and #10 with "Referred by" (with and without Q47's note), #26's "Presale" badge (a site's
+// purchase with two) and #27 with Q34 (index.html #24 ix 10903-11233, #23 ix 10603-10902, #20, #10, #26, #27, #31).
 
 const SOL = 1_000_000_000n;
 /** A returning buyer's allocation on chain (two purchases): no account setup, no first-purchase re-authentication. */
@@ -591,3 +595,235 @@ for (const [build, ext, suffix] of [
     }
   });
 }
+
+// ---- B1d-2 (Task 7) ----
+
+const Q47 = "Saved to your presale account with this purchase. It can't be changed later.";
+/** The element's text sits on one line (its box less than one and a half of its line height). */
+const oneLine = (l: Locator) => l.evaluate(e => e.getBoundingClientRect().height < 1.5 * parseFloat(getComputedStyle(e).lineHeight));
+/** #24's three figures as shown (REFERRALS, EARNED, REFERRED). */
+const figures = (p: Page) => p.locator('.s-ref .stats .stat .val').allTextContents();
+test('visual · #31 with "Refer a friend"; #24 populated, copied (24a-bis without the toast), a null stat, empty (24b)', async () => {
+  test.setTimeout(240_000);
+  const h = await launchPopup('noctura-e2e-visual-presale-referral-');
+  const csp = await watchCsp(h.ctx);
+  try {
+    await presaleWallet(h, {allocation: {...RETURNING, bonusBase: 32_412_345_678n}});
+    h.fake.referralStats = {status: 200, body: {success: true, data: {totalReferrals: 12, totalReferredUsd: 1234.56, totalReferredPurchases: 14}}};
+    const p = await h.openPopup({clock: true});
+    await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
+    await p.getByRole('button', {name: 'Settings'}).click();
+    const row = p.locator('.s7-row', {hasText: 'Refer a friend'});
+    await expect(p.locator('.s7-group-label', {hasText: 'Rewards'})).toBeVisible({timeout: 30_000});
+    await frame(p, '31-refer-row', row, {ready: row, bars: 0});
+    await row.click();
+    await expect(p.locator('.s-ref .top-bar .title')).toHaveText('Refer a friend', {timeout: 30_000});
+    await expect.poll(() => figures(p), {timeout: 30_000}).toEqual(['12', '32.4', '$1,234.56']);
+    await expect(p.locator('.s-ref .stats .stat .val.acc')).toHaveText('32.4');
+    // Found by this pass: "$1,234.56" wrapped after its comma in its third of the row — now a size smaller, on one line.
+    expect(await oneLine(p.locator('.s-ref .stats .stat .val').nth(2)), 'REFERRED on one line').toBe(true);
+    await expect(p.locator('.s-ref .code-card .lbl-row')).toHaveText('YOUR INVITE LINKUsed by 12 people', {timeout: 30_000});
+    await expect(p.locator('.s-ref .code-card .code-row .code')).toHaveText(`https://noc-tura.io?ref=${ACCOUNT}`);
+    await expect(p.locator('.s-ref .banner')).toHaveText('Earn NOC when friends you invite buy in the presale.');
+    await expect(p.locator('.s-ref .legalese')).toHaveText('Referral payouts are subject to program terms. Self-referrals are detected and rejected.');
+    const copy = p.locator('.s-ref .code-card .actions button');
+    await frame(p, '24-referral', p.locator('.s-ref .code-card'), {ready: copy, bars: 0});
+
+    // 24a-bis: the checkmark and the accent border while useCopy says copied (its 2 s, the popup's clock held).
+    await p.clock.pauseAt(Date.now() + 1_000);
+    await copy.click();
+    await expect(copy).toHaveAttribute('aria-label', 'Copied');
+    await expect(p.locator('.s-ref .code-card .code-row.app-ref-copied')).toHaveCount(1);
+    await expect(p.locator('.s-ref .share-btn')).toHaveText('Copied');
+    await frame(p, '24-referral-copied', p.locator('.s-ref .code-card'), {bars: 0});
+    await p.clock.runFor(2_000);
+    await expect(p.locator('.s-ref .code-card .code-row.app-ref-copied')).toHaveCount(0);
+    await p.clock.resume();
+
+    // A null stat: /referral-stats fails — its two figures "—", the usage line hidden, EARNED still the chain's.
+    h.fake.referralStats = {status: 500, body: {success: false, error: 'connection terminated'}};
+    await p.getByRole('button', {name: 'Back'}).click();
+    await p.locator('.s7-row', {hasText: 'Refer a friend'}).click();
+    await expect.poll(() => figures(p), {timeout: 30_000}).toEqual(['—', '32.4', '—']);
+    await expect(p.locator('.s-ref .code-card .lbl-row .uses')).toHaveCount(0);
+    await frame(p, '24-referral-null-stat', p.locator('.s-ref .stats'), {ready: copy, bars: 0});
+
+    // 24b: nobody referred yet and no allocation on chain — zeros, "Not used yet", EARNED in the tertiary tone.
+    h.fake.referralStats = {status: 200, body: {success: true, data: {totalReferrals: 0, totalReferredUsd: 0}}};
+    h.fake.presale.accounts.delete(allocationPda(ACCOUNT));
+    await p.getByRole('button', {name: 'Back'}).click();
+    await p.locator('.s7-row', {hasText: 'Refer a friend'}).click();
+    await expect.poll(() => figures(p), {timeout: 30_000}).toEqual(['0', '0.0', '$0.00']);
+    await expect(p.locator('.s-ref .stats .stat .val.app-ref-muted')).toHaveText('0.0');
+    await expect(p.locator('.s-ref .code-card .lbl-row .uses')).toHaveText('Not used yet');
+    await frame(p, '24-referral-empty', p.locator('.s-ref .code-card'), {ready: copy, bars: 0});
+    expect(h.fake.referralStatsReads).toEqual([ACCOUNT, ACCOUNT, ACCOUNT]);
+    expect(csp).toEqual([]);
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
+
+/** #23a's referral address: `text` typed, the field left (blur — the background's check), its line awaited (null: none). */
+async function referrerTyped(p: Page, text: string, line: string | null): Promise<void> {
+  const field = p.getByLabel('Referral address (optional)');
+  await field.fill(text);
+  await field.blur();
+  const helper = p.locator('.app-pre-referral .helper');
+  if (line === null) {
+    await expect(buyButton(p)).toBeEnabled({timeout: 30_000});
+    await expect(helper).toHaveCount(0);
+  } else {
+    await expect(helper).toHaveText(line, {timeout: 30_000});
+    await expect(buyButton(p)).toBeDisabled();
+  }
+}
+/** #20's "Referred by": the whole address in groups of four, and Q47's note (null: none). */
+async function referredBy(p: Page): Promise<{address: string; note: string | null}> {
+  const row = p.locator('.detail-row', {hasText: 'Referred by'});
+  await expect(row).toHaveCount(1);
+  const note = row.locator('.app-pre-note');
+  return {address: (await row.locator('.addr-groups > span').allTextContents()).join(''), note: (await note.count()) === 0 ? null : await note.textContent()};
+}
+
+test('visual · #23a’s referral address: Q46a, Q46b, Q46c and a valid address; #20 with "Referred by" and Q47; #10 saying it', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-visual-presale-referrer-');
+  const csp = await watchCsp(h.ctx);
+  try {
+    await presaleWallet(h);
+    installReferrer(h);
+    const p = await home(h);
+    await toPresale(p);
+    await amount(p, '0.5', nocText(tokensFor(solCents(SOL / 2n, 150), 0)));
+    const field = p.getByLabel('Referral address (optional)');
+    await expect(field).toHaveAttribute('placeholder', 'Solana address of the person who invited you');
+    await frame(p, '23a-referrer-empty', field, {ready: buyButton(p), end: true});
+    await referrerTyped(p, 'not-an-address', 'Not a valid Solana address');
+    await frame(p, '23a-referrer-invalid', p.locator('.app-pre-referral'), {end: true});
+    await referrerTyped(p, ACCOUNT, "You can't refer yourself or another account in this wallet");
+    await frame(p, '23a-referrer-self', p.locator('.app-pre-referral'));
+    await referrerTyped(p, base58.encode(new Uint8Array(32).fill(55)), "This address has no presale allocation, so it can't receive a referral bonus");
+    await frame(p, '23a-referrer-no-allocation', p.locator('.app-pre-referral'));
+    await referrerTyped(p, REFERRER, null);
+    await expect(field).toHaveValue(REFERRER);
+    await frame(p, '23a-referrer-valid', p.locator('.app-pre-referral'), {ready: buyButton(p)});
+
+    await buyButton(p).click();
+    await expect(p.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
+    expect(await referredBy(p)).toEqual({address: REFERRER, note: Q47});
+    const buy = p.getByRole('button', {name: 'Buy NOC'});
+    await frame(p, '20-referred-by', p.locator('.detail-row', {hasText: 'Referred by'}), {ready: buy, end: true});
+
+    // #10 in a new tab: the background's description repeats who, and that this purchase saves it.
+    const opened = h.ctx.waitForEvent('page');
+    await buy.click();
+    const tab = await opened;
+    await tab.setViewportSize({width: 412, height: 916});
+    await expect(tab.locator('#ra-about')).toHaveText('Confirm buying NOC with', {timeout: 30_000});
+    await expect(tab.locator('#ra-rows')).toContainText('Referred by');
+    await expect(tab.locator('#ra-rows')).toContainText(REFERRER);
+    await expect(tab.locator('#ra-rows')).toContainText(Q47);
+    // Found by this pass: the label wrapped ("Referred / by") beside the address's groups — one line now, as "To".
+    expect(await oneLine(tab.locator('#ra-rows .intent-row .label', {hasText: /^Referred by$/})), '#10: "Referred by" on one line').toBe(true);
+    await expect(tab.locator('#ra-confirm')).toBeEnabled();
+    await tab.mouse.move(0, 0);
+    mkdirSync(DIR, {recursive: true});
+    await tab.screenshot({path: `${DIR}/10-referred-by.png`, fullPage: true});
+    expect(h.fake.broadcasts).toEqual([]);
+    expect(csp).toEqual([]);
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
+
+test('visual · #23a when the address can no longer apply (Q48: a referrer registered meanwhile — the field gone); #20 and #10 naming the on-chain referrer without Q47', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-visual-presale-q48-');
+  const csp = await watchCsp(h.ctx);
+  try {
+    await presaleWallet(h);
+    installReferrer(h);
+    const p = await home(h);
+    await toPresale(p);
+    await amount(p, '0.5', nocText(tokensFor(solCents(SOL / 2n, 150), 0)));
+    await p.getByLabel('Referral address (optional)').fill(REFERRER);
+    // Another device registers REFERRER for this account (no purchase yet) before the field is left.
+    h.fake.presale.accounts.set(userPda(ACCOUNT), {lamports: 944_880, data: userData()});
+    h.fake.presale.accounts.set(allocationPda(ACCOUNT), {lamports: 1_244_600, data: allocationData({user: ACCOUNT, totalBase: 0n, spentCents: 0n, count: 0, referrer: REFERRER})});
+    await p.getByLabel('Referral address (optional)').blur();
+    await expect(p.locator('.banner .banner-title')).toHaveText('This account can no longer take a referrer — review again', {timeout: 30_000});
+    await expect(p.locator('#presale-referrer')).toHaveCount(0);
+    await frame(p, '23a-referrer-not-applicable', p.locator('.banner .banner-title'), {ready: buyButton(p)});
+
+    await buyButton(p).click();
+    await expect(p.getByText('Confirm purchase')).toBeVisible({timeout: 30_000});
+    expect(await referredBy(p)).toEqual({address: REFERRER, note: null});
+    const buy = p.getByRole('button', {name: 'Buy NOC'});
+    await frame(p, '20-referred-onchain', p.locator('.detail-row', {hasText: 'Referred by'}), {ready: buy, end: true});
+    const opened = h.ctx.waitForEvent('page');
+    await buy.click();
+    const tab = await opened;
+    await tab.setViewportSize({width: 412, height: 916});
+    await expect(tab.locator('#ra-rows')).toContainText('Referred by', {timeout: 30_000});
+    await expect(tab.locator('#ra-rows')).not.toContainText(Q47);
+    await expect(tab.locator('#ra-confirm')).toBeEnabled();
+    await tab.mouse.move(0, 0);
+    mkdirSync(DIR, {recursive: true});
+    await tab.screenshot({path: `${DIR}/10-referred-onchain.png`, fullPage: true});
+    expect(h.fake.broadcasts).toEqual([]);
+    expect(csp).toEqual([]);
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
+
+const Q34 = 'Recorded on chain; presale service not yet updated';
+test('visual · #26 with the "Presale" badge (the wallet’s purchase, and a site’s with two badges wrapped under its title); #27 with Q34', async () => {
+  test.setTimeout(240_000);
+  const h = await launchPopup('noctura-e2e-visual-presale-history-');
+  const csp = await watchCsp(h.ctx);
+  try {
+    await presaleWallet(h, {allocation: RETURNING});
+    const now = Math.floor(Date.now() / 1000);
+    const ours = sig(31);
+    const sites = sig(32);
+    h.fake.history.set(ACCOUNT, [
+      {signature: sig(30), tx: sentSol(ACCOUNT, SOL_TREASURY, 120_000_000, now - 60)},
+      {signature: ours, tx: presalePurchase(ACCOUNT, 500_000_000, now - 3_600)},
+      {signature: sites, tx: presalePurchase(ACCOUNT, 250_000_000, now - 7_200)},
+    ]);
+    // The site's purchase is B1c-2's record of what a site had this wallet sign; ours was given up by the coordinator
+    // record (§2.4: 72 h without an accepted POST — nothing is POSTed for it any more).
+    const payload = {txHash: ours, buyerAddress: ACCOUNT, paymentToken: 'SOL', paymentAmount: '0.5', nocAmount: 499.66688874, usdValue: 75, stage: 1};
+    const confirmedAt = Date.now() - 80 * 3_600_000;
+    await h.sw.evaluate(
+      ({site, entry}) => chrome.storage.local.set({v1_dapp_txs: [{signature: site, origin: 'https://presale.example', at: 1}], v1_presale_records: [entry]}),
+      {site: sites, entry: {signature: ours, account: ACCOUNT, payload, confirmedAt, attempts: 9, nextAt: confirmedAt + 72 * 3_600_000, state: 'given-up'}},
+    );
+    const p = await home(h);
+    await p.getByRole('button', {name: 'Activity'}).click();
+    const purchases = p.locator('.tx-row', {hasText: 'Presale purchase'});
+    await expect(purchases).toHaveCount(2, {timeout: 30_000});
+    await expect(purchases.nth(0).locator('.pri .status-pill.app-badge')).toHaveText('Presale');
+    await expect(purchases.nth(1).locator('.pri > span')).toHaveText(['Presale', 'Dapp · simulated']);
+    await expect(p.locator('.tx-row', {hasText: 'Sent SOL'}).locator('.app-badge')).toHaveCount(0);
+    // The site's row: its badges wrap under the title — the meta column holds the row, the amount clear of it.
+    const pri = purchases.nth(1).locator('.pri');
+    expect(await pri.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
+    await frame(p, '26-presale-badges', purchases.nth(1), {bars: 0});
+
+    await purchases.nth(0).click();
+    await expect(p.locator('.s-txd .amount-card .eyebrow')).toHaveText('PRESALE PURCHASE', {timeout: 30_000});
+    await expect(p.locator('.s-txd .banner.info')).toHaveText(Q34, {timeout: 30_000});
+    await frame(p, '27-unrecorded', p.locator('.s-txd .banner.info'), {end: true, bars: 0});
+    expect(h.fake.purchaseRecords).toEqual([]);
+    expect(csp).toEqual([]);
+    contained(h);
+  } finally {
+    await h.close();
+  }
+});
```

`extension/src/app/presale/__tests__/ReferFriend.test.tsx`:

```diff
diff --git a/extension/src/app/presale/__tests__/ReferFriend.test.tsx b/extension/src/app/presale/__tests__/ReferFriend.test.tsx
index ee3a72f..1a01a3f 100644
--- a/extension/src/app/presale/__tests__/ReferFriend.test.tsx
+++ b/extension/src/app/presale/__tests__/ReferFriend.test.tsx
@@ -116,6 +116,8 @@ describe('#24 referral (§4.4)', () => {
     ]);
     expect(value('EARNED')?.className).toBe('val noc-balance-md noc-numeral acc');
     expect(value('REFERRALS')?.className).toBe('val noc-balance-md noc-numeral');
+    // B1d-2 Task 7 (visual pass): a figure of eight characters or more is set a size smaller — "$1,234.56" in its third.
+    expect(value('REFERRED')?.className).toBe('val noc-balance-md noc-numeral app-ref-long');
     expect(document.querySelector('.s-ref .code-card .lbl-row .noc-overline')?.textContent).toBe('YOUR INVITE LINK');
     expect(uses()?.textContent).toBe('Used by 3 people');
     expect(uses()?.querySelector('.noc-numeral')?.textContent).toBe('3');
@@ -194,6 +196,7 @@ describe('#24 referral (§4.4)', () => {
     await show({chain: earned(123_456_789_000_000_000n), stats: async () => ({success: true, data: {totalReferrals: 12_345, totalReferredUsd: 1_234_567.89}})});
     expect(stats().map(s => s[1])).toEqual(['12,345', '123,456,789.0', '$1,234,567.89']);
     expect(['REFERRALS', 'EARNED', 'REFERRED'].map(l => value(l)?.innerHTML)).toEqual(['12,<wbr>345', '123,<wbr>456,<wbr>789.0', '$1,<wbr>234,<wbr>567.89']);
+    expect(['REFERRALS', 'EARNED', 'REFERRED'].map(l => value(l)?.classList.contains('app-ref-long'))).toEqual([false, true, true]);
   });
 
   it('a reply that failed: every figure "—", no link and no copy, Q11 said', async () => {
```

`extension/src/unlock/__tests__/reauthPurchase.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/reauthPurchase.test.ts b/extension/src/unlock/__tests__/reauthPurchase.test.ts
index 02d43d8..f8f482d 100644
--- a/extension/src/unlock/__tests__/reauthPurchase.test.ts
+++ b/extension/src/unlock/__tests__/reauthPurchase.test.ts
@@ -89,6 +89,9 @@ describe('#10 for a purchase (§4.2)', () => {
     ]);
     const groups = [...el('ra-rows').querySelectorAll('.intent-row')][4]?.querySelectorAll('.addr-groups > span') ?? [];
     expect([...groups].map(g => g.textContent)).toEqual(referrer.match(/.{1,4}/g));
+    // B1d-2 Task 7 (visual pass): a row naming an address keeps its label on one line ("Referred by" wrapped beside the
+    // groups); the note row, label only, still wraps.
+    expect([...el('ra-rows').querySelectorAll('.intent-row .label')].slice(3, 6).map(l => l.classList.contains('vlt-keep'))).toEqual([true, true, false]);
     expect(unstyled('v-reauth')).toEqual([]);
   });
 
```

`extension/scripts/__tests__/check-no-presale.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-no-presale.test.mjs b/extension/scripts/__tests__/check-no-presale.test.mjs
index acef1ff..39ca2d6 100644
--- a/extension/scripts/__tests__/check-no-presale.test.mjs
+++ b/extension/scripts/__tests__/check-no-presale.test.mjs
@@ -23,6 +23,7 @@ import {
 import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';
 import {PRESALE_INSTRUCTIONS} from '../../src/background/dapp/decode/presaleIdl';
 import {CONFIRM_PURCHASE_TEXT, RECORD_TEXT, REFERRAL_TEXT, REFERRER_LINE_TEXT, REFER_TEXT} from '../../src/app/presale/text';
+import ts from 'typescript';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
 const FIXTURE = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/app.modules.0b79442.json'), 'utf8'));
@@ -185,7 +186,7 @@ describe('app.features.json', () => {
 describe('strings', () => {
   const file = (path, text) => ({path, bytes: Buffer.from(text, 'utf8')});
 
-  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48), Task 4 #24’s type, #31’s row and #24’s copy, Task 5 #27’s Q34', () => {
+  it('armed by B1d-1b: Task 1 adds its three presale message types (§6.2: "every presale.* message type"), Task 2 its prepare and the intent kind, Task 3 its four sign and resume types, Task 4 #23’s copy, Task 5 #20’s, #10’s and the record words, Task 6 #11’s and #50b’s (Q44’s label "Programs" is one bare word: its value is the marker); B1d-2 Task 1 the record’s message type and alarm, Task 2 the referral address’s type and #10’s referrer row, Task 3 #23a’s referral address (Q45, Q46 b–c, Q48), Task 4 #24’s type, #31’s row and #24’s copy, Task 5 #27’s Q34, Task 7 B1d-1b’s copy that had none', () => {
     expect(MARKERS.slice(0, 9)).toEqual(['presale.view', 'presale.banner', 'presale.quote', 'presale.prepareBuy', 'presale.pending', 'presale.preparedFor', 'presale.buy', 'presale.discardPrepared', 'presale-buy']);
     // §6.2's named strings #23 shows, then Q01, Q02, Q04–Q06, Q11–Q16, Q19, Q40c, Q41c, Q41d, Q43, Q52 (each literal part ≥ 8 characters).
     expect(MARKERS.slice(9)).toEqual([
@@ -283,6 +284,14 @@ describe('strings', () => {
       'Earn NOC when friends you invite buy in the presale.',
       'Referral payouts are subject to program terms. Self-referrals are detected and rejected.',
       'Recorded on chain; presale service not yet updated',
+      ' of 10 · live',
+      'Next stage ',
+      'Not available in your region?',
+      'Estimated NOC',
+      ' of 10 · @ ',
+      'View on Solana explorer',
+      'Need a little SOL for the network fee',
+      "This wallet doesn't offer the presale in your region.",
     ]);
   });
 
@@ -315,6 +324,26 @@ describe('strings', () => {
     expect(unarmed).toEqual(['Not a valid Solana address', 'Copy failed']);
   });
 
+  // B1d-2 Task 7: the whole of text.ts, read as source — every literal part of its copy (each string, and each part of a
+  // template between its placeholders) of at least 8 characters that is not one word (a space before or after it, or a
+  // colon and a space after, at most) contains a marker, or is text the build without presale carries too (a marker
+  // there would fail the off build): Q40b's tail (a library's error text there under NODE_ENV=test), Q46a (the start of
+  // B1b's #12 line), #20's "Network fee" and "Quote valid ", Q38's "Copy failed".
+  it('every literal part of the presale copy is armed by a marker, or is one word, or is copy both builds carry', () => {
+    const source = ts.createSourceFile('text.ts', readFileSync(join(ROOT, 'src/app/presale/text.ts'), 'utf8'), ts.ScriptTarget.Latest, true);
+    const parts = [];
+    const visit = n => {
+      if (ts.isImportDeclaration(n)) return;
+      if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !(ts.isPropertyAssignment(n.parent) && n.parent.name === n)) parts.push(n.text);
+      if (ts.isTemplateExpression(n)) parts.push(n.head.text, ...n.templateSpans.map(s => s.literal.text));
+      ts.forEachChild(n, visit);
+    };
+    visit(source);
+    expect(parts.length).toBeGreaterThan(150);
+    const unarmed = parts.filter(s => s.length >= 8 && !/^ ?[A-Za-z]+:? ?$/.test(s) && !MARKERS.some(m => s.includes(m)));
+    expect(unarmed).toEqual([' per transaction', 'Not a valid Solana address', 'Network fee', 'Quote valid ', 'Copy failed']);
+  });
+
   it('a marker in any off-build file is a violation; each marker must be found in the on build', () => {
     const markers = ['NOC presale', 'v1_presale_records'];
     const off = [file('app/background.js', 'var a=1;'), file('chrome/assets/x.js', '"Buy in the NOC presale"')];
```

- [ ] **Step 2: Red run** (Task 6's tree, `2c6c023`, with Step 1's files). In `extension/`: `npx tsc --noEmit; echo $?` — **0**. `npx vitest run src/app/presale/__tests__/ReferFriend.test.tsx src/unlock/__tests__/reauthPurchase.test.ts` — `Test Files  2 failed (2)` · `Tests  3 failed | 20 passed (23)`: "B1d-2 (Q47): a purchase that registers its referrer …" (the labels carry no `vlt-keep`), "24a populated …" (REFERRED without `app-ref-long`), "large figures whole …" (the same). `npx vitest run scripts/__tests__/check-no-presale.test.mjs` — `Tests  2 failed | 54 passed (56)`: the exact list (the eight markers missing) and "every literal part of the presale copy is armed …" (the eight strings unarmed). The visual tests on Task 6's builds: `npx playwright test e2e/visual-presale.spec.ts -g "Refer a friend|referral address"` — 2 failed (`REFERRED on one line` — "$1,234.56" two lines; `#10: "Referred by" on one line`).

- [ ] **Step 3: Implement** (`git apply --recount` against Task 6's tree).

`extension/src/app/presale/ReferFriend.tsx`:

```diff
diff --git a/extension/src/app/presale/ReferFriend.tsx b/extension/src/app/presale/ReferFriend.tsx
index b448051..747f3dd 100644
--- a/extension/src/app/presale/ReferFriend.tsx
+++ b/extension/src/app/presale/ReferFriend.tsx
@@ -9,7 +9,8 @@ import {PRESALE_TEXT, REFER_TEXT, countText, earnedText, referredText} from './t
 
 /**
  * One of the three stat cards (the design's `.stat`): label, value ("—" when its source failed), sub. A figure wider
- * than its third of the row breaks only after a group separator ("123,456,<wbr>789.0").
+ * than its third of the row breaks only after a group separator ("123,456,<wbr>789.0"); one of eight characters or more
+ * is set a size smaller ("$1,234.56" holds its third on one line).
  */
 function Stat({label, value, sub, tone}: {label: string; value: string | null; sub: string; tone: 'acc' | 'muted' | null}) {
   return (
@@ -18,7 +19,7 @@ function Stat({label, value, sub, tone}: {label: string; value: string | null; s
       {value === null ? (
         <SkelLine width={48} height={26} />
       ) : (
-        <span className={`val noc-balance-md noc-numeral${tone === 'acc' ? ' acc' : tone === 'muted' ? ' app-ref-muted' : ''}`}>
+        <span className={`val noc-balance-md noc-numeral${tone === 'acc' ? ' acc' : tone === 'muted' ? ' app-ref-muted' : ''}${value.length >= 8 ? ' app-ref-long' : ''}`}>
           {value.split(',').map((part, i, all) => (
             <Fragment key={i}>
               {part}
```

`extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 5cbe399..6bc84ec 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -2330,6 +2330,10 @@ body:has(.app-window) {
 .s-ref .stats .stat .val.app-ref-muted {
   color: var(--fg-tertiary);
 }
+/* A figure of eight characters or more ("$1,234.56") a size smaller: at 20 px it wrapped in its third (visual pass). */
+.s-ref .stats .stat .val.app-ref-long {
+  font-size: 16px;
+}
 /* 24a-bis's accent border (inline in the mockup) on a row that keeps its size: the idle row's border is transparent. */
 .s-ref .code-card .code-row {
   border: 1px solid transparent;
```

`extension/src/unlock/screens/reauth.ts` (the class is added with a literal, as the vault page's class gate requires — a computed `h('span', keep ? … : …)` failed `check-classes.mjs`: "computed class … the vault page names classes as literal strings only"):

```diff
diff --git a/extension/src/unlock/screens/reauth.ts b/extension/src/unlock/screens/reauth.ts
index 28b8cf6..2d3b5ef 100644
--- a/extension/src/unlock/screens/reauth.ts
+++ b/extension/src/unlock/screens/reauth.ts
@@ -133,9 +133,11 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
     shown(el, help !== '');
   };
   const failed = () => (view === 'notice' ? noticeHelp(COMMON.failedTryAgain) : helper(COMMON.failedTryAgain, false));
-  const row = (label: string, value: Node | string | null) => {
+  const row = (label: string, value: Node | string | null, keep = false) => {
     const r = h('div', 'intent-row');
-    r.append(h('span', 'label noc-body-sm', label));
+    const l = h('span', 'label noc-body-sm', label);
+    if (keep) l.classList.add('vlt-keep');
+    r.append(l);
     if (value !== null) {
       const v = h('span', 'value noc-body-sm noc-numeral');
       v.append(value);
@@ -206,7 +208,7 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
           const value = h('span');
           if (r.value !== null) value.append(r.value, ' · ');
           value.append(addressGroups(r.address));
-          return row(r.label, value);
+          return row(r.label, value, true);
         }),
       );
       byId('ra-reasons').replaceChildren(...d.reasons.map(r => h('p', 'noc-body-sm vlt-lede', r)));
```

`extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 0dc507a..1af998a 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -372,6 +372,10 @@
 .vlt-col .s-pin .intent-row .value .addr-groups {
   justify-content: flex-end;
 }
+/* A label beside an address in groups ("Referred by") on one line: the groups wrapped it (B1d-2 visual pass). */
+.vlt-col .s-pin .intent-row .label.vlt-keep {
+  flex: none;
+}
 
 /* #39: the done cards at the mockup's 0.55 opacity; the warning card's title in --warning (inline in the
    mockup), scoped by the design's own `.s8-step-card.warn` — (0,2,1) above its `.s8-step-card h3` colour. */
```

`extension/scripts/check-no-presale.mjs`:

```diff
diff --git a/extension/scripts/check-no-presale.mjs b/extension/scripts/check-no-presale.mjs
index b676213..a09ed70 100644
--- a/extension/scripts/check-no-presale.mjs
+++ b/extension/scripts/check-no-presale.mjs
@@ -177,6 +177,20 @@ export const MARKERS = [
   'Referral payouts are subject to program terms. Self-referrals are detected and rejected.',
   // B1d-2 Task 5: #27's Q34 (#26's badge is Q31, "Presale" — one bare word, already the record words').
   'Recorded on chain; presale service not yet updated',
+  // B1d-2 Task 7: B1d-1b's copy that carried no marker — #23's live eyebrow, "Next stage", the region link, 23b's
+  // "Estimated NOC", its Stage row and its explorer link, Q41b, and the region answer's reason (Q21's first sentence).
+  // Not markers: one word ("Minimum ", "Maximum ", "Currency: ", …), Q40b's tail " per transaction" (@solana/errors'
+  // "…the maximum allowed per transaction" is in the off build when it is built under NODE_ENV=test, as
+  // presaleBuilds.test.mjs builds it), and B1b's copy in both builds ("Available ", "Insufficient ", "Network fee",
+  // "Quote valid ", Q46a, Q38's "Copy failed").
+  ' of 10 · live',
+  'Next stage ',
+  'Not available in your region?',
+  'Estimated NOC',
+  ' of 10 · @ ',
+  'View on Solana explorer',
+  'Need a little SOL for the network fee',
+  "This wallet doesn't offer the presale in your region.",
 ];
 // Q42a (B1d-1a: the generic pending row, both builds); 1b adds F12's Q49–Q51. Q42b ("Transaction") is too short to
 // be a string search. The decoder's instruction names are read from its source (DECODER).
```

- [ ] **Step 3b: Spec rev 3.4, text only** (owner D28–D30; the brief's item 7). The status line names rev 3.4; a "Rev 3.4" change list under rev 3.3's carries every departure this plan makes, one line each — from the ledger and every task's Writer notes, D28–D30, the "Used by N people" ruling and this task's two findings; §2.4 is rewritten to D28–D30 and to what Task 1 built (the four states, the slots as offsets, drop-oldest-`done`, the reconcile and its accepted gap, the 403's `nextAt`, the key as must-stay); §1.4 (`presale.unrecorded`, `intent.referrer`, `checkReferrer`'s `referrer-invalid`), §3.5, §4.1, §4.4, §4.6, §5 (D29's row), §6.1, §6.2 (the key must-stay, the alarm a marker, item 4 — complete by construction), §6.3 (E2E 10 without a fake clock), §6.4 (B1d-2's shots) and §9 (#24 "Used 12 times") are edited to match. `node scripts/check-no-tge-date.mjs` (repository) — "no TGE date in 1324 tracked text files". Apply with `git apply --recount`:

```diff
diff --git a/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md b/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
index 3a90da8..3dd40eb 100644
--- a/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
+++ b/docs/superpowers/specs/2026-10-19-extension-b1d-presale-design.md
@@ -2,7 +2,8 @@
 
 **Status:** **approved rev 3**, 2026-10-19 (owner: "ok je") — Fable reviews 1–2 applied with owner decisions D7–D15; **rev 3.1**
 (D16): rev 3 plus plan B1d-1a's spec edits, listed below; **rev 3.2** (D23): rev 3.1 plus every departure plan B1d-1b
-makes, listed below; **rev 3.3** (D27): the copy calls rev 3.2 left open, decided. The owner approved
+makes, listed below; **rev 3.3** (D27): the copy calls rev 3.2 left open, decided; **rev 3.4** (D28–D30): rev 3.3
+plus every departure plan B1d-2 makes, listed below. The owner approved
 the design in conversation section by section (`.superpowers/sdd/b1d-approved-design.md`, approach A) and took
 decisions D1–D6, then D7–D14 on Fable's review 1 and D15 on review 2 (`.superpowers/sdd/b1d-owner-decisions.md`,
 `.superpowers/sdd/b1d-spec-review-1.md`, `.superpowers/sdd/b1d-spec-review-2.md`).
@@ -127,6 +128,89 @@ open, decided by the controller under the owner's delegation.**
   gave; drawing the routed (older) answer first could show "open" for a frame and then flip to closed. No departure.
 - §10 Q53, Q54a/b, Q56, Q57, Q58: confirmed as built (they mirror B1b's send strings). Q55 as above.
 
+**Rev 3.4 (2026-10-26, owner decisions D28–D30): rev 3.3 plus every departure plan B1d-2 makes, collected here — no
+per-item re-approval, as rev 3.2.** Each was built in the task of plan B1d-2 named (`docs/superpowers/plans/`)
+and is stated there; the passages marked "rev 3.4" below are edited to match. Every other passage is rev 3.3:
+- §2.4 (D28, Task 1): the POST carries the whole payload — `txHash`, `buyerAddress`, `stage` (an integer, 1-indexed),
+  `paymentToken`, `paymentAmount` (a decimal string), `nocAmount` and `usdValue` (numbers, converted at that edge only),
+  `referrerAddress` when there is one; the coordinator stores only what it derives from the chain.
+- §2.4 (D29, Task 1): a 400 is final — the entry is **`refused`**, a fourth state; never POSTed again; #27 keeps Q34.
+  Only the route's own refusal body (`{success: false, error: <string>}`) is final; any other 400 is retried.
+- §2.4 (D30, Task 1): `200 {success: true}` is `done` whatever `verified` / `duplicate` say.
+- §2.4 (Task 1): C24's slots are offsets from `confirmedAt` — 0, 1 min, 5 min, 30 min, 2 h, 12 h, 24 h, 48 h, 72 h; a
+  worker asleep across slots POSTs once when it wakes; a failed attempt with no slot left → `given-up`.
+- §2.4 (Task 1): over 50 entries the oldest `done` goes first, then `given-up`, `refused`, `due` (a Q34-bearing entry
+  last).
+- §2.4 (Task 1): a 403 or the cool-down sets `nextAt` to the latest of the claimed slot, the latch's persisted end and
+  `v1_forbidden_until`.
+- §2.4 (Task 1): the hook writes an entry only for an account of the wallet stored now.
+- §2.4 (Task 1, controller ruling): **reconcile** — at every start and on the `presale-record` alarm, each confirmed
+  `presale-buy` record of the stored wallet in `v1_pending` without an entry gets one (`confirmedAt` = its `createdAt`;
+  past 72 h written `given-up`, never POSTed). Accepted gap: a purchase pushed out of `v1_pending` by 20 newer records
+  before the worker wakes is not recorded.
+- §2.4 / §6.2 (Task 1): `v1_presale_records` and its lock are shared code; the key is a **must-stay** string of the off
+  build, not a marker (a wallet delete must wipe the records in either build); the records are wiped behind their lock.
+- §2.4 / §6.2 (Task 1): the alarm's name `presale-record` and `presale.unrecorded` are markers; the alarm is dispatched
+  by name and a shared alarm's name is refused at start; an empty store arms no alarm.
+- §2.4 (Task 1): `WalletDeps.postJson` (`createJsonPoster`, generic, both builds); core's
+  `PresalePurchaseRecord.paymentAmount` widens to `number | string` (web and the app keep passing numbers).
+- §1.4 / §3.5 (Task 2): `intent.referrer` is present only when entered (a purchase without one has B1d-1b's bytes and
+  digest exactly); "self" is every account of the unlocked session **and** of the stored wallet.
+- §3.5 (Task 2): `referrer-not-applicable` is `resolveReferrerWith`'s answer; `checkReferrer` reads the buyer's and the
+  referrer's allocation itself (one `getAccountsData`); a 403 there → `coordinator-refused`, other failures
+  `presale-unavailable`.
+- §3.3 (Task 2): `referrer@84` after is checked on **every** purchase (registered, on chain, or the default key).
+- §3.3 / §3.4 (Task 2): a registration signs only behind a proof (`challengeId` null → `prepared-invalid`); the
+  signature re-runs §3.5's lines on fresh reads (`referrer-self`, `referrer-no-allocation`); the C39 retry compares the
+  referrer allocation and whether it registers (`state-changed`).
+- §3.3 / §5 (Task 2): AlreadyHasReferrer (6016) in the simulation is `simulation-failed` (Q16); §5's row stays the
+  on-chain case.
+- §4.2 #10 (Task 2): "Referred by" after "To" for every purchase that credits a referrer (on chain too), Q47's note its
+  own row.
+- §2.5 (Tasks 2, 3): `referral: {onChain, canRegister}` lands in Task 3, with the popup's parser.
+- §3.5 (Task 3): `checkReferrer` answers `referrer-invalid` for any string that is not 32–44 base58 characters (the
+  popup never judges the text); the text is trimmed and spaces alone are empty.
+- §4.1 (Task 3): Buy also waits while a check is out; a failed check shows Q11 / Q12 as #23's notice, no line, Buy not
+  held; whenever the view says `canRegister: false` while the field holds text, the text is cleared and Q48 is #23's
+  notice (the warning banner above the stage card).
+- §4.1 (Task 3): the field is B1b's `.app-input` (the address book's), the value in the mono face at 13 px / 20 px, the
+  placeholder in the body face — no generic `.input` exists in the extension.
+- §4.2 #20 (Task 3): Q47's note sits inside "Referred by"'s value, under the address.
+- §4.2 (Task 3, stated loudly): #44's / #54's [Try again] do not restore the referral address — the field shows again
+  empty (the failed transaction registered nothing) and the user re-enters it.
+- §6.2 / §10 (Task 3): Q46a is not a marker — it is the start of B1b's #12 line, which both builds carry.
+- §3.5 (Task 4): `/referral-stats` is parsed strictly (`success === true`, both figures numbers); core's
+  `fetchReferralStats` (which reads a missing figure as 0) is not used; `WalletDeps.getJson` (generic, both builds).
+- §3.5 / §4.4 (Task 4): no allocation on chain = EARNED 0 ("0.0"); a 403 on `/referral-stats` → "—", no notice (the
+  latch trips); a failed reply → "—" for every figure, no link, Q11.
+- §4.4 (owner-delegated copy, D27; controller ruling): the code card says **"Used by N people"** / **"Used by 1
+  person"** / "Not used yet" — `totalReferrals` counts distinct buyers, not uses of the link (the design: "Used N times").
+- §4.4 (Task 4): one `useCopy` for Copy and "Share invite link"; "Copy failed" draws the close glyph; the copy icon's
+  name "Copy invite link" (the app's); #31's group "Rewards" (the app's).
+- §4.4 (Task 4): the link in 13 px / 20 px mono, broken anywhere; the stats in equal thirds with `<wbr>` after each
+  group separator; the code row's border transparent while idle; EARNED to one place, floored, `--accent` above 0 and
+  `--fg-tertiary` for 0 or "—"; REFERRED as "$1,234.56"; no top-bar spacer; skeletons while loading, Copy and Share
+  disabled until the link is there; one read per mount.
+- §4.4 (Task 7, visual pass): a figure of eight characters or more is set at 16 px ("$1,234.56" wrapped after its comma
+  in its third at 20 px).
+- §4.6 (Task 5): the badge is decided by the row's kind alone (`purchase`, the chain's) — a failed purchase is not a
+  `purchase` row and has no badge; a badged row wraps its badges under the title (a site's purchase carries two).
+- §4.6 (Task 5): Q34 is an info banner between #27's amount card and its detail card; #27 asks for the route's account,
+  once per open; any failure shows nothing (fail quiet); `StatusPill`'s badge is a `span`.
+- §4.2 #10 (Task 7, visual pass): a row naming an address keeps its label on one line ("Referred by" wrapped beside the
+  groups).
+- §6.2 (Task 6): the module list is complete by construction — a presale module the on build carries and `ON_BUILD`
+  does not name fails the gate.
+- §6.2 (Tasks 6, 7): every literal part of `text.ts`'s copy of ≥ 8 characters that is not one word carries a marker,
+  except text both builds carry (Q40b's tail " per transaction" — a library's error text in the off build under
+  `NODE_ENV=test` —, Q46a, "Network fee", "Quote valid ", "Copy failed"); B1d-1b's eight unarmed strings are armed
+  (105 markers).
+- §6.3 (Task 6): E2E 10 has no fake clock in the worker — a slot comes by moving the entry's schedule back and firing
+  the record's own alarm; D29 and D30 are proven in one wake with a due control entry; E2E 7 also refuses B1d-2's three
+  message types; the fake models `register_referrer` but not the referral bonus (E2E 11 seeds it); 6016 is modelled but
+  unreachable (the wallet refuses first).
+- §6.4 (Task 7): B1d-2's shots as listed in §6.4.
+
 **Ledger (review L12).** The order, so nobody has to guess it: the facts were re-read from the code on 2026-10-18 (§8.2)
 and rev 1 was written from them; the owner's decisions D1–D6 and D7–D14 carry the date the decisions file records,
 2026-10-19, which is also the date in this file's name; rev 2 was written after both sets of decisions, and every
@@ -384,11 +468,12 @@ existing `vault.challengeInfo`).
 | `presale.discardPrepared` | `{account}` | B1b's `discardPrepared` (all of the account's entries and their challenges) |
 | `presale.checkReferrer` (B1d-2) | `{account, referrer}` | `{ok: true}` or `{ok: false, line: 'referrer-invalid' \| 'referrer-self' \| 'referrer-no-allocation' \| 'referrer-not-applicable'}` (§3.5); a read failure → `presale-unavailable` |
 | `presale.referral` (B1d-2) | `{account}` | `ReferralView` (§3.5) |
-| `presale.unrecorded` (B1d-2) | `{account}` | the signatures of this account's confirmed purchases not yet accepted by the coordinator |
+| `presale.unrecorded` (B1d-2) | `{account}` | the signatures of this account's entries `due`, `given-up` or `refused` (§2.4, rev 3.4) |
 
 Every payload is parsed strictly (extra keys, a non-address `account`, an amount not `^[1-9]\d{0,19}$` or above u64,
 a currency not in `{SOL, USDC, USDT}`, a stage not an integer 0–9, a `referrer` neither null nor a string of 32–44
-base58 characters) → `malformed`. `account` must be in the unlocked session → else `locked` / `unknown-account`.
+base58 characters) → `malformed`; `intent.referrer` absent or null is no referrer, and the parsed intent then has no such
+key (rev 3.4). `presale.checkReferrer` answers `referrer-invalid` for any string that is not 32–44 base58 characters. `account` must be in the unlocked session → else `locked` / `unknown-account`.
 
 ---
 
@@ -554,28 +639,43 @@ and the effective referrer (or null). All strings (decimal strings for numbers);
 `current_stage` (rev 3.2 — the renderer adds 1, and the §2.4 recording sends stage + 1). Readable in both builds (§1.3).
 Shown by #23b, #11, #21, #26, #27, #44 and #54; never used to decide anything.
 
-### 2.4 The coordinator record (`record.ts`, B1d-2, C24)
+### 2.4 The coordinator record (`record.ts`, B1d-2, C24; rev 3.4 — D28–D30)
 
 `storage.local` `v1_presale_records`, background-owned (added to `BACKGROUND_OWNED_KEYS` and to `WALLET_DATA_KEYS`:
-wiped by a wallet delete, kept by a restore), at most 50 entries (the oldest given-up entry dropped first):
-`{signature, account, payload, confirmedAt, attempts, nextAt, state: 'due' | 'done' | 'given-up'}`.
-
-- Written when the poller sees a `presale-buy` record reach `confirmed` (the kind's `onConfirmed`, §1.3). `payload`:
-  `txHash` = the signature, `buyerAddress` = the account, `paymentToken`, **`paymentAmount` as a decimal string in
-  display units** (no float leaves the background for it; review L4 — core's `PresalePurchaseRecord.paymentAmount`
-  widens to `number | string`, so web and the app keep passing numbers unchanged (D12) and the route stores either
-  into `DECIMAL(30,18)`, `db/migrate.js:20`), `nocAmount` and `usdValue` (the simulation's `nocBase` / `spentCents`
-  converted to the coordinator's decimal numbers at this edge only — the route requires `typeof nocAmount ===
-  'number'`, `server.js:444`), `stage` (1-indexed), `referrerAddress` (the effective referrer or absent).
-- Sent through `createJsonPoster` (POST JSON to a bare path under `API_BASE`, through the shared latch,
-  `REQUEST_TIMEOUT_MS`); core's `recordPresalePurchase` is not used (it swallows every answer, so nothing could be
-  retried). `200` with `success: true` → `done`. Any other answer → the next slot of C24's schedule; a 403 trips the
-  latch and the entry waits for the cool-down (never retried inside it); past 72 h after `confirmedAt` → `given-up`. An
-  `alarms` alarm (`presale-record`, existing permission) wakes the worker at `min(nextAt)`.
+wiped by a wallet delete — behind the records' own lock — kept by a restore; the key is shared code and a must-stay
+string of the off build, §6.2), at most 50 entries:
+`{signature, account, payload, confirmedAt, attempts, nextAt, state: 'due' | 'done' | 'given-up' | 'refused'}`.
+Over 50, the oldest `done` entry is dropped first, then `given-up`, `refused`, `due` (an entry #27 says Q34 for goes last).
+
+- **Written** when the poller sees a `presale-buy` record reach `confirmed` (the kind's `onConfirmed`, §1.3), for an
+  account of the wallet stored now only. **Reconciled** at every start and on the alarm: a confirmed `presale-buy`
+  record of the stored wallet in `v1_pending` that has no entry gets one (`confirmedAt` = the record's `createdAt`;
+  past 72 h it is written `given-up` and never POSTed) — the worker may stop between the poller's write and the hook.
+  A purchase pushed out of `v1_pending` by 20 newer records before the worker wakes is not recorded (accepted).
+- **`payload` (D28)** — the whole route payload: `txHash` = the signature, `buyerAddress` = the account,
+  `paymentToken`, **`paymentAmount` as a decimal string in display units** (no float leaves the background for it;
+  review L4 — core's `PresalePurchaseRecord.paymentAmount` widens to `number | string`, so web and the app keep passing
+  numbers unchanged (D12) and the route stores either into `DECIMAL(30,18)`), `nocAmount` and `usdValue` (the
+  simulation's `nocBase` / `spentCents` converted to the coordinator's decimal numbers at this edge only — the route
+  requires `typeof nocAmount === 'number'`), `stage` (an integer, 1-indexed — the route reads
+  `Number.isInteger(body.stage)`), `referrerAddress` (the effective referrer, or absent). The coordinator stores only
+  what it derives from the chain and logs a > 1 % disagreement with ours.
+- **Sent** through `WalletDeps.postJson` (`createJsonPoster`: POST JSON to a bare path under `API_BASE`, through the
+  shared latch, `REQUEST_TIMEOUT_MS`; generic, both builds); core's `recordPresalePurchase` is not used (it swallows
+  every answer). **The answers:** `200` with `success: true` → `done`, whatever `verified` / `duplicate` say (D30 — a
+  `verified: false` row is completed by the coordinator's own sweep); a **400 whose body is the route's own refusal**
+  (`{success: false, error: <string>}`) → **`refused`**, final: never POSTed again, the purchase stands (D29); a 403
+  trips the latch and the entry waits for the cool-down (`nextAt` = the latest of the claimed slot, the latch's
+  persisted end and `v1_forbidden_until` — never retried inside it); anything else (429, 500, a timeout, a 400 without
+  the route's body) → the next slot.
+- **The schedule (C24):** slots at offsets from `confirmedAt` — 0, 1 min, 5 min, 30 min, 2 h, 12 h, 24 h, 48 h, 72 h. A
+  worker asleep across slots POSTs once when it wakes, then waits for the first slot after now; a failed attempt with no
+  slot left → `given-up`. One `alarms` alarm, `presale-record` (existing permission; dispatched by name, a shared
+  alarm's name refused), wakes the worker at `min(nextAt)` — never sooner than 30 s ahead; no due entry, no alarm.
 - Never more than one POST in flight; never two POSTs for one signature within a slot. **The retry is correct only
-  against a coordinator that makes every side effect idempotent by signature — P2a (§7), a B1d-2 blocker (D11).**
+  against a coordinator that makes every side effect idempotent by signature — P2a (§7), deployed (8f43f49).**
 - The purchase stands on chain whatever the record's state; nothing in the popup says it failed. #27 says Q34 while the
-  record is `due` or `given-up`.
+  entry is `due`, `given-up` or `refused` (`presale.unrecorded` lists those three).
 
 ### 2.5 What the popup receives (`PresaleView`)
 
@@ -726,8 +826,10 @@ its row (Q47).
 `buildReferralLink(account)` (`https://noc-tura.io?ref=<address>`, `core/referral/index.ts`); `earnedBase` = the
 allocation's `referral_bonus_tokens` from chain (the coordinator reports 0 for a chain-credited bonus — memory
 "referral and backend contract"); `referrals` and `referredCents` from `GET /referral-stats/<address>`
-(`fetchReferralStats`; aggregate only; USD converted to cents at this edge). A source that fails gives `null` for its own
-fields only, shown "—". No stat without a source (approved).
+(through `WalletDeps.getJson`, parsed strictly — `success === true` and both figures numbers; core's
+`fetchReferralStats`, which reads a missing figure as 0, is not used — rev 3.4; aggregate only; USD converted to cents at
+this edge). A source that fails gives `null` for its own fields only, shown "—"; no allocation on chain is EARNED 0. No
+stat without a source (approved).
 
 **The referral address (D8; an undrawn element, §9).** How a referrer enters a purchase, from the IDL and the program:
 the purchase instructions take **no** referrer argument. The referrer is the buyer's `user_allocation.referrer`, which
@@ -745,16 +847,23 @@ the first purchase, and `referrerAllocation` for the *effective* referrer; `buil
   always wins: the field is then absent and #20 shows the existing referrer (Q47, without the note).
 - **Validated by the background only** (C3): on blur the popup asks `presale.checkReferrer`, which answers, in this
   order: `referrer-invalid` (not 32 bytes of base58, or the default key — `captureIsValid`), `referrer-self` (the buyer
-  **or any account of this wallet's session**), `referrer-not-applicable` (the snapshot says an on-chain referrer exists
-  or this is not a first purchase), `referrer-no-allocation` (one `getAccountsData([["allocation", referrer]])`: absent,
-  or not a valid PresaleAllocation by §2.1 rule 6 with `user@8 = referrer`). The line (Q46 a–c, Q48) shows under the
-  field and Buy is disabled while it shows. An empty field is no referrer.
+  **or any account of this wallet's session or of the stored wallet**, rev 3.4), `referrer-not-applicable`
+  (`resolveReferrerWith` on the buyer's allocation: an on-chain referrer exists or this is not a first purchase),
+  `referrer-no-allocation` (one `getAccountsData` of the buyer's and the referrer's allocations: absent, or not a valid
+  PresaleAllocation by §2.1 rule 6 with `user@8 = referrer`); a 403 → `coordinator-refused`, any other read failure
+  `presale-unavailable` (Q12 / Q11 as #23's notice, no line, Buy not held). The line (Q46 a–c) shows under the field and
+  Buy is disabled while it shows **and while a check is out**; `referrer-not-applicable` clears the text and says Q48 as
+  #23's notice (the view re-read). The text is trimmed; an empty field (or spaces) is no referrer (rev 3.4).
 - **Re-checked at prepare and at signing**, never trusted from the popup: prepare repeats every check against its fresh
   snapshot and builds with `resolveReferrerWith(snapshotRef, account, intent.referrer)`; it refuses — never drops —
   a referrer that would not be registered (`referrer-not-applicable`, Q48), so the user's input is never silently
-  ignored; `beforeSign` (C22) refuses `state-changed` when the allocation's referrer or `purchase_count` moved since.
+  ignored; `beforeSign` (C22) refuses `state-changed` when the allocation's referrer or `purchase_count` moved since,
+  re-verifies the `register_referrer` instruction and account 3 from the signed bytes, and re-runs the lines above on
+  fresh reads; a registration signs only behind a proof (always a first purchase); `referrer@84` after the simulation
+  is checked on every purchase (rev 3.4).
 - **#20 and #10** show "Referred by" with the whole address in groups of four and Q47's note when this purchase
-  registers it (permanent).
+  registers it (permanent) — on #20 under the address inside the value, on #10 its own row; #10 shows "Referred by" for
+  an on-chain referrer too (rev 3.4).
 - **The record** carries the effective referrer as `referrerAddress` (§2.4).
 
 ### 3.6 Website purchases through #48 — F12, the presale region block (D9, D15, C31; B1d-1b)
@@ -838,8 +947,10 @@ B1d-2). #21 is the existing `status` route. Every CTA follows rule 6 (`LockedBut
     "≈"; for a stablecoin "@ $ 0.1501" alone, Q03); the estimate **"15,873.60 NOC"** (`.noc-balance-md` +
     `.noc-numeral`, from `Quote.nocBase`, formatted by B1b's amount formatter to 2 decimals, floored).
   - **Referral address** (B1d-2, D8, undrawn — §9): shown only while `referral.canRegister`; B1b's single-line input
-    style (`.input`, the value in `.noc-mono`), label and placeholder Q45, the line under it (Q46, Q48) in the error
-    style; `autocapitalize`, `autocorrect` and `spellcheck` off; paste allowed; no QR.
+    style (`.app-input`, the address book's — the extension has no generic `.input`; the value in the mono face at
+    13 px / 20 px so 44 characters fit, the placeholder in the body face — rev 3.4), label and placeholder Q45, the
+    line under it (Q46 a–c) in the error style, Q48 as #23's notice; `autocapitalize`, `autocorrect` and `spellcheck`
+    off; paste allowed; no QR. #44's / #54's [Try again] do not restore the address (rev 3.4).
   - **Your allocation** row (approved; no drawn state), in the receipt-row style (`.noc-body-sm`, `.noc-numeral` on
     the value): label Q04, value "<total> NOC", sub **"Claimable after TGE"** (D5). Shown only when
     `allocation.exists` and `totalBase > 0`.
@@ -925,14 +1036,19 @@ Route `referral` from the #31 row **"Refer a friend"** (C16); on mount `presale.
 (`.noc-h3`); three stat cards (`.noc-overline` label, `.noc-balance-md` + `.noc-numeral` value, `.noc-caption` sub):
 **REFERRALS** / Q35 (`referrals`), **EARNED** / **"NOC lifetime"** (`earnedBase`, from chain), **REFERRED** / Q36
 (`referredCents`) — the app's three (the design's ACTIVE "staking now" has no source, §9); "—" for a null. Code card:
-eyebrow Q37 (the app's "YOUR INVITE LINK"), **"Used N times"** / **"Not used yet"** (N = `referrals`; the line hidden
-when null), the full link in `.noc-mono` (never truncated, as the app), **Copy** (`useCopy`; "Copied" / Q38; no
+eyebrow Q37 (the app's "YOUR INVITE LINK"), **"Used by N people"** / **"Used by 1 person"** / **"Not used yet"** (N =
+`referrals`, which counts people — D27, rev 3.4; the line hidden when null), the full link in `.noc-mono` at 13 px /
+20 px, broken anywhere (never truncated, as the app), **Copy** (`useCopy`; "Copied" / Q38; no
 auto-clear and no countdown toast — the extension has no `clipboardWrite`, B1 §4), **"Share invite link"** (C15: copies
 the link). **24a-bis kept as drawn, minus the toast (review L8):** while `useCopy` says `copied` (its 2 s), the Copy
 icon is the checkmark and the code row carries the `--accent` border; "Copy failed" shows no checkmark. Info banner
 Q39 (D13). Legalese **"Referral payouts are subject to program terms. Self-referrals are detected and rejected."** (as
 drawn and as the app; "program terms" unlinked until the terms page exists, B1e). Empty (24b): zeros as returned; the
-"Recent rewards" empty state is omitted with the list (§9).
+"Recent rewards" empty state is omitted with the list (§9). **As built (rev 3.4):** the stats in equal thirds, a figure
+breakable only after a group separator and set at 16 px from eight characters on; EARNED to one place, floored,
+`--accent` above 0 and `--fg-tertiary` for 0 or "—"; REFERRED "$1,234.56"; Copy and "Share invite link" share one
+`useCopy` and are disabled until the link is there; a failed reply shows "—", no link and Q11; the #31 row sits in the
+app's "Rewards" group; one read per mount.
 
 ### 4.5 #11 banner, Buy and the pending row
 
@@ -948,9 +1064,13 @@ drawn and as the app; "program terms" unlinked until the terms page exists, B1e)
 ### 4.6 #26 and #27 (B1d-2)
 
 - **#26**: a `purchase` history row (B1b's "Presale purchase" / "NOC") gains the **"Presale"** badge (Q31) — on every
-  purchase row, the website's included (the row kind is the chain's, not ours); the badge is on the on build only, the
-  row itself is B1b's and stays in the off build. An open purchase's pending row on #26 reads Q33.
-- **#27**: the `purchase` variant (B1b) gains Q34 while `presale.unrecorded` lists its signature.
+  purchase row, the website's included (the row kind is the chain's, not ours; a failed purchase is not a `purchase` row
+  and has none); the badge is on the on build only, the row itself is B1b's and stays in the off build. A badged row
+  wraps its badges under the title (a site's purchase carries two — rev 3.4). An open purchase's pending row on #26
+  reads Q33.
+- **#27**: the `purchase` variant (B1b) gains Q34 while `presale.unrecorded` lists its signature — an info banner between
+  the amount card and the detail card, asked once per open for the route's account; a failed read shows nothing
+  (rev 3.4).
 
 ---
 
@@ -986,6 +1106,7 @@ translates; nothing internal is shown.
 | Pyth older than 120 s at simulation | prepare | the simulation fails → Q16 |
 | the coordinator is unreachable | — | presale closed (§3.1); F12 on #48; the wallet keeps working; a recorded purchase keeps retrying (§2.4) |
 | the record POST keeps failing | B1d-2 | the purchase stands; Q34 on #27; given up after 72 h |
+| the record POST is refused by the route (its own 400, D29) | B1d-2 | `refused`, never POSTed again; the purchase stands; Q34 on #27 (rev 3.4) |
 | an update turns the switch off with a purchase pending | off build | C19: the record is read, counted by `inFlightFor`, polled and shown generically (Q42); nothing is lost, nothing re-signed |
 | geo `no_check` or a stale list while a purchase is pending | view | 23b stays, the closed line beneath (C30) |
 | a sanctioned country behind a VPN | geo | closed (`sanctionedWinsOverVpn`); `isVpn` is never read as evidence |
@@ -1078,7 +1199,8 @@ does), and a positive control wherever a negative is asserted. The plan that bui
   non-dependent failed simulation is still `simulation-failed`. **The same tests run in `vitest.nopresale`** with the same
   answers (D15: the off build blocks exactly when the on build does; mutation: stub the gate in the off build → red).
 - **Recording (2):** written on `confirmed` only; the payload's fields, `paymentAmount` a string; the schedule's slots
-  on a fake clock; a 403 waits for the cool-down; given up at 72 h; one POST in flight; delete wipes, restore keeps.
+  on a fake clock; a 403 waits for the cool-down; given up at 72 h; one POST in flight; delete wipes, restore keeps; a
+  route's 400 → `refused` and any 200 with `success: true` → `done` (D29, D30); the reconcile (rev 3.4).
 - **Referral address (2, §3.5, C32):** each `checkReferrer` code with its boundary (a 31-byte key, the default key, the
   buyer, another session account, an absent referrer allocation, a foreign `user@8`, an on-chain referrer present,
   `purchase_count` 1); a valid one → `register_referrer` built between the compute-budget instructions and the purchase,
@@ -1123,7 +1245,7 @@ does), and a positive control wherever a negative is asserted. The plan that bui
      is untracked — review 2 L5) and naming that commit in its first key, fails the gate naming exactly
      `core/presale/buyInstructions.ts`, and passes with that one entry removed.
   2. **Strings:** no file under the off build's `app/`, `chrome/`, `firefox/` contains a **marker** — every `presale.*`
-     message type, the route names `presale-confirm` and `referral`, `presale-buy`, `v1_presale_records`, and the
+     message type, the route names `presale-confirm` and `referral`, `presale-buy`, the alarm name `presale-record`, and the
      strings "NOC presale", "YOU RECEIVE (EST.)", "Claimable after TGE", "Refer a friend", "Not available here",
      "Order pending", and every §10 string whose source is "new", "approved" or "app" and whose build is "on" — each
      literal part of at least 8 characters between placeholders. The list is explicit in the gate file and staged like
@@ -1131,8 +1253,13 @@ does), and a positive control wherever a negative is asserted. The plan that bui
      control:** each marker is found in the on build. A marker that also lives in a shared module shows up in the off
      build and fails the scan itself — the author renames it; no separate self-test of sources is needed (review 2 L5).
   3. **Must stay:** the B1b/B1c presale strings ("Presale purchase", "PRESALE PURCHASE", the decoder's instruction
-     names), Q42 and F12's Q49–Q51 are **found** in the off build (a control that the switch did not strip what both
-     builds need).
+     names), Q42, F12's Q49–Q51 and `v1_presale_records` (a delete wipes the records in either build — rev 3.4) are
+     **found** in the off build (a control that the switch did not strip what both builds need).
+  4. **Complete by construction (rev 3.4):** a presale module the on build carries that `ON_BUILD` does not name fails;
+     and a source row reads `text.ts` whole: every literal part of ≥ 8 characters that is not one word contains a
+     marker, except text both builds carry (Q40b's " per transaction" — @solana/errors' text is in the off build under
+     `NODE_ENV=test` —, Q46a, "Network fee", "Quote valid ", "Copy failed"). One word with a space or a colon
+     ("Minimum ", "Maximum ", "Currency: ") is not a marker — "Minimum " and "Maximum " are library text there too.
 - **No-TGE-date gates:** `extension/scripts/check-no-tge-date.mjs` (src + dist) and the repo's
   `scripts/check-no-tge-date.mjs` (every tracked file) cover the new sources and both builds.
 - **RPC methods gate:** no new method (`getAccountsData` → `getMultipleAccounts`, `getTokenAccountsByOwner`,
@@ -1174,8 +1301,10 @@ review 2 L10). B1d-1b: the rest of 1–9.
 
 B1d-2:
 
-10. **Recording:** the POST fails twice (500, then timeout) and succeeds on the third slot (fake clock); #27's Q34
-    disappears.
+10. **Recording:** the POST fails twice (500, then timeout) and succeeds on the third slot; #27's Q34 disappears. No fake
+    clock in the worker (rev 3.4): a slot comes by moving the entry's schedule back and firing the record's own alarm.
+    D29 (the route's 400 → `refused`, Q34 kept) and D30 (`200 {verified: false, duplicate: true}` → `done`) in one wake
+    with a due control entry.
 11. **Referral:** #31 → #24 with stats; `/referral-stats` failing → "—" for its two stats, EARNED still shown;
     Copy → the clipboard holds the link, the checkmark shows.
 12. **Referral address:** a first purchase with a valid referrer → #20 "Referred by" with Q47's note → the transaction
@@ -1188,7 +1317,12 @@ B1d-2:
 beneath), the allocation row, each #23 closed answer (Q12 as §5's prepare refusal — rev 3.2), #20 purchase (with and without account setup), #21 with the badge,
 #44 and #54 for a purchase, #50b × 6, #11 with the banner and Buy, #48 with F12 (B1d-1b); #24 (populated, empty, a null
 stat, copied), the referral field with a line, #20 with "Referred by", #26 badge, #27 line (B1d-2); the opus-tier review
-against `index.html` as in B1b and B1c, every departure checked against §9.
+against `index.html` as in B1b and B1c, every departure checked against §9. **B1d-2 as built (rev 3.4):** `31-refer-row`;
+`24-referral`, `24-referral-copied`, `24-referral-null-stat`, `24-referral-empty`; `23a-referrer-empty` (+`-end`),
+`23a-referrer-invalid` (+`-end`, Q46a), `23a-referrer-self` (Q46b), `23a-referrer-no-allocation` (Q46c),
+`23a-referrer-valid`, `23a-referrer-not-applicable` (Q48); `20-referred-by` (+`-end`, Q47), `20-referred-onchain`
+(+`-end`); `10-referred-by`, `10-referred-onchain` (the vault page, 412 × 916); `26-presale-badges` (a site's purchase,
+two badges); `27-unrecorded` (+`-end`, Q34).
 
 ### 6.5 Release gates (B1e)
 
@@ -1356,6 +1490,7 @@ and `RegisterReferrer`, `calculate_tokens_for_usd`, `SPACE`s, stablecoin constra
 | #23 "Your allocation" (no drawn state) | built in the receipt-row style (approved), Q04 |
 | #23 (F)/(G) Android and iOS notes (decimal-pad IME, predictive back, haptics, Liquid Glass) | `inputmode="decimal"`; the rest mobile-only |
 | #24 code "NOCT-7F3C-2D1A" (HMAC-derived) | **the address is the code** (C1); the link is shown whole, as the app |
+| #24 "Used 12 times" | **"Used by N people"** (D27, rev 3.4): the count is of people who bought through the link, not of uses |
 | #24 "ACTIVE · staking now" | **omitted:** no source (staking not in B1); the app's REFERRED (Q36) in its place |
 | #24 "Earn 5 % of every referral's stake rewards · paid in NOC · auto-credited each epoch." | **omitted:** does not exist; Q39 without numbers (D13) |
 | #24 "Recent rewards", "View all", reward rows and their long-press menu, 24b's rewards empty state | **omitted:** the coordinator has aggregates only; no per-referral source |
```

- [ ] **Step 4: Green, both builds, the gates.** In `extension/`: `npx tsc --noEmit; echo $?` — **0**. `npx vitest run` — `Test Files  222 passed (222)` · `Tests  4673 passed (4673)` (Task 6: 4672 + the text.ts row). `npx vitest run -c vitest.nopresale.config.ts` — `Test Files  18 passed (18)` · `Tests  435 passed | 25 skipped (460)` (unchanged). `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale` — both build. `npm run gates` — exit 0: … no TGE date (659 files each build), classes (`app-ref-long` by `app.css`, `vlt-keep` by `unlock.css`), and "no presale ok (dist-nopresale off, dist on): … the on build carries 26 required modules and no presale module outside ON_BUILD; 105 markers (none in the off build, each in the on build); 9 strings and the decoder's instruction names stay in the off build" — the **positive control** (each of the eight new markers found in the on build) and the **negative** (none in the off build) are this line. `node scripts/extract-design-css.mjs --check` — "design-ext.css is the extraction output" (unchanged).

  **A ninth candidate was dropped by the gate's own build row:** with `' per transaction'` (Q40b's tail) armed, `npm run gates` on `dist/` passed, but `scripts/__tests__/presaleBuilds.test.mjs` (which builds both under vitest, `NODE_ENV=test`) failed: `off build: app/background.js contains the presale marker " per transaction"` — @solana/errors keeps its messages in a test-mode build ("Accounts data allocations exceeded the maximum allowed per transaction"). "Minimum " and "Maximum " (Q40a/b's heads) are in that build too — one-word markers would collide exactly so. Q40b is source "core" (§6.2 requires markers of new / approved / app copy only), so it stays unarmed and is named in the text.ts row (V7 below re-arms it: red).

- [ ] **Step 5: The review — every shot beside the design's phone of the same screen.** The design's phones were rendered from `index.html` (`#screen-24 .phone-wrap .phone` 0–2, `#screen-23` 0–3, `#s20` 0–3, `#s10` 0–1, `#s26` 0–3, `#s27` 0–3, `#s31` 0–2) and set side by side with each shot (`montage`, scratchpad only). Every shot was opened and compared: layout, type scale, colour, spacing, every string against §10 / the design / a flagged Q, the sticky bar, every departure against §9 and rev 3.4's list.

  **Found and fixed (each red before, green after — Step 2's rows, Step 9's mutations):**

  | id | screen | before (Task 6's tree) | after | why it is a defect |
  |---|---|---|---|---|
  | F1 | #24, the REFERRED stat | "$1, / 234.56" — at 20 px "$1,234.56" (≈ 100 px) did not fit its third's 92 px, so it broke at Task 4's `<wbr>` after the comma | "$1,234.56" on one line: a figure of eight characters or more at 16 px (`app-ref-long`); larger figures still break only after a separator | the design draws each figure on one line; a four-digit dollar sum is ordinary, not the "large figure" Task 4's `<wbr>` was for. Cents kept (the app's `formatUsdString` and Task 4's ruling) rather than flooring to dollars |
  | F2 | #10, a purchase naming a referrer | "Referred / by" — the label shrank beside the address's groups (`.intent-row` is a flex row; "To" is one word and could not wrap) | "Referred by" on one line: an address row's label `vlt-keep` (`flex: none`); the note row (label only) still wraps | a two-word label split over two lines beside one value is not the design's #10 (its labels are one line); B1d-2 added the only two-word address row |

  Before/after images: `scratchpad/b1d2-t7/shots1/`, `shots2/` (before), `shots3/`, `shots-final/` (after); sheets `scratchpad/b1d2-t7/cmp/{24a,24b,23a-1,23a-2,20,10,26-27,31,fixes}.png`.

  **Departures kept** (each checked; rev 3.4 line, §9 row or ruling):
  - #24: no ACTIVE card (REFERRED in its place), no "Recent rewards" / "View all" / the rewards empty state, no toast in 24a-bis (§9); the link whole in 13 px mono over three lines where the design shows a 14-character code at 17 px (C1, rev 3.4); "YOUR INVITE LINK" (Q37) for "YOUR CODE"; "Used by 12 people" (D27); Q39 without numbers and without the design's bold run (D13); "program terms" unlinked (§4.4); the share button says "Copied" while copied (one useCopy, rev 3.4); EARNED "0.0" tertiary in 24b as drawn.
  - #31: the "Rewards" group between Connections and Advanced (C16, the app's group name); the design's #31 has no referral row.
  - #23a's field (undrawn, §9): the address-book input, mono 13 px, the placeholder in the body face; the error border and the line in the error style; Q48 as the warning banner above the stage card, as #23's other notices (Q15, Q43).
  - #20: "Referred by" in the detail grid after "To", Q47's note under the address inside the value (rev 3.4); no headline (D21).
  - #10: the purchase's rows as B1d-1b's plus "Referred by" and Q47's own row; the on-chain variant has no account-setup row (its PDAs exist — correct, not a defect).
  - #26: the "Presale" badge (Q31) is not drawn; a badged row wraps its badges under the title (rev 3.4). B1b's own departures stand (no search / more menu, the filter set, the date header).
  - #27: Q34 an info banner between the amount card and the detail card (rev 3.4); B1b's #27 for a purchase shows no fiat line and no From/To/Block rows (B1b, not B1d-2).
  - Not shot: #24's failed reply (Q11, no link) and #24 locked — Task 4's component rows cover both; a `refused` entry's #27 is the same banner as `given-up` (E2E 10 asserts it).

- [ ] **Step 6: The whole Playwright suite, normally and under `unshare -rn`** — sequential, `rm -rf test-results` before each phase, the visual specs last; detached with per-phase logs and a marker (`scratchpad/b1d2-t7/suite.sh`):

```bash
cd extension
NONVIS=$(ls e2e/*.spec.ts | grep -v '/visual'); VIS=$(ls e2e/visual*.spec.ts)
rm -rf test-results && npx playwright test $NONVIS --reporter=line                                         # 70 passed (16.7 m)
rm -rf test-results && npx playwright test $VIS --reporter=line                                            # 35 passed (10.5 m)
rm -rf test-results && unshare -rn sh -c "ip link set lo up && npx playwright test $NONVIS --reporter=line" # 70 passed (16.3 m)
rm -rf test-results && unshare -rn sh -c "ip link set lo up && npx playwright test $VIS --reporter=line"    # 35 passed (10.5 m)
```

  **105 passed** each way (Task 6's 101 + this task's 4), no retry, no flake. Under `unshare -rn` the spec lists must be one line (`tr '\n' ' '`): the first unshare attempt passed `$(ls …)`'s newlines into `sh -c` and every spec name ran as a command (exit 126, nothing tested) — re-run as above; not a product finding. The final shots: `scratchpad/b1d2-t7/shots-final/` (the normal visual phase).

- [ ] **Step 7: The whole verification.** `cd extension && npm run verify` — exit 0: both builds (`tsc` 0); `Test Files  222 passed (222)` · `Tests  4673 passed (4673)` and `Test Files  18 passed (18)` · `Tests  435 passed | 25 skipped (460)`; "CSP ok: dist/app needs no unsafe-inline or unsafe-eval" (and `dist-nopresale/app`); secrets (exit 0, all six bundle dirs); gates ("… 105 markers (none in the off build, each in the on build) …"); reproducible — `presale chrome 26 files sha256:fbfad1d9…`, `presale firefox 26 files sha256:717bbbb4…`, `no-presale chrome 26 files sha256:5fc9fa69…`, `no-presale firefox 26 files sha256:49133b0c…`, identical on rebuild. From the repository root: `node scripts/check-no-tge-date.mjs` — "no TGE date in 1324 tracked text files". (`core/`, the root `src/` and `web/` are untouched: no root `tsc` / `jest`, no web `verify`.)

- [ ] **Step 8: Commit.**

```bash
git add docs/superpowers/specs extension/e2e extension/scripts extension/src
git commit -m "feat(extension): B1d-2 Task 7 — visual pass: visual-presale.spec.ts shoots every B1d-2 state through the real extension (#31's row, #24 populated / copied / a null stat / empty, the referral address with Q46a–c and Q48, #20 and #10 with Referred by, #26's badge, #27's Q34); fixed from the review: #24's REFERRED on one line, #10's Referred by label on one line; B1d-1b's unarmed presale copy armed (105 markers) and the whole of text.ts held to the marker rule; spec rev 3.4 (D28–D30 in §2.4, every departure of the plan listed)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 9: The named mutations — each alone in a fresh `git archive HEAD` copy (node_modules linked), both builds built in the copy for an E2E one, `timeout 300` (unit) / `900` (E2E); `tsc`'s own exit code first, then the named test.** Runner `scratchpad/b1d2-t7/runmut.py` with `muts.json` (the exact replacements below). `VP` = `e2e/visual-presale.spec.ts`.

| id | the change | named test | observed |
|---|---|---|---|
| V1 | `ReferFriend.tsx`: `value.length >= 8 ? ' app-ref-long'` → `value.length >= 10 ? ' app-ref-long'` | `src/app/presale/__tests__/ReferFriend.test.tsx` | tsc 0; `Tests  1 failed \| 15 passed (16)` — 24a: REFERRED without `app-ref-long` (F1) |
| V2 | `app.css`: `.val.app-ref-long {\n  font-size: 16px;` → `font-size: 20px;` | `VP -g "Refer a friend"` | tsc 0; 1 failed — "REFERRED on one line" (F1 seen in the real popup: the visual check is a check) |
| V3 | `reauth.ts`: `return row(r.label, value, true);` → `return row(r.label, value);` | `src/unlock/__tests__/reauthPurchase.test.ts` | tsc 0; `Tests  1 failed \| 6 passed (7)` — the address rows' labels without `vlt-keep` (F2) |
| V4 | `unlock.css`: `.label.vlt-keep {\n  flex: none;` → `flex: 0 1 auto;` | `VP -g "referral address"` | tsc 0; 1 failed — "#10: \"Referred by\" on one line" (F2 on the vault page) |
| V5 | `check-no-presale.mjs`: `'Need a little SOL for the network fee',` removed from `MARKERS` | `scripts/__tests__/check-no-presale.test.mjs` | tsc 0; `Tests  2 failed \| 54 passed (56)` — the exact list, and the text.ts row lists Q41b unarmed |
| V6 | `check-no-presale.mjs`: `'Quote valid ',` added to `MARKERS` (a B1b string both builds carry) | `scripts/__tests__/presaleBuilds.test.mjs` | tsc 0; `Tests  1 failed \| 11 passed (12)` — "off build: app/assets/mount-….js contains the presale marker \"Quote valid \"" (why the shared copy stays unarmed) |
| V7 | `check-no-presale.mjs`: `' per transaction',` added to `MARKERS` | `scripts/__tests__/presaleBuilds.test.mjs` | tsc 0; `Tests  1 failed \| 11 passed (12)` — "off build: app/background.js contains the presale marker \" per transaction\"" (@solana/errors under NODE_ENV=test) |
| V8 | `text.ts`: Q41b reworded without its marker — `'Need a little SOL for the network fee'` → `'Need some SOL for the network fee'` | `scripts/__tests__/check-no-presale.test.mjs` | tsc 0; `Tests  1 failed \| 55 passed (56)` — the text.ts row: `"Need some SOL for the network fee"` unarmed (a new string cannot ship without its marker) |
| V9 | `app.css`: `.pri.app-tx-badged {\n  flex-wrap: wrap;` → `flex-wrap: nowrap;` | `VP -g 'Presale" badge'` | tsc 0; 1 failed — the site's row `.pri` overflows (`scrollWidth <= clientWidth` false) |
| V10 | `record.ts` (`unrecordedFor`): `e.state !== 'done'` → `e.state === 'due'` | `VP -g 'Presale" badge'` | tsc 0; 1 failed — #27 without Q34 for the `given-up` entry (the shot's state is the product's, not a seeded banner) |

**10 of 10** red, each compiling (tsc 0). (The runner was started twice by mistake and the two sweeps ran side by side: every mutation red in both, same counts.) Every mutation copy removed by exact path.

#### Notes for the executor (Task 7)

- **Ruling: B1d-2's shots go into B1d-1b's `visual-presale.spec.ts`** (four tests), not a sibling spec — B1d-1b's Task 9 named this file as where B1d-2 adds its rows, and `frame` / `wholeBar` are file-local there — cost if wrong: a file split later.
- **Ruling: F1 is fixed by size, not by content** — a stat figure of ≥ 8 characters is set at 16 px; REFERRED keeps its cents (Task 4's accepted ruling and the app's `formatUsdString` "$1,234.50"). Flooring to whole dollars (as #23a's "raised") was the alternative; rejected because it reverses an accepted ruling and the app's copy — cost if wrong: one class and one CSS rule.
- **Ruling: F2 applies to the address rows of #10's `other` kind only** (`row(…, keep)`: "To" and "Referred by"); a label-only row (Q47's note) and B1c's dApp rows (labels of arbitrary length) keep wrapping. The class is added by `classList.add('vlt-keep')` because the vault page's class gate takes literal class names only — cost if wrong: none seen (the send's #10 "To" is one word).
- **Ruling: the marker rule is now enforced over the whole of `text.ts`** (a source row parsing it with TypeScript's own parser), not only B1d-2's copy — Task 6's ruling armed the B1d-1b strings; without the row a later string could ship unarmed again. **8 armed** (MARKERS 97 → 105): `' of 10 · live'`, `'Next stage '`, `'Not available in your region?'`, `'Estimated NOC'`, `' of 10 · @ '`, `'View on Solana explorer'`, `'Need a little SOL for the network fee'`, `"This wallet doesn't offer the presale in your region."`. **Not armed, with the reason:** one word with a space or colon (`'Minimum '`, `'Maximum '`, `'Currency: '`, `'Available '`, `'Insufficient '`, `' balance'` — §6.2's no-bare-word rule; "Minimum "/"Maximum " are also library text in a test-mode off build); shared with B1b in both builds (`'Not a valid Solana address'` Q46a, `'Network fee'`, `'Quote valid '`, `'Copy failed'` — V6 shows arming one fails the off build); `' per transaction'` (Q40b's tail — @solana/errors' "…maximum allowed per transaction" is in the off build under `NODE_ENV=test`, V7; Q40b is "core" copy, which §6.2 does not require). Positive control: `npm run gates`' "each in the on build"; negative: "none in the off build" and V6/V7.
- **Found (gate harness, not product):** `npm run gates` scans the production builds, `presaleBuilds.test.mjs` a `NODE_ENV=test` build — they can disagree (a library string present only in the latter). The test-mode build is the stricter of the two and caught the bad marker; recorded in §6.2 item 4.
- **Deviation (stated): Q48 is shot as checkReferrer's answer** (REFERRER registered on the fake chain between typing and the blur), not as prepare's — both end in the same notice and cleared field (Task 3); the blur path is the one a user meets first.
- **Deviation (stated): `24-referral-*` take one scene** — the null stat and 24b are reached by changing the fake's `/referral-stats` and deleting the allocation, then reopening #24 (one read per mount); `referralStatsReads` is asserted to be exactly three reads.
- **Spec rev 3.4 (Step 3b):** text only; the change list has one line per departure from the ledger, every task's Notes for the executor (Tasks 1–6), D28–D30, the "Used by N people" ruling and F1/F2. §2.4 is rewritten whole (the four states, slots as offsets, drop-oldest-`done`, the reconcile with its accepted 20-record gap, the 403's `nextAt`, must-stay key, P2a deployed). The change list names the plan file only as `docs/superpowers/plans/` (its final name is the controller's). Not listed as departures (internal, no spec passage): Task 4's `ReferralView` → `ReferralState` rename, Task 6's helper moves.
- **Pre-existing, seen again (not this task's):** `npx eslint` reports errors in untouched files (`PresaleConfirm.tsx` exhaustive-deps, unused vars in `records.test.tsx`, `challenge.test.ts`, `passkeyFlow.test.ts`) — eslint is not in the extension's `verify`; none is on a line this task changed.
- **For the plan's execution:** run the visual spec after any change to #24, #10, #26 or #27 (F1/F2's checks live only there and in V1/V3's unit rows); run Playwright under `unshare -rn` with the spec list on one line (the `tr '\n' ' '` in Step 6), else `sh -c` runs nothing and exits 126.
- **Dry run:** clone `dry/b1d2`, commit `ac27c49` on Task 6's `2c6c023` (one commit, not amended). Red runs on a `git archive 2c6c023` copy with Step 1's four files (unit: `Tests  5 failed | 74 passed (79)` together; visual: 2 failed). On `ac27c49`: `npm run verify` exit 0; Playwright 105 ×2; 10 mutations red. The blocks above are `git diff 2c6c023 ac27c49` per file; replayed with `git apply --recount` onto `git archive 2c6c023` (10 of 10 applied), the tree is identical to `git archive ac27c49` (`diff -rq`). Design renders, shots, comparison sheets, logs and runners under `scratchpad/b1d2-t7/` only; the red copy and every mutation copy removed by exact path.

---

## Self-review

- **Spec coverage — the header table's B1d-2 row, item by item:** #24 and its #31 row → Task 4 (`presale.referral`, `ReferFriend.tsx`, `PresaleSlots.settings`), shot in Task 7; the optional referral address on #23 (D8, §3.5) → Task 2 (`presale.checkReferrer`, `intent.referrer`, `register_referrer` + account 3 built, simulated and re-verified from the bytes, a registration behind a proof, #10's "Referred by") and Task 3 (the field, Q45–Q48, `presale.view`'s `referral`, #20's "Referred by"); `POST /solana/purchase` after confirmation with background retry (`v1_presale_records`, §2.4, D28–D30; P2a deployed) → Task 1; the "Presale" badge on #26 and the unrecorded line on #27 → Task 5; E2E 10–12 → Task 6; the remaining visual pass → Task 7 (Steps 1–9) and spec rev 3.4 → Task 7 Step 3b. **§6.3 E2E 10–12:** 10 → Task 6 `presaleRecord.spec.ts` "10 · recording: … 500, then … the timeout, then accepted …" and "10 · D29 and D30: …" (one wake with a due control entry); 11 → Task 6 `presaleReferral.spec.ts` "11 · referral: #31 → #24 …" (stats, `/referral-stats` failing → "—", EARNED from chain, Copy → the clipboard spy and the checkmark); 12 → the same file's "12 · referral address: …" (the buyer's own address → Q46b, Buy disabled; a valid referrer → #20 "Referred by" with Q47 → #10 → `register_referrer` and account 3 on the posted wire, the record carrying the referrer) and "12 · an account with a referrer on chain …" (no field; #20 / #10 name it without Q47; nothing registered). E2E 1's deferred #26 badge assertion (§6.3, B1d-1b's record) → Task 5.
- **Placeholder scan:** no `TODO`, `TBD`, `FIXME`, "fill in", "similar to Task N" or elided code in any step; every new file is in full and every changed file a diff as committed in the dry run. The one deliberate template is the commit trailer `Co-Authored-By: <the executing model> <noreply@anthropic.com>` in each task's commit step, which the executor fills with its own model (the Global Constraints' "commit trailers name the executing model truthfully").
- **Type consistency across the tasks' Interfaces:** Task 1's `WalletDeps.postJson` / `PostAnswer`, `PresaleRecordEntry` (`{signature, account, payload, confirmedAt, attempts, nextAt, state}`), `PresaleRecordState` and `presale.unrecorded → string[]` are what Tasks 4 (`getJson` beside `postJson`, the one latch), 5 (Q34 from `presale.unrecorded`, `refused` included) and 6 (`recordEntries`, `heldRecord`, `slotComes` over the stored entry) consume; Task 2's `presale.checkReferrer` answer (`{ok: true, data: {ok: true} | {ok: false, line: ReferrerLine}}`, `presale-unavailable` / `coordinator-refused`) and `PurchaseView.referrer` (`{address, registers}`) are Task 3's inputs; Task 3's interim `ReferralView {onChain, canRegister}` (the view's `referral`) is renamed `ReferralState` by Task 4, whose `ReferralView {link, earnedBase, referrals, referredCents}` is §3.5's — no task after Task 4 names the old meaning; `PresaleSlots` gains `settings` (Task 4) and `historyBadge` / `unrecorded` (Task 5) without changing B1d-1b's slots; Task 6's `AllocationReferral` (bonus @76, referrer @84) matches `PRESALE_ALLOCATION_LAYOUT` as Task 2's `allocationFacts` reads it. Mechanically: the consistency replay below compiles nothing itself, but every tree it reproduces is a dry-run commit on which `tsc` exited 0.
- **Consistency replay (2026-10-26):** `git archive a1bda47`, then task-1 … task-7's new files and diff blocks taken from THIS file, in order, each block alone with `git apply --recount` (Task 2's fixture by its capture step, Task 4's `design-ext.css` by the extractor), compared with `diff -rq` against `git archive` of each rebuilt commit — IDENTICAL for every task: Task 1 (65846e2; 4 new files, 30 diff blocks), Task 2 (1256554; 3 + 12, the capture's sha256 `dbc8fa65…64be` as pinned), Task 3 (49cc8f0; 1 + 12), Task 4 (f8db19e; 5 + 26, the extractor's `ab642e2a…fb3d` as pinned), Task 5 (3a04191; 1 + 13), Task 6 (5b42436; 2 + 7), Task 7 (5c3bf42; 0 + 10). Negative control: the final tree against the first issue's ac27c49 reports exactly `reconcileWindow.test.ts`.
- **Review Focus:** five lines; one has its rows (Task 1, `reconcileWindow.test.ts`, N8–N9 red), four are known limitations with their reasons.
