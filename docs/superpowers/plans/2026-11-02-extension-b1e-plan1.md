# Noctura Extension B1e · Plan 1 — the code of the first Chrome Web Store release (the anti-phishing phrase in the background and on the six screens, the frozen unreadable predicate and the damaged-vault removal with "Save the damaged data", #37's checkbox on #37 and on the removal, #1's and #38's links, `licenses.html`, the link and licence gates, the RP ID pin, gates and E2E, the visual pass and spec rev 2.2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Revision 1 (2026-11-02):** first issue, dry-run in full — every task implemented for real on a scratch clone of `feat/extension-b1e` 9562c5c (main 521a283 + spec rev 2.1), one commit per task on `dry/b1e1` (e9b0c63, da678b4, 40aefcb, 42dc457, 4ae32b4, 2d157ba, 407213f), each red on its predecessor and green on its own tree with `tsc` (its own exit code), both vitest runs, both builds and every gate. Task 7's whole-suite run found `e2e/presaleSwitch.spec.ts` red since Task 4 (`vault.status` carries `phrase`; no task's Playwright subset ran it); **the controller's ruling moves that test change into Task 4**, where the answer changes, and the Review Focus adds one row to Task 2 and one to Task 6 — so the chain was **rebuilt on `dry/b1e1-rf`: e9b0c63, 8864b4e, 38ceea0, 236ef45, 09e6730, a5d3918, d68cce1**. Each rebuilt tree is its `dry/b1e1` commit plus exactly those files (Task 2: `forgetDamaged.test.ts` +1 row; Tasks 4–6: also `presaleSwitch.spec.ts`; Task 6: also `check-links.test.mjs` +1 row; Task 7: 407213f's tree but for the two rows, its own commit no longer carrying the `presaleSwitch.spec.ts` change). At every rebuilt commit `tsc` 0 and both vitest runs green under `TZ=UTC`, with the totals each task states. **189 named mutations, every one compiling and red** (Task 1 18, Task 2 33, Task 3 22 — its M-p-target does not compile and is recorded INVALID, not counted —, Task 4 42, Task 5 42, Task 6 24, Task 7 8; plus Task 7's DST control M-dst-old) — the two Review Focus mutants (M-serial, M-scheme-relative) run on the rebuilt chain, the other 187 as the dry run ran them (their code and tests unchanged). Playwright, the **whole suite, normally and under `unshare -rn sh -c 'ip link set lo up && npx playwright test'`**: at the rebuilt Task 4 (236ef45) **`108 passed (28.3m)` normally and `108 passed (28.1m)` under `unshare -rn`**; at the rebuilt Task 6 (a5d3918) **`112 passed (28.7m)` normally and `112 passed (28.5m)` under `unshare -rn`**; at Task 7 (on 407213f, whose `e2e/` and product code are d68cce1's byte for byte) 117 passed + `presaleSwitch.spec.ts`' 2 after the fix normally, 119 passed under `unshare -rn`; and each task's own subsets (in the task). Replaying task-1 … task-7's blocks from this file onto `git archive 9562c5c` reproduces each rebuilt commit at every prefix (Self-review). Next: a Fable 5.1 review (owner rule), then the owner.

**Revision 2.1 (2026-11-02):** Fable review 2 (`.superpowers/sdd/b1e1-plan-review-2.md`: approve after fixes — 0 Critical, 2 Important, Minors N3–N6) and the controller's rulings on its three owner questions applied; **the chain rebuilt on `dry/b1e1-r21` from Task 1 — 77b0fb1, 51d4315, 31a4a44, 6405846, d7dda3e, 9900eac, 8c6d76a** (each `dry/b1e1-r2` commit cherry-picked, Tasks 1, 4 and 7 amended; `dry/b1e1-r2` untouched). Dispositions:
- **N1 → Task 4:** the combining-mark cap is counted after NFD — `STACKED.test(phrase.normalize('NFD'))` — so a precomposed letter's own marks count. The review's three escapes (`'a'` + U+0300 ×4, U+01D8 + 3 marks, U+1EAD + 3 marks) are refused rows; Vietnamese, `à` + 2 graves (3 after NFD), Arabic shadda + fatha + superscript alef, polytonic Greek U+1F84 and Hangul join Tibetan, pointed Hebrew and Thai as positive controls (8 rows, `ER` 84). M-stack-nfc (the count back on the NFC form) `tsc` 0 and RED `3 failed \| 81 passed (84)` at the three escapes; all 53 Task 4 mutations re-run on 6405846, every one `tsc` 0 and red (M-blank and M-stacked rewritten to the new line). Spec §1.5 (rev 2.4).
- **N2 → Task 1:** `unreadable.test.ts`' breadth row (the real Argon2id) carries `}, 60_000)` like its two siblings. Rev 2's "load timeout" record for it was a harness defect, now fixed; Task 1's mutations are unaffected (a test budget only) and not re-run.
- **Owner questions, the controller's rulings (as recommended):** the cap stays 3 and its scope limit is in spec §1.5 (it refuses cantillated Hebrew, Vedic Devanagari and Quranic-annotated Arabic — N4); "wraps, never cut" is kept (N3, no change); no migration (no stored phrase predates the rule outside development profiles).
- **N3:** no change (the ruling). **N4:** the spec line above. **N5:** applied — the escape check's class gains the full/half-width forms U+FF00–U+FFEF (still 0 on rev 2.1, 53 on rev 1; a control line with U+FF21 counts 1). **N6:** no change — the review's `cp-visible-space-ok` is this plan's M-visible-spaces (`\p{Z}` added to `VISIBLE`), already red.
- No E2E or product UI file changed (Task 4's `envelopeRules.ts` is shared background-and-page code; no screen, no spec under `e2e/`), so the whole Playwright suite was not re-run; rev 2's runs stand.

Rev 2.1 totals under `TZ=UTC` (each rebuilt commit, run one at a time; `tsc` 0 at all seven): Task 1 224 / 4854, Task 2 228 / 4961, Task 3 228 / 4986, Task 4 230 / 5115, Task 5 234 / 5176, Task 6 239 / 5255, Task 7 239 / 5255; the no-presale runs unchanged (18 / 435 + 25, 19 / 472 + 25, 22 / 531 + 25). Both builds, `npm run gates` and `npm run csp` 0 at Tasks 4 and 7. 210 named mutations (rev 2's 209 and M-stack-nfc). The replay of this file onto `git archive 9562c5c` is identical to every `dry/b1e1-r21` commit (Self-review). The spec is rev 2.4, committed before this plan.

**Revision 2 (2026-11-02):** Fable review 1 of this plan (`.superpowers/sdd/b1e1-plan-review-1.md`: approve after fixes — 0 Critical, 1 Important, 11 Minor) and the owner's answers E19–E22 with the controller's ruling on Q6 (`.superpowers/sdd/b1e-owner-decisions.md`) applied, dry-run in full again: **the chain rebuilt on `dry/b1e1-r2` from Task 1 — 9c9b8db, 2876fea, be35060, a982e28, a6d3923, 5c9cbd3, a636405** (each `dry/b1e1-rf` commit cherry-picked, then its rev 2 change, one commit per task; `dry/b1e1-rf` untouched). Each changed task section is transcribed from its new commit (every new file and diff block re-taken; Task 3's only by context). Dispositions:
- **I1 + E21 → Task 4:** `cleanPhrase` refuses every Default_Ignorable code point (the Hangul fillers U+115F / U+1160 / U+3164 / U+FFA0 and U+17B4 / U+17B5 among them), U+2800, U+FFFC / U+FFFD, and more than `PHRASE_MAX_MARKS` = 3 combining marks in a row (Thai needs 2, pointed Hebrew and Tibetan 3); a phrase must hold one L / N / S / P character. 27 rows (the review's six probes and eleven more, nine positive controls incl. a Cyrillic phrase and one accent mark), as escapes from a generator; ten named mutations (M-dicp, M-braille, M-replacement, M-blank, M-stacked, M-cap-loose, M-cap-tight, M-visible, M-visible-marks, M-visible-spaces), each `tsc` 0 and red. Spec §1.5 (rev 2.3).
- **E19 → Task 2:** the refused state's heading "Update Noctura to open this wallet", the old sentence its first body line; unit, E2E and visual copy rows; M-refused-heading, M-refused-line, M-vis-refused-heading.
- **E20 → Task 5:** the phrase step's overline "Optional"; the copy row, `visual-vault.spec.ts`, the visual pass; M-overline, M-vis-overline.
- **E22:** kept as built — no change.
- **Q6 (the controller's ruling) / M4 → spec §4.3 (rev 2.3, text only) and Review Focus 2:** the link gate is a review aid, not a security boundary. The review's optional source rule is not built (Task 6's notes).
- **M1 → Task 6:** `rpcWebsocketsViolations` calls a map without `chunks` INCONCLUSIVE (was a vacuous pass); a row with three shapes and its positive control; M-chunks-vacuous.
- **M2 → Task 2:** `damaged.spec.ts`' short-hold negative runs the page clock past the second and waits on the button still being armed before it reads storage; E2E mutant M-e2e-short-hold red at that line.
- **M3 → Tasks 1 and 2 (comments):** step 5's reading clause and both readings' opener-first order are marked as not checks of their own (implied / invisible; the digest compare and the partition rows are the guards).
- **M5 → Task 6:** the link gate reads `.svg`; a row; M-svg. **M6 → Task 6:** the licence failure says `licence-ids.json` cannot override a present `license` field; a row with its positive control; M-ids-override, M-ids-message. **M7 → spec §10** (one line).
- **M8, M9, M10, M11:** confirmations of rev 1 — no change.
- **Found while revising (not in the review):** rev 1's Global Constraint "no escaped-character drift" was false — Tasks 4 and 5 typed 53 invisible or confusable characters raw into five test files (and this plan's two generator blocks held their inputs raw); every one is now a `\u` escape, and the constraint carries a check that counts 0 on rev 2 and 53 on rev 1 (its negative control).

Rev 2 totals under `TZ=UTC`: Task 1 224 / 4854, Task 2 228 / 4961, Task 3 228 / 4986, Task 4 230 / 5107, Task 5 234 / 5168, Task 6 239 / 5247, Task 7 239 / 5247 (no-presale runs unchanged: 18 / 435 + 25 through Task 3, 19 / 472 + 25 at Task 4, 22 / 531 + 25 from Task 5); `tsc` 0, both builds, `npm run gates` and `npm run csp` 0 at every rebuilt commit. The first whole `vitest` run at Tasks 5 and 6 each had one test time out while four mutation sweeps loaded the machine (load ≈ 29 on 8 cores): `resume.test.tsx`' prepared-purchase row at Task 5 and `unreadable.test.ts`' breadth row at Task 6 (`Test timed out in 5000ms` — the real encoder's Argon2id); both files green alone at once, and both whole runs green again on an idle machine (Task 5 `234 / 5168`, Task 6 `239 / 5247`) — recorded as load timeouts, not product findings. **209 named mutations, each compiling and red** (Task 1 18, Task 2 36 — the E2E M-e2e-short-hold among them —, Task 3 22 with M-p-target INVALID as in rev 1, Task 4 52, Task 5 43, Task 6 28 — M-missing-target green in the link gate by design and red in its unit files, as in rev 1 —, Task 7 10; plus Task 7's DST control M-dst-old, not re-run: its row and test are unchanged), every one re-run on the rebuilt chain; three of Task 4's new mutants were first written so they did not compile and were rewritten (Task 4's notes). Playwright, the **whole suite at Task 7 (a636405): **`119 passed (30.7m)`** normally and **`119 passed (30.4m)`** under `unshare -rn sh -c 'ip link set lo up && npx playwright test'`**; Task 2's `damaged.spec.ts` and Task 5's `visual-vault.spec.ts` on their own rebuilt commits, both modes (`damaged.spec.ts` on 2876fea `1 passed` both modes; `visual-vault.spec.ts` on a6d3923 `5 passed (1.3m)` both modes); rev 1's whole-suite runs at Tasks 4 and 6 stand (rev 2 changed no E2E-reachable behaviour there before Task 7's specs). `npm run verify` at Task 7: rev 2, on a636405: exit 0 — the build, `239 / 5247` and `22 / 531 + 25` in local time, csp, secrets, gates, reproducible 28 files per package. The replay of task-1 … task-7's blocks onto `git archive 9562c5c` is identical to every rebuilt commit (Self-review). The spec is rev 2.3, committed on its own before this plan. Next: the owner.

**Goal:** Build B1e spec plan 1 (§0's first row, "B1e-1 — code") for the first Chrome Web Store release, presale off. The anti-phishing phrase (§1, E3): `cleanPhrase`, `v1_phishing_phrase` as background-owned wallet data, `settings.phrase` (set when none is set while unlocked, no proof — R1 = E18; a change or a removal only through #10's new `phrase` challenge), the value only on `wallet.state`, `vault.status` and `dapp.pending` (R2), its line on the six screens as plain text with R9's line when the read fails, onboarding's skippable step after `commitWallet`, #35's row. The damaged vaults (§2, E5, E9–E12): the frozen `unreadableV1` predicate and the three readings of `v1_vault`, `vault.setKeys` bound through `envelopeShape` (R3), `vault.forgetDamaged` bound to the sha256 of the stored text, the two damaged states on #9 and #1, the removal screen, "Save the damaged data" (E10, R4). #37 without holding (§3, E6, E11): a native checkbox above the hold on #37 and on the removal. Links and licences (§4, E4, E15–E17): #1's and #38's links, `licenses.html`, the link gate, the licence gate with the `rpc-websockets` stub, the RP ID pin. Gates, E2E and the visual pass (§1.6, §2.6, §4.4, §9, §10) and spec rev 2.2. The release build, version, key, zip and the store texts are B1e-2's (§5–§7) — except the gate hooks §4 needs.

**Architecture:** The background decides; the pages render its answers. The phrase is a background-owned key no page may name: it is written only by `settings.phrase` (and by `vault.reauthOk` applying a `phrase` challenge), read out only as a field of three existing answers, and re-judged by every screen (`phraseRead`) before it is drawn as text. The damaged-vault path is three judges in series — the screen, the removal screen at load, `damagedFlow` at the click — and then the background, which ignores all of them: inside `serial` it reads, judges with the opener first and then the frozen predicate (`unreadable.ts`, imports only `@scure/base`), compares the digest, locks, refuses an open send, reads and judges and compares again, and removes only under `sessionMutex` with no session. #37's confirmation rule lives in one place per page (`DeleteWallet.tsx` + `HoldButton`'s `once`; `mountDeleteConfirm`'s `way()`), and the proof in #37's vault tab is unchanged. The links are `<a target="_blank" rel="noopener noreferrer">` to whole strings in `src/shared/links.ts`; `licenses.html` is generated by `scripts/build.mjs` from the modules the bundler really rendered and is admitted by the gates by name as a static page. Every new gate runs in `npm run gates` once per build.

**Tech Stack:** TypeScript 5 strict, React 18.3.1, Vite 8 (Rolldown), Vitest 5 + happy-dom 21, Playwright 1.63 (contained), `@solana/web3.js` 1.99, `@scure/base` 2. No new dependency (`rpc-websockets` is aliased to a local two-export stub; the Geist fonts' `LICENSE.txt` is geist@1.7.2's, pinned by sha256).

**Spec:** `docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md` **rev 2.3** (rev 2.1 + every departure of this plan, one line each under "Rev 2.2", the passages they name edited to match; rev 2.3: the plan's review 1 and the owner's E19–E22, one line each under "Rev 2.3" — written by Task 7 Step 3 and committed with this plan). Parent: B1 §4 and §5. Owner decisions: `.superpowers/sdd/b1e-owner-decisions.md` (E1–E22, and the controller's ruling on review Q6) and the spec's §0 (E1–E22, rulings R1–R10). Plan review: `.superpowers/sdd/b1e1-plan-review-1.md`. Reviews behind the spec: `.superpowers/sdd/b1e-spec-review-1.md`, `.superpowers/sdd/b1e-spec-review-2.md`. Brief and ledger of this plan's dry run: `.superpowers/sdd/b1e1-plan-brief.md`, `.superpowers/sdd/b1e1-plan-ledger.md`. Template: `docs/superpowers/plans/2026-10-26-extension-b1d-plan2.md`. Design (binding, contains the TGE date — never copy it; compare on rendered images only): `/home/user/Downloads/index.html` (#1, #6, #9, #10, #35, #37, #38, #46–#48, the vault page; the phrase, the damaged-vault screens, the removal, the checkbox row and `licenses.html` are undrawn — §9).

## Global Constraints

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

## Review Focus

The five input classes or failure modes most likely to bite that no task's tests exercised in the dry run, one line each — with the row added to its owning task, or written as a known limitation with the reason:

1. **Two removal tabs confirming at once.** Each tab read and showed the same unreadable value and both send `vault.forgetDamaged` with its digest; nothing tested what the second one meets. **Tested:** Task 2, `forgetDamaged.test.ts` "two removal tabs confirming at once: one is forgotten, the other waits for it and finds no wallet" — two requests sent together answer `[{ok: true}, {ok: false, error: 'no-wallet'}]` and leave only the cleared `v1_pending`; M-serial (the body run outside `serial`) red. The second tab then shows set-up (Task 2's ruling for `no-wallet`).
2. **A URL the link gate cannot see.** The gate reads URL strings as written (R8); a URL never written whole — the scheme split from its `://`, a scheme-relative `//host`, a base64 text — passes it. **Tested, as a limit:** Task 6, `check-links.test.mjs` "a known limit, not a pass …" pins that `urlStrings` finds nothing there and the package passes, beside two controls (the same URL whole fails; a whole scheme with the host added at run time names `https://` and fails); M-scheme-relative red (the row reads the gate's real pattern). **Accepted — the gate is a review aid, not a security boundary (spec §4.3 rev 2.3, the controller's ruling on review Q6):** it catches an unreviewed URL in the shipped code, not code written to hide one — that is review's; at run time `connect-src` still bounds every fetch (`npm run csp`), and every link the user is given is a whole string from `src/shared/links.ts` (`about.test.tsx`, `welcome.test.ts`).
3. **The three noc-tura.io pages themselves.** #1's and #38's links lead to `https://noc-tura.io/extension/{terms,privacy,help}`, which ICO publishes from B1e-2's texts; no test of this plan can know whether they answer, or say the right thing. **Known limitation, no test added:** tests never contact `*.noc-tura.io` (Global Constraints) — the E2E clicks are routed and aborted, proving only that a new tab opens on exactly that URL; the check that each page answers 200 without a redirect and carries its text is §6.5's live check in `release:chrome` (B1e-2), run before any upload.
4. **The Firefox package in a real browser.** Every E2E, the phrase on the six screens and the visual pass run in Chromium only (Playwright's extension support); `firefox/` passes only the static gates (link, licence, vault isolation — the built content scripts included —, page bundles, reproducible). **Known limitation, no test added:** the release is the Chrome Web Store (E1); AMO is a later step with its own open points (§8, B1c §6.5), which will need its own run.
5. **A real screen reader on #37 and the removal.** D31 is the reason the checkbox exists; the tests read its role, name, order and keys from the DOM (unit rows, M-p-label / M-v-label, M-p-name / M-v-name, M-p-order / M-v-order) and from Chromium's accessibility tree with real key presses (Task 3's E2E: `getByRole('checkbox', {name: …})`, Tab from the box lands on the CTA, Enter on the box nothing, Space checks it, one Enter on the CTA). **Known limitation, no test added:** no assistive technology (ChromeVox, NVDA, VoiceOver) is driven — no harness here can run one; what it announces is the accessible name and role these tests pin. The owner can confirm it with one before the listing.

---

## How to read the steps

- A **new file** is given in full; a **changed file** is a unified diff against the previous task's tree. Apply each ```diff block on its own, in order, with `git apply --recount` from the repository root — never concatenate blocks.
- Two files are not typed from this plan: Task 1's `src/vault/__tests__/fixtures/envelope-v1-458dfcd.json` is committed **exactly as given** (the first encoder's output: its random bytes cannot be made again; pinned by sha256 `ac827eea…d905`), and Task 6's `public/fonts/LICENSE.txt` is geist@1.7.2's file, fetched by its Step 3 command (pinned by sha256 `930853ee…9137`). `licenses.html` is generated by every build and never committed.
- "Whole suite" is `npx tsc --noEmit; echo $?`, `TZ=UTC npx vitest run` and `TZ=UTC npx vitest run --config vitest.nopresale.config.ts`; both builds; `npm run gates` (and `npm run csp` where a task changes a page). From Task 7 on, vitest is green in local time too.
- **Each task ends with its named mutations** (fresh `git archive` copy, `tsc`'s own exit code first, each red) and **"Notes for the executor"** (its rulings, then the dry run's rulings, deviations and hand-over; part of the plan).

## Tasks

### Task 1: The frozen predicate and the three readings (SECURITY-CRITICAL) — `src/shared/unreadable.ts` (`unreadableV1`, U1–U3 exactly as spec §2.1, `FROZEN_*` constants, the frozen header, imports limited to `@scure/base` by a source test with its own negative control); the three readings of `v1_vault` on both sides — the background's `vaultReading` (`envelopeShape`, now exported, then the predicate) and the page's `vaultReading` (`storedVault`, then the predicate): `none` / `unreadable` / `refused` / `wallet`; `vault.setKeys` bound through `envelopeShape` (§2.5, R3): keys over an unreadable or refused envelope are `malformed`, no session; the predicate's controls of §2.6 — F0–F9 read from the committed fixture FILE and edited, 43 deletable controls (at least one per U-clause) each in the partition test, the breadth controls from the real encoder, the first encoder's output at 458dfcd committed verbatim, the invariance test under a tightened policy with its own positive control; both fixture files pinned by sha256; named mutations M-version, M-kdf, M-policy, M-scheme, M-iv and thirteen more

**Spec:** B1e §2.1 (the three readings, the frozen predicate U1–U3, the partition, "out of the predicate"), §2.5 (R3: `vault.setKeys` through `envelopeShape`, `malformed`), §2.6 (the predicate's part: F0–F9 as values, the breadth controls and the 458dfcd fixture, the deletable controls with the partition test, the invariance test and its positive control, the source test; M-version, M-kdf, M-policy, M-scheme, M-iv). Review 2 §1.1 (the 15 real shapes, the 25 unreadable values) and Minors 1–4. **Not here:** `vault.forgetDamaged`, the digest, the screens, "Save the damaged data" and M-digest / M-lock (Task 2); §2.6's `vault.forgetDamaged` column of the F table (Task 2 runs the same `F` list through the message).

**Files:**
- Create: `extension/src/shared/unreadable.ts`
- Modify: `extension/src/background/accountsStore.ts` (`envelopeShape` exported; `VaultReading`, `vaultReading`), `extension/src/unlock/stored.ts` (`VaultReading`, `vaultReading`), `extension/src/background/messages.ts` (`vault.setKeys`' binding)
- Create (tests): `extension/src/shared/__tests__/vaultControls.ts` (the controls, shared with Task 2), `extension/src/shared/__tests__/unreadable.test.ts`, `extension/src/shared/__tests__/unreadableInvariance.test.ts`, `extension/src/vault/__tests__/fixtures/envelope-v1-458dfcd.json` (the first encoder's output — committed verbatim from this plan, never regenerated)
- Modify (tests): `extension/src/background/__tests__/setKeysBinding.test.ts` (R3 rows; `envelopeOf` a whole envelope), `extension/src/background/__tests__/messages.test.ts` (`vaultExt` a whole envelope), `extension/src/approve/__tests__/windowHarness.tsx` (`ENV` a whole envelope) — the last two only because R3 now refuses their `{v, scheme, accounts}` stubs (Step 2: green on the old tree too)

**Interfaces:**
- Consumes: `storedVault` / `StoredVault` (`src/unlock/stored.ts`), `checkEnvelope` / `createEnvelope` / `addPasskeyWrap` / `rewrapPassword` / `unlockWithPassword` / `unlockWithPrf` / `decryptMnemonic` / `KDF_CAP` (`src/vault/envelope.ts`), `reencryptForAccounts` (`src/vault/reencrypt.ts`), `derivePublicKeys` / `deriveSessionAccounts` (`src/vault/accounts.ts`), `argon2idKdf` (`src/vault/kdf.ts`), `envelopeShape` / `StoredEnvelope` / `VAULT_KEY` (`src/background/accountsStore.ts`), `setSessionIf` (`src/background/session.ts`), the committed fixture `src/vault/__tests__/fixtures/envelope-v1.json`.
- Produces (`extension/src/shared/unreadable.ts`):
  ```ts
  export function unreadableV1(raw: unknown): boolean;   // false for undefined; true exactly when U1, U2 or U3 (v === 1 only) holds
  ```
- Produces (`extension/src/background/accountsStore.ts`):
  ```ts
  export function envelopeShape(x: unknown): StoredEnvelope | null;   // unchanged, now exported
  export type VaultReading = {kind: 'none'} | {kind: 'unreadable'} | {kind: 'refused'} | {kind: 'wallet'; env: StoredEnvelope};
  export function vaultReading(raw: unknown): VaultReading;   // undefined → none; envelopeShape accepts → wallet; else unreadableV1 ? unreadable : refused
  ```
- Produces (`extension/src/unlock/stored.ts`):
  ```ts
  export type VaultReading = {kind: 'none'} | {kind: 'unreadable'} | {kind: 'refused'} | {kind: 'wallet'; env: EnvelopeV1};
  export function vaultReading(raw: unknown): VaultReading;   // storedVault's none / wallet as they are; its damaged split by unreadableV1
  ```
  `storedVault` is unchanged (every existing `damaged` caller reads as before).
- Produces (`vault.setKeys`): `{ok: false, error: 'malformed'}` and no session when the stored value reads `unreadable` or `refused`; `unknown-account` as before when no wallet is stored or a key is not the envelope's; inside the same `setSessionIf` section as before.
- Produces (tests, `extension/src/shared/__tests__/vaultControls.ts`):
  ```ts
  export type Json = Record<string, unknown>;
  export const MNEMONIC: string; export const PASSWORD: string; export const FIXTURE_ACCOUNT: string;   // the fixture's phrase, password, account 0
  export const fixtureEnvelope: () => Json;   // JSON.parse of envelope-v1.json, fresh on every call
  export function edited(edit: (env: Json) => void): Json;   // a fresh F0 with one edit
  export const F: readonly (readonly [string, Json])[];   // F0–F9, names start with their id
  export const F_WALLETS: string[];   // ['F0', 'F1', 'F9'] — the others are refused by both openers
  export const DELETABLE: readonly (readonly [string, unknown])[];   // 43 unreadable values, names start U1 / U2 / U3
  export function firstEncoder(): readonly (readonly [string, Json])[];   // 458dfcd: createEnvelope, addPasskeyWrap
  export const ODD_NAMES: readonly string[];
  export function breadth(): Promise<(readonly [string, Json])[]>;   // 9 envelopes from the real encoder, storage round trip
  ```
  **What later tasks rely on:** Task 2's `forgetDamaged` judges with `unreadableV1` (§2.4 step 2 and 5) — or `vaultReading(raw).kind === 'unreadable'`, which is the same verdict for every value both openers refuse — and its tests run `F` (→ `not-unreadable`, `v1_vault` unchanged), `DELETABLE` (→ `forgotten`) and `breadth()` / `firstEncoder()` through the message. The two damaged screens decide with the page's `vaultReading` on their own `readLocal` read. Any new test that sends `vault.setKeys` must store a whole envelope (`fixtureEnvelope()`, or the byte-length stubs this task gives `messages.test.ts` and `windowHarness.tsx`); a `{v, scheme, accounts}` stub is now `malformed`.

**How the predicate is held.** It is judged by its controls, never by reading it: every F control and every breadth control is readable (the F's read from the FILE, so a change made to the encoder and the predicate together cannot move them), every deletable control unreadable, and — the partition — every deletable control is also `envelopeShape === null` and `storedVault` `damaged`, so a future opener that loosened a v1 clause without bumping `v` fails here. The invariance test loads the modules again under a mocked `envelopeRules` (KDF floor 131072, `MAX_ACCOUNTS = 1`, a policy that refuses everything) and first proves the mock bit (`envelopeShape` and `storedVault` now refuse F0, which the real modules accept). Both readings check the opener first: a value an opener accepts is a `wallet` whatever the predicate says (today the partition makes that order invisible; it is the fail-safe order if the two ever disagree).

- [ ] **Step 1: Write the failing tests and commit the first encoder's output.**

`extension/src/vault/__tests__/fixtures/envelope-v1-458dfcd.json` is committed **exactly as below** (1 882 bytes, sha256 `ac827eea0975e4c6240b0cefc3a5105b4d0d6f173375764552004a44d314d905` — `unreadable.test.ts` pins it, and the KAT fixture `envelope-v1.json`'s `e143c9943b15bdcef88f7472d38ae6370936ebb1299b462f5a9d9b6690baaed0`, which no test pinned before). Its salts, IVs, data key and PRF salt are random, so it is never regenerated: a second capture gives other bytes. How it was made, once, in the dry run (the capture file is never committed): `envelope.ts` and `bytes.ts` exactly as at 458dfcd (`git show 458dfcd:extension/src/vault/envelope.ts`, `…/bytes.ts`) copied into `src/capture458dfcd/` of a `git archive 9562c5c` copy (node_modules linked), beside this test, run with `CAPTURE_OUT=<the fixture path> npx vitest run src/capture458dfcd/capture.test.ts` (`tsc 0`, `Tests  1 passed (1)`), the copy then removed:

```ts
// B1e-1 Task 1, Step 1: run ONCE beside envelope.ts and bytes.ts as they were at 458dfcd (never committed). It records
// what the first envelope encoder wrote. Output: the JSON file named by CAPTURE_OUT.
import {writeFileSync} from 'node:fs';
import {addPasskeyWrap, createEnvelope, unlockWithPassword} from './envelope';
import {argon2idKdf} from '../vault/kdf';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery staple';
const PRF_OUTPUT = Uint8Array.from({length: 32}, (_, i) => 0xa0 + i);
const CREDENTIAL_ID = Uint8Array.from({length: 16}, (_, i) => 0xe0 + i);
const PRF_SALT = globalThis.crypto.getRandomValues(new Uint8Array(32));

it('captures the first encoder', async () => {
  const out = process.env.CAPTURE_OUT;
  if (out === undefined) throw new Error('CAPTURE_OUT is not set');
  const accounts = [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}];
  const created = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts, kdf: argon2idKdf});
  const dataKey = await unlockWithPassword(created, PASSWORD, argon2idKdf);
  const withPasskey = await addPasskeyWrap(created, dataKey, PRF_OUTPUT, CREDENTIAL_ID, PRF_SALT);
  const file = {
    note: 'The output of the first envelope encoder (extension/src/vault/envelope.ts at 458dfcd, 2026-09-28): createEnvelope, then addPasskeyWrap of it. Written once by B1e-1 Task 1 Step 1, never regenerated. Mnemonic abandon x11 about, password "correct horse battery staple", Argon2id at the declared cost, PRF output 0xa0..0xbf.',
    created: JSON.parse(JSON.stringify(created)) as unknown,
    withPasskey: JSON.parse(JSON.stringify(withPasskey)) as unknown,
  };
  writeFileSync(out, `${JSON.stringify(file, null, 2)}\n`);
}, 60_000);
```

The fixture:

```json
{
  "note": "The output of the first envelope encoder (extension/src/vault/envelope.ts at 458dfcd, 2026-09-28): createEnvelope, then addPasskeyWrap of it. Written once by B1e-1 Task 1 Step 1, never regenerated. Mnemonic abandon x11 about, password \"correct horse battery staple\", Argon2id at the declared cost, PRF output 0xa0..0xbf.",
  "created": {
    "v": 1,
    "scheme": "slip10",
    "kdf": {
      "alg": "argon2id",
      "m": 65536,
      "t": 3,
      "p": 1,
      "salt": "Rlt11JuuCQ0KXZXjPpN1Eg=="
    },
    "seed": {
      "iv": "Tu8k/W+n/P8dBFCc",
      "ct": "y0NRB0XxUXdOctbCGY9MBRVQ2/q3kZ8fGodHKONCe0RPqMF9E0sIe7QAti4vo9q62P5/HORKHiSGOZiAAOCx7Z8wAGmGOZNme37z/ROkKW8KWu/P6mz0VpGca3ZHCmt3rOnzJIfXyNO3/kqbbA=="
    },
    "password": {
      "wrapped": "NMhy+/YGUYm7HzNUpV8X//f/+lBMwy/b0EtfciG2+6USULwWbTqeYA=="
    },
    "accounts": [
      {
        "index": 0,
        "name": "Account 1",
        "publicKey": "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk"
      }
    ]
  },
  "withPasskey": {
    "v": 1,
    "scheme": "slip10",
    "kdf": {
      "alg": "argon2id",
      "m": 65536,
      "t": 3,
      "p": 1,
      "salt": "Rlt11JuuCQ0KXZXjPpN1Eg=="
    },
    "seed": {
      "iv": "Tu8k/W+n/P8dBFCc",
      "ct": "y0NRB0XxUXdOctbCGY9MBRVQ2/q3kZ8fGodHKONCe0RPqMF9E0sIe7QAti4vo9q62P5/HORKHiSGOZiAAOCx7Z8wAGmGOZNme37z/ROkKW8KWu/P6mz0VpGca3ZHCmt3rOnzJIfXyNO3/kqbbA=="
    },
    "password": {
      "wrapped": "NMhy+/YGUYm7HzNUpV8X//f/+lBMwy/b0EtfciG2+6USULwWbTqeYA=="
    },
    "accounts": [
      {
        "index": 0,
        "name": "Account 1",
        "publicKey": "HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk"
      }
    ],
    "passkey": {
      "credentialId": "4OHi4+Tl5ufo6err7O3u7w==",
      "prfSalt": "W/HHMgL+KvzIp2oMEu5WCVHapAocR+ZAZloxlLO5b9k=",
      "wrapped": "AbEj2TDtPOHLxwyeHAOFYhK4aZbmTG0U7pTd3nxStckiZLVmsVOxPg=="
    }
  }
}
```

Create `extension/src/shared/__tests__/vaultControls.ts`:

```ts
import {readFileSync} from 'node:fs';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {base64} from '@scure/base';
import {KDF_CAP, addPasskeyWrap, createEnvelope, rewrapPassword, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {reencryptForAccounts} from '../../vault/reencrypt';
import {derivePublicKeys} from '../../vault/accounts';

// B1e §2.6: the controls of the frozen predicate (src/shared/unreadable.ts), shared by its tests and by
// vault.forgetDamaged's. Every F control is JSON.parse of the committed fixture FILE and one edit — never the encoder's
// output, so a change made to the encoder and the predicate together cannot move them. The breadth controls come from
// the real encoder; the first encoder's output (458dfcd) is a committed file too. Each value is what storage.local
// hands back: a JSON round trip.

export type Json = Record<string, unknown>;
export const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
export const PASSWORD = 'correct horse battery staple';
/** Account 0 of MNEMONIC (slip10), the fixture's only account. */
export const FIXTURE_ACCOUNT = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

const readJson = (name: string): Json => JSON.parse(readFileSync(new URL(`../../vault/__tests__/fixtures/${name}`, import.meta.url), 'utf8')) as Json;
const stored = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const obj = (x: unknown): Json => {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new Error('the fixture changed shape');
  return x as Json;
};

/** F0: envelope-v1.json verbatim, a fresh parse of the file on every call. */
export const fixtureEnvelope = (): Json => readJson('envelope-v1.json');

/** F0 with one edit applied to a fresh parse. */
export function edited(edit: (env: Json) => void): Json {
  const env = fixtureEnvelope();
  edit(env);
  return env;
}
const account = (index: number): Json => ({index, name: `Account ${index + 1}`, publicKey: FIXTURE_ACCOUNT});

/** §2.6 F0–F9: readable — never deletable. F0, F1 and F9 are wallets both openers accept; F2–F8 are refused by both. */
export const F: readonly (readonly [string, Json])[] = [
  ['F0 the fixture verbatim', fixtureEnvelope()],
  ['F1 without passkey', edited(e => delete e.passkey)],
  ['F2 kdf.m = 32768 (below the floor)', edited(e => (obj(e.kdf).m = 32768))],
  ['F3 kdf.m = 2147483648 (above the cap)', edited(e => (obj(e.kdf).m = 2147483648))],
  ['F4 v: 2', edited(e => (e.v = 2))],
  ['F5 101 accounts', edited(e => (e.accounts = Array.from({length: 101}, (_, i) => account(i))))],
  ['F6 cli with two accounts', edited(e => ((e.scheme = 'cli'), (e.accounts = [account(0), account(1)])))],
  ['F7 accounts: []', edited(e => (e.accounts = []))],
  ['F8 scheme: bip44', edited(e => (e.scheme = 'bip44'))],
  ['F9 an unknown field', edited(e => (e.memo = 'kept by a later version'))],
];
export const F_WALLETS = ['F0', 'F1', 'F9'];

const fixtureSalt = (): string => String(obj(fixtureEnvelope().kdf).salt);
const bytes = (n: number): string => base64.encode(new Uint8Array(n).fill(0x5a));
const firstAccount = (e: Json): Json => obj((e.accounts as unknown[])[0]);

/** §2.6 deletable controls: at least one per clause of U1–U3; each U3 control is F0 with that one clause broken. */
export const DELETABLE: readonly (readonly [string, unknown])[] = [
  ['U1 null', null],
  ['U1 []', []],
  ['U1 "x"', 'x'],
  ['U1 a number', 7],
  ['U1 a boolean', true],
  ['U1 the fixture as an array', [fixtureEnvelope()]],
  ['U2 no v', edited(e => delete e.v)],
  ['U2 v: "1"', edited(e => (e.v = '1'))],
  ['U2 v: 0', edited(e => (e.v = 0))],
  ['U2 v: -1', edited(e => (e.v = -1))],
  ['U2 v: 1.5', edited(e => (e.v = 1.5))],
  ['U2 v: null', edited(e => (e.v = null))],
  ['U3 scheme: 1', edited(e => (e.scheme = 1))],
  ['U3 no scheme', edited(e => delete e.scheme)],
  ['U3 kdf a string', edited(e => (e.kdf = 'argon2id'))],
  ["U3 kdf.alg: 'scrypt'", edited(e => (obj(e.kdf).alg = 'scrypt'))],
  ['U3 kdf.m: "65536"', edited(e => (obj(e.kdf).m = '65536'))],
  ['U3 kdf.t: 1.5', edited(e => (obj(e.kdf).t = 1.5))],
  ['U3 no kdf.p', edited(e => delete obj(e.kdf).p)],
  ['U3 kdf.salt unpadded', edited(e => (obj(e.kdf).salt = fixtureSalt().replace(/=+$/, '')))],
  ['U3 kdf.salt of 15 bytes', edited(e => (obj(e.kdf).salt = bytes(15)))],
  ['U3 kdf.salt of 17 bytes', edited(e => (obj(e.kdf).salt = bytes(17)))],
  ['U3 no seed', edited(e => delete e.seed)],
  ['U3 seed.iv of 11 bytes', edited(e => (obj(e.seed).iv = bytes(11)))],
  ['U3 seed.iv of 13 bytes', edited(e => (obj(e.seed).iv = bytes(13)))],
  ['U3 seed.ct of 16 bytes', edited(e => (obj(e.seed).ct = bytes(16)))],
  ['U3 seed.ct not base64', edited(e => (obj(e.seed).ct = 'not base64!'))],
  ['U3 no password', edited(e => delete e.password)],
  ['U3 password.wrapped of 39 bytes', edited(e => (obj(e.password).wrapped = bytes(39)))],
  ['U3 password.wrapped of 41 bytes', edited(e => (obj(e.password).wrapped = bytes(41)))],
  ['U3 passkey: null', edited(e => (e.passkey = null))],
  ['U3 passkey a string', edited(e => (e.passkey = 'passkey'))],
  ['U3 an empty credentialId', edited(e => (obj(e.passkey).credentialId = ''))],
  ['U3 prfSalt of 31 bytes', edited(e => (obj(e.passkey).prfSalt = bytes(31)))],
  ['U3 passkey.wrapped of 39 bytes', edited(e => (obj(e.passkey).wrapped = bytes(39)))],
  ['U3 accounts: {}', edited(e => (e.accounts = {}))],
  ['U3 an account null', edited(e => (e.accounts = [null]))],
  ['U3 index: -1', edited(e => (firstAccount(e).index = -1))],
  ["U3 index: '0'", edited(e => (firstAccount(e).index = '0'))],
  ['U3 index: 0.5', edited(e => (firstAccount(e).index = 0.5))],
  ['U3 name: 1', edited(e => (firstAccount(e).name = 1))],
  ['U3 an account without publicKey', edited(e => delete firstAccount(e).publicKey)],
  ['U3 a broken second account', edited(e => (e.accounts = [account(0), {index: 1, name: 'Account 2'}]))],
];

/** 458dfcd's encoder output (createEnvelope, then addPasskeyWrap of it), committed verbatim. */
export function firstEncoder(): readonly (readonly [string, Json])[] {
  const file = readJson('envelope-v1-458dfcd.json');
  return [
    ['458dfcd createEnvelope', obj(file.created)],
    ['458dfcd addPasskeyWrap', obj(file.withPasskey)],
  ];
}

// The encoder computes a tiny Argon2id cost while the envelope declares the production one (envelopeBounds.test.ts).
const cheapKdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const named = async (scheme: 'slip10' | 'cli', names: string[]): Promise<EnvelopeV1['accounts']> => {
  const keys = await derivePublicKeys(MNEMONIC, scheme, names.map((_, i) => i));
  return names.map((name, i) => ({index: i, name, publicKey: keys[i] ?? ''}));
};
const create = async (scheme: 'slip10' | 'cli', names: string[], params?: typeof KDF_CAP): Promise<EnvelopeV1> =>
  createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme, accounts: await named(scheme, names), kdf: cheapKdf, ...(params === undefined ? {} : {params})});

/** Odd account names (review 2's probe): each a string, so readable; storeEnvelope's name policy is not the predicate's. */
export const ODD_NAMES: readonly string[] = [
  '',
  '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}\u200D\u{1F466} \u2764\uFE0F',
  '\u05D7\u05E9\u05D1\u05D5\u05DF',
  '\u8D26\u6237',
  'a\u202Eb',
  '\uD800',
  'x'.repeat(5000),
  'a\u0001b',
];

/** §2.6 breadth: what the real encoder writes, each through a storage round trip. */
export async function breadth(): Promise<(readonly [string, Json])[]> {
  const slip10 = await create('slip10', ['Account 1']);
  const dataKey = await unlockWithPassword(slip10, PASSWORD, cheapKdf);
  const prf = Uint8Array.from({length: 32}, (_, i) => 0xa0 + i);
  const prfSalt = (): Uint8Array<ArrayBuffer> => globalThis.crypto.getRandomValues(new Uint8Array(32));
  const {salt, wrapped} = await rewrapPassword(slip10, dataKey, 'a new password', cheapKdf);
  const out: [string, EnvelopeV1][] = [
    ['createEnvelope slip10', slip10],
    ['createEnvelope cli', await create('cli', ['Account 1'])],
    ['createEnvelope 100 accounts', await create('slip10', Array.from({length: 100}, (_, i) => `Account ${i + 1}`))],
    ['createEnvelope declaring KDF_CAP', await create('slip10', ['Account 1'], KDF_CAP)],
    ['createEnvelope odd names', await create('slip10', [...ODD_NAMES])],
    ['after rewrapPassword', {...slip10, kdf: {...slip10.kdf, salt}, password: {wrapped}}],
    ['after reencryptForAccounts (account 7 added)', await reencryptForAccounts(slip10, dataKey.slice(), [{index: 0, name: 'Account 1'}, {index: 7, name: 'Account 8'}])],
    ['addPasskeyWrap, a 1-byte credential ID', await addPasskeyWrap(slip10, dataKey.slice(), prf.slice(), new Uint8Array([9]), prfSalt())],
    ['addPasskeyWrap, a 64-byte credential ID', await addPasskeyWrap(slip10, dataKey.slice(), prf.slice(), new Uint8Array(64).fill(9), prfSalt())],
  ];
  dataKey.fill(0);
  return out.map(([name, env]) => [name, obj(stored(env))] as const);
}
```

The odd names are `\u` escapes in the source (the emoji family with ZWJs and a VS16, Hebrew, CJK, a right-to-left override, a lone surrogate, a C0 control) — the file's only non-ASCII characters are the § and dashes of its comments, and `git diff 9562c5c -- extension | grep -P '^\+.*[\x{200B}-\x{200F}\x{202A}-\x{202E}\x{2066}-\x{2069}\x{0430}]'` prints nothing (dry run: exit 1).

Create `extension/src/shared/__tests__/unreadable.test.ts`:

```ts
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {argon2idKdf} from '../../vault/kdf';
import {decryptMnemonic, unlockWithPassword, unlockWithPrf, type EnvelopeV1} from '../../vault/envelope';
import {envelopeShape, vaultReading as backgroundReading} from '../../background/accountsStore';
import {storedVault, vaultReading as pageReading} from '../../unlock/stored';
import {unreadableV1} from '../unreadable';
import {DELETABLE, F, F_WALLETS, PASSWORD, breadth, edited, firstEncoder, type Json} from './vaultControls';

// B1e §2.1, §2.6: the frozen predicate, and the readings both sides build on it.

const SOURCE = readFileSync(new URL('../unreadable.ts', import.meta.url), 'utf8');

/** Every module specifier a TypeScript source names: static and type imports, re-exports, dynamic import(), require(). */
function specifiers(source: string): string[] {
  const out: string[] = [];
  for (const re of [/\bfrom\s*['"]([^'"]+)['"]/g, /\bimport\s*['"]([^'"]+)['"]/g, /\bimport\s*\(\s*['"`]([^'"`]+)['"`]/g, /\brequire\s*\(\s*['"`]([^'"`]+)['"`]/g]) {
    for (const m of source.matchAll(re)) out.push(m[1] ?? '');
  }
  return out;
}

const kinds = (raw: unknown) => [backgroundReading(raw).kind, pageReading(raw).kind];

describe('unreadable.ts is frozen and stands alone', () => {
  it('imports exactly @scure/base, and nothing else', () => {
    expect(specifiers(SOURCE)).toEqual(['@scure/base']);
  });

  it('the import scan sees every form of import (negative control)', () => {
    const planted = [
      "import {ENVELOPE_KDF_MIN} from './envelopeRules';",
      "import type {EnvelopeV1} from '../vault/envelope';",
      "export {MAX_ACCOUNTS} from './envelopeRules';",
      "import './side-effect';",
      "const m = await import('./envelopeRules');",
      "const r = require('./envelopeRules');",
    ];
    for (const line of planted) expect(specifiers(`${SOURCE}\n${line}\n`)).not.toEqual(['@scure/base']);
  });

  it('says it is frozen, and names its constants FROZEN_*', () => {
    expect(SOURCE).toContain('Frozen at B1e rev 2; never edited — a later envelope format gets its own rule in a new module; tightening the');
    expect(SOURCE).toContain("opener's policy never touches this file.");
    const consts = [...SOURCE.matchAll(/^const ([A-Z_]+) = /gm)].map(m => m[1]);
    expect(consts.length).toBeGreaterThan(0);
    for (const c of consts) expect(c).toMatch(/^FROZEN_/);
  });
});

// The controls stand on two committed files: a swapped or edited fixture must fail here, not move the controls.
const FIXTURE_SHA256: readonly (readonly [string, string])[] = [
  ['envelope-v1.json', 'e143c9943b15bdcef88f7472d38ae6370936ebb1299b462f5a9d9b6690baaed0'],
  ['envelope-v1-458dfcd.json', 'ac827eea0975e4c6240b0cefc3a5105b4d0d6f173375764552004a44d314d905'],
];

describe('the fixtures the controls read are pinned', () => {
  it.each(FIXTURE_SHA256)('%s has its committed sha256', (name, sha256) => {
    const bytes = readFileSync(new URL(`../../vault/__tests__/fixtures/${name}`, import.meta.url));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(sha256);
  });
});

describe('unreadableV1 (§2.1 U1–U3)', () => {
  it('is false for undefined: no wallet is not a damaged one', () => {
    expect(unreadableV1(undefined)).toBe(false);
    expect(kinds(undefined)).toEqual(['none', 'none']);
  });

  it.each(DELETABLE)('%s → unreadable', (_, raw) => {
    expect(unreadableV1(raw)).toBe(true);
  });

  it.each(F)('%s → readable (never deletable)', (_, raw) => {
    expect(unreadableV1(raw)).toBe(false);
  });

  it('every readable F control is a wallet (F0, F1, F9) or refused by this version (F2–F8), the same on both sides', () => {
    for (const [name, raw] of F) {
      const expected = F_WALLETS.includes(name.split(' ')[0] ?? '') ? 'wallet' : 'refused';
      expect([name, ...kinds(raw)]).toEqual([name, expected, expected]);
    }
  });

  it('a later version is never judged: v ≥ 2 is readable whatever its structure, and refused', () => {
    for (const raw of [{v: 2}, {v: 3, scheme: 1, kdf: 'x'}, edited(e => ((e.v = 2), delete e.seed)), {v: Number.MAX_SAFE_INTEGER}]) {
      expect(unreadableV1(raw)).toBe(false);
      expect(kinds(raw)).toEqual(['refused', 'refused']);
    }
  });

  it('what is policy, not structure, is readable: a KDF cost of any safe integer, an unknown scheme string, an empty publicKey, duplicate indexes', () => {
    const readable = [
      edited(e => ((e.kdf as Json).m = 0)),
      edited(e => ((e.kdf as Json).t = -5)),
      edited(e => ((e.kdf as Json).p = Number.MAX_SAFE_INTEGER)),
      edited(e => (e.scheme = '')),
      edited(e => ((e.accounts as Json[])[0] = {index: 0, name: 'Account 1', publicKey: ''})),
      edited(e => (e.accounts = [...(e.accounts as Json[]), ...(e.accounts as Json[])])),
    ];
    for (const raw of readable) {
      expect(unreadableV1(raw)).toBe(false);
      expect(kinds(raw)).toEqual(['refused', 'refused']);
    }
  });
});

describe('the partition (§2.1): the four readings never overlap', () => {
  it.each(DELETABLE)('%s is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides', (_, raw) => {
    expect(envelopeShape(raw)).toBeNull();
    expect(storedVault(raw).kind).toBe('damaged');
    expect(kinds(raw)).toEqual(['unreadable', 'unreadable']);
  });

  it('every wallet both openers accept is readable (positive control of the partition)', () => {
    for (const [name, raw] of F.filter(([n]) => F_WALLETS.includes(n.split(' ')[0] ?? ''))) {
      expect([name, envelopeShape(raw) !== null, storedVault(raw).kind, unreadableV1(raw)]).toEqual([name, true, 'wallet', false]);
    }
  });
});

describe('breadth (§2.6, review 2 Minor 4): everything a v1 writer ever produced is readable and accepted', () => {
  it('the real encoder: cli, 100 accounts, the KDF cap, odd names, rewrapPassword, reencryptForAccounts, passkeys of 1 and 64 bytes', async () => {
    const all = await breadth();
    expect(all).toHaveLength(9);
    for (const [name, raw] of all) {
      expect([name, unreadableV1(raw), envelopeShape(raw) !== null, storedVault(raw).kind, ...kinds(raw)]).toEqual([name, false, true, 'wallet', 'wallet', 'wallet']);
    }
  }, 60_000);

  it('the first encoder (458dfcd), with and without a passkey', () => {
    for (const [name, raw] of firstEncoder()) {
      expect([name, unreadableV1(raw), envelopeShape(raw) !== null, storedVault(raw).kind, ...kinds(raw)]).toEqual([name, false, true, 'wallet', 'wallet', 'wallet']);
    }
  });

  it('the 458dfcd fixture is that encoder’s real output: its password and its passkey unwrap one data key, and the seed it wrote predates the header binding', async () => {
    const [[, created], [, withPasskey]] = firstEncoder() as [[string, Json], [string, Json]];
    const byPassword = await unlockWithPassword(created as unknown as EnvelopeV1, PASSWORD, argon2idKdf);
    const byPasskey = await unlockWithPrf(withPasskey as unknown as EnvelopeV1, Uint8Array.from({length: 32}, (_, i) => 0xa0 + i));
    expect(byPasskey).toEqual(byPassword);
    // The first encoder sealed the seed without additionalData: today's opener reads it as a wallet whose seed then
    // fails AES-GCM (§2.1 "out of the predicate") — readable, so never deletable without a password.
    await expect(decryptMnemonic(created as unknown as EnvelopeV1, byPassword)).rejects.toThrow();
  }, 60_000);
});
```

Create `extension/src/shared/__tests__/unreadableInvariance.test.ts`:

```ts
import {DELETABLE, F, breadth, firstEncoder, type Json} from './vaultControls';

// B1e §2.6 invariance: the opener's policy tightened (the KDF floor doubled, one account at most, every account list
// refused) leaves every verdict of the frozen predicate as it was. The controls are built first with the real modules;
// then envelopeRules is mocked and the modules are loaded again under the mock. Its own positive control: under the
// same mock, envelopeShape and storedVault now refuse F0 — the mock took, so the invariance means something.

const positive = async (): Promise<(readonly [string, Json])[]> => [...F, ...(await breadth()), ...firstEncoder()];

describe('unreadableV1 does not move when the opener’s policy is tightened', () => {
  afterEach(() => {
    vi.doUnmock('../envelopeRules');
    vi.resetModules();
  });

  it('every control keeps its verdict; the mock demonstrably bit', async () => {
    const readable = await positive();
    const real = await import('../../background/accountsStore');
    expect(real.envelopeShape(F[0]?.[1])).not.toBeNull();

    vi.resetModules();
    vi.doMock('../envelopeRules', async (orig: () => Promise<typeof import('../envelopeRules')>) => ({
      ...(await orig()),
      ENVELOPE_KDF_MIN: {m: 131072, t: 3, p: 1},
      MAX_ACCOUNTS: 1,
      accountsPolicyOk: () => false,
    }));
    const rules = await import('../envelopeRules');
    const {envelopeShape} = await import('../../background/accountsStore');
    const {storedVault} = await import('../../unlock/stored');
    const {unreadableV1} = await import('../unreadable');

    expect([rules.ENVELOPE_KDF_MIN.m, rules.MAX_ACCOUNTS]).toEqual([131072, 1]);
    expect(envelopeShape(F[0]?.[1])).toBeNull();
    expect(storedVault(F[0]?.[1]).kind).toBe('damaged');

    for (const [name, raw] of readable) expect([name, unreadableV1(raw)]).toEqual([name, false]);
    for (const [name, raw] of DELETABLE) expect([name, unreadableV1(raw)]).toEqual([name, true]);
  }, 60_000);
});
```

`extension/src/background/__tests__/setKeysBinding.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/setKeysBinding.test.ts b/extension/src/background/__tests__/setKeysBinding.test.ts
index 9414eed..b032ee7 100644
--- a/extension/src/background/__tests__/setKeysBinding.test.ts
+++ b/extension/src/background/__tests__/setKeysBinding.test.ts
@@ -4,6 +4,8 @@ import {handleMessage} from '../messages';
 import {VAULT_KEY} from '../accountsStore';
 import {SESSION_KEY} from '../session';
 import {fakeExt} from './fakeExt';
+import {DELETABLE, F, FIXTURE_ACCOUNT, MNEMONIC, edited, fixtureEnvelope} from '../../shared/__tests__/vaultControls';
+import {deriveSessionAccounts} from '../../vault/accounts';
 
 // Review H1: vault.setKeys binds to the stored envelope — keys of no stored wallet never reach the session.
 const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
@@ -15,7 +17,8 @@ const key = (fill: number, index: number) => {
 };
 const A0 = key(1, 0);
 const A1 = key(2, 1);
-const envelopeOf = (...accounts: {index: number; publicKey: string}[]) => ({v: 1, scheme: 'slip10', accounts: accounts.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}))});
+// B1e §2.5 (R3): a whole envelope both sides accept (the committed fixture's), carrying these accounts.
+const envelopeOf = (...accounts: {index: number; publicKey: string}[]) => ({...fixtureEnvelope(), accounts: accounts.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}))});
 const setKeys = (ext: ReturnType<typeof fakeExt>, accounts: unknown) => handleMessage(ext, {type: 'vault.setKeys', accounts}, unlockPage);
 
 describe('vault.setKeys binds to the stored envelope (review H1)', () => {
@@ -46,3 +49,46 @@ describe('vault.setKeys binds to the stored envelope (review H1)', () => {
     expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
   });
 });
+
+describe('vault.setKeys binds through envelopeShape (B1e §2.5, R3)', () => {
+  const fixtureKeys = () => deriveSessionAccounts(MNEMONIC, 'slip10', [0]);
+
+  it('the fixture’s own key over the fixture: a session (positive control)', async () => {
+    const ext = fakeExt();
+    const keys = await fixtureKeys();
+    expect(keys[0]?.publicKey).toBe(FIXTURE_ACCOUNT);
+    await ext.local.set(VAULT_KEY, fixtureEnvelope());
+    expect(await setKeys(ext, keys)).toEqual({ok: true});
+    expect(await ext.session.get(SESSION_KEY)).toEqual({accounts: keys});
+  });
+
+  it('kdf.m = 32768 (refused by this version) and the key the envelope records: malformed, no session', async () => {
+    const ext = fakeExt();
+    await ext.local.set(VAULT_KEY, edited(e => ((e.kdf as Record<string, unknown>).m = 32768)));
+    expect(await setKeys(ext, await fixtureKeys())).toEqual({ok: false, error: 'malformed'});
+    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
+  });
+
+  it.each(F.filter(([name]) => !['F0', 'F1', 'F7', 'F9'].includes(name.split(' ')[0] ?? '')))('%s, whose accounts still record the key: malformed, no session', async (_, raw) => {
+    const ext = fakeExt();
+    await ext.local.set(VAULT_KEY, raw);
+    expect(await setKeys(ext, await fixtureKeys())).toEqual({ok: false, error: 'malformed'});
+    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
+  });
+
+  it('F1 and F9 (wallets both sides accept) bind; F7 (no accounts) is refused', async () => {
+    for (const [name, raw] of F.filter(([n]) => ['F1', 'F7', 'F9'].includes(n.split(' ')[0] ?? ''))) {
+      const ext = fakeExt();
+      await ext.local.set(VAULT_KEY, raw);
+      expect([name, await setKeys(ext, await fixtureKeys())]).toEqual([name, name.startsWith('F7') ? {ok: false, error: 'malformed'} : {ok: true}]);
+    }
+  });
+
+  it.each(DELETABLE)('an unreadable value (%s): malformed, no session', async (_, raw) => {
+    const ext = fakeExt();
+    await ext.local.set(VAULT_KEY, raw);
+    const r = await setKeys(ext, await fixtureKeys());
+    expect(r).toEqual({ok: false, error: 'malformed'});
+    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
+  });
+});
```

`extension/src/background/__tests__/messages.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index 923e2f6..5034e4f 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -22,10 +22,19 @@ const ACC = [{index: 0, publicKey: base58.encode(PUB), secretKey: SECRET64}];
 // 64 × 0x01 is 64 bytes but not a keypair: its "public half" is not what its seed derives.
 const ONES64 = base64.encode(new Uint8Array(64).fill(1));
 const UNRELATED = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
-/** A fake extension whose stored envelope records ACC's key: vault.setKeys binds to it (review H1). */
+const bytes = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
+/** A fake extension whose stored envelope records ACC's key: vault.setKeys binds to it (review H1) — a whole envelope,
+ * with the byte lengths a real one has, since the binding goes through envelopeShape (B1e §2.5, R3). */
 function vaultExt() {
   const ext = fakeExt();
-  (ext.local as ReturnType<typeof memKV>).data.set('v1_vault', {v: 1, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: base58.encode(PUB)}]});
+  (ext.local as ReturnType<typeof memKV>).data.set('v1_vault', {
+    v: 1,
+    scheme: 'slip10',
+    kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: bytes(16, 1)},
+    seed: {iv: bytes(12, 2), ct: bytes(48, 3)},
+    password: {wrapped: bytes(40, 4)},
+    accounts: [{index: 0, name: 'Account 1', publicKey: base58.encode(PUB)}],
+  });
   return ext;
 }
 
```

`extension/src/approve/__tests__/windowHarness.tsx`:

```diff
diff --git a/extension/src/approve/__tests__/windowHarness.tsx b/extension/src/approve/__tests__/windowHarness.tsx
index b4b1f2d..279324b 100644
--- a/extension/src/approve/__tests__/windowHarness.tsx
+++ b/extension/src/approve/__tests__/windowHarness.tsx
@@ -87,9 +87,14 @@ export async function settled<T>(check: () => T | Promise<T>): Promise<T> {
 const SEED2 = new Uint8Array(32).fill(2);
 const PUB2 = ed25519.getPublicKey(SEED2);
 export const SECOND = {index: 1, publicKey: base58.encode(PUB2), secretKey: base64.encode(new Uint8Array([...SEED2, ...PUB2]))};
+const bytes = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
+/** A whole envelope, with the byte lengths a real one has: vault.setKeys binds through envelopeShape (B1e §2.5, R3). */
 export const ENV = {
   v: 1,
   scheme: 'slip10',
+  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: bytes(16, 1)},
+  seed: {iv: bytes(12, 2), ct: bytes(48, 3)},
+  password: {wrapped: bytes(40, 4)},
   accounts: [
     {index: 0, name: 'Main', publicKey: ACCOUNT.publicKey},
     {index: 1, name: 'Savings', publicKey: SECOND.publicKey},
```

- [ ] **Step 2: Run them on the previous task's tree — red.**

In a `git archive 9562c5c` copy with only the Step 1 files added (node_modules linked), in `extension/`: `npx tsc --noEmit; echo $?` → `2`, 7 errors, all in the two new test files: `unreadable.test.ts` 4 (`'envelopeShape' … is not exported`, `no exported member 'vaultReading'` from `accountsStore` and from `unlock/stored`, `Cannot find module '../unreadable'`), `unreadableInvariance.test.ts` 3 (`Property 'envelopeShape' does not exist` × 2, `Cannot find module '../unreadable'`).

`npx vitest run src/shared/__tests__/unreadable.test.ts src/shared/__tests__/unreadableInvariance.test.ts src/background/__tests__/setKeysBinding.test.ts src/background/__tests__/messages.test.ts src/approve/__tests__/locked.test.tsx` → `Test Files  3 failed | 2 passed (5)` · `Tests  52 failed | 39 passed (91)`: `unreadable.test.ts` does not load (`Cannot find module '../unreadable'`, 0 tests); `unreadableInvariance.test.ts` `1 failed (1)`; `setKeysBinding.test.ts` `51 failed | 5 passed (56)` — the four H1 rows (now over a whole envelope) and the fixture's positive control pass on the old binding; every refused (F2–F6, F8, `kdf.m = 32768`) and unreadable value with the key in its accounts answers `{ok: true}`, the others and F7 `unknown-account`, never `malformed`. `messages.test.ts` (29) and `locked.test.tsx` (5) are green: their fixtures' change is compatible with the old tree, and is needed only from Step 3 on.

- [ ] **Step 3: Implement.**

Create `extension/src/shared/unreadable.ts`:

```ts
import {base64} from '@scure/base';

/**
 * B1e §2.1: whether a stored `v1_vault` value is UNREADABLE — a value no version of Noctura can open. A vault this
 * version refuses (a newer `v`, a KDF cost or an account list outside today's policy) is readable here.
 *
 * Frozen at B1e rev 2; never edited — a later envelope format gets its own rule in a new module; tightening the
 * opener's policy never touches this file. It imports only @scure/base (a source test pins the list), so it can never
 * reach the opener's bounds (src/shared/envelopeRules.ts, src/vault/envelope.ts). Its constants are v1's algorithms:
 * the Argon2id salt, the AES-GCM IV and tag, AES-KW of a 32-byte key, the PRF salt.
 */
const FROZEN_VERSION = 1;
const FROZEN_KDF_ALG = 'argon2id';
const FROZEN_SALT_BYTES = 16;
const FROZEN_IV_BYTES = 12;
const FROZEN_MIN_CT_BYTES = 17;
const FROZEN_WRAPPED_BYTES = 40;
const FROZEN_MIN_CREDENTIAL_ID_BYTES = 1;
const FROZEN_PRF_SALT_BYTES = 32;

type Json = Record<string, unknown>;
const isObject = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);
const isSafeInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x);

/** The decoded length of strict (padded, RFC 4648) base64 — the codec every v1 writer used; null for anything else. */
function decodedLength(x: unknown): number | null {
  if (typeof x !== 'string') return null;
  try {
    return base64.decode(x).length;
  } catch {
    return null;
  }
}
const bytesExactly = (x: unknown, n: number): boolean => decodedLength(x) === n;
const bytesAtLeast = (x: unknown, n: number): boolean => (decodedLength(x) ?? -1) >= n;

/** U3: a v1 value whose structure no v1 writer could have produced. Bounds and policy are not structure. */
function brokenV1(raw: Json): boolean {
  if (typeof raw.scheme !== 'string') return true;
  const {kdf, seed, password, passkey, accounts} = raw;
  if (!isObject(kdf) || kdf.alg !== FROZEN_KDF_ALG || !isSafeInt(kdf.m) || !isSafeInt(kdf.t) || !isSafeInt(kdf.p)) return true;
  if (!bytesExactly(kdf.salt, FROZEN_SALT_BYTES)) return true;
  if (!isObject(seed) || !bytesExactly(seed.iv, FROZEN_IV_BYTES) || !bytesAtLeast(seed.ct, FROZEN_MIN_CT_BYTES)) return true;
  if (!isObject(password) || !bytesExactly(password.wrapped, FROZEN_WRAPPED_BYTES)) return true;
  if (passkey !== undefined) {
    if (!isObject(passkey)) return true;
    if (!bytesAtLeast(passkey.credentialId, FROZEN_MIN_CREDENTIAL_ID_BYTES)) return true;
    if (!bytesExactly(passkey.prfSalt, FROZEN_PRF_SALT_BYTES) || !bytesExactly(passkey.wrapped, FROZEN_WRAPPED_BYTES)) return true;
  }
  if (!Array.isArray(accounts)) return true;
  return accounts.some((a: unknown) => !isObject(a) || !isSafeInt(a.index) || a.index < 0 || typeof a.name !== 'string' || typeof a.publicKey !== 'string');
}

/**
 * False for `undefined` (no wallet). True exactly when U1 (not an object), U2 (no safe integer version ≥ 1) or U3 (a
 * broken v1 structure; only for `v === 1` — this version cannot judge the structure of a later one) holds.
 */
export function unreadableV1(raw: unknown): boolean {
  if (raw === undefined) return false;
  if (!isObject(raw)) return true;
  if (!isSafeInt(raw.v) || raw.v < 1) return true;
  return raw.v === FROZEN_VERSION && brokenV1(raw);
}
```

`extension/src/background/accountsStore.ts`:

```diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index 84326c3..143a102 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -16,6 +16,7 @@ import {wipeDappStores} from './dapp/store';
 import {PRESALE_RECORDS_KEY, wipePresaleRecords} from './presaleRecordsKey';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, accountsPolicyOk, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
+import {unreadableV1} from '../shared/unreadable';
 import {readWalletBalances} from '../../../core/solana/balances';
 import {RpcForbidden} from '../../../core/solana/rpc';
 
@@ -148,7 +149,7 @@ const bytesAtLeast = (x: unknown, n: number): x is string => (b64Length(x) ?? -1
  * no vault code and cannot check the ciphertext itself; the vault page proved the factor and
  * re-encrypted. Names are checked in storeEnvelope, against the stored envelope. Null otherwise.
  */
-function envelopeShape(x: unknown): StoredEnvelope | null {
+export function envelopeShape(x: unknown): StoredEnvelope | null {
   if (!isObj(x) || x.v !== 1 || (x.scheme !== 'slip10' && x.scheme !== 'cli')) return null;
   const {kdf, seed, password, passkey} = x;
   if (!isObj(kdf) || kdf.alg !== 'argon2id' || !kdfInBounds(kdf) || !bytesExactly(kdf.salt, ENVELOPE_BYTES.salt)) return null;
@@ -183,6 +184,22 @@ function envelopeShape(x: unknown): StoredEnvelope | null {
   };
 }
 
+/**
+ * B1e §2.1: the background's reading of a stored v1_vault value. A value envelopeShape refuses is `unreadable` when the
+ * frozen predicate (src/shared/unreadable.ts) says no version of Noctura can open it, and otherwise `refused`: this
+ * version's policy refuses it. Asking envelopeShape first is not a check of its own today: the predicate calls no value
+ * envelopeShape accepts unreadable (unreadable.test.ts: the partition and breadth rows), so swapping the two is
+ * invisible — those rows are the guard.
+ */
+export type VaultReading = {kind: 'none'} | {kind: 'unreadable'} | {kind: 'refused'} | {kind: 'wallet'; env: StoredEnvelope};
+
+export function vaultReading(raw: unknown): VaultReading {
+  if (raw === undefined) return {kind: 'none'};
+  const env = envelopeShape(raw);
+  if (env !== null) return {kind: 'wallet', env};
+  return unreadableV1(raw) ? {kind: 'unreadable'} : {kind: 'refused'};
+}
+
 /**
  * What an account change or a passkey enrolment may not change: the scheme, the whole KDF (salt and
  * cost), the password wrap, and the public key of any account in both envelopes. Only the seed
```

`extension/src/unlock/stored.ts`:

```diff
diff --git a/extension/src/unlock/stored.ts b/extension/src/unlock/stored.ts
index 1129ece..abc4b72 100644
--- a/extension/src/unlock/stored.ts
+++ b/extension/src/unlock/stored.ts
@@ -1,5 +1,6 @@
 import {checkEnvelope, type EnvelopeV1} from '../vault/envelope';
 import {accountsPolicyOk} from '../shared/envelopeRules';
+import {unreadableV1} from '../shared/unreadable';
 
 /**
  * What v1_vault holds, as the vault page reads it — the same three answers the background gives
@@ -30,6 +31,21 @@ export function storedVault(raw: unknown): StoredVault {
   return {kind: 'wallet', env: raw};
 }
 
+/**
+ * B1e §2.1: the page's reading of v1_vault — storedVault's `damaged` split in two. `unreadable`: the frozen predicate
+ * (src/shared/unreadable.ts) says no version of Noctura can open it. `refused`: this version's policy refuses it.
+ * Asking storedVault first is not a check of its own today: the predicate calls no value storedVault accepts
+ * unreadable (unreadable.test.ts: the partition and breadth rows), so swapping the two is invisible — those rows are
+ * the guard.
+ */
+export type VaultReading = {kind: 'none'} | {kind: 'unreadable'} | {kind: 'refused'} | {kind: 'wallet'; env: EnvelopeV1};
+
+export function vaultReading(raw: unknown): VaultReading {
+  const stored = storedVault(raw);
+  if (stored.kind !== 'damaged') return stored;
+  return unreadableV1(raw) ? {kind: 'unreadable'} : {kind: 'refused'};
+}
+
 /**
  * The passkey a bootstrap may offer a button for — only when the stored vault reads as a whole,
  * undamaged wallet (storedVault). Fix round 1 item 2: main.ts and the B1b-1 reauth mode used to
```

`extension/src/background/messages.ts`:

```diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index 8060602..f5543bc 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -7,7 +7,7 @@ import {armAutolock, lock} from './autolock';
 import {readSettings, settingsMutex, writeSettings} from './settings';
 import type {WalletDeps} from './deps';
 import {CHALLENGE_ID, challengeInfo, satisfyChallenge} from './reauthChallenges';
-import {changePassword, forgetWallet, provenRevisionIsStored, readWalletView, removePasskey, storeEnvelope} from './accountsStore';
+import {VAULT_KEY, changePassword, forgetWallet, provenRevisionIsStored, removePasskey, storeEnvelope, vaultReading} from './accountsStore';
 import {isOpen, readPending} from './pendingStore';
 import {startPoller} from './pending';
 import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
@@ -191,15 +191,22 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       // envelope exists), so this refuses only keys of no stored wallet. The envelope is read inside
       // the same sessionMutex section as the session write (setSessionIf), the section vault.forgetWallet
       // writes the vault in: keys bound to a wallet a forget removes meanwhile are never written.
+      // B1e §2.5 (R3): bound through envelopeShape, so no session is created over an envelope the background refuses
+      // (refused by this version, or unreadable) — those keys are `malformed`.
+      let refusal: 'unknown-account' | 'malformed' = 'unknown-account';
       const bound = async (): Promise<boolean> => {
-        const view = await readWalletView(ext);
-        const stored = new Map((view?.accounts ?? []).map(a => [a.index, a.publicKey]));
+        const reading = vaultReading(await ext.local.get(VAULT_KEY));
+        if (reading.kind === 'unreadable' || reading.kind === 'refused') {
+          refusal = 'malformed';
+          return false;
+        }
+        const stored = new Map((reading.kind === 'wallet' ? reading.env.accounts : []).map(a => [a.index, a.publicKey]));
         return accounts.every(a => stored.get(a.index) === a.publicKey);
       };
       // Fail closed: keys in storage.session with no alarm armed would never auto-lock, while
       // the vault page reports "Unlock failed". Anything that throws after the write undoes it.
       try {
-        if (!(await setSessionIf(ext, accounts, bound))) return {ok: false, error: 'unknown-account'};
+        if (!(await setSessionIf(ext, accounts, bound))) return {ok: false, error: refusal};
         await armAutolock(ext);
       } catch (e) {
         await lock(ext);
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates.**

Run: the Step 2 commands — `Test Files  5 passed (5)` · `Tests  200 passed (200)` (unreadable 109, unreadableInvariance 1, setKeysBinding 56, messages 29, locked 5).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  224 passed (224)` · `Tests  4854 passed (4854)` (previous tree 222 / 4692: +2 files, +162 tests — unreadable 109, unreadableInvariance 1, setKeysBinding +52). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  18 passed (18)` · `Tests  435 passed | 25 skipped (460)` (unchanged: no row of this task runs off).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale`, then `npm run gates` — exit 0, every gate ok once per build (vault isolation unchanged: `src/shared/unreadable.ts` imports only `@scure/base`, one of the vault page's packages), the last line `no presale ok (dist-nopresale off, dist on): the off build's module maps carry no presale module and of core/presale/ only 3 allowed; the on build carries 26 required modules and no presale module outside ON_BUILD; 107 markers (none in the off build, each in the on build); 9 strings and the decoder's instruction names stay in the off build`.

No repo-root `src/` or `core/` change: root `tsc` / `jest` and web `verify` are not run.

Playwright (this task registers no message and changes no screen, but changes what `vault.setKeys` accepts — so every spec whose flow sends it over a real envelope, and the CSP spec): `npx playwright test e2e/unlock.spec.ts e2e/onboarding.spec.ts e2e/settings.spec.ts e2e/csp.spec.ts e2e/visual-vault.spec.ts` — `24 passed (6.9m)` normally and `24 passed (6.6m)` under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'`.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1e-1 the frozen unreadableV1 predicate (U1–U3, imports only @scure/base) and the three readings of v1_vault on both sides; vault.setKeys bound through envelopeShape (R3: an unreadable or refused envelope is malformed, no session); §2.6's controls — F0–F9 from the committed fixture file, 43 deletable controls in the partition test, the encoder's breadth and the 458dfcd encoder's output, the invariance test with its own positive control

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the three named test files.** `UT` = `unreadable.test.ts` (109), `IV` = `unreadableInvariance.test.ts` (1), `SK` = `setKeysBinding.test.ts` (56). Bold ids are §2.6's. The file is `src/shared/unreadable.ts` unless named.

| id | the change | named test → observed |
|---|---|---|
| **M-version** | U2 changed to "`v !== 1` is unreadable" (§2.6): `if (!isSafeInt(raw.v) \|\| raw.v < 1) return true;` → `if (raw.v !== 1) return true;` | tsc 0 · UT RED `3 failed \| 106 passed (109)` — “unreadableV1 (§2.1 U1–U3) › F4 v: 2 → readable (never deletable)”; “unreadableV1 (§2.1 U1–U3) › every readable F control is a wallet (F0, F1, F9) or refused by this version (F2–F8), the same on both sides”; “unreadableV1 (§2.1 U1–U3) › a later version is never judged: v ≥ 2 is readable whatever its structure, and refused” · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” |
| **M-kdf** | U3 applies today's KDF bounds, as literals (§2.6): `\|\| !isSafeInt(kdf.p)) return true;` → `\|\| !isSafeInt(kdf.p)) return true; ⏎   if (kdf.m < 65536 \|\| kdf.m > 1048576 \|\| kdf.t < 3 \|\| kdf.t > 10 \|\| kdf.p < 1 \|\| kdf.p > 4) return true;` | tsc 0 · UT RED `4 failed \| 105 passed (109)` — “unreadableV1 (§2.1 U1–U3) › F2 kdf.m = 32768 (below the floor) → readable (never deletable)”; “unreadableV1 (§2.1 U1–U3) › F3 kdf.m = 2147483648 (above the cap) → readable (never deletable)”; “unreadableV1 (§2.1 U1–U3) › every readable F control is a wallet (F0, F1, F9) or refused by this version (F2–F8), the same on both sides” (+1 more) · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” |
| M-kdf-import | U3 applies today's KDF bounds, imported from `envelopeRules`: `import {base64} from '@scure/base';` → `import {base64} from '@scure/base'; ⏎ import {ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN} from './envelopeRules';`; `\|\| !isSafeInt(kdf.p)) return true;` → `\|\| !isSafeInt(kdf.p)) return true; ⏎   if ((['m', 't', 'p'] as const).some(k => (kdf[k] as number) < ENVELOPE_KDF_MIN[k] \|\| (kdf[k] as number) > ENVELOPE_KDF_MAX[k])) return true;` | tsc 0 · UT RED `5 failed \| 104 passed (109)` — “unreadable.ts is frozen and stands alone › imports exactly @scure/base, and nothing else”; “unreadableV1 (§2.1 U1–U3) › F2 kdf.m = 32768 (below the floor) → readable (never deletable)”; “unreadableV1 (§2.1 U1–U3) › F3 kdf.m = 2147483648 (above the cap) → readable (never deletable)” (+2 more) · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” |
| **M-policy** | U3 calls `accountsPolicyOk` (§2.6): `import {base64} from '@scure/base';` → `import {base64} from '@scure/base'; ⏎ import {accountsPolicyOk} from './envelopeRules';`; `return accounts.some((a: unknown) =>` → `if (!accountsPolicyOk(raw.scheme === 'cli' ? 'cli' : 'slip10', accounts as {index: number; publicKey: string}[])) return true; ⏎   return accounts.some((a: unknown) =>` | tsc 0 · UT RED `8 failed \| 101 passed (109)` — “unreadable.ts is frozen and stands alone › imports exactly @scure/base, and nothing else”; “unreadableV1 (§2.1 U1–U3) › U3 an account null → unreadable”; “unreadableV1 (§2.1 U1–U3) › F5 101 accounts → readable (never deletable)” (+5 more) · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” · SK RED `1 failed \| 55 passed (56)` — “vault.setKeys binds through envelopeShape (B1e §2.5, R3) › an unreadable value (U3 an account null): malformed, no session” |
| **M-scheme** | U3 requires `scheme ∈ {slip10, cli}` (§2.6): `if (typeof raw.scheme !== 'string') return true;` → `if (raw.scheme !== 'slip10' && raw.scheme !== 'cli') return true;` | tsc 0 · UT RED `3 failed \| 106 passed (109)` — “unreadableV1 (§2.1 U1–U3) › F8 scheme: bip44 → readable (never deletable)”; “unreadableV1 (§2.1 U1–U3) › every readable F control is a wallet (F0, F1, F9) or refused by this version (F2–F8), the same on both sides”; “unreadableV1 (§2.1 U1–U3) › what is policy, not structure, is readable: a KDF cost of any safe integer, an unknown scheme string, an empty publicKey, duplicate indexes” · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” |
| **M-iv** | the `seed.iv` length check dropped (§2.6, the negative direction): `!isObject(seed) \|\| !bytesExactly(seed.iv, FROZEN_IV_BYTES) \|\|` → `!isObject(seed) \|\| (FROZEN_IV_BYTES < 0 && !bytesExactly(seed.iv, FROZEN_IV_BYTES)) \|\|` | tsc 0 · UT RED `4 failed \| 105 passed (109)` — “unreadableV1 (§2.1 U1–U3) › U3 seed.iv of 11 bytes → unreadable”; “unreadableV1 (§2.1 U1–U3) › U3 seed.iv of 13 bytes → unreadable”; “the partition (§2.1): the four readings never overlap › U3 seed.iv of 11 bytes is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides” (+1 more) · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” |
| M-ct | the `seed.ct` length check dropped: `\|\| !bytesAtLeast(seed.ct, FROZEN_MIN_CT_BYTES)) return true;` → `\|\| (FROZEN_MIN_CT_BYTES < 0 && !bytesAtLeast(seed.ct, FROZEN_MIN_CT_BYTES))) return true;` | tsc 0 · UT RED `4 failed \| 105 passed (109)` — “unreadableV1 (§2.1 U1–U3) › U3 seed.ct of 16 bytes → unreadable”; “unreadableV1 (§2.1 U1–U3) › U3 seed.ct not base64 → unreadable”; “the partition (§2.1): the four readings never overlap › U3 seed.ct of 16 bytes is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides” (+1 more) · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” |
| M-undefined | no wallet read as unreadable: `if (raw === undefined) return false;` → `if (raw === undefined) return true;` | tsc 0 · UT RED `1 failed \| 108 passed (109)` — “unreadableV1 (§2.1 U1–U3) › is false for undefined: no wallet is not a damaged one” |
| M-passkey-null | `passkey: null` read as absent: `if (passkey !== undefined) {` → `if (passkey !== undefined && passkey !== null) {` | tsc 0 · UT RED `2 failed \| 107 passed (109)` — “unreadableV1 (§2.1 U1–U3) › U3 passkey: null → unreadable”; “the partition (§2.1): the four readings never overlap › U3 passkey: null is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides” · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” |
| M-index | a negative index accepted: `!isSafeInt(a.index) \|\| a.index < 0 \|\|` → `!isSafeInt(a.index) \|\|` | tsc 0 · UT RED `2 failed \| 107 passed (109)` — “unreadableV1 (§2.1 U1–U3) › U3 index: -1 → unreadable”; “the partition (§2.1): the four readings never overlap › U3 index: -1 is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides” · IV RED `1 failed (1)` — “unreadableV1 does not move when the opener’s policy is tightened › every control keeps its verdict; the mock demonstrably bit” |
| M-later | U3 judges every `v ≥ 1`, not only `v === 1`: `return raw.v === FROZEN_VERSION && brokenV1(raw);` → `return raw.v >= FROZEN_VERSION && brokenV1(raw);` | tsc 0 · UT RED `1 failed \| 108 passed (109)` — “unreadableV1 (§2.1 U1–U3) › a later version is never judged: v ≥ 2 is readable whatever its structure, and refused” |
| M-import | one constant taken from `envelopeRules` (the same value: only the source pin can see it): `import {base64} from '@scure/base';` → `import {base64} from '@scure/base'; ⏎ import {ENVELOPE_BYTES} from './envelopeRules';`; `const FROZEN_IV_BYTES = 12;` → `const FROZEN_IV_BYTES = ENVELOPE_BYTES.iv;` | tsc 0 · UT RED `1 failed \| 108 passed (109)` — “unreadable.ts is frozen and stands alone › imports exactly @scure/base, and nothing else” |
| M-R3 | `messages.ts`: the old `readWalletView`-only binding (§2.5): `import {VAULT_KEY, changePassword, forgetWallet, provenRevisionIsStored, removePasskey, storeEnvelope, vaultReading} from './accountsStore';` → `import {VAULT_KEY, changePassword, forgetWallet, provenRevisionIsStored, readWalletView, removePasskey, storeEnvelope, vaultReading} from './accountsStore';`; `const reading = vaultReading(await ext.local.get(VAULT_KEY)); ⏎         if (reading.kind === 'unreadable' \|\| reading.kind === 'refused') { ⏎           refusal = 'malformed'; ⏎           return false; ⏎         } ⏎         const stored = new Map((reading.kind === 'wallet' ? reading.env.accounts : []).map(a => [a.index, a.publicKey]));` → `const raw = await ext.local.get(VAULT_KEY); ⏎         if (raw === null && vaultReading(raw).kind === 'none') refusal = 'malformed'; ⏎         const view = await readWalletView(ext); ⏎         const stored = new Map((view?.accounts ?? []).map(a => [a.index, a.publicKey]));` | tsc 0 · SK RED `51 failed \| 5 passed (56)` — “vault.setKeys binds through envelopeShape (B1e §2.5, R3) › kdf.m = 32768 (refused by this version) and the key the envelope records: malformed, no session”; “vault.setKeys binds through envelopeShape (B1e §2.5, R3) › F2 kdf.m = 32768 (below the floor), whose accounts still record the key: malformed, no session”; “vault.setKeys binds through envelopeShape (B1e §2.5, R3) › F3 kdf.m = 2147483648 (above the cap), whose accounts still record the key: malformed, no session” (+48 more) |
| M-R3-refusal | `messages.ts`: a refused envelope answered `unknown-account`: `refusal = 'malformed'; ⏎           return false;` → `return false;` | tsc 0 · SK RED `51 failed \| 5 passed (56)` — “vault.setKeys binds through envelopeShape (B1e §2.5, R3) › kdf.m = 32768 (refused by this version) and the key the envelope records: malformed, no session”; “vault.setKeys binds through envelopeShape (B1e §2.5, R3) › F2 kdf.m = 32768 (below the floor), whose accounts still record the key: malformed, no session”; “vault.setKeys binds through envelopeShape (B1e §2.5, R3) › F3 kdf.m = 2147483648 (above the cap), whose accounts still record the key: malformed, no session” (+48 more) |
| M-page-reading | `stored.ts`: every value `storedVault` refuses read as unreadable: `return unreadableV1(raw) ? {kind: 'unreadable'} : {kind: 'refused'};` → `return unreadableV1(raw) \|\| raw !== null ? {kind: 'unreadable'} : {kind: 'refused'};` | tsc 0 · UT RED `3 failed \| 106 passed (109)` — “unreadableV1 (§2.1 U1–U3) › every readable F control is a wallet (F0, F1, F9) or refused by this version (F2–F8), the same on both sides”; “unreadableV1 (§2.1 U1–U3) › a later version is never judged: v ≥ 2 is readable whatever its structure, and refused”; “unreadableV1 (§2.1 U1–U3) › what is policy, not structure, is readable: a KDF cost of any safe integer, an unknown scheme string, an empty publicKey, duplicate indexes” |
| M-bg-reading | `accountsStore.ts`: only `null` read as unreadable: `return unreadableV1(raw) ? {kind: 'unreadable'} : {kind: 'refused'};` → `return unreadableV1(raw) && raw === null ? {kind: 'unreadable'} : {kind: 'refused'};` | tsc 0 · UT RED `42 failed \| 67 passed (109)` — “the partition (§2.1): the four readings never overlap › U1 [] is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides”; “the partition (§2.1): the four readings never overlap › U1 "x" is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides”; “the partition (§2.1): the four readings never overlap › U1 a number is refused by both openers: envelopeShape null, storedVault damaged — read as unreadable on both sides” (+39 more) |
| M-pin-kat | `src/vault/__tests__/fixtures/envelope-v1.json` swapped: one byte of a name changed (the name is outside the seed AAD, so only the pin can see it): `"name": "Account 1"` → `"name": "Account 2"` | tsc 0 · UT RED `1 failed \| 108 passed (109)` — “the fixtures the controls read are pinned › envelope-v1.json has its committed sha256” |
| M-pin-458dfcd | `src/vault/__tests__/fixtures/envelope-v1-458dfcd.json` swapped: one byte of its note changed: `0xa0..0xbf.` → `0xa0..0xbe.` | tsc 0 · UT RED `1 failed \| 108 passed (109)` — “the fixtures the controls read are pinned › envelope-v1-458dfcd.json has its committed sha256” |

18 mutations, every one `tsc` 0 and red. Each red file above is named; the files not listed for a mutation stayed green (e.g. `SK` stays green under every predicate mutant: `setKeys` answers `malformed` for unreadable and refused alike, so only M-R3 and M-R3-refusal reach it, and M-policy through a throw). The sweep: `t1-logs/mutate.py` in the dry run — each mutant a fresh `git archive HEAD` copy, node_modules linked, removed after its run.

#### Notes for the executor (Task 1)

- **Rev 2.1 (review N2): the breadth row carries `}, 60_000)`** like its two real-KDF siblings — it runs the real Argon2id (0.55 s alone, 2.6 s inside the whole run on an 8-core machine): the default 5 s was a 2× margin a CI runner could lose. Totals unchanged.
- **Rev 2 (review M3, comments only): asking the opener first is marked as not a check of its own.** Both `vaultReading` doc comments (`accountsStore.ts`, `stored.ts`) now say that the predicate calls no value the opener accepts unreadable, so swapping the two is invisible today and the partition and breadth rows of `unreadable.test.ts` are the guard — the review's mutants `order-bg` / `order-page` were green (equivalent), as spec §2.1 says. No code, no test, no total changed; the 18 mutations were re-run on the rebuilt commit 9c9b8db: every one `tsc` 0 and red with rev 1's counts.
- **Ruling: both readings ask the opener first, then the predicate** — `vaultReading` is `wallet` whenever `envelopeShape` (background) / `storedVault` (page) accepts, and only a value the opener refuses is split into `unreadable` / `refused` — why: if the predicate and an opener ever disagreed, a value the opener can open must never be offered for a password-less removal (fail safe); today the partition test makes the order invisible (every deletable control is refused by both openers) — cost if wrong: none.
- **Ruling: `vault.setKeys` answers `malformed` for `unreadable` and `refused`, `unknown-account` as before for no wallet and for a key the envelope does not record** — §2.5 names `malformed` for a `stored-invalid` envelope; an absent vault was never "invalid" (the H1 row "refuses any keys while no wallet is stored" keeps its answer) — cost if wrong: an error code; the session is refused either way.
- **Ruling: `envelopeShape` is exported** (unchanged), for the partition test and for Task 2's `forgetDamaged` — cost if wrong: none.
- **Ruling: the controls live in one test module, `src/shared/__tests__/vaultControls.ts`**, which Task 2 imports for `vault.forgetDamaged` — one list, so the predicate's tests and the message's cannot drift apart — cost if wrong: none.
- **Ruling: 43 deletable controls, not only the spec's list:** every value §2.6 names, plus review 2's (`v: 0`, `v: 1.5`, no `v`, …) and, so each clause is broken on both sides of its bound, `v: -1`, `v: null`, a number, a boolean, the fixture inside an array, no `scheme`, `kdf` a string, `kdf.t: 1.5`, no `kdf.p`, salts of 15 and 17 bytes, an IV of 13, a ciphertext that is not base64, a wrap of 41, `passkey` a string, a passkey wrap of 39, an account `null`, `index: 0.5`, a broken second account. Every one is in the partition test — cost if wrong: none (more rows).
- **Ruling: the 458dfcd fixture is one file with both shapes** (`{note, created, withPasskey}`: `createEnvelope`, then `addPasskeyWrap` of it), made by the 458dfcd encoder with today's `argon2idKdf` at the declared production cost — the file's own test proves it is real (its password and its passkey unwrap one data key). Its random bytes make it non-reproducible: the plan carries it verbatim, and `unreadable.test.ts` pins its sha256 — and that of `envelope-v1.json`, which no test pinned before (controller ruling, 2026-11-01): a swapped or edited fixture fails (M-pin-kat, M-pin-458dfcd) — cost if wrong: none; a deliberate fixture change must re-pin in the same commit.
- **Ruling: the breadth's odd names are eight accounts of one envelope**, not eight envelopes (review 2's probe listed them as one shape) — cost if wrong: none; each name is a string, which is all U3 asks.
- **Ruling: `messages.test.ts`' `vaultExt` and `windowHarness.tsx`'s `ENV` become whole envelopes** (byte-length stubs, as `messages.test.ts`' own `STORED` already was): R3 refuses their `{v, scheme, accounts}` stubs, so 9 rows (6 in `messages.test.ts`, 3 in `locked.test.tsx`) went red with the implementation and green with the fixtures. Every other `{v, scheme, accounts}` stub in the suite stays: none of them sends `vault.setKeys` (the whole suite is green).
- **Deviation (stated): §2.6's F table is asserted here as values** (`unreadableV1` false; `wallet` for F0, F1, F9 and `refused` for F2–F8 on both sides; `setKeys` `malformed` over F2–F8, a session over F0, F1, F9), not through `vault.forgetDamaged`, which is Task 2's. Task 2 runs the same `F` list through the message (`not-unreadable`, `v1_vault` unchanged) and `DELETABLE` (`forgotten`).
- **Deviation (stated): Playwright ran five specs, not the whole suite** — this task registers no message and changes no screen; it changes what `vault.setKeys` accepts, so the specs whose flows send it over a real envelope (onboarding create and import, unlock, #39's restore and add account in settings, the vault visuals) and the CSP spec: `npx playwright test e2e/unlock.spec.ts e2e/onboarding.spec.ts e2e/settings.spec.ts e2e/csp.spec.ts e2e/visual-vault.spec.ts` — `24 passed (6.9m)` normally and `24 passed (6.6m)` under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'`.
- **Ruling (controller, 2026-11-01): the 458dfcd vault is accepted as §2.1's out-of-predicate case, deferred with it (spec §8 / §11 Q2); no code change.** Only a late-September developer profile could hold one; nothing was ever released. The finding behind it: **the first encoder's vault is a readable wallet whose seed no longer opens.** 458dfcd sealed the seed without the header's additionalData, so today's opener accepts its shape, its password unwraps the data key, and AES-GCM then fails (`unreadable.test.ts`, the fixture row) — exactly §2.1's "out of the predicate" case: #9's damaged notice after the unwrap, never deletable without a password. Only a developer profile from 2026-09-28/29 could hold one (B1a never shipped); nothing to do, but it is the one real vault in history on that path.
- **For the next tasks:** Task 2 — judge with `unreadableV1(raw)` on the raw `storage.local` value at steps 2 and 5 (`vaultReading(raw).kind === 'unreadable'` is the same verdict); reuse `F`, `F_WALLETS`, `DELETABLE`, `breadth()`, `firstEncoder()`, `edited()`; any test that sends `vault.setKeys` must store a whole envelope; M-lock's session must be written straight into the session store (R3 now keeps `setKeys` from making one over an unreadable value — `setKeysBinding.test.ts`, the `DELETABLE` rows).
- **Dry run:** clone `dry/b1e1`, commit `e9b0c63` on 9562c5c. The first issue claimed `vault.forgetDamaged` in three comments (a check no test proves yet) and carried the odd names as raw characters (the editor turned `\u` escapes into the characters); both fixed before the final runs — the comments now name only what this task's tests prove, and the names are `\u` escapes (same runtime strings). Every run above — red, green, builds, gates, the sweep — is on the final commit; Playwright ran on the builds of the commit before it (`2c97597`), whose product code is the final commit's byte for byte (only test files differ: `vaultControls.ts`' escapes and the two fixture pins in `unreadable.test.ts`, added on the controller's ruling and amended into the same commit).

#### Notes for the executor (Task 1, continued) — the dry run's rulings, deviations and hand-over

- Rulings beyond the brief: the eight in "Notes for the executor" above (opener-first readings; `malformed` vs `unknown-account`; `envelopeShape` exported; one shared controls module; 43 deletable controls; the 458dfcd file's shape; odd names in one envelope; the two fixture stubs made whole). Controller rulings applied (2026-11-01): **Ruling: the 458dfcd vault (readable, its seed failing AES-GCM) is the spec's out-of-predicate case, deferred with it; no code change — why: only a late-September developer profile could hold one and nothing was released — cost if wrong: such a profile's vault can be removed only through #37 with its password (or by uninstalling)**; and both fixtures pinned by sha256 (M-pin-kat, M-pin-458dfcd).
- Deviations from the brief: none in scope; the F table's `vault.forgetDamaged` column is left to Task 2 (stated above); 18 named mutations instead of the brief's five (the five are among them, bold); Playwright on five specs (stated above).
- The next task must know: the "For the next tasks" line above — above all, `setKeys` now refuses `{v, scheme, accounts}` stubs, and M-lock's session must be written straight into the session store.


### Task 2: `vault.forgetDamaged` and the damaged-vault screens (SECURITY-CRITICAL) — the one removal of `v1_vault` without a password, and only of a value the frozen predicate calls unreadable: `src/shared/storedDigest.ts` (the stored value's text, `JSON.stringify` of what `storage.local` returns, and its sha256 — the bytes "Save the damaged data" downloads and the token the removal is bound to); `forgetDamaged` in `accountsStore.ts` in E5's order (§2.4 steps 1–7: malformed → `serial` → no-wallet / **not-unreadable** (Task 1's background `vaultReading`, opener first) / busy on another digest → lock → v1_pending check-and-clear in one `updatePending` (`send-open`, E12) → re-read, still unreadable with the same digest (`busy`) → under `sessionMutex` no session (`unlocked`), remove → best effort `removeWalletData` + `clearCaches`); the message `vault.forgetDamaged {expectedDigest}` in `PRIVILEGED` and `VAULT_PAGE_ONLY` (never a flag on `vault.forgetWallet`); the page's one builder `src/unlock/damagedFlow.ts` (re-reads at the click, sends only for the value shown), imported only by `screens/removeDamaged.ts` (a source test with its positive control); the two damaged states as one screen `screens/damaged.ts` (`v-damaged`), shown by #9 and #1 from their own read (unreadable: Save + Remove; refused by this version: "update the extension", Save, no removal — R4); the removal screen `unlock.html?mode=remove-damaged` (`screens/removeDamaged.ts`: the lines, the lowest-index readable address, Save, #37's typed DELETE and 1 s hold in plain DOM — `view/deleteConfirm.ts`, the seam Task 3 fills with the checkbox); "Save the damaged data" (`view/saveDamaged.ts`, `<a download>` of a `data:application/json` URL of exactly the hashed text, on both states and on the removal screen); §2.6's `vault.forgetDamaged` column of the F table, every deletable control through the message, the breadth and the 458dfcd fixture through it; E2E `damaged.spec.ts` (the saved bytes read back from Playwright's download, the removal by hold, the refusals) and the CSP walk extended to the new modes; named mutations M-digest, M-lock and thirty more (with a gate control)

**Spec:** B1e §2.2 (the two states, the removal screen, its refusals), §2.3 (Save the damaged data, R4), §2.4 (the token, the message, the page's builder and its source test, steps 1–7, "after"), §2.5 (a session over an unreadable value: locked at step 3, refused at step 6), §2.6 (the F table's `vault.forgetDamaged` column, the deletable controls → `forgotten`, the digest controls, M-digest, M-lock); owner decisions E9 (two states), E10 (Save), E11 (#37's confirmation — the hold here, the checkbox Task 3), E12 (an open send refuses), E18/R4 (Save on both states). **Not here:** the checkbox and its one-activation path (Task 3, §3 — the seam is `mountDeleteConfirm`), the phrase (`v1_phishing_phrase` joins `WALLET_DATA_KEYS` in Task 4, so step 7 wipes it with no change here), the formal visual pass of every undrawn element (Task 7).

**Files:**
- Create: `extension/src/shared/storedDigest.ts`, `extension/src/unlock/damagedFlow.ts`, `extension/src/unlock/screens/damaged.ts`, `extension/src/unlock/screens/removeDamaged.ts`, `extension/src/unlock/view/deleteConfirm.ts`, `extension/src/unlock/view/saveDamaged.ts`
- Modify: `extension/src/background/accountsStore.ts` (`forgetDamaged`), `extension/src/background/messages.ts` (the type, its two lists, its handler), `extension/src/unlock/screens/unlock.ts` and `extension/src/unlock/screens/welcome.ts` (the damaged states from their own read), `extension/src/unlock/mode.ts`, `extension/src/unlock/modes.ts`, `extension/src/unlock/page.ts` (the mode, its target), `extension/src/unlock/view/dom.ts` (two screens), `extension/src/unlock/strings.ts` (`DAMAGED`, `TYPED_DELETE`), `extension/unlock.html` (two sections), `extension/src/unlock/unlock.css` (their layout)
- Create (tests): `extension/src/background/__tests__/forgetDamaged.test.ts`, `extension/src/shared/__tests__/storedDigest.test.ts`, `extension/src/unlock/__tests__/damagedFlow.test.ts`, `extension/src/unlock/__tests__/damagedScreens.test.ts`, `extension/e2e/damaged.spec.ts`
- Modify (tests): `extension/src/shared/__tests__/vaultControls.ts` (fixtures read by path: under happy-dom `import.meta.url` is not a file URL), `extension/src/background/__tests__/messages.test.ts` (the literal type list), `extension/scripts/__tests__/check-vault-isolation.test.mjs` (the vault page's screens and views listed), `extension/src/unlock/__tests__/unlockScreen.test.ts`, `extension/src/unlock/__tests__/welcome.test.ts` (their damaged rows now see the new states), `extension/e2e/unlock.spec.ts`, `extension/e2e/visual-vault.spec.ts` (the same), `extension/e2e/csp.spec.ts` (the walk: 23 → 26 pages)

**Interfaces:**
- Consumes (Task 1): `vaultReading` / `VaultReading` from `src/background/accountsStore.ts` (background) and from `src/unlock/stored.ts` (page); `unreadableV1` (through them); from `src/shared/__tests__/vaultControls.ts`: `F`, `DELETABLE`, `breadth()`, `firstEncoder()`, `edited()`, `fixtureEnvelope()`, `FIXTURE_ACCOUNT`, `MNEMONIC`, `PASSWORD`. Existing: `WALLET_DATA_KEYS`, `removeWalletData`, `clearCaches`, `lock`, `updatePending` / `isOpen`, `sessionMutex` / `getSession`, `serial`, `REVISION` (accountsStore); `PageDeps`, `exclusive`, `showScreen`, `addressGroups`, `COMMON`, `DELETE`, `RESTORE`, `WELCOME` (vault page); in tests only, `DELETE_TEXT` / `WORD` / `HOLD_MS` (`src/app/screens/DeleteWallet.tsx`) and `HOLD_TICK_MS` (`src/app/ui/HoldButton.tsx`).
- Produces (`extension/src/shared/storedDigest.ts`, imports only `@noble/hashes`):
  ```ts
  export function storedText(raw: unknown): string;    // JSON.stringify(raw); throws TypeError for undefined
  export function storedDigest(raw: unknown): string;  // sha256(utf8(storedText(raw))), lowercase hex
  ```
- Produces (`extension/src/background/accountsStore.ts`):
  ```ts
  export type ForgetDamagedResult = 'forgotten' | 'malformed' | 'no-wallet' | 'not-unreadable' | 'busy' | 'send-open' | 'unlocked';
  export async function forgetDamaged(ext: Ext, req: {expectedDigest: unknown}): Promise<ForgetDamagedResult>;
  ```
- Produces (message): `{type: 'vault.forgetDamaged', expectedDigest: string}` from `/unlock.html` only → `{ok: true}` | `{ok: false, error: 'malformed' | 'no-wallet' | 'not-unreadable' | 'busy' | 'send-open' | 'unlocked' | 'failed' | 'unavailable' | 'forbidden'}`. After `forgotten` the poller restarts for an open record a late send appended (as `vault.forgetWallet`).
- Produces (`extension/src/unlock/damagedFlow.ts` — its only export, its only importer `screens/removeDamaged.ts`):
  ```ts
  export type RemoveDamagedOutcome = 'removed' | 'changed' | 'not-unreadable' | 'no-wallet' | 'send-open' | 'unlocked' | 'failed';
  export async function removeDamaged(deps: {send: Send; readEnvelope(): Promise<unknown>}, shownDigest: string): Promise<RemoveDamagedOutcome>;
  ```
- Produces (vault page):
  ```ts
  // screens/damaged.ts
  export type DamagedKind = 'unreadable' | 'refused';
  export interface DamagedScreen { show(kind: DamagedKind, raw: unknown): void; }
  export function mountDamaged(deps: PageDeps): DamagedScreen;
  // screens/removeDamaged.ts
  export function readableAddress(raw: unknown): string | null;   // lowest safe-integer index ≥ 0 whose publicKey has the ADDRESS shape
  export function mountRemoveDamaged(deps: PageDeps, damaged: DamagedScreen): {show(): Promise<void>};
  // view/saveDamaged.ts
  export function fillSaveLink(link: HTMLAnchorElement, raw: unknown): string;   // sets download + data: href, returns storedDigest(raw)
  // view/deleteConfirm.ts — THE SEAM for Task 3
  export const CONFIRM_WORD = 'DELETE'; export const HOLD_MS = 1_000; export const HOLD_TICK_MS = 30;
  export interface ConfirmParts { field: HTMLInputElement; eyebrow: HTMLElement; matched: HTMLElement; box: HTMLElement; check: HTMLElement; help: HTMLElement; caption: HTMLElement; button: HTMLButtonElement; fill: HTMLElement; count: HTMLElement; }
  export interface DeleteConfirm { reset(): void; render(): void; }
  export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allowed(): boolean; onConfirmed(): void; onPressing?(pressing: boolean): void}): DeleteConfirm;
  ```
  `PageMode` gains `{mode: 'remove-damaged'}` (`unlock.html?mode=remove-damaged`, no parameter read); `PageTarget` gains `'unlock.html?mode=remove-damaged'`; `SCREENS` gains `'v-damaged'`, `'v-remove-damaged'`; `strings.ts` gains `DAMAGED` (`noAddress`, `changed`, `unlocked`) and `TYPED_DELETE` (#37's `caseSensitive`, `keepGoing`, `notAPrefix`).
- **The confirmation (stated, as the brief asked): this task implements the hold-only path** — typed DELETE (exact, case-sensitive) + the 1 s hold (pointer or Space / Enter held on the button; Enter in the field nothing) — so no commit ever has a password-less removal without its friction. **The seam is `mountDeleteConfirm`**: Task 3 adds the checkbox there (an optional `checkbox` in `ConfirmParts`; when it is checked and the word matches, one activation of the button — a click, or Space / Enter on it — calls `onConfirmed`; it clears on every `reset()` and whenever the word stops matching) and its markup beside `#rd-hold` in `unlock.html`. `removeDamaged.ts` then changes only the `parts` object it passes; its `onConfirmed` (→ `removeShown`) is the same for both paths. Today a click (press and release at once) confirms nothing.
- **What later tasks rely on:** step 7 wipes `WALLET_DATA_KEYS` through `removeWalletData`, so Task 4's `v1_phishing_phrase` (added to that list) goes with a removal with no change here — Task 4's own test should assert it through `vault.forgetDamaged` too. Task 7: `e2e/damaged.spec.ts` exists (its shots are `test-results/visual/damaged-*.png`); extend it, don't duplicate it. The removal screen's ids: `rd-word`, `rd-hold`, `rd-fill`, `rd-count`, `rd-eyebrow`, `rd-matched`, `rd-box`, `rd-check`, `rd-help`, `rd-caption`, `rd-save`, `rd-address`, `rd-no-address`, `rd-helper`, `rd-notice(-line|-help)`, `rd-again`, `rd-setup`, `rd-close`, `rd-cancel`, `rd-x`; the states': `dmg-unreadable(-body)`, `dmg-refused(-body)`, `dmg-help`, `dmg-save`, `dmg-remove`.

**How the removal is held.** Three independent judges, and the last one decides. The page's state screen shows Remove only for `unreadable` (and its listener acts only then); the removal screen reads and judges again at load and offers the confirmation only for `unreadable`; `removeDamaged` reads again at the click and sends only when the value is still unreadable on the page's reading **and** its digest is the one on screen. Then the background ignores all of that: inside `serial` it reads, judges with the opener first and then the frozen predicate (Task 1's `vaultReading`), compares the digest, locks, clears `v1_pending` or refuses, reads and judges and compares again, and removes only under `sessionMutex` with no session present. The digest is computed in the tests with `node:crypto` over `JSON.stringify`, never with `storedDigest`, so a change to the shared function moves the tests' expectation away from it (M-digest-text). The same `F` / `DELETABLE` lists Task 1's predicate tests use run through the message.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/background/__tests__/forgetDamaged.test.ts`:

```ts
import {createHash} from 'node:crypto';
import {VAULT_KEY, WALLET_DATA_KEYS, forgetDamaged, vaultReading} from '../accountsStore';
import {handleMessage} from '../messages';
import {SESSION_KEY, getSession, setSession} from '../session';
import {PENDING_KEY, readPending, updatePending} from '../pendingStore';
import {BALANCE_CACHE_KEY, PRICE_CACHE_KEY} from '../balanceCache';
import {FORBIDDEN_UNTIL_KEY} from '../deps';
import {AUTOLOCK_ALARM, armAutolock} from '../autolock';
import {DELETABLE, F, breadth, edited, firstEncoder, fixtureEnvelope} from '../../shared/__tests__/vaultControls';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, pendingRecord} from './fixtures';

// B1e §2.4, §2.6: vault.forgetDamaged — the one removal of v1_vault without a password. The digest is computed here with
// node:crypto over JSON.stringify of the stored value, independently of src/shared/storedDigest.ts.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const from = (path: string) => ({id: ID, origin: ORIGIN, url: `${ORIGIN}${path}`});
const digestOf = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');
const UNREADABLE = edited(e => (e.seed = 'damaged'));
/** A second unreadable value, as a disk fault might leave in the first one's place. */
const OTHER_UNREADABLE = edited(e => (e.password = 'damaged'));

/** Every key of the wallet's data, the caches and the 403 cool-down, each holding something. */
async function withData(raw: unknown) {
  const ext = fakeExt();
  if (raw !== undefined) await ext.local.set(VAULT_KEY, raw);
  for (const key of WALLET_DATA_KEYS) await ext.local.set(key, [{of: key}]);
  await ext.local.set(BALANCE_CACHE_KEY, {});
  await ext.local.set(PRICE_CACHE_KEY, {});
  await ext.local.set(FORBIDDEN_UNTIL_KEY, 123);
  return ext;
}
const wiped = async (ext: ReturnType<typeof fakeExt>): Promise<Record<string, unknown>> => {
  const out: Record<string, unknown> = {};
  for (const key of [VAULT_KEY, ...WALLET_DATA_KEYS, PENDING_KEY, BALANCE_CACHE_KEY, PRICE_CACHE_KEY]) {
    const v = await ext.local.get(key);
    if (v !== undefined) out[key] = v;
  }
  return out;
};
const send = (ext: ReturnType<typeof fakeExt>, expectedDigest: unknown, path = '/unlock.html') => handleMessage(ext, {type: 'vault.forgetDamaged', expectedDigest}, from(path), fakeDeps());

describe('vault.forgetDamaged — who may ask', () => {
  it('only the vault page: refused from the popup, the UI tab, the approval window, another extension and a web page — nothing removed', async () => {
    const ext = await withData(UNREADABLE);
    const digest = digestOf(UNREADABLE);
    for (const path of ['/popup.html', '/wallet.html', '/approve.html']) expect(await send(ext, digest, path)).toEqual({ok: false, error: 'forbidden'});
    for (const sender of [
      {id: 'someotherextensionidxxxxxxxxxxxx', origin: ORIGIN, url: `${ORIGIN}/unlock.html`},
      {id: ID, origin: 'https://evil.example', url: 'https://evil.example/unlock.html'},
    ]) {
      expect(await handleMessage(ext, {type: 'vault.forgetDamaged', expectedDigest: digest}, sender, fakeDeps())).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
    // Positive control: the same message from the vault page removes it.
    expect(await send(ext, digest)).toEqual({ok: true});
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('malformed digests are refused before anything is read: 63 hex, 65 hex, upper case, not a string, absent', async () => {
    const ext = await withData(UNREADABLE);
    await setSession(ext, [ACCOUNT]);
    const digest = digestOf(UNREADABLE);
    for (const bad of [digest.slice(1), `${digest}0`, digest.toUpperCase(), 7, null, undefined]) {
      expect(await forgetDamaged(ext, {expectedDigest: bad})).toBe('malformed');
      expect(await send(ext, bad)).toEqual({ok: false, error: 'malformed'});
    }
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
    // Nothing was locked either.
    expect(await getSession(ext)).not.toBeNull();
  });
});

describe('vault.forgetDamaged — never a readable vault (§2.6: F0–F9, the breadth, the first encoder)', () => {
  it.each(F.map(([name, env]) => [name, env] as const))('%s → not-unreadable, v1_vault byte-identical, not locked', async (_name, env) => {
    const ext = await withData(env);
    await setSession(ext, [ACCOUNT]);
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(env)})).toBe('not-unreadable');
    expect(JSON.stringify(await ext.local.get(VAULT_KEY))).toBe(JSON.stringify(env));
    expect(await getSession(ext)).not.toBeNull();
    expect(Object.keys(await wiped(ext)).sort()).toEqual([VAULT_KEY, ...WALLET_DATA_KEYS, BALANCE_CACHE_KEY, PRICE_CACHE_KEY].sort());
  });

  it('a refused vault (F2–F8) and a wallet (F0, F1, F9) answer the same through the message', async () => {
    for (const [name, env] of F) {
      const ext = await withData(env);
      expect([name, await send(ext, digestOf(env))]).toEqual([name, {ok: false, error: 'not-unreadable'}]);
      expect([name, JSON.stringify(await ext.local.get(VAULT_KEY))]).toEqual([name, JSON.stringify(env)]);
    }
  });

  it('every envelope the real encoder writes, and the first encoder’s output (458dfcd), → not-unreadable', async () => {
    for (const [name, env] of [...(await breadth()), ...firstEncoder()]) {
      const ext = await withData(env);
      expect([name, await forgetDamaged(ext, {expectedDigest: digestOf(env)})]).toEqual([name, 'not-unreadable']);
      expect([name, JSON.stringify(await ext.local.get(VAULT_KEY))]).toEqual([name, JSON.stringify(env)]);
    }
  }, 60_000);
});

describe('vault.forgetDamaged — an unreadable vault (§2.6: every deletable control)', () => {
  it.each(DELETABLE.map(([name, raw]) => [name, raw] as const))('%s → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept', async (_name, raw) => {
    const ext = await withData(raw);
    await ext.local.set(PENDING_KEY, [pendingRecord({state: 'confirmed'}), pendingRecord({id: 'r2', state: 'expired'})]);
    expect(vaultReading(raw).kind).toBe('unreadable');
    expect(await send(ext, digestOf(raw))).toEqual({ok: true});
    expect(await wiped(ext)).toEqual({v1_pending: []});
    expect(await readPending(ext)).toEqual([]);
    expect(await ext.local.get(FORBIDDEN_UNTIL_KEY)).toBe(123);
  });

  it('a session present at the click is locked first (step 3), then the vault removed', async () => {
    const ext = await withData(UNREADABLE);
    await setSession(ext, [ACCOUNT]);
    await armAutolock(ext);
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(true);
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('forgotten');
    expect(await ext.session.get(SESSION_KEY)).toBeUndefined();
    expect(ext.alarmsSet.has(AUTOLOCK_ALARM)).toBe(false);
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
  });

  it('no wallet: no-wallet, nothing removed', async () => {
    const ext = await withData(undefined);
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('no-wallet');
    expect(Object.keys(await wiped(ext)).sort()).toEqual([...WALLET_DATA_KEYS, BALANCE_CACHE_KEY, PRICE_CACHE_KEY].sort());
  });

  it('two removal tabs confirming at once: one is forgotten, the other waits for it and finds no wallet', async () => {
    const ext = await withData(UNREADABLE);
    const digest = digestOf(UNREADABLE);
    expect(await Promise.all([send(ext, digest), send(ext, digest)])).toEqual([{ok: true}, {ok: false, error: 'no-wallet'}]);
    expect(await wiped(ext)).toEqual({v1_pending: []});
  });
});

describe('vault.forgetDamaged — the digest (C2)', () => {
  it('the digest of another value: busy, nothing removed, not locked', async () => {
    const ext = await withData(UNREADABLE);
    await setSession(ext, [ACCOUNT]);
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(OTHER_UNREADABLE)})).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
    expect(await getSession(ext)).not.toBeNull();
  });

  it('the same object in another key order is another text: busy (fails closed)', async () => {
    const ext = await withData(UNREADABLE);
    const reordered = Object.fromEntries(Object.entries(UNREADABLE).reverse());
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(reordered)})).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('an unreadable value replaced by another unreadable one after the lock (step 5): busy, the new value kept', async () => {
    const ext = await withData(UNREADABLE);
    const clear = ext.session.clear.bind(ext.session);
    ext.session.clear = async () => {
      await clear();
      await ext.local.set(VAULT_KEY, OTHER_UNREADABLE); // a writer outside the section (a disk fault, a bug)
    };
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(OTHER_UNREADABLE);
    expect(Object.keys(await wiped(ext))).toContain(WALLET_DATA_KEYS[0]);
  });

  it('an unreadable value replaced by a wallet after the lock (step 5): busy, the wallet kept', async () => {
    const ext = await withData(UNREADABLE);
    const clear = ext.session.clear.bind(ext.session);
    const wallet = fixtureEnvelope();
    ext.session.clear = async () => {
      await clear();
      await ext.local.set(VAULT_KEY, wallet);
    };
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('busy');
    expect(await ext.local.get(VAULT_KEY)).toEqual(wallet);
  });
});

describe('vault.forgetDamaged — a send still open, a session back (E12, step 6)', () => {
  it('send-open for a pending and for a stuck record: locked, the vault and the record kept; removed once it settles', async () => {
    for (const state of ['pending', 'stuck'] as const) {
      const ext = await withData(UNREADABLE);
      await setSession(ext, [ACCOUNT]);
      await ext.local.set(PENDING_KEY, [pendingRecord({state})]);
      expect(await send(ext, digestOf(UNREADABLE))).toEqual({ok: false, error: 'send-open'});
      expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
      expect(await getSession(ext)).toBeNull();
      expect((await readPending(ext)).map(r => r.state)).toEqual([state]);
      expect(Object.keys(await wiped(ext))).toEqual(expect.arrayContaining([...WALLET_DATA_KEYS]));
      await ext.local.set(PENDING_KEY, [pendingRecord({state: 'expired'})]);
      expect(await send(ext, digestOf(UNREADABLE))).toEqual({ok: true});
      expect(await wiped(ext)).toEqual({v1_pending: []});
    }
  });

  it('a session written into the session store after the lock (as a disk fault would leave one): unlocked, the vault byte-identical', async () => {
    const ext = await withData(UNREADABLE);
    const clear = ext.session.clear.bind(ext.session);
    ext.session.clear = async () => {
      await clear();
      // Inside lock()'s sessionMutex section: queued behind it, so it lands before the removal's section (step 6).
      void setSession(ext, [ACCOUNT]);
    };
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('unlocked');
    expect(JSON.stringify(await ext.local.get(VAULT_KEY))).toBe(JSON.stringify(UNREADABLE));
    expect(Object.keys(await wiped(ext))).toEqual(expect.arrayContaining([...WALLET_DATA_KEYS]));
  });

  it('a send appended by one that passed its session check before the lock, landing during the pending check, is kept', async () => {
    const ext = await withData(UNREADABLE);
    await setSession(ext, [ACCOUNT]);
    const get = ext.local.get.bind(ext.local);
    let injected: Promise<unknown> | undefined;
    ext.local.get = async key => {
      const v = await get(key);
      if (key === PENDING_KEY && injected === undefined && (await getSession(ext)) === null) {
        injected = updatePending(ext, rs => [...rs, pendingRecord({id: 'late', account: ACCOUNT.publicKey})]);
        await Promise.race([injected, new Promise(resolve => setTimeout(resolve, 50))]);
      }
      return v;
    };
    expect(await forgetDamaged(ext, {expectedDigest: digestOf(UNREADABLE)})).toBe('forgotten');
    await injected;
    expect((await readPending(ext)).map(r => r.id)).toEqual(['late']);
  });
});

describe('vault.forgetDamaged — storage failures', () => {
  it('a failure before the removal leaves the vault in place: failed', async () => {
    const ext = await withData(UNREADABLE);
    await ext.local.set(PENDING_KEY, []);
    const set = ext.local.set.bind(ext.local);
    ext.local.set = async (key, value) => {
      if (key === PENDING_KEY) throw new Error('quota');
      return set(key, value);
    };
    expect(await send(ext, digestOf(UNREADABLE))).toEqual({ok: false, error: 'failed'});
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('the removal is the commit point: a failed cleanup after it still answers forgotten', async () => {
    const ext = await withData(UNREADABLE);
    const remove = ext.local.remove.bind(ext.local);
    ext.local.remove = async key => {
      if (key === WALLET_DATA_KEYS[0]) throw new Error('quota');
      return remove(key);
    };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await send(ext, digestOf(UNREADABLE))).toEqual({ok: true});
    expect(await ext.local.get(VAULT_KEY)).toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('without deps the message is unavailable and nothing is read', async () => {
    const ext = await withData(UNREADABLE);
    expect(await handleMessage(ext, {type: 'vault.forgetDamaged', expectedDigest: digestOf(UNREADABLE)}, from('/unlock.html'))).toEqual({ok: false, error: 'unavailable'});
    expect(await ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });
});
```

Create `extension/src/shared/__tests__/storedDigest.test.ts`:

```ts
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {storedDigest, storedText} from '../storedDigest';
import {DELETABLE, fixtureEnvelope} from './vaultControls';

// B1e §2.3, §2.4: the digest is sha256 of the UTF-8 bytes of JSON.stringify of the stored value — checked here against
// node:crypto, not against the module's own helpers.
const independent = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');

describe('storedText / storedDigest', () => {
  it('the text is JSON.stringify of the value, keys in stored order; the digest its sha256, lowercase hex', () => {
    for (const raw of [fixtureEnvelope(), ...DELETABLE.map(([, v]) => v), {b: 1, a: 2}, {name: 'é\u{1F600}'}]) {
      expect(storedText(raw)).toBe(JSON.stringify(raw));
      expect(storedDigest(raw)).toBe(independent(raw));
      expect(storedDigest(raw)).toMatch(/^[0-9a-f]{64}$/);
    }
    // Key order is part of the text: the same object reordered is another digest.
    expect(storedDigest({a: 1, b: 2})).not.toBe(storedDigest({b: 2, a: 1}));
  });

  it('a lone surrogate is escaped by JSON.stringify, so the text is well formed and its bytes are those hashed', () => {
    const raw = {v: 1, accounts: [{index: 0, name: '\uD800', publicKey: 'x'}]};
    expect(storedText(raw)).toContain('\\ud800');
    expect(storedDigest(raw)).toBe(independent(raw));
  });

  it('undefined (no wallet) has no text: it throws, never a digest', () => {
    expect(() => storedText(undefined)).toThrow(TypeError);
    expect(() => storedDigest(undefined)).toThrow(TypeError);
  });

  it('imports only @noble/hashes (the vault page and the background both carry it)', () => {
    const src = readFileSync(join(__dirname, '..', 'storedDigest.ts'), 'utf8');
    expect([...src.matchAll(/^import .* from '([^']+)';$/gm)].map(m => m[1])).toEqual(['@noble/hashes/sha2.js', '@noble/hashes/utils.js']);
  });
});
```

Create `extension/src/unlock/__tests__/damagedFlow.test.ts`:

```ts
import {createHash} from 'node:crypto';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {DELETABLE, F, edited} from '../../shared/__tests__/vaultControls';
import * as damagedFlow from '../damagedFlow';
import {removeDamaged} from '../damagedFlow';
import type {Send} from '../types';

// B1e §2.4: the vault page's half of vault.forgetDamaged, against the REAL background.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const UNLOCK = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};
const digestOf = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');
const UNREADABLE = edited(e => (e.seed = 'damaged'));

async function background(raw: unknown) {
  const ext = fakeExt();
  if (raw !== undefined) await ext.local.set(VAULT_KEY, raw);
  const sent: {type: string; [k: string]: unknown}[] = [];
  const send: Send = async m => {
    sent.push(JSON.parse(JSON.stringify(m)) as {type: string});
    return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK, fakeDeps())) as {ok: boolean; error?: string};
  };
  return {ext, send, sent, readEnvelope: () => ext.local.get(VAULT_KEY)};
}

describe('removeDamaged (B1e §2.4)', () => {
  it('an unreadable value with the digest shown: ONE vault.forgetDamaged carrying only that digest; removed', async () => {
    for (const [name, raw] of DELETABLE) {
      const b = await background(raw);
      expect([name, await removeDamaged(b, digestOf(raw))]).toEqual([name, 'removed']);
      expect([name, b.sent]).toEqual([name, [{type: 'vault.forgetDamaged', expectedDigest: digestOf(raw)}]]);
      expect(await b.readEnvelope()).toBeUndefined();
    }
  });

  it('a readable value (F0–F9) is never sent: not-unreadable, nothing sent, nothing removed', async () => {
    for (const [name, env] of F) {
      const b = await background(env);
      expect([name, await removeDamaged(b, digestOf(env))]).toEqual([name, 'not-unreadable']);
      expect([name, b.sent]).toEqual([name, []]);
      expect(await b.readEnvelope()).toEqual(env);
    }
  });

  it('the value stored now is not the one shown (another digest): changed, nothing sent', async () => {
    const b = await background(UNREADABLE);
    expect(await removeDamaged(b, digestOf(edited(e => (e.password = 'damaged'))))).toBe('changed');
    expect(b.sent).toEqual([]);
    expect(await b.readEnvelope()).toEqual(UNREADABLE);
  });

  it('no wallet, and a read that throws: nothing sent', async () => {
    const b = await background(undefined);
    expect(await removeDamaged(b, digestOf(UNREADABLE))).toBe('no-wallet');
    const failing = {
      send: b.send,
      readEnvelope: async () => {
        throw new Error('Extension context invalidated.');
      },
    };
    expect(await removeDamaged(failing, digestOf(UNREADABLE))).toBe('failed');
    expect(b.sent).toEqual([]);
  });

  it("the background's refusals by name; busy is changed; anything else, or a send that throws, is failed", async () => {
    const b = await background(UNREADABLE);
    for (const [error, out] of [
      ['send-open', 'send-open'],
      ['unlocked', 'unlocked'],
      ['busy', 'changed'],
      ['not-unreadable', 'not-unreadable'],
      ['no-wallet', 'no-wallet'],
      ['malformed', 'failed'],
      ['forbidden', 'failed'],
      ['something-else', 'failed'],
    ] as const) {
      expect([error, await removeDamaged({send: async () => ({ok: false, error}), readEnvelope: b.readEnvelope}, digestOf(UNREADABLE))]).toEqual([error, out]);
    }
    const throwing: Send = async () => {
      throw new Error('gone');
    };
    expect(await removeDamaged({send: throwing, readEnvelope: b.readEnvelope}, digestOf(UNREADABLE))).toBe('failed');
  });
});

// B1e §2.4: vault.forgetDamaged is sent from one screen. damagedFlow.ts builds the message and exports only removeDamaged,
// and only screens/removeDamaged.ts imports it. A TRIPWIRE over source text (a file can spell a name some other way), as
// deleteWallet.test.ts's; the walker's own positive control is that it finds the files it must.
describe('vault.forgetDamaged stays behind its one screen', () => {
  const src = join(__dirname, '..', '..');
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) {
        if (e !== '__tests__') walk(p);
      } else if (/\.tsx?$/.test(e)) files.push(relative(src, p).split(sep).join('/'));
    }
  };
  walk(src);
  const naming = (re: RegExp) => files.filter(f => re.test(readFileSync(join(src, f), 'utf8'))).sort();

  it('damagedFlow exports exactly removeDamaged', () => {
    expect(Object.keys(damagedFlow)).toEqual(['removeDamaged']);
  });

  it('the message type is named by the background (its handler and its lists) and by damagedFlow.ts only', () => {
    expect(files).toEqual(expect.arrayContaining(['background/messages.ts', 'unlock/damagedFlow.ts', 'unlock/screens/removeDamaged.ts', 'app/screens/DeleteWallet.tsx']));
    expect(naming(/vault\.forgetDamaged/)).toEqual(['background/accountsStore.ts', 'background/messages.ts', 'unlock/damagedFlow.ts']);
  });

  it('only screens/removeDamaged.ts imports damagedFlow, and only it calls removeDamaged', () => {
    expect(naming(/damagedFlow/)).toEqual(['unlock/screens/removeDamaged.ts']);
    expect(naming(/\bremoveDamaged\s*\(/)).toEqual(['unlock/damagedFlow.ts', 'unlock/screens/removeDamaged.ts']);
  });
});
```

Create `extension/src/unlock/__tests__/damagedScreens.test.ts`:

```ts
// @vitest-environment happy-dom
import {createHash} from 'node:crypto';
import {VAULT_KEY, WALLET_DATA_KEYS} from '../../background/accountsStore';
import {PENDING_KEY} from '../../background/pendingStore';
import {setSession} from '../../background/session';
import {ACCOUNT, pendingRecord} from '../../background/__tests__/fixtures';
import {DELETE_TEXT, HOLD_MS as POPUP_HOLD_MS, WORD} from '../../app/screens/DeleteWallet';
import {HOLD_TICK_MS as POPUP_TICK_MS} from '../../app/ui/HoldButton';
import {createEnvelope} from '../../vault/envelope';
import {DELETABLE, F, FIXTURE_ACCOUNT, MNEMONIC, PASSWORD, edited} from '../../shared/__tests__/vaultControls';
import {pageMode} from '../mode';
import {startMode} from '../modes';
import {mountDamaged} from '../screens/damaged';
import {mountRemoveDamaged, readableAddress} from '../screens/removeDamaged';
import {mountUnlock} from '../screens/unlock';
import {mountWelcome} from '../screens/welcome';
import {TYPED_DELETE} from '../strings';
import {CONFIRM_WORD, HOLD_MS, HOLD_TICK_MS} from '../view/deleteConfirm';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1e §2.2–§2.4 against the REAL background: #9's and #1's damaged states, "Save the damaged data", and the removal.
const digestOf = (raw: unknown): string => createHash('sha256').update(Buffer.from(JSON.stringify(raw), 'utf8')).digest('hex');
const UNREADABLE = edited(e => (e.seed = 'damaged'));
const OTHER_UNREADABLE = edited(e => (e.password = 'damaged'));
const REFUSED = edited(e => (e.v = 2));
const K1 = 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb';
const DATA_PREFIX = 'data:application/json;charset=utf-8,';

beforeEach(loadPage);

/** What a saved file holds: the link's data: URL decoded. */
function saved(id: string): {name: string; text: string} {
  const a = el<HTMLAnchorElement>(id);
  const href = a.getAttribute('href') ?? '';
  expect(href.startsWith(DATA_PREFIX)).toBe(true);
  expect(a.hasAttribute('download')).toBe(true);
  return {name: a.getAttribute('download') ?? '', text: decodeURIComponent(href.slice(DATA_PREFIX.length))};
}
const forgets = (h: Harness) => h.sent.filter(m => m.type === 'vault.forgetDamaged');

async function removal(raw: unknown) {
  const h = await harness({vault: raw});
  await mountRemoveDamaged(h.deps, mountDamaged(h.deps)).show();
  return h;
}
const press = () => el('rd-hold').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true, button: 0}));
const releaseHold = () => el('rd-hold').dispatchEvent(new PointerEvent('pointerup', {bubbles: true, button: 0}));
/** Types DELETE and holds the button for the full second. */
async function confirmRemoval(h: Harness) {
  type(el<HTMLInputElement>('rd-word'), 'DELETE');
  press();
  h.timers.advance(HOLD_MS + HOLD_TICK_MS);
  await h.until(() => !h.deps.gate.isBusy());
}

describe('the damaged states on #9 and #1 (B1e §2.2)', () => {
  it.each([
    ['#9', (h: Harness) => mountUnlock(h.deps).show(null)],
    ['#1', (h: Harness) => mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show()],
  ] as const)('%s: an unreadable vault → "Wallet data is damaged", Save and Remove; nothing sent', async (_screen, open) => {
    const h = await harness({vault: UNREADABLE});
    await open(h);
    expect(visible(el('v-damaged'))).toBe(true);
    expect(text(el('dmg-unreadable'))).toBe('Wallet data is damaged');
    expect(text(el('dmg-unreadable-body'))).toBe("This browser's copy of your wallet can't be read by this or any later version of Noctura. Your funds are on Solana. After you remove this copy, only your recovery phrase reaches them.");
    // Said before any typed word (Minor 6), and never "funds are safe".
    expect(el('dmg-unreadable-body').querySelector('b')?.textContent).toBe('only your recovery phrase reaches them');
    expect(text(el('v-damaged'))).not.toMatch(/safe/i);
    expect(visible(el('dmg-refused'))).toBe(false);
    expect(visible(el('dmg-save'))).toBe(true);
    expect(visible(el('dmg-remove'))).toBe(true);
    expect(text(el('dmg-remove'))).toBe('Remove damaged wallet');
    // Save comes before Remove (§2.3).
    expect([...el('v-damaged').querySelectorAll('.sticky-bar > *')].map(e => e.id)).toEqual(['dmg-save', 'dmg-remove']);
    click(el('dmg-remove'));
    expect(h.went).toEqual(['unlock.html?mode=remove-damaged']);
    expect(h.sent).toEqual([]);
    expect(unstyled('v-damaged')).toEqual([]);
  });

  it.each([
    ['#9', (h: Harness) => mountUnlock(h.deps).show(null)],
    ['#1', (h: Harness) => mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show()],
  ] as const)('%s: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)', async (_screen, open) => {
    for (const [name, env] of F.filter(([n]) => !['F0', 'F1', 'F9'].some(w => n.startsWith(w)))) {
      loadPage();
      const h = await harness({vault: env});
      await open(h);
      expect([name, visible(el('dmg-refused'))]).toEqual([name, true]);
      // E19: a short heading; the sentence that says why is the body's first line.
      expect(text(el('dmg-refused'))).toBe('Update Noctura to open this wallet');
      expect(el('dmg-refused').querySelector('h1')?.textContent).toBe('Update Noctura to open this wallet');
      expect(el('dmg-refused-body').firstElementChild?.textContent).toBe("This version of Noctura can't open this wallet's data.");
      expect(text(el('dmg-refused-body'))).toBe(
        "This version of Noctura can't open this wallet's data. Update Noctura (in Chrome: Extensions → Update). If it is up to date, the data may have been changed. Nothing was removed. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.",
      );
      expect(visible(el('dmg-unreadable'))).toBe(false);
      expect(visible(el('dmg-save'))).toBe(true);
      expect([name, visible(el('dmg-remove')), el<HTMLButtonElement>('dmg-remove').disabled]).toEqual([name, false, true]);
      // A listener a stray event still reaches does not act — with the button made clickable, a click goes nowhere: the
      // removal is offered only for `unreadable`.
      el<HTMLButtonElement>('dmg-remove').disabled = false;
      click(el('dmg-remove'));
      expect([name, h.went, h.sent]).toEqual([name, [], []]);
      expect(saved('dmg-save').text).toBe(JSON.stringify(env));
    }
  });

  it('a wallet (F0, F1, F9) never shows the damaged screen on #9 or #1', async () => {
    for (const [name, env] of F.filter(([n]) => ['F0', 'F1', 'F9'].some(w => n.startsWith(w)))) {
      loadPage();
      const h = await harness({vault: env});
      await mountUnlock(h.deps).show(null);
      expect([name, visible(el('v-damaged')), visible(el('unl-entry'))]).toEqual([name, false, true]);
      loadPage();
      await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
      expect([name, visible(el('v-damaged')), text(el('wel-notice-line'))]).toEqual([name, false, 'A wallet already exists in this browser. Nothing was changed.']);
    }
  });

  it('#9: an attempt that ends `damaged` over a wallet (its seed fails AES-GCM after the unwrap, §2.1 out of the predicate) keeps the damaged notice — never the removal', async () => {
    // A wallet at the page's test cost with its ciphertext's first character changed: still well formed, and its
    // password still unwraps the data key.
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: FIXTURE_ACCOUNT}], kdf: testKdf});
    const broken = {...env, seed: {...env.seed, ct: `${env.seed.ct.startsWith('A') ? 'B' : 'A'}${env.seed.ct.slice(1)}`}};
    const h = await harness({vault: broken});
    await mountUnlock(h.deps).show(null);
    type(el<HTMLInputElement>('unl-password'), PASSWORD);
    click(el('unl-submit'));
    await h.until(() => visible(el('unl-notice')) && !h.deps.gate.isBusy());
    expect(text(el('unl-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(visible(el('v-damaged'))).toBe(false);
    expect(h.sent.filter(m => m.type === 'vault.setKeys')).toEqual([]);
  }, 60_000);
});

describe('"Save the damaged data" (B1e §2.3, E10, R4)', () => {
  it('carries exactly the bytes the digest hashes — the digest the removal then sends — named by its first 8 hex', async () => {
    const surrogate = edited(e => {
      e.seed = 1;
      e.accounts = [{index: 0, name: '\uD800', publicKey: FIXTURE_ACCOUNT}];
    });
    for (const [name, raw] of [...DELETABLE, ['a lone surrogate in a name', surrogate] as const]) {
      loadPage();
      const h = await removal(raw);
      const file = saved('rd-save');
      expect([name, file.text]).toEqual([name, JSON.stringify(raw)]);
      expect([name, file.name]).toEqual([name, `noctura-damaged-wallet-${digestOf(raw).slice(0, 8)}.json`]);
      await confirmRemoval(h);
      expect([name, forgets(h)]).toEqual([name, [{type: 'vault.forgetDamaged', expectedDigest: createHash('sha256').update(Buffer.from(file.text, 'utf8')).digest('hex')}]]);
      expect([name, h.went]).toEqual([name, ['unlock.html?mode=welcome']]);
    }
  }, 60_000);

  it('the damaged screen’s link carries the same bytes on both states, and is offered before any removal', async () => {
    for (const raw of [UNREADABLE, REFUSED]) {
      loadPage();
      const h = await harness({vault: raw});
      await mountUnlock(h.deps).show(null);
      expect(saved('dmg-save')).toEqual({name: `noctura-damaged-wallet-${digestOf(raw).slice(0, 8)}.json`, text: JSON.stringify(raw)});
    }
  });

  it('no object URL, no text/html, and no new permission (the link is a plain data:application/json download)', async () => {
    await removal(UNREADABLE);
    for (const id of ['rd-save', 'dmg-save']) expect(el(id).tagName).toBe('A');
    expect(el('rd-save').getAttribute('href')).not.toMatch(/^blob:|text\/html/);
  });
});

describe('the removal screen (B1e §2.2)', () => {
  it('names the lowest-index readable address, never accounts[0]; the lines; no password field', async () => {
    const raw = edited(e => {
      e.seed = 'damaged';
      e.accounts = [
        {index: 3, name: 'Three', publicKey: K1},
        {index: 1, name: 'One', publicKey: FIXTURE_ACCOUNT},
        {index: 0, name: 'Zero', publicKey: 'not an address'},
        {index: -1, name: 'Neg', publicKey: K1},
        null,
      ];
    });
    expect(readableAddress(raw)).toBe(FIXTURE_ACCOUNT);
    const h = await removal(raw);
    expect(visible(el('rd-entry'))).toBe(true);
    expect([...el('rd-address').querySelectorAll('.addr-groups > span')].map(g => g.textContent)).toEqual(FIXTURE_ACCOUNT.match(/.{1,4}/g));
    expect(visible(el('rd-no-address'))).toBe(false);
    expect(text(el('rd-entry'))).toContain('This removes the wallet from this browser only.');
    expect(text(el('rd-entry'))).toContain('Your funds are on Solana. After you remove this copy, only your recovery phrase reaches them.');
    expect(el('v-remove-damaged').querySelector('input[type="password"]')).toBeNull();
    expect(text(el('rd-entry'))).not.toContain('Zero');
    expect(h.sent).toEqual([]);
    expect(unstyled('v-remove-damaged')).toEqual([]);
  });

  it('no readable address: "The address can\'t be read"', async () => {
    for (const raw of [null, [], 'x', edited(e => (e.accounts = {})), edited(e => (e.accounts = [{index: '0', publicKey: FIXTURE_ACCOUNT}]))]) {
      loadPage();
      expect(readableAddress(raw)).toBeNull();
      await removal(raw);
      expect(visible(el('rd-address'))).toBe(false);
      expect(text(el('rd-no-address'))).toBe("The address can't be read");
    }
  });

  it('typed DELETE + the full hold removes it: one forgetDamaged, the wallet data gone, then #1', async () => {
    const h = await removal(UNREADABLE);
    for (const key of WALLET_DATA_KEYS) await h.ext.local.set(key, ['x']);
    await confirmRemoval(h);
    expect(forgets(h)).toEqual([{type: 'vault.forgetDamaged', expectedDigest: digestOf(UNREADABLE)}]);
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
    for (const key of WALLET_DATA_KEYS) expect(await h.ext.local.get(key)).toBeUndefined();
    expect(h.went).toEqual(['unlock.html?mode=welcome']);
  });

  it('without the word, or with the word not exact, the button refuses a press; nothing sent', async () => {
    const h = await removal(UNREADABLE);
    for (const typed of ['', 'DEL', 'delete', 'DELETE ', 'DELETEX']) {
      type(el<HTMLInputElement>('rd-word'), typed);
      expect([typed, el<HTMLButtonElement>('rd-hold').disabled]).toEqual([typed, true]);
      press();
      h.timers.advance(HOLD_MS * 2);
      releaseHold();
    }
    await h.until(() => !h.deps.gate.isBusy());
    expect(forgets(h)).toEqual([]);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('a hold released before the full second removes nothing; held again for the full second it does', async () => {
    const h = await removal(UNREADABLE);
    type(el<HTMLInputElement>('rd-word'), 'DELETE');
    expect(el<HTMLButtonElement>('rd-hold').disabled).toBe(false);
    press();
    h.timers.advance(HOLD_MS - HOLD_TICK_MS);
    expect(text(el('rd-hold'))).toMatch(/^Hold to delete · 0\.\d s$/);
    releaseHold();
    h.timers.advance(HOLD_MS);
    expect(text(el('rd-hold'))).toBe('Hold to delete');
    expect(forgets(h)).toEqual([]);
    press();
    h.timers.advance(HOLD_MS + HOLD_TICK_MS);
    await h.until(() => h.went.length > 0);
    expect(forgets(h)).toHaveLength(1);
  });

  it('Enter in the word field confirms nothing; Space or Enter held on the button is the hold', async () => {
    const h = await removal(UNREADABLE);
    type(el<HTMLInputElement>('rd-word'), 'DELETE');
    el('rd-word').dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true, cancelable: true}));
    h.timers.advance(HOLD_MS * 2);
    expect(forgets(h)).toEqual([]);
    el('rd-hold').dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true}));
    h.timers.advance(HOLD_MS + HOLD_TICK_MS);
    await h.until(() => h.went.length > 0);
    expect(forgets(h)).toHaveLength(1);
  });

  it('the value replaced by another unreadable one between the screen and the click: nothing sent, the new value shown with the line', async () => {
    const h = await removal(UNREADABLE);
    await h.ext.local.set(VAULT_KEY, OTHER_UNREADABLE);
    await confirmRemoval(h);
    expect(forgets(h)).toEqual([]);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(OTHER_UNREADABLE);
    expect(text(el('rd-helper'))).toBe('The stored data changed — check it again');
    // The screen read again: it now offers the NEW value (its bytes, its digest), the word cleared.
    expect(saved('rd-save').text).toBe(JSON.stringify(OTHER_UNREADABLE));
    expect(el<HTMLInputElement>('rd-word').value).toBe('');
    await confirmRemoval(h);
    expect(forgets(h)).toEqual([{type: 'vault.forgetDamaged', expectedDigest: digestOf(OTHER_UNREADABLE)}]);
  });

  it('the background answers busy (replaced after the page compared): the line, the screen reads again, nothing removed', async () => {
    const h = await harness({
      vault: UNREADABLE,
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.forgetDamaged') await h.ext.local.set(VAULT_KEY, OTHER_UNREADABLE);
        return inner(m);
      },
    });
    await mountRemoveDamaged(h.deps, mountDamaged(h.deps)).show();
    await confirmRemoval(h);
    expect(forgets(h)).toHaveLength(1);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(OTHER_UNREADABLE);
    expect(text(el('rd-helper'))).toBe('The stored data changed — check it again');
    expect(saved('rd-save').text).toBe(JSON.stringify(OTHER_UNREADABLE));
  });

  it('a value that became readable meanwhile is never removed: refused → the refused state; a wallet → "A wallet already exists"', async () => {
    for (const [next, check] of [
      [REFUSED, () => expect(visible(el('dmg-refused'))).toBe(true)],
      [F[0]?.[1], () => expect(text(el('rd-notice-line'))).toBe('A wallet already exists in this browser. Nothing was changed.')],
    ] as const) {
      loadPage();
      const h = await removal(UNREADABLE);
      await h.ext.local.set(VAULT_KEY, next);
      await confirmRemoval(h);
      expect(forgets(h)).toEqual([]);
      expect(await h.ext.local.get(VAULT_KEY)).toEqual(next);
      check();
    }
  });

  it('opened over a refused vault or a wallet it offers no removal at all', async () => {
    let h = await removal(REFUSED);
    expect(visible(el('v-damaged'))).toBe(true);
    expect(visible(el('dmg-remove'))).toBe(false);
    expect(visible(el('v-remove-damaged'))).toBe(false);
    loadPage();
    h = await removal(F[0]?.[1]);
    expect(visible(el('rd-entry'))).toBe(false);
    expect(visible(el('rd-hold'))).toBe(false);
    expect(text(el('rd-notice-help'))).toBe('Open the Noctura icon to use it.');
    // Its own way out, and no second one: [Close this tab] without the bar's Cancel.
    expect([visible(el('rd-close')), visible(el('rd-cancel'))]).toEqual([true, false]);
    type(el<HTMLInputElement>('rd-word'), 'DELETE');
    press();
    h.timers.advance(HOLD_MS * 2);
    expect(forgets(h)).toEqual([]);
  });

  it('a send still open (E12): #37’s line, nothing removed, the record kept; Start again reads again', async () => {
    const h = await removal(UNREADABLE);
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    await confirmRemoval(h);
    expect(text(el('rd-notice-line'))).toBe(DELETE_TEXT.sendOpen);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
    expect([visible(el('rd-again')), visible(el('rd-close')), visible(el('rd-cancel'))]).toEqual([true, true, false]);
    click(el('rd-again'));
    await h.until(() => visible(el('rd-entry')) && !h.deps.gate.isBusy());
    expect(el<HTMLInputElement>('rd-word').value).toBe('');
  });

  it('a session back between the lock and the removal: "Noctura was unlocked meanwhile — try again", nothing removed', async () => {
    const h = await removal(UNREADABLE);
    const clear = h.ext.session.clear.bind(h.ext.session);
    h.ext.session.clear = async () => {
      await clear();
      void setSession(h.ext, [ACCOUNT]);
    };
    await confirmRemoval(h);
    expect(text(el('rd-notice-line'))).toBe('Noctura was unlocked meanwhile — try again');
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('a send that fails (the background unreachable): the failed line, the confirmation asked again', async () => {
    const h = await harness({
      vault: UNREADABLE,
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.forgetDamaged') throw new Error('Could not establish connection.');
        return inner(m);
      },
    });
    await mountRemoveDamaged(h.deps, mountDamaged(h.deps)).show();
    await confirmRemoval(h);
    expect(text(el('rd-helper'))).toBe('Something went wrong. Nothing was deleted.');
    expect(el<HTMLInputElement>('rd-word').value).toBe('');
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
  });

  it('Cancel and the X close the tab; nothing sent', async () => {
    const h = await removal(UNREADABLE);
    click(el('rd-cancel'));
    await h.until(() => !h.deps.gate.isBusy());
    click(el('rd-x'));
    await h.until(() => !h.deps.gate.isBusy());
    expect(h.closed).toBe(2);
    expect(h.sent).toEqual([]);
  });

  it('unlock.html?mode=remove-damaged mounts this screen (and only the URL names it — no parameter is read)', async () => {
    expect(pageMode('?mode=remove-damaged')).toEqual({mode: 'remove-damaged'});
    expect(pageMode('?mode=remove-damaged&digest=00')).toEqual({mode: 'remove-damaged'});
    const h = await harness({vault: UNREADABLE});
    startMode(pageMode('?mode=remove-damaged'), h.deps);
    await h.until(() => visible(el('rd-entry')));
    expect(saved('rd-save').text).toBe(JSON.stringify(UNREADABLE));
  });
});

describe('#37’s words and hold, as the popup has them (E11)', () => {
  it('the word, the hold and its tick are the popup’s; the copy is DELETE_TEXT’s', () => {
    expect([CONFIRM_WORD, HOLD_MS, HOLD_TICK_MS]).toEqual([WORD, POPUP_HOLD_MS, POPUP_TICK_MS]);
    expect([TYPED_DELETE.caseSensitive, TYPED_DELETE.notAPrefix, TYPED_DELETE.keepGoing(3)]).toEqual([DELETE_TEXT.caseSensitive, DELETE_TEXT.notAPrefix, DELETE_TEXT.keepGoing(3)]);
    loadPage();
    expect(el<HTMLInputElement>('rd-word').placeholder).toBe(DELETE_TEXT.placeholder);
    expect(text(el('rd-eyebrow'))).toBe(`${DELETE_TEXT.typeLead}${DELETE_TEXT.typeWord}${DELETE_TEXT.typeTail}`);
    expect(text(el('rd-matched'))).toBe(DELETE_TEXT.matched);
    expect(text(el('rd-caption'))).toBe(DELETE_TEXT.holdCaption);
    expect(text(el('rd-hold'))).toBe(DELETE_TEXT.hold);
  });
});
```

Modify `extension/src/shared/__tests__/vaultControls.ts`:

```diff
diff --git a/extension/src/shared/__tests__/vaultControls.ts b/extension/src/shared/__tests__/vaultControls.ts
index fd7f95e..45f015d 100644
--- a/extension/src/shared/__tests__/vaultControls.ts
+++ b/extension/src/shared/__tests__/vaultControls.ts
@@ -1,4 +1,5 @@
 import {readFileSync} from 'node:fs';
+import {join} from 'node:path';
 import {argon2idAsync} from '@noble/hashes/argon2.js';
 import {base64} from '@scure/base';
 import {KDF_CAP, addPasskeyWrap, createEnvelope, rewrapPassword, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
@@ -17,7 +18,8 @@ export const PASSWORD = 'correct horse battery staple';
 /** Account 0 of MNEMONIC (slip10), the fixture's only account. */
 export const FIXTURE_ACCOUNT = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
 
-const readJson = (name: string): Json => JSON.parse(readFileSync(new URL(`../../vault/__tests__/fixtures/${name}`, import.meta.url), 'utf8')) as Json;
+// By path, not import.meta.url: under happy-dom (the vault page's screen tests) import.meta.url is not a file URL.
+const readJson = (name: string): Json => JSON.parse(readFileSync(join(__dirname, '..', '..', 'vault', '__tests__', 'fixtures', name), 'utf8')) as Json;
 const stored = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
 const obj = (x: unknown): Json => {
   if (typeof x !== 'object' || x === null || Array.isArray(x)) throw new Error('the fixture changed shape');
```

Modify `extension/src/background/__tests__/messages.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index 5034e4f..62b278c 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -209,7 +209,7 @@ describe('message partitions (B1b-1 types)', () => {
   // Listed literally, not read from PRIVILEGED: dropping a type from the list must make it
   // 'unknown type' here, which fails, rather than silently shrinking the test.
   const ALL = [
-    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'vault.removePasskey', 'vault.phraseVerified', 'activity.ping',
+    'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'vault.removePasskey', 'vault.phraseVerified', 'vault.forgetDamaged', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
     'contacts.list', 'contacts.set', 'contacts.remove',
```

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index b32f897..f5e8141 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -1780,15 +1780,19 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
     // and views — a module added or removed there is named here too, and each named one must be reached.
     const named = ['welcome', 'seed', 'confirm', 'password', 'passkey', 'createRun', 'importScreen', 'importRun', 'restoreRun', 'retryRun', 'forgot', 'unlock', 'reauth', 'accounts', 'reveal',
       // B1b-2b plan 1.
-      'changePassword', 'delete', 'passkeyManage'];
+      'changePassword', 'delete', 'passkeyManage',
+      // B1e-1: the damaged states and their removal.
+      'damaged', 'removeDamaged'];
     expect([...screens].sort()).toEqual(named.map(n => `src/unlock/screens/${n}.ts`).sort());
-    expect([...views].sort()).toEqual(['dom', 'words', 'hold', 'meter', 'cooldown'].map(n => `src/unlock/view/${n}.ts`).sort());
+    expect([...views].sort()).toEqual(['dom', 'words', 'hold', 'meter', 'cooldown', 'deleteConfirm', 'saveDamaged'].map(n => `src/unlock/view/${n}.ts`).sort());
     expect(resolved).toEqual(
       expect.arrayContaining([
         ...screens,
         ...views,
         'src/unlock/strings.ts',
         'src/unlock/forgetFlow.ts',
+        'src/unlock/damagedFlow.ts',
+        'src/shared/storedDigest.ts',
         'src/unlock/challenge.ts',
         'src/unlock/stored.ts',
         'src/unlock/page.ts',
```

Modify `extension/src/unlock/__tests__/unlockScreen.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/unlockScreen.test.ts b/extension/src/unlock/__tests__/unlockScreen.test.ts
index cd81fbc..3d1621a 100644
--- a/extension/src/unlock/__tests__/unlockScreen.test.ts
+++ b/extension/src/unlock/__tests__/unlockScreen.test.ts
@@ -180,7 +180,11 @@ describe('#9 unlock (spec §3.9)', () => {
     await mountUnlock(h.deps).show(null);
     // No attempt ran, so nothing could be charged: no wait of any kind was asked for (the mid-run case is below).
     expect(asked).toEqual([]);
-    expect(text(el('unl-notice'))).toBe("This wallet's stored data is damaged. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.");
+    // B1e §2.2: a stored null is unreadable (U1) — the damaged screen, with its removal.
+    expect(visible(el('v-damaged'))).toBe(true);
+    expect(visible(el('dmg-unreadable'))).toBe(true);
+    expect(visible(el('dmg-remove'))).toBe(true);
+    expect(visible(el('v-unlock'))).toBe(false);
     expect(visible(el('unl-entry'))).toBe(false);
     expect(visible(el('unl-forgot'))).toBe(false);
     expect(h.sent).toEqual([]);
@@ -258,8 +262,8 @@ describe('#9 unlock: what the brief left implicit (carried rules)', () => {
     const h = await shown(await withPasskey(PRF), {credentials: prfCredentials(PRF)});
     await h.ext.local.set(VAULT_KEY, null);
     click(el('unl-passkey'));
-    await h.until(() => visible(el('unl-notice')));
-    expect(text(el('unl-notice-line'))).toBe("This wallet's stored data is damaged.");
+    // B1e §2.2: the attempt's `damaged` reads again — a null is unreadable.
+    await h.until(() => visible(el('dmg-unreadable')));
     expect(h.sent).toEqual([]);
     expect(prfOutputs).toHaveLength(1);
     expect(prfOutputs.every(o => o.every(b => b === 0))).toBe(true);
@@ -286,7 +290,9 @@ describe('#9 unlock: what the brief left implicit (carried rules)', () => {
     const env = await withPasskey(PRF);
     await shown({...env, accounts: []});
     expect(visible(el('unl-passkey'))).toBe(false);
-    expect(text(el('unl-notice-line'))).toBe("This wallet's stored data is damaged.");
+    // B1e §2.2: no accounts is policy — refused by this version, and never removable.
+    expect(visible(el('dmg-refused'))).toBe(true);
+    expect(visible(el('dmg-remove'))).toBe(false);
   });
 
   it('cooldown: the ring is set only as a number; the countdown is announced once (polite), not every second', async () => {
@@ -317,7 +323,7 @@ describe('#9 unlock: what the brief left implicit (carried rules)', () => {
   // Review fix round 1, item 2: observed, not inferred — every wait the screen asks for is recorded. After one wrong
   // the streak is 1; had a damaged (or vanished) vault been charged, it would be 2 and a 1 s backoff wait would follow.
   it.each([
-    ['damaged', null, "This wallet's stored data is damaged."],
+    ['damaged', null, null],
     ['no-wallet', undefined, 'No wallet on this browser yet.'],
   ] as const)('a vault %s during the run is named, never charged to the backoff (no wait after it, even after a wrong)', async (_kind, stored, line) => {
     const h = await harness({vault: await wallet()});
@@ -330,8 +336,9 @@ describe('#9 unlock: what the brief left implicit (carried rules)', () => {
     if (stored === undefined) await h.ext.local.remove(VAULT_KEY);
     else await h.ext.local.set(VAULT_KEY, stored);
     submit(PW);
-    await h.until(() => visible(el('unl-notice')) && !h.deps.gate.isBusy());
-    expect(text(el('unl-notice-line'))).toBe(line);
+    // B1e §2.2: a stored null (unreadable) is the damaged screen; a vanished vault the notice.
+    await h.until(() => (line === null ? visible(el('dmg-unreadable')) : visible(el('unl-notice'))) && !h.deps.gate.isBusy());
+    if (line !== null) expect(text(el('unl-notice-line'))).toBe(line);
     // Only the second click's floor: no backoff wait was asked for.
     expect(asked).toEqual([500, 500]);
     expect(visible(el('unl-cooldown'))).toBe(false);
```

Modify `extension/src/unlock/__tests__/welcome.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/welcome.test.ts b/extension/src/unlock/__tests__/welcome.test.ts
index bad4128..c900ea4 100644
--- a/extension/src/unlock/__tests__/welcome.test.ts
+++ b/extension/src/unlock/__tests__/welcome.test.ts
@@ -67,8 +67,10 @@ describe('#1 welcome (spec §3.1)', () => {
     await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
     expect(visible(el('wel-terms'))).toBe(false);
     expect(visible(el('wel-actions'))).toBe(false);
-    expect(text(el('wel-notice-line'))).toBe("This wallet's stored data is damaged.");
-    expect(text(el('wel-notice-help'))).toBe('Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.');
+    // B1e §2.2: a stored null is unreadable (U1) — the damaged screen, never the welcome's CTAs.
+    expect(visible(el('v-damaged'))).toBe(true);
+    expect(visible(el('v-welcome'))).toBe(false);
+    expect(visible(el('dmg-unreadable'))).toBe(true);
     expect(h.sent).toEqual([]);
   });
 
```

- [ ] **Step 2: Run — red.**

Run (in `extension/`): `npx vitest run src/background/__tests__/forgetDamaged.test.ts src/shared/__tests__/storedDigest.test.ts src/unlock/__tests__/damagedFlow.test.ts src/unlock/__tests__/damagedScreens.test.ts src/unlock/__tests__/unlockScreen.test.ts src/unlock/__tests__/welcome.test.ts src/background/__tests__/messages.test.ts scripts/__tests__/check-vault-isolation.test.mjs`

Expected (observed on Task 1's tree with only these test files changed): `Test Files  8 failed (8)` · `Tests  77 failed | 478 passed (555)` — `storedDigest.test.ts`, `damagedFlow.test.ts` and `damagedScreens.test.ts` do not load (`Cannot find module '../storedDigest'`, `Cannot find module '../damagedFlow'`, `Failed to resolve import "../screens/damaged"`); `forgetDamaged.test.ts` 70 of 70 (`TypeError: forgetDamaged is not a function`, and the message rows `{ ok: false, error: 'unknown type' }`; rev 1's Review Focus 1 row, added at assembly, re-run alone on Task 1's tree: `Tests  70 failed (70)`); `unlockScreen.test.ts` 4 of 29 and `welcome.test.ts` 1 of 6 (`Error: no #v-damaged`, `Error: no #dmg-unreadable`: the damaged rows now expect the new states); `messages.test.ts` 1 of 29 (“every privileged type is refused from a web page and from another extension”: `vault.forgetDamaged` is `unknown type`); `check-vault-isolation.test.mjs` 1 of 421 (“main.ts → modes.ts → each screen, its views, strings, the E5 and E3 halves”: the new screens and views are not on disk). `npx tsc --noEmit` on that tree fails on the missing modules — expected.

- [ ] **Step 3: Implement.**

Create `extension/src/shared/storedDigest.ts`:

```ts
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, utf8ToBytes} from '@noble/hashes/utils.js';

/**
 * B1e §2.3, §2.4: the text of a stored v1_vault value — JSON.stringify of the value storage.local hands back, keys in
 * their stored order — which "Save the damaged data" downloads and the damaged-vault removal's digest hashes.
 * `undefined` (no wallet) has no text and throws: it is never damaged.
 */
export function storedText(raw: unknown): string {
  const text: unknown = JSON.stringify(raw);
  if (typeof text !== 'string') throw new TypeError('storedText: the value has no JSON text');
  return text;
}

/** sha256, lowercase hex, of the UTF-8 bytes of storedText(raw): the token a damaged-vault removal is bound to (§2.4). */
export function storedDigest(raw: unknown): string {
  return bytesToHex(sha256(utf8ToBytes(storedText(raw))));
}
```

Modify `extension/src/background/accountsStore.ts`:

```diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index 143a102..564cd90 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -17,6 +17,7 @@ import {PRESALE_RECORDS_KEY, wipePresaleRecords} from './presaleRecordsKey';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, accountsPolicyOk, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
 import {unreadableV1} from '../shared/unreadable';
+import {storedDigest} from '../shared/storedDigest';
 import {readWalletBalances} from '../../../core/solana/balances';
 import {RpcForbidden} from '../../../core/solana/rpc';
 
@@ -553,3 +554,62 @@ export async function forgetWallet(
     return 'forgotten';
   });
 }
+
+export type ForgetDamagedResult = 'forgotten' | 'malformed' | 'no-wallet' | 'not-unreadable' | 'busy' | 'send-open' | 'unlocked';
+
+/**
+ * vault.forgetDamaged (B1e §2.4, C2, E12): the one removal of v1_vault without a password — only of a value the frozen
+ * predicate calls unreadable (src/shared/unreadable.ts), which no version of Noctura can open. The vault page sends the
+ * digest of the value it showed (src/shared/storedDigest.ts); the background judges again on its own reads, in E5's
+ * order (forgetWallet's), inside `serial`:
+ *  1. `expectedDigest` not 64 lowercase hex → `malformed`;
+ *  2. read v1_vault: absent → `no-wallet`; not unreadable → `not-unreadable` (a vault refused by this version and a
+ *     wallet both land here); another digest → `busy`;
+ *  3. lock;
+ *  4. check-and-clear v1_pending in ONE updatePending: an open record → `send-open` (nothing removed, left locked);
+ *  5. read again: still unreadable with the same digest, else `busy`;
+ *  6. under sessionMutex: a session back since step 3 → `unlocked`; otherwise v1_vault is removed;
+ *  7. best effort, never undoing step 6: the wallet's data (WALLET_DATA_KEYS) and the caches.
+ * The predicate is the safety; the digest only narrows it to the value the user saw.
+ */
+export async function forgetDamaged(ext: Ext, req: {expectedDigest: unknown}): Promise<ForgetDamagedResult> {
+  const {expectedDigest} = req;
+  if (!isStr(expectedDigest) || !REVISION.test(expectedDigest)) return 'malformed';
+  return serial(async (): Promise<ForgetDamagedResult> => {
+    // 2.
+    const stored = await ext.local.get(VAULT_KEY);
+    if (stored === undefined) return 'no-wallet';
+    if (vaultReading(stored).kind !== 'unreadable') return 'not-unreadable';
+    if (storedDigest(stored) !== expectedDigest) return 'busy';
+    // 3.
+    await lock(ext);
+    // 4.
+    try {
+      await updatePending(ext, records => {
+        if (records.some(isOpen)) throw new SendOpen();
+        return [];
+      });
+    } catch (e) {
+      if (e instanceof SendOpen) return 'send-open';
+      throw e;
+    }
+    // 5 + 6. The reading's clause is implied by the digest's (the same digest is the same text, so the same verdict as
+    // step 2): belt and braces, not a check of its own — the digest compare is the one M-digest proves.
+    const again = await ext.local.get(VAULT_KEY);
+    if (again === undefined || vaultReading(again).kind !== 'unreadable' || storedDigest(again) !== expectedDigest) return 'busy';
+    const removed = await sessionMutex(async () => {
+      if ((await getSession(ext)) !== null) return false;
+      await ext.local.remove(VAULT_KEY);
+      return true;
+    });
+    if (!removed) return 'unlocked';
+    // 7.
+    try {
+      await removeWalletData(ext);
+      await clearCaches(ext);
+    } catch (e) {
+      console.warn('forgetDamaged: cleanup after the vault removal failed; the next first write clears it', e);
+    }
+    return 'forgotten';
+  });
+}
```

Modify `extension/src/background/messages.ts`:

```diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index f5543bc..068cda7 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -7,7 +7,7 @@ import {armAutolock, lock} from './autolock';
 import {readSettings, settingsMutex, writeSettings} from './settings';
 import type {WalletDeps} from './deps';
 import {CHALLENGE_ID, challengeInfo, satisfyChallenge} from './reauthChallenges';
-import {VAULT_KEY, changePassword, forgetWallet, provenRevisionIsStored, removePasskey, storeEnvelope, vaultReading} from './accountsStore';
+import {VAULT_KEY, changePassword, forgetDamaged, forgetWallet, provenRevisionIsStored, removePasskey, storeEnvelope, vaultReading} from './accountsStore';
 import {isOpen, readPending} from './pendingStore';
 import {startPoller} from './pending';
 import {WALLET_TYPES, applySettingsChallenge, handleWallet, isWalletType, type Result} from './walletApi';
@@ -49,6 +49,7 @@ export const PRIVILEGED = [
   'vault.changePassword',
   'vault.removePasskey',
   'vault.phraseVerified',
+  'vault.forgetDamaged',
   'activity.ping',
   ...WALLET_TYPES,
   // B1c §1.4: the approval window's two, and #49's.
@@ -70,8 +71,8 @@ export const PRIVILEGED = [
  * the envelope it re-encrypted (the background is the one writer of v1_vault), or read what a
  * re-authentication is for (vault.challengeInfo, B1b-2a E3), or forget the wallet it proved
  * (vault.forgetWallet, E5), change the password it proved (vault.changePassword, B1b-2b E10) or remove the passkey
- * (vault.removePasskey, E12), or record that the phrase was verified (vault.phraseVerified, E15): the popup and the
- * tab cannot.
+ * (vault.removePasskey, E12), or record that the phrase was verified (vault.phraseVerified, E15), or remove a vault no
+ * version can read (vault.forgetDamaged, B1e §2.4): the popup and the tab cannot.
  */
 const VAULT_PAGE_ONLY: readonly string[] = [
   'vault.setKeys',
@@ -82,6 +83,7 @@ const VAULT_PAGE_ONLY: readonly string[] = [
   'vault.changePassword',
   'vault.removePasskey',
   'vault.phraseVerified',
+  'vault.forgetDamaged',
 ];
 /** B1c §1.4: the approval window's messages come from approve.html only (sender.origin ours, the path /approve.html). */
 const APPROVE_PAGE_ONLY: readonly string[] = ['dapp.pending', 'dapp.decide'];
@@ -268,6 +270,25 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       }
       return {ok: true};
     }
+    case 'vault.forgetDamaged': {
+      if (deps === undefined) return {ok: false, error: 'unavailable'};
+      let r: Awaited<ReturnType<typeof forgetDamaged>>;
+      try {
+        r = await forgetDamaged(ext, {expectedDigest: (msg as {expectedDigest?: unknown}).expectedDigest});
+      } catch {
+        // A storage failure: the steps before the removal leave the value in place (locked at most).
+        return {ok: false, error: 'failed'};
+      }
+      if (r !== 'forgotten') return {ok: false, error: r};
+      // As vault.forgetWallet: a send that passed its session check before the lock may have appended a record after
+      // the clear — it is kept, and watched without keys.
+      try {
+        if ((await readPending(ext)).some(isOpen)) void startPoller(ext, deps);
+      } catch (e) {
+        console.warn('vault.forgetDamaged: forgotten, but the pending check after it failed', e);
+      }
+      return {ok: true};
+    }
     case 'vault.changePassword': {
       if (deps === undefined) return {ok: false, error: 'unavailable'};
       const {expectedRevision, envelope} = msg as {expectedRevision?: unknown; envelope?: unknown};
```

Create `extension/src/unlock/damagedFlow.ts`:

```ts
import {storedDigest} from '../shared/storedDigest';
import {vaultReading} from './stored';
import type {Send} from './types';

/**
 * The removal's outcome as the screen names it: `changed` is the page's own compare failing (the value stored now is not
 * the one shown — nothing is sent) and the background's `busy` (it changed between the click and the removal).
 */
export type RemoveDamagedOutcome = 'removed' | 'changed' | 'not-unreadable' | 'no-wallet' | 'send-open' | 'unlocked' | 'failed';
const NAMED: readonly RemoveDamagedOutcome[] = ['not-unreadable', 'no-wallet', 'send-open', 'unlocked'];

/**
 * The vault page's half of vault.forgetDamaged (B1e §2.4) and its one builder of the message. Only the removal screen
 * (screens/removeDamaged.ts) imports this module — a source test holds it there. At the click it reads v1_vault again
 * and sends only when the value stored now is still unreadable on this page's reading AND has the digest the screen
 * showed (`shownDigest`); otherwise nothing is sent. The page's judgement never decides: the background re-reads and
 * re-judges with the frozen predicate before it removes anything.
 */
export async function removeDamaged(deps: {send: Send; readEnvelope(): Promise<unknown>}, shownDigest: string): Promise<RemoveDamagedOutcome> {
  let raw: unknown;
  try {
    raw = await deps.readEnvelope();
  } catch {
    return 'failed';
  }
  if (raw === undefined) return 'no-wallet';
  if (vaultReading(raw).kind !== 'unreadable') return 'not-unreadable';
  if (storedDigest(raw) !== shownDigest) return 'changed';
  try {
    const r = await deps.send({type: 'vault.forgetDamaged', expectedDigest: shownDigest});
    if (r.ok) return 'removed';
    if (r.error === 'busy') return 'changed';
    return NAMED.find(n => n === r.error) ?? 'failed';
  } catch {
    return 'failed';
  }
}
```

Create `extension/src/unlock/view/saveDamaged.ts`:

```ts
import {storedDigest, storedText} from '../../shared/storedDigest';

/**
 * B1e §2.3 (E10, R4): "Save the damaged data" — an `<a download>` whose data: URL carries exactly the text the digest
 * hashes (storedText: JSON.stringify of the value as read), so a saved file can be checked against a reported digest.
 * application/json — never an HTML type, and no object URL (the vault-isolation gate refuses both on this page); <a
 * download> needs no permission. Returns the digest of that value.
 */
export function fillSaveLink(link: HTMLAnchorElement, raw: unknown): string {
  const digest = storedDigest(raw);
  link.download = `noctura-damaged-wallet-${digest.slice(0, 8)}.json`;
  link.href = `data:application/json;charset=utf-8,${encodeURIComponent(storedText(raw))}`;
  return digest;
}
```

Create `extension/src/unlock/view/deleteConfirm.ts`:

```ts
import type {Timers} from '../page';
import {TYPED_DELETE} from '../strings';
import {h, setText, shown} from './dom';

/** #37's word and hold (DeleteWallet.tsx WORD, HOLD_MS; HoldButton.tsx HOLD_TICK_MS). */
export const CONFIRM_WORD = 'DELETE';
export const HOLD_MS = 1_000;
export const HOLD_TICK_MS = 30;

/** The elements of one typed-word-and-hold confirmation in unlock.html. */
export interface ConfirmParts {
  field: HTMLInputElement;
  /** The "Type DELETE to confirm" eyebrow, and the "Confirmation matched" one that replaces it. */
  eyebrow: HTMLElement;
  matched: HTMLElement;
  box: HTMLElement;
  check: HTMLElement;
  help: HTMLElement;
  caption: HTMLElement;
  button: HTMLButtonElement;
  fill: HTMLElement;
  count: HTMLElement;
}

export interface DeleteConfirm {
  /** Every entry to the screen: the word emptied, a hold in progress ended, the confirmation armed again. */
  reset(): void;
  /** Re-reads `allowed()` and the word: a refused press ends a hold in progress. */
  render(): void;
}

/** The fill's share as the `--vlt-hold` value: always a number from 0 to 1 (the vault-isolation gate's rule, cooldown.ts). */
function holdShare(share: number): string {
  return String(Math.min(1, Math.max(0, share)));
}

/**
 * #37's two gates of friction (B1b-2b §5, D9) in plain DOM for the vault page (B1e §2.2, E11): DELETE typed exactly
 * (case-sensitive), then the button held for HOLD_MS — the pointer's primary button, or Space / Enter held on the focused
 * button (repeats ignored); pointer up, leave or cancel, keyup and blur release it, and a release before HOLD_MS confirms
 * nothing. Enter in the field activates nothing. `onConfirmed` runs once per completed hold, and never again until
 * `reset()`. `allowed()` is the screen's own phase and the page's gate: while it is false the button refuses a press.
 * B1e §3's checkbox path (Task 3) joins here, beside the hold.
 */
export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allowed(): boolean; onConfirmed(): void; onPressing?(pressing: boolean): void}): DeleteConfirm {
  let stop: (() => void) | null = null;
  let done = false;
  /** The press in progress (0: none); a tick of a press that already ended completes nothing (HoldButton's M4). */
  let pressId = 0;
  let presses = 0;

  const matched = () => parts.field.value === CONFIRM_WORD;
  const paintHold = (share: number | null) => {
    parts.fill.style.setProperty('--vlt-hold', holdShare(share ?? 0));
    const left = share === null ? null : Math.max(0, HOLD_MS - share * HOLD_MS) / 1000;
    parts.count.replaceChildren(...(left === null ? [] : [document.createTextNode(' · '), h('span', 'noc-numeral', `${left.toFixed(1)} s`)]));
  };
  const release = () => {
    pressId = 0;
    if (stop === null) return;
    stop();
    stop = null;
    paintHold(null);
    o.onPressing?.(false);
  };
  const render = () => {
    const typed = parts.field.value;
    const ok = matched();
    const partial = typed !== '' && !ok;
    shown(parts.eyebrow, !ok);
    shown(parts.matched, ok);
    shown(parts.check, ok);
    parts.box.classList.toggle('vlt-pw-ok', ok);
    parts.box.classList.toggle('vlt-pw-active', partial);
    shown(parts.caption, ok);
    if (typed === '') {
      setText(parts.help, TYPED_DELETE.caseSensitive);
      parts.help.classList.remove('vlt-danger');
    } else if (partial && CONFIRM_WORD.startsWith(typed)) {
      parts.help.replaceChildren(...TYPED_DELETE.keepGoing(typed.length).map((p, i) => (i === 0 || i === 2 ? h('span', 'noc-numeral', p) : document.createTextNode(p))));
      parts.help.classList.remove('vlt-danger');
    } else if (partial) {
      setText(parts.help, TYPED_DELETE.notAPrefix);
      parts.help.classList.add('vlt-danger');
    }
    shown(parts.help, !ok);
    const armed = ok && !done && o.allowed();
    if (!armed && stop !== null) release();
    parts.button.disabled = !armed;
  };
  const press = () => {
    if (!matched() || done || stop !== null || !o.allowed()) return;
    const started = timers.now();
    presses += 1;
    const id = presses;
    pressId = id;
    paintHold(0);
    o.onPressing?.(true);
    const interval = timers.setInterval(() => {
      if (pressId !== id) return;
      const held = timers.now() - started;
      if (held < HOLD_MS) return paintHold(held / HOLD_MS);
      pressId = 0;
      stop?.();
      stop = null;
      done = true;
      paintHold(1);
      o.onPressing?.(false);
      render();
      o.onConfirmed();
    }, HOLD_TICK_MS);
    stop = () => timers.clearInterval(interval);
  };

  parts.field.addEventListener('input', render);
  parts.button.addEventListener('pointerdown', e => {
    if (e.button === 0) press();
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur'] as const) parts.button.addEventListener(ev, release);
  parts.button.addEventListener('keydown', e => {
    if (e.key !== ' ' && e.key !== 'Enter') return;
    e.preventDefault();
    if (!e.repeat) press();
  });
  parts.button.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') release();
  });
  parts.button.addEventListener('contextmenu', e => e.preventDefault());

  return {
    reset() {
      release();
      done = false;
      parts.field.value = '';
      render();
    },
    render,
  };
}
```

Create `extension/src/unlock/screens/damaged.ts`:

```ts
import {exclusive, type PageDeps} from '../page';
import {COMMON} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {fillSaveLink} from '../view/saveDamaged';

export type DamagedKind = 'unreadable' | 'refused';

export interface DamagedScreen {
  /** Shows the state the page read (`raw`: the value it read, which "Save the damaged data" carries). */
  show(kind: DamagedKind, raw: unknown): void;
}

/**
 * B1e §2.2 (E9, R4): the two damaged states, shown by #9 and #1 from their own read of v1_vault (stored.ts vaultReading).
 * `unreadable` (the frozen predicate: no version of Noctura can read it): "Save the damaged data" and "Remove damaged
 * wallet" → the removal screen, which reads and judges again. `refused` (this version's policy refuses it): "update the
 * extension", "Save the damaged data", and no removal at all — the button is hidden and its listener acts only while the
 * state shown is `unreadable`.
 */
export function mountDamaged(deps: PageDeps): DamagedScreen {
  const remove = byId<HTMLButtonElement>('dmg-remove');
  let kind: DamagedKind | null = null;
  const render = () => {
    remove.disabled = kind !== 'unreadable' || deps.gate.isBusy();
  };
  deps.gate.onIdle(render);
  setText(byId('dmg-help'), COMMON.damagedHelp);
  remove.addEventListener('click', () => {
    if (kind === 'unreadable') void exclusive(deps, render, async () => deps.go('unlock.html?mode=remove-damaged'));
  });
  return {
    show(next, raw) {
      kind = next;
      fillSaveLink(byId<HTMLAnchorElement>('dmg-save'), raw);
      for (const id of ['dmg-unreadable', 'dmg-unreadable-body']) shown(byId(id), next === 'unreadable');
      for (const id of ['dmg-refused', 'dmg-refused-body']) shown(byId(id), next === 'refused');
      shown(remove, next === 'unreadable');
      render();
      showScreen('v-damaged');
    },
  };
}
```

Create `extension/src/unlock/screens/removeDamaged.ts`:

```ts
import {removeDamaged} from '../damagedFlow';
import {exclusive, type PageDeps} from '../page';
import {vaultReading} from '../stored';
import {COMMON, DAMAGED, DELETE, RESTORE, WELCOME} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {mountDeleteConfirm} from '../view/deleteConfirm';
import {fillSaveLink} from '../view/saveDamaged';
import {addressGroups} from '../view/words';
import type {DamagedScreen} from './damaged';

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * B1e §2.2 (Minor 5): the address the removal screen names — among the `accounts` entries that are objects with a safe
 * integer `index` ≥ 0 and a `publicKey` of the address shape, the one with the LOWEST index; null when there is none.
 * Never `accounts[0]`, and nothing else of the value is shown.
 */
export function readableAddress(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const accounts = (raw as {accounts?: unknown}).accounts;
  if (!Array.isArray(accounts)) return null;
  let low: {index: number; publicKey: string} | null = null;
  for (const a of accounts as unknown[]) {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) continue;
    const {index, publicKey} = a as {index?: unknown; publicKey?: unknown};
    if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0 || typeof publicKey !== 'string' || !ADDRESS.test(publicKey)) continue;
    if (low === null || index < low.index) low = {index, publicKey};
  }
  return low?.publicKey ?? null;
}

type View = 'loading' | 'entry' | 'notice';
type Action = 'again' | 'setup' | 'close';

/**
 * B1e §2.2, §2.4 (E9, E11, E12): `unlock.html?mode=remove-damaged`, the one screen that removes a wallet without its
 * password — and only a value the frozen predicate calls unreadable. It reads v1_vault itself and shows what it finds:
 * unreadable → the lines, the address (readableAddress), "Save the damaged data" (the value's exact text) and #37's typed
 * DELETE + hold (view/deleteConfirm.ts); refused by this version → the refused state (no removal); a wallet → "A wallet
 * already exists", nothing offered; no wallet → set up. The confirmation hands over to damagedFlow's removeDamaged, which
 * reads again and sends only for the value shown (its digest); the background re-judges. Removed → #1, as #37.
 */
export function mountRemoveDamaged(deps: PageDeps, damaged: DamagedScreen): {show(): Promise<void>} {
  const helperEl = byId('rd-helper');
  const cancel = byId<HTMLButtonElement>('rd-cancel');
  const x = byId<HTMLButtonElement>('rd-x');
  const buttons = {again: byId<HTMLButtonElement>('rd-again'), setup: byId<HTMLButtonElement>('rd-setup'), close: byId<HTMLButtonElement>('rd-close')};
  let view: View = 'loading';
  let actions: readonly Action[] = [];
  /** The digest of the value on screen: the only value a removal may name. */
  let shownDigest: string | null = null;

  const confirm = mountDeleteConfirm(
    {
      field: byId<HTMLInputElement>('rd-word'),
      eyebrow: byId('rd-eyebrow'),
      matched: byId('rd-matched'),
      box: byId('rd-box'),
      check: byId('rd-check'),
      help: byId('rd-help'),
      caption: byId('rd-caption'),
      button: byId<HTMLButtonElement>('rd-hold'),
      fill: byId('rd-fill'),
      count: byId('rd-count'),
    },
    deps.timers,
    {
      allowed: () => view === 'entry' && !deps.gate.isBusy(),
      // A confirmation the gate refuses (another action holds it) removes nothing, and is asked for again.
      onConfirmed: () =>
        void exclusive(deps, render, removeShown).then(r => {
          if (r === 'busy') confirm.reset();
        }),
      onPressing: pressing => {
        cancel.disabled = pressing;
        x.disabled = pressing;
      },
    },
  );

  function render(): void {
    const busy = deps.gate.isBusy();
    const entry = view === 'entry';
    shown(byId('rd-entry'), entry);
    shown(byId('rd-hold'), entry);
    shown(byId('rd-notice'), view === 'notice');
    byId<HTMLInputElement>('rd-word').disabled = busy || !entry;
    for (const [name, b] of Object.entries(buttons)) {
      shown(b, view === 'notice' && actions.includes(name as Action));
      b.disabled = busy;
    }
    // A notice with its own way out ([Close this tab], [Start again], [Set up a wallet]) drops the bar's Cancel, as #37's.
    shown(cancel, view !== 'notice' || actions.length === 0);
    cancel.disabled = busy;
    x.disabled = busy;
    confirm.render();
  }
  const helper = (text: string) => setText(helperEl, text);
  const notice = (line: string, help: string, next: readonly Action[]) => {
    view = 'notice';
    actions = next;
    shownDigest = null;
    setText(byId('rd-notice-line'), line);
    setText(byId('rd-notice-help'), help);
    shown(byId('rd-notice-help'), help !== '');
    render();
  };
  /** Reads what is stored now and shows it; true when the removal is offered. */
  const load = async (): Promise<boolean> => {
    view = 'loading';
    actions = [];
    shownDigest = null;
    helper('');
    confirm.reset();
    showScreen('v-remove-damaged');
    render();
    let raw: unknown;
    try {
      raw = await deps.store.readEnvelope();
    } catch {
      notice(COMMON.unreadable, '', []);
      return false;
    }
    const reading = vaultReading(raw);
    if (reading.kind === 'none') {
      notice(COMMON.noWallet, '', ['setup']);
      return false;
    }
    if (reading.kind === 'wallet') {
      notice(COMMON.exists, WELCOME.useIt, ['close']);
      return false;
    }
    if (reading.kind === 'refused') {
      damaged.show('refused', raw);
      return false;
    }
    shownDigest = fillSaveLink(byId<HTMLAnchorElement>('rd-save'), raw);
    const address = readableAddress(raw);
    shown(byId('rd-address'), address !== null);
    shown(byId('rd-no-address'), address === null);
    byId('rd-address').replaceChildren(...(address === null ? [] : [addressGroups(address)]));
    setText(byId('rd-no-address'), DAMAGED.noAddress);
    view = 'entry';
    render();
    return true;
  };
  async function removeShown(): Promise<void> {
    const digest = shownDigest;
    if (view !== 'entry' || digest === null) return;
    const out = await removeDamaged({send: deps.send, readEnvelope: deps.store.readEnvelope}, digest);
    if (out === 'removed') return deps.go('unlock.html?mode=welcome');
    if (out === 'changed') {
      if (await load()) helper(DAMAGED.changed);
      return;
    }
    if (out === 'not-unreadable') {
      await load();
      return;
    }
    if (out === 'no-wallet') return notice(COMMON.noWallet, '', ['setup']);
    if (out === 'send-open') return notice(RESTORE.sendOpen, '', ['again', 'close']);
    if (out === 'unlocked') return notice(DAMAGED.unlocked, '', ['again', 'close']);
    confirm.reset();
    helper(DELETE.failed);
  }

  deps.gate.onIdle(render);
  const closing = () => void exclusive(deps, render, async () => deps.closeTab());
  cancel.addEventListener('click', closing);
  x.addEventListener('click', closing);
  buttons.again.addEventListener('click', () => {
    if (view === 'notice' && actions.includes('again')) void exclusive(deps, render, load);
  });
  buttons.setup.addEventListener('click', () => {
    if (view === 'notice' && actions.includes('setup')) void exclusive(deps, render, async () => deps.go('unlock.html?mode=welcome'));
  });
  buttons.close.addEventListener('click', () => {
    if (view === 'notice' && actions.includes('close')) void exclusive(deps, render, async () => deps.closeTab());
  });

  return {
    async show() {
      await load();
    },
  };
}
```

Modify `extension/src/unlock/screens/unlock.ts`:

```diff
diff --git a/extension/src/unlock/screens/unlock.ts b/extension/src/unlock/screens/unlock.ts
index 66b97c7..de59564 100644
--- a/extension/src/unlock/screens/unlock.ts
+++ b/extension/src/unlock/screens/unlock.ts
@@ -4,11 +4,12 @@ import type {EnvelopeV1} from '../../vault/envelope';
 import type {ReturnTo} from '../mode';
 import {attemptPasskeyUnlock, attemptUnlock, createWrongBackoff, type Outcome} from '../orchestrate';
 import {CLOSE_CHECK_MS, exclusive, type PageDeps} from '../page';
-import {passkeyOf, storedVault} from '../stored';
+import {passkeyOf, vaultReading} from '../stored';
 import {COMMON, UNLOCK, cooldownLabel} from '../strings';
 import {unlockFlow} from '../unlockFlow';
 import {byId, closeOrHide, setText, showScreen, shown} from '../view/dom';
 import {startCooldown} from '../view/cooldown';
+import {mountDamaged} from './damaged';
 
 export interface UnlockScreen {
   show(returnTo: ReturnTo | null): Promise<void>;
@@ -29,7 +30,10 @@ type Phase = 'off' | 'reading' | 'entry' | 'unlocked' | 'no-wallet' | 'damaged'
  * no counter, no wipe), shown as the design's cooldown card. "Forgot password?" → #39. With
  * `&return=created|imported` a successful unlock goes straight on to that UI-tab route (#7, #40).
  * The page reads what is stored first: no wallet → "No wallet on this browser yet." + [Set up a wallet];
- * a damaged vault → the damaged line, never the password field (and never charged to the backoff).
+ * a damaged vault → B1e §2.2's state (screens/damaged.ts: unreadable, or refused by this version), never the password
+ * field (and never charged to the backoff). An attempt that ends `damaged` reads again: a value that now reads as one of
+ * the two states shows it; a wallet whose seed then failed to open (B1e §2.1, out of the predicate) keeps the damaged
+ * notice and its help.
  *
  * The password: taken out of the field at the click and handed to the attempt in the same turn, so the
  * screen holds no copy while Argon2id runs or the cooldown counts down; a hidden tab or `pagehide` empties
@@ -49,6 +53,7 @@ export function mountUnlock(deps: PageDeps): UnlockScreen {
   const close = byId<HTMLButtonElement>('unl-close');
   const live = byId('unl-cooldown-live');
   const backoff = createWrongBackoff(deps.sleep);
+  const damaged = mountDamaged(deps);
   let returnTo: ReturnTo | null = null;
   let pk: NonNullable<EnvelopeV1['passkey']> | null = null;
   let phase: Phase = 'off';
@@ -112,7 +117,7 @@ export function mountUnlock(deps: PageDeps): UnlockScreen {
     setText(live, cooldownLabel(Math.ceil(ms / 1000)));
     render();
   };
-  const settle = (out: Outcome | 'unavailable') => {
+  const settle = async (out: Outcome | 'unavailable'): Promise<void> => {
     endCooldown();
     if (out === 'unlocked') {
       if (returnTo !== null) {
@@ -125,12 +130,33 @@ export function mountUnlock(deps: PageDeps): UnlockScreen {
       notice('unlocked', UNLOCK.unlocked, UNLOCK.openIcon);
       return;
     }
-    if (out === 'damaged') return notice('damaged', COMMON.damaged, COMMON.damagedHelp);
+    if (out === 'damaged') return judgeDamaged();
     if (out === 'no-wallet') return notice('no-wallet', COMMON.noWallet, '');
     helper(out === 'wrong' ? UNLOCK.wrong : out === 'unavailable' ? UNLOCK.unavailable : UNLOCK.failed, out === 'wrong');
     render();
   };
   const open = () => phase === 'entry' && stopCooldown === null;
+  /** B1e §2.2: the two damaged states, from the page's own read; true when one is shown. */
+  const showDamaged = (raw: unknown): boolean => {
+    const reading = vaultReading(raw);
+    if (reading.kind !== 'unreadable' && reading.kind !== 'refused') return false;
+    phase = 'damaged';
+    field.value = '';
+    helper('', false);
+    render();
+    damaged.show(reading.kind, raw);
+    return true;
+  };
+  /** An attempt answered `damaged`: what is stored now decides which damaged screen says so. */
+  const judgeDamaged = async () => {
+    let raw: unknown;
+    try {
+      raw = await deps.store.readEnvelope();
+    } catch {
+      return notice('unreadable', COMMON.unreadable, '');
+    }
+    if (!showDamaged(raw)) notice('damaged', COMMON.damaged, COMMON.damagedHelp);
+  };
 
   const unlock = () => {
     if (!open() || field.value === '') return;
@@ -144,7 +170,7 @@ export function mountUnlock(deps: PageDeps): UnlockScreen {
         typed = null;
         return attemptUnlock({readEnvelope: deps.store.readEnvelope, send: deps.send, unlockFlow}, {password, kdf: deps.kdf});
       }, cooldown);
-      settle(out);
+      await settle(out);
     });
   };
   const unlockWithPasskey = () => {
@@ -164,7 +190,7 @@ export function mountUnlock(deps: PageDeps): UnlockScreen {
           }),
         cooldown,
       );
-      settle(out);
+      await settle(out);
     });
   };
 
@@ -241,9 +267,8 @@ export function mountUnlock(deps: PageDeps): UnlockScreen {
       } catch {
         return notice('unreadable', COMMON.unreadable, '');
       }
-      const stored = storedVault(raw);
-      if (stored.kind === 'none') return notice('no-wallet', COMMON.noWallet, '');
-      if (stored.kind === 'damaged') return notice('damaged', COMMON.damaged, COMMON.damagedHelp);
+      if (vaultReading(raw).kind === 'none') return notice('no-wallet', COMMON.noWallet, '');
+      if (showDamaged(raw)) return;
       pk = passkeyOf(raw) ?? null;
       phase = 'entry';
       render();
```

Modify `extension/src/unlock/screens/welcome.ts`:

```diff
diff --git a/extension/src/unlock/screens/welcome.ts b/extension/src/unlock/screens/welcome.ts
index bedc418..f5c346c 100644
--- a/extension/src/unlock/screens/welcome.ts
+++ b/extension/src/unlock/screens/welcome.ts
@@ -1,7 +1,8 @@
 import {exclusive, type PageDeps} from '../page';
-import {storedVault} from '../stored';
+import {vaultReading} from '../stored';
 import {COMMON, WELCOME} from '../strings';
 import {byId, setText, showScreen, shown} from '../view/dom';
+import {mountDamaged} from './damaged';
 
 /**
  * #1 welcome (spec §3.1): create or import. What is stored decides first — the page never offers to
@@ -9,8 +10,8 @@ import {byId, setText, showScreen, shown} from '../view/dom';
  *  - nothing stored → the terms line and the CTAs;
  *  - a wallet → `exists`: "A wallet already exists in this browser. Nothing was changed." + "Open the
  *    Noctura icon to use it." — no CTAs;
- *  - a damaged vault (null included: the background calls it stored-invalid) → the damaged line and
- *    what still holds, no CTAs; repairing it is #37's (B1b-2b);
+ *  - a damaged vault (null included: the background calls it stored-invalid) → B1e §2.2's state (screens/damaged.ts:
+ *    unreadable — removable — or refused by this version), no CTAs;
  *  - unreadable (the store itself throws) → COMMON.unreadable, no help line, no CTAs.
  *
  * Fix round 1 item 1 (spec §7.6, rule 6): Create and Import run through the page's one `exclusive()`
@@ -31,6 +32,7 @@ export interface WelcomeScreen {
 export function mountWelcome(deps: PageDeps, next: {create(): void; import(): void}): WelcomeScreen {
   const createBtn = byId<HTMLButtonElement>('wel-create');
   const importBtn = byId<HTMLButtonElement>('wel-import');
+  const damaged = mountDamaged(deps);
   // Fix round 1 item 3: whether the CTAs are offered this show() at all — a hidden parent stops a
   // real pointer click, but nothing stopped a bound listener from still running one; `offered` is the
   // real guard a test (and a stray event) can't bypass, independent of `hidden`/`disabled`.
@@ -86,13 +88,13 @@ export function mountWelcome(deps: PageDeps, next: {create(): void; import(): vo
         return;
       }
       if (mine !== seq) return;
-      const stored = storedVault(raw);
-      if (stored.kind === 'none') {
+      const reading = vaultReading(raw);
+      if (reading.kind === 'none') {
         offered = true;
         showCtas(true);
         render();
-      } else if (stored.kind === 'wallet') notice(COMMON.exists, WELCOME.useIt);
-      else notice(COMMON.damaged, COMMON.damagedHelp);
+      } else if (reading.kind === 'wallet') notice(COMMON.exists, WELCOME.useIt);
+      else damaged.show(reading.kind, raw);
     },
   };
 }
```

Modify `extension/src/unlock/mode.ts`, `extension/src/unlock/modes.ts`, `extension/src/unlock/page.ts`, `extension/src/unlock/view/dom.ts`:

```diff
diff --git a/extension/src/unlock/mode.ts b/extension/src/unlock/mode.ts
index 97499cb..847db49 100644
--- a/extension/src/unlock/mode.ts
+++ b/extension/src/unlock/mode.ts
@@ -25,7 +25,9 @@ export type PageMode =
   /** B1b-2b §1.2: #6 "manage" — add (or replace, C4) by password; remove by password or passkey (E12). */
   | {mode: 'passkey'; op: 'add' | 'remove'}
   /** B1b-2b §3.5: the verify check (unlocked session, password only, D23). `reveal` is the designed #3 (§3.4). */
-  | {mode: 'verify'};
+  | {mode: 'verify'}
+  /** B1e §2.2: the removal of a vault no version can read — the page reads and judges it itself; the URL names nothing. */
+  | {mode: 'remove-damaged'};
 
 const SOURCES: readonly string[] = ['forgot', 'retry'];
 /** The SLIP-0010 hardened limit (accountsFlow.MAX_ACCOUNT_INDEX; mode.ts imports nothing that holds a key). */
@@ -40,7 +42,7 @@ const RETURNS: readonly string[] = ['created', 'imported'];
 export function pageMode(search: string): PageMode {
   const p = new URLSearchParams(search);
   const m = p.get('mode');
-  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'reveal' || m === 'password' || m === 'delete' || m === 'verify') return {mode: m};
+  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'reveal' || m === 'password' || m === 'delete' || m === 'verify' || m === 'remove-damaged') return {mode: m};
   if (m === 'accounts') {
     if (p.get('op') !== 'remove') return {mode: 'accounts', op: 'add'};
     const raw = p.get('index') ?? '';
```

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index e9b12ff..e71a730 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -2,6 +2,7 @@ import type {PageMode} from './mode';
 import type {PageDeps} from './page';
 import {mountAccounts} from './screens/accounts';
 import {mountChangePassword} from './screens/changePassword';
+import {mountDamaged} from './screens/damaged';
 import {mountDelete} from './screens/delete';
 import {mountPasskeyManage} from './screens/passkeyManage';
 import {createCreateRun} from './screens/createRun';
@@ -9,6 +10,7 @@ import {mountForgot} from './screens/forgot';
 import {createImportRun} from './screens/importRun';
 import {mountPassword} from './screens/password';
 import {mountReauth} from './screens/reauth';
+import {mountRemoveDamaged} from './screens/removeDamaged';
 import {createRestoreRun} from './screens/restoreRun';
 import {createRetryRun} from './screens/retryRun';
 import {mountPhrase} from './screens/reveal';
@@ -65,6 +67,9 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
     case 'password':
       mountChangePassword(deps).show();
       return;
+    case 'remove-damaged':
+      void mountRemoveDamaged(deps, mountDamaged(deps)).show();
+      return;
     case 'unlock':
       void mountUnlock(deps).show(mode.returnTo);
       return;
```

```diff
diff --git a/extension/src/unlock/page.ts b/extension/src/unlock/page.ts
index fd3c7cf..d37de4e 100644
--- a/extension/src/unlock/page.ts
+++ b/extension/src/unlock/page.ts
@@ -25,6 +25,7 @@ export type PageTarget =
   | 'unlock.html?mode=forgot'
   | 'unlock.html?mode=import&source=forgot'
   | 'unlock.html?mode=import&source=retry'
+  | 'unlock.html?mode=remove-damaged'
   | 'wallet.html#/created'
   | 'wallet.html#/imported'
   | `wallet.html#/send/resume?account=${string}`;
```

```diff
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index a0aaab4..38b7c62 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -47,6 +47,8 @@ export const SCREENS = [
   'v-cp-cancel',
   'v-delete',
   'v-passkey-manage',
+  'v-damaged',
+  'v-remove-damaged',
 ] as const;
 export type ScreenId = (typeof SCREENS)[number];
 
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index bcb0ddd..cf689ca 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -303,6 +303,23 @@ export const DELETE = {
   failed: 'Something went wrong. Nothing was deleted.',
 } as const;
 
+/** B1e §2.2: the removal of a vault no version can read (screens/removeDamaged.ts). Its static lines are unlock.html's. */
+export const DAMAGED = {
+  /** The address line when no account entry carries a readable address (Minor 5). */
+  noAddress: "The address can't be read",
+  /** `busy`, and the page's own digest compare: the screen reads again. */
+  changed: 'The stored data changed — check it again',
+  /** `unlocked`: a session came back between the lock and the removal. */
+  unlocked: 'Noctura was unlocked meanwhile — try again',
+} as const;
+
+/** #37's typed confirmation on the vault page (B1e §2.2, E11): the popup's words (DeleteWallet.tsx DELETE_TEXT). */
+export const TYPED_DELETE = {
+  caseSensitive: 'Case-sensitive · must match exactly.',
+  keepGoing: (n: number): readonly [string, string, string, string] => [String(n), ' of ', '6', ' characters · keep going'],
+  notAPrefix: 'Type DELETE exactly — it is case-sensitive.',
+} as const;
+
 /** #6 "manage" in the vault tab: add, replace, remove (B1b-2b §3.3, E12, D12, D13, C3, C4). */
 export const MANAGE = {
   addTitle: 'Unlock Noctura with a passkey',
```

Modify `extension/unlock.html` (two sections before `</main>`; undrawn — §9 — built from #37's card, `index.html` #s37's inline styles as `app.css` carries them for the popup):

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 31442e9..68d44a7 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -717,6 +717,89 @@
         </div>
       </section>
 
+      <!-- B1e §2.2 (E9, R4): the two damaged states (#9 and #1 show them from their own read); undrawn, built from #37's card. -->
+      <section id="v-damaged" class="screen s-pin" hidden>
+        <div class="vlt-damaged">
+          <div class="vlt-danger-card">
+            <div class="vlt-danger-head">
+              <span class="vlt-danger-icon" aria-hidden="true"><svg width="24" height="24"><use href="#i-warn" /></svg></span>
+              <div id="dmg-unreadable">
+                <h1 class="noc-h2 vlt-danger">Wallet data is damaged</h1>
+              </div>
+              <div id="dmg-refused" hidden>
+                <h1 class="noc-h2 vlt-danger">Update Noctura to open this wallet</h1>
+              </div>
+            </div>
+            <div id="dmg-unreadable-body" class="vlt-stack-3">
+              <p class="noc-body">This browser's copy of your wallet can't be read by this or any later version of Noctura.</p>
+              <p class="noc-body-sm vlt-lede">Your funds are on Solana. After you remove this copy, <b>only your recovery phrase reaches them</b>.</p>
+            </div>
+            <div id="dmg-refused-body" class="vlt-stack-3" hidden>
+              <p class="noc-body">This version of Noctura can't open this wallet's data.</p>
+              <p class="noc-body">Update Noctura (in Chrome: Extensions → Update). If it is up to date, the data may have been changed. Nothing was removed.</p>
+              <p id="dmg-help" class="noc-body-sm vlt-lede"></p>
+            </div>
+          </div>
+          <p class="noc-caption vlt-muted">This file is your wallet's data exactly as this browser holds it. If it contains your encrypted wallet, anyone with the file and your password could try to open it — keep it private.</p>
+        </div>
+        <div class="vlt-grow"></div>
+        <div class="sticky-bar">
+          <a id="dmg-save" class="btn btn-secondary" download>Save the damaged data</a>
+          <button id="dmg-remove" type="button" class="btn btn-destructive"><svg width="18" height="18" aria-hidden="true"><use href="#i-trash" /></svg>Remove damaged wallet</button>
+        </div>
+      </section>
+
+      <!-- B1e §2.2, §2.4 (E9, E11, E12): the removal of a vault no version can read — #37's card, typed DELETE and hold. -->
+      <section id="v-remove-damaged" class="screen s-pin" hidden>
+        <div class="top-bar">
+          <button id="rd-x" type="button" class="icon-btn" aria-label="Close"><svg width="22" height="22" aria-hidden="true"><use href="#i-x" /></svg></button>
+          <span class="title noc-h1">Remove damaged wallet</span>
+        </div>
+        <div id="rd-entry" class="vlt-damaged" hidden>
+          <div class="vlt-danger-card">
+            <div class="vlt-danger-head">
+              <span class="vlt-danger-icon" aria-hidden="true"><svg width="24" height="24"><use href="#i-warn" /></svg></span>
+              <h2 class="noc-h2 vlt-danger">Wallet data is damaged</h2>
+            </div>
+            <p class="noc-body">This browser's copy of your wallet can't be read by this or any later version of Noctura.</p>
+            <p class="noc-body-sm vlt-lede">Your funds are on Solana. After you remove this copy, <b>only your recovery phrase reaches them</b>.</p>
+            <p class="noc-body-sm vlt-lede">This removes the wallet from this browser only.</p>
+          </div>
+          <div class="vlt-stack-1">
+            <p class="noc-caption vlt-muted">This wallet's first account</p>
+            <div id="rd-address" class="vlt-address-start"></div>
+            <p id="rd-no-address" class="noc-body-sm vlt-lede" hidden></p>
+          </div>
+          <div class="vlt-stack-1">
+            <a id="rd-save" class="btn btn-secondary" download>Save the damaged data</a>
+            <p class="noc-caption vlt-muted">This file is your wallet's data exactly as this browser holds it. If it contains your encrypted wallet, anyone with the file and your password could try to open it — keep it private.</p>
+          </div>
+          <div>
+            <p id="rd-eyebrow" class="noc-overline vlt-muted vlt-eyebrow">Type <b class="vlt-word">DELETE</b> to confirm</p>
+            <p id="rd-matched" class="noc-overline vlt-success vlt-eyebrow" hidden><svg width="12" height="12" aria-hidden="true"><use href="#i-check" /></svg>Confirmation matched</p>
+            <label id="rd-box" class="s7-pw">
+              <input id="rd-word" type="text" placeholder="Type DELETE here" aria-label="Type DELETE here" autocapitalize="characters" autocomplete="off" spellcheck="false" />
+              <span id="rd-check" class="vlt-success" hidden><svg width="20" height="20" aria-hidden="true"><use href="#i-check" /></svg></span>
+            </label>
+            <p id="rd-help" class="noc-caption vlt-muted vlt-help"></p>
+          </div>
+          <p id="rd-caption" class="noc-caption vlt-muted vlt-center" hidden>Hold the red button to delete · release to cancel</p>
+        </div>
+        <p id="rd-helper" class="noc-caption vlt-center vlt-pad" aria-live="polite"></p>
+        <div id="rd-notice" class="vlt-notice" role="status" hidden>
+          <p id="rd-notice-line" class="noc-body"></p>
+          <p id="rd-notice-help" class="noc-body-sm vlt-lede"></p>
+        </div>
+        <div class="vlt-grow"></div>
+        <div class="sticky-bar">
+          <button id="rd-hold" type="button" class="btn btn-primary s7-longpress vlt-hold" disabled hidden><span id="rd-fill" class="fill" aria-hidden="true"></span><span class="label vlt-hold-label"><svg width="18" height="18" aria-hidden="true"><use href="#i-trash" /></svg><span>Hold to delete<span id="rd-count"></span></span></span></button>
+          <button id="rd-again" type="button" class="btn btn-primary" hidden>Start again</button>
+          <button id="rd-setup" type="button" class="btn btn-primary" hidden>Set up a wallet</button>
+          <button id="rd-close" type="button" class="btn btn-secondary" hidden>Close this tab</button>
+          <button id="rd-cancel" type="button" class="btn btn-secondary">Cancel</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 1af998a..b1f3d6c 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -456,3 +456,113 @@
   opacity: 0.4;
   cursor: not-allowed;
 }
+
+/* B1e §2.2: the damaged states and their removal (undrawn) — #37's card (index.html #s37's inline styles, as app.css
+   carries them for the popup), its typed DELETE field and its hold. */
+.vlt-damaged {
+  padding: var(--space-5) var(--space-5) var(--space-6);
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-5);
+}
+.vlt-danger-card {
+  background: color-mix(in oklab, var(--danger) 10%, var(--bg-surface-1));
+  border: 1px solid color-mix(in oklab, var(--danger) 36%, transparent);
+  border-radius: var(--radius-2xl);
+  padding: var(--space-6);
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-4);
+}
+.vlt-danger-head {
+  display: flex;
+  align-items: center;
+  gap: var(--space-3);
+}
+.vlt-danger-icon {
+  width: 48px;
+  height: 48px;
+  border-radius: 50%;
+  background: color-mix(in oklab, var(--danger) 18%, var(--bg-surface-2));
+  color: var(--danger);
+  display: flex;
+  align-items: center;
+  justify-content: center;
+  flex: 0 0 48px;
+}
+.vlt-stack-3 {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-3);
+}
+.vlt-stack-1 {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-1);
+}
+.vlt-address-start {
+  display: flex;
+}
+.vlt-eyebrow {
+  margin-bottom: var(--space-2);
+  display: flex;
+  align-items: center;
+  gap: 4px;
+}
+.vlt-word {
+  color: var(--danger);
+  letter-spacing: 0.16em;
+}
+.vlt-help {
+  margin-top: 6px;
+}
+/* "Save the damaged data" is a link (<a download>) drawn as the design's button: not underlined. */
+.vlt-col a.btn {
+  text-decoration: none;
+}
+.vlt-col .s7-pw input {
+  letter-spacing: 0.16em;
+}
+.vlt-col .s7-pw input::placeholder {
+  color: var(--fg-tertiary);
+  letter-spacing: 0.16em;
+}
+.vlt-col .s7-pw:focus-within,
+.vlt-col .s7-pw.vlt-pw-active {
+  border: 1px solid var(--accent);
+}
+.vlt-col .s7-pw.vlt-pw-ok {
+  background: color-mix(in oklab, var(--success) 8%, var(--bg-surface-3));
+  border: 1px solid color-mix(in oklab, var(--success) 30%, transparent);
+}
+.vlt-col .s7-pw.vlt-pw-ok input {
+  font-weight: 600;
+}
+/* 37c's hold CTA in --danger; the fill follows the hold's ticks through --vlt-hold (0..1, view/deleteConfirm.ts). Gated
+   (37a/37b) it is greyed at full opacity. */
+.vlt-col .btn.s7-longpress.vlt-hold {
+  background: var(--danger);
+  color: var(--danger-on);
+  box-shadow: none;
+}
+.vlt-col .btn.s7-longpress.vlt-hold:disabled {
+  background: var(--bg-surface-3);
+  color: var(--fg-disabled);
+  opacity: 1;
+}
+.vlt-col .btn.s7-longpress.vlt-hold .fill {
+  background: color-mix(in oklab, #000 35%, transparent);
+  transform: scaleX(var(--vlt-hold, 0));
+  transition: none;
+}
+.vlt-hold-label {
+  display: flex;
+  align-items: center;
+  justify-content: center;
+  gap: var(--space-2);
+}
+@media (prefers-reduced-motion: reduce) {
+  .vlt-col .btn.s7-longpress.vlt-hold .fill {
+    display: none;
+  }
+}
```

The E2E. Create `extension/e2e/damaged.spec.ts`:

```ts
import {test, expect, type Page, type Worker} from '@playwright/test';
import {createHash} from 'node:crypto';
import {readFileSync, rmSync} from 'node:fs';
import {makeEnvelope} from './makeEnvelope';
import {containNocTura, containSolscan, expectContained, launchContained} from './launch';
import {shot} from './visualTab';

// B1e §2.2–§2.4 through the real extension: the unreadable state on #9 and #1, "Save the damaged data" read back from
// Playwright's download, the removal (typed DELETE + the 1 s hold) and its refusal for a vault refused by this version
// and for a wallet. Each state is shot at the vault page's size (412 × 916) for the visual check.
declare const chrome: {storage: {local: {set(o: object): Promise<void>; get(k: string | null): Promise<Record<string, unknown>>; remove(k: string): Promise<void>}}};

const HOLD_MS = 1_000;
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const storedText = (sw: Worker): Promise<string | undefined> => sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get('v1_vault')).v1_vault));

async function vaultPage(ctx: Awaited<ReturnType<typeof launchContained>>['ctx'], id: string, path: string): Promise<Page> {
  const page = await ctx.newPage();
  await page.setViewportSize({width: 412, height: 916});
  await page.goto('about:blank');
  await page.clock.install();
  await page.goto(`chrome-extension://${id}/${path}`);
  return page;
}
/** Saves through the link and returns the file's bytes and name. */
async function save(page: Page, selector: string): Promise<{bytes: Buffer; name: string}> {
  const [download] = await Promise.all([page.waitForEvent('download'), page.click(selector)]);
  return {bytes: readFileSync(await download.path()), name: download.suggestedFilename()};
}
/** Holds the removal's button for the full second on the page's paused clock. */
async function hold(page: Page, ms: number): Promise<void> {
  await page.locator('#rd-hold').hover();
  await page.mouse.down();
  await page.clock.runFor(ms);
  await page.mouse.up();
}

test('damaged vaults: the unreadable state, its saved bytes, the removal; a refused vault and a wallet are never removed', async () => {
  const {ctx, profile} = await launchContained('noctura-e2e-damaged-');
  const nocTura = await containNocTura(ctx);
  const solscan = await containSolscan(ctx);
  try {
    await expectContained(ctx);
    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
    const id = new URL(sw.url()).host;
    const env = await makeEnvelope();

    // Unreadable (U3: a 3-byte password wrap), with the wallet's settings and address book beside it.
    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v, v1_settings: {autoLockMinutes: 5}, v1_contacts: [{address: 'x', name: 'y'}]}), {...env, password: {wrapped: 'AAAA'}});
    const text = await storedText(sw);
    let p = await vaultPage(ctx, id, 'unlock.html');
    await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged', {timeout: 60_000});
    await expect(p.locator('#unl-password')).toBeHidden();
    await expect(p.locator('#dmg-remove')).toBeVisible();
    await shot(p, 'damaged-09-unreadable', {ready: p.locator('#dmg-remove')});
    const fromState = await save(p, '#dmg-save');
    expect(fromState.bytes.toString('utf8')).toBe(text);
    expect(fromState.name).toBe(`noctura-damaged-wallet-${sha256(fromState.bytes).slice(0, 8)}.json`);
    await p.goto(`chrome-extension://${id}/unlock.html?mode=welcome`);
    await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged');
    await expect(p.locator('#wel-create')).toBeHidden();
    await shot(p, 'damaged-01-unreadable', {ready: p.locator('#dmg-remove')});

    await p.click('#dmg-remove');
    await expect(p).toHaveURL(/unlock\.html\?mode=remove-damaged$/);
    await expect(p.locator('#rd-entry')).toBeVisible();
    await expect(p.locator('#rd-address')).toHaveText('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    await expect(p.locator('#rd-hold')).toBeDisabled();
    await shot(p, 'damaged-remove-idle', {ready: p.locator('#rd-cancel')});
    const fromRemoval = await save(p, '#rd-save');
    expect(fromRemoval.bytes.equals(fromState.bytes)).toBe(true);
    await p.fill('#rd-word', 'DEL');
    await shot(p, 'damaged-remove-partial', {ready: p.locator('#rd-cancel')});
    await p.fill('#rd-word', 'DELETE');
    await expect(p.locator('#rd-matched')).toBeVisible();
    await shot(p, 'damaged-remove-matched', {ready: p.locator('#rd-hold')});
    // Released before the full second: nothing removed. The clock then runs on past the full second — a hold still
    // counting would complete now — and the button is still armed: a confirmation disables it in the same tick, before
    // the removal is sent, so this is the signal that none happened (storage alone could be read before a removal lands).
    await hold(p, HOLD_MS - 300);
    await p.clock.runFor(HOLD_MS);
    await expect(p.locator('#rd-hold')).toBeEnabled();
    expect(await storedText(sw)).toBe(text);
    // Held mid-way: the count and the fill, shot under the paused clock.
    await p.locator('#rd-hold').hover();
    await p.mouse.down();
    await p.clock.runFor(600);
    await expect(p.locator('#rd-hold')).toContainText('Hold to delete · 0.');
    await shot(p, 'damaged-remove-holding', {fullPage: false});
    await p.clock.runFor(HOLD_MS);
    await p.mouse.up();
    await expect(p).toHaveURL(/unlock\.html\?mode=welcome$/, {timeout: 30_000});
    await expect(p.locator('#wel-create')).toBeVisible();
    const left = await sw.evaluate(() => chrome.storage.local.get(null));
    expect(Object.keys(left).filter(k => ['v1_vault', 'v1_settings', 'v1_contacts'].includes(k))).toEqual([]);

    // Refused by this version (v: 2): the state says "update", offers Save and no removal; the removal URL offers none.
    const refused = {...env, v: 2};
    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v}), refused);
    p = await vaultPage(ctx, id, 'unlock.html');
    await expect(p.locator('#dmg-refused')).toHaveText('Update Noctura to open this wallet', {timeout: 60_000});
    await expect(p.locator('#dmg-refused-body p').first()).toHaveText("This version of Noctura can't open this wallet's data.");
    await expect(p.locator('#dmg-remove')).toBeHidden();
    await shot(p, 'damaged-09-refused');
    expect((await save(p, '#dmg-save')).bytes.toString('utf8')).toBe(await storedText(sw));
    await p.goto(`chrome-extension://${id}/unlock.html?mode=remove-damaged`);
    await expect(p.locator('#dmg-refused')).toBeVisible();
    await expect(p.locator('#rd-entry')).toBeHidden();
    expect(JSON.parse((await storedText(sw)) ?? 'null')).toEqual(JSON.parse(JSON.stringify(refused)));

    // A wallet: the removal URL says one exists and offers nothing.
    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v}), env);
    await p.goto(`chrome-extension://${id}/unlock.html?mode=remove-damaged`);
    await expect(p.locator('#rd-notice-line')).toHaveText('A wallet already exists in this browser. Nothing was changed.');
    await expect(p.locator('#rd-hold')).toBeHidden();
    await shot(p, 'damaged-remove-wallet');
    expect(JSON.parse((await storedText(sw)) ?? 'null')).toEqual(JSON.parse(JSON.stringify(env)));

    // No readable address (a stored null).
    await sw.evaluate(() => chrome.storage.local.set({v1_vault: null}));
    await p.goto(`chrome-extension://${id}/unlock.html?mode=remove-damaged`);
    await expect(p.locator('#rd-no-address')).toHaveText("The address can't be read");
    await shot(p, 'damaged-remove-no-address', {ready: p.locator('#rd-cancel')});

    expect(nocTura.hits).toEqual([]);
    expect(solscan.hits).toEqual([]);
  } finally {
    await ctx.close();
    rmSync(profile, {recursive: true, force: true});
  }
});
```

Modify `extension/e2e/unlock.spec.ts`, `extension/e2e/visual-vault.spec.ts` and `extension/e2e/csp.spec.ts`:

```diff
diff --git a/extension/e2e/unlock.spec.ts b/extension/e2e/unlock.spec.ts
index 36eb6ff..b94c307 100644
--- a/extension/e2e/unlock.spec.ts
+++ b/extension/e2e/unlock.spec.ts
@@ -46,10 +46,10 @@ test('unlocking in the vault page puts only signing keys into session storage',
     expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});
 
     // A malformed stored envelope is named as damaged — before any password is typed, so never as a
-    // wrong password — and sends nothing.
+    // wrong password — and sends nothing. B1e §2.2: a 3-byte password wrap is unreadable (U3).
     await sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), {...env, password: {wrapped: 'AAAA'}});
     await page.reload();
-    await expect(page.locator('#unl-notice-line')).toHaveText("This wallet's stored data is damaged.", {timeout: 60_000});
+    await expect(page.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged', {timeout: 60_000});
     await expect(page.locator('#unl-password')).toBeHidden();
     expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});
     expect(nocTura.hits).toEqual([]);
```

```diff
diff --git a/extension/e2e/visual-vault.spec.ts b/extension/e2e/visual-vault.spec.ts
index 6190e01..b787abd 100644
--- a/extension/e2e/visual-vault.spec.ts
+++ b/extension/e2e/visual-vault.spec.ts
@@ -343,11 +343,12 @@ test('visual: #9, #39, the restore and retry steps', async () => {
 
     await h.sw.evaluate(() => chrome.storage.local.set({v1_vault: null}));
     await p.goto(`chrome-extension://${h.id}/unlock.html`);
-    await expect(text(p, '#unl-notice-line')).toHaveText("This wallet's stored data is damaged.");
-    await shot(p, '09-damaged');
+    // B1e §2.2: a stored null is unreadable (U1) — the damaged state, on #9 and on #1.
+    await expect(text(p, '#dmg-unreadable')).toHaveText('Wallet data is damaged');
+    await shot(p, '09-damaged', {ready: p.locator('#dmg-remove')});
     await p.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
-    await expect(text(p, '#wel-notice-line')).toHaveText("This wallet's stored data is damaged.");
-    await shot(p, '01-welcome-damaged');
+    await expect(text(p, '#dmg-unreadable')).toHaveText('Wallet data is damaged');
+    await shot(p, '01-welcome-damaged', {ready: p.locator('#dmg-remove')});
     await h.sw.evaluate(() => chrome.storage.local.remove('v1_vault'));
     await p.goto(`chrome-extension://${h.id}/unlock.html`);
     await expect(text(p, '#unl-notice-line')).toHaveText('No wallet on this browser yet.');
```

```diff
diff --git a/extension/e2e/csp.spec.ts b/extension/e2e/csp.spec.ts
index 806fc23..dc2618f 100644
--- a/extension/e2e/csp.spec.ts
+++ b/extension/e2e/csp.spec.ts
@@ -200,7 +200,31 @@ test('csp: every vault-page mode runs with zero CSP violations; an inline style
     await expect(p.locator('#imp-phrase')).toBeVisible();
     await clean('import');
 
-    expect(seen).toHaveLength(23);
+    // B1e §2.2: the two damaged states and the removal, whose hold writes --vlt-hold through the CSSOM — never a violation.
+    await h.sw.evaluate(async () => chrome.storage.local.set({v1_vault: {v: 2}}));
+    await p.goto(base);
+    await expect(p.locator('#dmg-refused')).toBeVisible();
+    await clean('#9, refused by this version');
+    await h.sw.evaluate(async () => chrome.storage.local.set({v1_vault: null}));
+    await p.goto(base);
+    await expect(p.locator('#dmg-unreadable')).toBeVisible();
+    await clean('#9, unreadable');
+    await p.locator('#dmg-remove').click();
+    await expect(p.locator('#rd-entry')).toBeVisible();
+    await p.locator('#rd-word').fill('DELETE');
+    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
+    await p.locator('#rd-hold').hover();
+    await p.mouse.down();
+    await p.clock.runFor(600);
+    await expect(p.locator('#rd-fill')).toHaveAttribute('style', /--vlt-hold/);
+    await p.clock.runFor(500);
+    await p.mouse.up();
+    await p.clock.resume();
+    await expect(p).toHaveURL(/mode=welcome$/);
+    await expect(p.locator('#wel-create')).toBeVisible();
+    await clean('remove-damaged, the hold');
+
+    expect(seen).toHaveLength(26);
 
     // The positive control, on the same page and watch: an inline <style> and a remote <img> are both refused and reported.
     await p.evaluate(src => {
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, the vault-page E2E.**

Run: the Step 2 command — `Test Files  8 passed (8)` · `Tests  592 passed (592)` (forgetDamaged 70, storedDigest 4, damagedFlow 8, damagedScreens 25, unlockScreen 29, welcome 6, messages 29, check-vault-isolation 421).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `npx vitest run` — `Test Files  228 passed (228)` · `Tests  4961 passed (4961)` (Task 1's tree 224 / 4854: +4 files, +107 tests — forgetDamaged 70, storedDigest 4, damagedFlow 8, damagedScreens 25; the changed rows keep their counts). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  18 passed (18)` · `Tests  435 passed | 25 skipped (460)` (unchanged).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale` (exit 0), `npm run csp` (`CSP ok` for both), then `npm run gates` — exit 0, every gate ok once per build; **vault isolation ok for both builds** (`saveDamaged.ts` names no HTML type and makes no object URL; the hold's fill is the page's one allowed CSSOM write form, `--vlt-hold` from a number — `holdShare`, as `cooldown.ts`' `ringShare`); `classes ok: … every class in 49 vault-page files by ../web/src/styles/design-system.css, src/styles/design-ext.css, src/unlock/unlock.css`; the last line `no presale ok (dist-nopresale off, dist on): …` as Task 1's.

No repo-root `src/` or `core/` change: root `tsc` / `jest` and web `verify` are not run.

Playwright, the vault-page specs (every spec that opens `unlock.html`, plus the new one): `npx playwright test e2e/unlock.spec.ts e2e/onboarding.spec.ts e2e/settings.spec.ts e2e/csp.spec.ts e2e/visual-vault.spec.ts e2e/damaged.spec.ts` — `25 passed (6.9m)` normally and `25 passed (6.7m)` under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'`; `e2e/csp.spec.ts` with its three new pages — `1 passed (48.0s)` normally and `1 passed (49.8s)` under `unshare -rn`. **Rev 2** (on the rebuilt 2876fea, `damaged.spec.ts` changed): `npx playwright test e2e/damaged.spec.ts` — `1 passed (9.8s)` normally and `1 passed (9.5s)` under `unshare -rn`.

**Visual check (the two damaged states and the removal, at the vault page's size 412 × 916; shots `test-results/visual/damaged-*.png`, in the dry run's scratch only).** Read against `index.html` #s37 (the card, the typed field's 37a/37b/37c looks, the hold CTA) and the vault page's own screens. Found and fixed before the commit: "Save the damaged data" (an `<a>` drawn as `.btn`) was underlined — `.vlt-col a.btn {text-decoration: none}`; the "a wallet already exists" notice drew both [Close this tab] and the bar's [Cancel] — a notice with its own way out now hides Cancel, as #37's proof page does. Confirmed as intended: the danger card and its warn disc at #37's tints; the refused title wraps to three lines at `.noc-h2` and the unreadable title to one; Save above Remove; 37b's accent ring and "3 of 6 characters · keep going"; 37c's success-tinted field, "✓ CONFIRMATION MATCHED" and the caption; the hold at 0.3 s left with the darkened fill at 70 % and Cancel at .45; the gated CTA greyed at full opacity; "The address can't be read" in the address's place. Undrawn elements, flagged for Task 7's visual pass and the owner (§9): the `v-damaged` screen (no top bar — it replaces #9 / #1), the removal screen's top-bar title "Remove damaged wallet", the save note under each Save.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1e-1 vault.forgetDamaged — the one password-less removal of v1_vault, only of a value the frozen predicate calls unreadable, bound to the sha256 of its stored text, in E5's order (lock, an open send refuses, re-read, no session, then the wallet's data); the damaged states on #9 and #1 (unreadable: Save + Remove; refused by this version: update, Save, no removal); the removal screen with #37's typed DELETE and hold; Save the damaged data as a data:application/json download of exactly the hashed bytes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules linked), `timeout 300`; `tsc`'s own exit code first (0 for every one), then the named test files.** `BG` = `forgetDamaged.test.ts` (70; the rows down to M-release were observed on its first 69 rows — Review Focus 1's row was added at assembly, and M-serial is observed on all 70), `FL` = `damagedFlow.test.ts` (8), `SC` = `damagedScreens.test.ts` (25), `SD` = `storedDigest.test.ts` (4), `VI` = `check-vault-isolation.test.mjs` (421). Bold ids are §2.6's. In `accountsStore.ts` every edit is made inside `forgetDamaged` (the first match after `export async function forgetDamaged`): several of its lines are `forgetWallet`'s too.

| id | the change | named test → observed |
|---|---|---|
| C-none (control) | (none — the unmutated tree) | tsc 0 · gate green exit 0 (the control) |
| M-readable | `if (vaultReading(stored).kind !== 'unreadable') return 'not-unreadable';` → `if (vaultReading(stored).kind === 'none') return 'not-unreadable';`; `vaultReading(again).kind !== 'unreadable'` → `vaultReading(again).kind === 'none'` | tsc 0 · BG RED `12 failed \| 57 passed (69)` — “vault.forgetDamaged — never a readable vault (§2.6: F0–F9, the breadth, the first encoder) › F0 the fixture verbatim → not-unreadable, v1_vault byte-identical, not locked”; “vault.forgetDamaged — never a readable vault (§2.6: F0–F9, the breadth, the first encoder) › F1 without passkey → not-unreadable, v1_vault byte-identical, not locked” (+10 more) |
| M-refused | `if (vaultReading(stored).kind !== 'unreadable') return 'not-unreadable';` → `if (vaultReading(stored).kind === 'wallet') return 'not-unreadable';`; `vaultReading(again).kind !== 'unreadable'` → `vaultReading(again).kind === 'wallet'` | tsc 0 · BG RED `8 failed \| 61 passed (69)` — “vault.forgetDamaged — never a readable vault (§2.6: F0–F9, the breadth, the first encoder) › F2 kdf.m = 32768 (below the floor) → not-unreadable, v1_vault byte-identical, not locked”; “vault.forgetDamaged — never a readable vault (§2.6: F0–F9, the breadth, the first encoder) › F3 kdf.m = 2147483648 (above the cap) → not-unreadable, v1_vault byte-identical, not locked” (+6 more) |
| **M-digest** | ` \|\| storedDigest(again) !== expectedDigest) return 'busy';` → `) return 'busy';` | tsc 0 · BG RED `1 failed \| 68 passed (69)` — “vault.forgetDamaged — the digest (C2) › an unreadable value replaced by another unreadable one after the lock (step 5): busy, the new value kept” |
| M-digest-first | `    if (storedDigest(stored) !== expectedDigest) return 'busy'; ⏎ ` → `` | tsc 0 · BG RED `1 failed \| 68 passed (69)` — “vault.forgetDamaged — the digest (C2) › the digest of another value: busy, nothing removed, not locked” |
| **M-lock** | `    const removed = await sessionMutex(async () => { ⏎       if ((await getSession(ext)) !== null) return false; ⏎ ` → `    const removed = await sessionMutex(async () => { ⏎ ` | tsc 0 · BG RED `1 failed \| 68 passed (69)` — “vault.forgetDamaged — a send still open, a session back (E12, step 6) › a session written into the session store after the lock (as a disk fault would leave one): unlocked, the vault byte-identical” · SC RED `1 failed \| 24 passed (25)` — “the removal screen (B1e §2.2) › a session back between the lock and the removal: "Noctura was unlocked meanwhile — try again", nothing removed” |
| M-lock-first | `    // 3. ⏎     await lock(ext); ⏎ ` → `` | tsc 0 · BG RED `6 failed \| 63 passed (69)` — “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › a session present at the click is locked first (step 3), then the vault removed”; “vault.forgetDamaged — the digest (C2) › an unreadable value replaced by another unreadable one after the lock (step 5): busy, the new value kept” (+4 more) |
| M-send-open | `        if (records.some(isOpen)) throw new SendOpen(); ⏎ ` → `` | tsc 0 · BG RED `1 failed \| 68 passed (69)` — “vault.forgetDamaged — a send still open, a session back (E12, step 6) › send-open for a pending and for a stuck record: locked, the vault and the record kept; removed once it settles” · SC RED `1 failed \| 24 passed (25)` — “the removal screen (B1e §2.2) › a send still open (E12): #37’s line, nothing removed, the record kept; Start again reads again” |
| M-pending-kept | `        if (records.some(isOpen)) throw new SendOpen(); ⏎         return [];` → `        if (records.some(isOpen)) throw new SendOpen(); ⏎         return records;` | tsc 0 · BG RED `44 failed \| 25 passed (69)` — “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 null → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept”; “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 [] → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept” (+42 more) |
| M-wipe | `      await removeWalletData(ext); ⏎ ` → `` | tsc 0 · BG RED `45 failed \| 24 passed (69)` — “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 null → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept”; “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 [] → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept” (+43 more) · SC RED `1 failed \| 24 passed (25)` — “the removal screen (B1e §2.2) › typed DELETE + the full hold removes it: one forgetDamaged, the wallet data gone, then #1” |
| M-wipe-locked | `      await removeWalletData(ext); ⏎ ` → `      for (const key of WALLET_DATA_KEYS) if (!LOCKED_DATA_KEYS.has(key)) await ext.local.remove(key); ⏎ ` | tsc 0 · BG RED `44 failed \| 25 passed (69)` — “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 null → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept”; “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 [] → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept” (+42 more) |
| M-caches | `      await clearCaches(ext); ⏎ ` → `` | tsc 0 · BG RED `44 failed \| 25 passed (69)` — “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 null → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept”; “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 [] → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept” (+42 more) |
| M-malformed | `  if (!isStr(expectedDigest) \|\| !REVISION.test(expectedDigest)) return 'malformed';` → `  if (!isStr(expectedDigest)) return 'malformed';` | tsc 0 · BG RED `1 failed \| 68 passed (69)` — “vault.forgetDamaged — who may ask › malformed digests are refused before anything is read: 63 hex, 65 hex, upper case, not a string, absent” |
| M-page-only | `src/background/messages.ts`: `  'vault.phraseVerified', ⏎   'vault.forgetDamaged', ⏎ ];` → `  'vault.phraseVerified', ⏎ ];` | tsc 0 · BG RED `1 failed \| 68 passed (69)` — “vault.forgetDamaged — who may ask › only the vault page: refused from the popup, the UI tab, the approval window, another extension and a web page — nothing removed” |
| M-page-compare | `src/unlock/damagedFlow.ts`: `  if (storedDigest(raw) !== shownDigest) return 'changed';` → `  if (storedDigest(raw) === '') return 'changed';` | tsc 0 · FL RED `1 failed \| 7 passed (8)` — “removeDamaged (B1e §2.4) › the value stored now is not the one shown (another digest): changed, nothing sent” · SC RED `1 failed \| 24 passed (25)` — “the removal screen (B1e §2.2) › the value replaced by another unreadable one between the screen and the click: nothing sent, the new value shown with the line” |
| M-page-judge | `src/unlock/damagedFlow.ts`: `  if (vaultReading(raw).kind !== 'unreadable') return 'not-unreadable';` → `  if (vaultReading(raw).kind === 'none') return 'not-unreadable';` | tsc 0 · FL RED `1 failed \| 7 passed (8)` — “removeDamaged (B1e §2.4) › a readable value (F0–F9) is never sent: not-unreadable, nothing sent, nothing removed” |
| M-digest-text | `src/shared/storedDigest.ts`: `  return bytesToHex(sha256(utf8ToBytes(storedText(raw))));` → `  return bytesToHex(sha256(utf8ToBytes(JSON.stringify(raw, null, 1))));` | tsc 0 · SD RED `2 failed \| 2 passed (4)` — “storedText / storedDigest › the text is JSON.stringify of the value, keys in stored order; the digest its sha256, lowercase hex”; “storedText / storedDigest › a lone surrogate is escaped by JSON.stringify, so the text is well formed and its bytes are those hashed” · BG RED `47 failed \| 22 passed (69)` — “vault.forgetDamaged — who may ask › only the vault page: refused from the popup, the UI tab, the approval window, another extension and a web page — nothing removed”; “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › U1 the fixture as an array → forgotten: the vault, the wallet’s data, v1_pending and the caches in one call; the 403 cool-down kept” (+45 more) · SC RED `4 failed \| 21 passed (25)` — “"Save the damaged data" (B1e §2.3, E10, R4) › carries exactly the bytes the digest hashes — the digest the removal then sends — named by its first 8 hex”; “"Save the damaged data" (B1e §2.3, E10, R4) › the damaged screen’s link carries the same bytes on both states, and is offered before any removal” (+2 more) |
| M-save-bytes | `src/unlock/view/saveDamaged.ts`: `encodeURIComponent(storedText(raw))` → `encodeURIComponent(JSON.stringify(raw, null, 2) ?? storedText(raw))` | tsc 0 · SC RED `7 failed \| 18 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)”; “the damaged states on #9 and #1 (B1e §2.2) › #1: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)” (+5 more) |
| M-save-name | `src/unlock/view/saveDamaged.ts`: `digest.slice(0, 8)` → `digest.slice(-8)` | tsc 0 · SC RED `2 failed \| 23 passed (25)` — “"Save the damaged data" (B1e §2.3, E10, R4) › carries exactly the bytes the digest hashes — the digest the removal then sends — named by its first 8 hex”; “"Save the damaged data" (B1e §2.3, E10, R4) › the damaged screen’s link carries the same bytes on both states, and is offered before any removal” |
| M-save-blob | `src/unlock/view/saveDamaged.ts`: ``   link.href = `data:application/json;charset=utf-8,${encodeURIComponent(storedText(raw))}`; `` → `  link.href = URL.createObjectURL(new Blob([storedText(raw)], {type: 'application/json'}));` | tsc 0 · gate RED exit 1 — “src/unlock/view/saveDamaged.ts: creates an object URL — the vault page sets text only (textContent)” · SC RED `8 failed \| 17 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)”; “the damaged states on #9 and #1 (B1e §2.2) › #1: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)” (+6 more) |
| M-save-html | `src/unlock/view/saveDamaged.ts`: `` `data:application/json;charset=utf-8, `` → `` `data:text/html;charset=utf-8, `` | tsc 0 · gate RED exit 1 — “src/unlock/view/saveDamaged.ts: names a data:text/html URL — the vault page sets text only (textContent)”; “src/unlock/view/saveDamaged.ts: names the text/html type — the vault page sets text only (textContent)” · SC RED `8 failed \| 17 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)”; “the damaged states on #9 and #1 (B1e §2.2) › #1: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)” (+6 more) |
| M-refused-shown | `src/unlock/screens/damaged.ts`: `      shown(remove, next === 'unreadable');` → `      shown(remove, true);` | tsc 0 · SC RED `3 failed \| 22 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)”; “the damaged states on #9 and #1 (B1e §2.2) › #1: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)” (+1 more) |
| M-refused-disabled | `src/unlock/screens/damaged.ts`: `    remove.disabled = kind !== 'unreadable' \|\| deps.gate.isBusy();` → `    remove.disabled = deps.gate.isBusy();` | tsc 0 · SC RED `2 failed \| 23 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)”; “the damaged states on #9 and #1 (B1e §2.2) › #1: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)” |
| M-refused-click | `src/unlock/screens/damaged.ts`: `    if (kind === 'unreadable') void exclusive` → `    if (kind !== null) void exclusive` | tsc 0 · SC RED `2 failed \| 23 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)”; “the damaged states on #9 and #1 (B1e §2.2) › #1: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)” |
| M-sender | `src/unlock/screens/damaged.ts`: `async () => deps.go('unlock.html?mode=remove-damaged')` → `async () => deps.send({type: 'vault.forgetDamaged', expectedDigest: fillSaveLink(byId<HTMLAnchorElement>('dmg-save'), null)}).then(() => deps.go('unlock.html?mode=remove-damaged'))` | tsc 0 · FL RED `1 failed \| 7 passed (8)` — “vault.forgetDamaged stays behind its one screen › the message type is named by the background (its handler and its lists) and by damagedFlow.ts only” · SC RED `2 failed \| 23 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: an unreadable vault → "Wallet data is damaged", Save and Remove; nothing sent”; “the damaged states on #9 and #1 (B1e §2.2) › #1: an unreadable vault → "Wallet data is damaged", Save and Remove; nothing sent” |
| M-unlock-refused | `src/unlock/screens/unlock.ts`: `    damaged.show(reading.kind, raw);` → `    damaged.show('unreadable', raw);` | tsc 0 · SC RED `1 failed \| 24 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)” |
| M-welcome-refused | `src/unlock/screens/welcome.ts`: `      else damaged.show(reading.kind, raw);` → `      else damaged.show('unreadable', raw);` | tsc 0 · SC RED `1 failed \| 24 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #1: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)” |
| M-out-of-predicate | `src/unlock/screens/unlock.ts`: `    if (!showDamaged(raw)) notice('damaged', COMMON.damaged, COMMON.damagedHelp);` → `    if (!showDamaged(raw)) damaged.show('unreadable', raw);` | tsc 0 · SC RED `1 failed \| 24 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: an attempt that ends `damaged` over a wallet (its seed fails AES-GCM after the unwrap, §2.1 out of the predicate) keeps the damaged notice — never the removal” |
| M-removal-refused | `src/unlock/screens/removeDamaged.ts`: `    if (reading.kind === 'refused') {` → `    if (reading.kind === 'refused' && raw === null) {` | tsc 0 · SC RED `2 failed \| 23 passed (25)` — “the removal screen (B1e §2.2) › a value that became readable meanwhile is never removed: refused → the refused state; a wallet → "A wallet already exists"”; “the removal screen (B1e §2.2) › opened over a refused vault or a wallet it offers no removal at all” |
| M-address | `src/unlock/screens/removeDamaged.ts`: `    if (low === null \|\| index < low.index) low = {index, publicKey};` → `    if (low === null) low = {index, publicKey};` | tsc 0 · SC RED `1 failed \| 24 passed (25)` — “the removal screen (B1e §2.2) › names the lowest-index readable address, never accounts[0]; the lines; no password field” |
| M-hold | `src/unlock/view/deleteConfirm.ts`: `      if (held < HOLD_MS) return paintHold(held / HOLD_MS);` → `      if (held < 0) return paintHold(held / HOLD_MS);` | tsc 0 · SC RED `1 failed \| 24 passed (25)` — “the removal screen (B1e §2.2) › a hold released before the full second removes nothing; held again for the full second it does” |
| M-word | `src/unlock/view/deleteConfirm.ts`: `  const matched = () => parts.field.value === CONFIRM_WORD;` → `  const matched = () => parts.field.value.toUpperCase() === CONFIRM_WORD;` | tsc 0 · SC RED `1 failed \| 24 passed (25)` — “the removal screen (B1e §2.2) › without the word, or with the word not exact, the button refuses a press; nothing sent” |
| M-release | `src/unlock/view/deleteConfirm.ts`: `for (const ev of ['pointerup', 'pointerleave', 'pointercancel', 'blur'] as const)` → `for (const ev of ['pointerleave', 'pointercancel', 'blur'] as const)` | tsc 0 · SC RED `1 failed \| 24 passed (25)` — “the removal screen (B1e §2.2) › a hold released before the full second removes nothing; held again for the full second it does” |
| M-serial (Review Focus 1) | `src/background/accountsStore.ts`, `forgetDamaged`: `  return serial(async (): Promise<ForgetDamagedResult> => {` → `  return (async (): Promise<ForgetDamagedResult> => {`, and its closing `  });` (after `return 'forgotten';`) → `  })();` | tsc 0 · BG RED `1 failed \| 69 passed (70)` — “vault.forgetDamaged — an unreadable vault (§2.6: every deletable control) › two removal tabs confirming at once: one is forgotten, the other waits for it and finds no wallet” |

Rev 2's rows (E19, review M2), observed on the rebuilt 2876fea:

| id | the change | named test → observed |
|---|---|---|
| M-refused-heading (E19) | `unlock.html`: `<h1 class="noc-h2 vlt-danger">Update Noctura to open this wallet</h1>` → `<h1 class="noc-h2 vlt-danger">This version of Noctura can't open this wallet's data.</h1>` (rev 1's heading back) | tsc 0 · SC RED `2 failed \| 23 passed (25)` — “the damaged states on #9 and #1 (B1e §2.2) › #9: a vault refused by this version (F2–F8) → "update the extension", Save, and NO removal (R4)”; “… › #1: …” (the same row for #1) |
| M-refused-line (E19) | `unlock.html`: the line `<p class="noc-body">This version of Noctura can't open this wallet's data.</p>` removed from `#dmg-refused-body` | tsc 0 · SC RED `2 failed \| 23 passed (25)` — the same two rows |
| M-e2e-short-hold (review M2, E2E) | `src/unlock/view/deleteConfirm.ts`: `      if (held < HOLD_MS) return paintHold(held / HOLD_MS);` → `      if (held < HOLD_MS - 400) return paintHold(held / HOLD_MS);` (a hold confirms at 600 ms); both builds, then `npx playwright test e2e/damaged.spec.ts` | tsc 0 · build 0 · **RED** `1 failed` — at the new signal, `expect(locator).toBeEnabled()` on `#rd-hold` (`damaged.spec.ts:82`); rev 1's spec under the same mutant was red too in this run, but at its immediate storage read (`:79`) — a race between that read and the asynchronous removal, which the armed-button signal removes |

36 mutations (32 from the dry run, M-serial from the assembly's Review Focus row, rev 2's M-refused-heading and M-refused-line) plus rev 2's E2E mutant M-e2e-short-hold, every one `tsc` 0 and red in each named file — **rev 2: all re-run on the rebuilt 2876fea**, the counts now over `forgetDamaged.test.ts`' 70 rows (Review Focus 1's row included: e.g. M-digest `1 failed \| 69 passed (70)`; the wipe mutants also fail the two-tab row — M-wipe `46 failed \| 24 passed (70)`, M-wipe-locked and M-caches 45, M-digest-text 48), every other file's counts as rev 1's, C-none's gate green; the control C-none (no edit) leaves the gate green, so the gate's red under M-save-blob and M-save-html is theirs. The sweep: `t2-logs/mutate.py` (a fresh `git archive HEAD` copy per mutant; `extension/node_modules` hard-linked — `cp -al` — for the gate rows, since the gate refuses a bundle whose packages resolve outside the package's tree through a symlink, the control included; symlinked otherwise). The vault-isolation gate is named, not `check-vault-isolation.test.mjs`: that file tests the gate's rules on synthetic inputs and the real tree's reachability, while the markup rules (`sourceViolations`: object URL, `text/html`) run over the real sources only in `node scripts/check-vault-isolation.mjs` — under M-save-blob the test file stays `421 passed`, the gate goes red.

What the first sweep (on the commit before the final one) found, both fixed in the final commit and the whole sweep run again on it: three mutants did not compile (M-page-compare, M-page-judge, M-save-bytes removed the only use of an import — `noUnusedLocals`), now written to keep the import used; and **M-refused-click survived** — the refused-state test "clicked" the Remove button while it was disabled, and a disabled button delivers no click, so the listener's own guard was never reached. The test now enables the button before its stray click; M-refused-click and the new M-refused-disabled each turn it red.

#### Notes for the executor (Task 2)

- **Rev 2 — E19, the refused state's heading.** `unlock.html`'s `#dmg-refused` heading is "Update Noctura to open this wallet" (the owner's words); "This version of Noctura can't open this wallet's data." is the first line of `#dmg-refused-body`, before "Update Noctura (in Chrome: …)". `damagedScreens.test.ts` pins the heading (its `h1`), the body's first element and the body's whole text; `damaged.spec.ts` the heading and the first line. M-refused-heading and M-refused-line (Step 6) turn it red.
- **Rev 2 — review M2: the short hold's negative waits on a real signal.** After the hold released at 700 ms the spec runs the page's clock on by the full second (a hold still counting would complete inside it) and asserts `#rd-hold` is still enabled — a confirmation disables it in the same tick, before the removal is sent — and only then reads storage. A storage read right after `mouse.up()` could land before an asynchronous removal and pass vacuously. M-e2e-short-hold (the hold confirming at 600 ms) is red at that line (`1 failed` at `toBeEnabled()`, `damaged.spec.ts:82`); on rev 1's spec the same mutant was red in this run at the immediate storage read (`:79`) — the removal happened to land first; nothing made it.
- **Rev 2 — review M3: step 5's reading clause is marked as implied.** `forgetDamaged`'s comment at steps 5 + 6 says the `vaultReading(again)` clause is implied by the digest compare (the same digest is the same text, so the same verdict as step 2) — belt and braces, not a check of its own; the review's `step5-pred` mutant is equivalent, and M-digest proves the compare.
- **Ruling: the confirmation is the hold-only path, implemented now; the seam for Task 3 is `mountDeleteConfirm` (`view/deleteConfirm.ts`)** — typed DELETE + #37's 1 s hold (pointer or Space / Enter held; Enter in the field nothing; a release before the second nothing), its word, hold and tick pinned to the popup's (`WORD`, `HOLD_MS`, `HOLD_TICK_MS`) and its copy to `DELETE_TEXT` by a test — why: a password-less removal must never exist in any commit without its friction, and the checkbox path then only adds a branch inside one module — cost if wrong: Task 3 reworks `deleteConfirm.ts`' internals, never `removeDamaged.ts` beyond the `parts` it passes.
- **Ruling: the removal is its own mode, `unlock.html?mode=remove-damaged`, reached from the unreadable state's [Remove damaged wallet]; it reads, judges and shows the value itself and reads no URL parameter** — why: the digest a removal names must be that of the value this screen read and showed (and saved), never one carried in from another page — cost if wrong: none (a navigation).
- **Ruling: the two damaged states are one screen (`screens/damaged.ts`, section `v-damaged`) that #9 and #1 show in place of their old damaged notice** — and #9's attempt that ends `damaged` reads again: unreadable / refused → that state; still a wallet (a seed that fails AES-GCM after the unwrap, §2.1 "out of the predicate") → today's notice and `COMMON.damagedHelp`, never a removal (test, M-out-of-predicate) — why: one rendering of each state, and §2.1's out-of-predicate case stays on today's path — cost if wrong: none. The other flows that answer `damaged` (#37's proof, #39, #40, #6, the accounts page) keep today's notice: the spec names only #9 and #1.
- **Ruling: `forgetDamaged` judges with Task 1's background `vaultReading(raw).kind === 'unreadable'` (the opener first, then the predicate), at step 2 and again at step 5** — the same verdict as bare `unreadableV1` for every value both openers refuse (Task 1's partition test), and the fail-safe one if they ever disagree — cost if wrong: none.
- **Ruling: `expectedDigest` is checked with the existing `REVISION` pattern (`^[0-9a-f]{64}$`)**, upper case and 63 / 65 hex are `malformed` before anything is read or locked — cost if wrong: none.
- **Ruling: the background's `busy` and the page's own compare at the click are one outcome, `changed`: the screen reads again and, when it still offers a removal, says "The stored data changed — check it again"** (the spec's `busy` line, verbatim, no period added — and `unlocked`'s "Noctura was unlocked meanwhile — try again" likewise); `not-unreadable` reads again and shows what it finds (refused → the refused state; a wallet → "A wallet already exists in this browser. Nothing was changed." + "Open the Noctura icon to use it."); `no-wallet` → set up — cost if wrong: copy.
- **Ruling: `send-open` shows #37's line (`RESTORE.sendOpen`, the same string as `DELETE_TEXT.sendOpen` — pinned by the screen test) with [Start again] and [Close this tab]; #37's second line, "The wallet has been locked. Nothing was deleted.", and its [Unlock] are not shown** — an unreadable vault cannot be unlocked — cost if wrong: one line of copy.
- **Ruling: after `forgotten` the handler restarts the poller when an open record is present (a send that passed its session check before step 3), as `vault.forgetWallet`'s handler** — tested at the store level ("a send appended … is kept") — cost if wrong: none.
- **Ruling: the digest helpers live in `src/shared/storedDigest.ts`, used by both the background and the vault page; every test computes the digest independently with `node:crypto`** (M-digest-text proves the tests do not follow the shared function) — cost if wrong: none.
- **Ruling: the address line uses #37's caption "This wallet's first account" above the lowest-index readable address (§2.2 Minor 5; `readableAddress`), "The address can't be read" in its place** — the caption is #37's copy; the spec gives only the address rule — cost if wrong: one caption.
- **Ruling (copy, flagged — undrawn, §9):** the removal screen's top-bar title is the spec's button name "Remove damaged wallet"; the hold's label, the typed field's eyebrow, placeholder, helpers, "Confirmation matched" and the caption are #37's (`DELETE_TEXT`); the save note sits under each Save; `v-damaged` has no top bar (it replaces #9's or #1's content). No new string beyond the spec and #37.
- **Deviation (stated): M-lock's control writes the session AFTER the lock** — spec §2.6 says "a session written straight into the session store before the click"; a session present before the click is locked by step 3 and the removal then proceeds (§2.5: "locks first … and refuses to remove while a session is back"), so dropping step 6's check changes nothing for it. The control therefore writes the session inside `lock()`'s own `sessionMutex` section (the hook on `session.clear`, as `forgetWallet.test.ts`' "an unlock landing after the lock"), queued ahead of step 6 — that is the session step 6 must see. The before-the-click session has its own row ("locked first (step 3), then the vault removed") and its own mutation (M-lock-first).
- **Deviation (stated): the brief's "wipes WALLET_DATA_KEYS + v1_pending in one step" is read as one call, in §2.4's order** — `v1_pending` is cleared at step 4 (in the one `updatePending` that also refuses an open send) and `WALLET_DATA_KEYS` + the caches at step 7, after the commit point, exactly as `forgetWallet`; every deletable row asserts that one `vault.forgetDamaged` leaves none of `v1_vault`, `WALLET_DATA_KEYS`, the caches or a settled `v1_pending` record (M-pending-kept, M-wipe, M-wipe-locked, M-caches), and that `v1_forbidden_until` is kept.
- **Deviation (stated): an E2E spec lands here, not only in Task 7** — `e2e/damaged.spec.ts` (Save read back from Playwright's download and compared byte for byte with the stored text, the filename from its sha256; the removal by the hold, a short hold removing nothing; the refused state and a wallet never removed; the shots for the visual check), and the CSP walk gains the two states and the removal with its hold (23 → 26 pages; the hold's `--vlt-hold` write is asserted present and no violation). Task 7 extends these.
- **Deviation (stated): Playwright ran the six vault-page specs, not the whole suite** — every spec that opens `unlock.html` (unlock, onboarding, settings, csp, visual-vault) and the new one; this task changes no popup, approval or background path a site can reach beyond the new vault-page-only message.
- **Visual check findings (fixed before the commit):** the Save link was underlined; the "a wallet already exists" notice drew [Close this tab] and [Cancel] both. Re-shot after the fixes.
- **Review Focus 1 (added at the plan's assembly, rev 1): two removal tabs confirming at once.** `forgetDamaged` runs inside `serial`, the mutex every `v1_vault` write takes, so the second request waits for the first and then reads no wallet — never two removals interleaved between their reads and their writes. The row "two removal tabs confirming at once …" sends two `vault.forgetDamaged` for the same digest together: `[{ok: true}, {ok: false, error: 'no-wallet'}]`, nothing left but the cleared `v1_pending`; M-serial (the function's body run outside `serial`) turns it red. The page answers `no-wallet` by going to set up (the ruling above).
- **For the next tasks:** Task 3 — add the checkbox to `mountDeleteConfirm` and its markup next to `#rd-hold`; `removeDamaged.ts` passes the new part and nothing else changes; the existing hold tests stay (both paths). Task 4 — `v1_phishing_phrase` in `WALLET_DATA_KEYS` is wiped by step 7 automatically; assert it through `vault.forgetDamaged` as well as `vault.forgetWallet`. Task 7 — `damaged.spec.ts` and its shots exist; the undrawn elements above go to the visual pass and the owner.
- **Dry run:** clone `dry/b1e1`, commit `da678b4` on Task 1's `e9b0c63`. Every run above — red (on `e9b0c63` with only the Step 1 test files), green, both builds, the gates, the sweep — is on the final commit; Playwright's six-spec run used the builds of an earlier amend (`2e96b49`), whose product code is the final commit's byte for byte (the later amends changed only tests: `e2e/csp.spec.ts`' three new pages, then run on their own normally and under `unshare -rn` on the same builds, and `damagedScreens.test.ts`' stray click made on an enabled button — the red run's file, which does not load on Task 1's tree, is otherwise the same). Both builds, `npm run csp` and `npm run gates` were run again on the final commit (exit 0). The sweep: `t2-logs/mutate.py` in the dry run's scratch — each mutant a fresh `git archive HEAD` copy, node_modules linked, removed after its run.

#### Notes for the executor (Task 2, continued) — the dry run's rulings, deviations and hand-over

- Rulings beyond the brief: the eleven in "Notes for the executor" above (the hold-only path with `mountDeleteConfirm` as Task 3's seam; the removal as its own mode reading its own value; one damaged screen for #9 and #1 and #9's re-read after an attempt's `damaged`; `vaultReading` opener-first at steps 2 and 5; the digest checked with `REVISION`; `busy` and the page's compare as one `changed`; `send-open` with #37's line and [Start again] [Close this tab]; the poller restart; the shared `storedDigest.ts` with independent test digests; #37's caption over the address; the copy taken from the spec and #37 only).
- Deviations from the brief, each stated above: M-lock's session written after the lock (the spec's "before the click" session is locked by step 3 and has its own row and mutation); "one step" read as one call in §2.4's order; an E2E spec and the CSP walk's three pages land here; Playwright on the six vault-page specs; 32 named mutations instead of the two the brief names (M-digest, M-lock — bold) and the hunt list's (a readable vault removed: M-readable; a refused vault: M-refused, M-removal-refused, M-refused-*; a replaced value: M-digest, M-page-compare; a session: M-lock, M-lock-first; an open send: M-send-open; a partial wipe: M-pending-kept, M-wipe, M-wipe-locked, M-caches; another sender: M-sender, M-page-only; the saved bytes: M-save-bytes, M-save-name, M-digest-text; the gate: M-save-blob, M-save-html with the control).
- The next task must know: the confirmation is `view/deleteConfirm.ts` — Task 3 adds the checkbox there and its markup beside `#rd-hold`; `removeDamaged.ts`' `onConfirmed` serves both paths. Task 4's phrase is wiped by `forgetDamaged`'s step 7 through `WALLET_DATA_KEYS`. Tests under happy-dom that need the fixtures use `vaultControls.ts`, which now reads them by path. A `vault.setKeys` test still needs a whole envelope (Task 1).


### Task 3: #37's checkbox and the shared confirmation rule — typed DELETE + (the 1 s hold, OR a native checkbox and one activation) on #37 in the popup (`DeleteWallet.tsx` through `HoldButton`'s new `once`) and on §2's removal screen in the vault page (`view/deleteConfirm.ts`, Task 2's seam, plain DOM); the proof in #37's vault tab untouched and still required; the button's accessible name says what one activation does; Enter in the field and keys on the checkbox confirm nothing; E2E for both pages normally and under `unshare -rn`

**Spec:** B1e §3 (the hold stays; the native checkbox with §3's label — directly ABOVE the button by the controller's ruling, a departure from §3's "under the button"; checked + DELETE → one activation — a click, or Space / Enter on the button; Enter in the field nothing — Minor 7; unchecked on every entry, cleared when the word stops matching, never remembered — Minor 8; on #37 the typed word and the vault tab's proof stay; on the removal the word + (hold or checkbox) is the gate; roles and labels), §2.2 (the removal screen's "#37's confirmation rule", E11), §9 (#37's checkbox and the removal's are undrawn — flagged); owner decisions E6 (D31), E11. **Not here:** the formal visual pass of every undrawn element and the spec's change list (Task 7), the phrase (Tasks 4–5).

**Where the hold gates today (found, stated).** #37 is two pages and only ONE of them has the hold: the popup's `DeleteWallet.tsx` (typed DELETE + `HoldButton`, whose only effect is `toProof` → `openPage('unlock.html?mode=delete')`); the vault tab's `screens/delete.ts` has no typed word and no hold — it is the proof (password or passkey → `deleteWallet`). The removal (`screens/removeDamaged.ts`) has its word and hold in `view/deleteConfirm.ts` (Task 2). So the rule lives in exactly one place per page: **the popup** — `DeleteWallet.tsx` computes `once = matched && understood` and `HoldButton` executes it (`once`: a click / Space / Enter calls `onHeld` once, a press starts no hold); **the vault page** — `way()` in `mountDeleteConfirm` (`null` | `'hold'` | `'once'`), which every entry (pointer, key, click) consults. `screens/delete.ts` is not changed: on #37 the checkbox only trades the hold, and the proof that follows is the same code, so "the checkbox without the proof deletes nothing" is held by the vault tab exactly as before — and the popup's `openPage` type (`ExtensionPage | ReauthPage | RemoveAccountPage`) cannot even name `?mode=remove-damaged` (M-p-target does not compile).

**Files:**
- Modify: `extension/src/app/ui/HoldButton.tsx` (`once`, `describedBy`), `extension/src/app/screens/DeleteWallet.tsx` (`DELETE_TEXT.understood`, the checkbox, `once`, the name and the hold copy), `extension/src/app/app.css` (`.app-understood`), `extension/src/unlock/view/deleteConfirm.ts` (`way()`, the checkbox, one activation), `extension/src/unlock/screens/removeDamaged.ts` (the three new parts, `onceName`), `extension/src/unlock/strings.ts` (`TYPED_DELETE.hold`, `TYPED_DELETE.understood`, `DAMAGED.remove`), `extension/src/unlock/unlock.css` (`.vlt-understood`), `extension/unlock.html` (`#rd-name`, `#rd-understood-row` / `#rd-understood`)
- Modify (tests): `extension/src/app/__tests__/DeleteWallet.test.tsx` (+12), `extension/src/unlock/__tests__/damagedScreens.test.ts` (+13), `extension/e2e/settings.spec.ts` (+1 test, with the tab order), `extension/e2e/damaged.spec.ts` (+1 test, with the tab order), `extension/e2e/visual-settings.spec.ts` (+1 shot `37c-understood`)

**Interfaces:**
- Consumes (Task 2): `mountDeleteConfirm`, `ConfirmParts`, `DeleteConfirm`, `CONFIRM_WORD` / `HOLD_MS` / `HOLD_TICK_MS` (`view/deleteConfirm.ts`); `mountRemoveDamaged` (its `onConfirmed` → `removeShown`, unchanged — both paths); the removal screen's ids (`rd-word`, `rd-hold`, `rd-fill`, `rd-count`, `rd-caption`, …); `TYPED_DELETE`, `DAMAGED`; in tests `removal()`, `press()`, `forgets()`, `digestOf`, `UNREADABLE`, `OTHER_UNREADABLE` (`damagedScreens.test.ts`), `harness`, `el`, `click`, `type`, `text`, `visible`, `unstyled` (`pageHarness.ts`). Existing popup: `HoldButton`, `DELETE_TEXT`, `WORD`, `HOLD_MS`, the popup harness (`renderInWallet`, `gate`, `platform.opened`).
- Produces (`extension/src/app/ui/HoldButton.tsx`):
  ```ts
  export function HoldButton(p: {label: string; heldLabel?: string; decimals?: number; holdMs: number; disabled: boolean; onHeld: () => void; onPressing?: (pressing: boolean) => void; once?: boolean; describedBy?: string; clock?: HoldClock}): JSX.Element;
  // once (default false): a click, or Space / Enter keydown (not a repeat) on the button, calls onHeld once (never again
  // on this mount); pointerdown and keys start no hold. describedBy → aria-describedby. #49 (ConnectedApps) unchanged.
  ```
- Produces (`extension/src/app/screens/DeleteWallet.tsx`): `DELETE_TEXT.understood = 'I understand this permanently removes this wallet from this browser'`.
- Produces (`extension/src/unlock/view/deleteConfirm.ts`):
  ```ts
  export interface ConfirmParts { field; eyebrow; matched; box; check; help; caption; button: HTMLButtonElement; name: HTMLElement; fill; count; understood: HTMLInputElement; understoodRow: HTMLElement; }
  export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allowed(): boolean; onConfirmed(): void; onPressing?(pressing: boolean): void; onceName: string}): DeleteConfirm;
  ```
  The three new parts are required (one caller); `onceName` is the button's words while the box is checked (`DAMAGED.remove` on the removal).
- Produces (`extension/src/unlock/strings.ts`): `TYPED_DELETE.hold = 'Hold to delete'`, `TYPED_DELETE.understood` (= `DELETE_TEXT.understood`, pinned by a test), `DAMAGED.remove = 'Remove damaged wallet'`.
- Produces (`extension/unlock.html`): `#rd-name` (the button's words, inside `#rd-hold`), `#rd-understood-row` (`label.s9-ack-row.vlt-understood`, directly before `#rd-hold` in the bar, hidden until the word matches) holding `input#rd-understood[type=checkbox]` and `span.lbl`.
- **Departure for the spec's rev 2.2 change list (Task 7 writes it):** §3 — "a native `<input type="checkbox">` under the button" → **directly above the button**, before it in DOM and tab order, on #37 and on the removal (controller ruling, D31: a screen-reader user reaches the box before the action it unlocks).
- **What later tasks rely on:** Task 7's E2E for "#37's checkbox path" exists (`settings.spec.ts` "15 · #37 without holding", `damaged.spec.ts` "the removal without holding"); its visual pass has the shots `37c-matched` (unchecked), `37c-understood` (popup, 412 × 600) and `damaged-remove-understood` (vault page, 412 × 916). The undrawn elements to show the owner: the checkbox row on both pages, the CTA's checked name ("Delete wallet" / "Remove damaged wallet"), the hold copy hidden while checked.

**The rule, stated once.** The box comes directly above the button, before it in tab order. A confirmation needs DELETE typed exactly. Then, unchecked: the 1 s hold (unchanged — pointer, or Space / Enter held). Checked: one activation of the button — a click, or a Space / Enter keydown on it — and a press starts no hold. Nothing else confirms: not a click unchecked, not a tapped key unchecked, not Enter in the field, not a key on the checkbox, not a checked box under a word that does not match (the rule reads the word at the activation, not only the clearing), and never twice per entry. The checkbox shows only while the word matches, is cleared whenever the word stops matching and on every entry (a reset empties the word), and is never stored. On #37 the activation only opens the vault tab, whose password / passkey proof is the gate it always was.

- [ ] **Step 1: Write the failing tests.**

Append to `extension/src/app/__tests__/DeleteWallet.test.tsx` (the diff against Task 2's tree):

```diff
diff --git a/extension/src/app/__tests__/DeleteWallet.test.tsx b/extension/src/app/__tests__/DeleteWallet.test.tsx
index 9575bf2..0cf09bf 100644
--- a/extension/src/app/__tests__/DeleteWallet.test.tsx
+++ b/extension/src/app/__tests__/DeleteWallet.test.tsx
@@ -663,3 +663,154 @@ describe('#37 delete wallet', () => {
     });
   });
 });
+
+// B1e §3 (E6, D31): the checkbox trades the hold for one activation; the typed DELETE and the vault tab's proof stay.
+describe('#37 without holding: the checkbox (B1e §3)', () => {
+  const UNDERSTOOD = 'I understand this permanently removes this wallet from this browser';
+  const box = () => screen.getByRole('checkbox', {name: UNDERSTOOD}) as HTMLInputElement;
+  const tick = () => fireEvent.click(box());
+
+  it('a native checkbox directly above the button (before it in tab order), labelled; absent until the word matches; unchecked on entry', async () => {
+    await shown();
+    expect(screen.queryByRole('checkbox')).toBeNull();
+    typeIn('DELETE');
+    const b = box();
+    expect([b.tagName, b.type, b.checked]).toEqual(['INPUT', 'checkbox', false]);
+    expect(b.closest('label')?.textContent).toBe(UNDERSTOOD);
+    // Directly above the button, in the bar: the box is reached before the action it unlocks (controller ruling, D31).
+    expect(b.closest('.sticky-bar')).not.toBeNull();
+    expect(b.closest('label')?.nextElementSibling).toBe(holdCta());
+    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
+  });
+
+  it('the hold alone still opens the proof: unchecked, a click opens nothing; the full second does', async () => {
+    const w = await shown();
+    typeIn('DELETE');
+    fireEvent.click(holdCta());
+    expect(w.platform.opened).toEqual([]);
+    fireEvent.pointerDown(holdCta(), {button: 0});
+    w.advance(1_020);
+    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
+  });
+
+  it('checkbox + one click opens the proof at once — no hold, and no delete from the popup: the proof is still asked for', async () => {
+    const h = hold('never');
+    const w = await shown({gate: h.gate});
+    typeIn('DELETE');
+    tick();
+    expect(box().checked).toBe(true);
+    fireEvent.click(holdCta());
+    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
+    expect(w.platform.closed).toBe(1);
+    expect(field().value).toBe('');
+    await settle();
+    // The popup only opens the vault tab: no forget message of any kind, and the vault untouched.
+    expect(h.count('vault.forgetWallet') + h.count('vault.forgetDamaged')).toBe(0);
+    expect(await w.ext.local.get('v1_vault')).toEqual(ENV);
+  });
+
+  it.each([' ', 'Enter'])('checkbox + one %j on the button (pressed and released) opens the proof', async key => {
+    const w = await shown();
+    typeIn('DELETE');
+    tick();
+    const b = holdCta();
+    fireEvent.keyDown(b, {key});
+    fireEvent.keyUp(b, {key});
+    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
+  });
+
+  it('one activation is one call: a second click or key after it calls nothing more (HoldButton `once`)', async () => {
+    let held = 0;
+    render(<HoldButton label="Delete wallet" holdMs={1_000} disabled={false} once onHeld={() => void (held += 1)} />);
+    const b = screen.getByRole('button', {name: 'Delete wallet'}) as HTMLButtonElement;
+    fireEvent.click(b);
+    fireEvent.click(b);
+    fireEvent.keyDown(b, {key: 'Enter'});
+    fireEvent.keyDown(b, {key: ' '});
+    expect(held).toBe(1);
+  });
+
+  it('neither the hold nor the checkbox: a click, a tapped Space and a tapped Enter open nothing', async () => {
+    const w = await shown();
+    typeIn('DELETE');
+    const b = holdCta();
+    fireEvent.click(b);
+    for (const key of [' ', 'Enter']) {
+      fireEvent.keyDown(b, {key});
+      fireEvent.keyUp(b, {key});
+    }
+    w.advance(1_500);
+    expect(w.platform.opened).toEqual([]);
+  });
+
+  it('the checkbox without the word: the word edited clears it, and typed again it is unchecked — a click opens nothing', async () => {
+    const w = await shown();
+    typeIn('DELETE');
+    tick();
+    typeIn('DELET');
+    expect(screen.queryByRole('checkbox')).toBeNull();
+    typeIn('DELETE');
+    expect(box().checked).toBe(false);
+    fireEvent.click(holdCta());
+    expect(w.platform.opened).toEqual([]);
+  });
+
+  it('unchecking after checking restores the hold: its name and caption back, a click opens nothing, the hold does', async () => {
+    const w = await shown();
+    typeIn('DELETE');
+    tick();
+    tick();
+    expect(box().checked).toBe(false);
+    expect(holdCta().textContent).toBe('Hold to delete');
+    expect(screen.getByText('Hold the red button to delete · release to cancel')).toBeTruthy();
+    fireEvent.click(holdCta());
+    fireEvent.keyDown(holdCta(), {key: 'Enter'});
+    fireEvent.keyUp(holdCta(), {key: 'Enter'});
+    expect(w.platform.opened).toEqual([]);
+    fireEvent.pointerDown(holdCta(), {button: 0});
+    w.advance(1_020);
+    expect(w.platform.opened).toEqual(['unlock.html?mode=delete']);
+  });
+
+  it("the button's name says what happens: \"Hold to delete\", checked \"Delete wallet\"; both described by \"Confirmation opens in a new tab.\"; the hold's instructions go when checked", async () => {
+    await shown();
+    typeIn('DELETE');
+    const described = () => document.getElementById(holdCta().getAttribute('aria-describedby') ?? '')?.textContent;
+    expect(screen.getByRole('button', {name: 'Hold to delete'})).toBe(holdCta());
+    expect(described()).toBe('Confirmation opens in a new tab.');
+    tick();
+    expect(screen.getByRole('button', {name: 'Delete wallet'})).toBe(holdCta());
+    expect(holdCta().hasAttribute('aria-label')).toBe(false);
+    expect(described()).toBe('Confirmation opens in a new tab.');
+    expect(screen.queryByText('Hold the red button to delete · release to cancel')).toBeNull();
+    expect(screen.queryByText('Hold the red button below — release to cancel, hold for the full second to delete.')).toBeNull();
+    expect(document.querySelector('.app-delete-card .noc-body')?.textContent).toBe('This removes all encrypted keys and local data from this browser.');
+  });
+
+  it('keys on the checkbox and in the field open nothing: Space and Enter on the checkbox, Enter in the DELETE field', async () => {
+    const w = await shown();
+    typeIn('DELETE');
+    tick();
+    for (const key of [' ', 'Enter']) {
+      fireEvent.keyDown(box(), {key});
+      fireEvent.keyUp(box(), {key});
+    }
+    fireEvent.keyDown(field(), {key: 'Enter'});
+    fireEvent.keyUp(field(), {key: 'Enter'});
+    w.advance(1_500);
+    expect(w.platform.opened).toEqual([]);
+  });
+
+  it('a send open: checked, the button stays disabled — with `disabled` lifted a click opens nothing', async () => {
+    const open = pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
+    const w = await shown({before: async ext => ext.local.set(PENDING_KEY, [open])});
+    await sendOpenBanner();
+    typeIn('DELETE');
+    tick();
+    expect(holdCta().disabled).toBe(true);
+    holdCta().disabled = false;
+    fireEvent.click(holdCta());
+    fireEvent.keyDown(holdCta(), {key: 'Enter'});
+    expect(w.platform.opened).toEqual([]);
+  });
+});
```

Modify `extension/src/unlock/__tests__/damagedScreens.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/damagedScreens.test.ts b/extension/src/unlock/__tests__/damagedScreens.test.ts
index c074709..72b5c50 100644
--- a/extension/src/unlock/__tests__/damagedScreens.test.ts
+++ b/extension/src/unlock/__tests__/damagedScreens.test.ts
@@ -14,8 +14,8 @@ import {mountDamaged} from '../screens/damaged';
 import {mountRemoveDamaged, readableAddress} from '../screens/removeDamaged';
 import {mountUnlock} from '../screens/unlock';
 import {mountWelcome} from '../screens/welcome';
-import {TYPED_DELETE} from '../strings';
-import {CONFIRM_WORD, HOLD_MS, HOLD_TICK_MS} from '../view/deleteConfirm';
+import {DAMAGED, TYPED_DELETE} from '../strings';
+import {CONFIRM_WORD, HOLD_MS, HOLD_TICK_MS, mountDeleteConfirm, type ConfirmParts} from '../view/deleteConfirm';
 import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';
 
 // B1e §2.2–§2.4 against the REAL background: #9's and #1's damaged states, "Save the damaged data", and the removal.
@@ -382,11 +382,197 @@ describe('#37’s words and hold, as the popup has them (E11)', () => {
   it('the word, the hold and its tick are the popup’s; the copy is DELETE_TEXT’s', () => {
     expect([CONFIRM_WORD, HOLD_MS, HOLD_TICK_MS]).toEqual([WORD, POPUP_HOLD_MS, POPUP_TICK_MS]);
     expect([TYPED_DELETE.caseSensitive, TYPED_DELETE.notAPrefix, TYPED_DELETE.keepGoing(3)]).toEqual([DELETE_TEXT.caseSensitive, DELETE_TEXT.notAPrefix, DELETE_TEXT.keepGoing(3)]);
+    expect([TYPED_DELETE.hold, TYPED_DELETE.understood]).toEqual([DELETE_TEXT.hold, DELETE_TEXT.understood]);
     loadPage();
     expect(el<HTMLInputElement>('rd-word').placeholder).toBe(DELETE_TEXT.placeholder);
     expect(text(el('rd-eyebrow'))).toBe(`${DELETE_TEXT.typeLead}${DELETE_TEXT.typeWord}${DELETE_TEXT.typeTail}`);
     expect(text(el('rd-matched'))).toBe(DELETE_TEXT.matched);
     expect(text(el('rd-caption'))).toBe(DELETE_TEXT.holdCaption);
     expect(text(el('rd-hold'))).toBe(DELETE_TEXT.hold);
+    expect(text(el('rd-understood-row'))).toBe(DELETE_TEXT.understood);
+  });
+});
+
+// B1e §3 (E11): the removal's confirmation is #37's — typed DELETE + (the hold, or the checkbox and one activation).
+describe('the removal without holding: the checkbox (B1e §3, E11)', () => {
+  const understood = () => el<HTMLInputElement>('rd-understood');
+  const tick = () => understood().click();
+  const key = (target: HTMLElement, k: string) => {
+    target.dispatchEvent(new KeyboardEvent('keydown', {key: k, bubbles: true, cancelable: true}));
+    target.dispatchEvent(new KeyboardEvent('keyup', {key: k, bubbles: true, cancelable: true}));
+  };
+  /** Lets every answer in flight land: the page's gate idle and the background's queue drained. */
+  const idle = async (h: Harness) => {
+    await h.until(() => !h.deps.gate.isBusy());
+    await new Promise(r => setTimeout(r, 0));
+    await h.until(() => !h.deps.gate.isBusy());
+  };
+
+  it('a native checkbox directly above the button (before it in tab order), labelled with §3’s words; hidden and unchecked until the word matches', async () => {
+    await removal(UNREADABLE);
+    expect([understood().tagName, understood().type]).toEqual(['INPUT', 'checkbox']);
+    expect(understood().labels?.length).toBe(1);
+    expect(text(understood().labels?.[0] as HTMLElement)).toBe(DELETE_TEXT.understood);
+    // Directly above the button: the box is reached before the action it unlocks (controller ruling, D31).
+    expect(el('rd-understood-row').nextElementSibling).toBe(el('rd-hold'));
+    expect(visible(understood())).toBe(false);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    expect(visible(understood())).toBe(true);
+    expect(understood().checked).toBe(false);
+    expect(unstyled('v-remove-damaged')).toEqual([]);
+  });
+
+  it('the hold alone still removes: unchecked, a click removes nothing; the full second does', async () => {
+    const h = await removal(UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    click(el('rd-hold'));
+    await idle(h);
+    expect(forgets(h)).toEqual([]);
+    press();
+    h.timers.advance(HOLD_MS + HOLD_TICK_MS);
+    await h.until(() => h.went.length > 0);
+    expect(forgets(h)).toEqual([{type: 'vault.forgetDamaged', expectedDigest: digestOf(UNREADABLE)}]);
+  });
+
+  it('checkbox + one click removes it at once: one forgetDamaged, the wallet data gone, then #1 — no hold, no tick', async () => {
+    const h = await removal(UNREADABLE);
+    for (const k of WALLET_DATA_KEYS) await h.ext.local.set(k, ['x']);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    tick();
+    expect(understood().checked).toBe(true);
+    click(el('rd-hold'));
+    await h.until(() => h.went.length > 0);
+    expect(forgets(h)).toEqual([{type: 'vault.forgetDamaged', expectedDigest: digestOf(UNREADABLE)}]);
+    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
+    for (const k of WALLET_DATA_KEYS) expect(await h.ext.local.get(k)).toBeUndefined();
+    expect(h.went).toEqual(['unlock.html?mode=welcome']);
+  });
+
+  it.each([' ', 'Enter'])('checkbox + one %j on the button (pressed and released) removes it', async k => {
+    const h = await removal(UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    tick();
+    key(el('rd-hold'), k);
+    await h.until(() => h.went.length > 0);
+    expect(forgets(h)).toHaveLength(1);
+  });
+
+  it('one activation is one removal: a second click and a key after it send nothing more', async () => {
+    const h = await removal(UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    tick();
+    click(el('rd-hold'));
+    click(el('rd-hold'));
+    key(el('rd-hold'), 'Enter');
+    await h.until(() => h.went.length > 0);
+    expect(forgets(h)).toHaveLength(1);
+  });
+
+  it('one activation is one confirmation in mountDeleteConfirm itself (not only the page gate behind it)', async () => {
+    const h = await harness({vault: UNREADABLE});
+    let confirmed = 0;
+    const ids = {field: 'rd-word', eyebrow: 'rd-eyebrow', matched: 'rd-matched', box: 'rd-box', check: 'rd-check', help: 'rd-help', caption: 'rd-caption', button: 'rd-hold', name: 'rd-name', fill: 'rd-fill', count: 'rd-count', understood: 'rd-understood', understoodRow: 'rd-understood-row'};
+    const parts = Object.fromEntries(Object.entries(ids).map(([k, id]) => [k, el(id)])) as unknown as ConfirmParts;
+    const confirm = mountDeleteConfirm(parts, h.timers, {allowed: () => true, onConfirmed: () => void (confirmed += 1), onceName: DAMAGED.remove});
+    confirm.reset();
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    tick();
+    click(el('rd-hold'));
+    el<HTMLButtonElement>('rd-hold').disabled = false;
+    click(el('rd-hold'));
+    key(el('rd-hold'), 'Enter');
+    expect(confirmed).toBe(1);
+    // reset() arms it again: the word and the box asked for anew.
+    confirm.reset();
+    click(el('rd-hold'));
+    expect(confirmed).toBe(1);
+  });
+
+  it('neither the hold nor the checkbox: a click, a tapped Space and a tapped Enter remove nothing', async () => {
+    const h = await removal(UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    click(el('rd-hold'));
+    key(el('rd-hold'), ' ');
+    key(el('rd-hold'), 'Enter');
+    h.timers.advance(HOLD_MS * 2);
+    await idle(h);
+    expect(forgets(h)).toEqual([]);
+    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
+  });
+
+  it('the checkbox without the word: the word edited clears it, typed again it is unchecked; checked under a wrong word a click removes nothing', async () => {
+    const h = await removal(UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    tick();
+    type(el<HTMLInputElement>('rd-word'), 'DELET');
+    expect([understood().checked, visible(understood())]).toEqual([false, false]);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    expect(understood().checked).toBe(false);
+    click(el('rd-hold'));
+    await idle(h);
+    expect(forgets(h)).toEqual([]);
+    // The rule, not only the clearing: a box checked by any other means under a word that does not match removes nothing.
+    for (const typed of ['DELET', 'delete', 'DELETE ']) {
+      type(el<HTMLInputElement>('rd-word'), typed);
+      understood().checked = true;
+      el<HTMLButtonElement>('rd-hold').disabled = false;
+      click(el('rd-hold'));
+      key(el('rd-hold'), 'Enter');
+    }
+    await idle(h);
+    expect(forgets(h)).toEqual([]);
+    expect(await h.ext.local.get(VAULT_KEY)).toEqual(UNREADABLE);
+  });
+
+  it('unchecking after checking restores the hold: its name and caption back, a click removes nothing, the hold does', async () => {
+    const h = await removal(UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    tick();
+    tick();
+    expect(understood().checked).toBe(false);
+    expect(text(el('rd-hold'))).toBe('Hold to delete');
+    expect(visible(el('rd-caption'))).toBe(true);
+    click(el('rd-hold'));
+    key(el('rd-hold'), 'Enter');
+    await idle(h);
+    expect(forgets(h)).toEqual([]);
+    press();
+    h.timers.advance(HOLD_MS + HOLD_TICK_MS);
+    await h.until(() => h.went.length > 0);
+    expect(forgets(h)).toHaveLength(1);
+  });
+
+  it("the button's name says what happens: \"Hold to delete\", checked \"Remove damaged wallet\"; the hold's caption goes when checked", async () => {
+    await removal(UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    expect(text(el('rd-hold'))).toBe('Hold to delete');
+    expect(visible(el('rd-caption'))).toBe(true);
+    tick();
+    expect(text(el('rd-hold'))).toBe('Remove damaged wallet');
+    expect(el('rd-hold').hasAttribute('aria-label')).toBe(false);
+    expect(visible(el('rd-caption'))).toBe(false);
+  });
+
+  it('keys on the checkbox and in the field remove nothing: Space and Enter on the checkbox, Enter in the DELETE field', async () => {
+    const h = await removal(UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    tick();
+    key(understood(), ' ');
+    key(understood(), 'Enter');
+    key(el('rd-word'), 'Enter');
+    h.timers.advance(HOLD_MS * 2);
+    await idle(h);
+    expect(forgets(h)).toEqual([]);
+  });
+
+  it('every entry to the screen starts unchecked: after a `changed` re-read the word is empty and the box clear', async () => {
+    const h = await removal(UNREADABLE);
+    await h.ext.local.set(VAULT_KEY, OTHER_UNREADABLE);
+    type(el<HTMLInputElement>('rd-word'), 'DELETE');
+    tick();
+    click(el('rd-hold'));
+    await h.until(() => text(el('rd-helper')) === 'The stored data changed — check it again');
+    expect(forgets(h)).toEqual([]);
+    expect([el<HTMLInputElement>('rd-word').value, understood().checked, visible(understood())]).toEqual(['', false, false]);
   });
 });
```

- [ ] **Step 2: Run — red.**

Run (in `extension/`): `npx vitest run src/app/__tests__/DeleteWallet.test.tsx src/unlock/__tests__/damagedScreens.test.ts`
Expected on Task 2's tree: `Test Files  2 failed (2)` · `Tests  22 failed | 64 passed (86)` — `npx tsc --noEmit` exits 2 (the new `once` prop, the `ConfirmParts` fields, `onceName`, `DAMAGED.remove`, `TYPED_DELETE.hold` / `understood` unknown; vitest runs regardless). The failures: every positive and every name / label row (no checkbox exists), and Task 2's "#37's words and hold" row (it now pins `TYPED_DELETE.hold` / `understood` and `#rd-understood-row`'s text); the rows that pass already are the negative ones on today's code — the hold alone (both pages), "neither" (both pages) — as they should: the checkbox must not loosen them. (Observed: the final test files run on Task 2's tree in a scratch copy, `TZ=UTC` — see the Send.test note in Step 4.)

- [ ] **Step 3: Implement.**

`extension/src/app/ui/HoldButton.tsx`:

```diff
diff --git a/extension/src/app/ui/HoldButton.tsx b/extension/src/app/ui/HoldButton.tsx
index 3ec5ec4..2ca279d 100644
--- a/extension/src/app/ui/HoldButton.tsx
+++ b/extension/src/app/ui/HoldButton.tsx
@@ -26,6 +26,8 @@ export const HOLD_TICK_MS = 30;
  * restarts nor doubles it). While held the label counts the seconds left with `decimals` places — #37's one ("Hold to delete · 0.4 s"),
  * #49's two;
  * `prefers-reduced-motion` hides the fill (app.css), the count still runs.
+ * `once` (B1e §3: #37's checkbox checked): one activation — a click, or Space / Enter pressed on the button — calls
+ * `onHeld` at once, and a press starts no hold; once is once, as a completed hold. Turned off, the hold is back.
  */
 export function HoldButton({
   label,
@@ -35,6 +37,8 @@ export function HoldButton({
   disabled,
   onHeld,
   onPressing,
+  once = false,
+  describedBy,
   clock = realClock,
 }: {
   label: string;
@@ -46,6 +50,8 @@ export function HoldButton({
   disabled: boolean;
   onHeld: () => void;
   onPressing?: (pressing: boolean) => void;
+  once?: boolean;
+  describedBy?: string;
   clock?: HoldClock;
 }) {
   const [share, setShare] = useState<number | null>(null);
@@ -58,8 +64,8 @@ export function HoldButton({
    */
   const pressId = useRef(0);
   const presses = useRef(0);
-  const latest = useRef({onHeld, onPressing, disabled});
-  latest.current = {onHeld, onPressing, disabled};
+  const latest = useRef({onHeld, onPressing, disabled, once});
+  latest.current = {onHeld, onPressing, disabled, once};
 
   const release = () => {
     pressId.current = 0;
@@ -70,7 +76,7 @@ export function HoldButton({
     latest.current.onPressing?.(false);
   };
   const press = () => {
-    if (latest.current.disabled || done.current || stop.current !== null) return;
+    if (latest.current.disabled || latest.current.once || done.current || stop.current !== null) return;
     const started = clock.now();
     presses.current += 1;
     const id = presses.current;
@@ -90,6 +96,12 @@ export function HoldButton({
       latest.current.onHeld();
     });
   };
+  const activate = () => {
+    if (latest.current.disabled || !latest.current.once || done.current) return;
+    release();
+    done.current = true;
+    latest.current.onHeld();
+  };
   // Unmounted mid-press: the tick stops, and the owner hears the press ended (fix round 1, M3: #37's Cancel is not left
   // disabled when the hold goes while pressed).
   useEffect(
@@ -109,7 +121,9 @@ export function HoldButton({
   const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
     if (e.key !== ' ' && e.key !== 'Enter') return;
     e.preventDefault();
-    if (!e.repeat) press();
+    if (e.repeat) return;
+    if (latest.current.once) activate();
+    else press();
   };
   const onKeyUp = (e: KeyboardEvent<HTMLButtonElement>) => {
     if (e.key === ' ' || e.key === 'Enter') release();
@@ -124,6 +138,8 @@ export function HoldButton({
       type="button"
       className="btn btn-primary s7-longpress app-hold"
       disabled={disabled}
+      aria-describedby={describedBy}
+      onClick={activate}
       onPointerDown={onPointerDown}
       onPointerUp={release}
       onPointerLeave={release}
```

`extension/src/app/screens/DeleteWallet.tsx`:

```diff
diff --git a/extension/src/app/screens/DeleteWallet.tsx b/extension/src/app/screens/DeleteWallet.tsx
index c402d23..ec3fc9b 100644
--- a/extension/src/app/screens/DeleteWallet.tsx
+++ b/extension/src/app/screens/DeleteWallet.tsx
@@ -1,4 +1,4 @@
-import {useEffect, useRef, useState} from 'react';
+import {useEffect, useId, useRef, useState} from 'react';
 import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
 import {PENDING_POLL_MS, useWallet} from '../WalletContext';
 import {FRESH_ROWS, useAccountBalances} from '../useAccountBalances';
@@ -33,6 +33,8 @@ export const DELETE_TEXT = {
   holdCaption: 'Hold the red button to delete · release to cancel',
   hold: 'Hold to delete',
   opensTab: 'Confirmation opens in a new tab.',
+  /** B1e §3 (E6, D31): the accessible alternative to the hold. */
+  understood: 'I understand this permanently removes this wallet from this browser',
   cancel: 'Cancel',
   funded: 'This wallet holds funds',
   fundedTail: 'They stay on Solana. Only your recovery phrase reaches them after this.',
@@ -77,16 +79,23 @@ function boldOdd(parts: readonly string[]) {
  * account's address (lowest index) is the one the delete page will show (C17). Cancel and Back leave once, with the typed
  * text wiped; the hold is its own rule-6 lock (HoldButton). Every await is guarded: an answer that lands after the
  * screen went or after a lock sets nothing and schedules nothing.
+ * B1e §3 (E6, D31): directly above the button (the controller's ruling; §3 says "under"), a native checkbox trades the hold for one activation (HoldButton `once`) — the
+ * typed word still first (the checkbox exists only while it matches, and clears whenever it stops matching), the
+ * vault tab's proof still after. Unchecked on every entry; never remembered.
  */
 export function DeleteWallet({onBack, clock = realClock}: {onBack: () => void; clock?: HoldClock}) {
   const m = useWallet();
   const accounts = m.wallet?.accounts ?? [];
   const {rows, done, failed, reads} = useAccountBalances(accounts);
   const [typed, setTyped] = useState('');
+  const [understood, setUnderstood] = useState(false);
   const [pressing, setPressing] = useState(false);
+  const opensTabId = useId();
   /** The screen's own wallet.pending read (null until it answers). */
   const [own, setOwn] = useState<Pending[] | null>(null);
   const matched = typed === WORD;
+  /** B1e §3: the word typed and the checkbox checked — one activation, no hold. */
+  const once = matched && understood;
   const partial = typed !== '' && !matched;
   const prefix = WORD.startsWith(typed);
   const first = firstAccount(accounts);
@@ -124,16 +133,21 @@ export function DeleteWallet({onBack, clock = realClock}: {onBack: () => void; c
   // rows than it should have — stale cached zeros are not a check), or an account beyond the first 10 has no cache.
   const unknown = done && (failed || reads.size < Math.min(accounts.length, FRESH_ROWS) || accounts.some(a => rows[a.publicKey] === undefined));
 
+  /** The typed word; the checkbox goes with a word that no longer matches (Minor 8). */
+  const word = (v: string) => {
+    setTyped(v);
+    if (v !== WORD) setUnderstood(false);
+  };
   /** Rule 6 for leaving: Back and Cancel leave once (a second pop would leave the caller too). */
   const left = useRef(false);
   const leave = () => {
     if (left.current) return;
     left.current = true;
-    setTyped('');
+    word('');
     onBack();
   };
   const toProof = () => {
-    setTyped('');
+    word('');
     m.platform.openPage('unlock.html?mode=delete');
     if (m.surface === 'popup') m.platform.closeWindow();
   };
@@ -149,7 +163,7 @@ export function DeleteWallet({onBack, clock = realClock}: {onBack: () => void; c
             </span>
             <h2 className="noc-h2 noc-danger">{DELETE_TEXT.heading}</h2>
           </div>
-          <p className="noc-body">{matched ? DELETE_TEXT.holdBody : boldOdd(DELETE_TEXT.body)}</p>
+          <p className="noc-body">{matched && !once ? DELETE_TEXT.holdBody : boldOdd(DELETE_TEXT.body)}</p>
           {typed === '' ? (
             <ul className="app-delete-bullets">
               {[DELETE_TEXT.bulletAssets, DELETE_TEXT.bulletErased].map(parts => (
@@ -206,7 +220,7 @@ export function DeleteWallet({onBack, clock = realClock}: {onBack: () => void; c
               autoCapitalize="characters"
               autoComplete="off"
               spellCheck={false}
-              onChange={e => setTyped(e.target.value)}
+              onChange={e => word(e.target.value)}
             />
             {matched ? (
               <span className="noc-success">
@@ -222,18 +236,38 @@ export function DeleteWallet({onBack, clock = realClock}: {onBack: () => void; c
           ) : null}
           {partial && !prefix ? <p className="noc-caption noc-danger app-delete-help">{DELETE_TEXT.notAPrefix}</p> : null}
         </div>
-        {matched ? <p className="noc-caption app-dim app-center-text">{DELETE_TEXT.holdCaption}</p> : null}
+        {matched && !once ? <p className="noc-caption app-dim app-center-text">{DELETE_TEXT.holdCaption}</p> : null}
       </div>
       <div className="sticky-bar">
+        {/* Controller ruling (B1e-1 Task 3): the box directly above the CTA it unlocks — reached first in reading and tab order. */}
+        {matched ? (
+          <label className="s9-ack-row app-understood">
+            <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} />
+            <span className="lbl">{DELETE_TEXT.understood}</span>
+          </label>
+        ) : null}
         {matched ? (
-          <HoldButton label={DELETE_TEXT.hold} holdMs={HOLD_MS} disabled={sendOpen} onHeld={toProof} onPressing={setPressing} clock={clock} />
+          <HoldButton
+            label={once ? DELETE_TEXT.title : DELETE_TEXT.hold}
+            holdMs={HOLD_MS}
+            disabled={sendOpen}
+            once={once}
+            describedBy={opensTabId}
+            onHeld={toProof}
+            onPressing={setPressing}
+            clock={clock}
+          />
         ) : (
           <button type="button" className="btn btn-primary app-delete-gated" disabled>
             <ExtIcon name="trash" size={18} />
             {DELETE_TEXT.title}
           </button>
         )}
-        {matched ? <p className="noc-caption app-dim app-center-text">{DELETE_TEXT.opensTab}</p> : null}
+        {matched ? (
+          <p id={opensTabId} className="noc-caption app-dim app-center-text">
+            {DELETE_TEXT.opensTab}
+          </p>
+        ) : null}
         <LockedButton className="btn btn-secondary" disabled={pressing} onPress={leave}>
           {DELETE_TEXT.cancel}
         </LockedButton>
```

`extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 702863a..209dced 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -1121,6 +1121,18 @@ a.btn {
     display: none;
   }
 }
+/* B1e §3 (undrawn, §9): #37's checkbox directly above the hold — #47's ack row (.s9-ack-row, its grid and label) around a native
+   checkbox in the row's 20 px box column, the accent its checked colour. */
+.s9-ack-row.app-understood {
+  margin-top: 0;
+}
+.app-understood input {
+  width: 20px;
+  height: 20px;
+  margin: 0;
+  accent-color: var(--accent);
+  cursor: pointer;
+}
 /* 37c: Cancel at the design's .45 while the CTA is pressed. */
 .app-delete .sticky-bar .btn-secondary:disabled {
   opacity: 0.45;
```

`extension/src/unlock/view/deleteConfirm.ts`:

```diff
diff --git a/extension/src/unlock/view/deleteConfirm.ts b/extension/src/unlock/view/deleteConfirm.ts
index 5c92766..2fd207b 100644
--- a/extension/src/unlock/view/deleteConfirm.ts
+++ b/extension/src/unlock/view/deleteConfirm.ts
@@ -7,7 +7,7 @@ export const CONFIRM_WORD = 'DELETE';
 export const HOLD_MS = 1_000;
 export const HOLD_TICK_MS = 30;
 
-/** The elements of one typed-word-and-hold confirmation in unlock.html. */
+/** The elements of one typed-word-and-hold-or-checkbox confirmation in unlock.html. */
 export interface ConfirmParts {
   field: HTMLInputElement;
   /** The "Type DELETE to confirm" eyebrow, and the "Confirmation matched" one that replaces it. */
@@ -18,8 +18,13 @@ export interface ConfirmParts {
   help: HTMLElement;
   caption: HTMLElement;
   button: HTMLButtonElement;
+  /** The button's words: its accessible name — the hold's, or `onceName` while the checkbox is checked. */
+  name: HTMLElement;
   fill: HTMLElement;
   count: HTMLElement;
+  /** B1e §3: the native checkbox directly above the button (before it in tab order), and its labelled row. */
+  understood: HTMLInputElement;
+  understoodRow: HTMLElement;
 }
 
 export interface DeleteConfirm {
@@ -40,9 +45,11 @@ function holdShare(share: number): string {
  * button (repeats ignored); pointer up, leave or cancel, keyup and blur release it, and a release before HOLD_MS confirms
  * nothing. Enter in the field activates nothing. `onConfirmed` runs once per completed hold, and never again until
  * `reset()`. `allowed()` is the screen's own phase and the page's gate: while it is false the button refuses a press.
- * B1e §3's checkbox path (Task 3) joins here, beside the hold.
+ * B1e §3 (E6, E11): or, with the checkbox above the button checked, ONE activation — a click, or Space / Enter pressed on
+ * the button — confirms, and a press starts no hold. The checkbox shows only while the word matches, clears whenever
+ * it stops matching and on every `reset()`; unchecked, the hold is the way again. `way()` is the rule, in one place.
  */
-export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allowed(): boolean; onConfirmed(): void; onPressing?(pressing: boolean): void}): DeleteConfirm {
+export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allowed(): boolean; onConfirmed(): void; onPressing?(pressing: boolean): void; onceName: string}): DeleteConfirm {
   let stop: (() => void) | null = null;
   let done = false;
   /** The press in progress (0: none); a tick of a press that already ended completes nothing (HoldButton's M4). */
@@ -50,6 +57,8 @@ export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allo
   let presses = 0;
 
   const matched = () => parts.field.value === CONFIRM_WORD;
+  /** B1e §3: DELETE typed exactly, and then the hold — or the checkbox and one activation. Null: neither may confirm. */
+  const way = (): 'hold' | 'once' | null => (!matched() || done || !o.allowed() ? null : parts.understood.checked ? 'once' : 'hold');
   const paintHold = (share: number | null) => {
     parts.fill.style.setProperty('--vlt-hold', holdShare(share ?? 0));
     const left = share === null ? null : Math.max(0, HOLD_MS - share * HOLD_MS) / 1000;
@@ -72,7 +81,6 @@ export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allo
     shown(parts.check, ok);
     parts.box.classList.toggle('vlt-pw-ok', ok);
     parts.box.classList.toggle('vlt-pw-active', partial);
-    shown(parts.caption, ok);
     if (typed === '') {
       setText(parts.help, TYPED_DELETE.caseSensitive);
       parts.help.classList.remove('vlt-danger');
@@ -84,12 +92,17 @@ export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allo
       parts.help.classList.add('vlt-danger');
     }
     shown(parts.help, !ok);
-    const armed = ok && !done && o.allowed();
-    if (!armed && stop !== null) release();
-    parts.button.disabled = !armed;
+    if (!ok) parts.understood.checked = false;
+    const checked = parts.understood.checked;
+    shown(parts.understoodRow, ok);
+    setText(parts.name, checked ? o.onceName : TYPED_DELETE.hold);
+    shown(parts.caption, ok && !checked);
+    const now = way();
+    if (now !== 'hold' && stop !== null) release();
+    parts.button.disabled = now === null;
   };
   const press = () => {
-    if (!matched() || done || stop !== null || !o.allowed()) return;
+    if (way() !== 'hold' || stop !== null) return;
     const started = timers.now();
     presses += 1;
     const id = presses;
@@ -111,8 +124,17 @@ export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allo
     }, HOLD_TICK_MS);
     stop = () => timers.clearInterval(interval);
   };
+  const once = () => {
+    if (way() !== 'once') return;
+    release();
+    done = true;
+    render();
+    o.onConfirmed();
+  };
 
   parts.field.addEventListener('input', render);
+  parts.understood.addEventListener('change', render);
+  parts.button.addEventListener('click', once);
   parts.button.addEventListener('pointerdown', e => {
     if (e.button === 0) press();
   });
@@ -120,7 +142,9 @@ export function mountDeleteConfirm(parts: ConfirmParts, timers: Timers, o: {allo
   parts.button.addEventListener('keydown', e => {
     if (e.key !== ' ' && e.key !== 'Enter') return;
     e.preventDefault();
-    if (!e.repeat) press();
+    if (e.repeat) return;
+    if (way() === 'once') once();
+    else press();
   });
   parts.button.addEventListener('keyup', e => {
     if (e.key === ' ' || e.key === 'Enter') release();
```

`extension/src/unlock/screens/removeDamaged.ts`:

```diff
diff --git a/extension/src/unlock/screens/removeDamaged.ts b/extension/src/unlock/screens/removeDamaged.ts
index 5e3e0a5..bd06fcb 100644
--- a/extension/src/unlock/screens/removeDamaged.ts
+++ b/extension/src/unlock/screens/removeDamaged.ts
@@ -36,7 +36,7 @@ type Action = 'again' | 'setup' | 'close';
  * B1e §2.2, §2.4 (E9, E11, E12): `unlock.html?mode=remove-damaged`, the one screen that removes a wallet without its
  * password — and only a value the frozen predicate calls unreadable. It reads v1_vault itself and shows what it finds:
  * unreadable → the lines, the address (readableAddress), "Save the damaged data" (the value's exact text) and #37's typed
- * DELETE + hold (view/deleteConfirm.ts); refused by this version → the refused state (no removal); a wallet → "A wallet
+ * DELETE + (the hold, or the checkbox and one activation — B1e §3, view/deleteConfirm.ts); refused by this version → the refused state (no removal); a wallet → "A wallet
  * already exists", nothing offered; no wallet → set up. The confirmation hands over to damagedFlow's removeDamaged, which
  * reads again and sends only for the value shown (its digest); the background re-judges. Removed → #1, as #37.
  */
@@ -60,8 +60,11 @@ export function mountRemoveDamaged(deps: PageDeps, damaged: DamagedScreen): {sho
       help: byId('rd-help'),
       caption: byId('rd-caption'),
       button: byId<HTMLButtonElement>('rd-hold'),
+      name: byId('rd-name'),
       fill: byId('rd-fill'),
       count: byId('rd-count'),
+      understood: byId<HTMLInputElement>('rd-understood'),
+      understoodRow: byId('rd-understood-row'),
     },
     deps.timers,
     {
@@ -75,6 +78,7 @@ export function mountRemoveDamaged(deps: PageDeps, damaged: DamagedScreen): {sho
         cancel.disabled = pressing;
         x.disabled = pressing;
       },
+      onceName: DAMAGED.remove,
     },
   );
 
```

`extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index cf689ca..3db4e7f 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -311,6 +311,8 @@ export const DAMAGED = {
   changed: 'The stored data changed — check it again',
   /** `unlocked`: a session came back between the lock and the removal. */
   unlocked: 'Noctura was unlocked meanwhile — try again',
+  /** The removal button's name while the checkbox is checked: one activation removes (B1e §3). */
+  remove: 'Remove damaged wallet',
 } as const;
 
 /** #37's typed confirmation on the vault page (B1e §2.2, E11): the popup's words (DeleteWallet.tsx DELETE_TEXT). */
@@ -318,6 +320,9 @@ export const TYPED_DELETE = {
   caseSensitive: 'Case-sensitive · must match exactly.',
   keepGoing: (n: number): readonly [string, string, string, string] => [String(n), ' of ', '6', ' characters · keep going'],
   notAPrefix: 'Type DELETE exactly — it is case-sensitive.',
+  /** The button's name while the hold is the way, and the checkbox's label (B1e §3). */
+  hold: 'Hold to delete',
+  understood: 'I understand this permanently removes this wallet from this browser',
 } as const;
 
 /** #6 "manage" in the vault tab: add, replace, remove (B1b-2b §3.3, E12, D12, D13, C3, C4). */
```

`extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index b1f3d6c..7717c33 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -566,3 +566,15 @@
     display: none;
   }
 }
+/* B1e §3 (undrawn, §9): the checkbox directly above the hold — #47's ack row (.s9-ack-row, its grid and label) around a native
+   checkbox in the row's 20 px box column, the accent its checked colour (as the popup's #37, app.css). */
+.vlt-col .s9-ack-row.vlt-understood {
+  margin-top: 0;
+}
+.vlt-understood input {
+  width: 20px;
+  height: 20px;
+  margin: 0;
+  accent-color: var(--accent);
+  cursor: pointer;
+}
```

`extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 68d44a7..3867b5b 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -792,7 +792,8 @@
         </div>
         <div class="vlt-grow"></div>
         <div class="sticky-bar">
-          <button id="rd-hold" type="button" class="btn btn-primary s7-longpress vlt-hold" disabled hidden><span id="rd-fill" class="fill" aria-hidden="true"></span><span class="label vlt-hold-label"><svg width="18" height="18" aria-hidden="true"><use href="#i-trash" /></svg><span>Hold to delete<span id="rd-count"></span></span></span></button>
+          <label id="rd-understood-row" class="s9-ack-row vlt-understood" hidden><input id="rd-understood" type="checkbox" /><span class="lbl">I understand this permanently removes this wallet from this browser</span></label>
+          <button id="rd-hold" type="button" class="btn btn-primary s7-longpress vlt-hold" disabled hidden><span id="rd-fill" class="fill" aria-hidden="true"></span><span class="label vlt-hold-label"><svg width="18" height="18" aria-hidden="true"><use href="#i-trash" /></svg><span><span id="rd-name">Hold to delete</span><span id="rd-count"></span></span></span></button>
           <button id="rd-again" type="button" class="btn btn-primary" hidden>Start again</button>
           <button id="rd-setup" type="button" class="btn btn-primary" hidden>Set up a wallet</button>
           <button id="rd-close" type="button" class="btn btn-secondary" hidden>Close this tab</button>
```

E2E — `extension/e2e/settings.spec.ts`:

```diff
diff --git a/extension/e2e/settings.spec.ts b/extension/e2e/settings.spec.ts
index f2a411a..67fc1ab 100644
--- a/extension/e2e/settings.spec.ts
+++ b/extension/e2e/settings.spec.ts
@@ -445,6 +445,57 @@ test('15 · delete a funded wallet: #37 says so and names the lowest index (not
   }
 });
 
+test('15 · #37 without holding (B1e §3): DELETE → the checkbox by the keyboard (Enter on it nothing, Space checks it) → one Enter on the CTA → the delete tab, the wallet still there until the proof; the password deletes', async () => {
+  test.setTimeout(300_000);
+  const h = await launchPopup('noctura-e2e-delete-checkbox-');
+  try {
+    await unlockedWallet(h, 1);
+    const popup = await settings(h);
+    await popup.locator('.s7-title', {hasText: 'Delete wallet'}).click();
+    await expect(popup.getByText('Delete this wallet?')).toBeVisible();
+    const field = popup.getByRole('textbox', {name: 'Type DELETE here'});
+    await expect(popup.getByRole('checkbox')).toHaveCount(0);
+    await field.fill('DELETE');
+    const box = popup.getByRole('checkbox', {name: 'I understand this permanently removes this wallet from this browser'});
+    await expect(box).not.toBeChecked();
+    await expect(popup.getByRole('button', {name: 'Hold to delete'})).toBeEnabled();
+    // Keys on the checkbox: Enter changes nothing and opens nothing (the CTA's handler would have emptied the field
+    // before the key's promise resolved); Space checks it, and the CTA's name says one activation now deletes.
+    await box.focus();
+    await popup.keyboard.press('Enter');
+    await expect(box).not.toBeChecked();
+    await expect(field).toHaveValue('DELETE');
+    await popup.keyboard.press(' ');
+    await expect(box).toBeChecked();
+    await expect(field).toHaveValue('DELETE');
+    const cta = popup.getByRole('button', {name: 'Delete wallet'});
+    await expect(cta).toHaveAccessibleDescription('Confirmation opens in a new tab.');
+    // Unchecked again, the hold is back; checked once more for the one activation.
+    await popup.keyboard.press(' ');
+    await expect(popup.getByRole('button', {name: 'Hold to delete'})).toBeEnabled();
+    await popup.keyboard.press(' ');
+    await expect(cta).toBeEnabled();
+    // The box comes before the CTA in tab order: Tab from the box lands on it.
+    await box.focus();
+    await popup.keyboard.press('Tab');
+    await expect(cta).toBeFocused();
+    // One key-down opens the tab (and the popup closes itself: the key-up may land on a closed page).
+    const tab = await opened(h, () => popup.keyboard.down('Enter'));
+    await popup.keyboard.up('Enter').catch(() => undefined);
+    await expect(tab).toHaveURL(/mode=delete$/);
+    // The proof is still the gate: the wallet is there, the tab asks for the password.
+    expect(await envOf(h.sw)).toBeDefined();
+    await expect(tab.locator('#dl-password')).toBeVisible({timeout: 30_000});
+    await tab.locator('#dl-password').fill(E2E_PASSWORD);
+    await tab.locator('#dl-delete').click();
+    await tab.waitForURL(/mode=welcome$/, {timeout: 60_000});
+    expect(await envOf(h.sw)).toBeUndefined();
+    quiet(h);
+  } finally {
+    await h.close();
+  }
+});
+
 test('15 · a send still open: send-open — the vault intact, the wallet locked, [Unlock] → ?mode=unlock', async () => {
   test.setTimeout(300_000);
   const h = await launchPopup('noctura-e2e-delete-open-');
```

`extension/e2e/damaged.spec.ts`:

```diff
diff --git a/extension/e2e/damaged.spec.ts b/extension/e2e/damaged.spec.ts
index 49998c2..e08c9c7 100644
--- a/extension/e2e/damaged.spec.ts
+++ b/extension/e2e/damaged.spec.ts
@@ -129,3 +129,64 @@ test('damaged vaults: the unreadable state, its saved bytes, the removal; a refu
     rmSync(profile, {recursive: true, force: true});
   }
 });
+
+test('the removal without holding (B1e §3, E11): DELETE, the checkbox by the keyboard (Enter on it nothing, Space checks it), one click removes; unchecked again a click removes nothing', async () => {
+  const {ctx, profile} = await launchContained('noctura-e2e-damaged-checkbox-');
+  const nocTura = await containNocTura(ctx);
+  const solscan = await containSolscan(ctx);
+  try {
+    await expectContained(ctx);
+    const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
+    const id = new URL(sw.url()).host;
+    const env = await makeEnvelope();
+    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v}), {...env, password: {wrapped: 'AAAA'}});
+    const text = await storedText(sw);
+    const p = await vaultPage(ctx, id, 'unlock.html?mode=remove-damaged');
+    await expect(p.locator('#rd-entry')).toBeVisible({timeout: 60_000});
+    const box = p.getByRole('checkbox', {name: 'I understand this permanently removes this wallet from this browser'});
+    await expect(box).toBeHidden();
+    await p.fill('#rd-word', 'DELETE');
+    await expect(box).toBeVisible();
+    await expect(box).not.toBeChecked();
+    const button = p.locator('#rd-hold');
+    // Unchecked: a click is not a hold. A confirmation would have disabled the button inside the click's own handler.
+    await expect(p.getByRole('button', {name: 'Hold to delete'})).toBeEnabled();
+    await button.click();
+    await expect(button).toBeEnabled();
+    await expect(p.locator('#rd-word')).toHaveValue('DELETE');
+    // Keys on the checkbox: Enter changes nothing and removes nothing; Space checks it.
+    await box.focus();
+    await p.keyboard.press('Enter');
+    await expect(box).not.toBeChecked();
+    await expect(button).toBeEnabled();
+    await p.keyboard.press(' ');
+    await expect(box).toBeChecked();
+    await expect(button).toBeEnabled();
+    await expect(p.getByRole('button', {name: 'Remove damaged wallet'})).toBeEnabled();
+    await expect(p.locator('#rd-caption')).toBeHidden();
+    // The box comes before the button in tab order: Tab from the box lands on it.
+    await p.keyboard.press('Tab');
+    await expect(button).toBeFocused();
+    await box.focus();
+    await shot(p, 'damaged-remove-understood', {ready: p.locator('#rd-cancel')});
+    // Unchecked again: the hold is back, a click removes nothing.
+    await p.keyboard.press(' ');
+    await expect(box).not.toBeChecked();
+    await expect(p.getByRole('button', {name: 'Hold to delete'})).toBeEnabled();
+    await expect(p.locator('#rd-caption')).toBeVisible();
+    await button.click();
+    await expect(button).toBeEnabled();
+    expect(await storedText(sw)).toBe(text);
+    // Checked: one click removes it.
+    await box.check();
+    await p.getByRole('button', {name: 'Remove damaged wallet'}).click();
+    await expect(p).toHaveURL(/unlock\.html\?mode=welcome$/, {timeout: 30_000});
+    expect(await storedText(sw)).toBeUndefined();
+
+    expect(nocTura.hits).toEqual([]);
+    expect(solscan.hits).toEqual([]);
+  } finally {
+    await ctx.close();
+    rmSync(profile, {recursive: true, force: true});
+  }
+});
```

`extension/e2e/visual-settings.spec.ts`:

```diff
diff --git a/extension/e2e/visual-settings.spec.ts b/extension/e2e/visual-settings.spec.ts
index 71b87b7..fe6889e 100644
--- a/extension/e2e/visual-settings.spec.ts
+++ b/extension/e2e/visual-settings.spec.ts
@@ -333,6 +333,13 @@ test('visual: #31, #35, the passkey screen, the accounts manager and #37 in the
     await expect(p.getByText('Confirmation matched')).toBeVisible();
     await barCaptionsFlush(p);
     await pop(p, '37c-matched', p.locator('.app-hold'));
+    // B1e §3 (undrawn, §9): the checkbox checked — the CTA one activation, its hold copy gone.
+    const understood = p.getByRole('checkbox', {name: 'I understand this permanently removes this wallet from this browser'});
+    await understood.check();
+    await expect(p.getByRole('button', {name: 'Delete wallet'})).toBeEnabled();
+    await pop(p, '37c-understood', understood);
+    await understood.uncheck();
+    await expect(p.locator('.app-hold')).toHaveText('Hold to delete');
     // §8.4 item 10: the fill and the countdown at a mid-hold frame (~60 %), the page's clock paused.
     await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
     await p.locator('.app-hold').hover();
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, the delete and removal E2E.**

Run: the Step 2 command — `Test Files  2 passed (2)` · `Tests  86 passed (86)` (DeleteWallet 48, damagedScreens 38).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `TZ=UTC npx vitest run` — `Test Files  228 passed (228)` · `Tests  4986 passed (4986)` (Task 2's tree 228 / 4961: +25 — DeleteWallet +12, damagedScreens +13). **Pre-existing clock finding, not Task 3's:** under the dry-run machine's local zone (CET) on 2026-11-01 after 23:00, `npx vitest run` gave `1 failed | 4984 passed (4985)` (the dry run's first chain, before Task 2's Review Focus row) — `src/app/__tests__/Send.test.tsx` › "sent before (E6): …last 12 days ago" receives "last 11 days ago": the test sets `Date.now() - 12 * DAY` and `addressBook.ts` counts local calendar days, so within 12 days after a DST fall-back (25 Oct) and near midnight the count is one short. It fails identically on main (9562c5c) in a scratch copy and passes under `TZ=UTC`; untouched here, recorded for the controller. `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  18 passed (18)` · `Tests  435 passed | 25 skipped (460)` (unchanged).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale` (exit 0), `npm run csp` (exit 0), `npm run gates` — exit 0; `vault isolation ok` for both builds; `classes ok: every class in 61 src/app and src/approve files … every class in 49 vault-page files …` (`s9-ack-row` and `lbl` are design-ext's, `app-understood` app.css's, `vlt-understood` unlock.css's).

No repo-root `src/` or `core/` change: root `tsc` / `jest` and web `verify` are not run. `npx eslint` on the touched files reports one error, `react-hooks/exhaustive-deps` on `DeleteWallet.tsx`'s pending-read `useEffect` (`[m.phase]`, missing `m.engine`): checked on main 9562c5c (the same error, line 112) — it **predates B1e** (B1b-2b's #37), so it is left and recorded, not fixed here; eslint is not a gate of the extension's `verify`.

Playwright (every spec that runs #37 or the removal): `npx playwright test e2e/damaged.spec.ts e2e/settings.spec.ts e2e/visual-settings.spec.ts e2e/csp.spec.ts` — `15 passed (5.6m)` normally and `15 passed (5.6m)` under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'` (damaged 2, settings 10, visual-settings 2, csp 1).

**Visual check (at the real sizes: the popup 412 × 600 — `visual-settings.spec.ts`' `37c-matched`, `37c-understood`; the vault page 412 × 916 — `damaged.spec.ts`' `damaged-remove-matched`, `damaged-remove-understood`; shots under `test-results/visual/`, in the dry run's scratch only).** Read against `index.html` #s37c (the hold CTA, the bar) and #47's ack row (the row the checkbox is built from). Re-run after the controller's ruling. Confirmed: the row sits directly above the CTA inside the bar (popup: box, CTA, "Confirmation opens in a new tab.", Cancel; vault page: box, CTA, Cancel), its top border separating it from the typed field's area, the 20 px box in the row's first column, the label at the row's 13 / 18 type wrapping to two lines at 412 px; unchecked the native box is a dark square with a light border, checked it fills with `--accent` and a dark tick; checked, the CTA reads "Delete wallet" / "Remove damaged wallet" with the trash icon, and the hold's caption (and on the popup the card's hold line) are gone; the keyboard focus ring (web's `:focus-visible`) shows on the box in the vault shot; at 412 × 600 the popup's bar keeps Cancel in view. Nothing found to fix. Undrawn, flagged for Task 7 and the owner (§9): the checkbox row on both pages; the CTA's checked name; the hold copy hidden while checked.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1e-1 #37 without holding — a native checkbox directly above the hold trades it for one activation (a click, or Space / Enter on the button) after the typed DELETE, on #37 in the popup and on the damaged-vault removal; the proof in #37's vault tab still required; the CTA's name says what one activation does; Enter in the field and keys on the checkbox confirm nothing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked), `timeout 300`; `tsc`'s own exit code first, then the named test file.** `DW` = `src/app/__tests__/DeleteWallet.test.tsx` (48), `SC` = `src/unlock/__tests__/damagedScreens.test.ts` (38). Files: `HB` = `src/app/ui/HoldButton.tsx`, `DWs` = `src/app/screens/DeleteWallet.tsx`, `DC` = `src/unlock/view/deleteConfirm.ts`. The brief's nine pins, each on both pages: hold alone (M-p-hold, M-v-hold) · checkbox + one activation (M-p-click, M-v-click) · neither (M-p-neither, M-v-neither) · checkbox without DELETE (M-p-clear, M-v-word, M-v-clear) · on #37 checkbox without the proof (M-p-proof; M-p-target is the type's refusal) · unchecking restores the hold (M-p-uncheck, M-v-uncheck) · native input with a label (M-p-label, M-v-label) · the button's name (M-p-name, M-v-name) · keys on the checkbox (M-p-enter, M-v-keybar) · plus one activation is one (M-p-once, M-v-once) · the box before the button (M-p-order, M-v-order — the old order restored).

| id | the change | named test → observed |
|---|---|---|
| M-p-hold | HB: `if (latest.current.disabled \|\| latest.current.once \|\| done.current \|\| stop.current !== null) return;` → `if (latest.current.disabled \|\| !latest.current.once \|\| done.current \|\| stop.current !== null) return;` | tsc 0 · DW RED `11 failed \| 37 passed (48)` — “#37 delete wallet › 37c matched: the hold copy, "Confirmation matched", the caption; a 0.9 s hold opens nothing; the full second opens the proof and closes”; “#37 delete wallet › the full second, not less: released at 990 ms nothing opens” (+9 more) |
| M-v-hold | DC: `parts.understood.checked ? 'once' : 'hold'` → `parts.understood.checked ? 'once' : null` | tsc 0 · SC RED `12 failed \| 26 passed (38)` — “"Save the damaged data" (B1e §2.3, E10, R4) › carries exactly the bytes the digest hashes — the digest the removal then sends — named by its first 8 hex”; “the removal screen (B1e §2.2) › typed DELETE + the full hold removes it: one forgetDamaged, the wallet data gone, then #1” (+10 more) |
| M-p-click | HB: `      onClick={activate} ⏎ ` → (removed) | tsc 0 · DW RED `1 failed \| 47 passed (48)` — “#37 without holding: the checkbox (B1e §3) › checkbox + one click opens the proof at once — no hold, and no delete from the popup: the proof is still asked for” |
| M-v-click | DC: `  parts.button.addEventListener('click', once); ⏎ ` → (removed) | tsc 0 · SC RED `2 failed \| 36 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › checkbox + one click removes it at once: one forgetDamaged, the wallet data gone, then #1 — no hold, no tick”; “the removal without holding: the checkbox (B1e §3, E11) › every entry to the screen starts unchecked: after a `changed` re-read the word is empty and the box clear” |
| M-p-neither | HB: `if (latest.current.disabled \|\| !latest.current.once \|\| done.current) return;` → `if (latest.current.disabled \|\| done.current) return;` | tsc 0 · DW RED `4 failed \| 44 passed (48)` — “#37 without holding: the checkbox (B1e §3) › the hold alone still opens the proof: unchecked, a click opens nothing; the full second does”; “#37 without holding: the checkbox (B1e §3) › neither the hold nor the checkbox: a click, a tapped Space and a tapped Enter open nothing” (+2 more) |
| M-v-neither | DC: `    if (way() !== 'once') return;` → `    if (way() === null) return;` | tsc 0 · SC RED `4 failed \| 34 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › the hold alone still removes: unchecked, a click removes nothing; the full second does”; “the removal without holding: the checkbox (B1e §3, E11) › neither the hold nor the checkbox: a click, a tapped Space and a tapped Enter remove nothing” (+2 more) |
| M-p-clear | DWs: `    if (v !== WORD) setUnderstood(false); ⏎ ` → (removed) | tsc 0 · DW RED `1 failed \| 47 passed (48)` — “#37 without holding: the checkbox (B1e §3) › the checkbox without the word: the word edited clears it, and typed again it is unchecked — a click opens nothing” |
| M-v-word | DC: `(!matched() \|\| done \|\| !o.allowed() ? null :` → `(done \|\| !o.allowed() ? null :` | tsc 0 · SC RED `2 failed \| 36 passed (38)` — “the removal screen (B1e §2.2) › without the word, or with the word not exact, the button refuses a press; nothing sent”; “the removal without holding: the checkbox (B1e §3, E11) › the checkbox without the word: the word edited clears it, typed again it is unchecked; checked under a wrong word a click removes nothing” |
| M-v-clear | DC: `    if (!ok) parts.understood.checked = false; ⏎ ` → (removed) | tsc 0 · SC RED `2 failed \| 36 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › the checkbox without the word: the word edited clears it, typed again it is unchecked; checked under a wrong word a click removes nothing”; “the removal without holding: the checkbox (B1e §3, E11) › every entry to the screen starts unchecked: after a `changed` re-read the word is empty and the box clear” |
| M-p-proof | DWs: `            onHeld={toProof}` → `            onHeld={once ? () => m.platform.openPage('unlock.html?mode=welcome') : toProof}` | tsc 0 · DW RED `3 failed \| 45 passed (48)` — “#37 without holding: the checkbox (B1e §3) › checkbox + one click opens the proof at once — no hold, and no delete from the popup: the proof is still asked for”; “#37 without holding: the checkbox (B1e §3) › checkbox + one " " on the button (pressed and released) opens the proof” (+1 more) |
| M-p-target | DWs: `            onHeld={toProof}` → `            onHeld={once ? () => m.platform.openPage('unlock.html?mode=remove-damaged') : toProof}` | tsc **2 — INVALID, not counted**: `TS2345: Argument of type '"unlock.html?mode=remove-damaged"' is not assignable to parameter of type 'ExtensionPage \| ReauthPage \| RemoveAccountPage'` — the popup cannot name the proof-less page (vitest runs anyway: DW `3 failed \| 45 passed (48)`) |
| M-p-uncheck | DWs: `onChange={e => setUnderstood(e.target.checked)}` → `onChange={() => setUnderstood(true)}` | tsc 0 · DW RED `1 failed \| 47 passed (48)` — “#37 without holding: the checkbox (B1e §3) › unchecking after checking restores the hold: its name and caption back, a click opens nothing, the hold does” |
| M-v-uncheck | DC: `  parts.understood.addEventListener('change', render);` → `  parts.understood.addEventListener('change', () => { ⏎     if (parts.understood.checked) render(); ⏎   });` | tsc 0 · SC RED `1 failed \| 37 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › unchecking after checking restores the hold: its name and caption back, a click removes nothing, the hold does” |
| M-p-label | DWs: `          <label className="s9-ack-row app-understood"> ⏎             <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} /> ⏎             <span className="lbl">{DELETE_TEXT.understood}</span> ⏎           </label>` → `          <div className="s9-ack-row app-understood"> ⏎             <input type="checkbox" checked={understood} onChange={e => setUnderstood(e.target.checked)} /> ⏎             <span className="lbl">{DELETE_TEXT.understood}</span> ⏎           </div>` | tsc 0 · DW RED `9 failed \| 39 passed (48)` — “#37 without holding: the checkbox (B1e §3) › a native checkbox directly above the button (before it in tab order), labelled; absent until the word matches; unchecked on entry”; “#37 without holding: the checkbox (B1e §3) › checkbox + one click opens the proof at once — no hold, and no delete from the popup: the proof is still asked for” (+7 more) |
| M-v-label | `unlock.html`: `<label id="rd-understood-row" class="s9-ack-row vlt-understood" hidden><input id="rd-understood" type="checkbox" /><span class="lbl">I understand this permanently removes this wallet from this browser</span></label>` → `<div id="rd-understood-row" class="s9-ack-row vlt-understood" hidden><input id="rd-understood" type="checkbox" /><span class="lbl">I understand this permanently removes this wallet from this browser</span></div>` | tsc 0 · SC RED `1 failed \| 37 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › a native checkbox directly above the button (before it in tab order), labelled with §3’s words; hidden and unchecked until the word matches” |
| M-p-name | DWs: `label={once ? DELETE_TEXT.title : DELETE_TEXT.hold}` → `label={DELETE_TEXT.hold}` | tsc 0 · DW RED `1 failed \| 47 passed (48)` — “#37 without holding: the checkbox (B1e §3) › the button's name says what happens: "Hold to delete", checked "Delete wallet"; both described by "Confirmation opens in a new tab."; the hold's instructions go when checked” |
| M-v-name | DC: `setText(parts.name, checked ? o.onceName : TYPED_DELETE.hold);` → `setText(parts.name, TYPED_DELETE.hold);` | tsc 0 · SC RED `1 failed \| 37 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › the button's name says what happens: "Hold to delete", checked "Remove damaged wallet"; the hold's caption goes when checked” |
| M-p-enter | DWs: `<input type="checkbox" checked={understood} onChange` → `<input type="checkbox" checked={understood} onKeyDown={e => e.key === 'Enter' && toProof()} onChange` | tsc 0 · DW RED `1 failed \| 47 passed (48)` — “#37 without holding: the checkbox (B1e §3) › keys on the checkbox and in the field open nothing: Space and Enter on the checkbox, Enter in the DELETE field” |
| M-v-keybar | DC: `  parts.button.addEventListener('keydown', e => {` → `  parts.button.parentElement?.addEventListener('keydown', e => {` | tsc 0 · SC RED `1 failed \| 37 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › keys on the checkbox and in the field remove nothing: Space and Enter on the checkbox, Enter in the DELETE field” |
| M-p-once | HB: `    release(); ⏎     done.current = true; ⏎     latest.current.onHeld();` → `    release(); ⏎     latest.current.onHeld();` | tsc 0 · DW RED `1 failed \| 47 passed (48)` — “#37 without holding: the checkbox (B1e §3) › one activation is one call: a second click or key after it calls nothing more (HoldButton `once`)” |
| M-v-once | DC: `    release(); ⏎     done = true; ⏎     render(); ⏎     o.onConfirmed();` → `    release(); ⏎     render(); ⏎     o.onConfirmed();` | tsc 0 · SC RED `1 failed \| 37 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › one activation is one confirmation in mountDeleteConfirm itself (not only the page gate behind it)” |
| M-p-order | DWs: the old order restored — the `{matched ? (<label className="s9-ack-row app-understood">…</label>) : null}` block moved from before to after the `{matched ? (<HoldButton …/>) : (<button … app-delete-gated>…)}` block (the JSX comment above stays) | tsc 0 · DW RED `1 failed \| 47 passed (48)` — “#37 without holding: the checkbox (B1e §3) › a native checkbox directly above the button (before it in tab order), labelled; absent until the word matches; unchecked on entry” |
| M-v-order | `unlock.html`: the old order restored — the `<label id="rd-understood-row" …>…</label>` line moved from before to after the `<button id="rd-hold" …>…</button>` line | tsc 0 · SC RED `1 failed \| 37 passed (38)` — “the removal without holding: the checkbox (B1e §3, E11) › a native checkbox directly above the button (before it in tab order), labelled with §3’s words; hidden and unchecked until the word matches” |

23 rows, 22 counted, all run on the final commit: every counted mutant `tsc` 0 and red in its named file; M-p-target does not compile — the popup's `openPage` type refuses `?mode=remove-damaged`, which is itself the guard (a non-compiling mutant is not red, so the compiling M-p-proof — the checkbox path opens another page than the proof — pins the row). The sweep: `t3-mut.py` (a fresh `git archive HEAD` copy per mutant; `node_modules`, `web/node_modules`, `extension/node_modules` symlinked from the clone).

What the first sweep found, fixed before the final commit: **M-v-once survived** — with `done = true` dropped from `once()`, a second click calls `onConfirmed` again, but `removeDamaged.ts`' `exclusive` gate refuses it while the first removal runs, so the screen-level row stayed green. The one-shot is `mountDeleteConfirm`'s own promise, so a row now mounts it alone with a counting `onConfirmed`, and M-v-once turns it red. Three lines no test reached were removed rather than kept unpinned: `parts.understood.disabled = done || !o.allowed()` in `render()`, `parts.understood.checked = false` in `reset()` (reset empties the word, and `render()` clears the box for any word that does not match — the entry row pins that), and `HoldButton`'s `useEffect(() => release(), [once])` (a hold in progress cannot meet a checkbox change: reaching the checkbox blurs the button, and blur releases).


#### Notes for the executor (Task 3)

- **Rev 2: no change to this task's files.** Its commit is cherry-picked unchanged onto Task 2's rebuilt tree (be35060); its diff blocks differ from rev 1's only in context lines and hashes (Task 2's heading line and short-hold lines move the offsets). `tsc` 0 and `228 / 4986` as before; the 22 mutations re-run on be35060: 22 red with rev 1's counts, M-p-target INVALID again (`tsc` 2, `TS2345` — `openPage` cannot name the mode).
- **Ruling (controller): the checkbox goes directly ABOVE the button, before it in DOM and tab order, on #37 and on the removal** — a screen-reader or keyboard user reaches the box before the action it unlocks; D31 exists for exactly that. **A departure from §3 ("under the button") for the spec's rev 2.2 change list.** Pinned by a unit row per page (the row's next element sibling is the button; M-p-order and M-v-order restore the old order → red) and by both E2E (Tab from the box lands on the CTA).
- **Ruling: the rule in one place per page.** Popup: `DeleteWallet.tsx` decides (`once = matched && understood`; `HoldButton` is rendered only when the word matches), `HoldButton` executes (`once`); vault page: `way()` in `mountDeleteConfirm`, consulted by `press`, `once`, the keydown and `render`. `screens/delete.ts` (#37's vault half) is not touched: it never had the hold, it is the proof — why: "the checkbox only trades the hold" (§3) means the proof must stay the same code — cost if wrong: none for the removal; for #37 a later "accessible proof" would be its own change.
- **Ruling: the checkbox exists only while DELETE matches** (popup: not rendered; vault page: its row `hidden`) — why: §3 clears it whenever the word stops matching, so a box shown earlier could never stay checked — cost if wrong: a markup change only.
- **Ruling: a native checkbox, visible, inside #47's `.s9-ack-row` as a `<label>` (no painted `.box`, no `role=checkbox` div)** — `accent-color: var(--accent)`, 20 × 20 in the row's box column — why: D31 is about accessibility; a native, visible input keeps the platform's semantics, keyboard and forced-colours rendering, and the `<label>` gives it its name — cost if wrong: CSS / markup in two files; the owner sees it in Task 7's pass.
- **Ruling (controller-accepted): Space toggles the checkbox, Enter on it does nothing — native behaviour, no handler.** Pinned in real Chrome by both E2E (Enter: still unchecked, nothing opened or removed; Space: checked) and by the unit rows (no key on the box confirms; M-p-enter, M-v-keybar).
- **Ruling: the button's accessible name follows the box.** Unchecked "Hold to delete"; checked "Delete wallet" on #37 (`DELETE_TEXT.title`) and "Remove damaged wallet" on the removal (`DAMAGED.remove`, §2.2's button) — the visible label IS the name (no `aria-label`: label-in-name). On #37 both states are described by "Confirmation opens in a new tab." (`aria-describedby`): the activation opens the proof tab, not the delete. While checked, the hold's own instructions (#37's `holdBody`, `holdCaption` / `#rd-caption`) are hidden — "release to cancel" is false for one activation. No new copy beyond §3's label.
- **Ruling: one activation = a `click` event or a non-repeat Space / Enter `keydown` on the button** (the hold already prevents the keydown's default, so Chrome's synthetic click for Enter never comes; a second activation is refused by `done` on both pages, and on the removal also by the page's gate) — cost if wrong: none found (both E2E use real keys).
- **For Task 7:** the two E2E rows exist ("15 · #37 without holding", "the removal without holding"); extend, don't duplicate; the shots `37c-matched`, `37c-understood`, `damaged-remove-understood`; the rev 2.2 change list gets the §3 departure above.

#### Notes for the executor (Task 3, continued) — the dry run's rulings, deviations and hand-over

- Rulings beyond the brief: the eight in "Notes for the executor" — two are the controller's (the box ABOVE the button, a §3 departure for rev 2.2; Space / Enter native, accepted), and six are mine: one place per page with `screens/delete.ts` untouched; the checkbox only while the word matches; a visible native input in #47's row; the CTA's name and the hidden hold copy while checked; what counts as one activation.
- Deviations from the brief: `ConfirmParts`' new fields are required, not optional (Task 2's note said "an optional `checkbox`"; one caller); "#37, the checkbox without the proof" is pinned in the popup (the activation only opens `?mode=delete`, sends no forget message, the vault untouched — M-p-proof) and end to end (the tab still needs the password; the vault is there until it is given), not by a change in `screens/delete.ts`; M-p-target recorded as INVALID (tsc 2: the type refuses the page) — a guard, not a pin; 23 mutation rows (22 counted) where the brief named nine pins — each pin on both pages, the one-shot, and the controller's order mutation.
- The eslint `react-hooks/exhaustive-deps` error in `DeleteWallet.tsx`: present on main 9562c5c — predates B1e — left as is, recorded.
- Finding (not Task 3's): `Send.test.tsx`' "last 12 days ago" row depends on the time zone and DST — red under CET on 2026-11-01 late evening, identically on main, green under `TZ=UTC`. Step 4's totals are given under `TZ=UTC` with the local-zone result stated.
- The next task must know: `HoldButton` has `once` and `describedBy` (only #37 uses them; #49 unchanged); `mountDeleteConfirm` needs `name`, `understood`, `understoodRow` and `onceName`; `TYPED_DELETE.hold` / `understood` (pinned to `DELETE_TEXT`) and `DAMAGED.remove` exist; in both bars the checkbox row comes before the CTA.


### Task 4: The anti-phishing phrase in the background — `cleanPhrase` (NFC, trimmed, 3–32 UTF-16 code units, printable only — rev 2, E21: nothing that renders blank or draws out of its line, at most three combining marks in a row, one visible character —, empty = none); `v1_phishing_phrase` in `WALLET_DATA_KEYS` and `BACKGROUND_OWNED_KEYS`; the privileged write `settings.phrase` (set when none is set: an unlocked session, no proof — R1 = E18; change and remove: #10 through a new shared challenge kind `phrase`, applied by `vault.reauthOk`); the phrase as a field of `wallet.state`, `vault.status` and `dapp.pending` and of no other answer; onboarding's step hook (`PhraseStep`) on the create and import runs, called only after `commitWallet` stored the wallet and handed over its keys; the built `relay.js` / `provider.js` carry no `storage`

**Spec:** B1e §1.3 (the operations table, the message, the challenge kind, `vault.reauthOk` applying it, the last proof wins, #10's line never the value; onboarding after `commitWallet`, placement, skipped on `created-locked`), §1.4 (the key, `WALLET_DATA_KEYS` + `BACKGROUND_OWNED_KEYS`, plain remove and the accepted race, not encrypted, the reads ride on three answers), §1.5 (the rules, `cleanPhrase` beside `cleanName` sharing the regex, `null` / empty = remove, never echoed), §1.6 (the background's rows: set / locked / unchanged / change / remove / a later challenge applies its own value / refusals carry no value; the sender partition; onboarding survives the first write and a mutation moving it before `commitWallet` is RED; wiped by #37's delete and §2's removal, kept by #39's restore; the built-content-script `storage` gate and its mutation; the `BACKGROUND_OWNED_KEYS` mutation); owner decision E18 (R1 confirmed). **Not here:** every screen — the line on the six screens, R9's "could not be read" line, the onboarding step's screen, #35's row, #10's "Change / Remove the anti-phishing phrase" copy (Task 5); the six-screen E2E and the visual pass (Task 7). **Moved here from Task 6 (controller's assignment):** the built `relay.js` / `provider.js` no-`storage` check of §1.6.

**What Task 5 gets (the contract).** The background is complete: Task 5 adds only screens and their parsers. The value arrives as `phrase: string | null` on three answers; the one write is `settings.phrase`; a change or removal comes back `reauth-required {challengeId}` and the popup opens #10 with it exactly as for a weakening setting (`openPage('unlock.html?mode=reauth&challenge=…')`); `vault.challengeInfo` describes it as `{kind: 'phrase', action: 'change' | 'remove'}` — never the value; `vault.reauthOk` answers `{applied: 'phrase'}`. The onboarding hook is an option of both runs; `modes.ts` passes none in this task, so behaviour is unchanged until Task 5 mounts the step and passes it.

**Files:**
- Create: `extension/src/background/phraseKey.ts` (the key alone, as `presaleRecordsKey.ts`), `extension/src/background/phrase.ts` (`readPhrase`, `setPhrase`, `applyPhraseChallenge`)
- Modify: `extension/src/shared/envelopeRules.ts` (`PHRASE_LENGTH`, `cleanPhrase`), `extension/src/background/reauthChallenges.ts` (the `phrase` kind in `ChallengeAbout`, `SHARED_KINDS`, `isAbout`; `takePhraseChallenge`), `extension/src/background/walletApi.ts` (`settings.phrase` in `WALLET_TYPES` and its case; `wallet.state`'s `phrase`), `extension/src/background/messages.ts` (`vault.status`'s `phrase`; `vault.reauthOk` applies a `phrase` challenge; `vault.challengeInfo`'s redacted description; `dapp.pending`'s top-level `phrase`), `extension/src/background/accountsStore.ts` (`PHRASE_KEY` in `WALLET_DATA_KEYS`), `extension/src/unlock/screens/createRun.ts` (`PhraseStep`, the create run's hook after #6), `extension/src/unlock/screens/importRun.ts` (the import run's hook after `created`), `extension/scripts/check-vault-isolation.mjs` (`v1_phishing_phrase` in `BACKGROUND_OWNED_KEYS`; `CONTENT_SCRIPTS`, `contentStorageViolations`, run on `dist*/{app,chrome,firefox}`), `extension/vitest.nopresale.config.ts` (`phrase.test.ts` runs in the build without presale too)
- Create (tests): `extension/src/background/__tests__/phrase.test.ts` (37), `extension/src/unlock/__tests__/phraseStep.test.ts` (6)
- Modify (tests): `extension/src/shared/__tests__/envelopeRules.test.ts` (+77: rev 1's 42, rev 2's E21 rows 1 + 17 + 9 and rev 2.1's 3 + 5), `extension/scripts/__tests__/check-vault-isolation.test.mjs` (+9), `extension/src/background/__tests__/messages.test.ts` (`vault.status`'s field; `settings.phrase` in the literal partition list), `extension/src/background/__tests__/walletApi.test.ts` (`wallet.state`'s field), `extension/src/background/dapp/__tests__/decide.test.ts` (`dapp.pending`'s field), `extension/e2e/presaleSwitch.spec.ts` (`vault.status`'s field — rev 1: moved here from Task 7)

**Interfaces:**
- Consumes (existing): `FORBIDDEN_IN_NAME` (`envelopeRules.ts`, module-private, shared by reference); `settingsMutex` → `sessionMutex` lock order (`settings.ts`, `session.ts`); `issueChallenge`, `challengeInfo`, `CHALLENGE_ID`, `live` / `load` / `save` (`reauthChallenges.ts`); `digestOf` (`digest.ts`); `Result`, `handleWallet`'s `failure()` (`walletApi.ts`); `pending()` (`dapp/decide.ts`, unchanged); `removeWalletData` through `WALLET_DATA_KEYS` (`accountsStore.ts` — `forgetWallet` step 7, `forgetDamaged` step 7, `storeEnvelope`'s first write); `TOUCHES_STORAGE` (`check-vault-isolation.mjs`). From Tasks 1–2: `forgetDamaged`, `storedDigest`, `edited` (`src/shared/__tests__/vaultControls.ts`). Tests: `fakeExt`, `fakeDeps`, `fakeReader`, `ACCOUNT`, `RECIPIENT`, `openPage` (`dapp/__tests__/pageHarness.ts`), the vault-page `harness` (`unlock/__tests__/pageHarness.ts`).
- Produces (`extension/src/shared/envelopeRules.ts`):
  ```ts
  export const PHRASE_LENGTH: {readonly min: 3; readonly max: 32};
  export const PHRASE_MAX_MARKS = 3; // rev 2, E21
  /** NFC, then trim; PHRASE_LENGTH UTF-16 code units; no FORBIDDEN_IN_NAME character, no Cs / Co / Cn; rev 2 (E21): no
   *  Default_Ignorable code point, U+2800, U+FFFC or U+FFFD, at most PHRASE_MAX_MARKS marks in a row, one L/N/S/P.
   *  null: none (null, or a string empty after trimming). undefined: refused. */
  export function cleanPhrase(x: unknown): string | null | undefined;
  ```
- Produces (`extension/src/background/phraseKey.ts`): `export const PHRASE_KEY = 'v1_phishing_phrase';` (named only under `src/background/`; tests may import it).
- Produces (`extension/src/background/phrase.ts`):
  ```ts
  export async function readPhrase(ext: Ext): Promise<string | null>;      // a stored value that is not exactly a clean phrase reads as null
  export async function setPhrase(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, msg: Record<string, unknown>): Promise<Result>;
  export async function applyPhraseChallenge(ext: Ext, deps: Pick<WalletDeps, 'now'>, challengeId: string): Promise<Result>;
  ```
- Produces (`extension/src/background/reauthChallenges.ts`): `ChallengeAbout` gains `{kind: 'phrase'; phrase: string | null}` (exactly two keys; `phrase` a fixed point of `cleanPhrase`, or null = remove); `export async function takePhraseChallenge(ext: Ext, now: number, id: string): Promise<{phrase: string | null} | 'unknown-challenge' | 'locked'>`.
- Produces (messages — what Task 5's screens send and parse):

  | message (sender) | answer |
  |---|---|
  | `{type: 'settings.phrase', phrase: string \| null}` (popup, UI tab, vault page — never `/approve.html`, a content script or another extension) | `{ok: true, data: {outcome: 'set' \| 'unchanged'}}` · `{ok: false, error: 'reauth-required', data: {challengeId}}` (change or remove; open #10 with it) · `{ok: false, error: 'locked' \| 'malformed' \| 'failed'}` — never any value. `''` / whitespace = `null` = remove. A `challengeId` field is `malformed`. |
  | `wallet.state` (popup, UI tab) | gains `phrase: string \| null` (locked, unlocked, and with no wallet) |
  | `vault.status` (vault page; also the popup — unchanged partition) | `{unlocked, accounts, phrase: string \| null}` |
  | `dapp.pending` (`/approve.html` only) | every state (`none`, `locked`, `deciding`, `request`) gains a top-level `phrase: string \| null` |
  | `vault.challengeInfo` of a `phrase` challenge (vault page) | `{ok: true, data: {kind: 'phrase', action: 'change' \| 'remove'}}` — the redacted description; the stored record keeps the value |
  | `vault.reauthOk` on a `phrase` challenge (vault page) | `{ok: true, data: {applied: 'phrase'}}` · `unknown-challenge` · `locked` · `failed` |

- Produces (`extension/src/unlock/screens/createRun.ts`, the onboarding hook):
  ```ts
  export type PhraseStep = (o: {path: 'create' | 'import'; then(): void}) => void;
  export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; importRun(): void; phraseStep?: PhraseStep}): CreateRun;
  // importRun.ts
  export function createImportRun(deps: PageDeps, o: {password: PasswordScreen; back(): void; storing?: Storing; phraseStep?: PhraseStep}): ImportRun;
  ```
  Create: #6's `done` (any end of #6) → `phraseStep({path: 'create', then})` → `then()` goes to `wallet.html#/created`. Import: `created` → `phraseStep({path: 'import', then})` → `wallet.html#/imported`. `created-locked` never calls it (straight on, both runs). Without `phraseStep` both runs go straight on (today's behaviour; `modes.ts` passes none in this task).
- Produces (`extension/scripts/check-vault-isolation.mjs`): `export const CONTENT_SCRIPTS = ['relay.js', 'provider.js'];` `export function contentStorageViolations(distApp: string): string[]` — run by the gate's main on `dist*/{app,chrome,firefox}`; a missing file is INCONCLUSIVE.
- **What later tasks rely on:** Task 5 — the table above; `modes.ts` passes `phraseStep` to both runs (and only there); `reauthFlow.ts`' `runReauth` maps only `applied === 'settings'` to `'applied'` today — a phrase proof reads `'confirmed'` until Task 5 extends it; `describeChallenge` (`src/unlock/challenge.ts`) has no `phrase` branch yet, so #10 shows a `phrase` challenge as undescribable (fail closed) until Task 5 adds "Change the anti-phishing phrase" / "Remove the anti-phishing phrase". Task 7 — the E2E for the six screens; the rev 2.2 change list gets this task's departures (Notes for the executor).

**The rule, stated once.** The value is cleaned first (`cleanPhrase`: NFC, trim, 3–32 code units, no control / format / bidi / invisible / non-printing character; `null` or empty = remove; anything else is `malformed` before any read). Then, under `settingsMutex` and, for the checks and the first write, one `sessionMutex` section: the same value as stored → `unchanged` (nothing written, locked or not); no session → `locked`; nothing stored → written (`set`); otherwise — a change or a removal — a `phrase` challenge bound to the cleaned value, `reauth-required`. Only `vault.reauthOk` on that challenge applies it, writing the bound value over whatever is stored then (the last confirmed proof wins); a proof of any other kind never reaches the phrase, and no other message can write it. The value leaves the background only on `wallet.state`, `vault.status` and `dapp.pending` — answers only this extension's own pages get (a content script's sender carries the page's origin; the relay's port has no such type), and `dapp.pending` only to `/approve.html`. It is wallet data: a delete, a damaged-vault removal and a first write remove it, a restore keeps it — so onboarding asks for it only once `commitWallet` has stored the wallet and handed over its keys.

- [ ] **Step 1: Write the failing tests.**

The test strings with characters that do not print or look like others are `\u` escapes printed by a generator from their code points, never typed (rev 2: rev 1's rows had been typed raw — the Global Constraints' correction; every one is now an escape). Rev 2's E21 rows, and rev 2.1's eight, come from this generator (scratch `gen_e21.mjs`; `node gen_e21.mjs` prints exactly the two `it.each` lists below):

```js
// Prints Task 4's E21 rows (rev 2): every string is built from its code points and printed as \u escapes, never typed.
const esc = s => [...s].map(ch => { const cp = ch.codePointAt(0); return cp >= 0x20 && cp < 0x7f && ch !== "'" && ch !== '\\' ? ch : cp > 0xffff ? `\\u{${cp.toString(16)}}` : `\\u${cp.toString(16).padStart(4, '0')}`; }).join('');
const cps = (...c) => String.fromCodePoint(...c);
const nfc = s => s.normalize('NFC');
const refused = [
  ['Hangul choseong filler U+115F x3 (Default_Ignorable)', cps(0x115f, 0x115f, 0x115f)],
  ['Hangul jungseong filler U+1160 x3 (Default_Ignorable)', cps(0x1160, 0x1160, 0x1160)],
  ['Hangul filler U+3164 x3 (Default_Ignorable)', cps(0x3164, 0x3164, 0x3164)],
  ['halfwidth Hangul filler U+FFA0 x3 (Default_Ignorable)', cps(0xffa0, 0xffa0, 0xffa0)],
  ['Hangul fillers around a space (Default_Ignorable)', cps(0x3164, 0x20, 0x3164)],
  ['Khmer inherent vowel U+17B4 inside a word (Default_Ignorable)', 'ab' + cps(0x17b4) + 'cd'],
  ['Khmer inherent vowel U+17B5 inside a word (Default_Ignorable)', 'ab' + cps(0x17b5) + 'cd'],
  ['Mongolian free variation selector U+180B (Default_Ignorable, Mn)', 'ab' + cps(0x180b) + 'cd'],
  ['variation selector-17 U+E0100 (Default_Ignorable, Mn)', 'ab' + cps(0xe0100) + 'cd'],
  ['Braille blank U+2800 x3', cps(0x2800, 0x2800, 0x2800)],
  ['Braille blank U+2800 inside a word', 'ab' + cps(0x2800) + 'cd'],
  ['replacement character U+FFFD x3', cps(0xfffd, 0xfffd, 0xfffd)],
  ['object replacement character U+FFFC inside a word', 'ab' + cps(0xfffc) + 'cd'],
  ['a combining tower: a + U+0300 x31 (32 code units)', 'a' + cps(0x300).repeat(31)],
  ['four combining marks on one letter (one over the cap)', 'x' + cps(0x301, 0x302, 0x303, 0x304) + 'yz'],
  ['a + U+0300 x4: NFC makes it a-grave + 3, the cap counts after NFD', 'a' + cps(0x300).repeat(4)],
  ['u with diaeresis and acute (U+01D8) + 3 marks: 5 after NFD', cps(0x1d8, 0x300, 0x301, 0x302) + 'xy'],
  ['a with circumflex and dot below (U+1EAD) + 3 marks: 5 after NFD', cps(0x1ead, 0x300, 0x301, 0x302) + 'xy'],
  ['marks only: no character that draws itself', cps(0x301, 0x301, 0x301)],
  ['marks and no-break spaces only', cps(0x301, 0xa0, 0x301)],
];
const accepted = [
  ['a Cyrillic phrase', cps(0x441, 0x438, 0x43d, 0x438, 0x439, 0x20, 0x43a, 0x43e, 0x43d, 0x44c) + ' 42'],
  ['one accent mark on a letter with no precomposed form', 'x' + cps(0x301) + 'yz'],
  ['exactly PHRASE_MAX_MARKS marks on one letter', 'x' + cps(0x301, 0x302, 0x303) + 'yz'],
  ['Thai: a vowel and a tone mark on one consonant (2 marks)', nfc(cps(0xe19, 0xe35, 0xe49, 0xe19, 0xe30))],
  ['pointed Hebrew: a dagesh, a vowel and a shin dot on one letter (3 marks)', nfc(cps(0x5e9, 0x5bc, 0x5b8, 0x5c1, 0x5dc, 0x5d5, 0x5b9, 0x5dd))],
  ['Tibetan: a stack of three marks on one letter', nfc(cps(0xf66, 0xf92, 0xfb2, 0xf74, 0xf56, 0xf66))],
  ['Vietnamese, precomposed (2 marks per letter after NFD)', 'Ti' + cps(0x1ebf) + 'ng Vi' + cps(0x1ec7) + 't'],
  ['a + U+0300 x3: a-grave + 2, 3 after NFD', nfc('a' + cps(0x300).repeat(3))],
  ['Arabic: shadda, fatha and superscript alef on one letter (3 marks)', nfc(cps(0x628, 0x651, 0x64e, 0x670, 0x627, 0x628))],
  ['polytonic Greek: alpha with psili, oxia and ypogegrammeni (U+1F84, 3 after NFD)', cps(0x1f84, 0x3bd, 0x3b1)],
  ['Hangul syllables (their NFD jamo are letters)', cps(0xd55c, 0xad6d, 0xc5b4)],
  ['Hebrew and digits', cps(0x5e9, 0x5dc, 0x5d5, 0x5dd) + ' 42'],
  ['16 emoji (32 code units)', '\u{1f600}'.repeat(16)],
  ['32 wide letters', 'W'.repeat(32)],
];
const row = ([n, s]) => `    ['${esc(n)}', '${esc(s)}'],`;
for (const [n, s] of accepted) if (nfc(s) !== s) throw new Error(n);
console.log(refused.map(row).join('\n'));
console.log('---');
console.log(accepted.map(row).join('\n'));
```

Create `extension/src/background/__tests__/phrase.test.ts`:

```ts
import {base64} from '@scure/base';
import {PRIVILEGED, handleMessage} from '../messages';
import {applySettingsChallenge, handleWallet} from '../walletApi';
import {applyPhraseChallenge} from '../phrase';
import {PHRASE_KEY} from '../phraseKey';
import {VAULT_KEY, WALLET_DATA_KEYS, forgetDamaged, forgetWallet, storeEnvelope} from '../accountsStore';
import {REAUTH_KEY, SESSION_KEY, setSession} from '../session';
import {readSettings} from '../settings';
import {lock} from '../autolock';
import {CHALLENGE_TTL_MS, challengeInfo, isAbout, issueChallenge, takePhraseChallenge, takeSettingsChallenge} from '../reauthChallenges';
import {runUnlockHook} from '../dapp/queue';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {storedDigest} from '../../shared/storedDigest';
import {edited} from '../../shared/__tests__/vaultControls';
import {openPage} from '../dapp/__tests__/pageHarness';
import {fakeDeps, fakeReader} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT} from './fixtures';

// B1e §1.3–§1.6 (I2, I6, R1 = E18): the anti-phishing phrase in the background. Set when none is set needs an unlocked
// session and no proof; change and remove need #10's proof through a `phrase` challenge; the value rides on wallet.state,
// vault.status and dapp.pending only; it is wallet data (wiped by a delete, a damaged-vault removal and a first write,
// kept by a restore). Strings with characters that do not print are \u escapes.
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const ID = 'abcdefghijklmnopabcdefghijklmnop';
const from = (path: string) => ({id: ID, origin: ORIGIN, url: `${ORIGIN}${path}`});
const popup = from('/popup.html');
const tab = from('/wallet.html');
const vaultPage = from('/unlock.html');
const approve = from('/approve.html');
/** What Chrome reports for a content script (the relay) in a web page: this extension's id, the page's origin. */
const contentScript = {id: ID, origin: 'https://jup.ag', url: 'https://jup.ag/swap', tab: {id: 7}, frameId: 0};
const otherExtension = {id: 'someotherextensionidxxxxxxxxxxxx', origin: 'chrome-extension://someotherextensionidxxxxxxxxxxxx', url: 'chrome-extension://someotherextensionidxxxxxxxxxxxx/popup.html'};
const B = (n: number, fill: number) => base64.encode(new Uint8Array(n).fill(fill));
const STORED = {
  v: 1,
  scheme: 'slip10',
  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16, 1)},
  seed: {iv: B(12, 2), ct: B(48, 3)},
  password: {wrapped: B(40, 4)},
  accounts: [{index: 0, name: 'Main', publicKey: ACCOUNT.publicKey}],
};
const REV = envelopeRevision(STORED as Parameters<typeof envelopeRevision>[0]);
const REPLACEMENT = {...STORED, kdf: {...STORED.kdf, salt: B(16, 9)}, seed: {iv: B(12, 8), ct: B(48, 7)}, password: {wrapped: B(40, 6)}};
const BLUE = 'Blue horse 42';
const GREEN = 'Green fox 7';

async function setup(o: {unlocked?: boolean; phrase?: unknown} = {}) {
  const ext = fakeExt();
  await ext.local.set(VAULT_KEY, STORED);
  if (o.unlocked !== false) await setSession(ext, [ACCOUNT]);
  if (o.phrase !== undefined) await ext.local.set(PHRASE_KEY, o.phrase);
  const deps = fakeDeps({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []})});
  return {ext, deps};
}
type Ctx = Awaited<ReturnType<typeof setup>>;
const phrase = ({ext, deps}: Ctx, value: unknown, sender: Parameters<typeof handleMessage>[2] = popup) => handleMessage(ext, {type: 'settings.phrase', phrase: value}, sender, deps);
const stored = ({ext}: Ctx) => ext.local.get(PHRASE_KEY);
const reauthOk = ({ext, deps}: Ctx, challengeId: string) => handleMessage(ext, {type: 'vault.reauthOk', challengeId}, vaultPage, deps);
const challenges = async ({ext}: Ctx) => Object.keys(((await ext.session.get(REAUTH_KEY)) as Record<string, unknown> | undefined) ?? {});
/** settings.phrase answering reauth-required: the challenge's id. */
async function challengeFor(c: Ctx, value: unknown): Promise<string> {
  const r = await phrase(c, value);
  expect(r).toMatchObject({ok: false, error: 'reauth-required'});
  return (r.data as {challengeId: string}).challengeId;
}

describe('settings.phrase: set when none is set — an unlocked session, no proof (R1, E18)', () => {
  it('unlocked with none stored: written at once, cleaned (NFC, trimmed); the answer carries no value', async () => {
    const c = await setup();
    expect(await phrase(c, '  cafe\u0301 noir ')).toEqual({ok: true, data: {outcome: 'set'}});
    expect(await stored(c)).toBe('caf\u00e9 noir');
    expect(await challenges(c)).toEqual([]);
  });

  it('locked with none stored: `locked`, nothing written — then unlocked, the same message sets it (positive control)', async () => {
    const c = await setup({unlocked: false});
    expect(await phrase(c, BLUE)).toEqual({ok: false, error: 'locked'});
    expect(await stored(c)).toBeUndefined();
    await setSession(c.ext, [ACCOUNT]);
    expect(await phrase(c, BLUE)).toEqual({ok: true, data: {outcome: 'set'}});
    expect(await stored(c)).toBe(BLUE);
  });

  it('from every page the wallet runs in: the popup, the UI tab and the vault page (onboarding)', async () => {
    for (const sender of [popup, tab, vaultPage]) {
      const c = await setup();
      expect(await phrase(c, BLUE, sender)).toEqual({ok: true, data: {outcome: 'set'}});
      expect(await stored(c)).toBe(BLUE);
    }
  });

  it('the same value again is `unchanged`: nothing written, no challenge — locked or not; removing none is `unchanged` too', async () => {
    for (const unlocked of [true, false]) {
      const c = await setup({unlocked, phrase: BLUE});
      expect(await phrase(c, ` ${BLUE} `)).toEqual({ok: true, data: {outcome: 'unchanged'}});
      expect(await challenges(c)).toEqual([]);
      const none = await setup({unlocked});
      expect(await phrase(none, null)).toEqual({ok: true, data: {outcome: 'unchanged'}});
      expect(await stored(none)).toBeUndefined();
    }
  });

  it('a stored value that is not a clean phrase reads as none: shown as none, and set without a proof', async () => {
    for (const bad of ['ab\u202ecd', 'ab', ' padded ', 42, {phrase: BLUE}]) {
      const c = await setup({phrase: bad});
      expect(await handleMessage(c.ext, {type: 'wallet.state'}, popup, c.deps)).toMatchObject({ok: true, data: {phrase: null}});
      expect(await phrase(c, BLUE)).toEqual({ok: true, data: {outcome: 'set'}});
      expect(await stored(c)).toBe(BLUE);
    }
  });

  it('malformed — nothing written, no challenge: no `phrase` field, a non-string, a refused character, a `challengeId` alongside', async () => {
    const c = await setup();
    const settled = await issueChallenge(c.ext, c.deps, 'd', {kind: 'settings', autoLockMinutes: 10, reauthUsdCents: null});
    for (const m of [
      {type: 'settings.phrase'},
      {type: 'settings.phrase', phrase: undefined},
      {type: 'settings.phrase', phrase: 42},
      {type: 'settings.phrase', phrase: [BLUE]},
      {type: 'settings.phrase', phrase: 'ab\u202ecd'},
      {type: 'settings.phrase', phrase: 'ab'},
      {type: 'settings.phrase', phrase: BLUE, challengeId: settled},
    ]) {
      expect(await handleMessage(c.ext, m, popup, c.deps)).toEqual({ok: false, error: 'malformed'});
    }
    expect(await stored(c)).toBeUndefined();
    expect(await challenges(c)).toEqual([settled]);
  });
});

describe('change and remove need #10: a `phrase` challenge (R1, E18)', () => {
  it('change: `reauth-required`, nothing written; vault.reauthOk applies the value bound at issue', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    expect(await stored(c)).toBe(BLUE);
    expect(await challengeInfo(c.ext, c.deps.now(), id)).toEqual({kind: 'phrase', phrase: GREEN});
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBe(GREEN);
  });

  it.each([null, '', '   '])('remove (%j): `reauth-required`, kept; vault.reauthOk removes it', async value => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, value);
    expect(await stored(c)).toBe(BLUE);
    expect(await challengeInfo(c.ext, c.deps.now(), id)).toEqual({kind: 'phrase', phrase: null});
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBeUndefined();
  });

  it('change and remove while locked: `locked`, no challenge issued, kept', async () => {
    const c = await setup({unlocked: false, phrase: BLUE});
    for (const value of [GREEN, null]) expect(await phrase(c, value)).toEqual({ok: false, error: 'locked'});
    expect(await challenges(c)).toEqual([]);
    expect(await stored(c)).toBe(BLUE);
  });

  it('a lock landing while the challenge is issued: `locked`, and the challenge it raced past is removed', async () => {
    const c = await setup({phrase: BLUE});
    const set = c.ext.session.set.bind(c.ext.session);
    c.ext.session.set = async (key, value) => {
      await set(key, value);
      // The lock's clear lands right after the challenge is written.
      if (key === REAUTH_KEY) await c.ext.session.remove(SESSION_KEY);
    };
    expect(await phrase(c, GREEN)).toEqual({ok: false, error: 'locked'});
    expect(await c.ext.session.get(REAUTH_KEY)).toBeUndefined();
    expect(await stored(c)).toBe(BLUE);
  });

  it('applied exactly once: a replayed vault.reauthOk is `unknown-challenge`', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    await c.ext.local.set(PHRASE_KEY, BLUE);
    expect(await reauthOk(c, id)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await stored(c)).toBe(BLUE);
  });

  it('expired: `unknown-challenge`, kept', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    c.deps.clock.t += CHALLENGE_TTL_MS;
    expect(await reauthOk(c, id)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await stored(c)).toBe(BLUE);
  });

  it('locked at apply: `locked`, kept — vault.reauthOk refuses, and so does the take itself (a lock landing after that check)', async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    // The session gone with the challenge left in place: what a lock landing between vault.reauthOk's session check and
    // the take leaves for an instant (a lock clears the challenges too — below).
    await c.ext.session.remove(SESSION_KEY);
    expect(await reauthOk(c, id)).toEqual({ok: false, error: 'locked'});
    expect(await applyPhraseChallenge(c.ext, c.deps, id)).toEqual({ok: false, error: 'locked'});
    expect(await takePhraseChallenge(c.ext, c.deps.now(), id)).toBe('locked');
    expect(await challenges(c)).toEqual([id]);
    expect(await stored(c)).toBe(BLUE);
    await lock(c.ext);
    expect(await challenges(c)).toEqual([]);
  });

  it('the last confirmed proof wins: a challenge applied after another change landed applies its own bound value', async () => {
    const c = await setup({phrase: BLUE});
    const toGreen = await challengeFor(c, GREEN);
    const toRemove = await challengeFor(c, null);
    expect(await reauthOk(c, toRemove)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBeUndefined();
    expect(await reauthOk(c, toGreen)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBe(GREEN);
  });

  it('a storage failure: `failed` — on set, and on apply (the challenge is spent, nothing written)', async () => {
    const quota = (c: Ctx) => {
      const set = c.ext.local.set.bind(c.ext.local);
      c.ext.local.set = async (key, value) => {
        if (key === PHRASE_KEY) throw new Error('quota');
        await set(key, value);
      };
    };
    const fresh = await setup();
    quota(fresh);
    expect(await phrase(fresh, BLUE)).toEqual({ok: false, error: 'failed'});
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    quota(c);
    expect(await reauthOk(c, id)).toEqual({ok: false, error: 'failed'});
    expect(await stored(c)).toBe(BLUE);
  });

  it('#10 is told what it is for, never the value: vault.challengeInfo answers `change` or `remove`', async () => {
    const c = await setup({phrase: BLUE});
    const change = await challengeFor(c, GREEN);
    const remove = await challengeFor(c, null);
    const info = (challengeId: string) => handleMessage(c.ext, {type: 'vault.challengeInfo', challengeId}, vaultPage, c.deps);
    expect(await info(change)).toEqual({ok: true, data: {kind: 'phrase', action: 'change'}});
    expect(await info(remove)).toEqual({ok: true, data: {kind: 'phrase', action: 'remove'}});
  });
});

describe('a proof of another kind never changes the phrase', () => {
  it('a satisfied settings challenge confirmed by vault.reauthOk applies its settings — the phrase is untouched', async () => {
    const c = await setup({phrase: BLUE});
    const id = await issueChallenge(c.ext, c.deps, 'd', {kind: 'settings', autoLockMinutes: 10, reauthUsdCents: null});
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'settings'}});
    expect((await readSettings(c.ext)).autoLockMinutes).toBe(10);
    expect(await stored(c)).toBe(BLUE);
  });

  it('takePhraseChallenge takes only a phrase challenge: a settings, send or dapp id is `unknown-challenge` and stays', async () => {
    const c = await setup({phrase: BLUE});
    const ids = [
      await issueChallenge(c.ext, c.deps, 'd1', {kind: 'settings', autoLockMinutes: 10, reauthUsdCents: null}),
      await issueChallenge(c.ext, c.deps, 'd2', {kind: 'send', account: ACCOUNT.publicKey, token: 'SOL', recipient: RECIPIENT, amount: '1', networkLamports: '5000', priorityLamports: '0', markupLamports: '0', markupReason: 'pre-tge', rentLamports: '0', reasons: ['first-send'], thresholdCents: 10_000}),
      await issueChallenge(c.ext, c.deps, 'd3', {kind: 'dapp', account: ACCOUNT.publicKey, site: 'jup.ag', transactions: 1, outgoing: [], omitted: 0, reasons: ['first-send'], thresholdCents: 10_000, flags: []}),
    ];
    for (const id of ids) expect(await takePhraseChallenge(c.ext, c.deps.now(), id)).toBe('unknown-challenge');
    expect((await challenges(c)).sort()).toEqual([...ids].sort());
  });

  it("the settings path cannot take a phrase challenge: applySettingsChallenge and takeSettingsChallenge say `unknown-challenge`; #10's proof still applies it", async () => {
    const c = await setup({phrase: BLUE});
    const id = await challengeFor(c, GREEN);
    expect(await applySettingsChallenge(c.ext, c.deps, id)).toEqual({ok: false, error: 'unknown-challenge'});
    expect(await takeSettingsChallenge(c.ext, c.deps.now(), id)).toBe('unknown-challenge');
    expect(await stored(c)).toBe(BLUE);
    expect(await reauthOk(c, id)).toEqual({ok: true, data: {applied: 'phrase'}});
    expect(await stored(c)).toBe(GREEN);
  });

  it('settings.set cannot carry it: a patch naming `phrase` is malformed', async () => {
    const c = await setup({phrase: BLUE});
    expect(await handleWallet(c.ext, c.deps, 'settings.set', {patch: {phrase: GREEN}})).toEqual({ok: false, error: 'malformed'});
    expect(await stored(c)).toBe(BLUE);
  });

  it('the `phrase` kind is exactly two keys, a clean phrase or null — anything else is no challenge', () => {
    expect(isAbout({kind: 'phrase', phrase: BLUE})).toBe(true);
    expect(isAbout({kind: 'phrase', phrase: null})).toBe(true);
    for (const bad of [
      {kind: 'phrase'},
      {kind: 'phrase', phrase: BLUE, extra: 1},
      {kind: 'phrase', phrase: 'ab'},
      {kind: 'phrase', phrase: 'ab\u202ecd'},
      {kind: 'phrase', phrase: ` ${BLUE}`},
      {kind: 'phrase', phrase: 'cafe\u0301 noir'},
      {kind: 'phrase', phrase: 42},
      {kind: 'phrase', phrase: ''},
    ]) {
      expect(isAbout(bad)).toBe(false);
    }
  });
});

describe('never echoed (§1.5)', () => {
  // Characters that appear in no answer's keys or codes (ok, error, data, challengeId, outcome, applied, hex ids).
  const TRIED = ['ZQXW\u202e', 'ZQXW', 'WQZX'];
  const noneOf = (answer: unknown, value: string) => [...value].filter(ch => JSON.stringify(answer).includes(ch));

  it('a refusal carries no character of the tried value, and nothing is logged', async () => {
    const logs = (['log', 'warn', 'error', 'info', 'debug'] as const).map(k => vi.spyOn(console, k));
    try {
      const malformed = await phrase(await setup(), TRIED[0]);
      const locked = await phrase(await setup({unlocked: false}), TRIED[1]);
      const proof = await phrase(await setup({phrase: BLUE}), TRIED[2]);
      expect([malformed.ok, locked.ok, proof.ok]).toEqual([false, false, false]);
      expect([malformed, locked, proof].map((a, i) => noneOf(a, TRIED[i] ?? ''))).toEqual([[], [], []]);
      for (const spy of logs) expect(spy).not.toHaveBeenCalled();
    } finally {
      for (const spy of logs) spy.mockRestore();
    }
  });
});

describe('the phrase rides on three answers only (I2, R2)', () => {
  it('wallet.state carries it — locked and unlocked, from the popup and the tab; null when none is set', async () => {
    for (const unlocked of [true, false]) {
      const c = await setup({unlocked, phrase: BLUE});
      for (const sender of [popup, tab]) expect(await handleMessage(c.ext, {type: 'wallet.state'}, sender, c.deps)).toMatchObject({ok: true, data: {hasWallet: true, unlocked, phrase: BLUE}});
      const none = await setup({unlocked});
      expect(await handleMessage(none.ext, {type: 'wallet.state'}, popup, none.deps)).toMatchObject({ok: true, data: {phrase: null}});
    }
  });

  it('vault.status carries it — locked and unlocked, to the vault page; null when none is set', async () => {
    for (const unlocked of [true, false]) {
      const c = await setup({unlocked, phrase: BLUE});
      expect(await handleMessage(c.ext, {type: 'vault.status'}, vaultPage, c.deps)).toEqual({
        ok: true,
        data: {unlocked, accounts: unlocked ? [{index: 0, publicKey: ACCOUNT.publicKey}] : [], phrase: BLUE},
      });
      const none = await setup({unlocked});
      expect(await handleMessage(none.ext, {type: 'vault.status'}, vaultPage, none.deps)).toMatchObject({ok: true, data: {phrase: null}});
    }
  });

  it('dapp.pending carries it at the top level in every state: none, locked, request', async () => {
    const empty = await setup({phrase: BLUE});
    expect(await handleMessage(empty.ext, {type: 'dapp.pending'}, approve, empty.deps)).toEqual({ok: true, data: {state: 'none', phrase: BLUE}});
    for (const unlocked of [false, true]) {
      const c = await setup({unlocked, phrase: BLUE});
      if (unlocked) await runUnlockHook(c.ext, c.deps);
      await openPage(c.ext, c.deps, 'https://dapp.test').ask({type: 'page.connect', id: 'c1', silent: false});
      const r = await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps);
      expect(r).toMatchObject({ok: true, data: {state: unlocked ? 'request' : 'locked', phrase: BLUE}});
    }
    const none = await setup();
    expect(await handleMessage(none.ext, {type: 'dapp.pending'}, approve, none.deps)).toEqual({ok: true, data: {state: 'none', phrase: null}});
  });

  it('no wallet: wallet.state and vault.status still answer the field (null)', async () => {
    const ext = fakeExt();
    const deps = fakeDeps();
    expect(await handleMessage(ext, {type: 'wallet.state'}, popup, deps)).toMatchObject({ok: true, data: {hasWallet: false, phrase: null}});
    expect(await handleMessage(ext, {type: 'vault.status'}, vaultPage, deps)).toMatchObject({ok: true, data: {unlocked: false, phrase: null}});
  });

  it('every other privileged answer omits it — from the popup, the vault page and the approval window, a phrase challenge open', async () => {
    const THREE = ['wallet.state', 'vault.status', 'dapp.pending'];
    const others = PRIVILEGED.filter(t => !THREE.includes(t));
    expect(others).toContain('settings.get');
    expect(others).toContain('vault.challengeInfo');
    for (const type of others) {
      for (const sender of [popup, vaultPage, approve]) {
        const c = await setup({phrase: BLUE});
        // Two values in play: the stored phrase, and the one an open challenge would set.
        const challengeId = await challengeFor(c, GREEN);
        const r = await handleMessage(c.ext, {type, challengeId, account: ACCOUNT.publicKey, phrase: BLUE, expectedRevision: REV}, sender, c.deps);
        const text = JSON.stringify(r);
        expect([type, text.includes(BLUE) || text.includes(GREEN)]).toEqual([type, false]);
      }
    }
  });
});

describe('who may ask: no content-script, provider or relay context reads or writes it (§1.6, Minor 4)', () => {
  it('wallet.state, vault.status and settings.phrase from a content script or another extension: `forbidden`, nothing written', async () => {
    const c = await setup({phrase: BLUE});
    for (const sender of [contentScript, otherExtension]) {
      for (const m of [{type: 'wallet.state'}, {type: 'vault.status'}, {type: 'settings.phrase', phrase: GREEN}, {type: 'settings.phrase', phrase: null}, {type: 'dapp.pending'}]) {
        expect(await handleMessage(c.ext, m, sender, c.deps)).toEqual({ok: false, error: 'forbidden'});
      }
    }
    expect(await challenges(c)).toEqual([]);
    expect(await stored(c)).toBe(BLUE);
  });

  it('the approval window gets it only on dapp.pending: wallet.state, vault.status and settings.phrase from /approve.html are `forbidden`', async () => {
    const c = await setup();
    for (const m of [{type: 'wallet.state'}, {type: 'vault.status'}, {type: 'settings.phrase', phrase: GREEN}]) {
      expect(await handleMessage(c.ext, m, approve, c.deps)).toEqual({ok: false, error: 'forbidden'});
    }
    expect(await stored(c)).toBeUndefined();
    // Positive control: the window's own read carries the field; the popup may not send it.
    expect(await handleMessage(c.ext, {type: 'dapp.pending'}, approve, c.deps)).toEqual({ok: true, data: {state: 'none', phrase: null}});
    expect(await handleMessage(c.ext, {type: 'dapp.pending'}, popup, c.deps)).toEqual({ok: false, error: 'forbidden'});
  });

  it("the relay's page port refuses every read and write of it: `invalid-request`, no answer carries it, nothing written", async () => {
    const c = await setup({phrase: BLUE});
    const page = openPage(c.ext, c.deps, 'https://jup.ag');
    for (const [i, m] of [{type: 'wallet.state'}, {type: 'vault.status'}, {type: 'dapp.pending'}, {type: 'settings.phrase', phrase: GREEN}, {type: 'settings.phrase', phrase: null}].entries()) {
      expect(await page.ask({...m, id: `p${i}`})).toEqual({id: `p${i}`, error: 'invalid-request'});
    }
    expect(JSON.stringify(page.port.posted).includes(BLUE)).toBe(false);
    expect(await stored(c)).toBe(BLUE);
    expect(await challenges(c)).toEqual([]);
  });
});

describe('wallet data: wiped by a delete, a damaged-vault removal and a first write; kept by a restore (§1.4)', () => {
  it('v1_phishing_phrase is one of WALLET_DATA_KEYS', () => {
    expect(PHRASE_KEY).toBe('v1_phishing_phrase');
    expect(WALLET_DATA_KEYS).toContain(PHRASE_KEY);
  });

  it("#37's delete (vault.forgetWallet, no replacement) removes it", async () => {
    const c = await setup({phrase: BLUE});
    expect(await forgetWallet(c.ext, c.deps, {expectedRevision: REV})).toBe('forgotten');
    expect(await c.ext.local.get(VAULT_KEY)).toBeUndefined();
    expect(await stored(c)).toBeUndefined();
  });

  it("#39's restore (vault.forgetWallet with the same-key replacement) keeps it", async () => {
    const c = await setup({phrase: BLUE});
    expect(await forgetWallet(c.ext, c.deps, {expectedRevision: REV, replacement: REPLACEMENT})).toBe('forgotten');
    expect(await c.ext.local.get(VAULT_KEY)).toEqual(REPLACEMENT);
    expect(await stored(c)).toBe(BLUE);
  });

  it("§2's removal of an unreadable vault (vault.forgetDamaged) removes it", async () => {
    const ext = fakeExt();
    const unreadable = edited(e => (e.seed = 'damaged'));
    await ext.local.set(VAULT_KEY, unreadable);
    await ext.local.set(PHRASE_KEY, BLUE);
    expect(await forgetDamaged(ext, {expectedDigest: storedDigest(unreadable)})).toBe('forgotten');
    expect(await ext.local.get(PHRASE_KEY)).toBeUndefined();
  });

  it('a first write (onboarding’s storeEnvelope(null, …)) removes a phrase left behind — why onboarding sets it after commitWallet', async () => {
    const ext = fakeExt();
    await ext.local.set(PHRASE_KEY, BLUE);
    expect(await storeEnvelope(ext, null, STORED)).toBe('stored');
    expect(await ext.local.get(PHRASE_KEY)).toBeUndefined();
  });
});
```

Create `extension/src/unlock/__tests__/phraseStep.test.ts`:

```ts
// @vitest-environment happy-dom
import {VAULT_KEY} from '../../background/accountsStore';
import {PHRASE_KEY} from '../../background/phraseKey';
import {getSession} from '../../background/session';
import {createCreateRun, type PhraseStep} from '../screens/createRun';
import {createImportRun} from '../screens/importRun';
import {mountPassword} from '../screens/password';
import {HOLD_MS, TICK_MS} from '../view/hold';
import {click, el, harness, loadPage, text, type, visible, type Harness} from './pageHarness';

// B1e §1.3 (I6): onboarding's anti-phishing step runs only once the new wallet is stored and its keys are in the
// session — after commitWallet, whose first write (storeEnvelope(null, …)) removes every WALLET_DATA_KEYS key, the
// phrase's among them. The step itself is Task 5's screen; here a stand-in sets the phrase the way it will.
const PHRASE = 'wonder sauce regret hover leopard hundred luxury home wise frost naive body company wedding want sponsor buyer birth february friend frequent neglect draw pond';
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PW = 'a long enough password';
const BLUE = 'Blue horse 42';
const HELD = HOLD_MS + TICK_MS;

beforeEach(() => loadPage());

async function press(h: Harness, id: string): Promise<void> {
  await h.until(() => !el<HTMLButtonElement>(id).disabled);
  click(el(id));
}

interface Seen {
  path: 'create' | 'import';
  /** At the step: the stored vault, the session's keys, where the run had gone. */
  stored: boolean;
  unlocked: boolean;
  went: number;
  answer: unknown;
}
/** A stand-in for Task 5's screen: sets the phrase as the step will (settings.phrase from the vault page), then continues. */
function stepThatSets(h: Harness, seen: Seen[]): PhraseStep {
  return ({path, then}) => {
    void (async () => {
      const stored = (await h.ext.local.get(VAULT_KEY)) !== undefined;
      const unlocked = (await getSession(h.ext)) !== null;
      const went = h.went.length;
      const answer = await h.deps.send({type: 'settings.phrase', phrase: BLUE});
      seen.push({path, stored, unlocked, went, answer});
      then();
    })();
  };
}
const phraseRead = async (h: Harness) => ((await h.deps.send({type: 'vault.status'})).data as {phrase?: unknown}).phrase;

/** #1 → #2 → #3 → #4 → #5 with the password typed twice (the second time not yet confirmed). */
async function toPassword(h: Harness): Promise<void> {
  await press(h, 'wel-create');
  click(el('int-continue'));
  await press(h, 'sg-continue');
  el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
  h.timers.advance(HELD);
  const shownWords = [...el('seed-grid').querySelectorAll('.term')].map(text);
  el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
  await press(h, 'seed-cta');
  for (const s of [...el('cnf-slots').querySelectorAll('.label')].map(text)) {
    const n = Number(/#(\d+)/.exec(s)?.[1]);
    const b = () => [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === shownWords[n - 1]) as HTMLButtonElement;
    await h.until(() => !b().disabled);
    click(b());
  }
  await press(h, 'cnf-cta');
  await press(h, 'cnf-cta');
  type(el<HTMLInputElement>('pw-field'), PW);
  await press(h, 'pw-cta');
  await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
  type(el<HTMLInputElement>('pw-field'), PW);
}

describe('create: the phrase step after #6, before wallet.html#/created (B1e §1.3)', () => {
  it('runs once #6 ends, with the wallet stored and its keys in the session; the phrase it sets survives; then #7', async () => {
    const h = await harness({mnemonic: PHRASE});
    const seen: Seen[] = [];
    createCreateRun(h.deps, {password: mountPassword(h.deps), importRun: () => undefined, phraseStep: stepThatSets(h, seen)}).start('welcome');
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => visible(el('v-passkey')));
    // Not before #6: the step waits for it (#6 holds the typed password; the step must not hold it longer).
    expect(seen).toEqual([]);
    await press(h, 'pk-skip');
    await h.until(() => h.went.length === 1);
    expect(seen).toEqual([{path: 'create', stored: true, unlocked: true, went: 0, answer: {ok: true, data: {outcome: 'set'}}}]);
    expect(h.went).toEqual(['wallet.html#/created']);
    expect(await phraseRead(h)).toBe(BLUE);
  }, 30_000);

  it('negative control — why the order matters: a phrase in storage before the first write is gone after it', async () => {
    const h = await harness({mnemonic: PHRASE});
    createCreateRun(h.deps, {password: mountPassword(h.deps), importRun: () => undefined}).start('welcome');
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    await h.ext.local.set(PHRASE_KEY, BLUE);
    click(el('pw-cta'));
    await h.until(() => visible(el('v-passkey')));
    expect(await h.ext.local.get(PHRASE_KEY)).toBeUndefined();
    expect(await phraseRead(h)).toBeNull();
  }, 30_000);

  it('created-locked (the keys did not reach the background): no step — `set` would answer `locked`; straight to #7', async () => {
    const h = await harness({
      mnemonic: PHRASE,
      send: inner => async m => ((m as {type: string}).type === 'vault.setKeys' ? {ok: false, error: 'failed'} : inner(m)),
    });
    const seen: Seen[] = [];
    createCreateRun(h.deps, {password: mountPassword(h.deps), importRun: () => undefined, phraseStep: stepThatSets(h, seen)}).start('welcome');
    await h.until(() => visible(el('wel-actions')));
    await toPassword(h);
    click(el('pw-cta'));
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
    expect(seen).toEqual([]);
    expect(h.sent.map(m => m.type)).not.toContain('settings.phrase');
  }, 30_000);
});

describe('import: the phrase step after the wallet is stored, before wallet.html#/imported (B1e §1.3)', () => {
  const none = {getMultipleLamports: async (keys: readonly unknown[]) => keys.map(() => 0n)};
  async function importRun(o: {send?: NonNullable<Parameters<typeof harness>[0]>['send']; step: boolean}) {
    const h = await harness({reader: none, send: o.send});
    const seen: Seen[] = [];
    createImportRun(h.deps, {password: mountPassword(h.deps), back: () => undefined, ...(o.step ? {phraseStep: stepThatSets(h, seen)} : {})}).show();
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    return {h, seen};
  }

  it('runs with the wallet stored and its keys in the session; the phrase survives; then #40', async () => {
    const {h, seen} = await importRun({step: true});
    expect(seen).toEqual([{path: 'import', stored: true, unlocked: true, went: 0, answer: {ok: true, data: {outcome: 'set'}}}]);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(await phraseRead(h)).toBe(BLUE);
  });

  it('created-locked: no step; straight to #40', async () => {
    const {h, seen} = await importRun({step: true, send: inner => async m => ((m as {type: string}).type === 'vault.setKeys' ? {ok: false, error: 'failed'} : inner(m))});
    expect(seen).toEqual([]);
    expect(h.went).toEqual(['wallet.html#/imported']);
  });

  it('without a step (the page passes none): unchanged — straight to #40', async () => {
    const {h} = await importRun({step: false});
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(await phraseRead(h)).toBeNull();
  });
});
```

Modify `extension/src/shared/__tests__/envelopeRules.test.ts` (the rules):

```diff
diff --git a/extension/src/shared/__tests__/envelopeRules.test.ts b/extension/src/shared/__tests__/envelopeRules.test.ts
index 9bdab88..2420200 100644
--- a/extension/src/shared/__tests__/envelopeRules.test.ts
+++ b/extension/src/shared/__tests__/envelopeRules.test.ts
@@ -1,5 +1,5 @@
 import {base64} from '@scure/base';
-import {ENVELOPE_BYTES, MAX_ACCOUNTS, MAX_NAME_LENGTH, b64Length, cleanName} from '../envelopeRules';
+import {ENVELOPE_BYTES, MAX_ACCOUNTS, MAX_NAME_LENGTH, PHRASE_LENGTH, PHRASE_MAX_MARKS, b64Length, cleanName, cleanPhrase} from '../envelopeRules';
 
 describe('envelope rules shared by the vault page and the background', () => {
   it('pins the limits', () => {
@@ -48,3 +48,147 @@ describe('envelope rules shared by the vault page and the background', () => {
     expect('\u0412inance'.normalize('NFKC')).not.toBe('Binance');
   });
 });
+
+// B1e §1.5: the anti-phishing phrase. Every string with an invisible, format or non-printing character is written as a
+// \u escape (generated by a script, never typed).
+describe('cleanPhrase: the anti-phishing phrase (B1e §1.5)', () => {
+  it('pins the limits: 3–32 UTF-16 code units', () => {
+    expect(PHRASE_LENGTH).toEqual({min: 3, max: 32});
+  });
+
+  it('NFC first, then trimmed: the stored phrase is the composed, trimmed text', () => {
+    expect(cleanPhrase('cafe\u0301 noir')).toBe('caf\u00e9 noir');
+    expect(cleanPhrase('  Blue horse 42  ')).toBe('Blue horse 42');
+    expect(cleanPhrase('\u00a0\u3000 abc \u2028\ufeff')).toBe('abc');
+  });
+
+  it('the length counts after NFC and after trimming: 3 and 32 accepted, 2 and 33 refused', () => {
+    expect(cleanPhrase('abc')).toBe('abc');
+    expect(cleanPhrase('x'.repeat(32))).toBe('x'.repeat(32));
+    expect(cleanPhrase('ab')).toBeUndefined();
+    expect(cleanPhrase('x'.repeat(33))).toBeUndefined();
+    // Trimmed before counting: two characters inside four spaces are two.
+    expect(cleanPhrase('  ab  ')).toBeUndefined();
+    expect(cleanPhrase(' abc ')).toBe('abc');
+    // Composed before counting: 33 code units that NFC makes 32 are accepted.
+    expect('e\u0301xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'.length).toBe(33);
+    expect(cleanPhrase('e\u0301xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')).toBe('\u00e9xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx');
+    // UTF-16 code units, as cleanName counts: an emoji outside the BMP is two.
+    expect(cleanPhrase('🐴'.repeat(16))).toBe('🐴'.repeat(16));
+    expect(cleanPhrase('🐴'.repeat(16) + 'x')).toBeUndefined();
+  });
+
+  it('empty means none: null, "", and a string of only whitespace are null (remove)', () => {
+    for (const none of [null, '', '   ', '\u00a0\u2028\ufeff']) expect(cleanPhrase(none)).toBeNull();
+  });
+
+  it('not a string (and not null) is refused — never "none"', () => {
+    for (const bad of [undefined, 3, true, ['abc'], {phrase: 'abc'}]) expect(cleanPhrase(bad)).toBeUndefined();
+  });
+
+  it.each([
+    ['NUL (Cc)', 'ab\u0000cd'],
+    ['BEL (Cc)', 'ab\u0007cd'],
+    ['TAB (Cc)', 'ab\u0009cd'],
+    ['LF (Cc)', 'ab\u000acd'],
+    ['DEL (Cc)', 'ab\u007fcd'],
+    ['NEL, C1 (Cc)', 'ab\u0085cd'],
+    ['soft hyphen (Cf)', 'ab\u00adcd'],
+    ['ZWSP (Cf)', 'ab\u200bcd'],
+    ['ZWNJ (Cf)', 'ab\u200ccd'],
+    ['ZWJ (Cf)', 'ab\u200dcd'],
+    ['LRM (Cf)', 'ab\u200ecd'],
+    ['RLM (Cf)', 'ab\u200fcd'],
+    ['LRE (bidi embedding)', 'ab\u202acd'],
+    ['RLO (bidi override)', 'ab\u202ecd'],
+    ['LRI (bidi isolate)', 'ab\u2066cd'],
+    ['PDI (bidi isolate)', 'ab\u2069cd'],
+    ['ALM (Cf)', 'ab\u061ccd'],
+    ['word joiner (Cf)', 'ab\u2060cd'],
+    ['BOM inside (Cf)', 'ab\ufeffcd'],
+    ['tag character (Cf)', 'ab\u{e0041}cd'],
+    ['line separator (Zl)', 'ab\u2028cd'],
+    ['paragraph separator (Zp)', 'ab\u2029cd'],
+    ['combining grapheme joiner', 'ab\u034fcd'],
+    ['variation selector-16', 'ab\ufe0fcd'],
+    ['family emoji (ZWJ)', '👨\u200d👩\u200d👧'],
+    ['red heart + VS16', 'love ❤\ufe0f'],
+    ['lone high surrogate (Cs)', 'ab\ud800cd'],
+    ['lone low surrogate (Cs)', 'ab\udc00cd'],
+    ['private use (Co)', 'ab\ue000cd'],
+    ['unassigned (Cn)', 'ab\u0378cd'],
+  ])('refuses a character that does not print as typed: %s', (_, s) => {
+    expect(cleanPhrase(s)).toBeUndefined();
+    // Negative control: the same phrase with each such character replaced by a plain letter is accepted as it is.
+    const plain = s.replace(/[^ -~]/gu, 'x');
+    expect(cleanPhrase(plain)).toBe(plain);
+  });
+
+  it.each([
+    ['cyrillic letters', '\u0441\u0438\u043d\u0438\u0439 \u043a\u043e\u043d\u044c'],
+    ['accented, precomposed', 'caf\u00e9 noir'],
+    ['simple emoji', 'blue 🐴 42'],
+    ['CJK', '青い馬'],
+    ['no-break space inside (Zs)', 'blue\u00a0horse'],
+    ['markup, as text', '<b>x</b>'],
+  ])('accepts printable text in any script: %s', (_, s) => {
+    expect(cleanPhrase(s)).toBe(s);
+  });
+
+  // E21: what renders blank or draws out of its line. Every string is written as \u escapes, generated by a script from
+  // its code points (never typed).
+  it('pins the combining-mark cap: three in a row', () => {
+    expect(PHRASE_MAX_MARKS).toBe(3);
+  });
+
+  it.each([
+    ['Hangul choseong filler U+115F x3 (Default_Ignorable)', '\u115f\u115f\u115f'],
+    ['Hangul jungseong filler U+1160 x3 (Default_Ignorable)', '\u1160\u1160\u1160'],
+    ['Hangul filler U+3164 x3 (Default_Ignorable)', '\u3164\u3164\u3164'],
+    ['halfwidth Hangul filler U+FFA0 x3 (Default_Ignorable)', '\uffa0\uffa0\uffa0'],
+    ['Hangul fillers around a space (Default_Ignorable)', '\u3164 \u3164'],
+    ['Khmer inherent vowel U+17B4 inside a word (Default_Ignorable)', 'ab\u17b4cd'],
+    ['Khmer inherent vowel U+17B5 inside a word (Default_Ignorable)', 'ab\u17b5cd'],
+    ['Mongolian free variation selector U+180B (Default_Ignorable, Mn)', 'ab\u180bcd'],
+    ['variation selector-17 U+E0100 (Default_Ignorable, Mn)', 'ab\u{e0100}cd'],
+    ['Braille blank U+2800 x3', '\u2800\u2800\u2800'],
+    ['Braille blank U+2800 inside a word', 'ab\u2800cd'],
+    ['replacement character U+FFFD x3', '\ufffd\ufffd\ufffd'],
+    ['object replacement character U+FFFC inside a word', 'ab\ufffccd'],
+    ['a combining tower: a + U+0300 x31 (32 code units)', 'a\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300\u0300'],
+    ['four combining marks on one letter (one over the cap)', 'x\u0301\u0302\u0303\u0304yz'],
+    ['a + U+0300 x4: NFC makes it a-grave + 3, the cap counts after NFD', 'a\u0300\u0300\u0300\u0300'],
+    ['u with diaeresis and acute (U+01D8) + 3 marks: 5 after NFD', '\u01d8\u0300\u0301\u0302xy'],
+    ['a with circumflex and dot below (U+1EAD) + 3 marks: 5 after NFD', '\u1ead\u0300\u0301\u0302xy'],
+    ['marks only: no character that draws itself', '\u0301\u0301\u0301'],
+    ['marks and no-break spaces only', '\u0301\u00a0\u0301'],
+  ])('refuses a phrase that renders blank or draws out of its line (E21): %s', (_, s) => {
+    expect(cleanPhrase(s)).toBeUndefined();
+    // Negative control: the same phrase with each such character replaced by a plain letter is accepted as it is.
+    const plain = s.replace(/[^ -~]/gu, 'x');
+    expect(cleanPhrase(plain)).toBe(plain);
+  });
+
+  it.each([
+    ['a Cyrillic phrase', '\u0441\u0438\u043d\u0438\u0439 \u043a\u043e\u043d\u044c 42'],
+    ['one accent mark on a letter with no precomposed form', 'x\u0301yz'],
+    ['exactly PHRASE_MAX_MARKS marks on one letter', 'x\u0301\u0302\u0303yz'],
+    ['Thai: a vowel and a tone mark on one consonant (2 marks)', '\u0e19\u0e35\u0e49\u0e19\u0e30'],
+    ['pointed Hebrew: a dagesh, a vowel and a shin dot on one letter (3 marks)', '\u05e9\u05b8\u05bc\u05c1\u05dc\u05d5\u05b9\u05dd'],
+    ['Tibetan: a stack of three marks on one letter', '\u0f66\u0f92\u0fb2\u0f74\u0f56\u0f66'],
+    ['Vietnamese, precomposed (2 marks per letter after NFD)', 'Ti\u1ebfng Vi\u1ec7t'],
+    ['a + U+0300 x3: a-grave + 2, 3 after NFD', '\u00e0\u0300\u0300'],
+    ['Arabic: shadda, fatha and superscript alef on one letter (3 marks)', '\u0628\u064e\u0651\u0670\u0627\u0628'],
+    ['polytonic Greek: alpha with psili, oxia and ypogegrammeni (U+1F84, 3 after NFD)', '\u1f84\u03bd\u03b1'],
+    ['Hangul syllables (their NFD jamo are letters)', '\ud55c\uad6d\uc5b4'],
+    ['Hebrew and digits', '\u05e9\u05dc\u05d5\u05dd 42'],
+    ['16 emoji (32 code units)', '\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}\u{1f600}'],
+    ['32 wide letters', 'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW'],
+  ])('accepts (E21 positive control): %s', (_, s) => {
+    expect(cleanPhrase(s)).toBe(s);
+  });
+
+  it('a clean phrase is its own cleaning (the stored value is re-judged on every read)', () => {
+    for (const s of ['Blue horse 42', 'caf\u00e9 noir', '青い馬']) expect(cleanPhrase(cleanPhrase(s))).toBe(s);
+  });
+});
```

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs` (the key rule and the built content scripts):

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index f5e8141..2b32feb 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -4,7 +4,7 @@ import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {
   ENTRIES,
-  bundleViolations, htmlViolations, listSourceFiles, manifestViolations, nonVaultModuleViolations, bundledWebAuthnViolations, sourceViolations, vaultPageModuleViolations, vaultPageViolations, webAuthnViolations,
+  bundleViolations, contentStorageViolations, htmlViolations, listSourceFiles, manifestViolations, nonVaultModuleViolations, bundledWebAuthnViolations, sourceViolations, vaultPageModuleViolations, vaultPageViolations, webAuthnViolations,
   BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, REACT_MARKER, VAULT_MARKER, WEBAUTHN_MARKER, WORDLIST_MARKER,
 } from '../check-vault-isolation.mjs';
 import {render} from '../../manifest/source.mjs';
@@ -406,6 +406,15 @@ describe('vault isolation (storage, and what may import src/ext.ts)', () => {
     expect(sourceViolations([f('src/app/presale/client.ts', "const k = 'v1_presale_records';")])).toEqual([OWNED('src/app/presale/client.ts', 'v1_presale_records')]);
     expect(sourceViolations([f('src/unlock/presale.ts', '// v1_presale_records')])).toEqual([OWNED('src/unlock/presale.ts', 'v1_presale_records')]);
   });
+  // B1e §1.4 (R2): the anti-phishing phrase is the background's — a page naming v1_phishing_phrase could write it around
+  // #10's proof.
+  it('lets only the background name the anti-phishing phrase key (v1_phishing_phrase)', () => {
+    const OWNED = (path, key) => `${path}: names ${key}, which only the background may write`;
+    expect(sourceViolations([f('src/background/phraseKey.ts', "export const PHRASE_KEY = 'v1_phishing_phrase';")])).toEqual([]);
+    expect(sourceViolations([f('src/unlock/screens/unlock.ts', "const k = 'v1_phishing_phrase';")])).toEqual([OWNED('src/unlock/screens/unlock.ts', 'v1_phishing_phrase')]);
+    expect(sourceViolations([f('src/app/screens/Security.tsx', '// v1_phishing_phrase')])).toEqual([OWNED('src/app/screens/Security.tsx', 'v1_phishing_phrase')]);
+    expect(sourceViolations([f('src/approve/Sign.tsx', "const k = 'v1_phishing_phrase';")])).toEqual([OWNED('src/approve/Sign.tsx', 'v1_phishing_phrase')]);
+  });
   // B1c §1.7 (review L13): src/approve is held like src/app — no storage, no runtime listener, no ext.ts — and its page
   // may load only its own entry.
   it('holds src/approve like src/app: no storage, no runtime listener, no ext.ts; approve.html loads only src/approve/main.tsx', () => {
@@ -1219,6 +1228,44 @@ describe('vault isolation (built output)', () => {
   });
 });
 
+// B1e §1.6 (I2): the two content scripts as BUILT reach no extension storage — the source rule (TOUCHES_STORAGE outside
+// src/background and src/ext.ts) is the first line, this the second.
+describe('vault isolation (the built content scripts carry no storage)', () => {
+  let dir;
+  const write = (name, text) => writeFileSync(join(dir, name), text);
+  beforeEach(() => {
+    dir = mkdtempSync(join(tmpdir(), 'vault-iso-content-'));
+    // What the build gives today (shapes of the real files): the relay reaches runtime.connect only, the provider no API.
+    write('relay.js', '(function(){var t=globalThis,n=t.browser??t.chrome;n.runtime.connect({name:`noctura-page`});})();');
+    write('provider.js', '(function(){window.addEventListener(`message`,e=>e);var s=window.localStorage,u=window.sessionStorage;})();');
+  });
+  afterEach(() => rmSync(dir, {recursive: true, force: true}));
+
+  it('passes the two files as built today (localStorage / sessionStorage are not extension storage)', () => {
+    expect(contentStorageViolations(dir)).toEqual([]);
+  });
+
+  it.each([
+    ['a property access', 'n.storage.local.get(`v1_vault`)', '.storage'],
+    ['an optional access', 'n?.storage?.local', '?.storage'],
+    ['a bracket', 'n[`storage`].local', '[`storage`]'],
+    ['a quoted bracket', "n['storage'].local", "['storage']"],
+    ['a destructuring key', 'var{storage:s}=n;', '{storage:'],
+    ['a shorthand destructuring', 'var{runtime:r,storage}=n;', ',storage}'],
+  ])('refuses %s in relay.js and in provider.js', (_, code, hit) => {
+    for (const name of ['relay.js', 'provider.js']) {
+      write(name, `(function(){var n=globalThis.chrome;${code}})();`);
+      expect(contentStorageViolations(dir)).toEqual([`${name} touches extension storage (${hit}) — a content script reaches none`]);
+      write(name, '(function(){})();');
+    }
+  });
+
+  it('a missing file is INCONCLUSIVE, never a pass', () => {
+    rmSync(join(dir, 'relay.js'));
+    expect(contentStorageViolations(dir)).toEqual(['INCONCLUSIVE: relay.js is missing — the content-script storage rule would pass trivially']);
+  });
+});
+
 describe('vault isolation (manifest)', () => {
   const withWar = (war, browser = 'chrome') => ({...render(browser), web_accessible_resources: war});
 
```

Modify `extension/src/background/__tests__/messages.test.ts` (`vault.status`'s field; `settings.phrase` in the literal list):

```diff
diff --git a/extension/src/background/__tests__/messages.test.ts b/extension/src/background/__tests__/messages.test.ts
index 62b278c..3f2c659 100644
--- a/extension/src/background/__tests__/messages.test.ts
+++ b/extension/src/background/__tests__/messages.test.ts
@@ -147,10 +147,10 @@ describe('message partitions', () => {
 
   it('vault.status reports locked/unlocked without keys', async () => {
     const ext = vaultExt();
-    expect(await handleMessage(ext, {type: 'vault.status'}, popup)).toEqual({ok: true, data: {unlocked: false, accounts: []}});
+    expect(await handleMessage(ext, {type: 'vault.status'}, popup)).toEqual({ok: true, data: {unlocked: false, accounts: [], phrase: null}});
     await handleMessage(ext, {type: 'vault.setKeys', accounts: ACC}, unlockPage);
     const r = await handleMessage(ext, {type: 'vault.status'}, popup);
-    expect(r).toEqual({ok: true, data: {unlocked: true, accounts: [{index: 0, publicKey: ACC[0]?.publicKey}]}});
+    expect(r).toEqual({ok: true, data: {unlocked: true, accounts: [{index: 0, publicKey: ACC[0]?.publicKey}], phrase: null}});
     expect(JSON.stringify(r)).not.toContain('secretKey');
   });
 
@@ -212,6 +212,8 @@ describe('message partitions (B1b-1 types)', () => {
     'vault.setKeys', 'vault.lock', 'vault.status', 'vault.reauthOk', 'vault.storeEnvelope', 'vault.challengeInfo', 'vault.forgetWallet', 'vault.changePassword', 'vault.removePasskey', 'vault.phraseVerified', 'vault.forgetDamaged', 'activity.ping',
     'wallet.state', 'wallet.balances', 'wallet.probeBalances', 'wallet.prepareSend', 'wallet.send', 'wallet.resend',
     'wallet.pending', 'wallet.preparedFor', 'wallet.history', 'wallet.prices', 'wallet.cached', 'wallet.recipientInfo', 'wallet.discardPrepared', 'accounts.rename', 'accounts.select', 'accounts.order', 'settings.get', 'settings.set',
+    // B1e §1.3: the anti-phishing phrase's one write.
+    'settings.phrase',
     'contacts.list', 'contacts.set', 'contacts.remove',
     // B1c §1.4: the approval window's and #49's; B1c-2: the popup's offer of #10 for a site's transaction (D11).
     'dapp.pending', 'dapp.decide', 'dapp.grants.list', 'dapp.grants.revoke', 'dapp.grants.undo', 'dapp.grants.revokeAll', 'dapp.blocked.list', 'dapp.blocked.remove', 'dapp.reauth',
```

Modify `extension/src/background/__tests__/walletApi.test.ts` (`wallet.state`'s field):

```diff
diff --git a/extension/src/background/__tests__/walletApi.test.ts b/extension/src/background/__tests__/walletApi.test.ts
index 02ab435..c140b4a 100644
--- a/extension/src/background/__tests__/walletApi.test.ts
+++ b/extension/src/background/__tests__/walletApi.test.ts
@@ -25,13 +25,13 @@ const NOC = WALLET_TOKENS.NOC.mint as string;
 describe('handleWallet', () => {
   it('wallet.state: public account data, lock state and the selected account', async () => {
     const ext = fakeExt();
-    expect(await handleWallet(ext, fakeDeps(), 'wallet.state', {})).toEqual({ok: true, data: {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null, passkey: false}});
+    expect(await handleWallet(ext, fakeDeps(), 'wallet.state', {})).toEqual({ok: true, data: {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null, passkey: false, phrase: null}});
     await ext.local.set(VAULT_KEY, ENV);
     await unlocked(ext);
     await ext.local.set(SETTINGS_KEY, {selectedAccount: 3});
     await setSession(ext, [ACCOUNT, OTHER]);
     const r = await handleWallet(ext, fakeDeps(), 'wallet.state', {});
-    expect(r).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 3, passkey: false}});
+    expect(r).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 3, passkey: false, phrase: null}});
     expect(JSON.stringify(r)).not.toContain('secretKey');
   });
 
```

Modify `extension/src/background/dapp/__tests__/decide.test.ts` (`dapp.pending`'s field):

```diff
diff --git a/extension/src/background/dapp/__tests__/decide.test.ts b/extension/src/background/dapp/__tests__/decide.test.ts
index 31880fb..dc18523 100644
--- a/extension/src/background/dapp/__tests__/decide.test.ts
+++ b/extension/src/background/dapp/__tests__/decide.test.ts
@@ -49,7 +49,7 @@ describe('who may ask (§1.4)', () => {
     const tab = {...popup, url: `${ext.extensionOrigin}/wallet.html`};
     const web = {id: ext.runtimeId, origin: DAPP, url: `${DAPP}/approve.html`, tab: {id: 1}, frameId: 0};
     for (const s of [popup, unlock, tab, web]) expect(await handleMessage(ext, {type: 'dapp.pending'}, s, deps)).toEqual({ok: false, error: 'forbidden'});
-    expect(await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)).toEqual({ok: true, data: {state: 'none'}});
+    expect(await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)).toEqual({ok: true, data: {state: 'none', phrase: null}});
     for (const s of [approve, unlock, web]) expect(await handleMessage(ext, {type: 'dapp.grants.list'}, s, deps)).toEqual({ok: false, error: 'forbidden'});
     for (const s of [popup, tab]) expect(await handleMessage(ext, {type: 'dapp.grants.list'}, s, deps)).toEqual({ok: true, data: {grants: []}});
   });
@@ -74,7 +74,7 @@ describe('approve.html may send dapp.pending and dapp.decide only (final review
     expect(await getSession(ext)).not.toBeNull();
     expect(ext.alarmsSet.size).toBe(0);
     // Positive controls: the window's own two pass; the popup's vault.status is not affected by the window's list.
-    expect(await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)).toEqual({ok: true, data: {state: 'none'}});
+    expect(await handleMessage(ext, {type: 'dapp.pending'}, approve, deps)).toEqual({ok: true, data: {state: 'none', phrase: null}});
     expect(await handleMessage(ext, {type: 'dapp.decide', requestId: 'A'.repeat(22), decision: 'reject'}, approve, deps)).not.toEqual({ok: false, error: 'forbidden'});
     expect(await handleMessage(ext, {type: 'vault.status'}, popup, deps)).toMatchObject({ok: true});
   });
@@ -91,6 +91,8 @@ describe('dapp.pending (§2.3, §4.3)', () => {
       state: 'request',
       waiting: 1,
       windowNotice: false,
+      // B1e §1.4: the anti-phishing phrase, a top-level field in every state (none set here).
+      phrase: null,
       request: {
         requestId,
         type: 'connect',
```

Modify `extension/vitest.nopresale.config.ts` (both builds):

```diff
diff --git a/extension/vitest.nopresale.config.ts b/extension/vitest.nopresale.config.ts
index 2573021..1f7b0b9 100644
--- a/extension/vitest.nopresale.config.ts
+++ b/extension/vitest.nopresale.config.ts
@@ -10,6 +10,7 @@ import {appConfig} from './vite.config';
 export const NOPRESALE_TESTS = [
   'src/__tests__/presaleSwitch.test.ts',
   'src/background/__tests__/messages.test.ts',
+  'src/background/__tests__/phrase.test.ts',
   'src/app/__tests__/router.test.ts',
   'src/app/__tests__/App.test.tsx',
   'src/unlock/__tests__/challenge.test.ts',
```

Modify `extension/e2e/presaleSwitch.spec.ts` — `vault.status` gains `phrase` in this task, so the one E2E row that asserts its whole answer changes here, in the same commit (rev 1: moved from Task 7, where the whole-suite run found it red since this task — the controller's ruling):

```diff
diff --git a/extension/e2e/presaleSwitch.spec.ts b/extension/e2e/presaleSwitch.spec.ts
index 39de9df..9041fad 100644
--- a/extension/e2e/presaleSwitch.spec.ts
+++ b/extension/e2e/presaleSwitch.spec.ts
@@ -21,7 +21,8 @@ for (const [name, ext, presale] of [
       const popup = await h.openPopup();
       await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
       const status = await popup.evaluate(() => chrome.runtime.sendMessage({type: 'vault.status'}));
-      expect(status).toEqual({ok: true, data: {unlocked: true, accounts: [{index: MAIN.index, publicKey: MAIN.publicKey}, expect.objectContaining({index: 1})]}});
+      // B1e §1.4: vault.status carries the anti-phishing phrase (none set here).
+      expect(status).toEqual({ok: true, data: {unlocked: true, accounts: [{index: MAIN.index, publicKey: MAIN.publicKey}, expect.objectContaining({index: 1})], phrase: null}});
       // B1d-1b: the on build registers presale.view (its handler refuses a payload without an account); the off build has
       // no such type — an unknown type, refused before any handler.
       expect(await popup.evaluate(() => chrome.runtime.sendMessage({type: 'presale.view'}))).toEqual({ok: false, error: presale ? 'malformed' : 'unknown type'});
```

- [ ] **Step 2: Run — red.**

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `2` (TS2305 `cleanPhrase` / `PHRASE_LENGTH` / `takePhraseChallenge` / `PhraseStep` not exported; TS2307 `../phraseKey` not found; TS2353 `phraseStep` not in the runs' options — vitest runs regardless).
Run: `TZ=UTC npx vitest run src/shared/__tests__/envelopeRules.test.ts src/background/__tests__/phrase.test.ts src/unlock/__tests__/phraseStep.test.ts scripts/__tests__/check-vault-isolation.test.mjs src/background/__tests__/messages.test.ts src/background/__tests__/walletApi.test.ts src/background/dapp/__tests__/decide.test.ts`
Expected on Task 3's tree: `Test Files  7 failed (7)` · `Tests  92 failed | 514 passed (606)` (rev 2.1, observed on 31a4a44 with this task's test files) — `phrase.test.ts` and `phraseStep.test.ts` fail to load (`Cannot find module '../phraseKey'`); envelopeRules 77 (every `cleanPhrase` row: not a function — rev 1's 42, rev 2's 27, rev 2.1's 8), check-vault-isolation 9 (the key row; every `contentStorageViolations` row: not a function), messages 2 (`vault.status` has no `phrase`; `settings.phrase` is `unknown type`), walletApi 1 and decide 3 (no `phrase` field). (Observed: the final test files on Task 3's tree 40aefcb in a scratch copy.)
Run (the E2E row; both builds of Task 3's tree with only `e2e/presaleSwitch.spec.ts` changed — observed at rev 1 on 38ceea0 in a scratch copy): `node scripts/build.mjs && node scripts/build.mjs --no-presale && npx playwright test e2e/presaleSwitch.spec.ts` — `2 failed`, both builds (“switch · the on (dist) build boots …”, “switch · the off (dist-nopresale) build boots …”): `- Expected` `"phrase": null`, received without it.

- [ ] **Step 3: Implement.**

Create `extension/src/background/phraseKey.ts`:

```ts
/**
 * B1e §1.4: storage.local `v1_phishing_phrase` — the anti-phishing phrase, plain text, written only by the background
 * (phrase.ts; scripts/check-vault-isolation.mjs BACKGROUND_OWNED_KEYS). The key lives alone here because accountsStore's
 * WALLET_DATA_KEYS names it: a delete and a first write wipe it, a restore keeps it.
 */
export const PHRASE_KEY = 'v1_phishing_phrase';
```

Create `extension/src/background/phrase.ts`:

```ts
import type {Ext} from '../ext';
import type {WalletDeps} from './deps';
import {REAUTH_KEY, getSession, sessionMutex} from './session';
import {settingsMutex} from './settings';
import {issueChallenge, takePhraseChallenge} from './reauthChallenges';
import {digestOf} from './digest';
import {cleanPhrase} from '../shared/envelopeRules';
import {PHRASE_KEY} from './phraseKey';
import type {Result} from './walletApi';

const MALFORMED: Result = {ok: false, error: 'malformed'};
const LOCKED: Result = {ok: false, error: 'locked'};

/**
 * B1e §1.4: the stored anti-phishing phrase, or null. A stored value is a claim: anything that is not exactly a phrase
 * cleanPhrase would store reads as none.
 */
export async function readPhrase(ext: Ext): Promise<string | null> {
  const raw = await ext.local.get(PHRASE_KEY);
  return typeof raw === 'string' && cleanPhrase(raw) === raw ? raw : null;
}

async function writePhrase(ext: Ext, phrase: string | null): Promise<void> {
  if (phrase === null) await ext.local.remove(PHRASE_KEY);
  else await ext.local.set(PHRASE_KEY, phrase);
}

/**
 * settings.phrase {phrase: string | null} (B1e §1.3, R1 = E18). The value is cleaned (§1.5); then, under settingsMutex:
 * equal to the stored one → `unchanged` (nothing written); no session → `locked`; none stored → written at once (`set`:
 * adding a protection needs only the unlocked session — a locked profile cannot plant a phrase someone knows); a change
 * or a removal → a `phrase` challenge bound to the cleaned value, answered `reauth-required {challengeId}`, applied only
 * by vault.reauthOk (applyPhraseChallenge). The session check and the first write share one sessionMutex section, so a
 * lock is ordered wholly before or after them. Every refusal is a fixed code: no answer carries the value, nothing logs
 * it. A message carrying `challengeId` is malformed (as settings.set: no re-call path).
 */
export async function setPhrase(ext: Ext, deps: Pick<WalletDeps, 'now' | 'randomBytes'>, msg: Record<string, unknown>): Promise<Result> {
  if (msg.challengeId !== undefined) return MALFORMED;
  const next = cleanPhrase(msg.phrase);
  if (next === undefined) return MALFORMED;
  return settingsMutex(async (): Promise<Result> => {
    const step = await sessionMutex(async () => {
      const stored = await readPhrase(ext);
      if (stored === next) return 'unchanged' as const;
      if ((await getSession(ext)) === null) return 'locked' as const;
      if (stored === null && next !== null) {
        await writePhrase(ext, next);
        return 'set' as const;
      }
      return 'proof' as const;
    });
    if (step === 'locked') return LOCKED;
    if (step !== 'proof') return {ok: true, data: {outcome: step}};
    const about = {kind: 'phrase' as const, phrase: next};
    // issueChallenge takes sessionMutex itself (it is not re-entrant): never called inside it here.
    const challengeId = await issueChallenge(ext, deps, digestOf('phrase', about), about);
    // A lock that raced past the challenge's write: remove just the challenges, under the mutex the lock takes (as
    // setSettings does).
    const lockedMeanwhile = await sessionMutex(async () => {
      if ((await getSession(ext)) !== null) return false;
      await ext.session.remove(REAUTH_KEY);
      return true;
    });
    return lockedMeanwhile ? LOCKED : {ok: false, error: 'reauth-required', data: {challengeId}};
  });
}

/**
 * B1e §1.3: #10's Confirm satisfied a `phrase` challenge — the background applies the value it bound at issue. Inside
 * settingsMutex: the challenge is taken (deleted in the section that reads it: applied exactly once), then its value is
 * written over whatever is stored now — the last confirmed proof wins, as for settings (review M6). Refusals:
 * `unknown-challenge` (absent, expired, applied, another kind), `locked`, `failed` (a storage error).
 */
export async function applyPhraseChallenge(ext: Ext, deps: Pick<WalletDeps, 'now'>, challengeId: string): Promise<Result> {
  try {
    return await settingsMutex(async (): Promise<Result> => {
      const taken = await takePhraseChallenge(ext, deps.now(), challengeId);
      if (taken === 'unknown-challenge' || taken === 'locked') return {ok: false, error: taken};
      await writePhrase(ext, taken.phrase);
      return {ok: true, data: {applied: 'phrase'}};
    });
  } catch {
    return {ok: false, error: 'failed'};
  }
}
```

`extension/src/shared/envelopeRules.ts`:

```diff
diff --git a/extension/src/shared/envelopeRules.ts b/extension/src/shared/envelopeRules.ts
index aea0261..9c3ecd8 100644
--- a/extension/src/shared/envelopeRules.ts
+++ b/extension/src/shared/envelopeRules.ts
@@ -50,6 +50,44 @@ export function cleanName(x: unknown): string | null {
   return name;
 }
 
+/** B1e §1.5: the anti-phishing phrase's length, in UTF-16 code units (as cleanName counts). */
+export const PHRASE_LENGTH = {min: 3, max: 32} as const;
+/**
+ * B1e §1.5 (E21): the most combining marks one character may carry in a row, counted on the canonical decomposition
+ * (NFD), so a precomposed letter's own marks count. Thai (a vowel and a tone mark) needs two, pointed Hebrew (a dagesh,
+ * a vowel and a shin dot), Tibetan stacks and polytonic Greek three; a fourth mark only builds a tower that draws above
+ * or below the line — over the header the line sits under.
+ */
+export const PHRASE_MAX_MARKS = 3;
+// B1e §1.5 ("printable only"): on top of FORBIDDEN_IN_NAME, a phrase may not hold a lone surrogate (Cs), a private-use
+// character (Co) or an unassigned code point (Cn) — none of them prints as the text the user typed.
+const NOT_PRINTABLE = /[\p{Cs}\p{Co}\p{Cn}]/u;
+// B1e §1.5 (E21): nor a character that renders blank — every Default_Ignorable code point (the Hangul fillers U+115F,
+// U+1160, U+3164, U+FFA0, the Khmer inherent vowels U+17B4, U+17B5, the Mongolian and supplementary variation selectors
+// among them) and the Braille blank U+2800 — nor the two that stand in for a character that could not be shown (U+FFFC,
+// U+FFFD): a phishing page draws an empty or a broken line as easily as it draws none.
+const BLANK = /[\p{Default_Ignorable_Code_Point}\u2800\ufffc\ufffd]/u;
+const STACKED = new RegExp(`\\p{M}{${PHRASE_MAX_MARKS + 1}}`, 'u');
+// B1e §1.5 (E21): at least one character that draws itself — a letter, number, symbol or punctuation (never a mark).
+const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;
+
+/**
+ * B1e §1.5: the anti-phishing phrase as stored — NFC-normalised, then trimmed; PHRASE_LENGTH code units; no character of
+ * FORBIDDEN_IN_NAME (so a bidi override cannot restyle the line, and no invisible character makes two phrases look
+ * alike), none that does not print or renders blank, no more than PHRASE_MAX_MARKS combining marks in a row (counted
+ * after NFD), and at least one visible character (E21). `null`: no phrase (null, or a string empty after trimming —
+ * "remove"). `undefined`: refused.
+ */
+export function cleanPhrase(x: unknown): string | null | undefined {
+  if (x === null) return null;
+  if (typeof x !== 'string') return undefined;
+  const phrase = x.normalize('NFC').trim();
+  if (phrase.length === 0) return null;
+  if (phrase.length < PHRASE_LENGTH.min || phrase.length > PHRASE_LENGTH.max || FORBIDDEN_IN_NAME.test(phrase) || NOT_PRINTABLE.test(phrase)) return undefined;
+  if (BLANK.test(phrase) || STACKED.test(phrase.normalize('NFD')) || !VISIBLE.test(phrase)) return undefined;
+  return phrase;
+}
+
 /**
  * The POLICY rules an envelope's account list must obey, on top of being well-shaped (an index is a
  * safe non-negative integer, a publicKey is a string — each side's own job: the vault's checkEnvelope,
```

`extension/src/background/reauthChallenges.ts`:

```diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
index 785df6b..5322071 100644
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -6,6 +6,7 @@ import type {DappReauthReason, SendReauthReason} from './reauthPolicy';
 import type {FeeReason} from '../../../core/fees/transferMarkup';
 import {WALLET_TOKENS} from '../../../core/solana/balances';
 import {SITE} from '../shared/site';
+import {cleanPhrase} from '../shared/envelopeRules';
 import {ALLOWANCE_WORD, APPROVAL_SYMBOLS, OVERRIDE_WORDS, type RedFlagKind} from './dapp/redFlags';
 import {intentKind, type KindAbout} from './intents';
 
@@ -43,6 +44,8 @@ export type ChallengeAbout =
       thresholdCents: number;
     }
   | {kind: 'settings'; autoLockMinutes: number | null; reauthUsdCents: number | null}
+  /** B1e §1.3 (R1): a change (the new phrase) or a removal (null) of the anti-phishing phrase, applied by vault.reauthOk. */
+  | {kind: 'phrase'; phrase: string | null}
   /**
    * B1c-2 (spec B1c §3.3): a dApp's transaction request — the site as the window shows it (host, or host:port), how
    * many transactions it signs, what leaves the account per mint (null = SOL; positive base units; decimals when known)
@@ -96,14 +99,15 @@ export const FLAG_ROW: Record<Exclude<RedFlagKind, 'presale-region'>, FlagRow> =
 };
 
 /**
- * What a stored challenge stands for: one of the shared three, or (B1d §1.3) a registered kind's own description —
+ * What a stored challenge stands for: one of the shared four, or (B1d §1.3) a registered kind's own description —
  * `presale-buy` in the build with presale — accepted only through that kind's `isAbout`. In the build without it no
  * other kind is registered, so such a record is dropped as malformed (fail closed).
  */
 export type StoredAbout = ChallengeAbout | KindAbout;
-const SHARED_KINDS: readonly string[] = ['send', 'settings', 'dapp'];
+const SHARED_KINDS: readonly string[] = ['send', 'settings', 'dapp', 'phrase'];
 const sendAbout = (a: StoredAbout): a is Extract<ChallengeAbout, {kind: 'send'}> => a.kind === 'send';
 const settingsAbout = (a: StoredAbout): a is Extract<ChallengeAbout, {kind: 'settings'}> => a.kind === 'settings';
+const phraseAbout = (a: StoredAbout): a is Extract<ChallengeAbout, {kind: 'phrase'}> => a.kind === 'phrase';
 /** A stored about whose kind is `dapp` (isAbout admits no other shape under that name). */
 export const isDappAbout = (a: StoredAbout): a is Extract<ChallengeAbout, {kind: 'dapp'}> => a.kind === 'dapp';
 
@@ -169,6 +173,8 @@ export function isAbout(x: unknown): x is StoredAbout {
     return k?.isAbout !== undefined && k.isAbout(a as KindAbout);
   }
   if (a.kind === 'settings') return isIntOrNull(a.autoLockMinutes) && isIntOrNull(a.reauthUsdCents) && Object.keys(a).length === 3;
+  // B1e §1.3: the value is a phrase exactly as cleanPhrase stores it, or null (remove).
+  if (a.kind === 'phrase') return (a.phrase === null || (typeof a.phrase === 'string' && cleanPhrase(a.phrase) === a.phrase)) && Object.keys(a).length === 2;
   if (a.kind === 'dapp') {
     const outgoing = a.outgoing;
     const reasons = a.reasons;
@@ -453,6 +459,24 @@ export async function takeSettingsChallenge(ext: Ext, now: number, id: string):
   });
 }
 
+/**
+ * B1e §1.3 (R1): takeSettingsChallenge's counterpart for the anti-phishing phrase — under sessionMutex, in ONE section:
+ * an unknown, expired or non-phrase id is `unknown-challenge`; no session is `locked`; otherwise the record is DELETED
+ * (single use) and the value bound at issue returned. Only a `phrase` challenge is ever taken here.
+ */
+export async function takePhraseChallenge(ext: Ext, now: number, id: string): Promise<{phrase: string | null} | 'unknown-challenge' | 'locked'> {
+  if (!CHALLENGE_ID.test(id)) return 'unknown-challenge';
+  return sessionMutex(async () => {
+    const store = live(await load(ext), now);
+    const c = store.get(id);
+    if (c === undefined || !phraseAbout(c.about)) return 'unknown-challenge';
+    if ((await getSession(ext)) === null) return 'locked';
+    store.delete(id);
+    await save(ext, store);
+    return {phrase: c.about.phrase};
+  });
+}
+
 /** Remove every challenge bound to one of these digests (wallet.discardPrepared, E7). Under sessionMutex by the caller. */
 export async function dropChallengesFor(ext: Ext, digests: ReadonlySet<string>): Promise<void> {
   const store = await load(ext);
```

`extension/src/background/walletApi.ts`:

```diff
diff --git a/extension/src/background/walletApi.ts b/extension/src/background/walletApi.ts
index 9f33e93..f856eba 100644
--- a/extension/src/background/walletApi.ts
+++ b/extension/src/background/walletApi.ts
@@ -20,6 +20,7 @@ import {readCachedBalances, readCachedPrices, writeCachedBalances, writeCachedPr
 import {readWalletBalances, WALLET_TOKENS} from '../../../core/solana/balances';
 import {RequestUnreachable, RpcForbidden} from '../../../core/solana/rpc';
 import {dappTxSignatures} from './dapp/dappTxs';
+import {readPhrase, setPhrase} from './phrase';
 
 export type Result = {ok: true; data?: unknown} | {ok: false; error: string; data?: unknown};
 
@@ -42,6 +43,8 @@ export const WALLET_TYPES = [
   'accounts.order',
   'settings.get',
   'settings.set',
+  // B1e §1.3: set, change or remove the anti-phishing phrase (never from the approval window: APPROVE_PAGE_ALLOWED).
+  'settings.phrase',
   'contacts.list',
   'contacts.set',
   'contacts.remove',
@@ -115,8 +118,9 @@ export function displayOrder<T extends {index: number}>(accounts: readonly T[],
 }
 
 async function walletState(ext: Ext) {
-  const [view, session, settings] = await Promise.all([readWalletView(ext), getSession(ext), readSettings(ext)]);
-  if (view === null) return {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null, passkey: false};
+  const [view, session, settings, phrase] = await Promise.all([readWalletView(ext), getSession(ext), readSettings(ext), readPhrase(ext)]);
+  // B1e §1.4: the anti-phishing phrase rides on this answer (locked or unlocked) — the popup's and the UI tab's one read of it.
+  if (view === null) return {hasWallet: false, unlocked: false, scheme: null, accounts: [], selected: null, passkey: false, phrase};
   const accounts = displayOrder(view.accounts, settings.accountOrder);
   // The selection is only ever an account that exists: in the envelope, and — while unlocked — in the
   // session too (an account removed in the vault page must not stay selected). Otherwise the first such
@@ -124,7 +128,7 @@ async function walletState(ext: Ext) {
   const inSession = (i: number) => session === null || session.some(a => a.index === i);
   const choices = accounts.map(a => a.index).filter(inSession);
   const selected = choices.includes(settings.selectedAccount) ? settings.selectedAccount : (choices[0] ?? accounts[0]?.index ?? null);
-  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts, selected, passkey: view.passkey};
+  return {hasWallet: true, unlocked: session !== null, scheme: view.scheme, accounts, selected, passkey: view.passkey, phrase};
 }
 
 /** Balances for onboarding's candidate addresses: public keys in, public numbers out. */
@@ -421,6 +425,8 @@ export async function handleWallet(ext: Ext, deps: WalletDeps, type: WalletType,
         return {ok: true, data: await readSettings(ext)};
       case 'settings.set':
         return await setSettings(ext, deps, msg);
+      case 'settings.phrase':
+        return await setPhrase(ext, deps, msg);
       // B1b-2b E17 (C12): every one refused while locked — the book says whom the user pays.
       case 'contacts.list': {
         const contacts = await listContacts(ext);
```

`extension/src/background/messages.ts`:

```diff
diff --git a/extension/src/background/messages.ts b/extension/src/background/messages.ts
index 068cda7..9c12c05 100644
--- a/extension/src/background/messages.ts
+++ b/extension/src/background/messages.ts
@@ -17,6 +17,7 @@ import {runUnlockHook} from './dapp/queue';
 import {dropAccountGrants, listBlocked, listGrants, revokeAll, revokeGrant, undoRevoke, unblock} from './dapp/grantsApi';
 import {reauthWaiting} from './dapp/signTx';
 import {PRESALE_MESSAGE_TYPES} from './presale/api';
+import {applyPhraseChallenge, readPhrase} from './phrase';
 import type {PresaleHandler} from './presaleHost';
 
 /** What the browser reports about a message's origin (runtime.MessageSender). */
@@ -223,7 +224,8 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       return {ok: true};
     case 'vault.status': {
       const s = await getSession(ext);
-      return {ok: true, data: {unlocked: s !== null, accounts: (s ?? []).map(a => ({index: a.index, publicKey: a.publicKey}))}};
+      // B1e §1.4: the anti-phishing phrase for the vault page's #9 and #10, locked or unlocked.
+      return {ok: true, data: {unlocked: s !== null, accounts: (s ?? []).map(a => ({index: a.index, publicKey: a.publicKey})), phrase: await readPhrase(ext)}};
     }
     case 'activity.ping':
       if ((await getSession(ext)) !== null) await armAutolock(ext);
@@ -237,6 +239,8 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       // message carries only the id. A send challenge (or an unknown one) is satisfied as before (D38).
       const about = await challengeInfo(ext, deps.now(), challengeId);
       if (about?.kind === 'settings') return applySettingsChallenge(ext, deps, challengeId);
+      // B1e §1.3: so is a phrase challenge, from the value it bound.
+      if (about?.kind === 'phrase') return applyPhraseChallenge(ext, deps, challengeId);
       return (await satisfyChallenge(ext, deps.now(), challengeId)) ? {ok: true} : {ok: false, error: 'unknown-challenge'};
     }
     case 'vault.challengeInfo': {
@@ -246,7 +250,9 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       if ((await getSession(ext)) === null) return {ok: false, error: 'locked'};
       // The description comes only from here, never from the vault page's URL (E3).
       const about = await challengeInfo(ext, deps.now(), challengeId);
-      return about === null ? {ok: false, error: 'unknown-challenge'} : {ok: true, data: about};
+      if (about === null) return {ok: false, error: 'unknown-challenge'};
+      // B1e §1.3: #10 says "Change …" or "Remove the anti-phishing phrase" — never the value, so the value never comes.
+      return {ok: true, data: about.kind === 'phrase' ? {kind: 'phrase', action: about.phrase === null ? 'remove' : 'change'} : about};
     }
     case 'vault.forgetWallet': {
       if (deps === undefined) return {ok: false, error: 'unavailable'};
@@ -336,7 +342,8 @@ export async function handleMessage(ext: Ext, msg: unknown, sender: Sender, deps
       }
     }
     case 'dapp.pending':
-      return deps === undefined ? {ok: false, error: 'unavailable'} : {ok: true, data: await pending(ext, deps)};
+      // B1e §1.4: the approval window's one read of the anti-phishing phrase, a top-level field in every state.
+      return deps === undefined ? {ok: false, error: 'unavailable'} : {ok: true, data: {...(await pending(ext, deps)), phrase: await readPhrase(ext)}};
     case 'dapp.decide': {
       if (deps === undefined) return {ok: false, error: 'unavailable'};
       const d = decideRequestOf(msg as Record<string, unknown>);
```

`extension/src/background/accountsStore.ts`:

```diff
diff --git a/extension/src/background/accountsStore.ts b/extension/src/background/accountsStore.ts
index 564cd90..f88e58b 100644
--- a/extension/src/background/accountsStore.ts
+++ b/extension/src/background/accountsStore.ts
@@ -14,6 +14,7 @@ import {LIMITS_KEY} from './dapp/limits';
 import {DAPP_TXS_KEY} from './dapp/dappTxs';
 import {wipeDappStores} from './dapp/store';
 import {PRESALE_RECORDS_KEY, wipePresaleRecords} from './presaleRecordsKey';
+import {PHRASE_KEY} from './phraseKey';
 import {ENVELOPE_BYTES, ENVELOPE_KDF_MAX, ENVELOPE_KDF_MIN, MAX_ACCOUNTS, accountsPolicyOk, b64Length, cleanName} from '../shared/envelopeRules';
 import {envelopeRevision} from '../shared/envelopeRevision';
 import {unreadableV1} from '../shared/unreadable';
@@ -49,9 +50,11 @@ const serial = createMutex();
  * delete (vault.forgetWallet without a replacement, E5 step 7 / B1b-2b E11) and by a first write. The one list, with
  * the address book (B1b-2b E17, D20: wiped on delete, kept on restore — a replacement does not come here), and B1c's
  * dApp grants, blocked sites and rejection limits (spec C11, C14: wiped by a delete, kept by a restore), and B1d §2.4's
- * presale records (both builds). `v1_forbidden_until` is not the wallet's (the coordinator's verdict) and is kept.
+ * presale records (both builds), and B1e §1.4's anti-phishing phrase (a plain remove: a settings.phrase write racing a
+ * delete can leave it behind, and the next first write removes it — the same accepted race as v1_settings).
+ * `v1_forbidden_until` is not the wallet's (the coordinator's verdict) and is kept.
  */
-export const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY, PRESALE_RECORDS_KEY];
+export const WALLET_DATA_KEYS: readonly string[] = [KNOWN_RECIPIENTS_KEY, SETTINGS_KEY, CONTACTS_KEY, GRANTS_KEY, BLOCKED_KEY, LIMITS_KEY, DAPP_TXS_KEY, PRESALE_RECORDS_KEY, PHRASE_KEY];
 /** The keys among WALLET_DATA_KEYS removed only behind their own writers' lock (fix round 1, IMPORTANT 1) — never by a
  * plain ext.local.remove, which a write-back in flight could undo: the dApp keys (wipeDappStores; B1c-2: v1_dapp_txs
  * too) and the presale records, whose retry writes on its own schedule (wipePresaleRecords). */
```

`extension/src/unlock/screens/createRun.ts`:

```diff
diff --git a/extension/src/unlock/screens/createRun.ts b/extension/src/unlock/screens/createRun.ts
index a3f4f8b..3317d78 100644
--- a/extension/src/unlock/screens/createRun.ts
+++ b/extension/src/unlock/screens/createRun.ts
@@ -15,6 +15,15 @@ import {mountIntro, mountWelcome} from './welcome';
  */
 export type Storing = <T>(work: () => Promise<T>) => Promise<T>;
 
+/**
+ * B1e §1.3 (I6): onboarding's anti-phishing step, shown by the create and import runs only once the new wallet is
+ * stored AND its keys are in the session (`created`) — after commitWallet, whose first write removes every
+ * WALLET_DATA_KEYS key, the phrase's among them. `path` says which run; `then()` continues it (to #7 or #40). Never
+ * shown on `created-locked` (settings.phrase would answer `locked`; #35 offers it). The page passes one; without it
+ * the runs go straight on.
+ */
+export type PhraseStep = (o: {path: 'create' | 'import'; then(): void}) => void;
+
 export interface CreateRun {
   /** Shows #1 (`welcome`) or #2 (`intro`, `?mode=create`). */
   start(at: 'welcome' | 'intro'): void;
@@ -38,7 +47,7 @@ export interface CreateRun {
  * Mounted once per page (Task 9): #5 is the page's one PasswordScreen, shared with the import run, and #1's
  * "I have a wallet" hands over to that run in the same page — dropping the phrase a #3 visit generated first.
  */
-export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; importRun(): void}): CreateRun {
+export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; importRun(): void; phraseStep?: PhraseStep}): CreateRun {
   let mnemonic: string | null = null;
   let password: string | null = null;
   let storing = false;
@@ -95,7 +104,9 @@ export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; im
   const seed = mountSeed(deps, {back: () => intro.show(), done: () => confirm.show(words())});
   const confirm = mountConfirm(deps, {back: () => seed.show(words()), done: () => passwordStep()});
   const pw = o.password;
-  const passkey = mountPasskey(deps, {done: () => deps.go('wallet.html#/created')});
+  const toCreated = () => deps.go('wallet.html#/created');
+  // B1e §1.3: #6 ends (Skip, added, …) with the wallet stored and its keys in the session — the phrase step, then #7.
+  const passkey = mountPasskey(deps, {done: () => (o.phraseStep === undefined ? toCreated() : o.phraseStep({path: 'create', then: toCreated}))});
 
   const passwordStep = () =>
     pw.show({
@@ -130,7 +141,7 @@ export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; im
           return null;
         }
         if (out === 'created-locked') {
-          deps.go('wallet.html#/created');
+          toCreated();
           return null;
         }
         if (out === 'exists') return existsLines(deps);
```

`extension/src/unlock/screens/importRun.ts`:

```diff
diff --git a/extension/src/unlock/screens/importRun.ts b/extension/src/unlock/screens/importRun.ts
index 5342a81..fd7f25e 100644
--- a/extension/src/unlock/screens/importRun.ts
+++ b/extension/src/unlock/screens/importRun.ts
@@ -1,7 +1,7 @@
 import {detectImport, finishOnboarding, indexesFor, type Candidate, type ProbeResult} from '../onboarding';
 import type {PageDeps} from '../page';
 import {IMPORT, PASSWORD} from '../strings';
-import {existsLines, type Storing} from './createRun';
+import {existsLines, type PhraseStep, type Storing} from './createRun';
 import {mountImport, type Scheme} from './importScreen';
 import type {PasswordScreen} from './password';
 
@@ -28,7 +28,7 @@ export interface ImportRun {
  * another try. `storing` is the page's store tracker (createRun.ts): #1, restored while this store runs,
  * offers nothing until it lands.
  */
-export function createImportRun(deps: PageDeps, o: {password: PasswordScreen; back(): void; storing?: Storing}): ImportRun {
+export function createImportRun(deps: PageDeps, o: {password: PasswordScreen; back(): void; storing?: Storing; phraseStep?: PhraseStep}): ImportRun {
   const pw = o.password;
   const storing: Storing = o.storing ?? (work => work());
   let phrase: string | null = null;
@@ -58,8 +58,14 @@ export function createImportRun(deps: PageDeps, o: {password: PasswordScreen; ba
         if (out === 'created' || out === 'created-locked' || out === 'exists') phrase = null;
         // The page was left (pagehide) while this ran: the run was dropped; a restored page shows #1.
         if (started !== generation) return null;
+        const toImported = () => deps.go('wallet.html#/imported');
+        // B1e §1.3: stored and its keys in the session — the phrase step, then #40; created-locked goes straight on.
+        if (out === 'created' && o.phraseStep !== undefined) {
+          o.phraseStep({path: 'import', then: toImported});
+          return null;
+        }
         if (out === 'created' || out === 'created-locked') {
-          deps.go('wallet.html#/imported');
+          toImported();
           return null;
         }
         if (out === 'exists') return existsLines(deps);
```

`extension/scripts/check-vault-isolation.mjs`:

```diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
index 2919494..e532a70 100644
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -100,9 +100,10 @@ const withoutPortListeners = text => PORT_LISTENER_SPELLINGS.reduce((t, re) => t
 // B1c (spec §2.1, review 1 L4): the dApp grants, blocked sites and limits — a page writing a grant would connect a site.
 // B1c-2: the transactions sites had signed here (v1_dapp_txs) — a page writing one would badge a row as a dApp's.
 // B1d-2: the presale records (v1_presale_records) — a page writing one would hide #27's Q34 or POST a forged record.
+// B1e §1.4 (R2): the anti-phishing phrase (v1_phishing_phrase) — a page writing it would change it around #10's proof.
 export const BACKGROUND_OWNED_KEYS = [
   'v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache', 'v1_contacts',
-  'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits', 'v1_dapp_txs', 'v1_presale_records',
+  'v1_dapp_grants', 'v1_dapp_blocked', 'v1_dapp_limits', 'v1_dapp_txs', 'v1_presale_records', 'v1_phishing_phrase',
 ];
 const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
 // The vault page renders only fixed strings and the user's own words, as text (B1b-2a §1.2 item 3):
@@ -967,6 +968,25 @@ export function bundleViolations(distApp) {
   return [...out, ...problems];
 }
 
+// B1e §1.6 (I2): the two content scripts run in every web page; as BUILT, neither may name extension storage — the
+// spellings of TOUCHES_STORAGE (`.storage`, `?.storage`, a quoted bracket, a destructuring key) in the minified file.
+// The source rule above refuses them in src/relay and src/provider already; this one holds if that rule is ever
+// loosened or the bundler brings storage in from elsewhere. localStorage / sessionStorage are the page's, not ours.
+export const CONTENT_SCRIPTS = ['relay.js', 'provider.js'];
+export function contentStorageViolations(distApp) {
+  const out = [];
+  for (const name of CONTENT_SCRIPTS) {
+    const path = join(distApp, name);
+    if (!existsSync(path)) {
+      out.push(`INCONCLUSIVE: ${name} is missing — the content-script storage rule would pass trivially`);
+      continue;
+    }
+    const hit = TOUCHES_STORAGE.exec(readFileSync(path, 'utf8'));
+    if (hit) out.push(`${name} touches extension storage (${hit[0].trim()}) — a content script reaches none`);
+  }
+  return out;
+}
+
 // ── What the bundler put in the vault page (fix round 2, the authoritative backstop) ──────────────
 // vite.config.ts's chunkModules plugin writes dist/app.modules.json: for every built chunk (the KDF
 // worker's too), the source modules it carries, package-relative. However a module got in — a comment
@@ -1237,6 +1257,7 @@ if (isMain(import.meta.url)) {
   const problems = [...sourceViolations(files), ...htmlViolations(pages), ...vaultPageViolations(readRel, rel => readRel(rel) !== undefined)];
   for (const d of ['app', 'chrome', 'firefox']) {
     for (const p of bundleViolations(join(ROOT, DIST, d))) problems.push(`${DIST}/${d}: ${p}`);
+    for (const p of contentStorageViolations(join(ROOT, DIST, d))) problems.push(`${DIST}/${d}: ${p}`);
   }
   // dist/chrome and dist/firefox are copies of dist/app (scripts/build.mjs): one module map covers all three.
   const mapPath = join(ROOT, DIST, 'app.modules.json');
@@ -1262,5 +1283,5 @@ if (isMain(import.meta.url)) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log(`vault isolation ok (${DIST}): sources, built popup/background and both manifests carry no path to the vault; no chunk outside the vault page carries src/vault, src/unlock or core/keys, and no module bundled outside it reads WebAuthn (module map); no page reaches storage.session; every module bundled into the vault page is vault-page code or one of its five packages, and its stylesheets are the three named sheets, importing nothing and loading only the Geist faces; its HTML carries no inline CSS and links only its built sheets, and its code builds no CSS at run time`);
+  console.log(`vault isolation ok (${DIST}): sources, built popup/background and both manifests carry no path to the vault; no chunk outside the vault page carries src/vault, src/unlock or core/keys, and no module bundled outside it reads WebAuthn (module map); no page reaches storage.session, and neither built content script names extension storage; every module bundled into the vault page is vault-page code or one of its five packages, and its stylesheets are the three named sheets, importing nothing and loading only the Geist faces; its HTML carries no inline CSS and links only its built sheets, and its code builds no CSS at run time`);
 }
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates.**

Run: the Step 2 command — `Test Files  7 passed (7)` · `Tests  606 passed (606)`.

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `TZ=UTC npx vitest run` — `Test Files  230 passed (230)` · `Tests  5115 passed (5115)` (Task 3's tree 228 / 4986: +2 files, +129 — envelopeRules +77, phrase 37, phraseStep 6, check-vault-isolation +9; the messages / walletApi / decide rows changed, not added). Run in the local zone on 2026-11-02 it gives the same totals (Task 3's `Send.test.tsx` DST row fails only near midnight; Task 7 fixes it). `npx vitest run --config vitest.nopresale.config.ts` — `Test Files  19 passed (19)` · `Tests  472 passed | 25 skipped (497)` (Task 3's 18 / 435 + 25: `phrase.test.ts` added to `NOPRESALE_TESTS`, 37 rows, both builds).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale` (exit 0), `npm run csp` (exit 0), `npm run gates` — exit 0; `vault isolation ok (dist): … no page reaches storage.session, and neither built content script names extension storage; …` and the same for `dist-nopresale`.

No repo-root `src/` or `core/` change: root `tsc` / `jest` and web `verify` are not run. `npx eslint` on the touched files: 0 errors (the `no-void` warnings are the surrounding code's style, as in `createRun.ts` before this task).

Playwright, **the whole suite** (rev 1, the controller's ruling: this task changes an answer every page reads, `vault.status`, and the dry run's subsets missed the one spec that asserts it whole), launched detached with a log and a marker and waited for with a bounded poll: `npx playwright test --reporter=line` — **`108 passed (28.3m)`**; and `unshare -rn sh -c 'ip link set lo up && npx playwright test --reporter=line'` — **`108 passed (28.1m)`** (observed on the rebuilt 236ef45; `presaleSwitch.spec.ts` 2 of them, both builds; rev 2 changes only `cleanPhrase`, which no E2E before Task 7's reaches, and rev 2 ran the whole suite at Task 7). No screen changes here: the phrase's E2E is Task 7's, on Task 5's screens.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1e-1 the anti-phishing phrase in the background — cleanPhrase (NFC, trimmed, 3–32 code units, printable only, empty = none); v1_phishing_phrase is wallet data and background-owned; settings.phrase sets it while unlocked when none is set, a change or removal needs #10 through a new phrase challenge applied by vault.reauthOk; the value rides only on wallet.state, vault.status and dapp.pending; onboarding's step hook runs only after commitWallet; the built relay.js and provider.js carry no storage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked), `timeout 300`; `tsc`'s own exit code first, then the named test file.** `ER` = `src/shared/__tests__/envelopeRules.test.ts` (84; rev 1's observations below were on its 49, rev 2's on its 76), `PT` = `src/background/__tests__/phrase.test.ts` (37), `PS` = `src/unlock/__tests__/phraseStep.test.ts` (6), `VI` = `scripts/__tests__/check-vault-isolation.test.mjs` (430). Files: `R` = `src/shared/envelopeRules.ts`, `P` = `src/background/phrase.ts`, `RC` = `src/background/reauthChallenges.ts`, `MS` = `src/background/messages.ts`, `WA` = `src/background/walletApi.ts`, `AS` = `src/background/accountsStore.ts`, `CR` = `src/unlock/screens/createRun.ts`, `IR` = `src/unlock/screens/importRun.ts`, `CV` = `scripts/check-vault-isolation.mjs`. The brief's pins: the rules (M-nfc, M-trim, M-min, M-max, M-empty, M-type, M-forbidden, M-printable) · set-when-none only while unlocked (M-session) · change and remove refuse without the proof (M-change-proof, M-remove-proof, M-unchanged, M-challengeId, M-apply-missing) and refuse a proof of another kind (M-apply-dispatch, M-take-kind) · the challenge itself (M-take-session, M-take-once, M-last-wins, M-lockrace, M-about-clean, M-about-keys, M-info, M-apply-failed) · no content-script, provider or relay context (M-content, M-approve; the gates M-key-list, M-key-named, M-content-rule, M-content-missing, M-built-storage) · wiped and kept (M-wipe, M-restore) · the order after `commitWallet` (M-order, M-locked-step, M-import-order, M-import-skip) · the three reads and no other (M-state, M-status, M-pending, M-read-judge, M-leak). The two gate mutants (§1.6's own) run in the clone itself, built, then `git checkout` — in a symlinked copy the module-map paths leave the package and the vault-page rules report the harness, not the mutant.

| id | the change | named test → observed |
|---|---|---|
| M-nfc | R: `const phrase = x.normalize('NFC').trim();` → `const phrase = x.trim();` | tsc 0 · ER RED `2 failed \| 47 passed (49)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > NFC first, then trimmed: the stored phrase is the composed, trimmed text”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > the length counts after NFC and after trimming: 3 and 32 accepted, 2 and 33 refused” |
| M-trim | R: `const phrase = x.normalize('NFC').trim();` → `const phrase = x.normalize('NFC');` | tsc 0 · ER RED `3 failed \| 46 passed (49)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > NFC first, then trimmed: the stored phrase is the composed, trimmed text”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > the length counts after NFC and after trimming: 3 and 32 accepted, 2 and 33 refused” (+1 more) |
| M-min | R: `if (phrase.length < PHRASE_LENGTH.min \|\| phrase.length > PHRASE_LENGTH.max \|\|` → `if (phrase.length > PHRASE_LENGTH.max \|\|` | tsc 0 · ER RED `1 failed \| 48 passed (49)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > the length counts after NFC and after trimming: 3 and 32 accepted, 2 and 33 refused” |
| M-max | R: `if (phrase.length < PHRASE_LENGTH.min \|\| phrase.length > PHRASE_LENGTH.max \|\|` → `if (phrase.length < PHRASE_LENGTH.min \|\|` | tsc 0 · ER RED `1 failed \| 48 passed (49)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > the length counts after NFC and after trimming: 3 and 32 accepted, 2 and 33 refused” |
| M-forbidden | R: `\|\| FORBIDDEN_IN_NAME.test(phrase) \|\| NOT_PRINTABLE.test(phrase)) return undefined;` → `\|\| NOT_PRINTABLE.test(phrase)) return undefined;` | tsc 0 · ER RED `26 failed \| 23 passed (49)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a character that does not print as typed: NUL (Cc)”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a character that does not print as typed: BEL (Cc)” (+24 more) |
| M-printable | R: `\|\| FORBIDDEN_IN_NAME.test(phrase) \|\| NOT_PRINTABLE.test(phrase)) return undefined;` → `\|\| FORBIDDEN_IN_NAME.test(phrase) \|\| NOT_PRINTABLE.test('')) return undefined;` | tsc 0 · ER RED `4 failed \| 45 passed (49)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a character that does not print as typed: lone high surrogate (Cs)”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a character that does not print as typed: lone low surrogate (Cs)” (+2 more) |
| M-empty | R: `if (phrase.length === 0) return null; ⏎ ` → (removed) | tsc 0 · ER RED `1 failed \| 48 passed (49)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > empty means none: null, "", and a string of only whitespace are null (remove)” |
| M-type | R: `if (typeof x !== 'string') return undefined; ⏎   const phrase` → `  if (typeof x !== 'string') return null; ⏎   const phrase` | tsc 0 · ER RED `1 failed \| 48 passed (49)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > not a string (and not null) is refused — never "none"” |
| M-session | P: `if ((await getSession(ext)) === null) return 'locked' as const;` → `      if ((await getSession(ext)) === null && next === '') return 'locked' as const;` | tsc 0 · PT RED `2 failed \| 35 passed (37)` — “settings.phrase: set when none is set — an unlocked session, no proof (R1, E18) > locked with none stored: `locked`, nothing written — then unlocked, the same message sets it (positive control)”; “never echoed (§1.5) > a refusal carries no character of the tried value, and nothing is logged” |
| M-change-proof | P: `if (stored === null && next !== null) {` → `if (next !== null) {` | tsc 0 · PT RED `11 failed \| 26 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > change: `reauth-required`, nothing written; vault.reauthOk applies the value bound at issue”; “change and remove need #10: a `phrase` challenge (R1, E18) > a lock landing while the challenge is issued: `locked`, and the challenge it raced past is removed” (+9 more) |
| M-remove-proof | P: `if (stored === null && next !== null) { ⏎         await writePhrase(ext, next);` → `if (stored === null \|\| next === null) { ⏎         await writePhrase(ext, next);` | tsc 0 · PT RED `5 failed \| 32 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > remove (null): `reauth-required`, kept; vault.reauthOk removes it”; “change and remove need #10: a `phrase` challenge (R1, E18) > remove (""): `reauth-required`, kept; vault.reauthOk removes it” (+3 more) |
| M-unchanged | P: `if (stored === next) return 'unchanged' as const; ⏎ ` → (removed) | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “settings.phrase: set when none is set — an unlocked session, no proof (R1, E18) > the same value again is `unchanged`: nothing written, no challenge — locked or not; removing none is `unchanged` too” |
| M-challengeId | P: `if (msg.challengeId !== undefined) return MALFORMED; ⏎ ` → (removed) | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “settings.phrase: set when none is set — an unlocked session, no proof (R1, E18) > malformed — nothing written, no challenge: no `phrase` field, a non-string, a refused character, a `challengeId` alongside” |
| M-lockrace | P: `await ext.session.remove(REAUTH_KEY);` → ``      await ext.session.remove(`${REAUTH_KEY}.none`);`` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > a lock landing while the challenge is issued: `locked`, and the challenge it raced past is removed” |
| M-apply-dispatch | MS: `if (about?.kind === 'settings') return applySettingsChallenge(ext, deps, challengeId);` → `if (about?.kind === 'settings' \|\| about?.kind === 'phrase') return applySettingsChallenge(ext, deps, challengeId);` | tsc 0 · PT RED `8 failed \| 29 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > change: `reauth-required`, nothing written; vault.reauthOk applies the value bound at issue”; “change and remove need #10: a `phrase` challenge (R1, E18) > remove (null): `reauth-required`, kept; vault.reauthOk removes it” (+6 more) |
| M-apply-missing | MS: `if (about?.kind === 'phrase') return applyPhraseChallenge(ext, deps, challengeId);` → `if (about?.kind === 'phrase' && challengeId === '') return applyPhraseChallenge(ext, deps, challengeId);` | tsc 0 · PT RED `8 failed \| 29 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > change: `reauth-required`, nothing written; vault.reauthOk applies the value bound at issue”; “change and remove need #10: a `phrase` challenge (R1, E18) > remove (null): `reauth-required`, kept; vault.reauthOk removes it” (+6 more) |
| M-take-kind | RC: `if (c === undefined \|\| !phraseAbout(c.about)) return 'unknown-challenge';` → `    if (c === undefined \|\| (!phraseAbout(c.about) && id === '')) return 'unknown-challenge';` · RC: `return {phrase: c.about.phrase};` → `    return {phrase: (c.about as {phrase?: string \| null}).phrase ?? null};` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “a proof of another kind never changes the phrase > takePhraseChallenge takes only a phrase challenge: a settings, send or dapp id is `unknown-challenge` and stays” |
| M-take-session | RC: `if (c === undefined \|\| !phraseAbout(c.about)) return 'unknown-challenge'; ⏎     if ((await getSession(ext)) === null) return 'locked'; ⏎ ` → `    if (c === undefined \|\| !phraseAbout(c.about)) return 'unknown-challenge'; ⏎ ` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > locked at apply: `locked`, kept — vault.reauthOk refuses, and so does the take itself (a lock landing after that check)” |
| M-take-once | RC: `if (c === undefined \|\| !phraseAbout(c.about)) return 'unknown-challenge'; ⏎     if ((await getSession(ext)) === null) return 'locked'; ⏎     store.delete(id); ⏎ ` → `    if (c === undefined \|\| !phraseAbout(c.about)) return 'unknown-challenge'; ⏎     if ((await getSession(ext)) === null) return 'locked'; ⏎ ` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > applied exactly once: a replayed vault.reauthOk is `unknown-challenge`” |
| M-last-wins | P: `await writePhrase(ext, taken.phrase);` → `      if ((await readPhrase(ext)) !== null) await writePhrase(ext, taken.phrase);` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > the last confirmed proof wins: a challenge applied after another change landed applies its own bound value” |
| M-about-clean | RC: `(typeof a.phrase === 'string' && cleanPhrase(a.phrase) === a.phrase)` → `(typeof a.phrase === 'string' && cleanPhrase(a.phrase) !== undefined)` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “a proof of another kind never changes the phrase > the `phrase` kind is exactly two keys, a clean phrase or null — anything else is no challenge” |
| M-about-keys | RC: `cleanPhrase(a.phrase) === a.phrase)) && Object.keys(a).length === 2;` → `cleanPhrase(a.phrase) === a.phrase));` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “a proof of another kind never changes the phrase > the `phrase` kind is exactly two keys, a clean phrase or null — anything else is no challenge” |
| M-info | MS: `data: about.kind === 'phrase' ? {kind: 'phrase', action: about.phrase === null ? 'remove' : 'change'} : about}` → `data: about}` | tsc 0 · PT RED `2 failed \| 35 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > #10 is told what it is for, never the value: vault.challengeInfo answers `change` or `remove`”; “the phrase rides on three answers only (I2, R2) > every other privileged answer omits it — from the popup, the vault page and the approval window, a phrase challenge open” |
| M-apply-failed | P: `} catch { ⏎     return {ok: false, error: 'failed'}; ⏎   } ⏎ }` → `  } catch { ⏎     return {ok: true, data: {applied: 'phrase'}}; ⏎   } ⏎ }` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “change and remove need #10: a `phrase` challenge (R1, E18) > a storage failure: `failed` — on set, and on apply (the challenge is spent, nothing written)” |
| M-state | WA: `passkey: view.passkey, phrase};` → `passkey: view.passkey, phrase: null};` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “the phrase rides on three answers only (I2, R2) > wallet.state carries it — locked and unlocked, from the popup and the tab; null when none is set” |
| M-status | MS: `accounts: (s ?? []).map(a => ({index: a.index, publicKey: a.publicKey})), phrase: await readPhrase(ext)}};` → `accounts: (s ?? []).map(a => ({index: a.index, publicKey: a.publicKey})), phrase: null}};` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “the phrase rides on three answers only (I2, R2) > vault.status carries it — locked and unlocked, to the vault page; null when none is set” |
| M-pending | MS: `data: {...(await pending(ext, deps)), phrase: await readPhrase(ext)}};` → `data: {...(await pending(ext, deps)), phrase: null}};` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “the phrase rides on three answers only (I2, R2) > dapp.pending carries it at the top level in every state: none, locked, request” |
| M-read-judge | P: `return typeof raw === 'string' && cleanPhrase(raw) === raw ? raw : null;` → `return typeof raw === 'string' ? raw : null;` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “settings.phrase: set when none is set — an unlocked session, no proof (R1, E18) > a stored value that is not a clean phrase reads as none: shown as none, and set without a proof” |
| M-leak | WA: `case 'settings.get': ⏎         return {ok: true, data: await readSettings(ext)};` → `      case 'settings.get': ⏎         return {ok: true, data: {...(await readSettings(ext)), phrase: await readPhrase(ext)}};` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “the phrase rides on three answers only (I2, R2) > every other privileged answer omits it — from the popup, the vault page and the approval window, a phrase challenge open” |
| M-approve | MS: `const APPROVE_PAGE_ALLOWED: readonly string[] = APPROVE_PAGE_ONLY;` → `const APPROVE_PAGE_ALLOWED: readonly string[] = [...APPROVE_PAGE_ONLY, 'wallet.state', 'vault.status', 'settings.phrase'];` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “who may ask: no content-script, provider or relay context reads or writes it (§1.6, Minor 4) > the approval window gets it only on dapp.pending: wallet.state, vault.status and settings.phrase from /approve.html are `forbidden`” |
| M-content | MS: `if (!isOwnPage(ext, sender)) return {ok: false, error: 'forbidden'};` → `  if (!isOwnPage(ext, sender) && !(sender.id === ext.runtimeId && (type === 'wallet.state' \|\| type === 'settings.phrase'))) return {ok: false, error: 'forbidden'};` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “who may ask: no content-script, provider or relay context reads or writes it (§1.6, Minor 4) > wallet.state, vault.status and settings.phrase from a content script or another extension: `forbidden`, nothing written” |
| M-wipe | AS: `DAPP_TXS_KEY, PRESALE_RECORDS_KEY, PHRASE_KEY];` → `DAPP_TXS_KEY, PRESALE_RECORDS_KEY, PHRASE_KEY.slice(0, 0)];` | tsc 0 · PT RED `4 failed \| 33 passed (37)` — “wallet data: wiped by a delete, a damaged-vault removal and a first write; kept by a restore (§1.4) > v1_phishing_phrase is one of WALLET_DATA_KEYS”; “wallet data: wiped by a delete, a damaged-vault removal and a first write; kept by a restore (§1.4) > #37's delete (vault.forgetWallet, no replacement) removes it” (+2 more) |
| M-restore | AS: `if (next === null) await removeWalletData(ext);` → `      await removeWalletData(ext);` | tsc 0 · PT RED `1 failed \| 36 passed (37)` — “wallet data: wiped by a delete, a damaged-vault removal and a first write; kept by a restore (§1.4) > #39's restore (vault.forgetWallet with the same-key replacement) keeps it” |
| M-order | CR: `done: () => passwordStep()});` → `done: () => { ⏎       o.phraseStep?.({path: 'create', then: () => undefined}); ⏎       passwordStep(); ⏎     }});` · CR: `{done: () => (o.phraseStep === undefined ? toCreated() : o.phraseStep({path: 'create', then: toCreated}))}` → `{done: toCreated}` | tsc 0 · PS RED `2 failed \| 4 passed (6)` — “create: the phrase step after #6, before wallet.html#/created (B1e §1.3) > runs once #6 ends, with the wallet stored and its keys in the session; the phrase it sets survives; then #7”; “create: the phrase step after #6, before wallet.html#/created (B1e §1.3) > created-locked (the keys did not reach the background): no step — `set` would answer `locked`; straight to #7” |
| M-locked-step | CR: `if (out === 'created-locked') { ⏎           toCreated();` → `        if (out === 'created-locked') { ⏎           if (o.phraseStep === undefined) toCreated(); ⏎           else o.phraseStep({path: 'create', then: toCreated});` | tsc 0 · PS RED `1 failed \| 5 passed (6)` — “create: the phrase step after #6, before wallet.html#/created (B1e §1.3) > created-locked (the keys did not reach the background): no step — `set` would answer `locked`; straight to #7” |
| M-import-order | IR: `if (out === 'created' && o.phraseStep !== undefined) {` → `if ((out === 'created' \|\| out === 'created-locked') && o.phraseStep !== undefined) {` | tsc 0 · PS RED `1 failed \| 5 passed (6)` — “import: the phrase step after the wallet is stored, before wallet.html#/imported (B1e §1.3) > created-locked: no step; straight to #40” |
| M-import-skip | IR: `o.phraseStep({path: 'import', then: toImported});` → `          toImported();` | tsc 0 · PS RED `1 failed \| 5 passed (6)` — “import: the phrase step after the wallet is stored, before wallet.html#/imported (B1e §1.3) > runs with the wallet stored and its keys in the session; the phrase survives; then #40” |
| M-key-list | CV: `'v1_presale_records', 'v1_phishing_phrase',` → `'v1_presale_records',` | tsc 0 · VI RED `1 failed \| 429 passed (430)` — “vault isolation (storage, and what may import src/ext.ts) > lets only the background name the anti-phishing phrase key (v1_phishing_phrase)” |
| M-content-rule | CV: ``if (hit) out.push(`${name} touches extension storage`` → ``    if (hit && name === 'provider.js') out.push(`${name} touches extension storage`` | tsc 0 · VI RED `6 failed \| 424 passed (430)` — “vault isolation (the built content scripts carry no storage) > refuses a property access in relay.js and in provider.js”; “vault isolation (the built content scripts carry no storage) > refuses an optional access in relay.js and in provider.js” (+4 more) |
| M-content-missing | CV: ``out.push(`INCONCLUSIVE: ${name} is missing — the content-script storage rule would pass trivially`); ⏎ `` → (removed) | tsc 0 · VI RED `1 failed \| 429 passed (430)` — “vault isolation (the built content scripts carry no storage) > a missing file is INCONCLUSIVE, never a pass” |
| M-key-named | `src/unlock/screens/unlock.ts`: `// v1_phishing_phrase` added above its first line (§1.6's mutation) | tsc 0 · build 0 · `node scripts/check-vault-isolation.mjs` exit **1** — `src/unlock/screens/unlock.ts: names v1_phishing_phrase, which only the background may write` (the only line) |
| M-built-storage | `src/relay/index.ts`: `(globalThis as unknown as {chrome?: {storage?: {local?: {get(k: string): unknown}}}}).chrome?.storage?.local?.get('v1_phishing_phrase');` above `startRelay({` · CV: `SESSION_ALLOWED` gains `\|^src\/relay\/` and the `BACKGROUND_OWNED_KEYS` loop skips `src/relay/` (the source-rule exemptions §1.6 names) | tsc 0 · build 0 · `node scripts/check-vault-isolation.mjs` exit **1** — `dist/app: relay.js touches extension storage (?.storage) — a content script reaches none`, the same for `dist/chrome` and `dist/firefox` (the only lines) |

Rev 2's rows (E21), observed on the rebuilt a982e28 with `ER` at 76 rows; **rev 2.1** re-ran every row on 6405846 (`ER` 84) — each red, the new counts after `→`:

| id | the change | named test → observed |
|---|---|---|
| M-dicp | R: `const BLANK = /[\p{Default_Ignorable_Code_Point}\u2800\ufffc\ufffd]/u;` → `const BLANK = /[\u2800\ufffc\ufffd]/u;` | tsc 0 · ER RED `9 failed \| 67 passed (76)` → `9 failed \| 75 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): Hangul choseong filler U+115F x3 (Default_Ignorable)”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): Hangul jungseong filler U+1160 x3 (Default_Ignorable)” (+7 more: U+3164, U+FFA0, the fillers around a space, U+17B4, U+17B5, U+180B, U+E0100) |
| M-braille | R: `\p{Default_Ignorable_Code_Point}\u2800\ufffc` → `\p{Default_Ignorable_Code_Point}\ufffc` | tsc 0 · ER RED `2 failed \| 74 passed (76)` → `2 failed \| 82 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): Braille blank U+2800 x3”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): Braille blank U+2800 inside a word” |
| M-replacement | R: `\u2800\ufffc\ufffd]/u` → `\u2800]/u` | tsc 0 · ER RED `2 failed \| 74 passed (76)` → `2 failed \| 82 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): replacement character U+FFFD x3”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): object replacement character U+FFFC inside a word” |
| M-blank | R: `  if (BLANK.test(phrase) \|\| STACKED.test(` → `  if (BLANK.test('') \|\| STACKED.test(` (rev 2.1's form; rev 2's text ended `STACKED.test(phrase)`) | tsc 0 · ER RED `13 failed \| 63 passed (76)` → `13 failed \| 71 passed (84)` — every Default_Ignorable, U+2800 and U+FFFC / U+FFFD row, e.g. “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): Hangul choseong filler U+115F x3 (Default_Ignorable)” (+12 more) |
| M-stacked | R: `STACKED.test(phrase.normalize('NFD'))` → `STACKED.test('')` (rev 2.1's form) | tsc 0 · ER RED `2 failed \| 74 passed (76)` → `5 failed \| 79 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): a combining tower: a + U+0300 x31 (32 code units)”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): four combining marks on one letter (one over the cap)” |
| M-cap-loose | R: ``\\p{M}{${PHRASE_MAX_MARKS + 1}}`` → ``\\p{M}{${PHRASE_MAX_MARKS + 2}}`` | tsc 0 · ER RED `1 failed \| 75 passed (76)` → `2 failed \| 82 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): four combining marks on one letter (one over the cap)” |
| M-cap-tight | R: ``\\p{M}{${PHRASE_MAX_MARKS + 1}}`` → ``\\p{M}{${PHRASE_MAX_MARKS}}`` | tsc 0 · ER RED `3 failed \| 73 passed (76)` → `6 failed \| 78 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > accepts (E21 positive control): exactly PHRASE_MAX_MARKS marks on one letter”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > accepts (E21 positive control): pointed Hebrew: a dagesh, a vowel and a shin dot on one letter (3 marks)”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > accepts (E21 positive control): Tibetan: a stack of three marks on one letter” (the positive controls) |
| M-visible | R: ` \|\| !VISIBLE.test(phrase)) return undefined;` → ` \|\| !VISIBLE.test('x')) return undefined;` | tsc 0 · ER RED `2 failed \| 74 passed (76)` → `2 failed \| 82 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): marks only: no character that draws itself”; “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): marks and no-break spaces only” |
| M-visible-marks | R: `const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;` → `const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}\p{M}]/u;` | tsc 0 · ER RED `2 failed \| 74 passed (76)` → `2 failed \| 82 passed (84)` — the same two rows |
| M-visible-spaces | R: `const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}]/u;` → `const VISIBLE = /[\p{L}\p{N}\p{S}\p{P}\p{Z}]/u;` | tsc 0 · ER RED `1 failed \| 75 passed (76)` → `1 failed \| 83 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): marks and no-break spaces only” |
| M-stack-nfc (rev 2.1, N1) | R: `STACKED.test(phrase.normalize('NFD'))` → `STACKED.test(phrase)` (rev 2's count, on the NFC form) | tsc 0 · ER RED `3 failed \| 81 passed (84)` — “cleanPhrase: the anti-phishing phrase (B1e §1.5) > refuses a phrase that renders blank or draws out of its line (E21): a + U+0300 x4: NFC makes it a-grave + 3, the cap counts after NFD”; “… u with diaeresis and acute (U+01D8) + 3 marks: 5 after NFD”; “… a with circumflex and dot below (U+1EAD) + 3 marks: 5 after NFD” |

M-blank, M-stacked and M-visible were first written as the clause removed: each then left its constant unused and did not compile (`tsc` 2, `noUnusedLocals`) — INVALID, not red; rewritten as above (the constant tested on a fixed string, as M-printable), all three red. On the rev 2 tree rev 1's 42 rows are all red again with `ER` at 76 rows (rev 2.1, `ER` 84: the same failed counts, `… passed (84)`); their counts move only where the E21 rows overlap: M-nfc `2 failed \| 74 passed (76)`, M-trim 3, M-min 1, M-max 1, **M-forbidden 8** (was 26: the Cf and bidi rows are Default_Ignorable too, so `BLANK` still refuses them — the six Cc rows and Zl / Zp keep it red), M-printable 4, M-empty 1, M-type 1; PT, PS, VI and the gate rows as observed in rev 1.

42 rows, all counted, all run on the final commit: every mutant `tsc` 0, every unit mutant red in its named file, both gate mutants exit 1 with only their own lines. The sweep: `t4/mut2.py` (scratch). **Rev 2:** ten more rows for E21 (above), and all 52 re-run on the rebuilt a982e28 (`b1e1-r2tools/mut/t4.py`): every one `tsc` 0 and red (M-blank, M-stacked and M-visible after the rewrite recorded above). **Rev 2.1:** M-stack-nfc added; all 53 re-run on 6405846, every one `tsc` 0 and red.

What the first sweep found, fixed before the final commit: **M-take-session survived** — `vault.reauthOk` refuses a locked session before it dispatches, so a test through it never reached `takePhraseChallenge`'s own check (which closes a lock landing between the two); the row "locked at apply" now also calls `applyPhraseChallenge` and `takePhraseChallenge` directly (`locked`, the challenge left in place), and its comment, which claimed the take's check was what the old test reached, was corrected. **M-apply-dispatch was equivalent** as first written (a `settings` challenge never reaches the phrase line, the settings line runs first) — rewritten to send a `phrase` challenge to the settings apply. Eight first-sweep mutants did not compile — seven left a name unused (M-printable, M-lockrace, M-apply-missing, M-take-kind, M-about-clean, M-wipe: `noUnusedLocals`; M-session: TS2367 on the then-unreachable `locked`) and M-import-skip a no-overlap comparison — each rewritten to keep the name used; none was counted before it compiled.

#### Notes for the executor (Task 4)

- **Rev 2 — I1 + E21: what renders blank or draws out of its line is refused.** `cleanPhrase` gains, after rev 1's checks: `BLANK` — every `\p{Default_Ignorable_Code_Point}` (which holds the Hangul fillers U+115F, U+1160, U+3164, U+FFA0, the Khmer U+17B4 / U+17B5, the Mongolian and supplementary variation selectors, and the Cf set), the Braille blank U+2800, and U+FFFC / U+FFFD; `STACKED` — more than `PHRASE_MAX_MARKS` combining marks (`\p{M}`) in a row; and `VISIBLE` — at least one `\p{L}\p{N}\p{S}\p{P}` character (a mark is never one). The E21 code points are not listed again beside `\p{Default_Ignorable_Code_Point}`: each is one, so a list would make M-dicp an equivalent mutation; the rows pin every one.
- **Rev 2.1 — review N1: the cap counts after NFD.** NFC composes a letter with its first marks (`a` + grave → `à`), so a count on the stored (NFC) form missed one or two marks of every precomposed base: `a` + 4 graves, U+01D8 + 3 and U+1EAD + 3 (5-high stacks) passed. `cleanPhrase` now tests `STACKED` on `phrase.normalize('NFD')`; the stored value stays NFC. The three are refused rows; the boundary `à` + 2 (3 after NFD) and Vietnamese, Arabic harakat, polytonic Greek, Hangul (whose NFD jamo are letters) are accepted rows. **Ruling (the controller's, owner question 1):** the cap stays 3; it refuses liturgical text with four marks on one letter (cantillated Hebrew, Vedic Devanagari, Quranic-annotated Arabic) — the scope limit is spec §1.5's (rev 2.4). No migration (owner question 3): a phrase stored with a 4-high stack before this rule would read as R9's line; none exists outside development profiles.
- **Ruling (rev 2): the cap is 3 marks in a row** — why: Thai writes a vowel and a tone mark on one consonant (2), pointed Hebrew a dagesh, a vowel and a shin dot (3), Tibetan stacks three; a fourth only builds a tower that draws above or below the line, over the header (the review's `'a' + U+0300 ×31`). Positive rows pin 3 marks, Thai, pointed Hebrew and Tibetan; M-cap-tight (cap 2) and M-cap-loose (cap 4) are red — cost if wrong: a script needing four marks on one letter is refused (fail closed).
- **Ruling (rev 2): U+FFFC and U+FFFD are refused** — the review lists U+FFFD ×3 among the probes to refuse; neither is a character the user typed (each stands for one that could not be shown) and a banner of them is as easy to fake as an empty one. Not owner-listed in E21; the narrowest reading of "printable" that refuses the probe — cost if wrong: one class member.
- **Ruling (rev 2): a phrase may begin with a combining mark** (it draws on the line's own start; no rule added beyond E21).
- **Rev 2 — the escapes.** Rev 1's rows typed 47 characters raw in `envelopeRules.test.ts` and 7 in `phrase.test.ts` (RLO, ZWSP, BOM, soft hyphen, NBSP, U+3000, U+2028/9, CGJ, VS16, a tag character, private-use, unassigned, combining acute, Cyrillic), despite the file's own comment saying they were escapes; rev 2 rewrote every one as a `\u` escape by a script (the strings are the same code points: the rows and their counts are unchanged). The review's probe strings and the positive controls (a Cyrillic phrase, one accent mark, a Hebrew word with digits, 16 emoji, 32 × W) are the new rows.
- **The order is the run's, not the screen's.** The onboarding step is called by `createRun` / `importRun` only on `created` and only after `commitWallet` (create: when #6 ends; import: at once) — so whatever Task 5's screen does, it cannot write before the first write. `phraseStep.test.ts` pins it three ways: at the step the vault is stored and the session holds the keys; the value set there is read back after (`vault.status`); and the negative control shows a phrase in storage before the first write is gone after it (the reason the order matters). M-order (the step moved before #5's store) turns it red.
- **Two judges of a stored value, one rule.** `readPhrase` returns the stored value only when it is exactly what `cleanPhrase` would store; anything else (another type, a refused character, untrimmed) reads as none — on the three answers and for set-when-none. Only the background can write the key, so such a value is a bug or a future version's; it is never shown.
- **`vault.challengeInfo` is redacted for `phrase`.** The stored challenge keeps §1.3's two keys `{kind: 'phrase', phrase}` (the value is needed to apply it); the vault page is told only `{kind: 'phrase', action: 'change' | 'remove'}`. #10 must not show the new value (§1.3), so it is never sent.
- **The approval window's list is unchanged** (`dapp.pending`, `dapp.decide`): `settings.phrase` is a `WALLET_TYPES` member, refused there by `APPROVE_PAGE_ALLOWED`, and the existing literal partition test now names it (refused from a web page and another extension).
- **Rev 1: `e2e/presaleSwitch.spec.ts` changes here, and the whole Playwright suite runs here.** The dry run's Task 7 found that spec red since this task (`vault.status` gained `phrase`; it was in no task's subset); the controller moved the one-expectation change into this task, where the answer changes (the B1d-1b rev 2 lesson), with its red run on Task 3's tree (Step 2) and the whole suite in Step 4.
- The vitest totals are given under `TZ=UTC` (Task 3's `Send.test.tsx` DST finding, fixed in Task 7).

#### Notes for the executor (Task 4, continued) — the dry run's rulings, deviations and hand-over

- Ruling: "a confusable" is read as §1.5 defines the refusal — every control, format, bidi, zero-width, line / paragraph separator, CGJ and variation-selector character (`FORBIDDEN_IN_NAME`), plus Cs / Co / Cn for "printable only". Cross-script look-alikes (a Cyrillic phrase) are ACCEPTED, pinned by a row — why: the phrase is the user's own secret-from-websites text; a look-alike only helps an attacker who already knows it, and refusing scripts would refuse whole languages — cost if wrong: one regex and its rows in `cleanPhrase`.
- Ruling: Cs (lone surrogates), Co (private use) and Cn (unassigned) are refused in a phrase, not in names (`NOT_PRINTABLE`, phrase-only) — why: the controller's "printable only"; §1.5 names only `FORBIDDEN_IN_NAME` — cost if wrong: an emoji newer than the browser's Unicode tables is refused (fail closed). **Departure for rev 2.2:** §1.5's list gains Cs / Co / Cn.
- Ruling: `unchanged` is answered before the session check, locked or not — §1.3's table order; it reveals only whether a guess equals the phrase, which the locked screen shows anyway — cost if wrong: one line moved.
- Ruling: change and remove while locked answer `locked` (no challenge can be issued into a locked session, as `setSettings`).
- Ruling: the apply writes its bound value whatever is stored then — "re-compared at apply time" (§1.3) is read as "read under the mutex"; a compare-and-skip of an equal value would change nothing observable and could not be pinned — cost if wrong: none.
- Ruling: `vault.challengeInfo` answers a `phrase` challenge as `{kind: 'phrase', action}` (redacted) — why: #10 must not show the value, so the page need not get it — cost if wrong: Task 5 reads `action` instead of `phrase === null`. **Departure for rev 2.2:** §1.3's description shape on the wire.
- Ruling: `dapp.pending`'s field is added in `messages.ts`' handler, not inside `pending()` (`decide.ts` untouched; the field reads after the queue section) — cost if wrong: none.
- Ruling: a stored value that is not a clean phrase reads as none (also for set-when-none) — why: stored values are claims (as `readSettings`); only the background writes the key.
- Deviation (controller's assignment): the built `relay.js` / `provider.js` no-`storage` check lands here, not in Task 6 — Task 6 must not add it again.
- Deviation: no page-side sender (`phraseFlow.ts`) in this task — Task 5's screens send `settings.phrase` themselves; the tests use `deps.send` / `handleMessage` directly.
- Finding (not fixed, Task 5 must): `runReauth` (`reauthFlow.ts`) turns only `{applied: 'settings'}` into `'applied'` — a phrase proof reads `'confirmed'`; `describeChallenge` has no `phrase` branch (fail closed: undescribable).
- Next task must know: `modes.ts` passes `phraseStep` to BOTH runs (create's after #6, import's after `created`); `restoreRun` / `retryRun` get no step (a restore keeps the phrase; a retry's first write wipes it — #35 offers it); the six-screen line reads the field of `wallet.state` (popup Locked), `dapp.pending` (#46–#48) or `vault.status` (the vault unlock screen, #10).


### Task 5: The anti-phishing phrase in the UI — the line on the six screens (vault unlock #9, the popup's locked screen, #46, #47, #48 in every state, #10) as plain text, nothing when none is set, R9's line when the read fails; onboarding's skippable step (create after #6, import once stored, never on `created-locked`); #35's row and card to set, change and remove it; #10 describes a phrase challenge and `runReauth` maps `applied: 'phrase'`

**Spec:** B1e §1.2 (where it shows: one line under the screen's header, a shield icon + the phrase as plain text — `textContent` on the vault page, a React text child elsewhere; #9 **before** the password, read in its `reading` phase; every approval window; #10; nothing when none is set; R9's line when a read fails), §1.3 UI (#10's "what this is for" line "Change / Remove the anti-phishing phrase", never the new value; onboarding's skippable step after `commitWallet`, its placement, skipped on `created-locked`; #35's row "Anti-phishing phrase · On / Off": set, change, remove), §1.5 (the input's helper "letters, numbers, symbols and simple emoji"), §1.1 / Minor 3 (the help text: never type it into a website; anyone using this profile can see it), §1.6 (the phrase on all six screens in both builds, nothing when unset, R9's line; `<b>x</b>` as text), §9 (undrawn: built from B1b's banner, input and row styles; shown in the visual pass), R9. **Ledger MUSTs (Task 4):** `modes.ts` passes `PhraseStep` to both runs; `describeChallenge` gains the `phrase` branch; `runReauth` maps `applied: 'phrase'`. **Not here:** the six-screen E2E and the plan's visual pass (Task 7) — this task updates only the E2E flows its step interrupts (onboarding's create and plain import) and ran its own visual check (Notes for the executor).

**Undrawn (§9), built from the design system only:** the line is the design's `.banner.shield` (the shield-lock glyph 16 px, the phrase in `.copy`) — R9's is `.banner.warning` with the alert triangle; the step is #6's own `.s-bio` scope (`.hero-icon`, the shield-lock glyph) with B1b's `.vlt-input`; #35's row is a `.s7-row` and its card 35c's `.app-picker-card` with B1b's `.app-input` and `.btn … app-btn-sm`. New CSS is hand-written (`app.css`: `.app-phrase-line`, `.app-sr`, `.app-phrase-input`, `.app-phrase-actions`, `.app-phrase-card p`; `unlock.css`: `.vlt-phrase-line`); `design-ext.css` is untouched. No text is copied from `index.html`.

**Files:**
- Create: `extension/src/shared/phraseRead.ts` (`PhraseRead`, `phraseRead` — what a screen makes of the `phrase` field), `extension/src/app/ui/PhraseLine.tsx` (`PHRASE_TEXT`, `PhraseLine`), `extension/src/unlock/view/phraseLine.ts` (`readPhraseLine`, `showPhraseLine`), `extension/src/unlock/screens/antiPhishing.ts` (`mountAntiPhishing` → a `PhraseStep`)
- Modify: `extension/src/app/engine.ts` (`WalletState.phrase`), `extension/src/app/WalletContext.tsx` (a changed phrase is a changed state), `extension/src/app/screens/Locked.tsx` (the line), `extension/src/app/screens/Security.tsx` (the row and its card), `extension/src/app/app.css`, `extension/src/approve/client.ts` (`PendingView.phrase`), `extension/src/approve/ui.tsx` (`WindowTop` takes `phrase` and draws the line under the top bar), `extension/src/approve/{Approve,Sign,Connect,Tx,Mismatch,Locked}.tsx` (pass it; the locked window draws it first in its body), `extension/unlock.html` (the lines on #9 and #10; the step's section `#v-anti-phishing`), `extension/src/unlock/unlock.css`, `extension/src/unlock/view/dom.ts` (`v-anti-phishing` in `SCREENS`), `extension/src/unlock/screens/unlock.ts` (read in `reading`, before the field), `extension/src/unlock/screens/reauth.ts` (the line; the `phrase` description and its end states), `extension/src/unlock/challenge.ts` (`PhraseDescription`, the `phrase` branch), `extension/src/unlock/reauthFlow.ts` (`applied: 'phrase'`), `extension/src/unlock/strings.ts` (`REAUTH.phraseChange` / `phraseRemove`), `extension/src/unlock/modes.ts` (`phraseStep` to both runs), `extension/vitest.nopresale.config.ts` (the three screen test files run without presale too)
- Create (tests): `extension/src/shared/__tests__/phraseRead.test.ts` (2), `extension/src/unlock/__tests__/phraseScreens.test.ts` (20), `extension/src/app/__tests__/phrase.test.tsx` (11), `extension/src/approve/__tests__/phrase.test.tsx` (25)
- Modify (tests): `extension/src/unlock/__tests__/challenge.test.ts` (+3), `extension/src/unlock/__tests__/{unlockScreen,reauthScreen,reauthPurchase}.test.ts` (the show's `vault.status` read), `extension/src/app/__tests__/engine.test.ts` (`wallet.state`'s parsed `phrase`), `extension/src/app/__tests__/Switcher.test.tsx`, `extension/src/approve/__tests__/{tx,presaleRegion}.test.tsx` (the new required `phrase` prop), `extension/scripts/__tests__/check-vault-isolation.test.mjs` (the vault page's module census), `extension/e2e/{vaultPage.ts,onboarding.spec.ts,visual-vault.spec.ts}` (the step is skipped where the flows pass it; visual-vault shoots it)

**Interfaces:**
- Consumes (Task 4): `phrase: string | null` on `wallet.state`, `vault.status` and `dapp.pending` (top level, every state); `settings.phrase {phrase: string | null}` → `{ok: true, data: {outcome: 'set' | 'unchanged'}}` · `reauth-required {challengeId}` · `locked | malformed | failed`; `vault.challengeInfo` of a phrase challenge → `{kind: 'phrase', action: 'change' | 'remove'}`; `vault.reauthOk` → `{applied: 'phrase'}`; `PhraseStep` and the runs' `phraseStep` option (`createRun.ts`, `importRun.ts`); `cleanPhrase` (`envelopeRules.ts`); `PHRASE_KEY` (tests only). Existing: `reauthPage` (`platform.ts`), `engine.request`, `exclusive` / `PageDeps` (`page.ts`), `byId` / `setText` / `shown` / `showScreen` (`view/dom.ts`), `ExtIcon`, `LockedButton`, the vault-page `harness`, `openWindow` / `settled` / `elapse` (`windowHarness.tsx`), `renderApp` / `renderInWallet` / `setupWallet`.
- Produces (`extension/src/shared/phraseRead.ts`):
  ```ts
  export type PhraseRead = {state: 'none'} | {state: 'set'; phrase: string} | {state: 'failed'};
  export const PHRASE_NONE: PhraseRead;
  export const PHRASE_FAILED: PhraseRead;
  /** null → none; a string that is exactly cleanPhrase's fixed point → set; anything else (missing included) → failed. */
  export function phraseRead(field: unknown): PhraseRead;
  ```
- Produces (`extension/src/app/ui/PhraseLine.tsx`): `export const PHRASE_TEXT: {label: 'Anti-phishing phrase'; failed: "Anti-phishing phrase could not be read — don't type your password until it shows"};` `export function PhraseLine({phrase}: {phrase: PhraseRead}): JSX.Element | null;`
- Produces (`extension/src/unlock/view/phraseLine.ts`): `export async function readPhraseLine(send: Send): Promise<PhraseRead>;` `export function showPhraseLine(screen: 'unl' | 'ra', read: PhraseRead): void;`
- Produces (`extension/src/unlock/screens/antiPhishing.ts`): `export function mountAntiPhishing(deps: PageDeps): PhraseStep;`
- Produces (types): `WalletState.phrase: PhraseRead` (`engine.ts`); `PendingView` (non-`none`) gains `phrase: PhraseRead` (`client.ts`); `WindowTop` and `Sign`, `Connect`, `Tx`, `Mismatch`, approve's `Locked` take a **required** `phrase: PhraseRead` prop (a request screen without it does not compile); `PhraseDescription {kind: 'phrase'; action: 'change' | 'remove'}` joins `Description` (`challenge.ts`); `REAUTH.phraseChange`, `REAUTH.phraseRemove` (`strings.ts`); `SECURITY_TEXT.phrase`, `phraseCaption`, `phraseNew`, `phraseHelper`, `phraseHelp`, `phraseNote`, `phraseSet`, `phraseChange`, `phraseRemove` (`Security.tsx`); `ReauthPageOutcome` unchanged (`applied` now also for a phrase proof).
- **What later tasks rely on:** Task 7 — the six-screen E2E reads `.app-phrase-line` (popup, approval windows), `#unl-phrase` / `#unl-phrase-failed` / `#ra-phrase` / `#ra-phrase-failed` (vault page), `#v-anti-phishing` / `#ap-field` / `#ap-set` / `#ap-skip` (the step), `.s7-row` "Anti-phishing phrase" and `.app-phrase-card` (#35); `skipPhraseStep` (`e2e/vaultPage.ts`) for any new onboarding flow; the rev 2.2 change list gets this task's departures (Notes for the executor).

**The rule, stated once.** A screen never decides what the phrase is: it shows what the background's answer carried, re-judged by `phraseRead` — `null` is no phrase (nothing drawn: the screen is exactly as before), a string that is exactly what `cleanPhrase` stores is shown as **text** (a React child; `textContent` on the vault page), and anything else — no answer, a refusal, a missing or malformed field — is R9's line, never silence and never the whole screen refused. On #9 the read happens in the `reading` phase: the field is not shown, nor enabled, until `vault.status` has answered, and the line sits above the field in the page. Every request screen of the approval window draws it through `WindowTop`, whose `phrase` prop is required, so no state of #46–#48 can leave it out; the locked window draws it first in its body. The line on #10 is the **current** phrase; a phrase challenge is described only as "Change …" or "Remove the anti-phishing phrase" (the background never sends the new value) and ends as a settings one does — "Confirmed. The change is saved" only when the background answered `applied: 'phrase'`. The onboarding step writes once, only on [Set phrase] with a value `cleanPhrase` accepts, and only when the run calls it (after `commitWallet`); [Skip] writes nothing. #35 writes set-when-none at once; a change or a removal goes to #10 (`reauthPage`), and the row keeps saying what is stored.

- [ ] **Step 1: Write the failing tests.**

The strings with characters that do not print, or that NFC changes, are `\u` escapes printed by a generator from their code points (`node gen-phrase-ui-strings.mjs`, scratch only; rev 2: rev 1's generator and test rows held them raw — every one is now an escape):

```js
// Prints Task 5's test strings that carry characters that do not print, or that NFC changes, as \u escapes.
const esc = s => [...s].map(ch => { const out = []; for (let i = 0; i < ch.length; i++) { const c = ch.charCodeAt(i); out.push(c >= 0x20 && c < 0x7f && ch !== "'" && ch !== '\\' ? ch : '\\u' + c.toString(16).padStart(4, '0')); } return out.join(''); }).join('');
const cp = (...c) => String.fromCodePoint(...c);
const strings = {
  'bidi override inside': 'Blue ' + cp(0x202e) + 'horse 42',
  'untrimmed': ' Blue horse 42 ',
  'decomposed (not NFC)': 'cafe' + cp(0x301) + ' noir',
  'composed (NFC)': 'caf' + cp(0xe9) + ' noir',
};
for (const [k, v] of Object.entries(strings)) console.log(`${k}: '${esc(v)}'`);
```

Create `extension/src/shared/__tests__/phraseRead.test.ts`:

```ts
import {PHRASE_FAILED, PHRASE_NONE, phraseRead} from '../phraseRead';

// B1e §1.2 (R9): what a screen makes of the `phrase` field it was sent. Strings that do not print, or that NFC
// changes, are \u escapes printed by a generator.
describe('phraseRead', () => {
  it('null is none; a clean phrase is shown as it is — markup included, as text', () => {
    expect(phraseRead(null)).toEqual(PHRASE_NONE);
    expect(phraseRead('Blue horse 42')).toEqual({state: 'set', phrase: 'Blue horse 42'});
    expect(phraseRead('<b>x</b>')).toEqual({state: 'set', phrase: '<b>x</b>'});
    expect(phraseRead('caf\u00e9 noir')).toEqual({state: 'set', phrase: 'caf\u00e9 noir'});
  });

  it('a field missing, of another type, or not exactly what the background stores is failed — never none, never shown', () => {
    for (const bad of [undefined, 7, true, {}, [], '', 'ab', 'x'.repeat(33), ' Blue horse 42 ', 'Blue \u202ehorse 42', 'cafe\u0301 noir']) expect([bad, phraseRead(bad)]).toEqual([bad, PHRASE_FAILED]);
  });
});
```

Create `extension/src/unlock/__tests__/phraseScreens.test.ts`:

```ts
// @vitest-environment happy-dom
import {createEnvelope} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {issueChallenge} from '../../background/reauthChallenges';
import {handleMessage} from '../../background/messages';
import {setSession} from '../../background/session';
import {PHRASE_KEY} from '../../background/phraseKey';
import {PHRASE_TEXT} from '../../app/ui/PhraseLine';
import {SECURITY_TEXT} from '../../app/screens/Security';
import {startMode} from '../modes';
import {mountReauth} from '../screens/reauth';
import {mountUnlock} from '../screens/unlock';
import {COMMON, REAUTH} from '../strings';
import {HOLD_MS, TICK_MS} from '../view/hold';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

// B1e §1.2, §1.3 (undrawn, §9): the anti-phishing phrase on the vault page — the line on #9 (read in its `reading`
// phase, before the field shows) and on #10 (the CURRENT phrase; a phrase challenge described without its value), R9's
// line when the read fails, and onboarding's skippable step (only once the wallet is stored and its keys handed over).
// Against the real background and unlock.html. Strings that do not print are \u escapes printed by a generator.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PHRASE = 'wonder sauce regret hover leopard hundred luxury home wise frost naive body company wedding want sponsor buyer birth february friend frequent neglect draw pond';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const NEW_PW = 'a long enough password';
const BLUE = 'Blue horse 42';
const GREEN = 'Green fox 7';
const MARKUP = '<b>x</b>';
const HELD = HOLD_MS + TICK_MS;
const POPUP = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop', url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup.html'};

beforeEach(() => loadPage());

const wallet = () => createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});
/** What a screen's line shows: the phrase (null when its line is hidden) and whether R9's line shows. */
const line = (screen: 'unl' | 'ra') => ({phrase: visible(el(`${screen}-phrase`)) ? text(el(`${screen}-phrase-text`)) : null, failed: visible(el(`${screen}-phrase-failed`))});
const stored = async (h: Harness) => ((await h.deps.send({type: 'vault.status'})).data as {phrase?: unknown}).phrase;
const answering = (type: string, answer: () => Promise<{ok: boolean; error?: string; data?: unknown}>) => (inner: Send): Send => async m => ((m as {type: string}).type === type ? answer() : inner(m));
async function press(h: Harness, id: string): Promise<void> {
  await h.until(() => !el<HTMLButtonElement>(id).disabled);
  click(el(id));
}

describe('#9: the phrase line, read before the password field shows (B1e §1.2)', () => {
  async function unlockShown(phrase: unknown, send?: (inner: Send) => Send) {
    const h = await harness({vault: await wallet(), send});
    if (phrase !== undefined) await h.ext.local.set(PHRASE_KEY, phrase);
    await mountUnlock(h.deps).show(null);
    return h;
  }

  it('none set: no line — the screen is as before; the field shows', async () => {
    await unlockShown(undefined);
    expect([line('unl'), visible(el('unl-password'))]).toEqual([{phrase: null, failed: false}, true]);
  });

  it('set: the phrase beside the shield, named for a screen reader, BEFORE the password field (in the page and on screen)', async () => {
    await unlockShown(BLUE);
    expect([line('unl'), visible(el('unl-password'))]).toEqual([{phrase: BLUE, failed: false}, true]);
    expect(text(el('unl-phrase'))).toBe(`${PHRASE_TEXT.label}: ${BLUE}`);
    expect(el('unl-phrase').querySelector('.vlt-sr')?.textContent).toBe(`${PHRASE_TEXT.label}: `);
    expect(el('unl-phrase').compareDocumentPosition(el('unl-password')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unstyled('v-unlock')).toEqual([]);
  });

  it('a phrase that looks like markup renders as its own text — no element is made of it', async () => {
    await unlockShown(MARKUP);
    expect(line('unl').phrase).toBe(MARKUP);
    expect(el('unl-phrase-text').childElementCount).toBe(0);
    expect(el('v-unlock').querySelector('b')).toBeNull();
  });

  it('the read is the `reading` phase: while vault.status has not answered, no field shows and none is enabled', async () => {
    let release: () => void = () => undefined;
    let asked = false;
    const h = await harness({
      vault: await wallet(),
      send: inner => async m => {
        if ((m as {type: string}).type === 'vault.status' && !asked) {
          asked = true;
          await new Promise<void>(r => (release = r));
        }
        return inner(m);
      },
    });
    await h.ext.local.set(PHRASE_KEY, BLUE);
    const showing = mountUnlock(h.deps).show(null);
    await h.until(() => asked);
    await new Promise(r => setTimeout(r, 5));
    expect([visible(el('unl-password')), el<HTMLInputElement>('unl-password').disabled, visible(el('unl-submit'))]).toEqual([false, true, false]);
    release();
    await showing;
    expect([line('unl'), visible(el('unl-password')), el<HTMLInputElement>('unl-password').disabled]).toEqual([{phrase: BLUE, failed: false}, true, false]);
  });

  it.each([
    ['the send throws', async () => Promise.reject(new Error('no answer'))],
    ['a refusal', async () => ({ok: false, error: 'failed'})],
    ['an answer without the field', async () => ({ok: true, data: {unlocked: false, accounts: []}})],
    ['a field that is not a phrase', async () => ({ok: true, data: {unlocked: false, accounts: [], phrase: 7}})],
  ] as const)('a read that fails (%s): R9’s line, never silence — the field still shows', async (_why, answer) => {
    await unlockShown(BLUE, answering('vault.status', answer));
    expect([line('unl'), visible(el('unl-password'))]).toEqual([{phrase: null, failed: true}, true]);
    expect(text(el('unl-phrase-failed'))).toBe(PHRASE_TEXT.failed);
  });
});

describe('#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3)', () => {
  /** The wallet stored and unlocked, the stored phrase `phrase`, #10 shown on the challenge `issue` returns. */
  async function reauthShown(phrase: unknown, issue: (h: Harness) => Promise<string>, send?: (inner: Send) => Send) {
    const h = await harness({vault: await wallet(), send});
    await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
    if (phrase !== undefined) await h.ext.local.set(PHRASE_KEY, phrase);
    const id = await issue(h);
    await mountReauth(h.deps).show(id);
    return {h, id};
  }
  const settings = (h: Harness) => issueChallenge(h.ext, h.wallet, 'digest', {kind: 'settings', autoLockMinutes: 15, reauthUsdCents: null});
  /** settings.phrase from the popup, answered reauth-required: the challenge's id. */
  const phraseChallenge = (value: string | null) => async (h: Harness) => {
    const r = await handleMessage(h.ext, {type: 'settings.phrase', phrase: value}, POPUP, h.wallet);
    expect(r).toMatchObject({ok: false, error: 'reauth-required'});
    return (r.data as {challengeId: string}).challengeId;
  };
  const rows = () => [...el('ra-rows').querySelectorAll('.intent-row')].map(r => text(r));
  const confirmWith = (password: string) => {
    type(el<HTMLInputElement>('ra-password'), password);
    click(el('ra-confirm'));
  };

  it('on any challenge: the stored phrase on the line under the top bar, before the field; none set: no line', async () => {
    await reauthShown(BLUE, settings);
    expect([line('ra'), visible(el('ra-password'))]).toEqual([{phrase: BLUE, failed: false}, true]);
    expect(el('ra-phrase').compareDocumentPosition(el('ra-password')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unstyled('v-reauth')).toEqual([]);
    loadPage();
    await reauthShown(undefined, settings);
    expect([line('ra'), visible(el('ra-password'))]).toEqual([{phrase: null, failed: false}, true]);
  });

  it('a phrase that looks like markup renders as its own text; a read that fails is R9’s line', async () => {
    await reauthShown(MARKUP, settings);
    expect([line('ra').phrase, el('ra-phrase-text').childElementCount, el('v-reauth').querySelector('b')]).toEqual([MARKUP, 0, null]);
    loadPage();
    await reauthShown(BLUE, settings, answering('vault.status', async () => ({ok: false, error: 'failed'})));
    expect(line('ra')).toEqual({phrase: null, failed: true});
    expect(text(el('ra-phrase-failed'))).toBe(PHRASE_TEXT.failed);
  });

  it('change: "You are about to change" + "Change the anti-phishing phrase"; the new value nowhere; the line keeps the current one; proven → applied', async () => {
    const {h} = await reauthShown(BLUE, phraseChallenge(GREEN));
    expect([text(el('ra-about')), rows(), visible(el('ra-amount-row')), text(el('ra-reasons'))]).toEqual([REAUTH.aboutChange, [REAUTH.phraseChange], false, '']);
    expect(line('ra')).toEqual({phrase: BLUE, failed: false});
    expect(document.body.textContent).not.toContain(GREEN);
    expect([text(el('ra-cancel')), el('ra-x').getAttribute('aria-label')]).toEqual([REAUTH.cancel, REAUTH.close]);
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe(REAUTH.settingsApplied);
    expect(await stored(h)).toBe(GREEN);
  });

  it('remove: "Remove the anti-phishing phrase"; proven → applied — no phrase is stored', async () => {
    const {h} = await reauthShown(BLUE, phraseChallenge(null));
    expect(rows()).toEqual([REAUTH.phraseRemove]);
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe(REAUTH.settingsApplied);
    expect(await stored(h)).toBeNull();
  });

  it('a phrase proof the background did not say it applied is never "Confirmed" (fail closed); Cancel only closes the tab', async () => {
    const {h} = await reauthShown(BLUE, phraseChallenge(GREEN), answering('vault.reauthOk', async () => ({ok: true})));
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe(REAUTH.settingsFailed);
    loadPage();
    const again = await reauthShown(BLUE, phraseChallenge(null));
    click(el('ra-cancel'));
    await again.h.until(() => again.h.closed === 1);
    expect([again.h.sent.map(m => m.type).filter(t => t === 'wallet.discardPrepared'), await stored(again.h)]).toEqual([[], BLUE]);
  });
});

describe('onboarding’s anti-phishing step, as the page mounts it (B1e §1.3)', () => {
  /** #1 → … → #5 with the password typed twice, through the page's own startMode (the wiring under test). */
  async function created(o: {send?: (inner: Send) => Send} = {}): Promise<Harness> {
    const h = await harness({mnemonic: PHRASE, send: o.send});
    startMode({mode: 'welcome'}, h.deps);
    await h.until(() => visible(el('wel-actions')));
    await press(h, 'wel-create');
    click(el('int-continue'));
    await press(h, 'sg-continue');
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    const words = [...el('seed-grid').querySelectorAll('.term')].map(text);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    await press(h, 'seed-cta');
    for (const s of [...el('cnf-slots').querySelectorAll('.label')].map(text)) {
      const n = Number(/#(\d+)/.exec(s)?.[1]);
      const b = () => [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === words[n - 1]) as HTMLButtonElement;
      await h.until(() => !b().disabled);
      click(b());
    }
    await press(h, 'cnf-cta');
    await press(h, 'cnf-cta');
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    await press(h, 'pw-cta');
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    click(el('pw-cta'));
    return h;
  }
  const types = (h: Harness) => h.sent.map(m => m.type);

  it('create: not before #6; after it, the step — Skip writes nothing and goes on to #7', async () => {
    const h = await created();
    await h.until(() => visible(el('v-passkey')));
    expect(visible(el('v-anti-phishing'))).toBe(false);
    await press(h, 'pk-skip');
    await h.until(() => visible(el('v-anti-phishing')) && !h.deps.gate.isBusy());
    expect([h.went, el<HTMLButtonElement>('ap-set').disabled, document.activeElement === el('ap-field')]).toEqual([[], true, true]);
    expect(unstyled('v-anti-phishing')).toEqual([]);
    await press(h, 'ap-skip');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
    expect(types(h)).not.toContain('settings.phrase');
    expect(await stored(h)).toBeNull();
  }, 30_000);

  it('create: [Set phrase] writes once — after the wallet is stored and its keys handed over — then #7; the phrase survives', async () => {
    const h = await created();
    await h.until(() => visible(el('v-passkey')));
    await press(h, 'pk-skip');
    await h.until(() => visible(el('v-anti-phishing')));
    type(el<HTMLInputElement>('ap-field'), `  ${BLUE} `);
    await press(h, 'ap-set');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
    const t = types(h);
    expect(t.filter(x => x === 'settings.phrase')).toHaveLength(1);
    expect(t.indexOf('settings.phrase')).toBeGreaterThan(t.lastIndexOf('vault.storeEnvelope'));
    expect(t.indexOf('settings.phrase')).toBeGreaterThan(t.lastIndexOf('vault.setKeys'));
    expect(h.sent.find(m => m.type === 'settings.phrase')).toEqual({type: 'settings.phrase', phrase: BLUE});
    expect(await stored(h)).toBe(BLUE);
  }, 30_000);

  it('[Set phrase] only for a phrase the rules accept — empty, short, long, a bidi override: disabled; markup is a phrase like any other', async () => {
    const h = await created();
    await h.until(() => visible(el('v-passkey')));
    await press(h, 'pk-skip');
    await h.until(() => visible(el('v-anti-phishing')) && !h.deps.gate.isBusy());
    for (const bad of ['', '   ', 'ab', 'x'.repeat(33), 'Blue \u202ehorse 42']) {
      type(el<HTMLInputElement>('ap-field'), bad);
      expect([bad, el<HTMLButtonElement>('ap-set').disabled]).toEqual([bad, true]);
      click(el('ap-set'));
    }
    el<HTMLFormElement>('ap-form').dispatchEvent(new Event('submit', {cancelable: true}));
    await new Promise(r => setTimeout(r, 5));
    expect(types(h)).not.toContain('settings.phrase');
    type(el<HTMLInputElement>('ap-field'), MARKUP);
    await press(h, 'ap-set');
    await h.until(() => h.went.length === 1);
    expect(await stored(h)).toBe(MARKUP);
  }, 30_000);

  it('a refused write says so and keeps the step — nothing moves on until Skip', async () => {
    const h = await created({send: answering('settings.phrase', async () => ({ok: false, error: 'locked'}))});
    await h.until(() => visible(el('v-passkey')));
    await press(h, 'pk-skip');
    await h.until(() => visible(el('v-anti-phishing')));
    type(el<HTMLInputElement>('ap-field'), BLUE);
    await press(h, 'ap-set');
    await h.until(() => visible(el('ap-line')) && !h.deps.gate.isBusy());
    expect([text(el('ap-line')), h.went, visible(el('v-anti-phishing'))]).toEqual([COMMON.failedTryAgain, [], true]);
    await press(h, 'ap-skip');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/created']);
  }, 30_000);

  it('created-locked (the keys did not reach the background): no step — straight to #7', async () => {
    const h = await created({send: answering('vault.setKeys', async () => ({ok: false, error: 'failed'}))});
    await h.until(() => h.went.length === 1);
    expect([h.went, visible(el('v-anti-phishing')), types(h).includes('settings.phrase')]).toEqual([['wallet.html#/created'], false, false]);
  }, 30_000);

  it('import: once the wallet is stored, the step; [Set phrase] → #40 with the phrase stored', async () => {
    const h = await harness({reader: {getMultipleLamports: async (keys: readonly unknown[]) => keys.map(() => 0n)}});
    startMode({mode: 'import', source: null}, h.deps);
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), NEW_PW);
    click(el('pw-cta'));
    await h.until(() => visible(el('v-anti-phishing')) && !h.deps.gate.isBusy());
    expect(h.went).toEqual([]);
    type(el<HTMLInputElement>('ap-field'), BLUE);
    await press(h, 'ap-set');
    await h.until(() => h.went.length === 1);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(await stored(h)).toBe(BLUE);
  }, 30_000);

  it('the copy: one text for the step and #35’s card; R9’s line on #9 and #10 is the popup’s', () => {
    expect([text(document.querySelector('#v-anti-phishing .vlt-lede')), text(el('ap-helper')), text(el('ap-help'))]).toEqual([SECURITY_TEXT.phraseCaption, SECURITY_TEXT.phraseHelper, SECURITY_TEXT.phraseHelp]);
    // E20: the step comes after #6's "5 / 5" with no count of its own; its overline says what it is.
    expect([...document.querySelectorAll('#v-anti-phishing .top-bar > *')].map(text)).toEqual(['Optional']);
    expect([text(el('unl-phrase-failed')), text(el('ra-phrase-failed'))]).toEqual([PHRASE_TEXT.failed, PHRASE_TEXT.failed]);
  });
});
```

Create `extension/src/app/__tests__/phrase.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {App} from '../App';
import {createEngine} from '../engine';
import {Security, SECURITY_TEXT} from '../screens/Security';
import {PHRASE_TEXT} from '../ui/PhraseLine';
import {PHRASE_KEY} from '../../background/phraseKey';
import {REAUTH_KEY} from '../../background/session';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {renderApp} from './appHarness';
import {renderInWallet, setupWallet, type WalletOptions} from './harness';

// B1e §1.2, §1.3 (undrawn, §9): the anti-phishing phrase in the popup and the UI tab — the locked screen's line (from
// wallet.state; nothing when none is set; R9's line when it could not be read) and #35's row and card (set when none is
// set, at once; change and remove through #10). Against the real background; runs in both vitest runs.
const SELECTORS = selectorsOf(UI_SHEETS);
const BLUE = 'Blue horse 42';
const GREEN = 'Green fox 7';
const MARKUP = '<b>x</b>';
const withPhrase =
  (phrase: unknown): NonNullable<WalletOptions['before']> =>
  async ext => {
    await ext.local.set(PHRASE_KEY, phrase);
  };
const lines = () => [...document.querySelectorAll('.app-phrase-line')].map(l => ({tone: l.classList.contains('shield') ? 'shield' : l.classList.contains('warning') ? 'warning' : 'other', text: l.textContent}));

describe('the locked screen: the phrase under the header (B1e §1.2)', () => {
  it.each(['popup', 'tab'] as const)('%s: the phrase beside the shield, named for a screen reader, under "Welcome back"', async surface => {
    await renderApp({unlocked: false, surface, before: withPhrase(BLUE)});
    const h1 = await screen.findByText('Welcome back');
    expect(lines()).toEqual([{tone: 'shield', text: `${PHRASE_TEXT.label}: ${BLUE}`}]);
    const line = document.querySelector('.app-phrase-line') as HTMLElement;
    expect(line.querySelector('.app-sr')?.textContent).toBe(`${PHRASE_TEXT.label}: `);
    expect(h1.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(line.compareDocumentPosition(screen.getByRole('button', {name: 'Unlock'})) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.screen') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it('none set: nothing — the screen is as before', async () => {
    await renderApp({unlocked: false});
    await screen.findByText('Welcome back');
    expect(lines()).toEqual([]);
  });

  it('a phrase that looks like markup renders as its own text — no element is made of it', async () => {
    await renderApp({unlocked: false, before: withPhrase(MARKUP)});
    await screen.findByText('Welcome back');
    expect(lines()).toEqual([{tone: 'shield', text: `${PHRASE_TEXT.label}: ${MARKUP}`}]);
    expect(document.querySelector('.app-phrase-line .copy')?.childElementCount).toBe(0);
    expect(document.querySelector('.app-phrase-line b')).toBeNull();
  });

  it.each([
    ['missing', (d: Record<string, unknown>) => ({...d, phrase: undefined})],
    ['not a phrase', (d: Record<string, unknown>) => ({...d, phrase: 42})],
  ] as const)('a phrase field this side cannot read (%s): R9’s line — the screen still shows, with [Unlock]', async (_why, tamper) => {
    const w = await setupWallet({unlocked: false, before: withPhrase(BLUE)});
    const engine = createEngine(async m => {
      const r = (await w.transport(m)) as {ok: boolean; data?: unknown};
      return (m as {type?: unknown}).type === 'wallet.state' && r.ok ? {...r, data: tamper(r.data as Record<string, unknown>)} : r;
    }, async () => undefined);
    render(<App surface="popup" engine={engine} platform={w.platform} hash="" />);
    await screen.findByText('Welcome back');
    expect(lines()).toEqual([{tone: 'warning', text: PHRASE_TEXT.failed}]);
    expect(screen.getByRole('status').textContent).toBe(PHRASE_TEXT.failed);
    expect(screen.getByRole('button', {name: 'Unlock'})).toBeTruthy();
  });
});

describe('#35: the anti-phishing row and its card (B1e §1.3, R1 = E18)', () => {
  async function shown(phrase?: unknown, surface: 'popup' | 'tab' = 'popup') {
    const calls = {back: 0};
    const w = await renderInWallet(<Security onBack={() => void calls.back++} onPasskey={() => undefined} onDelete={() => undefined} />, {surface, ...(phrase === undefined ? {} : {before: withPhrase(phrase)})});
    await waitFor(() => expect(document.querySelector('.s7-score-card')).not.toBeNull());
    return w;
  }
  const row = () => screen.getByText(SECURITY_TEXT.phrase, {selector: '.s7-title'}).closest('button') as HTMLButtonElement;
  const meta = () => row().querySelector('.s7-meta');
  const open = () => fireEvent.click(row());
  const field = () => document.querySelector('.app-phrase-input') as HTMLInputElement;
  const action = (name: string) => screen.getByRole('button', {name}) as HTMLButtonElement;

  it('Off when none is set, On when one is — as wallet.state says', async () => {
    await shown();
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.off));
    expect(meta()?.className).toBe('s7-meta');
    cleanup();
    await shown(BLUE);
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.on));
    expect(meta()?.className).toBe('s7-meta noc-success');
  });

  it('set when none is set: the card’s input, [Set phrase] only for a phrase the rules accept; written at once — no #10 — and the row says On', async () => {
    const w = await shown();
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.off));
    open();
    expect([field().getAttribute('aria-label'), screen.queryByRole('button', {name: SECURITY_TEXT.phraseRemove})]).toEqual([SECURITY_TEXT.phrase, null]);
    expect(unstyledClasses(document.querySelector('.app-phrase-card') as HTMLElement, SELECTORS)).toEqual([]);
    for (const bad of ['', 'ab', 'x'.repeat(33), 'Blue \u202ehorse 42']) {
      fireEvent.change(field(), {target: {value: bad}});
      expect([bad, action(SECURITY_TEXT.phraseSet).disabled]).toEqual([bad, true]);
    }
    fireEvent.change(field(), {target: {value: ` ${BLUE} `}});
    fireEvent.click(action(SECURITY_TEXT.phraseSet));
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.on));
    expect([await w.ext.local.get(PHRASE_KEY), w.platform.opened, w.platform.closed]).toEqual([BLUE, [], 0]);
  });

  it.each([
    ['change', SECURITY_TEXT.phraseChange, GREEN],
    ['remove', SECURITY_TEXT.phraseRemove, null],
  ] as const)('%s: goes to #10 — the popup opens it and closes; nothing is written here; the row and the card never show the stored phrase', async (_op, button, bound) => {
    const w = await shown(BLUE);
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.on));
    open();
    expect(field().getAttribute('aria-label')).toBe(SECURITY_TEXT.phraseNew);
    // Neither as text nor in the field: the card starts empty, whatever is stored.
    expect([document.body.textContent?.includes(BLUE), field().value]).toEqual([false, '']);
    if (bound !== null) fireEvent.change(field(), {target: {value: bound}});
    fireEvent.click(action(button));
    await waitFor(() => expect(w.platform.opened).toHaveLength(1));
    expect(w.platform.opened[0]).toMatch(/^unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    expect([w.platform.closed, await w.ext.local.get(PHRASE_KEY)]).toEqual([1, BLUE]);
    const id = w.platform.opened[0]?.split('challenge=')[1] ?? '';
    expect(((await w.ext.session.get(REAUTH_KEY)) as Record<string, {about: unknown}>)[id]?.about).toEqual({kind: 'phrase', phrase: bound});
  });

  it('change in the tab: #10 opens and the tab stays; the row keeps saying what is stored', async () => {
    const w = await shown(BLUE, 'tab');
    await waitFor(() => expect(meta()?.textContent).toBe(SECURITY_TEXT.on));
    open();
    fireEvent.change(field(), {target: {value: GREEN}});
    fireEvent.click(action(SECURITY_TEXT.phraseChange));
    await waitFor(() => expect(w.platform.opened).toHaveLength(1));
    expect([w.platform.closed, await w.ext.local.get(PHRASE_KEY)]).toEqual([0, BLUE]);
  });
});
```

Create `extension/src/approve/__tests__/phrase.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {fireEvent, render, screen} from '@testing-library/react';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {PHRASE_TEXT} from '../../app/ui/PhraseLine';
import {PHRASE_KEY} from '../../background/phraseKey';
import {handleMessage} from '../../background/messages';
import {setSession} from '../../background/session';
import {GRANTS_KEY} from '../../background/dapp/grants';
import {readDappSession} from '../../background/dapp/store';
import {openPage} from '../../background/dapp/__tests__/pageHarness';
import {presaleIx, transfer, v0} from '../../background/dapp/__tests__/txHarness';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {Approve} from '../Approve';
import {createClient} from '../client';
import {ARM_MS} from '../useArmed';
import {SECOND, acted, elapse, onHarnessClock, openWindow, settled} from './windowHarness';

// B1e §1.2 (undrawn, §9): the anti-phishing phrase in every approval window — #46, #47, #48 in every state (F12's
// Reject-only screen and a lookalike origin included), the locked window and #48's origin mismatch — under the header,
// as text; nothing when none is set; R9's line when the field cannot be read. Against the real background (dapp.pending
// carries the phrase at its top level); runs in both vitest runs.
const SELECTORS = selectorsOf(UI_SHEETS);
const BLUE = 'Blue horse 42';
const MARKUP = '<b>x</b>';
type Window = Awaited<ReturnType<typeof openWindow>>;
onHarnessClock();

const lines = () => [...document.querySelectorAll('.app-phrase-line')].map(l => ({tone: l.classList.contains('shield') ? 'shield' : l.classList.contains('warning') ? 'warning' : 'other', text: l.textContent}));
const shield = (phrase: string) => [{tone: 'shield', text: `${PHRASE_TEXT.label}: ${phrase}`}];
/** The line is the first thing under the window's top bar (a request screen), never inside the scrolled body. */
const underTopBar = () => document.querySelector('.app-approve > .top-bar')?.nextElementSibling?.classList.contains('app-phrase-line') === true;
const known = (w: Window) => w.ext.local.set('v1_known_recipients', [{address: RECIPIENT, at: 1}]);
/** As tx.test.tsx: the simulation stored, then the window's next read (a focus), then what it shows. */
async function simulated(w: Window, shows: string): Promise<void> {
  await settled(async () => expect((await readDappSession(w.ext)).queue[0]?.sim ?? null).not.toBeNull());
  await acted(() => window.dispatchEvent(new Event('focus')));
  await settled(() => screen.getAllByText(shows));
}
async function opened(phrase: string | undefined, o: {unlocked?: boolean} = {}): Promise<Window> {
  const w = await openWindow(o);
  if (phrase !== undefined) await w.ext.local.set(PHRASE_KEY, phrase);
  return w;
}

/** Each #48 state, reached against the real background; `shows` is what the state says. */
const TX_STATES: [string, (w: Window) => Promise<void>][] = [
  [
    'simulating',
    async w => {
      await known(w);
      w.deps.reader.simulateTransaction = () => new Promise(() => undefined);
      await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
      w.show();
      await settled(() => screen.getByText('Simulating transaction…'));
    },
  ],
  [
    'ready',
    async w => {
      await known(w);
      await w.signTx('https://jup.ag', [v0([transfer(1_000_000)])]);
      w.show();
      await simulated(w, 'Balance changes (post-simulation)');
      expect(screen.getByRole('button', {name: 'Approve'})).toBeTruthy();
    },
  ],
  [
    'couldn’t simulate',
    async w => {
      w.chain.err = {InstructionError: [0, {Custom: 1}]};
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, "Couldn't simulate");
    },
  ],
  [
    'unreachable',
    async w => {
      w.chain.down = true;
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, 'Could not reach the Noctura server.');
    },
  ],
  [
    'expired',
    async w => {
      w.chain.err = 'BlockhashNotFound';
      await w.signTx('https://jup.ag', [v0()]);
      w.show();
      await simulated(w, 'This request has expired. Ask the site to try again.');
    },
  ],
  [
    'F12 (Reject only)',
    async w => {
      await known(w);
      w.deps.geo = async () => ({open: false, reason: 'sanctioned', countryCode: 'KP'});
      await w.signTx('https://presale.example', [v0([presaleIx('presale_purchase_with_sol')])]);
      w.show();
      await simulated(w, 'Presale purchase blocked');
      expect([...document.querySelectorAll('.sticky-bar button')].map(b => b.textContent)).toEqual(['Reject']);
    },
  ],
  [
    'a lookalike origin',
    async w => {
      await known(w);
      await w.signTx('https://tensr.trade', [v0()]);
      w.show();
      await simulated(w, 'Balance changes (post-simulation)');
      expect(document.querySelector('.top-bar .title')?.textContent).toBe('Suspicious origin');
    },
  ],
  [
    'a lookalike’s risk confirm open',
    async w => {
      await known(w);
      await w.signTx('https://tensr.trade', [v0()]);
      w.show();
      await simulated(w, 'Balance changes (post-simulation)');
      await elapse(ARM_MS);
      fireEvent.click(screen.getByRole('button', {name: 'Approve anyway (not recommended)'}));
      await settled(() => screen.getByRole('dialog', {name: 'We strongly recommend rejecting. Continue?'}));
    },
  ],
  [
    'can no longer be signed (Q26)',
    async w => {
      await w.signTx('https://jup.ag', [v0()]);
      await setSession(w.ext, [SECOND]);
      w.show();
      await settled(() => screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.'));
    },
  ],
];

describe('#48: the phrase on every state (B1e §1.2)', () => {
  it.each(TX_STATES)('%s: the phrase under the top bar', async (_state, reach) => {
    const w = await opened(BLUE);
    await reach(w);
    expect([lines(), underTopBar()]).toEqual([shield(BLUE), true]);
    expect(unstyledClasses(document.querySelector('.app-approve') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it.each(TX_STATES.filter(([s]) => s === 'ready' || s === 'F12 (Reject only)' || s === 'a lookalike origin'))('%s, none set: no line', async (_state, reach) => {
    const w = await opened(undefined);
    await reach(w);
    expect(lines()).toEqual([]);
  });
});

describe('#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2)', () => {
  const SCREENS: [string, (w: Window) => Promise<void>][] = [
    [
      '#47 connect (a verified site)',
      async w => {
        await w.connect('https://jup.ag');
        w.show();
        await settled(() => screen.getByText('Connection request'));
      },
    ],
    [
      '#47 connect (an unknown site)',
      async w => {
        await w.connect('https://dapp.test');
        w.show();
        await settled(() => screen.getByText('Connect to this app?'));
      },
    ],
    [
      '#47 connect (a lookalike)',
      async w => {
        await w.connect('https://tensr.trade');
        w.show();
        await settled(() => screen.getByText('This domain is not tensor.trade'));
      },
    ],
    [
      '#46 sign message',
      async w => {
        await w.sign('https://jup.ag', 'Sign in to Jupiter');
        w.show();
        await settled(() => screen.getByText('Sign in to Jupiter'));
      },
    ],
    [
      '#48 origin mismatch',
      async w => {
        await w.ext.local.set(GRANTS_KEY, [{origin: 'https://jup.ag', account: ACCOUNT.publicKey, scope: 'persistent', connectedAt: 1, lastUsedAt: 1, recent: []}]);
        const page = openPage(w.ext, w.deps, 'https://dapp.test', {tab: {id: 99}});
        await page.ask({type: 'page.signTransaction', id: 'm', account: ACCOUNT.publicKey, transactions: [v0()]});
        w.show();
        await settled(() => screen.getByText('Request blocked automatically'));
      },
    ],
  ];

  it.each(SCREENS)('%s: under the top bar', async (_s, reach) => {
    await reach(await opened(BLUE));
    expect([lines(), underTopBar()]).toEqual([shield(BLUE), true]);
    expect(unstyledClasses(document.querySelector('.app-approve') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it.each(SCREENS)('%s, none set: no line', async (_s, reach) => {
    await reach(await opened(undefined));
    expect(lines()).toEqual([]);
  });

  it('the locked window (no top bar): the phrase first in the window; none set: no line', async () => {
    const w = await opened(BLUE, {unlocked: false});
    await w.connect('https://dapp.test');
    w.show();
    await settled(() => screen.getByText('Noctura is locked'));
    expect(lines()).toEqual(shield(BLUE));
    expect(document.querySelector('.app-approve-scroll')?.firstElementChild?.classList.contains('app-phrase-line')).toBe(true);
    expect(document.querySelectorAll('input, select, textarea, a')).toHaveLength(0);
    expect(unstyledClasses(document.querySelector('.app-approve') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it('a phrase that looks like markup renders as its own text — no element is made of it', async () => {
    const w = await opened(MARKUP);
    await w.connect('https://jup.ag');
    w.show();
    await settled(() => screen.getByText('Connection request'));
    expect(lines()).toEqual(shield(MARKUP));
    expect([document.querySelector('.app-phrase-line .copy')?.childElementCount, document.querySelector('.app-phrase-line b')]).toEqual([0, null]);
  });

  it('a phrase field the window cannot read: R9’s line — the request still shows, its Reject too', async () => {
    const w = await opened(BLUE);
    await w.connect('https://jup.ag');
    const approve = {id: w.ext.runtimeId, origin: w.ext.extensionOrigin, url: `${w.ext.extensionOrigin}/approve.html`};
    const client = createClient(async m => {
      const r = (await handleMessage(w.ext, m, approve, w.deps)) as {ok: boolean; data?: unknown};
      return r.ok && typeof r.data === 'object' && r.data !== null ? {...r, data: {...r.data, phrase: 7}} : r;
    });
    render(
      <div className="app app-window">
        <Approve client={client} close={() => undefined} />
      </div>,
    );
    await settled(() => screen.getByText('Connection request'));
    expect(lines()).toEqual([{tone: 'warning', text: PHRASE_TEXT.failed}]);
    expect(screen.getByRole('button', {name: 'Reject'})).toBeTruthy();
  });
});
```

Modify the existing tests (the challenge rows in both builds; the show's one `vault.status` read on #9 and #10; `wallet.state`'s parsed field; the required `phrase` prop where a screen is rendered alone; the vault page's module census) and add the new files to the build without presale:

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index 2b32feb..a4f8d54 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -1828,10 +1828,10 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
     const named = ['welcome', 'seed', 'confirm', 'password', 'passkey', 'createRun', 'importScreen', 'importRun', 'restoreRun', 'retryRun', 'forgot', 'unlock', 'reauth', 'accounts', 'reveal',
       // B1b-2b plan 1.
       'changePassword', 'delete', 'passkeyManage',
-      // B1e-1: the damaged states and their removal.
-      'damaged', 'removeDamaged'];
+      // B1e-1: the damaged states and their removal; the anti-phishing step.
+      'damaged', 'removeDamaged', 'antiPhishing'];
     expect([...screens].sort()).toEqual(named.map(n => `src/unlock/screens/${n}.ts`).sort());
-    expect([...views].sort()).toEqual(['dom', 'words', 'hold', 'meter', 'cooldown', 'deleteConfirm', 'saveDamaged'].map(n => `src/unlock/view/${n}.ts`).sort());
+    expect([...views].sort()).toEqual(['dom', 'words', 'hold', 'meter', 'cooldown', 'deleteConfirm', 'saveDamaged', 'phraseLine'].map(n => `src/unlock/view/${n}.ts`).sort());
     expect(resolved).toEqual(
       expect.arrayContaining([
         ...screens,
@@ -1840,6 +1840,7 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
         'src/unlock/forgetFlow.ts',
         'src/unlock/damagedFlow.ts',
         'src/shared/storedDigest.ts',
+        'src/shared/phraseRead.ts',
         'src/unlock/challenge.ts',
         'src/unlock/stored.ts',
         'src/unlock/page.ts',
diff --git a/extension/src/app/__tests__/Switcher.test.tsx b/extension/src/app/__tests__/Switcher.test.tsx
index 3a2c388..fe7dad6 100644
--- a/extension/src/app/__tests__/Switcher.test.tsx
+++ b/extension/src/app/__tests__/Switcher.test.tsx
@@ -10,13 +10,14 @@ import {walletReader} from './harness';
 import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
 import {RequestUnreachable} from '../../../../core/solana/rpc';
 import {WalletProvider, useWallet} from '../WalletContext';
+import {PHRASE_NONE} from '../../shared/phraseRead';
 import type {Account, Engine} from '../engine';
 import type {Platform} from '../platform';
 
 /** A fully self-contained Engine (no background involved): full control over the account list and every reply. */
 function stubEngine(accounts: Account[], selected: number): Engine {
   return {
-    state: async () => ({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts, selected, passkey: false}}),
+    state: async () => ({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts, selected, passkey: false, phrase: PHRASE_NONE}}),
     balances: async () => ({ok: true, data: {sol: 62_482_100_000n, noc: 4_200_000_000_000n, usdc: 740_210_000n, usdt: 0n}}),
     prices: async () => ({ok: true, data: {sol: 150, usdc: 1, usdt: 1, noc: 0.1501, at: 1}}),
     cached: async () => ({ok: true, data: {balances: null, prices: null}}),
diff --git a/extension/src/app/__tests__/engine.test.ts b/extension/src/app/__tests__/engine.test.ts
index ebdf4f4..98e6e51 100644
--- a/extension/src/app/__tests__/engine.test.ts
+++ b/extension/src/app/__tests__/engine.test.ts
@@ -73,7 +73,7 @@ describe('the B1b-2b plan 2 client calls (E17) against the real background', ()
 describe('the message client against the real background', () => {
   it('state, settings, ping, lock', async () => {
     const {engine} = await wired();
-    expect(await engine.state()).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 0, passkey: false}});
+    expect(await engine.state()).toEqual({ok: true, data: {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: ENV.accounts, selected: 0, passkey: false, phrase: {state: 'none'}}});
     expect(await engine.settings()).toEqual({ok: true, data: {autoLockMinutes: 5, reauthUsdCents: 10_000, selectedAccount: 0, accountOrder: null, phraseVerifiedAt: null, passwordChangedAt: null}});
     expect(await engine.ping()).toEqual({ok: true, data: null});
     expect(await engine.lock()).toEqual({ok: true, data: null});
@@ -191,8 +191,8 @@ describe('shape checks: a reply of the wrong shape is failed', () => {
   });
 
   it('B1b-2b: state requires a boolean passkey; settings requires the three new fields', async () => {
-    const good = {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: acc}], selected: 0, passkey: true};
-    expect(await engineAnswering({ok: true, data: good}).state()).toEqual({ok: true, data: good});
+    const good = {hasWallet: true, unlocked: true, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: acc}], selected: 0, passkey: true, phrase: null};
+    expect(await engineAnswering({ok: true, data: good}).state()).toEqual({ok: true, data: {...good, phrase: {state: 'none'}}});
     const {passkey: _p, ...missing} = good;
     expect(await engineAnswering({ok: true, data: missing}).state()).toEqual({ok: false, error: 'failed'});
     expect(await engineAnswering({ok: true, data: {...good, passkey: 'yes'}}).state()).toEqual({ok: false, error: 'failed'});
diff --git a/extension/src/approve/__tests__/presaleRegion.test.tsx b/extension/src/approve/__tests__/presaleRegion.test.tsx
index 4737f53..6024577 100644
--- a/extension/src/approve/__tests__/presaleRegion.test.tsx
+++ b/extension/src/approve/__tests__/presaleRegion.test.tsx
@@ -6,6 +6,7 @@ import {readDappSession} from '../../background/dapp/store';
 import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
 import {presaleIx, transfer, v0} from '../../background/dapp/__tests__/txHarness';
 import {pendingOf, type Flag, type RequestView} from '../client';
+import {PHRASE_NONE} from '../../shared/phraseRead';
 import {bannerInstruction, Tx} from '../Tx';
 import {FLAG_HOLD_MS} from '../useArmed';
 import {acted, elapse, onHarnessClock, openWindow, settled} from './windowHarness';
@@ -189,7 +190,7 @@ describe(`#48 F12 as the window reads it (${off ? 'off' : 'on'} build)`, () => {
     const raw = request([f12]);
     const v = pendingOf({state: 'request', request: {...raw, tx: {...raw.tx, transactions: [{...raw.tx.transactions[0], outcome: {ok: false, error: 'failed', detail: '{"InstructionError":[0,"Custom"]}'}}]}}, waiting: 0, windowNotice: false});
     if (v?.state !== 'request') throw new Error('not read');
-    render(<Tx request={v.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    render(<Tx request={v.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     expect([document.querySelector('.top-bar .title')?.textContent, document.querySelector('.top-bar .title')?.className]).toEqual(['Critical · Blocked transaction', 'title noc-overline noc-danger']);
     expect([...document.querySelectorAll('.s9-flag-banner .head')].map(h => h.textContent)).toEqual(["Couldn't simulate", Q49]);
     expect(buttons()).toEqual(['Reject']);
@@ -199,7 +200,7 @@ describe(`#48 F12 as the window reads it (${off ? 'off' : 'on'} build)`, () => {
     const site: RequestView['site'] = {kind: 'lookalike', name: 'jup', imitates: 'jup.ag', rule: 'edit', idn: null, international: false};
     const v = pendingOf({state: 'request', request: request([f12], site), waiting: 0, windowNotice: false});
     if (v?.state !== 'request') throw new Error('not read');
-    render(<Tx request={v.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    render(<Tx request={v.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     expect(buttons()).toEqual(['Reject and report', 'Reject']);
     expect(screen.queryByRole('button', {name: /Approve/})).toBeNull();
     expect(banners()[0]?.head).toBe(Q49);
diff --git a/extension/src/approve/__tests__/tx.test.tsx b/extension/src/approve/__tests__/tx.test.tsx
index 8e01391..36513ed 100644
--- a/extension/src/approve/__tests__/tx.test.tsx
+++ b/extension/src/approve/__tests__/tx.test.tsx
@@ -16,6 +16,7 @@ import {ME, TO, assign, ataCreate, coSigned, mintTo, setAuthorityToNone, tokenAp
 import {U64_MAX, tokenAccountBytes, usdcLikeMint} from '../../background/dapp/__tests__/tokenBytes';
 import {ATA_PROGRAM, TOKEN_2022_PROGRAM, TOKEN_PROGRAM} from '../../background/dapp/decode/decode';
 import {dependsOnStep, pendingOf, type Flag, type RequestView} from '../client';
+import {PHRASE_NONE} from '../../shared/phraseRead';
 import {POLL_MS} from '../Approve';
 import {Tx} from '../Tx';
 import {ARM_MS, FLAG_HOLD_MS} from '../useArmed';
@@ -553,7 +554,7 @@ describe('#48 dapp-tx-approval', () => {
   it('a detail refused for an unknown flag kind: Q26 and only Reject — never the request with the flag dropped', () => {
     const read = pendingOf(batchView({first: [{kind: 'drain', severity: 'warn', word: null, at: 0}]}));
     if (read?.state !== 'request') throw new Error('unread');
-    render(<Tx request={read.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    render(<Tx request={read.request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     expect(screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.')).toBeTruthy();
     expect(screen.getAllByRole('button').map(b => b.getAttribute('aria-label') ?? b.textContent)).toEqual(['Close', 'Reject']);
   });
@@ -617,7 +618,7 @@ describe('#48 dapp-tx-approval', () => {
         transactions: [{version: 0, feePayer: ACCOUNT.publicKey, instructions: null, unitLimit: null, feeLamports: null, outcome: null, flags: null}],
       },
     };
-    render(<Tx request={request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    render(<Tx request={request} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     expect(screen.getByText('Instructions appear once the transaction is simulated.')).toBeTruthy();
   });
 
@@ -647,11 +648,11 @@ describe('#48 dapp-tx-approval', () => {
       },
     };
     const withoutTx: RequestView = {...withTx, tx: null};
-    const view = render(<Tx request={withTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    const view = render(<Tx request={withTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     expect(screen.getByText('Simulating transaction…')).toBeTruthy();
-    expect(() => view.rerender(<Tx request={withoutTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />)).not.toThrow();
+    expect(() => view.rerender(<Tx request={withoutTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />)).not.toThrow();
     expect(screen.getByText('This request can no longer be signed. Reject it and ask the site to try again.')).toBeTruthy();
-    expect(() => view.rerender(<Tx request={withTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />)).not.toThrow();
+    expect(() => view.rerender(<Tx request={withTx} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />)).not.toThrow();
     expect(screen.getByText('Simulating transaction…')).toBeTruthy();
   });
 });
@@ -1092,7 +1093,7 @@ describe('#48 red flags (B1c-3)', () => {
       {kind: 'token-2022', severity: 'warn', word: null, at: 4, mint: USDC, settings: null},
       {kind: 'whole-balance', severity: 'warn', word: null, at: null},
     ];
-    render(<Tx request={flagged(flags)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    render(<Tx request={flagged(flags)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     const banners = [...document.querySelectorAll('.s9-flag-banner')].map(b => ({
       tone: b.className.replace('s9-flag-banner ', ''),
       head: b.querySelector('.head')?.textContent,
@@ -1144,7 +1145,7 @@ describe('#48 red flags (B1c-3)', () => {
 
   it('L14 (review 3): a token the wallet cannot name, nearly all of it below u64::MAX — its head says "of this token", the word to type is ALLOWANCE (Q58), never UNLIMITED', () => {
     const flags: Flag[] = [{kind: 'unlimited-approve', severity: 'block', word: 'ALLOWANCE', at: null, approvals: [approval({at: null, symbol: null, decimals: null, mint: MINT, amount: '995'})]}];
-    render(<Tx request={flagged(flags)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    render(<Tx request={flagged(flags)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     expect(text('.top-bar .title')).toBe('Critical · Large spend approval');
     expect(text('.s9-flag-banner.danger .head')).toBe('Spend approval for nearly all of this token');
     expect(text('.s9-typed-confirm .label')).toBe('Type ALLOWANCE to enable Approve');
@@ -1153,11 +1154,11 @@ describe('#48 red flags (B1c-3)', () => {
 
   it('fix round 1 Minor 1: F6’s body (Q45) never doubles the symbol — a named token says the bare amount, an unnamed one "of this token"', () => {
     const named: Flag[] = [{kind: 'bounded-approve', severity: 'warn', word: null, at: null, approvals: [approval({symbol: 'USDC', decimals: 6, amount: '5000000'})]}];
-    render(<Tx request={flagged(named)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    render(<Tx request={flagged(named)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     expect(text('.s9-flag-banner.warn .body')).toBe('This lets a delegate move up to 5 of your USDC until you revoke.');
     cleanup();
     const unnamed: Flag[] = [{kind: 'bounded-approve', severity: 'warn', word: null, at: null, approvals: [approval({symbol: null, decimals: null, mint: MINT, amount: '5000000'})]}];
-    render(<Tx request={flagged(unnamed)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} />);
+    render(<Tx request={flagged(unnamed)} waiting={0} notice={false} busy={false} onDecide={() => Promise.resolve(undefined)} phrase={PHRASE_NONE} />);
     expect(text('.s9-flag-banner.warn .body')).toBe('This lets a delegate move up to 5000000 of this token until you revoke.');
   });
 
diff --git a/extension/src/unlock/__tests__/challenge.test.ts b/extension/src/unlock/__tests__/challenge.test.ts
index 2143159..ea72bc2 100644
--- a/extension/src/unlock/__tests__/challenge.test.ts
+++ b/extension/src/unlock/__tests__/challenge.test.ts
@@ -415,3 +415,38 @@ describe('readChallenge against the real background', () => {
     expect(await discardPrepared(async () => ({ok: false, error: 'malformed'}), ACCOUNT.publicKey)).toBe(false);
   });
 });
+
+// B1e §1.3: a phrase challenge reaches #10 as the background's redacted description — what it is for, never the value.
+describe('describeChallenge: the anti-phishing phrase (B1e §1.3)', () => {
+  it('change and remove, exactly as the background describes them (positive control)', () => {
+    expect(describeChallenge({kind: 'phrase', action: 'change'})).toEqual({kind: 'phrase', action: 'change'});
+    expect(describeChallenge({kind: 'phrase', action: 'remove'})).toEqual({kind: 'phrase', action: 'remove'});
+  });
+
+  it('fails closed: another action, a key more (the value itself included) or less', () => {
+    for (const bad of [{kind: 'phrase', action: 'set'}, {kind: 'phrase'}, {kind: 'phrase', action: 'change', phrase: 'Green fox 7'}, {kind: 'phrase', phrase: 'Green fox 7'}, {kind: 'phrase', phrase: null}, {kind: 'phrase', action: null}]) {
+      expect([bad, describeChallenge(bad)]).toEqual([bad, null]);
+    }
+  });
+
+  it('through the real background: settings.phrase’s challenge reads as described, its value nowhere in the answer', async () => {
+    const ext = fakeExt();
+    const deps = fakeDeps();
+    await unlocked(ext);
+    const popup = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop', url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/popup.html'};
+    const page = {...popup, url: 'chrome-extension://abcdefghijklmnopabcdefghijklmnop/unlock.html'};
+    expect(await handleMessage(ext, {type: 'settings.phrase', phrase: 'Blue horse 42'}, popup, deps)).toEqual({ok: true, data: {outcome: 'set'}});
+    for (const [value, action] of [['Green fox 7', 'change'], [null, 'remove']] as const) {
+      const r = await handleMessage(ext, {type: 'settings.phrase', phrase: value}, popup, deps);
+      const id = (r.data as {challengeId: string}).challengeId;
+      const answers: unknown[] = [];
+      const send: Send = async m => {
+        const a = (await handleMessage(ext, m, page, deps)) as {ok: boolean; error?: string; data?: unknown};
+        answers.push(a);
+        return a;
+      };
+      expect(await readChallenge(send, id)).toEqual({state: 'described', description: {kind: 'phrase', action}});
+      expect(JSON.stringify(answers)).not.toContain('Green');
+    }
+  });
+});
diff --git a/extension/src/unlock/__tests__/reauthPurchase.test.ts b/extension/src/unlock/__tests__/reauthPurchase.test.ts
index f8f482d..33f8d96 100644
--- a/extension/src/unlock/__tests__/reauthPurchase.test.ts
+++ b/extension/src/unlock/__tests__/reauthPurchase.test.ts
@@ -101,7 +101,7 @@ describe('#10 for a purchase (§4.2)', () => {
     click(el('ra-confirm'));
     await h.until(() => h.went.length > 0);
     expect(h.went).toEqual([`wallet.html#/send/resume?account=${K0}`]);
-    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo', 'vault.status', 'vault.reauthOk']);
+    expect(h.sent.map(m => m.type)).toEqual(['vault.status', 'vault.challengeInfo', 'vault.status', 'vault.reauthOk']);
     expect(broadcasts).toEqual([]);
   });
 
diff --git a/extension/src/unlock/__tests__/reauthScreen.test.ts b/extension/src/unlock/__tests__/reauthScreen.test.ts
index 1102d3c..d664f85 100644
--- a/extension/src/unlock/__tests__/reauthScreen.test.ts
+++ b/extension/src/unlock/__tests__/reauthScreen.test.ts
@@ -185,7 +185,7 @@ describe('#10 unlock-send (spec §3.10)', () => {
     expect(text(el('ra-helper'))).toBe('Checking…');
     await h.until(() => h.went.length > 0);
     expect(h.went).toEqual([`wallet.html#/send/resume?account=${K0}`]);
-    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo', 'vault.status', 'vault.reauthOk']);
+    expect(h.sent.map(m => m.type)).toEqual(['vault.status', 'vault.challengeInfo', 'vault.status', 'vault.reauthOk']);
     const stored = (await h.ext.session.get('v1_reauth')) as Record<string, {satisfied: boolean}>;
     expect(stored[id]?.satisfied).toBe(true);
     nothingSent(h, broadcast);
@@ -257,7 +257,7 @@ describe('#10 unlock-send (spec §3.10)', () => {
     expect(visible(el('ra-entry'))).toBe(false);
     expect(visible(el('ra-intent'))).toBe(false);
     expect(document.querySelector('#v-reauth button:not([hidden]):not(#ra-cancel):not(#ra-x)')).toBeNull();
-    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
+    expect(h.sent.map(m => m.type)).toEqual(['vault.status', 'vault.challengeInfo']);
   });
 
   it('mismatch: a session that is not this wallet’s is locked, and the page says so', async () => {
@@ -433,7 +433,7 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     expect(screen.holds()).toBe(true);
     h.leave(why);
     expect([carries(PW), screen.holds()]).toEqual([[], false]);
-    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
+    expect(h.sent.map(m => m.type)).toEqual(['vault.status', 'vault.challengeInfo']);
   });
 
   it('an empty field sends nothing', async () => {
@@ -441,7 +441,7 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     click(el('ra-confirm'));
     el('ra-form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true}));
     await new Promise(r => setTimeout(r, 5));
-    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
+    expect(h.sent.map(m => m.type)).toEqual(['vault.status', 'vault.challengeInfo']);
   });
 
   it('[Confirm with passkey] only when the envelope has one: it confirms, hands over, and the PRF output is zeroed', async () => {
@@ -736,7 +736,7 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     const three = await shown(DAPP);
     click(el('ra-cancel'));
     await three.h.until(() => three.h.closed > 0);
-    expect(three.h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
+    expect(three.h.sent.map(m => m.type)).toEqual(['vault.status', 'vault.challengeInfo']);
   });
 
   // Fix round 1 item 5 (global constraints: "#10's dApp refused/applied branch"): vault.reauthOk refusing for any
@@ -757,7 +757,7 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     const {h} = await shown({kind: 'settings', autoLockMinutes: 5, reauthUsdCents: null});
     click(el('ra-cancel'));
     await h.until(() => h.closed > 0);
-    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
+    expect(h.sent.map(m => m.type)).toEqual(['vault.status', 'vault.challengeInfo']);
     expect(text(document.body)).not.toMatch(/cancelled/i);
   });
 
@@ -829,12 +829,12 @@ describe('#10: the carried rules (Task 10’s password, passkey, cooldown and ru
     force('ra-confirm');
     force('ra-passkey');
     await new Promise(r => setTimeout(r, 5));
-    expect([a.h.sent.map(m => m.type), prfOutputs.length, a.h.went]).toEqual([['vault.challengeInfo'], 0, []]);
+    expect([a.h.sent.map(m => m.type), prfOutputs.length, a.h.went]).toEqual([['vault.status', 'vault.challengeInfo'], 0, []]);
     loadPage();
     const b = await shown(SEND(K0), {unlocked: false});
     force('ra-cancel');
     await new Promise(r => setTimeout(r, 5));
-    expect([b.h.sent.map(m => m.type), b.h.closed]).toEqual([['vault.challengeInfo'], 0]);
+    expect([b.h.sent.map(m => m.type), b.h.closed]).toEqual([['vault.status', 'vault.challengeInfo'], 0]);
   });
 });
 
diff --git a/extension/src/unlock/__tests__/unlockScreen.test.ts b/extension/src/unlock/__tests__/unlockScreen.test.ts
index 3d1621a..f2b997d 100644
--- a/extension/src/unlock/__tests__/unlockScreen.test.ts
+++ b/extension/src/unlock/__tests__/unlockScreen.test.ts
@@ -40,6 +40,9 @@ async function shown(vault: unknown, o: {returnTo?: 'created' | 'imported' | nul
   const h = await harness({vault, holdSleep: o.holdSleep, credentials: o.credentials});
   const screen = mountUnlock(h.deps);
   await screen.show(o.returnTo ?? null);
+  // B1e §1.2: the reading phase's one vault.status (the anti-phishing phrase) is the show's — what a test then counts is
+  // what its own action sent (phraseScreens.test.ts pins the read itself).
+  h.sent.splice(0);
   return Object.assign(h, {screen});
 }
 const submit = (password: string) => {
diff --git a/extension/vitest.nopresale.config.ts b/extension/vitest.nopresale.config.ts
index 1f7b0b9..3e02556 100644
--- a/extension/vitest.nopresale.config.ts
+++ b/extension/vitest.nopresale.config.ts
@@ -24,6 +24,10 @@ export const NOPRESALE_TESTS = [
   'src/background/geo/__tests__/gate.test.ts',
   'src/background/dapp/__tests__/presaleRegion.test.ts',
   'src/approve/__tests__/presaleRegion.test.tsx',
+  // B1e §1.6: the anti-phishing phrase on the six screens, in both builds.
+  'src/app/__tests__/phrase.test.tsx',
+  'src/approve/__tests__/phrase.test.tsx',
+  'src/unlock/__tests__/phraseScreens.test.ts',
   '../core/geo/**/*.test.ts',
 ];
 
```

- [ ] **Step 2: Run — red.**

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `2` (32 errors: TS2307 `../phraseRead`, `../ui/PhraseLine`, `../../app/ui/PhraseLine` not found; TS2322 / TS2339 the `phrase` prop and `PHRASE_NONE` in the renders and the Switcher literal — vitest runs regardless).
Run: `TZ=UTC npx vitest run src/shared/__tests__/phraseRead.test.ts src/unlock/__tests__/phraseScreens.test.ts src/unlock/__tests__/challenge.test.ts src/app/__tests__/phrase.test.tsx src/approve/__tests__/phrase.test.tsx src/unlock/__tests__/unlockScreen.test.ts src/unlock/__tests__/reauthScreen.test.ts src/unlock/__tests__/reauthPurchase.test.ts src/app/__tests__/engine.test.ts scripts/__tests__/check-vault-isolation.test.mjs`
Expected on Task 4's tree: `Test Files  9 failed | 1 passed (10)` · `Tests  14 failed | 584 passed (598)` — the four new files fail to load (`Cannot find module '../phraseRead'`, `Failed to resolve import "../ui/PhraseLine"` / `"../../app/ui/PhraseLine"`); challenge 2 (the phrase description is `null`: no branch), reauthScreen 8 and reauthPurchase 1 (no `vault.status` before `vault.challengeInfo`), engine 2 (`wallet.state` has no parsed `phrase`), check-vault-isolation 1 (`antiPhishing`, `phraseLine`, `phraseRead` not in the page). (`unlockScreen.test.ts` passes: its change only clears the show's sends.) (Observed: the final test files on Task 4's tree 42dc457 in a scratch copy.)

- [ ] **Step 3: Implement.**

Create `extension/src/shared/phraseRead.ts`:

```ts
import {cleanPhrase} from './envelopeRules';

/**
 * B1e §1.2 (R9): what a screen shows of the anti-phishing phrase, from the `phrase` field of `wallet.state`,
 * `vault.status` or `dapp.pending`. `none`: no phrase is set — nothing shows. `set`: the phrase, shown as plain text.
 * `failed`: the read did not give an answer this side can trust (no answer, an error, a field missing or not exactly a
 * phrase the background would store) — the screen says it could not be read, never silence, which would look like a
 * phishing window and like "no phrase" at once.
 */
export type PhraseRead = {state: 'none'} | {state: 'set'; phrase: string} | {state: 'failed'};

export const PHRASE_NONE: PhraseRead = {state: 'none'};
export const PHRASE_FAILED: PhraseRead = {state: 'failed'};

/** The field as an answer carries it: null is none; a string that is exactly a clean phrase is the phrase; anything else failed. */
export function phraseRead(field: unknown): PhraseRead {
  if (field === null) return PHRASE_NONE;
  return typeof field === 'string' && cleanPhrase(field) === field ? {state: 'set', phrase: field} : PHRASE_FAILED;
}
```

Create `extension/src/app/ui/PhraseLine.tsx`:

```tsx
import type {PhraseRead} from '../../shared/phraseRead';
import {ExtIcon} from './ExtIcon';

/** B1e §1.2: the line's copy. `failed` is R9's line, word for word; `label` names the line for a screen reader. */
export const PHRASE_TEXT = {
  label: 'Anti-phishing phrase',
  failed: "Anti-phishing phrase could not be read — don't type your password until it shows",
} as const;

/**
 * B1e §1.2 (undrawn, §9): the anti-phishing phrase under a screen's header — the design's `.banner.shield` with its
 * shield icon and the phrase as a React text child (never markup); nothing when none is set; R9's warning line when the
 * read failed. Used by the popup's locked screen and every approval window (#46, #47, #48, the locked window, #48's
 * origin mismatch).
 */
export function PhraseLine({phrase}: {phrase: PhraseRead}) {
  if (phrase.state === 'none') return null;
  if (phrase.state === 'failed') {
    return (
      <div className="banner warning app-phrase-line" role="status">
        <ExtIcon name="alert-triangle" size={16} />
        <p className="noc-body-sm">{PHRASE_TEXT.failed}</p>
      </div>
    );
  }
  return (
    <div className="banner shield app-phrase-line">
      <ExtIcon name="shield-lock" size={16} />
      <p className="noc-body-sm">
        <span className="app-sr">{PHRASE_TEXT.label}: </span>
        <span className="copy">{phrase.phrase}</span>
      </p>
    </div>
  );
}
```

Create `extension/src/unlock/view/phraseLine.ts`:

```ts
import {PHRASE_FAILED, phraseRead, type PhraseRead} from '../../shared/phraseRead';
import type {Send} from '../types';
import {byId, setText, shown} from './dom';

/**
 * B1e §1.4: the anti-phishing phrase for #9 and #10, from vault.status's `phrase` (answered locked or unlocked). A send
 * that throws, a refusal or an answer without a readable field is `failed` (R9).
 */
export async function readPhraseLine(send: Send): Promise<PhraseRead> {
  try {
    const r = await send({type: 'vault.status'});
    return r.ok && typeof r.data === 'object' && r.data !== null ? phraseRead((r.data as {phrase?: unknown}).phrase) : PHRASE_FAILED;
  } catch {
    return PHRASE_FAILED;
  }
}

/**
 * B1e §1.2: one screen's line (`unl` #9, `ra` #10) — the phrase as textContent beside the shield, R9's fixed line
 * (unlock.html) when the read failed, neither when no phrase is set.
 */
export function showPhraseLine(screen: 'unl' | 'ra', read: PhraseRead): void {
  setText(byId(`${screen}-phrase-text`), read.state === 'set' ? read.phrase : '');
  shown(byId(`${screen}-phrase`), read.state === 'set');
  shown(byId(`${screen}-phrase-failed`), read.state === 'failed');
}
```

Create `extension/src/unlock/screens/antiPhishing.ts`:

```ts
import {cleanPhrase} from '../../shared/envelopeRules';
import {exclusive, type PageDeps} from '../page';
import {COMMON} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import type {PhraseStep} from './createRun';

/**
 * B1e §1.3 (undrawn, §9): onboarding's skippable last step, "Set an anti-phishing phrase". The runs call it only once
 * the wallet is stored and its keys are in the session (createRun: when #6 ends; importRun: on `created`; never on
 * `created-locked`), so the one write here — settings.phrase, set-when-none — lands after the first write that would
 * have wiped it. [Set phrase] is enabled only for a value cleanPhrase accepts (the background cleans it again); a
 * refusal says so and keeps the step, where [Skip] still goes on. [Skip] writes nothing. Either way the run's own
 * `then` moves the tab on (#7 or #40). Rule 6: both buttons run through the page's one gate.
 */
export function mountAntiPhishing(deps: PageDeps): PhraseStep {
  const field = byId<HTMLInputElement>('ap-field');
  const set = byId<HTMLButtonElement>('ap-set');
  const skip = byId<HTMLButtonElement>('ap-skip');
  const line = byId('ap-line');
  /** The run's continuation while the step shows; null once it has gone on. */
  let then: (() => void) | null = null;
  /** The step came up while the gate was held (#6's own action ends here): the field takes the focus once it is enabled. */
  let focusPending = false;

  const render = () => {
    const busy = deps.gate.isBusy();
    const open = then !== null;
    field.disabled = busy || !open;
    set.disabled = busy || !open || typeof cleanPhrase(field.value) !== 'string';
    skip.disabled = busy || !open;
    if (focusPending && !field.disabled) {
      focusPending = false;
      field.focus();
    }
  };
  const say = (text: string | null) => {
    setText(line, text ?? '');
    shown(line, text !== null);
  };
  const goOn = () => {
    const next = then;
    then = null;
    focusPending = false;
    field.value = '';
    render();
    next?.();
  };
  const save = () => {
    if (then === null || typeof cleanPhrase(field.value) !== 'string') return;
    void exclusive(deps, render, async () => {
      const phrase = cleanPhrase(field.value);
      if (then === null || typeof phrase !== 'string') return;
      say(null);
      let outcome: unknown;
      try {
        const r = await deps.send({type: 'settings.phrase', phrase});
        outcome = r.ok && typeof r.data === 'object' && r.data !== null ? (r.data as {outcome?: unknown}).outcome : undefined;
      } catch {
        outcome = undefined;
      }
      if (outcome === 'set' || outcome === 'unchanged') return goOn();
      say(COMMON.failedTryAgain);
    });
  };

  deps.gate.onIdle(render);
  field.addEventListener('input', () => {
    say(null);
    render();
  });
  byId('ap-form').addEventListener('submit', e => {
    e.preventDefault();
    save();
  });
  set.addEventListener('click', save);
  skip.addEventListener('click', () => {
    if (then === null) return;
    void exclusive(deps, render, async () => {
      if (then !== null) goOn();
    });
  });

  return o => {
    then = o.then;
    field.value = '';
    say(null);
    showScreen('v-anti-phishing');
    focusPending = true;
    render();
  };
}
```

The popup and the UI tab — `wallet.state`'s field, the locked screen's line, #35's row and card, the hand-written styles:

```diff
diff --git a/extension/src/app/WalletContext.tsx b/extension/src/app/WalletContext.tsx
index 7d66544..7f0aa8e 100644
--- a/extension/src/app/WalletContext.tsx
+++ b/extension/src/app/WalletContext.tsx
@@ -280,7 +280,7 @@ export function WalletProvider({
       if (!alive.current || !r.ok) return;
       const w = r.data;
       setWallet(prev => {
-        const changed = prev === null || prev.unlocked !== w.unlocked || prev.selected !== w.selected || prev.passkey !== w.passkey || JSON.stringify(prev.accounts) !== JSON.stringify(w.accounts);
+        const changed = prev === null || prev.unlocked !== w.unlocked || prev.selected !== w.selected || prev.passkey !== w.passkey || JSON.stringify(prev.accounts) !== JSON.stringify(w.accounts) || JSON.stringify(prev.phrase) !== JSON.stringify(w.phrase);
         return changed ? w : prev;
       });
       if (!w.hasWallet || !w.unlocked) {
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 209dced..b4e451e 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -2377,3 +2377,40 @@ body:has(.app-window) {
 .s-ref p.app-ref-failed {
   color: var(--fg-secondary);
 }
+/* B1e §1.2 (undrawn, §9): the anti-phishing phrase line under a screen's header — B1b's `.banner` (shield, or warning
+   for R9's line) at the screen's gutter, never scrolled away with the body below it. The phrase wraps whole words and
+   breaks a long one anywhere: it is the user's own text, never cut. */
+.app-phrase-line {
+  flex: 0 0 auto;
+  align-self: stretch;
+  margin: 0 var(--space-4) var(--space-3);
+  text-align: start;
+}
+.app-phrase-line > .noc-body-sm {
+  margin: 0;
+  min-width: 0;
+  overflow-wrap: anywhere;
+}
+.app-center > .app-phrase-line {
+  margin: 0;
+}
+/* A label only a screen reader reads (the vault page's `.vlt-sr`). */
+.app-sr {
+  position: absolute;
+  width: 1px;
+  height: 1px;
+  overflow: hidden;
+  clip-path: inset(50%);
+  white-space: nowrap;
+}
+/* B1e §1.3 (undrawn, §9): #35's anti-phishing card — B1b's input across the card, its two buttons side by side. */
+.app-picker-card .app-phrase-input {
+  width: 100%;
+}
+.app-phrase-actions {
+  display: flex;
+  gap: var(--space-2);
+}
+.app-phrase-card p.noc-caption {
+  margin: 0;
+}
diff --git a/extension/src/app/engine.ts b/extension/src/app/engine.ts
index 70f7a61..e23f0a0 100644
--- a/extension/src/app/engine.ts
+++ b/extension/src/app/engine.ts
@@ -1,5 +1,6 @@
 import {send as runtimeSend} from '../ui/send';
 import {SITE} from '../shared/site';
+import {phraseRead, type PhraseRead} from '../shared/phraseRead';
 
 /**
  * The popup's and the tab's one way to the background (spec B1b-2a §1.5): one typed function per
@@ -26,6 +27,8 @@ export interface WalletState {
   selected: number | null;
   /** B1b-2b E12: the stored envelope has a passkey wrap. */
   passkey: boolean;
+  /** B1e §1.2, §1.4: the anti-phishing phrase — a field this side cannot read is `failed` (R9), never the whole state. */
+  phrase: PhraseRead;
 }
 export interface Balances {
   sol: bigint;
@@ -295,7 +298,7 @@ export function walletStateOf(x: unknown): WalletState | undefined {
   const accounts = all(o.accounts, account);
   const selected = o.selected === null ? null : isInt(o.selected) ? o.selected : undefined;
   if (scheme === undefined || accounts === undefined || selected === undefined || typeof o.passkey !== 'boolean') return undefined;
-  return {hasWallet: o.hasWallet, unlocked: o.unlocked, scheme, accounts, selected, passkey: o.passkey};
+  return {hasWallet: o.hasWallet, unlocked: o.unlocked, scheme, accounts, selected, passkey: o.passkey, phrase: phraseRead(o.phrase)};
 }
 
 function balancesOf(x: unknown): Balances | undefined {
diff --git a/extension/src/app/screens/Locked.tsx b/extension/src/app/screens/Locked.tsx
index 214c42d..bbf4aab 100644
--- a/extension/src/app/screens/Locked.tsx
+++ b/extension/src/app/screens/Locked.tsx
@@ -1,14 +1,16 @@
 import {useWallet} from '../WalletContext';
 import {ExtIcon} from '../ui/ExtIcon';
 import {LockedButton} from '../ui/LockedButton';
+import {PhraseLine} from '../ui/PhraseLine';
 
 /**
  * The popup's locked screen (spec §4.1, derived from #9): no password field — the password only ever
  * exists in the vault page (D12), so [Unlock] opens it in a tab, and "Forgot password?" opens #39 there.
- * Both are LockedButtons (cardinal rule 6): a double click opens one tab.
+ * Both are LockedButtons (cardinal rule 6): a double click opens one tab. B1e §1.2: the anti-phishing phrase under the
+ * header, from `wallet.state` (nothing when none is set; R9's line when it could not be read).
  */
 export function Locked() {
-  const {platform, surface} = useWallet();
+  const {platform, surface, wallet} = useWallet();
   // The popup closes once the vault page opens; the tab (wallet.html) is the page the user is looking
   // at and stays open (§7.1 only opens ?mode=unlock; review fix round 1 #5, a ruling).
   const open = (page: 'unlock.html?mode=unlock' | 'unlock.html?mode=forgot') => () => {
@@ -21,6 +23,7 @@ export function Locked() {
         <ExtIcon name="lock" size={28} />
       </div>
       <h1 className="noc-h1">Welcome back</h1>
+      {wallet === null ? null : <PhraseLine phrase={wallet.phrase} />}
       <p className="noc-body app-muted">Unlock Noctura to continue. Unlocking opens in a new tab.</p>
       <div className="app-center-actions">
         <LockedButton className="btn btn-primary" onPress={open('unlock.html?mode=unlock')}>
diff --git a/extension/src/app/screens/Security.tsx b/extension/src/app/screens/Security.tsx
index 524e748..a84cc36 100644
--- a/extension/src/app/screens/Security.tsx
+++ b/extension/src/app/screens/Security.tsx
@@ -1,6 +1,7 @@
 import {useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
 import {useWallet} from '../WalletContext';
 import {formatAmount} from '../../shared/amount';
+import {cleanPhrase} from '../../shared/envelopeRules';
 import {reauthPage, type ExtensionPage} from '../platform';
 import {TopBar} from '../ui/TopBar';
 import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
@@ -43,8 +44,25 @@ export const SECURITY_TEXT = {
   deleteBody: "Removes the encrypted keys and local data from this browser. To restore, you'll need your recovery phrase.",
   deleteButton: 'Delete wallet',
   minutes: (n: number) => `${n} min`,
+  /** B1e §1.3 (undrawn, §9): the anti-phishing row and its card — the step's copy (unlock.html #v-anti-phishing). */
+  phrase: 'Anti-phishing phrase',
+  phraseCaption: "Noctura shows it on its unlock and approval windows. A window without it is not Noctura's.",
+  phraseNew: 'New anti-phishing phrase',
+  phraseHelper: '3–32 characters: letters, numbers, symbols and simple emoji.',
+  phraseHelp: 'Never type it into a website. Anyone who uses this browser profile can see it.',
+  phraseNote: 'A change or a removal asks for your password in a new tab.',
+  phraseSet: 'Set phrase',
+  phraseChange: 'Change phrase',
+  phraseRemove: 'Remove phrase',
 } as const;
 
+/** settings.phrase's answers (B1e §1.3): written, or the same value again; otherwise a refusal or #10's challenge. */
+const PHRASE_CODES = ['malformed', 'locked', 'reauth-required'] as const;
+const phraseOutcome = (d: unknown): 'set' | 'unchanged' | undefined => {
+  const o = typeof d === 'object' && d !== null ? (d as {outcome?: unknown}).outcome : undefined;
+  return o === 'set' || o === 'unchanged' ? o : undefined;
+};
+
 /** D1: 1 / 5 / 15 / 60 minutes — no "Never" (the engine's range is 1–60, and a short lock is one of B1's few limits). */
 export const AUTOLOCK_OPTIONS = [1, 5, 15, 60].map(value => ({value, label: SECURITY_TEXT.minutes(value)}));
 /** D5: $50 / $100 / $500 / $1,000, in cents. */
@@ -74,6 +92,11 @@ export function securityTasks(passkey: boolean, phraseVerifiedAt: number | null)
  * every row that opens a page (35b's "Recovery phrase verified" too — pre-flight F9), every row and task that pushes the
  * passkey screen (the final review's m6) and [Delete wallet]. The tab reads the settings again when shown again. A settings.set
  * answered after the screen went or after a lock meanwhile sets, opens and shows nothing.
+ *
+ * B1e §1.3 (R1 = E18): the anti-phishing row, On or Off from `wallet.state`, opens its card in place: a phrase typed there
+ * is set at once when none is set; a change or a removal answers `reauth-required` and #10 applies it, exactly as a
+ * weakening picker choice — the row keeps saying what is stored. The card never shows the stored phrase (the locked
+ * screen and the approval windows do).
  */
 export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onPasskey: () => void; onDelete: () => void}) {
   const m = useWallet();
@@ -81,7 +104,10 @@ export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onP
   const [readFailed, setReadFailed] = useState(false);
   const [open, setOpen] = useState<Card>(null);
   const [failed, setFailed] = useState(false);
+  const [typed, setTyped] = useState('');
   const passkey = m.wallet?.passkey === true;
+  const phrase = m.wallet?.phrase ?? null;
+  const phraseOn = phrase?.state === 'set';
 
   /** False once unmounted. */
   const alive = useRef(true);
@@ -129,7 +155,7 @@ export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onP
   // does something); a focus lost with the replaced row (or the collapsed card) goes to what took its place.
   const card = useRef<HTMLDivElement>(null);
   const cardHead = useRef<HTMLButtonElement>(null);
-  const rows = useRef<Record<Exclude<Card, null>, HTMLButtonElement | null>>({'auto-lock': null, threshold: null});
+  const rows = useRef<Record<Exclude<Card, null>, HTMLButtonElement | null>>({'auto-lock': null, threshold: null, phrase: null});
   const wasOpen = useRef<Card>(null);
   useLayoutEffect(() => {
     const was = wasOpen.current;
@@ -165,6 +191,24 @@ export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onP
     if (r.error === 'locked') return m.reload();
     setFailed(true);
   };
+  /** settings.phrase (B1e §1.3): set-when-none is written; a change or a removal goes to #10 (null removes). */
+  const savePhrase = async (value: string | null) => {
+    setFailed(false);
+    const r = await m.engine.request({type: 'settings.phrase', phrase: value}, PHRASE_CODES, phraseOutcome);
+    if (!here()) return;
+    if (r.ok) {
+      setTyped('');
+      setOpen(null);
+      return m.reload();
+    }
+    if (r.error === 'reauth-required') {
+      const id = (r.data as {challengeId?: unknown} | undefined)?.challengeId;
+      const page = typeof id === 'string' ? reauthPage(id) : null;
+      if (page !== null) return openPage(page);
+    }
+    if (r.error === 'locked') return m.reload();
+    setFailed(true);
+  };
 
   if (settings === null) {
     return (
@@ -238,6 +282,37 @@ export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onP
       <p className="noc-caption app-dim">{note}</p>
     </div>
   );
+  /** B1e §1.3: the anti-phishing card (35c's inline card): the input, B1b's helper and the help line; set, change, remove. */
+  const phraseCard = () => {
+    const clean = cleanPhrase(typed);
+    return (
+      <div className="app-picker-card app-phrase-card" ref={card}>
+        <button type="button" className="app-picker-head" aria-expanded="true" ref={cardHead} onClick={() => toggle('phrase')}>
+          <span className="s7-glyph">
+            <ExtIcon name="shield-lock" size={20} />
+          </span>
+          <span>
+            <span className="noc-body">{SECURITY_TEXT.phrase}</span>
+            <span className="noc-caption app-dim">{SECURITY_TEXT.phraseCaption}</span>
+          </span>
+        </button>
+        <input className="app-input app-phrase-input" aria-label={phraseOn ? SECURITY_TEXT.phraseNew : SECURITY_TEXT.phrase} autoComplete="off" spellCheck={false} maxLength={64} value={typed} onChange={e => setTyped(e.target.value)} />
+        <p className="noc-caption app-dim">{SECURITY_TEXT.phraseHelper}</p>
+        <div className="app-phrase-actions">
+          <LockedButton className="btn btn-primary app-btn-sm" disabled={typeof clean !== 'string'} onPress={() => (typeof clean === 'string' ? savePhrase(clean) : undefined)}>
+            {phraseOn ? SECURITY_TEXT.phraseChange : SECURITY_TEXT.phraseSet}
+          </LockedButton>
+          {phraseOn ? (
+            <LockedButton className="btn btn-secondary app-btn-sm" onPress={() => savePhrase(null)}>
+              {SECURITY_TEXT.phraseRemove}
+            </LockedButton>
+          ) : null}
+        </div>
+        <p className="noc-caption app-dim">{SECURITY_TEXT.phraseHelp}</p>
+        {phraseOn ? <p className="noc-caption app-dim">{SECURITY_TEXT.phraseNote}</p> : null}
+      </div>
+    );
+  };
   const taskRow = (t: SecurityTask) =>
     t === 'passkey' ? (
       <LockedButtonTask key={t} icon="fingerprint" label={SECURITY_TEXT.taskPasskey} onPress={onPasskey} />
@@ -303,6 +378,8 @@ export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onP
               )
             : row('alert', SECURITY_TEXT.threshold, dollars(settings.reauthUsdCents), null, () => toggle('threshold'), false, b => void (rows.current.threshold = b))}
           {passkeyRow(passkey ? SECURITY_TEXT.on : SECURITY_TEXT.off, passkey ? 'success' : 'warning')}
+          {/* B1e §1.3: On / Off as stored; no meta while wallet.state has not said (or could not be read). */}
+          {open === 'phrase' ? phraseCard() : row('shield-lock', SECURITY_TEXT.phrase, phrase === null || phrase.state === 'failed' ? null : phraseOn ? SECURITY_TEXT.on : SECURITY_TEXT.off, phraseOn ? 'success' : null, () => toggle('phrase'), false, b => void (rows.current.phrase = b))}
           {pageRow('key', SECURITY_TEXT.changePassword, 'unlock.html?mode=password')}
         </div>
         {failed ? (
@@ -329,7 +406,7 @@ export function Security({onBack, onPasskey, onDelete}: {onBack: () => void; onP
 }
 
 /** Which inline picker card is open (35c): at most one. */
-type Card = 'auto-lock' | 'threshold' | null;
+type Card = 'auto-lock' | 'threshold' | 'phrase' | null;
 
 /** An outstanding task that opens a vault page: a LockedButton (rule 6) in `.s7-task`'s chrome. */
 function LockedButtonTask({icon, label, onPress}: {icon: ExtIconName; label: string; onPress: () => void}) {
```

The approval window — `dapp.pending`'s field, `WindowTop`'s required `phrase`, every screen passing it:

```diff
diff --git a/extension/src/approve/Approve.tsx b/extension/src/approve/Approve.tsx
index 4f3c3cf..9f8fbd2 100644
--- a/extension/src/approve/Approve.tsx
+++ b/extension/src/approve/Approve.tsx
@@ -16,7 +16,8 @@ export const POLL_MS = 1_000;
  * leave the window blank forever, so polling does not wait for a first successful read either) — so an unlock, an
  * expiry or a new head reaches it within a second. `none` closes the window. A decision runs through `dapp.decide`;
  * the background validates it as if this page were untrusted (C13), and the window then asks again. Only the newest
- * answer counts (a slower, older one sets nothing), and nothing is set after the window unmounts.
+ * answer counts (a slower, older one sets nothing), and nothing is set after the window unmounts. B1e §1.2: every screen
+ * is given the newest answer's anti-phishing phrase, which it shows under its header in every state.
  */
 export function Approve({client, close}: {client: ApproveClient; close: () => void}) {
   const [view, setView] = useState<PendingView | null>(null);
@@ -98,12 +99,12 @@ export function Approve({client, close}: {client: ApproveClient; close: () => vo
   );
 
   if (view === null || view.state === 'none' || request === null) return <div className="screen app-approve" aria-busy="true" />;
-  if (view.state === 'locked') return <Locked request={request} waiting={view.waiting} notice={noticeSeen} onReject={() => decide({decision: 'reject'})} />;
+  if (view.state === 'locked') return <Locked request={request} waiting={view.waiting} notice={noticeSeen} onReject={() => decide({decision: 'reject'})} phrase={view.phrase} />;
   const inProgress = busy || view.state === 'deciding';
   // A new head is a new screen: its gates, scope, account and confirm start over (keyed by request).
-  if (request.type === 'signMessage') return <Sign key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
+  if (request.type === 'signMessage') return <Sign key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} phrase={view.phrase} />;
   // B1c-2: #48 for a transaction request; its origin-mismatch notice.
-  if (request.type === 'signTransaction' || request.type === 'signAndSendTransaction') return <Tx key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
-  if (request.type === 'mismatch') return <Mismatch key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
-  return <Connect key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} />;
+  if (request.type === 'signTransaction' || request.type === 'signAndSendTransaction') return <Tx key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} phrase={view.phrase} />;
+  if (request.type === 'mismatch') return <Mismatch key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} phrase={view.phrase} />;
+  return <Connect key={request.requestId} request={request} waiting={view.waiting} notice={noticeSeen} busy={inProgress} onDecide={decide} phrase={view.phrase} />;
 }
diff --git a/extension/src/approve/Connect.tsx b/extension/src/approve/Connect.tsx
index 003eae6..c541bfb 100644
--- a/extension/src/approve/Connect.tsx
+++ b/extension/src/approve/Connect.tsx
@@ -6,6 +6,7 @@ import type {Decision, RequestView} from './client';
 import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop} from './ui';
 import {useArmed} from './useArmed';
 import {CONNECT_TEXT, WINDOW_TEXT} from './strings';
+import type {PhraseRead} from '../shared/phraseRead';
 
 /**
  * #47 dapp-connect (spec §3.1; index.html ix:17686-18261), every state the spec builds:
@@ -26,12 +27,14 @@ export function Connect({
   notice,
   busy,
   onDecide,
+  phrase,
 }: {
   request: RequestView;
   waiting: number;
   notice: boolean;
   busy: boolean;
   onDecide: (d: Decision) => Promise<unknown>;
+  phrase: PhraseRead;
 }) {
   const detail = request.connect;
   const kind = request.site.kind;
@@ -148,7 +151,7 @@ export function Connect({
 
   return (
     <div className="screen app-approve">
-      <WindowTop overline={overline} tone={kind === 'verified' ? 'neutral' : kind === 'unknown' ? 'warning' : 'danger'} onClose={reject} disabled={disabled} />
+      <WindowTop overline={overline} tone={kind === 'verified' ? 'neutral' : kind === 'unknown' ? 'warning' : 'danger'} onClose={reject} disabled={disabled} phrase={phrase} />
       <div className="scroll-area app-approve-scroll">
         {notice ? <BudgetNotice /> : null}
         <h1 className="noc-h1 app-approve-title">{title}</h1>
diff --git a/extension/src/approve/Locked.tsx b/extension/src/approve/Locked.tsx
index ff7ca53..0119287 100644
--- a/extension/src/approve/Locked.tsx
+++ b/extension/src/approve/Locked.tsx
@@ -1,8 +1,10 @@
 import {ExtIcon} from '../app/ui/ExtIcon';
 import {LockedButton} from '../app/ui/LockedButton';
+import {PhraseLine} from '../app/ui/PhraseLine';
 import type {RequestView} from './client';
 import {BudgetNotice, OriginCard, Waiting} from './ui';
 import {WINDOW_TEXT} from './strings';
+import type {PhraseRead} from '../shared/phraseRead';
 
 /**
  * The locked window (spec §4.3, D11): the Noctura mark, Q22, Q23, the request's origin card, and [Reject]. No password
@@ -11,12 +13,13 @@ import {WINDOW_TEXT} from './strings';
  * Q24 is latched by `Approve`, so it shows here too, not only once the window has unlocked — in normal flow above the
  * centred group (fix round 1, M-b), not swept into it: it used to inherit the group's `text-align: center` and land
  * wherever the (short) centred content happened to put it, instead of sitting at the scroll area's own top inset like
- * every other banner in this window.
+ * every other banner in this window. B1e §1.2: the anti-phishing phrase above it all — this window has no top bar.
  */
-export function Locked({request, waiting, notice, onReject}: {request: RequestView; waiting: number; notice: boolean; onReject: () => Promise<unknown>}) {
+export function Locked({request, waiting, notice, onReject, phrase}: {request: RequestView; waiting: number; notice: boolean; onReject: () => Promise<unknown>; phrase: PhraseRead}) {
   return (
     <div className="screen app-approve app-approve-locked">
       <div className="scroll-area app-approve-scroll">
+        <PhraseLine phrase={phrase} />
         {notice ? <BudgetNotice /> : null}
         <div className="app-approve-locked-center">
           <div className="app-lock-tile" aria-hidden="true">
diff --git a/extension/src/approve/Mismatch.tsx b/extension/src/approve/Mismatch.tsx
index 3d5b398..6b1f1fd 100644
--- a/extension/src/approve/Mismatch.tsx
+++ b/extension/src/approve/Mismatch.tsx
@@ -3,6 +3,7 @@ import {LockedButton} from '../app/ui/LockedButton';
 import type {Decision, RequestView} from './client';
 import {BudgetNotice, Waiting, WindowTop, siteLabel} from './ui';
 import {MISMATCH_TEXT} from './strings';
+import type {PhraseRead} from '../shared/phraseRead';
 
 /**
  * #48 "origin-mismatch · auto-reject" (index.html ix:18484-18521; B1 §3: "request origin differs from the granted origin
@@ -12,7 +13,7 @@ import {MISMATCH_TEXT} from './strings';
  * approval window never opens the wallet's pages — D11's rule, as the locked screen), and the caption names Settings →
  * Connected dApps (Q03, D1).
  */
-export function Mismatch({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
+export function Mismatch({request, waiting, notice, busy, onDecide, phrase}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>; phrase: PhraseRead}) {
   // Fix round 1 (promoted minor 4): the same host-display source as the popup's strip and #10 (siteLabel) — never a
   // second, slightly different implementation of the same idea.
   const granted = request.mismatch === null ? '—' : siteLabel(request.mismatch.granted, request.mismatch.granted);
@@ -22,7 +23,7 @@ export function Mismatch({request, waiting, notice, busy, onDecide}: {request: R
   const caption = MISMATCH_TEXT.caption(granted);
   return (
     <div className="screen app-approve">
-      <WindowTop overline={MISMATCH_TEXT.overline} tone="danger" onClose={dismiss} disabled={busy} />
+      <WindowTop overline={MISMATCH_TEXT.overline} tone="danger" onClose={dismiss} disabled={busy} phrase={phrase} />
       <div className="scroll-area app-approve-scroll">
         {notice ? <BudgetNotice /> : null}
         <div className="s9-fail-hero">
diff --git a/extension/src/approve/Sign.tsx b/extension/src/approve/Sign.tsx
index 573f1b7..7748970 100644
--- a/extension/src/approve/Sign.tsx
+++ b/extension/src/approve/Sign.tsx
@@ -4,6 +4,7 @@ import {LockedButton} from '../app/ui/LockedButton';
 import type {Decision, RequestView} from './client';
 import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop} from './ui';
 import {useArmed} from './useArmed';
+import type {PhraseRead} from '../shared/phraseRead';
 import {SIGN_TEXT, WINDOW_TEXT} from './strings';
 
 /** The message as text, with the background's ranges <mark>ed (rule 6's keyword; a lookalike's homoglyphs). */
@@ -40,7 +41,7 @@ function preview(text: string, marks: readonly {start: number; end: number}[]):
  * ruling, this task): a stale poll that clears busy without the user re-arming anything must not leave a confirming
  * CTA already armed from before the busy window — it is a state change like any other and re-starts the hold.
  */
-export function Sign({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
+export function Sign({request, waiting, notice, busy, onDecide, phrase}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>; phrase: PhraseRead}) {
   const detail = request.sign;
   const lookalike = request.site.kind === 'lookalike';
   const [confirming, setConfirming] = useState(false);
@@ -55,7 +56,7 @@ export function Sign({request, waiting, notice, busy, onDecide}: {request: Reque
   if (detail === null) {
     return (
       <div className="screen app-approve">
-        <WindowTop overline={SIGN_TEXT.overline} tone="neutral" onClose={reject} disabled={busy} />
+        <WindowTop overline={SIGN_TEXT.overline} tone="neutral" onClose={reject} disabled={busy} phrase={phrase} />
         <div className="scroll-area app-approve-scroll">
           {notice ? <BudgetNotice /> : null}
           <h1 className="noc-h1 app-approve-title">{SIGN_TEXT.title}</h1>
@@ -80,7 +81,7 @@ export function Sign({request, waiting, notice, busy, onDecide}: {request: Reque
   const label = lookalike ? SIGN_TEXT.labelLookalike : detail.keyword !== null ? SIGN_TEXT.labelKeyword : SIGN_TEXT.label(detail.chars);
   return (
     <div className="screen app-approve">
-      <WindowTop overline={busy ? SIGN_TEXT.overlineSigning : lookalike ? SIGN_TEXT.overlineLookalike : SIGN_TEXT.overline} tone={busy ? 'neutral' : lookalike ? 'danger' : 'neutral'} onClose={reject} disabled={busy} />
+      <WindowTop overline={busy ? SIGN_TEXT.overlineSigning : lookalike ? SIGN_TEXT.overlineLookalike : SIGN_TEXT.overline} tone={busy ? 'neutral' : lookalike ? 'danger' : 'neutral'} onClose={reject} disabled={busy} phrase={phrase} />
       <div className="scroll-area app-approve-scroll">
         {notice ? <BudgetNotice /> : null}
         <h1 className="noc-h1 app-approve-title">{SIGN_TEXT.title}</h1>
diff --git a/extension/src/approve/Tx.tsx b/extension/src/approve/Tx.tsx
index 2ee456d..665d3db 100644
--- a/extension/src/approve/Tx.tsx
+++ b/extension/src/approve/Tx.tsx
@@ -7,6 +7,7 @@ import {SkelCircle, SkelLine} from '../app/ui/Skeleton';
 import {feeUsd, shortAddress, showSol} from '../app/format';
 import {fromBook} from '../app/addressBook';
 import {formatAmount} from '../shared/amount';
+import type {PhraseRead} from '../shared/phraseRead';
 import {dependsOnStep, type AddressLabel, type Approval, type BalanceChange, type Decision, type DecodedInstruction, type FieldValue, type Flag, type ProgramKey, type RequestView, type TxDetail, type TxItem} from './client';
 import {BlockSite, BudgetNotice, ConfirmButton, LookalikeBanner, OriginCard, RiskConfirm, Spinner, Waiting, WindowTop, siteLabel} from './ui';
 import {ARM_MS, FLAG_HOLD_MS, useArmed} from './useArmed';
@@ -525,7 +526,7 @@ function stateOf(d: TxDetail | null): TxState | null {
  * simulation, the re-authentication's state, busy, every typed field's match; on a screen with any flag, 1.5 s (B1 §3).
  * Reject is never held.
  */
-export function Tx({request, waiting, notice, busy, onDecide}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>}) {
+export function Tx({request, waiting, notice, busy, onDecide, phrase}: {request: RequestView; waiting: number; notice: boolean; busy: boolean; onDecide: (d: Decision) => Promise<unknown>; phrase: PhraseRead}) {
   const detail = request.tx;
   const lookalike = request.site.kind === 'lookalike';
   const [confirming, setConfirming] = useState(false);
@@ -576,7 +577,7 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
   if (detail === null) {
     return (
       <div className="screen app-approve">
-        <WindowTop overline={TX_TEXT.overline} tone="neutral" onClose={reject} disabled={busy} />
+        <WindowTop overline={TX_TEXT.overline} tone="neutral" onClose={reject} disabled={busy} phrase={phrase} />
         <div className="scroll-area app-approve-scroll">
           {notice ? <BudgetNotice /> : null}
           <div className="app-origin-slot">
@@ -622,7 +623,7 @@ export function Tx({request, waiting, notice, busy, onDecide}: {request: Request
   const overline = busy ? TX_TEXT.overlineApproving : regionBlocked ? FLAG_TEXT.overlineBlocked : unlimitedOnly ? FLAG_TEXT.overlineUnlimited : approvalsOnly ? FLAG_TEXT.overlineLarge : blocks.length > 0 ? FLAG_TEXT.overlineBlocked : lookalike ? TX_TEXT.overlineLookalike : TX_TEXT.overline;
   return (
     <div className="screen app-approve">
-      <WindowTop overline={overline} tone={!busy && (lookalike || blocks.length > 0 || regionBlocked) ? 'danger' : 'neutral'} onClose={reject} disabled={busy || simulating} />
+      <WindowTop overline={overline} tone={!busy && (lookalike || blocks.length > 0 || regionBlocked) ? 'danger' : 'neutral'} onClose={reject} disabled={busy || simulating} phrase={phrase} />
       <div className={busy ? 'scroll-area app-approve-scroll app-tx-busy' : 'scroll-area app-approve-scroll'}>
         {notice ? <BudgetNotice /> : null}
         <div className="app-origin-slot">
diff --git a/extension/src/approve/client.ts b/extension/src/approve/client.ts
index 50469c7..970224c 100644
--- a/extension/src/approve/client.ts
+++ b/extension/src/approve/client.ts
@@ -1,4 +1,5 @@
 import {send as runtimeSend} from '../ui/send';
+import {phraseRead, type PhraseRead} from '../shared/phraseRead';
 
 /**
  * The approval window's one way to the background (spec §1.4, §2.3, §4.3): `dapp.pending` and `dapp.decide`, nothing
@@ -175,7 +176,8 @@ export interface RequestView {
   tx: TxDetail | null;
   mismatch: {granted: string} | null;
 }
-export type PendingView = {state: 'none'} | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean};
+/** B1e §1.2, §1.4: `phrase` — the anti-phishing phrase, read from the answer's top-level field (`failed` when it cannot be). */
+export type PendingView = {state: 'none'} | {state: 'locked' | 'deciding' | 'request'; request: RequestView; waiting: number; windowNotice: boolean; phrase: PhraseRead};
 /** B1c-3: an approval's `overrides` — the typed word of each blocked (transaction, kind), `tx` the 0-based index in the batch. */
 export type Decision =
   | {decision: 'reject' | 'report' | 'block'}
@@ -492,7 +494,8 @@ export function pendingOf(x: unknown): PendingView | null {
   if (o.state !== 'locked' && o.state !== 'deciding' && o.state !== 'request') return null;
   const request = requestOf(o.request);
   if (request === undefined || !isInt(o.waiting) || !isBool(o.windowNotice)) return null;
-  return {state: o.state, request, waiting: o.waiting, windowNotice: o.windowNotice};
+  // B1e §1.2 (R9): a phrase field this window cannot read is `failed` — the request still shows, with R9's line.
+  return {state: o.state, request, waiting: o.waiting, windowNotice: o.windowNotice, phrase: phraseRead(o.phrase)};
 }
 
 export type Transport = (m: unknown) => Promise<unknown>;
diff --git a/extension/src/approve/ui.tsx b/extension/src/approve/ui.tsx
index 9e813d3..22abbba 100644
--- a/extension/src/approve/ui.tsx
+++ b/extension/src/approve/ui.tsx
@@ -1,7 +1,9 @@
 import {useEffect, useState, type ReactNode} from 'react';
 import {ExtIcon} from '../app/ui/ExtIcon';
 import {LockedButton} from '../app/ui/LockedButton';
+import {PhraseLine} from '../app/ui/PhraseLine';
 import {Sheet} from '../app/ui/Sheet';
+import type {PhraseRead} from '../shared/phraseRead';
 import type {Site} from './client';
 import {WINDOW_TEXT} from './strings';
 import {ARM_MS, useArmed} from './useArmed';
@@ -13,15 +15,19 @@ import {ARM_MS, useArmed} from './useArmed';
  */
 
 /** The top bar: ✕ is Reject (C4); its overline names the state, coloured by tier (`--fg-tertiary` → `--warning` → `--danger`). */
-export function WindowTop({overline, tone, onClose, disabled}: {overline: string; tone: 'neutral' | 'warning' | 'danger'; onClose: () => void; disabled: boolean}) {
+export function WindowTop({overline, tone, onClose, disabled, phrase}: {overline: string; tone: 'neutral' | 'warning' | 'danger'; onClose: () => void; disabled: boolean; phrase: PhraseRead}) {
   return (
-    <div className="top-bar">
-      <LockedButton className="icon-btn" label={WINDOW_TEXT.close} onPress={onClose} disabled={disabled}>
-        <ExtIcon name="close" size={22} />
-      </LockedButton>
-      <span className={tone === 'danger' ? 'title noc-overline noc-danger' : tone === 'warning' ? 'title noc-overline noc-warning' : 'title noc-overline app-dim'}>{overline}</span>
-      <span />
-    </div>
+    <>
+      <div className="top-bar">
+        <LockedButton className="icon-btn" label={WINDOW_TEXT.close} onPress={onClose} disabled={disabled}>
+          <ExtIcon name="close" size={22} />
+        </LockedButton>
+        <span className={tone === 'danger' ? 'title noc-overline noc-danger' : tone === 'warning' ? 'title noc-overline noc-warning' : 'title noc-overline app-dim'}>{overline}</span>
+        <span />
+      </div>
+      {/* B1e §1.2: the anti-phishing phrase under the header, on every state of every request screen. */}
+      <PhraseLine phrase={phrase} />
+    </>
   );
 }
 
```

The vault page — the lines on #9 and #10, the step's section and screen id, #9's read in `reading`, #10's description and end states, `runReauth`, the strings, `modes.ts` passing the step to both runs:

```diff
diff --git a/extension/src/unlock/challenge.ts b/extension/src/unlock/challenge.ts
index f5a9c9f..fe76855 100644
--- a/extension/src/unlock/challenge.ts
+++ b/extension/src/unlock/challenge.ts
@@ -35,6 +35,8 @@ export const F5_WORDS: readonly string[] = ['NOC', 'USDC', 'USDT', 'UNLIMITED',
 const MAX_FLAGS = 50;
 const OUTGOING_KEYS = ['amount', 'decimals', 'mint', 'symbol'];
 const SETTINGS_KEYS = ['autoLockMinutes', 'kind', 'reauthUsdCents'];
+/** B1e §1.3: the background's redacted description of a phrase challenge (its value never leaves the background). */
+const PHRASE_KEYS = ['action', 'kind'];
 const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
 
 export interface FeeLine {
@@ -88,7 +90,12 @@ export interface OtherDescription {
   reasons: string[];
   cancelled: string;
 }
-export type Description = SendDescription | SettingsDescription | DappDescription | OtherDescription;
+/** B1e §1.3: a change or a removal of the anti-phishing phrase — what it is, never the new value. */
+export interface PhraseDescription {
+  kind: 'phrase';
+  action: 'change' | 'remove';
+}
+export type Description = SendDescription | SettingsDescription | DappDescription | OtherDescription | PhraseDescription;
 
 const sol = (lamports: string): string => `${formatAmount(BigInt(lamports), 9, {min: 0, max: 9})} SOL`;
 const dollars = (cents: number): string => formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2});
@@ -160,6 +167,11 @@ function describeSettings(a: Record<string, unknown>): SettingsDescription | nul
   return lines.length === 0 ? null : {kind: 'settings', lines};
 }
 
+function describePhrase(a: Record<string, unknown>): PhraseDescription | null {
+  if (!hasExactly(a, PHRASE_KEYS)) return null;
+  return a.action === 'change' || a.action === 'remove' ? {kind: 'phrase', action: a.action} : null;
+}
+
 /** One reason's line (#10's own table; `approval` is B1c-2's, `override` B1c-3's). */
 function reasonLine(r: unknown, thresholdCents: number): string | null {
   if (r === 'over-usd-threshold') return REAUTH.overUsd(dollars(thresholdCents));
@@ -240,6 +252,7 @@ export function describeChallenge(about: unknown): Description | null {
   if (a.kind === 'send') return describeSend(a);
   if (a.kind === 'settings') return describeSettings(a);
   if (a.kind === 'dapp') return describeDapp(a);
+  if (a.kind === 'phrase') return describePhrase(a);
   return describePresale(a);
 }
 
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index e71a730..cf156d3 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -1,6 +1,7 @@
 import type {PageMode} from './mode';
 import type {PageDeps} from './page';
 import {mountAccounts} from './screens/accounts';
+import {mountAntiPhishing} from './screens/antiPhishing';
 import {mountChangePassword} from './screens/changePassword';
 import {mountDamaged} from './screens/damaged';
 import {mountDelete} from './screens/delete';
@@ -39,8 +40,10 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
         return;
       }
       const password = mountPassword(deps);
-      const create = createCreateRun(deps, {password, importRun: () => imports.show()});
-      const imports = createImportRun(deps, {password, back: () => create.start('welcome'), storing: create.storing});
+      // B1e §1.3: the anti-phishing step, which both runs call only once the wallet is stored and its keys handed over.
+      const phraseStep = mountAntiPhishing(deps);
+      const create = createCreateRun(deps, {password, importRun: () => imports.show(), phraseStep});
+      const imports = createImportRun(deps, {password, back: () => create.start('welcome'), storing: create.storing, phraseStep});
       if (mode.mode === 'import') imports.show();
       else create.start(mode.mode === 'welcome' ? 'welcome' : 'intro');
       return;
diff --git a/extension/src/unlock/reauthFlow.ts b/extension/src/unlock/reauthFlow.ts
index 334d7dd..2261c19 100644
--- a/extension/src/unlock/reauthFlow.ts
+++ b/extension/src/unlock/reauthFlow.ts
@@ -3,9 +3,9 @@ import {storedVault} from './stored';
 import type {Send} from './types';
 
 /**
- * `applied` (B1b-2b E9): the background applied a settings challenge's patch on this proof. `refused`: the proof
- * held but vault.reauthOk was refused for another reason (`malformed`, `failed`) — for a settings challenge,
- * nothing was changed.
+ * `applied` (B1b-2b E9): the background applied a settings challenge's patch on this proof — or (B1e §1.3) a phrase
+ * challenge's value. `refused`: the proof held but vault.reauthOk was refused for another reason (`malformed`,
+ * `failed`) — for a settings or phrase challenge, nothing was changed.
  */
 export type ReauthPageOutcome = 'confirmed' | 'applied' | 'refused' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'expired' | 'damaged' | 'no-wallet' | 'failed';
 
@@ -53,8 +53,11 @@ export async function runReauth(
     if (outcome === 'mismatch') return await lockOnMismatch(deps.send);
     if (outcome !== 'ok') return outcome;
     const r = await deps.send({type: 'vault.reauthOk', challengeId});
-    // A send description answers {ok: true} with no data (D38: #20 sends); a settings one says it was applied.
-    if (r.ok) return typeof r.data === 'object' && r.data !== null && (r.data as {applied?: unknown}).applied === 'settings' ? 'applied' : 'confirmed';
+    // A send description answers {ok: true} with no data (D38: #20 sends); a settings or phrase one says it was applied.
+    if (r.ok) {
+      const applied = typeof r.data === 'object' && r.data !== null ? (r.data as {applied?: unknown}).applied : undefined;
+      return applied === 'settings' || applied === 'phrase' ? 'applied' : 'confirmed';
+    }
     // D39: the challenge expired (or was discarded) while the password was typed — #10's `expired`,
     // never `failed`. A lock that landed after the status read is `not-unlocked`.
     if (r.error === 'unknown-challenge') return 'expired';
diff --git a/extension/src/unlock/screens/reauth.ts b/extension/src/unlock/screens/reauth.ts
index 2d3b5ef..c77515c 100644
--- a/extension/src/unlock/screens/reauth.ts
+++ b/extension/src/unlock/screens/reauth.ts
@@ -9,6 +9,7 @@ import {passkeyOf, storedVault} from '../stored';
 import {COMMON, REAUTH, cooldownLabel} from '../strings';
 import {byId, h, setText, showScreen, shown} from '../view/dom';
 import {startCooldown} from '../view/cooldown';
+import {readPhraseLine, showPhraseLine} from '../view/phraseLine';
 import {addressGroups} from '../view/words';
 
 /** What leaves the account, on #10's rows (U+2212, as #48's deltas). */
@@ -48,6 +49,11 @@ type View = 'loading' | 'entry' | 'notice' | 'done';
  *
  * Rule 6 (spec §7.6): every button runs through the page's one `exclusive()` gate, with its phase checked
  * before and inside it.
+ *
+ * B1e §1.2, §1.3: the CURRENT anti-phishing phrase under the top bar, read once a wallet is found and before the
+ * description (so before any field shows); a damaged or missing wallet shows only its notice. A `phrase` challenge
+ * is described as "Change …" or "Remove the anti-phishing phrase" — the background never sends its new value — and ends
+ * like a settings one (applied by the background, or nothing changed).
  */
 export function mountReauth(deps: PageDeps): ReauthScreen {
   const field = byId<HTMLInputElement>('ra-password');
@@ -109,7 +115,7 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
     cancel.disabled = (busy && !cooling) || !canCancel;
     unlock.disabled = busy || !offerUnlock;
     x.disabled = (busy && !(cooling && canCancel)) || !(canCancel || view === 'notice');
-    x.setAttribute('aria-label', canCancel && !closeOnly && described?.kind !== 'settings' && described?.kind !== 'dapp' ? REAUTH.cancel : REAUTH.close);
+    x.setAttribute('aria-label', canCancel && !closeOnly && described?.kind !== 'settings' && described?.kind !== 'phrase' && described?.kind !== 'dapp' ? REAUTH.cancel : REAUTH.close);
   };
   const helper = (text: string, error: boolean) => {
     setText(byId('ra-helper'), text);
@@ -213,6 +219,12 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
       );
       byId('ra-reasons').replaceChildren(...d.reasons.map(r => h('p', 'noc-body-sm vlt-lede', r)));
       setText(cancel, REAUTH.cancel);
+    } else if (d.kind === 'phrase') {
+      setText(byId('ra-about'), REAUTH.aboutChange);
+      shown(byId('ra-amount-row'), false);
+      byId('ra-rows').replaceChildren(row(d.action === 'change' ? REAUTH.phraseChange : REAUTH.phraseRemove, null));
+      byId('ra-reasons').replaceChildren();
+      setText(cancel, REAUTH.cancel);
     } else {
       setText(byId('ra-about'), REAUTH.aboutChange);
       shown(byId('ra-amount-row'), false);
@@ -244,7 +256,8 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
       if (out === 'not-unlocked') return notice(REAUTH.dappNotUnlocked, {unlock: true});
       if (out === 'refused' || out === 'applied') return helper(COMMON.failedTryAgain, false);
     }
-    if (described?.kind === 'settings') {
+    // B1e §1.3: a phrase change or removal ends as a setting does.
+    if (described?.kind === 'settings' || described?.kind === 'phrase') {
       if (out === 'applied') return notice(REAUTH.settingsApplied);
       if (out === 'expired') return notice(REAUTH.settingsExpired, {help: REAUTH.settingsExpiredHelp});
       if (out === 'not-unlocked') return notice(REAUTH.settingsNotUnlocked, {unlock: true});
@@ -328,7 +341,7 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
     void exclusive(deps, render, async () => {
       if (!canCancel) return;
       // A setting, or a site's transaction (B1c-2: its request stays in the approval window, which can still reject it).
-      if (described?.kind === 'settings' || described?.kind === 'dapp' || closeOnly) return deps.closeTab();
+      if (described?.kind === 'settings' || described?.kind === 'phrase' || described?.kind === 'dapp' || closeOnly) return deps.closeTab();
       // E7: nothing of this send may outlive the cancel — its prepared send and its challenge go. The account is
       // the one challenge.ts validated (the description's, or the undescribable record's own).
       const account = described?.kind === 'send' || described?.kind === 'other' ? described.account : orphan;
@@ -411,6 +424,8 @@ export function mountReauth(deps: PageDeps): ReauthScreen {
       if (stored.kind === 'none') return notice(COMMON.noWallet);
       if (stored.kind === 'damaged') return notice(COMMON.damaged, {help: COMMON.damagedHelp});
       pk = passkeyOf(raw) ?? null;
+      // B1e §1.2: the line before anything can be typed — read first, while #10 says it is reading the details.
+      showPhraseLine('ra', await readPhraseLine(deps.send));
       const read = await readChallenge(deps.send, id);
       if (read.state === 'undescribable') {
         // Fail closed: what cannot be described is never offered for confirmation — only Cancel, which
diff --git a/extension/src/unlock/screens/unlock.ts b/extension/src/unlock/screens/unlock.ts
index de59564..2ec22d6 100644
--- a/extension/src/unlock/screens/unlock.ts
+++ b/extension/src/unlock/screens/unlock.ts
@@ -9,6 +9,7 @@ import {COMMON, UNLOCK, cooldownLabel} from '../strings';
 import {unlockFlow} from '../unlockFlow';
 import {byId, closeOrHide, setText, showScreen, shown} from '../view/dom';
 import {startCooldown} from '../view/cooldown';
+import {readPhraseLine, showPhraseLine} from '../view/phraseLine';
 import {mountDamaged} from './damaged';
 
 export interface UnlockScreen {
@@ -33,7 +34,8 @@ type Phase = 'off' | 'reading' | 'entry' | 'unlocked' | 'no-wallet' | 'damaged'
  * a damaged vault → B1e §2.2's state (screens/damaged.ts: unreadable, or refused by this version), never the password
  * field (and never charged to the backoff). An attempt that ends `damaged` reads again: a value that now reads as one of
  * the two states shows it; a wallet whose seed then failed to open (B1e §2.1, out of the predicate) keeps the damaged
- * notice and its help.
+ * notice and its help. B1e §1.2: the anti-phishing phrase is read in the `reading` phase, before the field shows — the
+ * field never appears without the line's state (the phrase, R9's line, or nothing when none is set).
  *
  * The password: taken out of the field at the click and handed to the attempt in the same turn, so the
  * screen holds no copy while Argon2id runs or the cooldown counts down; a hidden tab or `pagehide` empties
@@ -269,6 +271,7 @@ export function mountUnlock(deps: PageDeps): UnlockScreen {
       }
       if (vaultReading(raw).kind === 'none') return notice('no-wallet', COMMON.noWallet, '');
       if (showDamaged(raw)) return;
+      showPhraseLine('unl', await readPhraseLine(deps.send));
       pk = passkeyOf(raw) ?? null;
       phase = 'entry';
       render();
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 3db4e7f..170d076 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -475,4 +475,7 @@ export const REAUTH = {
   dappNotUnlocked: "The wallet locked while you were confirming. The site's request was declined — ask the site to try again.",
   autoLock: (minutes: number): string => `Auto-lock → ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
   threshold: (dollars: string): string => `Re-authentication threshold → $${dollars}`,
+  /** B1e §1.3: what a phrase challenge is for — never the new value. */
+  phraseChange: 'Change the anti-phishing phrase',
+  phraseRemove: 'Remove the anti-phishing phrase',
 } as const;
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 7717c33..043e51f 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -578,3 +578,14 @@
   accent-color: var(--accent);
   cursor: pointer;
 }
+
+/* B1e §1.2 (undrawn, §9): the anti-phishing phrase line — B1b's `.banner` (shield, or warning for R9's line), its text
+   from the start of the line even inside #9's centred pin-head; the user's own phrase wraps, never cut. */
+.vlt-phrase-line {
+  align-self: stretch;
+  text-align: start;
+}
+.vlt-phrase-line > .noc-body-sm {
+  min-width: 0;
+  overflow-wrap: anywhere;
+}
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index 38b7c62..0dd2780 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -36,6 +36,7 @@ export const SCREENS = [
   'v-confirm',
   'v-password',
   'v-passkey',
+  'v-anti-phishing',
   'v-import',
   'v-retry',
   'v-unlock',
diff --git a/extension/unlock.html b/extension/unlock.html
index 3867b5b..86f6aca 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -245,6 +245,30 @@
         </div>
       </section>
 
+      <!-- B1e §1.3 (undrawn, §9): onboarding's anti-phishing step, skippable — on create after #6, on import once the
+           wallet is stored; never on created-locked. The design's #6 scope (.s-bio) and B1b's input. -->
+      <section id="v-anti-phishing" class="screen s-bio" hidden>
+        <div class="top-bar">
+          <span class="title noc-overline vlt-muted">Optional</span>
+        </div>
+        <div class="hero-icon"><svg width="56" height="56" aria-hidden="true"><use href="#i-shield-lock" /></svg></div>
+        <div class="vlt-pad-6 vlt-center">
+          <h1 class="noc-h1 vlt-gap-2">Set an anti-phishing phrase</h1>
+          <p class="noc-body vlt-lede vlt-narrow-300">Noctura shows it on its unlock and approval windows. A window without it is not Noctura's.</p>
+        </div>
+        <form id="ap-form" class="vlt-pad vlt-gap-top-5">
+          <input id="ap-field" class="vlt-input" type="text" autocomplete="off" spellcheck="false" maxlength="64" aria-label="Anti-phishing phrase" aria-describedby="ap-helper ap-help" />
+          <p id="ap-helper" class="noc-caption vlt-muted vlt-gap-top-2">3–32 characters: letters, numbers, symbols and simple emoji.</p>
+          <p id="ap-help" class="noc-caption vlt-muted vlt-gap-top-1">Never type it into a website. Anyone who uses this browser profile can see it.</p>
+        </form>
+        <p id="ap-line" class="noc-body-sm vlt-danger vlt-pad vlt-gap-top-3" role="status" hidden></p>
+        <div class="vlt-grow"></div>
+        <div class="sticky-bar">
+          <button id="ap-set" type="button" class="btn btn-primary" disabled>Set phrase</button>
+          <button id="ap-skip" type="button" class="btn btn-secondary">Skip</button>
+        </div>
+      </section>
+
       <!-- #8 import (spec §3.8): the phrase only (D17); the restore (#39) and retry (#40) paths add their states. -->
       <section id="v-import" class="screen s-import" hidden>
         <div class="top-bar">
@@ -301,6 +325,15 @@
             <div id="unl-tile" class="vlt-lock-tile" aria-hidden="true"><svg width="28" height="28"><use href="#i-lock" /></svg></div>
             <h1 class="noc-h1">Welcome back</h1>
             <p class="noc-body vlt-lede">Enter your password to unlock.</p>
+            <!-- B1e §1.2 (undrawn, §9): the anti-phishing phrase, read before the field shows — never markup (textContent). -->
+            <div id="unl-phrase" class="banner shield vlt-phrase-line" hidden>
+              <svg width="16" height="16" aria-hidden="true"><use href="#i-shield-lock" /></svg>
+              <p class="noc-body-sm"><span class="vlt-sr">Anti-phishing phrase: </span><span id="unl-phrase-text" class="copy"></span></p>
+            </div>
+            <div id="unl-phrase-failed" class="banner warning vlt-phrase-line" role="status" hidden>
+              <svg width="16" height="16" aria-hidden="true"><use href="#i-warn" /></svg>
+              <p class="noc-body-sm">Anti-phishing phrase could not be read — don't type your password until it shows</p>
+            </div>
             <form id="unl-form" class="vlt-field-row">
               <input id="unl-password" class="vlt-input" type="password" autocomplete="current-password" aria-label="Password" />
             </form>
@@ -341,6 +374,15 @@
           <span class="title noc-overline vlt-muted">Confirm with password</span>
           <span class="vlt-bar-spacer"></span>
         </div>
+        <!-- B1e §1.2 (undrawn, §9): the CURRENT anti-phishing phrase — a phrase challenge's new value is never shown here. -->
+        <div id="ra-phrase" class="banner shield vlt-phrase-line vlt-banner-gap" hidden>
+          <svg width="16" height="16" aria-hidden="true"><use href="#i-shield-lock" /></svg>
+          <p class="noc-body-sm"><span class="vlt-sr">Anti-phishing phrase: </span><span id="ra-phrase-text" class="copy"></span></p>
+        </div>
+        <div id="ra-phrase-failed" class="banner warning vlt-phrase-line vlt-banner-gap" role="status" hidden>
+          <svg width="16" height="16" aria-hidden="true"><use href="#i-warn" /></svg>
+          <p class="noc-body-sm">Anti-phishing phrase could not be read — don't type your password until it shows</p>
+        </div>
         <p id="ra-loading" class="noc-body vlt-center vlt-pad" role="status">Reading the details…</p>
         <div id="ra-intent" class="intent-card" hidden>
           <div id="ra-about" class="noc-overline vlt-muted vlt-gap-2"></div>
```

The E2E flows the step interrupts (create after #6 and a plain import; a restore and a retry get no step) — `skipPhraseStep`, and visual-vault's shot of the step:

```diff
diff --git a/extension/e2e/onboarding.spec.ts b/extension/e2e/onboarding.spec.ts
index 4d58401..02021cb 100644
--- a/extension/e2e/onboarding.spec.ts
+++ b/extension/e2e/onboarding.spec.ts
@@ -2,7 +2,7 @@ import {test, expect, type Page, type Worker} from '@playwright/test';
 import {contained, launchPopup, type Harness} from './popupHarness';
 import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
 import {BLOCKHASH_LIFETIME} from './fakeCoordinator';
-import {createWallet, importWallet, pastePhrase, recordSent, sentFrom, setPassword, tryUnlock, unlockWith} from './vaultPage';
+import {createWallet, importWallet, pastePhrase, recordSent, sentFrom, setPassword, skipPhraseStep, tryUnlock, unlockWith} from './vaultPage';
 
 // Spec B1b-2a §8.5, plan 2: specs 1–3, 10 and 12, against the real extension (vault page + UI tab +
 // popup) and the contained fake coordinator. Every spec ends with contained(h).
@@ -64,6 +64,7 @@ async function importDetected(h: Harness): Promise<{vault: Page; scheme: string;
   await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
   await expect(vault.locator('#imp-choose')).toBeHidden();
   await setPassword(vault, NEW_PASSWORD);
+  await skipPhraseStep(vault);
   await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
   await expect(vault.getByText('Wallet imported', {exact: true})).toBeVisible({timeout: 30_000});
   // The probe read the balances (getMultipleAccounts), which is what the scheme and the accounts came from.
diff --git a/extension/e2e/vaultPage.ts b/extension/e2e/vaultPage.ts
index 8511d5c..9c40924 100644
--- a/extension/e2e/vaultPage.ts
+++ b/extension/e2e/vaultPage.ts
@@ -7,7 +7,7 @@ import {expect, type Page} from '@playwright/test';
  */
 
 /**
- * The create run (#2 → #3 → #4 → #5 → #6 skip), handed over to #7 (wallet.html#/created). Returns the 24
+ * The create run (#2 → #3 → #4 → #5 → #6 skip → the anti-phishing step skipped), handed over to #7 (wallet.html#/created). Returns the 24
  * words #3 showed. `fromWelcome`: the page is on #1 already (?mode=welcome), so the run starts at its Create.
  */
 export async function createWallet(vault: Page, id: string, password: string, o: {fromWelcome?: boolean} = {}): Promise<string[]> {
@@ -28,6 +28,7 @@ export async function createWallet(vault: Page, id: string, password: string, o:
   await setPassword(vault, password);
   await expect(vault.locator('#v-passkey')).toBeVisible({timeout: 60_000});
   await vault.locator('#pk-skip').click();
+  await skipPhraseStep(vault);
   await vault.waitForURL(/\/wallet\.html#\/created$/);
   return words;
 }
@@ -95,13 +96,20 @@ export async function unlockWith(vault: Page, id: string, password: string): Pro
   await expect(vault.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
 }
 
-/** #8 (a plain import): pastes the phrase, Continue, then #5. The tab ends on #40 (#/imported). */
+/** B1e §1.3: onboarding's anti-phishing step (create after #6, a plain import once stored), skipped. */
+export async function skipPhraseStep(vault: Page): Promise<void> {
+  await expect(vault.locator('#v-anti-phishing')).toBeVisible({timeout: 60_000});
+  await vault.locator('#ap-skip').click();
+}
+
+/** #8 (a plain import): pastes the phrase, Continue, then #5, the anti-phishing step skipped. The tab ends on #40 (#/imported). */
 export async function importWallet(vault: Page, id: string, phrase: string, password: string): Promise<void> {
   await vault.goto(`chrome-extension://${id}/unlock.html?mode=import`);
   await pastePhrase(vault, phrase);
   await vault.locator('#imp-continue').click();
   await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
   await setPassword(vault, password);
+  await skipPhraseStep(vault);
   await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
 }
 
diff --git a/extension/e2e/visual-vault.spec.ts b/extension/e2e/visual-vault.spec.ts
index b787abd..f752cf3 100644
--- a/extension/e2e/visual-vault.spec.ts
+++ b/extension/e2e/visual-vault.spec.ts
@@ -138,6 +138,11 @@ test('visual: the create run — #1, #2, #3, #4, #5, #6 and #7', async () => {
     await expect(text(p, '#pk-line')).toHaveText('This device cannot unlock the wallet with a passkey; your password still works.', {timeout: 60_000});
     await shot(p, '06-unsupported', {ready: p.locator('#pk-continue')});
     await p.locator('#pk-continue').click();
+    // B1e §1.3 (undrawn, §9): the anti-phishing step, then skipped.
+    await expect(p.locator('#v-anti-phishing')).toBeVisible({timeout: 60_000});
+    await expect(p.locator('#v-anti-phishing .top-bar .noc-overline')).toHaveText('Optional');
+    await shot(p, '06b-anti-phishing', {ready: p.locator('#ap-skip')});
+    await p.locator('#ap-skip').click();
 
     await p.waitForURL(/wallet\.html#\/created$/);
     await expect(p.getByText('Wallet created')).toBeVisible();
@@ -208,6 +213,8 @@ test('visual: import — #8’s states, #5 import, and #40', async () => {
     await expect(text(p, '#pw-step')).toHaveText('Import · 2 / 2');
     await shot(p, '05-import-enter', {ready: p.locator('#pw-back')});
     await setPassword(p, PASSWORD);
+    await expect(p.locator('#v-anti-phishing')).toBeVisible({timeout: 60_000});
+    await p.locator('#ap-skip').click();
     await p.waitForURL(/wallet\.html#\/imported$/, {timeout: 60_000});
     await expect(p.getByText('1 account · 1 token recovered. Welcome back.')).toBeVisible();
     await expect(p.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeVisible();
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, the affected E2E.**

Run: the Step 2 command — `Test Files  10 passed (10)` · `Tests  656 passed (656)` (rev 2: the same; the overline is one more assertion in an existing row).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `TZ=UTC npx vitest run` — `Test Files  234 passed (234)` · `Tests  5176 passed (5176)` (rev 2.1; Task 4's 230 / 5115: +4 files, +61 — phraseRead 2, phraseScreens 20, app phrase 11, approve phrase 25, challenge +3; the other changed rows changed, not added). `TZ=UTC npx vitest run --config vitest.nopresale.config.ts` — `Test Files  22 passed (22)` · `Tests  531 passed | 25 skipped (556)` (Task 4's 19 / 472 + 25: the three screen files added to `NOPRESALE_TESTS`, 56 rows, plus challenge's +3 — both builds).

Run: `rm -rf dist dist-nopresale && node scripts/build.mjs && node scripts/build.mjs --no-presale` (exit 0), `npm run csp` (exit 0: `CSP ok` for both), `npm run gates` — exit 0; among its lines, for `dist` and `dist-nopresale`: `vault isolation ok (…): … every module bundled into the vault page is vault-page code or one of its five packages …` and `classes ok: every class in 62 src/app and src/approve files is defined by …; every class in 51 vault-page files by …`.

Run the E2E the task touches (the specs whose flows meet the step, the six screens' existing specs, the vault page's CSP walk and visual specs): `npx playwright test e2e/onboarding.spec.ts e2e/wallet.spec.ts e2e/csp.spec.ts e2e/visual-vault.spec.ts e2e/unlock.spec.ts e2e/settings.spec.ts e2e/dapp.spec.ts e2e/dappTx.spec.ts e2e/popup.spec.ts e2e/visual-dapp.spec.ts e2e/visual-settings.spec.ts e2e/damaged.spec.ts` — `55 passed (14.9m)`; and the same under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'` — `55 passed (14.7m)`. (Long: launch detached with a log and a marker, as the Global Constraints say.)

No repo-root `src/` or `core/` change: root `tsc` / `jest` and web `verify` are not run.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1e-1 the anti-phishing phrase in the UI — the line on #9 (read before the password field shows), the popup's locked screen, every approval window state (#46, #47, #48 incl. F12's Reject-only screen and a lookalike, the locked window, the origin mismatch) and #10, as plain text; nothing when none is set; R9's line when the read fails; onboarding's skippable step after the wallet is stored (create after #6, import, never created-locked); #35's row sets it at once and sends a change or removal to #10, which describes it without its value and applies it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked), `timeout 300`; `tsc`'s own exit code first, then the named test file(s).** `PRT` = `src/shared/__tests__/phraseRead.test.ts` (2), `PS` = `src/unlock/__tests__/phraseScreens.test.ts` (20), `CT` = `src/unlock/__tests__/challenge.test.ts` (46), `APP` = `src/app/__tests__/phrase.test.tsx` (11), `WIN` = `src/approve/__tests__/phrase.test.tsx` (25). Files: `PL` = `src/app/ui/PhraseLine.tsx`, `LK` = `src/app/screens/Locked.tsx`, `SEC` = `src/app/screens/Security.tsx`, `EN` = `src/app/engine.ts`, `WC` = `src/app/WalletContext.tsx`, `UI` = `src/approve/ui.tsx`, `ALK` = `src/approve/Locked.tsx`, `TX` = `src/approve/Tx.tsx`, `SG` = `src/approve/Sign.tsx`, `CN` = `src/approve/Connect.tsx`, `MM` = `src/approve/Mismatch.tsx`, `CL` = `src/approve/client.ts`, `PR` = `src/shared/phraseRead.ts`, `VL` = `src/unlock/view/phraseLine.ts`, `UN` = `src/unlock/screens/unlock.ts`, `RA` = `src/unlock/screens/reauth.ts`, `CH` = `src/unlock/challenge.ts`, `RF` = `src/unlock/reauthFlow.ts`, `AS` = `src/unlock/screens/antiPhishing.ts`, `MO` = `src/unlock/modes.ts`, `CR` = `src/unlock/screens/createRun.ts`. The brief's pins: the phrase on all six screens (M-popup-line, M-window-line, M-approve-locked-line, M-sign-line, M-connect-lookalike, M-mismatch-line, M-unlock-line, M-reauth-line) and nothing when unset (M-unset-shows, M-unset-shows-vault) · `<b>x</b>` as text (M-markup-react, M-markup-vault — the latter also fails the vault-isolation gate) · #9 before the field (M-read-late, M-before-dom) · #48 on every state (M-tx-refused for F12's Reject-only screen, M-tx-lookalike, M-tx-simulating, M-tx-q26) · R9 (M-failed-silent, M-vault-catch, M-r9-hidden, M-state-whole, M-pending-whole) · the step writes only after `commitWallet`, skipping writes nothing (M-modes-create, M-modes-import, M-order, M-skip-writes, M-set-invalid, M-refused-on) · change and remove through #10, described without the phrase (M-describe, M-describe-action, M-action-swap, M-applied, M-phrase-settle, M-phrase-confirmed; M-security-reauth on #35's side) · the Security row reflects set or unset (M-security-meta, M-security-memo, M-security-invalid, M-security-shows) · the class gate (M-app-css, M-vault-css — the unit tests' styled-class check and `check-classes.mjs`). Both builds: the five files run in both vitest runs (`NOPRESALE_TESTS`); the mutants are run in the default run. The vault-isolation gate on M-markup-vault runs in the clone itself, the change applied, then `git checkout` (its built rules need the package's own `dist`).

| id | the change | named test → observed |
|---|---|---|
| M-popup-line | LK: `{wallet === null ? null : <PhraseLine phrase={wallet.phrase} />} ⏎` → `{wallet === null \|\| wallet.phrase.state === 'set' ? null : <PhraseLine phrase={wallet.phrase} />} ⏎` | tsc 0 · APP RED `3 failed \| 8 passed (11)` — “the locked screen: the phrase under the header (B1e §1.2) > popup: the phrase beside the shield, named for a screen reader, under "Welcome back"”; “the locked screen: the phrase under the header (B1e §1.2) > tab: the phrase beside the shield, named for a screen reader, under "Welcome back"” (+1 more) |
| M-window-line | UI: `<PhraseLine phrase={phrase} />` → `<PhraseLine phrase={phrase.state === 'set' ? {state: 'none'} : phrase} />` | tsc 0 · WIN RED `15 failed \| 10 passed (25)` — “#48: the phrase on every state (B1e §1.2) > simulating: the phrase under the top bar”; “#48: the phrase on every state (B1e §1.2) > ready: the phrase under the top bar” (+13 more) |
| M-approve-locked-line | ALK: `<PhraseLine phrase={phrase} />` → `<PhraseLine phrase={phrase.state === 'set' ? {state: 'none'} : phrase} />` | tsc 0 · WIN RED `1 failed \| 24 passed (25)` — “#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2) > the locked window (no top bar): the phrase first in the window; none set: no line” |
| M-tx-refused | TX: `onClose={reject} disabled={busy \|\| simulating} phrase={phrase} />` → `onClose={reject} disabled={busy \|\| simulating} phrase={regionBlocked ? {state: 'none'} : phrase} />` | tsc 0 · WIN RED `1 failed \| 24 passed (25)` — “#48: the phrase on every state (B1e §1.2) > F12 (Reject only): the phrase under the top bar” |
| M-tx-lookalike | TX: `onClose={reject} disabled={busy \|\| simulating} phrase={phrase} />` → `onClose={reject} disabled={busy \|\| simulating} phrase={lookalike ? {state: 'none'} : phrase} />` | tsc 0 · WIN RED `2 failed \| 23 passed (25)` — “#48: the phrase on every state (B1e §1.2) > a lookalike origin: the phrase under the top bar”; “#48: the phrase on every state (B1e §1.2) > a lookalike’s risk confirm open: the phrase under the top bar” |
| M-tx-simulating | TX: `onClose={reject} disabled={busy \|\| simulating} phrase={phrase} />` → `onClose={reject} disabled={busy \|\| simulating} phrase={simulating ? {state: 'none'} : phrase} />` | tsc 0 · WIN RED `1 failed \| 24 passed (25)` — “#48: the phrase on every state (B1e §1.2) > simulating: the phrase under the top bar” |
| M-tx-q26 | TX: `<WindowTop overline={TX_TEXT.overline} tone="neutral" onClose={reject} disabled={busy} phrase={phrase} />` → `<WindowTop overline={TX_TEXT.overline} tone="neutral" onClose={reject} disabled={busy} phrase={{state: 'none'}} />` | tsc 0 · WIN RED `1 failed \| 24 passed (25)` — “#48: the phrase on every state (B1e §1.2) > can no longer be signed (Q26): the phrase under the top bar” |
| M-sign-line | SG: `onClose={reject} disabled={busy} phrase={phrase} /> ⏎       <div` → `onClose={reject} disabled={busy} phrase={{state: 'none'}} /> ⏎       <div` | tsc 0 · WIN RED `1 failed \| 24 passed (25)` — “#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2) > #46 sign message: under the top bar” |
| M-connect-lookalike | CN: `onClose={reject} disabled={disabled} phrase={phrase} />` → `onClose={reject} disabled={disabled} phrase={kind === 'lookalike' ? {state: 'none'} : phrase} />` | tsc 0 · WIN RED `1 failed \| 24 passed (25)` — “#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2) > #47 connect (a lookalike): under the top bar” |
| M-mismatch-line | MM: `onClose={dismiss} disabled={busy} phrase={phrase} />` → `onClose={dismiss} disabled={busy} phrase={{state: 'none'}} />` | tsc 0 · WIN RED `1 failed \| 24 passed (25)` — “#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2) > #48 origin mismatch: under the top bar” |
| M-unlock-line | UN: `showPhraseLine('unl', await readPhraseLine(deps.send));` → `showPhraseLine('ra', await readPhraseLine(deps.send));` | tsc 0 · PS RED `7 failed \| 13 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > set: the phrase beside the shield, named for a screen reader, BEFORE the password field (in the page and on screen)”; “#9: the phrase line, read before the password field shows (B1e §1.2) > a phrase that looks like markup renders as its own text — no element is made of it” (+5 more) |
| M-reauth-line | RA: `showPhraseLine('ra', await readPhraseLine(deps.send));` → `showPhraseLine('unl', await readPhraseLine(deps.send));` | tsc 0 · PS RED `3 failed \| 17 passed (20)` — “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > on any challenge: the stored phrase on the line under the top bar, before the field; none set: no line”; “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > a phrase that looks like markup renders as its own text; a read that fails is R9’s line” (+1 more) |
| M-unset-shows | PL: `if (phrase.state === 'none') return null;` → `if (phrase.state === 'none') return <div className="banner shield app-phrase-line" />;` | tsc 0 · APP RED `1 failed \| 10 passed (11)` — “the locked screen: the phrase under the header (B1e §1.2) > none set: nothing — the screen is as before” · WIN RED `8 failed \| 17 passed (25)` — “#48: the phrase on every state (B1e §1.2) > ready, none set: no line”; “#48: the phrase on every state (B1e §1.2) > F12 (Reject only), none set: no line” (+6 more) |
| M-unset-shows-vault | VL: `` shown(byId(`${screen}-phrase`), read.state === 'set'); `` → `` shown(byId(`${screen}-phrase`), read.state !== 'failed'); `` | tsc 0 · PS RED `2 failed \| 18 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > none set: no line — the screen is as before; the field shows”; “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > on any challenge: the stored phrase on the line under the top bar, before the field; none set: no line” |
| M-markup-react | PL: `<span className="copy">{phrase.phrase}</span>` → `<span className="copy" dangerouslySetInnerHTML={{__html: phrase.phrase}} />` | tsc 0 · APP RED `1 failed \| 10 passed (11)` — “the locked screen: the phrase under the header (B1e §1.2) > a phrase that looks like markup renders as its own text — no element is made of it” · WIN RED `1 failed \| 24 passed (25)` — “#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2) > a phrase that looks like markup renders as its own text — no element is made of it” |
| M-markup-vault | VL: `` setText(byId(`${screen}-phrase-text`), read.state === 'set' ? read.phrase : ''); `` → `` setText(byId(`${screen}-phrase-text`), ''); ⏎   byId(`${screen}-phrase-text`).innerHTML = read.state === 'set' ? read.phrase : ''; `` | tsc 0 · PS RED `2 failed \| 18 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > a phrase that looks like markup renders as its own text — no element is made of it”; “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > a phrase that looks like markup renders as its own text; a read that fails is R9’s line” · `node scripts/check-vault-isolation.mjs` (in the clone, the change applied) exit **1** — `src/unlock/view/phraseLine.ts: writes markup — the vault page sets text only (textContent)` |
| M-read-late | UN: `showPhraseLine('unl', await readPhraseLine(deps.send));` → `void readPhraseLine(deps.send).then(r => showPhraseLine('unl', r));` | tsc 0 · PS RED `7 failed \| 13 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > set: the phrase beside the shield, named for a screen reader, BEFORE the password field (in the page and on screen)”; “#9: the phrase line, read before the password field shows (B1e §1.2) > a phrase that looks like markup renders as its own text — no element is made of it” (+5 more) |
| M-before-dom | `unlock.html`: the `#unl-phrase` and `#unl-phrase-failed` blocks moved from before `<form id="unl-form">` to after `#unl-entry`'s `.pin-head` (before `#unl-helper`) | tsc 0 · PS RED `1 failed \| 19 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > set: the phrase beside the shield, named for a screen reader, BEFORE the password field (in the page and on screen)” |
| M-failed-silent | PR: `? {state: 'set', phrase: field} : PHRASE_FAILED;` → `? {state: 'set', phrase: field} : PHRASE_NONE;` | tsc 0 · PRT RED `1 failed \| 1 passed (2)` — “phraseRead > a field missing, of another type, or not exactly what the background stores is failed — never none, never shown” · PS RED `2 failed \| 18 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > a read that fails (an answer without the field): R9’s line, never silence — the field still shows”; “#9: the phrase line, read before the password field shows (B1e §1.2) > a read that fails (a field that is not a phrase): R9’s line, never silence — the field still shows” · APP RED `2 failed \| 9 passed (11)` — “the locked screen: the phrase under the header (B1e §1.2) > a phrase field this side cannot read (missing): R9’s line — the screen still shows, with [Unlock]”; “the locked screen: the phrase under the header (B1e §1.2) > a phrase field this side cannot read (not a phrase): R9’s line — the screen still shows, with [Unlock]” · WIN RED `1 failed \| 24 passed (25)` — “#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2) > a phrase field the window cannot read: R9’s line — the request still shows, its Reject too” |
| M-vault-catch | VL: `} catch { ⏎     return PHRASE_FAILED;` → `} catch { ⏎     return {state: 'none'};` | tsc 0 · PS RED `1 failed \| 19 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > a read that fails (the send throws): R9’s line, never silence — the field still shows” |
| M-r9-hidden | VL: `` shown(byId(`${screen}-phrase-failed`), read.state === 'failed'); `` → `` shown(byId(`${screen}-phrase-failed`), read.state === 'failed' && screen === 'ra'); `` | tsc 0 · PS RED `4 failed \| 16 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > a read that fails (the send throws): R9’s line, never silence — the field still shows”; “#9: the phrase line, read before the password field shows (B1e §1.2) > a read that fails (a refusal): R9’s line, never silence — the field still shows” (+2 more) |
| M-state-whole | EN: `if (scheme === undefined \|\| accounts === undefined \|\| selected === undefined \|\| typeof o.passkey !== 'boolean') return undefined;` → `if (scheme === undefined \|\| accounts === undefined \|\| selected === undefined \|\| typeof o.passkey !== 'boolean' \|\| phraseRead(o.phrase).state === 'failed') return undefined;` | tsc 0 · APP RED `2 failed \| 9 passed (11)` — “the locked screen: the phrase under the header (B1e §1.2) > a phrase field this side cannot read (missing): R9’s line — the screen still shows, with [Unlock]”; “the locked screen: the phrase under the header (B1e §1.2) > a phrase field this side cannot read (not a phrase): R9’s line — the screen still shows, with [Unlock]” |
| M-pending-whole | CL: `if (request === undefined \|\| !isInt(o.waiting) \|\| !isBool(o.windowNotice)) return null;` → `if (request === undefined \|\| !isInt(o.waiting) \|\| !isBool(o.windowNotice) \|\| phraseRead(o.phrase).state === 'failed') return null;` | tsc 0 · WIN RED `1 failed \| 24 passed (25)` — “#46, #47, the locked window, #48’s origin mismatch: the phrase (B1e §1.2) > a phrase field the window cannot read: R9’s line — the request still shows, its Reject too” |
| M-modes-create | MO: `importRun: () => imports.show(), phraseStep});` → `importRun: () => imports.show()});` | tsc 0 · PS RED `4 failed \| 16 passed (20)` — “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > create: not before #6; after it, the step — Skip writes nothing and goes on to #7”; “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > create: [Set phrase] writes once — after the wallet is stored and its keys handed over — then #7; the phrase survives” (+2 more) |
| M-modes-import | MO: `storing: create.storing, phraseStep});` → `storing: create.storing});` | tsc 0 · PS RED `1 failed \| 19 passed (20)` — “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > import: once the wallet is stored, the step; [Set phrase] → #40 with the phrase stored” |
| M-order | CR: `done: () => passwordStep()});` → `done: () => { ⏎       o.phraseStep?.({path: 'create', then: () => undefined}); ⏎       passwordStep(); ⏎     }});` · CR: `{done: () => (o.phraseStep === undefined ? toCreated() : o.phraseStep({path: 'create', then: toCreated}))}` → `{done: toCreated}` | tsc 0 · PS RED `4 failed \| 16 passed (20)` — “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > create: not before #6; after it, the step — Skip writes nothing and goes on to #7”; “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > create: [Set phrase] writes once — after the wallet is stored and its keys handed over — then #7; the phrase survives” (+2 more) |
| M-skip-writes | AS: `if (then !== null) goOn();` → `if (then !== null) { ⏎         await deps.send({type: 'settings.phrase', phrase: null}); ⏎         goOn(); ⏎       }` | tsc 0 · PS RED `1 failed \| 19 passed (20)` — “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > create: not before #6; after it, the step — Skip writes nothing and goes on to #7” |
| M-set-invalid | AS: `set.disabled = busy \|\| !open \|\| typeof cleanPhrase(field.value) !== 'string';` → `set.disabled = busy \|\| !open;` · AS: `if (then === null \|\| typeof cleanPhrase(field.value) !== 'string') return; ⏎     void exclusive` → `if (then === null) return; ⏎     void exclusive` · AS: `if (then === null \|\| typeof phrase !== 'string') return;` → `if (then === null \|\| phrase === undefined) return;` | tsc 0 · PS RED `2 failed \| 18 passed (20)` — “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > create: not before #6; after it, the step — Skip writes nothing and goes on to #7”; “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > [Set phrase] only for a phrase the rules accept — empty, short, long, a bidi override: disabled; markup is a phrase like any other” |
| M-refused-on | AS: `say(COMMON.failedTryAgain); ⏎` → `say(COMMON.failedTryAgain); ⏎       goOn(); ⏎` | tsc 0 · PS RED `1 failed \| 19 passed (20)` — “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) > a refused write says so and keeps the step — nothing moves on until Skip” |
| M-describe | CH: `const PHRASE_KEYS = ['action', 'kind'];` → `const PHRASE_KEYS = ['action', 'kind', 'phrase'];` | tsc 0 · CT RED `3 failed \| 43 passed (46)` — “describeChallenge: the anti-phishing phrase (B1e §1.3) > change and remove, exactly as the background describes them (positive control)”; “describeChallenge: the anti-phishing phrase (B1e §1.3) > fails closed: another action, a key more (the value itself included) or less” (+1 more) · PS RED `3 failed \| 17 passed (20)` — “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > change: "You are about to change" + "Change the anti-phishing phrase"; the new value nowhere; the line keeps the current one; proven → applied”; “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > remove: "Remove the anti-phishing phrase"; proven → applied — no phrase is stored” (+1 more) |
| M-describe-action | CH: `return a.action === 'change' \|\| a.action === 'remove' ? {kind: 'phrase', action: a.action} : null;` → `return a.action === 'change' \|\| a.action === 'remove' \|\| a.action === 'set' ? {kind: 'phrase', action: a.action === 'set' ? 'change' : a.action} : null;` | tsc 0 · CT RED `1 failed \| 45 passed (46)` — “describeChallenge: the anti-phishing phrase (B1e §1.3) > fails closed: another action, a key more (the value itself included) or less” |
| M-action-swap | RA: `d.action === 'change' ? REAUTH.phraseChange : REAUTH.phraseRemove` → `d.action === 'remove' ? REAUTH.phraseChange : REAUTH.phraseRemove` | tsc 0 · PS RED `2 failed \| 18 passed (20)` — “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > change: "You are about to change" + "Change the anti-phishing phrase"; the new value nowhere; the line keeps the current one; proven → applied”; “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > remove: "Remove the anti-phishing phrase"; proven → applied — no phrase is stored” |
| M-applied | RF: `return applied === 'settings' \|\| applied === 'phrase' ? 'applied' : 'confirmed';` → `return applied === 'settings' ? 'applied' : 'confirmed';` | tsc 0 · PS RED `2 failed \| 18 passed (20)` — “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > change: "You are about to change" + "Change the anti-phishing phrase"; the new value nowhere; the line keeps the current one; proven → applied”; “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > remove: "Remove the anti-phishing phrase"; proven → applied — no phrase is stored” |
| M-phrase-settle | RA: `if (described?.kind === 'settings' \|\| described?.kind === 'phrase') {` → `if (described?.kind === 'settings') {` | tsc 0 · PS RED `3 failed \| 17 passed (20)` — “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > change: "You are about to change" + "Change the anti-phishing phrase"; the new value nowhere; the line keeps the current one; proven → applied”; “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > remove: "Remove the anti-phishing phrase"; proven → applied — no phrase is stored” (+1 more) |
| M-phrase-confirmed | RA: `if (out === 'confirmed' \|\| out === 'refused') return notice(REAUTH.settingsFailed);` → `if (out === 'confirmed' \|\| out === 'refused') return notice(described.kind === 'phrase' && out === 'confirmed' ? REAUTH.settingsApplied : REAUTH.settingsFailed);` | tsc 0 · PS RED `1 failed \| 19 passed (20)` — “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > a phrase proof the background did not say it applied is never "Confirmed" (fail closed); Cancel only closes the tab” |
| M-security-meta | SEC: `phraseOn ? SECURITY_TEXT.on : SECURITY_TEXT.off, phraseOn ? 'success' : null` → `SECURITY_TEXT.off, phraseOn ? 'success' : null` | tsc 0 · APP RED `5 failed \| 6 passed (11)` — “#35: the anti-phishing row and its card (B1e §1.3, R1 = E18) > Off when none is set, On when one is — as wallet.state says”; “#35: the anti-phishing row and its card (B1e §1.3, R1 = E18) > set when none is set: the card’s input, [Set phrase] only for a phrase the rules accept; written at once — no #10 — and the row says On” (+3 more) |
| M-security-memo | WC: `\|\| JSON.stringify(prev.phrase) !== JSON.stringify(w.phrase);` → `;` | tsc 0 · APP RED `1 failed \| 10 passed (11)` — “#35: the anti-phishing row and its card (B1e §1.3, R1 = E18) > set when none is set: the card’s input, [Set phrase] only for a phrase the rules accept; written at once — no #10 — and the row says On” |
| M-security-reauth | SEC: `setOpen(null); ⏎       return m.reload(); ⏎     } ⏎     if (r.error === 'reauth-required') {` → `setOpen(null); ⏎       return m.reload(); ⏎     } ⏎     if (r.error === 'reauth-required' && value === '') {` | tsc 0 · APP RED `3 failed \| 8 passed (11)` — “#35: the anti-phishing row and its card (B1e §1.3, R1 = E18) > change: goes to #10 — the popup opens it and closes; nothing is written here; the row and the card never show the stored phrase”; “#35: the anti-phishing row and its card (B1e §1.3, R1 = E18) > remove: goes to #10 — the popup opens it and closes; nothing is written here; the row and the card never show the stored phrase” (+1 more) |
| M-security-invalid | SEC: `disabled={typeof clean !== 'string'}` → `disabled={false}` | tsc 0 · APP RED `1 failed \| 10 passed (11)` — “#35: the anti-phishing row and its card (B1e §1.3, R1 = E18) > set when none is set: the card’s input, [Set phrase] only for a phrase the rules accept; written at once — no #10 — and the row says On” |
| M-security-shows | SEC: `aria-label={phraseOn ? SECURITY_TEXT.phraseNew : SECURITY_TEXT.phrase} autoComplete="off" spellCheck={false} maxLength={64} value={typed}` → `aria-label={phraseOn ? SECURITY_TEXT.phraseNew : SECURITY_TEXT.phrase} autoComplete="off" spellCheck={false} maxLength={64} value={typed === '' && phrase?.state === 'set' ? phrase.phrase : typed}` | tsc 0 · APP RED `2 failed \| 9 passed (11)` — “#35: the anti-phishing row and its card (B1e §1.3, R1 = E18) > change: goes to #10 — the popup opens it and closes; nothing is written here; the row and the card never show the stored phrase”; “#35: the anti-phishing row and its card (B1e §1.3, R1 = E18) > remove: goes to #10 — the popup opens it and closes; nothing is written here; the row and the card never show the stored phrase” |
| M-app-css | app.css: every `.app-phrase-line` → `.app-phrase-linex` | tsc 0 · APP RED `2 failed \| 9 passed (11)` — “the locked screen: the phrase under the header (B1e §1.2) > popup: the phrase beside the shield, named for a screen reader, under "Welcome back"”; “the locked screen: the phrase under the header (B1e §1.2) > tab: the phrase beside the shield, named for a screen reader, under "Welcome back"” · WIN RED `15 failed \| 10 passed (25)` — “#48: the phrase on every state (B1e §1.2) > simulating: the phrase under the top bar”; “#48: the phrase on every state (B1e §1.2) > ready: the phrase under the top bar” (+13 more) · `node scripts/check-classes.mjs` exit **1** — `src/app/ui/PhraseLine.tsx: class "app-phrase-line" is defined in no stylesheet` |
| M-vault-css | unlock.css: every `.vlt-phrase-line` → `.vlt-phrase-linex` | tsc 0 · PS RED `2 failed \| 18 passed (20)` — “#9: the phrase line, read before the password field shows (B1e §1.2) > set: the phrase beside the shield, named for a screen reader, BEFORE the password field (in the page and on screen)”; “#10: the current phrase; a phrase challenge described without its value (B1e §1.2, §1.3) > on any challenge: the stored phrase on the line under the top bar, before the field; none set: no line” · `node scripts/check-classes.mjs` exit **1** — `unlock.html: class "vlt-phrase-line" is defined in no stylesheet the vault page loads` |

42 rows, all counted, all run on the final commit: every mutant `tsc` 0, every one red in each named file, the two class mutants also exit 1 from `check-classes.mjs`, M-markup-vault also exit 1 from the vault-isolation gate. The sweep: `b1e1-t5/mut.py` (scratch).

Rev 2's row (E20), observed on the rebuilt a6d3923:

| id | the change | named test → observed |
|---|---|---|
| M-overline | `unlock.html`: `<span class="title noc-overline vlt-muted">Optional</span>` → `<span class="title noc-overline vlt-muted">Onboarding</span>` (rev 1's overline back) | tsc 0 · PS RED `1 failed \| 19 passed (20)` — “onboarding’s anti-phishing step, as the page mounts it (B1e §1.3) › the copy: one text for the step and #35’s card; R9’s line on #9 and #10 is the popup’s” |

Rev 1's 42 rows re-run on a6d3923: every one `tsc` 0 and red, with rev 1's counts (the gate rows exit 1).

What the first sweep found, fixed before the final commit: **M-security-shows survived** — the change/remove test checked that the stored phrase appeared nowhere in the page's text, but an input's value is not text; the test now also asserts the card's field starts empty. **M-app-css and M-vault-css survived as first written** (one rule renamed; the class was still styled by its other selectors) — rewritten to rename every selector naming the class. **M-markup-vault and M-security-reauth did not compile** as first written (`setText` left unused, TS6133; a no-overlap comparison, TS2367) — each rewritten to keep the names used; neither was counted before it compiled.

#### Notes for the executor (Task 5)

- **Rev 2 — E20: the step's overline is "Optional".** `unlock.html`'s `#v-anti-phishing` top bar says "Optional" (was "Onboarding"); the step stays count-less after #6's "5 / 5". `phraseScreens.test.ts`' copy row pins the top bar's only child to "Optional" (red on rev 1's markup: `1 failed | 19 passed (20)`); `visual-vault.spec.ts` asserts it before its `06b-anti-phishing` shot. M-overline (Step 6) turns the unit row red. Re-run on the rebuilt a6d3923: `visual-vault.spec.ts` `5 passed (1.3m)` normally, `5 passed (1.3m)` under `unshare -rn`; the shot viewed.
- **Rev 2 — the escapes.** `phrase.test.tsx` (1), `phraseRead.test.ts` (4) and `phraseScreens.test.ts` (1) had typed RLO, a combining acute and a precomposed é raw; each is now a `\u` escape (the same code points; no count changed).
- Rev 2 totals: `234 / 5168` under `TZ=UTC` (Task 4's +27); rev 2.1: `234 / 5176` (Task 4's +8), the no-presale run unchanged. The 42 mutations and M-overline re-run on a6d3923: all 43 `tsc` 0 and red (rev 1's 42 with rev 1's counts).
- **Why `WindowTop` carries the line.** Every request screen of the approval window (#46, #47, #48 and its mismatch notice) has exactly one top bar, and #48 alone has two return paths plus the risk sheet; putting the line in `WindowTop` with a **required** `phrase` prop makes "a state without the line" a type error, and the per-state tests (`approve/__tests__/phrase.test.tsx`) pin that the prop carries the read (M-tx-*). The locked window has no top bar: its line is the first child of its body.
- **#9 and #10 read `vault.status` once.** #9 reads in its `reading` phase, after the stored vault is judged a wallet (no wallet / damaged show no line and no field) and before the field shows; #10 reads after the stored check and before the description. Existing tests that count exact sends gained the leading `vault.status` (#10) or clear the show's sends (#9's `shown` helper) — none lost a check.
- **R9 can only be caused by a bad answer.** The background always sends a valid field (`readPhrase` judges the stored value); R9's tests strip or spoil the field in the answer. The visual check did the same in the page (an init script), so the line was seen at its real size.
- **The step focuses its field once the gate frees.** #6's own action calls the step while the page's gate is held, so the field is disabled at that moment; the screen focuses it on the gate's idle (`focusPending`), as the test asserts.
- The vitest totals are given under `TZ=UTC` (Task 3's `Send.test.tsx` DST finding, fixed in Task 7).

#### Notes for the executor (Task 5, continued) — the dry run's rulings, deviations and hand-over

- Ruling: a `phrase` field the screen cannot read is R9's line, never the whole answer refused (`phraseRead` → `failed`; `walletStateOf` / `pendingOf` keep the state) — why: R9 says the window shows, with the line; refusing the state would blank the popup or the approval window — cost if wrong: one line each in `engine.ts` / `client.ts` (pinned by M-state-whole, M-pending-whole).
- Ruling: the screens re-judge the value with `cleanPhrase` (a string that is not exactly a stored phrase is `failed`) — why: the background already does, but a page renders what it can trust (as `challenge.ts` re-validates); a bidi override that slipped through would otherwise restyle the line — cost if wrong: none (the background never sends such a value).
- Ruling: the line is drawn by `WindowTop` with a **required** `phrase` prop, plus the locked window's own line — the approval window's "every state" is then a type guarantee as well as a test; the locked window and #48's origin-mismatch notice show it too (§1.2 "every approval window"), beyond the brief's three numbered screens.
- Ruling: #9 reads the phrase only once the stored vault is a wallet (no wallet, damaged and refused states show their notice, no field and no line); #10 the same (after the stored check, before the description) — why: the line guards a password field; those states have none — cost if wrong: one call moved.
- Ruling: no timeout on the `vault.status` read — the field waits for the answer (§1.2 "before the password is typed"); a send that throws is R9 at once. A background that never answers would leave #9 in `reading` (no field), which is the fail-closed side — cost if wrong: a timer and a test.
- Ruling: a screen-reader label "Anti-phishing phrase: " (visually hidden, `.vlt-sr` / new `.app-sr`) precedes the phrase on every line — why: the phrase alone read aloud is meaningless; the words are the spec's own (§1.3's row) — **flag:** new use of spec copy.
- Ruling: #10's end states for a phrase challenge reuse the settings ones (O39 "Confirmed. The change is saved — you can close this tab.", O40/O41/O26), Cancel only closes the tab — why: §1.3 "exactly as `setSettings` does it"; "Choose the setting again in Security center." reads acceptably for the phrase — cost if wrong: three phrase-specific strings.
- Ruling: #35's card never shows the stored phrase (the field starts empty; "New anti-phishing phrase" when one is set) — why: §1.3's "never the new value on #10" carried to the popup in reverse: the stored one is shown where it protects (locked screen, approval windows, #9, #10), not in a settings form someone at an unlocked popup could read — cost if wrong: one prefill (M-security-shows pins today's choice).
- Ruling: the onboarding step answers any outcome but `set` / `unchanged` with `COMMON.failedTryAgain` and keeps the step ([Skip] still goes on) — `locked` included; no new refusal copy.
- Ruling: #35's row sits in "Locks" after Passkey and before Change password, meta On (success tone) / Off (plain, not a warning: the phrase is optional, not an outstanding task) / none while unknown or unreadable — owner to confirm in the visual pass.
- **New copy (flagged, controller copy, owner to confirm):** the step's lede and #35's caption "Noctura shows it on its unlock and approval windows. A window without it is not Noctura's." (from §1.1); the helper "3–32 characters: letters, numbers, symbols and simple emoji." (§1.5's words + the rule); the help "Never type it into a website. Anyone who uses this browser profile can see it." (§1.1 / Minor 3); buttons "Set phrase", "Skip", "Change phrase", "Remove phrase"; the field label "New anti-phishing phrase"; #35's note "A change or a removal asks for your password in a new tab." (modelled on O48/O50's notes). Spec copy used verbatim: "Set an anti-phishing phrase", "Anti-phishing phrase", R9's line, "Change / Remove the anti-phishing phrase".
- Deviation: the brief names five changed E2E-adjacent things for Task 7 only; this task had to edit `e2e/vaultPage.ts`, `onboarding.spec.ts` and `visual-vault.spec.ts`, because the step now interrupts create and plain-import flows (they would time out at `wallet.html#/created|imported`) — the step is skipped there (`skipPhraseStep`), and visual-vault shoots it (`06b-anti-phishing`). The six-screen E2E itself stays Task 7's.
- Deviation: existing tests that count the vault page's exact sends changed: #10's lists gained the leading `vault.status` (8 + 1 rows); #9's `shown` helper clears the show's sends (5 rows had asserted `sent` = `[]` after an action). No assertion was dropped.
- Visual check (scratch only, `b1e1-t5/zz-task5-visual.spec.ts` run in the clone, then removed): popup 412 × 600 — `shots/p1-popup-locked-phrase.png`, `p2-popup-locked-long.png` (a 32-unit phrase), `p3-popup-locked-failed.png` (R9, the field stripped in the page), `s1-security-row-off.png`, `s2-security-card-set.png`, `s3-security-row-on.png`, `s4-security-card-change.png`; vault page 412 × 916 — `v1-unlock-phrase.png`, `v2-unlock-failed.png`, `v3-reauth-change.png`, `v4-reauth-remove.png`, `o1-step-empty.png`, `o2-step-typed.png`, `o3-step-refused.png`; approval window 412 × 720 — `w1-connect-unknown.png`, `w2-sign.png`, `w3-tx-lookalike.png`, `w4-locked-window.png` (all under `scratchpad/b1e1-t5/shots/`). Seen: the line sits under each header at the screen's gutter, the phrase in the shield tone, R9 in the warning banner, nothing clipped; the locked window's line is inset by its body's own padding (as Q24's banner there). No fix was needed after the shots. F12's Reject-only screen was not shot (it needs the presale build's region gate; its line is pinned by the unit test and M-tx-refused) — Task 7's pass covers it.
- Next task must know: Task 7 — the E2E selectors and `skipPhraseStep` (Interfaces); the rev 2.2 list gains: R9 for a malformed field (not only "no answer, an error"), the line also on the locked window and the origin-mismatch notice, the screen-reader label, #35's card never showing the stored phrase, the step's refusal copy, the new copy above.


### Task 6: Links and licences — #1's Terms and Privacy Policy and #38's Legal and Resources rows as links that open a new tab (never a fetch); `licenses.html` generated from the modules with rendered code (`renderedLength > 0`), the owner's allowlist, `licence-ids.json`, the Geist fonts, a static page the gates admit by name; the link gate (§4.3); the licence gate (rpc-websockets stub renders 0 bytes, the page matches the maps); the RP ID ↔ HOST_PERMISSIONS pin (§5.6)

**Spec:** B1e §4.1 (#1: "By continuing you agree to the **Terms** and **Privacy Policy**", both links; #38: Terms, Privacy, Open-source licences, Help, as drawn; noc-tura.io pages in a new tab, `<a target="_blank" rel="noopener noreferrer">`, the explorer link's pattern; `connect-src` unchanged; licences inside the package, in a new tab), §4.2 (N1–N3, E15, E16: a static root page written by `scripts/build.mjs` before the per-browser copies; `STATIC_PAGES` and the static-page rule over the raw file; inputs 1–7 — `rendered` in the module maps, ours, packages by nearest named `package.json`, licence files or the committed standard text, `licence-ids.json`, the fonts, the allowlist, the rpc-websockets gate and stub; order and determinism), §4.3 (the probe's URL table, the exact-string rule, `licenses.html` skipped by name, its controls), §4.4, §5.6 / E17 (the `RP_ID` test — it is a code test, so it lands here; the `rp-id.json` half is B1e-2's, Notes for the executor), §9 (`licenses.html` is undrawn; it has no stylesheet at all), §10. **Not here:** the built `relay.js` / `provider.js` no-`storage` check (§1.6) — Task 4 landed it as `contentStorageViolations`; nothing in this task touches it. The release script, `rp-id.json` and its pre-upload gate (B1e-2).

**As drawn (`index.html` #1, #38; nothing copied — the design carries the TGE date; labels typed from the rendered mockup):** #1 keeps its terms line where the design draws it — above the two buttons (the spec's "under the buttons" contradicts the drawing; the drawing wins, the position is unchanged from today), "Terms" and "Privacy Policy" are its two `<a>` (the design's own `.s-welcome .terms a`, already in `design-ext.css`). #38: an overline **Legal** with **Terms of Service** (`i-doc`, `i-arrow-up-right`), **Privacy Policy** (`i-shield-check`, `i-arrow-up-right`), **Open-source licenses** (`i-book`, `i-chevron-right` — the design's in-app chevron: it opens a page of the package); then **Resources** with **Help & support** (`i-help`, new to `ExtIcon` from the sprite, `i-arrow-up-right`) and the existing "noc-tura.io" text row. **Departure, loud:** the design's "142 packages" meta on the licences row is **not drawn** — the popup cannot know the count: the page is generated after the popup is bundled, and the CSP's `connect-src` forbids reading the package's own file (Notes for the executor).

**Files:**
- Create: `extension/scripts/licences.mjs` (the page's inputs and generator), `extension/scripts/check-licences.mjs` (the licence gate), `extension/scripts/check-links.mjs` (the link gate), `extension/scripts/rpcWebsockets.mjs` (the alias), `extension/src/shared/rpcWebsocketsStub.ts` (the stub), `extension/src/shared/links.ts` (the three noc-tura.io pages and the licence page's name), `extension/release/licence-ids.json`, `extension/release/licence-texts/MIT.txt`, `extension/public/fonts/LICENSE.txt` (geist@1.7.2's `LICENSE.txt`, byte for byte)
- Modify: `extension/vite.config.ts` (the `rendered` section; the alias), `extension/vite.content.config.ts` (the `rendered` section), `extension/scripts/build.mjs` (writes `licenses.html`), `extension/scripts/check-vault-isolation.mjs` (`STATIC_PAGES`, `staticPageViolations`, `pageViolations`), `extension/package.json` (`gates:build` runs the two new gates), `extension/unlock.html` (#1's links), `extension/src/app/screens/About.tsx` (#38's rows), `extension/src/app/ui/ExtIcon.tsx` (`help`), `extension/src/app/app.css` (a link row)
- Create (tests): `extension/scripts/__tests__/licences.test.mjs` (21), `extension/scripts/__tests__/check-links.test.mjs` (17), `extension/scripts/__tests__/rpcWebsockets.test.mjs` (4), `extension/src/vault/__tests__/rpId.test.ts` (3), `extension/src/app/__tests__/about.test.tsx` (7), `extension/e2e/links.spec.ts` (4: two specs × two builds)
- Modify (tests): `extension/scripts/__tests__/check-vault-isolation.test.mjs` (+15), `extension/scripts/__tests__/presaleBuilds.test.mjs` (+7, and its builds lose vitest's `NODE_ENV`), `extension/src/unlock/__tests__/welcome.test.ts` (+1, one changed), `extension/src/app/__tests__/links.test.ts` (+1, one changed), `extension/src/app/__tests__/Settings.test.tsx` (one changed)

**Interfaces:**
- Consumes: `htmlTags`, `ENTRIES`, `listFiles` (`check-vault-isolation.mjs`); `distDir`, `isMain`; `RP_ID` (`src/vault/passkey.ts`); `HOST_PERMISSIONS` (`manifest/source.mjs`); `useWallet`, `TopBar`, `ExtIcon`; `.app-sr` (Task 5, `app.css`); `renderApp`, `selectorsOf` / `unstyledClasses`, the vault-page `harness`; `launchPopup`, `seedUnlockedWallet`, `EXT`, `EXT_NOPRESALE`. The module maps' existing sections (`chunks`, `css`, `chunkCss`, `cssRefs`) are unchanged.
- Produces (`extension/scripts/licences.mjs`):
  ```js
  export const ALLOWED_LICENCES: ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'OFL-1.1', 'Unlicense'];
  export const MODULE_MAPS: ['app.modules.json', 'app.provider.modules.json', 'app.relay.modules.json'];
  export const LICENCE_PAGE: 'licenses.html';
  export const LICENCE_IDS: 'release/licence-ids.json';      // name@version → SPDX
  export const LICENCE_TEXTS: 'release/licence-texts';       // <SPDX>.txt
  export const OURS: {name: 'Noctura', spdx: 'BUSL-1.1', file: '../LICENSE'};
  export const FONTS: {name: 'geist', version: '1.7.2', spdx: 'OFL-1.1', licence: 'public/fonts/LICENSE.txt', files: {[face: string]: sha256}};
  export function renderedModules(maps: [string, unknown][]): Set<string>;          // throws INCONCLUSIVE without `rendered`
  export function moduleKind(id: string): 'skip' | 'ours' | 'package' | 'unknown';
  export function licenceEntries(root: string, maps: [string, unknown][], appDir: string): Entry[];  // throws, naming every problem
  export const WRAP_COLUMNS: 100;
  export function wrapText(text: string, width?: number): string;  // lines over `width` broken at word boundaries; a longer word stays whole
  export function licencePage(entries: Entry[]): string;           // every <pre> text through wrapText
  export function buildLicencePage(root: string, outRoot: string): string;          // reads <outRoot>/<MODULE_MAPS>, <outRoot>/app/fonts
  // Entry = {name, version?, spdx, files?, text}
  ```
- Produces (`extension/scripts/check-licences.mjs`): `rpcWebsocketsViolations(maps): string[]`, `licencePageViolations(root, outRoot): string[]`; CLI per `NOCTURA_DIST`.
- Produces (`extension/scripts/check-links.mjs`): `URL_LITERAL` (the spec's regex), `SKIPPED = ['licenses.html']`, `LINKS: {url, where(path): boolean, present?: true, build?: 'presale', kind}[]`, `urlStrings(text): string[]` (a `${…}` interpolation folded to `${}`), `linkViolations(files: {path, text}[], presale: boolean, {links?, skipped?}?): string[]`, `packageFiles(dir)`; CLI per `NOCTURA_DIST` over `chrome/` and `firefox/`, the build read from `app.features.json`.
- Produces (`extension/scripts/check-vault-isolation.mjs`): `STATIC_PAGES = ['licenses.html']`, `STATIC_PAGE_REFUSED`, `staticPageViolations(path, html)`, `pageViolations(distApp)`; the CLI runs `pageViolations` on `app/`, `chrome/`, `firefox/`.
- Produces (`extension/scripts/rpcWebsockets.mjs`): `RPC_WEBSOCKETS_STUB = 'src/shared/rpcWebsocketsStub.ts'`, `rpcWebsocketsAlias(root?) → [{find: /^rpc-websockets$/, replacement}]`.
- Produces (`extension/src/shared/rpcWebsocketsStub.ts`): `export class CommonClient` (throws when constructed), `export function WebSocket(): never` — exactly these two.
- Produces (`extension/src/shared/links.ts`): `NOCTURA_PAGES = {terms, privacy, help}` (`https://noc-tura.io/extension/…`), `LICENCES_PAGE = 'licenses.html'`.
- Produces (`extension/src/app/screens/About.tsx`): `ABOUT_TEXT = {legal, resources, terms: 'Terms of Service', privacy: 'Privacy Policy', licences: 'Open-source licenses', help: 'Help & support', newTab: ' (opens in a new tab)'}`.
- Produces (build output): `dist*/app.modules.json` gains `rendered: {chunk: {moduleId: renderedLength}}`; `dist*/app.provider.modules.json` and `dist*/app.relay.modules.json` gain the same section; every package (`app/`, `chrome/`, `firefox/`) carries `licenses.html` and `fonts/LICENSE.txt` (28 files per package, was 26).
- **What later tasks rely on:** Task 7 — the links E2E exists (`e2e/links.spec.ts`, both builds); its selectors: `#wel-terms-link`, `#wel-privacy-link`, the role `link` named "<row> (opens in a new tab)" on #38; the visual pass may re-shoot #38 (`.app-about-body`) and `licenses.html`. B1e-2 — the release script reads `licenses.html` as part of `verify`'s package; `rp-id.json` and the second half of the RP ID test (`RP_ID` equals `rp-id.json`'s `rpId`) are B1e-2's.

**The rule, stated once.** The extension names a URL only where the link table says it may, as a whole string: the coordinator only in `manifest.json` and `background.js`, the RP ID host only in `manifest.json`, the three noc-tura.io pages and Solscan's prefix in pages (each must be present), the presale build's referral link, and nine inert library strings — anything else fails the gate, naming the file; `licenses.html` alone is skipped, by name, at the package root, because its licence texts carry URLs as escaped text and the static-page rule refuses `<a`, `href=` and every other way a page could link, load or run. The licence page is built from what the bundler really emitted — modules with rendered bytes, never the ids of tree-shaken ones — and from nothing else: every package with rendered code is named by its nearest named `package.json`, its licence comes from its licence files or the committed standard text, its SPDX id from its `license` field or the committed table, and it must be on the owner's list; anything the build cannot name or the list does not hold fails the build. rpc-websockets resolves to a two-export stub in every build, and the licence gate fails if the real package appears in a map or the stub renders a byte. The links on #1 and #38 are `<a target="_blank" rel="noopener noreferrer">` — the browser opens the tab, nothing in the extension fetches or handles them. `RP_ID`'s host is a `HOST_PERMISSIONS` value, by test.

- [ ] **Step 1: Write the failing tests.**

Create `extension/scripts/__tests__/licences.test.mjs`:

```js
import {createHash} from 'node:crypto';
import {copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ALLOWED_LICENCES, FONTS, LICENCE_IDS, MODULE_MAPS, WRAP_COLUMNS, buildLicencePage, licenceEntries, licencePage, moduleKind, renderedModules, wrapText} from '../licences.mjs';
import {licencePageViolations, rpcWebsocketsViolations} from '../check-licences.mjs';
import {RPC_WEBSOCKETS_STUB} from '../rpcWebsockets.mjs';
import {staticPageViolations} from '../check-vault-isolation.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const collapse = text => text.split(/\s+/).filter(Boolean).join(' ');
/** The lines of the page's <pre> blocks as the browser renders them (entities decoded) — a <pre> never wraps; a <p> does. */
const renderedLines = html => html.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').split('\n');
const preLines = html => [...html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].flatMap(m => renderedLines(m[1]));
const overlong = html => preLines(html).filter(l => [...l].length > WRAP_COLUMNS && /\s/.test(l.trim()));

// B1e §4.2, §4.4: the licence page from the module maps — rendered code only, the owner's allowlist, licence-ids.json,
// the fonts — over a package tree written for the test (node_modules, the tables, the repository's LICENSE).
describe('the licence page (B1e §4.2)', () => {
  let repo;
  let root;
  let out;
  const write = (rel, text) => {
    mkdirSync(dirname(join(root, rel)), {recursive: true});
    writeFileSync(join(root, rel), text);
  };
  const pkg = (dir, json, files = {}) => {
    write(`${dir}/package.json`, JSON.stringify(json));
    for (const [name, text] of Object.entries(files)) write(`${dir}/${name}`, text);
  };
  /** One map per MODULE_MAPS file; `rendered` for the first, the content scripts' own maps carry ours only. */
  const maps = rendered => [
    ['app.modules.json', {chunks: {'background.js': Object.keys(rendered)}, rendered: {'background.js': rendered}}],
    ['app.provider.modules.json', {chunks: {'provider.js': ['src/provider/index.ts']}, rendered: {'provider.js': {'src/provider/index.ts': 10}}}],
    ['app.relay.modules.json', {chunks: {'relay.js': ['src/relay/index.ts']}, rendered: {'relay.js': {'src/relay/index.ts': 10}}}],
  ];
  const RENDERED = {
    'src/background/index.ts': 100,
    '../core/solana/rpc.ts': 50,
    'unlock.html': 0,
    '\0rolldown/runtime.js': 30,
    '__vite-browser-external': 5,
    'node_modules/alpha/index.js': 40,
    'node_modules/alpha/lib/deep/x.js': 4,
    'node_modules/beta/index.js': 12,
    'node_modules/gamma/index.js': 0,
    'node_modules/delta/node_modules/alpha/index.js': 7,
    'node_modules/epsilon/node_modules/alpha/index.js': 3,
    'node_modules/zeta/dist/z.mjs': 9,
    'node_modules/@scope/eta/index.js': 1,
  };
  beforeEach(() => {
    repo = mkdtempSync(join(tmpdir(), 'licences-'));
    root = join(repo, 'extension');
    out = join(root, 'dist');
    writeFileSync(join(repo, 'LICENSE'), 'Business Source License 1.1\r\n\r\nLicensor: Noctura\r\n');
    write(LICENCE_IDS, `${JSON.stringify({'beta@2.0.0': 'Unlicense'})}\n`);
    write('release/licence-texts/MIT.txt', 'MIT License\n\nPermission is hereby granted <standard>.\n');
    write('public/fonts/LICENSE.txt', 'Copyright (c) 2023 Vercel\n\nSIL OPEN FONT LICENSE Version 1.1\n');
    pkg('node_modules/alpha', {name: 'alpha', version: '1.0.0', license: 'MIT'}, {LICENSE: 'Copyright (c) Alpha <a@x.y>\r\nMIT text\r\n'});
    // A directory with its own package.json but no name is not a package: alpha's own is found above it.
    pkg('node_modules/alpha/lib', {type: 'module'});
    pkg('node_modules/beta', {name: 'beta', version: '2.0.0', author: 'Beta Author'}, {'LICENSE.md': 'This is free and unencumbered software released into the public domain.\n'});
    pkg('node_modules/gamma', {name: 'gamma', version: '3.0.0', license: 'LGPL-3.0-only'}, {LICENSE: 'LGPL'});
    // Two nested copies of alpha: one the same version and text as the top level (one entry), one another version.
    pkg('node_modules/delta/node_modules/alpha', {name: 'alpha', version: '1.0.0', license: 'MIT'}, {LICENSE: 'Copyright (c) Alpha <a@x.y>\nMIT text\n'});
    pkg('node_modules/epsilon/node_modules/alpha', {name: 'alpha', version: '0.9.0', license: 'MIT'}, {LICENSE: 'Copyright (c) Alpha 0.9\n'});
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'MIT', author: {name: 'Zeta Z', email: 'z@z.z', url: 'https://z.example'}});
    pkg('node_modules/@scope/eta', {name: '@scope/eta', version: '5.0.0', license: 'Apache-2.0'}, {'LICENSE-MIT.txt': 'MIT part', 'LICENSE-APACHE': 'Apache part', COPYING: 'copying part', README: 'not a licence'});
    mkdirSync(join(out, 'app', 'fonts'), {recursive: true});
    for (const f of Object.keys(FONTS.files)) copyFileSync(join(ROOT, 'public/fonts', f), join(out, 'app', 'fonts', f));
    copyFileSync(join(root, 'public/fonts/LICENSE.txt'), join(out, 'app', 'fonts', 'LICENSE.txt'));
  });
  afterEach(() => rmSync(repo, {recursive: true, force: true}));

  const entries = (rendered = RENDERED) => licenceEntries(root, maps(rendered), join(out, 'app'));
  const titles = list => list.map(e => (e.version === undefined ? e.name : `${e.name} ${e.version}`));
  const fails = (rendered = RENDERED) => {
    try {
      entries(rendered);
    } catch (e) {
      return e.message.split('\n').slice(1);
    }
    throw new Error('the page was built');
  };

  it('lists Noctura first, then every package with rendered code and the fonts, by name then version — a package rendered 0 is absent', () => {
    expect(titles(entries())).toEqual(['Noctura', '@scope/eta 5.0.0', 'alpha 0.9.0', 'alpha 1.0.0', 'beta 2.0.0', 'geist 1.7.2', 'zeta 0.1.0']);
    expect(titles(entries())).not.toContain('gamma 3.0.0');
  });

  it('copies with the same name, version and text are one entry; the same name and version with another text are two', () => {
    expect(titles(entries()).filter(t => t === 'alpha 1.0.0')).toHaveLength(1);
    write('node_modules/delta/node_modules/alpha/LICENSE', 'Copyright (c) Alpha, a fork\n');
    expect(titles(entries()).filter(t => t === 'alpha 1.0.0')).toHaveLength(2);
  });

  it('the texts: ours from the repository LICENSE, every LICENSE*/LICENCE*/COPYING* sorted (CRLF folded), the standard text headed by the author, the fonts', () => {
    const byTitle = Object.fromEntries(entries().map(e => [e.version === undefined ? e.name : `${e.name} ${e.version}`, e]));
    expect(byTitle.Noctura).toEqual({name: 'Noctura', spdx: 'BUSL-1.1', text: 'Business Source License 1.1\n\nLicensor: Noctura'});
    expect(byTitle['alpha 1.0.0'].text).toBe('Copyright (c) Alpha <a@x.y>\nMIT text');
    expect(byTitle['@scope/eta 5.0.0'].text).toBe('COPYING\n\ncopying part\n\nLICENSE-APACHE\n\nApache part\n\nLICENSE-MIT.txt\n\nMIT part');
    expect(byTitle['zeta 0.1.0'].text).toBe('Author: Zeta Z <z@z.z> (https://z.example)\nThe package ships no licence file; this is the standard MIT text its package.json names.\n\nMIT License\n\nPermission is hereby granted <standard>.');
    expect(byTitle['beta 2.0.0']).toMatchObject({spdx: 'Unlicense', text: 'This is free and unencumbered software released into the public domain.'});
    expect(byTitle['geist 1.7.2']).toEqual({name: 'geist', version: '1.7.2', spdx: 'OFL-1.1', files: ['fonts/Geist-Variable.woff2', 'fonts/GeistMono-Variable.woff2'], text: 'Copyright (c) 2023 Vercel\n\nSIL OPEN FONT LICENSE Version 1.1'});
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'MIT'});
    expect(Object.fromEntries(entries().map(e => [e.name, e]))['zeta'].text).toMatch(/^The package names no author\.\n/);
  });

  it('the page is plain text: every < escaped, no tag beyond plain text — the static-page rule holds on it', () => {
    write('node_modules/alpha/LICENSE', '<script src="x.js"></script> <a href="https://evil.example/">x</a> <style>body{}</style> & <b onclick=x>');
    const html = licencePage(entries());
    expect(html).toContain('&lt;script src="x.js"&gt;&lt;/script&gt; &lt;a href="https://evil.example/"&gt;x&lt;/a&gt;');
    expect(html).not.toContain('<script');
    expect(staticPageViolations('licenses.html', licencePage(entries({'src/a.ts': 1, 'node_modules/beta/index.js': 1})))).toEqual([]);
    expect(html.startsWith('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Open-source licenses · Noctura</title>')).toBe(true);
  });

  it('a limitation, as a test: a licence text that spells href= or style= fails the static-page rule (raw-file match) — the build stops, never ships it', () => {
    write('node_modules/alpha/LICENSE', 'see style= and href= here');
    expect(staticPageViolations('licenses.html', licencePage(entries()))).toEqual(['licenses.html contains href= — a static page links, loads and runs nothing', 'licenses.html contains style= — a static page links, loads and runs nothing']);
  });

  it('wraps every line longer than 100 columns at word boundaries; a word longer than 100 stays whole; nothing but the breaks changes', () => {
    expect(WRAP_COLUMNS).toBe(100);
    const long = Array.from({length: 40}, (_, i) => `word${i}`).join(' ');
    const giant = 'x'.repeat(130);
    const text = `short line\n${long}\n   indented ${long}\n${giant}\n${long} ${giant} tail\ntrailing  ${long}   `;
    const wrapped = wrapText(text);
    for (const line of wrapped.split('\n')) expect([line, [...line].length <= 100 || !/\s/.test(line.trim())]).toEqual([line, true]);
    expect(collapse(wrapped)).toBe(collapse(text));
    expect(wrapped.split('\n')).toContain(giant);
    expect(wrapped.split('\n')[0]).toBe('short line');
    expect(wrapText(wrapped)).toBe(wrapped);
    expect(wrapText('a'.repeat(100))).toBe('a'.repeat(100));
    expect(wrapText(`${'a'.repeat(50)} ${'b'.repeat(49)}`)).toBe(`${'a'.repeat(50)} ${'b'.repeat(49)}`);
    expect(wrapText(`${'a'.repeat(50)} ${'b'.repeat(50)}`)).toBe(`${'a'.repeat(50)}\n${'b'.repeat(50)}`);
    expect(wrapText('é'.repeat(60) + ' ' + 'é'.repeat(39))).toBe('é'.repeat(60) + ' ' + 'é'.repeat(39));
  });

  it('the page: no line of a <pre> over 100 columns but a one-word line; each text, whitespace collapsed, is the licence text', () => {
    write('node_modules/alpha/LICENSE', `${Array.from({length: 60}, (_, i) => `term<${i}>&`).join(' ')}\n${'y'.repeat(140)}`);
    const list = entries();
    const html = licencePage(list);
    expect(overlong(html)).toEqual([]);
    expect(preLines(html)).toContain('y'.repeat(140));
    const pres = [...html.matchAll(/<pre>([\s\S]*?)\n<\/pre>/g)].map(m => renderedLines(m[1]).join('\n'));
    expect(pres.map(collapse)).toEqual(list.map(e => collapse(e.text)));
  });

  it('deterministic: the same maps in another order give the same bytes; no date, no absolute path', () => {
    const a = licencePage(entries());
    const reversed = Object.fromEntries(Object.entries(RENDERED).reverse());
    expect(licencePage(licenceEntries(root, maps(reversed).reverse(), join(out, 'app')))).toBe(a);
    expect(a).not.toContain(repo);
    expect(a).not.toMatch(/20\d\d-\d\d-\d\d/);
  });

  it('licence-ids.json: the row removed → the build fails; the row set to LGPL-3.0-only → the build fails', () => {
    write(LICENCE_IDS, '{}\n');
    expect(fails()).toEqual(['beta@2.0.0 (node_modules/beta): has rendered code, no license field and no row in release/licence-ids.json — classify it there']);
    write(LICENCE_IDS, `${JSON.stringify({'beta@2.0.0': 'LGPL-3.0-only'})}\n`);
    expect(fails()).toEqual([`beta@2.0.0 (node_modules/beta): LGPL-3.0-only is outside the licence allowlist (${ALLOWED_LICENCES.join(', ')}) — adding to it is the owner's decision`]);
  });

  it('a rendered LGPL package fails the build; a package rendered 0 is never judged', () => {
    expect(fails({...RENDERED, 'node_modules/gamma/index.js': 1})).toEqual([`gamma@3.0.0 (node_modules/gamma): LGPL-3.0-only is outside the licence allowlist (${ALLOWED_LICENCES.join(', ')}) (its license field; release/licence-ids.json cannot override a license field the package has) — adding to it is the owner's decision`]);
  });

  it('licence-ids.json cannot override a license field the package has: an SPDX expression or a {type} object still fails, and says so', () => {
    write(LICENCE_IDS, `${JSON.stringify({'beta@2.0.0': 'Unlicense', 'zeta@0.1.0': 'MIT'})}\n`);
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'MIT OR Apache-2.0'});
    expect(fails()).toEqual([`zeta@0.1.0 (node_modules/zeta): MIT OR Apache-2.0 is outside the licence allowlist (${ALLOWED_LICENCES.join(', ')}) (its license field; release/licence-ids.json cannot override a license field the package has) — adding to it is the owner's decision`]);
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: {type: 'MIT'}});
    expect(fails()).toEqual(['zeta@0.1.0 (node_modules/zeta): its license field is not an SPDX string ({"type":"MIT"}); release/licence-ids.json cannot override a license field the package has — admitting it is the owner\'s decision']);
    // Positive control: the same row classifies the package once it has no license field.
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0'}, {LICENSE: 'Copyright (c) Zeta\nMIT text\n'});
    expect(Object.fromEntries(entries().map(e => [e.name, e]))['zeta']).toMatchObject({spdx: 'MIT', text: 'Copyright (c) Zeta\nMIT text'});
  });

  it('fails a licence it cannot show, a module it cannot name, a license field that is not a string', () => {
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'ISC'});
    expect(fails()).toEqual(['zeta@0.1.0 (node_modules/zeta): ships no licence file, and release/licence-texts/ISC.txt does not exist — the build cannot show its licence']);
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: {type: 'MIT'}});
    expect(fails()).toEqual(['zeta@0.1.0 (node_modules/zeta): its license field is not an SPDX string ({"type":"MIT"}); release/licence-ids.json cannot override a license field the package has — admitting it is the owner\'s decision']);
    pkg('node_modules/zeta', {name: 'zeta', version: '0.1.0', license: 'MIT'});
    expect(fails({...RENDERED, 'vendor/x.js': 1})).toEqual(['"vendor/x.js" has rendered code but is neither ours (src/, ../core/, ../web/, a root page) nor a package\'s — the licence page cannot name it']);
    expect(fails({...RENDERED, 'node_modules/nameless/index.js': 1})).toEqual(['"node_modules/nameless/index.js": no package.json with a name above it']);
  });

  it('the fonts: a file without an entry fails, a changed face fails, a missing face is INCONCLUSIVE', () => {
    writeFileSync(join(out, 'app', 'fonts', 'Other.woff2'), 'x');
    expect(fails()).toEqual(['fonts/Other.woff2 is in the package without a licence entry']);
    rmSync(join(out, 'app', 'fonts', 'Other.woff2'));
    writeFileSync(join(out, 'app', 'fonts', 'Geist-Variable.woff2'), 'x');
    expect(fails()).toEqual(['fonts/Geist-Variable.woff2 is not the geist@1.7.2 file its entry was recorded for']);
    rmSync(join(out, 'app', 'fonts', 'Geist-Variable.woff2'));
    expect(fails()).toEqual(['INCONCLUSIVE: fonts/Geist-Variable.woff2 missing from the package — the font entry would describe nothing']);
  });

  it('INCONCLUSIVE: a map without its rendered section, a malformed length, no module of ours rendered, a missing map', () => {
    expect(() => renderedModules([['app.modules.json', {chunks: {}}]])).toThrow('INCONCLUSIVE: app.modules.json has no rendered section');
    expect(() => renderedModules([['app.modules.json', {rendered: {'a.js': {'src/a.ts': -1}}}]])).toThrow('INCONCLUSIVE: app.modules.json: a.js: "src/a.ts" has rendered length -1');
    expect(() => licenceEntries(root, [['app.modules.json', {rendered: {'a.js': {'node_modules/beta/index.js': 1}}}]], join(out, 'app'))).toThrow('INCONCLUSIVE: no module of ours has rendered code');
    expect(() => buildLicencePage(root, out)).toThrow(`INCONCLUSIVE: ${MODULE_MAPS[0]} is missing`);
  });

  it('what counts as ours, a package, skipped, or unknown', () => {
    expect(['src/a.ts', '../core/x.ts', '../web/src/ui/A.tsx', 'popup.html'].map(moduleKind)).toEqual(['ours', 'ours', 'ours', 'ours']);
    expect(['\0rolldown/runtime.js', '__vite-browser-external', '__vite-browser-external:crypto'].map(moduleKind)).toEqual(['skip', 'skip', 'skip']);
    expect(['node_modules/a/i.js', '../node_modules/a/i.js'].map(moduleKind)).toEqual(['package', 'package']);
    expect(['vendor/x.js', 'sub/page.html', '../other/x.ts'].map(moduleKind)).toEqual(['unknown', 'unknown', 'unknown']);
  });
});

describe('the licence gate (B1e §4.2, E16)', () => {
  const clean = () => [
    ['app.modules.json', {chunks: {'background.js': ['node_modules/@solana/web3.js/lib/index.browser.esm.js']}, rendered: {'background.js': {'node_modules/@solana/web3.js/lib/index.browser.esm.js': 100}}}],
  ];

  it('passes a build where rpc-websockets resolves to the stub and the stub renders nothing', () => {
    expect(rpcWebsocketsViolations(clean())).toEqual([]);
    const [[name, map]] = clean();
    map.chunks['background.js'].push(RPC_WEBSOCKETS_STUB);
    map.rendered['background.js'][RPC_WEBSOCKETS_STUB] = 0;
    expect(rpcWebsocketsViolations([[name, map]])).toEqual([]);
  });

  it('fails when the stub renders (something constructs a Connection), when the package is in the maps at all (the alias is gone), when it renders', () => {
    const [[name, map]] = clean();
    map.rendered['background.js'][RPC_WEBSOCKETS_STUB] = 325;
    expect(rpcWebsocketsViolations([[name, map]])).toEqual([`app.modules.json: background.js renders 325 bytes of ${RPC_WEBSOCKETS_STUB} — something constructs a Connection (a socket client); nothing the extension bundles may`]);
    const [[name2, map2]] = clean();
    map2.chunks['background.js'].push('node_modules/rpc-websockets/dist/index.browser.mjs');
    map2.rendered['background.js']['node_modules/rpc-websockets/dist/index.browser.mjs'] = 0;
    expect(rpcWebsocketsViolations([[name2, map2]])).toEqual([`app.modules.json: background.js carries "node_modules/rpc-websockets/dist/index.browser.mjs" — rpc-websockets must resolve to ${RPC_WEBSOCKETS_STUB} (the alias)`]);
    map2.rendered['background.js']['node_modules/rpc-websockets/dist/index.browser.mjs'] = 12;
    expect(rpcWebsocketsViolations([[name2, map2]])).toContain('app.modules.json: background.js renders 12 bytes of "node_modules/rpc-websockets/dist/index.browser.mjs" — no LGPL code may ship');
  });

  it('a map without its rendered section is INCONCLUSIVE', () => {
    expect(rpcWebsocketsViolations([['app.relay.modules.json', {chunks: {}}]])).toEqual(['INCONCLUSIVE: app.relay.modules.json has no rendered section — what rpc-websockets renders is unknown']);
  });

  it('a map without its chunks section is INCONCLUSIVE — never a vacuous "in no chunk" (review M1)', () => {
    const [[name, map]] = clean();
    for (const chunks of [undefined, null, 'background.js']) {
      expect(rpcWebsocketsViolations([[name, {...map, chunks}]])).toEqual(['INCONCLUSIVE: app.modules.json has no chunks section — whether rpc-websockets is in a chunk is unknown']);
    }
    // Positive control: the same map with its chunks passes.
    expect(rpcWebsocketsViolations([[name, map]])).toEqual([]);
  });

  it('each package carries exactly the page its build’s maps give: a hand edit or a missing copy fails', () => {
    const repo = mkdtempSync(join(tmpdir(), 'licence-gate-'));
    try {
      const root = join(repo, 'extension');
      const out = join(root, 'dist');
      mkdirSync(join(root, 'release'), {recursive: true});
      writeFileSync(join(repo, 'LICENSE'), 'BSL\n');
      writeFileSync(join(root, LICENCE_IDS), '{}\n');
      mkdirSync(join(root, 'public/fonts'), {recursive: true});
      writeFileSync(join(root, FONTS.licence), 'OFL\n');
      for (const d of ['app', 'chrome', 'firefox']) {
        mkdirSync(join(out, d, 'fonts'), {recursive: true});
        for (const f of Object.keys(FONTS.files)) copyFileSync(join(ROOT, 'public/fonts', f), join(out, d, 'fonts', f));
      }
      for (const f of MODULE_MAPS) writeFileSync(join(out, f), JSON.stringify({chunks: {'x.js': ['src/x.ts']}, rendered: {'x.js': {'src/x.ts': 1}}}));
      const page = buildLicencePage(root, out);
      for (const d of ['app', 'chrome', 'firefox']) writeFileSync(join(out, d, 'licenses.html'), page);
      expect(licencePageViolations(root, out)).toEqual([]);
      writeFileSync(join(out, 'chrome', 'licenses.html'), page.replace('BSL', 'MIT'));
      rmSync(join(out, 'firefox', 'licenses.html'));
      expect(licencePageViolations(root, out)).toEqual(["chrome/licenses.html is not the page this build's module maps give — rebuild; never edit it by hand", 'firefox/licenses.html is missing']);
      rmSync(join(out, MODULE_MAPS[1]));
      expect(licencePageViolations(root, out)).toEqual([`INCONCLUSIVE: ${MODULE_MAPS[1]} is missing next to ${join(out, 'app')} — the licence page needs every module map`]);
    } finally {
      rmSync(repo, {recursive: true, force: true});
    }
  });
});

describe('the committed licence inputs (B1e §4.2 items 4–6, E15)', () => {
  it('the owner’s allowlist, exactly', () => {
    expect(ALLOWED_LICENCES).toEqual(['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'OFL-1.1', 'Unlicense']);
  });

  it('licence-ids.json has the one row today: text-encoding-utf-8@1.0.2 → Unlicense', () => {
    expect(JSON.parse(readFileSync(join(ROOT, LICENCE_IDS), 'utf8'))).toEqual({'text-encoding-utf-8@1.0.2': 'Unlicense'});
  });

  it('the fonts are geist@1.7.2’s files, and public/fonts/LICENSE.txt is that release’s LICENSE.txt', () => {
    for (const [f, digest] of Object.entries(FONTS.files)) expect([f, sha256(readFileSync(join(ROOT, 'public/fonts', f)))]).toEqual([f, digest]);
    expect(sha256(readFileSync(join(ROOT, FONTS.licence)))).toBe('930853ee1daa68554d9e35c8a9175affb74f699fad9a5da6ee5ebe76379d9137');
  });
});
```

Create `extension/scripts/__tests__/check-links.test.mjs`:

```js
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {LINKS, SKIPPED, linkViolations, packageFiles, urlStrings} from '../check-links.mjs';

// B1e §4.3 (I1, R8): the link gate over a package written for the test in the shapes of the real files (the real
// packages are read by scripts/__tests__/presaleBuilds.test.mjs).
const PACKAGE = {
  'manifest.json': JSON.stringify({host_permissions: ['https://api.noc-tura.io/*', 'https://wallet.noc-tura.io/*'], content_security_policy: {extension_pages: "default-src 'self'; connect-src https://api.noc-tura.io; base-uri 'none'"}}),
  'background.js': 'const B="https://api.noc-tura.io/api/v1",R=`https://api.noc-tura.io/api/v1/rpc`;throw Error("crypto.getRandomValues() not supported. See https://github.com/uuidjs/uuid#getrandomvalues-not-supported");',
  'assets/mount-1.js': 'const E="https://solscan.io/tx/";const T={terms:"https://noc-tura.io/extension/terms",privacy:"https://noc-tura.io/extension/privacy",help:"https://noc-tura.io/extension/help"};c("http://www.w3.org/2000/svg","svg")',
  'assets/addressBook-1.js': '"https://reactjs.org/docs/error-decoder.html?invariant="+e;["http://www.w3.org/1999/xhtml","http://www.w3.org/1999/xlink","http://www.w3.org/XML/1998/namespace","http://www.w3.org/1998/Math/MathML"]',
  'unlock.html': '<a href="https://noc-tura.io/extension/terms" target="_blank">Terms</a>',
  'licenses.html': '<pre>http://www.apache.org/licenses/LICENSE-2.0 https://paulmillr.com</pre>',
  'assets/mount-1.css': '.a{color:red}',
  'fonts/LICENSE.txt': 'http://scripts.sil.org/OFL',
};
const files = (over = {}) =>
  Object.entries({...PACKAGE, ...over})
    .filter(([, text]) => text !== undefined)
    .map(([path, text]) => ({path, text}));

describe('the link gate (B1e §4.3)', () => {
  it('passes a package that names only the table’s strings, each where it may be, with the four links present', () => {
    expect(linkViolations(files(), false)).toEqual([]);
    expect(linkViolations(files(), true)).toEqual([]);
  });

  it('extracts with the spec’s pattern: quotes, backquotes, <, >, ), \\, ; and whitespace end a URL; a template interpolation is folded', () => {
    expect(urlStrings('a="https://x.example/a"b`wss://y.example/b`c<ftp://z.example/c>d(http://q.example/d)e https://r.example/e;f')).toEqual([
      'https://x.example/a',
      'wss://y.example/b',
      'ftp://z.example/c',
      'http://q.example/d',
      'https://r.example/e',
    ]);
    expect(urlStrings('`https://noc-tura.io?ref=${e}`, `https://noc-tura.io?ref=${tn}`')).toEqual(['https://noc-tura.io?ref=${}', 'https://noc-tura.io?ref=${}']);
  });

  it.each([
    ['a planted https://evil.example/ in a page chunk', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};fetch("https://evil.example/")`}, 'assets/mount-1.js names "https://evil.example/" — a URL the link table does not name'],
    ['a planted wss://evil.example', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};new WebSocket("wss://evil.example")`}, 'assets/mount-1.js names "wss://evil.example" — a URL the link table does not name'],
    ['the coordinator named by a page chunk', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x("https://api.noc-tura.io/api/v1")`}, 'assets/mount-1.js names "https://api.noc-tura.io/api/v1" — the coordinator base (API_BASE), not allowed in this file'],
    ['the RP ID host named by the background', {'background.js': `${PACKAGE['background.js']};fetch("https://wallet.noc-tura.io/*")`}, 'background.js names "https://wallet.noc-tura.io/*" — host permission (the passkey RP ID), not allowed in this file'],
    ['an inert string changed by one character', {'background.js': PACKAGE['background.js'].replace('getrandomvalues-not-supported', 'getrandomvalues-not-supportex')}, 'background.js names "https://github.com/uuidjs/uuid#getrandomvalues-not-supportex" — a URL the link table does not name'],
    ['a navigable link with a dynamic suffix', {'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x(\`https://noc-tura.io/extension/terms\${q}\`)`}, 'assets/mount-1.js names "https://noc-tura.io/extension/terms${}" — a URL the link table does not name'],
    ['a planted http:// URL in CSS', {'assets/mount-1.css': '.a{background:url(http://evil.example/x.png)}'}, 'assets/mount-1.css names "http://evil.example/x.png" — a URL the link table does not name'],
    ['the same licenses.html below the root (skipped by name at the root only)', {'sub/licenses.html': PACKAGE['licenses.html']}, 'sub/licenses.html names "http://www.apache.org/licenses/LICENSE-2.0" — a URL the link table does not name'],
  ])('fails %s', (_, over, problem) => {
    expect(linkViolations(files(over), false)).toContain(problem);
  });

  it('a known limit, not a pass (plan Review Focus 2): a URL never written whole is not seen — the scheme split from its "://", a scheme-relative //host, a base64 text', () => {
    const hidden = 'x("http"+"s://evil.example/a");y("//evil.example/b");z(atob("aHR0cHM6Ly9ldmlsLmV4YW1wbGUvYw=="))';
    expect(urlStrings(hidden)).toEqual([]);
    expect(linkViolations(files({'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};${hidden}`}), false)).toEqual([]);
    // Controls: written whole it fails, and so does a whole scheme with the host added at run time.
    expect(linkViolations(files({'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x("https://evil.example/a")`}), false)).toEqual(['assets/mount-1.js names "https://evil.example/a" — a URL the link table does not name']);
    expect(linkViolations(files({'assets/mount-1.js': `${PACKAGE['assets/mount-1.js']};x("https://"+h)`}), false)).toEqual(['assets/mount-1.js names "https://" — a URL the link table does not name']);
  });

  it('a link the user is given must be present: privacy removed → fails', () => {
    expect(linkViolations(files({'assets/mount-1.js': PACKAGE['assets/mount-1.js'].replace(',privacy:"https://noc-tura.io/extension/privacy"', '')}), false)).toEqual([
      'https://noc-tura.io/extension/privacy (Privacy Policy (#1, #38)) is in no file — the link the user is given is gone',
    ]);
  });

  it('the referral invite link is the presale build’s only — in the store build it fails', () => {
    const referral = {'assets/referral-1.js': 'function p(e){return`https://noc-tura.io?ref=${e}`}'};
    expect(linkViolations(files(referral), true)).toEqual([]);
    expect(linkViolations(files(referral), false)).toEqual(['assets/referral-1.js names "https://noc-tura.io?ref=${}" — a URL the link table does not name']);
  });

  it('licenses.html is skipped by name — the skip is the only reason it passes; .txt files are not read', () => {
    expect(SKIPPED).toEqual(['licenses.html']);
    expect(linkViolations(files(), false, {skipped: []})).toEqual([
      'licenses.html names "http://www.apache.org/licenses/LICENSE-2.0" — a URL the link table does not name',
      'licenses.html names "https://paulmillr.com" — a URL the link table does not name',
    ]);
    expect(linkViolations(files({'licenses.html.copy.html': PACKAGE['licenses.html']}), false)).toHaveLength(2);
  });

  it('reads an SVG document too: a link planted in one fails (review M5); a .txt or a font is still not read', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="https://evil.example/">x</a></svg>';
    expect(linkViolations(files({'icons/x.svg': svg}), false)).toEqual([
      'icons/x.svg names "http://www.w3.org/2000/svg" — inert: react-dom and React elements, an XML namespace identifier, not allowed in this file',
      'icons/x.svg names "https://evil.example/" — a URL the link table does not name',
    ]);
    expect(linkViolations(files({'icons/x.txt': svg, 'fonts/x.woff2': svg}), false)).toEqual([]);
  });

  it('the table is a parameter for the controls: one inert string changed by one character → the package fails', () => {
    const links = LINKS.map(l => (l.url === 'http://www.w3.org/1999/xlink' ? {...l, url: 'http://www.w3.org/1999/xlinx'} : l));
    expect(linkViolations(files(), false, {links})).toEqual(['assets/addressBook-1.js names "http://www.w3.org/1999/xlink" — a URL the link table does not name']);
  });

  it('a package with no URL string at all is INCONCLUSIVE, never a pass', () => {
    expect(linkViolations([{path: 'background.js', text: 'x'}], false)).toEqual(['INCONCLUSIVE: no URL string in the package — the extraction broke']);
  });

  it('reads every file of a package directory, with / paths', () => {
    const dir = mkdtempSync(join(tmpdir(), 'links-'));
    try {
      for (const [path, text] of Object.entries(PACKAGE)) {
        mkdirSync(dirname(join(dir, path)), {recursive: true});
        writeFileSync(join(dir, path), text);
      }
      expect(linkViolations(packageFiles(dir), false)).toEqual([]);
      expect(packageFiles(dir).map(f => f.path)).toEqual(Object.keys(PACKAGE).sort());
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  });
});
```

Create `extension/scripts/__tests__/rpcWebsockets.test.mjs`:

```js
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'vite';
import {RPC_WEBSOCKETS_STUB, rpcWebsocketsAlias} from '../rpcWebsockets.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const WEB3 = join(ROOT, 'node_modules/@solana/web3.js/lib/index.browser.esm.js');
const BUILD_MS = 120_000;

// B1e §4.2 (E16): @solana/web3.js's browser build — the file the extension bundles — bundled under the extension's own
// alias, then run: what the extension uses works, and a Connection (the one maker of a socket client) throws the stub's
// error, which proves the alias took.
let dir;
let probe;
beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'noctura-rpc-ws-'));
  const entry = join(dir, 'probe.mjs');
  writeFileSync(
    entry,
    [
      `import {Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} from ${JSON.stringify(WEB3)};`,
      `import {CommonClient, WebSocket} from 'rpc-websockets';`,
      'export {Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, CommonClient, WebSocket};',
    ].join('\n'),
  );
  await build({
    configFile: false,
    logLevel: 'silent',
    root: dir,
    resolve: {alias: rpcWebsocketsAlias(ROOT)},
    build: {outDir: join(dir, 'out'), lib: {entry, formats: ['es'], fileName: () => 'probe.mjs'}, minify: false, target: 'es2022'},
  });
  probe = await import(pathToFileURL(join(dir, 'out', 'probe.mjs')).href);
}, BUILD_MS);
afterAll(() => rmSync(dir, {recursive: true, force: true}));

describe('rpc-websockets resolves to the stub (B1e §4.2, E16)', () => {
  it('names the stub inside the package', () => {
    expect(rpcWebsocketsAlias(ROOT)).toEqual([{find: /^rpc-websockets$/, replacement: join(ROOT, RPC_WEBSOCKETS_STUB)}]);
  });

  it('web3.js evaluates under it, and what the extension uses works: PublicKey, SystemProgram, TransactionMessage, VersionedTransaction', () => {
    const {Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction} = probe;
    const from = Keypair.fromSeed(new Uint8Array(32).fill(7));
    const to = new PublicKey('11111111111111111111111111111112');
    const message = new TransactionMessage({
      payerKey: from.publicKey,
      recentBlockhash: '11111111111111111111111111111111',
      instructions: [SystemProgram.transfer({fromPubkey: from.publicKey, toPubkey: to, lamports: 1n})],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    tx.sign([from]);
    const back = VersionedTransaction.deserialize(tx.serialize());
    expect(back.message.staticAccountKeys.map(k => k.toBase58())).toEqual([from.publicKey.toBase58(), to.toBase58(), SystemProgram.programId.toBase58()]);
    expect(back.signatures[0]).toEqual(tx.signatures[0]);
  });

  it('a Connection — the one thing that makes a socket client — throws the stub’s error', () => {
    expect(() => new probe.Connection('http://127.0.0.1:9')).toThrow('rpc-websockets is not part of Noctura: the extension opens no WebSocket');
  });

  it('exactly two exports: CommonClient a class that throws when constructed, WebSocket a function that throws when called', () => {
    const {CommonClient, WebSocket} = probe;
    expect(Function.prototype.toString.call(CommonClient)).toMatch(/^class\b/);
    class Sub extends CommonClient {}
    expect(() => new Sub()).toThrow('rpc-websockets is not part of Noctura');
    expect(() => new CommonClient()).toThrow('rpc-websockets is not part of Noctura');
    expect(typeof WebSocket).toBe('function');
    expect(() => WebSocket('ws://127.0.0.1:9')).toThrow('rpc-websockets is not part of Noctura');
  });
});
```

Create `extension/src/vault/__tests__/rpId.test.ts`:

```ts
import {RP_ID} from '../passkey';

// B1e §5.6 (N4, E17): the passkey RP ID is claimed through a host permission — "an extension may claim an RP ID only for
// a host it has permission for" — so dropping the seemingly unused `https://wallet.noc-tura.io/*` would silently break
// every enrolled passkey. The manifest source is plain JS (manifest/source.mjs): read through Vite's glob import and
// checked for shape here, so a change to its form fails instead of passing.
const source = Object.values(import.meta.glob('../../../manifest/source.mjs', {eager: true}))[0];
const hostPermissions = (): string[] => {
  const list = (source as {HOST_PERMISSIONS?: unknown} | undefined)?.HOST_PERMISSIONS;
  if (!Array.isArray(list)) throw new Error('manifest/source.mjs exports no HOST_PERMISSIONS list');
  return list.map(entry => {
    const value = (entry as {value?: unknown} | null)?.value;
    if (typeof value !== 'string') throw new Error('a HOST_PERMISSIONS entry has no string value');
    return value;
  });
};

describe('the passkey RP ID (B1e §5.6)', () => {
  it('is wallet.noc-tura.io, frozen by 1.0.0 (E17)', () => {
    expect(RP_ID).toBe('wallet.noc-tura.io');
  });

  it('is a host the manifest claims: `https://${RP_ID}/*` is a HOST_PERMISSIONS value', () => {
    expect(hostPermissions()).toContain(`https://${RP_ID}/*`);
  });

  it('the pin reads the real list (positive control): the coordinator’s permission is in it, an invented host is not', () => {
    expect(hostPermissions()).toContain('https://api.noc-tura.io/*');
    expect(hostPermissions()).not.toContain('https://passkey.noc-tura.io/*');
  });
});
```

Create `extension/src/app/__tests__/about.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {fireEvent, screen, within} from '@testing-library/react';
import {ABOUT_TEXT} from '../screens/About';
import {LICENCES_PAGE, NOCTURA_PAGES} from '../../shared/links';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {renderApp} from './appHarness';

// B1e §4.1, §4.4: #38's rows as drawn (index.html #38 — Legal: Terms of Service, Privacy Policy, Open-source licenses;
// Resources: Help & support, then noc-tura.io as text). Every link opens a new tab — `target="_blank"`,
// `rel="noopener noreferrer"` — and nothing in the popup fetches it.
const SELECTORS = selectorsOf(UI_SHEETS);
const openAbout = async () => {
  const w = await renderApp();
  fireEvent.click(await screen.findByRole('button', {name: 'Settings'}));
  fireEvent.click(await screen.findByText('About Noctura'));
  await screen.findByText('© 2026 Noctura');
  return w;
};
const linkRow = (title: string) => screen.getByRole('link', {name: `${title}${ABOUT_TEXT.newTab}`});

describe('#38 about: the legal and help rows (B1e §4.1)', () => {
  it('Legal then Resources, the rows in the design’s order, each a link but noc-tura.io', async () => {
    await openAbout();
    expect([...document.querySelectorAll('.app-about-body > .noc-overline')].map(o => o.textContent)).toEqual([ABOUT_TEXT.legal, ABOUT_TEXT.resources]);
    const lists = [...document.querySelectorAll('.app-about-body > .s7-list')];
    expect(lists.map(l => [...l.querySelectorAll('.s7-row')].map(r => r.firstElementChild?.nextElementSibling?.firstChild?.textContent))).toEqual([
      ['Terms of Service', 'Privacy Policy', 'Open-source licenses'],
      ['Help & support', 'noc-tura.io'],
    ]);
    expect(screen.getAllByRole('link')).toHaveLength(4);
    expect(within(lists[1] as HTMLElement).getByText('noc-tura.io').closest('a')).toBeNull();
    expect(unstyledClasses(document.querySelector('.screen') as HTMLElement, SELECTORS)).toEqual([]);
  });

  it.each([
    [ABOUT_TEXT.terms, NOCTURA_PAGES.terms, 'https://noc-tura.io/extension/terms'],
    [ABOUT_TEXT.privacy, NOCTURA_PAGES.privacy, 'https://noc-tura.io/extension/privacy'],
    [ABOUT_TEXT.help, NOCTURA_PAGES.help, 'https://noc-tura.io/extension/help'],
    [ABOUT_TEXT.licences, LICENCES_PAGE, 'licenses.html'],
  ])('%s opens %s in a new tab, noopener noreferrer', async (title, href, literal) => {
    await openAbout();
    const a = linkRow(title);
    expect(href).toBe(literal);
    expect(a.getAttribute('href')).toBe(literal);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('the external rows carry the drawn arrow-up-right, the licences row the in-app chevron', async () => {
    await openAbout();
    const chev = (title: string) => linkRow(title).querySelector('.s7-chev polyline')?.getAttribute('points') ?? linkRow(title).querySelector('.s7-chev path')?.getAttribute('d');
    const arrow = chev(ABOUT_TEXT.terms);
    expect(chev(ABOUT_TEXT.privacy)).toBe(arrow);
    expect(chev(ABOUT_TEXT.help)).toBe(arrow);
    expect(chev(ABOUT_TEXT.licences)).toBe('9 18 15 12 9 6');
    expect(arrow).not.toBe('9 18 15 12 9 6');
  });

  it('a click is the browser’s own: the app neither handles it (not prevented, no message, no page opened) nor fetches', async () => {
    const sent: unknown[] = [];
    const w = await renderApp({spy: m => sent.push(m)});
    fireEvent.click(await screen.findByRole('button', {name: 'Settings'}));
    fireEvent.click(await screen.findByText('About Noctura'));
    await screen.findByText('© 2026 Noctura');
    const before = sent.length;
    // The browser's default action (a new tab) is what follows; happy-dom would instead fetch the href, so the test
    // records whether the app prevented it, then prevents it itself, last of all listeners.
    const seen: boolean[] = [];
    const last = (e: Event) => {
      seen.push(e.defaultPrevented);
      e.preventDefault();
    };
    window.addEventListener('click', last);
    try {
      for (const title of [ABOUT_TEXT.terms, ABOUT_TEXT.privacy, ABOUT_TEXT.licences, ABOUT_TEXT.help]) fireEvent.click(linkRow(title));
    } finally {
      window.removeEventListener('click', last);
    }
    expect(seen).toEqual([false, false, false, false]);
    expect(sent.slice(before)).toEqual([]);
    expect(w.platform.opened).toEqual([]);
  });
});
```

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs` (the static page; `pageViolations`):

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index a4f8d54..aa57f30 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -3,8 +3,8 @@ import {tmpdir} from 'node:os';
 import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {
-  ENTRIES,
-  bundleViolations, contentStorageViolations, htmlViolations, listSourceFiles, manifestViolations, nonVaultModuleViolations, bundledWebAuthnViolations, sourceViolations, vaultPageModuleViolations, vaultPageViolations, webAuthnViolations,
+  ENTRIES, STATIC_PAGES, STATIC_PAGE_REFUSED,
+  bundleViolations, contentStorageViolations, htmlViolations, pageViolations, staticPageViolations, listSourceFiles, manifestViolations, nonVaultModuleViolations, bundledWebAuthnViolations, sourceViolations, vaultPageModuleViolations, vaultPageViolations, webAuthnViolations,
   BIP39_MARKER, DERIVATION_MARKER, KDF_MARKER, PASSKEY_MARKER, REACT_MARKER, VAULT_MARKER, WEBAUTHN_MARKER, WORDLIST_MARKER,
 } from '../check-vault-isolation.mjs';
 import {render} from '../../manifest/source.mjs';
@@ -1850,3 +1850,61 @@ describe('plan 2: the real vault page reaches every screen it builds (positive c
     );
   });
 });
+
+// B1e §4.2 (I9, N1): every page of a package is an entry or a static page at the root; a static page (licenses.html)
+// links, loads and runs nothing.
+describe('vault isolation (the pages of a package; the static page)', () => {
+  let dir;
+  const write = (name, text) => {
+    mkdirSync(dirname(join(dir, name)), {recursive: true});
+    writeFileSync(join(dir, name), text);
+  };
+  const PAGE = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Open-source licenses · Noctura</title>\n</head>\n<body>\n<h1>Open-source licenses</h1>\n<p>x</p>\n<h2>a 1.0.0</h2>\n<p>MIT</p>\n<pre>&lt;http://unlicense.org/&gt; one = two, based on a</pre>\n</body>\n</html>\n';
+  beforeEach(() => {
+    dir = mkdtempSync(join(tmpdir(), 'vault-iso-pages-'));
+    for (const page of Object.keys(ENTRIES)) write(page, '<html></html>');
+    write('licenses.html', PAGE);
+  });
+  afterEach(() => rmSync(dir, {recursive: true, force: true}));
+
+  it('passes the four entries and the licence page as the generator writes it (escaped text, prose with "on" and "=")', () => {
+    expect(STATIC_PAGES).toEqual(['licenses.html']);
+    expect(STATIC_PAGE_REFUSED).toEqual(['<a', 'href=', '<script', '<link', '<style', 'style=', '<iframe', '<form']);
+    expect(pageViolations(dir)).toEqual([]);
+  });
+
+  it('a second, unknown page in the package fails; so does a page below the root', () => {
+    write('extra.html', '<p>x</p>');
+    write('assets/x.html', '<p>x</p>');
+    expect(pageViolations(dir)).toEqual([
+      'assets/x.html is a page below the package root — every page is an entry (ENTRIES) or a static page (STATIC_PAGES) at the root',
+      'extra.html is an unknown page — neither an entry (popup.html, wallet.html, unlock.html, approve.html) nor a static page (licenses.html)',
+    ]);
+  });
+
+  it('a missing licenses.html is INCONCLUSIVE, never a pass', () => {
+    rmSync(join(dir, 'licenses.html'));
+    expect(pageViolations(dir)).toEqual(['INCONCLUSIVE: licenses.html is missing — the static-page rule would pass trivially']);
+  });
+
+  it.each([
+    ['<script src="x.js"></script>', ['licenses.html contains <script — a static page links, loads and runs nothing', 'licenses.html has a <script> — a static page is headings, paragraphs and <pre> text only']],
+    ['<style>body{color:red}</style>', ['licenses.html contains <style — a static page links, loads and runs nothing', 'licenses.html has a <style> — a static page is headings, paragraphs and <pre> text only']],
+    ['<a href="https://evil.example/">x</a>', ['licenses.html contains <a — a static page links, loads and runs nothing', 'licenses.html contains href= — a static page links, loads and runs nothing', 'licenses.html has a <a> — a static page is headings, paragraphs and <pre> text only']],
+    ['<LINK REL=stylesheet HREF=x.css>', ['licenses.html contains href= — a static page links, loads and runs nothing', 'licenses.html contains <link — a static page links, loads and runs nothing', 'licenses.html has a <link> — a static page is headings, paragraphs and <pre> text only']],
+    ['<p style="color:red">x</p>', ['licenses.html contains style= — a static page links, loads and runs nothing', 'licenses.html: <p> has a style attribute — not one plain text needs']],
+    ['<p onclick="x()">x</p>', ['licenses.html has an on…= attribute — a static page runs nothing', 'licenses.html: <p> has a onclick attribute — not one plain text needs']],
+    ['<pre/onmouseover=x>y</pre>', ['licenses.html has an on…= attribute — a static page runs nothing', 'licenses.html: <pre> has a onmouseover attribute — not one plain text needs']],
+    ['<iframe src="x"></iframe>', ['licenses.html contains <iframe — a static page links, loads and runs nothing', 'licenses.html has a <iframe> — a static page is headings, paragraphs and <pre> text only']],
+    ['<form action="x"></form>', ['licenses.html contains <form — a static page links, loads and runs nothing', 'licenses.html has a <form> — a static page is headings, paragraphs and <pre> text only']],
+    ['<meta http-equiv="refresh" content="0;url=https://evil.example/">', ['licenses.html: <meta> has a http-equiv attribute — not one plain text needs', 'licenses.html: <meta> has a content attribute — not one plain text needs', 'licenses.html: a <meta> other than charset="utf-8"']],
+    ['<img src="x.png">', ['licenses.html has a <img> — a static page is headings, paragraphs and <pre> text only']],
+  ])('refuses %s planted in licenses.html', (planted, problems) => {
+    write('licenses.html', PAGE.replace('<p>x</p>', planted));
+    expect(pageViolations(dir)).toEqual(problems);
+  });
+
+  it('the rule is the same function the page gate applies', () => {
+    expect(staticPageViolations('licenses.html', PAGE)).toEqual([]);
+  });
+});
```

Modify `extension/scripts/__tests__/presaleBuilds.test.mjs` (the real builds: production, the licence page, the link gate with and without its skip, the static-page rule):

```diff
diff --git a/extension/scripts/__tests__/presaleBuilds.test.mjs b/extension/scripts/__tests__/presaleBuilds.test.mjs
index 431c144..29ce81d 100644
--- a/extension/scripts/__tests__/presaleBuilds.test.mjs
+++ b/extension/scripts/__tests__/presaleBuilds.test.mjs
@@ -4,6 +4,8 @@ import {tmpdir} from 'node:os';
 import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {checkNoPresale} from '../check-no-presale.mjs';
+import {linkViolations, packageFiles} from '../check-links.mjs';
+import {pageViolations} from '../check-vault-isolation.mjs';
 import {PRESALE_ENTRIES} from '../presaleSwitch.mjs';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
@@ -19,10 +21,13 @@ const modulesOf = dir => {
   }
   return out;
 };
+// B1e-1 Task 6: vitest sets NODE_ENV=test, and Vite keeps a NODE_ENV it finds — the builds here were React's development
+// build until it was removed from their environment. They are the packages `node scripts/build.mjs` makes now.
+const BUILD_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_ENV'));
 beforeAll(() => {
   for (const [name, args] of [['on', []], ['off', ['--no-presale']]]) {
     const dir = mkdtempSync(join(tmpdir(), `presale-build-${name}-`));
-    execFileSync('node', ['scripts/build.mjs', dir, ...args], {cwd: ROOT, stdio: 'pipe'});
+    execFileSync('node', ['scripts/build.mjs', dir, ...args], {cwd: ROOT, stdio: 'pipe', env: BUILD_ENV});
     builds[name] = {dir, modules: modulesOf(dir), features: JSON.parse(readFileSync(join(dir, 'app.features.json'), 'utf8'))};
   }
 }, BUILD_MS);
@@ -91,3 +96,94 @@ describe('the two builds', () => {
     }
   });
 });
+
+// B1e §4.2–§4.4: the licence page and the link gate on the real packages of both builds. The packages with rendered code
+// are derived here from the maps by a walk of this test's own, not by scripts/licences.mjs.
+const renderedPackages = dir => {
+  const out = new Set();
+  for (const f of readdirSync(dir).filter(f => /^app(\.[a-z]+)?\.modules\.json$/.test(f))) {
+    for (const modules of Object.values(JSON.parse(readFileSync(join(dir, f), 'utf8')).rendered)) {
+      for (const [id, length] of Object.entries(modules)) {
+        if (length === 0 || !id.includes('node_modules/')) continue;
+        for (let d = dirname(join(ROOT, id)); d.includes('node_modules'); d = dirname(d)) {
+          const file = join(d, 'package.json');
+          const json = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
+          if (typeof json.name === 'string') {
+            out.add(`${json.name} ${json.version}`);
+            break;
+          }
+        }
+      }
+    }
+  }
+  return [...out].sort();
+};
+const headings = html => [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1].replace(/&amp;/g, '&'));
+
+describe('the licence page and the link gate on the real builds (B1e §4.2–§4.4)', () => {
+  it('the builds are production builds (React’s production error decoder, none of its development warnings)', () => {
+    for (const b of Object.values(builds)) {
+      const files = packageFiles(join(b.dir, 'chrome'));
+      expect(files.some(f => f.text.includes('https://reactjs.org/docs/error-decoder.html?invariant='))).toBe(true);
+      expect(files.some(f => f.text.includes('https://reactjs.org/link/'))).toBe(false);
+    }
+  });
+
+  it('each build carries one licenses.html — the same file in app/, chrome/ and firefox/', () => {
+    for (const b of Object.values(builds)) {
+      const [app, chrome, firefox] = ['app', 'chrome', 'firefox'].map(d => readFileSync(join(b.dir, d, 'licenses.html'), 'utf8'));
+      expect(chrome).toBe(app);
+      expect(firefox).toBe(app);
+    }
+  });
+
+  it('lists Noctura, then exactly the packages with rendered code and the Geist fonts — no other', () => {
+    for (const b of Object.values(builds)) {
+      const listed = headings(readFileSync(join(b.dir, 'app', 'licenses.html'), 'utf8'));
+      expect(listed[0]).toBe('Noctura');
+      expect(listed.filter(h => h !== 'Noctura' && h !== 'geist 1.7.2').sort()).toEqual(renderedPackages(b.dir));
+      expect(listed).toContain('geist 1.7.2');
+      expect(listed).toContain('@solana/web3.js 1.99.0');
+    }
+  });
+
+  it('rpc-websockets is in neither build’s maps (the alias took), and text-encoding-utf-8 1.0.2 ships under the Unlicense', () => {
+    for (const b of Object.values(builds)) {
+      expect([...b.modules].filter(id => id.includes('node_modules/rpc-websockets/'))).toEqual([]);
+      const html = readFileSync(join(b.dir, 'app', 'licenses.html'), 'utf8');
+      expect(html).toContain('<h2>text-encoding-utf-8 1.0.2</h2>\n<p>Unlicense</p>');
+      expect(html).not.toContain('rpc-websockets');
+      expect(html).not.toContain('LGPL');
+    }
+  });
+
+  it('the link gate passes the real packages; with its skip removed it fails on the real licenses.html, and only there', () => {
+    for (const b of Object.values(builds)) {
+      for (const browser of ['chrome', 'firefox']) {
+        const files = packageFiles(join(b.dir, browser));
+        expect([b.features.presale, browser, linkViolations(files, b.features.presale)]).toEqual([b.features.presale, browser, []]);
+        const unskipped = linkViolations(files, b.features.presale, {skipped: []});
+        expect(unskipped.length).toBeGreaterThan(0);
+        expect(unskipped.filter(p => !p.startsWith('licenses.html names '))).toEqual([]);
+      }
+    }
+  });
+
+  it('the real licenses.html never scrolls sideways: no line of a <pre> over 100 columns but a one-word line (a <p> wraps)', () => {
+    for (const b of Object.values(builds)) {
+      const lines = [...readFileSync(join(b.dir, 'app', 'licenses.html'), 'utf8').matchAll(/<pre>([\s\S]*?)<\/pre>/g)]
+        .map(m => m[1])
+        .join('\n')
+        .replace(/&lt;/g, '<')
+        .replace(/&gt;/g, '>')
+        .replace(/&amp;/g, '&')
+        .split('\n');
+      expect(lines.filter(l => [...l].length > 100 && /\s/.test(l.trim()))).toEqual([]);
+      expect(Math.max(...lines.map(l => [...l].length))).toBeGreaterThan(60);
+    }
+  });
+
+  it('the static-page rule passes the real licenses.html; every page is an entry or the static page', () => {
+    for (const b of Object.values(builds)) for (const d of ['app', 'chrome', 'firefox']) expect([d, pageViolations(join(b.dir, d))]).toEqual([d, []]);
+  });
+});
```

Modify `extension/src/unlock/__tests__/welcome.test.ts` (the terms line's two links), `extension/src/app/__tests__/links.test.ts` (the UI's hrefs: Solscan and #38's rows, the shared table) and `extension/src/app/__tests__/Settings.test.tsx` (#38's rows exist now):

```diff
diff --git a/extension/src/unlock/__tests__/welcome.test.ts b/extension/src/unlock/__tests__/welcome.test.ts
index c900ea4..a42c636 100644
--- a/extension/src/unlock/__tests__/welcome.test.ts
+++ b/extension/src/unlock/__tests__/welcome.test.ts
@@ -2,6 +2,7 @@
 import {createEnvelope} from '../../vault/envelope';
 import {mountIntro, mountWelcome} from '../screens/welcome';
 import {click, el, harness, loadPage, testKdf, text, unstyled, visible} from './pageHarness';
+import {NOCTURA_PAGES} from '../../shared/links';
 
 const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
 const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
@@ -9,7 +10,7 @@ const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
 beforeEach(loadPage);
 
 describe('#1 welcome (spec §3.1)', () => {
-  it('idle: the design’s copy, two trust chips (no "ZK-private", D6), plain-text terms, both CTAs in design order', async () => {
+  it('idle: the design’s copy, two trust chips (no "ZK-private", D6), the terms line with its two links, both CTAs in design order', async () => {
     const h = await harness();
     const calls: string[] = [];
     await mountWelcome(h.deps, {create: () => calls.push('create'), import: () => calls.push('import')}).show();
@@ -21,8 +22,12 @@ describe('#1 welcome (spec §3.1)', () => {
     expect(text(screen)).not.toContain('ZK-private');
     expect(visible(el('wel-terms'))).toBe(true);
     expect(text(screen.querySelector('.terms'))).toBe('By continuing you agree to the Terms and Privacy Policy.');
-    // "Terms" and "Privacy Policy" are text until the privacy policy exists (release gate, B1e).
-    expect(screen.querySelectorAll('a')).toHaveLength(0);
+    // B1e §4.1: "Terms" and "Privacy Policy" are the line's two links, and the screen's only ones.
+    expect([...screen.querySelectorAll('a')].map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')])).toEqual([
+      ['Terms', NOCTURA_PAGES.terms, '_blank', 'noopener noreferrer'],
+      ['Privacy Policy', NOCTURA_PAGES.privacy, '_blank', 'noopener noreferrer'],
+    ]);
+    expect([...el('wel-terms').querySelectorAll('a')].map(a => a.id)).toEqual(['wel-terms-link', 'wel-privacy-link']);
     expect(visible(el('wel-actions'))).toBe(true);
     // Fix round 1 item 6: primary (Create) first, as in the design (index.html:4511-4512).
     expect([...el('wel-actions').querySelectorAll('button')].map(b => b.id)).toEqual(['wel-create', 'wel-import']);
@@ -38,6 +43,12 @@ describe('#1 welcome (spec §3.1)', () => {
     expect(unstyled('v-welcome')).toEqual([]);
   });
 
+  it('B1e §4.1: the two links are the shared table’s, literally — what the link gate (§4.3) requires present', () => {
+    expect(NOCTURA_PAGES).toEqual({terms: 'https://noc-tura.io/extension/terms', privacy: 'https://noc-tura.io/extension/privacy', help: 'https://noc-tura.io/extension/help'});
+    expect(el<HTMLAnchorElement>('wel-terms-link').getAttribute('href')).toBe('https://noc-tura.io/extension/terms');
+    expect(el<HTMLAnchorElement>('wel-privacy-link').getAttribute('href')).toBe('https://noc-tura.io/extension/privacy');
+  });
+
   it('rule 6 (spec §7.6): a second click on Create, or on Import, inside 500 ms does nothing', async () => {
     const h = await harness();
     const calls: string[] = [];
```

```diff
diff --git a/extension/src/app/__tests__/links.test.ts b/extension/src/app/__tests__/links.test.ts
index b20e9ef..949e529 100644
--- a/extension/src/app/__tests__/links.test.ts
+++ b/extension/src/app/__tests__/links.test.ts
@@ -2,9 +2,10 @@ import {readFileSync, readdirSync, statSync} from 'node:fs';
 import {dirname, join, relative, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 
-// Spec §6.5: Solscan is the ONLY external link. Over every file of src/app (tests aside): an href is a
-// Solscan URL built by explorer.ts or absent; nothing calls window.open; tabs.create is reached only
-// through platform.ts, whose targets are a closed list of extension pages.
+// Spec §6.5: Solscan was the ONLY external link; B1e §4.1 adds #38's Terms, Privacy and Help (noc-tura.io) and the
+// package's licenses.html, from the one table src/shared/links.ts. Over every file of src/app (tests aside): an href is
+// a Solscan URL built by explorer.ts, one of About.tsx's link rows given an entry of that table, or absent; nothing
+// calls window.open; tabs.create is reached only through platform.ts, whose targets are a closed list of extension pages.
 const APP = resolve(dirname(fileURLToPath(import.meta.url)), '..');
 function files(dir: string): string[] {
   return readdirSync(dir).flatMap(e => {
@@ -70,9 +71,21 @@ describe('links out of the UI', () => {
     }
   });
 
-  it('every href is the explorer link', () => {
-    for (const {path, text} of sources) {
-      for (const m of text.matchAll(/\bhref=\{?([^\s>}]+)/g)) expect(`${path}: ${m[1]}`).toBe('screens/TxDetail.tsx: href');
-    }
+  it('every href is the explorer link or one of #38’s link rows (B1e §4.1)', () => {
+    const hrefs = sources.flatMap(({path, text}) => [...text.matchAll(/\bhref=\{?([^\s>}]+)/g)].map(m => `${path}: ${m[1]}`));
+    expect(hrefs.sort()).toEqual([
+      'screens/About.tsx: LICENCES_PAGE',
+      'screens/About.tsx: NOCTURA_PAGES.help',
+      'screens/About.tsx: NOCTURA_PAGES.privacy',
+      'screens/About.tsx: NOCTURA_PAGES.terms',
+      'screens/About.tsx: href',
+      'screens/TxDetail.tsx: href',
+    ]);
+  });
+
+  it('the shared link table names exactly the three noc-tura.io pages and the licence page (B1e §4.1)', () => {
+    const table = readFileSync(resolve(APP, '../shared/links.ts'), 'utf8');
+    expect([...table.matchAll(/https?:\/\/[^\s'"`)]+/g)].map(m => m[0])).toEqual(['https://noc-tura.io/extension/terms', 'https://noc-tura.io/extension/privacy', 'https://noc-tura.io/extension/help']);
+    expect(table).toMatch(/export const LICENCES_PAGE = 'licenses\.html';/);
   });
 });
```

```diff
diff --git a/extension/src/app/__tests__/Settings.test.tsx b/extension/src/app/__tests__/Settings.test.tsx
index 54e6cb0..1bd5101 100644
--- a/extension/src/app/__tests__/Settings.test.tsx
+++ b/extension/src/app/__tests__/Settings.test.tsx
@@ -146,7 +146,7 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     expect(await getSession(ext)).toBeNull();
   });
 
-  it('#38 about: the wordmark, the adapted line, the version, the site as text, the licence', async () => {
+  it('#38 about: the wordmark, the adapted line, the version, the legal and help rows (B1e §4.1), the site as text, the licence', async () => {
     await openSettings();
     fireEvent.click(screen.getByText('About Noctura'));
     expect(await screen.findByText('Solana wallet for your browser — your keys stay on this device.')).toBeTruthy();
@@ -154,7 +154,8 @@ describe('Settings (#31, B1b-2b §4.1)', () => {
     expect(screen.getByText('noc-tura.io').closest('a')).toBeNull();
     expect(screen.getByText('© 2026 Noctura')).toBeTruthy();
     expect(screen.getByText(/BSL 1\.1 · converts to MIT on/)).toBeTruthy();
-    for (const gone of ['Terms of Service', 'Privacy Policy', 'Open-source licenses', 'Help & support', 'shielded']) expect(screen.queryByText(new RegExp(gone))).toBeNull();
+    for (const row of ['Terms of Service', 'Privacy Policy', 'Open-source licenses', 'Help & support']) expect(screen.getByText(row).closest('a')).toBeTruthy();
+    expect(screen.queryByText(/shielded/)).toBeNull();
     fireEvent.click(screen.getByRole('button', {name: 'Back'}));
     await waitFor(() => expect(screen.getByRole('heading', {name: 'Settings'})).toBeTruthy());
   });
```

Create `extension/e2e/links.spec.ts` (run in Step 4 — Playwright is not part of the red run):

```ts
import {test, expect, type Page} from '@playwright/test';
import {EXT, EXT_NOPRESALE} from './launch';
import {launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';

// B1e §4.1, §4.4: #1's Terms and Privacy Policy and #38's four rows, in both builds. A noc-tura.io link opens a new tab
// — its navigation is the only request it makes, caught by the contained browser's route and aborted (noc-tura.io does
// not resolve here either), so no test contacts the host. Open-source licenses opens the package's own licenses.html
// in a new tab: it loads nothing beyond itself.
const TERMS = 'https://noc-tura.io/extension/terms';
const PRIVACY = 'https://noc-tura.io/extension/privacy';
const HELP = 'https://noc-tura.io/extension/help';

/** Clicks a link and returns the tab it opened; the click must open one. */
async function opensTab(h: Harness, click: () => Promise<void>): Promise<Page> {
  const [tab] = await Promise.all([h.ctx.waitForEvent('page'), click()]);
  return tab;
}
/** Every request a fresh tab makes while it loads one of the package's pages, read through the DevTools protocol. */
async function requestsOf(h: Harness, page: string): Promise<string[]> {
  const tab = await h.ctx.newPage();
  try {
    const cdp = await h.ctx.newCDPSession(tab);
    const urls: string[] = [];
    cdp.on('Network.requestWillBeSent', e => urls.push(e.request.url));
    await cdp.send('Network.enable');
    await tab.goto(`chrome-extension://${h.id}/${page}`, {waitUntil: 'networkidle'});
    return urls;
  } finally {
    await tab.close();
  }
}
/** What every spec here ends with: nothing reached the network but the routes; noc-tura.io saw exactly these navigations. */
function containedExcept(h: Harness, navigations: string[]): void {
  expect(h.fake.unexpected).toEqual([]);
  expect(h.solscan.hits).toEqual([]);
  expect(h.nocTura.hits).toEqual(navigations);
}

for (const [build, ext] of [
  ['presale', EXT],
  ['no-presale', EXT_NOPRESALE],
] as const) {
  test.describe(`links (${build} build)`, () => {
    test('#1 welcome: Terms and Privacy Policy open noc-tura.io in a new tab, noopener noreferrer', async () => {
      const h = await launchPopup(`noctura-e2e-links-welcome-${build}-`, {ext});
      try {
        const vault = await h.ctx.newPage();
        await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
        const terms = vault.locator('#wel-terms');
        await expect(terms).toHaveText('By continuing you agree to the Terms and Privacy Policy.');
        for (const [name, href] of [
          ['Terms', TERMS],
          ['Privacy Policy', PRIVACY],
        ] as const) {
          const link = terms.getByRole('link', {name, exact: true});
          await expect(link).toHaveAttribute('href', href);
          await expect(link).toHaveAttribute('target', '_blank');
          await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
        const first = await opensTab(h, () => terms.getByRole('link', {name: 'Terms', exact: true}).click());
        await expect.poll(() => h.nocTura.hits).toEqual([TERMS]);
        expect(first).not.toBe(vault);
        const second = await opensTab(h, () => terms.getByRole('link', {name: 'Privacy Policy', exact: true}).click());
        await expect.poll(() => h.nocTura.hits).toEqual([TERMS, PRIVACY]);
        expect(second).not.toBe(vault);
        expect(vault.url()).toBe(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
        containedExcept(h, [TERMS, PRIVACY]);
      } finally {
        await h.close();
      }
    });

    test('#38 about: Terms of Service, Privacy Policy and Help & support open noc-tura.io in a new tab; Open-source licenses opens licenses.html', async () => {
      const h = await launchPopup(`noctura-e2e-links-about-${build}-`, {ext});
      try {
        await seedUnlockedWallet(h.sw);
        const p = await h.openPopup();
        await p.getByRole('button', {name: 'Settings'}).click();
        await p.getByText('About Noctura').click();
        const rows = [
          ['Terms of Service', TERMS],
          ['Privacy Policy', PRIVACY],
          ['Open-source licenses', 'licenses.html'],
          ['Help & support', HELP],
        ] as const;
        for (const [name, href] of rows) {
          const link = p.getByRole('link', {name: `${name} (opens in a new tab)`});
          await expect(link).toHaveAttribute('href', href);
          await expect(link).toHaveAttribute('target', '_blank');
          await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        }
        const opened: string[] = [];
        for (const [name, href] of rows.filter(([, href]) => href !== 'licenses.html')) {
          await opensTab(h, () => p.getByRole('link', {name: `${name} (opens in a new tab)`}).click());
          opened.push(href);
          await expect.poll(() => h.nocTura.hits).toEqual(opened);
        }

        const licences = await opensTab(h, () => p.getByRole('link', {name: 'Open-source licenses (opens in a new tab)'}).click());
        await licences.waitForLoadState('load');
        expect(licences.url()).toBe(`chrome-extension://${h.id}/licenses.html`);
        await expect(licences.getByRole('heading', {level: 1})).toHaveText('Open-source licenses');
        const headings = await licences.getByRole('heading', {level: 2}).allTextContents();
        expect(headings[0]).toBe('Noctura');
        for (const want of ['@solana/web3.js 1.99.0', 'text-encoding-utf-8 1.0.2', 'geist 1.7.2', 'react-dom 18.3.1']) expect(headings).toContain(want);
        expect(headings).not.toContain('rpc-websockets 9.3.9');
        expect(await licences.locator('a, script, style, link, iframe, form, img').count()).toBe(0);
        // What the page loads, from the browser's own network log (Playwright reports no chrome-extension:// request):
        // the document itself, nothing else. Positive control: the same log of popup.html sees its scripts.
        expect(await requestsOf(h, 'popup.html')).toEqual(expect.arrayContaining([`chrome-extension://${h.id}/popup.html`, expect.stringMatching(/\.js$/)]));
        expect(await requestsOf(h, 'licenses.html')).toEqual([`chrome-extension://${h.id}/licenses.html`]);
        containedExcept(h, [TERMS, PRIVACY, HELP]);
      } finally {
        await h.close();
      }
    });
  });
}
```

- [ ] **Step 2: Run — red.**

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `2` (3 errors: TS2307 `../../shared/links` ×2 — `about.test.tsx`, `welcome.test.ts`; TS2305 `ABOUT_TEXT` not exported by `../screens/About` — vitest runs regardless).
Run: `TZ=UTC npx vitest run scripts/__tests__/licences.test.mjs scripts/__tests__/check-links.test.mjs scripts/__tests__/rpcWebsockets.test.mjs scripts/__tests__/check-vault-isolation.test.mjs scripts/__tests__/presaleBuilds.test.mjs src/vault/__tests__/rpId.test.ts src/app/__tests__/about.test.tsx src/unlock/__tests__/welcome.test.ts src/app/__tests__/links.test.ts src/app/__tests__/Settings.test.tsx`
Expected on Task 5's tree: `Test Files  9 failed | 1 passed (10)` · `Tests  18 failed | 469 passed (487)` (the wrap rows added by the coordinator's ruling live in `licences.test.mjs` and `presaleBuilds.test.mjs`, and Review Focus 2's row, added at the plan's assembly, in `check-links.test.mjs` — files that do not load on Task 5's tree, so the totals are unchanged by them) — six files fail to load (`Cannot find module '../licences.mjs'`, `'../check-links.mjs'` (check-links and presaleBuilds), `'../rpcWebsockets.mjs'`; `Failed to resolve import "../../shared/links"` (about, welcome)); check-vault-isolation 15 (`pageViolations` / `staticPageViolations` is not a function); links 2 (only TxDetail's href; `src/shared/links.ts` does not exist); Settings 1 (no "Terms of Service"). `rpId.test.ts` **passes** on Task 5's tree — it pins a fact that already holds (`wallet.noc-tura.io/*` is a host permission today); M-rp-host is what proves it bites. (Observed: the final test files on 4ae32b4 in a scratch copy.)

- [ ] **Step 3: Implement.**

The fonts' licence is geist@1.7.2's own file — the release both faces are byte-identical to (`a369fcf5…` `Geist-Variable.woff2` = the tarball's `dist/fonts/geist-sans/Geist-Variable.woff2`, `fba8f577…` `GeistMono-Variable.woff2` = `dist/fonts/geist-mono/GeistMono-Variable.woff2`; source recorded by the web commit 8bfa475: "npm `geist@1.7.2`, Vercel, OFL"). Taken from the tarball, never retyped:

```bash
cd extension
tmp=$(mktemp -d) && (cd "$tmp" && npm pack geist@1.7.2 --silent && tar -xzf geist-1.7.2.tgz)
sha256sum "$tmp/package/dist/fonts/geist-sans/Geist-Variable.woff2" "$tmp/package/dist/fonts/geist-mono/GeistMono-Variable.woff2" public/fonts/*.woff2   # the two pairs equal
cp "$tmp/package/LICENSE.txt" public/fonts/LICENSE.txt
sha256sum public/fonts/LICENSE.txt   # 930853ee1daa68554d9e35c8a9175affb74f699fad9a5da6ee5ebe76379d9137 (pinned by licences.test.mjs)
rm -rf "$tmp"
```

Create `extension/release/licence-ids.json`:

```json
{
  "text-encoding-utf-8@1.0.2": "Unlicense"
}
```

Create `extension/release/licence-texts/MIT.txt` (the MIT text of `@solana/web3.js`'s own `LICENSE` without its copyright line, headed "MIT License"):

```text
MIT License

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```

Create `extension/scripts/licences.mjs`:

```js
// B1e §4.2 (I9, R7, N1–N3, E15, E16): licenses.html — the licence of every package whose code the extension ships, and
// of the fonts. Generated by scripts/build.mjs after the Vite builds, from the module maps they write next to the
// package (app.modules.json, app.provider.modules.json, app.relay.modules.json): only modules with rendered code
// (`rendered`, renderedLength > 0) count — `chunks` lists tree-shaken modules too. A package with rendered code whose
// licence cannot be named, or is outside the owner's allowlist, fails the build; nothing is ever listed as "unknown".
// The page is plain HTML (no script, no style, no link) and deterministic: no date, no absolute path, C-collation order.
import {createHash} from 'node:crypto';
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {join, posix} from 'node:path';

/** The owner's list (R7, E15). Adding to it is an owner decision, never a plan edit. Ours is exempt. */
export const ALLOWED_LICENCES = ['MIT', 'ISC', 'BSD-2-Clause', 'BSD-3-Clause', 'Apache-2.0', '0BSD', 'OFL-1.1', 'Unlicense'];
export const MODULE_MAPS = ['app.modules.json', 'app.provider.modules.json', 'app.relay.modules.json'];
export const LICENCE_PAGE = 'licenses.html';
/** §4.2 item 4: `name@version → SPDX` for a package with rendered code and no `license` field. */
export const LICENCE_IDS = 'release/licence-ids.json';
/** §4.2 item 4: a licence's standard text, for a package that ships no licence file. */
export const LICENCE_TEXTS = 'release/licence-texts';
/** §4.2 item 2: our own code — src/, the root pages, ../core/, ../web/ — is one entry under the repository's LICENSE. */
export const OURS = {name: 'Noctura', spdx: 'BUSL-1.1', file: '../LICENSE'};
/**
 * §4.2 item 5: the two Geist faces in public/fonts/ are copied as files, never modules. Both are byte-identical to npm
 * geist@1.7.2 (dist/fonts/geist-sans/Geist-Variable.woff2, dist/fonts/geist-mono/GeistMono-Variable.woff2), whose
 * LICENSE.txt is public/fonts/LICENSE.txt. A face that changes no longer matches its digest and fails the build.
 */
export const FONTS = {
  name: 'geist',
  version: '1.7.2',
  spdx: 'OFL-1.1',
  licence: 'public/fonts/LICENSE.txt',
  files: {
    'Geist-Variable.woff2': 'a369fcf5628ea2aa4e1b9e2ec6a5b3624e365bda588e1f0f2f12b564f728fbb8',
    'GeistMono-Variable.woff2': 'fba8f577f38a2bbcbe818efa6348dd58f36303a10b8737c42fefad275be563ab',
  },
};
const LICENCE_FILE = /^(?:LICEN[CS]E|COPYING)/i;

/** C collation: by UTF-16 code unit, never the locale. */
export const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const fold = text => text.replace(/\r\n/g, '\n').replace(/\s+$/, '');
export const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * Every module with rendered code in some chunk of the given parsed maps, without query or hash. A map without a
 * `rendered` section, or with a malformed one, is INCONCLUSIVE: the page would be built from the wrong input.
 */
export function renderedModules(maps) {
  const out = new Set();
  for (const [name, map] of maps) {
    const rendered = map?.rendered;
    if (rendered === null || typeof rendered !== 'object' || Array.isArray(rendered)) throw new Error(`INCONCLUSIVE: ${name} has no rendered section — the licence page needs each module's rendered length`);
    for (const [chunk, modules] of Object.entries(rendered)) {
      if (modules === null || typeof modules !== 'object' || Array.isArray(modules)) throw new Error(`INCONCLUSIVE: ${name}: chunk ${chunk}'s rendered entry is not a module → length map`);
      for (const [id, length] of Object.entries(modules)) {
        if (!Number.isSafeInteger(length) || length < 0) throw new Error(`INCONCLUSIVE: ${name}: ${chunk}: ${JSON.stringify(id)} has rendered length ${JSON.stringify(length)}`);
        if (length > 0) out.add(id.replace(/[?#].*$/, ''));
      }
    }
  }
  return out;
}

/** What a module id is (§4.2 items 1–3): skipped, ours, a package's, or unknown (which fails the build). */
export function moduleKind(id) {
  if (id.startsWith('\0') || id === '__vite-browser-external' || id.startsWith('__vite-browser-external:')) return 'skip';
  if (/(?:^|\/)node_modules\//.test(id)) return 'package';
  if (id.startsWith('src/') || id.startsWith('../core/') || id.startsWith('../web/') || /^[^/]+\.html$/.test(id)) return 'ours';
  return 'unknown';
}

/** The nearest package.json with a `name`, walking up from the module's directory, inside node_modules. */
function packageOf(root, id) {
  let dir = posix.dirname(id);
  while (/(?:^|\/)node_modules\/./.test(dir)) {
    const file = join(root, dir, 'package.json');
    if (existsSync(file)) {
      const json = JSON.parse(readFileSync(file, 'utf8'));
      if (typeof json.name === 'string' && json.name !== '') return {dir, json};
    }
    dir = posix.dirname(dir);
  }
  return undefined;
}

const authorOf = author => {
  if (typeof author === 'string') return author.trim();
  if (author === null || typeof author !== 'object' || typeof author.name !== 'string') return '';
  return [author.name, typeof author.email === 'string' ? `<${author.email}>` : '', typeof author.url === 'string' ? `(${author.url})` : ''].filter(Boolean).join(' ');
};

/** §4.2 item 4: every LICENSE*, LICENCE*, COPYING* file of the package (sorted by name), or the SPDX standard text. */
function licenceText(root, pkg, spdx, problems, where) {
  const files = readdirSync(join(root, pkg.dir))
    .filter(f => LICENCE_FILE.test(f) && statSync(join(root, pkg.dir, f)).isFile())
    .sort(byCodeUnit);
  if (files.length === 1) return fold(readFileSync(join(root, pkg.dir, files[0]), 'utf8'));
  if (files.length > 1) return files.map(f => `${f}\n\n${fold(readFileSync(join(root, pkg.dir, f), 'utf8'))}`).join('\n\n');
  const standard = join(root, LICENCE_TEXTS, `${spdx}.txt`);
  if (typeof pkg.json.license !== 'string' || !existsSync(standard)) {
    problems.push(`${where}: ships no licence file, and ${typeof pkg.json.license === 'string' ? `${LICENCE_TEXTS}/${spdx}.txt does not exist` : 'its package.json names no licence'} — the build cannot show its licence`);
    return undefined;
  }
  const author = authorOf(pkg.json.author);
  const head = author === '' ? 'The package names no author.' : `Author: ${author}`;
  return `${head}\nThe package ships no licence file; this is the standard ${spdx} text its package.json names.\n\n${fold(readFileSync(standard, 'utf8'))}`;
}

/**
 * The page's entries: ours first, then every package with rendered code and the fonts, by name then version (C
 * collation). Copies with the same name, version and text are one entry; a same name and version with another text
 * are two. Throws one Error naming every problem (an unknown module, an unnamed or refused licence, a font without an
 * entry).
 * @param {string} root the extension package directory
 * @param {[string, unknown][]} maps [file name, parsed module map]
 * @param {string} appDir the built package directory whose fonts/ is read
 */
export function licenceEntries(root, maps, appDir) {
  const problems = [];
  const ids = [...renderedModules(maps)].sort(byCodeUnit);
  const table = JSON.parse(readFileSync(join(root, LICENCE_IDS), 'utf8'));
  const packages = new Map();
  let ours = false;
  for (const id of ids) {
    const kind = moduleKind(id);
    if (kind === 'skip') continue;
    if (kind === 'ours') {
      ours = true;
      continue;
    }
    if (kind === 'unknown') {
      problems.push(`${JSON.stringify(id)} has rendered code but is neither ours (src/, ../core/, ../web/, a root page) nor a package's — the licence page cannot name it`);
      continue;
    }
    const pkg = packageOf(root, id);
    if (pkg === undefined) {
      problems.push(`${JSON.stringify(id)}: no package.json with a name above it`);
      continue;
    }
    if (!packages.has(pkg.dir)) packages.set(pkg.dir, pkg);
  }
  if (!ours) problems.push('INCONCLUSIVE: no module of ours has rendered code — the maps do not describe this extension');
  const entries = new Map();
  for (const pkg of [...packages.values()].sort((a, b) => byCodeUnit(a.dir, b.dir))) {
    const {name, version} = pkg.json;
    const where = `${name}@${version} (${pkg.dir})`;
    const key = `${name}@${version}`;
    const declared = pkg.json.license;
    let spdx;
    // A license field the package has wins: licence-ids.json classifies only a package that has none (M6).
    const noOverride = `${LICENCE_IDS} cannot override a license field the package has`;
    if (typeof declared === 'string' && declared !== '') spdx = declared;
    else if (declared !== undefined) problems.push(`${where}: its license field is not an SPDX string (${JSON.stringify(declared)}); ${noOverride} — admitting it is the owner's decision`);
    else if (typeof table[key] === 'string') spdx = table[key];
    else problems.push(`${where}: has rendered code, no license field and no row in ${LICENCE_IDS} — classify it there`);
    if (spdx === undefined) continue;
    if (!ALLOWED_LICENCES.includes(spdx)) {
      const from = declared === spdx ? ` (its license field; ${noOverride})` : '';
      problems.push(`${where}: ${spdx} is outside the licence allowlist (${ALLOWED_LICENCES.join(', ')})${from} — adding to it is the owner's decision`);
      continue;
    }
    const text = licenceText(root, pkg, spdx, problems, where);
    if (text === undefined) continue;
    const entry = {name, version, spdx, text};
    entries.set(`${key}\n${text}`, entry);
  }
  const fonts = fontEntry(root, appDir, problems);
  if (fonts !== undefined) entries.set(`${fonts.name}@${fonts.version}\n${fonts.text}`, fonts);
  if (problems.length > 0) throw new Error(`licence page:\n${problems.join('\n')}`);
  const sorted = [...entries.values()].sort((a, b) => byCodeUnit(a.name, b.name) || byCodeUnit(a.version, b.version) || byCodeUnit(a.text, b.text));
  return [{name: OURS.name, spdx: OURS.spdx, text: fold(readFileSync(join(root, OURS.file), 'utf8'))}, ...sorted];
}

/** §4.2 item 5: every file under the package's fonts/ is a face with an entry (its digest pinned) or the licence. */
function fontEntry(root, appDir, problems) {
  const dir = join(appDir, 'fonts');
  const present = existsSync(dir) ? readdirSync(dir).sort(byCodeUnit) : [];
  for (const f of present) {
    if (f === 'LICENSE.txt') continue;
    const want = FONTS.files[f];
    if (want === undefined) problems.push(`fonts/${f} is in the package without a licence entry`);
    else if (createHash('sha256').update(readFileSync(join(dir, f))).digest('hex') !== want) problems.push(`fonts/${f} is not the ${FONTS.name}@${FONTS.version} file its entry was recorded for`);
  }
  const files = Object.keys(FONTS.files).sort(byCodeUnit);
  const missing = files.filter(f => !present.includes(f));
  if (missing.length > 0) problems.push(`INCONCLUSIVE: fonts/${missing.join(', fonts/')} missing from the package — the font entry would describe nothing`);
  return {name: FONTS.name, version: FONTS.version, spdx: FONTS.spdx, files: files.map(f => `fonts/${f}`), text: fold(readFileSync(join(root, FONTS.licence), 'utf8'))};
}

/** The widest line the page renders (coordinator ruling on Task 6): a <pre> cannot wrap without CSS, and the page has none. */
export const WRAP_COLUMNS = 100;

/**
 * Every line longer than `width` columns (code points) broken at word boundaries, greedily: the whitespace run where a
 * line breaks becomes the line break; nothing else changes — with whitespace collapsed the text is the same. A word
 * longer than `width` stays whole, on a line of its own.
 */
export function wrapText(text, width = WRAP_COLUMNS) {
  return text
    .split('\n')
    .map(line => {
      if ([...line].length <= width) return line;
      const out = [];
      let current = '';
      for (const [, space, word] of line.matchAll(/(\s*)(\S+)/g)) {
        const joined = current + space + word;
        if (current.trim() !== '' && [...joined].length > width) {
          out.push(current);
          current = word;
        } else current = joined;
      }
      out.push(current + (/\s*$/.exec(line)?.[0] ?? ''));
      return out.join('\n');
    })
    .join('\n');
}

/** The page: plain HTML, every text escaped — no script, no style, no link (check-vault-isolation.mjs STATIC_PAGES). */
export function licencePage(entries) {
  const blocks = entries.map(e => {
    const title = e.version === undefined ? e.name : `${e.name} ${e.version}`;
    const meta = e.files === undefined ? e.spdx : `${e.spdx} · ${e.files.join(', ')}`;
    return `<h2>${escapeHtml(title)}</h2>\n<p>${escapeHtml(meta)}</p>\n<pre>${escapeHtml(wrapText(e.text))}\n</pre>\n`;
  });
  const packages = entries.filter(e => e.version !== undefined && e.files === undefined).length;
  return [
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<title>Open-source licenses · Noctura</title>\n</head>\n<body>\n',
    '<h1>Open-source licenses</h1>\n',
    `<p>Noctura ships the code of ${packages} open-source packages and the Geist fonts. Each is listed below with its licence, after Noctura's own.</p>\n`,
    ...blocks,
    '</body>\n</html>\n',
  ].join('');
}

/** Reads the build's maps next to `outRoot/app` and returns the page; throws when it cannot be built. */
export function buildLicencePage(root, outRoot) {
  const maps = MODULE_MAPS.map(f => {
    const file = join(outRoot, f);
    if (!existsSync(file)) throw new Error(`INCONCLUSIVE: ${f} is missing next to ${join(outRoot, 'app')} — the licence page needs every module map`);
    return [f, JSON.parse(readFileSync(file, 'utf8'))];
  });
  return licencePage(licenceEntries(root, maps, join(outRoot, 'app')));
}
```

Create `extension/scripts/check-licences.mjs`:

```js
#!/usr/bin/env node
// B1e §4.2 (R7, N3, E16): the licence gate, for one build (NOCTURA_DIST). Two rules over the module maps the build
// wrote next to its package, and one over the packages:
//   1. rpc-websockets (LGPL-3.0-only) ships no code: no module of node_modules/rpc-websockets/ is in any chunk (the
//      alias, scripts/rpcWebsockets.mjs, resolves the bare specifier to the stub — without it the package is in the maps
//      at 0 rendered bytes), and the stub renders 0 bytes in every chunk (something constructing a Connection renders it);
//   2. the licence page each package carries (app/, chrome/, firefox/) is exactly the page the build's maps give
//      (scripts/licences.mjs: rendered code only, the owner's allowlist, licence-ids.json) — a hand edit, a stale page or
//      a page from other maps fails.
import {existsSync, readFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMain} from './isMain.mjs';
import {distDir} from './distDir.mjs';
import {LICENCE_PAGE, MODULE_MAPS, buildLicencePage} from './licences.mjs';
import {RPC_WEBSOCKETS_STUB} from './rpcWebsockets.mjs';

const RPC_WEBSOCKETS = /(?:^|\/)node_modules\/rpc-websockets\//;

/** Rule 1 over the parsed maps ([file name, map]). */
export function rpcWebsocketsViolations(maps) {
  const out = [];
  for (const [name, map] of maps) {
    if (map?.rendered === null || typeof map?.rendered !== 'object') {
      out.push(`INCONCLUSIVE: ${name} has no rendered section — what rpc-websockets renders is unknown`);
      continue;
    }
    if (map.chunks === null || typeof map.chunks !== 'object') {
      out.push(`INCONCLUSIVE: ${name} has no chunks section — whether rpc-websockets is in a chunk is unknown`);
      continue;
    }
    for (const [chunk, ids] of Object.entries(map.chunks)) {
      for (const id of Array.isArray(ids) ? ids : []) if (RPC_WEBSOCKETS.test(id)) out.push(`${name}: ${chunk} carries ${JSON.stringify(id)} — rpc-websockets must resolve to ${RPC_WEBSOCKETS_STUB} (the alias)`);
    }
    for (const [chunk, modules] of Object.entries(map.rendered)) {
      for (const [id, length] of Object.entries(modules ?? {})) {
        const path = id.replace(/[?#].*$/, '');
        if (RPC_WEBSOCKETS.test(path) && length !== 0) out.push(`${name}: ${chunk} renders ${length} bytes of ${JSON.stringify(id)} — no LGPL code may ship`);
        if (path === RPC_WEBSOCKETS_STUB && length !== 0) out.push(`${name}: ${chunk} renders ${length} bytes of ${RPC_WEBSOCKETS_STUB} — something constructs a Connection (a socket client); nothing the extension bundles may`);
      }
    }
  }
  return out;
}

/** Rule 2: each package's licenses.html equals the page the build's maps give. */
export function licencePageViolations(root, outRoot) {
  let want;
  try {
    want = buildLicencePage(root, outRoot);
  } catch (e) {
    return [e.message];
  }
  const out = [];
  for (const d of ['app', 'chrome', 'firefox']) {
    const file = join(outRoot, d, LICENCE_PAGE);
    if (!existsSync(file)) out.push(`${d}/${LICENCE_PAGE} is missing`);
    else if (readFileSync(file, 'utf8') !== want) out.push(`${d}/${LICENCE_PAGE} is not the page this build's module maps give — rebuild; never edit it by hand`);
  }
  return out;
}

if (isMain(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const DIST = distDir();
  const outRoot = join(ROOT, DIST);
  const maps = MODULE_MAPS.filter(f => existsSync(join(outRoot, f))).map(f => [f, JSON.parse(readFileSync(join(outRoot, f), 'utf8'))]);
  const problems = maps.length === MODULE_MAPS.length ? [...rpcWebsocketsViolations(maps), ...licencePageViolations(ROOT, outRoot)] : [`INCONCLUSIVE: ${DIST} lacks one of ${MODULE_MAPS.join(', ')}`];
  if (problems.length > 0) {
    for (const p of problems) console.error(`${DIST}: ${p}`);
    process.exit(1);
  }
  console.log(`licences ok (${DIST}): rpc-websockets resolves to its stub and renders 0 bytes; app/, chrome/ and firefox/ carry the licence page of the code this build renders`);
}
```

Create `extension/scripts/check-links.mjs`:

```js
#!/usr/bin/env node
// B1e §4.3 (I1, R8): every URL string the package carries is one this table names — matched as a whole string, scheme
// http, https, ws, wss and ftp alike — in the file kind the table allows; the four links a user is given must be
// present. Run for one build's chrome/ and firefox/ packages (NOCTURA_DIST). licenses.html is skipped by name (N1): its
// licence texts carry URLs as escaped text, and check-vault-isolation.mjs's static-page rule holds there instead (no
// <a, no href=). A library update that changes an inert string fails here until a reviewer adds the new string with
// its reason.
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {isMain} from './isMain.mjs';
import {distDir} from './distDir.mjs';

/** Every URL literal: the spec's extraction, as written in §4.3. */
export const URL_LITERAL = /\b(?:https?|wss?|ftp):\/\/[^\s"'`<>)\\;]*/g;
/** A template literal's interpolation inside a match, folded so a minifier's renaming (`${e}`, `${t}`) is one string. */
const INTERPOLATION = /\$\{[\w$]*\}/g;
/** The one page the gate does not read (N1). */
export const SKIPPED = ['licenses.html'];
/** The text files a package may carry a URL in — an SVG document too (`<a xlink:href>`), though none ships today (review M5). */
const READ = /\.(?:js|html|css|json|svg)$/;

const MANIFEST = path => path === 'manifest.json';
const BACKGROUND = path => path === 'background.js';
const JS = path => path.endsWith('.js');
const PAGE_FILE = path => path.endsWith('.js') || path.endsWith('.html');

/**
 * The URL strings the package may carry. `where`: the files it may appear in. `present`: a navigable link the user is
 * given — the gate fails when it is in no file. `build`: only in that build (the default: both).
 */
export const LINKS = [
  // The coordinator: named by the manifest and the background only — pages reach it only through the background.
  {url: 'https://api.noc-tura.io/*', where: MANIFEST, kind: 'host permission (the coordinator)'},
  {url: 'https://api.noc-tura.io', where: MANIFEST, kind: "CSP connect-src (the one host anything fetches)"},
  {url: 'https://api.noc-tura.io/api/v1', where: BACKGROUND, kind: 'the coordinator base (API_BASE)'},
  {url: 'https://api.noc-tura.io/api/v1/rpc', where: BACKGROUND, kind: 'the coordinator RPC endpoint'},
  // The passkey relying-party ID (B1e §5.6, E17): a host permission only — nothing is served there, nothing fetches it.
  {url: 'https://wallet.noc-tura.io/*', where: MANIFEST, kind: 'host permission (the passkey RP ID)'},
  // Navigable links (an <a target="_blank">, never a fetch): each must also be PRESENT.
  {url: 'https://solscan.io/tx/', where: PAGE_FILE, present: true, kind: 'the explorer link prefix (src/app/explorer.ts)'},
  {url: 'https://noc-tura.io/extension/terms', where: PAGE_FILE, present: true, kind: 'Terms (#1, #38)'},
  {url: 'https://noc-tura.io/extension/privacy', where: PAGE_FILE, present: true, kind: 'Privacy Policy (#1, #38)'},
  {url: 'https://noc-tura.io/extension/help', where: PAGE_FILE, present: true, kind: 'Help & support (#38)'},
  // The presale build only: #24's invite link, shown and copied, never navigated or fetched (core/referral).
  {url: 'https://noc-tura.io?ref=${}', where: JS, build: 'presale', kind: "the referral invite link (core/referral's buildReferralLink)"},
  // Inert library strings: message text and namespace identifiers. Never fetched (connect-src admits only the
  // coordinator) and never navigated (no href, window.open or openPage is built from them).
  {url: 'https://reactjs.org/docs/error-decoder.html?invariant=', where: JS, kind: 'inert: react-dom 18.3.1, its production error text'},
  {url: 'https://github.com/uuidjs/uuid#getrandomvalues-not-supported', where: JS, kind: 'inert: uuid 8.3.2, its error text'},
  {url: 'http://www.w3.org/1999/xhtml', where: JS, kind: 'inert: react-dom, an XML namespace identifier'},
  {url: 'http://www.w3.org/2000/svg', where: JS, kind: 'inert: react-dom and React elements, an XML namespace identifier'},
  {url: 'http://www.w3.org/1999/xlink', where: JS, kind: 'inert: react-dom, an XML namespace identifier'},
  {url: 'http://www.w3.org/XML/1998/namespace', where: JS, kind: 'inert: react-dom, an XML namespace identifier'},
  {url: 'http://www.w3.org/1998/Math/MathML', where: JS, kind: 'inert: react-dom, an XML namespace identifier'},
];

const toPosix = p => p.split(sep).join('/');
function listFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

/** Every URL string in `text`, as the table names them (an interpolation folded to `${}`). */
export const urlStrings = text => [...text.matchAll(URL_LITERAL)].map(m => m[0].replace(INTERPOLATION, '${}'));

/**
 * `files`: [{path (package-relative, /), text}]; `presale`: which build the package is. Returns every violation.
 * `links` and `skipped` are the table and the skip, as parameters for the controls.
 */
export function linkViolations(files, presale, {links = LINKS, skipped = SKIPPED} = {}) {
  const out = [];
  const table = links.filter(l => l.build === undefined || l.build === (presale ? 'presale' : 'no-presale'));
  const seen = new Set();
  let matches = 0;
  for (const {path, text} of files) {
    if (skipped.includes(path) || !READ.test(path)) continue;
    for (const url of urlStrings(text)) {
      matches += 1;
      const entry = table.find(l => l.url === url);
      if (entry === undefined) out.push(`${path} names ${JSON.stringify(url)} — a URL the link table does not name`);
      else if (!entry.where(path)) out.push(`${path} names ${JSON.stringify(url)} — ${entry.kind}, not allowed in this file`);
      else seen.add(url);
    }
  }
  if (matches === 0) return ['INCONCLUSIVE: no URL string in the package — the extraction broke'];
  for (const l of table.filter(l => l.present === true && !seen.has(l.url))) out.push(`${l.url} (${l.kind}) is in no file — the link the user is given is gone`);
  return out;
}

/** Reads one package directory. */
export function packageFiles(dir) {
  return listFiles(dir)
    .map(p => toPosix(relative(dir, p)))
    .sort()
    .map(path => ({path, text: READ.test(path) ? readFileSync(join(dir, path), 'utf8') : ''}));
}

if (isMain(import.meta.url)) {
  const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const DIST = distDir();
  const featuresFile = join(ROOT, DIST, 'app.features.json');
  const features = existsSync(featuresFile) ? JSON.parse(readFileSync(featuresFile, 'utf8')) : undefined;
  const problems = [];
  if (typeof features?.presale !== 'boolean') problems.push(`INCONCLUSIVE: ${DIST}/app.features.json does not say which build this is`);
  else {
    for (const browser of ['chrome', 'firefox']) {
      const dir = join(ROOT, DIST, browser);
      if (!existsSync(dir)) problems.push(`INCONCLUSIVE: ${DIST}/${browser} is missing`);
      else for (const p of linkViolations(packageFiles(dir), features.presale)) problems.push(`${DIST}/${browser}: ${p}`);
    }
  }
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`links ok (${DIST}): every URL string in chrome/ and firefox/ is one of the link table's, in a file it allows, and the four links the user is given are present (licenses.html skipped by name — the static-page rule holds there)`);
}
```

Create `extension/scripts/rpcWebsockets.mjs`:

```js
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * B1e §4.2 (R7, E16): the bare specifier `rpc-websockets` (LGPL-3.0-only, imported by @solana/web3.js's browser build)
 * resolves to a local stub in every build — a precaution: the package renders 0 bytes today. vite.config.ts uses this
 * alias; scripts/__tests__/rpcWebsockets.test.mjs bundles web3.js under the same one.
 */
export const RPC_WEBSOCKETS_STUB = 'src/shared/rpcWebsocketsStub.ts';
export const rpcWebsocketsAlias = (root = ROOT) => [{find: /^rpc-websockets$/, replacement: resolve(root, RPC_WEBSOCKETS_STUB)}];
```

Create `extension/src/shared/rpcWebsocketsStub.ts`:

```ts
/**
 * B1e §4.2 (R7, E16): what the bare specifier `rpc-websockets` resolves to in every build (scripts/rpcWebsockets.mjs).
 * @solana/web3.js's browser build imports `CommonClient` and `WebSocket` from it and declares
 * `class RpcWebSocketClient extends CommonClient` at its top level, so `CommonClient` must be a class; only
 * `Connection`'s constructor makes a socket client, and nothing the extension bundles constructs a `Connection`. The
 * package (LGPL-3.0-only) is tree-shaken to 0 bytes today; this keeps it out should a later web3.js keep it, and the
 * licence gate (scripts/check-licences.mjs) fails if this stub ever renders.
 */
const refused = (): never => {
  throw new Error('rpc-websockets is not part of Noctura: the extension opens no WebSocket');
};

export class CommonClient {
  constructor() {
    refused();
  }
}

export function WebSocket(): never {
  return refused();
}
```

Create `extension/src/shared/links.ts`:

```ts
/**
 * B1e §4.1 (E4): the pages on noc-tura.io the extension links to — Terms and Privacy on #1 (unlock.html, as static
 * markup) and #38, Help on #38. Each opens in a new tab, `<a target="_blank" rel="noopener noreferrer">`; nothing ever
 * fetches them (connect-src admits only the coordinator; scripts/check-links.mjs pins the strings).
 */
export const NOCTURA_PAGES = {
  terms: 'https://noc-tura.io/extension/terms',
  privacy: 'https://noc-tura.io/extension/privacy',
  help: 'https://noc-tura.io/extension/help',
} as const;

/** B1e §4.2: the licence page inside the package (scripts/licences.mjs writes it), opened in a new tab. */
export const LICENCES_PAGE = 'licenses.html';
```

Modify `extension/vite.config.ts` and `extension/vite.content.config.ts` (the `rendered` section; the alias):

```diff
diff --git a/extension/vite.config.ts b/extension/vite.config.ts
index 05819c1..6baade9 100644
--- a/extension/vite.config.ts
+++ b/extension/vite.config.ts
@@ -6,6 +6,7 @@ import {relative, resolve, sep} from 'node:path';
 import {isStylesheet, scanCss} from './scripts/css-scan.mjs';
 import {presaleFlag} from './scripts/presaleFlag.mjs';
 import {presaleSwitch} from './scripts/presaleSwitch.mjs';
+import {rpcWebsocketsAlias} from './scripts/rpcWebsockets.mjs';
 
 // core/ and web/src/ui/ are imported by relative path, and a bare import in one of their files would
 // otherwise resolve upwards from there — to web/node_modules or the repository root's node_modules
@@ -39,12 +40,18 @@ function sharedResolvesFromHere(): Plugin {
 //            other URL-loading functions, whether it has a backslash), read before Vite's CSS plugin inlines
 //            an @import (an @import'ed file never becomes a module of its own). Every CSS language Vite
 //            compiles counts as a stylesheet (fix round 4), not only .css.
+//   rendered: JS chunk file → module → the bytes of it the chunk really carries (the bundler's `renderedLength`; B1e §4.2,
+//            N3): `chunks` lists every module a chunk was composed from, tree-shaken ones included, so the licence page
+//            (scripts/licences.mjs) reads this section, never `chunks`.
 const CHUNK_MODULES = new Map<string, string[]>();
 const CSS_SOURCES = new Map<string, string[]>();
 const CHUNK_CSS = new Map<string, string[]>();
 const CSS_REFS = new Map<string, {imports: string[]; urls: string[]; loaders: string[]; escapes: boolean}>();
+const RENDERED = new Map<string, Record<string, number>>();
 const moduleId = (id: string) => (id.startsWith('\0') ? id : relative(__dirname, id).split(sep).join('/'));
 const sorted = <T,>(m: Map<string, T>) => Object.fromEntries([...m].sort(([a], [b]) => a.localeCompare(b)));
+const renderedLengths = (modules: Record<string, {renderedLength: number}>) =>
+  Object.fromEntries(Object.entries(modules).map(([id, m]) => [moduleId(id), m.renderedLength] as const).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
 function chunkModules(write: boolean): Plugin {
   return {
     name: 'noctura:chunk-modules',
@@ -61,6 +68,7 @@ function chunkModules(write: boolean): Plugin {
         if (file.type !== 'chunk') continue;
         const ids = file.moduleIds.map(moduleId);
         CHUNK_MODULES.set(file.fileName, [...ids].sort());
+        RENDERED.set(file.fileName, renderedLengths(file.modules));
         const css = [...(file.viteMetadata?.importedCss ?? [])].sort();
         CHUNK_CSS.set(file.fileName, css);
         const sheets = ids.filter(m => isStylesheet(m)).sort();
@@ -70,7 +78,7 @@ function chunkModules(write: boolean): Plugin {
     },
     writeBundle(options) {
       if (!write || options.dir === undefined) return;
-      const out = {chunks: sorted(CHUNK_MODULES), css: sorted(CSS_SOURCES), chunkCss: sorted(CHUNK_CSS), cssRefs: sorted(CSS_REFS)};
+      const out = {chunks: sorted(CHUNK_MODULES), css: sorted(CSS_SOURCES), chunkCss: sorted(CHUNK_CSS), cssRefs: sorted(CSS_REFS), rendered: sorted(RENDERED)};
       writeFileSync(`${options.dir}.modules.json`, `${JSON.stringify(out, null, 2)}\n`);
     },
   };
@@ -95,6 +103,7 @@ export function appConfig(env: Record<string, string | undefined>): UserConfig {
     // in them, unrelated to this bug).
     tsconfig: resolve(__dirname, 'tsconfig.json'),
     define: {__NOCTURA_PRESALE__: JSON.stringify(presale)},
+    resolve: {alias: rpcWebsocketsAlias()},
     plugins: [sharedResolvesFromHere(), presaleSwitch(presale), react(), chunkModules(true)],
     server: {fs: {allow: [resolve(__dirname, '..')]}},
     build: {
```

```diff
diff --git a/extension/vite.content.config.ts b/extension/vite.content.config.ts
index 49c17cf..e4e9224 100644
--- a/extension/vite.content.config.ts
+++ b/extension/vite.content.config.ts
@@ -9,20 +9,28 @@ import {presaleSwitch} from './scripts/presaleSwitch.mjs';
  * ES module) into the main build's output directory: `NOCTURA_CONTENT=provider` → provider.js (MAIN world),
  * `NOCTURA_CONTENT=relay` → relay.js (isolated world). Each build writes what it carries next to the output
  * (`dist/app.<name>.modules.json`), for the page-bundle gate (scripts/check-page-bundles.mjs): a content script runs in
- * every page, so it may carry only its own sources and @wallet-standard.
+ * every page, so it may carry only its own sources and @wallet-standard. The map also records each module's rendered
+ * bytes, for the licence page (B1e §4.2).
  */
 const moduleId = (id: string) => (id.startsWith('\0') ? id : relative(__dirname, id).split(sep).join('/'));
+const byKey = <T,>(m: Iterable<[string, T]>) => Object.fromEntries([...m].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
 function contentModules(name: string): Plugin {
   const chunks = new Map<string, string[]>();
+  // B1e §4.2 (N3): chunk → module → rendered bytes, as vite.config.ts's chunkModules writes it.
+  const rendered = new Map<string, Record<string, number>>();
   return {
     name: 'noctura:content-modules',
     apply: 'build',
     generateBundle(_options, bundle) {
-      for (const file of Object.values(bundle)) if (file.type === 'chunk') chunks.set(file.fileName, file.moduleIds.map(moduleId).sort());
+      for (const file of Object.values(bundle)) {
+        if (file.type !== 'chunk') continue;
+        chunks.set(file.fileName, file.moduleIds.map(moduleId).sort());
+        rendered.set(file.fileName, byKey(Object.entries(file.modules).map(([id, m]) => [moduleId(id), m.renderedLength] as [string, number])));
+      }
     },
     writeBundle(options) {
       if (options.dir === undefined) return;
-      writeFileSync(`${options.dir}.${name}.modules.json`, `${JSON.stringify({chunks: Object.fromEntries([...chunks].sort(([a], [b]) => a.localeCompare(b)))}, null, 2)}\n`);
+      writeFileSync(`${options.dir}.${name}.modules.json`, `${JSON.stringify({chunks: Object.fromEntries([...chunks].sort(([a], [b]) => a.localeCompare(b))), rendered: byKey(rendered)}, null, 2)}\n`);
     },
   };
 }
```

Modify `extension/scripts/build.mjs`, `extension/package.json` and `extension/scripts/check-vault-isolation.mjs`:

```diff
diff --git a/extension/scripts/build.mjs b/extension/scripts/build.mjs
index 38663df..10fc23d 100644
--- a/extension/scripts/build.mjs
+++ b/extension/scripts/build.mjs
@@ -12,6 +12,7 @@ import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
 import {dirname, join, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
 import {render} from '../manifest/source.mjs';
+import {LICENCE_PAGE, buildLicencePage} from './licences.mjs';
 
 const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
 const args = process.argv.slice(2);
@@ -30,6 +31,9 @@ execFileSync('npx', ['vite', 'build', '--outDir', app, '--emptyOutDir'], {cwd: R
 for (const content of ['provider', 'relay']) {
   execFileSync('npx', ['vite', 'build', '--config', 'vite.content.config.ts', '--outDir', app], {cwd: ROOT, stdio: 'inherit', env: {...env, NOCTURA_CONTENT: content}});
 }
+// B1e §4.2: licenses.html, from the module maps the three builds wrote — before the per-browser copies, so both carry
+// the same file. A package whose licence cannot be named, or is outside the allowlist, throws: the build fails.
+writeFileSync(join(app, LICENCE_PAGE), buildLicencePage(ROOT, outRoot));
 
 for (const browser of ['chrome', 'firefox']) {
   const dir = join(outRoot, browser);
```

```diff
diff --git a/extension/package.json b/extension/package.json
index 2edcb4d..6b47315 100644
--- a/extension/package.json
+++ b/extension/package.json
@@ -12,7 +12,7 @@
     "csp": "node scripts/check-csp.mjs dist/app && node scripts/check-csp.mjs dist-nopresale/app",
     "secrets": "test -d dist/app && test -d dist/chrome && test -d dist/firefox && test -d dist-nopresale/app && test -d dist-nopresale/chrome && test -d dist-nopresale/firefox && node ../web/scripts/check-no-secrets.mjs --bundle dist/app dist/chrome dist/firefox dist-nopresale/app dist-nopresale/chrome dist-nopresale/firefox",
     "gates": "npm run gates:build && NOCTURA_DIST=dist-nopresale npm run gates:build && node scripts/check-no-presale.mjs dist-nopresale dist",
-    "gates:build": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs",
+    "gates:build": "node scripts/check-permissions.mjs && node scripts/check-page-bundles.mjs && node scripts/check-vault-isolation.mjs && node scripts/check-rpc-methods.mjs && node scripts/check-no-tge-date.mjs && node scripts/check-fonts.mjs && node scripts/check-classes.mjs && node scripts/check-links.mjs && node scripts/check-licences.mjs",
     "reproducible": "node scripts/verify-reproducible.mjs",
     "verify": "rm -rf dist dist-nopresale && npm run build && npm run test && npm run csp && npm run secrets && npm run gates && npm run reproducible"
   },
```

```diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
index e532a70..a00d3c9 100644
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -987,6 +987,49 @@ export function contentStorageViolations(distApp) {
   return out;
 }
 
+// B1e §4.2 (I9, N1): the root pages a package may carry beyond the four ENTRIES — pages the build writes itself, with
+// no script of their own. Every .html in a package is an ENTRIES key or one of these, at the root; anything else is an
+// unknown page (bundleViolations follows the scripts of every page, and refuses nothing for a page with none). A static
+// page links, loads and runs nothing: the spec's strings refused over the raw file, case-insensitive (every `<` of a
+// licence text is escaped by scripts/licences.mjs, so none can come from one), an on…= attribute in any tag, and
+// only the tags and attributes plain text needs.
+export const STATIC_PAGES = ['licenses.html'];
+export const STATIC_PAGE_REFUSED = ['<a', 'href=', '<script', '<link', '<style', 'style=', '<iframe', '<form'];
+const STATIC_PAGE_TAGS = {html: ['lang'], head: [], meta: ['charset'], title: [], body: [], h1: [], h2: [], p: [], pre: []};
+const ON_ATTRIBUTE = /<[a-z][^>]*[\s/'"]on[a-z]+\s*=/i;
+
+export function staticPageViolations(path, html) {
+  const out = [];
+  const raw = html.toLowerCase();
+  for (const s of STATIC_PAGE_REFUSED) if (raw.includes(s)) out.push(`${path} contains ${s} — a static page links, loads and runs nothing`);
+  if (ON_ATTRIBUTE.test(html)) out.push(`${path} has an on…= attribute — a static page runs nothing`);
+  for (const tag of htmlTags(html)) {
+    const allowed = STATIC_PAGE_TAGS[tag.name];
+    if (allowed === undefined) {
+      out.push(`${path} has a <${tag.name}> — a static page is headings, paragraphs and <pre> text only`);
+      continue;
+    }
+    for (const name of tag.attrs.keys()) if (!allowed.includes(name)) out.push(`${path}: <${tag.name}> has a ${name} attribute — not one plain text needs`);
+    if (tag.name === 'meta' && (tag.attrs.get('charset') ?? '').toLowerCase() !== 'utf-8') out.push(`${path}: a <meta> other than charset="utf-8"`);
+  }
+  return out;
+}
+
+/** Every page of one package directory: an entry or a static page, at the root; each static page plain text. */
+export function pageViolations(distApp) {
+  const out = [];
+  const pages = listFiles(distApp, /\.x?html?$/i).map(p => toPosix(relative(distApp, p)));
+  for (const page of pages) {
+    if (page.includes('/')) out.push(`${page} is a page below the package root — every page is an entry (ENTRIES) or a static page (STATIC_PAGES) at the root`);
+    else if (!(page in ENTRIES) && !STATIC_PAGES.includes(page)) out.push(`${page} is an unknown page — neither an entry (${Object.keys(ENTRIES).join(', ')}) nor a static page (${STATIC_PAGES.join(', ')})`);
+  }
+  for (const page of STATIC_PAGES) {
+    if (!pages.includes(page)) out.push(`INCONCLUSIVE: ${page} is missing — the static-page rule would pass trivially`);
+    else out.push(...staticPageViolations(page, readFileSync(join(distApp, page), 'utf8')));
+  }
+  return out;
+}
+
 // ── What the bundler put in the vault page (fix round 2, the authoritative backstop) ──────────────
 // vite.config.ts's chunkModules plugin writes dist/app.modules.json: for every built chunk (the KDF
 // worker's too), the source modules it carries, package-relative. However a module got in — a comment
@@ -1258,6 +1301,7 @@ if (isMain(import.meta.url)) {
   for (const d of ['app', 'chrome', 'firefox']) {
     for (const p of bundleViolations(join(ROOT, DIST, d))) problems.push(`${DIST}/${d}: ${p}`);
     for (const p of contentStorageViolations(join(ROOT, DIST, d))) problems.push(`${DIST}/${d}: ${p}`);
+    for (const p of pageViolations(join(ROOT, DIST, d))) problems.push(`${DIST}/${d}: ${p}`);
   }
   // dist/chrome and dist/firefox are copies of dist/app (scripts/build.mjs): one module map covers all three.
   const mapPath = join(ROOT, DIST, 'app.modules.json');
@@ -1283,5 +1327,5 @@ if (isMain(import.meta.url)) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log(`vault isolation ok (${DIST}): sources, built popup/background and both manifests carry no path to the vault; no chunk outside the vault page carries src/vault, src/unlock or core/keys, and no module bundled outside it reads WebAuthn (module map); no page reaches storage.session, and neither built content script names extension storage; every module bundled into the vault page is vault-page code or one of its five packages, and its stylesheets are the three named sheets, importing nothing and loading only the Geist faces; its HTML carries no inline CSS and links only its built sheets, and its code builds no CSS at run time`);
+  console.log(`vault isolation ok (${DIST}): sources, built popup/background and both manifests carry no path to the vault; no chunk outside the vault page carries src/vault, src/unlock or core/keys, and no module bundled outside it reads WebAuthn (module map); no page reaches storage.session, and neither built content script names extension storage; every page is an entry or the static licenses.html, which links, loads and runs nothing; every module bundled into the vault page is vault-page code or one of its five packages, and its stylesheets are the three named sheets, importing nothing and loading only the Geist faces; its HTML carries no inline CSS and links only its built sheets, and its code builds no CSS at run time`);
 }
```

Modify `extension/unlock.html`, `extension/src/app/screens/About.tsx`, `extension/src/app/ui/ExtIcon.tsx` and `extension/src/app/app.css`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 86f6aca..d4dd8a2 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -45,7 +45,8 @@
             <p id="wel-notice-help" class="noc-body-sm vlt-lede"></p>
           </div>
         </div>
-        <p id="wel-terms" class="noc-caption terms" hidden>By continuing you agree to the Terms and Privacy Policy.</p>
+        <!-- B1e §4.1: the two links open noc-tura.io in a new tab — a navigation, never a fetch. -->
+        <p id="wel-terms" class="noc-caption terms" hidden>By continuing you agree to the <a id="wel-terms-link" href="https://noc-tura.io/extension/terms" target="_blank" rel="noopener noreferrer">Terms</a> and <a id="wel-privacy-link" href="https://noc-tura.io/extension/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.</p>
         <div id="wel-actions" class="sticky-bar" hidden>
           <button id="wel-create" type="button" class="btn btn-primary">Create new wallet</button>
           <button id="wel-import" type="button" class="btn btn-secondary">I have a wallet</button>
```

```diff
diff --git a/extension/src/app/screens/About.tsx b/extension/src/app/screens/About.tsx
index 27d1e54..3013646 100644
--- a/extension/src/app/screens/About.tsx
+++ b/extension/src/app/screens/About.tsx
@@ -1,11 +1,46 @@
 import {useWallet} from '../WalletContext';
 import {TopBar} from '../ui/TopBar';
-import {ExtIcon} from '../ui/ExtIcon';
+import {ExtIcon, type ExtIconName} from '../ui/ExtIcon';
+import {LICENCES_PAGE, NOCTURA_PAGES} from '../../shared/links';
+
+/** #38's row labels and the screen-reader hint on a link that opens a new tab (B1e §4.1). */
+export const ABOUT_TEXT = {
+  legal: 'Legal',
+  resources: 'Resources',
+  terms: 'Terms of Service',
+  privacy: 'Privacy Policy',
+  licences: 'Open-source licenses',
+  help: 'Help & support',
+  newTab: ' (opens in a new tab)',
+} as const;
 
 /**
- * #38 about (spec §6.1). The version only (no build stamp); "noc-tura.io" as text, not a link —
- * Solscan is the one external link (§6.5). Terms, Privacy, licences and help arrive with their pages
- * (a release gate, B1e).
+ * One #38 row that is a link (B1e §4.1): the design's `.s7-row` as an `<a target="_blank" rel="noopener noreferrer">`,
+ * the explorer link's pattern (TxDetail.tsx). The browser opens it; nothing fetches it.
+ */
+function LinkRow({href, icon, title, chev}: {href: string; icon: ExtIconName; title: string; chev: 'arrow-up-right' | 'chevron-right'}) {
+  return (
+    <a className="s7-row" href={href} target="_blank" rel="noopener noreferrer">
+      <span className="s7-glyph">
+        <ExtIcon name={icon} size={20} />
+      </span>
+      <span className="s7-title">
+        {title}
+        <span className="app-sr">{ABOUT_TEXT.newTab}</span>
+      </span>
+      <span className="s7-meta" />
+      <span className="s7-chev">
+        <ExtIcon name={chev} size={16} />
+      </span>
+    </a>
+  );
+}
+
+/**
+ * #38 about (spec §6.1; B1e §4.1). The version only (no build stamp). Legal: Terms of Service and Privacy Policy open
+ * noc-tura.io in a new tab (the external-link arrow, as drawn), Open-source licenses opens the package's own
+ * licenses.html in a new tab (the in-app chevron, as drawn). Resources: Help & support (noc-tura.io, a new tab), then
+ * "noc-tura.io" as text, not a link.
  */
 export function About({onBack}: {onBack: () => void}) {
   const m = useWallet();
@@ -23,8 +58,15 @@ export function About({onBack}: {onBack: () => void}) {
           <p className="noc-body-sm app-muted">Solana wallet for your browser — your keys stay on this device.</p>
           <p className="noc-caption noc-mono app-dim">v{m.platform.version()}</p>
         </div>
-        <p className="noc-overline app-dim">Resources</p>
+        <p className="noc-overline app-dim">{ABOUT_TEXT.legal}</p>
+        <div className="s7-list">
+          <LinkRow href={NOCTURA_PAGES.terms} icon="doc" title={ABOUT_TEXT.terms} chev="arrow-up-right" />
+          <LinkRow href={NOCTURA_PAGES.privacy} icon="shield-check" title={ABOUT_TEXT.privacy} chev="arrow-up-right" />
+          <LinkRow href={LICENCES_PAGE} icon="book" title={ABOUT_TEXT.licences} chev="chevron-right" />
+        </div>
+        <p className="noc-overline app-dim">{ABOUT_TEXT.resources}</p>
         <div className="s7-list">
+          <LinkRow href={NOCTURA_PAGES.help} icon="help" title={ABOUT_TEXT.help} chev="arrow-up-right" />
           <div className="s7-row app-static">
             <span className="s7-glyph">
               <ExtIcon name="globe" size={20} />
```

```diff
diff --git a/extension/src/app/ui/ExtIcon.tsx b/extension/src/app/ui/ExtIcon.tsx
index b6adc7d..4b3f38f 100644
--- a/extension/src/app/ui/ExtIcon.tsx
+++ b/extension/src/app/ui/ExtIcon.tsx
@@ -65,9 +65,19 @@ export type ExtIconName =
   // B1d-1b Task 6: #50b's "Why this matters" row (#i-file-text), from the sprite.
   | 'file-text'
   // B1d-2 Task 4: #24's "Share invite link" (#i-share), from the sprite.
-  | 'share';
+  | 'share'
+  // B1e-1 Task 6: #38's "Help & support" row (#i-help), from the sprite.
+  | 'help';
 
 const PATHS: Record<ExtIconName, ReactNode> = {
+  // B1e-1 Task 6, from the design's sprite: #i-help.
+  help: (
+    <>
+      <circle cx="12" cy="12" r="10" />
+      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
+      <line x1="12" y1="17" x2="12.01" y2="17" />
+    </>
+  ),
   // B1d-1b, from the design's sprite: #i-rocket and #i-buy.
   rocket: (
     <>
```

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index b4e451e..4c9717c 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -400,6 +400,11 @@ a.btn {
 .app-static {
   cursor: default;
 }
+/* B1e §4.1: #38's link rows — the design's `.s7-row` on an <a>: no underline, the row's own colours. */
+.app-about-body a.s7-row {
+  color: inherit;
+  text-decoration: none;
+}
 .app-about-card {
   background: var(--bg-surface-1);
   border-radius: var(--radius-2xl);
```

- [ ] **Step 4: Run — green, the whole suite, both builds, the gates, the affected E2E.**

Run: the Step 2 command — `Test Files  10 passed (10)` · `Tests  564 passed (564)` (rev 2: licences +2, check-links +1).

Run (in `extension/`): `npx tsc --noEmit; echo $?` — `0`. `TZ=UTC npm run verify` — exit 0: `Test Files  239 passed (239)` · `Tests  5255 passed (5255)` (rev 2.1; Task 5's 234 / 5176: +5 files, +79 — licences 23, check-links 18, rpcWebsockets 4, rpId 3, about 7, check-vault-isolation +15, presaleBuilds +7, welcome +1, links +1); the no-presale run `Test Files  22 passed (22)` · `Tests  531 passed | 25 skipped (556)` (unchanged); `CSP ok` for both; the secrets gate; `npm run gates` with, for `dist` and `dist-nopresale`:
- `vault isolation ok (…): … every page is an entry or the static licenses.html, which links, loads and runs nothing; …`
- `links ok (…): every URL string in chrome/ and firefox/ is one of the link table's, in a file it allows, and the four links the user is given are present (licenses.html skipped by name — the static-page rule holds there)`
- `licences ok (…): rpc-websockets resolves to its stub and renders 0 bytes; app/, chrome/ and firefox/ carry the licence page of the code this build renders`
- and `no presale ok (dist-nopresale off, dist on): …` unchanged;
then `reproducible: presale chrome 28 files sha256:5c495115…`, `presale firefox 28 files sha256:9e0bd366…`, `no-presale chrome 28 files sha256:995b8e80…`, `no-presale firefox 28 files sha256:f5510f92…` — four builds, each pair equal (the hashes are this dry run's; a later tree changes them — the count, 28, is the check: 26 + `licenses.html` + `fonts/LICENSE.txt`).

What the store build's page lists (`dist-nopresale/chrome/licenses.html`, the same in the presale build today): Noctura (BUSL-1.1), then `@noble/curves` 1.9.7 and 2.4.0, `@noble/hashes` 1.8.0 and 2.4.0, `@scure/base` 2.4.0, `@scure/bip39` 2.4.0, `@solana/buffer-layout` 4.0.1, `@solana/codecs-core` / `-numbers` / `errors` 5.5.1, `@solana/web3.js` 1.99.0, `@wallet-standard/wallet` 1.1.1 (Apache-2.0), `base-x` 3.0.11 (two copies, one entry), `base64-js` 1.5.1, `bn.js` 5.2.5, `borsh` 0.7.0 (Apache-2.0; its `LICENSE-APACHE` and `LICENSE-MIT.txt`), `bs58` 4.0.1 (two copies, one entry; the standard MIT text — no licence file, no author), `buffer` 6.0.3, `geist` 1.7.2 (OFL-1.1, the two faces), `ieee754` 1.2.1 (BSD-3-Clause), `jayson` 4.3.0, `micro-key-producer` 0.8.6, `qrcode-generator` 2.0.4 (the standard MIT text headed "Author: Kazuhiko Arase"), `react` / `react-dom` 18.3.1, `safe-buffer` 5.2.1, `scheduler` 0.23.2, `superstruct` 2.0.2, `text-encoding-utf-8` 1.0.2 (Unlicense, from `licence-ids.json`), `uuid` 8.3.2 — 29 packages and the fonts. Not listed: `rpc-websockets` (aliased away), `eventemitter3` (it rendered 5 487 bytes only as rpc-websockets' import — the alias removed it from `background.js`), `@wallet-standard/base` (types only, 0 bytes).

Run the E2E the task touches (the new spec; #1's flows, the vault page's CSP walk and visuals; #38's specs; the damaged screens on the vault page; the off build): `npx playwright test e2e/links.spec.ts e2e/onboarding.spec.ts e2e/visual.spec.ts e2e/visual-vault.spec.ts e2e/csp.spec.ts e2e/presaleOff.spec.ts e2e/damaged.spec.ts e2e/settings.spec.ts e2e/visual-settings.spec.ts` — `35 passed (9.5m)`; and under `unshare -rn sh -c 'ip link set lo up && npx playwright test …'` — `35 passed (9.7m)`. After the wrap (the amended commit): `npm run verify` again (above, reproducible included) and `npx playwright test e2e/links.spec.ts` — `4 passed (17.7s)`, under `unshare -rn` — `4 passed (15.8s)`. **And the whole suite** (rev 1, the controller's ruling: Tasks 4 and 6 run it), on the rebuilt a5d3918, launched detached with a log and a marker and waited for with a bounded poll: `npx playwright test --reporter=line` — **`112 passed (28.7m)`**; `unshare -rn sh -c 'ip link set lo up && npx playwright test --reporter=line'` — **`112 passed (28.5m)`**. (Long: launch detached with a log and a marker.)

No repo-root `src/` or `core/` change: root `tsc` / `jest` and web `verify` are not run.

- [ ] **Step 5: Commit.**

```bash
git add -A extension
git commit -m "feat(extension): B1e-1 links and licences — #1's Terms and Privacy Policy and #38's Legal and Resources rows open noc-tura.io or the package's licenses.html in a new tab (noopener noreferrer, never fetched); licenses.html generated from the modules with rendered code, the owner's licence allowlist, licence-ids.json and the Geist fonts, a static page the gates admit by name; the link gate (every URL string exactly the table's) and the licence gate (rpc-websockets aliased to a two-export stub that renders 0 bytes; each package's page matches the build's maps); RP_ID pinned to HOST_PERMISSIONS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked), `timeout 300`; `tsc`'s own exit code first, then the named tests or gates.** A gate row builds the store build in the copy (`node scripts/build.mjs --no-presale`, `NODE_ENV` unset) and runs the gate with `NOCTURA_DIST=dist-nopresale`; a "dist" row copies the clone's built `dist-nopresale` into the copy instead (the mutant changes a gate, not the package). `LT` = `scripts/__tests__/licences.test.mjs` (21; 19 before the wrap ruling), `KT` = `scripts/__tests__/check-links.test.mjs` (17; the rows to M-welcome-target were observed on its first 16 — Review Focus 2's row was added at the plan's assembly, and M-scheme-relative is observed on all 17), `PB` = `scripts/__tests__/presaleBuilds.test.mjs` (19; 18 before), `RP` = `src/vault/__tests__/rpId.test.ts` (3), `AB` = `src/app/__tests__/about.test.tsx` (7), `WT` = `src/unlock/__tests__/welcome.test.ts` (7). Files: `LIC` = `scripts/licences.mjs`, `LNK` = `scripts/check-links.mjs`, `BLD` = `scripts/build.mjs`, `ABT` = `src/app/screens/About.tsx`, `SRC` = `manifest/source.mjs`, `VC` = `vite.config.ts`, `BG` = `src/background/index.ts`, `IDS` = `release/licence-ids.json`. `H2` = `licencePage`'s per-entry line `` return `<h2>${escapeHtml(title)}</h2>\n<p>…</pre>\n`; ``.

| id | the change | named test / gate → observed |
|---|---|---|
| M-new-url | ABT: `<p className="noc-caption app-dim">© 2026 Noctura</p>` → `<p className="noc-caption app-dim">© 2026 Noctura · https://lib.example/docs</p>` (a new URL string appears in a chunk) | tsc 0 · build exit 0 · `check-links.mjs` exit **1** — `dist-nopresale/chrome: assets/mount-….js names "https://lib.example/docs" — a URL the link table does not name` (and firefox) |
| M-inert-char | LNK: the uuid row `uuid#getrandomvalues-not-supported', where: JS` → `uuid#getrandomvalues-not-supportex', where: JS` (dist) | tsc 0 · `check-links.mjs` on the real package exit **1** — `dist-nopresale/chrome: background.js names "https://github.com/uuidjs/uuid#getrandomvalues-not-supported" — a URL the link table does not name` · KT RED `7 failed \| 9 passed (16)` — “passes a package that names only the table’s strings, each where it may be, with the four links present”; “fails an inert string changed by one character” (+5 more) |
| M-missing-target-pkg | the real store package (dist), every `https://noc-tura.io/extension/privacy` removed from `chrome/` and `firefox/` (4 occurrences: `unlock.html` and the About chunk, each browser) — §4.3's control on a copy | `check-links.mjs` exit **1** — `dist-nopresale/chrome: https://noc-tura.io/extension/privacy (Privacy Policy (#1, #38)) is in no file — the link the user is given is gone` (and firefox) |
| M-missing-target | ABT: the Privacy Policy `<LinkRow … />` line removed; `unlock.html`: ` and <a id="wel-privacy-link" … >Privacy Policy</a>` → ` and Privacy Policy` | tsc 0 · AB RED `4 failed \| 3 passed (7)` — “Legal then Resources, the rows in the design’s order, each a link but noc-tura.io”; “Privacy Policy opens https://noc-tura.io/extension/privacy in a new tab, noopener noreferrer” (+2 more) · WT RED `2 failed \| 5 passed (7)` — “idle: … the terms line with its two links, both CTAs in design order”; “B1e §4.1: the two links are the shared table’s, literally …” · the link gate exit **0** — **by design, recorded**: the gate pins strings, and `NOCTURA_PAGES.privacy` is still in the chunk (the table object is kept whole); the rows are pinned by AB and WT (Notes for the executor) |
| M-skip-removed | LNK: `export const SKIPPED = ['licenses.html'];` → `export const SKIPPED = [];` (dist) | tsc 0 · `check-links.mjs` on the real package exit **1** — `dist-nopresale/chrome: licenses.html names "https://paulmillr.com" — a URL the link table does not name` (×N, licenses.html only) · PB RED `1 failed \| 17 passed (18)` — “the link gate passes the real packages; with its skip removed it fails on the real licenses.html, and only there” |
| M-plant-a | LIC: `H2` prefixed with `<a href="https://evil.example/">x</a>` | tsc 0 · LT RED `2 failed \| 17 passed (19)` — “the page is plain text: every < escaped, no tag beyond plain text — the static-page rule holds on it”; “a limitation, as a test: …” · build exit 0 · `check-vault-isolation.mjs` exit **1** — `dist-nopresale/app: licenses.html contains <a — a static page links, loads and runs nothing`, `… contains href= …`, `… has a <a> …` (app, chrome, firefox) |
| M-plant-script | LIC: `H2` prefixed with `<script src="x.js"></script>` | tsc 0 · LT RED `2 failed \| 17 passed (19)` (the same two) · build exit 0 · `check-vault-isolation.mjs` exit **1** — `dist-nopresale/app: licenses.html imports x.js, which is not a built file`, `licenses.html contains <script — …`, `licenses.html has a <script> — …` |
| M-plant-style | LIC: `H2` prefixed with `<style>h2{color:red}</style>` | tsc 0 · LT RED `2 failed \| 17 passed (19)` (the same two) · build exit 0 · `check-vault-isolation.mjs` exit **1** — `dist-nopresale/app: licenses.html contains <style — a static page links, loads and runs nothing`, `licenses.html has a <style> — …` |
| M-escape | LIC: `escapeHtml` loses `.replace(/</g, '&lt;')` | tsc 0 · LT RED `2 failed \| 17 passed (19)` (the same two) · build exit 0 · `check-vault-isolation.mjs` exit **1** — `dist-nopresale/app: licenses.html has a <mail@tedeh.net&gt;> — a static page is headings, paragraphs and <pre> text only`, `… has a <http:> …` (jayson's author, the Unlicense's `<http://unlicense.org/>`) |
| M-no-page | BLD: `writeFileSync(join(app, LICENCE_PAGE), buildLicencePage(ROOT, outRoot));` → `buildLicencePage(ROOT, outRoot);` | tsc 0 · PB RED `5 failed \| 13 passed (18)` — “each build carries one licenses.html — the same file in app/, chrome/ and firefox/”; “lists Noctura, then exactly the packages with rendered code and the Geist fonts — no other” (+3 more) · build exit 0 · `check-vault-isolation.mjs` exit **1** — `dist-nopresale/app: INCONCLUSIVE: licenses.html is missing — the static-page rule would pass trivially` · `check-licences.mjs` exit **1** — `dist-nopresale: app/licenses.html is missing` (and chrome, firefox) |
| M-extra-page | BLD: after the page's write, `writeFileSync(join(app, 'extra.html'), '<p>x</p>');` | tsc 0 · build exit 0 · `check-vault-isolation.mjs` exit **1** — `dist-nopresale/app: extra.html is an unknown page — neither an entry (popup.html, wallet.html, unlock.html, approve.html) nor a static page (licenses.html)` (app, chrome, firefox) |
| M-ids-row | IDS: the row `"text-encoding-utf-8@1.0.2": "Unlicense"` deleted (`{}`) | tsc 0 · LT RED `1 failed \| 18 passed (19)` — “licence-ids.json has the one row today: text-encoding-utf-8@1.0.2 → Unlicense” (the fixture's own row-removed control is in the same file) · build exit **1** — `Error: licence page:` `text-encoding-utf-8@1.0.2 (…/node_modules/text-encoding-utf-8): has rendered code, no license field and no row in release/licence-ids.json — classify it there` |
| M-ids-lgpl | IDS: `"Unlicense"` → `"LGPL-3.0-only"` | tsc 0 · LT RED `1 failed \| 18 passed (19)` (the same row) · build exit **1** — `text-encoding-utf-8@1.0.2 (…): LGPL-3.0-only is outside the licence allowlist (MIT, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, OFL-1.1, Unlicense) — adding to it is the owner's decision` |
| M-no-wrap | LIC: `<pre>${escapeHtml(wrapText(e.text))}` → `<pre>${escapeHtml(e.text)}` (the wrap disabled) | tsc 0 · LT RED `1 failed \| 20 passed (21)` — “the page: no line of a <pre> over 100 columns but a one-word line; each text, whitespace collapsed, is the licence text” · PB RED `1 failed \| 18 passed (19)` — “the real licenses.html never scrolls sideways: no line of a <pre> over 100 columns but a one-word line (a <p> wraps)” |
| M-wrap-drops | LIC (`wrapText`): `current = word;` at a break → `current = word.slice(1);` (a break loses a character) | tsc 0 · LT RED `2 failed \| 19 passed (21)` — “wraps every line longer than 100 columns at word boundaries; a word longer than 100 stays whole; nothing but the breaks changes”; “the page: no line of a <pre> over 100 columns …” |
| M-rendered | LIC: `if (length > 0) out.add(` → `if (length >= 0) out.add(` (tree-shaken modules counted) | tsc 0 · LT RED `9 failed \| 10 passed (19)` — “lists Noctura first, then every package with rendered code and the fonts … — a package rendered 0 is absent”; “copies with the same name, version and text are one entry …” (+7 more) · PB green `18 passed (18)` — today's real maps carry no package at 0 bytes (the alias removed the only one), so LT's fixture is what pins the rule |
| M-connection | BG: `import {Connection} from '@solana/web3.js';` added and `if (Math.random() > 2) new Connection(String(Date.now()));` appended | tsc 0 · build exit 0 · `check-licences.mjs` exit **1** — `dist-nopresale: app.modules.json: background.js renders 325 bytes of src/shared/rpcWebsocketsStub.ts — something constructs a Connection (a socket client); nothing the extension bundles may` |
| M-alias | VC: `    resolve: {alias: rpcWebsocketsAlias()},` removed | tsc 0 · build exit 0 · `check-licences.mjs` exit **1** — `dist-nopresale: app.modules.json: background.js carries "…/node_modules/rpc-websockets/dist/index.browser.mjs" — rpc-websockets must resolve to src/shared/rpcWebsocketsStub.ts (the alias)` · PB RED `1 failed \| 17 passed (18)` — “rpc-websockets is in neither build’s maps (the alias took), and text-encoding-utf-8 1.0.2 ships under the Unlicense” |
| M-rp-host | SRC: the `{value: 'https://wallet.noc-tura.io/*', reason: …}` entry removed from `HOST_PERMISSIONS` | tsc 0 · RP RED `1 failed \| 2 passed (3)` — “is a host the manifest claims: `https://${RP_ID}/*` is a HOST_PERMISSIONS value” |
| M-about-rel | ABT: `<a className="s7-row" href={href} target="_blank" rel="noopener noreferrer">` → `… rel="noopener">` | tsc 0 · AB RED `4 failed \| 3 passed (7)` — “Terms of Service opens https://noc-tura.io/extension/terms in a new tab, noopener noreferrer”; “Privacy Policy opens …” (+2 more) |
| M-about-target | ABT: the same line without `target="_blank"` | tsc 0 · AB RED `4 failed \| 3 passed (7)` (the same four rows) |
| M-welcome-rel | `unlock.html`: the Terms link's `rel="noopener noreferrer"` → `rel="noreferrer"` | tsc 0 · WT RED `1 failed \| 6 passed (7)` — “idle: the design’s copy, two trust chips (no "ZK-private", D6), the terms line with its two links, both CTAs in design order” |
| M-welcome-target | `unlock.html`: the Privacy Policy link without `target="_blank"` | tsc 0 · WT RED `1 failed \| 6 passed (7)` (the same row) |
| M-scheme-relative (Review Focus 2) | LNK: ``export const URL_LITERAL = /\b(?:https?\|wss?\|ftp):\/\/[^\s"'`<>)\\;]*/g;`` → ``export const URL_LITERAL = /(?:\b(?:https?\|wss?\|ftp):)?\/\/[^\s"'`<>)\\;]*/g;`` (the extraction also takes a scheme-relative `//host`) | tsc 0 · KT RED `1 failed \| 16 passed (17)` — “the link gate (B1e §4.3) › a known limit, not a pass (plan Review Focus 2): a URL never written whole is not seen — the scheme split from its "://", a scheme-relative //host, a base64 text” — the limit row reads the gate's real pattern: a gate that saw more would turn it red, and the row would be rewritten with the gate |

Rev 2's rows (review M1, M5, M6), observed on the rebuilt 5c9cbd3 (`LT` now 23 rows, `KT` 18):

| id | the change | named test → observed |
|---|---|---|
| M-chunks-vacuous (M1) | GL: the new `if (map.chunks === null \|\| typeof map.chunks !== 'object') { … continue; }` removed and `Object.entries(map.chunks)` → `Object.entries(map.chunks ?? {})` (rev 1's loop) | tsc 0 · LT RED `1 failed \| 22 passed (23)` — “the licence gate (B1e §4.2, E16) › a map without its chunks section is INCONCLUSIVE — never a vacuous "in no chunk" (review M1)” |
| M-svg (M5) | LNK: `const READ = /\.(?:js\|html\|css\|json\|svg)$/;` → `const READ = /\.(?:js\|html\|css\|json)$/;` | tsc 0 · KT RED `1 failed \| 17 passed (18)` — “the link gate (B1e §4.3) › reads an SVG document too: a link planted in one fails (review M5); a .txt or a font is still not read” |
| M-ids-override (M6) | LIC: the table consulted first — `if (typeof table[key] === 'string') spdx = table[key];` inserted before `if (typeof declared === 'string' && declared !== '') spdx = declared;` (made an `else if`) | tsc 0 · LT RED `1 failed \| 22 passed (23)` — “the licence page (B1e §4.2) › licence-ids.json cannot override a license field the package has: an SPDX expression or a {type} object still fails, and says so” |
| M-ids-message (M6) | LIC: ``const from = declared === spdx ? ` (its license field; ${noOverride})` : '';`` → `const from = '';` | tsc 0 · LT RED `2 failed \| 21 passed (23)` — “the licence page (B1e §4.2) › a rendered LGPL package fails the build; a package rendered 0 is never judged”; the M6 row above |

Rev 1's 24 rows re-run on 5c9cbd3 with the same outcomes: every one `tsc` 0; red in its named tests or gates (LT counts now of 23, e.g. M-plant-a `2 failed \| 21 passed (23)`, M-rendered `11 failed \| 12 passed (23)`; KT of 18, M-inert-char `9 failed \| 9 passed (18)`, M-scheme-relative `1 failed \| 17 passed (18)`); M-missing-target red in AB and WT and green in the link gate, by design, as in rev 1. (The sweep's `H2` edit had to be rewritten to the wrapped form, `${escapeHtml(wrapText(e.text))}` — rev 1 ran the four `H2` rows on the commit before the wrap ruling; the change column above is unchanged.)

28 rows (23 from the dry run, M-scheme-relative from the assembly's Review Focus row, rev 2's M-chunks-vacuous, M-svg, M-ids-override and M-ids-message — and, rev 2, every row re-run on the rebuilt 5c9cbd3: every one `tsc` 0 with rev 1's outcome, the four new red), all counted, all run on the final commit (M-no-wrap and M-wrap-drops on the amended one, after the coordinator's wrap ruling; the other 21 rows touch nothing the wrap changed, and their counts are the first commit's — LT 19 rows, PB 18 — before the wrap ruling added two and one): every mutant `tsc` 0; 22 red in each named test or gate; **M-missing-target is red in its two unit files and green in the link gate, by design** — the gate checks that the string is in the package, the unit tests check that the rows and links carrying it exist; M-missing-target-pkg is the gate's own control. The sweep: `b1e1-t6/mut.py` (scratch).

What the sweep found, fixed or recorded before the final commit: **M-missing-target first ran against the gate only and survived** (the table object `NOCTURA_PAGES` keeps the string in the chunk when a row goes) — it is now run against AB and WT, which turn red, and the gate's presence rule got its own package-copy control (§4.3's "removed → fails"). The E2E's first "licenses.html loads nothing" check (Playwright `request` events, then resource timing) was **vacuous** — its positive control found zero entries for `popup.html` too — and was replaced by the DevTools network log (Notes for the executor). The first real-package run of the link gate inside vitest found `presaleBuilds.test.mjs`'s builds were React's development build (`NODE_ENV=test`), fixed in that file.

#### Notes for the executor (Task 6)

- **Rev 2 — review M1: a map without `chunks` is INCONCLUSIVE.** `rpcWebsocketsViolations` read `map.chunks ?? {}`, so a map with no (or a non-object) `chunks` section passed the "in no chunk" half vacuously (the review: `check-licences` printed "licences ok" with `chunks` deleted). It now answers `INCONCLUSIVE: <map> has no chunks section — whether rpc-websockets is in a chunk is unknown`, as it already did for `rendered`; a row checks `undefined`, `null` and a string, with the same map's positive control; M-chunks-vacuous (the old `?? {}` back) is red.
- **Rev 2 — review M5: the link gate reads `.svg`.** `READ` gains `svg` (an SVG document can carry `<a xlink:href>`); none ships today. A row plants one in `icons/x.svg` (its link and its namespace URL fail) and shows a `.txt` and a `.woff2` with the same text are still unread; M-svg is red.
- **Rev 2 — review M6: the licence failure says the table cannot override a present field.** `licences.mjs` names the source: a `license` field that is not a string, or names a licence outside the allowlist, fails with "release/licence-ids.json cannot override a license field the package has"; a table-sourced licence keeps the old message. A row gives `zeta` a `licence-ids.json` row AND an SPDX expression `MIT OR Apache-2.0`, then a `{type}` object (both fail, saying so), then no field (the same row classifies it — the positive control). M-ids-override (the table consulted first) and M-ids-message (the note dropped) are red. The comment "a license field the package has wins" is that row's claim.
- **Rev 2 — Review Focus 2 / review M4 and Q6:** spec §4.3 (rev 2.3) now says the gate is a review aid, not a security boundary. The review's optional strengthening (a source rule that every `href` / `window.open` / `openPage` argument is an import from `links.ts` / `explorer.ts` or a page-local literal) is **not built** — the owner's ruling asked for the sentence only; it would be a new gate with its own controls, beyond this plan's scope.
- Rev 2 totals: `239 / 5247` under `TZ=UTC` (Task 5's +27, this task's +3); rev 2.1: `239 / 5255`, the no-presale run unchanged; gates and both builds 0.
- **Rolldown, not Rollup.** Vite 8 bundles with Rolldown; `chunk.modules[id].renderedLength` is there (`RenderedModule`), and a module tree-shaken to nothing is still a key of `chunk.modules` — at 0 — when it has side effects (rpc-websockets without the alias), but disappears from the chunk entirely when it has none (the stub): so "the stub is in no chunk" is today's normal, and the gate's positive control that the alias took is the other side — the real package is in **no** map, where without the alias it is in `background.js`'s at 0 bytes (M-alias).
- **`presaleBuilds.test.mjs` built React's development build until now.** vitest sets `NODE_ENV=test` and Vite keeps a `NODE_ENV` it finds; the two builds that file makes carried React's development warnings (`https://reactjs.org/link/…` and web3.js's `https://sola.na/web3invariant` in the link gate's first run). The file now strips `NODE_ENV` from their environment and asserts production (React's error decoder present, no `reactjs.org/link/`). Every assertion that file already had still passes.
- **Playwright reports no `chrome-extension://` request, and resource timing has no entries on an extension page.** The E2E's "licenses.html loads nothing" reads the browser's own network log through a DevTools session (`Network.requestWillBeSent`) on a fresh tab; its positive control is the same log of `popup.html`, which sees its scripts. Both earlier forms were found vacuous by their positive controls in this dry run and are not used.
- **Clicking a noc-tura.io link in the E2E is safe and is what proves the new tab.** The contained browser routes every noc-tura.io name and aborts it (`containNocTura`), and the names do not resolve (`RESOLVER_MAP`): the click opens a tab whose one request is recorded and aborted; the spec asserts exactly those navigations, in order. No test contacts the host.
- `licenses.html` is plain HTML with no stylesheet: the browser's default serif and `<pre>` monospace (shots in the Notes for the executor). A `<pre>` cannot wrap without CSS and the static-page rule refuses CSS, so the generator wraps (coordinator ruling): every licence line over 100 columns is broken at word boundaries (`wrapText`; three texts need it today — `ieee754` 755 characters, `superstruct` and `uuid` 460). Only line breaks change: whitespace collapsed, every text is identical (tested); a single word over 100 stays whole on its own line. The intro `<p>` wraps on its own and is not counted. At 1280 px the page has no sideways scroll; at 412 px it still has (593 px: a 100-column line in the default monospace) — Notes for the executor.
- **Review Focus 2 (added at the plan's assembly, rev 1): what the link gate cannot see, written as a test.** The gate reads URL strings as written; a URL never written whole — `"http"+"s://…"`, a scheme-relative `//host`, a base64 text — has no string to read. The row "a known limit, not a pass …" pins exactly that (`urlStrings` finds nothing, the package passes), beside its two controls: the same URL written whole fails, and so does a whole scheme with the host added at run time (`"https://"+h` names `https://`). Accepted, not closed: the gate guards against an unreviewed URL in the shipped code, not against code written to hide one — that is review's; at run time `connect-src` still limits every fetch (`npm run csp`), and every link the user is given is a whole string from `src/shared/links.ts` (`about.test.tsx`, `welcome.test.ts`).
- The vitest totals are given under `TZ=UTC` (Task 3's `Send.test.tsx` DST finding, fixed in Task 7).

#### Notes for the executor (Task 6, continued) — the dry run's rulings, deviations and hand-over

- Ruling: the RP ID test pins `https://${RP_ID}/*` ∈ `HOST_PERMISSIONS` (and `RP_ID === 'wallet.noc-tura.io'`) but **not** "`RP_ID` equals `rp-id.json`'s" — `extension/release/rp-id.json` is the owner's pre-upload record (`confirmedBy: 'owner'`, §5.6, §7 step 3) that `release:chrome` refuses to pack without; writing it in B1e-1 would pre-empt the confirmation the gate exists to force — cost if wrong: one assertion and one file, added by B1e-2 with its gate (**flag for B1e-2's plan**).
- Ruling: the manifest source is read in the TS test through `import.meta.glob(…, {eager: true})` and shape-checked, not imported — `source.mjs` has no types and `tsconfig` has no `allowJs`; a `.d.mts` beside it could drift from the real file — cost if wrong: none (the glob reads the real module; the positive control asserts the coordinator's entry is read).
- Ruling: the rpc-websockets gate is stricter than §4.2's wording: the real package must be in **no** chunk of any map (not only "rendered 0"), and the stub must render 0 — why: with the alias the package never enters the graph and a planted `new Connection` renders the **stub** (325 bytes observed), not `node_modules/rpc-websockets/`, so the spec's literal rule would pass M-connection; and "the package is in no map" is the only built evidence that the alias took (without it the package sits in `background.js`'s map at 0 bytes) — cost if wrong: none for today's build (both hold).
- Ruling: the alias is `resolve.alias` in `appConfig` (main build, worker, vitest); the content scripts' config has none — they import no web3.js (the page-bundle gate already limits them to their own sources and @wallet-standard).
- Ruling: the alias's runtime test bundles web3.js's **browser** build (`lib/index.browser.esm.js`, the file the extension bundles) with Vite under `rpcWebsocketsAlias()` and runs it in node — vitest's own resolution would load web3.js's node build with the real rpc-websockets and prove nothing. It also asserts `new Connection(…)` throws the stub's message: the proof the alias took inside that bundle.
- Ruling: the link table gains one presale-build-only row, `https://noc-tura.io?ref=${}` (#24's invite link, `core/referral`), absent from §4.3's probe because the probe built only `--no-presale`; a template interpolation in a match is folded to `${}` so a minifier's renaming (`${e}`) is one string while `…/terms${x}` still fails; the row is refused in the store build — cost if wrong: one row (→ rev 2.2).
- Ruling: `where` per row — the coordinator only in `manifest.json` / `background.js` (§4.3), the RP host only in `manifest.json`, the four navigable links in a page file (`.js` / `.html`), the inert strings and the referral link in `.js` only; §4.3 names files for the first two kinds only.
- Ruling: the static-page rule is §4.2's raw-file list **plus** a tag and attribute allowlist (`html[lang]`, `head`, `meta[charset=utf-8]`, `title`, `body`, `h1`, `h2`, `p`, `pre`) — a `<meta http-equiv="refresh">`, an `<img>`, a `<base>` or an `<svg>` would link or load without any of the listed strings; the `on…=` attribute is matched inside a tag only (licence prose like "one = two" is not a tag) — cost if wrong: none (the generator emits only these).
- Ruling: `pageViolations` also refuses an `.html` below the package root, and a missing `licenses.html` is INCONCLUSIVE (the rule would otherwise pass an empty package).
- Ruling: the licence gate (`check-licences.mjs`, in `gates:build`) also asserts each package's `licenses.html` is byte-identical to the page the build's maps give — a hand edit or a stale page fails; the build itself fails on an unnamed or refused licence (§4.2 "the build fails").
- Ruling: a package without a licence file gets the standard text headed "Author: <author>" (`name <email> (url)` for an object) or "The package names no author." (`bs58` 4.0.1 has neither a file nor an author), plus one line saying the text is the standard one its `package.json` names — never an invented copyright holder; a package with several licence files shows each under its file name (`borsh`).
- Ruling: the fonts' entry pins both faces' sha256 to geist@1.7.2's (verified against the npm tarball, `npm pack geist@1.7.2`): a changed face fails the build until its licence entry is revisited; `fonts/LICENSE.txt` (copied by Vite from `public/`) ships in every package beside the faces — OFL 1.1 asks for the licence to accompany the font software — and is the one non-face file the fonts rule admits.
- Ruling: "Open-source licenses" opens `licenses.html` with the in-app chevron as drawn (it is a page of the package), the three noc-tura.io rows with the arrow; every link row carries a screen-reader suffix " (opens in a new tab)" (`.app-sr`) — **flag: new copy** (not in the spec or the design).
- Ruling: the vitest builds in `presaleBuilds.test.mjs` drop vitest's `NODE_ENV=test` — they were React's development build (found by the link gate's first real-package run); a new row asserts production. No existing assertion changed.
- Deviation (loud, coordinator-accepted): the design's "142 packages" meta on #38's licences row is not built — the popup cannot know the count (the page is generated after the popup is bundled; the CSP's `connect-src` refuses reading the package's own file). The page itself says "Noctura ships the code of 29 open-source packages and the Geist fonts." — **flag: new copy**, as is the page's whole text (title "Open-source licenses · Noctura", the h1, the line, each entry's SPDX line, the two no-file lines); `licenses.html` is undrawn (§9).
- Deviation (coordinator-accepted): §4.1 says #1's line is "under the buttons, as drawn"; the design draws it above them (index.html #1: the `.terms` paragraph precedes the `.sticky-bar`). Built as drawn — the position is unchanged from today. → rev 2.2 departure.
- Deviation: the brief lists the built content-script `storage` check under Task 6; it is Task 4's (`contentStorageViolations`) and is not touched here.
- Spelling: the user-visible rows follow the design ("Open-source licenses", "Terms of Service", "Privacy Policy", "Help & support"); the file names follow the spec (`licenses.html`, `release/licence-ids.json`, `release/licence-texts/`, `scripts/licences.mjs`).
- Coordinator ruling (applied): `licenses.html` must not scroll sideways — the generator wraps every licence line over 100 columns at word boundaries (`wrapText`, greedy, deterministic; the whitespace run at a break becomes the break; a word over 100 stays whole). Tests: no `<pre>` line over 100 but a one-word line (fixture and both real builds), whitespace-collapsed identity per entry, idempotence; mutations M-no-wrap and M-wrap-drops. Measured on the `<pre>` lines only: the intro `<p>` wraps in the browser. Re-shot: `lic-1280-top.png`, `lic-412-top.png`, `lic-412-borsh.png`, `lic-412-ieee754.png`. At the tab's real size (1280 × 800 — the page opens in a browser tab) `scrollWidth` equals the viewport (1280 / 1280; before the wrap 4 425). **Limit, recorded:** at a 412 px window it is 593 / 412 — a 100-column `<pre>` in the browser's default monospace is wider than 412 px, and so are the licences' own ~72-column lines (the OFL text, `ieee754`'s); no column count fits 412 px without CSS. If the owner wants no scroll at popup width too, the page needs a stylesheet (and the static-page rule a `<link>` to one file of ours) — an owner/spec decision, not taken here.
- Visual check (scratch only, `b1e1-t6/zz-task6-visual.spec.ts` run in the clone, then removed), store build: vault page 412 × 916 — `shots/01-welcome.png` (the line above the buttons, both words underlined in `--fg-secondary` per the design's `.terms a`), `01-welcome-terms-focus.png` (the focus ring on "Terms" by keyboard); popup 412 × 600 — `38-about-top.png`, `38-about-bottom.png` (Legal: three rows, Resources: Help & support then noc-tura.io; glyphs and chevrons as drawn; no underline), `38-about-focus.png` (the row's focus ring by Tab); licences tab — `lic-1280-top.png` (1280 × 800), `lic-412-top.png`, `lic-412-borsh.png` (plain browser defaults; `borsh`'s two files under their names) — all under `scratchpad/b1e1-t6/shots/`. Compared with index.html #1 and #38 on the rendered images: rows, order, glyphs and section labels match; the two departures above are the only differences. No fix was needed after the shots.
- Next task must know: Task 7 — `e2e/links.spec.ts` covers §10's "the links and `licenses.html`" E2E in both builds (normal and `unshare -rn` done here); the rev 2.2 list gains: the presale-only referral row and the `${}` fold, the stricter rpc-websockets rule, the tag/attribute allowlist, the page-matches-maps rule, the fonts' digests and `fonts/LICENSE.txt` in the package (28 files), the no-file header lines, the "142 packages" omission, #1's line above the buttons, the screen-reader suffix, the RP ID test's `rp-id.json` half moved to B1e-2, the licence texts wrapped at 100 columns.


### Task 7: Gates, E2E and the visual pass — the anti-phishing phrase on the six screens end to end in both builds (none, set, as text, R9, #48's F12 Reject-only with the region gate closed, the locked window), set by onboarding's step and #35, changed and removed through #10; the phrase wiped by the damaged-vault removal; Send.test's "last 12 days ago" row made time-zone proof; the visual pass of every undrawn element (§9) in a committed `e2e/visual-b1e.spec.ts`; the spec's rev 2.2 change list and (rev 2) its rev 2.3 lines; the whole suite normally and under `unshare -rn`

**Spec:** B1e §1.6 (the phrase on all six screens in both builds; nothing when unset; R9's line when the read fails; `<b>x</b>` as text; onboarding's phrase survives the first write; wiped by §2's removal), the E2E part of §2.6 / §2.3 / §10 (removal of an unreadable vault, its refusal for a wallet and for a refused vault, the save download), §3's tests end to end (#37's checkbox path), §4.4 (the links, `licenses.html`), §9 (the undrawn elements shown in a visual pass), §10 (every E2E normally and under `unshare -rn`; the visual pass at the popup's 412 × 600 and the windows' real size). **Ledger:** Task 3's ruling — `Send.test.tsx`' "last 12 days ago" row fails in local time across a DST change and is fixed here, test only; every "→ rev 2.2" departure of Tasks 1–6 goes into the spec's change list.

**What already existed (extended, not duplicated):** `e2e/damaged.spec.ts` (Task 2, + Task 3's checkbox row) — the unreadable state on #9 and #1, Save read back from Playwright's download, the removal by the hold and by the checkbox, its refusal for a refused vault (`v: 2`) and for a wallet (the real `makeEnvelope` wallet = F0's shape), "the address can't be read"; `e2e/settings.spec.ts` "15 · #37 without holding" (Task 3) — #37's checkbox path by keyboard, the proof still required; `e2e/links.spec.ts` (Task 6) — #1's two links and #38's four rows in both builds, `licenses.html` loading nothing; `e2e/csp.spec.ts` (Task 2) — the damaged states and the removal in the CSP walk. **The gap this task fills:** no E2E showed the phrase on any screen in a real browser (Task 5's six-screen check was unit tests plus a scratch visual check that skipped F12), set it through the step or #35, or ran #10 for a phrase; the removal's E2E did not check the phrase is wiped. And no committed spec shot the undrawn elements with the frame and bar checks of the existing visual specs.

**Undrawn (§9) — the visual pass, compared on rendered images:** the design's phones (`index.html` #1, #6, #9, #10, #35, #37, #38, #46–#48) were rendered to PNG in the scratchpad (`scratchpad/b1e1-t7/design/`, a scratch script) and set beside the shots in contact sheets (`scratchpad/b1e1-t7/sheets/`); no text was copied from the design (it carries the TGE date). The shots: `scratchpad/b1e1-t7/shots/b1e-*.png` (32 files, the run on the final commit; also `extension/test-results/visual/` in the clone).

| frame | shots | what they show |
|---|---|---|
| popup 412 × 600 | `b1e-popup-locked-phrase`, `-long`, `-failed` | the line under "Welcome back", before the lede: B1b's `.banner.shield` (shield glyph and the phrase in `--shield-300`), a 32-unit phrase on one line, R9 as `.banner.warning`; no sticky bar (the locked screen has none, as #9's popup derivative) |
| popup | `b1e-35-row-off`, `-card-set`, `-row-on`, `-card-change` | #35's row in "Locks" after Passkey (Off plain, On success), the card as 35c's picker card: input, helper, Set / Change + Remove, help, the note |
| popup | `b1e-37-matched`, `-understood` | #37's checkbox row directly above the hold, inside the bar, both wholly in the frame; checked: "Delete wallet", the hold caption gone |
| popup | `b1e-38-legal`, `-help` | #38's Legal rows (arrows; the licences chevron) and Resources, as drawn |
| vault page 412 × 916 | `b1e-01-terms` | #1's terms line above the two buttons, as drawn |
| vault page | `b1e-step-empty`, `-typed`, `-refused` | the step as #6's `.s-bio` (hero shield, h1, lede, B1b's input, helper, help, [Set phrase] [Skip] in the bar); the refusal line in `--danger` |
| vault page | `b1e-10-change`, `-remove` | #10 with the CURRENT phrase under the top bar and "Change / Remove the anti-phishing phrase" in the intent card — the new value nowhere |
| vault page | `b1e-09-phrase`, `-long`, `-failed` | #9: the line between the lede and the password field; R9 |
| vault page | `b1e-09-unreadable`, `b1e-01-unreadable`, `b1e-09-refused` | the damaged states from #37's danger card; Save (no underline) before Remove; the refused state with Save only |
| vault page | `b1e-rd-idle`, `-matched`, `-understood` | the removal: the card, the first account, Save + its note, the typed DELETE; the checkbox row directly above the hold; checked: "Remove damaged wallet", caption gone |
| approval window 412 × 720 | `b1e-47-phrase`, `b1e-46-phrase`, `b1e-48-phrase`, `b1e-48-f12-phrase`, `b1e-window-locked-phrase`, `-failed` | the line directly under each window's top bar (#47 unknown site, #46, #48 a transfer, #48 F12 with only Reject), first in the locked window's body; R9 there |

**Rev 2:** the owner answered the four judgements below — (1) E19, the short heading "Update Noctura to open this wallet" with the sentence as the first body line (Task 2); (2) and (3) E22, kept; (4) E20, the overline "Optional" (Task 5). The visual spec asserts both new strings (`b1e-09-refused`: the heading and the first body line, both wholly in the frame; `b1e-step-empty`: the overline); the shots of the rev 2 run were viewed: `b1e-09-refused` — the heading on two lines in the danger card, the sentence as the body's first line, Save alone in the bar; `b1e-step-empty` and `visual-vault`'s `06b-anti-phishing` — the overline OPTIONAL (upper case by `noc-overline`), no count.

**Findings of the pass (rev 1):** no defect needing a code change. Recorded for the owner (each a judgement, not a bug): (1) the refused state's heading is the spec's sentence ("This version of Noctura can't open this wallet's data.") at `noc-h2`, three lines at 412 px — long for a heading, but it is §2.2's copy; (2) #37's bar with the checkbox row is about a third of the popup's 600 px, so the funded-wallet warning scrolls under it (the copy is reachable by scrolling; the bar and every control in it are wholly in the frame); (3) #35's row says Off in the plain tone (Passkey's Off is the warning tone) — Task 5's ruling, owner to confirm; (4) the onboarding step has no step count in its top bar (it follows #6's "5 / 5", which the design draws as the last step). The phrase's colour is the same `--shield-300` on the popup and the vault page (checked at 2×: `sheets/C-line-compare.png`).

**Files:**
- Create (tests): `extension/e2e/phrase.spec.ts` (4 tests: 2 per build), `extension/e2e/visual-b1e.spec.ts` (3 tests, store build)
- Modify (tests): `extension/e2e/damaged.spec.ts` (the removal also wipes `v1_phishing_phrase`; present until the full hold), `extension/src/app/__tests__/Send.test.tsx` (the DST row)
- Modify (docs): `docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md` (rev 2.2: the status line, the change list, the passages; rev 2 of this plan adds rev 2.3's status line, its nine change lines, E19–E22 in §0 and the passages they name)
- No product code changes.

**Interfaces:**
- Consumes: Task 5's selectors — `.app-phrase-line` (popup, windows), `#unl-phrase` / `#unl-phrase-text` / `#unl-phrase-failed`, `#ra-phrase` / `#ra-phrase-text` / `#ra-phrase-failed`, `#ra-rows`, `#v-anti-phishing` / `#ap-field` / `#ap-set` / `#ap-skip` / `#ap-line`, `.s7-row` "Anti-phishing phrase" / `.s7-meta`, `.app-phrase-card`; Task 2/3's `#dmg-*`, `#rd-*`, `#rd-understood-row`, `.app-understood`; Task 6's link names; the harnesses `launchPopup`, `seedUnlockedWallet`, `contained`, `makeEnvelope`, `pastePhrase`, `setPassword`, `unlockWith`, `serveDapp`, `openDapp`, `approvalWindow`, `windowClosed`, `adapter`, `sign`, `connect`, `installPresale`, `watchCsp`, `solPurchaseIx`, `SOL_TREASURY`, `DIR`; the harness's `now` option (`WalletOptions.now`, the provider's clock).
- Produces: nothing for code. For B1e-2: the visual spec's `frame` / `wholeBar` (exact bar count, every bar control and label wholly in the frame) can shoot the store screenshots' states.

**The rule, stated once.** A screen's phrase is proved in a real browser by what it renders: the phrase as text (no element made of `<b>Blue</b> horse 42`), the shield banner with its one icon, and nothing when none is set; R9 is caused the only way it can be — the `phrase` field removed from the answer inside the page by an init script — because the real background always sends a valid field. Every approval window is reached through the real provider (StandardWalletAdapter or Wallet Standard) of a contained test dApp; F12 is the region gate closed (`/geo/check` → KP) on a real presale purchase in both builds. A visual shot is taken only after its copy is asserted, wholly in the frame and clear of the pinned bars, and after the screen's sticky bars are counted exactly and found wholly in the frame with every control in them.

- [ ] **Step 1: Write the tests.** The E2E and visual specs below are new coverage of behaviour Tasks 2–6 built; they pass on Task 6's tree (2d157ba) — no product code changes here. Their red side is the named mutations (Step 6), each a product change the spec must catch. The DST row's red side is its negative control (Step 2).

Create `extension/e2e/phrase.spec.ts`:

```ts
import {test, expect, type BrowserContext, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {contained, launchPopup, type Harness} from './popupHarness';
import {EXT, EXT_NOPRESALE} from './launch';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {pastePhrase, setPassword, unlockWith} from './vaultPage';
import {DAPP_HOSTS, adapter, approvalWindow, connect, openDapp, serveDapp, sign, windowClosed, type DappServer} from './dappPage';
import {SOL_TREASURY, solPurchaseIx} from './presaleChain';
import {installPresale, watchCsp} from './presaleHelpers';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>; remove(k: string): Promise<void>}; session: {remove(k: string): Promise<void>}};
};

// B1e §1.2, §1.3, §1.6 through the real extension, in both builds: the anti-phishing phrase on the six screens — the
// popup's locked screen, the vault page's unlock (#9, before the password field), #47, #46, #48 (a transfer, and F12's
// Reject-only purchase with the region gate closed), the locked approval window and #10 — as text (a phrase that looks
// like markup makes no element); nothing when none is set; R9's line when the read fails (the `phrase` field stripped
// from the answer inside the page: the real background always sends a valid one). And how it is set: onboarding's step
// after the wallet is stored (it survives the first write), #35 set-when-none at once, change and remove through #10
// (which shows the CURRENT phrase and never the new one). Contained as every spec: the fake coordinator, the dApp's
// hosts, no CSP violation.
const ACCOUNT = E2E_ACCOUNTS[0];
const DAPP = 'https://dapp.test';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
const LAMPORTS = 100_000_000n;
const MARKUP = '<b>Blue</b> horse 42';
const GREEN = 'Green fox 7';
const LINE = (phrase: string) => `Anti-phishing phrase: ${phrase}`;
const R9 = "Anti-phishing phrase could not be read — don't type your password until it shows";
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};

const local = (sw: Worker, key: string) => sw.evaluate(async k => (await chrome.storage.local.get(k))[k], key);
const lock = (sw: Worker) => sw.evaluate(() => chrome.storage.session.remove('v1_session'));
/** The dApp limits reset (C14): this spec rejects more requests in a minute than the cooldown allows, by design of the spec. */
const fresh = (sw: Worker) => sw.evaluate(() => chrome.storage.local.set({v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: false}}));
/** An init script (before the page's own): the named answer's `phrase` field removed — a read this side cannot trust. */
function stripScript(t: {type: string; path: string}): void {
  if (location.pathname !== t.path) return;
  const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
  const send = rt.sendMessage.bind(rt);
  rt.sendMessage = async (m: unknown) => {
    const r = (await send(m)) as {ok?: boolean; data?: Record<string, unknown>};
    if ((m as {type?: string}).type !== t.type || r?.ok !== true || r.data === undefined) return r;
    const data = {...r.data};
    delete data.phrase;
    return {...r, data};
  };
}
const stripPage = (p: Page, type: string, path: string) => p.addInitScript(stripScript, {type, path});
const stripContext = (ctx: BrowserContext, type: string, path: string) => ctx.addInitScript(stripScript, {type, path});

/** The popup's (or a window's) line: exactly one, its text, no element made of the phrase. */
async function popupLine(p: Page, phrase: string): Promise<void> {
  const line = p.locator('.app-phrase-line');
  await expect(line).toHaveCount(1, {timeout: 30_000});
  await expect(line).toHaveText(LINE(phrase));
  await expect(line.locator('.copy')).toHaveText(phrase);
  expect(await line.locator('.copy').evaluate(e => e.childElementCount)).toBe(0);
  await expect(line.locator('svg')).toHaveCount(1);
}
/** A fresh vault-page tab on #9. */
async function unlockPage(h: Harness, o: {strip?: boolean} = {}): Promise<Page> {
  const p = await h.ctx.newPage();
  if (o.strip === true) await stripPage(p, 'vault.status', '/unlock.html');
  await p.goto(`chrome-extension://${h.id}/unlock.html`);
  await expect(p.locator('#unl-password')).toBeVisible({timeout: 60_000});
  return p;
}
/** #9's line: shown with the phrase as text, above the password field. */
async function vaultLine(p: Page, phrase: string): Promise<void> {
  await expect(p.locator('#unl-phrase')).toBeVisible();
  await expect(p.locator('#unl-phrase')).toHaveText(LINE(phrase));
  await expect(p.locator('#unl-phrase-text')).toHaveText(phrase);
  expect(await p.locator('#unl-phrase-text').evaluate(e => e.childElementCount)).toBe(0);
  await expect(p.locator('#unl-phrase-failed')).toBeHidden();
  const line = await p.locator('#unl-phrase').boundingBox();
  const field = await p.locator('#unl-password').boundingBox();
  expect((line?.y ?? Infinity) + (line?.height ?? 0)).toBeLessThanOrEqual(field?.y ?? -Infinity);
}

/** A fresh popup on #35, its anti-phishing row saying `meta`. */
async function phraseRow(h: Harness, meta: 'On' | 'Off'): Promise<Locator> {
  const popup = await h.openPopup();
  await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
  await popup.getByRole('button', {name: 'Settings'}).click();
  await popup.locator('.s7-title', {hasText: 'Security center'}).click();
  const row = popup.locator('.s7-row', {hasText: 'Anti-phishing phrase'});
  await expect(row.locator('.s7-meta')).toHaveText(meta);
  return row;
}
/** #10, opened by the card's `button`: a tab on ?mode=reauth with a challenge. */
async function reauthTab(h: Harness, popup: Page, button: string): Promise<Page> {
  const [tab] = await Promise.all([h.ctx.waitForEvent('page'), popup.getByRole('button', {name: button}).click()]);
  await expect(tab).toHaveURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
  return tab;
}
/** The password given on #10: the settings kind's end state. */
async function confirmed(tab: Page): Promise<void> {
  await tab.locator('#ra-password').fill(E2E_PASSWORD);
  await tab.locator('#ra-confirm').click();
  await expect(tab.locator('#ra-notice-line')).toHaveText('Confirmed. The change is saved — you can close this tab.', {timeout: 60_000});
  await tab.close();
}

async function scene(prefix: string, ext: string): Promise<{h: Harness; server: DappServer; csp: string[]}> {
  const h = await launchPopup(prefix, {hosts: DAPP_HOSTS, ext});
  const server = await serveDapp(h.ctx);
  const csp = await watchCsp(h.ctx);
  installPresale(h, {allocation: RETURNING});
  await h.sw.evaluate(({env, treasury}) => chrome.storage.local.set({v1_vault: env, v1_known_recipients: [{address: treasury, at: Date.now()}]}), {env: await makeEnvelope(), treasury: SOL_TREASURY});
  return {h, server, csp};
}

for (const [name, ext, presale] of [
  ['on (dist)', EXT, true],
  ['off (dist-nopresale)', EXT_NOPRESALE, false],
] as const) {
  test(`phrase · ${name}: none → no line; set → the popup's locked screen, #9 before the field, #47, #46, #48, #48 F12 Reject-only, the locked window — as text; R9 where the read fails`, async () => {
    test.setTimeout(300_000);
    expect(JSON.parse(readFileSync(join(dirname(ext), 'app.features.json'), 'utf8'))).toEqual({presale});
    const {h, server, csp} = await scene(`noctura-e2e-phrase-screens-${presale ? 'on' : 'off'}-`, ext);
    try {
      // None set: no line anywhere, the screens as before.
      let popup = await h.openPopup();
      await expect(popup.getByText('Welcome back')).toBeVisible({timeout: 30_000});
      await expect(popup.locator('.app-phrase-line')).toHaveCount(0);
      await popup.close();
      let vault = await unlockPage(h);
      await expect(vault.locator('#unl-phrase')).toBeHidden();
      await expect(vault.locator('#unl-phrase-failed')).toBeHidden();
      await vault.close();

      // Set (by the background's key, as #35 or the step would leave it): a phrase that looks like markup.
      await h.sw.evaluate(p => chrome.storage.local.set({v1_phishing_phrase: p}), MARKUP);
      popup = await h.openPopup();
      await expect(popup.getByText('Welcome back')).toBeVisible({timeout: 30_000});
      await popupLine(popup, MARKUP);
      await popup.close();
      vault = await unlockPage(h);
      await vaultLine(vault, MARKUP);
      await vault.close();
      await unlockWith(await h.ctx.newPage(), h.id, E2E_PASSWORD);

      // The approval windows, unlocked: #47 (connect), #46 (sign a message), #48 (a transfer).
      popup = await h.openPopup();
      await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
      await expect(popup.locator('.app-phrase-line')).toHaveCount(0);
      const page = await openDapp(h.ctx, DAPP);
      let c!: Promise<unknown>;
      let win = await approvalWindow(h.ctx, () => (c = adapter.connect(page)));
      await expect(win.getByRole('button', {name: 'Connect for this session'})).toBeVisible({timeout: 15_000});
      await popupLine(win, MARKUP);
      await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
      await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
      await win.getByRole('button', {name: 'Connect for this session'}).click();
      expect(await c).toEqual({ok: true, value: ACCOUNT});
      await windowClosed(win);

      let request!: Promise<unknown>;
      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = sign(page, 'Sign in to the test dApp')));
      await expect(win.getByText('Sign in to the test dApp')).toBeVisible({timeout: 15_000});
      await popupLine(win, MARKUP);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);

      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = adapter.sign(page, BLOCKHASH)));
      await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 15_000});
      await popupLine(win, MARKUP);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);

      // #48 F12: a presale purchase with the region gate closed — Reject only, and the line on it.
      h.fake.geo.check = {countryCode: 'KP', isVpn: false};
      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = adapter.customSign(page, BLOCKHASH, [solPurchaseIx(ACCOUNT, LAMPORTS)])));
      await expect(win.locator('.s9-flag-banner.danger .head')).toHaveText('Presale purchase blocked', {timeout: 15_000});
      expect(await win.locator('.sticky-bar button').allTextContents()).toEqual(['Reject']);
      await popupLine(win, MARKUP);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);
      expect(h.fake.broadcasts).toEqual([]);

      // Locked: the locked window (a site that asks to connect) carries the line.
      await lock(h.sw);
      const other = await openDapp(h.ctx, 'https://jup.ag');
      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = connect(other)));
      await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
      await popupLine(win, MARKUP);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);

      // R9: the field missing from the answer → the warning line, never silence and never the phrase.
      popup = await h.ctx.newPage();
      await popup.setViewportSize({width: 412, height: 600});
      await stripPage(popup, 'wallet.state', '/popup.html');
      await popup.goto(`chrome-extension://${h.id}/popup.html`);
      await expect(popup.getByText('Welcome back')).toBeVisible({timeout: 30_000});
      await expect(popup.locator('.app-phrase-line')).toHaveText(R9);
      await expect(popup.locator('.app-phrase-line.warning')).toHaveCount(1);
      await popup.close();
      vault = await unlockPage(h, {strip: true});
      await expect(vault.locator('#unl-phrase-failed')).toHaveText(R9);
      await expect(vault.locator('#unl-phrase')).toBeHidden();
      await vault.close();
      await stripContext(h.ctx, 'dapp.pending', '/approve.html');
      await fresh(h.sw);
      win = await approvalWindow(h.ctx, () => (request = connect(other)));
      await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
      await expect(win.locator('.app-phrase-line')).toHaveText(R9);
      await expect(win.locator('.app-phrase-line.warning')).toHaveCount(1);
      await win.getByRole('button', {name: 'Reject'}).click();
      expect(((await request) as {ok: boolean}).ok).toBe(false);
      await windowClosed(win);

      expect(csp).toEqual([]);
      contained(h);
      expect(server.unexpected).toEqual([]);
    } finally {
      await h.close();
    }
  });

  test(`phrase · ${name}: set in onboarding's step (it survives the first write) → #9; #35 On; a change and a removal through #10 (the current phrase shown, never the new one); set again at once; R9 on #10`, async () => {
    test.setTimeout(300_000);
    const {h, server, csp} = await scene(`noctura-e2e-phrase-set-${presale ? 'on' : 'off'}-`, ext);
    try {
      await h.sw.evaluate(() => chrome.storage.local.remove('v1_vault'));
      // Onboarding (a plain import): the step comes once the wallet is stored; [Set phrase] writes it.
      const v = await h.ctx.newPage();
      await v.goto(`chrome-extension://${h.id}/unlock.html?mode=import`);
      await pastePhrase(v, E2E_MNEMONIC);
      await v.locator('#imp-continue').click();
      // The fake funds both address types of this phrase: the run asks which (the standard one, the wallet's account).
      await expect(v.getByText('Both address types on this phrase hold funds. Choose the one to use.')).toBeVisible({timeout: 30_000});
      await v.locator('#imp-choose-slip10').click();
      await expect(v.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
      await setPassword(v, E2E_PASSWORD);
      await expect(v.locator('#v-anti-phishing')).toBeVisible({timeout: 60_000});
      expect(await local(h.sw, 'v1_vault')).toBeDefined();
      expect(await local(h.sw, 'v1_phishing_phrase')).toBeUndefined();
      await v.locator('#ap-field').fill(MARKUP);
      await v.locator('#ap-set').click();
      await v.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(MARKUP);
      await v.close();
      await lock(h.sw);
      let vault = await unlockPage(h);
      await vaultLine(vault, MARKUP);
      await unlockWith(vault, h.id, E2E_PASSWORD);
      await vault.close();

      // #35: On; the card never shows the stored phrase. A change → #10 (the popup closes itself once the tab opens).
      let row = await phraseRow(h, 'On');
      const input = row.page().getByRole('textbox', {name: 'New anti-phishing phrase'});
      await row.click();
      await expect(input).toHaveValue('');
      await input.fill(GREEN);
      let tab = await reauthTab(h, row.page(), 'Change phrase');
      await expect(tab.locator('#ra-rows')).toHaveText('Change the anti-phishing phrase', {timeout: 60_000});
      await expect(tab.locator('#ra-phrase-text')).toHaveText(MARKUP);
      expect(await tab.locator('body').innerText()).not.toContain(GREEN);
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(MARKUP);
      await confirmed(tab);
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(GREEN);

      // A removal → #10, showing the phrase now stored.
      row = await phraseRow(h, 'On');
      await row.click();
      tab = await reauthTab(h, row.page(), 'Remove phrase');
      await expect(tab.locator('#ra-rows')).toHaveText('Remove the anti-phishing phrase', {timeout: 60_000});
      await expect(tab.locator('#ra-phrase-text')).toHaveText(GREEN);
      await confirmed(tab);
      expect(await local(h.sw, 'v1_phishing_phrase')).toBeUndefined();

      // Set when none is set: written at once, no tab.
      row = await phraseRow(h, 'Off');
      const pages = h.ctx.pages().length;
      await row.click();
      await row.page().getByRole('textbox', {name: 'Anti-phishing phrase'}).fill(GREEN);
      await row.page().getByRole('button', {name: 'Set phrase'}).click();
      await expect(row.locator('.s7-meta')).toHaveText('On', {timeout: 30_000});
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(GREEN);
      expect(h.ctx.pages().length).toBe(pages);
      await row.page().close();

      // R9 on #10: the field stripped from vault.status in the tab the change opens; nothing applied.
      await stripContext(h.ctx, 'vault.status', '/unlock.html');
      row = await phraseRow(h, 'On');
      await row.click();
      await row.page().getByRole('textbox', {name: 'New anti-phishing phrase'}).fill(MARKUP);
      tab = await reauthTab(h, row.page(), 'Change phrase');
      await expect(tab.locator('#ra-phrase-failed')).toHaveText(R9, {timeout: 60_000});
      await expect(tab.locator('#ra-phrase')).toBeHidden();
      await tab.close();
      expect(await local(h.sw, 'v1_phishing_phrase')).toBe(GREEN);

      // The new phrase on the locked popup.
      await lock(h.sw);
      vault = await h.ctx.newPage();
      await vault.goto(`chrome-extension://${h.id}/popup.html`);
      await popupLine(vault, GREEN);
      await vault.close();

      expect(csp).toEqual([]);
      contained(h);
      expect(server.unexpected).toEqual([]);
    } finally {
      await h.close();
    }
  });
}
```

Create `extension/e2e/visual-b1e.spec.ts`:

```ts
import {test, expect, type BrowserContext, type Locator, type Page, type Worker} from '@playwright/test';
import {base58} from '@scure/base';
import {mkdirSync} from 'node:fs';
import {contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
import {EXT_NOPRESALE} from './launch';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {pastePhrase, setPassword, unlockWith} from './vaultPage';
import {DAPP_HOSTS, adapter, approvalWindow, connect, openDapp, serveDapp, sign, windowClosed} from './dappPage';
import {SOL_TREASURY, solPurchaseIx} from './presaleChain';
import {installPresale, watchCsp} from './presaleHelpers';
import {DIR} from './visualTab';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {remove(k: string): Promise<void>}};
};

// B1e §9 (B1e-1 Task 7): the visual pass of every element index.html does not draw, rendered by the real extension — the
// store build (`--no-presale`, E2) — at its real frame: the popup at 412 × 600, the vault page at 412 × 916, the approval
// window at 412 × 720 (its windows.create size). The anti-phishing line on every screen that shows it and R9's line, the
// onboarding step, #35's row and card; the two damaged states, the removal and "Save the damaged data"; #37's and the
// removal's checkbox directly above the button; #1's terms line and #38's link rows. Every shot asserts its own copy
// first, then that it is wholly in the frame and clear of the pinned bars, and that the screen draws exactly the expected
// number of sticky bars, each with every control in it wholly in the frame. Saved for the review against the design
// system and the binding design — compared on rendered images, never by copying the design's text. Not a pixel diff.
const ACCOUNT = E2E_ACCOUNTS[0];
const BLUE = 'Blue horse 42';
const LONG = 'Moonlit harbour, seven lanterns!';
const GREEN = 'Green fox 7';
const R9 = "Anti-phishing phrase could not be read — don't type your password until it shows";
const UNDERSTOOD = 'I understand this permanently removes this wallet from this browser';
const BLOCKHASH = base58.encode(new Uint8Array(32).fill(7));
const RETURNING = {totalBase: 1_998_667_554_963n, spentCents: 30_000n, count: 2};

const set = (sw: Worker, o: object) => sw.evaluate(x => chrome.storage.local.set(x), o);
const lock = (sw: Worker) => sw.evaluate(() => chrome.storage.session.remove('v1_session'));
const fresh = (sw: Worker) => set(sw, {v1_dapp_limits: {rejections: [], cooldowns: [], windows: [], notice: false}});
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
/** An init script: the named answer's `phrase` field removed inside the page — the read R9 is for. */
function stripScript(t: {type: string; path: string}): void {
  if (location.pathname !== t.path) return;
  const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
  const send = rt.sendMessage.bind(rt);
  rt.sendMessage = async (m: unknown) => {
    const r = (await send(m)) as {ok?: boolean; data?: Record<string, unknown>};
    if ((m as {type?: string}).type !== t.type || r?.ok !== true || r.data === undefined) return r;
    const data = {...r.data};
    delete data.phrase;
    return {...r, data};
  };
}
const stripContext = (ctx: BrowserContext, type: string, path: string) => ctx.addInitScript(stripScript, {type, path});

/** Exactly `count` visible sticky bars (a bar that lost its class fails here, not silently); each, and every control and label in it, wholly in the frame. */
async function wholeBar(p: Page, name: string, count: number): Promise<void> {
  const bar = p.locator('.sticky-bar').filter({visible: true});
  await expect(bar, `${name}: ${count} sticky bar(s)`).toHaveCount(count);
  for (const b of await bar.all()) {
    await expect(b, `${name}: the sticky bar wholly in the frame`).toBeInViewport({ratio: 1});
    for (const c of await b.locator('button, a, input, label').filter({visible: true}).all()) await expect(c, `${name}: a bar control wholly in the frame`).toBeInViewport({ratio: 1});
  }
}
/**
 * A shot from the screen as it stands: `copy` visible, wholly in the frame and clear of every pinned bar it is not part of
 * (scrolled to the middle of the frame only when it is not, as a person would scroll to it), `bars` sticky bars wholly in
 * the frame, `ready` awaited enabled, the pointer off the column.
 */
async function frame(p: Page, name: string, copy: Locator, o: {bars: 0 | 1; ready?: Locator}): Promise<void> {
  await expect(copy).toBeVisible({timeout: 30_000});
  const pinned = p.locator('.sticky-bar, .top-bar').filter({visible: true});
  const vh = p.viewportSize()?.height ?? 0;
  const under = async (): Promise<string | null> => {
    const box = await copy.boundingBox();
    if (box === null) return 'no box';
    if (box.y < 0 || box.y + box.height > vh) return 'outside the frame';
    const el = await copy.elementHandle();
    for (const bar of await pinned.all()) {
      const b = await bar.boundingBox();
      if (b === null || (await bar.evaluate((e, x) => e.contains(x), el))) continue;
      if (box.y < b.y + b.height && b.y < box.y + box.height) return await bar.evaluate(e => e.className);
    }
    return null;
  };
  if ((await under()) !== null) await copy.evaluate(e => e.scrollIntoView({block: 'center'}));
  await expect(copy, `${name}: the copy wholly in the frame`).toBeInViewport({ratio: 1});
  expect(await under(), `${name}: the copy clear of the pinned bars`).toBeNull();
  await wholeBar(p, name, o.bars);
  if (o.ready !== undefined) await expect(o.ready).toBeEnabled();
  await p.mouse.move(0, 0);
  mkdirSync(DIR, {recursive: true});
  await p.screenshot({path: `${DIR}/${name}.png`});
}
/** The anti-phishing line as drawn: the shield banner, its icon, the phrase as text after a screen-reader label. */
async function phraseLine(line: Locator, phrase: string): Promise<void> {
  await expect(line).toHaveText(`Anti-phishing phrase: ${phrase}`);
  await expect(line).toHaveClass(/\bbanner\b/);
  await expect(line).toHaveClass(/\bshield\b/);
  await expect(line.locator('svg')).toHaveCount(1);
  await expect(line.locator('.copy')).toHaveText(phrase);
}
/** R9's line as drawn: the warning banner with its icon. */
async function failedLine(line: Locator): Promise<void> {
  await expect(line).toHaveText(R9);
  await expect(line).toHaveClass(/\bwarning\b/);
  await expect(line.locator('svg')).toHaveCount(1);
}
/** The checkbox directly above the button it unlocks, inside the same bar, both wholly in the frame. */
async function boxAbove(box: Locator, button: Locator): Promise<void> {
  const b = await box.boundingBox();
  const c = await button.boundingBox();
  expect(b, 'the checkbox row').not.toBeNull();
  expect(c, 'the button').not.toBeNull();
  expect((b?.y ?? Infinity) + (b?.height ?? 0), 'the checkbox row ends above the button').toBeLessThanOrEqual(c?.y ?? -Infinity);
  expect(await box.evaluate((e, x) => e.parentElement === x?.parentElement && e.nextElementSibling === x, await button.elementHandle()), 'the box is the button\'s previous sibling in the bar').toBe(true);
}
/** A vault-page tab at its frame (412 × 916). */
async function tab(h: Harness, path: string): Promise<Page> {
  const p = await h.ctx.newPage();
  await p.setViewportSize({width: 412, height: 916});
  await p.goto(`chrome-extension://${h.id}/${path}`);
  return p;
}
/** The approval window at its windows.create size. */
async function windowFor(h: Harness, ask: () => unknown): Promise<Page> {
  await fresh(h.sw);
  const win = await approvalWindow(h.ctx, ask);
  await win.setViewportSize({width: 412, height: 720});
  return win;
}
/** Rejects the window's request and waits for it to close. */
async function reject(win: Page, request: Promise<unknown>): Promise<void> {
  await win.getByRole('button', {name: 'Reject'}).click();
  expect(((await request) as {ok: boolean}).ok).toBe(false);
  await windowClosed(win);
}

test('visual · B1e popup (412 × 600): the locked screen with the phrase, a 32-unit phrase, R9; #35 row Off / On and its card; #37 the checkbox above the CTA; #38 the link rows', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-b1e-popup-', {ext: EXT_NOPRESALE});
  try {
    await seedUnlockedWallet(h.sw);
    let p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await p.close();

    // The popup's locked screen: the line under the header, before the lede; a long phrase wraps; R9.
    await lock(h.sw);
    await set(h.sw, {v1_phishing_phrase: BLUE});
    p = await h.openPopup();
    const line = p.locator('.app-phrase-line');
    await expect(p.getByText('Welcome back')).toBeVisible({timeout: 30_000});
    await phraseLine(line, BLUE);
    expect(await line.evaluate(e => e.previousElementSibling?.textContent === 'Welcome back' && e.nextElementSibling?.classList.contains('noc-body') === true)).toBe(true);
    await frame(p, 'b1e-popup-locked-phrase', line, {bars: 0});
    await set(h.sw, {v1_phishing_phrase: LONG});
    await p.reload();
    await phraseLine(line, LONG);
    await frame(p, 'b1e-popup-locked-long', line, {bars: 0});
    await p.close();
    await stripContext(h.ctx, 'wallet.state', '/popup.html');
    p = await h.openPopup();
    await expect(p.getByText('Welcome back')).toBeVisible({timeout: 30_000});
    await failedLine(p.locator('.app-phrase-line'));
    await frame(p, 'b1e-popup-locked-failed', p.locator('.app-phrase-line'), {bars: 0});
    await p.close();
  } finally {
    await h.close();
  }

  // #35, #37 and #38 in a context without the stripping script.
  const u = await launchPopup('noctura-e2e-visual-b1e-popup-2-', {ext: EXT_NOPRESALE});
  try {
    await seedUnlockedWallet(u.sw);
    const p = await u.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    await p.getByRole('button', {name: 'Settings'}).click();
    await p.locator('.s7-title', {hasText: 'Security center'}).click();
    const row = p.locator('.s7-row', {hasText: 'Anti-phishing phrase'});
    await expect(row.locator('.s7-meta')).toHaveText('Off');
    await frame(p, 'b1e-35-row-off', row, {bars: 0});
    await row.click();
    const card = p.locator('.app-phrase-card');
    await p.getByRole('textbox', {name: 'Anti-phishing phrase'}).fill(BLUE);
    await expect(card.getByRole('button', {name: 'Set phrase'})).toBeEnabled();
    await expect(card.getByRole('button', {name: 'Remove phrase'})).toHaveCount(0);
    await expect(card).toContainText('3–32 characters: letters, numbers, symbols and simple emoji.');
    await expect(card).toContainText('Never type it into a website. Anyone who uses this browser profile can see it.');
    await frame(p, 'b1e-35-card-set', card.getByRole('button', {name: 'Set phrase'}), {bars: 0});
    await card.getByRole('button', {name: 'Set phrase'}).click();
    await expect(row.locator('.s7-meta')).toHaveText('On', {timeout: 30_000});
    await frame(p, 'b1e-35-row-on', row, {bars: 0});
    await row.click();
    await expect(p.getByRole('textbox', {name: 'New anti-phishing phrase'})).toHaveValue('');
    await p.getByRole('textbox', {name: 'New anti-phishing phrase'}).fill(GREEN);
    await expect(card).toContainText('A change or a removal asks for your password in a new tab.');
    await frame(p, 'b1e-35-card-change', card.getByRole('button', {name: 'Remove phrase'}), {bars: 0});
    await card.locator('.app-picker-head').click();

    // #37: DELETE typed — the checkbox directly above the hold; checked — the CTA is one activation.
    await p.getByRole('button', {name: 'Back'}).click();
    await p.locator('.s7-title', {hasText: 'Delete wallet'}).click();
    await expect(p.getByText('Delete this wallet?')).toBeVisible();
    await p.getByRole('textbox', {name: 'Type DELETE here'}).fill('DELETE');
    const box = p.getByRole('checkbox', {name: UNDERSTOOD});
    const ack = p.locator('.sticky-bar .app-understood');
    await expect(box).not.toBeChecked();
    await boxAbove(ack, p.locator('.sticky-bar .app-hold'));
    await frame(p, 'b1e-37-matched', ack, {bars: 1});
    await box.check();
    const cta = p.getByRole('button', {name: 'Delete wallet'});
    await expect(cta).toBeEnabled();
    await boxAbove(ack, cta);
    await frame(p, 'b1e-37-understood', ack, {bars: 1, ready: cta});
    await box.uncheck();

    // #38: Legal (Terms of Service, Privacy Policy, Open-source licenses), Resources (Help & support).
    await p.getByRole('button', {name: 'Back'}).click();
    await p.getByText('About Noctura').click();
    const terms = p.getByRole('link', {name: 'Terms of Service (opens in a new tab)'});
    await expect(p.getByRole('link', {name: 'Privacy Policy (opens in a new tab)'})).toBeVisible();
    await frame(p, 'b1e-38-legal', terms, {bars: 0});
    const help = p.getByRole('link', {name: 'Help & support (opens in a new tab)'});
    await frame(p, 'b1e-38-help', help, {bars: 0});
    contained(u);
  } finally {
    await u.close();
  }
});

test('visual · B1e vault page (412 × 916): #1 with the terms line; #9 with the phrase and R9; the onboarding step (empty, typed, refused); #10 change / remove; the damaged states, Save, the removal and its checkbox', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-b1e-vault-', {ext: EXT_NOPRESALE});
  try {
    // #1: the terms line above the two buttons, its two links.
    let p = await tab(h, 'unlock.html?mode=welcome');
    const terms = p.locator('#wel-terms');
    await expect(terms).toHaveText('By continuing you agree to the Terms and Privacy Policy.');
    expect(await terms.evaluate(e => e.nextElementSibling?.id)).toBe('wel-actions');
    await frame(p, 'b1e-01-terms', terms, {bars: 1, ready: p.locator('#wel-create')});

    // The onboarding step, through a plain import (the fake funds both address types: the standard one is chosen).
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=import`);
    await pastePhrase(p, E2E_MNEMONIC);
    await p.locator('#imp-continue').click();
    await p.locator('#imp-choose-slip10').click();
    await expect(p.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await setPassword(p, E2E_PASSWORD);
    await expect(p.locator('#v-anti-phishing')).toBeVisible({timeout: 60_000});
    await expect(p.locator('#v-anti-phishing h1')).toHaveText('Set an anti-phishing phrase');
    await expect(p.locator('#v-anti-phishing .top-bar .noc-overline')).toHaveText('Optional');
    await expect(p.locator('#ap-helper')).toHaveText('3–32 characters: letters, numbers, symbols and simple emoji.');
    await expect(p.locator('#ap-help')).toHaveText('Never type it into a website. Anyone who uses this browser profile can see it.');
    await expect(p.locator('#ap-set')).toBeDisabled();
    await frame(p, 'b1e-step-empty', p.locator('#ap-field'), {bars: 1, ready: p.locator('#ap-skip')});
    await p.locator('#ap-field').fill(BLUE);
    await frame(p, 'b1e-step-typed', p.locator('#ap-field'), {bars: 1, ready: p.locator('#ap-set')});
    await p.evaluate(() => {
      const rt = (globalThis as unknown as {chrome: {runtime: {sendMessage(m: unknown): Promise<unknown>}}}).chrome.runtime;
      const send = rt.sendMessage.bind(rt);
      rt.sendMessage = async (m: unknown) => ((m as {type?: string}).type === 'settings.phrase' ? {ok: false, error: 'failed'} : send(m));
    });
    await p.locator('#ap-set').click();
    await expect(p.locator('#ap-line')).toBeVisible();
    await frame(p, 'b1e-step-refused', p.locator('#ap-line'), {bars: 1, ready: p.locator('#ap-skip')});
    await p.locator('#ap-skip').click();
    await p.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});

    // #10: a change and a removal of the phrase (challenges from an extension page; the CURRENT phrase on the line).
    await set(h.sw, {v1_phishing_phrase: BLUE});
    for (const [phrase, about, name] of [
      [GREEN, 'Change the anti-phishing phrase', 'b1e-10-change'],
      [null, 'Remove the anti-phishing phrase', 'b1e-10-remove'],
    ] as const) {
      const r = await msg(p, {type: 'settings.phrase', phrase});
      expect(r.error).toBe('reauth-required');
      const id = (r.data as {challengeId: string}).challengeId;
      const v = await tab(h, `unlock.html?mode=reauth&challenge=${id}`);
      await expect(v.locator('#ra-rows')).toHaveText(about, {timeout: 60_000});
      await phraseLine(v.locator('#ra-phrase'), BLUE);
      expect(await v.locator('body').innerText()).not.toContain(GREEN);
      await frame(v, name, v.locator('#ra-phrase'), {bars: 1, ready: v.locator('#ra-confirm')});
      await v.close();
    }

    // #9: the line above the password field; a long phrase; R9.
    await lock(h.sw);
    p = await tab(h, 'unlock.html');
    await expect(p.locator('#unl-password')).toBeVisible({timeout: 60_000});
    await phraseLine(p.locator('#unl-phrase'), BLUE);
    await frame(p, 'b1e-09-phrase', p.locator('#unl-phrase'), {bars: 1, ready: p.locator('#unl-submit')});
    await set(h.sw, {v1_phishing_phrase: LONG});
    await p.reload();
    await expect(p.locator('#unl-password')).toBeVisible({timeout: 60_000});
    await phraseLine(p.locator('#unl-phrase'), LONG);
    await frame(p, 'b1e-09-long', p.locator('#unl-phrase'), {bars: 1, ready: p.locator('#unl-submit')});
    await p.close();
    await stripContext(h.ctx, 'vault.status', '/unlock.html');
    p = await tab(h, 'unlock.html');
    await expect(p.locator('#unl-password')).toBeVisible({timeout: 60_000});
    await failedLine(p.locator('#unl-phrase-failed'));
    await frame(p, 'b1e-09-failed', p.locator('#unl-phrase-failed'), {bars: 1, ready: p.locator('#unl-submit')});
    await p.close();
  } finally {
    await h.close();
  }

  // The damaged states, Save and the removal, in a context without the stripping script.
  const d = await launchPopup('noctura-e2e-visual-b1e-damaged-', {ext: EXT_NOPRESALE});
  try {
    const env = await makeEnvelope();
    await set(d.sw, {v1_vault: {...env, password: {wrapped: 'AAAA'}}});
    const p = await tab(d, 'unlock.html');
    const save = p.locator('#dmg-save');
    await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged', {timeout: 60_000});
    await expect(save).toHaveText('Save the damaged data');
    await expect(save).toHaveAttribute('download', /^noctura-damaged-wallet-[0-9a-f]{8}\.json$/);
    await expect(save).toHaveCSS('text-decoration-line', 'none');
    expect(await save.evaluate(e => e.nextElementSibling?.id)).toBe('dmg-remove');
    await frame(p, 'b1e-09-unreadable', p.locator('#dmg-unreadable'), {bars: 1, ready: p.locator('#dmg-remove')});
    await p.goto(`chrome-extension://${d.id}/unlock.html?mode=welcome`);
    await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged', {timeout: 60_000});
    await frame(p, 'b1e-01-unreadable', p.locator('#dmg-unreadable'), {bars: 1, ready: p.locator('#dmg-remove')});
    await set(d.sw, {v1_vault: {...env, v: 2}});
    await p.goto(`chrome-extension://${d.id}/unlock.html`);
    // E19: the short heading, the sentence that says why as the body's first line — both in the frame.
    await expect(p.locator('#dmg-refused')).toHaveText('Update Noctura to open this wallet', {timeout: 60_000});
    await expect(p.locator('#dmg-refused-body p').first()).toHaveText("This version of Noctura can't open this wallet's data.");
    await expect(p.locator('#dmg-remove')).toBeHidden();
    await expect(save).toHaveCSS('text-decoration-line', 'none');
    await frame(p, 'b1e-09-refused', p.locator('#dmg-refused'), {bars: 1, ready: save});
    await expect(p.locator('#dmg-refused-body p').first()).toBeInViewport({ratio: 1});

    // The removal: idle, DELETE typed (the checkbox directly above the hold), checked (one activation).
    await set(d.sw, {v1_vault: {...env, password: {wrapped: 'AAAA'}}});
    await p.goto(`chrome-extension://${d.id}/unlock.html?mode=remove-damaged`);
    await expect(p.locator('#rd-entry')).toBeVisible({timeout: 60_000});
    await expect(p.locator('#rd-save')).toHaveCSS('text-decoration-line', 'none');
    await frame(p, 'b1e-rd-idle', p.locator('#rd-save'), {bars: 1, ready: p.locator('#rd-cancel')});
    await p.locator('#rd-word').fill('DELETE');
    const row = p.locator('#rd-understood-row');
    await expect(row).toHaveText(UNDERSTOOD);
    await boxAbove(row, p.locator('#rd-hold'));
    await frame(p, 'b1e-rd-matched', row, {bars: 1, ready: p.locator('#rd-hold')});
    await p.getByRole('checkbox', {name: UNDERSTOOD}).check();
    await expect(p.getByRole('button', {name: 'Remove damaged wallet'})).toBeEnabled();
    await expect(p.locator('#rd-caption')).toBeHidden();
    await boxAbove(row, p.locator('#rd-hold'));
    await frame(p, 'b1e-rd-understood', row, {bars: 1, ready: p.locator('#rd-hold')});
  } finally {
    await d.close();
  }
});

test('visual · B1e approval window (412 × 720): the phrase on #47, #46, #48, #48 F12 Reject-only and the locked window; R9 there', async () => {
  test.setTimeout(300_000);
  const h = await launchPopup('noctura-e2e-visual-b1e-window-', {hosts: DAPP_HOSTS, ext: EXT_NOPRESALE});
  const server = await serveDapp(h.ctx);
  const csp = await watchCsp(h.ctx);
  try {
    installPresale(h, {allocation: RETURNING});
    await set(h.sw, {v1_vault: await makeEnvelope(), v1_known_recipients: [{address: SOL_TREASURY, at: Date.now()}], v1_phishing_phrase: BLUE});
    await unlockWith(await h.ctx.newPage(), h.id, E2E_PASSWORD);
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true}).first()).toBeVisible({timeout: 30_000});
    const page = await openDapp(h.ctx, 'https://dapp.test');

    let c!: Promise<unknown>;
    let win = await windowFor(h, () => (c = adapter.connect(page)));
    await expect(win.getByRole('button', {name: 'Connect for this session'})).toBeVisible({timeout: 15_000});
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    expect(await win.locator('.app-phrase-line').evaluate(e => e.previousElementSibling?.classList.contains('top-bar') === true)).toBe(true);
    await frame(win, 'b1e-47-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await win.getByRole('checkbox', {name: 'I understand this domain is not on the verified list'}).click();
    await win.getByRole('checkbox', {name: /I've read these permissions/}).click();
    await win.getByRole('button', {name: 'Connect for this session'}).click();
    expect(await c).toEqual({ok: true, value: ACCOUNT});
    await windowClosed(win);

    let request!: Promise<unknown>;
    win = await windowFor(h, () => (request = sign(page, 'Sign in to the test dApp')));
    await expect(win.getByText('Sign in to the test dApp')).toBeVisible({timeout: 15_000});
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    await frame(win, 'b1e-46-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    win = await windowFor(h, () => (request = adapter.sign(page, BLOCKHASH)));
    await expect(win.getByText('Balance changes (post-simulation)').first()).toBeVisible({timeout: 15_000});
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    await frame(win, 'b1e-48-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    h.fake.geo.check = {countryCode: 'KP', isVpn: false};
    win = await windowFor(h, () => (request = adapter.customSign(page, BLOCKHASH, [solPurchaseIx(ACCOUNT, 100_000_000n)])));
    await expect(win.locator('.s9-flag-banner.danger .head')).toHaveText('Presale purchase blocked', {timeout: 15_000});
    expect(await win.locator('.sticky-bar button').allTextContents()).toEqual(['Reject']);
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    await frame(win, 'b1e-48-f12-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    await lock(h.sw);
    const other = await openDapp(h.ctx, 'https://jup.ag');
    win = await windowFor(h, () => (request = connect(other)));
    await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
    await phraseLine(win.locator('.app-phrase-line'), BLUE);
    await frame(win, 'b1e-window-locked-phrase', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    await stripContext(h.ctx, 'dapp.pending', '/approve.html');
    win = await windowFor(h, () => (request = connect(other)));
    await expect(win.getByText('Noctura is locked')).toBeVisible({timeout: 15_000});
    await failedLine(win.locator('.app-phrase-line'));
    await frame(win, 'b1e-window-locked-failed', win.locator('.app-phrase-line'), {bars: 1});
    await reject(win, request);

    expect(csp).toEqual([]);
    contained(h);
    expect(server.unexpected).toEqual([]);
  } finally {
    await h.close();
  }
});
```

Modify `extension/e2e/damaged.spec.ts` — the removal also wipes the phrase (present until the full hold):

```diff
diff --git a/extension/e2e/damaged.spec.ts b/extension/e2e/damaged.spec.ts
index e08c9c7..2145af5 100644
--- a/extension/e2e/damaged.spec.ts
+++ b/extension/e2e/damaged.spec.ts
@@ -45,8 +45,8 @@ test('damaged vaults: the unreadable state, its saved bytes, the removal; a refu
     const id = new URL(sw.url()).host;
     const env = await makeEnvelope();
 
-    // Unreadable (U3: a 3-byte password wrap), with the wallet's settings and address book beside it.
-    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v, v1_settings: {autoLockMinutes: 5}, v1_contacts: [{address: 'x', name: 'y'}]}), {...env, password: {wrapped: 'AAAA'}});
+    // Unreadable (U3: a 3-byte password wrap), with the wallet's settings, address book and anti-phishing phrase beside it.
+    await sw.evaluate(v => chrome.storage.local.set({v1_vault: v, v1_settings: {autoLockMinutes: 5}, v1_contacts: [{address: 'x', name: 'y'}], v1_phishing_phrase: 'Blue horse 42'}), {...env, password: {wrapped: 'AAAA'}});
     const text = await storedText(sw);
     let p = await vaultPage(ctx, id, 'unlock.html');
     await expect(p.locator('#dmg-unreadable')).toHaveText('Wallet data is damaged', {timeout: 60_000});
@@ -81,6 +81,7 @@ test('damaged vaults: the unreadable state, its saved bytes, the removal; a refu
     await p.clock.runFor(HOLD_MS);
     await expect(p.locator('#rd-hold')).toBeEnabled();
     expect(await storedText(sw)).toBe(text);
+    expect((await sw.evaluate(() => chrome.storage.local.get('v1_phishing_phrase'))).v1_phishing_phrase).toBe('Blue horse 42');
     // Held mid-way: the count and the fill, shot under the paused clock.
     await p.locator('#rd-hold').hover();
     await p.mouse.down();
@@ -92,7 +93,7 @@ test('damaged vaults: the unreadable state, its saved bytes, the removal; a refu
     await expect(p).toHaveURL(/unlock\.html\?mode=welcome$/, {timeout: 30_000});
     await expect(p.locator('#wel-create')).toBeVisible();
     const left = await sw.evaluate(() => chrome.storage.local.get(null));
-    expect(Object.keys(left).filter(k => ['v1_vault', 'v1_settings', 'v1_contacts'].includes(k))).toEqual([]);
+    expect(Object.keys(left).filter(k => ['v1_vault', 'v1_settings', 'v1_contacts', 'v1_phishing_phrase'].includes(k))).toEqual([]);
 
     // Refused by this version (v: 2): the state says "update", offers Save and no removal; the removal URL offers none.
     const refused = {...env, v: 2};
```

Modify `extension/src/app/__tests__/Send.test.tsx` — the DST row (test only):

```diff
diff --git a/extension/src/app/__tests__/Send.test.tsx b/extension/src/app/__tests__/Send.test.tsx
index 38f6de7..f491824 100644
--- a/extension/src/app/__tests__/Send.test.tsx
+++ b/extension/src/app/__tests__/Send.test.tsx
@@ -20,7 +20,6 @@ import type {Draft} from '../send/rules';
 // (RECIPIENT) its own second account; 62.4821 SOL, 4 200 NOC, 740.21 USDC; SOL $150.
 const SELECTORS = selectorsOf(UI_SHEETS);
 const nav = {onBack: vi.fn(), onReview: vi.fn(), onViewPending: vi.fn(), onBook: vi.fn()};
-const DAY = 86_400_000;
 
 function renderSend(o: WalletOptions & {draft?: Draft | null; notice?: 'start-again' | null} = {}) {
   return renderInWallet(<Send draft={o.draft ?? null} notice={o.notice ?? null} {...nav} />, o);
@@ -97,7 +96,10 @@ describe('#12 send', () => {
   });
 
   it('sent before (E6): "Verified · sent before · last 12 days ago"; with no date, "Verified · sent before"', async () => {
-    await renderSend(known(COUNTERPARTY, Date.now() - 12 * DAY));
+    // Local calendar days (rules.ts): the provider's clock is fixed, both instants built from local date parts, the span
+    // across Europe's 25 Oct DST change and "now" late in the evening — 12 days in every time zone, on any run date.
+    const now = new Date(2026, 10, 1, 23, 30).getTime();
+    await renderSend({...known(COUNTERPARTY, new Date(2026, 9, 20, 12, 0).getTime()), now: () => now});
     await loaded();
     type('Recipient', COUNTERPARTY);
     expect((await screen.findByText(/Verified · sent before/)).textContent?.trim()).toBe('Verified · sent before · last 12 days ago');
```

- [ ] **Step 2: The DST row — red under the old row, green under the new one, in Europe/Ljubljana across the 25 Oct change.** The old row (`Date.now() - 12 * DAY`) counts 12 × 24 h back from the run's clock; across the end of summer time that instant can fall on the next local calendar day, and `sentBeforeText` counts local calendar days — "last 11 days ago". The new row fixes the provider's clock (`now`) at 23:30 local on 1 Nov 2026 and the last send at 12:00 local on 20 Oct 2026, both built from local date parts: 12 calendar days in every time zone, whatever the run's date. The proof runs the row under a scratch setup file that fixes the process's `Date` at `FAKE_NOW` (`scratchpad/b1e1-t7/fakedate.setup.ts` + `vitest.dst.config.ts`, copied into `extension/` for the run and removed after; the old row from `git show 2d157ba:extension/src/app/__tests__/Send.test.tsx` as a scratch `SendOldDst.test.tsx`, removed after):

```bash
cd extension
for f in Send SendOldDst; do for z in 2026-11-01T22:30:00Z 2026-10-31T23:30:00Z 2026-04-05T21:30:00Z 2026-11-02T10:00:00Z; do
  TZ=Europe/Ljubljana FAKE_NOW=$z npx vitest run --config vitest.dst.config.ts src/app/__tests__/$f.test.tsx -t 'sent before'
done; done
```

Observed (`scratchpad/b1e1-t7/dst-proof.log`): the new row `2 passed | 32 skipped` at all four instants; **the old row RED at 2026-11-01T22:30Z** (23:30 CET) — `expected 'Verified · sent before · last 11 days ago' to be 'Verified · sent before · last 12 days ago'` — and green at the other three (the negative control: the old row fails exactly where the ledger said). The new row also passed under `TZ` = UTC, Pacific/Auckland, America/Los_Angeles, Asia/Kolkata, Pacific/Kiritimati, America/Sao_Paulo at 2026-11-01T22:30Z, and the whole file `34 passed (34)` in Ljubljana at that instant.

- [ ] **Step 3: Implement.** Nothing beyond the tests: the specs are written to the product as built (Tasks 2–6). The spec's text is edited (rev 2.2, and rev 2.3 for this plan's rev 2) — the diff below, from rev 2.1.

`docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md b/docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md
index f8807fd..829c688 100644
--- a/docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md
+++ b/docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md
@@ -1,6 +1,10 @@
 # Noctura Extension B1e — the first Chrome Web Store release
 
-**Status:** draft rev 2.1, 2026-10-30. Rev 1 (70e691d): the owner approved the design in conversation section by section
+**Status:** rev 2.4, 2026-11-02 — the B1e-1 plan's Fable review 2 (`.superpowers/sdd/b1e1-plan-review-2.md`: N1, N4)
+and the controller's rulings on its owner questions, under "Rev 2.4". Rev 2.3, 2026-11-02 — the B1e-1 plan's Fable review 1 (`.superpowers/sdd/b1e1-plan-review-1.md`: I1 and
+its Minors) and the owner's answers E19–E22, each one line under "Rev 2.3", the passages they name edited to match.
+Rev 2.2, 2026-11-02 — text only: the departures the B1e-1 plan's dry run made from rev 2.1 (each one line
+under "Rev 2.2", the passages they name edited to match); no owner decision changed. Rev 2.1, 2026-10-30. Rev 1 (70e691d): the owner approved the design in conversation section by section
 (2026-10-30: the release target, the presale decision, the hardening scope, where the legal pages live, D10, D31, then
 the four design sections). Rev 2 applies Fable review 1 (`.superpowers/sdd/b1e-spec-review-1.md`: C1, C2, I1–I9 and
 the twelve Minors) and the owner's answers to its six questions (`.superpowers/sdd/b1e-owner-decisions.md`, E9–E14).
@@ -10,6 +14,75 @@ Parent specs: B1 (`2026-09-27-extension-b1-design.md` §5 "Build, gates, release
 D31), B1c §6.5, B1d §6.5 and §7. Binding design: `/home/user/Downloads/index.html` (+ `screen.md`) — it contains the
 TGE date; nothing is copied from it.
 
+**Rev 2.4** (the B1e-1 plan's review 2 and the controller's rulings on its owner questions, 2026-11-02):
+- §1.5 (N1): the combining-mark cap is counted after canonical decomposition (NFD), so a precomposed letter's own
+  marks count (`a` + four graves, `ǘ` or `ậ` + three marks are refused; Vietnamese, polytonic Greek, pointed Hebrew,
+  Tibetan, Thai, Arabic harakat and Hangul are accepted).
+- §1.5 (N4, ruled): the cap stays three; its scope limit is stated — it refuses cantillated Hebrew, Vedic Devanagari
+  and Quranic-annotated Arabic (four marks on one letter). A long phrase wraps and is never cut (N3, ruled, as
+  designed). No migration: no phrase stored before this rule exists outside development profiles.
+
+**Rev 2.3** (the B1e-1 plan's review 1 and the owner's E19–E22, 2026-11-02; the passages named are edited to match):
+- §1.5 (I1, E21): a phrase that renders blank or draws out of its line is refused — every Default_Ignorable code point
+  (the Hangul fillers U+115F, U+1160, U+3164, U+FFA0 and U+17B4 / U+17B5 among them), the Braille blank U+2800, the
+  replacement characters U+FFFC / U+FFFD, and more than three combining marks in a row; a phrase must hold at least one
+  letter, number, symbol or punctuation character. Rev 2.2's "printable" line was not the whole rule.
+- §1.3 (E20): onboarding's step stays count-less; its overline is "Optional", not "Onboarding".
+- §2.2 (E19): the refused state's heading is "Update Noctura to open this wallet"; "This version of Noctura can't open
+  this wallet's data." is its first body line.
+- §0: E19–E22 added to the owner decisions.
+- §4.2 (review M1): the `rpc-websockets` gate calls a map without a `chunks` section INCONCLUSIVE (it passed vacuously).
+- §4.2 (review M6): `licence-ids.json` classifies only a package with no `license` field; a present field outside the
+  allowlist (an SPDX expression, a `{type}` object) fails, and the failure says the table cannot override it.
+- §4.3 (review M4, the controller's ruling on Q6): the link gate is a review aid, not a security boundary.
+- §4.3 (review M5): the gate reads `.svg` files too.
+- §10 (review M7): `presaleBuilds.test.mjs` builds with `NODE_ENV` removed — it is the only test that runs
+  `build.mjs`, and `verify` and CI run it with no `NODE_ENV`, so it now checks the build that ships.
+
+**Rev 2.2** (the B1e-1 plan, 2026-11-02; every line is a departure of the built code from rev 2.1's text, ruled in the
+plan and recorded in its ledger — the passages named are edited to match):
+- §1.2: R9's line also covers a `phrase` field that is missing or not a phrase the background would store — the screen
+  re-judges it with `cleanPhrase` and never refuses the rest of the view.
+- §1.2: the line is also on the approval window's locked state and #48's origin-mismatch notice (every window state,
+  through the window's top), and it carries a screen-reader label "Anti-phishing phrase: " before the phrase.
+- §1.2: #9 and #10 read the phrase only once the stored vault is a wallet; the no-wallet and damaged states have no
+  password field and show no line.
+- §1.3: `vault.challengeInfo` describes a phrase challenge as `{kind: 'phrase', action: 'change' | 'remove'}` — the
+  bound value never reaches #10; change and remove while locked answer `locked`; `unchanged` is answered first.
+- §1.3: #10's end states for a phrase challenge are the settings kind's; #35's card never shows the stored phrase; the
+  onboarding step answers any refusal with the common "try again" line and keeps [Skip].
+- §1.4: a stored value that is not exactly a clean phrase reads as none.
+- §1.5: "printable" also refuses lone surrogates, private-use and unassigned code points (Cs, Co, Cn); look-alike
+  letters of another script are accepted.
+- §2.1 + §2.4: both readings ask the opener first — a value either opener accepts is a wallet; only a refused value is
+  split into unreadable / refused (the partition test keeps the order invisible today).
+- §2.2: the removal is its own vault-page mode, `unlock.html?mode=remove-damaged`, which reads, judges and shows the
+  value itself (no URL parameter); #9 and #1 show one shared damaged screen.
+- §2.2: `busy` and the page's own digest compare are one outcome ("The stored data changed — check it again");
+  `send-open` shows #37's line with [Start again] and [Close this tab], no [Unlock]; a wallet found says "A wallet
+  already exists in this browser. Nothing was changed."; the address carries #37's caption "This wallet's first account".
+- §2.5: `vault.setKeys` answers `unknown-account` (as before) when no vault is stored, `malformed` for an unreadable or
+  refused one.
+- §2.6: M-lock's session is written inside the lock's own session section (the one step 6 must see); a session present
+  before the click is locked by step 3 and has its own control and mutation (M-lock-first). Both fixtures are pinned by
+  sha256; the 458dfcd vault is §2.1's out-of-predicate case (its seed fails AES-GCM).
+- §3: the checkbox is directly **above** the button (in the DOM, on screen and in tab order) on #37 and on the removal,
+  shown only while DELETE matches; the button's name follows it ("Hold to delete" / "Delete wallet" / "Remove damaged
+  wallet") and the hold's instructions hide while it is checked; Space toggles it, Enter on it does nothing (native).
+- §4.1: #1's line stays **above** the buttons, where the design draws it; every link row carries a screen-reader suffix
+  " (opens in a new tab)"; #38's "142 packages" count is not built (the popup cannot know it).
+- §4.2: the static-page rule adds a tag and attribute allowlist; the licence gate also requires each package's
+  `licenses.html` to equal the page its maps give; a missing page is INCONCLUSIVE.
+- §4.2: the `rpc-websockets` gate is stricter — the package in no chunk of any map, and the stub rendering 0 bytes.
+- §4.2: a package without a licence file is headed "Author: …" or "The package names no author."; the fonts' entry
+  pins both faces to geist 1.7.2 by sha256 and `fonts/LICENSE.txt` ships in every package; licence lines are wrapped
+  at 100 columns (a window narrowed to 412 px still scrolls sideways — accepted).
+- §4.3: one presale-build-only row, `https://noc-tura.io?ref=${}` (#24's invite link; an interpolation folds to `${}`),
+  refused in the store build; each row is allowed only in the files it is found in.
+- §5.6: B1e-1's test pins `RP_ID` to `HOST_PERMISSIONS`; the `rp-id.json` half lands with B1e-2's gate.
+- §10: R9's E2E strips the field inside the page (the real background always sends a valid one); the visual pass
+  runs on the store build at 412 × 600 (popup), 412 × 916 (vault page) and 412 × 720 (approval window).
+
 **Rev 2.1** (review 2; §12 maps each finding):
 - §4.3 + §4.2 (N1): the link gate skips `licenses.html` by name; the static-page rule there now refuses `<a`, `href=`,
   `<script`, `<link`, `<style`, `style=`, `on…=`, `<iframe`, `<form`, with mutations.
@@ -70,6 +143,10 @@ B1e is cut down to **the first release: Chrome Web Store, presale off**. It is o
 | E16 | Keep the **`rpc-websockets` alias stub** as a precaution **and** the licence page / gate on **modules with rendered code** (`renderedLength > 0`) (N3) | §4.2 |
 | E17 | The passkey **RP ID stays `wallet.noc-tura.io`**; 1.0.0 freezes it for every enrolled passkey (a pre-upload gate records it); a test pins `RP_ID` to `HOST_PERMISSIONS` (N4) | §5.6, §6, §7 |
 | E18 | **Confirmed: R1** (the first phrase is set while unlocked without a password re-check; change / remove behind #10) **and R4** ("Save the damaged data" on both damaged states) — owner decisions now, no longer spec rulings | §1.3, §2.3 |
+| E19 | (2026-11-02, plan review 1) The **refused-by-this-version** screen gets the short heading "Update Noctura to open this wallet"; the sentence it had becomes the first body line | §2.2 |
+| E20 | (2026-11-02) Onboarding's phrase step stays **count-less**; its overline is **"Optional"**, not "Onboarding" | §1.3 |
+| E21 | (2026-11-02) Phrases that **render blank or draw out of their line are refused**: Default_Ignorable code points, U+2800 and the other blank-rendering characters (the Hangul fillers U+115F / U+1160 / U+3164 / U+FFA0, U+17B4 / U+17B5), stacked combining marks beyond a cap; a phrase holds at least one visible non-mark L / N / S / P character | §1.5 |
+| E22 | (2026-11-02) Keep #37's taller bar with the checkbox, and #35's plain-tone "Off" for the phrase | §3, §1.3 |
 
 **Spec rulings (rev 2).** Decisions the review asked the spec to take that need no owner: each is the most secure
 default, with its reason where it is applied. The owner may overturn any. **R1 and R4 are confirmed by the owner
@@ -111,10 +188,15 @@ One line under the screen's header: a shield icon + the phrase as plain text (`t
 - the vault page's unlock screen (`src/unlock/screens/unlock.ts`) **before** the password is typed, read in its
   `reading` phase, and the popup's locked screen (`src/app/screens/Locked.tsx`);
 - every approval window: #46 sign message (`src/approve/Sign.tsx`), #47 connect (`Connect.tsx`), #48 transaction
-  (`Tx.tsx`);
+  (`Tx.tsx`) — and the window's locked state and #48's origin-mismatch notice (rev 2.2);
 - #10 re-authentication (`src/unlock/screens/reauth.ts`).
 
-**No phrase set:** nothing shows; the extension behaves as today. **A read that fails** (no answer, an error) while a
+On the vault page the line shows only once the stored vault is a wallet: the no-wallet and damaged states have no
+password field and no line. Every line starts with a screen-reader label "Anti-phishing phrase: " (rev 2.2).
+
+**No phrase set:** nothing shows; the extension behaves as today. **A read that fails** (no answer, an error, a
+`phrase` field missing or not exactly a phrase the background would store — the screen re-judges it with `cleanPhrase`;
+rev 2.2) while a
 phrase may be set: the line says "Anti-phishing phrase could not be read — don't type your password until it shows"
 (R9: silence would look exactly like a phishing window and like "no phrase"; the failure is rare — the background
 answers these reads locked or unlocked).
@@ -139,23 +221,28 @@ value is cleaned (§1.5); stored none + a value + a session → written, `set`;
 equal to the stored value → `unchanged`; otherwise a challenge of a new shared kind **`phrase`**
 (`{kind: 'phrase', phrase: string | null}`, exactly two keys, added to `isAbout`, `reauthChallenges.ts`) is issued and
 the answer is `reauth-required {challengeId}`, exactly as `setSettings` does it (the lock-race handling included).
+`unchanged` is answered first; a change or a removal while locked answers `locked`. `vault.challengeInfo` describes a
+phrase challenge to #10 as `{kind: 'phrase', action: 'change' | 'remove'}` — the bound value never leaves the
+background (rev 2.2).
 `vault.reauthOk` applies it from the value bound at issue — as it applies a `settings` challenge through
 `applySettingsChallenge` (`walletApi.ts:261`) — and the stored value is re-compared at apply time, under the mutex
 (the last confirmed proof wins, as review M6 ruled for settings). #10's "what this is for" line says "Change the
 anti-phishing phrase" or "Remove the anti-phishing phrase" — never the new value (the phrase line on #10 shows the
-current one; two phrases on one screen invite confusion).
+current one; two phrases on one screen invite confusion). #10's end states are the settings kind's (rev 2.2).
 
 **Onboarding.** A skippable last step: "Set an anti-phishing phrase", with one sentence on why. It runs **after
 `commitWallet`** (`onboarding.ts:148`), never before: the first write, `storeEnvelope(null, …)`, calls
 `removeWalletData` (defined at `accountsStore.ts:57`; its call in the first write at `:260`), which removes every `WALLET_DATA_KEYS` key — a phrase written before
 the commit would be wiped by it. Placement:
 - create: after #6 passkey's `done` (`createRun.ts:129`), before `wallet.html#/created` — not before #6, which would
-  hold the typed password longer (#6 holds it, §3.5 of B1b-2a);
+  hold the typed password longer (#6 holds it, §3.5 of B1b-2a). The step has no count of its own after #6's "5 / 5";
+  its overline is "Optional" (E20, rev 2.3);
 - import: after `created`, before `wallet.html#/imported` (`importRun.ts:62`);
 - `created-locked` (the keys did not reach the background): the step is skipped — `set` would answer `locked`; #35
   offers it.
 
-**Settings → Security (#35):** a row "Anti-phishing phrase · On / Off"; set, change, remove.
+**Settings → Security (#35):** a row "Anti-phishing phrase · On / Off"; set, change, remove. Its card never shows the
+stored phrase; the onboarding step answers a refusal with the common "try again" line and keeps [Skip] (rev 2.2).
 
 ### 1.4 Storage and reads (I2, R2)
 
@@ -165,6 +252,7 @@ the commit would be wiped by it. Placement:
   `src/background/` may even name it, so no page can write it around the proof. A plain `ext.local.remove` (not in
   `LOCKED_DATA_KEYS`): a `settings.phrase` write racing a delete's cleanup can leave it behind, and the next first
   write's `removeWalletData` is the backstop — the same accepted race as `v1_settings` (`forgetWallet` step 7 comment).
+- A stored value that is not exactly a clean phrase (§1.5) reads as none (rev 2.2): only the background writes the key.
 - Not encrypted, on purpose: it must show before unlock, and it is no secret from the user's own machine, only from
   websites.
 - **Reads ride on existing answers; no new read type:**
@@ -180,7 +268,15 @@ the commit would be wiped by it. Placement:
 - NFC-normalised, then trimmed; **3–32 UTF-16 code units** (as `cleanName` counts, `envelopeRules.ts:46`); no
   character of `FORBIDDEN_IN_NAME` (`envelopeRules.ts:43`: controls, format characters, line and paragraph
   separators, bidi embeddings / overrides / isolates, zero-width joiners, the combining grapheme joiner, variation
-  selectors) — so a bidi override cannot restyle the line. This also refuses emoji written with a ZWJ or a variation
+  selectors) — so a bidi override cannot restyle the line — and, for "printable", no lone surrogate, private-use or
+  unassigned code point (Cs, Co, Cn; rev 2.2). **Nothing that renders blank or draws out of its line (E21, rev 2.3):**
+  no Default_Ignorable code point (among them the Hangul fillers U+115F, U+1160, U+3164, U+FFA0 and the Khmer U+17B4,
+  U+17B5), no Braille blank U+2800, no U+FFFC / U+FFFD (they stand for a character that could not be shown), at most
+  **three combining marks in a row**, counted after canonical decomposition (NFD) so a precomposed letter's own marks
+  count (`PHRASE_MAX_MARKS`: Thai needs two, pointed Hebrew, Tibetan stacks and polytonic Greek three; a fourth only
+  builds a tower over the header above the line — rev 2.4; the scope limit, ruled: the cap refuses liturgical text with
+  four marks on one letter — cantillated Hebrew, Vedic Devanagari, Quranic-annotated Arabic), and at least one letter, number, symbol or punctuation
+  character — so no phrase shows as an empty or broken banner a phishing page could copy. Look-alike letters of another script are accepted. This also refuses emoji written with a ZWJ or a variation
   selector (family emoji, ❤️ with VS16) — accepted, and the input's helper says "letters, numbers, symbols and simple
   emoji". The cleaner is `cleanPhrase` in `src/shared/envelopeRules.ts`, beside `cleanName`, sharing the regex.
 - `null` (or an empty string after trimming) means "remove".
@@ -260,7 +356,10 @@ AES-GCM IV and tag, AES-KW of a 32-byte key, the PRF salt), fixed by `v: 1` itse
 change `v`, which this predicate then refuses to judge.
 
 **Partition, as a test:** for every value the predicate calls unreadable, `envelopeShape` returns `null` and
-`storedVault` answers `damaged` (every U-clause is one of their checks) — so the four readings never overlap.
+`storedVault` answers `damaged` (every U-clause is one of their checks) — so the four readings never overlap. Both
+readings ask the opener first (rev 2.2): a value `envelopeShape` / `storedVault` accepts is a **wallet**, and only a
+refused value is split into unreadable and refused — the partition test keeps that order invisible today, and if the
+predicate and an opener ever disagreed, a value an opener can open would never be offered for a password-less removal.
 
 **Out of the predicate, said loudly:** a vault that is readable and accepted, whose password unwraps the data key but
 whose seed ciphertext then fails AES-GCM (`unlockFlow.ts` answers `damaged` after the unwrap), is neither unreadable
@@ -274,7 +373,8 @@ Both entry points that show the damaged notice today get the new states: #9 (`sc
 phase) and #1 welcome (`screens/welcome.ts:95`). The page decides which with `storedVault` and `unreadableV1` on its
 own read of `v1_vault` (`readLocal`); the background re-judges at removal (§2.4).
 
-**Refused by this version** — "This version of Noctura can't open this wallet's data." + "Update Noctura (in Chrome:
+**Refused by this version** — the heading "Update Noctura to open this wallet" (E19, rev 2.3), then "This version of
+Noctura can't open this wallet's data." as the first body line + "Update Noctura (in Chrome:
 Extensions → Update). If it is up to date, the data may have been changed. Nothing was removed." + today's
 `damagedHelp` as the last resort. Buttons: **Save the damaged data** (§2.3). No removal.
 
@@ -284,17 +384,24 @@ promise about repair tools) + "Your funds are on Solana. After you remove this c
 wording, `DeleteWallet.tsx` `fundedTail`) — said **before** the typed word (Minor 6), never "funds are safe".
 Buttons: **Save the damaged data**, **Remove damaged wallet**.
 
-**The removal screen** (vault page, plain DOM — the vault page may not carry React, `bundleViolations`):
+#9 and #1 show one shared damaged screen for both states (rev 2.2).
+
+**The removal screen** (vault page, plain DOM — the vault page may not carry React, `bundleViolations`): its own mode,
+`unlock.html?mode=remove-damaged`, reached from [Remove damaged wallet]; it reads, judges and shows the value itself and
+takes no URL parameter, so the digest it sends is that of the value it showed (rev 2.2):
 - the lines above, repeated; "This removes the wallet from this browser only.";
 - the address (Minor 5): among `accounts` entries that are objects with a safe integer `index` ≥ 0 and a `publicKey`
   matching `^[1-9A-HJ-NP-Za-km-z]{32,44}$` (the `ADDRESS` shape, `reauthChallenges.ts:155`), the one with the
-  **lowest** index, in groups of four (`addressGroups`); none → "The address can't be read". Never `accounts[0]`;
+  **lowest** index, in groups of four (`addressGroups`), under #37's caption "This wallet's first account" (rev 2.2);
+  none → "The address can't be read". Never `accounts[0]`;
   nothing else of the value is rendered;
 - the typed **DELETE** and #37's confirmation rule (§3: the hold, or the checkbox and one click) — E11. No password:
   an unreadable vault cannot be opened.
-- Refusals: `send-open` → #37's text (`DELETE_TEXT.sendOpen`, E12); `busy` → "The stored data changed — check it
-  again", and the screen re-reads; `not-unreadable` → the screen re-reads and shows the state it now finds (refused
-  or a wallet); `unlocked` → "Noctura was unlocked meanwhile — try again".
+- Refusals: `send-open` → #37's text (`DELETE_TEXT.sendOpen`, E12) with [Start again] and [Close this tab] — no
+  [Unlock]: an unreadable vault cannot be unlocked (rev 2.2); `busy` → "The stored data changed — check it
+  again", and the screen re-reads — the page's own digest compare at the click is the same outcome (rev 2.2);
+  `not-unreadable` → the screen re-reads and shows the state it now finds (refused, or a wallet: "A wallet already
+  exists in this browser. Nothing was changed."); `unlocked` → "Noctura was unlocked meanwhile — try again".
 
 ### 2.3 Save the damaged data (E10, R4)
 
@@ -331,7 +438,8 @@ Buttons: **Save the damaged data**, **Remove damaged wallet**.
   `accountsStore.ts:472-538`):
   1. `expectedDigest` not 64 lowercase hex → `malformed`;
   2. inside `serial`: read `v1_vault`; `undefined` → `no-wallet`; **`unreadableV1(raw)` false → `not-unreadable`**
-     (a refused vault and a wallet both land here); digest ≠ expected → `busy`;
+     (a refused vault and a wallet both land here; judged opener first, as §2.1's readings — rev 2.2); digest ≠
+     expected → `busy`;
   3. `lock(ext)`;
   4. check-and-clear `v1_pending` in ONE `updatePending`: an open record → `send-open` (E12; nothing removed, the
      wallet stays locked, as E5);
@@ -349,7 +457,8 @@ browser profile — who can also uninstall the extension. It can remove only a v
 
 - **R3:** `vault.setKeys` (`messages.ts:184`) binds the keys through `readWalletView` (`accountsStore.ts:77`), which
   checks only the scheme and the account shape, so today a session could be created over an envelope `envelopeShape`
-  refuses. B1e binds it through `envelopeShape` too: keys over a `stored-invalid` envelope are refused (`malformed`).
+  refuses. B1e binds it through `envelopeShape` too: keys over a `stored-invalid` envelope are refused (`malformed`);
+with no vault stored the answer stays `unknown-account`, as before (rev 2.2).
   Every flow that sends `setKeys` has already stored or read an envelope both sides accept (onboarding, #39, add
   account, unlock — the comment at `messages.ts:186-193`), so no legitimate path changes. Test: a stored envelope with
   `kdf.m = 32768` (refused) and a valid key set → `setKeys` refused; mutation: the old `readWalletView`-only binding →
@@ -384,7 +493,9 @@ readable, refused by neither opener, and `not-unreadable`: a `cli` wallet; 100 a
 `rewrapPassword`; the output of `reencryptForAccounts` (an account added); `addPasskeyWrap` with a 1-byte and a 64-byte
 credential ID; odd names (`''`, an emoji sequence, a bidi override, 5 000 characters). And one more fixture committed
 verbatim: the output of the **first encoder, at 458dfcd** (the oldest vault a developer profile could hold),
-`src/vault/__tests__/fixtures/envelope-v1-458dfcd.json`, with and without a passkey.
+`src/vault/__tests__/fixtures/envelope-v1-458dfcd.json`, with and without a passkey. Both fixtures are pinned by
+sha256 (a swapped fixture is not a control); the 458dfcd vault is readable, but its seed fails AES-GCM (that encoder
+sealed it without the header's additional data) — §2.1's out-of-predicate case (rev 2.2).
 
 **Deletable controls — at least one per clause of U1–U3 (review 2 Minor 1),** each `→ forgotten`, `v1_vault` absent,
 the phrase gone: U1 `null`, `[]`, `"x"`; U2 no `v`, `v: "1"`, `v: 0`, `v: 1.5`; U3 `scheme: 1`; `kdf.alg: 'scrypt'`;
@@ -412,15 +523,21 @@ only `@scure/base`.
 - M-scheme: U3 requires `scheme ∈ {slip10, cli}` → F8 deleted → RED;
 - M-iv: the `seed.iv` length check dropped → the 11-byte-IV control kept → RED (the negative direction);
 - M-digest: step 5's digest re-check dropped → the replaced-value control removes → RED;
-- M-lock: step 6's session check dropped → a session written straight into the session store before the click (as a
-  disk-fault session would be; R3 keeps `setKeys` from making one) is not refused, the vault is removed → RED.
+- M-lock: step 6's session check dropped → a session written straight into the session store (as a disk-fault
+  session would be; R3 keeps `setKeys` from making one) inside the lock's own session section — after step 3, the one
+  step 6 must see — is not refused, the vault is removed → RED. A session present **before** the click is locked by
+  step 3; it has its own control and mutation (M-lock-first: step 3 dropped → RED) (rev 2.2).
 
 ## 3. #37 without holding (E6, D31) — and §2's removal (E11)
 
 - The hold (1 s, `HOLD_MS`, pointer or Space/Enter held) stays (`HoldButton.tsx`).
-- **Added:** a native `<input type="checkbox">` under the button, labelled "I understand this permanently removes this
-  wallet from this browser". When it is checked **and** DELETE matches, the button deletes on **one activation** —
-  a click, or Space / Enter **on the button** — without a hold.
+- **Added:** a native `<input type="checkbox">` directly **above** the button — before it in the DOM, on screen and in
+  tab order, so a screen-reader or keyboard user meets the box before the action it unlocks (rev 2.2; D31) — labelled
+  "I understand this permanently removes this wallet from this browser", shown only while DELETE matches. When it is
+  checked **and** DELETE matches, the button deletes on **one activation** — a click, or Space / Enter **on the
+  button** — without a hold. The button's name follows the box ("Hold to delete"; checked: "Delete wallet" on #37,
+  "Remove damaged wallet" on the removal), and the hold's instructions are hidden while it is checked. On the box,
+  Space toggles it and Enter does nothing (native behaviour, rev 2.2).
 - **Enter does not confirm (Minor 7, B1's rule):** Enter in the DELETE field activates nothing — neither the hold nor
   the checkbox path. Test.
 - **Checkbox state (Minor 8):** unchecked on every entry to the screen; cleared whenever the typed word stops
@@ -436,9 +553,13 @@ only `@scure/base`.
 
 ### 4.1 In the extension
 
-- **#1 welcome** (`src/unlock/screens/welcome.ts`): under the buttons, as drawn, "By continuing you agree to the
-  **Terms** and **Privacy Policy**" — both links.
-- **#38 About** (`src/app/screens/About.tsx`): the rows Terms, Privacy, Open-source licences, Help, as drawn.
+- **#1 welcome** (`src/unlock/screens/welcome.ts`): above the buttons, as drawn (rev 2.2: rev 2.1 said "under"; the
+  design draws the line before the bar, where it is today), "By continuing you agree to the **Terms** and **Privacy
+  Policy**" — both links.
+- **#38 About** (`src/app/screens/About.tsx`): the rows Terms, Privacy, Open-source licences, Help, as drawn — spelled
+  as the design spells them; the design's package count on the licences row is not built (the popup cannot know it:
+  the page is generated after the popup is bundled) (rev 2.2). Every link row's name ends with a screen-reader suffix
+  " (opens in a new tab)" (rev 2.2).
 - Terms, Privacy and Help open in a new tab: `https://noc-tura.io/extension/terms`, `/extension/privacy`,
   `/extension/help`, as `<a target="_blank" rel="noopener noreferrer">` — the pattern of the explorer link
   (`TxDetail.tsx:65`). Links the browser opens, never a fetch: CSP `connect-src` stays exactly
@@ -457,8 +578,11 @@ and the OFL's own) — as **escaped text**, never navigable. The gates are taugh
   of `ENTRIES` or a member of `STATIC_PAGES` (an unknown page fails — today `bundleViolations`, line 896, follows the
   scripts of every root `.html` and refuses nothing for a script-less unknown page). **The static-page rule (N1):** the
   file contains none of `<a`, `href=`, `<script`, `<link`, `<style`, `style=`, an `on…=` attribute, `<iframe`,
-  `<form` (case-insensitive, over the raw file). Every `<` inside a licence text is escaped to `&lt;` by the generator,
-  so none of these can come from a licence.
+  `<form` (case-insensitive, over the raw file) — and, rev 2.2, uses only the tags and attributes the generator emits
+  (`html[lang]`, `head`, `meta[charset=utf-8]`, `title`, `body`, `h1`, `h2`, `p`, `pre`), so a `<meta http-equiv>`,
+  `<img>`, `<base>` or `<svg>` fails too; a missing `licenses.html` is INCONCLUSIVE, and the licence gate requires each
+  package's page to equal the page its maps give. Every `<` inside a licence text is escaped to `&lt;` by the
+  generator, so none of these can come from a licence.
 - `check-links.mjs` (§4.3) **skips `licenses.html` by name**; the static-page rule is what holds there instead.
 - `check-csp.mjs` reads every `.html` under the package (`checkHtml`): it covers the file unchanged.
 - `check-page-bundles.mjs` covers the two content scripts only; it is unaffected.
@@ -487,17 +611,22 @@ and the OFL's own) — as **escaped text**, never navigable. The gates are taugh
 4. **Licence text:** the package directory's `LICENSE*`, `LICENCE*` or `COPYING*` files (all of them, sorted by name —
    `borsh` ships `LICENSE-APACHE` and `LICENSE-MIT.txt`), CRLF folded to LF. No such file → the SPDX id from
    `package.json` `license`, with that licence's standard text from a committed table
-   (`extension/release/licence-texts/<SPDX>.txt`) headed by the package's `author` field; neither → **the build
+   (`extension/release/licence-texts/<SPDX>.txt`) headed by the package's `author` field ("Author: …", or "The package
+   names no author." — rev 2.2), never an invented copyright holder; neither → **the build
    fails** (no silent "unknown"). Probe: `bs58` 4.0.1 (twice) and `qrcode-generator` 2.0.4 ship no licence file and
    say MIT. **The SPDX id (N2, E15):** the `license` field when present; otherwise the committed table
    `extension/release/licence-ids.json` (`name@version → SPDX`), consulted for every package with rendered code and no
-   `license` field; **a package in neither → the build fails**. Today the table has one row:
+   `license` field; **a package in neither → the build fails**. The table never overrides a `license` field the
+   package has: a field outside the allowlist (an SPDX expression such as `MIT OR Apache-2.0`, a `{type}` object) fails
+   the build, and the failure says so — admitting it is an owner decision (rev 2.3). Today the table has one row:
    `text-encoding-utf-8@1.0.2 → Unlicense` (8 526 rendered bytes in `background.js`, web3.js's TextEncoder polyfill;
    its `LICENSE.md` is the Unlicense dedication). Controls: the row removed → fails; the row set to `LGPL-3.0-only` →
    fails (item 6).
 5. **Non-module assets:** the two Geist fonts in `public/fonts/` (copied as files, never modules) — an entry from a
    committed `extension/public/fonts/LICENSE.txt` taken from the Geist release the files came from; any file under
-   `fonts/` in the package without an entry fails the build.
+   `fonts/` in the package without an entry fails the build. Rev 2.2: the entry pins both faces to geist 1.7.2 by
+   sha256 (a changed face fails the build until its entry is revisited), and `fonts/LICENSE.txt` ships in every package
+   beside the faces (OFL 1.1 asks for it).
 6. **Allowlist (R7, the owner's list, E15):** a rendered package whose SPDX id is outside {MIT, ISC, BSD-2-Clause,
    BSD-3-Clause, Apache-2.0, 0BSD, OFL-1.1, Unlicense, and ours} fails the build; adding to the list is an owner
    decision, never a plan edit. **`rpc-websockets` (N3, E16):** 9.3.9, LGPL-3.0-only, is in the dependency graph
@@ -505,8 +634,10 @@ and the OFL's own) — as **escaped text**, never navigable. The gates are taugh
    `class RpcWebSocketClient extends CommonClient` at top level, `lib/index.browser.esm.js:12`), but its rendered
    length is **0** — `Connection` and the WebSocket path are tree-shaken; no LGPL code ships today (rev 2 said
    otherwise; it read the ids, not the rendered code). Kept anyway, **as a precaution**:
-   - a gate: every module under `node_modules/rpc-websockets/` has `renderedLength` 0 in every chunk (mutation: a
-     `new Connection(...)` planted in the background → fails);
+   - a gate: no module under `node_modules/rpc-websockets/` is in any chunk of any map (with the alias the package
+     never enters the graph), and the stub renders 0 bytes (mutation: a `new Connection(...)` planted in the
+     background → the stub renders code → fails) — stricter than "rendered 0", which the stub would pass (rev 2.2); a
+     map without its `chunks` or `rendered` section is INCONCLUSIVE, never a pass (rev 2.3);
    - an alias of the bare specifier `rpc-websockets` to a local stub with exactly two named exports — `CommonClient`, a
      class (an `extends` of a non-constructor would throw at module evaluation), and `WebSocket`, a function — each
      throwing if ever constructed or called. Only `Connection`'s constructor makes a `RpcWebSocketClient`, and no file
@@ -515,7 +646,8 @@ and the OFL's own) — as **escaped text**, never navigable. The gates are taugh
      test imports `@solana/web3.js` under the alias and uses what the extension uses (`PublicKey`,
      `VersionedTransaction`, `TransactionMessage`, `SystemProgram`) without a throw.
 7. **Order and determinism:** "Noctura" first, then entries sorted by name, then version (C collation); texts
-   HTML-escaped; no date, no absolute path. Determinism follows from the lockfile; `verify-reproducible.mjs` covers the
+   HTML-escaped; lines over 100 columns wrapped at word boundaries, so a tab does not scroll sideways (rev 2.2; a
+   window narrowed to 412 px still does — the page may carry no stylesheet); no date, no absolute path. Determinism follows from the lockfile; `verify-reproducible.mjs` covers the
    file with the rest of the package. The package carries no licence notice today (the minifier drops `@license`
    comments — probe: none in any built file); this page is where the notices MIT and Apache-2.0 ask for live.
 
@@ -542,7 +674,8 @@ Coordinator routes the `--no-presale` `background.js` names (relevant to §6): `
 `/referral-stats` (B1d's record and referral routes are presale-only).
 
 **The rule.** A new `scripts/check-links.mjs`, run in `gates:build` for both builds' `chrome/` and `firefox/`
-packages. It reads every `.js`, `.html`, `.css` and `.json` file **except `licenses.html`, skipped by name** (N1: its
+packages. It reads every `.js`, `.html`, `.css`, `.json` and `.svg` file (rev 2.3: an SVG document can carry
+`<a xlink:href>`; none ships today) **except `licenses.html`, skipped by name** (N1: its
 licence texts carry URLs as escaped text; §4.2's static-page rule holds there) and extracts every match of
 `\b(?:https?|wss?|ftp)://[^\s"'`<>)\\;]*`. Each match must equal, **as a whole string**, one entry of:
 - **Coordinator:** `https://api.noc-tura.io/*` and `https://api.noc-tura.io` (in `manifest.json` only);
@@ -553,7 +686,13 @@ licence texts carry URLs as escaped text; §4.2's static-page rule holds there)
   `https://noc-tura.io/extension/privacy`, `https://noc-tura.io/extension/help`;
 - **Inert library strings**, each with its package and reason in the gate: the React error decoder, the `uuid`
   message, the five W3C namespaces. Inert means never fetched — `connect-src` admits only the coordinator — and never
-  navigated: no `href`, `window.open` or `openPage` is built from them (they are message text and namespace ids).
+  navigated: no `href`, `window.open` or `openPage` is built from them (they are message text and namespace ids);
+- **Presale build only (rev 2.2):** `https://noc-tura.io?ref=${}` — #24's invite link (`core/referral`), absent from
+  the probe above, which built only `--no-presale`; a template interpolation inside a match folds to `${}`, so a
+  minifier's renaming is one string while `…/terms${x}` still fails. The store build refuses it.
+
+Each row is allowed only in the files the table names (rev 2.2): the coordinator and the RP host as above, the four
+navigable links in a page file (`.js` / `.html`), the inert strings and the referral link in `.js` only.
 
 Anything else fails, naming the file. Zero matches in a package → `INCONCLUSIVE` (the extraction broke).
 
@@ -563,6 +702,11 @@ planted in a page chunk → fails; one inert entry changed by one character →
 `wss://evil.example` → fails. A library update that changes an inert string fails the gate until a reviewer adds the
 new string with its reason.
 
+**What the gate is (rev 2.3, the controller's ruling on review Q6 / M4).** A review aid, **not a security boundary**: a
+URL never written whole — split from its scheme, scheme-relative (`//host`), or encoded — passes it (a test pins that
+limit). The runtime boundary for fetches is CSP `connect-src` (`npm run csp`); navigation is bounded by every link the
+user is given being a whole string from `src/shared/links.ts`, and by review.
+
 ### 4.4 Tests
 
 The four rows on #38 and the two links on #1 (href, `target`, `rel`); `licenses.html` generated, deterministic (two
@@ -649,7 +793,8 @@ this product. Nothing in the extension connects to it: `connect-src` admits only
   and records `{rpId: 'wallet.noc-tura.io', confirmedBy: 'owner', decision: 'E17'}`, and its `rpId` equals `RP_ID`;
   §7 step 3 restates it.
 - **Pinned (test + mutation).** A new test (`src/vault/__tests__/rpId.test.ts`) asserts
-  `` `https://${RP_ID}/*` `` is a `HOST_PERMISSIONS` value and `RP_ID` equals `rp-id.json`'s. Mutation: the entry
+  `` `https://${RP_ID}/*` `` is a `HOST_PERMISSIONS` value (B1e-1) and `RP_ID` equals `rp-id.json`'s (B1e-2, beside the
+  pre-upload gate the owner's confirmation fills — rev 2.2). Mutation: the entry
   removed from `HOST_PERMISSIONS` → RED (a later "tidy" of a seemingly unused host permission would otherwise silently
   break every passkey). Today only the origin derivation is tested (`ext.test.ts`).
 
@@ -818,12 +963,16 @@ Unit tests for every rule above with positive and negative controls and named mu
 permissions (version, `key`), the `RP_ID` pin (§5.6), the licence page's rendered-code and allowlist rules (§4.2), classes, no-presale, links and reproducible gates green; E2E for the phrase on the six
 screens, both damaged states (removal of an unreadable vault, its refusal for F0, the save download), #37's checkbox
 path, the links and `licenses.html`; every E2E normally and under `unshare -rn`; a visual pass of the undrawn elements
-at the popup's 412 × 600 and the window's real size. No test contacts `*.noc-tura.io`; only the release script's live
-check does.
+at the popup's 412 × 600 and the window's real size — rev 2.2: in the store build, the popup at 412 × 600, the vault
+page at 412 × 916 and the approval window at 412 × 720. R9's E2E strips the `phrase` field inside the page: the real
+background always sends a valid one (rev 2.2). `scripts/__tests__/presaleBuilds.test.mjs` runs `build.mjs` with
+`NODE_ENV` removed (rev 2.3, review M7): it is the only test that runs the build, and `verify` and CI run it with no
+`NODE_ENV`, so the test checks the production build that ships — nothing else changes. No test contacts
+`*.noc-tura.io`; only the release script's live check does.
 
 ## 11. Open questions for the owner
 
-None open after E15–E18. Rev 2's Q1 (LGPL) dissolved: no LGPL code ships (N3, E16). Rev 2's Q2 (the decrypt-damaged
+None open after E15–E22. Rev 2's Q1 (LGPL) dissolved: no LGPL code ships (N3, E16). Rev 2's Q2 (the decrypt-damaged
 vault) is a later step in §8.
 
 Not the owner's, but blocking the release: ICO's §6.2 answers and P1.
```

Check the spec for the date (the gate's own `dateViolations` over the spec file, with a control built from parts that must fail):

```bash
cd extension && node --input-type=module -e "
import {readFileSync} from 'node:fs';
import {dateViolations} from './scripts/check-no-tge-date.mjs';
const p = '../docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md';
console.log(dateViolations([{path: p, text: readFileSync(p, 'utf8')}]).length);"
```

Expected: `0` (observed `0`; the control assembled from parts gave `1`). `npm run gates` (which runs `check-no-tge-date.mjs` over `extension/`, the new specs included) exit 0.

- [ ] **Step 4: Run — green: tsc, vitest in both builds (UTC and local time), both builds, the gates, the new specs, the WHOLE Playwright suite normally and under `unshare -rn`, `npm run verify`.**

```bash
cd extension
npx tsc --noEmit; echo $?                                                        # 0
TZ=UTC npx vitest run                                                            # Test Files 239 passed (239) · Tests 5255 passed (5255) (rev 2.1)
TZ=UTC npx vitest run --config vitest.nopresale.config.ts                        # Test Files 22 passed (22) · Tests 531 passed | 25 skipped (556)
npx vitest run                                                                   # local time (Europe/Ljubljana, 2026-11-02): 5255 passed (5255) (rev 2.1: the same totals)
npx vitest run --config vitest.nopresale.config.ts                               # local time: 531 passed | 25 skipped (556)
node scripts/build.mjs; echo $?                                                  # 0
node scripts/build.mjs --no-presale; echo $?                                     # 0
npm run gates; echo $?                                                           # 0
npx playwright test e2e/phrase.spec.ts e2e/visual-b1e.spec.ts                    # 7 passed (2.4m)
```

The whole suite, launched detached with a marker (`scratchpad/b1e1-t7/full.sh`: normal, then `unshare -rn`, then the mutation sweep; polled until `full.done`):

```bash
npx playwright test --reporter=line                                              # 119 tests
unshare -rn sh -c 'ip link set lo up && npx playwright test --reporter=line'
```

Observed in the dry run (407213f — whose `e2e/` tree and product code are this task's rebuilt commit d68cce1's byte for byte): **normally `117 passed (31.1m)`, `2 failed` — `presaleSwitch.spec.ts` ×2** (on and off build): its `vault.status` expectation predated Task 4's `phrase` field (`+ "phrase": null`); no task's Playwright subset had included it. With that file changed: `2 passed (7.0s)`. **Under `unshare -rn` (with the change): `119 passed (30.5m)`.** Logs: `scratchpad/b1e1-t7/full-normal.log`, `full-unshare.log`. **Rev 1:** that change is Task 4's now (the controller's ruling — a test changes in the task that changes its answer), and Tasks 4 and 6 run the whole suite in their Step 4; this task's tree gets it from Task 4. Expected here: `119 passed` normally and under `unshare -rn`. **Rev 2, observed on the rebuilt a636405** (launched detached with a status file, waited for with a bounded poll): **`119 passed (30.7m)`** normally; **`119 passed (30.4m)`** under `unshare -rn sh -c 'ip link set lo up && npx playwright test --reporter=line'`.

`npm run verify` (after the Playwright runs — it deletes `dist*`): exit **0** (rev 2, on a636405: exit 0 — the build, `239 / 5247` and `22 / 531 + 25` in local time, csp, secrets, gates, reproducible 28 files per package; build + both vitest runs in local time + csp + secrets + gates + reproducible: 28 files per package, each package's two builds one digest).

- [ ] **Step 5: Commit.**

```bash
git add extension/e2e/phrase.spec.ts extension/e2e/visual-b1e.spec.ts extension/e2e/damaged.spec.ts extension/src/app/__tests__/Send.test.tsx docs/superpowers/specs/2026-10-30-extension-b1e-chrome-release-design.md
git commit -m "test(extension): B1e-1 Task 7 — the anti-phishing phrase on the six screens end to end, the visual pass of the undrawn elements, Send.test's DST row; spec rev 2.2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 6: The named mutations of the visual spec — each alone, in a fresh `git archive HEAD` copy (node_modules symlinked); `tsc`'s own exit code first; the store build (`node scripts/build.mjs --no-presale`); then `npx playwright test e2e/visual-b1e.spec.ts` (3 tests).** The sweep: `scratchpad/b1e1-t7/mut.py` (logs `M-*.log`, results `mut-results*.json`). Every mutation is a product change the spec's load-bearing assertions must catch: the line's copy, R9's copy, the box above the button (geometry and DOM), the exact sticky-bar count, every bar control wholly in the frame, Save's look.

| id | the change | observed |
|---|---|---|
| M-vis-locked-line | `src/app/screens/Locked.tsx`: `<PhraseLine phrase={wallet.phrase} />` → `<PhraseLine phrase={{state: 'none'}} />` | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the popup test: `expect(locator).toHaveText` "Anti-phishing phrase: Blue horse 42" — element(s) not found |
| M-vis-window-line | `src/approve/ui.tsx` (`WindowTop`): `<PhraseLine phrase={phrase} />` → `{phrase.state === 'failed' ? <PhraseLine phrase={phrase} /> : null}` | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the window test: "Anti-phishing phrase: Blue horse 42" not found (#47) |
| M-vis-r9 | `src/app/ui/PhraseLine.tsx`: the failed branch returns `null` first | tsc 0 · build 0 · **RED** `2 failed \| 1 passed` — the popup test and the window test: R9's copy not found |
| M-vis-order-37 | `src/app/app.css`: `.sticky-bar > .app-understood { order: 2; }` appended (the box drawn below the CTA; the DOM unchanged) | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the popup test: "the checkbox row ends above the button" expected ≤ 360, received 584 |
| M-vis-order-rd | `unlock.html`: `#rd-understood-row` moved after `#rd-hold` | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the vault test: "the checkbox row ends above the button" expected ≤ 704, received 832 |
| M-vis-bar-class | `unlock.html`: the damaged screen's `<div class="sticky-bar">` → `<div class="vlt-actions">` (a bar that lost its class) | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the vault test: "b1e-09-unreadable: 1 sticky bar(s)" expected 1, received 0 |
| M-vis-bar-overflow | `src/unlock/unlock.css`: `.vlt-col .s9-ack-row.vlt-understood` gains `width: 480px;` (the checkbox row wider than the 412 px frame) | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the vault test: "b1e-rd-matched: the copy wholly in the frame". First form, `margin-left: 120px;`, **survived** (`3 passed`): a block's margin narrows it inside the bar, nothing leaves the frame — the mutation was wrong, not the check; replaced, both recorded |
| M-vis-save-underline | `src/unlock/unlock.css`: the `.vlt-col a.btn { text-decoration: none; }` rule removed (Task 2's fixed bug back) | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the vault test: `toHaveCSS('text-decoration-line')` expected "none", received "underline" |

**The DST row's control** (Step 2): **M-dst-old** — the old row (`Date.now() - 12 * DAY`) restored, `TZ=Europe/Ljubljana`, `Date` fixed at 2026-11-01T22:30Z → **RED** (`last 11 days ago`); green at three other instants. The new row: green at all four, in seven zones.

Rev 2's rows (E19, E20), observed on the rebuilt a636405:

| id | the change | observed |
|---|---|---|
| M-vis-refused-heading | `unlock.html`: the refused state's `<h1>` back to rev 1's sentence | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the vault test: `#dmg-refused` `toHaveText('Update Noctura to open this wallet')` (rev 1's three-line sentence received) |
| M-vis-overline | `unlock.html`: the step's overline `Optional` → `Onboarding` | tsc 0 · build 0 · **RED** `1 failed \| 2 passed` — the vault test: the overline expected "Optional", received "Onboarding" |

8 mutations, all red (one first form replaced and recorded). **Rev 2:** M-vis-refused-heading and M-vis-overline added (E19, E20); all 10 run on the rebuilt a636405: every one `tsc` 0, build 0 and red (`1 failed | 2 passed`, M-vis-r9 `2 failed | 1 passed`), each at its own assertion. Clean-up: each copy removed by its exact path by the sweep; the scratch DST files removed from `extension/` by exact name.

#### Notes for the executor (Task 7)

- **Rev 2.1:** the spec diff below now runs from rev 2.1 to rev 2.4 (review 2's N1 and N4 lines in §1.5, the status line and a "Rev 2.4" list); `npm run verify` was not re-run here — `tsc`, both vitest runs (`239 / 5255`, `22 / 531 + 25`), both builds, `npm run gates` and `npm run csp` were, all 0.
- **Rev 2:** the visual spec asserts E19's heading and first body line and E20's overline; the spec diff below carries rev 2.3 (from rev 2.1, as rev 1's carried rev 2.2). Rev 1's chain carried that spec at rev 2.2; the repository commits rev 2.3 on its own before this plan.
- **Ruling: the six-screen E2E sets the phrase two ways** — test 1 writes `v1_phishing_phrase` through the service worker (as the background would leave it) to reach every screen quickly in both builds; test 2 sets it the user's way (onboarding's step, #35, #10) and reads it back. The key is named only in `e2e/` (outside the vault-isolation gate's scope, as the other specs' keys) — cost if wrong: none.
- **Ruling: R9 is induced inside the page** (an init script removes `phrase` from the one answer: `wallet.state` on the popup, `vault.status` on #9 and #10, `dapp.pending` in the window) — the real background always sends a valid field, so the only real-browser way to the line is a page that cannot trust the field it got. Task 5's scratch check did the same.
- **Ruling: the locked window is reached by a site asking to connect while locked** (`jup.ag`, raw Wallet Standard); a signing request from an already connected site while locked opens no window in this flow, and between windows the C14 limits are reset (`v1_dapp_limits`), because the spec rejects more requests in a minute than the cooldown allows, by its own design (as `visual-dapp.spec.ts`' `fresh`).
- **Ruling: the import in both specs chooses the standard address type** — the fake coordinator funds both of `E2E_MNEMONIC`'s address types in a scene with the presale installed, so #8 asks (`#imp-choose-slip10`).
- **Ruling: the visual pass runs on the store build only** (the release; F12 is shared compliance code, and `phrase.spec.ts` covers it in both builds). Its frames: the popup 412 × 600, the vault page 412 × 916 (the mockups' and every vault-page visual spec's), the approval window 412 × 720 (`WINDOW_WIDTH` × `WINDOW_HEIGHT`, `window.ts`).
- **Ruling: the visual spec's bar check counts exactly and includes labels and inputs** (`button, a, input, label` in each visible `.sticky-bar`), because the new elements of this release — the checkbox rows — live inside the bars. Counts per screen as drawn: the popup's locked screen, #35 and #38 none; #37 one; every vault-page screen and every window one.
- **Ruling: the DST fix uses the harness's own clock option** (`WalletOptions.now`, the provider's clock that `useNow` reads), not fake timers — one row, no global state; both instants built from local date parts.
- **Rev 1: `presaleSwitch.spec.ts` is not changed here.** The dry run's whole-suite run found it red since Task 4 (`vault.status` gained `phrase` there, and no task's Playwright subset ran this spec); the controller moved the one-expectation change into Task 4 and made Tasks 4 and 6 run the whole suite (the ledger's ruling; the B1d-1b rev 2 lesson).
- **No red-first run of the new specs:** they cover behaviour Tasks 2–6 built and pass on 2d157ba's product code (Task 7 changes none); their red side is the named mutations, each a product change.

#### Notes for the executor (Task 7, continued) — the dry run's rulings, deviations and hand-over

- Rulings beyond the brief: the seven in "Notes for the executor" (two ways of setting the phrase; R9 induced in the page; the locked window via a connect and the limits reset; the standard address type chosen; the visual pass on the store build at three frames; the exact bar count with labels and inputs; the DST fix through the harness clock).
- Deviations: `presaleSwitch.spec.ts` found red by the whole suite (a Task 4 consequence the subsets missed — **the whole suite was not run by Tasks 4–6** in the dry run; rev 1 moves the change into Task 4 and runs the whole suite at Tasks 4 and 6); no red-first run (no product change); M-vis-bar-overflow's first form survived and was replaced (recorded). One process slip: a scratch Playwright run was stopped with a pattern kill (`pkill -f "playwright test e2e/phrase.spec.ts"`) instead of by exact PID — it matched only this task's own run; recorded, not repeated.
- Visual pass: no code fix needed; four judgements for the owner (the refused heading at three lines, #37's taller bar, #35's plain "Off", the step without a count) and Task 5's / Task 6's flagged copy still to confirm. Shots `scratchpad/b1e1-t7/shots/b1e-*.png` (32), design renders `scratchpad/b1e1-t7/design/`, contact sheets `scratchpad/b1e1-t7/sheets/` (A–J).
- Spec rev 2.2 written (status line, 20 change lines, the named passages edited); no TGE date (checked).
- For the controller / B1e-2: the store screenshots can reuse `visual-b1e.spec.ts`' `frame`; the `rp-id.json` half of §5.6 and its gate are B1e-2's; the owner's copy list (Tasks 2, 5, 6) is still open.

## Self-review

- **Spec coverage — every B1e-1 section of §0's first row, item by item.**
  - **§1 The anti-phishing phrase:** §1.1 (what it protects against — the help text, never typed into a website, visible to the profile) → Task 5 (the step's and #35's help, flagged copy); §1.2 (where it shows: #9 before the password, the popup's locked screen, #46, #47, #48 in every state incl. F12's Reject-only screen, #10; plain text; nothing when unset; R9) → Task 5 (`PhraseLine`, `phraseLine.ts`, `WindowTop`'s required prop, `phraseRead`), end to end in Task 7 (`phrase.spec.ts`, both builds, R9 induced in the page); §1.3 (the operations table, `settings.phrase`, the `phrase` challenge, `vault.reauthOk` applying it, the last proof wins, #10 never showing the value; onboarding after `commitWallet`, skipped on `created-locked`; #35's row) → Task 4 (the background, `PhraseStep`) and Task 5 (the step's screen, #35, `describeChallenge`, `runReauth`'s `applied: 'phrase'`); §1.4 (the key in `WALLET_DATA_KEYS` and `BACKGROUND_OWNED_KEYS`, the three answers) → Task 4; §1.5 (the rules; rev 2.3's E21 rules) → Task 4 (`cleanPhrase`, M-nfc … M-printable, rev 2's M-dicp … M-visible-spaces); §1.6 (tests and gates: six screens in both builds, `<b>x</b>` as text, the sender partition, onboarding surviving the first write, wiped / kept, the built-content-script `storage` gate) → Tasks 4, 5 and 7.
  - **§2 Damaged vaults:** §2.1 (three readings, the frozen predicate U1–U3, the partition, out of the predicate) → Task 1; §2.2 (the screens: unreadable and refused on #9 and #1, the removal screen, the address line) → Task 2; §2.3 (Save the damaged data, both states, R4) → Task 2 (`saveDamaged.ts`; the bytes read back from Playwright's download in `damaged.spec.ts`); §2.4 (`vault.forgetDamaged`, E5's order, E12) → Task 2, with Review Focus 1's row; §2.5 (sessions over a refused envelope, R3) → Task 1; §2.6 (the F table both ways, the deletable controls, the breadth and the 458dfcd fixture, the invariance test, the source test; M-version, M-kdf, M-policy, M-scheme, M-iv, M-digest, M-lock and the E2E) → Task 1 (the predicate's half) and Task 2 (the message's half and the E2E), extended by Task 7 (the phrase wiped by the removal).
  - **§3 #37 without holding, and §2's removal (E6, E11, D31):** → Task 3 (both pages, unit rows and E2E normally and under `unshare -rn`), shot in Task 7.
  - **§4 Links:** §4.1 (#1's line and #38's rows, a new tab, never fetched) → Task 6 (`links.ts`, `About.tsx`, `unlock.html`, `links.spec.ts` in both builds); §4.2 (`licenses.html`: N1–N3, E15, E16, inputs 1–7, the static-page rule, the rpc-websockets gate and stub) → Task 6 (`licences.mjs`, `check-licences.mjs`, `rpcWebsockets.mjs`, the stub, `STATIC_PAGES`); §4.3 (the link gate, its URL table, the skip by name, its controls) → Task 6 (`check-links.mjs`), with Review Focus 2's row; §4.4 (tests) → Task 6. §5.6's code half (E17: `RP_ID` pinned to `HOST_PERMISSIONS`) → Task 6 (`rpId.test.ts`); the `rp-id.json` half → B1e-2.
  - **§9 Undrawn elements:** each built from the design system's components (Tasks 2, 3, 5, 6) and shot in Task 7's committed visual pass (`visual-b1e.spec.ts`, 32 shots at 412 × 600, 412 × 916 and 412 × 720, compared with `index.html` on rendered images); the owner's four judgements and the flagged copy are in Task 7's notes.
  - **§10 Tests and gates (B1e-1's half):** both vitest runs and both builds at every task; every new gate in `npm run gates` once per build (vault isolation incl. `contentStorageViolations` and `STATIC_PAGES`, links, licences, classes); every E2E normally and under `unshare -rn`; the whole Playwright suite at Tasks 4, 6 and 7 (rev 2: at Task 7 on the rebuilt chain, Tasks 4 and 6 as rev 1 ran them); `npm run verify` at Tasks 6 and 7 (reproducible: 28 files per package).
- **Placeholder scan:** no `TODO`, `TBD`, `FIXME`, "fill in", "similar to Task N" or elided code in any step (checked by `grep` over this file: none in a step; the words occur only inside the rules that forbid them); every new file is given in full and every changed file as the diff committed in the dry run, but the two files "How to read the steps" names (the 458dfcd fixture verbatim, geist@1.7.2's `LICENSE.txt` fetched and pinned). Every commit step carries the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, the dry run's model; the executor writes its own model there (the Global Constraints' truthful trailer). Task 7's commit step had no trailer in its part; rev 1 adds it.
- **Type consistency across the tasks' Interfaces:** Task 1's `VaultReading` (`none` / `unreadable` / `refused` / `wallet`), the exported `envelopeShape` and the shared controls (`F`, `DELETABLE`, `breadth()`, `firstEncoder()`, `edited()`) are what Task 2's `forgetDamaged` and its tests consume, and the page's `vaultReading` is what `damaged.ts`, `removeDamaged.ts` and `damagedFlow.ts` judge with; Task 2's seam `mountDeleteConfirm(parts, o)` is the one Task 3 extends (`ConfirmParts` gains the required `name`, `understood`, `understoodRow`; `o.onceName`), and `removeDamaged.ts` passes only those; `HoldButton`'s new `once` / `describedBy` are used by #37 alone. Task 4's wire contract — `phrase: string | null` on `wallet.state`, `vault.status` and `dapp.pending`; `settings.phrase → {outcome: 'set' | 'unchanged'} | reauth-required {challengeId} | locked | malformed | failed`; `vault.challengeInfo → {kind: 'phrase', action: 'change' | 'remove'}`; `vault.reauthOk → {applied: 'phrase'}`; `PhraseStep = (o: {path: 'create' | 'import'; then(): void}) => void` — is exactly what Task 5 parses (`phraseRead` → `PhraseRead`, `PhraseDescription`, `runReauth`) and mounts (`mountAntiPhishing(deps): PhraseStep`, passed by `modes.ts` to both runs); `presaleSwitch.spec.ts`' expectation of `vault.status` changes with that contract, in Task 4. Task 5's `.app-sr` is what Task 6's link rows use for " (opens in a new tab)"; Task 5's and Task 6's selectors are Task 7's inputs (Task 7's Interfaces). No task after Task 4 adds `contentStorageViolations` again. Mechanically: the replay below compiles nothing itself, but every tree it reproduces is a rebuilt commit on which `tsc` exited 0.
- **Consistency replay (rev 2.1, 2026-11-02):** the same procedure onto `git archive 9562c5c`, compared with `diff -rq` against each commit of `dry/b1e1-r21` — **IDENTICAL for every task:** Task 1 (77b0fb1; 5 new files, 6 diff blocks), Task 2 (51d4315; 11 + 19), Task 3 (31a4a44; 0 + 13), Task 4 (6405846; 4 + 15), Task 5 (d7dda3e; 8 + 5), Task 6 (9900eac; 14 + 14, and `fonts/LICENSE.txt`), Task 7 (8c6d76a; 2 + 3). Negative control: the final replayed tree against rev 2's chain end `dry/b1e1-r2` a636405 differs in exactly the four files rev 2.1 changed (the spec, `unreadable.test.ts`, `envelopeRules.ts`, `envelopeRules.test.ts`). The replay directory was removed by its exact path.
- **Consistency replay (rev 2, 2026-11-02):** the same procedure as rev 1's below (`git archive 9562c5c`; task-1 … task-7's new files and diff blocks from THIS file, in order, each diff block alone with `git apply --recount`; Task 1's fixture as given; Task 6's `fonts/LICENSE.txt` from 5c9cbd3, checked against its sha256 `930853ee…`), compared with `diff -rq` against `git archive` of each commit of `dry/b1e1-r2` — **IDENTICAL for every task:** Task 1 (9c9b8db; 5 new files, 6 diff blocks), Task 2 (2876fea; 11 + 19), Task 3 (be35060; 0 + 13), Task 4 (a982e28; 4 + 15), Task 5 (a6d3923; 8 + 5), Task 6 (5c9cbd3; 14 + 14, and `fonts/LICENSE.txt`), Task 7 (a636405; 2 + 3). Negative control: the final replayed tree against rev 1's chain end `dry/b1e1-rf` d68cce1 differs in exactly the 19 files rev 2 changed: the spec; `e2e/damaged.spec.ts`, `visual-b1e.spec.ts`, `visual-vault.spec.ts`; `scripts/check-licences.mjs`, `check-links.mjs`, `licences.mjs`, `check-links.test.mjs`, `licences.test.mjs`; `accountsStore.ts`, `stored.ts`, `envelopeRules.ts`, `unlock.html`; and the tests `envelopeRules.test.ts`, the background's `phrase.test.ts`, the popup's `phrase.test.tsx`, `phraseRead.test.ts`, `phraseScreens.test.ts`, `damagedScreens.test.ts`. The replay directory was removed by its exact path.
- **Consistency replay (rev 1, 2026-11-02):** `git archive 9562c5c`, then task-1 … task-7's new files and diff blocks taken from THIS file, in order, each diff block alone with `git apply --recount` (Task 1's fixture as given; Task 6's `fonts/LICENSE.txt` taken from a5d3918 and checked against its pinned sha256 `930853ee…9137` — its Step 3 fetches it from npm), compared with `diff -rq` against `git archive` of each commit of `dry/b1e1-rf` — **IDENTICAL for every task:** Task 1 (e9b0c63; 5 new files, 6 diff blocks), Task 2 (8864b4e; 11 + 19), Task 3 (38ceea0; 0 + 13), Task 4 (236ef45; 4 + 15), Task 5 (09e6730; 8 + 5), Task 6 (a5d3918; 14 + 14, and `fonts/LICENSE.txt`), Task 7 (d68cce1; 2 + 3). Negative control: the final replayed tree against the dry run's first chain end, `dry/b1e1` 407213f, differs in exactly the two Review Focus files (`check-links.test.mjs`, `forgetDamaged.test.ts`) — `presaleSwitch.spec.ts` is the same file at the end of both chains, now reached through Task 4. The replay directory was removed by its exact path.
- **Review Focus:** five lines; two have their rows (1: Task 2's two-tab row, M-serial red; 2: Task 6's limit row with its two controls, M-scheme-relative red), three are known limitations with their reasons (the live pages — B1e-2's live check; the Firefox package — E1; a real screen reader — no harness).
