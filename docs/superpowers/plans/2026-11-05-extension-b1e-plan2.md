# Noctura Extension B1e · Plan 2 — the first Chrome Web Store release (one version source 1.0.0 and the dev-only `key`, the STORE zip, the privacy policy with ICO's retention answer and the live check, the Terms draft / Help / listing / data-usage form, the five store screenshots, the extension's own copy made true to the policy with a UI-claims guard, `npm run release:chrome` with the RP-ID record, the owner's checklist and spec rev 2.7) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 2 (2026-11-06):** Fable review 1 (`.superpowers/sdd/b1e2-plan-review-1.md`: C1, I1–I5, M1–M11, Q1–Q6) and the owner's answers E23–E26 applied, dry-run again — the chain rebuilt on `dry/b1e2-r2`: **cd179af, 7fff2cc (unchanged), 496c770, b120c48, 55383f4, ac181aa, 9f42f00**. C1 (a `NODE_ENV` in the owner's shell gave a development build every step agreed on — reproduced: unset / `production` `99fa0f02…`, `development` / `test` `b2e3dafe…`) → the release refuses any `NODE_ENV`, strips it from every child, and `build.mjs` refuses a non-production value (Task 7); I1 → the zip is read back with the independent reader and must equal the witnessed files one for one, a package with `build-manifest.json` is refused (Task 7); I2 / E25 → an ICO gate in the checklist (no DNS record and no certificate for `wallet.noc-tura.io` or any name under it); I3 → one claims list `scripts/claims.mjs` for the UI guard, the store texts and the policy, widened, with tiered allowances (Task 6); I4 → the live check refuses a Terms page that still carries the DRAFT note (Task 4); I5 / M6 → `npm ci --ignore-scripts` everywhere, the lockfile's sha256 and the zip's entry count in the notes; M1 → `.partial` files moved into place, a part-way failure names what it left; M2 → `--dev-key` refuses any directory under `dist*/`; M3 / E26 → the live check runs before `verify` and again before packing (six GETs); M4, M5 (P5 names the recipient lookup at review, Task 3), M7, M9, M11; M8 → the note at the top of Global Constraints; M10 / E23 → "at stage price" becomes "estimate · not in total" (Home) and " (estimate)" (#43, #40), the screenshot check refuses `stage`; E24 → #8's banner drops "future private (shielded)" (the phone app's welcome copy is fixed separately, `fix/shield-privacy-copy` aaeeee1). **Named mutations: 233, every one compiling and red** (Task 1 23 — and 1 INVALID, not counted —, Task 2 19, Task 3 41, Task 4 21, Task 5 12, Task 6 59, Task 7 58). At 9f42f00: vitest **248 files, 5530 passed, 1 skipped**; no-presale **22 files, 550 passed, 25 skipped**; tsc 0; both builds, csp, secrets, gates, reproducible; the repo-wide TGE check clean. Playwright, the **whole suite at 9f42f00: `123 passed (30.6m)` normally and `123 passed (30.7m)` under `unshare -rn`**; Task 6's 8 specs 29 / 29 both ways; `npm run screenshots` both ways. No real `release:chrome` run in revision 2 (revision 1's single run stands; the orchestration is proven by tests). Replaying task-1 … task-7 from this file onto `git archive 0fcf769` reproduces each `dry/b1e2-r2` commit's tree byte for byte at every prefix. Fable review 2 below; next: the owner.

**Fable review 2 (2026-11-06, `.superpowers/sdd/b1e2-plan-review-2.md`): 0 Critical, 0 Important, 6 Minor** — every finding of review 1 verified fixed in the code (C1 reproduced: `NODE_ENV=development` refused before anything is built; unset and `production` byte-identical). The controller's rulings, **binding on the executor** (each a row the executor adds in the task named, with its test, a planted control and a named mutation, and a one-line rev 2.7 entry):
- **R2-M1 → Task 6:** `scripts/claims.mjs` also refuses subject-less sending claims — "never sends", "never transmits", "never uploads" / "is never uploaded", "never shared" (the phrase, the keys, the data …) — except the exact true sentences already allowed (P11's "never leave this device" stays the one allowed form); planted controls "The wallet never sends your phrase anywhere", "is never uploaded" → refused.
- **R2-M2 → Task 7:** the preflight's "this version not packed yet" check also refuses any `release/out/*.partial` (and a `release/notes-<version>.md.partial`) left by an interrupted run, naming it — before `verify`, not at `write`.
- **R2-M3 → Task 6:** #40's NOC line beside "Total value recovered" (a total that excludes NOC) says " (estimate · not in total)", as Home does; #43 (no total) keeps " (estimate)" (controller copy, D27).
- **R2-M4:** no change now — the `hidden` / `offline` patterns may refuse future true copy; the allowance path is the remedy (a note for B1e-3).
- **R2-M5 → the checklist (Task 7):** E25's gate asks ICO first whether an existing certificate covers `*.noc-tura.io` (a wildcard would cover `wallet.noc-tura.io`); the answer may cost ICO a certificate change — the owner decides (owner question).
- **R2-M6:** the web wallet's " at stage price" stays (outside B1e; presale is on there) — owner question.

**Revision 1 (2026-11-05):** first issue, dry-run in full — every task implemented for real on scratch clones of main 0fcf769, chained one commit per task on `dry/b1e2`: **cd179af, 7fff2cc, f9e1aae, cd93831, cfb092c, 2739ffd, fe13550** (Tasks 1–3 and 5 were written in parallel on separate clones — they touch disjoint files — and cherry-picked onto the chain; the chain re-ran green after each pick). Each task red on its predecessor for the reason it states and green on its own tree: `tsc` 0 (its own exit code), both vitest runs under `TZ=UTC`, both builds, `npm run gates`, `npm run reproducible` where a build output changes. **Named mutations: 148, every one red** (Task 1 23 — and 1 INVALID, not counted —, Task 2 19, Task 3 38, Task 4 15, Task 5 12, Task 6 15, Task 7 26). At fe13550: vitest **247 files, 5489 passed, 1 skipped** (the one skipped row is Task 1's build with the store's recorded key, which runs once §7 step 7 records it); no-presale **22 files, 550 passed, 25 skipped**. Playwright, the **whole suite at fe13550, normally and under `unshare -rn sh -c 'ip link set lo up && npx playwright test'`**: **`123 passed (29.1m)` normally and `123 passed (27.0m)` under `unshare -rn`** (run on 59a396f, whose tree is fe13550's but for `release/checklist.md`); `npm run screenshots` normally and under `unshare -rn` (Task 5, again at Task 6). **The one sanctioned contact with noc-tura.io:** Task 7 ran the real `npm run release:chrome` once — preflight, `verify` 0, the third witness equal (`28 files, sha256:a74d2025…8cae`), the RP ID ok, then `refused at liveCheck — nothing was written`: privacy, terms and help each answered 404 (unpublished; three GETs, no retry), exit 1, no zip, no notes. Replaying task-1 … task-7's blocks from this file onto `git archive 0fcf769` reproduces each chain commit's tree byte for byte at every prefix (Self-review). Next: a Fable 5.1 review (owner rule), then the owner.

**Goal:** Build B1e spec plan 2 (§0's second row, "B1e-2 — release") for the first Chrome Web Store release, presale off: the release build and its checks (§5: one version source, the stable ID and the dev-only `key`, the STORE zip, the RP-ID freeze), the store material and the texts ICO publishes on noc-tura.io (§6: the privacy policy re-derived from the code and from ICO's retention answer, Terms, Help, the listing, the data-usage form, the screenshots, the live check), the owner's submission checklist (§7) — and, found by this plan's dry run, the extension's own copy that the policy contradicts (#1, #39, the store summary) with a guard that keeps it true.

**Architecture:** Everything the store and the user are told is a file in `extension/release/`, each claim traceable to the code or to ICO's statement, and read by a test: the privacy sentences are one exported list (`release/privacySentences.mjs`) that the offline test, `privacy.md` and the live check all read; the facts in them (the host, the counts, the intervals) are pinned to the code's constants; the listing's permission reasons are `manifest/source.mjs`'s own strings; the UI-claims guard reads what a user sees in both builds. The release is a pure orchestrator over injected steps (`runRelease(steps)`): a clean-tree preflight, `verify`, a third build that must match `verify`'s store package, the RP-ID record, the live check (no skip flag), the STORE zip written twice with one sha256, then the zip and the notes — every refusal stops before anything is written. The zip is hand-written and uncompressed so its sha256 is reproducible on any Node.

**Tech Stack:** Node ≥ 22.12 (`zlib.crc32`), TypeScript 5 strict, Vite 8, Vitest 5 + happy-dom 21, Playwright 1.63 (contained). No new dependency.

**Spec:** `docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md` **rev 2.7** (rev 2.6 + every departure of this plan, one line each under "Rev 2.7", the passages they name edited to match — written by Task 7 and committed with this plan; no owner decision changed). Owner decisions: `.superpowers/sdd/b1e-owner-decisions.md` (E1–E22) and the spec's §0. ICO's §6.2 answer: `.superpowers/sdd/b1e-ico-retention-2026-11-01.md` (recorded in the repo by Task 3 as `extension/release/ico-retention.md`). Brief and ledger of this plan's dry run: `.superpowers/sdd/b1e2-plan-brief.md`, `.superpowers/sdd/b1e2-plan-ledger.md`. Template and Global Constraints: `docs/superpowers/plans/2026-11-02-extension-b1e-plan1.md`. Design (binding, contains the TGE date — never copy it; compare on rendered images only): `/home/user/Downloads/index.html` — **Task 6 departs from it on #1 and #39's copy (loudly, below)**; the screenshot backdrop is undrawn (§9).

## Global Constraints

Every task's requirements include these. **(Review 1 M8:) the B1c / B1d rows below bind only a task that touches that code — no B1e-2 task touches the dApp, rent, presale or contacts code; read them as context.** B1e-1's, verbatim (B1d-2's, then B1e-1's own; their task numbers are those plans'), then B1e-2's own.

Every task's requirements include these. B1d-2's, verbatim (its task numbers are B1d-2's and its plans'), then B1e-1's own.

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

- **Mutations:** `git archive HEAD | tar -x -C "$(mktemp -d <scratch>/mut.XXXXXX)"`, `node_modules` linked FROM the copy (`ln -s <repo>/extension/node_modules <copy>/extension/node_modules`, the same for `web/` and the root), every run under `timeout 300`. Linked is right for unit mutations and for the E2E ones (they need only the build); anything that runs `npm run gates` or reads the build's module maps needs `extension/node_modules` COPIED (`cp -a`) (B1d-2 rev 2, review 1 M6 — kept, now with its reason: with the link, `npm run gates`' `check-page-bundles.mjs` fails, because the content script's modules resolve outside the copy — `provider.js carries "../../../b1d2-dry/extension/node_modules/@wallet-standard/wallet/lib/esm/register.js" — a content script may carry only src/provider/ and @wallet-standard/wallet, @wallet-standard/base`, seen at Tasks 4–6 of the rev 2 dry run; `check-no-presale.mjs` alone, which the review ran, passes either way). **A mutation is judged by `tsc`'s own exit code first** (`npx tsc --noEmit; echo $?` — never piped through `tail`, which reports `tail`'s): a mutant that does not compile is INVALID, not red. Never `git worktree`, never the repository's own files or its `node_modules`, never `pkill` with a pattern — kill by task id or exact PID only.
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
- **No escaped-character drift:** test strings with invisible or confusable characters are written as `\u` escapes, generated by a script from their code points, never typed. **Rev 2 correction:** rev 1 said none were needed and that a `grep -P` over the added lines was empty — both false: Tasks 4 and 5 typed 53 such characters raw into five test files (the check below counts 53 on rev 1's chain end d68cce1 — its negative control — and 0 on rev 2's) (RLO, ZWSP, ZWJ, soft hyphen, BOM, NBSP, U+3000, U+2028/9, CGJ, VS16, a tag character, a private-use and an unassigned code point, combining acute, Cyrillic letters), and the `grep` class missed most of them; rev 2 rewrote every one as an escape (Tasks 4 and 5's diffs). The check, over the lines the plan adds (`node`, any directory): `git diff 9562c5c -- extension core | node -e "const s=require('fs').readFileSync(0,'utf8');const R=/[\p{C}\p{M}\p{Z}\p{Default_Ignorable_Code_Point}\u2800\uff00-\uffef\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}\p{Script=Hebrew}\p{Script=Arabic}]/u;let n=0;for(const l of s.split('\n'))if(l.startsWith('+')&&!l.startsWith('+++'))for(const c of l)if(c!=='\t'&&c!==' '&&!(c>' '&&c<'\x7f')&&R.test(c))n++;console.log(n)"` → `0` (rev 2.1, review N5: the class includes the full/half-width forms U+FF00–U+FFEF; a `+` line holding U+FF21 counts 1) (two visible accented Latin letters stay raw in `storedDigest.test.ts` and `licences.test.mjs`, where they test UTF-8 widths, not look-alikes; `challenge.test.ts` and `walletApi.test.ts` hold three such characters from B1b, untouched).


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

And, for B1d-2 (owner decisions of 2026-10-25 and 2026-10-26, the containment rule and review 1's I2 ruling — each holds in **both builds at every task**; Task 1 builds the record to them, and no later task may weaken one):

- **D28 — the record POST sends the whole §2.4 payload:** `txHash`, `buyerAddress`, `stage` (1-indexed, an integer — the route reads `Number.isInteger(body.stage)`), and our `paymentToken`, `paymentAmount` (a decimal string), `nocAmount`, `usdValue` (numbers, converted at this edge only), `referrerAddress` (or absent). The coordinator stores only what it derives from the chain; it logs a > 1 % disagreement with ours.
- **D29 — a 400 is final:** no retry; the entry's state becomes **`refused`** (a fourth state beside `due`, `done`, `given-up`); #27 still shows Q34 for it; the purchase stands. (As built, Task 1: only the route's own refusal body `{success: false, error: <string>}` is final — any other 400 is retried.)
- **D30 — `200 {success: true}` is `done`** whatever `verified` / `duplicate` say (a `verified: false` row is completed by the coordinator's own sweep).
- **D31 — an unattended record-route 403 trips the wallet-wide 10-min cool-down**, like every 403 (a 403 is always a whole-IP CrowdSec ban). The premise is ICO's to keep, stated in spec §2.4 and §7 P3 (rev 3.5): the coordinator never answers 403 on `POST /api/v1/solana/purchase` selectively (a refusal is a 400 `{success: false, error}` or a 429). As built, Task 1: `createJsonPoster` goes through the one shared latch (M34, M35; `deps.test.ts` "postJson goes through the same latch: a 403 on the record route silences the RPC …").
- **Review 1 I2 (controller's ruling) — the record never holds a transaction's reads, and goes only for the stored wallet:** the latch serialises every coordinator request and a record POST holds it until its answer or `REQUEST_TIMEOUT_MS` (measured, Task 1), so the worker POSTs nothing while a transaction of the stored wallet is open (`pending` / `stuck`: its sends, its purchases, a site's), and only an entry of an account of the wallet stored now — another account's is held, never dropped (Task 1, W1–W6).
- **Tests never contact `*.noc-tura.io` or `solscan.io`** — the record route and `/referral-stats` are the fake coordinator's in E2E (counters asserted empty, `contained(h)`), `fakeDeps`' `postJson` / `getJson` throw `unexpected …` unless a test gives one, and nothing committed reaches a real host. (The dry run's unsigned mainnet simulation in Task 2's notes was a scratch file through the public Solana RPC, never committed, and made no `*.noc-tura.io` request.)

And, for B1e-1 (owner decisions E1–E22 where they bind the code, the spec's rulings R1–R10, and the rulings of this plan's ledger — each holds in **both builds at every task**; no later task may weaken one):

- **E1, E2 — the release is Chrome's, and its build is `--no-presale`** (`dist-nopresale/chrome`). Both builds are still built, tested and gate-checked at every task (B1d-1a's rule); an E2E that must run in both does (`phrase.spec.ts`, `links.spec.ts`, `presaleSwitch.spec.ts`); the visual pass runs on the store build. Firefox (AMO) is a later step (§8).
- **E3 — of B1's deferred hardening only the anti-phishing phrase ships.** No drainer list, no DNR rule.
- **E9 — only an *unreadable* vault is removable without a password.** "Unreadable" is `unreadableV1` (§2.1 U1–U3) exactly, frozen: `src/shared/unreadable.ts` imports only `@scure/base` (a source test), never `envelopeRules`, a KDF bound or the account policy; a vault *refused by this version* (a later `v`, a stricter KDF or policy) is never removable and says "update the extension". **Both readings ask the opener first** (`envelopeShape` in the background, `storedVault` on the page): a value either accepts is a wallet whatever the predicate says (ledger, Task 1). The §2.6 controls are read from the committed fixture FILES, never re-encoded, and both fixtures are pinned by sha256 (controller ruling: a swappable fixture is not a control).
- **C2 / §2.4 — the removal is bound to the stored text.** `expectedDigest` = sha256(utf8(`JSON.stringify` of what `storage.local` returns)); the background re-reads and re-judges at step 2 and again at step 5, locks first, refuses while a session is back (`unlocked`) or a send is open (`send-open`, E12), removes `v1_vault` under `sessionMutex`, then wipes `WALLET_DATA_KEYS` and the caches; every step inside `serial`. `vault.forgetDamaged` is in `PRIVILEGED` and `VAULT_PAGE_ONLY` and its sender is `damagedFlow.ts` alone (a source test); it is never a flag on `vault.forgetWallet`. Tests compute digests with `node:crypto`, never with `storedDigest`.
- **E10, R4 (= E18) — "Save the damaged data" on both damaged states:** an `<a download>` of a `data:application/json` URL of exactly the hashed bytes, named by the digest's first 8 hex; never an object URL, never `text/html` (the vault-isolation gate).
- **R3 — `vault.setKeys` binds through `envelopeShape`:** keys over an unreadable or refused envelope are `malformed`, no session; `unknown-account` as before when no vault is stored. Any test that sends `vault.setKeys` stores a whole envelope.
- **E6, E11, D31 — #37 without holding, and the removal the same:** typed DELETE + (the 1 s hold, OR a native checkbox and one activation); the checkbox exists only while DELETE matches and sits directly **above** the button — before it in the DOM, on screen and in tab order (controller ruling → rev 2.2); the button's accessible name follows the box; Space toggles it, Enter on it does nothing (native); the proof in #37's vault tab stays required and its code (`screens/delete.ts`) untouched.
- **R1 (= E18), R2 — the phrase:** set when none is set needs an unlocked session and no proof; a change or a removal is a `phrase` challenge applied only by `vault.reauthOk` (the last confirmed proof wins); `vault.challengeInfo` describes it as `{kind: 'phrase', action}` — the value never reaches #10. The key `v1_phishing_phrase` is in `WALLET_DATA_KEYS` (a delete, a damaged-vault removal and a first write remove it; #39's restore keeps it) and `BACKGROUND_OWNED_KEYS` (no page may name it); the value leaves the background only on `wallet.state`, `vault.status` and `dapp.pending`; the built `relay.js` / `provider.js` name no extension storage (`contentStorageViolations`, Task 4 — Task 6 does not add it again).
- **§1.5 — the rules:** NFC, then trimmed, 3–32 UTF-16 code units, no `FORBIDDEN_IN_NAME` character and no Cs / Co / Cn (ledger: "printable" → rev 2.2); **E21 (rev 2):** no Default_Ignorable code point, no U+2800, no U+FFFC / U+FFFD, at most `PHRASE_MAX_MARKS` = 3 combining marks in a row (counted after NFD — rev 2.1), and at least one L / N / S / P character; cross-script look-alike letters are accepted (pinned); `null` or empty = none; a refusal never echoes the value. A stored value that is not exactly a clean phrase reads as none.
- **§1.2, R9 — the line:** plain text only (a React text child; `textContent` on the vault page — never HTML); nothing when none is set; a read that fails or a field that is missing or malformed is R9's visible line, never silence and never the whole view refused; #9 reads it before the password field shows; every approval-window state draws it through `WindowTop`'s required `phrase` prop.
- **§1.3 — onboarding writes the phrase only after `commitWallet`** (the first write wipes `WALLET_DATA_KEYS`): create after #6, import once stored, never on `created-locked`; [Skip] writes nothing.
- **E4 — the links open noc-tura.io in a new tab and are never fetched:** `https://noc-tura.io/extension/{terms,privacy,help}` from `src/shared/links.ts`, `<a target="_blank" rel="noopener noreferrer">`; `connect-src` unchanged; `licenses.html` is a page of the package. No test contacts those pages (the E2E clicks are routed and aborted).
- **R7, E15, E16 — `licenses.html`:** generated by `scripts/build.mjs` from the modules with rendered code (`renderedLength > 0`) of the three module maps; every package by its nearest named `package.json`, its licence from its files or the committed standard text, its SPDX id from `license` or `release/licence-ids.json`, and on the owner's allowlist (MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, OFL-1.1, Unlicense) — anything else fails the build; `rpc-websockets` resolves to the two-export stub, is in no map and the stub renders 0 bytes (the licence gate); the Geist faces pinned to geist@1.7.2 and its `fonts/LICENSE.txt` shipped; licence lines wrapped at 100 columns by the generator (ledger ruling; a 412 px window still scrolls — accepted, rev 2.2).
- **R8 — the link gate:** every URL string in `chrome/` and `firefox/` is exactly one of the link table's, in a file its row allows, and the four links the user is given are present; `licenses.html` alone is skipped, by name, at the package root, and the static-page rule (no `<a`, `href=`, script, style, link, iframe, form, `on…=`; a tag and attribute allowlist) holds there.
- **E17 — the passkey RP ID:** a test pins `https://${RP_ID}/*` ∈ `HOST_PERMISSIONS`; the `rp-id.json` record and its pre-upload gate are B1e-2's.
- **Copy (D27, owner-delegated):** only the spec's, the design's, #37's (`DELETE_TEXT`) and B1b's strings; the new strings of Tasks 2, 5 and 6 are the controller's, listed in their notes and flagged to the owner at the finish.
- **E19, E20, E22 (rev 2):** the refused state's heading is "Update Noctura to open this wallet", its old sentence the first body line; onboarding's phrase step stays count-less with the overline "Optional"; #37's taller bar with the checkbox and #35's plain-tone "Off" stay as built.
- **Undrawn (§9):** built from the design system's components only (B1b's banner, input and row styles, #47's ack row, #37's danger card); `design-ext.css` untouched; each shown in Task 7's visual pass.
- **Ledger rulings that bind every task:** the vitest totals are stated under `TZ=UTC` until Task 7 makes `Send.test.tsx`' "last 12 days ago" row time-zone proof (a test-only fix: a fixed provider clock); a test changes in the task whose code changes its answer (`presaleSwitch.spec.ts` in Task 4, the B1d-1b rev 2 lesson); **the whole Playwright suite runs at least at Tasks 4, 6 and 7**, normally and under `unshare -rn`, detached with a marker and waited for with a bounded poll; the 458dfcd vault (readable, its seed failing AES-GCM) is §2.1's out-of-predicate case, deferred with it (§8) — no code.

And, for B1e-2 (the spec's rev 2.7, the owner's decisions where they bind this plan, and the rulings of this plan's ledger — each holds in **both builds at every task**; no later task may weaken one):

- **E1, E2 — the release is Chrome's, and it packs `dist-nopresale/chrome`** — the `verify` build itself, after a third build matches its digest (R10). Firefox (AMO) is a later step (§8): its manifest never carries a `key` and its texts are not written here.
- **R5 — one version source:** `extension/package.json` `version` (`1.0.0`); `manifest/source.mjs` reads it; the gate compares every built manifest with it. #38 shows `runtime.getManifest().version`.
- **§5.3 — the `key` is dev-only:** only `build.mjs --dev-key <outDir>` adds it, from `release/store-key.json` (exactly `{id, key}`, `id` Chrome's derivation of `key`), never into `dist/` or `dist-nopresale/`; `verify`, the E2E builds and the release never pass it; the gate fails a key in either of those.
- **R6 — the zip is STORE, hand-written, no dependency:** exactly §5.4 rev 2.7; two runs give one sha256; tests read it with an independent reader that imports nothing.
- **§6 — every published sentence is true of the code at its commit or is ICO's statement verbatim in meaning;** a sentence that stops being true is a finding, never a quiet edit: the spec's rev line and the controller's ruling first. The facts the sentences state (the one host, `FRESH_ROWS`, `MAX_PROBE`, `SIM_REFRESH_MS`, `SIM_RETRY_MS`, `GEO_LIST_CACHE_MS`, the RP ID, the tokens, the contact) are pinned to the code by `privacy.test.mjs`.
- **§6.5 — the live check is part of `release:chrome` only:** never in `verify`, CI, a test, or under `unshare -rn`; it runs twice per attempt (E26: a pre-check before `verify`, the final check before packing), each time three GETs, one at a time, `redirect: 'manual'`, a 15 s timeout each, 200 only, and the Terms page must not carry the DRAFT note; **no skip flag**. Tests run its comparison and its runner on fixtures with an injected fetch. **No test contacts `*.noc-tura.io` or solscan.io.**
- **C1 — the release packs a production build only:** `release:chrome` refuses any `NODE_ENV` in its environment and strips it from every command it runs; `build.mjs` refuses a `NODE_ENV` other than unset or `production`; a test that spawns `build.mjs` removes vitest's `NODE_ENV=test`. The zip's entries equal the witnessed files one for one (I1).
- **E17 — the RP ID:** `release/rp-id.json` is exactly `{"rpId": "wallet.noc-tura.io", "confirmedBy": "owner", "decision": "E17"}` (committed from the owner's written E17 — the controller's ruling; §7 step 3 asks for re-confirmation before upload); the release refuses unless it equals both `RP_ID` and E17's host.
- **Copy (D27, owner-delegated):** the texts of Tasks 3, 4 and 6 are the controller's and the writers', listed in each task's notes and flagged to the owner at the finish; the Terms are a DRAFT for a lawyer (E4). No TGE date anywhere; no presale in the listing or the Terms; nothing claims a privacy property the transparent extension does not keep (memory "shielded privacy guarantee") — "private" only in "private key(s)".
- **Undrawn (§9):** the screenshot backdrop uses the design system's own CSS, no colour of its own.
- **Ledger rulings that bind every task:** release texts that are `.mjs` under `release/` are read by the vault-isolation and RPC-methods gates (`listSourceFiles`) — no `v1_…` key and no global-fetch pattern in them, even in a string; the store screenshots spec lives in `e2e/` and is ignored by `playwright.config.ts` (it runs only through `npm run screenshots`); the whole Playwright suite runs at Task 7, normally and under `unshare -rn`, detached with a marker and waited for with a bounded poll.

## Review Focus

The five input classes or failure modes most likely to bite that no task's tests exercise — each with the row added to its owning task, or written as a known limitation with the reason:

1. **The published page changes after the release.** The live check proves the three pages carry every sentence on the day `release:chrome` runs; nothing re-checks them afterwards, and ICO edits the site. **Known limitation, no test added:** tests never contact noc-tura.io (Global Constraints). The owner's checklist (Task 7) says the check is re-run before every upload; a daily watch in `noc-ops`'s `coordinator-watch` (which already runs daily) is the natural place for a recurring check — offered to the owner, not built here.
2. **A later code change makes a published sentence untrue.** A new route, a changed constant, a new recipient. **Tested:** Task 3, `privacy.test.mjs` "the facts in the sentences are the code's" pins the host, the counts and the intervals to the code's own constants (a changed `FRESH_ROWS` or `SIM_RETRY_MS` turns it red — Task 3's mutations); a new host fails `connect-src` and the link gate (B1e-1); a new route fails `check-rpc-methods.mjs`. **Limit:** a behaviour change that keeps every constant (e.g. sending a new field on an existing route) is review's — the release checklist asks for the sentences to be re-read against the diff since the last release.
3. **The owner's real working tree at release time.** Untracked scratch files, a symlinked `node_modules`, an uncommitted notes file from an earlier attempt: the preflight refuses a dirty tree and a second pack of one version. **Tested:** Task 7, `release-chrome.test.mjs` (the dirty-tree and already-packed rows, and their mutations); the refusal names what is dirty. In the real repo `web/node_modules` and `extension/node_modules` are directories git ignores (checked at this plan's writing) — the clone's symlink was the only dirty entry, and it is not the owner's case.
4. **How the store unpacks the zip.** External attributes are 0 on the MS-DOS host, so an unpacker applies its own umask; the Chrome Web Store's unpacking cannot be observed here. **Known limitation:** `unzip -t`, `python3 -m zipfile -t` and an extracted-tree `diff -r` pass (Task 2); §7 step 5 (an unpacked load of the zip's contents in a clean profile, then the first Unlisted install) is where it is seen.
5. **The release on another Node.** CI and the owner may run Node 22.12 while the dry run ran 24.10; a deflate-based zip would differ. **Tested:** Task 2 measured the same sha256 for the real package on Node 22.12.0 and 24.10; the zip's sort is by code unit, not locale (its "unsorted" mutation is red).

---

## How to read the steps

- A **new file** is given in full; a **changed file** is a unified diff against the previous task's tree. Apply each ```diff block on its own, in order, with `git apply --recount` from the repository root — never concatenate blocks. (Tasks 2, 3 and 5 were written against an earlier base than their predecessor in this file; their diffs apply unchanged — the replay in the Self-review proves it.)
- No PNG and no zip is committed: the screenshots go to `extension/release/screenshots/out/` and the zip to `extension/release/out/`, both git-ignored. Task 1's `scripts/__tests__/fixtures/chrome-id-vector.json` is committed **exactly as given** (a key Chromium itself loaded; its ID is Chromium's).
- "Whole suite" is `npx tsc --noEmit; echo $?`, `TZ=UTC npx vitest run` and `TZ=UTC npx vitest run --config vitest.nopresale.config.ts` (one at a time); both builds; `npm run gates` (and `npm run csp` where a task changes a page; `npm run reproducible` where a build output changes).
- **Values that later tasks change (review 1 M9):** the digests and hashes quoted inside a task; the manifest `description` (Task 4 states the old "Noctura wallet for Solana.", Task 6 replaces it with the store summary); P5's text (Task 3 rev 2) and the NOC row's wording (Task 6). Compare counts and equalities, never a quoted digest.
- **The plan-text character check** (no invisible or look-alike character in an added line; every visible en / em dash is allowed): `git diff <base> <head> | grep '^+' | grep -cP '[\x{00A0}\x{00AD}\x{200B}-\x{200F}\x{2010}-\x{2012}\x{2015}\x{2028}\x{2029}\x{202A}-\x{202E}\x{2060}-\x{2064}\x{2212}\x{FEFF}]'` → 0 (rev 2 widened it to U+2010–U+2012, U+2015 and U+2212 after Task 6's editor wrote two look-alike hyphens raw; over the pre-escape Task 6 commit 71d213d against 55383f4 it counts 2 added lines; over 0fcf769..9f42f00, 0).
- **Each task ends with its named mutations** (fresh `git archive` copy, `tsc`'s own exit code first, each red) and **"Notes for the executor"** (its rulings, then the dry run's rulings, deviations and hand-over; part of the plan). Digests and hashes quoted inside a task are those of its own dry-run tree; later tasks change them (Task 6 changes the manifest's `description`), so an executor compares counts and equalities, never a quoted digest.

## Tasks

### Task 1: One version source and the dev-only `key` — `extension/package.json` `"version": "1.0.0"` read by `manifest/source.mjs` (the constant goes; a version outside Chrome's rule fails the build); `render(browser, {key})` adds a key only when given one, for Chrome only; `scripts/storeKey.mjs` reads and checks `release/store-key.json` (exactly `{id, key}`, the key canonical base64 of a DER SubjectPublicKeyInfo, the id the one Chrome derives from it — a vector Chromium itself produced); `node scripts/build.mjs <outDir> --dev-key` (never into `dist/` / `dist-nopresale/`, the key read before anything is built, absent or malformed → no build); `check-permissions.mjs`: every built manifest's `version` is package.json's and matches `^\d+\.\d+\.\d+$`, no manifest in `dist/` or `dist-nopresale/` carries a `key`, and `--dev-key <outDir>` checks a dev-key build's key against the recorded one; #38's version line checked in the real popup

**Spec:** B1e §5.2 (I8, R5: one version source; `source.mjs` reads `../package.json` relative to its own `import.meta.url`; the gate's version rule and its mutation; #38 via `runtime.getManifest().version`, `platform.ts:80`), §5.3 (I8: `store-key.json` `{id, key}` recorded after the first upload, §7 step 7; `render(browser, {key})`; `build.mjs --dev-key` refuses when the file is absent; `verify`, the E2E builds and the release never pass it; the gate: a key in `dist/` / `dist-nopresale/` fails, a `--dev-key` build's key equals the recorded one; mutation "`render` adding `key` by default"), §8 (Firefox / AMO out of scope — a key is never added to a Firefox manifest), §10 (permissions gate: version, `key`). **Not here:** the release script, the zip, the notes file (Tasks 2 and 6); the checklist's dev-key coexistence note (Task 7 writes `release/checklist.md` — the sentence is handed over below).

**Files:**
- Create: `extension/scripts/storeKey.mjs`, `extension/scripts/__tests__/fixtures/chrome-id-vector.json`
- Modify: `extension/package.json` (`"version": "1.0.0"`), `extension/package-lock.json` (the two `version` lines `npm install --package-lock-only` writes), `extension/manifest/source.mjs`, `extension/scripts/build.mjs`, `extension/scripts/check-permissions.mjs`
- Create (tests): `extension/scripts/__tests__/storeKey.test.mjs` (29: 28 run + 1 skipped while `release/store-key.json` is absent)
- Modify (tests): `extension/scripts/__tests__/check-permissions.test.mjs` (29 → 54: +25, 1 of them skipped once the store key is recorded), `extension/scripts/__tests__/presaleBuilds.test.mjs` (19 → 20), `extension/e2e/links.spec.ts` (#38's version line, both builds; still 4 tests)
- **Not changed, on purpose** (`grep -rn "0\.1\.0"` over `extension/` outside `node_modules` / `dist*`): `src/app/__tests__/harness.tsx:139` and `Switcher.test.tsx:55` (`version: () => '0.1.0'` — the fake `Platform` the component tests inject, not the manifest) and `Settings.test.tsx:42` (`v0.1.0` — what that fake returns, rendered); `scripts/__tests__/licences.test.mjs` (`zeta 0.1.0` — a package of the test's own tree). `src/provider/__tests__/provider.test.ts:45` pins `'1.0.0'` — Wallet Standard's `Wallet.version` (the standard's API version), unrelated to the extension's.

**Interfaces:**
- Consumes: `distDir` (`scripts/distDir.mjs`), `isMain`, `buildLicencePage` / `LICENCE_PAGE` (unchanged), `PERMISSIONS`, `HOST_PERMISSIONS`, `EXTENSION_CSP`, `MIN_*_VERSION`; `platform.version()` = `runtime.getManifest().version` (`src/app/platform.ts:80`, unchanged); `launchPopup`, `seedUnlockedWallet`, `EXT`, `EXT_NOPRESALE` (E2E).
- Produces (`extension/manifest/source.mjs`):
  ```js
  export const PACKAGE_JSON: URL;                               // new URL('../package.json', import.meta.url)
  export function isReleaseVersion(v: unknown): boolean;        // /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/ and each ≤ 65535
  export function packageVersion(url?: URL): string;            // throws `<path>: version must be three integers 0–65535 without leading zeros (B1e §5.2), is <json>`
  export const VERSION: string;                                 // packageVersion() — '1.0.0'
  export function render(browser: 'chrome' | 'firefox', options?: {key?: string}): object;
  //   key given: a non-empty string, Chrome only, else throws `a manifest key is a non-empty string for Chrome only (B1e §5.3), not <json> for <browser>`;
  //   the Chrome manifest is the keyless one plus `key` as its last field; no key given → no `key` field
  ```
- Produces (`extension/scripts/storeKey.mjs`):
  ```js
  export const STORE_KEY: 'release/store-key.json';
  export const STORE_KEY_PATH: string;                          // <extension>/release/store-key.json
  export function extensionId(der: Uint8Array): string;         // sha256(der)[0..16) as hex, 0–f → a–p
  export function storeKeyProblems(value: unknown): string[];   // [] iff exactly {id, key} and id === extensionId(key's DER)
  export function readStoreKey(path?: string): {id: string, key: string};  // throws `<path>: absent — …` / `unreadable or not JSON (…)` / `<problems joined by '; '>`
  ```
- Produces (`extension/scripts/check-permissions.mjs`):
  ```js
  export const VERSION_PATTERN: /^\d+\.\d+\.\d+$/;
  export function packageJsonVersion(): unknown;                 // its own read of ../package.json
  export function versionViolations(manifest, want?: unknown): string[];
  export function keyViolations(manifest, browser, recorded?: {id, key}): string[];
  export function comparePermissions(manifest, browser, options?: {recorded?: {id, key}, version?: string}): string[];  // version + key rows first
  // CLI: `node scripts/check-permissions.mjs` (NOCTURA_DIST, no key allowed) | `node scripts/check-permissions.mjs --dev-key <outDir>`
  //   ok lines: `permissions ok (<dist>): both manifests match manifest/source.mjs, version 1.0.0, no key`
  //             `permissions ok (<outDir>): both manifests match manifest/source.mjs, version 1.0.0; chrome carries the recorded store key (id <id>), firefox none`
  ```
- Produces (`extension/scripts/build.mjs`): `node scripts/build.mjs [outDir] [--no-presale]` unchanged; `node scripts/build.mjs <outDir> --dev-key [--no-presale]` — refuses with no `outDir` or with `dist` / `dist-nopresale` (`--dev-key builds only into a directory named on the command line, never dist/ or dist-nopresale/ (B1e §5.3). usage: …`), then reads `STORE_KEY_PATH` before the first vite build; the Chrome manifest gets the key, Firefox's never.
- **What later tasks rely on:** Task 7 — `packageVersion()` / `VERSION` for `notes-<version>.md` and the zip's name; the store build's manifests carry no `key` (the gate, both builds); `release/checklist.md` carries the dev-key sentence below and §7 step 7's "record `{id, key}` in `extension/release/store-key.json`" with this file's rule (one line of base64, no PEM armour; the id must be the key's own). Task 2's zip packs `dist-nopresale/chrome` whose `manifest.json` now says `"version": "1.0.0"`. The reproducible digests change with the version (below).

**The rule, stated once.** The version lives in one place, `extension/package.json`; the manifest reads it, #38 shows the manifest's, and the gate compares every built manifest with its own read of package.json. A manifest in `dist/` or `dist-nopresale/` — what `verify`, the gates, the E2E and the release use — never carries a `key`. A key exists only in a build a developer asks for by name (`--dev-key` into a named directory), only in its Chrome manifest, and only as recorded in `release/store-key.json`, which is refused unless it is exactly the store's `{id, key}` and the id is the one Chrome derives from that key.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/fixtures/chrome-id-vector.json` (the dry run generated a fresh RSA-2048 key, loaded an unpacked MV3 extension carrying it in Playwright's Chromium 153 and recorded the ID Chromium gave it — the private key was never written anywhere; the vector is a public key and the ID a browser computed, not this code):

```json
{
  "observed": "Chromium 153.0.8010.12 (Playwright), 2026-11-05: an unpacked MV3 extension whose manifest carried this key was loaded under this ID",
  "key": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4SU/vgJM8DqB7q4yU6312nTm5Hhc5SHLucVan0IMlCvQZU9MxKss+giHOsQQxknfnaR9vy43kQX6O9IzikRtY6kbYPH+ELjpUqkg4/1qz6GnJePElhM4krxYDuzOjACw/jf2jYwle2WjMd5e93JZYm/CRjhV317FZQr51tGMQ1ekD0yplBqicQPn9+oT8PWM652/utVul20uqPMrx6Ae+B6xqEKPSynBBCxTHGqeb/XX55RtUVe4tqSTi13aWEf68zvdxH6unX0SxfoEp1cnrgq05T28UBofH0CdeAyRxMDqgUI/X6vNJTog1tLym5rt0PE/hDqCrlrVoaL+jqdF7wIDAQAB",
  "id": "gialdecpbdgdgllggmmephkblnejccej"
}
```

Create `extension/scripts/__tests__/storeKey.test.mjs`:

```js
import {spawnSync} from 'node:child_process';
import {generateKeyPairSync} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {STORE_KEY, STORE_KEY_PATH, extensionId, readStoreKey, storeKeyProblems} from '../storeKey.mjs';
import {comparePermissions} from '../check-permissions.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BUILD_MS = 180_000;
// The ID Chromium itself gave an unpacked extension carrying this key (the dry run's probe) — not our derivation.
const VECTOR = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/chrome-id-vector.json'), 'utf8'));
const RECORDED = {id: VECTOR.id, key: VECTOR.key};
const BUILD_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_ENV'));
const build = args => spawnSync('node', ['scripts/build.mjs', ...args], {cwd: ROOT, encoding: 'utf8', env: BUILD_ENV});

// B1e §5.3: release/store-key.json — exactly {id, key} as the store assigns them — read only by --dev-key.
describe('the store key (B1e §5.3)', () => {
  let dir;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'store-key-'));
  });
  afterEach(() => rmSync(dir, {recursive: true, force: true}));
  const file = text => {
    const p = join(dir, 'store-key.json');
    writeFileSync(p, text);
    return p;
  };

  it('is release/store-key.json in the package', () => {
    expect(STORE_KEY).toBe('release/store-key.json');
    expect(STORE_KEY_PATH).toBe(join(ROOT, 'release', 'store-key.json'));
  });

  it('derives the ID Chromium gives the key (the observed vector); another key gives another ID', () => {
    expect(extensionId(Buffer.from(VECTOR.key, 'base64'))).toBe(VECTOR.id);
    const other = generateKeyPairSync('rsa', {modulusLength: 2048}).publicKey.export({type: 'spki', format: 'der'});
    expect(extensionId(other)).toMatch(/^[a-p]{32}$/);
    expect(extensionId(other)).not.toBe(VECTOR.id);
  });

  it('reads a well-formed file: exactly {id, key} (positive control)', () => {
    expect(storeKeyProblems(RECORDED)).toEqual([]);
    expect(readStoreKey(file(`${JSON.stringify(RECORDED, null, 2)}\n`))).toEqual(RECORDED);
    expect(readStoreKey(file(JSON.stringify({key: VECTOR.key, id: VECTOR.id})))).toEqual(RECORDED);
  });

  it('refuses an absent file, naming the step that records it', () => {
    expect(() => readStoreKey(join(dir, 'store-key.json'))).toThrow(/store-key\.json: absent — the store assigns the ID at the first upload; record \{id, key\} then \(B1e §5\.3, §7 step 7\)/);
  });

  it.each([['', /unreadable or not JSON/], ['{"id": ', /unreadable or not JSON/], ['null', /must be a JSON object \{id, key\}/], ['[]', /must be a JSON object \{id, key\}/], ['"x"', /must be a JSON object \{id, key\}/]])(
    'refuses a file that is not a JSON object: %j',
    (text, why) => {
      expect(() => readStoreKey(file(text))).toThrow(why);
    },
  );

  it.each([
    ['an extra field', {...RECORDED, name: 'Noctura'}, 'must hold exactly the fields id and key, has id, key, name'],
    ['no id', {key: VECTOR.key}, 'must hold exactly the fields id and key, has key'],
    ['no key', {id: VECTOR.id}, 'must hold exactly the fields id and key, has id'],
    ['nothing', {}, 'must hold exactly the fields id and key, has none'],
    ['an id of 31 letters', {...RECORDED, id: VECTOR.id.slice(1)}, `id must be 32 letters a–p, is "${VECTOR.id.slice(1)}"`],
    ['an id in capitals', {...RECORDED, id: VECTOR.id.toUpperCase()}, `id must be 32 letters a–p, is "${VECTOR.id.toUpperCase()}"`],
    ['an id with a q', {...RECORDED, id: `q${VECTOR.id.slice(1)}`}, `id must be 32 letters a–p, is "q${VECTOR.id.slice(1)}"`],
    ['an id that is a number', {...RECORDED, id: 1}, 'id must be 32 letters a–p, is 1'],
  ])('refuses %s', (_, value, why) => {
    expect(storeKeyProblems(value)).toEqual([why]);
    expect(() => readStoreKey(file(JSON.stringify(value)))).toThrow(why);
  });

  const B64 = 'key must be the public key as one line of canonical base64 (no PEM BEGIN / END lines, no line breaks)';
  it.each([
    ['PEM armour', `-----BEGIN PUBLIC KEY-----\n${VECTOR.key}\n-----END PUBLIC KEY-----`, B64],
    ['line breaks', `${VECTOR.key.slice(0, 64)}\n${VECTOR.key.slice(64)}`, B64],
    ['a trailing space', `${VECTOR.key} `, B64],
    ['base64url', VECTOR.key.replace(/\+/g, '-').replace(/\//g, '_'), B64],
    ['non-canonical padding bits', 'AB==', B64],
    ['an empty string', '', B64],
    ['a number', 7, B64],
    ['base64 of bytes that are no public key', Buffer.from('not a key at all').toString('base64'), 'key is not a DER SubjectPublicKeyInfo public key'],
  ])('refuses a key with %s', (_, key, why) => {
    expect(storeKeyProblems({id: VECTOR.id, key})).toEqual([why]);
  });

  it('refuses a well-formed id that is not the key’s own ID', () => {
    const other = generateKeyPairSync('rsa', {modulusLength: 2048}).publicKey.export({type: 'spki', format: 'der'}).toString('base64');
    expect(storeKeyProblems({id: VECTOR.id, key: other})).toEqual([`id ${VECTOR.id} is not the ID of this key (${extensionId(Buffer.from(other, 'base64'))})`]);
    expect(storeKeyProblems({id: extensionId(Buffer.from(other, 'base64')), key: other})).toEqual([]);
  });
});

// The build's side: --dev-key reads the fixed path before building anything, and writes only into a named directory.
describe('build.mjs --dev-key (B1e §5.3)', () => {
  it('refuses without a directory, or with dist/ or dist-nopresale/, before reading the key or building', () => {
    for (const args of [['--dev-key'], ['--dev-key', '--no-presale'], ['dist', '--dev-key'], [join(ROOT, 'dist-nopresale'), '--dev-key', '--no-presale'], ['./dist/', '--dev-key']]) {
      const r = build(args);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain('--dev-key builds only into a directory named on the command line, never dist/ or dist-nopresale/ (B1e §5.3).');
    }
  });

  it.runIf(!existsSync(STORE_KEY_PATH))('refuses while release/store-key.json is absent (until §7 step 7), and builds nothing', () => {
    const parent = mkdtempSync(join(tmpdir(), 'dev-key-absent-'));
    try {
      const out = join(parent, 'out');
      const r = build([out, '--dev-key', '--no-presale']);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain(`${STORE_KEY_PATH}: absent — the store assigns the ID at the first upload`);
      expect(existsSync(out)).toBe(false);
    } finally {
      rmSync(parent, {recursive: true, force: true});
    }
  });

  it.runIf(existsSync(STORE_KEY_PATH))(
    'once recorded: the Chrome manifest carries the recorded key, Firefox none, and both pass the gate against the file',
    () => {
      const recorded = readStoreKey();
      const out = mkdtempSync(join(tmpdir(), 'dev-key-'));
      try {
        const r = build([out, '--dev-key', '--no-presale']);
        expect(r.status).toBe(0);
        const chrome = JSON.parse(readFileSync(join(out, 'chrome', 'manifest.json'), 'utf8'));
        const firefox = JSON.parse(readFileSync(join(out, 'firefox', 'manifest.json'), 'utf8'));
        expect(chrome.key).toBe(recorded.key);
        expect(Object.hasOwn(firefox, 'key')).toBe(false);
        expect(comparePermissions(chrome, 'chrome', {recorded})).toEqual([]);
        expect(comparePermissions(firefox, 'firefox', {recorded})).toEqual([]);
        expect(comparePermissions(chrome, 'chrome')).toEqual(['chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
      } finally {
        rmSync(out, {recursive: true, force: true});
      }
    },
    BUILD_MS,
  );
});
```

Modify `extension/scripts/__tests__/check-permissions.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-permissions.test.mjs b/extension/scripts/__tests__/check-permissions.test.mjs
index ec78490..055e060 100644
--- a/extension/scripts/__tests__/check-permissions.test.mjs
+++ b/extension/scripts/__tests__/check-permissions.test.mjs
@@ -1,5 +1,17 @@
-import {REQUIRED_CONNECT_SRC, REQUIRED_CONTENT_SCRIPTS, REQUIRED_CSP, comparePermissions, connectSrcViolations, contentScriptViolations, cspViolations} from '../check-permissions.mjs';
-import {EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION, render} from '../../manifest/source.mjs';
+import {spawnSync} from 'node:child_process';
+import {existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
+import {tmpdir} from 'node:os';
+import {dirname, join, resolve} from 'node:path';
+import {fileURLToPath, pathToFileURL} from 'node:url';
+import {REQUIRED_CONNECT_SRC, REQUIRED_CONTENT_SCRIPTS, REQUIRED_CSP, VERSION_PATTERN, comparePermissions, connectSrcViolations, contentScriptViolations, cspViolations, keyViolations, versionViolations} from '../check-permissions.mjs';
+import {EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION, VERSION, isReleaseVersion, packageVersion, render} from '../../manifest/source.mjs';
+import {STORE_KEY_PATH, readStoreKey} from '../storeKey.mjs';
+
+const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
+// package.json read by the test itself — neither source.mjs's VERSION nor the gate's own read.
+const PKG_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
+const VECTOR = JSON.parse(readFileSync(join(ROOT, 'scripts/__tests__/fixtures/chrome-id-vector.json'), 'utf8'));
+const RECORDED = {id: VECTOR.id, key: VECTOR.key};
 
 describe('permissions gate', () => {
   it('accepts the rendered manifests', () => {
@@ -156,4 +168,133 @@ describe('permissions gate', () => {
     delete missing.browser_specific_settings.gecko.strict_min_version;
     expect(comparePermissions(missing, 'firefox')).toEqual(['firefox: gecko.strict_min_version differs: undefined']);
   });
+
+  // B1e §5.2 (R5): one version source, package.json; every built manifest carries it.
+  it('both manifests carry package.json\'s version, which matches the release pattern (no constant)', () => {
+    expect(PKG_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
+    expect(VERSION).toBe(PKG_VERSION);
+    expect(render('chrome').version).toBe(PKG_VERSION);
+    expect(render('firefox').version).toBe(PKG_VERSION);
+    expect(VERSION_PATTERN.source).toBe('^\\d+\\.\\d+\\.\\d+$');
+    expect(readFileSync(join(ROOT, 'manifest/source.mjs'), 'utf8')).not.toMatch(/version: '|\bVERSION = '/);
+  });
+
+  it('refuses a hand-edited or missing version, and a package.json version outside the pattern', () => {
+    for (const browser of ['chrome', 'firefox']) {
+      const m = render(browser);
+      m.version = '1.0.1';
+      expect(comparePermissions(m, browser)).toEqual([`version is "1.0.1", want package.json's ${JSON.stringify(PKG_VERSION)}`]);
+      delete m.version;
+      expect(comparePermissions(m, browser)).toEqual([`version is undefined, want package.json's ${JSON.stringify(PKG_VERSION)}`]);
+    }
+    expect(versionViolations({version: '1.0'}, '1.0')).toEqual(['package.json version "1.0" does not match /^\\d+\\.\\d+\\.\\d+$/', 'version "1.0" does not match /^\\d+\\.\\d+\\.\\d+$/']);
+    expect(versionViolations({version: '1.0.0.1'}, '1.0.0')).toEqual(['version is "1.0.0.1", want package.json\'s "1.0.0"']);
+    expect(versionViolations({}, undefined)).toEqual([`version is undefined, want package.json's ${JSON.stringify(PKG_VERSION)}`]);
+    expect(versionViolations({version: '2.3.4'}, '2.3.4')).toEqual([]);
+  });
+
+  it.each(['1.0.0', '0.0.0', '10.20.30', '65535.65535.65535'])('source.mjs accepts the version %j', v => expect(isReleaseVersion(v)).toBe(true));
+  it.each(['1.0', '1.0.0.0', '01.0.0', '1.00.0', '1.0.65536', '1.0.0-beta', ' 1.0.0', 'v1.0.0', '', 1, undefined])('source.mjs refuses the version %j', v =>
+    expect(isReleaseVersion(v)).toBe(false),
+  );
+
+  it('source.mjs reads package.json and throws on a missing or malformed version (the build fails)', () => {
+    const dir = mkdtempSync(join(tmpdir(), 'pkg-version-'));
+    try {
+      const pkg = json => {
+        const p = join(dir, 'package.json');
+        writeFileSync(p, JSON.stringify(json));
+        return pathToFileURL(p);
+      };
+      expect(packageVersion(pkg({name: 'x', version: '3.2.1'}))).toBe('3.2.1');
+      expect(() => packageVersion(pkg({name: 'x'}))).toThrow(/version must be three integers 0–65535 without leading zeros \(B1e §5\.2\), is undefined/);
+      expect(() => packageVersion(pkg({name: 'x', version: '0.1'}))).toThrow(/is "0\.1"/);
+    } finally {
+      rmSync(dir, {recursive: true, force: true});
+    }
+  });
+
+  // B1e §5.3: the `key` render option — never by default; Chrome only.
+  it('render adds a key only when given one, for Chrome only', () => {
+    expect(Object.hasOwn(render('chrome'), 'key')).toBe(false);
+    expect(Object.hasOwn(render('chrome', {}), 'key')).toBe(false);
+    expect(Object.hasOwn(render('firefox'), 'key')).toBe(false);
+    expect(render('chrome', {key: VECTOR.key}).key).toBe(VECTOR.key);
+    const {key: _key, ...rest} = render('chrome', {key: VECTOR.key});
+    expect(rest).toEqual(render('chrome'));
+    expect(() => render('firefox', {key: VECTOR.key})).toThrow('a manifest key is a non-empty string for Chrome only (B1e §5.3)');
+    expect(() => render('chrome', {key: ''})).toThrow('a manifest key is a non-empty string for Chrome only');
+    expect(() => render('chrome', {key: 1})).toThrow('a manifest key is a non-empty string for Chrome only');
+  });
+
+  it('refuses a key in a dist/ or dist-nopresale/ manifest, Chrome or Firefox', () => {
+    expect(comparePermissions(render('chrome'), 'chrome')).toEqual([]);
+    const chrome = {...render('chrome'), key: VECTOR.key};
+    expect(comparePermissions(chrome, 'chrome')).toEqual(['chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
+    const firefox = {...render('firefox'), key: VECTOR.key};
+    expect(comparePermissions(firefox, 'firefox')).toEqual(['firefox: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
+    expect(keyViolations({...render('chrome'), key: undefined}, 'chrome', undefined)).toEqual(['chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
+  });
+
+  it('a --dev-key build: Chrome\'s key equals the recorded one (read from a store-key file), Firefox carries none', () => {
+    const dir = mkdtempSync(join(tmpdir(), 'dev-key-gate-'));
+    try {
+      const path = join(dir, 'store-key.json');
+      writeFileSync(path, JSON.stringify(RECORDED));
+      const recorded = readStoreKey(path);
+      expect(comparePermissions(render('chrome', {key: recorded.key}), 'chrome', {recorded})).toEqual([]);
+      expect(comparePermissions(render('firefox'), 'firefox', {recorded})).toEqual([]);
+      expect(comparePermissions(render('chrome'), 'chrome', {recorded})).toEqual([`chrome: key missing, want the recorded store key (release/store-key.json, id ${VECTOR.id})`]);
+      const other = render('chrome', {key: `${recorded.key.slice(0, -8)}AAAAAAAA`});
+      expect(comparePermissions(other, 'chrome', {recorded})).toEqual([`chrome: key differs from the recorded store key (release/store-key.json, id ${VECTOR.id})`]);
+      expect(comparePermissions({...render('firefox'), key: recorded.key}, 'firefox', {recorded})).toEqual(['firefox: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
+    } finally {
+      rmSync(dir, {recursive: true, force: true});
+    }
+  });
 });
+
+// The gate as `npm run gates` runs it, over a build directory written for the test (cwd = a temp package root).
+describe('check-permissions.mjs (CLI)', () => {
+  const GATE = join(ROOT, 'scripts/check-permissions.mjs');
+  let cwd;
+  beforeEach(() => {
+    cwd = mkdtempSync(join(tmpdir(), 'perm-cli-'));
+  });
+  afterEach(() => rmSync(cwd, {recursive: true, force: true}));
+  const write = (dist, manifests) => {
+    for (const [browser, m] of Object.entries(manifests)) {
+      mkdirSync(join(cwd, dist, browser), {recursive: true});
+      writeFileSync(join(cwd, dist, browser, 'manifest.json'), JSON.stringify(m));
+    }
+  };
+  const run = (env, args = []) => spawnSync('node', [GATE, ...args], {cwd, encoding: 'utf8', env: {...process.env, ...env}});
+
+  it.each(['dist', 'dist-nopresale'])('%s: passes the rendered manifests (positive control), fails a key or a hand-edited version', dist => {
+    write(dist, {chrome: render('chrome'), firefox: render('firefox')});
+    const ok = run({NOCTURA_DIST: dist});
+    expect([ok.status, ok.stdout.trim()]).toEqual([0, `permissions ok (${dist}): both manifests match manifest/source.mjs, version ${PKG_VERSION}, no key`]);
+    write(dist, {chrome: {...render('chrome'), key: VECTOR.key}});
+    const keyed = run({NOCTURA_DIST: dist});
+    expect([keyed.status, keyed.stderr.trim()]).toEqual([1, 'chrome: chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)']);
+    write(dist, {chrome: render('chrome'), firefox: {...render('firefox'), version: '0.1.0'}});
+    const edited = run({NOCTURA_DIST: dist});
+    expect([edited.status, edited.stderr.trim()]).toEqual([1, `firefox: version is "0.1.0", want package.json's ${JSON.stringify(PKG_VERSION)}`]);
+  });
+
+  it.runIf(!existsSync(STORE_KEY_PATH))('--dev-key <outDir> refuses while release/store-key.json is absent', () => {
+    write('out', {chrome: render('chrome', {key: VECTOR.key}), firefox: render('firefox')});
+    const r = run({}, ['--dev-key', 'out']);
+    expect(r.status).not.toBe(0);
+    expect(r.stderr).toContain(`${STORE_KEY_PATH}: absent`);
+  });
+
+  it('refuses other arguments', () => {
+    for (const args of [['--dev-key'], ['out'], ['--dev-key', 'a', 'b']]) {
+      const r = run({}, args);
+      expect(r.status).not.toBe(0);
+      expect(r.stderr).toContain('usage: node scripts/check-permissions.mjs [--dev-key <outDir>]');
+    }
+  });
+});
+
```

Modify `extension/scripts/__tests__/presaleBuilds.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/presaleBuilds.test.mjs b/extension/scripts/__tests__/presaleBuilds.test.mjs
index 20a5804..859250c 100644
--- a/extension/scripts/__tests__/presaleBuilds.test.mjs
+++ b/extension/scripts/__tests__/presaleBuilds.test.mjs
@@ -4,6 +4,7 @@ import {tmpdir} from 'node:os';
 import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {checkNoPresale} from '../check-no-presale.mjs';
+import {comparePermissions} from '../check-permissions.mjs';
 import {linkViolations, packageFiles} from '../check-links.mjs';
 import {pageViolations} from '../check-vault-isolation.mjs';
 import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';
@@ -77,6 +78,17 @@ describe('the two builds', () => {
     }
   });
 
+  // B1e §5.2, §5.3: what `node scripts/build.mjs` writes — package.json's version, and no key without --dev-key.
+  it('both: each manifest carries package.json\'s version and no key, and passes the permissions gate', () => {
+    const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
+    for (const b of Object.values(builds)) {
+      for (const browser of ['chrome', 'firefox']) {
+        const m = JSON.parse(readFileSync(join(b.dir, browser, 'manifest.json'), 'utf8'));
+        expect([browser, m.version, Object.hasOwn(m, 'key'), comparePermissions(m, browser)]).toEqual([browser, version, false, []]);
+      }
+    }
+  });
+
   // C4: the background is a module service worker, where import() throws. A method named `import` (`x.import()`) is not one.
   it('no chunk the background loads contains a dynamic import, in either build', () => {
     const DYNAMIC = /(?<![.\w$])import\s*\(/;
```

Modify `extension/e2e/links.spec.ts`:

```diff
diff --git a/extension/e2e/links.spec.ts b/extension/e2e/links.spec.ts
index 7732bd8..2e386a4 100644
--- a/extension/e2e/links.spec.ts
+++ b/extension/e2e/links.spec.ts
@@ -1,3 +1,4 @@
+import {readFileSync} from 'node:fs';
 import {test, expect, type Page} from '@playwright/test';
 import {EXT, EXT_NOPRESALE} from './launch';
 import {launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
@@ -9,6 +10,7 @@ import {launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
 const TERMS = 'https://noc-tura.io/extension/terms';
 const PRIVACY = 'https://noc-tura.io/extension/privacy';
 const HELP = 'https://noc-tura.io/extension/help';
+const PACKAGE_VERSION: unknown = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
 
 /** Clicks a link and returns the tab it opened; the click must open one. */
 async function opensTab(h: Harness, click: () => Promise<void>): Promise<Page> {
@@ -77,6 +79,8 @@ for (const [build, ext] of [
         const p = await h.openPopup();
         await p.getByRole('button', {name: 'Settings'}).click();
         await p.getByText('About Noctura').click();
+        // B1e §5.2: #38's version line is runtime.getManifest().version — package.json's, read here on its own.
+        await expect(p.locator('.app-about-card .noc-mono')).toHaveText(`v${PACKAGE_VERSION}`);
         const rows = [
           ['Terms of Service', TERMS],
           ['Privacy Policy', PRIVACY],
```

- [ ] **Step 2: Run — red.**

Run (in `extension/`, on the base tree 0fcf769 plus Step 1's files): `npx tsc --noEmit; echo $?` — `0` (the new tests are `.mjs`; `links.spec.ts` compiles on the base).
Run: `TZ=UTC npx vitest run scripts/__tests__/storeKey.test.mjs scripts/__tests__/check-permissions.test.mjs scripts/__tests__/presaleBuilds.test.mjs`
Expected: `Test Files  3 failed (3)` · `Tests  1 failed | 19 passed (20)` — two files fail to load: `Error: Cannot find module '../storeKey.mjs' imported from …/scripts/__tests__/check-permissions.test.mjs` and the same from `storeKey.test.mjs`; presaleBuilds' new row: `AssertionError: expected [ 'chrome', '0.1.0', false, [] ] to deeply equal [ 'chrome', undefined, false, [] ]` (package.json has no `version` on the base; the built manifest says `0.1.0`). (Observed: the final test files on 0fcf769 in a scratch copy.)
`e2e/links.spec.ts` on the base is red by construction (`PACKAGE_VERSION` is `undefined` there, the page shows `v0.1.0`); its bite is proved on the final commit by M-about-version (Step 6), which is the stronger check: the product changed, the test unchanged.

- [ ] **Step 3: Implement.**

Modify `extension/package.json` and `extension/package-lock.json` — the version, then `npm install --package-lock-only --ignore-scripts --offline` (npm 11.6.2; it writes exactly the two lines below, nothing else):

```diff
diff --git a/extension/package.json b/extension/package.json
index 6b47315..dc7fb50 100644
--- a/extension/package.json
+++ b/extension/package.json
@@ -1,5 +1,6 @@
 {
   "name": "noctura-extension",
+  "version": "1.0.0",
   "private": true,
   "type": "module",
   "engines": {
```

```diff
diff --git a/extension/package-lock.json b/extension/package-lock.json
index 6c551b5..583546d 100644
--- a/extension/package-lock.json
+++ b/extension/package-lock.json
@@ -1,10 +1,12 @@
 {
   "name": "noctura-extension",
+  "version": "1.0.0",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "noctura-extension",
+      "version": "1.0.0",
       "dependencies": {
         "@noble/curves": "^2.0.1",
         "@noble/hashes": "^2.0.1",
```

Create `extension/scripts/storeKey.mjs`:

```js
// B1e §5.3: the store's public key for the extension, recorded after the Chrome Web Store assigns the ID at the first
// upload (§7 step 7) in release/store-key.json as exactly {id, key}. Only `node scripts/build.mjs <outDir> --dev-key`
// and `node scripts/check-permissions.mjs --dev-key <outDir>` read it: an unpacked install that carries the key has
// the store's ID (so a passkey or an allowlist bound to that ID can be tried before release). `verify`, the E2E builds
// and the release never pass a key — the store package never carries one.
//
// The file is refused unless it is exactly what the store gave:
// - `key`: the manifest form of the public key — canonical base64 of a DER SubjectPublicKeyInfo, one line, no PEM
//   armour, no whitespace (the dashboard shows it as PEM: strip the BEGIN / END lines and the line breaks);
// - `id`: 32 letters a–p, and equal to the ID Chrome derives from `key` — the first 16 bytes of the sha256 of the DER
//   bytes, each hex digit 0–f written as a–p (observed: Chromium 153 loads an unpacked extension carrying a fresh key
//   under exactly this ID — scripts/__tests__/fixtures/chrome-id-vector.json). A key pasted from elsewhere, or an ID
//   copied from another item, fails here, not after a build that silently has another ID.
import {createHash, createPublicKey} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Package-relative, as the spec and the checklist name it. */
export const STORE_KEY = 'release/store-key.json';
/** The one path the build and the gate read. */
export const STORE_KEY_PATH = join(ROOT, STORE_KEY);

const ID = /^[a-p]{32}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** The extension ID Chrome derives from a public key's DER bytes. */
export function extensionId(der) {
  return [...createHash('sha256').update(der).digest().subarray(0, 16).toString('hex')].map(c => String.fromCharCode(97 + Number.parseInt(c, 16))).join('');
}

/** Every reason `value` (a parsed store-key.json) is not exactly {id, key} as §5.3 records it; [] when it is. */
export function storeKeyProblems(value) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return ['must be a JSON object {id, key}'];
  const names = Object.keys(value).sort();
  if (names.join(',') !== 'id,key') return [`must hold exactly the fields id and key, has ${names.length ? names.join(', ') : 'none'}`];
  const {id, key} = value;
  const problems = [];
  if (typeof id !== 'string' || !ID.test(id)) problems.push(`id must be 32 letters a–p, is ${JSON.stringify(id)}`);
  if (typeof key !== 'string' || !BASE64.test(key) || Buffer.from(key, 'base64').toString('base64') !== key) {
    problems.push('key must be the public key as one line of canonical base64 (no PEM BEGIN / END lines, no line breaks)');
    return problems;
  }
  const der = Buffer.from(key, 'base64');
  try {
    createPublicKey({key: der, format: 'der', type: 'spki'});
  } catch {
    problems.push('key is not a DER SubjectPublicKeyInfo public key');
    return problems;
  }
  if (problems.length === 0 && extensionId(der) !== id) problems.push(`id ${id} is not the ID of this key (${extensionId(der)})`);
  return problems;
}

/** Reads and checks the store key at `path`; throws, naming the file and every problem, unless it is exactly {id, key}. */
export function readStoreKey(path = STORE_KEY_PATH) {
  if (!existsSync(path)) {
    throw new Error(`${path}: absent — the store assigns the ID at the first upload; record {id, key} then (B1e §5.3, §7 step 7)`);
  }
  let value;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new Error(`${path}: unreadable or not JSON (${e.message})`);
  }
  const problems = storeKeyProblems(value);
  if (problems.length) throw new Error(`${path}: ${problems.join('; ')}`);
  return {id: value.id, key: value.key};
}
```

Modify `extension/manifest/source.mjs`:

```diff
diff --git a/extension/manifest/source.mjs b/extension/manifest/source.mjs
index 1ad69d0..da0c57f 100644
--- a/extension/manifest/source.mjs
+++ b/extension/manifest/source.mjs
@@ -1,3 +1,6 @@
+import {readFileSync} from 'node:fs';
+import {fileURLToPath} from 'node:url';
+
 // The one source for both browsers' manifests, as web/deploy/security-headers.mjs is for
 // nginx: every permission and host is here once, with the reason a store reviewer and a
 // user are owed. The permissions gate (scripts/check-permissions.mjs) compares the built
@@ -55,7 +58,25 @@ export const EXTENSION_CSP =
 export const MIN_CHROME_VERSION = '122';
 export const MIN_FIREFOX_VERSION = '150.0';
 
-const VERSION = '0.1.0';
+// B1e §5.2 (R5): one version source — extension/package.json's `version` (the first store version: 1.0.0), read here so
+// the manifest, #38 (runtime.getManifest().version) and the release notes agree by construction. Chrome's rule for a
+// manifest version, kept to the three numbers §5.2 names: each 0–65535, no leading zero. A version that breaks it fails
+// the build here; check-permissions.mjs checks every built manifest against package.json independently.
+export const PACKAGE_JSON = new URL('../package.json', import.meta.url);
+
+/** True when `v` is a version this extension may ship: three dot-separated integers, each 0–65535, no leading zero. */
+export function isReleaseVersion(v) {
+  return typeof v === 'string' && /^(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})\.(0|[1-9]\d{0,4})$/.test(v) && v.split('.').every(n => Number(n) <= 65535);
+}
+
+/** package.json's version; throws when it is missing or not a release version. */
+export function packageVersion(url = PACKAGE_JSON) {
+  const v = JSON.parse(readFileSync(url, 'utf8')).version;
+  if (!isReleaseVersion(v)) throw new Error(`${fileURLToPath(url)}: version must be three integers 0–65535 without leading zeros (B1e §5.2), is ${JSON.stringify(v)}`);
+  return v;
+}
+
+export const VERSION = packageVersion();
 
 function base() {
   return {
@@ -71,10 +92,20 @@ function base() {
   };
 }
 
-/** @param {'chrome' | 'firefox'} browser */
-export function render(browser) {
+/**
+ * B1e §5.3: `key` — the store's public key (scripts/storeKey.mjs), passed only by `node scripts/build.mjs <outDir>
+ * --dev-key`; never by default, never by `verify`, the E2E builds or the release. Chrome only: a key is how Chrome
+ * fixes an unpacked extension's ID; Firefox has no such field (its ID is gecko.id), so a key for it is refused.
+ * @param {'chrome' | 'firefox'} browser
+ * @param {{key?: string}} [options]
+ */
+export function render(browser, {key} = {}) {
+  if (key !== undefined && (browser !== 'chrome' || typeof key !== 'string' || key === '')) {
+    throw new Error(`a manifest key is a non-empty string for Chrome only (B1e §5.3), not ${JSON.stringify(key)} for ${browser}`);
+  }
   if (browser === 'chrome') {
-    return {...base(), minimum_chrome_version: MIN_CHROME_VERSION, background: {service_worker: 'background.js', type: 'module'}};
+    const manifest = {...base(), minimum_chrome_version: MIN_CHROME_VERSION, background: {service_worker: 'background.js', type: 'module'}};
+    return key === undefined ? manifest : {...manifest, key};
   }
   if (browser === 'firefox') {
     return {
```

Modify `extension/scripts/build.mjs`:

```diff
diff --git a/extension/scripts/build.mjs b/extension/scripts/build.mjs
index 10fc23d..da92876 100644
--- a/extension/scripts/build.mjs
+++ b/extension/scripts/build.mjs
@@ -7,19 +7,32 @@
 // (NOCTURA_PRESALE=0 for every vite build, scripts/presaleFlag.mjs), into dist-nopresale/ unless outDir is given; the
 // default is the build with it, into dist/. Either way <outDir>/app.features.json says which it is — next to
 // app.modules.json, never inside a package — for the gates that read the build.
+//
+// B1e §5.3: `--dev-key` writes the store's public key (release/store-key.json, scripts/storeKey.mjs) into the Chrome
+// manifest, so an unpacked install has the store's ID. Only into a directory named on the command line, never dist/ or
+// dist-nopresale/ (the directories verify, the gates and the release read, whose manifests must carry no key); the key
+// file is read before anything is built, and an absent or malformed one fails the build. Firefox's manifest never
+// carries a key.
 import {execFileSync} from 'node:child_process';
 import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
 import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {render} from '../manifest/source.mjs';
 import {LICENCE_PAGE, buildLicencePage} from './licences.mjs';
+import {readStoreKey} from './storeKey.mjs';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
 const args = process.argv.slice(2);
 const presale = !args.includes('--no-presale');
-const dirs = args.filter(a => a !== '--no-presale');
-if (dirs.length > 1 || dirs.some(a => a.startsWith('-'))) throw new Error('usage: node scripts/build.mjs [outDir] [--no-presale]');
+const devKey = args.includes('--dev-key');
+const dirs = args.filter(a => a !== '--no-presale' && a !== '--dev-key');
+const USAGE = 'usage: node scripts/build.mjs [outDir] [--no-presale] | node scripts/build.mjs <outDir> --dev-key [--no-presale]';
+if (dirs.length > 1 || dirs.some(a => a.startsWith('-'))) throw new Error(USAGE);
 const outRoot = dirs[0] ? resolve(dirs[0]) : join(ROOT, presale ? 'dist' : 'dist-nopresale');
+if (devKey && (dirs.length === 0 || ['dist', 'dist-nopresale'].some(d => outRoot === join(ROOT, d)))) {
+  throw new Error(`--dev-key builds only into a directory named on the command line, never dist/ or dist-nopresale/ (B1e §5.3). ${USAGE}`);
+}
+const key = devKey ? readStoreKey().key : undefined;
 const app = join(outRoot, 'app');
 const env = {...process.env, NOCTURA_PRESALE: presale ? '1' : '0'};
 // Written last, removed first: a build that fails part-way leaves no claim about what it built.
@@ -40,6 +53,6 @@ for (const browser of ['chrome', 'firefox']) {
   rmSync(dir, {recursive: true, force: true});
   mkdirSync(dir, {recursive: true});
   cpSync(app, dir, {recursive: true});
-  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(render(browser), null, 2)}\n`);
+  writeFileSync(join(dir, 'manifest.json'), `${JSON.stringify(render(browser, browser === 'chrome' && key !== undefined ? {key} : {}), null, 2)}\n`);
 }
 writeFileSync(features, `${JSON.stringify({presale})}\n`);
```

Modify `extension/scripts/check-permissions.mjs`:

```diff
diff --git a/extension/scripts/check-permissions.mjs b/extension/scripts/check-permissions.mjs
index eb37c34..e45dbef 100644
--- a/extension/scripts/check-permissions.mjs
+++ b/extension/scripts/check-permissions.mjs
@@ -10,11 +10,41 @@
 // its value is worth pinning independent of source.mjs too — REQUIRED_CONNECT_SRC is copied here on
 // purpose, same pattern as check-rpc-methods.mjs's SPEC_ALLOWED against core/solana/rpc.ts's list.
 import {readFileSync} from 'node:fs';
-import {join} from 'node:path';
+import {join, resolve} from 'node:path';
 import {distDir} from './distDir.mjs';
 import {isMain} from './isMain.mjs';
+import {readStoreKey} from './storeKey.mjs';
 import {PERMISSIONS, HOST_PERMISSIONS, EXTENSION_CSP, MIN_CHROME_VERSION, MIN_FIREFOX_VERSION} from '../manifest/source.mjs';
 
+// B1e §5.2 (R5): the version every built manifest must carry — package.json's, read here on its own (not through
+// source.mjs's VERSION, so a constant put back in source.mjs fails here), and the version pattern pinned here too.
+export const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
+export function packageJsonVersion() {
+  return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
+}
+
+/** Every way `manifest.version` is not exactly `want` (package.json's) in the release form. */
+export function versionViolations(manifest, want = packageJsonVersion()) {
+  const got = manifest.version;
+  const out = [];
+  if (typeof want !== 'string' || !VERSION_PATTERN.test(want)) out.push(`package.json version ${JSON.stringify(want)} does not match ${VERSION_PATTERN}`);
+  if (got !== want) out.push(`version is ${JSON.stringify(got)}, want package.json's ${JSON.stringify(want)}`);
+  else if (!VERSION_PATTERN.test(got)) out.push(`version ${JSON.stringify(got)} does not match ${VERSION_PATTERN}`);
+  return out;
+}
+
+/**
+ * B1e §5.3: the manifest `key`. `recorded` undefined (dist/, dist-nopresale/ — what verify, the gates and the release
+ * read): no manifest carries a key. `recorded` = release/store-key.json's {id, key} (a `--dev-key` build): the Chrome
+ * manifest carries exactly that key; Firefox's never carries one.
+ */
+export function keyViolations(manifest, browser, recorded) {
+  const has = Object.hasOwn(manifest, 'key');
+  if (browser !== 'chrome' || recorded === undefined) return has ? [`${browser}: carries a key — only a --dev-key Chrome build may (B1e §5.3)`] : [];
+  if (manifest.key !== recorded.key) return [`chrome: key ${has ? 'differs from' : 'missing, want'} the recorded store key (release/store-key.json, id ${recorded.id})`];
+  return [];
+}
+
 // The one host anything in the extension ever fetches (extension/src/background/deps.ts — RPC
 // reads, JSON reads, the broadcast route, all through the coordinator proxy). No 'self': nothing
 // fetches the extension's own origin. No wallet.noc-tura.io: that is the passkey RP ID, and a
@@ -85,8 +115,8 @@ export function contentScriptViolations(scripts) {
   return scripts.flatMap((got, i) => (norm(got) === norm(REQUIRED_CONTENT_SCRIPTS[i]) ? [] : [`content_scripts[${i}] is ${JSON.stringify(got)}, want ${JSON.stringify(REQUIRED_CONTENT_SCRIPTS[i])}`]));
 }
 
-export function comparePermissions(manifest, browser) {
-  const problems = [];
+export function comparePermissions(manifest, browser, {recorded, version} = {}) {
+  const problems = [...versionViolations(manifest, version), ...keyViolations(manifest, browser, recorded)];
   const want = PERMISSIONS.map(p => p.value).join(',');
   const got = (manifest.permissions ?? []).join(',');
   if (got !== want) problems.push(`permissions differ: ${got}`);
@@ -110,16 +140,27 @@ export function comparePermissions(manifest, browser) {
   return problems;
 }
 
+// CLI: `node scripts/check-permissions.mjs` reads NOCTURA_DIST's build (dist/ or dist-nopresale/: no key allowed);
+// `node scripts/check-permissions.mjs --dev-key <outDir>` reads a --dev-key build against release/store-key.json (absent
+// or malformed: fails).
 if (isMain(import.meta.url)) {
-  const DIST = distDir();
+  const args = process.argv.slice(2);
+  if (args.length !== 0 && (args.length !== 2 || args[0] !== '--dev-key')) throw new Error('usage: node scripts/check-permissions.mjs [--dev-key <outDir>]');
+  const devKey = args.length === 2;
+  const DIST = devKey ? resolve(args[1]) : distDir();
+  const recorded = devKey ? readStoreKey() : undefined;
   let bad = 0;
   for (const browser of ['chrome', 'firefox']) {
     const m = JSON.parse(readFileSync(join(DIST, browser, 'manifest.json'), 'utf8'));
-    for (const p of comparePermissions(m, browser)) {
+    for (const p of comparePermissions(m, browser, {recorded})) {
       console.error(`${browser}: ${p}`);
       bad += 1;
     }
   }
   if (bad) process.exit(1);
-  console.log(`permissions ok (${DIST}): both manifests match manifest/source.mjs`);
+  console.log(
+    devKey
+      ? `permissions ok (${DIST}): both manifests match manifest/source.mjs, version ${packageJsonVersion()}; chrome carries the recorded store key (id ${recorded.id}), firefox none`
+      : `permissions ok (${DIST}): both manifests match manifest/source.mjs, version ${packageJsonVersion()}, no key`,
+  );
 }
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, reproducible, the affected E2E.**

Run: the Step 2 command, plus `src/vault/__tests__/rpId.test.ts` (it imports `source.mjs` through Vite's glob — the new `node:fs` read must work there): `Test Files  4 passed (4)` · `Tests  105 passed | 1 skipped (106)` (storeKey 28 + 1 skipped, check-permissions 54, presaleBuilds 20, rpId 3; the skipped row is the "once recorded" build, which runs only when `release/store-key.json` exists).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `TZ=UTC npm run verify` — exit 0 (it is `rm -rf dist dist-nopresale && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible`):
- `vitest run`: `Test Files  240 passed (240)` · `Tests  5372 passed | 1 skipped (5373)` (the base 0fcf769: `239 passed (239)` · `5318 passed (5318)`; +1 file, +54 run: storeKey 28, check-permissions +25, presaleBuilds +1; +1 skipped);
- `vitest run --config vitest.nopresale.config.ts`: `Test Files  22 passed (22)` · `Tests  550 passed | 25 skipped (575)` (unchanged — no file of this task is in `NOPRESALE_TESTS`);
- `CSP ok: dist/app needs no unsafe-inline or unsafe-eval`, the same for `dist-nopresale/app`; the secrets gate;
- `npm run gates`: `permissions ok (dist): both manifests match manifest/source.mjs, version 1.0.0, no key` and `permissions ok (dist-nopresale): both manifests match manifest/source.mjs, version 1.0.0, no key`; every other gate line unchanged (page bundles, vault isolation, rpc methods, no TGE date, fonts, classes, links, licences, no presale);
- `npm run reproducible`: `reproducible: presale chrome 28 files sha256:dd410738e68eb0f24134433da458908644ffa7f07778688dc328e796ba5e9245`, `presale firefox 28 files sha256:4f16d750f3c31eafd5ab25d7fbe34b259967d32ac583fff09452a1e4917255ca`, `no-presale chrome 28 files sha256:3bfc93f5eaa0c2b110595468438253f46a9e35dd5fdb56d4df209b41cf2836db`, `no-presale firefox 28 files sha256:e8b7ec835cbc9521b35f29542d8c0107d4008d4f437b712105188269b85dddb9` — four builds, each pair equal (the digests are this dry run's; the count, 28, is unchanged — the version changes `manifest.json`, so every digest differs from the base's).

Run the E2E this task touches: `npx playwright test e2e/links.spec.ts --reporter=line` — `4 passed (51.7s)`; `unshare -rn sh -c 'ip link set lo up && npx playwright test e2e/links.spec.ts --reporter=line'` — `4 passed (50.7s)`. (#38 shows `v1.0.0` in both builds.)
Repo-wide: `node scripts/check-no-tge-date.mjs` (repo root) — `no TGE date in 1376 tracked text files`.

No repo-root `src/` or `core/` change: root `tsc` / `jest` and web `verify` are not run.

**The dev-key path end to end (dry-run probe, not a committed test — the store key does not exist yet).** In a fresh `git archive` copy of the commit, with the vector written as `release/store-key.json` (`{id, key}` of `chrome-id-vector.json`):
- `TZ=UTC npx vitest run scripts/__tests__/storeKey.test.mjs scripts/__tests__/check-permissions.test.mjs` — `Test Files  2 passed (2)` · `Tests  81 passed | 2 skipped (83)`: the "once recorded" build row RAN and passed; the two "while absent" rows skipped (the positive control of the `runIf` pair);
- `env -u NODE_ENV node scripts/build.mjs <tmp> --dev-key --no-presale` — exit 0; `node scripts/check-permissions.mjs --dev-key <tmp>` — `permissions ok (<tmp>): both manifests match manifest/source.mjs, version 1.0.0; chrome carries the recorded store key (id gialdecpbdgdgllggmmephkblnejccej), firefox none`; `"key"` occurs once in `chrome/manifest.json`, never in `firefox/manifest.json`;
- `<tmp>/chrome` loaded unpacked in Playwright's Chromium (under `unshare -rn`, noc-tura.io unresolvable): the service worker runs at `chrome-extension://gialdecpbdgdgllggmmephkblnejccej/` — the recorded ID; negative control: the clone's keyless `dist-nopresale/chrome` loads as `bldgjdnieakbdmmhbfbmbpndmfnklaah` (Chrome's path-derived ID).

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1e-2 one version source and the dev-only manifest key — extension/package.json says 1.0.0 and manifest/source.mjs reads it (the constant is gone; a version outside Chrome's rule fails the build); render(browser, {key}) adds a key only when given one, for Chrome only; scripts/storeKey.mjs reads release/store-key.json as exactly {id, key} — canonical base64 of a DER public key and the ID Chrome derives from it; build.mjs <outDir> --dev-key, never into dist/ or dist-nopresale/, reads it before building and fails when absent; check-permissions: every built manifest carries package.json's version, no dist/ or dist-nopresale/ manifest carries a key, and --dev-key <outDir> checks a dev-key build against the record; #38's version line checked in the popup

Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked), `timeout 300`; `tsc`'s own exit code first, then the named tests or gate.** `CP` = `scripts/__tests__/check-permissions.test.mjs` (54), `SK` = `scripts/__tests__/storeKey.test.mjs` (29). `SRC` = `manifest/source.mjs`, `GATE` = `scripts/check-permissions.mjs`, `STK` = `scripts/storeKey.mjs`, `BLD` = `scripts/build.mjs`. "+key" = the copy has the vector written as `release/store-key.json` (so the "once recorded" row runs). A "gate" row builds the store build in the copy (`env -u NODE_ENV node scripts/build.mjs --no-presale`) and runs `NOCTURA_DIST=dist-nopresale node scripts/check-permissions.mjs`; a "dist" row copies the clone's built `dist-nopresale` into the copy and edits it by hand.

| id | the change | named test / gate → observed |
|---|---|---|
| **M-key-default** (spec §5.3) | SRC `return key === undefined ? manifest : {...manifest, key};` → `return {...manifest, key: key ?? 'MIIB'};` | tsc 0; CP `10 failed \| 44 passed (54)` (among them "accepts the rendered manifests", "render adds a key only when given one, for Chrome only"); gate: build 0, `chrome: chrome: carries a key — only a --dev-key Chrome build may (B1e §5.3)`, exit 1 |
| **M-hand-version** (spec §5.2, dist) | `dist-nopresale/chrome/manifest.json` `"version": "1.0.0"` → `"1.0.1"` | control on the unedited copy: `permissions ok (dist-nopresale): …, version 1.0.0, no key`, exit 0; mutant: `chrome: version is "1.0.1", want package.json's "1.0.0"`, exit 1 |
| M-hand-key (dist) | `dist-nopresale/firefox/manifest.json` gains `"key": "MIIB"` | `firefox: firefox: carries a key — only a --dev-key Chrome build may (B1e §5.3)`, exit 1 |
| M-constant-old | SRC `export const VERSION = packageVersion();` → `export const VERSION = '0.1.0';` | tsc 0; CP `20 failed \| 34 passed (54)` (the gate's own package.json read catches the drift in every `comparePermissions` row) |
| M-constant-same | the same, `'1.0.0'` (a constant equal to today's value) | tsc 0; CP `1 failed \| 53 passed (54)` — "both manifests carry package.json's version, which matches the release pattern (no constant)" (the source scan) |
| M-65535 | SRC drop ` && v.split('.').every(n => Number(n) <= 65535)` | tsc 0; CP `1 failed \| 53 passed (54)` — `source.mjs refuses the version "1.0.65536"` |
| M-leading-zero | SRC first group `/^(0\|[1-9]\d{0,4})\.` → `/^(\d{1,5})\.` | tsc 0; CP `1 failed \| 53 passed (54)` — `source.mjs refuses the version "01.0.0"` |
| M-firefox-key | SRC `(browser !== 'chrome' \|\| typeof key` → `(typeof key` | tsc 0; CP `1 failed \| 53 passed (54)` — "render adds a key only when given one, for Chrome only" |
| M-gate-no-key | GATE `return has ? [\`${browser}: carries a key …\`] : [];` → `return [];` | tsc 0; CP `4 failed \| 50 passed (54)` — the dist/dist-nopresale key row, the --dev-key row, both CLI rows |
| M-gate-any-key | GATE `if (manifest.key !== recorded.key) return` → `if (!has) return` | tsc 0; CP `1 failed \| 53 passed (54)` — "a --dev-key build: Chrome's key equals the recorded one …" |
| M-gate-firefox-recorded | GATE `if (browser !== 'chrome' \|\| recorded === undefined)` → `if (recorded === undefined)` | tsc 0; CP `1 failed \| 53 passed (54)` — the same row (Firefox carrying the recorded key) |
| M-gate-version-off | GATE `versionViolations` returns `[]` right after `const out = [];` | tsc 0; CP `3 failed \| 51 passed (54)` — "refuses a hand-edited or missing version …" and both CLI rows |
| M-cli-recorded | GATE `const recorded = devKey ? readStoreKey() : undefined;` → `const recorded = undefined;` | tsc 0; CP `1 failed \| 53 passed (54)` — "--dev-key <outDir> refuses while release/store-key.json is absent" |
| M-id-unchecked | STK drop the `extensionId(der) !== id` line | tsc 0; SK `1 failed \| 27 passed \| 1 skipped (29)` — "refuses a well-formed id that is not the key's own ID" |
| M-id-derive | STK `.subarray(0, 16)` → `.subarray(16, 32)` | tsc 0; SK `2 failed \| 26 passed \| 1 skipped (29)` — "derives the ID Chromium gives the key (the observed vector) …", "reads a well-formed file …" |
| M-canonical | STK drop ` \|\| Buffer.from(key, 'base64').toString('base64') !== key` | tsc 0; SK `1 failed \| 27 passed \| 1 skipped (29)` — "refuses a key with non-canonical padding bits" |
| M-fields | STK `names.join(',') !== 'id,key'` → `!names.includes('id') \|\| !names.includes('key')` | tsc 0; SK `1 failed \| 27 passed \| 1 skipped (29)` — "refuses an extra field" |
| M-spki | STK drop `createPublicKey({key: der, format: 'der', type: 'spki'});` | tsc 0; SK `1 failed \| 27 passed \| 1 skipped (29)` — "refuses a key with base64 of bytes that are no public key" |
| M-build-guard | BLD the `--dev-key` directory guard's condition → `false` | tsc 0; SK `1 failed \| 27 passed \| 1 skipped (29)` — "refuses without a directory, or with dist/ or dist-nopresale/, before reading the key or building" |
| M-build-late-read | BLD the `readStoreKey()` line moved from before the vite builds to just before the per-browser loop | tsc 0; SK `1 failed \| 27 passed \| 1 skipped (29)` — "refuses while release/store-key.json is absent … and builds nothing" (`expected true to be false`: the out directory exists) |
| M-build-chrome-nokey (+key) | BLD `render(browser, browser === 'chrome' && key !== undefined ? {key} : {})` → `render(browser, {})` | tsc 0; SK `1 failed \| 27 passed \| 1 skipped (29)` — "once recorded: the Chrome manifest carries the recorded key …" (`expected undefined to be 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBC…'`) |
| M-build-firefox-key (+key) | BLD → `render(browser, key !== undefined ? {key} : {})` | tsc 0; SK `1 failed \| 27 passed \| 1 skipped (29)` — the same row (`expected 1 to be +0`: `render` refuses Firefox's key, the build exits 1) |
| M-about-version (E2E) | `src/app/screens/About.tsx` `v{m.platform.version()}` → `v{m.platform.version() && '0.1.0'}` | tsc 0; build 0; `npx playwright test e2e/links.spec.ts -g 'no-presale build.*#38'` — `1 failed`: `Expected: "v1.0.0"` · `Received: "v0.1.0"` |

(One invalid mutant, not counted: `v{'0.1.0'}` on About.tsx — `tsc` 2, `m` unused; replaced by M-about-version's form.)

#### Notes for the executor (Task 1)

- **Ruling: the store-key rule — exactly `{id, key}`; `key` one line of canonical base64 (`/^[A-Za-z0-9+/]+={0,2}$/` and re-encoding gives the same text) of bytes Node's `createPublicKey({format: 'der', type: 'spki'})` accepts; `id` 32 letters a–p AND equal to `extensionId(key)`.** Why: §5.3 says only `{id, key}`; the strongest check that needs nothing but the file is the one Chrome itself applies — the ID is a function of the key — so a key pasted from another item, a truncated key or an ID copied from elsewhere fails at the record, not as an unpacked install with a silently different ID. Not required: an RSA key or a size (the store issues RSA-2048 today; requiring it would add nothing the ID match does not, and could refuse a future store key). PEM armour and line breaks are refused with a hint, since the dashboard shows the key as PEM. Cost if wrong: the follow-up commit of §7 step 7 fails until the file is written as the rule says — fail closed.
- **Ruling: the derivation is proved by Chromium, not by a second implementation.** The dry run loaded an unpacked extension carrying a fresh key in Playwright's Chromium 153.0.8010.12 and committed the key and the ID Chromium reported (`chrome-id-vector.json`; the private key was never written to disk). The same vector, written as `store-key.json` in a scratch copy, then drove the whole dev-key path and Chromium loaded the built package under exactly that ID (Step 4's probe). Cost if wrong: none found — and if Chrome ever changed its derivation, every existing extension ID would change with it.
- **Ruling: `--dev-key` builds only into a directory named on the command line, never `dist/` or `dist-nopresale/`** (resolved paths, so `./dist/` and an absolute `dist-nopresale` are refused too), and the key is read before the first vite build. Why: those two directories are what `verify`, the gates, the E2E and the release read, and their manifests must carry no key (§5.3); refusing up front keeps a dev-key build from ever replacing them, and the gate catches it if one ever did. Cost if wrong: a developer types an output directory.
- **Ruling: the gate learns the recorded key two ways — an argument of the exported function (`comparePermissions(m, browser, {recorded})`, so tests use a temp file through `readStoreKey(path)`), and a CLI form `node scripts/check-permissions.mjs --dev-key <outDir>` that reads the fixed `STORE_KEY_PATH`.** `npm run gates` keeps its form (NOCTURA_DIST: `dist` / `dist-nopresale` only, `recorded` undefined → no key allowed in either browser). Cost if wrong: none.
- **Ruling: Firefox never gets a key.** `render('firefox', {key})` throws; `build.mjs` passes the key to Chrome's `render` only; the gate fails a Firefox manifest that carries one, with or without a record. Why: `key` is how Chrome fixes an unpacked extension's ID; Firefox's ID is `gecko.id`, and Firefox / AMO is out of scope (§8). Tested (CP "render adds a key …", the --dev-key row's Firefox lines) and mutated (M-firefox-key, M-gate-firefox-recorded, M-build-firefox-key).
- **Ruling: `source.mjs` checks the version harder than the gate's pattern** — `isReleaseVersion`: three integers, each 0–65535, no leading zero (Chrome's own manifest rule) — so a version Chrome would refuse fails the build; the gate keeps §5.2's `^\d+\.\d+\.\d+$` and its own read of package.json, independent of `source.mjs` (M-constant-old shows why: a constant put back in `source.mjs` fails 20 gate rows). Cost if wrong: none (stricter than the spec).
- **Ruling: "no constant" is also a source test** (`source.mjs` contains no `version: '` and no `\bVERSION = '`): a constant equal to package.json's version would pass every value check today and drift at the next bump — M-constant-same is red only through it.
- **Ruling: the "store key recorded" behaviour is a `runIf` pair, not a fake file at the fixed path.** While `release/store-key.json` is absent, the build and the CLI rows assert the refusal (and that the build created nothing); once §7 step 7 commits the file, the same test files instead build into a temp directory with `--dev-key` and assert the recorded key in Chrome's manifest, none in Firefox's, and the gate green against the file. Exactly one row of each pair runs: today `1 skipped` in each of `storeKey.test.mjs` and (after step 7) `check-permissions.test.mjs`. The positive control of the pair is Step 4's probe (`81 passed | 2 skipped` with the file present). Cost if wrong: none; no test ever writes the fixed path.
- **Ruling: `0.1.0` in the component tests stays** — `harness.tsx` / `Switcher.test.tsx` inject a fake `Platform.version` and `Settings.test.tsx` checks the fake's value is rendered; none reads the manifest. The real chain (package.json → manifest → `getManifest()` → #38) is checked in the browser instead: `links.spec.ts`'s #38 row reads package.json on its own and expects `v<version>` in `.app-about-card .noc-mono`, both builds (M-about-version).
- **Ruling: `package-lock.json` follows** (`npm install --package-lock-only --ignore-scripts --offline` with npm 11.6.2 — CI's — adds exactly `"version": "1.0.0"` at the top and in `packages[""]`), so the lockfile writer CI pins sees no drift.
- **Deviation (stated): the brief's "a `--dev-key` build's key equals the recorded one" is proved in the committed tests through the exported function with a temp file, and end to end only in the dry run's probe** (the fixed path cannot hold a file before §7 step 7; the brief's own resolution). After step 7 the `runIf` row makes it a committed end-to-end test.
- **Deviation (stated): Playwright ran `e2e/links.spec.ts` only** — the one spec this task edits; nothing else on a screen changed (the version string on #38 and #31's meta come from `getManifest()` unchanged).
- **For the next tasks:** Task 7 — read the version with `packageVersion()` (or `VERSION`) from `manifest/source.mjs`; never pass `--dev-key` anywhere in `release:chrome`; the checklist carries, verbatim or close: "An unpacked install built with `node scripts/build.mjs <outDir> --dev-key` has the store's ID, so it and the store install cannot coexist in one Chrome profile (B1e §5.3)." and §7 step 7's record format: "`extension/release/store-key.json`: `{"id": "<32 letters a–p>", "key": "<the public key: one line of base64, without the BEGIN / END lines>"}` — `node scripts/check-permissions.mjs --dev-key <outDir>` after a `--dev-key` build confirms it; a file whose id is not the key's own is refused." Task 2 — the package's `manifest.json` now carries `"version": "1.0.0"`; the reproducible digests above are this commit's.
- **Dry run:** clone `dry/b1e2`, commit `cd179af` on 0fcf769. Every run above is on that commit (red on 0fcf769 + Step 1's files). No contact with any noc-tura.io host: the Chromium probes ran under `unshare -rn` with noc-tura.io unresolvable.

#### Spec rev 2.7 lines

- §5.2: `source.mjs` also refuses (the build fails) a package.json version Chrome would refuse — each of the three numbers 0–65535, no leading zero; the gate keeps `^\d+\.\d+\.\d+$` and its own read of package.json.
- §5.3: `store-key.json` is refused unless it is exactly `{id, key}`, `key` one line of canonical base64 of a DER SubjectPublicKeyInfo (no PEM armour), and `id` the ID Chrome derives from `key` (sha256 of the DER, first 16 bytes, hex digits as a–p — a Chromium-observed vector is committed).
- §5.3: `--dev-key` builds only into a directory named on the command line, never `dist/` or `dist-nopresale/`, and reads the key before building; `render` refuses a key for Firefox; the gate's dev-key form is `node scripts/check-permissions.mjs --dev-key <outDir>`.


### Task 2: The STORE zip — `scripts/zip-store.mjs`, a hand-written uncompressed zip exactly as spec §5.4 fixes it (every regular file of the package, paths relative with `/`, sorted by the C collation, no directory entries, version 20, flags 0, method 0, DOS time 0 / date `0x0021`, CRC-32 by `zlib.crc32`, sizes in both headers, attributes 0, no extra field, no comment, no zip64), no dependency (R6); a pure function and a CLI; tests that read the zip back with an INDEPENDENT reader written for the tests (from the end record, its own CRC-32, never the writer's code), two runs one sha256, a changed file changes it, a non-ASCII path, a symlink, an empty directory, the entry and 4 GiB limits; the real store package zipped twice

**Spec:** B1e §5.4 (I8, R6) in full — the format, the reason (STORE has no compressor, so "two builds, one zip, one sha256" holds on any machine), the tests it names (an independent reader, two runs one sha256, a changed file changes it, a non-ASCII path refused); §5.1 step 5 (the zip written twice, the two sha256 equal — Task 7 calls this task's function); §10. **Not here:** `release:chrome` and the release notes (Task 7), the version (Task 1).

**Files:**
- Create: `extension/scripts/zip-store.mjs` (the writer and its CLI)
- Create (tests): `extension/scripts/__tests__/zip-store.test.mjs` (19), `extension/scripts/__tests__/storeZipReader.mjs` (the independent reader — a test helper, not a test file: vitest's `scripts/**/*.test.mjs` does not collect it)
- Modify: nothing. (`package.json` gains no script: Task 7's `release:chrome` calls `zipStore`; the CLI is for a reviewer reproducing the hash by hand.)

**Interfaces:**
- Consumes: `isMain` (`scripts/isMain.mjs`); `node:zlib` `crc32` (Node ≥ 22.2; the package's `engines` is ≥ 22.12). Nothing else of the repository.
- Produces (`extension/scripts/zip-store.mjs`):
  ```js
  export const ZIP_VERSION: 20;            // version made by (host 0) and version needed
  export const DOS_TIME: 0;
  export const DOS_DATE: 0x0021;           // 1980-01-01
  export const MAX_ENTRIES: 65534;         // 0xFFFF is zip64's sentinel
  export const MAX_FIELD: 0xfffffffe;      // the largest 32-bit size / offset; 0xFFFFFFFF is zip64's sentinel
  export const LOCAL_HEADER: 30; export const CENTRAL_HEADER: 46; export const END_RECORD: 22;
  export function pathProblem(path: string): string | null;   // null = a path the zip may carry
  export function zipInputs(root: string): {path: string, bytes: Buffer}[];   // the walk: sorted, regular files only; throws
  export function zipPlan(entries: {path: string, size: number}[]): {offsets: number[], centralOffset: number, centralSize: number, length: number};  // throws
  export function zipFiles(files: {path: string, bytes: Uint8Array}[]): Buffer;   // throws
  export const zipStore: (root: string) => Buffer;            // = zipFiles(zipInputs(root))
  ```
  Every refusal is a thrown `Error` whose message starts `zip-store: `. CLI: `node scripts/zip-store.mjs <dir> <out.zip>` — exit 0 and one line `zip <out.zip>: <N> entries, <B> bytes, sha256:<hex>`; exit 1 on a refused package (the message on stderr), an output inside `<dir>`, or an output that exists (`wx`: never overwritten); exit 2 and `usage: node scripts/zip-store.mjs <dir> <out.zip>` on wrong arguments.
- Produces (`extension/scripts/__tests__/storeZipReader.mjs`, tests only): `crc32Of(bytes): number` (table-driven, its own), `readStoreZip(zip): {path, bytes, crc, offset}[]` (throws `store zip: …` on any byte §5.4 does not write). No import at all (a source test).
- **What later tasks rely on:** Task 7 — `zipStore(<verify's dist-nopresale/chrome>)` called twice, the two sha256 compared (§5.1 step 5); `release-chrome.mjs` writes the buffer itself (its own path, git-ignored) — if it writes through the CLI instead, the CLI refuses an existing output, so a second run must remove the first zip first. A refusal (`zip-store: …`) must stop the release before anything is written. The store package today: **28 entries, 1 541 854 bytes, sha256 `6171a4d4c338b749a66c4e72d834bd59be88a4972b187d713cc0830523dac51e`** for the package whose file digest is `ed33e05f…29db` (0fcf769's tree + this task; Task 1's version change alters `manifest.json` and therefore both hashes — the count, 28, is the check).

**The rule, stated once.** The zip carries a file's path and its bytes and nothing else of the file system — no mtime, no mode, no owner, no directory, no order but the C collation of the full paths — so the same package gives the same bytes on any machine and any Node. Everything the format cannot say without a choice (a non-ASCII name, a symlink, a FIFO, a name the zip would carry ambiguously, a count or a size at zip64's sentinels) is refused, never written some way.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/storeZipReader.mjs`:

```js
// B1e §5.4: an independent reader of the store zip, for the tests only — it never imports scripts/zip-store.mjs (a
// source test in zip-store.test.mjs holds it to that) and computes its own CRC-32. It parses from the END: the end
// record, then the central directory it points to, then each local header the directory points to; every field §5.4
// fixes is checked, and every byte of the file must belong to exactly one record (no gap, no overlap, nothing after the
// end record). Anything else throws, naming the field.

const SIG_LOCAL = 0x04034b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_END = 0x06054b50;

const TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** CRC-32 (ISO-HDLC, the zip one), table-driven, written here — not zlib's. */
export function crc32Of(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * The entries of a §5.4 store zip, `{path, bytes, crc, offset}` in file order. Throws on anything §5.4 does not write.
 */
export function readStoreZip(zip) {
  const buf = Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength);
  const fail = what => {
    throw new Error(`store zip: ${what}`);
  };
  const expect = (what, got, want) => {
    if (got !== want) fail(`${what} is ${got}, expected ${want}`);
  };
  if (buf.length < 22) fail(`${buf.length} bytes — shorter than an end record`);

  // The end record: searched for backwards over the largest comment a zip may carry, then required to be the last 22 bytes.
  let end = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i -= 1) {
    if (buf.readUInt32LE(i) === SIG_END) {
      end = i;
      break;
    }
  }
  if (end < 0) fail('no end record');
  expect('the end record offset', end, buf.length - 22);
  expect('the end record: this disk', buf.readUInt16LE(end + 4), 0);
  expect("the end record: the central directory's disk", buf.readUInt16LE(end + 6), 0);
  const count = buf.readUInt16LE(end + 8);
  expect('the end record: total entries', buf.readUInt16LE(end + 10), count);
  const cdSize = buf.readUInt32LE(end + 12);
  const cdOffset = buf.readUInt32LE(end + 16);
  expect('the end record: comment length', buf.readUInt16LE(end + 20), 0);
  if (count === 0xffff || cdSize === 0xffffffff || cdOffset === 0xffffffff) fail('a zip64 sentinel in the end record');
  expect('the central directory ends at', cdOffset + cdSize, end);

  // The central directory.
  const central = [];
  let at = cdOffset;
  for (let i = 0; i < count; i += 1) {
    if (at + 46 > end) fail(`central entry ${i} runs past the end record`);
    expect(`central entry ${i}: signature`, buf.readUInt32LE(at), SIG_CENTRAL);
    expect(`central entry ${i}: version made by`, buf.readUInt16LE(at + 4), 20);
    expect(`central entry ${i}: version needed`, buf.readUInt16LE(at + 6), 20);
    expect(`central entry ${i}: flags`, buf.readUInt16LE(at + 8), 0);
    expect(`central entry ${i}: method`, buf.readUInt16LE(at + 10), 0);
    expect(`central entry ${i}: DOS time`, buf.readUInt16LE(at + 12), 0);
    expect(`central entry ${i}: DOS date`, buf.readUInt16LE(at + 14), 0x0021);
    const crc = buf.readUInt32LE(at + 16);
    const csize = buf.readUInt32LE(at + 20);
    const usize = buf.readUInt32LE(at + 24);
    expect(`central entry ${i}: compressed size`, csize, usize);
    const nameLen = buf.readUInt16LE(at + 28);
    expect(`central entry ${i}: extra length`, buf.readUInt16LE(at + 30), 0);
    expect(`central entry ${i}: comment length`, buf.readUInt16LE(at + 32), 0);
    expect(`central entry ${i}: disk`, buf.readUInt16LE(at + 34), 0);
    expect(`central entry ${i}: internal attributes`, buf.readUInt16LE(at + 36), 0);
    expect(`central entry ${i}: external attributes`, buf.readUInt32LE(at + 38), 0);
    const offset = buf.readUInt32LE(at + 42);
    const nameBytes = buf.subarray(at + 46, at + 46 + nameLen);
    if (nameBytes.length !== nameLen || at + 46 + nameLen > end) fail(`central entry ${i}: its name runs past the end record`);
    for (const b of nameBytes) if (b < 0x20 || b > 0x7e) fail(`central entry ${i}: a name byte 0x${b.toString(16)} is not printable ASCII`);
    const path = nameBytes.toString('latin1');
    if (path === '' || path.endsWith('/')) fail(`central entry ${i}: ${JSON.stringify(path)} is a directory entry`);
    if (path.includes('\\') || path.split('/').some(s => s === '' || s === '.' || s === '..')) fail(`central entry ${i}: ${JSON.stringify(path)} is not a plain relative path`);
    central.push({path, crc, size: usize, offset});
    at += 46 + nameLen;
  }
  expect('the central directory size as parsed', at - cdOffset, cdSize);

  // Order: strictly increasing by bytes (the C collation) — sorted, and no path twice.
  for (let i = 1; i < central.length; i += 1) {
    const a = Buffer.from(central[i - 1].path, 'latin1');
    const b = Buffer.from(central[i].path, 'latin1');
    if (Buffer.compare(a, b) >= 0) fail(`${JSON.stringify(central[i].path)} is not after ${JSON.stringify(central[i - 1].path)} in byte order`);
  }

  // The local headers, in the directory's order, back to back from byte 0 to the central directory.
  let pos = 0;
  const entries = central.map((c, i) => {
    expect(`local entry ${i} (${c.path}): offset`, c.offset, pos);
    if (pos + 30 > cdOffset) fail(`local entry ${i} runs into the central directory`);
    expect(`local entry ${i}: signature`, buf.readUInt32LE(pos), SIG_LOCAL);
    expect(`local entry ${i}: version needed`, buf.readUInt16LE(pos + 4), 20);
    expect(`local entry ${i}: flags`, buf.readUInt16LE(pos + 6), 0);
    expect(`local entry ${i}: method`, buf.readUInt16LE(pos + 8), 0);
    expect(`local entry ${i}: DOS time`, buf.readUInt16LE(pos + 10), 0);
    expect(`local entry ${i}: DOS date`, buf.readUInt16LE(pos + 12), 0x0021);
    expect(`local entry ${i}: CRC-32`, buf.readUInt32LE(pos + 14), c.crc);
    expect(`local entry ${i}: compressed size`, buf.readUInt32LE(pos + 18), c.size);
    expect(`local entry ${i}: uncompressed size`, buf.readUInt32LE(pos + 22), c.size);
    const nameLen = buf.readUInt16LE(pos + 26);
    expect(`local entry ${i}: extra length`, buf.readUInt16LE(pos + 28), 0);
    expect(`local entry ${i}: name`, buf.subarray(pos + 30, pos + 30 + nameLen).toString('latin1'), c.path);
    const start = pos + 30 + nameLen;
    if (start + c.size > cdOffset) fail(`local entry ${i}: its data runs into the central directory`);
    const bytes = Buffer.from(buf.subarray(start, start + c.size));
    expect(`local entry ${i} (${c.path}): the CRC-32 of its data`, crc32Of(bytes), c.crc);
    pos = start + c.size;
    return {path: c.path, bytes, crc: c.crc, offset: c.offset};
  });
  expect('the local records end at', pos, cdOffset);
  return entries;
}
```

Create `extension/scripts/__tests__/zip-store.test.mjs`:

```js
import {createHash} from 'node:crypto';
import {spawnSync, execFileSync} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, symlinkSync, utimesSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {crc32} from 'node:zlib';
import {MAX_ENTRIES, MAX_FIELD, zipFiles, zipInputs, zipPlan, zipStore} from '../zip-store.mjs';
import {crc32Of, readStoreZip} from './storeZipReader.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** The package as the file system holds it, walked here (not by the writer): every regular file, path → bytes. */
function filesOf(dir, base = dir, out = new Map()) {
  for (const d of readdirSync(dir, {withFileTypes: true})) {
    const p = join(dir, d.name);
    if (d.isDirectory()) filesOf(p, base, out);
    else out.set(p.slice(base.length + 1).split('\\').join('/'), readFileSync(p));
  }
  return out;
}

/** The C collation of the paths, by their bytes. */
const cOrder = paths => [...paths].sort((a, b) => Buffer.compare(Buffer.from(a, 'latin1'), Buffer.from(b, 'latin1')));

/** Every byte value, so a text-mode or encoding slip shows. */
const ALL_BYTES = Buffer.from(Array.from({length: 256}, (_, i) => i));

// B1e §5.4 (I8, R6): the store zip — every field §5.4 fixes, read back by an independent reader from the end record.
describe('the STORE zip (B1e §5.4)', () => {
  let tmp;
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'zip-store-test-'));
  });
  afterEach(() => {
    rmSync(tmp, {recursive: true, force: true});
  });
  const tree = (name, files) => {
    const dir = join(tmp, name);
    mkdirSync(dir, {recursive: true});
    for (const [rel, bytes] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), {recursive: true});
      writeFileSync(join(dir, rel), bytes);
    }
    return dir;
  };
  // A tree whose C order differs from a per-directory walk ('a.txt' sorts before 'a/b'; 'B' and 'Z/…' before 'a'), with
  // an empty file and a file of every byte value.
  const TRAP = {
    'a/b': 'in a\n',
    'a.txt': 'beside a\n',
    'a-b': 'dash\n',
    B: 'upper\n',
    'Z/y/deep.json': '{"k":1}\n',
    _x: '',
    'bin/all.bin': ALL_BYTES,
    'manifest.json': '{"manifest_version":3}\n',
  };
  const TRAP_ORDER = ['B', 'Z/y/deep.json', '_x', 'a-b', 'a.txt', 'a/b', 'bin/all.bin', 'manifest.json'];

  describe('the independent reader is itself a check', () => {
    it('computes the standard CRC-32 check value and agrees with zlib on every byte value', () => {
      expect(crc32Of(Buffer.from('123456789'))).toBe(0xcbf43926);
      expect(crc32Of(ALL_BYTES)).toBe(crc32(ALL_BYTES) >>> 0);
      expect(crc32Of(Buffer.alloc(0))).toBe(0);
    });

    it('never imports the writer or zlib', () => {
      const src = readFileSync(join(HERE, 'storeZipReader.mjs'), 'utf8');
      expect(src).not.toMatch(/^\s*import\b|\bimport\s*\(|\brequire\s*\(/m);
    });

    // Each a single field of a valid zip changed — the reader must refuse every one (negative controls), and the unchanged
    // zip must pass (the positive one).
    it('refuses a zip with any one field §5.4 fixes changed', () => {
      const good = zipStore(tree('p', {'a.txt': 'hi\n', 'b/c.txt': 'there\n'}));
      expect(readStoreZip(good).map(e => e.path)).toEqual(['a.txt', 'b/c.txt']);
      const lh = 0; // the first local header
      const ch = good.readUInt32LE(good.length - 22 + 16); // the first central header
      const patch = (off, bytes) => {
        const z = Buffer.from(good);
        z.set(bytes, off);
        return z;
      };
      const u16 = v => [v & 0xff, v >> 8];
      const cases = [
        ['local method 8', patch(lh + 8, u16(8)), /local entry 0: method is 8/],
        ['central method 8', patch(ch + 10, u16(8)), /central entry 0: method is 8/],
        ['local flags 0x0008 (a data descriptor)', patch(lh + 6, u16(8)), /local entry 0: flags/],
        ['central flags 0x0800 (UTF-8)', patch(ch + 8, u16(0x800)), /central entry 0: flags/],
        ['local DOS date 0', patch(lh + 12, u16(0)), /local entry 0: DOS date is 0/],
        ['central DOS time 1', patch(ch + 12, u16(1)), /central entry 0: DOS time is 1/],
        ['central version made by 0x0314 (Unix)', patch(ch + 4, u16(0x314)), /version made by is 788/],
        ['local version 10', patch(lh + 4, u16(10)), /local entry 0: version needed is 10/],
        ['central external attributes 0x81a40000', patch(ch + 38, [0, 0, 0xa4, 0x81]), /external attributes/],
        ['local CRC flipped', patch(lh + 14, [good[lh + 14] ^ 1]), /local entry 0: CRC-32/],
        ['both CRCs flipped alike', patch(ch + 16, [good[ch + 16] ^ 1]).fill(good[lh + 14] ^ 1, lh + 14, lh + 15), /the CRC-32 of its data/],
        ['a data byte changed', patch(lh + 30 + 5, [0x48]), /the CRC-32 of its data/],
        ['an archive comment', Buffer.concat([patch(good.length - 2, u16(3)), Buffer.from('abc')]), /end record offset/],
        ['bytes after the end record', Buffer.concat([good, Buffer.from([0])]), /end record offset/],
        ['the central offset off by one', patch(good.length - 22 + 16, [good[good.length - 22 + 16] + 1]), /central directory ends at/],
      ];
      for (const [what, zip, error] of cases) expect(() => readStoreZip(zip), what).toThrow(error);
    });
  });

  it('one file: exactly the bytes §5.4 fixes, field by field', () => {
    const hex = [
      // local header: signature, version 20, flags 0, method 0, DOS time 0, DOS date 0x0021, CRC-32, sizes 3 and 3, name 5, extra 0
      '504b0304', '1400', '0000', '0000', '0000', '2100', '7a7a6fed', '03000000', '03000000', '0500', '0000',
      '612e747874', // a.txt
      '68690a', // hi\n
      // central header: signature, made by 20 (host 0), needed 20, flags, method, time, date, CRC-32, sizes, name 5, extra 0,
      // comment 0, disk 0, internal 0, external 0, local offset 0
      '504b0102', '1400', '1400', '0000', '0000', '0000', '2100', '7a7a6fed', '03000000', '03000000', '0500', '0000', '0000',
      '0000', '0000', '00000000', '00000000', '612e747874',
      // end record: signature, disk 0, central directory's disk 0, 1 and 1 entries, central size 51, central offset 38, comment 0
      '504b0506', '0000', '0000', '0100', '0100', '33000000', '26000000', '0000',
    ].join('');
    expect(crc32Of(Buffer.from('hi\n'))).toBe(0xed6f7a7a);
    expect(zipStore(tree('one', {'a.txt': 'hi\n'})).toString('hex')).toBe(hex);
  });

  it('holds every file of the package — in the C collation, no directory entry, each entry byte for byte with its CRC', () => {
    const dir = tree('pkg', TRAP);
    const entries = readStoreZip(zipStore(dir));
    const disk = filesOf(dir);
    expect(entries.map(e => e.path)).toEqual(TRAP_ORDER);
    expect(entries.map(e => e.path)).toEqual(cOrder(disk.keys()));
    for (const e of entries) {
      expect(e.bytes.equals(disk.get(e.path)), e.path).toBe(true);
      expect(e.crc, e.path).toBe(crc32Of(disk.get(e.path)));
    }
  });

  it('two runs give one sha256; so does a copy with other mtimes, modes and creation order', () => {
    const a = tree('a', TRAP);
    const first = zipStore(a);
    expect(sha256(zipStore(a))).toBe(sha256(first));
    const b = tree('b', Object.fromEntries(Object.entries(TRAP).reverse()));
    for (const rel of Object.keys(TRAP)) {
      utimesSync(join(b, rel), new Date('2031-07-04T12:34:56Z'), new Date('2031-07-04T12:34:56Z'));
      chmodSync(join(b, rel), 0o751);
    }
    chmodSync(join(b, 'bin'), 0o700);
    expect(sha256(zipStore(b))).toBe(sha256(first));
  });

  it('a changed byte, a renamed file or an added empty file changes the sha256 (positive controls)', () => {
    const base = sha256(zipStore(tree('base', TRAP)));
    const changed = tree('changed', {...TRAP, 'a.txt': 'beside A\n'});
    expect(sha256(zipStore(changed))).not.toBe(base);
    expect(readStoreZip(zipStore(changed)).find(e => e.path === 'a.txt').bytes.toString()).toBe('beside A\n');
    const renamed = tree('renamed', TRAP);
    renameSync(join(renamed, 'a-b'), join(renamed, 'a-c'));
    expect(sha256(zipStore(renamed))).not.toBe(base);
    const added = tree('added', {...TRAP, 'empty.txt': ''});
    expect(sha256(zipStore(added))).not.toBe(base);
    expect(readStoreZip(zipStore(added)).map(e => e.path)).toContain('empty.txt');
  });

  it('an empty directory has no entry: it disappears, and the zip equals the tree without it', () => {
    const without = zipStore(tree('without', TRAP));
    const withEmpty = tree('with', TRAP);
    mkdirSync(join(withEmpty, 'empty/nested/deeper'), {recursive: true});
    mkdirSync(join(withEmpty, 'Z/y/hollow'));
    const zip = zipStore(withEmpty);
    expect(zip.equals(without)).toBe(true);
    expect(readStoreZip(zip).some(e => e.path.startsWith('empty') || e.path.includes('hollow'))).toBe(false);
  });

  it('refuses a directory that holds no file at all, and a root that is not a directory', () => {
    const hollow = join(tmp, 'hollow');
    mkdirSync(join(hollow, 'a/b'), {recursive: true});
    expect(() => zipStore(hollow)).toThrow(/holds no file/);
    const file = join(tmp, 'plain.txt');
    writeFileSync(file, 'x');
    expect(() => zipStore(file)).toThrow(/is not a directory/);
    const real = tree('real', {'a.txt': 'x'});
    symlinkSync(real, join(tmp, 'link'));
    expect(() => zipStore(join(tmp, 'link'))).toThrow(/is not a directory/);
    expect(readStoreZip(zipStore(real)).map(e => e.path)).toEqual(['a.txt']);
  });

  it('refuses a non-ASCII path on disk — and passes the same tree with an ASCII name', () => {
    for (const name of ['caf\u00e9.txt', 'a\u00a0b.txt', 'dir\u2010x/a.txt', '\u0430pp.js']) {
      const dir = tree(`n${createHash('md5').update(name).digest('hex')}`, {...TRAP, [name]: 'x'});
      expect(() => zipStore(dir), name).toThrow(/is not printable ASCII/);
    }
    expect(() => zipStore(tree('ascii', {...TRAP, 'cafe.txt': 'x'}))).not.toThrow();
  });

  it('refuses every path that is not printable ASCII or not a plain relative path', () => {
    const bad = ['', 'a\tb', 'a\x7fb', 'a\nb', 'a\\b', '/abs', '../x', 'a/../b', 'a//b', './a', 'a/./b', 'a/', 'caf\u00e9'];
    for (const path of bad) expect(() => zipFiles([{path, bytes: Buffer.from('x')}]), JSON.stringify(path)).toThrow(/the path/);
    for (const path of ['a', 'a b/c d.txt', '~!@#$%^&()-_=+[]{};,\'`.txt']) expect(() => zipFiles([{path, bytes: Buffer.alloc(0)}]), path).not.toThrow();
  });

  it('refuses a symlink (to a file, to a directory, dangling) and a FIFO, naming it — the same tree without passes', () => {
    const makers = {
      'file symlink': d => symlinkSync(join(d, 'a.txt'), join(d, 'link.txt')),
      'directory symlink': d => symlinkSync(join(d, 'a'), join(d, 'linkdir')),
      'dangling symlink': d => symlinkSync(join(d, 'nowhere'), join(d, 'gone')),
      FIFO: d => execFileSync('mkfifo', [join(d, 'a', 'pipe')]),
    };
    for (const [what, make] of Object.entries(makers)) {
      const d = tree(what.replace(/ /g, '-'), TRAP);
      expect(() => zipStore(d), `${what} control`).not.toThrow();
      make(d);
      expect(() => zipStore(d), what).toThrow(/is not a regular file or a directory/);
    }
    const d = tree('named', TRAP);
    symlinkSync(join(d, 'a.txt'), join(d, 'Z', 'evil'));
    expect(() => zipStore(d)).toThrow('zip-store: "Z/evil" is not a regular file or a directory (a symlink)');
  });

  it('refuses files that are unsorted or repeated (the in-memory form)', () => {
    const f = path => ({path, bytes: Buffer.from(path)});
    expect(() => zipFiles([f('b'), f('a')])).toThrow(/out of order or repeated/);
    expect(() => zipFiles([f('a'), f('a')])).toThrow(/out of order or repeated/);
    expect(() => zipFiles([f('a/b'), f('a.txt')])).toThrow(/out of order or repeated/);
    expect(readStoreZip(zipFiles([f('a.txt'), f('a/b')])).map(e => e.path)).toEqual(['a.txt', 'a/b']);
  });

  it(`holds ${MAX_ENTRIES} entries, and refuses one more (zip64's 0xFFFF sentinel)`, () => {
    expect(MAX_ENTRIES).toBe(65534);
    const many = n => Array.from({length: n}, (_, i) => ({path: `f/${String(i).padStart(5, '0')}`, bytes: Buffer.alloc(0)}));
    const entries = readStoreZip(zipFiles(many(65534)));
    expect(entries.length).toBe(65534);
    expect(entries.at(-1).path).toBe('f/65533');
    expect(() => zipFiles(many(65535))).toThrow('zip-store: 65535 entries — more than 65534 needs zip64');
  });

  it('refuses any size or offset that would need zip64 (4 GiB), from the plan alone', () => {
    expect(MAX_FIELD).toBe(0xfffffffe);
    expect(() => zipPlan([{path: 'a', size: 0xffffffff}])).toThrow(/is 4294967295 bytes — needs zip64/);
    expect(() => zipPlan([{path: 'a', size: 0xfffffffe}])).toThrow(/the central directory starts at 4294967325 — needs zip64/);
    // The largest single file: its data ends where the central directory may still start.
    const fits = zipPlan([{path: 'a', size: 0xfffffffe - 31}]);
    expect(fits.centralOffset).toBe(0xfffffffe);
    expect(fits.length).toBe(0xfffffffe + 47 + 22);
    expect(() => zipPlan([{path: 'a', size: 0xfffffffe - 30}])).toThrow(/central directory starts at 4294967295/);
    // A later file's local header past the 32-bit offset range.
    expect(() => zipPlan([{path: 'a', size: 0xffffffe0}, {path: 'b', size: 0}])).toThrow(/"b" starts at 4294967295 — needs zip64/);
    expect(() => zipPlan([{path: 'a', size: -1}])).toThrow(/needs zip64/);
    expect(() => zipPlan([{path: 'a', size: 1.5}])).toThrow(/needs zip64/);
  });

  describe('the CLI: node scripts/zip-store.mjs <dir> <out.zip>', () => {
    const cli = args => spawnSync(process.execPath, ['scripts/zip-store.mjs', ...args], {cwd: ROOT, encoding: 'utf8'});

    it('writes zipStore(dir) and prints its count, size and sha256', () => {
      const dir = tree('pkg', TRAP);
      const out = join(tmp, 'out.zip');
      const r = cli([dir, out]);
      expect(r.status).toBe(0);
      const zip = readFileSync(out);
      expect(zip.equals(zipStore(dir))).toBe(true);
      expect(r.stdout).toBe(`zip ${out}: 8 entries, ${zip.length} bytes, sha256:${sha256(zip)}\n`);
    });

    it('refuses an output inside the directory, and an output that exists (nothing written, nothing changed)', () => {
      const dir = tree('pkg', TRAP);
      const inside = cli([dir, join(dir, 'Z', 'x.zip')]);
      expect(inside.status).toBe(1);
      expect(inside.stderr).toMatch(/is inside/);
      expect(existsSync(join(dir, 'Z', 'x.zip'))).toBe(false);
      const exists = join(tmp, 'there.zip');
      writeFileSync(exists, 'keep');
      const again = cli([dir, exists]);
      expect(again.status).toBe(1);
      expect(again.stderr).toMatch(/EEXIST/);
      expect(readFileSync(exists, 'utf8')).toBe('keep');
      // A name inside that starts with '..' is still inside; a sibling of the directory is outside (control).
      expect(cli([dir, join(dir, '..x.zip')]).status).toBe(1);
      expect(existsSync(join(dir, '..x.zip'))).toBe(false);
      expect(cli([dir, join(tmp, 'sibling.zip')]).status).toBe(0);
    });

    it('refuses a refused package with exit 1, and wrong arguments with exit 2', () => {
      const dir = tree('pkg', {...TRAP, 'caf\u00e9': 'x'});
      const r = cli([dir, join(tmp, 'bad.zip')]);
      expect(r.status).toBe(1);
      expect(r.stderr).toMatch(/is not printable ASCII/);
      expect(existsSync(join(tmp, 'bad.zip'))).toBe(false);
      expect(cli([dir]).status).toBe(2);
      expect(cli([]).stderr).toBe('usage: node scripts/zip-store.mjs <dir> <out.zip>\n');
    });
  });

  it('zipInputs is the walk zipStore packs: sorted, regular files only', () => {
    const dir = tree('pkg', TRAP);
    expect(zipInputs(dir).map(f => f.path)).toEqual(TRAP_ORDER);
    expect(zipFiles(zipInputs(dir)).equals(zipStore(dir))).toBe(true);
  });
});
```

- [ ] **Step 2: Run — red.**

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0` (the `.mjs` files are outside `tsconfig.json`'s `include`; every mutant below is therefore `tsc 0` too — recorded, not a skipped check).
Run: `TZ=UTC npx vitest run scripts/__tests__/zip-store.test.mjs`
Expected on the base tree (0fcf769 + the two test files): `Test Files  1 failed (1)` · `Tests  no tests` — `Error: Cannot find module '../zip-store.mjs' imported from …/extension/scripts/__tests__/zip-store.test.mjs`.
Run: `TZ=UTC npx vitest run` — `Test Files  1 failed | 239 passed (240)` · `Tests  5318 passed (5318)` (the base's 239 / 5318, the new file failing to load). (Observed: in a `git archive` copy of 0fcf769 with the two files added.)

- [ ] **Step 3: Implement.**

Create `extension/scripts/zip-store.mjs`:

```js
#!/usr/bin/env node
// B1e §5.4 (I8, R6): the store package as a hand-written STORE (uncompressed) zip, no dependency. A deflated zip's bytes
// depend on the zlib build, so a reviewer on another Node could not reproduce its sha256; STORE has no compressor, so
// "two builds, one zip, one sha256" holds on any machine.
//
// The format, fixed (and nothing else is written): entries = every regular file under the package directory, paths
// relative with `/`, sorted by the C collation (byte order), no directory entries — an empty directory has no entry and
// disappears from the zip; per entry a local header and the data, then the central directory, then the end record;
// version 20 (made by: 20 on host 0), flags 0 (no data descriptor; every path printable ASCII, so no UTF-8 flag), method
// 0, DOS time 0 and date 0x0021 (1980-01-01 00:00), CRC-32 by `zlib.crc32`, both sizes in both headers, internal and
// external attributes 0, no extra field, no file or archive comment, no zip64. Nothing of the file system but a file's
// path and bytes reaches the zip: no mtime, no mode, no owner.
//
// Refused (the zip is not written): a path that is not printable ASCII or not a plain relative path; anything under the
// directory that is not a regular file or a directory (a symlink — to a file or a directory —, a FIFO, a socket, a
// device); a directory holding no file at all; 65 535 entries or more, or any 32-bit field (a size, an offset) reaching
// 0xFFFFFFFF — the all-ones values are zip64's sentinels (APPNOTE 4.4.1.4), so a zip that needs one is refused, never
// written as zip64.
import {lstatSync, readdirSync, readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {crc32} from 'node:zlib';
import {isAbsolute, join, relative, resolve, sep} from 'node:path';
import {isMain} from './isMain.mjs';

export const ZIP_VERSION = 20;
export const DOS_TIME = 0;
export const DOS_DATE = 0x0021;
/** The first entry count the end record cannot hold without zip64's sentinel. */
export const MAX_ENTRIES = 0xffff - 1;
/** The largest value a 32-bit size or offset field may hold without zip64's sentinel. */
export const MAX_FIELD = 0xffffffff - 1;
export const LOCAL_HEADER = 30;
export const CENTRAL_HEADER = 46;
export const END_RECORD = 22;

/** A path the zip may carry: printable ASCII, `/`-separated, relative, no empty, `.` or `..` segment, no backslash. */
export function pathProblem(path) {
  if (typeof path !== 'string' || path === '') return 'is empty';
  if (!/^[\x20-\x7e]+$/.test(path)) return 'is not printable ASCII';
  if (path.includes('\\')) return 'contains a backslash';
  if (path.split('/').some(s => s === '' || s === '.' || s === '..')) return 'is not a plain relative path';
  return null;
}

const byteOrder = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * The files the zip of `root` holds, `{path, bytes}` sorted by path. Throws on anything that is not a regular file or a
 * directory (symlinks included, by lstat), on a path `pathProblem` refuses, and when there is no file at all.
 */
export function zipInputs(root) {
  const top = resolve(root);
  if (!lstatSync(top).isDirectory()) throw new Error(`zip-store: ${root} is not a directory`);
  const files = [];
  const walk = dir => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const rel = relative(top, p).split(sep).join('/');
      const st = lstatSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile()) files.push({path: rel, bytes: readFileSync(p)});
      else throw new Error(`zip-store: ${JSON.stringify(rel)} is not a regular file or a directory${st.isSymbolicLink() ? ' (a symlink)' : ''}`);
    }
  };
  walk(top);
  if (files.length === 0) throw new Error(`zip-store: ${root} holds no file`);
  return files.sort((a, b) => byteOrder(a.path, b.path));
}

/**
 * Where each record lands, from the paths and sizes alone: `{offsets, centralOffset, centralSize, length}`. Throws when
 * the entries are not sorted and unique, a path is refused, or a count, size or offset would need zip64.
 */
export function zipPlan(entries) {
  if (entries.length > MAX_ENTRIES) throw new Error(`zip-store: ${entries.length} entries — more than ${MAX_ENTRIES} needs zip64`);
  const offsets = [];
  let at = 0;
  let central = 0;
  entries.forEach(({path, size}, i) => {
    const problem = pathProblem(path);
    if (problem) throw new Error(`zip-store: the path ${JSON.stringify(path)} ${problem}`);
    if (i > 0 && byteOrder(entries[i - 1].path, path) >= 0) throw new Error(`zip-store: ${JSON.stringify(path)} is out of order or repeated`);
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_FIELD) throw new Error(`zip-store: ${JSON.stringify(path)} is ${size} bytes — needs zip64`);
    if (at > MAX_FIELD) throw new Error(`zip-store: ${JSON.stringify(path)} starts at ${at} — needs zip64`);
    offsets.push(at);
    at += LOCAL_HEADER + path.length + size;
    central += CENTRAL_HEADER + path.length;
  });
  if (at > MAX_FIELD) throw new Error(`zip-store: the central directory starts at ${at} — needs zip64`);
  if (central > MAX_FIELD) throw new Error(`zip-store: the central directory is ${central} bytes — needs zip64`);
  return {offsets, centralOffset: at, centralSize: central, length: at + central + END_RECORD};
}

/** The zip of `files` (`{path, bytes}`, sorted by path, unique), exactly §5.4's format. */
export function zipFiles(files) {
  const plan = zipPlan(files.map(f => ({path: f.path, size: f.bytes.length})));
  const out = Buffer.alloc(plan.length);
  let at = 0;
  const u16 = v => (out.writeUInt16LE(v, at), (at += 2));
  const u32 = v => (out.writeUInt32LE(v, at), (at += 4));
  const crcs = files.map(f => crc32(f.bytes) >>> 0);
  files.forEach((f, i) => {
    u32(0x04034b50);
    u16(ZIP_VERSION); // version needed
    u16(0); // flags
    u16(0); // method: stored
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(crcs[i]);
    u32(f.bytes.length); // compressed size
    u32(f.bytes.length); // uncompressed size
    u16(f.path.length);
    u16(0); // extra field length
    at += out.write(f.path, at, 'latin1');
    out.set(f.bytes, at);
    at += f.bytes.length;
  });
  files.forEach((f, i) => {
    u32(0x02014b50);
    u16(ZIP_VERSION); // version made by: 20, host 0
    u16(ZIP_VERSION); // version needed
    u16(0);
    u16(0);
    u16(DOS_TIME);
    u16(DOS_DATE);
    u32(crcs[i]);
    u32(f.bytes.length);
    u32(f.bytes.length);
    u16(f.path.length);
    u16(0); // extra field length
    u16(0); // file comment length
    u16(0); // disk number start
    u16(0); // internal attributes
    u32(0); // external attributes
    u32(plan.offsets[i]);
    at += out.write(f.path, at, 'latin1');
  });
  u32(0x06054b50);
  u16(0); // this disk
  u16(0); // the central directory's disk
  u16(files.length);
  u16(files.length);
  u32(plan.centralSize);
  u32(plan.centralOffset);
  u16(0); // archive comment length
  if (at !== plan.length) throw new Error(`zip-store: wrote ${at} bytes, planned ${plan.length}`);
  return out;
}

/** The STORE zip of the directory `root`. */
export const zipStore = root => zipFiles(zipInputs(root));

const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

function main(args) {
  if (args.length !== 2) {
    console.error('usage: node scripts/zip-store.mjs <dir> <out.zip>');
    return 2;
  }
  const [dir, out] = args.map(a => resolve(a));
  const inside = relative(dir, out);
  if (inside === '' || !(inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside))) {
    console.error(`zip-store: ${args[1]} is inside ${args[0]} — the zip would pack itself on the next run`);
    return 1;
  }
  try {
    const files = zipInputs(dir);
    const zip = zipFiles(files);
    writeFileSync(out, zip, {flag: 'wx'});
    console.log(`zip ${args[1]}: ${files.length} entries, ${zip.length} bytes, sha256:${sha256(zip)}`);
    return 0;
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, the real package twice.**

Run: the Step 2 command — `Test Files  1 passed (1)` · `Tests  19 passed (19)` (1.3 s).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `TZ=UTC npx vitest run` — `Test Files  240 passed (240)` · `Tests  5337 passed (5337)` (the base's 239 / 5318 + this file's 19). `TZ=UTC npx vitest run --config vitest.nopresale.config.ts` — `Tests  550 passed | 25 skipped (575)` (unchanged: the zip is build-independent and the file is not in `NOPRESALE_TESTS`). `npm run build` — exit 0 (both builds). `npm run gates` — exit 0, every line as on the base (`permissions ok (dist)`, …, `licences ok (dist-nopresale): …`, `no presale ok (dist-nopresale off, dist on): …`). `node scripts/check-no-tge-date.mjs` (repo root) — `No TGE date in 1376 tracked text files` (the three new files tracked). `npm run reproducible` is not run: no build output changes (the zip is not part of a build). No repo-root `src/`, `core/` or `web/` change.

The real store package, zipped twice through the CLI (the output outside the package, a path git does not track):

```bash
rm -f /tmp/noctura-a.zip /tmp/noctura-b.zip
node scripts/zip-store.mjs dist-nopresale/chrome /tmp/noctura-a.zip
node scripts/zip-store.mjs dist-nopresale/chrome /tmp/noctura-b.zip
cmp /tmp/noctura-a.zip /tmp/noctura-b.zip && echo identical
```

Observed (the dry run's scratch paths in place of `/tmp`):
```
zip …/t2-a.zip: 28 entries, 1541854 bytes, sha256:6171a4d4c338b749a66c4e72d834bd59be88a4972b187d713cc0830523dac51e
zip …/t2-b.zip: 28 entries, 1541854 bytes, sha256:6171a4d4c338b749a66c4e72d834bd59be88a4972b187d713cc0830523dac51e
identical
```
and on Node 22.12.0 (CI's, `PATH` from `npx -y -p node@22.12.0`): the zip-store tests `19 passed (19)` and the same package → `28 entries, 1541854 bytes, sha256:6171a4d4…c51e` — one sha256 across two Node versions, the reason for STORE.

The independent reader on the real zip against the package (and `buildManifest`'s walk, which is not the writer's):
```bash
node --input-type=module -e "
import {readStoreZip} from './scripts/__tests__/storeZipReader.mjs';
import {buildManifest} from '../web/scripts/build-manifest.mjs';
import {readFileSync} from 'node:fs';
const e = readStoreZip(readFileSync('/tmp/noctura-a.zip')); const m = buildManifest('dist-nopresale/chrome');
console.log(e.length, e.length === m.files.length && e.every((x, i) => x.path === m.files[i].path && x.bytes.equals(readFileSync('dist-nopresale/chrome/' + x.path))), m.digest);"
```
→ `28 true ed33e05f7dc1f6e485e35ba3bc37fe1c983eb125d474ad4cfa8f861eae3629db`; the entries, in order: `approve.html assets/addressBook-CbfkXQxk.css … assets/wallet-BUa4cXjz.js background.js fonts/Geist-Variable.woff2 fonts/GeistMono-Variable.woff2 fonts/LICENSE.txt licenses.html manifest.json popup.html provider.js relay.js unlock.html wallet.html` (upper-case `G` before `L`, `assets/` before `background.js`: byte order).

Two real tools as extra controls (not the only ones):
- `unzip -tq /tmp/noctura-a.zip; echo $?` → `No errors detected in compressed data of …` · `0`;
- `python3 -m zipfile -t /tmp/noctura-a.zip; echo $?` → `Done testing` · `0`; Python's `ZipInfo` over all 28 entries gives one tuple `(compress_type 0, date_time (1980, 1, 1, 0, 0, 0), create_system 0, create_version 20, extract_version 20, flag_bits 0, external_attr 0, extra b'', comment b'')` and the archive comment `b''`;
- `zipinfo` → `-rw----     2.0 fat      401 b- stor 80-Jan-01 00:00 approve.html` … `28 files, 1538472 bytes uncompressed, 1538472 bytes compressed:  0.0%`;
- `unzip -q` into an empty directory (umask 022) → every file `-rw-r--r--`, `diff -r` against `dist-nopresale/chrome` empty.

- [ ] **Step 5: Commit.**

```bash
git add extension/scripts/zip-store.mjs extension/scripts/__tests__/zip-store.test.mjs extension/scripts/__tests__/storeZipReader.mjs
git commit -m "feat(extension): B1e-2 the STORE zip — scripts/zip-store.mjs writes the store package as a hand-written uncompressed zip exactly as spec §5.4 fixes it (every regular file, C-sorted paths, no directory entries, version 20, flags 0, method 0, DOS 1980-01-01, zlib CRC-32, attributes 0, no extra, no comment, no zip64), no dependency (R6); non-ASCII paths, symlinks and other non-regular files, an empty package and zip64's sentinels refused; read back in the tests by an independent reader from the end record

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked), `timeout 300`; `tsc`'s own exit code first (always `0` here: `.mjs` is outside `tsconfig.json`), then `TZ=UTC npx vitest run scripts/__tests__/zip-store.test.mjs` (19).** `W` = `scripts/zip-store.mjs`, `RD` = `scripts/__tests__/storeZipReader.mjs`. "The eight" = "one file: exactly the bytes §5.4 fixes, field by field"; "holds every file of the package — in the C collation, …"; "a changed byte, a renamed file or an added empty file changes the sha256 (positive controls)"; "an empty directory has no entry: …"; "refuses a directory that holds no file at all, …"; "refuses files that are unsorted or repeated (the in-memory form)"; "holds 65534 entries, and refuses one more …"; "refuses a zip with any one field §5.4 fixes changed" — every row whose zip the reader parses.

| id | the change | observed |
|---|---|---|
| M-deflate | W: the local header's `u16(0); // method: stored` → `u16(8)` (the data left stored) | tsc 0 · RED `8 failed \| 11 passed (19)` — the eight |
| M-unsorted | W: `return files.sort(…)` → `return files;` AND `zipPlan`'s order check → `if (false) throw` (the walk's per-directory order reaches the zip) | tsc 0 · RED `5 failed \| 14 passed (19)` — "holds every file of the package — in the C collation, …"; "a changed byte, …"; "an empty directory has no entry: …"; "refuses files that are unsorted or repeated (the in-memory form)"; "zipInputs is the walk zipStore packs: sorted, regular files only" |
| M-dos-date | W: `DOS_DATE = 0x0021` → `0x0000` | tsc 0 · RED `8 failed \| 11 passed (19)` — the eight |
| M-dos-time | W: `DOS_TIME = 0` → `0x6000` (12:00) | tsc 0 · RED `8 failed \| 11 passed (19)` — the eight |
| M-crc | W: `crc32(f.bytes) >>> 0` → `crc32(f.bytes.subarray(1)) >>> 0` | tsc 0 · RED `7 failed \| 12 passed (19)` — the eight but "holds 65534 entries …" (every file there is empty, whose CRC the mutant does not change) |
| M-version | W: `ZIP_VERSION = 20` → `10` | tsc 0 · RED `8 failed \| 11 passed (19)` — the eight |
| M-made-by-unix | W: version made by `u16(ZIP_VERSION)` → `u16(0x0300 \| ZIP_VERSION)` (host 3, Unix) | tsc 0 · RED `8 failed \| 11 passed (19)` — the eight |
| M-ext-attr | W: `u32(0); // external attributes` → `u32(0o100644 * 65536)` (a Unix mode leaks in) | tsc 0 · RED `8 failed \| 11 passed (19)` — the eight |
| M-lstat | W: the walk's `lstatSync(p)` → `statSync(p)` (follows symlinks) | tsc 0 · RED `1 failed \| 18 passed (19)` — "refuses a symlink (to a file, to a directory, dangling) and a FIFO, naming it — the same tree without passes" |
| M-ascii | W: `pathProblem`'s printable-ASCII line removed | tsc 0 · RED `3 failed \| 16 passed (19)` — "refuses a non-ASCII path on disk — …"; "refuses every path that is not printable ASCII or not a plain relative path"; "refuses a refused package with exit 1, and wrong arguments with exit 2" |
| M-dir-entry | W: the walk pushes `` {path: `${rel}/`, bytes: Buffer.alloc(0)} `` for every directory AND `pathProblem`'s plain-relative-path line removed | tsc 0 · RED `8 failed \| 11 passed (19)` — "an empty directory has no entry: …"; "holds every file of the package — …"; "refuses a directory that holds no file at all, …"; "refuses every path that is not printable ASCII or not a plain relative path"; "zipInputs is the walk zipStore packs: …"; "a changed byte, …"; "refuses a zip with any one field §5.4 fixes changed"; "writes zipStore(dir) and prints its count, size and sha256" |
| M-empty-dir-root | W: `if (files.length === 0) throw …` removed | tsc 0 · RED `1 failed \| 18 passed (19)` — "refuses a directory that holds no file at all, and a root that is not a directory" |
| M-max-entries | W: `MAX_ENTRIES = 0xffff - 1` → `0xffff` | tsc 0 · RED `1 failed \| 18 passed (19)` — "holds 65535 entries, and refuses one more (zip64's 0xFFFF sentinel)" (the title follows the constant) |
| M-zip64-central | W: `zipPlan`'s "the central directory starts at … — needs zip64" line removed | tsc 0 · RED `1 failed \| 18 passed (19)` — "refuses any size or offset that would need zip64 (4 GiB), from the plan alone" |
| M-zip64-size | W: `size > MAX_FIELD` → `size > 0xffffffff` | tsc 0 · RED `1 failed \| 18 passed (19)` — the same row |
| M-cli-inside | W: the CLI's inside check → `if (inside === '')` | tsc 0 · RED `1 failed \| 18 passed (19)` — "refuses an output inside the directory, and an output that exists (nothing written, nothing changed)" |
| M-cli-overwrite | W: `{flag: 'wx'}` → `{flag: 'w'}` | tsc 0 · RED `1 failed \| 18 passed (19)` — the same row |
| M-reader-crc | RD: the reader's "the CRC-32 of its data" check removed | tsc 0 · RED `1 failed \| 18 passed (19)` — "refuses a zip with any one field §5.4 fixes changed" (the reader's own negative controls) |
| M-reader-method | RD: the reader's local "method" check removed | tsc 0 · RED `1 failed \| 18 passed (19)` — the same row |

All 19 red; none survived, none invalid.

#### Notes for the executor (Task 2)

- **The rulings this task took (each the most secure default; the owner may overturn any):**
  - **Limits at zip64's sentinels, not past them** (spec: "more than 65 535 entries or 4 GiB fails"): at most **65 534** entries, every size and offset at most **0xFFFFFFFE**. APPNOTE 4.4.1.4 makes the all-ones values (`0xFFFF`, `0xFFFFFFFF`) the signal "look for the zip64 record"; a zip that writes one without zip64 is read differently by different readers. Cost if wrong: one entry and one byte of headroom, against a package of 28 files and 1.5 MB.
  - **Paths: printable ASCII only** (0x20–0x7E), no backslash, no empty, `.` or `..` segment (the spec says "ASCII"). A control character or a backslash is ASCII but a name some unzippers turn into another path. The walk itself cannot produce `..`; `zipFiles` refuses it for any caller.
  - **Not a regular file → refused**, by `lstat`: a symlink (to a file, to a directory, dangling), a FIFO, a socket, a device. Following a symlink would pack bytes from outside the package; skipping it would silently ship a different package than `buildManifest` digests (it follows symlinks with `statSync`). The build emits none today.
  - **An empty directory has no entry and disappears** (§5.4: "no directory entries"); the zip of a tree with one equals the zip without it (tested). A package with **no file at all** is refused (`holds no file`) — an empty zip would hash to a stable, meaningless value (the `INCONCLUSIVE` lesson of `build-manifest.mjs`).
  - **"Version 20"** is written as version made by `20` with host 0 (MS-DOS — the host for which external attributes 0 mean a plain file) and version needed `20`.
  - **The CLI never overwrites and never writes inside the package** (`wx`; an output inside `<dir>`, including a name beginning `..`, is refused): a zip inside the package would be packed by the next run.
- **The independent reader** is `scripts/__tests__/storeZipReader.mjs`, a test helper with **no import at all** (a source test): it finds the end record from the end, requires it to be the last 22 bytes, follows the central directory, then each local header, checks every field §5.4 fixes, its own table CRC-32 (the standard check value `0xCBF43926` and zlib's value over all 256 byte values as its controls), byte order of the paths, and that the records tile the file with no gap. It is in its own file rather than inside `zip-store.test.mjs` so a reviewer can run it on the real zip (Step 4's command); it never imports the writer. Its own negative controls: fifteen single-field corruptions of a valid zip, each refused, and M-reader-crc / M-reader-method show those rows bite.
- **Deviation from the brief:** none in scope. The brief's ">65 535 entries" row is the 65 534 / 65 535 boundary (the ruling above). The FIFO row runs `mkfifo` (coreutils; CI's Ubuntu has it).
- **What Task 7 must know:** call `zipStore(dir)` (it returns the bytes; nothing is written) twice and compare sha256; a throw is a refusal and must stop before the zip or the notes are written. Writing the zip is Task 7's (its own git-ignored path). The `release/notes-<version>.md` sha256 is the zip's; the package's file digest (`buildManifest`) stays the inner check — the two are different hashes of the same 28 files (Step 4).
- **What the owner should know (§7 step 5):** the zip's external attributes are 0 on host MS-DOS, so an unzip applies the local umask (`-rw-r--r--` under 022, observed with Info-ZIP); the store unpacks it itself — not observable here. The checklist's unpacked load of the zip's contents is where it is seen.
- **No copy** in this task (only error messages and the CLI line, none user-facing).

#### Spec rev 2.7 lines
- §5.4: the limits are **at most 65 534 entries and every 32-bit size / offset at most 0xFFFFFFFE** — the all-ones values are zip64's sentinels (APPNOTE 4.4.1.4) — where the text said "more than 65 535 entries or 4 GiB fails".
- §5.4: "every path must be ASCII" is **printable ASCII (0x20–0x7E), no backslash, no empty, `.` or `..` segment**.
- §5.4: **anything under the package that is not a regular file or a directory (a symlink of any kind, a FIFO, a socket, a device) fails the script**; an **empty directory has no entry and disappears**; a package with **no file** fails.
- §5.4: "version 20" = **version made by 20 on host 0 and version needed 20**.
- §5.4: the script is `zipStore(dir) → Buffer` plus a CLI `node scripts/zip-store.mjs <dir> <out.zip>` that **refuses an output inside `<dir>` or one that exists**; the tests' independent reader is the helper `scripts/__tests__/storeZipReader.mjs` (no import), beside real-tool controls (`unzip -t`, `python3 -m zipfile -t`) run by hand.


### Task 3: The privacy policy and the live check's comparison — `release/ico-retention.md` (ICO's §6.2 answer verbatim, its date and commits); `release/privacySentences.mjs` (P1–P16 re-verified against the code at 0fcf769 — **P3, P5 and P8 corrected**, P5 also naming the recipient lookup at review (rev 2, Fable review 1 M5), the rest verbatim from spec §6.1 — then L1 (the controller's ruling: the noc-tura.io pages the extension links to, after P9), then R1–R21 from ICO's answer, R2 and R8 the extension's own measured headers); `release/privacy.md` (every sentence verbatim); `scripts/live-check.mjs` (§6.5's normalisation as a pure comparison, and an injected-fetch runner with no default fetch and no CLI); every §6.5 control offline with fixture HTML; the published facts pinned to the constants they describe; an E2E that pins what the store build's coordinator requests carry (no Referer; Origin only on the POSTs) and that #1's / #38's noc-tura.io links open with no Referer

**Spec:** B1e §6.1 (P1–P16, "the one list the unit test and the live check both read", the Chrome per-install-identifier note), §6.2 (P-R: ICO's answer recorded "with the date and ICO's commit, and turned into sentences R1…"), §6.5 (the comparison: tags removed, entities named + numeric decoded, NFC, ’ → ', “ ” → ", every whitespace run incl. NBSP → one space, case-sensitive substring per sentence; Terms and Help: their title and privacy@noc-tura.io; three GETs one at a time, `redirect: 'manual'`, 200 only; the six controls offline; `privacy.md` contains every sentence verbatim), §6.3 (the certifications are ticked only after §6.2's answer — R20 is that answer, for Task 4's `data-usage.md`), §10 ("No test contacts `*.noc-tura.io`; only the release script's live check does"). **Not here:** the release script that calls `liveCheck` (Task 7), the Terms / Help / listing / data-usage texts (Task 4).

**Files:**
- Create: `extension/release/ico-retention.md`, `extension/release/privacySentences.mjs`, `extension/release/privacy.md`, `extension/scripts/live-check.mjs`
- Create (tests): `extension/scripts/__tests__/live-check.test.mjs` (15), `extension/scripts/__tests__/privacy.test.mjs` (9), `extension/e2e/requestHeaders.spec.ts` (2)
- Modify: none. (No build output changes: `release/` and `scripts/` are not bundled — the reproducible digests are unchanged, quoted in Step 4.)
- Not committed (the measurement, Step 5): a scratch probe with a local TLS server — given in full there.

**Interfaces:**
- Consumes: `NOCTURA_PAGES` (`src/shared/links.ts`), `ABOUT_TEXT` (`src/app/screens/About.tsx`), `REQUIRED_CONNECT_SRC` (`scripts/check-permissions.mjs`), `FRESH_ROWS` (`src/app/useAccountBalances.ts`), `SLIP10_ACCOUNTS_TO_SCAN` (`src/unlock/onboarding.ts`), `SIM_REFRESH_MS` / `SIM_RETRY_MS` (`src/background/dapp/signTx.ts`), `GEO_LIST_CACHE_MS` (`src/background/geo/gate.ts`), `RP_ID` (`src/vault/passkey.ts`), `PRICE_PATH` (`core/portfolio/prices.ts`); `prepareSend` (`src/background/prepare.ts`), `KNOWN_RECIPIENTS_KEY` (`src/background/knownRecipients.ts`), `findAssociatedTokenAddress` (`core/solana/encoding.ts`), `WALLET_TOKENS` (`core/solana/balances.ts`) and the background test fixtures `fakeDeps` (`src/background/__tests__/fakeDeps.ts`), `fakeExt` (`fakeExt.ts`), `ACCOUNT`, `HOLDING_LARGE`, `RECIPIENT`, `sendReader`, `unlocked` (`fixtures.ts`) — P5's recipient lookup is pinned by running `prepareSend`; the E2E helpers `launchContained`, `EXT_NOPRESALE`, `containNocTura`, `containSolscan`, `expectContained`, `installFakeCoordinator`.
- Produces (`extension/release/privacySentences.mjs`):
  ```js
  /** @typedef {{id: string, text: string, source: string}} PrivacySentence */
  export const PRIVACY_SENTENCES: readonly PrivacySentence[];   // frozen; ids exactly P1…P9, L1, P10…P16, R1…R21, in that order
  ```
- Produces (`extension/scripts/live-check.mjs`) — **what Task 7 (`release-chrome.mjs`) calls:**
  ```js
  export const CONTACT: 'privacy@noc-tura.io';
  export const LIVE_PAGES: readonly {name: 'privacy' | 'terms' | 'help', url: string, title: string, sentences: boolean}[];
  //   [{privacy, 'https://noc-tura.io/extension/privacy', 'Privacy Policy', true},
  //    {terms,   'https://noc-tura.io/extension/terms',   'Terms of Service', false},
  //    {help,    'https://noc-tura.io/extension/help',    'Help & support', false}]
  export const NAMED_ENTITIES: Readonly<Record<string, string>>;
  export function decodeEntities(text: string): string;
  export function foldText(text: string): string;              // NFC; ’→'; “ ”→"; /\s+/gu → ' '
  export function pageText(html: string): string;             // comments, <script>/<style>/<template> + content, tags removed; decodeEntities; foldText
  export function missingSentences(html: string, sentences?: readonly {id, text}[]): {id, text}[];
  export function pageProblems(page: LivePage, html: string, sentences?): string[];
  export async function liveCheck(io: {fetch: FetchLike, pages?: LivePage[], sentences?: {id, text}[]}): Promise<{ok: boolean, problems: string[]}>;
  //   FetchLike = (url, {method: 'GET', redirect: 'manual'}) => Promise<{status, type?, headers?: {get(name)}, text()}>
  //   throws TypeError when io.fetch is not a function (no default — Task 7 passes its own, e.g. globalThis.fetch);
  //   never throws for a page's failure; each page fetched and read before the next is asked.
  ```
  Task 7 calls exactly `const {ok, problems} = await liveCheck({fetch: <its fetch>})` once, prints `problems` one per line and refuses to pack unless `ok`. A timeout is the caller's (wrap its fetch, e.g. `AbortSignal.timeout`); `liveCheck` adds none.
- **What later tasks rely on:** Task 4 — `release/terms.md` and `release/help.md` must be headed with `LIVE_PAGES`' titles (`# Terms of Service`, `# Help & support`, which are #38's row labels — `ABOUT_TEXT.terms` / `.help`) and carry `privacy@noc-tura.io`; `data-usage.md`'s three certifications rest on R20 (use limited to answering, abuse protection, fault diagnosis; not sold or shared for any other purpose); the listing's "what the coordinator sees" can cite P1–P8 by id. Task 7 — `liveCheck` as above; the rev 2.7 lines at the end of these Notes. **Any `.mjs` under `release/` is read by two gates** (`check-vault-isolation.mjs` and `check-rpc-methods.mjs`, through `listSourceFiles`): it may not spell a background-owned storage key (`v1_…`) or a global-fetch form (`fetch (`, `globalThis.fetch`) even inside a string — Step 4's first gate run failed on exactly that.

**The rule, stated once.** Every required sentence is a published fact with a named source; the list is one file, the page carries each verbatim, and each fact a constant decides (ten rows, six candidates, 30 s, 5 s, 10 minutes, the one host, the RP ID) is pinned to that constant by a test — and the one fact no constant decides, P5's recipient lookup, by running `prepareSend` and reading the order of its requests — so the code cannot change under a sentence without a red test. The comparison folds only what a publisher's typography changes (tags, entities, NFC, three quote marks, whitespace) and nothing else — an unknown entity, a hidden comment or script, a changed word or case is a failure that names the sentence. The live check can reach the network only through the fetch its caller hands it: no CLI, no default, no retry.

- [ ] **Step 1: Re-verify every P-sentence against the code (at 0fcf769) — before writing any file.**

Open each cited file; the current lines are in each sentence's `source` in the file of Step 3. Result (the spec's text compared with the list, by script: `P1 same as spec rev 2.6` … `P3 DIFFERS`, `P5 DIFFERS`, `P8 DIFFERS`, the other thirteen the same):

| # | finding at 0fcf769 | ruling (sentence used) |
|---|---|---|
| P3 | **Not exactly true.** "the public address of every account in your wallet" — the rows' fresh read covers only the first `FRESH_ROWS = 10` accounts of the list (`useAccountBalances.ts:6, :67`: switcher, accounts manager, #37), plus the account viewed (`WalletContext.tsx:204`); a wallet holds up to `MAX_ACCOUNTS = 100`. An 11th account is sent only once viewed or moved into the first ten. The spec's source `walletApi.ts:336` is now `:341`. | "The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing." |
| P5 | **Incomplete.** After a simulation that fails (any thrown read: unreachable, a timeout, a bad answer) the next attempt is `SIM_RETRY_MS = 5_000` later (`signTx.ts:43, :79`), and the window asks every `POLL_MS = 1_000` (`Approve.tsx:10, :77`) — so the transaction is sent every 5 s while the coordinator fails to answer, not every 30 s. 30 s itself holds (`SIM_REFRESH_MS`, `signTx.ts:39`). **Rev 2 (Fable review 1, M5): also silent on the recipient lookup.** Each prepare of your own send — #19 Review on mount (`Review.tsx:110`), and #20 Confirm again when the 30 s quote expired (`Confirm.tsx:162`) — asks the coordinator, before the simulation (`prepare.ts:370`), `getAccountKind` of the address sent to (`:311` SOL, `:332` token) and, for a token, `getAccountExists` of its associated token address (`:333`). True in substance (the recipient is in the simulated transaction), but the sentence said only the simulation. `wallet.recipientInfo` (#12's hint) is local (`walletApi.ts:194–218`). | "…, again every 30 seconds while the approval window shows it, and every 5 seconds after a simulation that fails. When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token." |
| P8 | **Not exactly true.** "read at most once every 10 minutes": the copy lives in the gate's memory (`gate.ts:47–53`, one gate per `browserDeps`, i.e. per service-worker instance) — a restarted worker reads it again at once, and a failed or malformed read is not kept (`:61–64`). | "The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes." |
| P4 | True. `MAX_PROBE = 6` moved to `walletApi.ts:56`; import always probes exactly six (`SLIP10_ACCOUNTS_TO_SCAN = 5` + the CLI account, `onboarding.ts:16, :48–49`) — "up to six" holds. | unchanged |
| P9 | True, measured (Step 5): the explorer navigation carries no Referer. It would carry none even without `noreferrer` — Chrome sends no `chrome-extension://` referrer (Step 5's control) — so the attribute is belt and braces, the sentence stays true. | unchanged |
| P14 | True. The relay reads only `location.protocol` / `origin`, and only on the page's first request to the wallet (`relay.ts:58, :171`); the port opens on that request, never at load (`:9`); the background takes `sender.origin`, never `sender.url` (`ports.ts:45`). | unchanged |
| L1 (added, the controller's ruling on this step's last paragraph) | True, measured: the noc-tura.io pages (`NOCTURA_PAGES`, `src/shared/links.ts:6–10`) open from `<a target="_blank" rel="noopener noreferrer">` on #1 (`unlock.html:49`) and #38 (`About.tsx:23`); each navigation carries no Referer — E2E (#1's Terms and Privacy Policy and #38's Help & support clicked, with a positive control) and on the wire (Step 5, #1's Terms link). The licence page is inside the package and is not named. | "When you open the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives your IP address and your browser's standard headers, as any website you open does; no referrer is sent." |
| P1, P2, P6, P7, P10–P13, P15, P16 | True as written; current lines in `source`. P2 measured (Step 5): `credentials: 'omit'` — no cookie; User-Agent, Accept, Accept-Language and Sec-Fetch-* on every request; Origin on the POSTs. P7's callers: `prepare.ts:180`, `walletApi.ts:176` (was 171), `dapp/simulate.ts:226`. | unchanged |

The dry run first recorded, for the owner, that the #1 / #38 links send the user's IP and headers to noc-tura.io and no sentence said so. **Controller ruling: the policy says it** — sentence L1, placed after P9 in the list and in `privacy.md`, verified as P9 was (no referrer, measured).

- [ ] **Step 2: Write the failing tests.**

Create `extension/scripts/__tests__/live-check.test.mjs`:

```js
import {CONTACT, LIVE_PAGES, NAMED_ENTITIES, decodeEntities, foldText, liveCheck, missingSentences, pageProblems, pageText} from '../live-check.mjs';
import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
import {NOCTURA_PAGES} from '../../src/shared/links';
import {ABOUT_TEXT} from '../../src/app/screens/About';

// B1e §6.5: the live check's comparison and its runner, offline — fixture HTML and an injected fetch only. Nothing
// here reaches the network: globalThis.fetch is replaced by a recorder for every test and must stay unused.

const [PRIVACY, TERMS, HELP] = LIVE_PAGES;
const escapeHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The privacy page as a CMS might publish it: a full document, each sentence its own <p>, typographic apostrophes
 * (alternately ’ as a character, &rsquo; and &#8217;), the words of every third sentence joined by NBSP (&nbsp; or the
 * character), and long paragraphs wrapped over lines — every difference the comparison folds away.
 */
function privacyHtml(sentences = PRIVACY_SENTENCES) {
  const apostrophes = ['\u2019', '&rsquo;', '&#8217;'];
  const body = sentences
    .map((s, i) => {
      let t = escapeHtml(s.text).replace(/'/g, apostrophes[i % 3]);
      if (i % 3 === 1) t = t.replace(/ /g, i % 2 === 0 ? '&nbsp;' : '\u00a0');
      if (i % 3 === 2) t = t.replace(/ (\S+) /, '\n      $1\n      ');
      return `    <p>${t}</p>`;
    })
    .join('\n');
  return `<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="utf-8"><title>Privacy Policy — Noctura</title><style>p > b { font-weight: 600 }</style></head>\n<body>\n  <main>\n    <h1>Privacy Policy</h1>\n${body}\n  </main>\n</body>\n</html>\n`;
}

const otherHtml = (title, contact = CONTACT) =>
  `<!doctype html><html><head><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1><p>Questions: <a href="mailto:${contact}">${contact}</a>.</p></body></html>`;

/** An injected fetch answering each URL from `answers` ({status, body, location?, type?} or an Error to throw), recording every call. */
function fakeFetch(answers) {
  const calls = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const fetch = async (url, init) => {
    calls.push({url, init});
    inFlight += 1;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(r => setTimeout(r, 5));
    const a = answers[url];
    if (a === undefined || a instanceof Error) {
      inFlight -= 1;
      throw a ?? new Error(`no answer for ${url}`);
    }
    return {
      status: a.status,
      type: a.type ?? 'basic',
      headers: {get: n => (n.toLowerCase() === 'location' ? (a.location ?? null) : null)},
      text: async () => {
        await new Promise(r => setTimeout(r, 5));
        inFlight -= 1;
        return a.body ?? '';
      },
    };
  };
  return {fetch, calls, max: () => maxInFlight};
}

const allGood = () => ({
  [PRIVACY.url]: {status: 200, body: privacyHtml()},
  [TERMS.url]: {status: 200, body: otherHtml(TERMS.title)},
  [HELP.url]: {status: 200, body: otherHtml(HELP.title)},
});

describe('the live check (B1e §6.5)', () => {
  let globalCalls;
  let realFetch;
  beforeEach(() => {
    realFetch = globalThis.fetch;
    globalCalls = [];
    globalThis.fetch = async url => {
      globalCalls.push(String(url));
      throw new Error('a test reached globalThis.fetch');
    };
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    expect(globalCalls, 'the live check used globalThis.fetch').toEqual([]);
  });

  it('reads the three pages at the links the extension opens; Terms and Help are titled as #38 names them', () => {
    expect(LIVE_PAGES.map(p => p.name)).toEqual(['privacy', 'terms', 'help']);
    expect(LIVE_PAGES.map(p => p.url)).toEqual([NOCTURA_PAGES.privacy, NOCTURA_PAGES.terms, NOCTURA_PAGES.help]);
    expect(LIVE_PAGES.map(p => p.title)).toEqual([ABOUT_TEXT.privacy, ABOUT_TEXT.terms, ABOUT_TEXT.help]);
    expect(LIVE_PAGES.map(p => p.sentences)).toEqual([true, false, false]);
    expect(CONTACT).toBe('privacy@noc-tura.io');
  });

  it('control: every sentence on the page → passes (the fixture uses \u2019, &rsquo;, &#8217;, NBSP and wrapped lines)', () => {
    const html = privacyHtml();
    expect(html).toContain('&rsquo;');
    expect(html).toContain('&#8217;');
    expect(html).toContain('&nbsp;');
    expect(html).toContain('\u00a0');
    expect(html).toContain('\u2019');
    expect(missingSentences(html)).toEqual([]);
    expect(pageProblems(PRIVACY, html)).toEqual([]);
  });

  it('control: one sentence with one word changed → fails, naming that sentence and no other', () => {
    const changed = PRIVACY_SENTENCES.map(s => (s.id === 'P5' ? {...s, text: s.text.replace('every 30 seconds', 'every 60 seconds')} : s));
    expect(changed.find(s => s.id === 'P5').text).not.toBe(PRIVACY_SENTENCES.find(s => s.id === 'P5').text);
    const problems = pageProblems(PRIVACY, privacyHtml(changed));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^privacy: missing P5: "Before you sign, /);
  });

  it('control: one sentence missing → fails, naming it', () => {
    const problems = pageProblems(PRIVACY, privacyHtml(PRIVACY_SENTENCES.filter(s => s.id !== 'R21')));
    expect(problems).toEqual([`privacy: missing R21: "${PRIVACY_SENTENCES.find(s => s.id === 'R21').text}"`]);
  });

  it('control: a sentence split by <b>…</b> and a line break → passes', () => {
    const p1 = PRIVACY_SENTENCES[0];
    expect(p1.text).toBe('The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator.');
    const html = '<p>The extension itself connects to <b>one\n  server</b> only: api.noc-tura.io, the Noctura <strong class="x">coordinator</strong>.</p>';
    expect(missingSentences(html, [p1])).toEqual([]);
    // And the same split with a word changed inside the <b> still fails.
    expect(missingSentences(html.replace('<b>one', '<b>two'), [p1])).toEqual([p1]);
  });

  it('comments, <script>, <style> and <template> are not page text: a sentence only there fails', () => {
    const s = {id: 'X1', text: 'Questions about privacy: privacy@noc-tura.io.'};
    expect(missingSentences(`<p>${s.text}</p>`, [s]), 'positive control').toEqual([]);
    for (const hidden of [`<!-- ${s.text} -->`, `<!-- an old draft (a > b): ${s.text} -->`, `<script>var t = "${s.text}";</script>`, `<style>/* ${s.text} */</style>`, `<template><p>${s.text}</p></template>`, `<SCRIPT type="x">${s.text}</SCRIPT >`]) {
      expect(missingSentences(`<p>Other text.</p>${hidden}`, [s]), hidden).toEqual([s]);
    }
  });

  it('a tag whose attribute holds ">" is removed whole; a bare "<" in text is kept', () => {
    expect(pageText('<a title="a > b" href="x">link</a> and 1 < 2')).toBe('link and 1 < 2');
  });

  it('entities: named and numeric (decimal, hex, 0x80–0x9F as Windows-1252) decode; an unknown named one stays → fails', () => {
    expect(decodeEntities('&amp; &lt;&gt; &quot;&apos; &rsquo;&ldquo;&rdquo; &mdash;')).toBe('& <> "\' \u2019\u201c\u201d —');
    expect(decodeEntities('&#39;&#x27;&#X27;&#8217;&#x2019;&#146;&#147;&#148;')).toBe("'''\u2019\u2019\u2019\u201c\u201d");
    expect(decodeEntities('&#0;&#x110000;&#xD800;')).toBe('\ufffd\ufffd\ufffd');
    expect(decodeEntities('&amp;lt; &unknownentity; &amp')).toBe('&lt; &unknownentity; &amp');
    expect(Object.keys(NAMED_ENTITIES)).toContain('nbsp');
    const s = {id: 'X', text: "your browser's standard headers"};
    expect(missingSentences('<p>your browser&#146;s standard headers</p>', [s])).toEqual([]);
    expect(missingSentences('<p>your browser&rsquo;s standard headers</p>', [s])).toEqual([]);
    expect(missingSentences('<p>your browser&rsquox;s standard headers</p>', [s])).toEqual([s]);
  });

  it('folding: NFC, \u2019 → \', \u201c \u201d → ", every whitespace run (NBSP, U+202F, U+3000, tabs, newlines) → one space', () => {
    expect(foldText('e\u0301')).toBe('\u00e9');
    expect(foldText('it\u2019s \u201cquoted\u201d')).toBe('it\'s "quoted"');
    expect(foldText('a\u00a0\u00a0b\u202fc\u3000d\t\n e')).toBe('a b c d e');
    const s = {id: 'X', text: 'Caf\u00e9 "menu" isn\'t here.'};
    expect(missingSentences('<p>Cafe\u0301 &ldquo;menu&rdquo; isn&rsquo;t\u00a0\n here.</p>', [s]), 'decomposed \u00e9, curly quotes, NBSP + newline').toEqual([]);
    // Only the three quote marks the spec names are folded: ‘ is not an apostrophe here.
    expect(missingSentences("<p>Cafe\u0301 \"menu\" isn\u2018t here.</p>", [s])).toEqual([s]);
  });

  it('the comparison is case-sensitive', () => {
    const s = PRIVACY_SENTENCES.find(x => x.id === 'P15');
    expect(missingSentences(`<p>${s.text}</p>`, [s])).toEqual([]);
    expect(missingSentences(`<p>${s.text.toLowerCase()}</p>`, [s])).toEqual([s]);
  });

  it('Terms and Help: their title and the contact → pass; either missing → fails, naming the page', () => {
    for (const page of [TERMS, HELP]) {
      expect(pageProblems(page, otherHtml(page.title))).toEqual([]);
      expect(pageProblems(page, otherHtml('Something else'))).toEqual([`${page.name}: missing its title "${page.title}"`]);
      expect(pageProblems(page, otherHtml(page.title, 'support@example.com'))).toEqual([`${page.name}: missing the contact privacy@noc-tura.io`]);
    }
    // Help's title carries "&": written as &amp; in HTML, decoded before the compare.
    expect(otherHtml(HELP.title)).toContain('Help &amp; support');
    // The contact only inside an attribute (a mailto: link with other text) is not on the page.
    expect(pageProblems(TERMS, `<h1>${TERMS.title}</h1><a href="mailto:${CONTACT}">write to us</a>`)).toEqual(['terms: missing the contact privacy@noc-tura.io']);
  });

  it('the runner: the three URLs in order, GET with redirect: manual, one at a time — every page good → ok', async () => {
    const f = fakeFetch(allGood());
    expect(await liveCheck({fetch: f.fetch})).toEqual({ok: true, problems: []});
    expect(f.calls.map(c => c.url)).toEqual(LIVE_PAGES.map(p => p.url));
    for (const c of f.calls) expect(c.init).toEqual({method: 'GET', redirect: 'manual'});
    expect(f.max(), 'requests in flight at once').toBe(1);
  });

  it('control: a 301 → fails (a redirect is never followed); a 404 → fails; an opaque redirect → fails', async () => {
    const moved = fakeFetch({...allGood(), [PRIVACY.url]: {status: 301, location: 'https://noc-tura.io/privacy'}});
    const r1 = await liveCheck({fetch: moved.fetch});
    expect(r1.ok).toBe(false);
    expect(r1.problems).toEqual([`privacy: ${PRIVACY.url} answered 301 (Location: https://noc-tura.io/privacy), want 200 — a redirect fails`]);
    expect(moved.calls.map(c => c.url), 'the redirect target is never asked').toEqual(LIVE_PAGES.map(p => p.url));

    const missing = fakeFetch({...allGood(), [TERMS.url]: {status: 404, body: '<h1>Not found</h1>'}});
    expect(await liveCheck({fetch: missing.fetch})).toEqual({ok: false, problems: [`terms: ${TERMS.url} answered 404, want 200 — a redirect fails`]});

    const opaque = fakeFetch({...allGood(), [HELP.url]: {status: 0, type: 'opaqueredirect'}});
    expect((await liveCheck({fetch: opaque.fetch})).problems).toEqual([`help: ${HELP.url} answered 0, want 200 — a redirect fails`]);
    const opaque200 = fakeFetch({...allGood(), [HELP.url]: {status: 200, type: 'opaqueredirect', body: otherHtml(HELP.title)}});
    expect((await liveCheck({fetch: opaque200.fetch})).ok, 'opaqueredirect fails whatever its status').toBe(false);
  });

  it('control: a page that does not answer, or a privacy page with a changed sentence → fails, naming each', async () => {
    const down = fakeFetch({...allGood(), [HELP.url]: new Error('getaddrinfo ENOTFOUND noc-tura.io')});
    expect(await liveCheck({fetch: down.fetch})).toEqual({ok: false, problems: [`help: ${HELP.url} did not answer (getaddrinfo ENOTFOUND noc-tura.io)`]});
    const stale = privacyHtml(PRIVACY_SENTENCES.map(s => (s.id === 'P8' ? {...s, text: s.text.replace('up to 10 minutes', 'up to 15 minutes')} : s)));
    expect(stale).toMatch(/15(&nbsp;|\u00a0)minutes/);
    const old = fakeFetch({...allGood(), [PRIVACY.url]: {status: 200, body: stale}});
    const r = await liveCheck({fetch: old.fetch});
    expect(r.ok).toBe(false);
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toMatch(/^privacy: missing P8: /);
  });

  it('it has no default fetch: called without one it refuses before any request', async () => {
    await expect(liveCheck({})).rejects.toThrow(TypeError);
    await expect(liveCheck(undefined)).rejects.toThrow(/injected fetch/);
  });
});
```

Create `extension/scripts/__tests__/privacy.test.mjs`:

```js
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
import {CONTACT, LIVE_PAGES, foldText, pageProblems} from '../live-check.mjs';
import {REQUIRED_CONNECT_SRC} from '../check-permissions.mjs';
import {FRESH_ROWS} from '../../src/app/useAccountBalances';
import {SLIP10_ACCOUNTS_TO_SCAN} from '../../src/unlock/onboarding';
import {SIM_REFRESH_MS, SIM_RETRY_MS} from '../../src/background/dapp/signTx';
import {GEO_LIST_CACHE_MS} from '../../src/background/geo/gate';
import {RP_ID} from '../../src/vault/passkey';
import {PRICE_PATH} from '../../../core/portfolio/prices';
import {NOCTURA_PAGES} from '../../src/shared/links';
import {PublicKey} from '@solana/web3.js';
import {prepareSend} from '../../src/background/prepare';
import {KNOWN_RECIPIENTS_KEY} from '../../src/background/knownRecipients';
import {fakeDeps} from '../../src/background/__tests__/fakeDeps';
import {fakeExt} from '../../src/background/__tests__/fakeExt';
import {ACCOUNT, HOLDING_LARGE, RECIPIENT, sendReader, unlocked} from '../../src/background/__tests__/fixtures';
import {WALLET_TOKENS} from '../../../core/solana/balances';
import {findAssociatedTokenAddress} from '../../../core/solana/encoding';

// B1e §6.1, §6.2, §6.5: the privacy policy's required sentences — the list, privacy.md carrying each verbatim, and
// the facts in them pinned to the code they describe (a constant that changes turns this red, so the published
// sentence cannot silently stop being true).

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => readFileSync(resolve(ROOT, rel), 'utf8');
const PRIVACY_MD = read('release/privacy.md');
const RETENTION_MD = read('release/ico-retention.md');
const text = id => PRIVACY_SENTENCES.find(s => s.id === id)?.text ?? '';
/** The sentences whose text is not, character for character, in `md`. */
const notVerbatim = (md, sentences = PRIVACY_SENTENCES) => sentences.filter(s => !md.includes(s.text)).map(s => s.id);
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];

/** privacy.md as a site would publish it: each paragraph a <p>, headings <h1>–<h3>, the text HTML-escaped. */
function asHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return md
    .split(/\n{2,}/)
    .map(block => {
      const h = /^(#{1,3}) (.*)$/.exec(block);
      return h ? `<h${h[1].length}>${esc(h[2])}</h${h[1].length}>` : `<p>${esc(block)}</p>`;
    })
    .join('\n');
}

describe('the privacy policy (B1e §6.1, §6.2)', () => {
  it('the list: P1–P16 (§6.1) with L1 after P9, then R1–R21 (§6.2), each with a text and a source, no text twice', () => {
    const ids = PRIVACY_SENTENCES.map(s => s.id);
    const p = Array.from({length: 16}, (_, i) => `P${i + 1}`);
    expect(ids).toEqual([...p.slice(0, 9), 'L1', ...p.slice(9), ...Array.from({length: 21}, (_, i) => `R${i + 1}`)]);
    for (const s of PRIVACY_SENTENCES) {
      expect(Object.keys(s).sort(), s.id).toEqual(['id', 'source', 'text']);
      expect(s.text.length, s.id).toBeGreaterThan(20);
      expect(s.source.length, s.id).toBeGreaterThan(5);
    }
    expect(new Set(PRIVACY_SENTENCES.map(s => s.text)).size).toBe(PRIVACY_SENTENCES.length);
    expect(Object.isFrozen(PRIVACY_SENTENCES) && PRIVACY_SENTENCES.every(s => Object.isFrozen(s))).toBe(true);
  });

  it('each sentence is already in the live check\'s folded form (straight quotes, single spaces, NFC) and ends a sentence', () => {
    for (const s of PRIVACY_SENTENCES) {
      expect(foldText(s.text), s.id).toBe(s.text);
      expect(s.text, s.id).toMatch(/^[A-Z].*[.]$/);
      expect(s.text, s.id).not.toMatch(/[\u2018\u2019\u201c\u201d\u00a0]|\s{2}|^\s|\s$/);
    }
  });

  it('privacy.md carries every sentence verbatim — control: one word changed or one sentence dropped is found', () => {
    expect(notVerbatim(PRIVACY_MD)).toEqual([]);
    expect(notVerbatim(PRIVACY_MD.replace('one-minute window', 'one-hour window'))).toEqual(['R11']);
    expect(notVerbatim(PRIVACY_MD.replace(`${text('R21')}`, ''))).toEqual(['R21']);
  });

  it('privacy.md, published as plain HTML, passes the live check\'s comparison', () => {
    const privacy = LIVE_PAGES.find(p => p.name === 'privacy');
    expect(pageProblems(privacy, asHtml(PRIVACY_MD))).toEqual([]);
    expect(PRIVACY_MD.startsWith(`# ${privacy.title}\n`)).toBe(true);
  });

  it('privacy.md makes no claim the build does not keep: nothing "anonymous" or "untraceable"; "private" only in "private keys"', () => {
    const lower = PRIVACY_MD.toLowerCase();
    expect(lower).not.toMatch(/\b(anonym\w*|untraceable|unlinkable|confidential|encrypted in transit)\b/);
    expect([...lower.matchAll(/\bprivate\b(.{0,5})/g)].map(m => m[1])).toEqual([' keys']);
  });

  it('the facts in the sentences are the code\'s: the one host, the counts, the intervals, the RP ID, the tokens, the contact', () => {
    expect(REQUIRED_CONNECT_SRC).toEqual(['https://api.noc-tura.io']);
    expect(text('P1')).toContain(`one server only: ${new URL(REQUIRED_CONNECT_SRC[0]).host}`);
    expect(text('P3')).toContain(`the first ${WORDS[FRESH_ROWS]} accounts in your account list`);
    // MAX_PROBE is module-private: its declaration is pinned as text, beside the candidates it must cover.
    expect(read('src/background/walletApi.ts')).toContain('const MAX_PROBE = 6;');
    expect(text('P4')).toContain(`up to ${WORDS[SLIP10_ACCOUNTS_TO_SCAN + 1]} accounts derived from it`);
    expect(text('P5')).toContain(`again every ${SIM_REFRESH_MS / 1000} seconds while the approval window shows it`);
    expect(text('P5')).toContain(`every ${SIM_RETRY_MS / 1000} seconds after a simulation that fails`);
    expect(text('P8')).toContain(`keeping a copy for up to ${GEO_LIST_CACHE_MS / 60_000} minutes`);
    expect(text('P12')).toContain(`listed under the name ${RP_ID}.`);
    expect(text('P13')).toContain(`Nothing is served at ${RP_ID}`);
    expect(PRICE_PATH).toBe('/wallet/prices?ids=solana,usd-coin,tether');
    expect(text('P7')).toContain('prices for SOL, USDC and USDT');
    expect(text('R19')).toContain('Prices for SOL, USDC and USDT');
    expect(text('P16')).toBe(`Questions about privacy: ${CONTACT}.`);
    expect(text('R21')).toContain(CONTACT);
    // L1 names the three noc-tura.io pages the extension links to, and not the licence page (it is inside the package).
    expect(Object.keys(NOCTURA_PAGES).sort()).toEqual(['help', 'privacy', 'terms']);
    for (const url of Object.values(NOCTURA_PAGES)) expect(new URL(url).host).toBe('noc-tura.io');
    expect(text('L1')).toContain('the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives');
    expect(text('L1')).not.toMatch(/licen[cs]e/i);
  });

  it('P5\'s recipient lookup is prepareSend\'s: the address sent to (its kind) and, for a token, its token account — both asked before the simulation', async () => {
    const NOC = WALLET_TOKENS.NOC.mint;
    const LOOKUPS = ['getAccountKind', 'getAccountExists', 'simulateTransaction'];
    /** The reader calls one prepareSend makes that P5 speaks of, in order, each with its first argument. */
    const lookups = async intent => {
      const calls = [];
      const base = sendReader({getTokenAccountsByOwner: async () => [{pubkey: HOLDING_LARGE, mint: NOC, owner: ACCOUNT.publicKey, amount: 13_399_619n, decimals: 9}]});
      const reader = Object.fromEntries(Object.entries(base).map(([k, f]) => [k, (...a) => (calls.push([k, a[0]]), f(...a))]));
      const ext = fakeExt();
      await unlocked(ext);
      await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
      await prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, intent);
      return calls.filter(([k]) => LOOKUPS.includes(k)).map(([k, a]) => [k, k === 'simulateTransaction' ? 'tx' : a]);
    };
    expect(await lookups({token: 'SOL', recipient: RECIPIENT, amount: '1000000'})).toEqual([['getAccountKind', RECIPIENT], ['simulateTransaction', 'tx']]);
    const ata = findAssociatedTokenAddress(new PublicKey(RECIPIENT), new PublicKey(NOC)).toBase58();
    expect(await lookups({token: 'NOC', recipient: RECIPIENT, amount: '1000000'})).toEqual([
      ['getAccountKind', RECIPIENT],
      ['getAccountExists', ata],
      ['simulateTransaction', 'tx'],
    ]);
    expect(text('P5')).toContain(
      'When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token.',
    );
  });

  it('every R-sentence is ICO\'s answer except R2 and R8, which say they are the extension\'s own measurement', () => {
    const r = PRIVACY_SENTENCES.filter(s => s.id.startsWith('R'));
    expect(r.filter(s => s.source.startsWith('measured, not ICO:')).map(s => s.id)).toEqual(['R2', 'R8']);
    for (const s of r.filter(x => !['R2', 'R8'].includes(x.id))) expect(s.source, s.id).toMatch(/^ICO §6\.2 answer [1-6]/);
    for (const s of r.filter(x => ['R2', 'R8'].includes(x.id))) expect(s.source, s.id).toContain('e2e/requestHeaders.spec.ts');
  });

  it('ico-retention.md records the answer: its date, ICO\'s three commits, the six numbered parts', () => {
    expect(RETENTION_MD).toContain('**Received:** 2026-11-01');
    for (const c of ['67bcec0', '6c68431', 'c803bc1']) expect(RETENTION_MD).toContain(c);
    for (const part of ['1–2 Recorded / where:', '3 Retention:', '4 Outside recipients:', '5 Use:', '6 Deletion requests: privacy@noc-tura.io.']) {
      expect(RETENTION_MD).toContain(`\n${part}`);
    }
  });
});
```

Create `extension/e2e/requestHeaders.spec.ts`:

```ts
import {test, expect, type Request} from '@playwright/test';
import {rmSync} from 'node:fs';
import {EXT_NOPRESALE, containNocTura, containSolscan, expectContained, launchContained} from './launch';
import {installFakeCoordinator} from './fakeCoordinator';
import {launchPopup, seedUnlockedWallet} from './popupHarness';

// B1e §6.1 / §6.2 (privacy sentences P2, R2, R8): what the store build's requests to the coordinator carry, as the
// coordinator's access log would see them. The background's real code paths (wallet.prices: two GETs; wallet.balances:
// RPC POSTs) and the broadcast route's request shape, each recorded with its headers before the fake answers it. The
// B1e-2 dry run read the same headers on the wire from a local TLS server (Task 3 Notes): they agree with these.
//
// Positive control: a request from an ordinary https page to the same host IS recorded with its Referer and Origin —
// so "none" below means the extension sent none, not that the recorder cannot see one.

// The extension page's own API, as e2e/csp.spec.ts declares it (only what this spec calls).
declare const chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}};

const HOST = 'headers.test';
const OWNER = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

interface Seen {
  method: string;
  url: string;
  headers: Record<string, string>;
}

test('the store build: no Referer on any coordinator request; Origin only on the POSTs, the extension origin; no cookie', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-headers-', {ext: EXT_NOPRESALE, hosts: [HOST]});
  const nocTura = await containNocTura(ctx);
  const fake = await installFakeCoordinator(ctx);
  const solscan = await containSolscan(ctx);
  const seen: Seen[] = [];
  const record = async (req: Request) => seen.push({method: req.method(), url: req.url(), headers: await req.allHeaders()});
  // Registered last, so it runs first: it records, then hands the request to the fake coordinator.
  await ctx.route(/^https:\/\/api\.noc-tura\.io\//, async route => {
    await record(route.request());
    return route.fallback();
  });
  await ctx.route(`https://${HOST}/**`, route => route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>t</title><p>page</p>'}));
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;
    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${id}/wallet.html`);

    // The real paths: the background's own requests, asked for by an extension page.
    const prices = await page.evaluate(() => chrome.runtime.sendMessage({type: 'wallet.prices'}));
    expect(prices).toMatchObject({ok: true});
    const balances = await page.evaluate(account => chrome.runtime.sendMessage({type: 'wallet.balances', account}), OWNER);
    expect(balances).toMatchObject({ok: true});
    // The broadcast route's request exactly as core/solana/broadcast.ts sends it (its init, from the worker).
    await sw.evaluate(() =>
      fetch('https://api.noc-tura.io/api/v1/tx/broadcast', {method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({transaction: ''}), credentials: 'omit'}).then(
        r => r.status,
        () => 0,
      ),
    );

    const ours = [...seen];
    const paths = ours.map(s => `${s.method} ${new URL(s.url).pathname}`);
    expect(paths).toContain('GET /api/v1/wallet/prices');
    expect(paths).toContain('GET /api/v1/stats');
    expect(paths).toContain('POST /api/v1/rpc');
    expect(paths).toContain('POST /api/v1/tx/broadcast');
    for (const s of ours) {
      const where = `${s.method} ${s.url}`;
      expect(s.headers.referer, `${where}: Referer`).toBeUndefined();
      expect(s.headers.cookie, `${where}: Cookie`).toBeUndefined();
      expect(s.headers['user-agent'], `${where}: User-Agent`).toMatch(/Chrome\//);
      if (s.method === 'GET') expect(s.headers.origin, `${where}: Origin`).toBeUndefined();
      else expect(s.headers.origin, `${where}: Origin`).toBe(`chrome-extension://${id}`);
    }

    // Positive control: an https page's request to the same host is seen with both headers.
    const site = await ctx.newPage();
    await site.goto(`https://${HOST}/page`);
    await site.evaluate(() => fetch('https://api.noc-tura.io/api/v1/stats').then(r => r.status, () => 0));
    const control = seen.slice(ours.length).find(s => new URL(s.url).pathname === '/api/v1/stats');
    expect(control?.headers.referer).toBe(`https://${HOST}/`);
    expect(control?.headers.origin).toBe(`https://${HOST}`);

    expect(fake.unexpected).toEqual([]);
    expect(nocTura.hits).toEqual([]);
    expect(solscan.hits).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});

// Privacy sentence L1: the noc-tura.io pages the extension links to (#1's Terms and Privacy Policy, #38's Help &
// support) are opened by the browser with no Referer. Each real link is clicked; its navigation is recorded with its
// headers, then handed on to containNocTura (counted, aborted — noc-tura.io is never reached). Positive control: a link
// to the same host clicked on an ordinary https page IS recorded with its Referer.
test('the store build: #1 and #38 open noc-tura.io with no Referer (privacy sentence L1)', async () => {
  const h = await launchPopup('noctura-e2e-headers-links-', {ext: EXT_NOPRESALE, hosts: [HOST]});
  const navigations: Seen[] = [];
  await h.ctx.route(/^https:\/\/noc-tura\.io\//, async route => {
    const req = route.request();
    navigations.push({method: req.method(), url: req.url(), headers: await req.allHeaders()});
    return route.fallback();
  });
  await h.ctx.route(`https://${HOST}/**`, route =>
    route.fulfill({status: 200, contentType: 'text/html', body: '<!doctype html><title>t</title><a id="out" href="https://noc-tura.io/extension/help">help</a>'}),
  );
  const TERMS = 'https://noc-tura.io/extension/terms';
  const PRIVACY = 'https://noc-tura.io/extension/privacy';
  const HELP = 'https://noc-tura.io/extension/help';
  const opens = async (click: () => Promise<void>) => {
    const [tab] = await Promise.all([h.ctx.waitForEvent('page'), click()]);
    return tab;
  };
  try {
    const vault = await h.ctx.newPage();
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
    await opens(() => vault.locator('#wel-terms-link').click());
    await expect.poll(() => navigations.length).toBe(1);
    await opens(() => vault.locator('#wel-privacy-link').click());
    await expect.poll(() => navigations.length).toBe(2);

    await seedUnlockedWallet(h.sw);
    const p = await h.openPopup();
    await p.getByRole('button', {name: 'Settings'}).click();
    await p.getByText('About Noctura').click();
    await opens(() => p.getByRole('link', {name: 'Help & support (opens in a new tab)'}).click());
    await expect.poll(() => navigations.length).toBe(3);

    expect(navigations.map(n => `${n.method} ${n.url}`)).toEqual([`GET ${TERMS}`, `GET ${PRIVACY}`, `GET ${HELP}`]);
    for (const n of navigations) {
      expect(n.headers.referer, `${n.url}: Referer`).toBeUndefined();
      expect(n.headers.cookie, `${n.url}: Cookie`).toBeUndefined();
      expect(n.headers['user-agent'], `${n.url}: User-Agent`).toMatch(/Chrome\//);
    }

    // Positive control: the same host, a link on an https page — the recorder sees the Referer that page sends.
    const site = await h.ctx.newPage();
    await site.goto(`https://${HOST}/page`);
    await site.locator('#out').click().catch(() => undefined);
    await expect.poll(() => navigations.length).toBe(4);
    expect(navigations[3]?.url).toBe(HELP);
    expect(navigations[3]?.headers.referer).toBe(`https://${HOST}/`);

    expect(h.nocTura.hits).toEqual([TERMS, PRIVACY, HELP, HELP]);
    expect(h.fake.unexpected).toEqual([]);
    expect(h.solscan.hits).toEqual([]);
  } finally {
    await h.close();
  }
});
```

- [ ] **Step 3: Run — red.**

Run (in `extension/`, on Task 2's tree — observed on 0fcf769 with only the two test files copied in): `TZ=UTC npx vitest run scripts/__tests__/privacy.test.mjs scripts/__tests__/live-check.test.mjs`
Expected: `Test Files  2 failed (2)` · `Tests  no tests` —
`Error: Cannot find module '../live-check.mjs' imported from …/scripts/__tests__/live-check.test.mjs` and
`Error: Cannot find module '../../release/privacySentences.mjs' imported from …/scripts/__tests__/privacy.test.mjs`.
`e2e/requestHeaders.spec.ts` (both tests) **passes** on the old tree — it pins Chrome's behaviour with the code as it is; its controls (M-e2e-blind, M-e2e-control-gone, M-e2e-L1-control, Step 8) are what prove it bites. `tsc` is unaffected by the `.mjs` files (`scripts/` and `release/` are outside `tsconfig.json`'s `include`); the spec compiles (`declare const chrome`, as `csp.spec.ts` does).

- [ ] **Step 4: Implement.**

Create `extension/release/ico-retention.md` (the answer's lines 4–17 byte for byte from the owner's paste `.superpowers/sdd/b1e-ico-retention-2026-11-01.md`; checked: `diff <(sed -n 4,17p <paste>) <(tail -14 release/ico-retention.md)` → no output):

```markdown
# ICO's answer to B1e spec §6.2 (precondition P-R): what the coordinator records, keeps and shares

- **Received:** 2026-11-01, from ICO (the coordinator's maintainer), pasted by the owner.
- **ICO's commits:** 67bcec0, 6c68431, c803bc1 — deployed, the statements measured on production on 2026-11-01.
- **The question asked:** spec §6.2, verbatim (the six routes the extension calls; (1) what is recorded, (2) where,
  (3) for how long, (4) who receives it outside the coordinator, (5) whether it is sold or used for anything but
  answering, (6) a contact for deletion requests).
- **Turned into:** sentences R1–R21 of `release/privacySentences.mjs` (R2 and R8 are the extension's own measured
  headers, not ICO's), published in `release/privacy.md`. ICO will tell us before any change to logging, the nginx
  format, CrowdSec sharing or upstream forwarding; such a change makes the R-sentences a finding to re-derive.
- **Not reproduced below:** the answer's closing "Also:" paragraph (the B4 Telegram checks and an EVM ingestion
  outage) — it answers no part of §6.2's question.

The answer, verbatim (lines 4–17 of the owner's paste):

Changes made for the statements to be true: app logs now rotate daily, deleted after 14 days (older deleted); CrowdSec alert-context forwarding to its console OFF; GeoLite2 now updates daily (was stale since 2026-06-24); upstream RPC key redacted from every log line/alert (existing lines cleaned); contact page now says privacy@noc-tura.io. ICO will tell us before any change to logging, nginx format, CrowdSec sharing or upstream forwarding.

1–2 Recorded / where:
- nginx access log, every request: client IP, time, method, path incl. query string (e.g. token ids on /wallet/prices), response status and size, Referer and User-Agent. Not: request bodies, Origin, other headers.
- App log (info): /rpc — nothing for an answered request; on refusal the reason + JSON-RPC method name; upstream unreachable → method name; never params, IPs, headers. /tx/broadcast — transaction signature + outcome HTTP status; not the transaction, IP or headers. /wallet/prices, /stats, /geo/check, /geo/restricted-list — nothing per request; server errors only, with no request data. Any route: a non-allow-listed Origin value is logged, without the IP.
- PostgreSQL: none of the six routes writes anything.
- Memory only: IP as rate-limit key (app memory + nginx shared memory), one-minute window, never on disk.
- /geo/check: IP looked up in a local GeoLite2 file; neither IP nor result stored.
- CrowdSec local: agent reads the nginx access log; on a scenario match stores an alert (IP, scenario, time, path, method, status, User-Agent of the triggering requests); bouncer enforces bans. No scenario → no alert.
- CrowdSec central: enrolled in Central API + console with signal sharing: for a triggering IP CrowdSec receives IP, scenario, time — no paths, methods, statuses, User-Agents. The bouncer only queries the local API.
3 Retention: nginx logs rotate daily, 14 rotated files kept (≈ 15 days max), auto-deleted; app logs daily, >14 days deleted by a daily job; CrowdSec local alerts deleted after 7 days or once >5 000; central data under CrowdSec's privacy policy.
4 Outside recipients: Helius (upstream RPC) receives the JSON-RPC body for /rpc (method + params, can include wallet addresses) and the signed transaction for /tx/broadcast, from the server's IP — client IP, Origin, User-Agent, other headers NOT forwarded. CoinGecko: server requests SOL/USDC/USDT prices at most once a minute, clients served from cache, CoinGecko receives no client data. GeoLite2: local MaxMind file, lookups never leave the server; daily download sends no client data. CrowdSec as above.
5 Use: only to answer requests, protect from abuse (rate limits, CrowdSec), diagnose faults. Not sold or shared for any other purpose.
6 Deletion requests: privacy@noc-tura.io.
```

Create `extension/release/privacySentences.mjs`:

```js
// B1e §6.1, §6.2, §6.5: the privacy policy's required sentences — the one list the offline test
// (scripts/__tests__/privacy.test.mjs: each verbatim in release/privacy.md) and the release script's live check
// (scripts/live-check.mjs: each on https://noc-tura.io/extension/privacy) both read. Every sentence is published to
// users as a fact: each names its source, and a sentence that stops being true is a finding to fix here and in
// privacy.md together — never an edit to the page alone.
//
// P1–P16: spec §6.1's sentences, re-derived from the --no-presale build's real network calls; P3, P5 and P8 as
// corrected by B1e-2's dry run (spec rev 2.7). L1 (after P9, the controller's ruling): the noc-tura.io pages the
// extension links to. R1–R21: ICO's §6.2 answer (release/ico-retention.md, received
// 2026-11-01), each sentence saying only what that answer states — except R2 and R8, which are the extension's own
// measured request headers (e2e/requestHeaders.spec.ts), and say so in `source`.

/** @typedef {{id: string, text: string, source: string}} PrivacySentence */

/** @type {readonly PrivacySentence[]} */
export const PRIVACY_SENTENCES = Object.freeze([
  {
    id: 'P1',
    text: 'The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator.',
    source: 'manifest/source.mjs EXTENSION_CSP connect-src (:49–51); src/background/deps.ts browserDeps (:169), the one global network call (timedFetch, :132)',
  },
  {
    id: 'P2',
    text: 'Every request to the coordinator carries your IP address and the standard headers your browser sends.',
    source: 'every route through src/background/deps.ts (credentials: omit — no cookies); measured in e2e/requestHeaders.spec.ts',
  },
  {
    id: 'P3',
    text: 'The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing.',
    source: 'wallet.balances (src/background/walletApi.ts:341) from WalletContext.tsx:204 (the account viewed) and useAccountBalances.ts:6,67 (FRESH_ROWS = 10: switcher, accounts manager, #37); history.ts:65 getSignaturesForAddress (Activity.tsx:118)',
  },
  {
    id: 'P4',
    text: 'When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds.',
    source: 'wallet.probeBalances, MAX_PROBE = 6 (src/background/walletApi.ts:56, :139); importCandidates SLIP10_ACCOUNTS_TO_SCAN = 5 + the CLI account (src/unlock/onboarding.ts:16, :48–49), probeCandidates (:65)',
  },
  {
    id: 'P5',
    text: 'Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it, and every 5 seconds after a simulation that fails. When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token.',
    source: 'src/background/prepare.ts:370; src/background/dapp/simulate.ts:304; SIM_REFRESH_MS = 30 000 and SIM_RETRY_MS = 5 000 (src/background/dapp/signTx.ts:39, :43, needsSimulation :79), the window polling every POLL_MS = 1 000 (src/approve/Approve.tsx:10, :77); the recipient asked about first: getAccountKind of the address sent to (src/background/prepare.ts:311 SOL, :332 token) and getAccountExists of its associated token address (:333), both before simulateTransaction (:370), on each prepare (Review.tsx:110, Confirm.tsx:162 when the quote expired) — pinned in scripts/__tests__/privacy.test.mjs',
  },
  {
    id: 'P6',
    text: 'Every transaction the wallet submits is sent to the coordinator, which broadcasts it to Solana: your own sends, and the transactions a site asks the wallet to sign and send. A transaction a site asks only to sign is returned to that site.',
    source: '/tx/broadcast (core/solana/broadcast.ts:12, :81) from src/background/pending.ts:48; finishSend vs finishSignTx (src/background/dapp/signTx.ts:462, :409 — Pick<WalletDeps, now>, no network)',
  },
  {
    id: 'P7',
    text: 'The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data.',
    source: 'PRICE_PATH (core/portfolio/prices.ts:8); /stats (src/background/deps.ts stagePrice :189–195; callers prepare.ts:180, walletApi.ts:176, dapp/simulate.ts:226) — GET, no body',
  },
  {
    id: 'P8',
    text: 'Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes.',
    source: 'carriesPurchase / runSimulation (src/background/dapp/signTx.ts:68, :106), decide.ts:340–341; GEO_LIST_CACHE_MS (src/background/geo/gate.ts:24, :53 — in memory, a failed read not kept); presale/buy.ts not in the store build (check-no-presale.mjs OFF_FORBIDDEN)',
  },
  {
    id: 'P9',
    text: "When you open a transaction in the Solscan explorer, Solscan receives that transaction's signature, your IP address and your browser's standard headers; no referrer is sent.",
    source: 'src/app/explorer.ts:4; rel="noopener noreferrer" (src/app/screens/TxDetail.tsx:65); measured: no Referer on the navigation (B1e-2 dry run, Task 3 Notes)',
  },
  {
    id: 'L1',
    text: "When you open the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives your IP address and your browser's standard headers, as any website you open does; no referrer is sent.",
    source: 'NOCTURA_PAGES (src/shared/links.ts:6–10), opened by <a target="_blank" rel="noopener noreferrer"> on #1 (unlock.html:49) and #38 (src/app/screens/About.tsx:23); measured: no Referer on the navigation (e2e/requestHeaders.spec.ts, and on the wire in the B1e-2 dry run, Task 3 Notes)',
  },
  {
    id: 'P10',
    text: 'Messages a site asks you to sign are signed on this device and are not sent anywhere by the wallet.',
    source: 'src/background/dapp/signMessage.ts finishSign (:139 — Pick<WalletDeps, now>, no network dependency)',
  },
  {
    id: 'P11',
    text: 'Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.',
    source: 'the vault isolation gate (scripts/check-vault-isolation.mjs); the routes above',
  },
  {
    id: 'P12',
    text: 'If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it. In your passkey manager the passkey is listed under the name wallet.noc-tura.io.',
    source: "the WebAuthn ceremony is the browser's; no route carries it; RP_ID (src/vault/passkey.ts:8)",
  },
  {
    id: 'P13',
    text: 'The sites you connected, your address book and your anti-phishing phrase are stored only in this browser. Nothing is served at wallet.noc-tura.io and the extension never connects to it; the name exists only so that passkeys are bound to a name no website can use.',
    source: 'GRANTS_KEY (src/background/dapp/grants.ts:8), CONTACTS_KEY (contacts.ts:18), PHRASE_KEY (phraseKey.ts:6), in storage.local, no storage.sync anywhere; no route carries them; connect-src (spec §5.6)',
  },
  {
    id: 'P14',
    text: "The extension reads nothing from the pages you visit; a site's own requests to the wallet are the only page data it handles.",
    source: "CONTENT_SCRIPTS.reason (manifest/source.mjs:20–23); src/relay/relay.ts (the port opened on the page's first request only, :9, :171), src/provider",
  },
  {
    id: 'P15',
    text: 'The extension sends no analytics, telemetry or crash reports.',
    source: 'spec §4.3 route list; the one global network call is deps.ts timedFetch, to API_BASE',
  },
  {
    id: 'P16',
    text: 'Questions about privacy: privacy@noc-tura.io.',
    source: 'owner decision E8',
  },
  {
    id: 'R1',
    text: "The coordinator's web server writes every request to its access log: your IP address, the time, the method, the path including its query string (for example the token identifiers in a price request), the response status and size, and the Referer and User-Agent headers. It does not log request bodies, the Origin header or any other header.",
    source: 'ICO §6.2 answer 1–2, nginx access log',
  },
  {
    id: 'R2',
    text: "The extension's requests carry no Referer header; their User-Agent is your browser's.",
    source: 'measured, not ICO: e2e/requestHeaders.spec.ts (the store build, a service-worker fetch has no Referer; B1e-2 dry run on the wire, Task 3 Notes)',
  },
  {
    id: 'R3',
    text: 'The access logs are rotated daily and deleted automatically: 14 rotated files are kept, so a request stays in them for about 15 days at most.',
    source: 'ICO §6.2 answer 3, nginx',
  },
  {
    id: 'R4',
    text: "The coordinator's application log records nothing about an RPC request it answers. When it refuses one, it records the reason and the name of the RPC method; when the Solana network provider cannot be reached, the method name. It never records the request's parameters, your IP address or your headers.",
    source: 'ICO §6.2 answer 1–2, app log, /rpc',
  },
  {
    id: 'R5',
    text: "For each transaction submitted for broadcast, the application log records the transaction's signature and the HTTP status of the outcome, not the transaction itself, your IP address or your headers.",
    source: 'ICO §6.2 answer 1–2, app log, /tx/broadcast',
  },
  {
    id: 'R6',
    text: 'Price, presale statistics, region and restricted-country list requests are not recorded in the application log; only server errors are, with no data from the request.',
    source: 'ICO §6.2 answer 1–2, app log, /wallet/prices, /stats, /geo/check, /geo/restricted-list',
  },
  {
    id: 'R7',
    text: "On any route, an Origin header that is not on the coordinator's allow list is logged with its value, without your IP address.",
    source: 'ICO §6.2 answer 1–2, app log, any route',
  },
  {
    id: 'R8',
    text: 'The extension sends an Origin header only with its RPC and broadcast requests, and that Origin is the same for every user of the extension.',
    source: "measured, not ICO: e2e/requestHeaders.spec.ts (POST carries chrome-extension://<id>, GET none); the store build's ID is the store's, one for every install (spec §6.1)",
  },
  {
    id: 'R9',
    text: 'Application logs are rotated daily, and a daily job deletes those older than 14 days.',
    source: 'ICO §6.2 answer 3, app logs',
  },
  {
    id: 'R10',
    text: "None of the extension's requests writes anything to the coordinator's database.",
    source: 'ICO §6.2 answer 1–2, PostgreSQL',
  },
  {
    id: 'R11',
    text: 'To enforce rate limits, the coordinator keeps your IP address in memory for a one-minute window; it is never written to disk.',
    source: 'ICO §6.2 answer 1–2, memory only',
  },
  {
    id: 'R12',
    text: "The country of your IP address is looked up in a MaxMind GeoLite2 database file on the coordinator itself: the lookup never leaves the server, neither your IP address nor the result is stored, and the file's daily update sends no data about you.",
    source: 'ICO §6.2 answer 1–2 (/geo/check) and 4 (GeoLite2)',
  },
  {
    id: 'R13',
    text: 'The coordinator runs CrowdSec, which reads the access log to detect abuse. When requests match one of its attack scenarios, it stores an alert with the IP address, the scenario, the time, and the path, method, status and User-Agent of those requests, and the IP address may be blocked. Requests that match no scenario create no alert.',
    source: 'ICO §6.2 answer 1–2, CrowdSec local',
  },
  {
    id: 'R14',
    text: "CrowdSec's local alerts are deleted after 7 days, or once more than 5,000 are stored.",
    source: 'ICO §6.2 answer 3, CrowdSec local',
  },
  {
    id: 'R15',
    text: "For an IP address that triggered an alert, CrowdSec's central service receives the IP address, the scenario and the time, but no paths, methods, statuses or User-Agents; that data is held under CrowdSec's own privacy policy.",
    source: 'ICO §6.2 answer 1–2 and 3, CrowdSec central',
  },
  {
    id: 'R16',
    text: 'To decide whether to block a request, the coordinator asks only its own local CrowdSec.',
    source: 'ICO §6.2 answer 1–2: the bouncer only queries the local API',
  },
  {
    id: 'R17',
    text: 'The coordinator forwards RPC requests to its Solana network provider, Helius: Helius receives the body of each RPC request (the method and its parameters, which can include wallet addresses) and each signed transaction submitted for broadcast.',
    source: 'ICO §6.2 answer 4, Helius',
  },
  {
    id: 'R18',
    text: "Helius receives these from the coordinator's own IP address; your IP address, Origin, User-Agent and other headers are not forwarded.",
    source: 'ICO §6.2 answer 4, Helius',
  },
  {
    id: 'R19',
    text: 'Prices for SOL, USDC and USDT come from CoinGecko: the coordinator asks for them at most once a minute and answers the wallet from its own copy, so CoinGecko receives no data about you.',
    source: 'ICO §6.2 answer 4, CoinGecko',
  },
  {
    id: 'R20',
    text: 'The coordinator uses this data only to answer requests, to protect the service from abuse (rate limits and CrowdSec) and to diagnose faults. It is not sold or shared for any other purpose.',
    source: 'ICO §6.2 answer 5',
  },
  {
    id: 'R21',
    text: 'To ask for data about you to be deleted, write to privacy@noc-tura.io.',
    source: 'ICO §6.2 answer 6',
  },
].map(s => Object.freeze(s)));
```

Create `extension/release/privacy.md` (every sentence verbatim, one per paragraph — R17 and R18 share one; the dry run rendered it from a template with `{P1}`… placeholders, refusing an unknown or an unused id, so no sentence was retyped):

```markdown
# Privacy Policy

This policy covers the Noctura browser extension for Chrome, a Solana wallet. It says what the
extension sends, to whom, and what the Noctura coordinator keeps. Solana is a public blockchain: anyone can read an
account's balance and the transactions it took part in.

## What the extension sends

The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator.

Every request to the coordinator carries your IP address and the standard headers your browser sends.

The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing.

When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds.

Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it, and every 5 seconds after a simulation that fails. When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token.

Every transaction the wallet submits is sent to the coordinator, which broadcasts it to Solana: your own sends, and the transactions a site asks the wallet to sign and send. A transaction a site asks only to sign is returned to that site.

The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data.

Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes.

When you open a transaction in the Solscan explorer, Solscan receives that transaction's signature, your IP address and your browser's standard headers; no referrer is sent.

When you open the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives your IP address and your browser's standard headers, as any website you open does; no referrer is sent.

## What the extension does not send

Messages a site asks you to sign are signed on this device and are not sent anywhere by the wallet.

Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.

If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it. In your passkey manager the passkey is listed under the name wallet.noc-tura.io.

The sites you connected, your address book and your anti-phishing phrase are stored only in this browser. Nothing is served at wallet.noc-tura.io and the extension never connects to it; the name exists only so that passkeys are bound to a name no website can use.

The extension reads nothing from the pages you visit; a site's own requests to the wallet are the only page data it handles.

The extension sends no analytics, telemetry or crash reports.

## What the coordinator keeps, for how long, and who else receives it

### The web server

The coordinator's web server writes every request to its access log: your IP address, the time, the method, the path including its query string (for example the token identifiers in a price request), the response status and size, and the Referer and User-Agent headers. It does not log request bodies, the Origin header or any other header.

The extension's requests carry no Referer header; their User-Agent is your browser's.

The access logs are rotated daily and deleted automatically: 14 rotated files are kept, so a request stays in them for about 15 days at most.

### The application log

The coordinator's application log records nothing about an RPC request it answers. When it refuses one, it records the reason and the name of the RPC method; when the Solana network provider cannot be reached, the method name. It never records the request's parameters, your IP address or your headers.

For each transaction submitted for broadcast, the application log records the transaction's signature and the HTTP status of the outcome, not the transaction itself, your IP address or your headers.

Price, presale statistics, region and restricted-country list requests are not recorded in the application log; only server errors are, with no data from the request.

On any route, an Origin header that is not on the coordinator's allow list is logged with its value, without your IP address.

The extension sends an Origin header only with its RPC and broadcast requests, and that Origin is the same for every user of the extension.

Application logs are rotated daily, and a daily job deletes those older than 14 days.

### Memory, the database and the region lookup

None of the extension's requests writes anything to the coordinator's database.

To enforce rate limits, the coordinator keeps your IP address in memory for a one-minute window; it is never written to disk.

The country of your IP address is looked up in a MaxMind GeoLite2 database file on the coordinator itself: the lookup never leaves the server, neither your IP address nor the result is stored, and the file's daily update sends no data about you.

### Abuse protection (CrowdSec)

The coordinator runs CrowdSec, which reads the access log to detect abuse. When requests match one of its attack scenarios, it stores an alert with the IP address, the scenario, the time, and the path, method, status and User-Agent of those requests, and the IP address may be blocked. Requests that match no scenario create no alert.

CrowdSec's local alerts are deleted after 7 days, or once more than 5,000 are stored.

For an IP address that triggered an alert, CrowdSec's central service receives the IP address, the scenario and the time, but no paths, methods, statuses or User-Agents; that data is held under CrowdSec's own privacy policy.

To decide whether to block a request, the coordinator asks only its own local CrowdSec.

### Outside services

The coordinator forwards RPC requests to its Solana network provider, Helius: Helius receives the body of each RPC request (the method and its parameters, which can include wallet addresses) and each signed transaction submitted for broadcast. Helius receives these from the coordinator's own IP address; your IP address, Origin, User-Agent and other headers are not forwarded.

Prices for SOL, USDC and USDT come from CoinGecko: the coordinator asks for them at most once a minute and answers the wallet from its own copy, so CoinGecko receives no data about you.

### Use and deletion

The coordinator uses this data only to answer requests, to protect the service from abuse (rate limits and CrowdSec) and to diagnose faults. It is not sold or shared for any other purpose.

To ask for data about you to be deleted, write to privacy@noc-tura.io.

## Contact

Questions about privacy: privacy@noc-tura.io.
```

Create `extension/scripts/live-check.mjs`:

```js
// B1e §6.5: the live check — the three pages ICO publishes on noc-tura.io, read as the release sees them. Part of
// `npm run release:chrome` only (scripts/release-chrome.mjs calls liveCheck with the real fetch): never in `verify`,
// CI, a test or under `unshare -rn`. This module has no CLI and no default fetch — it cannot reach the network unless
// its caller hands it a fetch, so no test and no other script contacts noc-tura.io through it (controller ruling: the
// one sanctioned contact is the release script's three GETs, once).
//
// The comparison (pure, offline-tested with fixture HTML): the page's text after removing comments, <script>,
// <style> and <template> with their content, then every tag; decoding HTML entities (named, and numeric as a browser
// does — 0x80–0x9F through Windows-1252); NFC; ’ → ', “ and ” → "; every whitespace run (NBSP and the other Unicode
// spaces included) → one space. Each required sentence, folded the same way, must be a case-sensitive substring of
// it. A failure names the sentence (its id and text) or the page.
import {PRIVACY_SENTENCES} from '../release/privacySentences.mjs';

/** The contact every page carries (E8). */
export const CONTACT = 'privacy@noc-tura.io';

/**
 * The three pages, in the order they are read. The URLs are src/shared/links.ts NOCTURA_PAGES' (a test pins them
 * equal); each title is the label of the #38 row that opens it (src/app/screens/About.tsx ABOUT_TEXT), so the page a
 * user lands on is headed with the name they clicked. Terms and Help must each carry their title and CONTACT; the
 * privacy page must carry every sentence of privacySentences.mjs (P16 is the contact).
 */
export const LIVE_PAGES = Object.freeze([
  Object.freeze({name: 'privacy', url: 'https://noc-tura.io/extension/privacy', title: 'Privacy Policy', sentences: true}),
  Object.freeze({name: 'terms', url: 'https://noc-tura.io/extension/terms', title: 'Terms of Service', sentences: false}),
  Object.freeze({name: 'help', url: 'https://noc-tura.io/extension/help', title: 'Help & support', sentences: false}),
]);

/**
 * The named entities decoded. Any other named entity is left as written, so a sentence containing one fails (fail
 * closed: the check never guesses what an unknown entity renders as). These cover every character an editor or a CMS
 * writes into prose; the full HTML table is not needed for that.
 */
export const NAMED_ENTITIES = Object.freeze({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0',
  lsquo: '\u2018', rsquo: '\u2019', sbquo: '\u201a', ldquo: '\u201c', rdquo: '\u201d', bdquo: '\u201e',
  ndash: '\u2013', mdash: '\u2014', minus: '\u2212', hellip: '\u2026', middot: '\u00b7', bull: '\u2022',
  laquo: '\u00ab', raquo: '\u00bb', copy: '\u00a9', reg: '\u00ae', trade: '\u2122', euro: '\u20ac', deg: '\u00b0', times: '\u00d7',
  ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', hairsp: '\u200a', shy: '\u00ad', zwnj: '\u200c', zwj: '\u200d', lrm: '\u200e', rlm: '\u200f',
});

/** What a browser renders a numeric reference 0x80–0x9F as (HTML's Windows-1252 remap); the five unassigned stay. */
const WINDOWS_1252 = new Map([
  [0x80, 0x20ac], [0x82, 0x201a], [0x83, 0x0192], [0x84, 0x201e], [0x85, 0x2026], [0x86, 0x2020], [0x87, 0x2021],
  [0x88, 0x02c6], [0x89, 0x2030], [0x8a, 0x0160], [0x8b, 0x2039], [0x8c, 0x0152], [0x8e, 0x017d], [0x91, 0x2018],
  [0x92, 0x2019], [0x93, 0x201c], [0x94, 0x201d], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014], [0x98, 0x02dc],
  [0x99, 0x2122], [0x9a, 0x0161], [0x9b, 0x203a], [0x9c, 0x0153], [0x9e, 0x017e], [0x9f, 0x0178],
]);

function numericChar(code) {
  if (code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '\ufffd';
  return String.fromCodePoint(WINDOWS_1252.get(code) ?? code);
}

/** HTML entities decoded: `&name;` from NAMED_ENTITIES, `&#123;` and `&#x7b;` as a browser does. One pass: `&amp;lt;` is "&lt;". */
export function decodeEntities(text) {
  return text.replace(/&(?:#(\d+)|#[xX]([0-9a-fA-F]+)|([A-Za-z][A-Za-z0-9]*));/g, (whole, dec, hex, name) => {
    if (dec !== undefined) return numericChar(Number.parseInt(dec, 10));
    if (hex !== undefined) return numericChar(Number.parseInt(hex, 16));
    return Object.hasOwn(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : whole;
  });
}

/** NFC; ’ → '; “ and ” → "; every whitespace run (`\s`: NBSP and the Unicode spaces included) → one space. */
export function foldText(text) {
  return text
    .normalize('NFC')
    .replace(/\u2019/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/gu, ' ');
}

/** The text a page's HTML is compared on (the module comment's order). */
export function pageText(html) {
  const text = html
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|template)\b(?:"[^"]*"|'[^']*'|[^'">])*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '')
    .replace(/<[/!?]?[A-Za-z](?:"[^"]*"|'[^']*'|[^'">])*>/g, '')
    .replace(/<![^>]*>/g, '');
  return foldText(decodeEntities(text));
}

/** The sentences of `sentences` whose folded text is not a substring of the page's text. */
export function missingSentences(html, sentences = PRIVACY_SENTENCES) {
  const text = pageText(html);
  return sentences.filter(s => !text.includes(foldText(s.text)));
}

/** Everything wrong with one page's HTML (no status: the runner checks that first). */
export function pageProblems(page, html, sentences = PRIVACY_SENTENCES) {
  if (page.sentences) return missingSentences(html, sentences).map(s => `${page.name}: missing ${s.id}: "${s.text}"`);
  const text = pageText(html);
  const out = [];
  if (!text.includes(foldText(page.title))) out.push(`${page.name}: missing its title "${page.title}"`);
  if (!text.includes(CONTACT)) out.push(`${page.name}: missing the contact ${CONTACT}`);
  return out;
}

/**
 * The live check: each page fetched once, one at a time (each answered and read before the next is asked), GET with
 * `redirect: 'manual'`; it must answer 200 — a redirect (3xx, or a browser's opaque redirect) fails, as does any other
 * status or no answer — and then pass pageProblems. Resolves `{ok, problems}`; never throws for a page's failure.
 *
 * @param {{fetch: (url: string, init: {method: 'GET', redirect: 'manual'}) => Promise<{status: number, type?: string, headers?: {get(name: string): string | null}, text(): Promise<string>}>, pages?: readonly object[], sentences?: readonly {id: string, text: string}[]}} io
 */
export async function liveCheck(io) {
  const fetch = io?.fetch;
  if (typeof fetch !== 'function') throw new TypeError('liveCheck needs an injected fetch (it has no default)');
  const pages = io.pages ?? LIVE_PAGES;
  const sentences = io.sentences ?? PRIVACY_SENTENCES;
  const problems = [];
  for (const page of pages) {
    let res;
    try {
      res = await fetch(page.url, {method: 'GET', redirect: 'manual'});
    } catch (e) {
      problems.push(`${page.name}: ${page.url} did not answer (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    if (res.status !== 200 || res.type === 'opaqueredirect') {
      const to = res.headers?.get('location') ?? null;
      problems.push(`${page.name}: ${page.url} answered ${res.status}${to === null ? '' : ` (Location: ${to})`}, want 200 — a redirect fails`);
      continue;
    }
    let html;
    try {
      html = await res.text();
    } catch (e) {
      problems.push(`${page.name}: ${page.url}'s body could not be read (${e instanceof Error ? e.message : String(e)})`);
      continue;
    }
    problems.push(...pageProblems(page, html, sentences));
  }
  return {ok: problems.length === 0, problems};
}
```

- [ ] **Step 5: Measure what the store build's requests carry (the R2 / R8 / P2 / P9 facts) — on the wire, contained.**

The E2E reads headers at Playwright's route; this step checks that the route sees what the network sends. A scratch directory outside the repo (`$P`), a throwaway certificate, a local TLS server; `api.noc-tura.io`, `noc-tura.io` and `solscan.io` mapped to it, every other name `~NOTFOUND`, `--ignore-certificate-errors`, and the whole run under `unshare -rn` (no route out at all). Nothing is committed.

```bash
cd "$P" && openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 2 -subj "/CN=api.noc-tura.io" -addext "subjectAltName=DNS:api.noc-tura.io,DNS:solscan.io,DNS:noc-tura.io"
```

`$P/probe.mjs`:

```js
// Scratch probe (not committed): what a background service-worker fetch of the built store extension sends on the
// wire as Referer / Origin / User-Agent, read by a real local TLS server (raw headers), api.noc-tura.io and solscan.io
// mapped to 127.0.0.1 by --host-resolver-rules. Run under `unshare -rn` (no route out at all).
import {createServer} from 'node:https';
import {readFileSync, mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

// Run from extension/ (its node_modules and its built dist-nopresale); key.pem / cert.pem beside this file.
const {chromium} = await import(pathToFileURL(resolve('node_modules/@playwright/test/index.mjs')).href);

const DIR = new URL('.', import.meta.url).pathname;
const EXT = resolve('dist-nopresale/chrome');
const seen = [];
const server = createServer({key: readFileSync(join(DIR, 'key.pem')), cert: readFileSync(join(DIR, 'cert.pem'))}, (req, res) => {
  const h = {};
  for (let i = 0; i < req.rawHeaders.length; i += 2) h[req.rawHeaders[i].toLowerCase()] = req.rawHeaders[i + 1];
  seen.push({method: req.method, host: h.host, url: req.url, origin: h.origin ?? null, referer: h.referer ?? null, ua: h['user-agent'] ?? null, cookie: h.cookie ?? null, names: Object.keys(h)});
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST'});
    return res.end();
  }
  res.writeHead(200, {'content-type': 'application/json', 'access-control-allow-origin': '*'});
  res.end(JSON.stringify({success: true, data: {}}));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const rules = `--host-resolver-rules=MAP api.noc-tura.io 127.0.0.1:${port}, MAP solscan.io 127.0.0.1:${port}, MAP noc-tura.io 127.0.0.1:${port}, MAP * ~NOTFOUND, EXCLUDE 127.0.0.1`;
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 't3probe-')), {
  channel: 'chromium',
  headless: true,
  args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, rules, '--ignore-certificate-errors'],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const id = new URL(sw.url()).host;
const mark = label => seen.push({label});

// 1. The real code path: an extension page asks the background for prices (GET /wallet/prices and GET /stats, deps.ts).
const tab = await ctx.newPage();
await tab.goto(`chrome-extension://${id}/wallet.html`);
mark('wallet.prices from wallet.html');
const answer = await tab.evaluate(() => chrome.runtime.sendMessage({type: 'wallet.prices'}));
await new Promise(r => setTimeout(r, 1000));
// 2. The worker's own fetch shapes, exactly deps.ts / rpc.ts: GET credentials omit; POST JSON credentials omit.
mark('sw GET as createJsonGetter');
await sw.evaluate(() => fetch('https://api.noc-tura.io/api/v1/stats', {method: 'GET', credentials: 'omit'}).then(r => r.status));
mark('sw POST as createRpc');
await sw.evaluate(() => fetch('https://api.noc-tura.io/api/v1/rpc', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{"jsonrpc":"2.0","id":1,"method":"getHealth"}', credentials: 'omit'}).then(r => r.status));
// 3. Positive control: a worker fetch that names a referrer — the server must see it, so "none seen" above is real.
mark('control: sw GET with referrer set');
await sw.evaluate(id => fetch('https://api.noc-tura.io/api/v1/stats', {credentials: 'omit', referrer: `chrome-extension://${id}/background.js`, referrerPolicy: 'unsafe-url'}).then(r => r.status), id);
// 4. The explorer link's pattern from an extension page, and its control without noreferrer.
const page = await ctx.newPage();
await page.goto(`chrome-extension://${id}/wallet.html`);
for (const [label, rel] of [['link rel=noopener noreferrer (TxDetail.tsx)', 'noopener noreferrer'], ['control: link rel=noopener only', 'noopener']]) {
  mark(label);
  const opening = ctx.waitForEvent('page');
  await page.evaluate(rel => {
    const a = document.createElement('a');
    a.href = 'https://solscan.io/tx/probe';
    a.target = '_blank';
    a.rel = rel;
    a.textContent = 'x';
    document.body.append(a);
    a.click();
  }, rel);
  const opened = await opening;
  await opened.waitForLoadState('domcontentloaded').catch(() => undefined);
  await new Promise(r => setTimeout(r, 1000));
  await opened.close();
}
// 5. #1's real Terms link (unlock.html, the welcome screen), clicked: a noc-tura.io page opened by the extension.
const welcome = await ctx.newPage();
await welcome.goto(`chrome-extension://${id}/unlock.html?mode=welcome`);
mark('#1 Terms link (unlock.html #wel-terms-link)');
const opening2 = ctx.waitForEvent('page');
await welcome.locator('#wel-terms-link').click();
const opened2 = await opening2;
await opened2.waitForLoadState('domcontentloaded').catch(() => undefined);
await new Promise(r => setTimeout(r, 1000));
console.log(`extension ${id}, wallet.prices ok: ${answer?.ok}`);
for (const s of seen) console.log(s.label !== undefined ? `## ${s.label}` : `${s.method} ${s.host}${s.url} | origin=${s.origin} | referer=${s.referer} | cookie=${s.cookie} | user-agent=${s.ua === null ? 'none' : 'present'}`);
await ctx.close();
server.close();
```

Run (in `extension/`, after `npm run build`): `timeout 120 unshare -rn sh -c "ip link set lo up && node $P/probe.mjs"` — observed:

```
extension biglnbdlhjaojhjlnlddiinabehmkikk, wallet.prices ok: true
## wallet.prices from wallet.html
GET api.noc-tura.io/api/v1/wallet/prices?ids=solana,usd-coin,tether | origin=null | referer=null | cookie=null | user-agent=present
GET api.noc-tura.io/api/v1/stats | origin=null | referer=null | cookie=null | user-agent=present
## sw GET as createJsonGetter
GET api.noc-tura.io/api/v1/stats | origin=null | referer=null | cookie=null | user-agent=present
## sw POST as createRpc
POST api.noc-tura.io/api/v1/rpc | origin=chrome-extension://biglnbdlhjaojhjlnlddiinabehmkikk | referer=null | cookie=null | user-agent=present
## control: sw GET with referrer set
GET api.noc-tura.io/api/v1/stats | origin=null | referer=null | cookie=null | user-agent=present
## link rel=noopener noreferrer (TxDetail.tsx)
GET solscan.io/tx/probe | origin=null | referer=null | cookie=null | user-agent=present
GET solscan.io/favicon.ico | origin=null | referer=https://solscan.io/tx/probe | cookie=null | user-agent=present
## control: link rel=noopener only
GET solscan.io/tx/probe | origin=null | referer=null | cookie=null | user-agent=present
GET solscan.io/favicon.ico | origin=null | referer=https://solscan.io/tx/probe | cookie=null | user-agent=present
## #1 Terms link (unlock.html #wel-terms-link)
GET noc-tura.io/extension/terms | origin=null | referer=null | cookie=null | user-agent=present
GET noc-tura.io/favicon.ico | origin=null | referer=https://noc-tura.io/extension/terms | cookie=null | user-agent=present
```

Read: #1's real Terms link opens `noc-tura.io/extension/terms` with no Referer (L1; the favicon request after it is the site's own page). The background's GETs carry **no Origin and no Referer**; its POST carries `Origin: chrome-extension://<id>` and no Referer; no request carries a cookie; every one carries the browser's User-Agent. **Chrome sends no Referer from an extension context at all** — the worker fetch that names a `referrer` explicitly (with `unsafe-url`) still arrives without one, and so does the explorer link without `noreferrer`; the favicon request (from the https page itself) proves the server records a Referer when one is sent. The route-level E2E agrees: same Origin / Referer per request, and its positive control sees `Referer: https://headers.test/` and `Origin: https://headers.test` from an https page. So R1's "the Referer and User-Agent headers" (ICO's log format) is true and R2 says what that field holds for the extension: nothing. R8: the Origin the app log may record is the extension's, one for every install of the store build (the ID is the store's; unpacked builds have another).

- [ ] **Step 6: Run — green, the whole suite, both builds, the gates, the E2E.**

Run: the Step 3 command — `Test Files  2 passed (2)` · `Tests  24 passed (24)` (on the final tree, L1 and rev 2's P5 row included). **Every total in this step re-measured at rev 2 on 496c770** (the suites in a clean `git archive` copy, build / gates / root check in the clone).
Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `TZ=UTC npx vitest run` — `Test Files  243 passed (243)` · `Tests  5415 passed | 1 skipped (5416)` (base 7fff2cc: `241 passed (241)` · `5391 passed | 1 skipped (5392)` — +2 files, +24 tests). `TZ=UTC npx vitest run --config vitest.nopresale.config.ts` — `Test Files  22 passed (22)` · `Tests  550 passed | 25 skipped (575)` (unchanged: no shared file added). `rm -rf dist dist-nopresale && npm run build` — exit 0. `npm run gates` — exit 0, every line as before (both builds), among them `vault isolation ok (dist): …`, `rpc methods ok: every method name the extension bundles is on the proxy allowlist, and the list equals the spec`, `no TGE date (dist present): 730 source and built files checked`, `no TGE date (dist-nopresale present): 730 source and built files checked`, `no presale ok (dist-nopresale off, dist on): …`. `npm run reproducible` — `presale chrome 28 files sha256:dd410738…`, `presale firefox 28 files sha256:4f16d750…`, `no-presale chrome 28 files sha256:3bfc93f5…`, `no-presale firefox 28 files sha256:e8b7ec83…` (this tree's — rev 1's quote here was stale; the same four on Task 4's tree; the task changes no build input — `release/` and `scripts/` are not bundled). Repo root: `node scripts/check-no-tge-date.mjs` — `no TGE date in 1386 tracked text files`.
**First gate run of the dry run failed** — both lines are now prevented by the sentences' `source` wording, recorded so the executor does not reintroduce them: `release/privacySentences.mjs: names v1_contacts, which only the background may write` (and `v1_dapp_grants`, `v1_phishing_phrase` — `check-vault-isolation.mjs` reads `release/*.mjs`), and in the full vitest run `check-rpc-methods.test.mjs` "passes on this repository": `release/privacySentences.mjs: calls the global fetch directly, bypassing the coordinator client` (P1's source said "the only fetch (:132)" — `fetch\s*\(`). The sources name `GRANTS_KEY` / `CONTACTS_KEY` / `PHRASE_KEY` and "the one global network call (timedFetch, :132)" instead.
E2E: `npx playwright test e2e/requestHeaders.spec.ts e2e/containment.spec.ts` — `3 passed (7.1s)` (before L1); after L1: `npx playwright test e2e/requestHeaders.spec.ts` — `2 passed (8.2s)`, under `unshare -rn sh -c 'ip link set lo up && npx playwright test e2e/requestHeaders.spec.ts'` — `2 passed (9.5s)`. The L1 amendment re-ran `tsc` (0), both vitest runs (the totals above, unchanged: L1 adds no test, only rows), `check-vault-isolation.mjs` (0), `check-rpc-methods.mjs` and `check-no-tge-date.mjs` (ok).
No repo-root `src/` or `core/` change: root `tsc` / `jest` and web `verify` are not run.

- [ ] **Step 7: Commit.**

```bash
git add extension/release/ico-retention.md extension/release/privacySentences.mjs extension/release/privacy.md extension/scripts/live-check.mjs extension/scripts/__tests__/live-check.test.mjs extension/scripts/__tests__/privacy.test.mjs extension/e2e/requestHeaders.spec.ts
git commit -m "feat(extension): B1e-2 the privacy policy and the live check's comparison — L1 (the noc-tura.io links open with no referrer, measured); P1–P16 re-verified against the code (P3: the viewed account and the first ten rows, not every account; P5: every 5 s after a failed simulation, and the recipient's account kind and token account asked at review, before the simulation; P8: the restricted list kept up to 10 minutes in memory), R1–R21 from ICO's retention answer (recorded verbatim with its date and commits; R2/R8 the extension's measured headers: no Referer, Origin only on the POSTs), privacy.md carrying each verbatim, the facts pinned to their constants; live-check.mjs: §6.5's normalisation as a pure comparison and a runner that fetches only through the fetch it is handed (GET, redirect: manual, one page at a time, 200 only)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

(The dry run's commit: `57b1817` on `dry/b1e2-t3`, `dry(b1e2): Task 3 — …` — 5ebe738 amended with L1; chained as f9e1aae. Rev 2 (Fable review 1, M5): `496c770` on `dry/b1e2-r2` — f9e1aae's tree + P5's recipient sentence, its source, the `privacy.test.mjs` row.)

- [ ] **Step 8: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked for `extension/` and `web/`), `timeout 300`; `tsc`'s own exit code first, then the named test file.** `LT` = `scripts/__tests__/live-check.test.mjs` (15), `PT` = `scripts/__tests__/privacy.test.mjs` (9), `HS` = `e2e/requestHeaders.spec.ts` (1; the copy gets the clone's built `dist-nopresale`). `LC` = `scripts/live-check.mjs`, `PS` = `release/privacySentences.mjs`, `MD` = `release/privacy.md`. Every edit matched exactly once. Observed on 5ebe738, the L1 rows on 57b1817 (the first sweep, on its predecessor, found one survivor — below the table); **rev 2: every LT / PT row re-run on 496c770** (the totals below are those; PT has 9 tests now) and the three M5 rows added (M-P5-…); the HS rows are rev 1's (neither the E2E nor what it measures changed).

| id | the change | → observed |
|---|---|---|
| M-tags-space | LC: a removed tag leaves `' '` instead of `''` | tsc 0 · LT RED `2 failed \| 13 passed (15)` — “control: a sentence split by <b>…</b> and a line break → passes”; “a tag whose attribute holds ">" is removed whole; a bare "<" in text is kept” |
| M-tags-naive | LC: the tag pattern becomes `/<[^>]*>/g` (no quoted attributes, any `<`) | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “a tag whose attribute holds ">" is removed whole; a bare "<" in text is kept” |
| M-keep-comments | LC: the `<!--…-->` removal line deleted | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “comments, <script>, <style> and <template> are not page text: a sentence only there fails” |
| M-keep-script | LC: the `<script>`/`<style>`/`<template>` removal line deleted | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “comments, <script>, <style> and <template> are not page text: a sentence only there fails” |
| M-no-decode | LC: `pageText` returns `foldText(text)` (no entity decoding) | tsc 0 · LT RED `9 failed \| 6 passed (15)` — “control: every sentence on the page → passes (the fixture uses ’, &rsquo;, &#8217;, NBSP and wrapped lines)”; “control: one sentence with one word changed → fails, naming that sentence and no other” (+7 more) |
| M-no-1252 | LC: `numericChar` returns `String.fromCodePoint(code)` (no Windows-1252 remap) | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “entities: named and numeric (decimal, hex, 0x80–0x9F as Windows-1252) decode; an unknown named one stays → fails” |
| M-unknown-entity-empty | LC: an unknown named entity decodes to `''` instead of staying | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “entities: named and numeric (decimal, hex, 0x80–0x9F as Windows-1252) decode; an unknown named one stays → fails” |
| M-no-nfc | LC: `.normalize('NFC')` removed from `foldText` | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “folding: NFC, ’ → ', “ ” → ", every whitespace run (NBSP, U+202F, U+3000, tabs, newlines) → one space” |
| M-no-quote-fold | LC: the `’ → '` fold removed | tsc 0 · LT RED `8 failed \| 7 passed (15)` — “control: every sentence on the page → passes (the fixture uses ’, &rsquo;, &#8217;, NBSP and wrapped lines)”; “control: one sentence with one word changed → fails, naming that sentence and no other” (+6 more) |
| M-no-dquote-fold | LC: the `“ ” → "` fold removed | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “folding: NFC, ’ → ', “ ” → ", every whitespace run (NBSP, U+202F, U+3000, tabs, newlines) → one space” |
| M-ws-ascii | LC: whitespace fold `/[ \t\n\r]+/g` (no NBSP, no Unicode spaces) | tsc 0 · LT RED `7 failed \| 8 passed (15)` — “control: every sentence on the page → passes (the fixture uses ’, &rsquo;, &#8217;, NBSP and wrapped lines)”; “control: one sentence with one word changed → fails, naming that sentence and no other” (+5 more) |
| M-case-insensitive | LC: `missingSentences` compares lower-cased | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “the comparison is case-sensitive” |
| M-no-title | LC: the title check line deleted | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “Terms and Help: their title and the contact → pass; either missing → fails, naming the page” |
| M-no-contact | LC: the contact check line deleted | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “Terms and Help: their title and the contact → pass; either missing → fails, naming the page” |
| M-follow | LC: the runner's `redirect: 'manual'` → `'follow'` | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “the runner: the three URLs in order, GET with redirect: manual, one at a time — every page good → ok” |
| M-accept-3xx | LC: `res.status !== 200 \|\|` → `res.status >= 400 \|\|` | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “control: a 301 → fails (a redirect is never followed); a 404 → fails; an opaque redirect → fails” |
| M-no-opaque | LC: `\|\| res.type === 'opaqueredirect'` removed | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “control: a 301 → fails (a redirect is never followed); a 404 → fails; an opaque redirect → fails” |
| M-parallel | LC: all three fetches started before the loop, then awaited in order | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “the runner: the three URLs in order, GET with redirect: manual, one at a time — every page good → ok” |
| M-default-fetch | LC: `const fetch = io?.fetch ?? globalThis.fetch;` | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “it has no default fetch: called without one it refuses before any request” |
| M-privacy-no-sentences | LC: `if (page.sentences)` → `if (page.sentences === 'x')` (the privacy page checked like Terms) | tsc 0 · LT RED `3 failed \| 12 passed (15)` — “control: one sentence with one word changed → fails, naming that sentence and no other”; “control: one sentence missing → fails, naming it” (+1 more) |
| M-md-word | MD: `one-minute window` → `one-hour window` | tsc 0 · PT RED `2 failed \| 7 passed (9)` — “privacy.md carries every sentence verbatim — control: one word changed or one sentence dropped is found”; “privacy.md, published as plain HTML, passes the live check's comparison” |
| M-md-claim | MD: "a Solana wallet" → "an anonymous Solana wallet" | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “privacy.md makes no claim the build does not keep: nothing "anonymous" or "untraceable"; "private" only in "private keys"” |
| M-sentence-renumbered | PS: `id: 'R21'` → `id: 'R22'` | tsc 0 · PT RED `3 failed \| 6 passed (9)` — “the list: P1–P16 (§6.1), then R1–R21 (§6.2), each with a text and a source, no text twice”; “privacy.md carries every sentence verbatim — control: one word changed or one sentence dropped is found” (+1 more) |
| M-measured-source | PS: R2's source no longer says `measured, not ICO:` (names ICO §6.2) | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “every R-sentence is ICO's answer except R2 and R8, which say they are the extension's own measurement” |
| M-sim-refresh | `src/background/dapp/signTx.ts`: `SIM_REFRESH_MS = 60_000` | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “the facts in the sentences are the code's: the one host, the counts, the intervals, the RP ID, the tokens, the contact” |
| M-sim-retry | `signTx.ts`: `SIM_RETRY_MS = 3_000` | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “the facts in the sentences are the code's: the one host, the counts, the intervals, the RP ID, the tokens, the contact” |
| M-fresh-rows | `src/app/useAccountBalances.ts`: `FRESH_ROWS = 12` | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “the facts in the sentences are the code's: the one host, the counts, the intervals, the RP ID, the tokens, the contact” |
| M-geo-cache | `src/background/geo/gate.ts`: `GEO_LIST_CACHE_MS = 15 * 60_000` | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “the facts in the sentences are the code's: the one host, the counts, the intervals, the RP ID, the tokens, the contact” |
| M-max-probe | `src/background/walletApi.ts`: `const MAX_PROBE = 8;` | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “the facts in the sentences are the code's: the one host, the counts, the intervals, the RP ID, the tokens, the contact” |
| M-scan | `src/unlock/onboarding.ts`: `SLIP10_ACCOUNTS_TO_SCAN = 7` | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “the facts in the sentences are the code's: the one host, the counts, the intervals, the RP ID, the tokens, the contact” |
| M-page-url | `src/shared/links.ts`: `privacy: 'https://noc-tura.io/privacy'` | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “reads the three pages at the links the extension opens; Terms and Help are titled as #38 names them” |
| M-help-title | `src/app/screens/About.tsx`: `help: 'Help and support'` | tsc 0 · LT RED `1 failed \| 14 passed (15)` — “reads the three pages at the links the extension opens; Terms and Help are titled as #38 names them” |
| M-L1-md | MD: L1's "noc-tura.io receives" → "noc-tura.io may receive" | tsc 0 · PT RED `2 failed \| 7 passed (9)` — “privacy.md carries every sentence verbatim — …”; “privacy.md, published as plain HTML, passes the live check's comparison” |
| M-L1-licence | PS: L1 names "the Terms, Privacy Policy, licences or Help page" | tsc 0 · PT RED `3 failed \| 6 passed (9)` — the verbatim row, the HTML row, “the facts in the sentences are the code's …” |
| M-pages-extra | `src/shared/links.ts`: a fourth page `faq: 'https://noc-tura.io/extension/faq'` | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “the facts in the sentences are the code's …” |
| M-e2e-L1-control | HS: the L1 recorder deletes `referer` from what it stores | tsc 0 · HS RED `1 failed \| 1 passed` — `Expected: "https://headers.test/"` · `Received: undefined` (L1's positive control) |
| M-e2e-blind | HS: the recorder stores `headers: {} as Record<string, string>` instead of `await req.allHeaders()` | tsc 0 · HS RED `1 failed` — `expect(received).toMatch(expected)` · `Received has value: undefined` (the User-Agent row) |
| M-e2e-control-gone | HS: the recorder skips a `/stats` request that carries a Referer (a recorder blind to the header) | tsc 0 · HS RED `1 failed` — `Expected: "https://headers.test/"` · `Received: undefined` (the positive control) |
| M-P5-md-no-lookup | MD: P5's rev 2 sentence (" When you review one of your sends, … for that token.") deleted | tsc 0 · PT RED `2 failed \| 7 passed (9)` — “privacy.md carries every sentence verbatim — control: one word changed or one sentence dropped is found”; “privacy.md, published as plain HTML, passes the live check's comparison” |
| M-P5-list-no-lookup | PS: the same sentence deleted from P5's `text` (privacy.md keeps it) | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “P5's recipient lookup is prepareSend's: the address sent to (its kind) and, for a token, its token account — both asked before the simulation” |
| M-P5-token-kind-unasked | `src/background/prepare.ts`: the token branch's `recipientAccount = await deps.reader.getAccountKind(intent.recipient);` → `recipientAccount = 'wallet';` | tsc 0 · PT RED `1 failed \| 8 passed (9)` — “P5's recipient lookup is prepareSend's: the address sent to (its kind) and, for a token, its token account — both asked before the simulation” |

41 mutations (rev 1's 38 + rev 2's three M5 rows), every one compiling and red. **The first sweep's survivor, fixed before the commit:** M-keep-comments (the comment rule deleted) stayed **green** — the last rule, `<![^>]*>`, swallowed a whole `<!-- … -->` that holds no `>`, so the comment control tested the fallback, not the comment rule. The control now also hides the sentence in `<!-- an old draft (a > b): … -->`, which only the comment rule removes; re-run: red. Two edits of the first sweep did not match (an escaped `’` and a `redirect: 'manual'` that also appears in the JSDoc) and were re-anchored; M-no-dquote-fold was added.

#### Notes for the executor (Task 3)

- **Rev 2 (Fable review 1, M5 / I4).** M5 is this task's: P5 gains one sentence — "When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token." — in `privacySentences.mjs` (text and `source`) and `privacy.md`, and Help's P5 bullet in Task 4 follows (Help quotes P5 verbatim). Why: `prepareSend` asks `getAccountKind(recipient)` (`prepare.ts:311` / `:332`) and, for a token, `getAccountExists(<its associated token address>)` (`:333`) before `simulateTransaction` (`:370`), on every prepare (#19 Review on mount, #20 Confirm when the quote expired); the policy said only the simulation. The words: "review" not "tap Review" — the button reads "Review & unlock to send" and #20's re-prepare asks again without a tap on Review; "whether that address already has an account for that token" — what is sent is the derived associated-token address, which identifies the recipient as much as the address does. Pinned by a new `privacy.test.mjs` row that runs `prepareSend` (SOL and NOC) over a recording reader and asserts the order `getAccountKind(recipient)` → (`getAccountExists(ata)`) → `simulateTransaction`, plus the sentence in P5 (three mutations, Step 8). Cost if wrong (the owner wants other words): the sentence in three files (`privacySentences.mjs`, `privacy.md`, `help.md`) and the row's string. I4 is Task 4's (it changes this task's `live-check.mjs` there — the answer changes only once `terms.md` exists).
- **Rulings (the controller's to confirm; each a published fact):**
  - **P3, P5, P8 corrected, not copied** (Step 1). Why: each spec sentence is not exactly true of 0fcf769, and a privacy policy that understates what is sent (P5: 5 s, not 30 s, while the coordinator fails; P8: re-read on every worker restart) or overstates in an untrue way (P3: "every account" with >10 accounts) is a published false fact. Cost if wrong: the controller reverts to the spec text — one line each in `privacySentences.mjs` and `privacy.md` (and the pins in `privacy.test.mjs`). Alternative for P3 if the owner prefers the broader claim: "…the public addresses of the accounts in your wallet…" (true, less precise) — not chosen.
  - **R2 and R8 are measured, not ICO's.** ICO's answer says the access log has a Referer field and the app log records a non-allow-listed Origin; neither says what the extension sends. Without R2 / R8 a reader would infer the log holds a per-user referrer or origin; measured, it holds none / one value for every user. Both are labelled `measured, not ICO:` in `source` and pinned by `e2e/requestHeaders.spec.ts` (Chrome could change; the E2E would then fail). Cost if wrong (the controller drops them): R1 / R7 stay true, the page is less precise.
  - **R-sentences say nothing ICO did not.** Where ICO's note is terse the sentence keeps its ambiguity rather than resolve it: R14 "deleted after 7 days, or once more than 5,000 are stored" (which ones go at 5,000 is not stated); R13 "the IP address may be blocked" (ICO: "bouncer enforces bans" — when a scenario bans is CrowdSec's). Not published from the answer: "ICO will tell us before any change…" (an internal commitment — recorded in `ico-retention.md`), the "changes made" paragraph (history).
  - **`ico-retention.md` omits the paste's closing "Also:" paragraph** (the B4 Telegram checks, an EVM ingestion outage with its provider's quota) — it answers no part of §6.2's question and the repository is public; the omission is stated in the file. Cost if wrong: append the paragraph from the paste.
  - **Titles = #38's row labels** (`Privacy Policy`, `Terms of Service`, `Help & support`), pinned to `ABOUT_TEXT` — the page a user lands on is headed with the name they clicked. Task 4 heads `terms.md` / `help.md` so.
  - **The comparison drops comments, `<script>`, `<style>` and `<template>` with their content** before removing tags (the spec says only "removing tags"): a sentence that is not visible must not pass. A sentence hidden by CSS (`display: none`) still passes — the check cannot render; recorded, not handled. An unknown named entity is left as written, so a sentence carrying one fails (fail closed); the decoded set is `NAMED_ENTITIES` (36) plus every numeric reference, 0x80–0x9F through Windows-1252 as browsers do. A tag removed leaves nothing (not a space) — `the <b>coordinator</b>.` must read "coordinator." — so `word<br>word` reads "wordword" and fails: a false failure, never a false pass.
  - **No CLI, no default fetch** in `live-check.mjs` — the ruling "the live check has no skip flag; the only contact is Task 7's single run" is made structural: nothing but a caller that hands it a fetch can reach noc-tura.io through this module. The tests replace `globalThis.fetch` with a recorder that throws and assert it unused.
  - **All three pages are fetched even after a failure** (three GETs at most, one at a time) so one run reports every problem; never a retry, never the redirect target.
- **Copy written by this task (D27, owner-delegated — for the owner):** P5's rev 2 sentence (above); `privacy.md`'s heading, its opening paragraph ("This policy covers the Noctura browser extension for Chrome, a Solana wallet. It says what the extension sends, to whom, and what the Noctura coordinator keeps. Solana is a public blockchain: anyone can read an account's balance and the transactions it took part in."), its section headings, and the wording of R1–R21 (each from ICO's statement, Step 4's `source`). No TGE date, no presale beyond P7 / P8 (the store build's real `/stats` read and F12's region check), no "private" except "private keys", nothing "anonymous" (tested).
- **L1 (the controller's ruling):** the Terms / Privacy Policy / Help links' disclosure is in the policy, after P9, measured like P9. Copy: the controller's (D27), flagged to the owner.
- **For the owner / ICO (not changed here):** (1) ICO's answer does not say whether the extension's Origin (`chrome-extension://<store id>`) is on the coordinator's allow list; either way R7 is true — if it is not, every RPC and broadcast request logs that one value (no IP). Worth asking ICO once the ID exists. (2) The restricted-list sentence (P8) and the region check stay in the store policy because F12 runs in the store build (E2).
- **What the next tasks must know:** see Interfaces. Task 7: `await liveCheck({fetch})` with its own timeout wrapper; never in `verify`; the live check fails today (the pages answered 404 at the audit) — expected, and it is the only sanctioned contact.

#### Spec rev 2.7 lines (Task 3)

- §6.1 P3: "The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing." (the rows read only `FRESH_ROWS = 10`; was "every account in your wallet"); the source is `walletApi.ts:341`.
- §6.1 P5: adds ", and every 5 seconds after a simulation that fails" (`SIM_RETRY_MS`), and (rev 2, Fable review 1 M5) the sentence "When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token." (`prepare.ts:311`, `:332–333`, before `:370`).
- §6.1 P8: the last sentence is "The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes." (the copy is in memory: a restarted worker or a failed read reads again; was "read at most once every 10 minutes").
- §6.1 L1 (new, after P9, the controller's ruling): "When you open the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives your IP address and your browser's standard headers, as any website you open does; no referrer is sent." — measured by `e2e/requestHeaders.spec.ts`.
- §6.1 P4, P7: sources moved (`walletApi.ts:56`; `walletApi.ts:176`).
- §6.2: R1–R21 written (R2, R8 measured by `e2e/requestHeaders.spec.ts`: no Referer on any request; Origin only on the POSTs, the extension's); `ico-retention.md` omits the paste's "Also:" paragraph.
- §6.5: Terms and Help titles are #38's labels ("Terms of Service", "Help & support"); comments, `<script>`, `<style>`, `<template>` are removed with their content before the tags; unknown named entities are not decoded (fail closed); numeric 0x80–0x9F decode as Windows-1252; `liveCheck` has no default fetch and `live-check.mjs` no CLI; all three pages are read even after one fails.


### Task 4: The Terms draft, Help, the store listing and the CWS data-usage form — `release/terms.md` (a DRAFT for the owner's lawyer, said first; non-custodial software, the user's keys and responsibility, no financial advice, no warranty, BSL 1.1 as `LICENSE` states it, the contact), `release/help.md` (§6.4's seven topics in the UI's own words; the coordinator's view as the privacy sentences themselves), `release/listing.md` (name and summary = the manifest's, the single purpose and the E17 paragraph verbatim, every store reason verbatim from `manifest/source.mjs`, remote code: no, category for the owner), `release/data-usage.md` (§6.3's table row for row + the backing privacy sentences; the three certifications on R20); one test file reads all four with positive and negative controls; and the live check (Task 3's `scripts/live-check.mjs`) refuses a Terms page that still carries the draft's DRAFT note (rev 2, Fable review 1 I4)

**Spec:** B1e §6.4 (Terms: "a draft for the owner's lawyer … non-custodial software, the user holds the keys and the responsibility, no financial advice, no warranty, the BSL 1.1 licence, the contact"; Help: "the recovery phrase; the anti-phishing phrase (§1.1's two limits, Minor 3); a damaged wallet (the two states of §2, saving the data); why a passkey shows as "wallet.noc-tura.io" (P12, P13); why a transaction is blocked; what the coordinator sees (P1–P8); the contact"; listing: name, short description ≤ 132, detailed description, category (owner), the single-purpose statement verbatim, each permission's justification from `source.mjs`'s reasons + the E17 paragraph verbatim, "remote code: none", §6.3's answers; no presale, no TGE date, nothing "private" / "anonymous"), §6.3 (the table, the certifications "ticked only after §6.2's answer confirms it" — R20, `ico-retention.md` part 5, received 2026-11-01; remote code none; the privacy policy URL; `data_collection_permissions` AMO-only), §6.5 (Terms and Help each carry their title and privacy@noc-tura.io — Task 3's `LIVE_PAGES`; and, rev 2, the Terms page must not carry the draft's note — a rev 2.7 line), §1.1 (the phrase's two limits), §2.2–§2.3 (the damaged screens' words), E4, E8, E13, E17. **Not here:** the screenshots (Task 5), the checklist that tells the owner to paste these (Task 7), publishing on noc-tura.io (ICO).

**Files:**
- Create: `extension/release/terms.md`, `extension/release/help.md`, `extension/release/listing.md`, `extension/release/data-usage.md`
- Create (test): `extension/scripts/__tests__/storeTexts.test.mjs` (14 tests)
- Modify: `extension/scripts/live-check.mjs` (Task 3's file — `TERMS_DRAFT_MARKERS`, the Terms page's `mustNot`, `pageProblems` refusing them; changed here because this task's `terms.md` is what makes the answer change: the draft note exists only from this task on). No build input changes (`release/` and `scripts/__tests__/` are not bundled): the reproducible digests equal the base tree's (Step 4). No `.mjs` is added under `release/` (Task 3's gate trap: `check-vault-isolation.mjs` and `check-rpc-methods.mjs` read `release/*.mjs` through `listSourceFiles`; `__tests__/` is skipped by name) — the texts are `.md`, read by the test.

**Interfaces:**
- Consumes: `PERMISSIONS`, `HOST_PERMISSIONS`, `CONTENT_SCRIPTS`, `EXTENSION_CSP`, `render` (`manifest/source.mjs`); `PRIVACY_SENTENCES` (`release/privacySentences.mjs`, Task 3); `CONTACT`, `LIVE_PAGES`, `pageProblems`, `liveCheck` (`scripts/live-check.mjs`, Task 3); `forbiddenForms` (`scripts/check-no-tge-date.mjs`); `NOCTURA_PAGES` (`src/shared/links.ts`); `RP_ID` (`src/vault/passkey.ts`); `OVERRIDE_WORDS`, `ALLOWANCE_WORD` (`src/background/dapp/redFlags.ts`); `FLAG_TEXT`, `MISMATCH_TEXT`, `TX_TEXT`, `WINDOW_TEXT` (`src/approve/strings.ts`); `MANAGE`, `PHRASE`, `REAUTH` (`src/unlock/strings.ts`); `SECURITY_TEXT` (`src/app/screens/Security.tsx`), `SETTINGS_TEXT` (`Settings.tsx`), `CONNECTED_TEXT` (`ConnectedApps.tsx`), `PHRASE_TEXT` (`src/app/ui/PhraseLine.tsx`); `unlock.html` (the damaged screens' static copy); the repo's `LICENSE` (`Change Date:` / `Change License:`); the spec file itself (§6.3's table, the single-purpose statement, the E17 paragraph).
- Produces: four `.md` files, and in `scripts/live-check.mjs` (Task 3's file):
  ```js
  export const TERMS_DRAFT_MARKERS: readonly ['DRAFT', 'not in force', "owner's lawyer"];   // frozen
  // LIVE_PAGES' terms entry gains  mustNot: TERMS_DRAFT_MARKERS  (privacy and help: none);
  // pageProblems(page, html) adds, for each m of page.mustNot found (case-sensitive) in pageText(html) folded:
  //   `${page.name}: carries "${m}" — the draft's note, which is not published`
  ```
  Their fixed points, which later tasks and the owner rely on:
  - `terms.md` starts `# Terms of Service\n`, `help.md` starts `# Help & support\n` (= `LIVE_PAGES`' titles = #38's row labels), each contains `privacy@noc-tura.io` — so Task 7's live check passes on the published pages once ICO publishes them as written, **the Terms without line 3**: `terms.md` line 3 is the DRAFT note, which the note itself says is not published, and the live check refuses a Terms page that still carries any of `TERMS_DRAFT_MARKERS` (`liveCheck` → `ok: false`, three problem lines). Task 7's checklist tells the owner the published Terms is the lawyer's approved text without the note.
  - `listing.md` sections, each `## ` heading the dashboard field: `Name`, `Summary (short description)`, `Category`, `Single purpose`, `Detailed description`, `Permission justifications` (`### \`storage\``, `### \`alarms\``, `### \`https://api.noc-tura.io/*\``, `### \`https://wallet.noc-tura.io/*\``, `### Content scripts (\`<all_urls>\`)`), `Remote code`, `Data usage`.
  - `data-usage.md` sections: `The form` (the table), `Certifications`, `Remote code`, `Privacy policy`, `Not in the Chrome manifest`.
  - **Task 7** (`release/checklist.md`, §7 step 3: "paste the listing and §6.3's answers") points at `release/listing.md` and `release/data-usage.md`; the rev 2.7 change list takes the lines under "Spec rev 2.7 lines (Task 4)". Task 7 must not edit §6.3's table, the single-purpose statement or the E17 paragraph in the spec without updating these texts: `storeTexts.test.mjs` reads all three from the spec.

**The rule, stated once.** Nothing in these texts is a second statement of a fact that has a first one: every store reason is `source.mjs`'s string, the single purpose and the E17 paragraph are the spec's, the coordinator's view (Help) and the passkey answer are the privacy sentences themselves, the licence dates are `LICENSE`'s, the UI's words are imported from the screens' own constants (or `unlock.html`), and the data-usage rows are the spec's table — each compared character for character by a test, so a change on either side turns it red. What is new (the Terms' and Help's own prose, the detailed description) is checked for what it must not claim.

- [ ] **Step 1: Write the failing test.** `extension/scripts/__tests__/storeTexts.test.mjs` (new, in full):

```js
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONTENT_SCRIPTS, EXTENSION_CSP, HOST_PERMISSIONS, PERMISSIONS, render} from '../../manifest/source.mjs';
import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
import {CONTACT, LIVE_PAGES, TERMS_DRAFT_MARKERS, liveCheck, pageProblems} from '../live-check.mjs';
import {forbiddenForms} from '../check-no-tge-date.mjs';
import {NOCTURA_PAGES} from '../../src/shared/links';
import {RP_ID} from '../../src/vault/passkey';
import {ALLOWANCE_WORD, OVERRIDE_WORDS} from '../../src/background/dapp/redFlags';
import {FLAG_TEXT, MISMATCH_TEXT, TX_TEXT, WINDOW_TEXT} from '../../src/approve/strings';
import {MANAGE, PHRASE, REAUTH} from '../../src/unlock/strings';
import {SECURITY_TEXT} from '../../src/app/screens/Security';
import {SETTINGS_TEXT} from '../../src/app/screens/Settings';
import {CONNECTED_TEXT} from '../../src/app/screens/ConnectedApps';
import {PHRASE_TEXT} from '../../src/app/ui/PhraseLine';

// B1e §6.3, §6.4 (Task 4 of B1e-2): the texts for the Chrome Web Store and for noc-tura.io — release/terms.md,
// release/help.md, release/listing.md, release/data-usage.md — read as a reviewer would: the store reasons verbatim from
// manifest/source.mjs, the spec's own sentences verbatim, the privacy sentences verbatim where a text restates them, the
// UI's real labels, the titles and contact the live check asks for, and no claim the build does not keep. Every helper
// below returns what is wrong (an empty list = right), so each check runs on the real file AND on a planted mistake.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => readFileSync(resolve(ROOT, rel), 'utf8');
const TERMS = read('release/terms.md');
const HELP = read('release/help.md');
const LISTING = read('release/listing.md');
const DATA_USAGE = read('release/data-usage.md');
const PRIVACY_MD = read('release/privacy.md');
const LICENSE = read('../LICENSE');
const SPEC = read('../docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md');
const UNLOCK_HTML = read('unlock.html');
const TEXTS = {terms: TERMS, help: HELP, listing: LISTING, 'data-usage': DATA_USAGE};
/** terms.md as the lawyer hands it back for publishing: its DRAFT note (line 3, one blockquote line) and the blank line after it removed. */
const withoutDraftNote = md => md.replace(/^> \*\*DRAFT for the owner's lawyer[^\n]*\n\n/m, '');
const sentence = id => {
  const s = PRIVACY_SENTENCES.find(x => x.id === id);
  if (s === undefined) throw new Error(`no privacy sentence ${id}`);
  return s.text;
};

/** The single-purpose statement and the E17 paragraph, as spec §6.4 writes them (each also asserted to be in the spec). */
const SINGLE_PURPOSE = 'A Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.';
const E17_PARAGRAPH =
  'No page is served at this host and the extension never connects to it (its content security policy allows connections to one other host only). The permission exists only so the passkey is bound to a name no website can use; passkeys appear under this name in the user\'s passkey manager.';
const CONTENT_SCRIPTS_HEADING = '### Content scripts (`<all_urls>`)';

/** The text under `heading` (an exact heading line) up to the next heading of the same or a higher level; null when absent. */
function section(md, heading) {
  const lines = md.split('\n');
  const at = lines.indexOf(heading);
  if (at < 0) return null;
  const level = /^#+/.exec(heading)[0].length;
  const end = lines.findIndex((l, i) => i > at && /^#+ /.test(l) && /^#+/.exec(l)[0].length <= level);
  return lines.slice(at + 1, end < 0 ? undefined : end).join('\n');
}

/** Every store reason that is not, verbatim, under its own heading in the listing (`### \`value\``; the content scripts under theirs). */
function reasonProblems(listing, permissions = PERMISSIONS, hosts = HOST_PERMISSIONS, contentScripts = CONTENT_SCRIPTS) {
  const out = [];
  for (const {value, reason} of [...permissions, ...hosts]) {
    const body = section(listing, `### \`${value}\``);
    if (body === null) out.push(`${value}: no section`);
    else if (!body.includes(reason)) out.push(`${value}: reason not verbatim`);
  }
  const cs = section(listing, CONTENT_SCRIPTS_HEADING);
  if (cs === null) out.push('content scripts: no section');
  else if (!cs.includes(contentScripts.reason)) out.push('content scripts: reason not verbatim');
  return out;
}

/** The justification headings the listing has that the manifest does not ask for (a permission the build does not hold). */
function extraJustifications(listing) {
  const want = new Set([...PERMISSIONS, ...HOST_PERMISSIONS].map(p => `### \`${p.value}\``).concat(CONTENT_SCRIPTS_HEADING));
  const body = section(listing, '## Permission justifications') ?? '';
  return body.split('\n').filter(l => /^### /.test(l) && !want.has(l));
}

/** CWS's summary: at most 132 characters (code points), not empty, one line. */
const summaryProblems = s => [
  ...(s.length === 0 ? ['empty'] : []),
  ...([...s].length > 132 ? [`${[...s].length} characters, at most 132`] : []),
  ...(/\n/.test(s) ? ['more than one line'] : []),
];

/**
 * Claims the extension does not keep (spec §6.4; memory "shielded privacy guarantee": the extension is transparent):
 * "private" except in "private key(s)", any "privacy" but the Privacy Policy, the contact address and the policy's own
 * URL path and file name (…/extension/privacy, privacy.md), anonymity,
 * untraceability, unlinkability, "shielded", the bank / military comparisons, "TGE" and every written form of its date.
 */
const FORBIDDEN = [
  /\bprivate(?!\s+keys?\b)\w*/gi,
  /(?<!\/)\bprivacy\b(?!\s+policy\b|@noc-tura\.io|\.md\b)/gi,
  /\banonym\w*/gi,
  /\buntraceab\w*/gi,
  /\bunlinkab\w*/gi,
  /\bshielded\b/gi,
  /\bsecure as a bank\b/gi,
  /\b(?:bank|military)[- ]grade\b/gi,
  /\bTGE\b/g,
];
function forbiddenClaims(text) {
  const lower = text.toLowerCase();
  return [
    ...FORBIDDEN.flatMap(re => [...text.matchAll(re)].map(m => m[0])),
    ...forbiddenForms().filter(f => lower.includes(f.toLowerCase())).map(() => '<the TGE date>'),
  ];
}

/** Lines that name the presale without being one of the allowed statements of fact (the store build's F12 and P7 / P8). */
const PRESALE_ALLOWED = () => [sentence('P7'), sentence('P8'), FLAG_TEXT.regionHead, FLAG_TEXT.regionClosed, "a country derived from it for a site's presale purchase"];
function presaleLines(text, allowed = PRESALE_ALLOWED()) {
  return text.split('\n').filter(l => /presale/i.test(l) && !allowed.some(a => l.includes(a)));
}

/** A .md as a site would publish it (privacy.test.mjs's rendering): paragraphs as <p>, headings as <h1>–<h3>, escaped. */
function asHtml(md) {
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return md
    .split(/\n{2,}/)
    .map(block => {
      const h = /^(#{1,3}) (.*)$/.exec(block);
      return h ? `<h${h[1].length}>${esc(h[2])}</h${h[1].length}>` : `<p>${esc(block)}</p>`;
    })
    .join('\n');
}

/** Help's sections, in order: §6.4's topics (the recovery phrase … the contact), each with the UI words it must use. */
function helpTopics() {
  return [
    {heading: '## Your recovery phrase', must: [SETTINGS_TEXT.recoveryPhrase, PHRASE.revealTitle, SECURITY_TEXT.taskVerify, 'Forgot password?', 'I have a wallet']},
    {
      heading: '## The anti-phishing phrase',
      must: ['Set an anti-phishing phrase', SECURITY_TEXT.phrase, SECURITY_TEXT.phraseCaption, SECURITY_TEXT.phraseHelp, SECURITY_TEXT.phraseNote, PHRASE_TEXT.failed],
    },
    {
      heading: '## A damaged wallet',
      must: [
        'Update Noctura to open this wallet',
        "This version of Noctura can't open this wallet's data.",
        'Update Noctura (in Chrome: Extensions → Update).',
        'Wallet data is damaged',
        "This browser's copy of your wallet can't be read by this or any later version of Noctura.",
        'Save the damaged data',
        'Remove damaged wallet',
        'DELETE',
        "This wallet's stored data is damaged.",
      ],
    },
    {heading: '## Why does my passkey show as "wallet.noc-tura.io"?', must: [sentence('P12'), sentence('P13'), RP_ID, MANAGE.remove, MANAGE.removedHelp]},
    {
      heading: '## Why is a transaction blocked?',
      must: [
        FLAG_TEXT.overlineBlocked,
        FLAG_TEXT.overlineUnlimited,
        FLAG_TEXT.overlineLarge,
        FLAG_TEXT.approveBlocked,
        FLAG_TEXT.approveUnlimited,
        ...Object.values(OVERRIDE_WORDS),
        ALLOWANCE_WORD,
        REAUTH.override,
        TX_TEXT.reauthNeeded,
        FLAG_TEXT.regionHead,
        FLAG_TEXT.regionMeta,
        MISMATCH_TEXT.head,
        TX_TEXT.couldNot,
        TX_TEXT.unreachable,
        TX_TEXT.expired,
        WINDOW_TEXT.blockSite,
        WINDOW_TEXT.rejectAndReport,
        CONNECTED_TEXT.blocked,
        CONNECTED_TEXT.unblock,
        SETTINGS_TEXT.connectedDapps,
        WINDOW_TEXT.budgetNotice,
      ],
    },
    {heading: '## What does the coordinator see?', must: [...['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P11'].map(sentence), NOCTURA_PAGES.privacy]},
    {heading: '## Contact', must: [CONTACT]},
  ];
}
function helpProblems(help, topics = helpTopics()) {
  const out = [];
  let last = -1;
  for (const t of topics) {
    const body = section(help, t.heading);
    if (body === null) {
      out.push(`${t.heading}: missing`);
      continue;
    }
    const at = help.split('\n').indexOf(t.heading);
    if (at < last) out.push(`${t.heading}: out of order`);
    last = at;
    for (const m of t.must) if (!body.includes(m)) out.push(`${t.heading}: missing "${m}"`);
  }
  return out;
}

/** §6.3's table rows as the spec writes them: [category, answer, why]. */
function specRows(spec = SPEC) {
  const from = spec.indexOf('### 6.3 ');
  const to = spec.indexOf('Certifications:', from);
  return tableRows(spec.slice(from, to));
}
/** A markdown table's body rows (header and separator dropped), each split into trimmed cells. */
function tableRows(md) {
  const rows = md.split('\n').filter(l => /^\|.*\|$/.test(l.trim()));
  return rows.slice(2).map(l => l.trim().slice(1, -1).split(' | ').map(c => c.trim()));
}
/** Which privacy sentences back each row: the fourth column's ids (or "—"). The ids are the code's judgement, pinned here. */
const BACKING = {
  'Personally identifiable information': ['P3', 'P4'],
  'Health information': [],
  'Financial and payment information': ['P3', 'P4', 'P5', 'P6'],
  'Authentication information': ['P11', 'P12'],
  'Personal communications': ['P10'],
  Location: ['P2', 'P8', 'R12'],
  'Web history': ['P13', 'P14'],
  'User activity': ['P15'],
  'Website content': ['P5', 'P6'],
};
function dataUsageProblems(md, rows = specRows()) {
  const out = [];
  const mine = tableRows(section(md, '## The form') ?? '');
  if (mine.length !== rows.length) out.push(`${mine.length} rows, §6.3 has ${rows.length}`);
  rows.forEach((want, i) => {
    const got = mine[i] ?? [];
    if (JSON.stringify(got.slice(0, 3)) !== JSON.stringify(want)) out.push(`row ${i + 1} (${want[0]}) differs from §6.3`);
    const ids = got[3] === '—' ? [] : (got[3] ?? '').split(', ');
    if (JSON.stringify(ids) !== JSON.stringify(BACKING[want[0]])) out.push(`row ${i + 1} (${want[0]}) backed by ${got[3]}`);
    for (const id of ids) if (!PRIVACY_SENTENCES.some(s => s.id === id)) out.push(`row ${i + 1}: no sentence ${id}`);
  });
  return out;
}

describe('the store and noc-tura.io texts (B1e §6.3, §6.4)', () => {
  it('the spec carries the single-purpose statement and the E17 paragraph this test pins (verbatim)', () => {
    const spec = SPEC.replace(/\n\s*/g, ' ');
    expect(spec).toContain(`("${SINGLE_PURPOSE}")`);
    expect(spec).toContain(`E17: "${E17_PARAGRAPH}"`);
  });

  it('listing: every permission, host and content-script reason verbatim from manifest/source.mjs, under its own heading — control: one changed word, a source reason changed, a section dropped', () => {
    expect(reasonProblems(LISTING)).toEqual([]);
    expect(extraJustifications(LISTING)).toEqual([]);
    expect(PERMISSIONS.map(p => p.value)).toEqual(['storage', 'alarms']);
    expect(reasonProblems(LISTING.replace('default five minutes', 'default ten minutes'))).toEqual(['alarms: reason not verbatim']);
    const changedSource = PERMISSIONS.map(p => (p.value === 'storage' ? {...p, reason: `${p.reason} And more.`} : p));
    expect(reasonProblems(LISTING, changedSource)).toEqual(['storage: reason not verbatim']);
    expect(reasonProblems(LISTING, PERMISSIONS, HOST_PERMISSIONS, {...CONTENT_SCRIPTS, reason: CONTENT_SCRIPTS.reason.replace('nothing', 'little')})).toEqual(['content scripts: reason not verbatim']);
    expect(reasonProblems(LISTING.replace('### `https://api.noc-tura.io/*`', '### api'))).toEqual(['https://api.noc-tura.io/*: no section']);
    expect(extraJustifications(LISTING.replace('## Remote code', '### `tabs`\n\nNot held.\n\n## Remote code'))).toEqual(['### `tabs`']);
  });

  it('listing: the wallet.noc-tura.io section adds the E17 paragraph verbatim; the RP ID is that host — control: the paragraph moved to the coordinator\'s section', () => {
    const wallet = `### \`https://${RP_ID}/*\``;
    expect(section(LISTING, wallet)).toContain(E17_PARAGRAPH);
    expect(section(LISTING, '### `https://api.noc-tura.io/*`')).not.toContain(E17_PARAGRAPH);
    const moved = LISTING.replace(E17_PARAGRAPH, '').replace('### `https://api.noc-tura.io/*`\n', `### \`https://api.noc-tura.io/*\`\n\n${E17_PARAGRAPH}\n`);
    expect(section(moved, wallet)).not.toContain(E17_PARAGRAPH);
  });

  it('listing: name and summary are the manifest\'s (CWS reads the summary from it), at most 132 characters — controls: 132 passes, 133 fails', () => {
    const manifest = render('chrome');
    expect(section(LISTING, '## Name')?.trim()).toBe(manifest.name);
    const summary = section(LISTING, '## Summary (short description)')?.trim() ?? '';
    expect(summary).toBe(manifest.description);
    expect(summaryProblems(summary)).toEqual([]);
    expect(summaryProblems('a'.repeat(132))).toEqual([]);
    expect(summaryProblems('a'.repeat(133))).toEqual(['133 characters, at most 132']);
    expect(summaryProblems('')).toEqual(['empty']);
  });

  it('listing: the single purpose verbatim, the category left to the owner, remote code none with its reason, the privacy policy URL', () => {
    expect(section(LISTING, '## Single purpose')?.trim()).toBe(SINGLE_PURPOSE);
    expect(section(LISTING, '## Category')).toContain('The owner picks it at submission');
    const remote = section(LISTING, '## Remote code') ?? '';
    expect(remote).toMatch(/^\s*\*\*No\.\*\*/);
    expect(remote).toContain("`script-src 'self'`");
    expect(EXTENSION_CSP).toContain("script-src 'self';");
    expect(EXTENSION_CSP).not.toMatch(/unsafe-eval|wasm-unsafe-eval|unsafe-inline/);
    expect(LISTING).toContain(NOCTURA_PAGES.privacy);
    expect(DATA_USAGE).toContain(NOCTURA_PAGES.privacy);
  });

  it('no claim the build does not keep, in all four texts — controls: each planted word is caught, "private keys" is not', () => {
    for (const [name, text] of Object.entries(TEXTS)) expect(forbiddenClaims(text), name).toEqual([]);
    expect(forbiddenClaims('Your private keys stay here.')).toEqual([]);
    expect(forbiddenClaims('Read the Privacy Policy or write to privacy@noc-tura.io.')).toEqual([]);
    for (const planted of ['A private wallet.', 'Send privately.', 'Anonymous payments.', 'Untraceable.', 'Privacy-first.', 'Shielded sends.', 'As secure as a bank.', 'Bank-grade security.', 'Free until TGE.']) {
      expect(forbiddenClaims(planted).length, planted).toBe(1);
    }
    expect(forbiddenClaims(`On ${forbiddenForms()[0]}.`)).toEqual(['<the TGE date>']);
  });

  it('nothing presale in the listing or the Terms; in Help and the data-usage form only the store build\'s F12 and P7 / P8 — control: a planted line is caught', () => {
    for (const text of [LISTING, TERMS]) {
      expect(text).not.toMatch(/presale/i);
      expect(text).not.toMatch(/\bNOC\b/);
    }
    expect(presaleLines(HELP)).toEqual([]);
    expect(presaleLines(DATA_USAGE)).toEqual([]);
    expect(presaleLines(`${HELP}\nBuy NOC in the presale from the wallet.\n`)).toEqual(['Buy NOC in the presale from the wallet.']);
  });

  it('Terms and Help: the live check\'s title and contact, published as plain HTML (Terms without its DRAFT note) — control: the contact dropped fails', () => {
    for (const name of ['terms', 'help']) {
      const page = LIVE_PAGES.find(p => p.name === name);
      const md = name === 'terms' ? withoutDraftNote(TERMS) : TEXTS[name];
      expect(md.startsWith(`# ${page.title}\n`), name).toBe(true);
      expect(pageProblems(page, asHtml(md)), name).toEqual([]);
      expect(pageProblems(page, asHtml(md.replaceAll(CONTACT, 'the address above'))), name).toEqual([`${name}: missing the contact ${CONTACT}`]);
    }
    expect(LISTING).toContain(CONTACT);
    expect(DATA_USAGE).toContain(CONTACT);
  });

  it('Terms: the live check refuses the draft as written (its DRAFT note) and passes it with the note removed — controls: the markers are the note\'s own words and only its, a typographic apostrophe is caught', async () => {
    const terms = LIVE_PAGES.find(p => p.name === 'terms');
    expect(terms.mustNot).toBe(TERMS_DRAFT_MARKERS);
    expect(LIVE_PAGES.filter(p => p.mustNot !== undefined).map(p => p.name)).toEqual(['terms']);
    // The negative control is real: the committed file carries the note, each marker is in it, and in nothing else.
    const note = TERMS.split('\n')[2];
    expect(withoutDraftNote(TERMS)).toBe(TERMS.replace(`${note}\n\n`, ''));
    expect(withoutDraftNote(TERMS).length).toBe(TERMS.length - note.length - 2);
    for (const m of TERMS_DRAFT_MARKERS) {
      expect(note, m).toContain(m);
      expect(withoutDraftNote(TERMS), m).not.toContain(m);
    }
    const refused = TERMS_DRAFT_MARKERS.map(m => `terms: carries "${m}" — the draft's note, which is not published`);
    expect(pageProblems(terms, asHtml(TERMS))).toEqual(refused);
    expect(pageProblems(terms, asHtml(withoutDraftNote(TERMS)))).toEqual([]);
    // As the release runs it: the three pages served as plain HTML, Terms as written → not ok, naming the note; without it → ok.
    const serve = termsMd => async url => {
      const md = url === terms.url ? termsMd : url === NOCTURA_PAGES.privacy ? PRIVACY_MD : url === NOCTURA_PAGES.help ? HELP : null;
      return md === null ? {status: 404, text: async () => ''} : {status: 200, text: async () => asHtml(md)};
    };
    expect(await liveCheck({fetch: serve(TERMS)})).toEqual({ok: false, problems: refused});
    expect(await liveCheck({fetch: serve(withoutDraftNote(TERMS))})).toEqual({ok: true, problems: []});
    // Folded like the rest of the comparison: "owner’s lawyer" (U+2019, or &rsquo;) is the same marker.
    const typographic = `${asHtml(withoutDraftNote(TERMS))}\n<p>Checked by the owner&rsquo;s lawyer.</p>`;
    expect(pageProblems(terms, typographic)).toEqual([`terms: carries "owner's lawyer" — the draft's note, which is not published`]);
  });

  it('Terms: a DRAFT for the owner\'s lawyer, said first; the BSL 1.1 change date and licence are LICENSE\'s — control: another date fails', () => {
    expect(TERMS.split('\n')[2]).toMatch(/^> \*\*DRAFT for the owner's lawyer/);
    const field = (text, name) => new RegExp(`^${name}:\\s+(.+)$`, 'm').exec(text)?.[1].trim();
    expect(LICENSE.startsWith('Business Source License 1.1\n')).toBe(true);
    const licence = {date: field(LICENSE, 'Change Date'), to: field(LICENSE, 'Change License')};
    expect(licence).toEqual({date: '2034-01-01', to: 'MIT License'});
    const says = text => text.includes('Business Source License 1.1') && text.includes(`on ${licence.date}`) && text.includes(`the ${licence.to}`);
    expect(says(TERMS)).toBe(true);
    expect(says(TERMS.replace(licence.date, '2030-01-01'))).toBe(false);
    for (const topic of ['## Non-custodial software', '## Your responsibility', '## Not financial advice', '## No warranty', '## Licence', '## Contact']) {
      expect(section(TERMS, topic), topic).not.toBeNull();
    }
  });

  it('Help: §6.4\'s topics in order, each in the UI\'s own words — controls: a topic dropped, a label the UI changed', () => {
    expect(helpProblems(HELP)).toEqual([]);
    expect(helpProblems(HELP.replace('## A damaged wallet', '## Damage'))).toEqual(['## A damaged wallet: missing']);
    const renamed = helpTopics().map(t => (t.heading === '## The anti-phishing phrase' ? {...t, must: t.must.map(m => (m === SECURITY_TEXT.phraseHelp ? 'Never type it anywhere.' : m))} : t));
    expect(helpProblems(HELP, renamed)).toEqual(['## The anti-phishing phrase: missing "Never type it anywhere."']);
    // The damaged screens' words are unlock.html's (the vault page's static copy), not Help's own.
    for (const line of helpTopics()[2].must.slice(0, 7)) expect(UNLOCK_HTML, line).toContain(line);
  });

  it('Help restates the coordinator\'s view only as the privacy sentences themselves — control: P5 with one number changed is found', () => {
    const body = section(HELP, '## What does the coordinator see?');
    const p5 = sentence('P5');
    expect(body).toContain(p5);
    const changed = HELP.replace(p5, p5.replace('every 5 seconds', 'every 10 seconds'));
    expect(helpProblems(changed)).toEqual([`## What does the coordinator see?: missing "${p5}"`]);
    for (const id of ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P11', 'P12', 'P13']) expect(PRIVACY_MD, id).toContain(sentence(id));
  });

  it('data-usage: §6.3\'s table row for row, each row backed by its privacy sentences — controls: a flipped answer, a wrong backing', () => {
    expect(specRows().map(r => r[0])).toEqual(Object.keys(BACKING));
    expect(dataUsageProblems(DATA_USAGE)).toEqual([]);
    expect(dataUsageProblems(DATA_USAGE.replace('| Location | **Yes** |', '| Location | **No** |'))).toEqual(['row 6 (Location) differs from §6.3']);
    expect(dataUsageProblems(DATA_USAGE.replace('| P15 |', '| P14 |'))).toEqual(['row 8 (User activity) backed by P14']);
  });

  it('data-usage: the three certifications, each confirmed by R20 (ICO §6.2 answer 5); remote code none — control: R20\'s text is the answer\'s', () => {
    const certs = section(DATA_USAGE, '## Certifications') ?? '';
    for (const c of [
      'I do not sell or transfer user data to third parties, outside of the approved use cases',
      'I do not use or transfer user data for purposes that are unrelated to my item\'s single purpose',
      'I do not use or transfer user data to determine creditworthiness or for lending purposes',
    ]) {
      const line = certs.split('\n').find(l => l.includes(c));
      expect(line, c).toBeDefined();
      expect(line, c).toContain('R20');
    }
    const r20 = PRIVACY_SENTENCES.find(s => s.id === 'R20');
    expect(r20.source).toBe('ICO §6.2 answer 5');
    expect(certs).toContain(r20.text);
    expect(read('release/ico-retention.md')).toContain('5 Use: only to answer requests, protect from abuse (rate limits, CrowdSec), diagnose faults. Not sold or shared for any other purpose.');
    expect(section(DATA_USAGE, '## Remote code')).toMatch(/^\s*\*\*None\.\*\*/);
  });
});
```

- [ ] **Step 2: Run — red.**

Run (in `extension/`): `TZ=UTC npx vitest run scripts/__tests__/storeTexts.test.mjs`
Expected (observed on the base tree — Task 3's rev 2 commit 496c770 — + this file only):
```
 FAIL  scripts/__tests__/storeTexts.test.mjs [ scripts/__tests__/storeTexts.test.mjs ]
Error: ENOENT: no such file or directory, open '…/extension/release/terms.md'
 ❯ scripts/__tests__/storeTexts.test.mjs:26:15
 Test Files  1 failed (1)
      Tests  no tests
```
(The four texts do not exist; every test reads them at module load.) With the four texts of Step 3 written but `live-check.mjs` still as Task 3 left it (Step 3b not applied), observed: `Tests  1 failed | 13 passed (14)` — “Terms: the live check refuses the draft as written (its DRAFT note) …” · `AssertionError: expected [] to deeply equal [ 'terms' ]` (no page has a `mustNot`).

- [ ] **Step 3: Write the four texts.** Each paragraph and each list item is ONE line (no hard wrap): the test compares UI strings and sentences verbatim against the raw file, and a wrapped line would split them.

`extension/release/terms.md` (new, in full):

```markdown
# Terms of Service

> **DRAFT for the owner's lawyer — not legal text and not in force.** Written from what the extension's code does (B1e spec §6.4, owner decision E4); the owner or a lawyer approves the wording before ICO publishes it at https://noc-tura.io/extension/terms, and this note is not published. Open for the lawyer: the provider's legal name and address, the governing law and courts, eligibility (age, sanctioned persons), the limitation-of-liability wording and what consumer law in the EU requires on top of it, and how users are told of a change.

These terms cover the Noctura browser extension for Chrome ("the extension"), a Solana wallet. By using the extension you agree to them.

## What the extension is

The extension is software that runs in your browser. It lets you create or import a wallet, hold, send and receive SOL and tokens on the Solana blockchain, and approve requests from Solana sites. It reads Solana and submits your transactions through the Noctura coordinator at api.noc-tura.io; what the coordinator receives and keeps is described in the Privacy Policy at https://noc-tura.io/extension/privacy.

## Non-custodial software

Your recovery phrase and your keys are created on your device and stored in this browser, encrypted with your password. Noctura never receives them, never holds your funds and cannot move, freeze, recover or reset anything in your wallet. If you lose your recovery phrase and your password, no one — not Noctura, not anyone else — can restore access to your funds.

## Your responsibility

You are responsible for:

- keeping your recovery phrase, your password and your device safe, and never giving your recovery phrase to anyone;
- checking every transaction, message and connection before you approve it, and the sites you connect the wallet to;
- the transactions you approve. A transaction confirmed on Solana is final: Noctura cannot reverse, cancel or refund it.

The extension's simulations, warnings and blocks help you decide; they are not a guarantee. A simulation shows what a transaction would do when it was simulated, and a site or the network can change what happens afterwards.

## The service

The coordinator and the providers behind it may be slow, unavailable or changed at any time, and the extension then cannot read balances or submit transactions. Your funds stay on Solana, and your recovery phrase still controls them.

## Not financial advice

Nothing in the extension is financial, investment, legal or tax advice. Prices and values it shows are for information only and may be delayed or wrong.

## No warranty

The extension is provided "as is" and "as available", without warranty of any kind, express or implied, including fitness for a particular purpose, to the extent the law allows. To the extent the law allows, Noctura is not liable for any loss of funds, data or profit that arises from your use of the extension — including a lost recovery phrase or password, a transaction you approved, a site you connected, or the coordinator or the Solana network being unavailable.

## Licence

The extension's source code is licensed under the Business Source License 1.1, as its LICENSE file states, including that licence's Additional Use Grant. Under that licence each version becomes available under the MIT License on 2034-01-01, or on the fourth anniversary of that version's first public distribution if that comes first. The open-source components the extension includes keep their own licences, listed in the extension under Settings → About Noctura → Open-source licenses.

## Changes

These terms may change. The version published at https://noc-tura.io/extension/terms is the one that applies.

## Contact

Questions about these terms: privacy@noc-tura.io. 
```

`extension/release/help.md` (new, in full — the P5 bullet under "What does the coordinator see?" is Task 3's rev 2 P5, two sentences, the recipient lookup included; Help with rev 1's one-sentence P5 is red, M-help-old-P5):

```markdown
# Help & support

Answers to common questions about the Noctura browser extension for Chrome, a Solana wallet. The names in quotes are the words you see in the extension. For anything not answered here, write to privacy@noc-tura.io.

## Your recovery phrase

Your recovery phrase is the 12 or 24 words shown when you create a wallet. It is the only backup of your wallet: anyone who has the words can spend everything in it, and Noctura never receives them, so Noctura cannot give them back to you.

- Write the words on paper, in order, and keep them off this computer.
- To see them again: Settings → "Recovery phrase" opens "Show your recovery phrase" in a new tab. Enter your password first; nothing is shown until you press and hold.
- To check your written copy: Security center → "Verify recovery phrase".
- If you forget your password: on the unlock screen, choose "Forgot password?" and enter your recovery phrase, then choose a new password. A passkey is not carried over; you can add one again later.
- To use your wallet in another browser: install Noctura there, choose "I have a wallet" and enter the phrase.
- Never type your recovery phrase into a website, a message or a form. Noctura never asks for it.

## The anti-phishing phrase

A website can draw a fake "Noctura" window inside its own page and ask for your password or an approval. The anti-phishing phrase is a few words you choose: "Noctura shows it on its unlock and approval windows. A window without it is not Noctura's." A website cannot read it.

- Set it when you create or import a wallet ("Set an anti-phishing phrase" — optional, you can skip it), or later in Security center → "Anti-phishing phrase". "A change or a removal asks for your password in a new tab."
- It shows on the unlock screen before you type your password, on the locked screen of the toolbar window, on every approval window (connecting a site, signing a message, approving a transaction) and on the tab where you confirm with your password.
- Two things it does not protect against: "Never type it into a website. Anyone who uses this browser profile can see it." A site that asks you to type or "confirm" your phrase is not Noctura. And the phrase is shown before you unlock, so anyone using this browser profile can see it — it tells Noctura's windows apart from a website's, not you from another person.
- If a window says "Anti-phishing phrase could not be read — don't type your password until it shows", do what it says: close the window and open Noctura again from its icon in your browser's toolbar.

## A damaged wallet

Noctura keeps your wallet in this browser's storage. If that stored data cannot be opened, the unlock screen shows one of two screens instead of the password field.

"Update Noctura to open this wallet" — "This version of Noctura can't open this wallet's data." The data may come from a newer version of Noctura. "Update Noctura (in Chrome: Extensions → Update)." If it is up to date, the data may have been changed. Nothing is removed, and this screen offers no way to remove the wallet: a newer version may still open it.

"Wallet data is damaged" — "This browser's copy of your wallet can't be read by this or any later version of Noctura." Your funds are on Solana: after you remove this copy, only your recovery phrase reaches them. Make sure you have the phrase first. "Remove damaged wallet" removes the wallet from this browser only, after you type DELETE and confirm; it waits while a transaction from the wallet is still pending.

On both screens, "Save the damaged data" downloads the stored data exactly as this browser holds it, before anything is removed. If it contains your encrypted wallet, anyone with the file and your password could try to open it, so keep the file to yourself and share it only with someone you trust to help you.

A third case: if your password is accepted but Noctura then says "This wallet's stored data is damaged.", your funds stay on Solana and your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.

## Why does my passkey show as "wallet.noc-tura.io"?

If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it. In your passkey manager the passkey is listed under the name wallet.noc-tura.io.

The sites you connected, your address book and your anti-phishing phrase are stored only in this browser. Nothing is served at wallet.noc-tura.io and the extension never connects to it; the name exists only so that passkeys are bound to a name no website can use.

A passkey is a convenience: your password always unlocks the wallet too. To stop using it, open Settings → "Passkey" and choose "Remove passkey". It is still saved in your passkey manager (Google, Apple or your password manager). Delete it there if you no longer need it.

## Why is a transaction blocked?

Every transaction a site asks you to approve is simulated first, and the approval window shows what it would change. Some transactions are blocked until you confirm them on purpose; some cannot be approved at all.

- "Critical · Blocked transaction" — the transaction changes who controls one of your accounts (assigning your wallet account to a program, or giving an authority over an account you own to another address), or a step of a batch depends on an earlier step and could not be checked on its own. "Critical · Unlimited spend approval" and "Critical · Large spend approval" — the transaction lets another address move all, or nearly all, of a token you hold until you revoke it. Approve stays off until you type the word the window shows (ASSIGN, AUTHORITY, UNCHECKED, UNLIMITED, ALLOWANCE or the token's symbol); then "Approve anyway" (or "Approve unlimited") asks you to confirm with your password or passkey: "Re-auth required to override a blocked transaction." "Approving asks you to confirm with your password (or passkey) — you'll start it from the Noctura icon." If you did not expect any of this, reject the request.
- "Presale purchase blocked" — the transaction buys NOC in the presale and your region does not allow it, or the region check did not succeed. "Only Reject is available · no override".
- "Request blocked automatically" — a site you connected sent a transaction from a different origin than the one you connected. Noctura rejects it without showing Approve.
- "Couldn't simulate" or "Could not reach the Noctura server." — the simulation failed or the coordinator did not answer; only Reject is available. Ask the site to try again later. "This request has expired. Ask the site to try again."
- A site you blocked with "Block this site" or "Reject and report" gets every request declined at once, without a window. To allow it again: Settings → "Connected dApps" → "Blocked sites" → "Unblock".
- "Too many requests from sites in the last few minutes — some were declined without asking you." — sites sent more requests in a few minutes than Noctura accepts, and the rest were declined; ask the site to try again later.

## What does the coordinator see?

The extension reads Solana, simulates and submits transactions through the Noctura coordinator. In the privacy policy's own words:

- The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator.
- Every request to the coordinator carries your IP address and the standard headers your browser sends.
- The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing.
- When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds.
- Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it, and every 5 seconds after a simulation that fails. When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token.
- Every transaction the wallet submits is sent to the coordinator, which broadcasts it to Solana: your own sends, and the transactions a site asks the wallet to sign and send. A transaction a site asks only to sign is returned to that site.
- The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data.
- Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes.
- Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.

What the coordinator keeps, for how long, and who else receives it is in the Privacy Policy: https://noc-tura.io/extension/privacy. Solana itself is public: anyone can read an account's balance and the transactions it took part in.

## Contact

Questions, problems, or a request to delete data the coordinator holds about you: privacy@noc-tura.io. Never send your recovery phrase or your password — Noctura never asks for them.
```

`extension/release/listing.md` (new, in full):

```markdown
# Chrome Web Store listing — Noctura

The texts to paste into the Chrome Web Store developer dashboard for the first release (B1e spec §6.4, §7 step 3). Each permission's justification is the reason `manifest/source.mjs` gives (`PERMISSIONS`, `HOST_PERMISSIONS`, `CONTENT_SCRIPTS.reason`); the data-usage answers are in `data-usage.md`. The extension is a transparent Solana wallet: nothing here claims more than the build keeps.

## Name

Noctura

## Summary (short description)

Noctura wallet for Solana.

## Category

The owner picks it at submission.

## Single purpose

A Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.

## Detailed description

Noctura is a Solana wallet for your browser. Create a wallet or import one with a 12- or 24-word recovery phrase, hold SOL and tokens, send and receive them, and approve requests from Solana sites.

Your keys stay on this device. The recovery phrase and keys are stored in this browser, encrypted with your password; Noctura never receives them.

What it does:

- Several accounts in one wallet, an address book, and each account's activity with a link to the Solscan explorer.
- Sites find the wallet through Wallet Standard. Every connection, message signature and transaction asks for your approval in its own window.
- Every transaction is simulated before you approve it; the window shows the balance changes and the decoded instructions.
- Unlimited spend approvals, a change of who controls one of your accounts, and steps that cannot be checked on their own are blocked until you type a confirmation word and confirm with your password or passkey.
- Lookalike domains are flagged, and a transaction from a different origin than the connected site is rejected automatically.
- An anti-phishing phrase you choose appears on Noctura's unlock and approval windows, so a fake window drawn by a website can be told apart.
- The wallet locks itself after an idle time you choose (1 to 60 minutes, five by default), and can unlock with a passkey as well as your password.

Solana is a public blockchain: anyone can read an account's balance and the transactions it took part in. Noctura does not hide them.

The extension reads Solana, simulates and submits your transactions through the Noctura coordinator, api.noc-tura.io. What the coordinator receives and keeps is in the privacy policy: https://noc-tura.io/extension/privacy. Questions: privacy@noc-tura.io.

## Permission justifications

### `storage`

The encrypted vault (the local storage area) and the unlocked per-account signing keys (the session storage area, memory only).

### `alarms`

Auto-lock: the vault locks itself after the chosen idle time, default five minutes.

### `https://api.noc-tura.io/*`

Reads through the coordinator RPC proxy, prices, the jurisdiction check and broadcast — readable without CORS.

### `https://wallet.noc-tura.io/*`

The passkey relying-party ID: an extension may claim an RP ID only for a host it has permission for.

No page is served at this host and the extension never connects to it (its content security policy allows connections to one other host only). The permission exists only so the passkey is bound to a name no website can use; passkeys appear under this name in the user's passkey manager.

### Content scripts (`<all_urls>`)

Sites find the wallet through Wallet Standard, which must be present on every page; the scripts read nothing from the page and send nothing unless the site asks the wallet.

## Remote code

**No.** Every script the extension runs is in its package. Its pages' content security policy is `script-src 'self'`, with no `unsafe-eval` and no `wasm-unsafe-eval`, so no page of the extension can load or evaluate code from anywhere else; the permissions gate (`scripts/check-permissions.mjs`, `REQUIRED_CSP`) fails the build if that changes.

## Data usage

The form's answers and certifications: `data-usage.md` (B1e spec §6.3). Privacy policy URL: https://noc-tura.io/extension/privacy
```

`extension/release/data-usage.md` (new, in full — the table's first three columns are §6.3's rows copied from the spec, not retyped; the fourth is `BACKING` in the test):

```markdown
# Chrome Web Store data-usage form — Noctura

The answers to the dashboard's data-usage questions for the first release (B1e spec §6.3, owner decision E13), for the store build (owner decision E2). The first three columns are §6.3's table as the spec writes it; the fourth names the sentences of the Privacy Policy (`privacySentences.mjs`, published in `privacy.md`) that say the same to users. Questions: privacy@noc-tura.io.

## The form

| CWS category | answer | why (code) | Privacy Policy sentences |
|---|---|---|---|
| Personally identifiable information | **No** | nothing names a person; addresses are disclosed under Financial | P3, P4 |
| Health information | **No** | — | — |
| Financial and payment information | **Yes** | wallet addresses, transaction contents (simulation), signed transactions (broadcast): P3–P6 | P3, P4, P5, P6 |
| Authentication information | **No** | password, seed and keys stay in the vault page / session (vault isolation); the passkey ceremony is the browser's (P11, P12) | P11, P12 |
| Personal communications | **No** | messages to sign are signed locally (P10) | P10 |
| Location | **Yes** | the IP address with every request (P2); a country derived from it for a site's presale purchase (P8) | P2, P8, R12 |
| Web history | **No** | connected-site hostnames stay in `v1_dapp_grants` (P13) | P13, P14 |
| User activity | **No** | no clicks, keystrokes or analytics leave (P15) | P15 |
| Website content | **Yes** (E13) | the transaction bytes a site hands the wallet go to simulation, and to broadcast for sign-and-send (P5, P6) | P5, P6 |

## Certifications

Each is ticked: §6.3 allowed it only after ICO's §6.2 answer confirmed it for the coordinator, and that answer (received 2026-11-01, `ico-retention.md`, part 5) is Privacy Policy sentence R20: "The coordinator uses this data only to answer requests, to protect the service from abuse (rate limits and CrowdSec) and to diagnose faults. It is not sold or shared for any other purpose."

- [x] I do not sell or transfer user data to third parties, outside of the approved use cases — confirmed by R20. The two recipients outside the coordinator are within those uses: Helius receives RPC requests and signed transactions to answer and broadcast them (R17, R18), and CrowdSec's central service receives an alerting IP address for abuse protection (R15).
- [x] I do not use or transfer user data for purposes that are unrelated to my item's single purpose — confirmed by R20 (answering requests, abuse protection, fault diagnosis).
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes — confirmed by R20: those three uses are the only ones; ICO's answer does not name creditworthiness or lending separately.

## Remote code

**None.** The extension pages' content security policy is `script-src 'self'` with no `wasm-unsafe-eval` (`EXTENSION_CSP`, pinned by `scripts/check-permissions.mjs` `REQUIRED_CSP`); every script is in the package.

## Privacy policy

https://noc-tura.io/extension/privacy

## Not in the Chrome manifest

`data_collection_permissions` is AMO's (Firefox, `browser_specific_settings.gecko`); the Chrome manifest carries none (spec §6.3, Minor 11, §8).
```

- [ ] **Step 3b: The live check refuses the draft Terms (rev 2, Fable review 1 I4).** In Task 3's `extension/scripts/live-check.mjs`: the markers — the DRAFT note's own words, from its first sentence "DRAFT for the owner's lawyer — not legal text and not in force." — exported for the test to read, the Terms page's `mustNot`, and `pageProblems` refusing each one found. Compared on the folded page text (so "owner’s" with a typographic apostrophe, or `&rsquo;`, is caught), case-sensitive (a lawyer's text that says "draft" in lower case passes; "DRAFT" does not).

```diff
diff --git a/extension/scripts/live-check.mjs b/extension/scripts/live-check.mjs
index 312b1c8..150c434 100644
--- a/extension/scripts/live-check.mjs
+++ b/extension/scripts/live-check.mjs
@@ -14,15 +14,24 @@ import {PRIVACY_SENTENCES} from '../release/privacySentences.mjs';
 /** The contact every page carries (E8). */
 export const CONTACT = 'privacy@noc-tura.io';
 
+/**
+ * What only the unpublished Terms draft says (release/terms.md's DRAFT note, its first sentence: "DRAFT for the
+ * owner's lawyer — not legal text and not in force."). A Terms page carrying any of them is the draft published with
+ * its note, and fails (B1e-2 Task 4, Fable review 1 I4): case-sensitive, compared on the folded text, so "owner’s"
+ * with a typographic apostrophe is caught too.
+ */
+export const TERMS_DRAFT_MARKERS = Object.freeze(['DRAFT', 'not in force', "owner's lawyer"]);
+
 /**
  * The three pages, in the order they are read. The URLs are src/shared/links.ts NOCTURA_PAGES' (a test pins them
  * equal); each title is the label of the #38 row that opens it (src/app/screens/About.tsx ABOUT_TEXT), so the page a
  * user lands on is headed with the name they clicked. Terms and Help must each carry their title and CONTACT; the
- * privacy page must carry every sentence of privacySentences.mjs (P16 is the contact).
+ * privacy page must carry every sentence of privacySentences.mjs (P16 is the contact). `mustNot`: text the page may
+ * not carry (Terms: TERMS_DRAFT_MARKERS).
  */
 export const LIVE_PAGES = Object.freeze([
   Object.freeze({name: 'privacy', url: 'https://noc-tura.io/extension/privacy', title: 'Privacy Policy', sentences: true}),
-  Object.freeze({name: 'terms', url: 'https://noc-tura.io/extension/terms', title: 'Terms of Service', sentences: false}),
+  Object.freeze({name: 'terms', url: 'https://noc-tura.io/extension/terms', title: 'Terms of Service', sentences: false, mustNot: TERMS_DRAFT_MARKERS}),
   Object.freeze({name: 'help', url: 'https://noc-tura.io/extension/help', title: 'Help & support', sentences: false}),
 ]);
 
@@ -93,6 +102,9 @@ export function pageProblems(page, html, sentences = PRIVACY_SENTENCES) {
   const out = [];
   if (!text.includes(foldText(page.title))) out.push(`${page.name}: missing its title "${page.title}"`);
   if (!text.includes(CONTACT)) out.push(`${page.name}: missing the contact ${CONTACT}`);
+  for (const m of page.mustNot ?? []) {
+    if (text.includes(foldText(m))) out.push(`${page.name}: carries "${m}" — the draft's note, which is not published`);
+  }
   return out;
 }
 
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates.**

Run: `TZ=UTC npx vitest run scripts/__tests__/storeTexts.test.mjs` — `Tests  14 passed (14)`. **Every total in this step re-measured at rev 2 on b120c48** (the suites and `reproducible` in a clean `git archive` copy, build / gates / root check in the clone).
Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`.
`TZ=UTC npx vitest run` — `Test Files  244 passed (244)` · `Tests  5429 passed | 1 skipped (5430)` (base 496c770 measured in a `git archive` copy: `243 passed (243)` · `5415 passed | 1 skipped (5416)` — +1 file, +14 tests).
`TZ=UTC npx vitest run --config vitest.nopresale.config.ts` — `Test Files  22 passed (22)` · `Tests  550 passed | 25 skipped (575)` (unchanged: no shared file added).
`npm run build` — exit 0. `npm run gates` — exit 0, among its lines `vault isolation ok (dist): …`, `rpc methods ok: every method name the extension bundles is on the proxy allowlist, and the list equals the spec`, `no TGE date (dist present): 735 source and built files checked`, `no TGE date (dist-nopresale present): 735 source and built files checked`, `links ok (dist): …`, `links ok (dist-nopresale): …`, `no presale ok (dist-nopresale off, dist on): …`.
`npm run reproducible` — on this tree AND on the base tree (`git archive` copies of b120c48 and 496c770), the same four digests:
```
reproducible: presale chrome 28 files sha256:dd410738e68eb0f24134433da458908644ffa7f07778688dc328e796ba5e9245
reproducible: presale firefox 28 files sha256:4f16d750f3c31eafd5ab25d7fbe34b259967d32ac583fff09452a1e4917255ca
reproducible: no-presale chrome 28 files sha256:3bfc93f5eaa0c2b110595468438253f46a9e35dd5fdb56d4df209b41cf2836db
reproducible: no-presale firefox 28 files sha256:e8b7ec835cbc9521b35f29542d8c0107d4008d4f437b712105188269b85dddb9
```
(no build input changed).

**First runs of the dry run, recorded so the executor does not reintroduce them:** (1) `/\bNOC\b/i` matched the `noc` of `noc-tura.io` — the NOC check is case-sensitive, the presale check case-insensitive; (2) the "privacy" rule first caught `…/extension/privacy` (the URL path) and `privacy.md` (a file name) — both are allowed by a lookbehind / lookahead; (3) `data-usage.md`'s first wording said "the dashboard's Privacy practices tab", "privacy sentences" and "`--no-presale`" — reworded ("data-usage questions", "Privacy Policy sentences", "owner decision E2") rather than widen the rule; (4) a first Terms draft hard-wrapped "MIT License on" / "2034-01-01" across two lines — the texts are one line per paragraph since.

- [ ] **Step 5: Commit.**

```bash
git add extension/release/terms.md extension/release/help.md extension/release/listing.md extension/release/data-usage.md extension/scripts/__tests__/storeTexts.test.mjs extension/scripts/live-check.mjs
git commit -m "feat(extension): B1e-2 Task 4 — the Terms draft, Help, the store listing and the CWS data-usage form (spec §6.3, §6.4); the live check refuses a Terms page that still carries the DRAFT note" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
Then, repo root: `node scripts/check-no-tge-date.mjs` — `no TGE date in 1391 tracked text files` (exit 0); `--self-test` — `self-test ok: 70 forms caught, near misses pass`.

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked for `extension/` and `web/`); `tsc`'s own exit code first, then `TZ=UTC npx vitest run scripts/__tests__/storeTexts.test.mjs`.** Every edit matched (first occurrence replaced). Observed on the dry run's commit 9fdf380; all 15 red, none INVALID. **Rev 2: all 15 re-run on b120c48** (the counts below; the file has 14 tests) **and six I4 / M5 rows added** — 21 red, none INVALID.

| # | mutation (file: old → new) | tsc | result (the failing assertion) |
|---|---|---|---|
| M1 | `manifest/source.mjs`: alarms' reason "default five minutes" → "default ten minutes" | 0 | 1 failed \| 13 passed (14) — `expected [ 'alarms: reason not verbatim' ] to deeply equal []` |
| M2 | `manifest/source.mjs`: a `{value: 'tabs', reason: 'Tabs.'}` added to `PERMISSIONS` | 0 | 1 failed \| 13 passed (14) — `expected [ 'tabs: no section' ] to deeply equal []` |
| M3 | `release/listing.md`: the summary → 133 × "a" | 0 | 1 failed \| 13 passed (14) — `expected 'aaaa…' to be 'Noctura wallet for Solana.'` |
| M4 | `release/help.md`: "Answers to common questions" → "Anonymous answers to common questions" | 0 | 1 failed \| 13 passed (14) — `help: expected [ 'Anonymous' ] to deeply equal []` |
| M5 | `release/privacySentences.mjs`: P5 "again every 30 seconds while" → "again every 60 seconds while" (Help not updated) | 0 | 3 failed \| 11 passed (14) — `"## What does the coordinator see?: missing \"Before you sign, …"`; rev 2 also red: “Terms: the live check refuses the draft as written …” (it serves privacy.md / Help through `liveCheck`) |
| M6 | `src/app/screens/Security.tsx`: `phraseHelp` "Never type it into a website." → "Never type it into any website." | 0 | 2 failed \| 12 passed (14) — the anti-phishing topic misses the UI's new string |
| M7 | `LICENSE`: `Change Date: 2034-01-01` → `2033-01-01` | 0 | 1 failed \| 13 passed (14) — `expected { date: '2033-01-01', … } to deeply equal { date: '2034-01-01', … }` |
| M7b | `release/terms.md`: "MIT License on 2034-01-01" → "… on 2033-01-01" | 0 | 1 failed \| 13 passed (14) — the Terms test, `expected false to be true` (`says(TERMS)`) |
| M8 | the spec: §6.3 "\| Web history \| **No** \|" → "**Yes**" (data-usage.md not updated) | 0 | 1 failed \| 13 passed (14) — `"row 7 (Web history) differs from §6.3"` |
| M9 | `release/data-usage.md`: "single purpose — confirmed by R20" → "… confirmed by ICO" | 0 | 1 failed \| 13 passed (14) — `… unrelated to my item's single purpose: expected '- [x] I do not use …' to contain 'R20'` |
| M10 | `release/terms.md`: "Questions about these terms: privacy@noc-tura.io." → "…: write to us." | 0 | 2 failed \| 12 passed (14) — `terms: expected [ Array(1) ] to deeply equal []` (`terms: missing the contact privacy@noc-tura.io`); rev 2 also red: “Terms: the live check refuses the draft as written …” (its expected problem list is the three markers alone; the missing contact adds a fourth) |
| M11 | `release/help.md`: "## Why is a transaction blocked?" → "## Blocked transactions" | 0 | 2 failed \| 12 passed (14) — `"## Why is a transaction blocked?: missing"` |
| M12 | `src/approve/strings.ts`: `overlineBlocked` "Critical · Blocked transaction" → "Critical · Transaction blocked" | 0 | 2 failed \| 12 passed (14) — `"## Why is a transaction blocked?: missing \"Critical · Transaction blocked\""` |
| M13 | `release/listing.md`: the E17 paragraph's "No page is served at this host and the extension never connects to it" → "No page is served at this host" | 0 | 1 failed \| 13 passed (14) — the wallet host's section does not contain the E17 paragraph |
| M14 | `release/listing.md`: "Noctura does not hide them." → "… Buy NOC in the presale." | 0 | 1 failed \| 13 passed (14) — `expected '# Chrome Web Store listing — Noctura…' not to match /presale/i` |
| M-mustnot-unchecked | `scripts/live-check.mjs`: the `mustNot` check never fires (`if (false && text.includes(foldText(m)))`) | 0 | 1 failed \| 13 passed (14) — “Terms: the live check refuses the draft as written (its DRAFT note) and passes it with the note removed — controls: the …” |
| M-terms-no-mustnot | `scripts/live-check.mjs`: `mustNot: TERMS_DRAFT_MARKERS` dropped from the Terms page in `LIVE_PAGES` | 0 | 1 failed \| 13 passed (14) — “Terms: the live check refuses the draft as written (its DRAFT note) and passes it with the note removed — controls: the …” |
| M-mustnot-unfolded | `scripts/live-check.mjs`: the markers looked for in the raw HTML (`html.includes(m)`, not the folded text) | 0 | 1 failed \| 13 passed (14) — “Terms: the live check refuses the draft as written (its DRAFT note) and passes it with the note removed — controls: the …” |
| M-marker-dropped | `scripts/live-check.mjs`: `TERMS_DRAFT_MARKERS` without `"owner's lawyer"` | 0 | 1 failed \| 13 passed (14) — “Terms: the live check refuses the draft as written (its DRAFT note) and passes it with the note removed — controls: the …” |
| M-help-old-P5 | `release/help.md`: the P5 bullet as rev 1 wrote it (Task 3's rev 2 sentence deleted) | 0 | 2 failed \| 12 passed (14) — “Help: §6.4's topics in order, each in the UI's own words — controls: a topic dropped, a label the UI changed”; “Help restates the coordinator's view only as the privacy sentences themselves — control: P5 with one number changed is f…” |
| M-terms-note-gone | `release/terms.md`: the note's first sentence → "**Approved.**" (the negative control's premise gone) | 0 | 2 failed \| 12 passed (14) — “Terms: the live check refuses the draft as written (its DRAFT note) and passes it with the note removed — controls: the …”; “Terms: a DRAFT for the owner's lawyer, said first; the BSL 1.1 change date and licence are LICENSE's — control: another …” |

(A first M14 put the planted line before `## Category`, i.e. into the Summary section: 2 red — the summary test as well. Re-placed in the detailed description to isolate the presale rule.)

#### Notes for the executor (Task 4)

- **Rev 2 (Fable review 1, M5 / I4).** I4 is this task's: the live check refused nothing about the Terms but its title and contact, so the draft published "exactly as written" — DRAFT note included — passed, and 1.0.0 would ship pointing at Terms that say they are not in force. Now `TERMS_DRAFT_MARKERS = ['DRAFT', 'not in force', "owner's lawyer"]` (the note's first sentence, "DRAFT for the owner's lawyer — not legal text and not in force.") is the Terms page's `mustNot` in `LIVE_PAGES`, checked case-sensitively on the folded page text (fail closed). **It changes Task 3's `scripts/live-check.mjs` here, in Task 4**, because this task's text is what makes the answer change: before `terms.md` exists there is no note to refuse. The test's negative control is real — `terms.md` as committed (rendered as the live check sees it: plain HTML through `pageProblems`, and through `liveCheck` with an injected fetch serving all three pages) FAILS with three problem lines; with line 3 and its blank line removed it passes; the markers occur in the note and nowhere else in the file; a typographic `&rsquo;` is caught. Why these three: each is in the note's first sentence and none belongs in an approved Terms; "DRAFT" upper case only, so a lawyer's lower-case "draft" passes. Cost if wrong (the lawyer's text needs one of these words): the page fails the release until the list changes — a false refusal, never a false pass. M5 reaches this task through Help: its P5 bullet is Task 3's rev 2 P5 verbatim (`help.md`, Step 3), else two Help rows go red (M-help-old-P5).
- **Rulings (the controller's to confirm):**
  - **The summary is the manifest's `description`, "Noctura wallet for Solana." (26 characters).** Why: the Chrome Web Store takes the item's summary from the package's manifest `description` (the dashboard shows it read-only); a different "short description" in `listing.md` could not be pasted anywhere and would be a second, diverging statement. The test pins `section(Summary) === render('chrome').description` and the ≤ 132 rule (132 passes, 133 and empty fail). Cost if wrong (the dashboard does take a separate summary): replace the section's text, and the equality line becomes the length check alone. If the owner wants a fuller summary, it is a `source.mjs` `description` change — a build-output change (manifest, reproducible digests) for a later task, not a text edit here.
  - **"presale" — absent from the listing and the Terms (and `\bNOC\b` too); in Help and the data-usage form only on lines that carry P7 / P8 verbatim, F12's `regionHead` / `regionClosed`, or §6.3's Location cell.** Why: F12 runs in the store build (E2), so "why is a transaction blocked" must name its real screen ("Presale purchase blocked" · "Only Reject is available · no override"), and the coordinator topic is P1–P8 verbatim, which include P7 / P8. Cost if the owner wants no presale word in Help: drop the F12 bullet and replace the P7 / P8 bullets by a pointer to the policy — Help would then omit a real blocked state.
  - **Help restates the privacy sentences verbatim, never paraphrased:** P1–P8 and P11 under "What does the coordinator see?", P12 and P13 under the passkey question — Task 3's corrected P3 (the viewed account + the first ten), P5 (30 s, and 5 s after a failure) and P8 (a copy for up to 10 minutes) by construction. A sentence Task 3 (or a later task) changes turns Help red (M5). Cost: Help reads as the policy in places; that is the point.
  - **The UI's words are the screens' own constants** (imported) or `unlock.html`'s static copy (the damaged screens: the test also asserts each of those lines is in `unlock.html`). One exception, deliberately paraphrased: the save note's "keep it private" (`unlock.html` `dmg-save-note`) reads in Help "keep the file to yourself and share it only with someone you trust to help you" — the forbidden-claims rule allows "private" only in "private key(s)", and widening it for one quote would let "private" back in elsewhere.
  - **Forbidden claims, in all four texts:** "private" except "private key(s)"; "privacy" except "Privacy Policy", `privacy@noc-tura.io`, the URL path `…/privacy` and `privacy.md`; `anonym*`, `untraceab*`, `unlinkab*`, "shielded", "secure as a bank", "bank-grade" / "military-grade", "TGE", and every form of `forbiddenForms()`. Each has a planted control.
  - **The test reads the spec** for §6.3's table, the single-purpose statement and the E17 paragraph (with line breaks folded): the texts cannot drift from the spec, and a spec edit to those three must update the texts (M8). The fourth data-usage column (which sentences back each row) is my judgement, pinned in `BACKING`: PII → P3, P4 (public addresses only); Financial → P3–P6; Authentication → P11, P12; Communications → P10; Location → P2, P8 and R12 (where the country lookup happens); Web history → P13, P14; User activity → P15; Website content → P5, P6.
  - **The three certifications are ticked, each citing R20** (= ICO's §6.2 answer part 5, `ico-retention.md`, received 2026-11-01): "only to answer requests, protect from abuse (rate limits, CrowdSec), diagnose faults. Not sold or shared for any other purpose." Two things said in the file, not hidden: ICO's answer does not name creditworthiness or lending — the third certification rests on "those three uses are the only ones"; and the first ("outside of the approved use cases") names the two outside recipients — Helius (R17, R18: to answer and broadcast) and CrowdSec central (R15: abuse protection) — as within those uses. Cost if the owner or ICO reads CWS's Limited Use policy otherwise: untick, which the store review then questions; ask ICO for an explicit creditworthiness sentence if wanted.
  - **The certification wording** is the dashboard's as I know it ("I do not sell or transfer user data to third parties, outside of the approved use cases", "… for purposes that are unrelated to my item's single purpose", "… to determine creditworthiness or for lending purposes") — not verified against the live dashboard (no contact with it from the dry run). The owner checks the wording at submission; a difference is a text edit (and the test's three strings).
  - **Terms' licence paragraph is `LICENSE`'s:** BSL 1.1, the Additional Use Grant named, each version to the MIT License "on 2034-01-01, or on the fourth anniversary of that version's first public distribution if that comes first" (the LICENSE's own "whichever comes first" clause — the README says only the change date). Parsed from `LICENSE` and pinned (M7, M7b). No repository URL is given (its visibility is the owner's).
  - **Terms is a draft and says so on line 3** (a blockquote: not legal text, not in force, approved by the owner or a lawyer before ICO publishes it, the note itself not published) and lists the lawyer's open points: the provider's legal name and address, governing law and courts, eligibility (age, sanctioned persons), the limitation-of-liability wording and EU consumer law, how users are told of a change. "Noctura" names the provider, as `LICENSE`'s Licensor does.
  - **Remote code: "No."** in the listing (the dashboard's question is "Are you using remote code?") and **"None."** in the data-usage file (§6.3's wording); both give the reason (`script-src 'self'`, no `unsafe-eval` / `wasm-unsafe-eval`, pinned by `REQUIRED_CSP`), asserted against `EXTENSION_CSP`.
- **Copy written by this task (D27, owner-delegated — for the owner):** all of `terms.md` (draft); `help.md`'s prose around the quoted UI strings and sentences, among it the commitments "Noctura never asks for it" (the recovery phrase) and "Never send your recovery phrase or your password — Noctura never asks for them", and the advice on R9's line ("close the window and open Noctura again from its icon in your browser's toolbar" — the screen itself says only "don't type your password until it shows"); `listing.md`'s header note, the detailed description (each feature checked against the code: several accounts, address book, Solscan link, Wallet Standard, mandatory simulation, the four blocks with their typed words and re-authentication, lookalike and origin-mismatch handling, the phrase, auto-lock 1–60 minutes default five, passkey) and its "Solana is a public blockchain … Noctura does not hide them." line; `data-usage.md`'s introduction, the certification annotations and the remote-code line. No TGE date, nothing presale outside the ruling above, no "private" but "private keys" (tested).
- **For the owner / the controller — found, not changed (outside this task):**
  - **#1 welcome's existing copy makes privacy claims** the store build does not keep: the tagline "A Solana wallet built for private, non-custodial holding." and the chip "E2E encrypted" (`unlock.html` `v-welcome`). Spec §6.4 / memory "shielded privacy guarantee" forbid such claims in the listing; the welcome screen is shown at install and may appear in a screenshot (Task 5). Recommend a copy change in a code task before submission.
  - **#39's footer says "The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address."** (`unlock.html` `fg-foot`) — "your wallet address" contradicts P3 for the wallet as a whole (the coordinator receives the addresses); whether the restore path itself sends one was not checked here. Worth a look with the copy above.
  - `REAUTH.feeReason['pre-tge']` "No Noctura fee before TGE" is UI copy (the word, no date — `check-no-tge-date.mjs` passes); Task 5 should know if #10 is screenshotted.
  - Task 3's part (rev 1) quoted stale reproducible digests (`ed33e05f…`); rev 2 re-measured them there — the same four as this tree (`dd410738…`, `4f16d750…`, `3bfc93f5…`, `e8b7ec83…`); this task changes no build input.
- **What the next tasks must know:** see Interfaces. Task 7's checklist step 3 names `release/listing.md` (paste field by field; the category is the owner's) and `release/data-usage.md` (the table's answers, the three certifications, the privacy policy URL); the DRAFT note is removed from the Terms page by whoever publishes the approved version — and since rev 2 the live check refuses a Terms page that still carries it (`TERMS_DRAFT_MARKERS`), so Task 7's checklist should say the Terms is published without the note. Task 5 is untouched (`release/screenshots/`).

#### Spec rev 2.7 lines (Task 4)

- §6.5 (rev 2, Fable review 1 I4): the Terms page must also NOT carry "DRAFT", "not in force" or "owner's lawyer" (`TERMS_DRAFT_MARKERS`, case-sensitive on the folded text) — the draft's note published by mistake fails the live check.
- §6.4 listing: the short description is the manifest's `description` ("Noctura wallet for Solana.", 26 characters) — the store reads it from the package; a different summary is a `manifest/source.mjs` change.
- §6.4 listing: the content scripts' justification is under "Content scripts (`<all_urls>`)"; remote code is answered "No." with `script-src 'self'` / no `unsafe-eval` / no `wasm-unsafe-eval` as its reason; the listing names the privacy policy URL and the contact.
- §6.4 Help: "what the coordinator sees" is P1–P8 and P11 verbatim, and the passkey answer P12 and P13 verbatim; "why a transaction is blocked" covers the four typed-word blocks (ASSIGN, AUTHORITY, UNCHECKED, UNLIMITED / ALLOWANCE / the symbol) with #10's override, F12's "Presale purchase blocked" (no override), the origin mismatch, a failed or expired simulation, a blocked site and the request budget; the damaged-wallet topic adds the third case of §2.1 (a password-accepted vault whose seed fails: today's `damagedHelp`).
- §6.4: "presale" is absent from the listing and the Terms; in Help and the data-usage form it appears only in P7 / P8 and F12's own strings (and §6.3's Location cell); "private" only in "private key(s)".
- §6.3: `data-usage.md` adds a fourth column naming each row's privacy sentences (Location also R12); the three certifications are ticked on R20 (ICO's answer part 5), naming Helius (R17, R18) and CrowdSec central (R15) as within the approved uses and saying that ICO's answer does not name creditworthiness separately.
- §6.4 Terms: the BSL 1.1 paragraph states `LICENSE`'s change date and its "fourth anniversary … whichever comes first" clause and names the Additional Use Grant; the draft lists the lawyer's open points (provider's legal name and address, governing law, eligibility, liability wording and EU consumer law, notice of changes).


### Task 5: The five store screenshots — `npm run screenshots` (its own Playwright config; `playwright.config.ts` ignores the spec, so `npm run e2e` and CI never run it) drives the real store build (`dist-nopresale/chrome`), contained like every E2E, to five states: the popup's home, #19's send review, #48 (a site's transaction, with the anti-phishing line) in the approval window, the wallet tab at 1280 × 800, and #35 with the phrase On; the popup (412 × 600) and the window (412 × 720) composed 1 : 1, unscaled, centred on `release/screenshots/backdrop.html` (the design system's own ground, undrawn §9), the composed frame byte-equal to the capture; every state's `innerText` through `check-no-tge-date.mjs`'s forms (a planted positive control first); each PNG read back by `scripts/png.mjs` — 1280 × 800, 8-bit colour type 2 (24-bit), no `tRNS` — into the git-ignored `release/screenshots/out/`; the reader unit-tested on PNGs from the test's own encoder

**Spec:** B1e §6.4 "Screenshots (Minor 9)" in full — five at 1280 × 800, Playwright, the real `--no-presale` extension, contained (no network, the coordinator stubbed as the E2E suite does); `wallet.html` at a 1280 × 800 viewport; the popup (412 × 600) and the approval window at their real size, composed 1 : 1 unscaled, centred on a 1280 × 800 page of the design background (`extension/release/screenshots/backdrop.html`, undrawn, §9); the TGE-date check on each captured state's text (`document.body.innerText` against the forms of `scripts/check-no-tge-date.mjs`), not on the pixels. §9 (the backdrop is undrawn, shown to the owner in B1e-2's visual pass). §10 (E2E normally and under `unshare -rn`). §7 step 3 ("add the screenshots" — Task 7's checklist names this task's output). §6.4's "no presale, no TGE date, no privacy claim" (listing) applies to what the screenshots show. **Not here:** the listing text (Task 4), the checklist (Task 7). Runs in parallel with Tasks 3–4 and touches nothing under `extension/release/` except `release/screenshots/`.

**Files:**
- Create: `extension/release/screenshots/backdrop.html` (the backdrop), `extension/e2e/storeScreenshots.spec.ts` (the five shots — in `e2e/`, see Notes R1), `extension/playwright.screenshots.config.ts` (`npm run screenshots`' config), `extension/scripts/png.mjs` (the PNG header reader and the store check), `extension/scripts/png.d.mts` and `extension/scripts/check-no-tge-date.d.mts` (types for the spec's two `.mjs` imports)
- Modify: `extension/playwright.config.ts` (`testIgnore` the spec; exports `STORE_SCREENSHOTS`), `extension/package.json` (`"screenshots"`), `extension/.gitignore` (`release/screenshots/out/`)
- Create (tests): `extension/scripts/__tests__/png.test.mjs` (4)
- Output (never committed, git-ignored): `extension/release/screenshots/out/{1-home,2-send-review,3-site-request,4-wallet-tab,5-security}.png`

**Interfaces:**
- Consumes: `launchPopup`, `contained`, `account`, `type Harness` (`e2e/popupHarness.ts`); `EXT_NOPRESALE` (`e2e/launch.ts`); `E2E_ACCOUNTS`, `E2E_PASSWORD`, `makeEnvelope` (`e2e/makeEnvelope.ts`); `unlockWith` (`e2e/vaultPage.ts`); `associatedTokenAddress` (`e2e/sendHelpers.ts`); `DAPP_HOSTS`, `approvalWindow`, `connect`, `customSignTx`, `openDapp`, `serveDapp`, `windowClosed`, `type RawIx` (`e2e/dappPage.ts`); `forbiddenForms`, `dateViolations` (`scripts/check-no-tge-date.mjs` — the brief's "`forms()`" is these two exports; there is no `forms`); `node:zlib` `crc32` (Node ≥ 22.2). The fake coordinator's `lamports`, `tokenAccounts`, `accountKinds`; the design system's `body` rule and tokens (`web/src/styles/design-system.css`).
- Produces (`extension/scripts/png.mjs`):
  ```js
  export const STORE_SHOT: Readonly<{width: 1280, height: 800, bitDepth: 8, colourType: 2}>;
  export function pngHeader(bytes: Uint8Array): {width, height, bitDepth, colourType, chunks: string[]};  // throws 'not a PNG: …'
  export function storeShotProblems(bytes: Uint8Array): string[];   // [] = a store screenshot; else each problem named
  ```
  `pngHeader` checks the 8-byte signature, every chunk's length and CRC-32, IHDR first and 13 bytes, IEND last. `storeShotProblems` adds: width, height, bit depth, colour type (named: `colour type 6 (truecolour with alpha), not 2 (truecolour: 24-bit)`), and a `tRNS` chunk.
- Produces (`extension/playwright.config.ts`): `export const STORE_SCREENSHOTS = 'storeScreenshots.spec.ts'` (the default config's `testIgnore`, the screenshots config's `testMatch`).
- Produces (`npm run screenshots`): needs `npm run build` first (the spec fails at once with "the store build: run `npm run build` first" otherwise, and checks `dist-nopresale/app.features.json` is `{"presale":false}`); writes exactly the five names above, deleting only those five first.
- **What later tasks rely on:** Task 7's checklist (§7 step 3, "add the screenshots"): `cd extension && npm run build && npm run screenshots`, then upload `release/screenshots/out/1-home.png` … `5-security.png`, in that order; the owner's visual pass looks at the same five files and `backdrop.html`. Task 4's listing may describe them (states below). Task 7's rev 2.7 list takes this task's "Spec rev 2.7 lines".

**The rule, stated once.** A store screenshot is a picture of the real store build in a believable state that no real person owns — the suite's own test mnemonic, the suite's fake coordinator and test site, keys from fixed seeds — and nothing in it is drawn by hand: the popup and the window are the browser's own captures at their real size, put pixel for pixel on a page whose only look is the design system's ground. What a screenshot says is checked as text before it is taken (no TGE date, nothing presale, no failure line); what it is as a file is checked as bytes after it is written (1280 × 800, 24-bit, opaque).

- [ ] **Step 1: Write the failing test.**

Create `extension/scripts/__tests__/png.test.mjs`:

```js
import {crc32, deflateSync} from 'node:zlib';
import {STORE_SHOT, pngHeader, storeShotProblems} from '../png.mjs';

// B1e §6.4 (Minor 9): the store takes JPEG or 24-bit PNG screenshots at 1280 × 800. e2e/storeScreenshots.spec.ts
// checks each PNG it writes with storeShotProblems; this test checks the reader itself on PNGs written here by an
// encoder of the test's own (never png.mjs's code), so the check holds whether or not release/screenshots/out/ exists.
const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const be32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
function chunk(type, data, o = {}) {
  const typed = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
  const crc = (crc32(typed) ^ (o.crcXor ?? 0)) >>> 0;
  return Buffer.concat([Buffer.from(be32(data.length)), typed, Buffer.from(be32(crc))]);
}
const BYTES_PER_PIXEL = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4};
/** A whole PNG: IHDR, an IDAT of black rows (filter byte 0), IEND — or the chunks `o.chunks` puts in their place. */
function png(o = {}) {
  const width = o.width ?? 1280;
  const height = o.height ?? 800;
  const bitDepth = o.bitDepth ?? 8;
  const colourType = o.colourType ?? 2;
  const ihdr = chunk('IHDR', [...be32(width), ...be32(height), bitDepth, colourType, 0, 0, 0], {crcXor: o.ihdrCrcXor});
  const row = 1 + width * (BYTES_PER_PIXEL[colourType] ?? 3) * (bitDepth / 8);
  const idat = chunk('IDAT', deflateSync(Buffer.alloc(row * height)));
  const iend = chunk('IEND', []);
  const chunks = o.chunks?.({ihdr, idat, iend, chunk}) ?? [ihdr, idat, iend];
  return Buffer.concat([Buffer.from(o.signature ?? SIGNATURE), ...chunks]);
}

describe('the store screenshot PNG check (B1e §6.4)', () => {
  test('a 1280 × 800 8-bit truecolour PNG with no transparency passes, and its header reads back exactly', () => {
    expect(STORE_SHOT).toEqual({width: 1280, height: 800, bitDepth: 8, colourType: 2});
    const bytes = png();
    expect(pngHeader(bytes)).toEqual({width: 1280, height: 800, bitDepth: 8, colourType: 2, chunks: ['IHDR', 'IDAT', 'IEND']});
    expect(storeShotProblems(bytes)).toEqual([]);
  });

  test('every other size, depth and colour type is named', () => {
    expect(storeShotProblems(png({width: 1279}))).toEqual(['width 1279, not 1280']);
    expect(storeShotProblems(png({height: 801}))).toEqual(['height 801, not 800']);
    expect(storeShotProblems(png({width: 412, height: 600}))).toEqual(['width 412, not 1280', 'height 600, not 800']);
    expect(storeShotProblems(png({colourType: 6}))).toEqual(['colour type 6 (truecolour with alpha), not 2 (truecolour: 24-bit)']);
    expect(storeShotProblems(png({colourType: 3}))).toEqual(['colour type 3 (palette), not 2 (truecolour: 24-bit)']);
    expect(storeShotProblems(png({bitDepth: 16}))).toEqual(['bit depth 16, not 8']);
  });

  test('a tRNS chunk (transparency in a truecolour PNG) is refused', () => {
    const withTrns = png({chunks: ({ihdr, idat, iend, chunk: c}) => [ihdr, c('tRNS', [0, 0, 0, 0, 0, 0]), idat, iend]});
    expect(pngHeader(withTrns).chunks).toEqual(['IHDR', 'tRNS', 'IDAT', 'IEND']);
    expect(storeShotProblems(withTrns)).toEqual(['a tRNS chunk: the image carries transparency']);
  });

  test('what is not a whole, well-formed PNG is refused, naming why', () => {
    expect(storeShotProblems(png({signature: [137, 80, 78, 71, 13, 10, 26, 11]}))).toEqual(['not a PNG: no PNG signature']);
    expect(storeShotProblems(Buffer.from('<!doctype html>'))).toEqual(['not a PNG: no PNG signature']);
    expect(storeShotProblems(png({ihdrCrcXor: 1}))).toEqual(['not a PNG: chunk IHDR at byte 8 fails its CRC']);
    expect(storeShotProblems(png({chunks: ({ihdr, idat}) => [ihdr, idat]}))).toEqual(['not a PNG: it does not end with IEND']);
    expect(storeShotProblems(png({chunks: ({ihdr, idat, iend}) => [idat, ihdr, iend]}))).toEqual(['not a PNG: IHDR is not the first chunk']);
    expect(storeShotProblems(png({chunks: ({ihdr, idat, iend}) => [ihdr, idat, iend, Buffer.from([0, 0])]}))).toEqual([`not a PNG: a chunk at byte ${png().length} runs past the end`]);
    const short = png({chunks: ({idat, iend, chunk: c}) => [c('IHDR', [0, 0, 5, 0, 0, 0, 3, 32, 8, 2, 0, 0]), idat, iend]});
    expect(storeShotProblems(short)).toEqual(['not a PNG: IHDR is 12 bytes, not 13']);
    expect(storeShotProblems(png().subarray(0, 40))).toEqual(['not a PNG: a chunk at byte 33 runs past the end']);
  });
});
```

- [ ] **Step 2: Run it — red.**

Run (in `extension/`): `TZ=UTC npx vitest run scripts/__tests__/png.test.mjs`
Expected: `Test Files  1 failed (1)` · `Tests  no tests` — `Error: Cannot find module '../png.mjs' imported from …/extension/scripts/__tests__/png.test.mjs`.
Run: `TZ=UTC npx vitest run` — `Test Files  1 failed | 241 passed (242)` · `Tests  5391 passed | 1 skipped (5392)` (the base's 241 / 5391, the new file failing to load). (Observed: in a `git archive` copy of 7fff2cc with the test added.)

- [ ] **Step 3: The reader.**

Create `extension/scripts/png.mjs`:

```js
// B1e §6.4 (Minor 9): the Chrome Web Store takes screenshots as JPEG or 24-bit PNG, 1280 × 800. This reads a PNG's
// chunk list and header (PNG spec §5: the 8-byte signature, then length / type / data / CRC-32 chunks, IHDR first and
// 13 bytes, IEND last) and names every way a file is not exactly that. Reading only: nothing here writes or converts
// an image. e2e/storeScreenshots.spec.ts checks each PNG it writes; scripts/__tests__/png.test.mjs checks
// this reader on PNGs written by the test's own encoder.
import {crc32} from 'node:zlib';

const SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
/** What the store takes: 1280 × 800, 8 bits a sample, colour type 2 (truecolour — red, green, blue: 24 bits a pixel). */
export const STORE_SHOT = Object.freeze({width: 1280, height: 800, bitDepth: 8, colourType: 2});
const COLOUR_TYPES = {0: 'greyscale', 2: 'truecolour: 24-bit', 3: 'palette', 4: 'greyscale with alpha', 6: 'truecolour with alpha'};

/** The chunks of a PNG, each CRC-checked; throws naming the first fault. */
function chunks(bytes) {
  if (bytes.length < SIGNATURE.length || SIGNATURE.some((b, i) => bytes[i] !== b)) throw new Error('no PNG signature');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const out = [];
  for (let at = SIGNATURE.length; at < bytes.length; ) {
    if (at + 12 > bytes.length) throw new Error(`a chunk at byte ${at} runs past the end`);
    const length = view.getUint32(at);
    if (at + 12 + length > bytes.length) throw new Error(`a chunk at byte ${at} runs past the end`);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const crc = view.getUint32(at + 8 + length);
    if (crc32(bytes.subarray(at + 4, at + 8 + length)) !== crc) throw new Error(`chunk ${type} at byte ${at} fails its CRC`);
    out.push({type, data: bytes.subarray(at + 8, at + 8 + length)});
    at += 12 + length;
  }
  if (out[0]?.type !== 'IHDR') throw new Error('IHDR is not the first chunk');
  if (out[0].data.length !== 13) throw new Error(`IHDR is ${out[0].data.length} bytes, not 13`);
  if (out[out.length - 1]?.type !== 'IEND') throw new Error('it does not end with IEND');
  return out;
}

/** The header of a whole, well-formed PNG and its chunk types in order; throws `not a PNG: …` otherwise. */
export function pngHeader(bytes) {
  let list;
  try {
    list = chunks(bytes);
  } catch (e) {
    throw new Error(`not a PNG: ${e instanceof Error ? e.message : String(e)}`);
  }
  const ihdr = list[0].data;
  const view = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
  return {width: view.getUint32(0), height: view.getUint32(4), bitDepth: ihdr[8], colourType: ihdr[9], chunks: list.map(c => c.type)};
}

/** Every way `bytes` is not a store screenshot (STORE_SHOT, no tRNS); empty when it is one. */
export function storeShotProblems(bytes) {
  let h;
  try {
    h = pngHeader(bytes);
  } catch (e) {
    return [e instanceof Error ? e.message : String(e)];
  }
  const out = [];
  if (h.width !== STORE_SHOT.width) out.push(`width ${h.width}, not ${STORE_SHOT.width}`);
  if (h.height !== STORE_SHOT.height) out.push(`height ${h.height}, not ${STORE_SHOT.height}`);
  if (h.bitDepth !== STORE_SHOT.bitDepth) out.push(`bit depth ${h.bitDepth}, not ${STORE_SHOT.bitDepth}`);
  if (h.colourType !== STORE_SHOT.colourType) out.push(`colour type ${h.colourType} (${COLOUR_TYPES[h.colourType] ?? 'unknown'}), not ${STORE_SHOT.colourType} (${COLOUR_TYPES[STORE_SHOT.colourType]})`);
  if (h.chunks.includes('tRNS')) out.push('a tRNS chunk: the image carries transparency');
  return out;
}
```

Create `extension/scripts/png.d.mts`:

```ts
// Types for scripts/png.mjs, read by e2e/storeScreenshots.spec.ts (TypeScript).
export const STORE_SHOT: Readonly<{width: 1280; height: 800; bitDepth: 8; colourType: 2}>;
export function pngHeader(bytes: Uint8Array): {width: number; height: number; bitDepth: number; colourType: number; chunks: string[]};
export function storeShotProblems(bytes: Uint8Array): string[];
```

Create `extension/scripts/check-no-tge-date.d.mts` (the gate's own exports, typed for the spec; the gate is unchanged):

```ts
// Types for scripts/check-no-tge-date.mjs, read by e2e/storeScreenshots.spec.ts (TypeScript).
export function forbiddenForms(): string[];
export function dateViolations(files: {path: string; text: string}[], forms?: string[]): string[];
export function listScanned(root: string): string[];
```

- [ ] **Step 4: Run it — green.**

Run: `TZ=UTC npx vitest run scripts/__tests__/png.test.mjs`
Expected: `Tests  4 passed (4)`.

- [ ] **Step 5: The backdrop, the spec, its config, the ignore rule and the script.**

Create `extension/release/screenshots/backdrop.html`:

```html
<!doctype html>
<!--
  B1e §6.4 (Minor 9), §9: the store screenshots' backdrop — a 1280 × 800 page of the design background, undrawn (index.html
  draws no store screenshot), shown to the owner in B1e-2's visual pass. Nothing of its own: the page's ground is the
  design system's own `body` rule (web/src/styles/design-system.css, the sheet every extension page imports first — the
  accent's radial wash over --bg-base), and the one frame line is the design system's --bg-surface-3 edge. No colour,
  font or drawn text is defined here. e2e/storeScreenshots.spec.ts (`npm run screenshots`) puts the popup's or the
  approval window's capture into #shot at its real size, unscaled, centred, and captures this page.
-->
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Noctura store screenshot</title>
    <link rel="stylesheet" href="../../../web/src/styles/design-system.css" />
    <style>
      html,
      body {
        width: 1280px;
        height: 800px;
        min-height: 0;
        overflow: hidden;
      }
      body {
        display: grid;
        place-items: center;
      }
      #shot {
        display: block;
        outline: 1px solid var(--bg-surface-3);
      }
    </style>
  </head>
  <body>
    <img id="shot" alt="" />
  </body>
</html>
```

Create `extension/e2e/storeScreenshots.spec.ts`:

```ts
import {test, expect, type Page} from '@playwright/test';
import {base58} from '@scure/base';
import {existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {account, contained, launchPopup, type Harness} from './popupHarness';
import {EXT_NOPRESALE} from './launch';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';
import {associatedTokenAddress} from './sendHelpers';
import {DAPP_HOSTS, approvalWindow, connect, customSignTx, openDapp, serveDapp, windowClosed, type RawIx} from './dappPage';
import {dateViolations, forbiddenForms} from '../scripts/check-no-tge-date.mjs';
import {STORE_SHOT, pngHeader, storeShotProblems} from '../scripts/png.mjs';

declare const chrome: {storage: {local: {set(o: object): Promise<void>}}};

// B1e §6.4 (Minor 9), §9: the five Chrome Web Store screenshots, 1280 × 800, 24-bit PNG, from the real store build
// (`--no-presale`, E2), contained like every E2E (noc-tura.io and solscan.io unresolvable and routed, the coordinator the
// E2E suite's fake, the site the suite's test dApp served by a route). The wallet tab is captured at 1280 × 800; the popup
// (412 × 600) and the approval window (412 × 720, its windows.create size) are captured at their real size and composed
// 1 : 1, unscaled, centred on backdrop.html (the design background). The TGE-date check runs on each captured state's
// text (document.body.innerText against forbiddenForms() of scripts/check-no-tge-date.mjs), never on the pixels; its
// positive control plants every form first. `npm run screenshots` (its own config; playwright.config.ts ignores this
// file, so `npm run e2e` and CI never run it). In e2e/ because it is never bundled: the vault-isolation gate skips e2e/
// at the package root, and this spec writes background-owned storage keys as every E2E seeding a wallet does.
const OUT = fileURLToPath(new URL('../release/screenshots/out/', import.meta.url));
const BACKDROP = new URL('../release/screenshots/backdrop.html', import.meta.url).href;
const NAMES = ['1-home', '2-send-review', '3-site-request', '4-wallet-tab', '5-security'] as const;
const POPUP = {width: 412, height: 600};
const WINDOW = {width: 412, height: 720};

/** The wallet: the suite's test mnemonic (abandon … about), its accounts 0 and 1 — a public test vector, nobody's funds. */
const ACCOUNT = E2E_ACCOUNTS[0];
const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const USDT_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
/** 12.4836 SOL, 1,250.00 USDC, 480.50 USDT on the fake chain. */
const LAMPORTS = 12_483_600_000;
const TOKENS = [
  {pubkey: associatedTokenAddress(ACCOUNT, USDC_MINT), mint: USDC_MINT, amount: '1250000000', decimals: 6},
  {pubkey: associatedTokenAddress(ACCOUNT, USDT_MINT), mint: USDT_MINT, amount: '480500000', decimals: 6},
];
/** The send's recipient and the site's payee: public keys of fixed 32-byte seeds (popupHarness's `account`), nobody's. */
const FRIEND = account(0, 'Friend', 0x33).publicKey;
const SHOP = account(0, 'Shop', 0x2a).publicKey;
const PHRASE = 'Violet otter 19';
const SITE = 'https://dapp.test';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const u64le = (n: bigint): number[] => {
  const b = new Uint8Array(8);
  new DataView(b.buffer).setBigUint64(0, n, true);
  return Array.from(b);
};
/** The site's request: one System transfer of 0.25 SOL from the wallet's account to SHOP. */
const PAYMENT: RawIx = {
  programId: SYSTEM_PROGRAM,
  keys: [
    {pubkey: ACCOUNT, isSigner: true, isWritable: true},
    {pubkey: SHOP, isSigner: false, isWritable: true},
  ],
  data: [2, 0, 0, 0, ...u64le(250_000_000n)],
};
/** Text no store screenshot may show: anything presale, and the failure lines a broken state draws. */
const REFUSED_TEXT = [/presale/i, /couldn.t|could not/i, /offline/i, /not answering/i, /went wrong/i];

/** What the TGE-date gate and REFUSED_TEXT find in the page's rendered text — the one reading both the states and the control use. */
async function textProblems(page: Page, name: string): Promise<string[]> {
  const text = await page.evaluate(() => document.body.innerText);
  return [...dateViolations([{path: name, text}]), ...REFUSED_TEXT.filter(r => r.test(text)).map(r => `${name}: shows ${String(r)}`)];
}
/** A state's checks before it is captured: some text, none of it refused. */
async function cleanText(page: Page, name: string): Promise<void> {
  expect((await page.evaluate(() => document.body.innerText)).trim().length, `${name}: the state has text`).toBeGreaterThan(0);
  expect(await textProblems(page, name)).toEqual([]);
}
/** Writes one screenshot and reads it back: exactly STORE_SHOT, no transparency. */
function save(name: (typeof NAMES)[number], png: Buffer): void {
  writeFileSync(`${OUT}${name}.png`, png);
  const back = readFileSync(`${OUT}${name}.png`);
  expect(storeShotProblems(back), `${name}.png`).toEqual([]);
  expect(pngHeader(back)).toMatchObject(STORE_SHOT);
}
/** The state's own frame, captured at its real size (the viewport — never the full page). */
async function capture(page: Page, size: {width: number; height: number}): Promise<Buffer> {
  expect(page.viewportSize()).toEqual(size);
  await page.mouse.move(0, 0);
  return page.screenshot({fullPage: false});
}
/**
 * `shot` on the backdrop: an <img> at its natural size, unscaled (device pixel ratio 1, its CSS box its pixel size),
 * centred on the 1280 × 800 page; the composed frame's pixels are the capture's own (the clip of the composed page
 * encodes to the capture's bytes); the page's ground is the design system's (--bg-base under the accent wash).
 */
async function compose(h: Harness, name: (typeof NAMES)[number], shot: Buffer, size: {width: number; height: number}): Promise<void> {
  const page = await h.ctx.newPage();
  try {
    await page.setViewportSize({width: STORE_SHOT.width, height: STORE_SHOT.height});
    await page.goto(BACKDROP);
    const box = await page.evaluate(async src => {
      const img = document.getElementById('shot') as HTMLImageElement;
      img.src = src;
      await img.decode();
      const r = img.getBoundingClientRect();
      const cs = getComputedStyle(document.body);
      const root = getComputedStyle(document.documentElement);
      return {
        dpr: devicePixelRatio,
        natural: [img.naturalWidth, img.naturalHeight],
        rect: [r.left, r.top, r.width, r.height],
        ground: cs.backgroundColor,
        wash: cs.backgroundImage,
        bgBase: root.getPropertyValue('--bg-base').trim(),
        edge: getComputedStyle(img).outlineColor,
        surface3: root.getPropertyValue('--bg-surface-3').trim(),
      };
    }, `data:image/png;base64,${shot.toString('base64')}`);
    expect(box.dpr).toBe(1);
    expect(box.natural, `${name}: the capture's size`).toEqual([size.width, size.height]);
    const left = (STORE_SHOT.width - size.width) / 2;
    const top = (STORE_SHOT.height - size.height) / 2;
    expect(box.rect, `${name}: unscaled and centred`).toEqual([left, top, size.width, size.height]);
    expect(box.bgBase.toLowerCase()).toBe('#0a0a0a');
    expect(box.ground, `${name}: the ground is --bg-base`).toBe('rgb(10, 10, 10)');
    expect(box.wash, `${name}: the design system's accent wash`).toMatch(/^radial-gradient\(/);
    expect(box.surface3.toLowerCase()).toBe('#212126');
    expect(box.edge, `${name}: the frame line is --bg-surface-3`).toBe('rgb(33, 33, 38)');
    expect(await textProblems(page, `${name} (backdrop)`)).toEqual([]);
    const inner = await page.screenshot({clip: {x: left, y: top, width: size.width, height: size.height}});
    expect(inner.equals(shot), `${name}: the composed frame is the capture, pixel for pixel`).toBe(true);
    save(name, await page.screenshot({fullPage: false}));
  } finally {
    await page.close();
  }
}

test('the five store screenshots, 1280 × 800, from the store build', async () => {
  expect(existsSync(`${EXT_NOPRESALE}/manifest.json`), 'the store build: run `npm run build` first').toBe(true);
  expect(JSON.parse(readFileSync(fileURLToPath(new URL('../dist-nopresale/app.features.json', import.meta.url)), 'utf8'))).toEqual({presale: false});
  mkdirSync(OUT, {recursive: true});
  for (const n of NAMES) rmSync(`${OUT}${n}.png`, {force: true});

  const h = await launchPopup('noctura-screenshots-', {hosts: DAPP_HOSTS, ext: EXT_NOPRESALE});
  const server = await serveDapp(h.ctx);
  try {
    // The control: the same reading finds every written form of the date, and each refused line, when a page shows it.
    const control = await h.ctx.newPage();
    for (const form of forbiddenForms()) {
      await control.setContent(`<p>Launch on ${form}</p>`);
      expect((await textProblems(control, 'control')).length, 'a planted date form is caught').toBeGreaterThan(0);
    }
    for (const line of ['Presale', 'Couldn’t simulate', "You're offline", 'The server is not answering', 'Something went wrong']) {
      await control.setContent(`<p>${line}</p>`);
      expect((await textProblems(control, 'control')).length, `"${line}" is caught`).toBe(1);
    }
    await control.setContent('<p>12.4836 SOL</p>');
    expect(await textProblems(control, 'control')).toEqual([]);
    await control.close();

    h.fake.lamports.set(ACCOUNT, LAMPORTS);
    h.fake.tokenAccounts.set(ACCOUNT, TOKENS);
    h.fake.accountKinds.set(FRIEND, 'wallet');
    const at = Date.now();
    const grant = {origin: SITE, account: ACCOUNT, scope: 'persistent', connectedAt: at - 86_400_000, lastUsedAt: at, recent: []};
    await h.sw.evaluate(o => chrome.storage.local.set(o), {
      v1_vault: await makeEnvelope({accounts: 2}),
      v1_phishing_phrase: PHRASE,
      v1_known_recipients: [
        {address: FRIEND, at},
        {address: SHOP, at},
      ],
      v1_dapp_grants: [grant],
      v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: false},
      // The recovery phrase verified (as #4's check would record it): #35 lists only the passkey as outstanding.
      v1_settings: {phraseVerifiedAt: at - 86_400_000},
    });
    const vault = await h.ctx.newPage();
    await unlockWith(vault, h.id, E2E_PASSWORD);
    await vault.close();

    // 1 — the popup's home as it opens, loaded (not #42's "Connected · syncing"): the total of SOL, USDC and USDT in the
    // frame, the token list starting under the actions (USDC and USDT are below the popup's fold; #4 shows them).
    const p = await h.openPopup();
    await expect(p.getByText('12.4836 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Connected · syncing')).toHaveCount(0);
    await expect(p.getByText('$3,603', {exact: true})).toBeInViewport({ratio: 1});
    await expect(p.getByText('Solana', {exact: true})).toBeInViewport({ratio: 1});
    await cleanText(p, NAMES[0]);
    await compose(h, NAMES[0], await capture(p, POPUP), POPUP);

    // 2 — the send review (#19): 1.25 SOL to a known wallet, simulated.
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await p.getByLabel('Recipient', {exact: true}).fill(FRIEND);
    await p.getByLabel('Amount').fill('1.25');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Recipient is a regular wallet')).toBeVisible();
    await expect(p.getByRole('button', {name: 'Continue to confirm'})).toBeEnabled();
    await p.locator('main.app-content').evaluate(e => e.scrollTo(0, 0));
    await cleanText(p, NAMES[1]);
    await compose(h, NAMES[1], await capture(p, POPUP), POPUP);
    await p.getByRole('button', {name: 'Cancel'}).click();
    await expect(p.getByLabel('Recipient', {exact: true})).toBeVisible();
    await p.close();

    // 3 — a site's transaction (#48) in the approval window: the anti-phishing line, the simulation, Approve armed.
    const site = await openDapp(h.ctx, SITE);
    await expect.poll(() => connect(site, true)).toEqual({ok: true, value: [ACCOUNT]});
    let request!: Promise<unknown>;
    const win = await approvalWindow(h.ctx, () => (request = customSignTx(site, BLOCKHASH, ACCOUNT, [PAYMENT])));
    await win.setViewportSize(WINDOW);
    await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 30_000});
    await expect(win.locator('.app-phrase-line')).toHaveText(`Anti-phishing phrase: ${PHRASE}`);
    await expect(win.getByRole('button', {name: 'Approve', exact: true})).toBeEnabled();
    await cleanText(win, NAMES[2]);
    await compose(h, NAMES[2], await capture(win, WINDOW), WINDOW);
    await win.getByRole('button', {name: 'Reject'}).click();
    expect(((await request) as {ok: boolean}).ok).toBe(false);
    await windowClosed(win);
    await site.close();

    // 4 — the wallet tab (wallet.html) at 1280 × 800: its home.
    const tab = await h.ctx.newPage();
    await tab.setViewportSize({width: STORE_SHOT.width, height: STORE_SHOT.height});
    await tab.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    await expect(tab.getByText('12.4836 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await expect(tab.getByText('Connected · syncing')).toHaveCount(0);
    for (const t of ['Solana', 'USD Coin', 'Tether', '$1,250.00', '$480.50']) await expect(tab.getByText(t, {exact: true})).toBeInViewport({ratio: 1});
    await cleanText(tab, NAMES[3]);
    save(NAMES[3], await capture(tab, {width: STORE_SHOT.width, height: STORE_SHOT.height}));
    await tab.close();

    // 5 — Settings › Security center (#35): the anti-phishing phrase On.
    const s = await h.openPopup();
    await expect(s.getByText('12.4836 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await s.getByRole('button', {name: 'Settings'}).click();
    await s.locator('.s7-title', {hasText: 'Security center'}).click();
    await expect(s.getByText('1 outstanding task.')).toBeVisible();
    const row = s.locator('.s7-row', {hasText: 'Anti-phishing phrase'});
    await expect(row.locator('.s7-meta')).toHaveText('On');
    // Scrolled so the Locks group starts directly under the pinned top bar (--space-3 below it): Auto-lock … the phrase's
    // row … Change password in the frame, the danger zone below it.
    const locks = s.locator('p.app-overline', {hasText: 'Locks'});
    await s.locator('main.app-content').evaluate((main, el) => {
      const bar = main.querySelector('.top-bar');
      if (el === null || bar === null) throw new Error('no Locks overline or top bar');
      const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-3'));
      main.scrollTop += el.getBoundingClientRect().top - bar.getBoundingClientRect().bottom - gap;
    }, await locks.elementHandle());
    await expect(locks).toBeInViewport({ratio: 1});
    await expect(row).toBeInViewport({ratio: 1});
    const barBottom = await s.locator('main.app-content .top-bar').evaluate(e => e.getBoundingClientRect().bottom);
    expect((await locks.boundingBox())?.y ?? 0, 'the Locks overline clear of the top bar').toBeGreaterThanOrEqual(barBottom);
    await cleanText(s, NAMES[4]);
    await compose(h, NAMES[4], await capture(s, POPUP), POPUP);
    await s.close();

    for (const n of NAMES) expect(storeShotProblems(readFileSync(`${OUT}${n}.png`)), `${n}.png at the end`).toEqual([]);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});
```

Create `extension/playwright.screenshots.config.ts`:

```ts
import {defineConfig} from '@playwright/test';
import base, {STORE_SCREENSHOTS} from './playwright.config';

// B1e §6.4 (Minor 9): `npm run screenshots` — the five store screenshots (e2e/storeScreenshots.spec.ts) from the store
// build (dist-nopresale/chrome, built first by `npm run build`) into release/screenshots/out/ (git-ignored). The base
// config ignores that spec, so `npm run e2e` and CI never run it: it makes release material, not a regression check —
// the same screens are E2E-tested by the visual specs. The base is imported for its service-worker routing switch and
// its trace setting; only the spec it ignores is run here.
export default defineConfig({...base, testIgnore: [], testMatch: STORE_SCREENSHOTS, timeout: 600_000});
```

Modify `extension/playwright.config.ts`:

```diff
diff --git a/extension/playwright.config.ts b/extension/playwright.config.ts
index 7d4c1cd..a866401 100644
--- a/extension/playwright.config.ts
+++ b/extension/playwright.config.ts
@@ -8,4 +8,7 @@ import {defineConfig} from '@playwright/test';
 process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1';
 
 // A one-off failure keeps its trace (test-results/), so it can be diagnosed after the fact.
-export default defineConfig({testDir: 'e2e', timeout: 120_000, workers: 1, use: {trace: 'retain-on-failure'}});
+// B1e §6.4: e2e/storeScreenshots.spec.ts makes the store screenshots — release material, not a regression check — and
+// runs only through `npm run screenshots` (playwright.screenshots.config.ts), never in `npm run e2e` or CI.
+export const STORE_SCREENSHOTS = 'storeScreenshots.spec.ts';
+export default defineConfig({testDir: 'e2e', testIgnore: STORE_SCREENSHOTS, timeout: 120_000, workers: 1, use: {trace: 'retain-on-failure'}});
```

Modify `extension/package.json`:

```diff
diff --git a/extension/package.json b/extension/package.json
index dc7fb50..a238ee0 100644
--- a/extension/package.json
+++ b/extension/package.json
@@ -10,6 +10,7 @@
     "build": "tsc --noEmit && node scripts/build.mjs && node scripts/build.mjs --no-presale",
     "test": "vitest run && vitest run --config vitest.nopresale.config.ts",
     "e2e": "playwright test",
+    "screenshots": "playwright test --config playwright.screenshots.config.ts",
     "csp": "node scripts/check-csp.mjs dist/app && node scripts/check-csp.mjs dist-nopresale/app",
     "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && test -d dist-nopresale/app && test -d dist-nopresale/chrome && test -d dist-nopresale/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox dist-nopresale/app dist-nopresale/chrome dist-nopresale/firefox",
     "gates": "npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build && node scripts/check-no-presale.mjs dist-nopresale dist",
```

Modify `extension/.gitignore`:

```diff
diff --git a/extension/.gitignore b/extension/.gitignore
index e6ea34e..0f93436 100644
--- a/extension/.gitignore
+++ b/extension/.gitignore
@@ -3,3 +3,4 @@ dist/
 dist-nopresale/
 test-results/
 playwright-report/
+release/screenshots/out/
```

Run: `npx tsc --noEmit; echo $?` → `0` (`e2e/` is in `tsconfig.json`'s `include`; the two `.d.mts` type the spec's `.mjs` imports).
Run: `npx playwright test --list | tail -1` → `Total: 121 tests in 32 files` and `npx playwright test --list | grep -c storeScreenshots` → `0` (the base's 121 / 32: the default run does not see the spec). `npx playwright test --config playwright.screenshots.config.ts --list` → `storeScreenshots.spec.ts:135:1 › the five store screenshots, 1280 × 800, from the store build` · `Total: 1 test in 1 file`. Negative control (a `git archive` copy with `testIgnore: STORE_SCREENSHOTS, ` removed from `playwright.config.ts`): `Total: 122 tests in 33 files`, `grep -c storeScreenshots` → `1`.

- [ ] **Step 6: Run the screenshots — normally and contained.**

Run: `npm run build` (exit 0), then `npm run screenshots`
Expected: `✓  1 e2e/storeScreenshots.spec.ts:135:1 › the five store screenshots, 1280 × 800, from the store build` · `1 passed` (observed 16.9 s – 48.9 s across three runs on the dry-run machine; the first run of a fresh profile is the slowest — Argon2id at production parameters unlocks the real envelope).
Run: `unshare -rn sh -c 'ip link set lo up && npm run screenshots'`
Expected: `1 passed` (observed 19.3 s).
Run: `file release/screenshots/out/*.png`
Expected, five lines: `…/1-home.png: PNG image data, 1280 x 800, 8-bit/color RGB, non-interlaced` (and the same for `2-send-review`, `3-site-request`, `4-wallet-tab`, `5-security`). `git status --short --ignored extension` lists `!! release/screenshots/out/` (ignored; nothing to commit there).

- [ ] **Step 7: Look at the five images** (Read each PNG; the owner sees the same files in the visual pass). What the dry run's images show:

1. **`1-home.png`** — the popup (412 × 600, a 1 px `--bg-surface-3` frame) centred at x 434, y 100 on the dark ground with the accent's faint radial wash at the top. "Account 1", TOTAL BALANCE **$3,603.04**, "12.4836 SOL • 0.00 NOC", Send / Receive, TOKENS: **Solana** 12.4836 SOL $1,872.54, then **Noctura** $0.00 (its second line cut by the tab bar), the tab bar (Home active, Activity, Settings). **USDC and USDT are below the popup's fold** — they are in the total and on `4-wallet-tab.png` (Notes R6).
2. **`2-send-review.png`** — #19 "Review transfer", "3 of 4": SIMULATION PASSED, **1.2500 SOL →** and the recipient in groups of four (`2btL JAAb 1S3x …`), the green "Ready · 83 ms" chip (the milliseconds vary run to run), WHAT THIS TRANSACTION DOES: "No interactions with unknown contracts — SystemProgram · transfer only — PASS", "No token approvals granted — Native SOL transfer · zero allowances cha" (**the sub-line is cut at the PASS column** — #19's own layout at 412 px, not this task's; Notes R8), the sticky bar: **Continue to confirm** (accent, enabled), Cancel.
3. **`3-site-request.png`** — the approval window (412 × 720) centred at x 434, y 40: ✕ "APPROVE TRANSACTION"; the anti-phishing line (shield icon) **"Violet otter 19"**; the site card "dapp / dapp.test" with the amber **Unknown** pill (Notes R7); "The site sends this transaction itself after you approve."; BALANCE CHANGES (POST-SIMULATION): SOL **−0.250005** ($37.50); INSTRUCTIONS: `1111…1111 · system_program`, transfer, from `HAgk 14Jp …` "Your account: Account 1", to `2iXt A8oe …`, lamports 0.25 SOL, the next row (compute units) under the sticky bar; **Reject** / **Approve** (enabled).
4. **`4-wallet-tab.png`** — `wallet.html` at 1280 × 800: the same home as a centred column (no frame — a real tab), the total $3,603.04, Send / Receive, all four token rows: Solana $1,872.54; Noctura 0.00 NOC $0.00 **"at stage price"** (Notes R5); USD Coin 1,250.00 USDC $1,250.00; Tether 480.50 USDT $480.50; the tab bar at the bottom.
5. **`5-security.png`** — the popup on #35 "Security center", scrolled so LOCKS starts under the pinned top bar: Auto-lock 5 min, Locks when the browser closes, Re-authentication threshold $100, Passkey **Off** (amber), **Anti-phishing phrase On** (green), Change password; DANGER ZONE and the top of "Delete this wallet" at the bottom edge.

No image is blank, none shows an error banner, a skeleton or a spinner; nothing presale except the Noctura row's "at stage price" (R5); no TGE date in any state's text (asserted).

- [ ] **Step 8: Whole suite.**

Run (in `extension/`): `npx tsc --noEmit; echo $?` → `0`. `TZ=UTC npx vitest run` → `Test Files  242 passed (242)` · `Tests  5395 passed | 1 skipped (5396)` (the base's 241 / 5391 + this file's 4). `TZ=UTC npx vitest run --config vitest.nopresale.config.ts` → `Test Files  22 passed (22)` · `Tests  550 passed | 25 skipped (575)` (unchanged: the reader is build-independent and not in `NOPRESALE_TESTS`). `npm run build` → exit 0 (both builds). `npm run gates` → exit 0, every line as on the base (`permissions ok (dist): both manifests match manifest/source.mjs, version 1.0.0, no key`, …, `no TGE date (dist-nopresale present): 730 source and built files checked`, …, `no presale ok (dist-nopresale off, dist on): …`). Repo root: `node scripts/check-no-tge-date.mjs` → `No TGE date in 1386 tracked text files` (the seven new files tracked). The escaped-character check over the task's added lines (Global Constraints' command, `git diff 7fff2cc -- extension core`) → `0`. `npm run reproducible` and `npm run csp` are not run: no build output and no page changes (`backdrop.html` is not part of any build). No repo-root `src/`, `core/` or `web/` change.

- [ ] **Step 9: Named mutations** — each in a fresh `git archive` copy of the commit, `node_modules` linked; the E2E ones with the repository's `dist-nopresale/` copied in (`cp -a`; the build is unchanged by this task); `npx tsc --noEmit; echo $?` → `0` for every mutant (none INVALID).

| name | mutation | red (quoted) |
|---|---|---|
| M-colour | `png.mjs`: the colour-type check `if (h.colourType !== STORE_SHOT.colourType)` → `if (false)` | `png.test.mjs` `× every other size, depth and colour type is named` · `Tests  1 failed \| 3 passed (4)` |
| M-height | `png.mjs`: `if (h.height !== STORE_SHOT.height)` → `if (false)` | `× every other size, depth and colour type is named` · `1 failed \| 3 passed (4)` |
| M-trns | `png.mjs`: `if (h.chunks.includes('tRNS'))` → `if (false)` | `× a tRNS chunk (transparency in a truecolour PNG) is refused` · `1 failed \| 3 passed (4)` |
| M-crc | `png.mjs`: the CRC comparison `… !== crc` → `… !== crc && false` | `× what is not a whole, well-formed PNG is refused, naming why` · `1 failed \| 3 passed (4)` |
| M-iend | `png.mjs`: the IEND-last check → `if (false)` | `× what is not a whole, well-formed PNG is refused, naming why` · `1 failed \| 3 passed (4)` |
| M-scale | `backdrop.html`: `#shot` gains `transform: scale(0.99);` | `npm run screenshots` `✘ … (10.1s)` · `Error: 1-home: unscaled and centred` |
| M-pixels | `backdrop.html`: `#shot` gains `filter: brightness(1.05);` (geometry unchanged) | `Error: 1-home: the composed frame is the capture, pixel for pixel` · `Expected: true` `Received: false` |
| M-wash | `backdrop.html`: `body` gains `background: var(--bg-base);` (the ground without the design's wash) | `Error: 1-home: the design system's accent wash` · `Expected pattern: /^radial-gradient\(/` `Received string:  "none"` |
| M-ground | `backdrop.html`: the design-system `<link>` removed | `Error: 1-home: unscaled and centred` (the browser's default 8 px body margin moves the frame before the ground is read) |
| M-control | spec: `dateViolations([{path: name, text}])` → `dateViolations([{path: name, text}], [])` (the forms dropped) | `✘ … (3.2s)` · `Error: a planted date form is caught` · `Expected: > 0` `Received:   0` |
| M-jpeg | spec: the composed page saved with `type: 'jpeg'` | `Error: 1-home.png` (`storeShotProblems` → `['not a PNG: no PNG signature']`) |
| M-ignore | `playwright.config.ts`: `testIgnore: STORE_SCREENSHOTS, ` removed | `npx playwright test --list` → `Total: 122 tests in 33 files`, the spec listed (the control of Step 5) |

- [ ] **Step 10: Commit.**

```bash
git add extension/.gitignore extension/package.json extension/playwright.config.ts extension/playwright.screenshots.config.ts extension/release/screenshots/backdrop.html extension/e2e/storeScreenshots.spec.ts extension/scripts/png.mjs extension/scripts/png.d.mts extension/scripts/check-no-tge-date.d.mts extension/scripts/__tests__/png.test.mjs
git commit -m "feat(extension): B1e-2 Task 5 — the five store screenshots (1280 × 800, 24-bit PNG) from the store build on the design backdrop

Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```

(Dry run: `a7e2387`, `dry(b1e2): Task 5 — the five store screenshots (1280 × 800, 24-bit PNG) from the store build on the design backdrop`, 10 files, 446 insertions, 1 deletion.)

**Notes for the executor**

Rulings (each: what, why, what it costs if wrong):
- **R1 — the spec lives in `e2e/`, not in `release/screenshots/`.** The dry run first put it beside the backdrop; `npm run gates` then failed in `check-vault-isolation.mjs`: `release/screenshots/screenshots.spec.ts: touches storage outside src/ext.ts and the background` and five lines `names v1_settings | v1_known_recipients | v1_dapp_grants | v1_dapp_limits | v1_phishing_phrase, which only the background may write` (and, the gate list being `&&`-chained, the six gates after it did not run). The gate skips `e2e/` at the package root because it is never bundled — exactly what this spec is; seeding background-owned keys is what every wallet-seeding E2E does. Widening the gate's skip list to `release/` was rejected: it is a security gate, and Tasks 3–4 put `.mjs` there. Cost if wrong: none to the build; the spec sits apart from its backdrop (each names the other in its header).
- **R2 — its own config; not in `npm run e2e`, `verify` or CI.** `playwright.config.ts` `testIgnore`s it and `playwright.screenshots.config.ts` runs only it (`testMatch`, `testIgnore: []`, 600 s). Why: it produces release material into `release/screenshots/out/`, not a regression check — the same screens are already E2E-tested and shot by `visual*.spec.ts` (#11, #19, #48, #35) in CI; adding it would add ≈ 20–50 s and a second Argon2id unlock per CI run for no new coverage. What still runs in CI: the reader's unit test (`png.test.mjs`, in `npm test`). Cost if wrong: a UI change that breaks the spec is found at release time, when Task 7's checklist runs it — before upload, not after.
- **R3 — output `release/screenshots/out/`, git-ignored** (`extension/.gitignore`: `release/screenshots/out/`). No PNG is committed. The spec deletes only its five exact names before writing.
- **R4 — "24-bit" is what Chromium already writes; nothing converts.** Measured: `page.screenshot()` (Playwright's Chromium) writes IHDR bit depth 8, colour type 2 (RGB, no alpha) — `1280 800 depth 8 type 2` on a probe, and `file` on all five outputs says `8-bit/color RGB`. So the spec checks it (`storeShotProblems` on each file read back, and again at the end) rather than converting; a future Chromium that writes RGBA fails the run naming `colour type 6 (truecolour with alpha), not 2 (truecolour: 24-bit)`. The check is not vacuous when `out/` is absent: the reader is unit-tested in `npm test` on PNGs written by the test's own encoder (its own chunk writer, `zlib.deflateSync` and `zlib.crc32`, never `png.mjs`'s code), with a positive control and fifteen refusals.
- **R5 — the five states (the controller's list; one deviation).** (1) the popup home; (2) **#19** (Simulation passed) for 1.25 SOL — the review screen; (3) **#48**, a site's sign-transaction request with its simulation and the anti-phishing line — the brief says "#47", but in this codebase #47 is the connect request and #48 the transaction (`visual-b1e.spec.ts`: `b1e-47-phrase` is the connect window, `b1e-48-phrase` the transaction); the state built is the one the brief describes; (4) `wallet.html#/home` at 1280 × 800; (5) **#35, not #38**: #35 shows the extension's security model at a glance (auto-lock, locks on browser close, the re-authentication threshold, passkey, **the anti-phishing phrase On** — the feature this release adds), where #38 is a version line and four links; scrolled so the Locks group starts under the pinned top bar (asserted: the overline clear of the bar, the phrase row wholly in the frame). The site's request is a System transfer of 0.25 SOL built with the suite's `customSignTx`, not the suite's `signTx` (that one moves 1 lamport: "−0.000000001 SOL" reads as a test).
- **R6 — the wallet, believable and nobody's.** The suite's test mnemonic (`E2E_MNEMONIC`, "abandon … about" — a public BIP-39 test vector) through `makeEnvelope({accounts: 2})` and a real unlock; on the fake chain 12.4836 SOL, 1 250.00 USDC and 480.50 USDT (token accounts at their associated addresses), prices the fake's ($150 SOL, $1 stablecoins) → $3,603.04. The send's recipient and the site's payee are the public keys of fixed 32-byte seeds (`account(0, …, 0x33)`, `account(0, …, 0x2a)` — `2btLJAAb1S3x6hZYdVyAePjqtQYi2ZBSRGy4569RZu8h` and `2iXtA8oeZqUU5pofxK971TCEvFGfems2AcDRaZHKD2pQ`), both known recipients (no first-send banner, no re-authentication); the recovery phrase marked verified (`v1_settings.phraseVerifiedAt`, so #35 lists one task, the passkey — not three amber tasks); the anti-phishing phrase "Violet otter 19" (controller's copy, for the owner). **Loud:** on the popup's home USDC and USDT are below the fold — the popup opens on the balance card and the first two token rows (Solana, Noctura); the dry run kept the opening view (it is what a user sees) and shows all four rows on `4-wallet-tab.png`. If the owner wants all three funded rows in the popup shot, the content can be scrolled to the token list instead (the balance card then leaves the frame).
- **R7 — the site is `dapp.test`, shown "Unknown".** The suite's verified site is `tensor.trade` (a real company); a store screenshot of our wallet approving a real company's site would read as an endorsement, so the test site is used and the window honestly marks it Unknown (amber). The owner may prefer otherwise; flagged.
- **R8 — what the screenshots show that is not this task's to change, flagged to the owner:** (a) the Noctura token row on home reads **"at stage price"** in the store build (`Home.tsx:438`, `row.basis === 'stage'`; NOC is priced from the public presale statistics, P7) — "stage" is presale vocabulary on a `--no-presale` screenshot; the spec's text filter (`/presale/i`) does not catch it; changing the row is a code change outside this plan; (b) #19's second check sub-line is cut at the PASS column ("Native SOL transfer · zero allowances cha") — #19's layout at 412 px, also in `visual-send.spec.ts`' shots; (c) "Ready · 83 ms" on #19 is a measured time and differs per run.
- **R9 — the text checks.** `textProblems` reads `document.body.innerText` once and applies `dateViolations([{path, text}])` with the gate's own `forbiddenForms()` and a short refusal list `REFUSED_TEXT = [/presale/i, /couldn.t|could not/i, /offline/i, /not answering/i, /went wrong/i]` (nothing presale; no failure line: #19's "Couldn't simulate", R9's "could not be read", #42's offline and D26's lines). The positive control runs first on a plain page through the same function: each of the 18 forms planted alone is caught (≥ 1 — the forms overlap, e.g. the seconds timestamp is a prefix of the milliseconds one, so one plant can match two: the dry run's first `toBe(1)` failed with `Received: 2`), each refusal line planted is caught, and `12.4836 SOL` is not. The backdrop page's own text is checked too (empty). The date is never written: the control plants `forbiddenForms()`' own strings at run time.
- **R10 — 1 : 1 is asserted three ways:** device pixel ratio 1; the `<img>`'s natural size equals the frame's real size and its box is exactly `[434, 100, 412, 600]` (popup) or `[434, 40, 412, 720]` (window); and a clip of the composed page at that box **encodes to the capture's own bytes** (`inner.equals(shot)`) — the frame is the capture, pixel for pixel (M-pixels). The ground: `--bg-base` (`#0a0a0a` → `rgb(10, 10, 10)`) under a `radial-gradient(` wash, the frame line `--bg-surface-3` (`rgb(33, 33, 38)`), all read from the page.
- **R11 — the backdrop takes the design system as every extension page does:** `src/app/mount.tsx`, `src/approve/main.tsx` and `src/unlock/main.ts` import `web/src/styles/design-system.css` first; the backdrop links the same file by its relative path (`../../../web/src/styles/design-system.css`, loaded from `file://`). Its own `<style>` sets only size and layout (1280 × 800, a grid that centres) and the frame's 1 px outline in an existing token; no colour value, font or drawn text (its `<title>` is not drawn). The design-system's `@font-face` URLs (`/fonts/…`) do not resolve from `file://`; the backdrop draws no text, so nothing depends on them.
- **Copy (D27):** no user-facing string is added. The anti-phishing phrase in the shots ("Violet otter 19") and the amounts are the controller's choice of sample data, listed for the owner.
- **Hand-over:** Task 7's checklist step 3 — "`cd extension && npm run build && npm run screenshots`; upload `release/screenshots/out/1-home.png` … `5-security.png`". The store build must be the one being uploaded (the spec reads `dist-nopresale/chrome`, the directory `release:chrome` packs).

**Spec rev 2.7 lines** (for Task 7):
- §6.4 Screenshots: the five states are the popup home, #19 (a SOL send's review), #48 (a site's transaction, with the anti-phishing line), `wallet.html#/home` at 1280 × 800 and #35 (the phrase On); made by `npm run screenshots` (`e2e/storeScreenshots.spec.ts`, its own Playwright config, ignored by `npm run e2e` and CI) into the git-ignored `release/screenshots/out/`.
- §6.4 Screenshots: each PNG is checked as written — 1280 × 800, bit depth 8, colour type 2 (24-bit), no `tRNS` (`scripts/png.mjs`, unit-tested on independently encoded PNGs); Chromium writes RGB already, nothing converts.
- §6.4 Screenshots: the TGE-date check uses the gate's `forbiddenForms()` / `dateViolations()` (the spec's "`forms()`"), with a planted positive control, plus a refusal list (`presale`, failure lines) on the same text.
- §6.4 / §9 backdrop: the ground is design-system.css's own `body` rule (the accent wash over `--bg-base`), linked by relative path; the frame line is `--bg-surface-3`; the composed frame is byte-equal to the capture.


### Task 6: The extension's own copy says nothing its privacy policy contradicts — #1's tagline and first trust chip, #39's footer, #8's banner (E24), the NOC row's "at stage price" (E23), the store summary as the manifest's `description`; ONE claims list (`scripts/claims.mjs`, allowances by exact words and by tier) read by the UI-claims guard (the source in a test, both built packages of both builds in a gate), the store texts' test and the privacy policy's test

**Spec:** B1e §6.1 (P1–P16, L1) and §6.2 (R1–R21) as Task 3 wrote them (`release/privacySentences.mjs`) — the extension's screens must not say the opposite; §6.4 (the listing's short description ≤ 132 characters; "no privacy claim the build does not keep"; the store screenshots carry nothing presale); §9 (the design: #1, #8 and #39 are drawn with the old copy — **this task departs from the design, see below**); §10. Memory "shielded privacy guarantee": the extension is transparent; nothing may call it private. Owner decisions E23 and E24 (2026-11-06, `.superpowers/sdd/b1e-owner-decisions.md`). Fable review 1 of this plan: I3 (one claims list, its blind spots, quoting, tiers, its limit stated), M4 (no pinned file count), M10 (the screenshot check refuses "stage price"), M11 (the welcome test's title). **Not here:** the release script, `rp-id.json` and the checklist (Task 7); the phone app's `src/screens/onboarding/WelcomeScreen.tsx` (repo root — E24's phone half, on the owner's shield-copy branch); the web wallet's `web/src/portfolio/PortfolioPanel.tsx:66` " at stage price" (outside the extension — flagged in Notes).

**DESIGN DEPARTURE (loud).** `index.html` draws #1 with the tagline "A Solana wallet built for private, non-custodial holding." and the chip "E2E encrypted", #39 with the footer "The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.", and #8's banner naming "the Noctura phone app's future private (shielded) keys" (B1b-2a copied all four from the design). All four are claims the store build does not keep (or, for #8, a future feature the owner asked to drop, E24), so this task replaces them; and the NOC row's secondary line "at stage price" (#11 home, #43 token sheet, #40 import success) is presale wording the owner asked to change everywhere it shows (E23). The layout, the elements, their classes and icons are unchanged — only the words. The design file is NOT updated by this task (the owner's); it was not opened as text (it carries the TGE date): the old strings are quoted from `unlock.html`, the components and the B1b-2a spec (`docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md:778`, `:1205`). Recorded as Spec rev 2.7 lines.

**Files:**
- Create: `extension/scripts/claims.mjs` (the one claims list, the tiers, the allowances with their verdicts, `claimViolations`, `unusedAllowances`, `markdownUnits`), `extension/scripts/check-ui-claims.mjs` (the guard's readers and the gate's CLI)
- Modify: `extension/unlock.html` (#1's tagline and first chip, #8's banner, #39's `fg-foot`), `extension/src/app/screens/Home.tsx`, `TokenSheet.tsx`, `Imported.tsx` (the NOC value's wording), `extension/src/app/valuation.ts` (its comment), `extension/manifest/source.mjs` (`description`), `extension/release/listing.md` (the Summary section), `extension/package.json` (`gates:build` runs the new gate last)
- Create (tests): `extension/scripts/__tests__/claims.test.mjs` (9), `extension/scripts/__tests__/check-ui-claims.test.mjs` (8)
- Modify (tests): `extension/scripts/__tests__/storeTexts.test.mjs` and `privacy.test.mjs` (read the shared list; same test counts), `extension/src/unlock/__tests__/welcome.test.ts` (one assertion pair, the title — M11), `restore.test.ts`, `import.test.ts` (one each), `extension/src/app/__tests__/Home.test.tsx`, `TokenSheet.test.tsx`, `Send.test.tsx`, `Imported.test.tsx` (the NOC wording; three titles), `extension/e2e/onboarding.spec.ts` (one), `extension/e2e/visual-vault.spec.ts` (two), `extension/e2e/storeScreenshots.spec.ts` (two refusals and their control)

**Interfaces:**
- Consumes: `render` (`manifest/source.mjs`); `isMain`, `distDir` (`scripts/isMain.mjs`, `scripts/distDir.mjs`); `typescript` (devDependency, already imported by `scripts/check-vault-isolation.mjs`); `forbiddenForms` (`scripts/check-no-tge-date.mjs`, unchanged, still storeTexts' own addition); Task 4's `storeTexts.test.mjs` pin `section(LISTING, '## Summary (short description)') === render('chrome').description` (unchanged — this task changes both sides together); Task 5's `REFUSED_TEXT` / `textProblems` (`e2e/storeScreenshots.spec.ts`).
- Produces (`extension/scripts/claims.mjs`):
  ```js
  export const CLAIMS: readonly {id: string, pattern: RegExp}[];   // 28, flags exactly 'i' (never 'g'), in this order: private, privacy,
      // anonymous, untraceable, unlinkable, confidential, e2e, end-to-end, encrypted in transit, zero-knowledge, shielded, incognito, hidden,
      // never see, can't see, no one can see, we don't see, never receive, never leave, nothing leaves, stays on this device,
      // only on this device, local-only, offline-only, offline, no server, no tracking, bank-grade
  export const TIERS: readonly ['source', 'built', 'store', 'policy'];
  export const ALLOWED: readonly {text: string, tiers: readonly Tier[], verdict: string}[];  // 26 — per tier: source 7, built 17, store 6, policy 6
  export function claimViolations(units: {where, text}[], o: {tier: Tier, claims?, allowed?, used?: Set<string>}): string[];
      // 'where: "id" in “unit”'; whitespace collapsed; only allowances listing `tier` apply, each removes its own words only;
      // an unknown or missing tier throws 'claimViolations: tier must be one of source, built, store, policy (got …)'
  export function unusedAllowances(used: Set<string>, tier: Tier, allowed?): string[];   // 'allowance not used by any <tier> text: “…”'
  export function markdownUnits(md: string, where: string): {where, text}[];            // one unit per blank-line paragraph
  ```
- Produces (`extension/scripts/check-ui-claims.mjs`):
  ```js
  export function htmlUnits(html: string, where: string): {where, text}[];   // text between tags + visible attributes in any quoting
  export function scriptUnits(code: string, where: string, kind?: ts.ScriptKind): {where, text}[];
  export function sourceUnits(root: string): {files: string[], units: {where, text}[]};   // *.html at root + src/**/*.ts(x), no tests, no .d.ts
  export function builtUnits(dir: string, label?: string): {files: string[], units: {where, text}[]};  // *.html + *.js, licenses.html skipped
  ```
  CLI (`node scripts/check-ui-claims.mjs`, `NOCTURA_DIST` = `dist` | `dist-nopresale`): reads `chrome/` and `firefox/` on the `built` tier; exit 1 on a claim, a missing package (`INCONCLUSIVE: …`), or (when no claim) a built allowance no file used; else `ui claims ok (<dist>): 40 built HTML / JS files of chrome/ and firefox/, no claim the privacy policy contradicts (17 allowances used)`.
- Produces (build output): every `manifest.json` (both builds, both browsers) `description` = `A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.` (108 characters). Reproducible digests change (Step 9).
- **What later tasks rely on:** Task 7 — `npm run verify` / `gates` now runs `check-ui-claims.mjs` per build; the checklist's listing step pastes nothing for the summary (the store reads `description` from the package; `listing.md` shows the same string); the five store screenshots now show the NOC row's "estimate · not in total" (shot 4) and refuse "stage price" / "stage"; the rev 2.7 list takes this task's lines below. A later text check that reads words a user or reviewer sees imports `scripts/claims.mjs` and names its tier (adding a tier is a `TIERS` change plus its allowances).

**The rule, stated once.** A screen of the extension, a store text and the privacy policy may say only what the policy allows: the coordinator receives the public addresses (P3, P4), the transactions (P5, P6) and the IP address (P2), so nothing may say "we never see", "offline-only", "nothing leaves", that something "stays on this device" or "never leaves" it, or that Noctura "never receives" it — except by an exact true sentence; the extension is a transparent wallet, so nothing may call it private, anonymous, untraceable, unlinkable, confidential, end-to-end encrypted, zero-knowledge, shielded or incognito. "Private key(s)", "Privacy Policy", the policy's URL path and the contact address are names. A true sentence holding a refused word passes only by its exact words, each with its written verdict and the tiers it is true on — an allowance for #39's footer admits nothing in the listing, a bundled library's TypeError admits nothing in `src/` — and an allowance no text needs any more fails. **The limit (I3):** this is a word list — a review aid, not a proof. It reads each literal, template piece, JSX text and HTML text unit alone, so a sentence assembled at run time from pieces (`'never ' + verb`, a template's `${…}`, an array joined), text from data (token names, a site's strings, the coordinator's answers) and CSS `content:` are not read as sentences; a claim split across them passes.

**The copy (D27).** Controller's, used exactly: tagline "A non-custodial Solana wallet. Your keys stay on this device."; chip "Encrypted on this device"; #8's banner "This phrase is also the root of the Noctura phone app's keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account." (E24); the NOC row on #11 home "estimate · not in total", on #43 token sheet the suffix " (estimate)" (E23). **Writer's, for the owner:** #40 import success's NOC value carries the same suffix " (estimate)" as #43 (E23 says "everywhere it shows"; #40 was not in the controller's list — see Notes R9). **Changed from the controller's (rev 1, found untrue, Notes R1):** #39's footer "Your recovery phrase and password never leave this device. To read your balances, your accounts' public addresses are sent to the Noctura coordinator." **Writer's (rev 1, accepted):** the summary "A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites."

- [ ] **Step 1: The one claims list.**

Create `extension/scripts/claims.mjs`:

```js
// B1e §6.1, §6.4 (B1e-2 Task 6): the ONE list of claims the extension does not keep, read by every check that reads
// words a user or a reviewer sees — the UI-claims guard (scripts/check-ui-claims.mjs: the source tier in its test, the
// built packages in its gate), the store texts (scripts/__tests__/storeTexts.test.mjs: terms, help, listing,
// data-usage) and the privacy policy (scripts/__tests__/privacy.test.mjs: privacy.md). A check may add words of its own
// (storeTexts adds TGE and the written forms of its date); none may read fewer. It lives in scripts/, not release/,
// because release/'s files are themselves read by gates.
//
// The published policy (release/privacySentences.mjs) is exact: the coordinator receives the public addresses (P3, P4),
// the transactions (P5, P6) and the IP address (P2); and the extension is a transparent wallet (memory "shielded privacy
// guarantee"). So no text may call it private, anonymous, untraceable, unlinkable, confidential, end-to-end encrypted,
// zero-knowledge or shielded, nor say that something stays on this device, never leaves it, is never received or seen
// — except by the exact true sentences below, each with its verdict and the surfaces (tiers) it is true on.
//
// This is a word list: a review aid, not a proof. What it cannot read is a sentence assembled at run time from pieces
// (`'never ' + verb`, a template's `${…}`, an array joined), text from data (token names, a site's strings, the
// coordinator's answers) and CSS `content:` — each piece is read alone, so a claim split across pieces passes.

const DASH = '[\\s\\-\\u2010\\u2011\\u2013\\u2014]';
const PLACE = '(?:this|your|the)\\s+(?:device|browser|computer|machine|phone|extension)';
const re = source => new RegExp(source, 'i');

/** The claims refused, case-insensitive, in this order. "private key(s)", "Privacy Policy", the policy's URL path and the contact address are names. */
export const CLAIMS = Object.freeze(
  [
    {id: 'private', pattern: /\bprivate(?!\s+keys?\b)/i},
    {id: 'privacy', pattern: /(?<!\/)\bprivacy\b(?!\s+policy\b|@|\.md\b)/i},
    {id: 'anonymous', pattern: /anonym/i},
    {id: 'untraceable', pattern: /untraceab/i},
    {id: 'unlinkable', pattern: /unlinkab/i},
    {id: 'confidential', pattern: /\bconfidential(?:ly|ity)?\b/i},
    {id: 'e2e', pattern: /\be2e\b/i},
    {id: 'end-to-end', pattern: re(`end${DASH}to${DASH}end`)},
    {id: 'encrypted in transit', pattern: /\bencrypted\s+in\s+transit\b/i},
    {id: 'zero-knowledge', pattern: re(`zero${DASH}knowledge`)},
    {id: 'shielded', pattern: /shielded/i},
    {id: 'incognito', pattern: /\bincognito\b/i},
    {id: 'hidden', pattern: /\b(?:is|are|stays?|remains?|kept|keeps?\s+\w+)\s+hidden\b|\bhidden\s+from\b|\bhides\s+(?:your|you)\b/i},
    {id: 'never see', pattern: /\bnever\s+sees?\b/i},
    {id: "can't see", pattern: /\b(?:can['’]?t|cannot|can not)\s+see\b/i},
    {id: 'no one can see', pattern: /\bno\s*(?:one|body)\s+(?:else\s+)?(?:knows?|sees?|can\s+(?:see|know|tell|track|trace|link|read))\b/i},
    {
      id: "we don't see",
      pattern:
        /\b(?:we|noctura|the\s+coordinator|our\s+servers?)\s+(?:do\s+not|don['’]?t|does\s+not|doesn['’]?t|cannot|can['’]?t|can\s+not|will\s+not|won['’]?t|never)\s+(?:ever\s+)?(?:see|know|receive|get|store|keep|log|track|collect|record|read|access|share|sell)\b/i,
    },
    {id: 'never receive', pattern: /\bnever\s+(?:receives?|gets?|collects?|stores?|logs?|tracks?|records?|shares?|sells?|knows?)\b/i},
    {id: 'never leave', pattern: /\bnever\s+(?:ever\s+)?(?:leaves?|left)\b/i},
    {id: 'nothing leaves', pattern: /\bnothing\s+(?:ever\s+)?(?:leaves|is\s+(?:ever\s+)?(?:sent|shared|stored|logged|tracked|collected|uploaded))\b/i},
    {id: 'stays on this device', pattern: re(`\\b(?:stay|stays|staying|remain|remains|kept|is\\s+kept|are\\s+kept)\\s+(?:only\\s+)?(?:on|in)\\s+${PLACE}\\b|\\bstays?\\s+local\\b`)},
    {id: 'only on this device', pattern: re(`\\b(?:only|solely|exclusively)\\s+(?:on|in)\\s+${PLACE}\\b`)},
    {id: 'local-only', pattern: re(`\\blocal(?:ly)?${DASH}?only\\b|\\b(?:fully|entirely|completely|purely|100%)\\s+local\\b`)},
    {id: 'offline-only', pattern: re(`\\boffline${DASH}only\\b`)},
    {
      id: 'offline',
      pattern: /\b(?:works?|working|runs?|stays?|kept|fully|completely|entirely|100%)\s+offline\b|\boffline\s+(?:wallet|signing|vault|storage|keys?)\b|\bair[\s-]?gapped\b|\bcold\s+(?:storage|wallet)\b/i,
    },
    {id: 'no server', pattern: /\bno\s+(?:servers?|backend|cloud)\b|\bserver[\s-]?less\b|\bwithout\s+(?:a\s+|any\s+)?servers?\b/i},
    {id: 'no tracking', pattern: /\bno\s+(?:tracking|trackers?|logs?|logging)\b|\bzero[\s-](?:logs?|tracking)\b|\bnot\s+(?:tracked|logged)\b/i},
    {id: 'bank-grade', pattern: /\bsecure\s+as\s+a\s+bank\b|\b(?:bank|military)[\s\-\u2010\u2011]?grade\b/i},
  ].map(c => Object.freeze(c)),
);

/**
 * Where a text is read — each check names its own; an allowance holds only on the tiers it lists:
 * 'source' — the extension's HTML entries and src/ without tests (check-ui-claims.test.mjs);
 * 'built'  — the built packages, chrome/ and firefox/, both builds (the gate): the source's words plus the bundled ../core
 *            and libraries, so an allowance true of a screen lists both 'source' and 'built';
 * 'store'  — terms.md, help.md, listing.md, data-usage.md (storeTexts.test.mjs);
 * 'policy' — privacy.md (privacy.test.mjs).
 */
export const TIERS = Object.freeze(['source', 'built', 'store', 'policy']);

/** The privacy policy's sentence `id`, as written (the allowances that quote the policy are its exact words). */
const P11 = 'Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension.';
const P12 = 'Noctura never receives it.';
const P13 = 'The sites you connected, your address book and your anti-phishing phrase are stored only in this browser.';

/** True sentences that hold a refused word, by their exact words (a substring of a unit, whitespace collapsed), each with its verdict. */
export const ALLOWED = Object.freeze(
  [
    {
      text: 'Move to a private place.',
      tiers: ['source', 'built'],
      verdict: 'true — advice to the user (the pre-reveal modal, unlock.html and SEED.gateBody), not a property of the wallet',
    },
    {
      text: 'keep it private.',
      tiers: ['source', 'built'],
      verdict: "true — advice about the damaged wallet's saved file (#1 damaged states, unlock.html dmg-save-note and the remove-damaged page)",
    },
    {
      text: 'Accounts after the first one exist only in this extension until the phone app supports more than one account.',
      tiers: ['source', 'built'],
      verdict: "true — #8's banner (E24): the phone app derives one account from the phrase, so the second and later live only here",
    },
    {
      text: '${} · cannot see your seed or private key',
      tiers: ['source', 'built'],
      verdict: "true — #47 dapp-connect, a site not verified: connecting gives it the public address only (src/approve/strings.ts seeAddressSecUnknown)",
    },
    {
      text: 'A non-custodial Solana wallet. Your keys stay on this device.',
      tiers: ['source', 'built'],
      verdict: "true — #1's tagline: the keys are created and kept in this browser's vault (P11); the addresses are not keys",
    },
    {
      text: 'your keys stay on this device.',
      tiers: ['source', 'built'],
      verdict: "true — #38 About's line, the same fact as #1's tagline (P11)",
    },
    {
      text: 'Your recovery phrase and password never leave this device.',
      tiers: ['source', 'built'],
      verdict: "true — #39's footer, the first sentence: P11's own words for the phrase and the password; the next sentence says what is sent",
    },
    {
      text: 'Access to shielded features is unavailable in your jurisdiction.',
      tiers: ['built'],
      verdict: "never shown — core/geo/classify.ts's message; the extension's gate (src/background/geo/gate.ts) passes on a reason, never this text",
    },
    {text: 'VPN or proxy detected. Shielded features may be limited.', tiers: ['built'], verdict: 'never shown — core/geo/classify.ts, as above'},
    {text: 'Shielded features may have limited availability in your region.', tiers: ['built'], verdict: 'never shown — core/geo/classify.ts, as above'},
    {text: 'Private accessor was defined without a getter', tiers: ['built'], verdict: "never shown — tslib's class-field helper in a bundled library (TypeError text)"},
    {text: 'Cannot read private member from an object whose class did not declare it', tiers: ['built'], verdict: "never shown — tslib's helper, as above"},
    {text: 'Private accessor was defined without a setter', tiers: ['built'], verdict: "never shown — tslib's helper, as above"},
    {text: 'Private method is not writable', tiers: ['built'], verdict: "never shown — tslib's helper, as above"},
    {text: 'Cannot write private member to an object whose class did not declare it', tiers: ['built'], verdict: "never shown — tslib's helper, as above"},
    {
      text: 'prison private prize',
      tiers: ['built'],
      verdict: 'never shown as a claim — three neighbouring words of the BIP-39 English wordlist (@scure/bip39), which #5 / #8 check a phrase against',
    },
    {text: '<anonymous>', tiers: ['built'], verdict: "never shown — React's stack-frame name in its development warnings"},
    {text: P11, tiers: ['store', 'policy'], verdict: 'true — P11, the policy\'s sentence (help.md restates it verbatim): the vault isolation gate and the routes'},
    {text: P12, tiers: ['store', 'policy'], verdict: "true — P12: the passkey is the browser's and the provider's; no route carries it (help.md restates P12)"},
    {text: P13, tiers: ['store', 'policy'], verdict: 'true — P13: grants, contacts and the phrase key are in storage.local, no storage.sync (help.md restates P13)'},
    {
      text: 'the lookup never leaves the server',
      tiers: ['policy'],
      verdict: "true — R12, ICO's answer: the GeoLite2 lookup runs on the coordinator itself",
    },
    {
      text: "It never records the request's parameters, your IP address or your headers.",
      tiers: ['policy'],
      verdict: "true — R4, ICO's answer 1–2 on the coordinator's application log (R1 says what the access log does record)",
    },
    {text: 'Questions about privacy:', tiers: ['policy'], verdict: 'P16, the contact line (owner decision E8) — a topic, not a claim'},
    {
      text: 'and Noctura never receives them, so Noctura cannot give them back to you.',
      tiers: ['store'],
      verdict: "true — help.md's recovery phrase topic: the phrase never leaves the vault page (P11)",
    },
    {
      text: 'Noctura never receives them, never holds your funds',
      tiers: ['store'],
      verdict: 'true — terms.md, non-custodial software: the phrase and keys stay in the vault (P11); no route moves funds',
    },
    {
      text: 'Your keys stay on this device. The recovery phrase and keys are stored in this browser, encrypted with your password; Noctura never receives them.',
      tiers: ['store'],
      verdict: "true — listing.md's description: P11, the vault (Argon2id-derived key)",
    },
  ].map(a => Object.freeze({...a, tiers: Object.freeze(a.tiers)})),
);

const collapse = s => s.replace(/\s+/g, ' ').trim();

function tierOf(tier) {
  if (!TIERS.includes(tier)) throw new Error(`claimViolations: tier must be one of ${TIERS.join(', ')} (got ${String(tier)})`);
  return tier;
}

/**
 * Every refused claim in `units` ({where, text}) read on `tier`, as 'where: "id" in “unit”'. Only the allowances that
 * list `tier` apply; each removes exactly its own words before the claims are matched; `used` (a Set) collects the
 * texts of those that were found.
 */
export function claimViolations(units, {tier, claims = CLAIMS, allowed = ALLOWED, used = new Set()} = {}) {
  const t = tierOf(tier);
  const mine = allowed.filter(a => a.tiers.includes(t));
  const out = [];
  for (const {where, text} of units) {
    let rest = collapse(text);
    for (const a of mine) {
      if (rest.includes(a.text)) {
        used.add(a.text);
        rest = rest.split(a.text).join(' ');
      }
    }
    for (const c of claims) if (c.pattern.test(rest)) out.push(`${where}: "${c.id}" in “${collapse(text)}”`);
  }
  return out;
}

/** The allowances listing `tier` that no unit read on it needed (stale: fail — a stale entry would let its words back in). */
export function unusedAllowances(used, tier, allowed = ALLOWED) {
  const t = tierOf(tier);
  return allowed.filter(a => a.tiers.includes(t) && !used.has(a.text)).map(a => `allowance not used by any ${t} text: “${a.text}”`);
}

/** A markdown text as units: one per paragraph (blank-line separated), so a refusal quotes the paragraph, not the file. */
export function markdownUnits(md, where) {
  return md
    .split(/\n\s*\n/)
    .map(collapse)
    .filter(t => t !== '')
    .map(text => ({where, text}));
}
```

- [ ] **Step 2: The guard's readers and the gate's CLI.**

Create `extension/scripts/check-ui-claims.mjs`:

```js
#!/usr/bin/env node
// B1e §6.1, §6.4 (B1e-2 Task 6): the extension's own screens say nothing its privacy policy contradicts. The claims and
// the true sentences allowed (each with its verdict and the tiers it holds on) are scripts/claims.mjs — the one list the
// store texts' and the privacy policy's tests read too; this file is the guard's readers and the gate's CLI.
//
// What is read is what a user can see: in the HTML entries, the text between tags and the visible attributes (in any
// quoting: double, single or none; comments, <script>, <style>, <template> dropped with their content); in src/**/*.ts(x)
// (tests excluded), the string literals, template literals and JSX text found by the TypeScript parser — never comments
// or identifiers. The CLI reads the BUILT packages the same way (HTML and JS) per NOCTURA_DIST, on the 'built' tier, so
// text from ../core that a bundle carries is read too; an allowance no built file uses any more fails.
//
// The limit (claims.mjs says it too): a sentence assembled at run time from pieces, or text from data, is read piece by
// piece — a word list is a review aid, not a proof.
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import {isMain} from './isMain.mjs';
import {distDir} from './distDir.mjs';
import {claimViolations, unusedAllowances} from './claims.mjs';

const collapse = s => s.replace(/\s+/g, ' ').trim();

const ENTITIES = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', mdash: '—', ndash: '–', middot: '·', hellip: '…'};
const decode = s =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
    return ENTITIES[e.toLowerCase()] ?? m;
  });

/** The attributes a user sees or hears (a button's `value` is its label). */
const VISIBLE_ATTRS = new Set(['aria-label', 'aria-description', 'aria-placeholder', 'aria-roledescription', 'aria-valuetext', 'placeholder', 'title', 'alt', 'value']);
/** One attribute in a start tag: its name, then a double-quoted, single-quoted or unquoted value (HTML's three forms). */
const ATTR = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
/** Tags that run inside a sentence: removed without a break, so "the <a>Terms</a>." stays one unit. */
const INLINE = /^(?:a|b|i|em|strong|span|code|small|svg|use|kbd|br|wbr|label)$/i;

/** The visible text of an HTML file: one unit per block of text, plus one per visible attribute value. */
export function htmlUnits(html, where) {
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template)\b[\s\S]*?<\/\1\s*>/gi, '');
  const units = [];
  for (const tag of body.matchAll(/<[a-z][a-z0-9-]*\b([^>]*)>/gi)) {
    for (const m of tag[1].matchAll(ATTR)) {
      const value = m[2] ?? m[3] ?? m[4];
      if (VISIBLE_ATTRS.has(m[1].toLowerCase()) && value !== undefined && value.trim() !== '') units.push({where: `${where} [attribute]`, text: decode(value)});
    }
  }
  const text = body.replace(/<\/?([a-z][a-z0-9-]*)\b[^>]*>/gi, (_, tag) => (INLINE.test(tag) ? '' : '\n'));
  for (const line of text.split('\n')) {
    const t = collapse(decode(line));
    if (t !== '') units.push({where, text: t});
  }
  return units;
}

/** The string literals, template literals (each `${…}` as "${}") and JSX text of a TS / TSX / JS file. */
export function scriptUnits(code, where, kind = ts.ScriptKind.TSX) {
  const sf = ts.createSourceFile(where, code, ts.ScriptTarget.Latest, true, kind);
  const units = [];
  const visit = node => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) units.push({where, text: node.text});
    else if (ts.isTemplateExpression(node)) units.push({where, text: node.head.text + node.templateSpans.map(s => '${}' + s.literal.text).join('')});
    else if (ts.isJsxText(node)) {
      const t = collapse(node.text);
      if (t !== '') units.push({where, text: t});
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return units;
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir).sort()) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

const toPosix = p => p.split(sep).join('/');
const isTest = rel => /(^|\/)__tests__\//.test(rel) || /\.test\.tsx?$/.test(rel);

/** The source tier: the package's HTML entries and every non-test .ts / .tsx under src/ (both builds' code). */
export function sourceUnits(root) {
  const files = [];
  for (const name of readdirSync(root).sort()) if (name.endsWith('.html')) files.push(name);
  for (const p of listFiles(join(root, 'src'))) {
    const rel = toPosix(relative(root, p));
    if (/\.tsx?$/.test(rel) && !rel.endsWith('.d.ts') && !isTest(rel)) files.push(rel);
  }
  const units = [];
  for (const rel of files) {
    const text = readFileSync(join(root, rel), 'utf8');
    units.push(...(rel.endsWith('.html') ? htmlUnits(text, rel) : scriptUnits(text, rel, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)));
  }
  return {files, units};
}

/** The built tier: every .html and .js file of one package directory. */
export function builtUnits(dir, label = dir) {
  const files = listFiles(dir)
    .map(p => toPosix(relative(dir, p)))
    .filter(rel => rel.endsWith('.html') || rel.endsWith('.js'))
    .filter(rel => rel !== 'licenses.html'); // the licence texts: other people's words, as written (B1e §4.2)
  const units = [];
  for (const rel of files) {
    const text = readFileSync(join(dir, rel), 'utf8');
    units.push(...(rel.endsWith('.html') ? htmlUnits(text, `${label}/${rel}`) : scriptUnits(text, `${label}/${rel}`, ts.ScriptKind.JS)));
  }
  return {files, units};
}

if (isMain(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const DIST = distDir();
  const problems = [];
  const used = new Set();
  let files = 0;
  for (const browser of ['chrome', 'firefox']) {
    const dir = join(ROOT, DIST, browser);
    if (!existsSync(dir)) {
      problems.push(`INCONCLUSIVE: ${DIST}/${browser} is missing`);
      continue;
    }
    const built = builtUnits(dir, `${DIST}/${browser}`);
    files += built.files.length;
    problems.push(...claimViolations(built.units, {tier: 'built', used}));
  }
  if (problems.length === 0) problems.push(...unusedAllowances(used, 'built'));
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`ui claims ok (${DIST}): ${files} built HTML / JS files of chrome/ and firefox/, no claim the privacy policy contradicts (${used.size} allowances used)`);
}
```

- [ ] **Step 3: Write the failing tests.**

Create `extension/scripts/__tests__/claims.test.mjs`:

```js
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ALLOWED, CLAIMS, TIERS, claimViolations, markdownUnits, unusedAllowances} from '../claims.mjs';

// B1e §6.1, §6.4 (B1e-2 Task 6, review 1 I3): the one list of claims the extension does not keep — every pattern
// refuses its planted sentence, the names pass, each allowance holds a claim, passes on the tiers it lists and only
// there, and the three checks that read words (the UI guard, the store texts, the privacy policy) all import it.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const at = (where, text) => ({where, text});
const on = (tier, text, o = {}) => claimViolations([at('p', text)], {tier, ...o});

describe('the claims list (scripts/claims.mjs)', () => {
  it('its claims, in order; each pattern case-insensitive and not global (a /g pattern would carry lastIndex from one unit to the next)', () => {
    expect(CLAIMS.map(c => c.id)).toEqual([
      'private',
      'privacy',
      'anonymous',
      'untraceable',
      'unlinkable',
      'confidential',
      'e2e',
      'end-to-end',
      'encrypted in transit',
      'zero-knowledge',
      'shielded',
      'incognito',
      'hidden',
      'never see',
      "can't see",
      'no one can see',
      "we don't see",
      'never receive',
      'never leave',
      'nothing leaves',
      'stays on this device',
      'only on this device',
      'local-only',
      'offline-only',
      'offline',
      'no server',
      'no tracking',
      'bank-grade',
    ]);
    for (const c of CLAIMS) expect([c.id, c.pattern.flags]).toEqual([c.id, 'i']);
    expect(TIERS).toEqual(['source', 'built', 'store', 'policy']);
  });

  it('refuses every claim on its own, on every tier: a planted sentence each, exactly that claim', () => {
    const planted = {
      private: 'Your balance stays private.',
      privacy: 'Built for privacy.',
      anonymous: 'Send anonymously.',
      untraceable: 'Untraceable transfers.',
      unlinkable: 'Unlinkable accounts.',
      confidential: 'Confidential transfers.',
      e2e: 'E2E-encrypted vault',
      'end-to-end': 'End to end encryption',
      'encrypted in transit': 'Your data is encrypted in transit.',
      'zero-knowledge': 'Zero-knowledge proofs keep it safe.',
      shielded: 'Shielded balance',
      incognito: 'Browse incognito.',
      hidden: 'Your balance is hidden.',
      'never see': 'Noctura never sees your address.',
      "can't see": 'Sites can’t see your balance.',
      'no one can see': 'No one knows what you hold.',
      "we don't see": "We don't see your balance.",
      'never receive': 'The coordinator never receives your address.',
      'never leave': 'Your address never leaves this device.',
      'nothing leaves': 'Nothing is sent to anyone.',
      'stays on this device': 'Your activity stays on this device.',
      'only on this device': 'Your history is saved only on this device.',
      'local-only': 'A local-only wallet.',
      'offline-only': 'An offline only flow.',
      offline: 'The wallet works offline.',
      'no server': 'No server is involved.',
      'no tracking': 'No tracking.',
      'bank-grade': 'Bank-grade security.',
    };
    expect(Object.keys(planted)).toEqual(CLAIMS.map(c => c.id));
    for (const tier of TIERS) for (const [id, text] of Object.entries(planted)) expect(on(tier, text), `${tier}: ${id}`).toEqual([`p: "${id}" in “${text}”`]);
    // A non-breaking hyphen (&#8209;) or an en dash is still a hyphen.
    expect(on('source', 'End\u2011to\u2011end encrypted, offline\u2013only, local\u2010only').length).toBe(3);
  });

  it('the blind spots review 1 named (I3), each refused by the claim that reads it', () => {
    const ids = text => on('source', text).map(v => /"(.+)" in/.exec(v)[1]);
    expect(ids('Your address never leaves this device.')).toEqual(['never leave']);
    expect(ids('We do not see your transactions.')).toEqual(["we don't see"]);
    expect(ids('Noctura cannot see your balance.')).toEqual(["can't see", "we don't see"]);
    expect(ids('We never receive your address.')).toEqual(["we don't see", 'never receive']);
    expect(ids('No one knows your balance.')).toEqual(['no one can see']);
    expect(ids('No tracking, no logs.')).toEqual(['no tracking']);
    expect(ids('Local-only by design.')).toEqual(['local-only']);
    expect(ids('Your addresses are stored only on this device.')).toEqual(['only on this device']);
    expect(ids('Your addresses stay on this device.')).toEqual(['stays on this device']);
    expect(ids('Your data stays local.')).toEqual(['stays on this device']);
    expect(ids('Transfers are confidential.')).toEqual(['confidential']);
    expect(ids('Your sends are hidden from the coordinator.')).toEqual(['hidden']);
    expect(ids('Incognito mode.')).toEqual(['incognito']);
    expect(ids('No servers — just you and Solana.')).toEqual(['no server']);
    expect(ids('Your keys never leave your browser and nothing is logged.')).toEqual(['never leave', 'nothing leaves']);
    expect(ids('Secure as a bank, military-grade encryption.')).toEqual(['bank-grade']);
  });

  it('names and true states pass on every tier: private key(s), the Privacy Policy, its URL and contact, connectivity, a hidden balance', () => {
    for (const tier of TIERS) {
      for (const text of [
        'Export private key',
        'never your seed or private keys',
        'Privacy Policy',
        'Terms and Privacy Policy.',
        'https://noc-tura.io/extension/privacy',
        'write to privacy@noc-tura.io',
        'release/privacy.md',
        "You're offline",
        'What you can still do offline:',
        '24 words. Written offline. The only way back if this browser\'s data is lost.',
        'balance hidden',
        'confidentialTransferMint',
        'This transaction is no longer tracked.',
        "This address has no presale allocation, so it can't receive a referral bonus",
        "Receiving works — your address is on this device.",
      ]) {
        expect(on(tier, text), `${tier}: ${text}`).toEqual([]);
      }
    }
  });

  it('each allowance holds a claim (else it is not needed), passes on each tier it lists, and is refused on every other tier', () => {
    expect(ALLOWED.length).toBe(26);
    for (const a of ALLOWED) {
      expect(a.verdict.length, a.text).toBeGreaterThan(10);
      expect(a.tiers.length, a.text).toBeGreaterThan(0);
      expect(a.tiers.every(t => TIERS.includes(t)), a.text).toBe(true);
      for (const tier of TIERS) {
        // The negative control: the same words with no allowance at all are refused.
        expect(on(tier, a.text, {allowed: []}).length, `${tier} without allowances: ${a.text}`).toBeGreaterThan(0);
        if (a.tiers.includes(tier)) expect(on(tier, a.text), `${tier}: ${a.text}`).toEqual([]);
        else expect(on(tier, a.text).length, `${tier} (not listed): ${a.text}`).toBeGreaterThan(0);
      }
    }
    expect(Object.fromEntries(TIERS.map(t => [t, ALLOWED.filter(a => a.tiers.includes(t)).length]))).toEqual({source: 7, built: 17, store: 6, policy: 6});
  });

  it('an allowance removes exactly its own words: the same word elsewhere in the unit is still refused', () => {
    expect(on('source', 'Move to a private place. Anyone who sees these 24 words can spend everything.')).toEqual([]);
    expect(on('source', 'Move to a private place. Your balance is private.')).toEqual(['p: "private" in “Move to a private place. Your balance is private.”']);
    // Whitespace is collapsed before an allowance is matched (the BIP-39 list's words are separated by newlines).
    expect(on('built', 'priority\nprison\nprivate\nprize\nproblem')).toEqual([]);
    expect(on('built', 'priority\nprivate\nproblem')).toEqual(['p: "private" in “priority private problem”']);
  });

  it('reports an allowance no text used (a stale entry), per tier; refuses a tier it does not know', () => {
    const allowed = [...ALLOWED, {text: 'A planted private sentence.', tiers: ['store'], verdict: 'test'}];
    const used = new Set();
    claimViolations([at('s', 'Nothing here.')], {tier: 'store', allowed, used});
    expect(unusedAllowances(used, 'store', allowed)).toEqual([...ALLOWED, allowed.at(-1)].filter(a => a.tiers.includes('store')).map(a => `allowance not used by any store text: “${a.text}”`));
    claimViolations([at('s', 'A planted private sentence.')], {tier: 'store', allowed, used});
    expect(unusedAllowances(used, 'store', allowed)).not.toContain('allowance not used by any store text: “A planted private sentence.”');
    expect(() => claimViolations([], {})).toThrow('tier must be one of source, built, store, policy');
    expect(() => unusedAllowances(new Set(), 'listing')).toThrow('tier must be one of');
  });

  it('markdown is read a paragraph at a time, whitespace collapsed', () => {
    expect(markdownUnits('# Title\n\nOne line\nwrapped.\n\n\n- a\n- b\n', 'm')).toEqual([at('m', '# Title'), at('m', 'One line wrapped.'), at('m', '- a - b')]);
  });

  it('the three checks that read words import this list — none keeps a list of its own', () => {
    const src = rel => readFileSync(resolve(ROOT, rel), 'utf8');
    expect(src('scripts/check-ui-claims.mjs')).toContain("from './claims.mjs';");
    for (const rel of ['scripts/__tests__/storeTexts.test.mjs', 'scripts/__tests__/privacy.test.mjs', 'scripts/__tests__/check-ui-claims.test.mjs']) {
      expect(src(rel), rel).toContain("from '../claims.mjs';");
    }
  });
});
```

Create `extension/scripts/__tests__/check-ui-claims.test.mjs`:

```js
import {mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {builtUnits, htmlUnits, scriptUnits, sourceUnits} from '../check-ui-claims.mjs';
import {ALLOWED, claimViolations, unusedAllowances} from '../claims.mjs';
import {render} from '../../manifest/source.mjs';

// B1e §6.1, §6.4 (B1e-2 Task 6): no screen of the extension says what its privacy policy contradicts. The source tier
// is read here (both builds' code: the HTML entries and every non-test .ts / .tsx under src/); the built packages are
// read by the gate's CLI (`npm run gates`, both dists), whose reader is tested here on a package written for the test.
// The claims and the allowances are scripts/claims.mjs (tested in claims.test.mjs); here they are read on the 'source' tier.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SOURCE = sourceUnits(ROOT);
const at = (where, text) => ({where, text});
const onSource = units => claimViolations(units, {tier: 'source'});

/** The three sentences #1 and #39 said before (B1b-2a), each a claim the policy contradicts. */
const OLD = {
  tagline: 'A Solana wallet built for private, non-custodial holding.',
  chip: 'E2E encrypted',
  footer: 'The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.',
  // #8's banner before E24 (owner, 2026-11-06): it named the phone app's "future private (shielded) keys".
  banner: "This phrase is also the root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this browser gets those too.",
};
/** Their replacements (D27, the controller's tagline and chip; the #39 footer as corrected by this task). */
const NEW = {
  tagline: 'A non-custodial Solana wallet. Your keys stay on this device.',
  chip: 'Encrypted on this device',
  footer: "Your recovery phrase and password never leave this device. To read your balances, your accounts' public addresses are sent to the Noctura coordinator.",
  banner:
    "This phrase is also the root of the Noctura phone app's keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.",
};

/** The source tier's files, listed independently of sourceUnits (Node's own recursive readdir): the reader's positive control. */
function sourceFiles() {
  const html = readdirSync(ROOT).filter(n => n.endsWith('.html'));
  const ts = readdirSync(resolve(ROOT, 'src'), {recursive: true})
    .map(p => `src/${String(p).split('\\').join('/')}`)
    .filter(p => /\.tsx?$/.test(p) && !p.endsWith('.d.ts') && !p.includes('/__tests__/') && !/\.test\.tsx?$/.test(p));
  return [...html, ...ts].sort();
}

describe('the extension says nothing its privacy policy contradicts (source tier)', () => {
  it('reads the real files — the HTML entries and src/ without tests — and finds no refused claim', () => {
    // Positive control: the reader read exactly the files an independent listing finds (review 1 M4: derived, not a
    // pinned count, so a file added elsewhere cannot turn this red), and enough of them to be the package.
    expect(SOURCE.files.filter(f => f.endsWith('.html'))).toEqual(['approve.html', 'popup.html', 'unlock.html', 'wallet.html']);
    expect([...SOURCE.files].sort()).toEqual(sourceFiles());
    expect(SOURCE.files.length).toBeGreaterThan(200);
    expect(SOURCE.units.length).toBeGreaterThan(14_000);
    expect(SOURCE.files.some(f => f.includes('__tests__') || f.endsWith('.test.ts') || f.endsWith('.test.tsx'))).toBe(false);
    const used = new Set();
    expect(claimViolations(SOURCE.units, {tier: 'source', used})).toEqual([]);
    // Every source allowance is still needed: a stale one would let its word back in.
    expect(unusedAllowances(used, 'source')).toEqual([]);
  });

  it("reads #1's tagline and chip, #39's footer and #8's banner as they are now — and the four old sentences nowhere", () => {
    const unlock = SOURCE.units.filter(u => u.where === 'unlock.html').map(u => u.text);
    for (const text of Object.values(NEW)) expect(unlock).toContain(text);
    const all = SOURCE.units.map(u => u.text).join('\n');
    for (const text of Object.values(OLD)) expect(all).not.toContain(text);
  });

  it('refuses each old sentence, by the claim it makes; passes each new one', () => {
    expect(onSource([at('x', OLD.tagline)])).toEqual([`x: "private" in “${OLD.tagline}”`]);
    expect(onSource([at('x', OLD.chip)])).toEqual([`x: "e2e" in “${OLD.chip}”`]);
    expect(onSource([at('x', OLD.footer)])).toEqual([`x: "never see" in “${OLD.footer}”`, `x: "we don't see" in “${OLD.footer}”`, `x: "offline-only" in “${OLD.footer}”`]);
    expect(onSource([at('x', OLD.banner)])).toEqual([`x: "private" in “${OLD.banner}”`, `x: "shielded" in “${OLD.banner}”`]);
    for (const text of Object.values(NEW)) expect(onSource([at('x', text)])).toEqual([]);
  });

  it('reports a source allowance no source file uses (a stale entry); a built-only allowance admits nothing in the source', () => {
    const allowed = [...ALLOWED, {text: 'A planted private sentence.', tiers: ['source'], verdict: 'test'}];
    const used = new Set();
    claimViolations(SOURCE.units, {tier: 'source', allowed, used});
    expect(unusedAllowances(used, 'source', allowed)).toEqual(['allowance not used by any source text: “A planted private sentence.”']);
    // Review 1 I3: the bundled tslib helper's words are allowed in the packages, not on a screen's source.
    const helper = 'Private accessor was defined without a getter';
    expect(claimViolations([at('b', helper)], {tier: 'built'})).toEqual([]);
    expect(onSource([at('s', helper)])).toEqual([`s: "private" in “${helper}”`]);
  });
});

describe('the readers: what a user sees, never comments', () => {
  it('HTML: text between tags, visible attributes in all three quotings; comments, <script>, <style> and <template> dropped; inline tags keep a sentence whole', () => {
    const html = [
      '<!-- We never see anything. -->',
      '<style>.x::after{content:"private"}</style><script>const a = "shielded";</script><template><p>Anonymous</p></template>',
      '<p>By continuing you agree to the <a href="#">Terms</a> and <a href="#">Privacy Policy</a>.</p>',
      '<input placeholder="Your private notes" aria-label="Untraceable field"><img alt="E2E" title="Zero-knowledge">',
      '<span class="chip"><svg><use href="#i" /></svg>End&#8209;to-end &amp; more</span>',
      // Review 1 I3: single-quoted and unquoted values, and a button's value, are read too; a hidden class name is not.
      "<button title='Nothing leaves this device' aria-label=Incognito class=\"private\"></button><input type=submit value=\"Stay offline\" data-x='shielded'>",
    ].join('\n');
    expect(htmlUnits(html, 'h.html').map(u => `${u.where}|${u.text}`)).toEqual([
      'h.html [attribute]|Your private notes',
      'h.html [attribute]|Untraceable field',
      'h.html [attribute]|E2E',
      'h.html [attribute]|Zero-knowledge',
      'h.html [attribute]|Nothing leaves this device',
      'h.html [attribute]|Incognito',
      'h.html [attribute]|Stay offline',
      'h.html|By continuing you agree to the Terms and Privacy Policy.',
      'h.html|End\u2011to-end & more',
    ]);
  });

  it('TS / TSX: string literals, template literals (`${}` for each interpolation) and JSX text — never comments or identifiers', () => {
    const code = [
      '// We never see your seed (a comment).',
      '/* offline-only */',
      'const privateThing = 1;',
      "export const A = {t: 'Single', u: \"Double\", v: `Plain`, w: (n: number) => `Before ${n} after ${n + 1} end`};",
      'export const C = () => <p className="x">Shown {A.t} text</p>;',
    ].join('\n');
    expect(scriptUnits(code, 'c.tsx').map(u => u.text)).toEqual(['Single', 'Double', 'Plain', 'Before ${} after ${} end', 'x', 'Shown', 'text']);
  });

  it('built packages: every .html and .js file, licenses.html skipped by name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'noctura-ui-claims-'));
    try {
      const write = (rel, text) => {
        mkdirSync(dirname(join(dir, rel)), {recursive: true});
        writeFileSync(join(dir, rel), text);
      };
      write('unlock.html', `<p>${OLD.tagline}</p>`);
      write('assets/approve-1.js', 'const T={chip:`E2E encrypted`};');
      write('background.js', 'throw TypeError("Private accessor was defined without a getter")');
      write('licenses.html', '<pre>THE SOFTWARE IS PROVIDED … private use …</pre>');
      write('assets/x.css', '.private{}');
      const built = builtUnits(dir, 'pkg');
      expect(built.files).toEqual(['assets/approve-1.js', 'background.js', 'unlock.html']);
      const used = new Set();
      expect(claimViolations(built.units, {tier: 'built', used})).toEqual([`pkg/assets/approve-1.js: "e2e" in “E2E encrypted”`, `pkg/unlock.html: "private" in “${OLD.tagline}”`]);
      expect([...used]).toEqual(['Private accessor was defined without a getter']);
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});

describe("the store's summary is the manifest's description (B1e §6.4)", () => {
  it('both browsers carry one description: at most 132 characters, and no refused claim', () => {
    const d = render('chrome').description;
    expect(render('firefox').description).toBe(d);
    expect(d).toBe('A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.');
    expect([...d].length).toBeLessThanOrEqual(132);
    expect(onSource([at('description', d)])).toEqual([]);
    // The listing's summary is the same string: scripts/__tests__/storeTexts.test.mjs pins section(Summary) === description.
    expect(readFileSync(resolve(ROOT, 'release/listing.md'), 'utf8')).toContain(`## Summary (short description)\n\n${d}\n`);
  });
});
```

The source files' positive control is derived (review 1 M4): `sourceFiles()` lists the same tier with Node's own `readdirSync(…, {recursive: true})`, independently of `sourceUnits`' walk, and the two lists must be equal — a file added anywhere under `src/` changes both, so it cannot turn the test red; a reader that skips a directory makes them differ (mutation M4-skip-presale). The floor `> 200` (230 today) and `> 14 000` units keep it from passing on an empty tree.

The store texts and the privacy policy read the shared list (I3: "each may add, none may lack" — storeTexts adds TGE and its date forms; privacy adds "private only in private keys"):

```diff
diff --git a/extension/scripts/__tests__/storeTexts.test.mjs b/extension/scripts/__tests__/storeTexts.test.mjs
index 0fa2c11..ae5653d 100644
--- a/extension/scripts/__tests__/storeTexts.test.mjs
+++ b/extension/scripts/__tests__/storeTexts.test.mjs
@@ -5,6 +5,7 @@ import {CONTENT_SCRIPTS, EXTENSION_CSP, HOST_PERMISSIONS, PERMISSIONS, render} f
 import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
 import {CONTACT, LIVE_PAGES, TERMS_DRAFT_MARKERS, liveCheck, pageProblems} from '../live-check.mjs';
 import {forbiddenForms} from '../check-no-tge-date.mjs';
+import {claimViolations, markdownUnits, unusedAllowances} from '../claims.mjs';
 import {NOCTURA_PAGES} from '../../src/shared/links';
 import {RP_ID} from '../../src/vault/passkey';
 import {ALLOWANCE_WORD, OVERRIDE_WORDS} from '../../src/background/dapp/redFlags';
@@ -86,25 +87,14 @@ const summaryProblems = s => [
 
 /**
  * Claims the extension does not keep (spec §6.4; memory "shielded privacy guarantee": the extension is transparent):
- * "private" except in "private key(s)", any "privacy" but the Privacy Policy, the contact address and the policy's own
- * URL path and file name (…/extension/privacy, privacy.md), anonymity,
- * untraceability, unlinkability, "shielded", the bank / military comparisons, "TGE" and every written form of its date.
+ * scripts/claims.mjs's list, read on its 'store' tier (the store texts' own true sentences allowed by their exact words;
+ * `used` collects them), plus this check's own: "TGE" and every written form of its date.
  */
-const FORBIDDEN = [
-  /\bprivate(?!\s+keys?\b)\w*/gi,
-  /(?<!\/)\bprivacy\b(?!\s+policy\b|@noc-tura\.io|\.md\b)/gi,
-  /\banonym\w*/gi,
-  /\buntraceab\w*/gi,
-  /\bunlinkab\w*/gi,
-  /\bshielded\b/gi,
-  /\bsecure as a bank\b/gi,
-  /\b(?:bank|military)[- ]grade\b/gi,
-  /\bTGE\b/g,
-];
-function forbiddenClaims(text) {
+function forbiddenClaims(text, used = new Set()) {
   const lower = text.toLowerCase();
   return [
-    ...FORBIDDEN.flatMap(re => [...text.matchAll(re)].map(m => m[0])),
+    ...claimViolations(markdownUnits(text, 'text'), {tier: 'store', used}),
+    ...[...text.matchAll(/\bTGE\b/g)].map(m => m[0]),
     ...forbiddenForms().filter(f => lower.includes(f.toLowerCase())).map(() => '<the TGE date>'),
   ];
 }
@@ -285,10 +275,33 @@ describe('the store and noc-tura.io texts (B1e §6.3, §6.4)', () => {
   });
 
   it('no claim the build does not keep, in all four texts — controls: each planted word is caught, "private keys" is not', () => {
-    for (const [name, text] of Object.entries(TEXTS)) expect(forbiddenClaims(text), name).toEqual([]);
-    expect(forbiddenClaims('Your private keys stay here.')).toEqual([]);
+    const used = new Set();
+    for (const [name, text] of Object.entries(TEXTS)) expect(forbiddenClaims(text, used), name).toEqual([]);
+    // Every store allowance is still needed by one of the four texts (a stale one would let its words back in).
+    expect(unusedAllowances(used, 'store')).toEqual([]);
+    expect(forbiddenClaims('Your private keys are yours.')).toEqual([]);
     expect(forbiddenClaims('Read the Privacy Policy or write to privacy@noc-tura.io.')).toEqual([]);
-    for (const planted of ['A private wallet.', 'Send privately.', 'Anonymous payments.', 'Untraceable.', 'Privacy-first.', 'Shielded sends.', 'As secure as a bank.', 'Bank-grade security.', 'Free until TGE.']) {
+    for (const planted of [
+      'A private wallet.',
+      'Send privately.',
+      'Anonymous payments.',
+      'Untraceable.',
+      'Privacy-first.',
+      'Shielded sends.',
+      'As secure as a bank.',
+      'Bank-grade security.',
+      'Free until TGE.',
+      // Review 1 I3's blind spots, now in the shared list.
+      'Your address never leaves this device.',
+      'We do not see your transactions.',
+      'Your activity stays on this device.',
+      'A local-only wallet.',
+      'Confidential transfers.',
+      'No tracking.',
+      'Works offline.',
+      // A sentence allowed on the source tier (#39's footer) is not allowed here: the tiers do not leak.
+      'Your recovery phrase and password never leave this device.',
+    ]) {
       expect(forbiddenClaims(planted).length, planted).toBe(1);
     }
     expect(forbiddenClaims(`On ${forbiddenForms()[0]}.`)).toEqual(['<the TGE date>']);
```

```diff
diff --git a/extension/scripts/__tests__/privacy.test.mjs b/extension/scripts/__tests__/privacy.test.mjs
index 987b279..0409980 100644
--- a/extension/scripts/__tests__/privacy.test.mjs
+++ b/extension/scripts/__tests__/privacy.test.mjs
@@ -2,6 +2,7 @@ import {readFileSync} from 'node:fs';
 import {dirname, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
+import {claimViolations, markdownUnits, unusedAllowances} from '../claims.mjs';
 import {CONTACT, LIVE_PAGES, foldText, pageProblems} from '../live-check.mjs';
 import {REQUIRED_CONNECT_SRC} from '../check-permissions.mjs';
 import {FRESH_ROWS} from '../../src/app/useAccountBalances';
@@ -79,10 +80,18 @@ describe('the privacy policy (B1e §6.1, §6.2)', () => {
     expect(PRIVACY_MD.startsWith(`# ${privacy.title}\n`)).toBe(true);
   });
 
-  it('privacy.md makes no claim the build does not keep: nothing "anonymous" or "untraceable"; "private" only in "private keys"', () => {
-    const lower = PRIVACY_MD.toLowerCase();
-    expect(lower).not.toMatch(/\b(anonym\w*|untraceable|unlinkable|confidential|encrypted in transit)\b/);
-    expect([...lower.matchAll(/\bprivate\b(.{0,5})/g)].map(m => m[1])).toEqual([' keys']);
+  it('privacy.md makes no claim the build does not keep: scripts/claims.mjs on its policy tier, every policy allowance needed; "private" only in "private keys" — controls: a planted claim, a source-tier sentence', () => {
+    const used = new Set();
+    expect(claimViolations(markdownUnits(PRIVACY_MD, 'privacy.md'), {tier: 'policy', used})).toEqual([]);
+    expect(unusedAllowances(used, 'policy')).toEqual([]);
+    // This check's own addition: the one "private" is P11's "private keys".
+    expect([...PRIVACY_MD.toLowerCase().matchAll(/\bprivate\b(.{0,5})/g)].map(m => m[1])).toEqual([' keys']);
+    const planted = md => claimViolations(markdownUnits(md, 'privacy.md'), {tier: 'policy'});
+    expect(planted(`${PRIVACY_MD}\n\nYour transactions are confidential and encrypted in transit.\n`)).toEqual([
+      'privacy.md: "confidential" in “Your transactions are confidential and encrypted in transit.”',
+      'privacy.md: "encrypted in transit" in “Your transactions are confidential and encrypted in transit.”',
+    ]);
+    expect(planted(`${PRIVACY_MD}\n\nYour keys stay on this device.\n`)).toEqual(['privacy.md: "stays on this device" in “Your keys stay on this device.”']);
   });
 
   it('the facts in the sentences are the code\'s: the one host, the counts, the intervals, the RP ID, the tokens, the contact', () => {
```

The tests that pin the copy (Step 5 changes it; written first, red until then):

```diff
diff --git a/extension/src/unlock/__tests__/welcome.test.ts b/extension/src/unlock/__tests__/welcome.test.ts
index a42c636..4e3fec7 100644
--- a/extension/src/unlock/__tests__/welcome.test.ts
+++ b/extension/src/unlock/__tests__/welcome.test.ts
@@ -10,15 +10,15 @@ const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
 beforeEach(loadPage);
 
 describe('#1 welcome (spec §3.1)', () => {
-  it('idle: the design’s copy, two trust chips (no "ZK-private", D6), the terms line with its two links, both CTAs in design order', async () => {
+  it('idle: the wordmark, the tagline and two trust chips as B1e-2 Task 6 rewrote them (no "ZK-private", D6), the terms line with its two links, both CTAs in design order', async () => {
     const h = await harness();
     const calls: string[] = [];
     await mountWelcome(h.deps, {create: () => calls.push('create'), import: () => calls.push('import')}).show();
     const screen = el('v-welcome');
     expect(visible(screen)).toBe(true);
     expect(text(screen.querySelector('.wordmark'))).toBe('Noctura');
-    expect(text(screen.querySelector('.tagline'))).toBe('A Solana wallet built for private, non-custodial holding.');
-    expect([...screen.querySelectorAll('.trust-chip')].map(text)).toEqual(['E2E encrypted', 'Non-custodial']);
+    expect(text(screen.querySelector('.tagline'))).toBe('A non-custodial Solana wallet. Your keys stay on this device.');
+    expect([...screen.querySelectorAll('.trust-chip')].map(text)).toEqual(['Encrypted on this device', 'Non-custodial']);
     expect(text(screen)).not.toContain('ZK-private');
     expect(visible(el('wel-terms'))).toBe(true);
     expect(text(screen.querySelector('.terms'))).toBe('By continuing you agree to the Terms and Privacy Policy.');
```

```diff
diff --git a/extension/src/unlock/__tests__/restore.test.ts b/extension/src/unlock/__tests__/restore.test.ts
index 7a025f5..692c222 100644
--- a/extension/src/unlock/__tests__/restore.test.ts
+++ b/extension/src/unlock/__tests__/restore.test.ts
@@ -50,7 +50,7 @@ describe('#39 forgot password (spec §3.11)', () => {
       ['s8-step-card vlt-gap-bottom-3', "2 Enter your words You'll be taken to the import screen. Type or paste your words."],
       ['s8-step-card', "3 Set a new password Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working."],
     ]);
-    expect(text(el('fg-foot'))).toBe('The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.');
+    expect(text(el('fg-foot'))).toBe("Your recovery phrase and password never leave this device. To read your balances, your accounts' public addresses are sent to the Noctura coordinator.");
     expect(visible(el('fg-foot'))).toBe(true);
     expect(visible(el('fg-warn'))).toBe(false);
     expect(text(el('fg-next'))).toBe('Restore from seed');
```

```diff
diff --git a/extension/src/unlock/__tests__/import.test.ts b/extension/src/unlock/__tests__/import.test.ts
index 8ed8230..d5bd5f2 100644
--- a/extension/src/unlock/__tests__/import.test.ts
+++ b/extension/src/unlock/__tests__/import.test.ts
@@ -73,7 +73,7 @@ describe('#8 import: the screen (spec §3.8)', () => {
     expect(field.placeholder).toBe('Enter your 12 or 24-word recovery phrase, separated by spaces.');
     expect([field.getAttribute('autocomplete'), field.getAttribute('spellcheck')]).toEqual(['off', 'false']);
     expect(text(screen.querySelector('.banner.info:not(.toast)'))).toBe(
-      "This phrase is also the root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.",
+      "This phrase is also the root of the Noctura phone app's keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.",
     );
     expect(cta.disabled).toBe(true);
     expect(text(screen)).not.toMatch(/Backup file|Screenshots|auto-clears from clipboard|clipboard cleared/);
```

```diff
diff --git a/extension/src/app/__tests__/Home.test.tsx b/extension/src/app/__tests__/Home.test.tsx
index 817e01a..c99fa6b 100644
--- a/extension/src/app/__tests__/Home.test.tsx
+++ b/extension/src/app/__tests__/Home.test.tsx
@@ -80,7 +80,9 @@ describe('#11 dashboard', () => {
     expect(screen.getByText('740.21 USDC')).toBeTruthy();
     const noc = document.querySelector('[data-token="NOC"]') as HTMLElement;
     expect(within(noc).getByText('$630.42')).toBeTruthy();
-    expect(within(noc).getByText('at stage price')).toBeTruthy();
+    // E23 (owner, 2026-11-06): the line says what the figure is and that the total leaves it out — no presale wording.
+    expect(within(noc).getByText('estimate · not in total')).toBeTruthy();
+    expect(noc.textContent).not.toMatch(/stage/i);
     // The account and its switcher, the refresh button (D2), the eye.
     expect(screen.getByRole('button', {name: 'Accounts'}).textContent).toContain('Main');
     fireEvent.click(screen.getByRole('button', {name: 'Accounts'}));
```

```diff
diff --git a/extension/src/app/__tests__/TokenSheet.test.tsx b/extension/src/app/__tests__/TokenSheet.test.tsx
index 8ecddc9..efc8050 100644
--- a/extension/src/app/__tests__/TokenSheet.test.tsx
+++ b/extension/src/app/__tests__/TokenSheet.test.tsx
@@ -8,13 +8,13 @@ const prices = {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: 1};
 
 describe('#43 token selector', () => {
   // index.html #s43's "All tokens" rows: the name first (.pri), the symbol under it (.sec) — Task 17 fix round 2.
-  it('four rows — name, symbol, balance, value; NOC at stage price; the current token selected', () => {
+  it('four rows — name, symbol, balance, value; the NOC value marked an estimate (E23); the current token selected', () => {
     render(<TokenSheet balances={balances} prices={prices} selected="SOL" onSelect={() => undefined} onClose={() => undefined} />);
     const dialog = screen.getByRole('dialog', {name: 'Choose a token'});
     const rows = within(dialog).getAllByRole('button', {pressed: undefined}).filter(b => b.classList.contains('app-token-row'));
     expect(rows.map(r => r.querySelector('.pri')?.textContent)).toEqual(['Solana', 'Noctura', 'USD Coin', 'Tether']);
     expect(rows.map(r => r.querySelector('.sec')?.textContent)).toEqual(['SOL', 'NOC', 'USDC', 'USDT']);
-    expect(rows[1]?.querySelector('.fiat')?.textContent).toBe('$630.42 at stage price');
+    expect(rows[1]?.querySelector('.fiat')?.textContent).toBe('$630.42 (estimate)');
     expect(rows[0]?.getAttribute('aria-pressed')).toBe('true');
     for (const gone of ['Popular', 'Search', 'All tokens']) expect(screen.queryByText(new RegExp(gone))).toBeNull();
   });
@@ -32,7 +32,7 @@ describe('#43 token selector', () => {
   });
 
   // Plan 3: #12 may open the sheet before the first balance read answers (or after it failed): never a 0.
-  it('with no balances read: every amount and value reads "—", and NOC claims no stage price', () => {
+  it('with no balances read: every amount and value reads "—", and NOC claims no estimate', () => {
     render(<TokenSheet balances={null} prices={prices} selected="NOC" onSelect={() => undefined} onClose={() => undefined} />);
     const dialog = screen.getByRole('dialog', {name: 'Choose a token'});
     expect([...dialog.querySelectorAll('.amt')].map(a => a.textContent)).toEqual(['—', '—', '—', '—']);
```

```diff
diff --git a/extension/src/app/__tests__/Send.test.tsx b/extension/src/app/__tests__/Send.test.tsx
index f491824..19e355e 100644
--- a/extension/src/app/__tests__/Send.test.tsx
+++ b/extension/src/app/__tests__/Send.test.tsx
@@ -202,7 +202,7 @@ describe('#12 send', () => {
     expect(screen.queryByText(SEND_TEXT.maxHelper)).toBeNull();
   });
 
-  it('#43 from the chip: "Choose a token", four rows with balances and NOC "at stage price"; Esc closes only the sheet', async () => {
+  it('#43 from the chip: "Choose a token", four rows with balances and the NOC value "(estimate)"; Esc closes only the sheet', async () => {
     await renderSend();
     await loaded();
     fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
@@ -213,7 +213,7 @@ describe('#12 send', () => {
     expect(document.querySelector('.s-send')).not.toBeNull();
     expect([...sheet.querySelectorAll('.pri')].map(p => p.textContent)).toEqual(['Solana', 'Noctura', 'USD Coin', 'Tether']);
     // 4 200 NOC × $0.1501 (the stage price), outside the market total.
-    expect(within(sheet).getByText('$630.42 at stage price')).toBeTruthy();
+    expect(within(sheet).getByText('$630.42 (estimate)')).toBeTruthy();
     expect(sheet.querySelector('.sel .pri')?.textContent).toBe('Solana');
     fireEvent.keyDown(document, {key: 'Escape'});
     expect(screen.queryByRole('dialog')).toBeNull();
```

```diff
diff --git a/extension/src/app/__tests__/Imported.test.tsx b/extension/src/app/__tests__/Imported.test.tsx
index 82c8e4f..c71ccab 100644
--- a/extension/src/app/__tests__/Imported.test.tsx
+++ b/extension/src/app/__tests__/Imported.test.tsx
@@ -22,7 +22,7 @@ const zero = () => walletReader({getBalance: async () => 0n, getTokenAccountsByO
 
 // Spec §3.12: #40 in the UI tab at #/imported.
 describe('#40 import-success (wallet.html#/imported)', () => {
-  it('single account: "Wallet imported", the market total and ≈ SOL, a row per token held (NOC at stage price), the address, the D10 line', async () => {
+  it('single account: "Wallet imported", the market total and ≈ SOL, a row per token held (the NOC value an estimate, E23), the address, the D10 line', async () => {
     await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT]});
     expect(await screen.findByText('Wallet imported')).toBeTruthy();
     expect(screen.getByText('1 account · 3 tokens recovered. Welcome back.')).toBeTruthy();
@@ -34,7 +34,7 @@ describe('#40 import-success (wallet.html#/imported)', () => {
     const rows = [...document.querySelectorAll('.s8-token-row')].map(r => [r.querySelector('.pri')?.textContent, r.querySelector('.sec')?.textContent, r.querySelector('.amt')?.textContent, r.querySelector('.fiat')?.textContent]);
     expect(rows).toEqual([
       ['SOL', 'Solana', '62.4821', '$9,372.31'],
-      ['NOC', 'Noctura', '4,200.00', '$630.42 at stage price'],
+      ['NOC', 'Noctura', '4,200.00', '$630.42 (estimate)'],
       ['USDC', 'USD Coin', '740.21', '$740.21'],
     ]);
     expect(screen.getByText('Your wallet address')).toBeTruthy();
```

`grep -rn "non-custodial holding\|E2E encrypted\|offline-only\|never see your\|Noctura wallet for Solana\|future private (shielded)\|stage price" extension --include=*.ts --include=*.tsx --include=*.mjs --include=*.md --include=*.html` (outside `dist*/` and `test-results/`) finds, once Steps 5–6 are in, only this task's own lines (the old sentences as refused rows in `check-ui-claims.test.mjs`, the `offline-only` claim, the screenshot spec's refusals and control) and comments and test titles that say NOC is *valued* at the presale stage price — `valuation.ts`, `prepare.ts`, `deps.ts`, `walletApi.ts`, `balanceCache.ts`, `dapp/simulate.ts`, `send/rules.ts`, `e2e/presaleChain.ts` and ten test lines (true, never shown). Outside `extension/`: the phone app's `WelcomeScreen.tsx`, `web/src/portfolio/PortfolioPanel.tsx:66` and the older plans/specs — not changed.

- [ ] **Step 4: Run them — red for the right reason.**

In a `git archive` copy of the base (55383f4, Tasks 1–5) with Steps 1–3's files added (`node_modules` linked), run (in `extension/`):
`TZ=UTC npx vitest run scripts/__tests__/claims.test.mjs scripts/__tests__/check-ui-claims.test.mjs scripts/__tests__/storeTexts.test.mjs scripts/__tests__/privacy.test.mjs src/app/__tests__/Home.test.tsx src/app/__tests__/TokenSheet.test.tsx src/app/__tests__/Send.test.tsx src/app/__tests__/Imported.test.tsx src/unlock/__tests__/welcome.test.ts src/unlock/__tests__/import.test.ts src/unlock/__tests__/restore.test.ts`
Expected: `Test Files  8 failed | 3 passed (11)` · `Tests  11 failed | 217 passed (228)`:
- UC `× reads the real files — the HTML entries and src/ without tests — and finds no refused claim` — `AssertionError: expected [ …(7) ] to deeply equal []`: `unlock.html: "private" in “A Solana wallet built for private, non-custodial holding.”`, `unlock.html: "e2e" in “E2E encrypted”`, `unlock.html: "private"` and `"shielded"` in #8's old banner, `unlock.html: "never see"`, `"we don't see"` and `"offline-only"` in #39's old footer (the whole source of both builds holds exactly these seven refusals — the sweep, Notes);
- UC `× reads #1's tagline and chip, #39's footer and #8's banner as they are now — and the four old sentences nowhere` — `AssertionError: expected [ Array(194) ] to include 'A non-custodial Solana wallet. Your k…'`;
- UC `× reports a source allowance no source file uses (a stale entry); a built-only allowance admits nothing in the source` — `+ "allowance not used by any source text: “A non-custodial Solana wallet. Your keys stay on this device.”"`, `+ "allowance not used by any source text: “Your recovery phrase and password never leave this device.”"` (the new copy's allowances, not yet needed);
- UC `× both browsers carry one description: at most 132 characters, and no refused claim` — `Expected: "A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites."` · `Received: "Noctura wallet for Solana."`;
- `welcome.test.ts × idle: the wordmark, the tagline and two trust chips as B1e-2 Task 6 rewrote them …` — `Expected: "A non-custodial Solana wallet. Your keys stay on this device."` · `Received: "A Solana wallet built for private, non-custodial holding."`;
- `restore.test.ts × step 1: the adapted copy, card 1 highlighted, the footer; …` — `Received: "The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address."`;
- `import.test.ts × phrase idle: the title, lede, placeholder and the D8 banner; …` — `Received: "This phrase is also the root of the Noctura phone app's future private (shielded) keys — …"`;
- `Home.test.tsx × loaded: the market total, SOL and NOC under it, …` — `TestingLibraryElementError: Unable to find an element with the text: estimate · not in total.`;
- `TokenSheet.test.tsx × four rows — …; the NOC value marked an estimate (E23); …` — `Expected: "$630.42 (estimate)"` · `Received: "$630.42 at stage price"`;
- `Send.test.tsx × #43 from the chip: … the NOC value "(estimate)"; …` — `Unable to find an element with the text: $630.42 (estimate).`;
- `Imported.test.tsx × single account: … (the NOC value an estimate, E23), …` — `- "$630.42 (estimate)",` · `+ "$630.42 at stage price",`.

`claims.test.mjs`, `storeTexts.test.mjs` and `privacy.test.mjs` are green on the base: the list is new and the store texts and the policy already say nothing it refuses (their positive controls); the store and policy allowances are each needed by those texts (the `unusedAllowances` rows), and each allowance's own row in `claims.test.mjs` shows it holds a claim.

- [ ] **Step 5: The copy.**

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 6105b2c..faf3153 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -34,10 +34,10 @@
           <div class="logo" aria-hidden="true"><span class="mark">N</span></div>
           <div>
             <h1 class="wordmark">Noctura</h1>
-            <p class="noc-body tagline vlt-gap-top-2">A Solana wallet built for private, non-custodial holding.</p>
+            <p class="noc-body tagline vlt-gap-top-2">A non-custodial Solana wallet. Your keys stay on this device.</p>
           </div>
           <div class="badges">
-            <span class="trust-chip"><svg width="14" height="14" aria-hidden="true"><use href="#i-lock" /></svg>E2E encrypted</span>
+            <span class="trust-chip"><svg width="14" height="14" aria-hidden="true"><use href="#i-lock" /></svg>Encrypted on this device</span>
             <span class="trust-chip"><svg width="14" height="14" aria-hidden="true"><use href="#i-key" /></svg>Non-custodial</span>
           </div>
           <div id="wel-notice" class="vlt-notice" role="status" hidden>
@@ -298,7 +298,7 @@
         <p id="imp-valid" class="noc-caption vlt-success vlt-valid" hidden><svg width="14" height="14" aria-hidden="true"><use href="#i-check" /></svg><span id="imp-valid-text"></span></p>
         <div class="banner info vlt-banner-gap">
           <svg width="16" height="16" aria-hidden="true"><use href="#i-info" /></svg>
-          <div class="noc-body-sm">This phrase is also the root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.</div>
+          <div class="noc-body-sm">This phrase is also the root of the Noctura phone app's keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.</div>
         </div>
         <p id="imp-line" class="noc-body vlt-pad vlt-center" role="status" hidden></p>
         <div id="imp-notice" class="vlt-notice" role="status" hidden>
@@ -462,7 +462,7 @@
             <h3>One warning before you proceed</h3>
             <p>Restoring from seed replaces the wallet in this browser — including any unconfirmed transactions. Your funds on Solana are unaffected.</p>
           </div>
-          <p id="fg-foot" class="noc-caption vlt-muted vlt-gap-top-5">The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.</p>
+          <p id="fg-foot" class="noc-caption vlt-muted vlt-gap-top-5">Your recovery phrase and password never leave this device. To read your balances, your accounts' public addresses are sent to the Noctura coordinator.</p>
         </div>
         <div class="sticky-bar">
           <button id="fg-next" type="button" class="btn btn-primary"><svg width="18" height="18" aria-hidden="true"><use href="#i-arrow-right" /></svg><span id="fg-next-label"></span></button>
```

```diff
diff --git a/extension/src/app/screens/Home.tsx b/extension/src/app/screens/Home.tsx
index 9db5ec8..cc845f8 100644
--- a/extension/src/app/screens/Home.tsx
+++ b/extension/src/app/screens/Home.tsx
@@ -435,7 +435,7 @@ export function Home({
               </div>
               <div className="price">
                 <div className="pri noc-body-lg noc-numeral">{hidden ? '••••' : row === null || row.usd === null ? '—' : showUsd(row.usd)}</div>
-                {row !== null && row.basis === 'stage' ? <div className="sec noc-body-sm">at stage price</div> : null}
+                {row !== null && row.basis === 'stage' ? <div className="sec noc-body-sm">estimate · not in total</div> : null}
                 {rowNote === 'live' ? <div className="sec noc-body-sm app-success">live</div> : null}
                 {rowNote === 'stale' ? <div className="sec noc-body-sm app-warning">stale</div> : null}
                 {priceStamp(rowNote) && priceAt !== null ? <div className="sec noc-body-sm">price {stamp(priceAt, now)}</div> : null}
```

```diff
diff --git a/extension/src/app/screens/TokenSheet.tsx b/extension/src/app/screens/TokenSheet.tsx
index 22ff27c..a48b034 100644
--- a/extension/src/app/screens/TokenSheet.tsx
+++ b/extension/src/app/screens/TokenSheet.tsx
@@ -52,7 +52,7 @@ export function TokenSheet({
               <span className="amt">{v === null ? '—' : showAmount(t, v.rows[t].base)}</span>
               <span className="fiat">
                 {v === null || v.rows[t].usd === null ? '—' : showUsd(v.rows[t].usd)}
-                {t === 'NOC' && v !== null && v.rows[t].usd !== null ? ' at stage price' : ''}
+                {t === 'NOC' && v !== null && v.rows[t].usd !== null ? ' (estimate)' : ''}
               </span>
             </span>
           </button>
```

```diff
diff --git a/extension/src/app/screens/Imported.tsx b/extension/src/app/screens/Imported.tsx
index fdc8119..3e7638a 100644
--- a/extension/src/app/screens/Imported.tsx
+++ b/extension/src/app/screens/Imported.tsx
@@ -276,7 +276,7 @@ export function Imported() {
               </div>
               <div>
                 <div className="amt noc-numeral">{showAmount(t, row.base)}</div>
-                <div className="fiat noc-numeral">{row.usd === null ? '—' : `${showUsd(row.usd)}${row.basis === 'stage' ? ' at stage price' : ''}`}</div>
+                <div className="fiat noc-numeral">{row.usd === null ? '—' : `${showUsd(row.usd)}${row.basis === 'stage' ? ' (estimate)' : ''}`}</div>
               </div>
             </div>
           );
```

```diff
diff --git a/extension/src/app/valuation.ts b/extension/src/app/valuation.ts
index 02bfbab..0fe26df 100644
--- a/extension/src/app/valuation.ts
+++ b/extension/src/app/valuation.ts
@@ -6,7 +6,7 @@ export interface TokenValue {
   base: bigint;
   /** USD, or null when no price is known — never 0 (core/portfolio/value.ts). */
   usd: number | null;
-  /** 'stage' for NOC: the presale stage price, labelled "at stage price", never in the total. */
+  /** 'stage' for NOC: the presale stage price, labelled "estimate" (E23: Home's "estimate · not in total"), never in the total. */
   basis: 'market' | 'stage';
 }
 
```

```diff
diff --git a/extension/manifest/source.mjs b/extension/manifest/source.mjs
index da0c57f..001ac57 100644
--- a/extension/manifest/source.mjs
+++ b/extension/manifest/source.mjs
@@ -83,7 +83,7 @@ function base() {
     manifest_version: 3,
     name: 'Noctura',
     version: VERSION,
-    description: 'Noctura wallet for Solana.',
+    description: 'A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.',
     permissions: PERMISSIONS.map(p => p.value),
     host_permissions: HOST_PERMISSIONS.map(p => p.value),
     content_security_policy: {extension_pages: EXTENSION_CSP},
```

```diff
diff --git a/extension/release/listing.md b/extension/release/listing.md
index 90f79b4..9f80a8c 100644
--- a/extension/release/listing.md
+++ b/extension/release/listing.md
@@ -8,7 +8,7 @@ Noctura
 
 ## Summary (short description)
 
-Noctura wallet for Solana.
+A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites.
 
 ## Category
 
```

- [ ] **Step 6: The E2E lines and the store screenshots' refusals.**

```diff
diff --git a/extension/e2e/onboarding.spec.ts b/extension/e2e/onboarding.spec.ts
index 02021cb..116a96c 100644
--- a/extension/e2e/onboarding.spec.ts
+++ b/extension/e2e/onboarding.spec.ts
@@ -29,7 +29,7 @@ test('1 · onboarding create: #1 → #2 → #3 → #4 → #5 → #6 → #7 shows
   try {
     const vault = await h.ctx.newPage();
     await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
-    await expect(vault.getByText('A Solana wallet built for private, non-custodial holding.')).toBeVisible();
+    await expect(vault.getByText('A non-custodial Solana wallet. Your keys stay on this device.')).toBeVisible();
     // Review L5: the design's font reaches the vault page (a face that loads, not the fallback).
     expect(await vault.evaluate(async () => (await document.fonts.load('16px Geist')).length)).toBeGreaterThan(0);
     expect(await vault.evaluate(() => document.fonts.check('16px Geist'))).toBe(true);
```

```diff
diff --git a/extension/e2e/visual-vault.spec.ts b/extension/e2e/visual-vault.spec.ts
index f752cf3..3649d3f 100644
--- a/extension/e2e/visual-vault.spec.ts
+++ b/extension/e2e/visual-vault.spec.ts
@@ -27,8 +27,8 @@ test('visual: the create run — #1, #2, #3, #4, #5, #6 and #7', async () => {
   const h = await launchPopup('noctura-e2e-vis-create-');
   try {
     const p = await vaultTab(h, 'unlock.html?mode=welcome', {passkeyCreate: 'null'});
-    await expect(p.getByText('A Solana wallet built for private, non-custodial holding.')).toBeVisible();
-    await expect(text(p, '.trust-chip')).toHaveText(['E2E encrypted', 'Non-custodial']);
+    await expect(p.getByText('A non-custodial Solana wallet. Your keys stay on this device.')).toBeVisible();
+    await expect(text(p, '.trust-chip')).toHaveText(['Encrypted on this device', 'Non-custodial']);
     // The terms line and both CTAs are unhidden by the page's one vault read: idle is after it (fix round 1).
     await expect(p.locator('#wel-terms')).toBeVisible();
     await expect(p.locator('#wel-terms')).toHaveText('By continuing you agree to the Terms and Privacy Policy.');
```

The store screenshots refuse "stage price" and the word "stage" (E23, review 1 M10). Decided: both — after this task no store-build screen shows a true "stage" (measured on the built `dist-nopresale/chrome`: the only `stage` strings left in its UI bundle are the valuation basis `'stage'` — four literals, compared, never shown — and `Status.tsx`'s class names `stage-label` / `stage-sub`; the BIP-39 wordlist's "stage" is in the vault page's bundle and never shown as a line), so the broader `/\bstages?\b/i` costs nothing and catches the presale's "Stage 2 of 10" too. The planted control asserts each by name:

```diff
diff --git a/extension/e2e/storeScreenshots.spec.ts b/extension/e2e/storeScreenshots.spec.ts
index af3885c..9683591 100644
--- a/extension/e2e/storeScreenshots.spec.ts
+++ b/extension/e2e/storeScreenshots.spec.ts
@@ -59,8 +59,12 @@ const PAYMENT: RawIx = {
   ],
   data: [2, 0, 0, 0, ...u64le(250_000_000n)],
 };
-/** Text no store screenshot may show: anything presale, and the failure lines a broken state draws. */
-const REFUSED_TEXT = [/presale/i, /couldn.t|could not/i, /offline/i, /not answering/i, /went wrong/i];
+/**
+ * Text no store screenshot may show: anything presale — "stage price" and the presale's "stage" too (E23: the NOC row
+ * says "estimate · not in total"; no true "stage" is shown in the store build: Status's are class names) — and the
+ * failure lines a broken state draws.
+ */
+const REFUSED_TEXT = [/presale/i, /stage price/i, /\bstages?\b/i, /couldn.t|could not/i, /offline/i, /not answering/i, /went wrong/i];
 
 /** What the TGE-date gate and REFUSED_TEXT find in the page's rendered text — the one reading both the states and the control use. */
 async function textProblems(page: Page, name: string): Promise<string[]> {
@@ -151,6 +155,13 @@ test('the five store screenshots, 1280 × 800, from the store build', async () =
       await control.setContent(`<p>${line}</p>`);
       expect((await textProblems(control, 'control')).length, `"${line}" is caught`).toBe(1);
     }
+    // E23: the old NOC line is refused twice over (its "stage price" and its "stage"); the presale's stage line once.
+    await control.setContent('<p>$630.42</p><p>at stage price</p>');
+    expect(await textProblems(control, 'control')).toEqual(['control: shows /stage price/i', 'control: shows /\\bstages?\\b/i']);
+    await control.setContent('<p>Stage 2 of 10</p>');
+    expect(await textProblems(control, 'control')).toEqual(['control: shows /\\bstages?\\b/i']);
+    await control.setContent('<p>$630.42</p><p>estimate · not in total</p>');
+    expect(await textProblems(control, 'control')).toEqual([]);
     await control.setContent('<p>12.4836 SOL</p>');
     expect(await textProblems(control, 'control')).toEqual([]);
     await control.close();
```

- [ ] **Step 7: The gate runs per build.**

```diff
diff --git a/extension/package.json b/extension/package.json
index a238ee0..a1b9b4c 100644
--- a/extension/package.json
+++ b/extension/package.json
@@ -14,7 +14,7 @@
     "csp": "node scripts/check-csp.mjs dist/app && node scripts/check-csp.mjs dist-nopresale/app",
     "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && test -d dist-nopresale/app && test -d dist-nopresale/chrome && test -d dist-nopresale/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox dist-nopresale/app dist-nopresale/chrome dist-nopresale/firefox",
     "gates": "npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build && node scripts/check-no-presale.mjs dist-nopresale dist",
-    "gates:build": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs && node scripts/check-links.mjs && node scripts/check-licences.mjs",
+    "gates:build": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs && node scripts/check-links.mjs && node scripts/check-licences.mjs && node scripts/check-ui-claims.mjs",
     "reproducible": "node scripts/verify-reproducible.mjs",
     "verify": "rm -rf dist dist-nopresale && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
   },
```

- [ ] **Step 8: Run it — green.**

Run: `TZ=UTC npx vitest run` over the same eleven files → `Test Files  11 passed (11)` · `Tests  228 passed (228)`.
Run: `node scripts/check-ui-claims.mjs` (after `npm run build`) → `ui claims ok (dist): 40 built HTML / JS files of chrome/ and firefox/, no claim the privacy policy contradicts (17 allowances used)`; `NOCTURA_DIST=dist-nopresale node scripts/check-ui-claims.mjs` → `ui claims ok (dist-nopresale): 40 built HTML / JS files of chrome/ and firefox/, no claim the privacy policy contradicts (17 allowances used)` (all 17 built-tier allowances used in each build: the seven source sentences reach both bundles, the ten library / `../core` texts are in both).

- [ ] **Step 9: Whole suite.**

Run (in `extension/`): `npx tsc --noEmit; echo $?` → `0`. `TZ=UTC npx vitest run` → `Test Files  247 passed (247)` · `Tests  5450 passed | 1 skipped (5451)` (the base's 245 / 5433, measured on 55383f4, + `claims.test.mjs`' 9 + `check-ui-claims.test.mjs`' 8; storeTexts and privacy keep their counts). `TZ=UTC npx vitest run --config vitest.nopresale.config.ts` → `Test Files  22 passed (22)` · `Tests  550 passed | 25 skipped (575)` (unchanged: the guard and the list read files, the same in both runs, and are not in `NOPRESALE_TESTS`; both builds' code is under `src/` and both built packages are read by the gate). `npm run build` → exit 0 (both builds). `npm run gates` → exit 0, each line as on the base plus `ui claims ok (dist): …` and `ui claims ok (dist-nopresale): …` (above); `no TGE date (dist present): 746 source and built files checked`, `no TGE date (dist-nopresale present): 746 source and built files checked`. `npm run csp` → `CSP ok: dist/app needs no unsafe-inline or unsafe-eval` / `CSP ok: dist-nopresale/app needs no unsafe-inline or unsafe-eval`. `npm run secrets` → exit 0. `npm run reproducible` → exit 0:
```
reproducible: presale chrome 28 files sha256:8771d0680f47c8c65dfee8410b1575723665b577334d76fef9fa3c839afd105a
reproducible: presale firefox 28 files sha256:f5c5c445259dd65d46291345af0f5ac78bcb47edd667bc1ac37b4c3936b39e86
reproducible: no-presale chrome 28 files sha256:99fa0f0242928f3ceedbb392e765fe699b73d3af9f40d36c25b6f2f17681a3dc
reproducible: no-presale firefox 28 files sha256:4c8fcc213acc263c762044e431adcd8602ed435d489a0989b003d774304b4c98
```
(the manifests, `unlock.html` and the app bundle changed, so every digest moves). Repo root: `node scripts/check-no-tge-date.mjs` → `No TGE date in 1402 tracked text files` (the four new files tracked). The escaped-character check over the task's added lines (Global Constraints' command, `git diff 55383f4 -- extension core`) → `0`; and `git diff 55383f4 -- extension core | grep '^+' | grep -cP '[\x{2010}\x{2011}]'` → `0` (the look-alike hyphens U+2010 / U+2011 are not in that command's class — the dry run's editor had typed both raw into a pattern and a test string; every one is a `\u` escape now; the other non-ASCII characters added are visible punctuation: § · – — ‘ ’ “ ” … ≈).

- [ ] **Step 10: The E2E, the visual pass, and the store screenshots.**

Run: `npx playwright test e2e/onboarding.spec.ts e2e/visual-vault.spec.ts e2e/visual-b1e.spec.ts e2e/links.spec.ts e2e/visual.spec.ts e2e/wallet.spec.ts e2e/send.spec.ts e2e/visual-send.spec.ts` (the specs that open #1, #8, #39, #11 home, #40 and #43 — found by `grep -l "mode=import\|imp-phrase\|fg-foot\|Choose a token\|wallet.html"`, plus the link spec) → `29 passed (12.0m)`; under `unshare -rn sh -c 'ip link set lo up && npx playwright test <the same eight>'` → `29 passed (12.9m)` (both detached, polled for the end marker).
Run: `npm run build && npm run screenshots` → `✓ 1 e2e/storeScreenshots.spec.ts:139:1 › the five store screenshots, 1280 × 800, from the store build (19.8s)` · `1 passed (23.0s)`; under `unshare -rn sh -c 'ip link set lo up && npm run screenshots'` → `1 passed (20.2s)`.

Read the visual specs' images (`test-results/visual/`, 412 wide) and the store screenshots (`release/screenshots/out/`, 1280 × 800):
- `01-welcome-idle.png` (#1): the tagline on two centred lines, "A non-custodial Solana wallet. Your keys / stay on this device."; the chips "Encrypted on this device" then "Non-custodial" on one row — as rev 1.
- `08-phrase-idle.png` (#8): the banner on five lines under the field, "This phrase is also the root of the Noctura phone / app's keys — anyone who gets it from this browser / gets those too. Accounts after the first one exist / only in this extension until the phone app supports / more than one account." — shorter than before, nothing else moved.
- `39-step-1-card-end.png` (#39): the footer on three lines above the sticky bar — as rev 1 (the spec's own geometry assertion passes).
- `43-default.png` (#43): the NOC row's value "$150.10 (estimate)" on one line, right-aligned under "1,000.00".
- Store shot 4 (`4-wallet-tab.png`): the NOC row's second line "estimate · not in total" right-aligned under "$0.00", one line, the row's height unchanged. Store shot 1 (`1-home.png`, the popup): the NOC row is cut by the tab bar, as before — its second line is in the page text (the check reads `innerText`, SM1) but not in the picture. #11's own visual (`11-loaded.png`, 412 × 600) and #40's (`40-single-account.png`, no NOC held) show no NOC value line — the unit tests carry those two.

- [ ] **Step 11: Named mutations.**

Each in a fresh `git archive` copy of the commit (`node_modules` linked), `npx tsc --noEmit` → `0` first (every mutant below compiled; none INVALID), then the named tests (CT = `claims.test.mjs`, UC = `check-ui-claims.test.mjs`, ST = `storeTexts.test.mjs`, PR = `privacy.test.mjs`). A pattern "never matches" is `/(?!)/i` (or `/(?!)/ || re(…)` for the three built with `re`, which also drops the `i` flag — so CT's flags row goes red with them).

| # | Mutation | tsc | Result |
|---|---|---|---|
| N-confidential | `CLAIMS.confidential` never matches | 0 | RED `2 failed \| 7 passed (9)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it” |
| N-transit | `CLAIMS["encrypted in transit"]` never matches | 0 | RED `2 failed \| 16 passed (18)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “privacy.md makes no claim the build does not keep: scripts/claims.mjs on its policy tier…” |
| N-incognito | `CLAIMS.incognito` never matches | 0 | RED `2 failed \| 7 passed (9)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it” |
| N-hidden | `CLAIMS.hidden` never matches | 0 | RED `2 failed \| 7 passed (9)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it” |
| N-we-dont-see | `CLAIMS["we don't see"]` never matches (`(?!)` prefixed) | 0 | RED `4 failed \| 27 passed (31)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…”; “refuses each old sentence, by the claim it makes; passes each new one” |
| N-never-receive | `CLAIMS["never receive"]` never matches | 0 | RED `3 failed \| 6 passed (9)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it”; “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …” |
| N-never-leave | `CLAIMS["never leave"]` never matches | 0 | RED `4 failed \| 19 passed (23)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it”; “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| N-nothing-widened | `CLAIMS["nothing leaves"]` back to rev 1 (`nothing (ever) leaves` only) | 0 | RED `2 failed \| 7 passed (9)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it” |
| N-stays | `CLAIMS["stays on this device"]` never matches | 0 | RED `6 failed \| 26 passed (32)` — “its claims, in order; each pattern case-insensitive and not global (a /g pattern would c…”; “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it”; “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…”; “privacy.md makes no claim the build does not keep: scripts/claims.mjs on its policy tier…” |
| N-only-on | `CLAIMS["only on this device"]` never matches | 0 | RED `4 failed \| 5 passed (9)` — “its claims, in order; each pattern case-insensitive and not global (a /g pattern would c…”; “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it”; “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …” |
| N-local-only | `CLAIMS["local-only"]` never matches | 0 | RED `4 failed \| 19 passed (23)` — “its claims, in order; each pattern case-insensitive and not global (a /g pattern would c…”; “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| N-offline | `CLAIMS.offline` never matches | 0 | RED `2 failed \| 21 passed (23)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| N-no-server | `CLAIMS["no server"]` never matches | 0 | RED `2 failed \| 7 passed (9)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it” |
| N-no-tracking | `CLAIMS["no tracking"]` never matches | 0 | RED `3 failed \| 20 passed (23)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| N-bank | `CLAIMS["bank-grade"]` never matches | 0 | RED `3 failed \| 20 passed (23)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| N-no-one-widened | `CLAIMS["no one can see"]` back to rev 1 (`no one can see` only) | 0 | RED `2 failed \| 7 passed (9)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim”; “the blind spots review 1 named (I3), each refused by the claim that reads it” |
| N-private-prefix | `CLAIMS.private` back to rev 1 (`\bprivate\b`: "privately" passes) | 0 | RED `1 failed \| 22 passed (23)` — “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| N-privacy-url | `CLAIMS.privacy` without the `(?<!\/)` URL-path exception | 0 | RED `2 failed \| 15 passed (17)` — “names and true states pass on every tier: private key(s), the Privacy Policy, its URL an…”; “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…” |
| N-flags-global | `CLAIMS.shielded` gets the `g` flag | 0 | RED `2 failed \| 7 passed (9)` — “its claims, in order; each pattern case-insensitive and not global (a /g pattern would c…”; “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …” |
| A-footer | #39's allowance listed on no tier | 0 | RED `3 failed \| 14 passed (17)` — “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …”; “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “refuses each old sentence, by the claim it makes; passes each new one” |
| A-banner | #8's new-banner allowance listed on no tier | 0 | RED `3 failed \| 14 passed (17)` — “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …”; “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “refuses each old sentence, by the claim it makes; passes each new one” |
| A-P13 | P13 allowance listed on no tier | 0 | RED `3 failed \| 29 passed (32)` — “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…”; “privacy.md makes no claim the build does not keep: scripts/claims.mjs on its policy tier…” |
| A-R4 | R4 allowance listed on no tier | 0 | RED `2 failed \| 16 passed (18)` — “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …”; “privacy.md makes no claim the build does not keep: scripts/claims.mjs on its policy tier…” |
| A-help-recv | help.md's "never receives them" allowance listed on no tier | 0 | RED `2 failed \| 21 passed (23)` — “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| A-listing | listing.md's allowance text changed (`.` → `!`) | 0 | RED `1 failed \| 13 passed (14)` — “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| A-P11-source | P11 allowance also listed on `source` | 0 | RED `1 failed \| 8 passed (9)` — “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …” |
| A-keep-private | `'keep it private.'` → `'keep it private!'` | 0 | RED `2 failed \| 15 passed (17)` — “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “reports a source allowance no source file uses (a stale entry); a built-only allowance a…” |
| T-ignore-tier | `claimViolations` applies every allowance on every tier (rev 1) | 0 | RED `3 failed \| 28 passed (31)` — “each allowance holds a claim (else it is not needed), passes on each tier it lists, and …”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…”; “reports a source allowance no source file uses (a stale entry); a built-only allowance a…” |
| T-unused-any | `unusedAllowances` ignores the tier | 0 | RED `5 failed \| 35 passed (40)` — “reports an allowance no text used (a stale entry), per tier; refuses a tier it does not …”; “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “reports a source allowance no source file uses (a stale entry); a built-only allowance a…”; “privacy.md makes no claim the build does not keep: scripts/claims.mjs on its policy tier…”; “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| T-no-throw | `claimViolations` accepts an unknown tier | 0 | RED `1 failed \| 8 passed (9)` — “reports an allowance no text used (a stale entry), per tier; refuses a tier it does not …” |
| T-store-as-source | storeTexts reads its texts on `tier: 'source'` | 0 | RED `1 failed \| 13 passed (14)` — “no claim the build does not keep, in all four texts — controls: each planted word is cau…” |
| T-policy-as-store | privacy.test reads privacy.md on `tier: 'store'` | 0 | RED `1 failed \| 8 passed (9)` — “privacy.md makes no claim the build does not keep: scripts/claims.mjs on its policy tier…” |
| R-single-quote | `htmlUnits`: single-quoted values not read | 0 | RED `1 failed \| 7 passed (8)` — “HTML: text between tags, visible attributes in all three quotings; comments, <script>, <…” |
| R-unquoted | `htmlUnits`: unquoted values not read | 0 | RED `1 failed \| 7 passed (8)` — “HTML: text between tags, visible attributes in all three quotings; comments, <script>, <…” |
| R-value-attr | `value` dropped from `VISIBLE_ATTRS` | 0 | RED `1 failed \| 7 passed (8)` — “HTML: text between tags, visible attributes in all three quotings; comments, <script>, <…” |
| R-jsx | `scriptUnits`: JSX text not read | 0 | RED `3 failed \| 5 passed (8)` — “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “reports a source allowance no source file uses (a stale entry); a built-only allowance a…”; “TS / TSX: string literals, template literals (`${}` for each interpolation) and JSX text…” |
| R-comments | `htmlUnits`: the comment removal dropped | 0 | RED `2 failed \| 6 passed (8)` — “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “HTML: text between tags, visible attributes in all three quotings; comments, <script>, <…” |
| R-licenses | `builtUnits`: the `licenses.html` skip removed | 0 | RED `1 failed \| 7 passed (8)` — “built packages: every .html and .js file, licenses.html skipped by name” |
| R-collapse | `claimViolations`: whitespace not collapsed | 0 | RED `1 failed \| 8 passed (9)` — “an allowance removes exactly its own words: the same word elsewhere in the unit is still…” |
| R-allow-clears | `claimViolations`: an allowance clears the whole unit | 0 | RED `1 failed \| 8 passed (9)` — “an allowance removes exactly its own words: the same word elsewhere in the unit is still…” |
| R-end-to-end-dash | `DASH` back to `[\s\-]` | 0 | RED `1 failed \| 8 passed (9)` — “refuses every claim on its own, on every tier: a planted sentence each, exactly that claim” |
| M4-skip-presale | `sourceUnits` skips `src/app/presale/` | 0 | RED `1 failed \| 7 passed (8)` — “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…” |
| C-tagline | `unlock.html`: #1's tagline back | 0 | RED `4 failed \| 11 passed (15)` — “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “reads #1's tagline and chip, #39's footer and #8's banner as they are now — and the four…”; “reports a source allowance no source file uses (a stale entry); a built-only allowance a…”; “idle: the wordmark, the tagline and two trust chips as B1e-2 Task 6 rewrote them (no "ZK…” |
| C-chip | `unlock.html`: the chip back to "E2E encrypted" | 0 | RED `3 failed \| 12 passed (15)` — “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “reads #1's tagline and chip, #39's footer and #8's banner as they are now — and the four…”; “idle: the wordmark, the tagline and two trust chips as B1e-2 Task 6 rewrote them (no "ZK…” |
| C-footer | `unlock.html`: #39's footer back | 0 | RED `4 failed \| 45 passed (49)` — “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “reads #1's tagline and chip, #39's footer and #8's banner as they are now — and the four…”; “reports a source allowance no source file uses (a stale entry); a built-only allowance a…”; “step 1: the adapted copy, card 1 highlighted, the footer; [Restore from seed] → step 2 (…” |
| C-banner | `unlock.html`: #8's banner back (E24) | 0 | RED `3 failed \| 45 passed (48)` — “reads the real files — the HTML entries and src/ without tests — and finds no refused cl…”; “reads #1's tagline and chip, #39's footer and #8's banner as they are now — and the four…”; “phrase idle: the title, lede, placeholder and the D8 banner; no backup file, no segmente…” |
| C-listing | `listing.md`: Summary back to "Noctura wallet for Solana." | 0 | RED `2 failed \| 20 passed (22)` — “both browsers carry one description: at most 132 characters, and no refused claim”; “listing: name and summary are the manifest's (CWS reads the summary from it), at most 13…” |
| C-manifest | `source.mjs`: `description` back to "Noctura wallet for Solana." | 0 | RED `2 failed \| 20 passed (22)` — “listing: name and summary are the manifest's (CWS reads the summary from it), at most 13…”; “both browsers carry one description: at most 132 characters, and no refused claim” |
| E-home | `Home.tsx`: back to "at stage price" | 0 | RED `1 failed \| 36 passed (37)` — “loaded: the market total, SOL and NOC under it, one row per held token; NOC at the stage…” |
| E-tokensheet | `TokenSheet.tsx`: back to " at stage price" | 0 | RED `2 failed \| 35 passed (37)` — “four rows — name, symbol, balance, value; the NOC value marked an estimate (E23); the cu…”; “#43 from the chip: "Choose a token", four rows with balances and the NOC value "(estimat…” |
| E-imported | `Imported.tsx`: back to " at stage price" | 0 | RED `1 failed \| 25 passed (26)` — “single account: "Wallet imported", the market total and ≈ SOL, a row per token held (the…” |
| G1 | the gate over a copy of `dist-nopresale` with `;var zz="Your activity stays on this device.";` appended to `chrome/assets/approve-*.js` | — | exit 1: `dist-nopresale/chrome/assets/approve-bsI_aAqX.js: "stays on this device" in “Your activity stays on this device.”` (control G0, the unplanted copy: exit 0, `ui claims ok (dist-nopresale): … (17 allowances used)`) |
| G2 | the gate over a copy with `<span title='No tracking'></span>` (single-quoted) in `chrome/unlock.html` | — | exit 1: `dist-nopresale/chrome/unlock.html [attribute]: "no tracking" in “No tracking”` |
| G3 | the gate over a copy with both `background.js` removed | — | exit 1: `allowance not used by any built text: “Access to shielded features is unavailable in your jurisdiction.”` and the other two `core/geo` messages |
| G4 | the gate over a copy with `firefox/` removed | — | exit 1: `INCONCLUSIVE: dist-nopresale/firefox is missing` |
| G5 | the gate over a copy with #39's footer's "this device" → "this browser" in both `unlock.html` (the allowance no longer matches) | — | exit 1: `dist-nopresale/chrome/unlock.html: "never leave" in “Your recovery phrase and password never leave this browser. …”` and the same for `firefox/` |
| SM1 | `Home.tsx` back to "at stage price", the store build rebuilt, `npm run screenshots` | 0 | `1 failed`: `+ "1-home: shows /stage price/i"`, `+ "1-home: shows /\\bstages?\\b/i"` (the first state's text check, before any capture) |
| SM2 | `REFUSED_TEXT` without `/stage price/i` (the repository's `dist-nopresale` copied in) | 0 | `1 failed`: the control — `- "control: shows /stage price/i",` |
| SM3 | `REFUSED_TEXT` without `/\bstages?\b/i` | 0 | `1 failed`: the control — `- "control: shows /\\bstages?\\b/i",` |

51 test mutations + 5 gate rows (G0 its control) + 3 screenshot rows = 59, every one compiling where it is code and every one red. (Dry run: first on the commit before the escapes were fixed, `71d213d`, where N-bank's edit did not match its raw-hyphen text — the finding that led to Step 9's U+2010 / U+2011 check; then all 51 again on `ac181aa`, quoted above.)

Not mutated: `package.json`'s `gates:build` wiring (no test reads the script line; `npm run gates`' two `ui claims ok` lines in Step 9 are its evidence); the test titles (M11's rename is a title).

- [ ] **Step 12: Commit.**

```bash
git add extension/scripts/claims.mjs extension/scripts/check-ui-claims.mjs extension/scripts/__tests__/claims.test.mjs extension/scripts/__tests__/check-ui-claims.test.mjs extension/scripts/__tests__/storeTexts.test.mjs extension/scripts/__tests__/privacy.test.mjs extension/unlock.html extension/src/app/screens/Home.tsx extension/src/app/screens/TokenSheet.tsx extension/src/app/screens/Imported.tsx extension/src/app/valuation.ts extension/manifest/source.mjs extension/release/listing.md extension/package.json extension/src/unlock/__tests__/welcome.test.ts extension/src/unlock/__tests__/restore.test.ts extension/src/unlock/__tests__/import.test.ts extension/src/app/__tests__/Home.test.tsx extension/src/app/__tests__/TokenSheet.test.tsx extension/src/app/__tests__/Send.test.tsx extension/src/app/__tests__/Imported.test.tsx extension/e2e/onboarding.spec.ts extension/e2e/visual-vault.spec.ts extension/e2e/storeScreenshots.spec.ts
git commit -m "fix(extension): B1e-2 Task 6 — #1's tagline and chip, #39's footer, #8's banner and the NOC row's wording say nothing the privacy policy contradicts and nothing presale; the store summary is the manifest description; one claims list (scripts/claims.mjs, allowances by tier) read by the UI-claims guard (source test, built-package gate), the store texts and the privacy policy" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
(Dry run: `ac181aa` on `dry/b1e2-r2`, on 55383f4. Rev 1 was `2739ffd` on `dry/b1e2`, cherry-picked first — it applied without a conflict on T3' / T4' (neither touched its files) — then rebuilt into this one commit.)

#### Notes for the executor (Task 6)

- **Rev 2 (Fable review 1: I3, M4, M11; owner E23, E24).** What changed from rev 1, each with its control:
  - **I3 — one claims list, `scripts/claims.mjs`** (not `release/`: its `.mjs` files are read by gates that refuse some strings). The guard, `storeTexts.test.mjs` and `privacy.test.mjs` all import it (`claims.test.mjs`' last row reads the three import lines); storeTexts keeps TGE and the date forms as its own addition, privacy keeps "private only in private keys". The union of rev 1's three lists (14 + 9 + 5 patterns, which disagreed: "confidential" and "encrypted in transit" were the policy's only, "bank / military-grade" the store's only, "never see" / "offline-only" / "nothing leaves" the guard's only) plus the review's blind spots: "never leave(s)/left" (any subject), "we / Noctura / the coordinator / our servers don't · do not · cannot · won't · never see · know · receive · store · log · track …", "never receive(s) · get(s) · store(s) · log(s) · track(s) · share(s) · sell(s) · know(s)", "nothing is sent / shared / stored / logged …", "no one knows / sees / can tell …", "stay(s) / remain(s) / kept on/in this device · browser · extension …", "stays local", "only / solely on/in this device …", "local-only", "fully local", "works / stays / fully offline", "offline wallet / signing / keys", "air-gapped", "cold storage", "confidential", "is / are / stays hidden", "hidden from", "incognito", "no server(s) / backend / cloud", "serverless", "no tracking / logs", "not tracked / logged" — 28 claims, each with a planted sentence that is refused by exactly that claim on every tier, and the review's own examples as a second row. The `private` pattern is now the store's prefix form (`privately` refused); `privacy` takes the store's name exceptions (the URL path, the contact address, `privacy.md`), so rev 1's URL allowance is gone. Every pattern's flags are exactly `i` (a `g` would carry `lastIndex` between units — a row and a mutation).
  - **Tiers.** Each allowance lists the tiers it is true on — `source` (the HTML entries and `src/`), `built` (the packages: the source's words plus the bundled `../core` and libraries, so a screen's sentence lists `source` and `built`), `store` (terms, help, listing, data-usage), `policy` (privacy.md) — and `claimViolations` applies only those (rev 1 applied every allowance to every unit, so a `built` allowance silenced its words in `src/`). A missing tier throws. `claims.test.mjs` proves, for each of the 26 allowances, that its words hold a claim (refused with no allowances — the negative control), that it passes on each tier it lists (the positive control) and that it is refused on every other tier; the real-text rows (UC source, ST four texts, PR privacy.md, the gate per build) prove each one is still needed (an unused allowance fails).
  - **The new allowances, each with its verdict:** the source/built sentences "A non-custodial Solana wallet. Your keys stay on this device." (#1), "your keys stay on this device." (#38 About), "Your recovery phrase and password never leave this device." (#39), "Accounts after the first one exist only in this extension until the phone app supports more than one account." (#8 — "only in this extension" is now read; R10); the store/policy P11, P12's "Noctura never receives it.", P13's first sentence; the policy's R12 "the lookup never leaves the server", R4 "It never records the request's parameters, your IP address or your headers." and P16's "Questions about privacy:"; the store's help.md "and Noctura never receives them, so Noctura cannot give them back to you.", terms.md "Noctura never receives them, never holds your funds" and listing.md's "Your keys stay on this device. The recovery phrase and keys are stored in this browser, encrypted with your password; Noctura never receives them." Rev 1's #8 allowance ("… future private (shielded) keys") is removed (E24). Per tier: source 7, built 17, store 6, policy 6 (26 entries).
  - **Quoting.** The guard reads an HTML attribute in all three forms (double-quoted, single-quoted, unquoted), and `value` (a button's label) and the `aria-description` / `aria-placeholder` / `aria-roledescription` / `aria-valuetext` attributes besides rev 1's four; a planted `title='…'`, `aria-label=…` and `value="…"` row, and a `class="private"` / `data-x='shielded'` that must NOT be read.
  - **The limit** is stated where it is read — `claims.mjs`' header, the guard's header, "The rule" above — and as a rev 2.7 line: text built at run time from pieces, from data, or in CSS is not read as a sentence; the list is a review aid, not a proof (the same words §4.3 uses for the link gate).
  - **M4:** `SOURCE.files.length === 234` → the file list equals an independent `readdirSync(…, {recursive: true})` listing, plus a floor of 200 (Step 3). Control: M4-skip-presale (the reader skips `src/app/presale/`) is red; a file added under `src/` changes both lists.
  - **M11:** `welcome.test.ts`' title "idle: the design's copy, two trust chips …" → "idle: the wordmark, the tagline and two trust chips as B1e-2 Task 6 rewrote them …".
  - **E23:** verified true before the change — `valuation.ts` builds the market list with `noc: null` and `marketTotalUsd` (`core/portfolio/value.ts:84–88`) sums only `basis === 'market'`, so NOC's value is never in a total: #11 home's total (`Home.tsx:292–294`), #40's "Total value recovered" (`Imported.tsx:245–264`), the account switcher's and accounts manager's per-account totals (`Switcher.tsx:73`, `AccountsManager.tsx:51`, `:186`) and #37's (`DeleteWallet.tsx:131`) all read `valuation(…).total`. "estimate" is true: the figure is the balance × the presale stage price read from `/stats`, which `core/portfolio/value.ts`' header calls "a statement the market has never made" — an estimate, not a market value. The words showed in three places, not two: Home (`:438`), TokenSheet (`:55`) and **#40 import success (`Imported.tsx:279`)** — all three changed (R9). Nowhere in `release/` (help.md included) says "stage". The store screenshot check refuses `/stage price/i` and `/\bstages?\b/i` (Step 6, with its planted control; SM1–SM3).
  - **E24 (extension half):** #8's banner as the controller wrote it; rev 1's allowance for the old banner removed; the old banner is a refused row in UC ("private" and "shielded").
- **Rulings (the controller's to confirm):**
  - **R1 (rev 1, kept) — #39's footer: the controller's second sentence was untrue on #39's path; replaced.** #39 ("Forgot password?") leads to `unlock.html?mode=import&source=forgot` → `createRestoreRun` (`src/unlock/screens/restoreRun.ts:50`), whose seed proof is `proveSeed` (`src/unlock/forgetFlow.ts:65`, "Local only; nothing is sent") — no `probeCandidates` / `wallet.probeBalances` runs (that is #8's ordinary import, P4), so nothing is "found"; the addresses reach the coordinator once the wallet is open, to read balances (P3). Hence "To read your balances, your accounts' public addresses are sent to the Noctura coordinator."
  - **R2 (rev 1) — the old footer was false in two of its three claims;** dropped whole. Rev 2's list finds a third ("We never see" is also "we don't see").
  - **R3 (rev 1) — "Encrypted on this device" is true of the vault** (the phrase and keys in `v1_vault`, AES-GCM under an Argon2id / passkey-PRF key); `storage.local`'s phrase key, grants and contacts are not encrypted (P13 says "stored only in this browser"). A chip next to "Non-custodial" reads as the keys — true.
  - **R4 (rev 1) — the summary is a real sentence and the manifest's `description`** (108 ≤ 132), the spec's single-purpose statement with "A non-custodial".
  - **R5 (rev 1) — the guard reads what is shown,** not raw text: the TypeScript parser's literals, templates and JSX text; HTML text and visible attributes. Comments ("a private copy", "never leaves") and identifiers are not read. String literals that are not shown (class names, message types) are read too — none holds a refused word (the real-files row).
  - **R6 — allowances are exact sentences with verdicts and tiers, and a stale one fails** (above).
  - **R7 (rev 1) — the source tier is not in `NOPRESALE_TESTS`;** **R8 (rev 1) — the built tier is a gate, not a test** (a test reading `dist*/` would fail on a clean checkout before a build).
  - **R9 — #40's NOC value says " (estimate)" too** (writer's, D27). The controller named Home and TokenSheet; `Imported.tsx:279` showed the same " at stage price" inline after the value, the TokenSheet form, so it takes the TokenSheet suffix. #40 shows a total above the rows, so "not in total" would also be true there; not added (the controller's inline form is the suffix alone). Cost if the owner wants it: one string and one test row.
  - **R10 — "only in this extension" is read.** The `stays on this device` / `only on this device` claims count "extension" as a place, so #8's new banner's second sentence needs an allowance (true: the phone app derives one account; R10's verdict). Not counting "extension" would have let "Your data stays only in this extension" through.
  - **R11 — "offline" is read as a claim only in its claim forms** ("works / stays / fully offline", "offline wallet …", "air-gapped", "cold storage") and "hidden" only as "is / are / stays hidden", "hidden from", "hides your" — the bare words name true states here ("You're offline", "What you can still do offline:", "24 words. Written offline.", "balance hidden") and class names; a bare-word pattern would need a dozen allowances for true text. The names row passes each of those on every tier.
  - **R12 — the planted-sentence row asserts exactly one claim per sentence,** so the 28 claims stay distinct; overlaps are deliberate where a sentence makes two claims ("We never receive" = "we don't see" + "never receive"; "We never see" = "never see" + "we don't see"), asserted in the blind-spots row.
- **The sweep (every hit, with its verdict).** All four tiers read by the list (Step 8's green is the sweep's evidence: zero violations, every allowance used):

  | Where | Text | Verdict |
  |---|---|---|
  | `unlock.html:37` #1 | "A Solana wallet built for private, non-custodial holding." | **false — fixed** (the wallet is transparent; P3–P6) |
  | `unlock.html:40` #1 chip | "E2E encrypted" | **false — fixed** |
  | `unlock.html:465` #39 `fg-foot` | "The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address." | **false — fixed** (P3; R1, R2) |
  | `unlock.html:301` #8 banner | "… the Noctura phone app's future private (shielded) keys …" | **changed — E24** |
  | `Home.tsx:438`, `TokenSheet.tsx:55`, `Imported.tsx:279` | "at stage price" | **changed — E23** (true, but presale wording) |
  | `unlock.html:37`, `About.tsx:58` | "… Your keys stay on this device." | true — P11 (allowed, source + built) |
  | `unlock.html:465` #39 (new) | "Your recovery phrase and password never leave this device." | true — P11 (allowed) |
  | `unlock.html:301` #8 (new) | "Accounts after the first one exist only in this extension until …" | true (allowed, R10) |
  | `unlock.html:100`, `src/unlock/strings.ts:38` | "Move to a private place. …" | true — advice (allowed) |
  | `unlock.html:792`, `:821` | "… — keep it private." | true — advice (allowed) |
  | `src/approve/strings.ts:45` #47 | "${short} · cannot see your seed or private key" | true (allowed) |
  | `Home.tsx:405` #42 | "… Receiving works — your address is on this device. …" | true, not refused (no "stays" / "only") |
  | `Home.tsx`, `Activity.tsx`, `TxDetail.tsx`, `Review.tsx` | "You're offline", "What you can still do offline:" | true — not a claim form (R11) |
  | `unlock.html:84` #2 | "24 words. Written offline. …" | true — advice, not a claim form |
  | `src/app/presale/text.ts` | "… so it can't receive a referral bonus" | true — not refused (subject is the address) |
  | `Stuck.tsx:42` | "This transaction is no longer tracked." | true — not refused |
  | `src/background/dapp/decode/decode.ts` | `confidentialTransferMint` … (Token-2022 extension names) | identifiers in strings — not refused (`\bconfidential\b`) |
  | built `background.js` (both builds) | `core/geo/classify.ts`'s three "shielded features" messages | never shown (allowed, built only); flagged: a later screen that shows `message` would make them visible |
  | built bundles | tslib "Private …" TypeErrors, BIP-39 "prison private prize", React's `<anonymous>` | never shown (allowed, built only) |
  | `release/help.md`, `terms.md`, `listing.md` | "Noctura never receives them …", P11, P12, P13, "Your keys stay on this device." | true (allowed, store) |
  | `release/privacy.md` | P11, P12, P13, R4, R12, P16's "Questions about privacy:" | true (allowed, policy) |
  | comments (`deps.ts`, `walletApi.ts`, `envelope.ts`, `forgetFlow.ts` …) | "never leaves", "nothing is sent", "a private copy" | comments — not shown, not read |

  Left as is, true and flagged: `REAUTH.feeReason['pre-tge']` "No Noctura fee before TGE" (the word, no date; storeTexts refuses "TGE" in the store texts, the UI guard does not).
- **Copy written or changed by this task (D27, for the owner):** the tagline "A non-custodial Solana wallet. Your keys stay on this device." and the chip "Encrypted on this device" (controller's); #39's footer "Your recovery phrase and password never leave this device. To read your balances, your accounts' public addresses are sent to the Noctura coordinator." (controller's, its purpose clause corrected — R1); #8's banner "This phrase is also the root of the Noctura phone app's keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account." (controller's, E24); the NOC row "estimate · not in total" (#11) and " (estimate)" (#43) (controller's, E23); " (estimate)" on #40 (writer's, R9); the store summary / manifest `description` "A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites." (writer's, rev 1).
- **For the owner / the controller — found, not changed:**
  - **The web wallet** (`web/src/portfolio/PortfolioPanel.tsx:66`) still says " at stage price" (and `web/src/styles/design-system.css:904`'s comment calls it what makes the figure honest). E23 says "everywhere it shows"; the web wallet is outside this plan (it is the presale's own site). Offer a one-line change there if the owner means it too.
  - **The phone app** (`src/screens/onboarding/WelcomeScreen.tsx:94`, `:99`) — E24's phone half, on the shield-copy branch (`fix/shield-privacy-copy`, already carrying `aaeeee1`).
  - The design (`index.html` #1, #8, #39, the NOC row) still draws the old copy: the owner's file to update, if wanted.
- **What the next task must know:** see Interfaces. Task 7's rev 2.7 list takes the lines below. Task 5's part names "Task 6's checklist" — read "Task 7's".

#### Spec rev 2.7 lines (Task 6)

- §9 / design departure: #1's tagline is "A non-custodial Solana wallet. Your keys stay on this device." and its first trust chip "Encrypted on this device" (the design: "A Solana wallet built for private, non-custodial holding." and "E2E encrypted"); #39's footer is "Your recovery phrase and password never leave this device. To read your balances, your accounts' public addresses are sent to the Noctura coordinator." (the design: "The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address."); #8's banner is "This phrase is also the root of the Noctura phone app's keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account." (E24; the design named the phone app's "future private (shielded) keys") — each old line a claim the privacy policy contradicts (P3) or the transparent build does not keep. Words only; layout, classes and icons as drawn.
- §9 / design departure (E23): the NOC token row's secondary line is "estimate · not in total" on #11 home and the value's suffix " (estimate)" on #43 and #40 (the design and B1b: "at stage price") — NOC's figure is the balance at the presale stage price, never in a total; no presale wording in the store build.
- §6.4 listing: the short description = the manifest's `description` = "A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana sites." (108 characters; was "Noctura wallet for Solana.").
- §6.4 screenshots: the store screenshots' text check also refuses "stage price" and the word "stage" (E23).
- §6.4 / §10 (one claims list, a new gate): `scripts/claims.mjs` is the one list of claims the extension does not keep (28: private, privacy, anonymous, untraceable, unlinkable, confidential, end-to-end / E2E, encrypted in transit, zero-knowledge, shielded, incognito, hidden, never see, can't see, no one can see / knows, we don't see / know / receive …, never receive(s), never leave(s), nothing leaves / is sent, stays on this device / local, only on this device, local-only, offline-only, works offline …, no server, no tracking / logs, bank- / military-grade — "private key(s)", "Privacy Policy", its URL path and the contact address excepted), with true sentences allowed by their exact words, each with a verdict and the tiers it holds on (source, built, store, policy), a stale allowance failing; read by `scripts/check-ui-claims.mjs` in `gates:build` (both builds: every built HTML / JS text of `chrome/` and `firefox/`, attributes in any quoting), its source tier in `scripts/__tests__/check-ui-claims.test.mjs` (the HTML entries and `src/` without tests, by the TypeScript parser), and by the store texts' and the privacy policy's tests (`storeTexts.test.mjs` adds "TGE" and its date forms).
- §6.4 / §10 (the limit, I3): the claims list is a word list — a review aid, not a proof: it reads each literal, template piece, JSX text and HTML text unit alone, so a sentence assembled at run time from pieces, text from data (token names, a site's strings, the coordinator's answers) and CSS `content:` are not read as sentences.


### Task 7: `npm run release:chrome`, the RP-ID record and the owner's checklist — `scripts/release-chrome.mjs`, a pure orchestrator (`runRelease(steps)`) over steps built on an injected io (`releaseSteps(io)`): a preflight (no `NODE_ENV`, a clean tree, this version not packed yet, the lockfile present), the live pre-check (E26), then spec §5.1's six steps in order — `npm run verify`; the third witness (`node scripts/build.mjs <tmp> --no-presale`, its `chrome/` digest equal to verify's `dist-nopresale/chrome`; a `build-manifest.json` in the package refused); `release/rp-id.json` exactly E17's record and equal to `passkey.ts`'s `RP_ID`; the final live check (15 s per request, no skip flag); the STORE zip twice, one sha256, read back and bound one for one to the witnessed files; the tree re-checked, then the zip (git-ignored `release/out/`) and `release/notes-<version>.md` written under `.partial` names and moved into place only when both are — each refusal stopping everything after it; every command run without `NODE_ENV`, and `build.mjs` refusing one other than `production`; `--dev-key` refused anywhere under `dist*/`; `release/rp-id.json` committed (E17) and pinned by `rpId.test.ts`; `release/checklist.md` (§7 adapted to what was built, E25's ICO gate, §5.5's evidence as run); the spec's rev 2.7 change list

**Spec:** B1e §5.1 (the six steps, in order; R10: verify's own `dist-nopresale/chrome` is packed, a third build witnesses it), §5.3 (`--dev-key` never into `dist/` or `dist-nopresale/`), §5.5 ("no existing users" — evidence recorded in the checklist), §5.6 (E17: the pre-upload gate `{rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'}` equal to `RP_ID`; `rpId.test.ts` adds `RP_ID` = `rp-id.json`'s; E25: nothing served at the name), §6.5 (the live check part of `release:chrome` only; E26: twice, three GETs each, one at a time, no retry), §7 (the owner's checklist, steps 1–7), §10 ("No test contacts `*.noc-tura.io`; only the release script's live check does"; `presaleBuilds.test.mjs` builds with `NODE_ENV` removed). The brief's row 6 (numbered 7 since the copy task became Task 6), the controller's rulings (rp-id.json committed by this task from E17, the owner re-confirms at §7 step 3; the live check has no skip flag) and the plan's Fable review 1: C1, I1, I2 (→ E25), I5, M1, M2, M3 (→ E26), M6, M7. **Not here:** publishing the pages (ICO), ICO's E25 confirmation, the upload and every dashboard step (the owner), `store-key.json` (§7 step 7, after the first upload). **No real `release:chrome` run in this revision** — rev 1's single sanctioned run (Step 7) stands; the order is proved by the tests.

**Files:**
- Create: `extension/scripts/release-chrome.mjs` (the orchestrator, the steps, the real io, the CLI), `extension/release/rp-id.json`, `extension/release/checklist.md`
- Create (tests): `extension/scripts/__tests__/release-chrome.test.mjs` (77)
- Modify: `extension/scripts/build.mjs` (Task 1's file: the `NODE_ENV` refusal, review C1; `--dev-key` refused under `dist*/`, review M2), `extension/package.json` (`"release:chrome": "node scripts/release-chrome.mjs"`), `extension/.gitignore` (`release/out/`), `docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md` (rev 2.7)
- Modify (tests): `extension/src/vault/__tests__/rpId.test.ts` (3 → 4), `extension/scripts/__tests__/storeKey.test.mjs` (Task 1's file: the dev-key refusal's new wording, 2 rows added)
- No build output changes: `build.mjs`'s two edits refuse before building and change nothing a build writes; `scripts/`, `release/` and `docs/` are not bundled — the reproducible digests are the base tree's (Step 4).

**Interfaces:**
- Consumes: `packageVersion` (`manifest/source.mjs`, Task 1); `zipStore`, `zipFiles` (`scripts/zip-store.mjs`, Task 2 — `zipFiles` by the test only); `readStoreZip` (`scripts/__tests__/storeZipReader.mjs`, Task 2 — the independent, import-free reader; the release reads its own zip back with it, so the writer never checks itself); `liveCheck` (`scripts/live-check.mjs`, Tasks 3–4 — `await liveCheck({fetch})` → `{ok, problems}`, no default fetch, never throws for a page's failure; `LIVE_PAGES`, `CONTACT`); `PRIVACY_SENTENCES` (`release/privacySentences.mjs`, Task 3 — the test's fixture pages); `buildManifest`, `MANIFEST_NAME` (`web/scripts/build-manifest.mjs` → `{files, digest}`; it skips a root-level `build-manifest.json`; its CLI has `--print-only`); `isMain` (`scripts/isMain.mjs`); `RP_ID` (`src/vault/passkey.ts`, test only — the script reads the file as text). Task 4's `listing.md` / `data-usage.md`, Task 5's `npm run screenshots` and its five names, Task 1's dev-key sentence and `store-key.json` format, Task 6's `description` and the NOC row's "estimate · not in total" — named by the checklist.
- Produces (`extension/scripts/release-chrome.mjs`):
  ```js
  export const STEPS: readonly ['preflight', 'livePrecheck', 'verify', 'witness', 'rpId', 'liveCheck', 'zip', 'write'];
  export const PACKAGE: 'dist-nopresale/chrome';
  export const RP_ID_FILE: 'release/rp-id.json';
  export const RP_ID_SOURCE: 'src/vault/passkey.ts';
  export const LOCKFILE: 'package-lock.json';
  export const RP_ID_RECORD: Readonly<{rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'}>;
  export const OUT_DIR: 'release/out';
  export const LIVE_TIMEOUT_MS: 15000;
  export const USAGE: string;                                    // 'usage: npm run release:chrome (no arguments — …)'
  export function zipPath(version: string): string;              // 'release/out/noctura-chrome-<version>.zip'
  export function notesPath(version: string): string;            // 'release/notes-<version>.md'
  export function partialPath(path: string): string;             // '<path>.partial'
  export function cliProblem(argv: string[]): string | null;     // null iff no argument at all
  export function childEnv(env: Record<string, string>): Record<string, string>;  // env without NODE_ENV
  export function nodeEnvProblem(value: string): string;
  export function readRpId(text: string): string;                // the one plain `export const RP_ID = '<host>';` line; else throws
  export function rpIdProblems(value: unknown, rpId: string): string[];  // [] iff exactly RP_ID_RECORD and rpId === value.rpId
  export function treeProblems(porcelain: string): string[];     // [] iff empty
  export function zipWitnessProblems(entries: {path, sha256}[], witnessed: {path, sha256}[]): string[];  // [] iff one for one
  export function timedFetch(fetch, ms): (url, init) => Promise<Response>;  // adds signal: AbortSignal.timeout(ms)
  export function releaseNotes(o: {version, sha256, bytes, entries, digest, files, commit, lockfile, node}): string;
  export function releaseSteps(io: Io): Record<typeof STEPS[number], (done) => Promise<{problems: string[], value?, line?, written?: string[]}>>;
  export async function runRelease(steps, log?: (line: string) => void): Promise<{ok: true, zip, notes, sha256} | {ok: false, stoppedAt, problems, written?: string[]}>;
  export function refusalLines(result): string[];               // "nothing was written" only when `written` is empty
  export function realIo(root?: string): Io;
  //   Io = {version, node, env, run(cmd, args) → exit status (env without NODE_ENV), git(args) → stdout, tempDir(), removeDir(dir),
  //         digest(dir) → {files, digest}, exists(path), read(path) → string | undefined, hashFile(path) → hex | undefined,
  //         fetch (timed), zip(dir) → Buffer, write(path, bytes) (mkdir -p, flag 'wx'), place(from, to) (hard link + unlink:
  //         never over a file), remove(path)}
  // CLI: `npm run release:chrome` = `node scripts/release-chrome.mjs`, no argument (any → USAGE, exit 2). Each passed step prints
  //   `release: <step> ok — <line>`; a refusal prints refusalLines (exit 1); success prints
  //   `release: done — <zip>, sha256 <hex>; <notes> is for the owner to commit`.
  ```
- Produces (`extension/scripts/build.mjs`, Task 1's): throws before anything else when `NODE_ENV` is set to anything but `production` (`NODE_ENV is "<v>" — build.mjs builds only with no NODE_ENV or NODE_ENV=production (B1e §5.1): …`); `--dev-key` refuses an `outRoot` equal to or under `dist/` or `dist-nopresale/` (the message now says "never dist/, dist-nopresale/ or anything under them").
- Produces (`extension/release/rp-id.json`): exactly `{"rpId": "wallet.noc-tura.io", "confirmedBy": "owner", "decision": "E17"}` + newline.
- **What later work relies on:** the owner's §7 (`release/checklist.md`): E25's ICO gate, no `NODE_ENV`, then `npm ci --ignore-scripts && npm run release:chrome` in a clean `extension/`; the zip `release/out/noctura-chrome-1.0.0.zip` (upload, not committed) and `release/notes-1.0.0.md` (commit). A later version bumps `extension/package.json` (the preflight refuses a second pack of one version). A change of the RP ID is refused by the gate as long as `RP_ID_RECORD` says E17's host — by design (§5.6: frozen). Anything that runs `build.mjs` from a test must remove vitest's `NODE_ENV=test` (as `presaleBuilds.test.mjs` and `storeKey.test.mjs` already do) or the build refuses.

**The rule, stated once.** Nothing is packed unless everything the release depends on held in this run, in this order, on this commit: no `NODE_ENV` and a clean tree (the notes name a commit and "NODE_ENV: unset" — untracked files count), the three published pages live before anything is built and again before packing, `verify` green, a third build that agrees with the package `verify` checked, the owner's RP-ID record equal both to E17 and to the code, two zips that are one, and that one — read back from its own bytes — holding exactly the witnessed files. The first step that refuses stops the run; nothing is written before the last step, which first checks the tree did not move under the run, writes under temporary names, moves both into place only when both are written, never overwrites, and says exactly what it left if it fails part-way. There is no flag that skips anything: the CLI takes no argument. The orchestrator reaches the world only through its io, so the order and every refusal are proved without running verify, building or touching the network.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/release-chrome.test.mjs`:

```js
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  LIVE_TIMEOUT_MS,
  LOCKFILE,
  OUT_DIR,
  PACKAGE,
  RP_ID_FILE,
  RP_ID_RECORD,
  RP_ID_SOURCE,
  STEPS,
  childEnv,
  cliProblem,
  notesPath,
  partialPath,
  readRpId,
  realIo,
  refusalLines,
  releaseNotes,
  releaseSteps,
  rpIdProblems,
  runRelease,
  timedFetch,
  treeProblems,
  zipPath,
  zipWitnessProblems,
} from '../release-chrome.mjs';
import {CONTACT, LIVE_PAGES} from '../live-check.mjs';
import {zipFiles} from '../zip-store.mjs';
import {PRIVACY_SENTENCES} from '../../release/privacySentences.mjs';
import {RP_ID} from '../../src/vault/passkey';

// B1e §5.1, §5.6, §6.5: `npm run release:chrome` — the orchestrator and its steps, offline. Every step's world is an
// injected io (a recorder): no test runs `npm run verify`, builds, zips the real package, writes outside a temp dir or
// reaches the network. globalThis.fetch is replaced by a recorder that throws, for every test, and must stay unused.
// Two rows spawn a real process: realIo's run (a one-line `node -e`) and build.mjs refusing a NODE_ENV — which it does
// before anything is built.

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PASSKEY_TS = readFileSync(join(ROOT, RP_ID_SOURCE), 'utf8');
const RP_ID_JSON = readFileSync(join(ROOT, RP_ID_FILE), 'utf8');
const COMMIT = 'c0ffee'.padEnd(40, '0');
const DIGEST = 'd'.repeat(64);
const LOCK_SHA = '1'.repeat(64);
const sha256 = b => createHash('sha256').update(b).digest('hex');
const byPath = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
/** The package as the fake io sees it: 28 files, and a real §5.4 zip of exactly them (Task 2's writer). */
const PACKED = Array.from({length: 28}, (_, i) => ({path: `f${i}`, bytes: Buffer.from(`file ${i}\n`)})).sort(byPath);
const FILES = PACKED.map(f => ({path: f.path, sha256: sha256(f.bytes)}));
const ZIP = zipFiles(PACKED);

let globalCalls;
let realFetch;
beforeEach(() => {
  globalCalls = [];
  realFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    globalCalls.push(String(url));
    throw new Error('the global fetch is not to be used');
  };
});
afterEach(() => {
  globalThis.fetch = realFetch;
  expect(globalCalls).toEqual([]);
});

const pageHtml = page =>
  page.sentences
    ? `<h1>${page.title}</h1>${PRIVACY_SENTENCES.map(s => `<p>${s.text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')}`
    : `<h1>${page.title.replace(/&/g, '&amp;')}</h1><p>${CONTACT}</p>`;
const live = async url => ({status: 200, headers: {get: () => null}, text: async () => pageHtml(LIVE_PAGES.find(p => p.url === url))});
const notFound = async () => ({status: 404, headers: {get: () => null}, text: async () => 'Not Found'});

/**
 * A recording io in which every step passes (the positive control); `over` (an object, or a function of `calls` and
 * `written`) replaces any member. `calls` lists, in order, every effect a step asked for: a command run, a git question,
 * a digest, a GET, a zip, a write, a move into place, a removal. `written` is the file system the run left.
 */
function fakeIo(over = {}) {
  const calls = [];
  const written = new Map();
  const io = {
    version: '1.0.0',
    node: 'v22.12.0',
    env: {},
    run: (cmd, args) => {
      calls.push(`run ${cmd} ${args.join(' ')}`);
      return 0;
    },
    git: args => {
      calls.push(`git ${args.join(' ')}`);
      return args[0] === 'rev-parse' ? `${COMMIT}\n` : '';
    },
    tempDir: () => {
      calls.push('tempDir');
      return '/tmp/witness';
    },
    removeDir: dir => calls.push(`removeDir ${dir}`),
    digest: dir => {
      calls.push(`digest ${dir}`);
      return {files: FILES, digest: DIGEST};
    },
    exists: path => written.has(path),
    read: path => (path === RP_ID_FILE ? RP_ID_JSON : path === RP_ID_SOURCE ? PASSKEY_TS : undefined),
    hashFile: path => (path === LOCKFILE ? LOCK_SHA : undefined),
    fetch: async (url, init) => {
      calls.push(`GET ${url}`);
      expect(init).toMatchObject({method: 'GET', redirect: 'manual'});
      return live(url);
    },
    zip: dir => {
      calls.push(`zip ${dir}`);
      return Buffer.from(ZIP);
    },
    write: (path, bytes) => {
      calls.push(`write ${path}`);
      written.set(path, Buffer.from(bytes));
    },
    place: (from, to) => {
      calls.push(`place ${from} ${to}`);
      written.set(to, written.get(from));
      written.delete(from);
    },
    remove: path => {
      calls.push(`remove ${path}`);
      written.delete(path);
    },
    ...(typeof over === 'function' ? over(calls, written) : over),
  };
  return {io, calls, written};
}

const release = async (over, log = () => {}) => {
  const f = fakeIo(over);
  const result = await runRelease(releaseSteps(f.io), log);
  return {...f, result};
};

const GETS = LIVE_PAGES.map(p => `GET ${p.url}`);
const [ZIP_PATH, NOTES_PATH] = [zipPath('1.0.0'), notesPath('1.0.0')];
const EVERYTHING = [
  'git status --porcelain',
  'git rev-parse HEAD',
  ...GETS,
  'run npm run verify',
  'tempDir',
  'run node scripts/build.mjs /tmp/witness --no-presale',
  'digest /tmp/witness/chrome',
  `digest ${PACKAGE}`,
  'removeDir /tmp/witness',
  ...GETS,
  `zip ${PACKAGE}`,
  `zip ${PACKAGE}`,
  `digest ${PACKAGE}`,
  'git status --porcelain',
  'git rev-parse HEAD',
  `write ${partialPath(ZIP_PATH)}`,
  `write ${partialPath(NOTES_PATH)}`,
  `place ${partialPath(ZIP_PATH)} ${ZIP_PATH}`,
  `place ${partialPath(NOTES_PATH)} ${NOTES_PATH}`,
];
/** The calls up to and including the `nth` (1-based) one matching `last` — what a run that refuses there may have done. */
const upTo = (last, nth = 1) => {
  let seen = 0;
  return EVERYTHING.slice(0, EVERYTHING.findIndex(c => c.startsWith(last) && (seen += 1) === nth) + 1);
};

describe('release:chrome — the order (B1e §5.1, E26)', () => {
  it('is §5.1 in order, after a preflight and the live pre-check: verify, the third witness, the RP-ID record, the live check, the zip twice, the write', () => {
    expect(STEPS).toEqual(['preflight', 'livePrecheck', 'verify', 'witness', 'rpId', 'liveCheck', 'zip', 'write']);
  });

  it('runs every step in that order, and each sees what the ones before it produced', async () => {
    const seen = [];
    const steps = Object.fromEntries(
      STEPS.map(name => [
        name,
        async done => {
          seen.push([name, Object.keys(done)]);
          return {problems: [], value: name.toUpperCase()};
        },
      ]),
    );
    const result = await runRelease(steps, () => {});
    expect(result).toMatchObject({ok: true});
    expect(seen).toEqual(STEPS.map((name, i) => [name, STEPS.slice(0, i)]));
  });

  it.each(STEPS.map((name, i) => [name, i]))('a refusal at %s stops everything after it (and a throw is a refusal)', async (failing, i) => {
    for (const how of ['problems', 'throw']) {
      const ran = [];
      const steps = Object.fromEntries(
        STEPS.map(name => [
          name,
          async () => {
            ran.push(name);
            if (name !== failing) return {problems: []};
            if (how === 'throw') throw new Error('boom');
            return {problems: ['no']};
          },
        ]),
      );
      const result = await runRelease(steps, () => {});
      expect(ran).toEqual(STEPS.slice(0, i + 1));
      expect(result).toEqual({ok: false, stoppedAt: failing, problems: [how === 'throw' ? `${failing}: boom` : 'no']});
    }
  });

  it('refuses a missing step and a step that answers nothing usable, before running anything after it', async () => {
    const steps = Object.fromEntries(STEPS.map(name => [name, async () => ({problems: []})]));
    await expect(runRelease({...steps, liveCheck: undefined}, () => {})).resolves.toEqual({
      ok: false,
      stoppedAt: 'liveCheck',
      problems: ['liveCheck: no such step'],
    });
    await expect(runRelease({...steps, rpId: async () => undefined}, () => {})).resolves.toEqual({
      ok: false,
      stoppedAt: 'rpId',
      problems: ['rpId: answered no problem list'],
    });
  });

  it('the live check runs twice: three GETs before verify (nothing built yet), three after the RP-ID record — six per run', async () => {
    const {calls} = await release({});
    const gets = calls.map((c, i) => [c, i]).filter(([c]) => c.startsWith('GET '));
    expect(gets.map(([c]) => c)).toEqual([...GETS, ...GETS]);
    const verify = calls.indexOf('run npm run verify');
    const witnessed = calls.indexOf('removeDir /tmp/witness');
    expect(gets.slice(0, 3).every(([, i]) => i < verify)).toBe(true);
    expect(gets.slice(3).every(([, i]) => i > witnessed && i < calls.indexOf(`zip ${PACKAGE}`))).toBe(true);
  });
});

describe('release:chrome — the steps over an injected io (positive control)', () => {
  it('all green: every effect in order, the zip and the notes written last, nothing else left', async () => {
    const lines = [];
    const {result, calls, written} = await release({}, line => lines.push(line));
    expect(result).toMatchObject({ok: true, zip: ZIP_PATH, notes: NOTES_PATH, sha256: sha256(ZIP)});
    expect(calls).toEqual(EVERYTHING);
    expect([...written.keys()]).toEqual([ZIP_PATH, NOTES_PATH]);
    expect(written.get(ZIP_PATH).equals(ZIP)).toBe(true);
    expect(lines).toEqual(STEPS.map(s => expect.stringMatching(new RegExp(`^release: ${s} ok`))));
    expect(lines[0]).toBe(`release: preflight ok — version 1.0.0, commit ${COMMIT}, working tree clean, NODE_ENV unset`);
    expect(lines[6]).toBe(`release: zip ok — ${ZIP.length} bytes, 28 entries (each a witnessed file, path and sha256), sha256 ${sha256(ZIP)}, twice`);
  });

  it('the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe', async () => {
    const {written} = await release({});
    const notes = written.get(NOTES_PATH).toString('utf8');
    expect(notes).toBe(
      releaseNotes({
        version: '1.0.0',
        sha256: sha256(ZIP),
        bytes: ZIP.length,
        entries: 28,
        digest: DIGEST,
        files: 28,
        commit: COMMIT,
        lockfile: LOCK_SHA,
        node: 'v22.12.0',
      }),
    );
    for (const want of [
      '# Noctura for Chrome 1.0.0 — release notes',
      '- Version: 1.0.0',
      `- Zip: \`${ZIP_PATH}\` (${ZIP.length} bytes, 28 entries, not committed)`,
      `- Zip sha256: \`${sha256(ZIP)}\``,
      `- Package file digest: \`sha256:${DIGEST}\` (28 files of \`extension/${PACKAGE}\`, web/scripts/build-manifest.mjs;`,
      '  each zip entry is one of these files, its path and sha256 compared)',
      `- Commit: \`${COMMIT}\`, working tree clean`,
      `- Lockfile: \`extension/package-lock.json\` sha256 \`${LOCK_SHA}\` (installed with \`npm ci --ignore-scripts\`)`,
      '- NODE_ENV: unset',
      '- Passkey RP ID: wallet.noc-tura.io (release/rp-id.json, E17)',
      '- Node: v22.12.0',
      'To reproduce: check out the commit, then `cd extension && npm ci --ignore-scripts && env -u NODE_ENV npm run build`.',
      '`node ../web/scripts/build-manifest.mjs dist-nopresale/chrome --print-only` prints the same file count and package',
      '`node scripts/zip-store.mjs dist-nopresale/chrome <out.zip>` prints 28 entries and the same sha256.',
    ])
      expect(notes).toContain(want);
    // The recipe never installs with lifecycle scripts, and never runs the manifest CLI in its writing mode.
    expect(notes).not.toMatch(/npm ci(?! --ignore-scripts)/);
    expect(notes).not.toMatch(/build-manifest\.mjs dist-nopresale\/chrome(?! --print-only)`/);
  });

  it('the zip and notes paths: the zip under the git-ignored release/out/, the notes beside the other release texts', () => {
    expect(OUT_DIR).toBe('release/out');
    expect(ZIP_PATH).toBe('release/out/noctura-chrome-1.0.0.zip');
    expect(NOTES_PATH).toBe('release/notes-1.0.0.md');
    expect(partialPath(NOTES_PATH)).toBe('release/notes-1.0.0.md.partial');
    expect(readFileSync(join(ROOT, '.gitignore'), 'utf8').split('\n')).toContain('release/out/');
  });
});

describe('release:chrome — each refusal stops before anything is written (negative controls)', () => {
  it.each([['development'], ['test'], ['production'], ['']])('NODE_ENV=%j in the environment: refused at the preflight, nothing run, no GET', async value => {
    const {result, calls, written} = await release({env: {NODE_ENV: value, PATH: '/usr/bin'}});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: [
        `NODE_ENV is set (to ${JSON.stringify(value)}) — the store build is made with none: Vite keeps a NODE_ENV it finds, and development or test builds React's development bundle, which verify, the third witness and the zip would all agree on. Any value is refused, production included: the notes record "NODE_ENV: unset", one condition a reproducer can meet. Run \`env -u NODE_ENV npm run release:chrome\`, or unset it.`,
      ],
    });
    expect(calls).toEqual(upTo('git rev-parse'));
    expect(written.size).toBe(0);
  });

  it('a dirty working tree: refused before verify, the paths named as the repository root has them', async () => {
    const {result, calls, written} = await release({
      git: args => (args[0] === 'rev-parse' ? `${COMMIT}\n` : ' M extension/src/app/App.tsx\n?? extension/stray.ts\n'),
    });
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: [
        'the working tree is not clean — the notes would name a commit that is not what was packed (git status --porcelain; the paths are relative to the repository root, not to extension/):',
        '   M extension/src/app/App.tsx',
        '  ?? extension/stray.ts',
      ],
    });
    expect(calls.some(c => c.startsWith('run') || c.startsWith('GET'))).toBe(false);
    expect(written.size).toBe(0);
  });

  it.each([ZIP_PATH, NOTES_PATH])('%s already exists: refused before verify, never overwritten', async path => {
    const {result, calls, written} = await release({exists: p => p === path});
    expect(result.stoppedAt).toBe('preflight');
    expect(result.problems).toEqual([
      `${path} exists — version 1.0.0 was packed already: bump extension/package.json's version, or remove the file if that pack was abandoned`,
    ]);
    expect(calls.some(c => c.startsWith('run') || c.startsWith('GET'))).toBe(false);
    expect(written.size).toBe(0);
  });

  it('no lockfile: refused at the preflight (the notes record its sha256)', async () => {
    const {result} = await release({hashFile: () => undefined});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: ['package-lock.json is absent — the notes record the dependency set the zip is built from'],
    });
  });

  it('the live pre-check fails (a 404, as today): refused before verify — nothing built, every page asked once', async () => {
    const {result, calls, written} = await release(calls => ({
      fetch: async url => {
        calls.push(`GET ${url}`);
        return notFound();
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'livePrecheck',
      problems: LIVE_PAGES.map(p => `${p.name}: ${p.url} answered 404, want 200 — a redirect fails`),
    });
    expect(calls).toEqual(upTo(GETS[2]));
    expect(calls.some(c => c.startsWith('run'))).toBe(false);
    expect(written.size).toBe(0);
  });

  it('verify fails: nothing after it runs', async () => {
    const {result, calls, written} = await release(calls => ({
      run: (cmd, args) => {
        calls.push(`run ${cmd} ${args.join(' ')}`);
        return cmd === 'npm' ? 1 : 0;
      },
    }));
    expect(result).toEqual({ok: false, stoppedAt: 'verify', problems: ['npm run verify exited 1']});
    expect(calls).toEqual(upTo('run npm run verify'));
    expect(written.size).toBe(0);
  });

  it('a build-manifest.json in the package: refused at the witness, before the third build (the digest cannot see it, the zip would pack it)', async () => {
    const {result, calls, written} = await release({exists: p => p === `${PACKAGE}/build-manifest.json`});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'witness',
      problems: [
        `${PACKAGE}/build-manifest.json exists — the file digest skips that name, so the witness cannot see it and the zip would pack it; no build writes it (build-manifest.mjs run there without --print-only does): run verify again`,
      ],
    });
    expect(calls).toEqual(upTo('run npm run verify'));
    expect(written.size).toBe(0);
  });

  it('the third witness differs from verify’s package: refused before the RP-ID record, the live check and the zip', async () => {
    const other = 'f'.repeat(64);
    const {result, calls, written} = await release(calls => ({
      digest: dir => {
        calls.push(`digest ${dir}`);
        return {files: FILES, digest: dir === PACKAGE ? DIGEST : other};
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'witness',
      problems: [`the third build's chrome/ is sha256:${other}, verify's ${PACKAGE} is sha256:${DIGEST} — not the package verify checked`],
    });
    expect(calls).toEqual(upTo('removeDir'));
    expect(written.size).toBe(0);
  });

  it('the third build fails, or is empty: refused (the temp dir removed either way)', async () => {
    const failed = await release({run: cmd => (cmd === 'node' ? 2 : 0)});
    expect(failed.result).toEqual({
      ok: false,
      stoppedAt: 'witness',
      problems: ['the third build (node scripts/build.mjs /tmp/witness --no-presale) exited 2'],
    });
    expect(failed.calls.at(-1)).toBe('removeDir /tmp/witness');
    const empty = await release({digest: () => ({files: [], digest: DIGEST})});
    expect(empty.result).toEqual({
      ok: false,
      stoppedAt: 'witness',
      problems: [`INCONCLUSIVE: the third build's chrome/ or verify's ${PACKAGE} holds no file`],
    });
    expect(empty.written.size).toBe(0);
  });

  it.each([
    ['absent', undefined, [`${RP_ID_FILE} is absent — the owner's confirmation of the passkey RP ID (E17, B1e §5.6) is recorded before upload`]],
    ['not JSON', '{rpId:', [expect.stringMatching(new RegExp(`^${RP_ID_FILE} is not JSON \\(`))]],
  ])('the RP-ID record %s: refused before the final live check and the zip', async (_, text, problems) => {
    const {result, calls, written} = await release({read: p => (p === RP_ID_FILE ? text : PASSKEY_TS)});
    expect(result).toEqual({ok: false, stoppedAt: 'rpId', problems});
    expect(calls).toEqual(upTo('removeDir'));
    expect(written.size).toBe(0);
  });

  it('the RP-ID record names another host: refused before the final live check', async () => {
    const {result, calls} = await release({
      read: p => (p === RP_ID_FILE ? JSON.stringify({...RP_ID_RECORD, rpId: 'passkey.noc-tura.io'}) : PASSKEY_TS),
    });
    expect(result.stoppedAt).toBe('rpId');
    expect(result.problems).toEqual([
      `${RP_ID_FILE}: rpId is "passkey.noc-tura.io", want "wallet.noc-tura.io" (E17)`,
      `${RP_ID_FILE}: rpId is "passkey.noc-tura.io", but ${RP_ID_SOURCE} says RP_ID = "wallet.noc-tura.io"`,
    ]);
    expect(calls.filter(c => c.startsWith('GET'))).toEqual(GETS);
  });

  it('passkey.ts no longer says RP_ID plainly: refused (the reader fails closed)', async () => {
    const {result} = await release({read: p => (p === RP_ID_FILE ? RP_ID_JSON : 'export const RP_ID = "wallet.noc-tura.io";\n')});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'rpId',
      problems: [`${RP_ID_SOURCE}: no single plain \`export const RP_ID = '<host>';\` line — the RP ID cannot be read without a TypeScript loader`],
    });
  });

  it('the final live check fails (the pre-check passed, a page went down during verify): refused before the zip', async () => {
    let n = 0;
    const {result, calls, written} = await release(calls => ({
      fetch: async url => {
        calls.push(`GET ${url}`);
        n += 1;
        return n <= 3 || url !== LIVE_PAGES[1].url ? live(url) : notFound();
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'liveCheck',
      problems: [`${LIVE_PAGES[1].name}: ${LIVE_PAGES[1].url} answered 404, want 200 — a redirect fails`],
    });
    expect(calls).toEqual(upTo(GETS[2], 2));
    expect(written.size).toBe(0);
  });

  it('the two zips differ: refused, nothing written', async () => {
    let n = 0;
    const {result, calls, written} = await release(calls => ({
      zip: dir => {
        calls.push(`zip ${dir}`);
        n += 1;
        return Buffer.from(`PK ${n}`);
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'zip',
      problems: [`the two zips of ${PACKAGE} differ: sha256 ${sha256(Buffer.from('PK 1'))} vs ${sha256(Buffer.from('PK 2'))}`],
    });
    expect(calls.filter(c => c.startsWith('zip'))).toHaveLength(2);
    expect(written.size).toBe(0);
  });

  it.each([
    ['a 29th file the witness did not see (a build-manifest.json the digest skips)', [...PACKED, {path: 'build-manifest.json', bytes: Buffer.from('{}\n')}], ['  the zip holds build-manifest.json, which the witness did not see']],
    ['a witnessed file missing', PACKED.slice(1), [`  the witness saw ${PACKED[0].path}, which the zip does not hold`]],
    [
      'a file with other bytes',
      PACKED.map((f, i) => (i === 3 ? {path: f.path, bytes: Buffer.from('changed\n')} : f)),
      [`  the zip's ${PACKED[3].path} is sha256 ${sha256(Buffer.from('changed\n'))}, the witness saw ${FILES[3].sha256}`],
    ],
  ])('the zip, read back, is not the witnessed package — %s: refused at the zip, nothing written', async (_, files, unbound) => {
    const bytes = zipFiles([...files].sort(byPath));
    const {result, written} = await release({zip: () => Buffer.from(bytes)});
    expect(result).toEqual({ok: false, stoppedAt: 'zip', problems: ['the zip is not the package the witness saw:', ...unbound]});
    expect(written.size).toBe(0);
  });

  it('bytes that are no store zip: refused at the zip (the reader throws), nothing written', async () => {
    const {result, written} = await release({zip: () => Buffer.from('PK the same bytes twice')});
    expect(result).toEqual({ok: false, stoppedAt: 'zip', problems: ['zip: store zip: no end record']});
    expect(written.size).toBe(0);
  });

  it('the package digest after zipping must still be the witnessed one', async () => {
    let digests = 0;
    const {result, written} = await release({
      digest: () => {
        digests += 1;
        return {files: FILES, digest: digests === 3 ? 'a'.repeat(64) : DIGEST};
      },
    });
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'zip',
      problems: [`${PACKAGE} changed after the witness: sha256:${'a'.repeat(64)}, was sha256:${DIGEST}`],
    });
    expect(written.size).toBe(0);
  });

  it('the tree changed during the run (dirty, or another HEAD): refused at the write, nothing written', async () => {
    for (const [answer, problem] of [
      [args => (args[0] === 'rev-parse' ? `${COMMIT}\n` : '?? extension/new.ts\n'), 'the working tree is not clean'],
      [args => (args[0] === 'rev-parse' ? `${'b'.repeat(40)}\n` : ''), `HEAD moved during the run: ${COMMIT} → ${'b'.repeat(40)}`],
    ]) {
      let n = 0;
      const {result, written} = await release({git: args => ((n += 1) <= 2 ? (args[0] === 'rev-parse' ? `${COMMIT}\n` : '') : answer(args))});
      expect(result.stoppedAt).toBe('write');
      expect(result.problems[0]).toContain(problem);
      expect(written.size).toBe(0);
    }
  });

  it.each([ZIP_PATH, NOTES_PATH, partialPath(ZIP_PATH), partialPath(NOTES_PATH)])(
    '%s appears during the run: refused at the write, nothing written, nothing overwritten',
    async path => {
      let late = false;
      const {result, calls} = await release(calls => ({
        exists: p => late && p === path,
        zip: dir => {
          calls.push(`zip ${dir}`);
          late = true;
          return Buffer.from(ZIP);
        },
      }));
      expect(result).toEqual({
        ok: false,
        stoppedAt: 'write',
        problems: [`${path} exists — appeared during the run, or left by an earlier one; never overwritten`],
      });
      expect(calls.some(c => c.startsWith('write') || c.startsWith('place'))).toBe(false);
    },
  );

  it('a git answer that is no commit: refused at the preflight', async () => {
    const {result} = await release({git: args => (args[0] === 'rev-parse' ? 'fatal: not a git repository\n' : '')});
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'preflight',
      problems: ['git rev-parse HEAD answered "fatal: not a git repository" — no commit to record'],
    });
  });
});

describe('release:chrome — a write that fails part-way says what it left (review M1)', () => {
  it('the second file cannot be written: the first is removed, nothing is left, and the CLI says "nothing was written"', async () => {
    const {result, calls, written} = await release((calls, written) => ({
      write: (path, bytes) => {
        calls.push(`write ${path}`);
        if (path === partialPath(NOTES_PATH)) throw new Error('ENOSPC: no space left on device');
        written.set(path, Buffer.from(bytes));
      },
    }));
    expect(result).toEqual({ok: false, stoppedAt: 'write', problems: ['writing failed (ENOSPC: no space left on device)']});
    expect(calls.slice(-3)).toEqual([`write ${partialPath(ZIP_PATH)}`, `write ${partialPath(NOTES_PATH)}`, `remove ${partialPath(ZIP_PATH)}`]);
    expect(written.size).toBe(0);
    expect(refusalLines(result)).toEqual(['release: refused at write — nothing was written', '  writing failed (ENOSPC: no space left on device)']);
  });

  it('the notes cannot be moved into place after the zip was: the zip is named as left, and the CLI does not say "nothing was written"', async () => {
    const {result, written} = await release((calls, written) => ({
      place: (from, to) => {
        calls.push(`place ${from} ${to}`);
        if (to === NOTES_PATH) throw new Error(`EEXIST: file already exists, link '${from}' -> '${to}'`);
        written.set(to, written.get(from));
        written.delete(from);
      },
    }));
    expect(result).toEqual({
      ok: false,
      stoppedAt: 'write',
      problems: [`moving into place failed (EEXIST: file already exists, link '${partialPath(NOTES_PATH)}' -> '${NOTES_PATH}')`],
      written: [ZIP_PATH],
    });
    expect([...written.keys()]).toEqual([ZIP_PATH]);
    expect(refusalLines(result)[0]).toBe(`release: refused at write — the write failed part-way: remove ${ZIP_PATH} (in extension/) before running again`);
  });

  it('a temporary file that cannot be removed is named as left too', async () => {
    const {result} = await release((calls, written) => ({
      write: (path, bytes) => {
        if (path === partialPath(NOTES_PATH)) throw new Error('EIO');
        written.set(path, Buffer.from(bytes));
      },
      remove: () => {
        throw new Error('EACCES');
      },
    }));
    expect(result.written).toEqual([partialPath(ZIP_PATH)]);
    expect(refusalLines(result)[0]).toContain(`remove ${partialPath(ZIP_PATH)} (in extension/)`);
  });

  it('refusalLines: "nothing was written" for every refusal that left nothing', () => {
    expect(refusalLines({ok: false, stoppedAt: 'liveCheck', problems: ['a', 'b']})).toEqual(['release: refused at liveCheck — nothing was written', '  a', '  b']);
  });
});

describe('the zip bound to the witness (review I1)', () => {
  it('[] iff the same paths with the same hashes, one for one (positive control)', () => {
    expect(zipWitnessProblems(FILES, FILES)).toEqual([]);
    expect(zipWitnessProblems([...FILES].reverse(), FILES)).toEqual([]);
  });

  it('a repeated entry is refused even when every path and hash is a witnessed one', () => {
    expect(zipWitnessProblems([...FILES, FILES[0]], FILES)).toEqual(['the zip has 29 entries, the witness 28 files']);
  });
});

describe('NODE_ENV never reaches a command the release runs (review C1)', () => {
  it('childEnv drops NODE_ENV and nothing else', () => {
    expect(childEnv({NODE_ENV: 'development', PATH: '/bin', HOME: '/h'})).toEqual({PATH: '/bin', HOME: '/h'});
    expect(childEnv({PATH: '/bin'})).toEqual({PATH: '/bin'});
  });

  it('realIo.run: a child of this process (vitest sets NODE_ENV=test) sees no NODE_ENV — and would, without it', () => {
    expect(process.env.NODE_ENV).toBe('test');
    const probe = ['-e', 'process.exit(process.env.NODE_ENV === undefined ? 0 : 3)'];
    expect(spawnSync('node', probe).status).toBe(3);
    const root = mkdtempSync(join(tmpdir(), 'release-env-'));
    try {
      expect(realIo(root).run('node', probe)).toBe(0);
      expect(realIo(root).env).toBe(process.env);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });

  it.each([['development'], ['test'], ['']])('build.mjs refuses NODE_ENV=%j before anything else (two directories: the usage error never comes)', value => {
    const r = spawnSync('node', ['scripts/build.mjs', 'a', 'b'], {cwd: ROOT, encoding: 'utf8', env: {...childEnv(process.env), NODE_ENV: value}});
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain(`NODE_ENV is ${JSON.stringify(value)} — build.mjs builds only with no NODE_ENV or NODE_ENV=production (B1e §5.1)`);
    expect(r.stderr).not.toContain('usage: node scripts/build.mjs');
  });

  it.each([['unset', undefined], ['production', 'production']])('build.mjs lets NODE_ENV %s through (positive control: it stops at the usage error instead)', (_, value) => {
    const env = value === undefined ? childEnv(process.env) : {...childEnv(process.env), NODE_ENV: value};
    const r = spawnSync('node', ['scripts/build.mjs', 'a', 'b'], {cwd: ROOT, encoding: 'utf8', env});
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('usage: node scripts/build.mjs');
    expect(r.stderr).not.toContain('NODE_ENV is');
  });
});

describe('the RP-ID record (B1e §5.6, E17)', () => {
  it('reads RP_ID from passkey.ts without a TypeScript loader — the value the module exports (positive control)', () => {
    expect(readRpId(PASSKEY_TS)).toBe(RP_ID);
    expect(readRpId(PASSKEY_TS)).toBe('wallet.noc-tura.io');
  });

  it.each([
    ['double quotes', 'export const RP_ID = "wallet.noc-tura.io";'],
    ['a second declaration', "export const RP_ID = 'wallet.noc-tura.io';\nlet RP_ID = 'evil.example';"],
    ['a computed value', 'export const RP_ID = HOST;'],
    ['not exported', "const RP_ID = 'wallet.noc-tura.io';"],
    ['none', ''],
  ])('the reader refuses %s', (_, text) => {
    expect(() => readRpId(text)).toThrow(/no single plain/);
  });

  it('the committed release/rp-id.json passes the gate as it stands (positive control)', () => {
    expect(JSON.parse(RP_ID_JSON)).toEqual(RP_ID_RECORD);
    expect(rpIdProblems(JSON.parse(RP_ID_JSON), readRpId(PASSKEY_TS))).toEqual([]);
    expect(RP_ID_RECORD).toEqual({rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'});
  });

  it.each([
    ['an array', [], ['release/rp-id.json is not a JSON object']],
    ['null', null, ['release/rp-id.json is not a JSON object']],
    ['an extra field', {...RP_ID_RECORD, note: 'x'}, ['release/rp-id.json: fields are confirmedBy, decision, note, rpId — want exactly confirmedBy, decision, rpId']],
    ['a missing field', {rpId: 'wallet.noc-tura.io', decision: 'E17'}, ['release/rp-id.json: fields are decision, rpId — want exactly confirmedBy, decision, rpId', 'release/rp-id.json: confirmedBy is undefined, want "owner" (E17)']],
    ['confirmedBy someone else', {...RP_ID_RECORD, confirmedBy: 'Owner'}, ['release/rp-id.json: confirmedBy is "Owner", want "owner" (E17)']],
    ['another decision', {...RP_ID_RECORD, decision: 'E18'}, ['release/rp-id.json: decision is "E18", want "E17" (E17)']],
  ])('refuses %s', (_, value, problems) => {
    expect(rpIdProblems(value, 'wallet.noc-tura.io')).toEqual(problems);
  });

  it('refuses a record and a passkey.ts moved together to another host — 1.0.0 freezes the name, not just their agreement', () => {
    expect(rpIdProblems({...RP_ID_RECORD, rpId: 'keys.noc-tura.io'}, 'keys.noc-tura.io')).toEqual([
      'release/rp-id.json: rpId is "keys.noc-tura.io", want "wallet.noc-tura.io" (E17)',
    ]);
  });

  it('refuses a record that disagrees with passkey.ts', () => {
    expect(rpIdProblems(RP_ID_RECORD, 'passkey.noc-tura.io')).toEqual([
      'release/rp-id.json: rpId is "wallet.noc-tura.io", but src/vault/passkey.ts says RP_ID = "passkey.noc-tura.io"',
    ]);
  });
});

describe('the pieces', () => {
  it('treeProblems: an empty status is clean, anything else is listed', () => {
    expect(treeProblems('')).toEqual([]);
    expect(treeProblems('\n')).toEqual([]);
    expect(treeProblems('?? a\n')).toEqual([
      'the working tree is not clean — the notes would name a commit that is not what was packed (git status --porcelain; the paths are relative to the repository root, not to extension/):',
      '  ?? a',
    ]);
  });

  it('the live check’s fetch carries a timeout: the request is aborted after LIVE_TIMEOUT_MS', async () => {
    expect(LIVE_TIMEOUT_MS).toBe(15_000);
    const seen = [];
    const never = (url, init) => {
      seen.push(init);
      return new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    };
    await expect(timedFetch(never, 20)('https://example.invalid/', {method: 'GET', redirect: 'manual'})).rejects.toMatchObject({name: 'TimeoutError'});
    expect(seen[0]).toMatchObject({method: 'GET', redirect: 'manual'});
    expect(seen[0].signal).toBeInstanceOf(AbortSignal);
  });

  it('no skip flag: any argument is refused with the usage line', () => {
    expect(cliProblem([])).toBe(null);
    for (const argv of [['--skip-live-check'], ['--no-live'], ['--force'], ['x']])
      expect(cliProblem(argv)).toBe('usage: npm run release:chrome (no arguments — every step runs, the live check included; B1e §5.1, §6.5)');
  });

  it('realIo writes without overwriting, moves into place without overwriting, and reads an absent file as undefined (a temp root)', () => {
    const root = mkdtempSync(join(tmpdir(), 'release-io-'));
    try {
      const io = realIo(root);
      expect(io.read('release/rp-id.json')).toBeUndefined();
      expect(io.hashFile('package-lock.json')).toBeUndefined();
      expect(io.exists('release/out/a.zip')).toBe(false);
      io.write('release/out/a.zip', Buffer.from('one'));
      expect(io.exists('release/out/a.zip')).toBe(true);
      expect(() => io.write('release/out/a.zip', Buffer.from('two'))).toThrow(/EEXIST/);
      expect(readFileSync(join(root, 'release/out/a.zip'), 'utf8')).toBe('one');
      expect(io.hashFile('release/out/a.zip')).toBe(sha256(Buffer.from('one')));
      io.write('release/out/b.partial', Buffer.from('three'));
      expect(() => io.place('release/out/b.partial', 'release/out/a.zip')).toThrow(/EEXIST/);
      expect(readFileSync(join(root, 'release/out/a.zip'), 'utf8')).toBe('one');
      io.place('release/out/b.partial', 'release/out/b.zip');
      expect(existsSync(join(root, 'release/out/b.partial'))).toBe(false);
      expect(readFileSync(join(root, 'release/out/b.zip'), 'utf8')).toBe('three');
      writeFileSync(join(root, 'gone'), 'x');
      io.remove('gone');
      expect(existsSync(join(root, 'gone'))).toBe(false);
    } finally {
      rmSync(root, {recursive: true, force: true});
    }
  });
});
```

Modify `extension/src/vault/__tests__/rpId.test.ts` (the record's pin, read through Vite's JSON glob import as the file already reads `source.mjs` — tsc type-checks this file and `resolveJsonModule` is off):

```diff
diff --git a/extension/src/vault/__tests__/rpId.test.ts b/extension/src/vault/__tests__/rpId.test.ts
index 2408b18..77eea1e 100644
--- a/extension/src/vault/__tests__/rpId.test.ts
+++ b/extension/src/vault/__tests__/rpId.test.ts
@@ -15,6 +15,15 @@ const hostPermissions = (): string[] => {
   });
 };
 
+// B1e §5.6 (E17), B1e-2: the owner's record of the frozen RP ID, `release/rp-id.json` — the file release:chrome's
+// pre-upload gate reads (scripts/release-chrome.mjs `rpIdProblems`). Read here through Vite's JSON import; an absent file
+// leaves the glob empty, which the reader refuses rather than skips.
+const recorded = (): unknown => {
+  const files = Object.values(import.meta.glob('../../../release/rp-id.json', {eager: true, import: 'default'}));
+  if (files.length !== 1) throw new Error('release/rp-id.json is absent');
+  return files[0];
+};
+
 describe('the passkey RP ID (B1e §5.6)', () => {
   it('is wallet.noc-tura.io, frozen by 1.0.0 (E17)', () => {
     expect(RP_ID).toBe('wallet.noc-tura.io');
@@ -24,6 +33,11 @@ describe('the passkey RP ID (B1e §5.6)', () => {
     expect(hostPermissions()).toContain(`https://${RP_ID}/*`);
   });
 
+  it('equals the owner’s record: release/rp-id.json is exactly {rpId: RP_ID, confirmedBy: owner, decision: E17}', () => {
+    expect(recorded()).toEqual({rpId: RP_ID, confirmedBy: 'owner', decision: 'E17'});
+    expect(Object.keys(recorded() as object)).toEqual(['rpId', 'confirmedBy', 'decision']);
+  });
+
   it('the pin reads the real list (positive control): the coordinator’s permission is in it, an invented host is not', () => {
     expect(hostPermissions()).toContain('https://api.noc-tura.io/*');
     expect(hostPermissions()).not.toContain('https://passkey.noc-tura.io/*');
```

Modify `extension/scripts/__tests__/storeKey.test.mjs` (Task 1's file — review M2: the refusal's new wording, a row for directories under `dist*/`, and a sibling-name positive control that runs while `store-key.json` is absent, like the row below it):

```diff
diff --git a/extension/scripts/__tests__/storeKey.test.mjs b/extension/scripts/__tests__/storeKey.test.mjs
index 4f691b7..3d8169a 100644
--- a/extension/scripts/__tests__/storeKey.test.mjs
+++ b/extension/scripts/__tests__/storeKey.test.mjs
@@ -94,14 +94,31 @@ describe('the store key (B1e §5.3)', () => {
 
 // The build's side: --dev-key reads the fixed path before building anything, and writes only into a named directory.
 describe('build.mjs --dev-key (B1e §5.3)', () => {
+  const REFUSED = '--dev-key builds only into a directory named on the command line, never dist/, dist-nopresale/ or anything under them (B1e §5.3).';
   it('refuses without a directory, or with dist/ or dist-nopresale/, before reading the key or building', () => {
     for (const args of [['--dev-key'], ['--dev-key', '--no-presale'], ['dist', '--dev-key'], [join(ROOT, 'dist-nopresale'), '--dev-key', '--no-presale'], ['./dist/', '--dev-key']]) {
       const r = build(args);
       expect(r.status).not.toBe(0);
-      expect(r.stderr).toContain('--dev-key builds only into a directory named on the command line, never dist/ or dist-nopresale/ (B1e §5.3).');
+      expect(r.stderr).toContain(REFUSED);
     }
   });
 
+  it('refuses any directory under dist/ or dist-nopresale/ (B1e-2, review M2: a prefix test on the resolved path)', () => {
+    for (const args of [['dist-nopresale/chrome', '--dev-key', '--no-presale'], [join(ROOT, 'dist', 'a', 'b'), '--dev-key'], ['./dist-nopresale/chrome/../firefox', '--dev-key', '--no-presale']]) {
+      const r = build(args);
+      expect(r.status).not.toBe(0);
+      expect(r.stderr).toContain(REFUSED);
+    }
+  });
+
+  it.runIf(!existsSync(STORE_KEY_PATH))('a sibling whose name only starts like them is not refused by that rule (positive control: it stops at the absent key)', () => {
+    const r = build([join(ROOT, 'dist-nopresale-elsewhere'), '--dev-key', '--no-presale']);
+    expect(r.status).not.toBe(0);
+    expect(r.stderr).not.toContain(REFUSED);
+    expect(r.stderr).toContain(`${STORE_KEY_PATH}: absent`);
+    expect(existsSync(join(ROOT, 'dist-nopresale-elsewhere'))).toBe(false);
+  });
+
   it.runIf(!existsSync(STORE_KEY_PATH))('refuses while release/store-key.json is absent (until §7 step 7), and builds nothing', () => {
     const parent = mkdtempSync(join(tmpdir(), 'dev-key-absent-'));
     try {
```

- [ ] **Step 2: Run — red for the right reason.**

```bash
cd extension && TZ=UTC npx vitest run src/vault/__tests__/rpId.test.ts scripts/__tests__/release-chrome.test.mjs scripts/__tests__/storeKey.test.mjs
```
Observed on the base tree (ac181aa) + Step 1's files:
```
 FAIL  scripts/__tests__/release-chrome.test.mjs [ scripts/__tests__/release-chrome.test.mjs ]
Error: Cannot find module '../release-chrome.mjs' imported from …/extension/scripts/__tests__/release-chrome.test.mjs
 FAIL  scripts/__tests__/storeKey.test.mjs > build.mjs --dev-key (B1e §5.3) > refuses without a directory, or with dist/ or dist-nopresale/, before reading the key or building
AssertionError: expected 'file:///…' to contain '--dev-key builds only into a director…'
+ Error: --dev-key builds only into a directory named on the command line, never dist/ or dist-nopresale/ (B1e §5.3). usage: …
 FAIL  scripts/__tests__/storeKey.test.mjs > build.mjs --dev-key (B1e §5.3) > refuses any directory under dist/ or dist-nopresale/ (B1e-2, review M2: a prefix test on the resolved path)
AssertionError: expected 'file:///…' to contain '--dev-key builds only into a director…'
+ Error: …/extension/release/store-key.json: absent — the store assigns the ID at the first upload; record {id, key} then (B1e §5.3, §7 step 7)
 FAIL  src/vault/__tests__/rpId.test.ts > the passkey RP ID (B1e §5.6) > equals the owner’s record: release/rp-id.json is exactly {rpId: RP_ID, confirmedBy: owner, decision: E17}
Error: release/rp-id.json is absent
 Test Files  3 failed (3)
      Tests  3 failed | 31 passed | 1 skipped (35)
```
(`release-chrome.mjs` does not exist; the record does not exist; Task 1's `build.mjs` still says "never dist/ or dist-nopresale/" and lets `--dev-key` build into `dist-nopresale/chrome` — it stopped only at the absent key. The other `rpId.test.ts` and `storeKey.test.mjs` rows stay green.)

- [ ] **Step 3: Implement.**

Create `extension/scripts/release-chrome.mjs`:

```js
#!/usr/bin/env node
// B1e §5.1: `npm run release:chrome` — the Chrome Web Store package, made only after everything that must hold does.
//
//   0. preflight: no NODE_ENV in the environment, the working tree clean, this version's zip and notes not written yet,
//      the lockfile present (the notes name a commit and the lockfile's hash; a dirty tree would make that commit a lie,
//      and a written release is never overwritten);
//   0a. the live pre-check (§6.5, E26): the three pages, before anything is built — a page that is not live fails the
//      run in seconds, not after verify;
//   1. `npm run verify` (clean; both builds, every test, CSP, secrets, every gate, the four reproducible builds);
//   2. the third witness (R10): `node scripts/build.mjs <tmp> --no-presale`, its chrome/ file digest equal to verify's
//      dist-nopresale/chrome — the package itself is verify's, no fifth build is packed;
//   3. the RP-ID record (§5.6, E17): release/rp-id.json is exactly {rpId, confirmedBy: 'owner', decision: 'E17'} with
//      rpId 'wallet.noc-tura.io', equal to src/vault/passkey.ts's RP_ID;
//   4. the live check (§6.5): the three GETs again, one at a time, each with a timeout — no skip flag, no retry;
//   5. the STORE zip (§5.4) of dist-nopresale/chrome made twice, one sha256; its entries, read back from the bytes, one
//      for one the witnessed files (path and sha256); the package digest still the witnessed one;
//   6. the tree re-checked (still clean, the same HEAD), then release/out/noctura-chrome-<version>.zip (git-ignored) and
//      release/notes-<version>.md (the owner commits it), each written under a temporary name beside it and moved into
//      place only when both are written — nothing is written before this step, and nothing is ever overwritten.
//
// The orchestrator is pure (`runRelease(steps)`): each step answers {problems, value?, line?, written?}; the first step
// with a problem (or that throws) stops the run, so a refusal can never be followed by a pack. `releaseSteps(io)` builds
// the steps over an injected io, so the order and every refusal are unit-tested without running verify, building or
// reaching the network (scripts/__tests__/release-chrome.test.mjs); `realIo()` is the only place they touch the world.
import {execFileSync, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {MANIFEST_NAME, buildManifest} from '../../web/scripts/build-manifest.mjs';
import {packageVersion} from '../manifest/source.mjs';
import {readStoreZip} from './__tests__/storeZipReader.mjs';
import {isMain} from './isMain.mjs';
import {liveCheck} from './live-check.mjs';
import {zipStore} from './zip-store.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const STEPS = Object.freeze(['preflight', 'livePrecheck', 'verify', 'witness', 'rpId', 'liveCheck', 'zip', 'write']);
/** What is packed: verify's own store build (E2, R10). Paths are extension-relative. */
export const PACKAGE = 'dist-nopresale/chrome';
export const RP_ID_FILE = 'release/rp-id.json';
export const RP_ID_SOURCE = 'src/vault/passkey.ts';
/** The dependency set the zip is built from; its sha256 goes into the notes. */
export const LOCKFILE = 'package-lock.json';
/** The owner's decision E17 (2026-10-30), frozen by 1.0.0: the record must be exactly this. */
export const RP_ID_RECORD = Object.freeze({rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'});
export const OUT_DIR = 'release/out';
/** Per live-check request (connect, headers and body): a hung noc-tura.io must not hang the release. */
export const LIVE_TIMEOUT_MS = 15_000;
export const USAGE = 'usage: npm run release:chrome (no arguments — every step runs, the live check included; B1e §5.1, §6.5)';

export const zipPath = version => `${OUT_DIR}/noctura-chrome-${version}.zip`;
export const notesPath = version => `release/notes-${version}.md`;
/** Where a file is written before it is moved into place: beside it, so the move is a link on one file system. */
export const partialPath = path => `${path}.partial`;
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const message = e => (e instanceof Error ? e.message : String(e));

/** The CLI takes no argument at all: there is no flag that skips a step. */
export const cliProblem = argv => (argv.length === 0 ? null : USAGE);

/**
 * The environment every command the release runs gets: the release's own, without NODE_ENV (B1e-2, review C1). Vite
 * keeps a NODE_ENV it finds, and NODE_ENV=development or test builds React's development bundle — verify, the third
 * witness and the zip would all agree on it. The preflight refuses a NODE_ENV; this is the second wall.
 */
export const childEnv = env => Object.fromEntries(Object.entries(env).filter(([name]) => name !== 'NODE_ENV'));

export function nodeEnvProblem(value) {
  return (
    `NODE_ENV is set (to ${JSON.stringify(value)}) — the store build is made with none: Vite keeps a NODE_ENV it finds, ` +
    'and development or test builds React\'s development bundle, which verify, the third witness and the zip would all ' +
    'agree on. Any value is refused, production included: the notes record "NODE_ENV: unset", one condition a ' +
    'reproducer can meet. Run `env -u NODE_ENV npm run release:chrome`, or unset it.'
  );
}

/**
 * RP_ID as src/vault/passkey.ts spells it, read without a TypeScript loader: exactly one `RP_ID =` in the file, and it
 * is the plain line `export const RP_ID = '<host>';`. Anything else throws — a reformatted line refuses the release
 * (and turns release-chrome.test.mjs red) rather than being guessed at.
 */
export function readRpId(text) {
  const declarations = text.match(/\bRP_ID\s*=/g) ?? [];
  const line = /^export const RP_ID = '([a-z0-9.-]+)';$/m.exec(text);
  if (declarations.length !== 1 || line === null)
    throw new Error(`${RP_ID_SOURCE}: no single plain \`export const RP_ID = '<host>';\` line — the RP ID cannot be read without a TypeScript loader`);
  return line[1];
}

/** [] iff `value` is exactly RP_ID_RECORD (no other field) and its rpId is `rpId` (passkey.ts's). */
export function rpIdProblems(value, rpId) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return [`${RP_ID_FILE} is not a JSON object`];
  const out = [];
  const names = Object.keys(value).sort();
  const want = Object.keys(RP_ID_RECORD).sort();
  if (names.join(',') !== want.join(','))
    out.push(`${RP_ID_FILE}: fields are ${names.join(', ')} — want exactly ${want.join(', ')}`);
  for (const [field, expected] of Object.entries(RP_ID_RECORD))
    if (value[field] !== expected) out.push(`${RP_ID_FILE}: ${field} is ${JSON.stringify(value[field])}, want ${JSON.stringify(expected)} (E17)`);
  if (value.rpId !== rpId) out.push(`${RP_ID_FILE}: rpId is ${JSON.stringify(value.rpId)}, but ${RP_ID_SOURCE} says RP_ID = ${JSON.stringify(rpId)}`);
  return out;
}

/** `git status --porcelain` → [] when empty, else the status lines under one heading. */
export function treeProblems(status) {
  const lines = status.split('\n').filter(l => l.trim() !== '');
  if (lines.length === 0) return [];
  return [
    'the working tree is not clean — the notes would name a commit that is not what was packed (git status --porcelain; ' +
      'the paths are relative to the repository root, not to extension/):',
    ...lines.map(l => `  ${l}`),
  ];
}

/**
 * The zip bound to the witness (B1e-2, review I1): its entries (`{path, sha256}`, read back from the zip's own bytes)
 * one for one the witnessed files — the same paths, the same hashes, the same count. [] iff they are.
 */
export function zipWitnessProblems(entries, witnessed) {
  const zipped = new Map(entries.map(e => [e.path, e.sha256]));
  const seen = new Map(witnessed.map(f => [f.path, f.sha256]));
  const out = [];
  for (const [path, hash] of zipped) {
    if (!seen.has(path)) out.push(`the zip holds ${path}, which the witness did not see`);
    else if (seen.get(path) !== hash) out.push(`the zip's ${path} is sha256 ${hash}, the witness saw ${seen.get(path)}`);
  }
  for (const path of seen.keys()) if (!zipped.has(path)) out.push(`the witness saw ${path}, which the zip does not hold`);
  if (out.length === 0 && (entries.length !== zipped.size || entries.length !== witnessed.length))
    out.push(`the zip has ${entries.length} entries, the witness ${witnessed.length} files`);
  return out;
}

/** A fetch whose every request is aborted after `ms` (AbortSignal.timeout covers the body read too). */
export const timedFetch = (fetch, ms) => (url, init) => fetch(url, {...init, signal: AbortSignal.timeout(ms)});

export function releaseNotes({version, sha256: zipSha, bytes, entries, digest, files, commit, lockfile, node}) {
  return [
    `# Noctura for Chrome ${version} — release notes`,
    '',
    'Written by `npm run release:chrome` (B1e §5.1) after verify, the third witness, the RP-ID record and the live check',
    'passed. The zip is the one uploaded to the Chrome Web Store; anyone can rebuild it from the commit and compare.',
    '',
    `- Version: ${version}`,
    `- Zip: \`${zipPath(version)}\` (${bytes} bytes, ${entries} entries, not committed)`,
    `- Zip sha256: \`${zipSha}\``,
    `- Package file digest: \`sha256:${digest}\` (${files} files of \`extension/${PACKAGE}\`, web/scripts/build-manifest.mjs;`,
    '  each zip entry is one of these files, its path and sha256 compared)',
    `- Commit: \`${commit}\`, working tree clean`,
    `- Lockfile: \`extension/${LOCKFILE}\` sha256 \`${lockfile}\` (installed with \`npm ci --ignore-scripts\`)`,
    '- NODE_ENV: unset',
    `- Passkey RP ID: ${RP_ID_RECORD.rpId} (release/rp-id.json, E17)`,
    `- Node: ${node}`,
    '',
    'To reproduce: check out the commit, then `cd extension && npm ci --ignore-scripts && env -u NODE_ENV npm run build`.',
    '`node ../web/scripts/build-manifest.mjs dist-nopresale/chrome --print-only` prints the same file count and package',
    'file digest (without `--print-only` it writes build-manifest.json into the package, which the zip would then hold);',
    `\`node scripts/zip-store.mjs dist-nopresale/chrome <out.zip>\` prints ${entries} entries and the same sha256.`,
    '',
  ].join('\n');
}

/** The steps over `io` (see realIo for its members). */
export function releaseSteps(io) {
  const version = io.version;
  const head = () => {
    const commit = io.git(['rev-parse', 'HEAD']).trim();
    return /^[0-9a-f]{40}$/.test(commit) ? {commit} : {problem: `git rev-parse HEAD answered ${JSON.stringify(commit)} — no commit to record`};
  };
  const live = async final => {
    const {ok, problems} = await liveCheck({fetch: io.fetch});
    return {
      problems: ok ? [] : problems.length > 0 ? problems : ['the live check failed without naming a problem'],
      line: final ? 'the three pages answer 200 and carry their text' : 'the three pages answer 200 and carry their text (checked again after verify)',
    };
  };
  /** Removes each path; answers the ones it could not remove. */
  const removeAll = paths =>
    paths.filter(path => {
      try {
        io.remove(path);
        return false;
      } catch {
        return true;
      }
    });
  return {
    preflight: async () => {
      const problems = [];
      if (io.env.NODE_ENV !== undefined) problems.push(nodeEnvProblem(io.env.NODE_ENV));
      for (const path of [zipPath(version), notesPath(version)])
        if (io.exists(path))
          problems.push(`${path} exists — version ${version} was packed already: bump extension/package.json's version, or remove the file if that pack was abandoned`);
      problems.push(...treeProblems(io.git(['status', '--porcelain'])));
      const {commit, problem} = head();
      if (problem) problems.push(problem);
      const lockfile = io.hashFile(LOCKFILE);
      if (lockfile === undefined) problems.push(`${LOCKFILE} is absent — the notes record the dependency set the zip is built from`);
      return {problems, value: {commit, lockfile}, line: `version ${version}, commit ${commit}, working tree clean, NODE_ENV unset`};
    },
    livePrecheck: () => live(false),
    verify: async () => {
      const status = io.run('npm', ['run', 'verify']);
      return {problems: status === 0 ? [] : [`npm run verify exited ${status}`], line: 'npm run verify exited 0'};
    },
    witness: async () => {
      if (io.exists(`${PACKAGE}/${MANIFEST_NAME}`))
        return {
          problems: [
            `${PACKAGE}/${MANIFEST_NAME} exists — the file digest skips that name, so the witness cannot see it and the zip ` +
              'would pack it; no build writes it (build-manifest.mjs run there without --print-only does): run verify again',
          ],
        };
      const dir = io.tempDir();
      try {
        const status = io.run('node', ['scripts/build.mjs', dir, '--no-presale']);
        if (status !== 0) return {problems: [`the third build (node scripts/build.mjs ${dir} --no-presale) exited ${status}`]};
        const third = io.digest(join(dir, 'chrome'));
        const verified = io.digest(PACKAGE);
        if (third.files.length === 0 || verified.files.length === 0)
          return {problems: [`INCONCLUSIVE: the third build's chrome/ or verify's ${PACKAGE} holds no file`]};
        if (third.digest !== verified.digest)
          return {problems: [`the third build's chrome/ is sha256:${third.digest}, verify's ${PACKAGE} is sha256:${verified.digest} — not the package verify checked`]};
        return {problems: [], value: verified, line: `${verified.files.length} files, sha256:${verified.digest} — the third build agrees`};
      } finally {
        io.removeDir(dir);
      }
    },
    rpId: async () => {
      const text = io.read(RP_ID_FILE);
      if (text === undefined)
        return {problems: [`${RP_ID_FILE} is absent — the owner's confirmation of the passkey RP ID (E17, B1e §5.6) is recorded before upload`]};
      let value;
      try {
        value = JSON.parse(text);
      } catch (e) {
        return {problems: [`${RP_ID_FILE} is not JSON (${message(e)})`]};
      }
      let rpId;
      try {
        rpId = readRpId(io.read(RP_ID_SOURCE) ?? '');
      } catch (e) {
        return {problems: [message(e)]};
      }
      return {problems: rpIdProblems(value, rpId), line: `${RP_ID_FILE} records ${rpId}, confirmed by the owner (E17)`};
    },
    liveCheck: () => live(true),
    zip: async done => {
      const first = io.zip(PACKAGE);
      const second = io.zip(PACKAGE);
      const [a, b] = [sha256(first), sha256(second)];
      if (a !== b) return {problems: [`the two zips of ${PACKAGE} differ: sha256 ${a} vs ${b}`]};
      const entries = readStoreZip(first).map(e => ({path: e.path, sha256: sha256(e.bytes)}));
      const unbound = zipWitnessProblems(entries, done.witness.files);
      if (unbound.length > 0) return {problems: ['the zip is not the package the witness saw:', ...unbound.map(p => `  ${p}`)]};
      const now = io.digest(PACKAGE);
      if (now.digest !== done.witness.digest)
        return {problems: [`${PACKAGE} changed after the witness: sha256:${now.digest}, was sha256:${done.witness.digest}`]};
      return {
        problems: [],
        value: {bytes: first, sha256: a, entries: entries.length},
        line: `${first.length} bytes, ${entries.length} entries (each a witnessed file, path and sha256), sha256 ${a}, twice`,
      };
    },
    write: async done => {
      const problems = treeProblems(io.git(['status', '--porcelain']));
      const {commit, problem} = head();
      if (problem) problems.push(problem);
      else if (commit !== done.preflight.commit) problems.push(`HEAD moved during the run: ${done.preflight.commit} → ${commit}`);
      const finals = [zipPath(version), notesPath(version)];
      const partials = finals.map(partialPath);
      for (const path of [...finals, ...partials]) if (io.exists(path)) problems.push(`${path} exists — appeared during the run, or left by an earlier one; never overwritten`);
      if (problems.length > 0) return {problems};
      const {bytes, sha256: zipSha, entries} = done.zip;
      const notes = releaseNotes({
        version,
        sha256: zipSha,
        bytes: bytes.length,
        entries,
        digest: done.witness.digest,
        files: done.witness.files.length,
        commit,
        lockfile: done.preflight.lockfile,
        node: io.node,
      });
      const contents = [bytes, notes];
      try {
        partials.forEach((path, i) => io.write(path, contents[i]));
      } catch (e) {
        return {problems: [`writing failed (${message(e)})`], written: removeAll(partials.filter(path => io.exists(path)))};
      }
      const placed = [];
      try {
        finals.forEach((path, i) => {
          io.place(partials[i], path);
          placed.push(path);
        });
      } catch (e) {
        return {problems: [`moving into place failed (${message(e)})`], written: [...placed, ...removeAll(partials.filter(path => io.exists(path)))]};
      }
      return {problems: [], value: {zip: finals[0], notes: finals[1], sha256: zipSha}, line: `${finals[0]} and ${finals[1]}`};
    },
  };
}

/**
 * Runs STEPS in order. Returns {ok: true, ...the write step's value} or {ok: false, stoppedAt, problems, written?} —
 * `written` only when the refusing step left files on disk; never runs a step after one that refused, threw, is
 * missing or answered no problem list.
 */
export async function runRelease(steps, log = console.log) {
  const done = {};
  for (const name of STEPS) {
    const step = steps[name];
    let result;
    if (typeof step !== 'function') result = {problems: [`${name}: no such step`]};
    else {
      try {
        result = await step(done);
      } catch (e) {
        result = {problems: [`${name}: ${message(e)}`]};
      }
      if (result === null || typeof result !== 'object' || !Array.isArray(result.problems))
        result = {problems: [`${name}: answered no problem list`]};
    }
    if (result.problems.length > 0) {
      const left = Array.isArray(result.written) ? result.written : [];
      return {ok: false, stoppedAt: name, problems: result.problems, ...(left.length > 0 ? {written: left} : {})};
    }
    done[name] = result.value;
    log(`release: ${name} ok${result.line ? ` — ${result.line}` : ''}`);
  }
  return {ok: true, ...done.write};
}

/** What the CLI prints for a refusal: "nothing was written" only when nothing was (review M1). */
export function refusalLines(result) {
  const left = result.written ?? [];
  const head =
    left.length === 0
      ? `release: refused at ${result.stoppedAt} — nothing was written`
      : `release: refused at ${result.stoppedAt} — the write failed part-way: remove ${left.join(', ')} (in extension/) before running again`;
  return [head, ...result.problems.map(p => `  ${p}`)];
}

/** The world: commands, git, the file system under `root`, the network (timed) — used only by the CLI. */
export function realIo(root = ROOT) {
  const at = path => resolve(root, path);
  return {
    version: packageVersion(),
    node: process.version,
    env: process.env,
    run: (cmd, args) => spawnSync(cmd, args, {cwd: root, stdio: 'inherit', env: childEnv(process.env)}).status ?? 1,
    git: args => execFileSync('git', args, {cwd: root, encoding: 'utf8'}),
    tempDir: () => mkdtempSync(join(tmpdir(), 'noctura-release-witness-')),
    removeDir: dir => rmSync(dir, {recursive: true, force: true}),
    digest: dir => buildManifest(at(dir)),
    exists: path => existsSync(at(path)),
    read: path => (existsSync(at(path)) ? readFileSync(at(path), 'utf8') : undefined),
    hashFile: path => (existsSync(at(path)) ? sha256(readFileSync(at(path))) : undefined),
    fetch: timedFetch(globalThis.fetch, LIVE_TIMEOUT_MS),
    zip: dir => zipStore(at(dir)),
    write: (path, bytes) => {
      mkdirSync(dirname(at(path)), {recursive: true});
      writeFileSync(at(path), bytes, {flag: 'wx'});
    },
    // A hard link refuses an existing target (EEXIST): moved into place, never over anything.
    place: (from, to) => {
      linkSync(at(from), at(to));
      unlinkSync(at(from));
    },
    remove: path => unlinkSync(at(path)),
  };
}

if (isMain(import.meta.url)) {
  const problem = cliProblem(process.argv.slice(2));
  if (problem !== null) {
    console.error(problem);
    process.exit(2);
  }
  const result = await runRelease(releaseSteps(realIo()));
  if (result.ok) console.log(`release: done — ${result.zip}, sha256 ${result.sha256}; ${result.notes} is for the owner to commit`);
  else {
    for (const line of refusalLines(result)) console.error(line);
    process.exitCode = 1;
  }
}
```

Modify `extension/scripts/build.mjs` (Task 1's file):

```diff
diff --git a/extension/scripts/build.mjs b/extension/scripts/build.mjs
index da92876..37df6de 100644
--- a/extension/scripts/build.mjs
+++ b/extension/scripts/build.mjs
@@ -13,15 +13,25 @@
 // dist-nopresale/ (the directories verify, the gates and the release read, whose manifests must carry no key); the key
 // file is read before anything is built, and an absent or malformed one fails the build. Firefox's manifest never
 // carries a key.
+//
+// B1e-2 (review C1): Vite keeps a NODE_ENV it finds in the environment, and NODE_ENV=development (or vitest's test)
+// builds React's development bundle. This script builds only with no NODE_ENV or NODE_ENV=production (the same bytes —
+// measured in the B1e-2 dry run); any other value fails before anything is built.
 import {execFileSync} from 'node:child_process';
 import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
-import {dirname, join, resolve} from 'node:path';
+import {dirname, join, resolve, sep} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {render} from '../manifest/source.mjs';
 import {LICENCE_PAGE, buildLicencePage} from './licences.mjs';
 import {readStoreKey} from './storeKey.mjs';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
+const nodeEnv = process.env.NODE_ENV;
+if (nodeEnv !== undefined && nodeEnv !== 'production') {
+  throw new Error(
+    `NODE_ENV is ${JSON.stringify(nodeEnv)} — build.mjs builds only with no NODE_ENV or NODE_ENV=production (B1e §5.1): any other value builds React's development bundle. Unset it (env -u NODE_ENV …).`,
+  );
+}
 const args = process.argv.slice(2);
 const presale = !args.includes('--no-presale');
 const devKey = args.includes('--dev-key');
@@ -29,8 +39,11 @@ const dirs = args.filter(a => a !== '--no-presale' && a !== '--dev-key');
 const USAGE = 'usage: node scripts/build.mjs [outDir] [--no-presale] | node scripts/build.mjs <outDir> --dev-key [--no-presale]';
 if (dirs.length > 1 || dirs.some(a => a.startsWith('-'))) throw new Error(USAGE);
 const outRoot = dirs[0] ? resolve(dirs[0]) : join(ROOT, presale ? 'dist' : 'dist-nopresale');
-if (devKey && (dirs.length === 0 || ['dist', 'dist-nopresale'].some(d => outRoot === join(ROOT, d)))) {
-  throw new Error(`--dev-key builds only into a directory named on the command line, never dist/ or dist-nopresale/ (B1e §5.3). ${USAGE}`);
+// B1e-2 (review M2): not into either directory nor anywhere under them — a keyed build inside dist-nopresale/chrome/ would
+// put a second manifest, with the key, into the package the gates read.
+const inside = dir => outRoot === dir || outRoot.startsWith(dir + sep);
+if (devKey && (dirs.length === 0 || ['dist', 'dist-nopresale'].some(d => inside(join(ROOT, d))))) {
+  throw new Error(`--dev-key builds only into a directory named on the command line, never dist/, dist-nopresale/ or anything under them (B1e §5.3). ${USAGE}`);
 }
 const key = devKey ? readStoreKey().key : undefined;
 const app = join(outRoot, 'app');
```

Create `extension/release/rp-id.json` (exactly this line and a newline — the controller's ruling from the owner's written E17, 2026-10-30):

```json
{"rpId": "wallet.noc-tura.io", "confirmedBy": "owner", "decision": "E17"}
```

Modify `extension/package.json`:

```diff
diff --git a/extension/package.json b/extension/package.json
index a1b9b4c..720c8eb 100644
--- a/extension/package.json
+++ b/extension/package.json
@@ -16,6 +16,7 @@
     "gates": "npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build && node scripts/check-no-presale.mjs dist-nopresale dist",
     "gates:build": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs && node scripts/check-links.mjs && node scripts/check-licences.mjs && node scripts/check-ui-claims.mjs",
     "reproducible": "node scripts/verify-reproducible.mjs",
+    "release:chrome": "node scripts/release-chrome.mjs",
     "verify": "rm -rf dist dist-nopresale && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
   },
   "dependencies": {
```

Modify `extension/.gitignore`:

```diff
diff --git a/extension/.gitignore b/extension/.gitignore
index 0f93436..8b63fe2 100644
--- a/extension/.gitignore
+++ b/extension/.gitignore
@@ -4,3 +4,4 @@ dist-nopresale/
 test-results/
 playwright-report/
 release/screenshots/out/
+release/out/
```

Create `extension/release/checklist.md` (§7 adapted to what this plan built; §5.5's evidence as run in the real repository — re-run it at execution time and replace the block if the output differs):

````markdown
# Chrome Web Store submission checklist — Noctura 1.0.0

For the owner (B1e spec §7, with §5.1, §5.3, §5.5, §5.6). Every command runs in `extension/` of a clean checkout of
`main` (`git status --porcelain` empty — untracked files count; `release:chrome` refuses otherwise). Steps are in order;
a step that says "before" is a gate, not a suggestion.

## Open before the release (owner / ICO)

- [ ] **ICO: P1 — the automatic OFAC refresh of `/geo/restricted-list`.** The store build runs the region check (F12) and
      fails closed on a stale list; ICO confirms the refresh runs in production (spec §6.2, inherited from B1d §6.5).
- [ ] **ICO: is `chrome-extension://<the store ID>` on the coordinator's Origin allow list?** Either way the published
      sentence R7 is true (if it is not, every RPC and broadcast request logs that one value, no IP); ask once the store
      has assigned the ID (step 7), and tell us if the answer changes a sentence.
- [ ] **The Terms need a lawyer** (owner decision E4): `release/terms.md` is a DRAFT; its first note lists the open points
      (provider's legal name and address, governing law and courts, eligibility, liability wording and EU consumer law,
      notice of changes). The approved text goes to ICO without the DRAFT note.
- [ ] **ICO: `wallet.noc-tura.io` serves nothing, and stays so (owner decision E25) — a gate before upload.** The passkey
      RP ID (E17) is a name on ICO's domain, and a passkey bound to it can be asked for by any HTTPS page at that name
      or at any name under it (`<anything>.wallet.noc-tura.io`): such a page could prompt a store user's synced Noctura
      passkey and obtain its PRF output, the secret that unwraps the vault. ICO confirms in writing, recorded in
      `noc-ops`: (1) `wallet.noc-tura.io` and every name under it have no DNS record — or resolve only to a host that
      refuses HTTPS — and noc-tura.io has no wildcard record; (2) no certificate covers them: none for
      `wallet.noc-tura.io` or `*.wallet.noc-tura.io`, and no wildcard `*.noc-tura.io`; (3) ICO tells us **before** any
      record, certificate or service is ever added for those names. You check it yourself without opening any Noctura
      page (a DNS query goes to resolvers and noc-tura.io's name servers, never to a web server — and never open
      https://wallet.noc-tura.io to look):
      `dig +short wallet.noc-tura.io A`, `dig +short wallet.noc-tura.io AAAA`, `dig +short wallet.noc-tura.io CNAME`
      and `dig +short e25-check-$(date +%s).noc-tura.io A` (an invented name: an answer means a wildcard record) each
      print nothing; then, in a browser, the Certificate Transparency search https://crt.sh/?q=%25.noc-tura.io lists no
      unexpired certificate naming `wallet.noc-tura.io`, `*.wallet.noc-tura.io` or `*.noc-tura.io`. A record or a
      certificate found is a stop: no upload until ICO removes it. Re-check before every later upload.
      (`walletapp.noc-tura.io` exists and is not covered by the rule: a passkey for `wallet.noc-tura.io` is never
      offered to it.)
- [ ] **ICO publishes the three pages** exactly as written: `release/privacy.md` at https://noc-tura.io/extension/privacy,
      `release/terms.md` (approved) at https://noc-tura.io/extension/terms, `release/help.md` at
      https://noc-tura.io/extension/help — each answering 200 with no redirect.

## 1. Developer account

- [ ] Chrome Web Store developer account: the 5 USD registration fee, 2-step verification on the Google account, a
      verified contact e-mail, and the EU trader / non-trader declaration.

## 2. The texts are live, and the live check passes

- [ ] ICO's retention answer is recorded: `release/ico-retention.md` (received 2026-11-01), turned into R1–R21 of
      `release/privacySentences.mjs` — done in B1e-2. P1 (above) confirmed.
- [ ] The three pages published (above). The live check is part of `release:chrome` only (step 3) and runs **twice**
      (owner decision E26): a pre-check before `verify`, so a page that is not live stops the run in seconds with
      nothing built, and the final check after `verify` and the RP-ID record, just before the zip — three GETs to
      noc-tura.io each time, one page at a time, six per run; 15 s each, no redirect followed, no retry, no flag to skip
      it. It needs every sentence of `privacySentences.mjs` on the privacy page, and "Terms of Service" / "Help &
      support" with privacy@noc-tura.io on the other two (the Terms page without the DRAFT note). Until ICO publishes,
      `release:chrome` stops at the pre-check and writes nothing (rev 1's dry run, 2026-11-05, which had one check after
      verify: all three pages answered 404).
- [ ] **Every later version, before its upload:** read every sentence of `release/privacySentences.mjs` against the
      extension's changes since the last release (`git diff <last release commit>..HEAD -- extension/src extension/manifest`)
      — a change that keeps every pinned constant can still make a sentence untrue (a new field on an existing route); a
      sentence it made untrue is corrected and republished by ICO first. Then `release:chrome` runs the live check again
      that day: the pages are checked when a version is packed, not in between.

## 3. Pack and upload

- [ ] **Re-confirm the passkey RP ID (E17, spec §5.6).** `release/rp-id.json` records
      `{"rpId": "wallet.noc-tura.io", "confirmedBy": "owner", "decision": "E17"}` (committed in B1e-2 from your written
      decision of 2026-10-30). 1.0.0 freezes it: every passkey a store user enrols is bound to that name for good, and
      changing it later orphans them all. If it must change, it changes now — `src/vault/passkey.ts`, the host
      permission, the record, the privacy sentences P12 / P13 and the listing together — never after upload.
      `release:chrome` refuses to pack unless the record is exactly that and equals `RP_ID` in `src/vault/passkey.ts`.
      The name is safe to freeze only while nothing is served at it — the ICO gate above (E25).
- [ ] **No `NODE_ENV` in your shell:** `echo "${NODE_ENV-unset}"` prints `unset` (if not: `unset NODE_ENV`, or prefix
      the command below with `env -u NODE_ENV`). A `NODE_ENV` of development or test makes Vite build React's
      development bundle, and every step would agree on it; `release:chrome` refuses any `NODE_ENV`, and `build.mjs`
      any but `production`.
- [ ] `npm ci --ignore-scripts && npm run release:chrome` (as CI installs: only `extension/`, no dependency's install
      script; Node 22.12 or later — the zip is byte-identical on any Node, spec §5.4). It runs, in order, stopping at the
      first refusal with nothing written: the preflight (no `NODE_ENV`, a clean tree, this version not packed yet, the
      lockfile present); the live pre-check; `npm run verify`; a third store build whose `chrome/` digest must equal
      verify's `dist-nopresale/chrome`; the RP-ID record; the final live check; the zip made twice with one sha256, read
      back, its entries one for one the witnessed files. Then it writes `release/out/noctura-chrome-1.0.0.zip`
      (git-ignored — upload this file) and `release/notes-1.0.0.md` (the version; the zip's bytes, entry count and
      sha256; the package's file digest; the commit; the lockfile's sha256; `NODE_ENV: unset`; the RP ID; Node), each
      under a temporary name first, moved into place when both are written. If it ever says "the write failed
      part-way", remove the files it names before running again. Commit the notes:
      `git add release/notes-1.0.0.md && git commit -m "release(extension): Chrome 1.0.0 notes"`.
- [ ] Upload `release/out/noctura-chrome-1.0.0.zip` in the developer dashboard.
- [ ] Store listing: paste `release/listing.md` field by field (each `## ` heading is the dashboard field). The summary
      is not pasted: the store reads it from the package's manifest `description`; `listing.md` shows the same string.
      The category is yours to pick. Permission justifications: the five `### ` entries under "Permission justifications".
      Remote code: "No".
- [ ] Privacy practices: tick the answers of `release/data-usage.md` ("The form": Financial and payment information,
      Location and Website content **Yes**, the rest **No**), the three certifications (on R20 — read the file's notes on
      what ICO's answer does and does not name), the privacy policy URL https://noc-tura.io/extension/privacy. Check the
      dashboard's certification wording against the file's; a difference is a text edit.
- [ ] Screenshots: `npm run screenshots` (right after `release:chrome`, which leaves verify's store build in place; on a
      fresh checkout run `npm run build` first). It writes five 1280 × 800 PNGs to `release/screenshots/out/`
      (git-ignored); upload them in this order: `1-home.png`, `2-send-review.png`, `3-site-request.png`,
      `4-wallet-tab.png`, `5-security.png`. Look at them and at `release/screenshots/backdrop.html` first (the visual
      pass); flagged for you there: the NOC row's "estimate · not in total" (E23), #19's second check line clipped at 412 px, the test
      site shown "Unknown", the sample phrase "Violet otter 19" and amounts.
- [ ] Submit for review **with publishing deferred** (you publish by hand after approval). This may happen before step 4
      (E14); nothing is distributed until step 6.

## 4. The independent external security review — before step 6

- [ ] B1 release gate 2 (vendor and cost are yours): done **before the Unlisted listing, i.e. before any distribution**
      (E14). Its findings are fixed, or accepted in writing, first.

## 5. Record the permission strings and the version

- [ ] `unzip -q release/out/noctura-chrome-1.0.0.zip -d <an empty directory>`; in a clean Chrome profile,
      chrome://extensions → Developer mode → Load unpacked → that directory. An unpacked load shows no install dialog,
      so record the permission strings from the item's Details → Permissions, and the version on #38 (Settings → "About Noctura":
      "v1.0.0"). Expected: Chrome's all-sites warning ("Read and change all your data on all websites"); `storage` and
      `alarms` carry none.
- [ ] The install dialog itself is recorded by a tester at the first Unlisted install (step 6).

## 6. Visibility

- [ ] **Unlisted** for a few days with known testers, then **Public** (recommended); you decide at submission.

## 7. After the store assigns the ID

- [ ] Record the ID and the item's public key in `release/store-key.json`, in a follow-up commit:

      {"id": "<32 letters a–p>", "key": "<the public key: one line of base64, without the BEGIN / END lines>"}

      The file must be exactly these two fields; the key canonical base64 of the DER public key (the dashboard shows it
      as PEM: drop the armour lines and join the rest); the id must be the one Chrome derives from that key, or the
      file is refused (`scripts/storeKey.mjs`). Then confirm:
      `node scripts/build.mjs <outDir> --dev-key --no-presale && node scripts/check-permissions.mjs --dev-key <outDir>`
      prints `… chrome carries the recorded store key (id <id>), firefox none`, and `npm test` now runs the
      "once recorded" rows of `storeKey.test.mjs` and `check-permissions.test.mjs` instead of skipping them.
- [ ] Re-run the "no existing users" evidence below and put its output in the follow-up commit's message.
- [ ] Ask ICO the Origin question (above) with the ID.

**Development note.** An unpacked install built with `node scripts/build.mjs <outDir> --dev-key` has the store's ID, so it
and the store install cannot coexist in one Chrome profile (B1e §5.3). `--dev-key` builds only into a directory named on
the command line, never `dist/` or `dist-nopresale/`; the store package never carries a `key`.

## "No existing users" — the evidence (spec §5.5)

The B1c §6.5 update gate (an update that adds `<all_urls>` content scripts disables the extension for existing users)
does not apply to 1.0.0: it carries `<all_urls>` from its first store version, and there are no existing users. Run in
the repository root on 2026-11-05, at `c92fd09` with all 27 refs:

```
$ git log --all --oneline -- '*.zip' '*.crx' | wc -l
0
$ git tag -l | wc -l
0
$ git log --all --diff-filter=A --format='%h %ad' --date=short -- 'extension/release/*' | tail -1
3b509af 2026-11-03
$ git grep -n -i sideload HEAD -- . | grep -i -c 'extension\|crx\|chrome'
2
```

No `*.zip` or `*.crx` in any commit of any branch; no tag; the first file under `extension/release/` is B1e-1's
(`3b509af`); the two sideload lines that name the extension are spec §5.5's own sentence, every other sideload note is
the Android APK. The owner's unpacked installs and the E2E profiles are not users. The gate applies to every later
update that adds a permission.
````

Modify the spec — rev 2.7 at the top (rebuilt from every "Spec rev 2.7 lines" item of Tasks 1–6, revision 2's included, and this task's; one line each), the status line, §0's B1e-2 row and E23–E26 in the decisions table, and the passages the lines name (§5.1–§5.4, §5.6, §6.1's P3 / P4 / P5 / P7 / P8 cells and the new L1 row, §6.2, §6.3 after the certifications, §6.4, §6.5, §7, §9's design departure, §10). §6.3's table, the single-purpose statement `("A Solana wallet: …")` and the `E17: "…"` paragraph are NOT touched — `storeTexts.test.mjs` reads all three from the spec:

```diff
diff --git a/docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md b/docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md
index 6d274cf..e30ac9b 100644
--- a/docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md
+++ b/docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md
@@ -1,6 +1,8 @@
 # Noctura Extension B1e — the first Chrome Web Store release
 
-**Status:** rev 2.6, 2026-11-03 — the owner-facing departures the B1e-1 fix rounds of Tasks 2, 3 and 5
+**Status:** rev 2.7, 2026-11-06 — the departures the B1e-2 plan's dry run (Tasks 1–7, revision 2 after the plan's Fable
+review 1) made from rev 2.6, and the owner's decisions E23–E26 (2026-11-06), each one line under "Rev 2.7", the
+passages they name edited to match; no earlier owner decision changed. Rev 2.6, 2026-11-03 — the owner-facing departures the B1e-1 fix rounds of Tasks 2, 3 and 5
 made after rev 2.5 (the final review's Important 1, `.superpowers/sdd/2026-11-02-extension-b1e-plan1/final-review.md`)
 and the changes of the final fix wave (its Minors 1, 3, 5, 6, the ledger's four fix-now rows, the controller's rulings),
 each one line under "Rev 2.6", the passages they name edited to match. Rev 2.5, 2026-11-03 — the B1e-1 plan's Task 4
@@ -18,6 +20,156 @@ Parent specs: B1 (`2026-09-27-extension-b1-design.md` §5 "Build, gates, release
 D31), B1c §6.5, B1d §6.5 and §7. Binding design: `/home/user/Downloads/index.html` (+ `screen.md`) — it contains the
 TGE date; nothing is copied from it.
 
+**Rev 2.7** (the B1e-2 plan's dry run, 2026-11-05, and its revision 2 after the plan's Fable review 1 and the owner's
+E23–E26, 2026-11-06; every line is a departure of the built code or texts from rev 2.6's text, ruled in the plan and
+recorded in its ledger — the passages named are edited to match):
+- §0 (the owner, 2026-11-06, the plan's review 1 Q2–Q5): E23–E26 join the decisions table — the NOC row's presale
+  wording, #8's banner and the phone app's WelcomeScreen, the ICO gate for `wallet.noc-tura.io`, the live check twice.
+- §0 (Task 6, a controller ruling): B1e-2 also changes the extension's own copy that the privacy policy contradicts (#1,
+  #8, #39, the NOC row, the store summary) and adds a guard over it; the release script, the record and the checklist
+  are its Task 7.
+- §5.2 (Task 1): `source.mjs` also refuses (the build fails) a package.json version Chrome would refuse — each of the
+  three numbers 0–65535, no leading zero; the gate keeps `^\d+\.\d+\.\d+$` and its own read of package.json.
+- §5.3 (Task 1): `store-key.json` is refused unless it is exactly `{id, key}`, `key` one line of canonical base64 of a
+  DER SubjectPublicKeyInfo (no PEM armour), and `id` the ID Chrome derives from `key` (sha256 of the DER, first 16
+  bytes, hex digits as a–p — a Chromium-observed vector is committed).
+- §5.3 (Task 1; Task 7, review M2): `--dev-key` builds only into a directory named on the command line, never `dist/`,
+  `dist-nopresale/` or any directory under them (a prefix test on the resolved path), and reads the key before
+  building; `render` refuses a key for Firefox; the gate's dev-key form is
+  `node scripts/check-permissions.mjs --dev-key <outDir>`.
+- §5.4 (Task 2): the limits are at most 65 534 entries and every 32-bit size / offset at most 0xFFFFFFFE — the all-ones
+  values are zip64's sentinels (APPNOTE 4.4.1.4) — where the text said "more than 65 535 entries or 4 GiB fails".
+- §5.4 (Task 2): "every path must be ASCII" is printable ASCII (0x20–0x7E), no backslash, no empty, `.` or `..` segment.
+- §5.4 (Task 2): anything under the package that is not a regular file or a directory (a symlink of any kind, a FIFO, a
+  socket, a device) fails the script; an empty directory has no entry and disappears; a package with no file fails.
+- §5.4 (Task 2): "version 20" = version made by 20 on host 0 and version needed 20.
+- §5.4 (Task 2): the script is `zipStore(dir) → Buffer` plus a CLI `node scripts/zip-store.mjs <dir> <out.zip>` that
+  refuses an output inside `<dir>` or one that exists; the tests' independent reader is the helper
+  `scripts/__tests__/storeZipReader.mjs` (no import), beside real-tool controls (`unzip -t`, `python3 -m zipfile -t`)
+  run by hand.
+- §5.1 (Task 7; review C1, M7): a preflight before anything else — no `NODE_ENV` in the environment (any value,
+  `production` included: the notes record "NODE_ENV: unset"), the working tree clean (`git status --porcelain` empty,
+  untracked files included; the refusal says its paths are relative to the repository root), this version's zip and
+  notes absent, `package-lock.json` present; before writing, the tree is checked again (still clean, the same HEAD).
+- §5.1 (Task 7, review C1): every command the release runs gets its environment without `NODE_ENV`; and
+  `scripts/build.mjs` itself refuses a `NODE_ENV` other than unset or `production` before building (Vite keeps a
+  `NODE_ENV` it finds: `development` or `test` builds React's development bundle — measured: another file digest; unset
+  and `production` give the same one).
+- §5.1 / §6.5 (Task 7, E26): the live check runs twice — a pre-check right after the preflight, before `verify`, and the
+  final check after the RP-ID record, before the zip: six GETs per run.
+- §5.1 (Task 7, review I1): the witness step refuses a package holding `build-manifest.json` at its root (the file
+  digest skips that name); step 5 reads the zip back (the independent reader, `scripts/__tests__/storeZipReader.mjs`)
+  and requires its entries one for one the witnessed files — the same paths, the same sha256, the same count — then
+  re-reads the package's file digest (still the witnessed one).
+- §5.1 (Task 7, review M1): the zip is written to `extension/release/out/noctura-chrome-<version>.zip` (git-ignored) and
+  the notes to `extension/release/notes-<version>.md` (the owner commits them), each first under the name `<file>.partial`
+  beside it and moved into place (a hard link: never over an existing file) only when both are written; a write that
+  fails part-way names the files it left, and only a refusal that left none says "nothing was written".
+- §5.1 (Task 7; review I5, M6): the notes record the version, the zip's bytes, entry count and sha256, the package's
+  file digest and file count, the commit and that the tree was clean, `package-lock.json`'s sha256, "NODE_ENV: unset",
+  the RP ID and the Node version; their recipe installs with `npm ci --ignore-scripts`, builds with no `NODE_ENV`, and
+  reads the digest with `build-manifest.mjs … --print-only`.
+- §5.1 / §6.5 (Task 7): every live-check request has a 15 s timeout (`AbortSignal.timeout`, the body read included);
+  the script takes no argument at all (no skip flag); it is a pure orchestrator (`runRelease(steps)`) over steps built
+  on an injected io (`releaseSteps(io)`), unit-tested with no verify, build or network.
+- §5.6 (Task 7): the script reads `RP_ID` from `src/vault/passkey.ts` by its one plain line
+  `export const RP_ID = '<host>';` (no TypeScript loader; any other form refuses) and checks the record against both
+  that value and E17's `wallet.noc-tura.io`; `rp-id.json` is committed by B1e-2 from the owner's written E17 (the
+  controller's ruling) and §7 step 3 asks the owner to re-confirm before upload; `rpId.test.ts` pins the record.
+- §5.6 / §7 (Task 7, E25): a gate before upload, in the checklist — ICO confirms that `wallet.noc-tura.io` and every
+  name under it have no DNS record (or only a host that refuses HTTPS) and noc-tura.io no wildcard record, that no
+  certificate covers them (none for the name or `*.wallet.noc-tura.io`, no wildcard `*.noc-tura.io`), and that ICO
+  tells us before any change; the owner checks with `dig` and a Certificate Transparency search, never by opening a
+  Noctura page.
+- §6.1 P3 (Task 3): "The coordinator receives the public address of the account you are viewing and of the first ten
+  accounts in your account list, including accounts you have not used, to read their balances, and the transaction
+  history of the account you are viewing." (the rows read only `FRESH_ROWS = 10`; was "every account in your wallet");
+  the source is `walletApi.ts:341`.
+- §6.1 P5 (Task 3; review M5): adds ", and every 5 seconds after a simulation that fails" (`SIM_RETRY_MS`) and the
+  sentence "When you review one of your sends, the coordinator is also asked, before the simulation, about the address
+  you are sending to: what kind of account it is and, for a token, whether that address already has an account for that
+  token." (`prepare.ts:311`, `:332–333`, before `:370`).
+- §6.1 P8 (Task 3): the last sentence is "The wallet also reads the list of restricted countries, keeping a copy for up
+  to 10 minutes." (the copy is in memory: a restarted worker or a failed read reads again; was "read at most once every
+  10 minutes").
+- §6.1 L1 (Task 3, new, after P9, the controller's ruling): "When you open the Terms, Privacy Policy or Help page from
+  the extension, noc-tura.io receives your IP address and your browser's standard headers, as any website you open
+  does; no referrer is sent." — measured by `e2e/requestHeaders.spec.ts`.
+- §6.1 P4, P7 (Task 3): sources moved (`walletApi.ts:56`; `walletApi.ts:176`).
+- §6.2 (Task 3): R1–R21 written (R2, R8 measured by `e2e/requestHeaders.spec.ts`: no Referer on any request; Origin
+  only on the POSTs, the extension's); `ico-retention.md` omits the paste's "Also:" paragraph.
+- §6.5 (Task 3): Terms and Help titles are #38's labels ("Terms of Service", "Help & support"); comments, `<script>`,
+  `<style>`, `<template>` are removed with their content before the tags; unknown named entities are not decoded (fail
+  closed); numeric 0x80–0x9F decode as Windows-1252; `liveCheck` has no default fetch and `live-check.mjs` no CLI; all
+  three pages are read even after one fails.
+- §6.5 (Task 4, review I4): the Terms page must also NOT carry "DRAFT", "not in force" or "owner's lawyer"
+  (`TERMS_DRAFT_MARKERS`, case-sensitive on the folded text) — the draft's note published by mistake fails the check.
+- §6.4 listing (Tasks 4 and 6): the short description is the manifest's `description` — the store reads it from the
+  package — "A non-custodial Solana wallet: hold, send and receive SOL and tokens, and approve requests from Solana
+  sites." (108 characters; Task 4 kept "Noctura wallet for Solana.", Task 6 replaced it).
+- §6.4 listing (Task 4): the content scripts' justification is under "Content scripts (`<all_urls>`)"; remote code is
+  answered "No." with `script-src 'self'` / no `unsafe-eval` / no `wasm-unsafe-eval` as its reason; the listing names
+  the privacy policy URL and the contact.
+- §6.4 Help (Task 4): "what the coordinator sees" is P1–P8 and P11 verbatim, and the passkey answer P12 and P13
+  verbatim; "why a transaction is blocked" covers the four typed-word blocks (ASSIGN, AUTHORITY, UNCHECKED, UNLIMITED /
+  ALLOWANCE / the symbol) with #10's override, F12's "Presale purchase blocked" (no override), the origin mismatch, a
+  failed or expired simulation, a blocked site and the request budget; the damaged-wallet topic adds the third case of
+  §2.1 (a password-accepted vault whose seed fails: today's `damagedHelp`).
+- §6.4 (Task 4): "presale" is absent from the listing and the Terms; in Help and the data-usage form it appears only in
+  P7 / P8 and F12's own strings (and §6.3's Location cell); "private" only in "private key(s)".
+- §6.3 (Task 4): `data-usage.md` adds a fourth column naming each row's privacy sentences (Location also R12); the three
+  certifications are ticked on R20 (ICO's answer part 5), naming Helius (R17, R18) and CrowdSec central (R15) as within
+  the approved uses and saying that ICO's answer does not name creditworthiness separately.
+- §6.4 Terms (Task 4): the BSL 1.1 paragraph states `LICENSE`'s change date and its "fourth anniversary … whichever
+  comes first" clause and names the Additional Use Grant; the draft lists the lawyer's open points (provider's legal
+  name and address, governing law, eligibility, liability wording and EU consumer law, notice of changes).
+- §6.4 Screenshots (Task 5): the five states are the popup home, #19 (a SOL send's review), #48 (a site's transaction,
+  with the anti-phishing line), `wallet.html#/home` at 1280 × 800 and #35 (the phrase On); made by
+  `npm run screenshots` (`e2e/storeScreenshots.spec.ts`, its own Playwright config, ignored by `npm run e2e` and CI)
+  into the git-ignored `release/screenshots/out/`.
+- §6.4 Screenshots (Task 5): each PNG is checked as written — 1280 × 800, bit depth 8, colour type 2 (24-bit), no
+  `tRNS` (`scripts/png.mjs`, unit-tested on independently encoded PNGs); Chromium writes RGB already, nothing converts.
+- §6.4 Screenshots (Tasks 5 and 6): the TGE-date check uses the gate's `forbiddenForms()` / `dateViolations()` (the
+  text's "`forms()`" does not exist), with a planted positive control, plus a refusal list on the same text (`presale`,
+  failure lines, and — E23 — "stage price" and the word "stage").
+- §6.4 / §9 backdrop (Task 5): the ground is design-system.css's own `body` rule (the accent wash over `--bg-base`),
+  linked by relative path; the frame line is `--bg-surface-3`; the composed frame is byte-equal to the capture.
+- §9 (Task 6, a **design departure**, flagged to the owner): #1's tagline is "A non-custodial Solana wallet. Your keys
+  stay on this device." and its first trust chip "Encrypted on this device" (the design: "A Solana wallet built for
+  private, non-custodial holding." and "E2E encrypted"); #39's footer is "Your recovery phrase and password never leave
+  this device. To read your balances, your accounts' public addresses are sent to the Noctura coordinator." (the
+  design: "The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.");
+  #8's banner is "This phrase is also the root of the Noctura phone app's keys — anyone who gets it from this browser
+  gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one
+  account." (E24; the design named the phone app's "future private (shielded) keys") — each old line a claim the
+  privacy policy contradicts (P3) or the transparent build does not keep. Words only; layout, classes and icons as
+  drawn.
+- §9 (Task 6, a **design departure**, E23): the NOC token row's secondary line is "estimate · not in total" on #11 home
+  and the value's suffix " (estimate)" on #43 and #40 (the design and B1b: "at stage price") — NOC's figure is the
+  balance at the presale stage price, never in a total; no presale wording in the store build.
+- §6.4 / §10 (Task 6, one claims list, a new gate): `scripts/claims.mjs` is the one list of claims the extension does
+  not keep (28: private, privacy, anonymous, untraceable, unlinkable, confidential, end-to-end / E2E, encrypted in
+  transit, zero-knowledge, shielded, incognito, hidden, never see, can't see, no one can see / knows, we don't see /
+  know / receive …, never receive(s), never leave(s), nothing leaves / is sent, stays on this device / local, only on
+  this device, local-only, offline-only, works offline …, no server, no tracking / logs, bank- / military-grade —
+  "private key(s)", "Privacy Policy", its URL path and the contact address excepted), with true sentences allowed by
+  their exact words, each with a verdict and the tiers it holds on (source, built, store, policy), a stale allowance
+  failing; read by `scripts/check-ui-claims.mjs` in `gates:build` (both builds: every built HTML / JS text of
+  `chrome/` and `firefox/`, attributes in any quoting), its source tier in `scripts/__tests__/check-ui-claims.test.mjs`
+  (the HTML entries and `src/` without tests, by the TypeScript parser), and by the store texts' and the privacy
+  policy's tests (`storeTexts.test.mjs` adds "TGE" and its date forms).
+- §6.4 / §10 (Task 6, the limit, review I3): the claims list is a word list — a review aid, not a proof: it reads each
+  literal, template piece, JSX text and HTML text unit alone, so a sentence assembled at run time from pieces, text from
+  data (token names, a site's strings, the coordinator's answers) and CSS `content:` are not read as sentences.
+- §7 (Task 7): the checklist is `extension/release/checklist.md`; it adds the owner / ICO items open before the release
+  (P1, whether `chrome-extension://<id>` is on the coordinator's Origin allow list, the Terms' lawyer, ICO publishing the
+  three pages, and E25's gate for `wallet.noc-tura.io`), the no-`NODE_ENV` check before the one command
+  (`npm ci --ignore-scripts && npm run release:chrome`), the live check's two runs, the screenshots' command and upload
+  order, the notes' commit, step 7's record format and §5.5's evidence as run on 2026-11-05.
+- §10 (Task 7): `release-chrome.test.mjs` proves §5.1's order, both live checks and that each refusal stops everything
+  after it, over an injected io; two of its rows spawn a process — `realIo`'s command environment without `NODE_ENV`,
+  and `build.mjs` refusing a `NODE_ENV` before it builds (with unset and `production` as the positive controls).
+
 **Rev 2.6** (the B1e-1 final review and its fix wave, 2026-11-03; every line is a departure from rev 2.5's text, ruled
 by the controller and recorded in the plan's ledger — the passages named are edited to match):
 - §2.2 (Task 2's ruling): the removal's `no-wallet` outcome shows "No wallet on this browser yet." with [Set up a wallet].
@@ -161,7 +313,7 @@ B1e is cut down to **the first release: Chrome Web Store, presale off**. It is o
 | plan | what |
 |---|---|
 | **B1e-1 — code** | the anti-phishing phrase (§1), the damaged-vault paths (§2), #37's accessible confirmation (§3), the Terms / Privacy / licences / Help links and `licenses.html` (§4), the gates of §4.3 and §1.6 |
-| **B1e-2 — release** | the release build and its checks, the version and the stable ID, the zip (§5); the store material, the privacy policy / terms / help texts for ICO to publish, the live check (§6); the owner's submission checklist (§7) |
+| **B1e-2 — release** | the release build and its checks, the version and the stable ID, the zip (§5); the store material, the privacy policy / terms / help texts for ICO to publish, the live check (§6); the extension's own copy the policy contradicts (#1, #8, #39, the NOC row, the summary) and its guard (rev 2.7); the owner's submission checklist (§7) |
 
 | # | Owner decision (2026-10-30) | Where |
 |---|---|---|
@@ -187,6 +339,10 @@ B1e is cut down to **the first release: Chrome Web Store, presale off**. It is o
 | E20 | (2026-11-02) Onboarding's phrase step stays **count-less**; its overline is **"Optional"**, not "Onboarding" | §1.3 |
 | E21 | (2026-11-02) Phrases that **render blank or draw out of their line are refused**: Default_Ignorable code points, U+2800 and the other blank-rendering characters (the Hangul fillers U+115F / U+1160 / U+3164 / U+FFA0, U+17B4 / U+17B5), stacked combining marks beyond a cap; a phrase holds at least one visible non-mark L / N / S / P character | §1.5 |
 | E22 | (2026-11-02) Keep #37's taller bar with the checkbox, and #35's plain-tone "Off" for the phrase | §3, §1.3 |
+| E23 | (2026-11-06, the B1e-2 plan's review 1 Q2) The NOC row's "at stage price" changes, in the store build and everywhere it shows, to neutral wording; the screenshot check refuses "stage price" | §6.4, §9 |
+| E24 | (2026-11-06, Q3) #8's import banner drops "future private (shielded)"; the phone app's WelcomeScreen loses its "private … E2E encrypted" copy (on the phone app's own branch) | §9 |
+| E25 | (2026-11-06, Q4) **A gate before upload:** no DNS record (or a refusing host) and no certificate covering `wallet.noc-tura.io`, and ICO tells us before any change | §5.6, §7 |
+| E26 | (2026-11-06, Q5) The live check runs **twice**: a pre-check before `verify` (fail fast) and the final check after it, before packing — six GETs per attempt | §5.1, §6.5 |
 
 **Spec rulings (rev 2).** Decisions the review asked the spec to take that need no owner: each is the most secure
 default, with its reason where it is applied. The owner may overturn any. **R1 and R4 are confirmed by the owner
@@ -779,15 +935,36 @@ gates and mutations above.
 
 ### 5.1 `npm run release:chrome`
 
+`scripts/release-chrome.mjs` (rev 2.7): a pure orchestrator, `runRelease(steps)`, over steps built on an injected io
+(`releaseSteps(io)`); the first step that refuses (or throws) stops the run, and nothing is written before step 6. The
+script takes no argument at all — there is no flag that skips a step.
+
+0. **Preflight (rev 2.7):** no `NODE_ENV` in the environment, any value refused (Vite keeps a `NODE_ENV` it finds, and
+   `development` or `test` builds React's development bundle — verify, the witness and the zip would all agree on it;
+   the notes record "NODE_ENV: unset"); the working tree is clean (`git status --porcelain` empty, untracked files
+   included); neither this version's zip nor its notes exist — the notes name a commit, and a written release is never
+   overwritten; `package-lock.json` is present (its sha256 goes into the notes). Every command the release runs gets
+   its environment without `NODE_ENV`, and `build.mjs` itself refuses one other than `production`.
+0a. **The live pre-check (rev 2.7, E26):** §6.5's three GETs before anything is built, so a page that is not live stops
+   the run in seconds.
 1. `npm run verify` (clean; it builds both variants, runs the tests, the CSP, secrets and every gate including
    `check-no-presale.mjs` and §4.3, and `verify-reproducible.mjs`: four builds in temp dirs, one file digest each).
 2. **A third witness (R10, Minor 12):** `node scripts/build.mjs <tmp> --no-presale`; its `chrome/` file digest
    (`web/scripts/build-manifest.mjs`) must equal that of `verify`'s `dist-nopresale/chrome`. The release packs
-   `verify`'s `dist-nopresale/chrome` itself — no fifth build is packed.
-3. The RP-ID record (§5.6, E17): `extension/release/rp-id.json` present and equal to `RP_ID`, else no pack.
-4. The live check (§6.5).
-5. The zip (§5.4), written twice; the two sha256 must be equal.
-6. `extension/release/notes-<version>.md`: version, the zip's sha256, the package's file digest, the commit.
+   `verify`'s `dist-nopresale/chrome` itself — no fifth build is packed. Rev 2.7: a package holding `build-manifest.json`
+   at its root is refused (the digest skips that name, so the witness could not see it).
+3. The RP-ID record (§5.6, E17): `extension/release/rp-id.json` present, exactly E17's record and equal to `RP_ID`, else
+   no pack.
+4. The live check (§6.5), the final one (rev 2.7, E26: the second of the run), each request with a 15 s timeout.
+5. The zip (§5.4), made twice; the two sha256 must be equal; rev 2.7: the zip is read back (the tests' independent
+   reader) and its entries must be the witnessed files one for one — the same paths, the same sha256, the same count —
+   and the package's file digest must still be the witnessed one.
+6. The tree checked again — still clean, the same HEAD (rev 2.7) — then `extension/release/out/noctura-chrome-<version>.zip`
+   (git-ignored) and `extension/release/notes-<version>.md` (the owner commits it), each written first as
+   `<file>.partial` beside it and moved into place (never over an existing file) only when both are written; a write
+   that fails part-way names what it left. The notes: version; the zip's bytes, entry count and sha256; the package's
+   file digest; the commit and that the tree was clean; `package-lock.json`'s sha256; "NODE_ENV: unset"; the RP ID; the
+   Node version; a recipe that installs with `npm ci --ignore-scripts` and reads the digest with `--print-only`.
 
 ### 5.2 Version (I8, R5)
 
@@ -795,18 +972,24 @@ gates and mutations above.
 **One source:** `package.json` gains `"version": "1.0.0"`; `source.mjs` reads it (`readFileSync` of
 `../package.json` relative to its own `import.meta.url`) and the constant goes. `check-permissions.mjs` asserts every
 built manifest's `version` equals `package.json`'s and matches `^\d+\.\d+\.\d+$` (mutation: a hand-edited
-`dist*/chrome/manifest.json` version → fails). #38 shows it through `runtime.getManifest().version`
+`dist*/chrome/manifest.json` version → fails). Rev 2.7: `source.mjs` itself refuses (the build fails) a version Chrome
+would refuse — each of the three numbers 0–65535, no leading zero. #38 shows it through `runtime.getManifest().version`
 (`platform.ts:80`), so the screen, the manifest and the zip's notes agree by construction.
 
 ### 5.3 The stable ID and `key` (I8)
 
 - The Chrome Web Store assigns the ID at the first upload. Its public key is then recorded in
-  `extension/release/store-key.json` (`{id, key}`) in a follow-up commit (§7 step 7).
+  `extension/release/store-key.json` (`{id, key}`) in a follow-up commit (§7 step 7). Rev 2.7: the file is refused
+  unless it is exactly `{id, key}`, `key` one line of canonical base64 of a DER SubjectPublicKeyInfo (no PEM armour),
+  and `id` the ID Chrome derives from `key` (sha256 of the DER, first 16 bytes, hex digits as a–p; a Chromium-observed
+  vector is committed — `scripts/storeKey.mjs`).
 - `render(browser, {key})` in `source.mjs` gains an optional `key`; `scripts/build.mjs` passes it only with
   `--dev-key`, which reads `store-key.json` and refuses when the file is absent. `verify`, the E2E builds and the
-  release never pass it.
+  release never pass it. Rev 2.7: `--dev-key` builds only into a directory named on the command line, never `dist/`,
+  `dist-nopresale/` or any directory under them, and reads the key before building; `render` refuses a key for Firefox.
 - `check-permissions.mjs`: a manifest in `dist/` or `dist-nopresale/` with a `key` fails; a `--dev-key` build's `key`
-  equals the recorded one. Mutation: `render` adding `key` by default → fails.
+  equals the recorded one (rev 2.7: `node scripts/check-permissions.mjs --dev-key <outDir>`). Mutation: `render` adding
+  `key` by default → fails.
 - Development note (in the checklist): an unpacked install carrying the store's key **has the store's ID**, so it and
   the store install cannot coexist in one Chrome profile.
 - Whether the store accepts an uploaded package that carries a matching `key` is not needed: the store package never
@@ -820,12 +1003,17 @@ sha256; STORE has no compressor, so "two builds, one zip, one sha256" holds on a
 26 files (probe), so the size cost is irrelevant to the store. A dependency (`archiver`, `yazl`) would add supply-chain
 surface to the release path and still deflate.
 
-The format, fixed: entries = every file of the package, paths relative with `/`, **sorted (C collation)**, no
-directory entries; local header + data per entry, then the central directory and the end record; version 20, flags
-0 (no data descriptor; every path must be ASCII — a non-ASCII path fails the script), method 0, DOS time 0 and date
-`0x0021` (1980-01-01 00:00), CRC-32 by `zlib.crc32` (Node ≥ 22.2; the package requires ≥ 22.12), sizes in the headers,
-external attributes 0, no extra field, no comment, no zip64 (more than 65 535 entries or 4 GiB fails). Tests: an
-independent reader written in the test parses the zip and compares each entry's bytes and CRC with the package;
+The format, fixed: entries = every regular file of the package, paths relative with `/`, **sorted (C collation)**, no
+directory entries (an empty directory disappears); local header + data per entry, then the central directory and the
+end record; version 20 (rev 2.7: version made by 20 on host 0, version needed 20), flags 0 (no data descriptor; every
+path must be printable ASCII, 0x20–0x7E, with no backslash and no empty, `.` or `..` segment — anything else fails the
+script), method 0, DOS time 0 and date `0x0021` (1980-01-01 00:00), CRC-32 by `zlib.crc32` (Node ≥ 22.2; the package
+requires ≥ 22.12), sizes in the headers, external attributes 0, no extra field, no comment, no zip64 (rev 2.7: at most
+65 534 entries and every 32-bit size / offset at most 0xFFFFFFFE — the all-ones values are zip64's sentinels, APPNOTE
+4.4.1.4). Anything that is not a regular file or a directory (a symlink of any kind, a FIFO, a socket, a device) fails
+the script, and so does a package with no file. `zipStore(dir)` returns the bytes; the CLI
+`node scripts/zip-store.mjs <dir> <out.zip>` refuses an output inside `<dir>` or one that exists. Tests: an
+independent reader written for the tests (`scripts/__tests__/storeZipReader.mjs`, no import) parses the zip and compares each entry's bytes and CRC with the package;
 two runs give one sha256; a changed file changes it; a non-ASCII path is refused.
 
 The published hash is the zip's sha256; the package's file digest stays as the inner check.
@@ -852,7 +1040,16 @@ this product. Nothing in the extension connects to it: `connect-src` admits only
 - **Frozen.** The first passkey a store user enrols is bound to this RP ID for good; changing it later orphans every
   enrolled passkey. **Pre-upload gate:** `release:chrome` refuses to pack unless `extension/release/rp-id.json` exists
   and records `{rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'}`, and its `rpId` equals `RP_ID`;
-  §7 step 3 restates it.
+  §7 step 3 restates it. Rev 2.7: the script reads `RP_ID` from `src/vault/passkey.ts` by its one plain line
+  `export const RP_ID = '<host>';` (no TypeScript loader; any other form refuses), and the record is committed by
+  B1e-2 from the owner's written E17 — §7 step 3 asks the owner to re-confirm it before upload.
+- **Nothing is served there (E25, rev 2.7).** A page at `wallet.noc-tura.io` or at any name under it could ask a store
+  user's browser for the passkey bound to this RP ID, and its PRF output unwraps the vault. Before upload, ICO confirms
+  (recorded in `noc-ops`) that those names have no DNS record (or resolve only to a host that refuses HTTPS) and
+  noc-tura.io has no wildcard record, that no certificate covers them (none for the name or `*.wallet.noc-tura.io`, no
+  wildcard `*.noc-tura.io`), and that ICO tells us before any of it changes; the owner checks with `dig` and a
+  Certificate Transparency search, never by opening a Noctura page (§7, the checklist). Not a code gate: nothing in the
+  extension can observe it.
 - **Pinned (test + mutation).** A new test (`src/vault/__tests__/rpId.test.ts`) asserts
   `` `https://${RP_ID}/*` `` is a `HOST_PERMISSIONS` value (B1e-1) and `RP_ID` equals `rp-id.json`'s (B1e-2, beside the
   pre-upload gate the owner's confirmation fills — rev 2.2). Mutation: the entry
@@ -867,20 +1064,21 @@ Written as files in the repo (`extension/release/`), each claim traceable to the
 
 For `https://noc-tura.io/extension/privacy`, written as `extension/release/privacy.md`. Its **required sentences** are
 exported verbatim by `extension/release/privacySentences.mjs` (the one list the unit test and the live check both
-read, §6.5). Re-derived from the `--no-presale` build's real network calls: `connect-src` admits one host
+read, §6.5) — rev 2.7: in the order P1–P9, L1, P10–P16, R1–R21. Re-derived from the `--no-presale` build's real network calls: `connect-src` admits one host
 (`REQUIRED_CONNECT_SRC`); the routes it reaches are §4.3's list; their call sites are named below.
 
 | # | sentence | source |
 |---|---|---|
 | P1 | "The extension itself connects to one server only: api.noc-tura.io, the Noctura coordinator." | `EXTENSION_CSP` `connect-src`; `deps.ts` `browserDeps` |
 | P2 | "Every request to the coordinator carries your IP address and the standard headers your browser sends." | every route, `deps.ts` |
-| P3 | "The coordinator receives the public address of every account in your wallet, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing." | `wallet.balances` (`walletApi.ts:336`) per account — the popup's rows (`useAccountBalances`, `FRESH_ROWS`), #37's reading of all accounts; history (`getSignaturesForAddress`) |
-| P4 | "When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds." | `wallet.probeBalances`, `MAX_PROBE = 6` (`walletApi.ts:53`), `probeCandidates` (`onboarding.ts`) |
-| P5 | "Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it." | `prepare.ts:370`; `dapp/simulate.ts:304`; `SIM_REFRESH_MS` (`signTx.ts:39`) |
+| P3 | "The coordinator receives the public address of the account you are viewing and of the first ten accounts in your account list, including accounts you have not used, to read their balances, and the transaction history of the account you are viewing." (rev 2.7) | `wallet.balances` (`walletApi.ts:341`) — the account viewed and the popup's rows (`useAccountBalances`, `FRESH_ROWS = 10`: switcher, accounts manager, #37); history (`getSignaturesForAddress`) |
+| P4 | "When you import a recovery phrase, the coordinator receives the public addresses of up to six accounts derived from it, to find the ones that hold funds." | `wallet.probeBalances`, `MAX_PROBE = 6` (`walletApi.ts:56`), `probeCandidates` (`onboarding.ts`) |
+| P5 | "Before you sign, the full contents of the transaction are sent to the coordinator to simulate it: your own sends, and every transaction a site asks you to sign, again every 30 seconds while the approval window shows it, and every 5 seconds after a simulation that fails. When you review one of your sends, the coordinator is also asked, before the simulation, about the address you are sending to: what kind of account it is and, for a token, whether that address already has an account for that token." (rev 2.7) | `prepare.ts:370`; `dapp/simulate.ts:304`; `SIM_REFRESH_MS`, `SIM_RETRY_MS` (`signTx.ts:39`, `:43`); the recipient first: `getAccountKind` (`prepare.ts:311`, `:332`), `getAccountExists` (`:333`) |
 | P6 | "Every transaction the wallet submits is sent to the coordinator, which broadcasts it to Solana: your own sends, and the transactions a site asks the wallet to sign and send. A transaction a site asks only to sign is returned to that site." | `/tx/broadcast` (`core/solana/broadcast.ts`); `finishSend` vs `finishSignTx` (`signTx.ts`) |
-| P7 | "The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data." | `PRICE_PATH` (`core/portfolio/prices.ts`); `/stats` (`deps.ts` `stagePrice`; callers `prepare.ts:180`, `walletApi.ts:171`, `dapp/simulate.ts:226`) |
-| P8 | "Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The list of restricted countries is read at most once every 10 minutes." | `carriesPurchase` / `runSimulation` (`signTx.ts:106`), `decide.ts:341`; `GEO_LIST_CACHE_MS` (`geo/gate.ts`); the other caller, `presale/buy.ts`, is not in the store build (`check-no-presale.mjs` rule 1: nothing under `src/background/presale/`) |
+| P7 | "The wallet reads prices for SOL, USDC and USDT, and the public presale statistics to price NOC; these requests carry no wallet data." | `PRICE_PATH` (`core/portfolio/prices.ts`); `/stats` (`deps.ts` `stagePrice`; callers `prepare.ts:180`, `walletApi.ts:176`, `dapp/simulate.ts:226`) |
+| P8 | "Only when a site asks you to sign a transaction that contains a Noctura presale purchase does the wallet ask the coordinator which country your IP address is in: on each simulation of that transaction and again when you approve it. The wallet also reads the list of restricted countries, keeping a copy for up to 10 minutes." (rev 2.7) | `carriesPurchase` / `runSimulation` (`signTx.ts:106`), `decide.ts:341`; `GEO_LIST_CACHE_MS` (`geo/gate.ts`, in memory: a restarted worker or a failed read reads again); the other caller, `presale/buy.ts`, is not in the store build (`check-no-presale.mjs` rule 1: nothing under `src/background/presale/`) |
 | P9 | "When you open a transaction in the Solscan explorer, Solscan receives that transaction's signature, your IP address and your browser's standard headers; no referrer is sent." | `explorer.ts`; `rel="noopener noreferrer"` (`TxDetail.tsx:65`) |
+| L1 | "When you open the Terms, Privacy Policy or Help page from the extension, noc-tura.io receives your IP address and your browser's standard headers, as any website you open does; no referrer is sent." (rev 2.7, the controller's ruling) | `NOCTURA_PAGES` (`src/shared/links.ts`), `rel="noopener noreferrer"` on #1 and #38; measured by `e2e/requestHeaders.spec.ts` |
 | P10 | "Messages a site asks you to sign are signed on this device and are not sent anywhere by the wallet." | `dapp/signMessage.ts` (no network dependency) |
 | P11 | "Your recovery phrase, private keys, password and anti-phishing phrase never leave this device through the extension." | vault isolation gate; routes above |
 | P12 | "If your passkeys sync, your passkey provider (for example Google Password Manager) stores the passkey; Noctura never receives it. In your passkey manager the passkey is listed under the name wallet.noc-tura.io." | the WebAuthn ceremony is the browser's; no route carries it; `RP_ID` (`passkey.ts:8`) |
@@ -913,7 +1111,9 @@ until ICO answers. The question, exactly:
 > Answer in sentences we can publish verbatim, each true of production today.
 
 Done when: the answers are recorded in `extension/release/ico-retention.md` with the date and ICO's commit, and turned
-into sentences R1… of §6.1. **Also inherited** (B1d §6.5, §7): P1 — the automatic OFAC refresh of
+into sentences R1… of §6.1. Rev 2.7: done — received 2026-11-01, R1–R21 written (R2 and R8 the extension's own measured
+headers, `e2e/requestHeaders.spec.ts`: no Referer on any request, Origin only on the POSTs); the paste's "Also:"
+paragraph is omitted from the public file, which says so. **Also inherited** (B1d §6.5, §7): P1 — the automatic OFAC refresh of
 `/geo/restricted-list` — because F12 runs in the store build and fails closed on a stale list; ICO confirms it before
 the release. P2a and P2b do not apply: the store build names no `/solana/purchase` (§4.3).
 
@@ -935,6 +1135,10 @@ Certifications: the data is not sold to third parties; not used or transferred f
 purpose; not used to determine creditworthiness or for lending — each ticked **only after §6.2's answer confirms it
 for the coordinator**. "Remote code: none" — CSP `script-src 'self'`, no `wasm-unsafe-eval` (`EXTENSION_CSP`,
 pinned by `check-permissions.mjs` `REQUIRED_CSP`). Privacy policy URL: `https://noc-tura.io/extension/privacy`.
+Rev 2.7: `extension/release/data-usage.md` carries this table row for row plus a fourth column naming each row's
+privacy sentences (Location also R12); the three certifications are ticked on R20 (ICO's answer part 5), naming Helius
+(R17, R18) and CrowdSec central (R15) as within the approved uses and saying that ICO's answer does not name
+creditworthiness separately.
 
 `data_collection_permissions` is AMO-only (`browser_specific_settings.gecko`); the Chrome manifest carries none
 (Minor 11, §8).
@@ -942,49 +1146,81 @@ pinned by `check-permissions.mjs` `REQUIRED_CSP`). Privacy policy URL: `https://
 ### 6.4 Terms, Help, listing, screenshots
 
 - **Terms** — a **draft for the owner's lawyer**, not legal text: non-custodial software, the user holds the keys and
-  the responsibility, no financial advice, no warranty, the BSL 1.1 licence, the contact.
+  the responsibility, no financial advice, no warranty, the BSL 1.1 licence, the contact. Rev 2.7: the licence paragraph
+  is `LICENSE`'s (the change date, its "fourth anniversary … whichever comes first" clause, the Additional Use Grant);
+  the draft lists the lawyer's open points (`extension/release/terms.md`).
 - **Help** — a short FAQ: the recovery phrase; the anti-phishing phrase (§1.1's two limits, Minor 3); a damaged wallet
   (the two states of §2, saving the data); why a passkey shows as "wallet.noc-tura.io" (P12, P13); why a transaction
   is blocked; what the coordinator sees (P1–P8); the
-  contact.
-- **Store listing** — name, short description (≤ 132 characters), detailed description, category (the owner picks at
+  contact. Rev 2.7 (`extension/release/help.md`): the coordinator's view is P1–P8 and P11 verbatim and the passkey answer
+  P12 and P13 verbatim; "why a transaction is blocked" covers the four typed-word blocks with #10's override, F12's
+  "Presale purchase blocked" (no override), the origin mismatch, a failed or expired simulation, a blocked site and the
+  request budget; the damaged-wallet topic adds §2.1's third case (today's `damagedHelp`).
+- **Store listing** (`extension/release/listing.md`) — name, short description (≤ 132 characters; rev 2.7: the
+  manifest's `description`, which the store reads from the package — "A non-custodial Solana wallet: hold, send and
+  receive SOL and tokens, and approve requests from Solana sites."), detailed description, category (the owner picks at
   submission), the single-purpose statement ("A Solana wallet: hold, send and receive SOL and tokens, and approve
   requests from Solana sites."), a justification for each permission taken from `manifest/source.mjs`'s reasons
   (`PERMISSIONS`, `HOST_PERMISSIONS`, `CONTENT_SCRIPTS.reason`) — for `https://wallet.noc-tura.io/*` it adds, per
   E17: "No page is served at this host and the extension never connects to it (its content security policy allows
   connections to one other host only). The permission exists only so the passkey is bound to a name no website can
-  use; passkeys appear under this name in the user's passkey manager." — "remote code: none", and §6.3's answers. **No
+  use; passkeys appear under this name in the user's passkey manager." — "remote code: none" (rev 2.7: answered "No."
+  with `script-src 'self'` / no `unsafe-eval` / no `wasm-unsafe-eval` as its reason; the content scripts' justification
+  under "Content scripts (`<all_urls>`)"; the privacy policy URL and the contact named), and §6.3's answers. **No
   presale, no TGE date, no privacy claim the build does not keep** (memory "shielded privacy guarantee": the extension
-  is transparent; nothing says "private" or "anonymous").
+  is transparent; nothing says "private" or "anonymous"). Rev 2.7: "presale" is absent from the listing and the Terms;
+  in Help and the data-usage form it appears only in P7 / P8 and F12's own strings (and §6.3's Location cell);
+  "private" only in "private key(s)". The extension's own screens are held to the same rule by one claims list,
+  `scripts/claims.mjs`, read by `scripts/check-ui-claims.mjs` and by the store texts' and the privacy policy's tests
+  (§10) — a word list, a review aid, not a proof.
 - **Screenshots (Minor 9)** — five at 1280 × 800, by Playwright from the real `--no-presale` extension, contained (no
   network, the coordinator stubbed as the E2E suite does). The UI tab (`wallet.html`) is captured at a 1280 × 800
   viewport; the popup (412 × 600) and the approval window are captured at their real size and **composed 1 : 1,
   unscaled**, centred on a 1280 × 800 page of the design background (`extension/release/screenshots/backdrop.html`,
   undrawn, §9). The TGE-date check runs on each captured state's **text** (`document.body.innerText` against
-  `forms()` of `scripts/check-no-tge-date.mjs`), not on the pixels.
+  `forbiddenForms()` / `dateViolations()` of `scripts/check-no-tge-date.mjs` — rev 2.7: there is no `forms()`), not on
+  the pixels. Rev 2.7: the five states are the popup home, #19 (a SOL send's review), #48 (a site's transaction, with
+  the anti-phishing line), `wallet.html#/home` and #35 (the phrase On); `npm run screenshots`
+  (`e2e/storeScreenshots.spec.ts`, its own Playwright config, ignored by `npm run e2e` and CI) writes them to the
+  git-ignored `extension/release/screenshots/out/`; each PNG is read back — 1280 × 800, bit depth 8, colour type 2
+  (24-bit), no `tRNS` (`scripts/png.mjs`) — and the text check adds a planted positive control and a refusal list
+  (`presale`, failure lines, and — E23 — "stage price" and the word "stage").
 
 ### 6.5 The live check (I7)
 
-Part of `release:chrome` only — never in `verify`, CI, a test, or under `unshare -rn`.
+Part of `release:chrome` only — never in `verify`, CI, a test, or under `unshare -rn`. Rev 2.7: `liveCheck` has no
+default fetch and `live-check.mjs` no CLI; the release script hands it a fetch with a 15 s timeout per request, and
+(E26) runs it twice — a pre-check before `verify` and the final check before the zip.
 - Three `GET`s, one at a time, `redirect: 'manual'`: `https://noc-tura.io/extension/{privacy,terms,help}` must each
   answer **200** (a redirect fails). Three requests to `noc-tura.io` (not `api.`) cannot reach CrowdSec's
-  `http-probing` threshold (B1 §5: 10 distinct 4xx paths in 10 s).
+  `http-probing` threshold (B1 §5: 10 distinct 4xx paths in 10 s); rev 2.7: nor can the run's six — three distinct
+  paths, the two checks minutes apart.
 - The privacy page must contain **every sentence of `privacySentences.mjs`** (P1–P16, then R…), compared after:
   removing tags, decoding HTML entities (named and numeric), NFC, folding `’` to `'` and `“ ”` to `"`, and folding
   every whitespace run (NBSP included) to one space; a substring test per sentence, case-sensitive. Terms and Help
-  must each contain their page title and "privacy@noc-tura.io".
+  must each contain their page title and "privacy@noc-tura.io". Rev 2.7: the titles are #38's labels ("Privacy Policy",
+  "Terms of Service", "Help & support"); comments, `<script>`, `<style>` and `<template>` are removed with their content
+  before the tags; an unknown named entity is not decoded (fail closed); numeric 0x80–0x9F decode as Windows-1252; all
+  three pages are read even after one fails (never a retry). Rev 2.7 (review I4): the Terms page must also not carry
+  "DRAFT", "not in force" or "owner's lawyer" (`TERMS_DRAFT_MARKERS`, case-sensitive on the folded text).
 - **Controls (unit tests of the comparison, offline, fixture HTML):** all sentences → pass; one sentence with one
   word changed → fail naming that sentence; one sentence missing → fail; a sentence split by `<b>…</b>` and a line
   break → pass; a 301 → fail; a 404 → fail. And `privacy.md` contains every sentence verbatim (offline test).
 
 ## 7. The owner's submission checklist (B1e-2 writes it)
 
+Rev 2.7: written as `extension/release/checklist.md` — the steps below with their exact commands and files, the items
+open before the release (P1, whether `chrome-extension://<id>` is on the coordinator's Origin allow list, the Terms'
+lawyer, ICO publishing the three pages, and E25's gate: nothing served at `wallet.noc-tura.io`, no certificate for it),
+the no-`NODE_ENV` check before `npm ci --ignore-scripts && npm run release:chrome`, the live check's two runs (E26), the
+screenshots' command and upload order, the notes' commit, the dev-key note and §5.5's evidence as run on 2026-11-05.
+
 1. Developer account (5 USD fee, 2-step verification, a verified contact e-mail, the EU trader / non-trader
    declaration).
 2. ICO's §6.2 answers recorded; P1 (OFAC refresh) confirmed; the privacy policy, Terms (approved by the owner or a
-   lawyer) and Help published by ICO; `release:chrome`'s live check passes.
+   lawyer) and Help published by ICO; `release:chrome`'s live check passes (rev 2.7: both of its runs).
 3. Before upload: `extension/release/rp-id.json` records the owner's confirmation of the RP ID (E17, §5.6) —
-   `release:chrome` refuses to pack without it. Upload the zip, paste the listing and §6.3's answers, add the
+   `release:chrome` refuses to pack without it; ICO's E25 confirmation for `wallet.noc-tura.io` is in hand (§5.6). Upload the zip, paste the listing and §6.3's answers, add the
    screenshots. Submitting for store review **with
    publishing deferred** (the owner publishes manually after approval) may happen now (E14).
 4. **The independent external security review (B1 release gate 2; vendor and cost are the owner's) is done before
@@ -1013,13 +1249,26 @@ then today's help stays (uninstall, reinstall, import the phrase) — §2.1.
 
 The anti-phishing phrase line (and R9's "could not be read" line), its onboarding step and its Security row; the two
 damaged states, "Save the damaged data" and the removal screen; #37's checkbox (and the same on the removal screen);
-`licenses.html`; the screenshot backdrop. Each is built from the design system's existing components (B1b's banner,
+`licenses.html`; the screenshot backdrop (rev 2.7: the ground is design-system.css's own `body` rule, linked by
+relative path, the frame line `--bg-surface-3`, the composed frame byte-equal to the capture). Each is built from the design system's existing components (B1b's banner,
 input and row styles; `licenses.html` has no stylesheet at all) and shown to the owner in the visual pass of B1e-1
 (B1e-2 for the backdrop). Rev 2.6: the design system's gutter and spacing are binding on them, and the visual pass
 asserts the geometry — the window's phrase line at the body's 20 px content gutter (and 20 px from the locked window's
 top), the step's field / refused line / helper / help --space-2 apart, #35's card's own --space-3, and the save note
 directly under Save.
 
+**Design departure (rev 2.7, flagged to the owner).** #1's tagline and first trust chip and #39's footer are drawn
+with words the privacy policy contradicts (P3) or the transparent build does not keep; B1e-2 replaces the words only
+(layout, classes and icons as drawn): #1 "A non-custodial Solana wallet. Your keys stay on this device." (was "A Solana
+wallet built for private, non-custodial holding.") and "Encrypted on this device" (was "E2E encrypted"); #39 "Your
+recovery phrase and password never leave this device. To read your balances, your accounts' public addresses are sent
+to the Noctura coordinator." (was "The recovery flow is offline-only. We never see your seed phrase, your password, or
+your wallet address."); #8's banner "This phrase is also the root of the Noctura phone app's keys — anyone who gets it
+from this browser gets those too. Accounts after the first one exist only in this extension until the phone app
+supports more than one account." (E24; was naming the phone app's "future private (shielded) keys"); the NOC token
+row's secondary line "estimate · not in total" on #11 and the suffix " (estimate)" on #43 and #40 (E23; was "at stage
+price"). The design file is the owner's to update.
+
 ## 10. Tests and gates (both plans)
 
 Unit tests for every rule above with positive and negative controls and named mutations (§1.6, §2.6, §3, §4.2–§4.4,
@@ -1032,7 +1281,13 @@ page at 412 × 916 and the approval window at 412 × 720. R9's E2E strips the `p
 background always sends a valid one (rev 2.2). `scripts/__tests__/presaleBuilds.test.mjs` runs `build.mjs` with
 `NODE_ENV` removed (rev 2.3, review M7): it is the only test that runs the build, and `verify` and CI run it with no
 `NODE_ENV`, so the test checks the production build that ships — nothing else changes. No test contacts
-`*.noc-tura.io`; only the release script's live check does.
+`*.noc-tura.io`; only the release script's live check does. Rev 2.7 (B1e-2): `check-ui-claims.mjs` joins `gates:build`
+(both builds; its source tier is a unit test), reading the one claims list `scripts/claims.mjs` that the store texts' and
+the privacy policy's tests read too; `release-chrome.test.mjs` proves §5.1's order, both live checks and that each
+refusal stops everything after it, over an injected io (no verify, build or network); `build.mjs` refuses a `NODE_ENV`
+other than unset or `production` (review C1 — a test that runs it must still remove vitest's), proved by spawning it
+with arguments it would refuse next; `rpId.test.ts` pins `rp-id.json`; the screenshots' PNG reader is unit-tested, the
+screenshots themselves are made by `npm run screenshots`, outside CI.
 
 ## 11. Open questions for the owner
 
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, reproducible, the TGE checks.**

```bash
cd extension
TZ=UTC npx vitest run src/vault/__tests__/rpId.test.ts scripts/__tests__/release-chrome.test.mjs scripts/__tests__/storeKey.test.mjs scripts/__tests__/storeTexts.test.mjs
npx tsc --noEmit; echo "tsc exit $?"
TZ=UTC npx vitest run
TZ=UTC npx vitest run --config vitest.nopresale.config.ts
rm -rf dist dist-nopresale && npm run build && npm run csp && npm run secrets && npm run gates && npm run reproducible
node scripts/check-no-tge-date.mjs && (cd .. && node scripts/check-no-tge-date.mjs)
```
Observed (dry run, 9f42f00):
- the four files: `Test Files  4 passed (4)` · `Tests  125 passed | 1 skipped (126)` (`release-chrome.test.mjs` alone `Tests  77 passed (77)`; `storeTexts.test.mjs` 14 — the spec edits keep §6.3's table, the single purpose and the E17 paragraph; the skip is `storeKey.test.mjs`'s "once recorded" row, until §7 step 7);
- `tsc exit 0`;
- `Test Files  248 passed (248)` · `Tests  5530 passed | 1 skipped (5531)`;
- no-presale: `Test Files  22 passed (22)` · `Tests  550 passed | 25 skipped (575)`;
- build exit 0; `CSP ok: dist/app needs no unsafe-inline or unsafe-eval`, the same for `dist-nopresale/app`; secrets exit 0; every `gates:build` line `ok` for `dist` and `dist-nopresale` (`permissions ok (dist-nopresale): both manifests match manifest/source.mjs, version 1.0.0, no key` … `ui claims ok (dist-nopresale): 40 built HTML / JS files of chrome/ and firefox/, no claim the privacy policy contradicts (17 allowances used)`), `no presale ok (dist-nopresale off, dist on): …`, gates exit 0;
- reproducible — unchanged from the base tree (`build.mjs`'s edits refuse before building; nothing a build writes changed; the no-presale chrome digest is the unset build measured on `ac181aa`, C1's note):
  ```
  reproducible: presale chrome 28 files sha256:8771d0680f47c8c65dfee8410b1575723665b577334d76fef9fa3c839afd105a
  reproducible: presale firefox 28 files sha256:f5c5c445259dd65d46291345af0f5ac78bcb47edd667bc1ac37b4c3936b39e86
  reproducible: no-presale chrome 28 files sha256:99fa0f0242928f3ceedbb392e765fe699b73d3af9f40d36c25b6f2f17681a3dc
  reproducible: no-presale firefox 28 files sha256:4c8fcc213acc263c762044e431adcd8602ed435d489a0989b003d774304b4c98
  ```
- `no TGE date (dist present): 750 source and built files checked`; repo-wide `no TGE date in 1406 tracked text files`;
- the escaped / look-alike character check (widened, Notes) over `git diff 0fcf769 -- extension core` → `0`, over `git diff ac181aa -- extension core` → `0`.

- [ ] **Step 5: The whole Playwright suite (the task adds no spec; `build.mjs` changed, so the suite runs on this tree's builds).**

```bash
cd extension
nohup sh -c 'npx playwright test; echo "PW-END $?"' > pw.log 2>&1 &
# then, after PW-END:
nohup unshare -rn sh -c 'ip link set lo up && npx playwright test; echo "PW-END $?"' > pw-unshare.log 2>&1 &
npm run screenshots
```
Observed: on `9f42f00` (the builds Step 4 made), `123 passed (30.6m)` normally and `123 passed (30.7m)` under `unshare -rn` (each `PW-END 0`); `npm run screenshots` → `1 passed (15.5s)`, the five PNGs written to `release/screenshots/out/` (`1-home.png` … `5-security.png`); `git status --porcelain` empty afterwards.

- [ ] **Step 6: Commit.**

```bash
git add extension/scripts/release-chrome.mjs extension/scripts/__tests__/release-chrome.test.mjs extension/scripts/build.mjs extension/scripts/__tests__/storeKey.test.mjs extension/release/rp-id.json extension/release/checklist.md extension/src/vault/__tests__/rpId.test.ts extension/package.json extension/.gitignore docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md
git commit -m "feat(extension): B1e-2 npm run release:chrome — a preflight refusing any NODE_ENV, a dirty tree, a packed version or no lockfile; the live pre-check; spec §5.1's steps in order (verify, the third witness refusing a build-manifest.json, the RP-ID record, the final live check with a 15 s timeout and no skip flag, the STORE zip twice, read back and bound one for one to the witnessed files), each refusal stopping everything after it; the write via .partial names moved into place only when both are written, a part-way failure naming what it left; build.mjs refusing a NODE_ENV other than production and --dev-key under dist*/; release/rp-id.json records E17 and rpId.test.ts pins it; release/checklist.md for the owner with E25's gate and §5.5's evidence; spec rev 2.7

Co-Authored-By: <the executing model> <noreply@anthropic.com>"
```
(Dry run: `9f42f00`, `dry(b1e2): Task 7 — npm run release:chrome (spec §5.1: a preflight refusing any NODE_ENV, a dirty tree, a packed version or no lockfile; the live pre-check; verify; the third witness, refusing a build-manifest.json; the RP-ID record; the final live check; the zip twice, read back and bound one for one to the witnessed files; the write via .partial names and hard links, a part-way failure naming what it left), build.mjs refusing a NODE_ENV other than production and --dev-key under dist*/, release/rp-id.json (E17) pinned by rpId.test.ts, the owner's checklist with the E25 gate for wallet.noc-tura.io, spec rev 2.7`, 10 files, 1664 insertions, 42 deletions.)

- [ ] **Step 7: The named mutations — each alone, in a fresh `git archive HEAD` copy (`extension/node_modules` and `web/node_modules` symlinked), `timeout 300`; `tsc`'s own exit code first (0 for every row: `.mjs` and `.json` are outside `tsconfig.json`, `passkey.ts` keeps its type), then `TZ=UTC npx vitest run scripts/__tests__/release-chrome.test.mjs src/vault/__tests__/rpId.test.ts scripts/__tests__/storeKey.test.mjs` (112: 77 + 4 + 31, one of them skipped).** `RC` = `scripts/release-chrome.mjs`, `BM` = `scripts/build.mjs`. No mutant can reach the world: every release test drives an injected io, the CLI is never spawned (a mutant of the argument check would otherwise run the real verify and the live check), and the spawned `build.mjs` rows exit before building.

| id | the change | observed |
|---|---|---|
| M-reorder | RC `'witness', 'rpId', 'liveCheck', 'zip'` → `'witness', 'liveCheck', 'rpId', 'zip'` | tsc 0 · RED `4 failed \| 107 passed \| 1 skipped (112)` — “is §5.1 in order, after a preflight and the live pre-check: verify, the third witness, the RP-ID record, the live check, the zip twice, the write”; “the RP-ID record absent: refused before the final live check and the zip”; “the RP-ID record not JSON: refused before the final live check and the zip”; +1 more |
| M-skip-rpid | RC `'witness', 'rpId', 'liveCheck'` → `'witness', 'liveCheck'` | tsc 0 · RED `7 failed \| 103 passed \| 1 skipped (111)` — “is §5.1 in order, after a preflight and the live pre-check: verify, the third witness, the RP-ID record, the live check, the zip twice, the write”; “refuses a missing step and a step that answers nothing usable, before running anything after it”; “all green: every effect in order, the zip and the notes written last, nothing else left”; +4 more |
| M-skip-live | RC `'rpId', 'liveCheck', 'zip'` → `'rpId', 'zip'` | tsc 0 · RED `5 failed \| 105 passed \| 1 skipped (111)` — “is §5.1 in order, after a preflight and the live pre-check: verify, the third witness, the RP-ID record, the live check, the zip twice, the write”; “refuses a missing step and a step that answers nothing usable, before running anything after it”; “the live check runs twice: three GETs before verify (nothing built yet), three after the RP-ID record — six per run”; +2 more |
| M-single-zip | RC `const second = io.zip(PACKAGE);` → `const second = first;` | tsc 0 · RED `2 failed \| 109 passed \| 1 skipped (112)` — “all green: every effect in order, the zip and the notes written last, nothing else left”; “the two zips differ: refused, nothing written” |
| M-continue | RC `if (result.problems.length > 0) {⏎ const left` → `if (false) {⏎ const left` | tsc 0 · RED `42 failed \| 69 passed \| 1 skipped (112)` — “a refusal at preflight stops everything after it (and a throw is a refusal)”; “a refusal at livePrecheck stops everything after it (and a throw is a refusal)”; “a refusal at verify stops everything after it (and a throw is a refusal)”; +39 more |
| M-throw-ok | RC `` result = {problems: [`${name}: ${message(e)}`]}; `` → `result = {problems: []};` | tsc 0 · RED `9 failed \| 102 passed \| 1 skipped (112)` — “a refusal at preflight stops everything after it (and a throw is a refusal)”; “a refusal at livePrecheck stops everything after it (and a throw is a refusal)”; “a refusal at verify stops everything after it (and a throw is a refusal)”; +6 more |
| M-witness-off | RC `if (third.digest !== verified.digest)` → `if (false)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the third witness differs from verify’s package: refused before the RP-ID record, the live check and the zip” |
| M-witness-empty | RC `if (third.files.length === 0 \|\| verified.files.length === 0)` → `if (false)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the third build fails, or is empty: refused (the temp dir removed either way)” |
| M-rp-e17 | RC `for (const [field, expected] of Object.entries(RP_ID_RECORD))` → `for (const [field, expected] of Object.entries(RP_ID_RECORD).filter(([f]) => f !== 'rpId'))` | tsc 0 · RED `2 failed \| 109 passed \| 1 skipped (112)` — “the RP-ID record names another host: refused before the final live check”; “refuses a record and a passkey.ts moved together to another host — 1.0.0 freezes the name, not just their agreement” |
| M-rp-source | RC `if (value.rpId !== rpId) out.push` → `if (false) out.push` | tsc 0 · RED `2 failed \| 109 passed \| 1 skipped (112)` — “the RP-ID record names another host: refused before the final live check”; “refuses a record that disagrees with passkey.ts” |
| M-rp-fields | RC `if (names.join(',') !== want.join(','))` → `if (!want.every(n => names.includes(n)))` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “refuses an extra field” |
| M-reader-quotes | RC `const line = /^export const RP_ID = '([a-z0-9.-]+)';$/m.exec(text);` → `const line = /RP_ID = ['"]([a-z0-9.-]+)['"];/m.exec(text);` | tsc 0 · RED `3 failed \| 108 passed \| 1 skipped (112)` — “passkey.ts no longer says RP_ID plainly: refused (the reader fails closed)”; “the reader refuses double quotes”; “the reader refuses not exported” |
| M-reader-count | RC `if (declarations.length !== 1 \|\| line === null)` → `if (line === null)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the reader refuses a second declaration” |
| M-dirty-ok | RC `if (lines.length === 0) return [];` → `return [];` | tsc 0 · RED `3 failed \| 108 passed \| 1 skipped (112)` — “a dirty working tree: refused before verify, the paths named as the repository root has them”; “the tree changed during the run (dirty, or another HEAD): refused at the write, nothing written”; “treeProblems: an empty status is clean, anything else is listed” |
| M-recheck-off | RC `` never overwritten`);⏎ if (problems.length > 0) return {problems}; `` → `` never overwritten`); `` | tsc 0 · RED `5 failed \| 106 passed \| 1 skipped (112)` — “the tree changed during the run (dirty, or another HEAD): refused at the write, nothing written”; “release/out/noctura-chrome-1.0.0.zip appears during the run: refused at the write, nothing written, nothing overwritten”; “release/notes-1.0.0.md appears during the run: refused at the write, nothing written, nothing overwritten”; +2 more |
| M-overwrite | RC `` if (io.exists(path))⏎ problems.push(`${path} exists — version `` → `` if (false)⏎ problems.push(`${path} exists — version `` | tsc 0 · RED `2 failed \| 109 passed \| 1 skipped (112)` — “release/out/noctura-chrome-1.0.0.zip already exists: refused before verify, never overwritten”; “release/notes-1.0.0.md already exists: refused before verify, never overwritten” |
| M-timeout | RC `(url, init) => fetch(url, {...init, signal: AbortSignal.timeout(ms)});` → `(url, init) => fetch(url, init);` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the live check’s fetch carries a timeout: the request is aborted after LIVE_TIMEOUT_MS” |
| M-cli-skip | RC `argv => (argv.length === 0 ? null : USAGE)` → `argv => (argv.length === 0 \|\| argv[0] === '--skip-live-check' ? null : USAGE)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “no skip flag: any argument is refused with the usage line” |
| M-digest-after-zip | RC `if (now.digest !== done.witness.digest)` → `if (false)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the package digest after zipping must still be the witnessed one” |
| M-wx | RC `{flag: 'wx'}` → `{flag: 'w'}` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “realIo writes without overwriting, moves into place without overwriting, and reads an absent file as undefined (a temp root)” |
| M-notes-commit | RC `` `- Commit: \`${commit}\`, working tree clean`,⏎ `` → (removed) | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe” |
| M-gitignore | `.gitignore` `release/out/⏎` → (removed) | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the zip and notes paths: the zip under the git-ignored release/out/, the notes beside the other release texts” |
| M-rpjson-host | `release/rp-id.json` `"rpId": "wallet.noc-tura.io"` → `"rpId": "passkey.noc-tura.io"` | tsc 0 · RED `20 failed \| 91 passed \| 1 skipped (112)` — “the live check runs twice: three GETs before verify (nothing built yet), three after the RP-ID record — six per run”; “all green: every effect in order, the zip and the notes written last, nothing else left”; “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe”; +17 more |
| M-rpjson-extra | `release/rp-id.json` `"decision": "E17"}` → `"decision": "E17", "note": "x"}` | tsc 0 · RED `20 failed \| 91 passed \| 1 skipped (112)` — “the live check runs twice: three GETs before verify (nothing built yet), three after the RP-ID record — six per run”; “all green: every effect in order, the zip and the notes written last, nothing else left”; “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe”; +17 more |
| M-rpjson-order | `release/rp-id.json` `{"rpId": "wallet.noc-tura.io", "confirmedBy": "owner",` → `{"confirmedBy": "owner", "rpId": "wallet.noc-tura.io",` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “equals the owner’s record: release/rp-id.json is exactly {rpId: RP_ID, confirmedBy: owner, decision: E17}” |
| M-passkey-host | `src/vault/passkey.ts` `RP_ID = 'wallet.noc-tura.io'` → `RP_ID = 'passkey.noc-tura.io'` | tsc 0 · RED `24 failed \| 87 passed \| 1 skipped (112)` — “the live check runs twice: three GETs before verify (nothing built yet), three after the RP-ID record — six per run”; “all green: every effect in order, the zip and the notes written last, nothing else left”; “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe”; +21 more |
| M-nodeenv-off | RC `if (io.env.NODE_ENV !== undefined) problems.push` → `if (false) problems.push` | tsc 0 · RED `4 failed \| 107 passed \| 1 skipped (112)` — “NODE_ENV="development" in the environment: refused at the preflight, nothing run, no GET”; “NODE_ENV="test" in the environment: refused at the preflight, nothing run, no GET”; “NODE_ENV="production" in the environment: refused at the preflight, nothing run, no GET”; +1 more |
| M-nodeenv-prod | RC `if (io.env.NODE_ENV !== undefined) problems.push` → `if (io.env.NODE_ENV !== undefined && io.env.NODE_ENV !== 'production') problems.push` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “NODE_ENV="production" in the environment: refused at the preflight, nothing run, no GET” |
| M-nodeenv-empty | RC `if (io.env.NODE_ENV !== undefined) problems.push` → `if (io.env.NODE_ENV) problems.push` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “NODE_ENV="" in the environment: refused at the preflight, nothing run, no GET” |
| M-childenv | RC `Object.fromEntries(Object.entries(env).filter(([name]) => name !== 'NODE_ENV'))` → `({...env})` | tsc 0 · RED `3 failed \| 108 passed \| 1 skipped (112)` — “childEnv drops NODE_ENV and nothing else”; “realIo.run: a child of this process (vitest sets NODE_ENV=test) sees no NODE_ENV — and would, without it”; “build.mjs lets NODE_ENV unset through (positive control: it stops at the usage error instead)” |
| M-run-env | RC `{cwd: root, stdio: 'inherit', env: childEnv(process.env)}` → `{cwd: root, stdio: 'inherit'}` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “realIo.run: a child of this process (vitest sets NODE_ENV=test) sees no NODE_ENV — and would, without it” |
| M-build-nodeenv-off | BM `if (nodeEnv !== undefined && nodeEnv !== 'production') {` → `if (false) {` | tsc 0 · RED `3 failed \| 108 passed \| 1 skipped (112)` — “build.mjs refuses NODE_ENV="development" before anything else (two directories: the usage error never comes)”; “build.mjs refuses NODE_ENV="test" before anything else (two directories: the usage error never comes)”; “build.mjs refuses NODE_ENV="" before anything else (two directories: the usage error never comes)” |
| M-build-nodeenv-prod | BM `if (nodeEnv !== undefined && nodeEnv !== 'production') {` → `if (nodeEnv !== undefined) {` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “build.mjs lets NODE_ENV production through (positive control: it stops at the usage error instead)” |
| M-notes-nodeenv | RC `'- NODE_ENV: unset',⏎` → (removed) | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe” |
| M-precheck-skip | RC `['preflight', 'livePrecheck', 'verify',` → `['preflight', 'verify',` | tsc 0 · RED `11 failed \| 99 passed \| 1 skipped (111)` — “is §5.1 in order, after a preflight and the live pre-check: verify, the third witness, the RP-ID record, the live check, the zip twice, the write”; “the live check runs twice: three GETs before verify (nothing built yet), three after the RP-ID record — six per run”; “all green: every effect in order, the zip and the notes written last, nothing else left”; +8 more |
| M-precheck-late | RC `['preflight', 'livePrecheck', 'verify', 'witness',` → `['preflight', 'verify', 'livePrecheck', 'witness',` | tsc 0 · RED `10 failed \| 101 passed \| 1 skipped (112)` — “is §5.1 in order, after a preflight and the live pre-check: verify, the third witness, the RP-ID record, the live check, the zip twice, the write”; “the live check runs twice: three GETs before verify (nothing built yet), three after the RP-ID record — six per run”; “all green: every effect in order, the zip and the notes written last, nothing else left”; +7 more |
| M-precheck-first | RC `['preflight', 'livePrecheck', 'verify',` → `['livePrecheck', 'preflight', 'verify',` | tsc 0 · RED `16 failed \| 95 passed \| 1 skipped (112)` — “is §5.1 in order, after a preflight and the live pre-check: verify, the third witness, the RP-ID record, the live check, the zip twice, the write”; “all green: every effect in order, the zip and the notes written last, nothing else left”; “NODE_ENV="development" in the environment: refused at the preflight, nothing run, no GET”; +13 more |
| M-manifest-file | RC `` if (io.exists(`${PACKAGE}/${MANIFEST_NAME}`)) `` → `if (false)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “a build-manifest.json in the package: refused at the witness, before the third build (the digest cannot see it, the zip would pack it)” |
| M-bind-off | RC `if (unbound.length > 0) return` → `if (false) return` | tsc 0 · RED `3 failed \| 108 passed \| 1 skipped (112)` — “the zip, read back, is not the witnessed package — a 29th file the witness did not see (a build-manifest.json the digest skips): refused at the zip, nothing written”; “the zip, read back, is not the witnessed package — a witnessed file missing: refused at the zip, nothing written”; “the zip, read back, is not the witnessed package — a file with other bytes: refused at the zip, nothing written” |
| M-bind-extra | RC `` if (!seen.has(path)) out.push(`the zip holds ${path}, which the witness did not see`);⏎ else if `` → `` if (false) out.push(`the zip holds ${path}, which the witness did not see`);⏎ else if `` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the zip, read back, is not the witnessed package — a 29th file the witness did not see (a build-manifest.json the digest skips): refused at the zip, nothing written” |
| M-bind-missing | RC `for (const path of seen.keys()) if (!zipped.has(path)) out.push` → `for (const path of seen.keys()) if (false) out.push` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the zip, read back, is not the witnessed package — a witnessed file missing: refused at the zip, nothing written” |
| M-bind-hash | RC `else if (seen.get(path) !== hash) out.push` → `else if (false) out.push` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the zip, read back, is not the witnessed package — a file with other bytes: refused at the zip, nothing written” |
| M-bind-count | RC `if (out.length === 0 && (entries.length !== zipped.size \|\| entries.length !== witnessed.length))` → `if (false)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “a repeated entry is refused even when every path and hash is a witnessed one” |
| M-readback | RC `const entries = readStoreZip(first).map(e => ({path: e.path, sha256: sha256(e.bytes)}));` → `const entries = done.witness.files;` | tsc 0 · RED `4 failed \| 107 passed \| 1 skipped (112)` — “the zip, read back, is not the witnessed package — a 29th file the witness did not see (a build-manifest.json the digest skips): refused at the zip, nothing written”; “the zip, read back, is not the witnessed package — a witnessed file missing: refused at the zip, nothing written”; “the zip, read back, is not the witnessed package — a file with other bytes: refused at the zip, nothing written”; +1 more |
| M-notes-entries | RC `(${bytes} bytes, ${entries} entries, not committed)` → `(${bytes} bytes, not committed)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe” |
| M-notes-ignore-scripts | RC `` `cd extension && npm ci --ignore-scripts && env -u NODE_ENV npm run build` `` → `` `cd extension && npm ci && env -u NODE_ENV npm run build` `` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe” |
| M-notes-print-only | RC `` `node ../web/scripts/build-manifest.mjs dist-nopresale/chrome --print-only` prints `` → `` `node ../web/scripts/build-manifest.mjs dist-nopresale/chrome` prints `` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe” |
| M-notes-lockfile | RC `` `- Lockfile: \`extension/${LOCKFILE}\` sha256 \`${lockfile}\` (installed with \`npm ci --ignore-scripts\`)`,⏎ `` → (removed) | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe” |
| M-lockfile-absent | RC `if (lockfile === undefined) problems.push` → `if (false) problems.push` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “no lockfile: refused at the preflight (the notes record its sha256)” |
| M-partial-direct | RC `const partials = finals.map(partialPath);` → `const partials = finals;` | tsc 0 · RED `9 failed \| 102 passed \| 1 skipped (112)` — “all green: every effect in order, the zip and the notes written last, nothing else left”; “the notes: version, the zip (bytes, entries, sha256), the package digest, the commit, the lockfile, NODE_ENV, the RP ID, Node, the recipe”; “release/out/noctura-chrome-1.0.0.zip appears during the run: refused at the write, nothing written, nothing overwritten”; +6 more |
| M-appeared | RC `for (const path of [...finals, ...partials]) if (io.exists(path))` → `for (const path of []) if (io.exists(path))` | tsc 0 · RED `4 failed \| 107 passed \| 1 skipped (112)` — “release/out/noctura-chrome-1.0.0.zip appears during the run: refused at the write, nothing written, nothing overwritten”; “release/notes-1.0.0.md appears during the run: refused at the write, nothing written, nothing overwritten”; “release/out/noctura-chrome-1.0.0.zip.partial appears during the run: refused at the write, nothing written, nothing overwritten”; +1 more |
| M-cleanup-off | RC `` return {problems: [`writing failed (${message(e)})`], written: removeAll(partials.filter(path => io.exists(… `` → `` return {problems: [`writing failed (${message(e)})`], written: partials.filter(path => io.exists(path))}; `` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “the second file cannot be written: the first is removed, nothing is left, and the CLI says "nothing was written"” |
| M-left-drop | RC `...(left.length > 0 ? {written: left} : {})` → `...{}` | tsc 0 · RED `2 failed \| 109 passed \| 1 skipped (112)` — “the notes cannot be moved into place after the zip was: the zip is named as left, and the CLI does not say "nothing was written"”; “a temporary file that cannot be removed is named as left too” |
| M-left-say | RC `left.length === 0⏎` → `true⏎` | tsc 0 · RED `2 failed \| 109 passed \| 1 skipped (112)` — “the notes cannot be moved into place after the zip was: the zip is named as left, and the CLI does not say "nothing was written"”; “a temporary file that cannot be removed is named as left too” |
| M-place-rename | RC `linkSync(at(from), at(to));⏎ unlinkSync(at(from));` → `renameSync(at(from), at(to));` (and `renameSync` imported) | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “realIo writes without overwriting, moves into place without overwriting, and reads an absent file as undefined (a temp root)” |
| M-devkey-prefix | BM `const inside = dir => outRoot === dir \|\| outRoot.startsWith(dir + sep);` → `const inside = dir => outRoot === dir;` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “refuses any directory under dist/ or dist-nopresale/ (B1e-2, review M2: a prefix test on the resolved path)” |
| M-devkey-loose | BM `outRoot.startsWith(dir + sep)` → `outRoot.startsWith(dir)` | tsc 0 · RED `1 failed \| 110 passed \| 1 skipped (112)` — “a sibling whose name only starts like them is not refused by that rule (positive control: it stops at the absent key)” |
| M-tree-root | RC `(git status --porcelain; ' +⏎ 'the paths are relative to the repository root, not to extension/):'` → `(git status --porcelain):'` | tsc 0 · RED `2 failed \| 109 passed \| 1 skipped (112)` — “a dirty working tree: refused before verify, the paths named as the repository root has them”; “treeProblems: an empty status is clean, anything else is listed” |

58 mutations — rev 1's 26 (re-anchored to rev 2's code; their red counts now over 112 rows) and 32 for rev 2 (C1: 8; E26: 3; I1: 8; I5 / M6: 4; M1: 6; M2: 2; M7: 1) — every one compiling and red; none survived, none invalid. M-skip-rpid and M-skip-live run 111 rows (the `it.each` over STEPS has one row fewer). The two `storeKey.test.mjs` rows (M-devkey-prefix, M-devkey-loose) prove both halves of `startsWith(dir + sep)`: the prefix and its separator.

- [ ] **Step 8: The one sanctioned real run — rev 1's, not repeated.**

Revision 1 of this task ran `npm run release:chrome` once for real, in the dry-run clone at `fe13550` (rev 1's code: one live check, after `verify`), Node v24.10.0, the tree clean:
```
release: preflight ok — version 1.0.0, commit fe135508780fcff81768aea67d6aac4bd9131647, working tree clean
  … npm run verify (build, 5489 + 1 skipped / 550 + 25 skipped tests, CSP, secrets, gates, the four reproducible builds) …
release: verify ok — npm run verify exited 0
  … the third build into /tmp/noctura-release-witness-Yjq7wY …
release: witness ok — 28 files, sha256:a74d2025d3070e63d1567fcbdbf173a063872821eddb2cee346376f44f8b8cae — the third build agrees
release: rpId ok — release/rp-id.json records wallet.noc-tura.io, confirmed by the owner (E17)
release: refused at liveCheck — nothing was written
  privacy: https://noc-tura.io/extension/privacy answered 404, want 200 — a redirect fails
  terms: https://noc-tura.io/extension/terms answered 404, want 200 — a redirect fails
  help: https://noc-tura.io/extension/help answered 404, want 200 — a redirect fails
EXIT 1
```
Afterwards: no `release/out/`, no `release/notes-*`, the tree clean, the witness's temp dir gone; three GETs, each answered 404 with no redirect. This revision is **not** run for real (the controller's instruction: the orchestration is proved by the tests; no contact with noc-tura.io). With rev 2's order the same day would stop at `livePrecheck`, before `verify`, with the same three lines and nothing built — the test row "the live pre-check fails (a 404, as today)" is that run. The executor does NOT run it (the owner runs it at §7 step 3, after E25 and ICO's publication).

#### Notes for the executor (Task 7)

- **Rev 2 (Fable review 1: C1, I1, I2, I5, M1, M2, M3, M6, M7; owner E25, E26).** Built as T7' on `dry/b1e2-r2` (base `ac181aa` = T1, T2, T3', T4', T5, T6'): rev 1's Task 7 (`fe13550`) cherry-picked without a conflict, then:
  - **C1 (Critical) — `NODE_ENV`.** Reproduced in a scratch copy of `ac181aa` (`node scripts/build.mjs <tmp> --no-presale`, `buildManifest` of `chrome/`): unset → `28 files sha256:99fa0f0242928f3ceedbb392e765fe699b73d3af9f40d36c25b6f2f17681a3dc` (`mount-CW7eT9U7.js` 222 015 bytes, `addressBook-DTT_AaVQ.js` 162 943, `approve-bsI_aAqX.js` 63 800); `NODE_ENV=development` → `sha256:b2e3dafe679c3f4c37da9055e6be056beb7f3da28914aac6668df6349afd3265` (324 789 / 356 295 / 90 659 — React's development bundle); `NODE_ENV=production` → `99fa0f02…`, the unset digest exactly; `NODE_ENV=test` → `b2e3dafe…`, the development one. (The reviewer's digests, `a74d2025…` / `e363758a…`, were rev 1's tree; the difference is the same.) Three walls: (1) the preflight refuses any `NODE_ENV` — `production` included, because the notes record "NODE_ENV: unset", one condition a reproducer can meet, not one inferred to be equal (cost if wrong: an owner with `NODE_ENV=production` runs `env -u NODE_ENV …` — said in the refusal); (2) `realIo.run` passes `childEnv(process.env)` to every command (verify, the witness); (3) `build.mjs` refuses a `NODE_ENV` other than unset / `production` before anything (this protects `npm run build`, `verify`, `reproducible` and the E2E builds too; `production` is allowed there because it is measured identical and some tooling sets it). Callers of `build.mjs` checked: `presaleBuilds.test.mjs` and `storeKey.test.mjs` strip `NODE_ENV` (both spawn it from vitest, which sets `test`); `verify-reproducible.mjs` and `npm run build` inherit the shell's — none sets one; `e2e/dappPage.ts` runs its own Vite build with `define`, not `build.mjs`; nothing else spawns it (grep over `scripts/`, `e2e/`, `src/`, the configs and `.github/`).
  - **I1 — the zip bound to the witness.** Ruling: **refuse** a package with `build-manifest.json` at its root (at the witness step, before the third build) rather than make both sides agree: `buildManifest` is `web/`'s, its self-exclusion is its published contract (the web wallet's digest), and no build writes the file — its presence means its CLI ran there in writing mode. And, independent of the name, the zip step reads the zip **back from its own bytes** with Task 2's independent reader (`scripts/__tests__/storeZipReader.mjs`, import-free — so the writer never checks itself; the cost is a release script importing from `__tests__/`, a location, not a dependency) and requires its `{path, sha256}` entries to equal the witnessed files one for one (same paths, same hashes, same count). A 29th file, a missing one, changed bytes, a repeated entry and bytes that are no store zip are each refused (rows + mutations). The re-digest after zipping stays (it now only adds the directory's own check). The notes record the zip's entry count (M6); their recipe uses `node ../web/scripts/build-manifest.mjs dist-nopresale/chrome --print-only` (the CLI has `--print-only`, `web/scripts/build-manifest.mjs:60`) and says why.
  - **I2 / E25 — the ICO gate.** A checklist item before upload, not code (nothing in the extension can observe DNS or CT): ICO confirms in writing (noc-ops) no DNS record (or a refusing host) for `wallet.noc-tura.io` **and every name under it** — a WebAuthn RP ID is usable from its own host and from its subdomains, so `x.wallet.noc-tura.io` matters too, which the review did not say — no wildcard record, no certificate for the name, for `*.wallet.noc-tura.io` or a wildcard `*.noc-tura.io`, and notice before any change. The owner's own check uses only `dig` (resolvers and noc-tura.io's name servers, never a web server; an invented name detects a wildcard) and crt.sh in a browser; "never open https://wallet.noc-tura.io". I ran none of these. A CAA record (noc-tura.io has none — memory) is NOT in E25; offered to the owner below.
  - **E26 / M3 — the live check twice.** `STEPS` gains `livePrecheck` right after `preflight` (offline checks first: a dirty tree costs no GET); the final `liveCheck` keeps its place after `rpId`. Six GETs per run; three distinct paths, so CrowdSec's `http-probing` threshold (10 distinct 4xx paths in 10 s) is still out of reach. Rows: the order, "six per run" with positions, a pre-check 404 refused before any `run`, a final-check 404 after a passing pre-check.
  - **I5 / M6.** The notes' recipe is `cd extension && npm ci --ignore-scripts && env -u NODE_ENV npm run build`; the notes record `package-lock.json`'s sha256 (`io.hashFile`, the bytes — not a UTF-8 round trip), read at the preflight (refused if absent); the checklist already said `npm ci --ignore-scripts`.
  - **M1 — the write.** Both files are written as `<file>.partial` beside their final names (`wx`), then moved into place with a hard link + unlink (`io.place`), which refuses an existing target — "never overwritten" holds at the move too, not only at the preflight. A failure while writing removes the partials it made; a failure while moving names what is left (`written`), and `refusalLines` says "nothing was written" only when nothing was — otherwise "the write failed part-way: remove … (in extension/) before running again". Finals or partials that appear during the run are refused at the write. Cost: a filesystem without hard links (none the owner uses) would refuse at the move with the zip partial named.
  - **M2 (Task 1's file, changed here).** `build.mjs --dev-key` refuses an `outRoot` equal to or under `dist/` or `dist-nopresale/` (`outRoot.startsWith(dir + sep)` on the resolved path); the message says "never dist/, dist-nopresale/ or anything under them", so Task 1's `storeKey.test.mjs` row changes its expected string. The `+ sep` matters: `dist-nopresale-elsewhere` is not under it (the positive-control row; mutant M-devkey-loose). Limit: `resolve` does not follow symlinks — a symlink into `dist/` from elsewhere is not caught (stated, not tested).
  - **M7.** The dirty-tree refusal's heading says "the paths are relative to the repository root, not to extension/".
  - **The spec's rev 2.7 list** is rebuilt from all seven parts' current "Spec rev 2.7 lines" (rev 2's T3' P5 sentence, T4' Terms markers, T6' claims list / E23 / E24 / the limit included) plus this task's; the status line, §0 (E23–E26 rows added to the decisions table, B1e-2's row) and every named passage edited (§5.1 rewritten for steps 0, 0a, 2, 4, 5, 6; §5.3; §5.6 E25; §6.1 P5's cell; §6.4 listing and screenshots; §6.5; §7; §9; §10). `storeTexts.test.mjs` green (14).
- **Rulings (the controller's to confirm; rev 1's, still in force):**
  - **A preflight before everything refuses a dirty tree** (`git status --porcelain` non-empty, untracked files included — it runs from `extension/` but reports the whole repository, which the build reads: `../web`, `../core`) **and a version already packed**; checked **again** before the write (still clean, the same HEAD). Cost if wrong: an owner with a stray untracked file commits or removes it; a re-pack of 1.0.0 needs the old zip/notes removed (said in the refusal).
  - **The notes are committed by the owner; the zip is not** (`release/out/` is git-ignored). The notes carry no date (the same commit gives the same notes, but for Node's version), the Node version (informative: the zip is byte-identical on any Node) and "working tree clean" / "NODE_ENV: unset" (always true when written — the preflight refuses otherwise; stated so a reader need not know the script).
  - **RP_ID is read from `src/vault/passkey.ts` as text** by `readRpId` (exactly one `RP_ID =`, the plain line `export const RP_ID = '<host>';`); fail closed on any reformat. **The record is checked against E17's host as well as against `RP_ID`** (M-rp-e17). The field order is free for the gate (JSON); `rpId.test.ts` pins the committed form (M-rpjson-order).
  - **15 s per live-check request** (`AbortSignal.timeout`, which in Node's fetch also aborts a body read); the requests stay sequential, so the worst case per check is 45 s.
  - **No argument at all** (`cliProblem`); the CLI is not spawned by any test; `cliProblem` and `refusalLines` are tested pure.
  - **The orchestrator answers on its own** for a missing step, a thrown step (`<step>: <message>` — a `zip-store: …` or `store zip: …` throw is a refusal at `zip` before anything is written) and a step that returns no problem list.
  - **`realIo().run` uses `spawnSync(…, {stdio: 'inherit', env: childEnv(process.env)})`**: verify's output is shown live, a signal-killed child (status `null`) counts as exit 1.
- **Deviations from the brief / dispatch:** none in scope. The witness's `build-manifest.json` refusal and the read-back are both kept (the dispatch offered "refuse … or make both sides agree"; the read-back alone would also catch the file, but the named refusal says why before a 1-minute third build).
- **Copy written by this task (D27, owner-delegated — for the owner):** all of `release/checklist.md` (owner-facing, not published) incl. the E25 item's wording and its `dig` / crt.sh commands, the notes file's fixed paragraphs and recipe (`releaseNotes`), the CLI's lines and refusals (`nodeEnvProblem`, the part-way line), and the E23–E26 rows' wording in the spec's §0 table. No TGE date (checked repo-wide); nothing presale but the checklist's flag of the NOC row's "estimate · not in total" (E23).
- **For the owner (flagged, the controller relays):** (1) `release/rp-id.json` is committed in your name from E17 — §7 step 3 asks you to re-confirm; (2) E25 as written covers every name **under** `wallet.noc-tura.io` too (WebAuthn lets a subdomain use the RP ID) — confirm that is what you meant; (3) a CAA record for noc-tura.io (limiting who may issue certificates) would make the "no certificate" half harder to break — not decided, yours to ask ICO for; (4) the checklist's open items: P1, the Origin allow-list question (with the store ID), the Terms' lawyer, ICO's three pages, E25; (5) the release today would stop at the live pre-check (rev 1's real run: all three pages 404).
- **§5.5's evidence** was run in the real repository (read-only) at `c92fd09` in rev 1, all 27 refs: no `*.zip` / `*.crx` in any commit, no tag, the first file under `extension/release/` is `3b509af` (B1e-1, 2026-11-03), the only two "sideload" lines naming the extension are spec §5.5's own sentence. The executor re-runs the four commands and replaces the block if the output differs.
- **The escaped / look-alike character check (for the front matter — it is a plan-text command, not a committed check; `git grep Default_Ignorable_Code_Point` finds it only in the B1e-1 plan and `envelopeRules.ts`).** Widened to dash punctuation and look-alikes: every `\p{Pd}` character but the ASCII hyphen and the two visible dashes U+2013 / U+2014 (148 em and 23 en dashes in this task's added prose, comments and messages alone — counting them would make the check useless), plus U+2212 minus, U+2043 hyphen bullet, U+02D7 modifier minus, and the apostrophe / quote look-alikes U+02B9, U+02BC, U+2032, U+2035, U+201B, U+201F (U+2018/9 and U+201C/D stay visible punctuation, as before; the full-width forms were already in):
  `git diff 0fcf769 -- extension core | node -e "const s=require('fs').readFileSync(0,'utf8');const R=/[\p{C}\p{M}\p{Z}\p{Default_Ignorable_Code_Point}⠀＀-￯\p{Script=Cyrillic}\p{Script=Greek}\p{Script=Armenian}\p{Script=Hebrew}\p{Script=Arabic}]/u;const D=/[\p{Pd}−⁃˗ʹʼ′‵‛‟]/u;let n=0;for(const l of s.split('\n'))if(l.startsWith('+')&&!l.startsWith('+++'))for(const c of l)if(c!=='\t'&&c!==' '&&!(c>' '&&c<'\x7f')&&(R.test(c)||(D.test(c)&&c!=='–'&&c!=='—')))n++;console.log(n)"`
  Measured: `0` over the whole chain (`git diff 0fcf769` at T7', `extension core`; also with `docs`), `0` over this task (`git diff ac181aa`). Negative control: rev 2's pre-escape Task 6 commit `71d213d` (`git diff 55383f4 71d213d -- extension core`) → `5` with the widened command (two U+2010, three U+2011), `0` with the old one — the miss Task 6 found by hand; a planted `+a−b ‐ ― ‒ x` line → `4` widened, `0` old; `+ok – —` → `0` (the visible dashes stay allowed).
- **What a reviewer should know:** the checklist runs `npm run screenshots` *after* `release:chrome` (verify leaves its store build in `dist-nopresale/`); the summary is not pasted (Task 6). No build output changed: the reproducible digests are the base tree's (`no-presale chrome 99fa0f02…` = the unset build measured on `ac181aa`).
- **Dry run:** clone `dry/b1e2-r2`, commit `9f42f00` on `ac181aa`. Every run above is on that commit (red on `ac181aa` + Step 1's files; mutations in fresh `git archive` copies). No contact with any noc-tura.io host in this revision.

#### Spec rev 2.7 lines (Task 7) — already in the spec's rev 2.7 list with the other tasks' lines

- §5.1 (review C1, M7): a preflight before anything else — no `NODE_ENV` in the environment (any value), the working tree clean (untracked files included; the refusal says its paths are relative to the repository root), this version's zip and notes absent, `package-lock.json` present; before writing, the tree is checked again (still clean, the same HEAD).
- §5.1 (review C1): every command the release runs gets its environment without `NODE_ENV`; `scripts/build.mjs` refuses a `NODE_ENV` other than unset or `production` before building.
- §5.1 / §6.5 (E26): the live check runs twice — a pre-check right after the preflight, before `verify`, and the final check after the RP-ID record, before the zip: six GETs per run.
- §5.1 (review I1): the witness step refuses a package holding `build-manifest.json` at its root; step 5 reads the zip back (the independent reader) and requires its entries one for one the witnessed files, then re-reads the package's file digest.
- §5.1 (review M1): the zip (`extension/release/out/noctura-chrome-<version>.zip`, git-ignored) and the notes (`extension/release/notes-<version>.md`, the owner commits them) are written as `<file>.partial` and moved into place (a hard link: never over a file) only when both are written; a part-way failure names what it left; only a refusal that left nothing says "nothing was written".
- §5.1 (review I5, M6): the notes record the version, the zip's bytes, entry count and sha256, the package's file digest and count, the commit and the clean tree, `package-lock.json`'s sha256, "NODE_ENV: unset", the RP ID and Node; the recipe installs with `npm ci --ignore-scripts`, builds with no `NODE_ENV` and reads the digest with `--print-only`.
- §5.1 / §6.5: every live-check request has a 15 s timeout; the script takes no argument; it is a pure orchestrator over an injected io.
- §5.3 (review M2): `--dev-key` refuses any directory under `dist/` or `dist-nopresale/` too.
- §5.6: `RP_ID` read from `passkey.ts`'s one plain line, checked against it and E17's host; `rp-id.json` committed from E17, re-confirmed at §7 step 3; `rpId.test.ts` pins it.
- §5.6 / §7 (E25): the ICO gate for `wallet.noc-tura.io` and every name under it (no DNS record or a refusing host, no wildcard record, no covering certificate, notice before any change), checked by the owner with `dig` and a CT search.
- §7: the checklist (`extension/release/checklist.md`) with the open owner / ICO items (P1, the Origin allow list, the Terms' lawyer, the three pages, E25), the no-`NODE_ENV` check, the live check's two runs, the screenshots, the notes' commit, step 7's record format and §5.5's evidence.
- §0: E23–E26 join the decisions table; B1e-2's row names #1, #8, #39, the NOC row, the summary and the guard (with Task 6).
- §10: `release-chrome.test.mjs` proves the order, both live checks and the refusals over an injected io; two rows spawn a process (`realIo`'s environment, `build.mjs`'s `NODE_ENV` refusal).


## Self-review

**1. Spec coverage (rev 2.7).** §5.1 `release:chrome` — Task 7 (the six steps, the preflight and the live pre-check (E26), the refusals, revision 1's one real run). §5.2 version — Task 1. §5.3 the stable ID and `key` — Task 1 (render, `--dev-key`, `storeKey.mjs`, the gate), Task 7 (§7 step 7's record format and the coexistence note in the checklist). §5.4 the zip — Task 2. §5.5 `<all_urls>` and "no existing users" — Task 7 (the evidence run in the real repository and recorded in the checklist; the executor re-runs it). §5.6 the RP ID — Task 7 (`rp-id.json`, the pre-upload step, `rpId.test.ts`'s record pin). §6.1 the policy — Task 3 (P1–P16 re-verified, P3 / P5 / P8 corrected, L1 added, the facts pinned to the code). §6.2 retention — Task 3 (`ico-retention.md`, R1–R21; P1 (the OFAC refresh) stays an open owner / ICO item in the checklist). §6.3 the data-usage form — Task 4. §6.4 Terms, Help, listing — Task 4; screenshots — Task 5; the summary — Task 6. §6.5 the live check — Task 3 (the comparison, the runner, every control) and Task 7 (its place in the release, the timeout). §7 the checklist — Task 7. §8 nothing (out of scope). §9 the backdrop — Task 5. §10 every task's tests and gates; the whole Playwright suite at Task 7. Found by the dry run and not in rev 2.6: the extension's own copy contradicting the policy — Task 6 (rev 2.7's §0 line).

**2. Placeholder scan.** No "TBD", "TODO", "implement later", "fill in" or "similar to Task N" in the plan's prose (checked by grep over the seven parts). The one row that does not run today is Task 1's build with the store's recorded key — skipped until §7 step 7 records it, stated in the task and in the checklist; it was run end to end in the dry run on a scratch record (Chromium loaded the build under exactly the recorded ID).

**3. Type consistency.** Each later task's Consumes was checked against the earlier task's Produces: `zipStore(dir) → Buffer` (Task 2) is what Task 7 calls twice; `liveCheck({fetch}) → {ok, problems}`, `LIVE_PAGES`, `CONTACT` (Task 3) are what Task 7 calls, with its own 15 s timeout around `fetch`; `PRIVACY_SENTENCES` (Task 3) is what Tasks 4 and 6 read; `buildManifest(root) → {files, digest}` (web) is Task 7's witness; `RP_ID` is read by Task 7 from its one plain line and pinned to the module's export; `storeKey.mjs`'s reader (Task 1) is what `build.mjs --dev-key` and the gate call; `scripts/claims.mjs` (Task 6, rev 2) is what the UI guard, `storeTexts.test.mjs` and `privacy.test.mjs` import; Task 2's import-free reader `scripts/__tests__/storeZipReader.mjs` is what the release reads its own zip back with (rev 2, I1 — a test helper imported by a script, accepted: it keeps the writer from checking itself); `TERMS_DRAFT_MARKERS` (Task 4, rev 2) is what the live check's Terms entry refuses. Tasks 1–5's prose said "Task 6" for the release; it is Task 7 since the copy task was inserted — renumbered in the prose (no committed file names it).

**4. Review Focus.** Five rows above: three tested (2, a later code change against the sentences' pinned facts; 3, the owner's dirty tree; 5, the zip on another Node), two known limitations (1, 4) with the reason and where they are seen instead (the pages after the release; the store's unpacking). Row 1 and row 2's limit rely on the checklist's "every later version, before its upload" line, added by the controller to Task 7 in revision 1 and kept in revision 2.

**5. Replay.** The script `scratchpad/b1e2-asm/replay.py` applies task-1 … task-7's blocks from this file (each new file in full, each ```diff with `git apply --recount`) onto `git archive 0fcf769`, and after each task compares the tree with that task's chain commit (`diff -rq`): **IDENTICAL at all seven prefixes** — revision 1 (cd179af, 7fff2cc, f9e1aae, cd93831, cfb092c, 2739ffd, fe13550) and revision 2 (cd179af, 7fff2cc, 496c770, b120c48, 55383f4, ac181aa, 9f42f00).

**6. Owner-facing, at the finish.** Revision 2 settled E23–E26 (the owner, 2026-11-06) and Q1 / Q6 (controller rulings, recorded beside them). Still the owner's: the copy of Tasks 3, 4 and 6 (D27; the Terms are a draft for a lawyer); **Task 6's departure from the design on #1 and #39**; `rp-id.json` committed from E17 (re-confirm at §7 step 3); the open ICO items (P1, the Origin allow list); for the visual pass — the five screenshots, #19's clipped second check line (existing layout, outside this plan); the web wallet's " at stage price" (`web/src/portfolio/PortfolioPanel.tsx:66`, presale on there — outside B1e); E25's gate also covers every name under `wallet.noc-tura.io` (WebAuthn lets a subdomain use the RP ID) and offers an optional CAA record — the owner confirms the wider reading; the new copy of revision 2 (P5's recipient sentence, the NOC row, #8's banner, #40's suffix).
