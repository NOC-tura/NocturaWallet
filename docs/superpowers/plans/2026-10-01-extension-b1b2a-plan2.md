# Noctura Extension B1b-2a · Plan 2 — the vault-page screens (#1–#10, #39), #7 and #40 in the UI tab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build spec §12's plan 2 ("B1b-2a-2"): the owner's onboarding, unlock, re-authentication and recovery screens in the vault page (#1, #2, #3, #4, #5, #6, #8 with its restore and retry paths, #9, #10 with its discard and its `expired` mapping, #39, the add-account and reveal forms restyled), #7 and #40 in the UI tab at `#/created` and `#/imported`, the resume hand-over route as a stand-in that sends nothing, the popup locked screen's "Forgot password?", and E2E specs 1, 2, 3, 10 and 12 — every screen to `index.html` faithfully, every departure stated.

**Architecture:** The vault page (`unlock.html` → `src/unlock/main.ts`) stays plain DOM (spec S1): its screens are static sections of `unlock.html` (the design's markup and copy, restyled with the design's own classes) driven by small controllers in `src/unlock/screens/`, built from vault-local DOM helpers in `src/unlock/view/`, with every string the page sets in the stand-alone `src/unlock/strings.ts`. Each controller is mounted once per page from `src/unlock/modes.ts` and gets one `PageDeps` object (the background by runtime message, the stored vault, the KDF, a clock, the tab), so happy-dom tests drive the real `unlock.html` against the REAL background (`handleMessage` over an in-memory storage) with a manual clock. The page-side halves of E3 (`challenge.ts`, the closed-alphabet renderer) and E5 (`forgetFlow.ts`, the seed and factor proofs, the only two ways the page may send `vault.forgetWallet`) are pure modules with their own tests. The UI tab (React, `src/app/`) gains three first routes read from `location.hash` — `#/created` (#7), `#/imported` (#40), `#/send/resume?account=…` (stand-in) — rendered before the lock gate by a provider that reads nothing but the state on those routes.

**Tech Stack:** TypeScript 5 (strict), plain DOM in the vault page, React 18.3.1 in the UI tab, Vite 8, Vitest 5 (`// @vitest-environment happy-dom` per DOM test file), `@testing-library/react` 16, happy-dom 20, Playwright 1.63 (Chromium, contained), Node 22.12.0, npm 11.6.2. No new dependency.

**Spec:** `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md` (owner-approved 2026-09-29; plan 1 merged as PR #101). Read §1.2 (the vault page and its gate), §2 E3 and E5 (their vault-page halves), §3 (every screen here), §4.1 (the popup's locked screen), §7.6 (rule 6), §8 (testing) and §12 (the split) before starting. Parent spec: `docs/superpowers/specs/2026-09-27-extension-b1-design.md` (rev 5). The design: `/home/user/Downloads/index.html` (`#s1`–`#s10`, `#s39`, `#s40`, `#s7`) and `/home/user/Downloads/screen.md` — binding (CLAUDE.md). Plan 1 (`docs/superpowers/plans/2026-09-29-extension-b1b2a-plan1.md`) and its ledger (`.superpowers/sdd/2026-09-29-extension-b1b2a-plan1/progress.md`) show the code this builds on and the lessons it carries.

**Dry run (2026-10-01).** This plan's end state was built in a scratch copy of the repository outside the checkout (`git archive` of `main` at 23a5010), one commit per task, and then **replayed task by task** in a second worktree of that copy: each task's tests were applied to the previous task's tree and run (red, as each Step 2 below states), then the task (green), then `tsc --noEmit` and the whole vitest suite (green after every task, 1 028 → 1 258; see each task). Under Node 22.12.0 with only `web/` and `extension/` installed (`npm ci --ignore-scripts`, npm 11.6.2): `npm run verify` in `extension/` (build, tests, csp, secrets, every gate incl. the new rules, reproducible) passed; all 22 Playwright specs passed in a normal launch **and** inside an offline network namespace (`unshare -rn`), with the noc-tura.io and Solscan counters at 0; `web/`'s `npm run verify` passed (503 + 3 tests, csp, scan, reproducible); the root app's `tsc --noEmit` and the **full** root `jest` passed (1 228 passed, 1 skipped) (root `node_modules` linked in for that step only; no task touches the root `src/`). Every mutation named below was run on the end state and turned its test red. What the dry run caught is listed at the end ("Dry-run findings"); every catch is fixed in the code below. **Revision 2 (2026-10-01)** applies every finding of the plan-2 review (`.superpowers/sdd/b1b2a-plan2-review-1.md`: 0 blockers, 2 high, 7 medium, 9 low) and its rulings; the dry run was repeated for the result (every task replayed red → green, every mutation, `npm run verify`, both E2E launch modes).

## Scope — what plan 2 builds, its stand-ins, what stays for plan 3, and every departure (stated)

**Built here (spec §12 item 2):** #1 (replacing plan 1's minimal `welcome` mode), #2, #3, #4, #5 (the create, import and restore variants), #6, #8 (plain import, #39's restore path on E5 with `replacement`, #40's "Try a different seed" path on E5 with the unfunded guard, D41), #9 (with "Forgot password?", deferred here from plan 1 by ruling), #10 (with its `[Cancel send]` discard, E7, and its `expired` mapping, D39), #39, the `accounts` and `reveal` forms restyled, #7 and #40 in the UI tab at `#/created` and `#/imported`, the popup locked screen's "Forgot password?" (§4.1's plan-1 stand-in removed), and E2E specs 1, 2, 3, 10 and 12. Every plan-1 carry is in a task: the E3 renderer with its closed alphabet and the `unknown-challenge` → `expired` mapping (Tasks 3, 11); forgetFlow's page-side proof tests (Task 2); the stored-null alignment (Task 1, and each screen's damaged state); E5's `unlocked` copy (Tasks 12–13, spec edited); "Forgot password?" (Tasks 10, 12); the lessons (Tasks 5, 17, 18).

**Plan-2 stand-ins (each replaced by plan 3, spec §12):**
1. **`wallet.html#/send/resume?account=<address>`** — where #10 hands over after a proven re-authentication (D38). Plan 2 shows "Open the Noctura icon to continue." and `[Close this tab]`; it reads nothing but `wallet.state`, prepares nothing and **sends nothing** (Task 15 proves it with a message spy). The prepared send stays in the background for #20 (or expires there). Plan 3 makes this route #20 `confirmed`.
2. Plan 1's stand-ins on #11, #26, #27 and the popup are untouched (no Send action, no resume on popup open, no `[Try again]` on #27) — they are plan 3's.

**Not in plan 2 (plan 3's, spec §12 item 3):** #12, #19, #20, #21, #43's opener, #44, #54, `wallet.send` from any screen, the popup's `preparedFor` resume, E2E specs 4, 5 and 11. Plan 2 adds no engine change: every message it uses (`vault.challengeInfo`, `vault.forgetWallet`, `wallet.discardPrepared`, `wallet.probeBalances`, the B1b-1 vault messages) merged in plan 1.

**Departures, decisions and contradictions — stated.** The plan-2 review (Fable, `.superpowers/sdd/b1b2a-plan2-review-1.md`: approve after fixes) ruled on each contradiction below; each ruling is quoted with the item, and every spec amendment it names is a spec-editing step (Tasks 12 and 18). **Every controller addition is marked "controller addition — confirmed by the owner 2026-10-01"** in the code comments and the spec: the owner has not confirmed any of them yet.
1. **#3's CTA** reads "I've written it down" (disabled until one full hold) and, in `confirmed`, "Continue" — as the design's 3e draws it. Spec §3.3 writes "`confirmed`: … `[I've written it down]` → #4"; both labels go to #4. **Ruled (ruling 1): the plan is right** (the design is binding); Task 18 amends §3.3's `confirmed` line to "`[Continue]` → #4", noting that 3b–3d read "I've written it down".
2. **#4's pool** is one pool of nine words: each slot's word with two BIP-39 distractors of the same first letter, none of them a phrase word — the design's 4a rows ("orchid coral circle / vendor voyage vintage / lift linger latch"). Spec §3.4's "1 correct + 8 BIP-39 distractors per slot" is read as "of the nine, one is right for each slot". **Ruled (ruling 6): the plan is right**; Task 18 rewords §3.4 to "a pool of nine: each slot's word with two BIP-39 distractors of the same first letter, none a phrase word".
3. **#8 keeps an editable field.** The design draws the words only in the mono cell grid; a browser needs a field to type and correct a phrase. The field sits inside the design's `.ta-wrap`, the grid shows the words typed so far under it, and the counter targets 12 words up to 12, then 24. Spec Differs entry added (Task 18).
4. **#10's "Network fee" includes the priority fee.** Spec §4.5 defines the fee rows "the same on #19, #20, #10", but `vault.challengeInfo`'s `about` (E3, merged) carries `networkLamports` and no `priorityLamports`, so #10 cannot split them. A zero Noctura fee shows its reason line (the carried rule, §4.5); §3.10's "each its own line when non-zero" is read as applying to the fee amounts. `charged` with a zero fee is not described (fail closed). **Ruled (ruling 2): accepted for plan 2** — "Network fee" = `networkLamports` (priority included) on #10, declared in §3.10's Differs. The controller asked for `about` to be extended with `priorityLamports` (validated in the closed alphabet) *unless the review ruled otherwise*; it did, and the plan follows it: plan 2 is UI-only (§12 — "plan 2 adds no engine change"), and the field would change the merged E3 record the background validates key by key (`isAbout`'s exact 11 keys), the challenge store, its tests and the page renderer together — the engine change belongs with the screens that need the split, #19 and #20, which plan 3 builds. Plan 3's carry list has it (end of this plan). The reason-line reading is right: the amounts appear when non-zero, a zero Noctura fee always shows its reason, and `charged` with 0 fails closed.
5. **E5 `busy` has two copies in the spec** (E5 step 5's "…Nothing was deleted; the wallet is locked. Start again." and #8's "The wallet changed while you were typing. Start again."); the page cannot tell a step-1 `busy` (nothing locked) from a step-5 one (locked), so it always shows #8's line, which is true in both. **Ruled (ruling 3): one line, #8's**; Task 12 amends E5 step 5's page sentence to point at §3.8's line (the `unlocked` line stays separate).
6. **The vault page reads a stored null as damaged** (carry 3): `src/unlock/stored.ts` gives the background's three answers (absent = no wallet; an envelope = a wallet; anything else = damaged). Every flow reads through it. **What the page shows instead of a repair** (#37 is B1b-2b): "This wallet's stored data is damaged." + "Your funds stay on Solana; your recovery phrase still controls them." with no setup and no password field — on #1, #9, #10, #8 (restore/retry). The plan-2 review's copy verdict: true, but it left the user no next step while #37 is B1b-2b, so the line now reads "Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase." (the second sentence is the spec's own `not-this-wallet` advice) — **controller addition — confirmed by the owner 2026-10-01**.
7. **E5's `unlocked`** (carry 4) gets its own line on #39's restore and #40's retry (both on #8): "The wallet was unlocked while this was running, so nothing was deleted. Start again." + `[Start again]` — **controller addition — confirmed by the owner 2026-10-01**, added to the spec (Task 12). The review: true and clear; accepted.
8. **Spec E2E 10's "'Verified · sent before' on #12 (D40)"** cannot run in plan 2 (#12 is plan 3's). Spec 10 checks the engine message #12 reads instead: `wallet.recipientInfo` answers `known: true` for the recipient after the restore. **Ruled (ruling 4): accepted for plan 2**; Task 18 records it in §8.5, and plan 3 restores "Verified · sent before" on #12, folded into spec 11 (plan-3 carry).
9. **Spec E2E 1's `document.fonts.check('16px Geist')`** returns true when no face named Geist exists at all. Spec 1 also asserts that `document.fonts.load('16px Geist')` loads at least one face. **Ruled (ruling 5): `load()` → ≥ 1 face is the real assertion, `check()` stays beside it**; Task 18 amends §1.2's last bullet and §8.5 spec 1.
10. **#39's step copy** the spec does not give (step 1's card 2 and card 3 bodies, step 2's lede and card 3, step 3's card 3) is adapted from the design's sentences with the spec's own words (Task 12) — **controller adaptations — confirmed by the owner 2026-10-01**, listed in the spec's #39 Differs (Task 18). **Ruled (ruling 7): accepted**; the step-2 lede "Type or paste the 12 or 24 words, in order." is true and clear (the design's "type the first 3 letters" describes a picker #8 lacks).
11. **The design's `.s-secintro` scope on #39 and #40 is not carried**: none of its rules applies to their cards, and the plan's ancestor-aware coverage check (Task 5) flags a class that styles nothing.
12. **#6 has no back arrow** (the wallet is already stored when it shows); **#5 on the restore path** reads "Recovery" (#39's eyebrow) with "Restore · 2 / 2"; **#10's cooldown button** reads "Confirm paused" and **a settings challenge's cancel** reads "Cancel" (only closes the tab; the challenge simply expires — noted in the spec) — the last two are **controller additions — confirmed by the owner 2026-10-01** (review: both clear; accepted).
13. **`[Start again]`** (the button the `busy`/`unlocked` lines offer: → #39 on the restore path, → the retry path's start on the retry path) is a **controller addition — confirmed by the owner 2026-10-01** (review: clear; accepted).
14. **#40 reads at most six accounts** — spec §3.12's Engine line says so ("sequential, ≤ 6"); what it did not say is what the screen says past six. **Ruled (ruling 8): keep `MAX_READ = 6`, and the copy never claims accounts it did not read** (review M2): past six, "N accounts · M tokens recovered from the first 6." and "across the first 6 of N accounts" — **controller addition — confirmed by the owner 2026-10-01**; a wallet with more never shows `no-assets-empty`. Its "≈ X SOL" is truncated, never rounded up (plan-1 ruling L6, review M1); under the address chip, #7's "Copying puts the address on your clipboard. Noctura does not clear it afterwards." (the carried rule; the spec's #40 copy omitted it — **controller addition — confirmed by the owner 2026-10-01**, review M3). The address is in groups of four, not the design's 6+6 `.ck` highlight (§11.7); one token reads "1 token" (**controller addition — confirmed by the owner 2026-10-01**; review: accepted).
15. **The vault page's 500 ms floor** (rule 6, §7.6) is `exclusive()` in `src/unlock/page.ts`: the page's one busy gate held until the action settles and 500 ms have passed. The gate also tells every mounted screen when it frees up — an action begun on #5 ends on #6, whose buttons must come back (the dry run caught #6's Skip staying disabled).
16. **The UI tab's hand-over screens run a quiet provider** (`WalletProvider quiet`): `wallet.state` only — #7 reads nothing from the network, #40 reads its own balances (one account at a time) and the prices, the resume stand-in reads nothing. Without it, #40 would read account 0 twice.
17. **Two departures from plan 1's gates, both tightenings:** the vault isolation gate forbids writing markup in `src/unlock` (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `createContextualFragment`, `DOMParser`, `srcdoc`, `document.write`); the class gate now covers `unlock.html` and `src/unlock` (a vault-page class must be a literal string). Its stand-alone rule now ignores prose that a loose pattern reads as an import ("Continue to import" in `strings.ts`) — the vault-page walk already filtered the same way; a real import still fails (fixture).
18. **The class gate ignores ancestor context** (plan-1 lesson): plan 2 does not rely on it alone. `src/__tests__/styled.ts` checks every rendered element of every DOM test (vault page and #7/#40): each class must match a rule *where it stands* (or, for a scope class, match a descendant). In the dry run it caught #39's inert `.s-secintro` scope. Plan 1's static gate is left as it is for `src/app` (plan 3 may extend the rendered check to its screens).
19. **What holds the seed, the keys and the password, and for how long** (review H2; the brief's priority 1). Stated per run, each with a test:
    - **the create run's phrase** — `createCreateRun`'s closure, from #3's first show until the wallet is stored (`created`, `created-locked`, `exists`), and with the page. #3 and #4 drop their own references whenever they are left (#3's `clear()` empties its `words`; #4 empties its plan) — after the store nothing on the page holds it (Tasks 7, 8).
    - **the phrase on #8** (plain import, restore, retry) — kept while the page is open, **a hidden tab included**: §3.5's hidden-tab rule is the password's, and dropping the phrase under an open #5 would end the run on an untrue "That is not a valid 12- or 24-word recovery phrase." (review M4). It goes when the wallet is stored, at every other end of the run, on Back (into the field, not memory), and with the page (`pagehide`). The restore run's seed proof holds the phrase too and has the same lifetime (review H2(c): allowed, stated).
    - **passwords** — #5's typed passwords and the one a `[Try again]` holds go when the tab is hidden (§3.5's rule wins over E5's "kept while this page stays open"; review L5); #5 then reads "Enter a new password to try again." (**controller addition — confirmed by the owner 2026-10-01**). #6's password (held for the passkey) goes when #6 ends or the tab is hidden (#6 then asks for it once more).
    - **the retry run's B prepared** (`PreparedWallet`: B's envelope **and its session secret keys**) — exists only behind a pending `[Try again]`; it goes at every end of the run (stored, every `stop`, every notice, Back) **and whenever the tab is hidden**, with the password it was encrypted under — B is encrypted again under the password typed next. **The factor proof** (a revision stamp: no key material — the data key is zeroed at once) goes at every end of the run and on Back; it is **kept on a hidden tab**, like the phrase, because dropping it there would end an open #5 on "Something went wrong" — a departure from the review's literal "drop next/proof on hidden unless a retry is pending", made for the same reason as M4, with the key material (B prepared) dropped on hidden unconditionally. `RetryRun.holds()` reports the three references; the retry tests assert them after every terminal outcome (Task 13).
20. **#10's `undescribable` is still a prepared send** (review H1): `[Cancel send]` discards it by its account, re-validated by itself, then says "Send cancelled. Nothing was sent."; when even the account is not an address the button reads `[Close]` and the line is "Nothing was sent. Start the send again from the Noctura icon." — never "cancelled" (**both controller additions — confirmed by the owner 2026-10-01**). In every other notice with nothing to cancel the top bar's X closes the tab and claims nothing (review L4).
21. **A latent bug the review fixes surfaced** (Task 13): before H2, a `[Try again]` after a hidden tab re-used B prepared under the password §3.5 had just dropped — the user typed a new password and B was stored under the old one. Dropping B prepared on hidden fixes it; a test stores B under the new password and proves the old one fails.

## Global Constraints

Every task's requirements include these.

- **Implementers run mutations only in a scratch copy outside the repo** — copy the checkout, apply the edit there, run the named test, expect it red, discard the copy. Never in the checkout, never with `git worktree` (that is inside the repo).
- **Every task that touches the repo-root `src/` runs the FULL root `jest`.** No task here touches the root `src/`. Root jest does **not** run `core/` tests (`core/` is in `testPathIgnorePatterns`); `core/` tests run under extension's and web's vitest. No task here touches `core/`.
- **Before pushing, reproduce CI with ONLY `web/` and `extension/` installed, on Node 22.12:** `PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`, then `npm ci --ignore-scripts` (npm 11.6.2) in each, `npm run verify` in both, and `npm run e2e` in `extension/`.
- **e2e has no value or type imports from `core/`** (Playwright's loader cannot load core's CommonJS-typed modules). Addresses the E2E needs are written as constants, derived once with `src/vault/accounts.ts` (Task 17 states which).
- **E2E containment:** `ctx.route` plus `--host-resolver-rules` for every noc-tura.io name **and** solscan.io, with the counters asserted empty (`contained(h)` asserts `fake.hits > 0`, `fake.unexpected` empty, the Solscan and noc-tura.io counters 0). The containment positive-control spec (`e2e/containment.spec.ts`) stays as it is.
- **Never contact `*.noc-tura.io` or `solscan.io` from tests.**
- **Commit trailers name the executing model, truthfully** — each commit block below ends `Co-Authored-By: <the executing model's own line>`.
- **The TGE date is never written anywhere** — code, tests, fixtures, comments, docs, commit messages. A repo-wide CI gate (`scripts/check-no-tge-date.mjs`, PR #100) and the extension's own gate enforce it.
- **`extension/` has no eslint gate; never add `eslint-disable` comments.**
- **`extension/src/styles/design-ext.css` is generated — never hand-edit it.** Task 5 regenerates it with the plan-1 extraction script plus plan 2's prefixes, and pins the result's hash.
- CLAUDE.md: the design is binding — every state the design draws is built, every scope-down is in that screen's "Differs" list and stated in its task; TypeScript strict, **no `any`, no `@ts-ignore`**; **no placeholders**; money as BigInt base units (`formatAmount` truncates, never rounds a balance up); UTC in data, local time only at display; **rule 6** — the vault page's buttons use the page's one busy gate plus a 500 ms floor (`exclusive()`, spec §7.6), the UI's use `LockedButton`.
- Spec §1.2: **the vault page is plain DOM** — no React, no UI kit from `web/`, no network code, fixed strings only (`strings.ts`, `unlock.html`), the user's own words and #10's re-validated fields. Text is set with `textContent` only.
- Spec: copy in "quotes" is the design's English unless marked **→ adapted**; every string a screen shows is the spec's, and the DOM/component tests assert them exactly. Copy this plan had to propose is marked **controller addition** (in code comments and in the spec).
- **The visual pass is an opus-tier reviewer's** (plan-1 lesson: a sonnet pass found 2 of at least 11 drifts). Every visual state asserts its own copy before its screenshot; a transient state is shot only under a controlled clock (or held open by the test); the E2E is deterministic in a normal launch **and** under `unshare -rn` (Chromium's `navigator.onLine` is false there).
- Prettier style of the surrounding code: single quotes, trailing commas, no spaces inside braces, no parens around a single arrow parameter.

## How to read the steps

- A **new file** is given in full. A **changed file** is given as a unified diff against the file as the previous task left it; save the block to a file and apply it with `git apply --recount` from the repository root (or by hand — every hunk is exact). `unlock.html` and `unlock.css` grow task by task, so their diffs apply in task order.
- Commands run from `extension/` unless they start with `cd`. "Whole suite" means `npx tsc --noEmit && npx vitest run`; the expected totals are the dry run's (a reviewer-added test raises them; that is not a defect).
- The vault-page DOM tests load the real `unlock.html` (`src/unlock/__tests__/pageHarness.ts`) and run each screen against the REAL background (`handleMessage` over the in-memory `fakeExt`, with `fakeDeps`), a manual clock (`fakeTimers`), and Argon2id at a tiny cost (`testKdf`: the envelope declares production parameters, the test computes a small one — as plan 1's tests do).

## The vault-page boundary — how every vault screen stays inside it

`unlock.html` is the only page where the seed and the password exist. Plan 2 keeps every vault screen inside the boundary in four ways, each checked by a gate or a test:
1. **Source allowlist (plan 1's gate, walked from the real entry).** Everything `src/unlock/main.ts` reaches must be `src/unlock/**`, `src/vault/**`, `src/shared/**`, `src/ui/send.ts`, the two shared stylesheets and `src/unlock/unlock.css`, `../core/keys/**`, `../core/util/**`, or one of five crypto packages. Task 5 adds fixtures that put the two imports this exists to stop **inside plan 2's new folders** — a `src/unlock/view/` helper importing `src/app/ui/Banner.tsx`, a `src/unlock/screens/` file importing `react`, `react-dom/client` and `web/src/ui/AddressGroups` — each must fail the gate; Task 14 asserts the real walk reaches every screen, view and module plan 2 adds (positive control), so none escapes the rule by being unreachable from the test's point of view.
2. **No React in the built vault bundle (plan 1's gate):** the React 18 marker must be absent from every file `unlock.html` loads and present in some built file (else INCONCLUSIVE). Plan 1's fixtures for the built output stay; the end-of-plan `npm run gates` runs it on the real build.
3. **Text only (new, Task 5):** no file in `src/unlock` may write markup (`innerHTML`, `outerHTML`, `insertAdjacentHTML`, `createContextualFragment`, `DOMParser`, `srcdoc`, `document.write[ln]`) — fixtures for each spelling, and the negative controls (`textContent`; the same code in `src/app`).
4. **Stand-alone strings:** `src/unlock/strings.ts` imports nothing (plan 1's rule; Task 5 keeps prose from tripping it and keeps a real import failing). Every string the page *sets* is there; the static copy is `unlock.html`'s markup.

## File map

| path | task | responsibility |
|---|---|---|
| `extension/src/unlock/stored.ts` | 1 | the vault page's one reader of `v1_vault`: none / wallet / damaged, as the background answers |
| `extension/src/unlock/mode.ts` | 1 | the modes and their closed `source` / `return` enums |
| `extension/src/unlock/orchestrate.ts`, `onboarding.ts`, `accountsFlow.ts`, `revealFlow.ts`, `reauthFlow.ts`, `main.ts` | 1, 2, 3 | aligned to `storedVault`; the backoff's wait length; `prepareWallet` / `commitWallet`; `expired` |
| `extension/src/unlock/__tests__/accountsFlow.test.ts` | 1 | the 100-key test's 30 s timeout (dry-run finding 9) |
| `extension/src/unlock/__tests__/pageHarness.ts` | 6, 8, 12 | the real `unlock.html` against the real background; refuses a bare `vault.forgetWallet` (review M5) |
| `extension/src/unlock/forgetFlow.ts` | 2 | the seed and factor proofs; the only two `vault.forgetWallet` messages (E5) |
| `extension/src/unlock/strings.ts` | 3–14 | every string the page sets (stand-alone) |
| `extension/src/unlock/challenge.ts` | 3 | #10's closed-alphabet renderer, `readChallenge`, `discardPrepared` (E3, E7) |
| `extension/src/unlock/page.ts` | 4, 8, 13 | `PageDeps`, `PageTarget`, the page gate, `exclusive()` (rule 6) |
| `extension/src/unlock/view/{dom,words,hold,meter,cooldown}.ts` | 4 | the vault-local DOM helpers |
| `extension/src/styles/design-ext.css` | 5 | regenerated from `index.html` (never by hand) |
| `extension/src/unlock/unlock.css`, `extension/unlock.html` | 5–14 | the vault page's own layout; its sections (the design's markup and copy) |
| `extension/scripts/check-vault-isolation.mjs`, `check-classes.mjs`, `check-fonts.mjs` (+ tests) | 5, 14 | no markup in `src/unlock`; vault-page classes; Geist on the vault page; the boundary fixtures and positive control |
| `extension/src/__tests__/styled.ts` | 5 | ancestor-aware class coverage of rendered DOM |
| `extension/src/unlock/screens/welcome.ts` | 6 | #1, #2 |
| `extension/src/unlock/screens/seed.ts` | 7 | #3 |
| `extension/src/unlock/screens/{confirm,password,passkey,createRun}.ts`, `browser.ts`, `modes.ts` | 8 | #4, #5, #6, the create run; the real `PageDeps`; the dispatcher |
| `extension/src/unlock/screens/{importScreen,importRun}.ts` | 9 | #8 and the plain import run |
| `extension/src/unlock/screens/unlock.ts` | 10 | #9 |
| `extension/src/unlock/screens/reauth.ts` | 11 | #10 |
| `extension/src/unlock/screens/{forgot,restoreRun}.ts` | 12 | #39; #8's restore path |
| `extension/src/unlock/screens/retryRun.ts` | 13 | #8's retry path |
| `extension/src/unlock/screens/{accounts,reveal}.ts` | 14 | the B1b-1 forms restyled |
| `extension/src/app/{router.ts,App.tsx,WalletContext.tsx,platform.ts}`, `ui/useCloseTab.ts`, `ui/ExtIcon.tsx`, `screens/{Created,Resume}.tsx`, `app.css` | 15 | the tab's hand-over routes, the quiet provider, #7, the resume stand-in |
| `extension/src/app/screens/Locked.tsx` | 10 | the popup locked screen's "Forgot password?" |
| `extension/src/app/screens/Imported.tsx` | 16 | #40 |
| `extension/src/app/format.ts`, `extension/src/app/screens/Home.tsx` | 16 | `approxSol` — one truncating "≈ X SOL" for #11 and #40 (review M1) |
| `extension/e2e/{vaultPage.ts,onboarding.spec.ts,visual-vault.spec.ts,fakeCoordinator.ts,makeEnvelope.ts}`, `wallet.spec.ts`, `unlock.spec.ts`, `visual.spec.ts` | 8, 10, 11, 17, 18 | the vault page driven in a browser; specs 1–3, 10, 12; the resume stand-in asserted in a browser (17, review M7); the visual pass |
| `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md` | 12, 13, 18 | E5 `unlocked` copy (controller addition); plan 2's Differs entries |

---

### Task 1: The vault page reads v1_vault as the background does; the closed `source`/`return` enums; the backoff tells its wait

**Files:**
- Modify: `extension/src/unlock/__tests__/accountsFlow.test.ts`
- Modify: `extension/src/unlock/__tests__/mode.test.ts`
- Modify: `extension/src/unlock/__tests__/orchestrate.test.ts`
- Modify: `extension/src/unlock/__tests__/reauthFlow.test.ts`
- Create: `extension/src/unlock/__tests__/stored.test.ts`
- Modify: `extension/src/unlock/accountsFlow.ts`
- Modify: `extension/src/unlock/main.ts`
- Modify: `extension/src/unlock/mode.ts`
- Modify: `extension/src/unlock/onboarding.ts`
- Modify: `extension/src/unlock/orchestrate.ts`
- Modify: `extension/src/unlock/reauthFlow.ts`
- Modify: `extension/src/unlock/revealFlow.ts`
- Create: `extension/src/unlock/stored.ts`

**Interfaces:**
- Consumes: plan 1 — `checkEnvelope` (`src/vault/envelope.ts`), `attemptUnlock`/`createWrongBackoff` (`src/unlock/orchestrate.ts`), `finishOnboarding`/`addPasskey` (`onboarding.ts`), `addAccount` (`accountsFlow.ts`), `runReveal`, `runReauth`.
- Produces:
  - `src/unlock/stored.ts`: `type StoredVault = {kind: 'none'} | {kind: 'damaged'} | {kind: 'wallet'; env: EnvelopeV1}`; `storedVault(raw: unknown): StoredVault`
  - `src/unlock/mode.ts`: `type ImportSource = 'forgot' | 'retry'`; `type ReturnTo = 'created' | 'imported'`; `PageMode` = `{mode: 'unlock'; returnTo: ReturnTo | null} | {mode: 'welcome'} | {mode: 'create'} | {mode: 'import'; source: ImportSource | null} | {mode: 'forgot'} | {mode: 'accounts'} | {mode: 'reveal'} | {mode: 'reauth'; challengeId: string}`; `pageMode(search: string): PageMode`
  - `src/unlock/orchestrate.ts`: `AttemptUnlockDeps.readEnvelope(): Promise<unknown>` (replaces `envelope()`); `WrongBackoff.run(action, onWait: (ms: number) => void)`; `'proven'` in the streak-resetting outcomes

Plan-1 carry 3: the background answers `stored-invalid` for anything in `v1_vault` that is not an envelope — **null included** — and `no-wallet` only for an absent key (`accountsStore.ts`), while the vault page read a stored null as "no wallet" in five places (onboarding's `present()`, `accountsFlow`, `revealFlow`, `reauthFlow`, the unlock page's `envelope() ?? null`). This task adds the one reader every page flow now uses, `src/unlock/stored.ts` (`none` / `wallet` / `damaged`), and aligns the five call sites: a damaged vault is never treated as gone — onboarding refuses to write over it (`exists`, before any Argon2id run) and every flow that needs the envelope stops with `damaged`, sending nothing. `attemptUnlock`'s dependency becomes `readEnvelope(): Promise<unknown>` (absent = `undefined`), so the unlock page cannot map a stored null to "no wallet" either.

Two small engine-of-the-page changes the screens need: `pageMode` learns the spec §1.2 modes (`forgot`; `import&source=forgot|retry`; `unlock&return=created|imported`) — `source` and `return` are **closed enums**: an unknown value is dropped, never followed, and no parameter names a URL; and `createWrongBackoff`'s `onWait` is told the length of the wait (#9's cooldown card counts it down), and #40's factor proof (`'proven'`, Task 2) resets the streak like any proven factor.

One harness fix the plan-2 review asked for in this PR: `accountsFlow.test.ts` › "refuses an account past MAX_ACCOUNTS" derives 100 keys and takes ~6 s under a parallel run's CPU load — past vitest's 5 s default (dry-run finding 9). It gets a `30_000` timeout here, so no later task's whole-suite run can fail on it.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/unlock/__tests__/accountsFlow.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/accountsFlow.test.ts b/extension/src/unlock/__tests__/accountsFlow.test.ts
index 2747dbb..7f21881 100644
--- a/extension/src/unlock/__tests__/accountsFlow.test.ts
+++ b/extension/src/unlock/__tests__/accountsFlow.test.ts
@@ -84,7 +84,8 @@ describe('accounts in the vault page', () => {
     expect(await addAccount(full.deps, {password: PASSWORD, kdf})).toBe('too-many-accounts');
     expect(full.store.calls).toHaveLength(0);
     expect(full.sent.map(m => m.type)).toEqual(['vault.status']);
-  });
+    // Deriving 100 keys takes ~6 s under a parallel run's CPU load — past vitest's 5 s default.
+  }, 30_000);
 
   it('a cli wallet has exactly one account', async () => {
     const cli = await wallet([0], 'cli');
```

Modify `extension/src/unlock/__tests__/mode.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/mode.test.ts b/extension/src/unlock/__tests__/mode.test.ts
index 2cbf70a..8e8f5d6 100644
--- a/extension/src/unlock/__tests__/mode.test.ts
+++ b/extension/src/unlock/__tests__/mode.test.ts
@@ -3,18 +3,33 @@ import {pageMode} from '../mode';
 describe('pageMode', () => {
   const id = 'ab'.repeat(16);
   it('reads the mode from the query string; anything unknown is the unlock page', () => {
-    expect(pageMode('')).toEqual({mode: 'unlock'});
+    expect(pageMode('')).toEqual({mode: 'unlock', returnTo: null});
     expect(pageMode('?mode=welcome')).toEqual({mode: 'welcome'});
     expect(pageMode('?mode=create')).toEqual({mode: 'create'});
-    expect(pageMode('?mode=import')).toEqual({mode: 'import'});
+    expect(pageMode('?mode=import')).toEqual({mode: 'import', source: null});
+    expect(pageMode('?mode=forgot')).toEqual({mode: 'forgot'});
     expect(pageMode('?mode=accounts')).toEqual({mode: 'accounts'});
     expect(pageMode('?mode=reveal')).toEqual({mode: 'reveal'});
-    expect(pageMode('?mode=export')).toEqual({mode: 'unlock'});
+    expect(pageMode('?mode=export')).toEqual({mode: 'unlock', returnTo: null});
   });
 
   it('re-authentication needs a well-formed challenge id', () => {
     expect(pageMode(`?mode=reauth&challenge=${id}`)).toEqual({mode: 'reauth', challengeId: id});
-    expect(pageMode('?mode=reauth&challenge=<b>')).toEqual({mode: 'unlock'});
-    expect(pageMode('?mode=reauth')).toEqual({mode: 'unlock'});
+    expect(pageMode('?mode=reauth&challenge=<b>')).toEqual({mode: 'unlock', returnTo: null});
+    expect(pageMode('?mode=reauth')).toEqual({mode: 'unlock', returnTo: null});
+  });
+
+  // Spec §1.2: `source` and `return` are closed enums, never URLs.
+  it('import takes source=forgot|retry; anything else is a plain import', () => {
+    expect(pageMode('?mode=import&source=forgot')).toEqual({mode: 'import', source: 'forgot'});
+    expect(pageMode('?mode=import&source=retry')).toEqual({mode: 'import', source: 'retry'});
+    for (const s of ['', 'FORGOT', 'delete', 'https://evil.example', 'forgot%20']) expect(pageMode(`?mode=import&source=${s}`)).toEqual({mode: 'import', source: null});
+  });
+
+  it('unlock takes return=created|imported; anything else hands over nowhere', () => {
+    expect(pageMode('?mode=unlock&return=created')).toEqual({mode: 'unlock', returnTo: 'created'});
+    expect(pageMode('?mode=unlock&return=imported')).toEqual({mode: 'unlock', returnTo: 'imported'});
+    expect(pageMode('?return=created')).toEqual({mode: 'unlock', returnTo: 'created'});
+    for (const r of ['send', 'home', 'wallet.html#/send', '//evil.example']) expect(pageMode(`?mode=unlock&return=${encodeURIComponent(r)}`)).toEqual({mode: 'unlock', returnTo: null});
   });
 });
```

Modify `extension/src/unlock/__tests__/orchestrate.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/orchestrate.test.ts b/extension/src/unlock/__tests__/orchestrate.test.ts
index 972536f..44cb2cf 100644
--- a/extension/src/unlock/__tests__/orchestrate.test.ts
+++ b/extension/src/unlock/__tests__/orchestrate.test.ts
@@ -8,31 +8,45 @@ import {
   type BusyGate,
   type Outcome,
 } from '../orchestrate';
+import {base64} from '@scure/base';
 import type {EnvelopeV1} from '../../vault/envelope';
 
+// Well-formed (checkEnvelope accepts it: production Argon2id, every byte string its length), so the
+// read is a wallet; unlockFlow is a stub, so nothing here is decrypted.
+const bytes = (n: number) => base64.encode(new Uint8Array(n));
 const FAKE_ENV: EnvelopeV1 = {
   v: 1,
   scheme: 'slip10',
-  kdf: {alg: 'argon2id', m: 1, t: 1, p: 1, salt: ''},
-  seed: {iv: '', ct: ''},
-  password: {wrapped: ''},
-  accounts: [],
+  kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: bytes(16)},
+  seed: {iv: bytes(12), ct: bytes(48)},
+  password: {wrapped: bytes(40)},
+  accounts: [{index: 0, name: 'A', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}],
 };
 
 describe('attemptUnlock — the caller-owned prfOutput is zeroed on every path', () => {
-  it('zeroes prfOutput when the envelope read resolves null (no wallet on this browser)', async () => {
+  it('zeroes prfOutput when nothing is stored (no wallet on this browser)', async () => {
     const prfOutput = new Uint8Array(32).fill(7);
-    const r = await attemptUnlock({envelope: async () => null, send: async () => ({ok: true}), unlockFlow: async () => 'unlocked'}, {prfOutput});
+    const r = await attemptUnlock({readEnvelope: async () => undefined, send: async () => ({ok: true}), unlockFlow: async () => 'unlocked'}, {prfOutput});
     expect(r).toBe('no-wallet');
     expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
   });
 
+  // Plan-1 carry: the background calls a stored null (or any non-envelope) stored-invalid; the page
+  // used to call it "no wallet" and offer setup over it. It is damaged, never sent to unlockFlow.
+  it.each([null, [], 'v1', {...FAKE_ENV, accounts: []}])('a stored %j is damaged, not "no wallet", and zeroes prfOutput', async stored => {
+    const prfOutput = new Uint8Array(32).fill(7);
+    const unlockFlow = vi.fn(async () => 'unlocked' as const);
+    expect(await attemptUnlock({readEnvelope: async () => stored, send: async () => ({ok: true}), unlockFlow}, {prfOutput})).toBe('damaged');
+    expect(unlockFlow).not.toHaveBeenCalled();
+    expect(Array.from(prfOutput)).toEqual(new Array(32).fill(0));
+  });
+
   it('zeroes prfOutput when the envelope read rejects (e.g. extension context invalidated mid-prompt)', async () => {
     const prfOutput = new Uint8Array(32).fill(9);
     expect(
       await attemptUnlock(
         {
-          envelope: async () => {
+          readEnvelope: async () => {
             throw new Error('Extension context invalidated.');
           },
           send: async () => ({ok: true}),
@@ -48,7 +62,7 @@ describe('attemptUnlock — the caller-owned prfOutput is zeroed on every path',
     let sawEnv: EnvelopeV1 | undefined;
     const r = await attemptUnlock(
       {
-        envelope: async () => FAKE_ENV,
+        readEnvelope: async () => FAKE_ENV,
         send: async () => ({ok: true}),
         unlockFlow: async deps => {
           sawEnv = deps.env;
@@ -63,7 +77,7 @@ describe('attemptUnlock — the caller-owned prfOutput is zeroed on every path',
 
   it('leaves a password factor alone (nothing to zero)', async () => {
     const r = await attemptUnlock(
-      {envelope: async () => FAKE_ENV, send: async () => ({ok: true}), unlockFlow: async () => 'unlocked'},
+      {readEnvelope: async () => FAKE_ENV, send: async () => ({ok: true}), unlockFlow: async () => 'unlocked'},
       {password: 'correct horse battery', kdf: async () => new Uint8Array(32)},
     );
     expect(r).toBe('unlocked');
@@ -75,7 +89,7 @@ describe('attemptPasskeyUnlock', () => {
     let called = false;
     const r = await attemptPasskeyUnlock({
       evaluatePrf: async () => null,
-      envelope: async () => FAKE_ENV,
+      readEnvelope: async () => FAKE_ENV,
       send: async () => ({ok: true}),
       unlockFlow: async () => {
         called = true;
@@ -91,21 +105,21 @@ describe('attemptPasskeyUnlock', () => {
       evaluatePrf: async () => {
         throw new Error('NotAllowedError');
       },
-      envelope: async () => FAKE_ENV,
+      readEnvelope: async () => FAKE_ENV,
       send: async () => ({ok: true}),
       unlockFlow: async () => 'unlocked',
     });
     expect(r).toBe('unavailable');
   });
 
-  it('zeroes the PRF output evaluatePrf produced even when the envelope read comes back null', async () => {
+  it('zeroes the PRF output evaluatePrf produced even when nothing is stored', async () => {
     let captured: Uint8Array | undefined;
     const r = await attemptPasskeyUnlock({
       evaluatePrf: async () => {
         captured = new Uint8Array(32).fill(3);
         return captured;
       },
-      envelope: async () => null,
+      readEnvelope: async () => undefined,
       send: async () => ({ok: true}),
       unlockFlow: async () => 'unlocked',
     });
@@ -117,7 +131,7 @@ describe('attemptPasskeyUnlock', () => {
   it('unlocks end-to-end when the PRF output and the envelope are both good', async () => {
     const r = await attemptPasskeyUnlock({
       evaluatePrf: async () => new Uint8Array(32).fill(1),
-      envelope: async () => FAKE_ENV,
+      readEnvelope: async () => FAKE_ENV,
       send: async () => ({ok: true}),
       unlockFlow: async () => 'unlocked',
     });
@@ -197,6 +211,25 @@ describe('wrong-password backoff (spec §2: an increasing delay on top of the Ar
     expect(waits).toBe(4);
   });
 
+  // #9's cooldown card counts the wait down: the page is told its length (B1b-2a §3.9).
+  it('tells onWait how long the wait is', async () => {
+    const backoff = createWrongBackoff(async () => undefined);
+    const told: number[] = [];
+    for (let i = 0; i < 4; i++) await backoff.run(async () => 'wrong' as Outcome, ms => told.push(ms));
+    expect(told).toEqual([1000, 2000, 4000]);
+  });
+
+  it("resets on #40's factor proof ('proven'), as on unlocked", async () => {
+    const {slept, sleep} = recordingSleep();
+    const backoff = createWrongBackoff(sleep);
+    await backoff.run(async () => 'wrong', () => undefined);
+    await backoff.run(async () => 'wrong', () => undefined);
+    await backoff.run(async () => 'proven', () => undefined);
+    await backoff.run(async () => 'wrong', () => undefined);
+    await backoff.run(async () => 'wrong', () => undefined);
+    expect(slept).toEqual([1000, 1000]);
+  });
+
   it('resets on unlocked', async () => {
     const {slept, sleep} = recordingSleep();
     const backoff = createWrongBackoff(sleep);
```

Modify `extension/src/unlock/__tests__/reauthFlow.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/reauthFlow.test.ts b/extension/src/unlock/__tests__/reauthFlow.test.ts
index 0ea106b..d47cc41 100644
--- a/extension/src/unlock/__tests__/reauthFlow.test.ts
+++ b/extension/src/unlock/__tests__/reauthFlow.test.ts
@@ -75,11 +75,11 @@ describe('runReauth (the vault page proves the factor, the background is told)',
     expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('failed');
   });
 
-  it('a damaged envelope is named, and the background is told nothing past the status read', async () => {
+  it('a damaged envelope is named, and the background is told nothing — not even the status read (stored.ts)', async () => {
     const {deps, env, sent} = await setup(MNEMONIC);
     const damaged = {...env, password: {wrapped: 'AAAA'}};
     expect(await runReauth({...deps, readEnvelope: async () => damaged}, ID, {password: PASSWORD, kdf})).toBe('damaged');
-    expect(sent.map(m => m.type)).toEqual(['vault.status']);
+    expect(sent).toEqual([]);
   });
 
   it('zeroes the data key it unwrapped', async () => {
```

Create `extension/src/unlock/__tests__/stored.test.ts`:

```ts
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, type Kdf} from '../../vault/envelope';
import {storedVault} from '../stored';
import {addPasskey, finishOnboarding} from '../onboarding';
import {addAccount} from '../accountsFlow';
import {runReveal} from '../revealFlow';
import {runReauth} from '../reauthFlow';
import type {Send} from '../types';
import {memoryVault} from './memoryVault';

const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const PASSWORD = 'correct horse battery';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
let kdfCalls = 0;
const kdf: Kdf = (pw, salt) => (kdfCalls++, argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32}));
const ID = 'ab'.repeat(16);

function recorder() {
  const sent: unknown[] = [];
  const send: Send = async m => {
    sent.push(m);
    return {ok: true, data: {unlocked: true, accounts: [{index: 0, publicKey: K0}]}};
  };
  return {sent, send};
}

// Plan-1 carry (Task 7 review): the background answers 'stored-invalid' for anything in v1_vault that
// is not an envelope — null included — and 'no-wallet' only for an absent key. The page now agrees at
// every place it reads the vault.
describe('storedVault: the page reads v1_vault as the background does', () => {
  it('absent is "none"; a real envelope is a wallet', async () => {
    expect(storedVault(undefined)).toEqual({kind: 'none'});
    const env = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});
    expect(storedVault(env)).toEqual({kind: 'wallet', env});
  });

  it.each([null, [], 'v1_vault', 0, {v: 1}])('a stored %j is damaged, never "none"', raw => {
    expect(storedVault(raw)).toEqual({kind: 'damaged'});
  });
});

describe('every page flow reads a stored null as a damaged wallet, never as "no wallet"', () => {
  beforeEach(() => {
    kdfCalls = 0;
  });

  it('onboarding refuses to write over it before any Argon2id run, and stores nothing', async () => {
    const store = await memoryVault(null);
    const {sent, send} = recorder();
    expect(await finishOnboarding({...store, send, kdf}, {mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', indexes: [0]})).toBe('exists');
    expect(kdfCalls).toBe(0);
    expect(store.calls).toEqual([]);
    expect(sent).toEqual([]);
  });

  it('adding a passkey, adding an account, revealing and re-authenticating say damaged and send nothing', async () => {
    const store = await memoryVault(null);
    const {sent, send} = recorder();
    const randomBytes = (n: number) => new Uint8Array(n);
    const credentials = {create: async () => null, get: async () => null};
    expect(await addPasskey({...store, credentials, randomBytes}, {password: PASSWORD, kdf})).toBe('damaged');
    expect(await addAccount({...store, send}, {password: PASSWORD, kdf})).toBe('damaged');
    expect(await runReveal({readEnvelope: store.readEnvelope, send}, {password: PASSWORD, kdf})).toEqual({outcome: 'damaged'});
    expect(await runReauth({readEnvelope: store.readEnvelope, send}, ID, {password: PASSWORD, kdf})).toBe('damaged');
    expect(sent).toEqual([]);
    expect(kdfCalls).toBe(0);
    expect(store.calls).toEqual([]);
  });

  it('an absent vault is still "no wallet" (negative control of the rule above)', async () => {
    const store = await memoryVault();
    const {send} = recorder();
    expect(await addAccount({...store, send}, {password: PASSWORD, kdf})).toBe('no-wallet');
    expect(await runReveal({readEnvelope: store.readEnvelope, send}, {password: PASSWORD, kdf})).toEqual({outcome: 'no-wallet'});
    expect(await runReauth({readEnvelope: store.readEnvelope, send}, ID, {password: PASSWORD, kdf})).toBe('no-wallet');
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/accountsFlow.test.ts src/unlock/__tests__/mode.test.ts src/unlock/__tests__/orchestrate.test.ts src/unlock/__tests__/reauthFlow.test.ts src/unlock/__tests__/stored.test.ts`
Expected (dry run): FAIL — Test Files 4 failed | 1 passed (5) Tests 16 failed | 44 passed (60) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/unlock/accountsFlow.ts`:

```diff
diff --git a/extension/src/unlock/accountsFlow.ts b/extension/src/unlock/accountsFlow.ts
index 05568c6..5720fa5 100644
--- a/extension/src/unlock/accountsFlow.ts
+++ b/extension/src/unlock/accountsFlow.ts
@@ -5,6 +5,7 @@ import {deriveSessionAccounts} from '../vault/accounts';
 import {envelopeRevision} from '../shared/envelopeRevision';
 import {MAX_ACCOUNTS} from '../shared/envelopeRules';
 import {lockOnMismatch, sessionKeys} from './reauthFlow';
+import {storedVault} from './stored';
 import type {Send, VaultStore} from './types';
 
 export type AccountsOutcome =
@@ -33,9 +34,10 @@ type Named = {index: number; name: string}[];
  * stored envelope moved in between; the caller decides whether to run again.
  */
 async function attempt(deps: Deps, factor: ReauthFactor, change: (env: EnvelopeV1) => Named | AccountsOutcome): Promise<AccountsOutcome | 'busy'> {
-  const raw = await deps.readEnvelope();
-  if (raw === undefined || raw === null) return 'no-wallet';
-  const env = raw as EnvelopeV1;
+  const stored = storedVault(await deps.readEnvelope());
+  if (stored.kind === 'none') return 'no-wallet';
+  if (stored.kind === 'damaged') return 'damaged';
+  const env = stored.env;
   const session = await sessionKeys(deps.send);
   if (session === null) return 'not-unlocked';
   const proven = await openProven(env, factor, session);
```

Modify `extension/src/unlock/main.ts`:

```diff
diff --git a/extension/src/unlock/main.ts b/extension/src/unlock/main.ts
index b4023de..17068c2 100644
--- a/extension/src/unlock/main.ts
+++ b/extension/src/unlock/main.ts
@@ -29,9 +29,7 @@ const WORDS: Record<Outcome | 'unavailable', string> = {
   unavailable: 'This device cannot unlock the wallet with a passkey; your password still works.',
 };
 
-async function envelope(): Promise<EnvelopeV1 | null> {
-  return ((await readLocal(ENVELOPE_KEY)) as EnvelopeV1 | undefined) ?? null;
-}
+const readEnvelope = (): Promise<unknown> => readLocal(ENVELOPE_KEY);
 
 // Cardinal rule 6 (no double-submit): one busy flag for the whole page, not one per button —
 // while a passkey prompt is in flight the password form must not be submittable, and vice
@@ -71,7 +69,7 @@ async function withButtonsDisabled<T>(action: () => Promise<T>): Promise<T> {
 async function handlePasswordSubmit(): Promise<void> {
   const password = pw.value;
   const result = await runExclusive(gate, () =>
-    withButtonsDisabled(() => backoff.run(() => attemptUnlock({envelope, send, unlockFlow}, {password, kdf: workerKdf}), showWaiting)),
+    withButtonsDisabled(() => backoff.run(() => attemptUnlock({readEnvelope, send, unlockFlow}, {password, kdf: workerKdf}), showWaiting)),
   );
   if (result !== 'busy') status.textContent = WORDS[result];
 }
@@ -88,7 +86,7 @@ async function handlePasskeyClick(pk: NonNullable<EnvelopeV1['passkey']>): Promi
         () =>
           attemptPasskeyUnlock({
             evaluatePrf: () => evaluatePrf(navigator.credentials, unb64(pk.credentialId), unb64(pk.prfSalt)),
-            envelope,
+            readEnvelope,
             send,
             unlockFlow,
           }),
@@ -99,8 +97,8 @@ async function handlePasskeyClick(pk: NonNullable<EnvelopeV1['passkey']>): Promi
   if (result !== 'busy') status.textContent = WORDS[result];
 }
 
-void envelope().then(env => {
-  const pk = env?.passkey;
+void readEnvelope().then(raw => {
+  const pk = (raw as EnvelopeV1 | undefined)?.passkey;
   if (!pk) return;
   passkeyBtn.hidden = false;
   passkeyBtn.addEventListener('click', () => void handlePasskeyClick(pk));
```

Modify `extension/src/unlock/mode.ts`:

```diff
diff --git a/extension/src/unlock/mode.ts b/extension/src/unlock/mode.ts
index 7fa749d..dece4ef 100644
--- a/extension/src/unlock/mode.ts
+++ b/extension/src/unlock/mode.ts
@@ -1,13 +1,38 @@
-export type PageMode = {mode: 'unlock'} | {mode: 'welcome'} | {mode: 'create'} | {mode: 'import'} | {mode: 'accounts'} | {mode: 'reveal'} | {mode: 'reauth'; challengeId: string};
+/** #8's two E5 paths (spec B1b-2a §1.2): #39's restore (seed proof) and #40's "Try a different seed" (password first). */
+export type ImportSource = 'forgot' | 'retry';
+/** Where a finished unlock hands over (#7, #40): a UI-tab route, never a URL. */
+export type ReturnTo = 'created' | 'imported';
 
-/** unlock.html?mode=…; anything unknown or malformed is the plain unlock page. */
+export type PageMode =
+  | {mode: 'unlock'; returnTo: ReturnTo | null}
+  | {mode: 'welcome'}
+  | {mode: 'create'}
+  | {mode: 'import'; source: ImportSource | null}
+  | {mode: 'forgot'}
+  | {mode: 'accounts'}
+  | {mode: 'reveal'}
+  | {mode: 'reauth'; challengeId: string};
+
+const SOURCES: readonly string[] = ['forgot', 'retry'];
+const RETURNS: readonly string[] = ['created', 'imported'];
+
+/**
+ * unlock.html?mode=…; anything unknown or malformed is the plain unlock page. `source` and `return`
+ * are closed enums: an unknown value is dropped (a plain import, an unlock with no hand-over), never
+ * followed — no parameter names a URL, and none can start a destructive path by itself (§1.2).
+ */
 export function pageMode(search: string): PageMode {
   const p = new URLSearchParams(search);
   const m = p.get('mode');
-  if (m === 'welcome' || m === 'create' || m === 'import' || m === 'accounts' || m === 'reveal') return {mode: m};
+  if (m === 'welcome' || m === 'create' || m === 'forgot' || m === 'accounts' || m === 'reveal') return {mode: m};
+  if (m === 'import') {
+    const source = p.get('source') ?? '';
+    return {mode: 'import', source: SOURCES.includes(source) ? (source as ImportSource) : null};
+  }
   if (m === 'reauth') {
     const id = p.get('challenge') ?? '';
-    return /^[0-9a-f]{32}$/.test(id) ? {mode: 'reauth', challengeId: id} : {mode: 'unlock'};
+    return /^[0-9a-f]{32}$/.test(id) ? {mode: 'reauth', challengeId: id} : {mode: 'unlock', returnTo: null};
   }
-  return {mode: 'unlock'};
+  const back = p.get('return') ?? '';
+  return {mode: 'unlock', returnTo: RETURNS.includes(back) ? (back as ReturnTo) : null};
 }
```

Modify `extension/src/unlock/onboarding.ts`:

```diff
diff --git a/extension/src/unlock/onboarding.ts b/extension/src/unlock/onboarding.ts
index e73bccf..afe6c24 100644
--- a/extension/src/unlock/onboarding.ts
+++ b/extension/src/unlock/onboarding.ts
@@ -7,6 +7,7 @@ import {
 import {deriveSessionAccounts} from '../vault/accounts';
 import {registerPasskey, type CredentialsApi} from '../vault/passkey';
 import {envelopeRevision} from '../shared/envelopeRevision';
+import {storedVault} from './stored';
 import type {Send, VaultStore} from './types';
 
 /** Spec §2: at least 12 characters. Recovery is the seed phrase and nothing else. */
@@ -111,7 +112,8 @@ export async function detectImport(send: Send, mnemonic: string): Promise<Detect
 
 export type FinishOutcome = 'created' | 'created-locked' | 'exists' | 'weak-password' | 'invalid-mnemonic' | 'failed';
 
-const present = (x: unknown): boolean => x !== undefined && x !== null;
+/** Any stored v1_vault — a damaged one too — is a wallet onboarding must not write over (stored.ts). */
+const present = (x: unknown): boolean => storedVault(x).kind !== 'none';
 
 /**
  * Encrypt and store a new or imported wallet, then hand the background its signing keys. Never
@@ -151,9 +153,10 @@ export type PasskeyOutcome = 'added' | 'unsupported' | 'wrong' | 'no-wallet' | '
 type Unwrapped = {dataKey: Uint8Array; env: EnvelopeV1} | Exclude<PasskeyOutcome, 'added' | 'unsupported'>;
 
 async function openWithPassword(deps: VaultStore, factor: {password: string; kdf: Kdf}): Promise<Unwrapped> {
-  const raw = await deps.readEnvelope();
-  if (!present(raw)) return 'no-wallet';
-  const env = raw as EnvelopeV1;
+  const stored = storedVault(await deps.readEnvelope());
+  if (stored.kind === 'none') return 'no-wallet';
+  if (stored.kind === 'damaged') return 'damaged';
+  const env = stored.env;
   try {
     return {dataKey: await unlockWithPassword(env, factor.password, factor.kdf), env};
   } catch (e) {
```

Modify `extension/src/unlock/orchestrate.ts`:

```diff
diff --git a/extension/src/unlock/orchestrate.ts b/extension/src/unlock/orchestrate.ts
index 4693707..6ebb639 100644
--- a/extension/src/unlock/orchestrate.ts
+++ b/extension/src/unlock/orchestrate.ts
@@ -1,10 +1,12 @@
 import type {EnvelopeV1, Kdf} from '../vault/envelope';
+import {storedVault} from './stored';
 
 export type Factor = {password: string; kdf: Kdf} | {prfOutput: Uint8Array};
 export type Outcome = 'unlocked' | 'wrong' | 'failed' | 'damaged' | 'no-wallet';
 
 export interface AttemptUnlockDeps {
-  envelope(): Promise<EnvelopeV1 | null>;
+  /** v1_vault as stored: undefined when absent (src/unlock/stored.ts). */
+  readEnvelope(): Promise<unknown>;
   send(m: unknown): Promise<{ok: boolean; error?: string}>;
   unlockFlow(deps: {env: EnvelopeV1; send(m: unknown): Promise<{ok: boolean; error?: string}>}, factor: Factor): Promise<'unlocked' | 'wrong' | 'failed' | 'damaged'>;
 }
@@ -15,8 +17,8 @@ export interface AttemptUnlockDeps {
  *
  * Zeroes `factor.prfOutput`, when the factor is a passkey PRF output, in a `finally` that wraps
  * the ENTIRE attempt, including the envelope read. This matters because `unlockFlow` only ever
- * gets to do its own zeroing when it is actually called: a missing wallet (`envelope()` resolves
- * `null`) or a broken extension context (`envelope()` rejects — e.g. "Extension context
+ * gets to do its own zeroing when it is actually called: a missing or damaged wallet (`readEnvelope()`
+ * resolves `undefined`, or something that is not an envelope) or a broken extension context (`readEnvelope()` rejects — e.g. "Extension context
  * invalidated", which can happen if the extension reloads while a passkey prompt the person is
  * still answering is open) both return or throw before `unlockFlow` is ever reached, and without
  * this outer `finally` the caller's PRF output would never be zeroed on those paths. Zeroing here
@@ -25,9 +27,12 @@ export interface AttemptUnlockDeps {
  */
 export async function attemptUnlock(deps: AttemptUnlockDeps, factor: Factor): Promise<Outcome> {
   try {
-    const env = await deps.envelope();
-    if (!env) return 'no-wallet';
-    return await deps.unlockFlow({env, send: deps.send}, factor);
+    // Only an absent v1_vault is "no wallet"; a stored value that is not an envelope (null included)
+    // is damaged, as the background says (stored.ts, plan-1 carry).
+    const stored = storedVault(await deps.readEnvelope());
+    if (stored.kind === 'none') return 'no-wallet';
+    if (stored.kind === 'damaged') return 'damaged';
+    return await deps.unlockFlow({env: stored.env, send: deps.send}, factor);
   } catch {
     // Same rule as unlockFlow: an unexpected throw is a failed attempt, never an escaping
     // exception that would leave the page reading "Unlocking…".
@@ -93,7 +98,8 @@ export function wrongDelayMs(consecutiveWrong: number): number {
 }
 
 export interface WrongBackoff {
-  run<T extends string>(action: () => Promise<T>, onWait: () => void): Promise<T>;
+  /** `onWait(ms)` is told how long the wait will be, so a page can show its countdown (#9's cooldown card). */
+  run<T extends string>(action: () => Promise<T>, onWait: (ms: number) => void): Promise<T>;
 }
 
 /**
@@ -105,8 +111,8 @@ export interface WrongBackoff {
  * gate (and the disabled buttons) held for the whole wait. `sleep` is injected so the sequence is
  * testable without a clock.
  */
-/** Outcomes that proved the factor: unlocked, re-auth confirmed, accounts changed (even if then locked), phrase shown. */
-const PROVEN: readonly string[] = ['unlocked', 'confirmed', 'done', 'done-locked', 'done-not-locked', 'shown'];
+/** Outcomes that proved the factor: unlocked, re-auth confirmed, accounts changed (even if then locked), phrase shown, #40's factor proof. */
+const PROVEN: readonly string[] = ['unlocked', 'confirmed', 'done', 'done-locked', 'done-not-locked', 'shown', 'proven'];
 
 export function createWrongBackoff(sleep: (ms: number) => Promise<void>): WrongBackoff {
   let streak = 0;
@@ -120,7 +126,7 @@ export function createWrongBackoff(sleep: (ms: number) => Promise<void>): WrongB
       streak += 1;
       const ms = wrongDelayMs(streak);
       if (ms > 0) {
-        onWait();
+        onWait(ms);
         await sleep(ms);
       }
       return outcome;
```

Modify `extension/src/unlock/reauthFlow.ts`:

```diff
diff --git a/extension/src/unlock/reauthFlow.ts b/extension/src/unlock/reauthFlow.ts
index 7360374..d6b67cd 100644
--- a/extension/src/unlock/reauthFlow.ts
+++ b/extension/src/unlock/reauthFlow.ts
@@ -1,5 +1,5 @@
 import {reauthenticate, type ReauthFactor, type SessionKeys} from '../vault/reauth';
-import type {EnvelopeV1} from '../vault/envelope';
+import {storedVault} from './stored';
 import type {Send} from './types';
 
 export type ReauthPageOutcome = 'confirmed' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed';
@@ -39,11 +39,12 @@ export async function runReauth(
   factor: ReauthFactor,
 ): Promise<ReauthPageOutcome> {
   try {
-    const raw = await deps.readEnvelope();
-    if (raw === undefined || raw === null) return 'no-wallet';
+    const stored = storedVault(await deps.readEnvelope());
+    if (stored.kind === 'none') return 'no-wallet';
+    if (stored.kind === 'damaged') return 'damaged';
     const session = await sessionKeys(deps.send);
     if (session === null) return 'not-unlocked';
-    const outcome = await reauthenticate(raw as EnvelopeV1, factor, session);
+    const outcome = await reauthenticate(stored.env, factor, session);
     if (outcome === 'mismatch') return await lockOnMismatch(deps.send);
     if (outcome !== 'ok') return outcome;
     const r = await deps.send({type: 'vault.reauthOk', challengeId});
```

Modify `extension/src/unlock/revealFlow.ts`:

```diff
diff --git a/extension/src/unlock/revealFlow.ts b/extension/src/unlock/revealFlow.ts
index b6b5cd1..2200589 100644
--- a/extension/src/unlock/revealFlow.ts
+++ b/extension/src/unlock/revealFlow.ts
@@ -1,6 +1,6 @@
 import {openProven, type ReauthFactor} from '../vault/reauth';
-import type {EnvelopeV1} from '../vault/envelope';
 import {lockOnMismatch, sessionKeys} from './reauthFlow';
+import {storedVault} from './stored';
 import type {Send} from './types';
 
 export type RevealOutcome =
@@ -15,11 +15,12 @@ export type RevealOutcome =
  */
 export async function runReveal(deps: {readEnvelope(): Promise<unknown>; send: Send}, factor: ReauthFactor): Promise<RevealOutcome> {
   try {
-    const raw = await deps.readEnvelope();
-    if (raw === undefined || raw === null) return {outcome: 'no-wallet'};
+    const stored = storedVault(await deps.readEnvelope());
+    if (stored.kind === 'none') return {outcome: 'no-wallet'};
+    if (stored.kind === 'damaged') return {outcome: 'damaged'};
     const session = await sessionKeys(deps.send);
     if (session === null) return {outcome: 'not-unlocked'};
-    const proven = await openProven(raw as EnvelopeV1, factor, session);
+    const proven = await openProven(stored.env, factor, session);
     if (proven.outcome === 'mismatch') return {outcome: await lockOnMismatch(deps.send)};
     if (proven.outcome !== 'ok') return {outcome: proven.outcome};
     proven.dataKey.fill(0);
```

Create `extension/src/unlock/stored.ts`:

```ts
import {checkEnvelope, type EnvelopeV1} from '../vault/envelope';

/**
 * What v1_vault holds, as the vault page reads it — the same three answers the background gives
 * (accountsStore: only an ABSENT key is "no wallet"; anything else stored there that is not an
 * envelope — null, an array, a string, a malformed object — is a damaged vault, `stored-invalid`).
 * Plan 1 carried the mismatch: the page read a stored null as "no wallet" (onboarding's present(),
 * accountsFlow, revealFlow, reauthFlow, the unlock page). Every page flow now reads through this one
 * function. A damaged vault is never treated as gone: onboarding refuses to write over it ('exists'),
 * and every flow that needs the envelope stops with 'damaged'. Repairing it is #37's (B1b-2b).
 */
export type StoredVault = {kind: 'none'} | {kind: 'damaged'} | {kind: 'wallet'; env: EnvelopeV1};

export function storedVault(raw: unknown): StoredVault {
  if (raw === undefined) return {kind: 'none'};
  try {
    checkEnvelope(raw);
    return {kind: 'wallet', env: raw};
  } catch {
    return {kind: 'damaged'};
  }
}
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/accountsFlow.test.ts src/unlock/__tests__/mode.test.ts src/unlock/__tests__/orchestrate.test.ts src/unlock/__tests__/reauthFlow.test.ts src/unlock/__tests__/stored.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 82 passed (82) Tests 1045 passed (1045).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- stored null read as no wallet → RED Tests  3 failed | 6 passed (9)
- factor proof does not reset the backoff → RED Tests  1 failed | 33 passed (34)
- any import source accepted → RED Tests  1 failed | 3 passed (4)
- onWait not told the wait → RED Tests  1 failed | 33 passed (34)

- [ ] **Step 6: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/unlock/__tests__/accountsFlow.test.ts extension/src/unlock/__tests__/mode.test.ts extension/src/unlock/__tests__/orchestrate.test.ts extension/src/unlock/__tests__/reauthFlow.test.ts extension/src/unlock/__tests__/stored.test.ts extension/src/unlock/accountsFlow.ts extension/src/unlock/main.ts extension/src/unlock/mode.ts extension/src/unlock/onboarding.ts extension/src/unlock/orchestrate.ts extension/src/unlock/reauthFlow.ts extension/src/unlock/revealFlow.ts extension/src/unlock/stored.ts
git commit -m "fix(extension): the vault page reads a stored null v1_vault as damaged, as the background does; closed source/return modes; the backoff tells its wait" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 2: forgetFlow — the seed and factor proofs, the only two ways the page sends `vault.forgetWallet` (E5, page half)

**Files:**
- Create: `extension/src/unlock/__tests__/forgetFlow.test.ts`
- Create: `extension/src/unlock/forgetFlow.ts`
- Modify: `extension/src/unlock/onboarding.ts`

**Interfaces:**
- Consumes: Task 1 `storedVault`; plan 1 — `derivePublicKeys`, `deriveSessionAccounts` (`src/vault/accounts.ts`), `unwrapDataKey` (`src/vault/reauth.ts`), `createEnvelope`, `envelopeRevision`, `acceptedPhrase`, the background's `vault.forgetWallet` (E5).
- Produces:
  - `src/unlock/onboarding.ts`: `interface PreparedWallet {env: EnvelopeV1; session: SessionAccount[]}`; `prepareWallet(kdf: Kdf, input: {mnemonic; password; scheme; indexes}): Promise<PreparedWallet>`; `commitWallet(deps: VaultStore & {send: Send}, wallet: PreparedWallet): Promise<'created' | 'created-locked' | 'exists' | 'failed'>`; `finishOnboarding` unchanged in behaviour
  - `src/unlock/forgetFlow.ts`: `interface SeedProof {kind: 'seed'; env; revision; mnemonic}`; `interface FactorProof {kind: 'factor'; revision}`; `proveSeed(readEnvelope, phrase): Promise<{outcome: 'match'; proof: SeedProof} | {outcome: 'not-this-wallet' | 'invalid-mnemonic' | 'no-wallet' | 'damaged' | 'failed'}>`; `proveFactor(readEnvelope, factor: ReauthFactor): Promise<{outcome: 'proven'; proof: FactorProof} | {outcome: 'wrong' | 'no-wallet' | 'damaged' | 'failed'}>`; `type ForgetRefusal = 'send-open' | 'busy' | 'unlocked' | 'funded' | 'unreachable' | 'coordinator-refused' | 'no-wallet' | 'damaged' | 'failed'`; `restoreWallet(deps: {send; kdf}, proof: SeedProof, password: string): Promise<'restored' | 'restored-locked' | 'weak-password' | ForgetRefusal>`; `replaceEmptyWallet(deps: VaultStore & {send}, proof: FactorProof, next: PreparedWallet): Promise<'created' | 'created-locked' | 'exists' | 'store-failed' | ForgetRefusal>`

Spec §2 E5: the background cannot check a password or a seed without holding it, so the proof runs in the vault page and the message carries the revision of the envelope it ran against. `src/unlock/forgetFlow.ts` (new) has the two proofs and the two messages:
- **seed proof** (`proveSeed`, #39's restore): the phrase derives, under the **stored** scheme, every stored account's key — a different phrase, or the same phrase under the other scheme, is `not-this-wallet`, and nothing is sent (the function takes no `send`). Its only use is `restoreWallet`, whose message always carries a `replacement`: the same wallet re-encrypted under the new password with the stored scheme, every stored index and every stored name (R2-L3), in one message (no window without a wallet); then `vault.setKeys`.
- **factor proof** (`proveFactor`, #40's "Try a different seed", D41): the password (or passkey) unwraps the stored data key — the `openWithPassword` shape, no session (R2-L7); the key and any PRF output are zeroed at once. Its only use is `replaceEmptyWallet`, whose message **always** carries `guard: 'unfunded'` (C6) — the plan-1 carry: the background cannot enforce "a factor-proven delete only with the guard" (#37's delete in B1b-2b has none), so this module does. Then the new wallet, already encrypted, is stored at once as a first write; a failed store after the delete is `store-failed`, and the page retries the store alone (`commitWallet`, never a second delete).

A proof is an object only `proveSeed`/`proveFactor` can mint (a `WeakSet` records each): a value that merely looks like one sends nothing. A source test holds every other `src/unlock` file to never naming `vault.forgetWallet`. `finishOnboarding` is split into `prepareWallet` (derive + encrypt, the seconds of Argon2id) and `commitWallet` (the first write, then the keys) so #40's path can encrypt B before deleting A. The tests run against the REAL background (`handleMessage`): "nothing changed" is checked on the stored bytes.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/unlock/__tests__/forgetFlow.test.ts`:

```ts
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {join, relative, sep} from 'node:path';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import {createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1, type Kdf} from '../../vault/envelope';
import {derivePublicKeys} from '../../vault/accounts';
import {envelopeRevision} from '../../shared/envelopeRevision';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {getSession} from '../../background/session';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {proveFactor, proveSeed, replaceEmptyWallet, restoreWallet, type FactorProof, type SeedProof} from '../forgetFlow';
import {commitWallet, prepareWallet} from '../onboarding';
import {backgroundVaultStore} from '../vaultStore';
import type {Send} from '../types';

// Spec B1b-2a E5, the vault page's half: the two proofs, and the only two ways this page may send
// vault.forgetWallet. Run against the REAL background (handleMessage over an in-memory storage), so
// "nothing changed" is checked on the stored bytes, not on a mock's word.
const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const OLD_PW = 'correct horse battery';
const NEW_PW = 'a brand new long password';
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const UNLOCK = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};
const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

async function storedWallet(mnemonic: string, scheme: 'slip10' | 'cli', indexes: number[], names = indexes.map(i => `Account ${i + 1}`)): Promise<EnvelopeV1> {
  const keys = await derivePublicKeys(mnemonic, scheme, indexes);
  return createEnvelope({mnemonic, password: OLD_PW, scheme, accounts: indexes.map((index, i) => ({index, name: names[i] ?? '', publicKey: keys[i] ?? ''})), kdf});
}

/** The real background with `env` stored; `sent` records every message the page sends it. */
async function background(env: EnvelopeV1 | undefined, balances: (owner: string) => bigint = () => 0n) {
  const ext = fakeExt();
  if (env !== undefined) await ext.local.set(VAULT_KEY, env);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
  const deps = fakeDeps({reader: fakeReader({getBalance: async owner => balances(owner), getTokenAccountsByOwner: async () => []})});
  const sent: {type: string; [k: string]: unknown}[] = [];
  const send: Send = async m => {
    sent.push(m as {type: string});
    return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK, deps)) as {ok: boolean; error?: string; data?: unknown};
  };
  const read = () => ext.local.get(VAULT_KEY);
  return {ext, send, sent, read, store: backgroundVaultStore(send, read)};
}

describe('the seed proof (#39 → #8 restore)', () => {
  it('accepts the stored wallet’s phrase — slip10 with several accounts, and cli — sending nothing', async () => {
    const slip = await background(await storedWallet(M, 'slip10', [0, 1, 3]));
    expect((await proveSeed(slip.read, M)).outcome).toBe('match');
    const cli = await background(await storedWallet(M, 'cli', [0]));
    // Untidy input normalises the way import does.
    expect((await proveSeed(cli.read, `  ${M.toUpperCase()} `)).outcome).toBe('match');
    expect([...slip.sent, ...cli.sent]).toEqual([]);
  });

  it('refuses a different valid phrase, and the same phrase under the other scheme', async () => {
    const b = await background(await storedWallet(M, 'slip10', [0]));
    expect(await proveSeed(b.read, OTHER)).toEqual({outcome: 'not-this-wallet'});
    // A stored cli wallet whose key is M's SLIP-0010 key: derived under the stored scheme, M does not match.
    const env = await storedWallet(M, 'slip10', [0]);
    const crossed = await background({...env, scheme: 'cli'});
    expect(await proveSeed(crossed.read, M)).toEqual({outcome: 'not-this-wallet'});
    expect([...b.sent, ...crossed.sent]).toEqual([]);
  });

  it('no wallet, a damaged one, and a phrase import refuses are named as such', async () => {
    expect(await proveSeed(async () => undefined, M)).toEqual({outcome: 'no-wallet'});
    expect(await proveSeed(async () => null, M)).toEqual({outcome: 'damaged'});
    const b = await background(await storedWallet(M, 'slip10', [0]));
    expect(await proveSeed(b.read, 'abandon abandon')).toEqual({outcome: 'invalid-mnemonic'});
  });
});

describe('restoreWallet: the seed-proven replacement (E5 with `replacement`, D40)', () => {
  it('re-encrypts the same wallet under the new password with every stored index and name, keeps known recipients, and unlocks it', async () => {
    const env = await storedWallet(M, 'slip10', [0, 2], ['Main', 'Rainy day']);
    const b = await background(env);
    const proven = await proveSeed(b.read, M);
    if (proven.outcome !== 'match') throw new Error(proven.outcome);
    expect(await restoreWallet({send: b.send, kdf}, proven.proof, NEW_PW)).toBe('restored');

    const forget = b.sent.find(m => m.type === 'vault.forgetWallet') as unknown as {expectedRevision: string; replacement: EnvelopeV1; guard?: unknown};
    expect(forget.expectedRevision).toBe(envelopeRevision(env));
    expect(forget.guard).toBeUndefined();
    expect(forget.replacement.scheme).toBe('slip10');
    expect(forget.replacement.accounts).toEqual(env.accounts);
    const after = (await b.read()) as EnvelopeV1;
    expect(after.accounts.map(a => a.name)).toEqual(['Main', 'Rainy day']);
    expect(await decryptMnemonic(after, await unlockWithPassword(after, NEW_PW, kdf))).toBe(M);
    await expect(unlockWithPassword(after, OLD_PW, kdf)).rejects.toThrow();
    expect((await getSession(b.ext))?.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
    expect(await b.ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1}]);
  });

  it('a proof the page did not mint, and a short password, send nothing', async () => {
    const env = await storedWallet(M, 'slip10', [0]);
    const b = await background(env);
    const forged: SeedProof = {kind: 'seed', env, revision: envelopeRevision(env), mnemonic: OTHER};
    expect(await restoreWallet({send: b.send, kdf}, forged, NEW_PW)).toBe('failed');
    const proven = await proveSeed(b.read, M);
    if (proven.outcome !== 'match') throw new Error(proven.outcome);
    expect(await restoreWallet({send: b.send, kdf}, proven.proof, 'short')).toBe('weak-password');
    expect(b.sent).toEqual([]);
    expect(await b.read()).toEqual(env);
  });

  it('a wallet that moved after the proof is busy, and nothing is written', async () => {
    const env = await storedWallet(M, 'slip10', [0]);
    const b = await background(env);
    const proven = await proveSeed(b.read, M);
    if (proven.outcome !== 'match') throw new Error(proven.outcome);
    const moved = {...env, seed: {...env.seed, iv: 'AAAAAAAAAAAAAAAA'}};
    await b.ext.local.set(VAULT_KEY, moved);
    expect(await restoreWallet({send: b.send, kdf}, proven.proof, NEW_PW)).toBe('busy');
    expect(await b.read()).toEqual(moved);
    expect(b.sent.map(m => m.type)).toEqual(['vault.forgetWallet']);
  });

  it.each([
    ['send-open', 'send-open'],
    ['unlocked', 'unlocked'],
    ['stored-invalid', 'damaged'],
    ['malformed', 'failed'],
    ['something new', 'failed'],
  ])("the background's %s is the page's %s", async (error, outcome) => {
    const env = await storedWallet(M, 'slip10', [0]);
    const b = await background(env);
    const proven = await proveSeed(b.read, M);
    if (proven.outcome !== 'match') throw new Error(proven.outcome);
    const refusing: Send = async m => ((m as {type: string}).type === 'vault.forgetWallet' ? {ok: false, error} : {ok: true});
    expect(await restoreWallet({send: refusing, kdf}, proven.proof, NEW_PW)).toBe(outcome);
  });
});

describe('the factor proof (#40 → #8 retry: the password of the wallet being replaced)', () => {
  it('proves the right password with no session and sends nothing; refuses a wrong one', async () => {
    const b = await background(await storedWallet(M, 'slip10', [0]));
    expect((await proveFactor(b.read, {password: OLD_PW, kdf})).outcome).toBe('proven');
    expect(await proveFactor(b.read, {password: 'not the password at all', kdf})).toEqual({outcome: 'wrong'});
    expect(b.sent).toEqual([]);
    expect(await getSession(b.ext)).toBeNull();
  });

  it('zeroes a passkey PRF output on every path', async () => {
    const prfOutput = new Uint8Array(32).fill(5);
    expect(await proveFactor(async () => undefined, {prfOutput})).toEqual({outcome: 'no-wallet'});
    expect(prfOutput.every(b => b === 0)).toBe(true);
  });
});

describe('replaceEmptyWallet: the factor-proven delete is ALWAYS guarded (C6), then a first write (D41)', () => {
  it('sends guard "unfunded" with the proven revision, removes the old wallet and stores the new one', async () => {
    const old = await storedWallet(M, 'slip10', [0]);
    const b = await background(old);
    const proven = await proveFactor(b.read, {password: OLD_PW, kdf});
    if (proven.outcome !== 'proven') throw new Error(proven.outcome);
    const next = await prepareWallet(kdf, {mnemonic: OTHER, password: NEW_PW, scheme: 'slip10', indexes: [0]});
    expect(await replaceEmptyWallet({...b.store, send: b.send}, proven.proof, next)).toBe('created');
    expect(b.sent.find(m => m.type === 'vault.forgetWallet')).toEqual({type: 'vault.forgetWallet', expectedRevision: envelopeRevision(old), guard: 'unfunded'});
    expect(((await b.read()) as EnvelopeV1).accounts.map(a => a.publicKey)).toEqual(next.env.accounts.map(a => a.publicKey));
    // A delete wipes the old wallet's recipients (D40).
    expect(await b.ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
  });

  it('funds that arrived meanwhile refuse it in the background, and the stored envelope is byte-identical', async () => {
    const old = await storedWallet(M, 'slip10', [0]);
    const b = await background(old, () => 1n);
    const proven = await proveFactor(b.read, {password: OLD_PW, kdf});
    if (proven.outcome !== 'proven') throw new Error(proven.outcome);
    const next = await prepareWallet(kdf, {mnemonic: OTHER, password: NEW_PW, scheme: 'slip10', indexes: [0]});
    expect(await replaceEmptyWallet({...b.store, send: b.send}, proven.proof, next)).toBe('funded');
    expect(JSON.stringify(await b.read())).toBe(JSON.stringify(old));
    expect(b.sent.map(m => m.type)).toEqual(['vault.forgetWallet']);
  });

  it('a proof the page did not mint sends nothing', async () => {
    const old = await storedWallet(M, 'slip10', [0]);
    const b = await background(old);
    const forged: FactorProof = {kind: 'factor', revision: envelopeRevision(old)};
    const next = await prepareWallet(kdf, {mnemonic: OTHER, password: NEW_PW, scheme: 'slip10', indexes: [0]});
    expect(await replaceEmptyWallet({...b.store, send: b.send}, forged, next)).toBe('failed');
    expect(b.sent).toEqual([]);
    expect(await b.read()).toEqual(old);
  });

  it('a failed store after the delete is store-failed; the retry is the store alone, and wallet-exists stops it (R2-L6)', async () => {
    const old = await storedWallet(M, 'slip10', [0]);
    const b = await background(old);
    const proven = await proveFactor(b.read, {password: OLD_PW, kdf});
    if (proven.outcome !== 'proven') throw new Error(proven.outcome);
    const next = await prepareWallet(kdf, {mnemonic: OTHER, password: NEW_PW, scheme: 'slip10', indexes: [0]});
    let failStore = true;
    const flaky: Send = async m => {
      if ((m as {type: string}).type === 'vault.storeEnvelope' && failStore) throw new Error('worker restarted');
      return b.send(m);
    };
    const store = backgroundVaultStore(flaky, b.read);
    expect(await replaceEmptyWallet({...store, send: flaky}, proven.proof, next)).toBe('store-failed');
    expect(await b.read()).toBeUndefined();
    // Another tab creates a wallet; [Try again] is commitWallet alone: 'exists', no second delete.
    const third = await storedWallet(OTHER, 'cli', [0]);
    await b.ext.local.set(VAULT_KEY, third);
    failStore = false;
    expect(await commitWallet({...store, send: flaky}, next)).toBe('exists');
    expect(b.sent.filter(m => m.type === 'vault.forgetWallet')).toHaveLength(1);
    expect(await b.read()).toEqual(third);
  });
});

// Only forgetFlow.ts may build vault.forgetWallet: every other vault-page file is held to it, so a
// screen cannot send an unguarded factor-proven delete by writing the message itself.
describe('the message is built in one place', () => {
  it('no src/unlock source file but forgetFlow.ts names vault.forgetWallet', () => {
    const root = join(__dirname, '..');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) {
          if (e !== '__tests__') walk(p);
        } else if (/\.tsx?$/.test(e)) files.push(relative(root, p).split(sep).join('/'));
      }
    };
    walk(root);
    expect(files).toContain('forgetFlow.ts');
    expect(files.filter(f => readFileSync(join(root, f), 'utf8').includes('vault.forgetWallet'))).toEqual(['forgetFlow.ts']);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/forgetFlow.test.ts`
Expected (dry run): FAIL — Test Files 1 failed (1) Tests no tests (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Create `extension/src/unlock/forgetFlow.ts`:

```ts
import {normalizeMnemonicInput} from '../../../core/keys/mnemonic';
import {derivePublicKeys, deriveSessionAccounts} from '../vault/accounts';
import {CorruptEnvelope, UnsafeKdfParams, WrongPasskey, WrongPassword, createEnvelope, type EnvelopeV1, type Kdf} from '../vault/envelope';
import {unwrapDataKey, type ReauthFactor} from '../vault/reauth';
import {envelopeRevision} from '../shared/envelopeRevision';
import {MIN_PASSWORD_LENGTH, acceptedPhrase, commitWallet, type PreparedWallet} from './onboarding';
import {storedVault} from './stored';
import type {Send, VaultStore} from './types';

/**
 * The vault page's half of vault.forgetWallet (spec B1b-2a E5). The background cannot check a
 * password or a seed without holding them, so the proof runs here, in the one page allowed to hold
 * them, and the message carries the revision of the envelope the proof ran against.
 *
 * Two proofs, two messages, and nothing else may send vault.forgetWallet (a source test holds every
 * other src/unlock file to that):
 *  - SEED proof (#39's restore): the phrase derives, under the STORED scheme, every stored account's
 *    key. Its only use is restoreWallet, whose message always carries a `replacement` — the same wallet
 *    re-encrypted under a new password (the background binds it, C4).
 *  - FACTOR proof (#40's "Try a different seed", D41): the password (or passkey) unwraps the stored
 *    data key; no session is needed. Its only use is replaceEmptyWallet, whose message ALWAYS carries
 *    `guard: 'unfunded'`. The background cannot enforce "a factor-proven delete only with the guard"
 *    — #37's delete (B1b-2b) has none — so this module does (plan-1 carry).
 * A proof is an object only proveSeed/proveFactor can mint (a WeakSet records each one): a value
 * that merely looks like a proof sends nothing.
 */
const minted = new WeakSet<object>();

export interface SeedProof {
  readonly kind: 'seed';
  readonly env: EnvelopeV1;
  readonly revision: string;
  /** The phrase as proven, normalised: the replacement encrypts exactly this. */
  readonly mnemonic: string;
}
export interface FactorProof {
  readonly kind: 'factor';
  readonly revision: string;
}

export type SeedProofResult = {outcome: 'match'; proof: SeedProof} | {outcome: 'not-this-wallet' | 'invalid-mnemonic' | 'no-wallet' | 'damaged' | 'failed'};

/** #8 with `source=forgot`: is this phrase the stored wallet's? Local only; nothing is sent. */
export async function proveSeed(readEnvelope: () => Promise<unknown>, phrase: string): Promise<SeedProofResult> {
  try {
    const stored = storedVault(await readEnvelope());
    if (stored.kind === 'none') return {outcome: 'no-wallet'};
    if (stored.kind === 'damaged') return {outcome: 'damaged'};
    if (!acceptedPhrase(phrase)) return {outcome: 'invalid-mnemonic'};
    const {env} = stored;
    const mnemonic = normalizeMnemonicInput(phrase);
    // Under the stored scheme only: the same phrase under the other scheme is another wallet.
    const keys = await derivePublicKeys(mnemonic, env.scheme, env.accounts.map(a => a.index));
    const same = keys.length === env.accounts.length && keys.every((k, i) => k === env.accounts[i]?.publicKey);
    if (!same) return {outcome: 'not-this-wallet'};
    const proof: SeedProof = Object.freeze({kind: 'seed', env, revision: envelopeRevision(env), mnemonic});
    minted.add(proof);
    return {outcome: 'match', proof};
  } catch {
    return {outcome: 'failed'};
  }
}

export type FactorProofResult = {outcome: 'proven'; proof: FactorProof} | {outcome: 'wrong' | 'no-wallet' | 'damaged' | 'failed'};

/**
 * #8 with `source=retry`: the password (or passkey) of the wallet being replaced unwraps its data key
 * — the openWithPassword shape, no session comparison, so it works on a locked wallet. The data key is
 * zeroed at once and nothing else is derived (review R2-L7); a PRF output is zeroed on every path.
 */
export async function proveFactor(readEnvelope: () => Promise<unknown>, factor: ReauthFactor): Promise<FactorProofResult> {
  try {
    const stored = storedVault(await readEnvelope());
    if (stored.kind === 'none') return {outcome: 'no-wallet'};
    if (stored.kind === 'damaged') return {outcome: 'damaged'};
    let key: Uint8Array;
    try {
      key = await unwrapDataKey(stored.env, factor);
    } catch (e) {
      if (e instanceof WrongPassword || e instanceof WrongPasskey) return {outcome: 'wrong'};
      if (e instanceof CorruptEnvelope || e instanceof UnsafeKdfParams) return {outcome: 'damaged'};
      return {outcome: 'failed'};
    }
    key.fill(0);
    const proof: FactorProof = Object.freeze({kind: 'factor', revision: envelopeRevision(stored.env)});
    minted.add(proof);
    return {outcome: 'proven', proof};
  } catch {
    return {outcome: 'failed'};
  } finally {
    if ('prfOutput' in factor) factor.prfOutput.fill(0);
  }
}

/** vault.forgetWallet's refusals as the page names them (the background's `stored-invalid` is `damaged`). */
export type ForgetRefusal = 'send-open' | 'busy' | 'unlocked' | 'funded' | 'unreachable' | 'coordinator-refused' | 'no-wallet' | 'damaged' | 'failed';
const NAMED: readonly string[] = ['send-open', 'busy', 'unlocked', 'funded', 'unreachable', 'coordinator-refused', 'no-wallet'];

async function forget(send: Send, message: {type: 'vault.forgetWallet'; expectedRevision: string; replacement?: EnvelopeV1; guard?: 'unfunded'}): Promise<'forgotten' | ForgetRefusal> {
  try {
    const r = await send(message);
    if (r.ok) return 'forgotten';
    if (r.error === 'stored-invalid') return 'damaged';
    return NAMED.find(n => n === r.error) as ForgetRefusal | undefined ?? 'failed';
  } catch {
    return 'failed';
  }
}

export type RestoreOutcome = 'restored' | 'restored-locked' | 'weak-password' | ForgetRefusal;

/**
 * #39's restore (D35): the seed-proven wallet, re-encrypted under a new password with the stored
 * scheme, every stored account index and every stored name, replaces the stored envelope in ONE
 * message (vault.forgetWallet with `replacement`: no window without a wallet). Then the keys.
 * Known recipients and settings are kept by the background (D40): the same wallet is proven.
 */
export async function restoreWallet(deps: {send: Send; kdf: Kdf}, proof: SeedProof, password: string): Promise<RestoreOutcome> {
  if (!minted.has(proof) || proof.kind !== 'seed') return 'failed';
  if (password.length < MIN_PASSWORD_LENGTH) return 'weak-password';
  const {env, mnemonic} = proof;
  let replacement: EnvelopeV1;
  try {
    replacement = await createEnvelope({mnemonic, password, scheme: env.scheme, accounts: env.accounts.map(a => ({index: a.index, name: a.name, publicKey: a.publicKey})), kdf: deps.kdf});
  } catch {
    return 'failed';
  }
  const r = await forget(deps.send, {type: 'vault.forgetWallet', expectedRevision: proof.revision, replacement});
  if (r !== 'forgotten') return r;
  try {
    const session = await deriveSessionAccounts(mnemonic, env.scheme, env.accounts.map(a => a.index));
    const set = await deps.send({type: 'vault.setKeys', accounts: session});
    return set.ok ? 'restored' : 'restored-locked';
  } catch {
    return 'restored-locked';
  }
}

export type ReplaceOutcome = 'created' | 'created-locked' | 'exists' | 'store-failed' | ForgetRefusal;

/**
 * #40's "Try a different seed" (D41, §11.13): a different seed is a different wallet, so C4 forbids it
 * as a replacement. The factor-proven wallet is deleted — always under the background's unfunded guard
 * (C6), which re-reads every account's balances at the moment of deletion — and the new wallet,
 * already encrypted (`next`), is stored at once as a first write. The two writes are not atomic: when
 * the store fails after the delete the answer is 'store-failed', and the page offers [Try again], which
 * runs commitWallet alone (never a second delete).
 */
export async function replaceEmptyWallet(deps: VaultStore & {send: Send}, proof: FactorProof, next: PreparedWallet): Promise<ReplaceOutcome> {
  if (!minted.has(proof) || proof.kind !== 'factor') return 'failed';
  const r = await forget(deps.send, {type: 'vault.forgetWallet', expectedRevision: proof.revision, guard: 'unfunded'});
  if (r !== 'forgotten') return r;
  const stored = await commitWallet(deps, next);
  return stored === 'failed' ? 'store-failed' : stored;
}
```

Modify `extension/src/unlock/onboarding.ts`:

```diff
diff --git a/extension/src/unlock/onboarding.ts b/extension/src/unlock/onboarding.ts
index afe6c24..958ad38 100644
--- a/extension/src/unlock/onboarding.ts
+++ b/extension/src/unlock/onboarding.ts
@@ -4,7 +4,7 @@ import {deriveTransparentKeypair} from '../../../core/keys/transparent';
 import {
   CorruptEnvelope, UnsafeKdfParams, WrongPassword, addPasskeyWrap, createEnvelope, unlockWithPassword, type EnvelopeV1, type Kdf,
 } from '../vault/envelope';
-import {deriveSessionAccounts} from '../vault/accounts';
+import {deriveSessionAccounts, type SessionAccount} from '../vault/accounts';
 import {registerPasskey, type CredentialsApi} from '../vault/passkey';
 import {envelopeRevision} from '../shared/envelopeRevision';
 import {storedVault} from './stored';
@@ -115,6 +115,46 @@ export type FinishOutcome = 'created' | 'created-locked' | 'exists' | 'weak-pass
 /** Any stored v1_vault — a damaged one too — is a wallet onboarding must not write over (stored.ts). */
 const present = (x: unknown): boolean => storedVault(x).kind !== 'none';
 
+/**
+ * A new or imported wallet, encrypted and ready to store: the envelope and the signing keys to hand
+ * the background once it is stored. Built before any vault write, so #40's "Try a different seed"
+ * (D41) can delete the old wallet and store this one at once, and retry the store alone (E5).
+ */
+export interface PreparedWallet {
+  env: EnvelopeV1;
+  session: SessionAccount[];
+}
+
+/** Derive and encrypt; the Argon2id run (seconds) happens here. The phrase is stored normalised. */
+export async function prepareWallet(kdf: Kdf, input: {mnemonic: string; password: string; scheme: 'slip10' | 'cli'; indexes: number[]}): Promise<PreparedWallet> {
+  const mnemonic = normalizeMnemonicInput(input.mnemonic);
+  const session = await deriveSessionAccounts(mnemonic, input.scheme, input.indexes);
+  const accounts = session.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}));
+  const env = await createEnvelope({mnemonic, password: input.password, scheme: input.scheme, accounts, kdf});
+  return {env, session};
+}
+
+/**
+ * The first write (expectedRevision null: the background stores it only while no wallet is stored),
+ * then the keys. 'exists' when a wallet landed first; 'created-locked' when the store held but the
+ * keys did not reach the background.
+ */
+export async function commitWallet(deps: VaultStore & {send: Send}, wallet: PreparedWallet): Promise<Exclude<FinishOutcome, 'weak-password' | 'invalid-mnemonic'>> {
+  try {
+    const stored = await deps.storeEnvelope(null, wallet.env);
+    if (stored === 'wallet-exists') return 'exists';
+    if (stored !== 'stored') return 'failed';
+  } catch {
+    return 'failed';
+  }
+  try {
+    const r = await deps.send({type: 'vault.setKeys', accounts: wallet.session});
+    return r.ok ? 'created' : 'created-locked';
+  } catch {
+    return 'created-locked';
+  }
+}
+
 /**
  * Encrypt and store a new or imported wallet, then hand the background its signing keys. Never
  * overwrites a stored vault: checked here before the seconds-long Argon2id run, and enforced by
@@ -130,19 +170,7 @@ export async function finishOnboarding(
   if (!acceptedPhrase(input.mnemonic)) return 'invalid-mnemonic';
   try {
     if (present(await deps.readEnvelope())) return 'exists';
-    const mnemonic = normalizeMnemonicInput(input.mnemonic);
-    const session = await deriveSessionAccounts(mnemonic, input.scheme, input.indexes);
-    const accounts = session.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}));
-    const env = await createEnvelope({mnemonic, password: input.password, scheme: input.scheme, accounts, kdf: deps.kdf});
-    const stored = await deps.storeEnvelope(null, env);
-    if (stored === 'wallet-exists') return 'exists';
-    if (stored !== 'stored') return 'failed';
-    try {
-      const r = await deps.send({type: 'vault.setKeys', accounts: session});
-      return r.ok ? 'created' : 'created-locked';
-    } catch {
-      return 'created-locked';
-    }
+    return await commitWallet(deps, await prepareWallet(deps.kdf, input));
   } catch {
     return 'failed';
   }
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/forgetFlow.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 83 passed (83) Tests 1063 passed (1063).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- delete without the guard → RED Tests  2 failed | 16 passed (18)
- a forged factor proof accepted → RED Tests  1 failed | 17 passed (18)
- the seed proof derives under slip10 whatever is stored → RED Tests  2 failed | 16 passed (18)
- the replacement drops the stored names → RED Tests  1 failed | 17 passed (18)

- [ ] **Step 6: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/unlock/__tests__/forgetFlow.test.ts extension/src/unlock/forgetFlow.ts extension/src/unlock/onboarding.ts
git commit -m "feat(extension): forgetFlow — the seed-proven restore and the factor-proven, always-guarded delete (E5 page half)" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 3: The #10 renderer: `vault.challengeInfo` re-validated against a closed alphabet; `unknown-challenge` → `expired` (E3, D39)

**Files:**
- Create: `extension/src/unlock/__tests__/challenge.test.ts`
- Modify: `extension/src/unlock/__tests__/reauthFlow.test.ts`
- Create: `extension/src/unlock/challenge.ts`
- Modify: `extension/src/unlock/modes.ts`
- Modify: `extension/src/unlock/reauthFlow.ts`
- Create: `extension/src/unlock/strings.ts`

**Interfaces:**
- Consumes: Task 1; plan 1 — `formatAmount` (`src/shared/amount.ts`), the background's `vault.challengeInfo` (E3) and `wallet.discardPrepared` (E7), `runReauth`.
- Produces:
  - `src/unlock/strings.ts`: `COMMON` (damaged, damagedHelp, noWallet, exists, wrongConfirm, waitConfirm, mismatchLocked, failedTryAgain, unreadable, passkeyUnavailableConfirm), `clockText(seconds)`, `cooldownLabel(seconds)`, `REAUTH` (#10's lines, `feeReason`, `reason`, `overUsd(dollars)`, `autoLock(minutes)`, `threshold(dollars)`)
  - `src/unlock/challenge.ts`: `type TokenSymbol`; `interface FeeLine {label: string; value: string | null}`; `interface SendDescription {kind: 'send'; account; amount; symbol; recipient; fees: FeeLine[]; reasons: string[]}`; `interface SettingsDescription {kind: 'settings'; lines: string[]}`; `type Description`; `describeChallenge(about: unknown): Description | null`; `type ChallengeRead = {state: 'described'; description} | {state: 'undescribable'; account: string | null} | {state: 'expired' | 'not-unlocked'}`; `readChallenge(send, challengeId): Promise<ChallengeRead>`; `discardPrepared(send, account): Promise<boolean>`
  - `src/unlock/reauthFlow.ts`: `ReauthPageOutcome` gains `'expired'`

Plan-1 carry 1. Spec §2 E3: the vault page takes the challenge id from its URL and the description **only** from the background, and renders nothing untrusted. `src/unlock/challenge.ts` (new) re-validates every field before any text is built: the token in this page's own four-entry table (looked up as an own property — `constructor` is not a token), amounts `^\d{1,20}$`, account and recipient the base58 alphabet at 32–44 characters, each reason and fee reason one of its codes mapped to a fixed string, `thresholdCents` an integer in 100–100 000, and exactly the record's keys. Anything else is `null` → #10's "could not be shown" (Task 11). The amount is shown **exactly** (every base unit: a confirmation never rounds); a zero Noctura fee shows its reason line (the carried rule); `charged` with a zero fee does not describe one action and fails closed (see Scope 4 for the fee rows). A settings challenge (used from B1b-2b) is described too, and one that changes nothing is not.

`readChallenge` maps the replies: `unknown-challenge` → `expired`, `locked` → `not-unlocked`, everything else (a reply it cannot describe, an unnamed refusal, a thrown message) → `undescribable`, which carries the send's `account` when that one field is an address **by itself** (else `null`) — so #10's `[Cancel send]` can still discard a send it cannot describe, and never claims a cancel it did not make (plan-2 review H1, Task 11). `discardPrepared` sends E7 for an address only. `runReauth` now answers `expired` when `vault.reauthOk` says `unknown-challenge` (D39: never `failed`) and `not-unlocked` for `locked`. `src/unlock/strings.ts` starts here, stand-alone (plan 1's gate), with the shared lines and #10's.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/unlock/__tests__/challenge.test.ts`:

```ts
import {CHALLENGE_TTL_MS, issueChallenge, type ChallengeAbout} from '../../background/reauthChallenges';
import {handleMessage} from '../../background/messages';
import {clearSession} from '../../background/session';
import {fakeDeps} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import {ACCOUNT, RECIPIENT, unlocked} from '../../background/__tests__/fixtures';
import {describeChallenge, discardPrepared, readChallenge} from '../challenge';
import type {Send} from '../types';

// Spec B1b-2a E3, the vault page's half (plan-1 carry): #10 renders `about` only after re-validating
// every field against a closed alphabet; anything else is "could not be shown".
const SEND: ChallengeAbout = {
  kind: 'send',
  account: ACCOUNT.publicKey,
  token: 'SOL',
  recipient: RECIPIENT,
  amount: '2480000000',
  networkLamports: '5050',
  markupLamports: '0',
  markupReason: 'status-unknown',
  rentLamports: '0',
  reasons: ['first-send', 'over-usd-threshold'],
  thresholdCents: 10_000,
};

describe('describeChallenge: the closed-alphabet renderer', () => {
  it('describes a send from fixed strings and validated values only (positive control)', () => {
    expect(describeChallenge(SEND)).toEqual({
      kind: 'send',
      account: ACCOUNT.publicKey,
      amount: '2.4800',
      symbol: 'SOL',
      recipient: RECIPIENT,
      fees: [
        {label: 'Network fee', value: '0.00000505 SOL'},
        {label: 'No Noctura fee (status unknown)', value: null},
      ],
      reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required for transactions over $100.'],
    });
  });

  it('shows every base unit of the amount — a confirmation never rounds — and each non-zero fee on its own line', () => {
    const d = describeChallenge({...SEND, token: 'USDC', amount: '12345678', markupLamports: '20000', markupReason: 'charged', rentLamports: '2039280', reasons: ['over-5-percent', 'whole-balance-to-new'], thresholdCents: 12_550});
    expect(d).toMatchObject({
      amount: '12.345678',
      symbol: 'USDC',
      fees: [
        {label: 'Network fee', value: '0.00000505 SOL'},
        {label: 'Noctura fee', value: '0.00002 SOL'},
        {label: 'New token account', value: '0.00203928 SOL'},
      ],
      reasons: ['Re-auth required for transactions over 5 % of balance.', 'Re-auth required to send your whole balance to a new address.'],
    });
    expect(describeChallenge({...SEND, reasons: ['over-usd-threshold'], thresholdCents: 12_550})).toMatchObject({reasons: ['Re-auth required for transactions over $125.50.']});
    expect(describeChallenge({...SEND, markupReason: 'pre-tge'})).toMatchObject({fees: [{label: 'Network fee'}, {label: 'No Noctura fee before TGE', value: null}]});
  });

  // Each field outside its alphabet → null → #10's "could not be shown" with only Cancel.
  it.each<[string, Record<string, unknown>]>([
    ['an unknown token', {token: 'BONK'}],
    ['a token named by an inherited key', {token: 'constructor'}],
    ['an amount with a decimal point', {amount: '2.48'}],
    ['an amount of 21 digits', {amount: '1'.repeat(21)}],
    ['a negative fee', {networkLamports: '-5'}],
    ['a recipient with markup', {recipient: '<img src=x onerror=alert(1)>'}],
    ['a recipient with a 0 (outside base58)', {recipient: `0${RECIPIENT.slice(1)}`}],
    ['a short account', {account: 'abc'}],
    ['an unknown reason', {reasons: ['because']}],
    ['reasons that are not a list', {reasons: 'first-send'}],
    ['a threshold below $1', {thresholdCents: 99}],
    ['a threshold above $1 000', {thresholdCents: 100_001}],
    ['a fractional threshold', {thresholdCents: 100.5}],
    ['an unknown fee reason', {markupReason: 'free'}],
    ['a fee charged with no fee', {markupReason: 'charged'}],
    ['a fee with a reason that is not "charged"', {markupLamports: '20000', markupReason: 'pre-tge'}],
    ['an extra field', {memo: 'hi'}],
  ])('%s is not described', (_name, change) => {
    expect(describeChallenge({...SEND, ...change})).toBeNull();
  });

  it('a missing field, another kind, and a non-object are not described', () => {
    const {thresholdCents: _drop, ...missing} = SEND;
    expect(describeChallenge(missing)).toBeNull();
    expect(describeChallenge({...SEND, kind: 'sign'})).toBeNull();
    for (const x of [null, undefined, 'send', 7, [SEND]]) expect(describeChallenge(x)).toBeNull();
  });

  it('describes a settings change (used from B1b-2b), and refuses one that changes nothing or is out of range', () => {
    expect(describeChallenge({kind: 'settings', autoLockMinutes: 15, reauthUsdCents: 50_000})).toEqual({kind: 'settings', lines: ['Auto-lock → 15 minutes', 'Re-authentication threshold → $500']});
    expect(describeChallenge({kind: 'settings', autoLockMinutes: 1, reauthUsdCents: null})).toEqual({kind: 'settings', lines: ['Auto-lock → 1 minute']});
    expect(describeChallenge({kind: 'settings', autoLockMinutes: null, reauthUsdCents: null})).toBeNull();
    expect(describeChallenge({kind: 'settings', autoLockMinutes: 61, reauthUsdCents: null})).toBeNull();
    expect(describeChallenge({kind: 'settings', autoLockMinutes: 5, reauthUsdCents: null, extra: 1})).toBeNull();
  });
});

const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
const UNLOCK = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};

async function background() {
  const ext = fakeExt();
  await unlocked(ext);
  const deps = fakeDeps();
  const send: Send = async m => (await handleMessage(ext, m, UNLOCK, deps)) as {ok: boolean; error?: string; data?: unknown};
  return {ext, deps, send};
}

describe('readChallenge against the real background', () => {
  it('a live challenge is described; an expired one is "expired"; while locked, "not-unlocked"', async () => {
    const {ext, deps, send} = await background();
    const id = await issueChallenge(ext, deps, 'digest', SEND);
    expect(await readChallenge(send, id)).toEqual({state: 'described', description: describeChallenge(SEND)});
    deps.clock.t += CHALLENGE_TTL_MS + 1;
    expect(await readChallenge(send, id)).toEqual({state: 'expired'});
    await clearSession(ext);
    expect(await readChallenge(send, id)).toEqual({state: 'not-unlocked'});
  });

  it('a reply it cannot describe, and a thrown message, are "undescribable"', async () => {
    expect(await readChallenge(async () => ({ok: true, data: {...SEND, token: 'BONK'}}), 'ab'.repeat(16))).toEqual({state: 'undescribable', account: ACCOUNT.publicKey});
    expect(await readChallenge(async () => ({ok: false, error: 'malformed'}), 'ab'.repeat(16))).toEqual({state: 'undescribable', account: null});
    expect(
      await readChallenge(async () => {
        throw new Error('gone');
      }, 'ab'.repeat(16)),
    ).toEqual({state: 'undescribable', account: null});
  });

  // H1: [Cancel send] can discard only an account it has validated by itself; anything else is null.
  it('an undescribable send carries its account only when that field is an address by itself', async () => {
    const read = (data: unknown) => readChallenge(async () => ({ok: true, data}), 'ab'.repeat(16));
    expect(await read({...SEND, markupReason: 'charged'})).toEqual({state: 'undescribable', account: ACCOUNT.publicKey});
    expect(await read({...SEND, account: 'not an address', token: 'BONK'})).toEqual({state: 'undescribable', account: null});
    expect(await read({...SEND, account: 42, token: 'BONK'})).toEqual({state: 'undescribable', account: null});
    expect(await read({kind: 'settings', account: ACCOUNT.publicKey, autoLockMinutes: 99, reauthUsdCents: null})).toEqual({state: 'undescribable', account: null});
    expect(await read('send')).toEqual({state: 'undescribable', account: null});
  });

  it('discardPrepared (E7) sends the account only when it is an address', async () => {
    const sent: unknown[] = [];
    const send: Send = async m => (sent.push(m), {ok: true});
    expect(await discardPrepared(send, ACCOUNT.publicKey)).toBe(true);
    expect(await discardPrepared(send, 'not an address')).toBe(false);
    expect(sent).toEqual([{type: 'wallet.discardPrepared', account: ACCOUNT.publicKey}]);
    expect(await discardPrepared(async () => ({ok: false, error: 'malformed'}), ACCOUNT.publicKey)).toBe(false);
  });
});
```

Modify `extension/src/unlock/__tests__/reauthFlow.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/reauthFlow.test.ts b/extension/src/unlock/__tests__/reauthFlow.test.ts
index d47cc41..dea092d 100644
--- a/extension/src/unlock/__tests__/reauthFlow.test.ts
+++ b/extension/src/unlock/__tests__/reauthFlow.test.ts
@@ -12,7 +12,7 @@ const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
 const kdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
 const ID = 'cd'.repeat(16);
 
-async function setup(sessionMnemonic: string | null, reply: (type: string) => {ok: boolean} = () => ({ok: true})) {
+async function setup(sessionMnemonic: string | null, reply: (type: string) => {ok: boolean; error?: string} = () => ({ok: true})) {
   const session = sessionMnemonic === null ? [] : await deriveSessionAccounts(sessionMnemonic, 'slip10', [0]);
   const env: EnvelopeV1 = await createEnvelope({mnemonic: MNEMONIC, password: PASSWORD, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf});
   const sent: {type: string; challengeId?: string}[] = [];
@@ -75,6 +75,17 @@ describe('runReauth (the vault page proves the factor, the background is told)',
     expect(await runReauth(deps, ID, {password: PASSWORD, kdf})).toBe('failed');
   });
 
+  // D39 (plan-1 carry): the challenge expired while the password was typed — #10 says "expired", never
+  // "failed"; a lock between the status read and the confirmation is "not-unlocked".
+  it("vault.reauthOk answered unknown-challenge is 'expired'; locked is 'not-unlocked'; any other refusal 'failed'", async () => {
+    const expired = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'unknown-challenge'} : {ok: true}));
+    expect(await runReauth(expired.deps, ID, {password: PASSWORD, kdf})).toBe('expired');
+    const locked = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'locked'} : {ok: true}));
+    expect(await runReauth(locked.deps, ID, {password: PASSWORD, kdf})).toBe('not-unlocked');
+    const other = await setup(MNEMONIC, type => (type === 'vault.reauthOk' ? {ok: false, error: 'malformed'} : {ok: true}));
+    expect(await runReauth(other.deps, ID, {password: PASSWORD, kdf})).toBe('failed');
+  });
+
   it('a damaged envelope is named, and the background is told nothing — not even the status read (stored.ts)', async () => {
     const {deps, env, sent} = await setup(MNEMONIC);
     const damaged = {...env, password: {wrapped: 'AAAA'}};
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/challenge.test.ts src/unlock/__tests__/reauthFlow.test.ts`
Expected (dry run): FAIL — Test Files 2 failed (2) Tests 1 failed | 12 passed (13) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Create `extension/src/unlock/challenge.ts`:

```ts
import {formatAmount} from '../shared/amount';
import {REAUTH} from './strings';
import type {Send} from './types';

/**
 * #10's description of a re-authentication (spec B1b-2a E3). The vault page takes the challenge ID
 * from its URL and the description ONLY from the background (vault.challengeInfo), and renders nothing
 * untrusted: every field is re-validated here against a closed alphabet before any text is built —
 * the token in this page's own four-entry table, amounts ^\d{1,20}$, addresses the base58 alphabet at
 * 32–44 characters, each reason and fee reason one of its known codes mapped to a fixed string,
 * thresholds integers in range, and exactly the record's keys. Anything else is null: #10 then shows
 * "The details of this action could not be shown." with only Cancel — it never offers a confirmation
 * it cannot describe.
 */
const TOKENS = {SOL: 9, NOC: 9, USDC: 6, USDT: 6} as const;
export type TokenSymbol = keyof typeof TOKENS;
const DIGITS = /^\d{1,20}$/;
const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SEND_KEYS = ['account', 'amount', 'kind', 'markupLamports', 'markupReason', 'networkLamports', 'reasons', 'recipient', 'rentLamports', 'thresholdCents', 'token'];
const SETTINGS_KEYS = ['autoLockMinutes', 'kind', 'reauthUsdCents'];
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

export interface FeeLine {
  label: string;
  /** "0.000005 SOL"; null for a reason line (a zero Noctura fee says why, in the label). */
  value: string | null;
}
export interface SendDescription {
  kind: 'send';
  account: string;
  /** Exact: every base unit shown (a confirmation never rounds). */
  amount: string;
  symbol: TokenSymbol;
  recipient: string;
  fees: FeeLine[];
  reasons: string[];
}
export interface SettingsDescription {
  kind: 'settings';
  lines: string[];
}
export type Description = SendDescription | SettingsDescription;

const sol = (lamports: string): string => `${formatAmount(BigInt(lamports), 9, {min: 0, max: 9})} SOL`;
const dollars = (cents: number): string => formatAmount(BigInt(cents), 2, cents % 100 === 0 ? {min: 0, max: 0} : {min: 2, max: 2});
const isInt = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x >= min && x <= max;
const hasExactly = (o: Record<string, unknown>, keys: string[]): boolean => Object.keys(o).sort().join(',') === keys.join(',') && keys.every(k => own(o, k));

function describeSend(a: Record<string, unknown>): SendDescription | null {
  if (!hasExactly(a, SEND_KEYS)) return null;
  const {account, recipient, token, amount, networkLamports, markupLamports, markupReason, rentLamports, reasons, thresholdCents} = a;
  if (typeof account !== 'string' || !ADDRESS.test(account) || typeof recipient !== 'string' || !ADDRESS.test(recipient)) return null;
  if (typeof token !== 'string' || !own(TOKENS, token)) return null;
  const symbol = token as TokenSymbol;
  if (![amount, networkLamports, markupLamports, rentLamports].every(v => typeof v === 'string' && DIGITS.test(v))) return null;
  if (!isInt(thresholdCents, 100, 100_000)) return null;
  if (!Array.isArray(reasons)) return null;
  const lines: string[] = [];
  for (const r of reasons as unknown[]) {
    if (r === 'over-usd-threshold') lines.push(REAUTH.overUsd(dollars(thresholdCents)));
    else if (typeof r === 'string' && own(REAUTH.reason, r)) lines.push(REAUTH.reason[r as keyof typeof REAUTH.reason]);
    else return null;
  }
  const fees: FeeLine[] = [{label: REAUTH.networkFee, value: sol(networkLamports as string)}];
  if (BigInt(markupLamports as string) > 0n) {
    if (markupReason !== 'charged') return null;
    fees.push({label: REAUTH.nocturaFee, value: sol(markupLamports as string)});
  } else {
    // 'charged' with nothing charged does not describe one action: fail closed.
    if (typeof markupReason !== 'string' || !own(REAUTH.feeReason, markupReason)) return null;
    fees.push({label: REAUTH.feeReason[markupReason as keyof typeof REAUTH.feeReason], value: null});
  }
  if (BigInt(rentLamports as string) > 0n) fees.push({label: REAUTH.newTokenAccount, value: sol(rentLamports as string)});
  const decimals = TOKENS[symbol];
  return {
    kind: 'send',
    account,
    amount: formatAmount(BigInt(amount as string), decimals, {min: symbol === 'SOL' || symbol === 'NOC' ? 4 : 2, max: decimals}),
    symbol,
    recipient,
    fees,
    reasons: lines,
  };
}

function describeSettings(a: Record<string, unknown>): SettingsDescription | null {
  if (!hasExactly(a, SETTINGS_KEYS)) return null;
  const {autoLockMinutes, reauthUsdCents} = a;
  const lines: string[] = [];
  if (autoLockMinutes !== null) {
    if (!isInt(autoLockMinutes, 1, 60)) return null;
    lines.push(REAUTH.autoLock(autoLockMinutes));
  }
  if (reauthUsdCents !== null) {
    if (!isInt(reauthUsdCents, 100, 100_000)) return null;
    lines.push(REAUTH.threshold(dollars(reauthUsdCents)));
  }
  return lines.length === 0 ? null : {kind: 'settings', lines};
}

/** The closed-alphabet renderer: a description built only from fixed strings and validated values, or null. */
export function describeChallenge(about: unknown): Description | null {
  if (typeof about !== 'object' || about === null || Array.isArray(about)) return null;
  const a = about as Record<string, unknown>;
  if (a.kind === 'send') return describeSend(a);
  if (a.kind === 'settings') return describeSettings(a);
  return null;
}

export type ChallengeRead =
  | {state: 'described'; description: Description}
  | {state: 'undescribable'; account: string | null}
  | {state: 'expired' | 'not-unlocked'};

/**
 * The one field of a send record #10 may use when the rest cannot be described: its account, valid by
 * itself (the base58 alphabet, 32–44 characters). [Cancel send] discards that account's prepared send
 * (E7) — without it the page could not drop the send, and must not say "Send cancelled".
 */
function sendAccount(about: unknown): string | null {
  if (typeof about !== 'object' || about === null || Array.isArray(about)) return null;
  const a = about as Record<string, unknown>;
  return a.kind === 'send' && own(a, 'account') && typeof a.account === 'string' && ADDRESS.test(a.account) ? a.account : null;
}

/**
 * vault.challengeInfo, read for #10's first state. `unknown-challenge` (absent or expired) is
 * `expired`; `locked` is `not-unlocked`; any other answer — a reply the renderer cannot describe, a
 * refusal it does not name, a thrown message — is `undescribable`, which offers only Cancel, and carries
 * the send's account when that one field is valid by itself (H1 of the plan review).
 */
export async function readChallenge(send: Send, challengeId: string): Promise<ChallengeRead> {
  try {
    const r = await send({type: 'vault.challengeInfo', challengeId});
    if (!r.ok) {
      if (r.error === 'unknown-challenge') return {state: 'expired'};
      if (r.error === 'locked') return {state: 'not-unlocked'};
      return {state: 'undescribable', account: null};
    }
    const description = describeChallenge(r.data);
    return description === null ? {state: 'undescribable', account: sendAccount(r.data)} : {state: 'described', description};
  } catch {
    return {state: 'undescribable', account: null};
  }
}

/** E7: #10's [Cancel send] drops the account's prepared send and its challenge. True when the background says so. */
export async function discardPrepared(send: Send, account: string): Promise<boolean> {
  if (!ADDRESS.test(account)) return false;
  try {
    return (await send({type: 'wallet.discardPrepared', account})).ok;
  } catch {
    return false;
  }
}
```

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 77bd6b9..bba7d1b 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -12,6 +12,7 @@ import {unb64} from '../vault/bytes';
 import type {EnvelopeV1} from '../vault/envelope';
 import {send} from '../ui/send';
 import {readLocal} from '../shared/readLocal';
+import {REAUTH} from './strings';
 
 // Thin page modes for B1b-1 (the owner's screens arrive in B1b-2). The vault page renders only its
 // own fixed strings (spec §1): every status line is a literal below, and the only other text it
@@ -36,6 +37,7 @@ const REAUTH_WORDS: Record<ReauthPageOutcome | 'unavailable', string> = {
   wrong: 'That did not confirm it.',
   'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
   'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
+  expired: REAUTH.expired,
   damaged: "This wallet's stored data is damaged.",
   'no-wallet': 'No wallet on this browser yet.',
   failed: 'Something went wrong. Try again.',
```

Modify `extension/src/unlock/reauthFlow.ts`:

```diff
diff --git a/extension/src/unlock/reauthFlow.ts b/extension/src/unlock/reauthFlow.ts
index d6b67cd..53710be 100644
--- a/extension/src/unlock/reauthFlow.ts
+++ b/extension/src/unlock/reauthFlow.ts
@@ -2,7 +2,7 @@ import {reauthenticate, type ReauthFactor, type SessionKeys} from '../vault/reau
 import {storedVault} from './stored';
 import type {Send} from './types';
 
-export type ReauthPageOutcome = 'confirmed' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'damaged' | 'no-wallet' | 'failed';
+export type ReauthPageOutcome = 'confirmed' | 'wrong' | 'not-unlocked' | 'mismatch-locked' | 'expired' | 'damaged' | 'no-wallet' | 'failed';
 
 /** The session's PUBLIC keys, from vault.status — never its secret keys. Null while locked. */
 export async function sessionKeys(send: Send): Promise<SessionKeys | null> {
@@ -48,7 +48,12 @@ export async function runReauth(
     if (outcome === 'mismatch') return await lockOnMismatch(deps.send);
     if (outcome !== 'ok') return outcome;
     const r = await deps.send({type: 'vault.reauthOk', challengeId});
-    return r.ok ? 'confirmed' : 'failed';
+    if (r.ok) return 'confirmed';
+    // D39: the challenge expired (or was discarded) while the password was typed — #10's `expired`,
+    // never `failed`. A lock that landed after the status read is `not-unlocked`.
+    if (r.error === 'unknown-challenge') return 'expired';
+    if (r.error === 'locked') return 'not-unlocked';
+    return 'failed';
   } catch {
     return 'failed';
   } finally {
```

Create `extension/src/unlock/strings.ts`:

```ts
/**
 * Every string the vault page sets at run time (spec B1b-2a §1.2 item 3). The only other text it ever
 * shows is the user's own words (#3, #4, #8) and, on #10, the challenge fields the background
 * describes — re-validated against a closed alphabet first (challenge.ts). Static copy lives in
 * unlock.html's markup. Stand-alone: this module may import nothing (scripts/check-vault-isolation.mjs
 * STANDALONE), so no UI code can reach the vault page through it. A function here only formats a
 * number the page computed itself.
 */

/** Shared lines (the B1b-1 vault words, kept). */
export const COMMON = {
  damaged: "This wallet's stored data is damaged.",
  /**
   * Controller addition — confirmed by the owner 2026-10-01 (plan 2, carry 3; its next step per the plan-2 review): what the
   * page says beside `damaged` where nothing can repair it yet (#37 is B1b-2b).
   */
  damagedHelp: 'Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.',
  noWallet: 'No wallet on this browser yet.',
  exists: 'A wallet already exists in this browser. Nothing was changed.',
  wrongConfirm: 'That did not confirm it.',
  waitConfirm: 'That did not confirm it. Wait a moment before trying again.',
  mismatchLocked: 'That did not match this wallet, so the wallet has been locked.',
  failedTryAgain: 'Something went wrong. Try again.',
  unreadable: "This wallet's stored data could not be read. Reload this page.",
  passkeyUnavailableConfirm: 'This device cannot confirm with a passkey; your password still works.',
} as const;

/** #9's cooldown card (and #10's, which reuses it): "0:12", and the design's helper line. */
export const clockText = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
export const cooldownLabel = (seconds: number): string => `Cooldown · ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`;

/** #10 unlock-send (re-authentication). */
export const REAUTH = {
  loading: 'Reading the details…',
  undescribable: 'The details of this action could not be shown.',
  notUnlocked: 'The wallet locked while you were confirming. Unlock it and start the send again.',
  expired: 'This confirmation has expired. Start the send again from the Noctura icon.',
  checking: 'Checking…',
  cancelled: 'Send cancelled. Nothing was sent.',
  settingsConfirmed: 'Confirmed. You can close this tab.',
  networkFee: 'Network fee',
  nocturaFee: 'Noctura fee',
  newTokenAccount: 'New token account',
  /** The carried rule: a zero Noctura fee always says why. */
  feeReason: {
    'pre-tge': 'No Noctura fee before TGE',
    'zero-fee-eligible': 'No Noctura fee (zero-fee eligible)',
    'status-unknown': 'No Noctura fee (status unknown)',
  },
  reason: {
    'over-5-percent': 'Re-auth required for transactions over 5 % of balance.',
    'first-send': 'Re-auth required for the first send to a new address.',
    'whole-balance-to-new': 'Re-auth required to send your whole balance to a new address.',
  },
  overUsd: (dollars: string): string => `Re-auth required for transactions over $${dollars}.`,
  autoLock: (minutes: number): string => `Auto-lock → ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`,
  threshold: (dollars: string): string => `Re-authentication threshold → $${dollars}`,
} as const;
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/challenge.test.ts src/unlock/__tests__/reauthFlow.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 84 passed (84) Tests 1089 passed (1089).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- the recipient not re-validated → RED Tests  2 failed | 23 passed (25)
- unknown-challenge reported as failed → RED Tests  1 failed | 12 passed (13)
- the token looked up with `in` (inherited keys) → RED Tests  1 failed | 24 passed (25)
- an undescribable send’s account taken unvalidated (H1) → RED Tests  1 failed | 24 passed (25)

- [ ] **Step 6: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/unlock/__tests__/challenge.test.ts extension/src/unlock/__tests__/reauthFlow.test.ts extension/src/unlock/challenge.ts extension/src/unlock/modes.ts extension/src/unlock/reauthFlow.ts extension/src/unlock/strings.ts
git commit -m "feat(extension): the #10 renderer — challengeInfo re-validated against a closed alphabet; unknown-challenge is expired (E3, D39)" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 4: The page’s dependencies, rule 6 for the vault page, and the vault-local DOM helpers (§1.2 item 2)

**Files:**
- Create: `extension/src/unlock/__tests__/fakeTimers.ts`
- Create: `extension/src/unlock/__tests__/page.test.ts`
- Create: `extension/src/unlock/__tests__/views.test.ts`
- Create: `extension/src/unlock/page.ts`
- Modify: `extension/src/unlock/strings.ts`
- Create: `extension/src/unlock/view/cooldown.ts`
- Create: `extension/src/unlock/view/dom.ts`
- Create: `extension/src/unlock/view/hold.ts`
- Create: `extension/src/unlock/view/meter.ts`
- Create: `extension/src/unlock/view/words.ts`

**Interfaces:**
- Consumes: Task 1 (`MIN_PASSWORD_LENGTH`, `runExclusive`, `BusyGate`), Task 3 (`strings.ts`).
- Produces:
  - `src/unlock/page.ts`: `interface Timers {now(); setTimeout(f, ms): number; clearTimeout(id); setInterval(f, ms): number; clearInterval(id)}`; `type PageTarget` (`'unlock.html?mode=welcome' | 'unlock.html?mode=unlock' | 'unlock.html?mode=forgot' | 'unlock.html?mode=import&source=forgot' | 'wallet.html#/created' | 'wallet.html#/imported' | `wallet.html#/send/resume?account=${string}``); `resumeTarget(account): PageTarget | null`; `interface PageDeps {send; store; kdf; credentials; randomBytes(n); newMnemonic(); timers; sleep(ms); gate: BusyGate; go(target); closeTab(); onLeave(f)}`; `LOCK_MS = 500`; `exclusive<T>(deps: {gate; sleep}, render: () => void, action: () => Promise<T>): Promise<T | 'busy'>`; `CLOSE_CHECK_MS = 500`
  - `src/unlock/view/dom.ts`: `byId<T>(id)`, `h(tag, cls?, text?)`, `setText(el, text)`, `shown(el, on)`, `SCREENS`, `type ScreenId`, `showScreen(id)`, `closeOrHide(close, later, button)`
  - `src/unlock/view/words.ts`: `addressGroups(address)`, `seedWordCells(words)`, `phraseCells(words)`, `phraseWords(text)`
  - `src/unlock/view/hold.ts`: `HOLD_MS`, `TICK_MS`, `REVEAL_MS`, `type HoldState = 'blurred' | 'revealed' | 'still-looking' | 'confirmed'`, `createHold(timers, {state(s), tick(secondsLeft)}): {press(); release(); dispose(); state(); revealedOnce()}`
  - `src/unlock/view/meter.ts`: `lengthMeter(length): {filled; label}`, `renderMeter(bars, label, length)`; `view/cooldown.ts`: `startCooldown(timers, ms, {timer; label; ring}): () => void`
  - `strings.ts`: `PASSWORD.longEnough`, `PASSWORD.lengthOf(n)`

Spec §1.2 item 2: the vault page gets the design's look from its own small DOM helpers, never from `src/app`. This task adds them, with no screen yet:
- `src/unlock/page.ts`: `PageDeps` — what every screen is given (the background `send`, the `VaultStore`, the KDF, WebAuthn, random bytes, the mnemonic generator, **injectable timers**, `sleep`, the page's one busy gate, same-tab `go()` to a **closed list** of `PageTarget`s, `closeTab()`, `onLeave()` for pagehide/hidden); `exclusive()` — rule 6 for the vault page (§7.6): the page's one gate taken synchronously, held until the action settles **and** 500 ms have passed; `resumeTarget(account)` — the one target built from data, for an address only.
- `src/unlock/view/dom.ts` (`byId`, `h`, `setText`, `shown`, `showScreen`, `closeOrHide`), `view/words.ts` (`addressGroups` — the DOM twin of `web/src/ui/AddressGroups`; #3's `seedWordCells`, 1…24 in DOM order for the design's column-major grid; #8's `phraseCells` and `phraseWords`), `view/hold.ts` (#3's press-and-hold: 2 s at 30 ms ticks, the 20 s reveal, the auto-blur that fires even while held, and only a release and a new press holding again), `view/meter.ts` (#5's length meter, D7), `view/cooldown.ts` (#9's card, counted once a second).
- `src/unlock/__tests__/fakeTimers.ts`: the manual clock every screen test uses.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/unlock/__tests__/fakeTimers.ts`:

```ts
import type {Timers} from '../page';

/**
 * A manual clock for the vault page's timers: nothing runs until `advance(ms)`, which fires every due
 * timeout and interval in time order. Deterministic — no real time passes in a screen test.
 */
export function fakeTimers(start = 1_000_000): Timers & {advance(ms: number): void; pending(): number} {
  let now = start;
  let next = 1;
  const jobs = new Map<number, {at: number; every: number | null; f: () => void}>();
  const timers = {
    now: () => now,
    setTimeout(f: () => void, ms: number) {
      const id = next++;
      jobs.set(id, {at: now + ms, every: null, f});
      return id;
    },
    clearTimeout(id: number) {
      jobs.delete(id);
    },
    setInterval(f: () => void, ms: number) {
      const id = next++;
      jobs.set(id, {at: now + ms, every: Math.max(1, ms), f});
      return id;
    },
    clearInterval(id: number) {
      jobs.delete(id);
    },
    advance(ms: number) {
      const end = now + ms;
      for (;;) {
        let due: [number, {at: number; every: number | null; f: () => void}] | undefined;
        for (const e of jobs) if (e[1].at <= end && (due === undefined || e[1].at < due[1].at)) due = e;
        if (due === undefined) break;
        const [id, job] = due;
        now = job.at;
        if (job.every === null) jobs.delete(id);
        else job.at += job.every;
        job.f();
      }
      now = end;
    },
    pending: () => jobs.size,
  };
  return timers;
}
```

Create `extension/src/unlock/__tests__/page.test.ts`:

```ts
import {LOCK_MS, exclusive, resumeTarget} from '../page';
import type {BusyGate} from '../orchestrate';

// Spec §7.6, rule 6 on the vault page: the page's one busy gate, plus the same 500 ms floor.
describe('exclusive (rule 6)', () => {
  function page() {
    let busy = false;
    const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
    const sleeps: (() => void)[] = [];
    const sleep = (ms: number) => {
      expect(ms).toBe(LOCK_MS);
      return new Promise<void>(r => sleeps.push(r));
    };
    const renders: boolean[] = [];
    const render = () => renders.push(busy);
    return {gate, sleep, sleeps, render, renders, busy: () => busy};
  }

  it('a second click before the action settles does nothing', async () => {
    const p = page();
    let runs = 0;
    let finish: () => void = () => undefined;
    const action = () => (runs++, new Promise<void>(r => (finish = r)));
    const first = exclusive(p, p.render, action);
    expect(await exclusive(p, p.render, action)).toBe('busy');
    expect(runs).toBe(1);
    finish();
    p.sleeps.forEach(r => r());
    await first;
    expect(p.busy()).toBe(false);
  });

  it('a second click inside 500 ms does nothing, although the action already settled; the screen re-renders on both edges', async () => {
    const p = page();
    let runs = 0;
    const first = exclusive(p, p.render, async () => void runs++);
    await Promise.resolve();
    await Promise.resolve();
    expect(runs).toBe(1);
    expect(await exclusive(p, p.render, async () => void runs++)).toBe('busy');
    expect(runs).toBe(1);
    expect(p.busy()).toBe(true);
    p.sleeps.forEach(r => r());
    await first;
    expect(p.busy()).toBe(false);
    expect(p.renders[0]).toBe(true);
    expect(p.renders.at(-1)).toBe(false);
  });
});

describe('resumeTarget', () => {
  it('builds the resume route only for an address; nothing else can name a page', () => {
    expect(resumeTarget('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk')).toBe('wallet.html#/send/resume?account=HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
    for (const bad of ['', 'x', 'https://evil.example', 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk&amount=1', '0OIl'.repeat(10)]) expect(resumeTarget(bad)).toBeNull();
  });
});
```

Create `extension/src/unlock/__tests__/views.test.ts`:

```ts
// @vitest-environment happy-dom
import {addressGroups, phraseCells, phraseWords, seedWordCells} from '../view/words';
import {HOLD_MS, REVEAL_MS, TICK_MS, createHold, type HoldState} from '../view/hold';
import {lengthMeter, renderMeter} from '../view/meter';
import {startCooldown} from '../view/cooldown';
import {closeOrHide, h} from '../view/dom';
import {fakeTimers} from './fakeTimers';

describe('the vault page’s DOM twins of the design', () => {
  const ADDR = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
  it('addressGroups: the full address in groups of four at equal weight, and selecting it copies the exact address', () => {
    const el = addressGroups(ADDR);
    expect(el.className).toBe('addr-groups noc-mono');
    expect([...el.children].map(c => c.textContent)).toEqual(ADDR.match(/.{1,4}/g));
    expect(el.textContent).toBe(ADDR);
  });

  it('seedWordCells: "01"…"24" with the word, in DOM order 1…24 (the grid flows them column-major)', () => {
    const words = Array.from({length: 24}, (_, i) => `w${i}`);
    const cells = seedWordCells(words);
    expect(cells).toHaveLength(24);
    expect(cells[0]?.className).toBe('word');
    expect([...(cells[0]?.children ?? [])].map(c => [c.className, c.textContent])).toEqual([['num', '01'], ['term', 'w0']]);
    expect(cells[23]?.querySelector('.num')?.textContent).toBe('24');
  });

  it('phraseCells: the words typed so far, then empty cells to 12 — or to 24 past 12 words', () => {
    expect(phraseCells(['legend', 'frost']).map(c => [c.className, c.textContent])).toEqual([
      ['w', '01 legend'],
      ['w', '02 frost'],
      ...Array.from({length: 10}, (_, i) => ['w empty', `${String(i + 3).padStart(2, '0')} …`]),
    ]);
    expect(phraseCells(Array.from({length: 13}, () => 'x'))).toHaveLength(24);
    expect(phraseWords('  Legend, FROST\nmarble ')).toEqual(['legend', 'frost', 'marble']);
  });

  it('lengthMeter: four bars at 3/6/9/12 characters; "N of 12 characters", then "Long enough"', () => {
    expect([0, 2, 3, 8, 9, 11, 12, 40].map(n => lengthMeter(n))).toEqual([
      {filled: 0, label: '0 of 12 characters'},
      {filled: 0, label: '2 of 12 characters'},
      {filled: 1, label: '3 of 12 characters'},
      {filled: 2, label: '8 of 12 characters'},
      {filled: 3, label: '9 of 12 characters'},
      {filled: 3, label: '11 of 12 characters'},
      {filled: 4, label: 'Long enough'},
      {filled: 4, label: 'Long enough'},
    ]);
    const bars = h('div');
    for (let i = 0; i < 4; i++) bars.append(h('i'));
    const label = h('span');
    renderMeter(bars, label, 7);
    expect([...bars.children].map(b => b.classList.contains('filled'))).toEqual([true, true, false, false]);
    expect(label.textContent).toBe('7 of 12 characters');
  });

  it('startCooldown: counts the wait down once a second as "0:12" with the design’s helper line, and stops', () => {
    const t = fakeTimers();
    const parts = {timer: h('div'), label: h('div'), ring: h('div')};
    const stop = startCooldown(t, 12_000, parts);
    expect(parts.timer.textContent).toBe('0:12');
    expect(parts.label.textContent).toBe('Cooldown · 0 minutes 12 seconds remaining');
    expect(parts.ring.style.getPropertyValue('--vlt-ring')).toBe('1');
    t.advance(3_000);
    expect(parts.timer.textContent).toBe('0:09');
    expect(parts.ring.style.getPropertyValue('--vlt-ring')).toBe('0.75');
    stop();
    expect(t.pending()).toBe(0);
  });

  it('closeOrHide: closes, and hides the button when the tab is still here afterwards', () => {
    const t = fakeTimers();
    const button = h('button');
    let closed = 0;
    closeOrHide(() => closed++, f => void t.setTimeout(f, 500), button);
    expect(closed).toBe(1);
    expect(button.hidden).toBe(false);
    t.advance(500);
    expect(button.hidden).toBe(true);
  });
});

describe('#3’s press-and-hold (spec §3.3)', () => {
  // 30 ms ticks: the reveal lands on the first tick at or past 2 s.
  const HELD = HOLD_MS + TICK_MS;
  function setup() {
    const t = fakeTimers();
    const states: HoldState[] = [];
    const ticks: number[] = [];
    const hold = createHold(t, {state: s => states.push(s), tick: s => ticks.push(s)});
    return {t, hold, states, ticks};
  }

  it('reveals after a 2 s hold; a release before that reveals nothing', () => {
    const {t, hold, states} = setup();
    hold.press();
    t.advance(HOLD_MS - 30);
    hold.release();
    expect(states).toEqual([]);
    expect(hold.revealedOnce()).toBe(false);
    hold.press();
    t.advance(HELD);
    expect(states).toEqual(['revealed']);
    expect(hold.revealedOnce()).toBe(true);
  });

  it('counts 20 … 1 while revealed; release is "confirmed"', () => {
    const {t, hold, states, ticks} = setup();
    hold.press();
    t.advance(HELD);
    t.advance(7_000);
    expect(ticks).toEqual([20, 19, 18, 17, 16, 15, 14, 13]);
    hold.release();
    expect(states).toEqual(['revealed', 'confirmed']);
    expect(t.pending()).toBe(0);
  });

  it('auto-blurs at 20 s even while held ("Still looking?"); only a release and a new press hold again', () => {
    const {t, hold, states} = setup();
    hold.press();
    t.advance(HELD + REVEAL_MS);
    expect(states).toEqual(['revealed', 'still-looking']);
    hold.press(); // still held: ignored
    t.advance(HOLD_MS * 2);
    expect(states).toEqual(['revealed', 'still-looking']);
    hold.release(); // the forced release
    hold.press();
    t.advance(HELD);
    expect(states).toEqual(['revealed', 'still-looking', 'revealed']);
  });

  it('after a full hold, a short press and release rests at "confirmed"; dispose clears every timer', () => {
    const {t, hold, states} = setup();
    hold.press();
    t.advance(HELD + REVEAL_MS);
    hold.release();
    hold.press();
    t.advance(500);
    hold.release();
    expect(states).toEqual(['revealed', 'still-looking', 'confirmed']);
    hold.press();
    hold.dispose();
    expect(t.pending()).toBe(0);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/fakeTimers.ts src/unlock/__tests__/page.test.ts src/unlock/__tests__/views.test.ts`
Expected (dry run): FAIL — Test Files 2 failed (2) Tests no tests (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Create `extension/src/unlock/page.ts`:

```ts
import type {Kdf} from '../vault/envelope';
import type {CredentialsApi} from '../vault/passkey';
import {runExclusive, type BusyGate} from './orchestrate';
import type {Send, VaultStore} from './types';

/** The browser timers a screen uses, injectable so the hold, the cooldown and the idle timer are testable. */
export interface Timers {
  now(): number;
  setTimeout(f: () => void, ms: number): number;
  clearTimeout(id: number): void;
  setInterval(f: () => void, ms: number): number;
  clearInterval(id: number): void;
}

const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/**
 * Every page this vault page may send the tab to (spec B1b-2a §1.2, §1.6). A closed list: no target is
 * built from data except the resume route, whose one parameter is checked as an address first
 * (resumeTarget). The UI tab's hashes choose a screen and never act.
 */
export type PageTarget =
  | 'unlock.html?mode=welcome'
  | 'unlock.html?mode=unlock'
  | 'unlock.html?mode=forgot'
  | 'unlock.html?mode=import&source=forgot'
  | 'wallet.html#/created'
  | 'wallet.html#/imported'
  | `wallet.html#/send/resume?account=${string}`;

export function resumeTarget(account: string): PageTarget | null {
  return ADDRESS.test(account) ? `wallet.html#/send/resume?account=${account}` : null;
}

/** What every vault-page screen is given: the background, the stored vault, the KDF, the clock and the tab. */
export interface PageDeps {
  send: Send;
  store: VaultStore;
  kdf: Kdf;
  credentials: CredentialsApi;
  randomBytes(n: number): Uint8Array;
  newMnemonic(): string;
  timers: Timers;
  sleep(ms: number): Promise<void>;
  /** One busy flag for the whole page (cardinal rule 6): a passkey prompt and a password submit cannot race. */
  gate: BusyGate;
  /** Same-tab navigation (location.replace): the tab moves on and the page's memory goes with it. */
  go(target: PageTarget): void;
  /** window.close(); the screen hides [Close this tab] if the tab is still here a moment later. */
  closeTab(): void;
  /** pagehide, and visibilitychange to hidden: where a screen drops what it holds (spec §3.5 memory rule). */
  onLeave(f: () => void): void;
}

/** Rule 6 for the vault page (spec §7.6): the gate is held at least this long after a click. */
export const LOCK_MS = 500;

/**
 * Runs a page action under the page's one busy gate, held until the action settles AND at least
 * LOCK_MS have passed (spec §7.6: "the existing runExclusive gate plus the same 500 ms floor"). The
 * gate is taken synchronously, before the first await, so a second click in the same frame is
 * refused. `render` runs when the gate is taken and when it is released: a screen derives every
 * button's `disabled` from its own state and `gate.isBusy()`.
 */
export function exclusive<T>(deps: Pick<PageDeps, 'gate' | 'sleep'>, render: () => void, action: () => Promise<T>): Promise<T | 'busy'> {
  return runExclusive(deps.gate, async () => {
    const floor = deps.sleep(LOCK_MS);
    render();
    try {
      return await action();
    } finally {
      await floor;
    }
  }).finally(render);
}

/** How long to wait before deciding the browser refused window.close() (the tab is still alive). */
export const CLOSE_CHECK_MS = 500;
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index c5dbbe5..743520c 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -25,6 +25,12 @@ export const COMMON = {
   passkeyUnavailableConfirm: 'This device cannot confirm with a passkey; your password still works.',
 } as const;
 
+/** #5 create password (D7). */
+export const PASSWORD = {
+  longEnough: 'Long enough',
+  lengthOf: (n: number): string => `${n} of 12 characters`,
+} as const;
+
 /** #9's cooldown card (and #10's, which reuses it): "0:12", and the design's helper line. */
 export const clockText = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
 export const cooldownLabel = (seconds: number): string => `Cooldown · ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`;
```

Create `extension/src/unlock/view/cooldown.ts`:

```ts
import {clockText, cooldownLabel} from '../strings';
import type {Timers} from '../page';

/**
 * #9's cooldown card (and #10's): the engine's wrong-password wait (≤ 30 s, page memory, D11), counted
 * down once a second — "0:12", the design's helper line, and the ring's remaining share (`--vlt-ring`,
 * read by unlock.css's conic gradient). Returns a stop function; the caller stops it when the wait ends.
 */
export function startCooldown(timers: Timers, ms: number, parts: {timer: HTMLElement; label: HTMLElement; ring: HTMLElement}): () => void {
  const until = timers.now() + ms;
  const paint = () => {
    const left = Math.max(0, until - timers.now());
    const seconds = Math.ceil(left / 1000);
    parts.timer.textContent = clockText(seconds);
    parts.label.textContent = cooldownLabel(seconds);
    parts.ring.style.setProperty('--vlt-ring', String(ms === 0 ? 0 : left / ms));
  };
  paint();
  const id = timers.setInterval(paint, 1_000);
  return () => timers.clearInterval(id);
}
```

Create `extension/src/unlock/view/dom.ts`:

```ts
/**
 * The vault page's own DOM helpers (spec B1b-2a §1.2 item 2, S1): no React, no UI kit — the page that
 * holds the seed stays small. Text is only ever set with textContent (a gate forbids innerHTML and its
 * kin in src/unlock), so nothing the page shows can become markup.
 */

/** An element of unlock.html by id; a missing one is a bug in the page, never a state. */
export function byId<T extends HTMLElement = HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`unlock.html has no #${id}`);
  return el as T;
}

/** A new element with its classes and, optionally, its text. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (cls !== '') el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

export function setText(el: Element, text: string): void {
  el.textContent = text;
}

export function shown(el: HTMLElement, on: boolean): void {
  el.hidden = !on;
}

/** The vault page's screens: one <section> each, under main#vault. */
export const SCREENS = [
  'v-welcome',
  'v-intro',
  'v-seed',
  'v-confirm',
  'v-password',
  'v-passkey',
  'v-import',
  'v-retry',
  'v-unlock',
  'v-forgot',
  'v-reauth',
  'v-accounts',
  'v-reveal',
] as const;
export type ScreenId = (typeof SCREENS)[number];

/** Shows one screen and hides the others; the tab starts it at the top. */
export function showScreen(id: ScreenId): void {
  for (const s of SCREENS) {
    const el = document.getElementById(s);
    if (el !== null) el.hidden = s !== id;
  }
  if (typeof window.scrollTo === 'function') window.scrollTo(0, 0);
}

/**
 * Closes the tab, or — when the browser refuses (a tab it did not open) — hides the button that offered
 * it. `check` runs after the delay the caller gives: the page is still here, so the close was refused.
 */
export function closeOrHide(close: () => void, later: (f: () => void) => void, button: HTMLElement): void {
  close();
  later(() => {
    button.hidden = true;
  });
}
```

Create `extension/src/unlock/view/hold.ts`:

```ts
import type {Timers} from '../page';

/** #3's mechanics (spec §3.3): hold 2 s to reveal; 30 ms ticks; the reveal lasts at most 20 s. */
export const HOLD_MS = 2_000;
export const TICK_MS = 30;
export const REVEAL_MS = 20_000;

/**
 * - `blurred`: no full hold yet; the CTA is disabled.
 * - `revealed`: held past 2 s; the words show and the countdown runs.
 * - `still-looking`: the 20 s auto-blur fired while held; the hold is reset and must be released and
 *   pressed again (the auto-blur fires "even while held").
 * - `confirmed`: released after at least one full hold; re-blurred, "Acknowledged".
 */
export type HoldState = 'blurred' | 'revealed' | 'still-looking' | 'confirmed';

export interface HoldEvents {
  /** The state changed. */
  state(s: HoldState): void;
  /** While revealed: whole seconds until the auto-blur (20 … 1), once per change. */
  tick(secondsLeft: number): void;
}

export interface Hold {
  press(): void;
  release(): void;
  /** Clears every timer (leaving the step). */
  dispose(): void;
  state(): HoldState;
  /** At least one full hold happened: the CTA is enabled. */
  revealedOnce(): boolean;
}

/**
 * Press-and-hold to reveal, driven by the injected clock. A release before 2 s goes back to the resting
 * state (`blurred` before any full hold, `confirmed` after one — "Still looking?" included); a release
 * while revealed is `confirmed`; the 20 s auto-blur is `still-looking`, and only a release then a new
 * press starts a hold again.
 */
export function createHold(timers: Timers, on: HoldEvents): Hold {
  let state: HoldState = 'blurred';
  let holding = false;
  let mustRelease = false;
  let everRevealed = false;
  let pressedAt = 0;
  let revealedAt = 0;
  let lastSecond = -1;
  let interval: number | null = null;

  const set = (s: HoldState) => {
    state = s;
    on.state(s);
  };
  const stop = () => {
    if (interval !== null) timers.clearInterval(interval);
    interval = null;
  };
  const rest = (): HoldState => (everRevealed ? 'confirmed' : 'blurred');

  const tick = () => {
    const now = timers.now();
    if (state !== 'revealed') {
      if (now - pressedAt >= HOLD_MS) {
        everRevealed = true;
        revealedAt = now;
        lastSecond = -1;
        set('revealed');
      } else return;
    }
    const left = REVEAL_MS - (now - revealedAt);
    if (left <= 0) {
      stop();
      holding = false;
      mustRelease = true;
      set('still-looking');
      return;
    }
    const seconds = Math.ceil(left / 1000);
    if (seconds !== lastSecond) {
      lastSecond = seconds;
      on.tick(seconds);
    }
  };

  return {
    press() {
      if (holding || mustRelease) return;
      holding = true;
      pressedAt = timers.now();
      stop();
      interval = timers.setInterval(tick, TICK_MS);
    },
    release() {
      if (mustRelease) {
        mustRelease = false;
        return;
      }
      if (!holding) return;
      holding = false;
      stop();
      if (state === 'revealed') set('confirmed');
      else if (state !== rest()) set(rest());
    },
    dispose() {
      stop();
      holding = false;
    },
    state: () => state,
    revealedOnce: () => everRevealed,
  };
}
```

Create `extension/src/unlock/view/meter.ts`:

```ts
import {MIN_PASSWORD_LENGTH} from '../onboarding';
import {PASSWORD} from '../strings';

/**
 * #5's length meter (D7: "the strength meter shows only the length rule"): four bars filling at 3, 6, 9
 * and 12 characters, and the label "N of 12 characters" until 12, then "Long enough". Nothing here
 * judges a password's strength — the engine's only rule is its length.
 */
export function lengthMeter(length: number): {filled: number; label: string} {
  return {filled: Math.min(4, Math.floor(length / 3)), label: length >= MIN_PASSWORD_LENGTH ? PASSWORD.longEnough : PASSWORD.lengthOf(length)};
}

/** Paints the meter's four bars (`i.filled`) and its label. */
export function renderMeter(bars: HTMLElement, label: HTMLElement, length: number): void {
  const m = lengthMeter(length);
  [...bars.children].forEach((bar, i) => bar.classList.toggle('filled', i < m.filled));
  label.textContent = m.label;
}
```

Create `extension/src/unlock/view/words.ts`:

```ts
import {h} from './dom';

/**
 * A full address in groups of four at equal weight — the DOM twin of web/src/ui/AddressGroups.tsx
 * (spec §1.7). The gap is the stylesheet's column-gap, not a space, so a copy yields the exact address.
 */
export function addressGroups(address: string): HTMLSpanElement {
  const out = h('span', 'addr-groups noc-mono');
  for (const g of address.match(/.{1,4}/g) ?? []) out.append(h('span', '', g));
  return out;
}

const two = (n: number): string => String(n).padStart(2, '0');

/**
 * #3's recovery phrase: 24 cells in DOM order 1…24. The design's `.seed-grid` lays them out in 12 rows
 * with `grid-auto-flow: column`, so the grid reads 1–12 down the left column, 13–24 down the right
 * (column-major, wallet-ux §5). Each cell: `.word` > `.num` "01" + `.term` (the user's own word).
 */
export function seedWordCells(words: readonly string[]): HTMLDivElement[] {
  return words.map((w, i) => {
    const cell = h('div', 'word');
    cell.append(h('span', 'num', two(i + 1)), h('span', 'term', w));
    return cell;
  });
}

/**
 * #8's mono cell grid: each word typed so far as "01 legend", then empty cells "13 …" up to 12 or 24
 * (the nearer length the phrase can be), as the design's paste-detected and idle-timer states draw it.
 */
export function phraseCells(words: readonly string[]): HTMLDivElement[] {
  const target = words.length <= 12 ? 12 : 24;
  const out: HTMLDivElement[] = [];
  for (let i = 0; i < Math.max(target, words.length); i++) {
    const w = words[i];
    out.push(w === undefined ? h('div', 'w empty', `${two(i + 1)} …`) : h('div', 'w', `${two(i + 1)} ${w}`));
  }
  return out;
}

/** The words of whatever is in #8's field, as import reads them: lower-case letters, single spaces. */
export function phraseWords(text: string): string[] {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 0);
}
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/fakeTimers.ts src/unlock/__tests__/page.test.ts src/unlock/__tests__/views.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 86 passed (86) Tests 1102 passed (1102).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- no 500 ms floor → RED Tests  1 failed | 3 passed (4)
- the auto-blur waits for a release → RED Tests  2 failed | 8 passed (10)
- "Long enough" one character late → RED Tests  1 failed | 9 passed (10)

- [ ] **Step 6: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/unlock/__tests__/fakeTimers.ts extension/src/unlock/__tests__/page.test.ts extension/src/unlock/__tests__/views.test.ts extension/src/unlock/page.ts extension/src/unlock/strings.ts extension/src/unlock/view/cooldown.ts extension/src/unlock/view/dom.ts extension/src/unlock/view/hold.ts extension/src/unlock/view/meter.ts extension/src/unlock/view/words.ts
git commit -m "feat(extension): the vault page’s dependencies, its rule-6 gate and its DOM helpers (hold, meter, cooldown, words)" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 5: The page shell and the gates: the design classes regenerated, `unlock.css`, the icon sprite, no markup, the vault-page class and font rules, the ancestor-aware check

**Files:**
- Modify: `extension/scripts/__tests__/check-classes.test.mjs`
- Modify: `extension/scripts/__tests__/check-fonts.test.mjs`
- Modify: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Modify: `extension/scripts/check-classes.mjs`
- Modify: `extension/scripts/check-fonts.mjs`
- Modify: `extension/scripts/check-vault-isolation.mjs`
- Create: `extension/src/__tests__/styled.test.ts`
- Create: `extension/src/__tests__/styled.ts`
- Modify: `extension/src/styles/design-ext.css`
- Create: `extension/src/unlock/__tests__/unlockCss.test.ts`
- Modify: `extension/src/unlock/main.ts`
- Create: `extension/src/unlock/unlock.css`
- Modify: `extension/src/unlock/view/dom.ts`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Task 4; plan 1's gates and the extraction script (`docs/superpowers/plans/2026-09-29-extension-b1b2a-plan1.md`, Task 10 Step 3).
- Produces:
  - `extension/src/styles/design-ext.css` (regenerated, 1 040 lines, sha256 `ec0e160148042f4304796285a7c64dc3975c314e7a103414d75ff1850ccf5444`); `extension/src/unlock/unlock.css` (new)
  - `scripts/check-vault-isolation.mjs`: `SETS_MARKUP`; `scripts/check-classes.mjs`: `VAULT_SHEETS`, `vaultClassUses(src, html)`, `listVaultFiles(root?)`, `vaultClassViolations(files?, defined?)`; `scripts/check-fonts.mjs`: `vaultPageFontViolations(distApp)`
  - `src/__tests__/styled.ts`: `selectorsOf(sheets)`, `unstyledClasses(root, selectors)`, `VAULT_PAGE_SHEETS`, `UI_SHEETS`

Spec §1.2 item 1: the vault page imports two stylesheets — web's `design-system.css` (tokens, type, buttons) and `design-ext.css` (the design's screen classes) — plus its own `src/unlock/unlock.css` (only what the mockups cannot say: the 412 px tab column, the password field that replaces the keypad (D7), the length meter, the mockups' inline spacing, under `vlt-` names). `design-ext.css` is **generated** (plan-1 lesson): Step 3 regenerates it with plan 1's extraction script plus plan 2's prefixes (the vault screens' classes and #7/#40's), and pins the hash. `unlock.css`'s first rule makes `[hidden]` win: the design's classes set `display` (`.screen`, `.sticky-bar`, `.auto-blur-chip` …), which beats the browser's own `[hidden]` rule — without it every screen renders at once (the dry run's E2E found it; happy-dom has no layout, so a test pins the rule). `unlock.html` gains the design's icon sprite (the symbols the page uses, copied from `index.html`) and the column (`main#vault.vlt-col`); `main.ts` imports the three stylesheets.

The gates (each rule with fixtures in `scripts/__tests__`):
- **vault isolation:** no file in `src/unlock` may write markup (`SETS_MARKUP`); fixtures put a `src/app` import, `react`, `react-dom/client` and a `web/src/ui` component inside plan 2's new folders (`src/unlock/view/`, `src/unlock/screens/`) — each fails; the real walk reaches `unlock.css` and both shared sheets (positive control). The stand-alone rule now ignores prose a loose pattern reads as an import ("Continue to import" in `strings.ts`, Task 12) — a real import still fails.
- **classes:** `unlock.html` and `src/unlock/**/*.ts` against the vault page's three sheets (`VAULT_SHEETS`); a vault-page class must be one literal string (`h(tag, '…')`, `className = '…'`, `classList.*('…')`), the DOM helper's own `el.className = cls` excepted. Its comment names the known blind spot: `h()`'s tag is matched only as a single-quoted literal, the one form Prettier writes (plan-2 review L8).
- **fonts:** the stylesheets `unlock.html` links must load `fonts/Geist-Variable.woff2` (`vaultPageFontViolations`).
- **ancestor-aware coverage (new, test-side, plan-1 lesson):** `src/__tests__/styled.ts` — for every rendered element and each class, some selector naming it must match the element where it stands (pseudo parts stripped; a scope class may match through a descendant). Every DOM test of plan 2 asserts `unstyled(…) == []` on the screen it rendered.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-classes.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-classes.test.mjs b/extension/scripts/__tests__/check-classes.test.mjs
index a63c36c..e599cd4 100644
--- a/extension/scripts/__tests__/check-classes.test.mjs
+++ b/extension/scripts/__tests__/check-classes.test.mjs
@@ -1,6 +1,6 @@
 import {dirname, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
-import {DYNAMIC, SHEETS, classUses, classViolations, definedClasses, listScreens} from '../check-classes.mjs';
+import {DYNAMIC, SHEETS, VAULT_SHEETS, classUses, classViolations, definedClasses, listScreens, listVaultFiles, vaultClassUses, vaultClassViolations} from '../check-classes.mjs';
 
 // Every class a screen names must be styled by one of the three stylesheets the app loads
 // (design-system.css, design-ext.css, app.css): a class defined nowhere is a design element that
@@ -70,3 +70,37 @@ describe('the class gate: the app', () => {
     expect(classViolations()).toEqual([]);
   });
 });
+
+// Plan 2: the vault page (unlock.html + src/unlock) is plain DOM; its classes are checked against the
+// three stylesheets it loads, and a class there must be a literal.
+describe('the class gate: the vault page', () => {
+  it('reads class="" in the page, and h(tag, …), className = … and classList calls in its code', () => {
+    expect(vaultClassUses('<section class="screen s-welcome" hidden><p class=\'noc-caption terms\'>x</p></section>', true)).toEqual({classes: ['screen', 's-welcome', 'noc-caption', 'terms'], computed: []});
+    const code = "h('div', 'word');\nh('span', 'num', two(i));\nel.className = 'slot filled';\nbar.classList.toggle('filled', on);\nel.classList.add('is-error');";
+    expect(vaultClassUses(code, false)).toEqual({classes: ['word', 'num', 'slot', 'filled', 'filled', 'is-error'], computed: []});
+  });
+
+  it('refuses a planted class and a computed one; accepts the DOM helper’s own parameter, there only', () => {
+    const files = [
+      {path: 'unlock.html', text: '<div class="screen vlt-planted-nowhere"></div>'},
+      {path: 'src/unlock/screens/x.ts', text: "h('div', tone);\nel.className = `slot ${state}`;"},
+      {path: 'src/unlock/view/dom.ts', text: 'if (cls !== \'\') el.className = cls;'},
+      {path: 'src/unlock/view/other.ts', text: 'el.className = cls;'},
+    ];
+    expect(vaultClassViolations(files, new Set(['screen']))).toEqual([
+      'unlock.html: class "vlt-planted-nowhere" is defined in no stylesheet the vault page loads',
+      'src/unlock/screens/x.ts: computed class tone — the vault page names classes as literal strings only',
+      'src/unlock/screens/x.ts: computed class `slot ${state}` — the vault page names classes as literal strings only',
+      'src/unlock/view/other.ts: computed class cls — the vault page names classes as literal strings only',
+    ]);
+  });
+
+  it('reads unlock.html and every src/unlock module but the tests; the real page passes', () => {
+    const files = listVaultFiles(ROOT);
+    expect(files[0]).toBe('unlock.html');
+    expect(files).toEqual(expect.arrayContaining(['src/unlock/main.ts', 'src/unlock/view/dom.ts']));
+    expect(files.some(f => f.includes('__tests__'))).toBe(false);
+    expect(VAULT_SHEETS).toEqual(['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/unlock/unlock.css']);
+    expect(vaultClassViolations()).toEqual([]);
+  });
+});
```

Modify `extension/scripts/__tests__/check-fonts.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-fonts.test.mjs b/extension/scripts/__tests__/check-fonts.test.mjs
index dfd1339..8fa4754 100644
--- a/extension/scripts/__tests__/check-fonts.test.mjs
+++ b/extension/scripts/__tests__/check-fonts.test.mjs
@@ -1,7 +1,7 @@
 import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
 import {tmpdir} from 'node:os';
 import {join} from 'node:path';
-import {fontViolations} from '../check-fonts.mjs';
+import {fontViolations, vaultPageFontViolations} from '../check-fonts.mjs';
 
 describe('the font gate', () => {
   let dir;
@@ -34,3 +34,32 @@ describe('the font gate', () => {
     expect(fontViolations(dir)).toContain('INCONCLUSIVE: no built CSS loads fonts/Geist-Variable.woff2');
   });
 });
+
+describe('the font gate: the vault page (plan 2)', () => {
+  let dir;
+  const write = (rel, text) => {
+    mkdirSync(join(dir, rel, '..'), {recursive: true});
+    writeFileSync(join(dir, rel), text);
+  };
+  beforeEach(() => {
+    dir = mkdtempSync(join(tmpdir(), 'fonts-vault-'));
+  });
+  afterEach(() => rmSync(dir, {recursive: true, force: true}));
+
+  it('passes when a stylesheet unlock.html links names fonts/Geist-Variable.woff2', () => {
+    write('unlock.html', '<head><link rel="stylesheet" crossorigin href="./assets/unlock-1.css"></head>');
+    write('assets/unlock-1.css', '@font-face{src:url(../fonts/Geist-Variable.woff2)}');
+    expect(vaultPageFontViolations(dir)).toEqual([]);
+  });
+
+  it('fails a vault page with no stylesheet, or one that loads no Geist', () => {
+    write('unlock.html', '<head></head>');
+    expect(vaultPageFontViolations(dir)).toHaveLength(1);
+    write('unlock.html', '<head><link rel="stylesheet" href="./assets/unlock-1.css"></head>');
+    write('assets/unlock-1.css', '.x{color:red}');
+    expect(vaultPageFontViolations(dir)).toEqual(['unlock.html loads no stylesheet that names fonts/Geist-Variable.woff2 — the vault page would render in a fallback font']);
+    // Another bundled face is not Geist: the mono face alone still fails.
+    write('assets/unlock-1.css', '@font-face{src:url(../fonts/GeistMono-Variable.woff2)}');
+    expect(vaultPageFontViolations(dir)).toHaveLength(1);
+  });
+});
```

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index e20546e..93a6aa6 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -765,6 +765,13 @@ describe('stand-alone modules (review M4)', () => {
     expect(sourceViolations([f('src/shared/amount.ts', 'export const parse = (s: string) => s;'), f('src/unlock/strings.ts', "export const S = 'x';")])).toEqual([]);
   });
 
+  it('prose that reads like an import in the vault page’s strings is not one; a real import still is', () => {
+    expect(sourceViolations([f('src/unlock/strings.ts', "export const S = {next: 'Continue to import', b: 'import screen'};")])).toEqual([]);
+    for (const code of ["import {x} from './y';", "import './y';", "const y = import('./y');", "export {x} from '../app/x';"]) {
+      expect(sourceViolations([f('src/unlock/strings.ts', code)])).toEqual(['src/unlock/strings.ts: imports a module — it must stand alone']);
+    }
+  });
+
   it('a src/shared file may not import src/app or ../web', () => {
     expect(sourceViolations([f('src/shared/x.ts', "import {App} from '../app/x';")])).toEqual([
       'src/shared/x.ts: imports UI code (src/app, ../web) — src/shared is vault-page reachable',
@@ -772,3 +779,67 @@ describe('stand-alone modules (review M4)', () => {
     expect(sourceViolations([f('src/shared/x.ts', "import {Icon} from '../../../web/src/ui/Icon';")])).toHaveLength(1);
   });
 });
+
+// Plan 2 (B1b-2a-2): the vault-page screens are built from src/unlock/view and src/unlock/screens.
+// The boundary is the allowlist above, walked from the real entry; these fixtures put the two
+// imports it exists to stop — UI code and React — inside the new folders.
+describe('plan 2: the vault-page screens stay inside the boundary', () => {
+  const tree = files => [p => files[p], p => p in files];
+  const ENTRY = "import {start} from './screens/welcome';";
+
+  it('a view helper importing an app component fails the gate', () => {
+    const [read, exists] = tree({
+      'src/unlock/main.ts': ENTRY,
+      'src/unlock/screens/welcome.ts': "import {banner} from '../view/banner';",
+      'src/unlock/view/banner.ts': "import {Banner} from '../../app/ui/Banner';",
+      'src/app/ui/Banner.tsx': '',
+    });
+    expect(vaultPageViolations(read, exists)).toEqual(['the vault page reaches src/app/ui/Banner.tsx — only vault-page code may be bundled with the seed']);
+  });
+
+  it('a screen importing React (or react-dom) fails the gate; so does a web/src/ui component', () => {
+    const [read, exists] = tree({
+      'src/unlock/main.ts': ENTRY,
+      'src/unlock/screens/welcome.ts': "import {useState} from 'react';\nimport {createRoot} from 'react-dom/client';\nimport {AddressGroups} from '../../../../web/src/ui/AddressGroups';",
+      '../web/src/ui/AddressGroups.tsx': '',
+    });
+    expect(vaultPageViolations(read, exists)).toEqual([
+      'src/unlock/screens/welcome.ts: the vault page imports the package react',
+      'src/unlock/screens/welcome.ts: the vault page imports the package react-dom/client',
+      'the vault page reaches ../web/src/ui/AddressGroups.tsx — only vault-page code may be bundled with the seed',
+    ]);
+  });
+
+  it('the real vault page reaches its own stylesheet and the two shared ones (positive control)', () => {
+    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
+    const read = rel => {
+      try {
+        return readFileSync(join(root, rel), 'utf8');
+      } catch {
+        return undefined;
+      }
+    };
+    // A stylesheet is resolved (exists) but never read: record what the walk resolved.
+    const resolved = [];
+    expect(
+      vaultPageViolations(read, rel => {
+        const hit = read(rel) !== undefined;
+        if (hit) resolved.push(rel);
+        return hit;
+      }),
+    ).toEqual([]);
+    expect(resolved).toEqual(expect.arrayContaining(['src/unlock/unlock.css', 'src/styles/design-ext.css', '../web/src/styles/design-system.css']));
+  });
+
+  it.each(['el.innerHTML = s;', 'el.outerHTML = s;', "el.insertAdjacentHTML('beforeend', s);", 'range.createContextualFragment(s);', 'new DOMParser();', 'document.write(s);', 'document.writeln(s);', 'frame.srcdoc = s;'])(
+    'the vault page may not write markup: %s',
+    code => {
+      expect(sourceViolations([f('src/unlock/view/x.ts', code)])).toEqual(['src/unlock/view/x.ts: writes markup — the vault page sets text only (textContent)']);
+    },
+  );
+
+  it('textContent is allowed, and the rule is the vault page’s alone (negative controls)', () => {
+    expect(sourceViolations([f('src/unlock/view/x.ts', 'el.textContent = s; el.replaceChildren(a);')])).toEqual([]);
+    expect(sourceViolations([f('src/app/x.tsx', 'el.innerHTML = s;')])).toEqual([]);
+  });
+});
```

Create `extension/src/__tests__/styled.test.ts`:

```ts
// @vitest-environment happy-dom
import {UI_SHEETS, VAULT_PAGE_SHEETS, selectorsOf, unstyledClasses} from './styled';

describe('ancestor-aware class coverage (plan-1 lesson: the class gate ignores ancestor context)', () => {
  const sels = ['.s8-success-hero .ring', '.banner', '.banner.info svg', '.btn:hover', '.copy-btn::before'];
  const html = (markup: string) => {
    const root = document.createElement('div');
    root.innerHTML = markup;
    return root;
  };

  it('a class styled only under an ancestor passes inside it and fails outside it', () => {
    expect(unstyledClasses(html('<div class="s8-success-hero"><div class="ring"></div></div>').firstElementChild!, ['.s8-success-hero', ...sels])).toEqual([]);
    expect(unstyledClasses(html('<div class="s-success"><div class="ring"></div></div>').firstElementChild!, ['.s-success', ...sels])).toEqual(['div.ring: .ring matches no rule in place']);
  });

  it('a scope class counts when a rule it scopes matches inside it — and not when nothing inside matches', () => {
    expect(unstyledClasses(html('<section class="s8-success-hero"><i class="ring"></i></section>').firstElementChild!, sels)).toEqual([]);
    expect(unstyledClasses(html('<section class="s8-success-hero"><i></i></section>').firstElementChild!, sels)).toEqual(['section.s8-success-hero: .s8-success-hero matches no rule in place']);
  });

  it('sibling combinators match as written (".ring + .timer")', () => {
    const root = html('<div class="cooldown-card"><div class="ring"></div><div class="timer"></div></div>').firstElementChild!;
    expect(unstyledClasses(root, ['.cooldown-card', '.cooldown-card .ring', '.cooldown-card .ring + .timer'])).toEqual([]);
    const apart = html('<div class="cooldown-card"><div class="ring"></div><i></i><div class="timer"></div></div>').firstElementChild!;
    expect(unstyledClasses(apart, ['.cooldown-card', '.cooldown-card .ring', '.cooldown-card .ring + .timer'])).toEqual(['div.timer: .timer matches no rule in place']);
  });

  it('pseudo-classes and pseudo-elements count as styling the element', () => {
    expect(unstyledClasses(html('<button class="btn"></button>').firstElementChild!, sels)).toEqual([]);
    expect(unstyledClasses(html('<i class="copy-btn"></i>').firstElementChild!, sels)).toEqual([]);
  });

  it('reads the real stylesheets: the design classes the vault page and the UI rely on are there', () => {
    const vault = selectorsOf(VAULT_PAGE_SHEETS);
    expect(vault).toEqual(expect.arrayContaining(['.s-seed .seed-grid .word', '.cooldown-card .ring', '.vlt-col']));
    const ui = selectorsOf(UI_SHEETS);
    expect(ui).toEqual(expect.arrayContaining(['.s8-success-hero .ring', '.s-success .addr-card']));
    expect(vault.some(s => s.startsWith('@') || s === 'from')).toBe(false);
  });
});
```

Create `extension/src/__tests__/styled.ts`:

```ts
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

/**
 * The class gate (scripts/check-classes.mjs) asks only whether a class appears in SOME selector; it
 * cannot see that `.ring` is styled only under `.s8-success-hero` (plan-1 lesson: a #21 StatusPill
 * outside `.s-txd` would pass it unstyled). This check is the ancestor-aware half, run on what a
 * test actually rendered: for every element and each of its classes, some selector naming that
 * class must MATCH the element where it stands (pseudo-classes and pseudo-elements stripped, so
 * `:hover` / `::before` rules count) — or, for a scope class such as `.s-secintro` that only appears
 * as an ancestor (`.s-secintro .layer-card`), match a descendant of it. A class that does neither
 * renders as nothing.
 */
const PKG = join(__dirname, '..', '..');

/** Every selector in the given stylesheets (package-relative paths), @-rule preludes and keyframe steps excluded. */
export function selectorsOf(sheets: readonly string[]): string[] {
  const out: string[] = [];
  for (const sheet of sheets) {
    const css = readFileSync(join(PKG, sheet), 'utf8').replace(/\/\*[\s\S]*?\*\//g, ' ');
    for (const m of css.matchAll(/([^{}]+)\{/g)) {
      const prelude = (m[1] ?? '').trim();
      if (prelude === '' || prelude.startsWith('@')) continue;
      for (const sel of prelude.split(',')) {
        const s = sel.trim();
        if (s !== '' && !/^(from|to|\d+(\.\d+)?%)$/.test(s)) out.push(s);
      }
    }
  }
  return out;
}

/** The selector without pseudo-classes and pseudo-elements; a compound they emptied becomes `*`. */
function structural(selector: string): string {
  const s = selector
    .replace(/::?[a-zA-Z-]+(\((?:[^()]|\([^()]*\))*\))?/g, ' ')
    .replace(/\s*([>+~])\s*/g, ' $1 ')
    .replace(/\s+/g, ' ')
    .trim();
  const parts = s === '' ? [] : s.split(' ');
  const out: string[] = [];
  for (const p of parts) {
    const comb = p === '>' || p === '+' || p === '~';
    const prev = out[out.length - 1];
    if (comb && (prev === undefined || prev === '>' || prev === '+' || prev === '~')) out.push('*');
    out.push(p);
  }
  const last = out[out.length - 1];
  if (last === undefined || last === '>' || last === '+' || last === '~') out.push('*');
  return out.join(' ');
}

/** "div.word > .term" — enough to find the element in a failure message. */
function describe(el: Element): string {
  const id = el.id === '' ? '' : `#${el.id}`;
  return `${el.tagName.toLowerCase()}${id}.${[...el.classList].join('.')}`;
}

/** One line per (element, class) under `root` (inclusive) that no selector styles where it stands. */
export function unstyledClasses(root: Element, selectors: readonly string[]): string[] {
  const out: string[] = [];
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const c of el.classList) {
      const named = new RegExp(`\\.${c.replace(/[^\w-]/g, '\\$&')}(?![\\w-])`);
      const ok = selectors.some(s => {
        if (!named.test(s)) return false;
        try {
          const sel = structural(s);
          // matches() on each descendant: a selector's ancestors may lie above `el` (querySelector
          // would scope them to the subtree).
          return el.matches(sel) || [...el.querySelectorAll('*')].some(d => d.matches(sel));
        } catch {
          return false;
        }
      });
      if (!ok) out.push(`${describe(el)}: .${c} matches no rule in place`);
    }
  }
  return out;
}

/** The vault page's stylesheets (src/unlock/main.ts's imports) and the UI's (src/app/mount.tsx's). */
export const VAULT_PAGE_SHEETS = ['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/unlock/unlock.css'] as const;
export const UI_SHEETS = ['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/app/app.css'] as const;
```

Create `extension/src/unlock/__tests__/unlockCss.test.ts`:

```ts
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

// The vault page shows and hides with the `hidden` attribute, and the design's classes set `display`
// (.screen, .sticky-bar, .auto-blur-chip …), which beats the browser's own [hidden] rule: without this
// rule every screen renders at once. happy-dom has no layout, so only a real browser shows it (found by
// the plan's E2E dry run); this pins the fix.
it('unlock.css makes the hidden attribute win over the design classes', () => {
  const css = readFileSync(join(__dirname, '..', 'unlock.css'), 'utf8');
  expect(css).toMatch(/\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/);
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run scripts/__tests__/check-classes.test.mjs scripts/__tests__/check-fonts.test.mjs scripts/__tests__/check-vault-isolation.test.mjs src/__tests__/styled.test.ts src/__tests__/styled.ts src/unlock/__tests__/unlockCss.test.ts`
Expected (dry run): FAIL — Test Files 5 failed (5) Tests 17 failed | 148 passed (165) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Regenerate `extension/src/styles/design-ext.css` — **never by hand** (plan-1 lesson). Take plan 1's one-off extraction script (`docs/superpowers/plans/2026-09-29-extension-b1b2a-plan1.md`, Task 10 Step 3: the `js` block that starts `// One-off: copy the design classes`), save it **outside the repository**, and extend its `PREFIXES` array by exactly these entries (the vault screens' classes and #7's and #40's):

```js
  // Plan 2 (B1b-2a-2): the vault-page screens #1–#6, #8–#10, #39 and the UI tab's #7 and #40.
  '.card', '.trust-chip', '.s-welcome', '.s-secintro', '.s-seed', '.s-seed-modal', '.s-confirm', '.s-pin', '.cooldown-card', '.s-bio', '.s-success', '.s-import',
  '.s8-step-card', '.s8-success-hero', '.s8-recovered-card', '.s8-addr-chip',
```

Run it from the repository root, then check:

```bash
node /path/to/extract-design-css.mjs
sha256sum extension/src/styles/design-ext.css; wc -l extension/src/styles/design-ext.css
git diff --stat extension/src/styles/design-ext.css
```
Expected: `ec0e160148042f4304796285a7c64dc3975c314e7a103414d75ff1850ccf5444`, `1040`, and `429 insertions(+)` with **no deletion** — plan 1's rules are unchanged; only the new prefixes' rules are added. (Before extending the array, the unchanged script must reproduce plan 1's `22f5aec5…3771`; a different hash means `index.html` changed: stop and ask the controller.)

Modify `extension/scripts/check-classes.mjs`:

```diff
diff --git a/extension/scripts/check-classes.mjs b/extension/scripts/check-classes.mjs
index 215d6a6..69177c4 100644
--- a/extension/scripts/check-classes.mjs
+++ b/extension/scripts/check-classes.mjs
@@ -185,12 +185,81 @@ export function classViolations(files = listScreens().map(path => ({path, text:
   return out;
 }
 
+// ── The vault page (plan 2) ───────────────────────────────────────────────────────────────────
+// unlock.html and src/unlock are plain DOM (spec S1): no className= JSX. The page names classes in
+// its markup (`class="…"`) and in code only through the DOM helper `h(tag, '…')`, `.className = '…'`
+// and `classList.add|remove|toggle('…')`. In the vault page a class must be one literal string: a
+// computed one is refused outright (nothing to list, nothing to check).
+
+/** `h` itself assigns its parameter (`el.className = cls`): the one computed class the gate accepts, there only. */
+const HELPER = {path: 'src/unlock/view/dom.ts', expr: 'cls'};
+
+/** The stylesheets src/unlock/main.ts imports, relative to the package. */
+export const VAULT_SHEETS = ['../web/src/styles/design-system.css', 'src/styles/design-ext.css', 'src/unlock/unlock.css'];
+
+/**
+ * Classes named in unlock.html (`html: true`) or in a src/unlock module, and any computed class expression.
+ * Known blind spot: h()'s tag is matched only as a single-quoted literal (`h('div', …)`, the one form
+ * Prettier writes today); a template-literal or computed tag hides that call's class from this gate.
+ */
+export function vaultClassUses(src, html) {
+  const classes = [];
+  const computed = [];
+  if (html) {
+    for (const m of src.matchAll(/\bclass\s*=\s*(["'])([^"']*)\1/g)) classes.push(...words(m[2]));
+    return {classes, computed};
+  }
+  const take = arg => {
+    const a = arg.trim();
+    const lit = /^(['"])([^'"]*)\1$/.exec(a);
+    if (lit) classes.push(...words(lit[2]));
+    else computed.push(a);
+  };
+  for (const m of src.matchAll(/\bh\(\s*'[a-z0-9]+'\s*,\s*([^,)]+)/g)) take(m[1]);
+  for (const m of src.matchAll(/\.className\s*=\s*([^;\n]+)/g)) take(m[1]);
+  for (const m of src.matchAll(/\bclassList\.(?:add|remove|toggle)\(\s*([^,)]+)/g)) take(m[1]);
+  return {classes, computed};
+}
+
+/** unlock.html and every .ts under src/unlock/ except the tests, relative to the package. */
+export function listVaultFiles(root = ROOT) {
+  const out = [];
+  const walkTs = dir => {
+    for (const e of readdirSync(dir, {withFileTypes: true})) {
+      if (e.name === '__tests__') continue;
+      const p = join(dir, e.name);
+      if (e.isDirectory()) walkTs(p);
+      else if (e.name.endsWith('.ts')) out.push(relative(root, p).split(sep).join('/'));
+    }
+  };
+  if (existsSync(join(root, 'src', 'unlock'))) walkTs(join(root, 'src', 'unlock'));
+  return ['unlock.html', ...out.sort()];
+}
+
+function loadVaultDefined() {
+  const all = new Set();
+  for (const sheet of VAULT_SHEETS) for (const c of definedClasses(readFileSync(join(ROOT, sheet), 'utf8'))) all.add(c);
+  return all;
+}
+
+/** One line per vault-page class defined in no vault stylesheet, and per computed class. */
+export function vaultClassViolations(files = listVaultFiles().map(path => ({path, text: readFileSync(join(ROOT, path), 'utf8')})), defined = loadVaultDefined()) {
+  const out = [];
+  for (const {path, text} of files) {
+    const {classes, computed} = vaultClassUses(text, path.endsWith('.html'));
+    for (const c of new Set(classes)) if (!defined.has(c)) out.push(`${path}: class "${c}" is defined in no stylesheet the vault page loads`);
+    for (const e of computed) if (e !== "''" && !(path === HELPER.path && e === HELPER.expr)) out.push(`${path}: computed class ${e} — the vault page names classes as literal strings only`);
+  }
+  return out;
+}
+
 if (import.meta.url === `file://${process.argv[1]}`) {
   const files = listScreens();
-  const problems = classViolations();
+  const vaultFiles = listVaultFiles();
+  const problems = [...classViolations(), ...vaultClassViolations()];
   if (problems.length > 0) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log(`classes ok: every class in ${files.length} src/app files is defined by ${SHEETS.join(', ')}`);
+  console.log(`classes ok: every class in ${files.length} src/app files is defined by ${SHEETS.join(', ')}; every class in ${vaultFiles.length} vault-page files by ${VAULT_SHEETS.join(', ')}`);
 }
```

Modify `extension/scripts/check-fonts.mjs`:

```diff
diff --git a/extension/scripts/check-fonts.mjs b/extension/scripts/check-fonts.mjs
index 2488242..80f0ad7 100644
--- a/extension/scripts/check-fonts.mjs
+++ b/extension/scripts/check-fonts.mjs
@@ -6,7 +6,8 @@
 // Measured in the plan's dry run: with `base: './'`, Vite rewrites the absolute `/fonts/…` of a
 // public/ asset to `../fonts/…`, relative to the CSS file in assets/ — not "stays /fonts/…" as the
 // spec assumed. Both forms land on dist/app/fonts/, so both are accepted; what is checked is where the
-// URL resolves. Plan 2 adds the vault page's CSS, which the same rule covers.
+// URL resolves. Plan 2 adds the vault page's CSS, which the same rule covers, and checks that the
+// vault page's own stylesheets load Geist (vaultPageFontViolations).
 import {existsSync, readdirSync, readFileSync} from 'node:fs';
 import {dirname, join, posix, resolve} from 'node:path';
 import {fileURLToPath} from 'node:url';
@@ -37,11 +38,31 @@ export function fontViolations(distApp) {
   return out;
 }
 
+/**
+ * Plan 2: the vault page itself must load Geist — the stylesheets unlock.html links (Vite injects
+ * them) must name fonts/Geist-Variable.woff2. The rule above checks the URLs wherever they are; this
+ * checks the vault page really gets the design's type, not the browser's fallback.
+ */
+export function vaultPageFontViolations(distApp) {
+  const page = join(distApp, 'unlock.html');
+  if (!existsSync(page)) return ['unlock.html is missing from the build'];
+  const html = readFileSync(page, 'utf8');
+  for (const m of html.matchAll(/<link\b[^>]*\brel\s*=\s*["']stylesheet["'][^>]*>/gi)) {
+    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1];
+    if (href === undefined || /^[a-z][a-z0-9+.-]*:|^\/\//i.test(href)) continue;
+    const css = join(distApp, posix.normalize(href.replace(/^\//, '')));
+    if (!existsSync(css)) continue;
+    for (const u of readFileSync(css, 'utf8').matchAll(/url\(\s*['"]?([^'")]+\.woff2)['"]?\s*\)/g)) if (target(u[1]) === 'fonts/Geist-Variable.woff2') return [];
+  }
+  return ['unlock.html loads no stylesheet that names fonts/Geist-Variable.woff2 — the vault page would render in a fallback font'];
+}
+
 if (import.meta.url === `file://${process.argv[1]}`) {
-  const problems = fontViolations(join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist', 'app'));
+  const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'dist', 'app');
+  const problems = [...fontViolations(dist), ...vaultPageFontViolations(dist)];
   if (problems.length > 0) {
     for (const p of problems) console.error(p);
     process.exit(1);
   }
-  console.log('fonts ok: both Geist files are in dist/app/fonts and every font URL in the CSS resolves there');
+  console.log('fonts ok: both Geist files are in dist/app/fonts, every font URL in the CSS resolves there, and the vault page loads Geist');
 }
```

Modify `extension/scripts/check-vault-isolation.mjs`:

```diff
diff --git a/extension/scripts/check-vault-isolation.mjs b/extension/scripts/check-vault-isolation.mjs
index 4f66ad6..a151523 100644
--- a/extension/scripts/check-vault-isolation.mjs
+++ b/extension/scripts/check-vault-isolation.mjs
@@ -74,6 +74,9 @@ const LISTEN_ALLOWED = /^src\/background\//;
 // B1b-2a E4 adds the two caches: a popup writing one could show a balance the chain never had.
 export const BACKGROUND_OWNED_KEYS = ['v1_settings', 'v1_known_recipients', 'v1_pending', 'v1_forbidden_until', 'v1_balance_cache', 'v1_price_cache'];
 const BACKGROUND_OWNED_ALLOWED = /^src\/background\//;
+// The vault page renders only fixed strings and the user's own words, as text (B1b-2a §1.2 item 3):
+// no file in src/unlock may parse or write markup, so nothing it shows can become an element.
+export const SETS_MARKUP = /\b(?:innerHTML|outerHTML|insertAdjacentHTML|createContextualFragment|DOMParser|srcdoc)\b|\bdocument\s*\.\s*write(?:ln)?\b/;
 
 // A string that exists only in the vault's envelope code (the passkey-wrap HKDF info).
 export const VAULT_MARKER = 'noctura-ext-v1/passkey-wrap';
@@ -242,7 +245,9 @@ export function sourceViolations(files) {
     if (!VAULT_ALLOWED.test(path) && values.some(r => namesVault(path, r.spec))) out.push(`${path}: imports the vault`);
     if (!VAULT_ALLOWED.test(path) && values.some(r => namesCoreKeys(path, r.spec))) out.push(`${path}: imports core/keys (seed code)`);
     if (!UNLOCK_ALLOWED.test(path) && values.some(r => namesUnlock(path, r.spec))) out.push(`${path}: imports the vault page (src/unlock)`);
-    if (STANDALONE.includes(path) && values.length > 0) out.push(`${path}: imports a module — it must stand alone`);
+    // A module specifier has no spaces or operators: prose a loose pattern matched ('Continue to import',
+    // in the vault page's own strings) is not an import (the vault-page walk filters the same way).
+    if (STANDALONE.includes(path) && values.some(r => MODULE_SPECIFIER.test(r.spec) || BACKSLASH_SPECIFIER.test(r.spec))) out.push(`${path}: imports a module — it must stand alone`);
     // src/shared/ is reachable from the vault page: it may never reach UI code (B1b-2a M4).
     // Deliberately all references, type-only ones too — stricter than the stand-alone rule above.
     if (/^src\/shared\//.test(path) && moduleReferences(text).some(r => namesUiCode(path, r.spec))) out.push(`${path}: imports UI code (src/app, ../web) — src/shared is vault-page reachable`);
@@ -256,6 +261,7 @@ export function sourceViolations(files) {
       out.push(`${path}: imports ${LOCAL_READER}, the vault page's storage reader`);
     }
     if (!LISTEN_ALLOWED.test(path) && LISTENS_RUNTIME.test(text)) out.push(`${path}: listens for runtime messages outside the background`);
+    if (UNLOCK_ALLOWED.test(path) && SETS_MARKUP.test(text)) out.push(`${path}: writes markup — the vault page sets text only (textContent)`);
     if (!BACKGROUND_OWNED_ALLOWED.test(path)) {
       for (const key of BACKGROUND_OWNED_KEYS) if (text.includes(key)) out.push(`${path}: names ${key}, which only the background may write`);
     }
```

Modify `extension/src/unlock/main.ts`:

```diff
diff --git a/extension/src/unlock/main.ts b/extension/src/unlock/main.ts
index 17068c2..bc2af30 100644
--- a/extension/src/unlock/main.ts
+++ b/extension/src/unlock/main.ts
@@ -1,3 +1,8 @@
+// The design's look, and nothing else from outside the vault (spec B1b-2a §1.2 item 1): stylesheets
+// carry no code. Tokens and type first, then the design's screen classes, then this page's layout.
+import '../../../web/src/styles/design-system.css';
+import '../styles/design-ext.css';
+import './unlock.css';
 import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';
 import {attemptPasskeyUnlock, attemptUnlock, createWrongBackoff, runExclusive, type BusyGate, type Outcome} from './orchestrate';
 import {workerKdf} from '../vault/kdf';
```

Create `extension/src/unlock/unlock.css`:

```css
/*
 * The vault page's own layout (spec B1b-2a §1.1: "full tab; a 412 px column centred on --bg-base"), on
 * top of web's design-system.css (tokens, type, buttons) and design-ext.css (the design's screen
 * classes, extracted from index.html — never edited by hand). Only what the phone mockups cannot say,
 * under `vlt-` names: the tab column, the password field that replaces the design's PIN keypad (D7),
 * the length meter, and the spacing the mockups write inline. Colours are tokens only.
 */

/* `hidden` must hide: the design's classes set `display` (.screen, .sticky-bar, .auto-blur-chip …), and an
   author `display` beats the browser's own [hidden] rule. The page shows and hides with the attribute. */
[hidden] {
  display: none !important;
}

/* The icon sprite takes no room. */
.vlt-sprite {
  position: absolute;
}

/* The column: the design's 412 px phone width, centred, as tall as the tab. */
.vlt-col {
  width: 412px;
  max-width: 100%;
  min-height: 100vh;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  background: var(--bg-base);
}
/* A screen fills the tab and scrolls with it (the mockups clip a fixed phone frame instead). */
.vlt-col > .screen {
  min-height: 100vh;
  overflow: visible;
}
.vlt-col .scroll-area {
  overflow: visible;
}
.vlt-col .sticky-bar {
  position: sticky;
  bottom: 0;
  z-index: 1;
  margin-top: auto;
}
.vlt-col .top-bar .step {
  font-variant-numeric: tabular-nums;
}

/* The mockups' inline spacing and tones, as classes (the CSP allows inline styles; classes keep the
   coverage gate able to see every one). */
.vlt-lede {
  color: var(--fg-secondary);
}
.vlt-muted {
  color: var(--fg-tertiary);
}
.vlt-gap-2 {
  margin: 0 0 var(--space-2);
}
.vlt-gap-4 {
  margin-bottom: var(--space-4);
}
.vlt-gap-6 {
  margin-bottom: var(--space-6);
}
.vlt-pad {
  padding: 0 var(--space-5);
}
.vlt-danger {
  color: var(--danger);
}
.vlt-success {
  color: var(--success);
}
.vlt-center {
  text-align: center;
}
.vlt-grow {
  flex: 1;
}
/* A state message that replaces a screen's content (exists, damaged, no wallet, closed). */
.vlt-notice {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-7) var(--space-6);
  text-align: center;
}
```

Modify `extension/src/unlock/view/dom.ts`:

```diff
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index 623a4bd..5f042a3 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -1,7 +1,7 @@
 /**
  * The vault page's own DOM helpers (spec B1b-2a §1.2 item 2, S1): no React, no UI kit — the page that
- * holds the seed stays small. Text is only ever set with textContent (a gate forbids innerHTML and its
- * kin in src/unlock), so nothing the page shows can become markup.
+ * holds the seed stays small. Text is only ever set with textContent (a gate forbids every way of writing
+ * markup in src/unlock), so nothing the page shows can become an element.
  */
 
 /** An element of unlock.html by id; a missing one is a bug in the page, never a state. */
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 8610d5f..555043f 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -2,10 +2,30 @@
 <html lang="en">
   <head>
     <meta charset="utf-8" />
-    <title>Noctura — unlock</title>
+    <meta name="viewport" content="width=device-width, initial-scale=1" />
+    <title>Noctura</title>
   </head>
   <body>
-    <main>
+    <!-- The design's icons (index.html's sprite, the symbols this page uses), drawn with <use href="#i-…">. -->
+    <svg width="0" height="0" class="vlt-sprite" aria-hidden="true">
+      <defs>
+        <symbol id="i-arrow-left" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></symbol>
+        <symbol id="i-arrow-right" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></symbol>
+        <symbol id="i-shield-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><rect x="9" y="11" width="6" height="6" rx="1.2"/><path d="M10.5 11V9.5a1.5 1.5 0 0 1 3 0V11"/></symbol>
+        <symbol id="i-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 11 7 11 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 1 12s4 7 11 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></symbol>
+        <symbol id="i-eye-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/></symbol>
+        <symbol id="i-key" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="3.5"/><path d="m10 13 9-9 3 3-3 3 2 2-3 3-2-2-3 3"/></symbol>
+        <symbol id="i-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></symbol>
+        <symbol id="i-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></symbol>
+        <symbol id="i-info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></symbol>
+        <symbol id="i-clip" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></symbol>
+        <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></symbol>
+        <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></symbol>
+        <symbol id="i-alert-triangle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>
+        <symbol id="i-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>
+      </defs>
+    </svg>
+    <main id="vault" class="vlt-col">
       <section id="unlock-section">
         <h1>Unlock Noctura</h1>
         <form id="pw">
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run scripts/__tests__/check-classes.test.mjs scripts/__tests__/check-fonts.test.mjs scripts/__tests__/check-vault-isolation.test.mjs src/__tests__/styled.test.ts src/__tests__/styled.ts src/unlock/__tests__/unlockCss.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 88 passed (88) Tests 1126 passed (1126).

- [ ] **Step 5: Build, and run the gates on the real build.**

Run: `npm run build && npm run gates`
Expected: every gate ok — among them `vault isolation ok: …`, `fonts ok: … and the vault page loads Geist`, `classes ok: every class in 28 src/app files … every class in N vault-page files by ../web/src/styles/design-system.css, src/styles/design-ext.css, src/unlock/unlock.css`.

- [ ] **Step 6: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- the no-markup rule removed → RED Tests  8 failed | 138 passed (146)
- computed vault classes allowed → RED Tests  1 failed | 9 passed (10)
- scope classes and descendants ignored (the old, ancestor-blind check) → RED Tests  4 failed | 1 passed (5)
- the vault page takes any bundled font for Geist → RED Tests  1 failed | 3 passed (4)
- [hidden] loses to the design classes → RED Tests  1 failed (1)
- prose in strings.ts counted as an import → RED Tests  1 failed | 145 passed (146)

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/scripts/__tests__/check-classes.test.mjs extension/scripts/__tests__/check-fonts.test.mjs extension/scripts/__tests__/check-vault-isolation.test.mjs extension/scripts/check-classes.mjs extension/scripts/check-fonts.mjs extension/scripts/check-vault-isolation.mjs extension/src/__tests__/styled.test.ts extension/src/__tests__/styled.ts extension/src/styles/design-ext.css extension/src/unlock/__tests__/unlockCss.test.ts extension/src/unlock/main.ts extension/src/unlock/unlock.css extension/src/unlock/view/dom.ts extension/unlock.html
git commit -m "feat(extension): the vault page’s shell — the design classes regenerated, unlock.css, the sprite — and its gates (no markup, classes, fonts, ancestor-aware coverage)" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 6: #1 welcome and #2 security-intro

**Files:**
- Create: `extension/src/unlock/__tests__/pageHarness.ts`
- Create: `extension/src/unlock/__tests__/welcome.test.ts`
- Create: `extension/src/unlock/screens/welcome.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5.
- Produces: `src/unlock/screens/welcome.ts`: `mountWelcome(deps: PageDeps, next: {create(): void; import(): void}): {show(): Promise<void>}`; `mountIntro(next: {back(): void; continue(): void}): {show(): void}`; `strings.ts`: `WELCOME.useIt`; test helpers `loadPage()`, `harness(o)`, `testKdf`, `UNLOCK_SENDER`, `text`, `el`, `visible`, `unstyled(screenId)`, `click`, `type`

Spec §3.1 and §3.2. #1 replaces plan 1's minimal `welcome` section (wired in Task 8). What is stored decides first, and the CTAs stay hidden until the vault read says there is no wallet: a wallet → `exists` ("A wallet already exists in this browser. Nothing was changed." + "Open the Noctura icon to use it.", no CTAs); a damaged vault (null included, Task 1) → "This wallet's stored data is damaged." + "Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase." (controller addition — confirmed by the owner 2026-10-01, Scope 6; the next step per the plan-2 review), no CTAs. Idle: the design's logo, wordmark and tagline; two trust chips (no "ZK-private", D6); the terms line as plain text (B1e); `[Create new wallet]` and `[I have a wallet]`. #2: eyebrow "Onboarding", "1 / 5", the three adapted layer cards (D7, D9), the footer, Continue → #3, back → #1. `src/unlock/__tests__/pageHarness.ts` (new) loads the real `unlock.html` into happy-dom and wires a page to the real background.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/unlock/__tests__/pageHarness.ts`:

```ts
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {argon2idAsync} from '@noble/hashes/argon2.js';
import type {Kdf} from '../../vault/envelope';
import type {CredentialsApi} from '../../vault/passkey';
import {VAULT_KEY} from '../../background/accountsStore';
import {handleMessage} from '../../background/messages';
import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
import {fakeExt} from '../../background/__tests__/fakeExt';
import type {WalletDeps} from '../../background/deps';
import type {BusyGate} from '../orchestrate';
import type {PageDeps, PageTarget} from '../page';
import {backgroundVaultStore} from '../vaultStore';
import type {Send} from '../types';
import {VAULT_PAGE_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {fakeTimers} from './fakeTimers';

/**
 * The real unlock.html, in happy-dom: its <body> without the module script. Screen tests run the
 * screen against this markup, so every string they assert is the page's own — static copy from the
 * HTML, state copy set from strings.ts.
 */
export function loadPage(): void {
  const html = readFileSync(join(__dirname, '..', '..', '..', 'unlock.html'), 'utf8');
  const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1] ?? '';
  document.body.innerHTML = body.replace(/<script\b[\s\S]*?<\/script>/g, '');
}

/** Declares production Argon2id (the envelope refuses less), computes a tiny cost (see envelope.test.ts). */
export const testKdf: Kdf = (pw, salt) => argon2idAsync(pw, salt, {m: 64, t: 1, p: 1, dkLen: 32});
const ORIGIN = 'chrome-extension://abcdefghijklmnopabcdefghijklmnop';
export const UNLOCK_SENDER = {id: 'abcdefghijklmnopabcdefghijklmnop', origin: ORIGIN, url: `${ORIGIN}/unlock.html`};

export interface Harness {
  deps: PageDeps;
  ext: ReturnType<typeof fakeExt>;
  wallet: ReturnType<typeof fakeDeps>;
  timers: ReturnType<typeof fakeTimers>;
  sent: {type: string; [k: string]: unknown}[];
  went: PageTarget[];
  closed: number;
  leave(): void;
  /** Lets pending work run until `done()` holds (the page awaits the background and the KDF); fails after 10 s. */
  until(done: () => boolean): Promise<void>;
}

/**
 * A vault page wired to the REAL background (handleMessage over an in-memory storage, fake chain
 * reader), with a manual clock. `vault` is what v1_vault holds (absent when undefined). `sleep`
 * resolves at once: the 500 ms floor and the backoff waits are asserted through the clock where a
 * test needs them.
 */
export async function harness(o: {vault?: unknown; reader?: Partial<WalletDeps['reader']>; send?: (inner: Send) => Send; credentials?: CredentialsApi; mnemonic?: string} = {}): Promise<Harness> {
  const ext = fakeExt();
  if ('vault' in o && o.vault !== undefined) await ext.local.set(VAULT_KEY, o.vault);
  const wallet = fakeDeps({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => [], ...o.reader})});
  const sent: Harness['sent'] = [];
  const inner: Send = async m => {
    sent.push(JSON.parse(JSON.stringify(m)) as {type: string});
    return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK_SENDER, wallet)) as {ok: boolean; error?: string; data?: unknown};
  };
  const send = o.send === undefined ? inner : o.send(inner);
  const read = () => ext.local.get(VAULT_KEY);
  const timers = fakeTimers();
  let busy = false;
  const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
  const leaves: (() => void)[] = [];
  const h: Harness = {
    ext,
    wallet,
    timers,
    sent,
    went: [],
    closed: 0,
    deps: {
      send,
      store: backgroundVaultStore(send, read),
      kdf: testKdf,
      credentials: o.credentials ?? {create: async () => null, get: async () => null},
      randomBytes: n => crypto.getRandomValues(new Uint8Array(n)),
      newMnemonic: () => o.mnemonic ?? 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
      timers,
      sleep: async () => undefined,
      gate,
      go: t => void h.went.push(t),
      closeTab: () => void (h.closed += 1),
      onLeave: f => void leaves.push(f),
    },
    leave: () => leaves.forEach(f => f()),
    until: async done => {
      const end = Date.now() + 10_000;
      while (!done()) {
        if (Date.now() > end) throw new Error('until: timed out');
        await new Promise(r => setTimeout(r, 1));
      }
    },
  };
  return h;
}

/** The visible text of an element, whitespace collapsed. */
export const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** The element by id, typed. */
export const el = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const e = document.getElementById(id);
  if (e === null) throw new Error(`no #${id}`);
  return e as T;
};

/** Is the element shown: neither it nor an ancestor carries `hidden`. */
export function visible(e: Element | null): boolean {
  for (let x = e; x !== null; x = x.parentElement) if ((x as HTMLElement).hidden) return false;
  return e !== null;
}

const SELECTORS = selectorsOf(VAULT_PAGE_SHEETS);
/** Every class on the screen (shown or not) is styled where it stands (src/__tests__/styled.ts). */
export const unstyled = (screenId: string): string[] => unstyledClasses(el(screenId), SELECTORS);

/** Click, typed as a user event. */
export function click(e: HTMLElement): void {
  e.dispatchEvent(new MouseEvent('click', {bubbles: true}));
}

/** Type into a field: set its value and fire `input`. */
export function type(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  field.value = value;
  field.dispatchEvent(new Event('input', {bubbles: true}));
}
```

Create `extension/src/unlock/__tests__/welcome.test.ts`:

```ts
// @vitest-environment happy-dom
import {createEnvelope} from '../../vault/envelope';
import {mountIntro, mountWelcome} from '../screens/welcome';
import {click, el, harness, loadPage, testKdf, text, unstyled, visible} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';

beforeEach(loadPage);

describe('#1 welcome (spec §3.1)', () => {
  it('idle: the design’s copy, two trust chips (no "ZK-private", D6), plain-text terms, both CTAs', async () => {
    const h = await harness();
    const calls: string[] = [];
    await mountWelcome(h.deps, {create: () => calls.push('create'), import: () => calls.push('import')}).show();
    const screen = el('v-welcome');
    expect(visible(screen)).toBe(true);
    expect(text(screen.querySelector('.wordmark'))).toBe('Noctura');
    expect(text(screen.querySelector('.tagline'))).toBe('A Solana wallet built for private, non-custodial holding.');
    expect([...screen.querySelectorAll('.trust-chip')].map(text)).toEqual(['E2E encrypted', 'Non-custodial']);
    expect(text(screen)).not.toContain('ZK-private');
    expect(text(screen.querySelector('.terms'))).toBe('By continuing you agree to the Terms and Privacy Policy.');
    // "Terms" and "Privacy Policy" are text until the privacy policy exists (release gate, B1e).
    expect(screen.querySelectorAll('a')).toHaveLength(0);
    expect(visible(el('wel-actions'))).toBe(true);
    expect(text(el('wel-create'))).toBe('Create new wallet');
    expect(text(el('wel-import'))).toBe('I have a wallet');
    expect(visible(el('wel-notice'))).toBe(false);
    click(el('wel-create'));
    click(el('wel-import'));
    expect(calls).toEqual(['create', 'import']);
    expect(text(document.body)).not.toMatch(/Screenshots disabled|auto-clears/);
    expect(unstyled('v-welcome')).toEqual([]);
  });

  it('exists: a stored wallet is never set up over — the line, "Open the Noctura icon", no CTAs', async () => {
    const env = await createEnvelope({mnemonic: M, password: 'correct horse battery', scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});
    const h = await harness({vault: env});
    await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
    expect(visible(el('wel-actions'))).toBe(false);
    expect(text(el('wel-notice-line'))).toBe('A wallet already exists in this browser. Nothing was changed.');
    expect(text(el('wel-notice-help'))).toBe('Open the Noctura icon to use it.');
  });

  it('a damaged vault (a stored null, as the background reads it) says so and offers no setup over it', async () => {
    const h = await harness({vault: null});
    await mountWelcome(h.deps, {create: () => undefined, import: () => undefined}).show();
    expect(visible(el('wel-actions'))).toBe(false);
    expect(text(el('wel-notice-line'))).toBe("This wallet's stored data is damaged.");
    expect(text(el('wel-notice-help'))).toBe('Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.');
    expect(h.sent).toEqual([]);
  });
});

describe('#2 security-intro (spec §3.2)', () => {
  it('the three layers with the adapted copy (D7, D9), the step "1 / 5", back and Continue', () => {
    const calls: string[] = [];
    mountIntro({back: () => calls.push('back'), continue: () => calls.push('continue')}).show();
    const screen = el('v-intro');
    expect(visible(screen)).toBe(true);
    expect(text(screen.querySelector('.top-bar .title'))).toBe('Onboarding');
    expect(text(screen.querySelector('.top-bar .step'))).toBe('1 / 5');
    expect(text(screen.querySelector('h1'))).toBe('Three layers protect your wallet');
    expect(text(screen.querySelector('h1 + p'))).toBe('You hold the keys. We never can.');
    expect([...screen.querySelectorAll('.layer-card')].map(c => [text(c.querySelector('h3')), text(c.querySelector('p'))])).toEqual([
      ['Password', 'At least 12 characters you choose. It unlocks the wallet in this browser and is asked again before sends to new addresses or large amounts.'],
      ['Passkey (optional)', 'A fingerprint, face or security key as a shortcut. Your password still works for everything.'],
      ['Recovery seed', "24 words. Written offline. The only way back if this browser's data is lost."],
    ]);
    expect(text(screen)).toContain("If you lose all three, no one — not Noctura, not a Solana validator — can recover your funds. That's the point.");
    expect(text(screen)).not.toMatch(/PIN|Six digits|Biometric/);
    click(el('int-back'));
    click(el('int-continue'));
    expect(calls).toEqual(['back', 'continue']);
    expect(unstyled('v-intro')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/pageHarness.ts src/unlock/__tests__/welcome.test.ts`
Expected (dry run): FAIL — Test Files 1 failed (1) Tests no tests (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Create `extension/src/unlock/screens/welcome.ts`:

```ts
import type {PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, WELCOME} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';

/**
 * #1 welcome (spec §3.1): create or import. What is stored decides first — the page never offers to
 * set up over a wallet (the engine would refuse the write anyway):
 *  - nothing stored → the CTAs;
 *  - a wallet → `exists`: "A wallet already exists in this browser. Nothing was changed." + "Open the
 *    Noctura icon to use it." — no CTAs;
 *  - a damaged vault (null included: the background calls it stored-invalid) → the damaged line and
 *    what still holds, no CTAs; repairing it is #37's (B1b-2b).
 */
export function mountWelcome(deps: PageDeps, next: {create(): void; import(): void}): {show(): Promise<void>} {
  byId('wel-create').addEventListener('click', next.create);
  byId('wel-import').addEventListener('click', next.import);
  const notice = (line: string, help: string) => {
    setText(byId('wel-notice-line'), line);
    setText(byId('wel-notice-help'), help);
    shown(byId('wel-notice'), true);
  };
  return {
    async show() {
      showScreen('v-welcome');
      shown(byId('wel-actions'), false);
      shown(byId('wel-notice'), false);
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        notice(COMMON.unreadable, '');
        return;
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') shown(byId('wel-actions'), true);
      else if (stored.kind === 'wallet') notice(COMMON.exists, WELCOME.useIt);
      else notice(COMMON.damaged, COMMON.damagedHelp);
    },
  };
}

/** #2 security-intro (spec §3.2): three layers; Continue → #3, back → #1. Static copy only. */
export function mountIntro(next: {back(): void; continue(): void}): {show(): void} {
  byId('int-back').addEventListener('click', next.back);
  byId('int-continue').addEventListener('click', next.continue);
  return {show: () => showScreen('v-intro')};
}
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 743520c..8a6b24e 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -25,6 +25,11 @@ export const COMMON = {
   passkeyUnavailableConfirm: 'This device cannot confirm with a passkey; your password still works.',
 } as const;
 
+/** #1 welcome. */
+export const WELCOME = {
+  useIt: 'Open the Noctura icon to use it.',
+} as const;
+
 /** #5 create password (D7). */
 export const PASSWORD = {
   longEnough: 'Long enough',
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 8485c3c..26a173f 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -62,6 +62,15 @@
 .vlt-gap-6 {
   margin-bottom: var(--space-6);
 }
+.vlt-pad-top {
+  padding-top: var(--space-3);
+}
+.vlt-gap-top-2 {
+  margin-top: var(--space-2);
+}
+.vlt-gap-top-5 {
+  margin-top: var(--space-5);
+}
 .vlt-pad {
   padding: 0 var(--space-5);
 }
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 555043f..ab51d40 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -22,10 +22,75 @@
         <symbol id="i-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></symbol>
         <symbol id="i-clock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></symbol>
         <symbol id="i-alert-triangle" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>
+        <symbol id="i-fingerprint" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 11c0 5-1.5 8-3 10"/><path d="M16 13.5c-.5 4-2 6-3 7.5"/><path d="M8 11c0-2 2-4 4-4s4 2 4 4c0 2-1 4-2 6"/><path d="M5 11c0-4 3-7 7-7s7 3 7 7"/><path d="M3 14c0-1.5.5-3 1-4"/><path d="M21 14c-.5 0-1 1-2 3"/></symbol>
         <symbol id="i-warn" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></symbol>
       </defs>
     </svg>
     <main id="vault" class="vlt-col">
+      <!-- #1 welcome (spec §3.1). The CTAs stay hidden until the vault read says there is no wallet. -->
+      <section id="v-welcome" class="screen s-welcome" hidden>
+        <div class="hero">
+          <div class="logo" aria-hidden="true"><span class="mark">N</span></div>
+          <div>
+            <h1 class="wordmark">Noctura</h1>
+            <p class="noc-body tagline vlt-gap-top-2">A Solana wallet built for private, non-custodial holding.</p>
+          </div>
+          <div class="badges">
+            <span class="trust-chip"><svg width="14" height="14" aria-hidden="true"><use href="#i-lock" /></svg>E2E encrypted</span>
+            <span class="trust-chip"><svg width="14" height="14" aria-hidden="true"><use href="#i-key" /></svg>Non-custodial</span>
+          </div>
+          <div id="wel-notice" class="vlt-notice" role="status" hidden>
+            <p id="wel-notice-line" class="noc-body"></p>
+            <p id="wel-notice-help" class="noc-body-sm vlt-lede"></p>
+          </div>
+        </div>
+        <div id="wel-actions" hidden>
+          <p class="noc-caption terms">By continuing you agree to the Terms and Privacy Policy.</p>
+          <div class="sticky-bar">
+            <button id="wel-create" type="button" class="btn btn-primary">Create new wallet</button>
+            <button id="wel-import" type="button" class="btn btn-secondary">I have a wallet</button>
+          </div>
+        </div>
+      </section>
+
+      <!-- #2 security-intro (spec §3.2). -->
+      <section id="v-intro" class="screen s-secintro" hidden>
+        <div class="top-bar">
+          <button id="int-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
+          <span class="title noc-overline vlt-muted">Onboarding</span>
+          <span class="step noc-body-sm noc-numeral">1 / 5</span>
+        </div>
+        <div class="scroll-area vlt-pad-top">
+          <h1 class="noc-h1 vlt-gap-2">Three layers protect your wallet</h1>
+          <p class="noc-body vlt-lede vlt-gap-6">You hold the keys. We never can.</p>
+          <div class="layer-card">
+            <div class="layer-icon"><svg width="22" height="22" aria-hidden="true"><use href="#i-key" /></svg></div>
+            <div>
+              <h3 class="noc-h3">Password</h3>
+              <p class="noc-body-sm">At least 12 characters you choose. It unlocks the wallet in this browser and is asked again before sends to new addresses or large amounts.</p>
+            </div>
+          </div>
+          <div class="layer-card">
+            <div class="layer-icon"><svg width="22" height="22" aria-hidden="true"><use href="#i-fingerprint" /></svg></div>
+            <div>
+              <h3 class="noc-h3">Passkey (optional)</h3>
+              <p class="noc-body-sm">A fingerprint, face or security key as a shortcut. Your password still works for everything.</p>
+            </div>
+          </div>
+          <div class="layer-card">
+            <div class="layer-icon"><svg width="22" height="22" aria-hidden="true"><use href="#i-shield-lock" /></svg></div>
+            <div>
+              <h3 class="noc-h3">Recovery seed</h3>
+              <p class="noc-body-sm">24 words. Written offline. The only way back if this browser's data is lost.</p>
+            </div>
+          </div>
+          <p class="noc-caption vlt-muted vlt-gap-top-5">If you lose all three, no one — not Noctura, not a Solana validator — can recover your funds. That's the point.</p>
+        </div>
+        <div class="sticky-bar">
+          <button id="int-continue" type="button" class="btn btn-primary">Continue</button>
+        </div>
+      </section>
+
       <section id="unlock-section">
         <h1>Unlock Noctura</h1>
         <form id="pw">
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/pageHarness.ts src/unlock/__tests__/welcome.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 89 passed (89) Tests 1130 passed (1130).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- a damaged vault offers setup → RED Tests  1 failed | 3 passed (4)

- [ ] **Step 6: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `01-welcome-idle`, `01-welcome-exists`, `01-welcome-damaged`, `02-security-intro`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/unlock/__tests__/pageHarness.ts extension/src/unlock/__tests__/welcome.test.ts extension/src/unlock/screens/welcome.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/unlock.html
git commit -m "feat(extension): #1 welcome and #2 security-intro in the vault page" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 7: #3 seed-display — the pre-reveal gate, press-and-hold, the 20 s auto-blur

**Files:**
- Create: `extension/src/unlock/__tests__/seed.test.ts`
- Create: `extension/src/unlock/screens/seed.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/src/unlock/view/dom.ts`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Task 4 (`createHold`, `seedWordCells`, `PageDeps`), Task 6 (harness).
- Produces: `src/unlock/screens/seed.ts`: `mountSeed(deps, next: {back(): void; done(): void}): {show(words: readonly string[]): void}`; `strings.ts`: `SEED`; `SCREENS` gains `'v-seed-gate'`

Spec §3.3. The gate first (`v-seed-gate`: the design's modal, its callout without the screenshot claim, D1); the word grid is **not in the DOM** until it is passed, and leaving the step (back, Continue, the gate's Cancel or backdrop) takes the words out and clears every timer. Then: `blurred` (24 words, column-major, blurred under "Press and hold to reveal" — "Tap" → "Press", adapted), `revealed` (the chip "13 s · auto-blur" in `--warning`, "5 s — still memorizing?" in `--danger` at ≤ 5 s, the helper line), `still-looking` (the auto-blur fires even while held; only a release and a new press hold again), `confirmed` ("Acknowledged", the new lede, the CTA "Continue"; Scope 1). Pointer and keyboard (Space/Enter held) hold; pointerup/leave/cancel, keyup, the grid or the window losing focus and the tab being hidden all release. The chip is `aria-hidden`; a separate live region speaks at 10 s and 5 s only (the design's TalkBack throttle). Leaving #3 drops the screen's own reference to the phrase too (`clear()` empties `words`), so once the create run stores the wallet nothing on the page holds it (plan-2 review H2; the test reaches the gate's Continue without a new `show()` and finds no word to render; Scope 19).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/unlock/__tests__/seed.test.ts`:

```ts
// @vitest-environment happy-dom
import {HOLD_MS, REVEAL_MS, TICK_MS} from '../view/hold';
import {mountSeed} from '../screens/seed';
import {click, el, harness, loadPage, text, unstyled, visible} from './pageHarness';

const WORDS = 'legend frost marble river coral anchor valid echo raven melody praise voyage copper garden tribe modify banner spirit lift harvest thrive current siren beacon'.split(' ');
const HELD = HOLD_MS + TICK_MS;

beforeEach(loadPage);

async function setup() {
  const h = await harness();
  const calls: string[] = [];
  const seed = mountSeed(h.deps, {back: () => calls.push('back'), done: () => calls.push('done')});
  seed.show(WORDS);
  return {h, calls, seed};
}
const grid = () => el('seed-grid');
const down = () => grid().dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
const up = () => grid().dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));

describe('#3 seed-display: the pre-reveal gate', () => {
  it('shows the gate first, with no word in the DOM; the callout says nothing about screenshots (D1)', async () => {
    await setup();
    expect(visible(el('v-seed-gate'))).toBe(true);
    expect(visible(el('v-seed'))).toBe(false);
    const gate = el('v-seed-gate');
    expect(text(gate.querySelector('h2'))).toBe('About to show your recovery phrase');
    expect(text(gate.querySelector('.body'))).toBe('Move to a private place. Anyone who sees these 24 words can spend everything in this wallet, forever.');
    expect(text(gate.querySelector('.shield-callout'))).toBe("We can't recover this for you if someone takes it. Your only copy is the one you write by hand.");
    expect([...gate.querySelectorAll('button')].map(text)).toEqual(["I'm in a safe place — continue", 'Cancel — go back']);
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    expect(text(document.body)).not.toContain('legend');
    expect(text(document.body)).not.toMatch(/Screenshots|blocked/);
    expect(unstyled('v-seed-gate')).toEqual([]);
  });

  it('Cancel and a backdrop click go back to #2', async () => {
    const {calls} = await setup();
    click(el('sg-cancel'));
    click(el('sg-backdrop'));
    expect(calls).toEqual(['back', 'back']);
  });
});

describe('#3 seed-display: blurred → revealed → confirmed', () => {
  it('blurred: 24 words, column-major, blurred under "Press and hold to reveal"; the CTA disabled', async () => {
    await setup();
    click(el('sg-continue'));
    expect(visible(el('v-seed'))).toBe(true);
    expect(text(el('v-seed').querySelector('.top-bar .step'))).toBe('2 / 5');
    expect(text(el('seed-lede'))).toBe('24 words. Write them down on paper, in order. This is the only backup.');
    expect(grid().classList.contains('is-blurred')).toBe(true);
    expect([...grid().querySelectorAll('.word')].map(w => text(w))).toEqual(WORDS.map((w, i) => `${String(i + 1).padStart(2, '0')}${w}`));
    expect(text(el('seed-overlay-title'))).toBe('Press and hold to reveal');
    expect(text(el('seed-overlay-body'))).toBe('Make sure no one is looking over your shoulder. Hold for 2 seconds. Auto re-blurs after 20 s for safety.');
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(true);
    expect(text(el('seed-cta'))).toBe("I've written it down");
    expect(unstyled('v-seed')).toEqual([]);
  });

  it('revealed: the chip counts down in --warning, "5 s — still memorizing?" in --danger; screen readers hear 10 s and 5 s only', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    down();
    h.timers.advance(HELD);
    expect(grid().classList.contains('is-blurred')).toBe(false);
    expect(visible(el('seed-overlay'))).toBe(false);
    expect(visible(el('seed-helper'))).toBe(true);
    expect(text(el('seed-helper'))).toBe('Holding to reveal · Auto-blurs at 20 s for safety. Screen readers announce at 10 s and 5 s only.');
    expect(text(el('seed-chip'))).toBe('20 s· auto-blur');
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(false);
    h.timers.advance(7_000);
    expect(text(el('seed-chip-n'))).toBe('13 s');
    expect(el('seed-chip').classList.contains('is-danger')).toBe(false);
    expect(text(el('seed-live'))).toBe('');
    h.timers.advance(3_000);
    expect(text(el('seed-live'))).toBe('10 s · auto-blur');
    h.timers.advance(5_000);
    expect(text(el('seed-chip'))).toBe('5 s— still memorizing?');
    expect(el('seed-chip').classList.contains('is-danger')).toBe(true);
    expect(text(el('seed-live'))).toBe('5 s — still memorizing?');
    expect(el('seed-chip').getAttribute('aria-hidden')).toBe('true');
    expect(unstyled('v-seed')).toEqual([]);
  });

  it('released after a full hold: "confirmed" — re-blurred, "Acknowledged", the new lede, Continue → #4', async () => {
    const {h, calls} = await setup();
    click(el('sg-continue'));
    down();
    h.timers.advance(HELD);
    up();
    expect(grid().classList.contains('is-blurred')).toBe(true);
    expect(visible(el('seed-stamp'))).toBe(true);
    expect(text(el('seed-stamp'))).toBe('Acknowledged');
    expect(text(el('seed-lede'))).toBe('Phrase locked in. Tap continue to verify a few words.');
    expect(text(el('seed-cta'))).toBe('Continue');
    click(el('seed-cta'));
    expect(calls).toEqual(['done']);
    // Leaving the step takes the words out of the DOM and stops every timer.
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    expect(h.timers.pending()).toBe(0);
  });

  it('"Still looking?" at 20 s even while held; a release then a new press holds again', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    down();
    h.timers.advance(HELD + REVEAL_MS);
    expect(grid().classList.contains('is-blurred')).toBe(true);
    expect(el('seed-overlay').classList.contains('is-still-looking')).toBe(true);
    expect(text(el('seed-overlay-title'))).toBe('Still looking?');
    expect(text(el('seed-overlay-body'))).toBe('Press and hold again to keep viewing. Releasing now is fine — your hand is remembering enough.');
    expect(el('seed-overlay-icon').getAttribute('href')).toBe('#i-clock');
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(false);
    expect(text(el('seed-cta'))).toBe("I've written it down");
    expect(unstyled('v-seed')).toEqual([]);
    up();
    down();
    h.timers.advance(HELD);
    expect(grid().classList.contains('is-blurred')).toBe(false);
  });

  it('a release before 2 s, the window losing focus and the tab being hidden all re-blur; Space held reveals too', async () => {
    const {h} = await setup();
    click(el('sg-continue'));
    down();
    h.timers.advance(HOLD_MS - 100);
    up();
    expect(el<HTMLButtonElement>('seed-cta').disabled).toBe(true);
    grid().dispatchEvent(new KeyboardEvent('keydown', {key: ' ', bubbles: true}));
    h.timers.advance(HELD);
    expect(grid().classList.contains('is-blurred')).toBe(false);
    window.dispatchEvent(new Event('blur'));
    expect(grid().classList.contains('is-blurred')).toBe(true);
    grid().dispatchEvent(new KeyboardEvent('keyup', {key: ' ', bubbles: true}));
    down();
    h.timers.advance(HELD);
    h.leave();
    expect(grid().classList.contains('is-blurred')).toBe(true);
  });

  it('back → #2, the words leave the DOM; showing #3 again starts at the gate', async () => {
    const {calls, seed} = await setup();
    click(el('sg-continue'));
    click(el('seed-back'));
    expect(calls).toEqual(['back']);
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    seed.show(WORDS);
    expect(visible(el('v-seed-gate'))).toBe(true);
  });

  // H2 (plan review): leaving #3 drops the screen's own reference to the phrase, not only the DOM's —
  // the gate's Continue, reached without a new show(), has no word left to render.
  it('leaving #3 (Continue, back, the gate’s Cancel) drops the phrase: nothing is left to render', async () => {
    const {h, seed} = await setup();
    click(el('sg-continue'));
    down();
    h.timers.advance(HELD);
    up();
    click(el('seed-cta'));
    click(el('sg-continue'));
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    seed.show(WORDS);
    click(el('sg-continue'));
    click(el('seed-back'));
    click(el('sg-continue'));
    expect(document.querySelectorAll('.word')).toHaveLength(0);
    seed.show(WORDS);
    click(el('sg-cancel'));
    click(el('sg-continue'));
    expect(document.querySelectorAll('.word')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/seed.test.ts`
Expected (dry run): FAIL — Test Files 1 failed (1) Tests no tests (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Create `extension/src/unlock/screens/seed.ts`:

```ts
import type {PageDeps} from '../page';
import {SEED} from '../strings';
import {createHold, type Hold, type HoldState} from '../view/hold';
import {byId, setText, showScreen, shown} from '../view/dom';
import {seedWordCells} from '../view/words';

/**
 * #3 seed-display (spec §3.3). The phrase is the user's own words, generated in this page (create run)
 * and never sent anywhere. The pre-reveal gate comes first, and the word grid is not in the DOM until it
 * is passed; leaving the step (back, Continue, the gate's Cancel) takes the words out of the DOM and
 * clears every timer. Mechanics: hold 2 s (30 ms ticks) → revealed with the 20 s countdown; release →
 * confirmed; the auto-blur fires even while held → "Still looking?", and only a release and a new press
 * hold again. Pointer and keyboard (Space/Enter held) both hold; pointerup/leave/cancel, keyup, the
 * window losing focus and the tab being hidden all release.
 *
 * The chip shows every second; screen readers hear it at 10 s and 5 s only (a separate live region,
 * the chip itself aria-hidden — the design's TalkBack throttle).
 */
export function mountSeed(deps: PageDeps, next: {back(): void; done(): void}): {show(words: readonly string[]): void} {
  const grid = byId('seed-grid');
  const cta = byId<HTMLButtonElement>('seed-cta');
  let hold: Hold | null = null;
  let words: readonly string[] = [];

  const paint = (state: HoldState) => {
    const revealed = state === 'revealed';
    grid.classList.toggle('is-blurred', !revealed);
    shown(byId('seed-chip'), revealed);
    shown(byId('seed-helper'), revealed);
    shown(byId('seed-stamp'), state === 'confirmed');
    shown(byId('seed-overlay'), state === 'blurred' || state === 'still-looking');
    const still = state === 'still-looking';
    byId('seed-overlay').classList.toggle('is-still-looking', still);
    byId('seed-overlay-icon').setAttribute('href', still ? '#i-clock' : '#i-eye-off');
    setText(byId('seed-overlay-title'), still ? SEED.stillTitle : SEED.holdTitle);
    setText(byId('seed-overlay-body'), still ? SEED.stillBody : SEED.holdBody);
    setText(byId('seed-lede'), state === 'confirmed' ? SEED.ledeConfirmed : SEED.lede);
    cta.disabled = hold === null || !hold.revealedOnce();
    setText(cta, state === 'confirmed' ? SEED.continue : SEED.written);
  };
  const tick = (seconds: number) => {
    const late = seconds <= 5;
    byId('seed-chip').classList.toggle('is-danger', late);
    setText(byId('seed-chip-n'), SEED.chip(seconds));
    setText(byId('seed-chip-tail'), late ? SEED.chipLate : SEED.chipTail);
    if (seconds === 10 || seconds === 5) setText(byId('seed-live'), `${SEED.chip(seconds)} ${late ? SEED.chipLate : SEED.chipTail}`);
  };

  /**
   * Out of the DOM, timers cleared, and the screen's own reference dropped (H2 of the plan review): after
   * any way out of #3 the phrase is held only by the create run, which drops it once the wallet is stored.
   */
  const clear = () => {
    hold?.dispose();
    hold = null;
    words = [];
    grid.querySelectorAll('.word').forEach(w => w.remove());
    setText(byId('seed-live'), '');
  };
  const press = () => hold?.press();
  const release = () => hold?.release();

  grid.addEventListener('pointerdown', e => {
    e.preventDefault();
    press();
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) grid.addEventListener(ev, release);
  grid.addEventListener('keydown', e => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault();
      press();
    }
  });
  grid.addEventListener('keyup', e => {
    if (e.key === ' ' || e.key === 'Enter') release();
  });
  grid.addEventListener('blur', release);
  window.addEventListener('blur', release);
  deps.onLeave(release);

  const gate = () => showScreen('v-seed-gate');
  const cancel = () => {
    clear();
    next.back();
  };
  byId('sg-cancel').addEventListener('click', cancel);
  byId('sg-backdrop').addEventListener('click', cancel);
  byId('sg-continue').addEventListener('click', () => {
    const phrase = words;
    clear();
    words = phrase;
    grid.append(...seedWordCells(words));
    hold = createHold(deps.timers, {state: paint, tick});
    paint('blurred');
    showScreen('v-seed');
  });
  byId('seed-back').addEventListener('click', () => {
    clear();
    next.back();
  });
  cta.addEventListener('click', () => {
    if (hold === null || !hold.revealedOnce()) return;
    clear();
    next.done();
  });

  return {
    show(w) {
      clear();
      words = w;
      gate();
    },
  };
}
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 8a6b24e..c17a525 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -30,6 +30,21 @@ export const WELCOME = {
   useIt: 'Open the Noctura icon to use it.',
 } as const;
 
+/** #3 seed-display. */
+export const SEED = {
+  lede: '24 words. Write them down on paper, in order. This is the only backup.',
+  ledeConfirmed: 'Phrase locked in. Tap continue to verify a few words.',
+  holdTitle: 'Press and hold to reveal',
+  holdBody: 'Make sure no one is looking over your shoulder. Hold for 2 seconds. Auto re-blurs after 20 s for safety.',
+  stillTitle: 'Still looking?',
+  stillBody: 'Press and hold again to keep viewing. Releasing now is fine — your hand is remembering enough.',
+  written: "I've written it down",
+  continue: 'Continue',
+  chip: (seconds: number): string => `${seconds} s`,
+  chipTail: '· auto-blur',
+  chipLate: '— still memorizing?',
+} as const;
+
 /** #5 create password (D7). */
 export const PASSWORD = {
   longEnough: 'Long enough',
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 26a173f..95e396e 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -68,6 +68,9 @@
 .vlt-gap-top-2 {
   margin-top: var(--space-2);
 }
+.vlt-gap-top-3 {
+  margin-top: var(--space-3);
+}
 .vlt-gap-top-5 {
   margin-top: var(--space-5);
 }
@@ -94,3 +97,22 @@
   padding: var(--space-7) var(--space-6);
   text-align: center;
 }
+
+/* #3: the chip's "· auto-blur" at the design's 0.7 opacity; a live region only screen readers hear. */
+.vlt-dim {
+  opacity: 0.7;
+}
+.vlt-sr {
+  position: absolute;
+  width: 1px;
+  height: 1px;
+  overflow: hidden;
+  clip-path: inset(50%);
+  white-space: nowrap;
+}
+/* The grid takes presses; the design's word cells are not text to select while blurred. */
+.vlt-col .s-seed .seed-grid {
+  touch-action: none;
+  user-select: none;
+  cursor: pointer;
+}
```

Modify `extension/src/unlock/view/dom.ts`:

```diff
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index 5f042a3..a29ea52 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -31,6 +31,7 @@ export function shown(el: HTMLElement, on: boolean): void {
 export const SCREENS = [
   'v-welcome',
   'v-intro',
+  'v-seed-gate',
   'v-seed',
   'v-confirm',
   'v-password',
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index ab51d40..4211291 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -161,6 +161,53 @@
         <button id="reveal-hide" type="button">Hide</button>
       </section>
       <p id="status" role="status"></p>
+      <!-- #3 seed-display, its pre-reveal gate (spec §3.3): the word grid is not in the DOM until the gate is passed. -->
+      <section id="v-seed-gate" class="screen s-seed-modal" hidden>
+        <div id="sg-backdrop" class="modal-backdrop"></div>
+        <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="sg-title">
+          <div class="modal-icon"><svg width="28" height="28" aria-hidden="true"><use href="#i-shield-lock" /></svg></div>
+          <h2 id="sg-title" class="noc-h2">About to show your recovery phrase</h2>
+          <p class="body noc-body">Move to a private place. Anyone who sees these 24 words can spend everything in this wallet, forever.</p>
+          <div class="shield-callout">
+            <span class="noc-caption">We can't recover this for you if someone takes it. Your only copy is the one you write by hand.</span>
+          </div>
+          <div class="ctas">
+            <button id="sg-continue" type="button" class="btn btn-primary">I'm in a safe place — continue</button>
+            <button id="sg-cancel" type="button" class="btn btn-secondary">Cancel — go back</button>
+          </div>
+        </div>
+      </section>
+
+      <!-- #3 seed-display (spec §3.3): press and hold to reveal; the 20 s auto-blur. -->
+      <section id="v-seed" class="screen s-seed" hidden>
+        <div class="top-bar">
+          <button id="seed-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
+          <span class="title noc-overline vlt-muted">Onboarding</span>
+          <span class="step noc-body-sm noc-numeral">2 / 5</span>
+        </div>
+        <div class="scroll-area">
+          <h1 class="noc-h1 vlt-gap-2">Recovery phrase</h1>
+          <p id="seed-lede" class="noc-body vlt-lede vlt-gap-4"></p>
+          <div id="seed-grid" class="seed-grid is-blurred" tabindex="0" role="button" aria-label="Press and hold to reveal the recovery phrase">
+            <span id="seed-chip" class="auto-blur-chip" aria-hidden="true" hidden>
+              <svg width="11" height="11" aria-hidden="true"><use href="#i-clock" /></svg>
+              <span id="seed-chip-n" class="noc-numeral"></span><span id="seed-chip-tail" class="vlt-dim"></span>
+            </span>
+            <span id="seed-stamp" class="confirm-stamp" hidden><svg width="12" height="12" aria-hidden="true"><use href="#i-check" /></svg>Acknowledged</span>
+            <div id="seed-overlay" class="reveal-overlay">
+              <div class="icon"><svg width="26" height="26" aria-hidden="true"><use id="seed-overlay-icon" href="#i-eye-off" /></svg></div>
+              <h3 id="seed-overlay-title" class="noc-h3"></h3>
+              <p id="seed-overlay-body" class="noc-body-sm"></p>
+            </div>
+          </div>
+          <span id="seed-live" class="vlt-sr" aria-live="polite"></span>
+          <p id="seed-helper" class="noc-caption vlt-muted vlt-gap-top-3" hidden>Holding to reveal · Auto-blurs at 20 s for safety. Screen readers announce at 10 s and 5 s only.</p>
+        </div>
+        <div class="sticky-bar">
+          <button id="seed-cta" type="button" class="btn btn-primary" disabled></button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/seed.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 90 passed (90) Tests 1139 passed (1139).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- the words in the DOM before the gate → RED Tests  1 failed | 8 passed (9)
- leaving #3 leaves the words → RED Tests  3 failed | 6 passed (9)
- leaving #3 keeps the phrase referenced (H2) → RED Tests  1 failed | 8 passed (9)

- [ ] **Step 6: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `03-pre-reveal-modal`, `03-blurred`, `03-revealed-countdown-13s`, `03-revealed-countdown-5s`, `03-re-blurred-still-looking`, `03-confirmed`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/unlock/__tests__/seed.test.ts extension/src/unlock/screens/seed.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/src/unlock/view/dom.ts extension/unlock.html
git commit -m "feat(extension): #3 seed-display — the gate, press-and-hold, the 20 s auto-blur" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 8: #4 seed-confirm, #5 create password, #6 passkey — and the create run in one page

**Files:**
- Create: `extension/e2e/vaultPage.ts`
- Modify: `extension/e2e/wallet.spec.ts`
- Create: `extension/src/unlock/__tests__/create.test.ts`
- Modify: `extension/src/unlock/__tests__/page.test.ts`
- Modify: `extension/src/unlock/__tests__/pageHarness.ts`
- Create: `extension/src/unlock/browser.ts`
- Modify: `extension/src/unlock/main.ts`
- Modify: `extension/src/unlock/modes.ts`
- Modify: `extension/src/unlock/page.ts`
- Create: `extension/src/unlock/screens/confirm.ts`
- Create: `extension/src/unlock/screens/createRun.ts`
- Create: `extension/src/unlock/screens/passkey.ts`
- Create: `extension/src/unlock/screens/password.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/src/unlock/view/dom.ts`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Tasks 1–7; `finishOnboarding`, `addPasskey` (plan 1).
- Produces:
  - `src/unlock/page.ts`: `interface PageGate extends BusyGate {onIdle(f: () => void): void}`; `createPageGate(): PageGate`; `PageDeps.gate: PageGate`
  - `src/unlock/screens/confirm.ts`: `interface ConfirmPlan {slots: {position; word}[]; pool: string[]}`; `randomBelow(randomBytes, n)`; `confirmPlan(words, randomBytes): ConfirmPlan`; `RESET_MS = 700`; `mountConfirm(deps, next: {back(); done()}): {show(words): void}`
  - `src/unlock/screens/password.ts`: `MISMATCH_CLEAR_MS = 600`; `interface PasswordRun {eyebrow: string; step: string; back(): void; finish(password: string): Promise<{line: string; stop: boolean} | null>}`; `interface PasswordScreen {show(run: PasswordRun): void}`; `mountPassword(deps): PasswordScreen` (Task 12 widens `finish`'s answer to `then: 'retype' | 'retry' | 'stop'`)
  - `src/unlock/screens/passkey.ts`: `mountPasskey(deps, next: {done(): void}): {show(password: {get(): string | null; drop(): void}): void}`
  - `src/unlock/screens/createRun.ts`: `createCreateRun(deps, o: {password: PasswordScreen; importRun(): void}): {start(at: 'welcome' | 'intro'): void}`
  - `src/unlock/browser.ts`: `browserPageDeps(): PageDeps`; `src/unlock/modes.ts`: `startMode(mode: PageMode, deps: PageDeps): void`
  - `e2e/vaultPage.ts`: `createWallet(vault, id, password, o?)`, `holdToReveal(vault)`, `confirmWords(vault, words)`, `setPassword(vault, password)`

Spec §3.4, §3.5, §3.6, S2. #4: three random positions, one pool of nine (Scope 2), a right word fills its slot, a wrong one shows the danger lede, shakes the slot, says "Word #N was wrong. Slots will reset in a moment." and resets ~700 ms later; three right words → `[Confirm]` → "Phrase verified" (adapted, D7) → `[Continue]`; leaving #4 takes its words out of the DOM. #5: enter (the field with show/hide, the length meter — 4 bars at 3/6/9/12, "N of 12 characters" / "Long enough"), confirm, mismatch (helper, shake, the field cleared after 600 ms), `creating` ("Creating your wallet…" / "Securing your password takes a few seconds." with the indeterminate `.noc-progress`, every control disabled); finishOnboarding's outcomes in the B1b-1 words. #6: the adapted copy (D9 plus the parent spec's limits), `[Add a passkey]` with the password #5 just set (held by the run until #6 ends; dropped when the tab is hidden, after which #6 asks for it once more), `adding` / `added` / `unsupported` / `failed`, Skip — every end → `wallet.html#/created` (the `unsupported` test stores a wallet so it reaches `unsupported`; `failed` has its own test — plan-2 review L1).

`createCreateRun` wires #1 → #2 → #3 → #4 → #5 → #6 in **one page**: the phrase is generated when #3 is first reached, never crosses a navigation, and is dropped once the wallet is stored. `src/unlock/browser.ts` builds the real `PageDeps`; `modes.ts` routes `welcome` and `create` through the run (the B1b-1 create section and plan 1's minimal welcome section go). The page gate becomes a `PageGate` that tells every mounted screen when it frees up (Scope 15: #5's store ends on #6). `e2e/vaultPage.ts` (new) drives the run in a real browser; `wallet.spec.ts`'s first test uses it.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/unlock/__tests__/create.test.ts`:

```ts
// @vitest-environment happy-dom
import {wordlist} from '@scure/bip39/wordlists/english.js';
import {createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {VAULT_KEY} from '../../background/accountsStore';
import {getSession} from '../../background/session';
import {RESET_MS, confirmPlan, mountConfirm} from '../screens/confirm';
import {MISMATCH_CLEAR_MS, mountPassword} from '../screens/password';
import {mountPasskey} from '../screens/passkey';
import {startCreateRun} from '../screens/createRun';
import {HOLD_MS, TICK_MS} from '../view/hold';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

// A valid 24-word BIP-39 phrase with 24 distinct words (generated once for this test).
const PHRASE = 'wonder sauce regret hover leopard hundred luxury home wise frost naive body company wedding want sponsor buyer birth february friend frequent neglect draw pond';
const WORDS = PHRASE.split(' ');
const PW = 'a long enough password';

/** Deterministic "random" bytes: a counter, so a plan is reproducible. */
function counterBytes() {
  let c = 7;
  return (n: number) => Uint8Array.from({length: n}, () => (c = (c * 131 + 17) % 256));
}

beforeEach(loadPage);

describe('#4 seed-confirm: the plan', () => {
  it('three distinct positions, ascending; a pool of nine — each row its slot’s word and two same-letter BIP-39 words not in the phrase', () => {
    for (let run = 0; run < 20; run++) {
      const plan = confirmPlan(WORDS, counterBytes());
      const positions = plan.slots.map(s => s.position);
      expect(new Set(positions).size).toBe(3);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      for (const [i, s] of plan.slots.entries()) {
        expect(s.word).toBe(WORDS[s.position - 1]);
        const row = plan.pool.slice(i * 3, i * 3 + 3);
        expect(row).toContain(s.word);
        for (const w of row.filter(x => x !== s.word)) {
          expect(wordlist).toContain(w);
          expect(WORDS).not.toContain(w);
          expect(w[0]).toBe(s.word[0]);
        }
      }
      expect(new Set(plan.pool).size).toBe(9);
    }
  });
});

describe('#4 seed-confirm: the screen', () => {
  async function shown() {
    const h = await harness();
    const calls: string[] = [];
    mountConfirm(h.deps, {back: () => calls.push('back'), done: () => calls.push('done')}).show(WORDS);
    const slots = () => [...el('cnf-slots').querySelectorAll('.slot')];
    const position = (i: number) => Number(/#(\d+)/.exec(text(slots()[i]?.querySelector('.label') ?? null))?.[1]);
    const button = (w: string) => [...el('cnf-pool').querySelectorAll('button')].find(b => text(b) === w) as HTMLButtonElement;
    return {h, calls, slots, position, button};
  }

  it('empty: "Confirm phrase", three "Word #N" slots on "— select —", nine words, Confirm disabled', async () => {
    const {slots} = await shown();
    expect(visible(el('v-confirm'))).toBe(true);
    expect(text(el('v-confirm').querySelector('.top-bar .step'))).toBe('3 / 5');
    expect(text(el('v-confirm').querySelector('h1'))).toBe('Confirm phrase');
    expect(text(el('cnf-lede'))).toBe('Tap the correct word for each position.');
    expect(slots().map(s => [s.className, text(s.querySelector('.value'))])).toEqual([
      ['slot empty', '— select —'],
      ['slot empty', '— select —'],
      ['slot empty', '— select —'],
    ]);
    expect(el('cnf-pool').querySelectorAll('button.word-btn')).toHaveLength(9);
    expect(el<HTMLButtonElement>('cnf-cta').disabled).toBe(true);
    expect(text(el('cnf-cta'))).toBe('Confirm');
    expect(unstyled('v-confirm')).toEqual([]);
  });

  it('a right word fills its slot and dims its button (partial-correct)', async () => {
    const {slots, position, button} = await shown();
    const w = WORDS[position(0) - 1] ?? '';
    click(button(w));
    expect(slots()[0]?.classList.contains('filled')).toBe(true);
    expect(text(slots()[0]?.querySelector('.value') ?? null)).toBe(w);
    expect(button(w).className).toBe('word-btn used dim');
    expect(el<HTMLButtonElement>('cnf-cta').disabled).toBe(true);
    expect(unstyled('v-confirm')).toEqual([]);
  });

  it('a wrong word: the danger lede, the slot shakes, "Word #N was wrong…", and ~700 ms later every slot resets', async () => {
    const {h, slots, position, button} = await shown();
    const wrong = [...el('cnf-pool').querySelectorAll('button')].map(text).find(w => w !== WORDS[position(0) - 1]) ?? '';
    click(button(wrong));
    expect(text(el('cnf-lede'))).toBe("That's not the right word — let's start over.");
    expect(el('cnf-lede').classList.contains('vlt-danger')).toBe(true);
    expect(slots()[0]?.classList.contains('wrong')).toBe(true);
    expect(text(el('cnf-helper'))).toBe(`Word #${position(0)} was wrong. Slots will reset in a moment.`);
    expect(button(wrong).classList.contains('vlt-wrong-word')).toBe(true);
    expect(unstyled('v-confirm')).toEqual([]);
    h.timers.advance(RESET_MS);
    expect(slots().every(s => s.classList.contains('empty'))).toBe(true);
    expect(text(el('cnf-lede'))).toBe('Tap the correct word for each position.');
    expect(visible(el('cnf-helper'))).toBe(false);
  });

  it('three right words → Confirm → "Phrase verified" (adapted, D7) → Continue → #5; back → #3', async () => {
    const {calls, position, button} = await shown();
    for (let i = 0; i < 3; i++) click(button(WORDS[position(i) - 1] ?? ''));
    expect(el<HTMLButtonElement>('cnf-cta').disabled).toBe(false);
    click(el('cnf-cta'));
    expect(visible(el('cnf-success'))).toBe(true);
    expect(visible(el('cnf-main'))).toBe(false);
    expect(text(el('cnf-success'))).toBe('Phrase verified All three words matched. Now lock the wallet with a password.');
    expect(text(el('cnf-cta'))).toBe('Continue');
    expect(unstyled('v-confirm')).toEqual([]);
    click(el('cnf-cta'));
    expect(calls).toEqual(['done']);
    expect(el('cnf-slots').children).toHaveLength(0);
    expect(el('cnf-pool').children).toHaveLength(0);
    click(el('cnf-back'));
    expect(calls).toEqual(['done', 'back']);
  });
});

describe('#5 create password (D7)', () => {
  async function shown(finish: (pw: string) => Promise<{line: string; stop: boolean} | null> = async () => null, o: {holdSleep?: boolean} = {}) {
    const h = await harness(o);
    const finished: string[] = [];
    const backs: number[] = [];
    mountPassword(h.deps).show({eyebrow: 'Onboarding', step: '4 / 5', back: () => backs.push(1), finish: async pw => (finished.push(pw), finish(pw))});
    return {h, finished, backs, field: el<HTMLInputElement>('pw-field'), cta: el<HTMLButtonElement>('pw-cta')};
  }

  it('enter: the adapted copy, the field (new-password) and the length meter; Continue only from 12 characters', async () => {
    const {field, cta} = await shown();
    expect(text(el('pw-eyebrow'))).toBe('Onboarding');
    expect(text(el('pw-step'))).toBe('4 / 5');
    expect(text(el('pw-title'))).toBe('Create a password');
    expect(text(el('pw-lede'))).toBe("At least 12 characters. You'll need it to unlock the wallet and to confirm risky sends.");
    expect(text(el('pw-helper'))).toBe('Choose something long and memorable — a few unrelated words work well.');
    expect(field.getAttribute('autocomplete')).toBe('new-password');
    expect(text(el('pw-meter-label'))).toBe('0 of 12 characters');
    expect(cta.disabled).toBe(true);
    type(field, 'a'.repeat(9));
    expect(text(el('pw-meter-label'))).toBe('9 of 12 characters');
    expect(el('pw-meter').querySelectorAll('i.filled')).toHaveLength(3);
    expect(cta.disabled).toBe(true);
    type(field, PW);
    expect(text(el('pw-meter-label'))).toBe('Long enough');
    expect(cta.disabled).toBe(false);
    expect(el('pw-dot-1').classList.contains('active')).toBe(true);
    expect(text(document.body)).not.toMatch(/PIN|111111/);
    expect(unstyled('v-password')).toEqual([]);
  });

  it('show/hide toggles the field; confirm asks for the same password', async () => {
    const {h, field, cta} = await shown();
    click(el('pw-toggle'));
    expect(field.type).toBe('text');
    expect(el('pw-toggle').getAttribute('aria-label')).toBe('Hide password');
    click(el('pw-toggle'));
    expect(field.type).toBe('password');
    type(field, PW);
    click(cta);
    await h.until(() => text(el('pw-title')) === 'Confirm your password');
    expect(text(el('pw-lede'))).toBe('Enter the same password to verify.');
    expect(field.value).toBe('');
    expect(el('pw-dot-2').classList.contains('active')).toBe(true);
    expect(visible(el('pw-meter'))).toBe(false);
  });

  it('mismatch: "Passwords don’t match — try again.", the shake, and the field cleared after 600 ms', async () => {
    const {h, field, cta, finished} = await shown();
    type(field, PW);
    click(cta);
    await h.until(() => text(el('pw-title')) === 'Confirm your password');
    type(field, `${PW}!`);
    click(cta);
    await h.until(() => text(el('pw-helper')) !== '');
    expect(text(el('pw-helper'))).toBe("Passwords don't match — try again.");
    expect(el('pw-helper').classList.contains('error')).toBe(true);
    expect(field.classList.contains('is-error')).toBe(true);
    expect(unstyled('v-password')).toEqual([]);
    h.timers.advance(MISMATCH_CLEAR_MS);
    expect(field.value).toBe('');
    expect(finished).toEqual([]);
  });

  it('creating: "Creating your wallet…" with the progress bar, every control disabled; then the store runs once (rule 6)', async () => {
    let release: () => void = () => undefined;
    const {h, field, cta, finished} = await shown(() => new Promise(r => (release = () => r(null))), {holdSleep: true});
    type(field, PW);
    click(cta);
    h.wake();
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(field, PW);
    click(cta);
    click(cta);
    await h.until(() => finished.length === 1);
    expect(visible(el('pw-creating'))).toBe(true);
    expect(text(el('pw-creating'))).toBe('Creating your wallet… Securing your password takes a few seconds.');
    expect(el('pw-creating').querySelector('progress.noc-progress')).not.toBeNull();
    expect(cta.disabled).toBe(true);
    expect(field.disabled).toBe(true);
    expect(el<HTMLButtonElement>('pw-back').disabled).toBe(true);
    release();
    click(cta);
    await new Promise(r => setTimeout(r, 5));
    // Settled, but inside the 500 ms floor: a second click does nothing.
    click(cta);
    expect(finished).toEqual([PW]);
    expect(unstyled('v-password')).toEqual([]);
  });

  it('a refusal shows its line; "exists" stops with no CTA', async () => {
    const {h, field, cta} = await shown(async () => ({line: 'A wallet already exists in this browser. Nothing was changed.', stop: true}));
    type(field, PW);
    click(cta);
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(field, PW);
    click(cta);
    await h.until(() => text(el('pw-helper')) === 'A wallet already exists in this browser. Nothing was changed.');
    expect(visible(cta)).toBe(false);
  });
});

describe('#6 passkey (D9)', () => {
  it('idle: the adapted copy (no "PIN still wins"), Add a passkey and Skip; Skip → #7', async () => {
    const h = await harness();
    const done: number[] = [];
    mountPasskey(h.deps, {done: () => done.push(1)}).show({get: () => PW, drop: () => undefined});
    const screen = el('v-passkey');
    expect(text(screen.querySelector('.top-bar .step'))).toBe('5 / 5');
    expect(text(screen.querySelector('h1'))).toBe('Unlock Noctura with a passkey');
    expect(text(screen.querySelector('h1 + p'))).toBe('Adds convenience. Your password always works too — keep it safe.');
    expect([...screen.querySelectorAll('.feature-row')].map(r => text(r))).toEqual([
      'Faster unlock Use your fingerprint, face or security key instead of typing your password.',
      'Password still works If the passkey is unavailable, your password unlocks the wallet and confirms everything.',
      "Where your passkey lives A passkey synced to Google, Apple or a password manager keeps its secret in that provider's cloud. Other extensions allowed on wallet.noc-tura.io can ask for it too.",
    ]);
    expect(text(screen)).not.toMatch(/PIN|fingerprint\b.*Enable|Resets on enrollment/);
    expect(text(el('pk-add'))).toBe('Add a passkey');
    expect(text(el('pk-skip'))).toBe('Skip — use password only');
    expect(unstyled('v-passkey')).toEqual([]);
    click(el('pk-skip'));
    expect(done).toEqual([1]);
  });

  it('a device without PRF: "Waiting for your passkey…", then unsupported + Continue → #7', async () => {
    const env = await createEnvelope({mnemonic: PHRASE, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}], kdf: testKdf});
    const h = await harness({vault: env, credentials: {create: async () => null, get: async () => null}});
    const done: number[] = [];
    mountPasskey(h.deps, {done: () => done.push(1)}).show({get: () => PW, drop: () => undefined});
    click(el('pk-add'));
    expect(text(el('pk-line'))).toBe('Waiting for your passkey…');
    await h.until(() => visible(el('pk-continue')));
    expect(text(el('pk-line'))).toBe('This device cannot unlock the wallet with a passkey; your password still works.');
    click(el('pk-continue'));
    expect(done).toEqual([1]);
  });

  it('no wallet stored (the store never landed): the failed line + Continue → #7', async () => {
    const h = await harness({vault: undefined});
    const done: number[] = [];
    mountPasskey(h.deps, {done: () => done.push(1)}).show({get: () => PW, drop: () => undefined});
    click(el('pk-add'));
    await h.until(() => visible(el('pk-continue')));
    expect(text(el('pk-line'))).toBe('Something went wrong. Your password still works.');
    click(el('pk-continue'));
    expect(done).toEqual([1]);
  });

  it('rule 6: a second [Add a passkey] before the first settles prompts nothing more', async () => {
    let creates = 0;
    const env = await createEnvelope({mnemonic: PHRASE, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}], kdf: testKdf});
    const h = await harness({vault: env, credentials: {create: async () => (creates++, null), get: async () => null}});
    mountPasskey(h.deps, {done: () => undefined}).show({get: () => PW, drop: () => undefined});
    click(el('pk-add'));
    click(el('pk-add'));
    await h.until(() => visible(el('pk-continue')));
    expect(text(el('pk-line'))).toBe('This device cannot unlock the wallet with a passkey; your password still works.');
    expect(creates).toBe(1);
  });

  it('when the tab was hidden after #5, it asks for the password once more before adding a passkey', async () => {
    const h = await harness();
    mountPasskey(h.deps, {done: () => undefined}).show({get: () => null, drop: () => undefined});
    click(el('pk-add'));
    await h.until(() => visible(el('pk-ask')));
    expect(text(el('pk-ask'))).toBe('Enter your password to add the passkey.');
    expect(unstyled('v-passkey')).toEqual([]);
  });
});

describe('the create run, end to end in one page, against the real background', () => {
  const HELD = HOLD_MS + TICK_MS;

  it('#1 → #2 → #3 → #4 → #5 → #6 → Skip → wallet.html#/created; the stored wallet is the phrase shown on #3', async () => {
    const h = await harness({mnemonic: PHRASE});
    startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
    await h.until(() => visible(el('wel-actions')));
    click(el('wel-create'));
    click(el('int-continue'));
    click(el('sg-continue'));
    const shownWords = [...el('seed-grid').querySelectorAll('.term')].map(text);
    expect(shownWords).toEqual(WORDS);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true}));
    h.timers.advance(HELD);
    el('seed-grid').dispatchEvent(new PointerEvent('pointerup', {bubbles: true}));
    click(el('seed-cta'));
    for (const s of [...el('cnf-slots').querySelectorAll('.label')]) {
      const n = Number(/#(\d+)/.exec(text(s))?.[1]);
      const b = [...el('cnf-pool').querySelectorAll('button')].find(x => text(x) === shownWords[n - 1]) as HTMLButtonElement;
      click(b);
    }
    click(el('cnf-cta'));
    click(el('cnf-cta'));
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => visible(el('v-passkey')));
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PW, testKdf))).toBe(PHRASE);
    expect((await getSession(h.ext))?.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
    // No word of the phrase is left in the DOM: #3 and #4 took theirs out when the run moved on.
    const page = text(document.body);
    expect(WORDS.filter(w => new RegExp(`\\b${w}\\b`).test(page))).toEqual([]);
    click(el('pk-skip'));
    expect(h.went).toEqual(['wallet.html#/created']);
  }, 30_000);
});
```

Modify `extension/src/unlock/__tests__/page.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/page.test.ts b/extension/src/unlock/__tests__/page.test.ts
index 158f12c..f224ee2 100644
--- a/extension/src/unlock/__tests__/page.test.ts
+++ b/extension/src/unlock/__tests__/page.test.ts
@@ -1,4 +1,4 @@
-import {LOCK_MS, exclusive, resumeTarget} from '../page';
+import {LOCK_MS, createPageGate, exclusive, resumeTarget} from '../page';
 import type {BusyGate} from '../orchestrate';
 
 // Spec §7.6, rule 6 on the vault page: the page's one busy gate, plus the same 500 ms floor.
@@ -48,6 +48,20 @@ describe('exclusive (rule 6)', () => {
   });
 });
 
+describe('createPageGate', () => {
+  it('tells every screen when the page frees up (an action begun on #5 ends on #6)', () => {
+    const gate = createPageGate();
+    const idle: string[] = [];
+    gate.onIdle(() => idle.push('a'));
+    gate.onIdle(() => idle.push('b'));
+    gate.setBusy(true);
+    expect(gate.isBusy()).toBe(true);
+    expect(idle).toEqual([]);
+    gate.setBusy(false);
+    expect(idle).toEqual(['a', 'b']);
+  });
+});
+
 describe('resumeTarget', () => {
   it('builds the resume route only for an address; nothing else can name a page', () => {
     expect(resumeTarget('HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk')).toBe('wallet.html#/send/resume?account=HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk');
```

Modify `extension/src/unlock/__tests__/pageHarness.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/pageHarness.ts b/extension/src/unlock/__tests__/pageHarness.ts
index fb5655b..0c70f47 100644
--- a/extension/src/unlock/__tests__/pageHarness.ts
+++ b/extension/src/unlock/__tests__/pageHarness.ts
@@ -8,8 +8,7 @@ import {handleMessage} from '../../background/messages';
 import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
 import {fakeExt} from '../../background/__tests__/fakeExt';
 import type {WalletDeps} from '../../background/deps';
-import type {BusyGate} from '../orchestrate';
-import type {PageDeps, PageTarget} from '../page';
+import {createPageGate, type PageDeps, type PageTarget} from '../page';
 import {backgroundVaultStore} from '../vaultStore';
 import type {Send} from '../types';
 import {VAULT_PAGE_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
@@ -40,6 +39,8 @@ export interface Harness {
   went: PageTarget[];
   closed: number;
   leave(): void;
+  /** With `holdSleep`: resolves every pending sleep (the 500 ms floor, a backoff wait). */
+  wake(): void;
   /** Lets pending work run until `done()` holds (the page awaits the background and the KDF); fails after 10 s. */
   until(done: () => boolean): Promise<void>;
 }
@@ -50,7 +51,9 @@ export interface Harness {
  * resolves at once: the 500 ms floor and the backoff waits are asserted through the clock where a
  * test needs them.
  */
-export async function harness(o: {vault?: unknown; reader?: Partial<WalletDeps['reader']>; send?: (inner: Send) => Send; credentials?: CredentialsApi; mnemonic?: string} = {}): Promise<Harness> {
+export async function harness(
+  o: {vault?: unknown; reader?: Partial<WalletDeps['reader']>; send?: (inner: Send) => Send; credentials?: CredentialsApi; mnemonic?: string; holdSleep?: boolean} = {},
+): Promise<Harness> {
   const ext = fakeExt();
   if ('vault' in o && o.vault !== undefined) await ext.local.set(VAULT_KEY, o.vault);
   const wallet = fakeDeps({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => [], ...o.reader})});
@@ -62,9 +65,9 @@ export async function harness(o: {vault?: unknown; reader?: Partial<WalletDeps['
   const send = o.send === undefined ? inner : o.send(inner);
   const read = () => ext.local.get(VAULT_KEY);
   const timers = fakeTimers();
-  let busy = false;
-  const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
+  const gate = createPageGate();
   const leaves: (() => void)[] = [];
+  const sleeping: (() => void)[] = [];
   const h: Harness = {
     ext,
     wallet,
@@ -80,13 +83,14 @@ export async function harness(o: {vault?: unknown; reader?: Partial<WalletDeps['
       randomBytes: n => crypto.getRandomValues(new Uint8Array(n)),
       newMnemonic: () => o.mnemonic ?? 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art',
       timers,
-      sleep: async () => undefined,
+      sleep: () => (o.holdSleep === true ? new Promise<void>(r => sleeping.push(r)) : Promise.resolve()),
       gate,
       go: t => void h.went.push(t),
       closeTab: () => void (h.closed += 1),
       onLeave: f => void leaves.push(f),
     },
     leave: () => leaves.forEach(f => f()),
+    wake: () => sleeping.splice(0).forEach(r => r()),
     until: async done => {
       const end = Date.now() + 10_000;
       while (!done()) {
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/create.test.ts src/unlock/__tests__/page.test.ts src/unlock/__tests__/pageHarness.ts`
Expected (dry run): FAIL — Test Files 2 failed (2) Tests 1 failed | 3 passed (4) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Create `extension/src/unlock/browser.ts`:

```ts
import {workerKdf} from '../vault/kdf';
import {readLocal} from '../shared/readLocal';
import {send} from '../ui/send';
import {newMnemonic} from './onboarding';
import {createPageGate, type PageDeps} from './page';
import {ENVELOPE_KEY} from './unlockFlow';
import {backgroundVaultStore} from './vaultStore';

/**
 * The vault page's real dependencies: the background by runtime message (the page never touches the
 * network or writes storage), v1_vault read through src/shared/readLocal, Argon2id in the page's worker,
 * the browser's WebAuthn, timers and tab. Tests build their own PageDeps (pageHarness.ts).
 */
export function browserPageDeps(): PageDeps {
  return {
    send,
    store: backgroundVaultStore(send, () => readLocal(ENVELOPE_KEY)),
    kdf: workerKdf,
    credentials: navigator.credentials,
    randomBytes: n => crypto.getRandomValues(new Uint8Array(n)),
    newMnemonic,
    timers: {
      now: () => Date.now(),
      setTimeout: (f, ms) => window.setTimeout(f, ms),
      clearTimeout: id => window.clearTimeout(id),
      setInterval: (f, ms) => window.setInterval(f, ms),
      clearInterval: id => window.clearInterval(id),
    },
    sleep: ms => new Promise<void>(resolve => setTimeout(resolve, ms)),
    // Cardinal rule 6: ONE busy flag for the whole page — a passkey prompt and a password submit share it.
    gate: createPageGate(),
    // Same tab: the page — and the phrase or password it held — goes away with the navigation.
    go: target => location.replace(target),
    closeTab: () => window.close(),
    onLeave: f => {
      addEventListener('pagehide', f);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') f();
      });
    },
  };
}
```

Modify `extension/src/unlock/main.ts`:

```diff
diff --git a/extension/src/unlock/main.ts b/extension/src/unlock/main.ts
index bc2af30..2d2163b 100644
--- a/extension/src/unlock/main.ts
+++ b/extension/src/unlock/main.ts
@@ -13,10 +13,11 @@ import {readLocal} from '../shared/readLocal';
 import type {EnvelopeV1} from '../vault/envelope';
 import {pageMode} from './mode';
 import {startMode} from './modes';
+import {browserPageDeps} from './browser';
 
 // unlock.html?mode=create|import|reauth&challenge=…|accounts|reveal shows that mode's section; no
 // mode is the unlock page below, whose handlers stay registered either way (on a hidden section).
-startMode(pageMode(location.search));
+startMode(pageMode(location.search), browserPageDeps());
 
 // The vault page renders only its own fixed strings — nothing from a dApp, a token or the
 // network (spec §1). Every status line below is one of the WORDS/literal strings in this file.
```

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index bba7d1b..9ea3ec2 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -1,11 +1,14 @@
 import {ENVELOPE_KEY} from './unlockFlow';
-import {MIN_PASSWORD_LENGTH, detectImport, finishOnboarding, indexesFor, newMnemonic, type Candidate, type FinishOutcome, type ProbeResult} from './onboarding';
+import {MIN_PASSWORD_LENGTH, detectImport, finishOnboarding, indexesFor, type Candidate, type FinishOutcome, type ProbeResult} from './onboarding';
 import {addAccount, removeAccount, type AccountsOutcome} from './accountsFlow';
 import {runReauth, type ReauthPageOutcome} from './reauthFlow';
 import {runReveal, type RevealOutcome} from './revealFlow';
 import {createWrongBackoff, runExclusive, type BusyGate} from './orchestrate';
 import {backgroundVaultStore} from './vaultStore';
 import type {PageMode} from './mode';
+import type {PageDeps} from './page';
+import {startCreateRun} from './screens/createRun';
+import {showScreen} from './view/dom';
 import {workerKdf} from '../vault/kdf';
 import {evaluatePrf} from '../vault/passkey';
 import {unb64} from '../vault/bytes';
@@ -69,8 +72,8 @@ const REVEAL_WORDS: Record<RevealOutcome['outcome'], string> = {
 };
 const WAIT = 'That did not confirm it. Wait a moment before trying again.';
 const UNREADABLE = "This wallet's stored data could not be read. Reload this page.";
-// `welcome` (B1b-2a plan 1, minimal): two links to create and import, fixed strings in unlock.html. Plan 2 replaces it with #1.
-const SECTIONS = ['unlock-section', 'welcome', 'create', 'import', 'reauth', 'accounts', 'reveal'] as const;
+// The B1b-1 thin sections the plan-2 screens have not replaced yet.
+const SECTIONS = ['unlock-section', 'import', 'reauth', 'accounts', 'reveal'] as const;
 
 const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
 const say = (text: string): void => {
@@ -93,50 +96,32 @@ function showWords(list: HTMLElement, words: readonly string[]): void {
   );
 }
 
-export function startMode(mode: PageMode): void {
-  const shown = mode.mode === 'unlock' ? 'unlock-section' : mode.mode;
+function legacy(shown: (typeof SECTIONS)[number] | null): void {
   for (const id of SECTIONS) $(id).hidden = id !== shown;
-  if (mode.mode === 'create') startCreate();
+  $('status').hidden = shown === null;
+}
+
+export function startMode(mode: PageMode, deps: PageDeps): void {
+  if (mode.mode === 'welcome' || mode.mode === 'create') {
+    legacy(null);
+    startCreateRun(deps, {
+      at: mode.mode === 'welcome' ? 'welcome' : 'intro',
+      importRun: () => {
+        showScreen(null);
+        legacy('import');
+        startImport();
+      },
+    });
+    return;
+  }
+  const shown = mode.mode === 'unlock' || mode.mode === 'forgot' ? 'unlock-section' : mode.mode;
+  legacy(shown);
   if (mode.mode === 'import') startImport();
   if (mode.mode === 'reauth') startReauth(mode.challengeId);
   if (mode.mode === 'accounts') startAccounts();
   if (mode.mode === 'reveal') startReveal();
 }
 
-function startCreate(): void {
-  let mnemonic: string | null = newMnemonic();
-  const words = $('words');
-  showWords(words, mnemonic.split(' '));
-  const button = $<HTMLButtonElement>('create-btn');
-  button.addEventListener('click', () => {
-    void runExclusive(gate, async () => {
-      // The fields are cleared only once the attempt goes ahead: a click the busy gate or the
-      // checkbox turns away leaves what was typed.
-      if (mnemonic === null) return;
-      if (!$<HTMLInputElement>('saved').checked) return say('Write the words down first, then tick the box.');
-      const pw = $<HTMLInputElement>('new-password');
-      const pw2 = $<HTMLInputElement>('new-password2');
-      const password = pw.value;
-      const repeated = pw2.value;
-      pw.value = '';
-      pw2.value = '';
-      if (password !== repeated) return say('The two passwords are not the same.');
-      button.disabled = true;
-      say('Creating the wallet…');
-      try {
-        const outcome = await finishOnboarding({...store, send, kdf: workerKdf}, {mnemonic, password, scheme: 'slip10', indexes: [0]});
-        say(FINISH_WORDS[outcome]);
-        if (outcome === 'created' || outcome === 'created-locked' || outcome === 'exists') {
-          words.replaceChildren();
-          mnemonic = null;
-        }
-      } finally {
-        button.disabled = false;
-      }
-    });
-  });
-}
-
 function startImport(): void {
   let pending: {mnemonic: string; password: string; candidates: Candidate[]; probe: ProbeResult} | null = null;
   const finish = async (scheme: 'slip10' | 'cli'): Promise<void> => {
```

Modify `extension/src/unlock/page.ts`:

```diff
diff --git a/extension/src/unlock/page.ts b/extension/src/unlock/page.ts
index 29aa70f..17ca620 100644
--- a/extension/src/unlock/page.ts
+++ b/extension/src/unlock/page.ts
@@ -32,6 +32,28 @@ export function resumeTarget(account: string): PageTarget | null {
   return ADDRESS.test(account) ? `wallet.html#/send/resume?account=${account}` : null;
 }
 
+/**
+ * The page's one busy gate (cardinal rule 6), which also tells every mounted screen when it frees up:
+ * an action started on one screen may end on another (#5's store shows #6), and that screen's buttons
+ * must come back too.
+ */
+export interface PageGate extends BusyGate {
+  onIdle(f: () => void): void;
+}
+
+export function createPageGate(): PageGate {
+  let busy = false;
+  const idle: (() => void)[] = [];
+  return {
+    isBusy: () => busy,
+    setBusy: b => {
+      busy = b;
+      if (!b) for (const f of idle) f();
+    },
+    onIdle: f => void idle.push(f),
+  };
+}
+
 /** What every vault-page screen is given: the background, the stored vault, the KDF, the clock and the tab. */
 export interface PageDeps {
   send: Send;
@@ -43,7 +65,7 @@ export interface PageDeps {
   timers: Timers;
   sleep(ms: number): Promise<void>;
   /** One busy flag for the whole page (cardinal rule 6): a passkey prompt and a password submit cannot race. */
-  gate: BusyGate;
+  gate: PageGate;
   /** Same-tab navigation (location.replace): the tab moves on and the page's memory goes with it. */
   go(target: PageTarget): void;
   /** window.close(); the screen hides [Close this tab] if the tab is still here a moment later. */
@@ -62,7 +84,7 @@ export const LOCK_MS = 500;
  * refused. `render` runs when the gate is taken and when it is released: a screen derives every
  * button's `disabled` from its own state and `gate.isBusy()`.
  */
-export function exclusive<T>(deps: Pick<PageDeps, 'gate' | 'sleep'>, render: () => void, action: () => Promise<T>): Promise<T | 'busy'> {
+export function exclusive<T>(deps: {gate: BusyGate; sleep(ms: number): Promise<void>}, render: () => void, action: () => Promise<T>): Promise<T | 'busy'> {
   return runExclusive(deps.gate, async () => {
     const floor = deps.sleep(LOCK_MS);
     render();
```

Create `extension/src/unlock/screens/confirm.ts`:

```ts
import {wordlist} from '@scure/bip39/wordlists/english.js';
import type {PageDeps} from '../page';
import {CONFIRM} from '../strings';
import {byId, h, setText, showScreen, shown} from '../view/dom';

/** #4's three positions (1–24) and its pool: per slot the correct word and two distractors. */
export interface ConfirmPlan {
  slots: {position: number; word: string}[];
  /** Nine words, three per slot in slot order, the correct one at a random place in its row. */
  pool: string[];
}

/** A uniform integer in [0, n), from the page's random bytes (rejection sampling: no modulo bias). */
export function randomBelow(randomBytes: (n: number) => Uint8Array, n: number): number {
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    const b = randomBytes(4);
    const x = (((b[0] ?? 0) << 24) | ((b[1] ?? 0) << 16) | ((b[2] ?? 0) << 8) | (b[3] ?? 0)) >>> 0;
    if (x < limit) return x % n;
  }
}

/**
 * Spec §3.4: three distinct positions of the 24, and a pool of nine — for each slot one correct word
 * and eight that are not. As the design draws it (4a: "orchid coral circle / vendor voyage vintage / lift
 * linger latch"), each row is a slot's word with two BIP-39 distractors starting with the same letter,
 * none of them a word of this phrase. Generated once per visit of #4.
 */
export function confirmPlan(words: readonly string[], randomBytes: (n: number) => Uint8Array): ConfirmPlan {
  const picked = new Set<number>();
  while (picked.size < 3) picked.add(randomBelow(randomBytes, words.length) + 1);
  const slots = [...picked].sort((a, b) => a - b).map(position => ({position, word: words[position - 1] ?? ''}));
  const used = new Set(words);
  const pool: string[] = [];
  for (const {word} of slots) {
    const pick = (): string => {
      const same = wordlist.filter(w => w[0] === word[0] && !used.has(w));
      const from = same.length > 0 ? same : wordlist.filter(w => !used.has(w));
      const w = from[randomBelow(randomBytes, from.length)] ?? '';
      used.add(w);
      return w;
    };
    const row = [word, pick(), pick()];
    const at = randomBelow(randomBytes, 3);
    [row[0], row[at]] = [row[at] ?? '', row[0] ?? ''];
    pool.push(...row);
  }
  return {slots, pool};
}

/** The design's ~700 ms before the slots reset after a wrong pick. */
export const RESET_MS = 700;

/**
 * #4 seed-confirm (spec §3.4): a pick fills the next empty slot. The right word → the slot is filled
 * and its button used and dimmed; the wrong one → "That's not the right word — let's start over." in
 * --danger, the slot shakes, "Word #N was wrong. Slots will reset in a moment.", and ~700 ms later
 * every slot and button resets. Three right words → [Confirm] → "Phrase verified" → [Continue] → #5.
 */
export function mountConfirm(deps: PageDeps, next: {back(): void; done(): void}): {show(words: readonly string[]): void} {
  const cta = byId<HTMLButtonElement>('cnf-cta');
  let plan: ConfirmPlan = {slots: [], pool: []};
  let filled: (string | null)[] = [];
  let resetting: number | null = null;
  let success = false;

  const render = () => {
    const slots = byId('cnf-slots');
    slots.replaceChildren(
      ...plan.slots.map((s, i) => {
        const value = filled[i] ?? null;
        const wrong = value !== null && value !== s.word;
        const el = h('div', 'slot');
        el.classList.toggle('empty', value === null);
        el.classList.toggle('filled', value !== null && !wrong);
        el.classList.toggle('correct', value !== null && !wrong);
        el.classList.toggle('wrong', wrong);
        const v = h('span', 'noc-mono value', value ?? CONFIRM.select);
        v.classList.toggle('placeholder', value === null);
        el.append(h('span', 'noc-body-sm label', CONFIRM.slot(s.position)), v);
        return el;
      }),
    );
    const usedWords = new Set(filled.filter((w): w is string => w !== null));
    const wrongWord = filled.find((w, i) => w !== null && w !== plan.slots[i]?.word) ?? null;
    byId('cnf-pool').replaceChildren(
      ...plan.pool.map(w => {
        const b = h('button', 'word-btn', w);
        b.type = 'button';
        b.classList.toggle('used', usedWords.has(w));
        b.classList.toggle('dim', usedWords.has(w));
        b.classList.toggle('vlt-wrong-word', w === wrongWord);
        b.disabled = usedWords.has(w) || resetting !== null;
        b.addEventListener('click', () => pick(w));
        return b;
      }),
    );
    const wrongAt = filled.findIndex((w, i) => w !== null && w !== plan.slots[i]?.word);
    setText(byId('cnf-lede'), wrongAt >= 0 ? CONFIRM.wrongLede : CONFIRM.lede);
    byId('cnf-lede').classList.toggle('vlt-danger', wrongAt >= 0);
    byId('cnf-lede').classList.toggle('vlt-lede', wrongAt < 0);
    setText(byId('cnf-helper'), wrongAt >= 0 ? CONFIRM.wrongHelper(plan.slots[wrongAt]?.position ?? 0) : '');
    shown(byId('cnf-helper'), wrongAt >= 0);
    shown(byId('cnf-main'), !success);
    shown(byId('cnf-success'), success);
    const complete = plan.slots.length > 0 && plan.slots.every((s, i) => filled[i] === s.word);
    cta.disabled = !success && !complete;
    setText(cta, success ? CONFIRM.continue : CONFIRM.confirm);
  };

  const stop = () => {
    if (resetting !== null) deps.timers.clearTimeout(resetting);
    resetting = null;
  };
  const pick = (w: string) => {
    if (resetting !== null || success) return;
    const at = filled.findIndex(x => x === null);
    if (at < 0) return;
    filled.splice(at, 1, w);
    if (w !== plan.slots[at]?.word) {
      resetting = deps.timers.setTimeout(() => {
        resetting = null;
        filled = plan.slots.map(() => null);
        render();
      }, RESET_MS);
    }
    render();
  };

  /** Leaving #4 takes its words (three of the phrase, and the pool) out of the DOM. */
  const leave = () => {
    stop();
    plan = {slots: [], pool: []};
    filled = [];
    byId('cnf-slots').replaceChildren();
    byId('cnf-pool').replaceChildren();
  };
  byId('cnf-back').addEventListener('click', () => {
    leave();
    next.back();
  });
  cta.addEventListener('click', () => {
    if (success) {
      leave();
      next.done();
      return;
    }
    if (!plan.slots.every((s, i) => filled[i] === s.word)) return;
    success = true;
    render();
  });

  return {
    show(words) {
      stop();
      plan = confirmPlan(words, deps.randomBytes);
      filled = plan.slots.map(() => null);
      success = false;
      render();
      showScreen('v-confirm');
    },
  };
}
```

Create `extension/src/unlock/screens/createRun.ts`:

```ts
import {finishOnboarding} from '../onboarding';
import type {PageDeps} from '../page';
import {PASSWORD} from '../strings';
import {mountConfirm} from './confirm';
import {mountPassword} from './password';
import {mountPasskey} from './passkey';
import {mountSeed} from './seed';
import {mountIntro, mountWelcome} from './welcome';

/**
 * The whole create run (spec S2, §3.1–§3.6) in ONE page: #1 → #2 → #3 → #4 → #5 → #6, so the new phrase
 * never crosses a navigation. It is generated when #3 is first reached and dropped once the wallet is
 * stored (or the page is left: it lives in this closure only). The password #5 sets is held for #6's
 * passkey and dropped when #6 ends or the tab is hidden. Every end hands over to the UI tab's #7
 * (`wallet.html#/created`), which shows its locked variant when the keys did not reach the background.
 */
export function startCreateRun(deps: PageDeps, o: {at: 'welcome' | 'intro'; importRun(): void}): void {
  let mnemonic: string | null = null;
  let password: string | null = null;
  const words = (): string[] => {
    mnemonic ??= deps.newMnemonic();
    return mnemonic.split(' ');
  };
  deps.onLeave(() => {
    password = null;
  });

  const welcome = mountWelcome(deps, {create: () => intro.show(), import: () => o.importRun()});
  const intro = mountIntro({back: () => void welcome.show(), continue: () => seed.show(words())});
  const seed = mountSeed(deps, {back: () => intro.show(), done: () => confirm.show(words())});
  const confirm = mountConfirm(deps, {back: () => seed.show(words()), done: () => passwordStep()});
  const pw = mountPassword(deps);
  const passkey = mountPasskey(deps, {done: () => deps.go('wallet.html#/created')});

  const passwordStep = () =>
    pw.show({
      eyebrow: PASSWORD.onboarding,
      step: PASSWORD.stepCreate,
      back: () => confirm.show(words()),
      finish: async chosen => {
        const phrase = mnemonic;
        if (phrase === null) return {line: PASSWORD.failed, stop: true};
        const out = await finishOnboarding({...deps.store, send: deps.send, kdf: deps.kdf}, {mnemonic: phrase, password: chosen, scheme: 'slip10', indexes: [0]});
        if (out === 'created' || out === 'created-locked' || out === 'exists') mnemonic = null;
        if (out === 'created') {
          password = chosen;
          passkey.show({get: () => password, drop: () => void (password = null)});
          return null;
        }
        if (out === 'created-locked') {
          deps.go('wallet.html#/created');
          return null;
        }
        if (out === 'exists') return {line: PASSWORD.exists, stop: true};
        return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, stop: false};
      },
    });

  if (o.at === 'welcome') void welcome.show();
  else intro.show();
}
```

Create `extension/src/unlock/screens/passkey.ts`:

```ts
import {addPasskey} from '../onboarding';
import {exclusive, type PageDeps} from '../page';
import {COMMON, PASSKEY} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';

/**
 * #6 biometric-setup → passkey (spec §3.6, D9): an optional step after the password, on the create path
 * only. [Add a passkey] runs addPasskey with the password #5 just set — held by the create run until this
 * step ends, and dropped when the tab is hidden or left; then this screen asks for it once more ("Enter
 * your password to add the passkey."). Any end — added, unsupported, failed, or Skip — hands over to the
 * UI tab's #7 (`done`).
 */
export function mountPasskey(deps: PageDeps, next: {done(): void}): {show(password: {get(): string | null; drop(): void}): void} {
  const add = byId<HTMLButtonElement>('pk-add');
  const skip = byId<HTMLButtonElement>('pk-skip');
  const proceed = byId<HTMLButtonElement>('pk-continue');
  const ask = byId('pk-ask');
  const input = byId<HTMLInputElement>('pk-password');
  let held: {get(): string | null; drop(): void} = {get: () => null, drop: () => undefined};
  let ended = false;

  const render = () => {
    const busy = deps.gate.isBusy();
    add.disabled = busy;
    skip.disabled = busy;
    shown(add, !ended);
    shown(skip, !ended);
    shown(proceed, ended);
  };
  const line = (text: string) => {
    setText(byId('pk-line'), text);
    shown(byId('pk-line'), text !== '');
  };
  const end = (text: string) => {
    held.drop();
    ended = true;
    shown(ask, false);
    line(text);
  };

  const run = () =>
    void exclusive(deps, render, async () => {
      if (ended) return;
      const password = held.get() ?? (ask.hidden ? null : input.value);
      if (password === null || password === '') {
        shown(ask, true);
        input.focus();
        return;
      }
      input.value = '';
      line(PASSKEY.adding);
      const out = await addPasskey({...deps.store, credentials: deps.credentials, randomBytes: deps.randomBytes}, {password, kdf: deps.kdf});
      if (out === 'wrong') {
        // Only a re-typed password can be wrong: the one #5 set just opened this wallet.
        held.drop();
        shown(ask, true);
        line(COMMON.wrongConfirm);
        return;
      }
      end(out === 'added' ? PASSKEY.added : out === 'unsupported' ? PASSKEY.unsupported : PASSKEY.failed);
    });

  deps.gate.onIdle(render);
  add.addEventListener('click', run);
  ask.addEventListener('submit', e => {
    e.preventDefault();
    run();
  });
  skip.addEventListener('click', () => {
    held.drop();
    next.done();
  });
  proceed.addEventListener('click', () => next.done());

  return {
    show(password) {
      held = password;
      ended = false;
      input.value = '';
      shown(ask, false);
      line('');
      render();
      showScreen('v-passkey');
    },
  };
}
```

Create `extension/src/unlock/screens/password.ts`:

```ts
import {MIN_PASSWORD_LENGTH} from '../onboarding';
import {exclusive, type PageDeps} from '../page';
import {PASSWORD} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {renderMeter} from '../view/meter';

/** The design's 600 ms before the confirm field clears after a mismatch. */
export const MISMATCH_CLEAR_MS = 600;

export interface PasswordRun {
  /** "Onboarding" (create, import) or "Recovery" (#39's restore). */
  eyebrow: string;
  /** "4 / 5", "Import · 2 / 2" or "Restore · 2 / 2". */
  step: string;
  back(): void;
  /**
   * Stores the wallet with this password (seconds: Argon2id). Returns null when it went on (the caller
   * moved the page on), or the line to show; `stop` when nothing more can be tried here.
   */
  finish(password: string): Promise<{line: string; stop: boolean} | null>;
}

/**
 * #5 pin-create → create password (spec §3.5, D7): enter → confirm → creating. The field replaces the
 * design's 6 dots and keypad; the meter shows only the length rule. A mismatch says so, shakes the field
 * and clears it after 600 ms. While the wallet is created, every control is disabled (rule 6: the page's
 * one gate, ≥ 500 ms). The password lives in this closure only as long as one run needs it.
 */
export function mountPassword(deps: PageDeps): {show(run: PasswordRun): void} {
  const field = byId<HTMLInputElement>('pw-field');
  const cta = byId<HTMLButtonElement>('pw-cta');
  let run: PasswordRun | null = null;
  let step: 'enter' | 'confirm' | 'creating' | 'stopped' = 'enter';
  let first = '';
  let mismatch = false;
  let clearing: number | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    byId('pw-dot-1').classList.toggle('active', step === 'enter');
    byId('pw-dot-2').classList.toggle('active', step !== 'enter');
    setText(byId('pw-title'), step === 'enter' ? PASSWORD.enterTitle : PASSWORD.confirmTitle);
    setText(byId('pw-lede'), step === 'enter' ? PASSWORD.enterLede : PASSWORD.confirmLede);
    shown(byId('pw-meter'), step === 'enter');
    shown(byId('pw-meter-label'), step === 'enter');
    renderMeter(byId('pw-meter'), byId('pw-meter-label'), field.value.length);
    shown(byId('pw-creating'), step === 'creating');
    field.disabled = busy || step === 'creating' || step === 'stopped';
    byId<HTMLButtonElement>('pw-back').disabled = busy || step === 'creating';
    shown(cta, step !== 'stopped');
    cta.disabled = busy || step === 'creating' || (step === 'enter' ? field.value.length < MIN_PASSWORD_LENGTH : field.value.length === 0);
  };
  const helper = (text: string, error: boolean) => {
    setText(byId('pw-helper'), text);
    byId('pw-helper').classList.toggle('error', error);
  };
  const reset = () => {
    if (clearing !== null) deps.timers.clearTimeout(clearing);
    clearing = null;
    first = '';
    field.value = '';
    field.classList.remove('is-error');
    mismatch = false;
  };

  const submit = () =>
    void exclusive(deps, render, async () => {
      if (run === null || step === 'creating' || step === 'stopped') return;
      if (step === 'enter') {
        if (field.value.length < MIN_PASSWORD_LENGTH) return;
        first = field.value;
        field.value = '';
        step = 'confirm';
        helper('', false);
        field.focus();
        return;
      }
      const second = field.value;
      if (second !== first) {
        mismatch = true;
        helper(PASSWORD.mismatch, true);
        field.classList.add('is-error');
        clearing = deps.timers.setTimeout(() => {
          clearing = null;
          field.value = '';
          field.classList.remove('is-error');
          render();
        }, MISMATCH_CLEAR_MS);
        return;
      }
      step = 'creating';
      helper('', false);
      field.value = '';
      render();
      const password = first;
      first = '';
      const out = await run.finish(password);
      if (out === null) return;
      helper(out.line, true);
      // A refusal that can be retried keeps nothing typed: the confirm step starts again.
      step = out.stop ? 'stopped' : 'enter';
    });

  deps.gate.onIdle(render);
  field.addEventListener('input', () => {
    if (mismatch) {
      mismatch = false;
      field.classList.remove('is-error');
      helper('', false);
    }
    render();
  });
  byId('pw-form').addEventListener('submit', e => {
    e.preventDefault();
    submit();
  });
  cta.addEventListener('click', submit);
  byId('pw-toggle').addEventListener('click', () => {
    const show = field.type === 'password';
    field.type = show ? 'text' : 'password';
    byId('pw-toggle').setAttribute('aria-label', show ? PASSWORD.hide : PASSWORD.show);
    byId('pw-toggle-icon').setAttribute('href', show ? '#i-eye-off' : '#i-eye-on');
  });
  byId('pw-back').addEventListener('click', () => {
    if (step === 'creating') return;
    if (step === 'confirm') {
      reset();
      step = 'enter';
      helper(PASSWORD.enterHelper, false);
      render();
      return;
    }
    reset();
    run?.back();
  });
  // Leaving or hiding the tab drops what was typed but not yet used (spec §3.5 memory rule).
  deps.onLeave(() => {
    if (step === 'confirm' || step === 'enter') {
      reset();
      if (step === 'confirm') step = 'enter';
      render();
    }
  });

  return {
    show(r) {
      run = r;
      reset();
      step = 'enter';
      field.type = 'password';
      setText(byId('pw-eyebrow'), r.eyebrow);
      setText(byId('pw-step'), r.step);
      helper(PASSWORD.enterHelper, false);
      render();
      showScreen('v-password');
    },
  };
}
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index c17a525..aec2ad7 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -45,10 +45,47 @@ export const SEED = {
   chipLate: '— still memorizing?',
 } as const;
 
+/** #4 seed-confirm. */
+export const CONFIRM = {
+  lede: 'Tap the correct word for each position.',
+  wrongLede: "That's not the right word — let's start over.",
+  slot: (position: number): string => `Word #${position}`,
+  select: '— select —',
+  wrongHelper: (position: number): string => `Word #${position} was wrong. Slots will reset in a moment.`,
+  confirm: 'Confirm',
+  continue: 'Continue',
+} as const;
+
 /** #5 create password (D7). */
 export const PASSWORD = {
   longEnough: 'Long enough',
   lengthOf: (n: number): string => `${n} of 12 characters`,
+  onboarding: 'Onboarding',
+  recovery: 'Recovery',
+  stepCreate: '4 / 5',
+  stepImport: 'Import · 2 / 2',
+  stepRestore: 'Restore · 2 / 2',
+  enterTitle: 'Create a password',
+  enterLede: "At least 12 characters. You'll need it to unlock the wallet and to confirm risky sends.",
+  enterHelper: 'Choose something long and memorable — a few unrelated words work well.',
+  confirmTitle: 'Confirm your password',
+  confirmLede: 'Enter the same password to verify.',
+  mismatch: "Passwords don't match — try again.",
+  show: 'Show password',
+  hide: 'Hide password',
+  /** finishOnboarding's outcomes (the B1b-1 strings). */
+  exists: 'A wallet already exists in this browser. Nothing was changed.',
+  weak: 'The password must be at least 12 characters.',
+  invalid: 'That is not a valid 12- or 24-word recovery phrase.',
+  failed: 'Something went wrong. Nothing was saved.',
+} as const;
+
+/** #6 biometric-setup → passkey (D9). */
+export const PASSKEY = {
+  adding: 'Waiting for your passkey…',
+  added: 'Passkey added.',
+  unsupported: 'This device cannot unlock the wallet with a passkey; your password still works.',
+  failed: 'Something went wrong. Your password still works.',
 } as const;
 
 /** #9's cooldown card (and #10's, which reuses it): "0:12", and the design's helper line. */
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 95e396e..49e28b7 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -74,6 +74,23 @@
 .vlt-gap-top-5 {
   margin-top: var(--space-5);
 }
+.vlt-pad-y {
+  padding: var(--space-2) 0;
+}
+.vlt-pad-6 {
+  padding: 0 var(--space-6);
+}
+.vlt-narrow {
+  max-width: 280px;
+}
+.vlt-narrow-300 {
+  max-width: 300px;
+  margin: 0 auto;
+}
+.vlt-features {
+  margin-top: var(--space-7);
+  padding: 0 var(--space-2);
+}
 .vlt-pad {
   padding: 0 var(--space-5);
 }
@@ -116,3 +133,71 @@
   user-select: none;
   cursor: pointer;
 }
+
+/* #4: the wrong pick, as the mockup colours it inline. Reduced motion: colour only (design note). */
+.vlt-col .s-confirm .word-btn.vlt-wrong-word {
+  border-color: var(--danger);
+  color: var(--danger);
+}
+.vlt-col .s-confirm .slot.wrong .value {
+  color: var(--danger);
+}
+.vlt-col .s-confirm .word-btn {
+  cursor: pointer;
+}
+
+/* #5, #6, #9, #10, #8's retry step: the password field that replaces the design's PIN keypad (D7),
+   with the design's input look (#8's .pwd-input: 52 px, --bg-surface-3, the accent border on focus). */
+.vlt-field-row {
+  display: flex;
+  align-items: center;
+  gap: var(--space-2);
+  width: 100%;
+  margin-top: var(--space-5);
+}
+.vlt-input {
+  flex: 1;
+  width: 100%;
+  height: 52px;
+  padding: 0 var(--space-4);
+  background: var(--bg-surface-3);
+  border: 1px solid transparent;
+  border-radius: var(--radius-md);
+  color: var(--fg-primary);
+  font: 400 15px/22px var(--font-body);
+}
+.vlt-input:focus {
+  outline: none;
+  border-color: var(--accent);
+}
+.vlt-input.is-error {
+  border-color: var(--danger);
+  animation: shake 320ms cubic-bezier(0.2, 0, 0, 1);
+}
+.vlt-field-row .icon-btn {
+  width: var(--touch-target-min);
+  height: var(--touch-target-min);
+  color: var(--fg-secondary);
+}
+/* #5's length meter (D7): four bars, filling at 3/6/9/12 characters. */
+.vlt-meter {
+  display: flex;
+  gap: var(--space-2);
+  width: 100%;
+  margin-top: var(--space-3);
+}
+.vlt-meter i {
+  flex: 1;
+  height: 4px;
+  border-radius: 2px;
+  background: var(--bg-surface-3);
+}
+.vlt-meter i.filled {
+  background: var(--accent);
+}
+@media (prefers-reduced-motion: reduce) {
+  .vlt-input.is-error,
+  .vlt-col .s-confirm .slot.wrong {
+    animation: none;
+  }
+}
```

Modify `extension/src/unlock/view/dom.ts`:

```diff
diff --git a/extension/src/unlock/view/dom.ts b/extension/src/unlock/view/dom.ts
index a29ea52..f1eb436 100644
--- a/extension/src/unlock/view/dom.ts
+++ b/extension/src/unlock/view/dom.ts
@@ -46,8 +46,8 @@ export const SCREENS = [
 ] as const;
 export type ScreenId = (typeof SCREENS)[number];
 
-/** Shows one screen and hides the others; the tab starts it at the top. */
-export function showScreen(id: ScreenId): void {
+/** Shows one screen and hides the others (null: none); the tab starts it at the top. */
+export function showScreen(id: ScreenId | null): void {
   for (const s of SCREENS) {
     const el = document.getElementById(s);
     if (el !== null) el.hidden = s !== id;
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 4211291..2259638 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -100,22 +100,6 @@
         </form>
         <button id="passkey" type="button" hidden>Unlock with passkey</button>
       </section>
-      <section id="welcome" hidden>
-        <h1>Noctura</h1>
-        <p><a id="welcome-create" href="unlock.html?mode=create">Create a wallet</a></p>
-        <p><a id="welcome-import" href="unlock.html?mode=import">Import a wallet</a></p>
-      </section>
-      <section id="create" hidden>
-        <h1>Create a wallet</h1>
-        <p>Write these 24 words down, in order. They are the only way to recover this wallet.</p>
-        <ol id="words"></ol>
-        <label><input id="saved" type="checkbox" /> I wrote the words down</label>
-        <label for="new-password">Password (at least 12 characters)</label>
-        <input id="new-password" type="password" autocomplete="new-password" minlength="12" />
-        <label for="new-password2">Repeat the password</label>
-        <input id="new-password2" type="password" autocomplete="new-password" minlength="12" />
-        <button id="create-btn" type="button">Create wallet</button>
-      </section>
       <section id="import" hidden>
         <h1>Import a wallet</h1>
         <label for="phrase">Recovery phrase (12 or 24 words)</label>
@@ -208,6 +192,109 @@
         </div>
       </section>
 
+      <!-- #4 seed-confirm (spec §3.4): three random slots, one pool of nine words. -->
+      <section id="v-confirm" class="screen s-confirm" hidden>
+        <div class="top-bar">
+          <button id="cnf-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
+          <span class="title noc-overline vlt-muted">Onboarding</span>
+          <span class="step noc-body-sm noc-numeral">3 / 5</span>
+        </div>
+        <div id="cnf-main" class="scroll-area">
+          <h1 class="noc-h1 vlt-gap-2">Confirm phrase</h1>
+          <p id="cnf-lede" class="noc-body vlt-lede vlt-gap-4"></p>
+          <div id="cnf-slots" class="slots"></div>
+          <p id="cnf-helper" class="noc-caption vlt-danger vlt-pad-y" role="alert" hidden></p>
+          <div id="cnf-pool" class="pool"></div>
+        </div>
+        <div id="cnf-success" class="success-state" hidden>
+          <div class="ring"><svg width="36" height="36" aria-hidden="true"><use href="#i-check" /></svg></div>
+          <div>
+            <h2 class="noc-h2 vlt-gap-2">Phrase verified</h2>
+            <p class="noc-body vlt-lede vlt-narrow">All three words matched. Now lock the wallet with a password.</p>
+          </div>
+        </div>
+        <div class="sticky-bar">
+          <button id="cnf-cta" type="button" class="btn btn-primary" disabled></button>
+        </div>
+      </section>
+
+      <!-- #5 pin-create → create password (spec §3.5, D7): also the import path's and the restore path's password. -->
+      <section id="v-password" class="screen s-pin" hidden>
+        <div class="top-bar">
+          <button id="pw-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
+          <span id="pw-eyebrow" class="title noc-overline vlt-muted"></span>
+          <span id="pw-step" class="step noc-body-sm noc-numeral"></span>
+        </div>
+        <div class="pin-head">
+          <div class="step-dot"><i id="pw-dot-1"></i><i id="pw-dot-2"></i></div>
+          <h1 id="pw-title" class="noc-h1"></h1>
+          <p id="pw-lede" class="noc-body vlt-lede vlt-narrow"></p>
+          <form id="pw-form" class="vlt-field-row">
+            <input id="pw-field" class="vlt-input" type="password" autocomplete="new-password" minlength="12" aria-label="Password" />
+            <button id="pw-toggle" type="button" class="icon-btn" aria-label="Show password"><svg width="20" height="20" aria-hidden="true"><use id="pw-toggle-icon" href="#i-eye-on" /></svg></button>
+          </form>
+          <div id="pw-meter" class="vlt-meter" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
+          <p id="pw-meter-label" class="noc-caption vlt-muted"></p>
+        </div>
+        <p id="pw-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        <div id="pw-creating" class="vlt-notice" role="status" hidden>
+          <p class="noc-body">Creating your wallet…</p>
+          <p class="noc-body-sm vlt-lede">Securing your password takes a few seconds.</p>
+          <progress class="noc-progress" aria-label="Creating your wallet"></progress>
+        </div>
+        <div class="pin-spacer"></div>
+        <div class="sticky-bar">
+          <button id="pw-cta" type="button" class="btn btn-primary">Continue</button>
+        </div>
+      </section>
+
+      <!-- #6 biometric-setup → passkey (spec §3.6, D9). -->
+      <section id="v-passkey" class="screen s-bio" hidden>
+        <div class="top-bar">
+          <span class="title noc-overline vlt-muted">Onboarding</span>
+          <span class="step noc-body-sm noc-numeral">5 / 5</span>
+        </div>
+        <div class="hero-icon"><svg width="56" height="56" aria-hidden="true"><use href="#i-key" /></svg></div>
+        <div class="vlt-pad-6 vlt-center">
+          <h1 class="noc-h1 vlt-gap-2">Unlock Noctura with a passkey</h1>
+          <p class="noc-body vlt-lede vlt-narrow-300">Adds convenience. Your password always works too — keep it safe.</p>
+        </div>
+        <div class="vlt-features">
+          <div class="feature-row">
+            <div class="icon"><svg width="18" height="18" aria-hidden="true"><use href="#i-check" /></svg></div>
+            <div>
+              <div class="noc-body-lg">Faster unlock</div>
+              <div class="noc-body-sm vlt-lede">Use your fingerprint, face or security key instead of typing your password.</div>
+            </div>
+          </div>
+          <div class="feature-row">
+            <div class="icon"><svg width="18" height="18" aria-hidden="true"><use href="#i-shield-lock" /></svg></div>
+            <div>
+              <div class="noc-body-lg">Password still works</div>
+              <div class="noc-body-sm vlt-lede">If the passkey is unavailable, your password unlocks the wallet and confirms everything.</div>
+            </div>
+          </div>
+          <div class="feature-row">
+            <div class="icon"><svg width="18" height="18" aria-hidden="true"><use href="#i-info" /></svg></div>
+            <div>
+              <div class="noc-body-lg">Where your passkey lives</div>
+              <div class="noc-body-sm vlt-lede">A passkey synced to Google, Apple or a password manager keeps its secret in that provider's cloud. Other extensions allowed on wallet.noc-tura.io can ask for it too.</div>
+            </div>
+          </div>
+        </div>
+        <form id="pk-ask" class="vlt-pad" hidden>
+          <p class="noc-body-sm vlt-lede">Enter your password to add the passkey.</p>
+          <input id="pk-password" class="vlt-input" type="password" autocomplete="current-password" aria-label="Password" />
+        </form>
+        <p id="pk-line" class="noc-body vlt-center vlt-pad" role="status" hidden></p>
+        <div class="vlt-grow"></div>
+        <div class="sticky-bar">
+          <button id="pk-add" type="button" class="btn btn-primary">Add a passkey</button>
+          <button id="pk-skip" type="button" class="btn btn-secondary">Skip — use password only</button>
+          <button id="pk-continue" type="button" class="btn btn-primary" hidden>Continue</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/create.test.ts src/unlock/__tests__/page.test.ts src/unlock/__tests__/pageHarness.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 91 passed (91) Tests 1156 passed (1156).

- [ ] **Step 5: The E2E that created a wallet through the old markup.** `e2e/vaultPage.ts` (new) drives the create run in a real browser; `wallet.spec.ts`'s first test uses it:

Create `extension/e2e/vaultPage.ts`:

```ts
import {expect, type Page} from '@playwright/test';

/**
 * Drives the real vault page (unlock.html) through its screens, as a person would: clicks, a real
 * 2 s press-and-hold on #3, typed passwords. Every step waits on what the page shows.
 */

/** The create run (#2 → #3 → #4 → #5 → #6 skip). Returns the 24 words #3 showed. */
export async function createWallet(vault: Page, id: string, password: string): Promise<string[]> {
  await vault.goto(`chrome-extension://${id}/unlock.html?mode=create`);
  await vault.locator('#int-continue').click();
  await vault.locator('#sg-continue').click();
  const words = await vault.locator('#seed-grid .term').allTextContents();
  expect(words).toHaveLength(24);
  await holdToReveal(vault);
  await expect(vault.locator('#seed-stamp')).toBeVisible();
  await vault.locator('#seed-cta').click();
  await confirmWords(vault, words);
  await vault.locator('#cnf-cta').click();
  await expect(vault.getByText('Phrase verified')).toBeVisible();
  await vault.locator('#cnf-cta').click();
  await setPassword(vault, password);
  await expect(vault.locator('#v-passkey')).toBeVisible({timeout: 60_000});
  await vault.locator('#pk-skip').click();
  await vault.waitForURL(/\/wallet\.html#\/created$/);
  return words;
}

/** #3: a real press-and-hold, past the 2 s hold. */
export async function holdToReveal(vault: Page): Promise<void> {
  await vault.locator('#seed-grid').hover();
  await vault.mouse.down();
  await expect(vault.locator('#seed-chip')).toBeVisible({timeout: 5_000});
  await vault.mouse.up();
}

/** #4: picks each slot's word from the pool. */
export async function confirmWords(vault: Page, words: readonly string[]): Promise<void> {
  for (const label of await vault.locator('#cnf-slots .label').allTextContents()) {
    const n = Number(/#(\d+)/.exec(label)?.[1]);
    await vault.locator('#cnf-pool').getByRole('button', {name: words[n - 1], exact: true}).click();
  }
}

/** #5: enter, then confirm. */
export async function setPassword(vault: Page, password: string): Promise<void> {
  await vault.locator('#pw-field').fill(password);
  await vault.locator('#pw-cta').click();
  await expect(vault.locator('#pw-title')).toHaveText('Confirm your password');
  await vault.locator('#pw-field').fill(password);
  await vault.locator('#pw-cta').click();
}
```

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
index 5b4e994..6d2bc74 100644
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -3,6 +3,7 @@ import {readFileSync, rmSync} from 'node:fs';
 import {BLOCKHASH_LIFETIME, installFakeCoordinator, type FakeCoordinator} from './fakeCoordinator';
 import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';
 import {containNocTura, containSolscan, expectContained, launchContained} from './launch';
+import {createWallet} from './vaultPage';
 // Read from the source rather than imported: core/ has no package.json "type", so Playwright's loader
 // on Node 22 (CI) treats core/solana/rpc.ts as CommonJS and cannot take a named export from it.
 // The same literal the RPC-method gate parses; not found means it moved — fail loudly.
@@ -100,16 +101,9 @@ function onlyTheSimulatedCoordinator(fake: FakeCoordinator, solscan: {hits: stri
 test('create a wallet, unlock it, re-authenticate a first send, send SOL: pending → confirmed', async () => {
   const {ctx, fake, id, popup, sw, profile, solscan, nocTura} = await launch();
   try {
-    // 1. Onboarding: the vault page's create mode.
+    // 1. Onboarding: the vault page's create run (#2 → #3 → #4 → #5 → #6), handed over to #7.
     const vault = await ctx.newPage();
-    await vault.goto(`chrome-extension://${id}/unlock.html?mode=create`);
-    await expect(vault.locator('#words li')).toHaveCount(24);
-    await vault.check('#saved');
-    await vault.fill('#new-password', NEW_PASSWORD);
-    await vault.fill('#new-password2', NEW_PASSWORD);
-    await vault.click('#create-btn');
-    await expect(vault.locator('#status')).toHaveText('Wallet created. You can close this tab.', {timeout: 60_000});
-    await expect(vault.locator('#words li')).toHaveCount(0);
+    await createWallet(vault, id, NEW_PASSWORD);
 
     // 2. Lock, then unlock with the password (B1a's unlock mode).
     expect((await msg(popup, {type: 'vault.lock'})).ok).toBe(true);
```

Run: `npm run build && npx playwright test e2e/wallet.spec.ts e2e/unlock.spec.ts`
Expected: 3 passed.

- [ ] **Step 6: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- leaving #4 leaves its words → RED Tests  1 failed | 15 passed (16)
- a mismatch never clears → RED Tests  1 failed | 15 passed (16)
- #5 without the page gate → RED Tests  5 failed | 11 passed (16)

- [ ] **Step 7: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `04-empty`, `04-partial-correct`, `04-wrong-answer`, `04-success`, `05-enter`, `05-confirm`, `05-mismatch`, `05-creating`, `06-passkey-idle`, `06-adding`, `06-unsupported`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/e2e/vaultPage.ts extension/e2e/wallet.spec.ts extension/src/unlock/__tests__/create.test.ts extension/src/unlock/__tests__/page.test.ts extension/src/unlock/__tests__/pageHarness.ts extension/src/unlock/browser.ts extension/src/unlock/main.ts extension/src/unlock/modes.ts extension/src/unlock/page.ts extension/src/unlock/screens/confirm.ts extension/src/unlock/screens/createRun.ts extension/src/unlock/screens/passkey.ts extension/src/unlock/screens/password.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/src/unlock/view/dom.ts extension/unlock.html
git commit -m "feat(extension): #4 seed-confirm, #5 create password, #6 passkey — the create run in one vault page" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 9: #8 import — the field, the cell grid, paste, the idle timer, the scheme choice — and the plain import run

**Files:**
- Modify: `extension/src/unlock/__tests__/create.test.ts`
- Create: `extension/src/unlock/__tests__/import.test.ts`
- Modify: `extension/src/unlock/modes.ts`
- Modify: `extension/src/unlock/screens/createRun.ts`
- Create: `extension/src/unlock/screens/importRun.ts`
- Create: `extension/src/unlock/screens/importScreen.ts`
- Modify: `extension/src/unlock/screens/password.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Tasks 1, 4, 5, 8; `detectImport`, `indexesFor`, `finishOnboarding` (plan 1).
- Produces: `src/unlock/screens/importScreen.ts`: `IDLE_WARN_MS = 48_000`, `IDLE_WIPE_MS = 60_000`, `interface ImportScreen {show(o?: {phrase?: string}); line(text: string | null); choose(why: string): Promise<'slip10' | 'cli'>; clear()}`, `mountImport(deps, handlers: {back(): void; next(phrase: string): Promise<void>}): ImportScreen`; `src/unlock/screens/importRun.ts`: `createImportRun(deps, o: {password: PasswordScreen; back(): void}): {show(): void}`; `createRun.ts`: `createCreateRun(deps, o: {password: PasswordScreen; importRun(): void}): {start(at: 'welcome' | 'intro'): void}` (replaces Task 8's `startCreateRun`); `strings.ts`: `IMPORT`

Spec §3.8. `phrase idle`: "Import wallet" / "Bring an existing wallet onto this device.", the field (`autocomplete="off"`, `spellcheck="false"`), the D8 banner, `[Continue]` disabled until 12 or 24 words with a valid checksum (the segmented control and the backup-file tab are gone, D17). The words typed so far show in the design's mono cell grid under the field (Scope 3), with "N of 12 words entered." until valid, then "Valid N-word BIP-39 phrase · checksum OK". `paste-detected`: the toast that does **not** claim to clear the clipboard. `idle-timer-active`: after 48 s without input, "Auto-clearing in 12 s" / "No activity for 60 s — phrase will be wiped from this field." + `[Keep working — reset timer]`; at 60 s the field and grid are emptied. `checking`, `choose-scheme` (the B1b-1 strings, now in two `.noc-card` rows), `invalid-mnemonic`.

`createImportRun` (the plain path): #8 → detection (the background's probe, public keys only) → the scheme → #5 "Import · 2 / 2" → `wallet.html#/imported` (no #6 on this path, D9). Back from #5 returns to #8 with the phrase back in the field. The phrase is kept while the page is open, **a hidden tab included** — §3.5's hidden-tab rule is the password's, and dropping the phrase under an open #5 would end the run on an untrue "That is not a valid 12- or 24-word recovery phrase." (plan-2 review M4; Scope 19); it goes when the wallet is stored, on `exists`, on Back, and with the page. The create run's "I have a wallet" opens the import run in the **same page**; each screen is mounted once per page and the runs share #5 (`createCreateRun` takes the shared `PasswordScreen`).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/unlock/__tests__/create.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/create.test.ts b/extension/src/unlock/__tests__/create.test.ts
index 23f45ff..6371b5e 100644
--- a/extension/src/unlock/__tests__/create.test.ts
+++ b/extension/src/unlock/__tests__/create.test.ts
@@ -6,7 +6,7 @@ import {getSession} from '../../background/session';
 import {RESET_MS, confirmPlan, mountConfirm} from '../screens/confirm';
 import {MISMATCH_CLEAR_MS, mountPassword} from '../screens/password';
 import {mountPasskey} from '../screens/passkey';
-import {startCreateRun} from '../screens/createRun';
+import {createCreateRun} from '../screens/createRun';
 import {HOLD_MS, TICK_MS} from '../view/hold';
 import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';
 
@@ -294,7 +294,7 @@ describe('the create run, end to end in one page, against the real background',
 
   it('#1 → #2 → #3 → #4 → #5 → #6 → Skip → wallet.html#/created; the stored wallet is the phrase shown on #3', async () => {
     const h = await harness({mnemonic: PHRASE});
-    startCreateRun(h.deps, {at: 'welcome', importRun: () => undefined});
+    createCreateRun(h.deps, {password: mountPassword(h.deps), importRun: () => undefined}).start('welcome');
     await h.until(() => visible(el('wel-actions')));
     click(el('wel-create'));
     click(el('int-continue'));
```

Create `extension/src/unlock/__tests__/import.test.ts`:

```ts
// @vitest-environment happy-dom
import {decryptMnemonic, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {VAULT_KEY} from '../../background/accountsStore';
import {IDLE_WARN_MS, mountImport} from '../screens/importScreen';
import {createImportRun} from '../screens/importRun';
import {mountPassword} from '../screens/password';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const KCLI = 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o';
const PW = 'a long enough password';

beforeEach(loadPage);

describe('#8 import: the screen (spec §3.8)', () => {
  async function shown() {
    const h = await harness();
    const next: string[] = [];
    const backs: number[] = [];
    mountImport(h.deps, {back: () => backs.push(1), next: async p => void next.push(p)}).show();
    return {h, next, backs, field: el<HTMLTextAreaElement>('imp-phrase'), cta: el<HTMLButtonElement>('imp-continue')};
  }

  it('phrase idle: the title, lede, placeholder and the D8 banner; no backup file, no segmented control, no clipboard claim (D1, D17)', async () => {
    const {field, cta} = await shown();
    const screen = el('v-import');
    expect(text(screen.querySelector('.top-bar .title'))).toBe('Import wallet');
    expect(text(screen.querySelector('.vlt-import-lede'))).toBe('Bring an existing wallet onto this device.');
    expect(field.placeholder).toBe('Enter your 12 or 24-word recovery phrase, separated by spaces.');
    expect([field.getAttribute('autocomplete'), field.getAttribute('spellcheck')]).toEqual(['off', 'false']);
    expect(text(screen.querySelector('.banner.info:not(.toast)'))).toBe(
      "This phrase is also the root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.",
    );
    expect(cta.disabled).toBe(true);
    expect(text(screen)).not.toMatch(/Backup file|Screenshots|auto-clears from clipboard|clipboard cleared/);
    expect(screen.querySelector('.seg')).toBeNull();
    expect(unstyled('v-import')).toEqual([]);
  });

  it('typing: the words in the mono cell grid and "N of 12 words entered."; Continue stays off until a valid phrase', async () => {
    const {field, cta} = await shown();
    type(field, 'legend frost marble river coral anchor valid echo raven');
    expect([...el('imp-grid').querySelectorAll('.w')].map(text).slice(0, 10)).toEqual(['01 legend', '02 frost', '03 marble', '04 river', '05 coral', '06 anchor', '07 valid', '08 echo', '09 raven', '10 …']);
    expect(el('imp-grid').querySelectorAll('.w.empty')).toHaveLength(3);
    expect(text(el('imp-count'))).toBe('9 of 12 words entered.');
    expect(cta.disabled).toBe(true);
    expect(visible(el('imp-toast'))).toBe(false);
    expect(unstyled('v-import')).toEqual([]);
  });

  it('twelve words with a bad checksum are not a phrase: Continue stays off, the counter stays', async () => {
    const {field, cta} = await shown();
    type(field, 'abandon '.repeat(12).trim());
    expect(el('imp-grid').querySelectorAll('.w:not(.empty)')).toHaveLength(12);
    expect(text(el('imp-count'))).toBe('12 of 12 words entered.');
    expect(visible(el('imp-valid'))).toBe(false);
    expect(cta.disabled).toBe(true);
  });

  it('paste-detected: the toast that does not claim to clear the clipboard, the grid, "Valid 12-word … checksum OK", Continue on', async () => {
    const {field, cta, next} = await shown();
    field.dispatchEvent(new Event('paste', {bubbles: true}));
    type(field, M);
    expect(visible(el('imp-toast'))).toBe(true);
    expect(text(el('imp-toast'))).toBe('Pasted from clipboard. Noctura cannot clear your clipboard — clear it yourself.');
    expect(el('imp-grid').querySelectorAll('.w')).toHaveLength(12);
    expect(text(el('imp-valid'))).toBe('Valid 12-word BIP-39 phrase · checksum OK');
    expect(visible(el('imp-count'))).toBe(false);
    expect(cta.disabled).toBe(false);
    expect(unstyled('v-import')).toEqual([]);
    click(cta);
    await new Promise(r => setTimeout(r, 5));
    expect(next).toEqual([M]);
  });

  // Rule 6 (§7.6): the page's one gate — a second Continue before the first settles does nothing.
  it('rule 6: a second Continue before the first settles runs nothing more', async () => {
    const h = await harness();
    let calls = 0;
    let finish: () => void = () => undefined;
    mountImport(h.deps, {back: () => undefined, next: () => (calls++, new Promise<void>(r => (finish = r)))}).show();
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    click(el('imp-continue'));
    expect(calls).toBe(1);
    expect(el<HTMLButtonElement>('imp-continue').disabled).toBe(true);
    finish();
  });

  it('idle-timer: "Auto-clearing in 12 s" after 48 s without input, [Keep working] resets it, and at 60 s the field is wiped', async () => {
    const {h, field} = await shown();
    type(field, 'legend frost marble river coral anchor valid echo raven');
    h.timers.advance(IDLE_WARN_MS);
    expect(visible(el('imp-idle'))).toBe(true);
    expect(text(el('imp-idle'))).toBe('Auto-clearing in 12 s No activity for 60 s — phrase will be wiped from this field.');
    expect(text(el('imp-keep'))).toBe('Keep working — reset timer');
    expect(unstyled('v-import')).toEqual([]);
    h.timers.advance(1_000);
    expect(text(el('imp-idle-title'))).toBe('Auto-clearing in 11 s');
    click(el('imp-keep'));
    expect(visible(el('imp-idle'))).toBe(false);
    h.timers.advance(IDLE_WARN_MS);
    expect(visible(el('imp-idle'))).toBe(true);
    h.timers.advance(12_000);
    expect(field.value).toBe('');
    expect(visible(el('imp-grid'))).toBe(false);
    expect(visible(el('imp-idle'))).toBe(false);
  });
});

describe('#8 → #5 → #40: the plain import run, against the real background', () => {
  async function run(reader: NonNullable<Parameters<typeof harness>[0]>['reader']) {
    const h = await harness({reader});
    createImportRun(h.deps, {password: mountPassword(h.deps), back: () => undefined}).show();
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    return h;
  }
  async function setPassword(h: Awaited<ReturnType<typeof harness>>) {
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    expect(text(el('pw-step'))).toBe('Import · 2 / 2');
    expect(text(el('pw-eyebrow'))).toBe('Onboarding');
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), PW);
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
  }

  it('nothing funded: the standard scheme, account 0, stored and handed over to #/imported (no #6)', async () => {
    const h = await run({getMultipleLamports: async keys => keys.map(() => 0n)});
    await setPassword(h);
    expect(h.went).toEqual(['wallet.html#/imported']);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(env.accounts.map(a => a.publicKey)).toEqual([K0]);
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PW, testKdf))).toBe(M);
    expect(visible(el('v-passkey'))).toBe(false);
  }, 30_000);

  it('balances that cannot be read: the user chooses, in the design’s chrome — here the Solana CLI key', async () => {
    const h = await run({});
    await h.until(() => visible(el('imp-choose')));
    expect(text(el('imp-choose-why'))).toBe('Balances could not be checked. Choose the address type to use.');
    expect([text(el('imp-choose-slip10')), text(el('imp-choose-cli'))]).toEqual(['Standard (Phantom/Solflare)', 'Solana CLI (solana-keygen)']);
    expect(unstyled('v-import')).toEqual([]);
    click(el('imp-choose-cli'));
    await setPassword(h);
    expect(((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1).accounts.map(a => a.publicKey)).toEqual([KCLI]);
  }, 30_000);

  it('both address types funded: "Both address types on this phrase hold funds…"', async () => {
    const h = await run({getMultipleLamports: async keys => keys.map(() => 1n)});
    await h.until(() => visible(el('imp-choose')));
    expect(text(el('imp-choose-why'))).toBe('Both address types on this phrase hold funds. Choose the one to use.');
  });

  it('back from #5 returns to #8 with the phrase still in the field', async () => {
    const h = await run({getMultipleLamports: async keys => keys.map(() => 0n)});
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    click(el('pw-back'));
    expect(visible(el('v-import'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe(M);
  });

  // M4 (plan review): the hidden-tab rule drops the password, never the phrase under an open #5.
  it('a tab hidden on #5 keeps the phrase: the password set after it stores the wallet — no "not a valid phrase"', async () => {
    const h = await run({getMultipleLamports: async keys => keys.map(() => 0n)});
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    h.leave();
    await setPassword(h);
    expect(text(document.body)).not.toContain('That is not a valid 12- or 24-word recovery phrase.');
    expect(h.went).toEqual(['wallet.html#/imported']);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(await decryptMnemonic(env, await unlockWithPassword(env, PW, testKdf))).toBe(M);
  }, 30_000);
});

describe('#1 → #8 in one page', () => {
  it("welcome's [I have a wallet] opens #8 here; its back arrow returns to #1", async () => {
    const {startMode} = await import('../modes');
    const h = await harness();
    startMode({mode: 'welcome'}, h.deps);
    await h.until(() => visible(el('wel-actions')));
    click(el('wel-import'));
    expect(visible(el('v-import'))).toBe(true);
    click(el('imp-back'));
    await h.until(() => visible(el('wel-actions')));
    expect(visible(el('v-import'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/create.test.ts src/unlock/__tests__/import.test.ts`
Expected (dry run): FAIL — Test Files 2 failed (2) Tests 1 failed | 15 passed (16) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 9ea3ec2..13aa4e5 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -7,8 +7,9 @@ import {createWrongBackoff, runExclusive, type BusyGate} from './orchestrate';
 import {backgroundVaultStore} from './vaultStore';
 import type {PageMode} from './mode';
 import type {PageDeps} from './page';
-import {startCreateRun} from './screens/createRun';
-import {showScreen} from './view/dom';
+import {createCreateRun} from './screens/createRun';
+import {createImportRun} from './screens/importRun';
+import {mountPassword} from './screens/password';
 import {workerKdf} from '../vault/kdf';
 import {evaluatePrf} from '../vault/passkey';
 import {unb64} from '../vault/bytes';
@@ -102,16 +103,14 @@ function legacy(shown: (typeof SECTIONS)[number] | null): void {
 }
 
 export function startMode(mode: PageMode, deps: PageDeps): void {
-  if (mode.mode === 'welcome' || mode.mode === 'create') {
+  if (mode.mode === 'welcome' || mode.mode === 'create' || (mode.mode === 'import' && mode.source === null)) {
     legacy(null);
-    startCreateRun(deps, {
-      at: mode.mode === 'welcome' ? 'welcome' : 'intro',
-      importRun: () => {
-        showScreen(null);
-        legacy('import');
-        startImport();
-      },
-    });
+    // Each screen is mounted once per page; the runs share #5.
+    const password = mountPassword(deps);
+    let importRun: {show(): void} | null = null;
+    const create = createCreateRun(deps, {password, importRun: () => (importRun ??= createImportRun(deps, {password, back: () => create.start('welcome')})).show()});
+    if (mode.mode === 'import') (importRun ??= createImportRun(deps, {password, back: () => create.start('welcome')})).show();
+    else create.start(mode.mode === 'welcome' ? 'welcome' : 'intro');
     return;
   }
   const shown = mode.mode === 'unlock' || mode.mode === 'forgot' ? 'unlock-section' : mode.mode;
```

Modify `extension/src/unlock/screens/createRun.ts`:

```diff
diff --git a/extension/src/unlock/screens/createRun.ts b/extension/src/unlock/screens/createRun.ts
index f50292a..291626f 100644
--- a/extension/src/unlock/screens/createRun.ts
+++ b/extension/src/unlock/screens/createRun.ts
@@ -2,7 +2,7 @@ import {finishOnboarding} from '../onboarding';
 import type {PageDeps} from '../page';
 import {PASSWORD} from '../strings';
 import {mountConfirm} from './confirm';
-import {mountPassword} from './password';
+import type {PasswordScreen} from './password';
 import {mountPasskey} from './passkey';
 import {mountSeed} from './seed';
 import {mountIntro, mountWelcome} from './welcome';
@@ -13,8 +13,9 @@ import {mountIntro, mountWelcome} from './welcome';
  * stored (or the page is left: it lives in this closure only). The password #5 sets is held for #6's
  * passkey and dropped when #6 ends or the tab is hidden. Every end hands over to the UI tab's #7
  * (`wallet.html#/created`), which shows its locked variant when the keys did not reach the background.
+ * Mounted once per page; #1's "I have a wallet" hands over to the import run in the same page.
  */
-export function startCreateRun(deps: PageDeps, o: {at: 'welcome' | 'intro'; importRun(): void}): void {
+export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; importRun(): void}): {start(at: 'welcome' | 'intro'): void} {
   let mnemonic: string | null = null;
   let password: string | null = null;
   const words = (): string[] => {
@@ -29,7 +30,7 @@ export function startCreateRun(deps: PageDeps, o: {at: 'welcome' | 'intro'; impo
   const intro = mountIntro({back: () => void welcome.show(), continue: () => seed.show(words())});
   const seed = mountSeed(deps, {back: () => intro.show(), done: () => confirm.show(words())});
   const confirm = mountConfirm(deps, {back: () => seed.show(words()), done: () => passwordStep()});
-  const pw = mountPassword(deps);
+  const pw = o.password;
   const passkey = mountPasskey(deps, {done: () => deps.go('wallet.html#/created')});
 
   const passwordStep = () =>
@@ -56,6 +57,10 @@ export function startCreateRun(deps: PageDeps, o: {at: 'welcome' | 'intro'; impo
       },
     });
 
-  if (o.at === 'welcome') void welcome.show();
-  else intro.show();
+  return {
+    start(at) {
+      if (at === 'welcome') void welcome.show();
+      else intro.show();
+    },
+  };
 }
```

Create `extension/src/unlock/screens/importRun.ts`:

```ts
import {detectImport, finishOnboarding, indexesFor} from '../onboarding';
import type {PageDeps} from '../page';
import {IMPORT, PASSWORD} from '../strings';
import {mountImport} from './importScreen';
import type {PasswordScreen} from './password';

/**
 * A plain import (spec §3.8, no `source`): #8 → the scheme (detected from balances the background
 * reads for the public keys; the user chooses when both or neither can be told) → #5 "Import · 2 / 2"
 * → the UI tab's #40 (`wallet.html#/imported`, locked variant when the keys did not reach the
 * background). No #6 on this path (D9 puts the passkey step on create only).
 */
export function createImportRun(deps: PageDeps, o: {password: PasswordScreen; back(): void}): {show(): void} {
  const pw = o.password;
  let phrase = '';
  const screen = mountImport(deps, {
    back: o.back,
    next: async typed => {
      screen.line(IMPORT.checking);
      const detected = await detectImport(deps.send, typed);
      if (detected.outcome === 'invalid-mnemonic') {
        screen.line(IMPORT.invalid);
        return;
      }
      screen.line(null);
      const {candidates, probe, choice} = detected;
      const scheme = 'choose' in choice ? await screen.choose(choice.choose === 'both-funded' ? IMPORT.bothFunded : IMPORT.unresolved) : choice.scheme;
      phrase = typed;
      screen.clear();
      pw.show({
        eyebrow: PASSWORD.onboarding,
        step: PASSWORD.stepImport,
        back: () => {
          screen.show({phrase});
          phrase = '';
        },
        finish: async password => {
          const out = await finishOnboarding({...deps.store, send: deps.send, kdf: deps.kdf}, {mnemonic: phrase, password, scheme, indexes: indexesFor(scheme, candidates, probe)});
          if (out === 'created' || out === 'created-locked') {
            phrase = '';
            deps.go('wallet.html#/imported');
            return null;
          }
          if (out === 'exists') {
            phrase = '';
            return {line: PASSWORD.exists, stop: true};
          }
          return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, stop: false};
        },
      });
    },
  });
  // The phrase is kept while this page stays open, a hidden tab included: the hidden-tab rule (§3.5) is
  // the password's, and dropping the phrase under an open #5 would end the run on an untrue "not a valid
  // phrase" (M4 of the plan review). It goes when the wallet is stored, on `exists`, on Back, and with the page.
  return {show: () => screen.show()};
}
```

Create `extension/src/unlock/screens/importScreen.ts`:

```ts
import {acceptedPhrase} from '../onboarding';
import {exclusive, type PageDeps} from '../page';
import {IMPORT} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {phraseCells, phraseWords} from '../view/words';

/** #8's idle timer (spec §3.8): the warning after 48 s without input, the wipe at 60 s. */
export const IDLE_WARN_MS = 48_000;
export const IDLE_WIPE_MS = 60_000;

export interface ImportScreen {
  /** Shows #8; `phrase` puts back what the run held (back from #5). */
  show(o?: {phrase?: string}): void;
  /** The status line under the field (checking, a refusal), or none. */
  line(text: string | null): void;
  /** The scheme choice, in the design's chrome; resolves with the user's pick. */
  choose(why: string): Promise<'slip10' | 'cli'>;
  /** Empties the field and its grid. */
  clear(): void;
}

/**
 * #8 import (spec §3.8): the phrase field, its mono cell grid as the words are typed, the paste toast
 * that says Noctura cannot clear the clipboard, the idle timer that wipes the field after 60 s without
 * input, the D8 banner, and Continue — enabled only for 12 or 24 words with a valid checksum. What
 * Continue does belongs to the run (`next`): a plain import detects the scheme; #39's restore proves
 * the phrase against the stored wallet; #40's retry imports the new wallet. The page holds the phrase
 * in this field only; nothing here sends it anywhere.
 */
export function mountImport(deps: PageDeps, handlers: {back(): void; next(phrase: string): Promise<void>}): ImportScreen {
  const field = byId<HTMLTextAreaElement>('imp-phrase');
  const cta = byId<HTMLButtonElement>('imp-continue');
  const keep = byId<HTMLButtonElement>('imp-keep');
  let lastInput = deps.timers.now();
  let idle: number | null = null;
  let pasted = false;
  let choosing: ((s: 'slip10' | 'cli') => void) | null = null;

  const render = () => {
    const busy = deps.gate.isBusy() || choosing !== null;
    const words = phraseWords(field.value);
    const valid = acceptedPhrase(field.value);
    byId('imp-grid').replaceChildren(...(words.length > 0 ? phraseCells(words) : []));
    shown(byId('imp-grid'), words.length > 0);
    shown(byId('imp-valid'), valid);
    setText(byId('imp-valid-text'), valid ? IMPORT.valid(words.length) : '');
    shown(byId('imp-count'), words.length > 0 && !valid);
    setText(byId('imp-count'), IMPORT.count(words.length, words.length <= 12 ? 12 : 24));
    field.disabled = busy;
    cta.disabled = busy || !valid;
  };
  const stopIdle = () => {
    if (idle !== null) deps.timers.clearInterval(idle);
    idle = null;
    shown(byId('imp-idle'), false);
    shown(keep, false);
  };
  const wipe = () => {
    stopIdle();
    field.value = '';
    shown(byId('imp-toast'), false);
    render();
  };
  const watchIdle = () => {
    lastInput = deps.timers.now();
    shown(byId('imp-idle'), false);
    shown(keep, false);
    if (field.value === '') return stopIdle();
    if (idle !== null) return;
    idle = deps.timers.setInterval(() => {
      const quiet = deps.timers.now() - lastInput;
      if (quiet >= IDLE_WIPE_MS) return wipe();
      if (quiet >= IDLE_WARN_MS) {
        setText(byId('imp-idle-title'), IMPORT.idleTitle(Math.ceil((IDLE_WIPE_MS - quiet) / 1000)));
        shown(byId('imp-idle'), true);
        shown(keep, true);
      }
    }, 1_000);
  };

  deps.gate.onIdle(render);
  field.addEventListener('paste', () => {
    pasted = true;
  });
  field.addEventListener('input', () => {
    shown(byId('imp-toast'), pasted);
    pasted = false;
    watchIdle();
    render();
  });
  keep.addEventListener('click', () => {
    watchIdle();
    field.focus();
  });
  byId('imp-back').addEventListener('click', () => {
    if (deps.gate.isBusy()) return;
    wipe();
    handlers.back();
  });
  cta.addEventListener('click', () =>
    void exclusive(deps, render, async () => {
      if (!acceptedPhrase(field.value)) return;
      stopIdle();
      await handlers.next(field.value);
    }),
  );
  const pick = (scheme: 'slip10' | 'cli') => () => {
    const done = choosing;
    choosing = null;
    shown(byId('imp-choose'), false);
    render();
    done?.(scheme);
  };
  byId('imp-choose-slip10').addEventListener('click', pick('slip10'));
  byId('imp-choose-cli').addEventListener('click', pick('cli'));

  return {
    show(o = {}) {
      stopIdle();
      field.value = o.phrase ?? '';
      shown(byId('imp-toast'), false);
      shown(byId('imp-choose'), false);
      setText(byId('imp-line'), '');
      shown(byId('imp-line'), false);
      if (field.value !== '') watchIdle();
      render();
      showScreen('v-import');
    },
    line(text) {
      setText(byId('imp-line'), text ?? '');
      shown(byId('imp-line'), text !== null);
    },
    choose(why) {
      setText(byId('imp-choose-why'), why);
      shown(byId('imp-choose'), true);
      return new Promise(resolve => {
        choosing = resolve;
        render();
      });
    },
    clear: wipe,
  };
}
```

Modify `extension/src/unlock/screens/password.ts`:

```diff
diff --git a/extension/src/unlock/screens/password.ts b/extension/src/unlock/screens/password.ts
index ec3e881..dbba2e1 100644
--- a/extension/src/unlock/screens/password.ts
+++ b/extension/src/unlock/screens/password.ts
@@ -24,9 +24,14 @@ export interface PasswordRun {
  * #5 pin-create → create password (spec §3.5, D7): enter → confirm → creating. The field replaces the
  * design's 6 dots and keypad; the meter shows only the length rule. A mismatch says so, shakes the field
  * and clears it after 600 ms. While the wallet is created, every control is disabled (rule 6: the page's
- * one gate, ≥ 500 ms). The password lives in this closure only as long as one run needs it.
+ * one gate, ≥ 500 ms). The password lives in this closure only as long as one run needs it. Mounted
+ * once per page and shared by its runs (each show() carries the run's own back and finish).
  */
-export function mountPassword(deps: PageDeps): {show(run: PasswordRun): void} {
+export interface PasswordScreen {
+  show(run: PasswordRun): void;
+}
+
+export function mountPassword(deps: PageDeps): PasswordScreen {
   const field = byId<HTMLInputElement>('pw-field');
   const cta = byId<HTMLButtonElement>('pw-cta');
   let run: PasswordRun | null = null;
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index aec2ad7..9873d03 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -80,6 +80,17 @@ export const PASSWORD = {
   failed: 'Something went wrong. Nothing was saved.',
 } as const;
 
+/** #8 import. */
+export const IMPORT = {
+  idleTitle: (seconds: number): string => `Auto-clearing in ${seconds} s`,
+  count: (n: number, of: number): string => `${n} of ${of} words entered.`,
+  valid: (n: number): string => `Valid ${n}-word BIP-39 phrase · checksum OK`,
+  checking: 'Checking which addresses hold funds…',
+  bothFunded: 'Both address types on this phrase hold funds. Choose the one to use.',
+  unresolved: 'Balances could not be checked. Choose the address type to use.',
+  invalid: 'That is not a valid 12- or 24-word recovery phrase.',
+} as const;
+
 /** #6 biometric-setup → passkey (D9). */
 export const PASSKEY = {
   adding: 'Waiting for your passkey…',
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 49e28b7..584098f 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -68,6 +68,12 @@
 .vlt-gap-top-2 {
   margin-top: var(--space-2);
 }
+.vlt-gap-top-1 {
+  margin-top: 2px;
+}
+.vlt-gap-bottom-3 {
+  margin-bottom: var(--space-3);
+}
 .vlt-gap-top-3 {
   margin-top: var(--space-3);
 }
@@ -201,3 +207,58 @@
     animation: none;
   }
 }
+
+/* #8: the mockup's inline spacing; the phrase field inside the design's .ta-wrap (the design draws the
+   words in its mono cell grid, which this page shows under the field as the words are typed). */
+.vlt-import-lede {
+  padding: 0 var(--space-5) var(--space-4);
+}
+.vlt-banner-gap {
+  margin: 0 var(--space-5) var(--space-3);
+}
+.vlt-toast {
+  background: var(--bg-surface-2);
+  border-inline-start: 1px solid var(--info);
+}
+.vlt-strong {
+  color: var(--fg-primary);
+}
+.vlt-phrase {
+  width: 100%;
+  min-height: 96px;
+  resize: vertical;
+  background: transparent;
+  border: 0;
+  color: var(--fg-primary);
+  font: 400 14px/22px var(--font-mono);
+}
+.vlt-phrase::placeholder {
+  color: var(--fg-tertiary);
+}
+.vlt-phrase:focus {
+  outline: none;
+}
+.vlt-col .s-import .ta-wrap .ta-grid {
+  margin-top: var(--space-3);
+}
+.vlt-valid {
+  display: flex;
+  gap: var(--space-2);
+  align-items: center;
+  padding: 0 var(--space-5) var(--space-3);
+}
+/* The scheme choice (B1b-1's two buttons, in the design's chrome: two .noc-card rows). */
+.vlt-choose {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-3);
+  padding: 0 var(--space-5) var(--space-4);
+}
+.vlt-choice {
+  width: 100%;
+  min-height: var(--touch-target-min);
+  text-align: start;
+  color: var(--fg-primary);
+  font: 500 15px/22px var(--font-body);
+  cursor: pointer;
+}
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 2259638..d6db20a 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -295,6 +295,47 @@
         </div>
       </section>
 
+      <!-- #8 import (spec §3.8): the phrase only (D17); the restore (#39) and retry (#40) paths add their states. -->
+      <section id="v-import" class="screen s-import" hidden>
+        <div class="top-bar">
+          <button id="imp-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
+          <span class="title noc-h2">Import wallet</span>
+        </div>
+        <p class="noc-body vlt-lede vlt-import-lede">Bring an existing wallet onto this device.</p>
+        <div id="imp-toast" class="banner info toast vlt-toast" role="status" hidden>
+          <svg width="16" height="16" aria-hidden="true"><use href="#i-clip" /></svg>
+          <div class="noc-body-sm vlt-strong">Pasted from clipboard. Noctura cannot clear your clipboard — clear it yourself.</div>
+        </div>
+        <div id="imp-idle" class="banner warning vlt-banner-gap" role="alert" hidden>
+          <svg width="16" height="16" aria-hidden="true"><use href="#i-warn" /></svg>
+          <div>
+            <div class="noc-body-sm"><b id="imp-idle-title"></b></div>
+            <div class="noc-caption vlt-lede vlt-gap-top-1">No activity for 60 s — phrase will be wiped from this field.</div>
+          </div>
+        </div>
+        <div class="ta-wrap">
+          <textarea id="imp-phrase" class="vlt-phrase" autocomplete="off" autocapitalize="none" spellcheck="false" rows="4" aria-label="Recovery phrase" placeholder="Enter your 12 or 24-word recovery phrase, separated by spaces."></textarea>
+          <div id="imp-grid" class="ta-grid" hidden></div>
+        </div>
+        <p id="imp-count" class="noc-caption vlt-muted vlt-pad vlt-gap-bottom-3" hidden></p>
+        <p id="imp-valid" class="noc-caption vlt-success vlt-valid" hidden><svg width="14" height="14" aria-hidden="true"><use href="#i-check" /></svg><span id="imp-valid-text"></span></p>
+        <div class="banner info vlt-banner-gap">
+          <svg width="16" height="16" aria-hidden="true"><use href="#i-info" /></svg>
+          <div class="noc-body-sm">This phrase is also the root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.</div>
+        </div>
+        <p id="imp-line" class="noc-body vlt-pad vlt-center" role="status" hidden></p>
+        <div id="imp-choose" class="vlt-choose" hidden>
+          <p id="imp-choose-why" class="noc-body"></p>
+          <button id="imp-choose-slip10" type="button" class="noc-card vlt-choice">Standard (Phantom/Solflare)</button>
+          <button id="imp-choose-cli" type="button" class="noc-card vlt-choice">Solana CLI (solana-keygen)</button>
+        </div>
+        <div class="vlt-grow"></div>
+        <div class="sticky-bar">
+          <button id="imp-continue" type="button" class="btn btn-primary" disabled>Continue</button>
+          <button id="imp-keep" type="button" class="btn btn-tertiary" hidden>Keep working — reset timer</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/create.test.ts src/unlock/__tests__/import.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 92 passed (92) Tests 1168 passed (1168).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- Continue on for any 12 words (no checksum) → RED Tests  1 failed | 11 passed (12)
- the idle timer never wipes → RED Tests  1 failed | 11 passed (12)
- the import run drops the phrase on a hidden tab (M4) → RED Tests  1 failed | 11 passed (12)

- [ ] **Step 6: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `08-phrase-idle`, `08-typing`, `08-idle-timer-active`, `08-paste-detected`, `08-checking`, `08-choose-scheme`, `05-import-enter`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/unlock/__tests__/create.test.ts extension/src/unlock/__tests__/import.test.ts extension/src/unlock/modes.ts extension/src/unlock/screens/createRun.ts extension/src/unlock/screens/importRun.ts extension/src/unlock/screens/importScreen.ts extension/src/unlock/screens/password.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/unlock.html
git commit -m "feat(extension): #8 import — the cell grid, paste, the idle timer, the scheme choice — and the plain import run" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 10: #9 unlock — password, passkey, the cooldown card, "Forgot password?", `return=` — and the popup’s "Forgot password?"

**Files:**
- Modify: `extension/e2e/unlock.spec.ts`
- Modify: `extension/e2e/vaultPage.ts`
- Modify: `extension/e2e/wallet.spec.ts`
- Modify: `extension/src/app/__tests__/App.test.tsx`
- Modify: `extension/src/app/platform.ts`
- Modify: `extension/src/app/screens/Locked.tsx`
- Create: `extension/src/unlock/__tests__/unlockScreen.test.ts`
- Modify: `extension/src/unlock/main.ts`
- Modify: `extension/src/unlock/modes.ts`
- Create: `extension/src/unlock/screens/unlock.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5, 8; `attemptUnlock`, `attemptPasskeyUnlock`, `unlockFlow` (plan 1).
- Produces: `src/unlock/screens/unlock.ts`: `mountUnlock(deps): {show(returnTo: ReturnTo | null): Promise<void>}`; `strings.ts`: `UNLOCK`; `src/app/platform.ts`: `ExtensionPage` gains `'unlock.html?mode=forgot'`; `e2e/vaultPage.ts`: `unlockWith(vault, id, password)`

Spec §3.9 (D7, D11, D12) and §4.1. `idle`: the lock tile, "Welcome back" / "Enter your password to unlock." (adapted), the field, `[Unlock]`, `[Unlock with passkey]` only when the envelope has one, "Forgot password?" (`.btn-tertiary`) → `?mode=forgot` (carry 5). `error`: "That did not unlock the wallet." (no counter, D11) with the tile in `--danger` and the shake. `cooldown`: the engine's backoff (≤ 30 s, page memory) as the design's card — "Wait a moment", the adapted line, the ring, "0:12" and the design's helper line, `[Unlock paused]` disabled. `unlocking`, `unlocked` ("Unlocked." + "Open the Noctura icon to continue." + `[Close this tab]`, hidden if the tab stays; with `return=created|imported`, straight on to that UI-tab route), `damaged` (said before any password is typed — never charged to the backoff), `no-wallet` (+ `[Set up a wallet]` → #1), passkey `unavailable`. `main.ts` is now three stylesheet imports and `startMode(pageMode(location.search), browserPageDeps())`. The popup's locked screen gains "Forgot password?" → `?mode=forgot` in a tab (§4.1; plan 1's stand-in removed). The two E2E specs that unlocked through the old markup (`unlock.spec.ts`, `wallet.spec.ts`) use the new ids.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/app/__tests__/App.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/App.test.tsx b/extension/src/app/__tests__/App.test.tsx
index 0ca1d20..60c3b24 100644
--- a/extension/src/app/__tests__/App.test.tsx
+++ b/extension/src/app/__tests__/App.test.tsx
@@ -28,13 +28,21 @@ describe('the app before #11', () => {
     expect(await screen.findByText('Welcome back')).toBeTruthy();
     expect(screen.getByText('Unlock Noctura to continue. Unlocking opens in a new tab.')).toBeTruthy();
     expect(document.querySelector('input[type="password"]')).toBeNull();
-    // Plan 1: no "Forgot password?" until #39 exists (plan 2).
-    expect(screen.queryByText('Forgot password?')).toBeNull();
     fireEvent.click(screen.getByRole('button', {name: 'Unlock'}));
     expect(platform.opened).toEqual(['unlock.html?mode=unlock']);
     expect(platform.closed).toBe(1);
   });
 
+  // §4.1, plan 2 (the plan-1 stand-in removed): "Forgot password?" opens #39 in a tab.
+  it('locked: "Forgot password?" opens #39 (?mode=forgot) in a tab; the popup closes', async () => {
+    const {platform} = await renderApp({unlocked: false});
+    const forgot = await screen.findByRole('button', {name: 'Forgot password?'});
+    expect(forgot.className).toBe('btn btn-tertiary');
+    fireEvent.click(forgot);
+    expect(platform.opened).toEqual(['unlock.html?mode=forgot']);
+    expect(platform.closed).toBe(1);
+  });
+
   // Task 16 review, fix round 1 #5 (ruling): the tab is the page the user is looking at — its
   // [Unlock] opens the vault page (§7.1) and leaves wallet.html open. The popup still closes.
   it('locked, tab: Unlock opens the vault page and does not close the tab', async () => {
```

Create `extension/src/unlock/__tests__/unlockScreen.test.ts`:

```ts
// @vitest-environment happy-dom
import {base64} from '@scure/base';
import {createEnvelope, type EnvelopeV1} from '../../vault/envelope';
import {getSession} from '../../background/session';
import {CLOSE_CHECK_MS} from '../page';
import {mountUnlock} from '../screens/unlock';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const wallet = () => createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});

beforeEach(loadPage);

async function shown(vault: unknown, o: {returnTo?: 'created' | 'imported' | null; holdSleep?: boolean; credentials?: Parameters<typeof harness>[0] extends infer X ? (X extends {credentials?: infer C} ? C : never) : never} = {}) {
  const h = await harness({vault, holdSleep: o.holdSleep, credentials: o.credentials});
  await mountUnlock(h.deps).show(o.returnTo ?? null);
  return h;
}
const submit = (password: string) => {
  type(el<HTMLInputElement>('unl-password'), password);
  click(el('unl-submit'));
};

describe('#9 unlock (spec §3.9)', () => {
  it('idle: lock tile, "Welcome back", the adapted lede (D7), the password field, Unlock, "Forgot password?"; no passkey button without a passkey', async () => {
    await shown(await wallet());
    const screen = el('v-unlock');
    expect(text(screen.querySelector('h1'))).toBe('Welcome back');
    expect(text(screen.querySelector('h1 + p'))).toBe('Enter your password to unlock.');
    expect(el('unl-password').getAttribute('autocomplete')).toBe('current-password');
    expect(text(el('unl-submit'))).toBe('Unlock');
    expect(visible(el('unl-passkey'))).toBe(false);
    expect(text(el('unl-forgot'))).toBe('Forgot password?');
    expect(text(screen)).not.toMatch(/PIN|attempts left|Cycle 1 of 2|Final cycle/);
    expect(unstyled('v-unlock')).toEqual([]);
  });

  it('[Unlock with passkey] only when the envelope has one; a device without PRF says so', async () => {
    const env = await wallet();
    const withPk: EnvelopeV1 = {...env, passkey: {credentialId: base64.encode(new Uint8Array(16).fill(1)), prfSalt: base64.encode(new Uint8Array(32).fill(2)), wrapped: base64.encode(new Uint8Array(40).fill(3))}};
    const h = await shown(withPk, {credentials: {create: async () => null, get: async () => null}});
    expect(visible(el('unl-passkey'))).toBe(true);
    expect(text(el('unl-passkey'))).toBe('Unlock with passkey');
    click(el('unl-passkey'));
    await h.until(() => text(el('unl-helper')) === 'This device cannot unlock the wallet with a passkey; your password still works.');
  });

  it('error: "That did not unlock the wallet." (D11: no counter), the tile in --danger, the shake', async () => {
    const h = await shown(await wallet());
    submit('not the password at all');
    expect(text(el('unl-helper'))).toBe('Unlocking…');
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    expect(el('unl-helper').classList.contains('error')).toBe(true);
    expect(el('unl-tile').classList.contains('is-error')).toBe(true);
    expect(el('unl-password').classList.contains('is-error')).toBe(true);
    expect(await getSession(h.ext)).toBeNull();
    expect(unstyled('v-unlock')).toEqual([]);
  });

  it('cooldown: the engine’s wait as the design’s card — "Wait a moment", "0:01", [Unlock paused]; then the error', async () => {
    const h = await shown(await wallet(), {holdSleep: true});
    submit('wrong wrong wrong wrong');
    await h.until(() => text(el('unl-helper')) === 'That did not unlock the wallet.');
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    submit('wrong wrong wrong wrong');
    await h.until(() => visible(el('unl-cooldown')));
    expect(text(el('unl-cooldown'))).toBe('Wait a moment That did not unlock the wallet. Wait a moment before trying again. 0:01 Cooldown · 0 minutes 1 seconds remaining');
    expect(visible(el('unl-paused'))).toBe(true);
    expect(el<HTMLButtonElement>('unl-paused').disabled).toBe(true);
    expect(text(el('unl-paused'))).toBe('Unlock paused');
    expect(visible(el('unl-submit'))).toBe(false);
    expect(el<HTMLInputElement>('unl-password').value).toBe('');
    expect(unstyled('v-unlock')).toEqual([]);
    h.wake();
    await h.until(() => !visible(el('unl-cooldown')));
    expect(text(el('unl-helper'))).toBe('That did not unlock the wallet.');
  });

  it('unlocked: the keys reach the background; "Unlocked." + "Open the Noctura icon to continue." + [Close this tab], hidden if the tab stays', async () => {
    const h = await shown(await wallet());
    submit(PW);
    await h.until(() => visible(el('unl-notice')));
    expect((await getSession(h.ext))?.map(a => a.publicKey)).toEqual([K0]);
    expect(text(el('unl-notice'))).toBe('Unlocked. Open the Noctura icon to continue.');
    expect(text(el('unl-close'))).toBe('Close this tab');
    expect(visible(el('unl-forgot'))).toBe(false);
    expect(unstyled('v-unlock')).toEqual([]);
    click(el('unl-close'));
    expect(h.closed).toBe(1);
    h.timers.advance(CLOSE_CHECK_MS);
    expect(visible(el('unl-close'))).toBe(false);
  });

  it.each([
    ['created', 'wallet.html#/created'],
    ['imported', 'wallet.html#/imported'],
  ] as const)('with return=%s, a successful unlock goes straight on to %s', async (returnTo, target) => {
    const h = await shown(await wallet(), {returnTo});
    submit(PW);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual([target]);
  });

  it('no wallet: the line and [Set up a wallet] → #1; nothing to type', async () => {
    const h = await shown(undefined);
    expect(text(el('unl-notice-line'))).toBe('No wallet on this browser yet.');
    expect(visible(el('unl-entry'))).toBe(false);
    click(el('unl-setup'));
    expect(h.went).toEqual(['unlock.html?mode=welcome']);
  });

  it('a damaged vault (a stored null too) says so before any password is typed — never charged to the backoff', async () => {
    const h = await shown(null);
    expect(text(el('unl-notice'))).toBe("This wallet's stored data is damaged. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.");
    expect(visible(el('unl-entry'))).toBe(false);
    expect(visible(el('unl-forgot'))).toBe(false);
    expect(h.sent).toEqual([]);
  });

  it('"Forgot password?" → #39', async () => {
    const h = await shown(await wallet());
    click(el('unl-forgot'));
    expect(h.went).toEqual(['unlock.html?mode=forgot']);
  });

  it('rule 6: a second Unlock before the first settles sends nothing more', async () => {
    const h = await shown(await wallet());
    submit(PW);
    click(el('unl-submit'));
    await h.until(() => visible(el('unl-notice')));
    expect(h.sent.filter(m => m.type === 'vault.setKeys')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/App.test.tsx src/unlock/__tests__/unlockScreen.test.ts`
Expected (dry run): FAIL — Test Files 2 failed (2) Tests 1 failed | 11 passed (12) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/platform.ts`:

```diff
diff --git a/extension/src/app/platform.ts b/extension/src/app/platform.ts
index e678bb4..803cfb3 100644
--- a/extension/src/app/platform.ts
+++ b/extension/src/app/platform.ts
@@ -10,7 +10,7 @@ interface PlatformApi {
 }
 
 /** Every extension page the UI opens. A closed list: nothing here builds a URL from data. */
-export type ExtensionPage = 'unlock.html?mode=welcome' | 'unlock.html?mode=unlock' | 'unlock.html?mode=accounts';
+export type ExtensionPage = 'unlock.html?mode=welcome' | 'unlock.html?mode=unlock' | 'unlock.html?mode=forgot' | 'unlock.html?mode=accounts';
 
 export interface Platform {
   openPage(page: ExtensionPage): void;
```

Modify `extension/src/app/screens/Locked.tsx`:

```diff
diff --git a/extension/src/app/screens/Locked.tsx b/extension/src/app/screens/Locked.tsx
index 62798fb..3a27726 100644
--- a/extension/src/app/screens/Locked.tsx
+++ b/extension/src/app/screens/Locked.tsx
@@ -3,15 +3,14 @@ import {ExtIcon} from '../ui/ExtIcon';
 
 /**
  * The popup's locked screen (spec §4.1, derived from #9): no password field — the password only ever
- * exists in the vault page (D12), so [Unlock] opens it in a tab. "Forgot password?" arrives with #39 in
- * plan 2 (the `forgot` vault mode does not exist yet; linking it now would open the plain unlock page).
+ * exists in the vault page (D12), so [Unlock] opens it in a tab, and "Forgot password?" opens #39 there.
  */
 export function Locked() {
   const {platform, surface} = useWallet();
   // The popup closes once the vault page opens; the tab (wallet.html) is the page the user is looking
   // at and stays open (§7.1 only opens ?mode=unlock; review fix round 1 #5, a ruling).
-  const unlock = () => {
-    platform.openPage('unlock.html?mode=unlock');
+  const open = (page: 'unlock.html?mode=unlock' | 'unlock.html?mode=forgot') => () => {
+    platform.openPage(page);
     if (surface === 'popup') platform.closeWindow();
   };
   return (
@@ -22,9 +21,12 @@ export function Locked() {
       <h1 className="noc-h1">Welcome back</h1>
       <p className="noc-body app-muted">Unlock Noctura to continue. Unlocking opens in a new tab.</p>
       <div className="app-center-actions">
-        <button type="button" className="btn btn-primary" onClick={unlock}>
+        <button type="button" className="btn btn-primary" onClick={open('unlock.html?mode=unlock')}>
           Unlock
         </button>
+        <button type="button" className="btn btn-tertiary" onClick={open('unlock.html?mode=forgot')}>
+          Forgot password?
+        </button>
       </div>
     </div>
   );
```

Modify `extension/src/unlock/main.ts`:

```diff
diff --git a/extension/src/unlock/main.ts b/extension/src/unlock/main.ts
index 2d2163b..d34fc1b 100644
--- a/extension/src/unlock/main.ts
+++ b/extension/src/unlock/main.ts
@@ -3,111 +3,11 @@
 import '../../../web/src/styles/design-system.css';
 import '../styles/design-ext.css';
 import './unlock.css';
-import {ENVELOPE_KEY, unlockFlow} from './unlockFlow';
-import {attemptPasskeyUnlock, attemptUnlock, createWrongBackoff, runExclusive, type BusyGate, type Outcome} from './orchestrate';
-import {workerKdf} from '../vault/kdf';
-import {evaluatePrf} from '../vault/passkey';
-import {unb64} from '../vault/bytes';
-import {send} from '../ui/send';
-import {readLocal} from '../shared/readLocal';
-import type {EnvelopeV1} from '../vault/envelope';
 import {pageMode} from './mode';
 import {startMode} from './modes';
 import {browserPageDeps} from './browser';
 
-// unlock.html?mode=create|import|reauth&challenge=…|accounts|reveal shows that mode's section; no
-// mode is the unlock page below, whose handlers stay registered either way (on a hidden section).
+// unlock.html?mode=…: one screen run per page (src/unlock/modes.ts). The vault page renders only its own
+// fixed strings (src/unlock/strings.ts and the static markup), the user's own words and, on #10, the
+// re-validated challenge fields; it never touches the network and never writes storage.
 startMode(pageMode(location.search), browserPageDeps());
-
-// The vault page renders only its own fixed strings — nothing from a dApp, a token or the
-// network (spec §1). Every status line below is one of the WORDS/literal strings in this file.
-const status = document.getElementById('status') as HTMLParagraphElement;
-const pw = document.getElementById('password') as HTMLInputElement;
-const unlockBtn = document.getElementById('unlock') as HTMLButtonElement;
-const passkeyBtn = document.getElementById('passkey') as HTMLButtonElement;
-
-const WORDS: Record<Outcome | 'unavailable', string> = {
-  unlocked: 'Unlocked. You can close this tab.',
-  wrong: 'That did not unlock the wallet.',
-  failed: 'Unlock failed. Try again.',
-  damaged: "This wallet's stored data is damaged.",
-  'no-wallet': 'No wallet on this browser yet.',
-  unavailable: 'This device cannot unlock the wallet with a passkey; your password still works.',
-};
-
-const readEnvelope = (): Promise<unknown> => readLocal(ENVELOPE_KEY);
-
-// Cardinal rule 6 (no double-submit): one busy flag for the whole page, not one per button —
-// while a passkey prompt is in flight the password form must not be submittable, and vice
-// versa. `runExclusive` marks it busy synchronously, before either action's first `await`.
-let busy = false;
-const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
-
-// Spec §2: consecutive wrong outcomes add a growing wait before the buttons come back. It runs
-// inside runExclusive + withButtonsDisabled, so both buttons stay disabled and the gate held.
-const WAITING = 'That did not unlock the wallet. Wait a moment before trying again.';
-const backoff = createWrongBackoff(ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
-// The delay is a person-at-the-keyboard throttle held in this page's memory: reloading
-// unlock.html resets the streak. Spec §2 is explicit that against a stolen envelope only
-// Argon2id's cost stands, so this is deliberate, not an oversight.
-const showWaiting = (): void => {
-  pw.value = ''; // a near-miss password must not sit in the field for the whole wait
-  status.textContent = WAITING;
-};
-
-/**
- * Disables both buttons for the duration of `action` and re-enables them — and clears the
- * password field — in a `finally`, so a thrown error can never leave the page stuck mid-unlock.
- */
-async function withButtonsDisabled<T>(action: () => Promise<T>): Promise<T> {
-  unlockBtn.disabled = true;
-  passkeyBtn.disabled = true;
-  status.textContent = 'Unlocking…';
-  try {
-    return await action();
-  } finally {
-    unlockBtn.disabled = false;
-    passkeyBtn.disabled = false;
-    pw.value = '';
-  }
-}
-
-async function handlePasswordSubmit(): Promise<void> {
-  const password = pw.value;
-  const result = await runExclusive(gate, () =>
-    withButtonsDisabled(() => backoff.run(() => attemptUnlock({readEnvelope, send, unlockFlow}, {password, kdf: workerKdf}), showWaiting)),
-  );
-  if (result !== 'busy') status.textContent = WORDS[result];
-}
-
-document.getElementById('pw')?.addEventListener('submit', e => {
-  e.preventDefault();
-  void handlePasswordSubmit();
-});
-
-async function handlePasskeyClick(pk: NonNullable<EnvelopeV1['passkey']>): Promise<void> {
-  const result = await runExclusive(gate, () =>
-    withButtonsDisabled(() =>
-      backoff.run(
-        () =>
-          attemptPasskeyUnlock({
-            evaluatePrf: () => evaluatePrf(navigator.credentials, unb64(pk.credentialId), unb64(pk.prfSalt)),
-            readEnvelope,
-            send,
-            unlockFlow,
-          }),
-        showWaiting,
-      ),
-    ),
-  );
-  if (result !== 'busy') status.textContent = WORDS[result];
-}
-
-void readEnvelope().then(raw => {
-  const pk = (raw as EnvelopeV1 | undefined)?.passkey;
-  if (!pk) return;
-  passkeyBtn.hidden = false;
-  passkeyBtn.addEventListener('click', () => void handlePasskeyClick(pk));
-}, () => {
-  status.textContent = "This wallet's stored data could not be read. Reload this page.";
-});
```

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 13aa4e5..7ef3a61 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -10,6 +10,7 @@ import type {PageDeps} from './page';
 import {createCreateRun} from './screens/createRun';
 import {createImportRun} from './screens/importRun';
 import {mountPassword} from './screens/password';
+import {mountUnlock} from './screens/unlock';
 import {workerKdf} from '../vault/kdf';
 import {evaluatePrf} from '../vault/passkey';
 import {unb64} from '../vault/bytes';
@@ -74,7 +75,7 @@ const REVEAL_WORDS: Record<RevealOutcome['outcome'], string> = {
 const WAIT = 'That did not confirm it. Wait a moment before trying again.';
 const UNREADABLE = "This wallet's stored data could not be read. Reload this page.";
 // The B1b-1 thin sections the plan-2 screens have not replaced yet.
-const SECTIONS = ['unlock-section', 'import', 'reauth', 'accounts', 'reveal'] as const;
+const SECTIONS = ['import', 'reauth', 'accounts', 'reveal'] as const;
 
 const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
 const say = (text: string): void => {
@@ -113,8 +114,12 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
     else create.start(mode.mode === 'welcome' ? 'welcome' : 'intro');
     return;
   }
-  const shown = mode.mode === 'unlock' || mode.mode === 'forgot' ? 'unlock-section' : mode.mode;
-  legacy(shown);
+  if (mode.mode === 'unlock' || mode.mode === 'forgot') {
+    legacy(null);
+    void mountUnlock(deps).show(mode.mode === 'unlock' ? mode.returnTo : null);
+    return;
+  }
+  legacy(mode.mode);
   if (mode.mode === 'import') startImport();
   if (mode.mode === 'reauth') startReauth(mode.challengeId);
   if (mode.mode === 'accounts') startAccounts();
```

Create `extension/src/unlock/screens/unlock.ts`:

```ts
import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import type {ReturnTo} from '../mode';
import {attemptPasskeyUnlock, attemptUnlock, createWrongBackoff, type Outcome} from '../orchestrate';
import {CLOSE_CHECK_MS, exclusive, type PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, UNLOCK} from '../strings';
import {unlockFlow} from '../unlockFlow';
import {byId, closeOrHide, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';

/**
 * #9 unlock (spec §3.9), in a tab (D12): the password (or the passkey, when the envelope has one) →
 * vault.setKeys. A wrong password gets the engine's backoff only (D11: ≤ 30 s in this page's memory,
 * no counter, no wipe), shown as the design's cooldown card. "Forgot password?" → #39. With
 * `&return=created|imported` a successful unlock goes straight on to that UI-tab route (#7, #40).
 * The page reads what is stored first: no wallet → "No wallet on this browser yet." + [Set up a wallet];
 * a damaged vault → the damaged line, never the password field (and never charged to the backoff).
 */
export function mountUnlock(deps: PageDeps): {show(returnTo: ReturnTo | null): Promise<void>} {
  const field = byId<HTMLInputElement>('unl-password');
  const submit = byId<HTMLButtonElement>('unl-submit');
  const passkey = byId<HTMLButtonElement>('unl-passkey');
  const backoff = createWrongBackoff(deps.sleep);
  let returnTo: ReturnTo | null = null;
  let pk: {credentialId: string; prfSalt: string} | null = null;
  let stopCooldown: (() => void) | null = null;
  let entry = true;

  const render = () => {
    const busy = deps.gate.isBusy();
    const cooling = stopCooldown !== null;
    shown(byId('unl-entry'), entry && !cooling);
    shown(byId('unl-cooldown'), cooling);
    shown(submit, entry && !cooling);
    shown(byId('unl-paused'), cooling);
    shown(passkey, entry && !cooling && pk !== null);
    shown(byId('unl-forgot'), entry);
    field.disabled = busy;
    submit.disabled = busy;
    passkey.disabled = busy;
  };
  const helper = (text: string, error: boolean) => {
    setText(byId('unl-helper'), text);
    byId('unl-helper').classList.toggle('error', error);
    byId('unl-tile').classList.toggle('is-error', error);
    field.classList.toggle('is-error', error);
  };
  const notice = (line: string, help: string) => {
    entry = false;
    setText(byId('unl-notice-line'), line);
    setText(byId('unl-notice-help'), help);
    shown(byId('unl-notice'), true);
    render();
  };
  const cooldown = (ms: number) => {
    field.value = ''; // a near-miss password must not sit in the field for the whole wait
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('unl-timer'), label: byId('unl-cooldown-label'), ring: byId('unl-ring')});
    render();
  };
  const settle = (out: Outcome | 'unavailable') => {
    stopCooldown?.();
    stopCooldown = null;
    if (out === 'unlocked') {
      helper('', false);
      if (returnTo !== null) return deps.go(returnTo === 'created' ? 'wallet.html#/created' : 'wallet.html#/imported');
      notice(UNLOCK.unlocked, UNLOCK.openIcon);
      shown(byId('unl-close'), true);
      return;
    }
    if (out === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp);
    if (out === 'no-wallet') {
      notice(COMMON.noWallet, '');
      shown(byId('unl-setup'), true);
      return;
    }
    helper(out === 'wrong' ? UNLOCK.wrong : out === 'unavailable' ? UNLOCK.unavailable : UNLOCK.failed, out === 'wrong');
  };

  const unlock = () =>
    void exclusive(deps, render, async () => {
      if (!entry) return;
      const password = field.value;
      helper(UNLOCK.unlocking, false);
      const out = await backoff.run(() => attemptUnlock({readEnvelope: deps.store.readEnvelope, send: deps.send, unlockFlow}, {password, kdf: deps.kdf}), cooldown);
      field.value = '';
      settle(out);
    });
  const unlockWithPasskey = () =>
    void exclusive(deps, render, async () => {
      const key = pk;
      if (!entry || key === null) return;
      helper(UNLOCK.unlocking, false);
      const out = await backoff.run(
        () =>
          attemptPasskeyUnlock({
            evaluatePrf: () => evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt)),
            readEnvelope: deps.store.readEnvelope,
            send: deps.send,
            unlockFlow,
          }),
        cooldown,
      );
      settle(out);
    });

  deps.gate.onIdle(render);
  byId('unl-form').addEventListener('submit', e => {
    e.preventDefault();
    unlock();
  });
  submit.addEventListener('click', unlock);
  passkey.addEventListener('click', unlockWithPasskey);
  byId('unl-forgot').addEventListener('click', () => deps.go('unlock.html?mode=forgot'));
  byId('unl-setup').addEventListener('click', () => deps.go('unlock.html?mode=welcome'));
  byId('unl-close').addEventListener('click', () => closeOrHide(deps.closeTab, f => void deps.timers.setTimeout(f, CLOSE_CHECK_MS), byId('unl-close')));

  return {
    async show(r) {
      returnTo = r;
      showScreen('v-unlock');
      render();
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        return notice(COMMON.unreadable, '');
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') return settle('no-wallet');
      if (stored.kind === 'damaged') return settle('damaged');
      pk = stored.env.passkey ?? null;
      render();
      field.focus();
    },
  };
}
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 9873d03..2aeee3c 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -99,6 +99,16 @@ export const PASSKEY = {
   failed: 'Something went wrong. Your password still works.',
 } as const;
 
+/** #9 unlock (D7, D11). */
+export const UNLOCK = {
+  unlocking: 'Unlocking…',
+  wrong: 'That did not unlock the wallet.',
+  failed: 'Unlock failed. Try again.',
+  unlocked: 'Unlocked.',
+  openIcon: 'Open the Noctura icon to continue.',
+  unavailable: 'This device cannot unlock the wallet with a passkey; your password still works.',
+} as const;
+
 /** #9's cooldown card (and #10's, which reuses it): "0:12", and the design's helper line. */
 export const clockText = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
 export const cooldownLabel = (seconds: number): string => `Cooldown · ${Math.floor(seconds / 60)} minutes ${seconds % 60} seconds remaining`;
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 584098f..829bec7 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -93,6 +93,12 @@
   max-width: 300px;
   margin: 0 auto;
 }
+.vlt-gap-5 {
+  margin-bottom: var(--space-5);
+}
+.vlt-pad-cooldown {
+  padding: var(--space-7) var(--space-5) 0;
+}
 .vlt-features {
   margin-top: var(--space-7);
   padding: 0 var(--space-2);
@@ -262,3 +268,24 @@
   font: 500 15px/22px var(--font-body);
   cursor: pointer;
 }
+
+/* #9, #10: the design's 56 px lock tile (inline in the mockup): --accent on --accent-tint, --danger after a
+   wrong password. */
+.vlt-lock-tile {
+  width: 56px;
+  height: 56px;
+  border-radius: var(--radius-icon-hero);
+  background: var(--accent-tint);
+  color: var(--accent);
+  display: grid;
+  place-items: center;
+  margin-bottom: var(--space-4);
+}
+.vlt-lock-tile.is-error {
+  background: color-mix(in oklab, var(--danger) 18%, transparent);
+  color: var(--danger);
+}
+/* The cooldown ring shows the share of the wait still to run (the design draws 64 %). */
+.vlt-col .cooldown-card .ring {
+  background: conic-gradient(var(--warning) calc(var(--vlt-ring, 1) * 100%), var(--bg-surface-3) 0);
+}
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index d6db20a..f88da9e 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -91,15 +91,6 @@
         </div>
       </section>
 
-      <section id="unlock-section">
-        <h1>Unlock Noctura</h1>
-        <form id="pw">
-          <label for="password">Password</label>
-          <input id="password" type="password" autocomplete="current-password" minlength="12" required />
-          <button id="unlock" type="submit">Unlock</button>
-        </form>
-        <button id="passkey" type="button" hidden>Unlock with passkey</button>
-      </section>
       <section id="import" hidden>
         <h1>Import a wallet</h1>
         <label for="phrase">Recovery phrase (12 or 24 words)</label>
@@ -336,6 +327,45 @@
         </div>
       </section>
 
+      <!-- #9 unlock (spec §3.9, D7, D11): a password field replaces the keypad; the engine's backoff only. -->
+      <section id="v-unlock" class="screen s-pin" hidden>
+        <div id="unl-entry">
+          <div class="pin-head">
+            <div id="unl-tile" class="vlt-lock-tile" aria-hidden="true"><svg width="28" height="28"><use href="#i-lock" /></svg></div>
+            <h1 class="noc-h1">Welcome back</h1>
+            <p class="noc-body vlt-lede">Enter your password to unlock.</p>
+            <form id="unl-form" class="vlt-field-row">
+              <input id="unl-password" class="vlt-input" type="password" autocomplete="current-password" aria-label="Password" />
+            </form>
+          </div>
+          <p id="unl-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        </div>
+        <div id="unl-cooldown" hidden>
+          <div class="vlt-pad-cooldown">
+            <h1 class="noc-h1 vlt-center vlt-gap-2">Wait a moment</h1>
+            <p class="noc-body vlt-lede vlt-center vlt-narrow-300 vlt-gap-5">That did not unlock the wallet. Wait a moment before trying again.</p>
+          </div>
+          <div class="cooldown-card">
+            <div id="unl-ring" class="ring"></div>
+            <div id="unl-timer" class="timer noc-numeral" aria-live="polite" aria-atomic="true"></div>
+            <div id="unl-cooldown-label" class="noc-body-sm label"></div>
+          </div>
+        </div>
+        <div id="unl-notice" class="vlt-notice" role="status" hidden>
+          <p id="unl-notice-line" class="noc-body"></p>
+          <p id="unl-notice-help" class="noc-body-sm vlt-lede"></p>
+        </div>
+        <div class="pin-spacer"></div>
+        <button id="unl-forgot" type="button" class="btn btn-tertiary forgot-link">Forgot password?</button>
+        <div class="sticky-bar">
+          <button id="unl-submit" type="button" class="btn btn-primary">Unlock</button>
+          <button id="unl-paused" type="button" class="btn btn-secondary" disabled hidden>Unlock paused</button>
+          <button id="unl-passkey" type="button" class="btn btn-secondary" hidden>Unlock with passkey</button>
+          <button id="unl-setup" type="button" class="btn btn-primary" hidden>Set up a wallet</button>
+          <button id="unl-close" type="button" class="btn btn-secondary" hidden>Close this tab</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/app/__tests__/App.test.tsx src/unlock/__tests__/unlockScreen.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 93 passed (93) Tests 1180 passed (1180).

- [ ] **Step 5: The E2E that unlocked through the old markup.**

Modify `extension/e2e/unlock.spec.ts`:

```diff
diff --git a/extension/e2e/unlock.spec.ts b/extension/e2e/unlock.spec.ts
index ff4859c..36eb6ff 100644
--- a/extension/e2e/unlock.spec.ts
+++ b/extension/e2e/unlock.spec.ts
@@ -22,9 +22,9 @@ test('unlocking in the vault page puts only signing keys into session storage',
 
     const page = await ctx.newPage();
     await page.goto(`chrome-extension://${id}/unlock.html`);
-    await page.fill('#password', E2E_PASSWORD);
-    await page.click('#unlock');
-    await expect(page.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});
+    await page.fill('#unl-password', E2E_PASSWORD);
+    await page.click('#unl-submit');
+    await expect(page.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
 
     const session = await sw.evaluate(() => chrome.storage.session.get(null));
     const json = JSON.stringify(session);
@@ -39,17 +39,18 @@ test('unlocking in the vault page puts only signing keys into session storage',
 
     // Negative control: a wrong password sends nothing and leaves the session untouched.
     await sw.evaluate(() => chrome.storage.session.clear());
-    await page.fill('#password', 'wrong horse battery staple');
-    await page.click('#unlock');
-    await expect(page.locator('#status')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
+    await page.reload();
+    await page.fill('#unl-password', 'wrong horse battery staple');
+    await page.click('#unl-submit');
+    await expect(page.locator('#unl-helper')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
     expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});
 
-    // A malformed stored envelope is named as damaged — not a wrong password — and sends nothing.
+    // A malformed stored envelope is named as damaged — before any password is typed, so never as a
+    // wrong password — and sends nothing.
     await sw.evaluate(e => chrome.storage.local.set({v1_vault: e}), {...env, password: {wrapped: 'AAAA'}});
     await page.reload();
-    await page.fill('#password', E2E_PASSWORD);
-    await page.click('#unlock');
-    await expect(page.locator('#status')).toHaveText("This wallet's stored data is damaged.", {timeout: 60_000});
+    await expect(page.locator('#unl-notice-line')).toHaveText("This wallet's stored data is damaged.", {timeout: 60_000});
+    await expect(page.locator('#unl-password')).toBeHidden();
     expect(await sw.evaluate(() => chrome.storage.session.get(null))).toEqual({});
     expect(nocTura.hits).toEqual([]);
     expect(solscan.hits).toEqual([]);
```

Modify `extension/e2e/vaultPage.ts`:

```diff
diff --git a/extension/e2e/vaultPage.ts b/extension/e2e/vaultPage.ts
index b4e914d..e30aacf 100644
--- a/extension/e2e/vaultPage.ts
+++ b/extension/e2e/vaultPage.ts
@@ -50,3 +50,11 @@ export async function setPassword(vault: Page, password: string): Promise<void>
   await vault.locator('#pw-field').fill(password);
   await vault.locator('#pw-cta').click();
 }
+
+/** #9: unlocks with the password and waits for "Unlocked." (no return target). */
+export async function unlockWith(vault: Page, id: string, password: string): Promise<void> {
+  await vault.goto(`chrome-extension://${id}/unlock.html`);
+  await vault.locator('#unl-password').fill(password);
+  await vault.locator('#unl-submit').click();
+  await expect(vault.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
+}
```

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
index 6d2bc74..10efa63 100644
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -3,7 +3,7 @@ import {readFileSync, rmSync} from 'node:fs';
 import {BLOCKHASH_LIFETIME, installFakeCoordinator, type FakeCoordinator} from './fakeCoordinator';
 import {makeEnvelope, E2E_PASSWORD} from './makeEnvelope';
 import {containNocTura, containSolscan, expectContained, launchContained} from './launch';
-import {createWallet} from './vaultPage';
+import {createWallet, unlockWith} from './vaultPage';
 // Read from the source rather than imported: core/ has no package.json "type", so Playwright's loader
 // on Node 22 (CI) treats core/solana/rpc.ts as CommonJS and cannot take a named export from it.
 // The same literal the RPC-method gate parses; not found means it moved — fail loudly.
@@ -108,10 +108,7 @@ test('create a wallet, unlock it, re-authenticate a first send, send SOL: pendin
     // 2. Lock, then unlock with the password (B1a's unlock mode).
     expect((await msg(popup, {type: 'vault.lock'})).ok).toBe(true);
     expect(((await msg(popup, {type: 'wallet.state'})).data as {unlocked: boolean}).unlocked).toBe(false);
-    await vault.goto(`chrome-extension://${id}/unlock.html`);
-    await vault.fill('#password', NEW_PASSWORD);
-    await vault.click('#unlock');
-    await expect(vault.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});
+    await unlockWith(vault, id, NEW_PASSWORD);
     const state = (await msg(popup, {type: 'wallet.state'})).data as {hasWallet: boolean; unlocked: boolean; accounts: {publicKey: string}[]};
     expect(state.hasWallet).toBe(true);
     expect(state.unlocked).toBe(true);
@@ -170,10 +167,7 @@ test('an unconfirmed send expires: "no funds moved", nothing re-sent, and only t
     fake.mode = 'expire';
     await sw.evaluate(({env, recipient}) => chrome.storage.local.set({v1_vault: env, v1_known_recipients: [recipient]}), {env: await makeEnvelope(), recipient: RECIPIENT});
     const vault = await ctx.newPage();
-    await vault.goto(`chrome-extension://${id}/unlock.html`);
-    await vault.fill('#password', E2E_PASSWORD);
-    await vault.click('#unlock');
-    await expect(vault.locator('#status')).toHaveText('Unlocked. You can close this tab.', {timeout: 60_000});
+    await unlockWith(vault, id, E2E_PASSWORD);
 
     const intent = {token: 'SOL', recipient: RECIPIENT, amount: '1000000'};
     const {signature, id: pendingId} = await prepareAndSend(popup, E2E_ACCOUNT, intent);
```

Run: `npm run build && npx playwright test e2e/wallet.spec.ts e2e/unlock.spec.ts`
Expected: 3 passed (a damaged envelope is now named before any password is typed).

- [ ] **Step 6: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- a damaged vault gets the password field → RED Tests  1 failed | 10 passed (11)
- return= ignored → RED Tests  2 failed | 9 passed (11)

- [ ] **Step 7: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `09-idle`, `09-error`, `09-cooldown`, `09-unlocked`, `09-no-wallet`, `09-damaged`, `09-locked (popup, plan 1’s shot, now with "Forgot password?")`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/e2e/unlock.spec.ts extension/e2e/vaultPage.ts extension/e2e/wallet.spec.ts extension/src/app/__tests__/App.test.tsx extension/src/app/platform.ts extension/src/app/screens/Locked.tsx extension/src/unlock/__tests__/unlockScreen.test.ts extension/src/unlock/main.ts extension/src/unlock/modes.ts extension/src/unlock/screens/unlock.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/unlock.html
git commit -m "feat(extension): #9 unlock — the cooldown card, passkey, return targets, "Forgot password?" (vault page and popup)" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 11: #10 unlock-send — the action from the background, every state, `[Cancel send]` discards (E7), the hand-over to the resume route (D38)

**Files:**
- Modify: `extension/e2e/wallet.spec.ts`
- Create: `extension/src/unlock/__tests__/reauthScreen.test.ts`
- Modify: `extension/src/unlock/modes.ts`
- Create: `extension/src/unlock/screens/reauth.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Tasks 1, 3, 4, 5, 8, 10; `runReauth` (Task 3), the resume target (Task 4).
- Produces: `src/unlock/screens/reauth.ts`: `mountReauth(deps): {show(challengeId: string): Promise<void>}`; `strings.ts`: `REAUTH.aboutSend`, `aboutChange`, `to`, `cancelSend`, `cancel`, `close`, `nothingSent`

Spec §3.10 (D7, D11, D12, D38, D39, E3, E7). `loading` ("Reading the details…") → `vault.challengeInfo` (Task 3). `idle`: the top bar's X and "Confirm with password", "You are about to send", the exact amount and the token from the page's own table, "To" + the **full recipient in groups of four**, "Network fee" and the Noctura-fee line (or its reason) and "New token account" when non-zero (Scope 4), "Enter your password", one fixed line per engine reason, `[Confirm]`, `[Confirm with passkey]` when the envelope has one, `[Cancel send]`. `error` ("That did not confirm it."), `cooldown` (#9's card with "That did not confirm it. Wait a moment before trying again." and `[Confirm paused]`, controller addition), `undescribable` ("The details of this action could not be shown." with **only** `[Cancel send]` — no Confirm, no field; it discards the send by the account `readChallenge` re-validated by itself, and when even that is not an address the button is `[Close]` with "Nothing was sent. Start the send again from the Noctura icon." — no "cancelled" — both controller additions, confirmed by the owner 2026-10-01, plan-2 review H1), `not-unlocked` (+ `[Unlock]` → `?mode=unlock`, no return target, M7), `mismatch-locked`, `expired` (from `challengeInfo` **or** `vault.reauthOk`, D39), `damaged`, `no-wallet`. `confirmed` → `location.replace('wallet.html#/send/resume?account=…')` in the same tab — **nothing is sent from #10** (D38). `[Cancel send]` and the X → `wallet.discardPrepared {account}` first; only when the background says ok: "Send cancelled. Nothing was sent." and the tab closes; a refused discard says "Something went wrong. Try again." and keeps the screen. A settings challenge (B1b-2b's) shows "You are about to change" and its lines; confirmed → "Confirmed. You can close this tab."; its cancel ("Cancel", controller addition — confirmed by the owner 2026-10-01) only closes the tab and the challenge simply expires. In every other notice (`expired`, `not-unlocked`, `mismatch-locked`, `damaged`, `no-wallet`) the top bar's X closes the tab and claims nothing (plan-2 review L4). Rule 6: a second `[Cancel send]` (or the X) before the first settles sends one `wallet.discardPrepared` (M6). `wallet.spec.ts`'s re-authentication goes through #10 and asserts the hand-over URL and that nothing was broadcast.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/unlock/__tests__/reauthScreen.test.ts`:

```ts
// @vitest-environment happy-dom
import {base64} from '@scure/base';
import {createEnvelope, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {CHALLENGE_TTL_MS, challengeInfo, issueChallenge, type ChallengeAbout} from '../../background/reauthChallenges';
import {getSession, setSession} from '../../background/session';
import {prepareSend} from '../../background/prepare';
import {handleMessage} from '../../background/messages';
import {ACCOUNT, RECIPIENT, sendReader} from '../../background/__tests__/fixtures';
import {mountReauth} from '../screens/reauth';
import {UNLOCK_SENDER, click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';
const B = (n: number) => base64.encode(new Uint8Array(n).fill(1));
const SEND = (account: string): Extract<ChallengeAbout, {kind: 'send'}> => ({
  kind: 'send',
  account,
  token: 'SOL',
  recipient: RECIPIENT,
  amount: '2480000000',
  networkLamports: '5050',
  markupLamports: '0',
  markupReason: 'status-unknown',
  rentLamports: '0',
  reasons: ['first-send', 'over-usd-threshold'],
  thresholdCents: 10_000,
});

beforeEach(loadPage);

/** The real wallet M stored and unlocked, a challenge issued for `about`, #10 shown on it. */
async function shown(about: ChallengeAbout = SEND(K0), o: {holdSleep?: boolean; unlocked?: boolean; vault?: EnvelopeV1} = {}) {
  const env = o.vault ?? (await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf}));
  const h = await harness({vault: env, holdSleep: o.holdSleep});
  if (o.unlocked !== false) await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  const id = await issueChallenge(h.ext, h.wallet, 'digest', about);
  await mountReauth(h.deps).show(id);
  return {h, id};
}
const confirmWith = (password: string) => {
  type(el<HTMLInputElement>('ra-password'), password);
  click(el('ra-confirm'));
};

describe('#10 unlock-send (spec §3.10)', () => {
  it('idle: the action read from the background — amount, the full recipient in groups of four, each fee line, one reason line per engine reason', async () => {
    await shown();
    const screen = el('v-reauth');
    expect(text(screen.querySelector('.top-bar .title'))).toBe('Confirm with password');
    expect(visible(el('ra-loading'))).toBe(false);
    expect(text(el('ra-about'))).toBe('You are about to send');
    expect([text(el('ra-amount')), text(el('ra-symbol'))]).toEqual(['2.4800', 'SOL']);
    const rows = [...el('ra-rows').querySelectorAll('.intent-row')];
    expect(rows.map(r => [text(r.querySelector('.label')), text(r.querySelector('.value'))])).toEqual([
      ['To', RECIPIENT],
      ['Network fee', '0.00000505 SOL'],
      ['No Noctura fee (status unknown)', ''],
    ]);
    expect([...rows[0]!.querySelectorAll('.addr-groups > span')].map(text)).toEqual(RECIPIENT.match(/.{1,4}/g));
    expect(text(screen.querySelector('#ra-entry h2'))).toBe('Enter your password');
    expect([...el('ra-reasons').querySelectorAll('p')].map(text)).toEqual(['Re-auth required for the first send to a new address.', 'Re-auth required for transactions over $100.']);
    expect(text(el('ra-confirm'))).toBe('Confirm');
    expect(text(el('ra-cancel'))).toBe('Cancel send');
    expect(visible(el('ra-passkey'))).toBe(false);
    expect(text(screen)).not.toMatch(/PIN|attempts left|Gabc/);
    expect(unstyled('v-reauth')).toEqual([]);
  });

  it('confirmed: the challenge is satisfied and the SAME tab goes to the resume route — nothing is sent from here (D38)', async () => {
    const {h, id} = await shown();
    confirmWith(PW);
    expect(text(el('ra-helper'))).toBe('Checking…');
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual([`wallet.html#/send/resume?account=${K0}`]);
    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo', 'vault.status', 'vault.reauthOk']);
    const stored = (await h.ext.session.get('v1_reauth')) as Record<string, {satisfied: boolean}>;
    expect(stored[id]?.satisfied).toBe(true);
  });

  it('error: "That did not confirm it." (D11), the field shakes; the challenge stays unsatisfied', async () => {
    const {h} = await shown();
    confirmWith('not the password at all');
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.');
    expect(el('ra-helper').classList.contains('error')).toBe(true);
    expect(el('ra-password').classList.contains('is-error')).toBe(true);
    expect(h.sent.some(m => m.type === 'vault.reauthOk')).toBe(false);
    expect(unstyled('v-reauth')).toEqual([]);
  });

  it('cooldown: #9’s card with "That did not confirm it. Wait a moment before trying again." and [Confirm paused]', async () => {
    const {h} = await shown(SEND(K0), {holdSleep: true});
    confirmWith('wrong wrong wrong wrong');
    await h.until(() => text(el('ra-helper')) === 'That did not confirm it.');
    h.wake();
    await h.until(() => !h.deps.gate.isBusy());
    confirmWith('wrong wrong wrong wrong');
    await h.until(() => visible(el('ra-cooldown')));
    expect(text(el('ra-cooldown'))).toBe('Wait a moment That did not confirm it. Wait a moment before trying again. 0:01 Cooldown · 0 minutes 1 seconds remaining');
    expect(text(el('ra-paused'))).toBe('Confirm paused');
    expect(el<HTMLButtonElement>('ra-paused').disabled).toBe(true);
    expect(unstyled('v-reauth')).toEqual([]);
    h.wake();
  });

  // D39: the challenge expired while the password was typed — "expired", never "failed".
  it('expired while typing: vault.reauthOk answers unknown-challenge → "This confirmation has expired…"', async () => {
    const {h} = await shown();
    h.wallet.clock.t += CHALLENGE_TTL_MS + 1;
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe('This confirmation has expired. Start the send again from the Noctura icon.');
    expect(text(document.body)).not.toContain('Something went wrong');
    expect(visible(el('ra-confirm'))).toBe(false);
  });

  it('a challenge id the background does not know (or expired) shows "expired" at once', async () => {
    const h = await harness({vault: await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf})});
    await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
    await mountReauth(h.deps).show('cd'.repeat(16));
    expect(text(el('ra-notice-line'))).toBe('This confirmation has expired. Start the send again from the Noctura icon.');
    expect(visible(el('ra-intent'))).toBe(false);
  });

  it('locked: "The wallet locked while you were confirming…" + [Unlock] → ?mode=unlock (no return target, M7)', async () => {
    const {h} = await shown(SEND(K0), {unlocked: false});
    expect(text(el('ra-notice-line'))).toBe('The wallet locked while you were confirming. Unlock it and start the send again.');
    click(el('ra-unlock'));
    expect(h.went).toEqual(['unlock.html?mode=unlock']);
  });

  // E3's fail-closed rule: the background stored it, the page cannot describe it → only Cancel.
  it('undescribable: "The details of this action could not be shown." with only [Cancel send] — no Confirm, no field (negative control)', async () => {
    const {h} = await shown({...SEND(K0), markupReason: 'charged'});
    expect(text(el('ra-notice-line'))).toBe('The details of this action could not be shown.');
    expect(visible(el('ra-cancel'))).toBe(true);
    expect(text(el('ra-cancel'))).toBe('Cancel send');
    expect(visible(el('ra-confirm'))).toBe(false);
    expect(visible(el('ra-passkey'))).toBe(false);
    expect(visible(el('ra-entry'))).toBe(false);
    expect(visible(el('ra-intent'))).toBe(false);
    expect(document.querySelector('#v-reauth button:not([hidden]):not(#ra-cancel):not(#ra-x)')).toBeNull();
    expect(h.sent.map(m => m.type)).toEqual(['vault.challengeInfo']);
  });

  it('mismatch: a session that is not this wallet’s is locked, and the page says so', async () => {
    const env = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'A', publicKey: K0}], kdf: testKdf});
    const h = await harness({vault: env});
    await setSession(h.ext, [ACCOUNT]);
    const id = await issueChallenge(h.ext, h.wallet, 'digest', SEND(ACCOUNT.publicKey));
    await mountReauth(h.deps).show(id);
    confirmWith(PW);
    await h.until(() => visible(el('ra-notice')));
    expect(text(el('ra-notice-line'))).toBe('That did not match this wallet, so the wallet has been locked.');
    expect(await getSession(h.ext)).toBeNull();
  });

  it('rule 6: a second Confirm before the first settles sends one vault.reauthOk', async () => {
    const {h} = await shown();
    confirmWith(PW);
    click(el('ra-confirm'));
    await h.until(() => h.went.length > 0);
    expect(h.sent.filter(m => m.type === 'vault.reauthOk')).toHaveLength(1);
  });
});

const LOCKED_VAULT = {v: 1, scheme: 'slip10', kdf: {alg: 'argon2id', m: 65536, t: 3, p: 1, salt: B(16)}, seed: {iv: B(12), ct: B(48)}, password: {wrapped: B(40)}, accounts: [{index: 0, name: 'A', publicKey: ACCOUNT.publicKey}]};

/** A real prepared send for ACCOUNT (its challenge issued by the background); `about` replaces what #10 reads. */
async function prepared(about?: unknown) {
  const h = await harness({
    vault: LOCKED_VAULT,
    send: inner => async m => ((m as {type: string}).type === 'vault.challengeInfo' && about !== undefined ? {ok: true, data: about} : inner(m)),
  });
  await setSession(h.ext, [ACCOUNT]);
  h.wallet.reader = sendReader();
  const view = await prepareSend(h.ext, h.wallet, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1000000'});
  const id = view.reauth!.challengeId;
  return {h, id};
}
const stillPrepared = async (h: Awaited<ReturnType<typeof harness>>) =>
  ((await handleMessage(h.ext, {type: 'wallet.preparedFor', account: ACCOUNT.publicKey}, UNLOCK_SENDER, h.wallet)) as {data: unknown}).data !== null;

describe('#10 [Cancel send] discards the prepared send (E7), against the real background', () => {
  it('drops the prepared send and its challenge, says "Send cancelled. Nothing was sent." and closes the tab', async () => {
    const {h, id} = await prepared();
    await mountReauth(h.deps).show(id);
    click(el('ra-cancel'));
    await h.until(() => h.closed > 0);
    expect(text(el('ra-notice-line'))).toBe('Send cancelled. Nothing was sent.');
    expect(h.sent.find(m => m.type === 'wallet.discardPrepared')).toEqual({type: 'wallet.discardPrepared', account: ACCOUNT.publicKey});
    expect(await challengeInfo(h.ext, h.wallet.now(), id)).toBeNull();
    expect(await handleMessage(h.ext, {type: 'wallet.preparedFor', account: ACCOUNT.publicKey}, UNLOCK_SENDER, h.wallet)).toEqual({ok: true, data: null});
    expect(visible(el('ra-cancel'))).toBe(false);
  });

  // H1 (plan review): an action the page cannot describe is still a prepared send — Cancel must drop it.
  it('undescribable, its account valid by itself: [Cancel send] discards that send, then "Send cancelled…"', async () => {
    const {h, id} = await prepared({...SEND(ACCOUNT.publicKey), markupReason: 'charged'});
    await mountReauth(h.deps).show(id);
    expect(text(el('ra-notice-line'))).toBe('The details of this action could not be shown.');
    expect(text(el('ra-cancel'))).toBe('Cancel send');
    click(el('ra-cancel'));
    await h.until(() => h.closed > 0);
    expect(h.sent.filter(m => m.type === 'wallet.discardPrepared')).toEqual([{type: 'wallet.discardPrepared', account: ACCOUNT.publicKey}]);
    expect(await stillPrepared(h)).toBe(false);
    expect(await challengeInfo(h.ext, h.wallet.now(), id)).toBeNull();
    expect(text(el('ra-notice-line'))).toBe('Send cancelled. Nothing was sent.');
  });

  it('undescribable with no valid account: [Close] and a true line — nothing is sent and nothing says "cancelled"', async () => {
    const {h, id} = await prepared({...SEND(ACCOUNT.publicKey), account: 'not an address', token: 'BONK'});
    await mountReauth(h.deps).show(id);
    expect(text(el('ra-notice-line'))).toBe('The details of this action could not be shown.');
    expect(text(el('ra-notice-help'))).toBe('Nothing was sent. Start the send again from the Noctura icon.');
    expect(text(el('ra-cancel'))).toBe('Close');
    expect(el('ra-x').getAttribute('aria-label')).toBe('Close');
    click(el('ra-cancel'));
    await h.until(() => h.closed > 0);
    expect(h.sent.some(m => m.type === 'wallet.discardPrepared')).toBe(false);
    expect(text(document.body)).not.toMatch(/cancelled/i);
    expect(await stillPrepared(h)).toBe(true);
  });

  it('rule 6: a second [Cancel send] before the first settles sends one wallet.discardPrepared', async () => {
    const {h, id} = await prepared();
    await mountReauth(h.deps).show(id);
    click(el('ra-cancel'));
    click(el('ra-cancel'));
    click(el('ra-x'));
    await h.until(() => h.closed > 0 && !h.deps.gate.isBusy());
    expect(h.sent.filter(m => m.type === 'wallet.discardPrepared')).toHaveLength(1);
    expect(h.closed).toBe(1);
  });

  // L4 (plan review): a notice with nothing to cancel still has a way out — the X closes, claiming nothing.
  it('expired, locked or mismatch: the top bar’s X closes the tab, sends nothing and says nothing was cancelled', async () => {
    const {h, id} = await prepared();
    h.wallet.clock.t += CHALLENGE_TTL_MS + 1;
    await mountReauth(h.deps).show(id);
    expect(text(el('ra-notice-line'))).toBe('This confirmation has expired. Start the send again from the Noctura icon.');
    expect(el<HTMLButtonElement>('ra-x').disabled).toBe(false);
    expect(el('ra-x').getAttribute('aria-label')).toBe('Close');
    click(el('ra-x'));
    expect(h.closed).toBe(1);
    expect(h.sent.some(m => m.type === 'wallet.discardPrepared')).toBe(false);
    expect(text(document.body)).not.toMatch(/cancelled/i);
  });

  it('a discard the background refuses keeps the screen and says so — no "Send cancelled" it cannot vouch for', async () => {
    const {h} = await shown(SEND(K0));
    const inner = h.deps.send;
    h.deps.send = async m => ((m as {type: string}).type === 'wallet.discardPrepared' ? {ok: false, error: 'failed'} : inner(m));
    click(el('ra-cancel'));
    await h.until(() => text(el('ra-helper')) === 'Something went wrong. Try again.');
    expect(h.closed).toBe(0);
    expect(visible(el('ra-notice'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/reauthScreen.test.ts`
Expected (dry run): FAIL — Test Files 1 failed (1) Tests no tests (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 7ef3a61..6b9d746 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -1,7 +1,6 @@
 import {ENVELOPE_KEY} from './unlockFlow';
 import {MIN_PASSWORD_LENGTH, detectImport, finishOnboarding, indexesFor, type Candidate, type FinishOutcome, type ProbeResult} from './onboarding';
 import {addAccount, removeAccount, type AccountsOutcome} from './accountsFlow';
-import {runReauth, type ReauthPageOutcome} from './reauthFlow';
 import {runReveal, type RevealOutcome} from './revealFlow';
 import {createWrongBackoff, runExclusive, type BusyGate} from './orchestrate';
 import {backgroundVaultStore} from './vaultStore';
@@ -10,14 +9,11 @@ import type {PageDeps} from './page';
 import {createCreateRun} from './screens/createRun';
 import {createImportRun} from './screens/importRun';
 import {mountPassword} from './screens/password';
+import {mountReauth} from './screens/reauth';
 import {mountUnlock} from './screens/unlock';
 import {workerKdf} from '../vault/kdf';
-import {evaluatePrf} from '../vault/passkey';
-import {unb64} from '../vault/bytes';
-import type {EnvelopeV1} from '../vault/envelope';
 import {send} from '../ui/send';
 import {readLocal} from '../shared/readLocal';
-import {REAUTH} from './strings';
 
 // Thin page modes for B1b-1 (the owner's screens arrive in B1b-2). The vault page renders only its
 // own fixed strings (spec §1): every status line is a literal below, and the only other text it
@@ -37,17 +33,6 @@ const CHOOSE_WORDS = {
   'both-funded': 'Both address types on this phrase hold funds. Choose the one to use.',
   unresolved: 'Balances could not be checked. Choose the address type to use.',
 } as const;
-const REAUTH_WORDS: Record<ReauthPageOutcome | 'unavailable', string> = {
-  confirmed: 'Confirmed. You can close this tab.',
-  wrong: 'That did not confirm it.',
-  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
-  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
-  expired: REAUTH.expired,
-  damaged: "This wallet's stored data is damaged.",
-  'no-wallet': 'No wallet on this browser yet.',
-  failed: 'Something went wrong. Try again.',
-  unavailable: 'This device cannot confirm with a passkey; your password still works.',
-};
 const ACCOUNTS_WORDS: Record<AccountsOutcome, string> = {
   done: 'Done. The accounts are updated.',
   'done-locked': 'The accounts were changed, and the wallet has been locked. Unlock it to use them.',
@@ -73,9 +58,8 @@ const REVEAL_WORDS: Record<RevealOutcome['outcome'], string> = {
   failed: 'Something went wrong. Try again.',
 };
 const WAIT = 'That did not confirm it. Wait a moment before trying again.';
-const UNREADABLE = "This wallet's stored data could not be read. Reload this page.";
 // The B1b-1 thin sections the plan-2 screens have not replaced yet.
-const SECTIONS = ['import', 'reauth', 'accounts', 'reveal'] as const;
+const SECTIONS = ['import', 'accounts', 'reveal'] as const;
 
 const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
 const say = (text: string): void => {
@@ -114,6 +98,11 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
     else create.start(mode.mode === 'welcome' ? 'welcome' : 'intro');
     return;
   }
+  if (mode.mode === 'reauth') {
+    legacy(null);
+    void mountReauth(deps).show(mode.challengeId);
+    return;
+  }
   if (mode.mode === 'unlock' || mode.mode === 'forgot') {
     legacy(null);
     void mountUnlock(deps).show(mode.mode === 'unlock' ? mode.returnTo : null);
@@ -121,7 +110,6 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
   }
   legacy(mode.mode);
   if (mode.mode === 'import') startImport();
-  if (mode.mode === 'reauth') startReauth(mode.challengeId);
   if (mode.mode === 'accounts') startAccounts();
   if (mode.mode === 'reveal') startReveal();
 }
@@ -169,42 +157,6 @@ function startImport(): void {
   $('choose-cli').addEventListener('click', () => void runExclusive(gate, () => finish('cli')));
 }
 
-// Deferred to B1b-2 (stated): this page does not show WHICH action the challenge is for — the
-// background holds only its digest; B1b-2's screen asks the background for a description.
-function startReauth(challengeId: string): void {
-  const backoff = createWrongBackoff(sleep);
-  $('reauth-form').addEventListener('submit', e => {
-    e.preventDefault();
-    void runExclusive(gate, async () => {
-      const pw = $<HTMLInputElement>('reauth-password');
-      const password = pw.value;
-      pw.value = '';
-      say('Checking…');
-      const outcome = await backoff.run(() => runReauth({...store, send}, challengeId, {password, kdf: workerKdf}), () => say(WAIT));
-      say(REAUTH_WORDS[outcome]);
-    });
-  });
-  void store.readEnvelope().then(raw => {
-    const pk = (raw as EnvelopeV1 | undefined)?.passkey;
-    if (!pk) return;
-    const button = $<HTMLButtonElement>('reauth-passkey');
-    button.hidden = false;
-    button.addEventListener('click', () => {
-      void runExclusive(gate, async () => {
-        let prfOutput: Uint8Array | null;
-        try {
-          prfOutput = await evaluatePrf(navigator.credentials, unb64(pk.credentialId), unb64(pk.prfSalt));
-        } catch {
-          prfOutput = null;
-        }
-        if (prfOutput === null) return say(REAUTH_WORDS.unavailable);
-        const factor = {prfOutput};
-        say(REAUTH_WORDS[await backoff.run(() => runReauth({...store, send}, challengeId, factor), () => say(WAIT))]);
-      });
-    });
-  }, () => say(UNREADABLE));
-}
-
 function startAccounts(): void {
   const backoff = createWrongBackoff(sleep);
   const factor = () => {
```

Create `extension/src/unlock/screens/reauth.ts`:

```ts
import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import {discardPrepared, readChallenge, type Description} from '../challenge';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, resumeTarget, type PageDeps} from '../page';
import {runReauth, type ReauthPageOutcome} from '../reauthFlow';
import {storedVault} from '../stored';
import {COMMON, REAUTH} from '../strings';
import {byId, h, setText, showScreen, shown} from '../view/dom';
import {startCooldown} from '../view/cooldown';
import {addressGroups} from '../view/words';

type View = 'loading' | 'entry' | 'notice';

/**
 * #10 unlock-send — re-authentication (spec §3.10, E3, D38, D39). The challenge id comes from the URL;
 * what it is for comes ONLY from vault.challengeInfo, re-validated by challenge.ts before any text is
 * built. A description that fails is "The details of this action could not be shown." with only
 * [Cancel send]. After a proven factor the send is NOT executed (D38): the same tab goes to the UI tab's
 * resume route, where #20 shows a fresh preview and one tap sends. [Cancel send] discards the prepared
 * send (E7) first, then says "Send cancelled. Nothing was sent." and closes the tab — also from the
 * `undescribable` state, with the one field it re-validated by itself (the account). When even that is
 * not an address, the button is [Close] and the line says only what is true: nothing was sent here
 * (plan review H1). In every other notice state the top bar's X closes the tab and claims nothing (L4).
 * A `vault.reauthOk` answered `unknown-challenge` is `expired`, never `failed` (D39).
 */
export function mountReauth(deps: PageDeps): {show(challengeId: string): Promise<void>} {
  const field = byId<HTMLInputElement>('ra-password');
  const confirm = byId<HTMLButtonElement>('ra-confirm');
  const passkey = byId<HTMLButtonElement>('ra-passkey');
  const cancel = byId<HTMLButtonElement>('ra-cancel');
  const backoff = createWrongBackoff(deps.sleep);
  let challengeId = '';
  let described: Description | null = null;
  /** `undescribable` only: the send's account, valid by itself — what [Cancel send] discards. */
  let orphan: string | null = null;
  /** `undescribable` with no valid account: the button only closes the tab. */
  let closeOnly = false;
  let pk: {credentialId: string; prfSalt: string} | null = null;
  let view: View = 'loading';
  let canCancel = false;
  let stopCooldown: (() => void) | null = null;

  const render = () => {
    const busy = deps.gate.isBusy();
    const cooling = stopCooldown !== null;
    shown(byId('ra-loading'), view === 'loading');
    shown(byId('ra-intent'), described !== null && view !== 'notice');
    shown(byId('ra-entry'), view === 'entry' && !cooling);
    shown(byId('ra-cooldown'), cooling);
    shown(confirm, view === 'entry' && !cooling);
    shown(byId('ra-paused'), cooling);
    shown(passkey, view === 'entry' && !cooling && pk !== null);
    shown(cancel, canCancel);
    field.disabled = busy;
    confirm.disabled = busy;
    passkey.disabled = busy;
    cancel.disabled = busy;
    const x = byId<HTMLButtonElement>('ra-x');
    x.disabled = busy || !(canCancel || view === 'notice');
    x.setAttribute('aria-label', canCancel && !closeOnly ? REAUTH.cancel : REAUTH.close);
  };
  const helper = (text: string, error: boolean) => {
    setText(byId('ra-helper'), text);
    byId('ra-helper').classList.toggle('error', error);
    field.classList.toggle('is-error', error);
  };
  const failed = () => (view === 'notice' ? setText(byId('ra-notice-help'), COMMON.failedTryAgain) : helper(COMMON.failedTryAgain, false));
  const notice = (line: string, o: {help?: string; cancel?: boolean; unlock?: boolean} = {}) => {
    view = 'notice';
    canCancel = o.cancel === true;
    setText(byId('ra-notice-line'), line);
    setText(byId('ra-notice-help'), o.help ?? '');
    shown(byId('ra-notice'), true);
    shown(byId('ra-unlock'), o.unlock === true);
    render();
  };
  const row = (label: string, value: Node | string | null) => {
    const r = h('div', 'intent-row');
    r.append(h('span', 'label noc-body-sm', label));
    if (value !== null) {
      const v = h('span', 'value noc-body-sm noc-numeral');
      v.append(value);
      r.append(v);
    }
    return r;
  };
  const describe = (d: Description) => {
    if (d.kind === 'send') {
      setText(byId('ra-about'), REAUTH.aboutSend);
      setText(byId('ra-amount'), d.amount);
      setText(byId('ra-symbol'), d.symbol);
      shown(byId('ra-amount-row'), true);
      byId('ra-rows').replaceChildren(row(REAUTH.to, addressGroups(d.recipient)), ...d.fees.map(f => row(f.label, f.value)));
      byId('ra-reasons').replaceChildren(...d.reasons.map(r => h('p', 'noc-body-sm vlt-lede', r)));
      setText(cancel, REAUTH.cancelSend);
    } else {
      setText(byId('ra-about'), REAUTH.aboutChange);
      shown(byId('ra-amount-row'), false);
      byId('ra-rows').replaceChildren(...d.lines.map(l => row(l, null)));
      byId('ra-reasons').replaceChildren();
      setText(cancel, REAUTH.cancel);
    }
  };
  const cooldown = (ms: number) => {
    field.value = '';
    stopCooldown = startCooldown(deps.timers, ms, {timer: byId('ra-timer'), label: byId('ra-cooldown-label'), ring: byId('ra-ring')});
    render();
  };
  const settle = (out: ReauthPageOutcome | 'unavailable') => {
    stopCooldown?.();
    stopCooldown = null;
    field.value = '';
    if (out === 'confirmed') {
      helper('', false);
      if (described?.kind === 'send') {
        const target = resumeTarget(described.account);
        if (target !== null) return deps.go(target);
      }
      return notice(REAUTH.settingsConfirmed);
    }
    if (out === 'wrong') return helper(COMMON.wrongConfirm, true);
    if (out === 'unavailable') return helper(COMMON.passkeyUnavailableConfirm, false);
    if (out === 'failed') return helper(COMMON.failedTryAgain, false);
    if (out === 'expired') return notice(REAUTH.expired);
    if (out === 'not-unlocked') return notice(REAUTH.notUnlocked, {unlock: true});
    if (out === 'mismatch-locked') return notice(COMMON.mismatchLocked);
    if (out === 'damaged') return notice(COMMON.damaged, {help: COMMON.damagedHelp});
    return notice(COMMON.noWallet);
  };

  const prove = (factor: 'password' | 'passkey') =>
    void exclusive(deps, render, async () => {
      if (view !== 'entry') return;
      const key = pk;
      if (factor === 'passkey') {
        if (key === null) return;
        let prfOutput: Uint8Array | null;
        try {
          prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
        } catch {
          prfOutput = null;
        }
        if (prfOutput === null) return settle('unavailable');
        const proof = {prfOutput};
        helper(REAUTH.checking, false);
        return settle(await backoff.run(() => runReauth({readEnvelope: deps.store.readEnvelope, send: deps.send}, challengeId, proof), cooldown));
      }
      const password = field.value;
      helper(REAUTH.checking, false);
      settle(await backoff.run(() => runReauth({readEnvelope: deps.store.readEnvelope, send: deps.send}, challengeId, {password, kdf: deps.kdf}), cooldown));
    });
  const doCancel = () =>
    void exclusive(deps, render, async () => {
      if (!canCancel) return;
      if (described?.kind === 'settings' || closeOnly) return deps.closeTab();
      // E7: nothing of this send may outlive the cancel — its prepared send and its challenge go.
      const account = described?.kind === 'send' ? described.account : orphan;
      if (account === null || !(await discardPrepared(deps.send, account))) return failed();
      described = null;
      orphan = null;
      notice(REAUTH.cancelled);
      deps.closeTab();
    });
  /** The top bar's X: Cancel while there is something to cancel; in any other notice, only a close (L4). */
  const doX = () => {
    if (canCancel) return doCancel();
    if (view === 'notice' && !deps.gate.isBusy()) deps.closeTab();
  };

  deps.gate.onIdle(render);
  byId('ra-form').addEventListener('submit', e => {
    e.preventDefault();
    prove('password');
  });
  confirm.addEventListener('click', () => prove('password'));
  passkey.addEventListener('click', () => prove('passkey'));
  cancel.addEventListener('click', doCancel);
  byId('ra-x').addEventListener('click', doX);
  byId('ra-unlock').addEventListener('click', () => deps.go('unlock.html?mode=unlock'));

  return {
    async show(id) {
      challengeId = id;
      view = 'loading';
      showScreen('v-reauth');
      render();
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        return notice(COMMON.unreadable);
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') return notice(COMMON.noWallet);
      if (stored.kind === 'damaged') return notice(COMMON.damaged, {help: COMMON.damagedHelp});
      pk = stored.env.passkey ?? null;
      const read = await readChallenge(deps.send, id);
      if (read.state !== 'described') {
        if (read.state !== 'undescribable') return read.state === 'expired' ? notice(REAUTH.expired) : notice(REAUTH.notUnlocked, {unlock: true});
        // Fail closed: what cannot be described is never offered for confirmation — only Cancel, which
        // discards the send by its own re-validated account; without one, only Close (plan review H1).
        orphan = read.account;
        closeOnly = orphan === null;
        setText(cancel, closeOnly ? REAUTH.close : REAUTH.cancelSend);
        return notice(REAUTH.undescribable, {cancel: true, help: closeOnly ? REAUTH.nothingSent : ''});
      }
      described = read.description;
      describe(read.description);
      view = 'entry';
      canCancel = true;
      render();
      field.focus();
    },
  };
}
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 2aeee3c..7ba60b6 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -122,6 +122,16 @@ export const REAUTH = {
   checking: 'Checking…',
   cancelled: 'Send cancelled. Nothing was sent.',
   settingsConfirmed: 'Confirmed. You can close this tab.',
+  aboutSend: 'You are about to send',
+  aboutChange: 'You are about to change',
+  to: 'To',
+  cancelSend: 'Cancel send',
+  /** Controller addition — confirmed by the owner 2026-10-01 (plan review H1): #10 could not tell which send to drop. */
+  close: 'Close',
+  /** Controller addition — confirmed by the owner 2026-10-01 (plan review H1): no "cancelled" the page cannot vouch for. */
+  nothingSent: 'Nothing was sent. Start the send again from the Noctura icon.',
+  /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): a settings confirmation (B1b-2b) is not a send. */
+  cancel: 'Cancel',
   networkFee: 'Network fee',
   nocturaFee: 'Noctura fee',
   newTokenAccount: 'New token account',
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 829bec7..6773e67 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -289,3 +289,21 @@
 .vlt-col .cooldown-card .ring {
   background: conic-gradient(var(--warning) calc(var(--vlt-ring, 1) * 100%), var(--bg-surface-3) 0);
 }
+
+/* #10: the mockup's inline layout — an empty slot opposite the X, the amount and its symbol on one
+   baseline, the password head pulled up under the intent card. */
+.vlt-bar-spacer {
+  width: var(--touch-target-min);
+}
+.vlt-amount {
+  display: flex;
+  align-items: baseline;
+  gap: var(--space-2);
+  margin-bottom: var(--space-3);
+}
+.vlt-pin-head-tight {
+  padding-top: 0;
+}
+.vlt-col .s-pin .intent-row .value .addr-groups {
+  justify-content: flex-end;
+}
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index f88da9e..455ee1f 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -106,15 +106,6 @@
           <button id="choose-cli" type="button">Solana CLI (solana-keygen)</button>
         </div>
       </section>
-      <section id="reauth" hidden>
-        <h1>Confirm it is you</h1>
-        <form id="reauth-form">
-          <label for="reauth-password">Password</label>
-          <input id="reauth-password" type="password" autocomplete="current-password" minlength="12" required />
-          <button id="reauth-btn" type="submit">Confirm</button>
-        </form>
-        <button id="reauth-passkey" type="button" hidden>Confirm with passkey</button>
-      </section>
       <section id="accounts" hidden>
         <h1>Accounts</h1>
         <label for="acc-password">Password</label>
@@ -366,6 +357,58 @@
         </div>
       </section>
 
+      <!-- #10 unlock-send (spec §3.10, E3, D38, D39): the action comes from vault.challengeInfo, never the URL. -->
+      <section id="v-reauth" class="screen s-pin" hidden>
+        <div class="top-bar">
+          <button id="ra-x" type="button" class="icon-btn" aria-label="Cancel"><svg width="22" height="22" aria-hidden="true"><use href="#i-x" /></svg></button>
+          <span class="title noc-overline vlt-muted">Confirm with password</span>
+          <span class="vlt-bar-spacer"></span>
+        </div>
+        <p id="ra-loading" class="noc-body vlt-center vlt-pad" role="status">Reading the details…</p>
+        <div id="ra-intent" class="intent-card" hidden>
+          <div id="ra-about" class="noc-overline vlt-muted vlt-gap-2"></div>
+          <div id="ra-amount-row" class="vlt-amount">
+            <span id="ra-amount" class="noc-balance-lg noc-numeral"></span>
+            <span id="ra-symbol" class="noc-body-lg vlt-lede"></span>
+          </div>
+          <div id="ra-rows"></div>
+        </div>
+        <div id="ra-entry" hidden>
+          <div class="pin-head vlt-pin-head-tight">
+            <h2 class="noc-h2 vlt-gap-2">Enter your password</h2>
+            <div id="ra-reasons"></div>
+            <form id="ra-form" class="vlt-field-row">
+              <input id="ra-password" class="vlt-input" type="password" autocomplete="current-password" aria-label="Password" />
+            </form>
+          </div>
+          <p id="ra-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        </div>
+        <div id="ra-cooldown" hidden>
+          <div class="vlt-pad-cooldown">
+            <h1 class="noc-h1 vlt-center vlt-gap-2">Wait a moment</h1>
+            <p class="noc-body vlt-lede vlt-center vlt-narrow-300 vlt-gap-5">That did not confirm it. Wait a moment before trying again.</p>
+          </div>
+          <div class="cooldown-card">
+            <div id="ra-ring" class="ring"></div>
+            <div id="ra-timer" class="timer noc-numeral" aria-live="polite" aria-atomic="true"></div>
+            <div id="ra-cooldown-label" class="noc-body-sm label"></div>
+          </div>
+        </div>
+        <div id="ra-notice" class="vlt-notice" role="status" hidden>
+          <p id="ra-notice-line" class="noc-body"></p>
+          <p id="ra-notice-help" class="noc-body-sm vlt-lede"></p>
+        </div>
+        <div class="pin-spacer"></div>
+        <button id="ra-cancel" type="button" class="btn btn-tertiary forgot-link" hidden></button>
+        <div class="sticky-bar">
+          <button id="ra-confirm" type="button" class="btn btn-primary" hidden>Confirm</button>
+          <!-- "Confirm paused": controller addition — confirmed by the owner 2026-10-01 (mirrors #9's "Unlock paused"). -->
+          <button id="ra-paused" type="button" class="btn btn-secondary" disabled hidden>Confirm paused</button>
+          <button id="ra-passkey" type="button" class="btn btn-secondary" hidden>Confirm with passkey</button>
+          <button id="ra-unlock" type="button" class="btn btn-primary" hidden>Unlock</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/reauthScreen.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 94 passed (94) Tests 1196 passed (1196).

- [ ] **Step 5: The E2E that re-authenticated through the old markup.**

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
index 10efa63..adcef1c 100644
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -59,14 +59,18 @@ async function pendingRecord(page: Page, signature: string): Promise<PendingView
 }
 const pendingState = async (page: Page, signature: string): Promise<string | undefined> => (await pendingRecord(page, signature))?.state;
 
-/** Re-authenticate a challenge through the real vault page in reauth mode. */
-async function reauthenticate(ctx: BrowserContext, id: string, challengeId: string, password: string): Promise<void> {
+/**
+ * Re-authenticate a challenge through the real vault page (#10). After the proof the same tab hands
+ * over to the UI tab's resume route (D38) — nothing is sent from the vault page.
+ */
+async function reauthenticate(ctx: BrowserContext, id: string, challengeId: string, password: string, account: string): Promise<void> {
   const vault = await ctx.newPage();
   try {
     await vault.goto(`chrome-extension://${id}/unlock.html?mode=reauth&challenge=${challengeId}`);
-    await vault.fill('#reauth-password', password);
-    await vault.click('#reauth-btn');
-    await expect(vault.locator('#status')).toHaveText('Confirmed. You can close this tab.', {timeout: 60_000});
+    await expect(vault.locator('#ra-about')).toHaveText('You are about to send');
+    await vault.fill('#ra-password', password);
+    await vault.click('#ra-confirm');
+    await vault.waitForURL(`chrome-extension://${id}/wallet.html#/send/resume?account=${account}`, {timeout: 60_000});
   } finally {
     await vault.close();
   }
@@ -126,7 +130,9 @@ test('create a wallet, unlock it, re-authenticate a first send, send SOL: pendin
     expect(await msg(popup, {type: 'wallet.send', id: view.id})).toEqual({ok: false, error: 'reauth-required', data: {challengeId}});
     expect(fake.broadcasts).toEqual([]);
 
-    await reauthenticate(ctx, id, challengeId, NEW_PASSWORD);
+    await reauthenticate(ctx, id, challengeId, NEW_PASSWORD, account);
+    // The vault page broadcast nothing: the send waits for a tap (D38).
+    expect(fake.broadcasts).toEqual([]);
 
     // A popup reopened after the re-authentication finds the prepared send and its challenge.
     expect(await msg(popup, {type: 'wallet.preparedFor', account})).toMatchObject({ok: true, data: {intent, reauth: {challengeId}}});
```

Run: `npm run build && npx playwright test e2e/wallet.spec.ts`
Expected: 2 passed — #10 hands over to `wallet.html#/send/resume?account=…` and nothing is broadcast until the spec sends.

- [ ] **Step 6: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- an undescribable action offered for confirmation → RED Tests  3 failed | 13 passed (16)
- cancel without the discard (E7) → RED Tests  4 failed | 12 passed (16)
- an undescribable send said cancelled without its discard (H1) → RED Tests  1 failed | 15 passed (16)
- the X stays disabled in a notice with nothing to cancel (L4) → RED Tests  1 failed | 15 passed (16)

- [ ] **Step 7: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `10-idle`, `10-error`, `10-cooldown`, `10-expired`, `10-undescribable`, `10-cancelled`, `10-not-unlocked`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/e2e/wallet.spec.ts extension/src/unlock/__tests__/reauthScreen.test.ts extension/src/unlock/modes.ts extension/src/unlock/screens/reauth.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/unlock.html
git commit -m "feat(extension): #10 unlock-send — the closed-alphabet description, every state, Cancel discards (E7), the resume hand-over (D38)" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 12: #39 forgot password, and #8’s restore path on E5 (seed proof, replacement, `send-open`, `busy`, `unlocked`)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/src/unlock/__tests__/create.test.ts`
- Modify: `extension/src/unlock/__tests__/pageHarness.ts`
- Create: `extension/src/unlock/__tests__/restore.test.ts`
- Modify: `extension/src/unlock/modes.ts`
- Modify: `extension/src/unlock/screens/createRun.ts`
- Create: `extension/src/unlock/screens/forgot.ts`
- Modify: `extension/src/unlock/screens/importRun.ts`
- Modify: `extension/src/unlock/screens/importScreen.ts`
- Modify: `extension/src/unlock/screens/password.ts`
- Create: `extension/src/unlock/screens/restoreRun.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 8, 9, 10.
- Produces: `src/unlock/screens/forgot.ts`: `mountForgot(deps: Pick<PageDeps, 'go'>): {show(): void}`; `src/unlock/screens/restoreRun.ts`: `createRestoreRun(deps, o: {password: PasswordScreen}): {show(): Promise<void>}`; `ImportScreen.notice(line, help, action: {label; run()} | null)`; `PasswordRun.finish(password): Promise<{line: string; then: 'retype' | 'retry' | 'stop'} | null>`; `strings.ts`: `FORGOT`, `RESTORE`, `PASSWORD.continue`, `PASSWORD.tryAgain`, `PASSWORD.newPasswordToRetry`; `pageHarness.ts`: `inner` throws `forgetWallet without replacement or guard`

Spec §3.11 and §3.8's restore path (D35, D40, E5). #39: all three cards visible, the highlighted one moving 1 → 2 → 3 with each step's copy (Scope 10), walked in order so the step-2 warning is always seen (review L1); `[Continue to import]` → `?mode=import&source=forgot`; `[Cancel]` and back from step 1 → #9. The restore run: the stored vault read first (none → "No wallet on this browser yet." + `[Set up a wallet]`; damaged → the damaged lines); #8 → `checking-match` ("Checking this phrase against the wallet in this browser…", local, no network) → the seed proof (Task 2): `not-this-wallet` replaces the field with the two lines and `[Try another phrase]`, nothing sent; a match → #5 "Recovery" / "Restore · 2 / 2" (no scheme choice) → `restoreWallet`: `restored` → `wallet.html#/imported`; `send-open` → its line on #5 and `[Try again]` with the password **kept in page memory** (#5's new `retry` step); `busy` / `unlocked` (carry 4: "The wallet was unlocked while this was running, so nothing was deleted. Start again.", controller addition) → #8 with the line and `[Start again]` → #39. #5's `finish` answer becomes `then: 'retype' | 'retry' | 'stop'`; `ImportScreen` gains `notice()`. A hidden tab drops the password a `[Try again]` was holding — §3.5's rule wins over E5's "kept while this page stays open" — and #5 then reads "Enter a new password to try again." (controller addition — confirmed by the owner 2026-10-01; plan-2 review L5). Back from #5 returns to #8 with the phrase in the field, as the plain import does (L3). The seed proof (it holds the phrase) lives from the match to the run's end, a hidden tab included (Scope 19). The page harness now refuses any `vault.forgetWallet` with neither `replacement` nor `guard: 'unfunded'`, so every screen test enforces E5's rule at the boundary — not only the source grep (plan-2 review M5). The spec's E5 step-5 note and §3.8 restore list get the `unlocked` line (Step 5).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/unlock/__tests__/create.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/create.test.ts b/extension/src/unlock/__tests__/create.test.ts
index 6371b5e..bd7c0df 100644
--- a/extension/src/unlock/__tests__/create.test.ts
+++ b/extension/src/unlock/__tests__/create.test.ts
@@ -120,7 +120,7 @@ describe('#4 seed-confirm: the screen', () => {
 });
 
 describe('#5 create password (D7)', () => {
-  async function shown(finish: (pw: string) => Promise<{line: string; stop: boolean} | null> = async () => null, o: {holdSleep?: boolean} = {}) {
+  async function shown(finish: (pw: string) => Promise<{line: string; then: 'retype' | 'retry' | 'stop'} | null> = async () => null, o: {holdSleep?: boolean} = {}) {
     const h = await harness(o);
     const finished: string[] = [];
     const backs: number[] = [];
@@ -210,7 +210,7 @@ describe('#5 create password (D7)', () => {
   });
 
   it('a refusal shows its line; "exists" stops with no CTA', async () => {
-    const {h, field, cta} = await shown(async () => ({line: 'A wallet already exists in this browser. Nothing was changed.', stop: true}));
+    const {h, field, cta} = await shown(async () => ({line: 'A wallet already exists in this browser. Nothing was changed.', then: 'stop'}));
     type(field, PW);
     click(cta);
     await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
```

Modify `extension/src/unlock/__tests__/pageHarness.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/pageHarness.ts b/extension/src/unlock/__tests__/pageHarness.ts
index 0c70f47..e0e248f 100644
--- a/extension/src/unlock/__tests__/pageHarness.ts
+++ b/extension/src/unlock/__tests__/pageHarness.ts
@@ -59,6 +59,10 @@ export async function harness(
   const wallet = fakeDeps({reader: fakeReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => [], ...o.reader})});
   const sent: Harness['sent'] = [];
   const inner: Send = async m => {
+    // E5's boundary, enforced under every screen test (plan review M5): the page never sends a bare
+    // delete — every vault.forgetWallet carries a `replacement` (the seed proof) or the unfunded guard.
+    const f = m as {type?: unknown; replacement?: unknown; guard?: unknown};
+    if (f.type === 'vault.forgetWallet' && f.replacement === undefined && f.guard !== 'unfunded') throw new Error('forgetWallet without replacement or guard');
     sent.push(JSON.parse(JSON.stringify(m)) as {type: string});
     return (await handleMessage(ext, JSON.parse(JSON.stringify(m)), UNLOCK_SENDER, wallet)) as {ok: boolean; error?: string; data?: unknown};
   };
```

Create `extension/src/unlock/__tests__/restore.test.ts`:

```ts
// @vitest-environment happy-dom
import {createEnvelope, decryptMnemonic, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {derivePublicKeys} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {PENDING_KEY} from '../../background/pendingStore';
import {getSession} from '../../background/session';
import {pendingRecord} from '../../background/__tests__/fixtures';
import {mountForgot} from '../screens/forgot';
import {createRestoreRun} from '../screens/restoreRun';
import {mountPassword} from '../screens/password';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const OLD_PW = 'correct horse battery';
const NEW_PW = 'a brand new long password';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

beforeEach(loadPage);

describe('#39 forgot password (spec §3.11)', () => {
  const cards = () => [1, 2, 3].map(n => el(`fg-card-${n}`));
  it('step 1: the adapted copy, card 1 highlighted, the footer; [Restore from seed] → step 2 (review L1), not #8', () => {
    const went: string[] = [];
    mountForgot({go: t => void went.push(t)}).show();
    const screen = el('v-forgot');
    expect(text(screen.querySelector('.top-bar .title'))).toBe('Recovery');
    expect(text(el('fg-step'))).toBe('1 / 3');
    expect(text(el('fg-title'))).toBe('Forgot your password?');
    expect(text(el('fg-lede'))).toBe('Your recovery phrase is the only way back. Three steps to restore.');
    expect(cards().map(c => [c.className, text(c)])).toEqual([
      ['s8-step-card vlt-gap-3b active', "1 Recover from seed phrase You'll need the 12 or 24 words you wrote down during setup. Make sure you have them on paper or steel — not on this computer. If you don't have your seed, your funds cannot be recovered. That's the security tradeoff of self-custody."],
      ['s8-step-card vlt-gap-3b', "2 Enter your words You'll be taken to the import screen. Type or paste your words."],
      ['s8-step-card', "3 Set a new password Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working."],
    ]);
    expect(text(el('fg-foot'))).toBe('The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.');
    expect(visible(el('fg-warn'))).toBe(false);
    expect(text(el('fg-next'))).toBe('Restore from seed');
    expect(text(screen)).not.toMatch(/PIN|FLAG_SECURE|Your 24-word|address-book/);
    expect(unstyled('v-forgot')).toEqual([]);
    click(el('fg-next'));
    expect(went).toEqual([]);
    expect(text(el('fg-step'))).toBe('2 / 3');
  });

  it('step 2: card 1 done, card 2 highlighted, the warning card (no address book in B1b-2a); step 3: [Continue to import] → #8 restore', () => {
    const went: string[] = [];
    mountForgot({go: t => void went.push(t)}).show();
    click(el('fg-next'));
    expect(text(el('fg-title'))).toBe('Enter your words');
    expect(text(el('fg-lede'))).toBe('Type or paste the 12 or 24 words, in order.');
    expect(cards().map(c => c.className)).toEqual(['s8-step-card vlt-gap-3b vlt-done', 's8-step-card vlt-gap-3b active', 's8-step-card']);
    expect(text(el('fg-card-1-body'))).toBe('Done — you confirmed you have your words.');
    expect(text(el('fg-card-3-body'))).toBe('After your phrase is verified.');
    expect(text(el('fg-warn'))).toBe('One warning before you proceed Restoring from seed replaces the wallet in this browser — including any unconfirmed transactions. Your funds on Solana are unaffected.');
    expect(text(el('fg-next'))).toBe('Continue');
    expect(unstyled('v-forgot')).toEqual([]);
    click(el('fg-next'));
    expect(text(el('fg-step'))).toBe('3 / 3');
    expect(text(el('fg-title'))).toBe('Set a new password');
    expect(text(el('fg-lede'))).toBe("Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working.");
    expect(text(el('fg-card-2-body'))).toBe('Done — seed verified against your existing public key.');
    expect(text(el('fg-card-3-body'))).toBe("You'll choose a new password. The old password stops working. A passkey is not carried over; you can add one again later.");
    expect(visible(el('fg-warn'))).toBe(false);
    expect(text(el('fg-next'))).toBe('Continue to import');
    expect(unstyled('v-forgot')).toEqual([]);
    click(el('fg-next'));
    expect(went).toEqual(['unlock.html?mode=import&source=forgot']);
  });

  it('back walks the steps back, then → #9; [Cancel] → #9', () => {
    const went: string[] = [];
    mountForgot({go: t => void went.push(t)}).show();
    click(el('fg-next'));
    click(el('fg-back'));
    expect(text(el('fg-step'))).toBe('1 / 3');
    click(el('fg-back'));
    click(el('fg-cancel'));
    expect(went).toEqual(['unlock.html?mode=unlock', 'unlock.html?mode=unlock']);
  });
});

/** A two-account SLIP-0010 wallet of M (names kept), stored, with a known recipient. */
async function storedWallet(): Promise<EnvelopeV1> {
  const keys = await derivePublicKeys(M, 'slip10', [0, 1]);
  return createEnvelope({mnemonic: M, password: OLD_PW, scheme: 'slip10', accounts: [{index: 0, name: 'Main', publicKey: keys[0] ?? ''}, {index: 1, name: 'Savings', publicKey: keys[1] ?? ''}], kdf: testKdf});
}

async function restoring(o: {vault?: unknown; send?: (inner: Send) => Send} = {}) {
  const h = await harness({vault: 'vault' in o ? o.vault : await storedWallet(), send: o.send});
  await h.ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
  await createRestoreRun(h.deps, {password: mountPassword(h.deps)}).show();
  return h;
}
async function phrase(h: Harness, words: string) {
  type(el<HTMLTextAreaElement>('imp-phrase'), words);
  click(el('imp-continue'));
  await h.until(() => !h.deps.gate.isBusy() && (visible(el('v-password')) || visible(el('imp-notice'))));
}
async function newPassword(h: Harness) {
  type(el<HTMLInputElement>('pw-field'), NEW_PW);
  click(el('pw-cta'));
  await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
  type(el<HTMLInputElement>('pw-field'), NEW_PW);
  click(el('pw-cta'));
}

describe('#8 restore path (E5 with replacement, D35, D40)', () => {
  it('not-this-wallet: a different valid phrase changes nothing and sends nothing; [Try another phrase] clears the field', async () => {
    const h = await restoring();
    const before = JSON.stringify(await h.ext.local.get(VAULT_KEY));
    await phrase(h, OTHER);
    expect(text(el('imp-notice'))).toBe(
      'This phrase does not belong to the wallet in this browser. Nothing was changed. To replace that wallet without its password, remove Noctura from this browser and install it again.',
    );
    expect(text(el('imp-action'))).toBe('Try another phrase');
    expect(visible(el('imp-field'))).toBe(false);
    expect(unstyled('v-import')).toEqual([]);
    expect(JSON.stringify(await h.ext.local.get(VAULT_KEY))).toBe(before);
    expect(h.sent).toEqual([]);
    click(el('imp-action'));
    expect(visible(el('imp-field'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
  });

  it('the right phrase → #5 "Restore · 2 / 2" (no scheme choice) → the same wallet under the new password, names and recipients kept → #/imported', async () => {
    const h = await restoring();
    expect(text(el('imp-line'))).toBe('');
    type(el<HTMLTextAreaElement>('imp-phrase'), M);
    click(el('imp-continue'));
    expect(text(el('imp-line'))).toBe('Checking this phrase against the wallet in this browser…');
    await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
    expect([text(el('pw-eyebrow')), text(el('pw-step'))]).toEqual(['Recovery', 'Restore · 2 / 2']);
    expect(visible(el('imp-choose'))).toBe(false);
    await newPassword(h);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(env.accounts.map(a => a.name)).toEqual(['Main', 'Savings']);
    expect(await decryptMnemonic(env, await unlockWithPassword(env, NEW_PW, testKdf))).toBe(M);
    await expect(unlockWithPassword(env, OLD_PW, testKdf)).rejects.toThrow();
    expect((await getSession(h.ext))?.map(a => a.index)).toEqual([0, 1]);
    expect(await h.ext.local.get(KNOWN_RECIPIENTS_KEY)).toEqual([{address: RECIPIENT, at: 1}]);
  }, 30_000);

  it('a send still pending: the line and [Try again] with the password kept; once it closes, Try again restores', async () => {
    const h = await restoring();
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    const before = JSON.stringify(await h.ext.local.get(VAULT_KEY));
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => text(el('pw-helper')) !== '' && !h.deps.gate.isBusy());
    expect(text(el('pw-helper'))).toBe('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.');
    expect(text(el('pw-cta'))).toBe('Try again');
    expect(visible(el('pw-form'))).toBe(false);
    expect(unstyled('v-password')).toEqual([]);
    // Refused before the vault write: the stored wallet is byte-identical.
    expect(JSON.stringify(await h.ext.local.get(VAULT_KEY))).toBe(before);
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'expired'})]);
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
  }, 30_000);

  // L5 (plan review): §3.5's hidden-tab rule wins — the held password goes, and the helper says what is next.
  it('a tab hidden behind [Try again] drops the held password: "Enter a new password to try again."; a new one restores', async () => {
    const h = await restoring();
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'pending'})]);
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => text(el('pw-cta')) === 'Try again' && !h.deps.gate.isBusy());
    h.leave();
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    expect(text(el('pw-cta'))).toBe('Continue');
    expect(visible(el('pw-form'))).toBe(true);
    expect(el<HTMLInputElement>('pw-field').value).toBe('');
    await h.ext.local.set(PENDING_KEY, [pendingRecord({state: 'expired'})]);
    await newPassword(h);
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(await decryptMnemonic(env, await unlockWithPassword(env, NEW_PW, testKdf))).toBe(M);
  }, 30_000);

  it('back from #5 returns to #8 with the phrase in the field, as the plain import does (L3)', async () => {
    const h = await restoring();
    await phrase(h, M);
    click(el('pw-back'));
    expect(visible(el('v-import'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe(M);
  });

  // M5 (plan review): the harness itself refuses a bare delete, so every screen test enforces E5's rule.
  it('the page harness refuses a vault.forgetWallet with neither replacement nor guard (positive control)', async () => {
    const h = await restoring();
    await expect(h.deps.send({type: 'vault.forgetWallet', expectedRevision: 'r'})).rejects.toThrow('forgetWallet without replacement or guard');
    await expect(h.deps.send({type: 'vault.forgetWallet', expectedRevision: 'r', guard: 'none'})).rejects.toThrow('forgetWallet without replacement or guard');
    expect(h.sent).toEqual([]);
  });

  it.each([
    ['busy', 'The wallet changed while you were typing. Start again.'],
    // Carry 4 (controller addition — confirmed by the owner 2026-10-01): an unlock landed mid-forget — the wallet is NOT locked, so not the busy line.
    ['unlocked', 'The wallet was unlocked while this was running, so nothing was deleted. Start again.'],
  ])('%s: back to #8 with "%s" and [Start again] → #39', async (error, line) => {
    const h = await restoring({send: inner => async m => ((m as {type: string}).type === 'vault.forgetWallet' ? {ok: false, error} : inner(m))});
    await phrase(h, M);
    await newPassword(h);
    await h.until(() => visible(el('imp-notice')));
    expect(text(el('imp-notice-line'))).toBe(line);
    expect(text(el('imp-action'))).toBe('Start again');
    click(el('imp-action'));
    expect(h.went).toEqual(['unlock.html?mode=forgot']);
  }, 30_000);

  it('no wallet, and a damaged one, are said before any phrase is typed', async () => {
    const none = await restoring({vault: undefined});
    expect(text(el('imp-notice-line'))).toBe('No wallet on this browser yet.');
    expect(text(el('imp-action'))).toBe('Set up a wallet');
    click(el('imp-action'));
    expect(none.went).toEqual(['unlock.html?mode=welcome']);
    loadPage();
    await restoring({vault: null});
    expect(text(el('imp-notice'))).toBe("This wallet's stored data is damaged. Your funds stay on Solana; your recovery phrase still controls them. To use them here, remove Noctura from this browser, install it again and import the phrase.");
    expect(visible(el('imp-action'))).toBe(false);
  });

  it('back from #8 goes to #39', async () => {
    const h = await restoring();
    click(el('imp-back'));
    expect(h.went).toEqual(['unlock.html?mode=forgot']);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/create.test.ts src/unlock/__tests__/pageHarness.ts src/unlock/__tests__/restore.test.ts`
Expected (dry run): FAIL — Test Files 2 failed (2) Tests 1 failed | 15 passed (16) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 6b9d746..1be5310 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -9,7 +9,9 @@ import type {PageDeps} from './page';
 import {createCreateRun} from './screens/createRun';
 import {createImportRun} from './screens/importRun';
 import {mountPassword} from './screens/password';
+import {mountForgot} from './screens/forgot';
 import {mountReauth} from './screens/reauth';
+import {createRestoreRun} from './screens/restoreRun';
 import {mountUnlock} from './screens/unlock';
 import {workerKdf} from '../vault/kdf';
 import {send} from '../ui/send';
@@ -103,9 +105,19 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
     void mountReauth(deps).show(mode.challengeId);
     return;
   }
-  if (mode.mode === 'unlock' || mode.mode === 'forgot') {
+  if (mode.mode === 'forgot') {
     legacy(null);
-    void mountUnlock(deps).show(mode.mode === 'unlock' ? mode.returnTo : null);
+    mountForgot(deps).show();
+    return;
+  }
+  if (mode.mode === 'import' && mode.source === 'forgot') {
+    legacy(null);
+    void createRestoreRun(deps, {password: mountPassword(deps)}).show();
+    return;
+  }
+  if (mode.mode === 'unlock') {
+    legacy(null);
+    void mountUnlock(deps).show(mode.returnTo);
     return;
   }
   legacy(mode.mode);
```

Modify `extension/src/unlock/screens/createRun.ts`:

```diff
diff --git a/extension/src/unlock/screens/createRun.ts b/extension/src/unlock/screens/createRun.ts
index 291626f..03bc43e 100644
--- a/extension/src/unlock/screens/createRun.ts
+++ b/extension/src/unlock/screens/createRun.ts
@@ -40,7 +40,7 @@ export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; im
       back: () => confirm.show(words()),
       finish: async chosen => {
         const phrase = mnemonic;
-        if (phrase === null) return {line: PASSWORD.failed, stop: true};
+        if (phrase === null) return {line: PASSWORD.failed, then: 'stop'};
         const out = await finishOnboarding({...deps.store, send: deps.send, kdf: deps.kdf}, {mnemonic: phrase, password: chosen, scheme: 'slip10', indexes: [0]});
         if (out === 'created' || out === 'created-locked' || out === 'exists') mnemonic = null;
         if (out === 'created') {
@@ -52,8 +52,8 @@ export function createCreateRun(deps: PageDeps, o: {password: PasswordScreen; im
           deps.go('wallet.html#/created');
           return null;
         }
-        if (out === 'exists') return {line: PASSWORD.exists, stop: true};
-        return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, stop: false};
+        if (out === 'exists') return {line: PASSWORD.exists, then: 'stop'};
+        return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, then: 'retype'};
       },
     });
```

Create `extension/src/unlock/screens/forgot.ts`:

```ts
import type {PageDeps} from '../page';
import {FORGOT} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';

/**
 * #39 forgot-pin → "Forgot password?" (spec §3.11): all three cards visible, the highlighted one moving
 * 1 → 2 → 3, each step's own copy. Walked in order, so the step-2 warning (the wallet is replaced) is
 * always seen before #8 (review L1). [Continue to import] → #8 with `source=forgot`; [Cancel] and the
 * back arrow from step 1 → #9. No secret is on this screen; it reads nothing.
 */
export function mountForgot(deps: Pick<PageDeps, 'go'>): {show(): void} {
  let step: 1 | 2 | 3 = 1;
  const render = () => {
    setText(byId('fg-step'), FORGOT.step(step));
    setText(byId('fg-title'), FORGOT.title[step]);
    setText(byId('fg-lede'), FORGOT.lede[step]);
    setText(byId('fg-card-1-body'), FORGOT.card1[step]);
    setText(byId('fg-card-2-body'), FORGOT.card2[step]);
    setText(byId('fg-card-3-body'), FORGOT.card3[step]);
    shown(byId('fg-card-1-hint'), step === 1);
    for (const n of [1, 2, 3] as const) {
      byId(`fg-card-${n}`).classList.toggle('active', n === step);
      byId(`fg-card-${n}`).classList.toggle('vlt-done', n < step);
    }
    shown(byId('fg-warn'), step === 2);
    shown(byId('fg-foot'), step === 1);
    setText(byId('fg-next-label'), FORGOT.next[step]);
  };
  byId('fg-next').addEventListener('click', () => {
    if (step === 3) return deps.go('unlock.html?mode=import&source=forgot');
    step = step === 1 ? 2 : 3;
    render();
  });
  byId('fg-back').addEventListener('click', () => {
    if (step === 1) return deps.go('unlock.html?mode=unlock');
    step = step === 3 ? 2 : 1;
    render();
  });
  byId('fg-cancel').addEventListener('click', () => deps.go('unlock.html?mode=unlock'));
  return {
    show() {
      step = 1;
      render();
      showScreen('v-forgot');
    },
  };
}
```

Modify `extension/src/unlock/screens/importRun.ts`:

```diff
diff --git a/extension/src/unlock/screens/importRun.ts b/extension/src/unlock/screens/importRun.ts
index 17874d3..f938a26 100644
--- a/extension/src/unlock/screens/importRun.ts
+++ b/extension/src/unlock/screens/importRun.ts
@@ -43,9 +43,9 @@ export function createImportRun(deps: PageDeps, o: {password: PasswordScreen; ba
           }
           if (out === 'exists') {
             phrase = '';
-            return {line: PASSWORD.exists, stop: true};
+            return {line: PASSWORD.exists, then: 'stop'};
           }
-          return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, stop: false};
+          return {line: out === 'weak-password' ? PASSWORD.weak : out === 'invalid-mnemonic' ? PASSWORD.invalid : PASSWORD.failed, then: 'retype'};
         },
       });
     },
```

Modify `extension/src/unlock/screens/importScreen.ts`:

```diff
diff --git a/extension/src/unlock/screens/importScreen.ts b/extension/src/unlock/screens/importScreen.ts
index 2ab6c4f..4703430 100644
--- a/extension/src/unlock/screens/importScreen.ts
+++ b/extension/src/unlock/screens/importScreen.ts
@@ -17,6 +17,8 @@ export interface ImportScreen {
   choose(why: string): Promise<'slip10' | 'cli'>;
   /** Empties the field and its grid. */
   clear(): void;
+  /** A state that replaces the field (a refusal of the restore or retry path), with at most one action. */
+  notice(line: string, help: string, action: {label: string; run(): void} | null): void;
 }
 
 /**
@@ -35,6 +37,8 @@ export function mountImport(deps: PageDeps, handlers: {back(): void; next(phrase
   let idle: number | null = null;
   let pasted = false;
   let choosing: ((s: 'slip10' | 'cli') => void) | null = null;
+  let noticed = false;
+  let action: (() => void) | null = null;
 
   const render = () => {
     const busy = deps.gate.isBusy() || choosing !== null;
@@ -48,6 +52,11 @@ export function mountImport(deps: PageDeps, handlers: {back(): void; next(phrase
     setText(byId('imp-count'), IMPORT.count(words.length, words.length <= 12 ? 12 : 24));
     field.disabled = busy;
     cta.disabled = busy || !valid;
+    shown(byId('imp-field'), !noticed);
+    shown(cta, !noticed);
+    shown(byId('imp-notice'), noticed);
+    shown(byId('imp-action'), noticed && action !== null);
+    byId<HTMLButtonElement>('imp-action').disabled = busy;
   };
   const stopIdle = () => {
     if (idle !== null) deps.timers.clearInterval(idle);
@@ -111,12 +120,15 @@ export function mountImport(deps: PageDeps, handlers: {back(): void; next(phrase
     render();
     done?.(scheme);
   };
+  byId('imp-action').addEventListener('click', () => action?.());
   byId('imp-choose-slip10').addEventListener('click', pick('slip10'));
   byId('imp-choose-cli').addEventListener('click', pick('cli'));
 
   return {
     show(o = {}) {
       stopIdle();
+      noticed = false;
+      action = null;
       field.value = o.phrase ?? '';
       shown(byId('imp-toast'), false);
       shown(byId('imp-choose'), false);
@@ -139,5 +151,16 @@ export function mountImport(deps: PageDeps, handlers: {back(): void; next(phrase
       });
     },
     clear: wipe,
+    notice(line, help, act) {
+      wipe();
+      noticed = true;
+      action = act === null ? null : act.run;
+      setText(byId('imp-notice-line'), line);
+      setText(byId('imp-notice-help'), help);
+      setText(byId('imp-action'), act?.label ?? '');
+      setText(byId('imp-line'), '');
+      shown(byId('imp-line'), false);
+      render();
+    },
   };
 }
```

Modify `extension/src/unlock/screens/password.ts`:

```diff
diff --git a/extension/src/unlock/screens/password.ts b/extension/src/unlock/screens/password.ts
index dbba2e1..6d945ce 100644
--- a/extension/src/unlock/screens/password.ts
+++ b/extension/src/unlock/screens/password.ts
@@ -15,9 +15,11 @@ export interface PasswordRun {
   back(): void;
   /**
    * Stores the wallet with this password (seconds: Argon2id). Returns null when it went on (the caller
-   * moved the page on), or the line to show; `stop` when nothing more can be tried here.
+   * moved the page on), or the line to show and what this screen offers next: `retype` (enter a
+   * password again), `retry` (the same password, kept in this page's memory, behind [Try again]) or
+   * `stop` (nothing more here).
    */
-  finish(password: string): Promise<{line: string; stop: boolean} | null>;
+  finish(password: string): Promise<{line: string; then: 'retype' | 'retry' | 'stop'} | null>;
 }
 
 /**
@@ -35,8 +37,10 @@ export function mountPassword(deps: PageDeps): PasswordScreen {
   const field = byId<HTMLInputElement>('pw-field');
   const cta = byId<HTMLButtonElement>('pw-cta');
   let run: PasswordRun | null = null;
-  let step: 'enter' | 'confirm' | 'creating' | 'stopped' = 'enter';
+  let step: 'enter' | 'confirm' | 'creating' | 'retry' | 'stopped' = 'enter';
   let first = '';
+  /** `retry` only: the password the last finish ran with, for [Try again]. */
+  let held = '';
   let mismatch = false;
   let clearing: number | null = null;
 
@@ -50,10 +54,12 @@ export function mountPassword(deps: PageDeps): PasswordScreen {
     shown(byId('pw-meter-label'), step === 'enter');
     renderMeter(byId('pw-meter'), byId('pw-meter-label'), field.value.length);
     shown(byId('pw-creating'), step === 'creating');
+    shown(byId('pw-form'), step !== 'retry');
     field.disabled = busy || step === 'creating' || step === 'stopped';
     byId<HTMLButtonElement>('pw-back').disabled = busy || step === 'creating';
     shown(cta, step !== 'stopped');
-    cta.disabled = busy || step === 'creating' || (step === 'enter' ? field.value.length < MIN_PASSWORD_LENGTH : field.value.length === 0);
+    setText(cta, step === 'retry' ? PASSWORD.tryAgain : PASSWORD.continue);
+    cta.disabled = busy || step === 'creating' || (step === 'retry' ? false : step === 'enter' ? field.value.length < MIN_PASSWORD_LENGTH : field.value.length === 0);
   };
   const helper = (text: string, error: boolean) => {
     setText(byId('pw-helper'), text);
@@ -63,6 +69,7 @@ export function mountPassword(deps: PageDeps): PasswordScreen {
     if (clearing !== null) deps.timers.clearTimeout(clearing);
     clearing = null;
     first = '';
+    held = '';
     field.value = '';
     field.classList.remove('is-error');
     mismatch = false;
@@ -71,6 +78,14 @@ export function mountPassword(deps: PageDeps): PasswordScreen {
   const submit = () =>
     void exclusive(deps, render, async () => {
       if (run === null || step === 'creating' || step === 'stopped') return;
+      if (step === 'retry') {
+        step = 'creating';
+        helper('', false);
+        render();
+        const out = await run.finish(held);
+        if (out !== null) after(out, held);
+        return;
+      }
       if (step === 'enter') {
         if (field.value.length < MIN_PASSWORD_LENGTH) return;
         first = field.value;
@@ -100,11 +115,14 @@ export function mountPassword(deps: PageDeps): PasswordScreen {
       const password = first;
       first = '';
       const out = await run.finish(password);
-      if (out === null) return;
-      helper(out.line, true);
-      // A refusal that can be retried keeps nothing typed: the confirm step starts again.
-      step = out.stop ? 'stopped' : 'enter';
+      if (out !== null) after(out, password);
     });
+  /** What a refusal leaves: the line, and the next step it allows. */
+  const after = (out: {line: string; then: 'retype' | 'retry' | 'stop'}, password: string) => {
+    helper(out.line, true);
+    held = out.then === 'retry' ? password : '';
+    step = out.then === 'retry' ? 'retry' : out.then === 'stop' ? 'stopped' : 'enter';
+  };
 
   deps.gate.onIdle(render);
   field.addEventListener('input', () => {
@@ -138,11 +156,13 @@ export function mountPassword(deps: PageDeps): PasswordScreen {
     reset();
     run?.back();
   });
-  // Leaving or hiding the tab drops what was typed but not yet used (spec §3.5 memory rule).
+  // Leaving or hiding the tab drops what was typed but not yet used (spec §3.5 memory rule) — and the
+  // password a [Try again] was holding: the rule wins over E5's "kept while this page stays open" (L5).
   deps.onLeave(() => {
-    if (step === 'confirm' || step === 'enter') {
+    if (step === 'confirm' || step === 'enter' || step === 'retry') {
+      if (step === 'retry') helper(PASSWORD.newPasswordToRetry, false);
       reset();
-      if (step === 'confirm') step = 'enter';
+      if (step !== 'enter') step = 'enter';
       render();
     }
   });
```

Create `extension/src/unlock/screens/restoreRun.ts`:

```ts
import {proveSeed, restoreWallet, type SeedProof} from '../forgetFlow';
import type {PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, IMPORT, PASSWORD, RESTORE} from '../strings';
import {mountImport, type ImportScreen} from './importScreen';
import type {PasswordScreen} from './password';

/**
 * #39 → #8 → #5 — the restore (spec §3.8 "Restore path from #39", E5 with `replacement`, D35, D40).
 * The phrase typed on #8 is proven against the stored wallet in this page (the seed proof: every stored
 * account's key, under the stored scheme) — a phrase that does not match changes nothing and sends
 * nothing. On a match there is no scheme choice: #5 "Restore · 2 / 2" takes the new password, and the
 * same wallet, re-encrypted with every stored account and name, replaces the stored one in one
 * message; then the keys. A pending send refuses it (`send-open`): the password stays in this page's
 * memory behind [Try again] until the tab is hidden (§3.5's rule; then "Enter a new password to try
 * again."). The proof — which holds the phrase — lives from the match until the run ends (restored, a
 * notice, Back), a hidden tab included (the hidden-tab rule is the password's), and goes with the page.
 * Back from #5 returns to #8 with the phrase in the field, as the plain import does (plan review L3).
 */
export function createRestoreRun(deps: PageDeps, o: {password: PasswordScreen}): {show(): Promise<void>} {
  const startAgain = {label: RESTORE.startAgain, run: () => deps.go('unlock.html?mode=forgot')};
  const setUp = {label: RESTORE.setUp, run: () => deps.go('unlock.html?mode=welcome')};
  let proof: SeedProof | null = null;

  const back = (s: ImportScreen, line: string, help: string, action: {label: string; run(): void} | null) => {
    proof = null;
    s.show();
    s.notice(line, help, action);
  };
  const restore = async (password: string) => {
    if (proof === null) return {line: COMMON.failedTryAgain, then: 'stop' as const};
    const out = await restoreWallet({send: deps.send, kdf: deps.kdf}, proof, password);
    if (out === 'restored' || out === 'restored-locked') {
      proof = null;
      deps.go('wallet.html#/imported');
      return null;
    }
    if (out === 'weak-password') return {line: PASSWORD.weak, then: 'retype' as const};
    if (out === 'send-open') return {line: RESTORE.sendOpen, then: 'retry' as const};
    // The wallet moved, was unlocked, vanished or is damaged: nothing was deleted; back to #8, which says so.
    const ended = {
      busy: [RESTORE.busy, '', startAgain],
      unlocked: [RESTORE.unlocked, '', startAgain],
      'no-wallet': [COMMON.noWallet, '', setUp],
      damaged: [COMMON.damaged, COMMON.damagedHelp, null],
    } as const;
    if (out in ended) {
      const [line, help, action] = ended[out as keyof typeof ended];
      back(screen, line, help, action);
      return null;
    }
    return {line: COMMON.failedTryAgain, then: 'retry' as const};
  };

  const screen = mountImport(deps, {
    back: () => deps.go('unlock.html?mode=forgot'),
    next: async typed => {
      screen.line(RESTORE.checking);
      const r = await proveSeed(deps.store.readEnvelope, typed);
      if (r.outcome === 'match') {
        proof = r.proof;
        screen.clear();
        const toPhrase = () => {
          const words = proof?.mnemonic ?? '';
          proof = null;
          screen.show({phrase: words});
        };
        o.password.show({eyebrow: PASSWORD.recovery, step: PASSWORD.stepRestore, back: toPhrase, finish: restore});
        return;
      }
      if (r.outcome === 'not-this-wallet') return screen.notice(RESTORE.notThisWallet, RESTORE.notThisWalletHelp, {label: RESTORE.tryAnother, run: () => screen.show()});
      if (r.outcome === 'no-wallet') return screen.notice(COMMON.noWallet, '', setUp);
      if (r.outcome === 'damaged') return screen.notice(COMMON.damaged, COMMON.damagedHelp, null);
      screen.line(r.outcome === 'invalid-mnemonic' ? IMPORT.invalid : COMMON.failedTryAgain);
    },
  });

  return {
    async show() {
      screen.show();
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        return screen.notice(COMMON.unreadable, '', null);
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') screen.notice(COMMON.noWallet, '', setUp);
      else if (stored.kind === 'damaged') screen.notice(COMMON.damaged, COMMON.damagedHelp, null);
    },
  };
}
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 7ba60b6..8b53d85 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -73,6 +73,13 @@ export const PASSWORD = {
   mismatch: "Passwords don't match — try again.",
   show: 'Show password',
   hide: 'Hide password',
+  continue: 'Continue',
+  tryAgain: 'Try again',
+  /**
+   * Controller addition — confirmed by the owner 2026-10-01 (plan review L5): a hidden tab drops the password a
+   * [Try again] was holding (§3.5's rule wins over E5's "kept while this page stays open").
+   */
+  newPasswordToRetry: 'Enter a new password to try again.',
   /** finishOnboarding's outcomes (the B1b-1 strings). */
   exists: 'A wallet already exists in this browser. Nothing was changed.',
   weak: 'The password must be at least 12 characters.',
@@ -91,6 +98,51 @@ export const IMPORT = {
   invalid: 'That is not a valid 12- or 24-word recovery phrase.',
 } as const;
 
+/** #39 forgot-pin → "Forgot password?" (each step's changing copy; the cards' titles are static). */
+export const FORGOT = {
+  step: (n: 1 | 2 | 3): string => `${n} / 3`,
+  title: {1: 'Forgot your password?', 2: 'Enter your words', 3: 'Set a new password'},
+  lede: {
+    1: 'Your recovery phrase is the only way back. Three steps to restore.',
+    /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): the design's "Pick from the BIP-39 wordlist. Type the first 3 letters…" describes a picker #8 does not have. */
+    2: 'Type or paste the 12 or 24 words, in order.',
+    3: "Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working.",
+  },
+  card1: {
+    1: "You'll need the 12 or 24 words you wrote down during setup. Make sure you have them on paper or steel — not on this computer.",
+    2: 'Done — you confirmed you have your words.',
+    3: 'Done.',
+  },
+  /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): the cards' step copy, adapted from the design (spec §3.11 Differs). */
+  card2: {
+    1: "You'll be taken to the import screen. Type or paste your words.",
+    2: "You'll be taken to the import screen. Type or paste your words.",
+    3: 'Done — seed verified against your existing public key.',
+  },
+  card3: {
+    1: "Once your phrase is verified against this wallet, you'll choose a new password (at least 12 characters). The old password stops working.",
+    2: 'After your phrase is verified.',
+    3: "You'll choose a new password. The old password stops working. A passkey is not carried over; you can add one again later.",
+  },
+  next: {1: 'Restore from seed', 2: 'Continue', 3: 'Continue to import'},
+} as const;
+
+/** #8 on #39's restore path (E5 with `replacement`). */
+export const RESTORE = {
+  checking: 'Checking this phrase against the wallet in this browser…',
+  notThisWallet: 'This phrase does not belong to the wallet in this browser. Nothing was changed.',
+  notThisWalletHelp: 'To replace that wallet without its password, remove Noctura from this browser and install it again.',
+  tryAnother: 'Try another phrase',
+  sendOpen: 'A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.',
+  tryAgain: 'Try again',
+  busy: 'The wallet changed while you were typing. Start again.',
+  /** Controller addition — confirmed by the owner 2026-10-01 (plan 2, carry 4): E5's `unlocked` — an unlock landed mid-forget. The `busy` line would say the wallet is locked, which is false here. */
+  unlocked: 'The wallet was unlocked while this was running, so nothing was deleted. Start again.',
+  /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): the button the two "Start again" lines offer — back to #39. */
+  startAgain: 'Start again',
+  setUp: 'Set up a wallet',
+} as const;
+
 /** #6 biometric-setup → passkey (D9). */
 export const PASSKEY = {
   adding: 'Waiting for your passkey…',
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 6773e67..8a998db 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -307,3 +307,14 @@
 .vlt-col .s-pin .intent-row .value .addr-groups {
   justify-content: flex-end;
 }
+
+/* #39: the mockup's card spacing, the done cards at its 0.55 opacity, the warning card's title tone. */
+.vlt-gap-3b {
+  margin-bottom: var(--space-3);
+}
+.vlt-col .s8-step-card.vlt-done {
+  opacity: 0.55;
+}
+.vlt-warning {
+  color: var(--warning);
+}
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 455ee1f..44c3a28 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -295,7 +295,7 @@
             <div class="noc-caption vlt-lede vlt-gap-top-1">No activity for 60 s — phrase will be wiped from this field.</div>
           </div>
         </div>
-        <div class="ta-wrap">
+        <div id="imp-field" class="ta-wrap">
           <textarea id="imp-phrase" class="vlt-phrase" autocomplete="off" autocapitalize="none" spellcheck="false" rows="4" aria-label="Recovery phrase" placeholder="Enter your 12 or 24-word recovery phrase, separated by spaces."></textarea>
           <div id="imp-grid" class="ta-grid" hidden></div>
         </div>
@@ -306,6 +306,10 @@
           <div class="noc-body-sm">This phrase is also the root of the Noctura phone app's future private (shielded) keys — anyone who gets it from this browser gets those too. Accounts after the first one exist only in this extension until the phone app supports more than one account.</div>
         </div>
         <p id="imp-line" class="noc-body vlt-pad vlt-center" role="status" hidden></p>
+        <div id="imp-notice" class="vlt-notice" role="status" hidden>
+          <p id="imp-notice-line" class="noc-body"></p>
+          <p id="imp-notice-help" class="noc-body-sm vlt-lede"></p>
+        </div>
         <div id="imp-choose" class="vlt-choose" hidden>
           <p id="imp-choose-why" class="noc-body"></p>
           <button id="imp-choose-slip10" type="button" class="noc-card vlt-choice">Standard (Phantom/Solflare)</button>
@@ -315,6 +319,7 @@
         <div class="sticky-bar">
           <button id="imp-continue" type="button" class="btn btn-primary" disabled>Continue</button>
           <button id="imp-keep" type="button" class="btn btn-tertiary" hidden>Keep working — reset timer</button>
+          <button id="imp-action" type="button" class="btn btn-secondary" hidden></button>
         </div>
       </section>
 
@@ -409,6 +414,46 @@
         </div>
       </section>
 
+      <!-- #39 forgot-pin → "Forgot password?" (spec §3.11): three cards walked in order; the restore runs on #8 (E5).
+           The mockup's `.s-secintro` scope is not carried: none of its rules applies to #39's step cards. -->
+      <section id="v-forgot" class="screen" hidden>
+        <div class="top-bar">
+          <button id="fg-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
+          <span class="title noc-overline vlt-muted">Recovery</span>
+          <span id="fg-step" class="step noc-body-sm noc-numeral"></span>
+        </div>
+        <div class="scroll-area vlt-pad-top">
+          <h1 id="fg-title" class="noc-h1 vlt-gap-2"></h1>
+          <p id="fg-lede" class="noc-body vlt-lede vlt-gap-6"></p>
+          <div id="fg-card-1" class="s8-step-card vlt-gap-3b">
+            <div class="num-pill">1</div>
+            <h3>Recover from seed phrase</h3>
+            <p id="fg-card-1-body"></p>
+            <span id="fg-card-1-hint" class="hint">If you don't have your seed, your funds cannot be recovered. That's the security tradeoff of self-custody.</span>
+          </div>
+          <div id="fg-card-2" class="s8-step-card vlt-gap-3b">
+            <div class="num-pill">2</div>
+            <h3>Enter your words</h3>
+            <p id="fg-card-2-body"></p>
+          </div>
+          <div id="fg-card-3" class="s8-step-card">
+            <div class="num-pill">3</div>
+            <h3>Set a new password</h3>
+            <p id="fg-card-3-body"></p>
+          </div>
+          <div id="fg-warn" class="s8-step-card warn vlt-gap-top-3" hidden>
+            <div class="num-pill"><svg width="14" height="14" aria-hidden="true"><use href="#i-alert-triangle" /></svg></div>
+            <h3 class="vlt-warning">One warning before you proceed</h3>
+            <p>Restoring from seed replaces the wallet in this browser — including any unconfirmed transactions. Your funds on Solana are unaffected.</p>
+          </div>
+          <p id="fg-foot" class="noc-caption vlt-muted vlt-gap-top-5">The recovery flow is offline-only. We never see your seed phrase, your password, or your wallet address.</p>
+        </div>
+        <div class="sticky-bar">
+          <button id="fg-next" type="button" class="btn btn-primary"><svg width="18" height="18" aria-hidden="true"><use href="#i-arrow-right" /></svg><span id="fg-next-label"></span></button>
+          <button id="fg-cancel" type="button" class="btn btn-secondary">Cancel</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/create.test.ts src/unlock/__tests__/pageHarness.ts src/unlock/__tests__/restore.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 95 passed (95) Tests 1209 passed (1209).

- [ ] **Step 5: Edit the spec.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index be18eb1..07e38c6 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -557,11 +557,12 @@ simulation: {
      revision with `expectedRevision` (`busy` if it moved), and, under `sessionMutex`, confirm
      `getSession() === null` (**`unlocked`** if an unlock landed since step 3; `vault.setKeys` does
      not take `serial`, so this is the one race left inside the section). A `busy` here has changed
-     nothing but the lock and the removal of closed pending records. The page says: "The wallet
-     changed while this was running. Nothing was deleted; the wallet is locked. Start again." An
-     `unlocked` here has changed the same, but the wallet is unlocked again, so that line would be
-     false. **Note for plan 2:** #39 and #40 need their own line for `unlocked` — the `busy` copy
-     says "the wallet is locked", which is false here (owner's copy to come).
+     nothing but the lock and the removal of closed pending records. The page cannot tell a step-1
+     `busy` from a step-5 one, so it shows one line for both: §3.8's "The wallet changed while you
+     were typing. Start again." (true in both; plan-2 review ruling 3). An `unlocked` here has changed
+     the same, but the wallet is unlocked again. #39's restore and #40's retry (both on #8) say
+     instead: "The wallet was unlocked while this was running, so nothing was deleted. Start again." +
+     `[Start again]` → #39 — **controller addition — confirmed by the owner 2026-10-01**.
   6. **The vault write:** `v1_vault` removed, or overwritten by `replacement`. A crash before this
      write leaves the old wallet in place and locked, and the operation can be repeated. There is
      never half a wallet.
@@ -930,9 +931,13 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
       the flow goes to #5 with the step counter "Restore · 2 / 2";
     - at the finish, `vault.forgetWallet {expectedRevision, replacement}`:
       - `send-open` → "A transaction from this wallet is still pending. Wait until it confirms or
-        expires — about two minutes — then try again." + `[Try again]`; the phrase and password
-        stay in page memory while this page stays open;
+        expires — about two minutes — then try again." + `[Try again]`; the phrase stays in page
+        memory while this page stays open; the password too, until the tab is hidden — §3.5's rule
+        wins (plan-2 review L5): a hidden tab drops it and #5 reads "Enter a new password to try
+        again." (**controller addition — confirmed by the owner 2026-10-01**);
       - `busy` → "The wallet changed while you were typing. Start again." → #39;
+      - `unlocked` (an unlock landed mid-forget, E5 step 5) → "The wallet was unlocked while this was
+        running, so nothing was deleted. Start again." → #39 — **controller addition — confirmed by the owner 2026-10-01**;
       - `ok` → `vault.setKeys` → UI tab `#/imported`.
 - **Navigation:** Continue → (scheme) → #5 (import variant) → `created` → UI tab `#/imported`; on
   the restore path, as above.
```

- [ ] **Step 6: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- send-open asks for the password again → RED Tests  2 failed | 11 passed (13)
- unlocked shown with the busy line → RED Tests  1 failed | 12 passed (13)
- restore Back empties #8 (L3) → RED Tests  1 failed | 12 passed (13)
- a hidden tab behind [Try again] keeps the refusal line (L5) → RED Tests  1 failed | 12 passed (13)

- [ ] **Step 7: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `39-step-1-card`, `39-step-2-card`, `39-step-3-card`, `08-restore-not-this-wallet`, `05-restore-enter`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/unlock/__tests__/create.test.ts extension/src/unlock/__tests__/pageHarness.ts extension/src/unlock/__tests__/restore.test.ts extension/src/unlock/modes.ts extension/src/unlock/screens/createRun.ts extension/src/unlock/screens/forgot.ts extension/src/unlock/screens/importRun.ts extension/src/unlock/screens/importScreen.ts extension/src/unlock/screens/password.ts extension/src/unlock/screens/restoreRun.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/unlock.html
git commit -m "feat(extension): #39 forgot password and #8’s restore path — seed proof, replacement, send-open retry, the unlocked line" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 13: #8’s retry path — the password of the wallet being replaced, the guarded delete, the first write, `[Try again]` (D41, C6)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Create: `extension/src/unlock/__tests__/retry.test.ts`
- Modify: `extension/src/unlock/modes.ts`
- Modify: `extension/src/unlock/page.ts`
- Create: `extension/src/unlock/screens/retryRun.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Tasks 2, 4, 5, 8, 9, 12.
- Produces: `src/unlock/screens/retryRun.ts`: `interface RetryRun {show(): Promise<void>; holds(): {phrase: boolean; prepared: boolean; proof: boolean}}`; `createRetryRun(deps, o: {password: PasswordScreen}): RetryRun`; `PageTarget` gains `'unlock.html?mode=import&source=retry'`; `strings.ts`: `RETRY`

Spec §3.8's `source=retry` and §2 E5 / §11.13 (D41, C6, R2-L6). First "Confirm with the password of the wallet you are replacing" (`[Confirm]`, `[Confirm with passkey]` when there is one; `wrong` → "That did not confirm it."; the backoff, with "That did not confirm it. Wait a moment before trying again." during its wait) — the factor proof records the revision it proved; back → #40. Then #8 with a cleared field → the scheme → #5 "Import · 2 / 2" for B → B is encrypted, then `replaceEmptyWallet` (Task 2: the delete always under the unfunded guard, then the first write): `created` → `#/imported`; `funded` → "This wallet now holds funds. Nothing was changed." (stop); `unreachable` → "Balances could not be checked, so nothing was changed. Try again later." (stop); `coordinator-refused` → the D26 text (stop); `send-open` → its line + `[Try again]`; a failed store after the delete → "The new wallet was not saved. Try again." + `[Try again]` (B and its password kept in page memory), which retries **the store alone**; a `[Try again]` answered `wallet-exists` → "A wallet already exists in this browser. Nothing was changed." and stops — no loop, no second delete (R2-L6); `busy` / `unlocked` → #8 with the line and `[Start again]` → the retry path's start.

What the run holds, and for how long (plan-2 review H2; Scope 19): B's phrase and the factor proof until the run ends — B stored, every `stop` answer (`exists`, `funded`, `unreachable`, `coordinator-refused`), every notice — and with the page; B prepared (`next`: its envelope **and its session secret keys**) only behind a pending `[Try again]`, and it goes whenever the tab is hidden, with the password it was encrypted under (§3.5, L5) — B is then encrypted again under the password typed next. (Without that, the dry run of the review fixes found, a `[Try again]` after a hidden tab stored B under the password the user had been told was dropped.) `holds()` reports which of the three the run still references; the tests assert it after every terminal outcome. Rule 6: a second `[Confirm]` before the first settles runs one proof (M6).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/unlock/__tests__/retry.test.ts`:

```ts
// @vitest-environment happy-dom
import {createEnvelope, unlockWithPassword, type EnvelopeV1} from '../../vault/envelope';
import {VAULT_KEY} from '../../background/accountsStore';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {getSession} from '../../background/session';
import {createRetryRun} from '../screens/retryRun';
import {mountPassword} from '../screens/password';
import type {Send} from '../types';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible, type Harness} from './pageHarness';

const A = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K_A = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const B = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const A_PW = 'correct horse battery';
const B_PW = 'the new wallet password';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

beforeEach(loadPage);

async function retrying(o: {balance?: (owner: string) => bigint; send?: (inner: Send) => Send} = {}) {
  const old = await createEnvelope({mnemonic: A, password: A_PW, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: K_A}], kdf: testKdf});
  const h = await harness({vault: old, send: o.send, reader: {getBalance: async owner => o.balance?.(owner) ?? 0n, getMultipleLamports: async keys => keys.map(() => 0n)}});
  await h.ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: RECIPIENT, at: 1}]);
  const kdfCalls = {n: 0};
  h.deps.kdf = (pw, salt, params) => ((kdfCalls.n += 1), testKdf(pw, salt, params));
  const run = createRetryRun(h.deps, {password: mountPassword(h.deps)});
  await run.show();
  return {h, old, run, kdfCalls};
}
const NOTHING = {phrase: false, prepared: false, proof: false};
async function prove(h: Harness, password: string) {
  type(el<HTMLInputElement>('rp-password'), password);
  click(el('rp-confirm'));
  await h.until(() => !h.deps.gate.isBusy() && (visible(el('v-import')) || text(el('rp-helper')) !== ''));
}
async function importB(h: Harness) {
  type(el<HTMLTextAreaElement>('imp-phrase'), B);
  click(el('imp-continue'));
  await h.until(() => visible(el('v-password')) && !h.deps.gate.isBusy());
  type(el<HTMLInputElement>('pw-field'), B_PW);
  click(el('pw-cta'));
  await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
  type(el<HTMLInputElement>('pw-field'), B_PW);
  click(el('pw-cta'));
  await h.until(() => !h.deps.gate.isBusy() && (h.went.length > 0 || text(el('pw-helper')) !== '' || visible(el('imp-notice'))));
}

describe('#8 retry path: the password of the wallet being replaced (D41, E5 factor proof)', () => {
  it('asks first, in the design’s chrome; a wrong password is refused and nothing changes', async () => {
    const {h, old} = await retrying();
    expect(visible(el('v-retry'))).toBe(true);
    expect(text(el('v-retry').querySelector('h1'))).toBe('Confirm with the password of the wallet you are replacing');
    expect(text(el('rp-confirm'))).toBe('Confirm');
    expect(visible(el('rp-passkey'))).toBe(false);
    expect(unstyled('v-retry')).toEqual([]);
    await prove(h, 'not the password at all');
    expect(text(el('rp-helper'))).toBe('That did not confirm it.');
    expect(visible(el('v-import'))).toBe(false);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(old);
    expect(h.sent).toEqual([]);
  });

  it('the right password → #8 → B → #5 → the old wallet deleted under the guard, B stored and unlocked → #/imported', async () => {
    const {h, run} = await retrying();
    await prove(h, A_PW);
    expect(visible(el('v-import'))).toBe(true);
    expect(el<HTMLTextAreaElement>('imp-phrase').value).toBe('');
    await importB(h);
    expect(h.went).toEqual(['wallet.html#/imported']);
    const forget = h.sent.filter(m => m.type === 'vault.forgetWallet');
    expect(forget).toHaveLength(1);
    expect(forget[0]?.guard).toBe('unfunded');
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    expect(env.accounts.map(a => a.publicKey)).not.toContain(K_A);
    await unlockWithPassword(env, B_PW, testKdf);
    await expect(unlockWithPassword(env, A_PW, testKdf)).rejects.toThrow();
    expect((await getSession(h.ext))?.map(a => a.publicKey)).toEqual(env.accounts.map(a => a.publicKey));
    expect(await h.ext.local.get(KNOWN_RECIPIENTS_KEY)).toBeUndefined();
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  // C6, the spec's E2E 12 second run at unit scale: funds arrive after #40 rendered empty.
  it('funds that arrived meanwhile: "This wallet now holds funds. Nothing was changed." — the stored envelope is byte-identical', async () => {
    const {h, old, run} = await retrying({balance: owner => (owner === K_A ? 1n : 0n)});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-helper'))).toBe('This wallet now holds funds. Nothing was changed.');
    // H2 (plan review): a `stop` keeps nothing of B (its envelope, its session secret keys, its phrase) nor the proof.
    expect(run.holds()).toEqual(NOTHING);
    expect(visible(el('pw-cta'))).toBe(false);
    expect(JSON.stringify(await h.ext.local.get(VAULT_KEY))).toBe(JSON.stringify(old));
    expect(h.went).toEqual([]);
  }, 30_000);

  it('a failed store after the delete: "The new wallet was not saved. Try again." — [Try again] stores B alone', async () => {
    let fail = true;
    const {h} = await retrying({send: inner => async m => ((m as {type: string}).type === 'vault.storeEnvelope' && fail ? {ok: false, error: 'something'} : inner(m))});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-helper'))).toBe('The new wallet was not saved. Try again.');
    expect(text(el('pw-cta'))).toBe('Try again');
    expect(await h.ext.local.get(VAULT_KEY)).toBeUndefined();
    fail = false;
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    expect(h.went).toEqual(['wallet.html#/imported']);
    expect(h.sent.filter(m => m.type === 'vault.forgetWallet')).toHaveLength(1);
  }, 30_000);

  it('a [Try again] answered wallet-exists (another tab created one) says so and stops — no second delete (R2-L6)', async () => {
    let fail = true;
    const {h, run} = await retrying({send: inner => async m => ((m as {type: string}).type === 'vault.storeEnvelope' && fail ? {ok: false, error: 'something'} : inner(m))});
    await prove(h, A_PW);
    await importB(h);
    expect(run.holds()).toEqual({phrase: true, prepared: true, proof: true});
    const third = await createEnvelope({mnemonic: A, password: A_PW, scheme: 'cli', accounts: [{index: 0, name: 'X', publicKey: 'EHqmfkN89RJ7Y33CXM6uCzhVeuywHoJXZZLszBHHZy7o'}], kdf: testKdf});
    await h.ext.local.set(VAULT_KEY, third);
    fail = false;
    click(el('pw-cta'));
    await h.until(() => text(el('pw-helper')) === 'A wallet already exists in this browser. Nothing was changed.');
    expect(visible(el('pw-cta'))).toBe(false);
    expect(h.sent.filter(m => m.type === 'vault.forgetWallet')).toHaveLength(1);
    expect(await h.ext.local.get(VAULT_KEY)).toEqual(third);
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  // H2 + L5 (plan review): a hidden tab drops the held password AND B prepared under it — B is stored
  // under the password typed next, never under the one the user was told to replace.
  it('a tab hidden behind [Try again]: B prepared goes with the password; B is stored under the new one', async () => {
    let fail = true;
    const {h, run} = await retrying({send: inner => async m => ((m as {type: string}).type === 'vault.storeEnvelope' && fail ? {ok: false, error: 'something'} : inner(m))});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-cta'))).toBe('Try again');
    h.leave();
    expect(run.holds()).toEqual({phrase: true, prepared: false, proof: true});
    expect(text(el('pw-helper'))).toBe('Enter a new password to try again.');
    fail = false;
    const C_PW = 'a third password, typed after';
    type(el<HTMLInputElement>('pw-field'), C_PW);
    click(el('pw-cta'));
    await h.until(() => text(el('pw-title')) === 'Confirm your password' && !h.deps.gate.isBusy());
    type(el<HTMLInputElement>('pw-field'), C_PW);
    click(el('pw-cta'));
    await h.until(() => h.went.length > 0);
    const env = (await h.ext.local.get(VAULT_KEY)) as EnvelopeV1;
    await unlockWithPassword(env, C_PW, testKdf);
    await expect(unlockWithPassword(env, B_PW, testKdf)).rejects.toThrow();
    expect(h.sent.filter(m => m.type === 'vault.forgetWallet')).toHaveLength(1);
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  it.each([
    ['busy', 'The wallet changed while you were typing. Start again.'],
    ['no-wallet', 'No wallet on this browser yet.'],
  ])('the forget answered %s ends the run on #8’s notice, keeping nothing', async (error, line) => {
    const {h, run} = await retrying({send: inner => async m => ((m as {type: string}).type === 'vault.forgetWallet' ? {ok: false, error} : inner(m))});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('imp-notice-line'))).toBe(line);
    expect(run.holds()).toEqual(NOTHING);
  }, 30_000);

  it('rule 6: a second [Confirm] before the first settles runs one proof (one KDF run)', async () => {
    const {h, kdfCalls} = await retrying();
    type(el<HTMLInputElement>('rp-password'), A_PW);
    click(el('rp-confirm'));
    click(el('rp-confirm'));
    await h.until(() => !h.deps.gate.isBusy() && visible(el('v-import')));
    expect(kdfCalls.n).toBe(1);
  });

  it.each([
    ['unreachable', 'Balances could not be checked, so nothing was changed. Try again later.'],
    ['coordinator-refused', 'The server is not answering for now — try again in 10 minutes.'],
    ['send-open', 'A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.'],
  ])("the guard's %s: %s", async (error, line) => {
    const {h, run} = await retrying({send: inner => async m => ((m as {type: string}).type === 'vault.forgetWallet' ? {ok: false, error} : inner(m))});
    await prove(h, A_PW);
    await importB(h);
    expect(text(el('pw-helper'))).toBe(line);
    // A `stop` keeps nothing; `send-open` keeps B and the proof behind its [Try again].
    expect(run.holds()).toEqual(error === 'send-open' ? {phrase: true, prepared: true, proof: true} : NOTHING);
  }, 30_000);

  it('back from the password step returns to #40', async () => {
    const {h} = await retrying();
    click(el('rp-back'));
    expect(h.went).toEqual(['wallet.html#/imported']);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/unlock/__tests__/retry.test.ts`
Expected (dry run): FAIL — Test Files 1 failed (1) Tests no tests (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index 1be5310..f8205bd 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -12,6 +12,7 @@ import {mountPassword} from './screens/password';
 import {mountForgot} from './screens/forgot';
 import {mountReauth} from './screens/reauth';
 import {createRestoreRun} from './screens/restoreRun';
+import {createRetryRun} from './screens/retryRun';
 import {mountUnlock} from './screens/unlock';
 import {workerKdf} from '../vault/kdf';
 import {send} from '../ui/send';
@@ -115,6 +116,11 @@ export function startMode(mode: PageMode, deps: PageDeps): void {
     void createRestoreRun(deps, {password: mountPassword(deps)}).show();
     return;
   }
+  if (mode.mode === 'import' && mode.source === 'retry') {
+    legacy(null);
+    void createRetryRun(deps, {password: mountPassword(deps)}).show();
+    return;
+  }
   if (mode.mode === 'unlock') {
     legacy(null);
     void mountUnlock(deps).show(mode.returnTo);
```

Modify `extension/src/unlock/page.ts`:

```diff
diff --git a/extension/src/unlock/page.ts b/extension/src/unlock/page.ts
index 17ca620..7b6217b 100644
--- a/extension/src/unlock/page.ts
+++ b/extension/src/unlock/page.ts
@@ -24,6 +24,7 @@ export type PageTarget =
   | 'unlock.html?mode=unlock'
   | 'unlock.html?mode=forgot'
   | 'unlock.html?mode=import&source=forgot'
+  | 'unlock.html?mode=import&source=retry'
   | 'wallet.html#/created'
   | 'wallet.html#/imported'
   | `wallet.html#/send/resume?account=${string}`;
```

Create `extension/src/unlock/screens/retryRun.ts`:

```ts
import {evaluatePrf} from '../../vault/passkey';
import {unb64} from '../../vault/bytes';
import {proveFactor, replaceEmptyWallet, type FactorProof} from '../forgetFlow';
import {commitWallet, detectImport, indexesFor, prepareWallet, type PreparedWallet} from '../onboarding';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {storedVault} from '../stored';
import {COMMON, IMPORT, PASSWORD, RESTORE, RETRY} from '../strings';
import {byId, setText, showScreen, shown} from '../view/dom';
import {mountImport} from './importScreen';
import type {PasswordScreen} from './password';

export interface RetryRun {
  show(): Promise<void>;
  /** For the tests: which of B's phrase, B prepared and the proof this run still references. */
  holds(): {phrase: boolean; prepared: boolean; proof: boolean};
}

/**
 * #40's "Try a different seed" (D41, spec §3.8 `source=retry`, E5 §11.13): first the password (or
 * passkey) of the wallet being replaced — the factor proof, which records the revision it proved —
 * then #8 → the scheme → #5 "Import · 2 / 2" for the new wallet B. At the finish B is encrypted first,
 * then the proven wallet is deleted under the background's unfunded guard (C6) and B stored at once
 * (forgetFlow.replaceEmptyWallet: the guard is always sent). The two writes are not atomic: a failed
 * store after the delete keeps B in this page's memory behind [Try again], which retries the store
 * alone; a retry answered `wallet-exists` says so and stops (R2-L6). Funds that arrived meanwhile
 * (`funded`) change nothing.
 *
 * What this run holds, and for how long (plan review H2): B's phrase from #8's Continue, and the factor
 * proof from the confirm step, until the run ends — B stored, any `stop` answer (`exists`, `funded`,
 * `unreachable`, `coordinator-refused`), any notice — and with the page; a hidden tab keeps them (the
 * hidden-tab rule is the password's, §3.5). B prepared (`next`: its envelope AND its session secret
 * keys) exists only behind a pending [Try again], and goes at every end and whenever the tab is hidden:
 * the password it was encrypted under is dropped then (§3.5, L5), so B is encrypted again under the
 * password typed next — never stored under one the user was told to replace.
 */
export function createRetryRun(deps: PageDeps, o: {password: PasswordScreen}): RetryRun {
  const field = byId<HTMLInputElement>('rp-password');
  const confirm = byId<HTMLButtonElement>('rp-confirm');
  const passkey = byId<HTMLButtonElement>('rp-passkey');
  const backoff = createWrongBackoff(deps.sleep);
  const startAgain = {label: RESTORE.startAgain, run: () => deps.go('unlock.html?mode=import&source=retry')};
  const setUp = {label: RESTORE.setUp, run: () => deps.go('unlock.html?mode=welcome')};
  let pk: {credentialId: string; prfSalt: string} | null = null;
  let proof: FactorProof | null = null;
  /** B, encrypted, once #5's password is set; and whether the old wallet is already gone. */
  let next: PreparedWallet | null = null;
  let deleted = false;
  /** B's phrase, from #8's Continue to the run's end. */
  let phrase: string | null = null;
  /** The run ended (or never began): nothing of B or of the proof is kept. */
  const end = () => {
    next = null;
    proof = null;
    phrase = null;
  };

  const render = () => {
    const busy = deps.gate.isBusy();
    field.disabled = busy;
    confirm.disabled = busy;
    passkey.disabled = busy;
    shown(passkey, pk !== null);
  };
  const helper = (text: string, error: boolean) => {
    setText(byId('rp-helper'), text);
    byId('rp-helper').classList.toggle('error', error);
    field.classList.toggle('is-error', error);
  };
  const proved = async (factor: Parameters<typeof proveFactor>[1]) => {
    const r = await backoff.run(async () => {
      const out = await proveFactor(deps.store.readEnvelope, factor);
      if (out.outcome === 'proven') proof = out.proof;
      return out.outcome;
    }, () => helper(COMMON.waitConfirm, true));
    field.value = '';
    if (r === 'proven') {
      helper('', false);
      return screen.show();
    }
    if (r === 'wrong') return helper(COMMON.wrongConfirm, true);
    if (r === 'no-wallet') return notice(COMMON.noWallet, '', setUp);
    if (r === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
    helper(COMMON.failedTryAgain, false);
  };
  const notice = (line: string, help: string, action: {label: string; run(): void} | null) => {
    end();
    screen.show();
    screen.notice(line, help, action);
  };

  /** #5's finish: delete-then-store, or (after a delete whose store failed) the store alone. */
  const finish = async (password: string, scheme: 'slip10' | 'cli', indexes: number[]) => {
    if (proof === null || phrase === null) {
      end();
      return {line: COMMON.failedTryAgain, then: 'stop' as const};
    }
    next ??= await prepareWallet(deps.kdf, {mnemonic: phrase, password, scheme, indexes});
    const out = deleted ? await commitWallet({...deps.store, send: deps.send}, next) : await replaceEmptyWallet({...deps.store, send: deps.send}, proof, next);
    const stop = (line: string) => {
      end();
      return {line, then: 'stop' as const};
    };
    if (out === 'created' || out === 'created-locked') {
      end();
      deps.go('wallet.html#/imported');
      return null;
    }
    if (out === 'store-failed' || (deleted && out === 'failed')) {
      deleted = true;
      return {line: RETRY.storeFailed, then: 'retry' as const};
    }
    if (out === 'exists') return stop(COMMON.exists);
    if (out === 'send-open') return {line: RESTORE.sendOpen, then: 'retry' as const};
    if (out === 'funded') return stop(RETRY.funded);
    if (out === 'unreachable') return stop(RETRY.unreachable);
    if (out === 'coordinator-refused') return stop(RETRY.refused);
    const ended = {
      busy: [RESTORE.busy, '', startAgain],
      unlocked: [RESTORE.unlocked, '', startAgain],
      'no-wallet': [COMMON.noWallet, '', setUp],
      damaged: [COMMON.damaged, COMMON.damagedHelp, null],
    } as const;
    if (out in ended) {
      const [line, help, action] = ended[out as keyof typeof ended];
      notice(line, help, action);
      return null;
    }
    return {line: COMMON.failedTryAgain, then: 'retry' as const};
  };

  const screen = mountImport(deps, {
    back: () => {
      end();
      showScreen('v-retry');
    },
    next: async typed => {
      screen.line(IMPORT.checking);
      const detected = await detectImport(deps.send, typed);
      if (detected.outcome === 'invalid-mnemonic') return screen.line(IMPORT.invalid);
      screen.line(null);
      const {candidates, probe, choice} = detected;
      const scheme = 'choose' in choice ? await screen.choose(choice.choose === 'both-funded' ? IMPORT.bothFunded : IMPORT.unresolved) : choice.scheme;
      const indexes = indexesFor(scheme, candidates, probe);
      screen.clear();
      next = null;
      phrase = typed;
      o.password.show({
        eyebrow: PASSWORD.onboarding,
        step: PASSWORD.stepImport,
        back: () => {
          next = null;
          screen.show({phrase: phrase ?? ''});
        },
        finish: password => finish(password, scheme, indexes),
      });
    },
  });

  deps.gate.onIdle(render);
  byId('rp-form').addEventListener('submit', e => {
    e.preventDefault();
    void exclusive(deps, render, () => proved({password: field.value, kdf: deps.kdf}));
  });
  confirm.addEventListener('click', () => void exclusive(deps, render, () => proved({password: field.value, kdf: deps.kdf})));
  passkey.addEventListener('click', () =>
    void exclusive(deps, render, async () => {
      const key = pk;
      if (key === null) return;
      let prfOutput: Uint8Array | null;
      try {
        prfOutput = await evaluatePrf(deps.credentials, unb64(key.credentialId), unb64(key.prfSalt));
      } catch {
        prfOutput = null;
      }
      if (prfOutput === null) return helper(COMMON.passkeyUnavailableConfirm, false);
      await proved({prfOutput});
    }),
  );
  byId('rp-back').addEventListener('click', () => deps.go('wallet.html#/imported'));
  deps.onLeave(() => {
    field.value = '';
    // B prepared goes with the password it was encrypted under (§3.5 drops that password now).
    next = null;
  });

  return {
    holds: () => ({phrase: phrase !== null, prepared: next !== null, proof: proof !== null}),
    async show() {
      showScreen('v-retry');
      render();
      let raw: unknown;
      try {
        raw = await deps.store.readEnvelope();
      } catch {
        return notice(COMMON.unreadable, '', null);
      }
      const stored = storedVault(raw);
      if (stored.kind === 'none') return notice(COMMON.noWallet, '', setUp);
      if (stored.kind === 'damaged') return notice(COMMON.damaged, COMMON.damagedHelp, null);
      pk = stored.env.passkey ?? null;
      render();
      field.focus();
    },
  };
}
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 8b53d85..478cdf9 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -143,6 +143,15 @@ export const RESTORE = {
   setUp: 'Set up a wallet',
 } as const;
 
+/** #8 on #40's "Try a different seed" path (D41, E5 with the unfunded guard, C6). */
+export const RETRY = {
+  funded: 'This wallet now holds funds. Nothing was changed.',
+  unreachable: 'Balances could not be checked, so nothing was changed. Try again later.',
+  /** The D26 banner text (§7.2). */
+  refused: 'The server is not answering for now — try again in 10 minutes.',
+  storeFailed: 'The new wallet was not saved. Try again.',
+} as const;
+
 /** #6 biometric-setup → passkey (D9). */
 export const PASSKEY = {
   adding: 'Waiting for your passkey…',
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 44c3a28..8dae391 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -454,6 +454,26 @@
         </div>
       </section>
 
+      <!-- #8 with source=retry (spec §3.8, D41): first the password of the wallet being replaced (the factor proof, E5). -->
+      <section id="v-retry" class="screen s-pin" hidden>
+        <div class="top-bar">
+          <button id="rp-back" type="button" class="icon-btn" aria-label="Back"><svg width="22" height="22" aria-hidden="true"><use href="#i-arrow-left" /></svg></button>
+        </div>
+        <div class="pin-head">
+          <div class="vlt-lock-tile" aria-hidden="true"><svg width="28" height="28"><use href="#i-lock" /></svg></div>
+          <h1 class="noc-h2">Confirm with the password of the wallet you are replacing</h1>
+          <form id="rp-form" class="vlt-field-row">
+            <input id="rp-password" class="vlt-input" type="password" autocomplete="current-password" aria-label="Password" />
+          </form>
+        </div>
+        <p id="rp-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        <div class="pin-spacer"></div>
+        <div class="sticky-bar">
+          <button id="rp-confirm" type="button" class="btn btn-primary">Confirm</button>
+          <button id="rp-passkey" type="button" class="btn btn-secondary" hidden>Confirm with passkey</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/unlock/__tests__/retry.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 96 passed (96) Tests 1222 passed (1222).

- [ ] **Step 5: Edit the spec.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 07e38c6..967c29b 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -914,8 +914,8 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   - **`&source=retry` (#40's "Try a different seed", D41):** before the phrase field, a password
     step: "Confirm with the password of the wallet you are replacing" + `[Confirm]` /
     `[Confirm with passkey]`; `wrong` → "That did not confirm it."; then #8 as a normal import. At
-    the finish, `vault.forgetWallet {expectedRevision, guard: 'unfunded'}`: `send-open` / `busy` as
-    below; `funded` → "This wallet now holds funds. Nothing was changed." (C6); `unreachable` →
+    the finish, `vault.forgetWallet {expectedRevision, guard: 'unfunded'}`: `send-open` / `busy` /
+    `unlocked` as below (`[Start again]` restarts this path); `funded` → "This wallet now holds funds. Nothing was changed." (C6); `unreachable` →
     "Balances could not be checked, so nothing was changed. Try again later."; `coordinator-refused`
     → the D26 banner text. A failed first write after the delete → "The new wallet was not saved.
     Try again." + `[Try again]` (phrase and password kept in page memory); a `[Try again]` answered
```

- [ ] **Step 6: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- [Try again] after a failed store deletes again → RED Tests  3 failed | 10 passed (13)
- funded offers a retry → RED Tests  1 failed | 12 passed (13)
- a stop keeps B prepared and the proof (H2) → RED Tests  4 failed | 9 passed (13)
- a hidden tab keeps B prepared under the dropped password (H2, L5) → RED Tests  1 failed | 12 passed (13)
- retryRun sends vault.forgetWallet itself, without the guard (M5) → RED Tests  10 failed | 3 passed (13)
- #rp [Confirm] without the page gate (M6) → RED Tests  1 failed | 12 passed (13)

- [ ] **Step 7: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `08-retry-password`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/unlock/__tests__/retry.test.ts extension/src/unlock/modes.ts extension/src/unlock/page.ts extension/src/unlock/screens/retryRun.ts extension/src/unlock/strings.ts extension/unlock.html
git commit -m "feat(extension): #8’s retry path — the factor proof, the guarded delete, the first write, Try again (D41, C6)" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 14: The `accounts` and `reveal` forms restyled; the dispatcher with no B1b-1 section left; the boundary’s positive control

**Files:**
- Modify: `extension/scripts/__tests__/check-vault-isolation.test.mjs`
- Create: `extension/src/unlock/__tests__/accountsReveal.test.ts`
- Modify: `extension/src/unlock/modes.ts`
- Create: `extension/src/unlock/screens/accounts.ts`
- Create: `extension/src/unlock/screens/reveal.ts`
- Modify: `extension/src/unlock/strings.ts`
- Modify: `extension/src/unlock/unlock.css`
- Modify: `extension/unlock.html`

**Interfaces:**
- Consumes: Tasks 1–13; `addAccount`, `removeAccount`, `runReveal` (plan 1).
- Produces: `src/unlock/screens/accounts.ts`: `mountAccounts(deps): {show(): void}`; `src/unlock/screens/reveal.ts`: `mountReveal(deps): {show(): void}`; `strings.ts`: `ACCOUNTS`, `REVEAL`; `modes.ts`: `startMode` for every `PageMode`

Spec §1.2's `accounts` (the add-account form restyled; remove stays the B1b-1 form — B1b-2b designs the manager) and `reveal` (restyled with the tokens only; B1b-2b builds the designed screen). Both keep the B1b-1 words and their flows (`addAccount`/`removeAccount`, `runReveal`); the phrase leaves the DOM on `[Hide]`, on leaving the page and when the tab is hidden. `modes.ts` becomes a plain dispatcher — every mode has its screen, and the last B1b-1 sections and the shared `#status` line leave `unlock.html`. The vault isolation gate's test asserts the real walk from `src/unlock/main.ts` reaches every screen, view and module plan 2 added (so each is held to the allowlist).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/scripts/__tests__/check-vault-isolation.test.mjs`:

```diff
diff --git a/extension/scripts/__tests__/check-vault-isolation.test.mjs b/extension/scripts/__tests__/check-vault-isolation.test.mjs
index 93a6aa6..974b941 100644
--- a/extension/scripts/__tests__/check-vault-isolation.test.mjs
+++ b/extension/scripts/__tests__/check-vault-isolation.test.mjs
@@ -843,3 +843,38 @@ describe('plan 2: the vault-page screens stay inside the boundary', () => {
     expect(sourceViolations([f('src/app/x.tsx', 'el.innerHTML = s;')])).toEqual([]);
   });
 });
+
+// Task 14: every vault-page screen is reached from the real entry — and so held to the allowlist above.
+describe('plan 2: the real vault page reaches every screen it builds (positive control of the boundary)', () => {
+  it('main.ts → modes.ts → each screen, its views, strings, the E5 and E3 halves', () => {
+    const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
+    const read = rel => {
+      try {
+        return readFileSync(join(root, rel), 'utf8');
+      } catch {
+        return undefined;
+      }
+    };
+    const resolved = [];
+    expect(
+      vaultPageViolations(read, rel => {
+        const hit = read(rel) !== undefined;
+        if (hit) resolved.push(rel);
+        return hit;
+      }),
+    ).toEqual([]);
+    const screens = ['welcome', 'seed', 'confirm', 'password', 'passkey', 'createRun', 'importScreen', 'importRun', 'restoreRun', 'retryRun', 'forgot', 'unlock', 'reauth', 'accounts', 'reveal'];
+    const views = ['dom', 'words', 'hold', 'meter', 'cooldown'];
+    expect(resolved).toEqual(
+      expect.arrayContaining([
+        ...screens.map(n => `src/unlock/screens/${n}.ts`),
+        ...views.map(n => `src/unlock/view/${n}.ts`),
+        'src/unlock/strings.ts',
+        'src/unlock/forgetFlow.ts',
+        'src/unlock/challenge.ts',
+        'src/unlock/stored.ts',
+        'src/unlock/page.ts',
+      ]),
+    );
+  });
+});
```

Create `extension/src/unlock/__tests__/accountsReveal.test.ts`:

```ts
// @vitest-environment happy-dom
import {createEnvelope, type EnvelopeV1} from '../../vault/envelope';
import {deriveSessionAccounts} from '../../vault/accounts';
import {VAULT_KEY} from '../../background/accountsStore';
import {setSession} from '../../background/session';
import {mountAccounts} from '../screens/accounts';
import {mountReveal} from '../screens/reveal';
import {startMode} from '../modes';
import {SCREENS} from '../view/dom';
import type {PageMode} from '../mode';
import {click, el, harness, loadPage, testKdf, text, type, unstyled, visible} from './pageHarness';

const M = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const K0 = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
const PW = 'correct horse battery';

beforeEach(loadPage);

async function unlockedWallet() {
  const env = await createEnvelope({mnemonic: M, password: PW, scheme: 'slip10', accounts: [{index: 0, name: 'Account 1', publicKey: K0}], kdf: testKdf});
  const h = await harness({vault: env});
  await setSession(h.ext, await deriveSessionAccounts(M, 'slip10', [0]));
  return h;
}

describe('the add-account form, restyled (spec §1.2 accounts)', () => {
  it('the design’s chrome around the B1b-1 form; the password adds account 2 and hands over its key', async () => {
    const h = await unlockedWallet();
    mountAccounts(h.deps).show();
    expect(text(el('v-accounts').querySelector('h1'))).toBe('Accounts');
    expect(text(el('acc-add'))).toBe('Add an account');
    expect(text(el('acc-remove'))).toBe('Remove the account');
    expect(unstyled('v-accounts')).toEqual([]);
    type(el<HTMLInputElement>('acc-password'), PW);
    click(el('acc-add'));
    click(el('acc-add'));
    await h.until(() => text(el('acc-helper')) === 'Done. The accounts are updated.');
    expect(((await h.ext.local.get(VAULT_KEY)) as EnvelopeV1).accounts.map(a => a.index)).toEqual([0, 1]);
    // Rule 6: the second click inside the first's run did nothing.
    expect(h.sent.filter(m => m.type === 'vault.storeEnvelope')).toHaveLength(1);
  }, 30_000);

  it('remove asks for an account number first', async () => {
    const h = await unlockedWallet();
    mountAccounts(h.deps).show();
    click(el('acc-remove'));
    await h.until(() => text(el('acc-helper')) !== '');
    expect(text(el('acc-helper'))).toBe('Enter the number of the account to remove (1, 2, …).');
  });
});

describe('the reveal form, restyled with the tokens (spec §1.2 reveal)', () => {
  it('shows the phrase after the proof, as text; Hide and leaving the tab take it out of the DOM', async () => {
    const h = await unlockedWallet();
    mountReveal(h.deps).show();
    expect(text(el('v-reveal').querySelector('h1'))).toBe('Your recovery phrase');
    expect(unstyled('v-reveal')).toEqual([]);
    type(el<HTMLInputElement>('rev-password'), PW);
    click(el('rev-show'));
    await h.until(() => el('rev-words').children.length === 12);
    expect(text(el('rev-helper'))).toBe('Write them down, in order, and keep them offline. Noctura never copies them anywhere.');
    expect([...el('rev-words').children].map(text)).toEqual(M.split(' '));
    expect(unstyled('v-reveal')).toEqual([]);
    click(el('rev-hide'));
    expect(el('rev-words').children).toHaveLength(0);
    type(el<HTMLInputElement>('rev-password'), PW);
    click(el('rev-show'));
    await h.until(() => el('rev-words').children.length === 12);
    h.leave();
    expect(el('rev-words').children).toHaveLength(0);
  }, 30_000);
});

describe('the dispatcher: each mode shows its one screen', () => {
  it.each<[PageMode, string]>([
    [{mode: 'welcome'}, 'v-welcome'],
    [{mode: 'create'}, 'v-intro'],
    [{mode: 'import', source: null}, 'v-import'],
    [{mode: 'import', source: 'forgot'}, 'v-import'],
    [{mode: 'import', source: 'retry'}, 'v-retry'],
    [{mode: 'forgot'}, 'v-forgot'],
    [{mode: 'reauth', challengeId: 'ab'.repeat(16)}, 'v-reauth'],
    [{mode: 'accounts'}, 'v-accounts'],
    [{mode: 'reveal'}, 'v-reveal'],
    [{mode: 'unlock', returnTo: null}, 'v-unlock'],
  ])('%j → #%s', async (mode, screen) => {
    const h = await unlockedWallet();
    startMode(mode, h.deps);
    await h.until(() => visible(el(screen)));
    expect(SCREENS.filter(s => visible(document.getElementById(s)))).toEqual([screen]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/unlock/__tests__/accountsReveal.test.ts`
Expected (dry run): FAIL — Test Files 2 failed (2) Tests 1 failed | 145 passed (146) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/unlock/modes.ts`:

```diff
diff --git a/extension/src/unlock/modes.ts b/extension/src/unlock/modes.ts
index f8205bd..4515400 100644
--- a/extension/src/unlock/modes.ts
+++ b/extension/src/unlock/modes.ts
@@ -1,236 +1,59 @@
-import {ENVELOPE_KEY} from './unlockFlow';
-import {MIN_PASSWORD_LENGTH, detectImport, finishOnboarding, indexesFor, type Candidate, type FinishOutcome, type ProbeResult} from './onboarding';
-import {addAccount, removeAccount, type AccountsOutcome} from './accountsFlow';
-import {runReveal, type RevealOutcome} from './revealFlow';
-import {createWrongBackoff, runExclusive, type BusyGate} from './orchestrate';
-import {backgroundVaultStore} from './vaultStore';
 import type {PageMode} from './mode';
 import type {PageDeps} from './page';
+import {mountAccounts} from './screens/accounts';
 import {createCreateRun} from './screens/createRun';
+import {mountForgot} from './screens/forgot';
 import {createImportRun} from './screens/importRun';
 import {mountPassword} from './screens/password';
-import {mountForgot} from './screens/forgot';
 import {mountReauth} from './screens/reauth';
 import {createRestoreRun} from './screens/restoreRun';
 import {createRetryRun} from './screens/retryRun';
+import {mountReveal} from './screens/reveal';
 import {mountUnlock} from './screens/unlock';
-import {workerKdf} from '../vault/kdf';
-import {send} from '../ui/send';
-import {readLocal} from '../shared/readLocal';
-
-// Thin page modes for B1b-1 (the owner's screens arrive in B1b-2). The vault page renders only its
-// own fixed strings (spec §1): every status line is a literal below, and the only other text it
-// ever shows is the user's own phrase — the new wallet's 24 words, or the stored phrase after a
-// proof (textContent, never markup). This page never touches the network: import asks the
-// background (wallet.probeBalances, public keys only), and every write of the envelope is the
-// background's (vault.storeEnvelope).
-const FINISH_WORDS: Record<FinishOutcome, string> = {
-  created: 'Wallet created. You can close this tab.',
-  'created-locked': 'Wallet created. Unlock it to use it.',
-  exists: 'A wallet already exists in this browser. Nothing was changed.',
-  'weak-password': 'The password must be at least 12 characters.',
-  'invalid-mnemonic': 'That is not a valid 12- or 24-word recovery phrase.',
-  failed: 'Something went wrong. Nothing was saved.',
-};
-const CHOOSE_WORDS = {
-  'both-funded': 'Both address types on this phrase hold funds. Choose the one to use.',
-  unresolved: 'Balances could not be checked. Choose the address type to use.',
-} as const;
-const ACCOUNTS_WORDS: Record<AccountsOutcome, string> = {
-  done: 'Done. The accounts are updated.',
-  'done-locked': 'The accounts were changed, and the wallet has been locked. Unlock it to use them.',
-  'done-not-locked': 'The accounts were changed, but the wallet could not be locked. Lock it now from the Noctura menu.',
-  wrong: 'That did not confirm it.',
-  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
-  damaged: "This wallet's stored data is damaged.",
-  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
-  'no-wallet': 'No wallet on this browser yet.',
-  'cli-single': 'A Solana CLI wallet has exactly one account.',
-  'last-account': 'The last account cannot be removed.',
-  'no-such-account': 'There is no account with that number.',
-  'too-many-accounts': 'This wallet already has the most accounts it can hold.',
-  failed: 'Something went wrong.',
-};
-const REVEAL_WORDS: Record<RevealOutcome['outcome'], string> = {
-  shown: 'Write them down, in order, and keep them offline. Noctura never copies them anywhere.',
-  wrong: 'That did not confirm it.',
-  'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
-  'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
-  damaged: "This wallet's stored data is damaged.",
-  'no-wallet': 'No wallet on this browser yet.',
-  failed: 'Something went wrong. Try again.',
-};
-const WAIT = 'That did not confirm it. Wait a moment before trying again.';
-// The B1b-1 thin sections the plan-2 screens have not replaced yet.
-const SECTIONS = ['import', 'accounts', 'reveal'] as const;
-
-const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
-const say = (text: string): void => {
-  $('status').textContent = text;
-};
-const store = backgroundVaultStore(send, () => readLocal(ENVELOPE_KEY));
-// Cardinal rule 6: one busy flag for the page; runExclusive sets it before the first await.
-let busy = false;
-const gate: BusyGate = {isBusy: () => busy, setBusy: b => (busy = b)};
-const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
-
-/** The user's own words, one list item each, as text. */
-function showWords(list: HTMLElement, words: readonly string[]): void {
-  list.replaceChildren(
-    ...words.map(w => {
-      const li = document.createElement('li');
-      li.textContent = w;
-      return li;
-    }),
-  );
-}
-
-function legacy(shown: (typeof SECTIONS)[number] | null): void {
-  for (const id of SECTIONS) $(id).hidden = id !== shown;
-  $('status').hidden = shown === null;
-}
 
+/**
+ * unlock.html?mode=… → the one run this page shows (spec B1b-2a §1.2). Each screen is mounted once per
+ * page; the welcome → create → import runs share one page (and #5), so a new phrase never crosses a
+ * navigation. The vault page renders only its own fixed strings (strings.ts, unlock.html), the user's
+ * own words and, on #10, the re-validated challenge fields; it never touches the network (the
+ * background reads, for public keys only) and never writes storage (the background is v1_vault's one
+ * writer).
+ */
 export function startMode(mode: PageMode, deps: PageDeps): void {
-  if (mode.mode === 'welcome' || mode.mode === 'create' || (mode.mode === 'import' && mode.source === null)) {
-    legacy(null);
-    // Each screen is mounted once per page; the runs share #5.
-    const password = mountPassword(deps);
-    let importRun: {show(): void} | null = null;
-    const create = createCreateRun(deps, {password, importRun: () => (importRun ??= createImportRun(deps, {password, back: () => create.start('welcome')})).show()});
-    if (mode.mode === 'import') (importRun ??= createImportRun(deps, {password, back: () => create.start('welcome')})).show();
-    else create.start(mode.mode === 'welcome' ? 'welcome' : 'intro');
-    return;
-  }
-  if (mode.mode === 'reauth') {
-    legacy(null);
-    void mountReauth(deps).show(mode.challengeId);
-    return;
-  }
-  if (mode.mode === 'forgot') {
-    legacy(null);
-    mountForgot(deps).show();
-    return;
-  }
-  if (mode.mode === 'import' && mode.source === 'forgot') {
-    legacy(null);
-    void createRestoreRun(deps, {password: mountPassword(deps)}).show();
-    return;
-  }
-  if (mode.mode === 'import' && mode.source === 'retry') {
-    legacy(null);
-    void createRetryRun(deps, {password: mountPassword(deps)}).show();
-    return;
-  }
-  if (mode.mode === 'unlock') {
-    legacy(null);
-    void mountUnlock(deps).show(mode.returnTo);
-    return;
-  }
-  legacy(mode.mode);
-  if (mode.mode === 'import') startImport();
-  if (mode.mode === 'accounts') startAccounts();
-  if (mode.mode === 'reveal') startReveal();
-}
-
-function startImport(): void {
-  let pending: {mnemonic: string; password: string; candidates: Candidate[]; probe: ProbeResult} | null = null;
-  const finish = async (scheme: 'slip10' | 'cli'): Promise<void> => {
-    const p = pending;
-    if (p === null) return;
-    pending = null;
-    $('choose').hidden = true;
-    say('Importing…');
-    const outcome = await finishOnboarding({...store, send, kdf: workerKdf}, {mnemonic: p.mnemonic, password: p.password, scheme, indexes: indexesFor(scheme, p.candidates, p.probe)});
-    say(FINISH_WORDS[outcome]);
-  };
-  $('import-btn').addEventListener('click', () => {
-    void runExclusive(gate, async () => {
-      const phrase = $<HTMLTextAreaElement>('phrase');
-      const pw = $<HTMLInputElement>('imp-password');
-      const pw2 = $<HTMLInputElement>('imp-password2');
-      const mnemonic = phrase.value;
-      const password = pw.value;
-      const repeated = pw2.value;
-      pw.value = '';
-      pw2.value = '';
-      if (password.length < MIN_PASSWORD_LENGTH) return say(FINISH_WORDS['weak-password']);
-      if (password !== repeated) return say('The two passwords are not the same.');
-      say('Checking which addresses hold funds…');
-      // Only 12 or 24 words, refused before anything is sent (detectImport).
-      const detected = await detectImport(send, mnemonic);
-      if (detected.outcome === 'invalid-mnemonic') return say(FINISH_WORDS['invalid-mnemonic']);
-      phrase.value = '';
-      const {candidates, probe, choice} = detected;
-      pending = {mnemonic, password, candidates, probe};
-      if ('choose' in choice) {
-        $('choose-why').textContent = CHOOSE_WORDS[choice.choose];
-        $('choose').hidden = false;
-        say('');
-        return;
+  switch (mode.mode) {
+    case 'welcome':
+    case 'create': {
+      const password = mountPassword(deps);
+      let importRun: {show(): void} | null = null;
+      const create = createCreateRun(deps, {password, importRun: () => (importRun ??= createImportRun(deps, {password, back: () => create.start('welcome')})).show()});
+      create.start(mode.mode === 'welcome' ? 'welcome' : 'intro');
+      return;
+    }
+    case 'import': {
+      const password = mountPassword(deps);
+      if (mode.source === 'forgot') void createRestoreRun(deps, {password}).show();
+      else if (mode.source === 'retry') void createRetryRun(deps, {password}).show();
+      else {
+        const create = createCreateRun(deps, {password, importRun: () => run.show()});
+        const run = createImportRun(deps, {password, back: () => create.start('welcome')});
+        run.show();
       }
-      await finish(choice.scheme);
-    });
-  });
-  $('choose-slip10').addEventListener('click', () => void runExclusive(gate, () => finish('slip10')));
-  $('choose-cli').addEventListener('click', () => void runExclusive(gate, () => finish('cli')));
-}
-
-function startAccounts(): void {
-  const backoff = createWrongBackoff(sleep);
-  const factor = () => {
-    const pw = $<HTMLInputElement>('acc-password');
-    const password = pw.value;
-    pw.value = '';
-    return {password, kdf: workerKdf};
-  };
-  $('add-account').addEventListener('click', () => {
-    void runExclusive(gate, async () => {
-      const f = factor();
-      say('Adding an account…');
-      say(ACCOUNTS_WORDS[await backoff.run(() => addAccount({...store, send}, f), () => say(WAIT))]);
-    });
-  });
-  $('remove-account').addEventListener('click', () => {
-    void runExclusive(gate, async () => {
-      const n = Number($<HTMLInputElement>('remove-index').value);
-      if (!Number.isSafeInteger(n) || n < 1) return say('Enter the number of the account to remove (1, 2, …).');
-      const f = factor();
-      say('Removing the account…');
-      say(ACCOUNTS_WORDS[await backoff.run(() => removeAccount({...store, send}, f, n - 1), () => say(WAIT))]);
-    });
-  });
-}
-
-function startReveal(): void {
-  const backoff = createWrongBackoff(sleep);
-  const list = $('reveal-words');
-  const hide = (): void => {
-    list.replaceChildren();
-  };
-  $('reveal-form').addEventListener('submit', e => {
-    e.preventDefault();
-    void runExclusive(gate, async () => {
-      const pw = $<HTMLInputElement>('reveal-password');
-      const password = pw.value;
-      pw.value = '';
-      hide();
-      say('Checking…');
-      const outcome = await backoff.run(async () => {
-        const r = await runReveal({...store, send}, {password, kdf: workerKdf});
-        if (r.outcome === 'shown') showWords(list, r.words);
-        return r.outcome;
-      }, () => say(WAIT));
-      say(REVEAL_WORDS[outcome]);
-    });
-  });
-  $('reveal-hide').addEventListener('click', () => {
-    hide();
-    say('');
-  });
-  // Leaving the page (closing the tab, navigating, or going into the back-forward cache) or hiding
-  // it (another tab, a minimised window) clears the words: they come back only with a new proof.
-  addEventListener('pagehide', hide);
-  document.addEventListener('visibilitychange', () => {
-    if (document.visibilityState === 'hidden') hide();
-  });
+      return;
+    }
+    case 'forgot':
+      mountForgot(deps).show();
+      return;
+    case 'reauth':
+      void mountReauth(deps).show(mode.challengeId);
+      return;
+    case 'accounts':
+      mountAccounts(deps).show();
+      return;
+    case 'reveal':
+      mountReveal(deps).show();
+      return;
+    case 'unlock':
+      void mountUnlock(deps).show(mode.returnTo);
+      return;
+  }
 }
```

Create `extension/src/unlock/screens/accounts.ts`:

```ts
import {addAccount, removeAccount} from '../accountsFlow';
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {ACCOUNTS, COMMON} from '../strings';
import {byId, setText, showScreen} from '../view/dom';

/**
 * The add-account form (spec §1.2 `accounts`, opened by the switcher's [Add account]): the password →
 * a re-encrypted envelope with one more account. Restyled into the design's chrome; remove stays the
 * B1b-1 form (B1b-2b designs the accounts manager). Rule 6 on both buttons (the page's one gate).
 */
export function mountAccounts(deps: PageDeps): {show(): void} {
  const field = byId<HTMLInputElement>('acc-password');
  const add = byId<HTMLButtonElement>('acc-add');
  const remove = byId<HTMLButtonElement>('acc-remove');
  const backoff = createWrongBackoff(deps.sleep);
  const say = (text: string) => setText(byId('acc-helper'), text);
  const render = () => {
    const busy = deps.gate.isBusy();
    add.disabled = busy;
    remove.disabled = busy;
    field.disabled = busy;
  };
  const factor = () => {
    const password = field.value;
    field.value = '';
    return {password, kdf: deps.kdf};
  };
  const store = {...deps.store, send: deps.send};
  const doAdd = () =>
    void exclusive(deps, render, async () => {
      const f = factor();
      say(ACCOUNTS.adding);
      say(ACCOUNTS.outcome[await backoff.run(() => addAccount(store, f), () => say(COMMON.waitConfirm))]);
    });
  deps.gate.onIdle(render);
  add.addEventListener('click', doAdd);
  byId('acc-form').addEventListener('submit', e => {
    e.preventDefault();
    doAdd();
  });
  remove.addEventListener('click', () =>
    void exclusive(deps, render, async () => {
      const n = Number(byId<HTMLInputElement>('acc-remove-index').value);
      if (!Number.isSafeInteger(n) || n < 1) return say(ACCOUNTS.whichToRemove);
      const f = factor();
      say(ACCOUNTS.removing);
      say(ACCOUNTS.outcome[await backoff.run(() => removeAccount(store, f, n - 1), () => say(COMMON.waitConfirm))]);
    }),
  );
  return {
    show() {
      showScreen('v-accounts');
      render();
      field.focus();
    },
  };
}
```

Create `extension/src/unlock/screens/reveal.ts`:

```ts
import {createWrongBackoff} from '../orchestrate';
import {exclusive, type PageDeps} from '../page';
import {runReveal} from '../revealFlow';
import {COMMON, REVEAL} from '../strings';
import {byId, h, setText, showScreen} from '../view/dom';

/**
 * The B1b-1 reveal form (spec §1.2 `reveal`), restyled with the tokens only — B1b-2b builds the
 * designed screen. The phrase is shown after a proof, as text, and leaves the DOM on [Hide], on
 * leaving the page and when the tab is hidden: it comes back only with a new proof.
 */
export function mountReveal(deps: PageDeps): {show(): void} {
  const field = byId<HTMLInputElement>('rev-password');
  const showBtn = byId<HTMLButtonElement>('rev-show');
  const list = byId('rev-words');
  const backoff = createWrongBackoff(deps.sleep);
  const say = (text: string) => setText(byId('rev-helper'), text);
  const hide = () => list.replaceChildren();
  const render = () => {
    showBtn.disabled = deps.gate.isBusy();
    field.disabled = deps.gate.isBusy();
  };
  const reveal = () =>
    void exclusive(deps, render, async () => {
      const password = field.value;
      field.value = '';
      hide();
      say(REVEAL.checking);
      const outcome = await backoff.run(async () => {
        const r = await runReveal({readEnvelope: deps.store.readEnvelope, send: deps.send}, {password, kdf: deps.kdf});
        if (r.outcome === 'shown') list.replaceChildren(...r.words.map(w => h('li', '', w)));
        return r.outcome;
      }, () => say(COMMON.waitConfirm));
      say(REVEAL.outcome[outcome]);
    });
  deps.gate.onIdle(render);
  showBtn.addEventListener('click', reveal);
  byId('rev-form').addEventListener('submit', e => {
    e.preventDefault();
    reveal();
  });
  byId('rev-hide').addEventListener('click', () => {
    hide();
    say('');
  });
  deps.onLeave(hide);
  return {
    show() {
      showScreen('v-reveal');
      render();
      field.focus();
    },
  };
}
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 478cdf9..d9580eb 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -152,6 +152,42 @@ export const RETRY = {
   storeFailed: 'The new wallet was not saved. Try again.',
 } as const;
 
+/** The add-account form (the B1b-1 words, kept). */
+export const ACCOUNTS = {
+  adding: 'Adding an account…',
+  removing: 'Removing the account…',
+  whichToRemove: 'Enter the number of the account to remove (1, 2, …).',
+  outcome: {
+    done: 'Done. The accounts are updated.',
+    'done-locked': 'The accounts were changed, and the wallet has been locked. Unlock it to use them.',
+    'done-not-locked': 'The accounts were changed, but the wallet could not be locked. Lock it now from the Noctura menu.',
+    wrong: 'That did not confirm it.',
+    'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
+    damaged: "This wallet's stored data is damaged.",
+    'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
+    'no-wallet': 'No wallet on this browser yet.',
+    'cli-single': 'A Solana CLI wallet has exactly one account.',
+    'last-account': 'The last account cannot be removed.',
+    'no-such-account': 'There is no account with that number.',
+    'too-many-accounts': 'This wallet already has the most accounts it can hold.',
+    failed: 'Something went wrong.',
+  },
+} as const;
+
+/** The reveal form (the B1b-1 words, kept). */
+export const REVEAL = {
+  checking: 'Checking…',
+  outcome: {
+    shown: 'Write them down, in order, and keep them offline. Noctura never copies them anywhere.',
+    wrong: 'That did not confirm it.',
+    'not-unlocked': 'The wallet is locked. Unlock it first, then try again.',
+    'mismatch-locked': 'That did not match this wallet, so the wallet has been locked.',
+    damaged: "This wallet's stored data is damaged.",
+    'no-wallet': 'No wallet on this browser yet.',
+    failed: 'Something went wrong. Try again.',
+  },
+} as const;
+
 /** #6 biometric-setup → passkey (D9). */
 export const PASSKEY = {
   adding: 'Waiting for your passkey…',
```

Modify `extension/src/unlock/unlock.css`:

```diff
diff --git a/extension/src/unlock/unlock.css b/extension/src/unlock/unlock.css
index 8a998db..dd9aee0 100644
--- a/extension/src/unlock/unlock.css
+++ b/extension/src/unlock/unlock.css
@@ -318,3 +318,21 @@
 .vlt-warning {
   color: var(--warning);
 }
+
+/* The B1b-1 accounts and reveal forms, in tokens only (B1b-2b designs both screens). */
+.vlt-stack {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-3);
+}
+.vlt-words {
+  display: grid;
+  grid-template-columns: repeat(2, 1fr);
+  grid-auto-flow: column;
+  grid-template-rows: repeat(12, auto);
+  gap: var(--space-2) var(--space-4);
+  margin: 0 var(--space-5);
+  padding-left: var(--space-5);
+  font: 500 14px/22px var(--font-mono);
+  color: var(--fg-primary);
+}
```

Modify `extension/unlock.html`:

```diff
diff --git a/extension/unlock.html b/extension/unlock.html
index 8dae391..68c79a9 100644
--- a/extension/unlock.html
+++ b/extension/unlock.html
@@ -91,42 +91,6 @@
         </div>
       </section>
 
-      <section id="import" hidden>
-        <h1>Import a wallet</h1>
-        <label for="phrase">Recovery phrase (12 or 24 words)</label>
-        <textarea id="phrase" autocomplete="off" autocapitalize="none" spellcheck="false"></textarea>
-        <label for="imp-password">Password (at least 12 characters)</label>
-        <input id="imp-password" type="password" autocomplete="new-password" minlength="12" />
-        <label for="imp-password2">Repeat the password</label>
-        <input id="imp-password2" type="password" autocomplete="new-password" minlength="12" />
-        <button id="import-btn" type="button">Import</button>
-        <div id="choose" hidden>
-          <p id="choose-why"></p>
-          <button id="choose-slip10" type="button">Standard (Phantom/Solflare)</button>
-          <button id="choose-cli" type="button">Solana CLI (solana-keygen)</button>
-        </div>
-      </section>
-      <section id="accounts" hidden>
-        <h1>Accounts</h1>
-        <label for="acc-password">Password</label>
-        <input id="acc-password" type="password" autocomplete="current-password" minlength="12" />
-        <button id="add-account" type="button">Add an account</button>
-        <label for="remove-index">Account number to remove</label>
-        <input id="remove-index" type="number" min="1" />
-        <button id="remove-account" type="button">Remove the account</button>
-      </section>
-      <section id="reveal" hidden>
-        <h1>Your recovery phrase</h1>
-        <p>Anyone who sees these words can take everything in this wallet. There is no copy button, on purpose.</p>
-        <form id="reveal-form">
-          <label for="reveal-password">Password</label>
-          <input id="reveal-password" type="password" autocomplete="current-password" minlength="12" required />
-          <button id="reveal-btn" type="submit">Show the phrase</button>
-        </form>
-        <ol id="reveal-words"></ol>
-        <button id="reveal-hide" type="button">Hide</button>
-      </section>
-      <p id="status" role="status"></p>
       <!-- #3 seed-display, its pre-reveal gate (spec §3.3): the word grid is not in the DOM until the gate is passed. -->
       <section id="v-seed-gate" class="screen s-seed-modal" hidden>
         <div id="sg-backdrop" class="modal-backdrop"></div>
@@ -474,6 +438,51 @@
         </div>
       </section>
 
+      <!-- The add-account form (spec §1.2 `accounts`): restyled; remove stays the B1b-1 form (B1b-2b designs the manager). -->
+      <section id="v-accounts" class="screen s-pin" hidden>
+        <div class="top-bar">
+          <span class="title noc-overline vlt-muted">Accounts</span>
+        </div>
+        <div class="pin-head">
+          <div class="vlt-lock-tile" aria-hidden="true"><svg width="28" height="28"><use href="#i-key" /></svg></div>
+          <h1 class="noc-h1">Accounts</h1>
+          <form id="acc-form" class="vlt-field-row">
+            <input id="acc-password" class="vlt-input" type="password" autocomplete="current-password" aria-label="Password" />
+          </form>
+        </div>
+        <p id="acc-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        <div class="vlt-pad vlt-stack">
+          <label for="acc-remove-index" class="noc-body-sm vlt-lede">Account number to remove</label>
+          <input id="acc-remove-index" class="vlt-input" type="number" min="1" />
+          <button id="acc-remove" type="button" class="btn btn-secondary">Remove the account</button>
+        </div>
+        <div class="pin-spacer"></div>
+        <div class="sticky-bar">
+          <button id="acc-add" type="button" class="btn btn-primary">Add an account</button>
+        </div>
+      </section>
+
+      <!-- The B1b-1 reveal form (spec §1.2 `reveal`): restyled with the tokens only; B1b-2b builds the designed screen. -->
+      <section id="v-reveal" class="screen s-pin" hidden>
+        <div class="top-bar">
+          <span class="title noc-overline vlt-muted">Recovery phrase</span>
+        </div>
+        <div class="pin-head">
+          <h1 class="noc-h1">Your recovery phrase</h1>
+          <p class="noc-body vlt-lede">Anyone who sees these words can take everything in this wallet. There is no copy button, on purpose.</p>
+          <form id="rev-form" class="vlt-field-row">
+            <input id="rev-password" class="vlt-input" type="password" autocomplete="current-password" aria-label="Password" />
+          </form>
+        </div>
+        <p id="rev-helper" class="noc-caption pin-helper" aria-live="polite"></p>
+        <ol id="rev-words" class="vlt-words"></ol>
+        <div class="pin-spacer"></div>
+        <div class="sticky-bar">
+          <button id="rev-show" type="button" class="btn btn-primary">Show the phrase</button>
+          <button id="rev-hide" type="button" class="btn btn-secondary">Hide</button>
+        </div>
+      </section>
+
     </main>
     <script type="module" src="./src/unlock/main.ts"></script>
   </body>
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run scripts/__tests__/check-vault-isolation.test.mjs src/unlock/__tests__/accountsReveal.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 97 passed (97) Tests 1236 passed (1236).

- [ ] **Step 5: Build, gates, and every E2E spec so far.**

Run: `npm run build && npm run gates && npx playwright test`
Expected: every gate ok; 10 passed.

- [ ] **Step 6: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- the phrase outlives a hidden tab → RED Tests  1 failed | 12 passed (13)
- ?mode=forgot shows #9 → RED Tests  1 failed | 12 passed (13)

- [ ] **Step 7: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `accounts-form`, `reveal-form`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 8: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/scripts/__tests__/check-vault-isolation.test.mjs extension/src/unlock/__tests__/accountsReveal.test.ts extension/src/unlock/modes.ts extension/src/unlock/screens/accounts.ts extension/src/unlock/screens/reveal.ts extension/src/unlock/strings.ts extension/src/unlock/unlock.css extension/unlock.html
git commit -m "feat(extension): the accounts and reveal forms in the design’s chrome; one dispatcher; the boundary covers every vault screen" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 15: The UI tab’s hand-over routes: #7 at `#/created`, the resume stand-in at `#/send/resume?account=…`, a quiet provider

**Files:**
- Modify: `extension/src/app/App.tsx`
- Modify: `extension/src/app/WalletContext.tsx`
- Create: `extension/src/app/__tests__/Created.test.tsx`
- Modify: `extension/src/app/__tests__/Switcher.test.tsx`
- Modify: `extension/src/app/__tests__/appHarness.tsx`
- Modify: `extension/src/app/__tests__/harness.tsx`
- Modify: `extension/src/app/__tests__/links.test.ts`
- Modify: `extension/src/app/__tests__/router.test.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/platform.ts`
- Modify: `extension/src/app/router.ts`
- Create: `extension/src/app/screens/Created.tsx`
- Create: `extension/src/app/screens/Resume.tsx`
- Modify: `extension/src/app/ui/ExtIcon.tsx`
- Create: `extension/src/app/ui/useCloseTab.ts`

**Interfaces:**
- Consumes: plan 1's `App`, `WalletProvider`, `router.ts`, `platform.ts`, `useCopy`, `AddressGroups`, `ExtIcon`.
- Produces: `src/app/router.ts`: `Route` gains `{screen: 'created'}` and `{screen: 'resume'; account: string}`; `TAB_ONLY`; `firstRoute(surface: Surface = 'popup', hash = ''): Route[]`; `App` prop `hash`; `WalletProvider` prop `quiet`; `Platform.navigate(page: ExtensionPage)` and the pages `'unlock.html?mode=unlock&return=created' | 'unlock.html?mode=unlock&return=imported' | 'unlock.html?mode=import&source=retry'`; `src/app/ui/useCloseTab.ts`: `CLOSE_CHECK_MS`, `useCloseTab(platform): {refused: boolean; close(): void}`; `src/app/screens/Created.tsx`: `Created`, `READY_LINE`; `src/app/screens/Resume.tsx`: `Resume`; `ExtIcon` gains `'arrow-right'`; test harness: `Wallet.platform.navigated`, `Wallet.transport`, `renderApp({hash, spy})`

Spec §1.6, §3.7, §12 (D10). The tab reads its first route once from `location.hash` (`firstRoute(surface, hash)`): `#/created` → #7, `#/send/resume?account=<address>` → the stand-in, anything else (and the popup always) → #11; the hash only chooses a screen and the account must be an address. These routes are **first routes only** — the reducer still refuses to push them — and the shell renders them before the lock gate (they show their own locked and no-wallet states). Their provider is **quiet** (`wallet.state` only; Scope 16). #7: the 96 px ring, "Wallet created" (`.noc-display`), "Your Solana address is below. Receive funds at any time.", "Solana address" + the full address in groups of four with the design's 48 px `.copy-btn` (honest "Copied"/"Copy failed"), "Copying puts the address on your clipboard. Noctura does not clear it afterwards." (adapted, §4), "Next steps" ("Fund the wallet with SOL or NOC", "Pin Noctura to your browser toolbar so it is one click away" — added), then "Wallet is ready — open the Noctura icon" (D10) and `[Close this tab]` (hidden when the browser keeps the tab). `created-locked`: "Wallet created. Unlock it to use it." + `[Unlock]` → `unlock.html?mode=unlock&return=created` **in this tab** (`platform.navigate`). The resume stand-in: "Open the Noctura icon to continue." + `[Close this tab]` — it reads, prepares and sends nothing (a message spy proves it).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Created.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderApp} from './appHarness';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {CLOSE_CHECK_MS} from '../ui/useCloseTab';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';

const SELECTORS = selectorsOf(UI_SHEETS);

// Spec §3.7: #7 in the UI tab at #/created, where the vault page hands over after #6.
describe('#7 onboard-success (wallet.html#/created)', () => {
  it('idle: the ring, "Wallet created", the full address in groups of four with a 48 px copy, the clipboard line, next steps, and the D10 line', async () => {
    await renderApp({surface: 'tab', hash: '#/created'});
    expect(await screen.findByText('Wallet created')).toBeTruthy();
    expect(screen.getByText('Your Solana address is below. Receive funds at any time.')).toBeTruthy();
    expect(screen.getByText('Solana address')).toBeTruthy();
    const groups = [...document.querySelectorAll('.addr-mono .addr-groups > span')].map(s => s.textContent);
    expect(groups.join('')).toBe(ACCOUNT.publicKey);
    expect(groups).toEqual(ACCOUNT.publicKey.match(/.{1,4}/g));
    expect(screen.getByRole('button', {name: 'Copy address'}).className).toBe('copy-btn');
    expect(screen.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeTruthy();
    expect(screen.getByText('Next steps')).toBeTruthy();
    expect([...document.querySelectorAll('.app-onb-steps li')].map(li => li.textContent)).toEqual(['Fund the wallet with SOL or NOC', 'Pin Noctura to your browser toolbar so it is one click away']);
    expect(screen.getByText('Wallet is ready — open the Noctura icon')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Close this tab'})).toBeTruthy();
    // Removed by decision: shielded send (D4), backup (D17), [Open wallet] (D10), the 30 s clear (§4).
    expect(document.body.textContent).not.toMatch(/shielded|backup|Open wallet|auto-clears|30 s/i);
    expect(screen.queryByRole('navigation', {name: 'Main'})).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-success')!, SELECTORS)).toEqual([]);
  });

  // The provider is quiet on a hand-over route: #7 shows the stored address, and the open sequence's
  // cache, pending, balance and price reads do not run (they would on #11).
  it('reads the state only: no cached, pending, balance or price message', async () => {
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: '#/created', spy: m => void sent.push((m as {type: string}).type)});
    await screen.findByText('Wallet created');
    await new Promise(r => setTimeout(r, 20));
    expect(new Set(sent)).toEqual(new Set(['wallet.state']));
  });

  it('negative control: the same wallet on #/home runs the open sequence', async () => {
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: '#/home', spy: m => void sent.push((m as {type: string}).type)});
    await screen.findByText('TOKENS');
    await waitFor(() => expect(sent).toEqual(expect.arrayContaining(['wallet.cached', 'wallet.balances', 'wallet.prices'])));
  });

  it('copy says "Copied" only when the clipboard took it', async () => {
    const writes: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {value: {writeText: async (t: string) => void writes.push(t)}, configurable: true});
    await renderApp({surface: 'tab', hash: '#/created'});
    fireEvent.click(await screen.findByRole('button', {name: 'Copy address'}));
    expect(await screen.findByRole('button', {name: 'Copied'})).toBeTruthy();
    expect(writes).toEqual([ACCOUNT.publicKey]);
  });

  it('[Close this tab] closes, and hides when the browser keeps the tab', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    try {
      const {platform} = await renderApp({surface: 'tab', hash: '#/created'});
      fireEvent.click(await screen.findByRole('button', {name: 'Close this tab'}));
      expect(platform.closed).toBe(1);
      await act(async () => {
        vi.advanceTimersByTime(CLOSE_CHECK_MS);
      });
      expect(screen.queryByRole('button', {name: 'Close this tab'})).toBeNull();
      expect(screen.getByText('Wallet is ready — open the Noctura icon')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('created-locked: "Wallet created. Unlock it to use it." + [Unlock] → the vault page, which returns here', async () => {
    const {platform} = await renderApp({surface: 'tab', hash: '#/created', unlocked: false});
    fireEvent.click(await screen.findByRole('button', {name: 'Unlock'}));
    expect(screen.getByText('Wallet created. Unlock it to use it.')).toBeTruthy();
    expect(platform.navigated).toEqual(['unlock.html?mode=unlock&return=created']);
    expect(platform.opened).toEqual([]);
  });
});

// Spec §12 plan 2: #10's hand-over lands here; until plan 3 makes it #20 it says where to go — and sends nothing.
describe('the resume stand-in (wallet.html#/send/resume?account=…)', () => {
  it('"Open the Noctura icon to continue." — it prepares, reads and sends nothing', async () => {
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: `#/send/resume?account=${ACCOUNT.publicKey}`, spy: m => void sent.push((m as {type: string}).type)});
    expect(await screen.findByText('Open the Noctura icon to continue.')).toBeTruthy();
    await new Promise(r => setTimeout(r, 20));
    expect(sent.filter(t => t !== 'wallet.state')).toEqual([]);
    expect(screen.getByRole('button', {name: 'Close this tab'})).toBeTruthy();
  });
});
```

Modify `extension/src/app/__tests__/Switcher.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/Switcher.test.tsx b/extension/src/app/__tests__/Switcher.test.tsx
index 251ee9d..8247a03 100644
--- a/extension/src/app/__tests__/Switcher.test.tsx
+++ b/extension/src/app/__tests__/Switcher.test.tsx
@@ -38,7 +38,7 @@ function stubEngine(accounts: Account[], selected: number): Engine {
 
 const stubPlatform = (): Platform & {opened: string[]} => {
   const opened: string[] = [];
-  return {opened, openPage: p => opened.push(p), closeWindow: () => undefined, version: () => '0.1.0'};
+  return {opened, openPage: p => opened.push(p), navigate: () => undefined, closeWindow: () => undefined, version: () => '0.1.0'};
 };
 
 // Spec §5.2 (D14): the switcher, derived from #43's sheet, opened from #11's account button.
```

Modify `extension/src/app/__tests__/appHarness.tsx`:

```diff
diff --git a/extension/src/app/__tests__/appHarness.tsx b/extension/src/app/__tests__/appHarness.tsx
index 016cfdd..c044ab4 100644
--- a/extension/src/app/__tests__/appHarness.tsx
+++ b/extension/src/app/__tests__/appHarness.tsx
@@ -1,10 +1,15 @@
 import {render} from '@testing-library/react';
 import {App} from '../App';
+import {createEngine} from '../engine';
 import {setupWallet, type Wallet, type WalletOptions} from './harness';
 
-/** The whole App — its own provider, router and tab bar — against the real background. */
-export async function renderApp(o: WalletOptions = {}): Promise<Wallet> {
+/**
+ * The whole App — its own provider, router and tab bar — against the real background. `hash` is the
+ * tab's location.hash; `spy` sees every message the app sends.
+ */
+export async function renderApp(o: WalletOptions & {hash?: string; spy?: (m: unknown) => void} = {}): Promise<Wallet> {
   const w = await setupWallet(o);
-  render(<App surface={o.surface ?? 'popup'} engine={w.engine} platform={w.platform} />);
-  return w;
+  const engine = o.spy === undefined ? w.engine : createEngine(m => (o.spy?.(m), w.transport(m)), async () => undefined);
+  render(<App surface={o.surface ?? 'popup'} engine={engine} platform={w.platform} hash={o.hash ?? ''} />);
+  return {...w, engine};
 }
```

Modify `extension/src/app/__tests__/harness.tsx`:

```diff
diff --git a/extension/src/app/__tests__/harness.tsx b/extension/src/app/__tests__/harness.tsx
index 79293ac..0f2832b 100644
--- a/extension/src/app/__tests__/harness.tsx
+++ b/extension/src/app/__tests__/harness.tsx
@@ -49,8 +49,10 @@ export function walletReader(over: Partial<SolanaReader> = {}): SolanaReader {
 export interface Wallet {
   ext: ReturnType<typeof fakeExt>;
   deps: ReturnType<typeof fakeDeps>;
-  platform: Platform & {opened: string[]; closed: number};
+  platform: Platform & {opened: string[]; navigated: string[]; closed: number};
   engine: Engine;
+  /** The real background, as the client's transport. */
+  transport: Transport;
 }
 
 export interface WalletOptions {
@@ -77,19 +79,24 @@ export async function setupWallet(o: WalletOptions = {}): Promise<Wallet> {
   const sleep = (ms: number) => (ms >= 2_000 ? new Promise<void>(() => undefined) : Promise.resolve());
   const deps = fakeDeps({reader: o.reader ?? walletReader(), sleep, ...o.deps});
   const opened: string[] = [];
+  const navigated: string[] = [];
   const platform = {
     opened,
+    navigated,
     closed: 0,
     openPage(page: string) {
       opened.push(page);
     },
+    navigate(page: string) {
+      navigated.push(page);
+    },
     closeWindow() {
       platform.closed += 1;
     },
     version: () => '0.1.0',
   };
   const transport: Transport = m => handleMessage(ext, m, POPUP, deps);
-  return {ext, deps, platform, engine: createEngine(transport, async () => undefined)};
+  return {ext, deps, platform, transport, engine: createEngine(transport, async () => undefined)};
 }
 
 /** One screen inside the real provider (the open sequence runs as in the popup). */
```

Modify `extension/src/app/__tests__/links.test.ts`:

```diff
diff --git a/extension/src/app/__tests__/links.test.ts b/extension/src/app/__tests__/links.test.ts
index 2566016..fb592b4 100644
--- a/extension/src/app/__tests__/links.test.ts
+++ b/extension/src/app/__tests__/links.test.ts
@@ -38,10 +38,17 @@ describe('links out of the UI', () => {
     }
   });
 
-  it('no page navigation but the explorer link: no location.href / .assign( / .replace( / bare location =', () => {
+  // Plan 2: the UI tab hands over to the vault page in the same tab (#7's and #40's [Unlock], #40's
+  // [Try a different seed]) — through platform.ts's navigate(), whose target is the closed ExtensionPage list.
+  it('no page navigation but the explorer link and platform.ts’s navigate(): no location.href / .assign( / .replace( / bare location =', () => {
     for (const {path, text} of sources) {
+      if (path === 'platform.ts') continue;
       expect(`${path}: ${LOCATION_REDIRECT.test(text)}`).toBe(`${path}: false`);
     }
+    const platform = sources.find(s => s.path === 'platform.ts')?.text ?? '';
+    expect([...platform.matchAll(new RegExp(LOCATION_REDIRECT, 'g'))].map(m => m[0])).toEqual(['location.assign(']);
+    expect(platform).toMatch(/navigate: page => location\.assign\(page\)/);
+    expect(platform).toMatch(/navigate\(page: ExtensionPage\): void;/);
   });
 
   it('no URL but Solscan’s and the extension’s own pages', () => {
```

Modify `extension/src/app/__tests__/router.test.ts`:

```diff
diff --git a/extension/src/app/__tests__/router.test.ts b/extension/src/app/__tests__/router.test.ts
index 1716d72..8e8c42b 100644
--- a/extension/src/app/__tests__/router.test.ts
+++ b/extension/src/app/__tests__/router.test.ts
@@ -1,15 +1,13 @@
 // @vitest-environment happy-dom
-import {SCREENS, firstRoute, routeReducer, type Route} from '../router';
+import {SCREENS, TAB_ONLY, firstRoute, routeReducer, type Route} from '../router';
 
 const HOME: Route[] = [{screen: 'tab', tab: 'home'}];
 
-// Spec §1.6: an in-memory stack; "No hash causes an action." Review M8: resume (§1.6 step 3) is absent
-// in plan 1 by design — so no route may lead into the send flow or a resumed send.
-describe('the router (plan 1)', () => {
-  afterEach(() => {
-    window.location.hash = '';
-  });
+const ADDR = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
 
+// Spec §1.6: an in-memory stack; "No hash causes an action." No route leads into the send flow until
+// plan 3; the resume hand-over is a plan-2 stand-in that only says where to go.
+describe('the router', () => {
   it('push, pop (never below the first route), and a tab resets the stack', () => {
     const s1 = routeReducer(HOME, {type: 'push', route: {screen: 'receive'}});
     expect(s1).toEqual([...HOME, {screen: 'receive'}]);
@@ -18,8 +16,10 @@ describe('the router (plan 1)', () => {
     expect(routeReducer([...s1, {screen: 'about'}], {type: 'tab', tab: 'activity'})).toEqual([{screen: 'tab', tab: 'activity'}]);
   });
 
-  it("plan 1's screens are a closed list with no send or resume", () => {
+  it('the pushable screens are a closed list with no send; the hand-over screens are first routes only', () => {
     expect([...SCREENS].sort()).toEqual(['about', 'receive', 'tab', 'tx']);
+    expect([...TAB_ONLY].sort()).toEqual(['created', 'resume']);
+    for (const route of [{screen: 'created'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
   });
 
   it.each(['send', 'resume', 'send/resume', 'confirm'])('refuses a pushed "%s" route: the stack is unchanged', screen => {
@@ -32,13 +32,22 @@ describe('the router (plan 1)', () => {
     expect(routeReducer(HOME, {type: 'tab', tab: 'send' as unknown as 'home'})).toBe(HOME);
   });
 
-  it.each(['', '#/home', '#/send', '#/send/resume', '#/resume?id=1', '#/tx/abc', '#/about'])('the first route for hash "%s" is Home: a hash never acts', hash => {
-    window.location.hash = hash;
+  it.each(['', '#/home', '#/send', '#/send/resume', '#/resume?id=1', '#/tx/abc', '#/about', '#/send/resume?account=', '#/send/resume?account=not-an-address', `#/send/resume?account=${ADDR}&amount=1`])(
+    'the tab’s first route for hash "%s" is Home: a hash never acts',
+    hash => {
+      expect(firstRoute('tab', hash)).toEqual(HOME);
+    },
+  );
+
+  it('the tab reads #/created (#7) and #/send/resume?account=<address> (the plan-2 stand-in); the popup ignores the hash', () => {
+    expect(firstRoute('tab', '#/created')).toEqual([{screen: 'created'}]);
+    expect(firstRoute('tab', `#/send/resume?account=${ADDR}`)).toEqual([{screen: 'resume', account: ADDR}]);
+    expect(firstRoute('popup', '#/created')).toEqual(HOME);
     expect(firstRoute()).toEqual(HOME);
   });
 
   it('the Route type itself has no send screen', () => {
-    // @ts-expect-error — plan 1's Route has no 'send' screen (tsc fails this file if one is added).
+    // @ts-expect-error — plan 2's Route has no 'send' screen (tsc fails this file if one is added).
     const r: Route = {screen: 'send'};
     expect(r.screen).toBe('send');
   });
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/Created.test.tsx src/app/__tests__/Switcher.test.tsx src/app/__tests__/appHarness.tsx src/app/__tests__/harness.tsx src/app/__tests__/links.test.ts src/app/__tests__/router.test.ts`
Expected (dry run): FAIL — Test Files 3 failed | 1 passed (4) Tests 3 failed | 33 passed (36) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/App.tsx`:

```diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index fcaefdb..d494d57 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -2,7 +2,7 @@ import {useEffect, useLayoutEffect, useReducer, useRef, useState} from 'react';
 import {WalletProvider, useWallet, type Surface} from './WalletContext';
 import {createEngine, type Engine, type HistoryItem} from './engine';
 import {browserPlatform, type Platform} from './platform';
-import {firstRoute, routeReducer} from './router';
+import {TAB_ONLY, firstRoute, routeReducer, type Route} from './router';
 import {TabBar} from './ui/TabBar';
 import {Home} from './screens/Home';
 import {Locked} from './screens/Locked';
@@ -13,10 +13,12 @@ import {Activity} from './screens/Activity';
 import {TxDetail} from './screens/TxDetail';
 import {Settings} from './screens/Settings';
 import {About} from './screens/About';
+import {Created} from './screens/Created';
+import {Resume} from './screens/Resume';
 
-function Shell() {
+function Shell({first}: {first: Route[]}) {
   const m = useWallet();
-  const [stack, go] = useReducer(routeReducer, undefined, firstRoute);
+  const [stack, go] = useReducer(routeReducer, first);
   const [accounts, setAccounts] = useState(false);
   const [txItems, setTxItems] = useState<Record<string, HistoryItem>>({});
   const route = stack[stack.length - 1] ?? {screen: 'tab', tab: 'home'};
@@ -40,6 +42,10 @@ function Shell() {
   }, [stack.length, accounts]);
 
   if (m.phase === 'loading') return <div className="app-content" aria-busy="true" />;
+  // The UI tab's hand-over screens show their own locked and no-wallet states (§3.7, §3.12).
+  if (route.screen === 'created' || route.screen === 'resume') {
+    return <main className="app-content">{route.screen === 'created' ? <Created /> : <Resume />}</main>;
+  }
   if (m.phase === 'no-wallet') return <NoWallet />;
   if (m.phase === 'locked') return <Locked />;
 
@@ -80,13 +86,16 @@ function Shell() {
 }
 
 /** The popup (412 × 600) and the tab (wallet.html, a 412 px column) are one app (spec §1.1). */
-export function App({surface, engine, platform = browserPlatform}: {surface: Surface; engine?: Engine; platform?: Platform}) {
+export function App({surface, engine, platform = browserPlatform, hash = typeof location === 'undefined' ? '' : location.hash}: {surface: Surface; engine?: Engine; platform?: Platform; hash?: string}) {
   // One client for the life of the page: the provider's effects key on it.
   const [client] = useState<Engine>(() => engine ?? createEngine());
+  // The first route is read once (§1.6): the tab's hash chooses a screen, and never acts.
+  const [first] = useState<Route[]>(() => firstRoute(surface, hash));
+  const handOver = TAB_ONLY.has(first[0]?.screen ?? '');
   return (
     <div className={`app app-${surface}`}>
-      <WalletProvider engine={client} platform={platform} surface={surface}>
-        <Shell />
+      <WalletProvider engine={client} platform={platform} surface={surface} quiet={handOver}>
+        <Shell first={first} />
       </WalletProvider>
     </div>
   );
```

Modify `extension/src/app/WalletContext.tsx`:

```diff
diff --git a/extension/src/app/WalletContext.tsx b/extension/src/app/WalletContext.tsx
index aae3ebc..87f5f50 100644
--- a/extension/src/app/WalletContext.tsx
+++ b/extension/src/app/WalletContext.tsx
@@ -99,7 +99,25 @@ const online = (): boolean => (typeof navigator === 'undefined' ? true : navigat
  * while a send of this account is open, and activity.ping on user input at most every 30 s. Nothing
  * else reads the network by itself: refresh is on open and on the refresh button (D2).
  */
-export function WalletProvider({engine, platform, surface, now = systemNow, children}: {engine: Engine; platform: Platform; surface: Surface; now?: () => number; children: ReactNode}) {
+export function WalletProvider({
+  engine,
+  platform,
+  surface,
+  now = systemNow,
+  quiet = false,
+  children,
+}: {
+  engine: Engine;
+  platform: Platform;
+  surface: Surface;
+  now?: () => number;
+  /**
+   * The UI tab's hand-over screens (#7, #40, the resume stand-in): the state only — no cached, pending,
+   * balance or price read on open. #40 reads what it shows itself; #7 reads nothing from the network.
+   */
+  quiet?: boolean;
+  children: ReactNode;
+}) {
   const [phase, setPhaseState] = useState<Phase>('loading');
   const phaseRef = useRef<Phase>('loading');
   const setPhase = useCallback((p: Phase) => {
@@ -267,12 +285,12 @@ export function WalletProvider({engine, platform, surface, now = systemNow, chil
       // Read again on open, on unlock, and when the selected account changed (a select here, or an
       // account list changed elsewhere) — otherwise the 5 s poll only watches the lock.
       const key = w.accounts.find(x => x.index === w.selected)?.publicKey ?? null;
-      if (!wasUnlocked || fresh || key !== shownKey.current) {
+      if (!quiet && (!wasUnlocked || fresh || key !== shownKey.current)) {
         shownKey.current = key;
         await openUnlocked(w);
       }
     },
-    [engine, openUnlocked, setPhase],
+    [engine, openUnlocked, setPhase, quiet],
   );
 
   const reload = useCallback(() => applyState(true), [applyState]);
```

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 7147d07..d2ee2e2 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -404,3 +404,46 @@ a.btn {
 .s8-sheet .grabber-hit .grabber {
   display: block;
 }
+
+/* #7 and #40 in the UI tab (plan 2): the mockups' inline spacing, as classes. */
+.app-onb-title {
+  margin: 0 0 var(--space-2);
+}
+.app-onb-lede {
+  max-width: 300px;
+  margin: 0 auto;
+}
+.app-onb-eyebrow {
+  margin-bottom: 6px;
+}
+.app-onb-help {
+  margin-top: var(--space-3);
+}
+.app-onb-next {
+  margin: var(--space-3) var(--space-5);
+}
+.app-onb-steps {
+  list-style: none;
+  margin: 0;
+  padding: 0;
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-2);
+}
+.app-onb-steps li {
+  display: flex;
+  gap: var(--space-3);
+  align-items: flex-start;
+}
+.app-onb-arrow {
+  color: var(--accent);
+  flex: 0 0 18px;
+  line-height: 22px;
+  padding-top: 2px;
+}
+.app-onb-grow {
+  flex: 1 1 auto;
+}
+.app-content .s-success .copy-btn {
+  cursor: pointer;
+}
```

Modify `extension/src/app/platform.ts`:

```diff
diff --git a/extension/src/app/platform.ts b/extension/src/app/platform.ts
index 803cfb3..6802cfd 100644
--- a/extension/src/app/platform.ts
+++ b/extension/src/app/platform.ts
@@ -1,6 +1,6 @@
 /**
- * The popup's and the tab's calls to the browser (spec B1b-2a §1.3): open an extension page, close
- * this window, read the version. Never storage (scripts/check-vault-isolation.mjs forbids it outside
+ * The popup's and the tab's calls to the browser (spec B1b-2a §1.3): open an extension page (in a new
+ * tab, or this tab), close this window, read the version. Never storage (scripts/check-vault-isolation.mjs forbids it outside
  * the background) and never a runtime listener (only the background listens). The one external link,
  * Solscan, is an <a> (screens/TxDetail.tsx), not a call here.
  */
@@ -10,10 +10,20 @@ interface PlatformApi {
 }
 
 /** Every extension page the UI opens. A closed list: nothing here builds a URL from data. */
-export type ExtensionPage = 'unlock.html?mode=welcome' | 'unlock.html?mode=unlock' | 'unlock.html?mode=forgot' | 'unlock.html?mode=accounts';
+export type ExtensionPage =
+  | 'unlock.html?mode=welcome'
+  | 'unlock.html?mode=unlock'
+  | 'unlock.html?mode=forgot'
+  | 'unlock.html?mode=accounts'
+  | 'unlock.html?mode=unlock&return=created'
+  | 'unlock.html?mode=unlock&return=imported'
+  | 'unlock.html?mode=import&source=retry';
 
 export interface Platform {
+  /** A new tab (the popup closes itself after). */
   openPage(page: ExtensionPage): void;
+  /** This tab moves to the page (the UI tab's #7 and #40 hand over to the vault page and back). */
+  navigate(page: ExtensionPage): void;
   closeWindow(): void;
   version(): string;
 }
@@ -29,6 +39,7 @@ export const browserPlatform: Platform = {
   openPage: page => {
     void Promise.resolve(api().tabs.create({url: api().runtime.getURL(page)})).catch((e: unknown) => console.warn('tab not opened', e));
   },
+  navigate: page => location.assign(page),
   closeWindow: () => window.close(),
   version: () => api().runtime.getManifest().version,
 };
```

Modify `extension/src/app/router.ts`:

```diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index c4e293e..ffca37a 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -1,18 +1,29 @@
 import type {Tab} from './ui/TabBar';
+import type {Surface} from './WalletContext';
 
 /**
  * In-memory navigation (spec §1.6): a stack of routes in a reducer — push, pop, replace, back to a
  * tab. No router library, and no route that acts: every value a screen shows comes from the
- * background. Plan 1's routes only; plan 3 adds the send flow.
+ * background. Plan 3 adds the send flow.
  *
- * Resume (§1.6 step 3) is absent in plan 1 by design (review M8): there is no send screen, so no route
- * may lead into a send or a resumed one. The list below is closed, and the reducer refuses anything
- * outside it — a forged or future route leaves the stack as it was rather than dangling.
+ * The pushable screens are a closed list, and the reducer refuses anything outside it — a forged or
+ * future route leaves the stack as it was rather than dangling. The UI tab's hand-over screens (#7
+ * `created` and plan 2's `resume` stand-in) are first routes only: chosen by the tab's hash, never
+ * pushed.
  */
-export type Route = {screen: 'tab'; tab: Tab} | {screen: 'receive'} | {screen: 'tx'; signature: string} | {screen: 'about'};
+export type Route =
+  | {screen: 'tab'; tab: Tab}
+  | {screen: 'receive'}
+  | {screen: 'tx'; signature: string}
+  | {screen: 'about'}
+  | {screen: 'created'}
+  | {screen: 'resume'; account: string};
 export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab};
 
 export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about']);
+/** The UI tab's hand-over screens: a first route from `location.hash`, never pushed. */
+export const TAB_ONLY: ReadonlySet<string> = new Set<Route['screen']>(['created', 'resume']);
+const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const TABS: ReadonlySet<string> = new Set<Tab>(['home', 'activity', 'settings']);
 
 function isRoute(r: unknown): r is Route {
@@ -36,10 +47,16 @@ export function routeReducer(stack: Route[], action: RouteAction): Route[] {
 }
 
 /**
- * The tab surface's first route, from `location.hash`. Plan 1 has one route, `#/home` (#11 in a
- * column); any other hash shows it too — `#/send`, `#/send/resume` included. The hash only ever
- * chooses a screen — it never acts.
+ * The first route (spec §1.6). The popup always starts at #11. The tab reads `location.hash`: `#/created`
+ * (#7), `#/send/resume?account=<address>` (the hand-over from #10 — plan 2 shows
+ * "Open the Noctura icon to continue." there; plan 3 makes it #20) and `#/home`; anything else is #11
+ * too. The hash only ever chooses a screen — it never acts, and the account is only an address.
  */
-export function firstRoute(): Route[] {
+export function firstRoute(surface: Surface = 'popup', hash = ''): Route[] {
+  if (surface === 'tab') {
+    if (hash === '#/created') return [{screen: 'created'}];
+    const resume = /^#\/send\/resume\?account=([^&#]*)$/.exec(hash);
+    if (resume !== null && ADDRESS.test(resume[1] ?? '')) return [{screen: 'resume', account: resume[1] ?? ''}];
+  }
   return [{screen: 'tab', tab: 'home'}];
 }
```

Create `extension/src/app/screens/Created.tsx`:

```tsx
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {useWallet} from '../WalletContext';
import {ExtIcon} from '../ui/ExtIcon';
import {useCloseTab} from '../ui/useCloseTab';
import {useCopy} from '../ui/useCopy';
import {NoWallet} from './NoWallet';

/** D10, applied to #7 as to #40 (§11.8): a tab cannot reliably open the action popup. */
export const READY_LINE = 'Wallet is ready — open the Noctura icon';

/**
 * #7 onboard-success (spec §3.7), in the UI tab at `#/created` — where the vault page hands over after
 * #6. The address comes from wallet.state (the envelope's public part, there while locked too); nothing
 * else is read. A wallet whose keys did not reach the background is `created-locked`: "Wallet created.
 * Unlock it to use it." + [Unlock] → the vault page, which comes back here (`return=created`).
 */
export function Created() {
  const m = useWallet();
  const [copied, copy] = useCopy();
  const tab = useCloseTab(m.platform);
  if (m.phase === 'no-wallet') return <NoWallet />;
  const account = m.wallet?.accounts.find(a => a.index === 0) ?? m.wallet?.accounts[0] ?? null;
  if (m.phase === 'locked' || account === null) {
    return (
      <div className="screen app-center">
        <p className="noc-body">Wallet created. Unlock it to use it.</p>
        <div className="app-center-actions">
          <button type="button" className="btn btn-primary" onClick={() => m.platform.navigate('unlock.html?mode=unlock&return=created')}>
            Unlock
          </button>
        </div>
      </div>
    );
  }
  const label = copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy address';
  return (
    <div className="screen s-success">
      <div className="hero">
        <div className="ring">
          <ExtIcon name="check" size={44} />
        </div>
        <div>
          <h1 className="noc-display app-onb-title">Wallet created</h1>
          <p className="noc-body app-muted app-onb-lede">Your Solana address is below. Receive funds at any time.</p>
        </div>
      </div>
      <div className="addr-card">
        <div className="noc-overline app-dim app-onb-eyebrow">Solana address</div>
        <div className="addr-row">
          <span className="noc-body addr-mono">
            <AddressGroups address={account.publicKey} />
          </span>
          <button type="button" className="copy-btn" aria-label={label} title={label} onClick={() => copy(account.publicKey)}>
            <ExtIcon name={copied === 'copied' ? 'check' : copied === 'failed' ? 'close' : 'copy'} size={20} />
          </button>
        </div>
        <div className="noc-caption app-dim app-onb-help">Copying puts the address on your clipboard. Noctura does not clear it afterwards.</div>
      </div>
      <div className="card app-onb-next">
        <div className="noc-overline app-dim app-onb-eyebrow">Next steps</div>
        <ul className="app-onb-steps">
          <li className="noc-body">
            <span className="app-onb-arrow">
              <ExtIcon name="arrow-right" size={18} />
            </span>
            Fund the wallet with SOL or NOC
          </li>
          <li className="noc-body">
            <span className="app-onb-arrow">
              <ExtIcon name="arrow-right" size={18} />
            </span>
            Pin Noctura to your browser toolbar so it is one click away
          </li>
        </ul>
      </div>
      <div className="app-onb-grow" />
      <div className="sticky-bar">
        <p className="noc-body app-center-text">{READY_LINE}</p>
        {tab.refused ? null : (
          <button type="button" className="btn btn-secondary" onClick={tab.close}>
            Close this tab
          </button>
        )}
      </div>
    </div>
  );
}
```

Create `extension/src/app/screens/Resume.tsx`:

```tsx
import {useWallet} from '../WalletContext';
import {useCloseTab} from '../ui/useCloseTab';

/**
 * `wallet.html#/send/resume?account=…` — where #10 hands over after a proven re-authentication (D38).
 * PLAN-2 STAND-IN (spec §12): until plan 3 makes this route #20 with a fresh preview and its one-tap
 * Send, it only says where to go. It reads nothing, prepares nothing and sends nothing; the prepared
 * send stays in the background for #20 (or expires there).
 */
export function Resume() {
  const {platform} = useWallet();
  const tab = useCloseTab(platform);
  return (
    <div className="screen app-center">
      <p className="noc-body">Open the Noctura icon to continue.</p>
      <div className="app-center-actions">
        {tab.refused ? null : (
          <button type="button" className="btn btn-secondary" onClick={tab.close}>
            Close this tab
          </button>
        )}
      </div>
    </div>
  );
}
```

Modify `extension/src/app/ui/ExtIcon.tsx`:

```diff
diff --git a/extension/src/app/ui/ExtIcon.tsx b/extension/src/app/ui/ExtIcon.tsx
index 892f625..08047d9 100644
--- a/extension/src/app/ui/ExtIcon.tsx
+++ b/extension/src/app/ui/ExtIcon.tsx
@@ -32,9 +32,16 @@ export type ExtIconName =
   | 'trend-up'
   | 'doc'
   | 'copy'
-  | 'swap';
+  | 'swap'
+  | 'arrow-right';
 
 const PATHS: Record<ExtIconName, ReactNode> = {
+  'arrow-right': (
+    <>
+      <path d="M5 12h14" />
+      <path d="m12 5 7 7-7 7" />
+    </>
+  ),
   'trend-up': (
     <>
       <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
```

Create `extension/src/app/ui/useCloseTab.ts`:

```ts
import {useEffect, useRef, useState} from 'react';
import type {Platform} from '../platform';

/** How long to wait before deciding the browser refused window.close() (the tab is still here). */
export const CLOSE_CHECK_MS = 500;

/**
 * [Close this tab] (#7, #40, the resume stand-in): window.close(), and the button hides when the tab is
 * still here a moment later — a browser may refuse to close a tab it did not open (spec §3.7).
 */
export function useCloseTab(platform: Platform): {refused: boolean; close(): void} {
  const [refused, setRefused] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return {
    refused,
    close: () => {
      platform.closeWindow();
      timer.current = setTimeout(() => setRefused(true), CLOSE_CHECK_MS);
    },
  };
}
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/app/__tests__/Created.test.tsx src/app/__tests__/Switcher.test.tsx src/app/__tests__/appHarness.tsx src/app/__tests__/harness.tsx src/app/__tests__/links.test.ts src/app/__tests__/router.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 98 passed (98) Tests 1247 passed (1247).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- the hand-over screens run the open sequence → RED Tests  2 failed | 5 passed (7)
- any account accepted in the resume hash → RED Tests  2 failed | 17 passed (19)
- Resume.tsx calls engine.send (M7) → RED Tests  1 failed | 6 passed (7)

- [ ] **Step 6: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `07-created`, `07-created-locked`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/app/App.tsx extension/src/app/WalletContext.tsx extension/src/app/__tests__/Created.test.tsx extension/src/app/__tests__/Switcher.test.tsx extension/src/app/__tests__/appHarness.tsx extension/src/app/__tests__/harness.tsx extension/src/app/__tests__/links.test.ts extension/src/app/__tests__/router.test.ts extension/src/app/app.css extension/src/app/platform.ts extension/src/app/router.ts extension/src/app/screens/Created.tsx extension/src/app/screens/Resume.tsx extension/src/app/ui/ExtIcon.tsx extension/src/app/ui/useCloseTab.ts
git commit -m "feat(extension): the UI tab’s hand-over routes — #7 at #/created and the resume stand-in that sends nothing; a quiet provider" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 16: #40 import-success at `#/imported` — what the wallet holds, every state, `[Try a different seed]` (D41)

**Files:**
- Modify: `extension/src/app/App.tsx`
- Create: `extension/src/app/__tests__/Imported.test.tsx`
- Modify: `extension/src/app/__tests__/format.test.ts`
- Modify: `extension/src/app/__tests__/router.test.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/format.ts`
- Modify: `extension/src/app/router.ts`
- Modify: `extension/src/app/screens/Home.tsx`
- Create: `extension/src/app/screens/Imported.tsx`

**Interfaces:**
- Consumes: Task 15; plan 1's `valuation`, `TOKEN_INFO`, `showAmount`, `showUsd`, `TokenTile`, `Skeleton`, `RefusedBanner`, `LockedButton`.
- Produces: `src/app/format.ts`: `approxSol(usd: number, solUsd: number): string` (Home uses it too); `src/app/screens/Imported.tsx`: `Imported`, `MAX_READ = 6`, `CLIPBOARD_LINE`; `Route` gains `{screen: 'imported'}`; `firstRoute('tab', '#/imported')`

Spec §3.12. `loading`: the ring + "Checking what this wallet holds…" + skeleton rows. Then up to six accounts' balances, one at a time, and the prices (Scope 14): `single-account` ("Wallet imported", "1 account · N tokens recovered. Welcome back.", "Total value recovered" + the market total — SOL + USDC + USDT, NOC outside it — and "≈ X SOL", **truncated, never rounded up** (plan-1 ruling L6, now one `approxSol` in `format.ts` shared with Home; plan-2 review M1), a row per token held with NOC's value "… at stage price", "Your wallet address" in groups of four + copy and, under it, #7's "Copying puts the address on your clipboard. Noctura does not clear it afterwards." (the carried rule; controller addition — confirmed by the owner 2026-10-01, M3), the D10 line + `[Close this tab]`); `multi-account` ("N accounts · M tokens recovered.", "across N accounts · ≈ X SOL", rows summed with "Solana · N accounts"; past `MAX_READ` the copy claims only what was read — "N accounts · M tokens recovered from the first 6." and "across the first 6 of N accounts", controller addition — confirmed by the owner 2026-10-01, M2); `no-assets-empty` — **only when every read succeeded** and all four tokens are zero on every account (R2-L5): the info ring, "Wallet imported · empty", the adapted sub, "Recovered" / "0 tokens" / "N account · address derivation succeeded", the three reasons with the engine's real paths (adapted), the address, "You can send SOL to this address to fund the wallet.", the D10 line and `[Try a different seed]` (`LockedButton`): it re-reads every account first; anything arrived → the funded state and the button gone; all still zero → `unlock.html?mode=import&source=retry` in this tab (a double click re-reads once and navigates once — rule 6, M6); `unreachable` ("Balances could not be read right now." + refresh — never "empty"); `refused` (the D26 banner, refresh disabled); `locked` ("Wallet imported. Unlock it to see what was recovered." + `[Unlock]` → `?mode=unlock&return=imported`).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Imported.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {fireEvent, screen, waitFor} from '@testing-library/react';
import {renderApp} from './appHarness';
import {ENV, walletReader} from './harness';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {deriveSessionAccounts} from '../../vault/accounts';

const M7 = 'legal winner thank year wave sausage worth useful legal winner thank yellow';

const SELECTORS = selectorsOf(UI_SHEETS);
const ONE = {...ENV, accounts: [ENV.accounts[0]]};
const styled = () => unstyledClasses(document.querySelector('.app-onb-imported')!, SELECTORS);
const zero = () => walletReader({getBalance: async () => 0n, getTokenAccountsByOwner: async () => []});

// Spec §3.12: #40 in the UI tab at #/imported.
describe('#40 import-success (wallet.html#/imported)', () => {
  it('single account: "Wallet imported", the market total and ≈ SOL, a row per token held (NOC at stage price), the address, the D10 line', async () => {
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT]});
    expect(await screen.findByText('Wallet imported')).toBeTruthy();
    expect(screen.getByText('1 account · 3 tokens recovered. Welcome back.')).toBeTruthy();
    expect(screen.getByText('Total value recovered')).toBeTruthy();
    // 62.4821 SOL × $150 + 740.21 USDC × $1 = $10,112.52 (NOC is outside the market total).
    expect(screen.getByText('$10,112.52')).toBeTruthy();
    // 10,112.52 / 150 = 67.4168…: truncated, never rounded up (M1).
    expect(screen.getByText('≈ 67.41 SOL')).toBeTruthy();
    const rows = [...document.querySelectorAll('.s8-token-row')].map(r => [r.querySelector('.pri')?.textContent, r.querySelector('.sec')?.textContent, r.querySelector('.amt')?.textContent, r.querySelector('.fiat')?.textContent]);
    expect(rows).toEqual([
      ['SOL', 'Solana', '62.4821', '$9,372.31'],
      ['NOC', 'Noctura', '4,200.00', '$630.42 at stage price'],
      ['USDC', 'USD Coin', '740.21', '$740.21'],
    ]);
    expect(screen.getByText('Your wallet address')).toBeTruthy();
    expect([...document.querySelectorAll('.s8-addr-chip .addr-groups > span')].map(s => s.textContent).join('')).toBe(ACCOUNT.publicKey);
    expect(screen.getByRole('button', {name: 'Copy address'})).toBeTruthy();
    expect(screen.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeTruthy();
    expect(screen.getByText('Wallet is ready — open the Noctura icon')).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Close this tab'})).toBeTruthy();
    expect(screen.queryByText('Try a different seed')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Open wallet|more tokens|BONK|JUP|v1_imported/);
    expect(styled()).toEqual([]);
  });

  it('multi account: summed rows "Solana · 2 accounts", "across 2 accounts · ≈ … SOL"; reads each account once, then the prices — nothing else', async () => {
    const sent: string[] = [];
    await renderApp({surface: 'tab', hash: '#/imported', spy: m => void sent.push((m as {type: string}).type)});
    expect(await screen.findByText('2 accounts · 3 tokens recovered.')).toBeTruthy();
    expect(screen.getByText('across 2 accounts · ≈ 134.83 SOL')).toBeTruthy();
    expect(screen.getByText('$20,225.05')).toBeTruthy();
    expect([...document.querySelectorAll('.s8-token-row .sec')].map(s => s.textContent)).toEqual(['Solana · 2 accounts', 'Noctura · 2 accounts', 'USD Coin · 2 accounts']);
    expect(sent.filter(t => t !== 'wallet.state')).toEqual(['wallet.balances', 'wallet.balances', 'wallet.prices']);
    expect(screen.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeTruthy();
    expect(styled()).toEqual([]);
  });

  // M2 (plan review): past MAX_READ the screen claims only the accounts it read.
  it('seven accounts: six read, and the copy says so — "recovered from the first 6", "across the first 6 of 7 accounts"', async () => {
    const session = await deriveSessionAccounts(M7, 'slip10', [0, 1, 2, 3, 4, 5, 6]);
    const env = {...ENV, accounts: session.map(a => ({index: a.index, name: `Account ${a.index + 1}`, publicKey: a.publicKey}))};
    const sent: {type: string; account?: string}[] = [];
    await renderApp({surface: 'tab', hash: '#/imported', env, accounts: session, spy: m => void sent.push(m as {type: string})});
    expect(await screen.findByText('7 accounts · 3 tokens recovered from the first 6.')).toBeTruthy();
    expect(screen.getByText(/^across the first 6 of 7 accounts · ≈ [\d.]+ SOL$/)).toBeTruthy();
    const reads = sent.filter(m => m.type === 'wallet.balances');
    expect(reads).toHaveLength(6);
    expect(reads.map(m => m.account)).toEqual(session.slice(0, 6).map(a => a.publicKey));
    expect(document.body.textContent).not.toMatch(/across 7 accounts|7 accounts · 3 tokens recovered\./);
  });

  it('no-assets-empty: only when every read succeeded — the info ring, the adapted copy, the real paths, [Try a different seed]', async () => {
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader: zero()});
    expect(await screen.findByText('Wallet imported · empty')).toBeTruthy();
    expect(screen.getByText("Your seed checked out, but this wallet holds none of the tokens Noctura shows yet. That's fine — go receive some.")).toBeTruthy();
    expect(screen.getByText('Recovered')).toBeTruthy();
    expect(screen.getByText('0 tokens')).toBeTruthy();
    expect(screen.getByText('1 account · address derivation succeeded')).toBeTruthy();
    expect(screen.getByText('A few reasons this can happen:')).toBeTruthy();
    expect([...document.querySelectorAll('.app-onb-reasons li')].map(li => li.textContent)).toEqual([
      'This is a fresh seed — never received any tokens',
      'You imported the wrong seed for this account',
      "Your assets are on a different derivation path (we check m/44'/501'/n'/0' for n = 0–4, and the Solana CLI key)",
    ]);
    expect(screen.getByText('You can send SOL to this address to fund the wallet.')).toBeTruthy();
    expect(screen.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeTruthy();
    expect(screen.getByText('Wallet is ready — open the Noctura icon')).toBeTruthy();
    expect(document.querySelector('.s8-success-hero .ring')?.className).toBe('ring app-onb-info');
    expect(styled()).toEqual([]);
  });

  it('rule 6: a double click on [Try a different seed] re-reads once and navigates once', async () => {
    const sent: string[] = [];
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader: zero(), spy: m => void sent.push((m as {type: string}).type)});
    const button = await screen.findByRole('button', {name: 'Try a different seed'});
    const before = sent.filter(t => t === 'wallet.balances').length;
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(platform.navigated).toEqual(['unlock.html?mode=import&source=retry']));
    expect(sent.filter(t => t === 'wallet.balances').length - before).toBe(1);
    expect(platform.navigated).toHaveLength(1);
  });

  it('[Try a different seed] re-reads first; all still zero → the vault page’s retry path (D41)', async () => {
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader: zero()});
    fireEvent.click(await screen.findByRole('button', {name: 'Try a different seed'}));
    await waitFor(() => expect(platform.navigated).toEqual(['unlock.html?mode=import&source=retry']));
  });

  it('[Try a different seed] when funds arrived: the funded state, the button gone, no navigation', async () => {
    let calls = 0;
    const reader = walletReader({getBalance: async () => (calls++ === 0 ? 0n : 5_000_000_000n), getTokenAccountsByOwner: async () => []});
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader});
    fireEvent.click(await screen.findByRole('button', {name: 'Try a different seed'}));
    expect(await screen.findByText('1 account · 1 token recovered. Welcome back.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: 'Try a different seed'})).toBeNull();
    expect(platform.navigated).toEqual([]);
  });

  it('a read that got no answer is "Balances could not be read right now." + refresh — never "empty"', async () => {
    let fail = true;
    const reader = walletReader({
      getBalance: async () => {
        if (fail) throw new RequestUnreachable('getBalance', 'offline');
        return 0n;
      },
      getTokenAccountsByOwner: async () => [],
    });
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader});
    expect(await screen.findByText('Balances could not be read right now.')).toBeTruthy();
    expect(screen.queryByText('Wallet imported · empty')).toBeNull();
    expect(styled()).toEqual([]);
    fail = false;
    fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
    expect(await screen.findByText('Wallet imported · empty')).toBeTruthy();
  });

  it('a 403: the D26 banner and the refresh disabled (nothing retries)', async () => {
    const reader = walletReader({
      getBalance: async () => {
        throw new RpcForbidden('getBalance');
      },
    });
    await renderApp({surface: 'tab', hash: '#/imported', env: ONE, accounts: [ACCOUNT], reader});
    expect(await screen.findByText('The server is not answering for now — try again in 10 minutes.')).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Refresh'}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('locked: "Wallet imported. Unlock it to see what was recovered." + [Unlock] → the vault page, back here', async () => {
    const {platform} = await renderApp({surface: 'tab', hash: '#/imported', unlocked: false});
    fireEvent.click(await screen.findByRole('button', {name: 'Unlock'}));
    expect(screen.getByText('Wallet imported. Unlock it to see what was recovered.')).toBeTruthy();
    expect(platform.navigated).toEqual(['unlock.html?mode=unlock&return=imported']);
  });
});
```

Modify `extension/src/app/__tests__/format.test.ts`:

```diff
diff --git a/extension/src/app/__tests__/format.test.ts b/extension/src/app/__tests__/format.test.ts
index 3c8ed7f..196c85c 100644
--- a/extension/src/app/__tests__/format.test.ts
+++ b/extension/src/app/__tests__/format.test.ts
@@ -1,8 +1,16 @@
-import {ago, agoLong, clock, dateSection, feeUsd, stamp, shortAddress, showAmount, showFee, showSol, twoGroups, usdParts} from '../format';
+import {ago, agoLong, approxSol, clock, dateSection, feeUsd, stamp, shortAddress, showAmount, showFee, showSol, twoGroups, usdParts} from '../format';
 import {valuation} from '../valuation';
 
 // The words and numbers the screens print, from one place.
 describe('format', () => {
+  // Plan-1 ruling L6, now shared by Home and #40 (plan-2 review M1): a SOL equivalent is truncated.
+  it('approxSol truncates to the cent of a SOL, never rounds up', () => {
+    expect(approxSol(10_112.52, 150)).toBe('≈ 67.41 SOL');
+    expect(approxSol(20_225.05, 150)).toBe('≈ 134.83 SOL');
+    expect(approxSol(299.99, 100)).toBe('≈ 2.99 SOL');
+    expect(approxSol(0, 150)).toBe('≈ 0.00 SOL');
+  });
+
   it('token amounts as the design prints them, truncated', () => {
     expect(showAmount('SOL', 62_482_199_999n)).toBe('62.4821');
     expect(showAmount('NOC', 4_200_000_000_000n)).toBe('4,200.00');
```

Modify `extension/src/app/__tests__/router.test.ts`:

```diff
diff --git a/extension/src/app/__tests__/router.test.ts b/extension/src/app/__tests__/router.test.ts
index 8e8c42b..50b3aa7 100644
--- a/extension/src/app/__tests__/router.test.ts
+++ b/extension/src/app/__tests__/router.test.ts
@@ -18,8 +18,8 @@ describe('the router', () => {
 
   it('the pushable screens are a closed list with no send; the hand-over screens are first routes only', () => {
     expect([...SCREENS].sort()).toEqual(['about', 'receive', 'tab', 'tx']);
-    expect([...TAB_ONLY].sort()).toEqual(['created', 'resume']);
-    for (const route of [{screen: 'created'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
+    expect([...TAB_ONLY].sort()).toEqual(['created', 'imported', 'resume']);
+    for (const route of [{screen: 'created'}, {screen: 'imported'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
   });
 
   it.each(['send', 'resume', 'send/resume', 'confirm'])('refuses a pushed "%s" route: the stack is unchanged', screen => {
@@ -39,8 +39,9 @@ describe('the router', () => {
     },
   );
 
-  it('the tab reads #/created (#7) and #/send/resume?account=<address> (the plan-2 stand-in); the popup ignores the hash', () => {
+  it('the tab reads #/created (#7), #/imported (#40) and #/send/resume?account=<address> (the plan-2 stand-in); the popup ignores the hash', () => {
     expect(firstRoute('tab', '#/created')).toEqual([{screen: 'created'}]);
+    expect(firstRoute('tab', '#/imported')).toEqual([{screen: 'imported'}]);
     expect(firstRoute('tab', `#/send/resume?account=${ADDR}`)).toEqual([{screen: 'resume', account: ADDR}]);
     expect(firstRoute('popup', '#/created')).toEqual(HOME);
     expect(firstRoute()).toEqual(HOME);
```

- [ ] **Step 2: Run them and watch them fail.**

Run: `npx vitest run src/app/__tests__/Imported.test.tsx src/app/__tests__/format.test.ts src/app/__tests__/router.test.ts`
Expected (dry run): FAIL — Test Files 3 failed (3) Tests 12 failed | 26 passed (38) (the modules this task adds do not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/App.tsx`:

```diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index d494d57..72ff760 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -14,6 +14,7 @@ import {TxDetail} from './screens/TxDetail';
 import {Settings} from './screens/Settings';
 import {About} from './screens/About';
 import {Created} from './screens/Created';
+import {Imported} from './screens/Imported';
 import {Resume} from './screens/Resume';
 
 function Shell({first}: {first: Route[]}) {
@@ -43,8 +44,8 @@ function Shell({first}: {first: Route[]}) {
 
   if (m.phase === 'loading') return <div className="app-content" aria-busy="true" />;
   // The UI tab's hand-over screens show their own locked and no-wallet states (§3.7, §3.12).
-  if (route.screen === 'created' || route.screen === 'resume') {
-    return <main className="app-content">{route.screen === 'created' ? <Created /> : <Resume />}</main>;
+  if (route.screen === 'created' || route.screen === 'imported' || route.screen === 'resume') {
+    return <main className="app-content">{route.screen === 'created' ? <Created /> : route.screen === 'imported' ? <Imported /> : <Resume />}</main>;
   }
   if (m.phase === 'no-wallet') return <NoWallet />;
   if (m.phase === 'locked') return <Locked />;
```

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index d2ee2e2..c8b7e7f 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -447,3 +447,47 @@ a.btn {
 .app-content .s-success .copy-btn {
   cursor: pointer;
 }
+
+/* #40: the mockup's inline spacing and the empty state's info ring (index.html #40, no-assets-empty). */
+.app-onb-imported {
+  padding: var(--space-3) var(--space-5) 0;
+}
+.s8-success-hero .ring.app-onb-info {
+  background: color-mix(in oklab, var(--info) 14%, transparent);
+}
+.s8-success-hero .ring-inner.app-onb-info {
+  background: var(--info);
+}
+.app-onb-rule {
+  height: 1px;
+  background: color-mix(in oklab, var(--fg-disabled) 60%, transparent);
+  margin: var(--space-3) 0;
+}
+.app-onb-reasons {
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-2);
+  padding: var(--space-3) 0;
+}
+.app-onb-reasons p,
+.app-onb-reasons ul {
+  margin: 0;
+}
+.app-onb-reasons ul {
+  padding-left: var(--space-5);
+}
+.app-onb-chip {
+  margin-top: var(--space-4);
+}
+.app-onb-chip-label {
+  margin-bottom: 4px;
+}
+.app-onb-foot {
+  margin-top: var(--space-5);
+  text-align: center;
+}
+.app-content .s8-addr-chip button {
+  background: transparent;
+  border: 0;
+  cursor: pointer;
+}
```

Modify `extension/src/app/format.ts`:

```diff
diff --git a/extension/src/app/format.ts b/extension/src/app/format.ts
index 9327970..f1c20de 100644
--- a/extension/src/app/format.ts
+++ b/extension/src/app/format.ts
@@ -43,6 +43,9 @@ export const showUsd = (usd: number): string => {
   return `${p.whole}${p.cents}`;
 };
 
+/** "≈ 67.41 SOL": a USD value in SOL, truncated to the cent of a SOL — never rounded up (review L6). */
+export const approxSol = (usd: number, solUsd: number): string => `≈ ${(Math.floor((usd / solUsd) * 100) / 100).toFixed(2)} SOL`;
+
 /** The first four and the last four characters, at equal weight — a scanning aid in lists only (spec §11.7). */
 export const shortAddress = (a: string): string => `${a.slice(0, 4)}…${a.slice(-4)}`;
 /** The first two groups of four, then "…" (the account switcher). */
```

Modify `extension/src/app/router.ts`:

```diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index ffca37a..66ff411 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -8,8 +8,8 @@ import type {Surface} from './WalletContext';
  *
  * The pushable screens are a closed list, and the reducer refuses anything outside it — a forged or
  * future route leaves the stack as it was rather than dangling. The UI tab's hand-over screens (#7
- * `created` and plan 2's `resume` stand-in) are first routes only: chosen by the tab's hash, never
- * pushed.
+ * `created`, #40 `imported`, and plan 2's `resume` stand-in) are first routes only: chosen by the tab's
+ * hash, never pushed.
  */
 export type Route =
   | {screen: 'tab'; tab: Tab}
@@ -17,12 +17,13 @@ export type Route =
   | {screen: 'tx'; signature: string}
   | {screen: 'about'}
   | {screen: 'created'}
+  | {screen: 'imported'}
   | {screen: 'resume'; account: string};
 export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab};
 
 export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about']);
 /** The UI tab's hand-over screens: a first route from `location.hash`, never pushed. */
-export const TAB_ONLY: ReadonlySet<string> = new Set<Route['screen']>(['created', 'resume']);
+export const TAB_ONLY: ReadonlySet<string> = new Set<Route['screen']>(['created', 'imported', 'resume']);
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
 const TABS: ReadonlySet<string> = new Set<Tab>(['home', 'activity', 'settings']);
 
@@ -48,13 +49,14 @@ export function routeReducer(stack: Route[], action: RouteAction): Route[] {
 
 /**
  * The first route (spec §1.6). The popup always starts at #11. The tab reads `location.hash`: `#/created`
- * (#7), `#/send/resume?account=<address>` (the hand-over from #10 — plan 2 shows
+ * (#7), `#/imported` (#40), `#/send/resume?account=<address>` (the hand-over from #10 — plan 2 shows
  * "Open the Noctura icon to continue." there; plan 3 makes it #20) and `#/home`; anything else is #11
  * too. The hash only ever chooses a screen — it never acts, and the account is only an address.
  */
 export function firstRoute(surface: Surface = 'popup', hash = ''): Route[] {
   if (surface === 'tab') {
     if (hash === '#/created') return [{screen: 'created'}];
+    if (hash === '#/imported') return [{screen: 'imported'}];
     const resume = /^#\/send\/resume\?account=([^&#]*)$/.exec(hash);
     if (resume !== null && ADDRESS.test(resume[1] ?? '')) return [{screen: 'resume', account: resume[1] ?? ''}];
   }
```

Modify `extension/src/app/screens/Home.tsx`:

```diff
diff --git a/extension/src/app/screens/Home.tsx b/extension/src/app/screens/Home.tsx
index 14db6fa..0f7be2d 100644
--- a/extension/src/app/screens/Home.tsx
+++ b/extension/src/app/screens/Home.tsx
@@ -1,7 +1,7 @@
 import {useState} from 'react';
 import {useWallet, sustained, type NetMode} from '../WalletContext';
 import {valuation} from '../valuation';
-import {TOKEN_INFO, ago, agoLong, showAmount, showUsd, stamp, usdParts} from '../format';
+import {TOKEN_INFO, approxSol, ago, agoLong, showAmount, showUsd, stamp, usdParts} from '../format';
 import {formatAmount} from '../../shared/amount';
 import {HIDE_BALANCES_KEY, readPref, writePref} from '../prefs';
 import {useNow} from '../useNow';
@@ -169,7 +169,7 @@ export function Home({onReceive, onActivity, onAccounts}: {onReceive: () => void
   const rowNote = b === null ? null : mode === 'reconnecting' ? 'live' : long ? 'stale' : stale ? 'cached' : null;
   const solPrice = m.prices?.sol ?? null;
   // Truncated, never rounded up (review L6).
-  const approx = total !== null && solPrice !== null ? `≈ ${(Math.floor((total / solPrice) * 100) / 100).toFixed(2)} SOL` : null;
+  const approx = total !== null && solPrice !== null ? approxSol(total, solPrice) : null;
   const heroLine = hidden
     ? null
     : syncing
```

Create `extension/src/app/screens/Imported.tsx`:

```tsx
import {useCallback, useEffect, useRef, useState} from 'react';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import type {Account, Balances, Prices, Token} from '../engine';
import {TOKEN_INFO, approxSol, showAmount, showUsd} from '../format';
import {valuation} from '../valuation';
import {useWallet} from '../WalletContext';
import {RefusedBanner} from '../ui/Banner';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {SkelCircle, SkelLine} from '../ui/Skeleton';
import {TokenTile} from '../ui/TokenTile';
import {useCloseTab} from '../ui/useCloseTab';
import {useCopy} from '../ui/useCopy';
import {NoWallet} from './NoWallet';
import {READY_LINE} from './Created';

/** Spec §3.12: balances are read for at most this many accounts, one at a time. */
export const MAX_READ = 6;
const TOKENS: readonly Token[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const KEY: Record<Token, keyof Balances> = {SOL: 'sol', NOC: 'noc', USDC: 'usdc', USDT: 'usdt'};

type Read = {kind: 'loading'} | {kind: 'refused'} | {kind: 'unreachable'} | {kind: 'read'; per: Balances[]; prices: Prices | null};

/**
 * Reads up to MAX_READ accounts' balances one at a time, then the prices. A 403 anywhere is the D26
 * state (reported, sticky); any other failure is `unreachable` — never "empty" (review R2-L5).
 */
async function readAll(engine: ReturnType<typeof useWallet>['engine'], accounts: readonly Account[], report: (e: string) => void): Promise<Read> {
  const per: Balances[] = [];
  for (const a of accounts.slice(0, MAX_READ)) {
    const b = await engine.balances(a.publicKey);
    if (!b.ok) {
      report(b.error);
      return b.error === 'coordinator-refused' ? {kind: 'refused'} : {kind: 'unreachable'};
    }
    per.push(b.data);
  }
  const p = await engine.prices();
  if (!p.ok && p.error === 'coordinator-refused') {
    report(p.error);
    return {kind: 'refused'};
  }
  return {kind: 'read', per, prices: p.ok ? p.data : null};
}

const sum = (per: readonly Balances[]): Balances => per.reduce((t, b) => ({sol: t.sol + b.sol, noc: t.noc + b.noc, usdc: t.usdc + b.usdc, usdt: t.usdt + b.usdt}), {sol: 0n, noc: 0n, usdc: 0n, usdt: 0n});

/** #7's sentence (the carried rule: the clipboard is not auto-cleared, and the screen says so). */
export const CLIPBOARD_LINE = 'Copying puts the address on your clipboard. Noctura does not clear it afterwards.';

function AddressChip({address}: {address: string}) {
  const [copied, copy] = useCopy();
  const label = copied === 'copied' ? 'Copied' : copied === 'failed' ? 'Copy failed' : 'Copy address';
  return (
    <>
      <div className="s8-addr-chip app-onb-chip">
        <div>
          <div className="noc-overline app-dim app-onb-chip-label">Your wallet address</div>
          <span className="addr noc-mono">
            <AddressGroups address={address} />
          </span>
        </div>
        <button type="button" aria-label={label} title={label} onClick={() => copy(address)}>
          <ExtIcon name={copied === 'copied' ? 'check' : copied === 'failed' ? 'close' : 'copy'} size={20} />
        </button>
      </div>
      {/* Controller addition — confirmed by the owner 2026-10-01 (plan-2 review M3): #7's line under #40's chip. */}
      <p className="noc-caption app-dim app-onb-help">{CLIPBOARD_LINE}</p>
    </>
  );
}

function Hero({info, head, sub}: {info?: boolean; head?: string; sub: string}) {
  return (
    <div className="s8-success-hero">
      <div className={info === true ? 'ring app-onb-info' : 'ring'}>
        <div className={info === true ? 'ring-inner app-onb-info' : 'ring-inner'}>
          <ExtIcon name="check" size={32} />
        </div>
      </div>
      {head === undefined ? null : <h1 className="head">{head}</h1>}
      <p className="sub">{sub}</p>
    </div>
  );
}

/**
 * #40 import-success (spec §3.12), in the UI tab at `#/imported` — where the vault page hands over after
 * an import or a restore. What the wallet holds: the market total (SOL + USDC + USDT; NOC "at stage
 * price", outside it), a row per token held (summed over the accounts read), the address. Empty only
 * when every account's read succeeded and all four tokens are zero on each; then [Try a different seed]
 * re-reads first (LockedButton) and goes to the vault page's retry path only if all are still zero
 * (D41; the background guard checks again at the deletion, C6).
 */
export function Imported() {
  const m = useWallet();
  const tab = useCloseTab(m.platform);
  const [read, setRead] = useState<Read>({kind: 'loading'});
  const live = useRef(true);
  const accounts = m.wallet?.accounts ?? [];
  const unlocked = m.phase === 'unlocked';
  // The read follows the account list's addresses (a string key), not the array's identity.
  const key = accounts.map(a => a.publicKey).join(',');
  const current = useRef(accounts);
  current.current = accounts;
  const load = useCallback(async () => {
    if (current.current.length === 0) return;
    setRead({kind: 'loading'});
    const r = await readAll(m.engine, current.current, m.report);
    if (live.current) setRead(r);
  }, [m.engine, m.report, key]);
  useEffect(() => {
    live.current = true;
    if (unlocked) void load();
    return () => {
      live.current = false;
    };
  }, [unlocked, load]);

  if (m.phase === 'no-wallet') return <NoWallet />;
  if (m.phase === 'locked') {
    return (
      <div className="screen app-center">
        <p className="noc-body">Wallet imported. Unlock it to see what was recovered.</p>
        <div className="app-center-actions">
          <button type="button" className="btn btn-primary" onClick={() => m.platform.navigate('unlock.html?mode=unlock&return=imported')}>
            Unlock
          </button>
        </div>
      </div>
    );
  }
  const first = accounts.find(a => a.index === 0) ?? accounts[0];
  if (read.kind === 'loading' || first === undefined) {
    return (
      <div className="screen app-onb-imported" aria-busy="true">
        <Hero sub="Checking what this wallet holds…" />
        <div className="s8-recovered-card">
          {[0, 1, 2].map(i => (
            <div key={i} className="s8-token-row">
              <SkelCircle size={32} />
              <SkelLine width={120} />
              <SkelLine width={60} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (read.kind === 'refused' || read.kind === 'unreachable') {
    const refused = read.kind === 'refused' || m.net.mode === 'refused';
    return (
      <div className="screen app-onb-imported">
        {refused ? <RefusedBanner /> : null}
        <div className="app-center">
          {refused ? null : <p className="noc-body">Balances could not be read right now.</p>}
          <button type="button" className="icon-btn" aria-label="Refresh" disabled={refused} onClick={() => void load()}>
            <ExtIcon name="refresh" size={20} />
          </button>
        </div>
        <AddressChip address={first.publicKey} />
      </div>
    );
  }

  const total = sum(read.per);
  const held = TOKENS.filter(t => total[KEY[t]] > 0n);
  const n = accounts.length;
  const allRead = n <= MAX_READ;
  const accountsWord = n === 1 ? '1 account' : `${n} accounts`;

  if (held.length === 0 && allRead) {
    const retry = async () => {
      const again = await readAll(m.engine, accounts, m.report);
      if (!live.current) return;
      // Anything arrived (or the read failed): this screen shows it, and the button is gone. Only a
      // read of all four tokens at zero on every account goes on to the retry path.
      const now = again.kind === 'read' ? sum(again.per) : null;
      if (now === null || now.sol + now.noc + now.usdc + now.usdt > 0n) return setRead(again);
      m.platform.navigate('unlock.html?mode=import&source=retry');
    };
    return (
      <div className="screen app-onb-imported">
        <Hero info head="Wallet imported · empty" sub="Your seed checked out, but this wallet holds none of the tokens Noctura shows yet. That's fine — go receive some." />
        <div className="s8-recovered-card">
          <span className="label">Recovered</span>
          <span className="total noc-balance-lg noc-numeral app-muted">0 tokens</span>
          <span className="delta">{accountsWord} · address derivation succeeded</span>
          <div className="app-onb-rule" />
          <div className="app-onb-reasons">
            <p className="noc-body">A few reasons this can happen:</p>
            <ul className="noc-body-sm app-muted">
              <li>This is a fresh seed — never received any tokens</li>
              <li>You imported the wrong seed for this account</li>
              <li>Your assets are on a different derivation path (we check m/44'/501'/n'/0' for n = 0–4, and the Solana CLI key)</li>
            </ul>
          </div>
        </div>
        <AddressChip address={first.publicKey} />
        <p className="noc-caption app-dim app-onb-foot">You can send SOL to this address to fund the wallet.</p>
        <div className="app-onb-grow" />
        <div className="sticky-bar">
          <p className="noc-body app-center-text">{READY_LINE}</p>
          <LockedButton className="btn btn-secondary" onPress={retry}>
            Try a different seed
          </LockedButton>
        </div>
      </div>
    );
  }

  const v = valuation(total, read.prices);
  const solUsd = read.prices?.sol ?? null;
  // Truncated, never rounded up (plan-1 ruling L6; plan-2 review M1).
  const approx = v.total !== null && solUsd !== null ? approxSol(v.total, solUsd) : null;
  const holders = (t: Token) => read.per.filter(b => b[KEY[t]] > 0n).length;
  // "1 token" (singular): controller addition — confirmed by the owner 2026-10-01.
  const tokens = held.length === 1 ? '1 token' : `${held.length} tokens`;
  // Past MAX_READ the copy claims only what was read (plan-2 review M2 — controller addition, confirmed by the owner 2026-10-01).
  const sub = n === 1 ? `1 account · ${tokens} recovered. Welcome back.` : allRead ? `${n} accounts · ${tokens} recovered.` : `${n} accounts · ${tokens} recovered from the first ${MAX_READ}.`;
  const across = allRead ? `across ${n} accounts` : `across the first ${MAX_READ} of ${n} accounts`;
  const delta = n === 1 ? approx : [across, approx].filter(x => x !== null).join(' · ');
  return (
    <div className="screen app-onb-imported">
      <Hero head="Wallet imported" sub={sub} />
      <div className="s8-recovered-card">
        <span className="label">Total value recovered</span>
        <span className="total noc-balance-lg noc-numeral">{v.total === null ? '—' : showUsd(v.total)}</span>
        {delta === null || delta === '' ? null : <span className="delta">{delta}</span>}
        <div className="app-onb-rule" />
        {held.map(t => {
          const row = v.rows[t];
          const count = holders(t);
          return (
            <div key={t} className="s8-token-row">
              <TokenTile token={t} size={32} />
              <div>
                <div className="pri noc-body-lg">{t}</div>
                <div className="sec">{n > 1 && count > 1 ? `${TOKEN_INFO[t].name} · ${count} accounts` : TOKEN_INFO[t].name}</div>
              </div>
              <div>
                <div className="amt noc-numeral">{showAmount(t, row.base)}</div>
                <div className="fiat noc-numeral">{row.usd === null ? '—' : `${showUsd(row.usd)}${row.basis === 'stage' ? ' at stage price' : ''}`}</div>
              </div>
            </div>
          );
        })}
      </div>
      <AddressChip address={first.publicKey} />
      <div className="app-onb-grow" />
      <div className="sticky-bar">
        <p className="noc-body app-center-text">{READY_LINE}</p>
        {tab.refused ? null : (
          <button type="button" className="btn btn-secondary" onClick={tab.close}>
            Close this tab
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and the whole suite.**

Run: `npx vitest run src/app/__tests__/Imported.test.tsx src/app/__tests__/format.test.ts src/app/__tests__/router.test.ts` — PASS. Then the whole suite: `npx tsc --noEmit && npx vitest run`
Expected (dry run): tsc clean; Test Files 99 passed (99) Tests 1258 passed (1258).

- [ ] **Step 5: Mutations (in a scratch copy outside the repo — each must turn its test red; the dry run ran every one).**

- a failed read reads as empty → RED Tests  1 failed | 9 passed (10)
- [Try a different seed] without the re-read → RED Tests  1 failed | 9 passed (10)
- #40 rounds ≈ SOL up (M1) → RED Tests  1 failed | 9 passed (10)
- past six accounts the copy claims every account (M2) → RED Tests  1 failed | 9 passed (10)
- #40 drops the clipboard line (M3) → RED Tests  3 failed | 7 passed (10)
- [Try a different seed] without LockedButton (M6) → RED Tests  1 failed | 9 passed (10)

- [ ] **Step 6: Add the states to the visual pass.** Task 18 shoots, asserting each state's copy first: `40-loading`, `40-single-account`, `40-multi-account`, `40-no-assets-empty`, `40-unreachable`, `40-refused-d26`, `40-locked`. The reviewer checks them against the matching `index.html` mockup with §8.6's checklist (Task 18 Step 3).

- [ ] **Step 7: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/src/app/App.tsx extension/src/app/__tests__/Imported.test.tsx extension/src/app/__tests__/format.test.ts extension/src/app/__tests__/router.test.ts extension/src/app/app.css extension/src/app/format.ts extension/src/app/router.ts extension/src/app/screens/Home.tsx extension/src/app/screens/Imported.tsx
git commit -m "feat(extension): #40 import-success — what the wallet holds, empty only when every read answered, Try a different seed (D41)" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 17: E2E specs 1, 2, 3, 10 and 12

**Files:**
- Modify: `extension/e2e/fakeCoordinator.ts`
- Modify: `extension/e2e/makeEnvelope.ts`
- Create: `extension/e2e/onboarding.spec.ts`
- Modify: `extension/e2e/vaultPage.ts`
- Modify: `extension/e2e/wallet.spec.ts`

**Interfaces:**
- Consumes: Tasks 8–16, plan 1's harness (`launchPopup`, `contained`, `installFakeCoordinator`).
- Produces: `e2e/onboarding.spec.ts`; `FakeCoordinator.defaultLamports`; `makeEnvelope({accounts?: 1 | 2})`, `E2E_MNEMONIC`, `E2E_ACCOUNTS`; `e2e/vaultPage.ts`: `importWallet`, `pastePhrase`, `tryUnlock`

Spec §8.5, against the real extension (vault page, UI tab, popup) and the contained fake coordinator; each spec ends with `contained(h)` (routing proven, nothing unexpected, Solscan and every other noc-tura.io name at 0) and runs in a normal launch and under `unshare -rn`:
1. **create:** #1 (Geist loads on the vault page — `document.fonts.load` finds a face, Scope 9) → #2 → #3 (a real 2 s hold) → #4 (the slots read from the page) → #5 → #6 skip → `#/created` shows the stored address → the popup is #11 with the fake's 10 SOL.
2. **import:** #8 paste (the toast, the valid line) → the scheme detected → #5 → #40 with the fake's balances.
3. **unlock:** the popup's locked screen → `[Unlock]` opens the tab → two wrong passwords → the third shows the cooldown card (the engine's 2 s) → the right one → "Unlocked." → the popup is #11.
10. **forgot → restore:** a 2-account wallet, locked, with a known recipient → #9 → "Forgot password?" → #39's three steps → #8: a different valid phrase → `not-this-wallet` and the stored envelope byte-identical → `[Try another phrase]` → the right phrase → #5 "Restore · 2 / 2" → `#/imported` shows both accounts; the old password no longer unlocks, the new one does; the recipient is still known (`wallet.recipientInfo`, Scope 8). **Second run:** a send pending in the fake's `expire` mode → the restore answers `send-open` and the envelope is unchanged → past the blockhash's life the record expires → `[Try again]` restores.
12. **try a different seed:** an empty import → #40 empty → `[Try a different seed]` → a wrong password refused, the envelope unchanged → the right one → phrase B → #5 → `#/imported` shows B's address; the old password no longer unlocks. **Second run (C6):** after the #40 click the fake credits account 0 → at the finish "This wallet now holds funds. Nothing was changed." and the envelope byte-identical.
`wallet.spec.ts`'s re-authentication now also asserts, in the browser, that the resume stand-in renders "Open the Noctura icon to continue." and that nothing was broadcast before the tab closes (plan-2 review M7). The fake gains `defaultLamports` (what an unlisted address holds); `makeEnvelope` can make the two-account wallet; the addresses the specs compare are constants derived once with `src/vault/accounts.ts` (no `core/` import in the E2E).

- [ ] **Step 1: Write the specs.**

Modify `extension/e2e/fakeCoordinator.ts`:

```diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
index 35de88c..e8319ba 100644
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -31,8 +31,10 @@ export interface FakeCoordinator {
    * aborts every request — no answer at all (#42).
    */
   network: 'ok' | 'forbidden' | 'unreachable';
-  /** SOL per address, lamports; anything unlisted holds 10 SOL. */
+  /** SOL per address, lamports; anything unlisted holds `defaultLamports`. */
   lamports: Map<string, number>;
+  /** What an unlisted address holds (10 SOL unless a spec sets an empty chain). */
+  defaultLamports: number;
   /** What getAccountInfo says an address is (E2); anything unlisted does not exist. */
   accountKinds: Map<string, 'wallet' | 'program' | 'other'>;
   /** The simulation's error switch (E2): err set and accounts null, as the real RPC answers. */
@@ -104,6 +106,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     unexpected: [],
     network: 'ok',
     lamports: new Map(),
+    defaultLamports: 10_000_000_000,
     accountKinds: new Map(),
     simulateError: false,
     simulations: [],
@@ -123,7 +126,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     }),
   });
 
-  const lamportsOf = (address: string): number => fake.lamports.get(address) ?? 10_000_000_000;
+  const lamportsOf = (address: string): number => fake.lamports.get(address) ?? fake.defaultLamports;
 
   /**
    * What a node answers: the requested accounts after the transaction, WITHOUT the fee (the engine
```

Modify `extension/e2e/makeEnvelope.ts`:

```diff
diff --git a/extension/e2e/makeEnvelope.ts b/extension/e2e/makeEnvelope.ts
index 6c4dae4..64a0a05 100644
--- a/extension/e2e/makeEnvelope.ts
+++ b/extension/e2e/makeEnvelope.ts
@@ -2,15 +2,18 @@ import {createEnvelope, PRODUCTION_KDF} from '../src/vault/envelope';
 import {argon2idKdf} from '../src/vault/kdf';
 
 export const E2E_PASSWORD = 'correct horse battery staple';
-const MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
+export const E2E_MNEMONIC = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
+/** E2E_MNEMONIC's SLIP-0010 accounts 0 and 1 (derived once with src/vault/accounts.ts; written here so the E2E imports no core/ code). */
+export const E2E_ACCOUNTS = ['HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', 'Hh8QwFUA6MtVu1qAoq12ucvFHNwCcVTV7hpWjeY1Hztb'] as const;
 
-/** A real envelope at production parameters — the E2E exercises the real cost. */
-export function makeEnvelope() {
+/** A real envelope at production parameters — the E2E exercises the real cost. One account, or the two of E2E_ACCOUNTS. */
+export function makeEnvelope(o: {accounts?: 1 | 2} = {}) {
+  const names = ['Account 1', 'Savings'];
   return createEnvelope({
-    mnemonic: MNEMONIC,
+    mnemonic: E2E_MNEMONIC,
     password: E2E_PASSWORD,
     scheme: 'slip10',
-    accounts: [{index: 0, name: 'Account 1', publicKey: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk'}],
+    accounts: E2E_ACCOUNTS.slice(0, o.accounts ?? 1).map((publicKey, index) => ({index, name: names[index] ?? '', publicKey})),
     kdf: argon2idKdf,
     params: PRODUCTION_KDF,
   });
```

Create `extension/e2e/onboarding.spec.ts`:

```ts
import {test, expect, type Page, type Worker} from '@playwright/test';
import {contained, launchPopup} from './popupHarness';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {BLOCKHASH_LIFETIME} from './fakeCoordinator';
import {createWallet, importWallet, pastePhrase, setPassword, tryUnlock, unlockWith} from './vaultPage';

// Spec B1b-2a §8.5, plan 2: specs 1–3, 10 and 12, against the real extension (vault page + UI tab +
// popup) and the contained fake coordinator. Every spec ends with contained(h).
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
/** OTHER's SLIP-0010 account 0 (derived once with src/vault/accounts.ts). */
const OTHER_ACCOUNT = 'BLeUXTx9thHGT7VJUtF9vHEmfMDgW1nnKZ9UVer2CoLX';
const NEW_PASSWORD = 'a brand new e2e password';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
};
const stored = (sw: Worker): Promise<string> => sw.evaluate(async () => JSON.stringify((await chrome.storage.local.get('v1_vault')).v1_vault));
const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
const groups = async (page: Page, scope: string): Promise<string> => (await page.locator(`${scope} .addr-groups > span`).allTextContents()).join('');

test('1 · onboarding create: #1 → #2 → #3 → #4 → #5 → #6 → #7 shows the address; then the popup is #11; the vault page has Geist', async () => {
  const h = await launchPopup('noctura-e2e-create-');
  try {
    const vault = await h.ctx.newPage();
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
    await expect(vault.getByText('A Solana wallet built for private, non-custodial holding.')).toBeVisible();
    // Review L5: the design's font reaches the vault page (a face that loads, not the fallback).
    expect(await vault.evaluate(async () => (await document.fonts.load('16px Geist')).length)).toBeGreaterThan(0);
    expect(await vault.evaluate(() => document.fonts.check('16px Geist'))).toBe(true);
    await createWallet(vault, h.id, NEW_PASSWORD, {fromWelcome: true});
    await expect(vault.getByText('Wallet created')).toBeVisible();
    const account = (JSON.parse(await stored(h.sw)) as {accounts: {publicKey: string}[]}).accounts[0]?.publicKey ?? '';
    expect(await groups(vault, '.addr-card')).toBe(account);
    await expect(vault.getByText('Wallet is ready — open the Noctura icon')).toBeVisible();
    const popup = await h.openPopup();
    await expect(popup.getByText('TOKENS')).toBeVisible();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    contained(h);
  } finally {
    await h.close();
  }
});

test('2 · import: #8 paste → the scheme detected → #5 → #40 with the fake’s balances', async () => {
  const h = await launchPopup('noctura-e2e-import-');
  try {
    const vault = await h.ctx.newPage();
    await vault.goto(`chrome-extension://${h.id}/unlock.html?mode=import`);
    await pastePhrase(vault, E2E_MNEMONIC);
    await expect(vault.getByText('Pasted from clipboard. Noctura cannot clear your clipboard — clear it yourself.')).toBeVisible();
    await expect(vault.getByText('Valid 12-word BIP-39 phrase · checksum OK')).toBeVisible();
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    await expect(vault.getByText('Wallet imported')).toBeVisible();
    await expect(vault.getByText('1 account · 1 token recovered. Welcome back.')).toBeVisible();
    await expect(vault.locator('.s8-token-row .amt')).toHaveText(['10.0000']);
    expect(await groups(vault, '.s8-addr-chip')).toBe(E2E_ACCOUNTS[0]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('3 · unlock: the popup’s locked screen → the tab → wrong passwords → the cooldown → the right one → the popup is #11', async () => {
  const h = await launchPopup('noctura-e2e-unlock-');
  try {
    await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
    const popup = await h.openPopup();
    await expect(popup.getByText('Welcome back')).toBeVisible();
    const [vault] = await Promise.all([h.ctx.waitForEvent('page'), popup.getByRole('button', {name: 'Unlock'}).click()]);
    await vault.waitForLoadState();
    expect(vault.url()).toBe(`chrome-extension://${h.id}/unlock.html?mode=unlock`);
    for (let i = 0; i < 2; i++) {
      await vault.locator('#unl-password').fill('not the password at all');
      await vault.locator('#unl-submit').click();
      await expect(vault.locator('#unl-helper')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
      await expect(vault.locator('#unl-submit')).toBeEnabled({timeout: 10_000});
    }
    // The third wrong password: the engine's 2 s wait, as the design's cooldown card.
    await vault.locator('#unl-password').fill('not the password at all');
    await vault.locator('#unl-submit').click();
    await expect(vault.locator('#unl-cooldown').getByText('Wait a moment', {exact: true})).toBeVisible({timeout: 60_000});
    await expect(vault.locator('#unl-timer')).toHaveText(/^0:0[12]$/);
    await expect(vault.locator('#unl-paused')).toBeDisabled();
    await expect(vault.locator('#unl-helper')).toHaveText('That did not unlock the wallet.', {timeout: 30_000});
    await expect(vault.locator('#unl-submit')).toBeEnabled({timeout: 10_000});
    await vault.locator('#unl-password').fill(E2E_PASSWORD);
    await vault.locator('#unl-submit').click();
    await expect(vault.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
    const again = await h.openPopup();
    await expect(again.getByText('TOKENS')).toBeVisible();
    // #11 read the fake (the balance on screen is its 10 SOL), so contained() sees the route at work.
    await expect(again.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    contained(h);
  } finally {
    await h.close();
  }
});

/** #9 → "Forgot password?" → #39 (three steps) → #8 on the restore path. */
async function toRestore(vault: Page, id: string): Promise<void> {
  await vault.goto(`chrome-extension://${id}/unlock.html`);
  await vault.getByRole('button', {name: 'Forgot password?'}).click();
  await expect(vault.getByText('Forgot your password?')).toBeVisible();
  await vault.locator('#fg-next').click();
  await vault.locator('#fg-next').click();
  await vault.locator('#fg-next').click();
  await vault.waitForURL(/mode=import&source=forgot$/);
}

test('10 · forgot password → restore (E5): a different phrase changes nothing; the right one restores both accounts under a new password', async () => {
  const h = await launchPopup('noctura-e2e-restore-');
  try {
    await h.sw.evaluate(async ({e, r}) => chrome.storage.local.set({v1_vault: e, v1_known_recipients: [{address: r, at: 1}]}), {e: await makeEnvelope({accounts: 2}), r: RECIPIENT});
    const vault = await h.ctx.newPage();
    await toRestore(vault, h.id);
    const before = await stored(h.sw);
    await pastePhrase(vault, OTHER);
    await vault.locator('#imp-continue').click();
    await expect(vault.getByText('This phrase does not belong to the wallet in this browser. Nothing was changed.')).toBeVisible({timeout: 30_000});
    expect(await stored(h.sw)).toBe(before);
    await vault.getByRole('button', {name: 'Try another phrase'}).click();
    await pastePhrase(vault, E2E_MNEMONIC);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Restore · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    await expect(vault.getByText('2 accounts · 1 token recovered.')).toBeVisible();
    await expect(vault.locator('.s8-token-row .sec')).toHaveText(['Solana · 2 accounts']);
    // The old password no longer unlocks; the new one does.
    expect(await tryUnlock(vault, h.id, E2E_PASSWORD)).toBe('That did not unlock the wallet.');
    expect(await tryUnlock(vault, h.id, NEW_PASSWORD)).toBe('Unlocked.');
    // D40: the same wallet was proven, so its known recipients stay. (#12's "Verified · sent before" hint
    // is plan 3's screen; the engine message it reads is checked here.)
    const ui = await h.ctx.newPage();
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    expect(await msg(ui, {type: 'wallet.recipientInfo', account: E2E_ACCOUNTS[0], recipient: RECIPIENT})).toMatchObject({ok: true, data: {known: true}});
    contained(h);
  } finally {
    await h.close();
  }
});

test('10 · restore while a send is still pending: send-open, nothing changed; once it expires, [Try again] restores', async () => {
  const h = await launchPopup('noctura-e2e-restore-pending-');
  try {
    h.fake.mode = 'expire';
    await h.sw.evaluate(async ({e, r}) => chrome.storage.local.set({v1_vault: e, v1_known_recipients: [{address: r, at: 1}]}), {e: await makeEnvelope(), r: RECIPIENT});
    const vault = await h.ctx.newPage();
    await unlockWith(vault, h.id, E2E_PASSWORD);
    const ui = await h.ctx.newPage();
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    let signature = '';
    for (let attempt = 0; attempt < 3 && signature === ''; attempt++) {
      const prep = await msg(ui, {type: 'wallet.prepareSend', account: E2E_ACCOUNTS[0], intent: {token: 'SOL', recipient: RECIPIENT, amount: '1000000'}});
      const sent = await msg(ui, {type: 'wallet.send', id: (prep.data as {id: string}).id});
      if (sent.ok) signature = (sent.data as {signature: string}).signature;
    }
    expect(signature).not.toBe('');
    expect((await msg(ui, {type: 'vault.lock'})).ok).toBe(true);

    await toRestore(vault, h.id);
    const before = await stored(h.sw);
    await pastePhrase(vault, E2E_MNEMONIC);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Restore · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    await expect(vault.locator('#pw-helper')).toHaveText('A transaction from this wallet is still pending. Wait until it confirms or expires — about two minutes — then try again.', {timeout: 60_000});
    expect(await stored(h.sw)).toBe(before);

    // Past the blockhash's life with margin: two null history rounds, then expired (wallet.spec's rule).
    const record = (await msg(ui, {type: 'wallet.pending'})).data as {signature: string; lastValidBlockHeight: number; state: string}[];
    h.fake.blockHeight = (record.find(r => r.signature === signature)?.lastValidBlockHeight ?? h.fake.blockHeight + BLOCKHASH_LIFETIME) + 33;
    await expect
      .poll(async () => ((await msg(ui, {type: 'wallet.pending'})).data as {signature: string; state: string}[]).find(r => r.signature === signature)?.state, {timeout: 60_000, intervals: [1_000]})
      .toBe('expired');
    await vault.getByRole('button', {name: 'Try again'}).click();
    await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    expect(await tryUnlock(vault, h.id, NEW_PASSWORD)).toBe('Unlocked.');
    contained(h);
  } finally {
    await h.close();
  }
});

/** #40 empty → [Try a different seed] → the vault page's retry path (password first). */
async function toRetry(h: Awaited<ReturnType<typeof launchPopup>>, vault: Page): Promise<void> {
  h.fake.defaultLamports = 0;
  await importWallet(vault, h.id, E2E_MNEMONIC, E2E_PASSWORD);
  await expect(vault.getByText('Wallet imported · empty')).toBeVisible({timeout: 30_000});
  await vault.getByRole('button', {name: 'Try a different seed'}).click();
  await vault.waitForURL(/mode=import&source=retry$/);
  await expect(vault.getByText('Confirm with the password of the wallet you are replacing')).toBeVisible();
}

test('12 · try a different seed (D41): a wrong password changes nothing; the right one, then phrase B, replaces the empty wallet', async () => {
  const h = await launchPopup('noctura-e2e-retry-');
  try {
    const vault = await h.ctx.newPage();
    await toRetry(h, vault);
    const before = await stored(h.sw);
    await vault.locator('#rp-password').fill('not the password at all');
    await vault.locator('#rp-confirm').click();
    await expect(vault.locator('#rp-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    expect(await stored(h.sw)).toBe(before);
    await vault.locator('#rp-password').fill(E2E_PASSWORD);
    await vault.locator('#rp-confirm').click();
    await expect(vault.locator('#v-import')).toBeVisible({timeout: 60_000});
    await expect(vault.locator('#imp-phrase')).toHaveValue('');
    await pastePhrase(vault, OTHER);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
    await expect(vault.getByText('Wallet imported · empty')).toBeVisible();
    expect(await groups(vault, '.s8-addr-chip')).toBe(OTHER_ACCOUNT);
    expect(await tryUnlock(vault, h.id, E2E_PASSWORD)).toBe('That did not unlock the wallet.');
    expect(await tryUnlock(vault, h.id, NEW_PASSWORD)).toBe('Unlocked.');
    contained(h);
  } finally {
    await h.close();
  }
});

test('12 · funds that arrive after #40 rendered empty refuse the delete in the background (C6): "This wallet now holds funds."', async () => {
  const h = await launchPopup('noctura-e2e-retry-funded-');
  try {
    const vault = await h.ctx.newPage();
    await toRetry(h, vault);
    const before = await stored(h.sw);
    // Past the #40 click: the chain credits account 0.
    h.fake.lamports.set(E2E_ACCOUNTS[0], 1_000_000_000);
    await vault.locator('#rp-password').fill(E2E_PASSWORD);
    await vault.locator('#rp-confirm').click();
    await expect(vault.locator('#v-import')).toBeVisible({timeout: 60_000});
    await pastePhrase(vault, OTHER);
    await vault.locator('#imp-continue').click();
    await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
    await setPassword(vault, NEW_PASSWORD);
    await expect(vault.locator('#pw-helper')).toHaveText('This wallet now holds funds. Nothing was changed.', {timeout: 60_000});
    expect(await stored(h.sw)).toBe(before);
    expect(await tryUnlock(vault, h.id, E2E_PASSWORD)).toBe('Unlocked.');
    contained(h);
  } finally {
    await h.close();
  }
});
```

Modify `extension/e2e/vaultPage.ts`:

```diff
diff --git a/extension/e2e/vaultPage.ts b/extension/e2e/vaultPage.ts
index e30aacf..123fa51 100644
--- a/extension/e2e/vaultPage.ts
+++ b/extension/e2e/vaultPage.ts
@@ -5,9 +5,10 @@ import {expect, type Page} from '@playwright/test';
  * 2 s press-and-hold on #3, typed passwords. Every step waits on what the page shows.
  */
 
-/** The create run (#2 → #3 → #4 → #5 → #6 skip). Returns the 24 words #3 showed. */
-export async function createWallet(vault: Page, id: string, password: string): Promise<string[]> {
-  await vault.goto(`chrome-extension://${id}/unlock.html?mode=create`);
+/** The create run (#2 → #3 → #4 → #5 → #6 skip). Returns the 24 words #3 showed. `fromWelcome`: the page is on #1 already. */
+export async function createWallet(vault: Page, id: string, password: string, o: {fromWelcome?: boolean} = {}): Promise<string[]> {
+  if (o.fromWelcome === true) await vault.locator('#wel-create').click();
+  else await vault.goto(`chrome-extension://${id}/unlock.html?mode=create`);
   await vault.locator('#int-continue').click();
   await vault.locator('#sg-continue').click();
   const words = await vault.locator('#seed-grid .term').allTextContents();
@@ -58,3 +59,28 @@ export async function unlockWith(vault: Page, id: string, password: string): Pro
   await vault.locator('#unl-submit').click();
   await expect(vault.locator('#unl-notice-line')).toHaveText('Unlocked.', {timeout: 60_000});
 }
+
+/** #8 (a plain import): pastes the phrase, Continue, then #5. The tab ends on #40 (#/imported). */
+export async function importWallet(vault: Page, id: string, phrase: string, password: string): Promise<void> {
+  await vault.goto(`chrome-extension://${id}/unlock.html?mode=import`);
+  await pastePhrase(vault, phrase);
+  await vault.locator('#imp-continue').click();
+  await expect(vault.locator('#pw-step')).toHaveText('Import · 2 / 2', {timeout: 30_000});
+  await setPassword(vault, password);
+  await vault.waitForURL(/\/wallet\.html#\/imported$/, {timeout: 60_000});
+}
+
+/** A paste into #8's field: the paste event, then the text (what the browser does). */
+export async function pastePhrase(vault: Page, phrase: string): Promise<void> {
+  await vault.locator('#imp-phrase').dispatchEvent('paste');
+  await vault.locator('#imp-phrase').fill(phrase);
+}
+
+/** Tries a password on #9; resolves with what the helper or the notice says. */
+export async function tryUnlock(vault: Page, id: string, password: string): Promise<string> {
+  await vault.goto(`chrome-extension://${id}/unlock.html`);
+  await vault.locator('#unl-password').fill(password);
+  await vault.locator('#unl-submit').click();
+  await expect(vault.locator('#unl-helper, #unl-notice-line').filter({hasText: /did not unlock|Unlocked\./})).toHaveCount(1, {timeout: 60_000});
+  return (await vault.locator('#unl-notice').isVisible()) ? ((await vault.locator('#unl-notice-line').textContent()) ?? '') : ((await vault.locator('#unl-helper').textContent()) ?? '');
+}
```

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
index adcef1c..bb01705 100644
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -63,7 +63,7 @@ const pendingState = async (page: Page, signature: string): Promise<string | und
  * Re-authenticate a challenge through the real vault page (#10). After the proof the same tab hands
  * over to the UI tab's resume route (D38) — nothing is sent from the vault page.
  */
-async function reauthenticate(ctx: BrowserContext, id: string, challengeId: string, password: string, account: string): Promise<void> {
+async function reauthenticate(ctx: BrowserContext, fake: FakeCoordinator, id: string, challengeId: string, password: string, account: string): Promise<void> {
   const vault = await ctx.newPage();
   try {
     await vault.goto(`chrome-extension://${id}/unlock.html?mode=reauth&challenge=${challengeId}`);
@@ -71,6 +71,9 @@ async function reauthenticate(ctx: BrowserContext, id: string, challengeId: stri
     await vault.fill('#ra-password', password);
     await vault.click('#ra-confirm');
     await vault.waitForURL(`chrome-extension://${id}/wallet.html#/send/resume?account=${account}`, {timeout: 60_000});
+    // The resume stand-in, in a real browser (plan-2 review M7): it renders, and it sends nothing.
+    await expect(vault.getByText('Open the Noctura icon to continue.')).toBeVisible();
+    expect(fake.broadcasts).toEqual([]);
   } finally {
     await vault.close();
   }
@@ -130,7 +133,7 @@ test('create a wallet, unlock it, re-authenticate a first send, send SOL: pendin
     expect(await msg(popup, {type: 'wallet.send', id: view.id})).toEqual({ok: false, error: 'reauth-required', data: {challengeId}});
     expect(fake.broadcasts).toEqual([]);
 
-    await reauthenticate(ctx, id, challengeId, NEW_PASSWORD, account);
+    await reauthenticate(ctx, fake, id, challengeId, NEW_PASSWORD, account);
     // The vault page broadcast nothing: the send waits for a tap (D38).
     expect(fake.broadcasts).toEqual([]);
```

- [ ] **Step 2: Run them — a normal launch, then offline, twice each.**

Run: `npm run build && npx playwright test e2e/onboarding.spec.ts --repeat-each=2 && unshare -rn npx playwright test e2e/onboarding.spec.ts --repeat-each=2`
Expected: 14 passed, twice. (`unshare -rn` is the offline namespace plan 1's lesson asks for: Chromium's `navigator.onLine` is false there.) Then the whole E2E once: `npx playwright test` — 17 passed.

- [ ] **Step 3: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add extension/e2e/fakeCoordinator.ts extension/e2e/makeEnvelope.ts extension/e2e/onboarding.spec.ts extension/e2e/vaultPage.ts extension/e2e/wallet.spec.ts
git commit -m "test(extension): E2E specs 1, 2, 3, 10 and 12 — create, import, unlock, restore, try a different seed" -m "Co-Authored-By: <the executing model's own line>"
```


---

### Task 18: The visual pass (§8.6) and the spec’s Differs entries

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/e2e/fakeCoordinator.ts`
- Create: `extension/e2e/visual-vault.spec.ts`
- Modify: `extension/e2e/visual.spec.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: `e2e/visual-vault.spec.ts`; `FakeCoordinator.hold(): () => void`; the spec's Differs entries for #1, #3, #5, #6, #8, #9, #10, #39, #40 and §4.1

Spec §8.6 and the plan-1 lessons. `e2e/visual-vault.spec.ts` drives every state above in the real extension at the mockups' 412 × 916 and saves `test-results/visual/<NN>-<state>.png` (58 shots; screenshots are CI artifacts, never committed). Every state asserts its own copy before its shot. A state that lasts a moment is shot under Playwright's paused clock (#3's countdown at 13 s and 5 s and "Still looking?", #4's wrong word before its 700 ms reset, #5's mismatch before its 600 ms clear, #8's idle timer at 48 s, #9's and #10's cooldown); a state that lasts as long as a computation is **held open by the test**, never raced (#5 `creating` and #6 `adding` by holding the Argon2id worker's answer in a test-only wrapper installed with `addInitScript` — it hooks `worker.onmessage`, which `kdf.ts` assigns, and `releaseKdf()` first polls that exactly one answer is held, so a change to `addEventListener` fails loudly instead of racing (plan-2 review L6); #8 `checking` and #40 `loading` by `fake.hold()`). #3's held states are viewport shots (a full-page capture resizes the view under the pressed pointer, which the page reads as a release). The plan-1 shot of the popup's locked screen now asserts "Forgot password?". Then **an opus-tier reviewer** (plan-1 lesson) compares each image with the same state in `index.html` using the checklist in Step 3, and the spec gets plan 2's Differs entries and the plan-2 review's rulings (Step 4): §1.2's and §8.5 spec 1's font assertion (ruling 5), §3.3's `confirmed` CTA (ruling 1), §3.4's pool wording (ruling 6), §3.8's phrase lifetime and Back (M4, L3, H2), §3.10's `undescribable` `[Close]` line, the X in notices, the settings challenge's expiry and the fee-row ruling (H1, L4, ruling 2), §3.12's truncation, clipboard line and past-six copy (M1, M3, M2, ruling 8), §8.5 spec 10's `wallet.recipientInfo` note (ruling 4).

- [ ] **Step 1: Write the specs.**

Modify `extension/e2e/fakeCoordinator.ts`:

```diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
index e8319ba..83d3040 100644
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -43,6 +43,11 @@ export interface FakeCoordinator {
   simulations: (string[] | null)[];
   /** Per owner, newest first: the signatures getSignaturesForAddress pages through, and each getTransaction result. */
   history: Map<string, {signature: string; tx: unknown}[]>;
+  /**
+   * Holds every answer until the returned function is called — how a visual spec keeps a loading
+   * state (#40's, #8's "Checking…") on screen deterministically while it is asserted and shot.
+   */
+  hold(): () => void;
 }
 
 /** Compact-u16: the signature count that opens a serialized transaction. */
@@ -96,6 +101,7 @@ function parseV0(wire: Uint8Array): {keys: string[]; instructions: {program: num
  * current height, as a real node does.
  */
 export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeCoordinator> {
+  let held: Promise<void> | null = null;
   const fake: FakeCoordinator = {
     mode: 'confirm',
     blockHeight: FAKE_START_HEIGHT,
@@ -111,6 +117,14 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     simulateError: false,
     simulations: [],
     history: new Map(),
+    hold: () => {
+      let release: () => void = () => undefined;
+      held = new Promise<void>(r => (release = r));
+      return () => {
+        held = null;
+        release();
+      };
+    },
   };
   const statusChecks = new Map<string, number>();
   const context = () => ({slot: fake.blockHeight + 50});
@@ -209,6 +223,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
   const json = (route: Route, status: number, body: unknown) => route.fulfill({status, contentType: 'application/json', body: JSON.stringify(body)});
 
   await ctx.route('https://api.noc-tura.io/**', async route => {
+    if (held !== null) await held;
     const req = route.request();
     const url = req.url();
     // B1b-2a: the two failure switches, counted as hits (the request did leave the extension).
```

Create `extension/e2e/visual-vault.spec.ts`:

```ts
import {test, expect, type Page, type Worker} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {MAIN, SAVINGS, contained, launchPopup, seedUnlockedWallet, type Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_MNEMONIC, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {confirmWords, pastePhrase, setPassword, unlockWith} from './vaultPage';

// Spec B1b-2a §8.6, plan 2: every vault-page state (#1–#6, #8–#10, #39, the accounts and reveal forms)
// and the UI tab's #7 and #40, rendered by the real extension at the design's 412 px width (412 × 916,
// the mockups' size), saved for the review against index.html (#sNN). Not a pixel diff: an opus-tier
// reviewer compares each image with the same state using the plan's checklist. Every state asserts its
// own copy before its shot; a state that lasts a moment (the hold, the cooldown, the wrong-word reset,
// the mismatch clear) is shot under Playwright's paused clock, and a state that lasts as long as a
// computation (creating, adding, checking, loading) is held open by the test — never raced.
const DIR = 'test-results/visual';
/**
 * The whole column (`fullPage`), except while #3 is held: a full-page capture resizes the view under the
 * pressed pointer, which the page reads as a release (pointerleave) — those shots are the 412 × 916
 * viewport, which holds the whole grid.
 */
async function shot(page: Page, name: string, o: {fullPage?: boolean} = {}): Promise<void> {
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`, fullPage: o.fullPage ?? true});
}
const OTHER = 'legal winner thank year wave sausage worth useful legal winner thank yellow';
const PASSWORD = 'a long enough password';
const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; remove(k: string): Promise<void>}; session: {set(o: object): Promise<void>}};
};

/**
 * A vault-page tab at the mockups' size, with the clock installed (it follows real time until paused)
 * and the Argon2id worker's answer holdable: `holdKdf()` keeps the next KDF result back until
 * `releaseKdf()` — a test-only wrapper around this page's Worker, so "Creating your wallet…" and
 * "Waiting for your passkey…" stay on screen while they are asserted and shot.
 */
async function vaultTab(h: Harness, path: string, o: {passkeyCreate?: 'null'} = {}): Promise<Page> {
  const page = await h.ctx.newPage();
  await page.setViewportSize({width: 412, height: 916});
  await page.clock.install();
  await page.addInitScript(stub => {
    type Held = {hold: boolean; queue: (() => void)[]};
    const state: Held = {hold: false, queue: []};
    const w = window as unknown as {__kdf: Held; Worker: typeof Worker};
    w.__kdf = state;
    const Native = w.Worker;
    w.Worker = class extends Native {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        let handler: ((e: MessageEvent) => void) | null = null;
        super.onmessage = (e: MessageEvent) => {
          if (state.hold) state.queue.push(() => handler?.(e));
          else handler?.(e);
        };
        Object.defineProperty(this, 'onmessage', {set: (f: (e: MessageEvent) => void) => void (handler = f), get: () => handler});
      }
    } as typeof Worker;
    if (stub === 'null') Object.defineProperty(navigator, 'credentials', {value: {create: async () => null, get: async () => null}});
  }, o.passkeyCreate ?? '');
  await page.goto(`chrome-extension://${h.id}/${path}`);
  return page;
}
const holdKdf = (p: Page) => p.evaluate(() => void ((window as unknown as {__kdf: {hold: boolean}}).__kdf.hold = true));
const releaseKdf = async (p: Page) => {
  // The hold relies on kdf.ts assigning `worker.onmessage`. Were it to use addEventListener, nothing
  // would be held and the "creating" / "adding" shots would race the answer — so the held answer must
  // be there before it is released, and the spec fails loudly otherwise (plan-2 review L6).
  await expect.poll(() => p.evaluate(() => (window as unknown as {__kdf: {queue: unknown[]}}).__kdf.queue.length), {timeout: 60_000}).toBe(1);
  await p.evaluate(() => {
    const k = (window as unknown as {__kdf: {hold: boolean; queue: (() => void)[]}}).__kdf;
    k.hold = false;
    k.queue.splice(0).forEach(f => f());
  });
};
const text = (p: Page, sel: string) => p.locator(sel);
const stored = (sw: Worker): Promise<string> => sw.evaluate(async () => JSON.stringify(((await (chrome.storage.local as unknown as {get(k: string): Promise<Record<string, unknown>>}).get('v1_vault')) as Record<string, unknown>).v1_vault));

test('visual: the create run — #1, #2, #3, #4, #5, #6 and #7', async () => {
  const h = await launchPopup('noctura-e2e-vis-create-');
  try {
    const p = await vaultTab(h, 'unlock.html?mode=welcome', {passkeyCreate: 'null'});
    await expect(p.getByText('A Solana wallet built for private, non-custodial holding.')).toBeVisible();
    await expect(text(p, '.trust-chip')).toHaveText(['E2E encrypted', 'Non-custodial']);
    await shot(p, '01-welcome-idle');
    await p.locator('#wel-create').click();
    await expect(p.getByText('Three layers protect your wallet')).toBeVisible();
    await shot(p, '02-security-intro');
    await p.locator('#int-continue').click();
    await expect(p.getByText('About to show your recovery phrase')).toBeVisible();
    await shot(p, '03-pre-reveal-modal');
    await p.locator('#sg-continue').click();
    await expect(text(p, '#seed-overlay-title')).toHaveText('Press and hold to reveal');
    await shot(p, '03-blurred');
    const words = await text(p, '#seed-grid .term').allTextContents();

    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#seed-grid').hover();
    await p.mouse.down();
    await p.clock.runFor(2_030 + 7_000);
    await expect(text(p, '#seed-chip')).toHaveText('13 s· auto-blur');
    await expect(text(p, '#seed-helper')).toHaveText('Holding to reveal · Auto-blurs at 20 s for safety. Screen readers announce at 10 s and 5 s only.');
    await shot(p, '03-revealed-countdown-13s', {fullPage: false});
    await p.clock.runFor(8_000);
    await expect(text(p, '#seed-chip')).toHaveText('5 s— still memorizing?');
    await shot(p, '03-revealed-countdown-5s', {fullPage: false});
    await p.clock.runFor(5_000);
    await expect(text(p, '#seed-overlay-title')).toHaveText('Still looking?');
    await shot(p, '03-re-blurred-still-looking', {fullPage: false});
    await p.mouse.up();
    await p.mouse.down();
    await p.clock.runFor(2_030);
    await p.mouse.up();
    await expect(text(p, '#seed-stamp')).toHaveText('Acknowledged');
    await expect(text(p, '#seed-lede')).toHaveText('Phrase locked in. Tap continue to verify a few words.');
    await shot(p, '03-confirmed');
    await p.clock.resume();

    await p.locator('#seed-cta').click();
    await expect(p.getByText('Tap the correct word for each position.')).toBeVisible();
    await shot(p, '04-empty');
    const labels = await text(p, '#cnf-slots .label').allTextContents();
    const nth = (i: number) => words[Number(/#(\d+)/.exec(labels[i] ?? '')?.[1]) - 1] ?? '';
    await p.locator('#cnf-pool').getByRole('button', {name: nth(0), exact: true}).click();
    await expect(text(p, '#cnf-slots .slot.filled')).toHaveCount(1);
    await shot(p, '04-partial-correct');
    const wrong = (await text(p, '#cnf-pool button:not([disabled])').allTextContents()).find(w => w !== nth(1)) ?? '';
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#cnf-pool').getByRole('button', {name: wrong, exact: true}).click();
    await expect(text(p, '#cnf-lede')).toHaveText("That's not the right word — let's start over.");
    await expect(text(p, '#cnf-helper')).toHaveText(/^Word #\d+ was wrong\. Slots will reset in a moment\.$/);
    await shot(p, '04-wrong-answer');
    await p.clock.runFor(700);
    await p.clock.resume();
    await expect(text(p, '#cnf-slots .slot.empty')).toHaveCount(3);
    await confirmWords(p, words);
    await p.locator('#cnf-cta').click();
    await expect(p.getByText('All three words matched. Now lock the wallet with a password.')).toBeVisible();
    await shot(p, '04-success');
    await p.locator('#cnf-cta').click();

    await expect(text(p, '#pw-title')).toHaveText('Create a password');
    await p.locator('#pw-field').fill('a few words');
    await expect(text(p, '#pw-meter-label')).toHaveText('11 of 12 characters');
    await shot(p, '05-enter');
    await p.locator('#pw-field').fill(PASSWORD);
    await expect(text(p, '#pw-meter-label')).toHaveText('Long enough');
    await p.locator('#pw-cta').click();
    await expect(text(p, '#pw-title')).toHaveText('Confirm your password');
    await shot(p, '05-confirm');
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#pw-field').fill(`${PASSWORD}!`);
    await p.locator('#pw-cta').click();
    await expect(text(p, '#pw-helper')).toHaveText("Passwords don't match — try again.");
    await shot(p, '05-mismatch');
    await p.clock.runFor(700);
    await p.clock.resume();
    await expect(p.locator('#pw-field')).toHaveValue('');
    await expect(p.locator('#pw-cta')).toBeDisabled();
    await holdKdf(p);
    await p.locator('#pw-field').fill(PASSWORD);
    await p.locator('#pw-cta').click();
    await expect(p.getByText('Creating your wallet…')).toBeVisible();
    await expect(p.getByText('Securing your password takes a few seconds.')).toBeVisible();
    await shot(p, '05-creating');
    await releaseKdf(p);

    await expect(p.getByText('Unlock Noctura with a passkey')).toBeVisible({timeout: 60_000});
    await shot(p, '06-passkey-idle');
    await holdKdf(p);
    await p.locator('#pk-add').click();
    await expect(text(p, '#pk-line')).toHaveText('Waiting for your passkey…');
    await shot(p, '06-adding');
    await releaseKdf(p);
    await expect(text(p, '#pk-line')).toHaveText('This device cannot unlock the wallet with a passkey; your password still works.', {timeout: 60_000});
    await shot(p, '06-unsupported');
    await p.locator('#pk-continue').click();

    await p.waitForURL(/wallet\.html#\/created$/);
    await expect(p.getByText('Wallet created')).toBeVisible();
    await expect(p.getByText('Wallet is ready — open the Noctura icon')).toBeVisible();
    await shot(p, '07-created');
    // #7 reads nothing from the network; the popup's #11 does, so contained() sees the route at work.
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    await popup.close();
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    await p.reload();
    await expect(p.getByText('Wallet created. Unlock it to use it.')).toBeVisible();
    await shot(p, '07-created-locked');

    // #1 again, now that a wallet exists.
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
    await expect(p.getByText('A wallet already exists in this browser. Nothing was changed.')).toBeVisible();
    await shot(p, '01-welcome-exists');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: import — #8’s states, #5 import, and #40', async () => {
  const h = await launchPopup('noctura-e2e-vis-import-');
  try {
    const p = await vaultTab(h, 'unlock.html?mode=import');
    await expect(p.getByText('Bring an existing wallet onto this device.')).toBeVisible();
    await shot(p, '08-phrase-idle');
    // The clock paused BEFORE typing: the idle timer counts from this keystroke, exactly.
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#imp-phrase').fill('legend frost marble river coral anchor valid echo raven');
    await expect(text(p, '#imp-count')).toHaveText('9 of 12 words entered.');
    await shot(p, '08-typing');
    await p.clock.runFor(48_000);
    await expect(text(p, '#imp-idle-title')).toHaveText('Auto-clearing in 12 s');
    await expect(p.locator('#imp-keep')).toBeVisible();
    await shot(p, '08-idle-timer-active');
    await p.locator('#imp-keep').click();
    await p.clock.resume();
    await p.locator('#imp-phrase').fill('');
    await pastePhrase(p, E2E_MNEMONIC);
    await expect(p.getByText('Pasted from clipboard. Noctura cannot clear your clipboard — clear it yourself.')).toBeVisible();
    await expect(p.getByText('Valid 12-word BIP-39 phrase · checksum OK')).toBeVisible();
    await shot(p, '08-paste-detected');

    // The probe unanswered: "Checking…" held open, then the scheme choice (balances could not be checked).
    const release = h.fake.hold();
    h.fake.network = 'unreachable';
    await p.locator('#imp-continue').click();
    await expect(text(p, '#imp-line')).toHaveText('Checking which addresses hold funds…');
    await shot(p, '08-checking');
    release();
    await expect(text(p, '#imp-choose-why')).toHaveText('Balances could not be checked. Choose the address type to use.');
    await shot(p, '08-choose-scheme');
    h.fake.network = 'ok';
    await p.locator('#imp-choose-slip10').click();
    await expect(text(p, '#pw-step')).toHaveText('Import · 2 / 2');
    await shot(p, '05-import-enter');
    await setPassword(p, PASSWORD);
    await p.waitForURL(/wallet\.html#\/imported$/, {timeout: 60_000});
    await expect(p.getByText('1 account · 1 token recovered. Welcome back.')).toBeVisible();
    await expect(p.getByText('Copying puts the address on your clipboard. Noctura does not clear it afterwards.')).toBeVisible();
    await shot(p, '40-single-account');

    const hold = h.fake.hold();
    await p.reload();
    await expect(p.getByText('Checking what this wallet holds…')).toBeVisible();
    await shot(p, '40-loading');
    hold();
    await expect(p.getByText('Wallet imported', {exact: true})).toBeVisible();

    h.fake.defaultLamports = 0;
    await p.reload();
    await expect(p.getByText('Wallet imported · empty')).toBeVisible();
    await shot(p, '40-no-assets-empty');
    h.fake.network = 'unreachable';
    await p.reload();
    await expect(p.getByText('Balances could not be read right now.')).toBeVisible();
    await shot(p, '40-unreachable');
    h.fake.network = 'ok';
    await p.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    await p.reload();
    await expect(p.getByText('Wallet imported. Unlock it to see what was recovered.')).toBeVisible();
    await shot(p, '40-locked');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #40 with two accounts, and the D26 state', async () => {
  const h = await launchPopup('noctura-e2e-vis-40-');
  try {
    await seedUnlockedWallet(h.sw, [MAIN, SAVINGS]);
    const p = await vaultTab(h, 'wallet.html#/imported');
    await expect(p.getByText('2 accounts · 1 token recovered.')).toBeVisible();
    await expect(text(p, '.s8-token-row .sec')).toHaveText(['Solana · 2 accounts']);
    await shot(p, '40-multi-account');
    h.fake.network = 'forbidden';
    const q = await vaultTab(h, 'wallet.html#/imported');
    await expect(q.getByText('The server is not answering for now — try again in 10 minutes.')).toBeVisible();
    await shot(q, '40-refused-d26');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #9, #39, the restore and retry steps, the accounts and reveal forms', async () => {
  const h = await launchPopup('noctura-e2e-vis-unlock-');
  try {
    await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
    const p = await vaultTab(h, 'unlock.html');
    await expect(p.getByText('Enter your password to unlock.')).toBeVisible();
    await shot(p, '09-idle');
    await p.locator('#unl-password').fill('not the password at all');
    await p.locator('#unl-submit').click();
    await expect(text(p, '#unl-helper')).toHaveText('That did not unlock the wallet.', {timeout: 60_000});
    await shot(p, '09-error');
    await expect(p.locator('#unl-submit')).toBeEnabled();
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#unl-password').fill('not the password at all');
    await p.locator('#unl-submit').click();
    await expect(p.locator('#unl-cooldown').getByText('Wait a moment', {exact: true})).toBeVisible({timeout: 60_000});
    await expect(text(p, '#unl-timer')).toHaveText('0:01');
    await shot(p, '09-cooldown');
    await p.clock.runFor(1_600);
    await p.clock.resume();
    await expect(p.locator('#unl-submit')).toBeEnabled();
    await p.locator('#unl-password').fill(E2E_PASSWORD);
    await p.locator('#unl-submit').click();
    await expect(text(p, '#unl-notice')).toHaveText('Unlocked. Open the Noctura icon to continue.', {timeout: 60_000});
    await shot(p, '09-unlocked');
    // The popup reads the fake once, so contained() sees the route at work.
    const popup = await h.openPopup();
    await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible();
    await popup.close();

    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=forgot`);
    for (const [n, title] of [[1, 'Forgot your password?'], [2, 'Enter your words'], [3, 'Set a new password']] as const) {
      await expect(text(p, '#fg-title')).toHaveText(title);
      await expect(text(p, '#fg-step')).toHaveText(`${n} / 3`);
      await shot(p, `39-step-${n}-card`);
      if (n < 3) await p.locator('#fg-next').click();
    }
    await p.locator('#fg-next').click();
    await pastePhrase(p, OTHER);
    await p.locator('#imp-continue').click();
    await expect(p.getByText('This phrase does not belong to the wallet in this browser. Nothing was changed.')).toBeVisible({timeout: 30_000});
    await shot(p, '08-restore-not-this-wallet');
    await p.getByRole('button', {name: 'Try another phrase'}).click();
    await pastePhrase(p, E2E_MNEMONIC);
    await p.locator('#imp-continue').click();
    await expect(text(p, '#pw-step')).toHaveText('Restore · 2 / 2', {timeout: 30_000});
    await shot(p, '05-restore-enter');

    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=import&source=retry`);
    await expect(p.getByText('Confirm with the password of the wallet you are replacing')).toBeVisible();
    await shot(p, '08-retry-password');

    await unlockWith(p, h.id, E2E_PASSWORD);
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=accounts`);
    await expect(p.getByRole('button', {name: 'Add an account'})).toBeVisible();
    await shot(p, 'accounts-form');
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reveal`);
    await expect(p.locator('#v-reveal h1')).toHaveText('Your recovery phrase');
    await shot(p, 'reveal-form');

    await h.sw.evaluate(() => chrome.storage.local.set({v1_vault: null}));
    await p.goto(`chrome-extension://${h.id}/unlock.html`);
    await expect(text(p, '#unl-notice-line')).toHaveText("This wallet's stored data is damaged.");
    await shot(p, '09-damaged');
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=welcome`);
    await expect(text(p, '#wel-notice-line')).toHaveText("This wallet's stored data is damaged.");
    await shot(p, '01-welcome-damaged');
    await h.sw.evaluate(() => chrome.storage.local.remove('v1_vault'));
    await p.goto(`chrome-extension://${h.id}/unlock.html`);
    await expect(text(p, '#unl-notice-line')).toHaveText('No wallet on this browser yet.');
    await shot(p, '09-no-wallet');
    expect(await stored(h.sw)).toBeUndefined();
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #10 — the action from the background, and each of its states', async () => {
  const h = await launchPopup('noctura-e2e-vis-reauth-');
  try {
    await h.sw.evaluate(async e => chrome.storage.local.set({v1_vault: e}), await makeEnvelope());
    const ui = await h.ctx.newPage();
    await unlockWith(ui, h.id, E2E_PASSWORD);
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    const challenge = async (): Promise<string> => {
      for (let i = 0; i < 3; i++) {
        const r = (await ui.evaluate(m => chrome.runtime.sendMessage(m), {type: 'wallet.prepareSend', account: E2E_ACCOUNTS[0], intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}})) as {ok: boolean; data?: {reauth: {challengeId: string} | null}};
        if (r.ok && r.data?.reauth) return r.data.reauth.challengeId;
      }
      throw new Error('no challenge');
    };
    const id = await challenge();
    const p = await vaultTab(h, `unlock.html?mode=reauth&challenge=${id}`);
    await expect(text(p, '#ra-about')).toHaveText('You are about to send');
    await expect(text(p, '#ra-amount')).toHaveText('2.4800');
    // 2.48 of 10 SOL to a new address at $150: the engine's three reasons, one fixed line each.
    await expect(text(p, '#ra-reasons p')).toHaveText([
      'Re-auth required for the first send to a new address.',
      'Re-auth required for transactions over 5 % of balance.',
      'Re-auth required for transactions over $100.',
    ]);
    await shot(p, '10-idle');
    await p.locator('#ra-password').fill('not the password at all');
    await p.locator('#ra-confirm').click();
    await expect(text(p, '#ra-helper')).toHaveText('That did not confirm it.', {timeout: 60_000});
    await shot(p, '10-error');
    await expect(p.locator('#ra-confirm')).toBeEnabled();
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 1_000));
    await p.locator('#ra-password').fill('not the password at all');
    await p.locator('#ra-confirm').click();
    await expect(p.locator('#ra-cooldown').getByText('Wait a moment', {exact: true})).toBeVisible({timeout: 60_000});
    await shot(p, '10-cooldown');
    await p.clock.runFor(1_600);
    await p.clock.resume();

    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${'ab'.repeat(16)}`);
    await expect(text(p, '#ra-notice-line')).toHaveText('This confirmation has expired. Start the send again from the Noctura icon.');
    await shot(p, '10-expired');
    const bad = 'cd'.repeat(16);
    await h.sw.evaluate(
      async ({b, about}) => chrome.storage.session.set({v1_reauth: {[b]: {digest: 'd', issuedAt: Date.now(), expiresAt: Date.now() + 120_000, satisfied: false, about}}}),
      {b: bad, about: {kind: 'send', account: E2E_ACCOUNTS[0], token: 'SOL', recipient: RECIPIENT, amount: '1', networkLamports: '5000', markupLamports: '0', markupReason: 'charged', rentLamports: '0', reasons: ['first-send'], thresholdCents: 10_000}},
    );
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${bad}`);
    await expect(text(p, '#ra-notice-line')).toHaveText('The details of this action could not be shown.');
    await expect(p.locator('#ra-confirm')).toBeHidden();
    // Its account is an address by itself, so Cancel can discard the send (plan-2 review H1). The
    // [Close] variant needs a stored record whose account is not an address, which the background
    // never keeps (it drops the record): asserted in the DOM test only.
    await expect(text(p, '#ra-cancel')).toHaveText('Cancel send');
    await shot(p, '10-undescribable');

    const live = await challenge();
    await p.addInitScript(() => Object.defineProperty(window, 'close', {value: () => undefined}));
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${live}`);
    await expect(text(p, '#ra-about')).toHaveText('You are about to send');
    await p.locator('#ra-cancel').click();
    await expect(text(p, '#ra-notice-line')).toHaveText('Send cancelled. Nothing was sent.');
    await shot(p, '10-cancelled');

    await ui.evaluate(() => chrome.runtime.sendMessage({type: 'vault.lock'}));
    await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${live}`);
    await expect(text(p, '#ra-notice-line')).toHaveText('The wallet locked while you were confirming. Unlock it and start the send again.');
    await shot(p, '10-not-unlocked');
    contained(h);
  } finally {
    await h.close();
  }
});
```

Modify `extension/e2e/visual.spec.ts`:

```diff
diff --git a/extension/e2e/visual.spec.ts b/extension/e2e/visual.spec.ts
index c2157f4..236c37f 100644
--- a/extension/e2e/visual.spec.ts
+++ b/extension/e2e/visual.spec.ts
@@ -20,6 +20,7 @@ test('visual: the plan-1 screens and states at 412 × 600', async () => {
     await h.sw.evaluate(() => (globalThis as unknown as {chrome: {storage: {session: {clear(): Promise<void>}}}}).chrome.storage.session.clear());
     const locked = await h.openPopup();
     await expect(locked.getByText('Welcome back')).toBeVisible();
+    await expect(locked.getByRole('button', {name: 'Forgot password?'})).toBeVisible();
     await shot(locked, '09-locked');
     await locked.close();
```

- [ ] **Step 2: Run the visual pass — a normal launch, then offline.**

Run: `npm run build && npx playwright test e2e/visual-vault.spec.ts e2e/visual.spec.ts && unshare -rn npx playwright test e2e/visual-vault.spec.ts`
Expected: 6 passed, then 5 passed; `test-results/visual/` holds the 58 plan-2 shots beside plan 1's own.

- [ ] **Step 3: The review against the design — by an opus-tier reviewer (plan-1 lesson).** The controller dispatches a reviewer of opus tier (a sonnet pass found 2 of at least 11 drifts in plan 1) and shows it, for each shot, the image and the same state in `/home/user/Downloads/index.html` (`#s1`–`#s10`, `#s39`, `#s40`, `#s7`; the A mockups; 412 × 916 phone frames). Not a pixel diff. Per state the reviewer checks (spec §8.6):
  1. colours are the tokens the DS class map names (accent, danger/warning/success/info, surfaces);
  2. each text element's type tier (`.noc-h1`, `.noc-h2`, `.noc-body`, `.noc-body-sm`, `.noc-caption`, `.noc-overline`, `.noc-mono`, `.noc-numeral`, `.noc-balance-lg`, `.noc-display`) matches the class map;
  3. element order and grouping match the mockup;
  4. every string matches the design or is an adapted string listed in the spec (or a controller addition listed in this plan's Scope);
  5. every element is present, or appears in that screen's "Differs" list (Step 4 adds plan 2's);
  6. controls are ≥ 48 px, there is no horizontal scroll at 412 px, and the sticky bar never covers content that cannot scroll clear;
  7. dark theme only;
  8. #10's fees read exact and ungrouped ("0.00000505 SOL"): the design's thin grouping (plan-1 L7) — fix it or keep the Differs entry Step 4 adds (plan-2 review L2);
  9. `COMMON.unreadable` ("…could not be read. Reload this page.") has no shot: no state a browser reaches without failing storage shows it (asserted in the DOM tests); the reviewer confirms the line reads right on #8's restore and retry notices, where no action follows it (plan-2 review L9). Likewise #10's `[Close]` variant of `undescribable` (the background never keeps a record whose account is not an address — DOM test only).
  Every drift is fixed to the design or declared in the spec's Differs list — none is left implicit. The findings go in the PR.

- [ ] **Step 4: Edit the spec.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 967c29b..9cc56a2 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -190,8 +190,10 @@ mutation test in `scripts/__tests__`):
   absolute path. With Vite's `base: './'` a `public/` asset referenced absolutely stays
   `/fonts/…`, which resolves against the extension origin's root from any page, the vault page
   included. The build test asserts both woff2 files exist at `dist/app/fonts/` and that the
-  built `unlock` CSS names `/fonts/Geist-Variable.woff2`. E2E spec 1 asserts
-  `document.fonts.check('16px Geist')` is true on `unlock.html`.
+  built `unlock` CSS names `/fonts/Geist-Variable.woff2`. E2E spec 1 asserts on `unlock.html` that
+  `document.fonts.load('16px Geist')` resolves to at least one face — the real assertion, since
+  `document.fonts.check()` is also true when no face named Geist exists at all — and keeps
+  `check('16px Geist')` beside it (plan-2 review ruling 5).
 
 ### 1.3 The UI bundle (popup and tab)
 
@@ -739,6 +741,12 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   - "Terms" and "Privacy Policy" are plain text, not links, until the privacy policy exists (a
     release gate, parent §5 / B1e). The sentence stays.
   - `exists` state added (the engine never overwrites a wallet).
+  - **Plan 2:** a stored v1_vault that is not an envelope (null included — the background calls it
+    `stored-invalid`) shows "This wallet's stored data is damaged." + "Your funds stay on Solana; your
+    recovery phrase still controls them. To use them here, remove Noctura from this browser, install
+    it again and import the phrase." and no CTAs — **the second line is a controller addition —
+    confirmed by the owner 2026-10-01** (its next step added per the plan-2 review); repairing a damaged vault is
+    #37's (B1b-2b).
 
 ### 3.2 #2 security-intro
 
@@ -782,7 +790,9 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
     fine — your hand is remembering enough." **→ adapted** ("Tap-and-hold" → "Press and hold"); the
     hold resets and must be released and pressed again.
   - `confirmed`: lede "Phrase locked in. Tap continue to verify a few words."; grid re-blurred;
-    stamp "Acknowledged" (`.noc-overline`, `--success`); `[I've written it down]` → #4.
+    stamp "Acknowledged" (`.noc-overline`, `--success`); `[Continue]` → #4. (3b–3d read "I've
+    written it down", disabled until one full hold; 3e reads "Continue" — the design is binding,
+    plan-2 review ruling 1.)
 - **Mechanics:** hold timer 30 ms ticks to 2 s; `pointerup`/`pointerleave`/`blur`/`keyup` re-blur;
   the 20 s auto-blur fires even while held; every timer is cleared on leaving the step.
   `prefers-reduced-motion` removes the blur transition.
@@ -791,12 +801,18 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
     (D1).
   - FLAG_SECURE, haptics and the predictive-back exit modal dropped (no browser equivalent).
     Leaving the page discards the mnemonic, and a new visit generates a new one.
+  - **Plan 2:** the CTA reads "I've written it down" (disabled until one full hold) and, in
+    `confirmed`, "Continue" — as 3e draws it; both go to #4. The design's route tag on the gate is
+    not shown. The chip's countdown is announced at 10 s and 5 s through a separate live region (the
+    chip itself is aria-hidden). Leaving #3 or #4 takes their words out of the DOM.
 
 ### 3.4 #4 seed-confirm
 
 - **States:** `empty` (step "3 / 5", "Confirm phrase", "Tap the correct word for each position.",
-  slots "Word #5" / "Word #12" / "Word #19" with "— select —", a pool of 9 words: 1 correct + 8
-  BIP-39 distractors per slot, generated once, `[Confirm]` disabled); `partial-correct` (filled
+  slots "Word #5" / "Word #12" / "Word #19" with "— select —", a pool of nine: each slot's word
+  with two BIP-39 distractors of the same first letter, none a phrase word, generated once
+  (`screen.md`'s "1 correct + 8 distractors" counts from one slot's point of view; plan-2 review
+  ruling 6), `[Confirm]` disabled); `partial-correct` (filled
   slots, used buttons dimmed); `wrong-answer` (lede "That's not the right word — let's start
   over." in `--danger`, slot flips `--danger` with the 320 ms shake, helper "Word #12 was wrong.
   Slots will reset in a moment.", reset after ~700 ms); `success` (96 px ring, "Phrase
@@ -838,6 +854,9 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
 - **Differs:**
   - The 6 PIN dots and keypad are replaced by a password field and confirm field (D7).
   - The step dots keep the design's two-step indicator.
+  - **Plan 2:** on #39's restore path the eyebrow reads "Recovery" (#39's), with "Restore · 2 / 2";
+    `send-open` and a failed store keep the password in the page behind `[Try again]` (the field
+    hidden), as E5 asks.
   - FLAG_SECURE dropped (D1).
 
 ### 3.6 #6 biometric-setup → passkey (D9)
@@ -863,6 +882,7 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
 - **Navigation:** any end → the UI tab `wallet.html#/created`.
 - **Differs:** copy as marked; the fingerprint icon becomes a key icon; the native BiometricPrompt
   becomes the browser's WebAuthn prompt.
+  **Plan 2:** the back arrow is not drawn — the wallet is already stored when #6 shows.
 
 ### 3.7 #7 onboard-success (UI tab `#/created`)
 
@@ -948,6 +968,19 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
     (D1; the clipboard half is false too).
   - FLAG_SECURE dropped.
   - Added: the D8 banner, the scheme choice and the password step.
+  - **Plan 2:** the phrase stays editable in a field (inside the design's `.ta-wrap`), and the mono
+    cell grid shows the words typed so far under it; the counter targets 12 words up to 12, then 24
+    ("9 of 12 words entered."). The restore and retry refusals replace the field with their line and
+    one button; `busy` and `unlocked` offer `[Start again]` — **controller addition — awaiting the
+    owner** — to #39 (restore) or the retry path's start (retry).
+  - **Plan 2 (plan-2 review M4, L3, H2):** the phrase stays in page memory while this page is open, a
+    hidden tab included — §3.5's hidden-tab rule is the password's, and dropping the phrase under an
+    open #5 would end the run on an untrue "That is not a valid 12- or 24-word recovery phrase." It
+    goes when the wallet is stored, at every other end of the run, and with the page. Back from #5
+    returns to #8 with the phrase in the field on every path (plain import, restore, retry). On the
+    retry path the new wallet prepared under #5's password (its envelope and its session keys) is
+    kept only behind a pending `[Try again]`, and goes when the tab is hidden, with that password;
+    the factor proof goes at every end of the run.
 
 ### 3.9 #9 unlock
 
@@ -975,6 +1008,8 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   - The attempt counter and "Cycle 1 of 2" line are removed (D11).
   - The keypad is replaced by a password field (D7).
   - FLAG_SECURE dropped (D1).
+  - **Plan 2:** the cooldown card keeps the design's helper line ("Cooldown · 0 minutes 12 seconds
+    remaining"); the ring shows the share of the wait left.
 
 ### 3.10 #10 unlock-send (re-authentication)
 
@@ -998,7 +1033,10 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   - `cooldown`: #9's cooldown card with "That did not confirm it. Wait a moment before trying
     again." (the design reuses #9's cooldown on #10).
   - **extension-only:** `undescribable` ("The details of this action could not be shown." + only
-    `[Cancel send]`, E3); `not-unlocked` ("The wallet locked while you were confirming. Unlock it
+    `[Cancel send]`, E3, which discards the send by its account — the one field re-validated by
+    itself; when even that is not an address: + "Nothing was sent. Start the send again from the
+    Noctura icon." and `[Close]`, which closes the tab and claims no cancel — **controller addition —
+    confirmed by the owner 2026-10-01**, plan-2 review H1); `not-unlocked` ("The wallet locked while you were confirming. Unlock it
     and start the send again." + `[Unlock]` → `?mode=unlock`, with no return target: the lock
     cleared the prepared send, so there is nothing to resume, as §7.1 says; review M7);
     `mismatch-locked` ("That did not match this wallet, so the wallet has been
@@ -1024,6 +1062,19 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   - **`[Cancel send]` closes the tab** (review L2). The design returns to #20, but the popup that
     showed #20 closed when this tab opened, and a tab cannot reopen it. It discards the prepared send
     first (E7), so nothing is left to resume.
+  - **Plan 2:** "Network fee" is `networkLamports` — priority included: `about` (E3) carries no
+    `priorityLamports`, so #10 cannot split it as §4.5's fee rows do on #19 and #20 (plan-2 review
+    ruling 2: plan 2 is UI-only, §12; plan 3, which builds #19/#20's rows, may add
+    `priorityLamports` to `about` so the three screens agree). The amounts appear when non-zero; a
+    zero Noctura fee shows its reason line (the carried rule), and `charged` with a zero fee is not
+    described. Fees are exact and ungrouped ("0.00000505 SOL"); the design's thin grouping is listed
+    for the visual review (plan-1 L7). The cooldown's disabled button reads "Confirm paused" and a
+    settings challenge's cancel reads "Cancel" (it only closes the tab; the challenge simply
+    expires) — **both controller additions — confirmed by the owner 2026-10-01**. A discard the background refuses
+    says "Something went wrong. Try again." and keeps the screen: "Send cancelled" is shown only when
+    it is true — including `undescribable` (H1, above). In `expired`, `not-unlocked`,
+    `mismatch-locked` and every other notice with nothing to cancel, the top bar's X closes the tab
+    and claims nothing (plan-2 review L4).
 
 ### 3.11 #39 forgot-pin → "Forgot password?"
 
@@ -1060,6 +1111,14 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
     "A passkey is not carried over; you can add one again later." (passkey management is B1b-2b).
   - "24 words" becomes "12 or 24 words" (import accepts both).
   - "#36 change-pin" is not a step: import sets the password itself.
+  - **Plan 2 (controller adaptations of the design's step copy — confirmed by the owner 2026-10-01):** step 1's
+    card 2 "You'll be taken to the import screen. Type or paste your words." and card 3 "Once your phrase is verified against this
+    wallet, you'll choose a new password (at least 12 characters). The old password stops working.";
+    step 2's title "Enter your words", lede "Type or paste the 12 or 24 words, in order." (the design's
+    word picker does not exist) and card 3 "After your phrase is verified."; step 3's card 3 "You'll
+    choose a new password. The old password stops working. A passkey is not carried over; you can add
+    one again later." The FLAG_SECURE hints are removed (D1). The mockup's `.s-secintro` scope is not
+    carried: none of its rules applies to #39's cards.
 
 ### 3.12 #40 import-success (UI tab `#/imported`)
 
@@ -1103,6 +1162,17 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   - `[Open wallet]` becomes the D10 line.
   - Long-press menu and 30 s clipboard clear dropped.
   - The `v1_imported` MMKV annotation does not apply.
+  - **Plan 2:** the address is in groups of four at equal weight (`AddressGroups`), not the design's
+    first-6/last-6 `.ck` highlight (§11.7's poisoning note). Under it, #7's line "Copying puts the
+    address on your clipboard. Noctura does not clear it afterwards." — the carried rule, missing
+    from this section's copy (**controller addition — confirmed by the owner 2026-10-01**, plan-2 review M3). One
+    token reads "1 token" (**controller addition — confirmed by the owner 2026-10-01**). "≈ X SOL" is truncated,
+    never rounded up (plan-1 ruling L6, as #11; plan-2 review M1). Balances are read for the first
+    six accounts (≤ 6, above); past six the copy claims only what was read: "N accounts · M tokens
+    recovered from the first 6." and "across the first 6 of N accounts" (**controller addition —
+    confirmed by the owner 2026-10-01**, plan-2 review M2), and a wallet with more never shows `no-assets-empty`. The empty
+    state's sticky bar is the D10 line and `[Try a different seed]`, as listed above (no `[Close this
+    tab]` there).
 
 ---
 
@@ -1114,8 +1184,8 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   (primary) → `tabs.create('unlock.html?mode=unlock')` + `window.close()`; "Forgot password?" →
   `?mode=forgot`. No password field: the password only ever exists in the vault page (D12).
 - **Differs:** a derived screen. The password field and keypad are in the tab (D12).
-  - **Plan-1 stand-in:** "Forgot password?" is absent until #39's `?mode=forgot` exists — deferred to
-    plan 2 (ruling from the plan review; Task 17 fix round 1).
+  - "Forgot password?" (`.btn-tertiary`) → `?mode=forgot` in a tab, as #9 — built in plan 2 (the
+    plan-1 stand-in is gone).
 
 ### 4.2 #12 send
 
@@ -1934,8 +2004,9 @@ The popup is opened as `chrome-extension://<id>/popup.html` in a page sized 412
 cannot click the toolbar action; stated). Specs:
 1. **Onboarding create:** welcome → #2 → #3 (modal, hold 2 s, confirmed) → #4 (picks the right
    words from the page's own grid) → #5 (password, confirm) → #6 skip → `wallet.html#/created` shows
-   the address; the popup then shows #11. On `unlock.html`, `document.fonts.check('16px Geist')` is
-   true (review L5).
+   the address; the popup then shows #11. On `unlock.html`, `document.fonts.load('16px Geist')`
+   resolves to at least one face and `document.fonts.check('16px Geist')` is true (review L5;
+   plan-2 review ruling 5: `check()` alone passes when no Geist face exists).
 2. **Import:** #8 paste a fixture phrase → scheme auto → #5 → `#/imported` with the fake's balances.
 3. **Unlock:** popup locked screen → tab → wrong password → cooldown → right password → popup #11.
 4. **Send with re-auth:** #11 → #12 → #43 pick SOL → #19 shows the balance delta and "After" from
@@ -1959,7 +2030,10 @@ cannot click the toolbar action; stated). Specs:
     password?" → #39 → `[Continue to import]` → #8 with a *different* valid phrase →
     `not-this-wallet`, and the stored envelope is byte-identical afterwards → the right phrase → #5
     new password → `#/imported` shows both accounts; the old password no longer unlocks and the new
-    one does; an address sent to before the restore is still "Verified · sent before" on #12 (D40).
+    one does; an address sent to before the restore is still known (D40) — in plan 2 asserted
+    through the engine's `wallet.recipientInfo` (#12 is plan 3's); plan 3 restores the on-screen
+    "Verified · sent before" check, folded into spec 11, which already drives #12 after a confirmed
+    send (plan-2 review ruling 4).
     A second run with a pending send open (the fake in `expire` mode, before expiry) gets
     `send-open` and the envelope is unchanged; after expiry the restore goes through.
 11. **#12 recipient hints (E6):** a first-time address shows the state-6 banner and "Review &
```

- [ ] **Step 5: Commit.**

```bash
cd "$(git rev-parse --show-toplevel)"
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/e2e/fakeCoordinator.ts extension/e2e/visual-vault.spec.ts extension/e2e/visual.spec.ts
git commit -m "test(extension): the plan-2 visual pass — every vault-page state, #7 and #40 at 412 px — and the spec’s Differs entries" -m "Co-Authored-By: <the executing model's own line>"
```

---

## Before the PR (the standing rules)

- [ ] Reproduce CI with **only** `web/` and `extension/` installed, on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`): `npm ci --ignore-scripts` in both, `npm run verify` in both, `npm run e2e` in `extension/` — in a normal launch and under `unshare -rn` if the runner has it. No task touches the root `src/` or `core/`, so the root jest is not required by the rules; the dry run ran it anyway (green).
- [ ] `node scripts/check-no-tge-date.mjs` from the repository root (the repo-wide gate, PR #100) — this plan and every file it adds are clean.
- [ ] The opus-tier visual review's findings (Task 18 Step 3) are in the PR description, each fixed or declared in the spec's Differs.

## Self-review

- **Spec coverage.** §3.1–§3.12: every state of #1–#10, #39, #7, #40 has its copy in a DOM/component test and its shot in Task 18 (states with no shot: #9 `unlocking` and #10 `Checking…` — one-line helper states inside `idle`/`error`, asserted in the DOM tests; #6 `added` and `failed` — need a real authenticator or a failing store; asserted in the DOM tests). §1.2: modes (Task 1), strings (Tasks 3–14), the view helpers (Task 4), the gate rules (Tasks 5, 14). E3's vault half (Tasks 3, 11), E5's (Tasks 2, 12, 13), E7's #10 caller (Task 11). §4.1's "Forgot password?" (Task 10). §7.6 rule 6 on the vault page's buttons: Create (#5), Import (#8 Continue), Unlock, Confirm (#10), `[Cancel send]` (#10), `[Confirm]` on the retry path's password step (`rp-confirm`), Add a passkey, Add account — each has a double-click test; the UI tab's `[Try a different seed]` (`LockedButton`) has one too (review M6). §8.5 specs 1, 2, 3, 10, 12 (Task 17); §8.6 (Task 18). §12's resume stand-in (Task 15).
- **Placeholders.** None: every step has its code, its command and its expected output; the one generated file (`design-ext.css`) has its generator and its hash.
- **Key material.** Scope 19 states each lifetime; the tests that hold it: `seed.test` (#3 keeps no phrase after it is left), `import.test` (a hidden tab keeps the phrase under an open #5), `restore.test` (a hidden tab drops the held password), `retry.test` (`holds()` after every terminal outcome; B prepared gone on a hidden tab).
- **Type consistency.** `PageDeps`, `PageTarget`, `PasswordRun`/`PasswordScreen`, `ImportScreen`, `SeedProof`/`FactorProof`, `Description`, `Route` and `Platform` are used as Task N's Interfaces block states; Task 12 widens `PasswordRun.finish`'s answer (`stop: boolean` → `then`) and updates every caller and test in the same diff. The dry run's task-by-task replay proved each task compiles and passes on its own predecessor.
- **Plan 3 must know (the carry list):** `vault.challengeInfo`'s `about` has no `priorityLamports`, so #10's "Network fee" includes the priority fee — when plan 3 builds #19/#20's rows it may add the field to E3 (validated in `isAbout` and in `challenge.ts`'s closed alphabet) so the three screens agree (review ruling 2); spec E2E 10's "Verified · sent before" on #12 is asserted through `wallet.recipientInfo` in plan 2 — plan 3 restores the on-screen check inside spec 11 (ruling 4); `wallet.html#/send/resume?account=` is a stand-in (Task 15's `Resume.tsx`) to replace with #20 `confirmed`; `firstRoute` already validates the account; `PageTarget`'s resume target is built by `resumeTarget()` only; `PasswordRun`'s `retry` step exists for any flow that must keep a password in page memory; the class gate still ignores ancestors for `src/app` (extend `unstyledClasses` to #12–#54's tests).

## Dry-run findings (each fixed in the code above)

1. **Every vault screen rendered at once in a real browser.** The design's classes set `display` (`.screen`, `.sticky-bar`, `.auto-blur-chip` …) and an author `display` beats the browser's own `[hidden]` rule. happy-dom has no layout, so every DOM test passed; the first E2E run found it (#3's chip counted as visible before the hold). Fixed with `[hidden] { display: none !important; }` in `unlock.css`, pinned by a test (Task 5).
2. **#6's Skip stayed disabled after #5 stored the wallet.** The page gate was released by #5's action, whose `render` ran — not #6's. Fixed: the gate notifies every mounted screen (`PageGate.onIdle`, Task 8).
3. **#4 left three phrase words in the DOM** after the run moved on (a flaky test exposed it — it failed only when the phrase word checked happened to be one of the three). Fixed: leaving #4 empties its slots and pool; the test now checks all 24 words with word boundaries (Task 8).
4. **The stand-alone gate failed on the vault page's own copy** ("Continue to import" in `strings.ts` read as `import '…'`). Fixed: the rule ignores references that are not module specifiers, as the vault-page walk already did; a real import still fails (Task 5).
5. **The class-coverage helper misread sibling combinators** (`.ring + .timer` → `.ring *+ .timer`), and `querySelector` scoped a selector's ancestors to the subtree. Fixed in `styled.ts` before any screen relied on it, with tests for both (Task 5).
6. **#39 carried the design's `.s-secintro` scope, which styles nothing there** — the ancestor-aware check flagged it; removed and declared (Scope 11).
7. **E2E races:** spec 3's `contained()` ran before #11's balance read reached the fake (assert the balance first); `getByText('Wait a moment')` matched #9's and #10's hidden headings (scope to `#unl-cooldown`); a full-page screenshot under a pressed pointer released #3's hold (viewport shots for the held states); #8's idle timer was read one second late when the clock was paused after typing (pause before typing). All fixed in Tasks 17–18; both launch modes pass twice in a row.
8. **#10's reasons for 2.48 of 10 SOL** are three (first-send, over-5-percent, over-usd-threshold), not two — the visual spec asserts the engine's order.
9. **Pre-existing, from plan 1:** `src/unlock/__tests__/accountsFlow.test.ts` › "refuses an account past MAX_ACCOUNTS (100) by name" derives 100 keys and takes ~6 s under parallel CPU load, past vitest's 5 s default — it failed twice in the first dry run while other suites ran concurrently (and on plan 1's own tree under the same load), and passed alone every time. Fixed in Task 1 with a `30_000` timeout (the review: in this PR, not later).
10. **Revision 2 (the review's fixes), dry-run catch:** the retry run re-used B prepared under a password §3.5 had already dropped — see Scope 21; fixed in Task 13 with a test that fails on the old code.

## Execution handoff

Plan complete. Execute with superpowers:subagent-driven-development (a fresh implementer per task, the two-stage review between tasks; the visual review of Task 18 by an opus-tier reviewer), or superpowers:executing-plans in one session with checkpoints.
