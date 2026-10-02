# Noctura Extension B1b-2a · Plan 3 — the send flow (#12, #43, #19, #20, #21, #54, #44) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build spec §12's plan 3 ("B1b-2a-3 — send flow"): #12 with E6's hints, #43 from its chip, #19, #20 (the §4.5 resume, one tap per broadcast, C5's one automatic re-prepare and `[Refresh]`, no autofocus), #21, #54, #44 on `failure`; remove plan 1's and plan 2's stand-ins (#11's Send, the pending strip, #26's PENDING rows, #27's and #44's `[Try again]`, the `#/send/resume` stand-in replaced by #20); E2E specs 4, 5 and 11; the six carries of the brief. This is the first plan that broadcasts real transactions from the extension: security-critical end to end.

**Architecture:** The background engine (`src/background/`) stays the only place that prepares, signs and broadcasts. Plan 3 adds three facts it already holds and did not report — `reauth.proven`, `validUntil`, the pending record's `feeLamports` — plus `priorityLamports` in E3's `about` (both sides validate it) and the rent mapping of a refused simulation (spec §11.5, on `err` alone). The UI (React, `src/app/`) gains pure send rules (`src/app/send/rules.ts`) and five screens (`Send`, `Review`, `Confirm`, `Status` composing `Stuck` and `Failed`) wired as stack routes; the routes carry only what the user typed and which account/record to read, never a prepared send. **#20's `tap()` is the only caller of `engine.send`** (a source backstop test holds it), and the resume route reads the prepared send through `wallet.preparedFor` only. Component tests run every screen against the REAL background (`handleMessage` over the in-memory Ext) with real or fake timers; E2E drives the real extension against the contained fake coordinator.

**Tech Stack:** TypeScript 5 strict, React 18, Vite, Vitest + happy-dom + Testing Library, Playwright (contained: `ctx.route` + `--host-resolver-rules`), @solana/web3.js 1.95 (background only), BigInt base units throughout.

**Spec:** `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md` (approved 2026-09-29) — §1.6, §4 (§4.2–§4.8), §5.1, §6.2–§6.3, §7, §8.5–§8.6, §11.5, §12 item 3, D38, D39, C5, E2, E3, E6, E7, E8; parent `docs/superpowers/specs/2026-09-27-extension-b1-design.md` (rev 5): the send engine, fee policy, deadlines, the 403 latch, the CSP. Design: `/home/user/Downloads/index.html` + `screen.md`, #s12, #s43, #s19, #s20, #s21, #s54, #s44.

## Scope — what plan 3 builds, the stand-ins it removes, the owner's questions, every departure (stated)

1. **Builds:** #12 send (every design state 1–7, E6's hints), #43 from #12's chip, #19 tx-simulate, #20 tx-confirm (flow and resume entries), #21 tx-status, #54 tx-stuck, #44 tx-failed, #11's cancelled toast; the flow's routes; E2E specs 4, 5, 11; the visual pass of every state (42 shots).
2. **Stand-ins removed (each with a test):** #11 gets its Send quick action (Task 14); the pending strip opens that send at #21/#54 (Task 14); #26's PENDING rows open it (Task 14); #27 gets `[Try again]` for a failed send (Task 14) and #44 has it from birth (Task 11); `src/app/screens/Resume.tsx` — plan 2's `#/send/resume?account=` stand-in — is **deleted** and the route renders #20's resume entry (Task 13); plan 2's "Network fee includes the priority" on #10 is replaced by the split rows (Task 1).
3. **Owner questions** — none answered yet; each is built with the recommended option (the review's verdict) and each is reversible on its own:
   - **Q1 — failed history rows (carry 3).** **A (recommended; review: build A with H1 applied — built in Task 4):** decode what a failed transaction tried to send from its own top-level instructions, only when this account paid for it (its first key) and only when it carries exactly one transfer of a known token — "Failed · sent SOL" / "— SOL", shown under Sent; #27 "FAILED · SENT" with `[Try again]`. A batch, an unknown mint or a program's inner transfer stays "Failed · transaction". B (the documented fallback): keep plan 1's rows (drop Task 4 and Task 14's #27 `[Try again]`). C: label only the failed sends recorded in this browser's pending store — strictly worse than A (loses sends from before install or another device).
   - **Q2 — the rent copy (carry 2).** Recommended (review: accept): the two lines below, the first in the review's wording. MAX keeps the rent minimum by design; closing an account to exactly 0 is a product decision not taken here (stated in §4.2).
   - **Q3 — #20 in the UI tab.** Recommended (review: accept): "…in this tab…" for the two lines that would otherwise say a new tab opens.
   - **Q4 — #12's small copy.** Recommended (review: accept the paste line and "· today"; "· last 1 day ago" rejected → "· yesterday").
4. **Proposed copy — every line a controller addition — awaiting the owner, marked so in the code and in the spec:**
   - #19 `sender-below-rent`: "This would leave less than 0.00089088 SOL in your account, which Solana does not allow. Send less, so at least that much stays."
   - #19 `recipient-below-rent`: "This address has no Solana account yet. A new account needs at least 0.00089088 SOL, so send at least that much."
   - #12 paste refused: "Paste with Ctrl+V (⌘V on a Mac)."
   - #12 sent-before: "Verified · sent before · today" and "Verified · sent before · yesterday" (the design gives only "last 12 days ago").
   - #20 in the UI tab: "You'll confirm with your password (or passkey) in this tab before this is sent." and "Confirmation opens in this tab."
5. **Spec contradictions this plan resolves (and writes into the spec):** §4.5 step 1 sends only on `reauth === null`, so a resumed #20 after #10 could only open #10 again — the engine now reports `reauth.proven` and step 1 is "null **or** proven" (Task 3); #21's "Fee paid" had no source after a reopened popup — the record keeps `feeLamports` (Task 3); #20's "Quote valid N s" had no deadline in the view — `validUntil` (Task 3); #19's "Send at most N" read `SplitTokenBalance`'s free text — the refusal now carries N as digits (Task 2); the "opens a new tab" lines are wrong in the UI tab (Q3).
6. **Departures** — each is in that screen's Differs entry in the spec (the diffs are in the tasks): §3.10 (#10's fee rows), §4.2 (#12: paste permission, the chip's tile, the CTA's typed amount, priority line in state 6), §4.4 (#19: no instruction count, no RPC-drop timing, After = read balance − `solRequiredLamports`, the rent copy), §4.5 (#20: dollars per fee row, `[Refresh]` beside the line, the tab lines, banners' tones), §4.6 (#21: "Waiting for confirmation" kept, no developer caption, Fee paid from the record), §4.7 (#44: insufficient-fee, slippage and the RPC picker removed — the engine cannot report them), §4.8 (#54: MM:SS at any age, 54b/54d/54e layouts, no "Speed up" — D15), §5.1 (#11), §6.2/§6.3 (failed rows, option A), §1.6 (the quiet provider on the resume route).
7. **Key and secret handling.** Nothing in this plan moves a key. Signing happens in the background only: `send.ts`'s `signPrepared` signs the stored prepared message bytes with the account's key from `storage.session` (`src/background/session.ts`, `v1_session`: memory-only, cleared on lock), which plan 1's vault-isolation gate proves no page reaches. The UI receives ids, intents, fee numbers, signatures and pending records — never a key, never a signed transaction before broadcast, never the prepared message. The vault page (#10) proves the password and marks the challenge; it never sends (`wallet.send` is called only from #20's tap). The new `localStorage` key (`noctura.ui.v1.confirmStrike`, the loop guard's last challenge id) is UI state with no security meaning (S4): a challenge id is single-use, bound to one intent and expires in 120 s.
8. **Not in this plan:** shielded sends; swaps; a speed-up (D15: priority is automatic); token sends in E2E (component tests cover SPL sends against the real background; the fake's token accounts feed #11/#43); the TGE date anywhere.

## Global Constraints

Every task's requirements include these.

- **Mutations go only in a scratch copy outside the repo** — `git archive HEAD | tar -x -C <scratch>`, link `extension/node_modules` and `web/node_modules`, apply the edit there, run the named test under `timeout 300`, expect it red, discard the copy. Never in the checkout, never with `git worktree`, never touch the repository's `node_modules`, never `pkill` with a pattern that can match your own shell.
- **Every task touching the repo-root `src/` runs the FULL root jest.** No task here touches the root `src/`. Root jest does NOT run `core/` tests (`core/` is in `testPathIgnorePatterns`); those run under extension's and web's vitest. Task 4 touches `core/solana/history.ts`: run `npm run verify` in **web/** too after it.
- **Before pushing, reproduce CI with ONLY `web/` and `extension/` installed, on Node 22.12:** `PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`, then `npm ci --ignore-scripts` (npm 11.6.2) in each, `npm run verify` in both, `npm run e2e` in `extension/`.
- **e2e makes no value or type imports from `core/`.** Addresses the E2E needs are constants (`e2e/sendHelpers.ts`).
- **E2E containment:** `ctx.route` plus `--host-resolver-rules` for every noc-tura.io name AND solscan.io, with the counters asserted empty (`contained(h)` at the end of every spec). The containment positive-control spec and the zero-CSP-violation spec stay.
- **Tests never contact `*.noc-tura.io` or `solscan.io`.**
- **Commit trailers name the executing model, truthfully** — each commit block ends `Co-Authored-By: <the executing model's own line>`.
- **The TGE date is never written anywhere** — code, tests, fixtures, comments, docs, commit messages; a repo-wide gate (`scripts/check-no-tge-date.mjs`) and the extension's own gate enforce it.
- **`extension/` has no eslint gate. Never add `eslint-disable`.** No regex-only security gates: the one-caller rule for `engine.send` is a source backstop **plus** behavioural tests and mutations.
- **`extension/src/styles/design-ext.css` is generated — never hand-edit it** (Task 5 regenerates it and pins the hash).
- **Rule 6:** every send/confirm/retry button is a `LockedButton` (≥ 500 ms and never before the action settles); tests lift `disabled` before the second click (happy-dom drops clicks on disabled buttons — a test that leaves it set proves nothing).
- **Every async path checks its generation or `alive`/`left` flag after each await** (unmount, a newer read, a cancel), with a test for each.
- **The quiet provider stays quiet:** the UI tab's hand-over route reads the state and what #20 reads itself, nothing more, until the user moves on.
- CLAUDE.md: the design is binding; every scope-down is stated (Scope 6 and the Differs entries); TypeScript strict, no `any`, no `@ts-ignore`; no placeholders; BigInt base units (amounts are shown exact, never rounded up); UTC in data.
- Prettier style of the surrounding code: single quotes, trailing commas, no spaces inside braces, no parens around a single arrow parameter.

## How to read the steps

- A **new file** is given in full. A **changed file** is a unified diff against the file as the previous task left it; save the block and apply it with `git apply --recount` from the repository root (or by hand — every hunk is exact). `app.css`, `harness.tsx`, `ExtIcon.tsx`, `App.tsx` and the spec grow task by task, so their diffs apply in task order.
- Commands run from `extension/` unless they start with `cd`. "Whole suite" is `npx tsc --noEmit && npx vitest run`; the expected totals are the dry run's task-by-task replay (each task's tests on its predecessor — red — then on its own tree — green). A reviewer-added test raises them; that is not a defect.
- The component tests drive each screen against the REAL background (`setupWallet` in `src/app/__tests__/harness.tsx`: `handleMessage` over the in-memory `fakeExt` with `fakeDeps`, a `sendingReader()` that simulates as a node does). Every send-screen test file's first test asserts `unstyledClasses(container, SELECTORS)` is empty (carry 4).

## One tap per broadcast — how D38 is held (carry 6)

1. **One caller.** `engine.send(` appears only in `src/app/screens/Confirm.tsx`, in `send(view, tapAt)`, which only `tap()` calls, and `tap` is only the Send button's `onPress`. `Confirm.test.tsx` › "one caller of wallet.send (source backstop over all of src/)" walks **every file under `src/`** except tests — the vault page and the background included — and fails on any `send(` method call other than the vault page's `deps.send` outside Confirm.tsx, and on the name `wallet.send` in any form (quoted, object-literal value, bare) outside `src/background/` and `src/app/engine.ts`; fixtures prove each form is caught and the negative controls are not (M9h, M9i). A scan can be defeated by string assembly, so the backstop is not the proof — the behaviour tests and mutations are:
2. **No send without a tap, whatever opened #20:** `Confirm.test.tsx` › "no resume sends before a tap" (reauth null, proven, resumed after expiry, opened as the tab — 10 s untouched, zero `wallet.send`); `sendFlow.test.tsx` › "after #10 … no send in 10 s; one tap sends once"; E2E spec 4's 3 s quiet window after #10. Mutation M9b (an effect that sends on resume) turns 16 component tests and E2E spec 4 red.
3. **The resume route reads only through `wallet.preparedFor`;** the hash selects the screen and carries no data (`firstRoute` keeps only a valid address; M13a). A resume with `reauth: null` shows "You have a send waiting." and waits.
4. **An unproven challenge never sends:** the tap opens #10 (M9e). **A proven one sends without a second #10.**
5. **Rule 6 on the tap**, with `disabled` lifted: one press → one `wallet.send`. While it is in flight, [Cancel], Back and Esc do nothing (M9d2, M9g). A stale unproven view re-reads `preparedFor` once inside the same tap and sends if now proven (review L2, M9k) — never a second #10 for a satisfied challenge.
7. **No resume loop on a dead challenge** (review M1): a challenge past C5's 10-minute cap makes `preparedFor` report `expired`, so the resume re-prepares with a fresh challenge and one tap opens a live #10 (M3d).
6. **C5:** one automatic re-prepare at the quote's end, then `[Refresh]` (M9a) — a re-prepare never sends; after `prepared-expired` the user taps again.

## File map

| path | tasks | change |
|---|---|---|
| `core/solana/__tests__/history.test.ts` | 4 | modified |
| `core/solana/history.ts` | 4 | modified |
| `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md` | 1, 3, 4, 7, 8, 9, 10, 11, 12, 13, 14, 15 | modified |
| `extension/e2e/fakeCoordinator.ts` | 15, 17 | modified |
| `extension/e2e/popup.spec.ts` | 4 | modified |
| `extension/e2e/send.spec.ts` | 15 | created |
| `extension/e2e/sendHelpers.ts` | 15 | created |
| `extension/e2e/stuck.spec.ts` | 16 | created |
| `extension/e2e/visual-send.spec.ts` | 17 | created |
| `extension/e2e/visual-vault.spec.ts` | 1 | modified |
| `extension/e2e/visual.spec.ts` | 4 | modified |
| `extension/e2e/wallet.spec.ts` | 13 | modified |
| `extension/scripts/check-classes.mjs` | 8 | modified |
| `extension/src/app/App.tsx` | 13, 14 | modified |
| `extension/src/app/__tests__/Activity.test.tsx` | 4, 14 | modified |
| `extension/src/app/__tests__/App.test.tsx` | 14 | modified |
| `extension/src/app/__tests__/Confirm.test.tsx` | 9 | created |
| `extension/src/app/__tests__/Created.test.tsx` | 13 | modified |
| `extension/src/app/__tests__/Failed.test.tsx` | 11 | created |
| `extension/src/app/__tests__/Home.test.tsx` | 14 | modified |
| `extension/src/app/__tests__/Review.test.tsx` | 8 | created |
| `extension/src/app/__tests__/Send.test.tsx` | 7 | created |
| `extension/src/app/__tests__/Status.test.tsx` | 12 | created |
| `extension/src/app/__tests__/Stuck.test.tsx` | 10 | created |
| `extension/src/app/__tests__/Switcher.test.tsx` | 14 | modified |
| `extension/src/app/__tests__/TokenSheet.test.tsx` | 7 | modified |
| `extension/src/app/__tests__/TxDetail.test.tsx` | 4, 14 | modified |
| `extension/src/app/__tests__/engine.test.ts` | 3 | modified |
| `extension/src/app/__tests__/format.test.ts` | 9 | modified |
| `extension/src/app/__tests__/harness.tsx` | 8 | modified |
| `extension/src/app/__tests__/router.test.ts` | 13 | modified |
| `extension/src/app/__tests__/sendFlow.test.tsx` | 13 | created |
| `extension/src/app/__tests__/sendRules.test.ts` | 6 | created |
| `extension/src/app/__tests__/sendStyles.test.tsx` | 5 | created |
| `extension/src/app/app.css` | 7, 8, 9, 10, 11, 12, 13, 14 | modified |
| `extension/src/app/engine.ts` | 3 | modified |
| `extension/src/app/format.ts` | 9 | modified |
| `extension/src/app/history.ts` | 4 | modified |
| `extension/src/app/mount.tsx` | 13 | modified |
| `extension/src/app/platform.ts` | 9 | modified |
| `extension/src/app/prefs.ts` | 9 | modified |
| `extension/src/app/router.ts` | 13 | modified |
| `extension/src/app/screens/Activity.tsx` | 14 | modified |
| `extension/src/app/screens/Confirm.tsx` | 9 | created |
| `extension/src/app/screens/Failed.tsx` | 11 | created |
| `extension/src/app/screens/Home.tsx` | 14 | modified |
| `extension/src/app/screens/Resume.tsx` | 13 | deleted |
| `extension/src/app/screens/Review.tsx` | 8 | created |
| `extension/src/app/screens/Send.tsx` | 7 | created |
| `extension/src/app/screens/Status.tsx` | 12 | created |
| `extension/src/app/screens/Stuck.tsx` | 10 | created |
| `extension/src/app/screens/TokenSheet.tsx` | 7 | modified |
| `extension/src/app/screens/TxDetail.tsx` | 4, 11, 14 | modified |
| `extension/src/app/send/rules.ts` | 6 | created |
| `extension/src/app/ui/CancelledToast.tsx` | 11 | created |
| `extension/src/app/ui/ExtIcon.tsx` | 7, 8 | modified |
| `extension/src/app/ui/useEscape.ts` | 7 | created |
| `extension/src/background/__tests__/challengeAbout.test.ts` | 1 | modified |
| `extension/src/background/__tests__/fixtures.ts` | 3 | modified |
| `extension/src/background/__tests__/pendingStore.test.ts` | 3 | modified |
| `extension/src/background/__tests__/prepare.test.ts` | 2, 3 | modified |
| `extension/src/background/__tests__/prepareSimulation.test.ts` | 2 | modified |
| `extension/src/background/__tests__/send.test.ts` | 3 | modified |
| `extension/src/background/__tests__/sendFeeCharged.test.ts` | 3 | created |
| `extension/src/background/pending.ts` | 3 | modified |
| `extension/src/background/pendingStore.ts` | 3 | modified |
| `extension/src/background/prepare.ts` | 1, 2, 3 | modified |
| `extension/src/background/reauthChallenges.ts` | 1 | modified |
| `extension/src/background/send.ts` | 3 | modified |
| `extension/src/styles/design-ext.css` | 5 | modified |
| `extension/src/unlock/__tests__/challenge.test.ts` | 1 | modified |
| `extension/src/unlock/__tests__/reauthScreen.test.ts` | 1 | modified |
| `extension/src/unlock/challenge.ts` | 1 | modified |
| `extension/src/unlock/strings.ts` | 1 | modified |

### Task 1: E3's `about` carries `priorityLamports`; #10 shows §4.5's fee rows (carry 1)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/e2e/visual-vault.spec.ts`
- Modify: `extension/src/background/__tests__/challengeAbout.test.ts`
- Modify: `extension/src/background/prepare.ts`
- Modify: `extension/src/background/reauthChallenges.ts`
- Modify: `extension/src/unlock/__tests__/challenge.test.ts`
- Modify: `extension/src/unlock/__tests__/reauthScreen.test.ts`
- Modify: `extension/src/unlock/challenge.ts`
- Modify: `extension/src/unlock/strings.ts`

**Interfaces:**
- Consumes: plan 2's `issueChallenge`/`rebaseChallenge`/`isAbout` (`src/background/reauthChallenges.ts`), `describeChallenge` (`src/unlock/challenge.ts`), `prepare.ts`'s refresh of a carried challenge.
- Produces: `ChallengeAbout` (kind `send`) gains `priorityLamports: string` (twelve keys); `SendAboutRefresh` includes it; `REAUTH.priority = 'Priority'`; #10's fee rows: Network fee (network − priority), Priority, New token account (when non-zero), Noctura fee or its reason line.

Carry 1. `about` was an exact 11-key record, checked by the background (`isAbout`) and re-validated by the vault page's closed-alphabet renderer. Plan 3 adds `priorityLamports` on **both** sides — digits, and never more than `networkLamports` (a larger value describes no real transaction: both sides fail closed) — so #10 shows the same fee rows as #19 and #20 (spec §4.5): "Network fee" is the base fee (`networkLamports − priorityLamports`), then "Priority", "New token account" when non-zero, then the Noctura fee or its reason line. A rebased challenge (D39) copies the new value. `e2e/visual-vault.spec.ts` writes a hand-made `about` literal for #10's shot, so it gains `priorityLamports: '0'`. §3.10's Differs entry is rewritten (the plan-2 "priority included" entry is replaced).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/visual-vault.spec.ts`:

```diff
diff --git a/extension/e2e/visual-vault.spec.ts b/extension/e2e/visual-vault.spec.ts
index 2b7175c..e7714da 100644
--- a/extension/e2e/visual-vault.spec.ts
+++ b/extension/e2e/visual-vault.spec.ts
@@ -488,7 +488,7 @@ test('visual: #10 — the action from the background, and each of its states', a
     const bad = 'cd'.repeat(16);
     await h.sw.evaluate(
       async ({b, about}) => chrome.storage.session.set({v1_reauth: {[b]: {digest: 'd', issuedAt: Date.now(), expiresAt: Date.now() + 120_000, satisfied: false, about}}}),
-      {b: bad, about: {kind: 'send', account: E2E_ACCOUNTS[0], token: 'SOL', recipient: RECIPIENT, amount: '1', networkLamports: '5000', markupLamports: '0', markupReason: 'charged', rentLamports: '0', reasons: ['first-send'], thresholdCents: 10_000}},
+      {b: bad, about: {kind: 'send', account: E2E_ACCOUNTS[0], token: 'SOL', recipient: RECIPIENT, amount: '1', networkLamports: '5000', priorityLamports: '0', markupLamports: '0', markupReason: 'charged', rentLamports: '0', reasons: ['first-send'], thresholdCents: 10_000}},
     );
     await p.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${bad}`);
     await expect(text(p, '#ra-notice-line')).toHaveText('The details of this action could not be shown.');
```

Modify `extension/src/background/__tests__/challengeAbout.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/challengeAbout.test.ts b/extension/src/background/__tests__/challengeAbout.test.ts
index aa2a9ba..190acea 100644
--- a/extension/src/background/__tests__/challengeAbout.test.ts
+++ b/extension/src/background/__tests__/challengeAbout.test.ts
@@ -18,13 +18,22 @@ const SEND_ABOUT: ChallengeAbout = {
   recipient: RECIPIENT,
   amount: '1000000',
   networkLamports: '5050',
+  priorityLamports: '50',
   markupLamports: '0',
   markupReason: 'status-unknown',
   rentLamports: '0',
   reasons: ['first-send'],
   thresholdCents: 10_000,
 };
-const REFRESH: SendAboutRefresh = {networkLamports: '9050', markupLamports: '0', markupReason: 'status-unknown', rentLamports: '0', reasons: ['first-send', 'over-usd-threshold'], thresholdCents: 10_000};
+const REFRESH: SendAboutRefresh = {
+  networkLamports: '9050',
+  priorityLamports: '4050',
+  markupLamports: '0',
+  markupReason: 'status-unknown',
+  rentLamports: '0',
+  reasons: ['first-send', 'over-usd-threshold'],
+  thresholdCents: 10_000,
+};
 const SOL_INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: '1000000'};
 
 describe('the challenge describes its action (E3)', () => {
@@ -40,6 +49,8 @@ describe('the challenge describes its action (E3)', () => {
       recipient: RECIPIENT,
       amount: '1000000',
       networkLamports: '5050',
+      // Plan 3, carry 1: the priority part of the network fee, for #10's own Priority row.
+      priorityLamports: '50',
       markupLamports: '0',
       markupReason: 'status-unknown',
       rentLamports: '0',
@@ -64,6 +75,8 @@ describe('the challenge describes its action (E3)', () => {
     expect(stored.digest).toBe(sendIntentDigest(ACCOUNT.publicKey, SOL_INTENT));
     expect(stored.about).toMatchObject({account: ACCOUNT.publicKey, recipient: RECIPIENT, amount: '1000000', token: 'SOL'});
     expect(stored.about).not.toMatchObject({networkLamports: '5050'});
+    // The priority is refreshed with the network fee it is part of (4 000 000 µlamports/CU × 1 000 CU = 4 000).
+    expect(stored.about).toMatchObject({networkLamports: '9000', priorityLamports: '4000'});
   });
 
   it('a stored record whose about has another shape is dropped', async () => {
@@ -81,6 +94,11 @@ describe('the challenge describes its action (E3)', () => {
       {...SEND_ABOUT, recipient: 'not-an-address'},
       {...SEND_ABOUT, account: '0'.repeat(32)},
       {...SEND_ABOUT, recipient: '1'.repeat(45)},
+      // Plan 3, carry 1: the twelfth key — missing, not digits, or larger than the network fee it is part of.
+      (({priorityLamports: _p, ...rest}) => rest)(SEND_ABOUT as Extract<ChallengeAbout, {kind: 'send'}>),
+      {...SEND_ABOUT, priorityLamports: '1.5'},
+      {...SEND_ABOUT, priorityLamports: 50},
+      {...SEND_ABOUT, priorityLamports: '5051'},
       {kind: 'settings'},
       null,
     ]) {
@@ -145,7 +163,7 @@ describe('rebaseChallenge (D39, C5)', () => {
     const c = ((await ext.session.get(REAUTH_KEY)) as Record<string, {expiresAt: number; satisfied: boolean; about: ChallengeAbout}>)[id]!;
     expect(c.satisfied).toBe(true);
     expect(c.expiresAt).toBe(deps.clock.t - 100_000 + CHALLENGE_TTL_MS);
-    expect(c.about).toMatchObject({networkLamports: '9050', reasons: ['first-send', 'over-usd-threshold'], amount: '1000000'});
+    expect(c.about).toMatchObject({networkLamports: '9050', priorityLamports: '4050', reasons: ['first-send', 'over-usd-threshold'], amount: '1000000'});
     expect(await challengeInfo(ext, deps.now(), id)).not.toBeNull();
   });
 
@@ -183,7 +201,13 @@ describe('rebaseChallenge (D39, C5)', () => {
     const id = await issueChallenge(ext, deps, 'd', SEND_ABOUT);
     const before = ((await ext.session.get(REAUTH_KEY)) as Record<string, unknown>)[id];
     deps.clock.t += 10_000;
-    for (const refresh of [{...REFRESH, thresholdCents: 1.5}, {...REFRESH, networkLamports: '-1'}, {...REFRESH, reasons: ['nope']}]) {
+    for (const refresh of [
+      {...REFRESH, thresholdCents: 1.5},
+      {...REFRESH, networkLamports: '-1'},
+      {...REFRESH, reasons: ['nope']},
+      {...REFRESH, priorityLamports: '9051'},
+      {...REFRESH, priorityLamports: undefined},
+    ]) {
       expect(await rebaseChallenge(ext, deps.now(), id, 'd', refresh as SendAboutRefresh)).toBe(false);
       expect(((await ext.session.get(REAUTH_KEY)) as Record<string, unknown>)[id]).toEqual(before);
     }
```

Modify `extension/src/unlock/__tests__/challenge.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/challenge.test.ts b/extension/src/unlock/__tests__/challenge.test.ts
index 3ad2fa2..f8e753f 100644
--- a/extension/src/unlock/__tests__/challenge.test.ts
+++ b/extension/src/unlock/__tests__/challenge.test.ts
@@ -16,6 +16,7 @@ const SEND: ChallengeAbout = {
   recipient: RECIPIENT,
   amount: '2480000000',
   networkLamports: '5050',
+  priorityLamports: '50',
   markupLamports: '0',
   markupReason: 'status-unknown',
   rentLamports: '0',
@@ -31,8 +32,11 @@ describe('describeChallenge: the closed-alphabet renderer', () => {
       amount: '2.4800',
       symbol: 'SOL',
       recipient: RECIPIENT,
+      // Spec §4.5's fee rows, the same on #19, #20 and #10 (plan 3, carry 1): the base fee is the network
+      // fee less its priority part; then the priority; then the Noctura fee's reason line.
       fees: [
-        {label: 'Network fee', value: '0.00000505 SOL'},
+        {label: 'Network fee', value: '0.000005 SOL'},
+        {label: 'Priority', value: '0.00000005 SOL'},
         {label: 'No Noctura fee (status unknown)', value: null},
       ],
       reasons: ['Re-auth required for the first send to a new address.', 'Re-auth required for transactions over $100.'],
@@ -45,14 +49,17 @@ describe('describeChallenge: the closed-alphabet renderer', () => {
       amount: '12.345678',
       symbol: 'USDC',
       fees: [
-        {label: 'Network fee', value: '0.00000505 SOL'},
-        {label: 'Noctura fee', value: '0.00002 SOL'},
+        {label: 'Network fee', value: '0.000005 SOL'},
+        {label: 'Priority', value: '0.00000005 SOL'},
         {label: 'New token account', value: '0.00203928 SOL'},
+        {label: 'Noctura fee', value: '0.00002 SOL'},
       ],
       reasons: ['Re-auth required for transactions over 5 % of balance.', 'Re-auth required to send your whole balance to a new address.'],
     });
     expect(describeChallenge({...SEND, reasons: ['over-usd-threshold'], thresholdCents: 12_550})).toMatchObject({reasons: ['Re-auth required for transactions over $125.50.']});
-    expect(describeChallenge({...SEND, markupReason: 'pre-tge'})).toMatchObject({fees: [{label: 'Network fee'}, {label: 'No Noctura fee before TGE', value: null}]});
+    expect(describeChallenge({...SEND, markupReason: 'pre-tge'})).toMatchObject({fees: [{label: 'Network fee'}, {label: 'Priority'}, {label: 'No Noctura fee before TGE', value: null}]});
+    // A priority equal to the whole network fee (no base fee) still describes; it is never negative.
+    expect(describeChallenge({...SEND, networkLamports: '50'})).toMatchObject({fees: [{label: 'Network fee', value: '0 SOL'}, {label: 'Priority', value: '0.00000005 SOL'}, {}]});
   });
 
   // Each field outside its alphabet → null → #10's "could not be shown" with only Cancel.
@@ -62,6 +69,9 @@ describe('describeChallenge: the closed-alphabet renderer', () => {
     ['an amount with a decimal point', {amount: '2.48'}],
     ['an amount of 21 digits', {amount: '1'.repeat(21)}],
     ['a negative fee', {networkLamports: '-5'}],
+    ['a priority with a decimal point', {priorityLamports: '0.5'}],
+    ['a priority as a number', {priorityLamports: 50}],
+    ['a priority larger than the network fee it is part of', {priorityLamports: '5051'}],
     ['a recipient with markup', {recipient: '<img src=x onerror=alert(1)>'}],
     ['a recipient with a 0 (outside base58)', {recipient: `0${RECIPIENT.slice(1)}`}],
     // ADDRESS's end anchor: a valid 32–44-char run with one more character tacked on must not pass by
@@ -91,6 +101,8 @@ describe('describeChallenge: the closed-alphabet renderer', () => {
   it('a missing field, another kind, and a non-object are not described', () => {
     const {thresholdCents: _drop, ...missing} = SEND;
     expect(describeChallenge(missing)).toBeNull();
+    const {priorityLamports: _noPriority, ...elevenKeys} = SEND;
+    expect(describeChallenge(elevenKeys)).toBeNull();
     expect(describeChallenge({...SEND, kind: 'sign'})).toBeNull();
     for (const x of [null, undefined, 'send', 7, [SEND]]) expect(describeChallenge(x)).toBeNull();
   });
```

Modify `extension/src/unlock/__tests__/reauthScreen.test.ts`:

```diff
diff --git a/extension/src/unlock/__tests__/reauthScreen.test.ts b/extension/src/unlock/__tests__/reauthScreen.test.ts
index a8371f5..d5341ae 100644
--- a/extension/src/unlock/__tests__/reauthScreen.test.ts
+++ b/extension/src/unlock/__tests__/reauthScreen.test.ts
@@ -46,6 +46,7 @@ const SEND = (account: string): Extract<ChallengeAbout, {kind: 'send'}> => ({
   recipient: RECIPIENT,
   amount: '2480000000',
   networkLamports: '5050',
+  priorityLamports: '50',
   markupLamports: '0',
   markupReason: 'status-unknown',
   rentLamports: '0',
@@ -136,7 +137,8 @@ describe('#10 unlock-send (spec §3.10)', () => {
     const rows = [...el('ra-rows').querySelectorAll('.intent-row')];
     expect(rows.map(r => [text(r.querySelector('.label')), text(r.querySelector('.value'))])).toEqual([
       ['To', RECIPIENT],
-      ['Network fee', '0.00000505 SOL'],
+      ['Network fee', '0.000005 SOL'],
+      ['Priority', '0.00000005 SOL'],
       ['No Noctura fee (status unknown)', ''],
     ]);
     expect([...rows[0]!.querySelectorAll('.addr-groups > span')].map(text)).toEqual(RECIPIENT.match(/.{1,4}/g));
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/background/__tests__/challengeAbout.test.ts src/unlock/__tests__/challenge.test.ts src/unlock/__tests__/reauthScreen.test.ts
```
Expected (dry run): FAIL — Test Files 3 failed (3) · Tests 42 failed | 49 passed (91) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/background/prepare.ts`:

```diff
diff --git a/extension/src/background/prepare.ts b/extension/src/background/prepare.ts
index 8e70b2a..eee87c0 100644
--- a/extension/src/background/prepare.ts
+++ b/extension/src/background/prepare.ts
@@ -342,6 +342,7 @@ export async function prepareSend(
   // E3: what #10 shows, bound to the challenge by the same values the digest was computed from.
   const refresh: SendAboutRefresh = {
     networkLamports: fees.networkLamports,
+    priorityLamports: fees.priorityLamports,
     markupLamports: fees.markupLamports,
     markupReason: fees.markupReason,
     rentLamports: fees.rentLamports,
```

Modify `extension/src/background/reauthChallenges.ts`:

```diff
diff --git a/extension/src/background/reauthChallenges.ts b/extension/src/background/reauthChallenges.ts
index 745482b..cd0ba3b 100644
--- a/extension/src/background/reauthChallenges.ts
+++ b/extension/src/background/reauthChallenges.ts
@@ -28,7 +28,10 @@ export type ChallengeAbout =
       token: 'SOL' | 'NOC' | 'USDC' | 'USDT';
       recipient: string;
       amount: string;
+      /** The whole network fee: 5 000 per signature plus the priority fee. */
       networkLamports: string;
+      /** The priority part of networkLamports (plan 3, carry 1): #10 shows the base fee and the priority as two rows, as #19 and #20 do. */
+      priorityLamports: string;
       markupLamports: string;
       markupReason: FeeReason;
       rentLamports: string;
@@ -38,7 +41,10 @@ export type ChallengeAbout =
   | {kind: 'settings'; autoLockMinutes: number | null; reauthUsdCents: number | null};
 
 /** The fields a re-prepare of the same intent may refresh; the identity fields (account, token, recipient, amount) never change. */
-export type SendAboutRefresh = Pick<Extract<ChallengeAbout, {kind: 'send'}>, 'networkLamports' | 'markupLamports' | 'markupReason' | 'rentLamports' | 'reasons' | 'thresholdCents'>;
+export type SendAboutRefresh = Pick<
+  Extract<ChallengeAbout, {kind: 'send'}>,
+  'networkLamports' | 'priorityLamports' | 'markupLamports' | 'markupReason' | 'rentLamports' | 'reasons' | 'thresholdCents'
+>;
 
 interface Challenge {
   digest: string;
@@ -72,13 +78,15 @@ function isAbout(x: unknown): x is ChallengeAbout {
     ADDRESS.test(a.recipient) &&
     typeof a.token === 'string' &&
     TOKENS.includes(a.token) &&
-    [a.amount, a.networkLamports, a.markupLamports, a.rentLamports].every(v => typeof v === 'string' && DIGITS.test(v)) &&
+    [a.amount, a.networkLamports, a.priorityLamports, a.markupLamports, a.rentLamports].every(v => typeof v === 'string' && DIGITS.test(v)) &&
+    // The priority is a part of the network fee, never more: the base fee row is their difference.
+    BigInt(a.priorityLamports as string) <= BigInt(a.networkLamports as string) &&
     typeof a.markupReason === 'string' &&
     FEE_REASONS.includes(a.markupReason) &&
     Array.isArray(a.reasons) &&
     (a.reasons as unknown[]).every(r => typeof r === 'string' && REASONS.includes(r)) &&
     isInt(a.thresholdCents) &&
-    Object.keys(a).length === 11
+    Object.keys(a).length === 12
   );
 }
 
@@ -147,6 +155,7 @@ export async function rebaseChallenge(ext: Ext, now: number, id: string, digest:
       recipient: c.about.recipient,
       amount: c.about.amount,
       networkLamports: refresh.networkLamports,
+      priorityLamports: refresh.priorityLamports,
       markupLamports: refresh.markupLamports,
       markupReason: refresh.markupReason,
       rentLamports: refresh.rentLamports,
```

Modify `extension/src/unlock/challenge.ts`:

```diff
diff --git a/extension/src/unlock/challenge.ts b/extension/src/unlock/challenge.ts
index 7d595b6..0ddf1df 100644
--- a/extension/src/unlock/challenge.ts
+++ b/extension/src/unlock/challenge.ts
@@ -7,8 +7,9 @@ import type {Send} from './types';
  * from its URL and the description ONLY from the background (vault.challengeInfo), and renders nothing
  * untrusted: every field is re-validated here against a closed alphabet before any text is built —
  * the token in this page's own four-entry table, amounts ^\d{1,20}$, addresses the base58 alphabet at
- * 32–44 characters, each reason and fee reason one of its known codes mapped to a fixed string,
- * thresholds integers in range, and exactly the record's keys. Anything else is null: #10 then shows
+ * 32–44 characters, the priority no larger than the network fee it is part of, each reason and fee
+ * reason one of its known codes mapped to a fixed string, thresholds integers in range, and exactly the
+ * record's keys. Anything else is null: #10 then shows
  * "The details of this action could not be shown." with only Cancel — it never offers a confirmation
  * it cannot describe.
  */
@@ -16,7 +17,7 @@ const TOKENS = {SOL: 9, NOC: 9, USDC: 6, USDT: 6} as const;
 export type TokenSymbol = keyof typeof TOKENS;
 const DIGITS = /^\d{1,20}$/;
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
-const SEND_KEYS = ['account', 'amount', 'kind', 'markupLamports', 'markupReason', 'networkLamports', 'reasons', 'recipient', 'rentLamports', 'thresholdCents', 'token'];
+const SEND_KEYS = ['account', 'amount', 'kind', 'markupLamports', 'markupReason', 'networkLamports', 'priorityLamports', 'reasons', 'recipient', 'rentLamports', 'thresholdCents', 'token'];
 const SETTINGS_KEYS = ['autoLockMinutes', 'kind', 'reauthUsdCents'];
 const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
 
@@ -48,11 +49,15 @@ const hasExactly = (o: Record<string, unknown>, keys: string[]): boolean => Obje
 
 function describeSend(a: Record<string, unknown>): SendDescription | null {
   if (!hasExactly(a, SEND_KEYS)) return null;
-  const {account, recipient, token, amount, networkLamports, markupLamports, markupReason, rentLamports, reasons, thresholdCents} = a;
+  const {account, recipient, token, amount, networkLamports, priorityLamports, markupLamports, markupReason, rentLamports, reasons, thresholdCents} = a;
   if (typeof account !== 'string' || !ADDRESS.test(account) || typeof recipient !== 'string' || !ADDRESS.test(recipient)) return null;
   if (typeof token !== 'string' || !own(TOKENS, token)) return null;
   const symbol = token as TokenSymbol;
-  if (![amount, networkLamports, markupLamports, rentLamports].every(v => typeof v === 'string' && DIGITS.test(v))) return null;
+  if (![amount, networkLamports, priorityLamports, markupLamports, rentLamports].every(v => typeof v === 'string' && DIGITS.test(v))) return null;
+  const network = BigInt(networkLamports as string);
+  const priority = BigInt(priorityLamports as string);
+  // The priority is a part of the network fee: a larger one describes no real transaction (fail closed).
+  if (priority > network) return null;
   if (!isInt(thresholdCents, 100, 100_000)) return null;
   // The background issues a 'send' challenge only when sendReauthReasons returned at least one
   // code (prepare.ts: `if (reasons.length > 0) { ... issueChallenge ... }`), and that function
@@ -64,7 +69,14 @@ function describeSend(a: Record<string, unknown>): SendDescription | null {
     else if (typeof r === 'string' && own(REAUTH.reason, r)) lines.push(REAUTH.reason[r as keyof typeof REAUTH.reason]);
     else return null;
   }
-  const fees: FeeLine[] = [{label: REAUTH.networkFee, value: sol(networkLamports as string)}];
+  // The fee rows as spec §4.5 defines them once for #19, #20 and #10 (plan 3, carry 1): the base fee (the
+  // network fee less its priority part), the priority, the new token account when there is one, then the
+  // Noctura fee — or, when it is zero, the line that says why.
+  const fees: FeeLine[] = [
+    {label: REAUTH.networkFee, value: sol((network - priority).toString())},
+    {label: REAUTH.priority, value: sol(priority.toString())},
+  ];
+  if (BigInt(rentLamports as string) > 0n) fees.push({label: REAUTH.newTokenAccount, value: sol(rentLamports as string)});
   if (BigInt(markupLamports as string) > 0n) {
     if (markupReason !== 'charged') return null;
     fees.push({label: REAUTH.nocturaFee, value: sol(markupLamports as string)});
@@ -73,7 +85,6 @@ function describeSend(a: Record<string, unknown>): SendDescription | null {
     if (typeof markupReason !== 'string' || !own(REAUTH.feeReason, markupReason)) return null;
     fees.push({label: REAUTH.feeReason[markupReason as keyof typeof REAUTH.feeReason], value: null});
   }
-  if (BigInt(rentLamports as string) > 0n) fees.push({label: REAUTH.newTokenAccount, value: sol(rentLamports as string)});
   const decimals = TOKENS[symbol];
   return {
     kind: 'send',
```

Modify `extension/src/unlock/strings.ts`:

```diff
diff --git a/extension/src/unlock/strings.ts b/extension/src/unlock/strings.ts
index 69aa356..c9ce850 100644
--- a/extension/src/unlock/strings.ts
+++ b/extension/src/unlock/strings.ts
@@ -266,6 +266,8 @@ export const REAUTH = {
   /** Controller addition — confirmed by the owner 2026-10-01 (plan 2): a settings confirmation (B1b-2b) is not a send. */
   cancel: 'Cancel',
   networkFee: 'Network fee',
+  /** Plan 3 (carry 1): the priority as its own row, as on #19 and #20 (spec §4.5's fee rows). */
+  priority: 'Priority',
   nocturaFee: 'Noctura fee',
   newTokenAccount: 'New token account',
   /** The carried rule: a zero Noctura fee always says why. */
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 0ad2fdc..3e44ce5 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -433,7 +433,9 @@ simulation: {
 - **Store change** (`reauthChallenges.ts`): a challenge record gains `about`, written by the same
   `issueChallenge` call that binds the digest, from the same parsed values:
   - send: `{kind: 'send', account, token: 'SOL'|'NOC'|'USDC'|'USDT', recipient, amount (base units),
-    networkLamports, markupLamports, markupReason, rentLamports, reasons, thresholdCents}`;
+    networkLamports, priorityLamports, markupLamports, markupReason, rentLamports, reasons,
+    thresholdCents}` (`priorityLamports` added by plan 3, carry 1: the part of `networkLamports` that
+    is the priority fee, never more than it);
   - settings: `{kind: 'settings', autoLockMinutes: number | null, reauthUsdCents: number | null}`.
   When `prepareSend` reuses a live challenge (`rebaseChallenge`), it refreshes the fee fields
   of `about` from the new prepare. The digest and the identity fields never change. `isChallenge`
@@ -1150,23 +1152,25 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   - **`[Cancel send]` closes the tab** (review L2). The design returns to #20, but the popup that
     showed #20 closed when this tab opened, and a tab cannot reopen it. It discards the prepared send
     first (E7), so nothing is left to resume.
-  - **Plan 2:** "Network fee" is `networkLamports` — priority included: `about` (E3) carries no
-    `priorityLamports`, so #10 cannot split it as §4.5's fee rows do on #19 and #20 (plan-2 review
-    ruling 2: plan 2 is UI-only, §12; plan 3, which builds #19/#20's rows, may add
-    `priorityLamports` to `about` so the three screens agree). The amounts appear when non-zero; a
-    zero Noctura fee shows its reason line (the carried rule), and `charged` with a zero fee is not
-    described. Fees are exact and ungrouped ("0.00000505 SOL"); the design's thin grouping (plan-1
-    L7) is not applied — an exact lamport amount reads unambiguously without it, and #19/#20's rows
-    (plan 3) decide the grouping for all three screens. The cooldown's disabled button reads "Confirm paused" and a
+  - **Plan 3 (carry 1):** `about` (E3) carries `priorityLamports` (a twelfth key, digits, never more
+    than `networkLamports`; the background's `isAbout` and the page's closed-alphabet renderer both
+    check it), so #10 shows §4.5's fee rows exactly as #19 and #20 do: "Network fee" (the base fee,
+    `networkLamports − priorityLamports`), "Priority", "New token account" when non-zero, then
+    "Noctura fee" or, when it is zero, its reason line (the carried rule); `charged` with a zero fee
+    is not described. The amounts are exact and ungrouped ("0.000005 SOL") on all three screens, as
+    the #19 and #20 mockups draw them; only #27's fee line keeps the design's grouped form (plan-1
+    L7). (Plan 2 showed one "Network fee" row with the priority included, plan-2 review ruling 2.)
+    The cooldown's disabled button reads "Confirm paused" and a
     settings challenge's cancel reads "Cancel" (it only closes the tab; the challenge simply
     expires) — **both controller additions — confirmed by the owner 2026-10-01**. A discard the background refuses
     says "Something went wrong. Try again." and keeps the screen: "Send cancelled" is shown only when
     it is true — including `undescribable` (H1, above). In `expired`, `not-unlocked`,
     `mismatch-locked` and every other notice with nothing to cancel, the top bar's X closes the tab
     and claims nothing (plan-2 review L4).
-  - **Plan 2 (visual pass):** #10a draws two intent rows ("To", "Network fee"); here each fee is
-    its own row (network, Noctura fee or its reason line, new-token-account cost), ungrouped, as
-    above — the mockup's one fee row does not describe a send that pays more than the network.
+  - **Plan 2 (visual pass), as plan 3 left it:** #10a draws two intent rows ("To", "Network fee");
+    here each fee is its own row (base fee, priority, new-token-account cost, Noctura fee or its
+    reason line), ungrouped, as above — the mockup's one fee row does not describe a send that pays
+    more than the network.
   - **Plan 2 (visual pass):** the To value is the recipient in groups of four (`AddressGroups`,
     whose own `.addr-groups` mono face draws it) inside a `.noc-body-sm .noc-numeral` value span;
     the design puts `.noc-mono .noc-body-sm` on the value span itself. The rendered face is mono
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/background/__tests__/challengeAbout.test.ts src/unlock/__tests__/challenge.test.ts src/unlock/__tests__/reauthScreen.test.ts
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 3 passed (3) · Tests 91 passed (91); tsc clean; whole suite Test Files 101 passed (101) · Tests 1796 passed (1796).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M1a** — `extension/src/background/reauthChallenges.ts`:

  ```diff
  -     BigInt(a.priorityLamports as string) <= BigInt(a.networkLamports as string) &&
  + (deleted)
  ```
  `npx vitest run src/background/__tests__/challengeAbout.test.ts` — Expected: **red** (2 failed | 13 passed (15)).

- **M1b** — `extension/src/unlock/challenge.ts`:

  ```diff
  -   if (priority > network) return null;
  + (deleted)
  ```
  `npx vitest run src/unlock/__tests__/challenge.test.ts` — Expected: **red** (1 failed | 32 passed (33)).

- **M1c** — `extension/src/unlock/challenge.ts`:

  ```diff
  - sol((network - priority).toString())
  + sol(network.toString())
  ```
  `npx vitest run src/unlock/__tests__/challenge.test.ts` — Expected: **red** (2 failed | 31 passed (33)).

- [ ] **Step 7: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/e2e/visual-vault.spec.ts extension/src/background/__tests__/challengeAbout.test.ts extension/src/background/prepare.ts extension/src/background/reauthChallenges.ts extension/src/unlock/__tests__/challenge.test.ts extension/src/unlock/__tests__/reauthScreen.test.ts extension/src/unlock/challenge.ts extension/src/unlock/strings.ts
git commit -F - <<'MSG'
feat(extension): #10 shows the priority as its own fee row — E3's about carries priorityLamports, checked on both sides (carry 1)

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 2: A simulation refused for rent maps to the rent copy, by account index, on `err` alone (carry 2)

**Files:**
- Modify: `extension/src/background/__tests__/prepare.test.ts`
- Modify: `extension/src/background/__tests__/prepareSimulation.test.ts`
- Modify: `extension/src/background/prepare.ts`

**Interfaces:**
- Consumes: `prepare.ts`'s simulation step and its existing `sender-below-rent` / `recipient-below-rent` checks; spec §11.5 (the coordinator's measured full-drain facts).
- Produces: `rentRefusal(err, keys, sender, recipient): 'sender-below-rent' | 'recipient-below-rent' | null` (exported from `src/background/prepare.ts`); `split-balance`'s detail is the largest holding in base units.

Carry 2, engine half. Spec §11.5: a node refuses a transaction that would leave an account between 1 and 890 879 lamports with `err: {InsufficientFundsForRent: {account_index: n}}`, every `accounts` entry null and logs that still read "success" (the rent check runs after execution). So the reader decides on **`err` only**: the index names the transaction's account key; the sender's index is `sender-below-rent`, the recipient's `recipient-below-rent` — the same codes, and so the same #19 copy, as the checks `prepare.ts` already makes before simulating. Any other shape stays `simulation-failed`. `split-balance` now carries the largest single holding as its detail (digits), so #19's "Send at most N" reads a number, never free text. The max-send half (drain to exactly 0 or keep ≥ the rent-exempt minimum) is Task 6's `maxSendable`.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/background/__tests__/prepare.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/prepare.test.ts b/extension/src/background/__tests__/prepare.test.ts
index 0f02c97..9a708c1 100644
--- a/extension/src/background/__tests__/prepare.test.ts
+++ b/extension/src/background/__tests__/prepare.test.ts
@@ -167,7 +167,8 @@ describe('prepareSend', () => {
         throw new Error('must not simulate');
       },
     });
-    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {token: 'NOC', recipient: RECIPIENT, amount: '160'})).rejects.toMatchObject({code: 'split-balance'});
+    // The detail is the largest single holding, in base units: #19 says "Send at most N" from it (plan 3).
+    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {token: 'NOC', recipient: RECIPIENT, amount: '160'})).rejects.toMatchObject({code: 'split-balance', detail: '100'});
   });
 
   it('refuses when SOL cannot cover the amount and the fees', async () => {
```

Modify `extension/src/background/__tests__/prepareSimulation.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/prepareSimulation.test.ts b/extension/src/background/__tests__/prepareSimulation.test.ts
index 7c3c387..fdd2f0d 100644
--- a/extension/src/background/__tests__/prepareSimulation.test.ts
+++ b/extension/src/background/__tests__/prepareSimulation.test.ts
@@ -1,4 +1,6 @@
-import {preparedFor, prepareSend} from '../prepare';
+import {base64} from '@scure/base';
+import {VersionedTransaction} from '@solana/web3.js';
+import {preparedFor, prepareSend, rentRefusal} from '../prepare';
 import {handleWallet} from '../walletApi';
 import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
 import {RpcMalformed, createForbiddenLatch, createRpc, solanaReader, type SimulationOutcome, type SolanaReader} from '../../../../core/solana/rpc';
@@ -202,3 +204,71 @@ describe('prepareSend: the simulation (E2)', () => {
     expect((r as {data: {detail: string}}).data.detail).toContain('1005050');
   });
 });
+
+// Spec §11.5 (the coordinator's measured full-drain facts, plan 3 carry 2): a payer left with 1 … 890 879
+// lamports gets err {InsufficientFundsForRent: {account_index: 0}}, every accounts entry null, and logs that
+// read "success". The engine decides on err alone and gives it the rent refusal's own code (and so #19's own
+// copy); an index that is neither the sender nor the recipient, or any other shape, stays simulation-failed.
+describe('prepareSend: a simulation refused for rent (§11.5)', () => {
+  /** A reader whose simulation answers `err(keys)` — keys are the transaction's own account keys — with accounts: null. */
+  function refusing(err: (keys: string[]) => unknown, overrides: Partial<SolanaReader> = {}) {
+    const base = sendReader(overrides);
+    const reader: SolanaReader = {
+      ...base,
+      simulateTransaction: async tx => {
+        const keys = VersionedTransaction.deserialize(base64.decode(tx)).message.staticAccountKeys.map(k => k.toBase58());
+        return {err: err(keys), logs: ['Program 11111111111111111111111111111111 success'], unitsConsumed: 150, slot: SIMULATED_SLOT, accounts: null};
+      },
+    };
+    return reader;
+  }
+
+  it('the sender’s index is sender-below-rent, whatever the logs say; the detail names the simulation', async () => {
+    const ext = await setup();
+    const reader = refusing(() => ({InsufficientFundsForRent: {account_index: 0}}));
+    const r = await handleWallet(ext, fakeDeps({reader}), 'wallet.prepareSend', {account: ACCOUNT.publicKey, intent: SOL_INTENT});
+    expect(r).toEqual({ok: false, error: 'sender-below-rent', data: {detail: 'the simulation refused it for rent: {"InsufficientFundsForRent":{"account_index":0}}'}});
+  });
+
+  it('the recipient’s index is recipient-below-rent', async () => {
+    const ext = await setup();
+    const reader = refusing(keys => ({InsufficientFundsForRent: {account_index: keys.indexOf(RECIPIENT)}}));
+    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'recipient-below-rent'});
+  });
+
+  it('any other index, an index past the keys, or another shape stays simulation-failed (negative controls)', async () => {
+    const ext = await setup();
+    for (const err of [
+      (keys: string[]) => ({InsufficientFundsForRent: {account_index: keys.indexOf('11111111111111111111111111111111')}}),
+      (keys: string[]) => ({InsufficientFundsForRent: {account_index: keys.length}}),
+      () => ({InsufficientFundsForRent: {account_index: '0'}}),
+      () => ({InsufficientFundsForRent: {account_index: -1}}),
+      () => ({InsufficientFundsForRent: {account_index: 0}, InstructionError: [2, {Custom: 1}]}),
+      () => 'InsufficientFundsForRent',
+      () => ({InstructionError: [2, {Custom: 1}]}),
+    ]) {
+      await expect(prepareSend(ext, fakeDeps({reader: refusing(err)}), ACCOUNT.publicKey, SOL_INTENT)).rejects.toMatchObject({code: 'simulation-failed'});
+    }
+  });
+
+  it('rentRefusal decides on err and the keys only', () => {
+    const keys = [ACCOUNT.publicKey, RECIPIENT, '11111111111111111111111111111111'];
+    expect(rentRefusal({InsufficientFundsForRent: {account_index: 0}}, keys, ACCOUNT.publicKey, RECIPIENT)).toBe('sender-below-rent');
+    expect(rentRefusal({InsufficientFundsForRent: {account_index: 1}}, keys, ACCOUNT.publicKey, RECIPIENT)).toBe('recipient-below-rent');
+    expect(rentRefusal({InsufficientFundsForRent: {account_index: 2}}, keys, ACCOUNT.publicKey, RECIPIENT)).toBeNull();
+    for (const err of [null, undefined, 7, [], {InsufficientFundsForRent: null}, {InsufficientFundsForRent: []}, {InsufficientFundsForRent: {account_index: 0.5}}]) {
+      expect(rentRefusal(err, keys, ACCOUNT.publicKey, RECIPIENT)).toBeNull();
+    }
+  });
+
+  it('a new recipient below 890 880 lamports is refused before anything is simulated', async () => {
+    const ext = await setup();
+    const reader = sendReader({
+      getAccountKind: async () => 'missing',
+      simulateTransaction: async () => {
+        throw new Error('must not simulate');
+      },
+    });
+    await expect(prepareSend(ext, fakeDeps({reader}), ACCOUNT.publicKey, {...SOL_INTENT, amount: '890879'})).rejects.toMatchObject({code: 'recipient-below-rent'});
+  });
+});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/background/__tests__/prepare.test.ts src/background/__tests__/prepareSimulation.test.ts
```
Expected (dry run): FAIL — Test Files 2 failed (2) · Tests 4 failed | 42 passed (46) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/background/prepare.ts`:

```diff
diff --git a/extension/src/background/prepare.ts b/extension/src/background/prepare.ts
index eee87c0..174a82d 100644
--- a/extension/src/background/prepare.ts
+++ b/extension/src/background/prepare.ts
@@ -184,6 +184,28 @@ function tokenAccountOf(a: SimulatedAccount | null): {mint: string; owner: strin
   return {mint: base58.encode(a.data.subarray(0, 32)), owner: base58.encode(a.data.subarray(32, 64)), amount: view.getBigUint64(64, true)};
 }
 
+/**
+ * A simulation the runtime refused for rent (spec §11.5, measured by the coordinator 2026-10-01): `err` is
+ * `{InsufficientFundsForRent: {account_index: n}}`, n indexing the transaction's account keys; every entry of
+ * `accounts` is null and the logs still read "success" (the rent check runs after execution). So the refusal
+ * is decided on `err` alone, never on `accounts` or the logs: the sender's index is `sender-below-rent`, the
+ * recipient's `recipient-below-rent` — the same codes, and so the same #19 copy, as the checks above that
+ * refuse before simulating. Any other account, or any other shape, is null (the caller's simulation-failed).
+ */
+export function rentRefusal(err: unknown, keys: readonly string[], sender: string, recipient: string): 'sender-below-rent' | 'recipient-below-rent' | null {
+  if (typeof err !== 'object' || err === null || Array.isArray(err)) return null;
+  const top = err as Record<string, unknown>;
+  if (Object.keys(top).length !== 1) return null;
+  const inner = top.InsufficientFundsForRent;
+  if (typeof inner !== 'object' || inner === null || Array.isArray(inner)) return null;
+  const index = (inner as Record<string, unknown>).account_index;
+  if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0) return null;
+  const key = keys[index];
+  if (key === sender) return 'sender-below-rent';
+  if (key === recipient) return 'recipient-below-rent';
+  return null;
+}
+
 async function loadPrepared(ext: Ext): Promise<PreparedSend[]> {
   const v = await ext.session.get(PREPARED_KEY);
   // An entry of another shape (an older build's) is not ours to sign or show.
@@ -245,7 +267,9 @@ export async function prepareSend(
     try {
       source = selectSourceTokenAccount(holdings.map(h => ({pubkey: h.pubkey, amount: h.amount})), amount);
     } catch (e) {
-      if (e instanceof SplitTokenBalance) throw new SendRefused('split-balance', e.message);
+      // The detail is the largest single holding in base units (plan 3): #19's "Send at most N" reads it as a
+      // number, never SplitTokenBalance's free text.
+      if (e instanceof SplitTokenBalance) throw new SendRefused('split-balance', holdings.reduce((max, h) => (h.amount > max ? h.amount : max), 0n).toString());
       if (e instanceof InsufficientTokenBalance) throw new SendRefused('insufficient-token', e.message);
       throw e;
     }
@@ -292,7 +316,12 @@ export async function prepareSend(
   const started = deps.now();
   const simulated = await deps.reader.simulateTransaction(base64.encode(new VersionedTransaction(message).serialize()), {accounts: addresses});
   const elapsedMs = Math.max(0, deps.now() - started);
-  if (simulated.err !== null) throw new SendRefused('simulation-failed', JSON.stringify(simulated.err));
+  if (simulated.err !== null) {
+    const rent = rentRefusal(simulated.err, message.staticAccountKeys.map(k => k.toBase58()), account, intent.recipient);
+    // Such a transaction would still be charged its fee if broadcast: refused here, with the rent copy (§11.5).
+    if (rent !== null) throw new SendRefused(rent, `the simulation refused it for rent: ${JSON.stringify(simulated.err)}`);
+    throw new SendRefused('simulation-failed', JSON.stringify(simulated.err));
+  }
   const senderAfter = simulated.accounts?.[0] ?? null;
   if (senderAfter === null) throw new SendRefused('simulation-mismatch', 'the simulation does not show the sending account');
   // SOL leaving the wallet must be exactly what this send costs: with the network fee in the simulated
```

- [ ] **Step 4: Run them green, then the whole suite.**

```bash
npx vitest run src/background/__tests__/prepare.test.ts src/background/__tests__/prepareSimulation.test.ts
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 2 passed (2) · Tests 46 passed (46); tsc clean; whole suite Test Files 101 passed (101) · Tests 1801 passed (1801).

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M2a** — `extension/src/background/prepare.ts`:

  ```diff
  - if (key === sender) return 'sender-below-rent';
  + if (key === recipient) return 'sender-below-rent';
  ```
  `npx vitest run src/background/__tests__/prepareSimulation.test.ts` — Expected: **red** (3 failed | 15 passed (18)).

- **M2b** — `extension/src/background/prepare.ts`:

  ```diff
  -     if (rent !== null) throw new SendRefused(rent,
  +     if (rent === null) throw new SendRefused('simulation-failed',
  ```
  `npx vitest run src/background/__tests__/prepareSimulation.test.ts` — Expected: **red** (3 failed | 15 passed (18)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/background/__tests__/prepare.test.ts extension/src/background/__tests__/prepareSimulation.test.ts extension/src/background/prepare.ts
git commit -F - <<'MSG'
feat(extension): a simulation refused for rent gets the rent copy — decided on err and its account index alone (spec §11.5, carry 2)

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 3: The send engine's gaps: `reauth.proven`, `validUntil`, the pending record's `feeLamports`

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/src/app/__tests__/engine.test.ts`
- Modify: `extension/src/app/engine.ts`
- Modify: `extension/src/background/__tests__/fixtures.ts`
- Modify: `extension/src/background/__tests__/pendingStore.test.ts`
- Modify: `extension/src/background/__tests__/prepare.test.ts`
- Modify: `extension/src/background/__tests__/send.test.ts`
- Create: `extension/src/background/__tests__/sendFeeCharged.test.ts`
- Modify: `extension/src/background/pending.ts`
- Modify: `extension/src/background/pendingStore.ts`
- Modify: `extension/src/background/prepare.ts`
- Modify: `extension/src/background/send.ts`

**Interfaces:**
- Consumes: `prepareSend`/`preparedFor` (`PreparedView`), `challengeSatisfied` (`reauthChallenges.ts`), `wallet.send`'s record (`send.ts`, `pendingStore.ts`), the UI engine's parsers (`src/app/engine.ts`).
- Produces: `PreparedView.reauth: {challengeId, reasons, proven: boolean} | null`; `PreparedView.validUntil: number` (createdAt + 30 s); `PendingRecord.feeLamports: string | null` (UI: `Pending.feeLamports: bigint | null`).

Three facts #20 and #21 need and the engine did not report — each derived from what the background already holds, never decided by the UI:
- **`reauth.proven`** — the engine's own `challengeSatisfied` for this intent. Spec §4.5 step 1 sends on `reauth === null`; without `proven`, #20 resumed after #10 could only open #10 again (a spec contradiction this plan resolves: step 1 is "`reauth === null` **or** a proven challenge"). It decides nothing: `wallet.send` consumes the proof itself.
- **`validUntil`** — `createdAt + PREPARED_TTL_MS`, so #20's "Quote valid N s" counts the engine's own deadline (D39).
- **`feeLamports`** on the pending record — network fee plus the Noctura fee when charged, exact (the compute-unit price and limit are signed): #21's "Fee paid", also after a reopened popup. A stored value that is not digits reads as null and **keeps** the record (a pending send is never hidden); a record from before plan 3 reads null. The extension charges no Noctura fee today (`feePolicy.ts`: status unknown), so `sendFeeCharged.test.ts` swaps in a charging policy with `vi.mock` — the only way to tell "network fee" from "network fee + Noctura fee" (dry-run catch: without it M3c survived).
- **A dead challenge makes the send `expired` (review M1).** `preparedFor` used `createdAt + CHALLENGE_TTL_MS` as the challenge's life, but a re-based challenge ends at `issuedAt + 10 min` (C5's cap), so a young send could carry a dead one: the resume showed #20, the tap opened #10, #10 said "expired", and the icon brought the same dead send back. Now `preparedFor` reports `expired: true` when `challengeInfo` finds the challenge dead; the resume re-prepares carrying the id, `rebaseChallenge` refuses it, a fresh challenge is issued, and the next tap opens a live #10 — once. Tested here (the engine) and end to end in Task 9.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/app/__tests__/engine.test.ts`:

```diff
diff --git a/extension/src/app/__tests__/engine.test.ts b/extension/src/app/__tests__/engine.test.ts
index 59270c6..0c47216 100644
--- a/extension/src/app/__tests__/engine.test.ts
+++ b/extension/src/app/__tests__/engine.test.ts
@@ -144,11 +144,32 @@ describe('shape checks: a reply of the wrong shape is failed', () => {
   it('pending: an unknown state or failure value', async () => {
     const p = {
       id: 'r1', account: acc, signature: '5'.repeat(88), lastValidBlockHeight: 1, createdAt: 1, lastSentAt: 1, state: 'pending', detail: null,
-      intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null,
+      intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}, expiryNullSeenAt: null, failure: null, feeLamports: '5050',
     };
     expect((await engineAnswering({ok: true, data: [p]}).pending()).ok).toBe(true);
     expect(await engineAnswering({ok: true, data: [{...p, state: 'lost'}]}).pending()).toEqual({ok: false, error: 'failed'});
     expect(await engineAnswering({ok: true, data: [{...p, failure: 'maybe'}]}).pending()).toEqual({ok: false, error: 'failed'});
+    // Plan 3: the fee paid is a base-unit string or null, nothing else.
+    expect((await engineAnswering({ok: true, data: [{...p, feeLamports: null}]}).pending()).ok).toBe(true);
+    expect(await engineAnswering({ok: true, data: [{...p, feeLamports: 5050}]}).pending()).toEqual({ok: false, error: 'failed'});
+    expect(await engineAnswering({ok: true, data: [{...p, feeLamports: undefined}]}).pending()).toEqual({ok: false, error: 'failed'});
+  });
+
+  // Plan 3: #20 reads whether the challenge is proven and when the quote ends; anything else is failed.
+  it('prepareSend: reauth.proven must be a boolean and validUntil a time', async () => {
+    const view = {
+      id: 'ab'.repeat(16),
+      fees: {networkLamports: '5050', priorityLamports: '50', rentLamports: '0', markupLamports: '0', markupReason: 'status-unknown'},
+      solRequiredLamports: '1005050',
+      reauth: {challengeId: 'cd'.repeat(16), reasons: ['first-send'], proven: false},
+      validUntil: 1_030_000,
+      simulation: {slot: 1, elapsedMs: 2, instructions: 3, programs: ['compute-budget', 'system'], recipient: 'wallet', sol: {before: '10', after: '9'}, token: null},
+    };
+    const intent = {token: 'SOL' as const, recipient: RECIPIENT, amount: 1n};
+    expect(await engineAnswering({ok: true, data: view}).prepareSend(acc, intent)).toMatchObject({ok: true, data: {reauth: {proven: false}, validUntil: 1_030_000}});
+    for (const bad of [{...view, reauth: {...view.reauth, proven: 'yes'}}, {...view, reauth: {challengeId: view.reauth.challengeId, reasons: ['first-send']}}, {...view, validUntil: -1}, {...view, validUntil: undefined}]) {
+      expect(await engineAnswering({ok: true, data: bad}).prepareSend(acc, intent)).toEqual({ok: false, error: 'failed'});
+    }
   });
 });
```

Modify `extension/src/background/__tests__/fixtures.ts`:

```diff
diff --git a/extension/src/background/__tests__/fixtures.ts b/extension/src/background/__tests__/fixtures.ts
index 7206fa1..cf23037 100644
--- a/extension/src/background/__tests__/fixtures.ts
+++ b/extension/src/background/__tests__/fixtures.ts
@@ -108,6 +108,7 @@ export const pendingRecord = (over: Partial<PendingRecord> = {}): PendingRecord
   intent: {token: 'SOL', recipient: 'R', amount: '1'},
   expiryNullSeenAt: null,
   failure: null,
+  feeLamports: null,
   ...over,
 });
```

Modify `extension/src/background/__tests__/pendingStore.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/pendingStore.test.ts b/extension/src/background/__tests__/pendingStore.test.ts
index cc7702c..f733071 100644
--- a/extension/src/background/__tests__/pendingStore.test.ts
+++ b/extension/src/background/__tests__/pendingStore.test.ts
@@ -52,3 +52,20 @@ describe('pendingStore', () => {
     expect(after.at(-1)?.id).toBe(`c${MAX_RECORDS + 4}`);
   });
 });
+
+// Plan 3: the fee a record pays is a display field. A record from before it, or one with a value that is not
+// digits, reads with feeLamports null — and is kept: a pending send must never be hidden.
+describe('PendingRecord.feeLamports (plan 3)', () => {
+  it('missing or malformed reads as null and the record is kept; digits read as they are', async () => {
+    const ext = fakeExt();
+    const {feeLamports: _drop, ...before} = record({id: 'old'});
+    await ext.local.set(PENDING_KEY, [before, record({id: 'bad', feeLamports: 'lots' as unknown as string}), record({id: 'num', feeLamports: 5050 as unknown as string}), record({id: 'ok', feeLamports: '5050'})]);
+    expect((await readPending(ext)).map(r => [r.id, r.feeLamports])).toEqual([
+      ['old', null],
+      ['bad', null],
+      ['num', null],
+      ['ok', '5050'],
+    ]);
+    expect(viewOf((await readPending(ext))[3]!).feeLamports).toBe('5050');
+  });
+});
```

Modify `extension/src/background/__tests__/prepare.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/prepare.test.ts b/extension/src/background/__tests__/prepare.test.ts
index 9a708c1..2392ec1 100644
--- a/extension/src/background/__tests__/prepare.test.ts
+++ b/extension/src/background/__tests__/prepare.test.ts
@@ -337,10 +337,12 @@ describe('prepareSend', () => {
     const first = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT);
     const challengeId = first.reauth!.challengeId;
     const again = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT, {challengeId});
-    expect(again.reauth).toEqual({challengeId, reasons: ['first-send']});
+    expect(again.reauth).toEqual({challengeId, reasons: ['first-send'], proven: false});
     await satisfyChallenge(ext, deps.now(), challengeId);
     const third = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT, {challengeId});
     expect(third.reauth?.challengeId).toBe(challengeId);
+    // Plan 3: the proof carried into the re-prepare is reported, so #20's next tap sends instead of asking again.
+    expect(third.reauth?.proven).toBe(true);
     expect((await peekPrepared(ext, third.id))?.challengeId).toBe(challengeId);
     expect(Object.keys((await ext.session.get(REAUTH_KEY)) as object)).toEqual([challengeId]);
   });
@@ -355,6 +357,8 @@ describe('prepareSend', () => {
     const other = await prepareSend(ext, deps, ACCOUNT.publicKey, {...SOL_INTENT, amount: '2000000'}, {challengeId});
     expect(other.reauth?.challengeId).toBeDefined();
     expect(other.reauth?.challengeId).not.toBe(challengeId);
+    // A new challenge is a new grant: not proven, whatever the carried one was.
+    expect(other.reauth?.proven).toBe(false);
     const otherRecipient = await prepareSend(ext, deps, ACCOUNT.publicKey, {...SOL_INTENT, recipient: HOLDING_SMALL}, {challengeId});
     expect(otherRecipient.reauth?.challengeId).not.toBe(challengeId);
     const junk = await prepareSend(ext, deps, ACCOUNT.publicKey, SOL_INTENT, {challengeId: '__proto__'});
```

Modify `extension/src/background/__tests__/send.test.ts`:

```diff
diff --git a/extension/src/background/__tests__/send.test.ts b/extension/src/background/__tests__/send.test.ts
index 0bf072c..dc29d29 100644
--- a/extension/src/background/__tests__/send.test.ts
+++ b/extension/src/background/__tests__/send.test.ts
@@ -3,10 +3,10 @@ import {base58, base64} from '@scure/base';
 import {VersionedTransaction} from '@solana/web3.js';
 import {sendPrepared, signPrepared} from '../send';
 import {peekPrepared, preparedFor, prepareSend, PREPARED_TTL_MS, sendIntentDigest} from '../prepare';
-import {CHALLENGE_TTL_MS, challengeSatisfied, consumeChallenge, satisfyChallenge} from '../reauthChallenges';
+import {CHALLENGE_MAX_LIFE_MS, CHALLENGE_TTL_MS, challengeInfo, challengeSatisfied, consumeChallenge, satisfyChallenge} from '../reauthChallenges';
 import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
 import {PREPARED_KEY, setSession} from '../session';
-import {PENDING_KEY} from '../pendingStore';
+import {PENDING_KEY, readPending} from '../pendingStore';
 import type {SessionAccount} from '../../vault/accounts';
 import {AUTOLOCK_ALARM} from '../autolock';
 import {firstSignature} from '../../../../core/solana/broadcast';
@@ -194,3 +194,73 @@ describe('preparedFor (a reopened popup resumes)', () => {
     expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
   });
 });
+
+// Plan 3: what #20 needs from the engine to take one tap per broadcast — whether the challenge is proven (so
+// a resumed #20 sends on a tap instead of opening #10 again), when the quote ends, and the fee #21 shows.
+describe('the views #20 and #21 read (plan 3)', () => {
+  it('reauth.proven follows the challenge: false when issued, true once the vault page proves it, false again for a new grant', async () => {
+    const ext = fakeExt();
+    await unlocked(ext);
+    const deps = fakeDeps({reader: sendReader()});
+    const first = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
+    const challengeId = first.reauth!.challengeId;
+    expect(first.reauth?.proven).toBe(false);
+    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.reauth?.proven).toBe(false);
+    await satisfyChallenge(ext, deps.now(), challengeId);
+    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.reauth?.proven).toBe(true);
+    // Past its 120 s life the proof is gone: preparedFor no longer reports the send at all.
+    deps.clock.t += CHALLENGE_TTL_MS;
+    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toBeNull();
+  });
+
+  it('a young send whose challenge reached C5’s 10-minute cap is reported expired; prepared again, it gets a fresh live challenge, and is then live (review M1)', async () => {
+    const ext = fakeExt();
+    await unlocked(ext);
+    const deps = fakeDeps({reader: sendReader()});
+    const start = deps.clock.t;
+    let view = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
+    const old = view.reauth!.challengeId;
+    await satisfyChallenge(ext, deps.now(), old);
+    // Kept alive by re-prepares carrying the challenge (each rebases it) up to 10 s before the cap.
+    while (deps.clock.t + 100_000 < start + CHALLENGE_MAX_LIFE_MS - 10_000) {
+      deps.clock.t += 100_000;
+      view = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId: old});
+      expect(view.reauth?.challengeId).toBe(old);
+    }
+    deps.clock.t = start + CHALLENGE_MAX_LIFE_MS - 10_000;
+    view = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId: old});
+    expect(view.reauth).toMatchObject({challengeId: old, proven: true});
+    // 20 s on: the send is 20 s old (its 120 s window open), but the challenge passed its cap.
+    deps.clock.t += 20_000;
+    expect(await challengeInfo(ext, deps.now(), old)).toBeNull();
+    const resumed = await preparedFor(ext, deps, ACCOUNT.publicKey);
+    expect(resumed).toMatchObject({expired: true, reauth: {challengeId: old, proven: false}});
+    // Prepared again carrying it: a fresh challenge, unproven, live — and preparedFor no longer says expired.
+    const fresh = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT, {challengeId: old});
+    expect(fresh.reauth?.challengeId).not.toBe(old);
+    expect(fresh.reauth?.proven).toBe(false);
+    expect(await preparedFor(ext, deps, ACCOUNT.publicKey)).toMatchObject({expired: false, reauth: {challengeId: fresh.reauth?.challengeId}});
+  });
+
+  it('validUntil is the prepare time plus the 30 s prepared life, in the view and in preparedFor', async () => {
+    const ext = fakeExt();
+    await unlocked(ext);
+    const deps = fakeDeps({reader: sendReader()});
+    const prepared = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
+    expect(prepared.validUntil).toBe(deps.clock.t + PREPARED_TTL_MS);
+    deps.clock.t += 10_000;
+    expect((await preparedFor(ext, deps, ACCOUNT.publicKey))?.validUntil).toBe(prepared.validUntil);
+  });
+
+  it('the pending record carries the fee it pays: network fee plus the Noctura fee', async () => {
+    const ext = fakeExt();
+    await unlocked(ext);
+    await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
+    const deps = fakeDeps({reader: sendReader()});
+    deps.broadcast = async wire => firstSignature(wire);
+    const prepared = await prepareSend(ext, deps, ACCOUNT.publicKey, INTENT);
+    const view = await sendPrepared(ext, deps, prepared.id);
+    expect(view.feeLamports).toBe((BigInt(prepared.fees.networkLamports) + BigInt(prepared.fees.markupLamports)).toString());
+    expect((await readPending(ext))[0]?.feeLamports).toBe(view.feeLamports);
+  });
+});
```

Create `extension/src/background/__tests__/sendFeeCharged.test.ts`:

```ts
import {sendPrepared} from '../send';
import {prepareSend} from '../prepare';
import {KNOWN_RECIPIENTS_KEY} from '../knownRecipients';
import {readPending} from '../pendingStore';
import {firstSignature} from '../../../../core/solana/broadcast';
import {TRANSFER_MARKUP_LAMPORTS} from '../../../../core/fees/transferMarkup';
import {fakeDeps} from './fakeDeps';
import {fakeExt} from './fakeExt';
import {ACCOUNT, RECIPIENT, sendReader, unlocked} from './fixtures';

// Plan 3: the fee a pending record says it pays includes the Noctura fee when one is charged. The extension's
// policy inputs are 'unknown' today (feePolicy.ts: nothing is charged), so this file swaps them for a charging
// policy — the only way to tell "network fee" from "network fee + Noctura fee" apart.
vi.mock('../feePolicy', () => ({EXTENSION_FEE_INPUTS: {tgeStatus: 'claimable', isZeroFeeEligible: false, stakingDiscount: 0}}));

it('a charged Noctura fee is part of the pending record’s feeLamports (network fee + markup)', async () => {
  const ext = fakeExt();
  await unlocked(ext);
  await ext.local.set(KNOWN_RECIPIENTS_KEY, [RECIPIENT]);
  const deps = fakeDeps({reader: sendReader()});
  deps.broadcast = async wire => firstSignature(wire);
  const prepared = await prepareSend(ext, deps, ACCOUNT.publicKey, {token: 'SOL', recipient: RECIPIENT, amount: '1000000'});
  expect(prepared.fees).toMatchObject({markupLamports: TRANSFER_MARKUP_LAMPORTS.toString(), markupReason: 'charged'});
  const view = await sendPrepared(ext, deps, prepared.id);
  expect(view.feeLamports).toBe((BigInt(prepared.fees.networkLamports) + TRANSFER_MARKUP_LAMPORTS).toString());
  expect((await readPending(ext))[0]?.feeLamports).toBe(view.feeLamports);
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/engine.test.ts src/background/__tests__/fixtures.ts src/background/__tests__/pendingStore.test.ts src/background/__tests__/prepare.test.ts src/background/__tests__/send.test.ts src/background/__tests__/sendFeeCharged.test.ts
```
Expected (dry run): FAIL — Test Files 5 failed (5) · Tests 10 failed | 64 passed (74) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/engine.ts`:

```diff
diff --git a/extension/src/app/engine.ts b/extension/src/app/engine.ts
index 9e6212a..a490aeb 100644
--- a/extension/src/app/engine.ts
+++ b/extension/src/app/engine.ts
@@ -60,7 +60,10 @@ export interface Prepared {
   id: string;
   fees: {networkLamports: bigint; priorityLamports: bigint; rentLamports: bigint; markupLamports: bigint; markupReason: FeeReason};
   solRequiredLamports: bigint;
-  reauth: {challengeId: string; reasons: ReauthReason[]} | null;
+  /** `proven`: the vault page proved this challenge and it is live — a tap on #20 may send now (the engine still checks). */
+  reauth: {challengeId: string; reasons: ReauthReason[]; proven: boolean} | null;
+  /** Epoch ms after which this prepared send is no longer sendable: #20's "Quote valid N s". */
+  validUntil: number;
   simulation: Simulation;
 }
 export type Resumable = Prepared & {intent: Intent; expired: boolean};
@@ -77,6 +80,8 @@ export interface Pending {
   intent: Intent;
   expiryNullSeenAt: number | null;
   failure: 'landed' | 'not-sent' | null;
+  /** What it pays if it lands (network fee + Noctura fee), lamports; null for a record from before plan 3. */
+  feeLamports: bigint | null;
 }
 export type HistoryKind = 'sent' | 'received' | 'purchase' | 'other';
 export interface HistoryItem {
@@ -270,11 +275,11 @@ function preparedOf(x: unknown): Prepared | undefined {
   if (o.reauth !== null) {
     const r = obj(o.reauth);
     const reasons = all(r?.reasons, v => oneOf(v, REASONS));
-    if (r === undefined || typeof r.challengeId !== 'string' || !HEX32.test(r.challengeId) || reasons === undefined) return undefined;
-    reauth = {challengeId: r.challengeId, reasons};
+    if (r === undefined || typeof r.challengeId !== 'string' || !HEX32.test(r.challengeId) || reasons === undefined || typeof r.proven !== 'boolean') return undefined;
+    reauth = {challengeId: r.challengeId, reasons, proven: r.proven};
   }
-  if (Object.values(fees).some(v => v === undefined) || solRequiredLamports === undefined || simulation === undefined) return undefined;
-  return {id: o.id, fees: fees as Prepared['fees'], solRequiredLamports, reauth, simulation};
+  if (Object.values(fees).some(v => v === undefined) || solRequiredLamports === undefined || simulation === undefined || !isTime(o.validUntil)) return undefined;
+  return {id: o.id, fees: fees as Prepared['fees'], solRequiredLamports, reauth, validUntil: o.validUntil, simulation};
 }
 
 function resumableOf(x: unknown): Resumable | null | undefined {
@@ -294,7 +299,8 @@ function pendingOf(x: unknown): Pending | undefined {
   const intent = intentOf(o.intent);
   const failure = o.failure === null ? null : oneOf(o.failure, ['landed', 'not-sent'] as const);
   const expiry = o.expiryNullSeenAt === null ? null : isTime(o.expiryNullSeenAt) ? o.expiryNullSeenAt : undefined;
-  if (state === undefined || intent === undefined || failure === undefined || expiry === undefined) return undefined;
+  const feeLamports = o.feeLamports === null ? null : units(o.feeLamports);
+  if (state === undefined || intent === undefined || failure === undefined || expiry === undefined || feeLamports === undefined) return undefined;
   if (!isInt(o.lastValidBlockHeight) || !isTime(o.createdAt) || !isTime(o.lastSentAt) || !(o.detail === null || typeof o.detail === 'string')) return undefined;
   return {
     id: o.id,
@@ -308,6 +314,7 @@ function pendingOf(x: unknown): Pending | undefined {
     intent,
     expiryNullSeenAt: expiry,
     failure,
+    feeLamports,
   };
 }
```

Modify `extension/src/background/pending.ts`:

```diff
diff --git a/extension/src/background/pending.ts b/extension/src/background/pending.ts
index a5aab37..210acf8 100644
--- a/extension/src/background/pending.ts
+++ b/extension/src/background/pending.ts
@@ -66,7 +66,7 @@ async function deliver(ext: Ext, deps: WalletDeps, record: PendingRecord, attemp
 export async function submitSigned(
   ext: Ext,
   deps: WalletDeps,
-  input: {account: string; wire: Uint8Array; lastValidBlockHeight: number; intent: SendIntent},
+  input: {account: string; wire: Uint8Array; lastValidBlockHeight: number; intent: SendIntent; feeLamports?: string},
 ): Promise<PendingView> {
   const now = deps.now();
   const record: PendingRecord = {
@@ -82,6 +82,7 @@ export async function submitSigned(
     intent: input.intent,
     expiryNullSeenAt: null,
     failure: null,
+    feeLamports: input.feeLamports ?? null,
   };
   const guard = {refused: false};
   await updatePending(ext, records => {
```

Modify `extension/src/background/pendingStore.ts`:

```diff
diff --git a/extension/src/background/pendingStore.ts b/extension/src/background/pendingStore.ts
index 612ee30..acea69c 100644
--- a/extension/src/background/pendingStore.ts
+++ b/extension/src/background/pendingStore.ts
@@ -34,6 +34,13 @@ export interface PendingRecord {
   /** When a full-history status check past expiry first came back null; `expired` needs a second one ≥ 2 s later. */
   expiryNullSeenAt: number | null;
   failure: PendingFailure | null;
+  /**
+   * What the transaction pays if it lands, base units (plan 3): its network fee plus the Noctura fee when
+   * charged, as prepared — exact, the compute-unit price and limit are signed. #21's "Fee paid". Null on a
+   * record from before plan 3, and for any stored value that is not digits: a display field never drops a
+   * record (a pending send must never be hidden).
+   */
+  feeLamports: string | null;
 }
 
 /** What leaves the background: everything but the signed bytes. */
@@ -48,8 +55,8 @@ const serial = createMutex();
 const STATES: readonly string[] = ['pending', 'stuck', 'confirmed', 'failed', 'expired'];
 const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
 
-/** A stored element is a claim: only an exact record shape is read; anything else is dropped. `failure` is checked by recordOf. */
-function isRecord(x: unknown): x is Omit<PendingRecord, 'failure'> & {failure?: unknown} {
+/** A stored element is a claim: only an exact record shape is read; anything else is dropped. `failure` and `feeLamports` are checked by recordOf. */
+function isRecord(x: unknown): x is Omit<PendingRecord, 'failure' | 'feeLamports'> & {failure?: unknown; feeLamports?: unknown} {
   if (typeof x !== 'object' || x === null || Array.isArray(x)) return false;
   const r = x as Record<string, unknown>;
   const i = r.intent as Record<string, unknown> | null;
@@ -73,12 +80,16 @@ function isRecord(x: unknown): x is Omit<PendingRecord, 'failure'> & {failure?:
   );
 }
 
-/** A record from before E8 has no `failure`: it reads as null, so no migration is needed. Any other value drops the record. */
+/**
+ * A record from before E8 has no `failure`: it reads as null, so no migration is needed. Any other value drops the
+ * record. `feeLamports` (plan 3) reads as null when it is missing or not digits — the record itself is kept.
+ */
 function recordOf(x: unknown): PendingRecord | null {
   if (!isRecord(x)) return null;
+  const fee = typeof x.feeLamports === 'string' && /^\d{1,20}$/.test(x.feeLamports) ? x.feeLamports : null;
   const f = x.failure;
-  if (f === undefined || f === null) return {...x, failure: null};
-  return f === 'landed' || f === 'not-sent' ? {...x, failure: f} : null;
+  if (f === undefined || f === null) return {...x, failure: null, feeLamports: fee};
+  return f === 'landed' || f === 'not-sent' ? {...x, failure: f, feeLamports: fee} : null;
 }
 
 export async function readPending(ext: Ext): Promise<PendingRecord[]> {
@@ -109,6 +120,7 @@ export function viewOf(r: PendingRecord): PendingView {
     intent: r.intent,
     expiryNullSeenAt: r.expiryNullSeenAt,
     failure: r.failure,
+    feeLamports: r.feeLamports,
   };
 }
```

Modify `extension/src/background/prepare.ts`:

```diff
diff --git a/extension/src/background/prepare.ts b/extension/src/background/prepare.ts
index 174a82d..f0d875f 100644
--- a/extension/src/background/prepare.ts
+++ b/extension/src/background/prepare.ts
@@ -8,7 +8,7 @@ import {EXTENSION_FEE_INPUTS} from './feePolicy';
 import {isKnownRecipient} from './knownRecipients';
 import {readSettings} from './settings';
 import {sendReauthReasons, usdMicros, type SendReauthReason} from './reauthPolicy';
-import {CHALLENGE_TTL_MS, dropChallengesFor, issueChallenge, rebaseChallenge, type SendAboutRefresh} from './reauthChallenges';
+import {CHALLENGE_TTL_MS, challengeInfo, challengeSatisfied, dropChallengesFor, issueChallenge, rebaseChallenge, type SendAboutRefresh} from './reauthChallenges';
 import {digestOf, randomId} from './digest';
 import {SendRefused, type SendIntent} from './sendTypes';
 import {estimatePriorityFee} from '../../../core/solana/priorityFee';
@@ -82,7 +82,14 @@ export interface PreparedView {
   id: string;
   fees: {networkLamports: string; priorityLamports: string; rentLamports: string; markupLamports: string; markupReason: FeeReason};
   solRequiredLamports: string;
-  reauth: {challengeId: string; reasons: SendReauthReason[]} | null;
+  /**
+   * `proven` (plan 3): the vault page has proven this challenge and it is still live for this intent — what
+   * wallet.send checks first (challengeSatisfied). #20 reads it to know a tap may send now; without it a
+   * resumed #20 could only open #10 again. It never decides anything: wallet.send consumes the proof itself.
+   */
+  reauth: {challengeId: string; reasons: SendReauthReason[]; proven: boolean} | null;
+  /** When this prepared send stops being sendable (createdAt + PREPARED_TTL_MS, epoch ms): #20's "Quote valid N s" counts it down (D39). */
+  validUntil: number;
   simulation: SimulationView;
 }
 
@@ -415,15 +422,17 @@ export async function prepareSend(
     const keep = (await loadPrepared(ext)).filter(p => p.account !== account && now - p.createdAt < CHALLENGE_TTL_MS).slice(-(MAX_PREPARED - 1));
     await ext.session.set(PREPARED_KEY, [...keep, prepared]);
   });
-  return viewOf(prepared);
+  return viewOf(ext, deps, prepared);
 }
 
-function viewOf(p: PreparedSend): PreparedView {
+async function viewOf(ext: Ext, deps: Pick<WalletDeps, 'now'>, p: PreparedSend): Promise<PreparedView> {
+  const proven = p.challengeId !== null && (await challengeSatisfied(ext, deps.now(), p.challengeId, p.intentDigest));
   return {
     id: p.id,
     fees: p.shown.fees,
     solRequiredLamports: p.shown.solRequiredLamports,
-    reauth: p.challengeId === null ? null : {challengeId: p.challengeId, reasons: p.shown.reasons},
+    reauth: p.challengeId === null ? null : {challengeId: p.challengeId, reasons: p.shown.reasons, proven},
+    validUntil: p.createdAt + PREPARED_TTL_MS,
     simulation: p.shown.simulation,
   };
 }
@@ -433,13 +442,20 @@ function viewOf(p: PreparedSend): PreparedView {
  * re-authentication can resume. Past PREPARED_TTL_MS it is still reported — `expired`, not
  * sendable — while its challenge can live (CHALLENGE_TTL_MS): the popup then prepares the same
  * intent again with that challengeId instead of asking for a second re-authentication.
+ *
+ * A send whose challenge is already dead is `expired` too, however young the send (plan-3 review M1): a re-based
+ * challenge ends at issuedAt + CHALLENGE_MAX_LIFE_MS (C5's cap), so `createdAt + CHALLENGE_TTL_MS` is not its
+ * life. Reported live, the resume would show #20, open #10 for a challenge #10 calls expired, and the icon would
+ * bring the same dead send back. Reported expired, the resume prepares again carrying the id; rebaseChallenge
+ * refuses a dead one, a fresh challenge is issued, and the next tap opens a live #10 — once, so no loop.
  */
 export async function preparedFor(ext: Ext, deps: Pick<WalletDeps, 'now'>, account: string): Promise<ResumableView | null> {
   const now = deps.now();
   const mine = (await loadPrepared(ext)).filter(p => p.account === account && now - p.createdAt < CHALLENGE_TTL_MS);
   const newest = mine.reduce<PreparedSend | null>((a, p) => (a === null || p.createdAt >= a.createdAt ? p : a), null);
   if (newest === null) return null;
-  return {...viewOf(newest), intent: newest.intent, expired: now - newest.createdAt >= PREPARED_TTL_MS};
+  const challengeDead = newest.challengeId !== null && (await challengeInfo(ext, now, newest.challengeId)) === null;
+  return {...(await viewOf(ext, deps, newest)), intent: newest.intent, expired: challengeDead || now - newest.createdAt >= PREPARED_TTL_MS};
 }
 
 /**
```

Modify `extension/src/background/send.ts`:

```diff
diff --git a/extension/src/background/send.ts b/extension/src/background/send.ts
index 18b3c9f..c8052a8 100644
--- a/extension/src/background/send.ts
+++ b/extension/src/background/send.ts
@@ -58,6 +58,9 @@ export async function sendPrepared(ext: Ext, deps: WalletDeps, id: string): Prom
     wire: signPrepared(prepared, account),
     lastValidBlockHeight: prepared.lastValidBlockHeight,
     intent: prepared.intent,
+    // What this transaction pays: its network fee (5 000 per signature plus the priority fee, both fixed by
+    // the signed compute-unit price and limit) and the Noctura fee when one is charged — #21's "Fee paid".
+    feeLamports: (BigInt(prepared.shown.fees.networkLamports) + BigInt(prepared.shown.fees.markupLamports)).toString(),
   });
   // An approved signature resets the idle timer (spec §2) — best effort: the transaction is out,
   // and a failed re-arm must not turn its answer into "failed".
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 3e44ce5..cc5bfa1 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1518,7 +1518,10 @@ point here. **One user tap per broadcast, always (D38; review B1).**
      `wallet.html#/send/resume?account=…`.
   3. **Resume** (that tab, or a reopened popup; also any other opener of that hash): read
      `wallet.preparedFor(account)`. If `expired`, `wallet.prepareSend(account, intent,
-     challengeId)` with the carried challenge (re-based, D39). **Then show #20** (`confirmed` if a
+     challengeId)` with the carried challenge (re-based, D39). `expired` is also true when the send's
+     challenge is already dead, however young the send (plan 3, review M1: a re-based challenge ends at
+     C5's 10-minute cap, not 120 s after the send was prepared); the re-prepare then gets a fresh
+     challenge, and the tap opens #10 for it — once. **Then show #20** (`confirmed` if a
      re-auth was just proven, `resume` otherwise) **and wait for a tap.** No code path from a resume
      calls `wallet.send` without a tap. After the tap, step 1 or 2 applies.
   4. `wallet.send` refusals:
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/engine.test.ts src/background/__tests__/fixtures.ts src/background/__tests__/pendingStore.test.ts src/background/__tests__/prepare.test.ts src/background/__tests__/send.test.ts src/background/__tests__/sendFeeCharged.test.ts
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 5 passed (5) · Tests 74 passed (74); tsc clean; whole suite Test Files 102 passed (102) · Tests 1808 passed (1808).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M3a** — `extension/src/background/prepare.ts`:

  ```diff
  - const proven = p.challengeId !== null && (await challengeSatisfied(ext, deps.now(), p.challengeId, p.intentDigest));
  + const proven = p.challengeId !== null;
  ```
  `npx vitest run src/background/__tests__/prepare.test.ts` — Expected: **red** (2 failed | 26 passed (28)).

- **M3b** — `extension/src/background/pendingStore.ts`:

  ```diff
  - /^\d{1,20}$/.test(x.feeLamports)
  + x.feeLamports.length > 0
  ```
  `npx vitest run src/background/__tests__/pendingStore.test.ts` — Expected: **red** (1 failed | 6 passed (7)).

- **M3c** — `extension/src/background/send.ts`:

  ```diff
  -  + BigInt(prepared.shown.fees.markupLamports)
  + (deleted)
  ```
  `npx vitest run src/background/__tests__/sendFeeCharged.test.ts` — Expected: **red** (1 failed (1)).

- **M3d** — `extension/src/background/prepare.ts`:

  ```diff
  -   const challengeDead = newest.challengeId !== null && (await challengeInfo(ext, now, newest.challengeId)) === null;
  +   const challengeDead = false;
  ```
  `npx vitest run src/background/__tests__/send.test.ts src/app/__tests__/Confirm.test.tsx` — Expected: **red** (2 failed | 48 passed (50)).

- [ ] **Step 7: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/app/__tests__/engine.test.ts extension/src/app/engine.ts extension/src/background/__tests__/fixtures.ts extension/src/background/__tests__/pendingStore.test.ts extension/src/background/__tests__/prepare.test.ts extension/src/background/__tests__/send.test.ts extension/src/background/__tests__/sendFeeCharged.test.ts extension/src/background/pending.ts extension/src/background/pendingStore.ts extension/src/background/prepare.ts extension/src/background/send.ts
git commit -F - <<'MSG'
feat(extension): the engine reports a proven challenge, the quote's end and the fee a send pays

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 4: Failed sends decoded from their instructions — owner question 1, option A (carry 3)

**Files:**
- Modify: `core/solana/__tests__/history.test.ts`
- Modify: `core/solana/history.ts`
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/e2e/popup.spec.ts`
- Modify: `extension/e2e/visual.spec.ts`
- Modify: `extension/src/app/__tests__/Activity.test.tsx`
- Modify: `extension/src/app/__tests__/TxDetail.test.tsx`
- Modify: `extension/src/app/history.ts`
- Modify: `extension/src/app/screens/TxDetail.tsx`

**Interfaces:**
- Consumes: `core/solana/history.ts` (`decodeHistory`), `src/app/history.ts` (`matches`, `rowText`), `TxDetail.tsx`.
- Produces: a failed transaction signed by the owner (first key) that carries a System transfer or an SPL Transfer/TransferChecked decodes as kind `sent` with token, amount and counterparty; rows "Failed · sent SOL" / "— SOL", shown under Sent; anything else stays "Failed · transaction" / "—".

Carry 3, **built under the recommended option A, pending the owner's answer (Scope, owner question 1)**. Plan 1 decoded every failed transaction as `other` ("Failed · transaction", All only). Option A reads what a failed transaction tried to send from its own instructions, only when this account signed it (its first key): "Failed · sent SOL" / "the network fee was charged" / "— SOL" as 26b draws it, under "Sent" as well as "All"; #27 reads "FAILED · SENT" and "— SOL". Nothing moved, so no balance changes. If the owner picks B (keep plan 1's rows), drop this task and Task 14's `[Try again]` on #27; nothing else depends on it. Two E2E files asserted `getByText('Sent SOL')`, which now also matches "Failed · sent SOL": they use `exact: true`. A transaction the owner signed only as a token authority while another account paid (its first key) stays `other` — the owner paid no fee (dry-run catch: M4a survived without that case).

**Exactly one transfer, of a known mint (review H1, controller ruling).** #27's `[Try again]` proposes what was decoded, so a failed batch (1 SOL to A and 1 SOL to B) must never read as "2 SOL to A": a failed transaction is `sent` only when it carries exactly one transfer from the owner (System, or SPL of a mint `tokenForMint` knows) — two transfers, a token plus a SOL transfer, or an unknown mint decode as `other`. Only top-level instructions are read: a transfer a program makes for the owner (an inner, CPI instruction — a dApp's wrapped transfer) stays "Failed · transaction"; the spec's §6.2 entry says so as the honest limit of option A.

- [ ] **Step 1: Write the failing tests.**

Modify `core/solana/__tests__/history.test.ts`:

```diff
diff --git a/core/solana/__tests__/history.test.ts b/core/solana/__tests__/history.test.ts
index 06e85d0..4eb6e3e 100644
--- a/core/solana/__tests__/history.test.ts
+++ b/core/solana/__tests__/history.test.ts
@@ -90,9 +90,100 @@ describe('decodeHistoryEntry', () => {
     expect(usdt).toMatchObject({kind: 'purchase', token: 'USDT', amount: 25_000_000n});
   });
 
-  it('a failed transaction is "other", failed, with its fee', () => {
+  it('a failed transaction with no transfer the owner signed is "other", failed, with its fee', () => {
     const e = decodeHistoryEntry(OWNER, 'sig', tx({keys: [OWNER, OTHER], pre: [1_000_000, 0], post: [995_000, 0], err: {InstructionError: [0, 'Custom']}}));
-    expect(e).toMatchObject({kind: 'other', failed: true, feeLamports: 5000n, amount: null});
+    expect(e).toMatchObject({kind: 'other', failed: true, feeLamports: 5000n, amount: null, token: null});
+  });
+
+  // Plan 3, owner question 1 (option A): a failed send reads as what it tried to send — from its instructions.
+  describe('a failed send: what it tried to send, from its own instructions (plan 3)', () => {
+    const ERR = {InstructionError: [0, {Custom: 1}]};
+    const failedKeys = {pre: [1_000_000, 0, 0, 1], post: [995_000, 0, 0, 1], err: ERR};
+
+    it('a System transfer signed by the owner: sent SOL, the attempted amount and recipient, failed (the Noctura fee transfer left out)', () => {
+      const e = decodeHistoryEntry(OWNER, 'sig', tx({
+        ...failedKeys,
+        keys: [OWNER, OTHER, MAINNET_FEE_TREASURY, SYSTEM],
+        instructions: [sysTransfer(OWNER, OTHER, 2_480_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
+      }));
+      expect(e).toEqual({signature: 'sig', blockTime: 1_700_000_000, kind: 'sent', token: 'SOL', mint: null, amount: 2_480_000_000n, counterparty: OTHER, feeLamports: 5000n, failed: true});
+    });
+
+    it('an SPL TransferChecked: the token by its mint, the recipient wallet from the destination’s balance entry', () => {
+      const e = decodeHistoryEntry(OWNER, 'sig', tx({
+        ...failedKeys,
+        keys: [OWNER, 'SrcAta111', 'DestAta111', SYSTEM],
+        instructions: [{program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OWNER, mint: NOC, tokenAmount: {amount: '2000', decimals: 9}}}}],
+        preToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
+        postToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
+      }));
+      expect(e).toMatchObject({kind: 'sent', token: 'NOC', mint: NOC, amount: 2000n, counterparty: OTHER, failed: true});
+    });
+
+    it('an SPL Transfer to an account created in the same transaction: the mint from the source entry, the wallet from the create', () => {
+      const e = decodeHistoryEntry(OWNER, 'sig', tx({
+        ...failedKeys,
+        keys: [OWNER, 'SrcAta111', 'NewAta111', SYSTEM],
+        instructions: [
+          {program: 'spl-associated-token-account', parsed: {type: 'createIdempotent', info: {account: 'NewAta111', wallet: OTHER, mint: USDC, source: OWNER}}},
+          {program: 'spl-token', parsed: {type: 'transfer', info: {source: 'SrcAta111', destination: 'NewAta111', authority: OWNER, amount: '12000000'}}},
+        ],
+        preToken: [tb(1, USDC, OWNER, '50000000')],
+        postToken: [tb(1, USDC, OWNER, '50000000')],
+      }));
+      expect(e).toMatchObject({kind: 'sent', token: 'USDC', mint: USDC, amount: 12_000_000n, counterparty: OTHER, failed: true});
+    });
+
+    it('a failed transaction the owner did not pay for, one it signed only as a token authority, or one whose only transfer is the Noctura fee, stays "other" (negative controls)', () => {
+      const notSigned = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OTHER, OWNER, SYSTEM, MAINNET_FEE_TREASURY], instructions: [sysTransfer(OTHER, OWNER, 1_000)]}));
+      expect(notSigned).toMatchObject({kind: 'other', failed: true, amount: null});
+      const someoneElses = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, OTHER, SYSTEM, MAINNET_FEE_TREASURY], instructions: [sysTransfer(OTHER, OWNER, 1_000)]}));
+      expect(someoneElses).toMatchObject({kind: 'other', failed: true});
+      const feeOnly = decodeHistoryEntry(OWNER, 'sig', tx({...failedKeys, keys: [OWNER, MAINNET_FEE_TREASURY, SYSTEM, OTHER], instructions: [sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)]}));
+      expect(feeOnly).toMatchObject({kind: 'other', failed: true});
+      const otherAuthority = decodeHistoryEntry(OWNER, 'sig', tx({
+        ...failedKeys,
+        keys: [OWNER, 'SrcAta111', 'DestAta111', SYSTEM],
+        instructions: [{program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OTHER, mint: NOC, tokenAmount: {amount: '2000', decimals: 9}}}}],
+      }));
+      expect(otherAuthority).toMatchObject({kind: 'other', failed: true});
+      // Signed as the token authority, but another account paid (its first key): the owner paid no fee, so it is
+      // not the owner's failed send.
+      const relayed = decodeHistoryEntry(OWNER, 'sig', tx({
+        ...failedKeys,
+        keys: [OTHER, OWNER, 'SrcAta111', 'DestAta111'],
+        instructions: [{program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OWNER, mint: NOC, tokenAmount: {amount: '2000', decimals: 9}}}}],
+      }));
+      expect(relayed).toMatchObject({kind: 'other', failed: true});
+    });
+
+    // Plan-3 review H1: #27's [Try again] proposes what was decoded, so a batch is never summed into one send.
+    it('more than one transfer from the owner (two System transfers, or a token and a SOL transfer), or an unknown mint, stays "other"', () => {
+      const twoSol = decodeHistoryEntry(OWNER, 'sig', tx({
+        ...failedKeys,
+        keys: [OWNER, OTHER, 'Second1111', SYSTEM],
+        instructions: [sysTransfer(OWNER, OTHER, 1_000_000_000), sysTransfer(OWNER, 'Second1111', 1_000_000_000), sysTransfer(OWNER, MAINNET_FEE_TREASURY, 20_000)],
+      }));
+      expect(twoSol).toMatchObject({kind: 'other', failed: true, token: null, amount: null, counterparty: null});
+      const tokenAndSol = decodeHistoryEntry(OWNER, 'sig', tx({
+        ...failedKeys,
+        keys: [OWNER, 'SrcAta111', 'DestAta111', OTHER],
+        instructions: [
+          {program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OWNER, mint: NOC, tokenAmount: {amount: '2000', decimals: 9}}}},
+          sysTransfer(OWNER, OTHER, 1_000_000),
+        ],
+        preToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
+        postToken: [tb(1, NOC, OWNER, '5000'), tb(2, NOC, OTHER, '0')],
+      }));
+      expect(tokenAndSol).toMatchObject({kind: 'other', failed: true});
+      const unknownMint = decodeHistoryEntry(OWNER, 'sig', tx({
+        ...failedKeys,
+        keys: [OWNER, 'SrcAta111', 'DestAta111', SYSTEM],
+        instructions: [{program: 'spl-token', parsed: {type: 'transferChecked', info: {source: 'SrcAta111', destination: 'DestAta111', authority: OWNER, mint: 'UnknownMint1111111111111111111111111111111', tokenAmount: {amount: '2000', decimals: 9}}}}],
+      }));
+      expect(unknownMint).toMatchObject({kind: 'other', failed: true, token: null});
+    });
+
   });
 
   it('never throws on a malformed answer', () => {
```

Modify `extension/e2e/popup.spec.ts`:

```diff
diff --git a/extension/e2e/popup.spec.ts b/extension/e2e/popup.spec.ts
index a0cfa31..166ad3e 100644
--- a/extension/e2e/popup.spec.ts
+++ b/extension/e2e/popup.spec.ts
@@ -83,20 +83,21 @@ test('8 · activity: kinds, filters, a detail page, Load more, and the explorer
     h.fake.history.set(MAIN.publicKey, list);
     const popup = await h.openPopup();
     await popup.getByRole('button', {name: 'Activity'}).click();
-    await expect(popup.getByText('Sent SOL')).toBeVisible({timeout: 30_000});
+    // Exact: "Failed · sent SOL" contains the words too (plan 3, owner question 1, option A).
+    await expect(popup.getByText('Sent SOL', {exact: true})).toBeVisible({timeout: 30_000});
     await expect(popup.getByText('Received USDC')).toBeVisible();
     await expect(popup.getByText('Presale purchase')).toBeVisible();
-    await expect(popup.getByText('Failed · transaction')).toBeVisible();
+    await expect(popup.getByText('Failed · sent SOL')).toBeVisible();
     await expect(popup.getByText(/^to Your account: Savings/)).toBeVisible();
 
     await popup.getByRole('tab', {name: 'Received'}).click();
-    await expect(popup.getByText('Sent SOL')).toHaveCount(0);
+    await expect(popup.getByText('Sent SOL', {exact: true})).toHaveCount(0);
     await popup.getByRole('tab', {name: 'All'}).click();
 
     await popup.getByRole('button', {name: 'Load more'}).click();
     await expect(popup.locator('button.tx-row')).toHaveCount(12, {timeout: 30_000});
 
-    await popup.getByText('Sent SOL').click();
+    await popup.getByText('Sent SOL', {exact: true}).click();
     await expect(popup.getByText('SENT', {exact: true})).toBeVisible();
     const link = popup.getByRole('link', {name: 'Explorer'});
     await expect(link).toHaveAttribute('href', `https://solscan.io/tx/${sig(1)}`);
```

Modify `extension/e2e/visual.spec.ts`:

```diff
diff --git a/extension/e2e/visual.spec.ts b/extension/e2e/visual.spec.ts
index 236c37f..0e5d4d8 100644
--- a/extension/e2e/visual.spec.ts
+++ b/extension/e2e/visual.spec.ts
@@ -62,24 +62,25 @@ test('visual: the plan-1 screens and states at 412 × 600', async () => {
 
     await p.getByRole('button', {name: 'Activity'}).click();
     // All five rows, the slowest (~5 s a page at 2 getTransaction/s) last.
-    for (const t of ['Sent SOL', 'Received USDC', 'Presale purchase', 'Other transaction', 'Failed · transaction']) await expect(p.getByText(t)).toBeVisible({timeout: 30_000});
+    for (const t of ['Sent SOL', 'Received USDC', 'Presale purchase', 'Other transaction', 'Failed · sent SOL']) await expect(p.getByText(t, {exact: true})).toBeVisible({timeout: 30_000});
     await shot(p, '26-loaded-mixed');
     await p.locator('main.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
-    await expect(p.getByText('Failed · transaction')).toBeInViewport();
+    await expect(p.getByText('Failed · sent SOL')).toBeInViewport();
     await shot(p, '26-loaded-mixed-end');
     await p.getByRole('tab', {name: 'Sent'}).click();
     await expect(p.getByRole('tab', {name: 'Sent'})).toHaveAttribute('aria-selected', 'true');
-    await expect(p.locator('button.tx-row .pri')).toHaveText(['Sent SOL']);
+    // A failed send is a send (plan 3, owner question 1, option A): it shows under "Sent", marked Failed.
+    await expect(p.locator('button.tx-row .pri')).toHaveText(['Sent SOL', 'Failed · sent SOL']);
     await shot(p, '26-filter-sent');
     await p.getByRole('tab', {name: 'All'}).click();
     const details = [
       ['Sent SOL', 'SENT', '27-transparent-send'],
       ['Received USDC', 'RECEIVED', '27-received'],
-      ['Failed · transaction', 'FAILED', '27-failed'],
+      ['Failed · sent SOL', 'FAILED · SENT', '27-failed'],
       ['Presale purchase', 'PRESALE PURCHASE', '27-purchase'],
     ] as const;
     for (const [title, eyebrow, name] of details) {
-      await p.getByText(title).click();
+      await p.getByText(title, {exact: true}).click();
       await expect(p.locator('.amount-card .eyebrow')).toHaveText(eyebrow);
       // Opened at the top (fix round 1, A1): the top bar is in view, not scrolled past.
       await expect(p.getByText('Transaction', {exact: true})).toBeInViewport();
```

Modify `extension/src/app/__tests__/Activity.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/Activity.test.tsx b/extension/src/app/__tests__/Activity.test.tsx
index fa4a0f6..9d56b0f 100644
--- a/extension/src/app/__tests__/Activity.test.tsx
+++ b/extension/src/app/__tests__/Activity.test.tsx
@@ -2,7 +2,7 @@
 import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
 import {renderInWallet, setupWallet, walletReader} from './harness';
 import {Activity} from '../screens/Activity';
-import {rowText} from '../history';
+import {matches, rowText} from '../history';
 import {Home} from '../screens/Home';
 import {RECONNECTED_MS, useWallet, WalletProvider, type WalletModel} from '../WalletContext';
 import {PENDING_KEY} from '../../background/pendingStore';
@@ -55,8 +55,10 @@ describe('#26 activity', () => {
     expect(within(received).getByText('+250.00')).toBeTruthy();
     expect(screen.getByText('Presale purchase')).toBeTruthy();
     expect(screen.getByText(/^no transfer to or from this account/)).toBeTruthy();
-    expect(screen.getByText('Failed · transaction')).toBeTruthy();
-    expect(screen.getByText(/^the network fee was charged · /)).toBeTruthy();
+    // Plan 3, owner question 1 (option A): a failed send reads as what it tried to send.
+    const failed = screen.getByText('Failed · sent SOL').closest('button') as HTMLElement;
+    expect(within(failed).getByText(/^the network fee was charged · /)).toBeTruthy();
+    expect(within(failed).getByText('— SOL')).toBeTruthy();
     expect(screen.getByText(/^TODAY · /)).toBeTruthy();
     expect(document.body.textContent).not.toMatch(/\$\d|Wallet|Dapp|Swaps|Shielded/);
     fireEvent.click(sent);
@@ -76,7 +78,18 @@ describe('#26 activity', () => {
     expect(rowText({...base, kind: 'sent', token: 'SOL', amount: 1n, counterparty: null}, []).mono).toBe(false);
     expect(sec('Presale purchase').classList.contains('noc-mono')).toBe(false);
     expect(sec('Other transaction').classList.contains('noc-mono')).toBe(false);
-    expect(sec('Failed · transaction').classList.contains('noc-mono')).toBe(false);
+    expect(sec('Failed · sent SOL').classList.contains('noc-mono')).toBe(false);
+  });
+
+  // Plan 3, owner question 1 (option A): only a failed SEND names what it tried; any other failed transaction
+  // keeps the generic row, and shows under "All" only.
+  it('a failed transaction that is not a send stays "Failed · transaction" with a dash, and is not a send', () => {
+    const failedOther = {signature: sig(9), blockTime: null, kind: 'other', token: null, mint: null, amount: null, counterparty: null, feeLamports: 5_000n, failed: true} as const;
+    expect(rowText(failedOther, [])).toMatchObject({title: 'Failed · transaction', amount: '—', tone: 'fail'});
+    expect([matches(failedOther, 'all'), matches(failedOther, 'sent'), matches(failedOther, 'received'), matches(failedOther, 'purchases')]).toEqual([true, false, false, false]);
+    const failedSend = {...failedOther, kind: 'sent', token: 'USDC', amount: 12_000_000n, counterparty: COUNTERPARTY} as const;
+    expect(rowText(failedSend, [])).toMatchObject({title: 'Failed · sent USDC', amount: '— USDC', tone: 'fail'});
+    expect([matches(failedSend, 'all'), matches(failedSend, 'sent'), matches(failedSend, 'received')]).toEqual([true, true, false]);
   });
 
   // Found in fix round 1's visual pass: 26b's TODAY / YESTERDAY rows end in the time ("· 9:14 AM"),
@@ -104,7 +117,7 @@ describe('#26 activity', () => {
     expect(ic.querySelector('path[d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"]')).not.toBeNull();
     // The rest keep their tones: sent, recv (rotated in app.css), purchase in the swap tint, fail.
     const tone = (title: string) => ((screen.getByText(title).closest('button') as HTMLElement).querySelector('.ic') as HTMLElement).className;
-    expect([tone('Sent SOL'), tone('Received USDC'), tone('Presale purchase'), tone('Failed · transaction')]).toEqual(['ic send', 'ic recv', 'ic swap', 'ic fail']);
+    expect([tone('Sent SOL'), tone('Received USDC'), tone('Presale purchase'), tone('Failed · sent SOL')]).toEqual(['ic send', 'ic recv', 'ic swap', 'ic fail']);
     // Fix round 2 (#2): the purchase row follows 26b's swap row (11813): `.ic.swap` with #i-swap.
     const purchase = (screen.getByText('Presale purchase').closest('button') as HTMLElement).querySelector('.ic') as HTMLElement;
     expect([...purchase.querySelectorAll('path')].map(p => p.getAttribute('d'))).toEqual(['M3 8h13a4 4 0 0 1 0 8h-3', 'm7 4-4 4 4 4', 'M21 16H8a4 4 0 0 1 0-8h3', 'm17 20 4-4-4-4']);
@@ -116,7 +129,10 @@ describe('#26 activity', () => {
     expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['All', 'Sent', 'Received', 'Purchases']);
     fireEvent.click(screen.getByRole('tab', {name: 'Sent'}));
     expect(screen.getByText('Sent SOL')).toBeTruthy();
+    // A failed send is a send (plan 3, option A); the other kinds are not.
+    expect(screen.getByText('Failed · sent SOL')).toBeTruthy();
     expect(screen.queryByText('Received USDC')).toBeNull();
+    expect(screen.queryByText('Other transaction')).toBeNull();
     fireEvent.click(screen.getByRole('tab', {name: 'Received'}));
     expect(screen.getByText('Received USDC')).toBeTruthy();
     expect(screen.queryByText('Sent SOL')).toBeNull();
```

Modify `extension/src/app/__tests__/TxDetail.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/TxDetail.test.tsx b/extension/src/app/__tests__/TxDetail.test.tsx
index 8000585..c45950f 100644
--- a/extension/src/app/__tests__/TxDetail.test.tsx
+++ b/extension/src/app/__tests__/TxDetail.test.tsx
@@ -135,7 +135,7 @@ describe('#27 tx-detail', () => {
     expect(screen.getByText('0.000 005 SOL')).toBeTruthy();
   });
 
-  it('a failed transaction: the danger pill and banner, the fee charged; no Try again in plan 1', async () => {
+  it('a failed transaction that was not a send: "FAILED", a dash, the danger pill and banner, the fee charged; no Try again', async () => {
     const w = renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} />);
     await w;
     expect(await screen.findByText('FAILED')).toBeTruthy();
@@ -148,6 +148,16 @@ describe('#27 tx-detail', () => {
     expect(screen.queryByText('Try again')).toBeNull();
   });
 
+  // Plan 3, owner question 1 (option A): the engine reads what a failed send tried to send.
+  it('a failed send: "FAILED · SENT" and "— SOL", the danger pill and banner, the fee charged', async () => {
+    await renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), amount: 1_000_000n, counterparty: COUNTERPARTY, failed: true})} onBack={() => undefined} />);
+    expect(await screen.findByText('FAILED · SENT')).toBeTruthy();
+    expect(document.querySelector('.amount-card .amt')?.textContent).toBe('— SOL');
+    expect(await screen.findByText('Fee charged · $0.0007')).toBeTruthy();
+    expect(document.querySelector('.status-pill.fail')?.textContent).toBe('Failed');
+    expect(screen.getByText('The transaction failed on chain. The network fee was charged; the amount did not move.')).toBeTruthy();
+  });
+
   it('a presale purchase and an other: their eyebrows and the decoded fields that exist', async () => {
     renderInWallet(<TxDetail signature={sig(3)} item={item({signature: sig(3), kind: 'purchase', amount: 1_000_000_000n, counterparty: null})} onBack={() => undefined} />);
     expect(await screen.findByText('PRESALE PURCHASE')).toBeTruthy();
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run ../core/solana/__tests__/history.test.ts src/app/__tests__/Activity.test.tsx src/app/__tests__/TxDetail.test.tsx
```
Expected (dry run): FAIL — Test Files 2 failed | 1 passed (3) · Tests 8 failed | 55 passed (63) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `core/solana/history.ts`:

```diff
diff --git a/core/solana/history.ts b/core/solana/history.ts
index fdae98a..e81c97b 100644
--- a/core/solana/history.ts
+++ b/core/solana/history.ts
@@ -10,7 +10,10 @@ export interface HistoryEntry {
   kind: HistoryKind;
   token: WalletToken | null;
   mint: string | null;
-  /** Base units, always positive; null when there is nothing to show. */
+  /**
+   * Base units, always positive; null when there is nothing to show. For a failed `sent` entry it is what the
+   * transaction tried to send — which did not move.
+   */
   amount: bigint | null;
   counterparty: string | null;
   feeLamports: bigint;
@@ -57,12 +60,65 @@ function systemTransfers(instructions: Json[]): {source: string; destination: st
   return out;
 }
 
+/** The owner of a token account, from the balances the RPC reports for this transaction (pre or post). */
+function tokenAccountOwner(meta: Json, keys: readonly (string | null)[], account: string): {owner: string; mint: string} | null {
+  const index = keys.indexOf(account);
+  if (index < 0) return null;
+  for (const e of [...asArray(meta.postTokenBalances), ...asArray(meta.preTokenBalances)]) {
+    if (isObj(e) && e.accountIndex === index && typeof e.owner === 'string' && typeof e.mint === 'string') return {owner: e.owner, mint: e.mint};
+  }
+  return null;
+}
+
+/**
+ * What a FAILED transaction tried to send (plan 3, owner question 1, option A): nothing moved, so the balance
+ * changes say nothing — but its own instructions do. Only for a transaction this owner paid for and signed (the
+ * first key), and only when it carries EXACTLY ONE transfer from the owner (plan-3 review H1: #27's [Try again]
+ * proposes this intent, so a batch is never summed into one send to its first recipient): an SPL TransferChecked
+ * or Transfer whose authority is the owner, of a mint the wallet knows (the mint from the instruction or from the
+ * source account's balance entry; the recipient wallet from the destination's balance entry, or from an
+ * associated-token-account create for it in the same transaction), or one System transfer from the owner (the
+ * Noctura fee's transfer to the treasury left out). Top-level instructions only: a transfer a program makes for
+ * the owner (an inner, CPI instruction) is not read, so a dApp's wrapped transfer stays `other`. Anything else
+ * is null: the caller's `other`.
+ */
+function attemptedSend(owner: string, keys: readonly (string | null)[], instructions: Json[], meta: Json): {token: WalletToken; mint: string | null; amount: bigint; counterparty: string | null} | null {
+  if (keys[0] !== owner) return null;
+  const found: {token: WalletToken | null; mint: string | null; amount: bigint; counterparty: string | null}[] = [];
+  for (const ix of instructions) {
+    if (ix.program !== 'spl-token' || !isObj(ix.parsed) || (ix.parsed.type !== 'transferChecked' && ix.parsed.type !== 'transfer') || !isObj(ix.parsed.info)) continue;
+    const info = ix.parsed.info;
+    if (info.authority !== owner || typeof info.source !== 'string' || typeof info.destination !== 'string') continue;
+    const amount = ix.parsed.type === 'transferChecked' ? (isObj(info.tokenAmount) ? big(info.tokenAmount.amount) : 0n) : big(info.amount);
+    const mint = typeof info.mint === 'string' ? info.mint : (tokenAccountOwner(meta, keys, info.source)?.mint ?? null);
+    let counterparty = tokenAccountOwner(meta, keys, info.destination)?.owner ?? null;
+    if (counterparty === null) {
+      for (const c of instructions) {
+        if (c.program === 'spl-associated-token-account' && isObj(c.parsed) && isObj(c.parsed.info) && c.parsed.info.account === info.destination && typeof c.parsed.info.wallet === 'string') {
+          counterparty = c.parsed.info.wallet;
+        }
+      }
+    }
+    if (amount > 0n) found.push({token: mint === null ? null : tokenForMint(mint), mint, amount, counterparty});
+  }
+  for (const tr of systemTransfers(instructions)) {
+    if (tr.source === owner && tr.destination !== MAINNET_FEE_TREASURY) found.push({token: 'SOL', mint: null, amount: tr.lamports, counterparty: tr.destination});
+  }
+  const only = found.length === 1 ? found[0] : undefined;
+  // One transfer, of a token the wallet knows: an unknown mint is not a send the wallet can name or repeat.
+  if (only === undefined || only.token === null) return null;
+  return {...only, token: only.token};
+}
+
 /**
  * One getTransaction(jsonParsed) result, seen from `owner`: sent, received, a presale purchase, or
  * other. Read from balance changes, not instruction shapes, so non-canonical token accounts and
  * inner instructions come out right. A SOL amount excludes the network fee the owner paid and the
  * Noctura markup (a separate transfer to the fee vault). Untrusted input: never throws.
  *
+ * A failed transaction moved nothing but its fee: it is `sent` with what it tried to send when the owner signed a
+ * transfer (attemptedSend), and `other` otherwise — `failed` is set on both.
+ *
  * One entry per transaction: when a transaction moves both a token and SOL for the owner (a token
  * send that also paid rent for the recipient's account, or the markup), only the token leg is
  * reported — the SOL leg is not a separate entry (plan "Scope" item 12).
@@ -77,7 +133,11 @@ export function decodeHistoryEntry(owner: string, signature: string, tx: unknown
   const failed = meta.err !== null && meta.err !== undefined;
   const base = {signature, blockTime: typeof t.blockTime === 'number' ? t.blockTime : null, feeLamports, failed};
   const other: HistoryEntry = {...base, kind: 'other', token: null, mint: null, amount: null, counterparty: null};
-  if (failed) return other;
+  if (failed) {
+    // Nothing moved; what was attempted is read from the instructions (plan 3, owner question 1, option A).
+    const tried = attemptedSend(owner, keys, instructions, meta);
+    return tried === null ? other : {...base, kind: 'sent', ...tried};
+  }
 
   const index = keys.indexOf(owner);
   let solDelta = 0n;
```

Modify `extension/src/app/history.ts`:

```diff
diff --git a/extension/src/app/history.ts b/extension/src/app/history.ts
index b43501c..3de193f 100644
--- a/extension/src/app/history.ts
+++ b/extension/src/app/history.ts
@@ -10,11 +10,15 @@ export const FILTERS: readonly {value: Filter; text: string}[] = [
 ];
 export const isFilter = (x: string | null): x is Filter => x === 'all' || x === 'sent' || x === 'received' || x === 'purchases';
 
-/** D24: the filters apply to the rows already loaded; "Load more" continues underneath. */
+/**
+ * D24: the filters apply to the rows already loaded; "Load more" continues underneath. A failed send (the
+ * engine reads what it tried to send — plan 3, owner question 1, option A) is a send: it shows under "Sent" as
+ * well as "All", marked Failed. Any other failed transaction shows under "All" only.
+ */
 export function matches(item: HistoryItem, f: Filter): boolean {
   if (f === 'all') return true;
-  if (item.failed) return false;
   if (f === 'sent') return item.kind === 'sent';
+  if (item.failed) return false;
   if (f === 'received') return item.kind === 'received';
   return item.kind === 'purchase';
 }
@@ -43,10 +47,12 @@ export type RowTone = 'send' | 'recv' | 'swap' | 'fail' | 'plain';
  */
 export function rowText(item: HistoryItem, accounts: readonly Account[]): {title: string; meta: string; amount: string; tone: RowTone; mono: boolean} {
   if (item.failed) {
-    // The engine decodes a failed transaction as `other` with no token (core/solana/history.ts): the
-    // kind and token of what was attempted are not known here.
-    const what = item.kind === 'other' || item.token === null ? 'transaction' : `${item.kind} ${item.token}`;
-    return {title: `Failed · ${what}`, meta: 'the network fee was charged', amount: '—', tone: 'fail', mono: false};
+    // A failed send carries what it tried to send (core/solana/history.ts reads it from the instructions:
+    // plan 3, owner question 1, option A): "Failed · sent SOL" and "— SOL", as 26b draws the failed row. Any
+    // other failed transaction moved nothing we can name: "Failed · transaction" and "—". The design's fee in
+    // dollars under the amount is not shown — no row carries fiat (spec §6.2 Differs).
+    const sent = item.kind === 'sent' && item.token !== null;
+    return {title: sent ? `Failed · sent ${item.token}` : 'Failed · transaction', meta: 'the network fee was charged', amount: sent ? `— ${item.token}` : '—', tone: 'fail', mono: false};
   }
   const amount = (sign: string) => (item.amount === null || item.token === null ? '—' : `${sign}${showAmount(item.token, item.amount)}`);
   switch (item.kind) {
```

Modify `extension/src/app/screens/TxDetail.tsx`:

```diff
diff --git a/extension/src/app/screens/TxDetail.tsx b/extension/src/app/screens/TxDetail.tsx
index 7af26dc..43dd3d5 100644
--- a/extension/src/app/screens/TxDetail.tsx
+++ b/extension/src/app/screens/TxDetail.tsx
@@ -186,9 +186,9 @@ export function TxDetail({signature, item: given, onBack}: {signature: string; i
         <div className="scroll">
           <div className="amount-card app-failed">
             {/*
-              The 'FAILED · SENT' arm cannot be reached in plan 1: core/solana/history.ts decodes every
-              failed transaction as `other` with no token, so this reads "FAILED" and "—" — the plan-1
-              stand-in declared in spec §6.3 Differs (owner decision in plan 3). Kept for that decision.
+              A failed send carries what it tried to send (core/solana/history.ts, plan 3 owner question 1,
+              option A): "FAILED · SENT" and "— SOL", as 27d draws a failed card. Any other failed transaction
+              has no kind or token to name: "FAILED" and "—".
             */}
             <div className="eyebrow noc-overline">{item.kind === 'sent' ? 'FAILED · SENT' : 'FAILED'}</div>
             <div className="amt noc-balance-lg noc-numeral">{item.token === null ? '—' : `— ${item.token}`}</div>
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index cc5bfa1..3f99a53 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1905,12 +1905,19 @@ point here. **One user tap per broadcast, always (D38; review B1).**
     They are a scanning aid; verification surfaces (#20, #27, #10, #13) show the full address (§11
     conflict 7).
   - Pull-to-refresh becomes the button (D2).
-  - **Plan-1 stand-in — failed rows** (Task 17 fix round 1): `core/solana/history.ts` decodes every
-    failed transaction as `other` with no token or amount (`if (failed) return other;`), so a failed
-    row reads "Failed · transaction" / "the network fee was charged" / "—" (red `.ic.fail` with the
-    ✕ glyph), not "Failed · sent SOL"; and the **Sent filter does not include failed sends** (a failed
-    row matches only "All"). The design's failed row ("— SOL" with the fee in dollars beneath) needs
-    the attempted kind and token, which the decoder does not keep. Owner decision in plan 3.
+  - **Failed rows — plan 3, owner question 1, built with the recommended option A (pending the owner's
+    answer):** `core/solana/history.ts` reads what a failed transaction tried to send from its own
+    instructions — exactly one transfer from this account (a System transfer, or an SPL
+    TransferChecked/Transfer of a token the wallet knows), which paid for it (its first key); a batch
+    of transfers or an unknown mint stays `other` (plan-3 review H1: #27's `[Try again]` proposes what
+    was decoded). Only top-level instructions are read: a transfer a program makes for this account
+    (an inner, CPI instruction — a dApp's wrapped transfer) stays "Failed · transaction", the honest
+    limit of option A — so a failed send reads "Failed · sent SOL" / "the network fee was charged" / "— SOL"
+    (red `.ic.fail` with the ✕ glyph), as 26b draws the failed row, and shows under "Sent" as well as
+    "All". A failed transaction this account did not sign, or one that is not a transfer, still reads
+    "Failed · transaction" / … / "—" and shows under "All" only. The design's fee in dollars under the
+    amount is not shown: no row carries fiat (above). (Plan 1 decoded every failed transaction as
+    `other`.)
   - **Purchase row:** the design has no purchase row; it follows 26b's swap row (`.ic.swap` with
     `#i-swap`).
   - **Other row:** the design's no-funds row (`.ic` neutral, `#i-doc`, 26b) is used, but its amount
@@ -1952,10 +1959,11 @@ point here. **One user tap per broadcast, always (D38; review B1).**
   - The 6+6 checksum highlight is replaced by groups of four (spec §3).
   - The shielded/dApp state 27b is hidden (D4, B1c).
   - Fiat is labelled "now" as marked.
-  - **Plan-1 stand-in — failed** (Task 17 fix round 1; see §6.2's failed-rows entry): the decoder
-    gives a failed transaction as `other` with no token, so #27 reads eyebrow "FAILED" (not "FAILED ·
-    SENT") and amount "—" (not "— SOL"); `[Try again]` is absent until the send flow (plan 3).
-    `TxDetail.tsx` keeps the "FAILED · SENT" arm for that decision. Owner decision in plan 3.
+  - **Failed — plan 3, owner question 1, option A** (see §6.2's failed-rows entry): a failed send reads
+    eyebrow "FAILED · SENT" and amount "— SOL", with `[Try again]` → #19 for the same intent when the
+    decoded recipient and amount are known (the engine re-checks everything on prepare, and #20 shows
+    the whole address and its first-send warning before one tap sends); any other failed transaction
+    reads "FAILED" and "—", with no `[Try again]`.
   - 27d's "Reason", "Tried to swap", "Slippage limit" and "Observed move" rows are a swap's; a failed
     transfer has none of them (no swaps, and no failure reason in `HistoryView`).
   - `received`: "To" shows the full address in groups with Copy (a verification surface, §11
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run ../core/solana/__tests__/history.test.ts src/app/__tests__/Activity.test.tsx src/app/__tests__/TxDetail.test.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 3 passed (3) · Tests 63 passed (63); tsc clean; whole suite Test Files 102 passed (102) · Tests 1815 passed (1815).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M4a** — `core/solana/history.ts`:

  ```diff
  -   if (keys[0] !== owner) return null;
  + (deleted)
  ```
  `npx vitest run ../core/solana/__tests__/history.test.ts` — Expected: **red** (1 failed | 12 passed (13)).

- **M4b** — `extension/src/app/history.ts`:

  ```diff
  - `Failed · sent ${item.token}`
  + 'Failed · transaction'
  ```
  `npx vitest run src/app/__tests__/Activity.test.tsx` — Expected: **red** (5 failed | 23 passed (28)).

- **M4c** — `core/solana/history.ts`:

  ```diff
  -   const only = found.length === 1 ? found[0] : undefined;
  +   const only = found.length >= 1 ? {...found[0]!, amount: found.reduce((sum, f) => sum + f.amount, 0n)} : undefined;
  ```
  `npx vitest run ../core/solana/__tests__/history.test.ts src/app/__tests__/TxDetail.test.tsx` — Expected: **red** (2 failed | 35 passed (37)).

- **M4d** — `core/solana/history.ts`:

  ```diff
  -   if (only === undefined || only.token === null) return null;
  +   if (only === undefined) return null;
  ```
  `npx vitest run ../core/solana/__tests__/history.test.ts` — Expected: **red** (1 failed | 12 passed (13)).

- [ ] **Step 7: Commit.**

```bash
git add core/solana/__tests__/history.test.ts core/solana/history.ts docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/e2e/popup.spec.ts extension/e2e/visual.spec.ts extension/src/app/__tests__/Activity.test.tsx extension/src/app/__tests__/TxDetail.test.tsx extension/src/app/history.ts extension/src/app/screens/TxDetail.tsx
git commit -F - <<'MSG'
feat(extension): a failed send reads "Failed · sent SOL" — decoded from its own instructions (owner question 1, option A)

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 5: The send flow's design classes regenerated; the ancestor-aware class check with its negative fixture (carry 4)

**Files:**
- Create: `extension/src/app/__tests__/sendStyles.test.tsx`
- Modify: `extension/src/styles/design-ext.css`

**Interfaces:**
- Consumes: plan 1's extraction script with plan 2's prefixes (plan 2, Task 5 Step 3); `src/__tests__/styled.ts` (`unstyledClasses`, ancestor-aware since plan 2).
- Produces: `design-ext.css` with `.s-send`, `.s-sim`, `.s-conf`, `.s-stat`, `.s-stuck`, `.s9-fail-hero`, `.s9-reason-banner`, `.s9-payload-card`, `.s9-toast-cancelled` and six keyframes; `sendStyles.test.tsx`.

Carry 4. `check-classes.mjs` checks that every class is *defined*, not that it styles in place: `.status-pill` exists only as `.s-txd .status-pill`, so a StatusPill outside #27 passes the gate unstyled. Plan 2's `unstyledClasses` (src/__tests__/styled.ts) is ancestor-aware; plan 3 uses it in **every** send-screen test (each screen's first test asserts `unstyledClasses(container, SELECTORS)` is empty) and adds the negative fixture: a StatusPill outside `.s-txd` is flagged, inside it is not. Then `design-ext.css` is regenerated — **never by hand** — with the plan-3 prefixes.

- [ ] **Step 1: Write the failing test.**

Create `extension/src/app/__tests__/sendStyles.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {render} from '@testing-library/react';
import {StatusPill} from '../ui/StatusPill';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';

const SELECTORS = selectorsOf(UI_SHEETS);

// Plan 3 (carry 4): scripts/check-classes.mjs asks only whether a class appears in SOME selector. `.status-pill`
// is styled only as `.s-txd .status-pill`, so a StatusPill on #21 would pass that gate and render unstyled. The
// send flow's screens are therefore checked where they render (src/__tests__/styled.ts, every class matched in
// place, as plan 2 did for the vault page); this is the negative fixture that proves the check sees it.
describe('the send flow’s classes, matched where they stand (carry 4)', () => {
  it('negative fixture: a StatusPill outside #27’s .s-txd matches no rule; inside it, it does', () => {
    const {container} = render(
      <div>
        <div className="screen s-stat" data-testid="status">
          <StatusPill text="Confirmed" />
        </div>
        <div className="screen s-txd" data-testid="detail">
          <StatusPill text="Confirmed" />
        </div>
      </div>,
    );
    const status = container.querySelector('[data-testid="status"] .status-pill') as Element;
    const detail = container.querySelector('[data-testid="detail"] .status-pill') as Element;
    expect(unstyledClasses(status, SELECTORS)).toEqual(['div.status-pill: .status-pill matches no rule in place']);
    expect(unstyledClasses(detail, SELECTORS)).toEqual([]);
  });

  it('design-ext.css carries the send flow’s design classes (regenerated from index.html, never by hand)', () => {
    expect(SELECTORS).toEqual(
      expect.arrayContaining([
        '.s-send .recipient-row .input',
        '.s-send .amount-row .max-chip',
        '.s-sim .check-row.warn .ic',
        '.s-sim .delta-row .val.neg',
        '.s-conf .fee-row.total',
        '.s-conf .first-time-banner',
        '.s-stat .ring.broadcasting',
        '.s-stat .stuck-watch',
        '.s-stuck .recovery-card.recommended',
        '.s-stuck .progress-state.done-cancelled .ring',
        '.s9-fail-hero .ring',
        '.s9-reason-banner',
        '.s9-payload-card .row',
        '.s9-toast-cancelled',
      ]),
    );
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/sendStyles.test.tsx
```
Expected (dry run): FAIL — Test Files 1 failed (1) · Tests 1 failed | 1 passed (2) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Regenerate `design-ext.css` — never by hand.**

Take plan 1's one-off extraction script (`docs/superpowers/plans/2026-09-29-extension-b1b2a-plan1.md`, Task 10 Step 3: the `js` block that starts `// One-off: copy the design classes`), with plan 2's prefixes added (`docs/superpowers/plans/2026-10-01-extension-b1b2a-plan2.md`, Task 5 Step 3). Save it **outside the repository**. First run it unchanged: it must reproduce plan 2's `ec0e160148042f4304796285a7c64dc3975c314e7a103414d75ff1850ccf5444` (a different hash means `index.html` changed: stop and ask the controller). Then extend `PREFIXES` and `KEYFRAMES` by exactly these entries:

```js
  // Plan 3 (B1b-2a-3): the send flow — #12, #19, #20, #21, #44 (and its cancelled toast), #54.
  '.s-send', '.s-sim', '.s-conf', '.s-stat', '.s-stuck', '.s9-fail-hero', '.s9-reason-banner', '.s9-payload-card', '.s9-toast-cancelled',
```

```js
const KEYFRAMES = ['shimmer', 'spin', 'shake',
  // Plan 3: what the send-flow rules animate with (#19's progress strip and skeleton, #21's ring and status dot, #54's ring; #20's caret — its rule comes with .s-conf, the typed field does not, D22).
  'm3-slide', 'shimmer-bg', 'zk-spin', 'zk-pulse', 'stk-spin', 'caret'];
```

Run it from the repository root, then check:

```bash
node /path/to/extract-design-css.mjs
sha256sum extension/src/styles/design-ext.css; wc -l extension/src/styles/design-ext.css
git diff --stat extension/src/styles/design-ext.css
```
Expected: `df829f1cadacc9f4fe51d4019acde4dd91066edca852277e92ecdd3a87063411`, `1670`, and `630 insertions(+)` with **no deletion** — plan 1's and plan 2's rules are unchanged; only the new prefixes' rules are added.

- [ ] **Step 4: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/sendStyles.test.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 1 passed (1) · Tests 2 passed (2); tsc clean; whole suite Test Files 103 passed (103) · Tests 1817 passed (1817).

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M5a** — `extension/src/__tests__/styled.ts`:

  ```diff
  - return el.matches(sel) || [...el.querySelectorAll('*')].some(d => d.matches(sel));
  + return true;
  ```
  `npx vitest run src/app/__tests__/sendStyles.test.tsx` — Expected: **red** (1 failed | 1 passed (2)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/app/__tests__/sendStyles.test.tsx extension/src/styles/design-ext.css
git commit -F - <<'MSG'
feat(extension): the send flow's design classes, regenerated from index.html; a StatusPill outside #27 is caught (carry 4)

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 6: The send rules: drafts, exact amounts, MAX that never leaves dust, predicted re-authentication, fee rows

**Files:**
- Create: `extension/src/app/__tests__/sendRules.test.ts`
- Create: `extension/src/app/send/rules.ts`

**Interfaces:**
- Consumes: `core/` formatting (`formatAmount`, `parseTokenAmount`, `TOKEN_INFO`), `background/reauthPolicy.ts` (`sendReauthReasons` — the same function the engine uses), `PreparedView.fees`.
- Produces: `src/app/send/rules.ts`: `Draft`, `isAddressText`, `isDraft`, `isIntent`, `sameIntent`, `plainAmount`, `draftOf`, `showExact`, `showLamports`, `maxSendable`, `unitPrice`, `predictReasons`, `percentOf`, `usdOf`, `FEE_REASON_TEXT`, `feeRows`, `sentBeforeText`.

Pure functions, so every screen and test agrees on one definition:
- **MAX (carry 2, max-send half):** for SOL, `balance − worst fee − 890 880` (worst fee = 5 000 base + the priority ceiling at 1 000 CU + the markup ceiling = 45 000 lamports), floored at 0 — the account keeps at least the rent-exempt minimum, never a 1..890 879 remainder; a token sends its whole balance. A property test over 5 000 balances checks the remainder is never in the dust band.
- **`predictReasons`** calls `sendReauthReasons`, the engine's own rule, so #12's "Review & unlock to send" is a prediction of the same decision (the engine still decides; a parity test pins it).
- **`feeRows`** is §4.5's one definition of the fee rows for #19 and #20 (and #10 mirrors it).
- **`sentBeforeText`** gives E6's hint: "Verified · sent before · last N days ago"; "· today" and "· yesterday" are **controller additions — awaiting the owner** (the design gives only "last 12 days ago"; the review rejected "last 1 day ago").

- [ ] **Step 1: Write the failing test.**

Create `extension/src/app/__tests__/sendRules.test.ts`:

```ts
import {parseAmount} from '../../shared/amount';
import {sendReauthReasons, usdMicros} from '../../background/reauthPolicy';
import {
  BASE_FEE_LAMPORTS,
  FEE_REASON_TEXT,
  MARKUP_CEILING_LAMPORTS,
  PRIORITY_CEILING_MICRO_LAMPORTS,
  RENT_EXEMPT_LAMPORTS,
  SOL_SEND_COMPUTE_UNITS,
  WORST_SOL_FEE_LAMPORTS,
  draftOf,
  feeRows,
  isAddressText,
  isDraft,
  isIntent,
  maxSendable,
  percentOf,
  plainAmount,
  predictReasons,
  sentBeforeText,
  showExact,
  showLamports,
} from '../send/rules';
import {CEILING} from '../../../../core/solana/priorityFee';
import {BASE_FEE_LAMPORTS_PER_SIGNATURE, SYSTEM_ACCOUNT_RENT_LAMPORTS, computeUnitLimitFor, networkFeeLamports} from '../../../../core/solana/transfer';
import {TRANSFER_MARKUP_LAMPORTS} from '../../../../core/fees/transferMarkup';
import {RECIPIENT} from '../../background/__tests__/fixtures';

// Spec §4.2–§4.5: the send flow's arithmetic and text, pure.
describe('the send flow’s rules', () => {
  it('a recipient is base58, 32–44 characters, and 32 bytes decoded', () => {
    expect(isAddressText(RECIPIENT)).toBe(true);
    expect(isAddressText('11111111111111111111111111111111')).toBe(true);
    for (const bad of ['', `0${RECIPIENT.slice(1)}`, RECIPIENT.slice(0, 31), `${RECIPIENT} `, `${RECIPIENT}x`, 'marko.sol', '1'.repeat(45), 'zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz']) {
      expect(`${bad}: ${isAddressText(bad)}`).toBe(`${bad}: false`);
    }
  });

  it('a route draft is the user’s own text, bounded; an intent is a known token, an address and a positive u64', () => {
    expect(isDraft({token: 'SOL', recipient: 'abc', amount: '1.'})).toBe(true);
    expect(isDraft({token: 'BONK', recipient: '', amount: ''})).toBe(false);
    expect(isDraft({token: 'SOL', recipient: 'x'.repeat(65), amount: ''})).toBe(false);
    expect(isIntent({token: 'NOC', recipient: RECIPIENT, amount: 1n})).toBe(true);
    for (const bad of [{token: 'NOC', recipient: RECIPIENT, amount: 0n}, {token: 'NOC', recipient: RECIPIENT, amount: 1}, {token: 'NOC', recipient: 'nope', amount: 1n}, {token: 'NOC', recipient: RECIPIENT, amount: 2n ** 64n}]) {
      expect(isIntent(bad)).toBe(false);
    }
  });

  it('amounts as the field takes them back, exact for confirmations, fees ungrouped', () => {
    expect(plainAmount(61_546_220_000n, 9)).toBe('61.54622');
    expect(plainAmount(1_234_567_000_000_000n, 9)).toBe('1234567');
    expect(parseAmount(plainAmount(12_345_678_901n, 9), 9)).toBe(12_345_678_901n);
    expect(draftOf({token: 'USDC', recipient: RECIPIENT, amount: 12_500_000n})).toEqual({token: 'USDC', recipient: RECIPIENT, amount: '12.5'});
    expect(showExact('SOL', 2_480_000_000n)).toBe('2.4800');
    expect(showExact('SOL', 2_480_000_001n)).toBe('2.480000001');
    expect(showExact('USDC', 12_000_000n)).toBe('12.00');
    expect(showLamports(5_000n)).toBe('0.000005');
    expect(showLamports(120_000n)).toBe('0.00012');
  });

  it('MAX’s constants are core’s: base fee, compute units, the normal priority ceiling, the Noctura fee, the rent minimum', () => {
    expect(BASE_FEE_LAMPORTS).toBe(BASE_FEE_LAMPORTS_PER_SIGNATURE);
    expect(SOL_SEND_COMPUTE_UNITS).toBe(BigInt(computeUnitLimitFor({kind: 'sol'})));
    expect(PRIORITY_CEILING_MICRO_LAMPORTS).toBe(BigInt(CEILING.normal));
    expect(MARKUP_CEILING_LAMPORTS).toBe(TRANSFER_MARKUP_LAMPORTS);
    expect(RENT_EXEMPT_LAMPORTS).toBe(SYSTEM_ACCOUNT_RENT_LAMPORTS);
    expect(WORST_SOL_FEE_LAMPORTS).toBe(networkFeeLamports(1, CEILING.normal, computeUnitLimitFor({kind: 'sol'})) + TRANSFER_MARKUP_LAMPORTS);
  });

  it('MAX: an SPL token’s whole balance; SOL less the worst fee and the rent minimum, never below 0', () => {
    expect(maxSendable('NOC', 4_200_000_000_000n)).toBe(4_200_000_000_000n);
    expect(maxSendable('SOL', 62_482_100_000n)).toBe(62_482_100_000n - 45_000n - 890_880n);
    expect(maxSendable('SOL', 935_880n)).toBe(0n);
    expect(maxSendable('SOL', 100n)).toBe(0n);
  });

  // Spec §8.4 / §11.5: MAX never produces a sender-below-rent amount — a property over balances and every fee the
  // engine can charge (any priority up to the ceiling, the Noctura fee charged or not).
  it('MAX never leaves 1 … 890 879 lamports, whatever the real fee (property, 5 000 cases)', () => {
    let seed = 7;
    const next = (n: number) => ((seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648) % n);
    for (let i = 0; i < 5_000; i++) {
      const balance = BigInt(next(2_000_000_000)) * BigInt(1 + next(1_000));
      const max = maxSendable('SOL', balance);
      if (max === 0n) continue;
      const price = next(Number(PRIORITY_CEILING_MICRO_LAMPORTS) + 1);
      const fee = networkFeeLamports(1, price, 1_000) + (next(2) === 0 ? 0n : TRANSFER_MARKUP_LAMPORTS);
      const remainder = balance - max - fee;
      expect(remainder >= RENT_EXEMPT_LAMPORTS).toBe(true);
    }
  });

  it('the re-authentication hint is the engine’s own function, failing closed on what #12 does not know', () => {
    const prices = {sol: 150, usdc: 1, usdt: 1, noc: 0.15, at: 0};
    const base = {known: true, token: 'SOL' as const, balance: 10_000_000_000n, prices, thresholdCents: 10_000};
    expect(predictReasons({...base, amount: 10_000_000n})).toEqual([]);
    expect(predictReasons({...base, known: false, amount: 10_000_000n})).toEqual(['first-send']);
    expect(predictReasons({...base, amount: 600_000_000n})).toEqual(['over-5-percent']);
    expect(predictReasons({...base, amount: 700_000_000n})).toEqual(['over-5-percent', 'over-usd-threshold']);
    // Unknown price, threshold or balance: above the rule, as the engine.
    expect(predictReasons({...base, prices: null, amount: 1n})).toEqual(['over-usd-threshold']);
    expect(predictReasons({...base, thresholdCents: null, amount: 1n})).toEqual(['over-usd-threshold']);
    expect(predictReasons({...base, balance: null, amount: 1n})).toEqual(['over-5-percent']);
    // NOC is valued at the stage price.
    expect(predictReasons({...base, token: 'NOC', balance: 1_000_000_000_000n, amount: 700_000_000_000n})).toContain('over-usd-threshold');
    // Parity: the same inputs through the engine's function directly.
    for (const amount of [1n, 499_999_999n, 500_000_001n, 9_900_000_000n]) {
      expect(predictReasons({...base, known: false, amount})).toEqual(sendReauthReasons({knownRecipient: false, amount, balance: base.balance, usdMicros: usdMicros(amount, 9, 150), thresholdCents: 10_000}));
    }
  });

  it('percent of balance, truncated; none for an empty or unknown balance', () => {
    expect(percentOf(12_000_000_000n, 62_482_100_000n)).toBe(19);
    expect(percentOf(1n, 0n)).toBeNull();
    expect(percentOf(1n, null)).toBeNull();
  });

  it('the fee rows, defined once: base fee, priority, new token account when non-zero, Noctura fee or its reason', () => {
    expect(feeRows({networkLamports: 125_000n, priorityLamports: 120_000n, rentLamports: 0n, markupLamports: 0n, markupReason: 'status-unknown'})).toEqual([
      {label: 'Network fee', lamports: 5_000n},
      {label: 'Priority', lamports: 120_000n},
      {label: 'No Noctura fee (status unknown)', lamports: null},
    ]);
    expect(feeRows({networkLamports: 70_000n, priorityLamports: 65_000n, rentLamports: 2_039_280n, markupLamports: 20_000n, markupReason: 'charged'})).toEqual([
      {label: 'Network fee', lamports: 5_000n},
      {label: 'Priority', lamports: 65_000n},
      {label: 'New token account', lamports: 2_039_280n},
      {label: 'Noctura fee', lamports: 20_000n},
    ]);
    expect(Object.values(FEE_REASON_TEXT)).toEqual(['No Noctura fee before TGE', 'No Noctura fee (zero-fee eligible)', 'No Noctura fee (status unknown)']);
  });

  it('"Verified · sent before" with the local calendar days since, or without a date', () => {
    const now = new Date(2026, 9, 2, 9, 41).getTime();
    expect(sentBeforeText(null, now)).toBe('Verified · sent before');
    expect(sentBeforeText(new Date(2026, 9, 2, 0, 5).getTime(), now)).toBe('Verified · sent before · today');
    expect(sentBeforeText(new Date(2026, 9, 1, 23, 59).getTime(), now)).toBe('Verified · sent before · yesterday');
    expect(sentBeforeText(new Date(2026, 8, 20, 12, 0).getTime(), now)).toBe('Verified · sent before · last 12 days ago');
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/sendRules.test.ts
```
Expected (dry run): FAIL — Test Files 1 failed (1) · Tests no tests (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Create `extension/src/app/send/rules.ts`:

```ts
import {base58} from '@scure/base';
import {formatAmount} from '../../shared/amount';
import {sendReauthReasons, usdMicros, type SendReauthReason} from '../../background/reauthPolicy';
import {TOKEN_INFO} from '../format';
import type {FeeReason, Intent, Prepared, Prices, Token} from '../engine';

/**
 * The send flow's rules that are pure arithmetic or text (spec §4.2–§4.5), in one place so #12, #19, #20 and
 * #21 cannot disagree. Amounts are base units, bigint (cardinal rule 2); nothing here reads the network.
 */

/** What #12 holds while the user types: the field texts as typed, so a return from #19 restores them exactly. */
export interface Draft {
  token: Token;
  recipient: string;
  amount: string;
}

const TOKENS: readonly string[] = ['SOL', 'NOC', 'USDC', 'USDT'];
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** #12's recipient check (spec §4.2): the base58 alphabet, 32–44 characters, and exactly 32 bytes once decoded. */
export function isAddressText(text: string): boolean {
  if (!BASE58.test(text)) return false;
  try {
    return base58.decode(text).length === 32;
  } catch {
    return false;
  }
}

/** A route's draft is the user's own text: a known token and two strings of a sane length — never trusted further. */
export function isDraft(x: unknown): x is Draft {
  if (typeof x !== 'object' || x === null) return false;
  const d = x as Record<string, unknown>;
  return typeof d.token === 'string' && TOKENS.includes(d.token) && typeof d.recipient === 'string' && d.recipient.length <= 64 && typeof d.amount === 'string' && d.amount.length <= 40;
}

/** An intent a route may carry to #19: a known token, an address, a positive amount of at most u64. */
export function isIntent(x: unknown): x is Intent {
  if (typeof x !== 'object' || x === null) return false;
  const i = x as Record<string, unknown>;
  return typeof i.token === 'string' && TOKENS.includes(i.token) && typeof i.recipient === 'string' && isAddressText(i.recipient) && typeof i.amount === 'bigint' && i.amount > 0n && i.amount <= 18_446_744_073_709_551_615n;
}

export const sameIntent = (a: Intent, b: Intent): boolean => a.token === b.token && a.recipient === b.recipient && a.amount === b.amount;

/** Base units as the plain text the amount field takes back ("61.54622"): every digit, no grouping, no trailing zeros. */
export const plainAmount = (base: bigint, decimals: number): string => formatAmount(base, decimals, {min: 0, max: decimals}).replace(/,/g, '');

/** An intent back as #12's draft (#20's loop guard, #44's [Edit transaction], a fresh #19 with #12 under it). */
export const draftOf = (i: Intent): Draft => ({token: i.token, recipient: i.recipient, amount: plainAmount(i.amount, TOKEN_INFO[i.token].decimals)});

/** A confirmation never rounds (spec §3.10, §4.5): every base unit shown, at least the design's places ("2.4800 SOL", "12.00 USDC"). */
export function showExact(token: Token, base: bigint): string {
  const {decimals} = TOKEN_INFO[token];
  return formatAmount(base, decimals, {min: token === 'SOL' || token === 'NOC' ? 4 : 2, max: decimals});
}

/** A fee in SOL, exact and ungrouped, as the #19 and #20 mockups draw it ("0.000005", "0.00012"). */
export const showLamports = (lamports: bigint): string => formatAmount(lamports, 9, {min: 0, max: 9});

// ── MAX (spec §4.2) ───────────────────────────────────────────────────────────────────────────────
// The worst case the engine can charge a SOL send, from core's own constants (a test proves each equals
// core's): 5 000 per signature, the normal tier's priority ceiling over the SOL send's compute-unit limit, and
// the Noctura fee were it charged. The UI does not import core/solana/transfer.ts or priorityFee.ts: the first
// pulls @solana/web3.js into the popup, the second the whole RPC client.
export const BASE_FEE_LAMPORTS = 5_000n;
export const SOL_SEND_COMPUTE_UNITS = 1_000n;
export const PRIORITY_CEILING_MICRO_LAMPORTS = 20_000_000n;
export const MARKUP_CEILING_LAMPORTS = 20_000n;
/** The rent-exempt minimum of a 0-data account: a SOL balance is 0 or at least this (spec §11.5). */
export const RENT_EXEMPT_LAMPORTS = 890_880n;
export const WORST_SOL_FEE_LAMPORTS = BASE_FEE_LAMPORTS + (PRIORITY_CEILING_MICRO_LAMPORTS * SOL_SEND_COMPUTE_UNITS + 999_999n) / 1_000_000n + MARKUP_CEILING_LAMPORTS;

/**
 * MAX (spec §4.2, §11.5): an SPL token's whole balance; for SOL, the balance less the worst-case fee and less
 * the rent-exempt minimum, floored at 0. The remainder after the real fee is then never 1 … 890 879 lamports, so
 * the engine's sender-below-rent rule (and the runtime's InsufficientFundsForRent) can never refuse a MAX send.
 */
export function maxSendable(token: Token, balance: bigint): bigint {
  if (token !== 'SOL') return balance;
  const max = balance - WORST_SOL_FEE_LAMPORTS - RENT_EXEMPT_LAMPORTS;
  return max > 0n ? max : 0n;
}

// ── Re-authentication, predicted (spec §4.2) ─────────────────────────────────────────────────────

/** USD per whole token, as the engine values it for the dollar rule: NOC at the stage price. */
export function unitPrice(token: Token, prices: Prices | null): number | undefined {
  if (prices === null) return undefined;
  const p = token === 'SOL' ? prices.sol : token === 'NOC' ? prices.noc : token === 'USDC' ? prices.usdc : prices.usdt;
  return p ?? undefined;
}

/**
 * #12's hint of which re-authentication triggers this send will meet — the engine's own function
 * (background/reauthPolicy.ts), fed what #12 knows. It fails closed as the engine does: an unknown balance is
 * 0, an unknown price or threshold is above the dollar rule. #19 and #20 show the engine's reasons, which decide.
 */
export function predictReasons(i: {known: boolean; token: Token; amount: bigint; balance: bigint | null; prices: Prices | null; thresholdCents: number | null}): SendReauthReason[] {
  const usd = i.thresholdCents === null ? null : usdMicros(i.amount, TOKEN_INFO[i.token].decimals, unitPrice(i.token, i.prices));
  return sendReauthReasons({knownRecipient: i.known, amount: i.amount, balance: i.balance ?? 0n, usdMicros: usd, thresholdCents: i.thresholdCents ?? 0});
}

/** The amount as a share of the balance, whole percent, truncated; null for an empty or unknown balance. */
export function percentOf(amount: bigint, balance: bigint | null): number | null {
  if (balance === null || balance <= 0n) return null;
  return Number((amount * 100n) / balance);
}

/** A token amount's value in USD for display only (never a decision); null without a price. */
export function usdOf(token: Token, amount: bigint, prices: Prices | null): number | null {
  const p = unitPrice(token, prices);
  if (p === undefined) return null;
  return (Number(amount) / 10 ** TOKEN_INFO[token].decimals) * p;
}

// ── Fee rows (spec §4.5, defined once for #19, #20 and #10) ────────────────────────────────────────

/** The carried rule: a zero Noctura fee always says why. */
export const FEE_REASON_TEXT: Record<Exclude<FeeReason, 'charged'>, string> = {
  'pre-tge': 'No Noctura fee before TGE',
  'zero-fee-eligible': 'No Noctura fee (zero-fee eligible)',
  'status-unknown': 'No Noctura fee (status unknown)',
};

export interface FeeRow {
  label: string;
  /** Lamports; null for the reason line of a zero Noctura fee. */
  lamports: bigint | null;
}

/**
 * "Network fee" = network − priority (the base fee), "Priority", "New token account" when non-zero, then
 * "Noctura fee" when non-zero or its reason line. Their lamports and the amount (for SOL) sum to
 * solRequiredLamports — the engine's own total.
 */
export function feeRows(fees: Prepared['fees']): FeeRow[] {
  const rows: FeeRow[] = [
    {label: 'Network fee', lamports: fees.networkLamports - fees.priorityLamports},
    {label: 'Priority', lamports: fees.priorityLamports},
  ];
  if (fees.rentLamports > 0n) rows.push({label: 'New token account', lamports: fees.rentLamports});
  if (fees.markupLamports > 0n) rows.push({label: 'Noctura fee', lamports: fees.markupLamports});
  else if (fees.markupReason !== 'charged') rows.push({label: FEE_REASON_TEXT[fees.markupReason], lamports: null});
  return rows;
}

// ── #12's recipient hint ─────────────────────────────────────────────────────────────────────────

const dayStart = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/**
 * "Verified · sent before · last 12 days ago" (#12 design state 3; local calendar days, cardinal rule 3), or
 * "Verified · sent before" with no date. "· today" and "· yesterday" — controller addition — awaiting the owner
 * (plan 3; the review rejected "last 1 day ago"): the design gives only the plural form.
 */
export function sentBeforeText(lastSentAt: number | null, now: number): string {
  if (lastSentAt === null) return 'Verified · sent before';
  const days = Math.max(0, Math.round((dayStart(now) - dayStart(lastSentAt)) / 86_400_000));
  if (days === 0) return 'Verified · sent before · today';
  if (days === 1) return 'Verified · sent before · yesterday';
  return `Verified · sent before · last ${days} days ago`;
}
```

- [ ] **Step 4: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/sendRules.test.ts
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 1 passed (1) · Tests 10 passed (10); tsc clean; whole suite Test Files 104 passed (104) · Tests 1827 passed (1827).

- [ ] **Step 5: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M6a** — `extension/src/app/send/rules.ts`:

  ```diff
  - const max = balance - WORST_SOL_FEE_LAMPORTS - RENT_EXEMPT_LAMPORTS;
  + const max = balance - WORST_SOL_FEE_LAMPORTS;
  ```
  `npx vitest run src/app/__tests__/sendRules.test.ts` — Expected: **red** (2 failed | 8 passed (10)).

- **M6b** — `extension/src/app/send/rules.ts`:

  ```diff
  -   if (days === 0) return 'Verified · sent before · today';
  + (deleted)
  ```
  `npx vitest run src/app/__tests__/sendRules.test.ts` — Expected: **red** (1 failed | 9 passed (10)).

- **M6c** — `extension/src/app/send/rules.ts`:

  ```diff
  -   if (days === 1) return 'Verified · sent before · yesterday';
  + (deleted)
  ```
  `npx vitest run src/app/__tests__/sendRules.test.ts` — Expected: **red** (1 failed | 9 passed (10)).

- [ ] **Step 6: Commit.**

```bash
git add extension/src/app/__tests__/sendRules.test.ts extension/src/app/send/rules.ts
git commit -F - <<'MSG'
feat(extension): the send rules — exact amounts, MAX that keeps the rent minimum, the engine's own re-auth rule predicted

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 7: #12 send with E6's hints, and #43 opened from its token chip

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Create: `extension/src/app/__tests__/Send.test.tsx`
- Modify: `extension/src/app/__tests__/TokenSheet.test.tsx`
- Modify: `extension/src/app/app.css`
- Create: `extension/src/app/screens/Send.tsx`
- Modify: `extension/src/app/screens/TokenSheet.tsx`
- Modify: `extension/src/app/ui/ExtIcon.tsx`
- Create: `extension/src/app/ui/useEscape.ts`

**Interfaces:**
- Consumes: Task 6; `wallet.recipientInfo` (E6), `TokenSheet` (#43, plan 1), `useWallet` (balances, prices, net mode, pending).
- Produces: `src/app/screens/Send.tsx` (`Send`, `SEND_TEXT`); `src/app/ui/useEscape.ts`; ExtIcon `clip`, `alert`; `TokenSheet`'s `balances: Balances | null`.

Spec §4.2 and index.html #s12 (states 1–7), #s43. Every state: idle; invalid recipient; insufficient ("short by" the exact BigInt difference); SPL with less SOL than the base fee; sent-before (E6); own account / fee treasury labels and the sending account refused; first-time recipient (design state 6: banner, groups of four, "Never sent here before", the re-auth amount line, "Review & unlock to send"); over 5 %; pending (banner + [View it]); stale balances; refused (D26); MAX; #43 from the chip. The CTA hands #19 the draft and the intent in base units through a `LockedButton` (rule 6). E6's reply is generation-checked (a reply for an address the field no longer holds is dropped). Paste reads the clipboard only when the browser allows; otherwise "Paste with Ctrl+V (⌘V on a Mac)." — **controller addition — awaiting the owner**. The CTA carries the amount as typed (design state 4) but never "Send 1. SOL" mid-typing (review L6). No autofocus.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Send.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {renderInWallet, setupWallet, walletReader, type WalletOptions} from './harness';
import {createEngine} from '../engine';
import {WalletProvider} from '../WalletContext';
import {SEND_TEXT, Send} from '../screens/Send';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {REFUSED_TEXT} from '../ui/Banner';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
import {PENDING_KEY} from '../../background/pendingStore';
import {RpcForbidden} from '../../../../core/solana/rpc';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {COUNTERPARTY} from '../../../e2e/historyFixtures';
import type {Draft} from '../send/rules';

// Spec §4.2 (#12) and §4.3 (#43, opened from it). The harness wallet: Main (ACCOUNT) sending, Savings
// (RECIPIENT) its own second account; 62.4821 SOL, 4 200 NOC, 740.21 USDC; SOL $150.
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onBack: vi.fn(), onReview: vi.fn(), onViewPending: vi.fn()};
const DAY = 86_400_000;

function renderSend(o: WalletOptions & {draft?: Draft | null; notice?: 'start-again' | null} = {}) {
  return renderInWallet(<Send draft={o.draft ?? null} notice={o.notice ?? null} {...nav} />, o);
}
const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const type = (name: string, value: string) => fireEvent.change(field(name), {target: {value}});
const cta = () => document.querySelector('.sticky-bar button') as HTMLButtonElement;
/** Waits for the provider's balance read: the Available line names the balance. */
const loaded = () => screen.findByText('62.4821 SOL');
const known = (address: string, at: number | null) => ({before: async (ext: Parameters<NonNullable<WalletOptions['before']>>[0]) => ext.local.set(KNOWN_RECIPIENTS_KEY, [{address, at}])});

afterEach(() => vi.clearAllMocks());

describe('#12 send', () => {
  it('idle: the title, the three eyebrows, the SOL chip, the placeholders, Available, the two fee rows, "Send SOL" disabled', async () => {
    await renderSend();
    await loaded();
    expect(screen.getByText('Send', {selector: '.title'})).toBeTruthy();
    expect([...document.querySelectorAll('.row .lbl')].map(l => l.textContent)).toEqual(['Token', 'Recipient', 'Amount']);
    expect(screen.getByRole('button', {name: 'Token: SOL'})).toBeTruthy();
    expect(field('Recipient').placeholder).toBe('Solana address');
    expect(field('Amount').placeholder).toBe('0.000000');
    expect(document.querySelector('.available')?.textContent).toBe('Available 62.4821 SOL');
    const fees = [...document.querySelectorAll('.fee-row .line')].map(l => [l.querySelector('.l')?.textContent, l.querySelector('.r')?.textContent]);
    expect(fees).toEqual([
      ['Network fee', '~0.000005 SOL'],
      ['Priority', 'Set automatically — shown on the next step'],
    ]);
    expect(cta().textContent).toBe('Send SOL');
    expect(cta().disabled).toBe(true);
    // Removed by decision: priority chips (D15), .sol (D16), scan (D13), the address book (B1b-2b), shielded (D4).
    for (const gone of [/\.sol/, /Normal|Fast|Instant/, /Scan|Address book|shielded|private/i]) expect(document.body.textContent).not.toMatch(gone);
    expect(screen.queryByRole('button', {name: /Scan|Address book/})).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-send')!, SELECTORS)).toEqual([]);
  });

  it('invalid recipient: the danger line, the fee "—", the rows behind it dimmed, the CTA disabled', async () => {
    await renderSend();
    await loaded();
    type('Recipient', '7xKXtgZASfW87dQQQbadinput123');
    expect(screen.getByRole('alert').textContent).toBe(` ${SEND_TEXT.invalid}`);
    expect(document.querySelector('.recipient-row')?.classList.contains('app-row-error')).toBe(true);
    expect(document.querySelector('.recipient-row .input')?.classList.contains('invalid')).toBe(true);
    expect(document.querySelector('.fee-row .line .r')?.textContent).toBe('—');
    expect(document.querySelector('.amount-row')?.classList.contains('app-row-dim')).toBe(true);
    expect(cta().disabled).toBe(true);
    expect(unstyledClasses(document.querySelector('.s-send')!, SELECTORS)).toEqual([]);
  });

  it('insufficient balance: "short by" the exact BigInt difference, the CTA disabled', async () => {
    await renderSend(known(COUNTERPARTY, null));
    await loaded();
    type('Recipient', COUNTERPARTY);
    type('Amount', '75');
    expect(await screen.findByText(/^Insufficient balance — short by/)).toBeTruthy();
    expect(document.querySelector('.amount-row .helper.error')?.textContent).toBe(' Insufficient balance — short by 12.5179 SOL');
    expect(document.querySelector('.amount-row')?.classList.contains('app-row-error')).toBe(true);
    expect(cta().textContent).toBe('Send 75 SOL');
    expect(cta().disabled).toBe(true);
  });

  it('SPL with less SOL than the base fee: "Not enough SOL for the network fee."', async () => {
    await renderSend({...known(COUNTERPARTY, null), reader: walletReader({getBalance: async () => 4_999n})});
    await waitFor(() => expect(document.querySelector('.available')?.textContent).toBe('Available 0.0000 SOL'));
    fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
    fireEvent.click(within(screen.getByRole('dialog', {name: 'Choose a token'})).getByText('USD Coin'));
    type('Recipient', COUNTERPARTY);
    type('Amount', '1');
    expect(await screen.findByText(SEND_TEXT.feeWarning, {exact: false})).toBeTruthy();
    expect(cta().disabled).toBe(true);
  });

  it('sent before (E6): "Verified · sent before · last 12 days ago"; with no date, "Verified · sent before"', async () => {
    await renderSend(known(COUNTERPARTY, Date.now() - 12 * DAY));
    await loaded();
    type('Recipient', COUNTERPARTY);
    expect((await screen.findByText(/Verified · sent before/)).textContent?.trim()).toBe('Verified · sent before · last 12 days ago');
    expect(screen.queryByText(SEND_TEXT.firstTitle)).toBeNull();
    type('Amount', '0.01');
    await waitFor(() => expect(cta().disabled).toBe(false));
    expect(cta().textContent).toBe('Send 0.01 SOL');
  });

  it('an own account reads its label, the fee treasury "Noctura treasury"; the sending account itself is refused', async () => {
    await renderSend(known(MAINNET_FEE_TREASURY, null));
    await loaded();
    type('Recipient', RECIPIENT);
    expect(await screen.findByText('Your account: Savings')).toBeTruthy();
    type('Recipient', MAINNET_FEE_TREASURY);
    expect(await screen.findByText('Noctura treasury')).toBeTruthy();
    type('Recipient', ACCOUNT.publicKey);
    expect(await screen.findByText(SEND_TEXT.self, {exact: false})).toBeTruthy();
    type('Amount', '0.01');
    expect(cta().disabled).toBe(true);
  });

  it('first-time recipient (design state 6): the banner, the address in groups of four, "Never sent here before", the re-auth amount line and CTA', async () => {
    await renderSend();
    await loaded();
    type('Recipient', COUNTERPARTY);
    type('Amount', '12');
    expect(await screen.findByText(SEND_TEXT.firstTitle)).toBeTruthy();
    expect(screen.getByText(SEND_TEXT.firstLine)).toBeTruthy();
    expect(screen.getByText(SEND_TEXT.neverSent, {exact: false})).toBeTruthy();
    const groups = [...document.querySelectorAll('.app-send-addr .addr-groups > span')].map(s => s.textContent);
    expect(groups).toEqual(COUNTERPARTY.match(/.{1,4}/g));
    // 12 SOL × $150 = $1,800.00; 12 of 62.4821 SOL = 19 %.
    expect(document.querySelector('.available')?.textContent).toBe('≈ $1,800.00 · 19% of balance — re-auth required');
    expect(cta().textContent).toBe(`\u00a0${SEND_TEXT.reviewUnlock}`);
    expect(cta().disabled).toBe(false);
    expect(unstyledClasses(document.querySelector('.s-send')!, SELECTORS)).toEqual([]);
  });

  it('a known recipient but over 5 % of the balance: the same re-auth line and CTA (the 5 % rule, predicted)', async () => {
    await renderSend(known(COUNTERPARTY, null));
    await loaded();
    type('Recipient', COUNTERPARTY);
    type('Amount', '4');
    await screen.findByText(/Verified · sent before/);
    expect(document.querySelector('.available')?.textContent).toBe('≈ $600.00 · 6% of balance — re-auth required');
    expect(cta().textContent).toBe(`\u00a0${SEND_TEXT.reviewUnlock}`);
  });

  it('pending: an open send of this account → the banner, [View it] opens it, the CTA disabled', async () => {
    const record = pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
    await renderSend({
      before: async ext => {
        await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: COUNTERPARTY, at: null}]);
        await ext.local.set(PENDING_KEY, [record]);
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: 'View it'}));
    expect(screen.getByText(SEND_TEXT.pending)).toBeTruthy();
    expect(nav.onViewPending).toHaveBeenCalledWith(expect.objectContaining({id: 'p1'}));
    type('Recipient', COUNTERPARTY);
    type('Amount', '0.01');
    await screen.findByText(/Verified · sent before/);
    expect(cta().disabled).toBe(true);
  });

  it('stale: balances from the cache → "Available … · last synced N ago" in --warning', async () => {
    const at = Date.now() - 120_000;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const reader = walletReader({
      getBalance: async () => {
        await held;
        return 62_482_100_000n;
      },
    });
    await renderSend({reader, before: async ext => ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: {sol: '62482100000', noc: '0', usdc: '0', usdt: '0', at}})});
    const line = await screen.findByText(/last synced/, {selector: '.available'});
    expect(line.textContent).toBe('Available 62.4821 SOL · last synced 2 min ago');
    expect(line.classList.contains('app-warning')).toBe(true);
    await act(async () => release());
  });

  it('MAX: SOL keeps the worst fee and the rent minimum and says so; a token sends its whole balance', async () => {
    await renderSend();
    await loaded();
    fireEvent.click(screen.getByRole('button', {name: 'MAX'}));
    // 62.4821 SOL − (5 000 + 20 000 + 20 000) − 890 880 lamports.
    expect(field('Amount').value).toBe('62.48116412');
    expect(screen.getByText(SEND_TEXT.maxHelper)).toBeTruthy();
    type('Amount', '1');
    expect(screen.queryByText(SEND_TEXT.maxHelper)).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
    fireEvent.click(within(screen.getByRole('dialog', {name: 'Choose a token'})).getByText('Noctura'));
    fireEvent.click(screen.getByRole('button', {name: 'MAX'}));
    expect(field('Amount').value).toBe('4200');
    expect(screen.queryByText(SEND_TEXT.maxHelper)).toBeNull();
  });

  it('#43 from the chip: "Choose a token", four rows with balances and NOC "at stage price"; Esc closes only the sheet', async () => {
    await renderSend();
    await loaded();
    fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
    const sheet = screen.getByRole('dialog', {name: 'Choose a token'});
    expect([...sheet.querySelectorAll('.pri')].map(p => p.textContent)).toEqual(['SOL', 'NOC', 'USDC', 'USDT']);
    // 4 200 NOC × $0.1501 (the stage price), outside the market total.
    expect(within(sheet).getByText('$630.42 at stage price')).toBeTruthy();
    expect(sheet.querySelector('.sel .pri')?.textContent).toBe('SOL');
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(nav.onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: 'Token: SOL'}));
    fireEvent.click(within(screen.getByRole('dialog', {name: 'Choose a token'})).getByText('USD Coin'));
    expect(screen.getByRole('button', {name: 'Token: USDC'})).toBeTruthy();
    expect(document.querySelector('.available')?.textContent).toBe('Available 740.21 USDC');
  });

  it('the CTA hands #19 the draft and the intent in base units — once per tap (rule 6, the lock held with `disabled` lifted)', async () => {
    await renderSend(known(COUNTERPARTY, null));
    await loaded();
    type('Recipient', ` ${COUNTERPARTY} `);
    type('Amount', '0.01');
    await waitFor(() => expect(cta().disabled).toBe(false));
    fireEvent.click(cta());
    cta().disabled = false;
    fireEvent.click(cta());
    expect(nav.onReview).toHaveBeenCalledTimes(1);
    expect(nav.onReview).toHaveBeenCalledWith({token: 'SOL', recipient: COUNTERPARTY, amount: '0.01'}, {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n});
  });

  it('mid-typing "1." the CTA reads "Send 1 SOL", never "Send 1. SOL" (review L6); "1.50" stays as typed', async () => {
    // A $1 000 threshold, so 1 SOL ($150 at the test price, under 5 % of 62.48) predicts no re-authentication.
    await renderSend({
      before: async ext => {
        await ext.local.set(KNOWN_RECIPIENTS_KEY, [{address: COUNTERPARTY, at: null}]);
        await ext.local.set('v1_settings', {autoLockMinutes: 5, reauthUsdCents: 100_000, selectedAccount: 0});
      },
    });
    await loaded();
    type('Recipient', COUNTERPARTY);
    type('Amount', '1.');
    await waitFor(() => expect(cta().textContent).toBe('Send 1 SOL'));
    type('Amount', '1.50');
    await waitFor(() => expect(cta().textContent).toBe('Send 1.50 SOL'));
  });

  it('Esc and the back arrow go back to #11', async () => {
    await renderSend();
    await loaded();
    fireEvent.keyDown(document, {key: 'Escape'});
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onBack).toHaveBeenCalledTimes(2);
  });

  it('paste fills the field; a refused clipboard says how to paste instead', async () => {
    await renderSend();
    await loaded();
    Object.defineProperty(navigator, 'clipboard', {value: {readText: async () => ` ${COUNTERPARTY}\n`}, configurable: true});
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    await waitFor(() => expect(field('Recipient').value).toBe(COUNTERPARTY));
    fireEvent.click(screen.getByRole('button', {name: 'Clear recipient'}));
    Object.defineProperty(navigator, 'clipboard', {value: {readText: async () => Promise.reject(new Error('NotAllowedError'))}, configurable: true});
    fireEvent.click(screen.getByRole('button', {name: 'Paste'}));
    expect(await screen.findByText(SEND_TEXT.pasteRefused)).toBeTruthy();
  });

  it('a recipientInfo reply for an address the field no longer holds is dropped (the generation check)', async () => {
    let releaseFirst: () => void = () => undefined;
    const held = new Promise<void>(r => (releaseFirst = r));
    const w = await setupWallet(known(COUNTERPARTY, null));
    // RECIPIENT's answer ("Your account: Savings") is held until COUNTERPARTY's has been shown.
    const engine = createEngine(async m => {
      const msg = m as {type?: string; recipient?: string};
      if (msg.type === 'wallet.recipientInfo' && msg.recipient === RECIPIENT) await held;
      return w.transport(m);
    }, async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Send draft={null} notice={null} {...nav} />
      </WalletProvider>,
    );
    await loaded();
    type('Recipient', RECIPIENT);
    type('Recipient', COUNTERPARTY);
    expect(await screen.findByText(/Verified · sent before/)).toBeTruthy();
    await act(async () => releaseFirst());
    expect(screen.queryByText('Your account: Savings')).toBeNull();
    expect(screen.getByText(/Verified · sent before/)).toBeTruthy();
  });

  it('refused (D26): the banner, and the CTA stays disabled', async () => {
    await renderSend({
      ...known(COUNTERPARTY, null),
      reader: walletReader({
        getBalance: async () => {
          throw new RpcForbidden('getBalance');
        },
      }),
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    type('Recipient', COUNTERPARTY);
    type('Amount', '0.01');
    await screen.findByText(/Verified · sent before/);
    expect(cta().disabled).toBe(true);
  });

  it('a draft from #19 is restored as typed; the start-again notice (§4.5 loop guard) shows on top', async () => {
    await renderSend({draft: {token: 'USDC', recipient: COUNTERPARTY, amount: '12.5'}, notice: 'start-again'});
    expect(await screen.findByText(SEND_TEXT.startAgain)).toBeTruthy();
    expect(field('Recipient').value).toBe(COUNTERPARTY);
    expect(field('Amount').value).toBe('12.5');
    expect(screen.getByRole('button', {name: 'Token: USDC'})).toBeTruthy();
  });
});
```

Modify `extension/src/app/__tests__/TokenSheet.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/TokenSheet.test.tsx b/extension/src/app/__tests__/TokenSheet.test.tsx
index b367c95..3b4f0c9 100644
--- a/extension/src/app/__tests__/TokenSheet.test.tsx
+++ b/extension/src/app/__tests__/TokenSheet.test.tsx
@@ -29,4 +29,13 @@ describe('#43 token selector', () => {
     expect(onClose).toHaveBeenCalledTimes(2);
     expect(onSelect).toHaveBeenCalledTimes(1);
   });
+
+  // Plan 3: #12 may open the sheet before the first balance read answers (or after it failed): never a 0.
+  it('with no balances read: every amount and value reads "—", and NOC claims no stage price', () => {
+    render(<TokenSheet balances={null} prices={prices} selected="NOC" onSelect={() => undefined} onClose={() => undefined} />);
+    const dialog = screen.getByRole('dialog', {name: 'Choose a token'});
+    expect([...dialog.querySelectorAll('.amt')].map(a => a.textContent)).toEqual(['—', '—', '—', '—']);
+    expect([...dialog.querySelectorAll('.fiat')].map(a => a.textContent)).toEqual(['—', '—', '—', '—']);
+    expect(dialog.querySelector('.sel .pri')?.textContent).toBe('NOC');
+  });
 });
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/Send.test.tsx src/app/__tests__/TokenSheet.test.tsx
```
Expected (dry run): FAIL — Test Files 2 failed (2) · Tests 1 failed | 2 passed (3) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index d469d13..f31d2df 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -540,3 +540,59 @@ a.btn {
   border: 0;
   cursor: pointer;
 }
+
+/*
+ * #12 send (plan 3): what index.html #s12 says in inline styles — the danger border and label of a row in
+ * error, the dimmed rows behind an invalid recipient, the danger amount, the warning available line, the
+ * helper glyph's alignment and colour — plus the extension's own pieces: the token chip's tile (each token's
+ * own colours, as #43 and #11 draw them), the recipient in groups of four under the field, the pending banner's
+ * button, and inputs where the mockup draws text.
+ */
+.s-send .banner {
+  margin-bottom: var(--space-3);
+}
+.s-send .row.app-row-error {
+  border: 1px solid var(--danger);
+}
+.s-send .row.app-row-error .lbl {
+  color: var(--danger);
+}
+.s-send .row.app-row-dim {
+  opacity: 0.5;
+}
+.s-send .amount-row .amount.app-danger {
+  color: var(--danger);
+}
+.s-send .amount-row .available.app-warning,
+.s-send .amount-row .available.app-warning b {
+  color: var(--warning);
+}
+.s-send .helper svg {
+  vertical-align: -2px;
+}
+.s-send .helper.ok svg {
+  color: var(--success);
+}
+.s-send .recipient-row .input {
+  min-width: 0;
+}
+.s-send input::placeholder {
+  color: var(--fg-tertiary);
+}
+.app-chip-ico {
+  width: 24px;
+  height: 24px;
+  border-radius: 50%;
+  flex: 0 0 auto;
+}
+.app-send-addr {
+  font-size: 14px;
+  line-height: 22px;
+  color: var(--fg-primary);
+}
+.app-btn-inline {
+  width: auto;
+  min-height: var(--touch-target-min);
+  padding: 0;
+  justify-content: flex-start;
+}
```

Create `extension/src/app/screens/Send.tsx`:

```tsx
import {useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {parseAmount} from '../../shared/amount';
import {TOKEN_INFO, ago, showAmount, showUsd} from '../format';
import {
  BASE_FEE_LAMPORTS,
  isAddressText,
  maxSendable,
  percentOf,
  plainAmount,
  predictReasons,
  sentBeforeText,
  showExact,
  showLamports,
  usdOf,
  type Draft,
} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import {TokenSheet} from './TokenSheet';
import type {Balances, Intent, Pending, RecipientInfo, Token} from '../engine';

/** The fixed strings #12 shows (spec §4.2); adapted ones are marked there. */
export const SEND_TEXT = {
  invalid: 'Not a valid Solana address — check length & characters',
  self: 'This is the account you are sending from.',
  neverSent: 'Never sent here before',
  firstTitle: 'First-time recipient',
  firstLine: 'Re-auth (password) required before broadcast · verify the address character-by-character below.',
  feeWarning: 'Not enough SOL for the network fee.',
  maxHelper: 'MAX keeps 0.00089 SOL so the account stays open, plus the network fee.',
  priority: 'Set automatically — shown on the next step',
  pending: 'A send from this account is still pending. Wait until it confirms or expires.',
  reviewUnlock: 'Review & unlock to send',
  /** Controller addition (plan 3; owner to confirm): a browser may refuse a page reading the clipboard. */
  /** Controller addition — awaiting the owner (plan 3): the browser refused the clipboard read. */
  pasteRefused: 'Paste with Ctrl+V (⌘V on a Mac).',
  /** §4.5's loop guard sends the user back here with it. */
  startAgain: 'Something went wrong — start the send again.',
} as const;

const EMPTY_DRAFT: Draft = {token: 'SOL', recipient: '', amount: ''};
const balanceKey = (t: Token): keyof Balances => (t === 'SOL' ? 'sol' : t === 'NOC' ? 'noc' : t === 'USDC' ? 'usdc' : 'usdt');

/**
 * #12 send (spec §4.2). Nothing is prepared here: the CTA hands the intent to #19, which prepares. The hints —
 * the recipient's (E6, local only), the predicted re-authentication, MAX — are hints; #19 and #20 show the
 * engine's own answers, which decide. Removed by decision: the priority chips (D15), `.sol` (D16), scan (D13),
 * the address book (B1b-2b) and the shielded variant (D4); the fee-loading state (the fee is known only once #19
 * prepares). Rule 6: the CTA is a LockedButton.
 */
export function Send({
  draft,
  notice,
  onBack,
  onReview,
  onViewPending,
}: {
  draft: Draft | null;
  notice: 'start-again' | null;
  onBack: () => void;
  onReview: (draft: Draft, intent: Intent) => void;
  onViewPending: (p: Pending) => void;
}) {
  const m = useWallet();
  const now = useNow(30_000, m.now);
  const start = draft ?? EMPTY_DRAFT;
  const [token, setToken] = useState<Token>(start.token);
  const [recipient, setRecipient] = useState(start.recipient);
  const [amountText, setAmountText] = useState(start.amount);
  const [sheet, setSheet] = useState(false);
  const [info, setInfo] = useState<RecipientInfo | null>(null);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [pasteRefused, setPasteRefused] = useState(false);
  const [maxText, setMaxText] = useState<string | null>(null);
  const account = m.account;
  const {engine, reload} = m;

  useEscape(onBack, !sheet);

  // The dollar threshold (settings.get, local). Until it is read, the hint fails closed (above the rule).
  useEffect(() => {
    let alive = true;
    void engine.settings().then(r => {
      if (alive && r.ok) setThreshold(r.data.reauthUsdCents);
    });
    return () => {
      alive = false;
    };
  }, [engine]);

  const address = recipient.trim();
  const valid = isAddressText(address);
  const invalid = address !== '' && !valid;
  const key = account?.publicKey ?? null;

  // E6, each time the field holds a valid address: local, no network. A reply for an address the field no longer
  // holds — or after the screen left — is dropped (the generation check).
  const generation = useRef(0);
  useEffect(() => {
    const mine = ++generation.current;
    setInfo(null);
    if (!valid || key === null) return;
    void engine.recipientInfo(key, address).then(r => {
      if (generation.current !== mine) return;
      if (r.ok) setInfo(r.data);
      else if (r.error === 'locked') void reload();
    });
  }, [valid, address, key, engine, reload]);
  useEffect(
    () => () => {
      generation.current += 1;
    },
    [],
  );

  const decimals = TOKEN_INFO[token].decimals;
  const parsed = parseAmount(amountText, decimals);
  const amount = parsed !== null && parsed > 0n ? parsed : null;
  const balance = m.balances === null ? null : m.balances[balanceKey(token)];
  const short = amount !== null && balance !== null && amount > balance ? amount - balance : null;
  const solShort = token !== 'SOL' && m.balances !== null && m.balances.sol < BASE_FEE_LAMPORTS;
  const refused = m.net.mode === 'refused';
  const open = m.pending.find(p => p.account === key && (p.state === 'pending' || p.state === 'stuck'));
  const self = info?.self === true;
  const firstTime = valid && info !== null && !info.known && !self;
  const reasons = valid && amount !== null ? predictReasons({known: info?.known ?? false, token, amount, balance, prices: m.prices, thresholdCents: threshold}) : [];
  // A send the CTA refuses anyway (short, or no SOL for the fee) predicts nothing: the design's state 4 reads
  // "Send 75.000000 SOL", disabled.
  const predicted = reasons.length > 0 && short === null && !solShort;
  const usd = amount === null ? null : usdOf(token, amount, m.prices);
  const ready = key !== null && valid && !self && amount !== null && short === null && !solShort && open === undefined && !refused;

  const max = () => {
    if (balance === null) return;
    const text = plainAmount(maxSendable(token, balance), decimals);
    setAmountText(text);
    setMaxText(text);
  };
  const paste = async () => {
    setPasteRefused(false);
    try {
      const text = await navigator.clipboard.readText();
      setRecipient(text.trim());
    } catch {
      setPasteRefused(true);
    }
  };
  const review = () => {
    if (!ready || amount === null) return;
    onReview({token, recipient: address, amount: amountText}, {token, recipient: address, amount});
  };

  let helper = null;
  if (invalid) {
    helper = (
      <div className="helper error" role="alert">
        <ExtIcon name="alert" size={12} /> {SEND_TEXT.invalid}
      </div>
    );
  } else if (pasteRefused && address === '') {
    helper = <div className="helper warn">{SEND_TEXT.pasteRefused}</div>;
  } else if (valid && info !== null) {
    if (self) {
      helper = (
        <div className="helper error" role="alert">
          <ExtIcon name="alert" size={12} /> {SEND_TEXT.self}
        </div>
      );
    } else if (!info.known) {
      helper = (
        <div className="helper warn">
          <ExtIcon name="alert" size={12} /> {SEND_TEXT.neverSent}
        </div>
      );
    } else {
      const text = info.label?.kind === 'own' ? `Your account: ${info.label.name}` : info.label?.kind === 'treasury' ? 'Noctura treasury' : sentBeforeText(info.lastSentAt, now);
      helper = (
        <div className="helper ok">
          <ExtIcon name="check" size={12} /> {text}
        </div>
      );
    }
  }

  const percent = amount === null ? null : percentOf(amount, balance);
  let available;
  if (predicted && valid && !self) {
    const parts = [usd === null ? null : `≈ ${showUsd(usd)}`, percent === null ? null : `${percent}% of balance`].filter((x): x is string => x !== null);
    available = <div className="available noc-body-sm noc-numeral app-warning">{`${parts.join(' · ')}${parts.length > 0 ? ' — re-auth' : 'Re-auth'} required`}</div>;
  } else {
    available = (
      <div className={`available noc-body-sm${m.stale && balance !== null ? ' app-warning' : ''}`}>
        Available <b className="noc-numeral">{balance === null ? '—' : `${showAmount(token, balance)} ${token}`}</b>
        {usd === null ? null : (
          <>
            {' · ≈ '}
            <span className="noc-numeral">{showUsd(usd)}</span>
          </>
        )}
        {m.stale && balance !== null && m.balancesAt !== null ? ` · last synced ${ago(m.balancesAt, now)}` : null}
      </div>
    );
  }

  const label = predicted ? (
    <>
      <ExtIcon name="lock" size={18} />
      &nbsp;{SEND_TEXT.reviewUnlock}
    </>
  ) : amount !== null ? (
    // The amount as typed (design state 4: "Send 75.000000 SOL") — but never "Send 1. SOL" mid-typing (review L6).
    `Send ${amountText.endsWith('.') ? amountText.slice(0, -1) : amountText} ${token}`
  ) : (
    `Send ${token}`
  );

  return (
    <div className="screen s-send">
      <TopBar title="Send" onBack={onBack} />
      <div className="scroll">
        {refused ? <RefusedBanner /> : null}
        {notice === 'start-again' ? <Banner tone="danger" title={SEND_TEXT.startAgain} /> : null}
        {open === undefined ? null : (
          <div className="banner info" role="status">
            <ExtIcon name="info" size={18} />
            <div>
              <div className="noc-body-sm banner-title">{SEND_TEXT.pending}</div>
              <button type="button" className="btn btn-tertiary app-btn-inline" onClick={() => onViewPending(open)}>
                View it
              </button>
            </div>
          </div>
        )}
        {firstTime ? (
          <Banner tone="warning" title={SEND_TEXT.firstTitle}>
            {SEND_TEXT.firstLine}
          </Banner>
        ) : null}
        <div className="row">
          <div className="lbl noc-overline">Token</div>
          <button type="button" className="token-chip" aria-label={`Token: ${token}`} onClick={() => setSheet(true)}>
            <span className={`app-chip-ico s8-tok ${token.toLowerCase()}`} aria-hidden="true" />
            <span className="noc-body-lg">{token}</span>
            <ExtIcon name="chevron-down" size={16} />
          </button>
        </div>
        <div className={`row recipient-row${invalid || self ? ' app-row-error' : ''}`}>
          <label className="lbl noc-overline" htmlFor="send-recipient">
            Recipient
          </label>
          <div className="field">
            <input
              id="send-recipient"
              className={`input noc-mono${invalid ? ' invalid' : ''}`}
              placeholder="Solana address"
              autoComplete="off"
              spellCheck={false}
              value={recipient}
              onChange={e => {
                setRecipient(e.target.value);
                setPasteRefused(false);
              }}
            />
            <div className="input-actions">
              {recipient === '' ? (
                <button type="button" aria-label="Paste" onClick={() => void paste()}>
                  <ExtIcon name="clip" size={18} />
                </button>
              ) : (
                <button type="button" aria-label="Clear recipient" onClick={() => setRecipient('')}>
                  <ExtIcon name="close" size={18} />
                </button>
              )}
            </div>
          </div>
          {helper}
          {firstTime ? (
            <div className="app-send-addr noc-mono">
              <AddressGroups address={address} />
            </div>
          ) : null}
        </div>
        <div className={`row amount-row${invalid ? ' app-row-dim' : short !== null ? ' app-row-error' : ''}`}>
          <label className="lbl noc-overline" htmlFor="send-amount">
            Amount
          </label>
          <div className="amount-line">
            <input
              id="send-amount"
              className={`amount noc-balance-lg noc-numeral${short !== null ? ' app-danger' : ''}`}
              placeholder="0.000000"
              inputMode="decimal"
              autoComplete="off"
              value={amountText}
              onChange={e => setAmountText(e.target.value.trim())}
            />
            <button type="button" className="max-chip" disabled={invalid || balance === null} onClick={max}>
              MAX
            </button>
          </div>
          {available}
          {token === 'SOL' && maxText !== null && amountText === maxText ? <div className="helper ok">{SEND_TEXT.maxHelper}</div> : null}
          {short === null ? null : (
            <div className="helper error" role="alert">
              <ExtIcon name="alert" size={12} /> Insufficient balance — short by <span className="noc-numeral">{`${showExact(token, short)} ${token}`}</span>
            </div>
          )}
          {solShort ? (
            <div className="helper error" role="alert">
              <ExtIcon name="alert" size={12} /> {SEND_TEXT.feeWarning}
            </div>
          ) : null}
        </div>
        <div className={`row fee-row${invalid ? ' app-row-dim' : ''}`}>
          <div className="line">
            <span className="l noc-body-sm">Network fee</span>
            <span className="r noc-body-sm noc-numeral">{invalid ? '—' : `~${showLamports(BASE_FEE_LAMPORTS)} SOL`}</span>
          </div>
          <div className="line muted">
            <span className="l noc-body-sm">Priority</span>
            <span className="r noc-body-sm">{SEND_TEXT.priority}</span>
          </div>
        </div>
      </div>
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" disabled={!ready} onPress={review}>
          {label}
        </LockedButton>
      </div>
      {sheet ? <TokenSheet balances={m.balances} prices={m.prices} selected={token} onSelect={setToken} onClose={() => setSheet(false)} /> : null}
    </div>
  );
}
```

Modify `extension/src/app/screens/TokenSheet.tsx`:

```diff
diff --git a/extension/src/app/screens/TokenSheet.tsx b/extension/src/app/screens/TokenSheet.tsx
index 1ce8b54..f1312b6 100644
--- a/extension/src/app/screens/TokenSheet.tsx
+++ b/extension/src/app/screens/TokenSheet.tsx
@@ -6,10 +6,11 @@ import type {Balances, Prices, Token} from '../engine';
 
 /**
  * #43 token selector (D18: the design's bottom sheet, as a list of the four tokens). Built in plan 1
- * with the sheet it shares with the account switcher; #12 opens it in plan 3.
+ * with the sheet it shares with the account switcher; #12 opens it (plan 3). With no balances read yet
+ * (`null`), each row's amount and value read "—" — never 0 (§7.3).
  */
-export function TokenSheet({balances, prices, selected, onSelect, onClose}: {balances: Balances; prices: Prices | null; selected: Token; onSelect: (t: Token) => void; onClose: () => void}) {
-  const v = valuation(balances, prices);
+export function TokenSheet({balances, prices, selected, onSelect, onClose}: {balances: Balances | null; prices: Prices | null; selected: Token; onSelect: (t: Token) => void; onClose: () => void}) {
+  const v = balances === null ? null : valuation(balances, prices);
   return (
     <Sheet title="Choose a token" onClose={onClose}>
       <div className="list">
@@ -30,8 +31,11 @@ export function TokenSheet({balances, prices, selected, onSelect, onClose}: {bal
               <span className="sec">{TOKEN_INFO[t].name}</span>
             </span>
             <span>
-              <span className="amt">{showAmount(t, v.rows[t].base)}</span>
-              <span className="fiat">{v.rows[t].usd === null ? '—' : showUsd(v.rows[t].usd)}{t === 'NOC' ? ' at stage price' : ''}</span>
+              <span className="amt">{v === null ? '—' : showAmount(t, v.rows[t].base)}</span>
+              <span className="fiat">
+                {v === null || v.rows[t].usd === null ? '—' : showUsd(v.rows[t].usd)}
+                {t === 'NOC' && v !== null && v.rows[t].usd !== null ? ' at stage price' : ''}
+              </span>
             </span>
           </button>
         ))}
```

Modify `extension/src/app/ui/ExtIcon.tsx`:

```diff
diff --git a/extension/src/app/ui/ExtIcon.tsx b/extension/src/app/ui/ExtIcon.tsx
index 08047d9..ff6d767 100644
--- a/extension/src/app/ui/ExtIcon.tsx
+++ b/extension/src/app/ui/ExtIcon.tsx
@@ -33,9 +33,25 @@ export type ExtIconName =
   | 'doc'
   | 'copy'
   | 'swap'
-  | 'arrow-right';
+  | 'arrow-right'
+  | 'clip'
+  | 'alert';
 
 const PATHS: Record<ExtIconName, ReactNode> = {
+  // Plan 3: #12's paste button (#i-clip) and its helper lines' glyph (#i-alert).
+  clip: (
+    <>
+      <rect x="8" y="2" width="8" height="4" rx="1" />
+      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
+    </>
+  ),
+  alert: (
+    <>
+      <circle cx="12" cy="12" r="10" />
+      <line x1="12" y1="8" x2="12" y2="12" />
+      <line x1="12" y1="16" x2="12.01" y2="16" />
+    </>
+  ),
   'arrow-right': (
     <>
       <path d="M5 12h14" />
```

Create `extension/src/app/ui/useEscape.ts`:

```ts
import {useEffect, useRef} from 'react';

/**
 * Esc on a flow screen goes back one step (spec §1.4) — the screen's own step, never the shell's pop: leaving
 * #19 must discard the prepared send first (E7), #20's back keeps it, and #21 has no back while broadcasting.
 * Off while `enabled` is false (a sheet open on top handles its own Esc). The latest handler is used, without
 * re-registering on every render.
 */
export function useEscape(handler: () => void, enabled = true): void {
  const current = useRef(handler);
  current.current = handler;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') current.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 3f99a53..13c6f81 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1378,6 +1378,19 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
   **→ adapted** (design regex allows 6 decimals; rule 2: exact base units via BigInt).
 - **CTA:** `LockedButton` (rule 6) → push #19 with `{token, recipient, amount}`.
 - **Differs, loudly:**
+  - **Plan 3:** the paste button reads the clipboard only when the browser allows it (the extension has
+    no clipboard permission, parent §4); when it refuses, the helper says "Paste with Ctrl+V (⌘V on a
+    Mac)." — **controller addition — awaiting the owner**. The sent-before hint reads "Verified · sent
+    before · today" on the day of the last send and "Verified · sent before · yesterday" for one day —
+    **controller additions — awaiting the owner** (the review rejected "last 1 day ago"): the design gives
+    only "last 12 days ago". There is no "send everything" on #12: MAX keeps the rent-exempt minimum by
+    design, and closing an account to exactly 0 is a product decision not taken here (plan-3 review, Q2).
+    The CTA never reads "Send 1. SOL" while the decimal point is being typed (review L6). The token chip's
+    tile is each token's own (#43's and #11's colours): the design's chip draws SOL only. The CTA carries
+    the amount as typed ("Send 75.000000 SOL", design state 4) once it parses; an amount the CTA refuses
+    anyway (short, or no SOL for the fee) predicts no re-authentication. "· ≈ $…" on the available line
+    is the typed amount's value (design state 5). The priority line stays in the first-time state (the
+    design's state 6 draws only the network fee).
   - Priority chips Normal/Fast/Instant removed (D15). The engine picks, and the fee shows on #19.
   - `.sol` resolution and its state "marko.sol → Resolved …" removed (D16).
   - Scan icon removed (D13).
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/Send.test.tsx src/app/__tests__/TokenSheet.test.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 2 passed (2) · Tests 22 passed (22); tsc clean; whole suite Test Files 105 passed (105) · Tests 1847 passed (1847).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M7a** — `extension/src/app/screens/Send.tsx`:

  ```diff
  -       if (generation.current !== mine) return;
  -       if (r.ok) setInfo(r.data);
  +       if (r.ok) setInfo(r.data);
  ```
  `npx vitest run src/app/__tests__/Send.test.tsx` — Expected: **red** (1 failed | 18 passed (19)).

- **M7b** — `extension/src/app/screens/Send.tsx`:

  ```diff
  - amountText.endsWith('.') ? amountText.slice(0, -1) : amountText
  + amountText
  ```
  `npx vitest run src/app/__tests__/Send.test.tsx` — Expected: **red** (1 failed | 18 passed (19)).

- [ ] **Step 7: The §8 visual checklist for this screen.** Task 17 shoots every state of this screen; after it, the opus-tier reviewer checks them against index.html with the checklist in Task 17. Nothing to run here; the component tests above already assert every string.

- [ ] **Step 8: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/app/__tests__/Send.test.tsx extension/src/app/__tests__/TokenSheet.test.tsx extension/src/app/app.css extension/src/app/screens/Send.tsx extension/src/app/screens/TokenSheet.tsx extension/src/app/ui/ExtIcon.tsx extension/src/app/ui/useEscape.ts
git commit -F - <<'MSG'
feat(extension): #12 send — every design state, E6's hints, MAX that keeps the rent minimum; #43 from the chip

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 8: #19 tx-simulate: simulating, ready, every refusal with its copy; Cancel discards (E7)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/scripts/check-classes.mjs`
- Create: `extension/src/app/__tests__/Review.test.tsx`
- Modify: `extension/src/app/__tests__/harness.tsx`
- Modify: `extension/src/app/app.css`
- Create: `extension/src/app/screens/Review.tsx`
- Modify: `extension/src/app/ui/ExtIcon.tsx`

**Interfaces:**
- Consumes: Tasks 2, 3, 6, 7; `wallet.prepareSend`, `wallet.preparedFor`, `wallet.discardPrepared` (E7), `wallet.cached`.
- Produces: `src/app/screens/Review.tsx` (`Review`, `REVIEW_TEXT`); harness `sendingReader()` and the `gate` option; ExtIcon `cpu`, `check-circle`; `check-classes.mjs` DYNAMIC gains `${c.tone}`.

Spec §4.4 and #s19. States: simulating (the live "Building call", the skeleton, "Simulating…" disabled); ready (the three checks, the balance delta from the engine's fee rows, "After" = the engine's read balance less `solRequiredLamports`, the slot, Continue); ready SPL with a new token account (rent row, both Afters); failed with each refusal's copy — `split-balance` ("Send at most N", N from Task 2's detail), `insufficient-*`, `sender-below-rent` ("This would leave less than 0.00089088 SOL in your account, which Solana does not allow. Send less, so at least that much stays." — the review's wording) / `recipient-below-rent` (**controller additions — awaiting the owner**, carry 2; a simulation refusal's detail says "the simulation refused it for rent", so support can tell it from the pre-check — review L8), `unreachable` (server line + last known state + Retry), `coordinator-refused` (D26, Retry disabled), `in-flight` (pending banner + [View it]). Cancel, the back arrow and Esc **discard first** (E7), then #12; a prepare that lands after the screen was left is discarded too (generation check). Back from #20 shows a live prepared send of the same intent again; an expired one is re-prepared carrying its challenge (D39).

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Review.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {renderInWallet, sendingReader, type Wallet, type WalletOptions} from './harness';
import {REVIEW_TEXT, Review} from '../screens/Review';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {REFUSED_TEXT} from '../ui/Banner';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {BALANCE_CACHE_KEY} from '../../background/balanceCache';
import {PENDING_KEY} from '../../background/pendingStore';
import {RequestUnreachable, RpcForbidden, type SimulationOutcome} from '../../../../core/solana/rpc';
import {ACCOUNT, pendingRecord} from '../../background/__tests__/fixtures';
import {COUNTERPARTY} from '../../../e2e/historyFixtures';
import {createEngine, type Intent} from '../engine';
import {WalletProvider} from '../WalletContext';

// Spec §4.4 (#19): the engine's prepare is this screen (E2). The harness wallet sends from Main: 62.4821 SOL,
// 4 200 NOC, 740.21 USDC; quiet fees (50 000 µlamports/CU), so a SOL send pays 5 000 + 50 lamports.
const SELECTORS = selectorsOf(UI_SHEETS);
const SOL: Intent = {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n};
const NOC: Intent = {token: 'NOC', recipient: COUNTERPARTY, amount: 12_000_000_000n};
const nav = {onCancel: vi.fn(), onConfirm: vi.fn(), onViewPending: vi.fn()};
const knownRecipient = async (ext: Wallet['ext']) => ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY]);

/** #19 for `intent`, every message recorded (type, and the challengeId a prepare carried). */
async function renderReview(intent: Intent, o: WalletOptions & {notice?: 'confirmation-expired' | null} = {}) {
  const sent: {type: string; challengeId?: unknown}[] = [];
  const w = await renderInWallet(<Review account={ACCOUNT.publicKey} intent={intent} notice={o.notice ?? null} {...nav} />, {
    reader: sendingReader(),
    before: knownRecipient,
    ...o,
    gate: async m => {
      const msg = m as {type: string; challengeId?: unknown};
      sent.push({type: msg.type, challengeId: msg.challengeId});
      await o.gate?.(m);
    },
  });
  return {...w, sent, prepares: () => sent.filter(x => x.type === 'wallet.prepareSend')};
}
const ready = () => screen.findByText(REVIEW_TEXT.passed);
const rows = (card: string) => [...document.querySelectorAll(`.${card} .delta-row`)].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent ?? null]);
const failing = (code: () => never) => sendingReader({simulateTransaction: async () => code()});

afterEach(() => vi.clearAllMocks());

describe('#19 tx-simulate', () => {
  it('simulating: the intent with the recipient in groups of four, the live "Building call", the skeleton, "Simulating…" disabled, Cancel', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    await renderReview(SOL, {gate: m => ((m as {type: string}).type === 'wallet.prepareSend' ? held : undefined)});
    expect(await screen.findByText(REVIEW_TEXT.simulating)).toBeTruthy();
    expect(screen.getByText('Review transfer')).toBeTruthy();
    expect(screen.getByText('3 of 4')).toBeTruthy();
    expect(document.querySelector('.intent-card .amount')?.textContent).toBe('0.0100 SOL');
    expect([...document.querySelectorAll('.intent-card .to .addr-groups > span')].map(s => s.textContent)).toEqual(COUNTERPARTY.match(/.{1,4}/g));
    expect(document.querySelector('.step-pill')?.textContent).toMatch(/^Building call · \d+ ms$/);
    expect(document.querySelector('.m3-prog')).not.toBeNull();
    expect(screen.getByText(REVIEW_TEXT.simulatingFooter)).toBeTruthy();
    expect((screen.getByRole('button', {name: 'Simulating…'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeTruthy();
    expect(screen.queryByText(REVIEW_TEXT.continue)).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-sim')!, SELECTORS)).toEqual([]);
    await act(async () => release());
    await ready();
  });

  it('ready, SOL: "Simulation passed", the three checks, the balance delta from the engine’s fee rows, After, the slot, Continue', async () => {
    const {ext} = await renderReview(SOL);
    await ready();
    expect(document.querySelector('.step-pill.is-ready')?.textContent).toBe('Ready · 0 ms');
    const checks = [...document.querySelectorAll('.check-row')].map(r => [r.className, r.querySelector('.ttl')?.textContent, r.querySelector('.meta')?.textContent, r.querySelector('.badge')?.textContent]);
    expect(checks).toEqual([
      ['check-row ok', 'No interactions with unknown contracts', 'SystemProgram · transfer only', 'PASS'],
      ['check-row ok', 'No token approvals granted', 'Native SOL transfer · zero allowances changed', 'PASS'],
      ['check-row ok', 'Recipient is a regular wallet', `no executable account at ${COUNTERPARTY.slice(0, 4)}…`, 'PASS'],
    ]);
    expect(rows('delta-card')).toEqual([
      ['Sending', '− 0.0100 SOL'],
      ['Network fee', '− 0.000005 SOL'],
      ['Priority', '− 0.00000005 SOL'],
      ['No Noctura fee (status unknown)', null],
      ['After', '62.47209495 SOL'],
    ]);
    // Spec §4.5: the SOL rows sum to solRequiredLamports, and before − solRequired is the After shown.
    const prepared = await ext.session.get('v1_prepared');
    const shown = (prepared as {shown: {solRequiredLamports: string}}[])[0]!.shown;
    expect(10_000_000n + 5_000n + 50n).toBe(BigInt(shown.solRequiredLamports));
    expect(62_482_100_000n - BigInt(shown.solRequiredLamports)).toBe(62_472_094_950n);
    expect(screen.getByText('271 408 921').closest('.footer-meta')?.textContent).toBe('Simulated against slot 271 408 921 · result valid for 30 s');
    expect(unstyledClasses(document.querySelector('.s-sim')!, SELECTORS)).toEqual([]);
  });

  it('ready, an SPL send creating the recipient’s token account: the token checks, the rent row, both Afters', async () => {
    await renderReview(NOC, {reader: sendingReader({getAccountExists: async () => false})});
    await ready();
    expect([...document.querySelectorAll('.check-row .meta')].slice(0, 2).map(m => m.textContent)).toEqual(["Token Program · transfer · creates the recipient's token account", 'Token transfer · zero allowances changed']);
    expect(rows('delta-card')).toEqual([
      ['Sending', '− 12.0000 NOC'],
      ['Network fee', '− 0.000005 SOL'],
      ['Priority', '− 0.00000325 SOL'],
      ['New token account', '− 0.00203928 SOL'],
      ['No Noctura fee (status unknown)', null],
      ['After', '62.48005247 SOL'],
      ['After', '4,188.0000 NOC'],
    ]);
  });

  it.each([
    ['missing', 'check-row ok', 'Recipient is a new address', 'no account exists yet — this transfer creates it', 'PASS'],
    ['program', 'check-row warn', 'Recipient is a program, not a wallet', 'funds sent to a program address may not be recoverable', 'WARNING'],
    ['other', 'check-row warn', 'Recipient is not a regular wallet', 'this address is owned by a program', 'WARNING'],
  ] as const)('the recipient kind %s: its own check row, never a refusal', async (kind, cls, ttl, meta, badge) => {
    await renderReview(SOL, {reader: sendingReader({getAccountKind: async () => kind})});
    await ready();
    const row = [...document.querySelectorAll('.check-row')][2]!;
    expect([row.className, row.querySelector('.ttl')?.textContent, row.querySelector('.meta')?.textContent, row.querySelector('.badge')?.textContent]).toEqual([cls, ttl, meta, badge]);
    expect(screen.getByRole('button', {name: REVIEW_TEXT.continue})).toBeTruthy();
  });

  const failedSim = (o: SimulationOutcome) => ({...o, err: {InstructionError: [2, {Custom: 1}]}, accounts: null});
  it.each<[string, Partial<Parameters<typeof sendingReader>[0]>, string, string | null, boolean]>([
    ['simulation-failed', {simulateTransaction: async () => failedSim({err: null, logs: [], unitsConsumed: 0, slot: 1, accounts: null})}, 'The network would reject this transfer', '{"InstructionError":[2,{"Custom":1}]}', true],
    ['simulation-mismatch', {simulateTransaction: async () => ({err: null, logs: [], unitsConsumed: 0, slot: 1, accounts: [{lamports: 1n, owner: '11111111111111111111111111111111', data: new Uint8Array(0)}]})}, 'Your balance changed while this was being checked', 'Review it again.', true],
    ['insufficient-sol', {getBalance: async () => 1_000_000n}, 'Not enough SOL for the network fee', '10005050 lamports needed, 1000000 held', false],
    ['sender-below-rent', {getBalance: async () => 10_100_000n}, REVIEW_TEXT.senderBelowRent, null, false],
    ['recipient-below-rent (a new account)', {getAccountKind: async () => 'missing'}, REVIEW_TEXT.recipientBelowRent, null, false],
    ['failed', {getLatestBlockhash: async () => Promise.reject(new Error('boom'))}, 'Something went wrong while checking this transfer.', null, true],
  ])('failed — %s: "Couldn\'t simulate", its banner, Retry only where a retry can help, never a way on', async (_name, over, title, line, retry) => {
    const intent = _name.startsWith('recipient-below-rent') ? {...SOL, amount: 890_879n} : SOL;
    await renderReview(intent, {reader: sendingReader(over)});
    expect(await screen.findByText(title)).toBeTruthy();
    expect(document.querySelector('.intent-card .eyebrow')?.textContent).toBe("Couldn't simulate");
    expect(document.querySelector('.banner.danger .banner-line')?.textContent ?? null).toBe(line);
    expect(screen.queryByRole('button', {name: REVIEW_TEXT.retry}) !== null).toBe(retry);
    // Review L6's negative control: no Continue in any failed state, enabled or not.
    expect(screen.queryByText(REVIEW_TEXT.continue)).toBeNull();
    expect(screen.queryByText(/Continue anyway|proceed at your own risk/)).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-sim')!, SELECTORS)).toEqual([]);
  });

  it('failed — split-balance: "Send at most" the largest holding; insufficient-token names the token', async () => {
    const split = sendingReader({
      getTokenAccountsByOwner: async owner => [
        {pubkey: 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', owner, amount: 7_000_000_000n, decimals: 9},
        {pubkey: '4G8U5nQtNciNaEL7Zimb4DhqeanDMevXp7MLtFvUojwF', mint: 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW', owner, amount: 6_000_000_000n, decimals: 9},
      ],
    });
    await renderReview(NOC, {reader: split});
    expect(await screen.findByText('This token is spread across several accounts in your wallet. Send at most 7.0000 NOC, or move it into one account first.')).toBeTruthy();
    expect(screen.queryByRole('button', {name: REVIEW_TEXT.retry})).toBeNull();
  });

  it('failed — unreachable: the server line (never "offline" while the browser is online), the last known state from the cache, Retry', async () => {
    const at = Date.now() - 9 * 60_000;
    await renderReview(SOL, {
      reader: failing(() => {
        throw new RequestUnreachable('u', 'no answer');
      }),
      before: async ext => {
        await knownRecipient(ext);
        await ext.local.set(BALANCE_CACHE_KEY, {[ACCOUNT.publicKey]: {sol: '62482100000', noc: '0', usdc: '0', usdt: '0', at}});
      },
    });
    expect(await screen.findByText('No answer from the Noctura server within 20 s.')).toBeTruthy();
    expect(document.querySelector('.intent-card .eyebrow')?.textContent).toBe('Could not reach the Noctura server');
    expect(await screen.findByText('Last known state · 9 min ago')).toBeTruthy();
    expect(screen.getByText('Showing balance from cache · 62.4821 SOL')).toBeTruthy();
    expect(screen.getByText('Cannot verify recipient type')).toBeTruthy();
    expect(screen.getAllByText(/^(CACHED|UNKNOWN)$/).map(b => b.textContent)).toEqual(['CACHED', 'UNKNOWN']);
    expect(screen.getByRole('button', {name: REVIEW_TEXT.retry})).toBeTruthy();
  });

  it('failed — coordinator-refused: the D26 banner, Retry disabled', async () => {
    await renderReview(SOL, {
      reader: failing(() => {
        throw new RpcForbidden('simulateTransaction');
      }),
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect((screen.getByRole('button', {name: REVIEW_TEXT.retry}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('failed — in-flight: #12’s pending banner with [View it], no Retry', async () => {
    const record = pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: COUNTERPARTY, amount: '1'}});
    await renderReview(SOL, {
      before: async ext => {
        await knownRecipient(ext);
        await ext.local.set(PENDING_KEY, [record]);
      },
    });
    fireEvent.click(await screen.findByRole('button', {name: 'View it'}));
    expect(screen.getByText(REVIEW_TEXT.pending)).toBeTruthy();
    expect(nav.onViewPending).toHaveBeenCalledWith(expect.objectContaining({id: 'p1'}));
    expect(screen.queryByRole('button', {name: REVIEW_TEXT.retry})).toBeNull();
  });

  it('Retry prepares again — once per tap (rule 6, with `disabled` lifted)', async () => {
    let calls = 0;
    const flaky = sendingReader({
      getLatestBlockhash: async () => {
        calls += 1;
        if (calls === 1) throw new Error('first time');
        return {blockhash: 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk', lastValidBlockHeight: 1000};
      },
    });
    const {prepares} = await renderReview(SOL, {reader: flaky});
    const retry = (await screen.findByRole('button', {name: REVIEW_TEXT.retry})) as HTMLButtonElement;
    fireEvent.click(retry);
    retry.disabled = false;
    fireEvent.click(retry);
    await ready();
    expect(prepares()).toHaveLength(2);
  });

  it('Continue hands over to #20 — once per tap (rule 6)', async () => {
    await renderReview(SOL);
    await ready();
    const go = screen.getByRole('button', {name: REVIEW_TEXT.continue}) as HTMLButtonElement;
    fireEvent.click(go);
    go.disabled = false;
    fireEvent.click(go);
    expect(nav.onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Cancel, the back arrow and Esc discard the prepared send first (E7), then go back to #12 — once', async () => {
    for (const leave of ['Cancel', 'Back', 'Escape']) {
      vi.clearAllMocks();
      const w = await renderReview(SOL);
      await ready();
      if (leave === 'Escape') fireEvent.keyDown(document, {key: 'Escape'});
      else fireEvent.click(screen.getAllByRole('button', {name: leave})[0]!);
      fireEvent.click(screen.getAllByRole('button', {name: 'Cancel'})[0]!);
      await waitFor(() => expect(nav.onCancel).toHaveBeenCalledTimes(1));
      expect(w.sent.filter(x => x.type === 'wallet.discardPrepared')).toHaveLength(1);
      expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
      cleanup();
    }
  });

  it('a prepare that lands after the screen was left is discarded too: nothing outlives the review', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    let first = true;
    const w = await renderReview(SOL, {
      gate: m => {
        if ((m as {type: string}).type !== 'wallet.prepareSend' || !first) return undefined;
        first = false;
        return held;
      },
    });
    await screen.findByText(REVIEW_TEXT.simulating);
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(nav.onCancel).toHaveBeenCalledTimes(1));
    await act(async () => release());
    await waitFor(() => expect(w.sent.filter(x => x.type === 'wallet.discardPrepared')).toHaveLength(2));
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
  });

  it('back from #20: a live prepared send of the same intent is shown again, not prepared anew; an expired one carries its challenge (D39)', async () => {
    // A first-time recipient: the prepare issues a challenge.
    const w = await renderReview(SOL, {before: async () => undefined});
    await ready();
    const first = await w.engine.preparedFor(ACCOUNT.publicKey);
    const challengeId = first.ok ? first.data?.reauth?.challengeId : undefined;
    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
    const again = async () => {
      cleanup();
      const sent: {type: string; challengeId?: unknown}[] = [];
      const engine = createEngine(async m => {
        const msg = m as {type: string; challengeId?: unknown};
        sent.push({type: msg.type, challengeId: msg.challengeId});
        return w.transport(m);
      }, async () => undefined);
      render(
        <WalletProvider engine={engine} platform={w.platform} surface="popup">
          <Review account={ACCOUNT.publicKey} intent={SOL} notice={null} {...nav} />
        </WalletProvider>,
      );
      await ready();
      return sent.filter(x => x.type === 'wallet.prepareSend');
    };
    // Within the 30 s prepared life: shown again, nothing prepared.
    expect(await again()).toEqual([]);
    // Past it: prepared again, carrying the challenge, so the proof (if any) carries over.
    w.deps.clock.t += 30_000;
    expect(await again()).toEqual([{type: 'wallet.prepareSend', challengeId}]);
  });

  it('the notice from #20 (R2-M3): "Your confirmation expired — review again"', async () => {
    await renderReview(SOL, {notice: 'confirmation-expired'});
    expect(await screen.findByText(REVIEW_TEXT.confirmationExpired)).toBeTruthy();
    await ready();
    expect(screen.getByText(REVIEW_TEXT.confirmationExpired)).toBeTruthy();
  });
});
```

Modify `extension/src/app/__tests__/harness.tsx`:

```diff
diff --git a/extension/src/app/__tests__/harness.tsx b/extension/src/app/__tests__/harness.tsx
index 0f2832b..7440b6c 100644
--- a/extension/src/app/__tests__/harness.tsx
+++ b/extension/src/app/__tests__/harness.tsx
@@ -12,7 +12,7 @@ import type {SolanaReader} from '../../../../core/solana/rpc';
 import {WALLET_TOKENS} from '../../../../core/solana/balances';
 import {fakeDeps, fakeReader} from '../../background/__tests__/fakeDeps';
 import {fakeExt} from '../../background/__tests__/fakeExt';
-import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
+import {ACCOUNT, HOLDING_LARGE, HOLDING_SMALL, RECIPIENT, sendReader} from '../../background/__tests__/fixtures';
 
 /**
  * The screens against the REAL background (handleMessage, fake Ext, fake deps) — the same wiring as
@@ -46,6 +46,24 @@ export function walletReader(over: Partial<SolanaReader> = {}): SolanaReader {
   });
 }
 
+/**
+ * walletReader's wallet, able to send (plan 3): quiet fees, a blockhash valid to height 1000, the recipient an
+ * existing wallet, and a simulation consistent with the transaction it is given (E2, the background fixtures'
+ * sendReader) — with the harness's balances and real token-account addresses, filtered by mint as the RPC does.
+ */
+export function sendingReader(over: Partial<SolanaReader> = {}): SolanaReader {
+  const holdings = (owner: string) => [
+    {pubkey: HOLDING_LARGE, mint: NOC, owner, amount: 4_200_000_000_000n, decimals: 9},
+    {pubkey: HOLDING_SMALL, mint: USDC, owner, amount: 740_210_000n, decimals: 6},
+  ];
+  return sendReader({
+    getBalance: async () => 62_482_100_000n,
+    getTokenAccountsByOwner: async (owner, filter) => holdings(owner).filter(h => !('mint' in filter) || h.mint === filter.mint),
+    getSignaturesForAddress: async () => [],
+    ...over,
+  });
+}
+
 export interface Wallet {
   ext: ReturnType<typeof fakeExt>;
   deps: ReturnType<typeof fakeDeps>;
@@ -66,6 +84,11 @@ export interface WalletOptions {
   before?: (ext: ReturnType<typeof fakeExt>) => Promise<void>;
   /** The provider's clock (default: Date.now). */
   now?: () => number;
+  /**
+   * Sees every message the client sends, before the background does; may hold it (return a promise) — how a
+   * test keeps a state on screen, or counts what a screen asked (plan 3).
+   */
+  gate?: (m: unknown) => Promise<void> | void;
 }
 
 /** A background with this wallet in it, a client wired to it, and a spy platform. */
@@ -96,7 +119,11 @@ export async function setupWallet(o: WalletOptions = {}): Promise<Wallet> {
     version: () => '0.1.0',
   };
   const transport: Transport = m => handleMessage(ext, m, POPUP, deps);
-  return {ext, deps, platform, transport, engine: createEngine(transport, async () => undefined)};
+  const gated: Transport = async m => {
+    await o.gate?.(m);
+    return transport(m);
+  };
+  return {ext, deps, platform, transport, engine: createEngine(o.gate === undefined ? transport : gated, async () => undefined)};
 }
 
 /** One screen inside the real provider (the open sequence runs as in the popup). */
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/Review.test.tsx src/app/__tests__/harness.tsx
```
Expected (dry run): FAIL — Test Files 1 failed (1) · Tests no tests (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/scripts/check-classes.mjs`:

```diff
diff --git a/extension/scripts/check-classes.mjs b/extension/scripts/check-classes.mjs
index 29b7fb7..e5fc518 100644
--- a/extension/scripts/check-classes.mjs
+++ b/extension/scripts/check-classes.mjs
@@ -32,6 +32,8 @@ export const DYNAMIC = {
   'app-${surface}': ['app-popup', 'app-tab'],
   '${className}': [],
   '${titleClass}': [],
+  // Plan 3: #19's check rows (screens/Review.tsx) — PASS rows `ok`, the recipient warnings `warn`.
+  '${c.tone}': ['ok', 'warn'],
 };
 
 /** The text of the quoted string that starts at `i` (the quote), and the index after it. */
```

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index f31d2df..634c7d6 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -596,3 +596,17 @@ a.btn {
   padding: 0;
   justify-content: flex-start;
 }
+
+/* #19 review (plan 3): index.html #s19's inline styles — the failed eyebrow's glyph in --danger, and the After
+   row's rule above it, its label in the body face in --fg-secondary. */
+.s-sim .intent-card .eyebrow.app-failed svg {
+  color: var(--danger);
+}
+.s-sim .delta-row.app-after {
+  border-top: 1px solid color-mix(in oklab, var(--fg-disabled) 50%, transparent);
+  padding-top: var(--space-2);
+  margin-top: 4px;
+}
+.s-sim .delta-row.app-after .lbl {
+  color: var(--fg-secondary);
+}
```

Create `extension/src/app/screens/Review.tsx`:

```tsx
import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {useWallet} from '../WalletContext';
import {ago, showAmount} from '../format';
import {feeRows, sameIntent, showExact, showLamports} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import type {Intent, Pending, Prepared} from '../engine';

/** The fixed strings #19 shows (spec §4.4); adapted ones are marked there. */
export const REVIEW_TEXT = {
  title: 'Review transfer',
  step: '3 of 4',
  simulating: 'Simulating on Solana mainnet',
  simulatingCta: 'Simulating…',
  /** The instruction count is not known until the engine has built the message (spec §4.4 Differs). */
  simulatingFooter: 'Noctura server · simulateTransaction',
  passed: 'Simulation passed',
  what: 'What this transaction does',
  delta: 'Balance delta',
  continue: 'Continue to confirm',
  cancel: 'Cancel',
  retry: 'Retry simulation',
  couldNot: "Couldn't simulate",
  /** §4.5 (R2-M3): #20 sends the user back here when the engine consumed the send against an expired proof. */
  confirmationExpired: 'Your confirmation expired — review again',
  pending: 'A send from this account is still pending. Wait until it confirms or expires.',
  /** Controller addition — awaiting the owner (plan 3, carry 2; review wording) — the engine's check and the simulation's InsufficientFundsForRent alike. */
  senderBelowRent: 'This would leave less than 0.00089088 SOL in your account, which Solana does not allow. Send less, so at least that much stays.',
  /** Controller addition — awaiting the owner (plan 3, carry 2): refused before anything is simulated, or by the simulation. */
  recipientBelowRent: 'This address has no Solana account yet. A new account needs at least 0.00089088 SOL, so send at least that much.',
} as const;

/** A refusal #19 shows, from the engine's code (spec §4.4). */
interface Failure {
  code: string;
  detail: string | null;
}

/** Refusals a retry cannot fix: Retry is not offered (spec §4.4). */
const NO_RETRY = new Set(['split-balance', 'insufficient-token', 'insufficient-sol', 'sender-below-rent', 'recipient-below-rent', 'in-flight']);
const detailOf = (data: unknown): string | null => {
  const d = (data as {detail?: unknown} | undefined)?.detail;
  return typeof d === 'string' ? d : null;
};
/** "271 408 921": the slot in groups of three, as the design writes it. */
const groupSlot = (slot: number): string => slot.toLocaleString('en-US').replace(/,/g, ' ');

/**
 * #19 tx-simulate (spec §4.4): the engine's prepare is this screen (E2). It shows the simulation and what the
 * transaction does, or why the engine refused it — never a way on from a refusal (no "Continue anyway", D21).
 * A live prepared send of the same intent (back from #20) is shown again rather than prepared anew; anything else
 * is prepared, carrying the challenge of an earlier prepare of the same intent (D39). Leaving towards #12 (Cancel,
 * the back arrow, Esc) discards the prepared send and its challenge first (E7) — and a prepare that lands after
 * the screen was left is discarded too, so nothing outlives the review the user abandoned.
 */
export function Review({
  account,
  intent,
  notice,
  onCancel,
  onConfirm,
  onViewPending,
}: {
  account: string;
  intent: Intent;
  notice: 'confirmation-expired' | null;
  onCancel: () => void;
  onConfirm: () => void;
  onViewPending: (p: Pending) => void;
}) {
  const m = useWallet();
  const {engine, reload, report, now: clock} = m;
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [startedAt, setStartedAt] = useState(clock);
  const [cache, setCache] = useState<{sol: bigint; at: number} | null>(null);
  const [open, setOpen] = useState<Pending | null>(null);
  const now = useNow(prepared === null && failure === null ? 100 : 30_000, clock);
  /** The run in flight; a reply for an older run, or after the screen was left, is dropped. */
  const run = useRef(0);
  const left = useRef(false);

  const simulate = useCallback(
    async (fresh: boolean) => {
      const mine = ++run.current;
      setPrepared(null);
      setFailure(null);
      setStartedAt(clock());
      let carried: string | undefined;
      const resumable = await engine.preparedFor(account);
      if (run.current !== mine) return;
      if (resumable.ok && resumable.data !== null && sameIntent(resumable.data.intent, intent)) {
        if (!fresh && !resumable.data.expired) return setPrepared(resumable.data);
        carried = resumable.data.reauth?.challengeId;
      }
      const r = await engine.prepareSend(account, intent, carried);
      if (run.current !== mine) {
        // The screen was left (or a newer run started) while this one prepared: a prepared send it made must
        // not outlive the review — the same discard the leaving did (E7).
        if (r.ok && left.current) void engine.discardPrepared(account);
        return;
      }
      if (r.ok) return setPrepared(r.data);
      if (r.error === 'locked') return void reload();
      if (r.error === 'coordinator-refused' || r.error === 'unreachable') report(r.error);
      if (r.error === 'unreachable') {
        const c = await engine.cached(account);
        if (run.current === mine && c.ok && c.data.balances !== null) setCache({sol: c.data.balances.sol, at: c.data.balances.at});
      }
      if (r.error === 'in-flight') {
        const p = await engine.pending();
        if (run.current === mine && p.ok) setOpen(p.data.find(x => x.account === account && (x.state === 'pending' || x.state === 'stuck')) ?? null);
      }
      if (run.current !== mine) return;
      setFailure({code: r.error, detail: detailOf(r.data)});
    },
    [account, intent, engine, reload, report, clock],
  );

  useEffect(() => {
    left.current = false;
    void simulate(false);
    // Unmounted (Continue to #20, or a lock): a reply still in flight is dropped. The route's account and intent do
    // not change while the screen is shown, so `simulate` runs once.
    return () => {
      run.current += 1;
    };
  }, [simulate]);

  const leaving = useRef(false);
  const leave = async () => {
    if (leaving.current) return;
    leaving.current = true;
    left.current = true;
    run.current += 1;
    await engine.discardPrepared(account);
    onCancel();
  };
  useEscape(() => void leave());

  const token = intent.token;
  const amount = `${showExact(token, intent.amount)} ${token}`;
  const head = (eyebrow: ReactNode, pill: ReactNode) => (
    <div className="intent-card">
      {eyebrow}
      <div className="head">
        <span className="amount noc-balance-md noc-numeral">{amount}</span>
        <span className="arrow">→</span>
        <span className="to noc-mono">
          <AddressGroups address={intent.recipient} />
        </span>
      </div>
      {pill}
    </div>
  );
  const top = <TopBar title={REVIEW_TEXT.title} onBack={() => void leave()} trailing={<span className="step noc-overline">{REVIEW_TEXT.step}</span>} />;
  const cancel = (
    <button type="button" className="btn btn-tertiary" onClick={() => void leave()}>
      {REVIEW_TEXT.cancel}
    </button>
  );
  const expiredNotice = notice === 'confirmation-expired' ? <Banner tone="warning" title={REVIEW_TEXT.confirmationExpired} /> : null;

  if (failure !== null) {
    const refused = failure.code === 'coordinator-refused' || m.net.mode === 'refused';
    const unreachable = failure.code === 'unreachable';
    const online = typeof navigator === 'undefined' || navigator.onLine !== false;
    const eyebrow = unreachable ? (online ? 'Could not reach the Noctura server' : "You're offline") : REVIEW_TEXT.couldNot;
    let banner;
    if (refused) banner = <RefusedBanner />;
    else if (failure.code === 'in-flight') {
      banner = (
        <div className="banner info" role="status">
          <ExtIcon name="info" size={18} />
          <div>
            <div className="noc-body-sm banner-title">{REVIEW_TEXT.pending}</div>
            {open === null ? null : (
              <button type="button" className="btn btn-tertiary app-btn-inline" onClick={() => onViewPending(open)}>
                View it
              </button>
            )}
          </div>
        </div>
      );
    } else banner = failureBanner(failure, token);
    const retry = NO_RETRY.has(failure.code) ? null : (
      <LockedButton className="btn btn-primary" disabled={refused} onPress={() => simulate(true)}>
        <ExtIcon name="refresh" size={18} />
        {REVIEW_TEXT.retry}
      </LockedButton>
    );
    return (
      <div className="screen s-sim">
        {top}
        <div className="scroll">
          {expiredNotice}
          {head(
            <div className="eyebrow app-failed">
              <ExtIcon name="alert-triangle" size={12} />
              {eyebrow}
            </div>,
            null,
          )}
          {banner}
          {unreachable ? (
            <div className="check-card">
              <h3 className="noc-overline">{cache === null ? 'Last known state' : `Last known state · ${ago(cache.at, now)}`}</h3>
              {cache === null ? null : (
                <div className="check-row warn">
                  <span className="ic">
                    <ExtIcon name="info" size={14} />
                  </span>
                  <div className="copy">
                    <span className="ttl">Stale balance</span>
                    <span className="meta">Showing balance from cache · {showAmount('SOL', cache.sol)} SOL</span>
                  </div>
                  <span className="badge">CACHED</span>
                </div>
              )}
              <div className="check-row warn">
                <span className="ic">
                  <ExtIcon name="info" size={14} />
                </span>
                <div className="copy">
                  <span className="ttl">Cannot verify recipient type</span>
                  <span className="meta">If recipient is an exchange wallet without memo support, funds may be lost</span>
                </div>
                <span className="badge">UNKNOWN</span>
              </div>
            </div>
          ) : null}
        </div>
        <div className="sticky-bar">
          {retry}
          {cancel}
        </div>
      </div>
    );
  }

  if (prepared === null) {
    return (
      <div className="screen s-sim">
        {top}
        <div className="scroll">
          {expiredNotice}
          <div className="m3-prog" aria-hidden="true" />
          {head(
            <div className="eyebrow">
              <ExtIcon name="cpu" size={12} />
              {REVIEW_TEXT.simulating}
            </div>,
            <span className="step-pill">Building call · {Math.max(0, now - startedAt)} ms</span>,
          )}
          <div className="skel-card" aria-busy="true" aria-label="Loading simulation result">
            <div className="skel-line short" />
            <div className="skel-line long" />
            <div className="skel-line med" />
            <div className="skel-line long" />
          </div>
          <div className="skel-card">
            <div className="skel-line short" />
            <div className="skel-line long" />
          </div>
          <div className="footer-meta">{REVIEW_TEXT.simulatingFooter}</div>
        </div>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary" disabled>
            {REVIEW_TEXT.simulatingCta}
          </button>
          {cancel}
        </div>
      </div>
    );
  }

  const sim = prepared.simulation;
  const sol = token === 'SOL';
  // E2 accepts the simulated state with or without the network fee: the After shown is the engine's own total
  // taken from the balance it read — what the account holds once the fee is paid, whichever form the node used.
  const solAfter = sim.sol.before - prepared.solRequiredLamports;
  const checks = [
    {
      tone: 'ok',
      ttl: 'No interactions with unknown contracts',
      meta: sol ? 'SystemProgram · transfer only' : `Token Program · transfer${prepared.fees.rentLamports > 0n ? " · creates the recipient's token account" : ''}`,
      mono: false,
      badge: 'PASS',
    },
    {tone: 'ok', ttl: 'No token approvals granted', meta: sol ? 'Native SOL transfer · zero allowances changed' : 'Token transfer · zero allowances changed', mono: false, badge: 'PASS'},
    sim.recipient === 'wallet'
      ? {tone: 'ok', ttl: 'Recipient is a regular wallet', meta: `no executable account at ${intent.recipient.slice(0, 4)}…`, mono: true, badge: 'PASS'}
      : sim.recipient === 'new'
        ? {tone: 'ok', ttl: 'Recipient is a new address', meta: 'no account exists yet — this transfer creates it', mono: false, badge: 'PASS'}
        : sim.recipient === 'program'
          ? {tone: 'warn', ttl: 'Recipient is a program, not a wallet', meta: 'funds sent to a program address may not be recoverable', mono: false, badge: 'WARNING'}
          : {tone: 'warn', ttl: 'Recipient is not a regular wallet', meta: 'this address is owned by a program', mono: false, badge: 'WARNING'},
  ];
  return (
    <div className="screen s-sim">
      {top}
      <div className="scroll">
        {expiredNotice}
        {head(
          <div className="eyebrow">
            <ExtIcon name="check-circle" size={12} />
            {REVIEW_TEXT.passed}
          </div>,
          <span className="step-pill is-ready">Ready · {sim.elapsedMs} ms</span>,
        )}
        <div className="check-card">
          <h3 className="noc-overline">{REVIEW_TEXT.what}</h3>
          {checks.map(c => (
            <div className={`check-row ${c.tone}`} key={c.ttl}>
              <span className="ic">
                <ExtIcon name={c.tone === 'ok' ? 'check' : 'alert-triangle'} size={14} />
              </span>
              <div className="copy">
                <span className="ttl">{c.ttl}</span>
                <span className={`meta${c.mono ? ' mono noc-mono' : ''}`}>{c.meta}</span>
              </div>
              <span className="badge">{c.badge}</span>
            </div>
          ))}
        </div>
        <div className="delta-card">
          <h3 className="noc-overline">{REVIEW_TEXT.delta}</h3>
          <div className="delta-row">
            <span className="lbl">Sending</span>
            <span className="val neg noc-numeral">− {amount}</span>
          </div>
          {feeRows(prepared.fees).map(f => (
            <div className="delta-row" key={f.label}>
              <span className="lbl">{f.label}</span>
              {f.lamports === null ? null : <span className="val neg noc-numeral">− {showLamports(f.lamports)} SOL</span>}
            </div>
          ))}
          <div className="delta-row app-after">
            <span className="lbl noc-body">After</span>
            <span className="val noc-balance-md noc-numeral">{showExact('SOL', solAfter)} SOL</span>
          </div>
          {sim.token === null ? null : (
            <div className="delta-row app-after">
              <span className="lbl noc-body">After</span>
              <span className="val noc-balance-md noc-numeral">
                {showExact(sim.token.symbol, sim.token.after)} {sim.token.symbol}
              </span>
            </div>
          )}
        </div>
        <div className="footer-meta">
          Simulated against slot <code>{groupSlot(sim.slot)}</code> · result valid for 30 s
        </div>
      </div>
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" onPress={onConfirm}>
          <ExtIcon name="arrow-right" size={18} />
          {REVIEW_TEXT.continue}
        </LockedButton>
        {cancel}
      </div>
    </div>
  );
}

/** The danger banner of a refusal: its title and, where the spec gives one, its line (spec §4.4). */
function failureBanner(f: Failure, token: Intent['token']) {
  switch (f.code) {
    case 'simulation-failed':
      return (
        <Banner tone="danger" title="The network would reject this transfer">
          {f.detail === null ? undefined : <span className="noc-mono">{f.detail.slice(0, 240)}</span>}
        </Banner>
      );
    case 'unreachable':
      return <Banner tone="danger" title="No answer from the Noctura server within 20 s." />;
    case 'simulation-mismatch':
      return (
        <Banner tone="danger" title="Your balance changed while this was being checked">
          Review it again.
        </Banner>
      );
    case 'insufficient-sol':
      return (
        <Banner tone="danger" title="Not enough SOL for the network fee">
          {f.detail === null ? undefined : <span className="noc-mono">{f.detail.slice(0, 240)}</span>}
        </Banner>
      );
    case 'split-balance': {
      // The engine's detail is the largest single holding, in base units (plan 3).
      const most = f.detail !== null && /^\d{1,20}$/.test(f.detail) ? `${showExact(token, BigInt(f.detail))} ${token}` : null;
      return (
        <Banner
          tone="danger"
          title={most === null ? 'This token is spread across several accounts in your wallet. Send less, or move it into one account first.' : `This token is spread across several accounts in your wallet. Send at most ${most}, or move it into one account first.`}
        />
      );
    }
    case 'insufficient-token':
      return <Banner tone="danger" title={`Not enough ${token} in this account.`} />;
    case 'sender-below-rent':
      return <Banner tone="danger" title={REVIEW_TEXT.senderBelowRent} />;
    case 'recipient-below-rent':
      return <Banner tone="danger" title={REVIEW_TEXT.recipientBelowRent} />;
    default:
      return <Banner tone="danger" title="Something went wrong while checking this transfer." />;
  }
}
```

Modify `extension/src/app/ui/ExtIcon.tsx`:

```diff
diff --git a/extension/src/app/ui/ExtIcon.tsx b/extension/src/app/ui/ExtIcon.tsx
index ff6d767..37240c0 100644
--- a/extension/src/app/ui/ExtIcon.tsx
+++ b/extension/src/app/ui/ExtIcon.tsx
@@ -35,7 +35,9 @@ export type ExtIconName =
   | 'swap'
   | 'arrow-right'
   | 'clip'
-  | 'alert';
+  | 'alert'
+  | 'cpu'
+  | 'check-circle';
 
 const PATHS: Record<ExtIconName, ReactNode> = {
   // Plan 3: #12's paste button (#i-clip) and its helper lines' glyph (#i-alert).
@@ -52,6 +54,27 @@ const PATHS: Record<ExtIconName, ReactNode> = {
       <line x1="12" y1="16" x2="12.01" y2="16" />
     </>
   ),
+  // #19's intent eyebrow: simulating (#i-cpu), passed (#i-check-circle).
+  cpu: (
+    <>
+      <rect x="4" y="4" width="16" height="16" rx="2" />
+      <rect x="9" y="9" width="6" height="6" />
+      <line x1="9" y1="2" x2="9" y2="4" />
+      <line x1="15" y1="2" x2="15" y2="4" />
+      <line x1="9" y1="20" x2="9" y2="22" />
+      <line x1="15" y1="20" x2="15" y2="22" />
+      <line x1="20" y1="9" x2="22" y2="9" />
+      <line x1="20" y1="14" x2="22" y2="14" />
+      <line x1="2" y1="9" x2="4" y2="9" />
+      <line x1="2" y1="14" x2="4" y2="14" />
+    </>
+  ),
+  'check-circle': (
+    <>
+      <circle cx="12" cy="12" r="10" />
+      <polyline points="9 12 12 15 17 9" />
+    </>
+  ),
   'arrow-right': (
     <>
       <path d="M5 12h14" />
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 13c6f81..2c9c58c 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1454,12 +1454,20 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
       again.";
     - `insufficient-sol`: "Not enough SOL for the network fee" + detail;
     - `insufficient-token` / `split-balance`: "This token is spread across several accounts in
-      your wallet. Send at most N, or move it into one account first." (split) / "Not enough
-      <TOKEN> in this account." (insufficient);
-    - `sender-below-rent`: "This would leave less than 0.00089088 SOL in your account. Keep at least
-      that much, or send everything.";
-    - `recipient-below-rent`: "A new Solana account needs at least 0.00089088 SOL. Send at least
-      that much.";
+      your wallet. Send at most N, or move it into one account first." (split; N is the largest single
+      holding, which the engine's refusal carries as its detail in base units since plan 3) / "Not
+      enough <TOKEN> in this account." (insufficient);
+    - `sender-below-rent` — the engine's own check before simulating, **and** a simulation the runtime
+      refused with `InsufficientFundsForRent` at the sender's index (§11.5; plan 3 maps it by the
+      account index, deciding on `err` alone): "This would leave less than 0.00089088 SOL in your
+      account, which Solana does not allow. Send less, so at least that much stays." — **controller
+      addition — awaiting the owner** (plan 3, carry 2; the review's wording): the draft's "or send everything" is dropped, since
+      MAX keeps the minimum and nothing on #12 sends everything;
+    - `recipient-below-rent` — refused before anything is simulated (a SOL send to an address with no
+      account, below 890 880 lamports), or the simulation's `InsufficientFundsForRent` at the
+      recipient's index: "This address has no Solana account yet. A new account needs at least
+      0.00089088 SOL, so send at least that much." — **controller addition — awaiting the owner**
+      (plan 3, carry 2);
     - `in-flight`: #12's pending banner;
     - `failed`: "Something went wrong while checking this transfer.";
     - `coordinator-refused`: the D26 banner (§7.2), and Retry disabled;
@@ -1471,6 +1479,16 @@ classes. Each vault-page state's copy is a literal in `src/unlock/strings.ts`.
     `wallet.discardPrepared {account}` (E7) first, so a prepared send and its challenge never
     outlive the review the user abandoned. Continuing to #20 keeps them.
 - **Differs:**
+  - **Plan 3:** the simulating footer reads "Noctura server · simulateTransaction" without "· N
+    instructions": the count is known only once the engine has built the message, which is what
+    `simulating` waits for. A failed state has no step pill (the design's "RPC drop · timed out 5.2 s"
+    names a timing the engine does not report); the eyebrow is "Couldn't simulate" (for `unreachable`,
+    "Could not reach the Noctura server", or "You're offline" when the browser says so) and the cause is
+    the danger banner below it. "After" is the balance the engine read less its own total
+    (`solRequiredLamports`): the simulated post-state, fee included whichever form the node answered in
+    (E2 accepts both). The last known state's age reads "9 min ago" (format.ts's one age form, as #11).
+    A zero Noctura fee's reason line has no amount. The recipient check's warning badge reads
+    "WARNING".
   - **`[Continue anyway]` removed (D21)**, and with it the design's "proceed at your own risk"
     wording.
   - "3 retries attempted · last error ETIMEDOUT after 5.2 s" replaced by the single cause line.
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/Review.test.tsx src/app/__tests__/harness.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 1 passed (1) · Tests 22 passed (22); tsc clean; whole suite Test Files 106 passed (106) · Tests 1869 passed (1869).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M8a** — `extension/src/app/screens/Review.tsx`:

  ```diff
  -         if (r.ok && left.current) void engine.discardPrepared(account);
  + (deleted)
  ```
  `npx vitest run src/app/__tests__/Review.test.tsx` — Expected: **red** (1 failed | 21 passed (22)).

- **M8b** — `extension/src/app/screens/Review.tsx`:

  ```diff
  -     run.current += 1;
  -     await engine.discardPrepared(account);
  -     onCancel();
  +     run.current += 1;
  +     onCancel();
  ```
  `npx vitest run src/app/__tests__/Review.test.tsx` — Expected: **red** (2 failed | 20 passed (22)).

- [ ] **Step 7: The §8 visual checklist for this screen.** Task 17 shoots every state of this screen; after it, the opus-tier reviewer checks them against index.html with the checklist in Task 17. Nothing to run here; the component tests above already assert every string.

- [ ] **Step 8: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/scripts/check-classes.mjs extension/src/app/__tests__/Review.test.tsx extension/src/app/__tests__/harness.tsx extension/src/app/app.css extension/src/app/screens/Review.tsx extension/src/app/ui/ExtIcon.tsx
git commit -F - <<'MSG'
feat(extension): #19 tx-simulate — the engine's simulation, every refusal's copy, and a cancel that discards (E7)

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 9: #20 tx-confirm: one tap per broadcast (D38), the quote's life and C5, the resume entry, the loop guard

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Create: `extension/src/app/__tests__/Confirm.test.tsx`
- Modify: `extension/src/app/__tests__/format.test.ts`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/format.ts`
- Modify: `extension/src/app/platform.ts`
- Modify: `extension/src/app/prefs.ts`
- Create: `extension/src/app/screens/Confirm.tsx`

**Interfaces:**
- Consumes: Tasks 3, 6, 8; `wallet.send`, `wallet.preparedFor`, `wallet.prepareSend` (carrying the challenge, D39), `wallet.discardPrepared`, `wallet.pending`; `platform.openPage`/`navigate`/`closeWindow`.
- Produces: `src/app/screens/Confirm.tsx` (`Confirm`, `CONFIRM_TEXT`); `platform.ts`'s `reauthPage(challengeId)`; `prefs.ts`'s `CONFIRM_STRIKE_KEY`.

Spec §4.5 and #s20 — the security core of the plan (carry 6):
- **`tap()` is the only way to `engine.send`, and only the Send button's `onPress` calls `tap()`.** `engine.send` sits in `send(view, tapAt)`, which only `tap()` calls. The source backstop (review M2) walks **all of `src/`** (tests aside): a `send(` method call other than the vault page's `deps.send` appears only in `screens/Confirm.tsx`, and the message name `wallet.send` — any quote, as an object-literal value (`send({type: 'wallet.send'})`) or bare — only in `src/background/` and `src/app/engine.ts`, with fixtures for each form and negative controls. It is the backstop; the behaviour tests and mutations are the proof. No effect, timer, resume or event sends.
- `reauth === null` or `reauth.proven` → one `wallet.send` → #21 on the record. An unproven view first re-reads `preparedFor` once (review L2: the challenge may have been proven from another surface since) and sends if the engine now says proven for this very prepared send — still one tap. Otherwise → #10 (`unlock.html?mode=reauth&challenge=<id>`): a new tab from the popup, which closes; the same tab in the UI tab. Nothing is sent.
- **The resume entry reads the prepared send only through `wallet.preparedFor`**; the hash only chose the screen. An expired one is re-prepared carrying its challenge (D39). "You have a send waiting." / "Confirmed. Review the fresh quote and send." — and nothing is sent until a tap (a 10 s untouched test across all entries asserts zero `wallet.send`).
- **C5:** at the quote's end it re-prepares once by itself ("Updated with a fresh network quote"); untouched, "Quote expired — refresh" disables Send beside `[Refresh]`; any pointer or key input allows one more. Not while a send from this account is open (review L1: the engine would answer `in-flight` and move an untouched #20 to #19).
- **A resume whose challenge died at C5's cap** (Task 3, review M1) is prepared again with a fresh challenge, and the tap opens #10 for that one — once, no loop (an end-to-end component test).
- The fee rows' dollars read "< $0.0001" below a hundredth of a cent, never "$0.0000" (review L3, `format.ts`'s `feeUsd`); a test parses the rendered rows and amount back to lamports and compares them with `solRequiredLamports` (review L4).
- The `reauth-required`-without-a-challengeId test drives the state, not the clock-call count (review M5): the challenge's life ends the moment `takePrepared` removes the prepared send, between the engine's peek and its consume.
- Every `wallet.send` answer: `check-pending` (→ #21 on its record, never "nothing sent"), `failed`, `prepared-expired` (fresh values, a new tap), `reauth-required` with a challengeId (the loop guard: first "did not carry over", the second time in a row → #12 with "Something went wrong — start the send again."; the strike survives the #10 round trip in `localStorage`, UI state only), without one (→ #19 "Your confirmation expired"), `unknown-prepared`/`in-flight` (a record made since → #21, else #19), `unreachable`, `coordinator-refused`, `locked`.
- **While a tap's send is in flight, [Cancel], the back arrow and Esc do nothing** (dry-run catch: a cancel there would discard nothing and show "No fees charged" over a broadcast).
- `[Cancel]` discards (E7) → #11's toast; a [Cancel] that lands during C5's re-prepare discards what that prepare makes (dry-run catch: M9f survived until the test was added). No autofocus; Enter does nothing. Tab-surface lines "…in this tab…" are **controller additions — awaiting the owner**.

- [ ] **Step 1: Write the failing tests.**

Create `extension/src/app/__tests__/Confirm.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {readFileSync, readdirSync, statSync} from 'node:fs';
import {dirname, join, relative, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sendingReader, setupWallet, type Wallet, type WalletOptions} from './harness';
import {CONFIRM_TEXT, Confirm} from '../screens/Confirm';
import {createEngine, type Intent} from '../engine';
import {WalletProvider, type Surface} from '../WalletContext';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {CONFIRM_STRIKE_KEY} from '../prefs';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {PENDING_KEY} from '../../background/pendingStore';
import {PREPARED_KEY} from '../../background/session';
import {CHALLENGE_MAX_LIFE_MS, satisfyChallenge} from '../../background/reauthChallenges';
import {firstSignature} from '../../../../core/solana/broadcast';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {COUNTERPARTY} from '../../../e2e/historyFixtures';

// Spec §4.5 (#20): one tap per broadcast (D38), the quote's life (D39, C5), the loop guard, R2-M2 and R2-M3.
// The background is the real one (handleMessage over an in-memory Ext) on the real clock, so the prepared send's
// 30 s life and the screen's countdown read the same time; fake timers move both.
const SELECTORS = selectorsOf(UI_SHEETS);
const SMALL: Intent = {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n};
const LARGE: Intent = {token: 'SOL', recipient: COUNTERPARTY, amount: 4_000_000_000n};
const nav = {onBack: vi.fn(), onCancelled: vi.fn(), onTrack: vi.fn(), onReview: vi.fn(), onStartAgain: vi.fn()};

interface Setup {
  intent?: Intent;
  known?: boolean;
  prove?: boolean;
  entry?: 'flow' | 'resume';
  surface?: Surface;
  prepare?: boolean;
  before?: WalletOptions['before'];
  /** After the prepare, before #20 is shown (a pending send written then would have refused the prepare). */
  afterPrepare?: (ext: Wallet['ext']) => Promise<void>;
  /** The background's broadcast (default: answers at once with the transaction's signature). */
  broadcast?: (wire: Uint8Array) => Promise<string>;
}
/** A wallet whose background holds a prepared send of `intent` (proven if asked), and #20 shown on it. */
async function renderConfirm(o: Setup = {}): Promise<Wallet & {sent: string[]; sends: () => number; challengeId: string | null}> {
  const sent: string[] = [];
  const w = await setupWallet({
    reader: sendingReader(),
    deps: {now: () => Date.now(), broadcast: o.broadcast ?? (async wire => firstSignature(wire))},
    before: async ext => {
      if (o.known !== false) await ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY]);
      await o.before?.(ext);
    },
  });
  let challengeId: string | null = null;
  if (o.prepare !== false) {
    const p = await w.engine.prepareSend(ACCOUNT.publicKey, o.intent ?? SMALL);
    if (!p.ok) throw new Error(`prepare: ${p.error}`);
    challengeId = p.data.reauth?.challengeId ?? null;
    if (o.prove === true && challengeId !== null) await satisfyChallenge(w.ext, Date.now(), challengeId);
  }
  await o.afterPrepare?.(w.ext);
  const engine = createEngine(m => {
    sent.push((m as {type: string}).type);
    return w.transport(m);
  }, async () => undefined);
  render(
    <WalletProvider engine={engine} platform={w.platform} surface={o.surface ?? 'popup'}>
      <Confirm account={ACCOUNT.publicKey} entry={o.entry ?? 'flow'} {...nav} />
    </WalletProvider>,
  );
  return {...w, engine, sent, sends: () => sent.filter(t => t === 'wallet.send').length, challengeId};
}
const sendButton = async () => (await screen.findByRole('button', {name: /^Send /})) as HTMLButtonElement;

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  localStorage.clear();
});

describe('#20 tx-confirm — what it shows', () => {
  it('default: headline, review card, From/To in full, Network, the fee rows with dollars and the Total, the quote; Send, Cancel', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    expect(screen.getByText('4 of 4')).toBeTruthy();
    const headline = document.querySelector('.headline') as HTMLElement;
    expect(headline.textContent).toBe(`Send 0.0100 SOL to ${COUNTERPARTY.match(/.{1,4}/g)?.join('')}`);
    expect(document.querySelector('.review-card .eyebrow')?.textContent).toBe(CONFIRM_TEXT.about);
    expect(document.querySelector('.review-card .fiat')?.textContent).toBe('≈ $1.50 USD');
    const detail = [...document.querySelectorAll('.detail-row')].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]);
    expect(detail).toEqual([
      ['From', `Main${ACCOUNT.publicKey}`],
      ['To', COUNTERPARTY],
      ['Network', CONFIRM_TEXT.network],
    ]);
    const fees = [...document.querySelectorAll('.fee-row')].map(r => [...r.children].map(c => c.textContent));
    expect(fees).toEqual([
      ['Network fee', '0.000005 SOL', '$0.0007'],
      ['Priority', '0.00000005 SOL', '< $0.0001'],
      ['No Noctura fee (status unknown)', '', ''],
      ['Total', '0.01000505 SOL', '$1.50'],
    ]);
    // Spec §4.5: the SOL rows and the amount add up to the engine's own total.
    const prepared = await w.engine.preparedFor(ACCOUNT.publicKey);
    expect(prepared.ok && prepared.data?.solRequiredLamports).toBe(10_000_000n + 5_000n + 50n);
    // …and so do the rows as RENDERED (review L4): a dropped or mis-shown row fails here, not only on #19.
    const lamports = (sol: string) => {
      const [whole, frac = ''] = sol.replace(/ SOL$/, '').split('.');
      return BigInt(whole ?? '0') * 1_000_000_000n + BigInt(frac.padEnd(9, '0'));
    };
    const rendered = [...document.querySelectorAll('.fee-row:not(.total) .val')].map(v => v.textContent ?? '').filter(t => t !== '');
    const shownAmount = lamports((document.querySelector('.review-card .head .amount')?.textContent ?? '') + ' SOL');
    expect(rendered.reduce((sum, t) => sum + lamports(t), shownAmount)).toBe(prepared.ok ? prepared.data?.solRequiredLamports : -1n);
    expect(document.querySelector('.app-quote')?.textContent).toMatch(/^Quote valid (29|30) s · slot 271 408 921$/);
    expect(send.textContent).toBe('Send 0.0100 SOL');
    expect(send.disabled).toBe(false);
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeTruthy();
    // Removed by decision: priority chips (D15), "Save as / Add to address book" (B1b-2b), typed CONFIRM (D22), DIRECT.
    expect(document.body.textContent).not.toMatch(/Normal|Fast|Instant|Save as|address book|Type CONFIRM|DIRECT|mainnet-beta/);
    expect(screen.queryByText(CONFIRM_TEXT.opensTab)).toBeNull();
    expect(unstyledClasses(document.querySelector('.s-conf')!, SELECTORS)).toEqual([]);
  });

  it('first-time recipient: its banner; under the CTA, "Confirmation opens in a new tab."', async () => {
    await renderConfirm({known: false});
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.firstTitle)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.firstLine)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.opensTab)).toBeTruthy();
    expect(document.querySelector('.review-card')?.classList.contains('high-value')).toBe(false);
    expect(unstyledClasses(document.querySelector('.s-conf')!, SELECTORS)).toEqual([]);
  });

  it('high-value: the red card, "High-value transfer", the share of the balance, the password line in place of the typed field', async () => {
    await renderConfirm({intent: LARGE});
    await sendButton();
    expect(document.querySelector('.review-card')?.classList.contains('high-value')).toBe(true);
    expect(document.querySelector('.review-card .eyebrow')?.textContent).toBe(CONFIRM_TEXT.highValue);
    // 4 SOL × $150; 4 of 62.4821 SOL = 6 %.
    expect(document.querySelector('.review-card .fiat')?.textContent).toBe('≈ $600.00 USD · 6 % of your balance');
    expect(screen.getByText(CONFIRM_TEXT.reauthLine)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.opensTab)).toBeTruthy();
    expect((await sendButton()).disabled).toBe(false);
    expect(unstyledClasses(document.querySelector('.s-conf')!, SELECTORS)).toEqual([]);
  });

  it('in the UI tab, the proof is taken in this tab: the lines say so (controller addition)', async () => {
    await renderConfirm({intent: LARGE, surface: 'tab'});
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.reauthLineTab)).toBeTruthy();
    expect(screen.getByText(CONFIRM_TEXT.opensHere)).toBeTruthy();
  });

  it('confirmed (a proven re-authentication): "Confirmed. Review the fresh quote and send." and no proof line; resume (unproven): "You have a send waiting."', async () => {
    await renderConfirm({known: false, prove: true, entry: 'resume'});
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.confirmed)).toBeTruthy();
    expect(screen.queryByText(CONFIRM_TEXT.opensTab)).toBeNull();
    cleanup();
    await renderConfirm({known: false, entry: 'resume'});
    await sendButton();
    expect(screen.getByText(CONFIRM_TEXT.resume)).toBeTruthy();
  });

  it('pending + the quote’s end: no automatic re-prepare (the engine would say in-flight) — #20 stays, untouched (review L1)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const record = pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
    const w = await renderConfirm({afterPrepare: ext => ext.local.set(PENDING_KEY, [record])});
    expect(await screen.findByText(CONFIRM_TEXT.pending)).toBeTruthy();
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(w.sent.filter(t => t === 'wallet.prepareSend')).toEqual([]);
    expect(nav.onReview).not.toHaveBeenCalled();
    expect(screen.getByText(CONFIRM_TEXT.pending)).toBeTruthy();
  });

  it('pending: a send from this account is open → Send disabled, and its press does nothing even with `disabled` lifted', async () => {
    const record = pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), createdAt: Date.now(), intent: {token: 'SOL', recipient: RECIPIENT, amount: '1'}});
    const w = await renderConfirm({afterPrepare: ext => ext.local.set(PENDING_KEY, [record])});
    expect(await screen.findByText(CONFIRM_TEXT.pending)).toBeTruthy();
    const send = await sendButton();
    expect(send.disabled).toBe(true);
    send.disabled = false;
    fireEvent.click(send);
    await act(async () => undefined);
    expect(w.sends()).toBe(0);
  });

  it('Send is never focused, and Enter does nothing — default, confirmed and resume (R2-L4)', async () => {
    for (const o of [{}, {known: false, prove: true, entry: 'resume' as const}, {entry: 'resume' as const}]) {
      cleanup();
      const w = await renderConfirm(o);
      const send = await sendButton();
      expect(document.activeElement).not.toBe(send);
      fireEvent.keyDown(document.activeElement ?? document.body, {key: 'Enter'});
      fireEvent.keyDown(document, {key: 'Enter'});
      await act(async () => undefined);
      expect(w.sends()).toBe(0);
    }
  });

  it('C5: at the quote’s end it re-prepares once by itself ("Updated…"), then, untouched, "Quote expired — refresh" — and no further prepare', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderConfirm();
    await sendButton();
    const prepares = () => w.sent.filter(t => t === 'wallet.prepareSend').length;
    await act(async () => void vi.advanceTimersByTime(30_000));
    await waitFor(() => expect(prepares()).toBe(1));
    expect(await screen.findByText(CONFIRM_TEXT.updated)).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(31_000));
    expect(await screen.findByText(CONFIRM_TEXT.quoteExpired, {exact: false})).toBeTruthy();
    expect((await sendButton()).disabled).toBe(true);
    await act(async () => void vi.advanceTimersByTime(120_000));
    expect(prepares()).toBe(1);
    expect(w.sends()).toBe(0);
    // [Refresh] is a tap: one prepare, and an activity.ping.
    fireEvent.click(screen.getByRole('button', {name: CONFIRM_TEXT.refresh}));
    await waitFor(() => expect(prepares()).toBe(2));
    expect(w.sent).toContain('activity.ping');
    await waitFor(() => expect(document.querySelector('.app-quote')?.textContent).toMatch(/^Quote valid/));
  });

  it('any input since the automatic re-prepare allows one more (C5: "with no input since")', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderConfirm();
    await sendButton();
    const prepares = () => w.sent.filter(t => t === 'wallet.prepareSend').length;
    await act(async () => void vi.advanceTimersByTime(30_000));
    await waitFor(() => expect(prepares()).toBe(1));
    fireEvent.pointerDown(document.body);
    await act(async () => void vi.advanceTimersByTime(31_000));
    await waitFor(() => expect(prepares()).toBe(2));
    expect(screen.queryByText(CONFIRM_TEXT.quoteExpired, {exact: false})).toBeNull();
  });

  it('a resumed send whose quote expired is prepared again carrying its challenge (D39) — then shown', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}});
    const first = await w.engine.prepareSend(ACCOUNT.publicKey, SMALL);
    const challengeId = first.ok ? first.data.reauth?.challengeId : null;
    vi.advanceTimersByTime(31_000);
    const asked: unknown[] = [];
    const engine = createEngine(m => {
      if ((m as {type: string}).type === 'wallet.prepareSend') asked.push((m as {challengeId?: unknown}).challengeId);
      return w.transport(m);
    }, async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="tab">
        <Confirm account={ACCOUNT.publicKey} entry="resume" {...nav} />
      </WalletProvider>,
    );
    await sendButton();
    expect(asked).toEqual([challengeId]);
    expect(challengeId).toMatch(/^[0-9a-f]{32}$/);
  });

  it('[Cancel] while the quote’s end prepares it again (C5): the send that prepare makes is discarded too (E7) — nothing left', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}, before: ext => ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY])});
    expect((await w.engine.prepareSend(ACCOUNT.publicKey, SMALL)).ok).toBe(true);
    let holding = false;
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const asked: string[] = [];
    const engine = createEngine(async m => {
      if ((m as {type: string}).type === 'wallet.prepareSend' && holding) {
        asked.push('prepareSend');
        await held;
      }
      return w.transport(m);
    }, async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Confirm account={ACCOUNT.publicKey} entry="flow" {...nav} />
      </WalletProvider>,
    );
    await sendButton();
    holding = true;
    await act(async () => {
      vi.advanceTimersByTime(31_000);
    });
    await waitFor(() => expect(asked).toEqual(['prepareSend']));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(nav.onCancelled).toHaveBeenCalledTimes(1));
    release();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    await waitFor(async () => expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null}));
  });

  it('a resume whose challenge passed C5’s 10-minute cap (the send itself young): prepared again with a fresh challenge, the tap opens #10 for THAT one — once, no loop, nothing sent (review M1)', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}});
    const start = Date.now();
    const first = await w.engine.prepareSend(ACCOUNT.publicKey, SMALL);
    const old = first.ok ? (first.data.reauth?.challengeId ?? '') : '';
    await satisfyChallenge(w.ext, Date.now(), old);
    // Kept alive by re-prepares carrying it (each rebases it), the last 10 s before the cap.
    while (Date.now() + 100_000 < start + CHALLENGE_MAX_LIFE_MS - 10_000) {
      vi.advanceTimersByTime(100_000);
      expect((await w.engine.prepareSend(ACCOUNT.publicKey, SMALL, old)).ok).toBe(true);
    }
    vi.advanceTimersByTime(start + CHALLENGE_MAX_LIFE_MS - 10_000 - Date.now());
    expect((await w.engine.prepareSend(ACCOUNT.publicKey, SMALL, old)).ok).toBe(true);
    vi.advanceTimersByTime(20_000);
    const asked: unknown[] = [];
    const sent: string[] = [];
    const engine = createEngine(m => {
      const type = (m as {type: string}).type;
      sent.push(type);
      if (type === 'wallet.prepareSend') asked.push((m as {challengeId?: unknown}).challengeId);
      return w.transport(m);
    }, async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="popup">
        <Confirm account={ACCOUNT.publicKey} entry="resume" {...nav} />
      </WalletProvider>,
    );
    const send = await sendButton();
    expect(asked).toEqual([old]);
    const now = await w.engine.preparedFor(ACCOUNT.publicKey);
    const fresh = now.ok ? now.data?.reauth?.challengeId : undefined;
    expect(fresh).toMatch(/^[0-9a-f]{32}$/);
    expect(fresh).not.toBe(old);
    expect(screen.queryByText(CONFIRM_TEXT.confirmed)).toBeNull();
    fireEvent.click(send);
    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${fresh}`]));
    await act(async () => {
      vi.advanceTimersByTime(5_000);
    });
    expect(asked).toEqual([old]);
    expect(sent.filter(t => t === 'wallet.send')).toEqual([]);
  });

  it('nothing to resume (discarded, or gone with its challenge): the flow starts at #12', async () => {
    await renderConfirm({prepare: false, entry: 'resume'});
    await waitFor(() => expect(nav.onStartAgain).toHaveBeenCalledWith(null));
  });

  it('[Cancel] discards the prepared send and its challenge (E7), then #11 — once; the back arrow and Esc keep it', async () => {
    const w = await renderConfirm({known: false});
    await sendButton();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    await waitFor(() => expect(nav.onCancelled).toHaveBeenCalledTimes(1));
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
    cleanup();
    const v = await renderConfirm();
    await sendButton();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(nav.onBack).toHaveBeenCalledWith(SMALL);
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(nav.onBack).toHaveBeenCalledTimes(1);
    expect((await v.engine.preparedFor(ACCOUNT.publicKey)).ok).toBe(true);
    expect(v.sent.filter(t => t === 'wallet.discardPrepared')).toEqual([]);
  });
});

describe('#20 — one tap per broadcast (D38) and every answer of wallet.send', () => {
  it('reauth null: one tap → one wallet.send → #21 on that record; a second press inside the lock does nothing (rule 6, `disabled` lifted)', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    const before = Date.now();
    fireEvent.click(send);
    send.disabled = false;
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(1);
    const [id, tapAt] = nav.onTrack.mock.calls[0] as [string, number];
    const pending = await w.engine.pending();
    expect(pending.ok && pending.data.map(p => [p.id, p.state])).toEqual([[id, 'pending']]);
    expect(tapAt).toBeGreaterThanOrEqual(before);
    expect(localStorage.getItem(CONFIRM_STRIKE_KEY) ?? '').toBe('');
  });

  it('while the tap’s send is in flight, [Cancel] (`disabled` lifted), the back arrow and Esc do nothing: no "cancelled, no fees" over a broadcast', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const w = await renderConfirm({
      broadcast: async wire => {
        await held;
        return firstSignature(wire);
      },
    });
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.sends()).toBe(1));
    const cancel = screen.getByRole('button', {name: 'Cancel'}) as HTMLButtonElement;
    await waitFor(() => expect(cancel.disabled).toBe(true));
    cancel.disabled = false;
    fireEvent.click(cancel);
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    release();
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(nav.onCancelled).not.toHaveBeenCalled();
    expect(nav.onBack).not.toHaveBeenCalled();
    expect(w.sent.filter(t => t === 'wallet.discardPrepared')).toEqual([]);
  });

  it('an unproven challenge: the tap opens #10 for it — a new tab from the popup (which closes), this tab in the UI tab — and sends nothing', async () => {
    const w = await renderConfirm({known: false});
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${w.challengeId}`]));
    expect(w.platform.closed).toBe(1);
    expect(w.sends()).toBe(0);
    cleanup();
    const t = await renderConfirm({known: false, surface: 'tab'});
    fireEvent.click(await sendButton());
    await waitFor(() => expect(t.platform.navigated).toEqual([`unlock.html?mode=reauth&challenge=${t.challengeId}`]));
    expect(t.platform.opened).toEqual([]);
    expect(t.sends()).toBe(0);
  });

  it('a stale unproven view (proven from another surface since #20 read it): the one tap re-reads, then sends — no second #10 (review L2)', async () => {
    const w = await renderConfirm({known: false});
    const send = await sendButton();
    expect(screen.queryByText(CONFIRM_TEXT.confirmed)).toBeNull();
    await satisfyChallenge(w.ext, Date.now(), w.challengeId ?? '');
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(1);
    expect(w.platform.opened).toEqual([]);
  });

  it('a proven challenge: the tap sends — no second re-authentication', async () => {
    const w = await renderConfirm({known: false, prove: true, entry: 'resume'});
    fireEvent.click(await sendButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(1);
    expect(w.platform.opened).toEqual([]);
  });

  it('no resume sends before a tap: reauth null, proven, resumed after expiry, opened as the tab — 10 s untouched, zero wallet.send', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    for (const o of [{entry: 'resume' as const}, {known: false, prove: true, entry: 'resume' as const}, {entry: 'resume' as const, surface: 'tab' as const}]) {
      cleanup();
      const w = await renderConfirm(o);
      await sendButton();
      await act(async () => void vi.advanceTimersByTime(10_000));
      expect(w.sends()).toBe(0);
      fireEvent.click(await sendButton());
      await waitFor(() => expect(w.sends()).toBe(1));
    }
  });

  it('prepared-expired after the tap: fresh values and "Updated with a fresh network quote — review and send" — and no second send without a second tap', async () => {
    const w = await renderConfirm({known: false, prove: true});
    const send = await sendButton();
    // The quote ends between the tap and the engine taking it: the background's clock is 30 s on.
    const offset = {ms: 0};
    w.deps.now = () => Date.now() + offset.ms;
    offset.ms = 30_000;
    fireEvent.click(send);
    expect(await screen.findByText(CONFIRM_TEXT.updatedReview)).toBeTruthy();
    expect(w.sends()).toBe(1);
    expect(w.sent.filter(t => t === 'wallet.prepareSend').length).toBe(1);
    await act(async () => new Promise(r => setTimeout(r, 600)));
    expect(w.sends()).toBe(1);
    fireEvent.click(await sendButton());
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(w.sends()).toBe(2);
  });

  it('reauth-required WITH a challengeId (the proof lapsed): "did not carry over", the next tap opens #10; the same strike twice → #12 with the draft', async () => {
    const w = await renderConfirm({known: false, prove: true, entry: 'resume'});
    const send = await sendButton();
    // The proof lapses: the challenge is no longer satisfied when the tap reaches the engine.
    const store = (await w.ext.session.get('v1_reauth')) as Record<string, {satisfied: boolean}>;
    await w.ext.session.set('v1_reauth', Object.fromEntries(Object.entries(store).map(([k, c]) => [k, {...c, satisfied: false}])));
    fireEvent.click(send);
    expect(await screen.findByText(CONFIRM_TEXT.notCarried)).toBeTruthy();
    expect(localStorage.getItem(CONFIRM_STRIKE_KEY)).toBe(w.challengeId);
    expect(w.platform.opened).toEqual([]);
    await act(async () => new Promise(r => setTimeout(r, 600)));
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.platform.opened).toEqual([`unlock.html?mode=reauth&challenge=${w.challengeId}`]));
    expect(w.sends()).toBe(1);
    // Back from #10 (a new #20), and the same confirmation does not carry over again: stop, #12 with the draft.
    cleanup();
    await satisfyChallenge(w.ext, Date.now(), w.challengeId ?? '');
    const engine = createEngine(m => w.transport(m), async () => undefined);
    render(
      <WalletProvider engine={engine} platform={w.platform} surface="tab">
        <Confirm account={ACCOUNT.publicKey} entry="resume" {...nav} />
      </WalletProvider>,
    );
    const again = await sendButton();
    const s2 = (await w.ext.session.get('v1_reauth')) as Record<string, {satisfied: boolean}>;
    await w.ext.session.set('v1_reauth', Object.fromEntries(Object.entries(s2).map(([k, c]) => [k, {...c, satisfied: false}])));
    fireEvent.click(again);
    await waitFor(() => expect(nav.onStartAgain).toHaveBeenCalledWith({token: 'SOL', recipient: COUNTERPARTY, amount: '0.01'}));
    expect(localStorage.getItem(CONFIRM_STRIKE_KEY)).toBe('');
  });

  it('reauth-required WITHOUT a challengeId (the engine consumed the send against a proof past its life, R2-M3): back to #19 with "Your confirmation expired"', async () => {
    const w = await renderConfirm({known: false, prove: true});
    const send = await sendButton();
    // The real background, driven by its state (review M5): the proof holds when sendPrepared peeks; the moment
    // takePrepared removes the prepared send — between the peek and consumeChallenge — the challenge's life ends.
    const area = w.ext.session;
    const write = area.set.bind(area);
    let armed = true;
    area.set = async (key, value) => {
      await write(key, value);
      if (key !== PREPARED_KEY || !armed) return;
      armed = false;
      const store = (await area.get('v1_reauth')) as Record<string, {expiresAt: number}>;
      await write('v1_reauth', Object.fromEntries(Object.entries(store).map(([k, c]) => [k, {...c, expiresAt: Date.now() - 1}])));
    };
    fireEvent.click(send);
    await waitFor(() => expect(nav.onReview).toHaveBeenCalledWith(SMALL, 'confirmation-expired'));
    expect(await w.engine.pending()).toEqual({ok: true, data: []});
  });

  it('check-pending (recorded, maybe broadcast): #21 tracks the record it names — never "nothing sent"', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    let writes = 0;
    const set = w.ext.local.set;
    w.ext.local.set = async (k, v) => {
      if (k === PENDING_KEY && ++writes >= 2) throw new Error('storage hiccup');
      return set(k, v);
    };
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    const [id] = nav.onTrack.mock.calls[0] as [string | null, number];
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });

  it('failed (nothing could be recorded, or nothing read back): #21 looks for this account’s record from the tap on', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    w.ext.local.set = async () => {
      throw new Error('storage down');
    };
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledWith(null, expect.any(Number)));
  });

  it('unknown-prepared after a tap with a record made since #20 was shown (another window sent it): #21 on that record, not #19 (R2-M2)', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    const other = await w.engine.preparedFor(ACCOUNT.publicKey);
    const elsewhere = other.ok && other.data !== null ? await w.engine.send(other.data.id) : null;
    fireEvent.click(send);
    await waitFor(() => expect(nav.onTrack).toHaveBeenCalledTimes(1));
    expect(nav.onTrack.mock.calls[0]?.[0]).toBe(elsewhere?.ok ? elsewhere.data.id : 'none');
    expect(nav.onReview).not.toHaveBeenCalled();
  });

  it('unknown-prepared with no record (discarded elsewhere): back to #19 for a fresh prepare', async () => {
    const w = await renderConfirm();
    const send = await sendButton();
    await w.engine.discardPrepared(ACCOUNT.publicKey);
    fireEvent.click(send);
    await waitFor(() => expect(nav.onReview).toHaveBeenCalledWith(SMALL, null));
    expect(nav.onTrack).not.toHaveBeenCalled();
  });
});

// Carry 6 (D38): #20's tap() is the only caller of engine.send in the UI, and tap is wired to one Send button —
// a source backstop beside the behavioural tests above (which an auto-send effect fails).
// The backstop, not the proof (the behaviour tests and mutations above are): over the WHOLE of src/ (tests aside),
// a call to a `send` method other than the vault page's `deps.send` appears only in #20's tap(), and the message
// name `wallet.send` — in any quote, as an object-literal value or bare — only in the background and in the UI
// engine's one client method. Not a security gate on its own (review M2): string assembly would defeat any scan.
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
function sendSites(files: {path: string; text: string}[]): string[] {
  const out: string[] = [];
  for (const {path, text} of files) {
    const code = strip(text);
    const calls = [...code.matchAll(/(\w+)?\s*(?:\.\s*send|\[\s*['"`]send['"`]\s*\])\s*\(/g)].filter(m => m[1] !== 'deps');
    if (calls.length > 0 && path !== 'app/screens/Confirm.tsx') out.push(`${path}: a send( call`);
    const named = /wallet\.send\b/.test(code);
    if (named && !path.startsWith('background/') && path !== 'app/engine.ts') out.push(`${path}: names wallet.send`);
  }
  return out;
}

describe('one caller of wallet.send (source backstop over all of src/)', () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap(e => {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) return e === '__tests__' ? [] : files(p);
      return /\.(ts|tsx|mjs|js)$/.test(e) ? [p] : [];
    });
  it('fixtures: each form outside its two homes is caught; the vault page’s deps.send, the background and comments are not', () => {
    expect(sendSites([{path: 'unlock/screens/x.ts', text: "await deps.send({type:'wallet.send', id})"}])).toEqual(['unlock/screens/x.ts: names wallet.send']);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: 'void engine.send(id);'}])).toEqual(['app/screens/Home.tsx: a send( call']);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: "void engine['send'](id);"}])).toEqual(['app/screens/Home.tsx: a send( call']);
    expect(sendSites([{path: 'app/ui/x.tsx', text: 'chrome.runtime.sendMessage({type: "wallet.send", id})'}])).toEqual(['app/ui/x.tsx: names wallet.send']);
    expect(sendSites([{path: 'shared/x.ts', text: 'const t = `wallet.send`;'}])).toEqual(['shared/x.ts: names wallet.send']);
    // Negative controls.
    expect(sendSites([{path: 'unlock/reauthFlow.ts', text: "const r = await deps.send({type: 'vault.reauthOk', challengeId});"}])).toEqual([]);
    expect(sendSites([{path: 'background/walletApi.ts', text: "case 'wallet.send': {"}])).toEqual([]);
    expect(sendSites([{path: 'app/engine.ts', text: "send: id => call({type: 'wallet.send', id}, SEND, pendingOf),"}])).toEqual([]);
    expect(sendSites([{path: 'app/screens/Home.tsx', text: '// never wallet.send here; engine.send(x) is #20’s\n/* engine.send(y) */'}])).toEqual([]);
  });

  it('the real tree: engine.send( only in screens/Confirm.tsx inside tap(), tap only the Send button’s onPress; wallet.send named only in background/ and app/engine.ts', () => {
    const all = files(SRC).map(p => ({path: relative(SRC, p), text: readFileSync(p, 'utf8')}));
    // Positive control: the walk reads the real tree, the vault page and the background included.
    expect(all.map(f => f.path)).toEqual(expect.arrayContaining(['app/screens/Confirm.tsx', 'app/engine.ts', 'unlock/reauthFlow.ts', 'background/walletApi.ts']));
    expect(sendSites(all)).toEqual([]);
    const confirm = strip(readFileSync(resolve(SRC, 'app/screens/Confirm.tsx'), 'utf8'));
    expect([...confirm.matchAll(/\.send\(/g)]).toHaveLength(1);
    const body = confirm.slice(confirm.indexOf('const tap = async () => {'), confirm.indexOf('const refused ='));
    expect(body).toContain('engine.send(view.id)');
    // engine.send sits in `send`, which only tap() calls (twice: the proven-now path and the plain one).
    const tapBody = confirm.slice(confirm.indexOf('const tap = async () => {'), confirm.indexOf('const send = async'));
    expect([...confirm.matchAll(/\bsend\(view, tapAt\)/g)].length).toBe(2);
    expect([...tapBody.matchAll(/\bsend\(view, tapAt\)/g)].length).toBe(2);
    expect([...confirm.matchAll(/\btap\b/g)].length).toBe(2);
    expect(confirm).toContain('onPress={tap}');
  });
});
```

Modify `extension/src/app/__tests__/format.test.ts`:

```diff
diff --git a/extension/src/app/__tests__/format.test.ts b/extension/src/app/__tests__/format.test.ts
index 196c85c..932196a 100644
--- a/extension/src/app/__tests__/format.test.ts
+++ b/extension/src/app/__tests__/format.test.ts
@@ -34,6 +34,9 @@ describe('format', () => {
     expect(feeUsd(0.00075)).toBe('$0.0007');
     expect(feeUsd(0.0123)).toBe('$0.01');
     expect(feeUsd(null)).toBe('—');
+    // A fee that is not zero never reads as $0.0000 (plan-3 review L3); zero itself does.
+    expect(feeUsd(0.0000075)).toBe('< $0.0001');
+    expect(feeUsd(0)).toBe('$0.0000');
   });
 
   it('the hero’s dollars and cents, floored', () => {
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/Confirm.test.tsx src/app/__tests__/format.test.ts
```
Expected (dry run): FAIL — Test Files 2 failed (2) · Tests 1 failed | 8 passed (9) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 634c7d6..72cff72 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -610,3 +610,29 @@ a.btn {
 .s-sim .delta-row.app-after .lbl {
   color: var(--fg-secondary);
 }
+
+/* #20 confirm (plan 3): index.html #s20's inline styles — the quote line (11/14, --fg-tertiary, centred, tabular),
+   the first-time banner's title on its own line and its caption in --fg-secondary, the high-value eyebrow in
+   --danger — and the From/To values as a name over the address in groups of four. */
+.app-quote {
+  font-size: 11px;
+  line-height: 14px;
+  color: var(--fg-tertiary);
+  padding: var(--space-2);
+  text-align: center;
+}
+.s-conf .first-time-banner .app-block {
+  display: block;
+  margin-bottom: 2px;
+}
+.s-conf .first-time-banner .app-secondary {
+  color: var(--fg-secondary);
+}
+.s-conf .review-card.high-value .eyebrow {
+  color: var(--danger);
+}
+.s-conf .detail-row .val.app-stack {
+  display: flex;
+  flex-direction: column;
+  gap: 2px;
+}
```

Modify `extension/src/app/format.ts`:

```diff
diff --git a/extension/src/app/format.ts b/extension/src/app/format.ts
index ae72ae3..09c9e56 100644
--- a/extension/src/app/format.ts
+++ b/extension/src/app/format.ts
@@ -29,6 +29,8 @@ export function showFee(lamports: bigint): string {
 export function feeUsd(usd: number | null): string {
   if (usd === null) return '—';
   if (usd >= 0.01) return showUsd(usd);
+  // Below a hundredth of a cent the four places would read "$0.0000" for a fee that is not zero (plan-3 review L3).
+  if (usd > 0 && usd < 0.0001) return '< $0.0001';
   return `$${(Math.floor(usd * 10_000 + 1e-9) / 10_000).toFixed(4)}`;
 }
```

Modify `extension/src/app/platform.ts`:

```diff
diff --git a/extension/src/app/platform.ts b/extension/src/app/platform.ts
index 6802cfd..2bd0078 100644
--- a/extension/src/app/platform.ts
+++ b/extension/src/app/platform.ts
@@ -17,7 +17,16 @@ export type ExtensionPage =
   | 'unlock.html?mode=accounts'
   | 'unlock.html?mode=unlock&return=created'
   | 'unlock.html?mode=unlock&return=imported'
-  | 'unlock.html?mode=import&source=retry';
+  | 'unlock.html?mode=import&source=retry'
+  | `unlock.html?mode=reauth&challenge=${string}`;
+
+/**
+ * #20's re-authentication page (spec §4.5 step 2): the one page built from data — a challenge id, checked as 32
+ * lowercase hex first (what the background issues). Anything else is null: no page opens.
+ */
+export function reauthPage(challengeId: string): ExtensionPage | null {
+  return /^[0-9a-f]{32}$/.test(challengeId) ? `unlock.html?mode=reauth&challenge=${challengeId}` : null;
+}
 
 export interface Platform {
   /** A new tab (the popup closes itself after). */
```

Modify `extension/src/app/prefs.ts`:

```diff
diff --git a/extension/src/app/prefs.ts b/extension/src/app/prefs.ts
index 3f30cee..c44ff0d 100644
--- a/extension/src/app/prefs.ts
+++ b/extension/src/app/prefs.ts
@@ -4,6 +4,12 @@
  */
 export const HIDE_BALANCES_KEY = 'noctura.ui.v1.hideBalances';
 export const ACTIVITY_FILTER_KEY = 'noctura.ui.v1.activityFilter';
+/**
+ * #20's loop guard (spec §4.5, §7.7, plan 3): the challenge whose confirmation did not carry over once. UI state
+ * with no security meaning — losing it only lets the guard show its first line again; it can never send anything.
+ * In localStorage because the round trip through #10 may close the popup that saw the first strike.
+ */
+export const CONFIRM_STRIKE_KEY = 'noctura.ui.v1.confirmStrike';
 
 export function readPref(key: string): string | null {
   try {
```

Create `extension/src/app/screens/Confirm.tsx`:

```tsx
import {useCallback, useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {feeUsd, showUsd} from '../format';
import {draftOf, feeRows, percentOf, showExact, showLamports, usdOf, type Draft} from '../send/rules';
import {reauthPage} from '../platform';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {TopBar} from '../ui/TopBar';
import {ExtIcon} from '../ui/ExtIcon';
import {Banner, RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import {CONFIRM_STRIKE_KEY, readPref, writePref} from '../prefs';
import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
import type {Intent, Pending, Prices, Resumable} from '../engine';

/** The fixed strings #20 shows (spec §4.5); adapted ones are marked there. */
export const CONFIRM_TEXT = {
  title: 'Confirm send',
  step: '4 of 4',
  about: 'You are about to send',
  highValue: 'High-value transfer',
  network: "Solana mainnet · sent through Noctura's broadcast route",
  firstTitle: "You've never sent to this address",
  firstLine: 'First-time recipient · check the whole address below, group by group, against what you expect.',
  confirmed: 'Confirmed. Review the fresh quote and send.',
  resume: 'You have a send waiting.',
  updated: 'Updated with a fresh network quote',
  updatedReview: 'Updated with a fresh network quote — review and send',
  notCarried: 'Your confirmation did not carry over. Confirm again.',
  quoteExpired: 'Quote expired — refresh',
  refresh: 'Refresh',
  pending: 'A send from this account is still pending.',
  cancel: 'Cancel',
  /** D22, in the popup: the proof is taken by #10 in a tab of its own. */
  reauthLine: "You'll confirm with your password (or passkey) in a new tab before this is sent.",
  /** Controller addition (plan 3; owner to confirm): #20 in the UI tab hands over to #10 in the same tab. */
  /** Controller addition — awaiting the owner (plan 3): in the UI tab #10 opens in this same tab. */
  reauthLineTab: "You'll confirm with your password (or passkey) in this tab before this is sent.",
  /** D12, under the CTA. */
  opensTab: 'Confirmation opens in a new tab.',
  /** Controller addition (plan 3; owner to confirm): the same, from the UI tab. */
  /** Controller addition — awaiting the owner (plan 3): as above. */
  opensHere: 'Confirmation opens in this tab.',
} as const;

const HEX32 = /^[0-9a-f]{32}$/;
type Notice = 'updated' | 'updated-review' | 'not-carried' | null;

/**
 * #20 tx-confirm (spec §4.5, the one statement of resume and re-authentication). What it shows comes from the
 * background only — `wallet.preparedFor` on every entry (from #19, a reopened popup, or the UI tab's resume route),
 * and a fresh `wallet.prepareSend` when that quote has expired, carrying the challenge (D39). **One user tap per
 * broadcast (D38):** `wallet.send` is called from `tap()` and nowhere else, and `tap()` runs only from the Send
 * button's click; a refusal that needs new values (prepared-expired, a re-authentication) shows them and waits for
 * a new tap. Send is never focused (R2-L4). The quote's end re-prepares by itself at most once without user input
 * (C5); after that "Quote expired — refresh", and the refresh is a tap.
 */
export function Confirm({
  account,
  entry,
  onBack,
  onCancelled,
  onTrack,
  onReview,
  onStartAgain,
}: {
  account: string;
  entry: 'flow' | 'resume';
  /** The back arrow and Esc: back to #19 with the prepared send kept (not a cancel). */
  onBack: (intent: Intent) => void;
  /** [Cancel] discarded the prepared send (E7): #11 with "Transaction cancelled. No fees charged.". */
  onCancelled: () => void;
  /** A send went out (or may have): #21 tracking this pending id, or — null — the one created at or after `tapAt`. */
  onTrack: (id: string | null, tapAt: number) => void;
  /** Back to #19 for a fresh prepare of the intent — or, with no intent (nothing to resume), #12 from scratch. */
  onReview: (intent: Intent, notice: 'confirmation-expired' | null) => void;
  /** #12 with the draft and "Something went wrong — start the send again." (the loop guard's second strike). */
  onStartAgain: (draft: Draft | null) => void;
}) {
  const m = useWallet();
  const {engine, platform, reload, report, now: clock, surface} = m;
  const [view, setView] = useState<Resumable | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [open, setOpen] = useState<Pending | null>(null);
  const [ownPrices, setOwnPrices] = useState<Prices | null>(null);
  const [quoteDead, setQuoteDead] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * A tap's wallet.send is in flight: [Cancel], the back arrow and Esc do nothing until it answers — a cancel then
   * would discard nothing (the send holds the prepared send) and say "No fees charged" over a broadcast.
   */
  const sending = useRef(false);
  const [inFlight, setInFlight] = useState(false);
  const now = useNow(1_000, clock);
  /** The screen was left: anything a prepare in flight makes afterwards is discarded (Cancel) or dropped. */
  const left = useRef(false);
  const cancelled = useRef(false);
  /** C5: the quote's end may re-prepare by itself this many more times; any user input gives it one back. */
  const auto = useRef(1);
  /** When #20 was first shown: an `unknown-prepared` after a tap looks for a pending record from then on (R2-M2). */
  const shownAt = useRef(clock());

  const apply = useCallback((v: Resumable) => {
    setView(v);
    setQuoteDead(false);
  }, []);

  /** A fresh prepare of the intent, carrying the challenge (D39). Null when the screen was left or it was refused. */
  const reprepare = useCallback(
    async (intent: Intent, challengeId: string | undefined): Promise<boolean> => {
      setBusy(true);
      const r = await engine.prepareSend(account, intent, challengeId);
      setBusy(false);
      if (left.current) {
        // E7: a [Cancel] that landed while this prepared must leave nothing behind.
        if (r.ok && cancelled.current) void engine.discardPrepared(account);
        return false;
      }
      if (r.ok) {
        apply({...r.data, intent, expired: false});
        return true;
      }
      if (r.error === 'locked') void reload();
      else if (r.error === 'coordinator-refused' || r.error === 'unreachable') report(r.error);
      // Any refusal is #19's to show, with its own copy and nothing to continue (§4.4).
      if (r.error !== 'locked') onReview(intent, null);
      return false;
    },
    [account, engine, apply, reload, report, onReview],
  );

  useEffect(() => {
    left.current = false;
    void (async () => {
      const r = await engine.preparedFor(account);
      if (left.current) return;
      if (!r.ok || r.data === null) {
        // Nothing to resume (gone with its challenge, discarded, or after a lock): the flow starts at #12 (§7.4).
        onStartAgain(null);
        return;
      }
      const v = r.data;
      if (v.expired) await reprepare(v.intent, v.reauth?.challengeId);
      else apply(v);
      const p = await engine.pending();
      if (!left.current && p.ok) setOpen(p.data.find(x => x.account === account && (x.state === 'pending' || x.state === 'stuck')) ?? null);
      if (!left.current && m.prices === null) {
        const pr = await engine.prices();
        if (!left.current && pr.ok) setOwnPrices(pr.data);
      }
    })();
    return () => {
      left.current = true;
    };
    // Read once per mount: the account is this route's.
  }, [account, engine]);

  // C5: any user input since the last automatic re-prepare allows one more.
  useEffect(() => {
    const input = () => {
      auto.current = 1;
    };
    document.addEventListener('pointerdown', input);
    document.addEventListener('keydown', input);
    return () => {
      document.removeEventListener('pointerdown', input);
      document.removeEventListener('keydown', input);
    };
  }, []);

  // The quote's end (the 30 s prepared life, D39): re-prepare once by itself, then wait for [Refresh] (C5).
  const expiredNow = view !== null && now >= view.validUntil;
  useEffect(() => {
    // While a send from this account is open the engine would answer `in-flight` and move an untouched #20 to #19;
    // Send is disabled anyway, so the quote waits (plan-3 review L1).
    if (!expiredNow || view === null || busy || quoteDead || open !== null) return;
    if (auto.current <= 0) {
      setQuoteDead(true);
      return;
    }
    auto.current -= 1;
    void reprepare(view.intent, view.reauth?.challengeId).then(ok => {
      if (ok) setNotice('updated');
    });
  }, [expiredNow, view, busy, quoteDead, open, reprepare]);

  const refresh = async () => {
    if (view === null) return;
    auto.current = 1;
    void engine.ping();
    if (await reprepare(view.intent, view.reauth?.challengeId)) setNotice('updated');
  };

  const back = () => {
    if (view === null || left.current || sending.current) return;
    left.current = true;
    onBack(view.intent);
  };
  useEscape(back);

  const cancelling = useRef(false);
  const cancel = async () => {
    if (cancelling.current || sending.current) return;
    cancelling.current = true;
    left.current = true;
    cancelled.current = true;
    await engine.discardPrepared(account);
    onCancelled();
  };

  /** The pending record a send that was refused after the tap may still have made (R2-M2), or null. */
  const madeSince = async (since: number): Promise<Pending | null> => {
    const p = await engine.pending();
    if (!p.ok) return null;
    return p.data.find(x => x.account === account && (x.createdAt >= since || x.state === 'pending' || x.state === 'stuck')) ?? null;
  };

  /**
   * The Send button's click — and the ONLY caller of engine.send (D38; links.test.ts and Confirm.test.tsx hold it to
   * that). An unproven challenge opens #10 instead (spec §4.5 step 2).
   */
  const tap = async () => {
    if (view === null || busy || quoteDead) return;
    const tapAt = clock();
    if (view.reauth !== null && !view.reauth.proven) {
      // The view may be stale: the challenge proven from another surface since this #20 read it (plan-3 review L2).
      // Read once more — still this one tap — and send if the engine now says proven for this very prepared send.
      const fresh = await engine.preparedFor(account);
      if (left.current) return;
      const latest = fresh.ok ? fresh.data : null;
      if (latest !== null && latest.id === view.id && latest.reauth?.proven === true && !latest.expired) return send(view, tapAt);
      const page = reauthPage(view.reauth.challengeId);
      if (page === null) return onStartAgain(draftOf(view.intent));
      if (surface === 'popup') {
        platform.openPage(page);
        platform.closeWindow();
      } else platform.navigate(page);
      return;
    }
    return send(view, tapAt);
  };

  /** The one wallet.send (D38): reached only from the Send button's handler above, and from nowhere else. */
  const send = async (view: Resumable, tapAt: number) => {
    sending.current = true;
    setInFlight(true);
    const r = await engine.send(view.id);
    sending.current = false;
    setInFlight(false);
    if (r.ok) {
      writePref(CONFIRM_STRIKE_KEY, '');
      return onTrack(r.data.id, tapAt);
    }
    const data = r.data as {challengeId?: unknown; id?: unknown} | undefined;
    switch (r.error) {
      case 'check-pending':
        // Recorded, maybe broadcast: never "nothing sent" — #21 tracks the record it names.
        return onTrack(typeof data?.id === 'string' ? data.id : null, tapAt);
      case 'failed':
        // #21 looks for a record of this account created after the tap; without one, its check-pending wording.
        return onTrack(null, tapAt);
      case 'prepared-expired':
        // The quote ended between the tap and the send: fresh values, and a new tap — the earlier one is never reused.
        if (await reprepare(view.intent, view.reauth?.challengeId)) setNotice('updated-review');
        return;
      case 'reauth-required': {
        if (typeof data?.challengeId !== 'string' || !HEX32.test(data.challengeId)) {
          // The engine consumed the send against a proof that no longer holds (past C5's cap, R2-M3).
          return onReview(view.intent, 'confirmation-expired');
        }
        // The prepared send is intact; its proof is missing — a confirmation that did not carry over. The loop guard
        // (§4.5, §7.7): the first time, say so and let the NEXT tap open #10 again; the second time in a row for the
        // same challenge — remembered across the #10 round trip, which may close this popup — stop, back to #12.
        if (readPref(CONFIRM_STRIKE_KEY) === data.challengeId) {
          writePref(CONFIRM_STRIKE_KEY, '');
          return onStartAgain(draftOf(view.intent));
        }
        writePref(CONFIRM_STRIKE_KEY, data.challengeId);
        setView({...view, reauth: {challengeId: data.challengeId, reasons: view.reauth?.reasons ?? [], proven: false}});
        setNotice('not-carried');
        return;
      }
      case 'unknown-prepared':
      case 'prepared-invalid':
      case 'in-flight': {
        // A second window, or a tap that raced the lock, may have sent it (R2-M2): track that record, else #19.
        const made = await madeSince(shownAt.current);
        if (made !== null) return onTrack(made.id, tapAt);
        return onReview(view.intent, null);
      }
      case 'coordinator-refused':
        report(r.error);
        return;
      case 'unreachable':
        report(r.error);
        return onTrack(null, tapAt);
      case 'locked':
        await reload();
        return;
      default:
        return onStartAgain(draftOf(view.intent));
    }
  };

  const refused = m.net.mode === 'refused';
  const top = <TopBar title={CONFIRM_TEXT.title} onBack={back} trailing={<span className="step noc-overline">{CONFIRM_TEXT.step}</span>} />;
  if (view === null) {
    return (
      <div className="screen s-conf" aria-busy="true">
        {top}
      </div>
    );
  }

  const intent = view.intent;
  const token = intent.token;
  const amount = showExact(token, intent.amount);
  const prices = m.prices ?? ownPrices;
  const usd = usdOf(token, intent.amount, prices);
  const solUsd = prices?.sol ?? null;
  const reasons = view.reauth?.reasons ?? [];
  const proven = view.reauth?.proven === true;
  const high = reasons.includes('over-5-percent') || reasons.includes('over-usd-threshold');
  const first = reasons.includes('first-send');
  const balance = token === 'SOL' ? view.simulation.sol.before : m.balances === null ? null : m.balances[token === 'NOC' ? 'noc' : token === 'USDC' ? 'usdc' : 'usdt'];
  const percent = percentOf(intent.amount, balance);
  const fiat = [usd === null ? null : `≈ ${showUsd(usd)} USD`, high && percent !== null ? `${percent} % of your balance` : null].filter((x): x is string => x !== null).join(' · ');
  const from = m.wallet?.accounts.find(a => a.publicKey === account);
  const own = m.wallet?.accounts.find(a => a.publicKey === intent.recipient);
  const toLabel = own !== undefined ? `Your account: ${own.name}` : intent.recipient === MAINNET_FEE_TREASURY ? 'Noctura treasury' : null;
  const rows = feeRows(view.fees);
  const solTotal = view.solRequiredLamports;
  const totalUsd = solUsd === null ? null : (Number(solTotal) / 1e9) * solUsd + (token === 'SOL' ? 0 : usd ?? Number.NaN);
  const seconds = Math.max(0, Math.ceil((view.validUntil - now) / 1000));
  const banner = refused ? (
    <RefusedBanner />
  ) : notice === 'not-carried' ? (
    <Banner tone="warning" title={CONFIRM_TEXT.notCarried} />
  ) : notice === 'updated-review' ? (
    <Banner tone="info" title={CONFIRM_TEXT.updatedReview} />
  ) : notice === 'updated' ? (
    <Banner tone="info" title={CONFIRM_TEXT.updated} />
  ) : proven ? (
    <Banner tone="info" title={CONFIRM_TEXT.confirmed} />
  ) : entry === 'resume' ? (
    <Banner tone="info" title={CONFIRM_TEXT.resume} />
  ) : null;
  const needsProof = view.reauth !== null && !proven;

  return (
    <div className="screen s-conf">
      {top}
      <div className="scroll">
        {banner}
        <h1 className="headline">
          <span className="amount noc-numeral">Send {amount}</span> <span className="ticker">{token}</span> <span className="to-prefix">to</span>{' '}
          <span className="recipient noc-mono">
            <AddressGroups address={intent.recipient} />
          </span>
        </h1>
        <div className={`review-card${high ? ' high-value' : ''}`}>
          <span className="eyebrow">{high ? CONFIRM_TEXT.highValue : CONFIRM_TEXT.about}</span>
          <div className="head">
            <span className="amount noc-numeral">{amount}</span>
            <span className="ticker">{token}</span>
          </div>
          {fiat === '' ? null : <span className="fiat">{fiat}</span>}
        </div>
        {high && needsProof ? (
          <div className="high-value-banner">
            <span className="help">{surface === 'popup' ? CONFIRM_TEXT.reauthLine : CONFIRM_TEXT.reauthLineTab}</span>
          </div>
        ) : null}
        {first ? (
          <div className="first-time-banner" role="note">
            <ExtIcon name="alert-triangle" size={18} />
            <div>
              <b className="app-block">{CONFIRM_TEXT.firstTitle}</b>
              <span className="noc-caption app-secondary">{CONFIRM_TEXT.firstLine}</span>
            </div>
          </div>
        ) : null}
        <div className="detail-grid">
          <div className="detail-row">
            <span className="lbl">From</span>
            <span className="val app-stack">
              {from === undefined ? null : <span className="noc-body-sm">{from.name}</span>}
              <span className="noc-mono">
                <AddressGroups address={account} />
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="lbl">To</span>
            <span className="val app-stack">
              {toLabel === null ? null : <span className="noc-body-sm">{toLabel}</span>}
              <span className="noc-mono">
                <AddressGroups address={intent.recipient} />
              </span>
            </span>
          </div>
          <div className="detail-row">
            <span className="lbl">Network</span>
            <span className="val">{CONFIRM_TEXT.network}</span>
          </div>
        </div>
        <div className="fee-block">
          <h3>Fees</h3>
          {rows.map(f => (
            <div className="fee-row" key={f.label}>
              <span>{f.label}</span>
              <span className="val noc-numeral">{f.lamports === null ? '' : `${showLamports(f.lamports)} SOL`}</span>
              <span className="fiat noc-numeral">{f.lamports === null ? '' : feeUsd(solUsd === null ? null : (Number(f.lamports) / 1e9) * solUsd)}</span>
            </div>
          ))}
          <div className="fee-row total">
            <span className="lbl">Total</span>
            <span className="val noc-numeral">{token === 'SOL' ? `${showLamports(solTotal)} SOL` : `${amount} ${token} + ${showLamports(solTotal)} SOL`}</span>
            <span className="fiat noc-numeral">{totalUsd === null || Number.isNaN(totalUsd) ? '—' : showUsd(totalUsd)}</span>
          </div>
        </div>
        <div className="app-quote noc-caption noc-numeral">
          {quoteDead ? (
            <>
              {CONFIRM_TEXT.quoteExpired}{' '}
              <LockedButton className="btn btn-tertiary app-btn-inline" onPress={refresh} disabled={refused}>
                {CONFIRM_TEXT.refresh}
              </LockedButton>
            </>
          ) : (
            `Quote valid ${seconds} s · slot ${view.simulation.slot.toLocaleString('en-US').replace(/,/g, ' ')}`
          )}
        </div>
      </div>
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" disabled={open !== null || quoteDead || busy || refused} onPress={tap}>
          <ExtIcon name="send" size={18} />
          Send {amount} {token}
        </LockedButton>
        <button type="button" className="btn btn-tertiary" disabled={inFlight} onClick={() => void cancel()}>
          {CONFIRM_TEXT.cancel}
        </button>
        {open !== null ? <p className="noc-caption app-muted app-center-text">{CONFIRM_TEXT.pending}</p> : null}
        {open === null && needsProof ? <p className="noc-caption app-muted app-center-text">{surface === 'popup' ? CONFIRM_TEXT.opensTab : CONFIRM_TEXT.opensHere}</p> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 2c9c58c..799dfec 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1543,8 +1543,10 @@ point here. **One user tap per broadcast, always (D38; review B1).**
   - **extension-only `pending`**: a send from this account is open → Send disabled with "A send
     from this account is still pending." (review L6).
 - **Send sequence** (the rule 6 lock is held from the tap until the reply):
-  1. Tap with `reauth === null` → `wallet.send(id)`.
-  2. Tap with `reauth !== null` → `tabs.create('unlock.html?mode=reauth&challenge=<id>')`. The popup
+  1. Tap with `reauth === null`, **or with a proven challenge** (plan 3: `reauth.proven`, the engine's own
+     `challengeSatisfied`, reported by `prepareSend` and `preparedFor` — without it a resumed #20 could
+     only open #10 again) → `wallet.send(id)`.
+  2. Tap with an unproven `reauth` → `tabs.create('unlock.html?mode=reauth&challenge=<id>')`. The popup
      closes (focus leaves it). In the tab, #10 → `confirmed` → the same tab loads
      `wallet.html#/send/resume?account=…`.
   3. **Resume** (that tab, or a reopened popup; also any other opener of that hash): read
@@ -1565,7 +1567,9 @@ point here. **One user tap per broadcast, always (D38; review B1).**
        C5's 10-minute cap) → back to #19 with "Your confirmation expired — review again" (review
        R2-M3). The client accepts both shapes, and both are tested against the real
        `handleMessage`.
-     - **Loop guard** (for `reauth-required` with a challengeId): if it happens right after a
+     - **Loop guard** (for `reauth-required` with a challengeId; plan 3 remembers the strike's challenge
+       in the UI's `localStorage`, `noctura.ui.v1.confirmStrike`, because the round trip through #10 may
+       close the popup that saw it — UI state with no security meaning, S4): if it happens right after a
        `confirmed` resume for the same intent, the screen shows "Your
        confirmation did not carry over. Confirm again." once. A second time in a row goes back to
        #12 with the draft and "Something went wrong — start the send again." A tab is never opened
@@ -1589,6 +1593,20 @@ point here. **One user tap per broadcast, always (D38; review B1).**
   tap event; `prepared-expired` after a tap never calls `wallet.send` again without a second tap.
   Mutation: an auto-send on resume must fail these tests.
 - **Differs:**
+  - **Plan 3:** each fee row keeps the design's dollars column — at today's SOL price, four places
+    truncated below a cent, as #27's fee line ("$0.0007"); a zero Noctura fee's reason row has none; the
+    Total's dollars add the token's value for an SPL send. The high-value line carries cents ("≈ $600.00
+    USD · 6 % of your balance"); the share uses the balance the engine read for a SOL send, and the
+    selected account's balances for a token (omitted while they are unknown). "Quote expired — refresh"
+    disables Send and puts `[Refresh]` beside the line. In the UI tab (#20 after #10), #10 opens in the
+    same tab, so the two lines read "You'll confirm with your password (or passkey) in this tab before
+    this is sent." and "Confirmation opens in this tab." — **controller additions — awaiting the
+    owner**. A fee row's dollars below $0.0001 read "< $0.0001", never "$0.0000" (review L3). While a
+    send from this account is open, the quote's end does not re-prepare (review L1); a tap on an unproven
+    view reads `preparedFor` once more and sends if the challenge was proven elsewhere meanwhile (review
+    L2) — still one tap. "Confirmed…", "You have a send waiting." and the "Updated…" lines are info banners; "Your
+    confirmation did not carry over…" a warning banner. A fee row's label has no `.lbl` class (only the
+    Total's is styled in the design's CSS).
   - Priority chip strip removed (D15).
   - "Save as — Add to address book? · Add · Skip" removed (B1b-2b, #15).
   - The typed-CONFIRM field removed (D22).
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/Confirm.test.tsx src/app/__tests__/format.test.ts
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 2 passed (2) · Tests 39 passed (39); tsc clean; whole suite Test Files 107 passed (107) · Tests 1899 passed (1899).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M9a** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -     if (auto.current <= 0) {
  +     if (auto.current <= -100) {
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9b** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -       else apply(v);
  +       else apply(v);
  +       if (v.reauth === null || v.reauth.proven) void engine.send(v.id);
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (16 failed | 14 passed (30)).

- **M9c** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -         if (readPref(CONFIRM_STRIKE_KEY) === data.challengeId) {
  +         if (readPref(CONFIRM_STRIKE_KEY) === 'never') {
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9d** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -     if (cancelling.current || sending.current) return;
  +     if (cancelling.current) return;
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: green (30 passed (30)) — **masked, by design**: the Cancel button's `disabled={inFlight}` prop already blocks the click (React drops clicks on a disabled prop even when the DOM attribute is lifted). The guard is the second line of defence; M9d2 removes both and is red.

- **M9d2** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -     if (cancelling.current || sending.current) return;
  +     if (cancelling.current) return;
  -  disabled={inFlight} onClick={() => void cancel()}
  +  onClick={() => void cancel()}
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9g** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -     if (view === null || left.current || sending.current) return;
  +     if (view === null || left.current) return;
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9e** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -     if (view.reauth !== null && !view.reauth.proven) {
  +     if (view.reauth !== null) {
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (2 failed | 28 passed (30)).

- **M9f** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -         if (r.ok && cancelled.current) void engine.discardPrepared(account);
  + (deleted)
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9h** — `extension/src/app/screens/Home.tsx`:

  ```diff
  - export function Home(
  + function sneak(e: {send: (id: string) => unknown}) {
  +   void e.send('x');
  + }
  + void sneak;
  + export function Home(
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9i** — `extension/src/unlock/reauthFlow.ts`:

  ```diff
  -     const r = await deps.send({type: 'vault.reauthOk', challengeId});
  +     const r = await deps.send({type: 'vault.reauthOk', challengeId});
  +     void deps.send({type: 'wallet.send', id: challengeId});
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9j** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -     if (!expiredNow || view === null || busy || quoteDead || open !== null) return;
  +     if (!expiredNow || view === null || busy || quoteDead) return;
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9k** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -       if (latest !== null && latest.id === view.id && latest.reauth?.proven === true && !latest.expired) return send(view, tapAt);
  +       void latest;
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (2 failed | 28 passed (30)).

- **M9l** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -           return onReview(view.intent, 'confirmation-expired');
  +           return onStartAgain(draftOf(view.intent));
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- **M9m** — `extension/src/app/format.ts`:

  ```diff
  -   if (usd > 0 && usd < 0.0001) return '< $0.0001';
  + (deleted)
  ```
  `npx vitest run src/app/__tests__/format.test.ts src/app/__tests__/Confirm.test.tsx` — Expected: **red** (2 failed | 37 passed (39)).

- **M9n** — `extension/src/app/screens/Confirm.tsx`:

  ```diff
  -           {rows.map(f => (
  +           {rows.filter(f => f.label !== 'Priority').map(f => (
  ```
  `npx vitest run src/app/__tests__/Confirm.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- [ ] **Step 7: The §8 visual checklist for this screen.** Task 17 shoots every state of this screen; after it, the opus-tier reviewer checks them against index.html with the checklist in Task 17. Nothing to run here; the component tests above already assert every string.

- [ ] **Step 8: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/app/__tests__/Confirm.test.tsx extension/src/app/__tests__/format.test.ts extension/src/app/app.css extension/src/app/format.ts extension/src/app/platform.ts extension/src/app/prefs.ts extension/src/app/screens/Confirm.tsx
git commit -F - <<'MSG'
feat(extension): #20 tx-confirm — one tap per broadcast, the quote's life with one automatic refresh, the resume entry

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 10: #54 tx-stuck: stuck, sending again, sent again, expired — the same bytes, never a speed-up

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Create: `extension/src/app/__tests__/Stuck.test.tsx`
- Modify: `extension/src/app/app.css`
- Create: `extension/src/app/screens/Stuck.tsx`

**Interfaces:**
- Consumes: Task 3's record; `wallet.resend` (the same signed bytes, refused within 2 s); `Pending.state`.
- Produces: `src/app/screens/Stuck.tsx` (`Stuck`, `STUCK_TEXT`, `mmss`).

Spec §4.8 and #s54. Stuck (the 90 s chip, "Pending for MM:SS", the honest banner, the original's card, the two cards, Send again, Close); sending-again (54b's layout, held); sent-again (the same hash, "Watching"); expired ("Not confirmed — no funds moved." and why; [Try again] = a fresh prepare of the same intent at #19; [Done]). "Send again (same transaction)" re-sends the SAME bytes through a `LockedButton` (rule 6); the engine's 2 s refusal shows "Wait a moment before sending again."; the 403 cool-down disables it. No "Speed up" (D15: priority is automatic). Every await checks `alive`. **Rule 6 is asserted on what reaches the network (review M3):** the held test asserts exactly one broadcast of the stored bytes; a second test presses twice inside one `act()` — so neither `disabled` nor the screen's "sending" layout can intervene — with an engine clock that moves 5 s per read, so a second resend would NOT be `too-soon`: only `LockedButton`'s synchronous lock stops it (M10b removes that lock and is red).

- [ ] **Step 1: Write the failing test.**

Create `extension/src/app/__tests__/Stuck.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderInWallet, walletReader, type WalletOptions} from './harness';
import {STUCK_TEXT, Stuck, mmss} from '../screens/Stuck';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {REFUSED_TEXT} from '../ui/Banner';
import {PENDING_KEY} from '../../background/pendingStore';
import {RpcForbidden} from '../../../../core/solana/rpc';
import {firstSignature} from '../../../../core/solana/broadcast';
import {base64} from '@scure/base';
import {ACCOUNT, RECIPIENT, pendingRecord, signedWire} from '../../background/__tests__/fixtures';
import type {Pending} from '../engine';

// Spec §4.8 (#54, D23): the design's layout, only the levers differ — "Send again" re-sends the same signed bytes.
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onClose: vi.fn(), onActivity: vi.fn(), onTryAgain: vi.fn()};
const WIRE = signedWire(2_480_000_000n);
const SIGNATURE = firstSignature(WIRE);
const CREATED = 1_000_000_000_000;
const stored = (over: Partial<ReturnType<typeof pendingRecord>> = {}) =>
  pendingRecord({id: 'r1', account: ACCOUNT.publicKey, signature: SIGNATURE, wire: base64.encode(WIRE), createdAt: CREATED, lastSentAt: CREATED, state: 'stuck', lastValidBlockHeight: 1150, intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, ...over});
/** The view #21 hands #54: the stored record as wallet.pending answers it. */
const view = (over: Partial<Pending> = {}): Pending => ({
  id: 'r1',
  account: ACCOUNT.publicKey,
  signature: SIGNATURE,
  lastValidBlockHeight: 1150,
  createdAt: CREATED,
  lastSentAt: CREATED,
  state: 'stuck',
  detail: null,
  intent: {token: 'SOL', recipient: RECIPIENT, amount: 2_480_000_000n},
  expiryNullSeenAt: null,
  failure: null,
  feeLamports: 5_050n,
  ...over,
});

async function renderStuck(p: Pending, o: WalletOptions = {}, now = CREATED + 94_000) {
  const broadcasts: string[] = [];
  const w = await renderInWallet(<Stuck record={p} now={now} {...nav} />, {
    before: ext => ext.local.set(PENDING_KEY, [stored({state: p.state})]),
    deps: {
      now: () => CREATED + 94_000,
      broadcast: async wire => {
        broadcasts.push(base64.encode(wire));
        return firstSignature(wire);
      },
    },
    ...o,
  });
  return {...w, broadcasts};
}

afterEach(() => vi.clearAllMocks());

describe('#54 stuck-tx — the safe variant', () => {
  it('stuck: the 90 s chip, "Pending for 01:34", the honest banner, the original’s card, the two cards, Send again and Close', async () => {
    await renderStuck(view());
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.chip)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
    expect(document.querySelector('.pending-counter .time')?.textContent).toBe('01:34');
    expect(document.querySelector('.warn-banner .body')?.textContent).toBe(`${STUCK_TEXT.bannerBold}${STUCK_TEXT.bannerLine}`);
    const rows = [...document.querySelectorAll('.orig-card .row')].map(r => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
    expect(rows).toEqual([
      ['Amount', '2.4800 SOL'],
      ['Recipient', RECIPIENT],
      ['Tx hash', `${SIGNATURE.slice(0, 4)}…${SIGNATURE.slice(-4)}Copy`],
      ['Valid until block', '1150'],
    ]);
    expect([...document.querySelectorAll('.orig-card .addr-groups > span')].map(s => s.textContent)).toEqual(RECIPIENT.match(/.{1,4}/g));
    expect([...document.querySelectorAll('.recovery-card .name')].map(n => n.textContent)).toEqual([STUCK_TEXT.againName, STUCK_TEXT.waitName]);
    expect(screen.getByText(STUCK_TEXT.recommended)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.againWhat)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.waitWhat)).toBeTruthy();
    expect(screen.getByRole('button', {name: STUCK_TEXT.sendAgain})).toBeTruthy();
    expect(screen.getAllByRole('button', {name: 'Close'})).toHaveLength(2);
    // Not built (D23): a higher-fee copy and a 0 SOL self-transfer are new transactions while this one can land.
    expect(document.body.textContent).not.toMatch(/Speed up|Cancel with replacement|priority fee|µ-lamports|NOT moved/);
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
  });

  it('Send again re-sends the SAME bytes: sending again → "Sent again", the same hash, Watching; once per tap (rule 6, `disabled` lifted)', async () => {
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const sentWires: string[] = [];
    const w = await renderStuck(view(), {
      before: ext => ext.local.set(PENDING_KEY, [stored()]),
      deps: {
        now: () => CREATED + 94_000,
        broadcast: async wire => {
          sentWires.push(base64.encode(wire));
          await held;
          return firstSignature(wire);
        },
      },
    });
    const again = (await screen.findByRole('button', {name: STUCK_TEXT.sendAgain})) as HTMLButtonElement;
    fireEvent.click(again);
    again.disabled = false;
    fireEvent.click(again);
    expect(await screen.findByText(STUCK_TEXT.sendingLine)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.sendingTitle)).toBeTruthy();
    expect(screen.getByText('01:34 elapsed')).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.stillPending)).toBeTruthy();
    expect((screen.getByRole('button', {name: STUCK_TEXT.sendAgain}) as HTMLButtonElement).disabled).toBe(true);
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
    await act(async () => release());
    expect(await screen.findByText(STUCK_TEXT.sentLine)).toBeTruthy();
    expect(screen.getAllByText(STUCK_TEXT.sentTitle).length).toBeGreaterThan(0);
    expect(screen.getByText(STUCK_TEXT.watching)).toBeTruthy();
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
    // Exactly one broadcast — of the stored bytes (the cardinal failure the design's #54 note names is a double one).
    expect(sentWires).toEqual([base64.encode(WIRE)]);
    // One resend reached the background; the record's lastSentAt moved, its signature did not.
    const records = (await w.ext.local.get(PENDING_KEY)) as {signature: string; lastSentAt: number}[];
    expect(records.map(r => [r.signature, r.lastSentAt])).toEqual([[SIGNATURE, CREATED + 94_000]]);
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.viewActivity}));
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.done}));
    expect(nav.onActivity).toHaveBeenCalledTimes(1);
    expect(nav.onClose).toHaveBeenCalledTimes(1);
  });

  it('a second press the engine would NOT refuse (its clock moves 5 s per read, past the 2 s rule): only the lock stops it — one broadcast (review M3)', async () => {
    let t = CREATED + 94_000;
    const sentWires: string[] = [];
    await renderStuck(view(), {
      before: ext => ext.local.set(PENDING_KEY, [stored()]),
      deps: {
        now: () => (t += 5_000),
        broadcast: async wire => {
          sentWires.push(base64.encode(wire));
          return firstSignature(wire);
        },
      },
    });
    const again = (await screen.findByRole('button', {name: STUCK_TEXT.sendAgain})) as HTMLButtonElement;
    // Both presses inside one act(): React renders nothing between them, so neither the button's `disabled`
    // nor the screen's own "sending" layout can stop the second — only LockedButton's synchronous lock does.
    act(() => {
      again.click();
      again.click();
    });
    expect(await screen.findByText(STUCK_TEXT.sentLine)).toBeTruthy();
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(sentWires).toEqual([base64.encode(WIRE)]);
  });

  it('the engine refuses too soon (2 s): "Wait a moment before sending again." and the stuck layout stays', async () => {
    await renderStuck(view(), {before: ext => ext.local.set(PENDING_KEY, [stored({lastSentAt: CREATED + 93_500})])});
    fireEvent.click(await screen.findByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.tooSoon)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.pendingFor)).toBeTruthy();
  });

  it('a record no longer tracked: "This transaction is no longer tracked." and [Open Activity]', async () => {
    await renderStuck(view(), {before: async () => undefined});
    fireEvent.click(await screen.findByRole('button', {name: STUCK_TEXT.sendAgain}));
    expect(await screen.findByText(STUCK_TEXT.untracked)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.openActivity}));
    expect(nav.onActivity).toHaveBeenCalledTimes(1);
  });

  it('expired: "Not confirmed — no funds moved." and why; [Try again] the same intent (a fresh prepare); [Done]', async () => {
    await renderStuck(view({state: 'expired', detail: 'Not confirmed — no funds moved.'}));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(screen.getByText(STUCK_TEXT.expiredLine)).toBeTruthy();
    expect(screen.queryByRole('button', {name: STUCK_TEXT.sendAgain})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.tryAgain}));
    await waitFor(() => expect(nav.onTryAgain).toHaveBeenCalledWith({token: 'SOL', recipient: RECIPIENT, amount: 2_480_000_000n}));
    fireEvent.click(screen.getByRole('button', {name: STUCK_TEXT.done}));
    expect(nav.onClose).toHaveBeenCalledTimes(1);
    expect(unstyledClasses(document.querySelector('.s-stuck')!, SELECTORS)).toEqual([]);
  });

  it('the engine’s detail shows under the banner; the 403 cool-down (D26) disables Send again', async () => {
    await renderStuck(view({detail: 'Not sent again: cooling down after an earlier HTTP 403; still watching the first copy.'}), {
      reader: walletReader({
        getBalance: async () => {
          throw new RpcForbidden('getBalance');
        },
      }),
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect(screen.getByText('Not sent again: cooling down after an earlier HTTP 403; still watching the first copy.')).toBeTruthy();
    expect((screen.getByRole('button', {name: STUCK_TEXT.sendAgain}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the counter: minutes and seconds since the send was made', () => {
    expect(mmss(CREATED, CREATED + 94_000)).toEqual({mm: '01', ss: '34'});
    expect(mmss(CREATED, CREATED + 12 * 60_000 + 5_000)).toEqual({mm: '12', ss: '05'});
    expect(mmss(CREATED, CREATED - 5)).toEqual({mm: '00', ss: '00'});
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/Stuck.test.tsx
```
Expected (dry run): FAIL — Test Files 1 failed (1) · Tests no tests (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 72cff72..5cd040d 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -636,3 +636,29 @@ a.btn {
   flex-direction: column;
   gap: 2px;
 }
+
+/* #54 stuck (plan 3): index.html #s54's inline styles — the original's card dimmed while it is re-sent, its
+   elapsed pill in --warning — and the hash's copy controls as buttons (the chip, and 54d's accent "Copy"). */
+.s-stuck .orig-card.app-dim-card {
+  opacity: 0.6;
+}
+.s-stuck .orig-card .head .pill.app-pill-warning {
+  color: var(--warning);
+  background: color-mix(in oklab, var(--warning) 12%, transparent);
+}
+.s-stuck .orig-card .copy-chip {
+  border: 0;
+  cursor: pointer;
+}
+.s-stuck .new-tx-hash .app-hash-copy {
+  display: inline-flex;
+  align-items: center;
+  gap: 4px;
+  min-height: var(--touch-target-min);
+  padding: 0;
+  border: 0;
+  background: transparent;
+  color: var(--accent);
+  font: inherit;
+  cursor: pointer;
+}
```

Create `extension/src/app/screens/Stuck.tsx`:

```tsx
import {useEffect, useRef, useState} from 'react';
import {useWallet} from '../WalletContext';
import {shortAddress} from '../format';
import {showExact} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../ui/ExtIcon';
import {RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useCopy} from '../ui/useCopy';
import type {Intent, Pending} from '../engine';

/** The fixed strings #54 shows (spec §4.8, D23); adapted ones are marked there. */
export const STUCK_TEXT = {
  title: 'Transaction stuck',
  chip: '90 s timeout',
  pendingFor: 'Pending for',
  bannerBold: "The network hasn't confirmed it yet — it may be congested, or the transaction may have been dropped.",
  bannerLine: 'Funds have not moved yet. This transaction can still land until its blockhash expires.',
  original: 'Original transaction',
  stillPending: 'Original (still pending)',
  againName: 'Send again',
  recommended: 'Recommended',
  againWhat: 'Re-send the exact same signed transaction. Same signature — it can land at most once, and you pay its fee at most once.',
  waitName: 'Wait for expiry',
  waitWhat: 'If it has not landed when its blockhash expires, Noctura checks twice and then tells you no funds moved. Only then can you try again.',
  sendAgain: 'Send again (same transaction)',
  close: 'Close',
  sendingTitle: 'Sending again…',
  sendingLine: 'Re-sending the same transaction.',
  sentTitle: 'Sent again',
  sentLine: 'The same transaction was sent to the network again. Its signature is unchanged, so only one copy can land.',
  watching: 'Watching',
  viewActivity: 'View in Activity',
  done: 'Done',
  expiredTitle: 'Transaction',
  expiredHead: 'Not confirmed — no funds moved.',
  expiredLine: 'Its blockhash expired and two checks found it on no block. You can now make a new attempt.',
  tryAgain: 'Try again',
  tooSoon: 'Wait a moment before sending again.',
  untracked: 'This transaction is no longer tracked.',
  openActivity: 'Open Activity',
} as const;

/** "01:34" — minutes and seconds since `from` (the design's counter; a send is open for minutes, never hours). */
export function mmss(from: number, now: number): {mm: string; ss: string} {
  const s = Math.max(0, Math.floor((now - from) / 1000));
  return {mm: String(Math.floor(s / 60)).padStart(2, '0'), ss: String(s % 60).padStart(2, '0')};
}

/**
 * The hash's copy control with CopyButton's honesty ("Copied" only when the clipboard took it): the design's
 * `.copy-chip` on the original's card, and its accent "Copy" inside 54d's hash line.
 */
function HashCopy({signature, variant}: {signature: string; variant: 'chip' | 'link'}) {
  const [state, copy] = useCopy();
  const text = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy';
  return (
    <button type="button" className={variant === 'chip' ? 'copy-chip' : 'app-hash-copy'} aria-label={state === 'idle' ? 'Copy transaction hash' : text} onClick={() => copy(signature)}>
      <ExtIcon name="copy" size={11} />
      {text}
    </button>
  );
}

/**
 * #54 stuck-tx, the safe variant (spec §4.8, D23): the design's layout, only the levers differ. "Send again"
 * re-sends the SAME signed bytes (wallet.resend: same signature, it can land at most once); "Wait for expiry"
 * explains what happens without a tap. "Speed up" and "Cancel with replacement" are not built — both are new
 * transactions while the original can still land. The record comes from #21's 2 s poll; when it confirms or
 * fails, #21 shows that instead; when it expires, this screen shows its expired layout.
 */
export function Stuck({record, now, onClose, onActivity, onTryAgain}: {record: Pending; now: number; onClose: () => void; onActivity: () => void; onTryAgain: (intent: Intent) => void}) {
  const m = useWallet();
  const [phase, setPhase] = useState<'stuck' | 'sending' | 'sent' | 'untracked'>('stuck');
  const [line, setLine] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const refused = m.net.mode === 'refused';
  const amount = `${showExact(record.intent.token, record.intent.amount)} ${record.intent.token}`;
  const {mm, ss} = mmss(record.createdAt, now);
  const hash = shortAddress(record.signature);

  const sendAgain = async () => {
    setLine(null);
    setPhase('sending');
    const r = await m.engine.resend(record.id);
    if (!alive.current) return;
    if (r.ok) return setPhase('sent');
    setPhase('stuck');
    if (r.error === 'too-soon') setLine(STUCK_TEXT.tooSoon);
    else if (r.error === 'unknown') setPhase('untracked');
    else if (r.error === 'coordinator-refused' || r.error === 'unreachable') m.report(r.error);
    // not-open: the record has moved on — #21's next poll shows its state.
  };

  const top = (title: string, close: boolean) => (
    <div className="top-bar">
      <button type="button" className="icon-btn" aria-label="Close" disabled={!close} onClick={onClose}>
        <ExtIcon name="close" size={22} />
      </button>
      <div className="title noc-h1">{title}</div>
      {title === STUCK_TEXT.title ? <span className="step noc-overline">{STUCK_TEXT.chip}</span> : null}
    </div>
  );

  if (record.state === 'expired') {
    return (
      <div className="screen s-stuck">
        {top(STUCK_TEXT.expiredTitle, true)}
        <div className="progress-state done-cancelled">
          <div className="ring">
            <ExtIcon name="close" size={26} />
          </div>
          <div className="head">{STUCK_TEXT.expiredHead}</div>
          <div className="sub">{STUCK_TEXT.expiredLine}</div>
          <div className="meta-grid">
            <span className="k">Tx hash</span>
            <span className="v mono noc-mono">{hash}</span>
          </div>
        </div>
        <div className="sticky-bar">
          <LockedButton className="btn btn-primary" disabled={refused} onPress={() => onTryAgain(record.intent)}>
            {STUCK_TEXT.tryAgain}
          </LockedButton>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {STUCK_TEXT.done}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'untracked') {
    return (
      <div className="screen s-stuck">
        {top(STUCK_TEXT.title, true)}
        <p className="noc-body app-muted">{STUCK_TEXT.untracked}</p>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary" onClick={onActivity}>
            {STUCK_TEXT.openActivity}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'sent') {
    return (
      <div className="screen s-stuck">
        {top(STUCK_TEXT.sentTitle, true)}
        <div className="progress-state done-success">
          <div className="ring">
            <ExtIcon name="check" size={32} />
          </div>
          <div className="head">{STUCK_TEXT.sentTitle}</div>
          <div className="sub">{STUCK_TEXT.sentLine}</div>
          <div className="new-tx-hash noc-mono">
            {hash} · <HashCopy signature={record.signature} variant="link" />
          </div>
          <div className="meta-grid">
            <span className="k">Tx hash</span>
            <span className="v mono noc-mono">{hash}</span>
            <span className="k">Status</span>
            <span className="v app-success">{STUCK_TEXT.watching}</span>
          </div>
        </div>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary" onClick={onActivity}>
            {STUCK_TEXT.viewActivity}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {STUCK_TEXT.done}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'sending') {
    return (
      <div className="screen s-stuck">
        {top(STUCK_TEXT.sendingTitle, false)}
        <div className="progress-state">
          <div className="ring" />
          <div className="head">{STUCK_TEXT.sendingLine}</div>
        </div>
        <div className="orig-card app-dim-card">
          <div className="head">
            <span className="label">{STUCK_TEXT.stillPending}</span>
            <span className="pill app-pill-warning noc-numeral">
              {mm}:{ss} elapsed
            </span>
          </div>
          <div className="row">
            <span className="k">Amount</span>
            <span className="v amount noc-numeral">{amount}</span>
          </div>
          <div className="row">
            <span className="k">Tx hash</span>
            <span className="v mono noc-mono">{hash}</span>
          </div>
        </div>
        <div className="sticky-bar">
          <button type="button" className="btn btn-primary" disabled>
            {STUCK_TEXT.sendAgain}
          </button>
          <button type="button" className="btn btn-secondary" disabled>
            {STUCK_TEXT.close}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen s-stuck">
      {top(STUCK_TEXT.title, true)}
      {refused ? <RefusedBanner /> : null}
      <div className="pending-counter">
        <div className="label">{STUCK_TEXT.pendingFor}</div>
        <div className="time">
          <span className="mm">{mm}</span>
          <span className="sep">:</span>
          <span className="ss">{ss}</span>
        </div>
      </div>
      <div className="warn-banner" role="status">
        <ExtIcon name="alert-triangle" size={16} />
        <div className="body">
          <b>{STUCK_TEXT.bannerBold}</b>
          <br />
          {STUCK_TEXT.bannerLine}
        </div>
      </div>
      {record.detail === null ? null : <p className="noc-caption app-muted">{record.detail}</p>}
      <div className="orig-card">
        <div className="head">
          <span className="label">{STUCK_TEXT.original}</span>
          <span className="pill">Send</span>
        </div>
        <div className="row">
          <span className="k">Amount</span>
          <span className="v amount noc-numeral">{amount}</span>
        </div>
        <div className="row">
          <span className="k">Recipient</span>
          <span className="v mono noc-mono">
            <AddressGroups address={record.intent.recipient} />
          </span>
        </div>
        <div className="row">
          <span className="k">Tx hash</span>
          <span className="v mono noc-mono">
            {hash}
            <HashCopy signature={record.signature} variant="chip" />
          </span>
        </div>
        <div className="row">
          <span className="k">Valid until block</span>
          <span className="v noc-numeral">{record.lastValidBlockHeight}</span>
        </div>
      </div>
      <div className="recovery-card recommended">
        <div className="rec-head">
          <span className="name">{STUCK_TEXT.againName}</span>
          <span className="recommended-pill">{STUCK_TEXT.recommended}</span>
        </div>
        <div className="what">{STUCK_TEXT.againWhat}</div>
      </div>
      <div className="recovery-card">
        <div className="rec-head">
          <span className="name">{STUCK_TEXT.waitName}</span>
        </div>
        <div className="what">{STUCK_TEXT.waitWhat}</div>
      </div>
      <div className="sticky-bar">
        <LockedButton className="btn btn-primary" disabled={refused} onPress={sendAgain}>
          {STUCK_TEXT.sendAgain}
        </LockedButton>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {STUCK_TEXT.close}
        </button>
        {line === null ? null : (
          <p className="noc-caption app-warning app-center-text" role="alert">
            {line}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 799dfec..f95c4e9 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1733,6 +1733,15 @@ point here. **One user tap per broadcast, always (D38; review B1).**
     record's current state screen; `unknown` → "This transaction is no longer tracked." + `[Open
     Activity]`.
 - **Differs, loudly:**
+  - **Plan 3:** the counter is the design's MM:SS at any age (a send is open for minutes; the design's
+    "Hh Mm" form for an hour or more is not needed). `sending-again` is 54b's layout: the top bar reads
+    "Sending again…", the progress head "Re-sending the same transaction.", and the original's dimmed
+    card is labelled "Original (still pending)" with the elapsed pill "01:34 elapsed" (the design's
+    words). `sent-again` keeps 54d's hash line (the same hash, with an accent "Copy") and its grid's
+    "Tx hash" / "Status · Watching". `expired` uses 54e's layout with the top bar "Transaction" and a
+    one-row grid ("Tx hash"); its head and sub are the spec's two lines. A non-null engine `detail`
+    shows as a caption under the warning banner. The hash on the original's card is short (first four …
+    last four) with the design's 24 px `.copy-chip`, which copies it whole.
   - **"Speed up" (a higher priority fee) and "Cancel with replacement" (a 0 SOL self-transfer) are
     not built (D23).** Both are new transactions with new signatures while the original can
     still land. The design's line "Solana enforces single-execution by tx hash — only one settles"
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/Stuck.test.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 1 passed (1) · Tests 8 passed (8); tsc clean; whole suite Test Files 108 passed (108) · Tests 1907 passed (1907).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M10a** — `extension/src/app/screens/Stuck.tsx`:

  ```diff
  -     const r = await m.engine.resend(record.id);
  +     void m.engine.resend(record.id);
  +     const r = await m.engine.resend(record.id);
  ```
  `npx vitest run src/app/__tests__/Stuck.test.tsx` — Expected: **red** (2 failed | 6 passed (8)).

- **M10b** — `extension/src/app/ui/LockedButton.tsx`:

  ```diff
  -     if (busy.current || disabled) return;
  +     if (disabled) return;
  ```
  `npx vitest run src/app/__tests__/Stuck.test.tsx` — Expected: **red** (1 failed | 7 passed (8)).

- [ ] **Step 7: The §8 visual checklist for this screen.** Task 17 shoots every state of this screen; after it, the opus-tier reviewer checks them against index.html with the checklist in Task 17. Nothing to run here; the component tests above already assert every string.

- [ ] **Step 8: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/app/__tests__/Stuck.test.tsx extension/src/app/app.css extension/src/app/screens/Stuck.tsx
git commit -F - <<'MSG'
feat(extension): #54 tx-stuck — send the same transaction again, never a new one; expiry says no funds moved

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 11: #44 tx-failed by `failure` (E8), and #11's cancelled toast

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Create: `extension/src/app/__tests__/Failed.test.tsx`
- Modify: `extension/src/app/app.css`
- Create: `extension/src/app/screens/Failed.tsx`
- Modify: `extension/src/app/screens/TxDetail.tsx`
- Create: `extension/src/app/ui/CancelledToast.tsx`

**Interfaces:**
- Consumes: Task 3's record (`failure`, E8); `ExplorerLink` (#27, Solscan, checked).
- Produces: `src/app/screens/Failed.tsx` (`Failed`, `FAILED_TEXT`, `failedKind`); `src/app/ui/CancelledToast.tsx` (`CancelledToast`, `CANCELLED_TEXT`, `CANCELLED_MS`); `ExplorerLink` gains `label`/`icon`.

Spec §4.7 and #s44: `failedKind` — expired → blockhash-expired; `failure: 'landed'` → rejected-by-program (the fee was charged, the amount did not move); `'not-sent'` → network-error; otherwise generic. `[Try again]` (a `LockedButton`) is a fresh prepare of the same intent at #19; `[Edit transaction]`, the back arrow and Esc go to #12 with the draft. **`[View details]` → #27 (review M4, controller ruling: restored)** on `rejected-by-program` only — the one #44 state whose transaction is on chain; #27 opens by signature and already says when it is not in the recent history yet. Removed loudly (Differs): insufficient-fee (never reported, D15), slippage (no swaps), the RPC picker. The toast "Transaction cancelled. No fees charged." shows 1.8 s on #11 after #20's Cancel.

- [ ] **Step 1: Write the failing test.**

Create `extension/src/app/__tests__/Failed.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {renderInWallet, walletReader, type WalletOptions} from './harness';
import {FAILED_TEXT, Failed, failedKind} from '../screens/Failed';
import {CANCELLED_MS, CANCELLED_TEXT, CancelledToast} from '../ui/CancelledToast';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {REFUSED_TEXT} from '../ui/Banner';
import {RpcForbidden} from '../../../../core/solana/rpc';
import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
import {sig} from '../../../e2e/historyFixtures';
import type {Pending} from '../engine';

// Spec §4.7 (#44): the state from `failure` (E8, C3), `detail` only the caption.
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onTryAgain: vi.fn(), onEdit: vi.fn(), onDetails: vi.fn()};
const INTENT = {token: 'SOL' as const, recipient: RECIPIENT, amount: 2_480_000_000n};
const record = (over: Partial<Pending>): Pending => ({
  id: 'r1',
  account: ACCOUNT.publicKey,
  signature: sig(7),
  lastValidBlockHeight: 1150,
  createdAt: 1,
  lastSentAt: 1,
  state: 'failed',
  detail: null,
  intent: INTENT,
  expiryNullSeenAt: null,
  failure: null,
  feeLamports: 5_050n,
  ...over,
});
const renderFailed = (p: Pending, o: WalletOptions = {}) => renderInWallet(<Failed record={p} {...nav} />, o);
const text = () => [document.querySelector('.s9-fail-hero .head')?.textContent, document.querySelector('.s9-fail-hero .sub')?.textContent ?? null, document.querySelector('.s9-reason-banner .label')?.textContent ?? null];

afterEach(() => vi.clearAllMocks());

describe('#44 tx-failed', () => {
  it('blockhash-expired (engine `expired`): the hero, the reason, the payload kept, the footer; [Try again] and [Edit transaction]', async () => {
    await renderFailed(record({state: 'expired', detail: 'Not confirmed — no funds moved.'}));
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    expect(text()).toEqual([FAILED_TEXT.expiredHead, FAILED_TEXT.expiredSub, 'Reason · blockhash-expired']);
    expect(document.querySelector('.s9-reason-banner .body')?.textContent).toBe(FAILED_TEXT.expiredWhy);
    expect(screen.getByText(FAILED_TEXT.payload)).toBeTruthy();
    const rows = [...document.querySelectorAll('.s9-payload-card .row')].map(r => [r.querySelector('.k')?.textContent, r.querySelector('.v')?.textContent]);
    expect(rows).toEqual([
      ['To', RECIPIENT],
      ['Amount', '2.4800 SOL'],
      ['Valid until block', '1150'],
    ]);
    expect(screen.getByText(FAILED_TEXT.expiredFoot)).toBeTruthy();
    expect(document.querySelector('.top-bar .step')?.textContent).toBe('Failed');
    expect(screen.getByRole('button', {name: FAILED_TEXT.tryAgain})).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.edit}));
    expect(nav.onEdit).toHaveBeenCalledWith({token: 'SOL', recipient: RECIPIENT, amount: '2.48'});
    // Removed by decision: insufficient-fee (D15), the slippage content, the RPC picker.
    expect(document.body.textContent).not.toMatch(/higher priority|slippage|Switch RPC|Built at/);
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
  });

  it('rejected-by-program (failed, landed): "Rejected", the fee-charged sentence, the engine detail in mono; [Try again], [View details] → #27, [View on explorer]', async () => {
    const detail = 'Landed but failed ({"InstructionError":[2,{"Custom":1}]}): the network fee was paid, nothing was sent.';
    await renderFailed(record({failure: 'landed', detail}));
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    expect(text()).toEqual([FAILED_TEXT.rejectedHead, FAILED_TEXT.rejectedSub, 'Reason · rejected-by-program']);
    expect(document.querySelector('.s9-reason-banner .meta')?.textContent).toBe(detail);
    expect(document.querySelector('.top-bar .step')?.textContent).toBe('Rejected');
    const link = screen.getByRole('link', {name: FAILED_TEXT.explorer}) as HTMLAnchorElement;
    expect([link.getAttribute('href'), link.getAttribute('target'), link.getAttribute('rel')]).toEqual([`https://solscan.io/tx/${sig(7)}`, '_blank', 'noopener noreferrer']);
    expect(document.body.textContent).not.toContain('Your funds are unchanged');
    expect(unstyledClasses(document.querySelector('.screen')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: FAILED_TEXT.details}));
    expect(nav.onDetails).toHaveBeenCalledWith(sig(7));
  });

  it('network-error (failed, not-sent): "Couldn\'t send", the engine detail as the caption; [Try again]', async () => {
    const detail = 'The network refused this transaction (rejected: Blockhash not found). No funds moved.';
    await renderFailed(record({failure: 'not-sent', detail}));
    expect(await screen.findByText(FAILED_TEXT.notSentHead)).toBeTruthy();
    expect(text()).toEqual([FAILED_TEXT.notSentHead, detail, 'Reason · network-error']);
    expect(screen.getByRole('button', {name: FAILED_TEXT.tryAgain})).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    // Nothing reached the chain: no [View details] (only rejected-by-program has a transaction to show).
    expect(screen.queryByRole('button', {name: FAILED_TEXT.details})).toBeNull();
  });

  it('generic (failed with no failure, an older build’s record): "Transaction failed", the detail, [View on explorer] only', async () => {
    await renderFailed(record({detail: 'Something odd.'}));
    expect(await screen.findByText(FAILED_TEXT.genericHead)).toBeTruthy();
    expect(text()).toEqual([FAILED_TEXT.genericHead, 'Something odd.', null]);
    expect(screen.getByRole('link', {name: FAILED_TEXT.explorer})).toBeTruthy();
    expect(screen.queryByRole('button', {name: FAILED_TEXT.tryAgain})).toBeNull();
  });

  it('the state comes from `failure`, never from `detail` (C3)', () => {
    expect(failedKind(record({failure: 'landed', detail: 'Not confirmed — no funds moved.'}))).toBe('rejected-by-program');
    expect(failedKind(record({failure: 'not-sent', detail: 'Landed but failed'}))).toBe('network-error');
    expect(failedKind(record({state: 'expired', failure: null}))).toBe('blockhash-expired');
    expect(failedKind(record({failure: null, detail: 'The network refused this transaction'}))).toBe('generic');
  });

  it('[Try again] hands #19 the same intent — once per tap (rule 6, `disabled` lifted); disabled in the 403 cool-down', async () => {
    await renderFailed(record({failure: 'not-sent', detail: 'x'}));
    const again = (await screen.findByRole('button', {name: FAILED_TEXT.tryAgain})) as HTMLButtonElement;
    fireEvent.click(again);
    again.disabled = false;
    fireEvent.click(again);
    expect(nav.onTryAgain).toHaveBeenCalledTimes(1);
    expect(nav.onTryAgain).toHaveBeenCalledWith(INTENT);
    cleanup();
    await renderFailed(record({failure: 'not-sent', detail: 'Not sent: the coordinator is cooling down after an earlier HTTP 403. No funds moved.'}), {
      reader: walletReader({
        getBalance: async () => {
          throw new RpcForbidden('getBalance');
        },
      }),
    });
    expect(await screen.findByText(REFUSED_TEXT)).toBeTruthy();
    expect((screen.getByRole('button', {name: FAILED_TEXT.tryAgain}) as HTMLButtonElement).disabled).toBe(true);
  });

  it('the back arrow and Esc go to #12 with the form kept (the design’s exit)', async () => {
    await renderFailed(record({failure: 'landed', detail: 'x'}));
    fireEvent.click(await screen.findByRole('button', {name: 'Back'}));
    fireEvent.keyDown(document, {key: 'Escape'});
    expect(nav.onEdit).toHaveBeenCalledTimes(2);
  });
});

describe('#44’s user-cancelled toast', () => {
  it('"Transaction cancelled. No fees charged." in the design’s pill, gone after 1.8 s', async () => {
    vi.useFakeTimers();
    try {
      const done = vi.fn();
      render(<CancelledToast onDone={done} />);
      expect(screen.getByRole('status').textContent).toBe(CANCELLED_TEXT);
      expect(document.querySelector('.s9-toast-cancelled')).not.toBeNull();
      await act(async () => void vi.advanceTimersByTime(CANCELLED_MS - 1));
      expect(done).not.toHaveBeenCalled();
      await act(async () => void vi.advanceTimersByTime(1));
      expect(done).toHaveBeenCalledTimes(1);
      expect(unstyledClasses(document.querySelector('.s9-toast-cancelled')!, SELECTORS)).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/Failed.test.tsx
```
Expected (dry run): FAIL — Test Files 1 failed (1) · Tests no tests (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 5cd040d..7d1bfd1 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -662,3 +662,15 @@ a.btn {
   font: inherit;
   cursor: pointer;
 }
+
+/* #44 failed (plan 3): index.html #s44's inline styles — the eyebrow title in --fg-tertiary, the content with no
+   top padding — and the explorer link drawn as a button. */
+.app-fail-eyebrow {
+  color: var(--fg-tertiary);
+}
+.app-fail-body {
+  padding-top: 0;
+  display: flex;
+  flex-direction: column;
+  gap: var(--space-3);
+}
```

Create `extension/src/app/screens/Failed.tsx`:

```tsx
import {useWallet} from '../WalletContext';
import {draftOf, showExact, type Draft} from '../send/rules';
import {ExplorerLink} from './TxDetail';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../ui/ExtIcon';
import {RefusedBanner} from '../ui/Banner';
import {LockedButton} from '../ui/LockedButton';
import {useEscape} from '../ui/useEscape';
import type {Intent, Pending} from '../engine';

/** The fixed strings #44 shows (spec §4.7); adapted ones are marked there. */
export const FAILED_TEXT = {
  eyebrow: 'Transaction',
  expiredHead: 'Recent blockhash expired',
  expiredSub: 'Not confirmed — no funds moved.',
  expiredWhy: 'Solana rotated past the blockhash before your transaction reached a leader. Tap retry — the wallet will fetch a fresh one.',
  expiredFoot: 'No fees were charged. Retry is a fresh transaction with a new blockhash — same recipient, same amount.',
  payload: 'Original payload preserved',
  rejectedHead: 'Program rejected the transaction',
  rejectedSub: 'The on-chain program returned an error. The network fee was charged; the amount did not move.',
  notSentHead: "Couldn't send",
  genericHead: 'Transaction failed',
  tryAgain: 'Try again',
  edit: 'Edit transaction',
  details: 'View details',
  explorer: 'View on explorer',
} as const;

type Kind = 'blockhash-expired' | 'rejected-by-program' | 'network-error' | 'generic';

/** #44's state from the engine's `state` and `failure` (E8, C3) — never from `detail`, which is only the caption. */
export function failedKind(p: Pending): Kind {
  if (p.state === 'expired') return 'blockhash-expired';
  if (p.failure === 'landed') return 'rejected-by-program';
  if (p.failure === 'not-sent') return 'network-error';
  return 'generic';
}

/**
 * #44 tx-failed (spec §4.7): the design's categories the engine can report, chosen by `failure` (E8). Removed,
 * loudly: insufficient-fee (the engine never reports it; priority is automatic, D15), the slippage content (no
 * swaps), the RPC picker (reads and broadcast are fixed to the coordinator). `[Try again]` is a fresh prepare of
 * the same intent at #19 (rule 6: a LockedButton); the explorer link is Solscan's, checked (§6.5).
 */
export function Failed({record, onTryAgain, onEdit, onDetails}: {record: Pending; onTryAgain: (intent: Intent) => void; onEdit: (draft: Draft) => void; onDetails: (signature: string) => void}) {
  const m = useWallet();
  const kind = failedKind(record);
  const refused = m.net.mode === 'refused';
  const edit = () => onEdit(draftOf(record.intent));
  // The design's back arrow returns to #12 with the form kept: the same as [Edit transaction].
  useEscape(edit);
  const head = kind === 'blockhash-expired' ? FAILED_TEXT.expiredHead : kind === 'rejected-by-program' ? FAILED_TEXT.rejectedHead : kind === 'network-error' ? FAILED_TEXT.notSentHead : FAILED_TEXT.genericHead;
  const sub = kind === 'blockhash-expired' ? FAILED_TEXT.expiredSub : kind === 'rejected-by-program' ? FAILED_TEXT.rejectedSub : record.detail ?? '';
  const tryAgain = (
    <LockedButton className="btn btn-primary" disabled={refused} onPress={() => onTryAgain(record.intent)}>
      <ExtIcon name="refresh" size={18} />
      {FAILED_TEXT.tryAgain}
    </LockedButton>
  );
  // 44c's button carries no glyph.
  const explorer = <ExplorerLink signature={record.signature} label={FAILED_TEXT.explorer} icon={false} />;
  return (
    <div className="screen">
      <div className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={edit}>
          <ExtIcon name="back" size={22} />
        </button>
        <span className="title noc-overline app-fail-eyebrow">{FAILED_TEXT.eyebrow}</span>
        <span className="step noc-body-sm">{kind === 'rejected-by-program' ? 'Rejected' : 'Failed'}</span>
      </div>
      <div className="scroll-area app-fail-body">
        {refused ? <RefusedBanner /> : null}
        <div className="s9-fail-hero">
          <div className="ring">
            <div className="ring-inner">
              <ExtIcon name="close" size={32} />
            </div>
          </div>
          <h1 className="head">{head}</h1>
          {sub === '' ? null : <p className="sub">{sub}</p>}
        </div>
        {kind === 'generic' ? null : (
          <div className="s9-reason-banner">
            <span className="label">Reason · {kind}</span>
            {kind === 'blockhash-expired' ? <p className="body">{FAILED_TEXT.expiredWhy}</p> : null}
            {kind === 'rejected-by-program' && record.detail !== null ? <span className="meta">{record.detail.slice(0, 240)}</span> : null}
          </div>
        )}
        {kind === 'blockhash-expired' ? (
          <>
            <div className="s9-payload-card">
              <span className="label">{FAILED_TEXT.payload}</span>
              <div className="row">
                <span className="k">To</span>
                <span className="v mono noc-mono">
                  <AddressGroups address={record.intent.recipient} />
                </span>
              </div>
              <div className="row">
                <span className="k">Amount</span>
                <span className="v noc-numeral">
                  {showExact(record.intent.token, record.intent.amount)} {record.intent.token}
                </span>
              </div>
              <div className="row">
                <span className="k">Valid until block</span>
                <span className="v noc-numeral">{record.lastValidBlockHeight}</span>
              </div>
            </div>
            <p className="noc-caption app-muted">{FAILED_TEXT.expiredFoot}</p>
          </>
        ) : null}
      </div>
      <div className="sticky-bar">
        {kind === 'generic' ? explorer : tryAgain}
        {kind === 'blockhash-expired' ? (
          <button type="button" className="btn btn-secondary" onClick={edit}>
            {FAILED_TEXT.edit}
          </button>
        ) : kind === 'rejected-by-program' ? (
          <>
            {/* The design's [View details] → #27 (screen.md #44), only here: the one #44 state whose transaction is on chain. */}
            <button type="button" className="btn btn-secondary" onClick={() => onDetails(record.signature)}>
              <ExtIcon name="doc" size={18} />
              {FAILED_TEXT.details}
            </button>
            {explorer}
          </>
        ) : null}
      </div>
    </div>
  );
}
```

Modify `extension/src/app/screens/TxDetail.tsx`:

```diff
diff --git a/extension/src/app/screens/TxDetail.tsx b/extension/src/app/screens/TxDetail.tsx
index 43dd3d5..9a48d91 100644
--- a/extension/src/app/screens/TxDetail.tsx
+++ b/extension/src/app/screens/TxDetail.tsx
@@ -52,13 +52,14 @@ function Address({address, label}: {address: string; label: string}) {
   );
 }
 
-export function ExplorerLink({signature}: {signature: string}) {
+/** The one external link (§6.5): #27's [Explorer], and #44's [View on explorer] (plan 3) — one place builds the href. */
+export function ExplorerLink({signature, label = 'Explorer', icon = true}: {signature: string; label?: string; icon?: boolean}) {
   const href = explorerUrl(signature);
   if (href === null) return null;
   return (
     <a className="btn btn-secondary" href={href} target="_blank" rel="noopener noreferrer">
-      <ExtIcon name="link-out" size={16} />
-      Explorer
+      {icon ? <ExtIcon name="link-out" size={16} /> : null}
+      {label}
     </a>
   );
 }
```

Create `extension/src/app/ui/CancelledToast.tsx`:

```tsx
import {useEffect, useRef} from 'react';
import {ExtIcon} from './ExtIcon';

/** #44's user-cancelled toast (spec §4.7, E7): the design's `.s9-toast-cancelled` pill with its ✕, for 1.8 s. */
export const CANCELLED_TEXT = 'Transaction cancelled. No fees charged.';
export const CANCELLED_MS = 1_800;

export function CancelledToast({onDone}: {onDone: () => void}) {
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), CANCELLED_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="s9-toast-cancelled" role="status">
      <ExtIcon name="close" size={18} />
      <div className="body">{CANCELLED_TEXT}</div>
    </div>
  );
}
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index f95c4e9..9102231 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1688,6 +1688,16 @@ point here. **One user tap per broadcast, always (D38; review B1).**
     (1.8 s), after #20's `[Cancel]` (E7 discarded the prepared send, so the sentence is true). #10's
     Cancel shows its own line in the vault tab instead (§3.10, E7).
 - **Differs, loudly:**
+  - **Plan 3:** in `blockhash-expired` the design's hero sub ("Solana rotated past the blockhash …") is
+    the reason banner's body under "Reason · blockhash-expired", since the engine's line takes the sub;
+    the banner's slot-age body and meta line are not built (the engine keeps the height, not the slot
+    age). `rejected-by-program` offers `[Try again]`, the design's `[View details]` → #27 (by signature;
+    #27 already says when it is not in the recent history yet) and `[View on explorer]` — `[View
+    details]` only there, the one #44 state whose transaction is on chain (review M4). `network-error`
+    offers `[Try again]` only and `generic` `[View on explorer]` only, with no
+    reason banner (the engine names no reason for an older build's record). The back arrow and Esc go to
+    #12 with the transaction prefilled, as the design's annotation says (the same as `[Edit
+    transaction]`). The cancelled toast is the design's own `.s9-toast-cancelled` pill with its ✕.
   - **`insufficient-fee` state removed.** The engine never reports "fee too low", and priority is
     automatic (D15).
   - `rejected-by-program`'s Jupiter slippage content and `[Adjust slippage and retry]` removed
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/Failed.test.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 1 passed (1) · Tests 8 passed (8); tsc clean; whole suite Test Files 109 passed (109) · Tests 1915 passed (1915).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M11a** — `extension/src/app/screens/Failed.tsx`:

  ```diff
  -   if (p.failure === 'landed') return 'rejected-by-program';
  +   if (p.failure === 'landed') return 'network-error';
  ```
  `npx vitest run src/app/__tests__/Failed.test.tsx` — Expected: **red** (2 failed | 6 passed (8)).

- **M11b** — `extension/src/app/screens/Failed.tsx`:

  ```diff
  - onClick={() => onDetails(record.signature)}
  + onClick={() => undefined}
  ```
  `npx vitest run src/app/__tests__/Failed.test.tsx` — Expected: **red** (1 failed | 7 passed (8)).

- [ ] **Step 7: The §8 visual checklist for this screen.** Task 17 shoots every state of this screen; after it, the opus-tier reviewer checks them against index.html with the checklist in Task 17. Nothing to run here; the component tests above already assert every string.

- [ ] **Step 8: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/app/__tests__/Failed.test.tsx extension/src/app/app.css extension/src/app/screens/Failed.tsx extension/src/app/screens/TxDetail.tsx extension/src/app/ui/CancelledToast.tsx
git commit -F - <<'MSG'
feat(extension): #44 tx-failed by the engine's failure field, and #11's cancelled toast

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 12: #21 tx-status: broadcasting, slow, success — and the screen #54 and #44 grow out of

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Create: `extension/src/app/__tests__/Status.test.tsx`
- Modify: `extension/src/app/app.css`
- Create: `extension/src/app/screens/Status.tsx`

**Interfaces:**
- Consumes: Tasks 10, 11; `wallet.pending` every 2 s (`PENDING_POLL_MS`).
- Produces: `src/app/screens/Status.tsx` (`Status`, `STATUS_TEXT`, `SLOW_AFTER_MS` 80 s, `STUCK_AFTER_MS` 90 s).

Spec §4.6 and #s21. Reads the record by id (or, with no id after a lost answer, this account's record created at or after the tap — never "nothing sent": without one, the check-pending line and [Open Activity]). Broadcasting (< 80 s); slow (80–90 s: SLOW, the dashed ring, the hash, "Waiting · 1 m 23 s", "Recovery options will appear in 07 s"); at 90 s or `stuck` → #54; failed → #44; expired before #54 → #44's blockhash-expired, after #54 → #54's expired layout; success ("Sent", CONFIRMED, "Confirmed in N s" only when seen live, the fee paid from the record; [View details], [Done]; in the UI tab "Done — open the Noctura icon any time." and [Close this tab]). It polls only while shown.

- [ ] **Step 1: Write the failing test.**

Create `extension/src/app/__tests__/Status.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {renderInWallet, type Wallet} from './harness';
import {SLOW_AFTER_MS, STATUS_TEXT, STUCK_AFTER_MS, Status} from '../screens/Status';
import {STUCK_TEXT} from '../screens/Stuck';
import {FAILED_TEXT} from '../screens/Failed';
import {CLOSE_CHECK_MS} from '../ui/useCloseTab';
import {UI_SHEETS, selectorsOf, unstyledClasses} from '../../__tests__/styled';
import {PENDING_KEY, type PendingRecord} from '../../background/pendingStore';
import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixtures';
import {sig} from '../../../e2e/historyFixtures';
import type {Surface} from '../WalletContext';

// Spec §4.6 (#21): the pending record re-read every 2 s from wallet.pending, matched by id; #54 at 90 s or
// `stuck`, #44 on `failed` (and `expired` when #54 was never shown).
const SELECTORS = selectorsOf(UI_SHEETS);
const nav = {onDone: vi.fn(), onDetails: vi.fn(), onActivity: vi.fn(), onTryAgain: vi.fn(), onEdit: vi.fn()};
const SIGNATURE = sig(3);
const rec = (over: Partial<PendingRecord> = {}) =>
  pendingRecord({id: 'r1', account: ACCOUNT.publicKey, signature: SIGNATURE, createdAt: Date.now(), lastSentAt: Date.now(), lastValidBlockHeight: 1150, intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, feeLamports: '5050', ...over});

async function renderStatus(records: PendingRecord[], o: {id?: string | null; since?: number; surface?: Surface} = {}): Promise<Wallet & {reads: () => number}> {
  let reads = 0;
  const w = await renderInWallet(<Status account={ACCOUNT.publicKey} id={o.id === undefined ? 'r1' : o.id} since={o.since ?? 0} {...nav} />, {
    surface: o.surface,
    before: ext => ext.local.set(PENDING_KEY, records),
    gate: m => {
      if ((m as {type: string}).type === 'wallet.pending') reads += 1;
    },
  });
  return {...w, reads: () => reads};
}
const set = (w: Wallet, records: PendingRecord[]) => w.ext.local.set(PENDING_KEY, records);
const meta = () => [...document.querySelectorAll('.meta-row')].map(r => [r.querySelector('.lbl')?.textContent, r.querySelector('.val')?.textContent]);

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('#21 tx-status', () => {
  it('broadcasting (< 80 s): the ring, "Broadcasting transaction…", the amount, To in groups of four, "Broadcasting", the two honest lines, the disabled CTA', async () => {
    await renderStatus([rec()]);
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.sending)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.submitted)).toBeTruthy();
    expect(document.querySelector('.ring')?.className).toBe('ring broadcasting');
    expect(document.querySelector('.amount-card .amount')?.textContent).toBe('2.4800');
    expect(document.querySelector('.amount-card .noc-caption')?.textContent).toBe('≈ $372.00 USD');
    expect(meta()).toEqual([
      ['To', RECIPIENT],
      ['Status', STATUS_TEXT.statusBroadcasting],
    ]);
    expect([...document.querySelectorAll('.meta-row .addr-groups > span')].map(s => s.textContent)).toEqual(RECIPIENT.match(/.{1,4}/g));
    expect(screen.getByText(STATUS_TEXT.canClose)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.ifFails)).toBeTruthy();
    expect((screen.getByRole('button', {name: STATUS_TEXT.waiting}) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', {name: 'Back'}) as HTMLButtonElement).disabled).toBe(true);
    // Adapted: closing is allowed and said so — never "Don't close the app".
    expect(document.body.textContent).not.toMatch(/Don't close|Slot|8–12 s/);
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });

  it('slow (80–90 s): SLOW, the dashed ring, the honest sub, the hash with a copy, "Waiting · 1 m 23 s", recovery in 07 s', async () => {
    await renderStatus([rec({createdAt: Date.now() - 83_000})]);
    expect(await screen.findByText(STATUS_TEXT.slowLabel)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.slow)).toBeTruthy();
    expect(document.querySelector('.ring')?.className).toBe('ring stuck');
    expect(screen.getByText(STATUS_TEXT.slowSub)).toBeTruthy();
    expect(meta()).toEqual([
      ['To', RECIPIENT],
      ['Tx hash', SIGNATURE],
      ['Status', 'Waiting · 1 m 23 s'],
    ]);
    expect(screen.getByRole('button', {name: 'Copy transaction hash'})).toBeTruthy();
    expect(document.querySelector('.stuck-watch')?.textContent).toBe(`${STATUS_TEXT.recoveryIn}07 s`);
    expect(document.body.textContent).not.toMatch(/congested|mempool/);
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
  });

  it('at 90 s, or when the engine says stuck, #54 takes over', async () => {
    await renderStatus([rec({createdAt: Date.now() - STUCK_AFTER_MS})]);
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    cleanup();
    await renderStatus([rec({state: 'stuck'})]);
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    expect(SLOW_AFTER_MS).toBe(80_000);
  });

  it('success seen live: "Sent", CONFIRMED, "Confirmed in N s", the amount at 36 px, To, the full hash, the fee paid; [View details], [Done]', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const created = Date.now();
    const w = await renderStatus([rec({createdAt: created})]);
    await screen.findByText(STATUS_TEXT.broadcasting);
    vi.setSystemTime(created + 8_000);
    await set(w, [rec({createdAt: created, state: 'confirmed'})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(STATUS_TEXT.sentOk)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.sent)).toBeTruthy();
    expect(screen.getByText(STATUS_TEXT.confirmed)).toBeTruthy();
    expect(document.querySelector('.ring')?.className).toBe('ring success');
    expect(screen.getByText(/^Confirmed in \d+ s$/).textContent).toMatch(/^Confirmed in (9|10|11) s$/);
    expect(document.querySelector('.amount-card .amount')?.classList.contains('app-amount-big')).toBe(true);
    expect(meta()).toEqual([
      ['To', RECIPIENT],
      ['Tx hash', SIGNATURE],
      ['Fee paid', '0.00000505 SOL'],
    ]);
    expect(unstyledClasses(document.querySelector('.s-stat')!, SELECTORS)).toEqual([]);
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.details}));
    expect(nav.onDetails).toHaveBeenCalledWith(SIGNATURE);
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.done}));
    expect(nav.onDone).toHaveBeenCalledTimes(1);
  });

  it('opened on a send already confirmed: no "Confirmed in" (it was not seen live); a record from before plan 3 has no fee row', async () => {
    await renderStatus([rec({state: 'confirmed', feeLamports: null})]);
    expect(await screen.findByText(STATUS_TEXT.sentOk)).toBeTruthy();
    expect(screen.queryByText(/Confirmed in/)).toBeNull();
    expect(meta().map(r => r[0])).toEqual(['To', 'Tx hash']);
  });

  it('in the UI tab: "Done — open the Noctura icon any time." and [Close this tab], hidden when the browser keeps the tab', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([rec({state: 'confirmed'})], {surface: 'tab'});
    expect(await screen.findByText(STATUS_TEXT.doneTab)).toBeTruthy();
    expect(screen.queryByRole('button', {name: STATUS_TEXT.done})).toBeNull();
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.closeTab}));
    expect(w.platform.closed).toBe(1);
    await act(async () => void vi.advanceTimersByTime(CLOSE_CHECK_MS));
    expect(screen.queryByRole('button', {name: STATUS_TEXT.closeTab})).toBeNull();
  });

  it('failed → #44 by its failure; expired without #54 → #44’s blockhash-expired; expired after #54 → #54’s expired layout', async () => {
    await renderStatus([rec({state: 'failed', failure: 'landed', detail: 'x'})]);
    expect(await screen.findByText(FAILED_TEXT.rejectedHead)).toBeTruthy();
    cleanup();
    await renderStatus([rec({state: 'expired', detail: 'Not confirmed — no funds moved.'})]);
    expect(await screen.findByText(FAILED_TEXT.expiredHead)).toBeTruthy();
    cleanup();
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([rec({state: 'stuck'})]);
    expect(await screen.findByText(STUCK_TEXT.title)).toBeTruthy();
    await set(w, [rec({state: 'expired', detail: 'Not confirmed — no funds moved.'})]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(await screen.findByText(STUCK_TEXT.expiredHead)).toBeTruthy();
    expect(screen.queryByText(FAILED_TEXT.expiredHead)).toBeNull();
  });

  it('with no id (the send’s answer was lost): this account’s record from the tap on is tracked; none → the check-pending line and [Open Activity]', async () => {
    const since = Date.now() - 1_000;
    await renderStatus([rec({id: 'old', createdAt: since - 10_000, state: 'confirmed'}), rec({id: 'new', createdAt: since + 5})], {id: null, since});
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    cleanup();
    await renderStatus([rec({id: 'old', createdAt: since - 10_000, state: 'confirmed'})], {id: null, since});
    expect(await screen.findByText(STATUS_TEXT.unsure)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/nothing (was )?sent/i);
    fireEvent.click(screen.getByRole('button', {name: STATUS_TEXT.openActivity}));
    expect(nav.onActivity).toHaveBeenCalledTimes(1);
  });

  it('an id the engine no longer has: "This transaction is no longer tracked."', async () => {
    await renderStatus([], {id: 'gone'});
    expect(await screen.findByText(STUCK_TEXT.untracked)).toBeTruthy();
  });

  it('the engine’s detail shows as a caption under the status', async () => {
    await renderStatus([rec({detail: 'Not acknowledged yet; still watching. "Send again" re-sends the same transaction.'})]);
    expect(await screen.findByText('Not acknowledged yet; still watching. "Send again" re-sends the same transaction.')).toBeTruthy();
  });

  it('reads every 2 s while shown, and not once after it is left', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await renderStatus([rec()]);
    await screen.findByText(STATUS_TEXT.broadcasting);
    const first = w.reads();
    await act(async () => void vi.advanceTimersByTime(4_000));
    await waitFor(() => expect(w.reads()).toBeGreaterThanOrEqual(first + 2));
    cleanup();
    const unmounted = w.reads();
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(w.reads()).toBe(unmounted);
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/Status.test.tsx
```
Expected (dry run): FAIL — Test Files 1 failed (1) · Tests no tests (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 7d1bfd1..4237342 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -625,9 +625,6 @@ a.btn {
   display: block;
   margin-bottom: 2px;
 }
-.s-conf .first-time-banner .app-secondary {
-  color: var(--fg-secondary);
-}
 .s-conf .review-card.high-value .eyebrow {
   color: var(--danger);
 }
@@ -674,3 +671,55 @@ a.btn {
   flex-direction: column;
   gap: var(--space-3);
 }
+
+/* #21 status (plan 3): index.html #s21's inline styles — the success amount at 36/42, the coloured stage label
+   and top-bar step (CONFIRMED, SLOW), the pulsing status dot, the stuck watcher's head, the reassurance line. */
+.app-secondary {
+  color: var(--fg-secondary);
+}
+.s-stat .amount-card .amount.app-amount-big {
+  font-size: 36px;
+  line-height: 42px;
+}
+.s-stat .stage-label.app-success,
+.s-stat .top-bar .step.app-success {
+  color: var(--success);
+}
+.s-stat .stage-label.app-warning,
+.s-stat .top-bar .step.app-warning,
+.s-stat .meta-row .val.app-warning {
+  color: var(--warning);
+}
+.s-stat .meta-row .val.app-live {
+  color: var(--accent);
+  display: inline-flex;
+  align-items: center;
+  gap: var(--space-2);
+}
+.s-stat .meta-row .val.app-live::before {
+  content: '';
+  width: 8px;
+  height: 8px;
+  border-radius: 50%;
+  background: var(--accent);
+  animation: zk-pulse 1.4s ease-in-out infinite;
+}
+@media (prefers-reduced-motion: reduce) {
+  .s-stat .meta-row .val.app-live::before {
+    animation: none;
+  }
+}
+.s-stat .meta-row .copy {
+  border: 0;
+  cursor: pointer;
+}
+.s-stat .stuck-watch .app-watch-head {
+  font: 500 12px/16px var(--font-body);
+  color: var(--fg-primary);
+}
+.app-reassure {
+  margin: var(--space-1) var(--space-4) 0;
+}
+.app-tab-done {
+  margin: 0 var(--space-5) var(--space-4);
+}
```

Create `extension/src/app/screens/Status.tsx`:

```tsx
import {useCallback, useEffect, useRef, useState} from 'react';
import {useWallet, PENDING_POLL_MS} from '../WalletContext';
import {showUsd} from '../format';
import {showExact, showLamports, usdOf, type Draft} from '../send/rules';
import {AddressGroups} from '../../../../web/src/ui/AddressGroups';
import {ExtIcon} from '../ui/ExtIcon';
import {LockedButton} from '../ui/LockedButton';
import {useCopy} from '../ui/useCopy';
import {useCloseTab} from '../ui/useCloseTab';
import {useEscape} from '../ui/useEscape';
import {useNow} from '../useNow';
import {Stuck, STUCK_TEXT} from './Stuck';
import {Failed} from './Failed';
import type {Intent, Pending} from '../engine';

/** The fixed strings #21 shows (spec §4.6); adapted ones are marked there. */
export const STATUS_TEXT = {
  sending: 'Sending…',
  broadcasting: 'Broadcasting transaction…',
  submitted: 'Submitted to Solana mainnet · waiting for first confirmation',
  statusBroadcasting: 'Broadcasting',
  canClose: 'You can close this window — Noctura keeps watching this transaction.',
  ifFails: 'If this fails, your funds stay in your wallet — no fees are charged until the network accepts the transaction.',
  waiting: 'Waiting for confirmation',
  slow: 'SLOW',
  slowLabel: 'Taking longer than usual',
  slowSub: "The network hasn't included it in a block yet.",
  recoveryIn: 'Recovery options will appear in',
  sent: 'Sent',
  confirmed: 'CONFIRMED',
  sentOk: 'Sent successfully',
  details: 'View details',
  done: 'Done',
  doneTab: 'Done — open the Noctura icon any time.',
  closeTab: 'Close this tab',
  checking: 'Checking whether it was sent…',
  unsure: 'We could not confirm whether it was sent. Check Activity before trying again.',
  openActivity: 'Open Activity',
} as const;

/** #21 shows its stuck warning from 80 s, and #54 from 90 s or when the engine says `stuck` (spec §4.6). */
export const SLOW_AFTER_MS = 80_000;
export const STUCK_AFTER_MS = 90_000;

function CopyIcon({value, label}: {value: string; label: string}) {
  const [state, copy] = useCopy();
  return (
    <button type="button" className="copy" aria-label={state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : label} onClick={() => copy(value)}>
      <ExtIcon name={state === 'copied' ? 'check' : state === 'failed' ? 'close' : 'copy'} size={14} />
    </button>
  );
}

/**
 * #21 tx-status (spec §4.6), and the screen #54 and #44 grow out of: the pending record from wallet.send (or
 * #20's lookup), re-read every 2 s from wallet.pending and matched by id. With no id (a send whose answer was
 * lost), it looks for this account's record created at or after the tap — never "nothing sent": without one it
 * sends the user to Activity. Every read checks it is still the screen's own (unmount, a newer read).
 */
export function Status({
  account,
  id,
  since,
  onDone,
  onDetails,
  onActivity,
  onTryAgain,
  onEdit,
}: {
  account: string;
  id: string | null;
  since: number;
  onDone: () => void;
  onDetails: (signature: string) => void;
  onActivity: () => void;
  onTryAgain: (intent: Intent) => void;
  onEdit: (draft: Draft) => void;
}) {
  const m = useWallet();
  const {engine, now: clock, platform, surface} = m;
  const now = useNow(1_000, clock);
  const tab = useCloseTab(platform);
  const [tracked, setTracked] = useState<string | null>(id);
  const [record, setRecord] = useState<Pending | null>(null);
  const [read, setRead] = useState(false);
  /** Seen open on this screen: a confirmation then is "Confirmed in N s" (only what this screen saw live). */
  const sawOpen = useRef(false);
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);
  /** #54 once shown stays #54: an expiry seen there is its expired layout, not #44's. */
  const stuckShown = useRef(false);
  const alive = useRef(true);
  const trackedRef = useRef<string | null>(id);

  const poll = useCallback(async () => {
    const r = await engine.pending();
    if (!alive.current || !r.ok) return;
    let mine = trackedRef.current;
    if (mine === null) {
      const found = r.data.find(p => p.account === account && p.createdAt >= since);
      if (found !== undefined) {
        mine = found.id;
        trackedRef.current = mine;
        setTracked(mine);
      }
    }
    const rec = mine === null ? null : (r.data.find(p => p.id === mine) ?? null);
    if (rec !== null && (rec.state === 'pending' || rec.state === 'stuck')) sawOpen.current = true;
    if (rec !== null && rec.state === 'confirmed' && sawOpen.current) setConfirmedAt(c => c ?? clock());
    setRecord(rec);
    setRead(true);
  }, [engine, account, since, clock]);

  useEffect(() => {
    alive.current = true;
    void poll();
    const t = setInterval(() => void poll(), PENDING_POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(t);
    };
  }, [poll]);

  const success = record?.state === 'confirmed';
  useEscape(onDone, success);

  if (record !== null && (record.state === 'failed' || (record.state === 'expired' && !stuckShown.current))) {
    return <Failed record={record} onTryAgain={onTryAgain} onEdit={onEdit} onDetails={onDetails} />;
  }
  if (record !== null && (record.state === 'expired' || ((record.state === 'stuck' || now - record.createdAt >= STUCK_AFTER_MS || stuckShown.current) && record.state !== 'confirmed'))) {
    stuckShown.current = true;
    return <Stuck record={record} now={now} onClose={onDone} onActivity={onActivity} onTryAgain={onTryAgain} />;
  }

  if (record === null) {
    const unsure = read && tracked === null;
    const untracked = read && tracked !== null;
    return (
      <div className="screen s-stat">
        <div className="top-bar">
          <button type="button" className="icon-btn" aria-label="Close" disabled={!read} onClick={onDone}>
            <ExtIcon name="close" size={22} />
          </button>
          <div className="title noc-h1">{STATUS_TEXT.sending}</div>
        </div>
        <div className="scroll">
          <div className="hero">
            <p className="stage-sub" role="status">
              {unsure ? STATUS_TEXT.unsure : untracked ? STUCK_TEXT.untracked : STATUS_TEXT.checking}
            </p>
          </div>
        </div>
        {unsure || untracked ? (
          <div className="sticky-bar">
            <button type="button" className="btn btn-primary" onClick={onActivity}>
              {STATUS_TEXT.openActivity}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const token = record.intent.token;
  const usd = usdOf(token, record.intent.amount, m.prices);
  const amountCard = (big: boolean) => (
    <div className="amount-card">
      <span className="eyebrow">Amount</span>
      <div className="amount-line">
        <span className={`amount noc-numeral${big ? ' noc-balance-lg app-amount-big' : ''}`}>{showExact(token, record.intent.amount)}</span>
        <span className="ticker">{token}</span>
      </div>
      {usd === null ? null : <span className={`noc-caption noc-numeral ${big ? 'app-secondary' : 'app-dim'}`}>≈ {showUsd(usd)} USD</span>}
    </div>
  );
  const toRow = (
    <div className="meta-row">
      <span className="lbl">To</span>
      <span className="val mono noc-mono">
        <AddressGroups address={record.intent.recipient} />
      </span>
      <CopyIcon value={record.intent.recipient} label="Copy recipient" />
    </div>
  );
  const hashRow = (
    <div className="meta-row">
      <span className="lbl">Tx hash</span>
      <span className="val mono noc-mono">{record.signature}</span>
      <CopyIcon value={record.signature} label="Copy transaction hash" />
    </div>
  );
  const caption = record.detail === null ? null : <p className="noc-caption app-muted app-center-text">{record.detail}</p>;

  if (success) {
    const fee = record.feeLamports;
    return (
      <div className="screen s-stat">
        <div className="top-bar">
          <button type="button" className="icon-btn" aria-label="Close" onClick={onDone}>
            <ExtIcon name="close" size={22} />
          </button>
          <div className="title noc-h1">{STATUS_TEXT.sent}</div>
          <span className="step noc-overline app-success">{STATUS_TEXT.confirmed}</span>
        </div>
        <div className="scroll">
          <div className="hero">
            <div className="ring success">
              <ExtIcon name="check" size={56} />
            </div>
            <div className="stage-label app-success">{STATUS_TEXT.sentOk}</div>
            {confirmedAt === null ? null : <div className="stage-sub">Confirmed in {Math.max(1, Math.round((confirmedAt - record.createdAt) / 1000))} s</div>}
            {amountCard(true)}
            <div className="meta-grid">
              {toRow}
              {hashRow}
              {fee === null ? null : (
                <div className="meta-row">
                  <span className="lbl">Fee paid</span>
                  <span className="val noc-numeral">{showLamports(fee)} SOL</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="sticky-bar row">
          <button type="button" className="btn btn-secondary" onClick={() => onDetails(record.signature)}>
            <ExtIcon name="doc" size={18} />
            {STATUS_TEXT.details}
          </button>
          {surface === 'popup' ? (
            <button type="button" className="btn btn-primary" onClick={onDone}>
              <ExtIcon name="check" size={18} />
              {STATUS_TEXT.done}
            </button>
          ) : tab.refused ? null : (
            <LockedButton className="btn btn-primary" onPress={tab.close}>
              {STATUS_TEXT.closeTab}
            </LockedButton>
          )}
        </div>
        {surface === 'tab' ? <p className="noc-caption app-muted app-center-text app-tab-done">{STATUS_TEXT.doneTab}</p> : null}
      </div>
    );
  }

  const age = now - record.createdAt;
  const slow = age >= SLOW_AFTER_MS;
  const waited = Math.max(0, Math.floor(age / 1000));
  const left = Math.max(0, Math.ceil((STUCK_AFTER_MS - age) / 1000));
  return (
    <div className="screen s-stat">
      <div className="top-bar">
        <button type="button" className="icon-btn" aria-label="Back" disabled>
          <ExtIcon name="back" size={22} />
        </button>
        <div className="title noc-h1">{STATUS_TEXT.sending}</div>
        <span className={`step noc-overline${slow ? ' app-warning' : ''}`}>{slow ? STATUS_TEXT.slow : ''}</span>
      </div>
      <div className="scroll">
        <div className="hero">
          <div className={`ring ${slow ? 'stuck' : 'broadcasting'}`}>
            <ExtIcon name="send" size={56} />
          </div>
          <div className={`stage-label${slow ? ' app-warning' : ''}`}>{slow ? STATUS_TEXT.slowLabel : STATUS_TEXT.broadcasting}</div>
          <div className={`stage-sub${slow ? ' is-warn' : ''}`}>{slow ? STATUS_TEXT.slowSub : STATUS_TEXT.submitted}</div>
          {amountCard(false)}
          <div className="meta-grid">
            {toRow}
            {slow ? hashRow : null}
            <div className="meta-row">
              <span className="lbl">Status</span>
              <span className={`val ${slow ? 'app-warning' : 'app-live'}`}>{slow ? `Waiting · ${Math.floor(waited / 60)} m ${waited % 60} s` : STATUS_TEXT.statusBroadcasting}</span>
            </div>
          </div>
          {slow ? (
            <div className="stuck-watch" role="status">
              <ExtIcon name="info" size={16} />
              <div className="app-watch-head">{STATUS_TEXT.recoveryIn}</div>
              <span className="countdown noc-numeral">{String(left).padStart(2, '0')} s</span>
            </div>
          ) : null}
        </div>
        {caption}
        <p className="noc-caption app-muted app-center-text">{STATUS_TEXT.canClose}</p>
        <p className="noc-caption app-muted app-center-text app-reassure">{STATUS_TEXT.ifFails}</p>
      </div>
      <div className="sticky-bar">
        <button type="button" className="btn btn-secondary" disabled>
          {STATUS_TEXT.waiting}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 9102231..d9c9afc 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1650,6 +1650,14 @@ point here. **One user tap per broadcast, always (D38; review B1).**
     still watching. \"Send again\" re-sends the same transaction.") shows as a caption under the
     status.
 - **Differs:**
+  - **Plan 3:** the slow state's disabled CTA keeps "Waiting for confirmation" (the design's "Waiting
+    for inclusion · 1:23" names a mempool the engine cannot see), and its stuck-watch box shows "Recovery
+    options will appear in" with the countdown, without the design's developer caption ("Silent watcher
+    routes to stuck-tx after 90 s …"). The To and hash rows' copy buttons keep the design's 32 px chip.
+    "Fee paid" is the pending record's own `feeLamports` (plan 3: what the prepared send pays — network fee
+    plus the Noctura fee — kept on the record so a reopened popup shows it too); a record from before plan 3
+    has no such row. An id the engine no longer tracks reads "This transaction is no longer tracked." (#54's
+    line) with `[Open Activity]`.
   - "Slot" row removed (not in `PendingView`).
   - "Confirmed in 2 blocks · finalized" replaced as marked.
   - The back arrow stays disabled while broadcasting (design); closing the popup is allowed and
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/Status.test.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 1 passed (1) · Tests 11 passed (11); tsc clean; whole suite Test Files 110 passed (110) · Tests 1926 passed (1926).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M12a** — `extension/src/app/screens/Status.tsx`:

  ```diff
  - export const STUCK_AFTER_MS = 90_000;
  + export const STUCK_AFTER_MS = 95_000;
  ```
  `npx vitest run src/app/__tests__/Status.test.tsx` — Expected: **red** (1 failed | 10 passed (11)).

- **M12b** — `extension/src/app/screens/Status.tsx`:

  ```diff
  -       alive.current = false;
  -       clearInterval(t);
  +       clearInterval(t);
  +       void 0;
  ```
  `npx vitest run src/app/__tests__/Status.test.tsx` — Expected: green (11 passed (11)) — **an equivalent mutant**: the only effect of the flag after unmount is a `setState` on an unmounted component, which React 18 ignores; nothing observable changes. Kept in the list so a reviewer does not re-discover it.

- [ ] **Step 7: The §8 visual checklist for this screen.** Task 17 shoots every state of this screen; after it, the opus-tier reviewer checks them against index.html with the checklist in Task 17. Nothing to run here; the component tests above already assert every string.

- [ ] **Step 8: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/app/__tests__/Status.test.tsx extension/src/app/app.css extension/src/app/screens/Status.tsx
git commit -F - <<'MSG'
feat(extension): #21 tx-status — the pending record read every 2 s, slow at 80 s, #54 at 90 s, #44 on failure

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 13: The flow's routes and the resume hand-over: `#/send/resume` is #20 (the stand-in removed)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/e2e/wallet.spec.ts`
- Modify: `extension/src/app/App.tsx`
- Modify: `extension/src/app/__tests__/Created.test.tsx`
- Modify: `extension/src/app/__tests__/router.test.ts`
- Create: `extension/src/app/__tests__/sendFlow.test.tsx`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/mount.tsx`
- Modify: `extension/src/app/router.ts`
- Delete: `extension/src/app/screens/Resume.tsx`

**Interfaces:**
- Consumes: Tasks 7–12; `router.ts` (`firstRoute`, `routeReducer`), `App.tsx`'s Shell, the quiet provider (plan 2).
- Produces: routes `send`, `review`, `confirm`, `status` and the first route `resume`; actions `replace`, `reset`; `FLOW`, `TAB_ONLY`; `Resume.tsx` deleted; App's `onLeaveHandOver`; the popup's open-sequence resume.

Spec §1.6 and §4.5. `#/send/resume?account=<address>` now renders #20's resume entry (the stand-in `Resume.tsx` is deleted); the hash only selects the screen and carries no data (a non-address account is #11). The tab's provider stays **quiet** on the hand-over route — the state plus what #20 reads itself — and becomes a wallet surface when the user moves on (#21, #19 or #12). A popup opened while a prepared send waits shows #20 resume (once, and only if the user has not gone anywhere). The flow's pushed routes carry only what the user typed (draft, intent) and which account/record to read — never a prepared send. `e2e/wallet.spec.ts`'s reauthenticate helper now expects #20's "Confirmed. Review the fresh quote and send." and taps once. `mount.tsx`'s StrictMode note gains review L7: in `vite dev` an expired resume may re-prepare twice — harmless, absent from production, not to be "fixed".

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/wallet.spec.ts`:

```diff
diff --git a/extension/e2e/wallet.spec.ts b/extension/e2e/wallet.spec.ts
index 3fefab0..fa4ad91 100644
--- a/extension/e2e/wallet.spec.ts
+++ b/extension/e2e/wallet.spec.ts
@@ -61,7 +61,7 @@ const pendingState = async (page: Page, signature: string): Promise<string | und
 
 /**
  * Re-authenticate a challenge through the real vault page (#10). After the proof the same tab hands
- * over to the UI tab's resume route (D38) — nothing is sent from the vault page.
+ * over to the UI tab's resume route, #20 (D38) — nothing is sent from the vault page, nor from #20 untapped.
  */
 async function reauthenticate(ctx: BrowserContext, fake: FakeCoordinator, id: string, challengeId: string, password: string, account: string): Promise<void> {
   const vault = await ctx.newPage();
@@ -72,11 +72,11 @@ async function reauthenticate(ctx: BrowserContext, fake: FakeCoordinator, id: st
     await vault.fill('#ra-password', password);
     await vault.click('#ra-confirm');
     await vault.waitForURL(`chrome-extension://${id}/wallet.html#/send/resume?account=${account}`, {timeout: 60_000});
-    // The resume stand-in, in a real browser (plan-2 review M7): it renders, and it sends nothing.
-    await expect(vault.getByText('Open the Noctura icon to continue.')).toBeVisible();
-    // Not one instant (Task 17 review 3): the stand-in stays open for a polled 3 s window, and at every sample
-    // nothing was broadcast and the tab never asked for a send. The recorder covers this one tab only (the
-    // vault page and the stand-in it hands over to); the popup's own sends below are not in it.
+    // #20 confirmed, in the same tab (D38, plan 3): it renders the fresh preview, and it sends nothing.
+    await expect(vault.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible();
+    // Not one instant (Task 17 review 3): #20 stays open for a polled 3 s window, and at every sample nothing
+    // was broadcast and the tab never asked for a send. The recorder covers this one tab only (the vault page
+    // and the #20 it hands over to); the popup's own sends below are not in it.
     const quietUntil = Date.now() + 3_000;
     await expect
       .poll(
```

Modify `extension/src/app/__tests__/Created.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/Created.test.tsx b/extension/src/app/__tests__/Created.test.tsx
index 052bcf6..d787e30 100644
--- a/extension/src/app/__tests__/Created.test.tsx
+++ b/extension/src/app/__tests__/Created.test.tsx
@@ -108,36 +108,9 @@ describe('#7 onboard-success (wallet.html#/created)', () => {
   });
 });
 
-// Spec §12 plan 2: #10's hand-over lands here; until plan 3 makes it #20 it says where to go — and sends nothing.
-describe('the resume stand-in (wallet.html#/send/resume?account=…)', () => {
-  it('"Open the Noctura icon to continue." — it prepares, reads and sends nothing', async () => {
-    const sent: string[] = [];
-    await renderApp({surface: 'tab', hash: `#/send/resume?account=${ACCOUNT.publicKey}`, spy: m => void sent.push((m as {type: string}).type)});
-    expect(await screen.findByText('Open the Noctura icon to continue.')).toBeTruthy();
-    await new Promise(r => setTimeout(r, 20));
-    expect(sent.filter(t => t !== 'wallet.state')).toEqual([]);
-    expect(screen.getByRole('button', {name: 'Close this tab'})).toBeTruthy();
-  });
-
-  it('[Close this tab] closes the tab, once per click window', async () => {
-    const {platform} = await renderApp({surface: 'tab', hash: `#/send/resume?account=${ACCOUNT.publicKey}`});
-    const close = await screen.findByRole('button', {name: 'Close this tab'});
-    fireEvent.click(close);
-    fireEvent.click(close);
-    expect(platform.closed).toBe(1);
-  });
-
-  it('an account that is not an address falls to #11: the hash only chooses a screen', async () => {
-    await renderApp({surface: 'tab', hash: '#/send/resume?account=not-an-address'});
-    expect(await screen.findByText('TOKENS')).toBeTruthy();
-    expect(screen.queryByText('Open the Noctura icon to continue.')).toBeNull();
-  });
-});
-
 // Task 15 fix round 1 (I-1, m-1): a quiet provider reads the state only, whatever happens in the page —
 // the browser's online event, a tab coming back into view or focus, user input (no activity.ping: a
 // hand-over page does not keep the wallet unlocked).
-const STAND_IN = `#/send/resume?account=${ACCOUNT.publicKey}`;
 async function pageEvents(): Promise<void> {
   await act(async () => {
     window.dispatchEvent(new Event('offline'));
@@ -157,10 +130,8 @@ async function pageEvents(): Promise<void> {
 }
 
 describe('a quiet provider stays quiet (fix round 1)', () => {
-  it.each([
-    ['#7', '#/created', 'Wallet created'],
-    ['the stand-in', STAND_IN, 'Open the Noctura icon to continue.'],
-  ])('%s: online, visibility, focus, pageshow and input send wallet.state only', async (_name, hash, text) => {
+  // Plan 3: the resume route is #20 now, which reads its own prepared send — its quiet test is in sendFlow.test.tsx.
+  it.each([['#7', '#/created', 'Wallet created']])('%s: online, visibility, focus, pageshow and input send wallet.state only', async (_name, hash, text) => {
     vi.useFakeTimers({shouldAdvanceTime: true});
     try {
       const sent: string[] = [];
@@ -190,12 +161,6 @@ describe('a quiet provider stays quiet (fix round 1)', () => {
 });
 
 describe('the hand-over screens without a wallet or an account (fix round 1)', () => {
-  it('m-3: the stand-in with no wallet shows the tab’s no-wallet screen', async () => {
-    await renderApp({surface: 'tab', hash: STAND_IN, wallet: false});
-    expect(await screen.findByText('No wallet on this browser yet.')).toBeTruthy();
-    expect(screen.queryByText('Open the Noctura icon to continue.')).toBeNull();
-  });
-
   it('#7 with no wallet shows the tab’s no-wallet screen too', async () => {
     await renderApp({surface: 'tab', hash: '#/created', wallet: false});
     expect(await screen.findByText('No wallet on this browser yet.')).toBeTruthy();
```

Modify `extension/src/app/__tests__/router.test.ts`:

```diff
diff --git a/extension/src/app/__tests__/router.test.ts b/extension/src/app/__tests__/router.test.ts
index 50b3aa7..c2915e8 100644
--- a/extension/src/app/__tests__/router.test.ts
+++ b/extension/src/app/__tests__/router.test.ts
@@ -1,12 +1,12 @@
 // @vitest-environment happy-dom
-import {SCREENS, TAB_ONLY, firstRoute, routeReducer, type Route} from '../router';
+import {FLOW, SCREENS, TAB_ONLY, firstRoute, routeReducer, type Route} from '../router';
 
 const HOME: Route[] = [{screen: 'tab', tab: 'home'}];
 
 const ADDR = 'HAgk14JpMQLgt6rVgv7cBQFJWFto5Dqxi472uT3DKpqk';
 
-// Spec §1.6: an in-memory stack; "No hash causes an action." No route leads into the send flow until
-// plan 3; the resume hand-over is a plan-2 stand-in that only says where to go.
+// Spec §1.6: an in-memory stack; "No hash causes an action." The send flow's routes (plan 3) carry only what
+// the user typed and which account and record a screen reads; the tab's resume route is #20, first route only.
 describe('the router', () => {
   it('push, pop (never below the first route), and a tab resets the stack', () => {
     const s1 = routeReducer(HOME, {type: 'push', route: {screen: 'receive'}});
@@ -16,17 +16,50 @@ describe('the router', () => {
     expect(routeReducer([...s1, {screen: 'about'}], {type: 'tab', tab: 'activity'})).toEqual([{screen: 'tab', tab: 'activity'}]);
   });
 
-  it('the pushable screens are a closed list with no send; the hand-over screens are first routes only', () => {
-    expect([...SCREENS].sort()).toEqual(['about', 'receive', 'tab', 'tx']);
+  it('the pushable screens are a closed list; the hand-over screens are first routes only; the flow screens own their Esc', () => {
+    expect([...SCREENS].sort()).toEqual(['about', 'confirm', 'receive', 'review', 'send', 'status', 'tab', 'tx']);
     expect([...TAB_ONLY].sort()).toEqual(['created', 'imported', 'resume']);
+    expect([...FLOW].sort()).toEqual(['confirm', 'resume', 'review', 'send', 'status']);
     for (const route of [{screen: 'created'}, {screen: 'imported'}, {screen: 'resume', account: ADDR}] as Route[]) expect(routeReducer(HOME, {type: 'push', route})).toBe(HOME);
   });
 
-  it.each(['send', 'resume', 'send/resume', 'confirm'])('refuses a pushed "%s" route: the stack is unchanged', screen => {
+  it.each(['resume', 'send/resume', 'sign', 'broadcast'])('refuses a pushed "%s" route: the stack is unchanged', screen => {
     const forged = {screen} as unknown as Route;
     expect(routeReducer(HOME, {type: 'push', route: forged})).toBe(HOME);
   });
 
+  it('the flow routes: a draft is the user’s text, an intent an address and a positive u64, a status id 32 hex or null', () => {
+    const ok: Route[] = [
+      {screen: 'send', draft: null, notice: null},
+      {screen: 'send', draft: {token: 'SOL', recipient: 'typed', amount: '1.'}, notice: 'start-again'},
+      {screen: 'review', account: ADDR, intent: {token: 'NOC', recipient: ADDR, amount: 1n}, notice: null},
+      {screen: 'confirm', account: ADDR, entry: 'flow'},
+      {screen: 'status', account: ADDR, id: 'ab'.repeat(16), since: 1},
+      {screen: 'status', account: ADDR, id: null, since: 1},
+    ];
+    for (const route of ok) expect(routeReducer(HOME, {type: 'push', route})).toEqual([...HOME, route]);
+    const bad = [
+      {screen: 'send', draft: {token: 'BONK', recipient: '', amount: ''}, notice: null},
+      {screen: 'send', draft: null, notice: 'go'},
+      {screen: 'review', account: ADDR, intent: {token: 'SOL', recipient: ADDR, amount: 0n}, notice: null},
+      {screen: 'review', account: 'nope', intent: {token: 'SOL', recipient: ADDR, amount: 1n}, notice: null},
+      {screen: 'confirm', account: ADDR, entry: 'auto'},
+      {screen: 'status', account: ADDR, id: 'r1', since: 1},
+      {screen: 'status', account: ADDR, id: null, since: Number.NaN},
+    ];
+    for (const route of bad) expect(routeReducer(HOME, {type: 'push', route: route as unknown as Route})).toBe(HOME);
+  });
+
+  it('replace swaps the top route; reset replaces the stack — each refused whole if any route is malformed', () => {
+    const send: Route = {screen: 'send', draft: null, notice: null};
+    const s1 = routeReducer([...HOME, send], {type: 'replace', route: {screen: 'send', draft: {token: 'SOL', recipient: 'a', amount: '1'}, notice: null}});
+    expect(s1).toEqual([...HOME, {screen: 'send', draft: {token: 'SOL', recipient: 'a', amount: '1'}, notice: null}]);
+    expect(routeReducer(s1, {type: 'reset', routes: [...HOME, {screen: 'status', account: ADDR, id: null, since: 5}]})).toEqual([...HOME, {screen: 'status', account: ADDR, id: null, since: 5}]);
+    expect(routeReducer(s1, {type: 'reset', routes: [...HOME, {screen: 'resume', account: ADDR}]})).toBe(s1);
+    expect(routeReducer(s1, {type: 'reset', routes: []})).toBe(s1);
+    expect(routeReducer(s1, {type: 'replace', route: {screen: 'created'}})).toBe(s1);
+  });
+
   it('refuses a route of a known screen with a malformed shape', () => {
     expect(routeReducer(HOME, {type: 'push', route: {screen: 'tx'} as unknown as Route})).toBe(HOME);
     expect(routeReducer(HOME, {type: 'tab', tab: 'send' as unknown as 'home'})).toBe(HOME);
@@ -39,17 +72,11 @@ describe('the router', () => {
     },
   );
 
-  it('the tab reads #/created (#7), #/imported (#40) and #/send/resume?account=<address> (the plan-2 stand-in); the popup ignores the hash', () => {
+  it('the tab reads #/created (#7), #/imported (#40) and #/send/resume?account=<address> (#20 after #10); the popup ignores the hash', () => {
     expect(firstRoute('tab', '#/created')).toEqual([{screen: 'created'}]);
     expect(firstRoute('tab', '#/imported')).toEqual([{screen: 'imported'}]);
     expect(firstRoute('tab', `#/send/resume?account=${ADDR}`)).toEqual([{screen: 'resume', account: ADDR}]);
     expect(firstRoute('popup', '#/created')).toEqual(HOME);
     expect(firstRoute()).toEqual(HOME);
   });
-
-  it('the Route type itself has no send screen', () => {
-    // @ts-expect-error — plan 2's Route has no 'send' screen (tsc fails this file if one is added).
-    const r: Route = {screen: 'send'};
-    expect(r.screen).toBe('send');
-  });
 });
```

Create `extension/src/app/__tests__/sendFlow.test.tsx`:

```tsx
// @vitest-environment happy-dom
import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {sendingReader, setupWallet, type Wallet} from './harness';
import {App} from '../App';
import {createEngine, type Intent} from '../engine';
import type {Surface} from '../WalletContext';
import {CONFIRM_TEXT} from '../screens/Confirm';
import {REVIEW_TEXT} from '../screens/Review';
import {STATUS_TEXT} from '../screens/Status';
import {CANCELLED_TEXT} from '../ui/CancelledToast';
import {KNOWN_RECIPIENTS_KEY} from '../../background/knownRecipients';
import {satisfyChallenge} from '../../background/reauthChallenges';
import {firstSignature} from '../../../../core/solana/broadcast';
import {ACCOUNT} from '../../background/__tests__/fixtures';
import {COUNTERPARTY} from '../../../e2e/historyFixtures';

// The send flow wired into the shell (spec §1.6, §4.5): the UI tab's resume route is #20 (D38), the popup resumes a
// waiting send on open, and every way between the flow's screens. One tap per broadcast, whatever opened #20.
const INTENT: Intent = {token: 'SOL', recipient: COUNTERPARTY, amount: 10_000_000n};
const RESUME = `#/send/resume?account=${ACCOUNT.publicKey}`;

async function app(o: {surface?: Surface; hash?: string; prepare?: boolean; prove?: boolean; known?: boolean} = {}): Promise<Wallet & {sent: string[]; sends: () => number}> {
  const sent: string[] = [];
  const w = await setupWallet({
    surface: o.surface,
    reader: sendingReader(),
    deps: {now: () => Date.now(), broadcast: async wire => firstSignature(wire)},
    before: async ext => {
      if (o.known === true) await ext.local.set(KNOWN_RECIPIENTS_KEY, [COUNTERPARTY]);
    },
  });
  if (o.prepare !== false) {
    const p = await w.engine.prepareSend(ACCOUNT.publicKey, INTENT);
    if (!p.ok) throw new Error(p.error);
    if (o.prove === true && p.data.reauth !== null) await satisfyChallenge(w.ext, Date.now(), p.data.reauth.challengeId);
  }
  const engine = createEngine(m => {
    sent.push((m as {type: string}).type);
    return w.transport(m);
  }, async () => undefined);
  render(<App surface={o.surface ?? 'popup'} engine={engine} platform={w.platform} hash={o.hash ?? ''} />);
  return {...w, engine, sent, sends: () => sent.filter(t => t === 'wallet.send').length};
}
const sendButton = async () => (await screen.findByRole('button', {name: /^Send 0\.0100 SOL$/})) as HTMLButtonElement;

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe('the UI tab’s resume route is #20 (D38)', () => {
  it('after #10: "Confirmed…", read through wallet.preparedFor only — no send in 10 s; one tap sends once and #21 tracks it', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({surface: 'tab', hash: RESUME, prove: true});
    expect(await screen.findByText(CONFIRM_TEXT.confirmed)).toBeTruthy();
    await sendButton();
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(w.sends()).toBe(0);
    // The quiet provider: the state, and what #20 reads itself — no cache, balances or ping on a hand-over route.
    expect([...new Set(w.sent)].sort()).toEqual(['wallet.pending', 'wallet.preparedFor', 'wallet.prices', 'wallet.state']);
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    expect(w.sends()).toBe(1);
    // Left the hand-over route: the tab is a wallet surface now, and runs the open sequence.
    await waitFor(() => expect(w.sent).toEqual(expect.arrayContaining(['wallet.cached', 'wallet.balances'])));
  });

  it('a send with no re-authentication, resumed: no send until the tap', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({surface: 'tab', hash: RESUME, known: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    await act(async () => void vi.advanceTimersByTime(10_000));
    expect(w.sends()).toBe(0);
    fireEvent.click(await sendButton());
    await waitFor(() => expect(w.sends()).toBe(1));
  });

  it('page events on the resume route (online, focus, input) read nothing more — the provider stays quiet', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({surface: 'tab', hash: RESUME, known: true});
    await sendButton();
    const before = new Set(w.sent);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('focus'));
      vi.setSystemTime(Date.now() + 31_000);
      fireEvent.pointerDown(document);
      fireEvent.keyDown(document, {key: 'a'});
    });
    await act(async () => void vi.advanceTimersByTime(50));
    expect(new Set(w.sent)).toEqual(before);
    expect(w.sent).not.toContain('activity.ping');
  });

  it('nothing to resume: the flow starts at #12; a hash whose account is not an address is #11 (the hash only chooses a screen)', async () => {
    await app({surface: 'tab', hash: RESUME, prepare: false});
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    expect((screen.getByLabelText('Recipient') as HTMLInputElement).value).toBe('');
    cleanup();
    await app({surface: 'tab', hash: '#/send/resume?account=not-an-address'});
    expect(await screen.findByText('TOKENS')).toBeTruthy();
  });

  it('the resume route on a locked wallet is the locked screen; with no wallet, the no-wallet screen (§7.1)', async () => {
    const w = await setupWallet({surface: 'tab', unlocked: false});
    render(<App surface="tab" engine={w.engine} platform={w.platform} hash={RESUME} />);
    expect(await screen.findByText('Welcome back')).toBeTruthy();
    cleanup();
    const n = await setupWallet({surface: 'tab', wallet: false});
    render(<App surface="tab" engine={n.engine} platform={n.platform} hash={RESUME} />);
    expect(await screen.findByText('No wallet on this browser yet.')).toBeTruthy();
  });
});

describe('the popup resumes a waiting send (§1.6 step 3)', () => {
  it('opened with a live prepared send: #20 "You have a send waiting." — nothing sent; [Cancel] → #11 with the toast, and nothing left', async () => {
    const w = await app();
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    expect(w.sends()).toBe(0);
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText(CANCELLED_TEXT)).toBeTruthy();
    expect(screen.getByText('TOKENS')).toBeTruthy();
    expect(await w.engine.preparedFor(ACCOUNT.publicKey)).toEqual({ok: true, data: null});
  });

  it('a user who moved on before preparedFor answered stays where they went: no #20 pushed over them', async () => {
    const w = await setupWallet({reader: sendingReader(), deps: {now: () => Date.now()}});
    expect((await w.engine.prepareSend(ACCOUNT.publicKey, INTENT)).ok).toBe(true);
    let release: () => void = () => undefined;
    const held = new Promise<void>(r => (release = r));
    const asked: string[] = [];
    const engine = createEngine(async m => {
      const type = (m as {type: string}).type;
      if (type === 'wallet.preparedFor') {
        asked.push(type);
        await held;
      }
      return w.transport(m);
    }, async () => undefined);
    render(<App surface="popup" engine={engine} platform={w.platform} hash="" />);
    await waitFor(() => expect(asked).toHaveLength(1));
    fireEvent.click(await screen.findByRole('button', {name: 'Receive'}));
    release();
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(screen.queryByText(CONFIRM_TEXT.resume)).toBeNull();
  });

  it('opened with nothing prepared: #11, and preparedFor was asked once', async () => {
    const w = await app({prepare: false});
    expect(await screen.findByText('TOKENS')).toBeTruthy();
    await waitFor(() => expect(w.sent.filter(t => t === 'wallet.preparedFor')).toHaveLength(1));
    expect(screen.queryByText(CONFIRM_TEXT.title)).toBeNull();
  });

  it('#20’s back arrow from a resume goes to #19 for the intent, with #12 under it holding the draft', async () => {
    await app({known: true});
    expect(await screen.findByText(CONFIRM_TEXT.resume)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(await screen.findByText(REVIEW_TEXT.passed)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(await screen.findByText('Send', {selector: '.title'})).toBeTruthy();
    expect((screen.getByLabelText('Recipient') as HTMLInputElement).value).toBe(COUNTERPARTY);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('0.01');
  });

  it('a send from the resumed #20 → #21; [Done] on success → #11', async () => {
    vi.useFakeTimers({shouldAdvanceTime: true});
    const w = await app({known: true});
    fireEvent.click(await sendButton());
    expect(await screen.findByText(STATUS_TEXT.broadcasting)).toBeTruthy();
    // The background confirms it.
    const records = (await w.ext.local.get('v1_pending')) as {state: string}[];
    await w.ext.local.set('v1_pending', records.map(r => ({...r, state: 'confirmed'})));
    await act(async () => void vi.advanceTimersByTime(2_000));
    fireEvent.click(await screen.findByRole('button', {name: STATUS_TEXT.done}));
    expect(await screen.findByText('TOKENS')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/Created.test.tsx src/app/__tests__/router.test.ts src/app/__tests__/sendFlow.test.tsx
```
Expected (dry run): FAIL — Test Files 2 failed | 1 passed (3) · Tests 13 failed | 30 passed (43) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/App.tsx`:

```diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index 72ff760..227d1d6 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -1,9 +1,11 @@
 import {useEffect, useLayoutEffect, useReducer, useRef, useState} from 'react';
 import {WalletProvider, useWallet, type Surface} from './WalletContext';
-import {createEngine, type Engine, type HistoryItem} from './engine';
+import {createEngine, type Engine, type HistoryItem, type Intent} from './engine';
 import {browserPlatform, type Platform} from './platform';
-import {TAB_ONLY, firstRoute, routeReducer, type Route} from './router';
+import {FLOW, TAB_ONLY, firstRoute, routeReducer, type Route} from './router';
+import {draftOf, type Draft} from './send/rules';
 import {TabBar} from './ui/TabBar';
+import {CancelledToast} from './ui/CancelledToast';
 import {Home} from './screens/Home';
 import {Locked} from './screens/Locked';
 import {NoWallet} from './screens/NoWallet';
@@ -15,15 +17,24 @@ import {Settings} from './screens/Settings';
 import {About} from './screens/About';
 import {Created} from './screens/Created';
 import {Imported} from './screens/Imported';
-import {Resume} from './screens/Resume';
+import {Send} from './screens/Send';
+import {Review} from './screens/Review';
+import {Confirm} from './screens/Confirm';
+import {Status} from './screens/Status';
 
-function Shell({first}: {first: Route[]}) {
+const HOME: Route = {screen: 'tab', tab: 'home'};
+
+function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () => void}) {
   const m = useWallet();
   const [stack, go] = useReducer(routeReducer, first);
   const [accounts, setAccounts] = useState(false);
   const [txItems, setTxItems] = useState<Record<string, HistoryItem>>({});
-  const route = stack[stack.length - 1] ?? {screen: 'tab', tab: 'home'};
+  /** #20's [Cancel] discarded the prepared send (E7): #11 shows "Transaction cancelled. No fees charged." */
+  const [cancelled, setCancelled] = useState(false);
+  const route = stack[stack.length - 1] ?? HOME;
   const content = useRef<HTMLElement>(null);
+  const stackRef = useRef(stack);
+  stackRef.current = stack;
 
   // One scroller serves every route: a screen opened from a scrolled list would otherwise start
   // where the list was (#27 opened below its own top bar — Task 17 fix round 1). Every accepted push,
@@ -32,20 +43,66 @@ function Shell({first}: {first: Route[]}) {
     if (content.current !== null) content.current.scrollTop = 0;
   }, [stack]);
 
-  // Esc goes back one step on a pushed screen (a sheet handles its own Esc).
+  // The UI tab leaves its hand-over screen (#20 after #10 → #21, #19 or #12): from then on it is a wallet surface
+  // like the popup, and the provider runs its open sequence (it was quiet on the hand-over route).
+  useEffect(() => {
+    if (!TAB_ONLY.has(route.screen)) onLeaveHandOver();
+  }, [route.screen, onLeaveHandOver]);
+
+  // Esc goes back one step on a pushed screen (a sheet handles its own Esc; a flow screen its own step).
   useEffect(() => {
-    if (stack.length < 2 || accounts) return;
+    if (stack.length < 2 || accounts || FLOW.has(route.screen)) return;
     const onKey = (e: KeyboardEvent) => {
       if (e.key === 'Escape') go({type: 'pop'});
     };
     document.addEventListener('keydown', onKey);
     return () => document.removeEventListener('keydown', onKey);
-  }, [stack.length, accounts]);
+  }, [stack.length, accounts, route.screen]);
+
+  // Spec §1.6 step 3: a popup opened while a prepared send waits shows #20 in resume mode — which reads it again
+  // and waits for a tap (D38). Once per popup, and only while the user has not gone anywhere yet.
+  const resumeChecked = useRef(false);
+  const selected = m.account?.publicKey ?? null;
+  const {engine, phase, surface} = m;
+  useEffect(() => {
+    if (surface !== 'popup' || phase !== 'unlocked' || selected === null || resumeChecked.current) return;
+    resumeChecked.current = true;
+    void engine.preparedFor(selected).then(r => {
+      const now = stackRef.current;
+      if (r.ok && r.data !== null && now.length === 1 && now[0]?.screen === 'tab' && now[0].tab === 'home') {
+        go({type: 'push', route: {screen: 'confirm', account: selected, entry: 'resume'}});
+      }
+    });
+  }, [surface, phase, selected, engine]);
+
+  /** The send flow's ways between its screens (spec §4). #19 always sits on #12 holding the draft, so Cancel returns to it. */
+  const toReview = (account: string, intent: Intent, notice: 'confirmation-expired' | null) =>
+    go({type: 'reset', routes: [HOME, {screen: 'send', draft: draftOf(intent), notice: null}, {screen: 'review', account, intent, notice}]});
+  const toStatus = (account: string, id: string | null, since: number) => go({type: 'reset', routes: [HOME, {screen: 'status', account, id, since}]});
+  const toSend = (draft: Draft | null, notice: 'start-again' | null) => go({type: 'reset', routes: [HOME, {screen: 'send', draft, notice}]});
+  const confirmFor = (account: string, entry: 'flow' | 'resume') => (
+    <Confirm
+      account={account}
+      entry={entry}
+      onBack={intent => {
+        const below = stackRef.current[stackRef.current.length - 2];
+        if (below?.screen === 'review') go({type: 'pop'});
+        else toReview(account, intent, null);
+      }}
+      onCancelled={() => {
+        setCancelled(true);
+        go({type: 'reset', routes: [HOME]});
+      }}
+      onTrack={(id, since) => toStatus(account, id, since)}
+      onReview={(intent, notice) => toReview(account, intent, notice)}
+      onStartAgain={draft => toSend(draft, draft === null ? null : 'start-again')}
+    />
+  );
 
   if (m.phase === 'loading') return <div className="app-content" aria-busy="true" />;
-  // The UI tab's hand-over screens show their own locked and no-wallet states (§3.7, §3.12).
-  if (route.screen === 'created' || route.screen === 'imported' || route.screen === 'resume') {
-    return <main className="app-content">{route.screen === 'created' ? <Created /> : route.screen === 'imported' ? <Imported /> : <Resume />}</main>;
+  // The UI tab's hand-over screens show their own locked and no-wallet states (§3.7, §3.12, §7.1).
+  if (route.screen === 'created' || route.screen === 'imported') {
+    return <main className="app-content">{route.screen === 'created' ? <Created /> : <Imported />}</main>;
   }
   if (m.phase === 'no-wallet') return <NoWallet />;
   if (m.phase === 'locked') return <Locked />;
@@ -71,6 +128,47 @@ function Shell({first}: {first: Route[]}) {
     screen = <Receive onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'tx') {
     screen = <TxDetail signature={route.signature} item={txItems[route.signature]} onBack={() => go({type: 'pop'})} />;
+  } else if (route.screen === 'send') {
+    screen = (
+      <Send
+        draft={route.draft}
+        notice={route.notice}
+        onBack={() => go({type: 'pop'})}
+        onReview={(draft, intent) => {
+          go({type: 'replace', route: {screen: 'send', draft, notice: null}});
+          if (selected !== null) go({type: 'push', route: {screen: 'review', account: selected, intent, notice: null}});
+        }}
+        onViewPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
+      />
+    );
+  } else if (route.screen === 'review') {
+    const {account} = route;
+    screen = (
+      <Review
+        account={account}
+        intent={route.intent}
+        notice={route.notice}
+        onCancel={() => go({type: 'pop'})}
+        onConfirm={() => go({type: 'push', route: {screen: 'confirm', account, entry: 'flow'}})}
+        onViewPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
+      />
+    );
+  } else if (route.screen === 'confirm' || route.screen === 'resume') {
+    screen = confirmFor(route.account, route.screen === 'confirm' ? route.entry : 'resume');
+  } else if (route.screen === 'status') {
+    const {account} = route;
+    screen = (
+      <Status
+        account={account}
+        id={route.id}
+        since={route.since}
+        onDone={() => go({type: 'reset', routes: [HOME]})}
+        onDetails={signature => go({type: 'push', route: {screen: 'tx', signature}})}
+        onActivity={() => go({type: 'tab', tab: 'activity'})}
+        onTryAgain={intent => toReview(account, intent, null)}
+        onEdit={draft => toSend(draft, null)}
+      />
+    );
   } else {
     screen = <About onBack={() => go({type: 'pop'})} />;
   }
@@ -81,6 +179,7 @@ function Shell({first}: {first: Route[]}) {
         {screen}
       </main>
       {route.screen === 'tab' ? <TabBar active={route.tab} onChange={tab => go({type: 'tab', tab})} /> : null}
+      {cancelled && route.screen === 'tab' ? <CancelledToast onDone={() => setCancelled(false)} /> : null}
       {accounts ? <Switcher onClose={() => setAccounts(false)} /> : null}
     </>
   );
@@ -92,11 +191,14 @@ export function App({surface, engine, platform = browserPlatform, hash = typeof
   const [client] = useState<Engine>(() => engine ?? createEngine());
   // The first route is read once (§1.6): the tab's hash chooses a screen, and never acts.
   const [first] = useState<Route[]>(() => firstRoute(surface, hash));
-  const handOver = TAB_ONLY.has(first[0]?.screen ?? '');
+  // The hand-over routes run a quiet provider (#7, #40, #20 after #10): the state only, plus what each screen
+  // reads itself. Leaving them (the tab's #20 → #21, #19 or #12) makes the tab a wallet surface like the popup.
+  const [handOver, setHandOver] = useState(() => TAB_ONLY.has(first[0]?.screen ?? ''));
+  const [leave] = useState(() => () => setHandOver(false));
   return (
     <div className={`app app-${surface}`}>
       <WalletProvider engine={client} platform={platform} surface={surface} quiet={handOver}>
-        <Shell first={first} />
+        <Shell first={first} onLeaveHandOver={leave} />
       </WalletProvider>
     </div>
   );
```

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index 4237342..c23c973 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -723,3 +723,9 @@ a.btn {
 .app-tab-done {
   margin: 0 var(--space-5) var(--space-4);
 }
+
+/* #44's cancelled toast over #11 (plan 3): above the 80 px tab bar, over the content. */
+.app .s9-toast-cancelled {
+  bottom: calc(80px + var(--space-4));
+  z-index: 5;
+}
```

Modify `extension/src/app/mount.tsx`:

```diff
diff --git a/extension/src/app/mount.tsx b/extension/src/app/mount.tsx
index 0f1ffc7..3408c97 100644
--- a/extension/src/app/mount.tsx
+++ b/extension/src/app/mount.tsx
@@ -9,7 +9,9 @@ import type {Surface} from './WalletContext';
 /**
  * StrictMode runs every effect twice in development builds only (mount, unmount, mount): the provider's
  * open sequence may then read twice in `vite dev`. Production builds — what the extension ships — run
- * each effect once (review L10).
+ * each effect once (review L10). The same holds for #20's mount effect (plan-3 review L7): in `vite dev` an
+ * expired resume may re-prepare twice — harmless (the newer prepared send wins; a tap on the older id lands on
+ * #19) and absent from production. Do not "fix" it in production code.
  */
 export function mount(surface: Surface): void {
   const root = document.getElementById('root');
```

Modify `extension/src/app/router.ts`:

```diff
diff --git a/extension/src/app/router.ts b/extension/src/app/router.ts
index 66ff411..775f5fc 100644
--- a/extension/src/app/router.ts
+++ b/extension/src/app/router.ts
@@ -1,14 +1,17 @@
 import type {Tab} from './ui/TabBar';
 import type {Surface} from './WalletContext';
+import type {Intent} from './engine';
+import {isDraft, isIntent, type Draft} from './send/rules';
 
 /**
- * In-memory navigation (spec §1.6): a stack of routes in a reducer — push, pop, replace, back to a
- * tab. No router library, and no route that acts: every value a screen shows comes from the
- * background. Plan 3 adds the send flow.
+ * In-memory navigation (spec §1.6): a stack of routes in a reducer — push, pop, replace, reset, back to a
+ * tab. No router library, and no route that acts: every value a screen shows comes from the background.
  *
  * The pushable screens are a closed list, and the reducer refuses anything outside it — a forged or
- * future route leaves the stack as it was rather than dangling. The UI tab's hand-over screens (#7
- * `created`, #40 `imported`, and plan 2's `resume` stand-in) are first routes only: chosen by the tab's
+ * future route leaves the stack as it was rather than dangling. The send flow's routes (plan 3) carry only
+ * what the user typed (#12's draft, #19's intent) and which account and pending record a screen reads —
+ * never a prepared send: #20 reads that from the background every time (D38). The UI tab's hand-over
+ * screens (#7 `created`, #40 `imported`, #20's `resume` entry) are first routes only: chosen by the tab's
  * hash, never pushed.
  */
 export type Route =
@@ -16,16 +19,24 @@ export type Route =
   | {screen: 'receive'}
   | {screen: 'tx'; signature: string}
   | {screen: 'about'}
+  | {screen: 'send'; draft: Draft | null; notice: 'start-again' | null}
+  | {screen: 'review'; account: string; intent: Intent; notice: 'confirmation-expired' | null}
+  | {screen: 'confirm'; account: string; entry: 'flow' | 'resume'}
+  | {screen: 'status'; account: string; id: string | null; since: number}
   | {screen: 'created'}
   | {screen: 'imported'}
   | {screen: 'resume'; account: string};
-export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab};
+export type RouteAction = {type: 'push'; route: Route} | {type: 'pop'} | {type: 'tab'; tab: Tab} | {type: 'replace'; route: Route} | {type: 'reset'; routes: Route[]};
 
-export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about']);
+export const SCREENS: ReadonlySet<string> = new Set<Route['screen']>(['tab', 'receive', 'tx', 'about', 'send', 'review', 'confirm', 'status']);
+/** The send flow's screens: each handles Esc itself (#19 discards first, #20 keeps, #21 has no back while open). */
+export const FLOW: ReadonlySet<string> = new Set<Route['screen']>(['send', 'review', 'confirm', 'status', 'resume']);
 /** The UI tab's hand-over screens: a first route from `location.hash`, never pushed. */
 export const TAB_ONLY: ReadonlySet<string> = new Set<Route['screen']>(['created', 'imported', 'resume']);
 const ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
+const PENDING_ID = /^[0-9a-f]{32}$/;
 const TABS: ReadonlySet<string> = new Set<Tab>(['home', 'activity', 'settings']);
+const isAddress = (x: unknown): x is string => typeof x === 'string' && ADDRESS.test(x);
 
 function isRoute(r: unknown): r is Route {
   if (typeof r !== 'object' || r === null) return false;
@@ -33,6 +44,10 @@ function isRoute(r: unknown): r is Route {
   if (typeof o.screen !== 'string' || !SCREENS.has(o.screen)) return false;
   if (o.screen === 'tab') return typeof o.tab === 'string' && TABS.has(o.tab);
   if (o.screen === 'tx') return typeof o.signature === 'string' && o.signature.length > 0;
+  if (o.screen === 'send') return (o.draft === null || isDraft(o.draft)) && (o.notice === null || o.notice === 'start-again');
+  if (o.screen === 'review') return isAddress(o.account) && isIntent(o.intent) && (o.notice === null || o.notice === 'confirmation-expired');
+  if (o.screen === 'confirm') return isAddress(o.account) && (o.entry === 'flow' || o.entry === 'resume');
+  if (o.screen === 'status') return isAddress(o.account) && (o.id === null || (typeof o.id === 'string' && PENDING_ID.test(o.id))) && typeof o.since === 'number' && Number.isFinite(o.since);
   return true;
 }
 
@@ -44,13 +59,17 @@ export function routeReducer(stack: Route[], action: RouteAction): Route[] {
       return stack.length > 1 ? stack.slice(0, -1) : stack;
     case 'tab':
       return TABS.has(action.tab) ? [{screen: 'tab', tab: action.tab}] : stack;
+    case 'replace':
+      return isRoute(action.route) ? [...stack.slice(0, -1), action.route] : stack;
+    case 'reset':
+      return action.routes.length > 0 && action.routes.every(isRoute) ? action.routes : stack;
   }
 }
 
 /**
  * The first route (spec §1.6). The popup always starts at #11. The tab reads `location.hash`: `#/created`
- * (#7), `#/imported` (#40), `#/send/resume?account=<address>` (the hand-over from #10 — plan 2 shows
- * "Open the Noctura icon to continue." there; plan 3 makes it #20) and `#/home`; anything else is #11
+ * (#7), `#/imported` (#40), `#/send/resume?account=<address>` (the hand-over from #10: #20, which reads the
+ * prepared send through wallet.preparedFor and waits for a tap — D38) and `#/home`; anything else is #11
  * too. The hash only ever chooses a screen — it never acts, and the account is only an address.
  */
 export function firstRoute(surface: Surface = 'popup', hash = ''): Route[] {
```

Delete `extension/src/app/screens/Resume.tsx` (`git rm extension/src/app/screens/Resume.tsx`).

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index d9c9afc..1872946 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -307,7 +307,12 @@ mutation test in `scripts/__tests__`):
   and `#/home`, and the hash only chooses a screen: every value shown comes from the background.
   The address is validated like any address and only selects which `preparedFor` to read. **No
   hash causes an action.** Any extension page, or another extension opening `wallet.html#/send/…`,
-  can at most make #20 appear, and #20 waits for a tap (review B1, D38).
+  can at most make #20 appear, and #20 waits for a tap (review B1, D38). **Plan 3:** on that route the
+  tab's provider stays quiet — the state, and what #20 reads itself (`preparedFor`, `prepareSend` when the
+  quote has expired, `pending`, `prices`); once the user moves on from it (to #21, #19 or #12) the tab is a
+  wallet surface like the popup and runs the open sequence. The flow's pushed routes carry only what the
+  user typed (#12's draft, #19's intent) and which account and pending record a screen reads — never a
+  prepared send.
 
 ### 1.7 Design-system reuse from `web/`
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/Created.test.tsx src/app/__tests__/router.test.ts src/app/__tests__/sendFlow.test.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 3 passed (3) · Tests 43 passed (43); tsc clean; whole suite Test Files 111 passed (111) · Tests 1932 passed (1932).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M13a** — `extension/src/app/router.ts`:

  ```diff
  - if (resume !== null && ADDRESS.test(resume[1] ?? ''))
  + if (resume !== null)
  ```
  `npx vitest run src/app/__tests__/sendFlow.test.tsx src/app/__tests__/router.test.ts` — Expected: **red** (3 failed | 27 passed (30)).

- **M13b** — `extension/src/app/App.tsx`:

  ```diff
  -     if (!TAB_ONLY.has(route.screen)) onLeaveHandOver();
  +     onLeaveHandOver();
  ```
  `npx vitest run src/app/__tests__/sendFlow.test.tsx` — Expected: **red** (2 failed | 8 passed (10)).

- **M13c** — `extension/src/app/App.tsx`:

  ```diff
  -       if (r.ok && r.data !== null && now.length === 1 && now[0]?.screen === 'tab' && now[0].tab === 'home') {
  +       if (r.ok && r.data !== null) {
  ```
  `npx vitest run src/app/__tests__/sendFlow.test.tsx` — Expected: **red** (1 failed | 9 passed (10)).

- [ ] **Step 7: Commit.**

```bash
git rm -q extension/src/app/screens/Resume.tsx
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/e2e/wallet.spec.ts extension/src/app/App.tsx extension/src/app/__tests__/Created.test.tsx extension/src/app/__tests__/router.test.ts extension/src/app/__tests__/sendFlow.test.tsx extension/src/app/app.css extension/src/app/mount.tsx extension/src/app/router.ts
git commit -F - <<'MSG'
feat(extension): the send flow's routes; #/send/resume is #20, read through preparedFor only — the stand-in removed

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 14: Plan 1's stand-ins removed: #11's Send, the pending strip, #26's PENDING rows, #27's `[Try again]`

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/src/app/App.tsx`
- Modify: `extension/src/app/__tests__/Activity.test.tsx`
- Modify: `extension/src/app/__tests__/App.test.tsx`
- Modify: `extension/src/app/__tests__/Home.test.tsx`
- Modify: `extension/src/app/__tests__/Switcher.test.tsx`
- Modify: `extension/src/app/__tests__/TxDetail.test.tsx`
- Modify: `extension/src/app/app.css`
- Modify: `extension/src/app/screens/Activity.tsx`
- Modify: `extension/src/app/screens/Home.tsx`
- Modify: `extension/src/app/screens/TxDetail.tsx`

**Interfaces:**
- Consumes: Tasks 4, 12, 13; `Home`, `Activity`, `TxDetail`.
- Produces: `Home({onSend, onReceive, onPending, onAccounts})`, `Activity({onTx, onReceive, onPending})`, `TxDetail({…, onTryAgain})`.

Spec §5.1, §6.2, §6.3. #11's Send quick action opens #12 (disabled offline, unreachable and refused — D36 keeps Receive); the skeleton draws two quick actions; the pending strip opens that send at #21/#54; #26's PENDING rows are buttons that open it; #27's failed send gets `[Try again]` → #19 for the same intent — offered only for a `sent` decode (exactly one transfer of a known token, Task 4), never for `other`: a test decodes a failed two-transfer transaction through the real decoder and asserts "FAILED", a dash and no `[Try again]` (review H1). The engine re-checks everything on prepare and #20 shows the whole address before one tap.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/src/app/__tests__/Activity.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/Activity.test.tsx b/extension/src/app/__tests__/Activity.test.tsx
index 9d56b0f..d31f15b 100644
--- a/extension/src/app/__tests__/Activity.test.tsx
+++ b/extension/src/app/__tests__/Activity.test.tsx
@@ -33,7 +33,7 @@ function historyReader(n = 5) {
   });
 }
 
-const nav = {onTx: vi.fn(), onReceive: vi.fn()};
+const nav = {onTx: vi.fn(), onReceive: vi.fn(), onPending: vi.fn()};
 async function openActivity(reader = historyReader(), before?: NonNullable<Parameters<typeof renderInWallet>[1]>['before']) {
   return renderInWallet(<Activity {...nav} />, {reader, before});
 }
@@ -206,13 +206,15 @@ describe('#26 activity', () => {
     expect(screen.queryByText('Could not reach the Noctura server')).toBeNull();
   });
 
-  it('open sends on top, in a PENDING section', async () => {
+  it('open sends on top, in a PENDING section — a row opens its send (#21/#54)', async () => {
     await openActivity(historyReader(), ext =>
-      ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now() - 72_000})]),
+      ext.local.set(PENDING_KEY, [pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now() - 72_000})]),
     );
     expect(await screen.findByText('PENDING')).toBeTruthy();
     expect(screen.getByText('Sending 2.48 SOL')).toBeTruthy();
     expect(screen.getByText(/^waiting · 1 m \d+ s$/)).toBeTruthy();
+    fireEvent.click(screen.getByText('Sending 2.48 SOL'));
+    expect(nav.onPending).toHaveBeenCalledWith(expect.objectContaining({id: 'p1'}));
   });
 
   it('unreachable and refused show their banners over what loaded', async () => {
@@ -250,7 +252,7 @@ describe('#26 activity', () => {
     });
     await renderInWallet(
       <>
-        <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
+        <Home onReceive={() => undefined} onSend={() => undefined} onPending={() => undefined} onAccounts={() => undefined} />
         <Activity {...nav} />
       </>,
       {reader},
@@ -275,7 +277,7 @@ describe('#26 activity', () => {
     const w = await setupWallet({reader});
     const {rerender} = render(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
-        <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
+        <Home onReceive={() => undefined} onSend={() => undefined} onPending={() => undefined} onAccounts={() => undefined} />
       </WalletProvider>,
     );
     await screen.findByText(REFUSED_TEXT);
@@ -285,7 +287,7 @@ describe('#26 activity', () => {
     rerender(
       <WalletProvider engine={w.engine} platform={w.platform} surface="popup">
         <>
-          <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
+          <Home onReceive={() => undefined} onSend={() => undefined} onPending={() => undefined} onAccounts={() => undefined} />
           <Activity {...nav} />
         </>
       </WalletProvider>,
@@ -525,7 +527,7 @@ describe('#41 empty activity', () => {
     });
     await renderInWallet(
       <>
-        <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => undefined} />
+        <Home onReceive={() => undefined} onSend={() => undefined} onPending={() => undefined} onAccounts={() => undefined} />
         <Activity {...nav} />
       </>,
       {reader},
```

Modify `extension/src/app/__tests__/App.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/App.test.tsx b/extension/src/app/__tests__/App.test.tsx
index 79a9b07..1d0e773 100644
--- a/extension/src/app/__tests__/App.test.tsx
+++ b/extension/src/app/__tests__/App.test.tsx
@@ -1,5 +1,5 @@
 // @vitest-environment happy-dom
-import {fireEvent, screen, waitFor} from '@testing-library/react';
+import {cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
 import {renderApp} from './appHarness';
 import {walletReader} from './harness';
 import {PENDING_KEY} from '../../background/pendingStore';
@@ -136,12 +136,16 @@ describe('navigation (spec §1.6: an in-memory stack; no route acts)', () => {
     expect(scroller().scrollTop).toBe(0);
   });
 
-  it('the pending strip opens Activity (plan-1 stand-in), where the send is in PENDING', async () => {
-    await renderApp({
-      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
-    });
+  it('the pending strip opens the open send at #21; Activity’s PENDING row opens it too', async () => {
+    const record = pendingRecord({id: 'ab'.repeat(16), account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()});
+    await renderApp({before: ext => ext.local.set(PENDING_KEY, [record])});
     fireEvent.click(await screen.findByText('Sending 2.48 SOL · pending'));
-    expect(await screen.findByText('PENDING')).toBeTruthy();
+    expect(await screen.findByText('Broadcasting transaction…')).toBeTruthy();
+    cleanup();
+    await renderApp({before: ext => ext.local.set(PENDING_KEY, [record])});
+    fireEvent.click(await screen.findByRole('button', {name: 'Activity'}));
+    fireEvent.click(await screen.findByText('Sending 2.48 SOL'));
+    expect(await screen.findByText('Broadcasting transaction…')).toBeTruthy();
   });
 
   it('the avatar opens the account switcher; Settings → Accounts opens it too', async () => {
```

Modify `extension/src/app/__tests__/Home.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/Home.test.tsx b/extension/src/app/__tests__/Home.test.tsx
index f087b8a..535484d 100644
--- a/extension/src/app/__tests__/Home.test.tsx
+++ b/extension/src/app/__tests__/Home.test.tsx
@@ -1,5 +1,5 @@
 // @vitest-environment happy-dom
-import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
+import {act, cleanup, fireEvent, screen, waitFor, within} from '@testing-library/react';
 import {renderInWallet, walletReader, type WalletOptions} from './harness';
 import {BALANCES_FAILED_TEXT, Home} from '../screens/Home';
 import {ago, stamp} from '../format';
@@ -17,7 +17,7 @@ import {ACCOUNT, RECIPIENT, pendingRecord} from '../../background/__tests__/fixt
 const CACHE = {[ACCOUNT.publicKey]: {sol: '62482100000', noc: '4200000000000', usdc: '740210000', usdt: '0', at: Date.now() - 5_000}};
 const never = () => new Promise<never>(() => undefined);
 const setOnline = (value: boolean) => Object.defineProperty(navigator, 'onLine', {value, configurable: true});
-const nav = {onReceive: vi.fn(), onActivity: vi.fn(), onAccounts: vi.fn()};
+const nav = {onSend: vi.fn(), onReceive: vi.fn(), onPending: vi.fn(), onAccounts: vi.fn()};
 /** #11 inside the real provider; its three ways out are spies (App.test.tsx follows them). */
 const renderHome = (o: WalletOptions = {}) => renderInWallet(<Home {...nav} />, o);
 /** #11 plus a probe that hands the test the live model (to call refresh() and lock() as a screen would). */
@@ -70,10 +70,10 @@ describe('#11 dashboard', () => {
     expect(screen.getByRole('button', {name: 'Hide balance'})).toBeTruthy();
   });
 
-  it('what is deliberately absent: Send (plan 3), Swap, Buy, the bell, scan, 24 h change, the presale banner, See all', async () => {
+  it('what is deliberately absent: Swap, Buy, the bell, scan, 24 h change, the presale banner, See all', async () => {
     await renderHome();
     await screen.findByText('$10,112');
-    for (const gone of ['Send', 'Swap', 'Buy', 'See all', 'Transparent', 'Shielded']) expect(screen.queryByText(gone)).toBeNull();
+    for (const gone of ['Swap', 'Buy', 'See all', 'Transparent', 'Shielded']) expect(screen.queryByText(gone)).toBeNull();
     expect(screen.queryByLabelText('Notifications')).toBeNull();
     expect(screen.queryByLabelText('Scan')).toBeNull();
     expect(document.body.textContent).not.toMatch(/24h|Presale|Stage \d/);
@@ -84,7 +84,8 @@ describe('#11 dashboard', () => {
     await renderHome({reader: walletReader({getBalance: never})});
     expect(await screen.findByTestId('skeleton')).toBeTruthy();
     expect(document.querySelectorAll('.hero .skel-line').length).toBe(3);
-    expect(document.querySelectorAll('.quick .qa .skel-circle').length).toBe(1);
+    // Plan 3: the skeleton draws the actions that exist — Send and Receive (§5.1 Differs).
+    expect(document.querySelectorAll('.quick .qa .skel-circle').length).toBe(2);
     expect(screen.getByText('TOKENS')).toBeTruthy();
     expect(document.querySelectorAll('.tokens .row .skel-circle').length).toBe(4);
     expect(document.querySelector('[data-token]')).toBeNull();
@@ -291,12 +292,34 @@ describe('#11 dashboard', () => {
     expect(document.body.textContent).not.toContain('$0.00');
   });
 
-  it('pending strip: an open send of this account — its text, and it opens Activity (plan-1 stand-in)', async () => {
+  it('pending strip: an open send of this account — its text, and it opens that send (#21/#54)', async () => {
     await renderHome({
-      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
+      before: ext => ext.local.set(PENDING_KEY, [pendingRecord({id: 'p1', account: ACCOUNT.publicKey, signature: '5'.repeat(88), intent: {token: 'SOL', recipient: RECIPIENT, amount: '2480000000'}, createdAt: Date.now()})]),
     });
     fireEvent.click(await screen.findByText('Sending 2.48 SOL · pending'));
-    expect(nav.onActivity).toHaveBeenCalledTimes(1);
+    expect(nav.onPending).toHaveBeenCalledWith(expect.objectContaining({id: 'p1'}));
+  });
+
+  // Plan 3 (§5.1, §5.4, D36): the Send quick action opens #12; offline, unreachable and refused disable it — Receive stays.
+  it('Send opens #12; it is disabled offline, while the server cannot be reached, and in the 403 cool-down — Receive is not', async () => {
+    await renderHome();
+    await screen.findByText('$10,112');
+    expect([...document.querySelectorAll('.quick .qa .lbl')].map(l => l.textContent)).toEqual(['Send', 'Receive']);
+    fireEvent.click(screen.getByRole('button', {name: 'Send'}));
+    expect(nav.onSend).toHaveBeenCalledTimes(1);
+    for (const failing of [new RequestUnreachable('u', 'x'), new RpcForbidden('getBalance')]) {
+      cleanup();
+      await renderHome({
+        reader: walletReader({
+          getBalance: async () => {
+            throw failing;
+          },
+        }),
+        before: async ext => ext.local.set(BALANCE_CACHE_KEY, CACHE),
+      });
+      await waitFor(() => expect((screen.getByRole('button', {name: 'Send'}) as HTMLButtonElement).disabled).toBe(true));
+      expect((screen.getByRole('button', {name: 'Receive'}) as HTMLButtonElement).disabled).toBe(false);
+    }
   });
 });
```

Modify `extension/src/app/__tests__/Switcher.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/Switcher.test.tsx b/extension/src/app/__tests__/Switcher.test.tsx
index 8247a03..c9396af 100644
--- a/extension/src/app/__tests__/Switcher.test.tsx
+++ b/extension/src/app/__tests__/Switcher.test.tsx
@@ -46,7 +46,7 @@ function HomeWithSwitcher() {
   const [open, setOpen] = useState(false);
   return (
     <>
-      <Home onReceive={() => undefined} onActivity={() => undefined} onAccounts={() => setOpen(true)} />
+      <Home onReceive={() => undefined} onSend={() => undefined} onPending={() => undefined} onAccounts={() => setOpen(true)} />
       {open ? <Switcher onClose={() => setOpen(false)} /> : null}
     </>
   );
```

Modify `extension/src/app/__tests__/TxDetail.test.tsx`:

```diff
diff --git a/extension/src/app/__tests__/TxDetail.test.tsx b/extension/src/app/__tests__/TxDetail.test.tsx
index c45950f..7b95c75 100644
--- a/extension/src/app/__tests__/TxDetail.test.tsx
+++ b/extension/src/app/__tests__/TxDetail.test.tsx
@@ -1,5 +1,5 @@
 // @vitest-environment happy-dom
-import {fireEvent, render, screen, waitFor} from '@testing-library/react';
+import {cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react';
 import {base58} from '@scure/base';
 import {renderInWallet, setupWallet, walletReader} from './harness';
 import {ExplorerLink, TxDetail} from '../screens/TxDetail';
@@ -7,12 +7,16 @@ import {explorerUrl} from '../explorer';
 import {useWallet, WalletProvider} from '../WalletContext';
 import {REFUSED_TEXT} from '../ui/Banner';
 import {RequestUnreachable, RpcForbidden} from '../../../../core/solana/rpc';
+import {decodeHistoryEntry} from '../../../../core/solana/history';
+import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
 import type {Engine, HistoryItem} from '../engine';
 import {ACCOUNT, RECIPIENT} from '../../background/__tests__/fixtures';
 import {COUNTERPARTY, otherTx, sentSol, sig} from '../../../e2e/historyFixtures';
 
 // Spec §6.3 (#27) and §6.5 (the one external link).
 const NOW = Math.floor(Date.now() / 1000);
+const tryAgain = vi.fn();
+afterEach(() => vi.clearAllMocks());
 const item = (over: Partial<HistoryItem>): HistoryItem => ({
   signature: sig(1),
   blockTime: NOW,
@@ -26,7 +30,7 @@ const item = (over: Partial<HistoryItem>): HistoryItem => ({
   ...over,
 });
 const show = async (i: HistoryItem) => {
-  const w = await renderInWallet(<TxDetail signature={i.signature} item={i} onBack={() => undefined} />);
+  const w = await renderInWallet(<TxDetail signature={i.signature} item={i} onBack={() => undefined} onTryAgain={tryAgain} />);
   // The account is read by the provider's open sequence; its address then appears on the page.
   await waitFor(() => expect(document.body.textContent).toContain(ACCOUNT.publicKey));
   return w;
@@ -70,7 +74,7 @@ describe('#27 tx-detail', () => {
   // wallet" in the accent, and the pill "Confirmed · 8h ago" (format.ts's ago, the injected clock).
   it('a receive as 27c draws it: success amount, the Type row, "Your wallet" in accent, "Confirmed · <age>"', async () => {
     const at = 1_780_000_000;
-    await renderInWallet(<TxDetail signature={sig(2)} item={item({signature: sig(2), blockTime: at, kind: 'received', token: 'USDC', amount: 250_000_000n, counterparty: COUNTERPARTY})} onBack={() => undefined} />, {
+    await renderInWallet(<TxDetail signature={sig(2)} item={item({signature: sig(2), blockTime: at, kind: 'received', token: 'USDC', amount: 250_000_000n, counterparty: COUNTERPARTY})} onBack={() => undefined} onTryAgain={tryAgain} />, {
       now: () => (at + 8 * 3_600) * 1000,
     });
     await waitFor(() => expect(document.body.textContent).toContain(ACCOUNT.publicKey));
@@ -97,7 +101,7 @@ describe('#27 tx-detail', () => {
   });
 
   it('no price: the fee line reads "· —", never a made-up dollar value', async () => {
-    await renderInWallet(<TxDetail signature={sig(1)} item={item({})} onBack={() => undefined} />, {
+    await renderInWallet(<TxDetail signature={sig(1)} item={item({})} onBack={() => undefined} onTryAgain={tryAgain} />, {
       deps: {
         prices: async () => {
           throw new Error('down');
@@ -129,14 +133,14 @@ describe('#27 tx-detail', () => {
   });
 
   it('failed, as 27d: the eyebrow and card in danger, "Fee charged · $…", the grouped fee', async () => {
-    await renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} />);
+    await renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} onTryAgain={tryAgain} />);
     expect(await screen.findByText('Fee charged · $0.0007')).toBeTruthy();
     expect(document.querySelector('.amount-card')?.classList.contains('app-failed')).toBe(true);
     expect(screen.getByText('0.000 005 SOL')).toBeTruthy();
   });
 
   it('a failed transaction that was not a send: "FAILED", a dash, the danger pill and banner, the fee charged; no Try again', async () => {
-    const w = renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} />);
+    const w = renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), kind: 'other', token: null, amount: null, counterparty: null, failed: true})} onBack={() => undefined} onTryAgain={tryAgain} />);
     await w;
     expect(await screen.findByText('FAILED')).toBeTruthy();
     // No token is known for a failed row: a dash, never "— SOL" (review L3).
@@ -145,12 +149,12 @@ describe('#27 tx-detail', () => {
     expect(document.querySelector('.status-pill.fail')?.textContent).toBe('Failed');
     expect(screen.getByText('The transaction failed on chain. The network fee was charged; the amount did not move.')).toBeTruthy();
     expect(screen.getByText('Network fee charged')).toBeTruthy();
-    expect(screen.queryByText('Try again')).toBeNull();
+    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
   });
 
   // Plan 3, owner question 1 (option A): the engine reads what a failed send tried to send.
   it('a failed send: "FAILED · SENT" and "— SOL", the danger pill and banner, the fee charged', async () => {
-    await renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), amount: 1_000_000n, counterparty: COUNTERPARTY, failed: true})} onBack={() => undefined} />);
+    await renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), amount: 1_000_000n, counterparty: COUNTERPARTY, failed: true})} onBack={() => undefined} onTryAgain={tryAgain} />);
     expect(await screen.findByText('FAILED · SENT')).toBeTruthy();
     expect(document.querySelector('.amount-card .amt')?.textContent).toBe('— SOL');
     expect(await screen.findByText('Fee charged · $0.0007')).toBeTruthy();
@@ -158,8 +162,42 @@ describe('#27 tx-detail', () => {
     expect(screen.getByText('The transaction failed on chain. The network fee was charged; the amount did not move.')).toBeTruthy();
   });
 
+  // Plan-3 review H1: a failed batch (two transfers) is not one send — decoded "other", it offers no [Try again].
+  it('a failed transaction with two transfers from this account: "FAILED", a dash, and no [Try again]', async () => {
+    const transfer = (destination: string, lamports: number) => ({program: 'system', programId: '11111111111111111111111111111111', parsed: {type: 'transfer', info: {source: ACCOUNT.publicKey, destination, lamports}}});
+    const decoded = decodeHistoryEntry(ACCOUNT.publicKey, sig(6), {
+      blockTime: NOW,
+      meta: {err: {InstructionError: [0, {Custom: 1}]}, fee: 5000, preBalances: [3_000_000_000, 0, 0, 1], postBalances: [2_999_995_000, 0, 0, 1], preTokenBalances: [], postTokenBalances: []},
+      transaction: {message: {accountKeys: [ACCOUNT.publicKey, COUNTERPARTY, RECIPIENT, MAINNET_FEE_TREASURY].map(k => ({pubkey: k, signer: false, writable: true})), instructions: [transfer(COUNTERPARTY, 1_000_000_000), transfer(RECIPIENT, 1_000_000_000)]}},
+    });
+    expect(decoded).toMatchObject({kind: 'other', failed: true});
+    await renderInWallet(<TxDetail signature={sig(6)} item={decoded} onBack={() => undefined} onTryAgain={tryAgain} />);
+    expect(await screen.findByText('FAILED')).toBeTruthy();
+    expect(screen.queryByText('FAILED · SENT')).toBeNull();
+    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
+  });
+
+  // Plan 3 (owner question 1, option A): [Try again] → #19 with what the failed send tried, when it is known.
+  it('a failed send offers [Try again] with its intent — once per tap (rule 6, `disabled` lifted); none without a recipient or for another kind', async () => {
+    await renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), amount: 1_000_000n, counterparty: COUNTERPARTY, failed: true})} onBack={() => undefined} onTryAgain={tryAgain} />);
+    const again = (await screen.findByRole('button', {name: 'Try again'})) as HTMLButtonElement;
+    fireEvent.click(again);
+    again.disabled = false;
+    fireEvent.click(again);
+    expect(tryAgain).toHaveBeenCalledTimes(1);
+    expect(tryAgain).toHaveBeenCalledWith({token: 'SOL', recipient: COUNTERPARTY, amount: 1_000_000n});
+    cleanup();
+    await renderInWallet(<TxDetail signature={sig(5)} item={item({signature: sig(5), amount: 1_000_000n, counterparty: null, failed: true})} onBack={() => undefined} onTryAgain={tryAgain} />);
+    await screen.findByText('FAILED · SENT');
+    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
+    cleanup();
+    await renderInWallet(<TxDetail signature={sig(1)} item={item({})} onBack={() => undefined} onTryAgain={tryAgain} />);
+    await screen.findByText('SENT');
+    expect(screen.queryByRole('button', {name: 'Try again'})).toBeNull();
+  });
+
   it('a presale purchase and an other: their eyebrows and the decoded fields that exist', async () => {
-    renderInWallet(<TxDetail signature={sig(3)} item={item({signature: sig(3), kind: 'purchase', amount: 1_000_000_000n, counterparty: null})} onBack={() => undefined} />);
+    renderInWallet(<TxDetail signature={sig(3)} item={item({signature: sig(3), kind: 'purchase', amount: 1_000_000_000n, counterparty: null})} onBack={() => undefined} onTryAgain={tryAgain} />);
     expect(await screen.findByText('PRESALE PURCHASE')).toBeTruthy();
     expect(screen.getByText('−1.0000 SOL')).toBeTruthy();
     // Fix round 2 (#3): the purchase's fee line carries its dollars too (12136's form).
@@ -171,14 +209,14 @@ describe('#27 tx-detail', () => {
       getSignaturesForAddress: async () => [{signature: sig(1), blockTime: NOW, err: null}],
       getTransaction: async () => sentSol(ACCOUNT.publicKey, RECIPIENT, 2_480_000_000, NOW),
     });
-    await renderInWallet(<TxDetail signature={sig(1)} onBack={() => undefined} />, {reader});
+    await renderInWallet(<TxDetail signature={sig(1)} onBack={() => undefined} onTryAgain={tryAgain} />, {reader});
     expect(await screen.findByText('SENT')).toBeTruthy();
   });
 
   it('not in the recent history: the line, and still the explorer link', async () => {
     let pages = 0;
     const reader = walletReader({getSignaturesForAddress: async () => (pages++, [])});
-    await renderInWallet(<TxDetail signature={sig(8)} onBack={() => undefined} />, {reader});
+    await renderInWallet(<TxDetail signature={sig(8)} onBack={() => undefined} onTryAgain={tryAgain} />, {reader});
     expect(await screen.findByText('This transaction is not in the recent history yet.')).toBeTruthy();
     expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
     await waitFor(() => expect(pages).toBe(1));
@@ -195,7 +233,7 @@ describe('#27 tx-detail', () => {
       },
       getTransaction: async () => otherTx(ACCOUNT.publicKey, NOW),
     });
-    await renderInWallet(<TxDetail signature={sig(9999)} onBack={() => undefined} />, {reader});
+    await renderInWallet(<TxDetail signature={sig(9999)} onBack={() => undefined} onTryAgain={tryAgain} />, {reader});
     expect(await screen.findByText('This transaction is not in the recent history yet.')).toBeTruthy();
     expect(screen.getByRole('link', {name: 'Explorer'})).toBeTruthy();
     expect(calls).toBe(3);
@@ -212,7 +250,7 @@ describe('#27 tx-detail', () => {
     const engine: Engine = {...w.engine, history: (account, before) => (calls.push(account), w.engine.history(account, before))};
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <TxDetail signature={sig(1)} onBack={() => undefined} />
+        <TxDetail signature={sig(1)} onBack={() => undefined} onTryAgain={tryAgain} />
       </WalletProvider>,
     );
     await screen.findByText('This transaction is not in the recent history yet.');
@@ -239,7 +277,7 @@ describe('#27 tx-detail', () => {
       },
       getTransaction: async s => txs[s] ?? null,
     });
-    await renderInWallet(<TxDetail signature={target} onBack={() => undefined} />, {reader});
+    await renderInWallet(<TxDetail signature={target} onBack={() => undefined} onTryAgain={tryAgain} />, {reader});
     expect(await screen.findByText('SENT')).toBeTruthy();
     expect(seenBefore).toEqual([undefined, list1[9]]);
   });
@@ -254,7 +292,7 @@ describe('#27 a malformed searchError', () => {
     const engine: Engine = {...w.engine, history: async () => ({ok: false, error: 'malformed'})};
     render(
       <WalletProvider engine={engine} platform={w.platform} surface="popup">
-        <TxDetail signature={sig(1)} onBack={() => undefined} />
+        <TxDetail signature={sig(1)} onBack={() => undefined} onTryAgain={tryAgain} />
       </WalletProvider>,
     );
     expect(await screen.findByText('Could not read this transaction.')).toBeTruthy();
@@ -287,7 +325,7 @@ describe('#27 network failure while searching', () => {
     await renderInWallet(
       <>
         <NetModeProbe />
-        <TxDetail signature={sig(1)} onBack={() => undefined} />
+        <TxDetail signature={sig(1)} onBack={() => undefined} onTryAgain={tryAgain} />
       </>,
       {reader},
     );
@@ -312,7 +350,7 @@ describe('#27 network failure while searching', () => {
     await renderInWallet(
       <>
         <NetModeProbe />
-        <TxDetail signature={sig(1)} onBack={() => undefined} />
+        <TxDetail signature={sig(1)} onBack={() => undefined} onTryAgain={tryAgain} />
       </>,
       {reader},
     );
@@ -363,7 +401,7 @@ describe('#27 and the model: a successful search reports itself (m.reached)', ()
     await renderInWallet(
       <>
         <NetModeProbe />
-        <TxDetail signature={sig(1)} onBack={() => undefined} />
+        <TxDetail signature={sig(1)} onBack={() => undefined} onTryAgain={tryAgain} />
       </>,
       {reader},
     );
```

- [ ] **Step 2: Run them and watch them fail.**

```bash
npx vitest run src/app/__tests__/Activity.test.tsx src/app/__tests__/App.test.tsx src/app/__tests__/Home.test.tsx src/app/__tests__/Switcher.test.tsx src/app/__tests__/TxDetail.test.tsx
```
Expected (dry run): FAIL — Test Files 4 failed | 1 passed (5) · Tests 6 failed | 102 passed (108) (the code this task adds does not exist yet, or the behaviour is the old one).

- [ ] **Step 3: Write the implementation.**

Modify `extension/src/app/App.tsx`:

```diff
diff --git a/extension/src/app/App.tsx b/extension/src/app/App.tsx
index 227d1d6..55400bf 100644
--- a/extension/src/app/App.tsx
+++ b/extension/src/app/App.tsx
@@ -110,7 +110,14 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
   let screen;
   if (route.screen === 'tab') {
     if (route.tab === 'home') {
-      screen = <Home onReceive={() => go({type: 'push', route: {screen: 'receive'}})} onActivity={() => go({type: 'tab', tab: 'activity'})} onAccounts={() => setAccounts(true)} />;
+      screen = (
+        <Home
+          onSend={() => go({type: 'push', route: {screen: 'send', draft: null, notice: null}})}
+          onReceive={() => go({type: 'push', route: {screen: 'receive'}})}
+          onPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
+          onAccounts={() => setAccounts(true)}
+        />
+      );
     } else if (route.tab === 'activity') {
       screen = (
         <Activity
@@ -119,6 +126,7 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
             go({type: 'push', route: {screen: 'tx', signature: item.signature}});
           }}
           onReceive={() => go({type: 'push', route: {screen: 'receive'}})}
+          onPending={p => go({type: 'push', route: {screen: 'status', account: p.account, id: p.id, since: p.createdAt}})}
         />
       );
     } else {
@@ -127,7 +135,16 @@ function Shell({first, onLeaveHandOver}: {first: Route[]; onLeaveHandOver: () =>
   } else if (route.screen === 'receive') {
     screen = <Receive onBack={() => go({type: 'pop'})} />;
   } else if (route.screen === 'tx') {
-    screen = <TxDetail signature={route.signature} item={txItems[route.signature]} onBack={() => go({type: 'pop'})} />;
+    screen = (
+      <TxDetail
+        signature={route.signature}
+        item={txItems[route.signature]}
+        onBack={() => go({type: 'pop'})}
+        onTryAgain={intent => {
+          if (selected !== null) toReview(selected, intent, null);
+        }}
+      />
+    );
   } else if (route.screen === 'send') {
     screen = (
       <Send
```

Modify `extension/src/app/app.css`:

```diff
diff --git a/extension/src/app/app.css b/extension/src/app/app.css
index c23c973..76ef10a 100644
--- a/extension/src/app/app.css
+++ b/extension/src/app/app.css
@@ -729,3 +729,9 @@ a.btn {
   bottom: calc(80px + var(--space-4));
   z-index: 5;
 }
+
+/* #11's Send quick action, disabled offline and in the cool-down (#42: 0.55, index.html #s42). */
+.s-dash .quick .qa:disabled {
+  opacity: 0.55;
+  cursor: not-allowed;
+}
```

Modify `extension/src/app/screens/Activity.tsx`:

```diff
diff --git a/extension/src/app/screens/Activity.tsx b/extension/src/app/screens/Activity.tsx
index 47286e0..f400ddb 100644
--- a/extension/src/app/screens/Activity.tsx
+++ b/extension/src/app/screens/Activity.tsx
@@ -13,12 +13,12 @@ import type {HistoryItem, Pending} from '../engine';
 /** wallet.history answers 10 per page (background HISTORY_PAGE_SIZE); "Load more" follows the reply's own `next` cursor (review fix round 1 #1), not this count. */
 export const PAGE_SIZE = 10;
 
-function PendingRow({p, now}: {p: Pending; now: number}) {
+function PendingRow({p, now, onOpen}: {p: Pending; now: number; onOpen: () => void}) {
   const secs = Math.max(0, Math.floor((now - p.createdAt) / 1000));
   const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
-  // Plan-1 stand-in: a pending row opens nothing (#21/#54 arrive with the send flow, plan 3).
+  // An open send opens #21 (or #54 once it is stuck).
   return (
-    <div className="tx-row" data-pending={p.id}>
+    <button type="button" className="tx-row" data-pending={p.id} onClick={onOpen}>
       <span className="ic send">
         <ExtIcon name="arrow-up-right" size={20} />
       </span>
@@ -30,7 +30,7 @@ function PendingRow({p, now}: {p: Pending; now: number}) {
           waiting · {Math.floor(secs / 60)} m {secs % 60} s
         </span>
       </div>
-    </div>
+    </button>
   );
 }
 
@@ -71,7 +71,7 @@ function Empty({refreshing, onReceive}: {refreshing: boolean; onReceive: () => v
  * the background), open sends on top. No fiat per row (it would need historical prices), no origin
  * badge (B1c), counterparties short at equal weight (a list is a scanning aid; #27 shows the whole address).
  */
-export function Activity({onTx, onReceive}: {onTx: (item: HistoryItem) => void; onReceive: () => void}) {
+export function Activity({onTx, onReceive, onPending}: {onTx: (item: HistoryItem) => void; onReceive: () => void; onPending: (p: Pending) => void}) {
   const m = useWallet();
   const now = useNow(1_000, m.now);
   const account = m.account;
@@ -213,7 +213,7 @@ export function Activity({onTx, onReceive}: {onTx: (item: HistoryItem) => void;
           <>
             <div className="date-h noc-overline">PENDING</div>
             {open.map(p => (
-              <PendingRow key={p.id} p={p} now={now} />
+              <PendingRow key={p.id} p={p} now={now} onOpen={() => onPending(p)} />
             ))}
           </>
         ) : null}
```

Modify `extension/src/app/screens/Home.tsx`:

```diff
diff --git a/extension/src/app/screens/Home.tsx b/extension/src/app/screens/Home.tsx
index 0f7be2d..6e6a9e9 100644
--- a/extension/src/app/screens/Home.tsx
+++ b/extension/src/app/screens/Home.tsx
@@ -44,7 +44,7 @@ function NetBanner({mode, sustainedNow, lastSync, failures, now}: {mode: NetMode
   );
 }
 
-/** #11's pending strip (plan-1 stand-in: it opens Activity, not #21/#54). */
+/** #11's pending strip: an open send of this account, which opens #21 (or #54 once it is stuck). */
 function PendingStrip({p, now, onOpen}: {p: Pending; now: number; onOpen: () => void}) {
   const slow = p.state === 'stuck' || now - p.createdAt > 80_000;
   const amount = formatAmount(p.intent.amount, TOKEN_INFO[p.intent.token].decimals, {min: 0, max: TOKEN_INFO[p.intent.token].decimals});
@@ -65,11 +65,11 @@ const DOTS = [0, 1, 2, 3, 4, 5];
 const joined = (...parts: (string | null)[]): string => parts.filter((x): x is string => x !== null).join(' · ');
 
 /**
- * #11 dashboard (spec §5.1) with #42's offline states and the D26 refused state (§5.4). Plan-1
- * stand-ins, stated in the plan: no Send quick action (the send flow is plan 3), and the pending
- * strip opens Activity.
+ * #11 dashboard (spec §5.1) with #42's offline states and the D26 refused state (§5.4). Send opens #12 —
+ * disabled offline, while the server cannot be reached and in the 403 cool-down (D36: Receive stays, the
+ * address is local); the pending strip opens the open send at #21/#54.
  */
-export function Home({onReceive, onActivity, onAccounts}: {onReceive: () => void; onActivity: () => void; onAccounts: () => void}) {
+export function Home({onSend, onReceive, onPending, onAccounts}: {onSend: () => void; onReceive: () => void; onPending: (p: Pending) => void; onAccounts: () => void}) {
   const m = useWallet();
   const now = useNow(1_000, m.now);
   const [hidden, setHidden] = useState(() => readPref(HIDE_BALANCES_KEY) === '1');
@@ -130,10 +130,12 @@ export function Home({onReceive, onActivity, onAccounts}: {onReceive: () => void
           <SkelLine width={140} height={14} />
         </div>
         <div className="quick">
-          <div className="qa">
-            <SkelCircle />
-            <SkelLine width={42} height={10} />
-          </div>
+          {[34, 42].map(w => (
+            <div className="qa" key={w}>
+              <SkelCircle />
+              <SkelLine width={w} height={10} />
+            </div>
+          ))}
         </div>
         <div className="section-h">
           <h3 className="noc-overline">TOKENS</h3>
@@ -185,7 +187,7 @@ export function Home({onReceive, onActivity, onAccounts}: {onReceive: () => void
     <div className="screen s-dash">
       {top}
       {banner}
-      {open === undefined ? null : <PendingStrip p={open} now={now} onOpen={onActivity} />}
+      {open === undefined ? null : <PendingStrip p={open} now={now} onOpen={() => onPending(open)} />}
       <section className={`hero${heroStale ? ' s8-stale' : ''}`}>
         {heroStale ? <div className="s8-stale-mark" /> : null}
         <div className="label-row">
@@ -237,6 +239,12 @@ export function Home({onReceive, onActivity, onAccounts}: {onReceive: () => void
         </div>
       </section>
       <div className="quick">
+        <button type="button" className="qa" disabled={away || refused} onClick={onSend}>
+          <span className="icon">
+            <ExtIcon name="send" size={18} />
+          </span>
+          <span className="lbl">Send</span>
+        </button>
         <button type="button" className="qa" onClick={onReceive}>
           <span className="icon">
             <ExtIcon name="receive" size={18} />
```

Modify `extension/src/app/screens/TxDetail.tsx`:

```diff
diff --git a/extension/src/app/screens/TxDetail.tsx b/extension/src/app/screens/TxDetail.tsx
index 9a48d91..27a5283 100644
--- a/extension/src/app/screens/TxDetail.tsx
+++ b/extension/src/app/screens/TxDetail.tsx
@@ -9,7 +9,8 @@ import {ExtIcon} from '../ui/ExtIcon';
 import {useCopy} from '../ui/useCopy';
 import {useNow} from '../useNow';
 import {Banner, RefusedBanner} from '../ui/Banner';
-import type {HistoryItem} from '../engine';
+import {LockedButton} from '../ui/LockedButton';
+import type {HistoryItem, Intent} from '../engine';
 import {MAINNET_FEE_TREASURY} from '../../../../core/fees/transferMarkup';
 
 /** At most this many history pages are read to find a signature the list has not loaded. */
@@ -67,9 +68,11 @@ export function ExplorerLink({signature, label = 'Explorer', icon = true}: {sign
 /**
  * #27 tx-detail (spec §6.3), from the #26 row (or, when only the signature is known, the first
  * FIND_PAGES history pages). No Block or Memo rows (not in HistoryView, G13), no Save (address book,
- * B1b-2b), no share (D19); fiat is today's price and says "now". Plan-1 stand-in: no [Try again].
+ * B1b-2b), no share (D19); fiat is today's price and says "now". A failed send offers [Try again] → #19
+ * with what it tried to send, when the decoder knows the recipient and the amount (plan 3, owner question 1,
+ * option A): #19 prepares it afresh and #20 shows the whole address before one tap sends.
  */
-export function TxDetail({signature, item: given, onBack}: {signature: string; item?: HistoryItem; onBack: () => void}) {
+export function TxDetail({signature, item: given, onBack, onTryAgain}: {signature: string; item?: HistoryItem; onBack: () => void; onTryAgain: (intent: Intent) => void}) {
   const m = useWallet();
   const now = useNow(30_000, m.now);
   const [item, setItem] = useState<HistoryItem | null | undefined>(given);
@@ -181,6 +184,7 @@ export function TxDetail({signature, item: given, onBack}: {signature: string; i
   const hash = <Address address={item.signature} label="Copy hash" />;
 
   if (item.failed) {
+    const retry: Intent | null = item.kind === 'sent' && item.token !== null && item.counterparty !== null && item.amount !== null && item.amount > 0n ? {token: item.token, recipient: item.counterparty, amount: item.amount} : null;
     return (
       <div className="screen s-txd">
         {top}
@@ -207,6 +211,12 @@ export function TxDetail({signature, item: given, onBack}: {signature: string; i
             </Row>
           </div>
           <div className="actions-row">
+            {retry === null ? null : (
+              <LockedButton className="btn btn-primary" disabled={m.net.mode === 'refused'} onPress={() => onTryAgain(retry)}>
+                <ExtIcon name="refresh" size={16} />
+                Try again
+              </LockedButton>
+            )}
             <ExplorerLink signature={item.signature} />
           </div>
         </div>
```

- [ ] **Step 4: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 1872946..98e55bc 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -1834,8 +1834,9 @@ point here. **One user tap per broadcast, always (D38; review B1).**
   - **Cold skeleton (from Task 12):** the real top bar instead of skeleton circles; no mode-toggle
     bar (D4); no "See all" skeleton; the quick-action skeleton shows only the actions that exist —
     Receive in plan 1, Receive + Send from plan 3.
-  - **Plan-1 stand-in:** no Send quick action and no resume until plan 3 (§12); the pending strip
-    shows the state text and opens Activity.
+  - **Plan 3:** the Send quick action opens #12 (disabled offline, unreachable and refused — D36 keeps
+    Receive); the pending strip opens that send at #21/#54; a popup opened while a prepared send waits
+    shows #20 in resume mode (§4.5). (Plan 1 had no Send and no resume, and its strip opened Activity.)
   - The bottom nav is Home / Activity / Settings (D3), not Home/Portfolio/NFTs/Profile.
   - Pull-to-refresh becomes the refresh button (D2).
```

- [ ] **Step 5: Run them green, then the whole suite.**

```bash
npx vitest run src/app/__tests__/Activity.test.tsx src/app/__tests__/App.test.tsx src/app/__tests__/Home.test.tsx src/app/__tests__/Switcher.test.tsx src/app/__tests__/TxDetail.test.tsx
npx tsc --noEmit && npx vitest run
```
Expected (dry run): Test Files 5 passed (5) · Tests 108 passed (108); tsc clean; whole suite Test Files 111 passed (111) · Tests 1935 passed (1935).

- [ ] **Step 6: Mutations (scratch copy outside the repository, `timeout 300`, each alone, then discard the copy).**

Make the copy with `git archive HEAD | tar -x -C <scratch>` and link `extension/node_modules` and `web/node_modules` into it (never `git worktree`, never the repository's own files). Run from the copy's `extension/`.

- **M14a** — `extension/src/app/screens/Home.tsx`:

  ```diff
  - className="qa" disabled={away || refused} onClick={onSend}
  + className="qa" onClick={onSend}
  ```
  `npx vitest run src/app/__tests__/Home.test.tsx` — Expected: **red** (1 failed | 29 passed (30)).

- [ ] **Step 7: The §8 visual checklist for this screen.** Task 17 shoots every state of this screen; after it, the opus-tier reviewer checks them against index.html with the checklist in Task 17. Nothing to run here; the component tests above already assert every string.

- [ ] **Step 8: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/src/app/App.tsx extension/src/app/__tests__/Activity.test.tsx extension/src/app/__tests__/App.test.tsx extension/src/app/__tests__/Home.test.tsx extension/src/app/__tests__/Switcher.test.tsx extension/src/app/__tests__/TxDetail.test.tsx extension/src/app/app.css extension/src/app/screens/Activity.tsx extension/src/app/screens/Home.tsx extension/src/app/screens/TxDetail.tsx
git commit -F - <<'MSG'
feat(extension): #11's Send, the pending strip and #26's pending rows open the send flow; #27's [Try again] (stand-ins removed)

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 15: E2E specs 4 and 11 — the send with re-authentication, and #12's hints (carry 5)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`
- Modify: `extension/e2e/fakeCoordinator.ts`
- Create: `extension/e2e/send.spec.ts`
- Create: `extension/e2e/sendHelpers.ts`

**Interfaces:**
- Consumes: everything above; `e2e/popupHarness.ts`, `makeEnvelope.ts`, `vaultPage.ts`.
- Produces: `fakeCoordinator.ts`: fee-included simulation, `simulatedPayerAfter`, `tokenAccounts` (jsonParsed); `e2e/sendHelpers.ts`; `e2e/send.spec.ts`.

Spec §8.5 specs 4 and 11, carry 5. The fake's simulation now answers as §11.5 measured a node: the payer's lamports after the transaction **with** its fee (5 000 per signature + price × limit / 10⁶), and `getTokenAccountsByOwner` answers token accounts in the node's jsonParsed shape that `core/solana/rpc.ts` reads (no E2E sends a token; the token account feeds #11 and #43). Spec 4: #11 → #12 → #43 → #19 → #20 → #10 in a new tab (amount and whole recipient from `vault.challengeInfo`, a crafted link describes nothing) → #20 confirmed in the same tab with **no broadcast for 3 s** → one tap → #21 success, exactly one broadcast of one transaction; then a second run cancelled on #10 leaves nothing prepared (E7). Spec 11: a first-time address shows design state 6; after a confirmed send, "Verified · sent before · today". Every spec ends with `contained(h)`.

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/fakeCoordinator.ts`:

```diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
index da5a3e6..29d3ed8 100644
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -41,6 +41,14 @@ export interface FakeCoordinator {
   simulateError: boolean;
   /** Every simulateTransaction's requested addresses (null = the field was missing). */
   simulations: (string[] | null)[];
+  /** Plan 3: the payer's lamports after each simulated transaction, fee included — what the node answered. */
+  simulatedPayerAfter: number[];
+  /**
+   * Plan 3: SPL token accounts per owner, answered by getTokenAccountsByOwner in the node's jsonParsed shape
+   * (what core/solana/rpc.ts reads: pubkey, account.data.parsed.info.{mint, owner, tokenAmount.{amount,
+   * decimals}}). No E2E sends a token: they are for the balances #11 and #43 show.
+   */
+  tokenAccounts: Map<string, {pubkey: string; mint: string; amount: string; decimals: number}[]>;
   /** Per owner, newest first: the signatures getSignaturesForAddress pages through, and each getTransaction result. */
   history: Map<string, {signature: string; tx: unknown}[]>;
   /**
@@ -66,7 +74,7 @@ function shortVec(bytes: Uint8Array): {value: number; size: number} {
  * the message (0x80 prefix, 3-byte header, keys, blockhash, instructions). Read by hand: the E2E runs
  * under Playwright's loader, where @solana/web3.js's CommonJS dependencies do not load.
  */
-function parseV0(wire: Uint8Array): {keys: string[]; instructions: {program: number; accounts: number[]; data: Uint8Array}[]} {
+function parseV0(wire: Uint8Array): {signers: number; keys: string[]; instructions: {program: number; accounts: number[]; data: Uint8Array}[]} {
   let at = 0;
   const vec = (): number => {
     const {value, size} = shortVec(wire.subarray(at));
@@ -76,6 +84,8 @@ function parseV0(wire: Uint8Array): {keys: string[]; instructions: {program: num
   const signatures = vec();
   at += 64 * signatures;
   if (wire[at] !== 0x80) throw new Error('not a v0 message');
+  // The header's first byte: the required signatures (each pays the 5 000-lamport base fee).
+  const signers = wire[at + 1] ?? 0;
   at += 4;
   const keys: string[] = [];
   for (let n = vec(), i = 0; i < n; i++, at += 32) keys.push(base58.encode(wire.subarray(at, at + 32)));
@@ -90,13 +100,14 @@ function parseV0(wire: Uint8Array): {keys: string[]; instructions: {program: num
     instructions.push({program, accounts, data: wire.slice(at, at + len)});
     at += len;
   }
-  return {keys, instructions};
+  return {signers, keys, instructions};
 }
 
 /**
  * A simulated coordinator: the read proxy for the methods the engine uses, the broadcast route
  * with the contract this plan defines (docs/superpowers/specs/2026-09-29-coordinator-broadcast-route.md),
- * prices and /stats. 10 SOL, no token accounts, quiet fees, simulation always passes. Every
+ * prices and /stats. 10 SOL, no token accounts unless a spec lists some, quiet fees, a simulation that applies the
+ * fee and the System transfers. Every
  * getLatestBlockhash hands out a fresh blockhash valid for BLOCKHASH_LIFETIME blocks from the
  * current height, as a real node does.
  */
@@ -116,6 +127,8 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     accountKinds: new Map(),
     simulateError: false,
     simulations: [],
+    simulatedPayerAfter: [],
+    tokenAccounts: new Map(),
     history: new Map(),
     hold: () => {
       let release: () => void = () => undefined;
@@ -143,9 +156,11 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
   const lamportsOf = (address: string): number => fake.lamports.get(address) ?? fake.defaultLamports;
 
   /**
-   * What a node answers: the requested accounts after the transaction, WITHOUT the fee (the engine
-   * accepts either form, E2) — the payer's lamports less every System transfer it makes. Its error
-   * switch answers err with accounts: null, as the real RPC does (review H2).
+   * What a node answers: the requested accounts after the transaction WITH its fee paid, as the coordinator
+   * measured a real node answer (spec §11.5: a payer that sends `balance − 5 000` ends at exactly 0) — the
+   * payer's lamports less every System transfer it makes, less 5 000 per signature and the priority fee its
+   * ComputeBudget instructions set (price × limit / 10⁶, rounded up). Its error switch answers err with
+   * accounts: null, as the real RPC does (review H2).
    */
   const simulate = (params: unknown[]): unknown => {
     const config = params[1] as {accounts?: {encoding?: string; addresses?: unknown}} | undefined;
@@ -153,21 +168,47 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
     fake.simulations.push(addresses);
     if (addresses === null || config?.accounts?.encoding !== 'base64') fake.unexpected.push('simulateTransaction without accounts {encoding: base64, addresses}');
     if (fake.simulateError) return {context: context(), value: {err: {InstructionError: [2, {Custom: 1}]}, logs: [], accounts: null, unitsConsumed: 0, returnData: null}};
-    const {keys, instructions} = parseV0(base64.decode(params[0] as string));
+    const {signers, keys, instructions} = parseV0(base64.decode(params[0] as string));
     const payer = keys[0] ?? '';
     let out = 0;
+    let price = 0n;
+    let limit = 0n;
     for (const ix of instructions) {
       const data = ix.data;
-      if (keys[ix.program] === '11111111111111111111111111111111' && data[0] === 2 && keys[ix.accounts[0] ?? -1] === payer) {
-        out += Number(new DataView(data.buffer, data.byteOffset, data.byteLength).getBigUint64(4, true));
-      }
+      const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
+      if (keys[ix.program] === '11111111111111111111111111111111' && data[0] === 2 && keys[ix.accounts[0] ?? -1] === payer) out += Number(view.getBigUint64(4, true));
+      if (keys[ix.program] === 'ComputeBudget111111111111111111111111111111' && data[0] === 2) limit = BigInt(view.getUint32(1, true));
+      if (keys[ix.program] === 'ComputeBudget111111111111111111111111111111' && data[0] === 3) price = view.getBigUint64(1, true);
     }
+    const fee = 5_000 * signers + Number((price * limit + 999_999n) / 1_000_000n);
+    const after = lamportsOf(payer) - out - fee;
+    fake.simulatedPayerAfter.push(after);
     const accounts = (addresses ?? []).map(a =>
-      a === payer ? {lamports: lamportsOf(payer) - out, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0} : null,
+      a === payer ? {lamports: after, owner: '11111111111111111111111111111111', data: ['', 'base64'], executable: false, rentEpoch: 18446744073709552000, space: 0} : null,
     );
     return {context: context(), value: {err: null, logs: ['Program 11111111111111111111111111111111 success'], accounts, unitsConsumed: 450, returnData: null}};
   };
 
+  /** getTokenAccountsByOwner in the node's jsonParsed shape, filtered by `mint` or `programId` as a node filters. */
+  const tokenAccountsOf = (owner: string, filter: {mint?: string; programId?: string} | undefined): unknown[] =>
+    (fake.tokenAccounts.get(owner) ?? [])
+      .filter(t => filter?.mint === undefined || t.mint === filter.mint)
+      .map(t => ({
+        pubkey: t.pubkey,
+        account: {
+          data: {
+            parsed: {info: {isNative: false, mint: t.mint, owner, state: 'initialized', tokenAmount: {amount: t.amount, decimals: t.decimals, uiAmount: Number(t.amount) / 10 ** t.decimals, uiAmountString: String(Number(t.amount) / 10 ** t.decimals)}}, type: 'account'},
+            program: 'spl-token',
+            space: 165,
+          },
+          executable: false,
+          lamports: 2_039_280,
+          owner: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
+          rentEpoch: 18446744073709552000,
+          space: 165,
+        },
+      }));
+
   const rpcResult = (method: string, params: unknown[]): unknown => {
     switch (method) {
       case 'getBalance':
@@ -179,7 +220,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
       case 'simulateTransaction':
         return simulate(params);
       case 'getTokenAccountsByOwner':
-        return {context: context(), value: []};
+        return {context: context(), value: tokenAccountsOf(params[0] as string, params[1] as {mint?: string; programId?: string} | undefined)};
       case 'getMultipleAccounts':
         // Each address as the node reports it: a system account holding its lamports, or null when it holds
         // none (the import probe reads balances this way — the same `lamports` table as getBalance).
```

Create `extension/e2e/send.spec.ts`:

```ts
import {test, expect} from '@playwright/test';
import {contained, launchPopup} from './popupHarness';
import {E2E_PASSWORD} from './makeEnvelope';
import {ACCOUNT, OTHER_CHALLENGE, RECIPIENT, groups, msg, realWallet, sol, startSend} from './sendHelpers';

// Spec B1b-2a §8.5, plan 3: specs 4 and 11 (spec 5 in stuck.spec.ts) — the send flow in the real extension (popup, vault page, UI tab)
// against the contained fake coordinator. Every spec ends with contained(h): the fake saw the worker's requests,
// nothing unexpected, Solscan and every other noc-tura.io name never contacted. The sends are SOL: the fake
// models token accounts for the balances #43 shows, and no E2E sends a token (component tests cover SPL sends
// against the real background).

test('4 · send with re-authentication: #11 → #12 → #43 → #19 → #20 → #10 from the background → #20 confirmed, no broadcast → one tap → #21 — and a cancel on #10 discards', async () => {
  const h = await launchPopup('noctura-e2e-send-');
  try {
    await realWallet(h);
    const popup = await startSend(h, '0.01', {firstTime: true});
    // #19: the balance delta, and "After" from the fake's simulated state (fee included, as a node answers).
    const after = h.fake.simulatedPayerAfter.at(-1) ?? -1;
    expect(after).toBe(10_000_000_000 - 10_000_000 - 5_050);
    await expect(popup.locator('.delta-row').first()).toHaveText('Sending− 0.0100 SOL');
    await expect(popup.locator('.delta-row.app-after')).toHaveText(`After${sol(after)} SOL`);
    await popup.getByRole('button', {name: 'Continue to confirm'}).click();
    // #20: the first-time banner; the proof will be asked in a new tab.
    await expect(popup.getByText("You've never sent to this address")).toBeVisible();
    await expect(popup.getByText('Confirmation opens in a new tab.')).toBeVisible();
    expect(await groups(popup, '.headline')).toBe(RECIPIENT);
    const opened = h.ctx.waitForEvent('page');
    await popup.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    const tab = await opened;
    await tab.waitForURL(/unlock\.html\?mode=reauth&challenge=[0-9a-f]{32}$/);
    // #10 shows the amount and the whole recipient read from vault.challengeInfo — never from its URL.
    await expect(tab.locator('#ra-about')).toHaveText('You are about to send', {timeout: 30_000});
    await expect(tab.locator('#ra-amount')).toHaveText('0.0100');
    expect(await groups(tab, '#ra-rows')).toBe(RECIPIENT);
    // A crafted link with another (valid-looking) challenge id describes nothing.
    const crafted = await h.ctx.newPage();
    await crafted.goto(`chrome-extension://${h.id}/unlock.html?mode=reauth&challenge=${OTHER_CHALLENGE}`);
    await expect(crafted.locator('#ra-notice-line')).toHaveText('This confirmation has expired. Start the send again from the Noctura icon.', {timeout: 30_000});
    await crafted.close();
    expect(h.fake.broadcasts).toEqual([]);
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    // D38: the same tab shows #20 confirmed with a fresh preview — and nothing is broadcast without a tap.
    await tab.waitForURL(`chrome-extension://${h.id}/wallet.html#/send/resume?account=${ACCOUNT}`, {timeout: 60_000});
    await expect(tab.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible();
    const quietUntil = Date.now() + 3_000;
    await expect.poll(async () => (h.fake.broadcasts.length > 0 ? 'sent' : Date.now() >= quietUntil ? 'quiet' : 'waiting'), {timeout: 10_000, intervals: [250]}).toBe('quiet');
    await tab.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(tab.getByText('Sent successfully')).toBeVisible({timeout: 30_000});
    await expect(tab.getByText('Done — open the Noctura icon any time.')).toBeVisible();
    // Exactly one broadcast, of one transaction.
    expect(h.fake.broadcasts).toHaveLength(1);
    expect(new Set(h.fake.broadcastWires).size).toBe(1);

    // A second run, cancelled on #10: the tab closes and nothing is left to resume (E7). 1 SOL is over 5 % of 10.
    const again = await startSend(h, '1', {firstTime: false});
    await again.getByRole('button', {name: 'Continue to confirm'}).click();
    const second = h.ctx.waitForEvent('page');
    await again.getByRole('button', {name: 'Send 1.0000 SOL'}).click();
    const cancelTab = await second;
    await expect(cancelTab.locator('#ra-cancel')).toHaveText('Cancel send', {timeout: 30_000});
    const closed = cancelTab.waitForEvent('close');
    await cancelTab.click('#ra-cancel');
    await closed;
    const ui = await h.ctx.newPage();
    await ui.goto(`chrome-extension://${h.id}/wallet.html#/home`);
    expect(await msg(ui, {type: 'wallet.preparedFor', account: ACCOUNT})).toEqual({ok: true, data: null});
    expect(h.fake.broadcasts).toHaveLength(1);
    contained(h);
  } finally {
    await h.close();
  }
});

test('11 · #12’s recipient hints (E6): a first-time address shows design state 6; after a confirmed send to it, "Verified · sent before · today"', async () => {
  const h = await launchPopup('noctura-e2e-hints-');
  try {
    await realWallet(h);
    // The first-time state, then a confirmed send through the real flow: #20 → #10 → #20 confirmed → one tap.
    const popup = await startSend(h, '0.01', {firstTime: true});
    await popup.getByRole('button', {name: 'Continue to confirm'}).click();
    const opened = h.ctx.waitForEvent('page');
    await popup.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    const tab = await opened;
    await expect(tab.locator('#ra-about')).toHaveText('You are about to send', {timeout: 30_000});
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    await expect(tab.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible({timeout: 60_000});
    await tab.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(tab.getByText('Sent successfully')).toBeVisible({timeout: 30_000});
    // The same address on #12 now: known, with the day of its last confirmed send — and no first-time banner.
    const next = await h.openPopup();
    await next.getByRole('button', {name: 'Send', exact: true}).click();
    await next.getByLabel('Recipient', {exact: true}).fill(RECIPIENT);
    await expect(next.locator('.helper.ok')).toHaveText(/^\s*Verified · sent before · today$/);
    await expect(next.getByText('First-time recipient')).toHaveCount(0);
    await next.getByLabel('Amount').fill('0.01');
    await expect(next.locator('.sticky-bar button')).toHaveText('Send 0.01 SOL');
    contained(h);
  } finally {
    await h.close();
  }
});
```

Create `extension/e2e/sendHelpers.ts`:

```ts
import {expect, type Page} from '@playwright/test';
import type {Harness} from './popupHarness';
import {E2E_ACCOUNTS, E2E_PASSWORD, makeEnvelope} from './makeEnvelope';
import {unlockWith} from './vaultPage';

// The send flow's E2E helpers (plan 3): send.spec.ts (specs 4, 5, 11) and visual-send.spec.ts. Public constants
// only; nothing here is imported from core/ (the E2E rule).
export const ACCOUNT = E2E_ACCOUNTS[0];
export const RECIPIENT = '9Y7FtteLhCJABAQtkYEFZs46rJgy1ixMA1JFMUepTki4';
const NOC_MINT = 'B61SyRxF2b8JwSLZHgEUF6rtn6NUikkrK1EMEgP6nhXW';
/** Any valid token-account address (an E2E-only constant). */
const NOC_HOLDING = 'FpV5mr137k3GfLJqqWnZer12v2KxZfEEQzxXb6sJLABU';
/** A challenge id the background never issued: 32 lowercase hex. */
export const OTHER_CHALLENGE = 'ab'.repeat(16);

declare const chrome: {
  runtime: {sendMessage(m: unknown): Promise<unknown>};
  storage: {local: {set(o: object): Promise<void>; get(k: string): Promise<Record<string, unknown>>}};
};
export const msg = async (page: Page, m: unknown) => (await page.evaluate(x => chrome.runtime.sendMessage(x), m)) as {ok: boolean; error?: string; data?: unknown};
export const groups = async (page: Page, scope: string): Promise<string> => (await page.locator(`${scope} .addr-groups > span`).allTextContents()).join('');
/** Lamports as #19 and #20 write SOL: every digit, at least four places. */
export function sol(lamports: number): string {
  const whole = Math.floor(lamports / 1e9);
  let frac = String(lamports % 1e9).padStart(9, '0');
  while (frac.length > 4 && frac.endsWith('0')) frac = frac.slice(0, -1);
  return `${whole}.${frac}`;
}

/**
 * The makeEnvelope wallet (a real envelope, so #10 can prove the password), unlocked through the vault page, with
 * 1 000 NOC in a token account of the node's jsonParsed shape, and — when asked — RECIPIENT already known.
 */
export async function realWallet(h: Harness, o: {known?: boolean} = {}): Promise<void> {
  h.fake.tokenAccounts.set(ACCOUNT, [{pubkey: NOC_HOLDING, mint: NOC_MINT, amount: '1000000000000', decimals: 9}]);
  h.fake.accountKinds.set(RECIPIENT, 'wallet');
  await h.sw.evaluate(({env, known}) => chrome.storage.local.set({v1_vault: env, ...(known === null ? {} : {v1_known_recipients: [known]})}), {env: await makeEnvelope(), known: o.known === true ? RECIPIENT : null});
  const vault = await h.ctx.newPage();
  await unlockWith(vault, h.id, E2E_PASSWORD);
  await vault.close();
}

/** #11 → #12 (SOL from #43) → the recipient and amount → the CTA. Returns the popup on #19. */
export async function startSend(h: Harness, amount: string, o: {firstTime: boolean; clock?: boolean}): Promise<Page> {
  const popup = await h.openPopup({clock: o.clock});
  await expect(popup.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
  await popup.getByRole('button', {name: 'Send', exact: true}).click();
  await popup.getByRole('button', {name: 'Token: SOL'}).click();
  const sheet = popup.getByRole('dialog', {name: 'Choose a token'});
  // #43 reads the token account the fake answers in the node's jsonParsed shape: 1 000 NOC.
  await expect(sheet.locator('.app-token-row').nth(1).locator('.amt')).toHaveText('1,000.00');
  await sheet.getByText('Solana').click();
  await popup.getByLabel('Recipient', {exact: true}).fill(RECIPIENT);
  await popup.getByLabel('Amount').fill(amount);
  if (o.firstTime) {
    // Spec 11's first half: a first-time address shows design state 6, and the CTA says a proof comes.
    await expect(popup.getByText('First-time recipient')).toBeVisible();
    await expect(popup.getByText('Never sent here before')).toBeVisible();
    await expect(popup.locator('.sticky-bar button')).toHaveText(/Review & unlock to send/);
  }
  await popup.locator('.sticky-bar button').click();
  await expect(popup.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
  return popup;
}
```

- [ ] **Step 2: The spec's entries for this task.**

Modify `docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md`:

```diff
diff --git a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
index 98e55bc..daa7f41 100644
--- a/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
+++ b/docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md
@@ -2280,6 +2280,9 @@ cannot click the toolbar action; stated). Specs:
     account 0 → at the finish `funded`, "This wallet now holds funds. Nothing was changed.", and the
     stored envelope is byte-identical.
 Every spec asserts `fake.unexpected` is empty and `hits > 0` (routing proven).
+**Plan 3:** specs 4, 5 and 11 send SOL; no E2E sends a token (component tests cover SPL sends against the
+real background, and the fake's jsonParsed token accounts feed #11 and #43). A token-send E2E is owed when
+the first token-send path is exercised on a device (plan-3 review, author's gaps).
 
 ### 8.6 Visual fidelity against the design
```

- [ ] **Step 3: Run the E2E — contained, then offline.**

```bash
npm run build && npx playwright test e2e/send.spec.ts
unshare -rn env PATH="$PATH" npx playwright test e2e/send.spec.ts   # if the runner has unshare
```
Expected (dry run): every test passes in both launches; every spec ends with `contained(h)`.

- [ ] **Step 4: The E2E mutation (D38, carry 6).** In the scratch copy, make #20 send by itself on a resume — in `src/app/screens/Confirm.tsx`, after `      else apply(v);` add `      if (v.reauth === null || v.reauth.proven) void engine.send(v.id);` — then `npm run build && npx playwright test e2e/send.spec.ts -g "4 ·"`. Expected: **red** at spec 4's quiet window (`Expected: "quiet"`, `Received: "sent"`). Discard the copy.

- [ ] **Step 5: Commit.**

```bash
git add docs/superpowers/specs/2026-09-29-extension-b1b2a-screens-design.md extension/e2e/fakeCoordinator.ts extension/e2e/send.spec.ts extension/e2e/sendHelpers.ts
git commit -F - <<'MSG'
test(extension): E2E specs 4 and 11 — one tap per broadcast after #10, the hints on #12 (carry 5)

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 16: E2E spec 5 — stuck, send again (the same bytes), expire, [Try again]

**Files:**
- Create: `extension/e2e/stuck.spec.ts`

**Interfaces:**
- Consumes: Task 15's helpers and fake (`mode = 'expire'`, `blockHeight`).
- Produces: `e2e/stuck.spec.ts`.

Spec §8.5 spec 5. Under Playwright's clock in the popup (the background keeps real time): #21 → "Taking longer than usual" at 80 s → #54 at 90 s, no "Speed up"; one "Send again (same transaction)" re-sends the **same** wire (`broadcastWires` is `[first, first]`); past the blockhash's life "Not confirmed — no funds moved." with its why; [Try again] → #19, a fresh simulation.

- [ ] **Step 1: Write the failing test.**

Create `extension/e2e/stuck.spec.ts`:

```ts
import {test, expect} from '@playwright/test';
import {contained, launchPopup} from './popupHarness';
import {msg, realWallet, startSend} from './sendHelpers';

// Spec B1b-2a §8.5, plan 3: spec 5 — a send the network never sees: #21 → #54 at 90 s, "Send again" re-sends the
// SAME signed bytes (D23), and only once its blockhash has expired (two null full-history checks) is a new
// attempt offered. The popup runs on Playwright's clock so its 90 s pass at once; the background keeps real time.

test('5 · stuck → send again (the same bytes) → expire: #21 → #54 at 90 s, one re-send of the same transaction, "Not confirmed — no funds moved.", [Try again] prepares anew', async () => {
  const h = await launchPopup('noctura-e2e-stuck-');
  try {
    h.fake.mode = 'expire';
    await realWallet(h, {known: true});
    // Playwright's clock in the popup, so its 90 s can pass at once; the background keeps real time.
    const popup = await startSend(h, '0.01', {firstTime: false, clock: true});
    await popup.getByRole('button', {name: 'Continue to confirm'}).click();
    await popup.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(popup.getByText('Broadcasting transaction…')).toBeVisible({timeout: 30_000});
    expect(h.fake.broadcastWires).toHaveLength(1);
    const first = h.fake.broadcastWires[0];
    // 80 s: #21 warns; 90 s: #54.
    await popup.clock.fastForward(81_000);
    await expect(popup.getByText('Taking longer than usual')).toBeVisible();
    await popup.clock.fastForward(10_000);
    await expect(popup.getByText('Transaction stuck')).toBeVisible();
    await expect(popup.getByText('Speed up')).toHaveCount(0);
    // The engine refuses a re-send within 2 s of the last one (real time): wait it out, then one tap.
    await popup.waitForTimeout(2_500);
    await popup.getByRole('button', {name: 'Send again (same transaction)'}).click();
    await expect(popup.getByText('The same transaction was sent to the network again. Its signature is unchanged, so only one copy can land.')).toBeVisible({timeout: 30_000});
    // The same signed bytes twice, and nothing else.
    expect(h.fake.broadcastWires).toEqual([first, first]);
    // Past the blockhash's life with margin: two null full-history checks ≥ 2 s apart, then expired.
    const pending = (await msg(popup, {type: 'wallet.pending'})).data as {lastValidBlockHeight: number}[];
    h.fake.blockHeight = (pending[0]?.lastValidBlockHeight ?? 0) + 33;
    await expect(popup.getByText('Not confirmed — no funds moved.')).toBeVisible({timeout: 45_000});
    await expect(popup.getByText('Its blockhash expired and two checks found it on no block. You can now make a new attempt.')).toBeVisible();
    expect(h.fake.broadcastWires).toEqual([first, first]);
    // [Try again] → #19 with the same intent: a fresh prepare (a new simulation, a new blockhash).
    const simulations = h.fake.simulations.length;
    await popup.getByRole('button', {name: 'Try again'}).click();
    await expect(popup.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    expect(h.fake.simulations.length).toBe(simulations + 1);
    contained(h);
  } finally {
    await h.close();
  }
});
```

- [ ] **Step 2: Run the E2E — contained, then offline.**

```bash
npm run build && npx playwright test e2e/stuck.spec.ts
unshare -rn env PATH="$PATH" npx playwright test e2e/stuck.spec.ts   # if the runner has unshare
```
Expected (dry run): every test passes in both launches; every spec ends with `contained(h)`.

- [ ] **Step 3: Commit.**

```bash
git add extension/e2e/stuck.spec.ts
git commit -F - <<'MSG'
test(extension): E2E spec 5 — stuck, the same transaction sent again, expired with no funds moved

Co-Authored-By: <the executing model's own line>
MSG
```

### Task 17: The visual pass (§8.6): every send-flow state shot at 412 × 600, for the opus-tier review

**Files:**
- Modify: `extension/e2e/fakeCoordinator.ts`
- Create: `extension/e2e/visual-send.spec.ts`

**Interfaces:**
- Consumes: everything above; the fake's `hold()` (plan 2).
- Produces: `e2e/visual-send.spec.ts` (42 shots); the fake's `mode: 'fail'` and `broadcastReject`.

Spec §8.6 and the plan-1/plan-2 lessons. Every state asserts its own copy before its shot; a transient state is held open by the fake (`hold()`: #19 simulating, #54 sending again) or shot under a paused clock (#21 slow, the 1.8 s toast). **Playwright's clock is the whole context's** (dry-run catch): every page opened after a clock popup runs ahead of the background and cannot take a quote, so the confirmed send is shot first, on the real clock. Then the opus-tier reviewer compares each image with index.html's same state (checklist below).

- [ ] **Step 1: Write the failing tests.**

Modify `extension/e2e/fakeCoordinator.ts`:

```diff
diff --git a/extension/e2e/fakeCoordinator.ts b/extension/e2e/fakeCoordinator.ts
index 29d3ed8..531b98a 100644
--- a/extension/e2e/fakeCoordinator.ts
+++ b/extension/e2e/fakeCoordinator.ts
@@ -13,8 +13,13 @@ const STATS = 'https://api.noc-tura.io/api/v1/stats';
 const METHOD_NOT_FOUND: unique symbol = Symbol('method not found');
 
 export interface FakeCoordinator {
-  /** 'confirm': a signature is confirmed at its second status check. 'expire': the network never sees it. */
-  mode: 'confirm' | 'expire';
+  /**
+   * 'confirm': a signature is confirmed at its second status check. 'expire': the network never sees it.
+   * 'fail' (plan 3): it lands at its second check, confirmed WITH an error (#44's rejected-by-program).
+   */
+  mode: 'confirm' | 'expire' | 'fail';
+  /** Plan 3: the broadcast route refuses before forwarding — 400 `rejected` (#44's network-error). */
+  broadcastReject: boolean;
   /** What getBlockHeight answers; the test moves it past a blockhash's life to drive expiry. */
   blockHeight: number;
   hits: {url: string; rpcMethod: string | null}[];
@@ -115,6 +120,7 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
   let held: Promise<void> | null = null;
   const fake: FakeCoordinator = {
     mode: 'confirm',
+    broadcastReject: false,
     blockHeight: FAKE_START_HEIGHT,
     hits: [],
     broadcasts: [],
@@ -149,7 +155,10 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
       if (fake.mode === 'expire') return null;
       const seen = (statusChecks.get(signature) ?? 0) + 1;
       statusChecks.set(signature, seen);
-      return seen >= 2 ? {slot: context().slot, confirmations: 1, err: null, status: {Ok: null}, confirmationStatus: 'confirmed'} : null;
+      if (seen < 2) return null;
+      return fake.mode === 'fail'
+        ? {slot: context().slot, confirmations: 1, err: {InstructionError: [2, {Custom: 1}]}, status: {Err: {InstructionError: [2, {Custom: 1}]}}, confirmationStatus: 'confirmed'}
+        : {slot: context().slot, confirmations: 1, err: null, status: {Ok: null}, confirmationStatus: 'confirmed'};
     }),
   });
 
@@ -305,6 +314,8 @@ export async function installFakeCoordinator(ctx: BrowserContext): Promise<FakeC
       const {value: count, size} = shortVec(wire);
       if (count < 1 || wire.length < size + 64) return json(route, 400, {error: 'malformed', message: 'no signature'});
       const signature = base58.encode(wire.subarray(size, size + 64));
+      // The route's own refusal (a contract reason): nothing was forwarded, nothing recorded as broadcast.
+      if (fake.broadcastReject) return json(route, 400, {error: 'rejected', message: 'Blockhash not found'});
       fake.broadcasts.push(signature);
       fake.broadcastWires.push(transaction ?? '');
       return json(route, 200, {signature});
```

Create `extension/e2e/visual-send.spec.ts`:

```ts
import {test, expect, type Page} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {contained, launchPopup} from './popupHarness';
import {E2E_PASSWORD} from './makeEnvelope';
import {ACCOUNT, RECIPIENT, msg, realWallet} from './sendHelpers';

// Spec B1b-2a §8.6, plan 3: every send-flow state the real extension can be driven to, at 412 × 600 (the popup) —
// the UI tab's #20 after #10 at the same width — saved for the review against the design (index.html #s12, #s43,
// #s19, #s20, #s21, #s54, #s44, #s10). Not a pixel diff: an opus-tier reviewer compares each image with the
// mockup of the same state using the checklist in the plan. Every shot asserts its own copy first; a transient
// state is held open by the fake (hold) or shot under the popup's paused clock. Screenshots are CI artifacts.
const DIR = 'test-results/visual';
const shot = async (page: Page, name: string, end = false) => {
  mkdirSync(DIR, {recursive: true});
  await page.screenshot({path: `${DIR}/${name}.png`});
  if (!end) return;
  await page.locator('main.app-content').evaluate(e => e.scrollTo(0, e.scrollHeight));
  await page.screenshot({path: `${DIR}/${name}-end.png`});
  await page.locator('main.app-content').evaluate(e => e.scrollTo(0, 0));
};
const toSend = async (p: Page) => {
  await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
  await p.getByRole('button', {name: 'Send', exact: true}).click();
  await expect(p.getByLabel('Recipient', {exact: true})).toBeVisible();
};
const fill = async (p: Page, recipient: string, amount: string) => {
  await p.getByLabel('Recipient', {exact: true}).fill(recipient);
  await p.getByLabel('Amount').fill(amount);
};
/** #19's Cancel discards first, then shows #12: wait for #12 before the next step. */
const cancelToSend = async (p: Page) => {
  await p.getByRole('button', {name: 'Cancel'}).click();
  await expect(p.getByLabel('Recipient', {exact: true})).toBeVisible();
};
const review = async (p: Page) => {
  await p.locator('.sticky-bar button').click();
  await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
};

test('visual: #11 with Send, #12’s states, #43, #19’s states', async () => {
  const h = await launchPopup('noctura-e2e-visual-send-');
  try {
    await realWallet(h);
    const p = await h.openPopup();
    await expect(p.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    await expect(p.locator('.quick .qa .lbl')).toHaveText(['Send', 'Receive']);
    await expect(p.getByText('Connected · syncing')).toHaveCount(0);
    await shot(p, '11-loaded-send');
    await p.getByRole('button', {name: 'Send', exact: true}).click();
    await expect(p.getByText('Set automatically — shown on the next step')).toBeVisible();
    await expect(p.getByLabel('Recipient', {exact: true})).toHaveAttribute('placeholder', 'Solana address');
    await shot(p, '12-idle');
    await p.getByLabel('Recipient', {exact: true}).fill('7xKXtgZASfW87dQQQbadinput123');
    await expect(p.getByText('Not a valid Solana address — check length & characters')).toBeVisible();
    await shot(p, '12-invalid-recipient');
    await p.getByRole('button', {name: 'Clear recipient'}).click();
    await p.getByRole('button', {name: 'Token: SOL'}).click();
    await expect(p.getByRole('dialog', {name: 'Choose a token'})).toBeVisible();
    await expect(p.locator('.app-token-row .amt')).toHaveText(['10.0000', '1,000.00', '0.00', '0.00']);
    await shot(p, '43-default');
    await p.getByRole('dialog', {name: 'Choose a token'}).getByText('Solana').click();
    await fill(p, RECIPIENT, '0.5');
    await expect(p.getByText('First-time recipient')).toBeVisible();
    await expect(p.locator('.available')).toHaveText('≈ $75.00 · 5% of balance — re-auth required');
    await shot(p, '12-first-time', true);
    await p.getByLabel('Amount').fill('75');
    await expect(p.getByText(/Insufficient balance — short by/)).toBeVisible();
    await shot(p, '12-insufficient');
    await p.getByRole('button', {name: 'MAX'}).click();
    await expect(p.getByText('MAX keeps 0.00089 SOL so the account stays open, plus the network fee.')).toBeVisible();
    await shot(p, '12-max');
    // #19 simulating, held open by the fake.
    await p.getByLabel('Amount').fill('0.01');
    const release = h.fake.hold();
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('Simulating on Solana mainnet')).toBeVisible();
    await expect(p.getByRole('button', {name: 'Simulating…'})).toBeDisabled();
    await shot(p, '19-simulating');
    release();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Recipient is a regular wallet')).toBeVisible();
    await shot(p, '19-ready', true);
    await cancelToSend(p);
    // #19 failed: the network would reject it.
    h.fake.simulateError = true;
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('The network would reject this transfer')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Continue to confirm')).toHaveCount(0);
    await shot(p, '19-failed-simulation');
    h.fake.simulateError = false;
    await cancelToSend(p);
    // #19 failed: a remainder below the rent minimum (refused before simulating).
    await p.getByLabel('Amount').fill('9.9999');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('This would leave less than 0.00089088 SOL in your account, which Solana does not allow. Send less, so at least that much stays.')).toBeVisible({timeout: 30_000});
    await expect(p.getByRole('button', {name: 'Retry simulation'})).toHaveCount(0);
    await shot(p, '19-failed-rent');
    await cancelToSend(p);
    // #19 failed: the server gives no answer.
    h.fake.network = 'unreachable';
    await p.getByLabel('Amount').fill('0.01');
    await p.locator('.sticky-bar button').click();
    await expect(p.getByText('No answer from the Noctura server within 20 s.')).toBeVisible({timeout: 30_000});
    await expect(p.getByText('Cannot verify recipient type')).toBeVisible();
    await shot(p, '19-failed-unreachable');
    h.fake.network = 'ok';
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #20’s states — first-time, high-value, the proof in #10 with its priority row, confirmed, the quote expired', async () => {
  const h = await launchPopup('noctura-e2e-visual-confirm-');
  try {
    await realWallet(h);
    const p = await h.openPopup();
    await toSend(p);
    await fill(p, RECIPIENT, '0.01');
    await review(p);
    await p.getByRole('button', {name: 'Continue to confirm'}).click();
    await expect(p.getByText("You've never sent to this address")).toBeVisible();
    await expect(p.getByText('Confirmation opens in a new tab.')).toBeVisible();
    await shot(p, '20-first-time', true);
    await p.getByRole('button', {name: 'Back'}).click();
    await expect(p.getByText('Simulation passed')).toBeVisible({timeout: 30_000});
    await cancelToSend(p);
    await p.getByLabel('Amount').fill('1');
    await review(p);
    await p.getByRole('button', {name: 'Continue to confirm'}).click();
    await expect(p.getByText('High-value transfer')).toBeVisible();
    await expect(p.getByText("You'll confirm with your password (or passkey) in a new tab before this is sent.")).toBeVisible();
    await shot(p, '20-high-value', true);
    // The proof: #10 in a new tab, its fee rows as §4.5 defines them (the priority row, plan 3 carry 1).
    const opened = h.ctx.waitForEvent('page');
    await p.getByRole('button', {name: 'Send 1.0000 SOL'}).click();
    const tab = await opened;
    await tab.setViewportSize({width: 412, height: 916});
    await expect(tab.locator('#ra-rows .intent-row .label')).toHaveText(['To', 'Network fee', 'Priority', 'No Noctura fee (status unknown)'], {timeout: 30_000});
    mkdirSync(DIR, {recursive: true});
    await tab.screenshot({path: `${DIR}/10-idle-priority.png`, fullPage: true});
    await tab.fill('#ra-password', E2E_PASSWORD);
    await tab.click('#ra-confirm');
    await expect(tab.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible({timeout: 60_000});
    await tab.setViewportSize({width: 412, height: 600});
    await shot(tab, '20-confirmed', true);
    await tab.close();
    // The quote ends untouched, on a popup whose clock runs ahead: one automatic re-prepare, then "Quote expired —
    // refresh" (C5). Shot and closed: a page whose clock is ahead of the background's cannot take a fresh quote.
    const q = await h.openPopup({clock: true});
    await expect(q.getByText('Confirmed. Review the fresh quote and send.')).toBeVisible({timeout: 30_000});
    await q.clock.fastForward(31_000);
    await expect(q.getByText('Updated with a fresh network quote')).toBeVisible({timeout: 30_000});
    await q.clock.fastForward(31_000);
    await expect(q.getByText('Quote expired — refresh')).toBeVisible({timeout: 30_000});
    await expect(q.getByRole('button', {name: 'Refresh'})).toBeVisible();
    await shot(q, '20-quote-expired', true);
    expect(h.fake.broadcasts).toEqual([]);
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #21 and #54 — broadcasting, slow, stuck, sending again, sent again, expired; success; the popup’s resume; #26’s pending row', async () => {
  const h = await launchPopup('noctura-e2e-visual-status-');
  try {
    await realWallet(h, {known: true});
    // Success first, on the real clock: Playwright's clock is the whole context's, so every page after a
    // clock popup runs ahead of the background and cannot take a quote.
    h.fake.mode = 'confirm';
    const r = await h.openPopup();
    await toSend(r);
    await fill(r, RECIPIENT, '0.01');
    await review(r);
    await r.getByRole('button', {name: 'Continue to confirm'}).click();
    await r.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(r.getByText('Sent successfully')).toBeVisible({timeout: 30_000});
    await shot(r, '21-success', true);
    await r.close();
    h.fake.mode = 'expire';
    // #20 resumed on popup open (a prepared send waiting).
    const prep = await h.openPopup();
    await expect(prep.getByText('10.0000 SOL', {exact: true})).toBeVisible({timeout: 30_000});
    expect((await msg(prep, {type: 'wallet.prepareSend', account: ACCOUNT, intent: {token: 'SOL', recipient: RECIPIENT, amount: '10000000'}})).ok).toBe(true);
    await prep.close();
    const p = await h.openPopup({clock: true});
    await expect(p.getByText('You have a send waiting.')).toBeVisible({timeout: 30_000});
    await shot(p, '20-resume');
    await p.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    await expect(p.getByText('Broadcasting transaction…')).toBeVisible({timeout: 30_000});
    await shot(p, '21-broadcasting', true);
    await p.clock.fastForward(83_000);
    await expect(p.getByText('Taking longer than usual')).toBeVisible();
    await p.clock.pauseAt(await p.evaluate(() => Date.now() + 500));
    await shot(p, '21-slow', true);
    await p.clock.resume();
    await p.clock.fastForward(8_000);
    await expect(p.getByText('Transaction stuck')).toBeVisible();
    await shot(p, '54-stuck', true);
    // #26's pending row, from a second popup.
    const other = await h.openPopup();
    await other.getByRole('button', {name: 'Activity'}).click();
    await expect(other.getByText('PENDING')).toBeVisible({timeout: 30_000});
    await shot(other, '26-pending-row');
    await other.close();
    // Sending again, held open by the fake; then sent again.
    await p.waitForTimeout(2_500);
    const release = h.fake.hold();
    await p.getByRole('button', {name: 'Send again (same transaction)'}).click();
    await expect(p.getByText('Re-sending the same transaction.')).toBeVisible();
    await shot(p, '54-sending-again');
    release();
    await expect(p.getByText('The same transaction was sent to the network again. Its signature is unchanged, so only one copy can land.')).toBeVisible({timeout: 30_000});
    await shot(p, '54-sent-again');
    const pending = (await msg(p, {type: 'wallet.pending'})).data as {lastValidBlockHeight: number}[];
    h.fake.blockHeight = (pending[0]?.lastValidBlockHeight ?? 0) + 33;
    await expect(p.getByText('Not confirmed — no funds moved.')).toBeVisible({timeout: 45_000});
    await shot(p, '54-expired');
    contained(h);
  } finally {
    await h.close();
  }
});

test('visual: #44 — blockhash expired, rejected by the program, refused by the route; #11’s cancelled toast', async () => {
  const h = await launchPopup('noctura-e2e-visual-failed-');
  try {
    await realWallet(h, {known: true});
    const send = async (p: Page) => {
      await toSend(p);
      await fill(p, RECIPIENT, '0.01');
      await review(p);
      await p.getByRole('button', {name: 'Continue to confirm'}).click();
      await p.getByRole('button', {name: 'Send 0.0100 SOL'}).click();
    };
    // Refused by the route before forwarding: network-error.
    h.fake.broadcastReject = true;
    const a = await h.openPopup();
    await send(a);
    await expect(a.getByText("Couldn't send")).toBeVisible({timeout: 30_000});
    await expect(a.getByText('Reason · network-error')).toBeVisible();
    await shot(a, '44-network-error');
    h.fake.broadcastReject = false;
    await a.close();
    // Landed with an error: rejected-by-program.
    h.fake.mode = 'fail';
    const b = await h.openPopup();
    await send(b);
    await expect(b.getByText('Program rejected the transaction')).toBeVisible({timeout: 30_000});
    await shot(b, '44-rejected-by-program', true);
    await b.close();
    // Never seen, past its blockhash before #54 showed: blockhash-expired.
    h.fake.mode = 'expire';
    const c = await h.openPopup();
    await send(c);
    await expect(c.getByText('Broadcasting transaction…')).toBeVisible({timeout: 30_000});
    const pending = (await msg(c, {type: 'wallet.pending'})).data as {lastValidBlockHeight: number; state: string}[];
    h.fake.blockHeight = (pending.find(r => r.state === 'pending')?.lastValidBlockHeight ?? 0) + 33;
    await expect(c.getByText('Recent blockhash expired')).toBeVisible({timeout: 45_000});
    await shot(c, '44-blockhash-expired', true);
    await c.close();
    // #11's cancelled toast after #20's Cancel, under a paused clock (1.8 s).
    h.fake.mode = 'confirm';
    const e = await h.openPopup({clock: true});
    await toSend(e);
    await fill(e, RECIPIENT, '0.01');
    await review(e);
    await e.getByRole('button', {name: 'Continue to confirm'}).click();
    await e.clock.pauseAt(await e.evaluate(() => Date.now() + 1_000));
    await e.getByRole('button', {name: 'Cancel'}).click();
    await expect(e.getByText('Transaction cancelled. No fees charged.')).toBeVisible();
    await shot(e, '44-user-cancelled-toast');
    contained(h);
  } finally {
    await h.close();
  }
});
```

- [ ] **Step 2: Run the E2E — contained, then offline.**

```bash
npm run build && npx playwright test e2e/visual-send.spec.ts
unshare -rn env PATH="$PATH" npx playwright test e2e/visual-send.spec.ts   # if the runner has unshare
```
Expected (dry run): every test passes in both launches; every spec ends with `contained(h)`.

- [ ] **Step 3: The opus-tier visual review.**

For each shot in `extension/test-results/visual/`, open the same state in `/home/user/Downloads/index.html` and check, in order: (1) the top bar — title, step pill ("3 OF 4", "4 OF 4", SLOW, CONFIRMED, "90 s TIMEOUT"), back/close glyph; (2) every string against the spec's copy (the component tests already assert them — a mismatch here is a styling bug hiding text); (3) the design class in place (rings, pills, banners, the review card's high-value red, the fee block's columns, the sticky bar); (4) addresses in groups of four, monospace; amounts exact, ungrouped lamports on #19/#20/#10; (5) disabled states visibly disabled (Simulating…, Waiting for confirmation, Send under a pending send or an expired quote); (6) nothing clipped at 412 px, no horizontal scroll (the `-end` shots show the bottom). (7) #20's fee dollars: the priority row reads "< $0.0001", never "$0.0000" (review L3); #44 rejected-by-program shows [Try again], [View details] and [View on explorer] (review M4). Shots: 11-loaded-send, 12-idle, 12-invalid-recipient, 12-insufficient, 12-max, 12-first-time(-end), 43-default, 19-simulating, 19-ready(-end), 19-failed-simulation, 19-failed-rent, 19-failed-unreachable, 20-first-time(-end), 20-high-value(-end), 10-idle-priority, 20-confirmed(-end), 20-quote-expired(-end), 20-resume, 21-broadcasting(-end), 21-slow(-end), 54-stuck(-end), 26-pending-row, 54-sending-again, 54-sent-again, 54-expired, 21-success(-end), 44-network-error, 44-rejected-by-program(-end), 44-blockhash-expired(-end), 44-user-cancelled-toast. Each finding is fixed or declared in that screen's Differs entry, and listed in the PR description.

- [ ] **Step 4: Commit.**

```bash
git add extension/e2e/fakeCoordinator.ts extension/e2e/visual-send.spec.ts
git commit -F - <<'MSG'
test(extension): the send flow's visual pass — every state of #11, #12, #43, #19, #20, #10, #21, #54, #44 at 412 × 600

Co-Authored-By: <the executing model's own line>
MSG
```

## Review 1 (Fable 5.1) — how each finding was applied

Verdict: approve after fixes (0 Blocker, 1 High, 5 Medium, 10 Low); the money path was spot-checked and holds. Every finding is applied in the tasks above, each with a test and a named mutation:

- **H1** (Tasks 4, 14) — a failed transaction is `sent` only with exactly one transfer from the owner, of a known mint; a batch, a token-plus-SOL pair and an unknown mint decode `other`; #27's `[Try again]` only for a `sent` decode; §6.2 states that inner (CPI) instructions are not read. Tests: `history.test.ts` (three negative cases), `TxDetail.test.tsx` (a real two-transfer decode → "FAILED", no `[Try again]`). Mutations M4c (keep the sum — red in both files), M4d (accept an unknown mint).
- **M1** (Tasks 3, 9) — `preparedFor` reports `expired` when the challenge is dead by its real expiry (C5's cap), not by `createdAt + 120 s`; the resume re-prepares with a fresh challenge; one tap opens a live #10; no loop. Tests: `send.test.ts` (engine) and `Confirm.test.tsx` (end to end, the dead-challenge resume through the real background). Mutation M3d.
- **M2** (Task 9) — the backstop walks all of `src/` and catches the object-literal and bracket forms; fixtures and negative controls; the plan names its scope truthfully. Mutations M9h (a sneaked `.send(` in Home), M9i (`deps.send({type: 'wallet.send'})` in the vault page).
- **M3** (Task 10) — the held test asserts exactly one broadcast; a second test makes a second press NOT too soon, so only the lock stops it. Mutation M10b (LockedButton's ref guard removed) is red there.
- **M4** (Task 11) — `[View details]` → #27 restored on `rejected-by-program` only (the controller's ruling); §4.7 says so. Mutation M11b.
- **M5** (Task 9) — the reauth-required-without-id test drives the stored state (the challenge's life ends when `takePrepared` writes), not the number of `deps.now()` calls. Mutation M9l.
- **L1** (Task 9) — no automatic re-prepare while a send is open; test; M9j. **L2** — the stale-proof re-read; test; M9k. **L3** — "< $0.0001" (`format.ts`), listed for Task 17's reviewer; M9m. **L4** — the DOM-derived sum; M9n. **L5** — "yesterday" (Task 6); M6c. **L6** — never "Send 1. SOL" (Task 7); M7b. **L7** — the StrictMode note in `mount.tsx` (Task 13). **L8** — no change: the simulation's rent refusal already says "the simulation refused it for rent" in its detail. **L9** — M12b kept as an equivalent mutant. **L10** — M9d kept as masked by design; M9d2 is the control.
- **Copy verdicts** — the sender-below-rent wording changed to the review's; "· yesterday" replaces "· last 1 day ago"; every proposed line stays "controller addition — awaiting the owner" (Scope 3–4). **Author's gaps** — §8.5 records that a token-send E2E is owed when the first token-send path is exercised on a device.

## Before the PR (the standing rules)

- [ ] Reproduce CI with **only** `web/` and `extension/` installed, on Node 22.12 (`PATH="$(dirname $(npx -y -p node@22.12.0 node -e 'console.log(process.execPath)')):$PATH"`): `npm ci --ignore-scripts` in both, `npm run verify` in both, `npm run e2e` in `extension/` — in a normal launch and under `unshare -rn` if the runner has it. Task 4 touches `core/`: web's verify runs its tests. No task touches the root `src/`; the dry run ran the root `tsc` and `jest` anyway.
- [ ] `node scripts/check-no-tge-date.mjs` from the repository root — this plan and every file it adds are clean.
- [ ] The opus-tier visual review's findings (Task 17) are in the PR description, each fixed or declared in the spec's Differs.
- [ ] The owner's answers to Q1–Q4 (Scope 3) are recorded; if Q1 is B, drop Task 4 and #27's `[Try again]` in Task 14 before merging.

## Self-review

- **Spec coverage.** §4.2 #12 (Task 7), §4.3 #43 (Task 7), §4.4 #19 (Task 8), §4.5 #20 and its resume (Tasks 9, 13), §4.6 #21 (Task 12), §4.7 #44 (Task 11), §4.8 #54 (Task 10), §5.1/§6.2/§6.3 stand-ins (Tasks 4, 14), §1.6 (Task 13), §8.5 specs 4, 5, 11 (Tasks 15, 16), §8.6 (Task 17), §11.5 (Tasks 2, 6, 15). D38 (Tasks 9, 13, 15 — the section above), D39 (Tasks 3, 8, 9), C5 (Task 9), E2 (Task 8's After), E3 (Task 1), E6 (Tasks 6, 7, 15), E7 (Tasks 8, 9, 15), E8 (Tasks 11, 12). Carries: 1 → Task 1; 2 → Tasks 2, 6, 8; 3 → Tasks 4, 14 (owner Q1); 4 → Task 5 (+ every screen test); 5 → Task 15; 6 → Tasks 9, 13, 15.
- **Rule 6.** Send (#12 CTA), Continue and Retry (#19), Send and Refresh (#20), Send again (#54), Try again (#44, #27), Close this tab (#21) are `LockedButton`s, each with a double-press test that lifts `disabled`.
- **Generation checks.** #12's E6 reply (M7a); #19's prepare after leaving (M8a); #20's re-prepare after Cancel (M9f), its open-sequence reads (`left`), the in-flight send (M9d2, M9g), the stale-proof re-read (`left` after the await); #21's poll (`alive`; M12b is equivalent — stated); #54's resend (`alive`); the popup's resume check (M13c).
- **Placeholders.** None: every step has its code, its command and its expected output; the one generated file has its generator and its hash.
- **Type consistency.** `PreparedView`, `Pending`, `Intent`, `Draft`, `Route`, `RouteAction` and `Platform` are used as each task's Interfaces block states; the replay proved each task compiles and passes on its own predecessor.

## Dry-run findings (each fixed in the code above)

The end state was applied task by task to a scratch copy (git-archive, outside the repository) on Node 22.12 with only `web/` and `extension/` installed; then: extension `npm run verify` (tsc, build, vitest 111 files / 1935 tests passed, CSP, secrets, every gate, reproducible build) — green; E2E contained 31 passed of 31, and under `unshare -rn` 31 passed of 31; web `npm run verify` — 508 passed (508) tests (plus its script tests), green; root `tsc` clean and `jest` 1 skipped, 1228 passed, 1229 total; the repo-wide TGE gate clean. Every named mutation was run as stated.

1. **#20's Cancel during an in-flight send** would discard nothing (the send holds the prepared send) and show "Transaction cancelled. No fees charged." over a broadcast. Fixed: while the tap's `wallet.send` is in flight, Cancel is disabled and Cancel/Back/Esc are inert (Task 9, M9d2/M9g).
2. **Playwright's clock is the whole context's**, not the page's: every page opened after a clock popup ran ahead of the background, so #20 found its quote already expired ("Quote expired — refresh") and Send stayed disabled. Fixed: the visual spec shoots the confirmed send first, on the real clock (Task 17).
3. **One transient failure in the replay** (review 1's re-run): the whole-suite run after Task 15 — which changes no file vitest runs (only `e2e/` and the spec) — reported 1 failed of 1935 once; the same tree passed three full runs and `npm run verify`. Not reproduced, so not identified; the candidates are pre-existing tests that run near vitest's 5 s default under load (`create.test.ts`'s 1000-plan cases at 3.4–4.7 s, `envelopeKat.test.ts` at 4.9–5.2 s, plan 1 and 2 code). Recorded, not changed: raising those timeouts is outside plan 3.
4. **Review 1's re-run:** the reworked tests caught that a second press on #54 can never reach the lock through `fireEvent` — React re-renders between events, so the button is disabled (or replaced by the "sending" layout) first; the M3 test presses twice inside one `act()`, and only then does removing the lock (M10b) turn it red. Removing only one of `LockedButton`'s two layers stays green by design (the ref and the `disabled` state each hold).
5. **Survivors that became tests:** M3c (the Noctura fee in `feeLamports` — the extension charges none today, so a `vi.mock` policy test), M4a (a failed transfer signed only as token authority while another account paid), M9f (Cancel during C5's re-prepare), M13c (a user who moved on before `preparedFor` answered). M9d alone is masked by the `disabled` prop by design; M12b is equivalent.
6. **E2E strictness:** "Sent SOL" also matched "Failed · sent SOL" after Task 4 (exact matching); `getByLabel('Recipient')` also matched "Clear recipient" (exact); #19's Cancel left `.sticky-bar button` ambiguous until #12 was back (wait for #12); the plan-2 wallet spec expected the resume stand-in's text (now #20's "Confirmed…", Task 13).
7. **Unstyled classes the ancestor-aware check caught:** `.lbl` on #20's non-total fee rows, `.mono` inside a detail value, `.app-secondary` scoped too narrowly; and a dynamic `${c.tone}` class the gate could not see (added to `check-classes.mjs`'s DYNAMIC list).
8. **Arithmetic the tests had wrong first** (MAX 62.48116412, SPL After 62.48005247, the NOC dollar line) — corrected against the engine, not the other way round.
9. **The fake coordinator answered simulations without the fee**; spec §11.5 measured a node answering with it. The fake now applies 5 000 per signature plus the priority fee, and spec 4 asserts #19's "After" from the fake's own number.

## Execution handoff

Plan complete. Execute with superpowers:subagent-driven-development (a fresh implementer per task, the two-stage review between tasks; Task 9 — #20 — reviewed as the security core; Task 17's visual review by an opus-tier reviewer), or superpowers:executing-plans in one session with checkpoints.
